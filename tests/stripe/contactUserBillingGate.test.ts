/**
 * Tests unitaires gate facturation createContactUser.
 * Lancer via : npm run test:stripe
 */
import { describe, it, expect } from 'vitest';
import { assertAmbassadorEnterpriseAccessForContactUser } from '../../functions/src/contactUserBillingGate';

describe('assertAmbassadorEnterpriseAccessForContactUser', () => {
  it('rejette jobservice sans add-on actif', () => {
    expect(() =>
      assertAmbassadorEnterpriseAccessForContactUser({
        structureType: 'jobservice',
        ambassadorEnterpriseAccess: { active: false },
      })
    ).toThrow("L'add-on Accès Entreprise — Ambassadeurs doit être actif");

    expect(() =>
      assertAmbassadorEnterpriseAccessForContactUser({
        structureType: 'jobservice',
        ambassadorEnterpriseAccess: undefined,
      })
    ).toThrow("L'add-on Accès Entreprise — Ambassadeurs doit être actif");
  });

  it('accepte jobservice avec add-on actif', () => {
    expect(() =>
      assertAmbassadorEnterpriseAccessForContactUser({
        structureType: 'jobservice',
        ambassadorEnterpriseAccess: { active: true },
      })
    ).not.toThrow();
  });

  it('accepte junior sans add-on (inchangé)', () => {
    expect(() =>
      assertAmbassadorEnterpriseAccessForContactUser({
        structureType: 'junior',
        ambassadorEnterpriseAccess: undefined,
      })
    ).not.toThrow();

    expect(() =>
      assertAmbassadorEnterpriseAccessForContactUser({
        structureType: 'junior',
        ambassadorEnterpriseAccess: { active: false },
      })
    ).not.toThrow();
  });
});
