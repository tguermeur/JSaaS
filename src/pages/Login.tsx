import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Paper, 
  Link, 
  CircularProgress,
  Alert,
  IconButton,
  InputAdornment,
  Divider
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff 
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { loginUser, resetPassword } from '../firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export default function Login(): JSX.Element {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [resetEmailSent, setResetEmailSent] = useState<boolean>(false);

  const navigate = useNavigate();

  const getRedirectPath = (userStatus: string): string => {
    switch (userStatus) {
      case 'entreprise':
        return '/app/dashboard'; // Dashboard entreprise
      case 'etudiant':
        return '/app/dashboard'; // Dashboard étudiant
      case 'admin_structure':
      case 'admin':
      case 'membre':
      case 'superadmin':
        return '/app/dashboard'; // Dashboard JE (complet)
      default:
        return '/app/dashboard';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const user = await loginUser(email, password);
      
      // Récupérer le statut de l'utilisateur pour rediriger correctement
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const userStatus = userData.status;
          const redirectPath = getRedirectPath(userStatus);
          navigate(redirectPath);
        } else {
          navigate('/app/dashboard');
        }
      } catch (error) {
        console.error('Erreur lors de la récupération du statut:', error);
        navigate('/app/dashboard');
      }
    } catch (error: any) {
      console.error('Erreur de connexion:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleResetPassword = async () => {
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
        case 'auth/missing-android-pkg-name':
        case 'auth/missing-continue-uri':
        case 'auth/missing-ios-bundle-id':
        case 'auth/invalid-continue-uri':
        case 'auth/unauthorized-continue-uri':
          setError('Erreur de configuration. Veuillez contacter l\'administrateur.');
          break;
        default:
          setError(`Erreur lors de l'envoi de l'email de réinitialisation: ${error.message}`);
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
          Connexion à JS Connect
        </Typography>

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2, 
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start'
            }}
          >
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate>
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
            variant="outlined"
            sx={{ 
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px'
              }
            }}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Mot de passe"
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            variant="outlined"
            sx={{ 
              mb: 3,
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px'
              }
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleTogglePasswordVisibility}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
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
              'Se connecter'
            )}
          </Button>

          <Box sx={{ textAlign: 'center', mb: 2 }}>
            {resetEmailSent ? (
              <Alert severity="success" sx={{ mb: 2 }}>
                Un email de réinitialisation a été envoyé à votre adresse.
              </Alert>
            ) : (
              <Link 
                component={RouterLink} 
                to="/forgot-password"
                sx={{ 
                  color: '#0071e3',
                  textDecoration: 'none',
                  '&:hover': {
                    textDecoration: 'underline'
                  }
                }}
              >
                Mot de passe oublié ?
              </Link>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />
        
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Vous n'avez pas encore de compte ?
          </Typography>
          <Link 
            component={RouterLink} 
            to="/register" 
            variant="body2"
            sx={{ 
              color: '#0071e3',
              textDecoration: 'none',
              fontWeight: 500,
              '&:hover': {
                textDecoration: 'underline'
              }
            }}
          >
            Créer un compte
          </Link>
        </Box>
      </Paper>
      
      <Typography variant="body2" color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
        En vous connectant, vous acceptez les{' '}
        <Link component={RouterLink} to="/mentions-legales" sx={{ color: '#0071e3', textDecoration: 'none' }}>
          Conditions d'utilisation
        </Link>{' '}
        et la{' '}
        <Link component={RouterLink} to="/politique-confidentialite" sx={{ color: '#0071e3', textDecoration: 'none' }}>
          Politique de confidentialité
        </Link>{' '}
        de JS Connect.
      </Typography>
    </Box>
  );
} 