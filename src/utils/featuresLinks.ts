/**
 * Liens vers la page Fonctionnalités selon le profil (Junior, Étudiant, Entreprise).
 * Utilisé pour la navigation sur le site et pour les emails (liens par profil).
 */

export type FeaturesProfileType = 'junior' | 'company' | 'student';

const PROFILE_PARAM = 'profile';

/**
 * Retourne le chemin relatif vers la page Features avec le paramètre profil.
 * À utiliser avec React Router (navigate, Link).
 * @param profile - junior | company | student
 */
export function getFeaturesPath(profile: FeaturesProfileType | null): string {
  if (!profile) return '/features';
  return `/features?${PROFILE_PARAM}=${profile}`;
}

/**
 * Retourne l’URL absolue vers la page Features pour un profil donné.
 * À utiliser dans les emails ou pour partage (lien spécifique Junior / Étudiant / Entreprise).
 * @param profile - junior | company | student
 * @param baseUrl - origine du site (ex. https://js-connect.fr). Par défaut: VITE_APP_URL ou window.origin.
 */
export function getFeaturesUrl(
  profile: FeaturesProfileType,
  baseUrl?: string
): string {
  const base = (baseUrl || getDefaultBaseUrl()).replace(/\/$/, '');
  return `${base}/features?${PROFILE_PARAM}=${profile}`;
}

/**
 * Retourne les 3 URLs (Junior, Étudiant, Entreprise) pour les insérer dans les emails.
 */
export function getAllFeaturesUrls(baseUrl?: string): Record<FeaturesProfileType, string> {
  return {
    junior: getFeaturesUrl('junior', baseUrl),
    company: getFeaturesUrl('company', baseUrl),
    student: getFeaturesUrl('student', baseUrl),
  };
}

function getDefaultBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL) {
    return (import.meta.env.VITE_APP_URL as string).trim();
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://js-connect.fr';
}

/**
 * Lit le profil depuis les query params (ex. ?profile=junior).
 * À utiliser sur la page Features pour initialiser le contenu selon l’URL.
 */
export function getProfileFromSearchParams(search: string): FeaturesProfileType | null {
  const params = new URLSearchParams(search);
  const p = params.get(PROFILE_PARAM)?.toLowerCase();
  if (p === 'junior' || p === 'company' || p === 'student') return p;
  return null;
}
