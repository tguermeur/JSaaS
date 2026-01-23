import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Button,
  Avatar,
  CircularProgress,
  Alert,
  Popover,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  SelectChangeEvent,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Tooltip,
  ListSubheader,
  Radio,
  RadioGroup,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  LinearProgress,
  Card,
  Badge,
  Rating,
  Grid,
  Stack,
  Tabs,
  Tab,
  Autocomplete
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import FilterListIcon from '@mui/icons-material/FilterList';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import {
  MoreVert as MoreVertIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  CalendarToday as CalendarIcon,
  Extension as ExtensionIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Storefront as StoreIcon,
  Timer as TimerIcon,
  TrendingUp as TrendingUpIcon,
  CalendarMonth as CalendarMonthIcon,
  ShowChart as ShowChartIcon,
  EmojiEvents as TrophyIcon,
  AccessTime as AccessTimeIcon,
  Edit as EditIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  Close as CloseIcon,
  Category as CategoryIcon,
  Visibility as VisibilityIcon,
  Flag as FlagIcon,
  RocketLaunch as RocketIcon,
  Block as BlockIcon,
  Loop as LoopIcon,
  CloudUpload as CloudUploadIcon,
  Notifications as NotificationsIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { getProspects, createProspect, deleteProspect } from '../firebase/prospects';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, writeBatch, addDoc, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getStructureTokens, StructureTokens } from '../services/tokenService';
import { useNavigate } from 'react-router-dom';
import { downloadExtension } from '../api/extension';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { styled, alpha } from '@mui/material';
import { fadeIn } from '../styles/animations';
import Papa from 'papaparse';

// --- STRICT MODE DROPPABLE FIX ---
// Nécessaire pour React 18 + react-beautiful-dnd
export const StrictModeDroppable = ({ children, ...props }: any) => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);
  if (!enabled) {
    return null;
  }
  return <Droppable {...props}>{children}</Droppable>;
};

// --- CONFIGURATION ---

const PIPELINE_STATUSES = [
  'non_qualifie',
  'contacte',
  'a_recontacter',
  'negociation',
  'abandon',
  'deja_client'
];

// Fonction pour générer les mandats disponibles (2022-2023 jusqu'à l'année en cours)
const generateMandats = (): string[] => {
  const currentYear = new Date().getFullYear();
  const startYear = 2022;
  const mandats: string[] = [];
  
  for (let year = startYear; year <= currentYear; year++) {
    const nextYear = year + 1;
    mandats.push(`${year}-${nextYear}`);
  }
  
  return mandats;
};

const AVAILABLE_MANDATS = generateMandats();

const APPLE_COLORS = {
  primary: '#0071e3',
  secondary: '#86868b',
  background: '#f5f5f7',
  surface: '#ffffff',
  border: '#d2d2d7',
  text: '#1d1d1f',
  error: '#ff3b30',
  success: '#34c759'
};

const APPLE_SHADOWS = {
  small: '0 2px 4px rgba(0, 0, 0, 0.04)',
  medium: '0 4px 8px rgba(0, 0, 0, 0.08)',
  large: '0 8px 16px rgba(0, 0, 0, 0.12)'
};

const APPLE_TRANSITIONS = {
  default: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  fast: 'all 0.1s cubic-bezier(0.4, 0, 0.2, 1)'
};

// --- STYLED COMPONENTS ---

const StyledCard = styled(Paper)(({ theme }) => ({
  borderRadius: '16px',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
  backgroundColor: '#ffffff',
  transition: 'all 0.3s ease-in-out',
  overflow: 'hidden'
}));

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: '12px',
  textTransform: 'none',
  fontWeight: 600,
  padding: '8px 16px',
  boxShadow: 'none',
  '&:hover': {
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    backgroundColor: '#f5f5f7',
    '& fieldset': { border: 'none' },
    '&:hover': { backgroundColor: '#e5e5ea' },
    '&.Mui-focused': { 
      backgroundColor: '#ffffff',
      boxShadow: '0 0 0 2px #0071e3' 
    },
  },
}));

const StyledChip = styled(Chip)(({ theme }) => ({
  borderRadius: '8px',
  fontWeight: 600,
  fontSize: '0.75rem',
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  transition: 'all 0.2s',
  '&:hover': { backgroundColor: '#f5f5f7' },
}));

// --- UTILS ---

