import type { TagMapping, TagValueKind } from '../types/templates';

export type { TagMapping, TagValueKind };

/**
 * Liste canonique des balises PDF (templates, génération de documents).
 * Déplacée ici pour permettre le Fast Refresh sur TemplatesPDF.tsx.
 */
export const VARIABLE_TAGS: TagMapping[] = [
  // Tags pour les missions
  { tag: '<mission_numero>', variableId: 'numeroMission', description: 'Numéro de mission', example: 'M2024-001' },
  { tag: '<mission_cdm>', variableId: 'chargeName', description: 'Prénom Nom CDM', example: 'Jean Dupont' },
  { tag: '<mission_cdm_email>', variableId: 'charge_email', description: 'Email du CDM', example: 'cdm@ecole.fr' },
  { tag: '<mission_cdm_telephone>', variableId: 'charge_phone', description: 'Téléphone du CDM', example: '06 12 34 56 78' },
  { tag: '<mission_date_debut>', variableId: 'missionDateDebut', description: 'Date de début (date seule)', example: '01/01/2024' },
  { tag: '<mission_date_heure_debut>', variableId: 'missionDateHeureDebut', description: 'Date et heure de début', example: '01/01/2024 à 09:00' },
  { tag: '<mission_date_fin>', variableId: 'missionDateFin', description: 'Date de fin (date seule)', example: '31/01/2024' },
  { tag: '<mission_date_heure_fin>', variableId: 'missionDateHeureFin', description: 'Date et heure de fin', example: '31/01/2024 à 17:00' },
  { tag: '<mission_lieu>', variableId: 'location', description: 'Lieu de la mission', example: 'Paris' },
  { tag: '<mission_entreprise>', variableId: 'company', description: 'Nom de l\'entreprise', example: 'Entreprise SA' },
  { tag: '<mission_type>', variableId: 'missionType', description: 'Type de mission', example: 'Consulting' },
  { tag: '<mission_date_generation>', variableId: 'generationDate', description: 'Date de génération du document', example: '01/01/2024' },
  { tag: '<mission_date_generation_plus_1_an>', variableId: 'generationDatePlusOneYear', description: 'Date de génération + 1 an (365 jours)', example: '01/01/2025' },
  { tag: '<mission_prix>', variableId: 'priceHT', description: 'Prix HT', example: '1000€', valueKind: 'money', dataSources: ['missions'] },
  { tag: '<mission_prix_horaire_ht>', variableId: 'priceHT', description: 'Prix horaire HT', example: '25.00', valueKind: 'money', dataSources: ['missions'] },
  { tag: '<mission_prix_total_heures_ht>', variableId: 'totalHoursHT', description: 'Prix total des heures travaillées HT (prix horaire × nombre d\'heures)', example: '1000.00', valueKind: 'money' },
  { tag: '<mission_description>', variableId: 'missionDetailsDescription', description: 'Description saisie sur la fiche mission (champ description)', example: 'Mission pour le client X...', aliases: ['missionDescription', 'description'], dataSources: ['missions'] },
  { tag: '<mission_type_description>', variableId: 'missionTypeDescription', description: 'Description du type de mission lié (missionTypes.missionDescription)', example: 'Description du type Consulting...' },
  { tag: '<mission_titre>', variableId: 'title', description: 'Titre', example: 'Titre de la mission' },
  { tag: '<mission_heures>', variableId: 'hours', description: 'Nombre d\'heures', example: '40', valueKind: 'hours' },
  { tag: '<mission_nb_etudiants>', variableId: 'studentCount', description: 'Nombre d\'étudiants', example: '4', valueKind: 'number' },
  { tag: '<total_ttc>', variableId: 'totalTTC', description: 'Total TTC de la mission', example: '1200.00', valueKind: 'money' },
  { tag: '<tva>', variableId: 'tva', description: 'Montant de la TVA', example: '200.00', valueKind: 'money' },
  { tag: '<course_application>', variableId: 'courseApplication', description: 'Application du cours (type de mission)', example: 'Gestion des papiers...' },
  { tag: '<mission_learning>', variableId: 'missionLearning', description: 'Objectifs d\'apprentissage (type de mission)', example: 'Compétences acquises...' },
  { tag: '<student_profile>', variableId: 'studentProfile', description: 'Profil étudiant recherché (type de mission)', example: 'Étudiant en M1...' },

  // Tags pour les dépenses (jusqu'à 4 dépenses)
  { tag: '<depense1_nom>', variableId: 'nomdepense1', description: 'Nom de la dépense 1', example: 'Frais de déplacement' },
  { tag: '<depense1_tva>', variableId: 'tvadepense1', description: 'TVA de la dépense 1 (%)', example: '20' },
  { tag: '<depense1_prix>', variableId: 'totaldepense1', description: 'Prix HT de la dépense 1', example: '150.00' },
  { tag: '<depense2_nom>', variableId: 'nomdepense2', description: 'Nom de la dépense 2', example: 'Matériel' },
  { tag: '<depense2_tva>', variableId: 'tvadepense2', description: 'TVA de la dépense 2 (%)', example: '20' },
  { tag: '<depense2_prix>', variableId: 'totaldepense2', description: 'Prix HT de la dépense 2', example: '200.00' },
  { tag: '<depense3_nom>', variableId: 'nomdepense3', description: 'Nom de la dépense 3', example: 'Formation' },
  { tag: '<depense3_tva>', variableId: 'tvadepense3', description: 'TVA de la dépense 3 (%)', example: '10' },
  { tag: '<depense3_prix>', variableId: 'totaldepense3', description: 'Prix HT de la dépense 3', example: '300.00' },
  { tag: '<depense4_nom>', variableId: 'nomdepense4', description: 'Nom de la dépense 4', example: 'Autre frais' },
  { tag: '<depense4_tva>', variableId: 'tvadepense4', description: 'TVA de la dépense 4 (%)', example: '20' },
  { tag: '<depense4_prix>', variableId: 'totaldepense4', description: 'Prix HT de la dépense 4', example: '100.00' },

  // Tags pour les utilisateurs
  { tag: '<user_nom>', variableId: 'lastName', description: 'Nom de famille', example: 'Dupont' },
  { tag: '<user_prenom>', variableId: 'firstName', description: 'Prénom', example: 'Jean' },
  { tag: '<user_email>', variableId: 'email', description: 'Adresse email', example: 'jean.dupont@email.com' },
  { tag: '<user_ecole>', variableId: 'ecole', description: 'École', example: 'École ABC' },
  { tag: '<user_telephone>', variableId: 'phone', description: 'Téléphone', example: '06 12 34 56 78' },
  { tag: '<user_adresse>', variableId: 'address', description: 'Adresse', example: '123 rue Example' },
  { tag: '<user_code_postal>', variableId: 'postalCode', description: 'Code postal (adresse)', example: '75001' },
  { tag: '<user_ville>', variableId: 'city', description: 'Ville', example: 'Paris' },
  { tag: '<user_code_postal_naissance>', variableId: 'birthPostalCode', description: 'Code postal de naissance', example: '69001' },
  { tag: '<user_formation>', variableId: 'formation', description: 'Formation', example: 'Informatique' },
  { tag: '<user_programme>', variableId: 'program', description: 'Programme', example: 'PGE' },
  { tag: '<user_campus>', variableId: 'campus', description: 'Campus', example: 'Nantes' },
  { tag: '<user_annee_diplome>', variableId: 'graduationYear', description: 'Année de diplômation', example: '2024' },
  { tag: '<user_nationalite>', variableId: 'nationality', description: 'Nationalité', example: 'Française' },
  { tag: '<user_genre>', variableId: 'gender', description: 'Genre', example: 'M' },
  { tag: '<user_lieu_naissance>', variableId: 'birthPlace', description: 'Lieu de naissance', example: 'Paris' },
  { tag: '<user_date_naissance>', variableId: 'birthDate', description: 'Date de naissance', example: '01/01/2000' },
  { tag: '<user_numero_etudiant>', variableId: 'studentId', description: 'Numéro étudiant', example: '183934' },
  { tag: '<user_numero_securite_sociale>', variableId: 'socialSecurityNumber', description: 'Numéro de sécurité sociale', example: '1 99 12 75 001 001 23' },

  // Tags pour les entreprises
  { tag: '<entreprise_nom>', variableId: 'name', description: 'Nom de l\'entreprise', example: 'Entreprise SA' },
  { tag: '<entreprise_siren>', variableId: 'siren', description: 'Numéro SIREN', example: '123456789' },
  { tag: '<entreprise_nsiret>', variableId: 'nSiret', description: 'Numéro nSiret', example: '12345678901234' },
  { tag: '<entreprise_adresse>', variableId: 'address', description: 'Adresse', example: '123 rue Example' },
  { tag: '<entreprise_ville>', variableId: 'city', description: 'Ville', example: 'Paris' },
  { tag: '<entreprise_pays>', variableId: 'country', description: 'Pays', example: 'France' },
  { tag: '<entreprise_telephone>', variableId: 'phone', description: 'Téléphone', example: '01 23 45 67 89' },
  { tag: '<entreprise_email>', variableId: 'email', description: 'Email', example: 'contact@entreprise.fr' },
  { tag: '<entreprise_site_web>', variableId: 'website', description: 'Site web', example: 'www.entreprise.fr' },
  { tag: '<entreprise_description>', variableId: 'description', description: 'Description', example: 'Description de l\'entreprise' },

  // Tags pour les notes de frais
  { tag: '<note_frais_montant>', variableId: 'amount', description: 'Montant de la note de frais', example: '150€' },
  { tag: '<note_frais_description>', variableId: 'description', description: 'Description de la note de frais', example: 'Frais de transport' },
  { tag: '<note_frais_date>', variableId: 'date', description: 'Date de la note de frais', example: '01/01/2024' },
  { tag: '<note_frais_statut>', variableId: 'status', description: 'Statut de la note de frais', example: 'Validée' },
  { tag: '<note_frais_creation>', variableId: 'createdAt', description: 'Date de création', example: '01/01/2024' },
  { tag: '<note_frais_maj>', variableId: 'updatedAt', description: 'Date de mise à jour', example: '02/01/2024' },

  // Tags pour les heures de travail
  { tag: '<workingHoursDateDebut>', variableId: 'startDate', description: 'Date de début des heures travaillées', example: '01/01/2024' },
  { tag: '<workingHoursHeureDebut>', variableId: 'startTime', description: 'Heure de début', example: '09:00' },
  { tag: '<workingHoursDateFin>', variableId: 'endDate', description: 'Date de fin des heures travaillées', example: '01/01/2024' },
  { tag: '<workingHoursHeureFin>', variableId: 'endTime', description: 'Heure de fin', example: '17:00' },
  { tag: '<workingHoursPauses>', variableId: 'breaks', description: 'Liste des pauses', example: '12:00-13:00' },
  { tag: '<workingHoursTotal>', variableId: 'totalHours', description: 'Total des heures travaillées', example: '7.5' },
  { tag: '<workingHoursCreation>', variableId: 'createdAt', description: 'Date de création', example: '01/01/2024' },
  { tag: '<workingHoursMaj>', variableId: 'updatedAt', description: 'Date de mise à jour', example: '02/01/2024' },
  { tag: '<heures_detaillees>', variableId: 'heuresDetaillees', description: 'Heures détaillées (tous les jours avec créneaux et pauses)', example: '28/01/2026 de 16h à 18h, 04/02/2026 de 16h à 18h' },

  // Tags pour les gratifications et total à payer (par étudiant / candidature)
  { tag: '<gratification_nette>', variableId: 'gratificationNet', description: 'Gratification nette (€) pour l\'étudiant', example: '12,50', valueKind: 'money' },
  { tag: '<gratification_brute>', variableId: 'gratificationBrute', description: 'Gratification brute (€) pour l\'étudiant', example: '15,00', valueKind: 'money' },
  { tag: '<total_a_payer>', variableId: 'totalAPayer', description: 'Total à payer (heures × gratification nette, €)', example: '100,00', valueKind: 'money' },

  // Tags pour les avenants
  { tag: '<amendment_planned_start_date>', variableId: 'plannedStartDate', description: 'Date de début prévue', example: '01/01/2024' },
  { tag: '<amendment_planned_end_date>', variableId: 'plannedEndDate', description: 'Date de fin prévue', example: '31/01/2024' },
  { tag: '<amendment_actual_start_date>', variableId: 'actualStartDate', description: 'Date de début réelle', example: '01/01/2024' },
  { tag: '<amendment_actual_end_date>', variableId: 'actualEndDate', description: 'Date de fin réelle', example: '31/01/2024' },
  { tag: '<amendment_planned_hours>', variableId: 'plannedHours', description: 'Heures prévues (lettre de mission)', example: '40', valueKind: 'hours' },
  { tag: '<amendment_new_hours>', variableId: 'amendmentNewHours', description: 'Total des heures finalement travaillées (compteur)', example: '130', valueKind: 'hours' },
  { tag: '<amendment_actual_hours>', variableId: 'actualHours', description: 'Total des heures finalement travaillées (alias de amendment_new_hours)', example: '130', valueKind: 'hours', aliases: ['amendment_actual_hours'] },
  { tag: '<heures_finalement_travaillees>', variableId: 'heuresFinalementTravaillees', description: 'Dates et horaires détaillés des heures travaillées (créneaux saisis)', example: '28/01/2026 de 16h à 18h' },
  { tag: '<amendment_reason>', variableId: 'reason', description: 'Motif de l\'avenant', example: 'Modification des dates' },
  { tag: '<amendment_target>', variableId: 'amendmentTarget', description: 'Personne concernée par l\'avenant', example: 'Jean Dupont (contact entreprise)' },
  { tag: '<amendment_old_hours>', variableId: 'amendmentOldHours', description: 'Ancien montant d\'heures', example: '20' },
  { tag: '<amendment_old_price>', variableId: 'amendmentOldPrice', description: 'Ancien prix', example: '1500' },
  { tag: '<amendment_new_price>', variableId: 'amendmentNewPrice', description: 'Nouveau prix', example: '2100' },
  { tag: '<amendment_created_at>', variableId: 'createdAt', description: 'Date de création', example: '01/01/2024' },
  { tag: '<amendment_created_by>', variableId: 'createdByName', description: 'Créé par', example: 'Jean Dupont' },

  // Tags pour les contacts
  { tag: '<contact_nom_complet>', variableId: 'contact_nom_complet', description: 'Prénom et Nom du contact (alias)', example: 'Jean Dupont' },
  { tag: '<contact_fullName>', variableId: 'contact_fullName', description: 'Prénom et Nom du contact', example: 'Jean Dupont' },
  { tag: '<contact_firstName>', variableId: 'contact_firstName', description: 'Prénom du contact', example: 'Jean' },
  { tag: '<contact_lastName>', variableId: 'contact_lastName', description: 'Nom du contact', example: 'Dupont' },
  { tag: '<contact_email>', variableId: 'contact_email', description: 'Email du contact', example: 'jean.dupont@email.com' },
  { tag: '<contact_phone>', variableId: 'contact_phone', description: 'Téléphone du contact', example: '06 12 34 56 78' },
  { tag: '<contact_position>', variableId: 'contact_position', description: 'Poste du contact', example: 'Chef de projet' },
  { tag: '<contact_linkedin>', variableId: 'contact_linkedin', description: 'URL du profil LinkedIn du contact', example: 'https://www.linkedin.com/in/jean-dupont' },

  // Tags pour la structure
  { tag: '<structure_nom>', variableId: 'structure_name', description: 'Nom de la structure', example: 'Ma Structure' },
  { tag: '<structure_siret>', variableId: 'structure_siret', description: 'Numéro SIRET de la structure', example: '12345678901234' },
  { tag: '<structure_adresse>', variableId: 'structure_address', description: 'Adresse de la structure', example: '123 rue Example' },
  { tag: '<structure_ville>', variableId: 'structure_city', description: 'Ville de la structure', example: 'Paris' },
  { tag: '<structure_code_postal>', variableId: 'structure_postalCode', description: 'Code postal de la structure', example: '75000' },
  { tag: '<structure_pays>', variableId: 'structure_country', description: 'Pays de la structure', example: 'France' },
  { tag: '<structure_telephone>', variableId: 'structure_phone', description: 'Téléphone de la structure', example: '01 23 45 67 89' },
  { tag: '<structure_email>', variableId: 'structure_email', description: 'Email de la structure', example: 'contact@structure.fr' },
  { tag: '<structure_site_web>', variableId: 'structure_website', description: 'Site web de la structure', example: 'www.structure.fr' },
  { tag: '<structure_president_nom_complet>', variableId: 'structure_president_fullName', description: 'Prénom et Nom du président du mandat le plus récent', example: 'Jean Dupont' },

  // Tags spécifiques Junior-Entreprises (études, JEH, consultants, BV)
  { tag: '<etude_numero>', variableId: 'numeroEtude', description: 'Numéro de l\'étude', example: 'E2024-001' },
  { tag: '<etude_jeh_total>', variableId: 'etudeJehTotal', description: 'Total des JEH de l\'étude', example: '120' },
  { tag: '<etude_duree_semaines>', variableId: 'etudeDureeSemaines', description: 'Durée de l\'étude en semaines', example: '12' },
  { tag: '<etude_nb_consultants>', variableId: 'etudeNbConsultants', description: 'Nombre de consultants sur l\'étude', example: '3' },
  { tag: '<etude_nb_phases>', variableId: 'etudeNbPhases', description: 'Nombre de phases/postes de budget', example: '4' },
  { tag: '<etude_ca_total>', variableId: 'etudeCaTotal', description: 'Chiffre d\'affaires total HT de l\'étude', example: '5000€' },
  { tag: '<etude_etape>', variableId: 'etudeEtape', description: 'Étape actuelle de l\'étude', example: 'Réalisation (phases)' },
  { tag: '<phase_liste>', variableId: 'phaseListe', description: 'Liste des phases avec JEH et budget', example: 'Phase 1: Analyse (20 JEH, 1600€)' },
  { tag: '<phase_statut>', variableId: 'phaseStatut', description: 'Statut des phases (résumé)', example: '2/4 terminées' },
  { tag: '<consultant_liste>', variableId: 'consultantListe', description: 'Liste des consultants de l\'étude', example: 'Jean Dupont (40 JEH), Marie Martin (30 JEH)' },

  // Tags pour les Bulletins de Versement (BV)
  { tag: '<bv_consultant_nom>', variableId: 'bvConsultantNom', description: 'Nom complet du consultant (BV)', example: 'Jean Dupont' },
  { tag: '<bv_consultant_email>', variableId: 'bvConsultantEmail', description: 'Email du consultant (BV)', example: 'jean.dupont@ecole.fr' },
  { tag: '<bv_consultant_adresse>', variableId: 'bvConsultantAdresse', description: 'Adresse du consultant (BV)', example: '123 rue Example, 75001 Paris' },
  { tag: '<bv_consultant_secu>', variableId: 'bvConsultantSecu', description: 'N° sécurité sociale du consultant', example: '1 99 12 75 001 001 23' },
  { tag: '<bv_jeh_alloues>', variableId: 'bvJehAlloues', description: 'Nombre de JEH alloués au consultant', example: '40' },
  { tag: '<bv_jeh_consommes>', variableId: 'bvJehConsommes', description: 'Nombre de JEH consommés par le consultant', example: '35' },
  { tag: '<bv_gratification_nette>', variableId: 'bvGratificationNette', description: 'Gratification nette du consultant', example: '500€' },
  { tag: '<bv_gratification_brute>', variableId: 'bvGratificationBrute', description: 'Gratification brute du consultant', example: '600€' },
  { tag: '<bv_phase>', variableId: 'bvPhase', description: 'Phase associée au BV', example: 'Phase 2: Développement' },

  // Tags pour les avenants d'étude
  { tag: '<avenant_numero>', variableId: 'avenantNumero', description: 'Numéro de l\'avenant', example: '1' },
  { tag: '<avenant_raison>', variableId: 'avenantRaison', description: 'Raison de l\'avenant', example: 'Ajout d\'une phase supplémentaire' },
  { tag: '<avenant_budget_avant>', variableId: 'avenantBudgetAvant', description: 'Budget avant avenant', example: '5000€' },
  { tag: '<avenant_budget_apres>', variableId: 'avenantBudgetApres', description: 'Budget après avenant', example: '7000€' },
  { tag: '<avenant_jeh_avant>', variableId: 'avenantJehAvant', description: 'JEH avant avenant', example: '80' },
  { tag: '<avenant_jeh_apres>', variableId: 'avenantJehApres', description: 'JEH après avenant', example: '120' },
];

