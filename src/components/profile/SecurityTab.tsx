import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  IconButton,
  InputAdornment,
  Alert,
  Divider,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  LinearProgress,
  Grid,
  CircularProgress
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Security as SecurityIcon,
  PhoneAndroid,
  Computer,
  DeleteForever as DeleteForeverIcon,
  Lock as LockIcon,
  Devices as DevicesIcon,
  VerifiedUser as VerifiedUserIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from 'notistack';
import { 
  reauthenticateWithCredential, 
  EmailAuthProvider, 
  updatePassword,
  signOut,
  deleteUser
} from 'firebase/auth';
import { db } from '../../firebase/config';
import { doc, deleteDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { QRCodeSVG } from 'qrcode.react';
import { SecureDevice } from '../../types/user';

interface SecurityTabProps {
  userData: any; // UserData depuis Profile
  onUpdate?: () => void; // Callback pour rafraîchir les données
}

const SecurityTab: React.FC<SecurityTabProps> = ({ userData, onUpdate }) => {
  const { currentUser } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  // État pour le changement de mot de passe
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [changingPassword, setChangingPassword] = useState(false);

  // État pour la 2FA
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(userData?.twoFactorEnabled || false);
  const [twoFactorDialogOpen, setTwoFactorDialogOpen] = useState(false);
  const [twoFactorOTPAuthUrl, setTwoFactorOTPAuthUrl] = useState<string>('');
  const [twoFactorSecret, setTwoFactorSecret] = useState<string>('');
  const [twoFactorVerificationCode, setTwoFactorVerificationCode] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorStep, setTwoFactorStep] = useState<'generate' | 'verify'>('generate');

  // État pour la suppression de compte
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // État pour les appareils sécurisés
  const [secureDevices, setSecureDevices] = useState<SecureDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);

  // Initialiser l'état 2FA depuis userData
  useEffect(() => {
    if (userData) {
      setTwoFactorEnabled(userData.twoFactorEnabled || false);
    }
  }, [userData]);

  // Fonction pour générer un ID d'appareil (identique à celle de Login.tsx)
  const getDeviceId = (): string | null => {
    if (!currentUser?.uid) return null;
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    return `${currentUser.uid}_${btoa(userAgent + platform).substring(0, 16)}`;
  };

  // Charger les appareils sécurisés
  useEffect(() => {
    const loadSecureDevices = async () => {
      if (!currentUser || !twoFactorEnabled) {
        setSecureDevices([]);
        return;
      }

      setLoadingDevices(true);
      try {
        const functions = getFunctions();
        const getDevices = httpsCallable(functions, 'getSecureDevices');
        const result = await getDevices({ uid: currentUser.uid });
        const data = result.data as { devices: SecureDevice[] };
        
        // Convertir les timestamps ISO en dates
        const devices = (data?.devices || []).map((device: any) => ({
          ...device,
          lastUsed: device.lastUsed ? new Date(device.lastUsed) : new Date(),
          addedAt: device.addedAt ? new Date(device.addedAt) : new Date()
        }));
        
        setSecureDevices(devices);
        
        // Déterminer l'appareil actuel
        const deviceId = getDeviceId();
        setCurrentDeviceId(deviceId);
      } catch (error: any) {
        console.error('Erreur chargement appareils:', error);
        // Ne pas afficher d'erreur si la fonction n'est pas encore déployée
        if (error.code === 'functions/not-found' || error.code === 'functions/internal' || error.message?.includes('404')) {
          console.warn('La fonction getSecureDevices n\'est pas encore déployée');
          setSecureDevices([]);
        } else {
          enqueueSnackbar('Erreur lors du chargement des appareils', { variant: 'error' });
        }
      } finally {
        setLoadingDevices(false);
      }
    };

    loadSecureDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, twoFactorEnabled]);

  // Formater la date relative
  const formatRelativeDate = (date: Date | any): string => {
    if (!date) return 'Jamais';
    try {
      const dateObj = date instanceof Date ? date : (date?.toDate?.() || new Date(date));
      const now = new Date();
      const diffMs = now.getTime() - dateObj.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'À l\'instant';
      if (diffMins < 60) return `Il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
      if (diffHours < 24) return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
      if (diffDays < 7) return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
      
      return dateObj.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Date inconnue';
    }
  };

  // Obtenir l'icône selon le type d'appareil
  const getDeviceIcon = (device: SecureDevice) => {
    const platform = device.platform?.toLowerCase() || '';
    const userAgent = device.userAgent?.toLowerCase() || '';
    
    if (platform.includes('ios') || userAgent.includes('iphone') || userAgent.includes('ipad')) {
      return <PhoneAndroid />;
    }
    if (platform.includes('android') || userAgent.includes('android')) {
      return <PhoneAndroid />;
    }
    return <Computer />;
  };

  // Fonction pour formater la date d'activation 2FA
  const formatTwoFactorDate = (date: any): string => {
    if (!date) return '';
    try {
      if (date.toDate && typeof date.toDate === 'function') {
        return date.toDate().toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
      if (date instanceof Date) {
        return date.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
    } catch (e) {
      // Ignorer les erreurs
    }
    return '';
  };

  // Fonction pour calculer la force du mot de passe
  const getPasswordStrength = (password: string): { strength: number; label: string; color: 'error' | 'warning' | 'info' | 'success' } => {
    if (!password) return { strength: 0, label: '', color: 'error' };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;

    if (strength <= 2) return { strength: 33, label: 'Faible', color: 'error' };
    if (strength <= 3) return { strength: 66, label: 'Moyen', color: 'warning' };
    if (strength <= 4) return { strength: 83, label: 'Fort', color: 'info' };
    return { strength: 100, label: 'Très fort', color: 'success' };
  };

  const handlePasswordChange = (field: 'current' | 'new' | 'confirm', value: string) => {
    setPasswords(prev => ({ ...prev, [field]: value }));
  };

  const handleChangePassword = async () => {
    if (!currentUser || !currentUser.email) {
      enqueueSnackbar('Erreur : utilisateur non connecté', { variant: 'error' });
      return;
    }

    // Validation
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      enqueueSnackbar('Veuillez remplir tous les champs', { variant: 'error' });
      return;
    }

    if (passwords.new !== passwords.confirm) {
      enqueueSnackbar('Les nouveaux mots de passe ne correspondent pas', { variant: 'error' });
      return;
    }

    if (passwords.new.length < 8) {
      enqueueSnackbar('Le mot de passe doit contenir au moins 8 caractères', { variant: 'error' });
      return;
    }

    setChangingPassword(true);
    try {
      // 1. Réauthentification
      const credential = EmailAuthProvider.credential(currentUser.email, passwords.current);
      await reauthenticateWithCredential(currentUser, credential);

      // 2. Mise à jour du mot de passe
      await updatePassword(currentUser, passwords.new);
      
      enqueueSnackbar('Mot de passe modifié avec succès', { variant: 'success' });
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (error: any) {
      console.error('Erreur changement mot de passe:', error);
      if (error.code === 'auth/wrong-password') {
        enqueueSnackbar('Mot de passe actuel incorrect', { variant: 'error' });
      } else if (error.code === 'auth/weak-password') {
        enqueueSnackbar('Le nouveau mot de passe est trop faible', { variant: 'error' });
      } else {
        enqueueSnackbar('Erreur lors du changement de mot de passe', { variant: 'error' });
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    if (deleteConfirmText !== 'SUPPRIMER') {
      enqueueSnackbar('Veuillez taper "SUPPRIMER" pour confirmer', { variant: 'warning' });
      return;
    }

    setDeletingAccount(true);
    try {
      // 1. Supprimer le document utilisateur dans Firestore
      await deleteDoc(doc(db, 'users', currentUser.uid));
      
      // 2. Supprimer le compte Auth
      await deleteUser(currentUser);
      
      // 3. Redirection
      navigate('/login');
      enqueueSnackbar('Votre compte a été supprimé', { variant: 'info' });
    } catch (error: any) {
      console.error('Erreur suppression compte:', error);
      if (error.code === 'auth/requires-recent-login') {
        enqueueSnackbar('Par sécurité, veuillez vous reconnecter avant de supprimer votre compte', { variant: 'warning' });
      } else {
        enqueueSnackbar('Erreur lors de la suppression du compte', { variant: 'error' });
      }
    } finally {
      setDeletingAccount(false);
      setDeleteAccountOpen(false);
    }
  };

  const handleGenerateTwoFactor = async () => {
    if (!currentUser) return;
    
    setTwoFactorLoading(true);
    try {
      const functions = getFunctions();
      const generateSecret = httpsCallable(functions, 'generateTwoFactorSecret');
      const result = await generateSecret({ uid: currentUser.uid });
      const data = result.data as { secret: string; otpauthUrl: string; manualEntryKey: string };
      
      setTwoFactorOTPAuthUrl(data.otpauthUrl);
      setTwoFactorSecret(data.manualEntryKey);
      setTwoFactorStep('verify');
    } catch (error: any) {
      console.error('Erreur génération 2FA:', error);
      let errorMessage = 'Erreur lors de la génération du secret 2FA';
      
      if (error.code === 'functions/not-found' || error.code === 'functions/internal' || error.message?.includes('404')) {
        errorMessage = 'La fonction 2FA n\'est pas encore déployée. Veuillez déployer les Cloud Functions d\'abord.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleVerifyAndEnableTwoFactor = async () => {
    if (!currentUser || !twoFactorVerificationCode) return;
    
    if (twoFactorVerificationCode.length !== 6) {
      enqueueSnackbar('Le code doit contenir 6 chiffres', { variant: 'error' });
      return;
    }
    
    setTwoFactorLoading(true);
    try {
      const functions = getFunctions();
      const verifyAndEnable = httpsCallable(functions, 'verifyAndEnableTwoFactor');
      await verifyAndEnable({ uid: currentUser.uid, code: twoFactorVerificationCode });
      
      setTwoFactorEnabled(true);
      setTwoFactorVerificationCode('');
      setTwoFactorOTPAuthUrl('');
      setTwoFactorSecret('');
      setTwoFactorStep('generate');
      enqueueSnackbar('Authentification à deux facteurs activée avec succès', { variant: 'success' });
      
      // Rafraîchir les données utilisateur
      if (onUpdate) {
        onUpdate();
      }
    } catch (error: any) {
      console.error('Erreur vérification 2FA:', error);
      let errorMessage = 'Code invalide. Veuillez réessayer.';
      
      if (error.code === 'functions/not-found' || error.code === 'functions/internal' || error.message?.includes('404')) {
        errorMessage = 'La fonction 2FA n\'est pas encore déployée. Veuillez déployer les Cloud Functions d\'abord.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleDisableTwoFactor = async () => {
    if (!currentUser) return;
    
    setTwoFactorLoading(true);
    try {
      const functions = getFunctions();
      const disable = httpsCallable(functions, 'disableTwoFactor');
      await disable({ uid: currentUser.uid });
      
      setTwoFactorEnabled(false);
      setTwoFactorOTPAuthUrl('');
      setTwoFactorSecret('');
      enqueueSnackbar('Authentification à deux facteurs désactivée', { variant: 'success' });
      
      // Rafraîchir les données utilisateur
      if (onUpdate) {
        onUpdate();
      }
    } catch (error: any) {
      console.error('Erreur désactivation 2FA:', error);
      let errorMessage = 'Erreur lors de la désactivation';
      
      if (error.code === 'functions/not-found' || error.code === 'functions/internal' || error.message?.includes('404')) {
        errorMessage = 'La fonction 2FA n\'est pas encore déployée. Veuillez déployer les Cloud Functions d\'abord.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleTwoFactorToggle = async (checked: boolean) => {
    if (checked) {
      // Activer : générer le secret et ouvrir le dialog
      await handleGenerateTwoFactor();
    } else {
      // Désactiver : demander confirmation
      if (window.confirm('Êtes-vous sûr de vouloir désactiver l\'authentification à deux facteurs ?')) {
        await handleDisableTwoFactor();
      }
    }
  };

  const handleLogoutOtherDevices = async () => {
    if (!currentUser) return;
    
    if (!window.confirm('Êtes-vous sûr de vouloir déconnecter tous les autres appareils ? Vous devrez vous reconnecter sur ces appareils.')) {
      return;
    }

    try {
      const functions = getFunctions();
      const logoutOthers = httpsCallable(functions, 'logoutOtherDevices');
      const deviceId = getDeviceId();
      
      await logoutOthers({ 
        uid: currentUser.uid,
        currentDeviceId: deviceId 
      });
      
      enqueueSnackbar('Tous les autres appareils ont été déconnectés', { variant: 'success' });
      
      // Recharger la liste des appareils
      if (onUpdate) {
        onUpdate();
      }
    } catch (error: any) {
      console.error('Erreur déconnexion autres appareils:', error);
      enqueueSnackbar(error.message || 'Erreur lors de la déconnexion des autres appareils', { variant: 'error' });
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (!currentUser) return;
    
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet appareil de la liste des appareils sécurisés ?')) {
      return;
    }

    try {
      const functions = getFunctions();
      const removeDevice = httpsCallable(functions, 'removeSecureDevice');
      
      await removeDevice({ 
        uid: currentUser.uid,
        deviceId 
      });
      
      enqueueSnackbar('Appareil supprimé avec succès', { variant: 'success' });
      
      // Recharger la liste des appareils
      if (onUpdate) {
        onUpdate();
      }
    } catch (error: any) {
      console.error('Erreur suppression appareil:', error);
      enqueueSnackbar(error.message || 'Erreur lors de la suppression de l\'appareil', { variant: 'error' });
    }
  };

  const passwordStrength = getPasswordStrength(passwords.new);

  return (
    <Box>
      {/* SECTION 1: Changement de Mot de Passe */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <LockIcon sx={{ mr: 2, color: 'primary.main' }} />
          <Typography variant="h6" fontWeight="bold">
          Changement de mot de passe
        </Typography>
        </Box>

        <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Mot de passe actuel"
                type={showPasswords.current ? 'text' : 'password'}
                value={passwords.current}
              onChange={(e) => handlePasswordChange('current', e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                      edge="end"
                    >
                        {showPasswords.current ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                )
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nouveau mot de passe"
                type={showPasswords.new ? 'text' : 'password'}
                value={passwords.new}
              onChange={(e) => handlePasswordChange('new', e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                      edge="end"
                    >
                        {showPasswords.new ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                )
                }}
              />
              {passwords.new && (
                <Box sx={{ mt: 1 }}>
                  <LinearProgress 
                    variant="determinate" 
                  value={passwordStrength.strength} 
                  color={passwordStrength.color}
                  sx={{ height: 8, borderRadius: 1 }}
                />
                <Typography variant="caption" color={`${passwordStrength.color}.main`} sx={{ mt: 0.5 }}>
                  {passwordStrength.label}
                  </Typography>
                </Box>
              )}
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
              label="Confirmer le nouveau mot de passe"
                type={showPasswords.confirm ? 'text' : 'password'}
                value={passwords.confirm}
              onChange={(e) => handlePasswordChange('confirm', e.target.value)}
              error={passwords.confirm !== '' && passwords.new !== passwords.confirm}
              helperText={passwords.confirm !== '' && passwords.new !== passwords.confirm ? 'Les mots de passe ne correspondent pas' : ''}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                      edge="end"
                    >
                        {showPasswords.confirm ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                )
                }}
              />
            </Grid>

          <Grid item xs={12}>
              <Button 
                variant="contained" 
              onClick={handleChangePassword}
              disabled={changingPassword || !passwords.current || !passwords.new || !passwords.confirm}
              sx={{ mt: 1 }}
              >
              {changingPassword ? 'Modification...' : 'Modifier le mot de passe'}
              </Button>
            </Grid>
          </Grid>
      </Paper>

      {/* SECTION 2: Authentification à Deux Facteurs */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <VerifiedUserIcon sx={{ mr: 2, color: 'primary.main' }} />
              <Typography variant="h6" fontWeight="bold">
                Authentification à deux facteurs (2FA)
          </Typography>
        </Box>
        
        <Divider sx={{ mb: 3 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="body1" gutterBottom>
              Protection supplémentaire de votre compte
              </Typography>
              <Typography variant="body2" color="text.secondary">
              Ajoutez une couche de sécurité supplémentaire en activant l'authentification à deux facteurs. 
              Vous devrez entrer un code unique à chaque connexion depuis une application comme Google Authenticator.
            </Typography>
            <Chip 
              label={twoFactorEnabled ? 'Activé' : 'Désactivé'} 
              color={twoFactorEnabled ? 'success' : 'default'} 
              size="small" 
              sx={{ mt: 2 }}
            />
            {twoFactorEnabled && userData?.twoFactorEnabledAt && formatTwoFactorDate(userData.twoFactorEnabledAt) && (
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                Activé le {formatTwoFactorDate(userData.twoFactorEnabledAt)}
              </Typography>
            )}
          </Box>
          <FormControlLabel
            control={
          <Switch 
            checked={twoFactorEnabled} 
                onChange={(e) => handleTwoFactorToggle(e.target.checked)}
                color="primary"
                disabled={twoFactorLoading}
              />
            }
            label=""
          />
        </Box>

        {/* Section QR Code et Code de vérification */}
        {twoFactorOTPAuthUrl && !twoFactorEnabled && (
          <Paper 
            elevation={0} 
            sx={{ 
              mt: 3, 
              p: 3, 
              borderRadius: 2, 
              border: '1px solid', 
              borderColor: 'divider',
              backgroundColor: 'background.paper'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 4, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
              {/* QR Code à gauche */}
              <Box sx={{ flexShrink: 0 }}>
                {twoFactorOTPAuthUrl && (
                  <QRCodeSVG value={twoFactorOTPAuthUrl} size={200} level="M" />
                )}
              </Box>

              {/* Instructions et Code à droite */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Scannez ce QR code depuis une application d'authentification à deux facteurs comme Google Authenticator et entrez le code de vérification à 6 chiffres.
                </Typography>

                {/* Champs de code de vérification */}
                <Box sx={{ mt: 3 }}>
                  <Typography variant="body2" fontWeight="medium" gutterBottom>
                    Code de vérification
                  </Typography>
                  <TextField
                    fullWidth
                    value={twoFactorVerificationCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setTwoFactorVerificationCode(value);
                    }}
                    inputProps={{ 
                      maxLength: 6, 
                      style: { 
                        textAlign: 'center', 
                        fontSize: '1.25rem', 
                        letterSpacing: '0.3rem',
                        fontFamily: 'monospace'
                      } 
                    }}
                    placeholder="000000"
                    sx={{ 
                      mt: 1,
                      '& .MuiOutlinedInput-root': {
                        fontSize: '1.25rem',
                        letterSpacing: '0.3rem',
                      }
                    }}
                  />
                  
                  {/* Bouton pour activer */}
                  <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                    <Button
                      onClick={handleVerifyAndEnableTwoFactor}
                      variant="contained"
                      disabled={twoFactorLoading || twoFactorVerificationCode.length !== 6}
                      sx={{ flex: 1 }}
                    >
                      {twoFactorLoading ? 'Vérification...' : 'Activer'}
                    </Button>
                    <Button
                      onClick={() => {
                        setTwoFactorOTPAuthUrl('');
                        setTwoFactorSecret('');
                        setTwoFactorVerificationCode('');
                        setTwoFactorStep('generate');
                      }}
                      disabled={twoFactorLoading}
                    >
                      Annuler
                    </Button>
                  </Box>
                </Box>

                {/* Clé manuelle optionnelle */}
                {twoFactorSecret && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                      Ou entrez cette clé manuellement :
                    </Typography>
                    <TextField
                      fullWidth
                      value={twoFactorSecret}
                      size="small"
                      InputProps={{
                        readOnly: true,
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => {
                                navigator.clipboard.writeText(twoFactorSecret);
                                enqueueSnackbar('Clé copiée', { variant: 'success' });
                              }}
                              size="small"
                            >
                              <Typography variant="caption">Copier</Typography>
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                      sx={{ mt: 0.5 }}
                    />
                  </Box>
                )}
              </Box>
            </Box>
          </Paper>
        )}
      </Paper>

      {/* Dialog pour l'activation de la 2FA (gardé pour compatibilité mais ne s'ouvre plus automatiquement) */}
      <Dialog
        open={twoFactorDialogOpen}
        onClose={() => {
          if (!twoFactorLoading) {
            setTwoFactorDialogOpen(false);
            setTwoFactorStep('generate');
            setTwoFactorVerificationCode('');
            setTwoFactorOTPAuthUrl('');
            setTwoFactorSecret('');
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {twoFactorStep === 'generate' ? 'Activer l\'authentification à deux facteurs' : 'Vérifier le code'}
        </DialogTitle>
        <DialogContent>
          {twoFactorStep === 'generate' ? (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="body2" color="text.secondary" paragraph>
                Scannez ce QR code avec votre application d'authentification (Google Authenticator, Authy, etc.)
              </Typography>
              {twoFactorOTPAuthUrl && (
                <Box sx={{ my: 3, display: 'flex', justifyContent: 'center' }}>
                  <QRCodeSVG value={twoFactorOTPAuthUrl} size={256} level="M" />
                </Box>
              )}
              {twoFactorSecret && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    Ou entrez cette clé manuellement :
                  </Typography>
                  <TextField
                    fullWidth
                    value={twoFactorSecret}
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => {
                              navigator.clipboard.writeText(twoFactorSecret);
                              enqueueSnackbar('Clé copiée', { variant: 'success' });
                            }}
                          >
                            <Typography variant="caption">Copier</Typography>
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                    size="small"
                  />
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ py: 2 }}>
              <Typography variant="body2" color="text.secondary" paragraph>
                Entrez le code à 6 chiffres généré par votre application d'authentification pour activer la 2FA.
              </Typography>
              <TextField
                fullWidth
                label="Code de vérification"
                value={twoFactorVerificationCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setTwoFactorVerificationCode(value);
                }}
                inputProps={{ maxLength: 6, style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' } }}
                sx={{ mt: 2 }}
                placeholder="000000"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setTwoFactorDialogOpen(false);
              setTwoFactorStep('generate');
              setTwoFactorVerificationCode('');
              setTwoFactorOTPAuthUrl('');
              setTwoFactorSecret('');
            }}
            disabled={twoFactorLoading}
          >
            Annuler
          </Button>
          {twoFactorStep === 'verify' && (
            <Button
              onClick={handleVerifyAndEnableTwoFactor}
              variant="contained"
              disabled={twoFactorLoading || twoFactorVerificationCode.length !== 6}
            >
              {twoFactorLoading ? 'Vérification...' : 'Activer'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* SECTION 3: Appareils et Sessions */}
      {twoFactorEnabled && (
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <DevicesIcon sx={{ mr: 2, color: 'primary.main' }} />
              <Typography variant="h6" fontWeight="bold">
                Appareils sécurisés
              </Typography>
            </Box>
            {secureDevices.length > 1 && (
              <Button
                variant="outlined"
                size="small"
                onClick={handleLogoutOtherDevices}
                disabled={loadingDevices}
              >
                Se déconnecter de tous les autres appareils
              </Button>
            )}
          </Box>
          
          <Divider sx={{ mb: 3 }} />

          {loadingDevices ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : secureDevices.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              Aucun appareil sécurisé. Les appareils seront ajoutés automatiquement après chaque connexion avec 2FA.
            </Typography>
          ) : (
            <List>
              {secureDevices.map((device, index) => {
                const isCurrent = device.deviceId === currentDeviceId;
                return (
                  <React.Fragment key={device.deviceId}>
                    <ListItem>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {getDeviceIcon(device)}
                      </ListItemIcon>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {device.deviceName}
                            {isCurrent && (
                              <Chip label="Appareil actuel" color="primary" size="small" />
                            )}
                          </Box>
                        }
                        secondary={
                          <>
                            <Typography component="span" variant="caption" display="block">
                              {device.platform}
                            </Typography>
                            <Typography component="span" variant="caption" color="text.secondary" display="block">
                              Dernière activité : {formatRelativeDate(device.lastUsed)}
                            </Typography>
                            <Typography component="span" variant="caption" color="text.secondary" display="block">
                              Ajouté le {device.addedAt instanceof Date ? device.addedAt.toLocaleDateString('fr-FR') : 'Date inconnue'}
                            </Typography>
                          </>
                        }
                      />
                      {!isCurrent && (
                        <ListItemSecondaryAction>
                          <Button 
                            size="small" 
                            color="error" 
                            onClick={() => handleRemoveDevice(device.deviceId)}
                          >
                            Supprimer
                          </Button>
                        </ListItemSecondaryAction>
                      )}
                    </ListItem>
                    {index < secureDevices.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </Paper>
      )}

      {/* SECTION 4: Zone de Danger */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 2, 
          border: '1px solid', 
          borderColor: 'error.main',
          bgcolor: 'error.light',
          bgcolor: 'rgba(211, 47, 47, 0.04)'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <DeleteForeverIcon sx={{ mr: 2, color: 'error.main' }} />
          <Typography variant="h6" fontWeight="bold" color="error">
            Zone de danger
          </Typography>
        </Box>
        
        <Divider sx={{ mb: 3 }} />

        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2" fontWeight="bold" gutterBottom>
            Attention : Actions irréversibles
            </Typography>
          <Typography variant="body2">
            La suppression de votre compte est définitive. Toutes vos données personnelles, 
            documents et historiques seront effacés de manière irréversible.
            </Typography>
        </Alert>

            <Button 
              variant="contained" 
              color="error" 
          startIcon={<DeleteForeverIcon />}
          onClick={() => setDeleteAccountOpen(true)}
            >
              Supprimer mon compte
            </Button>
      </Paper>

      {/* Dialog Suppression Compte */}
      <Dialog
        open={deleteAccountOpen}
        onClose={() => {
          setDeleteAccountOpen(false);
          setDeleteConfirmText('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle color="error">
          Supprimer définitivement votre compte ?
        </DialogTitle>
        <DialogContent>
          <DialogContentText paragraph>
            Cette action est irréversible. Toutes vos informations, documents et historiques 
            seront supprimés de nos serveurs.
          </DialogContentText>
          <TextField
            fullWidth
            label='Tapez "SUPPRIMER" pour confirmer'
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteAccountOpen(false);
            setDeleteConfirmText('');
          }}>
            Annuler
          </Button>
          <Button 
            onClick={handleDeleteAccount} 
            color="error" 
            variant="contained"
            disabled={deletingAccount || deleteConfirmText !== 'SUPPRIMER'}
          >
            {deletingAccount ? 'Suppression...' : 'Confirmer la suppression'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SecurityTab;
