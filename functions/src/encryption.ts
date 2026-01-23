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
    'studentId', // Numéro étudiant
    'twoFactorSecret', // Secret 2FA (déjà sensible, double protection)
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
 * Chiffre un texte en utilisant AES-256-GCM
 * @param text - Texte à chiffrer
 * @returns Objet avec le texte chiffré, IV et tag
 */
export async function encrypt(text: string): Promise<string> {
  if (!text || text.trim() === '') {
    return text; // Ne pas chiffrer les chaînes vides
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
 * @param encryptedText - Texte chiffré (format: ENC:{iv}{tag}{encrypted})
 * @returns Texte déchiffré
 */
export async function decrypt(encryptedText: string): Promise<string> {
  if (!encryptedText || !encryptedText.startsWith('ENC:')) {
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
  sensitiveFields: readonly string[]
): Promise<T> {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const encrypted: Record<string, any> = { ...data };

  for (const field of sensitiveFields) {
    if (field in encrypted && encrypted[field] !== null && encrypted[field] !== undefined) {
      let value = encrypted[field];
      
      // Convertir les dates/Timestamps en string ISO si nécessaire
      if (field === 'birthDate' && (value instanceof Date || (value && typeof value.toDate === 'function'))) {
        // Si c'est un Timestamp Firestore, convertir en Date puis en ISO string
        if (value && typeof value.toDate === 'function') {
          value = value.toDate().toISOString().split('T')[0]; // Format YYYY-MM-DD
        } else if (value instanceof Date) {
          value = value.toISOString().split('T')[0]; // Format YYYY-MM-DD
        }
      }
      
      // Ne chiffrer que les chaînes non vides et non déjà chiffrées
      if (typeof value === 'string' && value.trim() !== '' && !value.startsWith('ENC:')) {
        try {
          encrypted[field] = await encrypt(value);
        } catch (error) {
          console.error(`Erreur lors du chiffrement du champ ${field}:`, error);
          // En cas d'erreur, ne pas chiffrer (mieux que de perdre les données)
        }
      }
    }
  }

  return encrypted as T;
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
      
      // Déchiffrer uniquement les chaînes qui commencent par ENC:
      if (typeof value === 'string' && value.startsWith('ENC:')) {
        try {
          const decryptedValue = await decrypt(value);
          decrypted[field] = decryptedValue;
          
          // Log pour birthDate
          if (field === 'birthDate') {
            console.log(`[Decrypt] birthDate déchiffrée: ${decryptedValue}`);
          }
        } catch (error) {
          console.error(`Erreur lors du déchiffrement du champ ${field}:`, error);
          // En cas d'erreur, garder la valeur chiffrée (mieux que de perdre les données)
        }
      } else if (field === 'birthDate' && typeof value === 'string' && !value.startsWith('ENC:')) {
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
