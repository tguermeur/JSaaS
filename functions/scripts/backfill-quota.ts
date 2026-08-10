#!/usr/bin/env npx tsx
/**
 * Backfill structures/{id}/billing/current pour les structures existantes.
 *
 * Prérequis : GOOGLE_APPLICATION_CREDENTIALS, serviceAccountKey.json à la racine,
 * ou `gcloud auth application-default login`.
 *
 * Usage (depuis functions/) :
 *   npm run backfill:quota:dry-run
 *   npm run backfill:quota
 */
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes('--dry-run');

const DEFAULT_PROJECT_ID =
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT ||
  'jsaas-dd2f7';

const PAID_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

function initAdmin() {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountPath && existsSync(serviceAccountPath)) {
    const sa = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    initializeApp({
      credential: cert(sa),
      projectId: sa.project_id || DEFAULT_PROJECT_ID,
    });
    return;
  }
  const localPath = join(__dirname, '../../serviceAccountKey.json');
  if (existsSync(localPath)) {
    const sa = JSON.parse(readFileSync(localPath, 'utf8'));
    initializeApp({
      credential: cert(sa),
      projectId: sa.project_id || DEFAULT_PROJECT_ID,
    });
    return;
  }
  initializeApp({
    credential: applicationDefault(),
    projectId: DEFAULT_PROJECT_ID,
  });
}

function planFromSubscriptionStatus(status: unknown): 'free' | 'paid' {
  const s = typeof status === 'string' ? status.trim().toLowerCase() : '';
  return PAID_SUBSCRIPTION_STATUSES.has(s) ? 'paid' : 'free';
}

async function main() {
  initAdmin();
  const db = getFirestore();
  const snap = await db.collection('structures').get();

  let created = 0;
  let skipped = 0;
  let paid = 0;
  let free = 0;

  console.log(
    `[backfill-quota] ${snap.size} structures — mode ${dryRun ? 'DRY-RUN' : 'WRITE'}`
  );

  for (const doc of snap.docs) {
    const billingRef = doc.ref.collection('billing').doc('current');
    const billingSnap = await billingRef.get();
    if (billingSnap.exists) {
      skipped++;
      continue;
    }

    const plan = planFromSubscriptionStatus(doc.data()?.subscriptionStatus);
    if (plan === 'paid') paid++;
    else free++;

    const payload = {
      plan,
      freeItemsLimit: 3,
      freeItemsUsed: 0,
      freeItemsCountedRefs: [] as string[],
      freeSignatureTokensLimit: 10,
      freeSignatureTokensUsed: 0,
      updatedAt: FieldValue.serverTimestamp(),
    };

    console.log(`  ${doc.id}: plan=${plan} (subscriptionStatus=${doc.data()?.subscriptionStatus ?? 'n/a'})`);

    if (!dryRun) {
      await billingRef.set(payload);
    }
    created++;
  }

  console.log(
    `[backfill-quota] done — created=${created} skipped=${skipped} free=${free} paid=${paid}`
  );
}

main().catch((err) => {
  console.error('[backfill-quota] fatal:', err);
  process.exit(1);
});
