/**
 * Utilitaires pour décrypter les données utilisateur (firstName, lastName, displayName)
 * à afficher dans l'interface
 */

import { getFunctions, httpsCallable } from 'firebase/functions';

const isEncrypted = (v: any): boolean => typeof v === 'string' && v.startsWith('ENC:');

/**
 * Décrypte les champs nom/prénom d'un utilisateur via decryptUserDataForStructure
 * Pour les membres de la structure qui affichent des utilisateurs de leur structure
 */
export async function decryptUserDisplayData(
  userId: string,
  rawData: { displayName?: string; firstName?: string; lastName?: string }
): Promise<{ displayName: string; firstName: string; lastName: string }> {
  if (!rawData || (!isEncrypted(rawData.displayName) && !isEncrypted(rawData.firstName) && !isEncrypted(rawData.lastName))) {
    const displayName = rawData?.displayName || `${rawData?.firstName || ''} ${rawData?.lastName || ''}`.trim() || '';
    return {
      displayName,
      firstName: rawData?.firstName || '',
      lastName: rawData?.lastName || ''
    };
  }
  try {
    const decryptUserDataForStructure = httpsCallable(getFunctions(), 'decryptUserDataForStructure');
    const result = await decryptUserDataForStructure({ userId });
    const dec = (result.data as any)?.decryptedData;
    if (!dec) return {
      displayName: rawData?.displayName || '',
      firstName: rawData?.firstName || '',
      lastName: rawData?.lastName || ''
    };
    const firstName = (dec.firstName && !isEncrypted(dec.firstName) ? dec.firstName : rawData?.firstName) || '';
    const lastName = (dec.lastName && !isEncrypted(dec.lastName) ? dec.lastName : rawData?.lastName) || '';
    const displayName = (dec.displayName && !isEncrypted(dec.displayName) ? dec.displayName : null)
      || (firstName || lastName ? `${firstName} ${lastName}`.trim() : rawData?.displayName) || '';
    return { displayName, firstName, lastName };
  } catch (e) {
    console.warn('Décryptage utilisateur ignoré:', userId, e);
    return {
      displayName: rawData?.displayName || `${rawData?.firstName || ''} ${rawData?.lastName || ''}`.trim() || '',
      firstName: rawData?.firstName || '',
      lastName: rawData?.lastName || ''
    };
  }
}

/**
 * Retourne le nom affichable d'un utilisateur (décrypté si nécessaire)
 */
export async function getDecryptedUserDisplayName(
  userId: string,
  rawData: { displayName?: string; firstName?: string; lastName?: string } | null
): Promise<string> {
  if (!rawData) return 'Inconnu';
  const dec = await decryptUserDisplayData(userId, rawData);
  return dec.displayName || 'Inconnu';
}

/**
 * Décrypte une liste d'utilisateurs en parallèle (limité pour éviter trop d'appels)
 */
export async function decryptUsersList<T extends { id: string; displayName?: string; firstName?: string; lastName?: string }>(
  users: T[]
): Promise<T[]> {
  const toDecrypt = users.filter(u =>
    isEncrypted(u.displayName) || isEncrypted(u.firstName) || isEncrypted(u.lastName)
  );
  if (toDecrypt.length === 0) return users;
  const decrypted = await Promise.all(
    toDecrypt.map(async (user) => {
      const dec = await decryptUserDisplayData(user.id, user);
      return { ...user, ...dec };
    })
  );
  const decryptedMap = new Map(decrypted.map(u => [u.id, u]));
  return users.map(u => decryptedMap.get(u.id) || u);
}

/**
 * Décrypte les données utilisateur pour l'affichage admin (connexions/inscriptions)
 * Retourne displayName et structureName (ecole décryptée si nécessaire)
 */
export async function getDecryptedUserForActivity(
  userId: string,
  rawData: { displayName?: string; firstName?: string; lastName?: string; ecole?: string },
  structureNameFromMap: string
): Promise<{ displayName: string; structureName: string }> {
  const needsDecrypt = rawData && (
    isEncrypted(rawData.displayName) || isEncrypted(rawData.firstName) ||
    isEncrypted(rawData.lastName) || isEncrypted(rawData.ecole)
  );
  if (!needsDecrypt) {
    const displayName = rawData?.displayName || `${rawData?.firstName || ''} ${rawData?.lastName || ''}`.trim() || '';
    return {
      displayName,
      structureName: structureNameFromMap || rawData?.ecole || 'Non assigné'
    };
  }
  try {
    const decryptUserDataForStructure = httpsCallable(getFunctions(), 'decryptUserDataForStructure');
    const result = await decryptUserDataForStructure({ userId });
    const dec = (result.data as any)?.decryptedData;
    if (!dec) {
      const displayName = rawData?.displayName || `${rawData?.firstName || ''} ${rawData?.lastName || ''}`.trim() || '';
      return { displayName, structureName: structureNameFromMap || rawData?.ecole || 'Non assigné' };
    }
    const firstName = (dec.firstName && !isEncrypted(dec.firstName) ? dec.firstName : rawData?.firstName) || '';
    const lastName = (dec.lastName && !isEncrypted(dec.lastName) ? dec.lastName : rawData?.lastName) || '';
    const displayName = (dec.displayName && !isEncrypted(dec.displayName) ? dec.displayName : null)
      || (firstName || lastName ? `${firstName} ${lastName}`.trim() : rawData?.displayName) || '';
    const ecole = (dec.ecole && !isEncrypted(dec.ecole) ? dec.ecole : rawData?.ecole) || '';
    return {
      displayName,
      structureName: structureNameFromMap || ecole || 'Non assigné'
    };
  } catch (e) {
    console.warn('Décryptage utilisateur ignoré:', userId, e);
    const displayName = rawData?.displayName || `${rawData?.firstName || ''} ${rawData?.lastName || ''}`.trim() || '';
    return { displayName, structureName: structureNameFromMap || rawData?.ecole || 'Non assigné' };
  }
}

/**
 * Décrypte une liste d'utilisateurs pour l'affichage activité (connexions/inscriptions)
 */
export async function decryptActivityUsersList<T extends {
  id: string; displayName?: string; firstName?: string; lastName?: string; ecole?: string; structureId?: string; structureName?: string;
}>(
  users: T[],
  getStructureNameFromMap: (user: T) => string
): Promise<T[]> {
  const decrypted = await Promise.all(
    users.map(async (user) => {
      const { displayName, structureName } = await getDecryptedUserForActivity(
        user.id,
        user,
        getStructureNameFromMap(user)
      );
      return { ...user, displayName, structureName };
    })
  );
  return decrypted;
}
