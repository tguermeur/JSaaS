import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  AppBar,
  Toolbar,
  alpha,
  keyframes,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// Animations Apple-like
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
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

export default function Pricing(): JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();

  // Plans
  const plans = [
    {
      title: "Basique",
      subtitle: "Pour démarrer",
      price: "49.90€",
      priceSuffix: "/mois",
      button: "Souscrire",
      featured: false
    },
    {
      title: "Premium",
      subtitle: "L'essentiel pour démarrer",
      price: "199.90€",
      priceSuffix: "/mois",
      button: "Souscrire",
      featured: true
    },
    {
      title: "Customisable",
      subtitle: "Sur-mesure pour vos besoins avancés",
      price: "Sur mesure",
      priceSuffix: "",
      button: "Contactez-nous",
      featured: false
    }
  ];

  // Fonctionnalités par catégorie
  const featureCategories = [
    {
      title: 'Gestion des Missions',
      features: [
        { label: "Gestion des missions (création, suivi, archivage)", values: ["Max 2 missions simultanées", true, true] },
        { label: "Page adapté aux besoins de chaque pôle", values: [false, true, true] },
        { label: "Gestion des avenants et modifications de mission", values: [false, true, true] },
        { label: "Suivi des heures travaillées", values: [false, true, true] },
        { label: "Génération automatique de documents PDF", values: [true, true, true] },
        { label: "Documents personnalisés", values: [false, true, true] },
        { label: "Gestion des notes de frais", values: [true, true, true] },
        { label: "Publication des missions sur une page spécifique", values: [true, true, true] },
        { label: "Archivage des missions", values: [true, true, true] },
      ]
    },
    {
      title: 'Étudiants & RH',
      features: [
        { label: "Gestion des étudiants (profils, documents, validation)", values: [false, true, true] },
        { label: "Interface étudiante", values: [true, true, true] },
        { label: "Gestion des ressources humaines", values: [false, true, true] },
        { label: "Multi-utilisateurs", values: [true, true, true] },
        { label: "Gestion des droits et accès", values: [true, true, true] },
        { label: "Gestion des profils utilisateurs", values: [false, true, true] },
        { label: "Gestion des pôles et équipes", values: [true, true, true] },
      ]
    },
    {
      title: 'Entreprises & Commercial',
      features: [
        { label: "Gestion des entreprises", values: [false, true, true] },
        { label: "Recrutement intelligent", values: [false, true, true] },
        { label: "CRM personalisé avec pipeline", values: [false, true, true] },
        { label: "Extension LinkedIn", values: [false, true, true] },
      ]
    },
    {
      title: 'Sécurité & Conformité',
      features: [
        { label: "Conformité RGPD", values: [true, true, true] },
        { label: "Stockage de documents sécurisé", values: ["1 Go", "5 Go", true] },
        { label: "Historique des actions et des notes", values: [true, true, true] },
      ]
    },
    {
      title: 'Intégrations & Personnalisation',
      features: [
        { label: "API d'intégration", values: [false, false, true] },
        { label: "Import/export de données", values: [false, "Imports seulement", true] },
        { label: "Tableaux de bord personnalisés", values: [false, "Bientôt", true] },
        { label: "Système de notification avancé", values: [false, "Bientôt", true] },
        { label: "Personnalisation de la charte graphique", values: [false, false, true] },
      ]
    },
    {
      title: 'Support & Notifications',
      features: [
        { label: "Notifications (missions, rappels)", values: [true, true, true] },
        { label: "Gestion des paiements et facturation", values: [true, true, true] },
        { label: "Support", values: ["Email basique", "Email prioritaire", "Dédié"] },
      ]
    }
  ];

  // État pour gérer l'ouverture/fermeture des catégories
  const [openCategories, setOpenCategories] = useState(() =>
    featureCategories.reduce((acc, cat) => ({ ...acc, [cat.title]: true }), {})
  );

  const handleToggleCategory = (title: string) => {
    setOpenCategories(prev => ({ ...prev, [title]: !prev[title] }));
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

  // Check Apple minimaliste
  const renderCheck = (checked: boolean) => (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 32 }}>
      {checked ? (
        <Box sx={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: '1.5px solid #30D158',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'opacity 0.2s',
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6.5L5.2 8.7L9 4.5" stroke="#30D158" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Box>
      ) : (
        <Box sx={{ width: 20, height: 20 }} />
      )}
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafbfc', display: 'flex', flexDirection: 'column' }}>
      {/* Header (identique Home) */}
      <AppBar position="fixed" elevation={0} sx={{ bgcolor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', borderBottom: '1px solid #e5e5ea', transition: 'all 0.3s' }}>
        <Toolbar sx={{ minHeight: '56px !important', py: 1.2, pl: 4 }}>
          <Box component="img" src="/images/logo.png" alt="JS Connect Logo" sx={{ height: 40, mr: 4, transition: 'transform 0.3s', '&:hover': { transform: 'scale(1.05)' } }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 8 }}>
            <Button 
              onClick={() => handleNavigation('/')} 
              sx={{ color: '#1d1d1f', fontWeight: 400, fontSize: '0.95rem', textTransform: 'none', px: 1.5, '&:hover': { color: '#1d1d1f', fontWeight: 600, opacity: 0.8 } }}
            >
              Accueil
            </Button>
            <Button 
              onClick={() => handleNavigation('/features')} 
              sx={{ color: '#1d1d1f', fontWeight: 400, fontSize: '0.95rem', textTransform: 'none', px: 1.5, '&:hover': { color: '#1d1d1f', fontWeight: 600, opacity: 0.8 } }}
            >
              Fonctionnalités
            </Button>
            <Button 
              onClick={() => handleNavigation('/pricing')} 
              sx={{ color: '#1d1d1f', fontWeight: 400, fontSize: '0.95rem', textTransform: 'none', px: 1.5, '&:hover': { color: '#1d1d1f', fontWeight: 600, opacity: 0.8 } }}
            >
              Tarifs
            </Button>
            <Button 
              onClick={handleContactClick}
              sx={{ color: '#1d1d1f', fontWeight: 400, fontSize: '0.95rem', textTransform: 'none', px: 1.5, '&:hover': { color: '#1d1d1f', fontWeight: 600, opacity: 0.8 } }}
            >
              Contact
            </Button>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button 
              onClick={() => handleNavigation('/login')} 
              variant="outlined" 
              sx={{ color: '#000', borderColor: '#000', fontWeight: 400, fontSize: '0.85rem', textTransform: 'none', borderRadius: '20px', px: 3, '&:hover': { borderColor: '#000', bgcolor: '#000', color: '#fff' } }}
            >
              Connexion
            </Button>
            <Button 
              onClick={() => handleNavigation('/register')} 
              variant="contained" 
              sx={{ bgcolor: '#000', color: '#fff', fontWeight: 400, fontSize: '0.85rem', textTransform: 'none', borderRadius: '20px', px: 3, '&:hover': { bgcolor: '#000', opacity: 0.9 } }}
            >
              Inscription
            </Button>
          </Box>
        </Toolbar>
      </AppBar>
      <Box sx={{ height: 80 }} />
      {/* Titre & sous-titre */}
      <Container maxWidth="md" sx={{ textAlign: 'center', mb: 6 }}>
        <Typography variant="h2" sx={{ fontWeight: 600, fontSize: { xs: '2.7rem', md: '3.5rem' }, mb: 2, letterSpacing: '-0.03em', color: '#1d1d1f', animation: `${fadeIn} 1s` }}>
          Tarifs
        </Typography>
        <Typography variant="h5" sx={{ color: '#888', fontWeight: 400, mb: 4, fontSize: { xs: '1.15rem', md: '1.35rem' }, animation: `${fadeIn} 1s 0.2s both` }}>
          30 jours offerts, sans engagement.
        </Typography>
      </Container>
      {/* Cartes de prix */}
      <Container maxWidth="lg" sx={{ mb: 8 }}>
        <Grid container spacing={4} justifyContent="center">
          {plans.map((plan, idx) => (
            <Grid item xs={12} md={4} key={plan.title}>
              <Card
                elevation={0}
                sx={{
                  borderRadius: '28px',
                  boxShadow: '0 2px 24px 0 rgba(0,0,0,0.04)',
                  border: 'none',
                  bgcolor: '#fff',
                  p: 0,
                  minHeight: 320,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: '0 8px 32px 0 rgba(0,0,0,0.08)' },
                  animation: `${fadeIn} 1s ${0.3 + idx * 0.15}s both`
                }}
              >
                <CardContent sx={{ width: '100%', textAlign: 'center', p: 5 }}>
                  <Typography variant="h6" sx={{ color: '#888', fontWeight: 500, mb: 1, fontSize: '1.1rem', letterSpacing: '-0.01em', animation: `${fadeIn} 1s ${0.4 + idx * 0.15}s both` }}>{plan.title}</Typography>
                  <Typography variant="body2" sx={{ color: '#aaa', mb: 2, fontSize: '1rem', animation: `${fadeIn} 1s ${0.5 + idx * 0.15}s both` }}>{plan.subtitle}</Typography>
                  <Typography variant="h3" sx={{ fontWeight: 700, mb: 1, fontSize: '2.5rem', color: '#1d1d1f', animation: `${fadeIn} 1s ${0.6 + idx * 0.15}s both` }}>
                    {plan.price}
                    {plan.priceSuffix && (
                      <Typography component="span" variant="h6" sx={{ color: '#888', fontWeight: 400, fontSize: '1.1rem', ml: 1 }}>
                        {plan.priceSuffix}
                      </Typography>
                    )}
                  </Typography>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => {
                      if (plan.title === 'Customisable') {
                        handleContactClick();
                      } else {
                        // Rediriger vers l'inscription avec le plan
                        const planId = plan.title.toLowerCase() === 'basique' ? 'basic' : plan.title.toLowerCase() === 'premium' ? 'premium' : 'custom';
                        navigate(`/register?type=structure&plan=${planId}`);
                      }
                    }}
                    sx={{
                      mt: 3,
                      bgcolor: '#111',
                      color: '#fff',
                      borderRadius: '16px',
                      fontWeight: 600,
                      fontSize: '1.08rem',
                      py: 1.3,
                      textTransform: 'none',
                      boxShadow: 'none',
                      letterSpacing: '-0.01em',
                      '&:hover': { bgcolor: '#222' },
                      animation: `${fadeIn} 1s ${0.7 + idx * 0.15}s both`
                    }}
                  >
                    {plan.button}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
      {/* Tableau de comparaison épuré */}
      <Container maxWidth="lg" sx={{ mb: 10 }}>
        <Box sx={{ overflowX: 'auto', borderRadius: '20px', bgcolor: '#fff', boxShadow: '0 1px 12px 0 rgba(0,0,0,0.03)', p: { xs: 1, md: 3 }, animation: `${fadeIn} 1s 1.2s both` }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #f3f4f6' }}>
                <th style={{ textAlign: 'left', color: '#888', fontWeight: 500, padding: '16px 12px', fontSize: 17, background: 'transparent' }}>Fonctionnalités</th>
                {plans.map(plan => (
                  <th key={plan.title} style={{ textAlign: 'center', color: '#222', fontWeight: 600, padding: '16px 12px', fontSize: 17, background: 'transparent' }}>{plan.title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {featureCategories.map((cat, catIdx) => [
                <tr
                  key={cat.title}
                  style={{
                    borderTop: catIdx !== 0 ? '1px solid rgba(0,0,0,0.06)' : undefined,
                  }}
                >
                  <td
                    colSpan={1 + plans.length}
                    style={{
                      fontWeight: 600,
                      fontSize: '1.15rem',
                      padding: '24px 14px 16px',
                      color: '#1d1d1f',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {cat.title}
                  </td>
                </tr>,
                ...cat.features.map((feature, idx) => (
                  <tr key={feature.label} style={{ 
                    borderBottom: idx === cat.features.length - 1 ? 'none' : '1px solid rgba(0,0,0,0.04)',
                    animation: `${fadeIn} 0.7s ease-out`
                  }}>
                    <td style={{ 
                      color: '#444', 
                      fontWeight: 400, 
                      padding: '14px 12px', 
                      minWidth: 220, 
                      fontSize: '1.04rem', 
                      letterSpacing: '-0.01em',
                      borderBottom: idx === cat.features.length - 1 ? 'none' : '1px solid rgba(0,0,0,0.04)'
                    }}>{feature.label}</td>
                    {feature.values.map((val, i) => (
                      <td key={i} style={{ 
                        textAlign: 'center', 
                        padding: '14px 12px',
                        borderBottom: idx === cat.features.length - 1 ? 'none' : '1px solid rgba(0,0,0,0.04)'
                      }}>
                        {val === true && renderCheck(true)}
                        {val === false && renderCheck(false)}
                        {typeof val === 'string' && val !== '✔' && val !== '-' ? (
                          <Typography sx={{ color: '#888', fontWeight: 500, fontSize: '1rem' }}>{val}</Typography>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                ))
              ])}
            </tbody>
          </table>
        </Box>
      </Container>
      <Footer />
    </Box>
  );
} 