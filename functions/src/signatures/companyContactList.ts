import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getCallerUser } from '../authHelpers';
import { EMAILJS_GENERIC_SECRETS } from '../notifications/sendEmail';
import { getStoragePdfForClient } from './storagePdf';

const secrets = [...EMAILJS_GENERIC_SECRETS, 'ENCRYPTION_KEY'];

const callConfigAuth = {
  region: 'us-central1' as const,
  memory: '512MiB' as const,
  timeoutSeconds: 120,
  secrets,
};

export type CompanyContactSignatureItem = {
  id: string;
  documentTitle: string;
  status: string;
  mySignerStatus: string;
  sealedUrl: string | null;
};

/**
 * Core logic (exported for unit tests).
 * Lists signature requests where the authenticated user's email is a signer,
 * scoped to the structure that owns their companyId.
 */
export async function runListMySignatureRequestsAsCompanyContact(
  uid: string,
  authEmail: string | undefined | null
): Promise<{ requests: CompanyContactSignatureItem[] }> {
  const user = await getCallerUser(uid);
  if (!user || user.status !== 'entreprise' || !user.companyId) {
    throw new HttpsError(
      'permission-denied',
      'Réservé aux contacts entreprise rattachés à une entreprise.'
    );
  }

  const email = String(authEmail || '')
    .trim()
    .toLowerCase();
  if (!email || !email.includes('@')) {
    throw new HttpsError('failed-precondition', 'Email du compte introuvable.');
  }

  const companySnap = await admin.firestore().collection('companies').doc(String(user.companyId)).get();
  if (!companySnap.exists) {
    throw new HttpsError('not-found', 'Entreprise introuvable.');
  }
  const structureId = companySnap.data()?.structureId as string | undefined;
  if (!structureId) {
    throw new HttpsError('failed-precondition', 'Entreprise sans structure associée.');
  }

  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = await admin
      .firestore()
      .collection('signatureRequests')
      .where('structureId', '==', structureId)
      .limit(100)
      .get();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HttpsError('internal', `Impossible de lister les signatures : ${msg}`);
  }

  const requests: CompanyContactSignatureItem[] = [];

  for (const d of snap.docs) {
    const data = d.data();
    const signers = Array.isArray(data.signers) ? data.signers : [];
    const me = signers.find(
      (s: { email?: string }) =>
        String(s?.email || '')
          .trim()
          .toLowerCase() === email
    );
    if (!me) continue;

    let sealedUrl: string | null = null;
    if (data.status === 'completed') {
      const sealedPath = data.sealed?.storagePath as string | undefined;
      if (sealedPath) {
        try {
          const pdf = await getStoragePdfForClient(sealedPath);
          sealedUrl = pdf.pdfUrl;
          if (!sealedUrl && pdf.pdfBase64) {
            sealedUrl = `data:application/pdf;base64,${pdf.pdfBase64}`;
          }
        } catch (err) {
          console.warn('[listMySignatureRequestsAsCompanyContact] sealed url failed', d.id, err);
        }
      }
    }

    requests.push({
      id: d.id,
      documentTitle: String(data.document?.title || 'Document'),
      status: String(data.status || 'pending'),
      mySignerStatus: String(me.status || 'pending'),
      sealedUrl,
    });
  }

  return { requests };
}

/**
 * Contact entreprise : demandes de signature où il est signataire (lecture seule).
 */
export const listMySignatureRequestsAsCompanyContact = onCall(callConfigAuth, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentification requise.');
  }
  const email = request.auth.token.email as string | undefined;
  return runListMySignatureRequestsAsCompanyContact(request.auth.uid, email);
});
