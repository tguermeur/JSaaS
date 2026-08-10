import { getFunctions, httpsCallable } from 'firebase/functions';
import { loadStripe } from '@stripe/stripe-js';

/**
 * Démarre le Checkout Stripe payant (même flux que PricingPlans).
 * Paiement immédiat — plus de trial calendaire.
 */
export async function startPaidCheckout(): Promise<void> {
  const priceId =
    import.meta.env.VITE_STRIPE_PRICE_PRO ?? import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE;
  if (!priceId) {
    throw new Error('ID du prix manquant');
  }

  const createCheckoutSession = httpsCallable(getFunctions(), 'createCheckoutSession');
  const { data } = await createCheckoutSession({ priceId });

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
