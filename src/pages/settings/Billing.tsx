import * as React from 'react';
import { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  CircularProgress,
  Alert,
  Container,
  useTheme,
  useMediaQuery,
  Chip,
  Divider
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from 'notistack';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useSearchParams } from 'react-router-dom';
import { getStripeCustomers, fetchPaymentHistory } from '../../services/stripeApiService';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'stripe-buy-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        'buy-button-id': string;
        'publishable-key': string;
      };
    }
  }
}

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

interface StripePayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  receipt_url: string;
  description?: string;
}



const Billing: React.FC = () => {
  const { currentUser } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [structureId, setStructureId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // États pour Stripe
  const [organizationEmail, setOrganizationEmail] = useState<string>('');
  const [payments, setPayments] = useState<StripePayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [stripeCustomers, setStripeCustomers] = useState<StripeCustomer[]>([]);
  const [isStripeCustomer, setIsStripeCustomer] = useState<boolean>(false);
  const [loadingStripeCustomers, setLoadingStripeCustomers] = useState(false);
  

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!currentUser) return;

      try {
        console.log('Vérification du statut admin pour:', currentUser.uid);
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        console.log('Données utilisateur:', userData);
        
        if (userData?.status === 'admin' && userData?.structureId) {
          console.log('Utilisateur est admin de la structure:', userData.structureId);
          setIsAdmin(true);
          setStructureId(userData.structureId);
        } else {
          console.log('Utilisateur n\'est pas admin, utilisation de son ID comme structureId');
          setStructureId(currentUser.uid);
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du statut admin:', error);
        setError('Erreur lors de la vérification des permissions');
      }
    };

    checkAdminStatus();
  }, [currentUser]);

  useEffect(() => {
    if (!structureId) {
      console.log('Pas de structureId, attente...');
      return;
    }

    console.log('Écoute des changements pour la structure:', structureId);
    const structureRef = doc(db, 'structures', structureId);

    const unsubscribe = onSnapshot(structureRef, (doc) => {
      console.log('Changement détecté dans le document structure');
      if (doc.exists()) {
        const data = doc.data();
        console.log('Données de la structure:', data);
      } else {
        console.log('Document structure n\'existe pas');
      }
      setLoading(false);
    }, (error) => {
      console.error('Erreur lors de l\'écoute des changements:', error);
      setError('Erreur lors de la récupération des données d\'abonnement');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [structureId]);

  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success === 'true') {
      enqueueSnackbar('Paiement réussi ! Votre abonnement est maintenant actif.', { variant: 'success' });
    } else if (canceled === 'true') {
      enqueueSnackbar('Le paiement a été annulé.', { variant: 'info' });
    }
  }, [searchParams, enqueueSnackbar]);

  // Récupération des informations de l'organisation
  useEffect(() => {
    const fetchOrganizationData = async () => {
      if (!currentUser) return;

      try {
        console.log('Récupération des données de l\'organisation pour l\'utilisateur:', currentUser.uid);
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        console.log('Données utilisateur récupérées:', userData);
        
        if (userData?.structureId) {
          console.log('Structure ID trouvé:', userData.structureId);
          const structureDoc = await getDoc(doc(db, 'structures', userData.structureId));
          if (structureDoc.exists()) {
            const structureData = structureDoc.data();
            console.log('Données de la structure récupérées:', structureData);
            setOrganizationEmail(structureData.email || '');
            console.log('Email de l\'organisation défini:', structureData.email);
            console.log('Email de l\'utilisateur connecté:', currentUser.email);
          } else {
            console.log('Document structure n\'existe pas');
          }
        } else {
          console.log('Pas de structureId dans les données utilisateur');
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des données de l\'organisation:', error);
      }
    };

    fetchOrganizationData();
  }, [currentUser]);

  // Récupération des clients Stripe
  useEffect(() => {
    const fetchStripeCustomers = async () => {
      if (!currentUser) return;

      setLoadingStripeCustomers(true);
      try {
        console.log('Récupération des clients Stripe via API HTTP...');
        
        const customers = await getStripeCustomers();
        
        console.log('Clients Stripe récupérés:', customers);
        setStripeCustomers(customers);
        
        // Vérifier si l'email de l'organisation correspond à un client Stripe
        if (organizationEmail && customers.length > 0) {
          console.log('Email de la structure:', organizationEmail);
          console.log('Emails des clients Stripe:', customers.map(c => c.email));
          
          const isCustomer = customers.some(customer => {
            const match = customer.email.toLowerCase() === organizationEmail.toLowerCase();
            console.log(`Comparaison: "${customer.email}" === "${organizationEmail}" ? ${match}`);
            return match;
          });
          
          setIsStripeCustomer(isCustomer);
          console.log('Structure est cliente Stripe:', isCustomer);
        } else {
          console.log('Conditions non remplies:', { organizationEmail, customersCount: customers.length });
        }
        
      } catch (err: any) {
        console.error('Erreur lors de la récupération des clients Stripe:', err);
        enqueueSnackbar('Erreur lors de la récupération des clients Stripe', { variant: 'error' });
      } finally {
        setLoadingStripeCustomers(false);
      }
    };

    fetchStripeCustomers();
  }, [currentUser, organizationEmail, enqueueSnackbar]);

  // Récupération de l'historique des paiements
  useEffect(() => {
    const fetchPayments = async () => {
      if (!organizationEmail || !currentUser || !isStripeCustomer) {
        console.log('Conditions non remplies pour récupérer les paiements:', { 
          organizationEmail, 
          currentUser: !!currentUser, 
          isStripeCustomer 
        });
        return;
      }
      
      setLoadingPayments(true);
      try {
        console.log('Tentative de récupération des paiements pour:', organizationEmail);
        console.log('Utilisateur authentifié:', currentUser.uid);
        
        const payments = await fetchPaymentHistory(organizationEmail);
        console.log('Paiements récupérés avec succès:', payments);
        setPayments(payments);
        
      } catch (err: any) {
        console.error('Erreur détaillée lors de la récupération des paiements Stripe:', err);
        console.error('Message d\'erreur:', err?.message);
        
        // Gestion des erreurs
        if (err?.message?.includes('Token d\'authentification non disponible')) {
          enqueueSnackbar('Vous devez être connecté pour accéder à cette fonctionnalité.', { variant: 'error' });
        } else if (err?.message?.includes('Erreur HTTP: 403')) {
          enqueueSnackbar('Vous n\'avez pas les permissions nécessaires.', { variant: 'error' });
        } else if (err?.message?.includes('Erreur HTTP: 404')) {
          console.log('Aucun paiement trouvé pour cette structure');
          setPayments([]);
        } else {
          enqueueSnackbar('Erreur lors de la récupération de l\'historique des paiements. Veuillez réessayer.', { variant: 'error' });
        }
      } finally {
        setLoadingPayments(false);
      }
    };
    fetchPayments();
  }, [organizationEmail, currentUser, isStripeCustomer, enqueueSnackbar]);






  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 2 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Box sx={{ 
        textAlign: 'center', 
        mb: 3,
        px: isMobile ? 2 : 4
      }}>
        <Typography 
          variant="h4" 
          component="h1" 
          gutterBottom
          sx={{ 
            fontWeight: 600,
            fontSize: isMobile ? '1.5rem' : '2rem',
            letterSpacing: '-0.02em'
          }}
        >
          {isAdmin ? 'Gestion des Abonnements' : 'Plan d\'abonnement'}
        </Typography>
        <Typography 
          variant="subtitle1" 
          color="text.secondary"
          sx={{ 
            fontWeight: 400,
            maxWidth: '600px',
            mx: 'auto',
            mb: 2
          }}
        >
          Accédez à toutes les fonctionnalités premium de JS Connect
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: '150px'
        }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper 
          elevation={0}
          sx={{ 
            p: isMobile ? 2 : 4,
            borderRadius: 3,
            background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
            border: '1px solid',
            borderColor: 'divider',
            maxWidth: '600px',
            mx: 'auto'
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography 
              variant="h5" 
              gutterBottom
              sx={{ 
                fontWeight: 600,
                fontSize: isMobile ? '1.25rem' : '1.5rem',
                letterSpacing: '-0.01em'
              }}
            >
              JS Connect Pro
            </Typography>
            <Typography 
              variant="h4" 
              color="primary"
              sx={{ 
                fontWeight: 600,
                mb: 1
              }}
            >
              149€ <Typography component="span" variant="body1" color="text.secondary">/mois</Typography>
            </Typography>
            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{ 
                maxWidth: '400px',
                mx: 'auto',
                mb: 2
              }}
            >
              Profitez de toutes les fonctionnalités premium de JS Connect avec notre abonnement mensuel.
              Annulez à tout moment.
            </Typography>

            {organizationEmail && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  Email de facturation : {organizationEmail}
                </Typography>
                {loadingStripeCustomers ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">
                      Vérification du statut client...
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ mt: 1 }}>
                    <Chip 
                      label={isStripeCustomer ? 'Structure cliente Stripe' : 'Structure non cliente'}
                      color={isStripeCustomer ? 'success' : 'default'}
                      size="small"
                      sx={{ fontWeight: 500 }}
                    />
                  </Box>
                )}
                
              </>
            )}
          </Box>
        </Paper>
      )}

      <Divider sx={{ my: 4 }} />
      <Typography variant="h6" sx={{ mb: 2 }}>
        Historique des paiements
      </Typography>
      
      {loadingPayments ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress />
        </Box>
      ) : payments.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {import.meta.env.DEV 
              ? 'Mode développement : L\'historique des paiements n\'est pas disponible localement. En production, vos paiements Stripe s\'afficheront ici.'
              : !isStripeCustomer 
                ? 'Cette structure n\'est pas encore cliente Stripe. Aucun paiement à afficher.'
                : 'Aucun paiement trouvé pour cette structure.'
            }
          </Typography>
          {!isStripeCustomer && !import.meta.env.DEV && (
            <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
              Contactez votre administrateur pour configurer les paiements Stripe.
            </Typography>
          )}
        </Paper>
      ) : (
        <Box>
          {payments.map(payment => (
            <Paper key={payment.id} sx={{ p: 3, mb: 2, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {payment.description === 'Subscription update' ? 'Paiement mensuel' :
                       payment.description === 'subscription creation' ? 'Création d\'abonnement' :
                       payment.description === 'Subscription creation' ? 'Création d\'abonnement' :
                       payment.description === 'Subscription Creation' ? 'Création d\'abonnement' :
                       payment.description}
                    </Typography>
                    <Chip 
                      label={payment.status === 'succeeded' ? 'Effectué' : payment.status}
                      color={payment.status === 'succeeded' ? 'success' : 'default'}
                      size="small"
                      sx={{ 
                        fontWeight: 500
                      }}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {new Date(payment.created * 1000).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                    {(payment.amount / 100).toFixed(2)} {payment.currency.toUpperCase()}
                  </Typography>
                </Box>
                {payment.receipt_url ? (
                  <a 
                    href={payment.receipt_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <Chip 
                      label="Télécharger le reçu" 
                      size="small" 
                      color="primary" 
                      variant="outlined"
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: 'primary.main',
                          color: 'white'
                        }
                      }}
                    />
                  </a>
                ) : (
                  <Chip 
                    label="Reçu non disponible" 
                    size="small" 
                    color="default" 
                    variant="outlined"
                    disabled
                  />
                )}
              </Box>
            </Paper>
          ))}
        </Box>
      )}

    </Container>
  );
};

export default Billing; 