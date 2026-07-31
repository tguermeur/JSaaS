import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { getSafeAppHomePath } from '../../utils/safeAppHome';

type UserRole = 'etudiant' | 'entreprise' | 'admin_structure' | 'admin' | 'membre' | 'superadmin';

interface RequireRoleProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  redirectTo?: string;
  requireContactAccess?: boolean; // Si true, vérifie que c'est un contact avec accès
  requireCanViewEvents?: boolean; // Si true, vérifie canViewEvents
  requireCanManageAmbassadors?: boolean; // Si true, vérifie canManageAmbassadors
}

const RequireRole: React.FC<RequireRoleProps> = ({ 
  children, 
  allowedRoles,
  redirectTo,
  requireContactAccess = false,
  requireCanViewEvents = false,
  requireCanManageAmbassadors = false
}) => {
  const { userData, loading, currentUser, isContactWithAccess, contactPermissions } = useAuth();
  const [profileWaitExpired, setProfileWaitExpired] = useState(false);

  const fallbackRedirect =
    redirectTo ??
    getSafeAppHomePath({
      status: userData?.status,
      isContactWithAccess,
      canViewEvents: !!contactPermissions?.canViewEvents,
      canManageAmbassadors: !!contactPermissions?.canManageAmbassadors,
    });

  useEffect(() => {
    if (!currentUser || userData) {
      setProfileWaitExpired(false);
      return;
    }
    const timer = setTimeout(() => setProfileWaitExpired(true), 8000);
    return () => clearTimeout(timer);
  }, [currentUser, userData]);

  if (loading || (currentUser && !userData && !profileWaitExpired)) {
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

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!userData) {
    return <Navigate to={fallbackRedirect} replace />;
  }

  const userStatus = userData.status as UserRole;
  
  // Superadmin a toujours accès
  if (userStatus === 'superadmin') {
    return <>{children}</>;
  }

  // Pour les contacts avec accès (statut 'entreprise'), vérifier les permissions si requises
  if (userStatus === 'entreprise' && isContactWithAccess) {
    // Si requireContactAccess est true, vérifier que c'est bien un contact avec accès
    if (requireContactAccess && !isContactWithAccess) {
      return <Navigate to={fallbackRedirect} replace />;
    }
    
    // Si requireCanViewEvents est true, vérifier la permission
    if (requireCanViewEvents && (!contactPermissions || !contactPermissions.canViewEvents)) {
      return <Navigate to={fallbackRedirect} replace />;
    }
    
    // Si requireCanManageAmbassadors est true, vérifier la permission
    if (requireCanManageAmbassadors && (!contactPermissions || !contactPermissions.canManageAmbassadors)) {
      return <Navigate to={fallbackRedirect} replace />;
    }
    
    // Si le rôle 'entreprise' est dans allowedRoles, permettre l'accès
    if (allowedRoles.includes('entreprise')) {
      return <>{children}</>;
    }
  }

  // Vérifier les permissions spécifiques pour les contacts avec accès (pour les autres statuts aussi)
  if (requireContactAccess && !isContactWithAccess) {
    return <Navigate to={fallbackRedirect} replace />;
  }

  if (requireCanViewEvents && (!contactPermissions || !contactPermissions.canViewEvents)) {
    return <Navigate to={fallbackRedirect} replace />;
  }

  if (requireCanManageAmbassadors && (!contactPermissions || !contactPermissions.canManageAmbassadors)) {
    return <Navigate to={fallbackRedirect} replace />;
  }

  // Vérifier si le rôle de l'utilisateur est autorisé
  if (!allowedRoles.includes(userStatus)) {
    return <Navigate to={fallbackRedirect} replace />;
  }

  return <>{children}</>;
};

export default RequireRole;
