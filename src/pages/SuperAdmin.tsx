import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  Snackbar,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  MenuItem,
  Select,
  SelectChangeEvent,
  IconButton,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Divider,
  Tooltip,
  CircularProgress,
  LinearProgress,
  Radio
} from '@mui/material';
import { createStructure, getStructures, deleteStructure } from '../firebase/structure';
import { Structure } from '../types/structure';
import { getReports, updateReportStatus, Report } from '../services/reportService';
import { 
  collection, 
  getDocs, 
  getDoc,
  updateDoc, 
  doc, 
  query, 
  where, 
  orderBy,
  limit,
  serverTimestamp,
  addDoc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ReplyIcon from '@mui/icons-material/Reply';
import NotificationsIcon from '@mui/icons-material/Notifications';
import StripeCustomers from './settings/StripeCustomers';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { auth } from '../firebase/config';
import { useNotifications } from '../contexts/NotificationContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { sendDemarchageEmailClient } from '../services/emailjsDemarchage';
import LockIcon from '@mui/icons-material/Lock';
import { decryptActivityUsersList, decryptUsersList } from '../utils/decryptUserUtils';
import { toDateFromFirestore, formatDate } from '../utils/dateUtils';
import SecurityIcon from '@mui/icons-material/Security';
import LoginIcon from '@mui/icons-material/Login';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import LinkIcon from '@mui/icons-material/Link';
import { tokens } from '../theme/tokens';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import ContactMailIcon from '@mui/icons-material/ContactMail';
import ScienceIcon from '@mui/icons-material/Science';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { getStripeCustomers } from '../services/stripeApiService';

interface StructureData {
  id: string;
  nom: string;
  ecole: string;
  domaines?: string[];
  createdAt?: any;
  subscriptionStatus?: string;
  email?: string;
  /** junior = JE (études), jobservice = JS (missions) */
  structureType?: 'junior' | 'jobservice';
}

interface StripeCustomerInfo {
  subscriptionStatus: string;
  subscriptionTitle?: string;
  cancelAtPeriodEnd?: boolean;
}

interface SuperAdmin {
  id: string;
  email: string;
  structureId?: string;
}

interface ExtendedReport extends Report {
  id: string;
  response?: string;
  responses?: Array<{
    text: string;
    timestamp: any;
    author: string;
  }>;
  imageUrl?: string;
}

// Interface pour les notifications
interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: any;
  readBy: Array<{
    userId: string;
    userName: string;
    readAt: any;
  }>;
  recipientCount: number;
}

// Interface pour le formulaire de notification
interface NotificationFormData {
  title: string;
  message: string;
  recipientType: 'all' | 'structure' | 'user';
  selectedStructureId: string;
  selectedUserId: string;
}

// Interface pour les props du dialogue de notification
interface NotificationDialogProps {
  open: boolean;
  onClose: () => void;
  formData: NotificationFormData;
  onFormChange: (field: string, value: string) => void;
  onSend: () => void;
  structures: StructureData[];
  users: Array<{id: string, email: string, displayName: string}>;
}

// Interface pour le dialogue d'ajout d'utilisateur
interface AddUserDialogProps {
  open: boolean;
  onClose: () => void;
  structureId: string;
  structureName: string;
  onAddUser: (userData: any) => void;
}

// Démarchage SuperAdmin : prospects (JE/JS) et contacts, hors structures
interface DemarchageProspect {
  id: string;
  type: 'je' | 'js';
  name: string;
  school?: string;
  createdAt?: any;
}

interface DemarchageContact {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  email: string;
  /** Date du dernier envoi d'email de démarchage (Firestore Timestamp) */
  lastEmailSentAt?: any;
}