/** Données d'un type de mission (collection missionTypes). */
export interface MissionTypeRecord {
  id: string;
  title?: string;
  missionDescription?: string;
  studentProfile?: string;
  courseApplication?: string;
  missionLearning?: string;
}

/** Résout le document missionTypes à partir de mission.missionTypeId. */
export function getMissionTypeData(
  missionData: { missionTypeId?: string } | null | undefined,
  missionTypes: MissionTypeRecord[]
): MissionTypeRecord | null {
  const typeId = missionData?.missionTypeId;
  if (!typeId) return null;
  return missionTypes.find((t) => t.id === typeId) ?? null;
}

/**
 * Champs mission / type de mission (hors logique générique missionData[field]).
 * missionDetailsDescription / missionDescription → missions.description (fiche mission)
 * missionTypeDescription → missionTypes.missionDescription
 */
export function resolveMissionScopedValue(
  variableId: string,
  missionData?: Record<string, unknown> | null,
  missionTypeData?: MissionTypeRecord | null
): string | undefined {
  if (
    variableId === 'missionDetailsDescription' ||
    variableId === 'missionDescription' ||
    variableId === 'description'
  ) {
    const v = missionData?.description;
    return v != null && v !== '' ? String(v) : '';
  }
  if (variableId === 'missionTypeDescription') {
    const v = missionTypeData?.missionDescription;
    return v != null && v !== '' ? String(v) : '';
  }
  if (variableId === 'courseApplication') {
    const v = missionTypeData?.courseApplication;
    return v != null && v !== '' ? String(v) : '';
  }
  if (variableId === 'missionLearning') {
    const v = missionTypeData?.missionLearning;
    return v != null && v !== '' ? String(v) : '';
  }
  if (variableId === 'studentProfile') {
    const v = missionTypeData?.studentProfile;
    return v != null && v !== '' ? String(v) : '';
  }
  if (variableId === 'missionType') {
    const v = missionTypeData?.title;
    return v != null && v !== '' ? String(v) : '';
  }
  return undefined;
}

