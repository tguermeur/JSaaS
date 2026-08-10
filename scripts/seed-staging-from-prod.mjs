#!/usr/bin/env node
/**
 * Seed Firestore staging avec un échantillon anonymisé lu depuis prod.
 * Lecture seule sur jsaas-dd2f7 → écriture uniquement sur js-connect-staging.
 *
 * Usage :
 *   node scripts/seed-staging-from-prod.mjs --dry-run
 *   node scripts/seed-staging-from-prod.mjs --confirm --limit=50
 *
 * Env :
 *   PROD_PROJECT_ID=jsaas-dd2f7
 *   STAGING_PROJECT_ID=js-connect-staging
 *   GOOGLE_APPLICATION_CREDENTIALS=... (compte avec lecture prod + écriture staging)
 *
 * Garde-fous (tous obligatoires) :
 *   1. projet cible === js-connect-staging
 *   2. --confirm présent (sauf --dry-run)
 *   3. FIRESTORE_EMULATOR_HOST non défini
 */

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const confirmed = args.includes('--confirm');
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;

const PROD_PROJECT_ID = process.env.PROD_PROJECT_ID || 'jsaas-dd2f7';
const STAGING_PROJECT_ID = process.env.STAGING_PROJECT_ID || 'js-connect-staging';
const EXPECTED_STAGING = 'js-connect-staging';

if (STAGING_PROJECT_ID !== EXPECTED_STAGING) {
  console.error(
    `Refus : le projet cible doit être exactement « ${EXPECTED_STAGING} » (reçu : ${STAGING_PROJECT_ID}).`
  );
  process.exit(1);
}

if (!dryRun && !confirmed) {
  console.error('Refus : ajoutez --confirm pour écrire dans js-connect-staging (ou --dry-run pour simuler).');
  process.exit(1);
}

if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.error(
    'Refus : FIRESTORE_EMULATOR_HOST est défini. Ce script cible le cloud staging, pas l\'émulateur.'
  );
  console.error('Utilisez scripts/seed-emulator-from-prod.mjs pour l\'émulateur.');
  process.exit(1);
}

const COLLECTIONS = [
  'structures',
  'users',
  'companies',
  'missions',
  'etudes',
  'contacts',
  'prospects',
];

const SENSITIVE_USER_KEYS = [
  'socialSecurityNumber',
  'twoFactorSecret',
  'phone',
  'address',
  'birthDate',
  'iban',
  'rib',
];

/** Champs documents d'identité / profil (voir src/types/user.ts, DocumentsTab). */
const DOCUMENT_URL_KEYS = [
  'healthCardUrl',
  'ribUrl',
  'idCardUrl',
  'cvUrl',
  'schoolCertificateUrl',
  'profilePictureUrl',
  'identityCardUrl',
  'identityCardRectoUrl',
  'identityCardVersoUrl',
  'photoURL',
];

const PROD_STORAGE_RE =
  /jsaas-dd2f7\.(appspot\.com|firebasestorage\.app)|firebasestorage\.googleapis\.com\/v0\/b\/jsaas-dd2f7/;

function isProdStorageUrl(value) {
  return typeof value === 'string' && PROD_STORAGE_RE.test(value);
}

/** Nullifie les URLs de documents et tout champ *Url pointant vers le Storage prod. */
function scrubStorageUrls(obj) {
  if (!obj || typeof obj !== 'object') return;

  for (const key of DOCUMENT_URL_KEYS) {
    if (key in obj) obj[key] = null;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && /Url$/i.test(key) && isProdStorageUrl(value)) {
      obj[key] = null;
    }
  }

  if (Array.isArray(obj.customDocuments)) {
    obj.customDocuments = obj.customDocuments.map((doc) => {
      if (!doc || typeof doc !== 'object') return doc;
      const next = { ...doc };
      if ('url' in next) next.url = null;
      return next;
    });
  }
}

function scrub(collection, data, id) {
  const out = { ...data, _seededAt: new Date().toISOString(), _anon: true };

  scrubStorageUrls(out);

  if (collection === 'users') {
    out.email = `user-${id.slice(0, 8)}@staging.invalid`;
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
    out.contactEmail = `structure-${id.slice(0, 8)}@staging.invalid`;
  }

  if (collection === 'contacts' || collection === 'prospects') {
    if ('email' in out) out.email = `contact-${id.slice(0, 8)}@staging.invalid`;
    if ('phone' in out) out.phone = null;
    if (out.name && typeof out.name === 'string' && !String(out.name).includes(':')) {
      out.name = `Contact ${id.slice(0, 6)}`;
    }
  }

  return out;
}

async function main() {
  // Import différé : les garde-fous ci-dessus doivent pouvoir tourner sans firebase-admin
  const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  function initApp(projectId, name) {
    const existing = getApps().find((a) => a.name === name);
    if (existing) return existing;
    return initializeApp({ credential: applicationDefault(), projectId }, name);
  }

  async function copyCollection(prodDb, stagingDb, name) {
    const snap = await prodDb.collection(name).limit(LIMIT).get();
    let written = 0;
    console.log(`[${name}] ${snap.size} docs (limit=${LIMIT})`);
    if (dryRun) return { collection: name, read: snap.size, written: 0 };

    const batchSize = 400;
    let batch = stagingDb.batch();
    let ops = 0;
    for (const doc of snap.docs) {
      const data = scrub(name, doc.data(), doc.id);
      batch.set(stagingDb.collection(name).doc(doc.id), data, { merge: true });
      ops += 1;
      written += 1;
      if (ops >= batchSize) {
        await batch.commit();
        batch = stagingDb.batch();
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();
    return { collection: name, read: snap.size, written };
  }

  console.log(dryRun ? '=== DRY-RUN ===' : '=== SEED STAGING ===');
  console.log(`prod=${PROD_PROJECT_ID} (read-only) → staging=${STAGING_PROJECT_ID}`);

  const prodApp = initApp(PROD_PROJECT_ID, 'prod');
  const stagingApp = initApp(STAGING_PROJECT_ID, 'staging');
  const prodDb = getFirestore(prodApp);
  const stagingDb = getFirestore(stagingApp);

  const results = [];
  for (const c of COLLECTIONS) {
    results.push(await copyCollection(prodDb, stagingDb, c));
  }
  console.table(results);
  console.log('Done. Re-run is idempotent (same doc IDs, merge).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
