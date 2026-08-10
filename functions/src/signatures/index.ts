import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { PDFDocument } from 'pdf-lib';
import { randomUUID } from 'crypto';
import { assertSuperAdmin, getCallerUser, isSuperAdminUser } from '../authHelpers';
import { getAppBaseUrl, resolveAppBaseUrl } from '../notifications/core';
import { EMAILJS_GENERIC_SECRETS, sendTemplatedEmail } from '../notifications/sendEmail';
import {
  ACCESS_TOKEN_TTL_MS,
  SESSION_TTL_MS,
  SIGNATURE_CONSENT_WORDING,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
} from './constants';
import { generateRawToken, hashToken, sha256Buffer } from './crypto';
import {
  appendSignatureEvent,
  assertSignatureRateLimit,
  extractRequestContext,
} from './audit';
import { sealSignedDocument } from './seal';
import {
  billingCurrentRef,
  consumeFreeSignatureTokenInTransaction,
} from '../quotaHelpers';
import { getStoragePdfForClient } from './storagePdf';

export { sendSignerOtp, verifySignerOtp } from './smsStubs';
export {
  listMySignatureRequestsAsCompanyContact,
  runListMySignatureRequestsAsCompanyContact,
} from './companyContactList';

const secrets = [...EMAILJS_GENERIC_SECRETS, 'ENCRYPTION_KEY'] as const;

const callConfigAuth = {
  region: 'us-central1' as const,
  memory: '512MiB' as const,
  timeoutSeconds: 120,
  secrets: [...secrets],
};

const callConfigPublic = {
  region: 'us-central1' as const,
  memory: '512MiB' as const,
  timeoutSeconds: 120,
  secrets: [...secrets],
};

type SignerInput = {
  email: string;
  name: string;
  phone?: string;
  userId?: string;
  order?: number;
};

async function assertCanManageSignatures(uid: string, structureId: string): Promise<void> {
  const user = await getCallerUser(uid);
  if (!user) throw new HttpsError('permission-denied', 'Utilisateur introuvable.');
  if (isSuperAdminUser(user)) return;
  if (user.structureId !== structureId) {
    throw new HttpsError('permission-denied', 'Structure non autorisée.');
  }
  const status = (user.status ?? user.role ?? '') as string;
  if (['admin', 'admin_structure', 'membre', 'member'].includes(status)) return;
  throw new HttpsError('permission-denied', 'Permissions insuffisantes pour les signatures.');
}

function sanitizeSigners(raw: SignerInput[]): Array<SignerInput & { email: string; name: string }> {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new HttpsError('invalid-argument', 'Au moins un signataire est requis.');
  }
  if (raw.length > 20) {
    throw new HttpsError('invalid-argument', 'Maximum 20 signataires.');
  }
  return raw.map((s, i) => {
    const email = (s.email || '').trim().toLowerCase();
    const name = (s.name || '').trim();
    if (!email.includes('@') || !name) {
      throw new HttpsError('invalid-argument', `Signataire #${i + 1} : email et nom requis.`);
    }
    return {
      email,
      name,
      phone: s.phone?.trim() || undefined,
      userId: s.userId || undefined,
      order: typeof s.order === 'number' ? s.order : i,
    };
  });
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 10;
  return Math.max(1, Math.min(100, n));
}

function publicSigners(signers: FirebaseFirestore.DocumentData[]) {
  return signers.map((s) => ({
    id: s.id,
    email: s.email,
    name: s.name,
    phone: s.phone || null,
    userId: s.userId || null,
    order: s.order ?? 0,
    status: s.status,
    signedAt: s.signedAt || null,
    consentAcceptedAt: s.consentAcceptedAt || null,
    consentWordingSnapshot: s.consentWordingSnapshot || null,
  }));
}

function toPublicRequest(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    structureId: data.structureId,
    createdBy: data.createdBy,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    status: data.status,
    source: data.source,
    document: {
      title: data.document?.title,
      contentType: data.document?.contentType,
      sha256Before: data.document?.sha256Before,
      byteSize: data.document?.byteSize,
      // storagePath omitted from list views if needed — kept for admin download via CF
      storagePath: data.document?.storagePath,
    },
    sealed: data.sealed || null,
    consentWording: data.consentWording,
    signers: publicSigners(data.signers || []),
    signatureFields: data.signatureFields || [],
    smsReady: data.smsReady === true,
    expiresAt: data.expiresAt || null,
  };
}

