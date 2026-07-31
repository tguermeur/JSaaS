/**
 * Service de chiffrement pour les données sensibles
 * Utilise AES-256-GCM pour le chiffrement symétrique
 * La clé de chiffrement est stockée dans Firebase Secrets Manager
 */

import * as crypto from 'crypto';

// Algorithmes de chiffrement
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes pour AES
const KEY_LENGTH = 32; // 32 bytes (256 bits) pour AES-256

// Cache de la clé de chiffrement (évite de la récupérer à chaque fois)
let encryptionKeyCache: Buffer | null = null;

/**
 * Liste des champs sensibles à chiffrer automatiquement
 */
export const SENSITIVE_FIELDS = {
  // Données utilisateur
  USER: [
    'socialSecurityNumber', // Numéro de sécurité sociale
    'siret', // SIRET (pour entreprises dans users)
    'tvaIntra', // TVA Intracommunautaire
    'phone', // Téléphone
    'address', // Adresse
    'postalCode', // Code postal
    'birthPlace', // Lieu de naissance
    'birthDate', // Date de naissance
    'birthPostalCode', // Code postal de naissance
    'studentId', // Numéro étudiant
    'twoFactorSecret', // Secret 2FA (déjà sensible, double protection)
    'firstName', // Prénom
    'lastName', // Nom
    'displayName', // Nom affiché
    // 'email' exclu : utilisé pour requêtes Firestore (where email == ...)
    'ecole', // École (étudiants)
    'graduationYear', // Année de diplôme
    'program', // Programme (étudiants)
    'companyName', // Nom entreprise (users entreprise)
  ],
  // Données entreprises
  COMPANY: [
    'siret',
    'nSiret',
    'tvaIntra',
    'address',
    'phone',
    'companyAddress',
  ],
  // Données structures
  STRUCTURE: [
    'siret',
    'address',
    'phone',
  ],
  // Données contacts
  CONTACT: [
    'phone',
    'email', // Email peut être sensible selon le contexte
  ],
  // Données prospects
  PROSPECT: [
    'phone',
    'telephone',
    'email',
    'adresse',
  ],
} as const;

/**
 * Récupère la clé de chiffrement depuis Firebase Secrets
 * Utilise un cache pour éviter de récupérer la clé à chaque fois
 */
async function getEncryptionKey(): Promise<Buffer> {
  if (encryptionKeyCache) {
    return encryptionKeyCache;
  }

  try {
    // Récupérer la clé depuis les variables d'environnement (Firebase Secrets)
    const keyHex = process.env.ENCRYPTION_KEY;
    
    if (!keyHex) {
      throw new Error('ENCRYPTION_KEY secret non défini. Configurez-le dans Firebase Secrets Manager.');
    }

    // La clé doit être en hexadécimal (64 caractères pour 32 bytes)
    if (keyHex.length !== 64) {
      throw new Error('ENCRYPTION_KEY doit faire exactement 64 caractères hexadécimaux (32 bytes)');
    }

    encryptionKeyCache = Buffer.from(keyHex, 'hex');
    return encryptionKeyCache;
  } catch (error) {
    console.error('Erreur lors de la récupération de la clé de chiffrement:', error);
    throw new Error('Impossible de récupérer la clé de chiffrement');
  }
}

/**
 * Génère une clé de chiffrement sécurisée
 * À utiliser une seule fois pour générer la clé initiale
 * 
 * Usage: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Indique si une valeur est un ciphertext connu (legacy ENC: ou tenant ENC2:).
 */
export function isEncryptedValue(value: unknown): boolean {
  return typeof value === 'string' && (value.startsWith('ENC:') || value.startsWith('ENC2:'));
}

function isPlaintextString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && !isEncryptedValue(value);
}

/**
 * Copie prénom/nom en clair vers display* (jamais chiffrés) avant chiffrement des champs sensibles.
 */
export function populateUserDisplayFields<T extends Record<string, any>>(data: T): T {
  if (!data || typeof data !== 'object') return data;

  const out: Record<string, any> = { ...data };
  const first = isPlaintextString(out.firstName)
    ? out.firstName.trim()
    : isPlaintextString(out.displayFirstName)
      ? out.displayFirstName.trim()
      : '';
  const last = isPlaintextString(out.lastName)
    ? out.lastName.trim()
    : isPlaintextString(out.displayLastName)
      ? out.displayLastName.trim()
      : '';
  const display = isPlaintextString(out.displayName)
    ? out.displayName.trim()
    : `${first} ${last}`.trim();

  if (first) out.displayFirstName = first;
  if (last) out.displayLastName = last;
  if (display) out.displayName = display;

  return out as T;
}

