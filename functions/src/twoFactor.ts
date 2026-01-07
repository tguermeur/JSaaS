// Helper pour les logs de debug (sécurisé pour Cloud Run)
function debugLog(location: string, message: string, data: any, hypothesisId: string) {
  try {
    if (typeof fetch !== 'undefined' && typeof window === 'undefined') {
      fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, message, data, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId })
      }).catch(() => {});
    }
  } catch (e) {
    // Ignorer les erreurs de fetch dans Cloud Run
  }
}

// #region agent log
debugLog('twoFactor.ts:1', 'twoFactor module loading', {}, 'E');
// #endregion
import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
// #region agent log
debugLog('twoFactor.ts:4', 'Before importing speakeasy', {}, 'E');
// #endregion
import * as speakeasy from 'speakeasy';
// #region agent log
debugLog('twoFactor.ts:6', 'After importing speakeasy', { hasSpeakeasy: typeof speakeasy !== 'undefined', hasGenerateSecret: typeof speakeasy?.generateSecret === 'function' }, 'E');
// #endregion

// Configuration des fonctions
const functionConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 300,
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 10,
  concurrency: 80
};

/**
 * Génère un secret TOTP et un QR code pour l'authentification à deux facteurs
 */
export const generateTwoFactorSecret = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }
  
  const { uid } = request.data;
  
  if (!uid || uid !== request.auth.uid) {
    throw new Error('Non autorisé');
  }

  try {
    // Récupérer l'email de l'utilisateur depuis Firebase Auth
    const userRecord = await admin.auth().getUser(uid);
    const userEmail = userRecord.email || uid;
    
    // Générer un secret TOTP
    const secret = speakeasy.generateSecret({
      name: `JS Connect (${userEmail})`,
      issuer: 'JS Connect',
      length: 32
    });

    // Stocker le secret de manière sécurisée (temporairement, jusqu'à ce que l'utilisateur confirme)
    await admin.firestore()
      .collection('users')
      .doc(uid)
      .update({
        twoFactorSecret: secret.base32, // Stocker en base32
        twoFactorSecretTemp: true, // Marquer comme temporaire
        twoFactorEnabled: false // Pas encore activé
      });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url || '', // URL pour générer le QR code côté client
      manualEntryKey: secret.base32
    };
  } catch (error) {
    console.error('Erreur génération secret 2FA:', error);
    throw new Error('Erreur lors de la génération du secret 2FA');
  }
});

/**
 * Vérifie le code TOTP et active la 2FA si valide
 */
export const verifyAndEnableTwoFactor = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }
  
  const { uid, code } = request.data;
  
  if (!uid || uid !== request.auth.uid) {
    throw new Error('Non autorisé');
  }

  if (!code || code.length !== 6) {
    throw new Error('Code invalide');
  }

  try {
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(uid)
      .get();

    if (!userDoc.exists) {
      throw new Error('Utilisateur non trouvé');
    }

    const userData = userDoc.data();
    const secret = userData?.twoFactorSecret;

    if (!secret) {
      throw new Error('Aucun secret 2FA trouvé. Veuillez générer un nouveau secret.');
    }

    // Vérifier le code TOTP
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: code,
      window: 2 // Accepter les codes dans une fenêtre de ±2 périodes (60 secondes)
    });

    if (!verified) {
      throw new Error('Code invalide');
    }

    // Activer la 2FA et supprimer le flag temporaire
    await admin.firestore()
      .collection('users')
      .doc(uid)
      .update({
        twoFactorEnabled: true,
        twoFactorSecretTemp: admin.firestore.FieldValue.delete(),
        twoFactorEnabledAt: admin.firestore.FieldValue.serverTimestamp()
      });

    return { success: true };
  } catch (error: any) {
    console.error('Erreur vérification 2FA:', error);
    throw new Error(error.message || 'Erreur lors de la vérification du code');
  }
});

/**
 * Vérifie un code TOTP lors de la connexion et ajoute l'appareil comme sécurisé
 */
