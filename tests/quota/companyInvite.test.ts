/**
 * Tests unitaires inviteCompanyContact / linkCompanyContactAfterRegister.
 * Lancer via : npm run test:quota
 */
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

vi.mock('../../functions/src/notifications/sendEmail', () => ({
  EMAILJS_GENERIC_SECRETS: [],
  sendTemplatedEmail: vi.fn(async () => ({ ok: true, skipped: null })),
}));

vi.mock('../../functions/src/notifications/core', async () => {
  const actual = await vi.importActual<typeof import('../../functions/src/notifications/core')>(
    '../../functions/src/notifications/core'
  );
  return {
    ...actual,
    getAppBaseUrl: () => 'https://app.test',
  };
});

const PROJECT_ID = 'demo-jsaas-quota';
const STRUCTURE_A = 'structure-invite-a';
const STRUCTURE_B = 'structure-invite-b';
const COMPANY_A = 'company-invite-a';
const COMPANY_B = 'company-invite-b';
const ADMIN_A = 'admin-invite-a';
const ADMIN_B = 'admin-invite-b';
const INVITEE = 'invitee-link-uid';

let app: ReturnType<typeof initializeApp>;
let db: Firestore;

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  }
  app = getApps().length ? getApps()[0]! : initializeApp({ projectId: PROJECT_ID });
  db = getFirestore(app);
});

afterAll(async () => {
  if (app) {
    await deleteApp(app).catch(() => undefined);
  }
});

beforeEach(async () => {
  await db.doc(`users/${ADMIN_A}`).set({
    structureId: STRUCTURE_A,
    status: 'admin',
    email: 'admin-a@test.com',
  });
  await db.doc(`users/${ADMIN_B}`).set({
    structureId: STRUCTURE_B,
    status: 'admin',
    email: 'admin-b@test.com',
  });
  await db.doc(`companies/${COMPANY_A}`).set({
    structureId: STRUCTURE_A,
    name: 'Company Invite A',
  });
  await db.doc(`companies/${COMPANY_B}`).set({
    structureId: STRUCTURE_B,
    name: 'Company Invite B',
  });
  await db.doc(`contacts/contact-match`).set({
    email: 'contact@test.com',
    companyId: COMPANY_A,
    structureId: STRUCTURE_A,
    firstName: 'C',
    lastName: 'T',
  });
});

describe('inviteCompanyContact', () => {
  it('rejette si l’appelant ne gère pas la companyId', async () => {
    const { runInviteCompanyContact } = await import(
      '../../functions/src/notifications/companyInvite'
    );
    await expect(
      runInviteCompanyContact(ADMIN_B, {
        email: 'x@test.com',
        companyId: COMPANY_A,
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('réussit si admin de la bonne structure', async () => {
    const { runInviteCompanyContact } = await import(
      '../../functions/src/notifications/companyInvite'
    );
    const { sendTemplatedEmail } = await import('../../functions/src/notifications/sendEmail');

    const result = await runInviteCompanyContact(ADMIN_A, {
      email: 'New.Contact@Test.com',
      companyId: COMPANY_A,
    });

    expect(result.success).toBe(true);
    expect(result.inviteToken).toMatch(/^[a-f0-9]{48}$/);
    expect(result.emailOk).toBe(true);

    const inviteSnap = await db.collection('companyInvites').doc(result.inviteToken).get();
    expect(inviteSnap.exists).toBe(true);
    const invite = inviteSnap.data()!;
    expect(invite.email).toBe('new.contact@test.com');
    expect(invite.companyId).toBe(COMPANY_A);
    expect(invite.structureId).toBe(STRUCTURE_A);
    expect(invite.status).toBe('pending');
    expect(invite.createdBy).toBe(ADMIN_A);
    expect(sendTemplatedEmail).toHaveBeenCalled();
  });
});

describe('linkCompanyContactAfterRegister', () => {
  it('no-op si invite non accepted / mauvais uid', async () => {
    const { runLinkCompanyContactAfterRegister } = await import(
      '../../functions/src/notifications/companyInvite'
    );
    const token = 'token-pending-link';
    await db.collection('companyInvites').doc(token).set({
      email: 'contact@test.com',
      companyId: COMPANY_A,
      status: 'pending',
      acceptedBy: null,
    });

    const r1 = await runLinkCompanyContactAfterRegister(INVITEE, { inviteToken: token });
    expect(r1.linked).toBe(false);

    await db.collection('companyInvites').doc(token).update({
      status: 'accepted',
      acceptedBy: 'other-uid',
    });
    const r2 = await runLinkCompanyContactAfterRegister(INVITEE, { inviteToken: token });
    expect(r2.linked).toBe(false);

    const contact = await db.doc('contacts/contact-match').get();
    expect(contact.data()?.userId).toBeUndefined();
  });

  it('met à jour userId si contact email+companyId match', async () => {
    const { runLinkCompanyContactAfterRegister } = await import(
      '../../functions/src/notifications/companyInvite'
    );
    const token = 'token-accepted-link';
    await db.collection('companyInvites').doc(token).set({
      email: 'contact@test.com',
      companyId: COMPANY_A,
      status: 'accepted',
      acceptedBy: INVITEE,
    });

    const result = await runLinkCompanyContactAfterRegister(INVITEE, { inviteToken: token });
    expect(result.linked).toBe(true);

    const contact = await db.doc('contacts/contact-match').get();
    expect(contact.data()?.userId).toBe(INVITEE);
  });

  it('no-op (log) si aucun contact trouvé', async () => {
    const { runLinkCompanyContactAfterRegister } = await import(
      '../../functions/src/notifications/companyInvite'
    );
    const token = 'token-no-contact';
    await db.collection('companyInvites').doc(token).set({
      email: 'nobody@test.com',
      companyId: COMPANY_A,
      status: 'accepted',
      acceptedBy: INVITEE,
    });

    const result = await runLinkCompanyContactAfterRegister(INVITEE, { inviteToken: token });
    expect(result.linked).toBe(false);
  });
});
