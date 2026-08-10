/**
 * Tests règles Firestore — quotas plan gratuit (Lot 1).
 * Lancer via : npm run test:rules
 */
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  createTestEnv,
  seedFixtures,
  cleanupApps,
  AUTH_VARIANTS,
  dbAsOwner,
  expectReadAllow,
  expectReadDeny,
  expectCreateAllow,
  expectCreateDeny,
  expectUpdateDeny,
  STRUCTURE_A,
  USER_A,
  USER_B,
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

async function setBilling(structureId, overrides) {
  const db = dbAsOwner();
  await db.doc(`structures/${structureId}/billing/current`).set({
    plan: 'free',
    freeItemsLimit: 3,
    freeItemsUsed: 0,
    freeItemsCountedRefs: [],
    freeSignatureTokensLimit: 10,
    freeSignatureTokensUsed: 0,
    updatedAt: new Date().toISOString(),
    ...overrides,
  });
}

describe('quota plan gratuit — billing access', () => {
  for (const variant of AUTH_VARIANTS) {
    describe(variant.name, () => {
      it('membre structure A lit billing A', async () => {
        await expectReadAllow(
          variant.dbFor(USER_A),
          `structures/${STRUCTURE_A}/billing/current`
        );
      });

      it('membre structure B ne lit pas billing A', async () => {
        await expectReadDeny(
          variant.dbFor(USER_B),
          `structures/${STRUCTURE_A}/billing/current`
        );
      });

      it('superadmin lit billing A', async () => {
        await expectReadAllow(
          variant.dbFor(USER_SA),
          `structures/${STRUCTURE_A}/billing/current`
        );
      });

      it('client auth structure A ne peut pas écrire billing', async () => {
        await expectUpdateDeny(
          variant.dbFor(USER_A),
          `structures/${STRUCTURE_A}/billing/current`,
          { freeItemsUsed: 99 }
        );
      });

      it('client auth structure B ne peut pas écrire billing A', async () => {
        await expectUpdateDeny(
          variant.dbFor(USER_B),
          `structures/${STRUCTURE_A}/billing/current`,
          { freeItemsUsed: 99 }
        );
      });
    });
  }
});

describe('quota plan gratuit — create missions/études', () => {
  for (const variant of AUTH_VARIANTS) {
    describe(variant.name, () => {
      it('bloque la 4e mission en plan free saturé', async () => {
        await setBilling(STRUCTURE_A, { plan: 'free', freeItemsUsed: 3 });
        await expectCreateDeny(variant.dbFor(USER_A), 'missions/mission-quota-blocked', {
          structureId: STRUCTURE_A,
          title: '4th mission',
        });
      });

      it('bloque la 4e étude en plan free saturé', async () => {
        await setBilling(STRUCTURE_A, { plan: 'free', freeItemsUsed: 3 });
        await expectCreateDeny(variant.dbFor(USER_A), 'etudes/etude-quota-blocked', {
          structureId: STRUCTURE_A,
          title: '4th etude',
        });
      });

      it('autorise une mission en plan paid même si used >= limit', async () => {
        await setBilling(STRUCTURE_A, { plan: 'paid', freeItemsUsed: 99 });
        await expectCreateAllow(variant.dbFor(USER_A), 'missions/mission-quota-paid', {
          structureId: STRUCTURE_A,
          title: 'Paid mission',
        });
      });

      it('autorise une étude en plan paid même si used >= limit', async () => {
        await setBilling(STRUCTURE_A, { plan: 'paid', freeItemsUsed: 99 });
        await expectCreateAllow(variant.dbFor(USER_A), 'etudes/etude-quota-paid', {
          structureId: STRUCTURE_A,
          title: 'Paid etude',
        });
      });

      it('superadmin crée une mission même en free saturé', async () => {
        await setBilling(STRUCTURE_A, { plan: 'free', freeItemsUsed: 3 });
        await expectCreateAllow(variant.dbFor(USER_SA), 'missions/mission-quota-sa', {
          structureId: STRUCTURE_A,
          title: 'SA mission',
        });
      });

      it('ambassadeur_event créable même en free saturé', async () => {
        await setBilling(STRUCTURE_A, { plan: 'free', freeItemsUsed: 3 });
        await expectCreateAllow(variant.dbFor(USER_A), 'missions/mission-quota-event', {
          structureId: STRUCTURE_A,
          title: 'Event',
          type: 'ambassadeur_event',
        });
      });

      it('autorise une mission en free avec used < limit', async () => {
        await setBilling(STRUCTURE_A, { plan: 'free', freeItemsUsed: 2 });
        await expectCreateAllow(variant.dbFor(USER_A), 'missions/mission-quota-ok', {
          structureId: STRUCTURE_A,
          title: '3rd mission',
        });
      });
    });
  }
});
