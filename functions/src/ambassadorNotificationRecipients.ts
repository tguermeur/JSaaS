import * as admin from 'firebase-admin';

const STRUCTURE_STATUSES = ['admin', 'admin_structure', 'membre', 'member', 'superadmin'];

async function userHasAmbassadorsRead(
  structureId: string,
  userId: string,
  userData: FirebaseFirestore.DocumentData
): Promise<boolean> {
  if (
    userData.status === 'superadmin' ||
    userData.status === 'admin' ||
    userData.status === 'admin_structure' ||
    userData.role === 'admin' ||
    userData.role === 'superadmin'
  ) {
    return true;
  }

  const permDoc = await admin
    .firestore()
    .doc(`structures/${structureId}/permissions/ambassadors_read`)
    .get();

  if (!permDoc.exists) {
    return true;
  }

  const allowedMembers: string[] = permDoc.data()?.allowedMembers || [];
  if (allowedMembers.length === 0) {
    return true;
  }

  return allowedMembers.includes(userId);
}

export async function getStructureStaffUserIds(
  structureId: string,
  excludeUserId?: string
): Promise<string[]> {
  if (!structureId) return [];

  const snap = await admin
    .firestore()
    .collection('users')
    .where('structureId', '==', structureId)
    .where('status', 'in', STRUCTURE_STATUSES)
    .get();

  const ids: string[] = [];
  for (const userDoc of snap.docs) {
    if (excludeUserId && userDoc.id === excludeUserId) continue;
    const hasAccess = await userHasAmbassadorsRead(structureId, userDoc.id, userDoc.data());
    if (hasAccess) {
      ids.push(userDoc.id);
    }
  }
  return ids;
}

export async function getEnterpriseContactUserIds(
  companyId: string,
  excludeUserId?: string
): Promise<string[]> {
  if (!companyId) return [];

  const usersSnap = await admin
    .firestore()
    .collection('users')
    .where('companyId', '==', companyId)
    .where('status', '==', 'entreprise')
    .get();

  const ids: string[] = [];
  for (const userDoc of usersSnap.docs) {
    if (excludeUserId && userDoc.id === excludeUserId) continue;

    const contactsSnap = await admin
      .firestore()
      .collection('contacts')
      .where('userId', '==', userDoc.id)
      .limit(1)
      .get();

    if (contactsSnap.empty) continue;

    const contactId = contactsSnap.docs[0].id;
    const accessDoc = await admin.firestore().doc(`contactAccess/${contactId}`).get();
    if (accessDoc.exists && accessDoc.data()?.canViewEvents === true) {
      ids.push(userDoc.id);
    }
  }

  return ids;
}

export async function resolveActorDisplayName(userId: string): Promise<string> {
  if (!userId) return 'Un utilisateur';

  const userDoc = await admin.firestore().doc(`users/${userId}`).get();
  if (!userDoc.exists) return 'Un utilisateur';

  const data = userDoc.data() || {};
  const displayName = (data.displayName || data.firstName || '').toString().trim();
  if (displayName) return displayName;

  const email = (data.email || '').toString().trim();
  if (email) return email.split('@')[0];

  return 'Un utilisateur';
}

export async function resolveCompanyName(companyId: string): Promise<string> {
  if (!companyId) return 'Une entreprise';

  const companyDoc = await admin.firestore().doc(`companies/${companyId}`).get();
  if (!companyDoc.exists) return 'Une entreprise';

  const name = (companyDoc.data()?.name || companyDoc.data()?.companyName || '').toString().trim();
  return name || 'Une entreprise';
}
