import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button
} from '@mui/material';
import { verifyEmail } from '../firebase/auth';
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const verifyEmailAddress = async () => {
      try {
        const oobCode = searchParams.get('oobCode');
        if (!oobCode) {
          setError("Code de vérification manquant dans l'URL");
          setVerifying(false);
          return;
        }

        await verifyEmail(oobCode);
        setSuccess(true);
        setVerifying(false);

        // Rediriger vers le dashboard après 3 secondes
        setTimeout(() => {
          navigate('/app/dashboard');
        }, 3000);
      } catch (error: any) {
        console.error("Erreur lors de la vérification de l'email:", error);
        setError(error.message || "Une erreur s'est produite lors de la vérification de l'email");
        setVerifying(false);
      }
    };

    verifyEmailAddress();
  }, [searchParams, navigate]);

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: '#f5f5f7'
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 4,
          maxWidth: 400,
          width: '100%',
          textAlign: 'center',
          borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)'
        }}
      >
        {verifying ? (
          <>
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="h6">
              Vérification de votre adresse email...
            </Typography>
          </>
        ) : success ? (
          <>
            <CheckCircleIcon
              sx={{
                fontSize: 48,
                color: 'success.main',
                mb: 2
              }}
            />
            <Typography variant="h6" gutterBottom>
              Email vérifié avec succès !
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Vous allez être redirigé vers votre tableau de bord...
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/app/dashboard')}
              sx={{
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 500
              }}
            >
              Aller au tableau de bord
            </Button>
          </>
        ) : (
          <>
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
            <Button
              variant="contained"
              onClick={() => navigate('/login')}
              sx={{
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 500
              }}
            >
              Retour à la connexion
            </Button>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default VerifyEmail; 