import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { isDefaultMemberReadPage } from '../utils/defaultMemberPermissions';

/**
 * Interface pour les permissions d'une page
 */
interface PagePermission {
  allowedRoles: string[];
  allowedPoles: string[];
  allowedMembers: string[];
}

/**
 * Interface pour le retour du hook
 */
interface UsePermissionReturn {
  canRead: boolean;
  canWrite: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Hook pour vérifier les permissions d'un utilisateur sur une page spécifique.
 * 
 * Ce hook écoute en temps réel les documents de permission dans Firestore :
 * - `structures/{structureId}/permissions/{pageId}` pour l'écriture
 * - `structures/{structureId}/permissions/{pageId}_read` pour la lecture
 * 
 * @param pageId - L'identifiant de la page (ex: 'entreprises', 'tresorerie', 'rh')
 * @returns { canRead, canWrite, loading, error }
 * 
 * @example
 * ```tsx
 * const { canRead, canWrite, loading } = usePermission('entreprises');
 * 
 * if (loading) return <CircularProgress />;
 * if (!canRead) return <AccessDenied />;
 * 
 * return (
 *   <div>
 *     {canWrite && <Button>Ajouter</Button>}
 *   </div>
 * );
 * ```
 */
export function usePermission(pageId: string): UsePermissionReturn {
  const { currentUser, userData } = useAuth();
  
  const [writePermission, setWritePermission] = useState<PagePermission | null>(null);
  const [readPermission, setReadPermission] = useState<PagePermission | null>(null);
  const [loadingWrite, setLoadingWrite] = useState(true);
  const [loadingRead, setLoadingRead] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extraire les informations utilisateur
  const userStatus = userData?.status || '';
  const userId = currentUser?.uid || '';
  const structureId = userData?.structureId || '';
  const userPoles = useMemo(() => {
    return (userData?.poles || []).map((pole: any) => pole.poleId);
  }, [userData?.poles]);

  // Seul le superadmin contourne les permissions. L'admin de structure est soumis aux docs Réglages > Accès.
  const isSuperAdmin = useMemo(() => userStatus === 'superadmin', [userStatus]);

  // Les permissions structure (sous-collection structures/.../permissions) ne concernent que
  // les membres de la structure. Les contacts entreprise (status entreprise + companyId) ont
  // leurs droits via contactAccess — lire permissions Firestore leur est interdit par les rules.
  const isStructurePermissionSubject = useMemo(
    () => ['admin', 'admin_structure', 'membre'].includes(userStatus),
    [userStatus]
  );

  // Attente structureId plafonnée — évite un spinner infini si le profil est incomplet
  const [waitingForStructure, setWaitingForStructure] = useState(
    () => isStructurePermissionSubject && !!currentUser && !structureId
  );

  useEffect(() => {
    if (!isStructurePermissionSubject || !userId || structureId) {
      setWaitingForStructure(false);
      return;
    }
    setWaitingForStructure(true);
    const t = window.setTimeout(() => setWaitingForStructure(false), 8000);
    return () => window.clearTimeout(t);
  }, [isStructurePermissionSubject, userId, structureId]);

  // Lecture unique (getDoc) — 1 round-trip au lieu de 2 listeners temps réel
  useEffect(() => {
    if (isSuperAdmin) {
      setLoadingWrite(false);
      setLoadingRead(false);
      return;
    }

    if (!isStructurePermissionSubject || !structureId || !pageId || !db) {
      setLoadingWrite(false);
      setLoadingRead(false);
      setWritePermission(null);
      setReadPermission(null);
      return;
    }

    const firestore = db;
    let cancelled = false;
    setLoadingWrite(true);
    setLoadingRead(true);

    const load = async () => {
      try {
        const [writeSnap, readSnap] = await Promise.all([
          getDoc(doc(firestore, 'structures', structureId, 'permissions', pageId)),
          getDoc(doc(firestore, 'structures', structureId, 'permissions', `${pageId}_read`)),
        ]);
        if (cancelled) return;

        const parse = (snap: typeof writeSnap): PagePermission | null => {
          if (!snap.exists()) return null;
          const data = snap.data();
          return {
            allowedRoles: data.allowedRoles || [],
            allowedPoles: data.allowedPoles || [],
            allowedMembers: data.allowedMembers || [],
          };
        };

        setWritePermission(parse(writeSnap));
        setReadPermission(parse(readSnap));
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Erreur permissions';
          console.error(`Erreur permissions pour ${pageId}:`, err);
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoadingWrite(false);
          setLoadingRead(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [structureId, pageId, isSuperAdmin, isStructurePermissionSubject]);

  /**
   * Vérifie si l'utilisateur a une permission spécifique
   */
  const hasPermission = (permission: PagePermission | null): boolean => {
    if (!permission) return false;

    // Normaliser le status (supporter l'ancien 'member' pour compatibilité)
    const normalizedStatus = userStatus === 'member' ? 'membre' : userStatus;

    // Vérifier si le rôle est autorisé
    const roleMatch = permission.allowedRoles.some(role => {
      // Normaliser également le rôle dans les permissions
      const normalizedRole = role === 'member' ? 'membre' : role;
      return normalizedRole === normalizedStatus;
    });

    if (roleMatch) return true;

    // Vérifier si l'utilisateur est explicitement autorisé
    if (permission.allowedMembers.includes(userId)) return true;

    // Vérifier si un des pôles de l'utilisateur est autorisé
    const poleMatch = userPoles.some((poleId: string) => 
      permission.allowedPoles.includes(poleId)
    );

    return poleMatch;
  };

  // admin / admin_structure : accès total structure (comportement pré-audit)
  const isLegacyStructureAdmin = useMemo(
    () => userStatus === 'admin' || userStatus === 'admin_structure',
    [userStatus]
  );

  const canWrite = useMemo(() => {
    if (isSuperAdmin) return true;
    if (isLegacyStructureAdmin && structureId) return true;
    return hasPermission(writePermission);
  }, [isSuperAdmin, isLegacyStructureAdmin, structureId, writePermission, userStatus, userId, userPoles, pageId]);

  const canRead = useMemo(() => {
    if (isSuperAdmin) return true;
    if (isLegacyStructureAdmin && structureId) return true;
    if (canWrite) return true;
    if (hasPermission(readPermission)) return true;
    // Doc _read absent : même fallback membre que ProtectedRoute / Sidebar
    if (
      readPermission === null &&
      !loadingRead &&
      (userStatus === 'membre' || userStatus === 'member') &&
      isDefaultMemberReadPage(pageId)
    ) {
      return true;
    }
    return false;
  }, [isSuperAdmin, isLegacyStructureAdmin, structureId, canWrite, readPermission, loadingRead, userStatus, userId, userPoles, pageId]);

  const loading = loadingWrite || loadingRead || waitingForStructure;

  return {
    canRead,
    canWrite,
    loading,
    error,
  };
}

/**
 * Hook pour vérifier les permissions de plusieurs pages en une fois
 * 
 * @param pageIds - Liste des identifiants de pages
 * @returns Record<pageId, { canRead, canWrite }>
 */
export function useMultiplePermissions(pageIds: string[]): {
  permissions: Record<string, { canRead: boolean; canWrite: boolean }>;
  loading: boolean;
} {
  const results = pageIds.map(pageId => ({
    pageId,
    ...usePermission(pageId),
  }));

  const loading = results.some(r => r.loading);
  
  const permissions = results.reduce((acc, { pageId, canRead, canWrite }) => {
    acc[pageId] = { canRead, canWrite };
    return acc;
  }, {} as Record<string, { canRead: boolean; canWrite: boolean }>);

  return { permissions, loading };
}

export default usePermission;
