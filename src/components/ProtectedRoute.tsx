import React, { useEffect, useState, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, Typography, CircularProgress } from '@mui/material';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { type UserStatus, canAccessStructureContent, canAccessStudentContent } from '../utils/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: {
    pageId: string;
    accessType: 'read' | 'write';
  };
  requiresStructureAccess?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredPermission,
  requiresStructureAccess
}) => {
  const { currentUser, userData: contextUserData, isContactWithAccess } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  // Utiliser userData du contexte si disponible, sinon récupérer depuis Firestore
  const userData = useMemo(() => contextUserData, [contextUserData?.uid, contextUserData?.status, contextUserData?.structureId]);
  const userId = useMemo(() => currentUser?.uid, [currentUser?.uid]);
  const userStatus = useMemo(() => userData?.status, [userData?.status]);

  useEffect(() => {
    const checkAccess = async () => {
      if (!currentUser || !userId) {
        console.log('[ProtectedRoute] Pas d’utilisateur connecté → accès refusé');
        setHasAccess(false);
        setLoading(false);
        return;
      }

      const logCtx = requiredPermission
        ? { pageId: requiredPermission.pageId, accessType: requiredPermission.accessType }
        : { requiresStructureAccess };

      try {
        // Utiliser userData du contexte si disponible, sinon récupérer depuis Firestore
        let finalUserData = userData;
        if (!finalUserData) {
          const userDoc = await getDoc(doc(db, 'users', userId));
          finalUserData = userDoc.data();
        }
        const finalUserStatus = finalUserData?.status || userStatus;

        // Seul le superadmin contourne les permissions. L'admin de structure est soumis aux docs Réglages > Accès.
        if (finalUserStatus === 'superadmin') {
          console.log('[ProtectedRoute] Accès accordé (superadmin)', { ...logCtx, status: finalUserStatus });
          setHasAccess(true);
          setLoading(false);
          return;
        }

        // Vérifier l'accès basé sur le type de contenu (ancien système)
        if (requiresStructureAccess !== undefined) {
          const structureAccess = requiresStructureAccess
            ? canAccessStructureContent(finalUserStatus)
            : canAccessStudentContent(finalUserStatus) || canAccessStructureContent(finalUserStatus);
          console.log('[ProtectedRoute] Vérification accès structure', {
            ...logCtx,
            requiresStructureAccess,
            hasAccess: structureAccess,
            status: finalUserStatus,
          });
          setHasAccess(structureAccess);
          setLoading(false);
          return;
        }

        // Contacts avec accès (entreprise + companyId) : permissions gérées côté contact
        if (isContactWithAccess && finalUserData?.status === 'entreprise' && finalUserData?.companyId) {
          console.log('[ProtectedRoute] Accès accordé (contact avec accès)', logCtx);
          setHasAccess(true);
          setLoading(false);
          return;
        }

        // Vérification permissions par page (read/write)
        if (requiredPermission && finalUserData?.structureId) {
          const docId =
            requiredPermission.accessType === 'read'
              ? `${requiredPermission.pageId}_read`
              : requiredPermission.pageId;
          const docPath = `structures/${finalUserData.structureId}/permissions/${docId}`;
          console.log('[ProtectedRoute] Vérification permission Firestore', {
            pageId: requiredPermission.pageId,
            accessType: requiredPermission.accessType,
            docPath,
          });

          try {
            const permissionsRef = doc(
              db,
              'structures',
              finalUserData.structureId,
              'permissions',
              docId
            );
            const permissionsDoc = await getDoc(permissionsRef);
            const permissions = permissionsDoc.data();

            if (!permissions || !permissionsDoc.exists()) {
              console.log('[ProtectedRoute] Accès refusé (document permission absent ou vide)', {
                pageId: requiredPermission.pageId,
                accessType: requiredPermission.accessType,
              });
              setHasAccess(false);
              setLoading(false);
              return;
            }

            const hasRoleAccess = permissions.allowedRoles?.includes(finalUserStatus as UserStatus);
            const hasPoleAccess = (finalUserData.poles ?? []).some((pole: { poleId: string }) =>
              permissions.allowedPoles?.includes(pole.poleId)
            );
            const hasMemberAccess = permissions.allowedMembers?.includes(userId);
            const hasAccessResult = hasRoleAccess || hasPoleAccess || hasMemberAccess;

            console.log('[ProtectedRoute] Résultat vérification permission', {
              pageId: requiredPermission.pageId,
              accessType: requiredPermission.accessType,
              hasAccess: hasAccessResult,
              role: hasRoleAccess,
              pole: hasPoleAccess,
              member: hasMemberAccess,
              status: finalUserStatus,
            });
            setHasAccess(hasAccessResult);
          } catch (permissionError) {
            console.error('[ProtectedRoute] Erreur lors de la vérification des permissions:', permissionError);
            setHasAccess(false);
            setLoading(false);
          }
          return;
        }

        // Aucune permission requise (route sans requiredPermission)
        console.log('[ProtectedRoute] Accès accordé (aucune permission requise)', logCtx);
        setHasAccess(true);
      } catch (error) {
        console.error('[ProtectedRoute] Erreur lors de la vérification des permissions:', error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [userId, userStatus, userData?.structureId, userData?.poles, requiredPermission, requiresStructureAccess, currentUser, isContactWithAccess, userData]);

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh' 
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!hasAccess) {
    return (
      <Box sx={{ 
        width: '100%', 
        px: { xs: 2, sm: 3, md: 4 },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh'
      }}>
        <Typography variant="h5" color="error" sx={{ mb: 2 }}>
          Accès refusé
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Vous n'avez pas les permissions nécessaires pour accéder à cette page.
        </Typography>
      </Box>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute; 