/** Filtre les balises selon le type de structure (junior = études, jobservice = missions). */
export function getFilteredTags(structureType: 'junior' | 'jobservice' | null): TagMapping[] {
  if (structureType === 'junior') {
    return VARIABLE_TAGS.filter(tag => {
      // Masquer les tags spécifiques aux missions/JS (prix horaire mission, nb étudiants mission)
      if (tag.tag === '<mission_nb_etudiants>') return false;
      if (tag.tag === '<mission_prix_horaire_ht>' || tag.tag === '<mission_prix_total_heures_ht>') return false;
      return true;
    });
  }
  if (structureType === 'jobservice') {
    return VARIABLE_TAGS.filter(tag => {
      // Masquer les tags spécifiques aux études/JE
      if (tag.tag.startsWith('<etude_')) return false;
      if (tag.tag.startsWith('<bv_')) return false;
      if (tag.tag.startsWith('<avenant_numero>') || tag.tag.startsWith('<avenant_raison>') || tag.tag.startsWith('<avenant_budget') || tag.tag.startsWith('<avenant_jeh')) return false;
      if (tag.tag === '<phase_liste>' || tag.tag === '<phase_statut>') return false;
      if (tag.tag === '<consultant_liste>') return false;
      return true;
    });
  }
  return VARIABLE_TAGS;
}

