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
  Payment as PaymentIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  ArrowBack as ArrowBackIcon,
  Security as SecurityIcon,
  Euro as EuroIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';
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
  maxWidth: '600px',
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

const StyledIconContainer = styled(Box)(({ theme }) => ({
  width: '60px',
  height: '60px',
  borderRadius: '16px',
  background: `linear-gradient(135deg, ${APPLE_COLORS.primary} 0%, #0051a8 100%)`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto',
  marginBottom: theme.spacing(2),
  boxShadow: '0 8px 24px rgba(0, 113, 227, 0.3)',
  animation: `${float} 3s ease-in-out infinite`,
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
  '&:disabled': {
    background: APPLE_COLORS.secondary,
    boxShadow: 'none',
    transform: 'none',
    color: '#ffffff',
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
    background: alpha(APPLE_COLORS.primary, 0.05),
  },
}));

interface StructureData {
  cotisationsEnabled: boolean;
  cotisationAmount: number;
  cotisationDuration: 'end_of_school' | '1_year' | '2_years' | '3_years';
  stripeIntegrationEnabled: boolean;
  stripePublishableKey: string;
  stripeProductId: string;
  stripeBuyButtonId: string;
  structureId: string;
  structureName?: string;
}

const CotisationPayment: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [structureData, setStructureData] = useState<StructureData | null>(null);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    const initializePayment = async () => {
      try {
        console.log('🔍 CotisationPayment: Initialisation du paiement');
        
        if (!currentUser?.uid) {
          setError('Vous devez être connecté pour effectuer un paiement');
          setLoading(false);
          return;
        }

        // Récupérer les données de l'utilisateur pour obtenir structureId
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) {
          setError('Données utilisateur non trouvées');
          setLoading(false);
          return;
        }

        const userData = userDoc.data();
        const structureId = userData.structureId;

        if (!structureId) {
          setError('Vous n\'êtes pas associé à une structure');
          setLoading(false);
          return;
        }

        // Récupérer les données de la structure
        const structureDoc = await getDoc(doc(db, 'structures', structureId));
        if (!structureDoc.exists()) {
          setError('Données de structure non trouvées');
          setLoading(false);
          return;
        }

        const structureData = structureDoc.data();
        
        // Vérifier que les cotisations sont activées
        if (!structureData.cotisationsEnabled) {
          setError('Les cotisations ne sont pas activées pour cette structure');
          setLoading(false);
          return;
        }

        // Vérifier que Stripe est configuré
        if (!structureData.stripeIntegrationEnabled) {
          setError('Le système de paiement n\'est pas configuré pour cette structure');
          setLoading(false);
          return;
        }

        setStructureData({
          cotisationsEnabled: structureData.cotisationsEnabled || false,
          cotisationAmount: structureData.cotisationAmount || 0,
          cotisationDuration: structureData.cotisationDuration || '1_year',
          stripeIntegrationEnabled: structureData.stripeIntegrationEnabled || false,
          stripePublishableKey: structureData.stripePublishableKey || '',
          stripeProductId: structureData.stripeProductId || '',
          stripeBuyButtonId: structureData.stripeBuyButtonId || '',
          structureId: structureId,
          structureName: structureData.name || structureData.ecole || 'Structure'
        });

        setLoading(false);
        console.log('🔍 Initialisation terminée avec succès');

      } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        setError('Erreur lors du chargement des données de paiement');
        setLoading(false);
      }
    };

    initializePayment();
  }, [currentUser]);

  const createPaymentSession = async () => {
    if (!currentUser?.uid || !structureData) {
      setError('Données manquantes pour créer la session de paiement');
      return;
    }

    try {
      setCreatingSession(true);
      setError(null);

      console.log('🔍 Création de la session de paiement...');

      const functions = getFunctions();
      const createCotisationSession = httpsCallable(functions, 'createCotisationSession');

      const result = await createCotisationSession({
        userId: currentUser.uid,
        structureId: structureData.structureId,
        amount: structureData.cotisationAmount,
        duration: structureData.cotisationDuration
      });

      const data = result.data as { sessionId: string; sessionUrl: string };
      
      console.log('🔍 Session créée:', data.sessionId);
      setSessionUrl(data.sessionUrl);

      // Rediriger vers Stripe
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      }

    } catch (error) {
      console.error('Erreur lors de la création de la session:', error);
      setError('Erreur lors de la création de la session de paiement');
    } finally {
      setCreatingSession(false);
    }
  };

  const formatCotisationDuration = (duration: string) => {
    switch (duration) {
      case 'end_of_school':
        return 'jusqu\'à la fin de vos études';
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
              color: APPLE_COLORS.primary,
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
            Préparation du paiement
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: APPLE_COLORS.secondary,
              opacity: 0.8
            }}
          >
            Chargement de votre session sécurisée
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
        {/* En-tête */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <StyledIconContainer>
            <PaymentIcon sx={{ color: 'white', fontSize: 32 }} />
          </StyledIconContainer>
          <Typography 
            variant="h4" 
            sx={{ 
              color: APPLE_COLORS.text,
              fontWeight: 700,
              marginBottom: 1,
              fontSize: '24px',
            }}
          >
            Paiement de cotisation
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              color: APPLE_COLORS.secondary,
              fontWeight: 500,
              fontSize: '16px',
            }}
          >
            {structureData?.structureName}
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
            Résumé
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
              <EuroIcon sx={{ color: APPLE_COLORS.primary, fontSize: 18 }} />
              <Box>
                <Typography variant="body2" sx={{ color: APPLE_COLORS.secondary, fontSize: '12px' }}>
                  Montant
                </Typography>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 700,
                    color: APPLE_COLORS.primary,
                    fontSize: '20px',
                  }}
                >
                  {structureData?.cotisationAmount}€
                </Typography>
              </Box>
            </Box>
            
            <Divider orientation="vertical" sx={{ borderColor: alpha(APPLE_COLORS.border, 0.3), height: '40px' }} />
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
              <CalendarIcon sx={{ color: APPLE_COLORS.primary, fontSize: 18 }} />
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
                  {formatCotisationDuration(structureData?.cotisationDuration || '1_year')}
                </Typography>
              </Box>
            </Box>
          </Box>
        </StyledInfoCard>

        {/* Avantages */}
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
            Inclus dans votre cotisation
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <StyledFeatureItem>
              <CheckCircleIcon sx={{ color: APPLE_COLORS.success, fontSize: 16 }} />
              <Typography variant="body2" sx={{ color: APPLE_COLORS.text, fontSize: '13px' }}>
                Accès aux missions
              </Typography>
            </StyledFeatureItem>
            <StyledFeatureItem>
              <CheckCircleIcon sx={{ color: APPLE_COLORS.success, fontSize: 16 }} />
              <Typography variant="body2" sx={{ color: APPLE_COLORS.text, fontSize: '13px' }}>
                Paiement sécurisé
              </Typography>
            </StyledFeatureItem>
            <StyledFeatureItem>
              <CheckCircleIcon sx={{ color: APPLE_COLORS.success, fontSize: 16 }} />
              <Typography variant="body2" sx={{ color: APPLE_COLORS.text, fontSize: '13px' }}>
                Confirmation immédiate
              </Typography>
            </StyledFeatureItem>
            <StyledFeatureItem>
              <CheckCircleIcon sx={{ color: APPLE_COLORS.success, fontSize: 16 }} />
              <Typography variant="body2" sx={{ color: APPLE_COLORS.text, fontSize: '13px' }}>
                Support client
              </Typography>
            </StyledFeatureItem>
          </Box>
        </Box>

        {/* Sécurité */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5, 
          padding: 1.5,
          background: alpha(APPLE_COLORS.success, 0.05),
          borderRadius: '12px',
          border: `1px solid ${alpha(APPLE_COLORS.success, 0.2)}`,
          marginBottom: 3,
        }}>
          <SecurityIcon sx={{ color: APPLE_COLORS.success, fontSize: 20 }} />
          <Typography variant="body2" sx={{ color: APPLE_COLORS.text, fontSize: '13px' }}>
            <strong>Paiement sécurisé :</strong> Vos données sont protégées par le cryptage SSL et Stripe
          </Typography>
        </Box>

        {/* Boutons d'action */}
        <Stack spacing={1.5}>
          <StyledButton
            size="large"
            startIcon={<PaymentIcon />}
            onClick={createPaymentSession}
            disabled={creatingSession}
            fullWidth
          >
            {creatingSession ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={20} sx={{ color: 'white' }} />
                Préparation...
              </Box>
            ) : (
              `Payer ${structureData?.cotisationAmount}€`
            )}
          </StyledButton>
          
          <StyledSecondaryButton
            size="large"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/app/available-missions')}
            fullWidth
          >
            Annuler
          </StyledSecondaryButton>
        </Stack>
      </StyledPaper>
    </StyledContainer>
  );
};

export default CotisationPayment;
