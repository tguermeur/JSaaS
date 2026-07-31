/**
 * Déchiffrement des entités Firestore avant génération de documents PDF.
 * Utilise les Cloud Functions "ForStructure" (sans 2FA).
 */
import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import { app } from '../firebase/config';
import { isEncryptedField } from './decryptUserUtils';

type RecordData = Record<string, unknown>;

const functions = () => getFunctions(app, 'us-central1');

export function recordHasEncryptedFields(
  data: RecordData | null | undefined,
  fields?: readonly string[]
): boolean {
  if (!data) return false;
  const keys = fields ?? Object.keys(data);
  return keys.some((k) => isEncryptedField(data[k]));
}

export function mergeDecryptedRecord<T extends RecordData>(
  raw: T,
  decrypted: RecordData | null | undefined
): T {
  if (!decrypted) return raw;
  const merged = { ...raw };
  for (const [key, val] of Object.entries(decrypted)) {
    if (val != null && val !== '' && !isEncryptedField(val)) {
      merged[key] = val;
    }
  }
  return merged;
}

async function callDecrypt<T extends RecordData>(
  callableName: string,
  paramKey: string,
  entityId: string,
  rawData: T
): Promise<T> {
  if (!entityId || !rawData || !recordHasEncryptedFields(rawData)) {
    return rawData;
  }
  try {
    const fn = httpsCallable(functions(), callableName);
    const result = await fn({ [paramKey]: entityId });
    const dec = (result.data as { decryptedData?: RecordData })?.decryptedData;
    return mergeDecryptedRecord(rawData, dec);
  } catch (e) {
    console.warn(`Décryptage document ignoré (${callableName}):`, e);
    return rawData;
  }
}

export async function decryptUserForDocument<T extends RecordData>(
  userId: string | undefined,
  rawData: T | null | undefined
): Promise<T | null | undefined> {
  if (!userId || !rawData) return rawData;
  return callDecrypt('decryptUserDataForStructure', 'userId', userId, rawData);
}

export async function decryptContactForDocument<T extends RecordData>(
  contactId: string | undefined,
  rawData: T | null | undefined
): Promise<T | null | undefined> {
  if (!contactId || !rawData) return rawData;
  return callDecrypt('decryptContactDataForStructure', 'contactId', contactId, rawData);
}

export async function decryptCompanyForDocument<T extends RecordData>(
  companyId: string | undefined,
  rawData: T | null | undefined
): Promise<T | null | undefined> {
  if (!companyId || !rawData) return rawData;
  return callDecrypt('decryptCompanyDataForStructure', 'companyId', companyId, rawData);
}

export async function decryptStructureForDocument<T extends RecordData>(
  structureId: string | undefined,
  rawData: T | null | undefined
): Promise<T | null | undefined> {
  if (!structureId || !rawData) return rawData;
  return callDecrypt('decryptStructureDataForStructure', 'structureId', structureId, rawData);
}

export interface DocumentDecryptContextInput {
  userId?: string;
  userData?: RecordData | null;
  chargeId?: string;
  chargeData?: RecordData | null;
  contactId?: string;
  contactData?: RecordData | null;
  companyId?: string;
  companyData?: RecordData | null;
  structureId?: string;
  structureData?: RecordData | null;
}

export interface DecryptedDocumentContext {
  userData: RecordData | null | undefined;
  chargeData: RecordData | null | undefined;
  contactData: RecordData | null | undefined;
  companyData: RecordData | null | undefined;
  structureData: RecordData | null | undefined;
}

/** Déchiffre en parallèle toutes les entités nécessaires à la génération de documents. */
export async function prepareDecryptedDocumentContext(
  input: DocumentDecryptContextInput
): Promise<DecryptedDocumentContext> {
  const [userData, chargeData, contactData, companyData, structureData] = await Promise.all([
    decryptUserForDocument(input.userId, input.userData ?? null),
    decryptUserForDocument(input.chargeId, input.chargeData ?? null),
    decryptContactForDocument(input.contactId, input.contactData ?? null),
    decryptCompanyForDocument(input.companyId, input.companyData ?? null),
    decryptStructureForDocument(input.structureId, input.structureData ?? null),
  ]);

  return { userData, chargeData, contactData, companyData, structureData };
}
