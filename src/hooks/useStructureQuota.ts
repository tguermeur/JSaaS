import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';

export type StructurePlan = 'free' | 'paid';
export type FreeQuotaKind = 'items' | 'signatures';

export const DEFAULT_FREE_ITEMS_LIMIT = 3;
export const DEFAULT_FREE_SIGNATURE_TOKENS_LIMIT = 10;

export const SIGNATURE_QUOTA_EXHAUSTED_MSG =
  'Quota de signatures gratuites atteint. Passez au plan payant pour continuer.';

export interface StructureQuotaState {
  plan: StructurePlan;
  freeItemsUsed: number;
  freeItemsLimit: number;
  freeSignatureTokensUsed: number;
  freeSignatureTokensLimit: number;
  isItemQuotaExceeded: boolean;
  isSignatureQuotaExceeded: boolean;
  loading: boolean;
}

const PAID_DEFAULT: StructureQuotaState = {
  plan: 'paid',
  freeItemsUsed: 0,
  freeItemsLimit: DEFAULT_FREE_ITEMS_LIMIT,
  freeSignatureTokensUsed: 0,
  freeSignatureTokensLimit: DEFAULT_FREE_SIGNATURE_TOKENS_LIMIT,
  isItemQuotaExceeded: false,
  isSignatureQuotaExceeded: false,
  loading: false,
};

function parseBillingData(data: Record<string, unknown> | undefined): Omit<StructureQuotaState, 'loading'> {
  const plan: StructurePlan = data?.plan === 'free' ? 'free' : 'paid';
  const freeItemsLimit =
    typeof data?.freeItemsLimit === 'number' ? data.freeItemsLimit : DEFAULT_FREE_ITEMS_LIMIT;
  const freeItemsUsed = typeof data?.freeItemsUsed === 'number' ? data.freeItemsUsed : 0;
  const freeSignatureTokensLimit =
    typeof data?.freeSignatureTokensLimit === 'number'
      ? data.freeSignatureTokensLimit
      : DEFAULT_FREE_SIGNATURE_TOKENS_LIMIT;
  const freeSignatureTokensUsed =
    typeof data?.freeSignatureTokensUsed === 'number' ? data.freeSignatureTokensUsed : 0;

  return {
    plan,
    freeItemsUsed,
    freeItemsLimit,
    freeSignatureTokensUsed,
    freeSignatureTokensLimit,
    isItemQuotaExceeded: plan === 'free' && freeItemsUsed >= freeItemsLimit,
    isSignatureQuotaExceeded: plan === 'free' && freeSignatureTokensUsed >= freeSignatureTokensLimit,
  };
}

/**
 * Confirme via une relecture one-shot de billing/current que le quota free est bien atteint.
 * Ne jamais inférer le quota uniquement depuis permission-denied / resource-exhausted.
 */
export async function confirmFreeQuotaExceeded(
  structureId: string | undefined | null,
  kind: FreeQuotaKind
): Promise<boolean> {
  if (!structureId) return false;
  try {
    const snap = await getDoc(doc(db, 'structures', structureId, 'billing', 'current'));
    if (!snap.exists()) return false;
    const parsed = parseBillingData(snap.data() as Record<string, unknown>);
    if (parsed.plan !== 'free') return false;
    return kind === 'items' ? parsed.isItemQuotaExceeded : parsed.isSignatureQuotaExceeded;
  } catch {
    return false;
  }
}

export function useStructureQuota(structureIdOverride?: string | null): StructureQuotaState {
  const { userData } = useAuth();
  const structureId = structureIdOverride ?? userData?.structureId ?? '';
  const [state, setState] = useState<StructureQuotaState>({
    ...PAID_DEFAULT,
    loading: Boolean(structureId),
  });

  useEffect(() => {
    if (!structureId) {
      setState(PAID_DEFAULT);
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));
    const ref = doc(db, 'structures', structureId, 'billing', 'current');
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setState(PAID_DEFAULT);
          return;
        }
        setState({
          ...parseBillingData(snap.data() as Record<string, unknown>),
          loading: false,
        });
      },
      () => {
        // Erreur de lecture → ne jamais bloquer l'UI
        setState(PAID_DEFAULT);
      }
    );

    return () => unsubscribe();
  }, [structureId]);

  return state;
}
