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
  stripeSecretKey?: string;
  stripeProductId?: string;
  stripeBuyButtonId?: string;
}

export interface CreateStructureData {
  nom: string;
  ecole: string;
  emailDomains: string[];
  domaines: string[];
} 