import { HttpsError } from 'firebase-functions/v2/https';
import Stripe from 'stripe';

export type SubscriptionType = 'classic' | 'ambassador_enterprise_access';

export function resolveSubscriptionType(
  metadata: Stripe.Metadata | Record<string, string> | null | undefined
): SubscriptionType {
  if (metadata?.subscriptionType === 'ambassador_enterprise_access') {
    return 'ambassador_enterprise_access';
  }
  return 'classic';
}

export function assertAmbassadorEnterpriseEligible(structureType: string | undefined): void {
  if (structureType !== 'jobservice') {
    throw new HttpsError(
      'failed-precondition',
      "Cet accès n'est disponible que pour les structures Job Service."
    );
  }
}

export function normalizeCheckoutSubscriptionType(
  subscriptionType: string | undefined
): SubscriptionType {
  if (subscriptionType === 'ambassador_enterprise_access') {
    return 'ambassador_enterprise_access';
  }
  return 'classic';
}

export function buildAmbassadorEnterpriseAccessFields(
  subscription: Pick<Stripe.Subscription, 'id' | 'status' | 'current_period_end'>
) {
  return {
    active: subscription.status === 'active' || subscription.status === 'trialing',
    status: subscription.status,
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
  };
}

export function buildAmbassadorEnterpriseAccessCanceledFields() {
  return {
    active: false,
    status: 'canceled' as const,
  };
}

export function getAmbassadorEnterpriseAddonDocId(structureId: string): string {
  return `${structureId}_ambassadorEnterpriseAccess`;
}

export function shouldUpdateClassicSubscription(subscriptionType: SubscriptionType): boolean {
  return subscriptionType === 'classic';
}
