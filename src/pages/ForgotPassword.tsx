import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Paper, 
  Alert,
  CircularProgress,
  Link
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { resetPassword } from '../firebase/auth';

export default function ForgotPassword(): JSX.Element {
  const [email, setEmail] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [resetEmailSent, setResetEmailSent] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Veuillez entrer votre adresse email');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await resetPassword(email);
      setResetEmailSent(true);
    } catch (error: any) {
      console.error('Erreur détaillée:', error);
      switch (error.code) {
        case 'auth/user-not-found':
          setError('Aucun compte trouvé avec cet email.');
          break;
        case 'auth/invalid-email':
          setError('Format d\'email invalide.');
          break;
        default:
          setError('Erreur lors de l\'envoi de l\'email de réinitialisation.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        maxWidth: '500px',
        p: 2
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 4,
          width: '100%',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
        }}
      >
        <Typography 
          variant="h4" 
          component="h1" 
          align="center" 
          gutterBottom
          sx={{ 
            fontWeight: 600, 
            fontSize: { xs: '1.5rem', sm: '2rem' },
            mb: 3
          }}
        >
          Réinitialisation du mot de passe
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {resetEmailSent ? (
          <>
            <Alert severity="success" sx={{ mb: 3 }}>
              Un email de réinitialisation a été envoyé à votre adresse.
            </Alert>
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Link 
                component={RouterLink} 
                to="/login"
                sx={{ 
                  color: '#0071e3',
                  textDecoration: 'none',
                  '&:hover': {
                    textDecoration: 'underline'
                  }
                }}
              >
                Retour à la connexion
              </Link>
            </Box>
          </>
        ) : (
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Typography variant="body1" sx={{ mb: 3 }}>
              Entrez votre adresse email pour recevoir un lien de réinitialisation.
            </Typography>
            
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Adresse email"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              sx={{ mb: 3 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{ 
                mt: 2,
                mb: 3,
                py: 1.5,
                borderRadius: '20px',
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '1rem',
                bgcolor: '#0071e3',
                '&:hover': {
                  bgcolor: '#0062c3'
                }
              }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Envoyer le lien de réinitialisation'
              )}
            </Button>

            <Box sx={{ textAlign: 'center' }}>
              <Link 
                component={RouterLink} 
                to="/login"
                sx={{ 
                  color: '#0071e3',
                  textDecoration: 'none',
                  '&:hover': {
                    textDecoration: 'underline'
                  }
                }}
              >
                Retour à la connexion
              </Link>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
} 