async function sendInviteEmail(params: {
  toEmail: string;
  documentTitle: string;
  signLink: string;
  structureId: string;
  sentByUserId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const result = await sendTemplatedEmail({
    templateKey: 'DOCUMENT_TO_SIGN',
    toEmail: params.toEmail,
    subject: `Signature requise — ${params.documentTitle}`,
    templateParams: {
      document_title: params.documentTitle,
      sign_link: params.signLink,
    },
    linkFields: ['sign_link'],
    structureId: params.structureId,
    sentByUserId: params.sentByUserId,
    logType: 'document_to_sign',
  });
  return { ok: result.ok, error: result.error || result.skipped };
}

/**
 * Create a signature request from a generatedDocument and email unique links.
 */
export const createSignatureRequest = onCall(callConfigAuth, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentification requise.');
  }
  const uid = request.auth.uid;
  const {
    generatedDocumentId,
    signers: rawSigners,
    consentWording,
    signatureFields: rawFields,
    appOrigin,
  } = (request.data || {}) as {
    generatedDocumentId?: string;
    signers?: SignerInput[];
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
    /** window.location.origin — si localhost, les liens e-mail pointent vers le local */
    appOrigin?: string;
  };

  if (!generatedDocumentId) {
    throw new HttpsError('invalid-argument', 'generatedDocumentId requis.');
  }

  const db = admin.firestore();
  const docSnap = await db.collection('generatedDocuments').doc(generatedDocumentId).get();
  if (!docSnap.exists) {
    throw new HttpsError('not-found', 'Document introuvable.');
  }
  const genDoc = docSnap.data()!;
  if (genDoc.locked === true || genDoc.isSigned === true) {
    throw new HttpsError('failed-precondition', 'Ce document est déjà signé ou verrouillé.');
  }
  if (genDoc.signatureRequestId) {
    const existing = await db.collection('signatureRequests').doc(genDoc.signatureRequestId).get();
    if (existing.exists && ['pending', 'completed'].includes(existing.data()?.status)) {
      throw new HttpsError(
        'already-exists',
        'Une demande de signature est déjà en cours ou terminée pour ce document.'
      );
    }
  }

  const structureId = (genDoc.structureId as string) || '';
  if (!structureId) {
    throw new HttpsError('failed-precondition', 'Document sans structureId.');
  }
  await assertCanManageSignatures(uid, structureId);

  const storagePath =
    (genDoc.storagePath as string) ||
    (typeof genDoc.fileUrl === 'string' && genDoc.fileUrl.includes('/o/')
      ? decodeURIComponent(genDoc.fileUrl.split('/o/')[1]?.split('?')[0] || '')
      : '');
  if (!storagePath) {
    throw new HttpsError('failed-precondition', 'Chemin Storage du PDF introuvable.');
  }

  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new HttpsError('not-found', 'Fichier PDF introuvable dans Storage.');
  }
  const [pdfBytes] = await file.download();
  const buf = Buffer.from(pdfBytes);
  const sha256Before = sha256Buffer(buf);
  const title =
    (genDoc.fileName as string) ||
    (genDoc.name as string) ||
    (genDoc.documentType as string) ||
    'Document';

  const signersIn = sanitizeSigners(rawSigners || []);
  const wording =
    typeof consentWording === 'string' && consentWording.trim()
      ? consentWording.trim()
      : SIGNATURE_CONSENT_WORDING;

  const now = Date.now();
  const expiresAt = Timestamp.fromMillis(now + ACCESS_TOKEN_TTL_MS);
  const accessTokens: { signerId: string; email: string; rawToken: string }[] = [];

  const signers = signersIn.map((s) => {
    const signerId = randomUUID();
    const rawToken = generateRawToken();
    accessTokens.push({ signerId, email: s.email, rawToken });
    return {
      id: signerId,
      email: s.email,
      name: s.name,
      phone: s.phone || null,
      userId: s.userId || null,
      order: s.order ?? 0,
      status: 'pending',
      accessTokenHash: hashToken(rawToken),
      accessTokenExpiresAt: expiresAt,
      accessTokenUsedAt: null,
      sessionTokenHash: null,
      sessionExpiresAt: null,
      signedAt: null,
      signatureImagePath: null,
      consentAcceptedAt: null,
      consentWordingSnapshot: null,
      ip: null,
      userAgent: null,
      otpHash: null,
      otpExpiresAt: null,
    };
  });

  const requestRef = db.collection('signatureRequests').doc();
  const { ip, userAgent } = extractRequestContext(request.rawRequest || {});

  const signatureFields = (Array.isArray(rawFields) ? rawFields : [])
    .filter(
      (f) =>
        typeof f.signerOrder === 'number' &&
        typeof f.pageIndex === 'number' &&
        typeof f.xPct === 'number' &&
        typeof f.yPct === 'number'
    )
    .map((f) => {
      const order = Math.max(0, Math.min(signers.length - 1, Math.floor(f.signerOrder)));
      return {
        id: f.id || randomUUID(),
        signerOrder: order,
        signerId: signers[order]?.id || null,
        pageIndex: Math.max(0, Math.floor(f.pageIndex)),
        xPct: clampPct(f.xPct),
        yPct: clampPct(f.yPct),
        widthPct: clampPct(f.widthPct ?? 25),
        heightPct: clampPct(f.heightPct ?? 8),
        label: typeof f.label === 'string' ? f.label.slice(0, 80) : null,
      };
    });

  const requestPayload = {
    structureId,
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    status: 'pending',
    source: {
      type: 'generatedDocument',
      id: generatedDocumentId,
      missionId: genDoc.missionId || null,
      missionNumber: genDoc.missionNumber || genDoc.missionNumero || null,
      missionTitle: genDoc.missionTitle || null,
    },
    document: {
      title,
      storagePath,
      contentType: 'application/pdf',
      sha256Before,
      byteSize: buf.length,
    },
    sealed: null,
    consentWording: wording,
    signers,
    signatureFields,
    smsReady: true,
    expiresAt,
  };

  // Quota signatures free + création de la demande — atomiques
  const billingRef = billingCurrentRef(db, structureId);
  await db.runTransaction(async (tx) => {
    const billingSnap = await tx.get(billingRef);
    consumeFreeSignatureTokenInTransaction(tx, billingRef, billingSnap);
    tx.set(requestRef, requestPayload);
  });

  await appendSignatureEvent(requestRef.id, {
    type: 'created',
    actor: uid,
    ip,
    userAgent,
    meta: { generatedDocumentId, signerCount: signers.length, sha256Before },
  });

  await db.collection('generatedDocuments').doc(generatedDocumentId).set(
    {
      signatureRequestId: requestRef.id,
      signatureStatus: 'pending',
      ...(genDoc.storagePath ? {} : { storagePath }),
    },
    { merge: true }
  );

  const base = resolveAppBaseUrl(appOrigin);
  const emailResults: Array<{ email: string; ok: boolean; error: string | null }> = [];
  for (const t of accessTokens) {
    const signLink = `${base}/sign/${requestRef.id}?t=${encodeURIComponent(t.rawToken)}`;
    const sent = await sendInviteEmail({
      toEmail: t.email,
      documentTitle: title,
      signLink,
      structureId,
      sentByUserId: uid,
    });
    emailResults.push({
      email: t.email,
      ok: sent.ok,
      error: sent.error || null,
    });
    await appendSignatureEvent(requestRef.id, {
      type: sent.ok ? 'email_sent' : 'email_failed',
      actor: t.signerId,
      ip,
      userAgent,
      meta: { email: t.email, error: sent.error || null, linkBase: base },
    });
  }

  const created = await requestRef.get();
  return {
    requestId: requestRef.id,
    request: toPublicRequest(requestRef.id, created.data()!),
    emailResults,
  };
});

