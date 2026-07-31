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
import PublicNav from '../components/layout/PublicNav';
import PageMeta from '../components/common/PageMeta';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { tokens } from '../theme/tokens';
import { fadeIn, float, gradientFlow } from '../styles/animations';

// Animations Apple-like

export default function Pricing(): JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();

  // Plans
  const plans = [
    {
      title: "Premium",
      promoBadge: "2 mois gratuits",
      promoValue: "Économisez 299,80€",
      price: "149,90€",
      priceSuffix: "/mois",
      priceNote: "puis 149,90€/mois",
      button: "Profiter de l'offre",
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

  // Fonctionnalités par catégorie (Premium | Customisable)
  const featureCategories = [
    {
      title: 'Gestion des Missions',
      features: [
        { label: "Gestion des missions (création, suivi, archivage)", values: [true, true] },
        { label: "Page adapté aux besoins de chaque pôle", values: [true, true] },
        { label: "Gestion des avenants et modifications de mission", values: [true, true] },
        { label: "Suivi des heures travaillées", values: [true, true] },
        { label: "Génération automatique de documents PDF", values: [true, true] },
        { label: "Documents personnalisés", values: [true, true] },
        { label: "Gestion des notes de frais", values: [true, true] },
        { label: "Publication des missions sur une page spécifique", values: [true, true] },
        { label: "Archivage des missions", values: [true, true] },
      ]
    },
    {
      title: 'Étudiants & RH',
      features: [
        { label: "Gestion des étudiants (profils, documents, validation)", values: [true, true] },
        { label: "Interface étudiante", values: [true, true] },
        { label: "Gestion des ressources humaines", values: [true, true] },
        { label: "Multi-utilisateurs", values: [true, true] },
        { label: "Gestion des droits et accès", values: [true, true] },
        { label: "Gestion des profils utilisateurs", values: [true, true] },
        { label: "Gestion des pôles et équipes", values: [true, true] },
      ]
    },
    {
      title: 'Entreprises & Commercial',
      features: [
        { label: "Gestion des entreprises", values: [true, true] },
        { label: "Recrutement intelligent", values: [true, true] },
        { label: "CRM personalisé avec pipeline", values: [true, true] },
        { label: "Extension LinkedIn", values: [true, true] },
      ]
    },
    {
      title: 'Sécurité & Conformité',
      features: [
        { label: "Conformité RGPD", values: [true, true] },
        { label: "Stockage de documents sécurisé", values: ["5 Go", true] },
        { label: "Historique des actions et des notes", values: [true, true] },
      ]
    },
    {
      title: 'Intelligence artificielle',
      features: [
        { label: "Score IA des prospects (qualification, complétude)", values: [true, true] },
        { label: "Extraction de profils LinkedIn par IA (extension)", values: [true, true] },
        { label: "Génération de documents assistée (templates dynamiques)", values: [true, true] },
        { label: "Recommandations d'actions (prochaine étape suggérée)", values: ["Bientôt", true] },
        { label: "Analyse de sentiment et d'intérêt des prospects", values: [false, true] },
      ]
    },
    {
      title: 'Intégrations & Personnalisation',
      features: [
        { label: "API d'intégration", values: [false, true] },
        { label: "Import/export de données", values: ["Imports seulement", true] },
        { label: "Tableaux de bord personnalisés", values: ["Bientôt", true] },
        { label: "Système de notification avancé", values: ["Bientôt", true] },
        { label: "Personnalisation de la charte graphique", values: [false, true] },
      ]
    },
    {
      title: 'Support & Notifications',
      features: [
        { label: "Notifications (missions, rappels)", values: [true, true] },
        { label: "Gestion des paiements et facturation", values: [true, true] },
        { label: "Support", values: ["Email prioritaire", "Dédié"] },
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
    <Box sx={{ minHeight: '100vh', bgcolor: tokens.colors.marketingWhite, display: 'flex', flexDirection: 'column' }}>
      <PageMeta title="Tarifs" description="Tarifs JS Connect : 2 mois offerts, puis abonnement flexible pour votre Junior-Entreprise." />
      <PublicNav selectedProfile="junior" onContactClick={handleContactClick} showPricing />
      {/* Titre & sous-titre */}
      <Container maxWidth="md" sx={{ textAlign: 'center', mb: 6 }}>
        <Typography variant="h2" sx={{ fontWeight: 600, fontSize: { xs: '2.7rem', md: '3.5rem' }, mb: 2, letterSpacing: '-0.03em', color: tokens.colors.ink, animation: `${fadeIn} 1s` }}>
          Tarifs
        </Typography>
        <Typography variant="h5" sx={{ color: tokens.colors.ink, fontWeight: 500, mb: 1, fontSize: { xs: '1.2rem', md: '1.4rem' }, animation: `${fadeIn} 1s 0.2s both` }}>
          2 mois offerts
        </Typography>
        <Typography variant="body1" sx={{ color: tokens.colors.inkMuted, fontWeight: 400, mb: 4, fontSize: { xs: '1rem', md: '1.1rem' }, animation: `${fadeIn} 1s 0.25s both` }}>
          puis 149,90€/mois · Sans engagement
        </Typography>
      </Container>
      {/* Cartes de prix */}
      <Container maxWidth="lg" sx={{ mb: 8 }}>
        <Grid container spacing={4} justifyContent="center">
          {plans.map((plan, idx) => (
            <Grid item xs={12} md={6} key={plan.title}>
              <Card
                elevation={0}
                sx={{
                  borderRadius: tokens.radius.xxxl,
                  boxShadow: plan.featured ? tokens.shadows.cardHover : tokens.shadows.sm,
                  border: plan.featured ? `2px solid ${tokens.colors.marketingBlack}` : `1px solid ${tokens.colors.borderSoft}`,
                  bgcolor: tokens.colors.marketingWhite,
                  p: 0,
                  minHeight: 320,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.25s ease',
                  position: 'relative',
                  overflow: 'visible',
                  '&:hover': { 
                    boxShadow: tokens.shadows.cardHover
                  },
                  animation: `${fadeIn} 1s ${0.3 + idx * 0.15}s both`
                }}
              >
                {plan.featured && (plan as any).promoBadge && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -12,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      px: 2.5,
                      py: 1,
                      borderRadius: tokens.radius.pill,
                      bgcolor: tokens.colors.marketingBlack,
                      color: tokens.colors.marketingWhite,
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      boxShadow: tokens.shadows.md,
                      zIndex: 1,
                      animation: `${fadeIn} 1s ${0.35 + idx * 0.15}s both`
                    }}
                  >
                    {(plan as any).promoBadge}
                  </Box>
                )}
                <CardContent sx={{ width: '100%', textAlign: 'center', p: 5, pt: plan.featured && (plan as any).promoBadge ? 4 : 5, display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <Box>
                    <Typography variant="h6" sx={{ color: tokens.colors.inkMuted, fontWeight: 500, mb: 1, fontSize: '1.1rem', letterSpacing: '-0.01em', animation: `${fadeIn} 1s ${0.4 + idx * 0.15}s both` }}>{plan.title}</Typography>
                    {(plan as any).promoValue && (
                      <Typography variant="body2" sx={{ color: tokens.colors.ink, fontWeight: 600, mb: 1.5, fontSize: '1rem', animation: `${fadeIn} 1s ${0.45 + idx * 0.15}s both` }}>
                        {(plan as any).promoValue}
                      </Typography>
                    )}
                    {plan.subtitle && (
                      <Typography variant="body2" sx={{ color: tokens.colors.inkMuted, mb: 2, fontSize: '1rem', animation: `${fadeIn} 1s ${0.5 + idx * 0.15}s both` }}>{plan.subtitle}</Typography>
                    )}
                    <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, fontSize: '2.5rem', color: tokens.colors.ink, animation: `${fadeIn} 1s ${0.6 + idx * 0.15}s both` }}>
                      {(plan as any).priceNote ? '0€' : plan.price}
                      {!(plan as any).priceNote && plan.priceSuffix && (
                        <Typography component="span" variant="h6" sx={{ color: tokens.colors.inkMuted, fontWeight: 400, fontSize: '1.1rem', ml: 1 }}>
                          {plan.priceSuffix}
                        </Typography>
                      )}
                    </Typography>
                    {(plan as any).priceNote && (
                      <Typography variant="body2" sx={{ color: tokens.colors.inkBody, fontWeight: 500, mb: 2, fontSize: '1rem' }}>
                        {(plan as any).priceNote}
                      </Typography>
                    )}
                    {!(plan as any).priceNote && <Box sx={{ mb: 2 }} />}
                  </Box>
                  <Box sx={{ flexGrow: 1, minHeight: 24 }} />
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => {
                      if (plan.title === 'Customisable') {
                        handleContactClick();
                      } else {
                        const planId = plan.title.toLowerCase() === 'premium' ? 'premium' : 'custom';
                        navigate(`/register?type=structure&plan=${planId}`);
                      }
                    }}
                    sx={{
                      mt: 2,
                      bgcolor: tokens.colors.marketingBlack,
                      color: tokens.colors.marketingWhite,
                      borderRadius: tokens.radius.xxl,
                      fontWeight: 500,
                      fontSize: '1.08rem',
                      py: 1.3,
                      textTransform: 'none',
                      boxShadow: 'none',
                      letterSpacing: '-0.01em',
                      '&:hover': { bgcolor: tokens.colors.marketingBlack, opacity: 0.9 },
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
        <Box sx={{ overflowX: 'auto', borderRadius: tokens.radius.xl, bgcolor: tokens.colors.marketingWhite, boxShadow: tokens.shadows.sm, border: `1px solid ${tokens.colors.borderSoft}`, p: { xs: 1, md: 3 }, animation: `${fadeIn} 1s 1.2s both` }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${tokens.colors.divider}` }}>
                <th style={{ textAlign: 'left', color: tokens.colors.inkMuted, fontWeight: 500, padding: '16px 12px', fontSize: 17, background: 'transparent' }}>Fonctionnalités</th>
                {plans.map(plan => (
                  <th key={plan.title} style={{ textAlign: 'center', color: tokens.colors.ink, fontWeight: 600, padding: '16px 12px', fontSize: 17, background: 'transparent' }}>{plan.title}</th>
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
                      color: tokens.colors.ink,
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
                      color: tokens.colors.inkBody, 
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
                          <Typography sx={{ color: tokens.colors.inkMuted, fontWeight: 500, fontSize: '1rem' }}>{val}</Typography>
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