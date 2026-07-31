import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  IconButton,
  Chip,
  styled,
  alpha,
  Slide
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import {
  Close as CloseIcon,
  AutoAwesome as NewIcon,
  CheckCircle as CheckCircleIcon,
  People as PeopleIcon,
  Event as EventIcon,
  PersonAdd as PersonAddIcon,
  Transform as TransformIcon,
  Schedule as ScheduleIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import { tokens } from '../theme/tokens';

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: tokens.radius.lg,
    maxWidth: '900px',
    width: '90%',
    maxHeight: '90vh',
    background: theme.palette.background.paper,
    overflow: 'hidden'
  }
}));

const FeatureCard = styled(Card)(({ theme }) => ({
  height: '100%',
  borderRadius: tokens.radius.md,
  transition: 'all 0.3s ease',
  background: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[4],
    border: `1px solid ${theme.palette.primary.main}`
  }
}));

const IconWrapper = styled(Box)(({ theme }) => ({
  width: '56px',
  height: '56px',
  borderRadius: tokens.radius.md,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: theme.spacing(2),
  background: tokens.gradients.brand,
  boxShadow: `0 4px 12px ${tokens.colors.primaryAlpha20}`,
  '& .MuiSvgIcon-root': {
    fontSize: '32px',
    color: 'white'
  }
}));

const AmbassadorIconWrapper = styled(IconWrapper)({
  background: 'linear-gradient(135deg, #21BDA3 0%, #178873 100%)',
  boxShadow: '0 4px 12px rgba(33, 189, 163, 0.3)'
});

const EventIconWrapper = styled(IconWrapper)({
  background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  boxShadow: '0 4px 12px rgba(79, 172, 254, 0.3)'
});

interface ChangelogDialogProps {
  open: boolean;
  onClose: () => void;
}

const ChangelogDialog: React.FC<ChangelogDialogProps> = ({ open, onClose }) => {
  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      TransitionComponent={Transition}
      transitionDuration={{
        enter: 400,
        exit: 300
      }}
    >
      <DialogTitle sx={{ 
            pb: 1, 
            pt: 3,
            background: 'none',
            position: 'relative'
          }}>
            <IconButton
              onClick={onClose}
              sx={{
                position: 'absolute',
                right: 16,
                top: 16,
                color: 'grey.600',
                transition: 'all 0.2s',
                '&:hover': {
                  color: 'grey.800',
                  transform: 'rotate(90deg)',
                  background: 'rgba(0,0,0,0.05)'
                }
              }}
            >
              <CloseIcon />
            </IconButton>
            
            <Box sx={{ textAlign: 'center', mb: 1 }}>
              <Chip
                icon={<NewIcon />}
                label="Nouveautés"
                color="primary"
                sx={{
                  mb: 2,
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  background: tokens.gradients.brand,
                  color: 'white',
                  boxShadow: `0 4px 12px ${tokens.colors.primaryAlpha20}`
                }}
              />
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  color: tokens.colors.textPrimary,
                  mb: 1
                }}
              >
                Découvrez les nouvelles fonctionnalités
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Votre plateforme JS Connect vient de s'améliorer !
              </Typography>
            </Box>
          </DialogTitle>

          <DialogContent sx={{ pt: 2, pb: 3 }}>
            <Grid container spacing={3}>
              {/* Module Ambassadeurs */}
              <Grid item xs={12} md={6}>
                <FeatureCard elevation={0}>
                  <CardContent sx={{ p: 3 }}>
                    <AmbassadorIconWrapper>
                      <PeopleIcon />
                    </AmbassadorIconWrapper>
                    
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                      Module Ambassadeurs
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Gestion complète des événements et ambassadeurs
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <EventIcon sx={{ fontSize: 20, color: 'primary.main', mt: 0.2 }} />
                        <Typography variant="body2">
                          <strong>Création d'événements</strong> : Organisez vos salons et événements ambassadeurs
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <PersonAddIcon sx={{ fontSize: 20, color: 'primary.main', mt: 0.2 }} />
                        <Typography variant="body2">
                          <strong>Gestion des ambassadeurs</strong> : Invitez et gérez vos ambassadeurs facilement
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <ScheduleIcon sx={{ fontSize: 20, color: 'primary.main', mt: 0.2 }} />
                        <Typography variant="body2">
                          <strong>Horaires détaillés</strong> : Gestion jour par jour avec pauses
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <TransformIcon sx={{ fontSize: 20, color: 'primary.main', mt: 0.2 }} />
                        <Typography variant="body2">
                          <strong>Conversion en mission</strong> : Transformez vos événements en missions standard
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ 
                      mt: 2, 
                      pt: 2, 
                      borderTop: 1, 
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}>
                      <NewIcon sx={{ fontSize: 18, color: 'success.main' }} />
                      <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                        Accédez via le menu Ambassadeurs
                      </Typography>
                    </Box>
                  </CardContent>
                </FeatureCard>
              </Grid>

              {/* Détails Événements Ambassadeurs */}
              <Grid item xs={12} md={6}>
                <FeatureCard elevation={0}>
                  <CardContent sx={{ p: 3 }}>
                    <EventIconWrapper>
                      <EventIcon />
                    </EventIconWrapper>
                    
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                      Détails Événements Ambassadeurs
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Gestion avancée des candidatures et événements
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <PeopleIcon sx={{ fontSize: 20, color: 'info.main', mt: 0.2 }} />
                        <Typography variant="body2">
                          <strong>Candidatures</strong> : Acceptez/refusez avec CV et lettre de motivation
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <PersonAddIcon sx={{ fontSize: 20, color: 'info.main', mt: 0.2 }} />
                        <Typography variant="body2">
                          <strong>Ajout manuel</strong> : Ajoutez des ambassadeurs directement à un créneau
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <LocationIcon sx={{ fontSize: 20, color: 'info.main', mt: 0.2 }} />
                        <Typography variant="body2">
                          <strong>Statistiques</strong> : Capacité, taux de remplissage en temps réel
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <CheckCircleIcon sx={{ fontSize: 20, color: 'info.main', mt: 0.2 }} />
                        <Typography variant="body2">
                          <strong>Validation de dossier</strong> : Suivi du statut de validation
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ 
                      mt: 2, 
                      pt: 2, 
                      borderTop: 1, 
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}>
                      <NewIcon sx={{ fontSize: 18, color: 'success.main' }} />
                      <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                        Cliquez sur un événement pour voir les détails
                      </Typography>
                    </Box>
                  </CardContent>
                </FeatureCard>
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 3, pt: 0 }}>
            <Button
              onClick={onClose}
              variant="contained"
              size="large"
              fullWidth
              sx={{
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: tokens.radius.md,
                boxShadow: tokens.shadows.button,
                transition: tokens.transitions.default,
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: tokens.shadows.lg,
                }
              }}
            >
              C'est parti ! 🚀
            </Button>
          </DialogActions>
    </StyledDialog>
  );
};

export default ChangelogDialog;

