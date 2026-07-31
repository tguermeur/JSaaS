export type UserStatus = 'superadmin' | 'admin' | 'admin_structure' | 'membre' | 'etudiant';

// Accès aux pages principales (Dashboard, Mission, Entreprises, Organization)
// admin_structure = admin de la structure (créateur JE), même accès qu'un admin
export const canAccessStructureContent = (userStatus?: string): boolean => {
  return ['superadmin', 'admin', 'admin_structure', 'membre'].includes(userStatus || '');
};

// Accès aux modifications (réservé aux admin et admin_structure)
export const canModifyStructureContent = (userStatus?: string): boolean => {
  return ['superadmin', 'admin', 'admin_structure'].includes(userStatus || '');
};

// Accès à la gestion des utilisateurs (réservé aux admin et admin_structure)
export const canManageUsers = (userStatus?: string): boolean => {
  return ['superadmin', 'admin', 'admin_structure'].includes(userStatus || '');
};

// Accès à la gestion des permissions (réservé aux admin et admin_structure)
export const canManagePermissions = (userStatus?: string): boolean => {
  return ['superadmin', 'admin', 'admin_structure'].includes(userStatus || '');
};

// Accès aux pages étudiants uniquement
export const canAccessStudentContent = (userStatus?: string): boolean => {
  return ['etudiant', 'superadmin', 'admin', 'admin_structure', 'membre'].includes(userStatus || '');
};

// Interface pour les permissions de page
export interface PagePermission {
  pageId: string;
  allowedRoles: UserStatus[];
  allowedPoles: string[];
  allowedMembers?: string[];
}

// Stockage des permissions de page (à remplacer par une base de données)
let pagePermissions: PagePermission[] = [];

// Fonction pour vérifier l'accès à une page spécifique
export const canAccessPage = (
  pageId: string,
  userStatus?: UserStatus,
  userPole?: string,
  userId?: string
): boolean => {
  // Les superadmins ont toujours accès
  if (userStatus === 'superadmin') return true;

  const permission = pagePermissions.find(p => p.pageId === pageId);
  if (!permission) return false;

  // Vérifie si l'utilisateur a le bon rôle
  const hasRole = permission.allowedRoles.includes(userStatus || '');
  // Vérifie si l'utilisateur appartient à un pôle autorisé
  const hasPole = userPole ? permission.allowedPoles.includes(userPole) : false;
  // Vérifie si l'utilisateur est explicitement autorisé
  const hasMemberAccess = userId ? permission.allowedMembers?.includes(userId) : false;

  return hasRole || hasPole || hasMemberAccess;
};

// Fonction pour mettre à jour les permissions d'une page
export const updatePagePermissions = (
  pageId: string,
  allowedRoles: UserStatus[],
  allowedPoles: string[],
  allowedMembers?: string[]
): void => {
  const existingIndex = pagePermissions.findIndex(p => p.pageId === pageId);
  if (existingIndex >= 0) {
    pagePermissions[existingIndex] = { pageId, allowedRoles, allowedPoles, allowedMembers };
  } else {
    pagePermissions.push({ pageId, allowedRoles, allowedPoles, allowedMembers });
  }
}; 