/** Catégorie d'affichage pour une balise PDF (revue avant génération). */
export function getTemplateTagCategory(tagName: string): string {
  const tag = tagName.replace(/^<|>$/g, '');
  if (tag.startsWith('user_') || ['graduationYear', 'gender', 'birthPlace', 'birthDate', 'address', 'nationality', 'socialSecurityNumber', 'phone', 'program'].includes(tag)) {
    return 'Utilisateur';
  }
  if (tag.startsWith('mission_') || ['missionType', 'totalHT', 'totalTTC', 'total_ttc', 'tva', 'generationDate', 'endDate', 'missionDescription', 'missionStartDate', 'missionLearning', 'courseApplication', 'studentProfile', 'mission_gratificationhorraire', 'gratification_nette', 'gratification_brute', 'total_a_payer'].includes(tag)) {
    return 'Mission';
  }
  if (tag.startsWith('contact_')) return 'Contact';
  if (tag.startsWith('structure_')) return 'Structure';
  if (tag.startsWith('entreprise_') || ['siren', 'nSiret', 'companyName'].includes(tag)) return 'Entreprise';
  if (tag.startsWith('charge_')) return 'Chargé de mission';
  if (tag.startsWith('workinghours_') || tag.startsWith('workingHours') || tag.startsWith('heures')) return 'Heures de travail';
  if (tag.startsWith('amendment_') || tag.startsWith('avenant_')) return 'Avenant';
  if (tag.startsWith('depense')) return 'Dépenses';
  if (tag.startsWith('etude_') || tag.startsWith('bv_') || tag.startsWith('phase_') || tag === 'consultant_liste') return 'Étude';
  return 'Autre';
}

