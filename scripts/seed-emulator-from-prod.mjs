#!/usr/bin/env node
/**
 * Seed émulateur Firestore avec un échantillon anonymisé lu depuis prod.
 * N'écrit JAMAIS dans Firestore cloud — exige FIRESTORE_EMULATOR_HOST.
 *
 * Usage :
 *   firebase emulators:start --only firestore
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seed-emulator-from-prod.mjs --dry-run
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seed-emulator-from-prod.mjs --limit=50
 *
 * Env :
 *   PROD_PROJECT_ID=jsaas-dd2f7
 *   GOOGLE_APPLICATION_CREDENTIALS=... (lecture prod uniquement)
 */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;

const PROD_PROJECT_ID = process.env.PROD_PROJECT_ID || 'jsaas-dd2f7';
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

if (!emulatorHost && !dryRun) {
  console.error('Refus : FIRESTORE_EMULATOR_HOST est obligatoire (ex. 127.0.0.1:8080).');
  console.error('Ce script ne doit pas écrire dans le projet cloud jsaas-dd2f7.');
  process.exit(1);
}

const COLLECTIONS = ['structures', 'users', 'companies', 'missions', 'etudes'];

const SENSITIVE_USER_KEYS = [
  'socialSecurityNumber',
  'twoFactorSecret',
  'phone',
  'address',
  'birthDate',
  'iban',
  'rib',
];

function scrub(collection, data, id) {
  const out = { ...data, _seededAt: new Date().toISOString(), _anon: true };
  if (collection === 'users') {
    out.email = `user-${id.slice(0, 8)}@emulator.invalid`;
    for (const k of SENSITIVE_USER_KEYS) {
      if (k in out) out[k] = null;
    }
    if (out.firstName && typeof out.firstName === 'string' && !out.firstName.includes(':')) {
      out.firstName = 'Anon';
    }
    if (out.lastName && typeof out.lastName === 'string' && !out.lastName.includes(':')) {
      out.lastName = `User${id.slice(0, 4)}`;
    }
    if (out.displayName && typeof out.displayName === 'string' && !out.displayName.includes(':')) {
      out.displayName = `Anon User${id.slice(0, 4)}`;
    }
  }
  if (collection === 'companies' && out.name && typeof out.name === 'string' && !String(out.name).includes(':')) {
    out.name = `Company ${id.slice(0, 6)}`;
  }
  if (collection === 'structures' && out.contactEmail) {
    out.contactEmail = `structure-${id.slice(0, 8)}@emulator.invalid`;
  }
  return out;
}

function initApp(projectId, name) {
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;
  return initializeApp({ credential: applicationDefault(), projectId }, name);
}

async function copyCollection(prodDb, emuDb, name) {
  const snap = await prodDb.collection(name).limit(LIMIT).get();
  let written = 0;
  console.log(`[${name}] ${snap.size} docs (limit=${LIMIT})`);
  if (dryRun) return { collection: name, read: snap.size, written: 0 };

  const batchSize = 400;
  let batch = emuDb.batch();
  let ops = 0;
  for (const doc of snap.docs) {
    const data = scrub(name, doc.data(), doc.id);
    batch.set(emuDb.collection(name).doc(doc.id), data, { merge: true });
    ops += 1;
    written += 1;
    if (ops >= batchSize) {
      await batch.commit();
      batch = emuDb.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
  return { collection: name, read: snap.size, written };
}

async function main() {
  console.log(dryRun ? '=== DRY-RUN ===' : '=== SEED EMULATOR ===');
  console.log(`prod=${PROD_PROJECT_ID} → emulator=${emulatorHost || '(dry-run)'}`);

  const prodApp = initApp(PROD_PROJECT_ID, 'prod');
  const emuApp = initApp(PROD_PROJECT_ID, 'emulator');
  const prodDb = getFirestore(prodApp);
  const emuDb = getFirestore(emuApp);

  const results = [];
  for (const c of COLLECTIONS) {
    results.push(await copyCollection(prodDb, emuDb, c));
  }
  console.table(results);
  console.log('Done. Re-run is idempotent (same doc IDs, merge).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
