import { useCallback, useRef } from 'react';
import { getDecryptedUserDisplayName } from '../utils/decryptUserUtils';

/**
 * Cache et déchiffrement des noms de chargés de mission (évite N+1 non borné).
 */
export function useMissionChargeNames() {
  const cacheRef = useRef<Record<string, string>>({});

  const resolveChargeName = useCallback(
    async (chargeId: string | undefined, rawName: string | undefined, userData: Record<string, unknown> | null) => {
      if (!chargeId) return rawName || 'Non assigné';
      if (cacheRef.current[chargeId]) return cacheRef.current[chargeId];
      if (!rawName?.startsWith?.('ENC:')) {
        cacheRef.current[chargeId] = rawName || 'Non assigné';
        return cacheRef.current[chargeId];
      }
      const name = await getDecryptedUserDisplayName(chargeId, userData);
      cacheRef.current[chargeId] = name;
      return name;
    },
    []
  );

  return { resolveChargeName };
}
