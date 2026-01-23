import React, { useState, useEffect } from 'react';
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
  LinearProgress
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
  serverTimestamp,
  addDoc,
  setDoc 
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
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useNotifications } from '../contexts/NotificationContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import LockIcon from '@mui/icons-material/Lock';
import SecurityIcon from '@mui/icons-material/Security';

interface StructureData {
  id: string;
  nom: string;
  ecole: string;
  domaines?: string[];
  createdAt?: any;
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
  const [userData, setUserData] = useState({
    email: '',
    displayName: '',
    firstName: '',
    lastName: '',
    birthDate: '',
    graduationYear: '',
    program: '',
    status: 'etudiant',
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
  });

  const [errors, setErrors] = useState({
    email: '',
    firstName: '',
    lastName: ''
  });

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
      userData.lastName.trim() !== ''
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
            onAddUser({
              ...userData,
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

  // Ajouter un nouvel onglet
  const tabs = ['Structures', 'Rapports', 'Super Admins', 'Notifications', 'Clients Stripe', 'Migration Chiffrement'];

  // Ajouter l'état pour le filtre de statut (après les autres états)
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('all');

  // Ajout de l'interface pour le dialogue d'ajout d'utilisateur
  const [openAddUserDialog, setOpenAddUserDialog] = useState(false);
  const [selectedStructureForUser, setSelectedStructureForUser] = useState<{id: string, name: string} | null>(null);

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
          console.error('Accès non autorisé');
          navigate('/dashboard');
          return;
        }
        
        // Si l'utilisateur est superadmin, charger les données
        fetchStructures();
        fetchReports();
        fetchSuperAdmins();
        fetchNotifications();
      } catch (error) {
        console.error('Erreur lors de la vérification des permissions:', error);
        navigate('/dashboard');
      }
    };

    checkSuperAdminStatus();
  }, [currentUser, navigate]);

  const fetchStructures = async () => {
    try {
      const structuresRef = collection(db, 'structures');
      const snapshot = await getDocs(structuresRef);
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
      const snapshot = await getDocs(usersRef);
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
      setMessage({ type: 'error', text: 'Erreur lors de la récupération des notifications' });
      setOpen(true);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        await addDoc(collection(db, 'notifications'), {
          userId: report.userId,
          type: 'report_update',
          title: 'Mise à jour de votre rapport',
          message: `Le statut de votre ${report.type === 'bug' ? 'rapport d\'erreur' : 'idée'} a été mis à jour en "${newStatus}"`,
          read: false,
          createdAt: serverTimestamp(),
          reportId: reportId
        });
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
        await addDoc(collection(db, 'notifications'), {
          userId: report.userId,
          type: 'report_response',
          title: 'Nouvelle réponse à votre rapport',
          message: `Une réponse a été apportée à votre ${report.type === 'bug' ? 'rapport d\'erreur' : 'idée'}`,
          read: false,
          createdAt: serverTimestamp(),
          reportId: reportId
        });
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

  // Fonction pour récupérer tous les utilisateurs
  const fetchAllUsers = async () => {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        email: doc.data().email || '',
        displayName: doc.data().displayName || ''
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
        // Récupérer tous les utilisateurs
        const usersSnapshot = await getDocs(collection(db, 'users'));
        userIds = usersSnapshot.docs.map(doc => doc.id);
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

      // Créer une notification pour chaque destinataire
      const notificationPromises = userIds.map(userId =>
        sendNotification({
          type: 'admin_notification',
          title: notificationForm.title,
          message: notificationForm.message,
          priority: 'medium',
          userId,
          recipientType: notificationForm.recipientType,
          structureId: notificationForm.recipientType === 'structure' ? notificationForm.selectedStructureId : undefined,
          recipientCount: userIds.length
        })
      );

      await Promise.all(notificationPromises);

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

  // Charger les utilisateurs au montage du composant
  useEffect(() => {
    if (tabValue === 3) { // Onglet Notifications
      fetchAllUsers();
    }
  }, [tabValue]);

  // Fonction pour gérer l'ajout d'un utilisateur à une structure
  const handleAddUserToStructure = async (userData: any) => {
    if (!selectedStructureForUser) return;

    try {
      const auth = getAuth();
      // Générer un mot de passe temporaire
      const tempPassword = Math.random().toString(36).slice(-8);
      
      // Créer l'utilisateur dans Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        userData.email,
        tempPassword
      );

      // Ajouter les informations supplémentaires dans Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        ...userData,
        structureId: selectedStructureForUser.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        tempPassword: tempPassword // Stocker le mot de passe temporaire
      });
      
      setMessage({ 
        type: 'success', 
        text: `Utilisateur créé avec succès. Mot de passe temporaire : ${tempPassword}` 
      });
      setOpen(true);
      
      // Rafraîchir la liste des utilisateurs de la structure
      if (selectedStructureForUser) {
        handleViewUsers(selectedStructureForUser.id, '', selectedStructureForUser.name);
      }
    } catch (error: any) {
      console.error('Erreur lors de la création de l\'utilisateur:', error);
      let errorMessage = 'Erreur lors de la création de l\'utilisateur';
      
      if (error.code === 'auth/invalid-email') {
        errorMessage = 'L\'adresse email n\'est pas valide';
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Cette adresse email est déjà utilisée';
      }
      
      setMessage({ type: 'error', text: errorMessage });
      setOpen(true);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Tabs 
        value={tabValue} 
        onChange={(e, newValue) => setTabValue(newValue)}
      >
        {tabs.map((tab, index) => (
          <Tab key={tab} label={tab} />
        ))}
      </Tabs>

      {tabValue === 0 ? (
        <>
          <Paper sx={{ p: 3, mt: 3, mb: 3 }}>
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

          <Paper sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Structures existantes
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nom</TableCell>
                    <TableCell>École</TableCell>
                    <TableCell>Domaines emails</TableCell>
                    <TableCell>Date de création</TableCell>
                    <TableCell>Actions</TableCell>
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
                            {structure.domaines?.map((domain: string, index: number) => (
                              <Chip key={index} label={domain} size="small" onDelete={() => handleRemoveDomain(index)} />
                            ))}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(structure.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
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
      ) : tabValue === 5 ? (
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
      ) : (
        <Paper sx={{ p: 3, mt: 3 }}>
          <StripeCustomers />
        </Paper>
      )}

      <ImageDialog />
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={() => setOpen(false)}
      >
        <Alert 
          onClose={() => setOpen(false)} 
          severity={message.type as 'success' | 'error'} 
          sx={{ width: '100%' }}
        >
          {message.text}
        </Alert>
      </Snackbar>

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