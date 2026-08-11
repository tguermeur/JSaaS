/**
 * Tests unitaires maybeIncrementFreeItem — assignation structureId.
 * Lancer via : npm run test:quota
 */
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  billingCurrentRef,
  maybeIncrementFreeItem,
} from '../../functions/src/quotaHelpers';

const PROJECT_ID = 'demo-jsaas-quota';
const STRUCTURE_ID = 'structure-quota-assign';
const MISSION_REF = 'mission:mission-enterprise-unassigned';

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
    freeItemsUsed: 2,
    freeItemsCountedRefs: ['mission:already-1', 'mission:already-2'],
    freeSignatureTokensLimit: 10,
    freeSignatureTokensUsed: 0,
    updatedAt: new Date(),
  });
});

describe('maybeIncrementFreeItem — assignation', () => {
  it('passe freeItemsUsed de 2 à 3 et ajoute la ref mission', async () => {
    await maybeIncrementFreeItem(db, STRUCTURE_ID, MISSION_REF, { fieldValue: FieldValue });

    const snap = await billingCurrentRef(db, STRUCTURE_ID).get();
    const data = snap.data()!;
    expect(data.freeItemsUsed).toBe(3);
    expect(data.freeItemsCountedRefs).toContain(MISSION_REF);
  });

  it('est idempotent si la ref est déjà comptée', async () => {
    await maybeIncrementFreeItem(db, STRUCTURE_ID, MISSION_REF, { fieldValue: FieldValue });
    await maybeIncrementFreeItem(db, STRUCTURE_ID, MISSION_REF, { fieldValue: FieldValue });

    const snap = await billingCurrentRef(db, STRUCTURE_ID).get();
    expect(snap.data()?.freeItemsUsed).toBe(3);
    expect(
      (snap.data()?.freeItemsCountedRefs as string[]).filter((r) => r === MISSION_REF)
    ).toHaveLength(1);
  });

  it('no-op si structureId vide (cas create avant assignation)', async () => {
    await maybeIncrementFreeItem(db, '', MISSION_REF, { fieldValue: FieldValue });
    const snap = await billingCurrentRef(db, STRUCTURE_ID).get();
    expect(snap.data()?.freeItemsUsed).toBe(2);
  });

  it('skip (importedViaOnboarding) ne touche pas freeItemsUsed', async () => {
    await maybeIncrementFreeItem(db, STRUCTURE_ID, 'mission:onboarding-1', {
      skip: true,
      reason: 'onboarding import hors quota',
      fieldValue: FieldValue,
    });
    const snap = await billingCurrentRef(db, STRUCTURE_ID).get();
    expect(snap.data()?.freeItemsUsed).toBe(2);
    expect(snap.data()?.freeItemsCountedRefs).not.toContain('mission:onboarding-1');
  });

  it('sans skip continue d’incrémenter (non-régression)', async () => {
    await maybeIncrementFreeItem(db, STRUCTURE_ID, 'mission:normal-1', {
      fieldValue: FieldValue,
    });
    const snap = await billingCurrentRef(db, STRUCTURE_ID).get();
    expect(snap.data()?.freeItemsUsed).toBe(3);
    expect(snap.data()?.freeItemsCountedRefs).toContain('mission:normal-1');
  });
});
