import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

export async function getCallerUser(uid: string): Promise<FirebaseFirestore.DocumentData | null> {
  const snap = await admin.firestore().collection('users').doc(uid).get();
  return snap.exists ? snap.data()! : null;
}

export function isSuperAdminUser(user: FirebaseFirestore.DocumentData | null): boolean {
  if (!user) return false;
  return user.status === 'superadmin' || user.role === 'superadmin';
}

export async function assertSuperAdmin(uid: string): Promise<void> {
  const user = await getCallerUser(uid);
  if (!isSuperAdminUser(user)) {
    throw new functions.https.HttpsError('permission-denied', 'Accès réservé au superadmin.');
  }
}

/** Admin structure ou admin legacy pour une structure donnée */
type PermissionDoc = {
  allowedRoles?: string[];
  allowedPoles?: string[];
  allowedMembers?: string[];
};

function checkStructurePermission(
  perm: PermissionDoc | null | undefined,
  effectiveStatus: string,
  userPoleIds: string[],
  userId: string
): boolean {
  if (!perm) return false;
  const roleOk =
    !!perm.allowedRoles &&
    ((Array.isArray(perm.allowedRoles) && perm.allowedRoles.includes(effectiveStatus)) ||
      (effectiveStatus === 'membre' && perm.allowedRoles.includes('member')) ||
      (effectiveStatus === 'member' && perm.allowedRoles.includes('membre')));
  const poleOk =
    !!perm.allowedPoles &&
    userPoleIds.length > 0 &&
    Array.isArray(perm.allowedPoles) &&
    perm.allowedPoles.some((p) => userPoleIds.includes(p));
  const memberOk =
    !!perm.allowedMembers &&
    Array.isArray(perm.allowedMembers) &&
    perm.allowedMembers.includes(userId);
  return !!(roleOk || poleOk || memberOk);
}

/** Lecture RH (page rh / rh_read) pour consulter les dossiers d'un autre membre de la structure. */
export async function userHasRHReadAccess(callerId: string, targetUserId: string): Promise<boolean> {
  if (callerId === targetUserId) return true;

  const db = admin.firestore();
  const [callerSnap, targetSnap] = await Promise.all([
    db.collection('users').doc(callerId).get(),
    db.collection('users').doc(targetUserId).get(),
  ]);
  if (!callerSnap.exists || !targetSnap.exists) return false;

  const caller = callerSnap.data()!;
  const target = targetSnap.data()!;
  const targetStructureId = target.structureId as string | undefined;
  if (!targetStructureId || caller.structureId !== targetStructureId) return false;

  if (isSuperAdminUser(caller)) return true;

  const callerStatus = (caller.status ?? caller.role ?? '') as string;
  if (callerStatus === 'admin' || callerStatus === 'admin_structure') return true;

  const [rhPerm, rhReadPerm] = await Promise.all([
    db.doc(`structures/${targetStructureId}/permissions/rh`).get(),
    db.doc(`structures/${targetStructureId}/permissions/rh_read`).get(),
  ]);

  const userPoleIds = Array.isArray(caller.poleIds)
    ? (caller.poleIds as string[])
    : Array.isArray((caller as { poles?: { poleId?: string }[] }).poles)
      ? ((caller as { poles?: { poleId?: string }[] }).poles ?? [])
          .map((p) => p?.poleId)
          .filter((id): id is string => !!id)
      : [];

  return (
    checkStructurePermission(rhPerm.exists ? (rhPerm.data() as PermissionDoc) : null, callerStatus, userPoleIds, callerId) ||
    checkStructurePermission(
      rhReadPerm.exists ? (rhReadPerm.data() as PermissionDoc) : null,
      callerStatus,
      userPoleIds,
      callerId
    )
  );
}

export async function assertCanManageStructure(
  uid: string,
  structureId: string
): Promise<void> {
  const user = await getCallerUser(uid);
  if (!user) {
    throw new functions.https.HttpsError('permission-denied', 'Utilisateur introuvable.');
  }
  if (isSuperAdminUser(user)) return;
  if (user.structureId !== structureId) {
    throw new functions.https.HttpsError('permission-denied', 'Structure non autorisée.');
  }
  const status = user.status ?? user.role;
  if (status === 'admin' || status === 'admin_structure') return;
  if (['membre', 'member'].includes(status)) {
    const permSnap = await admin
      .firestore()
      .collection('structures')
      .doc(structureId)
      .collection('permissions')
      .doc('commercial')
      .get();
    const perm = permSnap.data();
    if (perm?.allowedMembers?.includes(uid)) return;
    if (perm?.allowedRoles?.includes(status)) return;
  }
  throw new functions.https.HttpsError('permission-denied', 'Permissions insuffisantes.');
}

const CONTACT_RATE_LIMIT_MS = 60_000;
const CONTACT_RATE_MAX = 3;

/** Limite simple anti-spam pour le formulaire de contact public */
export async function assertContactRateLimit(email: string): Promise<void> {
  const key = email.toLowerCase().trim().slice(0, 200);
  const ref = admin.firestore().collection('contactRateLimits').doc(key);
  const now = Date.now();
  await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const windowStart = (data?.windowStart as number) ?? now;
    let count = (data?.count as number) ?? 0;
    if (now - windowStart > CONTACT_RATE_LIMIT_MS) {
      tx.set(ref, { windowStart: now, count: 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return;
    }
    if (count >= CONTACT_RATE_MAX) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Trop de demandes. Réessayez dans une minute.'
      );
    }
    tx.set(ref, {
      windowStart,
      count: count + 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}
