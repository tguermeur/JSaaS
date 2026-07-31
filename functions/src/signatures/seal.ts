import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { sha256Buffer, maskIp } from './crypto';
import { appendSignatureEvent } from './audit';

interface SignerForSeal {
  id: string;
  name: string;
  email: string;
  signedAt?: FirebaseFirestore.Timestamp | Date | null;
  ip?: string | null;
  consentWordingSnapshot?: string | null;
  signatureImagePath?: string | null;
}

interface FieldForSeal {
  id: string;
  signerId?: string | null;
  pageIndex: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
}

const NAVY = rgb(23 / 255, 59 / 255, 108 / 255);
const TEAL = rgb(33 / 255, 189 / 255, 163 / 255);
const INK = rgb(17 / 255, 24 / 255, 39 / 255);
const MUTED = rgb(100 / 255, 116 / 255, 139 / 255);
const LINE = rgb(226 / 255, 232 / 255, 240 / 255);
const CARD_BG = rgb(248 / 255, 250 / 255, 252 / 255);

function formatFrDate(value: unknown): string {
  let d: Date | null = null;
  if (value && typeof value === 'object' && typeof (value as FirebaseFirestore.Timestamp).toDate === 'function') {
    d = (value as FirebaseFirestore.Timestamp).toDate();
  } else if (value instanceof Date) {
    d = value;
  }
  if (!d || Number.isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return d.toISOString();
  }
}

