#!/usr/bin/env node
/**
 * Re-chiffre les champs sensibles users (et optionnellement companies) vers ENC2: (clé tenant).
 * Infra only — pas de migration live forcée. Toujours démarrer avec --dry-run.
 *
 * Usage :
 *   node scripts/reencrypt-tenant-keys.mjs --dry-run --structureId=STRUCTURE_ID
 *   node scripts/reencrypt-tenant-keys.mjs --structureId=STRUCTURE_ID
 *   node scripts/reencrypt-tenant-keys.mjs --structureId=STRUCTURE_ID --collection=users --limit=100
 *
 * Reprise : état dans .reencrypt-progress.json (local) ET /_migrations/reencrypt/{structureId}
 *
 * Env : ENCRYPTION_KEY, GOOGLE_APPLICATION_CREDENTIALS / ADC, PROJECT_ID
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from 'crypto';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const structureId = (args.find((a) => a.startsWith('--structureId=')) || '').split('=')[1];
const collectionName =
  (args.find((a) => a.startsWith('--collection=')) || '').split('=')[1] || 'users';
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 0;

if (!structureId) {
  console.error('Requis: --structureId=...');
  process.exit(1);
}

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  process.env.PROJECT_ID ||
  'jsaas-dd2f7';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROGRESS_FILE = resolve(__dirname, '../.reencrypt-progress.json');

const USER_FIELDS = [
  'socialSecurityNumber',
  'siret',
  'tvaIntra',
  'phone',
  'address',
  'postalCode',
  'birthPlace',
  'birthDate',
  'birthPostalCode',
  'studentId',
  'twoFactorSecret',
  'firstName',
  'lastName',
  // displayName reste clair — ne pas re-chiffrer
  'ecole',
  'graduationYear',
  'program',
  'companyName',
];

function loadEnvKey() {
  if (process.env.ENCRYPTION_KEY) return;
  for (const p of [
    resolve(__dirname, '../.env.local'),
    resolve(__dirname, '../.env'),
    resolve(__dirname, '../functions/.env'),
  ]) {
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(/^ENCRYPTION_KEY=(.+)$/m);
    if (m) {
      process.env.ENCRYPTION_KEY = m[1].trim().replace(/^["']|["']$/g, '');
      break;
    }
  }
}
loadEnvKey();

if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
  console.error('ENCRYPTION_KEY (hex 64) requis');
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
}
const db = getFirestore();

const master = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

function hashStructureId(sid) {
  return createHash('sha256').update(sid, 'utf8').digest('hex').slice(0, 16);
}

function deriveTenantKey(sid) {
  const info = Buffer.from(`jsaas-tenant-crypto-v1:${sid}`, 'utf8');
  return Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), info, 32));
}

function decryptLegacy(enc) {
  if (!enc.startsWith('ENC:') || enc.startsWith('ENC2:')) return null;
  try {
    const data = enc.slice(4);
    const iv = Buffer.from(data.slice(0, 32), 'hex');
    const tag = Buffer.from(data.slice(32, 64), 'hex');
    const encrypted = data.slice(64);
    const decipher = createDecipheriv('aes-256-gcm', master, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
  } catch {
    return null;
  }
}

function encryptTenant(plain, sid) {
  const key = deriveTenantKey(sid);
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plain, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  const payload = iv.toString('hex') + tag.toString('hex') + encrypted;
  return `ENC2:v1:${hashStructureId(sid)}:${payload}`;
}

function loadProgress() {
  if (!existsSync(PROGRESS_FILE)) return { processed: {} };
  try {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
  } catch {
    return { processed: {} };
  }
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function main() {
  console.log(
    `reencrypt-tenant-keys ${dryRun ? '(DRY-RUN)' : ''} structure=${structureId} collection=${collectionName}`
  );

  const progress = loadProgress();
  const key = `${structureId}:${collectionName}`;
  const doneSet = new Set(progress.processed[key] || []);

  let q = db
    .collection(collectionName)
    .where('structureId', '==', structureId)
    .orderBy(FieldPath.documentId());
  if (LIMIT > 0) q = q.limit(LIMIT);

  const snap = await q.get();
  const stats = { scanned: 0, updated: 0, skipped: 0, already: 0, errors: 0 };

  let batch = db.batch();
  let ops = 0;

  for (const docSnap of snap.docs) {
    stats.scanned++;
    if (doneSet.has(docSnap.id)) {
      stats.already++;
      continue;
    }

    const data = docSnap.data() || {};
    const patch = {};
    let changed = false;

    for (const field of USER_FIELDS) {
      const value = data[field];
      if (typeof value !== 'string' || !value.trim()) continue;
      if (value.startsWith('ENC2:')) continue; // déjà tenant
      let plain = value;
      if (value.startsWith('ENC:')) {
        const dec = decryptLegacy(value);
        if (!dec) {
          console.warn(`  decrypt fail ${docSnap.id}.${field}`);
          stats.errors++;
          continue;
        }
        plain = dec;
      }
      patch[field] = encryptTenant(plain, structureId);
      changed = true;
    }

    if (!changed) {
      stats.skipped++;
      doneSet.add(docSnap.id);
      continue;
    }

    console.log(`  ${dryRun ? 'would-reencrypt' : 'reencrypt'} ${docSnap.id} fields=${Object.keys(patch).join(',')}`);
    stats.updated++;
    doneSet.add(docSnap.id);

    if (!dryRun) {
      batch.update(docSnap.ref, patch);
      ops++;
      if (ops >= 200) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
        progress.processed[key] = [...doneSet];
        saveProgress(progress);
        await db.doc(`_migrations/reencrypt/${structureId}`).set(
          {
            collection: collectionName,
            processedCount: doneSet.size,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    }
  }

  if (!dryRun && ops > 0) {
    await batch.commit();
    await db.doc(`_migrations/reencrypt/${structureId}`).set(
      {
        collection: collectionName,
        processedCount: doneSet.size,
        updatedAt: new Date().toISOString(),
        status: 'partial_or_done',
      },
      { merge: true }
    );
  }

  progress.processed[key] = [...doneSet];
  saveProgress(progress);
  console.log('\nDone:', stats);
  console.log(`Progress saved → ${PROGRESS_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