/** Libellé et catégorie d'une balise (VARIABLE_TAGS + heuristique). */
export function getTemplateTagMeta(tagName: string): { label: string; category: string } {
  const normalized = tagName.replace(/^<|>$/g, '');
  const found = VARIABLE_TAGS.find((v) => v.tag.replace(/[<>]/g, '') === normalized);
  return {
    label: found?.description ?? normalized,
    category: getTemplateTagCategory(normalized),
  };
}

/** Valeur placeholder renvoyée par replaceTags quand la donnée est absente. */
export function isDocumentPlaceholderValue(value: string): boolean {
  const trimmed = (value || '').trim();
  if (!trimmed) return true;
  return trimmed.startsWith('[') && trimmed.endsWith(']');
}

/** Noms de balises (sans <> ) considérés numériques pour fallback "0". */
const NUMERIC_TAG_NAME_SET = new Set([
  'mission_prix', 'mission_prix_horaire_ht', 'mission_prix_total_heures_ht',
  'mission_heures', 'mission_heures_par_etudiant', 'mission_nb_etudiants',
  'totalHT', 'total_ht', 'totalTTC', 'total_ttc', 'tva',
  'workinghours_total', 'workingHoursTotal',
  'gratification_nette', 'gratification_brute', 'total_a_payer',
  'mission_gratificationhorraire',
  'amendment_new_hours', 'amendmentNewHours', 'amendment_actual_hours', 'actualHours',
  'amendment_planned_hours', 'plannedHours',
  'depense1_tva', 'depense1_prix', 'depense2_tva', 'depense2_prix',
  'depense3_tva', 'depense3_prix', 'depense4_tva', 'depense4_prix',
  'siren', 'nSiret', 'entreprise_siren', 'entreprise_nsiret',
]);

