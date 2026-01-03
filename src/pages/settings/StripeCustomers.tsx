import React, { useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Box, 
  Typography, 
  Grid, 
  Paper, 
  Chip,
  Container,
  CircularProgress
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { styled } from '@mui/material';

interface StripeCustomer {
  id: string;
  email: string;
  name: string;
  subscriptionStatus: string;
  subscriptionTitle: string;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  environment: 'production' | 'test';
}

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 16,
  transition: 'all 0.3s ease',
  '&:hover': {
    boxShadow: theme.shadows[4],
    borderColor: theme.palette.grey[300],
  },
}));

export default function StripeCustomers() {
  const [customers, setCustomers] = useState<StripeCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const functions = getFunctions();
        const getStripeCustomers = httpsCallable(functions, 'getStripeCustomers');
        const result = await getStripeCustomers();
        setCustomers(result.data as StripeCustomer[]);
      } catch (err) {
        console.error('Erreur détaillée lors de la récupération des clients:', err);
        setError('Impossible de récupérer la liste des clients');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  const getStatusColor = (status: string): { color: "success" | "error" | "warning" | "default", variant: "filled" | "outlined" } => {
    switch (status) {
      case 'active':
        return { color: "success", variant: "filled" };
      case 'canceled':
        return { color: "error", variant: "outlined" };
      case 'incomplete':
        return { color: "warning", variant: "filled" };
      default:
        return { color: "default", variant: "outlined" };
    }
  };

  const getEnvironmentColor = (environment: string): { color: "info" | "secondary" | "default", variant: "filled" | "outlined" } => {
    switch (environment) {
      case 'production':
        return { color: "info", variant: "filled" };
      case 'test':
        return { color: "secondary", variant: "filled" };
      default:
        return { color: "default", variant: "outlined" };
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" color="error.main" p={4}>
        {error}
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box mb={4} display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={1}>
          <PersonIcon sx={{ fontSize: 32 }} />
          <Typography variant="h4" component="h1">
            Clients Stripe
          </Typography>
        </Box>
        <Chip
          label={`${customers.length} client${customers.length > 1 ? 's' : ''}`}
          variant="outlined"
        />
      </Box>

      <Grid container spacing={3}>
        {customers && customers.length > 0 ? (
          customers.map((customer) => (
            <Grid item xs={12} md={6} lg={4} key={customer.id}>
              <StyledPaper elevation={1}>
                <Box mb={2}>
                  <Typography variant="h6" gutterBottom noWrap>
                    {customer.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {customer.email}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Abonnement : {customer.subscriptionTitle}
                  </Typography>
                </Box>

                <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                  <Chip
                    label={customer.subscriptionStatus}
                    size="small"
                    {...getStatusColor(customer.subscriptionStatus)}
                  />
                  <Chip
                    label={customer.environment}
                    size="small"
                    {...getEnvironmentColor(customer.environment)}
                  />
                </Box>

                <Box mt="auto" pt={2} borderTop={1} borderColor="divider">
                  {customer.currentPeriodEnd && (
                    <Typography variant="body2" color="text.secondary" noWrap>
                      Renouvellement prévu le {format(new Date(customer.currentPeriodEnd).getTime(), 'dd MMMM yyyy', { locale: fr })}
                    </Typography>
                  )}
                  {customer.cancelAtPeriodEnd && (
                    <Box mt={1}>
                      <Chip
                        label="Annulation prévue"
                        color="warning"
                        variant="outlined"
                        size="small"
                        sx={{ width: '100%' }}
                      />
                    </Box>
                  )}
                </Box>
              </StyledPaper>
            </Grid>
          ))
        ) : (
          <Grid item xs={12}>
            <Paper sx={{ 
              p: 4, 
              textAlign: 'center',
              borderStyle: 'dashed',
              borderRadius: 4
            }}>
              <PersonIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Aucun client
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Les clients apparaîtront ici une fois qu'ils seront créés dans Stripe.
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Container>
  );
} 