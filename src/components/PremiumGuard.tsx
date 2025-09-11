import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface PremiumGuardProps {
  children: React.ReactNode;
}

const PremiumGuard: React.FC<PremiumGuardProps> = ({ children }) => {
  // Temporairement désactivé pour le débogage
  return <>{children}</>;

  /* Code original commenté
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user?.subscriptionStatus || user.subscriptionStatus !== 'active') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          textAlign: 'center',
          p: 3,
        }}
      >
        <Typography variant="h5" gutterBottom>
          Fonctionnalité Premium
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Cette fonctionnalité n'est disponible que pour les utilisateurs ayant un abonnement actif.
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => navigate('/settings/billing')}
        >
          Voir les plans d'abonnement
        </Button>
      </Box>
    );
  }

  return <>{children}</>;
  */
};

export default PremiumGuard; 