/**
 * Utilitaires pour l'accès aux fichiers chiffrés via decryptFile (2FA, propriétaire, missions).
 */

const DECRYPT_FILE_URL = 'https://us-central1-jsaas-dd2f7.cloudfunctions.net/decryptFile';

export function isDocumentOwner(filePath: string, userId: string): boolean {
  if (!userId || !filePath) return false;
  return filePath.includes(`/${userId}/`) || filePath.startsWith(`${userId}/`);
}

export function isMissionDocument(filePath: string): boolean {
  return /^missions\/[^/]+\/documents\//.test(filePath);
}

/**
 * Détermine si la 2FA est requise pour ouvrir ce fichier (côté frontend).
 * Pas de 2FA si : propriétaire, ou document mission.
 */
export function requires2FAForDecrypt(filePath: string, userId: string): boolean {
  if (isDocumentOwner(filePath, userId)) return false;
  if (isMissionDocument(filePath)) return false;
  return true;
}

export function is2FARequiredError(err: unknown): boolean {
  const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return typeof msg === 'string' && (msg.includes('2FA') || msg.includes('Validation 2FA'));
}

export type FetchDecryptFileOptions = {
  filePath: string;
  token: string;
  twoFactorCode?: string;
  responseType?: 'blob';
  timeout?: number;
};

export type FetchDecryptFileResult = {
  blob: Blob;
  contentType: string;
};

/**
 * Appel decryptFile : GET si pas de 2FA, POST avec twoFactorCode si 2FA requise.
 */
export async function fetchDecryptFile(opts: FetchDecryptFileOptions): Promise<FetchDecryptFileResult> {
  const { filePath, token, twoFactorCode, responseType = 'blob', timeout = 60000 } = opts;
  const axios = (await import('axios')).default;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (twoFactorCode) {
    headers['Content-Type'] = 'application/json';
  }

  let res: { data: Blob; headers: Record<string, string> };
  if (twoFactorCode && twoFactorCode.length === 6) {
    res = await axios.post(
      DECRYPT_FILE_URL,
      { filePath, twoFactorCode },
      {
        params: { filePath },
        headers,
        responseType,
        timeout,
      }
    );
  } else {
    res = await axios.get(DECRYPT_FILE_URL, {
      params: { filePath },
      headers,
      responseType,
      timeout,
    });
  }

  const contentType =
    (res.headers['content-type'] || res.headers['Content-Type'] as string) || 'application/octet-stream';
  return { blob: res.data as Blob, contentType };
}
