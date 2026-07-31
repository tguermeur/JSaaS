import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  DialogActions,
  useTheme,
  useMediaQuery,
  Snackbar
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff 
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { tokens } from '../theme/tokens';
import { loginUser, resetPassword } from '../firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FUNCTIONS_REGION } from '../firebase/config';
import { getContactAccessPermissions } from '../utils/contactPermissions';
import { getPostAuthRedirectPath } from '../utils/safeAppHome';

export default function Login(): JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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
  const { currentUser, userData, loading: authLoading, isContactWithAccess, contactPermissions } = useAuth();

  const redirectToApp = (path: string) => {
    navigate(path, { replace: true });
  };

  const resolveRedirectPath = async (
    userStatus: string,
    firestoreUser?: Record<string, unknown>,
    uid?: string
  ): Promise<string> => {
    const companyId = (firestoreUser?.companyId as string) || undefined;
    let canViewEvents = false;
    let canManageAmbassadors = false;

    if (userStatus === 'entreprise' && companyId && uid) {
      const perms = await getContactAccessPermissions(uid);
      canViewEvents = !!perms?.canViewEvents;
      canManageAmbassadors = !!perms?.canManageAmbassadors;
    }

    return getPostAuthRedirectPath({
      status: userStatus,
      companyId,
      isContactWithAccess: userStatus === 'entreprise' && !!companyId,
      canViewEvents,
      canManageAmbassadors,
    });
  };

  // Déjà connecté sur /login → redirection SPA (sans reload qui casse la session en prod)
  useEffect(() => {
    if (authLoading || !currentUser) return;
    if (userData?.status) {
      redirectToApp(
        getPostAuthRedirectPath({
          status: userData.status as string,
          companyId: userData.companyId,
          isContactWithAccess,
          canViewEvents: !!contactPermissions?.canViewEvents,
          canManageAmbassadors: !!contactPermissions?.canManageAmbassadors,
        })
      );
    }
  }, [
    authLoading,
    currentUser,
    userData?.status,
    userData?.companyId,
    isContactWithAccess,
    contactPermissions?.canViewEvents,
    contactPermissions?.canManageAmbassadors,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const user = await loginUser(email.trim(), password);
      
      // Attendre un peu pour s'assurer que le document est créé
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Récupérer le statut de l'utilisateur pour vérifier la 2FA
      try {
        let userDoc = await getDoc(doc(db, 'users', user.uid));
        
        // Si le document n'existe toujours pas, réessayer une fois
        if (!userDoc.exists()) {
          console.warn('Document utilisateur non trouvé après connexion, nouvelle tentative...');
          await new Promise(resolve => setTimeout(resolve, 500));
          userDoc = await getDoc(doc(db, 'users', user.uid));
        }
        
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
            const redirectPath = await resolveRedirectPath(userStatus, userData, user.uid);
            redirectToApp(redirectPath);
            return;
          }
        } else {
          console.warn('Document utilisateur toujours inexistant après plusieurs tentatives');
          redirectToApp('/app');
        }
      } catch (error) {
        console.error('Erreur lors de la récupération du statut:', error);
        redirectToApp('/app');
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

  const handleTwoFactorVerify = async (codeOverride?: string) => {
    if (!pendingUserId) {
      setTwoFactorError('Erreur : session invalide. Veuillez réessayer de vous connecter.');
      return;
    }
    
    // Utiliser le code passé en paramètre ou celui de l'état
    const codeToVerify = codeOverride || twoFactorCode;
    
    if (codeToVerify.length !== 6) {
      setTwoFactorError('Veuillez entrer un code à 6 chiffres');
      return;
    }

    setTwoFactorLoading(true);
    setTwoFactorError(null);

    try {
      const functions = getFunctions(auth.app, FUNCTIONS_REGION);
      const verifyTwoFactorCodeFn = httpsCallable<
        { uid: string; code: string; deviceInfo?: ReturnType<typeof getDeviceInfo> },
        { success: boolean }
      >(functions, 'verifyTwoFactorCode');

      const deviceInfo = getDeviceInfo(pendingUserId);

      await verifyTwoFactorCodeFn({
        uid: pendingUserId,
        code: codeToVerify.replace(/\D/g, ''),
        deviceInfo,
      });

      let firestoreUser: Record<string, unknown> | undefined;
      try {
        const userDoc = await getDoc(doc(db, 'users', pendingUserId || ''));
        if (userDoc.exists()) firestoreUser = userDoc.data();
      } catch {
        /* ignorer */
      }
      const redirectPath = await resolveRedirectPath(
        pendingUserStatus || '',
        firestoreUser,
        pendingUserId
      );
      redirectToApp(redirectPath);
    } catch (error: unknown) {
      console.error('Erreur vérification 2FA:', error);
      const err = error as { code?: string; message?: string; details?: unknown };
      let errorMessage = 'Code invalide. Veuillez réessayer.';
      if (err.code === 'functions/failed-precondition') {
        errorMessage = err.message || 'Service 2FA temporairement indisponible. Contactez le support.';
      } else if (err.code === 'functions/permission-denied') {
        errorMessage = 'Session expirée. Reconnectez-vous avec email et mot de passe.';
      } else if (err.code === 'functions/invalid-argument') {
        errorMessage = err.message || errorMessage;
      } else if (err.message && !err.message.includes('INTERNAL')) {
        errorMessage = err.message;
      }
      setTwoFactorError(errorMessage);
      
      // Réinitialiser le code pour permettre une nouvelle tentative
      setTwoFactorCode('');
      
      // Ne pas déconnecter l'utilisateur, laisser le dialog ouvert pour réessayer
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
    <>
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        maxWidth: '500px',
        p: { xs: 1.5, sm: 2 },
        minHeight: { xs: 'calc(100vh - 80px)', sm: 'auto' }
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 4 },
          width: '100%',
          borderRadius: tokens.radius.md,
          boxShadow: tokens.shadows.lg,
          bgcolor: tokens.colors.marketingWhite,
        }}
      >
        <Typography 
          variant="h4" 
          component="h1" 
          align="center" 
          gutterBottom
          sx={{ 
            fontWeight: 600, 
            fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2rem' },
            mb: { xs: 2, sm: 3 },
            color: tokens.colors.ink,
          }}
        >
          Connexion à JS Connect
        </Typography>

        {error && (
          <Alert
            severity="error"
            variant="outlined"
            role="alert"
            sx={{
              mb: 2,
              width: '100%',
              py: 0.75,
              px: 1.5,
              borderRadius: tokens.radius.sm,
              bgcolor: tokens.colors.errorLight,
              borderColor: 'rgba(239, 68, 68, 0.3)',
              alignItems: 'center',
              animation: 'loginErrorIn 0.25s ease-out',
              '@keyframes loginErrorIn': {
                from: { opacity: 0, transform: 'translateY(-4px)' },
                to: { opacity: 1, transform: 'translateY(0)' },
              },
              '& .MuiAlert-icon': {
                p: 0,
                mr: 1,
                fontSize: '1.125rem',
                alignItems: 'center',
                opacity: 0.9,
              },
              '& .MuiAlert-message': {
                p: 0,
                overflow: 'hidden',
                minWidth: 0,
                flex: 1,
              },
            }}
          >
            <Typography
              component="span"
              variant="body2"
              sx={{
                display: 'block',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                fontWeight: 500,
                lineHeight: 1.25,
                color: '#b91c1c',
              }}
            >
              {error}
            </Typography>
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
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            error={!!error}
            disabled={loading}
            variant="outlined"
            sx={{ 
              mb: { xs: 1.5, sm: 2 },
              '& .MuiOutlinedInput-root': {
                borderRadius: tokens.radius.sm
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
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            error={!!error}
            disabled={loading}
            variant="outlined"
            sx={{ 
              mb: { xs: 2, sm: 3 },
              '& .MuiOutlinedInput-root': {
                borderRadius: tokens.radius.sm
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
              mt: { xs: 1.5, sm: 2 },
              mb: { xs: 2, sm: 3 },
              py: { xs: 1.25, sm: 1.5 },
              borderRadius: tokens.radius.xxl,
              textTransform: 'none',
              fontWeight: 500,
              fontSize: { xs: '0.9rem', sm: '1rem' },
              bgcolor: tokens.colors.marketingBlack,
              color: tokens.colors.marketingWhite,
              boxShadow: 'none',
              '&:hover': {
                bgcolor: tokens.colors.marketingBlack,
                opacity: 0.9,
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
                  color: tokens.colors.ink,
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

        <Divider sx={{ my: { xs: 2, sm: 3 } }} />
        
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
            Vous n'avez pas encore de compte ?
          </Typography>
          <Link 
            component={RouterLink} 
            to="/register" 
            variant="body2"
            sx={{ 
              color: tokens.colors.ink,
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: { xs: '0.8rem', sm: '0.875rem' },
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
        PaperProps={{
          sx: {
            m: { xs: 2, sm: 3 },
            maxWidth: { xs: 'calc(100% - 32px)', sm: '420px' },
            borderRadius: tokens.radius.xl,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
          }
        }}
      >
        <DialogTitle 
          sx={{ 
            fontSize: '1.5rem',
            fontWeight: 600,
            textAlign: 'center',
            pb: 1,
            pt: 4,
            px: 3,
            color: tokens.colors.textPrimary
          }}
        >
          Vérification en deux étapes
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 2, pb: 1 }}>
          <Typography 
            variant="body2" 
            color="text.secondary" 
            paragraph 
            sx={{ 
              textAlign: 'center',
              fontSize: '0.9375rem',
              lineHeight: 1.5,
              color: tokens.colors.textSecondary,
              mb: 0
            }}
          >
            Entrez le code à 6 chiffres de votre application d'authentification
          </Typography>
          
          {twoFactorError && (
            <Alert severity="error" sx={{ mb: 2, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
              {twoFactorError}
            </Alert>
          )}
          
          <TextField
            fullWidth
            value={twoFactorCode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
              setTwoFactorCode(value);
              setTwoFactorError(null);
              
              // Validation automatique quand 6 chiffres sont entrés
              if (value.length === 6) {
                // Passer la valeur directement pour éviter les problèmes de synchronisation d'état
                setTimeout(() => {
                  handleTwoFactorVerify(value);
                }, 100);
              }
            }}
            onPaste={(e) => {
              e.preventDefault();
              const pastedText = e.clipboardData.getData('text');
              const value = pastedText.replace(/\D/g, '').slice(0, 6);
              setTwoFactorCode(value);
              setTwoFactorError(null);
              
              // Validation automatique quand 6 chiffres sont collés
              if (value.length === 6) {
                // Passer la valeur directement pour éviter les problèmes de synchronisation d'état
                setTimeout(() => {
                  handleTwoFactorVerify(value);
                }, 100);
              }
            }}
            inputProps={{ 
              maxLength: 6, 
              style: { 
                textAlign: 'center', 
                fontSize: '2rem', 
                letterSpacing: '0.5rem',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                fontWeight: 600,
                padding: '20px 16px'
              } 
            }}
            placeholder="000000"
            disabled={twoFactorLoading}
            sx={{ 
              mt: 3,
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: tokens.radius.md,
                backgroundColor: tokens.colors.bgSubtle,
                border: 'none',
                fontSize: '2rem',
                letterSpacing: '0.5rem',
                '& fieldset': {
                  border: 'none'
                },
                '&:hover fieldset': {
                  border: 'none'
                },
                '&.Mui-focused fieldset': {
                  border: `2px solid ${tokens.colors.ink}`,
                  borderColor: tokens.colors.ink
                },
                '&.Mui-disabled': {
                  backgroundColor: tokens.colors.bgSubtle,
                  opacity: 0.6
                }
              },
              '& .MuiInputBase-input': {
                color: tokens.colors.textPrimary
              }
            }}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 4, pt: 2, flexDirection: 'column', gap: 1.5 }}>
          <Button
            onClick={handleTwoFactorVerify}
            variant="contained"
            disabled={twoFactorLoading || twoFactorCode.length !== 6}
            fullWidth
            sx={{ 
              borderRadius: tokens.radius.xxl,
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              textTransform: 'none',
              bgcolor: tokens.colors.marketingBlack,
              color: tokens.colors.marketingWhite,
              boxShadow: 'none',
              '&:hover': {
                bgcolor: tokens.colors.marketingBlack,
                opacity: 0.9,
              },
              '&:disabled': {
                bgcolor: tokens.colors.gray300,
                color: tokens.colors.inkMuted
              }
            }}
          >
            {twoFactorLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={20} sx={{ color: '#ffffff' }} />
                <span>Vérification...</span>
              </Box>
            ) : (
              'Continuer'
            )}
          </Button>
          <Button 
            onClick={handleTwoFactorCancel}
            disabled={twoFactorLoading}
            fullWidth
            sx={{ 
              borderRadius: tokens.radius.xxl,
              py: 1.25,
              fontSize: '0.9375rem',
              fontWeight: 500,
              textTransform: 'none',
              color: tokens.colors.ink,
              '&:hover': {
                bgcolor: tokens.colors.bgSubtle
              }
            }}
          >
            Annuler
          </Button>
        </DialogActions>
      </Dialog>
      
      <Typography variant="body2" color="text.secondary" sx={{ mt: { xs: 2, sm: 4 }, mb: { xs: 2, sm: 0 }, textAlign: 'center', px: { xs: 2, sm: 0 }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
        En vous connectant, vous acceptez les{' '}
        <Link component={RouterLink} to="/mentions-legales" sx={{ color: tokens.colors.ink, textDecoration: 'none', fontSize: 'inherit' }}>
          Conditions d'utilisation
        </Link>{' '}
        et la{' '}
        <Link component={RouterLink} to="/politique-confidentialite" sx={{ color: tokens.colors.ink, textDecoration: 'none', fontSize: 'inherit' }}>
          Politique de confidentialité
        </Link>{' '}
        de JS Connect.
      </Typography>
    </Box>
      {/* Snackbar pour afficher les erreurs 2FA - rendu en portal pour éviter children invalides dans Box */}
      {createPortal(
        <Snackbar
          open={!!twoFactorError && twoFactorRequired}
          autoHideDuration={5000}
          onClose={() => setTwoFactorError(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          sx={{
            zIndex: 10000,
            '& .MuiSnackbar-root': {
              top: '80px !important'
            }
          }}
        >
          <Alert 
            onClose={() => setTwoFactorError(null)} 
            severity="error" 
            sx={{ 
              width: '100%',
              fontSize: '0.9375rem',
              fontWeight: 500,
              '& .MuiAlert-icon': {
                fontSize: '1.25rem'
              }
            }}
          >
            {twoFactorError}
          </Alert>
        </Snackbar>,
        document.body
      )}
    </>
  );
} 