/**
 * Chiffre un texte en utilisant AES-256-GCM
 * @param text - Texte à chiffrer
 * @param structureId - Si fourni, utilise une clé dérivée par tenant (ENC2:)
 * @returns Texte chiffré (ENC: legacy ou ENC2: tenant)
 */
export async function encrypt(text: string, structureId?: string): Promise<string> {
  if (!text || text.trim() === '') {
    return text; // Ne pas chiffrer les chaînes vides
  }

  if (structureId) {
    const { encryptWithTenantKey } = await import('./tenantCrypto');
    return encryptWithTenantKey(text, structureId);
  }

  try {
    const key = await getEncryptionKey();
    
    // Générer un IV aléatoire pour chaque chiffrement
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Créer le cipher avec GCM (authenticated encryption)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Chiffrer le texte
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Récupérer le tag d'authentification
    const tag = cipher.getAuthTag();
    
    // Retourner: IV (32 chars hex) + Tag (32 chars hex) + Encrypted
    // Format: {iv}{tag}{encrypted}
    const result = iv.toString('hex') + tag.toString('hex') + encrypted;
    
    // Ajouter un préfixe pour identifier les données chiffrées
    return `ENC:${result}`;
  } catch (error) {
    console.error('Erreur lors du chiffrement:', error);
    throw new Error('Erreur lors du chiffrement des données');
  }
}

/**
 * Déchiffre un texte chiffré avec AES-256-GCM
 * Gère ENC2: (tenant) puis ENC: (clé globale legacy).
 * @param encryptedText - Texte chiffré
 * @param structureId - Requis pour ENC2: si non embarqué / pour dériver la clé
 * @returns Texte déchiffré
 */
export async function decrypt(encryptedText: string, structureId?: string): Promise<string> {
  if (!encryptedText || typeof encryptedText !== 'string') {
    return encryptedText;
  }

  if (encryptedText.startsWith('ENC2:')) {
    const { decryptWithTenantKey } = await import('./tenantCrypto');
    return decryptWithTenantKey(encryptedText, structureId);
  }

  if (!encryptedText.startsWith('ENC:')) {
    return encryptedText; // Pas chiffré, retourner tel quel
  }

  try {
    const key = await getEncryptionKey();
    
    // Enlever le préfixe ENC:
    const data = encryptedText.substring(4);
    
    // Extraire IV (32 premiers caractères hex = 16 bytes)
    const ivHex = data.substring(0, 32);
    const iv = Buffer.from(ivHex, 'hex');
    
    // Extraire le tag (32 caractères suivants hex = 16 bytes)
    const tagHex = data.substring(32, 64);
    const tag = Buffer.from(tagHex, 'hex');
    
    // Extraire le texte chiffré (reste)
    const encrypted = data.substring(64);
    
    // Créer le decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    // Déchiffrer
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    // Fallback : tenter clé tenant si structureId fourni (migration partielle)
    if (structureId) {
      try {
        const { decryptWithTenantKey } = await import('./tenantCrypto');
        return await decryptWithTenantKey(encryptedText, structureId);
      } catch {
        // ignorer et rethrow l'erreur legacy
      }
    }
    console.error('Erreur lors du déchiffrement:', error);
    throw new Error('Erreur lors du déchiffrement des données. La clé est peut-être incorrecte ou les données sont corrompues.');
  }
}

/**
 * Chiffre un objet en chiffrant uniquement les champs sensibles
 * @param data - Objet à chiffrer
 * @param sensitiveFields - Liste des champs à chiffrer
 * @returns Objet avec les champs sensibles chiffrés
 */
