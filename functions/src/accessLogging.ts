/**
 * Système de logging des accès aux données cryptées
 */

import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const functionConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 300,
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 1,
  concurrency: 20,
  allowUnauthenticated: false,
};

export type AccessType = 'decrypt_user' | 'decrypt_company' | 'decrypt_contact' | 'decrypt_file';

export interface EncryptedDataAccessLog {
  userId: string;
  userEmail: string;
  userName: string;
  accessType: AccessType;
  resourceId: string;
  resourceType: string;
  twoFactorVerified: boolean;
  timestamp: admin.firestore.Timestamp;
  ipAddress?: string;
  userAgent?: string;
  structureId?: string;
}

/**
 * Enregistre un accès aux données cryptées
 */
export async function logEncryptedDataAccess(
  userId: string,
  accessType: AccessType,
  resourceId: string,
  twoFactorVerified: boolean,
  request?: { ip?: string; userAgent?: string }
): Promise<void> {
  try {
    // Récupérer les informations de l'utilisateur
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.error(`[logEncryptedDataAccess] Utilisateur ${userId} non trouvé`);
      return;
    }

    const userData = userDoc.data();
    const resourceType = getResourceType(accessType);

    const logData: Omit<EncryptedDataAccessLog, 'timestamp'> = {
      userId,
      userEmail: userData?.email || 'unknown',
      userName: userData?.displayName || userData?.firstName + ' ' + userData?.lastName || 'Utilisateur inconnu',
      accessType,
      resourceId,
      resourceType,
      twoFactorVerified,
      ipAddress: request?.ip,
      userAgent: request?.userAgent,
      structureId: userData?.structureId
    };

    // Enregistrer le log dans Firestore
    await admin.firestore().collection('encryptedDataAccessLogs').add({
      ...logData,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[logEncryptedDataAccess] Log enregistré pour ${userId} - Type: ${accessType}, Ressource: ${resourceId}`);
  } catch (error) {
    console.error('[logEncryptedDataAccess] Erreur lors de l\'enregistrement du log:', error);
    // Ne pas faire échouer l'opération principale si le log échoue
  }
}

/**
 * Détermine le type de ressource à partir du type d'accès
 */
function getResourceType(accessType: AccessType): string {
  switch (accessType) {
    case 'decrypt_user':
      return 'user';
    case 'decrypt_company':
      return 'company';
    case 'decrypt_contact':
      return 'contact';
    case 'decrypt_file':
      return 'file';
    default:
      return 'unknown';
  }
}

/**
 * Récupère les logs d'accès aux données cryptées
 */
export async function getEncryptedDataAccessLogs(
  structureId?: string,
  userId?: string,
  limit: number = 50,
  startAfter?: admin.firestore.DocumentSnapshot
): Promise<{ logs: EncryptedDataAccessLog[]; lastDoc?: admin.firestore.DocumentSnapshot }> {
  try {
    let query: admin.firestore.Query = admin.firestore()
      .collection('encryptedDataAccessLogs')
      .orderBy('timestamp', 'desc');

    if (structureId) {
      query = query.where('structureId', '==', structureId);
    }

    if (userId) {
      query = query.where('userId', '==', userId);
    }

    if (startAfter) {
      query = query.startAfter(startAfter);
    }

    query = query.limit(limit);

    const snapshot = await query.get();
    const logs: EncryptedDataAccessLog[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      logs.push({
        ...data,
        timestamp: data.timestamp || admin.firestore.Timestamp.now()
      } as EncryptedDataAccessLog);
    });

    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : undefined;

    return { logs, lastDoc };
  } catch (error) {
    console.error('[getEncryptedDataAccessLogs] Erreur lors de la récupération des logs:', error);
    throw error;
  }
}

/**
 * Cloud Function pour récupérer les logs d'accès aux données cryptées
 */
export const getEncryptedDataAccessLogsFunction = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  try {
    const { structureId, userId, limit = 50, startAfterId } = request.data;

    // Vérifier les permissions
    const currentUserDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
    const currentUser = currentUserDoc.data();

    if (!currentUser) {
      throw new Error('Utilisateur non trouvé');
    }

    // Seuls les admins et superadmins peuvent voir les logs
    if (currentUser.status !== 'superadmin' && currentUser.status !== 'admin') {
      throw new Error('Non autorisé à consulter les logs');
    }

    // Si structureId est fourni, vérifier que l'utilisateur appartient à cette structure
    const targetStructureId = structureId || currentUser.structureId;
    if (targetStructureId && currentUser.status !== 'superadmin' && currentUser.structureId !== targetStructureId) {
      throw new Error('Non autorisé à consulter les logs de cette structure');
    }

    let startAfterDoc: admin.firestore.DocumentSnapshot | undefined;
    if (startAfterId) {
      startAfterDoc = await admin.firestore().collection('encryptedDataAccessLogs').doc(startAfterId).get();
      if (!startAfterDoc.exists) {
        throw new Error('Document de pagination non trouvé');
      }
    }

    const result = await getEncryptedDataAccessLogs(
      targetStructureId,
      userId,
      limit,
      startAfterDoc
    );

    return {
      success: true,
      logs: result.logs.map(log => ({
        ...log,
        timestamp: log.timestamp.toDate().toISOString()
      })),
      lastDocId: result.lastDoc?.id
    };
  } catch (error: any) {
    console.error('[getEncryptedDataAccessLogsFunction] Erreur:', error);
    throw new Error(error.message || 'Erreur lors de la récupération des logs');
  }
});
