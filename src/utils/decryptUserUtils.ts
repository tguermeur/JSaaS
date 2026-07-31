/**
 * Utilitaires pour décrypter automatiquement prénom / nom / displayName
 * (affichage site-wide via decryptUserDataForStructure + cache partagé).
 */

import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth, db, getAppFunctions, FUNCTIONS_REGION } from '../firebase/config';
import { batchDecryptForStructure } from './batchDecrypt';

function getCallableFunctions() {
  return app ? getAppFunctions() : getFunctions(undefined, FUNCTIONS_REGION);
}

export const isEncryptedField = (v: unknown): boolean =>
  typeof v === 'string' && (v.startsWith('ENC:') || v.startsWith('ENC2:'));

const SUCCESS_CACHE_TTL_MS = 10 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 30 * 1000;
/** Concurrency de secours si le batch n'est pas disponible. */
const MAX_DECRYPT_CONCURRENCY = 6;

export type UserDisplayData = { displayName: string; firstName: string; lastName: string };
export type RawUserDisplayData = {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  displayFirstName?: string;
  displayLastName?: string;
};
export type RawUserContactData = { phone?: string; studentId?: string };
export type UserContactData = { phone: string; studentId: string };
export type UserStructureData = UserDisplayData & UserContactData & {
  graduationYear?: string;
  program?: string;
};

const decryptInFlight = new Map<string, Promise<UserDisplayData>>();
const decryptCache = new Map<string, { expiresAt: number; value: UserDisplayData }>();
const structureDecryptInFlight = new Map<string, Promise<UserStructureData>>();
const structureCache = new Map<string, { expiresAt: number; value: UserStructureData }>();
const nameCacheListeners = new Set<() => void>();
let globalDecryptCooldownUntil = 0;

function notifyNameCacheListeners(): void {
  nameCacheListeners.forEach((listener) => listener());
}

export function subscribeUserNameCache(listener: () => void): () => void {
  nameCacheListeners.add(listener);
  return () => nameCacheListeners.delete(listener);
}

export function getCachedUserDisplayData(userId: string): UserDisplayData | null {
  const cached = decryptCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const structureCached = structureCache.get(userId);
  if (structureCached && structureCached.expiresAt > Date.now()) {
    const { displayName, firstName, lastName } = structureCached.value;
    return { displayName, firstName, lastName };
  }
  return null;
}

export function getCachedUserContactData(userId: string): UserContactData | null {
  const cached = structureCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    const { phone, studentId } = cached.value;
    return { phone, studentId };
  }
  return null;
}

function toPlainContact(raw?: RawUserContactData | null): UserContactData {
  const phone = raw?.phone && !isEncryptedField(raw.phone) ? raw.phone : '';
  const studentId = raw?.studentId && !isEncryptedField(raw.studentId) ? raw.studentId : '';
  return { phone, studentId };
}

function needsContactDecrypt(raw?: RawUserContactData | null): boolean {
  if (!raw) return true;
  return isEncryptedField(raw.phone) || isEncryptedField(raw.studentId);
}

function cacheStructureData(userId: string, value: UserStructureData): void {
  const entry = { value, expiresAt: Date.now() + SUCCESS_CACHE_TTL_MS };
  structureCache.set(userId, entry);
  decryptCache.set(userId, {
    value: {
      displayName: value.displayName,
      firstName: value.firstName,
      lastName: value.lastName,
    },
    expiresAt: entry.expiresAt,
  });
  notifyNameCacheListeners();
}

