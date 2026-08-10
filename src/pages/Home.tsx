import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getFirebaseFunctions } from '../firebase/config';
import { httpsCallable } from 'firebase/functions';
import PageMeta from '../components/common/PageMeta';
import PublicNav from '../components/layout/PublicNav';
import { 
  Box, 
  Container, 
  Typography, 
  Button, 
  Grid, 
  Card, 
  CardContent,
  TextField,
  useTheme,
  useMediaQuery,
  Snackbar,
  Alert,
  Dialog,
  DialogContent
} from '@mui/material';
import { 
  Security, 
  Speed, 
  Business,
  People,
  Assignment,
  RocketLaunch,
  School,
  Euro,
  Schedule,
  TrendingUp,
  Receipt,
  VerifiedUser,
} from '@mui/icons-material';
import Footer from '../components/Footer';
import { tokens } from '../theme/tokens';
import { fadeIn } from '../styles/animations';

// Animations

// Configuration du contenu par profil
type ProfileType = 'junior' | 'company' | 'student' | null;

interface ProfileContent {
  title: string;
  subtitle: string;
  cta: string;
  ctaAction: () => void;
  features: Array<{
    title: string;
    description: string;
    icon: JSX.Element;
  }>;
  steps: Array<{
    title: string;
    description: string;
  }>;
}

