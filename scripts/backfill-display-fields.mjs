#!/usr/bin/env node
/**
 * Backfill displayFirstName / displayLastName / displayName (clair) sur users.
 * Idempotent. --dry-run pour simuler.
 *
 * Si firstName/lastName/displayName sont ENC:/ENC2: :
 *   - tente decrypt via ENCRYPTION_KEY (admin local) si disponible
 *   - sinon skip (ne copie pas le ciphertext vers display*)
 * Si plaintext existe : copie vers display*.
 *
 * Usage :
 *   node scripts/backfill-display-fields.mjs --dry-run
 *   node scripts/backfill-display-fields.mjs
 *   node scripts/backfill-display-fields.mjs --limit=200
 *
 * Env :
 *   GOOGLE_APPLICATION_CREDENTIALS / ADC
 *   ENCRYPTION_KEY (hex 64) — optionnel, pour déchiffrer avant copie
 *   GCLOUD_PROJECT / FIREBASE_PROJECT_ID / PROJECT_ID
 */
import { createDecipheriv, hkdfSync } from 'crypto';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 0;

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  process.env.PROJECT_ID ||
  'jsaas-dd2f7';

// Charger ENCRYPTION_KEY depuis .env.local / functions/.env si absent
function loadEnvKey() {
  if (process.env.ENCRYPTION_KEY) return;
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(__dirname, '../.env.local'),
    resolve(__dirname, '../.env'),
    resolve(__dirname, '../functions/.env'),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    const text = readFileSync(p, 'utf8');
    const m = text.match(/^ENCRYPTION_KEY=(.+)$/m);
    if (m) {
      process.env.ENCRYPTION_KEY = m[1].trim().replace(/^["']|["']$/g, '');
      break;
    }
  }
}
loadEnvKey();

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
}
const db = getFirestore();

const isEnc = (v) =>
  typeof v === 'string' && (v.startsWith('ENC:') || v.startsWith('ENC2:'));
const isPlain = (v) => typeof v === 'string' && v.trim() !== '' && !isEnc(v);

function decryptLegacy(enc) {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) return null;
  if (!enc.startsWith('ENC:') || enc.startsWith('ENC2:')) return null;
  try {
    const key = Buffer.from(keyHex, 'hex');
    const data = enc.slice(4);
    const iv = Buffer.from(data.slice(0, 32), 'hex');
    const tag = Buffer.from(data.slice(32, 64), 'hex');
    const encrypted = data.slice(64);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
  } catch {
    return null;
  }
}

function decryptTenant(enc, structureId) {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64 || !structureId) return null;
  if (!enc.startsWith('ENC2:')) return null;
  try {
    const parts = enc.split(':');
    if (parts.length < 4) return null;
    const payload = parts.slice(3).join(':');
    const master = Buffer.from(keyHex, 'hex');
    const info = Buffer.from(`jsaas-tenant-crypto-v1:${structureId}`, 'utf8');
    const key = Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), info, 32));
    const iv = Buffer.from(payload.slice(0, 32), 'hex');
    const tag = Buffer.from(payload.slice(32, 64), 'hex');
    const encrypted = payload.slice(64);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
  } catch {
    return null;
  }
}

function resolvePlain(value, structureId) {
  if (isPlain(value)) return value.trim();
  if (!isEnc(value)) return '';
  if (value.startsWith('ENC2:')) return decryptTenant(value, structureId) || '';
  return decryptLegacy(value) || '';
}

async function main() {
  console.log(`backfill-display-fields ${dryRun ? '(DRY-RUN)' : ''} project=${PROJECT_ID}`);
  console.log(`ENCRYPTION_KEY: ${process.env.ENCRYPTION_KEY ? 'présent' : 'absent (skip decrypt ENC:)'}`);

  let q = db.collection('users').orderBy(FieldPath.documentId());
  if (LIMIT > 0) q = q.limit(LIMIT);

  const snap = await q.get();
  const stats = { scanned: 0, updated: 0, skipped: 0, already: 0, decryptFail: 0 };

  let batch = db.batch();
  let ops = 0;

  for (const docSnap of snap.docs) {
    stats.scanned++;
    const data = docSnap.data() || {};
    const sid = typeof data.structureId === 'string' ? data.structureId : undefined;

    const first = resolvePlain(data.firstName, sid) || resolvePlain(data.displayFirstName, sid);
    const last = resolvePlain(data.lastName, sid) || resolvePlain(data.displayLastName, sid);
    const display =
      resolvePlain(data.displayName, sid) || `${first} ${last}`.trim();

    if (!first && !last && !display) {
      if (isEnc(data.firstName) || isEnc(data.lastName) || isEnc(data.displayName)) {
        stats.decryptFail++;
        console.log(`  skip ${docSnap.id} (chiffré, decrypt impossible)`);
      } else {
        stats.skipped++;
      }
      continue;
    }

    const patch = {};
    if (first && data.displayFirstName !== first) patch.displayFirstName = first;
    if (last && data.displayLastName !== last) patch.displayLastName = last;
    if (display && (data.displayName !== display || isEnc(data.displayName))) {
      patch.displayName = display;
    }

    if (Object.keys(patch).length === 0) {
      stats.already++;
      continue;
    }

    console.log(`  ${dryRun ? 'would-set' : 'set'} ${docSnap.id}`, patch);
    stats.updated++;
    if (!dryRun) {
      batch.update(docSnap.ref, patch);
      ops++;
      if (ops >= 400) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
  }

  if (!dryRun && ops > 0) await batch.commit();
  console.log('\nDone:', stats);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
