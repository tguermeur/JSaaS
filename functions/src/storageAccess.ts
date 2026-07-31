/**
 * Vérification d'accès Storage côté Cloud Functions (alignée sur storage.rules).
 */
import * as admin from 'firebase-admin';
import { userHasRHReadAccess } from './authHelpers';

const CV_READER_STATUSES = ['admin', 'admin_structure', 'member', 'membre'];
const PROFILE_READER_STATUSES = ['admin', 'admin_structure', 'member', 'membre'];

async function targetUserSharesStructure(
  requester: FirebaseFirestore.DocumentData,
  targetUserId: string,
  staffStatuses: string[]
): Promise<boolean> {
  if (!requester.structureId) return false;
  const status = (requester.status ?? requester.role ?? '') as string;
  if (!staffStatuses.includes(status)) return false;

  const targetSnap = await admin.firestore().collection('users').doc(targetUserId).get();
  if (!targetSnap.exists) return false;
  const target = targetSnap.data()!;
  return target.structureId === requester.structureId;
}

/** Extrait l'userId propriétaire pour cvs/, documents/, profilePictures/. */
function extractPersonalFileOwnerId(filePath: string): string | null {
  const m = /^(?:cvs|documents|profilePictures)\/([^/]+)/.exec(filePath);
  return m ? m[1] : null;
}

export async function userCanAccessStoragePath(uid: string, filePath: string): Promise<boolean> {
  const userSnap = await admin.firestore().collection('users').doc(uid).get();
  if (!userSnap.exists) return false;
  const user = userSnap.data()!;
  const db = admin.firestore();

  if (user.status === 'superadmin' || user.role === 'superadmin') return true;

  // Fichiers personnels (propriétaire)
  if (filePath.startsWith(`documents/${uid}/`) || filePath.startsWith(`cvs/${uid}/`)) return true;
  if (filePath.startsWith(`profilePictures/${uid}`)) return true;
  if (filePath.startsWith(`error-reports/${uid}/`)) return true;
  if (filePath.startsWith(`expenses/${uid}/`)) return true;

  const ownerId = extractPersonalFileOwnerId(filePath);
  if (ownerId && ownerId !== uid) {
    if (filePath.startsWith(`cvs/${ownerId}/`)) {
      if (await targetUserSharesStructure(user, ownerId, CV_READER_STATUSES)) return true;
      if (await userHasRHReadAccess(uid, ownerId)) return true;
    }
    if (filePath.startsWith(`profilePictures/${ownerId}`)) {
      if (await targetUserSharesStructure(user, ownerId, PROFILE_READER_STATUSES)) return true;
      if (await userHasRHReadAccess(uid, ownerId)) return true;
    }
    if (filePath.startsWith(`documents/${ownerId}/`)) {
      if (await userHasRHReadAccess(uid, ownerId)) return true;
    }
  }

  // Structure
  const structureMatch = /^structures\/([^/]+)\//.exec(filePath);
  if (structureMatch) {
    const structureId = structureMatch[1];
    if (user.structureId === structureId) {
      const memberStatuses = ['admin', 'admin_structure', 'member', 'membre', 'etudiant'];
      if (memberStatuses.includes(user.status ?? '')) return true;
    }
    return false;
  }

  // Missions
  const missionMatch = /^missions\/([^/]+)\//.exec(filePath);
  if (missionMatch) {
    const missionId = missionMatch[1];
    const missionSnap = await db.collection('missions').doc(missionId).get();
    if (!missionSnap.exists) return false;
    const mission = missionSnap.data()!;
    if (mission.chargeId === uid) return true;
    if (user.structureId && mission.structureId === user.structureId) {
      if (['admin', 'admin_structure', 'membre', 'member'].includes(user.status ?? '')) return true;
    }
    if (user.status === 'entreprise' && user.companyId && mission.companyId === user.companyId) return true;
    return false;
  }

  // Contrats trésorerie
  const contractMatch = /^contracts\/([^/]+)\//.exec(filePath);
  if (contractMatch) {
    const contractSnap = await db.collection('contracts').doc(contractMatch[1]).get();
    if (!contractSnap.exists) return false;
    return user.structureId === contractSnap.data()?.structureId;
  }

  // Prospects
  const prospectMatch = /^prospects\/([^/]+)\//.exec(filePath);
  if (prospectMatch) {
    const prospectSnap = await db.collection('prospects').doc(prospectMatch[1]).get();
    if (!prospectSnap.exists) return false;
    return user.structureId === prospectSnap.data()?.structureId;
  }

  // Logos entreprise
  const companyLogoMatch = /^company-logos\/([^/]+)\//.exec(filePath);
  if (companyLogoMatch) {
    const companyId = companyLogoMatch[1];
    const companySnap = await db.collection('companies').doc(companyId).get();
    if (!companySnap.exists) return false;
    const company = companySnap.data()!;
    if (user.status === 'entreprise' && user.companyId === companyId) return true;
    if (user.structureId && user.structureId === company.structureId) {
      return ['admin', 'admin_structure', 'member', 'membre'].includes(user.status ?? '');
    }
    return false;
  }

  // Documents entreprise
  const companyMatch = /^companies\/([^/]+)\//.exec(filePath);
  if (companyMatch) {
    const companySnap = await db.collection('companies').doc(companyMatch[1]).get();
    if (!companySnap.exists) return false;
    return user.structureId === companySnap.data()?.structureId;
  }

  return false;
}

export async function assertUserCanAccessStoragePath(uid: string, filePath: string): Promise<void> {
  const allowed = await userCanAccessStoragePath(uid, filePath);
  if (!allowed) {
    throw new Error('Accès refusé à ce fichier');
  }
}