export const cancelSignatureRequest = onCall(callConfigAuth, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentification requise.');
  const { requestId } = (request.data || {}) as { requestId?: string };
  if (!requestId) throw new HttpsError('invalid-argument', 'requestId requis.');

  const db = admin.firestore();
  const ref = db.collection('signatureRequests').doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Demande introuvable.');
  const data = snap.data()!;
  await assertCanManageSignatures(request.auth.uid, data.structureId);

  if (data.status === 'completed') {
    throw new HttpsError('failed-precondition', 'Impossible d’annuler une signature complétée.');
  }
  if (data.status === 'cancelled') {
    return { ok: true };
  }

  const { ip, userAgent } = extractRequestContext(request.rawRequest || {});
  await ref.update({
    status: 'cancelled',
    updatedAt: FieldValue.serverTimestamp(),
  });
  await appendSignatureEvent(requestId, {
    type: 'cancelled',
    actor: request.auth.uid,
    ip,
    userAgent,
  });

  if (data.source?.id) {
    await db.collection('generatedDocuments').doc(data.source.id).set(
      { signatureStatus: 'cancelled' },
      { merge: true }
    );
  }
  return { ok: true };
});

async function deleteStoragePrefix(prefix: string): Promise<void> {
  if (!prefix?.trim()) return;
  try {
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({ prefix });
    await Promise.all(
      files.map((file) => file.delete({ ignoreNotFound: true }).catch(() => undefined))
    );
  } catch (err) {
    console.warn('deleteStoragePrefix failed:', prefix, err);
  }
}