export const NUMERIC_DOC_TAGS: ReadonlySet<string> = NUMERIC_TAG_NAME_SET;

/** Dérive le kind d'une balise (override catalogue ou heuristique). */
export function getTagValueKind(tagOrName: string): TagValueKind {
  const name = tagOrName.replace(/[<>]/g, '');
  const found = VARIABLE_TAGS.find((v) => v.tag.replace(/[<>]/g, '') === name);
  if (found?.valueKind) return found.valueKind;

  if (
    name.includes('prix') ||
    name.includes('price') ||
    name.includes('ttc') ||
    name.includes('total_a_payer') ||
    name.includes('gratification') ||
    name === 'tva' ||
    name === 'totalHT' ||
    name === 'total_ht' ||
    name === 'totalTTC' ||
    name === 'total_ttc'
  ) {
    return 'money';
  }
  if (
    name.includes('heure') ||
    name.includes('hours') ||
    name.includes('Hours') ||
    name.endsWith('_total') && name.toLowerCase().includes('working')
  ) {
    return 'hours';
  }
  if (NUMERIC_TAG_NAME_SET.has(name) || /_tva$|_prix$|nb_etudiants|studentCount/.test(name)) {
    return 'number';
  }
  if (name.includes('date') || name.includes('Date')) return 'date';
  return 'text';
}

