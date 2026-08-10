/**
 * Helpers quota plan gratuit (sans triggers Cloud Functions — importables en tests).
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import type {
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  Transaction,
} from 'firebase-admin/firestore';

export type StructurePlan = 'free' | 'paid';

export const DEFAULT_FREE_ITEMS_LIMIT = 3;
export const DEFAULT_FREE_SIGNATURE_TOKENS_LIMIT = 10;

export const SIGNATURE_QUOTA_EXHAUSTED_MSG =
  'Quota de signatures gratuites atteint. Passez au plan payant pour continuer.';

export function billingCurrentRef(db: Firestore, structureId: string) {
  return db.collection('structures').doc(structureId).collection('billing').doc('current');
}

export function defaultBillingQuota(plan: StructurePlan = 'free') {
  return {
    plan,
    freeItemsLimit: DEFAULT_FREE_ITEMS_LIMIT,
    freeItemsUsed: 0,
    freeItemsCountedRefs: [] as string[],
    freeSignatureTokensLimit: DEFAULT_FREE_SIGNATURE_TOKENS_LIMIT,
    freeSignatureTokensUsed: 0,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

/**
 * Consomme 1 token de signature free dans une transaction existante.
 * - billing absent ou plan !== 'free' → no-op
 * - free et used >= limit → HttpsError resource-exhausted
 * - sinon incrémente freeSignatureTokensUsed
 *
 * `fieldValue` optionnel pour les tests (évite les dual-package FieldValue).
 */
export function consumeFreeSignatureTokenInTransaction(
  tx: Transaction,
  billingRef: DocumentReference,
  billingSnap: DocumentSnapshot,
  fieldValue: typeof FieldValue = FieldValue
): void {
  if (!billingSnap.exists) {
    return;
  }
  const data = billingSnap.data() || {};
  if (data.plan !== 'free') {
    return;
  }
  const used = typeof data.freeSignatureTokensUsed === 'number' ? data.freeSignatureTokensUsed : 0;
  const limit =
    typeof data.freeSignatureTokensLimit === 'number'
      ? data.freeSignatureTokensLimit
      : DEFAULT_FREE_SIGNATURE_TOKENS_LIMIT;
  if (used >= limit) {
    throw new HttpsError('resource-exhausted', SIGNATURE_QUOTA_EXHAUSTED_MSG);
  }
  tx.update(billingRef, {
    freeSignatureTokensUsed: used + 1,
    updatedAt: fieldValue.serverTimestamp(),
  });
}

/**
 * Incrémente freeItemsUsed si plan free et ref pas déjà comptée.
 * `fieldValue` optionnel pour les tests (évite dual-package FieldValue).
 */
export async function maybeIncrementFreeItem(
  db: Firestore,
  structureId: string | undefined,
  itemRef: string,
  opts?: { skip?: boolean; reason?: string; fieldValue?: typeof FieldValue }
): Promise<void> {
  if (opts?.skip) {
    console.log(`[quota] skip incrément ${itemRef}: ${opts.reason || 'exempt'}`);
    return;
  }
  if (!structureId || typeof structureId !== 'string' || structureId.trim() === '') {
    console.warn(`[quota] structureId absent pour ${itemRef} — pas d'incrément`);
    return;
  }

  const fv = opts?.fieldValue ?? FieldValue;
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
      freeItemsCountedRefs: fv.arrayUnion(itemRef),
      updatedAt: fv.serverTimestamp(),
    });
  });
}

/**
 * Helper autonome (tests / callables) : check + incrément signature dans une transaction.
 */
export async function consumeFreeSignatureToken(
  db: Firestore,
  structureId: string,
  fieldValue: typeof FieldValue = FieldValue
): Promise<void> {
  const billingRef = billingCurrentRef(db, structureId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(billingRef);
    consumeFreeSignatureTokenInTransaction(tx, billingRef, snap, fieldValue);
  });
}
