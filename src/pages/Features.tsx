import React from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Grid,
  AppBar,
  Toolbar,
  Button,
  keyframes,
  Tabs,
  Tab,
  Fade
} from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PeopleIcon from '@mui/icons-material/People';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import DescriptionIcon from '@mui/icons-material/Description';
import SecurityIcon from '@mui/icons-material/Security';
import HistoryIcon from '@mui/icons-material/History';
import EditIcon from '@mui/icons-material/Edit';
import ReceiptIcon from '@mui/icons-material/Receipt';
import BusinessIcon from '@mui/icons-material/Business';
import GroupIcon from '@mui/icons-material/Group';
import TimelineIcon from '@mui/icons-material/Timeline';
import FilterListIcon from '@mui/icons-material/FilterList';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import BarChartIcon from '@mui/icons-material/BarChart';
import SearchIcon from '@mui/icons-material/Search';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import InputIcon from '@mui/icons-material/Input';
import WorkIcon from '@mui/icons-material/Work';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SchoolIcon from '@mui/icons-material/School';
import SettingsIcon from '@mui/icons-material/Settings';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import LockIcon from '@mui/icons-material/Lock';
import VpnKeyIcon from '@mui/icons-material/VpnKey';

// Animations inspirées de Home.tsx
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const gradientFlow = keyframes`
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
`;