export const verifyTwoFactorCode = onCall(functionConfig, async (request) => {
  // #region agent log
  console.log('[verifyTwoFactorCode] Function entry', { hasAuth: !!request.auth, uid: request.auth?.uid });
  debugLog('verifyTwoFactorCode:1', 'Function entry', { hasAuth: !!request.auth, uid: request.auth?.uid }, 'A');
  // #endregion
  
  if (!request.auth) {
    throw new Error('Non autorisé');
  }
  
  const { uid, code, deviceInfo } = request.data;
  
  // #region agent log
  console.log('[verifyTwoFactorCode] Request data parsed', { uid, codeLength: code?.length, hasDeviceInfo: !!deviceInfo, deviceInfo });
  debugLog('verifyTwoFactorCode:2', 'Request data parsed', { uid, codeLength: code?.length, hasDeviceInfo: !!deviceInfo, deviceInfo }, 'A');
  // #endregion
  
  if (!uid || uid !== request.auth.uid) {
    throw new Error('Non autorisé');
  }

  if (!code || code.length !== 6) {
    throw new Error('Code invalide');
  }

  try {
    // #region agent log
    console.log('[verifyTwoFactorCode] Fetching user document', { uid });
    debugLog('verifyTwoFactorCode:3', 'Fetching user document', { uid }, 'B');
    // #endregion
    
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(uid)
      .get();

    if (!userDoc.exists) {
      throw new Error('Utilisateur non trouvé');
    }

    const userData = userDoc.data();
    const secret = userData?.twoFactorSecret;

    // #region agent log
    console.log('[verifyTwoFactorCode] User data retrieved', { hasSecret: !!secret, hasSecureDevices: !!userData?.secureDevices, secureDevicesCount: userData?.secureDevices?.length || 0 });
    debugLog('verifyTwoFactorCode:4', 'User data retrieved', { hasSecret: !!secret, hasSecureDevices: !!userData?.secureDevices, secureDevicesCount: userData?.secureDevices?.length || 0 }, 'B');
    // #endregion

    if (!secret) {
      throw new Error('2FA non configurée');
    }

    // #region agent log
    console.log('[verifyTwoFactorCode] Verifying TOTP code', { secretLength: secret.length, code });
    debugLog('verifyTwoFactorCode:5', 'Verifying TOTP code', { secretLength: secret.length, code }, 'C');
    // #endregion

    // Vérifier le code TOTP
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: code,
      window: 2
    });

    // #region agent log
    console.log('[verifyTwoFactorCode] TOTP verification result', { verified });
    debugLog('verifyTwoFactorCode:6', 'TOTP verification result', { verified }, 'C');
    // #endregion

    if (!verified) {
      throw new Error('Code invalide');
    }

    // Si le code est valide et que des infos d'appareil sont fournies, ajouter l'appareil comme sécurisé
    if (deviceInfo) {
      // #region agent log
      console.log('[verifyTwoFactorCode] Processing device info', { deviceInfo });
      debugLog('verifyTwoFactorCode:7', 'Processing device info', { deviceInfo }, 'D');
      // #endregion
      
      const deviceId = deviceInfo.deviceId || `${uid}_${Date.now()}`;
      const secureDevices = userData?.secureDevices || [];
      
      // Vérifier si l'appareil existe déjà
      const existingDeviceIndex = secureDevices.findIndex((d: any) => d.deviceId === deviceId);
      
      // #region agent log
      console.log('[verifyTwoFactorCode] Device lookup', { deviceId, existingDeviceIndex, secureDevicesLength: secureDevices.length });
      debugLog('verifyTwoFactorCode:8', 'Device lookup', { deviceId, existingDeviceIndex, secureDevicesLength: secureDevices.length }, 'D');
      // #endregion
      
      // Préparer les données de l'appareil
      // IMPORTANT: Firestore ne permet pas FieldValue.serverTimestamp() dans un tableau lors d'un update()
      // Il faut utiliser un Timestamp réel
      const now = admin.firestore.Timestamp.now();
      const existingDevice = existingDeviceIndex >= 0 ? secureDevices[existingDeviceIndex] : null;
      
      const deviceData: any = {
        deviceId,
        deviceName: deviceInfo.deviceName || 'Appareil inconnu',
        userAgent: deviceInfo.userAgent || '',
        platform: deviceInfo.platform || 'Unknown',
        lastUsed: now // Utiliser un Timestamp réel au lieu de FieldValue
      };
      
      // Pour addedAt, garder la valeur existante si disponible, sinon utiliser le timestamp actuel
      if (existingDevice && existingDevice.addedAt) {
        // Garder le Timestamp existant tel quel
        deviceData.addedAt = existingDevice.addedAt;
      } else {
        // Nouvel appareil, utiliser le timestamp actuel
        deviceData.addedAt = now;
      }

      // #region agent log
      console.log('[verifyTwoFactorCode] Device data created', { deviceId, deviceName: deviceData.deviceName, platform: deviceData.platform });
      debugLog('verifyTwoFactorCode:9', 'Device data created', { deviceData: { ...deviceData, lastUsed: 'serverTimestamp', addedAt: 'timestamp' } }, 'D');
      // #endregion

      if (existingDeviceIndex >= 0) {
        // Mettre à jour l'appareil existant
        secureDevices[existingDeviceIndex] = deviceData;
      } else {
        // Ajouter le nouvel appareil
        secureDevices.push(deviceData);
      }

      // Limiter à 10 appareils maximum
      if (secureDevices.length > 10) {
        // Garder les 10 plus récents - trier par lastUsed
        secureDevices.sort((a: any, b: any) => {
          const aTime = a.lastUsed?.toMillis?.() || a.lastUsed?.seconds * 1000 || 0;
          const bTime = b.lastUsed?.toMillis?.() || b.lastUsed?.seconds * 1000 || 0;
          return bTime - aTime;
        });
        secureDevices.splice(10);
      }

      // #region agent log
      console.log('[verifyTwoFactorCode] Before Firestore update', { secureDevicesLength: secureDevices.length });
      debugLog('verifyTwoFactorCode:10', 'Before Firestore update', { secureDevicesLength: secureDevices.length }, 'E');
      // #endregion

      try {
        await admin.firestore()
          .collection('users')
          .doc(uid)
          .update({
            secureDevices
          });
        // #region agent log
        console.log('[verifyTwoFactorCode] Firestore update successful');
        debugLog('verifyTwoFactorCode:11', 'Firestore update successful', {}, 'E');
        // #endregion
      } catch (updateError: any) {
        // #region agent log
        console.error('[verifyTwoFactorCode] Firestore update error', { error: updateError.message, stack: updateError.stack, code: updateError.code });
        debugLog('verifyTwoFactorCode:11-error', 'Firestore update error', { error: updateError.message, stack: updateError.stack, code: updateError.code }, 'E');
        // #endregion
        throw updateError;
      }
    }

    // #region agent log
    console.log('[verifyTwoFactorCode] Function exit success');
    debugLog('verifyTwoFactorCode:12', 'Function exit success', {}, 'A');
    // #endregion

    return { success: true };
  } catch (error: any) {
    // #region agent log
    console.error('[verifyTwoFactorCode] Error caught', { errorMessage: error.message, errorStack: error.stack, errorName: error.name, errorCode: error.code });
    debugLog('verifyTwoFactorCode:13', 'Error caught', { errorMessage: error.message, errorStack: error.stack, errorName: error.name }, 'A');
    // #endregion
    
    console.error('Erreur vérification code 2FA:', error);
    throw new Error(error.message || 'Code invalide');
  }
});

