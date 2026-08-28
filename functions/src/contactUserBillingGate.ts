import { HttpsError } from 'firebase-functions/v2/https';

export interface StructureBillingContext {
  structureType?: string;
  ambassadorEnterpriseAccess?: { active?: boolean } | null;
}

export function assertAmbassadorEnterpriseAccessForContactUser(
  structure: StructureBillingContext | undefined
): void {
  if (structure?.structureType === 'jobservice' && structure.ambassadorEnterpriseAccess?.active !== true) {
    throw new HttpsError(
      'failed-precondition',
      "L'add-on Accès Entreprise — Ambassadeurs doit être actif pour créer un accès entreprise."
    );
  }
}
