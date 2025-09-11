import { Stripe } from 'stripe';

export interface UserData {
  email: string;
  password: string;
  displayName: string;
}

export interface ProfileData {
  displayName: string;
  photoURL?: string;
}

export interface StripeProduct {
  id: string;
  name: string;
  description?: string;
  features?: string[];
  price: {
    id: string;
    amount: number;
    currency: string;
    interval?: Stripe.Price.Recurring.Interval | 'one-time';
  } | null;
  images?: string[];
  metadata?: Stripe.Metadata;
}

export interface CheckoutSessionData {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerId?: string;
  userId: string;
  structureId: string;
}

export interface SubscriptionData {
  subscriptionId: string;
  customerId: string;
  userId: string;
} 