/**
 * Désactive la 2FA pour un utilisateur
 */
export const disableTwoFactor = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }
  
  const { uid } = request.data;
  
  if (!uid || uid !== request.auth.uid) {
    throw new Error('Non autorisé');
  }

  try {
    await admin.firestore()
      .collection('users')
      .doc(uid)
      .update({
        twoFactorEnabled: false,
        twoFactorSecret: admin.firestore.FieldValue.delete(),
        twoFactorEnabledAt: admin.firestore.FieldValue.delete()
      });

    return { success: true };
  } catch (error) {
    console.error('Erreur désactivation 2FA:', error);
    throw new Error('Erreur lors de la désactivation de la 2FA');
  }
});

/**
 * Récupère la liste des appareils sécurisés pour un utilisateur
 */
export const getSecureDevices = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }
  
  const { uid } = request.data;
  
  if (!uid || uid !== request.auth.uid) {
    throw new Error('Non autorisé');
  }

  try {
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(uid)
      .get();

    if (!userDoc.exists) {
      throw new Error('Utilisateur non trouvé');
    }

    const userData = userDoc.data();
    const secureDevices = userData?.secureDevices || [];

    // Convertir les timestamps Firestore en dates (format ISO pour le client)
    const devices = secureDevices.map((device: any) => {
      const convertTimestamp = (ts: any): string | null => {
        if (!ts) return null;
        
        // Si c'est un Timestamp Firestore avec toDate()
        if (ts && typeof ts.toDate === 'function') {
          return ts.toDate().toISOString();
        }
        
        // Si c'est un objet avec seconds et nanoseconds (format sérialisé Firestore)
        if (ts && typeof ts.seconds === 'number') {
          const date = new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
          return date.toISOString();
        }
        
        // Si c'est déjà une Date
        if (ts instanceof Date) {
          return ts.toISOString();
        }
        
        // Si c'est une string ISO
        if (typeof ts === 'string') {
          return ts;
        }
        
        return null;
      };
      
      return {
        ...device,
        lastUsed: convertTimestamp(device.lastUsed),
        addedAt: convertTimestamp(device.addedAt)
      };
    });

    return { devices };
  } catch (error: any) {
    console.error('Erreur récupération appareils sécurisés:', error);
    throw new Error(error.message || 'Erreur lors de la récupération des appareils');
  }
});

