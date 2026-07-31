/**
 * Chiffrement par tenant (clé dérivée HKDF-SHA256 depuis ENCRYPTION_KEY + structureId).
 * Format ciphertext : ENC2:v1:{structureIdHash}:{iv}{tag}{data} (hex)
 * Rétrocompat : le decrypt legacy ENC: reste dans encryption.ts
 */

import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const HKDF_INFO_PREFIX = 'jsaas-tenant-crypto-v1:';
const KEY_VERSION = 'v1';

function getMasterKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY secret non défini.');
  }
  if (keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY doit faire exactement 64 caractères hexadécimaux (32 bytes)');
  }
  return Buffer.from(keyHex, 'hex');
}

/** Hash court du structureId (16 hex) pour audit / routing sans exposer l'id brut. */
export function hashStructureId(structureId: string): string {
  return crypto.createHash('sha256').update(structureId, 'utf8').digest('hex').slice(0, 16);
}

/**
 * Dérive une clé AES-256 par tenant via HKDF-SHA256.
 */
export function deriveTenantKey(structureId: string): Buffer {
  if (!structureId || typeof structureId !== 'string') {
    throw new Error('structureId requis pour dériver la clé tenant');
  }
  const master = getMasterKey();
  const info = Buffer.from(`${HKDF_INFO_PREFIX}${structureId}`, 'utf8');
  // Node 16+ : hkdfSync(digest, ikm, salt, info, keylen)
  return Buffer.from(
    crypto.hkdfSync('sha256', master, Buffer.alloc(0), info, KEY_LENGTH)
  );
}

/**
 * Chiffre avec clé tenant. Format: ENC2:v1:{structureIdHash}:{ivHex}{tagHex}{ciphertextHex}
 */
export async function encryptWithTenantKey(
  text: string,
  structureId: string
): Promise<string> {
  if (!text || text.trim() === '') return text;

  const key = deriveTenantKey(structureId);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  const payload = iv.toString('hex') + tag.toString('hex') + encrypted;
  const sidHash = hashStructureId(structureId);
  return `ENC2:${KEY_VERSION}:${sidHash}:${payload}`;
}

/**
 * Déchiffre ENC2:... avec clé tenant.
 * structureId requis (doit correspondre au hash embarqué).
 */
export async function decryptWithTenantKey(
  encryptedText: string,
  structureId?: string
): Promise<string> {
  if (!encryptedText || typeof encryptedText !== 'string') {
    return encryptedText;
  }

  // Compat : si on reçoit encore ENC: ici, laisser l'appelant gérer
  if (encryptedText.startsWith('ENC:') && !encryptedText.startsWith('ENC2:')) {
    throw new Error('decryptWithTenantKey: ciphertext legacy ENC: — utiliser decrypt()');
  }

  if (!encryptedText.startsWith('ENC2:')) {
    return encryptedText;
  }

  if (!structureId) {
    throw new Error('structureId requis pour déchiffrer ENC2:');
  }

  // ENC2:v1:{hash}:{payload}
  const parts = encryptedText.split(':');
  if (parts.length < 4) {
    throw new Error('Format ENC2: invalide');
  }
  const version = parts[1];
  const sidHash = parts[2];
  const payload = parts.slice(3).join(':');

  if (version !== KEY_VERSION) {
    throw new Error(`Version de clé tenant non supportée: ${version}`);
  }

  const expectedHash = hashStructureId(structureId);
  if (sidHash !== expectedHash) {
    throw new Error('structureId ne correspond pas au hash du ciphertext ENC2');
  }

  const key = deriveTenantKey(structureId);
  const iv = Buffer.from(payload.substring(0, 32), 'hex');
  const tag = Buffer.from(payload.substring(32, 64), 'hex');
  const encrypted = payload.substring(64);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
