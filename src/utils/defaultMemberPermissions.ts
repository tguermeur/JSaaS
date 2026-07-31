/**
 * Pages CRM de base : accès lecture par défaut pour les membres
 * lorsque le document structures/.../permissions/{pageId}_read est absent.
 * Doit rester aligné entre ProtectedRoute, usePermission et Sidebar.
 */
export const DEFAULT_MEMBER_READ_PAGES = [
  'dashboard',
  'organization',
  'mission',
  'entreprises',
  'documents',
] as const;

export type DefaultMemberReadPage = (typeof DEFAULT_MEMBER_READ_PAGES)[number];

export function isDefaultMemberReadPage(pageId: string): boolean {
  return (DEFAULT_MEMBER_READ_PAGES as readonly string[]).includes(pageId);
}
