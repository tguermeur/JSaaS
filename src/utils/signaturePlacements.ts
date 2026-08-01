import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { SignatureField } from '../types/signature';
import type {
  DocumentType,
  SignaturePlacementRole,
  TemplateSignaturePlacement,
} from '../types/templates';
import { counterpartyLabelForDocumentType } from '../types/templates';

const DEFAULT_W = 28;
const DEFAULT_H = 8;

/** Charge les placements préconfigurés pour un type de document / structure. */
export async function loadSignaturePlacementsForDocumentType(
  structureId: string,
  documentType: DocumentType
): Promise<TemplateSignaturePlacement[]> {
  const assignmentsSnap = await getDocs(
    query(
      collection(db, 'templateAssignments'),
      where('structureId', '==', structureId),
      where('documentType', '==', documentType)
    )
  );

  if (!assignmentsSnap.empty) {
    const data = assignmentsSnap.docs[0].data();
    if (Array.isArray(data.signaturePlacements) && data.signaturePlacements.length > 0) {
      return data.signaturePlacements as TemplateSignaturePlacement[];
    }
    const templateId = String(data.templateId || '');
    if (templateId) {
      const templateSnap = await getDoc(doc(db, 'templates', templateId));
      const t = templateSnap.data();
      if (Array.isArray(t?.signaturePlacements)) {
        return t.signaturePlacements as TemplateSignaturePlacement[];
      }
    }
  }

  return [];
}

export function roleToSignerOrder(role: SignaturePlacementRole): number {
  return role === 'counterparty' ? 0 : 1;
}

export function signerOrderToRole(order: number): SignaturePlacementRole {
  return order === 0 ? 'counterparty' : 'structure';
}

export function placementsToSignatureFields(
  placements: TemplateSignaturePlacement[],
  documentType?: DocumentType
): SignatureField[] {
  return placements.map((p) => {
    const order = roleToSignerOrder(p.role);
    const defaultLabel =
      p.role === 'structure'
        ? 'Structure'
        : documentType
          ? counterpartyLabelForDocumentType(documentType)
          : 'Signataire';
    return {
      id: p.id,
      signerOrder: order,
      pageIndex: p.pageIndex,
      xPct: p.xPct,
      yPct: p.yPct,
      widthPct: p.widthPct ?? DEFAULT_W,
      heightPct: p.heightPct ?? DEFAULT_H,
      label: p.label || defaultLabel,
    };
  });
}

export function signatureFieldsToPlacements(
  fields: SignatureField[]
): TemplateSignaturePlacement[] {
  return fields.map((f) => ({
    id: f.id,
    role: signerOrderToRole(f.signerOrder),
    pageIndex: f.pageIndex,
    xPct: f.xPct,
    yPct: f.yPct,
    widthPct: f.widthPct,
    heightPct: f.heightPct,
    label: f.label,
  }));
}

export function draftSignersForDocumentType(documentType: DocumentType): Array<{
  name: string;
  email: string;
}> {
  return [
    { name: counterpartyLabelForDocumentType(documentType), email: '' },
    { name: 'Structure', email: '' },
  ];
}
