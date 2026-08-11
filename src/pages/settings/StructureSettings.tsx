import * as React from 'react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
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
  Person as PersonIcon,
  Link as LinkIcon,
  ContentCopy as ContentCopyIcon
} from '@mui/icons-material';
import { doc, updateDoc, getDoc, setDoc, collection, query, where, getDocs, addDoc, deleteField } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, storage } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import SettingsCard from '../../components/settings/SettingsCard';
import { settingsPageStyles, DsToggle, SettingsPanelRow } from '../../components/ds';
import ImportMissionsEtudesDialog, { type ImportValidationError, type DuplicateHint } from '../../components/missions/ImportMissionsEtudesDialog';
import { tokens } from '../../theme/tokens';
import { decryptUsersList, getSafeDisplayName } from '../../utils/decryptUserUtils';
import UserNameText from '../../components/common/UserNameText';

// Fonction utilitaire pour convertir les dates Firestore en Date
const toDate = (dateValue: any): Date => {
  if (!dateValue) return new Date();
  
  // Si c'est déjà une Date
  if (dateValue instanceof Date) {
    return dateValue;
  }
  
  // Si c'est un Timestamp Firestore (avec méthode toDate)
  if (dateValue && typeof dateValue.toDate === 'function') {
    return dateValue.toDate();
  }
  
  // Si c'est une string (ISO ou autre)
  if (typeof dateValue === 'string') {
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // Par défaut, retourner une nouvelle Date
  return new Date();
};

/** Valeur Firestore → chaîne affichable (évite des children React invalides). */
const asDisplayString = (value: unknown, fallback = 'Non renseigné'): string => {
  if (value == null || value === '') return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

/** Normalise les listes Firestore (string ou objet) pour éviter des children React invalides. */
const normalizeStringList = (items: unknown): string[] => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && 'domain' in item) {
        return String((item as { domain?: unknown }).domain ?? '').trim();
      }
      if (item && typeof item === 'object' && 'name' in item) {
        return String((item as { name?: unknown }).name ?? '').trim();
      }
      return String(item ?? '').trim();
    })
    .filter(Boolean);
};

