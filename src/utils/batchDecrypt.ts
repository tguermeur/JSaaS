/**
 * Client pour batchDecryptForStructure — un callable pour N documents.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase/config';

export type BatchDecryptEntity = 'user' | 'company' | 'contact' | 'prospect';

const BATCH_SIZE = 50;

function getCallableFunctions() {
  return app ? getFunctions(app, 'us-central1') : getFunctions(undefined, 'us-central1');
}

export type BatchDecryptResponse = {
  success?: boolean;
  results?: Record<string, Record<string, unknown>>;
  errors?: Record<string, string>;
};

/**
 * Déchiffre une liste d'IDs (chunkés par 50) via batchDecryptForStructure.
 */
export async function batchDecryptForStructure<T extends Record<string, unknown> = Record<string, unknown>>(
  entity: BatchDecryptEntity,
  ids: string[],
  fields?: string[]
): Promise<Record<string, T>> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const decryptBatch = httpsCallable(getCallableFunctions(), 'batchDecryptForStructure');
  const merged: Record<string, T> = {};

  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const chunk = uniqueIds.slice(i, i + BATCH_SIZE);
    try {
      const res = await decryptBatch({ entity, ids: chunk, fields });
      const data = res.data as BatchDecryptResponse;
      if (data?.results) {
        Object.assign(merged, data.results as Record<string, T>);
      }
    } catch (error) {
      console.warn(`[batchDecryptForStructure] échec chunk ${entity}:`, error);
    }
  }

  return merged;
}