const contentByProfile: Record<NonNullable<ProfileType>, ProfileContent> = {
  junior: {
    title: "Pilotez votre Junior de A à Z",
    subtitle: "Une gestion boostée à l'IA. La solution tout-en-un pour la gestion, le recrutement et la conformité de votre structure.",
    cta: "Gratuit jusqu'à 3 missions ou études, et 10 signatures",
    ctaAction: () => {
      window.location.href = '/pricing';
    },
    features: [
      {
        title: "Gestion des missions",
    description: "Optimisez la gestion de vos missions étudiantes avec notre plateforme dédiée aux Juniors.",
    icon: <Assignment sx={{ fontSize: 40, color: tokens.colors.marketingBlack }} />
  },
  {
        title: "Recrutement simplifié",
    description: "Trouvez et gérez vos étudiants en mission en quelques clics grâce à notre système de matching intelligent.",
    icon: <People sx={{ fontSize: 40, color: tokens.colors.marketingBlack }} />
  },
  {
    title: "Conformité RGPD",
    description: "Une solution 100% conforme aux normes françaises et européennes pour la gestion de vos données.",
    icon: <Security sx={{ fontSize: 40, color: tokens.colors.marketingBlack }} />
  }
    ],
    steps: [
  {
    title: "Créez votre espace",
    description: "Inscription rapide et personnalisation de votre espace Junior en quelques minutes"
  },
  {
    title: "Gérez vos missions",
    description: "Publiez et suivez vos missions étudiantes en temps réel avec notre interface intuitive"
  },
  {
    title: "Sécurité & Conformité",
    description: "Bénéficiez d'une solution 100% RGPD et sécurisée pour la gestion de vos données sensibles"
  },
  {
    title: "Extension LinkedIn pilotée par l'IA",
    description: "L'extension Chrome de prospection LinkedIn est pilotée par l'IA pour détecter les meilleurs prospects. Développez votre réseau de clients grâce à notre extension LinkedIn dédiée aux juniors"
  },
  {
    title: "Suivi Commercial",
    description: "Pilotez votre activité avec des tableaux de bord et des indicateurs de performance"
  },
  {
    title: "Documents Personnalisés",
    description: "Générez des documents 100% personnalisés avec votre charte graphique et vos informations"
  }
    ]
  },
  company: {
    title: "Accédez aux meilleurs talents étudiants",
    subtitle: "Confiez vos missions ponctuelles à des étudiants qualifiés via les juniors. Simple, rapide, légal.",
    cta: "Déposer une mission",
    ctaAction: () => {
      const contactSection = document.getElementById('contact');
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    features: [
      {
        title: "Facturation simplifiée",
        description: "Une seule facture pour toutes vos missions, sans complexité administrative supplémentaire.",
        icon: <Receipt sx={{ fontSize: 40, color: tokens.colors.marketingBlack }} />
      },
      {
        title: "Profils sélectifs",
        description: "Accédez à des étudiants triés sur le volet, formés et encadrés par les juniors.",
        icon: <VerifiedUser sx={{ fontSize: 40, color: tokens.colors.marketingBlack }} />
      },
      {
        title: "Réactivité",
        description: "Bénéficiez d'une réponse rapide et d'une mise en relation efficace avec les meilleurs profils.",
        icon: <Speed sx={{ fontSize: 40, color: tokens.colors.marketingBlack }} />
      }
    ],
    steps: [
      {
        title: "Déposez votre besoin",
        description: "Décrivez votre mission en quelques clics via notre formulaire simplifié"
      },
      {
        title: "Recevez des propositions",
        description: "Les juniors vous proposent des étudiants qualifiés pour votre projet"
      },
      {
        title: "Validez et lancez",
        description: "Choisissez la meilleure proposition et démarrez votre mission en toute sérénité"
      },
      {
        title: "Suivez l'avancement",
        description: "Restez informé de l'évolution de votre mission en temps réel"
      },
      {
        title: "Facturation unique",
        description: "Recevez une facture claire et simplifiée pour toutes vos missions"
      },
      {
        title: "Bénéficiez de la qualité",
        description: "Profitez de l'expertise et du professionnalisme des juniors"
      }
    ]
  },
  student: {
    title: "Boostez vos revenus et votre CV",
    subtitle: "Accédez à des missions rémunérées compatibles avec votre emploi du temps.",
    cta: "S'inscrire maintenant",
    ctaAction: () => {
      window.location.href = '/register?type=student';
    },
    features: [
      {
        title: "Paiement rapide",
        description: "Recevez votre rémunération rapidement et de manière sécurisée après chaque mission.",
        icon: <Euro sx={{ fontSize: 40, color: tokens.colors.marketingBlack }} />
      },
      {
        title: "Missions flexibles",
        description: "Choisissez des missions qui s'adaptent à votre emploi du temps étudiant.",
        icon: <Schedule sx={{ fontSize: 40, color: tokens.colors.marketingBlack }} />
      },
      {
        title: "Expérience pro",
        description: "Développez vos compétences et enrichissez votre CV avec des missions concrètes.",
        icon: <TrendingUp sx={{ fontSize: 40, color: tokens.colors.marketingBlack }} />
      }
    ],
    steps: [
      {
        title: "Créez votre compte",
        description: "Inscription gratuite et rapide en quelques minutes seulement"
      },
      {
        title: "Complétez votre profil",
        description: "Présentez vos compétences et vos disponibilités pour être visible"
      },
      {
        title: "Explorez les missions",
        description: "Parcourez les missions disponibles et postulez à celles qui vous intéressent"
      },
      {
        title: "Travaillez en équipe",
        description: "Rejoignez une junior et collaborez avec d'autres étudiants"
      },
      {
        title: "Développez vos compétences",
        description: "Acquérez de l'expérience professionnelle tout en gagnant de l'argent"
      },
      {
        title: "Construisez votre réseau",
        description: "Rencontrez des entreprises et développez votre réseau professionnel"
      }
    ]
  }
};

export default function Home(): JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [selectedProfile, setSelectedProfile] = useState<ProfileType>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    company: '',
    email: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });
  const contactRef = useRef<HTMLDivElement>(null);

  const currentContent = selectedProfile ? contentByProfile[selectedProfile] : null;

  // Ouvrir la modal au chargement si aucun profil n'est sélectionné
  // Une fois qu'un profil est sélectionné, il ne peut plus être changé
  useEffect(() => {
    if (!selectedProfile) {
      setProfileDialogOpen(true);
    } else {
      setProfileDialogOpen(false);
    }
  }, [selectedProfile]);

  const handleProfileSelect = (profile: NonNullable<ProfileType>) => {
    setSelectedProfile(profile);
    setProfileDialogOpen(false);
    // Sauvegarder le profil dans localStorage pour les autres pages
    localStorage.setItem('selectedProfile', profile);
  };

  // Récupérer le profil depuis localStorage au chargement
  useEffect(() => {
    const savedProfile = localStorage.getItem('selectedProfile') as ProfileType;
    if (savedProfile && ['junior', 'company', 'student'].includes(savedProfile)) {
      setSelectedProfile(savedProfile);
    }
  }, []);

  // Gérer le swipe down pour fermer la modal (seulement si aucun profil n'est sélectionné)
  useEffect(() => {
    if (profileDialogOpen && !selectedProfile) {
      let startY = 0;
      let startX = 0;
      let startTime = 0;
      let startScrollTop = 0;
      let isSwiping = false;
      let swipeStartedFromTop = false;
      const SWIPE_THRESHOLD = 70; // Distance minimale pour déclencher le swipe
      const SWIPE_VELOCITY_THRESHOLD = 0.2; // Vitesse minimale
      const SWIPE_HEADER_HEIGHT = 120; // Zone en haut où le swipe est permis

      const handleTouchStart = (e: TouchEvent) => {
        const touch = e.touches[0];
        startY = touch.clientY;
        startX = touch.clientX;
        startTime = Date.now();
        isSwiping = false;
        swipeStartedFromTop = false;

        const target = e.target as HTMLElement;
        const dialogPaper = target.closest('.MuiDialog-paper') as HTMLElement;
        const dialogContent = target.closest('.MuiDialogContent-root') as HTMLElement;
        
        if (dialogPaper) {
          const rect = dialogPaper.getBoundingClientRect();
          const relativeY = touch.clientY - rect.top;
          
          // Permettre le swipe depuis le haut de la modal (premiers 200px)
          // Peu importe la position du scroll
          if (relativeY <= SWIPE_HEADER_HEIGHT) {
            isSwiping = true;
            swipeStartedFromTop = true;
            if (dialogContent) {
              startScrollTop = dialogContent.scrollTop;
            }
          }
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!isSwiping || !swipeStartedFromTop) return;
        
        const touch = e.touches[0];
        const diffY = touch.clientY - startY;
        const diffX = Math.abs(touch.clientX - startX);
        
        const dialogContent = (e.target as HTMLElement).closest('.MuiDialogContent-root') as HTMLElement;
        const currentScrollTop = dialogContent ? dialogContent.scrollTop : 0;
        
        // Si on swipe vers le bas et que le scroll est en haut OU qu'on a déjà commencé à swiper
        if (diffY > 0 && diffY > diffX * 1.5) {
          // Si le scroll est en haut, permettre le swipe sur la modal
          if (currentScrollTop === startScrollTop || startScrollTop === 0) {
            const dialogPaper = document.querySelector('.MuiDialog-paper') as HTMLElement;
            if (dialogPaper && diffY > 10) {
              // Empêcher le scroll si on swipe depuis le haut
              if (currentScrollTop === 0 && diffY > 20) {
                e.preventDefault();
                e.stopPropagation();
              }
              
              // Appliquer une transformation visuelle pendant le swipe
              const transformY = Math.min(diffY * 0.8, 300);
              dialogPaper.style.transform = `translateY(${transformY}px)`;
              dialogPaper.style.transition = 'none';
              dialogPaper.style.opacity = `${Math.max(0.5, 1 - diffY / 400)}`;
            }
          }
        }
      };

      const handleTouchEnd = (e: TouchEvent) => {
        if (!isSwiping || !swipeStartedFromTop) return;

        const endY = e.changedTouches[0].clientY;
        const diffY = endY - startY;
        const duration = Date.now() - startTime;
        const velocity = duration > 0 ? Math.abs(diffY) / duration : 0;

        const dialogPaper = document.querySelector('.MuiDialog-paper') as HTMLElement;
        
        // Réinitialiser la transformation
        if (dialogPaper) {
          if (diffY > SWIPE_THRESHOLD || (diffY > 40 && velocity > SWIPE_VELOCITY_THRESHOLD)) {
            // Fermer la modal
            setProfileDialogOpen(false);
          } else {
            // Animer le retour
            dialogPaper.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
            dialogPaper.style.transform = '';
            dialogPaper.style.opacity = '';
            setTimeout(() => {
              if (dialogPaper) {
                dialogPaper.style.transition = '';
              }
            }, 300);
          }
        }
      };

      // Utiliser un timeout pour s'assurer que le DOM est prêt
      const timeoutId = setTimeout(() => {
        const dialogPaper = document.querySelector('.MuiDialog-paper') as HTMLElement;
        if (dialogPaper) {
          dialogPaper.addEventListener('touchstart', handleTouchStart, { passive: false });
          dialogPaper.addEventListener('touchmove', handleTouchMove, { passive: false });
          dialogPaper.addEventListener('touchend', handleTouchEnd, { passive: true });
        }

        // Écouter aussi sur le backdrop
        const backdrop = document.querySelector('.MuiBackdrop-root') as HTMLElement;
        if (backdrop) {
          backdrop.addEventListener('touchstart', handleTouchStart, { passive: false });
          backdrop.addEventListener('touchmove', handleTouchMove, { passive: false });
          backdrop.addEventListener('touchend', handleTouchEnd, { passive: true });
        }
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        const dialogPaper = document.querySelector('.MuiDialog-paper') as HTMLElement;
        if (dialogPaper) {
          dialogPaper.removeEventListener('touchstart', handleTouchStart);
          dialogPaper.removeEventListener('touchmove', handleTouchMove);
          dialogPaper.removeEventListener('touchend', handleTouchEnd);
          dialogPaper.style.transform = '';
          dialogPaper.style.transition = '';
          dialogPaper.style.opacity = '';
        }
        const backdrop = document.querySelector('.MuiBackdrop-root') as HTMLElement;
        if (backdrop) {
          backdrop.removeEventListener('touchstart', handleTouchStart);
          backdrop.removeEventListener('touchmove', handleTouchMove);
          backdrop.removeEventListener('touchend', handleTouchEnd);
        }
      };
    }
  }, [profileDialogOpen, selectedProfile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const functionsInstance = await getFirebaseFunctions();
      if (!functionsInstance) {
        throw new Error("Le service Functions n'est pas disponible");
      }
      const sendContactEmail = httpsCallable(functionsInstance, 'sendContactEmail');
      await sendContactEmail({
        company: formData.company,
        email: formData.email,
        message: formData.message
      });

      setSnackbar({
        open: true,
        message: 'Votre demande a été envoyée avec succès !',
        severity: 'success'
      });

      // Réinitialiser le formulaire
      setFormData({
        company: '',
        email: '',
        message: ''
      });
    } catch (error) {
      console.error("Erreur d'envoi:", error);
      setSnackbar({
        open: true,
        message: 'Une erreur est survenue. Veuillez réessayer.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const handleContactClick = (): void => {
    if (contactRef.current) {
      contactRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  const personaCardSx = {
    p: { xs: 2, sm: 2.5, md: 3 },
    height: '100%',
    cursor: 'pointer',
    border: `1px solid ${tokens.colors.borderSoft}`,
    borderRadius: { xs: tokens.radius.xl, md: tokens.radius.xxxl },
    bgcolor: tokens.colors.marketingWhite,
    transition: tokens.transitions.default,
    '&:hover': {
      ...(isMobile ? {} : {
        transform: 'translateY(-8px)',
        boxShadow: tokens.shadows.pop,
        '& .profile-icon': {
          color: tokens.colors.marketingBlack,
        }
      }),
      boxShadow: isMobile ? tokens.shadows.md : tokens.shadows.pop,
      borderColor: tokens.colors.borderDefault,
      '& .profile-icon': {
        color: tokens.colors.marketingBlack,
      }
    },
    '&:active': isMobile ? {
      transform: 'scale(0.98)'
    } : {}
  };

  const pillButtonSx = {
    bgcolor: tokens.colors.marketingBlack,
    color: tokens.colors.marketingWhite,
    borderRadius: tokens.radius.xxl,
    textTransform: 'none' as const,
    fontWeight: 500,
    boxShadow: 'none',
    '&:hover': {
      bgcolor: tokens.colors.marketingBlack,
      opacity: 0.9,
      boxShadow: tokens.shadows.lg,
    },
  };

  return (
    <>
    <PageMeta
      title="JS Connect — Plateforme pour Junior-Entreprises"
      description="JS Connect : plateforme SaaS pour Junior Entreprises et Job Service. Missions, prospection, documents et recrutement."
    />
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      bgcolor: tokens.colors.marketingWhite,
      margin: 0,
      padding: 0,
      position: 'relative',
      overflowX: 'hidden'
    }}>
      <PublicNav
        selectedProfile={selectedProfile ?? 'junior'}
        showPricing={selectedProfile === 'junior' || selectedProfile === null}
        onContactClick={handleContactClick}
      />

      {/* Profile Selector Modal */}
      <Dialog
        open={profileDialogOpen}
        onClose={() => {
          // Permettre la fermeture seulement si aucun profil n'est sélectionné
          if (!selectedProfile) {
            setProfileDialogOpen(false);
          }
        }}
        maxWidth="lg"
        fullWidth
        scroll="paper"
        disableScrollLock={false}
        PaperProps={{
          sx: {
            borderRadius: { xs: tokens.radius.xl, md: tokens.radius.xxxl },
            bgcolor: tokens.colors.marketingWhite,
            maxHeight: { xs: '95vh', md: '90vh' },
            m: { xs: 1, md: 2 },
            position: 'relative',
            overflow: 'hidden',
            touchAction: 'pan-y',
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }
        }}
        sx={{
          '& .MuiBackdrop-root': {
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)',
            touchAction: 'pan-y',
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none'
          },
          '& .MuiDialog-container': {
            overflow: 'hidden',
            touchAction: 'pan-y',
            alignItems: 'center',
            justifyContent: 'center'
          },
          '& .MuiDialog-paper': {
            touchAction: 'pan-y'
          }
        }}
      >
        <DialogContent 
          sx={{ 
            p: { xs: 2, sm: 3, md: 4 }, 
            pt: { xs: 2, sm: 3, md: 4 },
            overflow: 'auto',
            position: 'relative',
            maxHeight: 'calc(90vh - 48px)',
            minHeight: { xs: 'auto', md: 'calc(90vh - 48px)' },
            display: 'flex',
            flexDirection: 'column',
            touchAction: 'pan-y',
            WebkitOverflowScrolling: 'touch',
            pb: { xs: 4, md: 4 }
          }}
        >
          {/* Logo en haut à gauche */}
          <Box
            sx={{
              position: 'absolute',
              top: { xs: 8, md: 20 },
              left: { xs: 8, md: 20 },
              zIndex: 10
            }}
          >
            <Box
              component="img"
              src="/images/logo.png"
              alt="JS Connect Logo"
              sx={{
                height: { xs: 32, md: 36 },
                transition: 'transform 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.05)'
                }
              }}
            />
          </Box>
          <Container maxWidth="lg" sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: { xs: 'flex-start', md: 'center' }, minHeight: 0, pt: { xs: 0, md: 0 } }}>
            <Box sx={{ textAlign: 'center', mb: { xs: 2, sm: 3, md: 4 }, mt: { xs: 0, md: 0 }, pt: { xs: 0, md: 0 } }}>
                <Typography 
                  variant="h2" 
                  component="h1" 
                  gutterBottom 
                  sx={{ 
                    fontWeight: 600,
                    fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.5rem' },
                    lineHeight: 1.2,
                    letterSpacing: '-0.02em',
                    color: tokens.colors.ink,
                    mb: { xs: 0.5, md: 1 },
                    animation: `${fadeIn} 1s ease-out`
                  }}
                >
                  Quel est votre profil&nbsp;?
                </Typography>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: tokens.colors.inkBody,
                    fontWeight: 400,
                    fontSize: { xs: '0.85rem', sm: '0.95rem', md: '1rem' },
                    animation: `${fadeIn} 1s ease-out 0.2s both`
                  }}
                >
                  Choisissez votre profil pour découvrir une expérience personnalisée
                </Typography>
            </Box>
            <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mt: 0, mb: { xs: 2, md: 0 } }}>
              <Grid item xs={12} md={4}>
                <Card
                  elevation={0}
                  onClick={() => handleProfileSelect('junior')}
                  sx={{
                    ...personaCardSx,
                    animation: `${fadeIn} 1s ease-out 0.3s both`,
                  }}
                >
                  <Box
                    className="profile-icon"
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      mb: { xs: 1.5, md: 2 },
                      transition: tokens.transitions.default,
                      color: tokens.colors.inkMuted
                    }}
                  >
                    <RocketLaunch sx={{ fontSize: { xs: 40, sm: 48, md: 56 } }} />
                  </Box>
                  <Typography 
                    variant="h5" 
                    component="h3" 
                    textAlign="center" 
                    gutterBottom
                    sx={{ 
                      fontWeight: 600, 
                      mb: { xs: 1, md: 1.5 },
                      fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' },
                      color: tokens.colors.ink
                    }}
                  >
                    Junior
                  </Typography>
                  <Typography 
                    textAlign="center" 
                    sx={{ 
                      color: tokens.colors.inkBody, 
                      lineHeight: 1.5,
                      fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' }
                    }}
                  >
                    Gérer votre structure, gagner du temps et assurer la conformité RGPD
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card
                  elevation={0}
                  onClick={() => handleProfileSelect('company')}
                  sx={{
                    ...personaCardSx,
                    animation: `${fadeIn} 1s ease-out 0.4s both`,
                  }}
                >
                  <Box
                    className="profile-icon"
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      mb: { xs: 1.5, md: 2 },
                      transition: tokens.transitions.default,
                      color: tokens.colors.inkMuted
                    }}
                  >
                    <Business sx={{ fontSize: { xs: 40, sm: 48, md: 56 } }} />
                  </Box>
                  <Typography 
                    variant="h5" 
                    component="h3" 
                    textAlign="center" 
                    gutterBottom
                    sx={{ 
                      fontWeight: 600, 
                      mb: { xs: 1, md: 1.5 },
                      fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' },
                      color: tokens.colors.ink
                    }}
                  >
                    Entreprise
                  </Typography>
                  <Typography 
                    textAlign="center" 
                    sx={{ 
                      color: tokens.colors.inkBody, 
                      lineHeight: 1.5,
                      fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' }
                    }}
                  >
                    Trouver des talents étudiants, simplicité administrative et qualité
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card
                  elevation={0}
                  onClick={() => handleProfileSelect('student')}
                  sx={{
                    ...personaCardSx,
                    animation: `${fadeIn} 1s ease-out 0.5s both`,
                  }}
                >
                  <Box
                    className="profile-icon"
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      mb: { xs: 1.5, md: 2 },
                      transition: tokens.transitions.default,
                      color: tokens.colors.inkMuted
                    }}
                  >
                    <School sx={{ fontSize: { xs: 40, sm: 48, md: 56 } }} />
                  </Box>
                  <Typography 
                    variant="h5" 
                    component="h3" 
                    textAlign="center" 
                    gutterBottom
                    sx={{ 
                      fontWeight: 600, 
                      mb: { xs: 1, md: 1.5 },
                      fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' },
                      color: tokens.colors.ink
                    }}
                  >
                    Étudiant
                  </Typography>
                  <Typography 
                    textAlign="center" 
                    sx={{ 
                      color: tokens.colors.inkBody, 
                      lineHeight: 1.5,
                      fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' }
                    }}
                  >
                    Gagner de l'argent, flexibilité et trouver des stages/missions
                  </Typography>
                </Card>
              </Grid>
            </Grid>
          </Container>
        </DialogContent>
      </Dialog>

      {/* Hero Section - Dynamic Content */}
      {selectedProfile && currentContent && (
      <Box 
        sx={{ 
          pt: { xs: 4, md: 8 },
          pb: { xs: 8, md: 12 },
          bgcolor: tokens.colors.marketingWhite,
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  animation: `${fadeIn} 1s ease-out`,
                }}
              >
                <Typography 
                  variant="h1" 
                  component="h1" 
                  gutterBottom 
                  sx={{ 
                    fontWeight: 600,
                    fontSize: { xs: '1.75rem', sm: '2.25rem', md: '3.5rem' },
                    lineHeight: 1.2,
                    letterSpacing: '-0.02em',
                    color: tokens.colors.marketingBlack,
                  }}
                >
                    {String(currentContent?.title ?? '')}
                </Typography>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    mb: { xs: 3, md: 4 }, 
                    color: tokens.colors.inkBody,
                    fontWeight: 400,
                    lineHeight: 1.5,
                    fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.25rem' },
                    animation: `${fadeIn} 1s ease-out 0.2s both`
                  }}
                >
                    {String(currentContent?.subtitle ?? '')}
                </Typography>
                <Button
                    onClick={currentContent?.ctaAction ?? (() => {})}
                  variant="contained"
                  size="large"
                  sx={{
                    ...pillButtonSx,
                    px: { xs: 3, sm: 4 },
                    py: { xs: 1.25, sm: 1.5 },
                    fontSize: { xs: '0.95rem', sm: '1.1rem' },
                    animation: `${fadeIn} 1s ease-out 0.4s both`,
                  }}
                >
                    {String(currentContent?.cta ?? '')}
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  display: { xs: 'none', md: 'flex' },
                  justifyContent: 'center',
                }}
              >
                <Box
                  component="img"
                  src="/images/hero-illustration.png"
                  alt="Platform"
                  sx={{
                    width: '100%',
                    maxWidth: 600,
                    height: 'auto',
                    borderRadius: tokens.radius.xxxl,
                    boxShadow: tokens.shadows.xl,
                    transition: tokens.transitions.default,
                  }}
                />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>
      )}

      {/* Features Section - Dynamic Content */}
      {selectedProfile && currentContent && (
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: tokens.colors.surfaceAlt }}>
        <Container maxWidth="lg">
          <Typography 
            variant="h2" 
            component="h2" 
            textAlign="center" 
            gutterBottom
            sx={{
              fontWeight: 600,
              fontSize: { xs: '2rem', md: '2.5rem' },
              mb: 8,
              color: tokens.colors.ink,
              animation: `${fadeIn} 1s ease-out`
            }}
          >
            Pourquoi Choisir JS Connect ?
          </Typography>
          <Grid container spacing={6}>
              {currentContent.features.map((feature, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card 
                  elevation={0}
                  sx={{ 
                    height: '100%',
                    bgcolor: 'transparent',
                    transition: 'all 0.3s ease',
                    animation: `${fadeIn} 1s ease-out ${index * 0.2}s both`,
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      '& .feature-icon': {
                        transform: 'scale(1.1) rotate(5deg)'
                      }
                    }
                  }}
                >
                  <CardContent>
                    <Box 
                      className="feature-icon"
                      sx={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        mb: 3,
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {feature.icon}
                    </Box>
                    <Typography 
                      variant="h5" 
                      component="h3" 
                      textAlign="center" 
                      gutterBottom
                      sx={{ fontWeight: 600, mb: 2, color: tokens.colors.ink }}
                    >
                      {feature.title}
                    </Typography>
                    <Typography 
                      textAlign="center" 
                      sx={{ color: tokens.colors.inkBody, lineHeight: 1.6 }}
                    >
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      )}

      {/* How it works Section - Dynamic Content */}
      {selectedProfile && currentContent && (
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: tokens.colors.marketingWhite }}>
        <Container maxWidth="lg">
          <Typography 
            variant="h2" 
            component="h2" 
            textAlign="center" 
            gutterBottom
            sx={{
              fontWeight: 600,
              fontSize: { xs: '2rem', md: '2.5rem' },
              mb: 8,
              color: tokens.colors.ink,
              animation: `${fadeIn} 1s ease-out`
            }}
          >
            Comment ça marche
          </Typography>
          <Grid container spacing={4}>
              {currentContent.steps.map((step, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Box 
                  sx={{ 
                    textAlign: 'center',
                    transition: tokens.transitions.default,
                    animation: `${fadeIn} 1s ease-out ${index * 0.1}s both`,
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      '& .step-number': {
                        transform: 'scale(1.1)',
                        color: tokens.colors.marketingBlack
                      }
                    }
                  }}
                >
                  <Typography 
                    variant="h3" 
                    className="step-number"
                    sx={{ 
                      color: tokens.colors.inkMuted,
                      fontWeight: 600,
                      mb: 2,
                      transition: tokens.transitions.default
                    }}
                  >
                    {index + 1}
                  </Typography>
                  <Typography 
                    variant="h5" 
                    gutterBottom
                    sx={{ fontWeight: 600, mb: 2, color: tokens.colors.ink }}
                  >
                    {step.title}
                  </Typography>
                  <Typography sx={{ color: tokens.colors.inkBody, lineHeight: 1.6 }}>
                    {step.description}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      )}

      {/* Contact Section */}
      <Box ref={contactRef} id="contact" sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="md">
          <Typography 
            variant="h2" 
            component="h2" 
            textAlign="center" 
            gutterBottom
            sx={{
              fontWeight: 600,
              fontSize: { xs: '2rem', md: '2.5rem' },
              mb: 2,
              color: tokens.colors.ink,
              animation: `${fadeIn} 1s ease-out`
            }}
          >
            Contactez-nous
          </Typography>
          <Typography 
            variant="subtitle1" 
            textAlign="center" 
            sx={{ 
              mb: 6,
              color: tokens.colors.inkBody,
              fontSize: '1.2rem',
              animation: `${fadeIn} 1s ease-out 0.2s both`
            }}
          >
            {selectedProfile === 'junior' && "Découvrez comment JS Connect peut transformer votre junior"}
            {selectedProfile === 'company' && "Découvrez comment JS Connect peut répondre à vos besoins"}
            {selectedProfile === 'student' && "Découvrez comment JS Connect peut booster votre carrière"}
            {!selectedProfile && "Découvrez comment JS Connect peut vous accompagner"}
          </Typography>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Nom de l'entreprise"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  required
                  variant="outlined"
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      borderRadius: tokens.radius.md,
                      bgcolor: tokens.colors.surfaceAlt,
                      transition: tokens.transitions.default,
                      '&:hover': {
                        bgcolor: tokens.colors.bgSubtle,
                      }
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email professionnel"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  variant="outlined"
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      borderRadius: tokens.radius.md,
                      bgcolor: tokens.colors.surfaceAlt,
                      transition: tokens.transitions.default,
                      '&:hover': {
                        bgcolor: tokens.colors.bgSubtle,
                      }
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  required
                  multiline
                  rows={4}
                  variant="outlined"
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      borderRadius: tokens.radius.md,
                      bgcolor: tokens.colors.surfaceAlt,
                      transition: tokens.transitions.default,
                      '&:hover': {
                        bgcolor: tokens.colors.bgSubtle,
                      }
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sx={{ textAlign: 'center' }}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{
                    ...pillButtonSx,
                    px: 6,
                    py: 1.5,
                    fontSize: '1.1rem',
                    '&:disabled': {
                      bgcolor: tokens.colors.gray300,
                      color: tokens.colors.marketingWhite,
                      opacity: 1,
                    }
                  }}
                >
                  {loading ? 'Envoi en cours...' : 'Demander une démo'}
                </Button>
              </Grid>
            </Grid>
          </form>
        </Container>
      </Box>

      {createPortal(
        <Snackbar 
          open={snackbar.open} 
          autoHideDuration={6000} 
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          sx={{ zIndex: 10000 }}
        >
          <Alert 
            onClose={handleCloseSnackbar} 
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>,
        document.body
      )}

      <Footer />
    </Box>
    </>
  );
} 