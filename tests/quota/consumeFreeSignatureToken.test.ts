/**
 * Tests unitaires consumeFreeSignatureToken — race conditions.
 * Utilise l'émulateur Firestore (FIRESTORE_EMULATOR_HOST).
 *
 * Lancer via : npm run test:quota
 */
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  billingCurrentRef,
  consumeFreeSignatureToken,
  DEFAULT_FREE_SIGNATURE_TOKENS_LIMIT,
  SIGNATURE_QUOTA_EXHAUSTED_MSG,
} from '../../functions/src/quotaHelpers';

const PROJECT_ID = 'demo-jsaas-quota';
const STRUCTURE_ID = 'structure-quota-sig';

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
  const billingRef = billingCurrentRef(db, STRUCTURE_ID);
  await billingRef.set({
    plan: 'free',
    freeItemsLimit: 3,
    freeItemsUsed: 0,
    freeItemsCountedRefs: [],
    freeSignatureTokensLimit: DEFAULT_FREE_SIGNATURE_TOKENS_LIMIT,
    freeSignatureTokensUsed: 0,
    updatedAt: new Date(),
  });
});

describe('consumeFreeSignatureToken', () => {
  it('incrémente jusqu’à la limite puis refuse', async () => {
    for (let i = 0; i < DEFAULT_FREE_SIGNATURE_TOKENS_LIMIT; i++) {
      await consumeFreeSignatureToken(db, STRUCTURE_ID, FieldValue);
    }
    const snap = await billingCurrentRef(db, STRUCTURE_ID).get();
    expect(snap.data()?.freeSignatureTokensUsed).toBe(DEFAULT_FREE_SIGNATURE_TOKENS_LIMIT);

    await expect(consumeFreeSignatureToken(db, STRUCTURE_ID, FieldValue)).rejects.toMatchObject({
      code: 'resource-exhausted',
      message: SIGNATURE_QUOTA_EXHAUSTED_MSG,
    });

    const after = await billingCurrentRef(db, STRUCTURE_ID).get();
    expect(after.data()?.freeSignatureTokensUsed).toBe(DEFAULT_FREE_SIGNATURE_TOKENS_LIMIT);
  });

  it('no-op si plan paid', async () => {
    await billingCurrentRef(db, STRUCTURE_ID).set(
      { plan: 'paid', freeSignatureTokensUsed: 0, freeSignatureTokensLimit: 10 },
      { merge: true }
    );
    await consumeFreeSignatureToken(db, STRUCTURE_ID, FieldValue);
    const snap = await billingCurrentRef(db, STRUCTURE_ID).get();
    expect(snap.data()?.freeSignatureTokensUsed).toBe(0);
  });

  it('appels concurrents ne dépassent pas la limite de plus d’1', async () => {
    await billingCurrentRef(db, STRUCTURE_ID).set(
      {
        plan: 'free',
        freeSignatureTokensLimit: 10,
        freeSignatureTokensUsed: 8,
      },
      { merge: true }
    );

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => consumeFreeSignatureToken(db, STRUCTURE_ID, FieldValue))
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
    const rejected = results.filter((r) => r.status === 'rejected').length;

    expect(fulfilled).toBeGreaterThanOrEqual(1);
    expect(fulfilled + rejected).toBe(8);

    const snap = await billingCurrentRef(db, STRUCTURE_ID).get();
    const used = snap.data()?.freeSignatureTokensUsed as number;
    // Marge race acceptable : au plus +1 au-delà de la limite
    expect(used).toBeLessThanOrEqual(11);
    expect(used).toBeGreaterThanOrEqual(10);
  });

  it('rejette avec code resource-exhausted', async () => {
    await billingCurrentRef(db, STRUCTURE_ID).set(
      {
        plan: 'free',
        freeSignatureTokensLimit: 10,
        freeSignatureTokensUsed: 10,
      },
      { merge: true }
    );
    try {
      await consumeFreeSignatureToken(db, STRUCTURE_ID, FieldValue);
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect(err).toMatchObject({
        code: 'resource-exhausted',
        message: SIGNATURE_QUOTA_EXHAUSTED_MSG,
      });
    }
  });
});
