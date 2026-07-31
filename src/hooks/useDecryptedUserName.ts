import { useCallback, useEffect, useState } from 'react';
import {
  decryptUserDisplayData,
  getCachedUserDisplayData,
  isEncryptedField,
  preferDisplayFields,
  subscribeUserNameCache,
  userNeedsNameDecrypt,
  type RawUserDisplayData,
} from '../utils/decryptUserUtils';

export type UseDecryptedUserNameInput = {
  id?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  displayFirstName?: string;
  displayLastName?: string;
};

/**
 * Déchiffre automatiquement prénom / nom pour l'affichage React (cache global partagé).
 * Préfère displayFirstName / displayLastName / displayName plaintext (0 appel CF).
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

  const fromDisplayFields = preferDisplayFields(user);

  const [names, setNames] = useState<RawUserDisplayData | null>(() => fromDisplayFields || readCached());
  const [isDecrypting, setIsDecrypting] = useState(() => {
    if (!userId) return false;
    if (fromDisplayFields || readCached()) return false;
    return userNeedsNameDecrypt(user);
  });

  const refresh = useCallback(async () => {
    if (!userId) return;
    const preferred = preferDisplayFields(user);
    if (preferred) {
      setNames(preferred);
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
    setIsDecrypting(true);
    try {
      const dec = await decryptUserDisplayData(userId, {
        displayName: user?.displayName,
        firstName: user?.firstName,
        lastName: user?.lastName,
        displayFirstName: user?.displayFirstName,
        displayLastName: user?.displayLastName,
      });
      setNames(dec);
    } finally {
      setIsDecrypting(false);
    }
  }, [
    userId,
    user?.displayName,
    user?.firstName,
    user?.lastName,
    user?.displayFirstName,
    user?.displayLastName,
    fallback,
    readCached,
    user,
  ]);

  useEffect(() => {
    if (!userId) {
      setNames(null);
      setIsDecrypting(false);
      return;
    }
    const preferred = preferDisplayFields(user);
    if (preferred) {
      setNames(preferred);
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
  }, [
    userId,
    user?.firstName,
    user?.lastName,
    user?.displayName,
    user?.displayFirstName,
    user?.displayLastName,
    fallback,
    refresh,
    readCached,
    user,
  ]);

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
    const firstName = names?.firstName || user?.displayFirstName || user?.firstName || '';
    const lastName = names?.lastName || user?.displayLastName || user?.lastName || '';
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
    firstName: names?.firstName ?? (loading ? '' : user?.displayFirstName ?? user?.firstName ?? ''),
    lastName: names?.lastName ?? (loading ? '' : user?.displayLastName ?? user?.lastName ?? ''),
    displayName: names?.displayName ?? (loading ? '' : user?.displayName ?? ''),
    fullName,
    initials,
    loading,
  };
}
