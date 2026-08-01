/**
 * Chemin de secours selon le rôle — évite les boucles AccessDenied → /app/dashboard.
 */
export function getSafeAppHomePath(opts: {
  status?: string | null;
  isContactWithAccess?: boolean;
  canViewEvents?: boolean;
  canManageAmbassadors?: boolean;
}): string {
  const status = opts.status || '';

  if (status === 'etudiant') {
    return '/app/profile';
  }

  if (status === 'entreprise' && opts.isContactWithAccess) {
    if (opts.canViewEvents || opts.canManageAmbassadors) {
      return '/app/ambassadeurs';
    }
    return '/app/billing-page';
  }

  if (status === 'entreprise') {
    return '/app/billing-page';
  }

  return '/app/dashboard';
}

export function getSafeAppHomeLabel(path: string): string {
  if (path === '/app/profile') return 'Retour à mon profil';
  if (path === '/app/ambassadeurs') return 'Retour aux ambassadeurs';
  if (path === '/app/available-missions') return 'Retour aux missions';
  if (path === '/app/billing-page') return 'Retour à la facturation';
  return 'Retour au tableau de bord';
}

/**
 * Landing post-login / index /app.
 * Contact + (canViewEvents || canManageAmbassadors) → ambassadeurs ;
 * contact sans ces droits / entreprise → facturation ;
 * etudiant → profile ; sinon dashboard.
 */
export function getPostAuthRedirectPath(opts: {
  status?: string | null;
  companyId?: string | null;
  isContactWithAccess?: boolean;
  canViewEvents?: boolean;
  canManageAmbassadors?: boolean;
}): string {
  const status = opts.status || '';
  const isContact =
    opts.isContactWithAccess === true ||
    (status === 'entreprise' && !!opts.companyId);

  if (status === 'entreprise' && isContact) {
    if (opts.canViewEvents || opts.canManageAmbassadors) {
      return '/app/ambassadeurs';
    }
    return '/app/billing-page';
  }

  if (status === 'entreprise') {
    return '/app/billing-page';
  }

  if (status === 'etudiant') {
    return '/app/profile';
  }

  return '/app/dashboard';
}
