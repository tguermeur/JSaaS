import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText,
  Box,
  CircularProgress,
  Alert,
  AppBar,
  Toolbar
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { loadStripe } from '@stripe/stripe-js';
import { useSnackbar } from 'notistack';
import { Link } from 'react-router-dom';
import Footer from './Footer';

interface PricingPlan {
  name: string;
  price: string;
  features: string[];
  priceId: string;
}

const plans: PricingPlan[] = [
  {
    name: 'Basic',
    price: '9.99€',
    features: [
      'Fonctionnalité 1',
      'Fonctionnalité 2',
      'Fonctionnalité 3'
    ],
    priceId: import.meta.env.VITE_STRIPE_PRICE_BASIC
  },
  {
    name: 'Pro',
    price: '19.99€',
    features: [
      'Tout du plan Basic',
      'Fonctionnalité 4',
      'Fonctionnalité 5'
    ],
    priceId: import.meta.env.VITE_STRIPE_PRICE_PRO
  },
  {
    name: 'Enterprise',
    price: '49.99€',
    features: [
      'Tout du plan Pro',
      'Fonctionnalité 6',
      'Fonctionnalité 7'
    ],
    priceId: import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE
  }
];

export default function PricingPlans() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const functions = getFunctions();
  const { enqueueSnackbar } = useSnackbar();

  const handleScrollToContact = () => {
    const contactSection = document.getElementById('contact');
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSubscribe = async (priceId: string) => {
    if (!priceId) {
      setError('ID du prix manquant');
      enqueueSnackbar('ID du prix manquant', { variant: 'error' });
      return;
    }

    try {
      setLoading(priceId);
      setError(null);

      const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');
      const { data } = await createCheckoutSession({ priceId });
      
      if (!data || !(data as any).sessionId) {
        throw new Error('Session ID non reçu du serveur');
      }

      const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);
      if (!stripe) {
        throw new Error('Stripe n\'a pas pu être initialisé');
      }

      const { error: stripeError } = await stripe.redirectToCheckout({ 
        sessionId: (data as any).sessionId 
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }
    } catch (error: any) {
      console.error('Erreur lors de la création de la session:', error);
      setError(error.message || 'Une erreur est survenue lors de la création de la session de paiement');
      enqueueSnackbar(error.message || 'Erreur lors de la création de la session de paiement', { 
        variant: 'error',
        autoHideDuration: 5000
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#fff' }}>
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
              component={Link}
              to="/"
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
              component={Link}
              to="/features"
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
              component={Link}
              to="/pricing"
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
              onClick={handleScrollToContact}
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
              component={Link}
              to="/login"
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
              component={Link}
              to="/register"
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

      <Box sx={{ flexGrow: 1, p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 3,
          maxWidth: 1200,
          mx: 'auto'
        }}>
          {plans.map((plan) => (
            <Card key={plan.name} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h5" component="h2" gutterBottom>
                  {plan.name}
                </Typography>
                <Typography variant="h4" component="div" gutterBottom>
                  {plan.price}
                  <Typography variant="body2" component="span" color="text.secondary">
                    /mois
                  </Typography>
                </Typography>
                <List>
                  {plan.features.map((feature, index) => (
                    <ListItem key={index} disablePadding sx={{ mb: 1 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <CheckCircleIcon color="primary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={feature} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
              <Box sx={{ p: 2 }}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => handleSubscribe(plan.priceId)}
                  disabled={loading === plan.priceId}
                >
                  {loading === plan.priceId ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    'Souscrire'
                  )}
                </Button>
              </Box>
            </Card>
          ))}
        </Box>
      </Box>

      <Footer />
    </Box>
  );
} 