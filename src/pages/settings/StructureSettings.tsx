import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Box,
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
  ExpandLess as ExpandLessIcon,
  Edit as EditIcon,
  CloudUpload as CloudUploadIcon,
  Info as InfoIcon,
  Security as SecurityIcon,
  People as PeopleIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { doc, updateDoc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import SettingsCard from '../../components/settings/SettingsCard';

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
  const [f2aRequiredForMembers, setF2aRequiredForMembers] = useState<boolean>(false);
  const [f2aRequiredForStudents, setF2aRequiredForStudents] = useState<boolean>(false);
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
    f2a: boolean;
  }>({
    hourlyRate: false,
    daysUntilDue: false,
    programs: false,
    structureType: false,
    cotisations: false,
    f2a: false
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
    f2aRequiredForMembers: boolean;
    f2aRequiredForStudents: boolean;
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
    stripeBuyButtonId: '',
    f2aRequiredForMembers: false,
    f2aRequiredForStudents: false
  });

  const [hasChanges, setHasChanges] = useState<{
    hourlyRate: boolean;
    daysUntilDue: boolean;
    structureType: boolean;
    cotisations: boolean;
    f2a: boolean;
  }>({
    hourlyRate: false,
    daysUntilDue: false,
    structureType: false,
    cotisations: false,
    f2a: false
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
  
  // États pour les informations de l'organisation
  const [organization, setOrganization] = useState<{
    name: string;
    logo: string;
    address: string;
    city: string;
    postalCode: string;
    phone: string;
    email: string;
    website: string;
    description: string;
    siret: string;
    tvaNumber: string;
    apeCode: string;
  }>({
    name: 'Structure non détectée',
    logo: '',
    address: 'Non renseigné',
    city: 'Non renseigné',
    postalCode: 'Non renseigné',
    phone: 'Non renseigné',
    email: 'Non renseigné',
    website: 'Non renseigné',
    description: 'Non renseigné',
    siret: '',
    tvaNumber: '',
    apeCode: ''
  });
  const [editingOrg, setEditingOrg] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [savingOrgInfo, setSavingOrgInfo] = useState(false);

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
        const f2aRequiredForMembersValue = data.f2aRequiredForMembers || false;
        const f2aRequiredForStudentsValue = data.f2aRequiredForStudents || false;

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
        setF2aRequiredForMembers(f2aRequiredForMembersValue);
        setF2aRequiredForStudents(f2aRequiredForStudentsValue);
        
        // Charger les informations de l'organisation
        setOrganization({
          name: data.nom || 'Structure non détectée',
          logo: data.logo || '',
          address: data.address || data.adresse || 'Non renseigné',
          city: data.city || data.ville || 'Non renseigné',
          postalCode: data.postalCode || data.codePostal || 'Non renseigné',
          phone: data.phone || data.telephone || 'Non renseigné',
          email: data.email || 'Non renseigné',
          website: data.website || data.siteWeb || 'Non renseigné',
          description: data.description || 'Non renseigné',
          siret: data.siret || '',
          tvaNumber: data.tvaNumber || '',
          apeCode: data.apeCode || ''
        });

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
          stripeBuyButtonId: stripeBuyButtonIdValue,
          f2aRequiredForMembers: f2aRequiredForMembersValue,
          f2aRequiredForStudents: f2aRequiredForStudentsValue
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
                  stripeBuyButtonId !== originalValues.stripeBuyButtonId,
      f2a: f2aRequiredForMembers !== originalValues.f2aRequiredForMembers ||
           f2aRequiredForStudents !== originalValues.f2aRequiredForStudents
    });
  };

  // Effet pour vérifier les changements
  useEffect(() => {
    checkForChanges();
  }, [hourlyRate, daysUntilDue, structureType, cotisationsEnabled, cotisationAmount, cotisationDuration,
      stripeIntegrationEnabled, stripePublishableKey, stripeSecretKey, stripeProductId, stripeBuyButtonId,
      f2aRequiredForMembers, f2aRequiredForStudents]);

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

  const handleSaveF2A = async () => {
    if (!structureId) return;

    try {
      setSavingStates(prev => ({ ...prev, f2a: true }));
      
      await updateDoc(doc(db, 'structures', structureId), {
        f2aRequiredForMembers,
        f2aRequiredForStudents
      });
      
      // Mettre à jour les valeurs originales après sauvegarde
      setOriginalValues(prev => ({
        ...prev,
        f2aRequiredForMembers,
        f2aRequiredForStudents
      }));
      
      showSnackbar('Configuration F2A mise à jour avec succès', 'success');
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la configuration F2A:', error);
      showSnackbar('Erreur lors de la mise à jour de la configuration F2A', 'error');
    } finally {
      setSavingStates(prev => ({ ...prev, f2a: false }));
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

  // Gérer la modification des informations de l'organisation
  const handleOrgChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setOrganization(prev => ({
      ...prev,
      [name]: value || ''
    }));
  };

  // Fonction pour sauvegarder les modifications de la structure
  const handleSaveOrg = async () => {
    if (!structureId) return;

    try {
      setSavingOrgInfo(true);
      
      await updateDoc(doc(db, 'structures', structureId), {
        nom: organization.name,
        address: organization.address,
        adresse: organization.address,
        city: organization.city,
        ville: organization.city,
        postalCode: organization.postalCode,
        codePostal: organization.postalCode,
        phone: organization.phone,
        telephone: organization.phone,
        email: organization.email,
        website: organization.website,
        siteWeb: organization.website,
        description: organization.description,
        siret: organization.siret,
        tvaNumber: organization.tvaNumber,
        apeCode: organization.apeCode,
        updatedAt: new Date()
      });

      setEditingOrg(false);
      showSnackbar('Informations mises à jour avec succès', 'success');
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      showSnackbar('Erreur lors de la mise à jour des informations', 'error');
    } finally {
      setSavingOrgInfo(false);
    }
  };

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleUploadLogo = async () => {
    if (!logoFile || !structureId) {
      showSnackbar('Veuillez sélectionner un fichier', 'error');
      return;
    }

    try {
      setLoading(true);

      if (logoFile.size > 5 * 1024 * 1024) {
        throw new Error('Le fichier doit faire moins de 5MB');
      }

      if (!logoFile.type.startsWith('image/')) {
        throw new Error('Le fichier doit être une image');
      }

      const logoRef = ref(storage, `structures/${structureId}/logo`);
      await uploadBytes(logoRef, logoFile);
      const logoUrl = await getDownloadURL(logoRef);

      await updateDoc(doc(db, 'structures', structureId), {
        logo: logoUrl,
        updatedAt: new Date()
      });

      setOrganization(prev => ({
        ...prev,
        logo: logoUrl
      }));

      setLogoFile(null);
      setLogoPreview('');
      showSnackbar('Logo mis à jour avec succès', 'success');
    } catch (error) {
      console.error('Erreur lors du téléchargement du logo:', error);
      showSnackbar(error instanceof Error ? error.message : 'Erreur lors du téléchargement du logo', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
        <Box sx={{ mt: 2 }}>
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, mt: 2 }} />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      p: 3,
      maxWidth: 1400,
      mx: 'auto',
      '@keyframes pulse': {
        '0%': { opacity: 1 },
        '50%': { opacity: 0.7 },
        '100%': { opacity: 1 },
      },
    }}>
      {/* En-tête */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: '#1d1d1f' }}>
          Paramètres de la structure
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Gérez les informations et la configuration de votre structure
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Informations de la structure */}
        <Grid item xs={12}>
          <SettingsCard
            title="Informations de la structure"
            subtitle="Gérez les informations générales de votre structure"
            icon={<InfoIcon sx={{ fontSize: 16 }} />}
            gradient="linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
            iconColor="#6366f1"
          >
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <IconButton
                onClick={() => {
                  if (editingOrg) {
                    handleSaveOrg();
                  } else {
                    setEditingOrg(true);
                  }
                }}
                size="small"
                sx={{
                  borderRadius: '6px',
                  color: '#86868b',
                  '&:hover': {
                    backgroundColor: '#f5f5f7'
                  }
                }}
                disabled={savingOrgInfo}
              >
                {savingOrgInfo ? <CircularProgress size={16} /> : editingOrg ? <SaveIcon fontSize="small" /> : <EditIcon fontSize="small" />}
              </IconButton>
            </Box>

            {editingOrg ? (
              <Box>
                <Grid container spacing={3}>
                  {/* Logo Section */}
                  <Grid item xs={12} md={3}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      {(logoPreview || organization.logo) && (
                        <Avatar
                          src={logoPreview || organization.logo}
                          sx={{
                            width: 120,
                            height: 120,
                            borderRadius: '16px',
                            border: '2px solid #e5e5ea'
                          }}
                        />
                      )}
                      <Box sx={{ width: '100%' }}>
                        <input
                          id="logo-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                          style={{ display: 'none' }}
                        />
                        <Button
                          variant="outlined"
                          startIcon={<CloudUploadIcon />}
                          disabled={loading}
                          fullWidth
                          onClick={() => {
                            const input = document.getElementById('logo-upload');
                            if (input) input.click();
                          }}
                          sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            border: '1px solid #d1d1d6',
                            color: '#1d1d1f',
                            '&:hover': {
                              border: '1px solid #86868b',
                              backgroundColor: '#f5f5f7'
                            }
                          }}
                        >
                          Changer le logo
                        </Button>
                      </Box>
                      {logoFile && (
                        <Button
                          variant="contained"
                          onClick={handleUploadLogo}
                          disabled={loading}
                          fullWidth
                          sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            backgroundColor: '#0071e3',
                            '&:hover': {
                              backgroundColor: '#0077ed'
                            }
                          }}
                        >
                          {loading ? 'Téléchargement...' : 'Télécharger'}
                        </Button>
                      )}
                    </Box>
                  </Grid>

                  {/* Form Fields */}
                  <Grid item xs={12} md={9}>
                    <Grid container spacing={2}>
          <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Nom de l'organisation"
                      name="name"
                      value={organization.name}
                      onChange={handleOrgChange}
              sx={{ 
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '8px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #d1d1d6'
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #86868b'
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            border: '2px solid #0071e3'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Adresse"
                      name="address"
                      value={organization.address || ''}
                      onChange={handleOrgChange}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '8px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #d1d1d6'
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #86868b'
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            border: '2px solid #0071e3'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Ville"
                      name="city"
                      value={organization.city || ''}
                      onChange={handleOrgChange}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '8px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #d1d1d6'
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #86868b'
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            border: '2px solid #0071e3'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Code postal"
                      name="postalCode"
                      value={organization.postalCode || ''}
                      onChange={handleOrgChange}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '8px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #d1d1d6'
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #86868b'
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            border: '2px solid #0071e3'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Téléphone"
                      name="phone"
                      value={organization.phone || ''}
                      onChange={handleOrgChange}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '8px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #d1d1d6'
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #86868b'
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            border: '2px solid #0071e3'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Email"
                      name="email"
                      value={organization.email || ''}
                      onChange={handleOrgChange}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '8px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #d1d1d6'
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #86868b'
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            border: '2px solid #0071e3'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Site web"
                      name="website"
                      value={organization.website || ''}
                      onChange={handleOrgChange}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '8px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #d1d1d6'
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #86868b'
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            border: '2px solid #0071e3'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Description"
                      name="description"
                      value={organization.description || ''}
                      onChange={handleOrgChange}
                      multiline
                      rows={3}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '8px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #d1d1d6'
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #86868b'
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            border: '2px solid #0071e3'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="SIRET"
                      name="siret"
                      value={organization.siret}
                      onChange={handleOrgChange}
                      placeholder="Entrez le numéro SIRET"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '8px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #d1d1d6'
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #86868b'
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            border: '2px solid #0071e3'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="N° de TVA"
                      name="tvaNumber"
                      value={organization.tvaNumber}
                      onChange={handleOrgChange}
                      placeholder="Entrez le numéro de TVA"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '8px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #d1d1d6'
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #86868b'
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            border: '2px solid #0071e3'
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Code APE"
                      name="apeCode"
                      value={organization.apeCode}
                      onChange={handleOrgChange}
                      placeholder="Entrez le code APE"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '8px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #d1d1d6'
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            border: '1px solid #86868b'
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            border: '2px solid #0071e3'
                          }
                        }
                      }}
                    />
                    </Grid>
                  </Grid>
                </Grid>
                </Grid>
              </Box>
            ) : (
              <Grid container spacing={3}>
                {organization.logo && (
                  <Grid item xs={12} md={3}>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      <Avatar
                        src={organization.logo}
                        sx={{
                          width: 120,
                          height: 120,
                          borderRadius: '16px',
                          border: '2px solid #e5e5ea'
                        }}
                      />
                    </Box>
                  </Grid>
                )}
                <Grid item xs={12} md={organization.logo ? 9 : 12}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: '#1d1d1f' }}>
                        {organization.name}
                      </Typography>
                      {organization.description && organization.description !== 'Non renseigné' && (
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                          {organization.description}
                        </Typography>
                      )}
                    </Box>
                    <Divider />
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Adresse</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>{organization.address}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Ville</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>{organization.city || 'Non renseigné'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Code postal</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>{organization.postalCode || 'Non renseigné'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Téléphone</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>{organization.phone}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Email</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>{organization.email}</Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Site web</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>{organization.website}</Typography>
                      </Grid>
                      {organization.siret && (
                        <Grid item xs={12} sm={4}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>SIRET</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>{organization.siret}</Typography>
                        </Grid>
                      )}
                      {organization.tvaNumber && (
                        <Grid item xs={12} sm={4}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>N° de TVA</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>{organization.tvaNumber}</Typography>
                        </Grid>
                      )}
                      {organization.apeCode && (
                        <Grid item xs={12} sm={4}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Code APE</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>{organization.apeCode}</Typography>
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                </Grid>
              </Grid>
            )}
          </SettingsCard>
        </Grid>

        {/* Section Configuration */}
        <Grid item xs={12}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, color: '#1d1d1f' }}>
            Configuration
          </Typography>
        </Grid>

        {/* Type de Structure */}
        <Grid item xs={12} md={4}>
          <SettingsCard
            title="Type de structure"
            subtitle="Choisissez le type de votre structure"
            icon={<BusinessIcon sx={{ fontSize: 16 }} />}
            gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            iconColor="#667eea"
          >
            <FormControl fullWidth sx={{ mb: 2.5 }}>
                  <Select
                    value={structureType}
                    onChange={(e) => setStructureType(e.target.value as 'jobservice' | 'junior')}
                    sx={{ 
                  borderRadius: '8px',
                      '& .MuiOutlinedInput-notchedOutline': {
                    border: '1px solid #d1d1d6',
                    borderRadius: '8px'
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                    border: '1px solid #86868b'
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    border: '2px solid #0071e3'
                      }
                    }}
                  >
                    <MenuItem value="jobservice">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <WorkIcon sx={{ color: theme.palette.primary.main, fontSize: 18 }} />
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          Junior
                        </Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem value="junior">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <BusinessIcon sx={{ color: theme.palette.secondary.main, fontSize: 18 }} />
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          Junior Entreprise
                        </Typography>
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {hasChanges.structureType && (
                    <Chip
                      label="Modifications non sauvegardées"
                      color="warning"
                      size="small"
                      icon={<ErrorIcon />}
                      sx={{ 
                  borderRadius: '6px',
                  fontWeight: 500,
                  fontSize: '0.75rem',
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
                  borderRadius: '6px',
                  py: 1,
                  px: 2,
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                      background: hasChanges.structureType 
                    ? '#0071e3'
                    : '#f5f5f7',
                  color: hasChanges.structureType ? '#ffffff' : '#86868b',
                      boxShadow: hasChanges.structureType 
                    ? '0 2px 8px rgba(0, 113, 227, 0.2)'
                        : 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        background: hasChanges.structureType 
                      ? '#0077ed'
                      : '#e5e5ea',
                        boxShadow: hasChanges.structureType 
                      ? '0 4px 12px rgba(0, 113, 227, 0.3)'
                      : 'none'
                      },
                      '&:disabled': {
                    background: '#f5f5f7',
                    color: '#86868b',
                    boxShadow: 'none'
                      }
                    }}
                  >
                    {savingStates.structureType ? 'Enregistrement...' : hasChanges.structureType ? 'Enregistrer' : 'Enregistré'}
                  </Button>
                </Box>
          </SettingsCard>
        </Grid>

        {/* Taux horaire */}
        <Grid item xs={12} md={4}>
          <SettingsCard
            title="Taux horaire"
            subtitle="Taux horaire par défaut"
            icon={<EuroIcon sx={{ fontSize: 16 }} />}
            gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
            iconColor="#10b981"
          >
                <TextField
                  label="Taux horaire HT"
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  InputProps={{
                    endAdornment: <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>€/h</Typography>,
                    sx: { 
                    borderRadius: '8px',
                      '& .MuiOutlinedInput-notchedOutline': {
                      border: '1px solid #d1d1d6',
                      borderRadius: '8px'
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                      border: '1px solid #86868b'
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      border: '2px solid #0071e3'
                      }
                    }
                  }}
                  fullWidth
              sx={{ mb: 2.5 }}
                />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {hasChanges.hourlyRate && (
                    <Chip
                      label="Modifications non sauvegardées"
                      color="warning"
                      size="small"
                      icon={<ErrorIcon />}
                      sx={{ 
                  borderRadius: '6px',
                  fontWeight: 500,
                  fontSize: '0.75rem',
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
                    borderRadius: '8px',
                    py: 1.25,
                    textTransform: 'none',
                    fontWeight: 500,
                      background: hasChanges.hourlyRate 
                      ? '#0071e3'
                      : '#f5f5f7',
                    color: hasChanges.hourlyRate ? '#ffffff' : '#86868b',
                      boxShadow: hasChanges.hourlyRate 
                      ? '0 2px 8px rgba(0, 113, 227, 0.2)'
                        : 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        background: hasChanges.hourlyRate 
                        ? '#0077ed'
                        : '#e5e5ea',
                        boxShadow: hasChanges.hourlyRate 
                        ? '0 4px 12px rgba(0, 113, 227, 0.3)'
                        : 'none'
                      },
                      '&:disabled': {
                      background: '#f5f5f7',
                      color: '#86868b',
                      boxShadow: 'none'
                      }
                    }}
                  >
                    {savingStates.hourlyRate ? 'Enregistrement...' : hasChanges.hourlyRate ? 'Enregistrer' : 'Enregistré'}
                  </Button>
                </Box>
          </SettingsCard>
        </Grid>

        {/* Délai de paiement */}
        <Grid item xs={12} md={4}>
          <SettingsCard
            title="Délai de paiement"
            subtitle="Délai d'échéance par défaut"
            icon={<ScheduleIcon sx={{ fontSize: 16 }} />}
            gradient="linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
            iconColor="#3b82f6"
          >
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
                    border: '1px solid #d1d1d6',
                    borderRadius: '8px'
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                    border: '1px solid #86868b'
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    border: '2px solid #0071e3'
                      }
                    }
                  }}
                  fullWidth
              sx={{ mb: 2.5 }}
                />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {hasChanges.daysUntilDue && (
                    <Chip
                      label="Modifications non sauvegardées"
                      color="warning"
                      size="small"
                      icon={<ErrorIcon />}
                      sx={{ 
                  borderRadius: '6px',
                  fontWeight: 500,
                  fontSize: '0.75rem',
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
                    borderRadius: '8px',
                    py: 1.25,
                    textTransform: 'none',
                    fontWeight: 500,
                      background: hasChanges.daysUntilDue 
                      ? '#0071e3'
                      : '#f5f5f7',
                    color: hasChanges.daysUntilDue ? '#ffffff' : '#86868b',
                      boxShadow: hasChanges.daysUntilDue 
                      ? '0 2px 8px rgba(0, 113, 227, 0.2)'
                        : 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        background: hasChanges.daysUntilDue 
                        ? '#0077ed'
                        : '#e5e5ea',
                        boxShadow: hasChanges.daysUntilDue 
                        ? '0 4px 12px rgba(0, 113, 227, 0.3)'
                        : 'none'
                      },
                      '&:disabled': {
                      background: '#f5f5f7',
                      color: '#86868b',
                      boxShadow: 'none'
                      }
                    }}
                  >
                    {savingStates.daysUntilDue ? 'Enregistrement...' : hasChanges.daysUntilDue ? 'Enregistrer' : 'Enregistré'}
                  </Button>
                </Box>
          </SettingsCard>
        </Grid>

        {/* F2A - Formation à la Sécurité */}
        <Grid item xs={12} md={4}>
          <SettingsCard
            title="F2A obligatoire"
            subtitle="Obliger le F2A à la connexion"
            icon={<SecurityIcon sx={{ fontSize: 16 }} />}
            gradient="linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
            iconColor="#ef4444"
          >
            <Box sx={{ mb: 2.5 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={f2aRequiredForMembers}
                    onChange={(e) => setF2aRequiredForMembers(e.target.checked)}
                    color="error"
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: '#ef4444',
                        '&:hover': {
                          backgroundColor: 'rgba(239, 68, 68, 0.08)'
                        }
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: '#ef4444'
                      }
                    }}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PeopleIcon sx={{ fontSize: 18, color: '#86868b' }} />
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      Obligatoire pour les membres
                    </Typography>
                  </Box>
                }
                sx={{ mb: 2, '& .MuiFormControlLabel-label': { flex: 1 } }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={f2aRequiredForStudents}
                    onChange={(e) => setF2aRequiredForStudents(e.target.checked)}
                    color="error"
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: '#ef4444',
                        '&:hover': {
                          backgroundColor: 'rgba(239, 68, 68, 0.08)'
                        }
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: '#ef4444'
                      }
                    }}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonIcon sx={{ fontSize: 18, color: '#86868b' }} />
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      Obligatoire pour les étudiants
                    </Typography>
                  </Box>
                }
                sx={{ '& .MuiFormControlLabel-label': { flex: 1 } }}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {hasChanges.f2a && (
                <Chip
                  label="Modifications non sauvegardées"
                  color="warning"
                  size="small"
                  icon={<ErrorIcon />}
                  sx={{ 
                    borderRadius: '6px',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    animation: 'pulse 2s infinite',
                    alignSelf: 'flex-start'
                  }}
                />
              )}
              <Button
                variant="contained"
                onClick={handleSaveF2A}
                disabled={savingStates.f2a || !hasChanges.f2a}
                startIcon={savingStates.f2a ? <LinearProgress sx={{ width: 20, height: 20 }} /> : <SaveIcon />}
                fullWidth
                sx={{ 
                  borderRadius: '6px',
                  py: 1,
                  px: 2,
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  background: hasChanges.f2a 
                    ? '#0071e3'
                    : '#f5f5f7',
                  color: hasChanges.f2a ? '#ffffff' : '#86868b',
                  boxShadow: hasChanges.f2a 
                    ? '0 2px 8px rgba(0, 113, 227, 0.2)'
                    : 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    background: hasChanges.f2a 
                      ? '#0077ed'
                      : '#e5e5ea',
                    boxShadow: hasChanges.f2a 
                      ? '0 4px 12px rgba(0, 113, 227, 0.3)'
                      : 'none'
                  },
                  '&:disabled': {
                    background: '#f5f5f7',
                    color: '#86868b',
                    boxShadow: 'none'
                  }
                }}
              >
                {savingStates.f2a ? 'Enregistrement...' : hasChanges.f2a ? 'Enregistrer' : 'Enregistré'}
              </Button>
            </Box>
          </SettingsCard>
        </Grid>

        {/* Section Cotisations et Programmes */}
        <Grid item xs={12}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, mt: 2, color: '#1d1d1f' }}>
            Cotisations et Programmes
          </Typography>
        </Grid>

        {/* Cotisations */}
        <Grid item xs={12} lg={8}>
          <SettingsCard
            title="Cotisations"
            subtitle="Configuration des cotisations et paiements"
            icon={<PaymentIcon sx={{ fontSize: 16 }} />}
            gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
            iconColor="#f59e0b"
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Chip
                      label={cotisationsEnabled ? 'Activées' : 'Désactivées'}
                      color={cotisationsEnabled ? 'success' : 'default'}
                      variant="outlined"
                      size="small"
                      sx={{ 
                  borderRadius: '6px',
                  fontWeight: 500,
                  fontSize: '0.75rem'
                      }}
                    />
                    <IconButton
                      onClick={() => setCotisationsExpanded(!cotisationsExpanded)}
                      size="small"
                      sx={{
                        borderRadius: '6px',
                        color: '#86868b',
                        '&:hover': {
                          backgroundColor: '#f5f5f7'
                        },
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      {cotisationsExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
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
                sx={{ mb: 2, '& .MuiFormControlLabel-label': { fontWeight: 500, fontSize: '0.875rem' } }}
                  />

                  {cotisationsEnabled && (
                <Box sx={{ mb: 2.5 }}>
                  <Grid container spacing={2}>
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
                                borderRadius: '8px',
                                '& .MuiOutlinedInput-notchedOutline': {
                                  border: '1px solid #d1d1d6',
                                  borderRadius: '8px'
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                  border: '1px solid #86868b'
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                  border: '2px solid #0071e3'
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
                            borderRadius: '8px',
                                '& .MuiOutlinedInput-notchedOutline': {
                              border: '1px solid #d1d1d6',
                              borderRadius: '8px'
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                              border: '1px solid #86868b'
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              border: '2px solid #0071e3'
                                }
                              }}
                            >
                              <MenuItem value="end_of_school">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
                    sx={{ mt: 2, mb: 2, '& .MuiFormControlLabel-label': { fontWeight: 500, fontSize: '0.875rem' } }}
                      />

                      {stripeIntegrationEnabled && (
                    <Box sx={{ mt: 2 }}>
                      <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                              <TextField
                                label="Clé publique Stripe"
                                value={stripePublishableKey}
                                onChange={(e) => setStripePublishableKey(e.target.value)}
                                fullWidth
                                sx={{ 
                                  '& .MuiOutlinedInput-root': { 
                                borderRadius: '8px',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                  border: '1px solid #d1d1d6',
                                  borderRadius: '8px'
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                  border: '1px solid #86868b'
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                  border: '2px solid #0071e3'
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
                                borderRadius: '8px',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                  border: '1px solid #d1d1d6',
                                  borderRadius: '8px'
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                  border: '1px solid #86868b'
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                  border: '2px solid #0071e3'
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
                                borderRadius: '8px',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                  border: '1px solid #d1d1d6',
                                  borderRadius: '8px'
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                  border: '1px solid #86868b'
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                  border: '2px solid #0071e3'
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
                                borderRadius: '8px',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                  border: '1px solid #d1d1d6',
                                  borderRadius: '8px'
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                  border: '1px solid #86868b'
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                  border: '2px solid #0071e3'
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
              <Divider sx={{ my: 2, borderColor: '#e5e5ea' }} />
                  
                <Box sx={{ mb: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#1d1d1f', fontSize: '0.9375rem' }}>
                        Utilisateurs avec cotisations payées ({usersWithSubscriptions.length})
                      </Typography>
                      <IconButton
                        onClick={() => setUsersListExpanded(!usersListExpanded)}
                    size="small"
                        sx={{
                      borderRadius: '6px',
                      color: '#86868b',
                          '&:hover': {
                        backgroundColor: '#f5f5f7'
                          },
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                      >
                    {usersListExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
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
                      <CircularProgress size={32} sx={{ color: '#0071e3' }} />
                        </Box>
                      ) : usersWithSubscriptions.length === 0 ? (
                        <Box sx={{ 
                          textAlign: 'center', 
                          py: 4,
                          bgcolor: 'rgba(245, 158, 11, 0.05)',
                      borderRadius: '8px',
                      border: '1px solid #e5e5ea'
                        }}>
                      <PaymentIcon sx={{ fontSize: 32, color: '#86868b', mb: 1.5, opacity: 0.4 }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5, color: '#1d1d1f', fontSize: '0.9375rem' }}>
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
                            border: '1px solid #e5e5ea',
                                borderRadius: '8px',
                            background: '#ffffff',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                maxWidth: 'calc(100% - 4px)',
                                '&:hover': {
                              border: '1px solid #d1d1d6',
                              background: '#fafafa',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                                }
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Avatar
                                  sx={{
                                    width: 28,
                                    height: 28,
                                bgcolor: '#f5f5f7',
                                color: '#1d1d1f',
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
                            <CheckCircleIcon sx={{ color: '#34c759', fontSize: 16, ml: 0.5 }} />
                              </Box>
                            </Paper>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {hasChanges.cotisations && (
                    <Chip
                      label="Modifications non sauvegardées"
                      color="warning"
                      size="small"
                      icon={<ErrorIcon />}
                      sx={{ 
                  borderRadius: '6px',
                  fontWeight: 500,
                  fontSize: '0.75rem',
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
                  borderRadius: '6px',
                  py: 1,
                  px: 2,
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                      background: hasChanges.cotisations 
                      ? '#0071e3'
                      : '#f5f5f7',
                    color: hasChanges.cotisations ? '#ffffff' : '#86868b',
                      boxShadow: hasChanges.cotisations 
                      ? '0 2px 8px rgba(0, 113, 227, 0.2)'
                        : 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        background: hasChanges.cotisations 
                        ? '#0077ed'
                        : '#e5e5ea',
                        boxShadow: hasChanges.cotisations 
                        ? '0 4px 12px rgba(0, 113, 227, 0.3)'
                        : 'none'
                      },
                      '&:disabled': {
                      background: '#f5f5f7',
                      color: '#86868b',
                      boxShadow: 'none'
                      }
                    }}
                  >
                    {savingStates.cotisations ? 'Enregistrement...' : hasChanges.cotisations ? 'Enregistrer' : 'Enregistré'}
                  </Button>
                </Box>
                </Box>
          </SettingsCard>
        </Grid>

        {/* Programmes */}
        <Grid item xs={12} lg={4}>
          <SettingsCard
            title="Programmes"
            subtitle="Programmes de formation disponibles"
            icon={<SchoolIcon sx={{ fontSize: 16 }} />}
            gradient="linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
            iconColor="#8b5cf6"
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mb: 2 }}>
                  <Chip
                    label={`${programs.length} programme${programs.length > 1 ? 's' : ''}`}
                    color="primary"
                    variant="outlined"
                    size="small"
                    sx={{ 
                  borderRadius: '6px',
                  fontWeight: 500,
                  fontSize: '0.75rem'
                    }}
                  />
                </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
                  <TextField
                    label="Nouveau programme"
                    value={newProgram}
                    onChange={(e) => setNewProgram(e.target.value)}
                    placeholder="Entrez le nom du programme"
                    fullWidth
                    sx={{ 
                      '& .MuiOutlinedInput-root': { 
                    borderRadius: '8px',
                        '& .MuiOutlinedInput-notchedOutline': {
                      border: '1px solid #d1d1d6',
                      borderRadius: '8px'
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                      border: '1px solid #86868b'
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      border: '2px solid #0071e3'
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
                  borderRadius: '8px', 
                      minWidth: 120,
                  py: 1.25,
                  textTransform: 'none',
                  border: '1px solid #d1d1d6',
                  color: '#1d1d1f',
                  fontWeight: 500,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                    border: '1px solid #86868b',
                    backgroundColor: '#f5f5f7'
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
                      borderRadius: '12px',
                      background: '#f5f5f7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2
                      }}
                    >
                  <SchoolIcon sx={{ fontSize: 32, color: '#86868b' }} />
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
                      border: '1px solid #e5e5ea',
                      borderRadius: '8px',
                      background: '#ffffff',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          '&:hover': {
                        border: '1px solid #d1d1d6',
                        background: '#fafafa',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
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
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Box
                                  sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '8px',
                                background: '#f5f5f7',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                              <SchoolIcon sx={{ fontSize: 16, color: '#86868b' }} />
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
          </SettingsCard>
        </Grid>
      </Grid>

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