function extractStructureData(
  dec: Record<string, unknown>,
  raw?: RawUserDisplayData | null
): UserStructureData {
  const firstName =
    (dec.firstName && !isEncryptedField(dec.firstName) ? dec.firstName : raw?.firstName) || '';
  const lastName =
    (dec.lastName && !isEncryptedField(dec.lastName) ? dec.lastName : raw?.lastName) || '';
  const displayName =
    (dec.displayName && !isEncryptedField(dec.displayName) ? dec.displayName : null) ||
    (firstName || lastName ? `${firstName} ${lastName}`.trim() : raw?.displayName) ||
    '';
  const phone = typeof dec.phone === 'string' && !isEncryptedField(dec.phone) ? dec.phone : '';
  const studentId =
    typeof dec.studentId === 'string' && !isEncryptedField(dec.studentId) ? dec.studentId : '';
  const graduationYear =
    typeof dec.graduationYear === 'string' && !isEncryptedField(dec.graduationYear)
      ? dec.graduationYear
      : '';
  const program =
    typeof dec.program === 'string' && !isEncryptedField(dec.program) ? dec.program : '';
  return {
    displayName: typeof displayName === 'string' ? displayName : '',
    firstName: typeof firstName === 'string' ? firstName : '',
    lastName: typeof lastName === 'string' ? lastName : '',
    phone,
    studentId,
    graduationYear,
    program,
  };
}

async function fetchRawUserContactData(userId: string): Promise<RawUserContactData | null> {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      phone: d.phone as string | undefined,
      studentId: d.studentId as string | undefined,
    };
  } catch {
    return null;
  }
}

async function decryptUserStructureData(
  userId: string,
  rawData?: RawUserDisplayData | null,
  options?: { twoFactorCode?: string }
): Promise<UserStructureData> {
  const now = Date.now();
  const cached = structureCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  if (globalDecryptCooldownUntil > now) {
    return { ...toFallback(rawData), ...toPlainContact() };
  }

  const existingRequest = structureDecryptInFlight.get(userId);
  if (existingRequest) {
    return existingRequest;
  }

  const decryptRequest = (async () => {
    const functions = getCallableFunctions();
    const isOwnUser = auth?.currentUser?.uid === userId;
    const callableName = isOwnUser ? 'decryptOwnUserData' : 'decryptUserDataForStructure';
    const decryptFn = httpsCallable(functions, callableName);
    const payload = isOwnUser
      ? {}
      : {
          userId,
          ...(options?.twoFactorCode ? { twoFactorCode: options.twoFactorCode } : {}),
        };

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await decryptFn(payload);
        const dec = (result.data as { decryptedData?: Record<string, unknown> })?.decryptedData;
        if (!dec) {
          return { ...toFallback(rawData), ...toPlainContact() };
        }
        const value = extractStructureData(dec, rawData);
        cacheStructureData(userId, value);
        return value;
      } catch (e) {
        lastError = e;
        if (isRateLimitedError(e)) {
          globalDecryptCooldownUntil = Date.now() + FAILURE_COOLDOWN_MS;
          console.warn('Décryptage temporairement ralenti (429): cooldown 30s activé');
          break;
        }
        if (isRetryableDecryptError(e) && attempt < 2) {
          await sleep(400 * (attempt + 1));
          continue;
        }
        break;
      }
    }

    console.warn('Décryptage utilisateur ignoré:', userId, lastError);
    return { ...toFallback(rawData), ...toPlainContact() };
  })();

  structureDecryptInFlight.set(userId, decryptRequest);
  try {
    return await decryptRequest;
  } finally {
    structureDecryptInFlight.delete(userId);
  }
}

/**
 * Décrypte téléphone et numéro étudiant via decryptUserDataForStructure.
 */
export async function decryptUserContactFields(
  userId: string,
  rawData?: RawUserContactData | null
): Promise<UserContactData> {
  if (!userId || userId === 'manual') {
    return { phone: '', studentId: '' };
  }

  let raw = rawData;
  if (!raw || needsContactDecrypt(raw)) {
    const fetched = await fetchRawUserContactData(userId);
    if (fetched) {
      raw = { ...fetched, ...raw };
    }
  }

  const cached = getCachedUserContactData(userId);
  if (cached) {
    return cached;
  }

  if (!needsContactDecrypt(raw)) {
    const value = toPlainContact(raw);
    const existing = structureCache.get(userId);
    if (existing && existing.expiresAt > Date.now()) {
      cacheStructureData(userId, { ...existing.value, ...value });
    }
    return value;
  }

  const structureData = await decryptUserStructureData(userId);
  return { phone: structureData.phone, studentId: structureData.studentId };
}

