/**
 * Tests unitaires reserveOnboardingImportAttempt.
 * Lancer via : npm run test:quota
 */
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  billingCurrentRef,
  ONBOARDING_IMPORT_ATTEMPTS_EXHAUSTED_MSG,
  ONBOARDING_IMPORT_DAILY_LIMIT_MSG,
  reserveOnboardingImportAttempt,
} from '../../functions/src/quotaHelpers';

const PROJECT_ID = 'demo-jsaas-quota';
const STRUCTURE_ID = 'structure-onboarding-reserve';

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
  await billingCurrentRef(db, STRUCTURE_ID).set({
    plan: 'free',
    freeItemsLimit: 3,
    freeItemsUsed: 0,
    freeItemsCountedRefs: [],
    freeSignatureTokensLimit: 10,
    freeSignatureTokensUsed: 0,
    onboardingImportAttemptsUsed: 0,
    onboardingImportLastAttemptDate: null,
    updatedAt: new Date(),
  });
});

describe('reserveOnboardingImportAttempt', () => {
  it('autorise 3 tentatives sur des jours distincts puis resource-exhausted', async () => {
    await reserveOnboardingImportAttempt(db, STRUCTURE_ID, {
      fieldValue: FieldValue,
      todayUtc: '2026-01-01',
    });
    await reserveOnboardingImportAttempt(db, STRUCTURE_ID, {
      fieldValue: FieldValue,
      todayUtc: '2026-01-02',
    });
    await reserveOnboardingImportAttempt(db, STRUCTURE_ID, {
      fieldValue: FieldValue,
      todayUtc: '2026-01-03',
    });

    const snap = await billingCurrentRef(db, STRUCTURE_ID).get();
    expect(snap.data()?.onboardingImportAttemptsUsed).toBe(3);
    expect(snap.data()?.onboardingImportLastAttemptDate).toBe('2026-01-03');

    await expect(
      reserveOnboardingImportAttempt(db, STRUCTURE_ID, {
        fieldValue: FieldValue,
        todayUtc: '2026-01-04',
      })
    ).rejects.toMatchObject({
      code: 'resource-exhausted',
      message: ONBOARDING_IMPORT_ATTEMPTS_EXHAUSTED_MSG,
    });
  });

  it('rejette un second appel le même jour UTC', async () => {
    await reserveOnboardingImportAttempt(db, STRUCTURE_ID, {
      fieldValue: FieldValue,
      todayUtc: '2026-03-10',
    });

    await expect(
      reserveOnboardingImportAttempt(db, STRUCTURE_ID, {
        fieldValue: FieldValue,
        todayUtc: '2026-03-10',
      })
    ).rejects.toMatchObject({
      code: 'resource-exhausted',
      message: ONBOARDING_IMPORT_DAILY_LIMIT_MSG,
    });

    const snap = await billingCurrentRef(db, STRUCTURE_ID).get();
    expect(snap.data()?.onboardingImportAttemptsUsed).toBe(1);
  });

  it('autorise le lendemain et incrémente à nouveau', async () => {
    await reserveOnboardingImportAttempt(db, STRUCTURE_ID, {
      fieldValue: FieldValue,
      todayUtc: '2026-04-01',
    });
    await reserveOnboardingImportAttempt(db, STRUCTURE_ID, {
      fieldValue: FieldValue,
      todayUtc: '2026-04-02',
    });

    const snap = await billingCurrentRef(db, STRUCTURE_ID).get();
    expect(snap.data()?.onboardingImportAttemptsUsed).toBe(2);
    expect(snap.data()?.onboardingImportLastAttemptDate).toBe('2026-04-02');
  });
});
