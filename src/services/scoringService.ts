import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ScoringSettings } from '../types/scoring';
import { DEFAULT_SCORING_WEIGHTS } from '../types/scoring';

export async function computeProspectScores(structureId: string): Promise<{ updated: number }> {
  const functions = getFunctions();
  const fn = httpsCallable<{ structureId: string }, { success: boolean; updated: number }>(
    functions,
    'computeProspectScores'
  );
  const res = await fn({ structureId });
  const data = res.data;
  if (!data?.success) throw new Error('Échec du calcul des scores');
  return { updated: data.updated };
}

export interface RelanceSuggestion {
  id: string;
  nom: string;
  entreprise?: string;
  statut: string;
  dateRecontact?: string;
  lastActivityAt?: string | null;
  daysSinceContact: number | null;
  reason: string;
}

export async function getRelanceSuggestions(
  structureId: string,
  maxResults = 20
): Promise<RelanceSuggestion[]> {
  const functions = getFunctions();
  const fn = httpsCallable<
    { structureId: string; maxResults?: number },
    { success: boolean; suggestions: RelanceSuggestion[] }
  >(functions, 'getRelanceSuggestions');
  const res = await fn({ structureId, maxResults });
  const data = res.data;
  if (!data?.success) throw new Error('Échec de la récupération des suggestions');
  return data.suggestions;
}

export async function analyzePastClients(structureId: string): Promise<{
  analyzedClientProfile: ScoringSettings['analyzedClientProfile'];
}> {
  const functions = getFunctions();
  const fn = httpsCallable<
    { structureId: string },
    { success: boolean; analyzedClientProfile: ScoringSettings['analyzedClientProfile'] }
  >(functions, 'analyzePastClients');
  const res = await fn({ structureId });
  const data = res.data;
  if (!data?.success) throw new Error('Échec de l\'analyse des clients passés');
  return { analyzedClientProfile: data.analyzedClientProfile };
}

export async function generateContactMessage(
  prospectId: string,
  structureId: string,
  options?: { currentMessage?: string; modificationRequest?: string }
): Promise<{ message: string }> {
  const functions = getFunctions();
  const fn = httpsCallable<
    { prospectId: string; structureId: string; currentMessage?: string; modificationRequest?: string },
    { success: boolean; message: string }
  >(functions, 'generateContactMessage');
  const res = await fn({
    prospectId,
    structureId,
    ...(options?.currentMessage && options?.modificationRequest
      ? { currentMessage: options.currentMessage, modificationRequest: options.modificationRequest }
      : {}),
  });
  const data = res.data;
  if (!data?.success) throw new Error('Échec de la génération du message');
  return { message: data.message };
}

export async function getScoringSettings(structureId: string): Promise<ScoringSettings | null> {
  if (!db) return null;
  const q = query(
    collection(db, 'scoringSettings'),
    where('structureId', '==', structureId)
  );
  const snap = await getDocs(q);
  const docSnap = snap.docs[0];
  if (!docSnap) return null;
  const data = docSnap.data();
  const analyzedAt = data.analyzedAt;
  const updatedAt = data.updatedAt;
  const rawSpec = Array.isArray(data.specializations) ? data.specializations : [];
  const specializations = [...new Set(rawSpec.map((s) => String(s).trim()).filter(Boolean))];
  return {
    id: docSnap.id,
    structureId: data.structureId,
    specializations,
    weights: {
      completeness: data.weights?.completeness ?? DEFAULT_SCORING_WEIGHTS.completeness,
      recency: data.weights?.recency ?? DEFAULT_SCORING_WEIGHTS.recency,
      status: data.weights?.status ?? DEFAULT_SCORING_WEIGHTS.status,
      lastActivity: data.weights?.lastActivity ?? DEFAULT_SCORING_WEIGHTS.lastActivity,
      fitSpecialization: data.weights?.fitSpecialization ?? 0,
      fitPastClients: data.weights?.fitPastClients ?? 0,
    },
    analyzedClientProfile: data.analyzedClientProfile,
    analyzedAt: analyzedAt?.toDate ? analyzedAt.toDate() : analyzedAt,
    updatedAt: updatedAt?.toDate ? updatedAt.toDate() : updatedAt,
    contactMessageTemplate: typeof data.contactMessageTemplate === 'string' ? data.contactMessageTemplate : undefined,
  };
}

export async function saveScoringSettings(
  structureId: string,
  settings: Partial<Pick<ScoringSettings, 'specializations' | 'weights' | 'contactMessageTemplate'>>
): Promise<void> {
  if (!db) throw new Error('Firestore non initialisé');
  const q = query(
    collection(db, 'scoringSettings'),
    where('structureId', '==', structureId)
  );
  const snap = await getDocs(q);
  const docRef = snap.docs[0]?.ref;
  const payload: Record<string, unknown> = {
    ...settings,
    updatedAt: serverTimestamp(),
  };
  if (docRef) {
    await updateDoc(docRef, payload);
  } else {
    await addDoc(collection(db, 'scoringSettings'), {
      structureId,
      specializations: settings.specializations ?? [],
      weights: settings.weights ?? DEFAULT_SCORING_WEIGHTS,
      contactMessageTemplate: settings.contactMessageTemplate ?? '',
      updatedAt: serverTimestamp(),
    });
  }
}
