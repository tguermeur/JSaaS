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
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff 
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { loginUser, resetPassword } from '../firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function Login(): JSX.Element {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [resetEmailSent, setResetEmailSent] = useState<boolean>(false);
  
  // État pour la 2FA
  const [twoFactorRequired, setTwoFactorRequired] = useState<boolean>(false);
  const [twoFactorCode, setTwoFactorCode] = useState<string>('');
  const [twoFactorLoading, setTwoFactorLoading] = useState<boolean>(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingUserStatus, setPendingUserStatus] = useState<string | null>(null);

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
      
      // Récupérer le statut de l'utilisateur pour vérifier la 2FA
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const userStatus = userData.status;
          
          // Vérifier si la 2FA est activée
          if (userData.twoFactorEnabled) {
            // La 2FA est activée, demander le code
            setPendingUserId(user.uid);
            setPendingUserStatus(userStatus);
            setTwoFactorRequired(true);
            setTwoFactorError(null);
            setTwoFactorCode('');
            setLoading(false);
            return; // Ne pas rediriger, attendre la vérification 2FA
          } else {
            // Pas de 2FA, rediriger normalement
            const redirectPath = getRedirectPath(userStatus);
            navigate(redirectPath);
          }
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

  // Fonction pour détecter les informations de l'appareil
  const getDeviceInfo = (uid: string) => {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    
    // Détecter le nom de l'appareil/navigateur
    let deviceName = 'Appareil inconnu';
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      deviceName = 'Chrome';
    } else if (userAgent.includes('Firefox')) {
      deviceName = 'Firefox';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      deviceName = 'Safari';
    } else if (userAgent.includes('Edg')) {
      deviceName = 'Edge';
    }
    
    // Détecter le système d'exploitation
    let os = 'Unknown';
    if (userAgent.includes('Windows')) {
      os = 'Windows';
      if (userAgent.includes('Windows NT 10.0')) deviceName += ' sur Windows 10/11';
      else if (userAgent.includes('Windows NT 6.3')) deviceName += ' sur Windows 8.1';
      else if (userAgent.includes('Windows NT 6.2')) deviceName += ' sur Windows 8';
      else deviceName += ' sur Windows';
    } else if (userAgent.includes('Mac OS X') || userAgent.includes('Macintosh')) {
      os = 'macOS';
      deviceName += ' sur macOS';
    } else if (userAgent.includes('Linux')) {
      os = 'Linux';
      deviceName += ' sur Linux';
    } else if (userAgent.includes('Android')) {
      os = 'Android';
      deviceName = 'Appareil Android';
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      os = 'iOS';
      deviceName = userAgent.includes('iPad') ? 'iPad' : 'iPhone';
    }
    
    // Générer un ID unique pour cet appareil (basé sur userAgent + quelques caractéristiques)
    const deviceId = `${uid}_${btoa(userAgent + platform).substring(0, 16)}`;
    
    return {
      deviceId,
      deviceName,
      userAgent,
      platform: os
    };
  };

  const handleTwoFactorVerify = async () => {
    if (!pendingUserId || twoFactorCode.length !== 6) {
      setTwoFactorError('Veuillez entrer un code à 6 chiffres');
      return;
    }

    setTwoFactorLoading(true);
    setTwoFactorError(null);

    try {
      const functions = getFunctions();
      const verifyTwoFactorCode = httpsCallable(functions, 'verifyTwoFactorCode');
      
      // Récupérer les informations de l'appareil
      const deviceInfo = getDeviceInfo(pendingUserId);
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Login.tsx:177',message:'Before calling verifyTwoFactorCode',data:{uid:pendingUserId,codeLength:twoFactorCode.length,deviceInfo},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Envoyer le code et les infos de l'appareil
      await verifyTwoFactorCode({ 
        uid: pendingUserId, 
        code: twoFactorCode,
        deviceInfo 
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Login.tsx:186',message:'verifyTwoFactorCode call successful',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Code valide, rediriger
      const redirectPath = getRedirectPath(pendingUserStatus || '');
      navigate(redirectPath);
    } catch (error: any) {
      console.error('Erreur vérification 2FA:', error);
      setTwoFactorError(error.message || 'Code invalide. Veuillez réessayer.');
      
      // Déconnecter l'utilisateur en cas d'échec
      try {
        await signOut(auth);
      } catch (signOutError) {
        console.error('Erreur lors de la déconnexion:', signOutError);
      }
      
      // Réinitialiser l'état
      setTwoFactorRequired(false);
      setTwoFactorCode('');
      setPendingUserId(null);
      setPendingUserStatus(null);
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleTwoFactorCancel = async () => {
    // Déconnecter l'utilisateur
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
    
    // Réinitialiser l'état
    setTwoFactorRequired(false);
    setTwoFactorCode('');
    setPendingUserId(null);
    setPendingUserStatus(null);
    setTwoFactorError(null);
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
      
      {/* Dialog pour la vérification 2FA */}
      <Dialog
        open={twoFactorRequired}
        onClose={handleTwoFactorCancel}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
      >
        <DialogTitle>
          Authentification à deux facteurs
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph sx={{ mt: 1 }}>
            Un code de vérification a été généré par votre application d'authentification.
            Veuillez entrer ce code pour compléter la connexion.
          </Typography>
          
          {twoFactorError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {twoFactorError}
            </Alert>
          )}
          
          <TextField
            fullWidth
            label="Code de vérification"
            value={twoFactorCode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
              setTwoFactorCode(value);
              setTwoFactorError(null);
            }}
            inputProps={{ 
              maxLength: 6, 
              style: { 
                textAlign: 'center', 
                fontSize: '1.5rem', 
                letterSpacing: '0.5rem',
                fontFamily: 'monospace'
              } 
            }}
            placeholder="000000"
            disabled={twoFactorLoading}
            sx={{ 
              mt: 2,
              '& .MuiOutlinedInput-root': {
                fontSize: '1.5rem',
                letterSpacing: '0.5rem',
              }
            }}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={handleTwoFactorCancel}
            disabled={twoFactorLoading}
          >
            Annuler
          </Button>
          <Button
            onClick={handleTwoFactorVerify}
            variant="contained"
            disabled={twoFactorLoading || twoFactorCode.length !== 6}
          >
            {twoFactorLoading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Vérification...
              </>
            ) : (
              'Vérifier'
            )}
          </Button>
        </DialogActions>
      </Dialog>
      
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