import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Avatar,
  Chip,
  Button,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Alert,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  OutlinedInput,
  InputAdornment,
  DialogContentText,
  Checkbox,
  FormGroup,
  FormControlLabel,
  Stack,
  Chip as MuiChip,
  Autocomplete
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  LocationOn as LocationIcon,
  Work as WorkIcon,
  People as PeopleIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as CalendarIcon,
  Note as NoteIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Language as LanguageIcon,
  Public as PublicIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  Call as CallIcon,
  NoteAdd as NoteAddIcon,
  Assignment as AssignmentIcon,
  Send as SendIcon,
  AccessTime as AccessTimeIcon,
  History as HistoryIcon,
  Upload as UploadIcon,
  Link as LinkIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp, collection, addDoc, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { uploadFile } from '../firebase/storage';
import { auth } from '../firebase/config';

interface Prospect {
  id: string;
  nom: string;
  company?: string;
  entreprise?: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  secteur?: string;
  taille?: string;
  source: string;
  notes?: string;
  statut: string;
  ownerId: string;
  dateCreation: any;
  photoUrl?: string;
  valeurPotentielle?: number;
  derniereInteraction?: any;
  location?: string;
  pays?: string;
  linkedinUrl?: string;
  title?: string;
  structureId: string;
  userId: string;
  updatedAt: any;
  dateRecontact?: string;
}

interface StructureMember {
  id: string;
  displayName: string;
  role: 'admin' | 'superadmin' | 'member';
  poles?: { poleId: string }[];
  mandat?: string;
}

