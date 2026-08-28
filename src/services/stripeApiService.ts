// Service pour appeler directement les fonctions Firebase via HTTP
import { auth, getFunctionsBaseUrl } from '../firebase/config';

interface StripeCustomer {
  id: string;
  email: string | null;
  name: string;
  subscriptionStatus: string;
  subscriptionTitle: string;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  environment: 'production' | 'test';
}

interface StripePayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  receipt_url: string | null;
  description?: string;
  subscriptionType?: 'classic' | 'ambassador_enterprise_access' | 'other';
}

const FUNCTIONS_BASE_URL = getFunctionsBaseUrl();

// Fonction pour obtenir le token d'authentification
const getAuthToken = async (): Promise<string | null> => {
  try {
    if (!auth?.currentUser) {
      console.warn('Aucun utilisateur connecté');
      return null;
    }
    
    const token = await auth.currentUser.getIdToken();
    return token;
  } catch (error) {
    console.error('Erreur lors de la récupération du token:', error);
    return null;
  }
};

// Fonction pour appeler une fonction Firebase
const callFirebaseFunction = async (functionName: string, data: any = {}) => {
  try {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Token d\'authentification non disponible');
    }

    const response = await fetch(`${FUNCTIONS_BASE_URL}/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ data }),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`Erreur lors de l'appel à ${functionName}:`, error);
    throw error;
  }
};

// Récupérer les clients Stripe
export const getStripeCustomers = async (): Promise<StripeCustomer[]> => {
  try {
    const result = await callFirebaseFunction('getStripeCustomers');
    return result.result || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des clients Stripe:', error);
    throw error;
  }
};

// Récupérer l'historique des paiements (legacy charges)
export const fetchPaymentHistory = async (email: string): Promise<StripePayment[]> => {
  try {
    const result = await callFirebaseFunction('fetchPaymentHistory', { email });
    return result.result || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des paiements:', error);
    throw error;
  }
};

// Récupérer l'historique des factures avec typage abonnement
export const fetchInvoiceHistory = async (structureId: string): Promise<StripePayment[]> => {
  try {
    const result = await callFirebaseFunction('fetchInvoiceHistory', { structureId });
    return result.result || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des factures:', error);
    throw error;
  }
};

// Récupérer les produits Stripe
export const getStripeProducts = async () => {
  try {
    console.log('Récupération des produits Stripe via API HTTP...');
    const result = await callFirebaseFunction('getStripeProducts');
    console.log('Produits Stripe récupérés:', result.result);
    return result.result || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des produits Stripe:', error);
    throw error;
  }
};

// Créer une session de checkout
export const createCheckoutSession = async (data: any) => {
  try {
    console.log('Création d\'une session de checkout via API HTTP...');
    const result = await callFirebaseFunction('createCheckoutSession', data);
    console.log('Session de checkout créée:', result.result);
    return result.result;
  } catch (error) {
    console.error('Erreur lors de la création de la session de checkout:', error);
    throw error;
  }
};

