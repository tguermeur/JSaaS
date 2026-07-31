import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Alert,
  Grid,
  Avatar,
  Button,
  alpha,
  useTheme,
  Fade
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  BugReport as BugReportIcon,
  Assignment as AssignmentIcon,
  Campaign as CampaignIcon,
  Person as PersonIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Save as SaveIcon,
  Restore as RestoreIcon,
  Payment as PaymentIcon,
  School as SchoolIcon,
  Email as EmailIcon,
  Gesture as GestureIcon,
  BusinessCenter as BusinessCenterIcon,
  Receipt as ReceiptIcon,
  AlternateEmail as AlternateEmailIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { tokens } from '../../theme/tokens';
import { settingsPageStyles, SettingsPanel, DsToggle } from '../../components/ds';

// Animation subtile (legacy — conservée pour compatibilité imports)

const Settings: React.FC = () => {
  const theme = useTheme();
  const { currentUser, userData } = useAuth();
  const { preferences, updatePreferences, showTemporaryNotification } = useNotifications();
  const [localPreferences, setLocalPreferences] = useState(preferences);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  // Vérifier si l'utilisateur est admin ou super-admin
  useEffect(() => {
    if (userData) {
      const isUserAdmin = userData.status === 'admin' || userData.status === 'super-admin';
      setIsAdmin(isUserAdmin);
    }
  }, [userData]);

  // Synchroniser les préférences locales avec celles du contexte
  useEffect(() => {
    setLocalPreferences(preferences);
  }, [preferences]);

  // Vérifier s'il y a des changements
  useEffect(() => {
    const changed = JSON.stringify(localPreferences) !== JSON.stringify(preferences);
    setHasChanges(changed);
  }, [localPreferences, preferences]);

  const handlePreferenceChange = (key: string, value: boolean) => {
    // Mettre à jour seulement l'état local
    setLocalPreferences(prev => ({
      ...prev,
      types: { ...prev.types, [key]: value }
    }));
  };

  const handleChannelChange = (key: 'email' | 'push' | 'sound' | 'desktop', value: boolean) => {
    setLocalPreferences(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      await updatePreferences(localPreferences);
      showTemporaryNotification({
        type: 'success',
        message: 'Préférences de notifications sauvegardées avec succès'
      });
    } catch (error) {
      showTemporaryNotification({
        type: 'error',
        message: 'Erreur lors de la sauvegarde des préférences'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPreferences = () => {
    setLocalPreferences(preferences);
    showTemporaryNotification({
      type: 'info',
      message: 'Préférences remises à zéro'
    });
  };

  const notificationTypes = [
    {
      key: 'admin_notification',
      label: 'Annonces administratives',
      description: 'Messages importants de l\'équipe, maintenance, nouvelles fonctionnalités',
      icon: <NotificationsIcon />,
      color: tokens.colors.info
    },
    {
      key: 'report_update',
      label: 'Mises à jour de rapports',
      description: 'Changements de statut de vos signalements de bugs et suggestions',
      icon: <BugReportIcon />,
      color: tokens.colors.warning
    },
    {
      key: 'report_response',
      label: 'Réponses aux rapports',
      description: 'Nouveaux commentaires et réponses sur vos signalements',
      icon: <InfoIcon />,
      color: '#5AC8FA'
    },
    {
      key: 'mission_update',
      label: 'Mises à jour de missions',
      description: 'Candidatures, assignations, changements de statut',
      icon: <AssignmentIcon />,
      color: tokens.colors.success
    },
    {
      key: 'mission_note',
      label: 'Mentions dans les notes',
      description: 'Quand quelqu\'un vous mentionne (@) dans une note de mission',
      icon: <AlternateEmailIcon />,
      color: '#7C3AED'
    },
    {
      key: 'expense_status',
      label: 'Notes de frais',
      description: 'Validation ou refus de vos notes de frais',
      icon: <ReceiptIcon />,
      color: '#F59E0B'
    },
    {
      key: 'etude_update',
      label: 'Études',
      description: 'Assignations et mises à jour d\'études',
      icon: <SchoolIcon />,
      color: '#0EA5E9'
    },
    {
      key: 'ambassador_update',
      label: 'Ambassadeurs',
      description: 'Demandes commerciales, candidatures, documents sur les événements ambassadeur',
      icon: <CampaignIcon />,
      color: tokens.colors.brandTeal
    },
    {
      key: 'commercial_update',
      label: 'Commercial',
      description: 'Prospects assignés et relances à traiter',
      icon: <BusinessCenterIcon />,
      color: '#6366F1'
    },
    {
      key: 'billing',
      label: 'Facturation',
      description: 'Essai, paiements, cotisations',
      icon: <PaymentIcon />,
      color: tokens.colors.error
    },
    {
      key: 'signature',
      label: 'Signatures',
      description: 'Documents à signer et signatures complétées',
      icon: <GestureIcon />,
      color: '#14B8A6'
    },
    {
      key: 'user_update',
      label: 'Mises à jour de profil',
      description: 'Changements de rôle, statut, ou informations de profil utilisateur',
      icon: <PersonIcon />,
      color: tokens.colors.brandTeal
    },
    {
      key: 'system',
      label: 'Notifications système',
      description: 'Alertes système, sécurité, maintenance automatique, erreurs techniques',
      icon: <WarningIcon />,
      color: tokens.colors.error
    }
  ];

  return (
    <Box>
      <Box component="header" sx={{ ...settingsPageStyles.header, px: 0, py: 0, bgcolor: 'transparent', borderBottom: 'none', mb: 3, alignItems: 'flex-start' }}>
        <Box>
          <Typography sx={settingsPageStyles.eyebrow}>Paramètres</Typography>
          <Typography component="h1" sx={settingsPageStyles.title}>Notifications</Typography>
          <Typography sx={settingsPageStyles.sub}>
            Personnalisez vos préférences de notifications pour contrôler ce que vous recevez
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          {isAdmin && (
            <Button
              variant="outlined"
              startIcon={<PaymentIcon />}
              onClick={() => navigate('/settings/billing')}
              sx={{
                borderRadius: tokens.radius.sm,
                textTransform: 'none',
                fontWeight: 500,
                borderColor: tokens.colors.brandTeal,
                color: tokens.colors.brandTeal,
                '&:hover': {
                  borderColor: tokens.colors.brandTeal700,
                  backgroundColor: tokens.colors.primaryAlpha10,
                },
              }}
            >
              Plan d&apos;abonnement
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<RestoreIcon />}
            onClick={handleResetPreferences}
            disabled={!hasChanges}
            sx={{ borderRadius: tokens.radius.sm, textTransform: 'none', fontWeight: 500 }}
          >
            Remettre à zéro
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSavePreferences}
            disabled={!hasChanges || isSaving}
            sx={{
              borderRadius: tokens.radius.sm,
              textTransform: 'none',
              fontWeight: 500,
              px: 3,
              bgcolor: tokens.colors.brandTeal,
              '&:hover': { bgcolor: tokens.colors.brandTeal700 },
            }}
          >
            {isSaving ? 'Sauvegarde...' : 'Enregistrer'}
          </Button>
        </Box>
      </Box>

      {hasChanges && (
        <Alert
          severity="info"
          sx={{
            mb: 3,
            backgroundColor: tokens.colors.primaryAlpha10,
            border: `1px solid ${tokens.colors.primaryAlpha20}`,
            borderRadius: tokens.radius.sm,
            '& .MuiAlert-icon': { color: tokens.colors.brandNavy },
            '& .MuiAlert-message': { color: tokens.colors.textPrimary },
          }}
        >
          <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
            Vous avez des modifications non sauvegardées. Cliquez sur &quot;Enregistrer&quot; pour les appliquer.
          </Typography>
        </Alert>
      )}

      <SettingsPanel title="Canaux" desc="Choisissez comment vous recevoir les alertes">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <EmailIcon sx={{ color: tokens.colors.brandTeal }} />
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>Emails</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                  Recevoir les emails transactionnels (candidatures, facturation, invitations…)
                </Typography>
              </Box>
            </Box>
            <DsToggle
              checked={!!localPreferences.email}
              onChange={(checked) => handleChannelChange('email', checked)}
              accent={tokens.colors.brandTeal}
            />
          </Box>
        </Box>
      </SettingsPanel>

      <Box sx={{ height: 24 }} />

      <SettingsPanel title="Types de notifications" desc="Activez ou désactivez chaque catégorie">
        <Grid container spacing={2}>
          {notificationTypes.map((type, index) => (
            <Grid item xs={12} md={6} key={type.key}>
              <Fade in timeout={300 + index * 100}>
                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${tokens.colors.divider}`,
                    bgcolor: tokens.colors.bgPaper,
                    height: '100%',
                    transition: tokens.transitions.fast,
                    '&:hover': {
                      borderColor: tokens.colors.gray300,
                      boxShadow: tokens.shadows.sm,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar
                        sx={{
                          bgcolor: alpha(type.color, 0.1),
                          color: type.color,
                          width: 44,
                          height: 44,
                        }}
                      >
                        {React.cloneElement(type.icon as React.ReactElement, { sx: { fontSize: 22 } })}
                      </Avatar>
                      <Typography sx={{ fontWeight: 600, color: tokens.colors.textPrimary, fontSize: '1rem' }}>
                        {type.label}
                      </Typography>
                    </Box>
                    <DsToggle
                      checked={localPreferences.types[type.key as keyof typeof localPreferences.types]}
                      onChange={(checked) => {
                        handlePreferenceChange(type.key, checked);
                      }}
                      accent={type.color}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    {type.description}
                  </Typography>
                </Box>
              </Fade>
            </Grid>
          ))}
        </Grid>
      </SettingsPanel>

      <Fade in timeout={800}>
        <Alert
          severity="info"
          sx={{
            mt: 3,
            backgroundColor: tokens.colors.primaryAlpha10,
            border: `1px solid ${tokens.colors.primaryAlpha20}`,
            borderRadius: tokens.radius.md,
            '& .MuiAlert-icon': { color: tokens.colors.brandNavy },
            '& .MuiAlert-message': { color: tokens.colors.textPrimary },
          }}
        >
          <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
            Les annonces critiques et notifications urgentes peuvent toujours être envoyées pour des raisons de sécurité, même si vous les avez désactivées.
          </Typography>
        </Alert>
      </Fade>
    </Box>
  );
};

export default Settings; 