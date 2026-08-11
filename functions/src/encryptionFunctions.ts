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
  encryptUserFieldsWithDisplay,
  SENSITIVE_FIELDS 
} from './encryption';
import { verifyTwoFactorCodeForAccess } from './twoFactor';
import { logEncryptedDataAccess } from './accessLogging';
import { userHasRHReadAccess } from './authHelpers';

/** Config lecture/écriture encrypt — concurrency élevée pour listes UI. */
const functionConfig = {
  memory: '256MiB' as const,
  cpu: 1 as const,
  timeoutSeconds: 300,
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 20,
  concurrency: 40,
  allowUnauthenticated: false,
  cors: true,
  secrets: ['ENCRYPTION_KEY'],
};

/** Decrypt chauds : 1 instance tiède pour couper les cold starts. */
const decryptHotConfig = {
  ...functionConfig,
  minInstances: 1,
  maxInstances: 30,
  concurrency: 80,
};

const BATCH_DECRYPT_MAX_IDS = 50;
type BatchDecryptEntity = 'user' | 'company' | 'contact' | 'prospect';

const STRUCTURE_MEMBER_STATUSES = ['admin', 'admin_structure', 'membre', 'member'];

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

    // Chiffrer les champs sensibles + copies display* en clair
    const encrypted = await encryptUserFieldsWithDisplay(userData);
    
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

    // Vérifier les permissions : superadmin, admin de la même structure, ou membre avec permission RH
    if (userId !== requestingUserId) {
      const currentUserDoc = await admin.firestore().collection('users').doc(requestingUserId).get();
      const currentUser = currentUserDoc.data();
      const targetStructureId = userData?.structureId;

      const isSuperAdmin = currentUser?.status === 'superadmin' || currentUser?.role === 'superadmin';
      const isAdminSameStructure =
        (currentUser?.status === 'admin' || currentUser?.status === 'admin_structure') &&
        currentUser?.structureId === targetStructureId;
      let hasRHReadPermission = false;

      if (targetStructureId && currentUser?.structureId === targetStructureId) {
        const [rhPerm, rhReadPerm] = await Promise.all([
          admin.firestore().doc(`structures/${targetStructureId}/permissions/rh`).get(),
          admin.firestore().doc(`structures/${targetStructureId}/permissions/rh_read`).get(),
        ]);
        const effectiveStatus = currentUser?.status || currentUser?.role || '';
        const userPoleIds = Array.isArray(currentUser?.poleIds) ? currentUser.poleIds
          : (Array.isArray((currentUser as any)?.poles) ? (currentUser as any).poles.map((p: { poleId?: string }) => p?.poleId).filter(Boolean) : []);

        const checkPerm = (perm: Record<string, unknown> | null | undefined) => {
          if (!perm) return false;
          const roleOk = perm.allowedRoles && (
            (Array.isArray(perm.allowedRoles) && (perm.allowedRoles as string[]).includes(effectiveStatus)) ||
            (effectiveStatus === 'membre' && (perm.allowedRoles as string[])?.includes?.('member')) ||
            (effectiveStatus === 'member' && (perm.allowedRoles as string[])?.includes?.('membre'))
          );
          const poleOk = perm.allowedPoles && userPoleIds.length > 0 &&
            Array.isArray(perm.allowedPoles) &&
            (perm.allowedPoles as string[]).some((p: string) => userPoleIds.includes(p));
          const memberOk = perm.allowedMembers && Array.isArray(perm.allowedMembers) &&
            (perm.allowedMembers as string[]).includes(requestingUserId);
          return !!(roleOk || poleOk || memberOk);
        };

        hasRHReadPermission = checkPerm(rhPerm.exists ? rhPerm.data() as Record<string, unknown> : null) ||
          checkPerm(rhReadPerm.exists ? rhReadPerm.data() as Record<string, unknown> : null);
      }

      if (!isSuperAdmin && !isAdminSameStructure && !hasRHReadPermission) {
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
 * Déchiffre les données d'un utilisateur pour les membres de la même structure.
 */
export const decryptUserDataForStructure = onCall(decryptHotConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  try {
    const { userId } = request.data as { userId?: string };
    const requestingUserId = request.auth.uid;

    if (!userId) {
      throw new Error('userId requis');
    }

    const [userDoc, requestingUserDoc] = await Promise.all([
      admin.firestore().collection('users').doc(userId).get(),
      admin.firestore().collection('users').doc(requestingUserId).get(),
    ]);

    if (!userDoc.exists) {
      throw new Error('Utilisateur non trouvé');
    }

    const userData = userDoc.data();
    const requestingUser = requestingUserDoc.data();
    const userStatus = requestingUser?.status;
    const requestingStructureId = requestingUser?.structureId;
    const targetStructureId = userData?.structureId;

    const isStructureStaff =
      !!requestingStructureId &&
      targetStructureId === requestingStructureId &&
      ['admin', 'admin_structure', 'membre', 'member'].includes(userStatus || '');

    // Contact entreprise partenaire : peut voir les ambassadeurs (étudiants) de la même structure
    const isCompanyContactForAmbassadors =
      userStatus === 'entreprise' &&
      !!requestingUser?.companyId &&
      !!requestingStructureId &&
      targetStructureId === requestingStructureId &&
      (userData?.status === 'etudiant' || userData?.isAmbassador === true);

    const isOwnProfile = userId === requestingUserId;

    const canAccess =
      userStatus === 'superadmin' ||
      isOwnProfile ||
      isStructureStaff ||
      isCompanyContactForAmbassadors ||
      (await userHasRHReadAccess(requestingUserId, userId));

    if (!canAccess) {
      throw new Error('Non autorisé : accès réservé aux membres de la structure');
    }

    const decrypted = await decryptSensitiveFields(userData!, SENSITIVE_FIELDS.USER);
    return { success: true, decryptedData: decrypted };
  } catch (error: any) {
    console.error('Erreur lors du déchiffrement des données utilisateur (structure):', error);
    throw new Error(error.message || 'Erreur lors du déchiffrement des données');
  }
});

/**
 * Déchiffre les données de l'utilisateur pour lui-même (sans 2FA)
 * Permet aux utilisateurs de voir leurs propres données sans authentification 2FA
 * Utilisé uniquement pour l'affichage dans leur profil
 */
export const decryptOwnUserData = onCall(decryptHotConfig, async (request) => {
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
    const { companyId, twoFactorCode, structureId: requestStructureId } = request.data;
    const requestingUserId = request.auth.uid;

    const requestingUserDoc = await admin.firestore().collection('users').doc(requestingUserId).get();
    const requestingUser = requestingUserDoc.data();
    const callerStructureId = requestingUser?.structureId as string | undefined;
    const isSuperAdmin =
      requestingUser?.status === 'superadmin' || requestingUser?.role === 'superadmin';

    if (!isSuperAdmin && !callerStructureId) {
      throw new Error('Non autorisé : structureId requis pour le déchiffrement');
    }

    let companyData: Record<string, unknown> | undefined;
    const resolvedCompanyId = typeof companyId === 'string' ? companyId : undefined;

    if (resolvedCompanyId) {
      const companyDoc = await admin.firestore().collection('companies').doc(resolvedCompanyId).get();
      if (!companyDoc.exists) {
        throw new Error('Entreprise non trouvée');
      }
      companyData = companyDoc.data() as Record<string, unknown>;
      const companyStructureId = companyData?.structureId as string | undefined;
      if (!isSuperAdmin && companyStructureId !== callerStructureId) {
        throw new Error('Non autorisé : entreprise hors de votre structure');
      }
    } else if (requestStructureId) {
      if (!isSuperAdmin && requestStructureId !== callerStructureId) {
        throw new Error('Non autorisé : structureId ne correspond pas');
      }
      throw new Error('companyId requis pour le déchiffrement');
    } else {
      throw new Error('companyId ou structureId requis');
    }

    // Vérifier que l'utilisateur a la 2FA activée
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

    const decrypted = await decryptSensitiveFields(companyData!, SENSITIVE_FIELDS.COMPANY);

    // Logger l'accès aux données cryptées
    await logEncryptedDataAccess(
      requestingUserId,
      'decrypt_company',
      resolvedCompanyId || 'unknown',
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
 * Déchiffre les données de l'entreprise pour un contact avec accès (sans 2FA)
 * Permet aux contacts de voir les données de leur propre entreprise
 */
export const decryptOwnCompanyData = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  try {
    const { companyId } = request.data;
    const requestingUserId = request.auth.uid;

    if (!companyId) {
      throw new Error('companyId requis');
    }

    const companyDoc = await admin.firestore().collection('companies').doc(companyId).get();

    if (!companyDoc.exists) {
      throw new Error('Entreprise non trouvée');
    }

    const requestingUserDoc = await admin.firestore().collection('users').doc(requestingUserId).get();
    const requestingUser = requestingUserDoc.data();

    // Vérifier que l'utilisateur est un contact avec accès à cette entreprise
    const isContactWithAccess = requestingUser?.status === 'entreprise' && requestingUser?.companyId === companyId;

    if (!isContactWithAccess) {
      throw new Error('Non autorisé : accès réservé au contact de cette entreprise');
    }

    const companyData = companyDoc.data();
    const decrypted = await decryptSensitiveFields(companyData!, SENSITIVE_FIELDS.COMPANY);

    return { success: true, decryptedData: decrypted };
  } catch (error: any) {
    console.error('Erreur lors du déchiffrement des données entreprise (contact):', error);
    throw new Error(error.message || 'Erreur lors du déchiffrement des données');
  }
});

/**
 * Déchiffre les données d'une entreprise pour les membres de la structure (sans 2FA)
 * Permet aux admins/membres de voir les données des entreprises de leur structure
 */
export const decryptCompanyDataForStructure = onCall(decryptHotConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  try {
    const { companyId } = request.data;
    const requestingUserId = request.auth.uid;

    if (!companyId) {
      throw new Error('companyId requis');
    }

    const [companyDoc, userDoc] = await Promise.all([
      admin.firestore().collection('companies').doc(companyId).get(),
      admin.firestore().collection('users').doc(requestingUserId).get()
    ]);

    if (!companyDoc.exists) {
      throw new Error('Entreprise non trouvée');
    }

    const companyData = companyDoc.data();
    const userData = userDoc.data();
    const userStatus = userData?.status;
    const userStructureId = userData?.structureId;
    const companyStructureId = companyData?.structureId;

    const canAccess = userStatus === 'superadmin' ||
      (userStructureId && companyStructureId === userStructureId && ['admin', 'admin_structure', 'membre', 'member'].includes(userStatus || ''));

    if (!canAccess) {
      throw new Error('Non autorisé : accès réservé aux membres de la structure');
    }

    const decrypted = await decryptSensitiveFields(companyData!, SENSITIVE_FIELDS.COMPANY);
    return { success: true, decryptedData: decrypted };
  } catch (error: any) {
    console.error('Erreur lors du déchiffrement des données entreprise (structure):', error);
    throw new Error(error.message || 'Erreur lors du déchiffrement des données');
  }
});

/**
 * Déchiffre les données d'une structure pour ses membres (sans 2FA)
 */
export const decryptStructureDataForStructure = onCall(decryptHotConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  try {
    const { structureId } = request.data as { structureId?: string };
    const requestingUserId = request.auth.uid;

    if (!structureId) {
      throw new Error('structureId requis');
    }

    const [structureDoc, userDoc] = await Promise.all([
      admin.firestore().collection('structures').doc(structureId).get(),
      admin.firestore().collection('users').doc(requestingUserId).get(),
    ]);

    if (!structureDoc.exists) {
      throw new Error('Structure non trouvée');
    }

    const structureData = structureDoc.data();
    const userData = userDoc.data();
    const userStatus = userData?.status;
    const userStructureId = userData?.structureId;

    const canAccess =
      userStatus === 'superadmin' ||
      (userStructureId === structureId &&
        ['admin', 'admin_structure', 'membre', 'member'].includes(userStatus || ''));

    if (!canAccess) {
      throw new Error('Non autorisé : accès réservé aux membres de la structure');
    }

    const decrypted = await decryptSensitiveFields(structureData!, SENSITIVE_FIELDS.STRUCTURE);
    return { success: true, decryptedData: decrypted };
  } catch (error: any) {
    console.error('Erreur lors du déchiffrement des données structure:', error);
    throw new Error(error.message || 'Erreur lors du déchiffrement des données');
  }
});

