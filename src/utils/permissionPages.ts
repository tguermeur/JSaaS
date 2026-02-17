/**
 * Récapitulatif des pages configurables dans Réglages > Accès (Authorizations).
 * Chaque pageId a des permissions de LECTURE et de MODIFICATION configurables.
 *
 * À chaque chargement d'une page protégée, l'app vérifie si l'utilisateur a
 * l'accès lecture ou modification via usePermission(pageId) et ProtectedRoute.
 *
 * Mapping pageId (Accès) → Route(s) et composant(s) :
 *
 * | pageId          | Nom dans Accès        | Route(s)                    | Composant(s)     |
 * |-----------------|------------------------|-----------------------------|------------------|
 * | dashboard       | Tableau de bord       | /app/dashboard              | Dashboard.tsx    |
 * | organization    | Organisation          | /app/organization           | Organization.tsx |
 * | mission         | Missions              | /app/mission, /app/mission/:id | Mission.tsx, MissionDetails.tsx |
 * | entreprises     | Entreprises           | /app/entreprises, /app/entreprises/:id | Entreprises.tsx, EntrepriseDetail.tsx |
 * | commercial      | Commercial            | /app/commercial             | Commercial.tsx   |
 * | audit           | Audit                 | /app/etude, /app/audit       | Etude.tsx, Audit.tsx (pageId unique: audit) |
 * | tresorerie      | Trésorerie            | /app/tresorerie             | Tresorerie.tsx   |
 * | rh              | Ressources Humaines   | /app/human-resources        | HumanResources.tsx |
 * | ambassadors     | Ambassadeurs          | /app/ambassadeurs           | Ambassadors.tsx, AmbassadorEventDetails.tsx |
 * | users           | Gestion des utilisateurs | (dans Settings ou ailleurs) | -             |
 * | permissions     | Gestion des permissions | /app/settings/authorizations | Authorizations.tsx |
 * | encrypted-data  | Données cryptées      | (accès restreint)           | -                |
 *
 * Lecture (read)  = droit de voir la page et les données.
 * Modification (write) = droit de créer, modifier, supprimer (boutons, formulaires).
 *
 * Dans chaque page, utiliser usePermission(pageId) pour :
 * - canRead : afficher ou non la page / les blocs en lecture
 * - canWrite : afficher ou non les boutons d’édition, création, suppression
 */

export const PERMISSION_PAGE_IDS = [
  'dashboard',
  'organization',
  'mission',
  'entreprises',
  'commercial',
  'audit',
  'tresorerie',
  'rh',
  'ambassadors',
  'users',
  'permissions',
  'encrypted-data',
] as const;

export type PermissionPageId = (typeof PERMISSION_PAGE_IDS)[number];