async function safeDeleteStorageFile(filePath: string | null | undefined): Promise<void> {
  if (!filePath?.trim()) return;
  try {
    await admin.storage().bucket().file(filePath).delete({ ignoreNotFound: true });
  } catch {
    // Fichier absent ou accès non critique
  }
}

/**
 * Hard-delete d’une demande de signature (Firestore + Storage).
 * Réservé au super administrateur.
 */
export const deleteSignatureRequest = onCall(callConfigAuth, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentification requise.');
  await assertSuperAdmin(request.auth.uid);

  const { requestId } = (request.data || {}) as { requestId?: string };
  if (!requestId) throw new HttpsError('invalid-argument', 'requestId requis.');

  const db = admin.firestore();
  const ref = db.collection('signatureRequests').doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Demande introuvable.');
  const data = snap.data()!;
  const structureId = data.structureId as string | undefined;

  // Journal d’événements
  const eventsSnap = await ref.collection('events').get();
  if (!eventsSnap.empty) {
    const docs = eventsSnap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = db.batch();
      docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  // Fichiers Storage liés à la demande (scellés, images signataires, etc.)
  if (structureId) {
    await deleteStoragePrefix(`structures/${structureId}/signatures/${requestId}/`);
  }
  await safeDeleteStorageFile(data.sealed?.storagePath as string | undefined);
  await safeDeleteStorageFile(data.sealed?.documentOnlyStoragePath as string | undefined);
  for (const signer of data.signers || []) {
    await safeDeleteStorageFile(signer?.signatureImagePath as string | undefined);
  }

  // PDF d’upload dédié signatures (pas les PDF mission/études partagés)
  const docStoragePath = data.document?.storagePath as string | undefined;
  if (docStoragePath?.includes('/signatures/uploads/')) {
    await safeDeleteStorageFile(docStoragePath);
  }

  // Document généré lié
  const sourceId = data.source?.id as string | undefined;
  if (sourceId) {
    const genRef = db.collection('generatedDocuments').doc(sourceId);
    const genSnap = await genRef.get();
    if (genSnap.exists) {
      const gen = genSnap.data()!;
      const fromUrl =
        typeof gen.fileUrl === 'string' && gen.fileUrl.includes('/o/')
          ? decodeURIComponent(gen.fileUrl.split('/o/')[1]?.split('?')[0] || '')
          : null;
      const genPaths = [
        gen.sealedStoragePath,
        gen.signedDocumentStoragePath,
        typeof gen.storagePath === 'string' ? gen.storagePath : null,
        fromUrl,
      ].filter(Boolean) as string[];
      for (const p of genPaths) {
        await safeDeleteStorageFile(p);
      }
      await genRef.delete();
    }
  }

  await ref.delete();
  return { ok: true };
});

export const resendSignatureInvite = onCall(callConfigAuth, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentification requise.');
  const { requestId, signerId, appOrigin } = (request.data || {}) as {
    requestId?: string;
    signerId?: string;
    appOrigin?: string;
  };
  if (!requestId || !signerId) {
    throw new HttpsError('invalid-argument', 'requestId et signerId requis.');
  }

  const db = admin.firestore();
  const ref = db.collection('signatureRequests').doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Demande introuvable.');
  const data = snap.data()!;
  await assertCanManageSignatures(request.auth.uid, data.structureId);

  if (data.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'La demande n’est plus en attente.');
  }

  const signers = [...(data.signers || [])];
  const idx = signers.findIndex((s: { id: string }) => s.id === signerId);
  if (idx < 0) throw new HttpsError('not-found', 'Signataire introuvable.');
  const signer = signers[idx];
  if (signer.status === 'signed') {
    throw new HttpsError('failed-precondition', 'Ce signataire a déjà signé.');
  }

  const rawToken = generateRawToken();
  const expiresAt = Timestamp.fromMillis(Date.now() + ACCESS_TOKEN_TTL_MS);
  signers[idx] = {
    ...signer,
    accessTokenHash: hashToken(rawToken),
    accessTokenExpiresAt: expiresAt,
    accessTokenUsedAt: null,
    sessionTokenHash: null,
    sessionExpiresAt: null,
    status: signer.status === 'opened' ? 'pending' : signer.status,
  };

  await ref.update({ signers, updatedAt: FieldValue.serverTimestamp() });

  const { ip, userAgent } = extractRequestContext(request.rawRequest || {});
  const base = resolveAppBaseUrl(appOrigin);
  const signLink = `${base}/sign/${requestId}?t=${encodeURIComponent(rawToken)}`;
  const sent = await sendInviteEmail({
    toEmail: signer.email,
    documentTitle: data.document?.title || 'Document',
    signLink,
    structureId: data.structureId,
    sentByUserId: request.auth.uid,
  });
  await appendSignatureEvent(requestId, {
    type: sent.ok ? 'email_sent' : 'email_failed',
    actor: signerId,
    ip,
    userAgent,
    meta: { email: signer.email, resend: true, error: sent.error || null, linkBase: base },
  });

  return { ok: sent.ok, error: sent.error };
});

