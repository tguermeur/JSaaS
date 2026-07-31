#!/usr/bin/env node
/**
 * Backfill structureId sur collections Phase 1 (idempotent).
 *
 * Collections :
 *   - generatedDocuments : missionId → missions, sinon etudeId → etudes, sinon createdBy → users
 *   - templates          : createdBy → users (si structureId manquant)
 *   - templateVariables  : templateId → templates, sinon createdBy → users
 *   - documentTags       : templateId → templates, sinon createdBy → users
 *
 * Usage :
 *   node scripts/backfill-structureId.mjs --dry-run
 *   node scripts/backfill-structureId.mjs
 *   node scripts/backfill-structureId.mjs --limit=500
 *
 * Env :
 *   GOOGLE_APPLICATION_CREDENTIALS=... (ou ADC)
 *   GCLOUD_PROJECT / FIREBASE_PROJECT_ID / PROJECT_ID
 */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 0;

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  process.env.PROJECT_ID ||
  'jsaas-dd2f7';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
}
const db = getFirestore();

const cache = {
  missions: new Map(),
  etudes: new Map(),
  users: new Map(),
  templates: new Map(),
};

async function resolveFromDoc(collection, id, field = 'structureId') {
  if (!id || typeof id !== 'string') return null;
  const map = cache[collection];
  if (map && map.has(id)) return map.get(id);
  const snap = await db.collection(collection).doc(id).get();
  const value = snap.exists ? (snap.data()?.[field] ?? null) : null;
  if (map) map.set(id, value);
  return value;
}

async function resolveGeneratedDocumentStructureId(data) {
  if (data.structureId) return { structureId: data.structureId, source: 'already-set' };

  if (data.missionId) {
    const sid = await resolveFromDoc('missions', data.missionId);
    if (sid) return { structureId: sid, source: 'missionId' };
  }
  if (data.etudeId) {
    const sid = await resolveFromDoc('etudes', data.etudeId);
    if (sid) return { structureId: sid, source: 'etudeId' };
  }
  if (data.createdBy) {
    const sid = await resolveFromDoc('users', data.createdBy);
    if (sid) return { structureId: sid, source: 'createdBy' };
  }
  return { structureId: null, source: 'skip' };
}

async function resolveViaTemplateOrCreator(data) {
  if (data.structureId) return { structureId: data.structureId, source: 'already-set' };

  if (data.templateId) {
    const sid = await resolveFromDoc('templates', data.templateId);
    if (sid) return { structureId: sid, source: 'templateId' };
  }
  if (data.createdBy) {
    const sid = await resolveFromDoc('users', data.createdBy);
    if (sid) return { structureId: sid, source: 'createdBy' };
  }
  return { structureId: null, source: 'skip' };
}

async function backfillCollection(name, resolver) {
  const stats = { scanned: 0, already: 0, updated: 0, skipped: 0 };
  let query = db.collection(name).orderBy(FieldPath.documentId());
  if (LIMIT > 0) query = query.limit(LIMIT);

  const snap = await query.get();
  console.log(`\n[${name}] ${snap.size} docs${LIMIT > 0 ? ` (limit=${LIMIT})` : ''}`);

  let batch = db.batch();
  let ops = 0;

  for (const docSnap of snap.docs) {
    stats.scanned++;
    const data = docSnap.data() || {};
    const { structureId, source } = await resolver(data);

    if (source === 'already-set') {
      stats.already++;
      continue;
    }
    if (!structureId) {
      stats.skipped++;
      console.log(`  skip ${docSnap.id} (no related structureId)`);
      continue;
    }

    console.log(`  ${dryRun ? 'would-set' : 'set'} ${docSnap.id} ← ${structureId} (${source})`);
    if (!dryRun) {
      batch.update(docSnap.ref, { structureId });
      ops++;
      if (ops >= 400) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    stats.updated++;
  }

  if (!dryRun && ops > 0) {
    await batch.commit();
  }

  return { collection: name, ...stats };
}

async function main() {
  console.log(`backfill-structureId project=${PROJECT_ID} dryRun=${dryRun}`);

  const results = [];
  results.push(await backfillCollection('generatedDocuments', resolveGeneratedDocumentStructureId));
  results.push(await backfillCollection('templates', resolveViaTemplateOrCreator));
  results.push(await backfillCollection('templateVariables', resolveViaTemplateOrCreator));
  results.push(await backfillCollection('documentTags', resolveViaTemplateOrCreator));

  console.log('\n=== Summary ===');
  for (const r of results) {
    console.log(
      `${r.collection}: scanned=${r.scanned} already=${r.already} updated=${r.updated} skipped=${r.skipped}`
    );
  }
  if (dryRun) console.log('(dry-run: aucune écriture)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
