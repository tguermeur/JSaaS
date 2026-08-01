export type DocumentType =
  | 'proposition_commerciale'
  | 'lettre_mission'
  | 'note_de_frais'
  | 'facture'
  | 'convention_entreprise'
  | 'convention_etudiant'
  | 'avenant'
  | 'recapitulatif_mission'
  | 'convention_etude'
  | 'proces_verbal_recette'
  | 'rapport_pedagogique'
  | 'avenant_convention'
  | 'convention_consultant';

/** Rôle métier d’une zone de signature préconfigurée sur un template. */
export type SignaturePlacementRole = 'counterparty' | 'structure';

/**
 * Emplacement de signature préconfiguré (coords en % de page, origine haut-gauche).
 * `counterparty` = client (PC) ou étudiant (LM / avenant) ; `structure` = JE / Job Service.
 */
export interface TemplateSignaturePlacement {
  id: string;
  role: SignaturePlacementRole;
  pageIndex: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  label?: string;
}

export interface TemplateAssignment {
  id?: string;
  documentType: DocumentType;
  templateId: string;
  structureId: string;
  generationType?: 'template' | 'editor';
  /** Zones de signature SES préconfigurées (client/étudiant + structure). */
  signaturePlacements?: TemplateSignaturePlacement[];
  createdAt: Date;
  updatedAt: Date;
}

/** Types de documents MissionDetails pour lesquels on préconfigure les signatures. */
export const SIGNATURE_TEMPLATE_DOCUMENT_TYPES: DocumentType[] = [
  'proposition_commerciale',
  'lettre_mission',
  'avenant',
];

export function counterpartyLabelForDocumentType(documentType: DocumentType): string {
  if (documentType === 'proposition_commerciale') return 'Client';
  return 'Étudiant';
}

export const DOCUMENT_TYPES: { [key in DocumentType]: string } = {
  'proposition_commerciale': 'Proposition Commerciale',
  'lettre_mission': 'Lettre de Mission',
  'note_de_frais': 'Note de Frais',
  facture: 'Facture',
  convention_entreprise: 'Convention entreprise',
  convention_etudiant: 'Convention étudiante',
  avenant: 'Avenant',
  recapitulatif_mission: 'Récapitulatif Mission',
  convention_etude: 'Convention Étude',
  proces_verbal_recette: 'PV Recette',
  rapport_pedagogique: 'Rapport Pédagogique',
  avenant_convention: 'Avenant Convention',
  convention_consultant: 'Convention Consultant',
};

export interface TemplateVariable {
  id: string;
  name: string;
  description: string;
  type: 'text' | 'number' | 'date' | 'list' | 'raw';
  variableId?: string;
  rawText?: string;
  fieldId?: string;
  position: {
    x: number;
    y: number;
    page: number;
  };
  fontSize: number;
  fontFamily?: string;
  dataSource?: 'missions' | 'users' | 'companies' | 'contacts' | 'expenseNotes' | 'workingHours' | 'amendments' | 'structures';
  width: number;
  height: number;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  verticalAlign: 'top' | 'middle' | 'bottom';
  isBold?: boolean;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  pdfUrl: string;
  fileName: string;
  variables: TemplateVariable[];
  /** @deprecated Préférer templateAssignments.signaturePlacements (par structure). */
  signaturePlacements?: TemplateSignaturePlacement[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/** Nature de la valeur pour détection manquante / fallback PDF. */
export type TagValueKind = 'text' | 'number' | 'hours' | 'money' | 'date';

export interface TagMapping {
  tag: string;
  variableId: string;
  description: string;
  example: string;
  /** Autres variableId qui résolvent vers ce même tag. */
  aliases?: string[];
  /** Override du kind (sinon dérivé du nom de balise). */
  valueKind?: TagValueKind;
  /** Sources Firestore typiques pour désambiguïser variableId. */
  dataSources?: Array<
    'missions' | 'users' | 'companies' | 'contacts' | 'expenseNotes' | 'workingHours' | 'amendments' | 'structures'
  >;
}
