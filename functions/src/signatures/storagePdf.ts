import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

/** URL signée Storage, ou base64 si le SA n’a pas iam.serviceAccounts.signBlob. */
export async function getStoragePdfForClient(storagePath: string): Promise<{
  pdfUrl: string | null;
  pdfBase64: string | null;
}> {
  if (!storagePath) {
    throw new HttpsError('failed-precondition', 'Chemin PDF manquant.');
  }
  const file = admin.storage().bucket().file(storagePath);
  try {
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000,
      version: 'v4',
    });
    return { pdfUrl: url, pdfBase64: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('getSignedUrl failed, fallback base64:', msg);
    const [exists] = await file.exists();
    if (!exists) throw new HttpsError('not-found', 'Fichier PDF introuvable.');
    const [buf] = await file.download();
    if (buf.length > 6 * 1024 * 1024) {
      throw new HttpsError(
        'resource-exhausted',
        'PDF trop volumineux. Accordez roles/iam.serviceAccountTokenCreator au compte de service des Functions.'
      );
    }
    return { pdfUrl: null, pdfBase64: Buffer.from(buf).toString('base64') };
  }
}
