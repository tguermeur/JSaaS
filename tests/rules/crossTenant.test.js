/**
 * Tests d'isolation cross-tenant Firestore.
 *
 * Chaque assertion tourne sur deux variantes d'auth :
 * - sans claims (fallback getUserData)
 * - avec claims (tokenStructureId) — chemin production
 *
 * Lancer via : npm run test:rules
 */
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  createTestEnv,
  seedFixtures,
  cleanupApps,
  AUTH_VARIANTS,
  dbUnauth,
  expectReadAllow,
  expectReadDeny,
  expectCreateAllow,
  expectCreateDeny,
  expectUpdateAllow,
  expectUpdateDeny,
  expectDeleteAllow,
  expectDeleteDeny,
  STRUCTURE_A,
  USER_A,
  USER_B,
  USER_OTHER_A,
  USER_SA,
  USER_ENTREPRISE,
} from './helpers.js';

/** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment} */
let testEnv;

beforeAll(async () => {
  testEnv = await createTestEnv();
});

afterAll(async () => {
  await cleanupApps();
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await cleanupApps();
  await testEnv.clearFirestore();
  await seedFixtures();
});

/**
 * @typedef {'allow' | 'deny'} Verdict
 * @typedef {{
 *   id: string,
 *   path: string,
 *   createPath: string,
 *   createDataA: Record<string, unknown>,
 *   createDataSpoof?: Record<string, unknown>,
 *   updateData: Record<string, unknown>,
 *   read?: { a?: Verdict, b?: Verdict, member?: Verdict, sa?: Verdict, unauth?: Verdict },
 *   create?: { a?: Verdict, b?: Verdict, member?: Verdict, sa?: Verdict, unauth?: Verdict },
 *   update?: { a?: Verdict, b?: Verdict, member?: Verdict, sa?: Verdict, unauth?: Verdict },
 *   delete?: { a?: Verdict, b?: Verdict, member?: Verdict, sa?: Verdict, unauth?: Verdict },
 * }} CollectionSpec
 */

