/**
 * Cloud Functions pour le chiffrement/déchiffrement des données sensibles
 */

import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { 
  encrypt, 
  decrypt, 
  encryptSensitiveFields, 
  decryptSensitiveFields,
  SENSITIVE_FIELDS 
} from './encryption';
import { verifyTwoFactorCodeForAccess } from './twoFactor';
import { logEncryptedDataAccess } from './accessLogging';

const functionConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 300,
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 1, // Réduit au minimum pour respecter le quota CPU
  concurrency: 20, // Réduit au minimum
  allowUnauthenticated: false,
  secrets: ['ENCRYPTION_KEY'],
};

/**
 * Chiffre les champs sensibles d'un document utilisateur avant stockage
 * Cette fonction est appelée avant l'écriture dans Firestore
 */
export const encryptUserData = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  try {
    const { userId, userData } = request.data;

    // Vérifier que l'utilisateur peut modifier ces données
    if (userId !== request.auth.uid) {
      // Vérifier si c'est un admin de la structure
      const userDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
      const user = userDoc.data();
      
      if (user?.status !== 'superadmin' && 
          (user?.status !== 'admin' || user?.structureId !== userData?.structureId)) {
        throw new Error('Non autorisé à modifier ces données');
      }
    }

    // Chiffrer les champs sensibles
    const encrypted = await encryptSensitiveFields(userData, SENSITIVE_FIELDS.USER);
    
    return { success: true, encryptedData: encrypted };
  } catch (error: any) {
    console.error('Erreur lors du chiffrement des données utilisateur:', error);
    throw new Error(error.message || 'Erreur lors du chiffrement des données');
  }
});

/**
 * Déchiffre les champs sensibles d'un document utilisateur
 * Nécessite une validation 2FA pour accéder aux données cryptées
 */
export const decryptUserData = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  try {
    const { userId, twoFactorCode } = request.data;
    const requestingUserId = request.auth.uid;

    // Récupérer le document utilisateur
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      throw new Error('Utilisateur non trouvé');
    }

    const userData = userDoc.data();

    // Vérifier les permissions
    if (userId !== requestingUserId) {
      const currentUserDoc = await admin.firestore().collection('users').doc(requestingUserId).get();
      const currentUser = currentUserDoc.data();
      
      if (currentUser?.status !== 'superadmin' && 
          (currentUser?.status !== 'admin' || currentUser?.structureId !== userData?.structureId)) {
        throw new Error('Non autorisé à accéder à ces données');
      }
    }

    // Vérifier que l'utilisateur qui demande le déchiffrement a la 2FA activée
    const requestingUserDoc = await admin.firestore().collection('users').doc(requestingUserId).get();
    const requestingUser = requestingUserDoc.data();

    if (!requestingUser?.twoFactorEnabled) {
      throw new Error('Vous devez activer l\'authentification à deux facteurs (2FA) pour accéder aux données cryptées');
    }

    // Vérifier si l'appareil actuel est sécurisé (trusted device)
    let isDeviceSecure = false;
    const { deviceId } = request.data;
    
    if (deviceId && requestingUser?.secureDevices) {
      // Vérifier si l'appareil est dans la liste des appareils sécurisés
      isDeviceSecure = requestingUser.secureDevices.some((device: any) => device.deviceId === deviceId);
    }

    // Si l'appareil n'est pas sécurisé, demander le code 2FA
    if (!isDeviceSecure) {
      // Vérifier le code 2FA
      if (!twoFactorCode || typeof twoFactorCode !== 'string' || twoFactorCode.length !== 6) {
        throw new Error('Validation 2FA requise pour accéder aux données cryptées. Veuillez fournir un code 2FA valide.');
      }

      const twoFactorVerified = await verifyTwoFactorCodeForAccess(requestingUserId, twoFactorCode);
      
      if (!twoFactorVerified) {
        throw new Error('Code 2FA invalide. Veuillez réessayer.');
      }
    }

    // Log pour debug birthDate
    if (userData?.birthDate) {
      console.log(`[decryptUserData] birthDate avant déchiffrement - Type: ${typeof userData.birthDate}, Valeur: ${userData.birthDate}`);
    }

    // Déchiffrer les champs sensibles
    const decrypted = await decryptSensitiveFields(userData!, SENSITIVE_FIELDS.USER);
    
    // Log pour debug birthDate après déchiffrement
    if (decrypted?.birthDate) {
      console.log(`[decryptUserData] birthDate après déchiffrement - Type: ${typeof decrypted.birthDate}, Valeur: ${decrypted.birthDate}`);
    }

    // Logger l'accès aux données cryptées
    await logEncryptedDataAccess(
      requestingUserId,
      'decrypt_user',
      userId,
      true,
      {
        ip: request.rawRequest?.ip,
        userAgent: request.rawRequest?.headers?.['user-agent']
      }
    );
    
    return { success: true, decryptedData: decrypted };
  } catch (error: any) {
    console.error('Erreur lors du déchiffrement des données utilisateur:', error);
    
    // Logger l'échec d'accès si c'est une erreur de 2FA
    if (error.message?.includes('2FA') || error.message?.includes('code')) {
      try {
        await logEncryptedDataAccess(
          request.auth?.uid || 'unknown',
          'decrypt_user',
          request.data?.userId || 'unknown',
          false,
          {
            ip: request.rawRequest?.ip,
            userAgent: request.rawRequest?.headers?.['user-agent']
          }
        );
      } catch (logError) {
        // Ignorer les erreurs de logging
      }
    }
    
    throw new Error(error.message || 'Erreur lors du déchiffrement des données');
  }
});

