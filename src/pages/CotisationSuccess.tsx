import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Container,
  Stack,
  Divider,
  alpha,
  keyframes,
  useTheme,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Payment as PaymentIcon,
  Warning as WarningIcon,
  ArrowBack as ArrowBackIcon,
  Security as SecurityIcon,
  Euro as EuroIcon,
  CalendarToday as CalendarIcon,
  Business as BusinessIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, addDoc, collection, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { styled } from '@mui/material/styles';

// Animations Apple-style
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

const scaleIn = keyframes`
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
`;

const float = keyframes`
  0% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-8px);
  }
  100% {
    transform: translateY(0px);
  }
`;

const successPulse = keyframes`
  0% {
    transform: scale(1);
    box-shadow: 0 8px 24px rgba(52, 199, 89, 0.3);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 12px 32px rgba(52, 199, 89, 0.5);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 8px 24px rgba(52, 199, 89, 0.3);
  }
`;

// Couleurs Apple
const APPLE_COLORS = {
  primary: '#0071e3',
  secondary: '#86868b',
  background: '#f5f5f7',
  surface: '#ffffff',
  border: '#d2d2d7',
  text: '#1d1d1f',
  error: '#ff3b30',
  success: '#34c759',
  warning: '#ff9500',
};

// Composants stylisés
const StyledContainer = styled(Container)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(2),
  background: `linear-gradient(135deg, ${APPLE_COLORS.background} 0%, #ffffff 100%)`,
  animation: `${fadeIn} 0.6s ease-out`,
  maxWidth: '100% !important',
}));

const StyledPaper = styled(Paper)(({ theme }) => ({
  borderRadius: '24px',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
  backdropFilter: 'blur(20px)',
  backgroundColor: alpha(APPLE_COLORS.surface, 0.95),
  border: `1px solid ${alpha(APPLE_COLORS.border, 0.2)}`,
  padding: theme.spacing(3),
  maxWidth: '700px',
  width: '100%',
  maxHeight: '90vh',
  overflow: 'auto',
  animation: `${scaleIn} 0.5s ease-out`,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.12)',
    transform: 'translateY(-2px)',
  },
}));

const StyledSuccessIcon = styled(Box)(({ theme }) => ({
  width: '60px',
  height: '60px',
  borderRadius: '16px',
  background: `linear-gradient(135deg, ${APPLE_COLORS.success} 0%, #28a745 100%)`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto',
  marginBottom: theme.spacing(2),
  animation: `${successPulse} 2s ease-in-out infinite`,
}));

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: '16px',
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '16px',
  padding: '14px 32px',
  color: '#ffffff',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  background: `linear-gradient(135deg, ${APPLE_COLORS.primary} 0%, #0051a8 100%)`,
  boxShadow: '0 4px 16px rgba(0, 113, 227, 0.3)',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 24px rgba(0, 113, 227, 0.4)',
    background: `linear-gradient(135deg, #0051a8 0%, #003d7a 100%)`,
    color: '#ffffff',
  },
  '&:active': {
    transform: 'translateY(0)',
  },
}));

const StyledSecondaryButton = styled(Button)(({ theme }) => ({
  borderRadius: '16px',
  textTransform: 'none',
  fontWeight: 500,
  fontSize: '16px',
  padding: '14px 32px',
  border: `1px solid ${APPLE_COLORS.border}`,
  color: APPLE_COLORS.text,
  background: APPLE_COLORS.surface,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    background: alpha(APPLE_COLORS.background, 0.5),
    borderColor: APPLE_COLORS.primary,
    transform: 'translateY(-1px)',
  },
}));

const StyledInfoCard = styled(Box)(({ theme }) => ({
  background: alpha(APPLE_COLORS.background, 0.5),
  borderRadius: '16px',
  padding: theme.spacing(3),
  border: `1px solid ${alpha(APPLE_COLORS.border, 0.2)}`,
  marginBottom: theme.spacing(3),
}));

const StyledFeatureItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(1.5),
  borderRadius: '12px',
  transition: 'all 0.2s ease',
  '&:hover': {
    background: alpha(APPLE_COLORS.success, 0.05),
  },
}));

