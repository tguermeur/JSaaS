/**
 * Paramètres de notation (scoring) des prospects par structure.
 * Utilisés pour le calcul du score IA et l'analyse des clients passés.
 */
export interface ScoringWeights {
  completeness: number;   // 0-100, poids complétude fiche
  recency: number;        // 0-100, poids fraîcheur (création)
  status: number;         // 0-100, poids statut pipeline
  lastActivity: number;  // 0-100, poids dernière activité
  fitSpecialization?: number;  // 0-100, poids adéquation avec spécialisations (optionnel)
  fitPastClients?: number;     // 0-100, poids similarité clients passés (optionnel)
}

export interface AnalyzedClientProfile {
  sectors: string[];
  companySizes: string[];
  missionTypes: string[];
  summary?: string;
}

export interface ScoringSettings {
  id?: string;
  structureId: string;
  /** Missions / types d'études dans lesquels la JE se spécialise (titres ou IDs) */
  specializations: string[];
  /** Poids des critères pour le calcul du score (total recommandé 100) */
  weights: ScoringWeights;
  /** Profil type déduit des entreprises déjà clientes (rempli par l'IA) */
  analyzedClientProfile?: AnalyzedClientProfile;
  analyzedAt?: Date | { toDate: () => Date };
  updatedAt?: Date | { toDate: () => Date };
  /** Template de message de contact pour l'IA (variables possibles: {{nom}}, {{entreprise}}, {{secteur}}) */
  contactMessageTemplate?: string;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  completeness: 30,
  recency: 20,
  status: 25,
  lastActivity: 25,
  fitSpecialization: 0,
  fitPastClients: 0
};
