/**
 * Quotas plan gratuit (Lot 1) :
 * - init billing/current à la création d'une structure
 * - incrément freeItemsUsed sur missions/études (hors ambassadeur_event)
 * - incrément à l'assignation structureId (update mission empty → non-vide)
 */

import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import {
  billingCurrentRef,
  defaultBillingQuota,
  maybeIncrementFreeItem,
} from './quotaHelpers';

export {
  billingCurrentRef,
  consumeFreeSignatureToken,
  consumeFreeSignatureTokenInTransaction,
  defaultBillingQuota,
  maybeIncrementFreeItem,
  reserveOnboardingImportAttempt,
  DEFAULT_FREE_ITEMS_LIMIT,
  DEFAULT_FREE_SIGNATURE_TOKENS_LIMIT,
  ONBOARDING_IMPORT_MAX_ATTEMPTS,
  SIGNATURE_QUOTA_EXHAUSTED_MSG,
} from './quotaHelpers';

const triggerConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 60,
  region: 'us-central1' as const,
  cpu: 0.25,
  maxInstances: 5,
};

function isEmptyStructureId(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

/** Initialise billing/current dès qu'une structure est créée. */
export const onStructureCreatedInitQuota = onDocumentCreated(
  {
    ...triggerConfig,
    document: 'structures/{structureId}',
  },
  async (event) => {
    const structureId = event.params.structureId as string;
    if (!structureId) return;

    const db = admin.firestore();
    const billingRef = billingCurrentRef(db, structureId);
    const existing = await billingRef.get();
    if (existing.exists) {
      return;
    }
    await billingRef.set(defaultBillingQuota('free'));
    console.log(`[quota] billing/current initialisé pour structure ${structureId}`);
  }
);

/** Incrémente freeItemsUsed à la création d'une mission (hors ambassadeur_event / onboarding). */
export const onMissionCreatedCountQuota = onDocumentCreated(
  {
    ...triggerConfig,
    document: 'missions/{missionId}',
  },
  async (event) => {
    const missionId = event.params.missionId as string;
    const data = event.data?.data() || {};
    const structureId = data.structureId as string | undefined;
    const isOnboardingImport = data.importedViaOnboarding === true;
    const isEvent = data.type === 'ambassadeur_event';
    const skip = isOnboardingImport || isEvent;
    const reason = isOnboardingImport
      ? 'onboarding import hors quota'
      : 'ambassadeur_event hors quota';

    await maybeIncrementFreeItem(admin.firestore(), structureId, `mission:${missionId}`, {
      skip,
      reason,
    });
  }
);

/**
 * Incrémente freeItemsUsed quand une mission reçoit son premier structureId
 * (cas entreprise → assignation JE). Idempotent avec onCreate via freeItemsCountedRefs.
 */
export const onMissionUpdatedCountQuota = onDocumentUpdated(
  {
    ...triggerConfig,
    document: 'missions/{missionId}',
  },
  async (event) => {
    const missionId = event.params.missionId as string;
    const before = event.data?.before.data() || {};
    const after = event.data?.after.data() || {};

    const beforeSid = before.structureId as string | undefined;
    const afterSid = after.structureId as string | undefined;

    if (!isEmptyStructureId(beforeSid) || isEmptyStructureId(afterSid)) {
      return;
    }

    const isEvent = after.type === 'ambassadeur_event';
    await maybeIncrementFreeItem(admin.firestore(), afterSid, `mission:${missionId}`, {
      skip: isEvent,
      reason: 'ambassadeur_event hors quota',
    });
  }
);

/** Incrémente freeItemsUsed à la création d'une étude (hors onboarding import). */
export const onEtudeCreatedCountQuota = onDocumentCreated(
  {
    ...triggerConfig,
    document: 'etudes/{etudeId}',
  },
  async (event) => {
    const etudeId = event.params.etudeId as string;
    const data = event.data?.data() || {};
    const structureId = data.structureId as string | undefined;
    const isOnboardingImport = data.importedViaOnboarding === true;

    await maybeIncrementFreeItem(admin.firestore(), structureId, `etude:${etudeId}`, {
      skip: isOnboardingImport,
      reason: 'onboarding import hors quota',
    });
  }
);