/**
 * Supprime un appareil sécurisé
 */
export const removeSecureDevice = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }
  
  const { uid, deviceId } = request.data;
  
  if (!uid || uid !== request.auth.uid) {
    throw new Error('Non autorisé');
  }

  if (!deviceId) {
    throw new Error('ID d\'appareil requis');
  }

  try {
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(uid)
      .get();

    if (!userDoc.exists) {
      throw new Error('Utilisateur non trouvé');
    }

    const userData = userDoc.data();
    const secureDevices = userData?.secureDevices || [];
    
    // Filtrer l'appareil à supprimer
    const updatedDevices = secureDevices.filter((device: any) => device.deviceId !== deviceId);

    await admin.firestore()
      .collection('users')
      .doc(uid)
      .update({
        secureDevices: updatedDevices
      });

    return { success: true };
  } catch (error: any) {
    console.error('Erreur suppression appareil:', error);
    throw new Error(error.message || 'Erreur lors de la suppression de l\'appareil');
  }
});

/**
 * Déconnecte tous les autres appareils (révoque tous les tokens sauf celui de l'appareil actuel)
 */
export const logoutOtherDevices = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }
  
  const { uid, currentDeviceId } = request.data;
  
  if (!uid || uid !== request.auth.uid) {
    throw new Error('Non autorisé');
  }

  try {
    // Révoquer tous les tokens de l'utilisateur
    // Note: Firebase Auth ne permet pas de révoquer des tokens spécifiques,
    // donc on révoque tous les tokens et l'utilisateur devra se reconnecter
    // sur tous les appareils sauf celui qui a appelé cette fonction
    await admin.auth().revokeRefreshTokens(uid);

    // Mettre à jour la liste des appareils sécurisés
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(uid)
      .get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      const secureDevices = userData?.secureDevices || [];
      
      // Si un deviceId actuel est fourni, on le garde, sinon on supprime tous les appareils
      let updatedDevices = [];
      if (currentDeviceId) {
        updatedDevices = secureDevices.filter((device: any) => device.deviceId === currentDeviceId);
      }

      await admin.firestore()
        .collection('users')
        .doc(uid)
        .update({
          secureDevices: updatedDevices
        });
    }

    return { success: true, message: 'Tous les autres appareils ont été déconnectés' };
  } catch (error: any) {
    console.error('Erreur déconnexion autres appareils:', error);
    throw new Error(error.message || 'Erreur lors de la déconnexion des autres appareils');
  }
});