const StructureSettings: React.FC = () => {
  const theme = useTheme();
  const { currentUser, userData } = useAuth();
  const isSuperAdmin = userData?.status === 'superadmin';
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [gratificationNetDefault, setGratificationNetDefault] = useState<number>(0);
  const [gratificationBruteDefault, setGratificationBruteDefault] = useState<number>(0);
  const [daysUntilDue, setDaysUntilDue] = useState<number>(30);
  const [structureType, setStructureType] = useState<'jobservice' | 'junior'>('jobservice');
  const [cotisationsEnabled, setCotisationsEnabled] = useState<boolean>(false);
  const [cotisationAmount, setCotisationAmount] = useState<number>(0);
  const [cotisationDisplayValue, setCotisationDisplayValue] = useState<string>('');
  const [cotisationDuration, setCotisationDuration] = useState<'end_of_school' | '1_year' | '2_years' | '3_years'>('1_year');
  const [stripeIntegrationEnabled, setStripeIntegrationEnabled] = useState<boolean>(false);
  const [stripePublishableKey, setStripePublishableKey] = useState<string>('');
  const [stripeSecretKeyInput, setStripeSecretKeyInput] = useState<string>('');
  const [stripeSecretConfigured, setStripeSecretConfigured] = useState(false);
  const [stripeProductId, setStripeProductId] = useState<string>('');
  const [stripeBuyButtonId, setStripeBuyButtonId] = useState<string>('');
  const [f2aRequiredForMembers, setF2aRequiredForMembers] = useState<boolean>(false);
  const [f2aRequiredForStudents, setF2aRequiredForStudents] = useState<boolean>(false);
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
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importedData, setImportedData] = useState<Record<string, unknown>[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProcessingAI, setImportProcessingAI] = useState(false);
  const [importValidationErrors, setImportValidationErrors] = useState<ImportValidationError[]>([]);
  const [importDuplicateHints, setImportDuplicateHints] = useState<DuplicateHint[]>([]);
  const [confirmCreateCompaniesOpen, setConfirmCreateCompaniesOpen] = useState(false);
  const [emailDomains, setEmailDomains] = useState<string[]>([]);
  const [newEmailDomain, setNewEmailDomain] = useState('');
  const [savingEmailDomains, setSavingEmailDomains] = useState(false);
  
  // Data for AI matching
  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [missionTypes, setMissionTypes] = useState<any[]>([]);

  useEffect(() => {
    const fetchContextData = async () => {
      if (!structureId) return;
      
      try {
        // Fetch Users
        const usersQuery = query(collection(db, 'users'), where('structureId', '==', structureId));
        const usersSnap = await getDocs(usersQuery);
        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch Companies
        const companiesQuery = query(collection(db, 'companies'), where('structureId', '==', structureId));
        const companiesSnap = await getDocs(companiesQuery);
        setCompanies(companiesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch Contacts
        const contactsQuery = query(collection(db, 'contacts'), where('structureId', '==', structureId));
        const contactsSnap = await getDocs(contactsQuery);
        setContacts(contactsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch Mission Types
        const missionTypesQuery = query(collection(db, 'mission_types'), where('structureId', '==', structureId));
        const missionTypesSnap = await getDocs(missionTypesQuery);
        setMissionTypes(missionTypesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error: unknown) {
        const isPermissionDenied = error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'permission-denied';
        if (isPermissionDenied) {
          setUsers([]);
          setCompanies([]);
          setContacts([]);
          setMissionTypes([]);
        }
        if (!isPermissionDenied) {
          console.error('Error fetching context data for import matching:', error);
        }
      }
    };

    if (importDialogOpen) {
      fetchContextData();
    }
  }, [structureId, importDialogOpen]);

  // Similarité Levenshtein pour matching typo-tolerant (coquilles)
  const levenshteinSimilarity = (a: string, b: string): number => {
    if (!a || !b) return 0;
    const lenA = a.length, lenB = b.length;
    if (lenA === 0 || lenB === 0) return 0;
    let prevRow = Array(lenB + 1).fill(0).map((_, i) => i);
    for (let i = 1; i <= lenA; i++) {
      const currRow = [i];
      for (let j = 1; j <= lenB; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        currRow[j] = Math.min(prevRow[j] + 1, currRow[j - 1] + 1, prevRow[j - 1] + cost);
      }
      prevRow = currRow;
    }
    const distance = prevRow[lenB];
    return 1 - distance / Math.max(lenA, lenB);
  };

  const findBestMatch = (input: string, candidates: any[], keys: string[], threshold = 0.55) => {
    if (!input || !input.trim()) return null;
    const normalizedInput = input.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    let bestMatch = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      for (const key of keys) {
        const value = candidate[key];
        if (typeof value === 'string') {
          const normalizedValue = value.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

          if (normalizedValue === normalizedInput) return candidate;

          if (normalizedValue.includes(normalizedInput) || normalizedInput.includes(normalizedValue)) {
            const score = Math.min(normalizedInput.length, normalizedValue.length) / Math.max(normalizedInput.length, normalizedValue.length);
            if (score > bestScore) {
              bestScore = score;
              bestMatch = candidate;
            }
          }

          const sim = levenshteinSimilarity(normalizedInput, normalizedValue);
          if (sim > bestScore && sim >= threshold) {
            bestScore = sim;
            bestMatch = candidate;
          }
        }
      }

      if (candidate.firstName && candidate.lastName) {
        const fullName = `${candidate.firstName} ${candidate.lastName}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const reverseName = `${candidate.lastName} ${candidate.firstName}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        if (fullName === normalizedInput || reverseName === normalizedInput) return candidate;
        if (fullName.includes(normalizedInput) || normalizedInput.includes(fullName)) {
          if (0.9 > bestScore) {
            bestScore = 0.9;
            bestMatch = candidate;
          }
        }
        const simFull = levenshteinSimilarity(normalizedInput, fullName);
        const simRev = levenshteinSimilarity(normalizedInput, reverseName);
        if (Math.max(simFull, simRev) > bestScore && Math.max(simFull, simRev) >= threshold) {
          bestScore = Math.max(simFull, simRev);
          bestMatch = candidate;
        }
      }
    }

    return bestScore >= threshold ? bestMatch : null;
  };

  const computeDuplicateHints = (
    rows: Record<string, unknown>[],
    type: 'mission' | 'etude'
  ): DuplicateHint[] => {
    const hints: DuplicateHint[] = [];
    const key = (r: Record<string, unknown>, i: number) => {
      if (type === 'etude') {
        return `${String(r.numeroEtude ?? '').trim()}|${String(r.company ?? '').trim()}|${String(r.startDate ?? '').slice(0, 10)}`;
      }
      return `${String(r.company ?? '').trim()}|${String(r.title ?? '').trim()}|${String(r.startDate ?? '').slice(0, 10)}`;
    };
    const seen = new Map<string, number>();
    rows.forEach((r, i) => {
      const k = key(r, i);
      if (!k || k === '||') return;
      if (seen.has(k)) hints.push({ rowIndex: i, suggestedDuplicateOf: seen.get(k)! });
      else seen.set(k, i);
    });
    return hints;
  };

  const [savingStates, setSavingStates] = useState<{
    hourlyRate: boolean;
    gratification: boolean;
    daysUntilDue: boolean;
    structureType: boolean;
    cotisations: boolean;
    f2a: boolean;
  }>({
    hourlyRate: false,
    gratification: false,
    daysUntilDue: false,
    structureType: false,
    cotisations: false,
    f2a: false
  });

  // États pour suivre les valeurs originales et les modifications
  const [originalValues, setOriginalValues] = useState<{
    hourlyRate: number;
    gratificationNetDefault: number;
    gratificationBruteDefault: number;
    daysUntilDue: number;
    structureType: 'jobservice' | 'junior';
    cotisationsEnabled: boolean;
    cotisationAmount: number;
    cotisationDuration: 'end_of_school' | '1_year' | '2_years' | '3_years';
    stripeIntegrationEnabled: boolean;
    stripePublishableKey: string;
    stripeSecretConfigured: boolean;
    stripeProductId: string;
    stripeBuyButtonId: string;
    f2aRequiredForMembers: boolean;
    f2aRequiredForStudents: boolean;
  }>({
    hourlyRate: 0,
    gratificationNetDefault: 0,
    gratificationBruteDefault: 0,
    daysUntilDue: 30,
    structureType: 'jobservice',
    cotisationsEnabled: false,
    cotisationAmount: 0,
    cotisationDuration: '1_year',
    stripeIntegrationEnabled: false,
    stripePublishableKey: '',
    stripeSecretConfigured: false,
    stripeProductId: '',
    stripeBuyButtonId: '',
    f2aRequiredForMembers: false,
    f2aRequiredForStudents: false
  });

  const [hasChanges, setHasChanges] = useState<{
    hourlyRate: boolean;
    gratification: boolean;
    daysUntilDue: boolean;
    structureType: boolean;
    cotisations: boolean;
    f2a: boolean;
  }>({
    hourlyRate: false,
    gratification: false,
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
    displayName?: string;
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
        const gratificationNetValue = data.defaultGratificationNet ?? 0;
        const gratificationBruteValue = data.defaultGratificationBrute ?? 0;
        const daysUntilDueValue = data.daysUntilDue || 30;
        const structureTypeValue = data.structureType || 'jobservice';
        const cotisationsEnabledValue = data.cotisationsEnabled || false;
        const cotisationAmountValue = data.cotisationAmount || 0;
        const cotisationDurationValue = data.cotisationDuration || '1_year';
        const stripeIntegrationEnabledValue = data.stripeIntegrationEnabled || false;
        const stripePublishableKeyValue = data.stripePublishableKey || '';
        const stripeSecretConfiguredValue = !!(data.stripeSecretConfigured || data.stripeSecretKey);
        const stripeProductIdValue = data.stripeProductId || '';
        const stripeBuyButtonIdValue = data.stripeBuyButtonId || '';
        const f2aRequiredForMembersValue = data.f2aRequiredForMembers || false;
        const f2aRequiredForStudentsValue = data.f2aRequiredForStudents || false;

        setHourlyRate(hourlyRateValue);
        setGratificationNetDefault(gratificationNetValue);
        setGratificationBruteDefault(gratificationBruteValue);
        setDaysUntilDue(daysUntilDueValue);
        setStructureType(structureTypeValue);
        setCotisationsEnabled(cotisationsEnabledValue);
        setCotisationAmount(cotisationAmountValue);
        setCotisationDisplayValue(cotisationAmountValue ? cotisationAmountValue.toString().replace('.', ',') : '');
        setCotisationDuration(cotisationDurationValue);
        setStripeIntegrationEnabled(stripeIntegrationEnabledValue);
        setStripePublishableKey(stripePublishableKeyValue);
        setStripeSecretConfigured(stripeSecretConfiguredValue);
        setStripeSecretKeyInput('');
        setStripeProductId(stripeProductIdValue);
        setStripeBuyButtonId(stripeBuyButtonIdValue);
        setF2aRequiredForMembers(f2aRequiredForMembersValue);
        setF2aRequiredForStudents(f2aRequiredForStudentsValue);
        
        setEmailDomains(normalizeStringList(data.emailDomains ?? data.domaines));

        // Charger les informations de l'organisation
        setOrganization({
          name: asDisplayString(data.nom, 'Structure non détectée'),
          logo: asDisplayString(data.logo, ''),
          address: asDisplayString(data.address ?? data.adresse),
          city: asDisplayString(data.city ?? data.ville),
          postalCode: asDisplayString(data.postalCode ?? data.codePostal),
          phone: asDisplayString(data.phone ?? data.telephone),
          email: asDisplayString(data.email),
          website: asDisplayString(data.website ?? data.siteWeb),
          description: asDisplayString(data.description),
          siret: asDisplayString(data.siret, ''),
          tvaNumber: asDisplayString(data.tvaNumber, ''),
          apeCode: asDisplayString(data.apeCode, '')
        });

        // Sauvegarder les valeurs originales
        setOriginalValues({
          hourlyRate: hourlyRateValue,
          gratificationNetDefault: gratificationNetValue,
          gratificationBruteDefault: gratificationBruteValue,
          daysUntilDue: daysUntilDueValue,
          structureType: structureTypeValue,
          cotisationsEnabled: cotisationsEnabledValue,
          cotisationAmount: cotisationAmountValue,
          cotisationDuration: cotisationDurationValue,
          stripeIntegrationEnabled: stripeIntegrationEnabledValue,
          stripePublishableKey: stripePublishableKeyValue,
          stripeSecretConfigured: stripeSecretConfiguredValue,
          stripeProductId: stripeProductIdValue,
          stripeBuyButtonId: stripeBuyButtonIdValue,
          f2aRequiredForMembers: f2aRequiredForMembersValue,
          f2aRequiredForStudents: f2aRequiredForStudentsValue
        });
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
          displayName: data.displayName || '',
          email: data.email || '',
          subscriptionPaidAt: toDate(data.subscriptionPaidAt),
          subscriptionExpiresAt: toDate(data.subscriptionExpiresAt)
        };
      });

      const decrypted = await decryptUsersList(users);
      setUsersWithSubscriptions(decrypted);
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
      gratification: gratificationNetDefault !== originalValues.gratificationNetDefault ||
                    gratificationBruteDefault !== originalValues.gratificationBruteDefault,
      daysUntilDue: daysUntilDue !== originalValues.daysUntilDue,
      structureType: structureType !== originalValues.structureType,
      cotisations: cotisationsEnabled !== originalValues.cotisationsEnabled ||
                  cotisationAmount !== originalValues.cotisationAmount ||
                  cotisationDuration !== originalValues.cotisationDuration ||
                  stripeIntegrationEnabled !== originalValues.stripeIntegrationEnabled ||
                  stripePublishableKey !== originalValues.stripePublishableKey ||
                  stripeSecretKeyInput.trim() !== '' ||
                  stripeSecretConfigured !== originalValues.stripeSecretConfigured ||
                  stripeProductId !== originalValues.stripeProductId ||
                  stripeBuyButtonId !== originalValues.stripeBuyButtonId,
      f2a: f2aRequiredForMembers !== originalValues.f2aRequiredForMembers ||
           f2aRequiredForStudents !== originalValues.f2aRequiredForStudents
    });
  };

  // Effet pour vérifier les changements
  useEffect(() => {
    checkForChanges();
  }, [hourlyRate, gratificationNetDefault, gratificationBruteDefault, daysUntilDue, structureType, cotisationsEnabled, cotisationAmount, cotisationDuration,
      stripeIntegrationEnabled, stripePublishableKey, stripeSecretKeyInput, stripeSecretConfigured, stripeProductId, stripeBuyButtonId,
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

  const handleSaveGratification = async () => {
    if (!structureId) return;

    try {
      setSavingStates(prev => ({ ...prev, gratification: true }));
      await updateDoc(doc(db, 'structures', structureId), {
        defaultGratificationNet: gratificationNetDefault,
        defaultGratificationBrute: gratificationBruteDefault
      });

      setOriginalValues(prev => ({
        ...prev,
        gratificationNetDefault,
        gratificationBruteDefault
      }));

      showSnackbar('Gratifications par défaut mises à jour avec succès', 'success');
    } catch (error) {
      console.error('Erreur lors de la mise à jour des gratifications:', error);
      showSnackbar('Erreur lors de la mise à jour des gratifications', 'error');
    } finally {
      setSavingStates(prev => ({ ...prev, gratification: false }));
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

  // Étapes missions (cohérent avec MissionDetails)
  const MISSION_ETAPES = ['Négociation', 'Recrutement', 'Date de mission', 'Facturation', 'Audit', 'Archivé'] as const;
  const normalizeEtape = (v: string): string => {
    const s = (v || '').toString().trim().toLowerCase();
    const map: Record<string, string> = {
      'négociation': 'Négociation', 'negociation': 'Négociation', 'négoc': 'Négociation',
      'recrutement': 'Recrutement', 'recrut': 'Recrutement',
      'date de mission': 'Date de mission', 'date mission': 'Date de mission', 'mission': 'Date de mission',
      'facturation': 'Facturation', 'facturé': 'Facturation', 'facture': 'Facturation',
      'audit': 'Audit',
      'archivé': 'Archivé', 'archive': 'Archivé', 'clôturé': 'Archivé', 'cloture': 'Archivé', 'termine': 'Archivé', 'terminé': 'Archivé',
    };
    if (map[s]) return map[s];
    const canonical = MISSION_ETAPES.find((e) => e.toLowerCase() === s);
    return canonical || 'Négociation';
  };
  const normalizeStatus = (v: string): string => {
    const s = (v || '').toString().trim().toLowerCase();
    if (/en attente|attente|pending/i.test(s)) return 'En attente';
    if (/en cours|cours|en_cours|in progress/i.test(s)) return 'En cours';
    if (/terminé|termine|done|completed/i.test(s)) return 'Terminé';
    if (/annulé|annule|canceled/i.test(s)) return 'Annulé';
    return v || 'En attente';
  };

  // Statuts autorisés pour les études (cohérent avec EtudeDetails getStatusColor)
  const normalizeStatusEtude = (v: string): string => {
    const s = (v || '').toString().trim().toLowerCase();
    if (/en attente|attente|pending/i.test(s)) return 'En attente';
    if (/en cours|cours|en_cours|in progress/i.test(s)) return 'En cours';
    if (/terminé|termine|done|completed/i.test(s)) return 'Terminé';
    return 'En attente';
  };

  const parseDateToDbFormat = (dateStr: string): string => {
    if (!dateStr || !String(dateStr).trim()) return '';
    const raw = String(dateStr).trim();
    // Déjà au format ISO (YYYY-MM-DD ou avec heure) → garder cohérent pour affichage
    if (/^\d{4}-\d{2}-\d{2}(T|\s|$)/.test(raw)) {
      const isoDate = raw.slice(0, 10);
      const date = new Date(isoDate);
      if (!isNaN(date.getTime())) return date.toISOString();
    }
    const parts = raw.split(/[/\-.]/).map((p) => p.trim());
    if (parts.length === 3) {
      const [a, b, c] = parts;
      const y = c.length === 4 ? c : a.length === 4 ? a : null;
      const iso = y === c
        ? `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`  // DD/MM/YYYY ou DD-MM-YYYY
        : y === a
          ? `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`  // YYYY-MM-DD
          : `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
      const date = new Date(iso);
      if (!isNaN(date.getTime())) return date.toISOString();
    }
    const date = new Date(raw);
    if (!isNaN(date.getTime())) return date.toISOString();
    return '';
  };

  const buildImportedDataFromRows = (rows: Record<string, unknown>[]): Record<string, unknown>[] => {
    if (structureType === 'junior') {
      return rows.map((row: any) => {
        const rawChargeName = (row.chargeName || row.charge_etudes || row.charge_name || '').toString().trim();
        const matchedCharge = rawChargeName ? findBestMatch(rawChargeName, users, ['displayName', 'firstName', 'lastName']) : null;
        const startDateRaw = (row.startDate || row.start_date || row.dateDebut || row.debut || '').toString().trim();
        const endDateRaw = (row.endDate || row.end_date || row.dateFin || row.fin || '').toString().trim();
        const parsedStart = parseDateToDbFormat(startDateRaw);
        const parsedEnd = parseDateToDbFormat(endDateRaw);
        return {
          numeroEtude: row.numeroEtude || '',
          company: row.company || '',
          location: row.location || '',
          startDate: parsedStart || parsedEnd,
          endDate: parsedEnd,
          consultantCount: parseInt(row.consultantCount) || 0,
          hours: parseInt(row.hours) || 0,
          status: normalizeStatusEtude((row.status || 'En attente').toString()),
          structureId: structureId || '',
          chargeId: matchedCharge ? matchedCharge.id : (currentUser?.uid || ''),
          chargeName: matchedCharge ? getSafeDisplayName(matchedCharge) : (rawChargeName || getSafeDisplayName(userData)),
          isPublic: true,
          etape: 'Négociation' as const
        };
      });
    }
    return rows.map((row: any) => {
      const studentCountVal = row.studentCount != null && row.studentCount !== '' ? parseInt(String(row.studentCount), 10) : 0;
      const hoursVal = row.hours != null && row.hours !== '' ? parseInt(String(row.hours), 10) : 0;
      const priceHTVal = row.priceHT != null && row.priceHT !== '' ? parseFloat(String(row.priceHT).replace(',', '.')) : undefined;
      const prixHTVal = row.prixHT != null && row.prixHT !== '' ? parseFloat(String(row.prixHT).replace(',', '.')) : priceHTVal;

      const rawChargeName = (row.chargeName || row.charge_name || '').toString().trim();
      const matchedCharge = findBestMatch(rawChargeName, users, ['displayName', 'firstName', 'lastName']);
      const rawCompanyName = (row.company || row.entreprise || '').toString().trim();
      const matchedCompany = findBestMatch(rawCompanyName, companies, ['name']);
      const rawContactName = (row.contact || row.contactName || '').toString().trim();
      const potentialContacts = matchedCompany ? contacts.filter(c => c.companyId === matchedCompany.id) : contacts;
      const matchedContact = findBestMatch(rawContactName, potentialContacts, ['firstName', 'lastName', 'email']);
      const rawTypeName = (row.type || row.typeMission || '').toString().trim();
      const matchedType = findBestMatch(rawTypeName, missionTypes, ['name']);

      const rawStudents = (row.students || row.etudiants || '').toString().trim();
      const assignedStudents: { userId: string; name: string; hours: number }[] = [];
      if (rawStudents) {
        const studentEntries = rawStudents.split(';');
        for (const entry of studentEntries) {
          const [name, hours] = entry.split(':');
          const matchedStudent = findBestMatch(name?.trim(), users, ['displayName', 'firstName', 'lastName']);
          if (matchedStudent) {
            assignedStudents.push({
              userId: matchedStudent.id,
              name: getSafeDisplayName(matchedStudent),
              hours: hours ? parseFloat(String(hours).replace(',', '.')) : 0
            });
          }
        }
      }

      const contactEmail = (row.contactEmail || row.contact_email || matchedContact?.email || '').toString().trim();
      const contactFirstName = (row.contactFirstName || row.contact_firstName || row.contactPrenom || matchedContact?.firstName || '').toString().trim();
      const contactLastName = (row.contactLastName || row.contact_lastName || row.contactNom || matchedContact?.lastName || '').toString().trim();
      const contactPhone = (row.contactPhone || row.contact_phone || row.contactTelephone || matchedContact?.phone || '').toString().trim();
      const contactPosition = (row.contactPosition || row.contact_position || row.contactPoste || matchedContact?.position || '').toString().trim();
      const contact =
        contactEmail || contactFirstName || contactLastName || contactPhone || contactPosition
          ? { email: contactEmail || undefined, firstName: contactFirstName || undefined, lastName: contactLastName || undefined, phone: contactPhone || undefined, position: contactPosition || undefined }
          : undefined;

      const totalTTCVal = (row.totalTTC != null && row.totalTTC !== ''
        ? parseFloat(String(row.totalTTC).replace(/\s/g, '').replace(',', '.'))
        : (row.montantFacture != null && row.montantFacture !== '' ? parseFloat(String(row.montantFacture).replace(/\s/g, '').replace(',', '.')) : undefined));

      return {
        numeroMission: (row.numeroMission || row.numero_mission || '').toString().trim(),
        company: matchedCompany ? matchedCompany.name : rawCompanyName,
        companyId: matchedCompany ? matchedCompany.id : undefined,
        location: (row.location || row.lieu || '').toString().trim(),
        startDate: parseDateToDbFormat((row.startDate || row.start_date || row.dateDebut || '').toString()),
        endDate: parseDateToDbFormat((row.endDate || row.end_date || row.dateFin || '').toString()),
        studentCount: isNaN(studentCountVal) ? 0 : studentCountVal,
        hours: isNaN(hoursVal) ? 0 : hoursVal,
        status: normalizeStatus((row.status || row.statut || 'En attente').toString()),
        structureId: structureId || '',
        chargeId: matchedCharge ? matchedCharge.id : (currentUser?.uid || ''),
        chargeName: matchedCharge ? getSafeDisplayName(matchedCharge) : (rawChargeName || getSafeDisplayName(userData)),
        title: (row.title || row.titre || row.description || '').toString().trim(),
        description: (row.description || '').toString().trim(),
        priceHT: prixHTVal ?? priceHTVal,
        prixHT: prixHTVal ?? priceHTVal,
        totalTTC: totalTTCVal,
        missionTypeId: matchedType ? matchedType.id : undefined,
        type: matchedType ? matchedType.name : 'standard',
        salary: (row.salary || row.remuneration || '').toString().trim(),
        mandat: (row.mandat || '').toString().trim(),
        etape: normalizeEtape((row.etape || 'Négociation').toString()),
        isPublic: row.isPublic !== 'false' && row.isPublic !== '0',
        contactId: matchedContact ? matchedContact.id : undefined,
        contact,
        expenses: (row.expenses || row.depenses || '').toString(),
        expenseReportsAmount: row.expenseReports ? parseFloat(String(row.expenseReports).replace(',', '.')) : 0,
        assignedStudents,
        isImported: true,
        source: 'import_csv'
      };
    });
  };

  // Repli client si la Cloud Function (getImportColumnMapping) n'est pas déployée ou échoue
  const getFallbackMapping = (headers: string[], type: 'mission' | 'etude'): Record<string, string> => {
    const normalize = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const etude: Record<string, string> = {
      'n° étude': 'numeroEtude', 'no étude': 'numeroEtude', 'numero etude': 'numeroEtude', 'n° etude': 'numeroEtude',
      'client / entreprise': 'company', 'client': 'company', 'entreprise': 'company', 'client/entreprise': 'company',
      'ville': 'location', 'lieu': 'location',
      'début': 'startDate', 'date début': 'startDate', 'date de début': 'startDate', 'date': 'startDate',
      'fin': 'endDate', 'date fin': 'endDate', 'date de fin': 'endDate',
      'nb consultants': 'consultantCount', 'consultants': 'consultantCount', 'nb consultant': 'consultantCount',
      'heures': 'hours',
      'chargé d\'études': 'chargeName', 'charge etudes': 'chargeName', 'chargé d\'etudes': 'chargeName',
      'chargé': 'chargeName', 'charge': 'chargeName', 'chargé detudes': 'chargeName', 'charge detudes': 'chargeName',
      'chargé d\'étude': 'chargeName', 'charge étude': 'chargeName',
      'montant facture': 'montantFacture',
      'statut': 'status',
    };
    const mission: Record<string, string> = {
      'n° mission': 'numeroMission', 'no mission': 'numeroMission', 'numero mission': 'numeroMission',
      'entreprise': 'company', 'client': 'company',
      'titre': 'title', 'intitulé': 'title',
      'lieu': 'location', 'ville': 'location',
      'date début': 'startDate', 'début': 'startDate', 'date de début': 'startDate',
      'date fin': 'endDate', 'fin': 'endDate', 'date de fin': 'endDate',
      'étudiants': 'studentCount', 'etudiants': 'studentCount', 'nb étudiants': 'studentCount',
      'heures': 'hours',
      'chargé': 'chargeName', 'charge': 'chargeName', 'chargé de mission': 'chargeName', 'charge de mission': 'chargeName',
      'prix ht': 'priceHT', 'prixht': 'priceHT',
      'total ttc': 'totalTTC', 'totalttc': 'totalTTC', 'montant facture': 'totalTTC', 'facture ttc': 'totalTTC', 'montant ttc': 'totalTTC', 'facture': 'totalTTC',
      'statut': 'status',
      'étape': 'etape', 'etape': 'etape',
      'salary': 'salary', 'rémunération': 'salary', 'remuneration': 'salary',
      'mandat': 'mandat',
      'type': 'type',
    };
    const map = type === 'etude' ? etude : mission;
    const out: Record<string, string> = {};
    headers.forEach((h) => {
      const n = normalize(h);
      if (map[n]) out[h] = map[n];
      else if (type === 'etude' && (n === 'numeroetude' || n === 'n etude' || n === 'n° etude')) out[h] = 'numeroEtude';
      else if (type === 'mission' && (n === 'numero mission' || n === 'n mission')) out[h] = 'numeroMission';
    });
    return out;
  };

  const applyMapping = (rows: Record<string, unknown>[], mapping: Record<string, string>): Record<string, unknown>[] =>
    rows.map((row: Record<string, unknown>) => {
      const out: Record<string, unknown> = {};
      for (const [csvH, internalKey] of Object.entries(mapping)) {
        if (row[csvH] !== undefined) out[internalKey] = row[csvH];
      }
      return out;
    });

  const handleFileParsed = async (rawRows: Record<string, unknown>[]) => {
    if (!structureId) {
      showSnackbar('Structure non chargée', 'error');
      return;
    }
    if (!rawRows.length) {
      setImportedData([]);
      setImportValidationErrors([]);
      setImportDuplicateHints([]);
      return;
    }
    setImportProcessingAI(true);
    setImportValidationErrors([]);
    setImportDuplicateHints([]);
    try {
      const type: 'mission' | 'etude' = structureType === 'junior' ? 'etude' : 'mission';
      const expectedKeys = type === 'etude'
        ? ['numeroEtude', 'company', 'location', 'startDate', 'endDate', 'consultantCount', 'hours', 'chargeName', 'montantFacture', 'status']
        : ['numeroMission', 'company', 'title', 'location', 'startDate', 'endDate', 'studentCount', 'hours', 'chargeName', 'priceHT', 'totalTTC', 'salary', 'mandat', 'status', 'etape'];
      const headers = (Object.keys(rawRows[0] as Record<string, unknown>) as string[]).filter((h) => String(h ?? '').trim() !== '');
      const needMapping = headers.length > 0 && !headers.every((h: string) => expectedKeys.includes(h));

      let rowsWithInternalKeys: Record<string, unknown>[] = rawRows;
      if (needMapping) {
        let mapping: Record<string, string> = {};
        try {
          if (headers.length > 0) {
            const functions = getFunctions();
            const getMapping = httpsCallable<
              { type: 'mission' | 'etude'; headers: string[]; structureId: string },
              { mapping: Record<string, string> }
            >(functions, 'getImportColumnMapping');
            const res = await getMapping({ type, headers, structureId: structureId! });
            const data = res.data as { mapping?: Record<string, string> };
            mapping = data?.mapping ?? {};
          }
        } catch {
          // Repli client si la Cloud Function n'est pas déployée ou échoue (400, 404, CORS, etc.)
          mapping = headers.length > 0 ? getFallbackMapping(headers, type) : {};
        }
        if (Object.keys(mapping).length > 0) {
          rowsWithInternalKeys = applyMapping(rawRows, mapping);
        }
      }

      let normalized = rowsWithInternalKeys;
      let validationErrors: ImportValidationError[] = [];
      try {
        const serializedRows = rowsWithInternalKeys.map((row) => {
          const o: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(row)) {
            if (v !== undefined && v !== null) o[k] = v;
          }
          return o;
        });
        const functions = getFunctions();
        const normalize = httpsCallable<
          { type: 'mission' | 'etude'; rows: Record<string, unknown>[]; structureId: string },
          { normalizedRows: Record<string, unknown>[]; validationErrors: ImportValidationError[] }
        >(functions, 'normalizeAndValidateImportRows');
        const res = await normalize({ type, rows: serializedRows, structureId: structureId! });
        const data = res.data as { normalizedRows?: Record<string, unknown>[]; validationErrors?: ImportValidationError[] };
        normalized = Array.isArray(data?.normalizedRows) ? data.normalizedRows : rowsWithInternalKeys;
        validationErrors = Array.isArray(data?.validationErrors) ? data.validationErrors : [];
      } catch {
        // Garder les lignes sans normalisation IA en cas d'erreur
      }

      const duplicateHints = computeDuplicateHints(normalized, type);
      const built = buildImportedDataFromRows(normalized);
      setImportedData(built);
      setImportValidationErrors(validationErrors);
      setImportDuplicateHints(duplicateHints);
    } catch (err) {
      console.error('Erreur traitement import IA:', err);
      showSnackbar('Erreur lors du traitement des données (mapping ou IA). Vous pouvez utiliser le modèle CSV.', 'error');
      setImportedData([]);
    } finally {
      setImportProcessingAI(false);
    }
  };

  const importCompaniesToCreate = React.useMemo(() => {
    const names = new Set<string>();
    (importedData as any[]).forEach((row: any) => {
      const company = (row.company || '').toString().trim();
      if (company && !row.companyId) names.add(company);
    });
    return Array.from(names);
  }, [importedData]);

  const handleImportClick = () => {
    if (importCompaniesToCreate.length > 0) {
      setConfirmCreateCompaniesOpen(true);
    } else {
      handleImport();
    }
  };

  const getOrCreateCompanyId = async (sid: string, companyName: string): Promise<string> => {
    const name = (companyName || '').trim();
    if (!name) return '';
    const companiesRef = collection(db, 'companies');
    const q = query(companiesRef, where('structureId', '==', sid), where('name', '==', name));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].id;
    const newRef = await addDoc(companiesRef, {
      name,
      structureId: sid,
      createdAt: new Date(),
    });
    return newRef.id;
  };

  const handleImport = async () => {
    if (!currentUser || !structureId) return;
    try {
      setImporting(true);
      if (structureType === 'junior') {
        for (const etude of importedData as any[]) {
          let companyId: string | undefined = etude.companyId;
          if (!companyId && etude.company) {
            companyId = await getOrCreateCompanyId(structureId, etude.company);
          }
          await addDoc(collection(db, 'etudes'), {
            ...etude,
            structureId: structureId || etude.structureId || '',
            companyId: companyId || undefined,
            createdAt: new Date(),
            createdBy: currentUser.uid,
            permissions: { viewers: [], editors: [currentUser.uid] }
          });
        }
        showSnackbar('Études importées avec succès', 'success');
      } else {
        for (const mission of importedData as any[]) {
          const { assignedStudents, ...rest } = mission;
          let companyId: string | undefined = rest.companyId;
          if (!companyId && rest.company) {
            companyId = await getOrCreateCompanyId(structureId, rest.company);
          }
          const missionRef = await addDoc(collection(db, 'missions'), {
            ...rest,
            companyId: companyId || rest.companyId || '',
            createdAt: new Date(),
            createdBy: currentUser.uid,
            permissions: { viewers: [], editors: [currentUser.uid] }
          });

          if (assignedStudents && assignedStudents.length > 0) {
            const studentIds = assignedStudents.map((s: any) => s.userId);
            await updateDoc(missionRef, { assignedStudentIds: studentIds });
          }
        }
        showSnackbar('Missions importées avec succès', 'success');
      }
      setImportDialogOpen(false);
      setImportedData([]);
    } catch (error) {
      console.error('Erreur lors de l\'importation:', error);
      showSnackbar(structureType === 'junior' ? 'Erreur lors de l\'importation des études' : 'Erreur lors de l\'importation des missions', 'error');
    } finally {
      setImporting(false);
    }
  };

  // Télécharger un CSV de test complexe (en-têtes variés, fautes de frappe, doublons, colonnes montant facture / chargé d'études)
  const escapeCsvCell = (v: string): string => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const downloadTestCsv = () => {
    if (structureType === 'junior') {
      const headers = ['N° Étude', 'Client / Entreprise', 'Ville', 'Début', 'Fin', 'Nb consultants', 'Heures', 'Chargé d\'études', 'Montant facture', 'Statut'];
      const rows = [
        ['ETUDE-2024-001', 'Acm Corp', 'Paris', '01/03/2024', '31/03/2024', '3', '40', 'Mare Martin', '4500', 'En attente'],
        ['ETUDE-2024-002', 'Beta S.A.', 'Lyon', '15/04/2024', '15/05/2024', '2', '25', 'Jean Dupond', '2200', 'en cour'],
        ['ETUDE-2024-003', 'Gama & Co', 'Nantes', '01/06/2024', '30/06/2024', '4', '60', 'Lisa Perin', '7200', 'Terminée'],
        ['ETUDE-2024-001', 'Acme Corp', 'Paris', '01/03/2024', '31/03/2024', '3', '40', 'Marie Martin', '4500', 'En attente'],
        ['ETUDE-2024-004', 'Dleta', 'Bordeaux', '10/08/2024', '05/08/2024', '2', '20', '', '1800', 'En Cours'],
        ['ETUDE-2024-005', 'Entreprise Test Sarl', 'Lille', '02/09/2024', '30/09/2024', '1', '15', 'Thomas Bertrand', '1500', 'en attente'],
      ];
      const lines = [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))];
      const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'test_import_etudes_complexe.csv';
      link.click();
      URL.revokeObjectURL(link.href);
    } else {
      const headers = ['N° Mission', 'Entreprise', 'Titre', 'Lieu', 'Date début', 'Date fin', 'Étudiants', 'Heures', 'Chargé de mission', 'Prix HT', 'Montant facture', 'Statut', 'Étape'];
      const rows = [
        ['M-001', 'Acm Corp', 'Audit process', 'Paris', '01/03/2024', '31/03/2024', '2', '40', 'Mare Martin', '1200', '1440', 'En cour', 'Négociaton'],
        ['M-002', 'Beta S.A.', 'Etude marché', 'Lyon', '15/04/2024', '15/05/2024', '1', '25', 'J. Dupont', '800', '960', 'terminé', 'Facturation'],
        ['M-003', 'Gama & Co', 'Conseil stratégie', 'Nantes', '01/06/2024', '30/06/2024', '3', '60', 'L. Perrin', '2500', '3000', 'En attente', 'Recrutment'],
        ['M-001', 'Acme Corp', 'Audit process', 'Paris', '01/03/2024', '31/03/2024', '2', '40', 'Marie Martin', '1200', '1 440', 'En cours', 'Négociation'],
        ['M-004', 'Dleta', 'Mission test', 'Bordeaux', '10/08/2024', '05/08/2024', '1', '10', '', '500', '600', 'en attente', 'Date de mission'],
        ['M-005', 'Entreprise Dupuis SA', 'Support évènementiel', 'Marseille', '12/09/2024', '14/09/2024', '4', '32', 'Sophie Lefebvres', '1800', '2 160', 'En cours', 'Date de mission'],
      ];
      const lines = [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))];
      const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'test_import_missions_complexe.csv';
      link.click();
      URL.revokeObjectURL(link.href);
    }
    showSnackbar('CSV de test téléchargé. Importez-le via le bouton ci-dessus.', 'success');
  };

  const downloadImportTemplate = () => {
    if (structureType === 'junior') {
      const headers = ['numeroEtude', 'company', 'location', 'startDate', 'endDate', 'consultantCount', 'hours', 'status'];
      const csvContent = [headers.join(','), 'ETUDE001,Entreprise A,Paris,2024-03-01,2024-03-31,3,40,En attente'].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'template_etudes.csv';
      link.click();
    } else {
      const headers = [
        'numeroMission', 'company', 'title', 'description', 'location', 'startDate', 'endDate',
        'studentCount', 'hours', 'chargeName', 'priceHT', 'totalTTC', 'salary', 'mandat', 'status', 'etape',
        'type', 'contact', 'students', 'expenses', 'expenseReports'
      ];
      const exampleRow = [
        '260134', 'Audencia', 'Tutorat d\'anglais', 'Description...', 'Nantes',
        '2026-01-28', '2026-02-11', '1', '6', 'Perrin Lisa', '17.5', '133.2', '60', '2025-2026', 'En attente', 'Date de mission',
        'Standard', 'Alysée Martel', 'Jean Dupont:10;Marie Curie:5', 'Train:50;Repas:20', '70'
      ].map((v) => (String(v).includes(',') ? `"${v}"` : v)).join(',');
      const csvContent = [headers.join(','), exampleRow].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'template_missions.csv';
      link.click();
    }
  };

  const handleSaveCotisations = async () => {
    if (!structureId) return;

    // Validation des clés Stripe si l'intégration est activée
    if (stripeIntegrationEnabled) {
      if (!stripePublishableKey.trim() || (!stripeSecretConfigured && !stripeSecretKeyInput.trim()) || !stripeProductId.trim() || !stripeBuyButtonId.trim()) {
        showSnackbar('Veuillez remplir toutes les clés Stripe (la clé secrète est enregistrée côté serveur)', 'error');
        return;
      }
    }

    try {
      setSavingStates(prev => ({ ...prev, cotisations: true }));

      if (stripeIntegrationEnabled && stripeSecretKeyInput.trim()) {
        const saveSecret = httpsCallable(getFunctions(), 'saveStructureStripeSecret');
        await saveSecret({ structureId, secretKey: stripeSecretKeyInput.trim() });
        setStripeSecretConfigured(true);
        setStripeSecretKeyInput('');
      }
      
      const cotisationsData: Record<string, unknown> = {
        cotisationsEnabled,
        cotisationAmount: cotisationsEnabled ? cotisationAmount : 0,
        cotisationDuration: cotisationsEnabled ? cotisationDuration : '1_year',
        stripeIntegrationEnabled: stripeIntegrationEnabled,
        stripePublishableKey: stripeIntegrationEnabled ? stripePublishableKey : '',
        stripeProductId: stripeIntegrationEnabled ? stripeProductId : '',
        stripeBuyButtonId: stripeIntegrationEnabled ? stripeBuyButtonId : '',
        stripeSecretConfigured: stripeIntegrationEnabled ? (stripeSecretConfigured || !!stripeSecretKeyInput.trim()) : false,
        stripeSecretKey: deleteField(),
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
        stripeSecretConfigured: stripeIntegrationEnabled ? true : false,
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

  const normalizeDomain = (d: string) => {
    const t = d.trim().toLowerCase();
    return t.startsWith('@') ? t : '@' + t;
  };

  // Domaines personnels interdits pour l'inscription (ex. gmail.com)
  const BLOCKED_EMAIL_DOMAINS = ['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.fr', 'outlook.com', 'hotmail.com', 'hotmail.fr', 'live.fr', 'live.com', 'orange.fr', 'free.fr', 'laposte.net', 'wanadoo.fr', 'sfr.fr', 'bbox.fr', 'icloud.com', 'me.com', 'msn.com'];

  const handleAddEmailDomain = () => {
    const domain = newEmailDomain.trim();
    if (!domain) return;
    const normalized = normalizeDomain(domain);
    const domainName = normalized.startsWith('@') ? normalized.slice(1) : normalized;
    if (BLOCKED_EMAIL_DOMAINS.includes(domainName)) {
      showSnackbar('Les domaines personnels (Gmail, Yahoo, Outlook, etc.) ne sont pas autorisés. Utilisez un domaine professionnel ou de votre établissement.', 'error');
      return;
    }
    if (emailDomains.includes(normalized)) return;
    setEmailDomains((prev) => [...prev, normalized]);
    setNewEmailDomain('');
  };

  const handleRemoveEmailDomain = (index: number) => {
    setEmailDomains((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveEmailDomains = async () => {
    if (!structureId) return;
    try {
      setSavingEmailDomains(true);
      await updateDoc(doc(db, 'structures', structureId), {
        emailDomains,
        domaines: emailDomains,
        updatedAt: new Date()
      });
      showSnackbar('Domaines email enregistrés', 'success');
    } catch (err) {
      console.error(err);
      showSnackbar('Erreur lors de l\'enregistrement des domaines', 'error');
    } finally {
      setSavingEmailDomains(false);
    }
  };

  const handleCopySignupLink = async () => {
    const url = `${window.location.origin}/register?type=student`;
    try {
      await navigator.clipboard.writeText(url);
      showSnackbar('Lien d\'inscription copié dans le presse-papier', 'success');
    } catch {
      showSnackbar('Impossible de copier le lien', 'error');
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
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      <Box component="header" sx={{ ...settingsPageStyles.header, px: 0, py: 0, bgcolor: 'transparent', borderBottom: 'none', mb: 3 }}>
        <Box>
          <Typography sx={settingsPageStyles.eyebrow}>Paramètres</Typography>
          <Typography component="h1" sx={settingsPageStyles.title}>Paramètres de la structure</Typography>
          <Typography sx={settingsPageStyles.sub}>
            Gérez les informations et la configuration de votre structure
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Informations de la structure */}
        <Grid item xs={12}>
          <SettingsCard
            title="Informations de la structure"
            subtitle="Gérez les informations générales de votre structure"
            icon={<InfoIcon sx={{ fontSize: 16 }} />}
            gradient={tokens.gradients.brand}
            iconColor={tokens.colors.brandTeal}
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
                  color: tokens.colors.textSecondary,
                  '&:hover': {
                    backgroundColor: tokens.colors.bgSubtle
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
                      {(logoPreview || organization.logo) ? (
                        <Avatar
                          src={logoPreview || organization.logo}
                          sx={{
                            width: 120,
                            height: 120,
                            borderRadius: tokens.radius.lg,
                            border: '2px solid #e5e5ea'
                          }}
                        />
                      ) : null}
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
                            borderRadius: tokens.radius.sm,
                            textTransform: 'none',
                            border: '1px solid #d1d1d6',
                            color: tokens.colors.textPrimary,
                            '&:hover': {
                              border: '1px solid #86868b',
                              backgroundColor: tokens.colors.bgSubtle
                            }
                          }}
                        >
                          Changer le logo
                        </Button>
                      </Box>
                      {logoFile ? (
                        <Button
                          variant="contained"
                          onClick={handleUploadLogo}
                          disabled={loading}
                          fullWidth
                          sx={{
                            borderRadius: tokens.radius.sm,
                            textTransform: 'none',
                            backgroundColor: '#0071e3',
                            '&:hover': {
                              backgroundColor: '#0077ed'
                            }
                          }}
                        >
                          {loading ? 'Téléchargement...' : 'Télécharger'}
                        </Button>
                      ) : null}
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
                          borderRadius: tokens.radius.sm,
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
                          borderRadius: tokens.radius.sm,
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
                          borderRadius: tokens.radius.sm,
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
                          borderRadius: tokens.radius.sm,
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
                          borderRadius: tokens.radius.sm,
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
                          borderRadius: tokens.radius.sm,
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
                          borderRadius: tokens.radius.sm,
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
                          borderRadius: tokens.radius.sm,
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
                          borderRadius: tokens.radius.sm,
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
                          borderRadius: tokens.radius.sm,
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
                          borderRadius: tokens.radius.sm,
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
                {organization.logo ? (
                  <Grid item xs={12} md={3}>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      <Avatar
                        src={organization.logo}
                        sx={{
                          width: 120,
                          height: 120,
                          borderRadius: tokens.radius.lg,
                          border: '2px solid #e5e5ea'
                        }}
                      />
                    </Box>
                  </Grid>
                ) : null}
                <Grid item xs={12} md={organization.logo ? 9 : 12}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: tokens.colors.textPrimary }}>
                        {organization.name}
                      </Typography>
                      {(organization.description && organization.description !== 'Non renseigné') ? (
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                          {organization.description}
                        </Typography>
                      ) : null}
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
                      {organization.siret ? (
                        <Grid item xs={12} sm={4}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>SIRET</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>{organization.siret}</Typography>
                        </Grid>
                      ) : null}
                      {organization.tvaNumber ? (
                        <Grid item xs={12} sm={4}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>N° de TVA</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>{organization.tvaNumber}</Typography>
                        </Grid>
                      ) : null}
                      {organization.apeCode ? (
                        <Grid item xs={12} sm={4}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Code APE</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>{organization.apeCode}</Typography>
                        </Grid>
                      ) : null}
                    </Grid>
                  </Box>
                </Grid>
              </Grid>
            )}
          </SettingsCard>
        </Grid>

        {/* Domaine(s) email pour l'inscription + lien d'inscription */}
        <Grid item xs={12}>
          <SettingsCard
            title="Domaine(s) email pour l'inscription"
            subtitle="Les membres qui s'inscrivent avec une adresse @votredomaine seront rattachés à votre structure. Configurez au moins un domaine puis copiez le lien d'inscription."
            icon={<LinkIcon sx={{ fontSize: 16 }} />}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                {emailDomains.map((domain, index) => (
                  <Chip
                    key={domain}
                    label={domain}
                    onDelete={() => handleRemoveEmailDomain(index)}
                    size="small"
                    sx={{ fontWeight: 500 }}
                  />
                ))}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    <TextField
                      size="small"
                      placeholder="ex: junior-ecp.fr"
                      value={newEmailDomain}
                      onChange={(e) => setNewEmailDomain(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEmailDomain())}
                      sx={{ width: 180 }}
                    />
                    <Button size="small" variant="outlined" onClick={handleAddEmailDomain} disabled={!newEmailDomain.trim()}>
                      <AddIcon sx={{ mr: 0.5 }} /> Ajouter
                    </Button>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Les domaines personnels (Gmail, Yahoo, Outlook, etc.) ne sont pas autorisés.
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleSaveEmailDomains}
                  disabled={savingEmailDomains || emailDomains.length === 0}
                  startIcon={savingEmailDomains ? <CircularProgress size={16} /> : <SaveIcon />}
                >
                  {savingEmailDomains ? 'Enregistrement…' : 'Enregistrer les domaines'}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleCopySignupLink}
                  startIcon={<ContentCopyIcon />}
                >
                  Copier le lien d'inscription
                </Button>
              </Box>
              {emailDomains.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  Configurez au moins un domaine (ex. @votre-ecole.fr) et enregistrez pour que le lien d'inscription associe les nouveaux membres à votre structure. Les adresses personnelles (Gmail, etc.) ne sont pas acceptées à l'inscription.
                </Typography>
              ) : null}
            </Box>
          </SettingsCard>
        </Grid>

        {/* Section Configuration */}
        <Grid item xs={12}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, color: tokens.colors.textPrimary }}>
            Configuration
          </Typography>
        </Grid>

        {/* Type de Structure — modifiable uniquement par les superadmins */}
        <Grid item xs={12} md={4}>
          <SettingsCard
            title="Type de structure"
            subtitle={isSuperAdmin ? 'Choisissez le type de votre structure' : 'Job Service ou Junior Entreprise (modifiable par un superadmin uniquement)'}
            icon={<BusinessIcon sx={{ fontSize: 16 }} />}
            gradient={tokens.gradients.brand}
            iconColor={tokens.colors.brandTeal}
          >
            {!isSuperAdmin ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                Réservé aux superadmins
              </Typography>
            ) : null}
            <FormControl fullWidth sx={{ mb: 2.5 }} disabled={!isSuperAdmin}>
                  <Select
                    value={structureType}
                    onChange={(e) => setStructureType(e.target.value as 'jobservice' | 'junior')}
                    sx={{ 
                  borderRadius: tokens.radius.sm,
                      '& .MuiOutlinedInput-notchedOutline': {
                    border: '1px solid #d1d1d6',
                    borderRadius: tokens.radius.sm
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
                          Job Service
                        </Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem value="junior">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <BusinessIcon sx={{ color: tokens.colors.brandTeal, fontSize: 18 }} />
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          Junior Entreprise
                        </Typography>
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {hasChanges.structureType ? (
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
                  ) : null}
                  <Button
                    variant="contained"
                    onClick={handleSaveStructureType}
                    disabled={!isSuperAdmin || savingStates.structureType || !hasChanges.structureType}
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
                    : tokens.colors.bgSubtle,
                  color: hasChanges.structureType ? '#ffffff' : tokens.colors.textSecondary,
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
                    background: tokens.colors.bgSubtle,
                    color: tokens.colors.textSecondary,
                    boxShadow: 'none'
                      }
                    }}
                  >
                    {savingStates.structureType ? 'Enregistrement...' : hasChanges.structureType ? 'Enregistrer' : 'Enregistré'}
                  </Button>
                </Box>
          </SettingsCard>
        </Grid>

        {/* Importer des missions / études */}
        <Grid item xs={12} md={4}>
          <SettingsCard
            title={structureType === 'junior' ? 'Importer des études' : 'Importer des missions'}
            subtitle={structureType === 'junior' ? 'Import en masse depuis un fichier CSV' : 'Import en masse depuis un fichier CSV'}
            icon={<CloudUploadIcon sx={{ fontSize: 16 }} />}
            gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
            iconColor="#10b981"
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<CloudUploadIcon />}
                onClick={() => setImportDialogOpen(true)}
                sx={{ borderRadius: tokens.radius.sm, textTransform: 'none', fontWeight: 500 }}
              >
                {structureType === 'junior' ? 'Importer des études' : 'Importer des missions'}
              </Button>
              <Button
                variant="text"
                fullWidth
                size="small"
                onClick={downloadTestCsv}
                sx={{ textTransform: 'none', fontSize: '0.75rem', color: 'text.secondary' }}
              >
                Télécharger un CSV de test complexe
              </Button>
            </Box>
          </SettingsCard>
        </Grid>

        {/* Taux horaire (Job Service) / Coût JEH (Junior Entreprise) */}
        <Grid item xs={12} md={4}>
          <SettingsCard
            title={structureType === 'junior' ? 'Coût JEH' : 'Taux horaire'}
            subtitle={structureType === 'junior' ? 'Coût par Journée Étudiant Homme (JEH)' : 'Taux horaire par défaut'}
            icon={<EuroIcon sx={{ fontSize: 16 }} />}
            gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
            iconColor="#10b981"
          >
                <TextField
                  label={structureType === 'junior' ? 'Coût JEH (€)' : 'Taux horaire HT'}
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  InputProps={{
                    endAdornment: <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>{structureType === 'junior' ? '€/JEH' : '€/h'}</Typography>,
                    sx: { 
                    borderRadius: tokens.radius.sm,
                      '& .MuiOutlinedInput-notchedOutline': {
                      border: '1px solid #d1d1d6',
                      borderRadius: tokens.radius.sm
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

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 1.5 }}>
                  {hasChanges.hourlyRate ? (
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
                  ) : null}
                  <Button
                    variant="contained"
                    onClick={handleSaveHourlyRate}
                    disabled={savingStates.hourlyRate || !hasChanges.hourlyRate}
                    startIcon={savingStates.hourlyRate ? <LinearProgress sx={{ width: 20, height: 20 }} /> : <SaveIcon />}
                    fullWidth
                    sx={{ 
                    borderRadius: tokens.radius.sm,
                    py: 1.25,
                    textTransform: 'none',
                    fontWeight: 500,
                      background: hasChanges.hourlyRate 
                      ? '#0071e3'
                      : tokens.colors.bgSubtle,
                    color: hasChanges.hourlyRate ? '#ffffff' : tokens.colors.textSecondary,
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
                      background: tokens.colors.bgSubtle,
                      color: tokens.colors.textSecondary,
                      boxShadow: 'none'
                      }
                    }}
                  >
                    {savingStates.hourlyRate ? 'Enregistrement...' : hasChanges.hourlyRate ? 'Enregistrer' : 'Enregistré'}
                  </Button>
                </Box>
          </SettingsCard>
        </Grid>

        {/* Gratification par défaut (nette et brute) */}
        <Grid item xs={12} md={4}>
          <SettingsCard
            title="Gratification par défaut"
            subtitle="Gratification nette et brute par défaut"
            icon={<EuroIcon sx={{ fontSize: 16 }} />}
            gradient={tokens.gradients.brand}
            iconColor={tokens.colors.brandTeal}
          >
                <TextField
                  label="Gratification nette (€)"
                  type="number"
                  value={gratificationNetDefault}
                  onChange={(e) => {
                    const v = e.target.value === '' ? 0 : parseFloat(e.target.value);
                    setGratificationNetDefault(isNaN(v) ? gratificationNetDefault : v);
                  }}
                  inputProps={{ step: 0.01, min: 0 }}
                  InputProps={{
                    endAdornment: <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>€</Typography>,
                    sx: {
                      borderRadius: tokens.radius.sm,
                      '& .MuiOutlinedInput-notchedOutline': {
                        border: '1px solid #d1d1d6',
                        borderRadius: tokens.radius.sm
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
                  sx={{ mb: 1.5 }}
                />
                <TextField
                  label="Gratification brute (€)"
                  type="number"
                  value={gratificationBruteDefault}
                  onChange={(e) => {
                    const v = e.target.value === '' ? 0 : parseFloat(e.target.value);
                    setGratificationBruteDefault(isNaN(v) ? gratificationBruteDefault : v);
                  }}
                  inputProps={{ step: 0.01, min: 0 }}
                  InputProps={{
                    endAdornment: <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>€</Typography>,
                    sx: {
                      borderRadius: tokens.radius.sm,
                      '& .MuiOutlinedInput-notchedOutline': {
                        border: '1px solid #d1d1d6',
                        borderRadius: tokens.radius.sm
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

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 1.5 }}>
                  {hasChanges.gratification ? (
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
                  ) : null}
                  <Button
                    variant="contained"
                    onClick={handleSaveGratification}
                    disabled={savingStates.gratification || !hasChanges.gratification}
                    startIcon={savingStates.gratification ? <LinearProgress sx={{ width: 20, height: 20 }} /> : <SaveIcon />}
                    fullWidth
                    sx={{
                      borderRadius: tokens.radius.sm,
                      py: 1.25,
                      textTransform: 'none',
                      fontWeight: 500,
                      background: hasChanges.gratification
                        ? '#0071e3'
                        : tokens.colors.bgSubtle,
                      color: hasChanges.gratification ? '#ffffff' : tokens.colors.textSecondary,
                      boxShadow: hasChanges.gratification
                        ? '0 2px 8px rgba(0, 113, 227, 0.2)'
                        : 'none',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        background: hasChanges.gratification
                          ? '#0077ed'
                          : '#e5e5ea',
                        boxShadow: hasChanges.gratification
                          ? '0 4px 12px rgba(0, 113, 227, 0.3)'
                          : 'none'
                      },
                      '&:disabled': {
                        background: tokens.colors.bgSubtle,
                        color: tokens.colors.textSecondary,
                        boxShadow: 'none'
                      }
                    }}
                  >
                    {savingStates.gratification ? 'Enregistrement...' : hasChanges.gratification ? 'Enregistrer' : 'Enregistré'}
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
                      borderRadius: tokens.radius.md,
                      '& .MuiOutlinedInput-notchedOutline': {
                    border: '1px solid #d1d1d6',
                    borderRadius: tokens.radius.sm
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

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 1.5 }}>
                  {hasChanges.daysUntilDue ? (
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
                  ) : null}
                  <Button
                    variant="contained"
                    onClick={handleSaveDaysUntilDue}
                    disabled={savingStates.daysUntilDue || !hasChanges.daysUntilDue}
                    startIcon={savingStates.daysUntilDue ? <LinearProgress sx={{ width: 20, height: 20 }} /> : <SaveIcon />}
                    fullWidth
                    sx={{ 
                    borderRadius: tokens.radius.sm,
                    py: 1.25,
                    textTransform: 'none',
                    fontWeight: 500,
                      background: hasChanges.daysUntilDue 
                      ? '#0071e3'
                      : tokens.colors.bgSubtle,
                    color: hasChanges.daysUntilDue ? '#ffffff' : tokens.colors.textSecondary,
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
                      background: tokens.colors.bgSubtle,
                      color: tokens.colors.textSecondary,
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
              <SettingsPanelRow
                label="Obligatoire pour les membres"
                hint="Appliquer le F2A à tous les membres de la structure"
              >
                <DsToggle
                  checked={f2aRequiredForMembers}
                  onChange={setF2aRequiredForMembers}
                  accent={tokens.colors.error}
                />
              </SettingsPanelRow>

              <SettingsPanelRow
                label="Obligatoire pour les étudiants"
                hint="Appliquer le F2A à tous les étudiants"
                last
              >
                <DsToggle
                  checked={f2aRequiredForStudents}
                  onChange={setF2aRequiredForStudents}
                  accent={tokens.colors.error}
                />
              </SettingsPanelRow>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {hasChanges.f2a ? (
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
              ) : null}
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
                    : tokens.colors.bgSubtle,
                  color: hasChanges.f2a ? '#ffffff' : tokens.colors.textSecondary,
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
                    background: tokens.colors.bgSubtle,
                    color: tokens.colors.textSecondary,
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
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, mt: 2, color: tokens.colors.textPrimary }}>
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
            <Alert severity="info" sx={{ mb: 2 }}>
              Contacter le support pour les réglages techniques.
            </Alert>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mb: 2 }}>
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
                        color: tokens.colors.textSecondary,
                        '&:hover': {
                          backgroundColor: tokens.colors.bgSubtle
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
                  <SettingsPanelRow label="Activer les cotisations" last={!cotisationsEnabled}>
                    <DsToggle
                      checked={cotisationsEnabled}
                      onChange={setCotisationsEnabled}
                      accent={tokens.colors.warning}
                    />
                  </SettingsPanelRow>

                  {cotisationsEnabled ? (
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
                              const cleanValue = value.replace(/[^0-9,.]/g, '');
                              
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
                                borderRadius: tokens.radius.sm,
                                '& .MuiOutlinedInput-notchedOutline': {
                                  border: '1px solid #d1d1d6',
                                  borderRadius: tokens.radius.sm
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
                            borderRadius: tokens.radius.sm,
                                '& .MuiOutlinedInput-notchedOutline': {
                              border: '1px solid #d1d1d6',
                              borderRadius: tokens.radius.sm
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

                      <SettingsPanelRow label="Intégrer Stripe" last={!stripeIntegrationEnabled}>
                        <DsToggle
                          checked={stripeIntegrationEnabled}
                          onChange={setStripeIntegrationEnabled}
                          accent={tokens.colors.brandTeal}
                        />
                      </SettingsPanelRow>

                      {stripeIntegrationEnabled ? (
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
                                borderRadius: tokens.radius.sm,
                                    '& .MuiOutlinedInput-notchedOutline': {
                                  border: '1px solid #d1d1d6',
                                  borderRadius: tokens.radius.sm
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
                                value={stripeSecretKeyInput}
                                onChange={(e) => setStripeSecretKeyInput(e.target.value)}
                                fullWidth
                                type="password"
                                placeholder={stripeSecretConfigured ? '•••••••• (déjà configurée — laisser vide pour conserver)' : 'sk_...'}
                                sx={{ 
                                  '& .MuiOutlinedInput-root': { 
                                borderRadius: tokens.radius.sm,
                                    '& .MuiOutlinedInput-notchedOutline': {
                                  border: '1px solid #d1d1d6',
                                  borderRadius: tokens.radius.sm
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                  border: '1px solid #86868b'
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                  border: '2px solid #0071e3'
                                    }
                                  } 
                                }}
                                helperText={stripeSecretConfigured ? 'Clé enregistrée côté serveur. Saisir une nouvelle valeur pour la remplacer.' : 'sk_... (jamais stockée dans Firestore)'}
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
                                borderRadius: tokens.radius.sm,
                                    '& .MuiOutlinedInput-notchedOutline': {
                                  border: '1px solid #d1d1d6',
                                  borderRadius: tokens.radius.sm
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
                                borderRadius: tokens.radius.sm,
                                    '& .MuiOutlinedInput-notchedOutline': {
                                  border: '1px solid #d1d1d6',
                                  borderRadius: tokens.radius.sm
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
                      ) : null}
                    </Box>
                  ) : null}

                  {/* Section Utilisateurs avec cotisations payées */}
              <Divider sx={{ my: 2, borderColor: '#e5e5ea' }} />
                  
                <Box sx={{ mb: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: tokens.colors.textPrimary, fontSize: '0.9375rem' }}>
                        Utilisateurs avec cotisations payées ({usersWithSubscriptions.length})
                      </Typography>
                      <IconButton
                        onClick={() => setUsersListExpanded(!usersListExpanded)}
                    size="small"
                        sx={{
                      borderRadius: '6px',
                      color: tokens.colors.textSecondary,
                          '&:hover': {
                        backgroundColor: tokens.colors.bgSubtle
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
                      borderRadius: tokens.radius.sm,
                      border: '1px solid #e5e5ea'
                        }}>
                      <PaymentIcon sx={{ fontSize: 32, color: tokens.colors.textSecondary, mb: 1.5, opacity: 0.4 }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5, color: tokens.colors.textPrimary, fontSize: '0.9375rem' }}>
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
                                borderRadius: tokens.radius.sm,
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
                                bgcolor: tokens.colors.bgSubtle,
                                color: tokens.colors.textPrimary,
                                    fontWeight: 600,
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  {`${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.trim() || '?'}
                                </Avatar>
                                <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                                  <UserNameText
                                    user={user}
                                    variant="body2"
                                    sx={{ fontWeight: 600, mb: 0.25, fontSize: '0.875rem' }}
                                  />
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
                  {hasChanges.cotisations ? (
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
                  ) : null}
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
                      : tokens.colors.bgSubtle,
                    color: hasChanges.cotisations ? '#ffffff' : tokens.colors.textSecondary,
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
                      background: tokens.colors.bgSubtle,
                      color: tokens.colors.textSecondary,
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
      </Grid>

      <ImportMissionsEtudesDialog
        open={importDialogOpen}
        onClose={() => {
          setImportDialogOpen(false);
          setImportedData([]);
          setImportValidationErrors([]);
          setImportDuplicateHints([]);
        }}
        type={structureType === 'junior' ? 'etude' : 'mission'}
        importedData={importedData}
        onFileParsed={handleFileParsed}
        onImport={handleImportClick}
        onDownloadTemplate={downloadImportTemplate}
        importing={importing}
        processingAI={importProcessingAI}
        validationErrors={importValidationErrors}
        duplicateHints={importDuplicateHints}
      />

      <Dialog
        open={confirmCreateCompaniesOpen}
        onClose={() => setConfirmCreateCompaniesOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          Créer les entreprises manquantes ?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Les entreprises suivantes n&apos;existent pas encore dans votre liste. Souhaitez-vous les créer avant l&apos;import ? Elles apparaîtront dans la page Entreprises.
          </Typography>
          <List dense sx={{ bgcolor: 'grey.50', borderRadius: 1 }}>
            {importCompaniesToCreate.filter((n) => n && String(n).trim()).map((name, i) => (
              <ListItem key={`${i}-${String(name)}`}>
                <ListItemText primary={String(name)} primaryTypographyProps={{ fontWeight: 500 }} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmCreateCompaniesOpen(false)} color="inherit">
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setConfirmCreateCompaniesOpen(false);
              handleImport();
            }}
          >
            Créer les entreprises et importer
          </Button>
        </DialogActions>
      </Dialog>

      {createPortal(
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          sx={{ zIndex: 10000 }}
        >
          <Alert
            onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
            severity={snackbar.severity}
            icon={snackbar.severity === 'success' ? <CheckCircleIcon /> : <ErrorIcon />}
            sx={{
              borderRadius: tokens.radius.lg,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>,
        document.body
      )}
    </Box>
  );
};

export default StructureSettings; 