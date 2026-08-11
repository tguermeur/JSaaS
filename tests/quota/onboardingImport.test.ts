/**
 * Tests unitaires runOnboardingBulkImport.
 * Lancer via : npm run test:quota
 */
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { billingCurrentRef } from '../../functions/src/quotaHelpers';

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
const STRUCTURE_A = 'structure-onboard-a';
const STRUCTURE_B = 'structure-onboard-b';
const ADMIN_A = 'admin-onboard-a';
const ADMIN_B = 'admin-onboard-b';
const MEMBER_A = 'member-onboard-a';

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

async function seedBilling(structureId: string, overrides: Record<string, unknown> = {}) {
  await billingCurrentRef(db, structureId).set({
    plan: 'free',
    freeItemsLimit: 3,
    freeItemsUsed: 0,
    freeItemsCountedRefs: [],
    freeSignatureTokensLimit: 10,
    freeSignatureTokensUsed: 0,
    onboardingImportAttemptsUsed: 0,
    onboardingImportLastAttemptDate: null,
    updatedAt: new Date(),
    ...overrides,
  });
}

beforeEach(async () => {
  await db.doc(`users/${ADMIN_A}`).set({
    structureId: STRUCTURE_A,
    status: 'admin',
    email: 'admin-a-onboard@test.com',
    firstName: 'Ada',
    lastName: 'Admin',
    displayName: 'Ada Admin',
  });
  await db.doc(`users/${ADMIN_B}`).set({
    structureId: STRUCTURE_B,
    status: 'admin',
    email: 'admin-b-onboard@test.com',
  });
  await db.doc(`users/${MEMBER_A}`).set({
    structureId: STRUCTURE_A,
    status: 'membre',
    email: 'membre@test.com',
    firstName: 'Marie',
    lastName: 'Dupont',
    displayName: 'Marie Dupont',
  });
  await db.doc(`structures/${STRUCTURE_A}`).set({ name: 'Structure A' });
  await db.doc(`structures/${STRUCTURE_B}`).set({ name: 'Structure B' });
  await seedBilling(STRUCTURE_A);
  await seedBilling(STRUCTURE_B);

  // Nettoie collections créées par les tests précédents (best-effort)
  const missions = await db.collection('missions').where('structureId', '==', STRUCTURE_A).get();
  await Promise.all(missions.docs.map((d) => d.ref.delete()));
  const etudes = await db.collection('etudes').where('structureId', '==', STRUCTURE_A).get();
  await Promise.all(etudes.docs.map((d) => d.ref.delete()));
  const companies = await db.collection('companies').where('structureId', '==', STRUCTURE_A).get();
  await Promise.all(companies.docs.map((d) => d.ref.delete()));
});

describe('runOnboardingBulkImport', () => {
  it('rejette si l’appelant ne gère pas la structureId', async () => {
    const { runOnboardingBulkImport } = await import('../../functions/src/onboardingImport');
    await expect(
      runOnboardingBulkImport(ADMIN_B, {
        structureId: STRUCTURE_A,
        companies: [{ name: 'Acme' }],
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });

    const companies = await db.collection('companies').where('structureId', '==', STRUCTURE_A).get();
    expect(companies.empty).toBe(true);
  });

  it('crée missions/études avec importedViaOnboarding et match companies', async () => {
    await db.collection('companies').doc('existing-acme').set({
      name: 'Acme Corp',
      structureId: STRUCTURE_A,
    });

    const { runOnboardingBulkImport } = await import('../../functions/src/onboardingImport');
    const report = await runOnboardingBulkImport(ADMIN_A, {
      structureId: STRUCTURE_A,
      teamMembers: [{ email: 'nouveau@test.com', role: 'membre' }],
      companies: [{ name: 'Acme Corp.' }, { name: 'Nova SAS' }],
      missions: [
        {
          title: 'Mission test',
          company: 'Acme Corp',
          chargeName: 'Marie Dupont',
        },
      ],
      etudes: [
        {
          numeroEtude: 'E-1',
          company: 'Nova SAS',
          chargeName: 'Marie',
        },
      ],
    });

    expect(report.teamInvited).toBe(1);
    expect(report.companiesMatched).toBe(1);
    expect(report.companiesCreated).toBe(1);
    expect(report.missionsCreated).toBe(1);
    expect(report.etudesCreated).toBe(1);

    const missions = await db.collection('missions').where('structureId', '==', STRUCTURE_A).get();
    expect(missions.size).toBe(1);
    const mission = missions.docs[0]!.data();
    expect(mission.importedViaOnboarding).toBe(true);
    expect(mission.companyId).toBe('existing-acme');
    expect(mission.chargeId).toBe(MEMBER_A);

    const etudes = await db.collection('etudes').where('structureId', '==', STRUCTURE_A).get();
    expect(etudes.size).toBe(1);
    expect(etudes.docs[0]!.data().importedViaOnboarding).toBe(true);

    const billing = await billingCurrentRef(db, STRUCTURE_A).get();
    expect(billing.data()?.onboardingImportAttemptsUsed).toBe(1);
  });

  it('après 3 tentatives : rejet sans écriture', async () => {
    await seedBilling(STRUCTURE_A, {
      onboardingImportAttemptsUsed: 3,
      onboardingImportLastAttemptDate: '2026-01-01',
    });

    const { runOnboardingBulkImport } = await import('../../functions/src/onboardingImport');
    await expect(
      runOnboardingBulkImport(ADMIN_A, {
        structureId: STRUCTURE_A,
        companies: [{ name: 'Should Not Exist' }],
        missions: [{ title: 'Nope', company: 'Should Not Exist' }],
      })
    ).rejects.toMatchObject({ code: 'resource-exhausted' });

    const companies = await db
      .collection('companies')
      .where('structureId', '==', STRUCTURE_A)
      .where('name', '==', 'Should Not Exist')
      .get();
    expect(companies.empty).toBe(true);

    const missions = await db.collection('missions').where('structureId', '==', STRUCTURE_A).get();
    expect(missions.empty).toBe(true);
  });
});
