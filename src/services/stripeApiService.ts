// Service pour appeler directement les fonctions Firebase via HTTP
import { auth } from '../firebase/config';

interface StripeCustomer {
  id: string;
  email: string;
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
  receipt_url: string;
  description?: string;
}

// URL de base pour les fonctions Firebase
const FUNCTIONS_BASE_URL = 'https://us-central1-jsaas-dd2f7.cloudfunctions.net';

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
    console.log('Récupération des clients Stripe via API HTTP...');
    const result = await callFirebaseFunction('getStripeCustomers');
    console.log('Clients Stripe récupérés:', result.result);
    return result.result || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des clients Stripe:', error);
    throw error;
  }
};

// Récupérer l'historique des paiements
export const fetchPaymentHistory = async (email: string): Promise<StripePayment[]> => {
  try {
    console.log('Récupération de l\'historique des paiements via API HTTP...');
    const result = await callFirebaseFunction('fetchPaymentHistory', { email });
    console.log('Paiements récupérés:', result.result);
    return result.result || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des paiements:', error);
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

