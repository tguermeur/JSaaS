import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '../firebase/config';

export interface CotisationSessionData {
  userId: string;
  structureId: string;
  amount: number;
  duration: string;
}

export interface CotisationSessionResult {
  sessionId: string;
  sessionUrl: string;
}

export interface Cotisation {
  id: string;
  userId: string;
  status: string;
  paidAt: Date;
  expiresAt: Date;
  stripeSessionId: string;
  amount: number;
  structureId: string;
  cotisationDuration: string;
  createdAt: Date;
  refunded?: boolean;
  refundedAt?: Date;
  userData?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

export interface StructureCotisationsResult {
  cotisations: Cotisation[];
}

/**
 * Crée une session de paiement de cotisation
 */
export const createCotisationSession = async (data: CotisationSessionData): Promise<CotisationSessionResult> => {
  try {
    const functionsInstance = await getFirebaseFunctions();
    if (!functionsInstance) throw new Error("Functions non disponible");
    const createCotisationSessionFunction = httpsCallable(functionsInstance, 'createCotisationSession');
    const result = await createCotisationSessionFunction(data);
    
    return result.data as CotisationSessionResult;
  } catch (error) {
    console.error('Erreur lors de la création de la session de cotisation:', error);
    throw error;
  }
};

/**
 * Récupère toutes les cotisations d'une structure (pour les admins)
 */
export const getStructureCotisations = async (structureId: string): Promise<Cotisation[]> => {
  try {
    const functionsInstance = await getFirebaseFunctions();
    if (!functionsInstance) throw new Error("Functions non disponible");
    const getStructureCotisationsFunction = httpsCallable(functionsInstance, 'getStructureCotisations');
    const result = await getStructureCotisationsFunction({ structureId });
    
    const { cotisations } = result.data as StructureCotisationsResult;
    
    // Convertir les dates
    return cotisations.map(cotisation => ({
      ...cotisation,
      paidAt: new Date(cotisation.paidAt),
      expiresAt: new Date(cotisation.expiresAt),
      createdAt: new Date(cotisation.createdAt),
      refundedAt: cotisation.refundedAt ? new Date(cotisation.refundedAt) : undefined
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des cotisations:', error);
    throw error;
  }
};

/**
 * Vérifie si un utilisateur a une cotisation active
 */
export const hasActiveCotisation = (cotisation: Cotisation): boolean => {
  if (cotisation.refunded) return false;
  if (cotisation.status !== 'active') return false;
  return cotisation.expiresAt > new Date();
};

/**
 * Formate la durée de cotisation pour l'affichage
 */
export const formatCotisationDuration = (duration: string): string => {
  switch (duration) {
    case 'end_of_school':
      return 'jusqu\'à la fin de scolarité';
    case '1_year':
      return '1 an';
    case '2_years':
      return '2 ans';
    case '3_years':
      return '3 ans';
    default:
      return '1 an';
  }
};

/**
 * Calcule la date d'expiration d'une cotisation
 */
export const calculateCotisationExpiryDate = (duration: string): Date => {
  const now = new Date();
  switch (duration) {
    case 'end_of_school':
      return new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());
    case '1_year':
      return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    case '2_years':
      return new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
    case '3_years':
      return new Date(now.getFullYear() + 3, now.getMonth(), now.getDate());
    default:
      return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  }
};
