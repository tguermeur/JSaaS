export type EtudeEtape =
  | 'prospection'
  | 'proposition_commerciale'
  | 'negociation'
  | 'convention_signee'
  | 'recrutement_consultants'
  | 'realisation'
  | 'livraison'
  | 'facturation'
  | 'audit_qualite'
  | 'cloture';

export const ETUDE_ETAPE_LABELS: Record<EtudeEtape, string> = {
  prospection: 'Prospection',
  proposition_commerciale: 'Proposition commerciale',
  negociation: 'Négociation',
  convention_signee: 'Convention signée',
  recrutement_consultants: 'Recrutement consultants',
  realisation: 'Réalisation (phases)',
  livraison: 'Livraison / PV Recette',
  facturation: 'Facturation',
  audit_qualite: 'Audit qualité',
  cloture: 'Clôture',
};

export const ETUDE_ETAPE_ORDER: EtudeEtape[] = [
  'prospection',
  'proposition_commerciale',
  'negociation',
  'convention_signee',
  'recrutement_consultants',
  'realisation',
  'livraison',
  'facturation',
  'audit_qualite',
  'cloture',
];

export const ETUDE_ETAPE_COLORS: Record<EtudeEtape, string> = {
  prospection: '#9E9E9E',
  proposition_commerciale: '#FF9800',
  negociation: '#2196F3',
  convention_signee: '#4CAF50',
  recrutement_consultants: '#9C27B0',
  realisation: '#3F51B5',
  livraison: '#00BCD4',
  facturation: '#FF5722',
  audit_qualite: '#795548',
  cloture: '#607D8B',
};

// Ancien système de statuts (rétrocompatibilité)
export type EtudeStatus = 'Négociation' | 'Recrutement' | 'Date de mission' | 'Facturation' | 'Audit' | 'Archivé';

export const ETUDE_STATUS_OPTIONS: EtudeStatus[] = ['Négociation', 'Recrutement', 'Date de mission', 'Facturation', 'Audit', 'Archivé'];

/** Mapping ancien statut → nouvelle étape (migration) */
export function statusToEtape(status: EtudeStatus): EtudeEtape {
  switch (status) {
    case 'Négociation': return 'negociation';
    case 'Recrutement': return 'recrutement_consultants';
    case 'Date de mission': return 'realisation';
    case 'Facturation': return 'facturation';
    case 'Audit': return 'audit_qualite';
    case 'Archivé': return 'cloture';
    default: return 'prospection';
  }
}

export interface EtudePermissions {
  viewers: string[];
  editors: string[];
}

export interface BudgetItem {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  budget: number;
  color: string;
  status: 'Planifié' | 'En cours' | 'Terminé' | 'Annulé';
  createdAt: Date;
  createdBy: string;
  etudeId: string;
  jehCount?: number;
  jehRate?: number;
  hoursCount?: number;
  hourlyRate?: number;
  studentsToRecruit?: number;
  linkedBudgetItems?: string[];
  recruitmentStatus?: 'Non démarré' | 'En cours' | 'Terminé';
  recruitedStudents?: number;
  // Facturation par phase
  invoiceStatus?: 'a_facturer' | 'facturee' | 'payee';
  invoiceDate?: string;
  invoiceNumber?: string;
}

export interface ConsultantJehAllocation {
  userId: string;
  displayName: string;
  photoURL?: string;
  jehAllocated: number;
  jehConsumed: number;
  gratificationNette?: number;
  gratificationBrute?: number;
  budgetItemId?: string; // Phase associée
}

export interface Avenant {
  id: string;
  etudeId: string;
  numero: number;
  raison: string;
  description?: string;
  status: 'brouillon' | 'en_validation' | 'signe' | 'refuse';
  // Modifications apportées
  modifications: {
    budget?: { avant: number; apres: number };
    duree?: { dateFinAvant: string; dateFinApres: string };
    phases?: { ajoutees?: string[]; modifiees?: string[]; supprimees?: string[] };
    jehTotal?: { avant: number; apres: number };
    consultants?: { avant: number; apres: number };
  };
  createdAt: Date;
  createdBy: string;
  createdByName: string;
  signedAt?: Date;
  signedBy?: string;
  documentUrl?: string;
}

export interface QualityChecklist {
  conventionSignee: boolean;
  assuranceVerifiee: boolean;
  pvRecetteObtenu: boolean;
  satisfactionEnvoyee: boolean;
  bvEmis: boolean;
  facturePayee: boolean;
  rapportPedagogiqueRedige: boolean;
  [key: string]: boolean;
}

export interface SatisfactionSurvey {
  id: string;
  etudeId: string;
  companyId: string;
  qualiteLivrable: number; // 1-5
  respectDelais: number; // 1-5
  communication: number; // 1-5
  satisfactionGlobale: number; // 1-5
  commentaire?: string;
  recommandation: boolean;
  submittedAt: Date;
  submittedBy?: string;
}

export interface Etude {
  id: string;
  numeroEtude: string;
  structureId: string;
  companyId?: string;
  company: string;
  companyLogo?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  consultantCount?: number;
  hours?: number | null;
  jeh?: number | null;
  status: string; // EtudeStatus (rétrocompatibilité)
  etape: EtudeEtape;
  chargeId: string;
  chargeIds?: string[];
  chargeName: string;
  chargePhotoURL?: string | null;
  description?: string | null;
  prixHT?: number;
  missionTypeId?: string | null;
  missionTypeName?: string | null;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: Date;
  isPublic: boolean;
  isArchived?: boolean;
  pricingType?: 'jeh' | 'hourly';
  mandat?: string;
  permissions?: EtudePermissions;
  contactId?: string;
  // Champs JE enrichis
  consultantAllocations?: ConsultantJehAllocation[];
  avenants?: Avenant[];
  qualityChecklist?: QualityChecklist;
  satisfactionScore?: number;
  [key: string]: any;
}