/** @type {CollectionSpec[]} */
const COLLECTIONS = [
  {
    id: 'companies',
    path: 'companies/company-a',
    createPath: 'companies/company-a-new',
    createDataA: { structureId: STRUCTURE_A, name: 'New Co A' },
    createDataSpoof: { structureId: STRUCTURE_A, name: 'Spoof' },
    updateData: { name: 'Updated Co' },
  },
  {
    id: 'missions',
    path: 'missions/mission-a',
    createPath: 'missions/mission-a-new',
    createDataA: { structureId: STRUCTURE_A, title: 'New Mission A' },
    createDataSpoof: { structureId: STRUCTURE_A, title: 'Spoof' },
    updateData: { title: 'Updated Mission' },
  },
  {
    id: 'generatedDocuments (racine)',
    path: 'generatedDocuments/gendoc-a',
    createPath: 'generatedDocuments/gendoc-a-new',
    createDataA: { structureId: STRUCTURE_A, missionId: 'mission-a' },
    createDataSpoof: { structureId: STRUCTURE_A, missionId: 'mission-a' },
    updateData: { missionId: 'mission-a' },
  },
  {
    id: 'missions/{id}/generatedDocuments',
    path: 'missions/mission-a/generatedDocuments/subgendoc-a',
    createPath: 'missions/mission-a/generatedDocuments/subgendoc-a-new',
    createDataA: { structureId: STRUCTURE_A, missionId: 'mission-a' },
    createDataSpoof: { structureId: STRUCTURE_A, missionId: 'mission-a' },
    updateData: { missionId: 'mission-a' },
  },
  {
    id: 'templates',
    path: 'templates/template-a',
    createPath: 'templates/template-a-new',
    createDataA: { structureId: STRUCTURE_A, name: 'New Template' },
    createDataSpoof: { structureId: STRUCTURE_A, name: 'Spoof' },
    updateData: { name: 'Updated Template' },
  },
  {
    id: 'templateVariables',
    path: 'templateVariables/var-a',
    createPath: 'templateVariables/var-a-new',
    createDataA: { structureId: STRUCTURE_A, key: 'newVar' },
    createDataSpoof: { structureId: STRUCTURE_A, key: 'spoof' },
    updateData: { key: 'updatedVar' },
  },
  {
    id: 'documentTags',
    path: 'documentTags/tag-a',
    createPath: 'documentTags/tag-a-new',
    createDataA: { structureId: STRUCTURE_A, label: 'New Tag' },
    createDataSpoof: { structureId: STRUCTURE_A, label: 'Spoof' },
    updateData: { label: 'Updated Tag' },
  },
  {
    id: 'templateAssignments',
    path: 'templateAssignments/assign-a',
    createPath: 'templateAssignments/assign-a-new',
    createDataA: { structureId: STRUCTURE_A, templateId: 'template-a' },
    createDataSpoof: { structureId: STRUCTURE_A, templateId: 'template-a' },
    updateData: { templateId: 'template-a' },
  },
  {
    id: 'history',
    path: 'history/hist-a',
    createPath: 'history/hist-a-new',
    createDataA: { structureId: STRUCTURE_A, action: 'create-test' },
    createDataSpoof: { structureId: STRUCTURE_A, action: 'spoof' },
    updateData: { action: 'updated' },
    // delete réservé superadmin côté client
    delete: { a: 'deny', b: 'deny', member: 'deny', sa: 'allow', unauth: 'deny' },
  },
  {
    id: 'etudes',
    path: 'etudes/etude-a',
    createPath: 'etudes/etude-a-new',
    createDataA: { structureId: STRUCTURE_A, title: 'New Étude' },
    createDataSpoof: { structureId: STRUCTURE_A, title: 'Spoof' },
    updateData: { title: 'Updated Étude' },
  },
  {
    id: 'prospects',
    path: 'prospects/prospect-a',
    createPath: 'prospects/prospect-a-new',
    createDataA: { structureId: STRUCTURE_A, name: 'New Prospect' },
    createDataSpoof: { structureId: STRUCTURE_A, name: 'Spoof' },
    updateData: { name: 'Updated Prospect' },
  },
  {
    id: 'contacts',
    path: 'contacts/contact-a',
    createPath: 'contacts/contact-a-new',
    createDataA: { structureId: STRUCTURE_A, name: 'New Contact' },
    createDataSpoof: { structureId: STRUCTURE_A, name: 'Spoof' },
    updateData: { name: 'Updated Contact' },
  },
  {
    id: 'signatureRequests',
    path: 'signatureRequests/sig-a',
    createPath: 'signatureRequests/sig-a-new',
    createDataA: { structureId: STRUCTURE_A, status: 'pending' },
    createDataSpoof: { structureId: STRUCTURE_A, status: 'pending' },
    updateData: { status: 'cancelled' },
    // écriture client interdite (Admin SDK only)
    create: { a: 'deny', b: 'deny', member: 'deny', sa: 'deny', unauth: 'deny' },
    update: { a: 'deny', b: 'deny', member: 'deny', sa: 'deny', unauth: 'deny' },
    delete: { a: 'deny', b: 'deny', member: 'deny', sa: 'deny', unauth: 'deny' },
  },
  {
    id: 'signatureRequests/{id}/events',
    path: 'signatureRequests/sig-a/events/evt-a',
    createPath: 'signatureRequests/sig-a/events/evt-a-new',
    createDataA: { type: 'viewed' },
    createDataSpoof: { type: 'spoof' },
    updateData: { type: 'updated' },
    create: { a: 'deny', b: 'deny', member: 'deny', sa: 'deny', unauth: 'deny' },
    update: { a: 'deny', b: 'deny', member: 'deny', sa: 'deny', unauth: 'deny' },
    delete: { a: 'deny', b: 'deny', member: 'deny', sa: 'deny', unauth: 'deny' },
  },
  {
    id: 'notes (mission_notes)',
    path: 'notes/note-a',
    createPath: 'notes/note-a-new',
    createDataA: { missionId: 'mission-a', createdBy: USER_A, content: 'New note' },
    createDataSpoof: { missionId: 'mission-a', createdBy: USER_B, content: 'Spoof' },
    updateData: { content: 'Updated note' },
  },
  {
    id: 'expenseNotes',
    path: 'expenseNotes/expense-a',
    createPath: 'expenseNotes/expense-a-new',
    createDataA: { missionId: 'mission-a', createdBy: USER_A, amount: 42 },
    createDataSpoof: { missionId: 'mission-a', createdBy: USER_B, amount: 1 },
    updateData: { amount: 99 },
  },
  {
    id: 'workingHours',
    path: 'workingHours/wh-a',
    createPath: 'workingHours/wh-a-new',
    createDataA: { applicationId: 'app-a', hours: 3 },
    createDataSpoof: { applicationId: 'app-a', hours: 1 },
    updateData: { hours: 5 },
  },
  {
    id: 'applications',
    path: 'applications/app-a',
    createPath: 'applications/app-a-new',
    createDataA: {
      missionId: 'mission-a',
      userId: USER_A,
      userEmail: 'a@example.com',
      submittedAt: new Date().toISOString(),
      status: 'En attente',
    },
    // userId ≠ B pour forcer canCreateApplicationViaMission (pas self-apply)
    createDataSpoof: {
      missionId: 'mission-a',
      userId: 'spoof-student',
      userEmail: 'spoof@example.com',
      submittedAt: new Date().toISOString(),
      status: 'En attente',
    },
    updateData: { status: 'Acceptée' },
    // delete applications : if false
    delete: { a: 'deny', b: 'deny', member: 'deny', sa: 'deny', unauth: 'deny' },
  },
  {
    id: 'amendments',
    path: 'amendments/amend-a',
    createPath: 'amendments/amend-a-new',
    createDataA: { missionId: 'mission-a', title: 'New Avenant' },
    createDataSpoof: { missionId: 'mission-a', title: 'Spoof' },
    updateData: { title: 'Updated Avenant' },
  },
  {
    id: 'notifications',
    path: 'notifications/notif-a',
    createPath: 'notifications/notif-a-new',
    createDataA: {
      userId: USER_A,
      type: 'admin_notification',
      structureId: STRUCTURE_A,
      title: 'New',
    },
    createDataSpoof: {
      userId: USER_A,
      type: 'admin_notification',
      structureId: STRUCTURE_A,
      title: 'Spoof',
    },
    updateData: { title: 'Updated notif' },
    // delete : owner ou SA
    delete: { a: 'allow', b: 'deny', member: 'deny', sa: 'allow', unauth: 'deny' },
  },
  {
    id: 'structures',
    path: `structures/${STRUCTURE_A}`,
    createPath: 'structures/structure-new',
    createDataA: { name: 'Should Fail For Admin' },
    createDataSpoof: { name: 'Spoof' },
    updateData: { name: 'Updated Structure A' },
    // lecture publique volontaire
    read: { a: 'allow', b: 'allow', member: 'allow', sa: 'allow', unauth: 'allow' },
    // create/delete : superadmin only ; update : permission organization
    create: { a: 'deny', b: 'deny', member: 'deny', sa: 'allow', unauth: 'deny' },
    update: { a: 'allow', b: 'deny', member: 'allow', sa: 'allow', unauth: 'deny' },
    delete: { a: 'deny', b: 'deny', member: 'deny', sa: 'allow', unauth: 'deny' },
  },
  {
    id: 'structures/{id}/permissions',
    path: `structures/${STRUCTURE_A}/permissions/mission`,
    createPath: `structures/${STRUCTURE_A}/permissions/custom-perm`,
    createDataA: {
      allowedRoles: ['admin'],
      allowedPoles: [],
      allowedMembers: [],
    },
    createDataSpoof: {
      allowedRoles: ['admin'],
      allowedPoles: [],
      allowedMembers: [],
    },
    updateData: { allowedRoles: ['admin', 'membre'] },
    // write permissions : admin structure only (pas membre)
    create: { a: 'allow', b: 'deny', member: 'deny', sa: 'allow', unauth: 'deny' },
    update: { a: 'allow', b: 'deny', member: 'deny', sa: 'allow', unauth: 'deny' },
    delete: { a: 'allow', b: 'deny', member: 'deny', sa: 'allow', unauth: 'deny' },
  },
  {
    id: 'structures/{id}/folders',
    path: `structures/${STRUCTURE_A}/folders/folder-a`,
    createPath: `structures/${STRUCTURE_A}/folders/folder-a-new`,
    createDataA: { name: 'New Folder' },
    createDataSpoof: { name: 'Spoof' },
    updateData: { name: 'Updated Folder' },
  },
  {
    id: 'structures/{id}/documents',
    path: `structures/${STRUCTURE_A}/documents/strucdoc-a`,
    createPath: `structures/${STRUCTURE_A}/documents/strucdoc-a-new`,
    createDataA: { name: 'New Struc Doc' },
    createDataSpoof: { name: 'Spoof' },
    updateData: { name: 'Updated Struc Doc' },
  },
  {
    id: 'documents (racine, liés étude)',
    path: 'documents/etudedoc-a',
    createPath: 'documents/etudedoc-a-new',
    createDataA: { etudeId: 'etude-a', name: 'New Étude Doc' },
    createDataSpoof: { etudeId: 'etude-a', name: 'Spoof' },
    updateData: { name: 'Updated Étude Doc' },
  },
];

