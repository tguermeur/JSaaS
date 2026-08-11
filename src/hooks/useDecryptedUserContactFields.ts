import { useCallback, useEffect, useState } from 'react';
import {
  decryptUserContactFields,
  getCachedUserContactData,
  isEncryptedField,
  subscribeUserNameCache,
  type UserContactData,
} from '../utils/decryptUserUtils';

function needsContactDecrypt(phone?: string, studentId?: string): boolean {
  return isEncryptedField(phone) || isEncryptedField(studentId);
}

function toPlainContact(phone?: string, studentId?: string): UserContactData {
  return {
    phone: phone && !isEncryptedField(phone) ? phone : '',
    studentId: studentId && !isEncryptedField(studentId) ? studentId : '',
  };
}

function sameContact(a: UserContactData, b: UserContactData): boolean {
  return a.phone === b.phone && a.studentId === b.studentId;
}

/**
 * Déchiffre automatiquement téléphone / numéro étudiant (cache global partagé avec les noms).
 */
export function useDecryptedUserContactFields(
  userId: string | undefined,
  rawPhone?: string,
  rawStudentId?: string
) {
  const readCached = useCallback((): UserContactData | null => {
    if (!userId) return null;
    return getCachedUserContactData(userId);
  }, [userId]);

  const [contact, setContact] = useState<UserContactData>(() => {
    const cached = userId ? getCachedUserContactData(userId) : null;
    if (cached) return cached;
    if (!needsContactDecrypt(rawPhone, rawStudentId)) return toPlainContact(rawPhone, rawStudentId);
    return { phone: '', studentId: '' };
  });

  const [loading, setLoading] = useState(() => {
    if (!userId || userId === 'manual') return false;
    if (getCachedUserContactData(userId)) return false;
    return needsContactDecrypt(rawPhone, rawStudentId);
  });

  const applyContact = useCallback((next: UserContactData) => {
    setContact((prev) => (sameContact(prev, next) ? prev : next));
  }, []);

  useEffect(() => {
    if (!userId || userId === 'manual') {
      applyContact({ phone: '', studentId: '' });
      setLoading(false);
      return;
    }

    const cached = readCached();
    if (cached) {
      applyContact(cached);
      setLoading(false);
      return;
    }

    if (!needsContactDecrypt(rawPhone, rawStudentId)) {
      applyContact(toPlainContact(rawPhone, rawStudentId));
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void decryptUserContactFields(userId, { phone: rawPhone, studentId: rawStudentId })
      .then((dec) => {
        if (!cancelled) applyContact(dec);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, rawPhone, rawStudentId, readCached, applyContact]);

  useEffect(() => {
    if (!userId) return undefined;
    return subscribeUserNameCache(() => {
      const cached = readCached();
      if (cached) {
        applyContact(cached);
        setLoading(false);
      }
    });
  }, [userId, readCached, applyContact]);

  return { phone: contact.phone, studentId: contact.studentId, loading };
}