/**
 * Déchiffre les données d'un contact pour les membres de la structure (sans 2FA)
 * Permet aux admins/membres de voir les données des contacts des entreprises de leur structure
 */
export const decryptContactDataForStructure = onCall(decryptHotConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  try {
    const { contactId } = request.data;
    const requestingUserId = request.auth.uid;

    if (!contactId) {
      throw new Error('contactId requis');
    }

    const [contactDoc, userDoc] = await Promise.all([
      admin.firestore().collection('contacts').doc(contactId).get(),
      admin.firestore().collection('users').doc(requestingUserId).get()
    ]);

    if (!contactDoc.exists) {
      throw new Error('Contact non trouvé');
    }

    const contactData = contactDoc.data();
    const userData = userDoc.data();
    const userStatus = userData?.status;
    const userStructureId = userData?.structureId;
    const contactCompanyId = contactData?.companyId;

    if (!contactCompanyId) {
      throw new Error('Contact sans entreprise associée');
    }

    const companyDoc = await admin.firestore().collection('companies').doc(contactCompanyId).get();
    const companyData = companyDoc.exists ? companyDoc.data() : null;
    const companyStructureId = companyData?.structureId;

    const isCompanyContact =
      userStatus === 'entreprise' &&
      !!userData?.companyId &&
      contactData?.companyId === userData.companyId;

    const canAccess = userStatus === 'superadmin' ||
      isCompanyContact ||
      (userStructureId && companyStructureId === userStructureId && ['admin', 'admin_structure', 'membre', 'member'].includes(userStatus || ''));

    if (!canAccess) {
      throw new Error('Non autorisé : accès réservé aux membres de la structure');
    }

    const decrypted = await decryptSensitiveFields(contactData!, SENSITIVE_FIELDS.CONTACT);
    return { success: true, decryptedData: decrypted };
  } catch (error: any) {
    console.error('Erreur lors du déchiffrement des données contact (structure):', error);
    throw new Error(error.message || 'Erreur lors du déchiffrement des données');
  }
});

