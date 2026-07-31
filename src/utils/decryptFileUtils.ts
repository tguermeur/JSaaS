/**
 * Utilitaires pour l'accès aux fichiers chiffrés via decryptFile (2FA, propriétaire, missions).
 */

import { getDownloadURL, getStorage, ref } from 'firebase/storage';
import { getFunctionsUrl } from '../firebase/config';

const DECRYPT_FILE_URL = getFunctionsUrl('decryptFile');

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

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
/** Extension suggérée selon le type MIME (pour noms de fichiers sans extension). */
export function extensionFromContentType(contentType: string): string {
  const ct = (contentType || '').split(';')[0].trim().toLowerCase();
  return MIME_TO_EXT[ct] || '';
}

export function isPdfContentType(contentType: string): boolean {
  const ct = (contentType || '').split(';')[0].trim().toLowerCase();
  return ct === 'application/pdf' || ct.endsWith('/pdf');
}

export function isImageContentType(contentType: string): boolean {
  return (contentType || '').split(';')[0].trim().toLowerCase().startsWith('image/');
}

export function ensureFileNameWithExtension(displayName: string, contentType: string): string {
  const base = (displayName || 'fichier').replace(/[/\\]+/g, '_').trim() || 'fichier';
  if (/\.[a-z0-9]{1,8}$/i.test(base)) {
    return base;
  }
  const ext = extensionFromContentType(contentType);
  return ext ? `${base}${ext}` : base;
}

function blobFromAxiosData(data: ArrayBuffer | Blob, contentType: string): Blob {
  if (data instanceof Blob) {
    return data.type ? data : new Blob([data], { type: contentType });
  }
  return new Blob([data], { type: contentType });
}

/** Détecte le type réel à partir des premiers octets (serveur parfois en octet-stream). */
export function detectMimeFromBuffer(buffer: ArrayBuffer): string | null {
  if (!buffer || buffer.byteLength < 4) return null;
  const bytes = new Uint8Array(buffer.slice(0, 12));
  const ascii = String.fromCharCode(...bytes.subarray(0, 5));
  if (ascii.startsWith('%PDF')) return 'application/pdf';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return 'image/gif';
  }
  return null;
}

/** Recrée un Blob avec un Content-Type fiable pour affichage / téléchargement. */
export async function normalizeDocumentBlob(result: FetchDecryptFileResult): Promise<FetchDecryptFileResult> {
  const buffer = await result.blob.arrayBuffer();
  const detected = detectMimeFromBuffer(buffer);
  const contentType =
    detected ||
    (result.contentType || '').split(';')[0].trim() ||
    'application/octet-stream';
  return { blob: new Blob([buffer], { type: contentType }), contentType };
}

export async function fetchDecryptFile(opts: FetchDecryptFileOptions): Promise<FetchDecryptFileResult> {
  const { filePath, token, twoFactorCode, timeout = 60000 } = opts;
  const axios = (await import('axios')).default;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (twoFactorCode) {
    headers['Content-Type'] = 'application/json';
  }

  const axiosConfig = {
    params: { filePath },
    headers,
    responseType: 'arraybuffer' as const,
    timeout,
  };

  let res: { data: ArrayBuffer; headers: Record<string, string> };
  if (twoFactorCode && twoFactorCode.length === 6) {
    res = await axios.post(DECRYPT_FILE_URL, { filePath, twoFactorCode }, axiosConfig);
  } else {
    res = await axios.get(DECRYPT_FILE_URL, axiosConfig);
  }

  const contentType =
    (res.headers['content-type'] || res.headers['Content-Type'] as string) || 'application/octet-stream';
  return normalizeDocumentBlob({
    blob: blobFromAxiosData(res.data, contentType),
    contentType,
  });
}

/**
 * Même logique que l'ouverture d'un document dans la visionneuse :
 * decryptFile, puis repli Storage (getDownloadURL) si 404.
 */
export async function fetchDocumentBlobForDownload(opts: {
  filePath: string;
  token: string;
  twoFactorCode?: string;
  timeout?: number;
}): Promise<FetchDecryptFileResult> {
  const { filePath, token, twoFactorCode, timeout = 120000 } = opts;

  try {
    return await fetchDecryptFile({ filePath, token, twoFactorCode, timeout });
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status !== 404) {
      throw err;
    }
    const storage = getStorage();
    const url = await getDownloadURL(ref(storage, filePath));
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Impossible de télécharger le fichier (${response.status})`);
    }
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = await response.arrayBuffer();
    return normalizeDocumentBlob({
      blob: new Blob([buffer], { type: contentType }),
      contentType,
    });
  }
}