// Composant pour le dialogue d'envoi de notification
const NotificationFormDialog: React.FC<NotificationDialogProps> = ({
  open,
  onClose,
  formData,
  onFormChange,
  onSend,
  structures,
  users
}) => (
  <Dialog 
    open={open} 
    onClose={onClose}
    maxWidth="md"
    fullWidth
  >
    <DialogTitle>Envoyer une notification</DialogTitle>
    <DialogContent dividers>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Titre de la notification"
            value={formData.title}
            onChange={(e) => onFormChange('title', e.target.value)}
            required
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Message"
            multiline
            rows={4}
            value={formData.message}
            onChange={(e) => onFormChange('message', e.target.value)}
            required
          />
        </Grid>
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>Destinataire</InputLabel>
            <Select
              value={formData.recipientType}
              onChange={(e) => onFormChange('recipientType', e.target.value)}
              label="Destinataire"
            >
              <MenuItem value="all">Tous les utilisateurs</MenuItem>
              <MenuItem value="structure">Une structure spécifique</MenuItem>
              <MenuItem value="user">Un utilisateur spécifique</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        {formData.recipientType === 'structure' && (
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Structure</InputLabel>
              <Select
                value={formData.selectedStructureId}
                onChange={(e) => onFormChange('selectedStructureId', e.target.value)}
                label="Structure"
              >
                {structures.map((structure) => (
                  <MenuItem key={structure.id} value={structure.id}>
                    {structure.nom} ({structure.ecole})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}
        
        {formData.recipientType === 'user' && (
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Utilisateur</InputLabel>
              <Select
                value={formData.selectedUserId}
                onChange={(e) => onFormChange('selectedUserId', e.target.value)}
                label="Utilisateur"
              >
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.displayName} ({user.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}
      </Grid>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Annuler</Button>
      <Button onClick={onSend} variant="contained" color="primary">
        Envoyer
      </Button>
    </DialogActions>
  </Dialog>
);

// Composant pour le dialogue d'ajout d'utilisateur
const AddUserDialog: React.FC<AddUserDialogProps> = ({
  open,
  onClose,
  structureId,
  structureName,
  onAddUser,
}) => {
  const initialState = {
    email: '',
    displayName: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
    birthDate: '',
    graduationYear: '',
    program: '',
    status: 'etudiant' as const,
    structureId: '',
    ecole: '',
    birthPlace: '',
    postalCode: '',
    gender: 'M' as 'M' | 'F' | 'Autre',
    nationality: '',
    studentId: '',
    address: '',
    socialSecurityNumber: '',
    phone: '',
    profileCompletion: 0
  };

  const [userData, setUserData] = useState(initialState);

  const [errors, setErrors] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: ''
  });

  React.useEffect(() => {
    if (open) {
      setUserData({ ...initialState });
      setErrors({ email: '', firstName: '', lastName: '', password: '', confirmPassword: '' });
    }
  }, [open]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserData(prev => ({
      ...prev,
      [name]: value
    }));

    // Validation en temps réel
    if (name === 'email') {
      setErrors(prev => ({
        ...prev,
        email: validateEmail(value) ? '' : 'Email invalide'
      }));
    } else if (['firstName', 'lastName'].includes(name)) {
      setErrors(prev => ({
        ...prev,
        [name]: value.trim() === '' ? 'Ce champ est obligatoire' : ''
      }));
    } else if (name === 'password') {
      setErrors(prev => ({
        ...prev,
        password: value.length >= 8 ? '' : 'Minimum 8 caractères',
        confirmPassword: userData.confirmPassword ? (value !== userData.confirmPassword ? 'Les mots de passe ne correspondent pas' : '') : prev.confirmPassword
      }));
    } else if (name === 'confirmPassword') {
      setErrors(prev => ({
        ...prev,
        confirmPassword: value !== userData.password ? 'Les mots de passe ne correspondent pas' : ''
      }));
    }
  };

  const handleSelectChange = (e: SelectChangeEvent) => {
    const { name, value } = e.target;
    setUserData(prev => ({
      ...prev,
      [name as string]: value
    }));
  };

  const isFormValid = () => {
    return (
      validateEmail(userData.email) &&
      userData.firstName.trim() !== '' &&
      userData.lastName.trim() !== '' &&
      userData.password.length >= 8 &&
      userData.password === userData.confirmPassword
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Ajouter un utilisateur à {structureName}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Email"
              name="email"
              type="email"
              value={userData.email}
              onChange={handleTextChange}
              error={!!errors.email}
              helperText={errors.email}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Mot de passe"
              name="password"
              type="password"
              value={userData.password}
              onChange={handleTextChange}
              error={!!errors.password}
              helperText={errors.password || 'Minimum 8 caractères'}
              required
              autoComplete="new-password"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Confirmer le mot de passe"
              name="confirmPassword"
              type="password"
              value={userData.confirmPassword}
              onChange={handleTextChange}
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword}
              required
              autoComplete="new-password"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Prénom"
              name="firstName"
              value={userData.firstName}
              onChange={handleTextChange}
              error={!!errors.firstName}
              helperText={errors.firstName}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Nom"
              name="lastName"
              value={userData.lastName}
              onChange={handleTextChange}
              error={!!errors.lastName}
              helperText={errors.lastName}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Date de naissance"
              name="birthDate"
              type="date"
              value={userData.birthDate}
              onChange={handleTextChange}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Année de diplômation"
              name="graduationYear"
              value={userData.graduationYear}
              onChange={handleTextChange}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Programme"
              name="program"
              value={userData.program}
              onChange={handleTextChange}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Numéro étudiant"
              name="studentId"
              value={userData.studentId}
              onChange={handleTextChange}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Téléphone"
              name="phone"
              value={userData.phone}
              onChange={handleTextChange}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Adresse"
              name="address"
              value={userData.address}
              onChange={handleTextChange}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Lieu de naissance"
              name="birthPlace"
              value={userData.birthPlace}
              onChange={handleTextChange}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Code postal"
              name="postalCode"
              value={userData.postalCode}
              onChange={handleTextChange}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Genre</InputLabel>
              <Select
                name="gender"
                value={userData.gender}
                onChange={handleSelectChange}
                label="Genre"
              >
                <MenuItem value="M">Masculin</MenuItem>
                <MenuItem value="F">Féminin</MenuItem>
                <MenuItem value="Autre">Autre</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Nationalité"
              name="nationality"
              value={userData.nationality}
              onChange={handleTextChange}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Numéro de sécurité sociale"
              name="socialSecurityNumber"
              value={userData.socialSecurityNumber}
              onChange={handleTextChange}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button 
          onClick={() => {
            const { confirmPassword, ...rest } = userData;
            onAddUser({
              ...rest,
              password: userData.password,
              displayName: `${userData.firstName} ${userData.lastName}`.trim(),
              structureId: structureId,
              ecole: structureName
            });
            onClose();
          }}
          variant="contained"
          disabled={!isFormValid()}
        >
          Ajouter
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const SuperAdmin: React.FC = () => {
  const [formData, setFormData] = useState({
    nom: '',
    ecole: '',
    emailDomain: ''
  });
  const [emailDomains, setEmailDomains] = useState<string[]>([]);
  const [message, setMessage] = useState({ type: 'success', text: '' });
  const [open, setOpen] = useState(false);
  const [structures, setStructures] = useState<StructureData[]>([]);
  const [reports, setReports] = useState<ExtendedReport[]>([]);
  const [tabValue, setTabValue] = useState(0);
  const [superAdmins, setSuperAdmins] = useState<SuperAdmin[]>([]);
  const [editingStructure, setEditingStructure] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Partial<StructureData>>({});
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<{
    structureMembers: Array<{ email: string; role: string }>;
    students: Array<{ email: string; status: string }>;
  }>({ structureMembers: [], students: [] });
  const [selectedStructureName, setSelectedStructureName] = useState('');
  const [openImageDialog, setOpenImageDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showResponseInput, setShowResponseInput] = useState<{[key: string]: boolean}>({});
  
  // États pour la gestion des notifications
  const [notificationForm, setNotificationForm] = useState<NotificationFormData>({
    title: '',
    message: '',
    recipientType: 'all', // 'all', 'structure', 'user'
    selectedStructureId: '',
    selectedUserId: ''
  });
  const [users, setUsers] = useState<Array<{id: string, email: string, displayName: string}>>([]);
  const [openNotificationDialog, setOpenNotificationDialog] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { sendNotification } = useNotifications();

  // États pour la migration du chiffrement
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<any>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // État pour le seed des données de test
  const [seedLoading, setSeedLoading] = useState<string | null>(null);

  // États pour la migration member -> membre
  const [memberMigrationLoading, setMemberMigrationLoading] = useState(false);
  const [memberMigrationStats, setMemberMigrationStats] = useState<{
    totalUsers: number;
    usersToMigrate: number;
    usersMigrated: number;
  } | null>(null);
  const [memberMigrationError, setMemberMigrationError] = useState<string | null>(null);

  // Ajouter un nouvel onglet
  const tabs = ['Structures', 'Rapports', 'Super Admins', 'Notifications', 'Connexions & Inscriptions', 'Clients Stripe', 'Démarchage', 'Migration Chiffrement', 'Migration Données'];

  // Ajouter l'état pour le filtre de statut (après les autres états)
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('all');

  // Ajout de l'interface pour le dialogue d'ajout d'utilisateur
  const [openAddUserDialog, setOpenAddUserDialog] = useState(false);
  const [selectedStructureForUser, setSelectedStructureForUser] = useState<{id: string, name: string} | null>(null);

  // États pour Connexions & Inscriptions
  const [recentSignups, setRecentSignups] = useState<Array<{id: string; email: string; displayName: string; structureName: string; createdAt: Date; status?: string}>>([]);
  const [recentLogins, setRecentLogins] = useState<Array<{id: string; email: string; displayName: string; structureName: string; lastActivity: Date; status?: string}>>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Lien de connexion diagnostic (magic link Firebase)
  const [loginLinkUsers, setLoginLinkUsers] = useState<
    Array<{ id: string; email: string; displayName: string; structureName: string; status: string }>
  >([]);
  const [loginLinkUsersLoading, setLoginLinkUsersLoading] = useState(false);
  const [selectedLoginLinkUserId, setSelectedLoginLinkUserId] = useState<string | null>(null);
  const [loginLinkSearchQuery, setLoginLinkSearchQuery] = useState('');
  const [loginLinkHasSearched, setLoginLinkHasSearched] = useState(false);
  const [generatingLinkFor, setGeneratingLinkFor] = useState<string | null>(null);
  const productionAppOrigin = (
    (import.meta.env.VITE_APP_URL as string | undefined)?.trim() || 'https://js-connect.fr'
  ).replace(/\/$/, '');

  const isLocalDevHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  const [loginLinkBaseUrl, setLoginLinkBaseUrl] = useState(
    isLocalDevHost ? window.location.origin : productionAppOrigin
  );
  const [loginLinkDialog, setLoginLinkDialog] = useState<{
    open: boolean;
    link: string;
    email: string;
    displayName: string;
    targetOrigin: string;
  }>({ open: false, link: '', email: '', displayName: '', targetOrigin: '' });

  // États pour Démarchage (prospects JE/JS hors structures)
  const [demarchageProspects, setDemarchageProspects] = useState<DemarchageProspect[]>([]);
  const [demarchageContactsByProspect, setDemarchageContactsByProspect] = useState<Record<string, DemarchageContact[]>>({});
  const [demarchageLoading, setDemarchageLoading] = useState(false);
  const [demarchageExpanded, setDemarchageExpanded] = useState<string | null>(null);
  const [newProspectForm, setNewProspectForm] = useState<{ type: 'je' | 'js'; name: string; school: string }>({ type: 'je', name: '', school: '' });
  const [newContactForm, setNewContactForm] = useState<{ prospectId: string; prospectName: string; firstName: string; lastName: string; position: string; email: string } | null>(null);
  const [sendingEmailContactId, setSendingEmailContactId] = useState<string | null>(null);

  // Clients Stripe pour la colonne Abonnement (Structures existantes) — même source que Organization / Clients Stripe
  const [stripeCustomersByEmail, setStripeCustomersByEmail] = useState<Record<string, StripeCustomerInfo>>({});
  const [loadingStripeCustomers, setLoadingStripeCustomers] = useState(false);

  const searchLoginLinkUsers = async (query: string) => {
    const q = query.trim();
    if (q.length < 2) {
      setLoginLinkUsers([]);
      setLoginLinkHasSearched(false);
      setSelectedLoginLinkUserId(null);
      return;
    }

    setLoginLinkUsersLoading(true);
    setSelectedLoginLinkUserId(null);
    try {
      const fn = httpsCallable(getFunctions(), 'searchUsersForSuperAdmin');
      const result = await fn({ query: q, limit: 25 });
      const data = result.data as {
        users: Array<{
          id: string;
          email: string;
          displayName: string;
          structureName: string;
          status: string;
        }>;
      };
      setLoginLinkUsers(data.users || []);
      setLoginLinkHasSearched(true);
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('Erreur recherche utilisateurs:', error);
      setLoginLinkUsers([]);
      setLoginLinkHasSearched(true);
      setMessage({
        type: 'error',
        text: err?.message || 'Erreur lors de la recherche.',
      });
      setOpen(true);
    } finally {
      setLoginLinkUsersLoading(false);
    }
  };

  const handleGenerateLoginLink = async (params: {
    userId?: string;
    displayName?: string;
  }) => {
    const key = params.userId || 'selected';
    setGeneratingLinkFor(key);
    try {
      const fn = httpsCallable(getFunctions(), 'generateSuperAdminLoginLink');
      const result = await fn({ userId: params.userId, baseUrl: loginLinkBaseUrl });
      const data = result.data as {
        loginLink: string;
        email: string;
        displayName: string;
        targetOrigin: string;
        expiresInMinutes: number;
      };
      window.localStorage.setItem('emailForSignIn', data.email);
      setLoginLinkDialog({
        open: true,
        link: data.loginLink,
        email: data.email,
        displayName: data.displayName || params.displayName || data.email,
        targetOrigin: data.targetOrigin || loginLinkBaseUrl,
      });
    } catch (error: unknown) {
      console.error('Erreur génération lien de connexion:', error);
      const errMsg =
        error instanceof Error
          ? error.message
          : typeof error === 'object' &&
              error !== null &&
              'message' in error &&
              typeof (error as { message: unknown }).message === 'string'
            ? (error as { message: string }).message
            : 'Impossible de générer le lien de connexion.';
      setMessage({ type: 'error', text: errMsg });
      setOpen(true);
    } finally {
      setGeneratingLinkFor(null);
    }
  };

  const handleCopyLoginLink = async () => {
    try {
      await navigator.clipboard.writeText(loginLinkDialog.link);
      setMessage({ type: 'success', text: 'Lien copié dans le presse-papiers.' });
      setOpen(true);
    } catch {
      setMessage({ type: 'error', text: 'Impossible de copier le lien.' });
      setOpen(true);
    }
  };

  // Charger les structures au montage du composant
  useEffect(() => {
    const checkSuperAdminStatus = async () => {
      if (!currentUser) {
        navigate('/login');
        return;
      }
      
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        
        // Vérifier à la fois role et status pour la compatibilité
        if (!userDoc.exists() || (userData?.role !== 'superadmin' && userData?.status !== 'superadmin')) {
          navigate('/app/dashboard');
          return;
        }
        
        // Si l'utilisateur est superadmin, charger les données
        fetchStructures();
        fetchReports();
        fetchSuperAdmins();
        fetchNotifications();
      } catch (error) {
        console.error('Erreur lors de la vérification des permissions:', error);
        navigate('/app/dashboard');
      }
    };

    checkSuperAdminStatus();
  }, [currentUser, navigate]);

  const fetchStructures = async () => {
    try {
      const structuresRef = collection(db, 'structures');
      const snapshot = await getDocs(query(structuresRef, limit(200)));
      const structuresData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StructureData[];
      
      // Trier les structures par nom
      setStructures(structuresData.sort((a, b) => a.nom.localeCompare(b.nom)));
    } catch (error) {
      console.error('Erreur lors du chargement des structures:', error);
      setMessage({ type: 'error', text: 'Erreur lors du chargement des structures' });
      setOpen(true);
    }
  };

  // Charger les clients Stripe pour la colonne Abonnement (même logique que Organization / Clients Stripe)
  useEffect(() => {
    if (tabValue !== 0) return;
    let cancelled = false;
    const load = async () => {
      setLoadingStripeCustomers(true);
      try {
        let customers: Array<{ email?: string; subscriptionStatus: string; subscriptionTitle?: string; cancelAtPeriodEnd?: boolean }> = [];
        try {
          customers = await getStripeCustomers();
        } catch {
          const functions = getFunctions();
          const getStripeCustomersCallable = httpsCallable(functions, 'getStripeCustomers');
          const result = await getStripeCustomersCallable();
          customers = (result.data as Array<{ email?: string; subscriptionStatus: string; subscriptionTitle?: string; cancelAtPeriodEnd?: boolean }>) || [];
        }
        if (!cancelled) {
          const byEmail: Record<string, StripeCustomerInfo> = {};
          customers.forEach((c) => {
            if (c.email && c.email.trim()) {
              byEmail[c.email.toLowerCase().trim()] = {
                subscriptionStatus: c.subscriptionStatus,
                subscriptionTitle: c.subscriptionTitle,
                cancelAtPeriodEnd: c.cancelAtPeriodEnd
              };
            }
          });
          setStripeCustomersByEmail(byEmail);
        }
      } catch (err) {
        if (!cancelled) console.error('Erreur chargement clients Stripe:', err);
      } finally {
        if (!cancelled) setLoadingStripeCustomers(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tabValue]);

  const fetchReports = async () => {
    try {
      const reportsData = await getReports();
      setReports(reportsData as ExtendedReport[]);
    } catch (error) {
      console.error('Erreur lors du chargement des rapports:', error);
    }
  };

  const fetchSuperAdmins = async () => {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(query(usersRef, limit(500)));
      const superAdminUsers = snapshot.docs
        .filter(doc => {
          const data = doc.data();
          return data.role === 'superadmin' || data.status === 'superadmin';
        })
        .map(doc => ({
          id: doc.id,
          email: doc.data().email,
          structureId: doc.data().structureId || ''
        }));
      setSuperAdmins(superAdminUsers);
    } catch (error) {
      console.error('Erreur lors du chargement des super admins:', error);
      setMessage({ type: 'error', text: 'Erreur lors du chargement des super admins' });
      setOpen(true);
    }
  };

  // Fonction pour récupérer les notifications
  const fetchNotifications = async () => {
    try {
      const notificationsRef = collection(db, 'notifications');
      const q = query(notificationsRef, where('type', '==', 'admin_notification'));
      const snapshot = await getDocs(q);
      
      const notificationsData = await Promise.all(
        snapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data();
          
          // Récupérer les informations sur les utilisateurs qui ont lu la notification
          const readByPromises = (data.readBy || []).map(async (readInfo: any) => {
            try {
              const userDocRef = doc(db, 'users', readInfo.userId);
              const userDocSnapshot = await getDoc(userDocRef);
              const userData = userDocSnapshot.data();
              return {
                userId: readInfo.userId,
                userName: userData?.displayName || userData?.email || 'Utilisateur inconnu',
                readAt: readInfo.readAt
              };
            } catch (error) {
              console.error('Erreur lors de la récupération des informations utilisateur:', error);
              return {
                userId: readInfo.userId,
                userName: 'Utilisateur inconnu',
                readAt: readInfo.readAt
              };
            }
          });
          
          const readBy = await Promise.all(readByPromises);
          
          // Utiliser le recipientCount stocké dans la notification
          const recipientCount = data.recipientCount || 0;
          
          return {
            id: docSnapshot.id,
            title: data.title,
            message: data.message,
            type: data.type,
            createdAt: data.createdAt,
            readBy,
            recipientCount
          };
        })
      );
      
      // Trier les notifications par date (les plus récentes en premier)
      const sortedNotifications = notificationsData.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      
      setNotifications(sortedNotifications);
    } catch (error) {
      console.error('Erreur lors de la récupération des notifications:', error);
      // Ne pas afficher de popup pour cette erreur
    }
  };

  // Fonction pour formater date et heure (toujours afficher les deux)
  const formatDateTime = (date: Date) => {
    if (!date || date.getTime() === 0) return '-';
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Fonction pour récupérer les dernières inscriptions et connexions
  const fetchActivityData = async () => {
    setActivityLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const structureMap = new Map(structures.map(s => [s.id, s.nom || s.ecole || 'N/A']));

      // Dernières inscriptions (createdAt)
      const signupsQuery = query(
        usersRef,
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const signupsSnapshot = await getDocs(signupsQuery);
      const signupsRaw = signupsSnapshot.docs
        .filter(d => {
          const data = d.data();
          return data.role !== 'superadmin' && data.status !== 'superadmin';
        })
        .map(docSnap => {
          const data = docSnap.data();
          const createdAt = toDateFromFirestore(data.createdAt);
          return {
            id: docSnap.id,
            email: data.email || '',
            displayName: data.displayName || data.email || 'N/A',
            firstName: data.firstName,
            lastName: data.lastName,
            ecole: data.ecole,
            structureId: data.structureId,
            status: data.status || '',
            createdAt
          };
        });
      const signupsDecrypted = await decryptActivityUsersList(
        signupsRaw,
        (u) => structureMap.get(u.structureId) || ''
      );
      signupsDecrypted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setRecentSignups(signupsDecrypted);

      // Dernières connexions (lastActivity ou lastLogin)
      const loginsQuery = query(
        usersRef,
        orderBy('lastActivity', 'desc'),
        limit(50)
      );
      const loginsSnapshot = await getDocs(loginsQuery);
      const loginsRaw = loginsSnapshot.docs
        .filter(d => {
          const data = d.data();
          return (data.role !== 'superadmin' && data.status !== 'superadmin') && (data.lastActivity || data.lastLogin);
        })
        .map(docSnap => {
          const data = docSnap.data();
          const ts = data.lastActivity || data.lastLogin;
          const lastActivity = toDateFromFirestore(ts);
          return {
            id: docSnap.id,
            email: data.email || '',
            displayName: data.displayName || data.email || 'N/A',
            firstName: data.firstName,
            lastName: data.lastName,
            ecole: data.ecole,
            structureId: data.structureId,
            status: data.status || '',
            lastActivity
          };
        });
      const loginsDecrypted = await decryptActivityUsersList(
        loginsRaw,
        (u) => structureMap.get(u.structureId) || ''
      );
      loginsDecrypted.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
      setRecentLogins(loginsDecrypted);
    } catch (error) {
      console.error('Erreur lors de la récupération des activités:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la récupération des connexions et inscriptions' });
      setOpen(true);
    } finally {
      setActivityLoading(false);
    }
  };

  const handleDeleteStructure = async (structureId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette structure ?')) {
      try {
        await deleteStructure(structureId);
        await fetchStructures(); // Recharger la liste
        setMessage({ type: 'success', text: 'Structure supprimée avec succès' });
        setOpen(true);
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        setMessage({ 
          type: 'error', 
          text: 'Erreur lors de la suppression de la structure' 
        });
        setOpen(true);
      }
    }
  };

  const handleSeedTestData = async (structure: StructureData) => {
    const isJE = structure.structureType === 'junior';
    const missionsLabel = isJE ? 'études' : 'missions';
    if (!window.confirm(`Générer des données de test (entreprises, contacts, ${missionsLabel}, candidatures) pour cette structure ?`)) return;
    setSeedLoading(structure.id);
    try {
      const functions = getFunctions();
      const seedTestDataFn = httpsCallable<{ structureId: string; structureType?: 'junior' | 'jobservice' }, {
        success: boolean;
        message: string;
        counts: {
          companies: number;
          contacts: number;
          students: number;
          missions: number;
          etudes: number;
          applications: number;
          notes: number;
          historyEntries: number;
        };
      }>(functions, 'seedTestData');
      const { data } = await seedTestDataFn({ structureId: structure.id, structureType: structure.structureType });
      const counts = data?.counts;
      const itemsCount = isJE ? (counts?.etudes ?? 0) : (counts?.missions ?? 0);
      setMessage({
        type: 'success',
        text: counts
          ? `Données de test créées : ${counts.companies} entreprises, ${counts.contacts} contacts, ${counts.students} étudiants, ${itemsCount} ${missionsLabel}, ${counts.applications ?? 0} candidatures, ${counts.notes ?? 0} notes, ${counts.historyEntries ?? 0} entrées d'historique.`
          : (data?.message || 'Données de test créées avec succès.')
      });
      setOpen(true);
    } catch (error: unknown) {
      const err = error as { message?: string };
      setMessage({ type: 'error', text: err?.message || 'Erreur lors de la génération des données de test.' });
      setOpen(true);
    } finally {
      setSeedLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (emailDomains.length === 0) {
        setMessage({ type: 'error', text: 'Ajoutez au moins un domaine email' });
        setOpen(true);
        return;
      }

      await createStructure({
        nom: formData.nom,
        ecole: formData.ecole,
        domaines: emailDomains,
        emailDomains: emailDomains
      });
      
      // Réinitialiser le formulaire
      setFormData({ nom: '', ecole: '', emailDomain: '' });
      setEmailDomains([]);
      setMessage({ type: 'success', text: 'Structure créée avec succès!' });
      setOpen(true);
      
      // Recharger la liste des structures
      await fetchStructures();
    } catch (error: any) {
      console.error('Erreur:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Erreur lors de la création de la structure'
      });
      setOpen(true);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleAddDomain = () => {
    if (formData.emailDomain) {
      // Ajouter @ si non présent
      const domain = formData.emailDomain.startsWith('@') 
        ? formData.emailDomain 
        : '@' + formData.emailDomain;
        
      if (!emailDomains.includes(domain)) {
        setEmailDomains([...emailDomains, domain]);
        setFormData({ ...formData, emailDomain: '' });
      }
    }
  };

  const handleRemoveDomain = (index: number) => {
    if (emailDomains) {
      setEmailDomains(emailDomains.filter((_, i) => i !== index));
    }
  };

  const handleStatusChange = async (reportId: string, event: SelectChangeEvent) => {
    const newStatus = event.target.value as ExtendedReport['status'];
    try {
      await updateReportStatus(reportId, newStatus);
      
      // Mettre à jour l'état local des rapports
      setReports(prevReports => 
        prevReports.map(report => 
          report.id === reportId 
            ? { ...report, status: newStatus } 
            : report
        )
      );

      // Créer une notification pour l'utilisateur
      const report = reports.find(r => r.id === reportId);
      if (report) {
        const { NotificationService } = await import('../services/notificationService');
        await NotificationService.sendToUser(
          report.userId,
          'report_update',
          'Mise à jour de votre rapport',
          `Le statut de votre ${report.type === 'bug' ? 'rapport d\'erreur' : 'idée'} a été mis à jour en "${newStatus}"`,
          'medium',
          { reportId }
        );
      }

      setMessage({ type: 'success', text: 'Statut du rapport mis à jour avec succès' });
      setOpen(true);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour du statut' });
      setOpen(true);
    }
  };

  const handleResponseSubmit = async (reportId: string, response: string) => {
    try {
      const reportRef = doc(db, 'reports', reportId);
      
      // Récupérer le rapport actuel pour obtenir les réponses existantes
      const reportDoc = await getDoc(reportRef);
      const reportData = reportDoc.data();
      
      // Créer un tableau de réponses ou utiliser celui existant
      const responses = reportData?.responses || [];
      
      // Ajouter la nouvelle réponse avec un horodatage côté client
      responses.push({
        text: response,
        timestamp: new Date().toISOString(), // Utiliser une chaîne ISO au lieu de serverTimestamp()
        author: currentUser?.email || 'Super Admin'
      });
      
      // Mettre à jour le document avec la nouvelle réponse
      await updateDoc(reportRef, {
        responses: responses,
        updatedAt: serverTimestamp()
      });

      // Mettre à jour l'état local
      setReports(prevReports =>
        prevReports.map(report =>
          report.id === reportId
            ? { 
                ...report, 
                responses: responses
              }
            : report
        )
      );

      // Créer une notification pour l'utilisateur
      const report = reports.find(r => r.id === reportId);
      if (report) {
        const { NotificationService } = await import('../services/notificationService');
        await NotificationService.sendToUser(
          report.userId,
          'report_response',
          'Nouvelle réponse à votre rapport',
          `Une réponse a été apportée à votre ${report.type === 'bug' ? 'rapport d\'erreur' : 'idée'}`,
          'medium',
          { reportId }
        );
      }

      // Réinitialiser le champ de réponse
      setShowResponseInput(prev => ({ ...prev, [reportId]: false }));
      
      setMessage({ type: 'success', text: 'Réponse enregistrée avec succès' });
      setOpen(true);
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la réponse:', error);
      setMessage({ type: 'error', text: 'Erreur lors de l\'enregistrement de la réponse' });
      setOpen(true);
    }
  };

  const handleAssignStructure = async (userId: string, structureId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        structureId: structureId || null // null si aucune structure sélectionnée
      });
      await fetchSuperAdmins();
      setMessage({ type: 'success', text: 'Structure assignée avec succès' });
      setOpen(true);
    } catch (error) {
      console.error('Erreur lors de l\'assignation de la structure:', error);
      setMessage({ type: 'error', text: 'Erreur lors de l\'assignation de la structure' });
      setOpen(true);
    }
  };

  // Fonction pour commencer l'édition d'une structure
  const handleStartEdit = (structure: StructureData) => {
    setEditingStructure(structure.id);
    setEditedData(structure);
  };

  // Fonction pour sauvegarder les modifications
  const handleSaveEdit = async (structureId: string) => {
    try {
      await updateDoc(doc(db, 'structures', structureId), {
        ...editedData,
        updatedAt: serverTimestamp()
      });
      
      setMessage({ type: 'success', text: 'Structure mise à jour avec succès' });
      setOpen(true);
      setEditingStructure(null);
      await fetchStructures();
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour de la structure' });
      setOpen(true);
    }
  };

  const handleViewUsers = async (structureId: string, ecole: string, structureName: string) => {
    try {
      // Récupérer les utilisateurs de la structure
      const usersRef = collection(db, 'users');
      const structureSnapshot = await getDocs(
        query(usersRef, where('structureId', '==', structureId))
      );
      const structureMembers = structureSnapshot.docs.map(doc => ({
        email: doc.data().email,
        role: doc.data().role || doc.data().status
      }));

      // Récupérer les étudiants de l'école
      const schoolSnapshot = await getDocs(
        query(usersRef, 
          where('ecole', '==', ecole),
          where('status', '==', 'etudiant')
        )
      );
      const students = schoolSnapshot.docs.map(doc => ({
        email: doc.data().email,
        status: doc.data().status
      }));

      setSelectedUsers({ structureMembers, students });
      setSelectedStructureName(structureName);
      setOpenDialog(true);
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la récupération des utilisateurs' });
      setOpen(true);
    }
  };

  // Ajouter le composant Dialog
  const UsersDialog = () => (
    <Dialog
      open={openDialog}
      onClose={() => setOpenDialog(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Utilisateurs de {selectedStructureName}
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="h6" gutterBottom>
          Membres de la structure ({selectedUsers.structureMembers.length})
        </Typography>
        <List dense>
          {selectedUsers.structureMembers.map((user, index) => (
            <ListItem key={index}>
              <ListItemText
                primary={user.email}
                secondary={`Rôle: ${user.role}`}
              />
            </ListItem>
          ))}
        </List>

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" gutterBottom>
          Étudiants de l'école ({selectedUsers.students.length})
        </Typography>
        <List dense>
          {selectedUsers.students.map((student, index) => (
            <ListItem key={index}>
              <ListItemText
                primary={student.email}
                secondary={`Status: ${student.status}`}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpenDialog(false)}>
          Fermer
        </Button>
      </DialogActions>
    </Dialog>
  );

  // Ajouter le composant Dialog pour l'image
  const ImageDialog = () => (
    <Dialog
      open={openImageDialog}
      onClose={() => setOpenImageDialog(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogContent>
        {selectedImage && (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <img 
              src={selectedImage} 
              alt="Capture d'écran du rapport" 
              style={{ maxWidth: '100%', maxHeight: '80vh' }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpenImageDialog(false)}>
          Fermer
        </Button>
      </DialogActions>
    </Dialog>
  );

  // Fonction pour récupérer tous les utilisateurs (Prénom/Nom décryptés)
  const fetchAllUsers = async () => {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const usersDataRaw = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          email: d.email || '',
          displayName: d.displayName || '',
          firstName: d.firstName,
          lastName: d.lastName
        };
      });
      const decrypted = await decryptUsersList(usersDataRaw);
      const usersData = decrypted.map(u => ({
        id: u.id,
        email: (usersDataRaw.find(r => r.id === u.id) as any)?.email || '',
        displayName: u.displayName || ''
      }));
      setUsers(usersData);
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la récupération des utilisateurs' });
      setOpen(true);
    }
  };

  // Fonction pour envoyer une notification
  const handleSendNotification = async () => {
    if (!notificationForm.title.trim() || !notificationForm.message.trim()) {
      setMessage({ type: 'error', text: 'Veuillez remplir tous les champs' });
      setOpen(true);
      return;
    }

    try {
      // Déterminer les utilisateurs destinataires selon le type de destinataire
      let userIds: string[] = [];

      if (notificationForm.recipientType === 'all') {
        setMessage({
          type: 'error',
          text: 'Envoi à tous les utilisateurs désactivé (performance). Choisissez une structure ou un utilisateur.',
        });
        setOpen(true);
        return;
      } else if (notificationForm.recipientType === 'structure') {
        // Récupérer les utilisateurs de la structure sélectionnée
        const usersSnapshot = await getDocs(
          query(collection(db, 'users'), where('structureId', '==', notificationForm.selectedStructureId))
        );
        userIds = usersSnapshot.docs.map(doc => doc.id);
      } else if (notificationForm.recipientType === 'user') {
        // Utilisateur spécifique
        userIds = [notificationForm.selectedUserId];
      }

      if (userIds.length === 0) {
        setMessage({ type: 'error', text: 'Aucun destinataire trouvé' });
        setOpen(true);
        return;
      }

      // Créer une notification pour chaque destinataire (via CF)
      const { NotificationService } = await import('../services/notificationService');
      await NotificationService.sendToUsers(
        userIds,
        'admin_notification',
        notificationForm.title,
        notificationForm.message,
        'medium',
        {
          recipientType: notificationForm.recipientType,
          structureId:
            notificationForm.recipientType === 'structure'
              ? notificationForm.selectedStructureId
              : undefined,
          recipientCount: userIds.length,
        },
        'admin'
      );

      // Réinitialiser le formulaire
      setNotificationForm({
        title: '',
        message: '',
        recipientType: 'all',
        selectedStructureId: '',
        selectedUserId: ''
      });

      setMessage({ type: 'success', text: 'Notification envoyée avec succès' });
      setOpen(true);
      setOpenNotificationDialog(false);
      
      // Rafraîchir la liste des notifications
      fetchNotifications();
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la notification:', error);
      setMessage({ type: 'error', text: 'Erreur lors de l\'envoi de la notification' });
      setOpen(true);
    }
  };

  // Fonction pour gérer les changements dans le formulaire de notification
  const handleNotificationFormChange = (field: string, value: string) => {
    setNotificationForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Fonction pour réinitialiser le formulaire de notification
  const resetNotificationForm = () => {
    setNotificationForm({
      title: '',
      message: '',
      recipientType: 'all',
      selectedStructureId: '',
      selectedUserId: ''
    });
  };

  // Fonction pour gérer la fermeture de la popup de notification
  const handleCloseNotificationDialog = () => {
    setOpenNotificationDialog(false);
    resetNotificationForm();
  };

  // Fonctions pour la migration du chiffrement
  const checkMigrationStatus = async () => {
    setCheckingStatus(true);
    setMigrationError(null);
    
    try {
      const functions = getFunctions();
      const checkStatus = httpsCallable(functions, 'checkMigrationStatus');
      
      const [usersStatus, companiesStatus, contactsStatus, prospectsStatus] = await Promise.all([
        checkStatus({ collectionName: 'users' }),
        checkStatus({ collectionName: 'companies' }),
        checkStatus({ collectionName: 'contacts' }),
        checkStatus({ collectionName: 'prospects' })
      ]);
      
      setMigrationStatus({
        users: usersStatus.data,
        companies: companiesStatus.data,
        contacts: contactsStatus.data,
        prospects: prospectsStatus.data
      });
    } catch (err: any) {
      setMigrationError(err.message || 'Erreur lors de la vérification du statut');
      console.error('Erreur checkMigrationStatus:', err);
    } finally {
      setCheckingStatus(false);
    }
  };

  const startMigration = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir lancer la migration ? Cette opération peut prendre plusieurs minutes.')) {
      return;
    }

    setMigrationLoading(true);
    setMigrationError(null);
    
    try {
      const functions = getFunctions();
      const migrateAllEncryption = httpsCallable(functions, 'migrateAllEncryption');
      
      const result = await migrateAllEncryption({});
      
      const stats = result.data.stats;
      const message = `Migration terminée !\n\n` +
        `Total documents traités: ${stats.total}\n` +
        `Documents chiffrés: ${stats.encrypted}\n` +
        `Documents ignorés (déjà chiffrés): ${stats.skipped}\n` +
        `Erreurs: ${stats.errors}\n\n` +
        `Collections:\n` +
        Object.entries(stats.collections).map(([name, coll]: [string, any]) => 
          `- ${name}: ${coll.encrypted} chiffrés, ${coll.skipped} ignorés, ${coll.errors} erreurs`
        ).join('\n');
      
      alert(message);
      
      // Vérifier le statut après migration
      await checkMigrationStatus();
      
      setMessage({ type: 'success', text: 'Migration terminée avec succès' });
      setOpen(true);
    } catch (err: any) {
      const errorMsg = err.message || 'Erreur lors de la migration';
      setMigrationError(errorMsg);
      setMessage({ type: 'error', text: errorMsg });
      setOpen(true);
      console.error('Erreur migrateAllEncryption:', err);
    } finally {
      setMigrationLoading(false);
    }
  };

  // Fonctions pour la migration member -> membre
  const checkMemberMigrationStatus = async () => {
    setMemberMigrationError(null);
    
    try {
      // Compter tous les utilisateurs avec status = 'member'
      const usersRef = collection(db, 'users');
      const memberQuery = query(usersRef, where('status', '==', 'member'));
      const memberSnapshot = await getDocs(memberQuery);
      
      // Compter tous les utilisateurs
      const allUsersSnapshot = await getDocs(usersRef);
      
      setMemberMigrationStats({
        totalUsers: allUsersSnapshot.docs.length,
        usersToMigrate: memberSnapshot.docs.length,
        usersMigrated: 0
      });
    } catch (err: any) {
      setMemberMigrationError(err.message || 'Erreur lors de la vérification du statut');
      console.error('Erreur checkMemberMigrationStatus:', err);
    }
  };

  const startMemberMigration = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir migrer tous les utilisateurs avec status "member" vers "membre" ? Cette opération est irréversible.')) {
      return;
    }

    setMemberMigrationLoading(true);
    setMemberMigrationError(null);
    
    try {
      // Récupérer tous les utilisateurs avec status = 'member'
      const usersRef = collection(db, 'users');
      const memberQuery = query(usersRef, where('status', '==', 'member'));
      const memberSnapshot = await getDocs(memberQuery);
      
      let migratedCount = 0;
      const totalToMigrate = memberSnapshot.docs.length;
      
      // Mettre à jour chaque utilisateur
      for (const userDoc of memberSnapshot.docs) {
        try {
          await updateDoc(doc(db, 'users', userDoc.id), {
            status: 'membre'
          });
          migratedCount++;
          
          // Mettre à jour les stats en temps réel
          setMemberMigrationStats(prev => prev ? {
            ...prev,
            usersMigrated: migratedCount
          } : null);
        } catch (error) {
          console.error(`Erreur lors de la migration de l'utilisateur ${userDoc.id}:`, error);
        }
      }
      
      const message = `Migration terminée !\n\n` +
        `${migratedCount}/${totalToMigrate} utilisateurs migrés de "member" vers "membre"`;
      
      alert(message);
      
      // Vérifier le statut après migration
      await checkMemberMigrationStatus();
      
      setMessage({ type: 'success', text: 'Migration des statuts terminée avec succès' });
      setOpen(true);
    } catch (err: any) {
      const errorMsg = err.message || 'Erreur lors de la migration';
      setMemberMigrationError(errorMsg);
      setMessage({ type: 'error', text: errorMsg });
      setOpen(true);
      console.error('Erreur startMemberMigration:', err);
    } finally {
      setMemberMigrationLoading(false);
    }
  };

  // Charger les utilisateurs au montage du composant
  useEffect(() => {
    if (tabValue === 3) { // Onglet Notifications
      fetchAllUsers();
    }
  }, [tabValue]);

  // Charger les connexions et inscriptions quand l'onglet est sélectionné
  useEffect(() => {
    if (tabValue === 4 && structures.length >= 0) { // Onglet Connexions & Inscriptions
      fetchActivityData();
    }
  }, [tabValue, structures.length]);

  // Recherche utilisateurs (lien connexion) — uniquement à la saisie, debounce 450 ms
  useEffect(() => {
    if (tabValue !== 4) return;
    const q = loginLinkSearchQuery.trim();
    if (q.length < 2) {
      setLoginLinkUsers([]);
      setLoginLinkHasSearched(false);
      setSelectedLoginLinkUserId(null);
      return;
    }
    const timer = window.setTimeout(() => {
      void searchLoginLinkUsers(q);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [loginLinkSearchQuery, tabValue]);

  // Charger les prospects et contacts du démarchage quand l'onglet est sélectionné
  const fetchDemarchageProspects = async () => {
    setDemarchageLoading(true);
    try {
      const prospectsRef = collection(db, 'superadmin_prospects');
      const snapshot = await getDocs(query(prospectsRef, orderBy('createdAt', 'desc')));
      const prospects: DemarchageProspect[] = snapshot.docs.map(d => ({
        id: d.id,
        type: (d.data().type as 'je' | 'js') || 'je',
        name: d.data().name || '',
        school: d.data().school,
        createdAt: d.data().createdAt
      }));
      setDemarchageProspects(prospects);

      const contactsByProspect: Record<string, DemarchageContact[]> = {};
      await Promise.all(
        prospects.map(async (p) => {
          const contactsRef = collection(db, 'superadmin_prospects', p.id, 'contacts');
          const contactsSnap = await getDocs(contactsRef);
          contactsByProspect[p.id] = contactsSnap.docs.map(c => ({
            id: c.id,
            firstName: c.data().firstName || '',
            lastName: c.data().lastName || '',
            position: c.data().position || '',
            email: c.data().email || '',
            lastEmailSentAt: c.data().lastEmailSentAt ?? null
          }));
        })
      );
      setDemarchageContactsByProspect(contactsByProspect);
    } catch (err) {
      console.error('Erreur chargement prospects démarchage:', err);
      setMessage({ type: 'error', text: 'Erreur lors du chargement des prospects' });
      setOpen(true);
    } finally {
      setDemarchageLoading(false);
    }
  };

  useEffect(() => {
    if (tabValue === 6) {
      fetchDemarchageProspects();
    }
  }, [tabValue]);

  const handleCreateDemarchageProspect = async () => {
    if (!newProspectForm.name.trim()) {
      setMessage({ type: 'error', text: 'Le nom est requis' });
      setOpen(true);
      return;
    }
    try {
      const ref = await addDoc(collection(db, 'superadmin_prospects'), {
        type: newProspectForm.type,
        name: newProspectForm.name.trim(),
        school: newProspectForm.school.trim() || null,
        createdAt: serverTimestamp()
      });
      setNewProspectForm({ type: 'je', name: '', school: '' });
      await fetchDemarchageProspects();
      setMessage({ type: 'success', text: newProspectForm.type === 'je' ? 'Junior Entreprise créée' : 'Job Service créé' });
      setOpen(true);
    } catch (err) {
      console.error('Erreur création prospect:', err);
      setMessage({ type: 'error', text: 'Erreur lors de la création' });
      setOpen(true);
    }
  };

  const handleAddDemarchageContact = async () => {
    if (!newContactForm || !newContactForm.email.trim()) {
      setMessage({ type: 'error', text: 'L\'email est requis' });
      setOpen(true);
      return;
    }
    try {
      await addDoc(
        collection(db, 'superadmin_prospects', newContactForm.prospectId, 'contacts'),
        {
          firstName: newContactForm.firstName.trim(),
          lastName: newContactForm.lastName.trim(),
          position: newContactForm.position.trim(),
          email: newContactForm.email.trim()
        }
      );
      setNewContactForm(null);
      await fetchDemarchageProspects();
      setMessage({ type: 'success', text: 'Contact ajouté' });
      setOpen(true);
    } catch (err) {
      console.error('Erreur ajout contact:', err);
      setMessage({ type: 'error', text: 'Erreur lors de l\'ajout du contact' });
      setOpen(true);
    }
  };

  const handleDeleteDemarchageContact = async (prospectId: string, contactId: string) => {
    if (!window.confirm('Supprimer ce contact ?')) return;
    try {
      await deleteDoc(doc(db, 'superadmin_prospects', prospectId, 'contacts', contactId));
      await fetchDemarchageProspects();
      setMessage({ type: 'success', text: 'Contact supprimé' });
      setOpen(true);
    } catch (err) {
      console.error('Erreur suppression contact:', err);
      setMessage({ type: 'error', text: 'Erreur lors de la suppression du contact' });
      setOpen(true);
    }
  };

  const handleDeleteDemarchageProspect = async (prospectId: string) => {
    if (!window.confirm('Supprimer cette JE/JS et tous ses contacts ?')) return;
    try {
      const contactsRef = collection(db, 'superadmin_prospects', prospectId, 'contacts');
      const contactsSnap = await getDocs(contactsRef);
      await Promise.all(contactsSnap.docs.map((d) => deleteDoc(doc(db, 'superadmin_prospects', prospectId, 'contacts', d.id))));
      await deleteDoc(doc(db, 'superadmin_prospects', prospectId));
      await fetchDemarchageProspects();
      setDemarchageExpanded((id) => (id === prospectId ? null : id));
      setMessage({ type: 'success', text: 'Prospect supprimé' });
      setOpen(true);
    } catch (err) {
      console.error('Erreur suppression prospect:', err);
      setMessage({ type: 'error', text: 'Erreur lors de la suppression du prospect' });
      setOpen(true);
    }
  };

  const handleSendDemarchageEmail = async (prospect: DemarchageProspect, contact: DemarchageContact) => {
    setSendingEmailContactId(contact.id);
    try {
      const result = await sendDemarchageEmailClient({
        to_email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        position: contact.position,
        prospectName: prospect.name,
      });
      if (result.ok) {
        const contactRef = doc(db, 'superadmin_prospects', prospect.id, 'contacts', contact.id);
        await updateDoc(contactRef, { lastEmailSentAt: serverTimestamp() });
        setDemarchageContactsByProspect(prev => {
          const list = prev[prospect.id] ?? [];
          return {
            ...prev,
            [prospect.id]: list.map(c =>
              c.id === contact.id ? { ...c, lastEmailSentAt: { toDate: () => new Date() } } : c
            )
          };
        });
        setMessage({ type: 'success', text: `Email envoyé à ${contact.email}` });
        setOpen(true);
      } else {
        setMessage({ type: 'error', text: result.error || 'Erreur lors de l\'envoi de l\'email' });
        setOpen(true);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Erreur lors de l\'envoi de l\'email' });
      setOpen(true);
    } finally {
      setSendingEmailContactId(null);
    }
  };

  // Créer l'utilisateur côté serveur pour garder la session superadmin (aucune redirection vers le nouveau compte)
  const handleAddUserToStructure = async (userData: any) => {
    if (!selectedStructureForUser) return;
    if (!userData.password || userData.password.length < 8) {
      setMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 8 caractères.' });
      setOpen(true);
      return;
    }

    try {
      const functions = getFunctions();
      const createStructureUserFn = httpsCallable<
        { email: string; tempPassword: string; structureId: string; [key: string]: unknown },
        { data?: { uid: string } }
      >(functions, 'createStructureUser');

      await createStructureUserFn({
        email: userData.email,
        tempPassword: userData.password,
        structureId: selectedStructureForUser.id,
        displayName: userData.displayName,
        firstName: userData.firstName,
        lastName: userData.lastName,
        status: userData.status,
        birthDate: userData.birthDate,
        graduationYear: userData.graduationYear,
        program: userData.program,
        ecole: userData.ecole
      });

      setMessage({
        type: 'success',
        text: 'Compte créé. L\'utilisateur peut se connecter avec cet email et le mot de passe défini.'
      });
      setOpen(true);

      if (selectedStructureForUser) {
        handleViewUsers(selectedStructureForUser.id, '', selectedStructureForUser.name);
      }
    } catch (error: any) {
      console.error('Erreur lors de la création de l\'utilisateur:', error);
      let errorMessage = error?.message ?? 'Erreur lors de la création de l\'utilisateur';
      if (error?.code === 'functions/invalid-argument' || error?.details?.code === 'invalid-argument') {
        errorMessage = error?.message || errorMessage;
      }
      setMessage({ type: 'error', text: errorMessage });
      setOpen(true);
    }
  };

  return (
    <Box sx={{ p: 3, bgcolor: tokens.colors.appBg, minHeight: '100vh' }}>
      <Typography sx={{ ...tokens.typography.pageTitle, color: tokens.colors.gray900, mb: 2 }}>
        Super Admin
      </Typography>
      <Tabs 
        value={tabValue} 
        onChange={(e, newValue) => setTabValue(newValue)}
        sx={{
          bgcolor: tokens.colors.bgPaper,
          borderRadius: tokens.radius.lg,
          border: `1px solid ${tokens.colors.divider}`,
          px: 1,
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 500 },
          '& .Mui-selected': { color: tokens.colors.brandTeal },
          '& .MuiTabs-indicator': { bgcolor: tokens.colors.brandTeal },
        }}
      >
        {tabs.map((tab, index) => (
          <Tab key={tab} label={tab} />
        ))}
      </Tabs>

      {tabValue === 0 ? (
        <>
          <Paper sx={{ p: 3, mt: 3, mb: 3, borderRadius: tokens.radius.lg, boxShadow: tokens.shadows.md, border: `1px solid ${tokens.colors.divider}` }}>
            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Nom de la structure"
                    name="nom"
                    value={formData.nom}
                    onChange={handleChange}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="École"
                    name="ecole"
                    value={formData.ecole}
                    onChange={handleChange}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField
                      label="Domaine email"
                      name="emailDomain"
                      value={formData.emailDomain}
                      onChange={handleChange}
                      placeholder="exemple.fr"
                    />
                    <Button 
                      variant="contained" 
                      onClick={handleAddDomain}
                      disabled={!formData.emailDomain}
                    >
                      Ajouter domaine
                    </Button>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {emailDomains.map((domain, index) => (
                      <Chip
                        key={index}
                        label={domain}
                        onDelete={() => handleRemoveDomain(index)}
                      />
                    ))}
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={!formData.nom || !formData.ecole || emailDomains.length === 0}
                  >
                    Créer la structure
                  </Button>
                </Grid>
              </Grid>
            </form>
          </Paper>

          <Paper sx={{ p: 3, mt: 3, borderRadius: tokens.radius.lg, boxShadow: tokens.shadows.md, border: `1px solid ${tokens.colors.divider}` }}>
            <Typography variant="h6" gutterBottom>
              Structures existantes
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: tokens.colors.gray50 }}>
                    <TableCell sx={{ fontWeight: 600, color: tokens.colors.textSecondary, fontSize: '0.75rem' }}>Nom</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: tokens.colors.textSecondary, fontSize: '0.75rem' }}>École</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: tokens.colors.textSecondary, fontSize: '0.75rem' }}>Domaines emails</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: tokens.colors.textSecondary, fontSize: '0.75rem' }}>Abonnement</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: tokens.colors.textSecondary, fontSize: '0.75rem' }}>Date de création</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: tokens.colors.textSecondary, fontSize: '0.75rem' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {structures.map((structure) => (
                    <TableRow key={structure.id}>
                      <TableCell>
                        {editingStructure === structure.id ? (
                          <TextField
                            fullWidth
                            size="small"
                            value={editedData.nom || ''}
                            onChange={(e) => setEditedData({
                              ...editedData,
                              nom: e.target.value
                            })}
                          />
                        ) : (
                          structure.nom
                        )}
                      </TableCell>
                      <TableCell>
                        {editingStructure === structure.id ? (
                          <TextField
                            fullWidth
                            size="small"
                            value={editedData.ecole || ''}
                            onChange={(e) => setEditedData({
                              ...editedData,
                              ecole: e.target.value
                            })}
                          />
                        ) : (
                          structure.ecole
                        )}
                      </TableCell>
                      <TableCell>
                        {editingStructure === structure.id ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {(editedData.domaines || []).map((domain, index) => (
                              <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <TextField
                                  size="small"
                                  value={domain}
                                  onChange={(e) => {
                                    const newDomains = [...(editedData.domaines || [])];
                                    newDomains[index] = e.target.value;
                                    setEditedData({
                                      ...editedData,
                                      domaines: newDomains
                                    });
                                  }}
                                />
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    const newDomains = (editedData.domaines || []).filter((_, i) => i !== index);
                                    setEditedData({
                                      ...editedData,
                                      domaines: newDomains
                                    });
                                  }}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Box>
                            ))}
                            <Button
                              size="small"
                              onClick={() => setEditedData({
                                ...editedData,
                                domaines: [...(editedData.domaines || []), '']
                              })}
                            >
                              Ajouter un domaine
                            </Button>
                          </Box>
                        ) : (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(Array.isArray(structure.domaines) ? structure.domaines : []).map((domain: string, index: number) => (
                              <Chip key={index} label={typeof domain === 'string' ? domain : String(domain)} size="small" onDelete={() => handleRemoveDomain(index)} />
                            ))}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const structureEmail = structure.email?.trim();
                          const stripeInfo = structureEmail ? stripeCustomersByEmail[structureEmail.toLowerCase()] : null;
                          const status = stripeInfo?.subscriptionStatus ?? structure.subscriptionStatus;
                          if (loadingStripeCustomers && !status) return <Typography variant="body2" color="text.secondary">Chargement…</Typography>;
                          if (!status) return '—';
                          const label = status === 'active' ? 'Actif' : status === 'trialing' ? 'Essai' : status === 'canceled' ? 'Annulé' : status === 'past_due' ? 'Impayé' : status === 'incomplete' ? 'Incomplet' : status;
                          const color = status === 'active' || status === 'trialing' ? 'success' : status === 'canceled' || status === 'unpaid' ? 'error' : status === 'past_due' || status === 'incomplete' ? 'warning' : 'default';
                          return (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                              <Chip size="small" label={label} color={color as 'success' | 'error' | 'warning' | 'default'} variant="outlined" />
                              {stripeInfo?.cancelAtPeriodEnd && (
                                <Chip size="small" label="Annulation prévue" color="warning" variant="outlined" />
                              )}
                            </Box>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {new Date(structure.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }} component="span">
                          {editingStructure === structure.id ? (
                            <>
                              <IconButton
                                color="primary"
                                onClick={() => handleSaveEdit(structure.id)}
                              >
                                <SaveIcon />
                              </IconButton>
                              <IconButton
                                color="error"
                                onClick={() => setEditingStructure(null)}
                              >
                                <CancelIcon />
                              </IconButton>
                            </>
                          ) : (
                            <>
                              <IconButton
                                color="primary"
                                onClick={() => handleStartEdit(structure)}
                              >
                                <EditIcon />
                              </IconButton>
                              <IconButton
                                color="error"
                                onClick={() => handleDeleteStructure(structure.id)}
                              >
                                <DeleteIcon />
                              </IconButton>
                              <IconButton
                                color="primary"
                                onClick={() => handleViewUsers(structure.id, structure.ecole, structure.nom)}
                              >
                                <VisibilityIcon />
                              </IconButton>
                              <Tooltip title="Ajouter un utilisateur">
                                <IconButton
                                  color="primary"
                                  onClick={() => {
                                    setSelectedStructureForUser({ id: structure.id, name: structure.nom });
                                    setOpenAddUserDialog(true);
                                  }}
                                >
                                  <PersonAddIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={structure.structureType === 'junior' ? 'Générer des données de test (entreprises, contacts, études, candidatures)' : 'Générer des données de test (entreprises, contacts, missions, candidatures)'}>
                                <span style={{ display: 'inline-flex' }}>
                                  <IconButton
                                    color="secondary"
                                    onClick={() => handleSeedTestData(structure)}
                                    disabled={seedLoading === structure.id}
                                  >
                                    {seedLoading === structure.id ? (
                                      <CircularProgress size={24} color="secondary" />
                                    ) : (
                                      <ScienceIcon />
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      ) : tabValue === 1 ? (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h5" gutterBottom>
            Rapports et Suggestions
          </Typography>
          
          {/* Ajout du filtre de statut */}
          <Box sx={{ mb: 3 }}>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Filtrer par statut</InputLabel>
              <Select
                value={reportStatusFilter}
                onChange={(e) => setReportStatusFilter(e.target.value)}
                label="Filtrer par statut"
              >
                <MenuItem value="all">Tous les statuts</MenuItem>
                <MenuItem value="pending">En attente</MenuItem>
                <MenuItem value="in_progress">En cours</MenuItem>
                <MenuItem value="completed">Terminé</MenuItem>
                <MenuItem value="rejected">Rejeté</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Contenu</TableCell>
                  <TableCell>Image</TableCell>
                  <TableCell>Utilisateur</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reports
                  .filter(report => reportStatusFilter === 'all' || report.status === reportStatusFilter)
                  .map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      {report.type === 'bug' ? 'Erreur' : 'Idée'}
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">{report.content}</Typography>
                        {report.responses && report.responses.length > 0 && (
                          <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                            <Typography variant="subtitle2" color="primary">Discussion:</Typography>
                            {report.responses.map((resp, idx) => (
                              <Box key={idx} sx={{ mt: 1, p: 1, bgcolor: 'white', borderRadius: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {resp.author} - {resp.timestamp ? new Date(resp.timestamp).toLocaleString() : 'Date inconnue'}
                                </Typography>
                                <Typography variant="body2">{resp.text}</Typography>
                              </Box>
                            ))}
                          </Box>
                        )}
                        {!showResponseInput[report.id] ? (
                          <Button
                            size="small"
                            startIcon={<ReplyIcon />}
                            onClick={() => setShowResponseInput(prev => ({ ...prev, [report.id]: true }))}
                            sx={{ mt: 1 }}
                          >
                            Répondre
                          </Button>
                        ) : (
                          <Box sx={{ mt: 1 }}>
                            <TextField
                              fullWidth
                              multiline
                              rows={2}
                              placeholder="Ajouter une réponse..."
                              variant="outlined"
                              size="small"
                              onChange={(e) => {
                                const newReports = [...reports];
                                const index = newReports.findIndex(r => r.id === report.id);
                                if (index !== -1) {
                                  newReports[index] = { ...newReports[index], response: e.target.value };
                                  setReports(newReports);
                                }
                              }}
                            />
                            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleResponseSubmit(report.id, report.response || '')}
                              >
                                Envoyer
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => setShowResponseInput(prev => ({ ...prev, [report.id]: false }))}
                              >
                                Annuler
                              </Button>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {report.imageUrl && (
                        <Box 
                          sx={{ 
                            cursor: 'pointer',
                            '&:hover': { opacity: 0.8 }
                          }}
                          onClick={() => {
                            setSelectedImage(report.imageUrl);
                            setOpenImageDialog(true);
                          }}
                        >
                          <img 
                            src={report.imageUrl} 
                            alt="Capture d'écran" 
                            style={{ 
                              maxWidth: '100px', 
                              maxHeight: '100px',
                              objectFit: 'cover',
                              borderRadius: '4px'
                            }} 
                          />
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>{report.userEmail}</TableCell>
                    <TableCell>
                      {report.createdAt instanceof Date 
                        ? report.createdAt.toLocaleDateString()
                        : new Date(report.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={report.status}
                        color={
                          report.status === 'completed' ? 'success' :
                          report.status === 'in_progress' ? 'warning' :
                          report.status === 'rejected' ? 'error' : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={report.status}
                        onChange={(e) => handleStatusChange(report.id, e)}
                        size="small"
                      >
                        <MenuItem value="pending">En attente</MenuItem>
                        <MenuItem value="in_progress">En cours</MenuItem>
                        <MenuItem value="completed">Terminé</MenuItem>
                        <MenuItem value="rejected">Rejeté</MenuItem>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : tabValue === 2 ? (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h5" gutterBottom>
            Gestion des Super Admins
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Structure</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {superAdmins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell>{admin.email}</TableCell>
                    <TableCell>
                      <FormControl fullWidth size="small">
                        <InputLabel>Structure</InputLabel>
                        <Select
                          value={admin.structureId || ''}
                          onChange={(e) => handleAssignStructure(admin.id, e.target.value)}
                          label="Structure"
                        >
                          <MenuItem value="">
                            <em>Aucune</em>
                          </MenuItem>
                          {structures.map((structure) => (
                            <MenuItem key={structure.id} value={structure.id}>
                              {structure.nom} ({structure.ecole})
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : tabValue === 3 ? (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" gutterBottom>
              Gestion des notifications
            </Typography>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<NotificationsIcon />}
              onClick={() => setOpenNotificationDialog(true)}
            >
              Nouvelle notification
            </Button>
          </Box>
          
          <Typography variant="body1" paragraph>
            Envoyez des notifications à tous les utilisateurs, à une structure spécifique ou à un utilisateur individuel.
            Les notifications apparaîtront dans la barre de navigation des destinataires.
          </Typography>
          
          <NotificationFormDialog 
            open={openNotificationDialog}
            onClose={handleCloseNotificationDialog}
            formData={notificationForm}
            onFormChange={handleNotificationFormChange}
            onSend={handleSendNotification}
            structures={structures}
            users={users}
          />
          
          {/* Affichage des notifications envoyées */}
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Notifications envoyées
            </Typography>
            
            {notifications.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Aucune notification envoyée
              </Typography>
            ) : (
              <TableContainer component={Paper} sx={{ mt: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Titre</TableCell>
                      <TableCell>Message</TableCell>
                      <TableCell>Date d'envoi</TableCell>
                      <TableCell>Destinataires</TableCell>
                      <TableCell>Statut de lecture</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {notifications.map((notification) => (
                      <TableRow key={notification.id}>
                        <TableCell>{notification.title}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {notification.message}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {notification.createdAt?.toDate?.() 
                            ? notification.createdAt.toDate().toLocaleString() 
                            : 'Date inconnue'}
                        </TableCell>
                        <TableCell>{notification.recipientCount}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="body2">
                              {notification.readBy.length} / {notification.recipientCount} lus
                            </Typography>
                            {notification.readBy.length > 0 && (
                              <Tooltip title={
                                <Box>
                                  {notification.readBy.map((reader, index) => (
                                    <Typography key={index} variant="body2">
                                      {reader.userName} - {reader.readAt?.toDate?.() 
                                        ? reader.readAt.toDate().toLocaleString() 
                                        : 'Date inconnue'}
                                    </Typography>
                                  ))}
                                </Box>
                              }>
                                <Button size="small" sx={{ mt: 1 }}>
                                  Voir les détails
                                </Button>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Paper>
      ) : tabValue === 4 ? (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
            Connexions & Inscriptions
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Vue d'ensemble des dernières connexions et inscriptions, toutes structures confondues.
          </Typography>

          <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'action.hover' }}>
            <Typography variant="h6" gutterBottom>
              Diagnostic permissions — lien de connexion
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Recherchez un utilisateur par <strong>email</strong> (ou UID), sélectionnez-le puis générez un lien de
              connexion <strong>réel</strong>. Le lien expire en environ 1&nbsp;h — préférez un onglet privé.
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Cible du lien
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Radio
                    size="small"
                    checked={loginLinkBaseUrl === productionAppOrigin}
                    onChange={() => setLoginLinkBaseUrl(productionAppOrigin)}
                  />
                  <Typography variant="body2">
                    Production — <strong>{productionAppOrigin}</strong>
                  </Typography>
                </Box>
                {isLocalDevHost && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Radio
                      size="small"
                      checked={loginLinkBaseUrl === window.location.origin}
                      onChange={() => setLoginLinkBaseUrl(window.location.origin)}
                    />
                    <Typography variant="body2">
                      Local — <strong>{window.location.origin}</strong>
                    </Typography>
                  </Box>
                )}
              </Box>
              {!isLocalDevHost && (
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
                  Pour un lien local, ouvrez Super Admin depuis{' '}
                  <strong>http://localhost:&lt;port&gt;</strong> (ex. 3008, 3011).
                </Typography>
              )}
            </Box>

            <TextField
              size="small"
              label="Rechercher par email ou UID"
              placeholder="ex. jean.dupont@… ou identifiant Firebase"
              value={loginLinkSearchQuery}
              onChange={(e) => setLoginLinkSearchQuery(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
            />

            {loginLinkUsersLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <TableContainer sx={{ maxHeight: 360, mb: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" />
                      <TableCell>Utilisateur</TableCell>
                      <TableCell>Structure</TableCell>
                      <TableCell>Rôle</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!loginLinkHasSearched ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                          Saisissez au moins 2 caractères pour lancer la recherche
                        </TableCell>
                      </TableRow>
                    ) : loginLinkUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                          Aucun utilisateur trouvé
                        </TableCell>
                      </TableRow>
                    ) : (
                      loginLinkUsers.map((user) => (
                        <TableRow
                          key={user.id}
                          hover
                          selected={selectedLoginLinkUserId === user.id}
                          onClick={() => setSelectedLoginLinkUserId(user.id)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell padding="checkbox">
                            <Radio
                              checked={selectedLoginLinkUserId === user.id}
                              onChange={() => setSelectedLoginLinkUserId(user.id)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {user.displayName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {user.email}
                            </Typography>
                          </TableCell>
                          <TableCell>{user.structureName}</TableCell>
                          <TableCell>
                            <Chip label={user.status || '—'} size="small" variant="outlined" />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                {loginLinkHasSearched
                  ? `${loginLinkUsers.length} résultat${loginLinkUsers.length > 1 ? 's' : ''} (max. 25)`
                  : 'Aucune recherche en cours'}
              </Typography>
              <Button
                variant="contained"
                startIcon={
                  generatingLinkFor === 'selected' ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <LinkIcon />
                  )
                }
                disabled={!selectedLoginLinkUserId || generatingLinkFor === 'selected'}
                onClick={() => {
                  const user = loginLinkUsers.find((u) => u.id === selectedLoginLinkUserId);
                  if (!user) return;
                  void handleGenerateLoginLink({
                    userId: user.id,
                    displayName: user.displayName,
                  });
                }}
              >
                Générer le lien
              </Button>
            </Box>
          </Paper>

          {activityLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <HowToRegIcon color="primary" />
                  <Typography variant="h6">Dernières inscriptions</Typography>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Utilisateur</TableCell>
                        <TableCell>Structure</TableCell>
                        <TableCell>Date et heure d'inscription</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentSignups.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                            Aucune inscription récente
                          </TableCell>
                        </TableRow>
                      ) : (
                        recentSignups.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">{user.displayName}</Typography>
                              <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                            </TableCell>
                            <TableCell>{user.structureName}</TableCell>
                            <TableCell>
                              {formatDateTime(user.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <LoginIcon color="primary" />
                  <Typography variant="h6">Dernières connexions</Typography>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Utilisateur</TableCell>
                        <TableCell>Structure</TableCell>
                        <TableCell>Date et heure de dernière connexion</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentLogins.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                            Aucune connexion récente
                          </TableCell>
                        </TableRow>
                      ) : (
                        recentLogins.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">{user.displayName}</Typography>
                              <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                            </TableCell>
                            <TableCell>{user.structureName}</TableCell>
                            <TableCell>
                              {formatDateTime(user.lastActivity)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          )}
          {!activityLoading && (recentSignups.length > 0 || recentLogins.length > 0) && (
            <Box sx={{ mt: 2 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={fetchActivityData}
              >
                Actualiser
              </Button>
            </Box>
          )}

          <Dialog
            open={loginLinkDialog.open}
            onClose={() => setLoginLinkDialog((d) => ({ ...d, open: false }))}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>Lien de connexion — {loginLinkDialog.displayName}</DialogTitle>
            <DialogContent>
              <Alert severity="info" sx={{ mb: 2 }}>
                Environnement cible : <strong>{loginLinkDialog.targetOrigin}</strong>
              </Alert>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Ce lien vous connecte <strong>réellement</strong> en tant que {loginLinkDialog.email}. Votre
                session superadmin sera remplacée dans cet onglet. Utilisez un onglet privé si vous souhaitez
                conserver votre session actuelle. Expire dans ~1&nbsp;h.
              </Alert>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {loginLinkDialog.email}
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={3}
                value={loginLinkDialog.link}
                InputProps={{ readOnly: true }}
                sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setLoginLinkDialog((d) => ({ ...d, open: false }))}>
                Fermer
              </Button>
              <Button startIcon={<ContentCopyIcon />} onClick={() => void handleCopyLoginLink()}>
                Copier
              </Button>
              <Button
                variant="contained"
                startIcon={<OpenInNewIcon />}
                onClick={() => window.open(loginLinkDialog.link, '_blank', 'noopener,noreferrer')}
              >
                Ouvrir le lien
              </Button>
            </DialogActions>
          </Dialog>
        </Paper>
      ) : tabValue === 5 ? (
        <Paper sx={{ p: 3, mt: 3 }}>
          <StripeCustomers />
        </Paper>
      ) : tabValue === 6 ? (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <ContactMailIcon color="primary" sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h5" gutterBottom>
                Démarchage — Prospects JE / JS
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Créer des Junior Entreprises ou Job Services prospectés et leurs contacts, puis envoyer un email via EmailJS (hors structures).
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              Créer une JE ou une JS
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={newProspectForm.type}
                    label="Type"
                    onChange={(e) => setNewProspectForm(prev => ({ ...prev, type: e.target.value as 'je' | 'js' }))}
                  >
                    <MenuItem value="je">Junior Entreprise</MenuItem>
                    <MenuItem value="js">Job Service</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Nom"
                  placeholder="Nom de la JE / JS"
                  value={newProspectForm.name}
                  onChange={(e) => setNewProspectForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="École (optionnel)"
                  value={newProspectForm.school}
                  onChange={(e) => setNewProspectForm(prev => ({ ...prev, school: e.target.value }))}
                />
              </Grid>
              <Grid item>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleCreateDemarchageProspect}
                  disabled={!newProspectForm.name.trim() || demarchageLoading}
                >
                  Créer
                </Button>
              </Grid>
            </Grid>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" gutterBottom fontWeight="bold">
            Prospects et contacts
          </Typography>
          {demarchageLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : demarchageProspects.length === 0 ? (
            <Typography color="text.secondary">Aucun prospect. Créez une JE ou une JS ci-dessus.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={48} />
                    <TableCell>Type</TableCell>
                    <TableCell>Nom</TableCell>
                    <TableCell>École</TableCell>
                    <TableCell>Contacts</TableCell>
                    <TableCell align="right" width={80}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {demarchageProspects.map((prospect) => {
                    const contacts = demarchageContactsByProspect[prospect.id] || [];
                    const isExpanded = demarchageExpanded === prospect.id;
                    return (
                      <React.Fragment key={prospect.id}>
                        <TableRow>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => setDemarchageExpanded(isExpanded ? null : prospect.id)}
                            >
                              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={prospect.type === 'je' ? 'JE' : 'JS'}
                              size="small"
                              color={prospect.type === 'je' ? 'primary' : 'secondary'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{prospect.name}</TableCell>
                          <TableCell>{prospect.school || '—'}</TableCell>
                          <TableCell>{contacts.length} contact(s)</TableCell>
                          <TableCell align="right">
                            <Tooltip title="Supprimer la JE/JS et tous ses contacts">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteDemarchageProspect(prospect.id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={6} sx={{ py: 0, borderBottom: 'none', bgcolor: 'action.hover' }}>
                              <Box sx={{ pl: 4, pr: 2, py: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                  <Typography variant="subtitle2">Contacts</Typography>
                                  <Button
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={() => setNewContactForm({
                                      prospectId: prospect.id,
                                      prospectName: prospect.name,
                                      firstName: '',
                                      lastName: '',
                                      position: '',
                                      email: ''
                                    })}
                                  >
                                    Ajouter un contact
                                  </Button>
                                </Box>
                                {contacts.length === 0 ? (
                                  <Typography variant="body2" color="text.secondary">Aucun contact. Ajoutez-en un pour envoyer un email.</Typography>
                                ) : (
                                    <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>Prénom</TableCell>
                                        <TableCell>Nom</TableCell>
                                        <TableCell>Poste</TableCell>
                                        <TableCell>Email</TableCell>
                                        <TableCell>Mail envoyé</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {contacts.map((contact) => (
                                        <TableRow key={contact.id}>
                                          <TableCell>{contact.firstName}</TableCell>
                                          <TableCell>{contact.lastName}</TableCell>
                                          <TableCell>{contact.position}</TableCell>
                                          <TableCell>{contact.email}</TableCell>
                                          <TableCell>
                                            {contact.lastEmailSentAt
                                              ? formatDate(toDateFromFirestore(contact.lastEmailSentAt))
                                              : '—'}
                                          </TableCell>
                                          <TableCell align="right">
                                            <Button
                                              size="small"
                                              variant="outlined"
                                              startIcon={sendingEmailContactId === contact.id ? <CircularProgress size={16} /> : <SendIcon />}
                                              disabled={sendingEmailContactId !== null}
                                              onClick={() => handleSendDemarchageEmail(prospect, contact)}
                                            >
                                              Envoyer un mail
                                            </Button>
                                            <Tooltip title="Supprimer le contact">
                                              <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => handleDeleteDemarchageContact(prospect.id, contact.id)}
                                              >
                                                <DeleteIcon fontSize="small" />
                                              </IconButton>
                                            </Tooltip>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {newContactForm && (
            <Dialog open={!!newContactForm} onClose={() => setNewContactForm(null)} maxWidth="sm" fullWidth>
              <DialogTitle>Ajouter un contact — {newContactForm.prospectName}</DialogTitle>
              <DialogContent dividers>
                <Grid container spacing={2} sx={{ pt: 1 }}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Prénom"
                      value={newContactForm.firstName}
                      onChange={(e) => setNewContactForm(prev => prev ? { ...prev, firstName: e.target.value } : null)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Nom"
                      value={newContactForm.lastName}
                      onChange={(e) => setNewContactForm(prev => prev ? { ...prev, lastName: e.target.value } : null)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Poste"
                      value={newContactForm.position}
                      onChange={(e) => setNewContactForm(prev => prev ? { ...prev, position: e.target.value } : null)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Email"
                      type="email"
                      required
                      value={newContactForm.email}
                      onChange={(e) => setNewContactForm(prev => prev ? { ...prev, email: e.target.value } : null)}
                    />
                  </Grid>
                </Grid>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setNewContactForm(null)}>Annuler</Button>
                <Button variant="contained" onClick={handleAddDemarchageContact} disabled={!newContactForm.email.trim()}>
                  Ajouter
                </Button>
              </DialogActions>
            </Dialog>
          )}
        </Paper>
      ) : tabValue === 7 ? (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <SecurityIcon color="primary" sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h5" gutterBottom>
                Migration du Chiffrement des Données
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Chiffrez toutes les données sensibles existantes dans la base de données
              </Typography>
            </Box>
          </Box>

          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Cette fonction permet de chiffrer automatiquement toutes les données sensibles existantes 
              (numéros de téléphone, adresses, SIRET, etc.) dans les collections suivantes :
            </Typography>
            <List dense sx={{ mt: 1 }}>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemText primary="• Utilisateurs (users) : téléphones, adresses, numéros de sécurité sociale, secrets 2FA" />
              </ListItem>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemText primary="• Entreprises (companies) : SIRET, TVA, adresses, téléphones" />
              </ListItem>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemText primary="• Contacts (contacts) : téléphones, emails" />
              </ListItem>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemText primary="• Prospects (prospects) : téléphones, emails, adresses, SIRET" />
              </ListItem>
            </List>
          </Alert>

          {migrationError && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setMigrationError(null)}>
              {migrationError}
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Button
              variant="outlined"
              startIcon={checkingStatus ? <CircularProgress size={20} /> : <LockIcon />}
              onClick={checkMigrationStatus}
              disabled={checkingStatus || migrationLoading}
            >
              {checkingStatus ? 'Vérification...' : 'Vérifier le Statut'}
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={migrationLoading ? <CircularProgress size={20} color="inherit" /> : <SecurityIcon />}
              onClick={startMigration}
              disabled={migrationLoading || checkingStatus}
            >
              {migrationLoading ? 'Migration en cours...' : 'Lancer la Migration'}
            </Button>
          </Box>

          {migrationLoading && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Migration en cours, veuillez patienter...
              </Typography>
              <LinearProgress sx={{ mt: 1 }} />
            </Box>
          )}

          {migrationStatus && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Statut actuel de la migration
              </Typography>
              
              <Grid container spacing={2}>
                {Object.entries(migrationStatus).map(([collectionName, data]: [string, any]) => (
                  <Grid item xs={12} md={6} key={collectionName}>
                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        {collectionName.charAt(0).toUpperCase() + collectionName.slice(1)}
                      </Typography>
                      {data.sample && (
                        <Box>
                          <Typography variant="body2">
                            Total (échantillon) : {data.sample.total}
                          </Typography>
                          <Typography variant="body2">
                            Avec champs sensibles : {data.sample.hasSensitiveFields}
                          </Typography>
                          <Typography variant="body2" color="success.main">
                            Déjà chiffrés : {data.sample.encrypted}
                          </Typography>
                          <Typography variant="body2" color="warning.main">
                            Non chiffrés : {data.sample.notEncrypted}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold" sx={{ mt: 1 }}>
                            Taux de chiffrement : {data.sample.percentageEncrypted}%
                          </Typography>
                        </Box>
                      )}
                      {data.note && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          {data.note}
                        </Typography>
                      )}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Paper>
      ) : tabValue === 8 ? (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <PersonAddIcon color="primary" sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h5" gutterBottom>
                Migration des Statuts Utilisateurs
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Migrer les utilisateurs de "member" vers "membre" pour harmoniser la base de données
              </Typography>
            </Box>
          </Box>

          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Attention : Cette migration est irréversible
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText 
                  primary="Tous les utilisateurs avec status='member' seront migrés vers status='membre'"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Cette opération est nécessaire pour assurer la cohérence du système de permissions"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Les nouveaux membres sont déjà créés avec le statut 'membre'"
                />
              </ListItem>
            </List>
          </Alert>

          {memberMigrationError && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setMemberMigrationError(null)}>
              {memberMigrationError}
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Button
              variant="outlined"
              startIcon={<LockIcon />}
              onClick={checkMemberMigrationStatus}
              disabled={memberMigrationLoading}
            >
              Vérifier le Statut
            </Button>
            <Button
              variant="contained"
              color="warning"
              startIcon={memberMigrationLoading ? <CircularProgress size={20} color="inherit" /> : <PersonAddIcon />}
              onClick={startMemberMigration}
              disabled={memberMigrationLoading || (memberMigrationStats?.usersToMigrate === 0)}
            >
              {memberMigrationLoading ? 'Migration en cours...' : 'Migrer "member" → "membre"'}
            </Button>
          </Box>

          {memberMigrationLoading && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Migration en cours, veuillez patienter...
              </Typography>
              <LinearProgress sx={{ mt: 1 }} />
              {memberMigrationStats && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Progression : {memberMigrationStats.usersMigrated} / {memberMigrationStats.usersToMigrate}
                </Typography>
              )}
            </Box>
          )}

          {memberMigrationStats && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Statut de la migration
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2, bgcolor: 'background.default', textAlign: 'center' }}>
                    <Typography variant="h3" color="primary">
                      {memberMigrationStats.totalUsers}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Utilisateurs totaux
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2, bgcolor: memberMigrationStats.usersToMigrate > 0 ? 'warning.light' : 'success.light', textAlign: 'center' }}>
                    <Typography variant="h3" color={memberMigrationStats.usersToMigrate > 0 ? 'warning.dark' : 'success.dark'}>
                      {memberMigrationStats.usersToMigrate}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {memberMigrationStats.usersToMigrate > 0 ? 'À migrer (status="member")' : 'Tous migrés !'}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2, bgcolor: 'success.light', textAlign: 'center' }}>
                    <Typography variant="h3" color="success.dark">
                      {memberMigrationStats.usersMigrated}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Migrés cette session
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {memberMigrationStats.usersToMigrate === 0 && (
                <Alert severity="success" sx={{ mt: 3 }}>
                  Tous les utilisateurs utilisent déjà le statut "membre". Aucune migration nécessaire.
                </Alert>
              )}
            </Box>
          )}
        </Paper>
      ) : null}

      <ImageDialog />
      {createPortal(
        <Snackbar
          open={open}
          autoHideDuration={6000}
          onClose={() => setOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          sx={{ zIndex: 10000 }}
        >
          <Alert 
            onClose={() => setOpen(false)} 
            severity={message.type as 'success' | 'error'} 
            sx={{ width: '100%' }}
          >
            {message.text}
          </Alert>
        </Snackbar>,
        document.body
      )}

      <UsersDialog />

      {/* Ajout du dialogue pour l'ajout d'utilisateur */}
      <AddUserDialog
        open={openAddUserDialog}
        onClose={() => {
          setOpenAddUserDialog(false);
          setSelectedStructureForUser(null);
        }}
        structureId={selectedStructureForUser?.id || ''}
        structureName={selectedStructureForUser?.name || ''}
        onAddUser={handleAddUserToStructure}
      />
    </Box>
  );
};

export default SuperAdmin; 