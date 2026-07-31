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
  CircularProgress
} from '@mui/material';
import { styled } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { tokens } from '../../theme/tokens';
import { settingsPageStyles, SettingsPanel } from '../../components/ds';

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
  padding: theme.spacing(2.5),
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: tokens.radius.lg,
  border: `1px solid ${tokens.colors.divider}`,
  boxShadow: tokens.shadows.sm,
  transition: tokens.transitions.fast,
  '&:hover': {
    boxShadow: tokens.shadows.md,
    borderColor: tokens.colors.gray300,
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
    <Box>
      <Box component="header" sx={{ ...settingsPageStyles.header, px: 0, py: 0, bgcolor: 'transparent', borderBottom: 'none', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: tokens.radius.md,
              background: tokens.gradients.brand,
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
            }}
          >
            <PersonIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography sx={settingsPageStyles.eyebrow}>Paramètres</Typography>
            <Typography component="h1" sx={settingsPageStyles.title}>Clients Stripe</Typography>
          </Box>
        </Box>
        <Chip
          label={`${customers.length} client${customers.length > 1 ? 's' : ''}`}
          variant="outlined"
          sx={{ borderColor: tokens.colors.divider }}
        />
      </Box>

      <SettingsPanel title="Abonnés" desc="Clients Stripe liés à la plateforme">
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
      </SettingsPanel>
    </Box>
  );
} 