interface Activity {
  id: string;
  type: 'creation' | 'modification' | 'email' | 'call' | 'linkedin_request' | 'linkedin_message' | 'note' | 'reminder' | 'mail_upload';
  timestamp: any;
  userId: string;
  userName: string;
  details?: {
    field?: string;
    oldValue?: string;
    newValue?: string;
    emailContent?: string;
    callDuration?: number;
    noteContent?: string;
    reminderDate?: any;
    reminderTitle?: string;
    notifiedUsers?: string[];
    mailFile?: string;
  };
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`prospect-tabpanel-${index}`}
      aria-labelledby={`prospect-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Fonction utilitaire pour mettre une majuscule à chaque mot
const capitalizeWords = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Fonction utilitaire pour parser les dates
const parseDate = (date: any): Date | null => {
  if (!date) return null;
  
  try {
    let parsedDate: Date;
    
    if (date.toDate && typeof date.toDate === 'function') {
      // C'est un timestamp Firestore
      parsedDate = date.toDate();
    } else if (date instanceof Date) {
      // C'est déjà un objet Date
      parsedDate = date;
    } else if (typeof date === 'string') {
      // C'est une chaîne de caractères
      parsedDate = new Date(date);
    } else if (date && typeof date === 'object' && date.seconds) {
      // C'est un timestamp Firestore sous forme d'objet
      parsedDate = new Date(date.seconds * 1000);
    } else if (typeof date === 'number') {
      // C'est un timestamp numérique
      parsedDate = new Date(date);
    } else {
      // Essayer de parser comme Date
      parsedDate = new Date(date);
    }
    
    // Vérifier si la date est valide
    if (isNaN(parsedDate.getTime()) || !isFinite(parsedDate.getTime())) {
      console.warn('Date invalide détectée:', date);
      return null;
    }
    
    return parsedDate;
  } catch (error) {
    console.error('Erreur lors du parsing de la date:', error, date);
    return null;
  }
};

const ProspectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [editedProspect, setEditedProspect] = useState<Partial<Prospect>>({});
  const [tabValue, setTabValue] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tab, setTab] = useState(0); // 0: Contact, 1: Activité
  const [canDelete, setCanDelete] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [mailDialogOpen, setMailDialogOpen] = useState(false);
  const [selectedActivityType, setSelectedActivityType] = useState<string>('');
  const [emailContent, setEmailContent] = useState('');
  const [callDuration, setCallDuration] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDate, setReminderDate] = useState<Date | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [mailFile, setMailFile] = useState<File | null>(null);
  const [structureMembers, setStructureMembers] = useState<StructureMember[]>([]);
  const creationActivityAdded = useRef(false);
  
  // Charger les membres de l'équipe
  useEffect(() => {
    const fetchStructureMembers = async () => {
      if (!userData?.structureId) return;
      try {
        const q = query(collection(db, 'users'), where('structureId', '==', userData.structureId));
        const snapshot = await getDocs(q);
        const members = snapshot.docs.map(doc => ({
          id: doc.id,
          displayName: doc.data().displayName || doc.data().name || 'Utilisateur',
          role: doc.data().role || 'member',
          poles: doc.data().poles || [],
          mandat: doc.data().mandat
        }));
        setStructureMembers(members as StructureMember[]);
      } catch (error) {
        console.error(error);
      }
    };
    fetchStructureMembers();
  }, [userData?.structureId]);

  // CRM Intelligent
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [suggestedNextStep, setSuggestedNextStep] = useState<string | null>(null);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('Utilisateur non connecté');
      setError('Vous devez être connecté pour accéder à cette page');
      return;
    }

    const fetchProspect = async () => {
      if (!id) return;
      
      try {
        console.log('Récupération du prospect avec ID:', id);
        const prospectRef = doc(db, 'prospects', id);
        const prospectDoc = await getDoc(prospectRef);
        
        if (prospectDoc.exists()) {
          const prospectData = { id: prospectDoc.id, ...prospectDoc.data() } as Prospect;
          console.log('Données du prospect:', prospectData);
          console.log('Nom du prospect:', prospectData.nom);
          console.log('Entreprise du prospect:', prospectData.entreprise || prospectData.company);
          setProspect(prospectData);
          setEditedProspect(prospectData);

          // CRM: Vérifier les doublons ou entreprises similaires
          if (prospectData.entreprise || prospectData.company) {
            const companyName = (prospectData.entreprise || prospectData.company || '').toLowerCase();
            const q = query(
              collection(db, 'prospects'), 
              where('structureId', '==', userData?.structureId)
            );
            const snaps = await getDocs(q);
            const duplicates = snaps.docs.filter(d => {
              const data = d.data();
              const name = (data.entreprise || data.company || '').toLowerCase();
              return d.id !== id && name.includes(companyName) && (data.statut === 'abandon' || data.statut === 'deja_client');
            });

            if (duplicates.length > 0) {
              const status = duplicates[0].data().statut;
              setDuplicateWarning(status === 'abandon' 
                ? "Attention : Cette entreprise a déjà été marquée comme 'Abandon' dans le passé." 
                : "Info : Cette entreprise est déjà cliente sur un autre contact.");
            }
          }

          // CRM: Suggestion d'action
          if (prospectData.statut === 'contacte') {
             setSuggestedNextStep("Relance suggérée (J+3)");
          } else if (prospectData.statut === 'nouveau') {
             setSuggestedNextStep("Premier contact à établir");
          }

          // Vérifier si c'est une nouvelle création (et ne le faire qu'une fois)
          if (!creationActivityAdded.current) {
            const activitiesRef = collection(db, 'prospects', id, 'activities');
            const q = query(activitiesRef, where('type', '==', 'creation'));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
              await saveActivity({
                type: 'creation',
                userId: currentUser.uid,
                userName: currentUser.displayName || 'Utilisateur inconnu',
                timestamp: serverTimestamp()
              });
            }
            creationActivityAdded.current = true;
          }
        } else {
          setError('Prospect non trouvé');
        }
      } catch (err) {
        console.error('Erreur lors de la récupération du prospect:', err);
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    fetchProspect();
  }, [id]);

  useEffect(() => {
    const checkDeletePermission = async () => {
      if (!userData?.uid) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', userData.uid));
        if (userDoc.exists()) {
          const userDocData = userDoc.data();
          setCanDelete(
            userDocData?.status === 'superadmin' || 
            userDocData?.role === 'superadmin' ||
            userDocData?.status === 'admin' ||
            userDocData?.role === 'admin' ||
            userDocData?.status === 'member' ||
            userDocData?.role === 'member'
          );
        }
      } catch (error) {
        console.error('Erreur vérification permissions:', error);
        setCanDelete(false);
      }
    };

    checkDeletePermission();
  }, [userData]);

  useEffect(() => {
    const fetchActivities = async () => {
      if (!id) return;
      
      try {
        const activitiesRef = collection(db, 'prospects', id, 'activities');
        const q = query(activitiesRef, orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const activitiesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Activity[];
        
        setActivities(activitiesData);
      } catch (err) {
        console.error('Erreur lors de la récupération des activités:', err);
      }
    };

    fetchActivities();
  }, [id]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleEditStatus = () => {
    setIsEditingStatus(true);
  };

  const handleSave = async () => {
    if (!id || !editedProspect) return;

    try {
      const prospectRef = doc(db, 'prospects', id);
      const changes: Record<string, any> = {};
      
      Object.entries(editedProspect).forEach(([key, value]) => {
        if (prospect && value !== prospect[key as keyof Prospect]) {
          changes[key] = value;
        }
      });

      // Synchroniser entreprise et company
      if (changes.entreprise !== undefined) {
        changes.company = changes.entreprise;
      } else if (changes.company !== undefined) {
        changes.entreprise = changes.company;
      }

      if (Object.keys(changes).length > 0) {
        await updateDoc(prospectRef, {
          ...changes,
          updatedAt: serverTimestamp()
        });

        await saveActivity({
          type: 'modification',
          userId: userData?.uid || '',
          userName: userData?.displayName || 'Utilisateur inconnu',
          details: changes,
          timestamp: serverTimestamp()
        });

        setProspect(prev => prev ? { ...prev, ...changes } : null);
      }
      
      setIsEditing(false);
    } catch (err) {
      console.error('Erreur lors de la mise à jour du prospect:', err);
      setError('Erreur lors de la sauvegarde des modifications');
    }
  };

  const handleSaveStatus = async () => {
    if (!id || !editedProspect) return;

    try {
      const oldStatus = prospect?.statut;
      const newStatus = editedProspect.statut;
      
      const prospectRef = doc(db, 'prospects', id);
      await updateDoc(prospectRef, {
        statut: newStatus,
        updatedAt: serverTimestamp()
      });
      
      // Enregistrer dans l'activité
      if (oldStatus !== newStatus) {
        await saveActivity({
          type: 'modification',
          userId: userData?.uid || '',
          userName: userData?.displayName || 'Utilisateur inconnu',
          details: {
            field: 'Statut',
            oldValue: oldStatus || 'Non défini',
            newValue: newStatus || 'Non défini'
          },
          timestamp: serverTimestamp()
        });
      }
      
      setProspect(prev => prev ? { ...prev, statut: newStatus } : null);
      setIsEditingStatus(false);
    } catch (err) {
      console.error('Erreur lors de la mise à jour du statut:', err);
      setError('Erreur lors de la sauvegarde du statut');
    }
  };

  const handleDelete = async () => {
    if (!id) {
      console.error('ID du prospect manquant');
      return;
    }

    try {
      // Vérifier les permissions avant la suppression
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError('Vous devez être connecté pour effectuer cette action');
        return;
      }

      // Récupérer les données de l'utilisateur
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!userDoc.exists()) {
        setError('Utilisateur non trouvé');
        return;
      }

      const userDocData = userDoc.data();
      console.log('Données utilisateur:', {
        uid: currentUser.uid,
        status: userDocData?.status,
        role: userDocData?.role,
        structureId: userDocData?.structureId
      });

      // Récupérer les données du prospect
      const prospectDoc = await getDoc(doc(db, 'prospects', id));
      if (!prospectDoc.exists()) {
        setError('Prospect non trouvé');
        return;
      }

      const prospectData = prospectDoc.data();
      console.log('Données prospect:', {
        id,
        structureId: prospectData.structureId
      });

      // Vérifier les permissions
      const isSuperAdmin = userDocData?.status === 'superadmin' || userDocData?.role === 'superadmin';
      const isInSameStructure = prospectData.structureId === userDocData.structureId;
      const hasCorrectStatus = userDocData?.status === 'member' || 
                             userDocData?.status === 'admin' || 
                             userDocData?.role === 'member' || 
                             userDocData?.role === 'admin';

      console.log('Vérification des permissions:', {
        isSuperAdmin,
        isInSameStructure,
        hasCorrectStatus
      });

      if (!isSuperAdmin && (!isInSameStructure || !hasCorrectStatus)) {
        setError('Vous n\'avez pas les permissions nécessaires pour supprimer ce prospect');
        return;
      }

      await deleteDoc(doc(db, 'prospects', id));
      navigate('/app/commercial');
    } catch (err) {
      console.error('Erreur lors de la suppression du prospect:', err);
      setError('Erreur lors de la suppression du prospect');
    }
  };

  const handleChange = (field: keyof Prospect) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditedProspect(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'actif':
        return '#34c759';
      case 'prospect':
        return '#ff9500';
      case 'inactif':
        return '#ff3b30';
      default:
        return '#8e8e93';
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'Non spécifiée';
    
    try {
      const parsedDate = parseDate(date);
      
      if (!parsedDate) return 'Date invalide';
      
      return parsedDate.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Erreur lors du formatage de la date:', error, date);
      return 'Date invalide';
    }
  };

  const saveActivity = async (activity: Omit<Activity, 'id'>) => {
    if (!id) {
      console.error('ID du prospect manquant');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('Utilisateur non connecté');
      return;
    }

    try {
      console.log('Sauvegarde de l\'activité:', {
        ...activity,
        userId: currentUser.uid,
        timestamp: serverTimestamp()
      });

      const activitiesRef = collection(db, 'prospects', id, 'activities');
      const docRef = await addDoc(activitiesRef, {
        ...activity,
        userId: currentUser.uid,
        timestamp: serverTimestamp()
      });
      console.log('Activité sauvegardée avec l\'ID:', docRef.id);
    } catch (err) {
      console.error('Erreur lors de la sauvegarde de l\'activité:', err);
    }
  };

  const handleActivitySubmit = async () => {
    if (!id || !selectedActivityType) {
      console.log('ID ou type d\'activité manquant:', { id, selectedActivityType });
      return;
    }

    try {
      console.log('Soumission d\'une nouvelle activité:', selectedActivityType);
      const activity: Omit<Activity, 'id'> = {
        type: selectedActivityType as Activity['type'],
        userId: userData?.uid || '',
        userName: userData?.displayName || 'Utilisateur inconnu',
        timestamp: serverTimestamp()
      };

      switch (selectedActivityType) {
        case 'email':
          activity.details = { emailContent };
          break;
        case 'call':
          activity.details = { callDuration: parseInt(callDuration) };
          break;
        case 'note':
          activity.details = { noteContent };
          break;
        case 'reminder':
          if (reminderDate && reminderTitle) {
            activity.details = {
              reminderTitle,
              reminderDate,
              notifiedUsers: selectedUsers
            };
          }
          break;
        case 'mail_upload':
          if (mailFile) {
            const path = `prospects/${id}/mails/${Date.now()}-${mailFile.name}`;
            const uploadResult = await uploadFile(mailFile, path);
            activity.details = { mailFile: uploadResult.url };
            setMailDialogOpen(false);
          }
          break;
      }

      console.log('Activité à sauvegarder:', activity);
      await saveActivity(activity);
      
      // Réinitialiser les champs
      setActivityDialogOpen(false);
      setNoteDialogOpen(false);
      setReminderDialogOpen(false);
      setMailDialogOpen(false);
      setSelectedActivityType('');
      setEmailContent('');
      setCallDuration('');
      setNoteContent('');
      setReminderTitle('');
      setReminderDate(null);
      setSelectedUsers([]);
      setMailFile(null);

      // Rafraîchir la liste des activités
      console.log('Rafraîchissement de la liste des activités');
      const activitiesRef = collection(db, 'prospects', id, 'activities');
      const q = query(activitiesRef, orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const activitiesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Activity[];
      
      console.log('Nouvelles activités récupérées:', activitiesData);
      setActivities(activitiesData);
    } catch (err) {
      console.error('Erreur lors de l\'ajout de l\'activité:', err);
    }
  };

  const formatActivity = (activity: Activity) => {
    let date;
    if (activity.type === 'creation' && prospect?.dateCreation) {
      date = parseDate(prospect.dateCreation);
    } else {
      date = parseDate(activity.timestamp);
    }

    const formattedDate = date ? new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris'
    }).format(date) : 'Date invalide';

    switch (activity.type) {
      case 'creation':
        return `${activity.userName} a créé le contact le ${formattedDate}`;
      case 'modification':
        return `${activity.userName} a modifié le contact le ${formattedDate}`;
      case 'email':
        return `${activity.userName} a envoyé un email le ${formattedDate}`;
      case 'call':
        return `${activity.userName} a passé un appel de ${activity.details?.callDuration} minutes le ${formattedDate}`;
      case 'note':
        return `${activity.userName} a ajouté une note le ${formattedDate}`;
      case 'reminder':
        return `${activity.userName} a créé un rappel "${activity.details?.reminderTitle}" le ${formattedDate}`;
      case 'mail_upload':
        let details = '';
        if (activity.details?.mailFile && (activity.details.mailFile.endsWith('.png') || activity.details.mailFile.endsWith('.jpg') || activity.details.mailFile.endsWith('.jpeg') || activity.details.mailFile.endsWith('.gif') || activity.details.mailFile.endsWith('.webp'))) {
          details = `<img src='${activity.details.mailFile}' alt='Pièce jointe' style='max-width:100px;max-height:100px;border-radius:8px;margin-top:4px;' />`;
        } else if (activity.details?.mailFile && (activity.details.mailFile.endsWith('.pdf') || activity.details.mailFile.endsWith('.eml'))) {
          details = `<a href='${activity.details.mailFile}' target='_blank' rel='noopener noreferrer'>Télécharger le fichier</a>`;
        } else if (activity.details?.mailFile) {
          details = `<a href='${activity.details.mailFile}' target='_blank' rel='noopener noreferrer'>Voir le fichier</a>`;
        }
        return `${activity.userName} a uploadé un mail le ${formattedDate}`;
      default:
        return '';
    }
  };

  // Helpers pour affichage conditionnel
  const renderIf = (label: string, value?: string | number | null, icon?: React.ReactNode) =>
    value ? (
      <ListItem>
        {icon && <ListItemIcon>{icon}</ListItemIcon>}
        <ListItemText primary={label} secondary={value} />
      </ListItem>
    ) : null;

  // Dans l'affichage des activités, filtrer pour n'afficher qu'une seule activité de type 'creation'
  const filteredActivities = React.useMemo(() => {
    let creationShown = false;
    return activities.filter(act => {
      if (act.type === 'creation') {
        if (creationShown) return false;
        creationShown = true;
        return true;
      }
      return true;
    });
  }, [activities]);

  // Layout principal
  return (
    <Box sx={{ width: '100vw', minHeight: '100vh', bgcolor: '#f7f8fa' }}>
      <>
        <Navbar />
        <Sidebar open={true} onClose={() => {}} />
      </>
      <Box 
        sx={{ 
          marginLeft: '64px', // Largeur de la sidebar gauche
          paddingTop: '64px', // Hauteur de la navbar
          minHeight: 'calc(100vh - 64px)',
          width: 'calc(100vw - 64px)',
          overflowX: 'auto'
        }}
      >
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
            <CircularProgress />
          </Box>
        ) : error || !prospect ? (
          <Box p={3}>
            <Alert severity="error">{error || 'Prospect non trouvé'}</Alert>
          </Box>
        ) : (
          <Box sx={{ p: { xs: 1, md: 4 } }}>
              {/* Breadcrumbs */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  <span style={{ cursor: 'pointer', color: '#0071e3' }} onClick={() => navigate('/app/commercial')}>Contacts</span> &gt; Fiche société
                </Typography>
              </Box>

              {/* CRM Alerts */}
              {duplicateWarning && (
                <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
                  {duplicateWarning}
                </Alert>
              )}
              
              {suggestedNextStep && (
                <Alert severity="info" icon={<NotificationsIcon />} sx={{ mb: 3, borderRadius: 2, bgcolor: '#e3f2fd' }}>
                  Action recommandée : <strong>{suggestedNextStep}</strong>
                </Alert>
              )}

              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Avatar
                  src={prospect.photoUrl}
                  alt={prospect.nom || prospect.entreprise || prospect.company}
                  sx={{ width: 64, height: 64, bgcolor: '#f5f5f7', fontSize: 32, mr: 2 }}
                >
                  {(prospect.nom || prospect.entreprise || prospect.company || '?').charAt(0)}
                </Avatar>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '2rem', color: '#000' }}>
                      {prospect?.nom || prospect?.entreprise || prospect?.company || 'Nom non spécifié'}
                    </Typography>
                    {isEditing ? (
                      <Select
                        value={editedProspect.statut || 'non_qualifie'}
                        onChange={(e) => handleChange('statut')(e as any)}
                        size="small"
                        sx={{
                          minWidth: 150,
                          '& .MuiSelect-select': {
                            py: 0.5
                          }
                        }}
                      >
                        <MenuItem value="non_qualifie">Non qualifié</MenuItem>
                        <MenuItem value="contacte">Contacté</MenuItem>
                        <MenuItem value="a_recontacter">À recontacter</MenuItem>
                        <MenuItem value="negociation">Négociation</MenuItem>
                        <MenuItem value="abandon">Abandon</MenuItem>
                        <MenuItem value="deja_client">Déjà client</MenuItem>
                      </Select>
                    ) : (
                      <Box
                        sx={{
                          position: 'relative',
                          '&:hover .edit-icon': {
                            opacity: 1
                          }
                        }}
                      >
                        <Chip
                          label={
                            prospect?.statut === 'non_qualifie' ? 'Non qualifié' :
                            prospect?.statut === 'contacte' ? 'Contacté' :
                            prospect?.statut === 'a_recontacter' ? 'À recontacter' :
                            prospect?.statut === 'negociation' ? 'Négociation' :
                            prospect?.statut === 'abandon' ? 'Abandon' :
                            prospect?.statut === 'deja_client' ? 'Déjà client' : 'Non qualifié'
                          }
                          onClick={handleEdit}
                          sx={{
                            backgroundColor: 
                              prospect?.statut === 'non_qualifie' ? '#e0e0e0' :
                              prospect?.statut === 'contacte' ? '#bbdefb' :
                              prospect?.statut === 'a_recontacter' ? '#ffe0b2' :
                              prospect?.statut === 'negociation' ? '#c8e6c9' :
                              prospect?.statut === 'abandon' ? '#ffcdd2' :
                              prospect?.statut === 'deja_client' ? '#c5cae9' : '#e0e0e0',
                            color: 
                              prospect?.statut === 'non_qualifie' ? '#424242' :
                              prospect?.statut === 'contacte' ? '#1565c0' :
                              prospect?.statut === 'a_recontacter' ? '#e65100' :
                              prospect?.statut === 'negociation' ? '#2e7d32' :
                              prospect?.statut === 'abandon' ? '#c62828' :
                              prospect?.statut === 'deja_client' ? '#283593' : '#424242',
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: 
                                prospect?.statut === 'non_qualifie' ? '#bdbdbd' :
                                prospect?.statut === 'contacte' ? '#90caf9' :
                                prospect?.statut === 'a_recontacter' ? '#ffcc80' :
                                prospect?.statut === 'negociation' ? '#a5d6a7' :
                                prospect?.statut === 'abandon' ? '#ef9a9a' :
                                prospect?.statut === 'deja_client' ? '#9fa8da' : '#bdbdbd'
                            }
                          }}
                        />
                        <EditIcon
                          className="edit-icon"
                          sx={{
                            position: 'absolute',
                            right: -20,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            opacity: 0,
                            transition: 'opacity 0.2s',
                            color: 'text.secondary',
                            fontSize: 16
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Tooltip title="Ajouter une activité">
                      <IconButton color="primary" onClick={() => setActivityDialogOpen(true)}>
                        <AssignmentIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Ajouter un rappel">
                      <IconButton color="primary" onClick={() => { setSelectedActivityType('reminder'); setReminderDialogOpen(true); }}>
                        <NotificationsIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Créer une note">
                      <IconButton color="primary" onClick={() => { setSelectedActivityType('note'); setNoteDialogOpen(true); }}>
                        <NoteAddIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Uploader un mail">
                      <IconButton color="primary" onClick={() => { setSelectedActivityType('mail_upload'); setMailDialogOpen(true); }}>
                        <EmailIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Supprimer le prospect">
                      <IconButton 
                        color="error" 
                        onClick={() => setDeleteDialogOpen(true)}
                        sx={{ 
                          '&:hover': {
                            backgroundColor: 'rgba(211, 47, 47, 0.04)'
                          }
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="textSecondary">
                      Propriétaire :
                    </Typography>
                    {isEditing ? (
                      <Autocomplete
                        options={structureMembers
                          .filter(m => m.poles?.some(p => p.poleId === 'dev'))
                          .sort((a, b) => {
                            const mandatA = a.mandat || '';
                            const mandatB = b.mandat || '';
                            if (mandatA !== mandatB) return mandatB.localeCompare(mandatA);
                            return a.displayName.localeCompare(b.displayName);
                          })
                        }
                        groupBy={(option) => option.mandat ? `Mandat ${option.mandat}` : 'Autres'}
                        getOptionLabel={(option) => option.displayName}
                        value={structureMembers.find(m => m.id === editedProspect.ownerId) || null}
                        onChange={(_, newValue) => {
                          setEditedProspect(prev => ({ ...prev, ownerId: newValue?.id }));
                        }}
                        renderInput={(params) => (
                          <TextField 
                            {...params} 
                            size="small" 
                            variant="standard" 
                            placeholder="Assigner à..." 
                            sx={{ minWidth: 150 }}
                          />
                        )}
                        size="small"
                        sx={{ width: 200 }}
                      />
                    ) : (
                      <Chip 
                        avatar={<Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem' }}>{(structureMembers.find(m => m.id === prospect?.ownerId)?.displayName || '?').charAt(0)}</Avatar>}
                        label={structureMembers.find(m => m.id === prospect?.ownerId)?.displayName || 'Non assigné'} 
                        size="small" 
                        variant="outlined"
                        onClick={handleEdit}
                      />
                    )}
                  </Box>
                </Box>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                  {isEditing && (
                    <Button
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={handleSave}
                      sx={{ 
                        bgcolor: '#0071e3',
                        color: 'white',
                        '&:hover': { bgcolor: '#0077ed' }
                      }}
                    >
                      Enregistrer
                    </Button>
                  )}
                  <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate('/app/commercial')}
                    sx={{ color: 'text.secondary' }}
                  >
                    Retour
                  </Button>
                </Box>
              </Box>

              <Grid container spacing={3}>
                {/* Colonne gauche */}
                <Grid item xs={12} md={4}>
                  {/* Bloc contact */}
                  <Paper sx={{ p: 2, mb: 2, borderRadius: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <PersonIcon sx={{ color: '#0071e3', mr: 1 }} />
                        <Typography variant="subtitle1" fontWeight={600}>Contact</Typography>
                    </Box>
                      {!isEditing ? (
                        <IconButton 
                          color="primary" 
                          size="small"
                          onClick={handleEdit}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      ) : (
                        <IconButton 
                          color="primary" 
                          size="small"
                          onClick={handleSave}
                        >
                          <SaveIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                    <Divider sx={{ mb: 1 }} />
                    <List dense>
                      {isEditing ? (
                        <>
                          <ListItem>
                            <ListItemText 
                              primary="Nom"
                              secondary={
                                <TextField
                                  fullWidth
                                  variant="standard"
                                  value={editedProspect.nom || ''}
                                  onChange={handleChange('nom')}
                                  size="small"
                                  sx={{ mt: 1 }}
                                  InputProps={{
                                    style: { fontSize: 'inherit' }
                                  }}
                                />
                              }
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText 
                              primary="Poste"
                              secondary={
                                <TextField
                                  fullWidth
                                  variant="standard"
                                  value={editedProspect.title || ''}
                                  onChange={handleChange('title')}
                                  size="small"
                                  sx={{ mt: 1 }}
                                  InputProps={{
                                    style: { fontSize: 'inherit' }
                                  }}
                                />
                              }
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText 
                              primary="Entreprise"
                              secondary={
                                <TextField
                                  fullWidth
                                  variant="standard"
                                  value={editedProspect.entreprise || editedProspect.company || ''}
                                  onChange={(e) => {
                                    setEditedProspect(prev => ({
                                      ...prev,
                                      entreprise: e.target.value,
                                      company: e.target.value
                                    }));
                                  }}
                                  size="small"
                                  sx={{ mt: 1 }}
                                  InputProps={{
                                    style: { fontSize: 'inherit' }
                                  }}
                                />
                              }
                            />
                          </ListItem>
                          {prospect.linkedinUrl && (
                            <ListItem>
                              <ListItemText 
                                primary="LinkedIn" 
                                secondary={
                                  <a 
                                    href={prospect.linkedinUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{ color: '#0071e3', textDecoration: 'none' }}
                                  >
                                    Voir le profil LinkedIn
                                  </a>
                                } 
                              />
                            </ListItem>
                          )}
                          <ListItem>
                            <ListItemText 
                              primary="Téléphone"
                              secondary={
                                <TextField
                                  fullWidth
                                  variant="standard"
                                  value={editedProspect.telephone || ''}
                                  onChange={handleChange('telephone')}
                                  size="small"
                                  sx={{ mt: 1 }}
                                  InputProps={{
                                    style: { fontSize: 'inherit' }
                                  }}
                                />
                              }
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText 
                              primary="Email"
                              secondary={
                                <TextField
                                  fullWidth
                                  variant="standard"
                                  value={editedProspect.email || ''}
                                  onChange={handleChange('email')}
                                  size="small"
                                  sx={{ mt: 1 }}
                                  InputProps={{
                                    style: { fontSize: 'inherit' }
                                  }}
                                />
                              }
                            />
                          </ListItem>
                        </>
                      ) : (
                        <>
                          {renderIf('Nom', prospect.nom)}
                          {renderIf('Poste', prospect.title)}
                          {renderIf('Entreprise', capitalizeWords(prospect.entreprise || prospect.company || ''))}
                          {prospect.linkedinUrl && (
                            <ListItem>
                              <ListItemText 
                                primary="LinkedIn" 
                                secondary={
                                  <a 
                                    href={prospect.linkedinUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{ color: '#0071e3', textDecoration: 'none' }}
                                  >
                                    Voir le profil LinkedIn
                                  </a>
                                } 
                              />
                            </ListItem>
                          )}
                          <ListItem>
                            <ListItemText 
                              primary="Téléphone" 
                              secondary={prospect.telephone || 'Non renseigné'} 
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText 
                              primary="Email" 
                              secondary={prospect.email || 'Non renseigné'} 
                            />
                          </ListItem>
                        </>
                      )}
                    </List>
                  </Paper>
                </Grid>

                {/* Colonne droite */}
                <Grid item xs={12} md={8}>
                  {/* Premier groupe - Détails */}
                  <Paper sx={{ p: 2, borderRadius: 3, mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <NoteIcon sx={{ color: '#0071e3', mr: 1 }} />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Détails du contact
                      </Typography>
                    </Box>
                    <List dense>
                      {isEditingStatus ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Select
                            value={editedProspect.statut || 'non_qualifie'}
                            onChange={(e) => handleChange('statut')(e as any)}
                            size="small"
                            sx={{
                              minWidth: 150,
                              '& .MuiSelect-select': {
                                py: 0.5
                              }
                            }}
                          >
                            <MenuItem value="non_qualifie">Non qualifié</MenuItem>
                            <MenuItem value="contacte">Contacté</MenuItem>
                            <MenuItem value="a_recontacter">À recontacter</MenuItem>
                            <MenuItem value="negociation">Négociation</MenuItem>
                            <MenuItem value="abandon">Abandon</MenuItem>
                            <MenuItem value="deja_client">Déjà client</MenuItem>
                          </Select>
                          <IconButton 
                            color="primary" 
                            size="small"
                            onClick={handleSaveStatus}
                            sx={{ 
                              backgroundColor: 'primary.main',
                              color: 'white',
                              '&:hover': {
                                backgroundColor: 'primary.dark'
                              }
                            }}
                          >
                            <SaveIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ) : (
                        <ListItem>
                          <ListItemText 
                            primary="Statut" 
                            secondary={
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1
                                }}
                              >
                                <Typography variant="body2" color="text.secondary">
                                  {prospect?.statut === 'non_qualifie' ? 'Non qualifié' :
                                   prospect?.statut === 'contacte' ? 'Contacté' :
                                   prospect?.statut === 'a_recontacter' ? 'À recontacter' :
                                   prospect?.statut === 'negociation' ? 'Négociation' :
                                   prospect?.statut === 'abandon' ? 'Abandon' :
                                   prospect?.statut === 'deja_client' ? 'Déjà client' : 'Non qualifié'}
                                </Typography>
                                <IconButton 
                                  size="small" 
                                  onClick={handleEditStatus}
                                  sx={{ 
                                    opacity: 0,
                                    transition: 'opacity 0.2s',
                                    '&:hover': {
                                      opacity: 1
                                    }
                                  }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            }
                          />
                        </ListItem>
                      )}
                      {renderIf('Valeur potentielle', prospect.valeurPotentielle ? `${prospect.valeurPotentielle} €` : undefined)}
                      {renderIf('Date d\'ajout', formatDate(prospect.dateCreation))}
                      {renderIf('Dernière interaction', formatDate(prospect.derniereInteraction))}
                      {prospect.dateRecontact ? (
                        <ListItem>
                          {isEditing ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                              <TextField
                                type="date"
                                value={editedProspect.dateRecontact || prospect.dateRecontact}
                                onChange={(e) => setEditedProspect(prev => ({ ...prev, dateRecontact: e.target.value }))}
                                size="small"
                                sx={{ flex: 1 }}
                              />
                              <IconButton 
                                size="small"
                                onClick={async () => {
                                  const oldDate = prospect.dateRecontact;
                                  const newDate = editedProspect.dateRecontact;
                                  if (newDate && newDate !== oldDate) {
                                    try {
                                      await updateDoc(doc(db, 'prospects', id!), {
                                        dateRecontact: newDate,
                                        updatedAt: serverTimestamp()
                                      });
                                      
                                      // Enregistrer dans l'activité
                                      await saveActivity({
                                        type: 'modification',
                                        userId: userData?.uid || '',
                                        userName: userData?.displayName || 'Utilisateur inconnu',
                                        details: {
                                          field: 'Date de relance',
                                          oldValue: oldDate ? formatDate(oldDate) : 'Aucune',
                                          newValue: formatDate(newDate)
                                        },
                                        timestamp: serverTimestamp()
                                      });
                                      
                                      setProspect(prev => prev ? { ...prev, dateRecontact: newDate } : null);
                                      setEditedProspect(prev => ({ ...prev, dateRecontact: undefined }));
                                    } catch (err) {
                                      console.error('Erreur lors de la mise à jour de la date de relance:', err);
                                    }
                                  }
                                }}
                                sx={{ color: '#0071e3' }}
                              >
                                <CheckCircleIcon />
                              </IconButton>
                              <IconButton 
                                size="small"
                                onClick={() => {
                                  setEditedProspect(prev => ({ ...prev, dateRecontact: undefined }));
                                }}
                              >
                                <CloseIcon />
                              </IconButton>
                            </Box>
                          ) : (
                            <>
                              <ListItemText 
                                primary="Date de relance" 
                                secondary={formatDate(prospect.dateRecontact)} 
                              />
                              <IconButton 
                                size="small"
                                onClick={() => {
                                  setEditedProspect(prev => ({ ...prev, dateRecontact: prospect.dateRecontact }));
                                }}
                                sx={{ opacity: 0, transition: 'opacity 0.2s', '&:hover': { opacity: 1 } }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </>
                          )}
                        </ListItem>
                      ) : (
                        isEditing && (
                          <ListItem>
                            <ListItemText 
                              primary="Date de relance" 
                              secondary="Non définie" 
                            />
                            <TextField
                              type="date"
                              value={editedProspect.dateRecontact || ''}
                              onChange={(e) => setEditedProspect(prev => ({ ...prev, dateRecontact: e.target.value }))}
                              size="small"
                              sx={{ minWidth: 150 }}
                            />
                          </ListItem>
                        )
                      )}
                      {renderIf('Adresse', prospect.adresse)}
                      {renderIf('Secteur', prospect.secteur)}
                      {renderIf('Source', prospect.source)}
                    </List>
                  </Paper>

                  {/* Deuxième groupe - Activité */}
                  <Paper sx={{ p: 2, borderRadius: 3, bgcolor: 'transparent', boxShadow: 'none' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <AssignmentIcon sx={{ color: '#0071e3', mr: 1 }} />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Activité
                      </Typography>
                    </Box>
                    <Box sx={{ position: 'relative', pl: 3 }}>
                      {/* Timeline verticale */}
                      <Box sx={{
                        position: 'absolute',
                        left: 18,
                        top: 0,
                        bottom: 0,
                        width: 2,
                        bgcolor: '#e0e3e7',
                        zIndex: 0
                      }} />
                      <Box>
                        {filteredActivities.map((activity, idx) => {
                          // Définir l'icône et la couleur selon le type
                          let icon, iconBg, title;
                          switch (activity.type) {
                            case 'creation':
                              icon = <PersonIcon sx={{ color: '#fff' }} />;
                              iconBg = '#0071e3';
                              title = 'Contact créé';
                              break;
                            case 'modification':
                              icon = <EditIcon sx={{ color: '#fff' }} />;
                              iconBg = '#6366f1';
                              // Le titre sera ajusté plus tard si c'est un changement de statut ou de date de relance
                              title = activity.details?.field === 'Statut' ? 'Changement de status' :
                                      activity.details?.field === 'Date de relance' ? 'Date de relance modifiée' :
                                      'Contact modifié';
                              break;
                            case 'email':
                              icon = <EmailIcon sx={{ color: '#fff' }} />;
                              iconBg = '#ff9800';
                              title = 'Email envoyé';
                              break;
                            case 'call':
                              icon = <CallIcon sx={{ color: '#fff' }} />;
                              iconBg = '#2196f3';
                              title = 'Appel passé';
                              break;
                            case 'note':
                              icon = <NoteIcon sx={{ color: '#fff' }} />;
                              iconBg = '#607d8b';
                              title = 'Note ajoutée';
                              break;
                            case 'reminder':
                              icon = <NotificationsIcon sx={{ color: '#fff' }} />;
                              iconBg = '#00bcd4';
                              title = 'Rappel créé';
                              break;
                            case 'mail_upload':
                              icon = <UploadIcon sx={{ color: '#fff' }} />;
                              iconBg = '#8bc34a';
                              title = 'Mail uploadé';
                              break;
                            case 'linkedin_request':
                              icon = <LinkIcon sx={{ color: '#fff' }} />;
                              iconBg = '#0a66c2';
                              title = 'Demande LinkedIn';
                              break;
                            case 'linkedin_message':
                              icon = <LanguageIcon sx={{ color: '#fff' }} />;
                              iconBg = '#0a66c2';
                              title = 'Message LinkedIn';
                              break;
                            default:
                              icon = <AssignmentIcon sx={{ color: '#fff' }} />;
                              iconBg = '#bdbdbd';
                              title = 'Activité';
                          }
                          // Date formatée
                          let date;
                          if (activity.type === 'creation' && prospect?.dateCreation) {
                            date = parseDate(prospect.dateCreation);
                          } else {
                            date = parseDate(activity.timestamp);
                          }
                          const formattedDate = date ? new Intl.DateTimeFormat('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Europe/Paris'
                          }).format(date) : 'Date invalide';
                          // Détails
                          let details = '';
                          if (activity.type === 'note') details = activity.details?.noteContent || '';
                          if (activity.type === 'email') details = activity.details?.emailContent || '';
                          if (activity.type === 'call') details = activity.details?.callDuration ? `Durée : ${activity.details.callDuration} min` : '';
                          if (activity.type === 'reminder') details = activity.details?.reminderTitle ? `Titre : ${activity.details.reminderTitle}` : '';
                          if (activity.type === 'modification' && activity.details?.field) {
                            const fieldName = activity.details.field;
                            const oldValue = activity.details.oldValue || 'Non défini';
                            const newValue = activity.details.newValue || 'Non défini';
                            
                            // Traduire les valeurs de statut
                            const translateStatus = (status: string) => {
                              const statusMap: Record<string, string> = {
                                'non_qualifie': 'Non qualifié',
                                'contacte': 'Contacté',
                                'a_recontacter': 'À recontacter',
                                'negociation': 'Négociation',
                                'abandon': 'Abandon',
                                'deja_client': 'Déjà client'
                              };
                              return statusMap[status] || status;
                            };
                            
                            if (fieldName === 'Statut') {
                              details = `${translateStatus(oldValue)} -> ${translateStatus(newValue)}`;
                              // Mettre à jour le titre pour les changements de statut
                              title = 'Changement de status';
                            } else if (fieldName === 'Date de relance') {
                              details = `Date de relance changée : ${oldValue} -> ${newValue}`;
                              // Mettre à jour le titre pour les changements de date de relance
                              title = 'Date de relance modifiée';
                            } else {
                              details = `${fieldName} : ${oldValue} -> ${newValue}`;
                            }
                          }
                          if (activity.type === 'mail_upload') {
                            if (activity.details?.mailFile && (activity.details.mailFile.endsWith('.png') || activity.details.mailFile.endsWith('.jpg') || activity.details.mailFile.endsWith('.jpeg') || activity.details.mailFile.endsWith('.gif') || activity.details.mailFile.endsWith('.webp'))) {
                              details = `<img src='${activity.details.mailFile}' alt='Pièce jointe' style='max-width:100px;max-height:100px;border-radius:8px;margin-top:4px;' />`;
                            } else if (activity.details?.mailFile && (activity.details.mailFile.endsWith('.pdf') || activity.details.mailFile.endsWith('.eml'))) {
                              details = `<a href='${activity.details.mailFile}' target='_blank' rel='noopener noreferrer'>Télécharger le fichier</a>`;
                            } else if (activity.details?.mailFile) {
                              details = `<a href='${activity.details.mailFile}' target='_blank' rel='noopener noreferrer'>Voir le fichier</a>`;
                            }
                          }
                          return (
                            <Box key={activity.id} sx={{ display: 'flex', alignItems: 'flex-start', mb: 2, position: 'relative' }}>
                              {/* Pastille icône */}
                              <Box sx={{
                                zIndex: 1,
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                bgcolor: iconBg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 8px 0 rgba(0,0,0,0.08)',
                                position: 'absolute',
                                left: -34,
                                top: 8
                              }}>
                                {icon}
                              </Box>
                              {/* Carte activité */}
                              <Paper elevation={1} sx={{
                                flex: 1,
                                ml: 2,
                                p: 2,
                                borderRadius: 2,
                                minWidth: 0,
                                bgcolor: '#fff',
                                boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 0.5
                              }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '1rem' }}>{title}</Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ ml: 2, whiteSpace: 'nowrap' }}>{formattedDate}</Typography>
                                </Box>
                                {details && activity.type === 'mail_upload' ? (
                                  <Box sx={{ mt: 0.5 }} dangerouslySetInnerHTML={{ __html: details }} />
                                ) : details && (
                                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{details}</Typography>
                                )}
                                <Typography variant="caption" color="text.disabled" sx={{ mt: 1 }}>
                                  {activity.userName ? `Par ${activity.userName}` : ''}
                                </Typography>
                              </Paper>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>

              <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
              >
                <DialogTitle>
                  Confirmer la suppression
                </DialogTitle>
                <DialogContent>
                  Êtes-vous sûr de vouloir supprimer ce prospect ? Cette action est irréversible.
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setDeleteDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleDelete} color="error">
                    Supprimer
                  </Button>
                </DialogActions>
              </Dialog>

              {/* Dialog pour ajouter une activité */}
              <Dialog 
                open={activityDialogOpen} 
                onClose={() => setActivityDialogOpen(false)}
                PaperProps={{
                  sx: {
                    borderRadius: 3,
                    width: '100%',
                    maxWidth: '400px',
                    boxShadow: 'none',
                    border: '1px solid rgba(0, 0, 0, 0.1)'
                  }
                }}
              >
                <DialogTitle sx={{ 
                  fontSize: '1.2rem', 
                  fontWeight: 600,
                  borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                  pb: 2
                }}>
                  Ajouter une activité
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                  <FormControl fullWidth sx={{ mt: 2 }}>
                    <InputLabel>Type d'activité</InputLabel>
                    <Select
                      value={selectedActivityType}
                      onChange={(e) => setSelectedActivityType(e.target.value)}
                      label="Type d'activité"
                      sx={{
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(0, 0, 0, 0.1)',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(0, 0, 0, 0.2)',
                        },
                      }}
                    >
                      <MenuItem value="email">Email envoyé</MenuItem>
                      <MenuItem value="call">Appel passé</MenuItem>
                      <MenuItem value="linkedin_request">Demande de connexion LinkedIn</MenuItem>
                      <MenuItem value="linkedin_message">Message LinkedIn envoyé</MenuItem>
                    </Select>
                  </FormControl>
                  {selectedActivityType === 'email' && (
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label="Contenu de l'email"
                      value={emailContent}
                      onChange={(e) => setEmailContent(e.target.value)}
                      sx={{ mt: 2 }}
                    />
                  )}
                  {selectedActivityType === 'call' && (
                    <TextField
                      fullWidth
                      type="number"
                      label="Durée de l'appel (minutes)"
                      value={callDuration}
                      onChange={(e) => setCallDuration(e.target.value)}
                      sx={{ mt: 2 }}
                    />
                  )}
                </DialogContent>
                <DialogActions sx={{ 
                  p: 3, 
                  borderTop: '1px solid rgba(0, 0, 0, 0.1)',
                  gap: 1
                }}>
                  <Button 
                    onClick={() => setActivityDialogOpen(false)}
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)'
                      }
                    }}
                  >
                    Annuler
                  </Button>
                  <Button 
                    onClick={handleActivitySubmit} 
                    variant="contained"
                    sx={{
                      backgroundColor: '#0071e3',
                      '&:hover': {
                        backgroundColor: '#0077ed'
                      },
                      '&.MuiButton-contained': {
                        animation: 'none'
                      },
                      '&.MuiButton-contained:active': {
                        animation: 'applePayAnimation 0.3s ease-in-out'
                      }
                    }}
                  >
                    Enregistrer
                  </Button>
                </DialogActions>
              </Dialog>

              {/* Dialog pour ajouter un rappel */}
              <Dialog 
                open={reminderDialogOpen} 
                onClose={() => setReminderDialogOpen(false)}
                PaperProps={{
                  sx: {
                    borderRadius: 3,
                    width: '100%',
                    maxWidth: '400px',
                    boxShadow: 'none',
                    border: '1px solid rgba(0, 0, 0, 0.1)'
                  }
                }}
              >
                <DialogTitle sx={{ 
                  fontSize: '1.2rem', 
                  fontWeight: 600,
                  borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                  pb: 2
                }}>
                  Ajouter un rappel
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                  <TextField
                    fullWidth
                    label="Titre du rappel"
                    value={reminderTitle}
                    onChange={(e) => setReminderTitle(e.target.value)}
                    sx={{ mt: 2 }}
                  />
                  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
                    <Box sx={{ mt: 2, width: '100%' }}>
                      <DateTimePicker
                        label="Date et heure"
                        value={reminderDate}
                        onChange={(newValue: Date | null) => setReminderDate(newValue)}
                        renderInput={(params) => <TextField {...params} fullWidth />}
                      />
                    </Box>
                  </LocalizationProvider>
                </DialogContent>
                <DialogActions sx={{ 
                  p: 3, 
                  borderTop: '1px solid rgba(0, 0, 0, 0.1)',
                  gap: 1
                }}>
                  <Button 
                    onClick={() => setReminderDialogOpen(false)}
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)'
                      }
                    }}
                  >
                    Annuler
                  </Button>
                  <Button 
                    onClick={handleActivitySubmit} 
                    variant="contained"
                    sx={{
                      backgroundColor: '#0071e3',
                      '&:hover': {
                        backgroundColor: '#0077ed'
                      },
                      '&.MuiButton-contained': {
                        animation: 'none'
                      },
                      '&.MuiButton-contained:active': {
                        animation: 'applePayAnimation 0.3s ease-in-out'
                      }
                    }}
                  >
                    Enregistrer
                  </Button>
                </DialogActions>
              </Dialog>

              {/* Dialog pour créer une note */}
              <Dialog 
                open={noteDialogOpen} 
                onClose={() => setNoteDialogOpen(false)}
                PaperProps={{
                  sx: {
                    borderRadius: 3,
                    width: '100%',
                    maxWidth: '400px',
                    boxShadow: 'none',
                    border: '1px solid rgba(0, 0, 0, 0.1)'
                  }
                }}
              >
                <DialogTitle sx={{ 
                  fontSize: '1.2rem', 
                  fontWeight: 600,
                  borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                  pb: 2
                }}>
                  Créer une note
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Contenu de la note"
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    sx={{ mt: 2 }}
                  />
                </DialogContent>
                <DialogActions sx={{ 
                  p: 3, 
                  borderTop: '1px solid rgba(0, 0, 0, 0.1)',
                  gap: 1
                }}>
                  <Button 
                    onClick={() => setNoteDialogOpen(false)}
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)'
                      }
                    }}
                  >
                    Annuler
                  </Button>
                  <Button 
                    onClick={handleActivitySubmit} 
                    variant="contained"
                    sx={{
                      backgroundColor: '#0071e3',
                      '&:hover': {
                        backgroundColor: '#0077ed'
                      },
                      '&.MuiButton-contained': {
                        animation: 'none'
                      },
                      '&.MuiButton-contained:active': {
                        animation: 'applePayAnimation 0.3s ease-in-out'
                      }
                    }}
                  >
                    Enregistrer
                  </Button>
                </DialogActions>
              </Dialog>

              {/* Dialog pour uploader un mail */}
              <Dialog 
                open={mailDialogOpen} 
                onClose={() => setMailDialogOpen(false)}
                PaperProps={{
                  sx: {
                    borderRadius: 3,
                    width: '100%',
                    maxWidth: '400px',
                    boxShadow: 'none',
                    border: '1px solid rgba(0, 0, 0, 0.1)'
                  }
                }}
              >
                <DialogTitle sx={{ 
                  fontSize: '1.2rem', 
                  fontWeight: 600,
                  borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                  pb: 2
                }}>
                  Uploader un mail
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<UploadIcon />}
                    sx={{
                      width: '100%',
                      mt: 2,
                      borderColor: 'rgba(0, 0, 0, 0.1)',
                      '&:hover': {
                        borderColor: 'rgba(0, 0, 0, 0.2)',
                        backgroundColor: 'rgba(0, 0, 0, 0.04)'
                      }
                    }}
                  >
                    Sélectionner un fichier
                    <input
                      type="file"
                      accept=".eml,application/pdf,image/*"
                      hidden
                      onChange={(e) => {
                        setMailFile(e.target.files?.[0] || null);
                        console.log('Fichier sélectionné :', e.target.files?.[0]);
                      }}
                    />
                  </Button>
                  {mailFile && (
                    <Box sx={{ mt: 2, textAlign: 'center', color: 'text.secondary', fontSize: 14 }}>
                      Fichier sélectionné : {mailFile.name}
                    </Box>
                  )}
                </DialogContent>
                <DialogActions sx={{ 
                  p: 3, 
                  borderTop: '1px solid rgba(0, 0, 0, 0.1)',
                  gap: 1
                }}>
                  <Button 
                    onClick={() => setMailDialogOpen(false)}
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)'
                      }
                    }}
                  >
                    Annuler
                  </Button>
                  <Button 
                    onClick={handleActivitySubmit} 
                    variant="contained"
                    sx={{
                      backgroundColor: '#0071e3',
                      '&:hover': {
                        backgroundColor: '#0077ed'
                      },
                      '&.MuiButton-contained': {
                        animation: 'none'
                      },
                      '&.MuiButton-contained:active': {
                        animation: 'applePayAnimation 0.3s ease-in-out'
                      }
                    }}
                  >
                    Enregistrer
                  </Button>
                </DialogActions>
              </Dialog>

              <style>
                {`
                  @keyframes applePayAnimation {
                    0% {
                      transform: scale(1);
                      opacity: 1;
                    }
                    50% {
                      transform: scale(0.95);
                      opacity: 0.8;
                    }
                    100% {
                      transform: scale(1);
                      opacity: 1;
                    }
                  }
                `}
              </style>
            </Box>
          )}
        </Box>
      </Box>
  );
};

export default ProspectDetails; 