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

/** Claims correspondant aux documents users seedés. */
export const USER_CLAIMS = {
  [USER_A]: { structureId: STRUCTURE_A, status: 'admin', role: 'admin' },
  [USER_B]: { structureId: STRUCTURE_B, status: 'admin', role: 'admin' },
  [USER_OTHER_A]: { structureId: STRUCTURE_A, status: 'membre', role: 'membre' },
  [USER_SA]: { status: 'superadmin', role: 'superadmin', superadmin: true },
};

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

/**
 * Auth sans custom claims — fenêtre de transition (token jusqu’à 1 h pour rafraîchir).
 * Les rules tombent alors sur le fallback getUserData().
 */
export function dbAsUser(uid) {
  return getTestDb({ sub: uid, user_id: uid });
}

/**
 * Auth avec custom claims (chemin production peuplé par userSync).
 * @param {string} uid
 * @param {{ structureId?: string, status?: string, role?: string, superadmin?: boolean }} claims
 */
export function dbAsUserWithClaims(uid, claims = {}) {
  const token = { sub: uid, user_id: uid };
  if (claims.structureId != null) token.structureId = claims.structureId;
  if (claims.status != null) token.status = claims.status;
  if (claims.role != null) token.role = claims.role;
  if (claims.superadmin != null) token.superadmin = claims.superadmin;
  return getTestDb(token);
}

/**
 * Variantes d’auth à faire tourner sur chaque assertion d’isolation.
 * Les deux doivent rendre le même verdict (fallback claims ↔ document users).
 */
export const AUTH_VARIANTS = [
  {
    name: 'sans claims (fallback getUserData)',
    dbFor: (uid) => dbAsUser(uid),
  },
  {
    name: 'avec claims (tokenStructureId)',
    dbFor: (uid) => dbAsUserWithClaims(uid, USER_CLAIMS[uid] || {}),
  },
];

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

  await db.doc(`structures/${STRUCTURE_A}`).set({ name: 'Structure A' });
  await db.doc(`structures/${STRUCTURE_B}`).set({ name: 'Structure B' });

  // Permissions module mission — nécessaires pour hasPermission / canWritePage
  for (const sid of [STRUCTURE_A, STRUCTURE_B]) {
    for (const permId of ['mission', 'mission_read', 'organization']) {
      await db.doc(`structures/${sid}/permissions/${permId}`).set({
        allowedRoles: ['admin', 'membre', 'admin_structure'],
        allowedPoles: [],
        allowedMembers: [],
      });
    }
  }

  await db.doc('companies/company-a').set({
    structureId: STRUCTURE_A,
    name: 'Company A',
  });
  await db.doc('missions/mission-a').set({
    structureId: STRUCTURE_A,
    title: 'Mission A',
    isPublished: true,
  });
  await db.doc('applications/app-a').set({
    missionId: 'mission-a',
    userId: USER_A,
    structureId: STRUCTURE_A,
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
  await db.doc('missions/mission-a/generatedDocuments/subgendoc-a').set({
    structureId: STRUCTURE_A,
    missionId: 'mission-a',
  });
  await db.doc('history/hist-a').set({
    structureId: STRUCTURE_A,
    action: 'test',
  });
  await db.doc('etudes/etude-a').set({
    structureId: STRUCTURE_A,
    title: 'Étude A',
  });
  await db.doc('prospects/prospect-a').set({
    structureId: STRUCTURE_A,
    name: 'Prospect A',
  });
  await db.doc('contacts/contact-a').set({
    structureId: STRUCTURE_A,
    name: 'Contact A',
  });
  await db.doc('signatureRequests/sig-a').set({
    structureId: STRUCTURE_A,
    status: 'pending',
  });
  await db.doc('signatureRequests/sig-a/events/evt-a').set({
    type: 'created',
    at: new Date().toISOString(),
  });
  await db.doc('notes/note-a').set({
    missionId: 'mission-a',
    createdBy: USER_A,
    content: 'Note A',
  });
  await db.doc('expenseNotes/expense-a').set({
    missionId: 'mission-a',
    createdBy: USER_A,
    amount: 10,
  });
  await db.doc('workingHours/wh-a').set({
    applicationId: 'app-a',
    hours: 2,
  });
  await db.doc('notifications/notif-a').set({
    userId: USER_A,
    type: 'admin_notification',
    structureId: STRUCTURE_A,
    title: 'Notif A',
  });
  await db.doc(`structures/${STRUCTURE_A}/folders/folder-a`).set({
    name: 'Folder A',
  });
  await db.doc(`structures/${STRUCTURE_A}/documents/strucdoc-a`).set({
    name: 'Structure Doc A',
  });
  await db.doc('documents/etudedoc-a').set({
    etudeId: 'etude-a',
    name: 'Étude Doc A',
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

/** @param {FirebaseFirestore.Firestore} db @param {string} path @param {object} data */
export async function expectCreateAllow(db, path, data) {
  await assertSucceeds(db.doc(path).set(data));
}

/** @param {FirebaseFirestore.Firestore} db @param {string} path @param {object} data */
export async function expectCreateDeny(db, path, data) {
  await assertFails(db.doc(path).set(data));
}

/** @param {FirebaseFirestore.Firestore} db @param {string} path @param {object} data */
export async function expectUpdateAllow(db, path, data) {
  await assertSucceeds(db.doc(path).update(data));
}

/** @param {FirebaseFirestore.Firestore} db @param {string} path @param {object} data */
export async function expectUpdateDeny(db, path, data) {
  await assertFails(db.doc(path).update(data));
}

/** @param {FirebaseFirestore.Firestore} db @param {string} path */
export async function expectDeleteAllow(db, path) {
  await assertSucceeds(db.doc(path).delete());
}

/** @param {FirebaseFirestore.Firestore} db @param {string} path */
export async function expectDeleteDeny(db, path) {
  await assertFails(db.doc(path).delete());
}