const DEFAULT_READ = { a: 'allow', b: 'deny', member: 'allow', sa: 'allow', unauth: 'deny' };
const DEFAULT_WRITE = { a: 'allow', b: 'deny', member: 'allow', sa: 'allow', unauth: 'deny' };

/**
 * @param {Verdict} verdict
 * @param {() => Promise<void>} allowFn
 * @param {() => Promise<void>} denyFn
 */
async function expectVerdict(verdict, allowFn, denyFn) {
  if (verdict === 'allow') await allowFn();
  else await denyFn();
}

/**
 * @param {CollectionSpec} spec
 * @param {(uid: string) => FirebaseFirestore.Firestore} asUser
 */
function runCollectionMatrix(spec, asUser) {
  const read = { ...DEFAULT_READ, ...spec.read };
  const create = { ...DEFAULT_WRITE, ...spec.create };
  const update = { ...DEFAULT_WRITE, ...spec.update };
  const del = { ...DEFAULT_WRITE, ...spec.delete };
  const spoofData = spec.createDataSpoof || spec.createDataA;

  describe(spec.id, () => {
    it('read — tenant A', async () => {
      await expectVerdict(
        read.a,
        () => expectReadAllow(asUser(USER_A), spec.path),
        () => expectReadDeny(asUser(USER_A), spec.path),
      );
    });
    it('read — tenant B (cross)', async () => {
      await expectVerdict(
        read.b,
        () => expectReadAllow(asUser(USER_B), spec.path),
        () => expectReadDeny(asUser(USER_B), spec.path),
      );
    });
    it('read — membre non-admin A', async () => {
      await expectVerdict(
        read.member,
        () => expectReadAllow(asUser(USER_OTHER_A), spec.path),
        () => expectReadDeny(asUser(USER_OTHER_A), spec.path),
      );
    });
    it('read — superadmin', async () => {
      await expectVerdict(
        read.sa,
        () => expectReadAllow(asUser(USER_SA), spec.path),
        () => expectReadDeny(asUser(USER_SA), spec.path),
      );
    });
    it('read — non authentifié', async () => {
      await expectVerdict(
        read.unauth,
        () => expectReadAllow(dbUnauth(), spec.path),
        () => expectReadDeny(dbUnauth(), spec.path),
      );
    });

    it('create — tenant A', async () => {
      await expectVerdict(
        create.a,
        () => expectCreateAllow(asUser(USER_A), spec.createPath, spec.createDataA),
        () => expectCreateDeny(asUser(USER_A), spec.createPath, spec.createDataA),
      );
    });
    it('create — tenant B spoof structure A (cross)', async () => {
      await expectVerdict(
        create.b,
        () => expectCreateAllow(asUser(USER_B), `${spec.createPath}-b`, spoofData),
        () => expectCreateDeny(asUser(USER_B), `${spec.createPath}-b`, spoofData),
      );
    });
    it('create — membre non-admin A', async () => {
      await expectVerdict(
        create.member,
        () => expectCreateAllow(asUser(USER_OTHER_A), `${spec.createPath}-m`, spec.createDataA),
        () => expectCreateDeny(asUser(USER_OTHER_A), `${spec.createPath}-m`, spec.createDataA),
      );
    });
    it('create — superadmin', async () => {
      await expectVerdict(
        create.sa,
        () => expectCreateAllow(asUser(USER_SA), `${spec.createPath}-sa`, spec.createDataA),
        () => expectCreateDeny(asUser(USER_SA), `${spec.createPath}-sa`, spec.createDataA),
      );
    });
    it('create — non authentifié', async () => {
      await expectVerdict(
        create.unauth,
        () => expectCreateAllow(dbUnauth(), `${spec.createPath}-u`, spec.createDataA),
        () => expectCreateDeny(dbUnauth(), `${spec.createPath}-u`, spec.createDataA),
      );
    });

    it('update — tenant A', async () => {
      await expectVerdict(
        update.a,
        () => expectUpdateAllow(asUser(USER_A), spec.path, spec.updateData),
        () => expectUpdateDeny(asUser(USER_A), spec.path, spec.updateData),
      );
    });
    it('update — tenant B (cross)', async () => {
      await expectVerdict(
        update.b,
        () => expectUpdateAllow(asUser(USER_B), spec.path, spec.updateData),
        () => expectUpdateDeny(asUser(USER_B), spec.path, spec.updateData),
      );
    });
    it('update — membre non-admin A', async () => {
      await expectVerdict(
        update.member,
        () => expectUpdateAllow(asUser(USER_OTHER_A), spec.path, spec.updateData),
        () => expectUpdateDeny(asUser(USER_OTHER_A), spec.path, spec.updateData),
      );
    });
    it('update — superadmin', async () => {
      await expectVerdict(
        update.sa,
        () => expectUpdateAllow(asUser(USER_SA), spec.path, spec.updateData),
        () => expectUpdateDeny(asUser(USER_SA), spec.path, spec.updateData),
      );
    });
    it('update — non authentifié', async () => {
      await expectVerdict(
        update.unauth,
        () => expectUpdateAllow(dbUnauth(), spec.path, spec.updateData),
        () => expectUpdateDeny(dbUnauth(), spec.path, spec.updateData),
      );
    });

    it('delete — tenant A', async () => {
      await expectVerdict(
        del.a,
        () => expectDeleteAllow(asUser(USER_A), spec.path),
        () => expectDeleteDeny(asUser(USER_A), spec.path),
      );
    });
    it('delete — tenant B (cross)', async () => {
      // Reseed path if A already deleted in previous test within same variant —
      // beforeEach resets between tests, so path still exists for B.
      await expectVerdict(
        del.b,
        () => expectDeleteAllow(asUser(USER_B), spec.path),
        () => expectDeleteDeny(asUser(USER_B), spec.path),
      );
    });
    it('delete — membre non-admin A', async () => {
      await expectVerdict(
        del.member,
        () => expectDeleteAllow(asUser(USER_OTHER_A), spec.path),
        () => expectDeleteDeny(asUser(USER_OTHER_A), spec.path),
      );
    });
    it('delete — superadmin', async () => {
      await expectVerdict(
        del.sa,
        () => expectDeleteAllow(asUser(USER_SA), spec.path),
        () => expectDeleteDeny(asUser(USER_SA), spec.path),
      );
    });
    it('delete — non authentifié', async () => {
      await expectVerdict(
        del.unauth,
        () => expectDeleteAllow(dbUnauth(), spec.path),
        () => expectDeleteDeny(dbUnauth(), spec.path),
      );
    });
  });
}