/**
 * Exchange one-time access token for a short-lived session token.
 */
export const openSignLink = onCall(callConfigPublic, async (request) => {
  const { requestId, token } = (request.data || {}) as {
    requestId?: string;
    token?: string;
  };
  if (!requestId || !token) {
    throw new HttpsError('invalid-argument', 'requestId et token requis.');
  }

  const { ip, userAgent } = extractRequestContext(request.rawRequest || {});
  await assertSignatureRateLimit(
    `open:${ip || 'unknown'}:${requestId}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS
  );

  const db = admin.firestore();
  const ref = db.collection('signatureRequests').doc(requestId);
  const tokenHash = hashToken(token);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Demande introuvable.');
    const data = snap.data()!;
    if (data.status === 'cancelled') {
      throw new HttpsError('failed-precondition', 'Cette demande a été annulée.');
    }
    if (data.status === 'completed') {
      throw new HttpsError('failed-precondition', 'Ce document est déjà entièrement signé.');
    }
    if (data.status === 'expired') {
      throw new HttpsError('failed-precondition', 'Cette demande a expiré.');
    }

    const signers = [...(data.signers || [])];
    const idx = signers.findIndex((s: { accessTokenHash: string }) => s.accessTokenHash === tokenHash);
    if (idx < 0) {
      throw new HttpsError('permission-denied', 'Lien invalide.');
    }
    const signer = signers[idx];
    if (signer.status === 'signed') {
      throw new HttpsError('failed-precondition', 'Vous avez déjà signé ce document.');
    }
    const exp = signer.accessTokenExpiresAt?.toMillis?.() ?? 0;
    if (exp && Date.now() > exp) {
      throw new HttpsError('deadline-exceeded', 'Ce lien a expiré.');
    }

    // Token réutilisable jusqu’à signature (préchargement clients mail) ;
    // invalidé uniquement au resend (nouveau hash) ou après signature.
    const sessionRaw = generateRawToken();
    const sessionExpiresAt = Timestamp.fromMillis(Date.now() + SESSION_TTL_MS);
    signers[idx] = {
      ...signer,
      accessTokenUsedAt: signer.accessTokenUsedAt || Timestamp.now(),
      sessionTokenHash: hashToken(sessionRaw),
      sessionExpiresAt,
      status: 'opened',
    };
    tx.update(ref, { signers, updatedAt: FieldValue.serverTimestamp() });
    return {
      sessionToken: sessionRaw,
      signerId: signer.id,
      consentWording: data.consentWording as string,
      documentTitle: data.document?.title as string,
      expiresAt: sessionExpiresAt.toMillis(),
    };
  });

  await appendSignatureEvent(requestId, {
    type: 'link_opened',
    actor: result.signerId,
    ip,
    userAgent,
  });

  return result;
});

export const getSignSession = onCall(callConfigPublic, async (request) => {
  const { requestId, sessionToken } = (request.data || {}) as {
    requestId?: string;
    sessionToken?: string;
  };
  if (!requestId || !sessionToken) {
    throw new HttpsError('invalid-argument', 'requestId et sessionToken requis.');
  }

  const { ip, userAgent } = extractRequestContext(request.rawRequest || {});
  await assertSignatureRateLimit(`session:${ip || 'unknown'}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

  const db = admin.firestore();
  const snap = await db.collection('signatureRequests').doc(requestId).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Demande introuvable.');
  const data = snap.data()!;
  if (data.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'Cette demande n’est plus active.');
  }

  const sessionHash = hashToken(sessionToken);
  const signer = (data.signers || []).find(
    (s: { sessionTokenHash?: string }) => s.sessionTokenHash === sessionHash
  );
  if (!signer) throw new HttpsError('permission-denied', 'Session invalide.');
  if (signer.status === 'signed') {
    throw new HttpsError('failed-precondition', 'Vous avez déjà signé.');
  }
  const sexp = signer.sessionExpiresAt?.toMillis?.() ?? 0;
  if (sexp && Date.now() > sexp) {
    throw new HttpsError('deadline-exceeded', 'Session expirée. Rouvrez le lien email.');
  }

  const storagePath = data.document?.storagePath as string | undefined;
  const { pdfUrl, pdfBase64 } = await getStoragePdfForClient(storagePath || '');

  await appendSignatureEvent(requestId, {
    type: 'document_viewed',
    actor: signer.id,
    ip,
    userAgent,
  });

  return {
    documentTitle: data.document.title,
    consentWording: data.consentWording,
    signer: {
      id: signer.id,
      name: signer.name,
      email: signer.email,
    },
    pdfUrl,
    pdfBase64,
    sha256Before: data.document.sha256Before,
    signatureFields: ((data.signatureFields as Array<{ signerId?: string }> ) || []).filter(
      (f) => f.signerId === signer.id
    ),
  };
});

