import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import { getAppBaseUrl } from './core';
import { EMAILJS_GENERIC_SECRETS, sendTemplatedEmail } from './sendEmail';
import { assertCanManageStructure } from '../authHelpers';

const callConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 60,
  region: 'us-central1' as const,
  maxInstances: 5,
  secrets: [...EMAILJS_GENERIC_SECRETS],
};

export type InviteCompanyContactInput = {
  email?: string;
  companyId?: string;
};

export type LinkCompanyContactInput = {
  inviteToken?: string;
};

/**
 * Core logic for inviteCompanyContact (exported for unit tests).
 */
export async function runInviteCompanyContact(
  uid: string,
  data: InviteCompanyContactInput
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

  const companyId = (data.companyId || '').trim();
  if (!companyId) {
    throw new HttpsError('invalid-argument', 'companyId requis.');
  }

  const fs = admin.firestore();
  const companySnap = await fs.collection('companies').doc(companyId).get();
  if (!companySnap.exists) {
    throw new HttpsError('not-found', 'Entreprise introuvable.');
  }

  const company = companySnap.data() || {};
  const structureId = (company.structureId as string | undefined) || '';
  if (!structureId) {
    throw new HttpsError('failed-precondition', 'Entreprise sans structure associée.');
  }

  await assertCanManageStructure(uid, structureId);

  const companyName = (company.name || company.nom || 'votre entreprise').toString();
  const token = randomBytes(24).toString('hex');

  await fs.collection('companyInvites').doc(token).set({
    email: normalizedEmail,
    companyId,
    companyName,
    structureId,
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    status: 'pending',
  });

  const inviteLink = `${getAppBaseUrl()}/register?type=company&invite=${token}&company=${companyId}`;

  const result = await sendTemplatedEmail({
    templateKey: 'COMPANY_CONTACT_INVITE',
    toEmail: normalizedEmail,
    subject: `Invitation espace entreprise — ${companyName} — JS Connect`,
    templateParams: {
      company_name: companyName,
      structure_name: companyName,
      invite_link: inviteLink,
    },
    linkFields: ['invite_link'],
    structureId,
    sentByUserId: uid,
    logType: 'company_contact_invite',
  });

  return {
    success: true,
    inviteToken: token,
    emailSkipped: result.skipped || null,
    emailOk: result.ok,
  };
}

/**
 * Core logic for linkCompanyContactAfterRegister (exported for unit tests).
 * Silent no-op when invite is invalid or no matching contact.
 */
export async function runLinkCompanyContactAfterRegister(
  uid: string,
  data: LinkCompanyContactInput
): Promise<{ linked: boolean }> {
  const inviteToken = (data.inviteToken || '').trim();
  if (!inviteToken) {
    return { linked: false };
  }

  const fs = admin.firestore();
  const inviteSnap = await fs.collection('companyInvites').doc(inviteToken).get();
  if (!inviteSnap.exists) {
    console.log('[linkCompanyContactAfterRegister] invite introuvable', inviteToken);
    return { linked: false };
  }

  const invite = inviteSnap.data() || {};
  if (invite.status !== 'accepted' || invite.acceptedBy !== uid) {
    console.log('[linkCompanyContactAfterRegister] invite non acceptée par cet uid');
    return { linked: false };
  }

  const email = String(invite.email || '')
    .trim()
    .toLowerCase();
  const companyId = String(invite.companyId || '').trim();
  if (!email || !companyId) {
    console.log('[linkCompanyContactAfterRegister] invite sans email/companyId');
    return { linked: false };
  }

  const contactsSnap = await fs
    .collection('contacts')
    .where('email', '==', email)
    .where('companyId', '==', companyId)
    .limit(1)
    .get();

  if (contactsSnap.empty) {
    console.log(
      '[linkCompanyContactAfterRegister] aucun contact CRM pour',
      email,
      companyId
    );
    return { linked: false };
  }

  const contactRef = contactsSnap.docs[0]!.ref;
  await contactRef.update({ userId: uid });
  return { linked: true };
}

/**
 * Invite a company contact by email to join the company portal.
 */
export const inviteCompanyContact = onCall(callConfig, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentification requise.');
  }
  return runInviteCompanyContact(request.auth.uid, (request.data || {}) as InviteCompanyContactInput);
});

/**
 * After registration: link CRM contact.userId if matching email+companyId.
 */
export const linkCompanyContactAfterRegister = onCall(callConfig, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentification requise.');
  }
  return runLinkCompanyContactAfterRegister(
    request.auth.uid,
    (request.data || {}) as LinkCompanyContactInput
  );
});
