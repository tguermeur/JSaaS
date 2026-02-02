import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';

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

  // Vérifier si l'utilisateur est admin ou superadmin (accès total)
  const isAdminOrSuperAdmin = useMemo(() => {
    return userStatus === 'superadmin' || userStatus === 'admin';
  }, [userStatus]);

  // Écouter les permissions d'écriture
  useEffect(() => {
    if (!structureId || !pageId) {
      setLoadingWrite(false);
      return;
    }

    const writeDocRef = doc(db, 'structures', structureId, 'permissions', pageId);
    
    const unsubscribe = onSnapshot(
      writeDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setWritePermission({
            allowedRoles: data.allowedRoles || [],
            allowedPoles: data.allowedPoles || [],
            allowedMembers: data.allowedMembers || [],
          });
        } else {
          setWritePermission(null);
        }
        setLoadingWrite(false);
      },
      (err) => {
        console.error(`Erreur lors du chargement des permissions d'écriture pour ${pageId}:`, err);
        setError(err.message);
        setLoadingWrite(false);
      }
    );

    return () => unsubscribe();
  }, [structureId, pageId]);

  // Écouter les permissions de lecture
  useEffect(() => {
    if (!structureId || !pageId) {
      setLoadingRead(false);
      return;
    }

    const readDocRef = doc(db, 'structures', structureId, 'permissions', `${pageId}_read`);
    
    const unsubscribe = onSnapshot(
      readDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setReadPermission({
            allowedRoles: data.allowedRoles || [],
            allowedPoles: data.allowedPoles || [],
            allowedMembers: data.allowedMembers || [],
          });
        } else {
          setReadPermission(null);
        }
        setLoadingRead(false);
      },
      (err) => {
        console.error(`Erreur lors du chargement des permissions de lecture pour ${pageId}:`, err);
        setError(err.message);
        setLoadingRead(false);
      }
    );

    return () => unsubscribe();
  }, [structureId, pageId]);

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

  // Calculer les permissions finales
  const canWrite = useMemo(() => {
    // Admin/SuperAdmin ont toujours accès en écriture
    if (isAdminOrSuperAdmin) return true;
    
    // Vérifier les permissions d'écriture
    return hasPermission(writePermission);
  }, [isAdminOrSuperAdmin, writePermission, userStatus, userId, userPoles]);

  const canRead = useMemo(() => {
    // Admin/SuperAdmin ont toujours accès en lecture
    if (isAdminOrSuperAdmin) return true;
    
    // Si l'utilisateur peut écrire, il peut forcément lire
    if (canWrite) return true;
    
    // Vérifier les permissions de lecture
    return hasPermission(readPermission);
  }, [isAdminOrSuperAdmin, canWrite, readPermission, userStatus, userId, userPoles]);

  const loading = loadingWrite || loadingRead || !userData;

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