/**
 * openSignLink + getSignSession en un seul RTT (page /sign).
 */
export const openSignSession = onCall(callConfigPublic, async (request) => {
  const { requestId, token } = (request.data || {}) as {
    requestId?: string;
    token?: string;
  };
  if (!requestId || !token) {
    throw new HttpsError('invalid-argument', 'requestId et token requis.');
  }

  const { ip, userAgent } = extractRequestContext(request.rawRequest || {});
  await assertSignatureRateLimit(
    `open:${ip || 'unknown'}:${requestId}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS
  );

  const db = admin.firestore();
  const ref = db.collection('signatureRequests').doc(requestId);
  const tokenHash = hashToken(token);

  const opened = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Demande introuvable.');
    const data = snap.data()!;
    if (data.status === 'cancelled') {
      throw new HttpsError('failed-precondition', 'Cette demande a été annulée.');
    }
    if (data.status === 'completed') {
      throw new HttpsError('failed-precondition', 'Ce document est déjà entièrement signé.');
    }
    if (data.status === 'expired') {
      throw new HttpsError('failed-precondition', 'Cette demande a expiré.');
    }
    if (data.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'Cette demande n’est plus active.');
    }

    const signers = [...(data.signers || [])];
    const idx = signers.findIndex((s: { accessTokenHash: string }) => s.accessTokenHash === tokenHash);
    if (idx < 0) {
      throw new HttpsError('permission-denied', 'Lien invalide.');
    }
    const signer = signers[idx];
    if (signer.status === 'signed') {
      throw new HttpsError('failed-precondition', 'Vous avez déjà signé ce document.');
    }
    const exp = signer.accessTokenExpiresAt?.toMillis?.() ?? 0;
    if (exp && Date.now() > exp) {
      throw new HttpsError('deadline-exceeded', 'Ce lien a expiré.');
    }

    const sessionRaw = generateRawToken();
    const sessionExpiresAt = Timestamp.fromMillis(Date.now() + SESSION_TTL_MS);
    signers[idx] = {
      ...signer,
      accessTokenUsedAt: signer.accessTokenUsedAt || Timestamp.now(),
      // Garde l’ancienne session (double mount React Strict Mode / race).
      previousSessionTokenHash: signer.sessionTokenHash || null,
      sessionTokenHash: hashToken(sessionRaw),
      sessionExpiresAt,
      status: 'opened',
    };
    tx.update(ref, { signers, updatedAt: FieldValue.serverTimestamp() });

    return {
      sessionToken: sessionRaw,
      signerId: signer.id as string,
      signerName: signer.name as string,
      signerEmail: signer.email as string,
      consentWording: data.consentWording as string,
      documentTitle: (data.document?.title as string) || 'Document',
      sha256Before: data.document?.sha256Before as string,
      storagePath: data.document?.storagePath as string,
      signatureFields: ((data.signatureFields as Array<{ signerId?: string }>) || []).filter(
        (f) => f.signerId === signer.id
      ),
      expiresAt: sessionExpiresAt.toMillis(),
    };
  });

  await appendSignatureEvent(requestId, {
    type: 'link_opened',
    actor: opened.signerId,
    ip,
    userAgent,
  });

  const { pdfUrl, pdfBase64 } = await getStoragePdfForClient(opened.storagePath || '');

  await appendSignatureEvent(requestId, {
    type: 'document_viewed',
    actor: opened.signerId,
    ip,
    userAgent,
  });

  return {
    sessionToken: opened.sessionToken,
    signerId: opened.signerId,
    expiresAt: opened.expiresAt,
    documentTitle: opened.documentTitle,
    consentWording: opened.consentWording,
    signer: {
      id: opened.signerId,
      name: opened.signerName,
      email: opened.signerEmail,
    },
    pdfUrl,
    pdfBase64,
    sha256Before: opened.sha256Before,
    signatureFields: opened.signatureFields,
  };
});

export const submitSignature = onCall(callConfigPublic, async (request) => {
  const {
    requestId,
    sessionToken,
    consentAccepted,
    consentWording,
    signatureImageBase64,
  } = (request.data || {}) as {
    requestId?: string;
    sessionToken?: string;
    consentAccepted?: boolean;
    consentWording?: string;
    signatureImageBase64?: string;
  };

  if (!requestId || !sessionToken) {
    throw new HttpsError('invalid-argument', 'requestId et sessionToken requis.');
  }
  if (consentAccepted !== true) {
    throw new HttpsError('invalid-argument', 'Le consentement explicite est requis.');
  }
  if (!signatureImageBase64 || typeof signatureImageBase64 !== 'string') {
    throw new HttpsError('invalid-argument', 'Image de signature requise.');
  }

  const { ip, userAgent } = extractRequestContext(request.rawRequest || {});
  await assertSignatureRateLimit(
    `submit:${ip || 'unknown'}:${requestId}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS
  );

  // Strip data URL prefix
  const b64 = signatureImageBase64.replace(/^data:image\/\w+;base64,/, '');
  let imageBuf: Buffer;
  try {
    imageBuf = Buffer.from(b64, 'base64');
  } catch {
    throw new HttpsError('invalid-argument', 'Image de signature invalide.');
  }
  if (imageBuf.length < 100 || imageBuf.length > 2 * 1024 * 1024) {
    throw new HttpsError('invalid-argument', 'Taille de signature invalide.');
  }

  const db = admin.firestore();
  const ref = db.collection('signatureRequests').doc(requestId);
  const sessionHash = hashToken(sessionToken);

  const { signerId, allSigned, structureId, expectedWording } = await db.runTransaction(
    async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', 'Demande introuvable.');
      const data = snap.data()!;
      if (data.status !== 'pending') {
        throw new HttpsError('failed-precondition', 'Demande non active.');
      }
      const expected = (data.consentWording as string) || SIGNATURE_CONSENT_WORDING;
      if (consentWording && consentWording.trim() !== expected.trim()) {
        throw new HttpsError(
          'invalid-argument',
          'Le texte de consentement ne correspond pas à celui affiché.'
        );
      }

      const signers = [...(data.signers || [])];
      const idx = signers.findIndex(
        (s: { sessionTokenHash?: string; previousSessionTokenHash?: string }) =>
          s.sessionTokenHash === sessionHash || s.previousSessionTokenHash === sessionHash
      );
      if (idx < 0) throw new HttpsError('permission-denied', 'Session invalide.');
      const signer = signers[idx];
      if (signer.status === 'signed') {
        throw new HttpsError('failed-precondition', 'Déjà signé.');
      }
      const sexp = signer.sessionExpiresAt?.toMillis?.() ?? 0;
      if (sexp && Date.now() > sexp) {
        throw new HttpsError('deadline-exceeded', 'Session expirée.');
      }

      const signatureImagePath = `structures/${data.structureId}/signatures/${requestId}/signers/${signer.id}.png`;

      const signedAt = Timestamp.now();
      signers[idx] = {
        ...signer,
        status: 'signed',
        signedAt,
        consentAcceptedAt: signedAt,
        consentWordingSnapshot: expected,
        signatureImagePath,
        ip: ip || null,
        userAgent: userAgent || null,
        sessionTokenHash: null,
        previousSessionTokenHash: null,
        sessionExpiresAt: null,
      };

      const allDone = signers.every((s: { status: string }) => s.status === 'signed');
      tx.update(ref, {
        signers,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        signerId: signer.id as string,
        allSigned: allDone,
        structureId: data.structureId as string,
        expectedWording: expected,
      };
    }
  );

  await admin.storage().bucket().file(
    `structures/${structureId}/signatures/${requestId}/signers/${signerId}.png`
  ).save(imageBuf, { contentType: 'image/png' });

  await appendSignatureEvent(requestId, {
    type: 'consent_accepted',
    actor: signerId,
    ip,
    userAgent,
    meta: { consentWording: expectedWording },
  });
  await appendSignatureEvent(requestId, {
    type: 'signed',
    actor: signerId,
    ip,
    userAgent,
  });

  let sealed: { storagePath: string; sha256After: string } | null = null;
  if (allSigned) {
    sealed = await sealSignedDocument(requestId);

    const after = await ref.get();
    const afterData = after.data()!;
    const title = afterData.document?.title || 'Document';
    const viewLink = `${getAppBaseUrl()}/app/signatures`;
    for (const s of afterData.signers || []) {
      await sendTemplatedEmail({
        templateKey: 'SIGNATURE_COMPLETED',
        toEmail: s.email,
        subject: `Signature complétée : ${title}`,
        templateParams: {
          document_title: title,
          sign_link: viewLink,
        },
        linkFields: ['sign_link'],
        structureId: afterData.structureId,
        logType: 'signature_completed',
      });
    }
  }

  return { ok: true, completed: allSigned, sealed };
});

