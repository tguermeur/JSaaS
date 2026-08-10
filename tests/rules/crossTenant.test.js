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
  dbAsUser,
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
  USER_ENT_A,
  USER_ENT_B,
  USER_INVITEE,
  dbAsOwner,
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
    // FAILLE : hasPermissionOrStructureFallback autorise un user permissionné
    // sur sa propre structure à lire/écrire une ressource d'un autre tenant.
    read: { b: 'allow' },
    create: { b: 'allow' },
    update: { b: 'allow' },
    delete: { b: 'allow' },
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
    read: { b: 'allow' },
    create: { b: 'allow' },
    update: { b: 'allow' },
    delete: { b: 'allow' },
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
    read: { b: 'allow' },
    create: { b: 'allow' },
    update: { b: 'allow' },
    delete: { b: 'allow' },
  },
  {
    id: 'expenseNotes',
    path: 'expenseNotes/expense-a',
    createPath: 'expenseNotes/expense-a-new',
    createDataA: { missionId: 'mission-a', createdBy: USER_A, amount: 42 },
    createDataSpoof: { missionId: 'mission-a', createdBy: USER_B, amount: 1 },
    updateData: { amount: 99 },
    read: { b: 'allow' },
    create: { b: 'allow' },
    update: { b: 'allow' },
    delete: { b: 'allow' },
  },
  {
    id: 'workingHours',
    path: 'workingHours/wh-a',
    createPath: 'workingHours/wh-a-new',
    createDataA: { applicationId: 'app-a', hours: 3 },
    createDataSpoof: { applicationId: 'app-a', hours: 1 },
    updateData: { hours: 5 },
    read: { b: 'allow' },
    create: { b: 'allow' },
    update: { b: 'allow' },
    delete: { b: 'allow' },
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
    id: 'structures/{id}/billing',
    path: `structures/${STRUCTURE_A}/billing/current`,
    createPath: `structures/${STRUCTURE_A}/billing/other`,
    createDataA: {
      plan: 'free',
      freeItemsLimit: 3,
      freeItemsUsed: 0,
      freeItemsCountedRefs: [],
      freeSignatureTokensLimit: 10,
      freeSignatureTokensUsed: 0,
    },
    createDataSpoof: {
      plan: 'paid',
      freeItemsLimit: 3,
      freeItemsUsed: 0,
      freeItemsCountedRefs: [],
      freeSignatureTokensLimit: 10,
      freeSignatureTokensUsed: 0,
    },
    updateData: { freeItemsUsed: 99 },
    read: { a: 'allow', b: 'deny', member: 'allow', sa: 'allow', unauth: 'deny' },
    create: { a: 'deny', b: 'deny', member: 'deny', sa: 'deny', unauth: 'deny' },
    update: { a: 'deny', b: 'deny', member: 'deny', sa: 'deny', unauth: 'deny' },
    delete: { a: 'deny', b: 'deny', member: 'deny', sa: 'deny', unauth: 'deny' },
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

describe('Firestore rules — company portal lot3a', () => {
  describe('companyInvites', () => {
    const path = 'companyInvites/invite-pending';

    it('autorise le destinataire à marquer accepted', async () => {
      await expectUpdateAllow(dbAsUser(USER_INVITEE), path, {
        status: 'accepted',
        acceptedBy: USER_INVITEE,
      });
    });

    it('refuse qu’un autre uid marque accepted à la place du destinataire', async () => {
      await expectUpdateDeny(dbAsUser(USER_B), path, {
        status: 'accepted',
        acceptedBy: USER_INVITEE,
      });
    });

    it('refuse create client (Admin SDK only)', async () => {
      await expectCreateDeny(dbAsUser(USER_A), 'companyInvites/new-invite', {
        email: 'x@example.com',
        companyId: 'company-a',
        status: 'pending',
      });
    });
  });

  describe('companies/{id}/documents', () => {
    const docA = 'companies/company-a/documents/doc-a';
    const docB = 'companies/company-b/documents/doc-b';
    const newDocA = 'companies/company-a/documents/doc-new';
    const newDocB = 'companies/company-b/documents/doc-new-b';
    const meta = {
      title: 'New',
      storagePath: 'companies/company-a/documents/x.pdf',
      contentType: 'application/pdf',
      byteSize: 10,
      uploadedBy: USER_A,
      uploadedByRole: 'structure',
      createdAt: new Date().toISOString(),
    };

    it('autorise entreprise A à lire/écrire ses docs', async () => {
      await expectReadAllow(dbAsUser(USER_ENT_A), docA);
      await expectCreateAllow(dbAsUser(USER_ENT_A), newDocA, {
        ...meta,
        uploadedBy: USER_ENT_A,
        uploadedByRole: 'entreprise',
      });
    });

    it('refuse entreprise A sur docs company B', async () => {
      await expectReadDeny(dbAsUser(USER_ENT_A), docB);
      await expectCreateDeny(dbAsUser(USER_ENT_A), newDocB, {
        ...meta,
        storagePath: 'companies/company-b/documents/x.pdf',
        uploadedBy: USER_ENT_A,
        uploadedByRole: 'entreprise',
      });
    });

    it('autorise staff structure A sur docs company A', async () => {
      await expectReadAllow(dbAsUser(USER_A), docA);
      await expectCreateAllow(dbAsUser(USER_A), 'companies/company-a/documents/doc-staff', meta);
    });

    it('refuse staff structure A d’écrire docs company B', async () => {
      await expectCreateDeny(dbAsUser(USER_A), newDocB, {
        ...meta,
        storagePath: 'companies/company-b/documents/x.pdf',
      });
      await expectUpdateDeny(dbAsUser(USER_A), docB, { title: 'Hacked' });
    });

    it('refuse staff structure B d’écrire docs company A', async () => {
      await expectCreateDeny(dbAsUser(USER_B), 'companies/company-a/documents/doc-b-spoof', meta);
      await expectUpdateDeny(dbAsUser(USER_B), docA, { title: 'Hacked' });
    });

    it('refuse entreprise B sur docs company A', async () => {
      await expectReadDeny(dbAsUser(USER_ENT_B), docA);
    });
  });

  describe('entreprise sans structureId — isolation JE', () => {
    it('refuse la lecture de structureTokens de la JE invitante', async () => {
      // USER_ENT_A a companyId=company-a, pas de structureId (seed helpers)
      await dbAsOwner().doc(`structureTokens/${STRUCTURE_A}`).set({
        structureId: STRUCTURE_A,
        token: 'secret-token-a',
      });
      await expectReadDeny(dbAsUser(USER_ENT_A), `structureTokens/${STRUCTURE_A}`);
    });

    it('refuse l’écriture sur programs de la JE invitante', async () => {
      await dbAsOwner().doc(`programs/${STRUCTURE_A}`).set({
        programs: ['existing'],
      });
      await expectUpdateDeny(dbAsUser(USER_ENT_A), `programs/${STRUCTURE_A}`, {
        programs: ['hacked'],
      });
    });
  });
});

describe('couverture', () => {
  it(`couvre au moins 20 collections (${COLLECTIONS.length} + users)`, () => {
    if (COLLECTIONS.length < 20) {
      throw new Error(`Attendu ≥ 20 collections, got ${COLLECTIONS.length}`);
    }
  });
});

/**
 * Garde-fous qui DOIVENT échouer tant que la faille
 * hasPermissionOrStructureFallback n'est pas corrigée.
 * Quand le fix landed, inverser en assertFails et retirer les allow B ci-dessus.
 */
describe('failles connues (documentées — ne pas « vertir » en corrigeant les expectations seules)', () => {
  it('documente les collections touchées par hasPermissionOrStructureFallback', () => {
    const affected = [
      'missions',
      'missions/{id}/generatedDocuments',
      'notes (mission_notes)',
      'expenseNotes',
      'workingHours',
    ];
    for (const id of affected) {
      const spec = COLLECTIONS.find((c) => c.id === id);
      if (!spec || spec.read?.b !== 'allow' || spec.create?.b !== 'allow') {
        throw new Error(
          `${id} devrait encore déclarer read.b=allow et create.b=allow (faille ouverte)`,
        );
      }
    }
  });
});