function toFallback(rawData: RawUserDisplayData | null | undefined): UserDisplayData {
  const fromDisplay = preferDisplayFields(rawData);
  if (fromDisplay) return fromDisplay;
  const firstName = rawData?.firstName && !isEncryptedField(rawData.firstName) ? rawData.firstName : '';
  const lastName = rawData?.lastName && !isEncryptedField(rawData.lastName) ? rawData.lastName : '';
  const displayName =
    (rawData?.displayName && !isEncryptedField(rawData.displayName) ? rawData.displayName : '') ||
    `${firstName} ${lastName}`.trim() ||
    '';
  return { displayName, firstName, lastName };
}

/** Utilise display* plaintext sans appeler batchDecrypt. */
export function preferDisplayFields(
  raw: RawUserDisplayData | null | undefined
): UserDisplayData | null {
  if (!raw) return null;
  const firstName =
    (raw.displayFirstName && !isEncryptedField(raw.displayFirstName) ? raw.displayFirstName : '') ||
    (raw.firstName && !isEncryptedField(raw.firstName) ? raw.firstName : '');
  const lastName =
    (raw.displayLastName && !isEncryptedField(raw.displayLastName) ? raw.displayLastName : '') ||
    (raw.lastName && !isEncryptedField(raw.lastName) ? raw.lastName : '');
  const displayName =
    (raw.displayName && !isEncryptedField(raw.displayName) ? raw.displayName : '') ||
    `${firstName} ${lastName}`.trim();

  const hasDisplayPlain =
    (typeof raw.displayFirstName === 'string' &&
      !!raw.displayFirstName &&
      !isEncryptedField(raw.displayFirstName)) ||
    (typeof raw.displayLastName === 'string' &&
      !!raw.displayLastName &&
      !isEncryptedField(raw.displayLastName)) ||
    (typeof raw.displayName === 'string' &&
      !!raw.displayName &&
      !isEncryptedField(raw.displayName));

  if (!hasDisplayPlain && !firstName && !lastName) return null;
  if (!hasDisplayPlain && (isEncryptedField(raw.firstName) || isEncryptedField(raw.lastName))) {
    return null;
  }
  if (!firstName && !lastName && !displayName) return null;
  return { firstName, lastName, displayName };
}

function needsNameDecrypt(raw: RawUserDisplayData | null | undefined): boolean {
  if (!raw) return true;
  if (preferDisplayFields(raw)) return false;
  return (
    isEncryptedField(raw.displayName) ||
    isEncryptedField(raw.firstName) ||
    isEncryptedField(raw.lastName)
  );
}

function isRateLimitedError(error: unknown): boolean {
  const asAny = error as { code?: string; message?: string };
  const code = String(asAny?.code || '');
  const message = String(asAny?.message || '');
  return code.includes('resource-exhausted') || message.includes('429');
}

function isRetryableDecryptError(error: unknown): boolean {
  const asAny = error as { code?: string; message?: string };
  const code = String(asAny?.code || '');
  const message = String(asAny?.message || '').toLowerCase();
  return (
    code.includes('internal') ||
    code.includes('unavailable') ||
    code.includes('deadline-exceeded') ||
    message.includes('internal')
  );
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let running = 0;

  return new Promise((resolve, reject) => {
    const pump = () => {
      if (nextIndex >= items.length && running === 0) {
        resolve(results);
        return;
      }
      while (running < limit && nextIndex < items.length) {
        const currentIndex = nextIndex++;
        running += 1;
        worker(items[currentIndex], currentIndex)
          .then((value) => {
            results[currentIndex] = value;
          })
          .catch(reject)
          .finally(() => {
            running -= 1;
            pump();
          });
      }
    };
    pump();
  });
}

/** Exposé pour paralléliser d'autres boucles decrypt (fallback hors batch). */
export { mapWithConcurrency };

async function fetchRawUserDisplayData(userId: string): Promise<RawUserDisplayData | null> {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      displayName: d.displayName as string | undefined,
      firstName: d.firstName as string | undefined,
      lastName: d.lastName as string | undefined,
      displayFirstName: d.displayFirstName as string | undefined,
      displayLastName: d.displayLastName as string | undefined,
    };
  } catch {
    return null;
  }
}

