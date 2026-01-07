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
  Security as SecurityIcon,
  Description as DocumentIcon,
  Extension as ExtensionIcon,
  Receipt as ReceiptIcon,
  Edit as EditIcon,
  AutoAwesome as NewIcon,
  PhoneAndroid as PhoneIcon,
  SmartToy as AIIcon,
  CloudUpload as UploadIcon,
  AttachMoney as MoneyIcon,
  DragIndicator as DragIcon,
  Business as BusinessIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

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
    borderRadius: '16px',
    maxWidth: '900px',
    width: '90%',
    maxHeight: '90vh',
    background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    overflow: 'hidden'
  }
}));

const FeatureCard = styled(Card)(({ theme }) => ({
  height: '100%',
  borderRadius: '12px',
  transition: 'all 0.3s ease',
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.5)',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
    border: '1px solid rgba(102, 126, 234, 0.3)'
  }
}));

const IconWrapper = styled(Box)(({ theme }) => ({
  width: '56px',
  height: '56px',
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: theme.spacing(2),
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
  '& .MuiSvgIcon-root': {
    fontSize: '32px',
    color: 'white'
  }
}));

const SecurityIconWrapper = styled(IconWrapper)({
  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  boxShadow: '0 4px 12px rgba(240, 147, 251, 0.3)'
});

const DocumentIconWrapper = styled(IconWrapper)({
  background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  boxShadow: '0 4px 12px rgba(79, 172, 254, 0.3)'
});

const ExtensionIconWrapper = styled(IconWrapper)({
  background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  boxShadow: '0 4px 12px rgba(67, 233, 123, 0.3)'
});

const InvoiceIconWrapper = styled(IconWrapper)({
  background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  boxShadow: '0 4px 12px rgba(250, 112, 154, 0.3)'
});

