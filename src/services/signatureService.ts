import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase/config';
import type { SignatureEvent, SignatureRequest } from '../types/signature';

function getFns() {
  if (!app) throw new Error('Firebase non initialisé');
  return getFunctions(app, 'us-central1');
}

export type SignerInput = {
  email: string;
  name: string;
  phone?: string;
  userId?: string;
  order?: number;
};

function clientAppOrigin(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.location.origin;
}

export async function createSignatureRequest(params: {
  generatedDocumentId: string;
  signers: SignerInput[];
  consentWording?: string;
  signatureFields?: Array<{
    id?: string;
    signerOrder: number;
    pageIndex: number;
    xPct: number;
    yPct: number;
    widthPct: number;
    heightPct: number;
    label?: string;
  }>;
}): Promise<{
  requestId: string;
  request: SignatureRequest;
  emailResults?: Array<{ email: string; ok: boolean; error: string | null }>;
}> {
  const fn = httpsCallable(getFns(), 'createSignatureRequest');
  const res = await fn({ ...params, appOrigin: clientAppOrigin() });
  return res.data as {
    requestId: string;
    request: SignatureRequest;
    emailResults?: Array<{ email: string; ok: boolean; error: string | null }>;
  };
}

export async function cancelSignatureRequest(requestId: string): Promise<void> {
  const fn = httpsCallable(getFns(), 'cancelSignatureRequest');
  await fn({ requestId });
}

export async function deleteSignatureRequest(requestId: string): Promise<void> {
  const fn = httpsCallable(getFns(), 'deleteSignatureRequest');
  await fn({ requestId });
}

export async function resendSignatureInvite(
  requestId: string,
  signerId: string
): Promise<{ ok: boolean; error?: string }> {
  const fn = httpsCallable(getFns(), 'resendSignatureInvite');
  const res = await fn({ requestId, signerId, appOrigin: clientAppOrigin() });
  return res.data as { ok: boolean; error?: string };
}

export async function listSignatureRequests(
  structureId?: string
): Promise<{ requests: SignatureRequest[] }> {
  const fn = httpsCallable(getFns(), 'listSignatureRequests');
  try {
    const res = await fn(structureId ? { structureId } : {});
    return res.data as { requests: SignatureRequest[] };
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string; details?: string };
    const message =
      err?.message?.replace(/^Firebase:\s*/i, '').replace(/\s*\([^)]*\)\.?\s*$/, '') ||
      'Impossible de charger les signatures.';
    throw Object.assign(new Error(message), { code: err?.code });
  }
}

export async function getSignatureAudit(
  requestId: string
): Promise<{ request: SignatureRequest; events: SignatureEvent[] }> {
  const fn = httpsCallable(getFns(), 'getSignatureAudit');
  const res = await fn({ requestId });
  return res.data as { request: SignatureRequest; events: SignatureEvent[] };
}

export async function getSealedDocumentUrl(requestId: string): Promise<{
  full: { url: string | null; pdfBase64?: string | null };
  document: { url: string | null; pdfBase64?: string | null };
  url: string | null;
  pdfBase64?: string | null;
  sha256After: string | null;
}> {
  const fn = httpsCallable(getFns(), 'getSealedDocumentUrl');
  const res = await fn({ requestId });
  return res.data as {
    full: { url: string | null; pdfBase64?: string | null };
    document: { url: string | null; pdfBase64?: string | null };
    url: string | null;
    pdfBase64?: string | null;
    sha256After: string | null;
  };
}

const openSignSessionInflight = new Map<
  string,
  Promise<{
    sessionToken: string;
    signerId: string;
    expiresAt: number;
    documentTitle: string;
    consentWording: string;
    signer: { id: string; name: string; email: string };
    pdfUrl: string | null;
    pdfBase64?: string | null;
    sha256Before: string;
    signatureFields: Array<{
      id: string;
      pageIndex: number;
      xPct: number;
      yPct: number;
      widthPct: number;
      heightPct: number;
      label?: string | null;
    }>;
  }>
>();

export async function openSignSession(
  requestId: string,
  token: string
): Promise<{
  sessionToken: string;
  signerId: string;
  expiresAt: number;
  documentTitle: string;
  consentWording: string;
  signer: { id: string; name: string; email: string };
  pdfUrl: string | null;
  pdfBase64?: string | null;
  sha256Before: string;
  signatureFields: Array<{
    id: string;
    pageIndex: number;
    xPct: number;
    yPct: number;
    widthPct: number;
    heightPct: number;
    label?: string | null;
  }>;
}> {
  const key = `${requestId}::${token}`;
  const existing = openSignSessionInflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const fn = httpsCallable(getFns(), 'openSignSession');
    const res = await fn({ requestId, token });
    return res.data as {
      sessionToken: string;
      signerId: string;
      expiresAt: number;
      documentTitle: string;
      consentWording: string;
      signer: { id: string; name: string; email: string };
      pdfUrl: string | null;
      pdfBase64?: string | null;
      sha256Before: string;
      signatureFields: Array<{
        id: string;
        pageIndex: number;
        xPct: number;
        yPct: number;
        widthPct: number;
        heightPct: number;
        label?: string | null;
      }>;
    };
  })().finally(() => {
    openSignSessionInflight.delete(key);
  });

  openSignSessionInflight.set(key, promise);
  return promise;
}

export async function submitSignature(params: {
  requestId: string;
  sessionToken: string;
  consentAccepted: boolean;
  consentWording: string;
  signatureImageBase64: string;
}): Promise<{ ok: boolean; completed: boolean }> {
  const fn = httpsCallable(getFns(), 'submitSignature');
  const res = await fn(params);
  return res.data as { ok: boolean; completed: boolean };
}
