/**
 * Tests unitaires recordAiCreditUsage.
 * Lancer via : npm run test:quota
 */
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  billingCurrentRef,
} from '../../functions/src/quotaHelpers';
import { recordAiCreditUsage } from '../../functions/src/aiCreditsHelpers';

const PROJECT_ID = 'demo-jsaas-quota';
const STRUCTURE_ID = 'structure-ai-credits';

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
    updatedAt: new Date(),
  });
});

describe('recordAiCreditUsage', () => {
  it('incrémente aiCreditsUsed et aiCreditsByFeature.{feature}', async () => {
    await recordAiCreditUsage(db, STRUCTURE_ID, 'import_mapping', { fieldValue: FieldValue });

    const snap = await billingCurrentRef(db, STRUCTURE_ID).get();
    const data = snap.data()!;
    expect(data.aiCreditsUsed).toBe(1);
    expect(data.aiCreditsByFeature?.import_mapping).toBe(1);
  });

  it('no-op propre si billing/current n’existe pas', async () => {
    const other = 'structure-ai-missing';
    await recordAiCreditUsage(db, other, 'import_mapping', { fieldValue: FieldValue });

    const snap = await billingCurrentRef(db, other).get();
    expect(snap.exists).toBe(false);

    const original = await billingCurrentRef(db, STRUCTURE_ID).get();
    expect(original.data()?.aiCreditsUsed).toBeUndefined();
  });

  it('deux features s’incrémentent indépendamment', async () => {
    await recordAiCreditUsage(db, STRUCTURE_ID, 'import_mapping', { fieldValue: FieldValue });
    await recordAiCreditUsage(db, STRUCTURE_ID, 'contact_message', { fieldValue: FieldValue });
    await recordAiCreditUsage(db, STRUCTURE_ID, 'import_mapping', { fieldValue: FieldValue });

    const snap = await billingCurrentRef(db, STRUCTURE_ID).get();
    const data = snap.data()!;
    expect(data.aiCreditsUsed).toBe(3);
    expect(data.aiCreditsByFeature?.import_mapping).toBe(2);
    expect(data.aiCreditsByFeature?.contact_message).toBe(1);
    expect(data.aiCreditsByFeature?.prospect_analysis).toBeUndefined();
  });

  it('no-op si structureId vide', async () => {
    await recordAiCreditUsage(db, '', 'import_mapping', { fieldValue: FieldValue });
    await recordAiCreditUsage(db, undefined, 'import_mapping', { fieldValue: FieldValue });

    const snap = await billingCurrentRef(db, STRUCTURE_ID).get();
    expect(snap.data()?.aiCreditsUsed).toBeUndefined();
  });
});
