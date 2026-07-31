/**
 * Région Cloud Functions — adoption progressive.
 *
 * FUNCTIONS_REGION (env Firebase / runtime) : ex. us-central1 (défaut) ou europe-west1.
 * Ne pas migrer en masse les 100+ fonctions d'un coup ; importer cette constante
 * au fur et à mesure des déploiements ciblés.
 *
 * Côté client : VITE_FUNCTIONS_REGION peut pointer vers europe-west1 une fois
 * les callables migrées (voir docs/EU_MIGRATION.md).
 */
export const FUNCTIONS_REGION =
  process.env.FUNCTIONS_REGION || process.env.GCLOUD_REGION || 'us-central1';
