import React from 'react';
import { Button, Card, CardContent, Typography, Box } from '@mui/material';
import { createSubscription } from '../services/stripeService';

const SubscriptionForm: React.FC = () => {
  const handleSubscribe = async () => {
    try {
      await createSubscription(import.meta.env.VITE_STRIPE_PRICE_ID);
    } catch (error) {
      console.error('Erreur lors de la création de l\'abonnement:', error);
    }
  };

  return (
    <Card sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          Abonnement Premium
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Accédez à toutes les fonctionnalités premium pour votre structure
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Typography variant="h4" component="div" gutterBottom>
            149€ <Typography variant="body2" component="span">/mois</Typography>
          </Typography>
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleSubscribe}
            sx={{ mt: 2 }}
          >
            S'abonner maintenant
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default SubscriptionForm; 