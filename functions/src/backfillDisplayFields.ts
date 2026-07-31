/**
 * Callable : backfill des champs display* (plaintext) sur les users.
 * Déchiffre firstName / lastName / displayName puis écrit displayFirstName,
 * displayLastName et displayName en clair. Idempotent.
 *
 * Autorisé : superadmin, ou admin de structure (scope structureId).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { decrypt } from './encryption';
import { getCallerUser, isSuperAdminUser } from './authHelpers';

const functionConfig = {
  memory: '512MiB' as const,
  timeoutSeconds: 540,
  region: 'us-central1' as const,
  minInstances: 0,
  maxInstances: 1,
  concurrency: 1,
  allowUnauthenticated: false,
  cors: true,
  secrets: ['ENCRYPTION_KEY'],
};

const isEnc = (v: unknown): boolean =>
  typeof v === 'string' && v.startsWith('ENC:');

async function decryptIfNeeded(value: unknown): Promise<string> {
  if (typeof value !== 'string' || !value.trim()) return '';
  if (!isEnc(value)) return value.trim();
  try {
    return (await decrypt(value)).trim();
  } catch {
    return '';
  }
}

export const backfillDisplayFields = onCall(functionConfig, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentification requise');
  }

  const caller = await getCallerUser(request.auth.uid);
  if (!caller) {
    throw new HttpsError('permission-denied', 'Utilisateur introuvable');
  }

  const isSuperAdmin = isSuperAdminUser(caller);
  const structureId = (request.data?.structureId as string | undefined) || undefined;
  const dryRun = request.data?.dryRun === true;
  const batchLimit = Math.min(Number(request.data?.limit) || 200, 500);

  if (!isSuperAdmin) {
    const status = caller.status || caller.role;
    if (
      !(status === 'admin' || status === 'admin_structure') ||
      !caller.structureId ||
      (structureId && structureId !== caller.structureId)
    ) {
      throw new HttpsError(
        'permission-denied',
        'Réservé au superadmin ou admin de structure'
      );
    }
  }

  const scopeStructureId = isSuperAdmin ? structureId : (caller.structureId as string);
  if (!isSuperAdmin && !scopeStructureId) {
    throw new HttpsError('failed-precondition', 'structureId requis');
  }

  const db = admin.firestore();
  let query: FirebaseFirestore.Query = db.collection('users');
  if (scopeStructureId) {
    query = query.where('structureId', '==', scopeStructureId);
  }
  query = query.limit(batchLimit);

  const snap = await query.get();
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  let writer = db.batch();
  let ops = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    try {
      const hasEncryptedNames =
        isEnc(data.firstName) || isEnc(data.lastName) || isEnc(data.displayName);
      const hasPlainDisplay =
        (typeof data.displayFirstName === 'string' &&
          data.displayFirstName &&
          !isEnc(data.displayFirstName)) ||
        (typeof data.displayLastName === 'string' &&
          data.displayLastName &&
          !isEnc(data.displayLastName));
      const displayNameOk =
        typeof data.displayName === 'string' &&
        data.displayName.trim() !== '' &&
        !isEnc(data.displayName);

      if (hasPlainDisplay && displayNameOk) {
        skipped++;
        continue;
      }

      if (!hasEncryptedNames && !data.firstName && !data.lastName && !data.displayName) {
        skipped++;
        continue;
      }

      const firstName = await decryptIfNeeded(data.firstName);
      const lastName = await decryptIfNeeded(data.lastName);
      let displayName = await decryptIfNeeded(data.displayName);
      if (!displayName) {
        displayName = `${firstName} ${lastName}`.trim();
      }

      if (!firstName && !lastName && !displayName) {
        skipped++;
        continue;
      }

      const patch: Record<string, string> = {};
      if (firstName) patch.displayFirstName = firstName;
      if (lastName) patch.displayLastName = lastName;
      if (displayName) patch.displayName = displayName;

      if (Object.keys(patch).length === 0) {
        skipped++;
        continue;
      }

      if (!dryRun) {
        writer.update(doc.ref, patch);
        ops++;
      }
      updated++;

      if (ops >= 400) {
        await writer.commit();
        writer = db.batch();
        ops = 0;
      }
    } catch (e) {
      console.error(`[backfillDisplayFields] ${doc.id}:`, e);
      errors++;
    }
  }

  if (!dryRun && ops > 0) {
    await writer.commit();
  }

  return {
    success: true,
    dryRun,
    scanned: snap.size,
    updated,
    skipped,
    errors,
    structureId: scopeStructureId || null,
  };
});
