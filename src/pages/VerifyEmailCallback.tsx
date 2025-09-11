import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Typography
} from '@mui/material';

const VerifyEmailCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Récupérer les paramètres de l'URL
    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');
    
    // Si nous avons les paramètres nécessaires, rediriger vers notre page de vérification
    if (mode === 'verifyEmail' && oobCode) {
      navigate(`/verify-email?oobCode=${oobCode}`);
    } else {
      // Si nous n'avons pas les paramètres nécessaires, rediriger vers la page de connexion
      navigate('/login');
    }
  }, [searchParams, navigate]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2
      }}
    >
      <CircularProgress />
      <Typography variant="body1" color="text.secondary">
        Redirection en cours...
      </Typography>
    </Box>
  );
};

export default VerifyEmailCallback; 