export async function encryptSensitiveFields<T extends Record<string, any>>(
  data: T,
  sensitiveFields: readonly string[],
  options?: { structureId?: string }
): Promise<T> {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const isUserFields =
    sensitiveFields.includes('firstName') ||
    sensitiveFields.includes('lastName') ||
    sensitiveFields.includes('displayName');

  // display* en clair avant chiffrement des noms (listes UI sans CF)
  let encrypted: Record<string, any> = isUserFields
    ? populateUserDisplayFields({ ...data })
    : { ...data };

  // Ne jamais chiffrer les champs d'affichage
  const plainDisplayName = isPlaintextString(encrypted.displayName)
    ? encrypted.displayName
    : undefined;
  const plainDisplayFirst = isPlaintextString(encrypted.displayFirstName)
    ? encrypted.displayFirstName
    : undefined;
  const plainDisplayLast = isPlaintextString(encrypted.displayLastName)
    ? encrypted.displayLastName
    : undefined;

  // Clé tenant uniquement si explicitement demandée (pas auto depuis data.structureId)
  const structureId = options?.structureId;

  for (const field of sensitiveFields) {
    if (field in encrypted && encrypted[field] !== null && encrypted[field] !== undefined) {
      let value = encrypted[field];
      
      // Convertir les dates/Timestamps en string ISO si nécessaire
      if (field === 'birthDate' && (value instanceof Date || (value && typeof value.toDate === 'function'))) {
        // Si c'est un Timestamp Firestore, convertir en Date puis en string locale YYYY-MM-DD (sans fuseau)
        const dateObj: Date =
          value && typeof value.toDate === 'function'
            ? value.toDate()
            : (value as Date);

        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        value = `${year}-${month}-${day}`; // Format YYYY-MM-DD
      }
      
      // Ne chiffrer que les chaînes non vides et non déjà chiffrées
      // displayName reste en clair (mirror UI) — firstName/lastName restent chiffrés
      if (field === 'displayName') {
        continue;
      }
      if (typeof value === 'string' && value.trim() !== '' && !isEncryptedValue(value)) {
        try {
          encrypted[field] = await encrypt(value, structureId);
        } catch (error) {
          console.error(`Erreur lors du chiffrement du champ ${field}:`, error);
          // En cas d'erreur, ne pas chiffrer (mieux que de perdre les données)
        }
      }
    }
  }

  // Garantir display* non chiffrés après boucle
  if (plainDisplayFirst) encrypted.displayFirstName = plainDisplayFirst;
  if (plainDisplayLast) encrypted.displayLastName = plainDisplayLast;
  if (plainDisplayName) encrypted.displayName = plainDisplayName;

  return encrypted as T;
}

/**
 * Après chiffrement des noms : conserve des copies plaintext pour l'affichage listes
 * (displayFirstName / displayLastName / displayName). Ne jamais y mettre le NIR.
 */
export function applyUserDisplayFields<T extends Record<string, any>>(data: T): T {
  if (!data || typeof data !== 'object') return data;

  const isEnc = (v: unknown): boolean => isEncryptedValue(v);

  const plainOr = (primary: unknown, fallback?: unknown): string => {
    if (typeof primary === 'string' && primary.trim() !== '' && !isEnc(primary)) {
      return primary.trim();
    }
    if (typeof fallback === 'string' && fallback.trim() !== '' && !isEnc(fallback)) {
      return fallback.trim();
    }
    return '';
  };

  const firstName = plainOr(data.firstName, data.displayFirstName);
  const lastName = plainOr(data.lastName, data.displayLastName);
  const displayName = plainOr(data.displayName) || `${firstName} ${lastName}`.trim();

  const out: Record<string, any> = { ...data };
  if (firstName) out.displayFirstName = firstName;
  if (lastName) out.displayLastName = lastName;
  if (displayName) out.displayName = displayName;
  return out as T;
}

/**
 * Chiffre les champs sensibles user puis ré-applique les display* en clair.
 */
export async function encryptUserFieldsWithDisplay<T extends Record<string, any>>(
  data: T
): Promise<T> {
  const firstName =
    typeof data.firstName === 'string' && !isEncryptedValue(data.firstName)
      ? data.firstName.trim()
      : typeof data.displayFirstName === 'string' && !isEncryptedValue(data.displayFirstName)
        ? data.displayFirstName.trim()
        : '';
  const lastName =
    typeof data.lastName === 'string' && !isEncryptedValue(data.lastName)
      ? data.lastName.trim()
      : typeof data.displayLastName === 'string' && !isEncryptedValue(data.displayLastName)
        ? data.displayLastName.trim()
        : '';
  const displayName =
    typeof data.displayName === 'string' && !isEncryptedValue(data.displayName)
      ? data.displayName.trim()
      : `${firstName} ${lastName}`.trim();

  const encrypted = await encryptSensitiveFields(data, [...SENSITIVE_FIELDS.USER]);
  const withDisplay = { ...encrypted } as Record<string, any>;
  if (firstName) withDisplay.displayFirstName = firstName;
  if (lastName) withDisplay.displayLastName = lastName;
  if (displayName) withDisplay.displayName = displayName;
  return withDisplay as T;
}

