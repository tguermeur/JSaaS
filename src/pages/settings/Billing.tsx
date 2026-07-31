import * as React from 'react';
import { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  CircularProgress,
  Alert,
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
import { tokens } from '../../theme/tokens';
import { settingsPageStyles, SettingsPanel } from '../../components/ds';

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
      <Box sx={{ py: 2, maxWidth: 720, mx: 'auto' }}>
        <Alert severity="error" sx={{ borderRadius: tokens.radius.md }}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Box component="header" sx={{ ...settingsPageStyles.header, px: 0, py: 0, bgcolor: 'transparent', borderBottom: 'none', mb: 3, textAlign: 'center', justifyContent: 'center' }}>
        <Box>
          <Typography sx={settingsPageStyles.eyebrow}>Paramètres</Typography>
          <Typography component="h1" sx={settingsPageStyles.title}>
            {isAdmin ? 'Gestion des abonnements' : 'Plan d\'abonnement'}
          </Typography>
          <Typography sx={{ ...settingsPageStyles.sub, mx: 'auto' }}>
            Accédez à toutes les fonctionnalités premium de JS Connect
          </Typography>
        </Box>
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
        <SettingsPanel title="JS Connect Pro" desc="Abonnement mensuel — annulez à tout moment">
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              variant="h4"
              sx={{ fontWeight: 600, mb: 1, color: tokens.colors.brandTeal }}
            >
              149€ <Typography component="span" variant="body1" color="text.secondary">/mois</Typography>
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ maxWidth: '400px', mx: 'auto', mb: 2 }}
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, justifyContent: 'center' }}>
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
        </SettingsPanel>
      )}

      <SettingsPanel title="Historique des paiements" desc="Vos transactions Stripe récentes">
        {loadingPayments ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress />
          </Box>
        ) : payments.length === 0 ? (
          <Box sx={{ p: 1, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {import.meta.env.DEV
                ? 'Mode développement : L\'historique des paiements n\'est pas disponible localement. En production, vos paiements Stripe s\'afficheront ici.'
                : !isStripeCustomer
                  ? 'Cette structure n\'est pas encore cliente Stripe. Aucun paiement à afficher.'
                  : 'Aucun paiement trouvé pour cette structure.'}
            </Typography>
            {!isStripeCustomer && !import.meta.env.DEV && (
              <Typography variant="body2" sx={{ mt: 1, color: tokens.colors.brandTeal }}>
                Contactez votre administrateur pour configurer les paiements Stripe.
              </Typography>
            )}
          </Box>
        ) : (
          <Box>
            {payments.map((payment) => (
              <Paper
                key={payment.id}
                elevation={0}
                sx={{
                  p: 2.5,
                  mb: 1.5,
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${tokens.colors.divider}`,
                }}
              >
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
                  <Typography variant="h6" sx={{ fontWeight: 600, color: tokens.colors.brandTeal }}>
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
      </SettingsPanel>
    </Box>
  );
};

export default Billing; 