const TemplateIconWrapper = styled(IconWrapper)({
  background: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  boxShadow: '0 4px 12px rgba(48, 207, 208, 0.3)'
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
            background: 'transparent',
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
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                }}
              />
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
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
              {/* Sécurité - 2FA */}
              <Grid item xs={12} md={6}>
                <FeatureCard elevation={0}>
                  <CardContent sx={{ p: 3 }}>
                    <SecurityIconWrapper>
                      <SecurityIcon />
                    </SecurityIconWrapper>
                    
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                      Authentification à Deux Facteurs
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Sécurisez votre compte avec la 2FA
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <PhoneIcon sx={{ fontSize: 20, color: 'primary.main', mt: 0.2 }} />
                        <Typography variant="body2">
                          <strong>Google Authenticator</strong> : Protection avec codes temporaires
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <SecurityIcon sx={{ fontSize: 20, color: 'primary.main', mt: 0.2 }} />
                        <Typography variant="body2">
                          <strong>Appareils de confiance</strong> : Pas de code sur vos appareils habituels
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <PhoneIcon sx={{ fontSize: 20, color: 'primary.main', mt: 0.2 }} />
                        <Typography variant="body2">
                          <strong>Gestion à distance</strong> : Déconnectez tous les autres appareils
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
                        Activez-la dans Profil → Sécurité
                      </Typography>
                    </Box>
                  </CardContent>
                </FeatureCard>
              </Grid>

              {/* Gestion des Documents */}
              <Grid item xs={12} md={6}>
                <FeatureCard elevation={0}>
                  <CardContent sx={{ p: 3 }}>
                    <DocumentIconWrapper>
                      <DocumentIcon />
                    </DocumentIconWrapper>
                    
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                      Gestion des Documents
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Organisez tous vos fichiers facilement
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <UploadIcon sx={{ fontSize: 20, color: 'info.main', mt: 0.2 }} />
                        <Typography variant="body2">
                          <strong>Drag & Drop</strong> : Glissez-déposez vos fichiers directement
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <DocumentIcon sx={{ fontSize: 20, color: 'info.main', mt: 0.2 }} />
                        <Typography variant="body2">
                          <strong>Catégories personnalisées</strong> : Organisez comme vous voulez
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <DocumentIcon sx={{ fontSize: 20, color: 'info.main', mt: 0.2 }} />
                        <Typography variant="body2">
                          <strong>Dans les missions</strong> : Attachez des documents à chaque mission
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
                        Disponible dans chaque mission
                      </Typography>
                    </Box>
                  </CardContent>
                </FeatureCard>
              </Grid>

              {/* Extension LinkedIn IA */}
              <Grid item xs={12} md={6}>
                <FeatureCard elevation={0}>
                  <CardContent sx={{ p: 3 }}>
                    <ExtensionIconWrapper>
                      <ExtensionIcon />
                    </ExtensionIconWrapper>
                    
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                      Extension LinkedIn + IA
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Prospection LinkedIn automatisée avec Gemini AI
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <AIIcon sx={{ fontSize: 20, color: 'success.main', mt: 0.2 }} />
                        <Typography variant="body2">
                          <strong>IA Gemini</strong> : Extraction ultra-précise des profils LinkedIn
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <BusinessIcon sx={{ fontSize: 20, color: 'success.main', mt: 0.2 }} />
                        <Typography variant="body2">
                          <strong>Détection automatique</strong> : Entreprise, secteur, SIRET et toutes les données
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main', mt: 0.2 }} />
                        <Typography variant="body2">
                          <strong>Enrichissement complet</strong> : Informations professionnelles et coordonnées
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
                        Téléchargez l'extension Chrome
                      </Typography>
                    </Box>
                  </CardContent>
                </FeatureCard>
              </Grid>

              {/* Gestion des Factures */}
              <Grid item xs={12} md={6}>
                <FeatureCard elevation={0}>
                  <CardContent sx={{ p: 3 }}>
                    <InvoiceIconWrapper>
                      <ReceiptIcon />
                    </InvoiceIconWrapper>
                    
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                      Suivi des Factures
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Module complet de trésorerie et facturation
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <ReceiptIcon sx={{ fontSize: 20, color: 'warning.main', mt: 0.2 }} />
                        <Typography variant="body2">
                          <strong>4 onglets dédiés</strong> : Contrats, Paiements, Factures, Suivi
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <MoneyIcon sx={{ fontSize: 20, color: 'warning.main', mt: 0.2 }} />
                        <Typography variant="body2">
                          <strong>Statuts d'encaissement</strong> : "Envoyée", "Encaissée", "En retard"
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <ReceiptIcon sx={{ fontSize: 20, color: 'warning.main', mt: 0.2 }} />
                        <Typography variant="body2">
                          <strong>Sélection multiple</strong> : Marquez plusieurs factures d'un coup
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
                        Accédez via le menu Trésorerie
                      </Typography>
                    </Box>
                  </CardContent>
                </FeatureCard>
              </Grid>

              {/* Éditeur de Templates */}
              <Grid item xs={12}>
                <FeatureCard elevation={0}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                      <TemplateIconWrapper>
                        <EditIcon />
                      </TemplateIconWrapper>
                      
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                          Éditeur de Templates PDF Avancé
                        </Typography>
                        
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Créez et personnalisez vos documents avec un éditeur visuel puissant
                        </Typography>

                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={4}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                              <DragIcon sx={{ fontSize: 20, color: 'secondary.main', mt: 0.2 }} />
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  Drag & Drop
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Placez les variables où vous voulez sur le PDF
                                </Typography>
                              </Box>
                            </Box>
                          </Grid>

                          <Grid item xs={12} sm={4}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                              <EditIcon sx={{ fontSize: 20, color: 'secondary.main', mt: 0.2 }} />
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  Contrôle typo
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Taille, alignement, interligne personnalisables
                                </Typography>
                              </Box>
                            </Box>
                          </Grid>

                          <Grid item xs={12} sm={4}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                              <DocumentIcon sx={{ fontSize: 20, color: 'secondary.main', mt: 0.2 }} />
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  100+ balises
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Mission, User, Entreprise, Contact, etc.
                                </Typography>
                              </Box>
                            </Box>
                          </Grid>
                        </Grid>

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
                            Rendez-vous dans Templates PDF pour créer vos modèles
                          </Typography>
                        </Box>
                      </Box>
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
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5568d3 0%, #65398d 100%)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 16px rgba(102, 126, 234, 0.4)'
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