/** Indique si le prénom/nom doit encore être déchiffré. */
export function userNeedsNameDecrypt(
  user:
    | {
        firstName?: string;
        lastName?: string;
        displayName?: string;
        displayFirstName?: string;
        displayLastName?: string;
      }
    | null
    | undefined
): boolean {
  if (!user) return false;
  if (preferDisplayFields(user)) return false;
  return (
    isEncryptedField(user.firstName) ||
    isEncryptedField(user.lastName) ||
    isEncryptedField(user.displayName)
  );
}

/**
 * Libellé complet prénom + nom (cache uniquement). Retourne '' si déchiffrement en cours
 * — préférer UserNameText / useDecryptedUserName pour l'UI avec skeleton.
 */
export function formatUserFullName(
  user: { id?: string; firstName?: string; lastName?: string; displayName?: string } | null | undefined,
  fallback = ''
): string {
  if (!user) return fallback;
  if (user.id) {
    const cached = getCachedUserDisplayData(user.id);
    if (cached) {
      return cached.displayName || `${cached.firstName} ${cached.lastName}`.trim() || fallback;
    }
  }
  const fn = user.firstName || '';
  const ln = user.lastName || '';
  if (!isEncryptedField(fn) && !isEncryptedField(ln)) {
    return user.displayName || `${fn} ${ln}`.trim() || fallback;
  }
  if (userNeedsNameDecrypt(user)) {
    if (user.id) {
      void decryptUserDisplayData(user.id, {
        displayName: user.displayName,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    }
    return '';
  }
  return user.displayName && !isEncryptedField(user.displayName)
    ? user.displayName
    : fallback;
}

/**
 * Décrypte les champs nom/prénom via decryptUserDataForStructure (membres de la structure).
 */
export async function decryptUserDisplayData(
  userId: string,
  rawData?: RawUserDisplayData | null,
  options?: { twoFactorCode?: string }
): Promise<UserDisplayData> {
  let raw = rawData;
  if (!raw || needsNameDecrypt(raw)) {
    const fetched = await fetchRawUserDisplayData(userId);
    if (fetched) {
      raw = { ...fetched, ...raw };
    }
  }

  const fromDisplay = preferDisplayFields(raw);
  if (fromDisplay) {
    decryptCache.set(userId, { value: fromDisplay, expiresAt: Date.now() + SUCCESS_CACHE_TTL_MS });
    return fromDisplay;
  }

  if (!raw || !needsNameDecrypt(raw)) {
    const value = toFallback(raw);
    decryptCache.set(userId, { value, expiresAt: Date.now() + SUCCESS_CACHE_TTL_MS });
    return value;
  }

  const now = Date.now();
  const cached = decryptCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  if (globalDecryptCooldownUntil > now) {
    return toFallback(raw);
  }

  const existingRequest = decryptInFlight.get(userId);
  if (existingRequest) {
    return existingRequest;
  }

  const structureCached = structureCache.get(userId);
  if (structureCached && structureCached.expiresAt > now) {
    const { displayName, firstName, lastName } = structureCached.value;
    return { displayName, firstName, lastName };
  }

  const decryptRequest = (async () => {
    const structureData = await decryptUserStructureData(userId, raw, options);
    return {
      displayName: structureData.displayName,
      firstName: structureData.firstName,
      lastName: structureData.lastName,
    };
  })();

  decryptInFlight.set(userId, decryptRequest);
  try {
    return await decryptRequest;
  } finally {
    decryptInFlight.delete(userId);
  }
}

/**
 * Retourne le nom affichable (décrypté si nécessaire). Charge Firestore si rawData absent.
 */
export async function getDecryptedUserDisplayName(
  userId: string,
  rawData: RawUserDisplayData | null | undefined
): Promise<string> {
  if (!userId) return 'Inconnu';
  const dec = await decryptUserDisplayData(userId, rawData ?? undefined);
  return dec.displayName || `${dec.firstName} ${dec.lastName}`.trim() || 'Inconnu';
}

/**
 * Décrypte une liste d'utilisateurs (prénom/nom) — à appeler après chaque chargement Firestore.
 * Utilise batchDecryptForStructure (1 callable / 50 ids) puis lit le cache.
 */
export async function decryptUsersList<
  T extends {
    id: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    displayFirstName?: string;
    displayLastName?: string;
    graduationYear?: string;
    program?: string;
  }
>(users: T[]): Promise<T[]> {
  // Prefill cache from display* to avoid CF for name display
  for (const user of users) {
    const preferred = preferDisplayFields(user);
    if (preferred) {
      decryptCache.set(user.id, {
        value: preferred,
        expiresAt: Date.now() + SUCCESS_CACHE_TTL_MS,
      });
    }
  }

  const toDecrypt = users.filter((u) => {
    if (preferDisplayFields(u)) {
      // Still need decrypt if graduationYear/program encrypted
      return isEncryptedField(u.graduationYear) || isEncryptedField(u.program);
    }
    return (
      isEncryptedField(u.displayName) ||
      isEncryptedField(u.firstName) ||
      isEncryptedField(u.lastName) ||
      isEncryptedField(u.graduationYear) ||
      isEncryptedField(u.program)
    );
  });
  if (toDecrypt.length === 0) {
    return users.map((u) => {
      const preferred = preferDisplayFields(u);
      if (!preferred) return u;
      return {
        ...u,
        firstName: preferred.firstName || u.firstName,
        lastName: preferred.lastName || u.lastName,
        displayName: preferred.displayName || u.displayName,
      };
    });
  }

  const uniqueToDecrypt = Array.from(new Map(toDecrypt.map((user) => [user.id, user])).values());
  const now = Date.now();
  const idsNeedingNetwork = uniqueToDecrypt
    .filter((user) => {
      const cached = structureCache.get(user.id);
      return !(cached && cached.expiresAt > now);
    })
    .map((u) => u.id);

  if (idsNeedingNetwork.length > 0) {
    try {
      const batchResults = await batchDecryptForStructure<{
        firstName?: string;
        lastName?: string;
        displayName?: string;
        phone?: string;
        studentId?: string;
        graduationYear?: string;
        program?: string;
      }>('user', idsNeedingNetwork, [
        'firstName',
        'lastName',
        'displayName',
        'phone',
        'studentId',
        'graduationYear',
        'program',
      ]);

      for (const user of uniqueToDecrypt) {
        const dec = batchResults[user.id];
        if (!dec) continue;
        const value = extractStructureData(dec as Record<string, unknown>, user);
        cacheStructureData(user.id, value);
      }
    } catch (error) {
      console.warn('[decryptUsersList] batch échoué, fallback individuel:', error);
    }
  }

  const decrypted = await mapWithConcurrency(uniqueToDecrypt, MAX_DECRYPT_CONCURRENCY, async (user) => {
    const structureData = await decryptUserStructureData(user.id, user);
    const merged = { ...user } as T;
    if (structureData.displayName) merged.displayName = structureData.displayName;
    if (structureData.firstName) merged.firstName = structureData.firstName;
    if (structureData.lastName) merged.lastName = structureData.lastName;
    if (structureData.graduationYear) merged.graduationYear = structureData.graduationYear;
    if (structureData.program) merged.program = structureData.program;
    return merged;
  });
  const decryptedMap = new Map(decrypted.map((u) => [u.id, u]));
  return users.map((u) => {
    const fromBatch = decryptedMap.get(u.id);
    if (fromBatch) return fromBatch;
    const preferred = preferDisplayFields(u);
    if (!preferred) return u;
    return {
      ...u,
      firstName: preferred.firstName || u.firstName,
      lastName: preferred.lastName || u.lastName,
      displayName: preferred.displayName || u.displayName,
    };
  });
}

/**
 * Précharge les noms affichés pour une liste d'userIds (warms cache avant mount des hooks UI).
 */
export async function prefetchUserDisplayNames(userIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  const now = Date.now();
  const idsNeedingNetwork = uniqueIds.filter((id) => {
    const cached = structureCache.get(id) || decryptCache.get(id);
    return !(cached && cached.expiresAt > now);
  });
  if (idsNeedingNetwork.length === 0) return;

  try {
    const batchResults = await batchDecryptForStructure<{
      firstName?: string;
      lastName?: string;
      displayName?: string;
      phone?: string;
      studentId?: string;
      graduationYear?: string;
      program?: string;
    }>('user', idsNeedingNetwork, [
      'firstName',
      'lastName',
      'displayName',
      'phone',
      'studentId',
      'graduationYear',
      'program',
    ]);

    for (const id of idsNeedingNetwork) {
      const dec = batchResults[id];
      if (!dec) continue;
      const value = extractStructureData(dec as Record<string, unknown>, null);
      cacheStructureData(id, value);
    }
  } catch (error) {
    console.warn('[prefetchUserDisplayNames] batch échoué:', error);
    await mapWithConcurrency(idsNeedingNetwork, MAX_DECRYPT_CONCURRENCY, (id) =>
      decryptUserDisplayData(id)
    );
  }
}

/**
 * Affiche la liste tout de suite puis met à jour après décryptage des noms (UX fluide).
 */
export async function decryptUsersListProgressive<T extends {
  id: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
}>(
  users: T[],
  onUpdate: (updated: T[]) => void
): Promise<T[]> {
  const decrypted = await decryptUsersList(users);
  onUpdate(decrypted);
  return decrypted;
}

/**
 * Décrypte les données utilisateur pour l'affichage admin (connexions/inscriptions)
 */
export async function getDecryptedUserForActivity(
  userId: string,
  rawData: { displayName?: string; firstName?: string; lastName?: string; ecole?: string },
  structureNameFromMap: string,
  options?: { twoFactorCode?: string }
): Promise<{ displayName: string; structureName: string }> {
  const needsDecrypt =
    rawData &&
    (isEncryptedField(rawData.displayName) ||
      isEncryptedField(rawData.firstName) ||
      isEncryptedField(rawData.lastName) ||
      isEncryptedField(rawData.ecole));

  if (!needsDecrypt) {
    const displayName =
      rawData?.displayName || `${rawData?.firstName || ''} ${rawData?.lastName || ''}`.trim() || '';
    return {
      displayName,
      structureName: structureNameFromMap || rawData?.ecole || 'Non assigné',
    };
  }

  const dec = await decryptUserDisplayData(userId, rawData, options);
  const ecole =
    rawData?.ecole && !isEncryptedField(rawData.ecole) ? rawData.ecole : rawData?.ecole || '';
  return {
    displayName: dec.displayName,
    structureName: structureNameFromMap || ecole || 'Non assigné',
  };
}

/**
 * Libellé affichable pour écriture Firestore — jamais de valeur ENC:.
 */
export function getSafeDisplayName(
  user: {
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    displayFirstName?: string | null;
    displayLastName?: string | null;
    email?: string | null;
  } | null | undefined,
  fallback = 'Utilisateur'
): string {
  if (!user) return fallback;
  const preferred = preferDisplayFields({
    displayName: user.displayName ?? undefined,
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    displayFirstName: user.displayFirstName ?? undefined,
    displayLastName: user.displayLastName ?? undefined,
  });
  if (preferred?.displayName) return preferred.displayName;
  const firstName = user.firstName && !isEncryptedField(user.firstName) ? user.firstName : '';
  const lastName = user.lastName && !isEncryptedField(user.lastName) ? user.lastName : '';
  const fromParts = `${firstName} ${lastName}`.trim();
  if (fromParts) return fromParts;
  if (user.displayName && !isEncryptedField(user.displayName)) return user.displayName;
  if (user.email) return user.email;
  return fallback;
}

/**
 * Décrypte une liste d'utilisateurs pour l'affichage activité (connexions/inscriptions)
 */
export async function decryptActivityUsersList<
  T extends {
    id: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    ecole?: string;
    structureId?: string;
    structureName?: string;
  }
>(users: T[], getStructureNameFromMap: (user: T) => string): Promise<T[]> {
  const decrypted = await mapWithConcurrency(users, MAX_DECRYPT_CONCURRENCY, async (user) => {
    const { displayName, structureName } = await getDecryptedUserForActivity(
      user.id,
      user,
      getStructureNameFromMap(user)
    );
    return { ...user, displayName, structureName };
  });
  return decrypted;
}
