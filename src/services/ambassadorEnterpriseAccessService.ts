import { getFunctions, httpsCallable } from 'firebase/functions';
import { loadStripe } from '@stripe/stripe-js';

/**
 * Démarre le Checkout Stripe pour l'add-on Accès Entreprise — Ambassadeurs.
 */
export async function subscribeToAmbassadorEnterpriseAccess(
  structureId: string,
  userId: string
): Promise<void> {
  const priceId = import.meta.env.VITE_STRIPE_PRICE_AMBASSADOR_ENTERPRISE;
  if (!priceId) {
    throw new Error('Configuration Stripe manquante : VITE_STRIPE_PRICE_AMBASSADOR_ENTERPRISE');
  }

  const createCheckoutSession = httpsCallable(getFunctions(), 'createCheckoutSession');
  const { data } = await createCheckoutSession({
    priceId,
    userId,
    structureId,
    subscriptionType: 'ambassador_enterprise_access',
  });

  if (!data || !(data as { sessionId?: string }).sessionId) {
    throw new Error('Session ID non reçu du serveur');
  }

  const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);
  if (!stripe) {
    throw new Error("Stripe n'a pas pu être initialisé");
  }

  const { error } = await stripe.redirectToCheckout({
    sessionId: (data as { sessionId: string }).sessionId,
  });
  if (error) {
    throw error;
  }
}
