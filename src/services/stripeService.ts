import { loadStripe } from '@stripe/stripe-js';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

console.log('StripeService - Initialisation avec la clé publique:', import.meta.env.VITE_STRIPE_PUBLIC_KEY);

// Remplacez par votre clé publique Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

// IDs de prix Stripe
const STRIPE_PRICE_IDS = {
  BASIC: import.meta.env.VITE_STRIPE_PRICE_BASIC || 'price_XXXXX',
  PRO: import.meta.env.VITE_STRIPE_PRICE_PRO || 'price_XXXXX',
  ENTERPRISE: import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE || 'price_XXXXX'
};

console.log('StripeService - IDs de prix configurés:', STRIPE_PRICE_IDS);

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  stripePriceId: string;
}

// Cette fonction récupère les plans depuis Stripe
export const fetchStripePlans = async (): Promise<SubscriptionPlan[]> => {
  try {
    // Dans un environnement de production, vous devriez appeler votre backend
    // qui communique avec Stripe pour récupérer les plans
    
    // Exemple de code côté serveur (à implémenter):
    /*
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product'],
    });
    
    const plans = prices.data.map(price => {
      const product = price.product;
      return {
        id: product.id,
        name: product.name,
        price: price.unit_amount / 100, // Convertir les centimes en euros
        interval: price.recurring.interval,
        features: product.features || [],
        stripePriceId: price.id
      };
    });
    */
    
    // Pour l'instant, nous allons utiliser des plans codés en dur
    // mais avec les IDs de prix Stripe que vous avez créés
    return [
      {
        id: 'basic',
        name: 'Basique',
        price: 9.99,
        interval: 'month',
        features: [
          'Accès à toutes les fonctionnalités de base',
          'Support par email',
          'Stockage jusqu\'à 5 Go',
          'Jusqu\'à 5 utilisateurs'
        ],
        stripePriceId: STRIPE_PRICE_IDS.BASIC
      },
      {
        id: 'pro',
        name: 'Professionnel',
        price: 19.99,
        interval: 'month',
        features: [
          'Toutes les fonctionnalités Basique',
          'Support prioritaire',
          'Stockage jusqu\'à 20 Go',
          'Jusqu\'à 20 utilisateurs',
          'Fonctionnalités avancées'
        ],
        stripePriceId: STRIPE_PRICE_IDS.PRO
      },
      {
        id: 'enterprise',
        name: 'Entreprise',
        price: 49.99,
        interval: 'month',
        features: [
          'Toutes les fonctionnalités Professionnel',
          'Support dédié',
          'Stockage illimité',
          'Utilisateurs illimités',
          'API personnalisée',
          'SLA garanti'
        ],
        stripePriceId: STRIPE_PRICE_IDS.ENTERPRISE
      }
    ];
  } catch (error) {
    console.error('Erreur lors de la récupération des plans Stripe:', error);
    return [];
  }
};

// Plans par défaut (utilisés en cas d'erreur)
export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Gratuit',
    price: 0,
    interval: 'month',
    features: [
      'Accès aux fonctionnalités de base',
      'Maximum 3 missions actives',
      'Stockage limité à 500 Mo',
      'Maximum 2 utilisateurs',
      'Support par email basique'
    ],
    stripePriceId: 'free'
  },
  {
    id: 'basic',
    name: 'Basique',
    price: 9.99,
    interval: 'month',
    features: [
      'Accès à toutes les fonctionnalités de base',
      'Support par email',
      'Stockage jusqu\'à 5 Go',
      'Jusqu\'à 5 utilisateurs'
    ],
    stripePriceId: STRIPE_PRICE_IDS.BASIC
  },
  {
    id: 'pro',
    name: 'Professionnel',
    price: 19.99,
    interval: 'month',
    features: [
      'Toutes les fonctionnalités Basique',
      'Support prioritaire',
      'Stockage jusqu\'à 20 Go',
      'Jusqu\'à 20 utilisateurs',
      'Fonctionnalités avancées'
    ],
    stripePriceId: STRIPE_PRICE_IDS.PRO
  },
  {
    id: 'enterprise',
    name: 'Entreprise',
    price: 49.99,
    interval: 'month',
    features: [
      'Toutes les fonctionnalités Professionnel',
      'Support dédié',
      'Stockage illimité',
      'Utilisateurs illimités',
      'API personnalisée',
      'SLA garanti'
    ],
    stripePriceId: STRIPE_PRICE_IDS.ENTERPRISE
  }
];

export const createSubscription = async (priceId: string) => {
  console.log('StripeService - Création d\'un nouvel abonnement avec le prix:', priceId);
  try {
    const stripe = await stripePromise;
    if (!stripe) {
      throw new Error('Stripe n\'a pas pu être initialisé. Vérifiez votre clé publique Stripe.');
    }

    const response = await fetch('/api/create-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ priceId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erreur lors de la création de la session de paiement');
    }

    const session = await response.json();
    if (!session.id) {
      throw new Error('Session ID manquant dans la réponse');
    }

    const result = await stripe.redirectToCheckout({
      sessionId: session.id,
    });

    if (result.error) {
      throw new Error(`Erreur de redirection Stripe: ${result.error.message}`);
    }
  } catch (error) {
    console.error('StripeService - Erreur lors de la création de l\'abonnement:', error);
    throw error instanceof Error ? error : new Error('Une erreur inattendue est survenue');
  }
};

export const getSubscriptionStatus = async (userId: string) => {
  if (!userId) {
    throw new Error('ID utilisateur requis pour récupérer le statut de l\'abonnement');
  }

  try {
    const response = await fetch(`/api/subscription-status?userId=${userId}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erreur lors de la récupération du statut de l\'abonnement');
    }
    return await response.json();
  } catch (error) {
    console.error('Erreur lors de la récupération du statut de l\'abonnement:', error);
    throw error instanceof Error ? error : new Error('Une erreur inattendue est survenue');
  }
};

export const getCurrentSubscription = async (userId: string) => {
  if (!userId) {
    throw new Error('ID utilisateur requis pour récupérer l\'abonnement actuel');
  }

  console.log('StripeService - Récupération de l\'abonnement pour l\'utilisateur:', userId);
  try {
    const db = getFirestore();
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      console.log('StripeService - Aucun document utilisateur trouvé');
      return null;
    }
    
    const userData = userDoc.data();
    const subscription = userData.subscription || null;
    
    console.log('StripeService - Données d\'abonnement:', subscription);
    return subscription;
  } catch (error) {
    console.error('StripeService - Erreur lors de la récupération de l\'abonnement:', error);
    throw error instanceof Error ? error : new Error('Une erreur inattendue est survenue');
  }
};

export const cancelSubscription = async (userId: string) => {
  if (!userId) {
    throw new Error('ID utilisateur requis pour annuler l\'abonnement');
  }

  try {
    const response = await fetch('/api/cancel-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erreur lors de l\'annulation de l\'abonnement');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Erreur lors de l\'annulation de l\'abonnement:', error);
    throw error instanceof Error ? error : new Error('Une erreur inattendue est survenue');
  }
}; 