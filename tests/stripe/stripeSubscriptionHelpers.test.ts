/**
 * Tests unitaires routing abonnements Stripe (classic vs add-on ambassadeur).
 * Lancer via : npm run test:stripe
 */
import { describe, it, expect } from 'vitest';
import {
  assertAmbassadorEnterpriseEligible,
  buildAmbassadorEnterpriseAccessCanceledFields,
  buildAmbassadorEnterpriseAccessFields,
  getAmbassadorEnterpriseAddonDocId,
  normalizeCheckoutSubscriptionType,
  resolveSubscriptionType,
  shouldUpdateClassicSubscription,
} from '../../functions/src/stripeSubscriptionHelpers';

describe('normalizeCheckoutSubscriptionType', () => {
  it('retourne classic par défaut si absent', () => {
    expect(normalizeCheckoutSubscriptionType(undefined)).toBe('classic');
  });

  it('retourne ambassador_enterprise_access si demandé', () => {
    expect(normalizeCheckoutSubscriptionType('ambassador_enterprise_access')).toBe(
      'ambassador_enterprise_access'
    );
  });

  it('retourne classic pour toute autre valeur', () => {
    expect(normalizeCheckoutSubscriptionType('unknown')).toBe('classic');
  });
});

describe('assertAmbassadorEnterpriseEligible', () => {
  it('accepte une structure jobservice', () => {
    expect(() => assertAmbassadorEnterpriseEligible('jobservice')).not.toThrow();
  });

  it('rejette une structure junior', () => {
    expect(() => assertAmbassadorEnterpriseEligible('junior')).toThrow(
      "Cet accès n'est disponible que pour les structures Job Service."
    );
    try {
      assertAmbassadorEnterpriseEligible('junior');
    } catch (error) {
      expect(error).toMatchObject({ code: 'failed-precondition' });
    }
  });

  it('rejette si structureType absent', () => {
    expect(() => assertAmbassadorEnterpriseEligible(undefined)).toThrow(
      "Cet accès n'est disponible que pour les structures Job Service."
    );
  });
});

describe('resolveSubscriptionType', () => {
  it('fallback classic si metadata absente (rétrocompat)', () => {
    expect(resolveSubscriptionType(undefined)).toBe('classic');
    expect(resolveSubscriptionType({})).toBe('classic');
    expect(resolveSubscriptionType({ userId: 'u1', structureId: 's1' })).toBe('classic');
  });

  it('identifie ambassador_enterprise_access', () => {
    expect(
      resolveSubscriptionType({ subscriptionType: 'ambassador_enterprise_access', structureId: 's1' })
    ).toBe('ambassador_enterprise_access');
  });
});

describe('shouldUpdateClassicSubscription', () => {
  it('autorise la mise à jour classique uniquement pour classic', () => {
    expect(shouldUpdateClassicSubscription('classic')).toBe(true);
    expect(shouldUpdateClassicSubscription('ambassador_enterprise_access')).toBe(false);
  });
});

describe('buildAmbassadorEnterpriseAccessFields', () => {
  it('marque actif pour status active ou trialing', () => {
    const active = buildAmbassadorEnterpriseAccessFields({
      id: 'sub_123',
      status: 'active',
      current_period_end: 1_700_000_000,
    });
    expect(active.active).toBe(true);
    expect(active.status).toBe('active');
    expect(active.stripeSubscriptionId).toBe('sub_123');
    expect(active.currentPeriodEnd).toEqual(new Date(1_700_000_000 * 1000));

    const trialing = buildAmbassadorEnterpriseAccessFields({
      id: 'sub_456',
      status: 'trialing',
      current_period_end: 1_700_000_000,
    });
    expect(trialing.active).toBe(true);
  });

  it('marque inactif pour past_due ou canceled', () => {
    const pastDue = buildAmbassadorEnterpriseAccessFields({
      id: 'sub_789',
      status: 'past_due',
      current_period_end: 1_700_000_000,
    });
    expect(pastDue.active).toBe(false);
  });
});

describe('buildAmbassadorEnterpriseAccessCanceledFields', () => {
  it('retourne active false et status canceled', () => {
    expect(buildAmbassadorEnterpriseAccessCanceledFields()).toEqual({
      active: false,
      status: 'canceled',
    });
  });
});

describe('getAmbassadorEnterpriseAddonDocId', () => {
  it('utilise le suffixe ambassadorEnterpriseAccess', () => {
    expect(getAmbassadorEnterpriseAddonDocId('struct_abc')).toBe(
      'struct_abc_ambassadorEnterpriseAccess'
    );
  });
});

describe('webhook routing — add-on ambassadeur', () => {
  it('ne doit pas mettre à jour subscriptions/{structureId} pour un event add-on', () => {
    const subscriptionType = resolveSubscriptionType({
      subscriptionType: 'ambassador_enterprise_access',
      structureId: 'structure-test',
    });

    expect(shouldUpdateClassicSubscription(subscriptionType)).toBe(false);

    const addonDocId = getAmbassadorEnterpriseAddonDocId('structure-test');
    expect(addonDocId).not.toBe('structure-test');
    expect(addonDocId).toBe('structure-test_ambassadorEnterpriseAccess');
  });

  it('conserve le routing classic inchangé pour les souscriptions existantes', () => {
    const legacyType = resolveSubscriptionType({
      userId: 'user-1',
      structureId: 'structure-legacy',
      customerEmail: 'admin@test.com',
    });
    expect(legacyType).toBe('classic');
    expect(shouldUpdateClassicSubscription(legacyType)).toBe(true);
  });
});
