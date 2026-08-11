export interface Structure {
  id?: string;
  name: string;
  nom: string;
  ecole: string;
  domaines: string[];
  emailDomains: string[];
  createdAt: Date;
  updatedAt?: Date;
  description?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
  // Configuration des factures
  paymentTermsDays?: number;  // Nombre de jours pour l'échéance des factures (défaut: 30)
  // Configuration des cotisations
  cotisationsEnabled?: boolean;
  cotisationAmount?: number;
  cotisationDuration?: 'end_of_school' | '1_year' | '2_years' | '3_years';
  // Clés Stripe de la structure
  stripeIntegrationEnabled?: boolean;
  stripePublishableKey?: string;
  /** Indique qu’une clé secrète est enregistrée côté serveur (jamais exposée au client). */
  stripeSecretConfigured?: boolean;
  stripeProductId?: string;
  stripeBuyButtonId?: string;
  /** Type de structure : Junior Entreprise (études) ou Job Service (missions). */
  structureType?: 'junior' | 'jobservice';
  /** Gratification nette par défaut (€). */
  defaultGratificationNet?: number;
  /** Gratification brute par défaut (€). */
  defaultGratificationBrute?: number;
  /** Statut du wizard d’onboarding self-serve (lot B). */
  onboardingStatus?: 'pending' | 'completed' | 'skipped';
}

export interface CreateStructureData {
  nom: string;
  ecole: string;
  emailDomains: string[];
  domaines: string[];
  /** UID du créateur (requis pour l’inscription Junior, optionnel pour SuperAdmin). */
  createdBy?: string;
  structureType?: 'junior' | 'jobservice';
  /** Statut du wizard d’onboarding self-serve (lot B). */
  onboardingStatus?: 'pending' | 'completed' | 'skipped';
} 