export function isNumericDocTag(tagOrName: string): boolean {
  const name = tagOrName.replace(/[<>]/g, '');
  const kind = getTagValueKind(name);
  return kind === 'number' || kind === 'hours' || kind === 'money' || NUMERIC_TAG_NAME_SET.has(name);
}

/** Fallback PDF : "0" pour numérique, "" pour texte. */
export function defaultValueForTag(tagOrName: string): string {
  return isNumericDocTag(tagOrName) ? '0' : '';
}

/**
 * True si la valeur doit être considérée manquante pour la popup.
 * Les numériques à 0 / "0 h" / vide ne bloquent pas.
 */
export function isEmptyForDetection(tagOrName: string, value: string): boolean {
  const trimmed = (value || '').trim();
  if (isDocumentPlaceholderValue(trimmed) || /non disponible/i.test(trimmed)) {
    return !isNumericDocTag(tagOrName);
  }
  if (!trimmed) {
    return !isNumericDocTag(tagOrName);
  }
  if (isNumericDocTag(tagOrName) && (trimmed === '0' || trimmed === '0 h' || /^0(\.0+)?\s*h?$/i.test(trimmed))) {
    return false;
  }
  return false;
}

/**
 * Résout la balise PDF à partir d'un variableId / fieldId de template.
 * Les IDs ambigus (email, phone, address…) sont désambiguïsés via dataSource.
 */