/**
 * Déchiffre les données de l'utilisateur pour lui-même (sans 2FA)
 * Permet aux utilisateurs de voir leurs propres données sans authentification 2FA
 * Utilisé uniquement pour l'affichage dans leur profil
 */
export const decryptOwnUserData = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  try {
    const requestingUserId = request.auth.uid;
    
    // Récupérer le document utilisateur
    const userDoc = await admin.firestore().collection('users').doc(requestingUserId).get();
    
    if (!userDoc.exists) {
      throw new Error('Utilisateur non trouvé');
    }

    const userData = userDoc.data();

    // Déchiffrer les champs sensibles
    const decrypted = await decryptSensitiveFields(userData!, SENSITIVE_FIELDS.USER);
    
    return { success: true, decryptedData: decrypted };
  } catch (error: any) {
    console.error('Erreur lors du déchiffrement des propres données utilisateur:', error);
    throw new Error(error.message || 'Erreur lors du déchiffrement des données');
  }
});

/**
 * Chiffre les champs sensibles d'une entreprise
 */
export const encryptCompanyData = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  try {
    const { companyData } = request.data;

    // Chiffrer les champs sensibles
    const encrypted = await encryptSensitiveFields(companyData, SENSITIVE_FIELDS.COMPANY);
    
    return { success: true, encryptedData: encrypted };
  } catch (error: any) {
    console.error('Erreur lors du chiffrement des données entreprise:', error);
    throw new Error(error.message || 'Erreur lors du chiffrement des données');
  }
});

/**
 * Déchiffre les champs sensibles d'une entreprise
 * Nécessite une validation 2FA pour accéder aux données cryptées
 */
export const decryptCompanyData = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  try {
    const { companyId, twoFactorCode } = request.data;
    const requestingUserId = request.auth.uid;

    const companyDoc = await admin.firestore().collection('companies').doc(companyId).get();
    
    if (!companyDoc.exists) {
      throw new Error('Entreprise non trouvée');
    }

    // Vérifier que l'utilisateur a la 2FA activée
    const requestingUserDoc = await admin.firestore().collection('users').doc(requestingUserId).get();
    const requestingUser = requestingUserDoc.data();

    if (!requestingUser?.twoFactorEnabled) {
      throw new Error('Vous devez activer l\'authentification à deux facteurs (2FA) pour accéder aux données cryptées');
    }

    // Vérifier le code 2FA
    if (!twoFactorCode || typeof twoFactorCode !== 'string' || twoFactorCode.length !== 6) {
      throw new Error('Validation 2FA requise pour accéder aux données cryptées. Veuillez fournir un code 2FA valide.');
    }

    const twoFactorVerified = await verifyTwoFactorCodeForAccess(requestingUserId, twoFactorCode);
    
    if (!twoFactorVerified) {
      throw new Error('Code 2FA invalide. Veuillez réessayer.');
    }

    const companyData = companyDoc.data();
    const decrypted = await decryptSensitiveFields(companyData!, SENSITIVE_FIELDS.COMPANY);

    // Logger l'accès aux données cryptées
    await logEncryptedDataAccess(
      requestingUserId,
      'decrypt_company',
      companyId,
      true,
      {
        ip: request.rawRequest?.ip,
        userAgent: request.rawRequest?.headers?.['user-agent']
      }
    );
    
    return { success: true, decryptedData: decrypted };
  } catch (error: any) {
    console.error('Erreur lors du déchiffrement des données entreprise:', error);
    
    // Logger l'échec d'accès si c'est une erreur de 2FA
    if (error.message?.includes('2FA') || error.message?.includes('code')) {
      try {
        await logEncryptedDataAccess(
          request.auth?.uid || 'unknown',
          'decrypt_company',
          request.data?.companyId || 'unknown',
          false,
          {
            ip: request.rawRequest?.ip,
            userAgent: request.rawRequest?.headers?.['user-agent']
          }
        );
      } catch (logError) {
        // Ignorer les erreurs de logging
      }
    }
    
    throw new Error(error.message || 'Erreur lors du déchiffrement des données');
  }
});

