import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Alert,
  Snackbar,
  Paper,
  Grid,
  useTheme,
  Chip,
  Avatar,
  Tooltip,
  Skeleton,
  LinearProgress,
  FormControl,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Settings as SettingsIcon,
  Euro as EuroIcon,
  Schedule as ScheduleIcon,
  School as SchoolIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Business as BusinessIcon,
  Work as WorkIcon,
  Payment as PaymentIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { doc, updateDoc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import BackButton from '../../components/ui/BackButton';

const StructureSettings: React.FC = () => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [daysUntilDue, setDaysUntilDue] = useState<number>(30);
  const [programs, setPrograms] = useState<string[]>([]);
  const [structureType, setStructureType] = useState<'jobservice' | 'junior'>('jobservice');
  const [cotisationsEnabled, setCotisationsEnabled] = useState<boolean>(false);
  const [cotisationAmount, setCotisationAmount] = useState<number>(0);
  const [cotisationDisplayValue, setCotisationDisplayValue] = useState<string>('');
  const [cotisationDuration, setCotisationDuration] = useState<'end_of_school' | '1_year' | '2_years' | '3_years'>('1_year');
  const [stripeIntegrationEnabled, setStripeIntegrationEnabled] = useState<boolean>(false);
  const [stripePublishableKey, setStripePublishableKey] = useState<string>('');
  const [stripeSecretKey, setStripeSecretKey] = useState<string>('');
  const [stripeProductId, setStripeProductId] = useState<string>('');
  const [stripeBuyButtonId, setStripeBuyButtonId] = useState<string>('');
  const [newProgram, setNewProgram] = useState('');
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [structureId, setStructureId] = useState<string | null>(null);
  const [savingStates, setSavingStates] = useState<{
    hourlyRate: boolean;
    daysUntilDue: boolean;
    programs: boolean;
    structureType: boolean;
    cotisations: boolean;
  }>({
    hourlyRate: false,
    daysUntilDue: false,
    programs: false,
    structureType: false,
    cotisations: false
  });

  // États pour suivre les valeurs originales et les modifications
  const [originalValues, setOriginalValues] = useState<{
    hourlyRate: number;
    daysUntilDue: number;
    structureType: 'jobservice' | 'junior';
    cotisationsEnabled: boolean;
    cotisationAmount: number;
    cotisationDuration: 'end_of_school' | '1_year' | '2_years' | '3_years';
    stripeIntegrationEnabled: boolean;
    stripePublishableKey: string;
    stripeSecretKey: string;
    stripeProductId: string;
    stripeBuyButtonId: string;
  }>({
    hourlyRate: 0,
    daysUntilDue: 30,
    structureType: 'jobservice',
    cotisationsEnabled: false,
    cotisationAmount: 0,
    cotisationDuration: '1_year',
    stripeIntegrationEnabled: false,
    stripePublishableKey: '',
    stripeSecretKey: '',
    stripeProductId: '',
    stripeBuyButtonId: ''
  });

  const [hasChanges, setHasChanges] = useState<{
    hourlyRate: boolean;
    daysUntilDue: boolean;
    structureType: boolean;
    cotisations: boolean;
  }>({
    hourlyRate: false,
    daysUntilDue: false,
    structureType: false,
    cotisations: false
  });

  // État pour l'ouverture/fermeture de l'onglet cotisations
  const [cotisationsExpanded, setCotisationsExpanded] = useState<boolean>(true);
  const [usersListExpanded, setUsersListExpanded] = useState<boolean>(false);
  const [usersWithSubscriptions, setUsersWithSubscriptions] = useState<Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    subscriptionPaidAt: Date;
    subscriptionExpiresAt: Date;
  }>>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);

  useEffect(() => {
    if (currentUser?.uid) {
      loadUserStructureId();
    }
  }, [currentUser]);

  const loadUserStructureId = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser!.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setStructureId(userData.structureId || null);
        if (userData.structureId) {
          loadUserStructure(userData.structureId);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l\'ID structure:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const loadUserStructure = async (sid: string) => {
    try {
      setLoading(true);
      
      const structureDoc = await getDoc(doc(db, 'structures', sid));
      if (structureDoc.exists()) {
        const data = structureDoc.data();
        const hourlyRateValue = data.hourlyRate || 0;
        const daysUntilDueValue = data.daysUntilDue || 30;
        const structureTypeValue = data.structureType || 'jobservice';
        const cotisationsEnabledValue = data.cotisationsEnabled || false;
        const cotisationAmountValue = data.cotisationAmount || 0;
        const cotisationDurationValue = data.cotisationDuration || '1_year';
        const stripeIntegrationEnabledValue = data.stripeIntegrationEnabled || false;
        const stripePublishableKeyValue = data.stripePublishableKey || '';
        const stripeSecretKeyValue = data.stripeSecretKey || '';
        const stripeProductIdValue = data.stripeProductId || '';
        const stripeBuyButtonIdValue = data.stripeBuyButtonId || '';

        setHourlyRate(hourlyRateValue);
        setDaysUntilDue(daysUntilDueValue);
        setStructureType(structureTypeValue);
        setCotisationsEnabled(cotisationsEnabledValue);
        setCotisationAmount(cotisationAmountValue);
        setCotisationDisplayValue(cotisationAmountValue ? cotisationAmountValue.toString().replace('.', ',') : '');
        setCotisationDuration(cotisationDurationValue);
        setStripeIntegrationEnabled(stripeIntegrationEnabledValue);
        setStripePublishableKey(stripePublishableKeyValue);
        setStripeSecretKey(stripeSecretKeyValue);
        setStripeProductId(stripeProductIdValue);
        setStripeBuyButtonId(stripeBuyButtonIdValue);

        // Sauvegarder les valeurs originales
        setOriginalValues({
          hourlyRate: hourlyRateValue,
          daysUntilDue: daysUntilDueValue,
          structureType: structureTypeValue,
          cotisationsEnabled: cotisationsEnabledValue,
          cotisationAmount: cotisationAmountValue,
          cotisationDuration: cotisationDurationValue,
          stripeIntegrationEnabled: stripeIntegrationEnabledValue,
          stripePublishableKey: stripePublishableKeyValue,
          stripeSecretKey: stripeSecretKeyValue,
          stripeProductId: stripeProductIdValue,
          stripeBuyButtonId: stripeBuyButtonIdValue
        });
      }

      const programsDoc = await getDoc(doc(db, 'programs', sid));
      if (programsDoc.exists()) {
        const data = programsDoc.data();
        setPrograms(data.programs || []);
      } else {
        setPrograms([]);
      }

      // Charger les utilisateurs avec des cotisations payées
      await loadUsersWithSubscriptions(sid);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      showSnackbar('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadUsersWithSubscriptions = async (structureId: string) => {
    try {
      setLoadingUsers(true);
      
      // Récupérer tous les utilisateurs de cette structure avec des cotisations actives
      const usersQuery = query(
        collection(db, 'users'),
        where('structureId', '==', structureId),
        where('hasActiveSubscription', '==', true)
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          subscriptionPaidAt: data.subscriptionPaidAt?.toDate() || new Date(),
          subscriptionExpiresAt: data.subscriptionExpiresAt?.toDate() || new Date()
        };
      });
      
      setUsersWithSubscriptions(users);
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs avec cotisations:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fonction pour détecter les changements
  const checkForChanges = () => {
    setHasChanges({
      hourlyRate: hourlyRate !== originalValues.hourlyRate,
      daysUntilDue: daysUntilDue !== originalValues.daysUntilDue,
      structureType: structureType !== originalValues.structureType,
      cotisations: cotisationsEnabled !== originalValues.cotisationsEnabled ||
                  cotisationAmount !== originalValues.cotisationAmount ||
                  cotisationDuration !== originalValues.cotisationDuration ||
                  stripeIntegrationEnabled !== originalValues.stripeIntegrationEnabled ||
                  stripePublishableKey !== originalValues.stripePublishableKey ||
                  stripeSecretKey !== originalValues.stripeSecretKey ||
                  stripeProductId !== originalValues.stripeProductId ||
                  stripeBuyButtonId !== originalValues.stripeBuyButtonId
    });
  };

  // Effet pour vérifier les changements
  useEffect(() => {
    checkForChanges();
  }, [hourlyRate, daysUntilDue, structureType, cotisationsEnabled, cotisationAmount, cotisationDuration,
      stripeIntegrationEnabled, stripePublishableKey, stripeSecretKey, stripeProductId, stripeBuyButtonId]);

  const handleSaveHourlyRate = async () => {
    if (!structureId) return;

    try {
      setSavingStates(prev => ({ ...prev, hourlyRate: true }));
      await updateDoc(doc(db, 'structures', structureId), {
        hourlyRate,
        daysUntilDue
      });
      
      // Mettre à jour les valeurs originales après sauvegarde
      setOriginalValues(prev => ({
        ...prev,
        hourlyRate,
        daysUntilDue
      }));
      
      showSnackbar('Taux horaire mis à jour avec succès', 'success');
    } catch (error) {
      console.error('Erreur lors de la mise à jour du taux horaire:', error);
      showSnackbar('Erreur lors de la mise à jour du taux horaire', 'error');
    } finally {
      setSavingStates(prev => ({ ...prev, hourlyRate: false }));
    }
  };

  const handleSaveDaysUntilDue = async () => {
    if (!structureId) return;

    try {
      setSavingStates(prev => ({ ...prev, daysUntilDue: true }));
      await updateDoc(doc(db, 'structures', structureId), {
        daysUntilDue
      });
      
      // Mettre à jour les valeurs originales après sauvegarde
      setOriginalValues(prev => ({
        ...prev,
        daysUntilDue
      }));
      
      showSnackbar('Configuration des factures mise à jour avec succès', 'success');
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la configuration des factures:', error);
      showSnackbar('Erreur lors de la mise à jour de la configuration des factures', 'error');
    } finally {
      setSavingStates(prev => ({ ...prev, daysUntilDue: false }));
    }
  };

  const handleSavePrograms = async () => {
    if (!structureId) return;

    try {
      setSavingStates(prev => ({ ...prev, programs: true }));
      await updateDoc(doc(db, 'structures', structureId), {
        programs
      });
      showSnackbar('Programmes mis à jour avec succès', 'success');
    } catch (error) {
      console.error('Erreur lors de la mise à jour des programmes:', error);
      showSnackbar('Erreur lors de la mise à jour des programmes', 'error');
    } finally {
      setSavingStates(prev => ({ ...prev, programs: false }));
    }
  };

  const handleSaveStructureType = async () => {
    if (!structureId) return;

    try {
      setSavingStates(prev => ({ ...prev, structureType: true }));
      await updateDoc(doc(db, 'structures', structureId), {
        structureType
      });
      
      // Mettre à jour les valeurs originales après sauvegarde
      setOriginalValues(prev => ({
        ...prev,
        structureType
      }));
      
      showSnackbar('Type de structure mis à jour avec succès', 'success');
      
      // Refresh de la page après un délai pour permettre l'affichage du message de succès
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du type de structure:', error);
      showSnackbar('Erreur lors de la mise à jour du type de structure', 'error');
    } finally {
      setSavingStates(prev => ({ ...prev, structureType: false }));
    }
  };

  const handleSaveCotisations = async () => {
    if (!structureId) return;

    // Validation des clés Stripe si l'intégration est activée
    if (stripeIntegrationEnabled) {
      if (!stripePublishableKey.trim() || !stripeSecretKey.trim() || !stripeProductId.trim() || !stripeBuyButtonId.trim()) {
        showSnackbar('Veuillez remplir toutes les clés Stripe', 'error');
        return;
      }
    }

    try {
      setSavingStates(prev => ({ ...prev, cotisations: true }));
      
      const cotisationsData: any = {
        cotisationsEnabled,
        cotisationAmount: cotisationsEnabled ? cotisationAmount : 0,
        cotisationDuration: cotisationsEnabled ? cotisationDuration : '1_year',
        stripeIntegrationEnabled: stripeIntegrationEnabled,
        stripePublishableKey: stripeIntegrationEnabled ? stripePublishableKey : '',
        stripeSecretKey: stripeIntegrationEnabled ? stripeSecretKey : '',
        stripeProductId: stripeIntegrationEnabled ? stripeProductId : '',
        stripeBuyButtonId: stripeIntegrationEnabled ? stripeBuyButtonId : ''
      };

      await updateDoc(doc(db, 'structures', structureId), cotisationsData);
      
      // Mettre à jour les valeurs originales immédiatement après la sauvegarde
      setOriginalValues(prev => ({
        ...prev,
        cotisationsEnabled,
        cotisationAmount: cotisationsEnabled ? cotisationAmount : 0,
        cotisationDuration: cotisationsEnabled ? cotisationDuration : '1_year',
        stripeIntegrationEnabled,
        stripePublishableKey: stripeIntegrationEnabled ? stripePublishableKey : '',
        stripeSecretKey: stripeIntegrationEnabled ? stripeSecretKey : '',
        stripeProductId: stripeIntegrationEnabled ? stripeProductId : '',
        stripeBuyButtonId: stripeIntegrationEnabled ? stripeBuyButtonId : ''
      }));
      
      showSnackbar('Configuration des cotisations mise à jour avec succès', 'success');
    } catch (error) {
      console.error('Erreur lors de la mise à jour des cotisations:', error);
      showSnackbar('Erreur lors de la mise à jour des cotisations', 'error');
    } finally {
      setSavingStates(prev => ({ ...prev, cotisations: false }));
    }
  };

  const handleAddProgram = async () => {
    if (!currentUser?.uid) {
      showSnackbar("Vous devez être connecté", "error");
      return;
    }

    if (!newProgram.trim()) {
      showSnackbar("Le nom du programme ne peut pas être vide", "error");
      return;
    }

    try {
      setSavingStates(prev => ({ ...prev, programs: true }));
      
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!userDoc.exists()) {
        showSnackbar("Utilisateur non trouvé", "error");
        return;
      }

      const userData = userDoc.data();
      const { structureId, ecole } = userData;

      if (!structureId || !ecole) {
        showSnackbar("Informations de structure manquantes", "error");
        return;
      }

      const programsRef = doc(db, 'programs', structureId);
      const programsDoc = await getDoc(programsRef);

      if (!programsDoc.exists()) {
        await setDoc(programsRef, {
          schoolName: ecole,
          programs: [newProgram.trim()]
        });
      } else {
        const existingPrograms = programsDoc.data().programs || [];
        await updateDoc(programsRef, {
          programs: [...existingPrograms, newProgram.trim()]
        });
      }
      
      setPrograms(prev => [...prev, newProgram.trim()]);
      setNewProgram('');
      showSnackbar('Programme ajouté avec succès', 'success');
    } catch (error) {
      console.error('Erreur complète:', error);
      showSnackbar('Erreur lors de l\'ajout du programme', 'error');
    } finally {
      setSavingStates(prev => ({ ...prev, programs: false }));
    }
  };

  const handleDeleteProgram = async (index: number) => {
    if (!structureId) return;

    try {
      setSavingStates(prev => ({ ...prev, programs: true }));
      const programsRef = doc(db, 'programs', structureId);
      const updatedPrograms = programs.filter((_, i) => i !== index);
      
      await updateDoc(programsRef, {
        programs: updatedPrograms
      });
      
      setPrograms(updatedPrograms);
      showSnackbar('Programme supprimé avec succès', 'success');
    } catch (error) {
      console.error('Erreur lors de la suppression du programme:', error);
      showSnackbar('Erreur lors de la suppression du programme', 'error');
    } finally {
      setSavingStates(prev => ({ ...prev, programs: false }));
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  if (initialLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <BackButton />
        <Box sx={{ mt: 2 }}>
          <Skeleton variant="text" width="60%" height={40} />
          <Skeleton variant="text" width="40%" height={24} sx={{ mt: 1 }} />
          <Box sx={{ mt: 3 }}>
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1, mt: 2 }} />
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1, mt: 2 }} />
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      p: 3, 
      minHeight: '100vh', 
      background: `linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)`,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      '@keyframes pulse': {
        '0%': {
          opacity: 1,
        },
        '50%': {
          opacity: 0.7,
        },
        '100%': {
          opacity: 1,
        },
      },
    }}>
      <BackButton />
      
      <Box sx={{ mt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 4 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '16px',
              background: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
            }}
          >
            <SettingsIcon sx={{ color: 'white', fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h4" sx={{ 
              fontWeight: 700, 
              background: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 0.5
            }}>
              Configuration
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.1rem' }}>
              Paramètres de votre structure
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Type de Structure */}
          <Grid item xs={12}>
            <Card 
              elevation={0} 
              sx={{ 
                borderRadius: '20px',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)'
                }
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 4 }}>
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: '16px',
                      background: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)'
                    }}
                  >
                    <BusinessIcon sx={{ color: 'white', fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                      Type de structure
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Choisissez le type de votre structure
                    </Typography>
                  </Box>
                </Box>

                <FormControl fullWidth sx={{ mb: 4 }}>
                  <Select
                    value={structureType}
                    onChange={(e) => setStructureType(e.target.value as 'jobservice' | 'junior')}
                    sx={{ 
                      borderRadius: '12px',
                      '& .MuiOutlinedInput-notchedOutline': {
                        border: '2px solid rgba(102, 126, 234, 0.2)',
                        borderRadius: '12px'
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        border: '2px solid rgba(102, 126, 234, 0.4)'
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        border: '2px solid #667eea'
                      }
                    }}
                  >
                    <MenuItem value="jobservice">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <WorkIcon sx={{ color: theme.palette.primary.main }} />
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            Job Service
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Gestion des missions et des étudiants
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                    <MenuItem value="junior">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <BusinessIcon sx={{ color: theme.palette.secondary.main }} />
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            Junior Entreprise
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Gestion des études et des consultants
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {hasChanges.structureType && (
                    <Chip
                      label="Modifications non sauvegardées"
                      color="warning"
                      size="small"
                      icon={<ErrorIcon />}
                      sx={{ 
                        borderRadius: '12px',
                        fontWeight: 600,
                        animation: 'pulse 2s infinite'
                      }}
                    />
                  )}
                  <Button
                    variant="contained"
                    onClick={handleSaveStructureType}
                    disabled={savingStates.structureType || !hasChanges.structureType}
                    startIcon={savingStates.structureType ? <LinearProgress sx={{ width: 20, height: 20 }} /> : <SaveIcon />}
                    fullWidth
                    sx={{ 
                      borderRadius: '16px',
                      py: 1.5,
                      background: hasChanges.structureType 
                        ? `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
                        : '#e2e8f0',
                      boxShadow: hasChanges.structureType 
                        ? '0 8px 24px rgba(102, 126, 234, 0.3)'
                        : 'none',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        background: hasChanges.structureType 
                          ? `linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)`
                          : '#e2e8f0',
                        boxShadow: hasChanges.structureType 
                          ? '0 12px 32px rgba(102, 126, 234, 0.4)'
                          : 'none',
                        transform: hasChanges.structureType ? 'translateY(-2px)' : 'none'
                      },
                      '&:disabled': {
                        background: '#e2e8f0',
                        boxShadow: 'none',
                        transform: 'none'
                      }
                    }}
                  >
                    {savingStates.structureType ? 'Enregistrement...' : hasChanges.structureType ? 'Enregistrer' : 'Enregistré'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Prix et Factures */}
          <Grid item xs={12} md={6}>
            <Card 
              elevation={0} 
              sx={{ 
                borderRadius: '20px',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.3s ease',
                height: '100%',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)'
                }
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 4 }}>
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: '16px',
                      background: `linear-gradient(135deg, #10b981 0%, #059669 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    <EuroIcon sx={{ color: 'white', fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                      Taux horaire
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Taux horaire par défaut
                    </Typography>
                  </Box>
                </Box>

                <TextField
                  label="Taux horaire HT"
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  InputProps={{
                    endAdornment: <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>€/h</Typography>,
                    sx: { 
                      borderRadius: '12px',
                      '& .MuiOutlinedInput-notchedOutline': {
                        border: '2px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: '12px'
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        border: '2px solid rgba(16, 185, 129, 0.4)'
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        border: '2px solid #10b981'
                      }
                    }
                  }}
                  fullWidth
                  sx={{ mb: 4 }}
                />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {hasChanges.hourlyRate && (
                    <Chip
                      label="Modifications non sauvegardées"
                      color="warning"
                      size="small"
                      icon={<ErrorIcon />}
                      sx={{ 
                        borderRadius: '12px',
                        fontWeight: 600,
                        animation: 'pulse 2s infinite'
                      }}
                    />
                  )}
                  <Button
                    variant="contained"
                    onClick={handleSaveHourlyRate}
                    disabled={savingStates.hourlyRate || !hasChanges.hourlyRate}
                    startIcon={savingStates.hourlyRate ? <LinearProgress sx={{ width: 20, height: 20 }} /> : <SaveIcon />}
                    fullWidth
                    sx={{ 
                      borderRadius: '16px',
                      py: 1.5,
                      background: hasChanges.hourlyRate 
                        ? `linear-gradient(135deg, #10b981 0%, #059669 100%)`
                        : '#e2e8f0',
                      boxShadow: hasChanges.hourlyRate 
                        ? '0 8px 24px rgba(16, 185, 129, 0.3)'
                        : 'none',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        background: hasChanges.hourlyRate 
                          ? `linear-gradient(135deg, #059669 0%, #047857 100%)`
                          : '#e2e8f0',
                        boxShadow: hasChanges.hourlyRate 
                          ? '0 12px 32px rgba(16, 185, 129, 0.4)'
                          : 'none',
                        transform: hasChanges.hourlyRate ? 'translateY(-2px)' : 'none'
                      },
                      '&:disabled': {
                        background: '#e2e8f0',
                        boxShadow: 'none',
                        transform: 'none'
                      }
                    }}
                  >
                    {savingStates.hourlyRate ? 'Enregistrement...' : hasChanges.hourlyRate ? 'Enregistrer' : 'Enregistré'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card 
              elevation={0} 
              sx={{ 
                borderRadius: '20px',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.3s ease',
                height: '100%',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)'
                }
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 4 }}>
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: '16px',
                      background: `linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)'
                    }}
                  >
                    <ScheduleIcon sx={{ color: 'white', fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                      Délai de paiement
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Délai d'échéance par défaut
                    </Typography>
                  </Box>
                </Box>

                <TextField
                  label="Jours d'échéance"
                  type="number"
                  value={daysUntilDue}
                  onChange={(e) => setDaysUntilDue(Number(e.target.value))}
                  InputProps={{
                    endAdornment: <Typography variant="body2" color="text.secondary">jours</Typography>,
                    sx: { 
                      borderRadius: '12px',
                      '& .MuiOutlinedInput-notchedOutline': {
                        border: '2px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: '12px'
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        border: '2px solid rgba(59, 130, 246, 0.4)'
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        border: '2px solid #3b82f6'
                      }
                    }
                  }}
                  fullWidth
                  sx={{ mb: 4 }}
                />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {hasChanges.daysUntilDue && (
                    <Chip
                      label="Modifications non sauvegardées"
                      color="warning"
                      size="small"
                      icon={<ErrorIcon />}
                      sx={{ 
                        borderRadius: '12px',
                        fontWeight: 600,
                        animation: 'pulse 2s infinite'
                      }}
                    />
                  )}
                  <Button
                    variant="contained"
                    onClick={handleSaveDaysUntilDue}
                    disabled={savingStates.daysUntilDue || !hasChanges.daysUntilDue}
                    startIcon={savingStates.daysUntilDue ? <LinearProgress sx={{ width: 20, height: 20 }} /> : <SaveIcon />}
                    fullWidth
                    sx={{ 
                      borderRadius: '16px',
                      py: 1.5,
                      background: hasChanges.daysUntilDue 
                        ? `linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)`
                        : '#e2e8f0',
                      boxShadow: hasChanges.daysUntilDue 
                        ? '0 8px 24px rgba(59, 130, 246, 0.3)'
                        : 'none',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        background: hasChanges.daysUntilDue 
                          ? `linear-gradient(135deg, #2563eb 0%, #1e40af 100%)`
                          : '#e2e8f0',
                        boxShadow: hasChanges.daysUntilDue 
                          ? '0 12px 32px rgba(59, 130, 246, 0.4)'
                          : 'none',
                        transform: hasChanges.daysUntilDue ? 'translateY(-2px)' : 'none'
                      },
                      '&:disabled': {
                        background: '#e2e8f0',
                        boxShadow: 'none',
                        transform: 'none'
                      }
                    }}
                  >
                    {savingStates.daysUntilDue ? 'Enregistrement...' : hasChanges.daysUntilDue ? 'Enregistrer' : 'Enregistré'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Cotisations */}
          <Grid item xs={12}>
            <Card 
              elevation={0} 
              sx={{ 
                borderRadius: '20px',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)'
                }
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 4 }}>
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: '16px',
                      background: `linear-gradient(135deg, #f59e0b 0%, #d97706 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 20px rgba(245, 158, 11, 0.3)'
                    }}
                  >
                    <PaymentIcon sx={{ color: 'white', fontSize: 24 }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                      Cotisations
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Configuration des cotisations et paiements
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip
                      label={cotisationsEnabled ? 'Activées' : 'Désactivées'}
                      color={cotisationsEnabled ? 'success' : 'default'}
                      variant="outlined"
                      size="small"
                      sx={{ 
                        borderRadius: '12px',
                        fontWeight: 600
                      }}
                    />
                    <IconButton
                      onClick={() => setCotisationsExpanded(!cotisationsExpanded)}
                      sx={{
                        borderRadius: '12px',
                        color: '#f59e0b',
                        '&:hover': {
                          backgroundColor: 'rgba(245, 158, 11, 0.1)',
                          transform: 'scale(1.1)'
                        },
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {cotisationsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                </Box>

                <Box
                  sx={{
                    overflow: 'hidden',
                    transition: 'all 0.3s ease-in-out',
                    maxHeight: cotisationsExpanded ? '1000px' : '0px',
                    opacity: cotisationsExpanded ? 1 : 0,
                    transform: cotisationsExpanded ? 'translateY(0)' : 'translateY(-20px)'
                  }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={cotisationsEnabled}
                        onChange={(e) => setCotisationsEnabled(e.target.checked)}
                        color="success"
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: '#f59e0b',
                            '&:hover': {
                              backgroundColor: 'rgba(245, 158, 11, 0.08)'
                            }
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: '#f59e0b'
                          }
                        }}
                      />
                    }
                    label="Activer les cotisations"
                    sx={{ mb: 3, '& .MuiFormControlLabel-label': { fontWeight: 600 } }}
                  />

                  {cotisationsEnabled && (
                    <Box sx={{ mb: 4 }}>
                      <Grid container spacing={3}>
                        {/* Montant de la cotisation */}
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="Montant de la cotisation (€)"
                            type="text"
                            value={cotisationDisplayValue}
                            onChange={(e) => {
                              const value = e.target.value;
                              setCotisationDisplayValue(value);
                              
                              // Si la valeur est vide, on met 0
                              if (value === '') {
                                setCotisationAmount(0);
                                return;
                              }
                              
                              // Permettre seulement les chiffres, une virgule ou un point
                              // Nettoyer la valeur en gardant seulement les chiffres et le séparateur
                              let cleanValue = value.replace(/[^0-9,.]/g, '');
                              
                              // Vérifier qu'il n'y a qu'un seul séparateur décimal
                              const separators = (cleanValue.match(/[,.]/g) || []).length;
                              if (separators > 1) {
                                return;
                              }
                              
                              // Remplacer la virgule par un point pour la conversion
                              const normalizedValue = cleanValue.replace(',', '.');
                              const numValue = parseFloat(normalizedValue);
                              
                              if (!isNaN(numValue)) {
                                setCotisationAmount(numValue);
                              }
                            }}
                            inputProps={{
                              inputMode: 'decimal'
                            }}
                            fullWidth
                            sx={{ 
                              '& .MuiOutlinedInput-root': { 
                                borderRadius: '12px',
                                '& .MuiOutlinedInput-notchedOutline': {
                                  border: '2px solid rgba(245, 158, 11, 0.2)',
                                  borderRadius: '12px'
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                  border: '2px solid rgba(245, 158, 11, 0.4)'
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                  border: '2px solid #f59e0b'
                                }
                              } 
                            }}
                          />
                        </Grid>

                        {/* Durée de la cotisation */}
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth>
                            <Select
                              value={cotisationDuration}
                              onChange={(e) => setCotisationDuration(e.target.value as 'end_of_school' | '1_year' | '2_years' | '3_years')}
                              sx={{ 
                                borderRadius: '12px',
                                '& .MuiOutlinedInput-notchedOutline': {
                                  border: '2px solid rgba(245, 158, 11, 0.2)',
                                  borderRadius: '12px'
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                  border: '2px solid rgba(245, 158, 11, 0.4)'
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                  border: '2px solid #f59e0b'
                                }
                              }}
                            >
                              <MenuItem value="end_of_school">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <SchoolIcon sx={{ color: '#f59e0b' }} />
                                  <Box>
                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                      Fin de la scolarité
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      Jusqu'à la fin des études
                                    </Typography>
                                  </Box>
                                </Box>
                              </MenuItem>
                              <MenuItem value="1_year">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <ScheduleIcon sx={{ color: '#f59e0b' }} />
                                  <Box>
                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                      1 an
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      Validité d'un an
                                    </Typography>
                                  </Box>
                                </Box>
                              </MenuItem>
                              <MenuItem value="2_years">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <ScheduleIcon sx={{ color: '#f59e0b' }} />
                                  <Box>
                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                      2 ans
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      Validité de deux ans
                                    </Typography>
                                  </Box>
                                </Box>
                              </MenuItem>
                              <MenuItem value="3_years">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <ScheduleIcon sx={{ color: '#f59e0b' }} />
                                  <Box>
                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                      3 ans
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      Validité de trois ans
                                    </Typography>
                                  </Box>
                                </Box>
                              </MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>

                      <FormControlLabel
                        control={
                          <Switch
                            checked={stripeIntegrationEnabled}
                            onChange={(e) => setStripeIntegrationEnabled(e.target.checked)}
                            color="primary"
                            sx={{
                              '& .MuiSwitch-switchBase.Mui-checked': {
                                color: '#667eea',
                                '&:hover': {
                                  backgroundColor: 'rgba(102, 126, 234, 0.08)'
                                }
                              },
                              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                backgroundColor: '#667eea'
                              }
                            }}
                          />
                        }
                        label="Intégrer Stripe"
                        sx={{ mt: 3, mb: 3, '& .MuiFormControlLabel-label': { fontWeight: 600 } }}
                      />

                      {stripeIntegrationEnabled && (
                        <Box sx={{ mt: 3 }}>
                          <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                              <TextField
                                label="Clé publique Stripe"
                                value={stripePublishableKey}
                                onChange={(e) => setStripePublishableKey(e.target.value)}
                                fullWidth
                                sx={{ 
                                  '& .MuiOutlinedInput-root': { 
                                    borderRadius: '12px',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      border: '2px solid rgba(102, 126, 234, 0.2)',
                                      borderRadius: '12px'
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                      border: '2px solid rgba(102, 126, 234, 0.4)'
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                      border: '2px solid #667eea'
                                    }
                                  } 
                                }}
                                helperText="pk_..."
                              />
                            </Grid>
                            
                            <Grid item xs={12} md={6}>
                              <TextField
                                label="Clé secrète Stripe"
                                value={stripeSecretKey}
                                onChange={(e) => setStripeSecretKey(e.target.value)}
                                fullWidth
                                type="password"
                                sx={{ 
                                  '& .MuiOutlinedInput-root': { 
                                    borderRadius: '12px',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      border: '2px solid rgba(102, 126, 234, 0.2)',
                                      borderRadius: '12px'
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                      border: '2px solid rgba(102, 126, 234, 0.4)'
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                      border: '2px solid #667eea'
                                    }
                                  } 
                                }}
                                helperText="sk_..."
                              />
                            </Grid>
                            
                            <Grid item xs={12} md={6}>
                              <TextField
                                label="ID du produit Stripe"
                                value={stripeProductId}
                                onChange={(e) => setStripeProductId(e.target.value)}
                                fullWidth
                                sx={{ 
                                  '& .MuiOutlinedInput-root': { 
                                    borderRadius: '12px',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      border: '2px solid rgba(102, 126, 234, 0.2)',
                                      borderRadius: '12px'
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                      border: '2px solid rgba(102, 126, 234, 0.4)'
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                      border: '2px solid #667eea'
                                    }
                                  } 
                                }}
                                helperText="prod_... (ID du produit de cotisation dans Stripe)"
                              />
                            </Grid>
                            
                            <Grid item xs={12} md={6}>
                              <TextField
                                label="ID du Buy Button Stripe"
                                value={stripeBuyButtonId}
                                onChange={(e) => setStripeBuyButtonId(e.target.value)}
                                fullWidth
                                sx={{ 
                                  '& .MuiOutlinedInput-root': { 
                                    borderRadius: '12px',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      border: '2px solid rgba(102, 126, 234, 0.2)',
                                      borderRadius: '12px'
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                      border: '2px solid rgba(102, 126, 234, 0.4)'
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                      border: '2px solid #667eea'
                                    }
                                  } 
                                }}
                                helperText="buy_... (ID du Buy Button créé dans Stripe)"
                              />
                            </Grid>
                          </Grid>
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Section Utilisateurs avec cotisations payées */}
                  <Divider sx={{ my: 4, borderColor: 'rgba(245, 158, 11, 0.1)' }} />
                  
                  <Box sx={{ mb: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#f59e0b' }}>
                        Utilisateurs avec cotisations payées ({usersWithSubscriptions.length})
                      </Typography>
                      <IconButton
                        onClick={() => setUsersListExpanded(!usersListExpanded)}
                        sx={{
                          borderRadius: '8px',
                          color: '#f59e0b',
                          '&:hover': {
                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                            transform: 'scale(1.1)'
                          },
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {usersListExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Box>
                    
                    <Box
                      sx={{
                        overflow: 'hidden',
                        transition: 'all 0.3s ease-in-out',
                        maxHeight: usersListExpanded ? '400px' : '0px',
                        opacity: usersListExpanded ? 1 : 0,
                        transform: usersListExpanded ? 'translateY(0)' : 'translateY(-20px)'
                      }}
                    >
                      {loadingUsers ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                          <CircularProgress size={40} sx={{ color: '#f59e0b' }} />
                        </Box>
                      ) : usersWithSubscriptions.length === 0 ? (
                        <Box sx={{ 
                          textAlign: 'center', 
                          py: 4,
                          bgcolor: 'rgba(245, 158, 11, 0.05)',
                          borderRadius: '12px',
                          border: '1px solid rgba(245, 158, 11, 0.1)'
                        }}>
                          <PaymentIcon sx={{ fontSize: 48, color: '#f59e0b', mb: 2, opacity: 0.5 }} />
                          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: '#f59e0b' }}>
                            Aucune cotisation payée
                          </Typography>
                          <Typography color="text.secondary" variant="body1">
                            Aucun utilisateur n'a encore payé sa cotisation
                          </Typography>
                        </Box>
                      ) : (
                        <Box sx={{ maxHeight: '400px', overflow: 'auto' }}>
                          {usersWithSubscriptions.map((user) => (
                            <Paper
                              key={user.id}
                              elevation={0}
                              sx={{
                                mb: 1,
                                p: 2,
                                border: '1px solid rgba(245, 158, 11, 0.1)',
                                borderRadius: '8px',
                                background: 'rgba(245, 158, 11, 0.02)',
                                transition: 'all 0.2s ease',
                                maxWidth: 'calc(100% - 4px)',
                                '&:hover': {
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                  background: 'rgba(245, 158, 11, 0.05)',
                                  transform: 'translateX(2px)'
                                }
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Avatar
                                  sx={{
                                    width: 28,
                                    height: 28,
                                    bgcolor: 'rgba(245, 158, 11, 0.1)',
                                    color: '#f59e0b',
                                    fontWeight: 600,
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  {user.firstName?.[0]}{user.lastName?.[0]}
                                </Avatar>
                                <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25, fontSize: '0.875rem' }}>
                                    {user.firstName} {user.lastName}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                    {user.email}
                                  </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                                  <Chip
                                    label={`Payée le ${user.subscriptionPaidAt.toLocaleDateString('fr-FR')}`}
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                    sx={{ 
                                      borderRadius: '6px',
                                      fontSize: '0.65rem',
                                      height: '18px',
                                      maxWidth: '140px',
                                      '& .MuiChip-label': {
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }
                                    }}
                                  />
                                  <Chip
                                    label={`Expire le ${user.subscriptionExpiresAt.toLocaleDateString('fr-FR')}`}
                                    size="small"
                                    color={user.subscriptionExpiresAt > new Date() ? 'success' : 'error'}
                                    variant="outlined"
                                    sx={{ 
                                      borderRadius: '6px',
                                      fontSize: '0.65rem',
                                      height: '18px',
                                      maxWidth: '140px',
                                      '& .MuiChip-label': {
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }
                                    }}
                                  />
                                </Box>
                                <CheckCircleIcon sx={{ color: '#f59e0b', fontSize: 18, ml: 0.5 }} />
                              </Box>
                            </Paper>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {hasChanges.cotisations && (
                    <Chip
                      label="Modifications non sauvegardées"
                      color="warning"
                      size="small"
                      icon={<ErrorIcon />}
                      sx={{ 
                        borderRadius: '12px',
                        fontWeight: 600,
                        animation: 'pulse 2s infinite'
                      }}
                    />
                  )}
                  <Button
                    variant="contained"
                    onClick={handleSaveCotisations}
                    disabled={savingStates.cotisations || !hasChanges.cotisations}
                    startIcon={savingStates.cotisations ? <LinearProgress sx={{ width: 20, height: 20 }} /> : <SaveIcon />}
                    fullWidth
                    sx={{ 
                      borderRadius: '16px',
                      py: 1.5,
                      background: hasChanges.cotisations 
                        ? `linear-gradient(135deg, #f59e0b 0%, #d97706 100%)`
                        : '#e2e8f0',
                      boxShadow: hasChanges.cotisations 
                        ? '0 8px 24px rgba(245, 158, 11, 0.3)'
                        : 'none',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        background: hasChanges.cotisations 
                          ? `linear-gradient(135deg, #d97706 0%, #b45309 100%)`
                          : '#e2e8f0',
                        boxShadow: hasChanges.cotisations 
                          ? '0 12px 32px rgba(245, 158, 11, 0.4)'
                          : 'none',
                        transform: hasChanges.cotisations ? 'translateY(-2px)' : 'none'
                      },
                      '&:disabled': {
                        background: '#e2e8f0',
                        boxShadow: 'none',
                        transform: 'none'
                      }
                    }}
                  >
                    {savingStates.cotisations ? 'Enregistrement...' : hasChanges.cotisations ? 'Enregistrer' : 'Enregistré'}
                  </Button>
                </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Programmes */}
          <Grid item xs={12}>
            <Card 
              elevation={0} 
              sx={{ 
                borderRadius: '20px',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)'
                }
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 4 }}>
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: '16px',
                      background: `linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 20px rgba(139, 92, 246, 0.3)'
                    }}
                  >
                    <SchoolIcon sx={{ color: 'white', fontSize: 24 }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                      Programmes
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Programmes de formation disponibles
                    </Typography>
                  </Box>
                  <Chip
                    label={`${programs.length} programme${programs.length > 1 ? 's' : ''}`}
                    color="primary"
                    variant="outlined"
                    size="small"
                    sx={{ 
                      borderRadius: '12px',
                      fontWeight: 600
                    }}
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 4 }}>
                  <TextField
                    label="Nouveau programme"
                    value={newProgram}
                    onChange={(e) => setNewProgram(e.target.value)}
                    placeholder="Entrez le nom du programme"
                    fullWidth
                    sx={{ 
                      '& .MuiOutlinedInput-root': { 
                        borderRadius: '12px',
                        '& .MuiOutlinedInput-notchedOutline': {
                          border: '2px solid rgba(139, 92, 246, 0.2)',
                          borderRadius: '12px'
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          border: '2px solid rgba(139, 92, 246, 0.4)'
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          border: '2px solid #8b5cf6'
                        }
                      } 
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !savingStates.programs) {
                        e.preventDefault();
                        handleAddProgram();
                      }
                    }}
                  />
                  <Button
                    variant="outlined"
                    onClick={handleAddProgram}
                    disabled={savingStates.programs || !newProgram.trim()}
                    startIcon={savingStates.programs ? <LinearProgress sx={{ width: 20, height: 20 }} /> : <AddIcon />}
                    sx={{ 
                      borderRadius: '16px', 
                      minWidth: 120,
                      py: 1.5,
                      border: '2px solid rgba(139, 92, 246, 0.3)',
                      color: '#8b5cf6',
                      fontWeight: 600,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        border: '2px solid #8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.08)',
                        transform: 'translateY(-1px)'
                      }
                    }}
                  >
                    {savingStates.programs ? 'Ajout...' : 'Ajouter'}
                  </Button>
                </Box>

                <Divider sx={{ my: 3, borderColor: 'rgba(139, 92, 246, 0.1)' }} />

                {programs.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Box
                      sx={{
                        width: 80,
                        height: 80,
                        borderRadius: '20px',
                        background: 'rgba(139, 92, 246, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2
                      }}
                    >
                      <SchoolIcon sx={{ fontSize: 40, color: '#8b5cf6' }} />
                    </Box>
                    <Typography color="text.secondary" variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                      Aucun programme
                    </Typography>
                    <Typography color="text.secondary" variant="body1">
                      Commencez par ajouter votre premier programme
                    </Typography>
                  </Box>
                ) : (
                  <List sx={{ p: 0 }}>
                    {programs.map((program, index) => (
                      <Paper
                        key={index}
                        elevation={0}
                        sx={{
                          mb: 2,
                          border: '1px solid rgba(139, 92, 246, 0.1)',
                          borderRadius: '12px',
                          background: 'rgba(139, 92, 246, 0.02)',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            background: 'rgba(139, 92, 246, 0.05)',
                            transform: 'translateX(4px)'
                          }
                        }}
                      >
                        <ListItem
                          sx={{ py: 2 }}
                          secondaryAction={
                            <Tooltip title="Supprimer">
                              <IconButton
                                edge="end"
                                onClick={() => handleDeleteProgram(index)}
                                color="error"
                                size="small"
                                sx={{
                                  borderRadius: '8px',
                                  '&:hover': {
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)'
                                  }
                                }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          }
                        >
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box
                                  sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '8px',
                                    background: 'rgba(139, 92, 246, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <SchoolIcon sx={{ fontSize: 16, color: '#8b5cf6' }} />
                                </Box>
                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                  {program}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                      </Paper>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          icon={snackbar.severity === 'success' ? <CheckCircleIcon /> : <ErrorIcon />}
          sx={{ 
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.3)'
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default StructureSettings; 