/**
 * Déchiffre les données d'un prospect pour les membres de la structure (sans 2FA)
 * Permet aux admins/membres de voir les données des prospects de leur structure
 */
export const decryptProspectDataForStructure = onCall(decryptHotConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  try {
    const { prospectId } = request.data;
    const requestingUserId = request.auth.uid;

    if (!prospectId) {
      throw new Error('prospectId requis');
    }

    const [prospectDoc, userDoc] = await Promise.all([
      admin.firestore().collection('prospects').doc(prospectId).get(),
      admin.firestore().collection('users').doc(requestingUserId).get()
    ]);

    if (!prospectDoc.exists) {
      throw new Error('Prospect non trouvé');
    }

    const prospectData = prospectDoc.data();
    const userData = userDoc.data();
    const userStatus = userData?.status;
    const userStructureId = userData?.structureId;
    const prospectStructureId = prospectData?.structureId;

    const canAccess = userStatus === 'superadmin' ||
      (userStructureId && prospectStructureId === userStructureId && ['admin', 'admin_structure', 'membre', 'member'].includes(userStatus || ''));

    if (!canAccess) {
      throw new Error('Non autorisé : accès réservé aux membres de la structure');
    }

    const decrypted = await decryptSensitiveFields(prospectData!, SENSITIVE_FIELDS.PROSPECT);
    return { success: true, decryptedData: decrypted };
  } catch (error: any) {
    console.error('Erreur lors du déchiffrement des données prospect (structure):', error);
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
    const { contactId, twoFactorCode, structureId: requestStructureId } = request.data;
    const requestingUserId = request.auth.uid;

    const requestingUserDoc = await admin.firestore().collection('users').doc(requestingUserId).get();
    const requestingUser = requestingUserDoc.data();
    const callerStructureId = requestingUser?.structureId as string | undefined;
    const isSuperAdmin =
      requestingUser?.status === 'superadmin' || requestingUser?.role === 'superadmin';

    if (!isSuperAdmin && !callerStructureId) {
      throw new Error('Non autorisé : structureId requis pour le déchiffrement');
    }

    let contactData: Record<string, unknown> | undefined;
    const resolvedContactId = typeof contactId === 'string' ? contactId : undefined;

    if (resolvedContactId) {
      const contactDoc = await admin.firestore().collection('contacts').doc(resolvedContactId).get();
      if (!contactDoc.exists) {
        throw new Error('Contact non trouvé');
      }
      contactData = contactDoc.data() as Record<string, unknown>;

      let contactStructureId = contactData?.structureId as string | undefined;
      if (!contactStructureId && contactData?.companyId) {
        const companyDoc = await admin
          .firestore()
          .collection('companies')
          .doc(String(contactData.companyId))
          .get();
        contactStructureId = companyDoc.exists
          ? (companyDoc.data()?.structureId as string | undefined)
          : undefined;
      }

      if (!isSuperAdmin && contactStructureId !== callerStructureId) {
        throw new Error('Non autorisé : contact hors de votre structure');
      }
    } else if (requestStructureId) {
      if (!isSuperAdmin && requestStructureId !== callerStructureId) {
        throw new Error('Non autorisé : structureId ne correspond pas');
      }
      throw new Error('contactId requis pour le déchiffrement');
    } else {
      throw new Error('contactId ou structureId requis');
    }

    // Vérifier que l'utilisateur a la 2FA activée
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

    const decrypted = await decryptSensitiveFields(contactData!, SENSITIVE_FIELDS.CONTACT);

    // Logger l'accès aux données cryptées
    await logEncryptedDataAccess(
      requestingUserId,
      'decrypt_contact',
      resolvedContactId || 'unknown',
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

  const callerSnap = await admin.firestore().collection('users').doc(request.auth.uid).get();
  const caller = callerSnap.data();
  if (caller?.status !== 'superadmin' && caller?.role !== 'superadmin') {
    throw new Error('Accès réservé au superadmin');
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

const lowResourceConfig = {
  ...functionConfig,
  minInstances: 0,
  maxInstances: 8,
  concurrency: 40,
};

/**
 * Déchiffre un texte arbitraire.
 * Isolation Phase 1 : le ciphertext n'est pas lié cryptographiquement à une structure
 * (pas de HKDF par tenant encore), mais on exige request.data.structureId === caller.structureId
 * pour éviter un oracle de déchiffrement cross-tenant ouvert.
 */
export const decryptText = onCall(lowResourceConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  const callerSnap = await admin.firestore().collection('users').doc(request.auth.uid).get();
  const caller = callerSnap.data();
  const callerStructureId = caller?.structureId as string | undefined;
  const isSuperAdmin = caller?.status === 'superadmin' || caller?.role === 'superadmin';
  const memberStatuses = ['admin', 'admin_structure', 'membre', 'member', 'etudiant', 'entreprise'];
  if (
    !isSuperAdmin &&
    (!callerStructureId || !memberStatuses.includes(caller?.status ?? ''))
  ) {
    throw new Error('Permissions insuffisantes pour déchiffrer');
  }

  const requestStructureId = request.data?.structureId as string | undefined;
  if (!requestStructureId || typeof requestStructureId !== 'string') {
    throw new Error('structureId requis');
  }
  if (!isSuperAdmin && requestStructureId !== callerStructureId) {
    throw new Error('Non autorisé : structureId ne correspond pas');
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

function pickDecryptedFields(
  decrypted: Record<string, unknown>,
  fields?: string[]
): Record<string, unknown> {
  if (!fields || fields.length === 0) return decrypted;
  const picked: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in decrypted) picked[field] = decrypted[field];
  }
  return picked;
}

/**
 * Déchiffre plusieurs documents d'une même entité en un seul callable.
 * Remplace les boucles N×1 côté client (Commercial, RH, listes…).
 */
export const batchDecryptForStructure = onCall(decryptHotConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  const {
    entity,
    ids,
    fields,
  } = request.data as {
    entity?: BatchDecryptEntity;
    ids?: string[];
    fields?: string[];
  };

  if (!entity || !['user', 'company', 'contact', 'prospect'].includes(entity)) {
    throw new Error('entity invalide (user|company|contact|prospect)');
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('ids requis');
  }

  const uniqueIds = Array.from(
    new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))
  ).slice(0, BATCH_DECRYPT_MAX_IDS);

  const requestingUserId = request.auth.uid;
  const requestingUserDoc = await admin.firestore().collection('users').doc(requestingUserId).get();
  const requestingUser = requestingUserDoc.data();
  const userStatus = requestingUser?.status;
  const userStructureId = requestingUser?.structureId as string | undefined;
  const isSuperAdmin = userStatus === 'superadmin';
  const isStructureStaff =
    !!userStructureId && STRUCTURE_MEMBER_STATUSES.includes(userStatus || '');

  if (!isSuperAdmin && !isStructureStaff && userStatus !== 'entreprise') {
    throw new Error('Non autorisé : accès réservé aux membres de la structure');
  }

  const results: Record<string, Record<string, unknown>> = {};
  const errors: Record<string, string> = {};

  if (entity === 'user') {
    const refs = uniqueIds.map((id) => admin.firestore().collection('users').doc(id));
    const snaps = await admin.firestore().getAll(...refs);

    await Promise.all(
      snaps.map(async (snap) => {
        if (!snap.exists) {
          errors[snap.id] = 'Utilisateur non trouvé';
          return;
        }
        const data = snap.data()!;
        const targetStructureId = data.structureId as string | undefined;
        const isOwnProfile = snap.id === requestingUserId;
        const isSameStructureStaff =
          isStructureStaff && !!userStructureId && targetStructureId === userStructureId;
        const isCompanyContactForAmbassadors =
          userStatus === 'entreprise' &&
          !!requestingUser?.companyId &&
          !!userStructureId &&
          targetStructureId === userStructureId &&
          (data.status === 'etudiant' || data.isAmbassador === true);

        const canAccess =
          isSuperAdmin ||
          isOwnProfile ||
          isSameStructureStaff ||
          isCompanyContactForAmbassadors ||
          (await userHasRHReadAccess(requestingUserId, snap.id));

        if (!canAccess) {
          errors[snap.id] = 'Non autorisé';
          return;
        }

        const decrypted = await decryptSensitiveFields(data, SENSITIVE_FIELDS.USER);
        results[snap.id] = pickDecryptedFields(decrypted as Record<string, unknown>, fields);
      })
    );
  } else if (entity === 'company') {
    const refs = uniqueIds.map((id) => admin.firestore().collection('companies').doc(id));
    const snaps = await admin.firestore().getAll(...refs);

    await Promise.all(
      snaps.map(async (snap) => {
        if (!snap.exists) {
          errors[snap.id] = 'Entreprise non trouvée';
          return;
        }
        const data = snap.data()!;
        const companyStructureId = data.structureId as string | undefined;
        const canAccess =
          isSuperAdmin ||
          (isStructureStaff && !!userStructureId && companyStructureId === userStructureId);
        if (!canAccess) {
          errors[snap.id] = 'Non autorisé';
          return;
        }
        const decrypted = await decryptSensitiveFields(data, SENSITIVE_FIELDS.COMPANY);
        results[snap.id] = pickDecryptedFields(decrypted as Record<string, unknown>, fields);
      })
    );
  } else if (entity === 'prospect') {
    const refs = uniqueIds.map((id) => admin.firestore().collection('prospects').doc(id));
    const snaps = await admin.firestore().getAll(...refs);

    await Promise.all(
      snaps.map(async (snap) => {
        if (!snap.exists) {
          errors[snap.id] = 'Prospect non trouvé';
          return;
        }
        const data = snap.data()!;
        const prospectStructureId = data.structureId as string | undefined;
        const canAccess =
          isSuperAdmin ||
          (isStructureStaff && !!userStructureId && prospectStructureId === userStructureId);
        if (!canAccess) {
          errors[snap.id] = 'Non autorisé';
          return;
        }
        const decrypted = await decryptSensitiveFields(data, SENSITIVE_FIELDS.PROSPECT);
        results[snap.id] = pickDecryptedFields(decrypted as Record<string, unknown>, fields);
      })
    );
  } else {
    // contact — besoin de la company pour vérifier structureId
    const refs = uniqueIds.map((id) => admin.firestore().collection('contacts').doc(id));
    const snaps = await admin.firestore().getAll(...refs);
    const companyIds = Array.from(
      new Set(
        snaps
          .map((s) => (s.exists ? (s.data()?.companyId as string | undefined) : undefined))
          .filter((id): id is string => !!id)
      )
    );
    const companySnaps =
      companyIds.length > 0
        ? await admin.firestore().getAll(
            ...companyIds.map((id) => admin.firestore().collection('companies').doc(id))
          )
        : [];
    const companyStructureById = new Map(
      companySnaps.map((s) => [s.id, s.exists ? (s.data()?.structureId as string | undefined) : undefined])
    );

    await Promise.all(
      snaps.map(async (snap) => {
        if (!snap.exists) {
          errors[snap.id] = 'Contact non trouvé';
          return;
        }
        const data = snap.data()!;
        const contactCompanyId = data.companyId as string | undefined;
        if (!contactCompanyId) {
          errors[snap.id] = 'Contact sans entreprise associée';
          return;
        }
        const companyStructureId = companyStructureById.get(contactCompanyId);
        const isCompanyContact =
          userStatus === 'entreprise' &&
          !!requestingUser?.companyId &&
          contactCompanyId === requestingUser.companyId;
        const canAccess =
          isSuperAdmin ||
          isCompanyContact ||
          (isStructureStaff && !!userStructureId && companyStructureId === userStructureId);
        if (!canAccess) {
          errors[snap.id] = 'Non autorisé';
          return;
        }
        const decrypted = await decryptSensitiveFields(data, SENSITIVE_FIELDS.CONTACT);
        results[snap.id] = pickDecryptedFields(decrypted as Record<string, unknown>, fields);
      })
    );
  }

  return { success: true, results, errors };
});
