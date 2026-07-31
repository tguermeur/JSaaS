/**
 * Tests d'isolation cross-tenant Firestore (Phase 2).
 *
 * Attendent le comportement SÉCURISÉ : lecture limitée au même structureId
 * (sauf self / superadmin où applicable). Si Phase 1 n'a pas encore patché
 * firestore.rules, ces tests échoueront volontairement.
 *
 * Lancer via : npm run test:rules
 */
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  createTestEnv,
  seedFixtures,
  cleanupApps,
  dbAsUser,
  dbUnauth,
  expectReadAllow,
  expectReadDeny,
  USER_A,
  USER_B,
  USER_OTHER_A,
  USER_SA,
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
 * Matrice standard : same-tenant allow, cross-tenant deny, SA allow, unauth deny.
 * @param {string} label
 * @param {string} path
 */
function describeCrossTenantRead(label, path) {
  describe(label, () => {
    it('autorise la lecture same-tenant', async () => {
      await expectReadAllow(dbAsUser(USER_A), path);
    });

    it('refuse la lecture cross-tenant', async () => {
      await expectReadDeny(dbAsUser(USER_B), path);
    });

    it('autorise la lecture superadmin', async () => {
      await expectReadAllow(dbAsUser(USER_SA), path);
    });

    it('refuse la lecture non authentifiée', async () => {
      await expectReadDeny(dbUnauth(), path);
    });
  });
}

describe('Firestore rules — isolation structureId', () => {
  describeCrossTenantRead('companies (déjà OK)', 'companies/company-a');
  describeCrossTenantRead('missions', 'missions/mission-a');
  describeCrossTenantRead('generatedDocuments', 'generatedDocuments/gendoc-a');
  describeCrossTenantRead('templates', 'templates/template-a');
  describeCrossTenantRead('templateVariables', 'templateVariables/var-a');
  describeCrossTenantRead('documentTags', 'documentTags/tag-a');
  describeCrossTenantRead('templateAssignments', 'templateAssignments/assign-a');
  describeCrossTenantRead('history', 'history/hist-a');

  describe('users (read)', () => {
    const otherPath = `users/${USER_OTHER_A}`;

    it('autorise la lecture d’un autre user same-tenant', async () => {
      await expectReadAllow(dbAsUser(USER_A), otherPath);
    });

    it('refuse la lecture cross-tenant', async () => {
      await expectReadDeny(dbAsUser(USER_B), otherPath);
    });

    it('autorise la lecture superadmin', async () => {
      await expectReadAllow(dbAsUser(USER_SA), otherPath);
    });

    it('refuse la lecture non authentifiée', async () => {
      await expectReadDeny(dbUnauth(), otherPath);
    });
  });
});