/**
 * Chiffre les champs sensibles d'un contact
 */
export const encryptContactData = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  try {
    const { contactData } = request.data;
    const encrypted = await encryptSensitiveFields(contactData, SENSITIVE_FIELDS.CONTACT);
    
    return { success: true, encryptedData: encrypted };
  } catch (error: any) {
    console.error('Erreur lors du chiffrement des données contact:', error);
    throw new Error(error.message || 'Erreur lors du chiffrement des données');
  }
});

/**
 * Déchiffre les champs sensibles d'un contact
 * Nécessite une validation 2FA pour accéder aux données cryptées
 */
export const decryptContactData = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  try {
    const { contactId, twoFactorCode } = request.data;
    const requestingUserId = request.auth.uid;

    const contactDoc = await admin.firestore().collection('contacts').doc(contactId).get();
    
    if (!contactDoc.exists) {
      throw new Error('Contact non trouvé');
    }

    // Vérifier que l'utilisateur a la 2FA activée
    const requestingUserDoc = await admin.firestore().collection('users').doc(requestingUserId).get();
    const requestingUser = requestingUserDoc.data();

    if (!requestingUser?.twoFactorEnabled) {
      throw new Error('Vous devez activer l\'authentification à deux facteurs (2FA) pour accéder aux données cryptées');
    }

    // Vérifier le code 2FA
    if (!twoFactorCode || typeof twoFactorCode !== 'string' || twoFactorCode.length !== 6) {
      throw new Error('Validation 2FA requise pour accéder aux données cryptées. Veuillez fournir un code 2FA valide.');
    }

    const twoFactorVerified = await verifyTwoFactorCodeForAccess(requestingUserId, twoFactorCode);
    
    if (!twoFactorVerified) {
      throw new Error('Code 2FA invalide. Veuillez réessayer.');
    }

    const contactData = contactDoc.data();
    const decrypted = await decryptSensitiveFields(contactData!, SENSITIVE_FIELDS.CONTACT);

    // Logger l'accès aux données cryptées
    await logEncryptedDataAccess(
      requestingUserId,
      'decrypt_contact',
      contactId,
      true,
      {
        ip: request.rawRequest?.ip,
        userAgent: request.rawRequest?.headers?.['user-agent']
      }
    );
    
    return { success: true, decryptedData: decrypted };
  } catch (error: any) {
    console.error('Erreur lors du déchiffrement des données contact:', error);
    
    // Logger l'échec d'accès si c'est une erreur de 2FA
    if (error.message?.includes('2FA') || error.message?.includes('code')) {
      try {
        await logEncryptedDataAccess(
          request.auth?.uid || 'unknown',
          'decrypt_contact',
          request.data?.contactId || 'unknown',
          false,
          {
            ip: request.rawRequest?.ip,
            userAgent: request.rawRequest?.headers?.['user-agent']
          }
        );
      } catch (logError) {
        // Ignorer les erreurs de logging
      }
    }
    
    throw new Error(error.message || 'Erreur lors du déchiffrement des données');
  }
});

/**
 * Chiffre un texte arbitraire (pour les cas spéciaux)
 */
export const encryptText = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  try {
    const { text } = request.data;
    
    if (!text || typeof text !== 'string') {
      throw new Error('Texte invalide');
    }

    const encrypted = await encrypt(text);
    
    return { success: true, encrypted };
  } catch (error: any) {
    console.error('Erreur lors du chiffrement du texte:', error);
    throw new Error(error.message || 'Erreur lors du chiffrement');
  }
});

// Configuration avec moins d'instances pour économiser le quota CPU
const lowResourceConfig = {
  ...functionConfig,
  maxInstances: 1,
  concurrency: 20,
};

/**
 * Déchiffre un texte arbitraire
 */
export const decryptText = onCall(lowResourceConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  try {
    const { encryptedText } = request.data;
    
    if (!encryptedText || typeof encryptedText !== 'string') {
      throw new Error('Texte chiffré invalide');
    }

    const decrypted = await decrypt(encryptedText);
    
    return { success: true, decrypted };
  } catch (error: any) {
    console.error('Erreur lors du déchiffrement du texte:', error);
    throw new Error(error.message || 'Erreur lors du déchiffrement');
  }
});