export const getSignatureAudit = onCall(callConfigAuth, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentification requise.');
  const { requestId } = (request.data || {}) as { requestId?: string };
  if (!requestId) throw new HttpsError('invalid-argument', 'requestId requis.');

  const db = admin.firestore();
  const snap = await db.collection('signatureRequests').doc(requestId).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Demande introuvable.');
  const data = snap.data()!;
  await assertCanManageSignatures(request.auth.uid, data.structureId);

  const eventsSnap = await db
    .collection('signatureRequests')
    .doc(requestId)
    .collection('events')
    .orderBy('at', 'asc')
    .get();

  const events = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return {
    request: toPublicRequest(requestId, data),
    events,
  };
});

export const getSealedDocumentUrl = onCall(callConfigAuth, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentification requise.');
  const { requestId } = (request.data || {}) as { requestId?: string };
  if (!requestId) throw new HttpsError('invalid-argument', 'requestId requis.');

  const db = admin.firestore();
  const snap = await db.collection('signatureRequests').doc(requestId).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Demande introuvable.');
  const data = snap.data()!;
  await assertCanManageSignatures(request.auth.uid, data.structureId);

  const sealedPath = data.sealed?.storagePath as string | undefined;
  if (!sealedPath) throw new HttpsError('failed-precondition', 'PDF scellé non disponible.');

  let documentOnlyPath = data.sealed?.documentOnlyStoragePath as string | undefined;
  if (!documentOnlyPath) {
    // Anciens scellements : retirer la dernière page (certificat).
    try {
      const bucket = admin.storage().bucket();
      const [bytes] = await bucket.file(sealedPath).download();
      const doc = await PDFDocument.load(bytes);
      const pageCount = doc.getPageCount();
      if (pageCount > 1) {
        const only = await PDFDocument.create();
        const pages = await only.copyPages(
          doc,
          Array.from({ length: pageCount - 1 }, (_, i) => i)
        );
        pages.forEach((p) => only.addPage(p));
        const out = await only.save();
        documentOnlyPath = `structures/${data.structureId}/signatures/${requestId}/signed-document.pdf`;
        await bucket.file(documentOnlyPath).save(Buffer.from(out), {
          contentType: 'application/pdf',
        });
        await snap.ref.update({
          'sealed.documentOnlyStoragePath': documentOnlyPath,
        });
      } else {
        documentOnlyPath = sealedPath;
      }
    } catch (err) {
      console.warn('documentOnly fallback failed', err);
      documentOnlyPath = sealedPath;
    }
  }

  const [full, documentOnly] = await Promise.all([
    getStoragePdfForClient(sealedPath),
    getStoragePdfForClient(documentOnlyPath),
  ]);

  return {
    full: { url: full.pdfUrl, pdfBase64: full.pdfBase64 },
    document: { url: documentOnly.pdfUrl, pdfBase64: documentOnly.pdfBase64 },
    // compat anciens clients
    url: full.pdfUrl,
    pdfBase64: full.pdfBase64,
    sha256After: data.sealed?.sha256After || null,
  };
});

export const listSignatureRequests = onCall(callConfigAuth, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentification requise.');
  const user = await getCallerUser(request.auth.uid);
  if (!user?.structureId && !isSuperAdminUser(user)) {
    throw new HttpsError('failed-precondition', 'Aucune structure.');
  }
  const structureId =
    ((request.data || {}) as { structureId?: string }).structureId ||
    (user!.structureId as string);
  await assertCanManageSignatures(request.auth.uid, structureId);

  // Pas d'orderBy : évite d'attendre un index composite en construction.
  // Tri mémoire sur createdAt.
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

  const requests = snap.docs
    .map((d) => toPublicRequest(d.id, d.data()))
    .sort((a, b) => {
      const ta = toMillis(a.createdAt);
      const tb = toMillis(b.createdAt);
      return tb - ta;
    });

  return { requests };
});

function toMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'object' && value !== null) {
    const v = value as { _seconds?: number; seconds?: number; toMillis?: () => number };
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v._seconds === 'number') return v._seconds * 1000;
    if (typeof v.seconds === 'number') return v.seconds * 1000;
  }
  const t = new Date(value as string | number | Date).getTime();
  return Number.isFinite(t) ? t : 0;
}
