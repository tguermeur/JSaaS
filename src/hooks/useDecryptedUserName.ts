import { useCallback, useEffect, useState } from 'react';
import {
  decryptUserDisplayData,
  getCachedUserDisplayData,
  isEncryptedField,
  subscribeUserNameCache,
  userNeedsNameDecrypt,
  type RawUserDisplayData,
} from '../utils/decryptUserUtils';

export type UseDecryptedUserNameInput = {
  id?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
};

/**
 * Déchiffre automatiquement prénom / nom pour l'affichage React (cache global partagé).
 */
export function useDecryptedUserName(
  user: UseDecryptedUserNameInput | null | undefined,
  fallback = ''
) {
  const userId = user?.id;

  const readCached = useCallback((): RawUserDisplayData | null => {
    if (!userId) return null;
    const cached = getCachedUserDisplayData(userId);
    if (cached && !isEncryptedField(cached.firstName) && !isEncryptedField(cached.lastName)) {
      return cached;
    }
    return null;
  }, [userId]);

  const [names, setNames] = useState<RawUserDisplayData | null>(() => readCached());
  const [isDecrypting, setIsDecrypting] = useState(() => {
    if (!userId) return false;
    if (readCached()) return false;
    return userNeedsNameDecrypt(user);
  });

  const refresh = useCallback(async () => {
    if (!userId) return;
    const cached = readCached();
    if (cached) {
      setNames(cached);
      setIsDecrypting(false);
      return;
    }
    if (!userNeedsNameDecrypt(user)) {
      setNames({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        displayName:
          user?.displayName ||
          `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
          fallback,
      });
      setIsDecrypting(false);
      return;
    }
    setIsDecrypting(true);
    try {
      const dec = await decryptUserDisplayData(userId, {
        displayName: user?.displayName,
        firstName: user?.firstName,
        lastName: user?.lastName,
      });
      setNames(dec);
    } finally {
      setIsDecrypting(false);
    }
  }, [userId, user?.displayName, user?.firstName, user?.lastName, fallback, readCached, user]);

  useEffect(() => {
    if (!userId) {
      setNames(null);
      setIsDecrypting(false);
      return;
    }
    const cached = readCached();
    if (cached) {
      setNames(cached);
      setIsDecrypting(false);
      return;
    }
    if (!userNeedsNameDecrypt(user)) {
      setNames({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        displayName:
          user?.displayName ||
          `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
          fallback,
      });
      setIsDecrypting(false);
      return;
    }
    void refresh();
  }, [userId, user?.firstName, user?.lastName, user?.displayName, fallback, refresh, readCached, user]);

  useEffect(() => {
    if (!userId) return undefined;
    return subscribeUserNameCache(() => {
      const cached = readCached();
      if (cached) {
        setNames(cached);
        setIsDecrypting(false);
      }
    });
  }, [userId, readCached]);

  const loading = isDecrypting;

  const fullName = loading
    ? ''
    : names?.displayName ||
      `${names?.firstName || ''} ${names?.lastName || ''}`.trim() ||
      fallback;

  const computeInitials = (): string => {
    const firstName = names?.firstName || user?.firstName || '';
    const lastName = names?.lastName || user?.lastName || '';
    const fromNames = `${firstName.charAt(0)}${lastName.charAt(0)}`.trim();
    if (fromNames) return fromNames.toUpperCase();

    const displayName = names?.displayName || user?.displayName || '';
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return '';
  };

  const initials = loading ? '' : computeInitials();

  return {
    firstName: names?.firstName ?? (loading ? '' : user?.firstName ?? ''),
    lastName: names?.lastName ?? (loading ? '' : user?.lastName ?? ''),
    displayName: names?.displayName ?? (loading ? '' : user?.displayName ?? ''),
    fullName,
    initials,
    loading,
  };
}