describe('Firestore rules — isolation structureId', () => {
  for (const variant of AUTH_VARIANTS) {
    describe(variant.name, () => {
      for (const spec of COLLECTIONS) {
        runCollectionMatrix(spec, variant.dbFor);
      }

      describe('users (read)', () => {
        const otherPath = `users/${USER_OTHER_A}`;
        it('autorise la lecture d’un autre user same-tenant', async () => {
          await expectReadAllow(variant.dbFor(USER_A), otherPath);
        });
        it('refuse la lecture cross-tenant', async () => {
          await expectReadDeny(variant.dbFor(USER_B), otherPath);
        });
        it('autorise la lecture superadmin', async () => {
          await expectReadAllow(variant.dbFor(USER_SA), otherPath);
        });
        it('refuse la lecture non authentifiée', async () => {
          await expectReadDeny(dbUnauth(), otherPath);
        });
      });
    });
  }
});

describe('couverture', () => {
  it(`couvre au moins 20 collections (${COLLECTIONS.length} + users)`, () => {
    if (COLLECTIONS.length < 20) {
      throw new Error(`Attendu ≥ 20 collections, got ${COLLECTIONS.length}`);
    }
  });
});

/**
 * Couverture ciblée du helper hasPermissionOrStructureFallback
 * (missions, applications, notes, expenseNotes, workingHours, amendments,
 * missions/{id}/generatedDocuments) — deux variantes d'auth.
 */
