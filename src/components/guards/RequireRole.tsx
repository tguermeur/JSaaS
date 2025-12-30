import React from 'react';
import { Navigate } from 'react-router-dom';
import { Box, Typography, CircularProgress } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

type UserRole = 'etudiant' | 'entreprise' | 'admin_structure' | 'admin' | 'membre' | 'superadmin';

interface RequireRoleProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  redirectTo?: string;
}

const RequireRole: React.FC<RequireRoleProps> = ({ 
  children, 
  allowedRoles,
  redirectTo = '/app/dashboard'
}) => {
  const { userData, loading } = useAuth();

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

  // Vérifier si le rôle de l'utilisateur est autorisé
  if (!allowedRoles.includes(userStatus)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

export default RequireRole;

