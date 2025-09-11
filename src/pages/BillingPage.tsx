import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Container, Typography, Box, Alert } from '@mui/material';
import SubscriptionForm from '../components/SubscriptionForm';
import { useAuth } from '../contexts/AuthContext';

const BillingPage: React.FC = () => {
  const location = useLocation();
  const { currentUser } = useAuth();
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('success')) {
      setMessage({
        type: 'success',
        text: 'Votre abonnement a été créé avec succès !'
      });
    } else if (params.get('canceled')) {
      setMessage({
        type: 'error',
        text: 'Le processus de paiement a été annulé.'
      });
    }
  }, [location]);

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Gestion de l'abonnement
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 3 }}>
            {message.text}
          </Alert>
        )}

        {currentUser?.subscriptionStatus === 'active' ? (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Statut de votre abonnement
            </Typography>
            <Typography>
              Votre abonnement est actif jusqu'au{' '}
              {currentUser.currentPeriodEnd?.toLocaleDateString()}
            </Typography>
          </Box>
        ) : (
          <SubscriptionForm />
        )}
      </Box>
    </Container>
  );
};

export default BillingPage; 