describe('hasPermissionOrStructureFallback — isolation forcée', () => {
  const helperCollections = [
    {
      id: 'missions',
      path: 'missions/mission-a',
      createPath: 'missions/mission-helper-new',
      createData: { structureId: STRUCTURE_A, title: 'Helper Mission' },
      updateData: { title: 'Helper Updated' },
    },
    {
      id: 'missions/{id}/generatedDocuments',
      path: 'missions/mission-a/generatedDocuments/subgendoc-a',
      createPath: 'missions/mission-a/generatedDocuments/helper-new',
      createData: { structureId: STRUCTURE_A, missionId: 'mission-a' },
      updateData: { missionId: 'mission-a' },
    },
    {
      id: 'notes',
      path: 'notes/note-a',
      createPath: 'notes/note-helper-new',
      createData: { missionId: 'mission-a', createdBy: USER_A, content: 'helper' },
      updateData: { content: 'helper-upd' },
    },
    {
      id: 'expenseNotes',
      path: 'expenseNotes/expense-a',
      createPath: 'expenseNotes/expense-helper-new',
      createData: { missionId: 'mission-a', createdBy: USER_A, amount: 7 },
      updateData: { amount: 8 },
    },
    {
      id: 'workingHours',
      path: 'workingHours/wh-a',
      createPath: 'workingHours/wh-helper-new',
      createData: { applicationId: 'app-a', hours: 1 },
      updateData: { hours: 4 },
    },
    {
      id: 'amendments',
      path: 'amendments/amend-a',
      createPath: 'amendments/amend-helper-new',
      createData: { missionId: 'mission-a', title: 'Helper Amend' },
      updateData: { title: 'Helper Amend Upd' },
    },
    {
      id: 'applications',
      path: 'applications/app-a',
      createPath: 'applications/app-helper-new',
      // Force le chemin canCreateApplicationViaMission (pas self-apply) :
      // userId ≠ auth pour B, et pour A on utilise un userId différent aussi
      // pour tester le helper — A create via permission mission.
      createData: {
        missionId: 'mission-a',
        userId: 'some-student',
        userEmail: 'student@example.com',
        submittedAt: new Date().toISOString(),
        status: 'En attente',
      },
      updateData: { status: 'Acceptée' },
    },
  ];

  for (const variant of AUTH_VARIANTS) {
    describe(variant.name, () => {
      for (const spec of helperCollections) {
        describe(spec.id, () => {
          it('deny tenant B (permissionné chez lui) sur ressource A — read', async () => {
            await expectReadDeny(variant.dbFor(USER_B), spec.path);
          });
          it('deny tenant B — create spoof', async () => {
            await expectCreateDeny(variant.dbFor(USER_B), `${spec.createPath}-b`, spec.createData);
          });
          it('deny tenant B — update', async () => {
            await expectUpdateDeny(variant.dbFor(USER_B), spec.path, spec.updateData);
          });
          it('deny tenant B — delete', async () => {
            await expectDeleteDeny(variant.dbFor(USER_B), spec.path);
          });
          it('allow tenant A — read', async () => {
            await expectReadAllow(variant.dbFor(USER_A), spec.path);
          });
          it('allow tenant A — create', async () => {
            await expectCreateAllow(variant.dbFor(USER_A), `${spec.createPath}-a`, spec.createData);
          });
          it('allow superadmin — read', async () => {
            await expectReadAllow(variant.dbFor(USER_SA), spec.path);
          });
        });
      }

      describe('compte entreprise', () => {
        it('allow lecture de SA mission (companyId == uid)', async () => {
          await expectReadAllow(variant.dbFor(USER_ENTREPRISE), 'missions/mission-entreprise');
        });
        it('deny lecture d’une autre mission de la structure', async () => {
          await expectReadDeny(variant.dbFor(USER_ENTREPRISE), 'missions/mission-a');
        });
      });
    });
  }
});
