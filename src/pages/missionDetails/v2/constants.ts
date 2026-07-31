import type { MissionEtape } from '../../../types/mission';
import type { DocumentType } from '../../../types/templates';

export const MISSION_STAGES: MissionEtape[] = [
  'Négociation',
  'Recrutement',
  'Date de mission',
  'Facturation',
  'Audit',
];

export const STATUS_PILL: Record<
  string,
  { background: string; color: string; dot: string }
> = {
  Négociation: { background: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
  Recrutement: { background: '#dbeafe', color: '#1e3a8a', dot: '#3b82f6' },
  'Date de mission': { background: '#d1fae5', color: '#065f46', dot: '#10b981' },
  Facturation: { background: '#f3e8ff', color: '#6b21a8', dot: '#7c3aed' },
  Audit: { background: '#fce7f3', color: '#9d174d', dot: '#ec4899' },
};

export const CAND_PILL: Record<string, { background: string; color: string }> = {
  'En attente': { background: '#fef3c7', color: '#92400e' },
  Acceptée: { background: '#d1fae5', color: '#065f46' },
  Refusée: { background: '#fee2e2', color: '#991b1b' },
};

export const TEMPLATE_ACTIONS: Array<{
  id: DocumentType;
  label: string;
  color: string;
  hint: string;
}> = [
  { id: 'proposition_commerciale', label: 'Proposition commerciale', color: '#173B6C', hint: 'Devis détaillé · 2 pages' },
  { id: 'lettre_mission', label: 'Lettre de mission', color: '#3b82f6', hint: 'LM étudiant · 1 page' },
  { id: 'convention_entreprise', label: 'Convention de mission', color: '#21BDA3', hint: 'Contrat tripartite · 4 pages' },
  { id: 'facture', label: 'Facture', color: '#ec4899', hint: 'Émission TTC · 1 page' },
  { id: 'avenant', label: 'Avenant', color: '#f59e0b', hint: 'Modification de mission' },
];

export const DOC_CATEGORY_CHIPS = [
  { id: 'contrats', label: 'Contrats' },
  { id: 'facturation', label: 'Facturation' },
  { id: 'autres', label: 'Autres' },
] as const;

export const MD_FIELD_LABEL: Record<string, string> = {
  numeroMission: 'Numéro de mission',
  missionTypeId: 'Type de mission',
  company: 'Entreprise',
  companyId: 'Entreprise',
  contact: 'Contact',
  contactId: 'Contact',
  chargeId: 'CDM',
  chargeName: 'CDM',
  description: 'Description',
  location: 'Lieu',
  startDate: 'Date de début',
  endDate: 'Date de fin',
  studentCount: "Nombre d'étudiants",
  hoursPerStudent: 'Heures / étudiant',
  hours: 'Total heures',
  salary: 'Salaire étudiant',
  priceHT: 'Prix HT',
  expenses: 'Dépenses',
  requiresCV: 'CV requis',
  requiresMotivation: 'Lettre de motivation',
  isPublished: 'Publication',
  isArchived: 'Archivage',
};
