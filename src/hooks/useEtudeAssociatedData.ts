import { useCallback, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';

export const ASSOCIATED_QUERY_LIMIT = 100;

/**
 * Charge les données associées à une étude (budget, planning, documents, etc.)
 * avec des requêtes bornées — à appeler à la demande (onglet actif).
 */
export function useEtudeAssociatedData(etudeId: string | undefined, structureId: string | undefined) {
  const [loading, setLoading] = useState(false);
  const [budgetItems, setBudgetItems] = useState<Record<string, unknown>[]>([]);
  const [planningTasks, setPlanningTasks] = useState<Record<string, unknown>[]>([]);
  const [documents, setDocuments] = useState<Record<string, unknown>[]>([]);

  const load = useCallback(async () => {
    if (!etudeId || !db) return;
    setLoading(true);
    try {
      const [budgetSnap, planningSnap, docsSnap] = await Promise.all([
        getDocs(
          query(collection(db, 'budgetItems'), where('etudeId', '==', etudeId), limit(ASSOCIATED_QUERY_LIMIT))
        ),
        getDocs(
          query(collection(db, 'planningTasks'), where('etudeId', '==', etudeId), limit(ASSOCIATED_QUERY_LIMIT))
        ),
        getDocs(
          query(collection(db, 'documents'), where('etudeId', '==', etudeId), limit(ASSOCIATED_QUERY_LIMIT))
        ),
      ]);
      setBudgetItems(budgetSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setPlanningTasks(planningSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setDocuments(docsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } finally {
      setLoading(false);
    }
  }, [etudeId, structureId]);

  return { loading, budgetItems, planningTasks, documents, load };
}