export function resolveTagFromVariableId(
  variableId: string,
  dataSource?: string | null
): string {
  if (!variableId) return '';
  if (variableId.startsWith('<') && variableId.endsWith('>')) return variableId;

  const asExactTag = VARIABLE_TAGS.find((m) => m.tag === `<${variableId}>`);
  if (asExactTag) return asExactTag.tag;

  const matches = VARIABLE_TAGS.filter(
    (m) => m.variableId === variableId || m.aliases?.includes(variableId)
  );
  if (matches.length === 1) return matches[0].tag;

  if (matches.length > 1) {
    const sourcePrefix: Record<string, string[]> = {
      missions: ['<mission_', '<total_', '<tva>', '<course_', '<student_', '<depense'],
      users: ['<user_'],
      companies: ['<entreprise_'],
      contacts: ['<contact_'],
      expenseNotes: ['<note_frais_'],
      workingHours: ['<workingHours', '<heures_', '<workinghours_'],
      amendments: ['<amendment_', '<heures_finalement'],
      structures: ['<structure_'],
    };
    const prefixes = dataSource ? sourcePrefix[dataSource] : undefined;
    if (prefixes) {
      const filtered = matches.filter((m) => prefixes.some((p) => m.tag.startsWith(p)));
      if (filtered.length >= 1) return filtered[0].tag;
    }
    // Prefer dataSources annotation when present
    if (dataSource) {
      const byDs = matches.filter((m) => m.dataSources?.includes(dataSource as never));
      if (byDs.length >= 1) return byDs[0].tag;
    }
    return matches[0].tag;
  }

  // Legacy / mappings hors VARIABLE_TAGS
  const legacy: Record<string, string> = {
    numeroMission: '<mission_numero>',
    chargeName: '<mission_cdm>',
    startDate: dataSource === 'workingHours' ? '<workingHoursDateDebut>' : '<mission_date>',
    location: '<mission_lieu>',
    company: '<mission_entreprise>',
    priceHT: '<mission_prix>',
    missionDetailsDescription: '<mission_description>',
    missionDescription: '<mission_description>',
    missionTypeDescription: '<mission_type_description>',
    description: dataSource === 'companies' ? '<entreprise_description>' : '<mission_description>',
    title: '<mission_titre>',
    hours: '<mission_heures>',
    hoursPerStudent: '<mission_heures_par_etudiant>',
    studentCount: '<mission_nb_etudiants>',
    lastName: '<user_nom>',
    firstName: '<user_prenom>',
    email: dataSource === 'companies' ? '<entreprise_email>' : '<user_email>',
    ecole: '<user_ecole>',
    displayName: '<user_nom_complet>',
    studentId: '<user_numero_etudiant>',
    phone: dataSource === 'companies' ? '<entreprise_telephone>' : '<user_telephone>',
    address: dataSource === 'companies' ? '<entreprise_adresse>' : '<user_adresse>',
    city: dataSource === 'companies' ? '<entreprise_ville>' : '<user_ville>',
    name: '<entreprise_nom>',
    country: '<entreprise_pays>',
    website: '<entreprise_site_web>',
    siren: '<entreprise_siren>',
    nSiret: '<entreprise_nsiret>',
    contact_lastName: '<contact_lastName>',
    contact_firstName: '<contact_firstName>',
    contact_email: '<contact_email>',
    contact_phone: '<contact_phone>',
    contact_position: '<contact_position>',
    contact_linkedin: '<contact_linkedin>',
    contact_fullName: '<contact_fullName>',
    contact_nom: '<contact_nom>',
    contact_prenom: '<contact_prenom>',
    contact_telephone: '<contact_telephone>',
    contact_poste: '<contact_poste>',
    contact_nom_complet: '<contact_nom_complet>',
    structure_nom: '<structure_nom>',
    structure_name: '<structure_nom>',
    structure_ecole: '<structure_ecole>',
    structure_address: '<structure_adresse>',
    structure_phone: '<structure_telephone>',
    structure_email: '<structure_email>',
    structure_siret: '<structure_siret>',
    structure_tvaNumber: '<structure_tvaNumber>',
    structure_apeCode: '<structure_apeCode>',
    structure_president_fullName: '<structure_president_nom_complet>',
    charge_email: '<mission_cdm_email>',
    charge_phone: '<mission_cdm_telephone>',
    generationDate: '<mission_date_generation>',
    generationDatePlusOneYear: '<mission_date_generation_plus_1_an>',
    heuresDetaillees: '<heures_detaillees>',
    actualHours: '<amendment_actual_hours>',
    amendmentNewHours: '<amendment_new_hours>',
    heuresFinalementTravaillees: '<heures_finalement_travaillees>',
    plannedHours: '<amendment_planned_hours>',
    reason: '<amendment_reason>',
    totalHT: '<totalHT>',
    totalTTC: '<total_ttc>',
    tva: '<tva>',
    workingHoursDateDebut: '<workingHoursDateDebut>',
    workingHoursHeureDebut: '<workingHoursHeureDebut>',
    workingHoursDateFin: '<workingHoursDateFin>',
    workingHoursHeureFin: '<workingHoursHeureFin>',
    workingHoursPauses: '<workingHoursPauses>',
    workingHoursTotal: '<workingHoursTotal>',
    workingHoursCreation: '<workingHoursCreation>',
    workingHoursMaj: '<workingHoursMaj>',
  };

  return legacy[variableId] || `<${variableId}>`;
}

/** Préfixes de tags pour décider quelles données charger en cache. */
export function tagNeedsChargeData(tagName: string): boolean {
  const t = tagName.replace(/[<>]/g, '');
  return (
    t === 'charge_email' ||
    t === 'charge_phone' ||
    t === 'mission_cdm_email' ||
    t === 'mission_cdm_telephone' ||
    t === 'mission_cdm'
  );
}

export function tagNeedsMissionTypeData(tagName: string): boolean {
  const t = tagName.replace(/[<>]/g, '');
  return [
    'missionType', 'mission_type',
    'studentProfile', 'student_profile',
    'courseApplication', 'course_application',
    'missionLearning', 'mission_learning',
    'mission_type_description', 'missionTypeDescription',
  ].includes(t);
}
