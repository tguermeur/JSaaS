import React from 'react';
import { Navigate } from 'react-router-dom';
import { Box, Typography, CircularProgress } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

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
  redirectTo = '/app/dashboard',
  requireContactAccess = false,
  requireCanViewEvents = false,
  requireCanManageAmbassadors = false
}) => {
  const { userData, loading, isContactWithAccess, contactPermissions } = useAuth();

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

  if (!userData) {
    return <Navigate to="/login" replace />;
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
      return <Navigate to={redirectTo} replace />;
    }
    
    // Si requireCanViewEvents est true, vérifier la permission
    if (requireCanViewEvents && (!contactPermissions || !contactPermissions.canViewEvents)) {
      return <Navigate to={redirectTo} replace />;
    }
    
    // Si requireCanManageAmbassadors est true, vérifier la permission
    if (requireCanManageAmbassadors && (!contactPermissions || !contactPermissions.canManageAmbassadors)) {
      return <Navigate to={redirectTo} replace />;
    }
    
    // Si le rôle 'entreprise' est dans allowedRoles, permettre l'accès
    if (allowedRoles.includes('entreprise')) {
      return <>{children}</>;
    }
  }

  // Vérifier les permissions spécifiques pour les contacts avec accès (pour les autres statuts aussi)
  if (requireContactAccess && !isContactWithAccess) {
    return <Navigate to={redirectTo} replace />;
  }

  if (requireCanViewEvents && (!contactPermissions || !contactPermissions.canViewEvents)) {
    return <Navigate to={redirectTo} replace />;
  }

  if (requireCanManageAmbassadors && (!contactPermissions || !contactPermissions.canManageAmbassadors)) {
    return <Navigate to={redirectTo} replace />;
  }

  // Vérifier si le rôle de l'utilisateur est autorisé
  if (!allowedRoles.includes(userStatus)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

export default RequireRole;



