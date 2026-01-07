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
  const { currentUser, userData: contextUserData } = useAuth();
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
        setHasAccess(false);
        setLoading(false);
        return;
      }

      try {
        // Utiliser userData du contexte si disponible, sinon récupérer depuis Firestore
        let finalUserData = userData;
        if (!finalUserData) {
          const userDoc = await getDoc(doc(db, 'users', userId));
          finalUserData = userDoc.data();
        }
        const finalUserStatus = finalUserData?.status || userStatus;

        // Si l'utilisateur est superadmin, il a toujours accès
        if (finalUserStatus === 'superadmin') {
          setHasAccess(true);
          setLoading(false);
          return;
        }

        // Vérifier l'accès basé sur le type de contenu (ancien système)
        if (requiresStructureAccess !== undefined) {
          if (requiresStructureAccess) {
            setHasAccess(canAccessStructureContent(finalUserStatus));
          } else {
            setHasAccess(canAccessStudentContent(finalUserStatus) || canAccessStructureContent(finalUserStatus));
          }
          setLoading(false);
          return;
        }

        // Vérifier l'accès basé sur les permissions (nouveau système)
        if (requiredPermission && finalUserData?.structureId) {
          const permissionsRef = doc(
            db, 
            'structures', 
            finalUserData.structureId, 
            'permissions', 
            requiredPermission.accessType === 'read' 
              ? `${requiredPermission.pageId}_read` 
              : requiredPermission.pageId
          );
          
          const permissionsDoc = await getDoc(permissionsRef);
          const permissions = permissionsDoc.data();

          if (!permissions) {
            setHasAccess(false);
            setLoading(false);
            return;
          }

          // Vérifier si l'utilisateur a accès
          const hasRoleAccess = permissions.allowedRoles?.includes(finalUserStatus as UserStatus);
          const hasPoleAccess = finalUserData.poles?.some(pole => 
            permissions.allowedPoles?.includes(pole.poleId)
          );
          const hasMemberAccess = permissions.allowedMembers?.includes(userId);

          // Nouvelle logique : les rôles dominent sur les pôles
          setHasAccess(hasRoleAccess || hasPoleAccess || hasMemberAccess);
        } else {
          setHasAccess(true);
        }
      } catch (error) {
        console.error("Erreur lors de la vérification des permissions:", error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [userId, userStatus, userData?.structureId, userData?.poles, requiredPermission, requiresStructureAccess, currentUser]);

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