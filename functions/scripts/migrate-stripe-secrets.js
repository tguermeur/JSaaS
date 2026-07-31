#!/usr/bin/env node
/**
 * Migre stripeSecretKey des documents structures vers structures/{id}/private/stripe
 * puis supprime le champ public.
 *
 * Prérequis : GOOGLE_APPLICATION_CREDENTIALS, serviceAccountKey.json à la racine,
 * ou `gcloud auth application-default login`.
 *
 * Usage (depuis la racine du repo) :
 *   npm run migrate:stripe-secrets:dry-run
 *   npm run migrate:stripe-secrets
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

async function main() {
  initAdmin();
  const db = getFirestore();
  const snap = await db.collection('structures').get();
  let migrated = 0;
  let purged = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const legacyKey = data.stripeSecretKey;
    if (!legacyKey || typeof legacyKey !== 'string') {
      skipped++;
      continue;
    }

    const privateRef = doc.ref.collection('private').doc('stripe');
    const privateSnap = await privateRef.get();

    if (!dryRun) {
      if (!privateSnap.exists || !privateSnap.data()?.secretKey) {
        await privateRef.set(
          {
            secretKey: legacyKey.trim(),
            migratedAt: FieldValue.serverTimestamp(),
            migratedBy: 'functions/scripts/migrate-stripe-secrets.js',
          },
          { merge: true }
        );
        migrated++;
      }
      await doc.ref.update({
        stripeSecretKey: FieldValue.delete(),
        stripeSecretConfigured: true,
      });
      purged++;
    } else {
      console.log(`[dry-run] ${doc.id}: migrer clé vers private/stripe, supprimer champ public`);
      migrated++;
      purged++;
    }
  }

  console.log(
    JSON.stringify({ dryRun, total: snap.size, migrated, purged, skipped }, null, 2)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
