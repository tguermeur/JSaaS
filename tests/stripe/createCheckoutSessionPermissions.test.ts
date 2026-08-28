/**
 * Gate de permission createCheckoutSession (logique extraite pour test unitaire).
 */
import { describe, it, expect } from 'vitest';

type UserData = { status?: string; structureId?: string } | undefined;

function canManageStructureCheckout(params: {
  userData: UserData;
  structureId: string;
  authUid: string;
  userId: string;
  structureCreatedBy?: string;
}): boolean {
  const { userData, structureId, authUid, userId, structureCreatedBy } = params;
  const isSuperAdmin = userData?.status === 'superadmin';
  const isAdminOrAdminStructure =
    ((userData?.status === 'admin' || userData?.status === 'admin_structure') && userData?.structureId === structureId)
    || isSuperAdmin;
  const isCreatorJustSignedUp = authUid === userId && structureCreatedBy === userId;
  return Boolean(userData && isAdminOrAdminStructure) || isCreatorJustSignedUp;
}

describe('createCheckoutSession permissions', () => {
  const structureId = 'structure-target';
  const superadminUid = 'superadmin-uid';

  it('autorise un superadmin sans structureId correspondante', () => {
    expect(
      canManageStructureCheckout({
        userData: { status: 'superadmin', structureId: 'autre-structure' },
        structureId,
        authUid: superadminUid,
        userId: superadminUid,
      }),
    ).toBe(true);
  });

  it('autorise un admin_structure de la structure ciblée', () => {
    expect(
      canManageStructureCheckout({
        userData: { status: 'admin_structure', structureId },
        structureId,
        authUid: 'admin-uid',
        userId: 'admin-uid',
      }),
    ).toBe(true);
  });

  it('refuse un admin_structure d’une autre structure', () => {
    expect(
      canManageStructureCheckout({
        userData: { status: 'admin_structure', structureId: 'autre-structure' },
        structureId,
        authUid: 'admin-uid',
        userId: 'admin-uid',
      }),
    ).toBe(false);
  });
});