interface CotisationData {
  id: string;
  userId: string;
  status: string;
  paidAt: Date;
  expiresAt: Date;
  amount: number;
  structureId: string;
  cotisationDuration: string;
  userData?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

const CotisationSuccess: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cotisationData, setCotisationData] = useState<CotisationData | null>(null);
  const [structureName, setStructureName] = useState<string>('');
  const theme = useTheme();

  useEffect(() => {
    const handlePaymentSuccess = async () => {
      try {
        console.log('🔍 CotisationSuccess: Début du traitement');
        const sessionId = searchParams.get('session_id');
        
        console.log('🔍 Session ID:', sessionId);
        console.log('🔍 Utilisateur:', currentUser?.uid);
        
        if (!sessionId) {
          console.error('❌ Session ID manquant');
          setError('Session de paiement non trouvée.');
          setLoading(false);
          return;
        }

        if (!currentUser?.uid) {
          console.error('❌ Utilisateur non connecté');
          setError('Vous devez être connecté.');
          setLoading(false);
          return;
        }

        // Récupérer les données de l'utilisateur
        console.log('🔍 Récupération des données utilisateur...');
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) {
          console.error('❌ Document utilisateur non trouvé');
          setError('Données utilisateur non trouvées.');
          setLoading(false);
          return;
        }

        const userData = userDoc.data();
        const structureId = userData.structureId;
        console.log('🔍 Structure ID:', structureId);

        if (!structureId) {
          console.error('❌ Aucune structure associée');
          setError('Aucune structure associée à votre compte.');
          setLoading(false);
          return;
        }

        // Les données de structure sont déjà récupérées plus haut

        // Récupérer les données de la structure pour obtenir les informations de cotisation
        console.log('🔍 Récupération des données de structure...');
        const structureDoc = await getDoc(doc(db, 'structures', structureId));
        if (!structureDoc.exists()) {
          console.error('❌ Document structure non trouvé');
          setError('Données de structure non trouvées.');
          setLoading(false);
          return;
        }

        const structureData = structureDoc.data();
        const cotisationAmount = structureData.cotisationAmount || 0;
        const cotisationDuration = structureData.cotisationDuration || '1_year';
        
        console.log('🔍 Montant cotisation:', cotisationAmount);
        console.log('🔍 Durée cotisation:', cotisationDuration);
        
        // Mettre à jour le nom de la structure
        setStructureName(structureData.name || structureData.nom || '');

        // Créer la cotisation dans Firestore
        const paidAt = new Date();
        const calculateExpiryDate = () => {
          const now = new Date();
          switch (cotisationDuration) {
            case 'end_of_school':
              return new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());
            case '1_year':
              return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
            case '2_years':
              return new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
            case '3_years':
              return new Date(now.getFullYear() + 3, now.getMonth(), now.getDate());
            default:
              return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
          }
        };

        const expiryDate = calculateExpiryDate();

        const cotisationData = {
          userId: currentUser.uid,
          status: 'active',
          paidAt: paidAt,
          expiresAt: expiryDate,
          stripeSessionId: sessionId,
          amount: cotisationAmount,
          structureId: structureId,
          cotisationDuration: cotisationDuration,
          createdAt: new Date()
        };

        // Ajouter la cotisation à la collection subscriptions
        const subscriptionRef = await addDoc(collection(db, 'subscriptions'), cotisationData);

        // Mettre à jour le document utilisateur
        await updateDoc(doc(db, 'users', currentUser.uid), {
          hasActiveSubscription: true,
          subscriptionId: subscriptionRef.id,
          subscriptionStatus: 'active',
          subscriptionPaidAt: paidAt,
          subscriptionExpiresAt: expiryDate,
          lastSubscriptionUpdate: new Date()
        });

        console.log('🔍 Cotisation créée avec succès:', subscriptionRef.id);
        
        setCotisationData({
          id: subscriptionRef.id,
          ...cotisationData,
          userData: {
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email
          }
        });

        console.log('🔍 État mis à jour, fin du chargement');
        setLoading(false);

      } catch (error) {
        console.error('❌ Erreur lors du traitement du paiement:', error);
        console.error('❌ Détails de l\'erreur:', error instanceof Error ? error.message : 'Erreur inconnue');
        setError(error instanceof Error ? error.message : 'Une erreur est survenue.');
        setLoading(false);
      }
    };

    handlePaymentSuccess();
  }, [currentUser, searchParams]);

  const formatDuration = (duration: string) => {
    switch (duration) {
      case 'end_of_school':
        return 'jusqu\'à la fin de scolarité';
      case '1_year':
        return '1 an';
      case '2_years':
        return '2 ans';
      case '3_years':
        return '3 ans';
      default:
        return '1 an';
    }
  };

  if (loading) {
    return (
      <StyledContainer>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress 
            size={60} 
            sx={{ 
              color: APPLE_COLORS.success,
              marginBottom: 2 
            }} 
          />
          <Typography 
            variant="h6" 
            sx={{ 
              color: APPLE_COLORS.secondary,
              fontWeight: 500,
              marginBottom: 1
            }}
          >
            Traitement du paiement
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: APPLE_COLORS.secondary,
              opacity: 0.8
            }}
          >
            Validation de votre cotisation en cours...
          </Typography>
        </Box>
      </StyledContainer>
    );
  }

  if (error) {
    return (
      <StyledContainer>
        <StyledPaper>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              sx={{
                width: '60px',
                height: '60px',
                borderRadius: '16px',
                background: `linear-gradient(135deg, ${APPLE_COLORS.error} 0%, #d70015 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                marginBottom: 2,
                boxShadow: '0 4px 16px rgba(255, 59, 48, 0.3)',
              }}
            >
              <WarningIcon sx={{ color: 'white', fontSize: 32 }} />
            </Box>
            <Typography 
              variant="h5" 
              sx={{ 
                color: APPLE_COLORS.text,
                fontWeight: 700,
                marginBottom: 1
              }}
            >
              Erreur
            </Typography>
          </Box>

          <Alert 
            severity="error" 
            sx={{ 
              mb: 3,
              borderRadius: '12px',
              border: `1px solid ${alpha(APPLE_COLORS.error, 0.2)}`,
            }}
          >
            <Typography variant="body1">{error}</Typography>
          </Alert>

          <Stack direction="row" spacing={2} justifyContent="center">
            <StyledSecondaryButton
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/app/available-missions')}
            >
              Retour
            </StyledSecondaryButton>
            <StyledButton
              onClick={() => window.location.reload()}
            >
              Réessayer
            </StyledButton>
          </Stack>
        </StyledPaper>
      </StyledContainer>
    );
  }

  return (
    <StyledContainer maxWidth={false}>
      <StyledPaper>
        {/* En-tête de succès */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <StyledSuccessIcon>
            <CheckCircleIcon sx={{ color: 'white', fontSize: 32 }} />
          </StyledSuccessIcon>
          <Typography 
            variant="h4" 
            sx={{ 
              color: APPLE_COLORS.success,
              fontWeight: 700,
              marginBottom: 1,
              fontSize: '24px',
            }}
          >
            Paiement réussi !
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              color: APPLE_COLORS.secondary,
              fontWeight: 500,
              fontSize: '16px',
            }}
          >
            Votre cotisation a été validée
          </Typography>
        </Box>

        {/* Résumé de la cotisation */}
        <StyledInfoCard>
          <Typography 
            variant="h6" 
            sx={{ 
              color: APPLE_COLORS.text,
              fontWeight: 600,
              marginBottom: 2,
              fontSize: '16px',
            }}
          >
            Détails de votre cotisation
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EuroIcon sx={{ color: APPLE_COLORS.success, fontSize: 18 }} />
              <Box>
                <Typography variant="body2" sx={{ color: APPLE_COLORS.secondary, fontSize: '12px' }}>
                  Montant payé
                </Typography>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 700,
                    color: APPLE_COLORS.success,
                    fontSize: '20px',
                  }}
                >
                  {cotisationData?.amount}€
                </Typography>
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarIcon sx={{ color: APPLE_COLORS.success, fontSize: 18 }} />
              <Box>
                <Typography variant="body2" sx={{ color: APPLE_COLORS.secondary, fontSize: '12px' }}>
                  Validité
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontWeight: 500,
                    color: APPLE_COLORS.text,
                  }}
                >
                  {formatDuration(cotisationData?.cotisationDuration || '1_year')}
                </Typography>
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BusinessIcon sx={{ color: APPLE_COLORS.primary, fontSize: 18 }} />
              <Box>
                <Typography variant="body2" sx={{ color: APPLE_COLORS.secondary, fontSize: '12px' }}>
                  Structure
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontWeight: 500,
                    color: APPLE_COLORS.text,
                  }}
                >
                  {structureName}
                </Typography>
              </Box>
            </Box>
          </Box>


        </StyledInfoCard>

        {/* Avantages activés */}
        <Box sx={{ mb: 3 }}>
          <Typography 
            variant="h6" 
            sx={{ 
              color: APPLE_COLORS.text,
              fontWeight: 600,
              marginBottom: 1.5,
              fontSize: '16px',
            }}
          >
            Accès maintenant activés
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
            <StyledFeatureItem>
              <CheckCircleIcon sx={{ color: APPLE_COLORS.success, fontSize: 16 }} />
              <Typography variant="body2" sx={{ color: APPLE_COLORS.text, fontSize: '12px' }}>
                Toutes les missions
              </Typography>
            </StyledFeatureItem>
            <StyledFeatureItem>
              <CheckCircleIcon sx={{ color: APPLE_COLORS.success, fontSize: 16 }} />
              <Typography variant="body2" sx={{ color: APPLE_COLORS.text, fontSize: '12px' }}>
                Candidatures illimitées
              </Typography>
            </StyledFeatureItem>
            <StyledFeatureItem>
              <CheckCircleIcon sx={{ color: APPLE_COLORS.success, fontSize: 16 }} />
              <Typography variant="body2" sx={{ color: APPLE_COLORS.text, fontSize: '12px' }}>
                Accès complet
              </Typography>
            </StyledFeatureItem>
          </Box>
        </Box>



        {/* Boutons d'action */}
        <Stack spacing={1.5}>
          <StyledButton
            size="large"
            startIcon={<PaymentIcon />}
            onClick={() => navigate('/app/available-missions')}
            fullWidth
          >
            Voir les missions disponibles
          </StyledButton>
          
          <StyledSecondaryButton
            size="large"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/app/dashboard')}
            fullWidth
          >
            Retour au tableau de bord
          </StyledSecondaryButton>
        </Stack>
      </StyledPaper>
    </StyledContainer>
  );
};

export default CotisationSuccess;