const capitalizeWords = (str: string): string => {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const getOwnerDisplayName = (ownerId: string, structureMembers: any[] = []) => {
  const owner = structureMembers.find(m => m.id === ownerId);
  return owner ? owner.displayName : 'Non assigné';
};

// --- TYPES ---

interface Prospect {
  id: string;
  statut: string;
  nom?: string;
  name?: string;
  entreprise?: string;
  company?: string;
  email?: string;
  telephone?: string;
  derniereInteraction?: string;
  dateCreation?: string;
  dateAjout?: string;
  valeurPotentielle?: number;
  ownerId?: string;
  photoUrl?: string;
  adresse?: string;
  secteur?: string;
  taille?: string;
  source?: string;
  notes?: string;
  favori?: boolean;
  structureId?: string;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
  linkedinUrl?: string;
  title?: string;
  location?: string;
  companyLogoUrl?: string;
  dateRecontact?: string;
}

interface StructureMember {
  id: string;
  displayName: string;
  role: 'admin' | 'superadmin' | 'member';
  poles?: { poleId: string }[];
  mandat?: string;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  type: 'meeting' | 'call' | 'task' | 'deadline' | 'salon' | 'reminder';
  visibility: 'private' | 'structure' | 'restricted';
  ownerId: string;
  invitedUsers?: string[];
  description?: string;
  structureId?: string;
  createdBy?: string;
  createdAt?: any;
  prospectId?: string;
  isRelanceReminder?: boolean;
}

// --- COMPONENT ---

const Commercial: React.FC = (): JSX.Element => {
  const { userData, currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Data States
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [structureMembers, setStructureMembers] = useState<StructureMember[]>([]);
  
  // UI States
  const [viewMode, setViewMode] = useState<'pipeline' | 'table' | 'stats'>('pipeline');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showSalonMode, setShowSalonMode] = useState(false);
  
  // Selection & Actions
  const [selectedProspects, setSelectedProspects] = useState<string[]>([]);
  const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'nom', direction: 'asc' });
  
  // Imports
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  
  // Delete Dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Events (Salon Mode)
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    type: 'meeting' as CalendarEvent['type'],
    visibility: 'private' as CalendarEvent['visibility'],
    invitedUsers: [] as string[],
    description: ''
  });
  
  // Pipeline DND State
  const [pipelineColumns, setPipelineColumns] = useState<Record<string, Prospect[]>>({});

  // Objective State
  const [objectiveTarget, setObjectiveTarget] = useState(20);
  const [isEditingObjective, setIsEditingObjective] = useState(false);
  const [tempObjective, setTempObjective] = useState("20");

  // Mandat Filter State (for Stats view)
  const [currentMandatIndex, setCurrentMandatIndex] = useState<number>(0);

  // Agenda State
  const [showFullAgenda, setShowFullAgenda] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editEventDialogOpen, setEditEventDialogOpen] = useState(false);
  
  // Relance Date Popover State
  const [relancePopoverAnchor, setRelancePopoverAnchor] = useState<HTMLElement | null>(null);
  const [relanceProspectId, setRelanceProspectId] = useState<string | null>(null);
  const [relanceDate, setRelanceDate] = useState<string>('');
  const [editEventForm, setEditEventForm] = useState({
    title: '',
    date: '',
    time: '10:00',
    type: 'meeting' as CalendarEvent['type'],
    visibility: 'private' as CalendarEvent['visibility'],
    invitedUsers: [] as string[],
    description: ''
  });

  // New Prospect State
  const [newProspectData, setNewProspectData] = useState<Partial<Prospect>>({
    nom: '',
    entreprise: '',
    email: '',
    telephone: '',
    statut: 'non_qualifie',
    dateRecontact: '',
    notes: '',
    ownerId: userData?.uid
  });

  // Tokens State
  const [structureTokens, setStructureTokens] = useState<StructureTokens | null>(null);
  const [tokensLoading, setTokensLoading] = useState(false);

  // Effect to update ownerId when userData is loaded
  useEffect(() => {
    if (userData?.uid && !newProspectData.ownerId) {
      setNewProspectData(prev => ({ ...prev, ownerId: userData.uid }));
    }
  }, [userData]);

  // --- DATA FETCHING ---

  const validateStatus = (status: string | undefined): string => {
    if (!status || !PIPELINE_STATUSES.includes(status)) return 'non_qualifie';
    return status;
  };

  const validateProspect = (prospect: Prospect): Prospect => ({
        ...prospect,
        statut: validateStatus(prospect.statut)
  });

  const fetchProspects = useCallback(async () => {
    if (!userData?.structureId) return;
    try {
      setLoading(true);
      const fetchedProspects = await getProspects(userData.structureId, userData.status);
      const validatedProspects = fetchedProspects.map(validateProspect);
      setProspects(validatedProspects);
      
      const newPipelineColumns: Record<string, Prospect[]> = {};
      PIPELINE_STATUSES.forEach(status => {
        newPipelineColumns[status] = validatedProspects.filter(p => validateStatus(p.statut) === status);
      });
      setPipelineColumns(newPipelineColumns);
    } catch (err) {
      console.error(err);
      setError("Erreur chargement prospects");
    } finally {
      setLoading(false);
    }
  }, [userData?.structureId]);

  const fetchStructureMembers = useCallback(async () => {
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
  }, [userData?.structureId]);

  const fetchStructureTokens = useCallback(async () => {
    if (!userData?.structureId) return;
    try {
      setTokensLoading(true);
      const tokens = await getStructureTokens(userData.structureId);
      console.log(`[Commercial] Tokens récupérés pour structure ${userData.structureId}:`, tokens);
      setStructureTokens(tokens);
    } catch (error) {
      console.error('Erreur lors de la récupération des tokens:', error);
    } finally {
      setTokensLoading(false);
    }
  }, [userData?.structureId]);

  const fetchCalendarEvents = useCallback(async () => {
    if (!userData?.structureId) return;
    try {
      const eventsRef = collection(db, 'calendarEvents');
      // Essayer d'abord avec orderBy sur 'start', sinon récupérer sans tri et trier manuellement
      let eventsSnapshot;
      try {
        const eventsQuery = query(
          eventsRef, 
          where('structureId', '==', userData.structureId),
          orderBy('createdAt', 'desc')
        );
        eventsSnapshot = await getDocs(eventsQuery);
      } catch (orderByError) {
        // Si orderBy échoue, récupérer sans tri
        const eventsQuery = query(
          eventsRef, 
          where('structureId', '==', userData.structureId)
        );
        eventsSnapshot = await getDocs(eventsQuery);
      }

      const eventsList: CalendarEvent[] = eventsSnapshot.docs.map(doc => {
        const data = doc.data();
        // Construire start et end à partir des données disponibles
        let start = '';
        let end = '';
        
        if (data.start) {
          start = data.start;
        } else if (data.startDate && data.startTime) {
          start = `${data.startDate}T${data.startTime}`;
        } else if (data.startDate) {
          start = `${data.startDate}T10:00`;
        }
        
        if (data.end) {
          end = data.end;
        } else if (data.endDate && data.endTime) {
          end = `${data.endDate}T${data.endTime}`;
        } else if (data.endDate) {
          end = `${data.endDate}T11:00`;
        } else if (start) {
          // Si pas de end, utiliser start + 1h
          const startDate = new Date(start);
          startDate.setHours(startDate.getHours() + 1);
          end = startDate.toISOString();
        }
        
        return {
          id: doc.id,
          title: data.title || '',
          start: start,
          end: end,
          type: (data.type || 'meeting') as CalendarEvent['type'],
          visibility: (data.visibility || 'private') as CalendarEvent['visibility'],
          ownerId: data.ownerId || data.createdBy || '',
          invitedUsers: data.invitedUsers || [],
          description: data.description || '',
          structureId: data.structureId || userData.structureId,
          createdBy: data.createdBy || '',
          createdAt: data.createdAt,
          prospectId: data.prospectId,
          isRelanceReminder: data.isRelanceReminder || false
        };
      });

      // Trier les événements par date de début
      eventsList.sort((a, b) => {
        const dateA = new Date(a.start).getTime();
        const dateB = new Date(b.start).getTime();
        return dateA - dateB;
      });

      setEvents(eventsList);
    } catch (error) {
      console.error('Erreur lors du chargement des événements:', error);
    }
  }, [userData?.structureId]);

  // Fonction pour convertir les dates de relance en événements de calendrier
  // DÉSACTIVÉ : Les événements sont maintenant créés uniquement dans Firestore lors de la sauvegarde de la date
  const getRelanceEvents = useCallback(() => {
    // Ne plus générer d'événements dynamiquement depuis les prospects
    // Les événements de relance sont créés dans Firestore lors de handleSaveRelanceDate
    return [];
  }, []);

  useEffect(() => {
    if (userData?.structureId) {
      fetchProspects();
      fetchStructureMembers();
      fetchCalendarEvents();
      fetchStructureTokens();
    }
  }, [fetchProspects, fetchStructureMembers, fetchCalendarEvents, fetchStructureTokens, userData]);

  // --- ACTIONS HANDLERS ---

  const handleCreateProspect = async () => {
    try {
      console.log('[Commercial] handleCreateProspect appelé');
      console.log('[Commercial] userData:', userData);
      console.log('[Commercial] structureTokens avant création:', structureTokens);
      
      const prospectData = {
        ...newProspectData,
        statut: 'non_qualifie',
        structureId: userData?.structureId || '',
        createdBy: userData?.uid || '',
        dateAjout: new Date().toISOString(),
        dateCreation: new Date().toISOString(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      console.log('[Commercial] Données du prospect à créer:', prospectData);
      
      await createProspect(prospectData as any);
      console.log('[Commercial] Prospect créé avec succès');
      
      setIsCreateDialogOpen(false);
      
      // Attendre un peu pour que Firestore se synchronise
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('[Commercial] Rafraîchissement des données...');
      await fetchProspects();
      // Rafraîchir les tokens après création
      await fetchStructureTokens();
      console.log('[Commercial] structureTokens après rafraîchissement:', structureTokens);
      setNewProspectData({
        nom: '',
        entreprise: '',
        email: '',
        telephone: '',
        statut: 'non_qualifie',
        dateRecontact: '',
        notes: '',
        ownerId: userData?.uid
      });
    } catch (error: any) {
      console.error('Erreur création prospect:', error);
      // Message d'erreur plus clair pour les erreurs de quota
      let errorMessage = error.message || 'Erreur lors de la création du prospect';
      if (error.message && (error.message.includes('token') || error.message.includes('Quota') || error.message.includes('quota'))) {
        errorMessage = `❌ Quota mensuel de tokens atteint. Impossible d'ajouter un prospect. Vous pourrez créer de nouveaux prospects le mois prochain.`;
      }
      setError(errorMessage);
      // Afficher l'erreur pendant 8 secondes pour les erreurs de quota
      setTimeout(() => setError(null), errorMessage.includes('Quota') ? 8000 : 5000);
    }
  };

  const handleSaveObjective = () => {
    // TODO: Sauvegarder dans Firestore (structure settings)
    setObjectiveTarget(parseInt(tempObjective) || 20);
    setIsEditingObjective(false);
  };

  const handleCreateEvent = async () => {
    if (!currentUser || !userData?.structureId || !newEvent.title || !newEvent.date) {
      alert('Veuillez remplir au moins le titre et la date');
      return;
    }

    try {
      // Sécurisation de l'heure
      const time = newEvent.time || '10:00';
      const hourStr = time.split(':')[0];
      const hour = parseInt(hourStr) || 10;
      const nextHour = (hour + 1).toString().padStart(2, '0');
      const minute = time.split(':')[1] || '00';

      const startDateTime = `${newEvent.date}T${time}`;
      const endDateTime = `${newEvent.date}T${nextHour}:${minute}`;

      // Créer l'événement dans Firestore
      const eventData = {
        title: newEvent.title,
        startDate: newEvent.date,
        startTime: time,
        start: startDateTime,
        endDate: newEvent.date,
        endTime: `${nextHour}:${minute}`,
        end: endDateTime,
        type: newEvent.type,
        visibility: newEvent.visibility,
        ownerId: currentUser.uid,
        invitedUsers: newEvent.invitedUsers || [],
        description: newEvent.description || '',
        structureId: userData.structureId,
        createdBy: currentUser.uid,
        createdAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'calendarEvents'), eventData);

      // Ajouter l'événement à l'état local avec l'ID Firestore
      const newCalendarEvent: CalendarEvent = {
        id: docRef.id,
        title: newEvent.title,
        start: startDateTime,
        end: endDateTime,
        type: newEvent.type,
        visibility: newEvent.visibility,
        ownerId: currentUser.uid,
        invitedUsers: newEvent.invitedUsers,
        description: newEvent.description,
        structureId: userData.structureId,
        createdBy: currentUser.uid,
        createdAt: Timestamp.now()
      };
      
      setEvents([...events, newCalendarEvent]);
      
      // Recharger les événements depuis Firestore pour s'assurer de la cohérence
      await fetchCalendarEvents();
      
      // Reset form
      setNewEvent({
        title: '',
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        type: 'meeting',
        visibility: 'private',
        invitedUsers: [],
        description: ''
      });
    } catch (error) {
      console.error('Erreur lors de la création de l\'événement:', error);
      alert('Erreur lors de la création de l\'événement');
    }
  };

  const handleEditEvent = (event: CalendarEvent) => {
    // Extraire la date et l'heure du format ISO
    const startDate = new Date(event.start);
    const dateStr = startDate.toISOString().split('T')[0];
    const timeStr = startDate.toTimeString().slice(0, 5);
    
    setEditEventForm({
      title: event.title || '',
      date: dateStr,
      time: timeStr,
      type: event.type || 'meeting',
      visibility: event.visibility || 'private',
      invitedUsers: event.invitedUsers || [],
      description: event.description || ''
    });
    setEditingEvent(event);
    setEditEventDialogOpen(true);
  };

  const handleUpdateEvent = async () => {
    if (!editingEvent || !currentUser || !userData?.structureId || !editEventForm.title || !editEventForm.date) {
      alert('Veuillez remplir au moins le titre et la date');
      return;
    }

    try {
      // Sécurisation de l'heure
      const time = editEventForm.time || '10:00';
      const hourStr = time.split(':')[0];
      const hour = parseInt(hourStr) || 10;
      const nextHour = (hour + 1).toString().padStart(2, '0');
      const minute = time.split(':')[1] || '00';

      const startDateTime = `${editEventForm.date}T${time}`;
      const endDateTime = `${editEventForm.date}T${nextHour}:${minute}`;

      // Mettre à jour l'événement dans Firestore
      const eventRef = doc(db, 'calendarEvents', editingEvent.id);
      const updateData = {
        title: editEventForm.title,
        startDate: editEventForm.date,
        startTime: time,
        start: startDateTime,
        endDate: editEventForm.date,
        endTime: `${nextHour}:${minute}`,
        end: endDateTime,
        type: editEventForm.type,
        visibility: editEventForm.visibility,
        invitedUsers: editEventForm.invitedUsers || [],
        description: editEventForm.description || '',
        updatedAt: serverTimestamp()
      };

      await updateDoc(eventRef, updateData);

      // Recharger les événements depuis Firestore
      await fetchCalendarEvents();

      // Fermer le dialog
      setEditEventDialogOpen(false);
      setEditingEvent(null);
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'événement:', error);
      alert('Erreur lors de la mise à jour de l\'événement');
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent) return;
    
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet événement ?')) {
      return;
    }

    try {
      // Vérifier si c'est un événement de relance (généré depuis prospect ou créé dans Firestore)
      const isRelanceEvent = editingEvent.id.startsWith('relance-') || editingEvent.isRelanceReminder || editingEvent.prospectId;
      
      if (isRelanceEvent) {
        // Si c'est un événement généré depuis prospect (ID commence par relance-)
        if (editingEvent.id.startsWith('relance-')) {
          const prospectId = editingEvent.id.replace('relance-', '');
          // Supprimer la dateRecontact du prospect
          await updateDoc(doc(db, 'prospects', prospectId), {
            dateRecontact: null,
            updatedAt: serverTimestamp()
          });
          
          // Mettre à jour l'état local du prospect
          setProspects(prev => prev.map(p => 
            p.id === prospectId ? { ...p, dateRecontact: undefined } : p
          ));
        }
        
        // Supprimer l'événement Firestore correspondant si il existe
        if (editingEvent.prospectId || editingEvent.isRelanceReminder) {
          // Si l'événement a un prospectId ou est marqué comme relance, chercher et supprimer le document Firestore
          const eventsRef = collection(db, 'calendarEvents');
          const eventsQuery = query(
            eventsRef,
            where('structureId', '==', userData?.structureId),
            where('type', '==', 'reminder')
          );
          const eventsSnapshot = await getDocs(eventsQuery);
          
          const prospectId = editingEvent.prospectId || editingEvent.id.replace('relance-', '');
          
          for (const eventDoc of eventsSnapshot.docs) {
            const eventData = eventDoc.data();
            if (eventData.prospectId === prospectId || 
                (eventData.isRelanceReminder && eventData.title?.includes('Relance:'))) {
              await deleteDoc(eventDoc.ref);
              break;
            }
          }
        }
      } else {
        // Pour les événements normaux (non-relance), supprimer le document Firestore
        await deleteDoc(doc(db, 'calendarEvents', editingEvent.id));
      }

      // Recharger les événements depuis Firestore
      await fetchCalendarEvents();

      // Fermer le dialog
      setEditEventDialogOpen(false);
      setEditingEvent(null);
      
      alert('Événement supprimé avec succès');
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'événement:', error);
      alert('Erreur lors de la suppression de l\'événement');
    }
  };

  const handleAssignProspects = async (userId: string) => {
    try {
      const batch = writeBatch(db);
      const newOwnerName = structureMembers.find(m => m.id === userId)?.displayName || 'Utilisateur';

      selectedProspects.forEach(prospectId => {
        const ref = doc(db, 'prospects', prospectId);
        batch.update(ref, { 
          ownerId: userId,
          updatedAt: serverTimestamp()
        });

        // Ajouter trace d'activité (Assignation)
        const activityRef = doc(collection(db, 'prospects', prospectId, 'activities'));
        batch.set(activityRef, {
            type: 'modification',
            userId: userData?.uid || '',
            userName: userData?.displayName || 'Utilisateur',
            timestamp: serverTimestamp(),
            details: {
                field: 'Propriétaire',
                newValue: newOwnerName,
                note: "Assignation via liste"
            }
        });
      });
      await batch.commit();
      
      // Update local state
      setProspects(prev => prev.map(p => 
        selectedProspects.includes(p.id) ? { ...p, ownerId: userId } : p
      ));
      
      setSelectedProspects([]);
      setActionMenuAnchorEl(null);
    } catch (error) {
      console.error("Erreur assignation:", error);
    }
  };

  const handleDeleteSelectedProspects = async () => {
    if (selectedProspects.length === 0) return;

    try {
      // Supprimer chaque prospect (deleteProspect supprime aussi les événements associés)
      for (const prospectId of selectedProspects) {
        await deleteProspect(prospectId);
      }

      // Mettre à jour l'état local
      setProspects(prev => prev.filter(p => !selectedProspects.includes(p.id)));
      
      // Mettre à jour les colonnes du pipeline
      const newPipelineColumns: Record<string, Prospect[]> = {};
      PIPELINE_STATUSES.forEach(status => {
        newPipelineColumns[status] = prospects
          .filter(p => !selectedProspects.includes(p.id))
          .filter(p => validateStatus(p.statut) === status);
      });
      setPipelineColumns(newPipelineColumns);

      // Recharger les événements pour supprimer ceux qui étaient liés
      await fetchCalendarEvents();

      setSelectedProspects([]);
      setIsDeleteDialogOpen(false);
      
      alert(`${selectedProspects.length} prospect(s) supprimé(s) avec succès. Les tâches associées ont également été supprimées.`);
    } catch (error) {
      console.error("Erreur suppression:", error);
      setError("Erreur lors de la suppression des prospects");
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  };

  const handleDownloadTemplate = () => {
    // Télécharger le fichier template depuis le dossier public
    const link = document.createElement("a");
    link.setAttribute("href", "/template-import-prospects.csv");
    link.setAttribute("download", "template-import-prospects.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportProspects = async () => {
    if (!importFile || !userData?.structureId || !currentUser?.uid) {
      alert('Erreur: Utilisateur non connecté ou structure non définie');
      return;
    }

    // Vérifier les tokens avant l'import
    if (structureTokens && structureTokens.tokensRemaining === 0) {
      setError(`❌ Quota mensuel de tokens atteint. Impossible d'importer des prospects. Vous avez utilisé tous vos ${structureTokens.tokensTotal} tokens ce mois-ci. Vous pourrez importer de nouveaux prospects le mois prochain.`);
      setIsImportDialogOpen(false);
      setTimeout(() => setError(null), 8000);
      return;
    }

    setImporting(true);
    Papa.parse(importFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          // Compter les prospects valides
          const validRows = (results.data as any[]).filter(row => 
            (row.Nom || row.Name || row.Entreprise || row.Company)
          );
          
          // Vérifier si assez de tokens
          if (structureTokens && structureTokens.tokensRemaining < validRows.length) {
            alert(`Pas assez de tokens. Vous avez ${structureTokens.tokensRemaining} tokens restants mais ${validRows.length} prospects à importer.`);
            setImporting(false);
            return;
          }

          let count = 0;
          let errorCount = 0;

          // Utiliser createProspect pour chaque prospect (gère automatiquement les tokens)
          for (const row of validRows) {
            try {
              const prospectData: any = {
                nom: (row.Nom || row.Name || '').trim(),
                name: (row.Name || row.Nom || '').trim(),
                entreprise: (row.Entreprise || row.Company || '').trim() || undefined,
                company: (row.Company || row.Entreprise || '').trim() || undefined,
                email: (row.Email || '').trim() || undefined,
                telephone: (row.Telephone || row.Phone || row.Tel || '').trim() || undefined,
                title: (row.Poste || row.Title || row.Position || row.Job || '').trim() || undefined,
                about: (row.About || row['À propos'] || row.Description || '').trim() || undefined,
                location: (row.Location || row.Localisation || row.Ville || '').trim() || undefined,
                pays: (row.Pays || row.Country || '').trim() || undefined,
                adresse: (row.Adresse || row.Address || '').trim() || undefined,
                secteur: (row.Secteur || row.Sector || row.Industrie || '').trim() || undefined,
                linkedinUrl: (row.LinkedIn || row.LinkedInUrl || row['URL LinkedIn'] || '').trim() || undefined,
                photoUrl: (row.PhotoUrl || row.Photo || row.Avatar || '').trim() || undefined,
                valeurPotentielle: row.ValeurPotentielle || row['Valeur Potentielle'] || row.Value ? parseFloat(row.ValeurPotentielle || row['Valeur Potentielle'] || row.Value) : undefined,
                extractionMethod: (row.ExtractionMethod || row['Méthode Extraction'] || '').trim() || undefined,
                statut: 'non_qualifie',
                structureId: userData.structureId,
                ownerId: currentUser.uid,
                userId: currentUser.uid,
                dateAjout: new Date().toISOString(),
                source: row.Source || 'Import Excel'
              };

              // Traiter les données d'entreprise si présentes
              const companyData: any = {};
              if (row.RaisonSociale || row['Raison Sociale']) {
                companyData.raisonSociale = (row.RaisonSociale || row['Raison Sociale']).trim();
              }
              if (row.CodeSecteur || row['Code Secteur'] || row.APE) {
                companyData.secteur = (row.CodeSecteur || row['Code Secteur'] || row.APE).trim();
              }
              if (row.SiegeSocial || row['Siège Social'] || row.Siege) {
                companyData.siegeSocial = (row.SiegeSocial || row['Siège Social'] || row.Siege).trim();
              }
              if (row.SIREN || row.Siren) {
                companyData.siren = (row.SIREN || row.Siren).trim();
              }
              if (row.SIRET || row.Siret) {
                companyData.siret = (row.SIRET || row.Siret).trim();
              }
              if (row.CompanySector || row['Secteur Activité'] || row['Secteur Entreprise']) {
                companyData.companySector = (row.CompanySector || row['Secteur Activité'] || row['Secteur Entreprise']).trim();
              }
              
              if (Object.keys(companyData).length > 0) {
                prospectData.companyData = companyData;
              }

              // Traiter les expériences professionnelles si présentes
              const experience: any[] = [];
              let expIndex = 1;
              while (row[`Experience${expIndex}Title`] || row[`Experience${expIndex}`]) {
                const exp: any = {};
                if (row[`Experience${expIndex}Title`] || row[`Experience${expIndex}`]) {
                  exp.title = (row[`Experience${expIndex}Title`] || row[`Experience${expIndex}`]).trim();
                }
                if (row[`Experience${expIndex}Company`]) {
                  exp.company = row[`Experience${expIndex}Company`].trim();
                }
                if (row[`Experience${expIndex}Duration`] || row[`Experience${expIndex}Duree`]) {
                  exp.duration = (row[`Experience${expIndex}Duration`] || row[`Experience${expIndex}Duree`]).trim();
                }
                if (exp.title || exp.company) {
                  experience.push(exp);
                }
                expIndex++;
              }
              
              if (experience.length > 0) {
                prospectData.experience = experience;
              }

              // Filtrer les valeurs undefined
              const cleanedData: any = {};
              Object.keys(prospectData).forEach(key => {
                const value = prospectData[key];
                if (value !== undefined) {
                  cleanedData[key] = value;
                }
              });

              // Vérifier que les champs requis sont présents
              if ((!cleanedData.nom && !cleanedData.name) || !cleanedData.structureId || !cleanedData.ownerId) {
                console.warn('Ligne ignorée - champs requis manquants:', row);
                errorCount++;
                continue;
              }

              // Utiliser createProspect qui gère automatiquement les tokens
              try {
                await createProspect(cleanedData);
                count++;
                console.log(`[Import] Prospect ${count} créé avec succès`);
              } catch (createError: any) {
                console.error(`[Import] Erreur lors de la création du prospect ${count + 1}:`, createError);
                errorCount++;
                // Si erreur de tokens, arrêter l'import
                if (createError.message && (createError.message.includes('token') || createError.message.includes('Quota'))) {
                  alert(`Import interrompu : ${createError.message}. ${count} prospect(s) importé(s) avec succès.`);
                  break;
                }
                // Pour les autres erreurs, continuer avec le suivant
                throw createError;
              }
            } catch (error: any) {
              console.error('Erreur lors de l\'import d\'un prospect:', error);
              errorCount++;
              // Si erreur de tokens, arrêter l'import
              if (error.message && (error.message.includes('token') || error.message.includes('Quota'))) {
                alert(`Import interrompu : ${error.message}. ${count} prospect(s) importé(s) avec succès.`);
                break;
              }
            }
          }

          setImporting(false);
          setIsImportDialogOpen(false);
          setImportFile(null);
          
          // Attendre un peu pour que Firestore se synchronise
          await new Promise(resolve => setTimeout(resolve, 500));
          
          fetchProspects();
          // Rafraîchir les tokens après l'import (avec un petit délai pour la synchronisation)
          await fetchStructureTokens();
          
          if (errorCount > 0) {
            alert(`${count} prospect(s) importé(s) avec succès. ${errorCount} erreur(s) rencontrée(s).`);
          } else {
            alert(`${count} prospect(s) importé(s) avec succès !`);
          }
        } catch (error) {
          console.error("Erreur import:", error);
          setImporting(false);
          alert("Erreur lors de l'importation");
        }
      },
      error: (error) => {
        console.error("Erreur parsing CSV:", error);
        setImporting(false);
        alert("Erreur lors de la lecture du fichier CSV");
      }
    });
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const filtered = getFilteredProspects();
      setSelectedProspects(filtered.map(p => p.id));
    } else {
      setSelectedProspects([]);
    }
  };

  const handleSelectOne = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    setSelectedProspects(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  // --- CALCULATED STATS (MEMOIZED) ---

  const assignableMembers = useMemo(() => {
    const filtered = structureMembers.filter(m => 
      m.poles?.some(p => p.poleId === 'dev')
    );
    return filtered.sort((a, b) => {
      const mandatA = a.mandat || '';
      const mandatB = b.mandat || '';
      if (mandatA !== mandatB) return mandatB.localeCompare(mandatA);
      return a.displayName.localeCompare(b.displayName);
    });
  }, [structureMembers]);

  // Grouper les membres par mandat pour le tri dans Stats
  const groupMembersByMandat = useCallback(() => {
    const grouped: { [mandat: string]: StructureMember[] } = {};
    
    assignableMembers.forEach(member => {
      const mandat = member.mandat || 'Sans mandat';
      if (!grouped[mandat]) {
        grouped[mandat] = [];
      }
      grouped[mandat].push(member);
    });

    // Trier les mandats par ordre croissant (plus ancien en premier, plus récent en dernier)
    const sortedMandats = Object.keys(grouped).sort((a, b) => {
      if (a === 'Sans mandat') return 1;
      if (b === 'Sans mandat') return -1;
      return a.localeCompare(b); // Ordre croissant (ancien -> récent)
    });

    return { grouped, sortedMandats };
  }, [assignableMembers]);

  // Réinitialiser l'index du mandat quand les membres changent pour afficher le plus récent
  useEffect(() => {
    const { sortedMandats } = groupMembersByMandat();
    if (sortedMandats.length > 0) {
      // Exclure "Sans mandat" pour trouver le mandat le plus récent
      const mandatsWithDates = sortedMandats.filter(m => m !== 'Sans mandat');
      if (mandatsWithDates.length > 0) {
        // Afficher le mandat le plus récent par défaut (dernier index des mandats avec dates)
        const mostRecentIndex = sortedMandats.indexOf(mandatsWithDates[mandatsWithDates.length - 1]);
        setCurrentMandatIndex(mostRecentIndex);
      } else {
        // Si seulement "Sans mandat" existe, l'afficher
        const sansMandatIndex = sortedMandats.indexOf('Sans mandat');
        setCurrentMandatIndex(sansMandatIndex >= 0 ? sansMandatIndex : 0);
      }
    } else {
      setCurrentMandatIndex(0);
    }
  }, [groupMembersByMandat]);

  const stats = useMemo(() => {
    const total = prospects.length;
    const active = prospects.filter(p => !['abandon', 'deja_client'].includes(p.statut)).length;
    const won = prospects.filter(p => p.statut === 'deja_client').length;
    const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
    
    // Funnel
    const funnel = [
      { label: 'Nouveaux', count: prospects.filter(p => p.statut === 'non_qualifie').length, color: '#0071e3' },
      { label: 'Contactés', count: prospects.filter(p => p.statut === 'contacte').length, color: '#5e5ce6' },
      { label: 'Négo', count: prospects.filter(p => p.statut === 'negociation').length, color: '#bf5af2' },
      { label: 'Clients', count: won, color: '#34c759' }
    ];

    // By Owner
    const byOwner = prospects.reduce((acc, p) => {
      const name = getOwnerDisplayName(p.ownerId || '', structureMembers);
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topPerformers = Object.entries(byOwner).sort((a, b) => b[1] - a[1]);

    return { total, active, won, winRate, funnel, topPerformers };
  }, [prospects, structureMembers]);

  // --- HELPERS ---

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'non_qualifie': 'Non qualifié',
      'contacte': 'Contacté',
      'a_recontacter': 'À recontacter',
      'negociation': 'Négociation',
      'abandon': 'Abandon',
      'deja_client': 'Client'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'non_qualifie': '#86868b',
      'contacte': '#0071e3',
      'a_recontacter': '#ff9f0a',
      'negociation': '#bf5af2',
      'abandon': '#ff3b30',
      'deja_client': '#34c759'
    };
    return colors[status] || '#86868b';
  };

  const getProspectName = (p: Prospect) => p.nom || p.name || 'Sans nom';
  const getProspectCompany = (p: Prospect) => p.entreprise || p.company || 'Sans entreprise';

  const getFilteredProspects = () => {
    return prospects.filter(p => {
      const search = searchTerm.toLowerCase();
      return (
        (p.nom || '').toLowerCase().includes(search) ||
        (p.entreprise || '').toLowerCase().includes(search) ||
        (p.email || '').toLowerCase().includes(search)
      );
    });
  };

  // --- ACTIONS ---

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    const newStatus = destination.droppableId;
    const oldStatus = source.droppableId;

    if (newStatus === oldStatus) return;

    // Optimistic Update
    const updatedProspects = prospects.map(p => 
      p.id === draggableId ? { ...p, statut: newStatus } : p
    );
    setProspects(updatedProspects);
    
    // Re-calc columns
    const newCols = { ...pipelineColumns };
    const movedProspect = newCols[oldStatus].find(p => p.id === draggableId);
    if (movedProspect) {
      newCols[oldStatus] = newCols[oldStatus].filter(p => p.id !== draggableId);
      newCols[newStatus] = [
        ...newCols[newStatus].slice(0, destination.index),
        { ...movedProspect, statut: newStatus },
        ...newCols[newStatus].slice(destination.index)
      ];
      setPipelineColumns(newCols);
    }

    // Server Update
    try {
      const movedProspectData = prospects.find(p => p.id === draggableId);
      const oldStatus = movedProspectData?.statut;
      
      await updateDoc(doc(db, 'prospects', draggableId), {
        statut: newStatus,
        updatedAt: serverTimestamp()
      });

      // Enregistrer dans l'activité si le statut a changé
      if (oldStatus !== newStatus) {
        const activitiesRef = collection(db, 'prospects', draggableId, 'activities');
        await addDoc(activitiesRef, {
          type: 'modification',
          userId: currentUser?.uid || '',
          userName: userData?.displayName || 'Utilisateur',
          timestamp: serverTimestamp(),
          details: {
            field: 'Statut',
            oldValue: oldStatus || 'Non défini',
            newValue: newStatus || 'Non défini'
          }
        });
      }
      
      // Si le statut devient "À recontacter", ouvrir le popover pour choisir la date
      if (newStatus === 'a_recontacter') {
        // Calculer la date par défaut : aujourd'hui + 3 jours
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 3);
        setRelanceProspectId(draggableId);
        setRelanceDate(defaultDate.toISOString().split('T')[0]);
        
        // Attendre un peu pour que le DOM soit mis à jour, puis trouver la carte
        setTimeout(() => {
          const prospectCard = document.querySelector(`[data-rbd-draggable-id="${draggableId}"]`) as HTMLElement;
          if (prospectCard) {
            setRelancePopoverAnchor(prospectCard);
          } else {
            // Si on ne trouve pas la carte, utiliser un élément fictif au centre de l'écran
            const centerElement = document.createElement('div');
            centerElement.style.position = 'fixed';
            centerElement.style.top = '50%';
            centerElement.style.left = '50%';
            centerElement.style.transform = 'translate(-50%, -50%)';
            document.body.appendChild(centerElement);
            setRelancePopoverAnchor(centerElement);
          }
        }, 100);
      }
    } catch (error) {
      console.error("Erreur update statut:", error);
      fetchProspects(); // Rollback on error
    }
  };

  const handleSaveRelanceDate = async () => {
    if (!relanceProspectId || !relanceDate || !currentUser || !userData?.structureId) {
      setRelancePopoverAnchor(null);
      setRelanceProspectId(null);
      return;
    }

    try {
      const prospect = prospects.find(p => p.id === relanceProspectId);
      if (!prospect) return;

      // Mettre à jour le prospect
      const oldDateRecontact = prospect.dateRecontact;
      await updateDoc(doc(db, 'prospects', relanceProspectId), {
        dateRecontact: relanceDate,
        updatedAt: serverTimestamp()
      });

      // Enregistrer dans l'activité
      const activitiesRef = collection(db, 'prospects', relanceProspectId, 'activities');
      await addDoc(activitiesRef, {
        type: 'modification',
        userId: currentUser.uid,
        userName: userData?.displayName || 'Utilisateur',
        timestamp: serverTimestamp(),
        details: {
          field: 'Date de relance',
          oldValue: oldDateRecontact || 'Aucune',
          newValue: relanceDate
        }
      });

      // Vérifier si un événement de relance existe déjà pour ce prospect
      const eventsRef = collection(db, 'calendarEvents');
      const existingEventQuery = query(
        eventsRef,
        where('structureId', '==', userData.structureId),
        where('prospectId', '==', relanceProspectId),
        where('type', '==', 'reminder')
      );
      const existingEventSnapshot = await getDocs(existingEventQuery);

      // Si un événement existe déjà, le mettre à jour au lieu d'en créer un nouveau
      if (!existingEventSnapshot.empty) {
        const existingEventDoc = existingEventSnapshot.docs[0];
        const prospectName = prospect.nom || prospect.name || 'Contact';
        const startDateTime = `${relanceDate}T09:00`;
        const endDateTime = `${relanceDate}T09:30`;

        await updateDoc(existingEventDoc.ref, {
          title: `Relance: ${prospectName}`,
          startDate: relanceDate,
          startTime: '09:00',
          start: startDateTime,
          endDate: relanceDate,
          endTime: '09:30',
          end: endDateTime,
          description: `Relance prévue pour ${prospectName}${prospect.entreprise ? ` - ${prospect.entreprise}` : ''}`,
          updatedAt: serverTimestamp()
        });
      } else {
        // Créer un nouvel événement de calendrier pour la relance
        const prospectName = prospect.nom || prospect.name || 'Contact';
        const startDateTime = `${relanceDate}T09:00`;
        const endDateTime = `${relanceDate}T09:30`;

        const eventData = {
          title: `Relance: ${prospectName}`,
          startDate: relanceDate,
          startTime: '09:00',
          start: startDateTime,
          endDate: relanceDate,
          endTime: '09:30',
          end: endDateTime,
          type: 'reminder',
          visibility: 'private',
          ownerId: currentUser.uid,
          invitedUsers: [],
          description: `Relance prévue pour ${prospectName}${prospect.entreprise ? ` - ${prospect.entreprise}` : ''}`,
          structureId: userData.structureId,
          createdBy: currentUser.uid,
          createdAt: Timestamp.now(),
          prospectId: relanceProspectId,
          isRelanceReminder: true
        };

        await addDoc(collection(db, 'calendarEvents'), eventData);
      }

      // Mettre à jour l'état local
      setProspects(prev => prev.map(p => 
        p.id === relanceProspectId ? { ...p, dateRecontact: relanceDate } : p
      ));

      // Recharger les événements pour afficher la nouvelle relance
      await fetchCalendarEvents();

      setRelancePopoverAnchor(null);
      setRelanceProspectId(null);
      setRelanceDate('');
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de la date de relance:", error);
      setRelancePopoverAnchor(null);
      setRelanceProspectId(null);
    }
  };

  const handleCloseRelancePopover = () => {
    // Nettoyer les éléments DOM temporaires si nécessaire
    const tempElement = relancePopoverAnchor;
    if (tempElement && tempElement.parentNode === document.body && tempElement.style.position === 'fixed') {
      document.body.removeChild(tempElement);
    }
    setRelancePopoverAnchor(null);
    setRelanceProspectId(null);
    setRelanceDate('');
  };

  // --- SUB-COMPONENTS RENDER ---

  const renderKPIs = () => (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12} sm={6} md={4}>
        <StyledCard sx={{ p: 3, position: 'relative', height: '100%' }}>
          <Box sx={{ position: 'absolute', right: -20, top: -20, opacity: 0.1 }}>
            <ShowChartIcon sx={{ fontSize: 100, color: '#0071e3' }} />
        </Box>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>Total Prospects</Typography>
          <Typography variant="h3" fontWeight={800} sx={{ my: 1, color: '#1d1d1f' }}>{stats.total}</Typography>
          <Chip icon={<TrendingUpIcon />} label="+12% ce mois" size="small" sx={{ bgcolor: '#e3f2fd', color: '#0071e3', fontWeight: 600 }} />
        </StyledCard>
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <StyledCard sx={{ p: 3, position: 'relative', height: '100%' }}>
          <Box sx={{ position: 'absolute', right: -20, top: -20, opacity: 0.1 }}>
            <TimerIcon sx={{ fontSize: 100, color: '#ff9f0a' }} />
          </Box>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>Pipeline Actif</Typography>
          <Typography variant="h3" fontWeight={800} sx={{ my: 1, color: '#1d1d1f' }}>{stats.active}</Typography>
          <Chip label="En cours" size="small" sx={{ bgcolor: '#fff4e5', color: '#ff9f0a', fontWeight: 600 }} />
        </StyledCard>
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <StyledCard sx={{ p: 3, position: 'relative', height: '100%' }}>
          <Box sx={{ position: 'absolute', right: -20, top: -20, opacity: 0.1 }}>
            <CheckCircleIcon sx={{ fontSize: 100, color: '#34c759' }} />
          </Box>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>Taux de Conversion</Typography>
          <Typography variant="h3" fontWeight={800} sx={{ my: 1, color: '#1d1d1f' }}>{stats.winRate}%</Typography>
          <Chip icon={<TrendingUpIcon />} label="Performance" size="small" sx={{ bgcolor: '#eafbf1', color: '#34c759', fontWeight: 600 }} />
        </StyledCard>
      </Grid>
    </Grid>
  );

  const renderSidebar = () => {
    // Calcul Agenda (Simplifié pour la sidebar)
    const today = new Date();
    today.setHours(0,0,0,0);
    const urgentProspects = prospects.filter(p => {
      const last = p.derniereInteraction ? new Date(p.derniereInteraction) : new Date(p.dateAjout || '');
      const diff = (today.getTime() - last.getTime()) / (1000 * 3600 * 24);
      return (p.statut === 'negociation' && diff > 3) || (p.statut === 'contacte' && diff > 7);
    }).slice(0, 5); // Max 5

    // Événements à venir (tous, triés par date)
    // Les événements de relance sont maintenant créés dans Firestore et récupérés via fetchCalendarEvents
    const allUpcomingEvents = events.filter(e => {
      const eventDate = new Date(e.start);
      return eventDate >= new Date();
    }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    const nextEvent = allUpcomingEvents.length > 0 ? allUpcomingEvents[0] : null;
    
    // Si on affiche le nextEvent en haut (car pas d'urgents), on ne l'affiche pas dans la liste du bas
    const showNextEventInTopCard = urgentProspects.length === 0 && nextEvent;
    const upcomingList = showNextEventInTopCard 
        ? allUpcomingEvents.slice(1, 6) 
        : allUpcomingEvents.slice(0, 5);

    return (
      <Stack spacing={3} sx={{ pb: 4 }}>
        {/* Tokens Display Card */}
        {structureTokens && (
          <Tooltip
            title={
              <Box sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  Quota mensuel de prospects
                </Typography>
                <Typography variant="body2" sx={{ mb: 1.5, lineHeight: 1.6 }}>
                  Votre structure dispose de <strong>100 tokens par mois</strong> pour créer ou importer des prospects.
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { mb: 0.5 } }}>
                  <Typography component="li" variant="body2">
                    <strong>1 token = 1 prospect</strong> créé ou importé
                  </Typography>
                  <Typography component="li" variant="body2">
                    Les tokens se réinitialisent automatiquement chaque mois
                  </Typography>
                  <Typography component="li" variant="body2">
                    Utilisés ce mois : <strong>{structureTokens.tokensTotal - structureTokens.tokensRemaining}/{structureTokens.tokensTotal}</strong>
                  </Typography>
                </Box>
              </Box>
            }
            arrow
            placement="left"
            componentsProps={{
              tooltip: {
                sx: {
                  bgcolor: '#1d1d1f',
                  maxWidth: 320,
                  fontSize: '0.875rem',
                  '& .MuiTooltip-arrow': {
                    color: '#1d1d1f'
                  }
                }
              }
            }}
          >
            <StyledCard 
              sx={{ 
                p: 2.5, 
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)'
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: '10px', 
                    bgcolor: structureTokens.tokensRemaining > 20 
                      ? `${APPLE_COLORS.success}20` 
                      : structureTokens.tokensRemaining > 10 
                        ? '#fff4e5' 
                        : '#ffebee',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <RocketIcon sx={{ 
                      fontSize: 22, 
                      color: structureTokens.tokensRemaining > 20 
                        ? APPLE_COLORS.success 
                        : structureTokens.tokensRemaining > 10 
                          ? '#ff9f0a' 
                          : APPLE_COLORS.error 
                    }} />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#1d1d1f' }}>
                      Quota mensuel
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      Tokens restants
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography 
                    variant="h5" 
                    fontWeight={800}
                    sx={{ 
                      color: structureTokens.tokensRemaining > 20 
                        ? APPLE_COLORS.success 
                        : structureTokens.tokensRemaining > 10 
                          ? '#ff9f0a' 
                          : APPLE_COLORS.error,
                      lineHeight: 1
                    }}
                  >
                    {structureTokens.tokensRemaining}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    / {structureTokens.tokensTotal}
                  </Typography>
                </Box>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={(structureTokens.tokensRemaining / structureTokens.tokensTotal) * 100}
                sx={{
                  width: '100%',
                  height: 8,
                  borderRadius: 4,
                  bgcolor: '#f0f0f0',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: structureTokens.tokensRemaining > 20 
                      ? APPLE_COLORS.success 
                      : structureTokens.tokensRemaining > 10 
                        ? '#ff9f0a' 
                        : APPLE_COLORS.error,
                    borderRadius: 4
                  }
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {structureTokens.tokensTotal - structureTokens.tokensRemaining} utilisés
                </Typography>
                <InfoIcon sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.6 }} />
              </Box>
            </StyledCard>
          </Tooltip>
        )}

        {/* Agenda Card */}
        <StyledCard sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <CalendarMonthIcon sx={{ color: APPLE_COLORS.primary, mr: 1.5 }} />
            <Typography variant="h6" fontWeight={700}>À faire aujourd'hui</Typography>
          </Box>
          
          {urgentProspects.length > 0 ? (
            <List disablePadding>
              {urgentProspects.map(p => (
                <ListItem 
                  key={p.id}
                  button 
                  onClick={() => navigate(`/prospect/${p.id}`)}
                  sx={{
                    px: 0, 
                    py: 1.5, 
                    borderBottom: '1px solid #f5f5f7',
                    '&:last-child': { borderBottom: 'none' }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: `${getStatusColor(p.statut)}20`, color: getStatusColor(p.statut), fontSize: '0.8rem', fontWeight: 700 }}>
                      {(p.nom || '?').charAt(0)}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText 
                    primary={<Typography variant="subtitle2" fontWeight={600} noWrap>{getProspectName(p)}</Typography>}
                    secondary={<Typography variant="caption" color="error.main" fontWeight={500}>Relance requise</Typography>}
                  />
                  <IconButton size="small" sx={{ color: APPLE_COLORS.primary }}>
                    <PhoneIcon fontSize="small" />
                  </IconButton>
                </ListItem>
              ))}
            </List>
          ) : nextEvent ? (
             <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'text.secondary', bgcolor: '#f5f5f7', p: 1, borderRadius: '8px' }}>
                    <CheckCircleIcon sx={{ color: '#34c759', fontSize: 20 }} />
                    <Typography variant="caption" fontWeight={600}>Aucune relance urgente</Typography>
                </Box>
                
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: 'text.primary' }}>Prochain événement :</Typography>
                
                <Paper 
                    elevation={0}
                    sx={{ 
                        p: 2, 
                        bgcolor: 'white', 
                        borderRadius: '12px', 
                        border: '1px solid #e5e5ea',
                        borderLeft: `4px solid ${APPLE_COLORS.primary}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }
                    }}
                    onClick={() => setShowFullAgenda(true)}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Chip 
                            label={new Date(nextEvent.start).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} 
                            size="small" 
                            sx={{ bgcolor: '#f5f5f7', fontWeight: 700, fontSize: '0.7rem', height: 22, color: 'text.secondary' }} 
                        />
                         {nextEvent.type === 'meeting' && <GroupIcon fontSize="small" sx={{ color: '#ff9f0a', fontSize: 16 }} />}
                         {nextEvent.type === 'call' && <PhoneIcon fontSize="small" sx={{ color: '#30b0c7', fontSize: 16 }} />}
                         {nextEvent.type === 'task' && <CheckCircleIcon fontSize="small" sx={{ color: '#34c759', fontSize: 16 }} />}
                         {nextEvent.type === 'deadline' && <FlagIcon fontSize="small" sx={{ color: '#ff3b30', fontSize: 16 }} />}
                         {nextEvent.type === 'salon' && <StoreIcon fontSize="small" sx={{ color: '#bf5af2', fontSize: 16 }} />}
                         {nextEvent.type === 'reminder' && <NotificationsIcon fontSize="small" sx={{ color: '#ff9f0a', fontSize: 16 }} />}
                    </Box>
                    
                    <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.3, mb: 0.5 }}>{nextEvent.title}</Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                        <AccessTimeIcon sx={{ fontSize: 14 }} />
                        <Typography variant="caption" fontWeight={600}>
                            {new Date(nextEvent.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </Typography>
                    </Box>
                </Paper>
             </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4, opacity: 0.5 }}>
              <CheckCircleIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="body2">Tout est à jour !</Typography>
            </Box>
          )}
          <Button 
            fullWidth 
            variant="outlined" 
            sx={{ mt: 2, borderRadius: '10px' }}
            onClick={() => setShowFullAgenda(true)}
          >
            Voir l'agenda complet
          </Button>
        </StyledCard>

        {/* Agenda À Venir */}
        {upcomingList.length > 0 && (
          <StyledCard sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CalendarIcon sx={{ color: APPLE_COLORS.secondary, mr: 1.5, fontSize: 20 }} />
              <Typography variant="subtitle1" fontWeight={700} color="text.secondary">À venir</Typography>
            </Box>
            <List disablePadding>
              {upcomingList.map(e => (
                <ListItem key={e.id} sx={{ px: 0, py: 1.5, borderBottom: '1px solid #f5f5f7', '&:last-child': { borderBottom: 'none' } }}>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600}>{e.title}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AccessTimeIcon sx={{ fontSize: 12 }} />
                      {new Date(e.start).toLocaleDateString()} à {new Date(e.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </Typography>
                  </Box>
                </ListItem>
              ))}
            </List>
          </StyledCard>
        )}

        {/* Leaderboard Card */}
        <StyledCard sx={{ p: 0, overflow: 'hidden' }}>
          <Box sx={{ p: 3, bgcolor: '#fbfbfd', borderBottom: '1px solid #f0f0f0' }}>
            <Typography variant="h6" fontWeight={700}>Top Performers</Typography>
          </Box>
          <List disablePadding>
            {stats.topPerformers.slice(0, 3).map(([name, count], index) => (
              <ListItem key={name} sx={{ px: 3, py: 2 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {index === 0 && <TrophyIcon sx={{ color: '#ffd700' }} />}
                  {index === 1 && <TrophyIcon sx={{ color: '#c0c0c0' }} />}
                  {index === 2 && <TrophyIcon sx={{ color: '#cd7f32' }} />}
                </ListItemIcon>
                <ListItemText 
                  primary={<Typography variant="body2" fontWeight={600}>{name}</Typography>}
                  secondary={`${count} dossiers`}
                />
              </ListItem>
            ))}
          </List>
        </StyledCard>

        {/* Funnel Mini Chart */}
        <StyledCard sx={{ p: 3 }}>
           <Typography variant="h6" fontWeight={700} mb={2}>Conversion</Typography>
           <Stack spacing={1.5}>
             {stats.funnel.map(step => (
               <Box key={step.label}>
                 <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                   <Typography variant="caption" fontWeight={600}>{step.label}</Typography>
                   <Typography variant="caption">{step.count}</Typography>
                 </Box>
                 <LinearProgress 
                    variant="determinate" 
                    value={(step.count / (stats.funnel[0].count || 1)) * 100} 
                  sx={{
                      height: 6, 
                      borderRadius: 3, 
                      bgcolor: '#f0f0f0',
                      '& .MuiLinearProgress-bar': { bgcolor: step.color } 
                    }} 
                  />
               </Box>
             ))}
           </Stack>
        </StyledCard>
      </Stack>
    );
  };

  const renderStats = () => {
    const { grouped: mandatsGrouped, sortedMandats } = groupMembersByMandat();
    const currentMandat = sortedMandats[currentMandatIndex] || sortedMandats[sortedMandats.length - 1] || '';
    const mandatMembers = mandatsGrouped[currentMandat] || [];

    const handlePreviousMandat = () => {
      setCurrentMandatIndex(prev => Math.max(0, prev - 1));
    };

    const handleNextMandat = () => {
      setCurrentMandatIndex(prev => Math.min(sortedMandats.length - 1, prev + 1));
    };

    // Préparer les données en filtrant uniquement sur le pôle "dev" et le mandat sélectionné
    const statsByMember = mandatMembers.map(member => {
      const memberProspects = prospects.filter(p => p.ownerId === member.id);
      const total = memberProspects.length;
      
      const counts = memberProspects.reduce((acc, p) => {
        const status = p.statut || 'non_qualifie';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        member,
        total,
        counts
      };
    }).sort((a, b) => b.total - a.total);

    // Calculer le max pour l'échelle (arrondi au multiple de 5 supérieur ou min 5)
    const maxVal = Math.max(...statsByMember.map(s => s.total), 0);
    const yAxisMax = maxVal === 0 ? 5 : Math.ceil((maxVal + 1) / 5) * 5;
    const yAxisTicks = [0, yAxisMax * 0.2, yAxisMax * 0.4, yAxisMax * 0.6, yAxisMax * 0.8, yAxisMax];

    return (
      <Box sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 6 }}>
          <Typography variant="h6" fontWeight={700}>Performance par membre</Typography>
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Navigation par mandat */}
            {sortedMandats.length > 1 && (
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center',
                gap: 1,
                bgcolor: 'background.paper',
                borderRadius: 2,
                p: 0.5,
                boxShadow: 1,
                zIndex: 1
              }}>
                <IconButton
                  onClick={handlePreviousMandat}
                  disabled={currentMandatIndex === 0}
                  size="small"
                  sx={{
                    '&:disabled': {
                      opacity: 0.3
                    }
                  }}
                >
                  <ChevronLeftIcon />
                </IconButton>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    px: 2,
                    color: 'text.secondary',
                    fontSize: '0.875rem',
                    minWidth: '80px',
                    textAlign: 'center'
                  }}
                >
                  {currentMandat}
                </Typography>
                <IconButton
                  onClick={handleNextMandat}
                  disabled={currentMandatIndex === sortedMandats.length - 1}
                  size="small"
                  sx={{
                    '&:disabled': {
                      opacity: 0.3
                    }
                  }}
                >
                  <ChevronRightIcon />
                </IconButton>
              </Box>
            )}
            
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {PIPELINE_STATUSES.map(status => (
                <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: getStatusColor(status) }} />
                  <Typography variant="caption" color="text.secondary">{getStatusLabel(status)}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
        
        {/* Zone Graphique */}
        <Box sx={{ position: 'relative', height: '400px', display: 'flex', pl: 4, mb: 6 }}>
            
            {/* Axe Y et Grille de fond */}
            <Box sx={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 0 }}>
                {yAxisTicks.map((tick, i) => (
                    <Box key={tick} sx={{ 
                        position: 'absolute', 
                        bottom: `${(i / (yAxisTicks.length - 1)) * 100}%`, 
                        width: '100%', 
                        borderBottom: i === 0 ? '1px solid #e5e5ea' : '1px dashed #f0f0f0',
                        display: 'flex',
                        alignItems: 'flex-end'
                    }}>
                        <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', left: -30, bottom: -6, width: 20, textAlign: 'right' }}>
                            {Math.round(tick)}
                        </Typography>
                    </Box>
                ))}
            </Box>

            {/* Barres */}
            <Box sx={{ 
                flex: 1, 
                display: 'flex', 
                alignItems: 'flex-end', 
                justifyContent: 'space-around',
                zIndex: 1,
                pl: 2,
                height: '100%'
            }}>
                {statsByMember.map(({ member, total, counts }) => (
                    <Box key={member.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', width: '60px', position: 'relative' }}>
                        
                        {/* Barre avec hauteur relative au yAxisMax */}
                        <Box sx={{ 
                            width: '100%', 
                            height: `${(total / yAxisMax) * 100}%`, 
                            display: 'flex', 
                            flexDirection: 'column-reverse', 
                            bgcolor: '#f5f5f7', 
                            borderRadius: '6px 6px 0 0', 
                            overflow: 'hidden',
                            transition: 'height 0.5s',
                            position: 'relative',
                            mb: 0
                        }}>
                             {PIPELINE_STATUSES.map(status => {
                                const count = counts[status] || 0;
                                if (count === 0) return null;
                                const heightPercent = (count / total) * 100;
                                
      return (
                                    <Tooltip key={status} title={`${getStatusLabel(status)}: ${count}`}>
                                    <Box sx={{ 
                                        width: '100%', 
                                        height: `${heightPercent}%`,
                                        bgcolor: getStatusColor(status),
                                        borderTop: '1px solid rgba(255,255,255,0.2)'
                                    }} />
                                    </Tooltip>
                                );
                            })}
                        </Box>

                        {/* Info Membre sous l'axe X */}
                        <Box sx={{ position: 'absolute', bottom: -50, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '80px' }}>
                            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 0.5 }}>
                                {total}
                            </Typography>
                            <Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem', mb: 0.5 }}>
                                {member.displayName.charAt(0)}
                            </Avatar>
                            <Typography variant="caption" fontWeight={600} noWrap sx={{ width: '100%', textAlign: 'center' }}>
                                {member.displayName.split(' ')[0]}
                            </Typography>
                        </Box>
                    </Box>
                ))}
            </Box>
        </Box>
      </Box>
    );
  };

  const renderPipeline = () => (
      <DragDropContext onDragEnd={onDragEnd}>
      <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 2, minHeight: '600px' }}>
        {PIPELINE_STATUSES.map(status => (
          <Box key={status} sx={{ minWidth: 240, width: 240, flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, px: 1 }}>
              <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                {getStatusLabel(status)}
              </Typography>
              <Chip label={pipelineColumns[status]?.length || 0} size="small" sx={{ bgcolor: 'white', fontWeight: 600, height: 20, fontSize: '0.75rem' }} />
            </Box>
            
            <StrictModeDroppable droppableId={status}>
                {(provided, snapshot) => (
                  <Box
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    sx={{
                    bgcolor: snapshot.isDraggingOver ? `${getStatusColor(status)}10` : '#f5f5f7',
                    borderRadius: '16px',
                    p: 1.5,
                    minHeight: '100%',
                    transition: 'background-color 0.2s',
                    border: '1px dashed transparent',
                    borderColor: snapshot.isDraggingOver ? getStatusColor(status) : 'transparent'
                    }}
                  >
                    {(pipelineColumns[status] || []).map((prospect, index) => (
                    <Draggable key={prospect.id} draggableId={prospect.id} index={index}>
                        {(provided, snapshot) => (
                          <Paper
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          elevation={0}
                          onClick={() => navigate(`/prospect/${prospect.id}`)}
                            sx={{
                              p: 2,
                            mb: 1.5,
                            borderRadius: '12px',
                            bgcolor: 'white',
                              border: '1px solid #e5e5ea',
                              cursor: 'grab',
                            transition: 'all 0.2s',
                            boxShadow: snapshot.isDragging ? '0 8px 16px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.02)',
                              '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                              borderColor: APPLE_COLORS.primary
                            }
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                             <Chip 
                              label={getOwnerDisplayName(prospect.ownerId || '', structureMembers)} 
                              size="small" 
                              sx={{ bgcolor: `${getStatusColor(status)}15`, color: getStatusColor(status), fontWeight: 700, fontSize: '0.7rem', height: 20 }} 
                            />
                            {prospect.favori && <TrophyIcon sx={{ fontSize: 16, color: '#ffd700' }} />}
                            </Box>
                          <Typography variant="subtitle2" fontWeight={600} noWrap title={getProspectName(prospect)}>
                            {getProspectName(prospect)}
                            </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            <BusinessIcon sx={{ fontSize: 14 }} /> {getProspectCompany(prospect)}
                          </Typography>
                          
                          {getDaysSinceInteraction(prospect.derniereInteraction) > 10 && (
                             <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 0.5, color: '#ff3b30' }}>
                               <AccessTimeIcon sx={{ fontSize: 12 }} />
                               <Typography variant="caption" fontWeight={600}>Relance requise</Typography>
                             </Box>
                          )}
                          </Paper>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </Box>
                )}
            </StrictModeDroppable>
            </Box>
          ))}
        </Box>
      </DragDropContext>
    );

  const renderTable = () => (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                indeterminate={selectedProspects.length > 0 && selectedProspects.length < getFilteredProspects().length}
                checked={getFilteredProspects().length > 0 && selectedProspects.length === getFilteredProspects().length}
                onChange={handleSelectAll}
              />
            </TableCell>
            <TableCell>Nom</TableCell>
            <TableCell>Entreprise</TableCell>
            <TableCell>Statut</TableCell>
            <TableCell>Propriétaire</TableCell>
            <TableCell>Dernière activité</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {getFilteredProspects().map(p => {
            const isSelected = selectedProspects.indexOf(p.id) !== -1;
    return (
              <StyledTableRow 
                key={p.id} 
                onClick={() => navigate(`/prospect/${p.id}`)} 
                sx={{ cursor: 'pointer' }}
                selected={isSelected}
              >
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={isSelected}
                    onClick={(event) => handleSelectOne(event, p.id)}
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: '#f0f0f0', color: '#1d1d1f', fontSize: '0.875rem', fontWeight: 600 }}>
                      {getProspectName(p).charAt(0)}
                    </Avatar>
                    <Typography variant="body2" fontWeight={500}>{getProspectName(p)}</Typography>
      </Box>
                </TableCell>
                <TableCell>{getProspectCompany(p)}</TableCell>
                <TableCell>
                  <StyledChip 
                    label={getStatusLabel(p.statut)} 
                    sx={{ bgcolor: `${getStatusColor(p.statut)}20`, color: getStatusColor(p.statut) }} 
                  />
                </TableCell>
                <TableCell>{getOwnerDisplayName(p.ownerId || '', structureMembers)}</TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(p.derniereInteraction || p.dateAjout || '').toLocaleDateString()}
                  </Typography>
                </TableCell>
              </StyledTableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );

  // --- HELPER FOR DAYS CALCULATION ---
  const getDaysSinceInteraction = (dateStr?: string) => {
    if (!dateStr) return 0;
    const date = new Date(dateStr);
    const now = new Date();
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
  };

  // --- MAIN RENDER ---

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ 
      p: 4, 
      pb: 12, // Padding encore plus grand
      minHeight: '100vh',
      height: '100%', // Pour s'assurer que le fond suit le contenu
      bgcolor: '#f2f2f7', // Gris Apple fond
      overflowY: 'auto' // Gestion du scroll
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#1d1d1f', mb: 1 }}>
            Pilotage Commercial
      </Typography>
          <Typography variant="body1" color="text.secondary">
            Gérez vos opportunités et suivez vos performances.
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          {selectedProspects.length > 0 && (
            <>
          <StyledButton
            variant="outlined"
                startIcon={<PersonIcon />}
                onClick={(e) => setActionMenuAnchorEl(e.currentTarget)}
            sx={{
                  borderColor: APPLE_COLORS.primary,
                  color: APPLE_COLORS.primary,
              '&:hover': {
                borderColor: '#0077ed',
                bgcolor: 'rgba(0, 113, 227, 0.04)',
              }
            }}
          >
                Assigner ({selectedProspects.length})
          </StyledButton>
            <StyledButton
              variant="outlined"
              startIcon={<DeleteIcon />}
              onClick={() => setIsDeleteDialogOpen(true)}
              sx={{
                borderColor: '#ff3b30',
                color: '#ff3b30',
                '&:hover': {
                  borderColor: '#ff3b30',
                  bgcolor: 'rgba(255, 59, 48, 0.04)',
                }
              }}
            >
                Supprimer ({selectedProspects.length})
            </StyledButton>
            </>
          )}
          <Tooltip
            title={
              <Box sx={{ p: 1 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                  Installation de l'extension JSConnect
                </Typography>
                <Box component="ol" sx={{ m: 0, pl: 2.5, '& li': { mb: 1 } }}>
                  <Typography component="li" variant="body2">
                    Cliquez sur le bouton pour télécharger le fichier ZIP
                  </Typography>
                  <Typography component="li" variant="body2">
                    Ouvrez Chrome et allez à <strong>chrome://extensions/</strong>
                  </Typography>
                  <Typography component="li" variant="body2">
                    Activez le <strong>"Mode développeur"</strong> en haut à droite
                  </Typography>
                  <Typography component="li" variant="body2">
                    Cliquez sur <strong>"Charger l'extension non empaquetée"</strong>
                  </Typography>
                  <Typography component="li" variant="body2">
                    Sélectionnez le dossier extrait du ZIP téléchargé
                  </Typography>
                </Box>
              </Box>
            }
            arrow
            placement="bottom"
            componentsProps={{
              tooltip: {
                sx: {
                  bgcolor: '#1d1d1f',
                  maxWidth: 400,
                  fontSize: '0.875rem',
                  '& .MuiTooltip-arrow': {
                    color: '#1d1d1f'
                  }
                }
              }
            }}
          >
            <StyledButton 
              startIcon={<ExtensionIcon />}
              endIcon={<InfoIcon fontSize="small" />}
              onClick={async () => {
                try {
                  const blob = await downloadExtension();
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'jsconnect-extension.zip';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(url);
                } catch (error) {
                  console.error('Erreur lors du téléchargement de l\'extension:', error);
                  alert('Erreur lors du téléchargement de l\'extension. Veuillez réessayer.');
                }
              }}
              sx={{ 
                color: APPLE_COLORS.primary, 
                bgcolor: 'white',
                border: `1px solid ${APPLE_COLORS.primary}`,
                '&:hover': {
                  bgcolor: 'rgba(0, 113, 227, 0.04)',
                  borderColor: '#0077ed'
                }
              }}
            >
              Extension JSConnect
            </StyledButton>
          </Tooltip>
          <StyledButton 
            startIcon={<UploadIcon />} 
            onClick={() => setIsImportDialogOpen(true)}
            sx={{ color: APPLE_COLORS.primary, bgcolor: 'white' }}
          >
            Importer
          </StyledButton>
          <StyledButton 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={() => setIsCreateDialogOpen(true)}
            disabled={structureTokens !== null && structureTokens.tokensRemaining === 0}
            sx={{ 
              bgcolor: APPLE_COLORS.primary, 
              color: 'white', 
              '&:hover': { bgcolor: '#0077ed' },
              '&:disabled': {
                bgcolor: '#e5e5ea',
                color: '#86868b'
              }
            }}
          >
            Nouveau Dossier
            {structureTokens !== null && structureTokens.tokensRemaining === 0 && (
              <Chip 
                label="Quota atteint" 
                size="small" 
                sx={{ 
                  ml: 1, 
                  height: 20, 
                  fontSize: '0.7rem',
                  bgcolor: APPLE_COLORS.error,
                  color: 'white'
                }} 
              />
            )}
          </StyledButton>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{ mb: 3, borderRadius: '12px' }}
        >
          {error}
        </Alert>
      )}

      {/* KPI Section (Always Visible) */}
      {renderKPIs()}

      {/* Main Grid Layout */}
      <Grid container spacing={4}>
        
        {/* Main Workspace (Left) */}
        <Grid item xs={12} lg={9}>
          <StyledCard sx={{ p: 2, minHeight: '600px' }}>
            {/* Toolbar */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, px: 1 }}>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
                onChange={(_, newMode) => newMode && setViewMode(newMode)}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
                    border: 'none', 
                    borderRadius: '8px !important', 
                    mx: 0.5,
                    px: 2,
                    py: 1,
                    fontWeight: 600,
                    textTransform: 'none',
                    '&.Mui-selected': { bgcolor: '#f5f5f7', color: 'black' }
                  } 
                }}
              >
                <ToggleButton value="pipeline">
                  <ViewKanbanIcon sx={{ mr: 1, fontSize: 20 }} /> Pipeline
          </ToggleButton>
                <ToggleButton value="table">
                  <ViewListIcon sx={{ mr: 1, fontSize: 20 }} /> Liste
                </ToggleButton>
                <ToggleButton value="stats">
                  <ShowChartIcon sx={{ mr: 1, fontSize: 20 }} /> Stats
          </ToggleButton>
        </ToggleButtonGroup>

          <StyledTextField
                placeholder="Rechercher..." 
            size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
                  startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
                }}
              />
        </Box>

            {/* View Content */}
            {viewMode === 'pipeline' ? renderPipeline() : viewMode === 'stats' ? renderStats() : renderTable()}
          </StyledCard>
        </Grid>

        {/* Sidebar (Right) */}
        <Grid item xs={12} lg={3}>
          {renderSidebar()}
        </Grid>

      </Grid>

      {/* Menu d'assignation */}
      <Menu
        anchorEl={actionMenuAnchorEl}
        open={Boolean(actionMenuAnchorEl)}
        onClose={() => setActionMenuAnchorEl(null)}
        PaperProps={{ sx: { maxHeight: 400 } }}
      >
        <MenuItem disabled sx={{ opacity: 1, fontWeight: 700, color: 'text.primary' }}>Assigner à :</MenuItem>
        <Divider />
        {assignableMembers.length === 0 ? (
          <MenuItem disabled>Aucun membre du pôle commercial trouvé</MenuItem>
        ) : (
          assignableMembers.reduce((acc, member, index) => {
            const prevMember = index > 0 ? assignableMembers[index - 1] : null;
            const currentMandat = member.mandat || 'Autres';
            const prevMandat = prevMember?.mandat || 'Autres';
            
            if (index === 0 || currentMandat !== prevMandat) {
              acc.push(
                <ListSubheader key={`header-${currentMandat}`} sx={{ bgcolor: 'white', lineHeight: '32px', fontWeight: 700, color: APPLE_COLORS.primary }}>
                  {currentMandat === 'Autres' ? 'Autres Mandats' : `Mandat ${currentMandat}`}
                </ListSubheader>
              );
            }
            
            acc.push(
              <MenuItem 
                key={member.id} 
                onClick={() => handleAssignProspects(member.id)}
                sx={{ pl: 4 }}
              >
                <Avatar sx={{ width: 24, height: 24, mr: 1, fontSize: '0.7rem' }}>
                  {member.displayName.charAt(0)}
                </Avatar>
                                {member.displayName}
                              </MenuItem>
            );
            return acc;
          }, [] as React.ReactNode[])
        )}
      </Menu>

      {/* Dialog: Import CSV */}
      <Dialog
        open={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Importer des prospects</DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
            <UploadIcon sx={{ fontSize: 48, color: APPLE_COLORS.primary, mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Sélectionnez un fichier CSV
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Colonnes : Nom, Entreprise, Email, Telephone, Poste, Adresse, Secteur, Source
            </Typography>
            
            <Button
              variant="text"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadTemplate}
              sx={{ mb: 3, fontSize: '0.9rem', color: APPLE_COLORS.primary }}
            >
              Télécharger le modèle CSV
            </Button>

            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadIcon />}
              sx={{ mb: 2, width: '100%', py: 2, borderStyle: 'dashed' }}
            >
              Choisir un fichier
              <input
                type="file"
                hidden
                accept=".csv"
                onChange={handleImportFileChange}
              />
            </Button>
            
            {importFile && (
               <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>
                 Fichier : {importFile.name}
                          </Typography>
            )}
            
            {importing && (
                <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2">Importation en cours...</Typography>
                        </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setIsImportDialogOpen(false)} sx={{ color: 'text.secondary' }}>Annuler</Button>
          <StyledButton 
            variant="contained" 
            onClick={handleImportProspects} 
            disabled={!importFile || importing}
            sx={{ bgcolor: APPLE_COLORS.primary }}
          >
            Importer
          </StyledButton>
        </DialogActions>
      </Dialog>
      
      {/* Dialog: Nouveau Prospect */}
      <Dialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Nouveau Dossier Prospect</DialogTitle>
        <DialogContent>
          {structureTokens && structureTokens.tokensRemaining === 0 && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 2, 
                borderRadius: '12px',
                backgroundColor: '#ffebee',
                border: '2px solid #ff3b30',
                '& .MuiAlert-icon': {
                  color: '#ff3b30'
                }
              }}
              icon={<BlockIcon />}
            >
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                Quota mensuel de tokens atteint
              </Typography>
              <Typography variant="body2">
                Vous avez utilisé tous vos {structureTokens.tokensTotal} tokens ce mois-ci. 
                <strong> Impossible d'ajouter un prospect.</strong> Vous pourrez créer de nouveaux prospects le mois prochain.
              </Typography>
            </Alert>
          )}
          {structureTokens && structureTokens.tokensRemaining > 0 && structureTokens.tokensRemaining <= 10 && (
            <Alert severity="info" sx={{ mb: 2, borderRadius: '12px' }}>
              Attention : Il vous reste {structureTokens.tokensRemaining} token{structureTokens.tokensRemaining > 1 ? 's' : ''} ce mois-ci.
            </Alert>
          )}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <StyledTextField 
              label="Nom du contact" 
              fullWidth 
              value={newProspectData.nom} 
              onChange={(e) => setNewProspectData({...newProspectData, nom: e.target.value})} 
            />
            <StyledTextField 
              label="Entreprise"
              fullWidth 
              value={newProspectData.entreprise} 
              onChange={(e) => setNewProspectData({...newProspectData, entreprise: e.target.value})} 
            />
            
            <Autocomplete
              options={assignableMembers}
              getOptionLabel={(option) => option.displayName}
              value={assignableMembers.find(m => m.id === newProspectData.ownerId) || null}
              onChange={(_, newValue) => setNewProspectData({...newProspectData, ownerId: newValue?.id || userData?.uid})}
              renderInput={(params) => (
                <StyledTextField {...params} label="Assigné à" placeholder="Sélectionner un collaborateur" />
              )}
            />

            <StyledTextField 
              label="Email"
              fullWidth 
              value={newProspectData.email} 
              onChange={(e) => setNewProspectData({...newProspectData, email: e.target.value})} 
            />
            <StyledTextField 
              label="Téléphone"
              fullWidth 
              value={newProspectData.telephone} 
              onChange={(e) => setNewProspectData({...newProspectData, telephone: e.target.value})} 
            />
            <StyledTextField 
              label="A recontacter le" 
              type="date"
              fullWidth 
              InputLabelProps={{ shrink: true }}
              value={newProspectData.dateRecontact} 
              onChange={(e) => setNewProspectData({...newProspectData, dateRecontact: e.target.value})} 
            />
            <StyledTextField 
              label="Notes initiales" 
              multiline
              rows={3}
              fullWidth 
              value={newProspectData.notes} 
              onChange={(e) => setNewProspectData({...newProspectData, notes: e.target.value})} 
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setIsCreateDialogOpen(false)} sx={{ color: 'text.secondary' }}>Annuler</Button>
          <StyledButton 
            variant="contained" 
            onClick={handleCreateProspect}
            disabled={structureTokens !== null && structureTokens.tokensRemaining === 0}
            sx={{ 
              bgcolor: APPLE_COLORS.primary,
              '&:disabled': {
                bgcolor: '#e5e5ea',
                color: '#86868b'
              }
            }}
          >
            {structureTokens && structureTokens.tokensRemaining === 0 
              ? 'Quota mensuel atteint' 
              : `Créer le dossier${structureTokens && structureTokens.tokensRemaining > 0 ? ' (1 token)' : ''}`
            }
          </StyledButton>
        </DialogActions>
      </Dialog>

      {/* Dialog: Agenda Complet & Création Événement */}
      <Dialog
        open={showFullAgenda}
        onClose={() => setShowFullAgenda(false)}
        maxWidth="lg"
            fullWidth
        PaperProps={{ sx: { borderRadius: '24px', height: '80vh', overflow: 'hidden' } }}
      >
        <Box sx={{ display: 'flex', height: '100%' }}>
          {/* Sidebar Création (1/3) */}
          <Box sx={{ width: '380px', borderRight: '1px solid #e5e5ea', bgcolor: 'white', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 4, pb: 2 }}>
              <Typography variant="h5" fontWeight={800} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                 <Box sx={{ bgcolor: APPLE_COLORS.primary, color: 'white', borderRadius: '50%', p: 0.5, display: 'flex' }}>
                    <AddIcon fontSize="small" />
        </Box>
                 Nouvel Événement
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Planifiez vos rendez-vous et tâches.</Typography>
            </Box>

            <Box sx={{ px: 4, pb: 4, pt: 3, overflowY: 'auto', flex: 1 }}>
              <Stack spacing={3}>
                <StyledTextField 
                  label="Titre" 
          fullWidth
                  placeholder="Ex: Réunion client, Relance..."
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><EditIcon sx={{ color: 'text.secondary' }} /></InputAdornment>,
                  }}
                />
                
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <StyledTextField 
                    type="date" 
                    fullWidth
                    label="Date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                    InputLabelProps={{ shrink: true }}
                  />
                  <StyledTextField 
                    type="time" 
              fullWidth
                    label="Heure"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({...newEvent, time: e.target.value})}
                    InputLabelProps={{ shrink: true }}
                  />
            </Box>
                
                <TextField
                  select
        fullWidth
                  label="Type d'activité"
                  value={newEvent.type}
                  onChange={(e) => setNewEvent({...newEvent, type: e.target.value as any})}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    sx: { borderRadius: '12px', bgcolor: '#f5f5f7', '& fieldset': { border: 'none' } },
                    startAdornment: <InputAdornment position="start"><CategoryIcon sx={{ color: 'text.secondary' }} /></InputAdornment>
                  }}
                  variant="outlined"
                >
                  <MenuItem value="meeting">Réunion</MenuItem>
                  <MenuItem value="call">Appel</MenuItem>
                  <MenuItem value="task">Tâche</MenuItem>
                  <MenuItem value="deadline">Échéance</MenuItem>
                  <MenuItem value="salon">Salon</MenuItem>
                </TextField>

                <TextField
                  select
        fullWidth
                  label="Visibilité"
                  value={newEvent.visibility}
                  onChange={(e) => setNewEvent({...newEvent, visibility: e.target.value as any})}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    sx: { borderRadius: '12px', bgcolor: '#f5f5f7', '& fieldset': { border: 'none' } },
                    startAdornment: <InputAdornment position="start"><VisibilityIcon sx={{ color: 'text.secondary' }} /></InputAdornment>
                  }}
                        variant="outlined"
                >
                  <MenuItem value="private">Privé (Moi uniquement)</MenuItem>
                  <MenuItem value="structure">Public (Toute la structure)</MenuItem>
                  <MenuItem value="restricted">Restreint (Sélection)</MenuItem>
                </TextField>

                {newEvent.visibility === 'restricted' && (
                  <Box>
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 1.5, color: 'text.secondary' }}>
                      Sélectionner les invités
                    </Typography>
                    <Paper 
                      variant="outlined" 
                      sx={{ 
                        maxHeight: 300, 
                        overflow: 'auto',
                        borderColor: '#e5e5ea',
                        borderRadius: '12px'
                      }}
                    >
                      {/* Membres Devco groupés par mandat */}
                      {(() => {
                        // Filtrer uniquement les membres Devco qui ont un mandat
                        const devcoMembers = structureMembers.filter(m => 
                          m.poles?.some(p => p.poleId === 'dev') && 
                          m.mandat && 
                          m.mandat !== 'Autres'
                        );
                        const devcoByMandat = devcoMembers.reduce((acc, member) => {
                          const mandat = member.mandat!;
                          if (!acc[mandat]) acc[mandat] = [];
                          acc[mandat].push(member);
                          return acc;
                        }, {} as Record<string, StructureMember[]>);
                        
                        const mandatsSorted = Object.keys(devcoByMandat).sort((a, b) => {
                          return b.localeCompare(a);
                        });

                        return mandatsSorted.map(mandat => {
                          const members = devcoByMandat[mandat];
                          const selectedInGroup = members.filter(m => newEvent.invitedUsers?.includes(m.id));
                          const allSelected = selectedInGroup.length === members.length;

                          return (
                            <Box key={`devco-${mandat}`} sx={{ borderBottom: '1px solid #f5f5f7' }}>
                              <ListSubheader 
                                sx={{ 
                                  bgcolor: '#f5f5f7',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  px: 2,
                                  py: 1
                                }}
                              >
                                <Typography variant="subtitle2" fontWeight={600} sx={{ color: APPLE_COLORS.primary }}>
                                  {`Devco - Mandat ${mandat}`}
                                </Typography>
                                {members.length > 1 && (
                                  <Button
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const currentInvitedUsers = newEvent.invitedUsers || [];
                                      
                                      if (allSelected) {
                                        setNewEvent({
                                          ...newEvent,
                                          invitedUsers: currentInvitedUsers.filter(id => !members.some(m => m.id === id))
                                        });
                                      } else {
                                        const newInvitedUsers = [...currentInvitedUsers];
                                        members.forEach(member => {
                                          if (!newInvitedUsers.includes(member.id)) {
                                            newInvitedUsers.push(member.id);
                                          }
                                        });
                                        setNewEvent({
                                          ...newEvent,
                                          invitedUsers: newInvitedUsers
                                        });
                                      }
                                    }}
                                    sx={{ 
                                      minWidth: 'auto',
                                      px: 1.5,
                                      py: 0.5,
                                      fontSize: '0.75rem',
                                      textTransform: 'none',
                                      color: APPLE_COLORS.primary
                                    }}
                                  >
                                    {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                                  </Button>
                                )}
                              </ListSubheader>
                              <List dense>
                                {members.sort((a, b) => a.displayName.localeCompare(b.displayName)).map((member) => (
                                  <ListItem
                                    key={member.id}
                                    button
                                    onClick={() => {
                                      const currentInvitedUsers = newEvent.invitedUsers || [];
                                      const isSelected = currentInvitedUsers.includes(member.id);
                                      
                                      if (isSelected) {
                                        setNewEvent({
                                          ...newEvent,
                                          invitedUsers: currentInvitedUsers.filter(id => id !== member.id)
                                        });
                                      } else {
                                        setNewEvent({
                                          ...newEvent,
                                          invitedUsers: [...currentInvitedUsers, member.id]
                                        });
                                      }
                                    }}
                                    sx={{ py: 0.5 }}
                                  >
                                    <Checkbox
                                      checked={newEvent.invitedUsers?.includes(member.id) || false}
                                      size="small"
                                    />
                                    <ListItemIcon sx={{ minWidth: 36 }}>
                                      <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                                        {member.displayName.charAt(0)}
                                      </Avatar>
                                    </ListItemIcon>
                                    <ListItemText 
                                      primary={member.displayName}
                                      primaryTypographyProps={{ variant: 'body2' }}
                                    />
                                  </ListItem>
                                ))}
                              </List>
                            </Box>
                          );
                        });
                      })()}

                      <Divider sx={{ my: 1 }} />

                      {/* Autres membres de la structure groupés par mandat */}
                      {(() => {
                        // Filtrer uniquement les membres non-Devco qui ont un mandat
                        const otherMembers = structureMembers.filter(m => 
                          !m.poles?.some(p => p.poleId === 'dev') && 
                          m.mandat && 
                          m.mandat !== 'Autres'
                        );
                        const otherByMandat = otherMembers.reduce((acc, member) => {
                          const mandat = member.mandat!;
                          if (!acc[mandat]) acc[mandat] = [];
                          acc[mandat].push(member);
                          return acc;
                        }, {} as Record<string, StructureMember[]>);
                        
                        const mandatsSorted = Object.keys(otherByMandat).sort((a, b) => {
                          return b.localeCompare(a);
                        });

                        return mandatsSorted.map(mandat => {
                          const members = otherByMandat[mandat];
                          const selectedInGroup = members.filter(m => newEvent.invitedUsers?.includes(m.id));
                          const allSelected = selectedInGroup.length === members.length;

                          return (
                            <Box key={`other-${mandat}`} sx={{ borderBottom: '1px solid #f5f5f7' }}>
                              <ListSubheader 
                                sx={{ 
                                  bgcolor: '#fafafa',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  px: 2,
                                  py: 1
                                }}
                              >
                                <Typography variant="subtitle2" fontWeight={600} sx={{ color: 'text.secondary' }}>
                                  {mandat === 'Autres' ? 'Autres' : `Mandat ${mandat}`}
                                </Typography>
                                {members.length > 1 && (
                                  <Button
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const currentInvitedUsers = newEvent.invitedUsers || [];
                                      
                                      if (allSelected) {
                                        setNewEvent({
                                          ...newEvent,
                                          invitedUsers: currentInvitedUsers.filter(id => !members.some(m => m.id === id))
                                        });
                                      } else {
                                        const newInvitedUsers = [...currentInvitedUsers];
                                        members.forEach(member => {
                                          if (!newInvitedUsers.includes(member.id)) {
                                            newInvitedUsers.push(member.id);
                                          }
                                        });
                                        setNewEvent({
                                          ...newEvent,
                                          invitedUsers: newInvitedUsers
                                        });
                                      }
                                    }}
                                    sx={{ 
                                      minWidth: 'auto',
                                      px: 1.5,
                                      py: 0.5,
                                      fontSize: '0.75rem',
                                      textTransform: 'none'
                                    }}
                                  >
                                    {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                                  </Button>
                                )}
                              </ListSubheader>
                              <List dense>
                                {members.sort((a, b) => a.displayName.localeCompare(b.displayName)).map((member) => (
                                  <ListItem
                                    key={member.id}
                                    button
                                    onClick={() => {
                                      const currentInvitedUsers = newEvent.invitedUsers || [];
                                      const isSelected = currentInvitedUsers.includes(member.id);
                                      
                                      if (isSelected) {
                                        setNewEvent({
                                          ...newEvent,
                                          invitedUsers: currentInvitedUsers.filter(id => id !== member.id)
                                        });
                                      } else {
                                        setNewEvent({
                                          ...newEvent,
                                          invitedUsers: [...currentInvitedUsers, member.id]
                                        });
                                      }
                                    }}
                                    sx={{ py: 0.5 }}
                                  >
                                    <Checkbox
                                      checked={newEvent.invitedUsers?.includes(member.id) || false}
                                      size="small"
                                    />
                                    <ListItemIcon sx={{ minWidth: 36 }}>
                                      <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                                        {member.displayName.charAt(0)}
                                      </Avatar>
                                    </ListItemIcon>
                                    <ListItemText 
                                      primary={member.displayName}
                                      primaryTypographyProps={{ variant: 'body2' }}
                                    />
                                  </ListItem>
                                ))}
                              </List>
                            </Box>
                          );
                        });
                      })()}
                    </Paper>
                  </Box>
                )}

                <StyledTextField 
                  label="Description" 
                  multiline 
                  rows={4} 
                  fullWidth 
                  placeholder="Détails supplémentaires..."
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
                      </Box>
            
            <Box sx={{ p: 3, borderTop: '1px solid #e5e5ea' }}>
                <StyledButton 
                        variant="contained"
                    fullWidth 
                    size="large" 
                    startIcon={<AddIcon />}
                    sx={{ bgcolor: APPLE_COLORS.primary, py: 1.5, borderRadius: '12px', fontSize: '1rem' }}
                    onClick={handleCreateEvent}
                >
                    Ajouter au calendrier
                </StyledButton>
                    </Box>
          </Box>

          {/* Calendrier View (2/3) */}
          <Box sx={{ flex: 1, bgcolor: '#fbfbfd', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e5ea', display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'white' }}>
              <Box>
                  <Typography variant="h6" fontWeight={800}>Agenda de l'équipe</Typography>
                  <Typography variant="body2" color="text.secondary">Vue d'ensemble des événements à venir</Typography>
                          </Box>
              <IconButton onClick={() => setShowFullAgenda(false)} sx={{ bgcolor: '#f5f5f7' }}><CloseIcon /></IconButton>
            </Box>

            <Box sx={{ p: 4, overflowY: 'auto', flex: 1 }}>
              {/* Liste des événements */}
              {events.length === 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.6 }}>
                  <Box sx={{ width: 80, height: 80, bgcolor: '#e5e5ea', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                      <CalendarMonthIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                      </Box>
                  <Typography variant="h6" fontWeight={600} color="text.secondary">Aucun événement</Typography>
                  <Typography variant="body2" color="text.secondary">Votre calendrier est vide pour le moment.</Typography>
                </Box>
              ) : (
                 <Stack spacing={2}>
                    {events.sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime()).map((evt, index) => {
                        const date = new Date(evt.start);
                        const isNewDay = index === 0 || new Date(events[index-1].start).toDateString() !== date.toDateString();
                        
                        return (
                            <Box key={evt.id}>
                                {isNewDay && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, mt: index > 0 ? 2 : 0 }}>
                                        <Typography variant="subtitle2" fontWeight={700} sx={{ color: APPLE_COLORS.primary, bgcolor: 'rgba(0,113,227,0.1)', px: 1.5, py: 0.5, borderRadius: '8px' }}>
                                            {date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                                        </Typography>
                                        <Box sx={{ flex: 1, height: '1px', bgcolor: '#e5e5ea', ml: 2 }} />
                                    </Box>
                                )}
                                <Paper 
                                    elevation={0}
                          onClick={() => {
                            // Si c'est un événement de relance avec prospectId, naviguer vers le prospect
                            if (evt.prospectId || (evt.type === 'reminder' && evt.title?.includes('Relance:'))) {
                              const prospectId = evt.prospectId || (evt as any).prospectId || evt.id.replace('relance-', '');
                              if (prospectId && !prospectId.startsWith('relance-')) {
                                navigate(`/prospect/${prospectId}`);
                              } else if (prospectId) {
                                navigate(`/prospect/${prospectId.replace('relance-', '')}`);
                              }
                            } else if (!evt.id.startsWith('relance-')) {
                              handleEditEvent(evt);
                            }
                          }}
                          sx={{
                                        p: 2.5, 
                                        borderRadius: '16px', 
                                        border: '1px solid #e5e5ea',
                                        display: 'flex', 
                                        gap: 2,
                                        transition: 'all 0.2s',
                                        cursor: 'pointer',
                                        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderColor: APPLE_COLORS.primary }
                                    }}
                                >
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 60, bgcolor: '#f5f5f7', borderRadius: '12px', p: 1, height: 'fit-content' }}>
                                        <Typography variant="caption" color="text.secondary" fontWeight={600}>{date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Typography>
                                        <Box sx={{ my: 0.5 }}>
                                            {evt.type === 'meeting' && <GroupIcon fontSize="small" sx={{ color: '#ff9f0a' }} />}
                                            {evt.type === 'call' && <PhoneIcon fontSize="small" sx={{ color: '#30b0c7' }} />}
                                            {evt.type === 'task' && <CheckCircleIcon fontSize="small" sx={{ color: '#34c759' }} />}
                                            {evt.type === 'deadline' && <FlagIcon fontSize="small" sx={{ color: '#ff3b30' }} />}
                                            {evt.type === 'salon' && <StoreIcon fontSize="small" sx={{ color: '#bf5af2' }} />}
                                            {evt.type === 'reminder' && <NotificationsIcon fontSize="small" sx={{ color: '#ff9f0a' }} />}
                    </Box>
                                    </Box>
                                    
                                    <Box sx={{ flex: 1 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.2, mb: 0.5 }}>{evt.title}</Typography>
                                            {evt.visibility === 'private' && <LockIcon sx={{ fontSize: 16, color: 'text.secondary', opacity: 0.5 }} />}
                        </Box>
                                        
                                        {evt.description && (
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                {evt.description}
                              </Typography>
                                        )}

                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Chip 
                                                label={evt.type.charAt(0).toUpperCase() + evt.type.slice(1)} 
                                                size="small" 
                                                sx={{ height: 24, bgcolor: '#f5f5f7', fontWeight: 600, fontSize: '0.75rem' }} 
                                            />
                                            {evt.invitedUsers && evt.invitedUsers.length > 0 && (
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    {evt.invitedUsers.slice(0, 3).map((uid, i) => (
                                                        <Avatar key={i} sx={{ width: 24, height: 24, fontSize: '0.7rem', border: '2px solid white', ml: i > 0 ? -1 : 0 }}>
                                                            {uid.charAt(0)}
                                                        </Avatar>
                                                    ))}
                                                    {evt.invitedUsers.length > 3 && (
                                                        <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary', fontWeight: 600 }}>+{evt.invitedUsers.length - 3}</Typography>
                            )}
                          </Box>
                      )}
                    </Box>
                                    </Box>
                                </Paper>
                            </Box>
                        );
                    })}
                 </Stack>
              )}
            </Box>
          </Box>
        </Box>
      </Dialog>

      {/* Dialog: Éditer un événement */}
      <Dialog
        open={editEventDialogOpen}
        onClose={() => {
          setEditEventDialogOpen(false);
          setEditingEvent(null);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '24px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.5rem', pb: 2 }}>
          Modifier l'événement
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <StyledTextField 
              label="Titre" 
              fullWidth
              placeholder="Ex: Réunion client, Relance..."
              value={editEventForm.title}
              onChange={(e) => setEditEventForm({...editEventForm, title: e.target.value})}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><EditIcon sx={{ color: 'text.secondary' }} /></InputAdornment>,
              }}
            />
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <StyledTextField 
                type="date" 
                fullWidth
                label="Date"
                value={editEventForm.date}
                onChange={(e) => setEditEventForm({...editEventForm, date: e.target.value})}
                InputLabelProps={{ shrink: true }}
              />
              <StyledTextField 
                type="time" 
                fullWidth
                label="Heure"
                value={editEventForm.time}
                onChange={(e) => setEditEventForm({...editEventForm, time: e.target.value})}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
                
            <TextField
              select
              fullWidth
              label="Type d'activité"
              value={editEventForm.type}
              onChange={(e) => setEditEventForm({...editEventForm, type: e.target.value as any})}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                sx: { borderRadius: '12px', bgcolor: '#f5f5f7', '& fieldset': { border: 'none' } },
                startAdornment: <InputAdornment position="start"><CategoryIcon sx={{ color: 'text.secondary' }} /></InputAdornment>
              }}
              variant="outlined"
            >
              <MenuItem value="meeting">Réunion</MenuItem>
              <MenuItem value="call">Appel</MenuItem>
              <MenuItem value="task">Tâche</MenuItem>
              <MenuItem value="deadline">Échéance</MenuItem>
              <MenuItem value="salon">Salon</MenuItem>
            </TextField>

            <TextField
              select
              fullWidth
              label="Visibilité"
              value={editEventForm.visibility}
              onChange={(e) => setEditEventForm({...editEventForm, visibility: e.target.value as any})}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                sx: { borderRadius: '12px', bgcolor: '#f5f5f7', '& fieldset': { border: 'none' } },
                startAdornment: <InputAdornment position="start"><VisibilityIcon sx={{ color: 'text.secondary' }} /></InputAdornment>
              }}
              variant="outlined"
            >
              <MenuItem value="private">Privé (Moi uniquement)</MenuItem>
              <MenuItem value="structure">Public (Toute la structure)</MenuItem>
              <MenuItem value="restricted">Restreint (Sélection)</MenuItem>
            </TextField>

            {editEventForm.visibility === 'restricted' && (
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1.5, color: 'text.secondary' }}>
                  Sélectionner les invités
                </Typography>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    maxHeight: 300, 
                    overflow: 'auto',
                    borderColor: '#e5e5ea',
                    borderRadius: '12px'
                  }}
                >
                  {/* Membres Devco groupés par mandat */}
                  {(() => {
                    const devcoMembers = structureMembers.filter(m => 
                      m.poles?.some(p => p.poleId === 'dev') && 
                      m.mandat && 
                      m.mandat !== 'Autres'
                    );
                    const devcoByMandat = devcoMembers.reduce((acc, member) => {
                      const mandat = member.mandat!;
                      if (!acc[mandat]) acc[mandat] = [];
                      acc[mandat].push(member);
                      return acc;
                    }, {} as Record<string, StructureMember[]>);
                    
                    const mandatsSorted = Object.keys(devcoByMandat).sort((a, b) => {
                      return b.localeCompare(a);
                    });

                    return mandatsSorted.map(mandat => {
                      const members = devcoByMandat[mandat];
                      const selectedInGroup = members.filter(m => editEventForm.invitedUsers?.includes(m.id));
                      const allSelected = selectedInGroup.length === members.length;

                      return (
                        <Box key={`devco-${mandat}`} sx={{ borderBottom: '1px solid #f5f5f7' }}>
                          <ListSubheader 
                            sx={{ 
                              bgcolor: '#f5f5f7',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              px: 2,
                              py: 1
                            }}
                          >
                            <Typography variant="subtitle2" fontWeight={600} sx={{ color: APPLE_COLORS.primary }}>
                              {`Devco - Mandat ${mandat}`}
                            </Typography>
                            {members.length > 1 && (
                              <Button
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentInvitedUsers = editEventForm.invitedUsers || [];
                                  
                                  if (allSelected) {
                                    setEditEventForm({
                                      ...editEventForm,
                                      invitedUsers: currentInvitedUsers.filter(id => !members.some(m => m.id === id))
                                    });
                                  } else {
                                    const newInvitedUsers = [...currentInvitedUsers];
                                    members.forEach(member => {
                                      if (!newInvitedUsers.includes(member.id)) {
                                        newInvitedUsers.push(member.id);
                                      }
                                    });
                                    setEditEventForm({
                                      ...editEventForm,
                                      invitedUsers: newInvitedUsers
                                    });
                                  }
                                }}
                                sx={{ 
                                  minWidth: 'auto',
                                  px: 1.5,
                                  py: 0.5,
                                  fontSize: '0.75rem',
                                  textTransform: 'none',
                                  color: APPLE_COLORS.primary
                                }}
                              >
                                {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                              </Button>
                            )}
                          </ListSubheader>
                          <List dense>
                            {members.sort((a, b) => a.displayName.localeCompare(b.displayName)).map((member) => (
                              <ListItem
                                key={member.id}
                                button
                                onClick={() => {
                                  const currentInvitedUsers = editEventForm.invitedUsers || [];
                                  const isSelected = currentInvitedUsers.includes(member.id);
                                  
                                  if (isSelected) {
                                    setEditEventForm({
                                      ...editEventForm,
                                      invitedUsers: currentInvitedUsers.filter(id => id !== member.id)
                                    });
                                  } else {
                                    setEditEventForm({
                                      ...editEventForm,
                                      invitedUsers: [...currentInvitedUsers, member.id]
                                    });
                                  }
                                }}
                                sx={{ py: 0.5 }}
                              >
                                <Checkbox
                                  checked={editEventForm.invitedUsers?.includes(member.id) || false}
                                  size="small"
                                />
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                  <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                                    {member.displayName.charAt(0)}
                                  </Avatar>
                                </ListItemIcon>
                                <ListItemText 
                                  primary={member.displayName}
                                  primaryTypographyProps={{ variant: 'body2' }}
                                />
                              </ListItem>
                            ))}
                          </List>
                        </Box>
                      );
                    });
                  })()}

                  <Divider sx={{ my: 1 }} />

                  {/* Autres membres de la structure groupés par mandat */}
                  {(() => {
                    const otherMembers = structureMembers.filter(m => 
                      !m.poles?.some(p => p.poleId === 'dev') && 
                      m.mandat && 
                      m.mandat !== 'Autres'
                    );
                    const otherByMandat = otherMembers.reduce((acc, member) => {
                      const mandat = member.mandat!;
                      if (!acc[mandat]) acc[mandat] = [];
                      acc[mandat].push(member);
                      return acc;
                    }, {} as Record<string, StructureMember[]>);
                    
                    const mandatsSorted = Object.keys(otherByMandat).sort((a, b) => {
                      return b.localeCompare(a);
                    });

                    return mandatsSorted.map(mandat => {
                      const members = otherByMandat[mandat];
                      const selectedInGroup = members.filter(m => editEventForm.invitedUsers?.includes(m.id));
                      const allSelected = selectedInGroup.length === members.length;

                      return (
                        <Box key={`other-${mandat}`} sx={{ borderBottom: '1px solid #f5f5f7' }}>
                          <ListSubheader 
                            sx={{ 
                              bgcolor: '#fafafa',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              px: 2,
                              py: 1
                            }}
                          >
                            <Typography variant="subtitle2" fontWeight={600} sx={{ color: 'text.secondary' }}>
                              {`Mandat ${mandat}`}
                            </Typography>
                            {members.length > 1 && (
                              <Button
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentInvitedUsers = editEventForm.invitedUsers || [];
                                  
                                  if (allSelected) {
                                    setEditEventForm({
                                      ...editEventForm,
                                      invitedUsers: currentInvitedUsers.filter(id => !members.some(m => m.id === id))
                                    });
                                  } else {
                                    const newInvitedUsers = [...currentInvitedUsers];
                                    members.forEach(member => {
                                      if (!newInvitedUsers.includes(member.id)) {
                                        newInvitedUsers.push(member.id);
                                      }
                                    });
                                    setEditEventForm({
                                      ...editEventForm,
                                      invitedUsers: newInvitedUsers
                                    });
                                  }
                                }}
                                sx={{ 
                                  minWidth: 'auto',
                                  px: 1.5,
                                  py: 0.5,
                                  fontSize: '0.75rem',
                                  textTransform: 'none'
                                }}
                              >
                                {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                              </Button>
                            )}
                          </ListSubheader>
                          <List dense>
                            {members.sort((a, b) => a.displayName.localeCompare(b.displayName)).map((member) => (
                              <ListItem
                                key={member.id}
                                button
                                onClick={() => {
                                  const currentInvitedUsers = editEventForm.invitedUsers || [];
                                  const isSelected = currentInvitedUsers.includes(member.id);
                                  
                                  if (isSelected) {
                                    setEditEventForm({
                                      ...editEventForm,
                                      invitedUsers: currentInvitedUsers.filter(id => id !== member.id)
                                    });
                                  } else {
                                    setEditEventForm({
                                      ...editEventForm,
                                      invitedUsers: [...currentInvitedUsers, member.id]
                                    });
                                  }
                                }}
                                sx={{ py: 0.5 }}
                              >
                                <Checkbox
                                  checked={editEventForm.invitedUsers?.includes(member.id) || false}
                                  size="small"
                                />
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                  <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                                    {member.displayName.charAt(0)}
                                  </Avatar>
                                </ListItemIcon>
                                <ListItemText 
                                  primary={member.displayName}
                                  primaryTypographyProps={{ variant: 'body2' }}
                                />
                              </ListItem>
                            ))}
                          </List>
                        </Box>
                      );
                    });
                  })()}
                </Paper>
              </Box>
            )}

            <StyledTextField 
              label="Description" 
              multiline 
              rows={4} 
              fullWidth 
              placeholder="Détails supplémentaires..."
              value={editEventForm.description}
              onChange={(e) => setEditEventForm({...editEventForm, description: e.target.value})}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: '1px solid #e5e5ea', display: 'flex', justifyContent: 'space-between' }}>
          <Button 
            onClick={handleDeleteEvent}
            sx={{
              color: '#ff3b30',
              '&:hover': {
                backgroundColor: 'rgba(255, 59, 48, 0.08)'
              }
            }}
            startIcon={<DeleteIcon />}
          >
            Supprimer
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              onClick={() => {
                setEditEventDialogOpen(false);
                setEditingEvent(null);
              }}
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)'
                }
              }}
            >
              Annuler
            </Button>
            <StyledButton 
              variant="contained"
              onClick={handleUpdateEvent}
              sx={{
                bgcolor: APPLE_COLORS.primary,
                '&:hover': {
                  bgcolor: '#0077ed'
                }
              }}
            >
              Enregistrer les modifications
            </StyledButton>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Popover pour choisir la date de relance */}
      <Popover
        open={Boolean(relancePopoverAnchor)}
        anchorEl={relancePopoverAnchor}
        onClose={handleCloseRelancePopover}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            p: 2.5,
            mt: 1,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            border: '1px solid #e5e5ea',
            minWidth: 320,
            maxWidth: 400
          }
        }}
        disableRestoreFocus
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'text.primary', mb: 0.5 }}>
            Date de relance
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
            Choisissez quand vous souhaitez être notifié pour relancer ce contact.
          </Typography>
          
          {/* Choix rapides */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            <Button
              size="small"
              variant={relanceDate === (() => {
                const date = new Date();
                date.setDate(date.getDate() + 3);
                return date.toISOString().split('T')[0];
              })() ? 'contained' : 'outlined'}
              onClick={() => {
                const date = new Date();
                date.setDate(date.getDate() + 3);
                setRelanceDate(date.toISOString().split('T')[0]);
              }}
              sx={{
                textTransform: 'none',
                fontSize: '0.8rem',
                borderRadius: '8px',
                px: 2,
                py: 0.75,
                borderColor: '#e5e5ea',
                '&:hover': {
                  borderColor: APPLE_COLORS.primary,
                  bgcolor: 'rgba(0, 113, 227, 0.04)'
                }
              }}
            >
              Dans 3 jours
            </Button>
            <Button
              size="small"
              variant={relanceDate === (() => {
                const date = new Date();
                date.setDate(date.getDate() + 7);
                return date.toISOString().split('T')[0];
              })() ? 'contained' : 'outlined'}
              onClick={() => {
                const date = new Date();
                date.setDate(date.getDate() + 7);
                setRelanceDate(date.toISOString().split('T')[0]);
              }}
              sx={{
                textTransform: 'none',
                fontSize: '0.8rem',
                borderRadius: '8px',
                px: 2,
                py: 0.75,
                borderColor: '#e5e5ea',
                '&:hover': {
                  borderColor: APPLE_COLORS.primary,
                  bgcolor: 'rgba(0, 113, 227, 0.04)'
                }
              }}
            >
              Dans 1 semaine
            </Button>
            <Button
              size="small"
              variant={relanceDate === (() => {
                const date = new Date();
                date.setMonth(date.getMonth() + 1);
                return date.toISOString().split('T')[0];
              })() ? 'contained' : 'outlined'}
              onClick={() => {
                const date = new Date();
                date.setMonth(date.getMonth() + 1);
                setRelanceDate(date.toISOString().split('T')[0]);
              }}
              sx={{
                textTransform: 'none',
                fontSize: '0.8rem',
                borderRadius: '8px',
                px: 2,
                py: 0.75,
                borderColor: '#e5e5ea',
                '&:hover': {
                  borderColor: APPLE_COLORS.primary,
                  bgcolor: 'rgba(0, 113, 227, 0.04)'
                }
              }}
            >
              Dans 1 mois
            </Button>
          </Box>
          
          <TextField
            type="date"
            value={relanceDate}
            onChange={(e) => setRelanceDate(e.target.value)}
            size="small"
            fullWidth
            label="Date de relance"
            InputLabelProps={{ shrink: true }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '10px',
                bgcolor: '#f5f5f7',
                '& fieldset': {
                  borderColor: 'transparent'
                },
                '&:hover': {
                  bgcolor: '#e5e5ea'
                },
                '&.Mui-focused': {
                  bgcolor: 'white',
                  boxShadow: '0 0 0 2px rgba(0, 113, 227, 0.2)',
                  '& fieldset': {
                    borderColor: APPLE_COLORS.primary
                  }
                }
              }
            }}
            autoFocus
          />
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', mt: 2 }}>
            <Button
              size="small"
              onClick={handleCloseRelancePopover}
              sx={{
                color: 'text.secondary',
                textTransform: 'none',
                fontSize: '0.875rem',
                borderRadius: '8px',
                px: 2,
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)'
                }
              }}
            >
              Plus tard
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleSaveRelanceDate}
              sx={{
                bgcolor: APPLE_COLORS.primary,
                textTransform: 'none',
                fontSize: '0.875rem',
                borderRadius: '8px',
                px: 3,
                boxShadow: 'none',
                '&:hover': {
                  bgcolor: '#0077ed',
                  boxShadow: '0 2px 8px rgba(0, 113, 227, 0.3)'
                }
              }}
            >
              Valider
            </Button>
          </Box>
        </Box>
      </Popover>

      {/* Dialog: Confirmation de suppression */}
      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: APPLE_COLORS.error }}>
          Confirmer la suppression
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2, borderRadius: '12px' }}>
            Cette action est irréversible.
          </Alert>
          <Typography variant="body1" sx={{ mb: 1 }}>
            Êtes-vous sûr de vouloir supprimer <strong>{selectedProspects.length}</strong> prospect(s) ?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Les tâches et événements de calendrier associés (comme les relances) seront également supprimés.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={() => setIsDeleteDialogOpen(false)} 
            sx={{ color: 'text.secondary' }}
          >
            Annuler
          </Button>
          <StyledButton 
            variant="contained" 
            onClick={handleDeleteSelectedProspects}
            startIcon={<DeleteIcon />}
            sx={{ 
              bgcolor: APPLE_COLORS.error,
              '&:hover': {
                bgcolor: '#d32f2f'
              }
            }}
          >
            Supprimer {selectedProspects.length} prospect(s)
          </StyledButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Commercial; 