/**
 * Déchiffre un objet en déchiffrant uniquement les champs sensibles
 * @param data - Objet à déchiffrer
 * @param sensitiveFields - Liste des champs à déchiffrer
 * @returns Objet avec les champs sensibles déchiffrés
 */
export async function decryptSensitiveFields<T extends Record<string, any>>(
  data: T,
  sensitiveFields: readonly string[]
): Promise<T> {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const decrypted: Record<string, any> = { ...data };

  for (const field of sensitiveFields) {
    if (field in decrypted && decrypted[field] !== null && decrypted[field] !== undefined) {
      const value = decrypted[field];
      
      // Pour birthDate, ajouter des logs de debug
      if (field === 'birthDate') {
        console.log(`[Decrypt] birthDate trouvée - Type: ${typeof value}, Valeur: ${value}, Commence par ENC: ${typeof value === 'string' && value.startsWith('ENC:')}`);
      }
      
      // Déchiffrer ENC: / ENC2:
      if (typeof value === 'string' && isEncryptedValue(value)) {
        try {
          const structureId =
            typeof decrypted.structureId === 'string' ? decrypted.structureId : undefined;
          const decryptedValue = await decrypt(value, structureId);
          decrypted[field] = decryptedValue;
          
          // Log pour birthDate
          if (field === 'birthDate') {
            console.log(`[Decrypt] birthDate déchiffrée: ${decryptedValue}`);
          }
        } catch (error) {
          console.error(`Erreur lors du déchiffrement du champ ${field}:`, error);
          // En cas d'erreur, garder la valeur chiffrée (mieux que de perdre les données)
        }
      } else if (field === 'birthDate' && typeof value === 'string' && !isEncryptedValue(value)) {
        // Si birthDate existe mais n'est pas chiffrée, log pour debug
        console.log(`[Decrypt] birthDate non chiffrée trouvée: ${value}`);
      }
    }
  }

  return decrypted as T;
}

/**
 * Chiffre un buffer (pour les fichiers)
 * @param buffer - Buffer à chiffrer
 * @returns Objet avec le buffer chiffré, IV et tag
 */
export async function encryptBuffer(buffer: Buffer): Promise<{ encrypted: Buffer; iv: Buffer; tag: Buffer }> {
  try {
    const key = await getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const tag = cipher.getAuthTag();
    
    return { encrypted, iv, tag };
  } catch (error) {
    console.error('Erreur lors du chiffrement du buffer:', error);
    throw new Error('Erreur lors du chiffrement du fichier');
  }
}

/**
 * Déchiffre un buffer
 * @param encryptedBuffer - Buffer chiffré
 * @param iv - IV utilisé pour le chiffrement
 * @param tag - Tag d'authentification
 * @returns Buffer déchiffré
 */
export async function decryptBuffer(
  encryptedBuffer: Buffer,
  iv: Buffer,
  tag: Buffer
): Promise<Buffer> {
  try {
    const key = await getEncryptionKey();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  } catch (error) {
    console.error('Erreur lors du déchiffrement du buffer:', error);
    throw new Error('Erreur lors du déchiffrement du fichier. La clé est peut-être incorrecte ou les données sont corrompues.');
  }
}

/**
 * Formate les métadonnées de chiffrement pour le stockage
 * Les IV et tags sont stockés séparément dans les métadonnées du fichier
 */
export interface EncryptionMetadata {
  iv: string; // IV en hex
  tag: string; // Tag en hex
  algorithm: string;
  encrypted: boolean;
}

/**
 * Convertit les métadonnées de chiffrement en objet pour Firebase Storage
 */
export function formatEncryptionMetadata(metadata: EncryptionMetadata): Record<string, string> {
  return {
    'x-encryption-iv': metadata.iv,
    'x-encryption-tag': metadata.tag,
    'x-encryption-algorithm': metadata.algorithm,
    'x-encrypted': 'true',
  };
}

/**
 * Récupère les métadonnées de chiffrement depuis Firebase Storage
 */
export function parseEncryptionMetadata(metadata: Record<string, string>): EncryptionMetadata | null {
  if (!metadata['x-encrypted'] || metadata['x-encrypted'] !== 'true') {
    return null;
  }

  return {
    iv: metadata['x-encryption-iv'],
    tag: metadata['x-encryption-tag'],
    algorithm: metadata['x-encryption-algorithm'] || ALGORITHM,
    encrypted: true,
  };
}
