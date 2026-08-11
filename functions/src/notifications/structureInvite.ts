import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import { getAppBaseUrl } from './core';
import { EMAILJS_GENERIC_SECRETS, sendTemplatedEmail } from './sendEmail';
import { sendWelcomeEmail } from './billingNotifications';

const callConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 60,
  region: 'us-central1' as const,
  maxInstances: 5,
  secrets: [...EMAILJS_GENERIC_SECRETS],
};

export type InviteStructureMemberInput = {
  email?: string;
  role?: string;
  /** Si omis : structure du caller (comportement historique). */
  structureId?: string;
};

/**
 * Core logic for inviteStructureMember (exported for unit tests / bulk-import).
 */
export async function runInviteStructureMember(
  uid: string,
  data: InviteStructureMemberInput
): Promise<{
  success: true;
  inviteToken: string;
  emailSkipped: string | null;
  emailOk: boolean;
}> {
  const normalizedEmail = (data.email || '').trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new HttpsError('invalid-argument', 'email invalide.');
  }

  const fs = admin.firestore();
  const callerSnap = await fs.collection('users').doc(uid).get();
  const caller = callerSnap.data() || {};
  const callerStructureId = caller.structureId as string | undefined;
  const callerStatus = (caller.status || caller.role || '').toString();
  const isSuperAdmin = callerStatus === 'superadmin';

  const requestedStructureId = (data.structureId || '').trim();
  const structureId = requestedStructureId || callerStructureId;

  if (!structureId) {
    throw new HttpsError('failed-precondition', 'Aucune structure associée.');
  }

  if (
    requestedStructureId &&
    !isSuperAdmin &&
    callerStructureId !== requestedStructureId
  ) {
    throw new HttpsError('permission-denied', 'Structure non autorisée.');
  }

  const isAdmin = ['admin', 'admin_structure', 'superadmin'].includes(callerStatus);
  if (!isAdmin) {
    // Allow RH permission holders on the target structure
    const rhPerm = await fs.doc(`structures/${structureId}/permissions/rh`).get();
    const perm = rhPerm.exists ? rhPerm.data() : null;
    const allowed =
      perm &&
      ((Array.isArray(perm.allowedMembers) && perm.allowedMembers.includes(uid)) ||
        (Array.isArray(perm.allowedRoles) && perm.allowedRoles.includes(callerStatus)));
    if (!allowed) {
      throw new HttpsError('permission-denied', 'Permission RH requise.');
    }
  }

  const structureSnap = await fs.doc(`structures/${structureId}`).get();
  const structureName = (
    structureSnap.data()?.name ||
    structureSnap.data()?.nom ||
    'votre structure'
  ).toString();

  const token = randomBytes(24).toString('hex');
  const inviteRef = fs.collection('structureInvites').doc(token);
  await inviteRef.set({
    email: normalizedEmail,
    structureId,
    structureName,
    role: data.role || 'membre',
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    status: 'pending',
  });

  const inviteLink = `${getAppBaseUrl()}/register?type=student&invite=${token}&structure=${structureId}`;

  const result = await sendTemplatedEmail({
    templateKey: 'MEMBER_INVITE',
    toEmail: normalizedEmail,
    subject: `Invitation à rejoindre ${structureName} — JS Connect`,
    templateParams: {
      structure_name: structureName,
      invite_link: inviteLink,
    },
    linkFields: ['invite_link'],
    structureId,
    sentByUserId: uid,
    logType: 'member_invite',
  });

  return {
    success: true,
    inviteToken: token,
    emailSkipped: result.skipped || null,
    emailOk: result.ok,
  };
}

/**
 * RH: invite a member by email to join the caller's structure.
 */
export const inviteStructureMember = onCall(callConfig, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentification requise.');
  }
  return runInviteStructureMember(
    request.auth.uid,
    (request.data || {}) as InviteStructureMemberInput
  );
});

/**
 * Send welcome email after registration (callable from client).
 */
export const sendWelcomeEmailCallable = onCall(callConfig, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentification requise.');
  }
  const { firstName } = (request.data || {}) as { firstName?: string };
  // Only allow sending for self
  await sendWelcomeEmail(request.auth.uid, firstName);
  return { success: true };
});
