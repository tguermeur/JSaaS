/**
 * Fixtures et helpers pour les tests d'isolation multi-tenant Firestore.
 * Les tests attendent le comportement SÉCURISÉ (structureId requis) — Phase 1.
 *
 * On importe @firebase/app-compat + firestore-compat (même instance) plutôt que
 * firebase/compat/* : ce dernier résout un app-compat imbriqué ≠ hoisté, et
 * app.firestore() reste undefined.
 */
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import firebase from '@firebase/app-compat';
import '@firebase/firestore-compat';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

/** Namespace compat (default export ou module lui-même). */
const fb = firebase.default ?? firebase;

export const PROJECT_ID = 'demo-jsaas-rules';
export const EMULATOR_HOST = '127.0.0.1';
export const EMULATOR_PORT = 8080;

export const STRUCTURE_A = 'structure-a';
export const STRUCTURE_B = 'structure-b';

export const USER_A = 'user-tenant-a';
export const USER_B = 'user-tenant-b';
export const USER_OTHER_A = 'user-other-a';
export const USER_SA = 'user-superadmin';

export { assertFails, assertSucceeds };

/** @type {import('@firebase/app-compat').FirebaseNamespace['apps']} */
const liveApps = [];

/**
 * @param {string | object | undefined} mockUserToken
 */
export function getTestDb(mockUserToken) {
  if (typeof fb.firestore !== 'function') {
    throw new Error(
      `firebase.firestore unavailable (SDK ${fb.SDK_VERSION}). Compat registration failed.`,
    );
  }
  const app = fb.initializeApp(
    { projectId: PROJECT_ID },
    `rules-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  liveApps.push(app);
  const db = app.firestore();
  if (mockUserToken === undefined) {
    db.useEmulator(EMULATOR_HOST, EMULATOR_PORT);
  } else {
    db.useEmulator(EMULATOR_HOST, EMULATOR_PORT, { mockUserToken });
  }
  return db;
}

export function dbAsUser(uid) {
  return getTestDb({ sub: uid, user_id: uid });
}

export function dbUnauth() {
  return getTestDb(undefined);
}

export function dbAsOwner() {
  return getTestDb('owner');
}

/**
 * @returns {Promise<import('@firebase/rules-unit-testing').RulesTestEnvironment>}
 */
export async function createTestEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(ROOT, 'firestore.rules'), 'utf8'),
      host: EMULATOR_HOST,
      port: EMULATOR_PORT,
    },
  });
}

export async function seedFixtures() {
  const db = dbAsOwner();

  await db.doc(`users/${USER_A}`).set({
    structureId: STRUCTURE_A,
    status: 'admin',
    role: 'admin',
    email: 'a@example.com',
  });
  await db.doc(`users/${USER_B}`).set({
    structureId: STRUCTURE_B,
    status: 'admin',
    role: 'admin',
    email: 'b@example.com',
  });
  await db.doc(`users/${USER_OTHER_A}`).set({
    structureId: STRUCTURE_A,
    status: 'membre',
    role: 'membre',
    email: 'other-a@example.com',
  });
  await db.doc(`users/${USER_SA}`).set({
    status: 'superadmin',
    role: 'superadmin',
    email: 'sa@example.com',
  });

  await db.doc('companies/company-a').set({
    structureId: STRUCTURE_A,
    name: 'Company A',
  });
  await db.doc('missions/mission-a').set({
    structureId: STRUCTURE_A,
    title: 'Mission A',
    isPublished: true,
  });
  await db.doc('templates/template-a').set({
    structureId: STRUCTURE_A,
    name: 'Template A',
  });
  await db.doc('templateVariables/var-a').set({
    structureId: STRUCTURE_A,
    key: 'varA',
  });
  await db.doc('documentTags/tag-a').set({
    structureId: STRUCTURE_A,
    label: 'Tag A',
  });
  await db.doc('templateAssignments/assign-a').set({
    structureId: STRUCTURE_A,
    templateId: 'template-a',
  });
  await db.doc('generatedDocuments/gendoc-a').set({
    structureId: STRUCTURE_A,
    missionId: 'mission-a',
  });
  await db.doc('history/hist-a').set({
    structureId: STRUCTURE_A,
    action: 'test',
  });
}

export async function cleanupApps() {
  await Promise.all(
    liveApps.splice(0).map((app) => app.delete().catch(() => undefined)),
  );
}

/** @param {FirebaseFirestore.Firestore} db @param {string} path */
export async function expectReadAllow(db, path) {
  await assertSucceeds(db.doc(path).get());
}

/** @param {FirebaseFirestore.Firestore} db @param {string} path */
export async function expectReadDeny(db, path) {
  await assertFails(db.doc(path).get());
}
