/**
 * Quotas plan gratuit (Lot 1) :
 * - init billing/current à la création d'une structure
 * - incrément freeItemsUsed sur missions/études (hors ambassadeur_event)
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  billingCurrentRef,
  defaultBillingQuota,
} from './quotaHelpers';

export {
  billingCurrentRef,
  consumeFreeSignatureToken,
  consumeFreeSignatureTokenInTransaction,
  defaultBillingQuota,
  DEFAULT_FREE_ITEMS_LIMIT,
  DEFAULT_FREE_SIGNATURE_TOKENS_LIMIT,
  SIGNATURE_QUOTA_EXHAUSTED_MSG,
} from './quotaHelpers';

const triggerConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 60,
  region: 'us-central1' as const,
  cpu: 0.25,
  maxInstances: 5,
};

async function maybeIncrementFreeItem(
  structureId: string | undefined,
  itemRef: string,
  opts?: { skip?: boolean; reason?: string }
): Promise<void> {
  if (opts?.skip) {
    console.log(`[quota] skip incrément ${itemRef}: ${opts.reason || 'exempt'}`);
    return;
  }
  if (!structureId || typeof structureId !== 'string' || structureId.trim() === '') {
    console.warn(`[quota] structureId absent pour ${itemRef} — pas d'incrément`);
    return;
  }

  const db = admin.firestore();
  const billingRef = billingCurrentRef(db, structureId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(billingRef);
    if (!snap.exists) {
      return;
    }
    const data = snap.data() || {};
    if (data.plan !== 'free') {
      return;
    }
    const refs: string[] = Array.isArray(data.freeItemsCountedRefs)
      ? data.freeItemsCountedRefs
      : [];
    if (refs.includes(itemRef)) {
      return;
    }
    const used = typeof data.freeItemsUsed === 'number' ? data.freeItemsUsed : 0;
    tx.update(billingRef, {
      freeItemsUsed: used + 1,
      freeItemsCountedRefs: FieldValue.arrayUnion(itemRef),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
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

/** Incrémente freeItemsUsed à la création d'une mission (hors ambassadeur_event). */
export const onMissionCreatedCountQuota = onDocumentCreated(
  {
    ...triggerConfig,
    document: 'missions/{missionId}',
  },
  async (event) => {
    const missionId = event.params.missionId as string;
    const data = event.data?.data() || {};
    const structureId = data.structureId as string | undefined;
    const isEvent = data.type === 'ambassadeur_event';

    await maybeIncrementFreeItem(structureId, `mission:${missionId}`, {
      skip: isEvent,
      reason: 'ambassadeur_event hors quota',
    });
  }
);

/** Incrémente freeItemsUsed à la création d'une étude. */
export const onEtudeCreatedCountQuota = onDocumentCreated(
  {
    ...triggerConfig,
    document: 'etudes/{etudeId}',
  },
  async (event) => {
    const etudeId = event.params.etudeId as string;
    const data = event.data?.data() || {};
    const structureId = data.structureId as string | undefined;

    await maybeIncrementFreeItem(structureId, `etude:${etudeId}`);
  }
);
