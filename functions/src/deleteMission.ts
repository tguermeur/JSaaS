import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getCallerUser, isSuperAdminUser } from './authHelpers';

type PagePermission = {
  allowedRoles?: string[];
  allowedPoles?: string[];
  allowedMembers?: string[];
};

async function assertCanDeleteMission(uid: string, structureId: string): Promise<void> {
  const user = await getCallerUser(uid);
  if (!user) {
    throw new HttpsError('permission-denied', 'Utilisateur introuvable.');
  }
  if (isSuperAdminUser(user)) return;
  if (user.structureId !== structureId) {
    throw new HttpsError('permission-denied', 'Structure non autorisée.');
  }
  if (user.status === 'admin' || user.role === 'admin' || user.role === 'superadmin') {
    return;
  }

  const permSnap = await admin
    .firestore()
    .collection('structures')
    .doc(structureId)
    .collection('permissions')
    .doc('mission')
    .get();
  const perm = permSnap.data() as PagePermission | undefined;
  const status = user.status === 'member' ? 'membre' : (user.status ?? user.role ?? '');
  const userPoles: string[] = Array.isArray(user.poles)
    ? user.poles
        .map((p: { poleId?: string }) => p.poleId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];

  if (perm?.allowedRoles?.includes(status)) return;
  if (perm?.allowedMembers?.includes(uid)) return;
  if (userPoles.some((poleId) => perm?.allowedPoles?.includes(poleId))) return;

  throw new HttpsError('permission-denied', 'Permissions mission insuffisantes pour supprimer.');
}

async function deleteQueryBatch(
  query: FirebaseFirestore.Query,
  batchSize = 400
): Promise<void> {
  const snap = await query.limit(batchSize).get();
  if (snap.empty) return;
  const batch = admin.firestore().batch();
  snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
  if (snap.size >= batchSize) {
    await deleteQueryBatch(query, batchSize);
  }
}

async function safeDeleteStoragePath(fileRefOrUrl: string): Promise<void> {
  if (!fileRefOrUrl?.trim()) return;
  try {
    const bucket = admin.storage().bucket();
    const filePath = fileRefOrUrl.includes('://')
      ? decodeURIComponent(fileRefOrUrl.split('/o/')[1]?.split('?')[0] ?? '')
      : fileRefOrUrl;
    if (!filePath) return;
    await bucket.file(filePath).delete({ ignoreNotFound: true });
  } catch {
    // Ignorer : fichier absent ou accès storage non critique
  }
}

export const deleteMissionCascade = onCall(
  { region: 'us-central1', timeoutSeconds: 540 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentification requise.');
    }

    const missionId = request.data?.missionId as string | undefined;
    if (!missionId?.trim()) {
      throw new HttpsError('invalid-argument', 'missionId requis.');
    }

    const db = admin.firestore();
    const missionRef = db.collection('missions').doc(missionId);
    const missionSnap = await missionRef.get();
    if (!missionSnap.exists) {
      throw new HttpsError('not-found', 'Mission introuvable.');
    }

    const mission = missionSnap.data()!;
    if (mission.isArchived) {
      throw new HttpsError('failed-precondition', 'Impossible de supprimer une mission archivée.');
    }

    const structureId = mission.structureId as string | undefined;
    if (!structureId) {
      throw new HttpsError('failed-precondition', 'Structure de la mission manquante.');
    }

    await assertCanDeleteMission(uid, structureId);

    // Événement ambassadeur source (réaffectation des candidatures)
    let originalEventId: string | null = null;
    let isConvertedFromAmbassadorEvent = false;

    const ambassadorSnap = await db
      .collection('missions')
      .where('type', '==', 'ambassadeur_event')
      .where('structureId', '==', structureId)
      .get();

    for (const eventDoc of ambassadorSnap.docs) {
      if (eventDoc.data().convertedMissionId === missionId) {
        isConvertedFromAmbassadorEvent = true;
        originalEventId = eventDoc.id;
        break;
      }
    }

    if (!isConvertedFromAmbassadorEvent && mission.title) {
      for (const eventDoc of ambassadorSnap.docs) {
        const eventData = eventDoc.data();
        const eventTitle = eventData.title || eventData.campaignName;
        if (eventTitle === mission.title && eventData.type === 'ambassadeur_event') {
          isConvertedFromAmbassadorEvent = true;
          originalEventId = eventDoc.id;
          break;
        }
      }
    }

    const applicationsSnap = await db
      .collection('applications')
      .where('missionId', '==', missionId)
      .get();

    for (const appDoc of applicationsSnap.docs) {
      const whSnap = await db
        .collection('workingHours')
        .where('applicationId', '==', appDoc.id)
        .get();
      if (!whSnap.empty) {
        const batch = db.batch();
        whSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }

    const generatedSnap = await db
      .collection('generatedDocuments')
      .where('missionId', '==', missionId)
      .get();
    for (const docSnap of generatedSnap.docs) {
      const data = docSnap.data();
      if (data.fileUrl) await safeDeleteStoragePath(data.fileUrl);
    }

    const subGenSnap = await missionRef.collection('generatedDocuments').get();
    for (const subDoc of subGenSnap.docs) {
      const data = subDoc.data();
      if (data.fileUrl) await safeDeleteStoragePath(data.fileUrl);
    }

    const expenseSnap = await db
      .collection('expenseNotes')
      .where('missionId', '==', missionId)
      .get();
    for (const expenseDoc of expenseSnap.docs) {
      const data = expenseDoc.data();
      if (data.attachmentUrl) await safeDeleteStoragePath(data.attachmentUrl);
    }

    if (isConvertedFromAmbassadorEvent && originalEventId) {
      const batch = db.batch();
      applicationsSnap.docs.forEach((appDoc) => {
        batch.update(appDoc.ref, {
          missionId: originalEventId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      if (!applicationsSnap.empty) await batch.commit();
    } else {
      const batch = db.batch();
      applicationsSnap.docs.forEach((appDoc) => batch.delete(appDoc.ref));
      if (!applicationsSnap.empty) await batch.commit();
    }

    await deleteQueryBatch(db.collection('generatedDocuments').where('missionId', '==', missionId));
    await deleteQueryBatch(missionRef.collection('generatedDocuments'));
    await deleteQueryBatch(db.collection('notes').where('missionId', '==', missionId));
    await deleteQueryBatch(db.collection('expenseNotes').where('missionId', '==', missionId));
    await deleteQueryBatch(db.collection('amendments').where('missionId', '==', missionId));

    await missionRef.delete();

    return { success: true, missionId };
  }
);