function wrapText(text: string, maxChars: number): string[] {
  const words = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!w) continue;
    if ((cur + ' ' + w).trim().length > maxChars) {
      if (cur) lines.push(cur);
      cur = w.length > maxChars ? w.slice(0, maxChars) : w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function drawCertificatePage(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  opts: {
    requestId: string;
    title: string;
    sha256Before: string;
    sha256AfterPreview: string;
    consentWording: string;
    signers: SignerForSeal[];
  }
) {
  const { width, height } = page.getSize();
  const { regular, bold } = fonts;
  const marginX = 48;

  // Header band
  page.drawRectangle({
    x: 0,
    y: height - 110,
    width,
    height: 110,
    color: NAVY,
  });
  page.drawRectangle({
    x: 0,
    y: height - 114,
    width,
    height: 4,
    color: TEAL,
  });

  page.drawText('JS Connect', {
    x: marginX,
    y: height - 42,
    size: 11,
    font: bold,
    color: TEAL,
  });
  page.drawText('Certificat de signature électronique', {
    x: marginX,
    y: height - 68,
    size: 18,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText('Signature électronique simple (SES)', {
    x: marginX,
    y: height - 88,
    size: 10,
    font: regular,
    color: rgb(0.85, 0.9, 0.98),
  });

  let y = height - 148;

  const sectionTitle = (label: string) => {
    page.drawText(label.toUpperCase(), {
      x: marginX,
      y,
      size: 9,
      font: bold,
      color: TEAL,
    });
    y -= 8;
    page.drawRectangle({
      x: marginX,
      y,
      width: width - marginX * 2,
      height: 1.2,
      color: LINE,
    });
    y -= 18;
  };

  const drawLines = (text: string, size = 10, color = INK, max = 78) => {
    for (const line of wrapText(text, max)) {
      if (y < 70) return;
      page.drawText(line, {
        x: marginX,
        y,
        size,
        font: regular,
        color,
      });
      y -= size + 5;
    }
  };

  sectionTitle('Document');
  page.drawText(opts.title || 'Document', {
    x: marginX,
    y,
    size: 13,
    font: bold,
    color: INK,
  });
  y -= 18;
  drawLines(`Référence : ${opts.requestId}`, 9, MUTED, 85);
  drawLines(`Empreinte SHA-256 (avant signature) :`, 9, MUTED, 85);
  drawLines(opts.sha256Before, 8, MUTED, 92);
  y -= 10;

  sectionTitle('Signataires');
  for (const s of opts.signers) {
    if (y < 140) break;
    const boxH = 68;
    page.drawRectangle({
      x: marginX,
      y: y - boxH + 14,
      width: width - marginX * 2,
      height: boxH,
      color: CARD_BG,
      borderColor: LINE,
      borderWidth: 1,
    });
    page.drawRectangle({
      x: marginX,
      y: y - boxH + 14,
      width: 4,
      height: boxH,
      color: TEAL,
    });
    page.drawText(s.name || 'Signataire', {
      x: marginX + 14,
      y: y - 4,
      size: 11,
      font: bold,
      color: INK,
    });
    page.drawText(s.email || '', {
      x: marginX + 14,
      y: y - 20,
      size: 9,
      font: regular,
      color: MUTED,
    });
    page.drawText(`Signé le : ${formatFrDate(s.signedAt)}`, {
      x: marginX + 14,
      y: y - 36,
      size: 9,
      font: regular,
      color: INK,
    });
    page.drawText(`Adresse IP (masquée) : ${maskIp(s.ip) || '—'}`, {
      x: marginX + 14,
      y: y - 50,
      size: 8,
      font: regular,
      color: MUTED,
    });
    y -= boxH + 12;
  }

  y -= 4;
  sectionTitle('Consentement');
  drawLines(
    opts.consentWording || opts.signers[0]?.consentWordingSnapshot || '—',
    9,
    INK,
    82
  );

  y -= 12;
  sectionTitle('Intégrité');
  drawLines(
    'Ce certificat atteste que le document a été signé électroniquement via JS Connect.',
    9,
    MUTED,
    82
  );
  drawLines(`Empreinte SHA-256 du document signé : ${opts.sha256AfterPreview}`, 8, MUTED, 92);

  // Footer
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height: 42,
    color: CARD_BG,
  });
  page.drawRectangle({
    x: 0,
    y: 42,
    width,
    height: 1,
    color: LINE,
  });
  page.drawText('Document généré automatiquement — ne pas répondre', {
    x: marginX,
    y: 18,
    size: 8,
    font: regular,
    color: MUTED,
  });
  page.drawText('js-connect.fr', {
    x: width - marginX - 70,
    y: 18,
    size: 8,
    font: bold,
    color: NAVY,
  });
}

/**
 * Embed signature images on field positions, append certificate page,
 * upload sealed PDF (+ document-only), update request + source document.
 */
export async function sealSignedDocument(requestId: string): Promise<{
  storagePath: string;
  documentOnlyStoragePath: string;
  sha256After: string;
}> {
  const db = admin.firestore();
  const ref = db.collection('signatureRequests').doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error(`signatureRequest ${requestId} introuvable`);
  }
  const data = snap.data()!;
  const structureId = data.structureId as string;
  const docMeta = data.document as {
    storagePath: string;
    sha256Before: string;
    title: string;
  };
  const consentWording = (data.consentWording as string) || '';
  const signers = (data.signers as SignerForSeal[]) || [];
  const fields = (data.signatureFields as FieldForSeal[]) || [];
  const source = data.source as { type: string; id: string; missionId?: string | null };

  const bucket = admin.storage().bucket();
  const [pdfBytes] = await bucket.file(docMeta.storagePath).download();
  const buf = Buffer.from(pdfBytes);
  const currentHash = sha256Buffer(buf);
  if (currentHash !== docMeta.sha256Before) {
    throw new Error(
      'Le document source a été modifié depuis l’envoi en signature (hash SHA-256 différent).'
    );
  }

  const pdfDoc = await PDFDocument.load(pdfBytes);

  const imageCache = new Map<string, Awaited<ReturnType<PDFDocument['embedPng']>>>();
  for (const field of fields) {
    const signer = signers.find((s) => s.id === field.signerId);
    if (!signer?.signatureImagePath) continue;
    let embedded = imageCache.get(signer.signatureImagePath);
    if (!embedded) {
      try {
        const [imgBytes] = await bucket.file(signer.signatureImagePath).download();
        embedded = await pdfDoc.embedPng(imgBytes);
        imageCache.set(signer.signatureImagePath, embedded);
      } catch {
        continue;
      }
    }
    const pages = pdfDoc.getPages();
    const page = pages[field.pageIndex];
    if (!page) continue;
    const { width, height } = page.getSize();
    const boxW = (field.widthPct / 100) * width;
    const boxH = (field.heightPct / 100) * height;
    const x = (field.xPct / 100) * width;
    const y = height - (field.yPct / 100) * height - boxH;
    page.drawImage(embedded, {
      x,
      y,
      width: boxW,
      height: boxH,
    });
  }

  if (fields.length === 0) {
    const pages = pdfDoc.getPages();
    const last = pages[pages.length - 1];
    if (last) {
      const { width } = last.getSize();
      let offsetX = 40;
      for (const signer of signers) {
        if (!signer.signatureImagePath) continue;
        try {
          const [imgBytes] = await bucket.file(signer.signatureImagePath).download();
          const embedded = await pdfDoc.embedPng(imgBytes);
          const boxW = Math.min(160, width * 0.28);
          const boxH = 48;
          last.drawImage(embedded, {
            x: offsetX,
            y: 36,
            width: boxW,
            height: boxH,
          });
          offsetX += boxW + 24;
          if (offsetX > width - 80) break;
        } catch {
          // ignore
        }
      }
    }
  }

  // Document signé sans certificat
  const documentOnlyBytes = await pdfDoc.save();
  const documentOnlyPath = `structures/${structureId}/signatures/${requestId}/signed-document.pdf`;
  await bucket.file(documentOnlyPath).save(Buffer.from(documentOnlyBytes), {
    contentType: 'application/pdf',
    metadata: {
      metadata: {
        signatureRequestId: requestId,
        variant: 'document_only',
      },
    },
  });

  const certPage = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Placeholder hash — réel calculé après save ; on met un aperçu provisoire puis on
  // réécrit le certificat n'est pas possible facilement. On met "voir empreinte fichier".
  // On calcule un hash préliminaire du doc+cert en 2 passes : d'abord avec hash avant, puis
  // le hash scellé final sera stocké en métadonnées (déjà le cas). Sur le PDF on affiche
  // le hash du document signé (sans cert) + note.
  const sha256DocumentOnly = sha256Buffer(Buffer.from(documentOnlyBytes));

  drawCertificatePage(certPage, { regular: font, bold: fontBold }, {
    requestId,
    title: docMeta.title,
    sha256Before: docMeta.sha256Before,
    sha256AfterPreview: sha256DocumentOnly,
    consentWording,
    signers,
  });

  // Note on cert: the "after" hash shown is the signed document (without cert page).
  // Full sealed file hash is stored in Firestore sealed.sha256After.

  const sealedBytes = await pdfDoc.save();
  const sealedBuf = Buffer.from(sealedBytes);
  const sha256After = sha256Buffer(sealedBuf);
  const storagePath = `structures/${structureId}/signatures/${requestId}/sealed.pdf`;

  await bucket.file(storagePath).save(sealedBuf, {
    contentType: 'application/pdf',
    metadata: {
      metadata: {
        signatureRequestId: requestId,
        sha256Before: docMeta.sha256Before,
        sha256After,
        sha256DocumentOnly,
      },
    },
  });

  await ref.update({
    status: 'completed',
    sealed: {
      storagePath,
      documentOnlyStoragePath: documentOnlyPath,
      sha256After,
      sha256DocumentOnly,
      sealedAt: FieldValue.serverTimestamp(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (source?.type === 'generatedDocument' && source.id) {
    await db
      .collection('generatedDocuments')
      .doc(source.id)
      .set(
        {
          isSigned: true,
          signedAt: FieldValue.serverTimestamp(),
          signatureRequestId: requestId,
          signatureStatus: 'completed',
          sealedStoragePath: storagePath,
          signedDocumentStoragePath: documentOnlyPath,
          locked: true,
          sha256Signed: sha256After,
        },
        { merge: true }
      );
  }

  await appendSignatureEvent(requestId, {
    type: 'sealed',
    actor: 'system',
    meta: {
      sha256After,
      sha256DocumentOnly,
      storagePath,
      documentOnlyStoragePath: documentOnlyPath,
      fieldCount: fields.length,
    },
  });

  return { storagePath, documentOnlyStoragePath: documentOnlyPath, sha256After };
}
