/**
 * Tests listMySignatureRequestsAsCompanyContact — filtre email signataire.
 * Lancer via : npm run test:quota
 */
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

vi.mock('../../functions/src/signatures/storagePdf', () => ({
  getStoragePdfForClient: vi.fn(async (path: string) => ({
    pdfUrl: `https://signed.test/${encodeURIComponent(path)}`,
    pdfBase64: null,
  })),
}));

const PROJECT_ID = 'demo-jsaas-quota';
const STRUCTURE_ID = 'structure-sig-contact';
const COMPANY_ID = 'company-sig-contact';
const CONTACT_UID = 'contact-sig-a';
const CONTACT_EMAIL = 'contact.a@example.com';
const OTHER_EMAIL = 'other.contact@example.com';

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
  await db.doc(`users/${CONTACT_UID}`).set({
    status: 'entreprise',
    companyId: COMPANY_ID,
    email: CONTACT_EMAIL,
  });
  await db.doc(`companies/${COMPANY_ID}`).set({
    structureId: STRUCTURE_ID,
    name: 'Company Sig',
  });
  await db.collection('signatureRequests').doc('sig-for-me').set({
    structureId: STRUCTURE_ID,
    status: 'pending',
    document: { title: 'Convention A' },
    signers: [
      { id: 's1', email: CONTACT_EMAIL, name: 'Me', status: 'pending', order: 0 },
    ],
  });
  await db.collection('signatureRequests').doc('sig-for-other').set({
    structureId: STRUCTURE_ID,
    status: 'completed',
    document: { title: 'Convention B (autre contact)' },
    sealed: { storagePath: `structures/${STRUCTURE_ID}/signatures/sig-for-other/sealed.pdf` },
    signers: [
      { id: 's2', email: OTHER_EMAIL, name: 'Other', status: 'signed', order: 0 },
    ],
  });
  await db.collection('signatureRequests').doc('sig-completed-me').set({
    structureId: STRUCTURE_ID,
    status: 'completed',
    document: { title: 'Convention C' },
    sealed: { storagePath: `structures/${STRUCTURE_ID}/signatures/sig-completed-me/sealed.pdf` },
    signers: [
      { id: 's3', email: CONTACT_EMAIL, name: 'Me', status: 'signed', order: 0 },
    ],
  });
});

describe('listMySignatureRequestsAsCompanyContact', () => {
  it('ne renvoie pas une demande destinée à un autre email (même structureId)', async () => {
    const { runListMySignatureRequestsAsCompanyContact } = await import(
      '../../functions/src/signatures/companyContactList'
    );

    const { requests } = await runListMySignatureRequestsAsCompanyContact(
      CONTACT_UID,
      CONTACT_EMAIL
    );

    const ids = requests.map((r) => r.id);
    expect(ids).toContain('sig-for-me');
    expect(ids).toContain('sig-completed-me');
    expect(ids).not.toContain('sig-for-other');

    const other = requests.find((r) => r.id === 'sig-for-other');
    expect(other).toBeUndefined();

    for (const r of requests) {
      expect(r).not.toHaveProperty('signers');
      expect(Object.keys(r).sort()).toEqual(
        ['documentTitle', 'id', 'mySignerStatus', 'sealedUrl', 'status'].sort()
      );
    }

    const completed = requests.find((r) => r.id === 'sig-completed-me');
    expect(completed?.sealedUrl).toBeTruthy();
    expect(completed?.mySignerStatus).toBe('signed');
  });

  it('permission-denied si pas entreprise / companyId', async () => {
    const { runListMySignatureRequestsAsCompanyContact } = await import(
      '../../functions/src/signatures/companyContactList'
    );
    await db.doc(`users/${CONTACT_UID}`).set({
      status: 'admin',
      structureId: STRUCTURE_ID,
      email: CONTACT_EMAIL,
    });
    await expect(
      runListMySignatureRequestsAsCompanyContact(CONTACT_UID, CONTACT_EMAIL)
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
