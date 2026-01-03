export type DocumentType = 
  | 'proposition_commerciale'
  | 'lettre_mission'
  | 'note_de_frais'
  | 'facture'
  | 'convention_entreprise'
  | 'convention_etudiant'
  | 'avenant';

export interface TemplateAssignment {
  id?: string;
  documentType: DocumentType;
  templateId: string;
  structureId: string;
  generationType?: 'template' | 'editor';
  createdAt: Date;
  updatedAt: Date;
}

export const DOCUMENT_TYPES: { [key in DocumentType]: string } = {
  'proposition_commerciale': 'Proposition Commerciale',
  'lettre_mission': 'Lettre de Mission',
  'note_de_frais': 'Note de Frais',
  facture: 'Facture',
  convention_entreprise: 'Convention entreprise',
  convention_etudiant: 'Convention étudiante',
  avenant: 'Avenant'
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
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface TagMapping {
  tag: string;
  variableId: string;
  description: string;
  example: string;
}

export const VARIABLE_TAGS: TagMapping[] = [
  // Tags pour les missions
  { tag: '<mission_numero>', variableId: 'numeroMission', description: 'Numéro de mission', example: 'M2024-001' },
  { tag: '<mission_cdm>', variableId: 'chargeName', description: 'Chef de mission', example: 'Jean Dupont' },
  { tag: '<mission_date>', variableId: 'startDate', description: 'Date de mission', example: '01/01/2024' },
  { tag: '<mission_lieu>', variableId: 'location', description: 'Lieu', example: 'Paris' },
  { tag: '<mission_entreprise>', variableId: 'company', description: 'Entreprise', example: 'Entreprise SA' },
  { tag: '<mission_prix>', variableId: 'priceHT', description: 'Prix HT', example: '1000€' },
  { tag: '<mission_description>', variableId: 'description', description: 'Description de la mission', example: 'Description détaillée...' },
  { tag: '<mission_titre>', variableId: 'title', description: 'Titre de la mission', example: 'Titre de la mission' },
  { tag: '<mission_heures>', variableId: 'hours', description: 'Nombre d\'heures', example: '40' },
  { tag: '<mission_statut>', variableId: 'status', description: 'Statut de la mission', example: 'En cours' },
  { tag: '<mission_heures_par_etudiant>', variableId: 'hoursPerStudent', description: 'Heures par étudiant', example: '10' },
  { tag: '<mission_nb_etudiants>', variableId: 'studentCount', description: 'Nombre d\'étudiants', example: '4' },
  
  // Tags pour les utilisateurs
  { tag: '<user_nom>', variableId: 'lastName', description: 'Nom utilisateur', example: 'Dupont' },
  { tag: '<user_prenom>', variableId: 'firstName', description: 'Prénom utilisateur', example: 'Jean' },
  { tag: '<user_email>', variableId: 'email', description: 'Email', example: 'jean.dupont@email.com' },
  { tag: '<user_ecole>', variableId: 'ecole', description: 'École', example: 'École ABC' },
  { tag: '<user_telephone>', variableId: 'phone', description: 'Téléphone', example: '06 12 34 56 78' },
  { tag: '<user_adresse>', variableId: 'address', description: 'Adresse', example: '123 rue Example' },
  { tag: '<user_ville>', variableId: 'city', description: 'Ville', example: 'Paris' },
  { tag: '<user_formation>', variableId: 'formation', description: 'Formation', example: 'Informatique' },
  { tag: '<user_specialite>', variableId: 'speciality', description: 'Spécialité', example: 'Développement Web' },
  { tag: '<user_niveau_etude>', variableId: 'studyLevel', description: 'Niveau d\'études', example: 'Master' },
  
  // Tags pour les entreprises
  { tag: '<entreprise_nom>', variableId: 'name', description: 'Nom de l\'entreprise', example: 'Entreprise SA' },
  { tag: '<entreprise_siren>', variableId: 'siren', description: 'Numéro SIREN', example: '123456789' },
  { tag: '<entreprise_adresse>', variableId: 'address', description: 'Adresse', example: '123 rue Example' },
  { tag: '<entreprise_ville>', variableId: 'city', description: 'Ville', example: 'Paris' },
  { tag: '<entreprise_pays>', variableId: 'country', description: 'Pays', example: 'France' },
  { tag: '<entreprise_telephone>', variableId: 'phone', description: 'Téléphone', example: '01 23 45 67 89' },
  { tag: '<entreprise_email>', variableId: 'email', description: 'Email', example: 'contact@entreprise.fr' },
  { tag: '<entreprise_site_web>', variableId: 'website', description: 'Site web', example: 'www.entreprise.fr' },
  { tag: '<entreprise_description>', variableId: 'description', description: 'Description', example: 'Description de l\'entreprise' },

  // Tags pour les heures de travail
  { tag: '<workinghours_date_debut>', variableId: 'workingHoursDateDebut', description: 'Date de début des heures de travail', example: '01/01/2024' },
  { tag: '<workinghours_heure_debut>', variableId: 'workingHoursHeureDebut', description: 'Heure de début des heures de travail', example: '09:00' },
  { tag: '<workinghours_date_fin>', variableId: 'workingHoursDateFin', description: 'Date de fin des heures de travail', example: '01/01/2024' },
  { tag: '<workinghours_heure_fin>', variableId: 'workingHoursHeureFin', description: 'Heure de fin des heures de travail', example: '17:00' },
  { tag: '<workinghours_pauses>', variableId: 'workingHoursPauses', description: 'Pauses pendant les heures de travail', example: '12:00-13:00' },
  { tag: '<workinghours_total>', variableId: 'workingHoursTotal', description: 'Total des heures de travail', example: '8.00' },
  { tag: '<workinghours_creation>', variableId: 'workingHoursCreation', description: 'Date de création des heures de travail', example: '01/01/2024' },
  { tag: '<workinghours_maj>', variableId: 'workingHoursMaj', description: 'Date de mise à jour des heures de travail', example: '01/01/2024' }
]; 