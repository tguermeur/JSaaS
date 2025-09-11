import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import emailjs from '@emailjs/browser';
import { 
  Box, 
  Container, 
  Typography, 
  Button, 
  Grid, 
  Card, 
  CardContent,
  TextField,
  IconButton,
  useTheme,
  useMediaQuery,
  AppBar,
  Toolbar,
  alpha,
  keyframes,
  Snackbar,
  Alert
} from '@mui/material';
import { 
  LinkedIn, 
  Twitter, 
  Facebook, 
  Security, 
  Speed, 
  Support, 
  CheckCircle,
  Business,
  People,
  Assignment
} from '@mui/icons-material';
import Footer from '../components/Footer';

// Animations
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

const float = keyframes`
  0% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
  100% {
    transform: translateY(0px);
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
    description: "Optimisez la gestion de vos missions étudiantes avec notre plateforme dédiée aux Job Services.",
    icon: <Assignment sx={{ fontSize: 40, color: '#000' }} />
  },
  {
    title: "Recrutement Simplifié",
    description: "Trouvez et gérez vos étudiants en mission en quelques clics grâce à notre système de matching intelligent.",
    icon: <People sx={{ fontSize: 40, color: '#000' }} />
  },
  {
    title: "Conformité RGPD",
    description: "Une solution 100% conforme aux normes françaises et européennes pour la gestion de vos données.",
    icon: <Security sx={{ fontSize: 40, color: '#000' }} />
  }
];

const steps = [
  {
    title: "Créez votre espace",
    description: "Inscription rapide et personnalisation de votre espace Job Service en quelques minutes"
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
    title: "Extension LinkedIn",
    description: "Développez votre réseau de clients grâce à notre extension LinkedIn dédiée aux Job Services"
  },
  {
    title: "Suivi Commercial",
    description: "Pilotez votre activité avec des tableaux de bord et des indicateurs de performance"
  },
  {
    title: "Documents Personnalisés",
    description: "Générez des documents 100% personnalisés avec votre charte graphique et vos informations"
  }
];

export default function Home(): JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
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
      await emailjs.send(
        'service_wd96h7i', // À remplacer par votre Service ID EmailJS
        'template_bjcdscc', // À remplacer par votre Template ID EmailJS
        {
          from_company: formData.company,
          from_email: formData.email,
          message: formData.message,
          to_email: 'teo.guermeur@gmail.com' // Votre email où vous voulez recevoir les demandes
        },
        'Hn6_ev50BvQzoNSS0' // À remplacer par votre Public Key EmailJS
      );

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

  const handleNavigation = (path: string): void => {
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#fff' }}>
      {/* Navigation Bar */}
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

      {/* Hero Section */}
      <Box 
        sx={{ 
          pt: { xs: 12, md: 16 },
          pb: { xs: 8, md: 12 },
          bgcolor: '#fff',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(45deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.05) 100%)',
            animation: `${gradientFlow} 15s ease infinite`,
            backgroundSize: '200% 200%',
            zIndex: 0
          }
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
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
                    fontSize: { xs: '2.5rem', md: '3.5rem' },
                    lineHeight: 1.2,
                    letterSpacing: '-0.02em',
                    background: 'linear-gradient(45deg, #000 30%, #333 90%)',
                    backgroundClip: 'text',
                    textFillColor: 'transparent',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  La solution complète pour les Job Services
                </Typography>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    mb: 4, 
                    color: '#666',
                    fontWeight: 400,
                    lineHeight: 1.5,
                    animation: `${fadeIn} 1s ease-out 0.2s both`
                  }}
                >
                  Optimisez la gestion de vos missions étudiantes et développez votre activité avec notre plateforme dédiée
                </Typography>
                <Button
                  component={Link}
                  to="/register"
                  variant="contained"
                  size="large"
                  sx={{
                    bgcolor: '#000',
                    color: '#fff',
                    px: 4,
                    py: 1.5,
                    borderRadius: '20px',
                    fontSize: '1.1rem',
                    fontWeight: 500,
                    transition: 'all 0.3s ease',
                    animation: `${fadeIn} 1s ease-out 0.4s both`,
                    '&:hover': {
                      bgcolor: '#333',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                    }
                  }}
                >
                  Étudiant ? Inscris-toi !
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  position: 'relative',
                  display: { xs: 'none', md: 'block' },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '100%',
                    height: '100%',
                    background: 'radial-gradient(circle at center, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0) 70%)',
                    borderRadius: '30px',
                    zIndex: 0
                  }
                }}
              >
                <Box
                  component="img"
                  src="/images/hero-illustration.png"
                  alt="Job Service Platform"
                  sx={{
                    width: '100%',
                    maxWidth: 600,
                    height: 'auto',
                    borderRadius: '24px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
                    position: 'relative',
                    zIndex: 1,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-10px)',
                      boxShadow: '0 30px 60px rgba(0,0,0,0.12)'
                    }
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(45deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.05) 100%)',
                    borderRadius: '30px',
                    filter: 'blur(20px)',
                    zIndex: 0,
                    animation: `${gradientFlow} 15s ease infinite`
                  }}
                />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#fafafa' }}>
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
              animation: `${fadeIn} 1s ease-out`
            }}
          >
            Pourquoi Choisir JS Connect ?
          </Typography>
          <Grid container spacing={6}>
            {features.map((feature, index) => (
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
                      sx={{ fontWeight: 600, mb: 2 }}
                    >
                      {feature.title}
                    </Typography>
                    <Typography 
                      textAlign="center" 
                      sx={{ color: '#666', lineHeight: 1.6 }}
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

      {/* How it works Section */}
      <Box sx={{ py: { xs: 8, md: 12 } }}>
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
              animation: `${fadeIn} 1s ease-out`
            }}
          >
            Comment ça marche
          </Typography>
          <Grid container spacing={4}>
            {steps.map((step, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Box 
                  sx={{ 
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    animation: `${fadeIn} 1s ease-out ${index * 0.1}s both`,
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      '& .step-number': {
                        transform: 'scale(1.1)',
                        color: '#000'
                      }
                    }
                  }}
                >
                  <Typography 
                    variant="h3" 
                    className="step-number"
                    sx={{ 
                      color: '#666',
                      fontWeight: 600,
                      mb: 2,
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {index + 1}
                  </Typography>
                  <Typography 
                    variant="h5" 
                    gutterBottom
                    sx={{ fontWeight: 600, mb: 2 }}
                  >
                    {step.title}
                  </Typography>
                  <Typography sx={{ color: '#666', lineHeight: 1.6 }}>
                    {step.description}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

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
              color: '#666',
              fontSize: '1.2rem',
              animation: `${fadeIn} 1s ease-out 0.2s both`
            }}
          >
            Découvrez comment JS Connect peut transformer votre Job Service
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
                      borderRadius: '12px',
                      bgcolor: '#fafafa',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        bgcolor: '#f5f5f5',
                        transform: 'translateY(-2px)'
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
                      borderRadius: '12px',
                      bgcolor: '#fafafa',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        bgcolor: '#f5f5f5',
                        transform: 'translateY(-2px)'
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
                      borderRadius: '12px',
                      bgcolor: '#fafafa',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        bgcolor: '#f5f5f5',
                        transform: 'translateY(-2px)'
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
                    bgcolor: '#000',
                    color: '#fff',
                    px: 6,
                    py: 1.5,
                    borderRadius: '20px',
                    fontSize: '1.1rem',
                    fontWeight: 500,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      bgcolor: '#333',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                    },
                    '&:disabled': {
                      bgcolor: '#ccc',
                      transform: 'none'
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

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Footer />
    </Box>
  );
} 