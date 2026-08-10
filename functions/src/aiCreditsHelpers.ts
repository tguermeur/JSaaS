/**
 * Comptage usages IA (best-effort, sans limite ni blocage).
 * Importable en tests — pas de dépendance triggers.
 */

import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { billingCurrentRef } from './quotaHelpers';

export type AiCreditFeature =
  | 'import_mapping'
  | 'import_normalize'
  | 'prospect_analysis'
  | 'contact_message'
  | string;

/**
 * Incrémente aiCreditsUsed + aiCreditsByFeature.{feature} sur billing/current.
 * No-op propre si structureId vide ou doc billing absent.
 * Ne throw jamais pour quota — uniquement des erreurs Firestore éventuelles
 * (à catcher côté callables).
 */
export async function recordAiCreditUsage(
  db: Firestore,
  structureId: string | undefined,
  feature: AiCreditFeature,
  opts?: { fieldValue?: typeof FieldValue }
): Promise<void> {
  if (!structureId || typeof structureId !== 'string' || structureId.trim() === '') {
    console.warn(`[aiCredits] structureId absent pour feature=${feature} — pas d'incrément`);
    return;
  }
  if (!feature || typeof feature !== 'string' || feature.trim() === '') {
    console.warn(`[aiCredits] feature vide — pas d'incrément (structure=${structureId})`);
    return;
  }

  const fv = opts?.fieldValue ?? FieldValue;
  const billingRef = billingCurrentRef(db, structureId);
  const featureKey = feature.trim();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(billingRef);
    if (!snap.exists) {
      console.warn(
        `[aiCredits] billing/current absent pour structure=${structureId} feature=${featureKey} — no-op`
      );
      return;
    }
    tx.update(billingRef, {
      aiCreditsUsed: fv.increment(1),
      [`aiCreditsByFeature.${featureKey}`]: fv.increment(1),
      updatedAt: fv.serverTimestamp(),
    });
  });
}

/**
 * Best-effort : wrap recordAiCreditUsage, log les erreurs, ne propage jamais.
 */
export async function recordAiCreditUsageSafe(
  db: Firestore,
  structureId: string | undefined,
  feature: AiCreditFeature,
  opts?: { fieldValue?: typeof FieldValue }
): Promise<void> {
  try {
    await recordAiCreditUsage(db, structureId, feature, opts);
  } catch (err) {
    console.warn(
      `[aiCredits] échec incrément feature=${feature} structure=${structureId}:`,
      err
    );
  }
}
