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
export const ONBOARDING_IMPORT_MAX_ATTEMPTS = 3;

export const SIGNATURE_QUOTA_EXHAUSTED_MSG =
  'Quota de signatures gratuites atteint. Passez au plan payant pour continuer.';

export const ONBOARDING_IMPORT_ATTEMPTS_EXHAUSTED_MSG =
  'Quota d’imports d’onboarding atteint (3 tentatives maximum).';

export const ONBOARDING_IMPORT_DAILY_LIMIT_MSG =
  'Un import gratuit par jour maximum, réessayez demain.';

/** Date du jour en UTC au format YYYY-MM-DD. */
export function todayUtcYmd(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

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

/**
 * Réserve une tentative d’import onboarding (max 3 total, 1 par jour UTC).
 * À appeler AVANT le traitement : consomme même si l’import échoue ensuite.
 *
 * `todayUtc` injectable pour les tests (YYYY-MM-DD).
 */
export async function reserveOnboardingImportAttempt(
  db: Firestore,
  structureId: string,
  opts?: { fieldValue?: typeof FieldValue; todayUtc?: string }
): Promise<void> {
  const fv = opts?.fieldValue ?? FieldValue;
  const today = opts?.todayUtc ?? todayUtcYmd();
  const billingRef = billingCurrentRef(db, structureId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(billingRef);
    if (!snap.exists) {
      throw new HttpsError(
        'failed-precondition',
        'Billing introuvable pour cette structure.'
      );
    }
    const data = snap.data() || {};
    const attemptsUsed =
      typeof data.onboardingImportAttemptsUsed === 'number'
        ? data.onboardingImportAttemptsUsed
        : 0;
    const lastAttemptDate =
      typeof data.onboardingImportLastAttemptDate === 'string'
        ? data.onboardingImportLastAttemptDate
        : null;

    if (attemptsUsed >= ONBOARDING_IMPORT_MAX_ATTEMPTS) {
      throw new HttpsError('resource-exhausted', ONBOARDING_IMPORT_ATTEMPTS_EXHAUSTED_MSG);
    }
    if (lastAttemptDate === today) {
      throw new HttpsError('resource-exhausted', ONBOARDING_IMPORT_DAILY_LIMIT_MSG);
    }

    tx.update(billingRef, {
      onboardingImportAttemptsUsed: attemptsUsed + 1,
      onboardingImportLastAttemptDate: today,
      updatedAt: fv.serverTimestamp(),
    });
  });
}