const features = [
  {
    title: "Gestion des Missions",
    description: [
      {
        icon: <AssignmentIcon sx={{ color: '#1976d2', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Statut, dates, budget et candidatures visibles en un coup d'œil",
        detail: "Accédez instantanément à toutes les informations essentielles de chaque mission sur une seule page."
      },
      {
        icon: <EditIcon sx={{ color: '#ff9800', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Modifications des données de la mission en un clic",
        detail: "Modifiez rapidement toutes les informations d'une mission sans quitter la page."
      },
      {
        icon: <ImportExportIcon sx={{ color: '#43a047', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Import/Export Excel en un clic",
        detail: "Importez vos anciennes missions ou exportez vos données pour un suivi simplifié et une transition sans effort."
      },
      {
        icon: <DescriptionIcon sx={{ color: '#fbc02d', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Documents générés automatiquement (PC, contrats, factures)",
        detail: "Générez et téléchargez tous les documents nécessaires en quelques secondes, sans ressaisie."
      },
      {
        icon: <ReceiptIcon sx={{ color: '#7e57c2', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Suivi des factures et gestion des notes de frais",
        detail: "Gardez un œil sur la facturation et gérez facilement les notes de frais associées à chaque mission."
      },
      {
        icon: <AccessTimeIcon sx={{ color: '#8e24aa', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Suivi en temps réel des heures et dépenses",
        detail: "Visualisez l'avancement, les heures réalisées et les notes de frais pour chaque mission, en temps réel."
      },
      {
        icon: <SecurityIcon sx={{ color: '#0288d1', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Accès et permissions maîtrisés",
        detail: "Contrôlez précisément qui peut voir ou modifier chaque mission grâce à une gestion fine des droits."
      },
      {
        icon: <HistoryIcon sx={{ color: '#ff7043', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Historique détaillé des actions",
        detail: "Retrouvez toutes les modifications et actions passées pour un suivi complet et transparent."
      }
    ],
    image: "/images/features/gestionmission.png",
    reverse: false
  },
  {
    title: "Suivi Commercial",
    description: [
      {
        icon: <TimelineIcon sx={{ color: '#1976d2', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Pipeline visuel de prospection",
        detail: "Gérez vos prospects et clients dans un pipeline Kanban intuitif, suivez chaque étape du cycle commercial."
      },
      {
        icon: <BusinessIcon sx={{ color: '#43a047', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Centralisation des informations entreprises",
        detail: "Retrouvez toutes les données clés de vos entreprises et contacts en un seul endroit."
      },
      {
        icon: <GroupIcon sx={{ color: '#8e24aa', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Affectation des prospects à l'équipe",
        detail: "Répartissez les prospects entre les membres de votre équipe pour un suivi optimal."
      },
      {
        icon: <HistoryEduIcon sx={{ color: '#fbc02d', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Historique des interactions",
        detail: "Gardez la trace de tous les échanges : emails, appels, messages LinkedIn, notes, etc."
      },
      {
        icon: <FilterListIcon sx={{ color: '#0288d1', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Filtres et recherche avancée",
        detail: "Trouvez rapidement un prospect ou une entreprise grâce à des filtres puissants et une recherche intelligente."
      },
      {
        icon: <AssignmentIndIcon sx={{ color: '#ff9800', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Suivi des relances et rappels",
        detail: "Planifiez et suivez vos relances pour ne jamais rater une opportunité."
      },
      {
        icon: <BarChartIcon sx={{ color: '#ff7043', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Statistiques et reporting",
        detail: "Analysez vos performances commerciales avec des tableaux de bord et indicateurs clairs."
      },
      {
        icon: <CloudUploadIcon sx={{ color: '#1976d2', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Importation des prospects manuellement ou depuis l'API",
        detail: "Ajoutez vos prospects un par un ou importez-les en masse grâce à l'intégration API."
      }
    ],
    image: "/images/features/prospects.png",
    reverse: false
  },
  {
    title: "Extension LinkedIn",
    description: [
      {
        icon: <LinkedInIcon sx={{ color: '#1976d2', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Importation automatique de prospects depuis LinkedIn",
        detail: "Ajoutez en un clic les profils LinkedIn visités à votre base de prospects."
      },
      {
        icon: <PersonAddIcon sx={{ color: '#43a047', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Ajout rapide de contacts",
        detail: "Enregistrez instantanément les coordonnées et informations clés des prospects."
      },
      {
        icon: <InputIcon sx={{ color: '#8e24aa', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Remplissage automatique des fiches prospects",
        detail: "Les champs sont pré-remplis grâce à l'analyse intelligente du profil LinkedIn."
      },
      {
        icon: <AutoFixHighIcon sx={{ color: '#fbc02d', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Détection intelligente des informations",
        detail: "L'extension extrait automatiquement noms, entreprises, postes, et plus encore."
      },
      {
        icon: <SyncAltIcon sx={{ color: '#0288d1', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Synchronisation avec la plateforme",
        detail: "Les prospects ajoutés sont instantanément synchronisés avec votre CRM."
      },
      {
        icon: <SecurityIcon sx={{ color: '#ff7043', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Sécurité et respect de la vie privée",
        detail: "Aucune donnée n'est collectée sans votre consentement, tout est sécurisé."
      }
    ],
    image: "/images/features/linkedin.png",
    reverse: true
  },
  {
    title: "Recrutement",
    description: [
      {
        icon: <WorkIcon sx={{ color: '#1976d2', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Publication et diffusion des missions",
        detail: "Publiez vos missions en quelques clics et gérez leur visibilité pour les étudiants."
      },
      {
        icon: <AssignmentIndIcon sx={{ color: '#43a047', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Gestion des candidatures",
        detail: "Suivez l'état des candidatures (En attente, Acceptée, Refusée) et gérez les dossiers des étudiants."
      },
      {
        icon: <DescriptionIcon sx={{ color: '#8e24aa', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Validation des dossiers",
        detail: "Vérifiez les CV et lettres de motivation, validez les dossiers complets avant l'embauche."
      },
      {
        icon: <AccessTimeIcon sx={{ color: '#fbc02d', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Suivi des heures de travail",
        detail: "Enregistrez et validez les heures travaillées, gérez les pauses et les plannings."
      },
      {
        icon: <CheckCircleIcon sx={{ color: '#0288d1', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Validation des notes de frais",
        detail: "Gérez et validez les notes de frais des étudiants avec pièces justificatives."
      },
      {
        icon: <PictureAsPdfIcon sx={{ color: '#ff7043', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Génération automatique des documents",
        detail: "Créez contrats, factures et attestations en quelques clics avec vos templates personnalisés."
      }
    ],
    image: "/images/features/recrutement.png",
    reverse: true
  },
  {
    title: "Documents Personnalisés",
    description: [
      {
        icon: <DescriptionIcon sx={{ color: '#1976d2', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Templates personnalisables",
        detail: "Créez et modifiez vos templates de documents (contrats, factures, attestations) avec votre charte graphique."
      },
      {
        icon: <EditIcon sx={{ color: '#43a047', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Éditeur visuel de documents",
        detail: "Positionnez et formatez les champs variables directement sur le PDF avec un éditeur intuitif."
      },
      {
        icon: <SettingsIcon sx={{ color: '#8e24aa', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Gestion des variables",
        detail: "Utilisez des variables dynamiques (mission, étudiant, entreprise) qui se remplissent automatiquement."
      },
      {
        icon: <PictureAsPdfIcon sx={{ color: '#fbc02d', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Génération instantanée",
        detail: "Générez vos documents en un clic avec les données à jour de vos missions et candidats."
      },
      {
        icon: <AssignmentIcon sx={{ color: '#0288d1', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Assignation par type",
        detail: "Définissez des templates par défaut pour chaque type de document (contrat, facture, etc.)."
      },
      {
        icon: <AutoFixHighIcon sx={{ color: '#ff7043', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Formatage intelligent",
        detail: "Ajustez automatiquement la mise en page, la taille des polices et l'espacement du texte."
      }
    ],
    image: "/images/features/template.png",
    reverse: true
  },
  {
    title: "Conformité RGPD",
    description: [
      {
        icon: <SecurityIcon sx={{ color: '#1976d2', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Sécurité des données",
        detail: "Protection des données sensibles avec chiffrement et stockage sécurisé sur des serveurs européens."
      },
      {
        icon: <VerifiedUserIcon sx={{ color: '#43a047', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Gestion des consentements",
        detail: "Traçabilité des consentements et des autorisations pour le traitement des données personnelles."
      },
      {
        icon: <DeleteForeverIcon sx={{ color: '#8e24aa', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Droit à l'oubli",
        detail: "Suppression complète des données personnelles sur simple demande, conformément au RGPD."
      },
      {
        icon: <LockIcon sx={{ color: '#fbc02d', fontSize: 28, mr: 1, transition: 'color 0.3s' }} />,
        title: "Contrôle d'accès",
        detail: "Gestion fine des permissions pour garantir que seules les personnes autorisées accèdent aux données."
      }
    ],
    image: "/images/features/RGPD.png",
    reverse: false
  }
];

const Features: React.FC = () => {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = React.useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
  };

  const handleContactClick = () => {
    navigate('/');
    setTimeout(() => {
      const contactSection = document.getElementById('contact');
      if (contactSection) {
        contactSection.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, 800);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fff', pt: { xs: 8, md: 12 }, pb: { xs: 8, md: 12 } }}>
      <AppBar 
        position="fixed" 
        elevation={0} 
        sx={{ 
          bgcolor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            bgcolor: 'rgba(255, 255, 255, 0.95)',
          }
        }}
      >
        <Toolbar sx={{ minHeight: '56px !important', py: 1.2, pl: 4 }}>
          <Box
            component="img"
            src="/images/logo.png"
            alt="JS Connect Logo"
            sx={{
              height: 24,
              mr: 4,
              transition: 'transform 0.3s ease',
              '&:hover': {
                transform: 'scale(1.05)'
              }
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 8 }}>
            <Button
              onClick={() => handleNavigation('/')}
              sx={{
                color: '#1d1d1f',
                fontWeight: 400,
                fontSize: '0.95rem',
                textTransform: 'none',
                px: 1.5,
                transition: 'font-weight 0.2s',
                '&:hover': {
                  color: '#1d1d1f',
                  fontWeight: 600,
                  opacity: 0.8
                }
              }}
            >
              Accueil
            </Button>
            <Button
              onClick={() => handleNavigation('/features')}
              sx={{
                color: '#1d1d1f',
                fontWeight: 400,
                fontSize: '0.95rem',
                textTransform: 'none',
                px: 1.5,
                transition: 'font-weight 0.2s',
                '&:hover': {
                  color: '#1d1d1f',
                  fontWeight: 600,
                  opacity: 0.8
                }
              }}
            >
              Fonctionnalités
            </Button>
            <Button
              onClick={() => handleNavigation('/pricing')}
              sx={{
                color: '#1d1d1f',
                fontWeight: 400,
                fontSize: '0.95rem',
                textTransform: 'none',
                px: 1.5,
                transition: 'font-weight 0.2s',
                '&:hover': {
                  color: '#1d1d1f',
                  fontWeight: 600,
                  opacity: 0.8
                }
              }}
            >
              Tarifs
            </Button>
            <Button
              onClick={handleContactClick}
              sx={{
                color: '#1d1d1f',
                fontWeight: 400,
                fontSize: '0.95rem',
                textTransform: 'none',
                px: 1.5,
                transition: 'font-weight 0.2s',
                '&:hover': {
                  color: '#1d1d1f',
                  fontWeight: 600,
                  opacity: 0.8
                }
              }}
            >
              Contact
            </Button>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              onClick={() => handleNavigation('/login')}
              variant="outlined"
              sx={{
                color: '#000',
                borderColor: '#000',
                fontWeight: 400,
                fontSize: '0.85rem',
                textTransform: 'none',
                borderRadius: '20px',
                px: 3,
                '&:hover': {
                  borderColor: '#000',
                  bgcolor: '#000',
                  color: '#fff'
                }
              }}
            >
              Connexion
            </Button>
            <Button
              onClick={() => handleNavigation('/register')}
              variant="contained"
              sx={{
                bgcolor: '#000',
                color: '#fff',
                fontWeight: 400,
                fontSize: '0.85rem',
                textTransform: 'none',
                borderRadius: '20px',
                px: 3,
                '&:hover': {
                  bgcolor: '#000',
                  opacity: 0.9
                }
              }}
            >
              Inscription
            </Button>
          </Box>
        </Toolbar>
      </AppBar>
      {/* Décalage pour la navbar fixe */}
      <Box sx={{ height: { xs: 72, md: 88 } }} />
      <Container maxWidth="xl" sx={{ px: { xs: 2, md: 12 } }}>
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: '2.5rem', md: '3.5rem' },
            fontWeight: 600,
            textAlign: 'center',
            mb: { xs: 2, md: 4 },
            color: '#1d1d1f',
            letterSpacing: '-0.02em',
            animation: `${fadeIn} 1s ease-out`,
            background: 'linear-gradient(45deg, #000 30%, #333 90%)',
            backgroundClip: 'text',
            textFillColor: 'transparent',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          Fonctionnalités
        </Typography>
      </Container>
      <Box sx={{ width: '100vw', position: 'relative', left: '50%', right: '50%', ml: '-50vw', mr: '-50vw', px: { xs: 2, md: 12 }, bgcolor: '#fff' }}>
        <Tabs
          value={selectedTab}
          onChange={handleTabChange}
          centered
          variant="fullWidth"
          sx={{
            mb: 4,
            '.MuiTab-root': {
              fontWeight: 500,
              fontSize: { xs: '1rem', md: '1.1rem' },
              textTransform: 'none',
              color: '#86868b',
              minWidth: 120,
              px: 4
            },
            '.Mui-selected': {
              color: '#1d1d1f',
            },
            '.MuiTabs-indicator': {
              bgcolor: '#000',
              height: 3,
              borderRadius: 2
            }
          }}
        >
          {features.map((feature, idx) => (
            <Tab key={feature.title} label={feature.title} />
          ))}
        </Tabs>
      </Box>
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 8 } }}>
        <Fade in={true} timeout={500}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              p: { xs: 2, md: 6 },
              bgcolor: 'transparent',
              borderRadius: 0,
              boxShadow: 'none',
              minHeight: 420,
              mb: 6,
              width: '100%'
            }}
          >
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: '1.5rem', md: '2.2rem' },
                fontWeight: 600,
                mb: 2,
                color: '#1d1d1f',
                letterSpacing: '-0.02em',
                textAlign: 'center'
              }}
            >
              {features[selectedTab].title}
            </Typography>
            {Array.isArray(features[selectedTab].description) ? (
              <Grid container spacing={3} sx={{ maxWidth: 1200, mx: 'auto', mt: 2, px: { xs: 0, md: 2 } }}>
                {features[selectedTab].description.map((item, subIndex) => (
                  <Grid item xs={12} md={6} key={subIndex}>
                    <Fade in={true} style={{ transitionDelay: `${subIndex * 100}ms` }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2, transition: 'box-shadow 0.3s', '&:hover .feature-icon': { color: '#111' } }}>
                        <Box className="feature-icon" sx={{ display: 'flex', alignItems: 'center' }}>{item.icon}</Box>
                        <Box>
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 500, color: '#222', fontSize: '1.08rem' }}
                          >
                            {item.title}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: '#86868b', fontSize: '1rem', mt: 0.5 }}
                          >
                            {item.detail}
                          </Typography>
                        </Box>
                      </Box>
                    </Fade>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Typography
                variant="body1"
                sx={{
                  fontSize: { xs: '1.1rem', md: '1.2rem' },
                  lineHeight: 1.6,
                  color: '#86868b',
                  mb: 3
                }}
              >
                {typeof features[selectedTab].description === 'string' ? features[selectedTab].description : ''}
              </Typography>
            )}
            <Box
              component="img"
              src={features[selectedTab].image}
              alt={features[selectedTab].title}
              sx={{
                width: '100%',
                height: 'auto',
                maxWidth: 900,
                mx: 'auto',
                mb: 2,
                mt: 6
              }}
            />
          </Box>
        </Fade>
      </Container>
      <Footer />
    </Box>
  );
};

export default Features; 