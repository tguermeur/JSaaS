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
import { tokens } from '../theme/tokens';

const authPaperSx = {
  p: 4,
  maxWidth: 400,
  width: '100%',
  textAlign: 'center' as const,
  borderRadius: tokens.radius.xl,
  boxShadow: tokens.shadows.lg,
  bgcolor: tokens.colors.marketingWhite,
};

const authButtonSx = {
  borderRadius: tokens.radius.xxl,
  textTransform: 'none' as const,
  fontWeight: 500,
  bgcolor: tokens.colors.marketingBlack,
  color: tokens.colors.marketingWhite,
  boxShadow: 'none',
  px: 3,
  py: 1.25,
  '&:hover': {
    bgcolor: tokens.colors.marketingBlack,
    opacity: 0.9,
  },
};

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
        width: '100%',
        maxWidth: 500,
        p: 2,
      }}
    >
      <Paper elevation={0} sx={authPaperSx}>
        {verifying ? (
          <>
            <CircularProgress size={48} sx={{ mb: 2, color: tokens.colors.ink }} />
            <Typography variant="h6" sx={{ color: tokens.colors.ink }}>
              Vérification de votre adresse email...
            </Typography>
          </>
        ) : success ? (
          <>
            <CheckCircleIcon
              sx={{
                fontSize: 48,
                color: tokens.colors.success,
                mb: 2
              }}
            />
            <Typography variant="h6" gutterBottom sx={{ color: tokens.colors.ink }}>
              Email vérifié avec succès !
            </Typography>
            <Typography sx={{ mb: 3, color: tokens.colors.inkMuted }}>
              Vous allez être redirigé vers votre tableau de bord...
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/app/dashboard')}
              sx={authButtonSx}
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
              sx={authButtonSx}
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
