import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Switch, 
  FormControlLabel, 
  Alert,
  Container,
  Grid,
  Card,
  CardContent,
  Avatar,
  Button,
  alpha,
  useTheme,
  keyframes,
  Fade
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  CheckCircle as CheckCircleIcon,
  BugReport as BugReportIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Save as SaveIcon,
  Restore as RestoreIcon,
  Payment as PaymentIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';

// Animation subtile
const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

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
      color: '#007AFF'
    },
    {
      key: 'report_update',
      label: 'Mises à jour de rapports',
      description: 'Changements de statut de vos signalements de bugs et suggestions',
      icon: <BugReportIcon />,
      color: '#FF9500'
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
      description: 'Nouvelles missions assignées, changements de statut, échéances',
      icon: <AssignmentIcon />,
      color: '#34C759'
    },
    {
      key: 'user_update',
      label: 'Mises à jour de profil',
      description: 'Changements de rôle, statut, ou informations de profil utilisateur',
      icon: <PersonIcon />,
      color: '#5856D6'
    },
    {
      key: 'system',
      label: 'Notifications système',
      description: 'Alertes système, sécurité, maintenance automatique, erreurs techniques',
      icon: <WarningIcon />,
      color: '#FF3B30'
    }
  ];

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Header avec boutons d'action */}
        <Box sx={{ mb: 4, animation: `${fadeInUp} 0.6s ease-out` }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 600,
                  color: '#1d1d1f',
                  mb: 1
                }}
              >
                Paramètres de notifications
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  color: 'text.secondary',
                  fontSize: '1rem'
                }}
              >
                Personnalisez vos préférences de notifications pour contrôler ce que vous recevez
              </Typography>
            </Box>
            
            {/* Boutons d'action */}
            <Box sx={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              {isAdmin && (
                <Button
                  variant="outlined"
                  startIcon={<PaymentIcon />}
                  onClick={() => navigate('/settings/billing')}
                  sx={{
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: 500,
                    borderColor: '#34C759',
                    color: '#34C759',
                    '&:hover': {
                      borderColor: '#28A745',
                      backgroundColor: 'rgba(52, 199, 89, 0.08)'
                    }
                  }}
                >
                  Plan d'abonnement
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<RestoreIcon />}
                onClick={handleResetPreferences}
                disabled={!hasChanges}
                sx={{
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 500
                }}
              >
                Remettre à zéro
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSavePreferences}
                disabled={!hasChanges || isSaving}
                sx={{
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 500,
                  px: 3
                }}
              >
                {isSaving ? 'Sauvegarde...' : 'Enregistrer'}
              </Button>
            </Box>
          </Box>
          
          {/* Indicateur de changements */}
          {hasChanges && (
            <Alert 
              severity="info" 
              sx={{ 
                backgroundColor: 'rgba(0, 122, 255, 0.08)',
                border: '1px solid rgba(0, 122, 255, 0.2)',
                borderRadius: '8px',
                '& .MuiAlert-icon': {
                  color: '#007AFF'
                },
                '& .MuiAlert-message': {
                  color: '#1d1d1f'
                }
              }}
            >
              <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                Vous avez des modifications non sauvegardées. Cliquez sur "Enregistrer" pour les appliquer.
              </Typography>
            </Alert>
          )}
        </Box>

        {/* Grille des notifications */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {notificationTypes.map((type, index) => (
            <Grid item xs={12} md={6} key={type.key}>
              <Fade in timeout={300 + index * 100}>
                <Card 
                  elevation={0}
                  sx={{
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                    height: '100%',
                    transition: 'all 0.2s ease-in-out',
                    cursor: 'pointer',
                    '&:hover': {
                      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
                      transform: 'translateY(-2px)'
                    }
                  }}
                  onClick={() => handlePreferenceChange(type.key, !localPreferences.types[type.key as keyof typeof localPreferences.types])}
                >
                  <CardContent sx={{ p: '24px !important' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar 
                          sx={{ 
                            bgcolor: alpha(type.color, 0.1),
                            color: type.color,
                            width: 48,
                            height: 48
                          }}
                        >
                          {React.cloneElement(type.icon as React.ReactElement, {
                            sx: { fontSize: 24 }
                          })}
                        </Avatar>
                        <Box>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              fontWeight: 600,
                              color: '#1d1d1f',
                              fontSize: '1.1rem',
                              mb: 0.5
                            }}
                          >
                            {type.label}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: 'text.secondary',
                        fontSize: '0.9rem',
                        lineHeight: 1.5,
                        mb: 3
                      }}
                    >
                      {type.description}
                    </Typography>

                    {/* Switch */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={localPreferences.types[type.key as keyof typeof localPreferences.types]}
                            onChange={(e) => {
                              e.stopPropagation();
                              handlePreferenceChange(type.key, e.target.checked);
                            }}
                            sx={{
                              '& .MuiSwitch-switchBase': {
                                color: '#D1D1D6',
                                '&.Mui-checked': {
                                  color: type.color,
                                  '& + .MuiSwitch-track': {
                                    backgroundColor: type.color,
                                  },
                                },
                              },
                              '& .MuiSwitch-track': {
                                backgroundColor: '#D1D1D6',
                                height: 8,
                                borderRadius: 4,
                              },
                              '& .MuiSwitch-thumb': {
                                width: 20,
                                height: 20,
                              },
                            }}
                          />
                        }
                        label=""
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Fade>
            </Grid>
          ))}
        </Grid>

        {/* Note informative */}
        <Fade in timeout={800}>
          <Alert 
            severity="info" 
            sx={{ 
              backgroundColor: 'rgba(0, 122, 255, 0.08)',
              border: '1px solid rgba(0, 122, 255, 0.2)',
              borderRadius: '12px',
              '& .MuiAlert-icon': {
                color: '#007AFF'
              },
              '& .MuiAlert-message': {
                color: '#1d1d1f'
              }
            }}
          >
            <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
              Les annonces critiques et notifications urgentes peuvent toujours être envoyées pour des raisons de sécurité, même si vous les avez désactivées.
            </Typography>
          </Alert>
        </Fade>
      </Box>
    </Container>
  );
};

export default Settings; 