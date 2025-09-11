import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Avatar,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar,
  Divider,
  Card,
  CardContent,
  CardActions,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemAvatar,
  Badge,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Breadcrumbs,
  Link,
  Stack,
  alpha,
  Menu,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Description as DescriptionIcon,
  CalendarToday as CalendarIcon,
  LocationOn as LocationIcon,
  Euro as EuroIcon,
  WorkHistory as WorkHistoryIcon,
  Add as AddIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  AttachFile as AttachFileIcon,
  ExpandMore as ExpandMoreIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  PowerSettingsNew as PowerSettingsNewIcon,
  People as PeopleIcon,
  Folder as FolderIcon,
  Home as HomeIcon,
  NavigateNext as NavigateNextIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Description as DescriptionTabIcon,
  Settings as SettingsIcon,
  CloudUpload as CloudUploadIcon,
  PersonAdd as PersonAddIcon,
  Close as CloseIcon,
  DragIndicator as DragIndicatorIcon,
  MoreVert as MoreVertIcon,
  CalendarMonth as CalendarMonthIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, deleteDoc, deleteField, writeBatch } from 'firebase/firestore';
import { keyframes } from '@mui/system';
import { styled } from '@mui/material';
import { uploadCompanyLogo } from '../firebase/storage';

// Animations
const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const slideInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const slideInLeft = keyframes`
  from {
    opacity: 0;
    transform: translateX(-30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

const pulse = keyframes`
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
`;

// Styles personnalisés
const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    transition: 'all 0.3s ease-in-out',
    '&:hover': {
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.primary.main,
      },
    },
  },
}));

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: '24px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
    animation: `${scaleIn} 0.3s ease-out`,
  },
}));

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

interface EtudeData {
  id?: string;
  numeroEtude: string;
  companyId?: string; // ID de l'entreprise
  company: string; // Nom de l'entreprise
  companyLogo?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  consultantCount?: number;
  hours?: number | null;
  jeh?: number | null;
  status: string;
  structureId?: string;
  chargeId: string;
  chargeIds?: string[];
  chargeName: string;
  chargePhotoURL?: string | null;
  description?: string | null;
  prixHT?: number;
  missionTypeId?: string | null;
  missionTypeName?: string | null;
  createdAt?: any;
  createdBy?: string;
  isPublic: boolean;
  etape: 'Négociation' | 'Recrutement' | 'Facturation' | 'Audit';
  permissions?: {
    viewers: string[];
    editors: string[];
  };
  isArchived?: boolean;
  pricingType?: 'jeh' | 'hourly';
}

interface ChargeData {
  id: string;
  displayName: string;
  photoURL?: string;
}

interface PlanningTask {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  assignedTo: string;
  status: 'À faire' | 'En cours' | 'Terminé';
  budget: number;
  priority: 'Basse' | 'Moyenne' | 'Haute';
}

interface BudgetItem {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  budget: number;
  color: string;
  status: 'Planifié' | 'En cours' | 'Terminé' | 'Annulé';
  createdAt: Date;
  createdBy: string;
  etudeId: string;
  jehCount?: number;
  jehRate?: number;
  hoursCount?: number;
  hourlyRate?: number;
  // Nouveaux champs pour le recrutement
  studentsToRecruit?: number;
  linkedBudgetItems?: string[]; // IDs des postes de budget liés
  recruitmentStatus?: 'Non démarré' | 'En cours' | 'Terminé';
  recruitedStudents?: number;
}

interface RecruitmentTask {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  remuneration: number;
  duration: number; // en heures
  status: 'Ouvert' | 'En cours' | 'Fermé';
  applications: number;
  deadline: string;
  startDate?: string;
  endDate?: string;
  location?: string; // Lieu de la tâche
  // Champs de publication
  isPublished?: boolean;
  publishedAt?: Date;
  isPublic?: boolean;
  // Nouveaux champs pour le recrutement lié aux postes de budget
  budgetItemIds?: string[]; // IDs des postes de budget associés
  studentsToRecruit?: number;
  recruitedStudents?: number;
  linkedRecruitment?: boolean; // Indique si c'est un recrutement lié à plusieurs postes
  // Champs pour les exigences de candidature
  requiresCV?: boolean;
  requiresMotivation?: boolean;
}

interface RecruitmentApplication {
  id: string;
  recruitmentTaskId: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  userPhotoURL?: string;
  cvUrl?: string;
  cvUpdatedAt?: Date;
  motivationLetter?: string;
  status: 'En attente' | 'Acceptée' | 'Refusée' | 'Ajouté manuellement';
  submittedAt: Date;
  updatedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  addedManually?: boolean;
}

interface Document {
  id: string;
  name: string;
  type: 'powerpoint' | 'pdf' | 'excel' | 'word' | 'other';
  url: string;
  uploadedAt: Date;
  uploadedBy: string;
  size: number;
  isDraft?: boolean;
  etudeId?: string;
  missionId?: string;
  numeroMission?: string;
  structureId?: string;
  companyId?: string;
  companyName?: string;
  quoteData?: any; // Données complètes de la proposition
  structureData?: any; // Données complètes de la structure
  missionData?: any; // Données complètes de la mission
  options?: any; // Options d'affichage
  documentTitle?: string; // Titre personnalisé du document
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position?: string;
  phone?: string;
  linkedin?: string;
  gender?: 'homme' | 'femme';
  createdAt: Date;
  createdBy: string;
  isDefault: boolean;
  notes?: ContactNote[];
}

interface ContactNote {
  id: string;
  content: string;
  createdBy: string;
  authorName?: string;
  createdAt: Date;
}

interface Company {
  id: string;
  name: string;
  siret?: string;
  description?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
  contacts?: Contact[];
  missionsCount?: number;
  totalRevenue?: number;
  createdAt?: Date;
  updatedAt?: Date;
  structureId: string;
}

interface MissionDescription {
  id: string;
  title: string;
  missionDescription: string;
  studentProfile: string;
  courseApplication: string;
  missionLearning: string;
  structureId: string;
}

interface EtudeNote {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string;
  createdByName: string;
  createdByPhotoURL?: string;
  etudeId: string;
  etudeNumber: string;
}

interface HistoryEntry {
  id: string;
  date: string;
  action: string;
  details: string;
  type: 'etude' | 'profile' | 'document' | 'system';
  userId: string;
  userName: string;
  modifications?: string[];
  sessionId?: string;
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
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
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

const EtudeDetails: React.FC = () => {
  const { etudeNumber } = useParams<{ etudeNumber: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [etude, setEtude] = useState<EtudeData | null>(null);
  const [originalEtude, setOriginalEtude] = useState<EtudeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [availableCharges, setAvailableCharges] = useState<ChargeData[]>([]);
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
  const [availableMissionTypes, setAvailableMissionTypes] = useState<MissionDescription[]>([]);
  const [tabValue, setTabValue] = useState(0);
  const [planningTasks, setPlanningTasks] = useState<PlanningTask[]>([]);
  const [recruitmentTasks, setRecruitmentTasks] = useState<RecruitmentTask[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [selectAllDocuments, setSelectAllDocuments] = useState(false);
  const [documentPreviewOpen, setDocumentPreviewOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [deletingDocument, setDeletingDocument] = useState<string | null>(null);
  const [notes, setNotes] = useState<EtudeNote[]>([]);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'info' | 'warning'
  });
  const [jehLinked, setJehLinked] = useState(true);
  const [pendingModifications, setPendingModifications] = useState<string[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number>(0);
  const [selectionEnd, setSelectionEnd] = useState<number>(0);
  const [mousePosition, setMousePosition] = useState<number>(0);
  const [quickTaskDialogOpen, setQuickTaskDialogOpen] = useState(false);
  const [quickTask, setQuickTask] = useState<Partial<PlanningTask>>({});
  const [budgetItemDialogOpen, setBudgetItemDialogOpen] = useState(false);
  const [newBudgetItem, setNewBudgetItem] = useState<Partial<BudgetItem>>({});
  const [editingBudgetItem, setEditingBudgetItem] = useState<BudgetItem | null>(null);
  const [quickBudgetDialogOpen, setQuickBudgetDialogOpen] = useState(false);
  const [quickBudgetPosition, setQuickBudgetPosition] = useState({ x: 0, y: 0 });
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [maxWeeks, setMaxWeeks] = useState(4);
  const [creatingBudgetItem, setCreatingBudgetItem] = useState<BudgetItem | null>(null);
  const [pricingType, setPricingType] = useState<'jeh' | 'hourly'>('jeh');
  const [pricingMenuAnchor, setPricingMenuAnchor] = useState<null | HTMLElement>(null);
  const [tempJehInput, setTempJehInput] = useState<string>('');
  const [tempHoursInput, setTempHoursInput] = useState<string>('');
  const [tempHourlyRateInput, setTempHourlyRateInput] = useState<string>('');
  const [tempJehRateInput, setTempJehRateInput] = useState<string>('');
  const [tempBudgetInput, setTempBudgetInput] = useState<string>('');

  // États pour le recrutement lié aux postes de budget
  const [selectedBudgetItems, setSelectedBudgetItems] = useState<string[]>([]);
  const [linkedRecruitmentMode, setLinkedRecruitmentMode] = useState(false);
  const [recruitmentStudentsCount, setRecruitmentStudentsCount] = useState<number>(1);
  
  // États pour l'édition des tâches de recrutement
  const [editingRecruitmentTask, setEditingRecruitmentTask] = useState<RecruitmentTask | null>(null);
  const [editRecruitmentDialogOpen, setEditRecruitmentDialogOpen] = useState(false);
  
  // États pour les candidatures aux tâches de recrutement
  const [recruitmentApplications, setRecruitmentApplications] = useState<RecruitmentApplication[]>([]);
  const [selectedRecruitmentTask, setSelectedRecruitmentTask] = useState<RecruitmentTask | null>(null);
  const [applicationsDialogOpen, setApplicationsDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<RecruitmentApplication | null>(null);
  const [applicationDetailDialogOpen, setApplicationDetailDialogOpen] = useState(false);
  const [applicationsCounts, setApplicationsCounts] = useState<{[taskId: string]: number}>({});
  const [pendingApplicationsCounts, setPendingApplicationsCounts] = useState<{[taskId: string]: number}>({});
  const [recruitedStudentsByTask, setRecruitedStudentsByTask] = useState<{[taskId: string]: RecruitmentApplication[]}>({});
  const [recruitedStudentsDialogOpen, setRecruitedStudentsDialogOpen] = useState(false);
  const [selectedRecruitedStudents, setSelectedRecruitedStudents] = useState<RecruitmentApplication[]>([]);
  const [selectedRecruitedStudentsTitle, setSelectedRecruitedStudentsTitle] = useState<string>('');
  const [cvPreviewOpen, setCvPreviewOpen] = useState(false);
  const [cvPreviewUrl, setCvPreviewUrl] = useState<string>('');

  // États pour le déplacement de la popup
  // Permet de déplacer la popup des postes de budget en cliquant sur la zone de titre
  const [isDraggingPopup, setIsDraggingPopup] = useState(false);
  const [dragStartPosition, setDragStartPosition] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Calculer le nombre de semaines par défaut basé sur les budget items
  const calculateDefaultMaxWeeks = () => {
    const maxWeekFromBudgetItems = budgetItems.reduce((max, item) => {
      // Vérifier la date de début
      const startWeekMatch = item.startDate.match(/S(\d+)/);
      if (startWeekMatch) {
        const startWeekNumber = parseInt(startWeekMatch[1]);
        max = Math.max(max, startWeekNumber);
      }
      
      // Vérifier la date de fin
      const endWeekMatch = item.endDate.match(/S(\d+)/);
      if (endWeekMatch) {
        const endWeekNumber = parseInt(endWeekMatch[1]);
        max = Math.max(max, endWeekNumber);
      }
      
      return max;
    }, 4); // Minimum 4 semaines
    
    return Math.max(4, maxWeekFromBudgetItems);
  };
  const [resizingBudgetItem, setResizingBudgetItem] = useState<BudgetItem | null>(null);
  const [resizeStart, setResizeStart] = useState<number>(0);
  const [resizeType, setResizeType] = useState<'start' | 'end' | 'move' | null>(null);
  const [originalDates, setOriginalDates] = useState<{ startDate: string; endDate: string } | null>(null);

  // Fonction utilitaire pour calculer le minimum de semaines requis
  const getMinRequiredWeeks = () => {
    return budgetItems.reduce((max, item) => {
      // Vérifier la date de début
      const startWeekMatch = item.startDate.match(/S(\d+)/);
      if (startWeekMatch) {
        const startWeekNumber = parseInt(startWeekMatch[1]);
        max = Math.max(max, startWeekNumber);
      }
      
      // Vérifier la date de fin
      const endWeekMatch = item.endDate.match(/S(\d+)/);
      if (endWeekMatch) {
        const endWeekNumber = parseInt(endWeekMatch[1]);
        max = Math.max(max, endWeekNumber);
      }
      
      return max;
    }, 4); // Minimum 4 semaines
  }; // Facteur de zoom (1 = normal, 2 = double largeur, etc.)

  // Debug: Log des états
  useEffect(() => {
    console.log('🔍 Debug states:', {
      isSelectingRange,
      quickBudgetDialogOpen,
      quickBudgetPosition,
      editingBudgetItem: editingBudgetItem?.title,
      budgetItemsCount: budgetItems.length
    });
  }, [isSelectingRange, quickBudgetDialogOpen, quickBudgetPosition, editingBudgetItem, budgetItems.length]);

  // Sauvegarder le zoom et maxWeeks dans le localStorage
  useEffect(() => {
    localStorage.setItem('timelineZoom', timelineZoom.toString());
  }, [timelineZoom]);

  useEffect(() => {
    localStorage.setItem('maxWeeks', maxWeeks.toString());
  }, [maxWeeks]);

  // Charger le zoom et maxWeeks depuis le localStorage au démarrage
  useEffect(() => {
    const savedZoom = localStorage.getItem('timelineZoom');
    if (savedZoom) {
      setTimelineZoom(parseFloat(savedZoom));
    }
    
    const savedMaxWeeks = localStorage.getItem('maxWeeks');
    if (savedMaxWeeks) {
      setMaxWeeks(parseInt(savedMaxWeeks));
    }
    
    // Charger la position de la popup depuis le localStorage
    const savedPopupPosition = localStorage.getItem('budgetPopupPosition');
    if (savedPopupPosition) {
      try {
        const position = JSON.parse(savedPopupPosition);
        // Vérifier que la position est valide
        if (position.x !== undefined && position.y !== undefined) {
          setQuickBudgetPosition(position);
        }
      } catch (error) {
        console.warn('Erreur lors du chargement de la position de la popup:', error);
      }
    } else {
      // Centrer la popup par défaut si aucune position n'est sauvegardée
      const centerX = (window.innerWidth - 320) / 2;
      const centerY = (window.innerHeight - 400) / 2;
      setQuickBudgetPosition({ x: centerX, y: centerY });
    }
  }, []);

  // Mettre à jour maxWeeks automatiquement basé sur les budget items
  useEffect(() => {
    const defaultMaxWeeks = calculateDefaultMaxWeeks();
    const savedMaxWeeks = localStorage.getItem('maxWeeks');
    
    if (!savedMaxWeeks) {
      // Si pas de valeur sauvegardée, utiliser la valeur calculée
      setMaxWeeks(defaultMaxWeeks);
    } else {
      const savedValue = parseInt(savedMaxWeeks);
      // Utiliser la valeur sauvegardée seulement si elle est >= au minimum requis
      if (savedValue >= defaultMaxWeeks) {
        setMaxWeeks(savedValue);
      } else {
        setMaxWeeks(defaultMaxWeeks);
      }
    }
  }, [budgetItems]);

  // Mettre à jour les postes de budget quand les dates d'étude changent
  useEffect(() => {
    if (etude && originalEtude) {
      const datesChanged = etude.startDate !== originalEtude.startDate || etude.endDate !== originalEtude.endDate;
      
      if (datesChanged) {
        // Mettre à jour l'état local des postes de budget
        setBudgetItems(prev => prev.map(item => {
          let newItem = { ...item };
          
          // Si les dates d'étude sont supprimées, convertir les dates en semaines
          if (!etude.startDate || !etude.endDate) {
            const startDateMatch = item.startDate?.match(/^\d{4}-\d{2}-\d{2}$/);
            const endDateMatch = item.endDate?.match(/^\d{4}-\d{2}-\d{2}$/);
            
            if (startDateMatch) {
              const date = new Date(item.startDate);
              const weekNumber = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000)) + 1;
              newItem.startDate = `S${weekNumber}`;
            }
            
            if (endDateMatch) {
              const date = new Date(item.endDate);
              const weekNumber = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000)) + 1;
              newItem.endDate = `S${weekNumber}`;
            }
          }
          
          return newItem;
        }));
      }
    }
  }, [etude?.startDate, etude?.endDate, originalEtude?.startDate, originalEtude?.endDate]);

  // Effet pour réinitialiser la sélection des documents quand les documents changent
  useEffect(() => {
    setSelectedDocuments([]);
    setSelectAllDocuments(false);
  }, [documents]);

  // Effet pour mettre à jour l'état "sélectionner tout" quand la sélection change
  useEffect(() => {
    if (selectedDocuments.length === 0) {
      setSelectAllDocuments(false);
    } else if (selectedDocuments.length === documents.length) {
      setSelectAllDocuments(true);
    } else {
      setSelectAllDocuments(false);
    }
  }, [selectedDocuments, documents]);

  // Raccourcis clavier pour le zoom
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return; // Ne pas intercepter si on est dans un champ de saisie
      }
      
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        setTimelineZoom(prev => {
          const current = Math.round(prev * 100);
          if (current < 25) return 0.25;
          if (current < 50) return 0.5;
          if (current < 75) return 0.75;
          if (current < 100) return 1;
          if (current < 150) return 1.5;
          if (current < 200) return 2;
          if (current < 250) return 2.5;
          return 3;
        });
      } else if (event.key === '-') {
        event.preventDefault();
        setTimelineZoom(prev => {
          const current = Math.round(prev * 100);
          if (current <= 25) return 0.25;
          if (current <= 50) return 0.25;
          if (current <= 75) return 0.5;
          if (current <= 100) return 0.75;
          if (current <= 150) return 1;
          if (current <= 200) return 1.5;
          if (current <= 250) return 2;
          return 2.5;
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Dialogs
  const [planningDialogOpen, setPlanningDialogOpen] = useState(false);
  const [recruitmentDialogOpen, setRecruitmentDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [powerpointDialogOpen, setPowerpointDialogOpen] = useState(false);
  const [newCompanyDialogOpen, setNewCompanyDialogOpen] = useState(false);
  const [missionTypeDialogOpen, setMissionTypeDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [addStudentDialogOpen, setAddStudentDialogOpen] = useState(false);
  const [selectedTaskForAddStudent, setSelectedTaskForAddStudent] = useState<RecruitmentTask | null>(null);
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompany, setNewCompany] = useState<Partial<Company>>({
    name: '',
    description: '',
    address: '',
    city: '',
    postalCode: '',
    country: '',
    phone: '',
    email: '',
    website: '',
    logo: '',
    siret: ''
  });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContact, setNewContact] = useState<Partial<Contact>>({
    firstName: '',
    lastName: '',
    email: '',
    position: '',
    gender: undefined
  });
  const [showContactForm, setShowContactForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [newTask, setNewTask] = useState<Partial<PlanningTask>>({});
  const [newRecruitmentTask, setNewRecruitmentTask] = useState<Partial<RecruitmentTask>>({});
  const [powerpointTemplate, setPowerpointTemplate] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newMissionType, setNewMissionType] = useState<Partial<MissionDescription>>({
    title: '',
    missionDescription: '',
    studentProfile: '',
    courseApplication: '',
    missionLearning: '',
    structureId: ''
  });

  // useEffect pour charger les compteurs de candidatures et les étudiants recrutés
  useEffect(() => {
    if (recruitmentTasks.length > 0) {
      loadApplicationsCounts();
      loadRecruitedStudents();
    }
  }, [recruitmentTasks]);

  useEffect(() => {
    const fetchEtudeDetails = async () => {
      if (!etudeNumber || !currentUser) return;

      try {
        setLoading(true);
        
        // Récupérer les détails de l'étude
        const etudesRef = collection(db, 'etudes');
        const etudeQuery = query(
          etudesRef,
          where('numeroEtude', '==', etudeNumber)
        );
        
        const etudeSnapshot = await getDocs(etudeQuery);
        
        if (etudeSnapshot.empty) {
          setSnackbar({
            open: true,
            message: 'Étude non trouvée',
            severity: 'error'
          });
          navigate('/app/etude');
          return;
        }

        const etudeDoc = etudeSnapshot.docs[0];
        const etudeData = { id: etudeDoc.id, ...etudeDoc.data() } as EtudeData;
        
        // Récupérer les informations de l'entreprise (ID, nom et logo)
        if (etudeData.company) {
          try {
            const companiesRef = collection(db, 'companies');
            const companyQuery = query(companiesRef, where('name', '==', etudeData.company));
            const companySnapshot = await getDocs(companyQuery);
            
            if (!companySnapshot.empty) {
              const companyDoc = companySnapshot.docs[0];
              const companyData = companyDoc.data();
              etudeData.companyId = companyDoc.id; // Récupérer l'ID de l'entreprise
              etudeData.companyLogo = companyData.logo || null;
            }
          } catch (error) {
            console.warn('Erreur lors de la récupération des informations de l\'entreprise:', error);
          }
        }
        
        setEtude(etudeData);
        setOriginalEtude(etudeData);
        
        // Initialiser le type de tarification
        setPricingType(etudeData.pricingType || 'jeh');

        // Récupérer les chargés d'étude disponibles
        if (etudeData.structureId) {
          const usersRef = collection(db, 'users');
          const usersQuery = query(
            usersRef,
            where('structureId', '==', etudeData.structureId),
            where('status', 'in', ['member', 'admin', 'superadmin'])
          );
          
          const usersSnapshot = await getDocs(usersQuery);
          const chargesList = usersSnapshot.docs.map(doc => {
            const userData = doc.data();
            return {
              id: doc.id,
              displayName: userData.displayName || 'Utilisateur sans nom',
              photoURL: userData.photoURL
            };
          });
          setAvailableCharges(chargesList);
        }

        // Charger les données associées
        await loadAssociatedData(etudeDoc.id);

        // Récupérer les entreprises disponibles de la structure
        if (etudeData.structureId) {
          const etudesRef = collection(db, 'etudes');
          const etudesQuery = query(
            etudesRef,
            where('structureId', '==', etudeData.structureId)
          );
          
          const etudesSnapshot = await getDocs(etudesQuery);
          const companies = new Set<string>();
          
          etudesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.company && data.company.trim()) {
              companies.add(data.company.trim());
            }
          });
          
          setAvailableCompanies(Array.from(companies).sort());

          // Récupérer les types de mission disponibles
          const missionTypesRef = collection(db, 'missionTypes');
          const missionTypesQuery = query(
            missionTypesRef,
            where('structureId', '==', etudeData.structureId)
          );
          
          const missionTypesSnapshot = await getDocs(missionTypesQuery);
          const missionTypesData = missionTypesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as MissionDescription[];
          setAvailableMissionTypes(missionTypesData);
        }

      } catch (error) {
        console.error('Erreur lors de la récupération de l\'étude:', error);
        setSnackbar({
          open: true,
          message: 'Erreur lors de la récupération de l\'étude',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchEtudeDetails();
  }, [etudeNumber, currentUser, navigate]);

  // Récupérer la template de proposition commerciale assignée à la structure de l'étude
  const getAssignedQuoteTemplate = async () => {
    if (!etude?.structureId) return null;

    try {
      const templatesQuery = query(
        collection(db, 'quoteTemplates'),
        where('structureId', '==', etude.structureId)
      );
      const templatesSnapshot = await getDocs(templatesQuery);
      if (templatesSnapshot.empty) return null;

      const templateDoc = templatesSnapshot.docs[0];
      const templateData = templateDoc.data();
      return {
        ...templateData,
        id: templateDoc.id
      };
    } catch (error) {
      console.error('Erreur lors de la récupération du template de proposition commerciale:', error);
      return null;
    }
  };

  // Ouvrir la page QuoteBuilder depuis l'étude, de manière identique à MissionDetails
  const handleCreateQuoteFromEtude = async () => {
    if (!etude?.numeroEtude) {
      setSnackbar({ open: true, message: 'Étude non trouvée', severity: 'error' });
      return;
    }

    try {
      const assignedTemplate = await getAssignedQuoteTemplate();
      
      console.log('=== CRÉATION DE PROPOSITION COMMERCIALE ===');
      console.log('Étude:', etude);
      console.log('Contacts disponibles:', contacts);
      
      // Trouver le contact principal (isDefault = true) ou le premier contact disponible
      const mainContact = contacts.find(contact => contact.isDefault) || contacts[0];
      console.log('Contact principal sélectionné:', mainContact);
      
      // Préparer les paramètres d'URL pour passer les informations de contact
      const urlParams = new URLSearchParams();
      if (assignedTemplate) {
        urlParams.append('template', assignedTemplate.id);
      }
      if (mainContact) {
        urlParams.append('contactId', mainContact.id);
        urlParams.append('contactEmail', mainContact.email);
        urlParams.append('contactFirstName', mainContact.firstName);
        urlParams.append('contactLastName', mainContact.lastName);
        // Ajouter le genre si disponible (à implémenter dans l'interface Contact)
        if ('gender' in mainContact) {
          urlParams.append('contactGender', (mainContact as any).gender);
        }
        console.log('Paramètres de contact ajoutés à l\'URL:', {
          contactId: mainContact.id,
          contactEmail: mainContact.email,
          contactFirstName: mainContact.firstName,
          contactLastName: mainContact.lastName,
          contactGender: (mainContact as any).gender
        });
      } else {
        console.warn('Aucun contact trouvé pour cette étude');
      }
      
      const url = `/app/etude/${etude.numeroEtude}/quote?${urlParams.toString()}`;
      console.log('URL de navigation:', url);
      navigate(url);
    } catch (error) {
      console.error('Erreur lors de l\'ouverture de la proposition commerciale:', error);
      navigate(`/app/etude/${etude.numeroEtude}/quote`);
    }
  };

  const loadAssociatedData = async (etudeId: string) => {
    try {
      // Charger les tâches de planning
      const planningRef = collection(db, 'planningTasks');
      const planningQuery = query(planningRef, where('etudeId', '==', etudeId));
      const planningSnapshot = await getDocs(planningQuery);
      const planningData = planningSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PlanningTask[];
      setPlanningTasks(planningData);

      // Charger les tâches de recrutement
      const recruitmentRef = collection(db, 'recruitmentTasks');
      const recruitmentQuery = query(recruitmentRef, where('etudeId', '==', etudeId));
      const recruitmentSnapshot = await getDocs(recruitmentQuery);
      const recruitmentData = recruitmentSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RecruitmentTask[];
      setRecruitmentTasks(recruitmentData);

      // Charger les étudiants recrutés pour ces tâches
      const recruitedStudents: {[taskId: string]: RecruitmentApplication[]} = {};
      for (const task of recruitmentData) {
        recruitedStudents[task.id] = await getRecruitedStudentsForTask(task.id);
        console.log(`Étudiants recrutés pour la tâche ${task.title}:`, recruitedStudents[task.id].length);
      }
      setRecruitedStudentsByTask(recruitedStudents);
      console.log('Tous les étudiants recrutés chargés:', recruitedStudents);

      // Charger les postes de budget
      const budgetRef = collection(db, 'budgetItems');
      const budgetQuery = query(budgetRef, where('etudeId', '==', etudeId));
      const budgetSnapshot = await getDocs(budgetQuery);
      const budgetData = budgetSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BudgetItem[];
      setBudgetItems(budgetData);

      // Harmoniser les compteurs des postes de budget selon les tâches en cours
      setTimeout(() => { syncBudgetItemsFromRecruitmentTasks(); }, 0);

      // Charger les documents
      const documentsRef = collection(db, 'documents');
      const documentsQuery = query(documentsRef, where('etudeId', '==', etudeId));
      const documentsSnapshot = await getDocs(documentsQuery);
      const documentsData = documentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Document[];
      setDocuments(documentsData);

      // Charger les notes
      const notesRef = collection(db, 'etudeNotes');
      const notesQuery = query(notesRef, where('etudeId', '==', etudeId));
      const notesSnapshot = await getDocs(notesQuery);
      const notesData = notesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EtudeNote[];
      setNotes(notesData);

      // Charger l'historique
      const historyRef = collection(db, 'etudeHistory');
      const historyQuery = query(historyRef, where('etudeId', '==', etudeId));
      const historySnapshot = await getDocs(historyQuery);
      const historyData = historySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HistoryEntry[];
      setHistoryEntries(historyData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

      // Charger les contacts de l'entreprise
      if (etude?.companyId) {
        try {
          const contactsRef = collection(db, 'contacts');
          const contactsQuery = query(contactsRef, where('companyId', '==', etude.companyId));
          const contactsSnapshot = await getDocs(contactsQuery);
          const contactsData = contactsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Contact[];
          setContacts(contactsData);
          console.log('Contacts chargés via companyId:', contactsData);
        } catch (error) {
          console.warn('Erreur lors du chargement des contacts via companyId:', error);
        }
      } else if (etude?.company) {
        // Si pas de companyId, essayer de trouver l'entreprise par nom
        try {
          console.log('Tentative de chargement des contacts via nom d\'entreprise:', etude.company);
          
          // D'abord, trouver l'entreprise par nom
          const companiesRef = collection(db, 'companies');
          const companiesQuery = query(companiesRef, where('name', '==', etude.company));
          const companiesSnapshot = await getDocs(companiesQuery);
          
          if (!companiesSnapshot.empty) {
            const companyDoc = companiesSnapshot.docs[0];
            const companyData = companyDoc.data();
            console.log('Entreprise trouvée par nom:', companyData);
            
            // Maintenant chercher les contacts avec l'ID de l'entreprise
            const contactsRef = collection(db, 'contacts');
            const contactsQuery = query(contactsRef, where('companyId', '==', companyDoc.id));
            const contactsSnapshot = await getDocs(contactsQuery);
            const contactsData = contactsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Contact[];
            setContacts(contactsData);
            console.log('Contacts chargés via nom d\'entreprise:', contactsData);
          } else {
            console.log('Aucune entreprise trouvée avec le nom:', etude.company);
            setContacts([]);
          }
        } catch (error) {
          console.warn('Erreur lors du chargement des contacts via nom d\'entreprise:', error);
          setContacts([]);
        }
      } else {
        console.log('Aucune information d\'entreprise disponible pour charger les contacts');
        setContacts([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données associées:', error);
    }
  };

  // Fonction pour comparer les données de l'étude et détecter les modifications spécifiques
  const detectChanges = (current: EtudeData, original: EtudeData): { hasChanges: boolean; modifications: string[] } => {
    const modifications: string[] = [];
    const fieldsToCompare = [
      { key: 'companyId', label: 'ID Entreprise' },
      { key: 'company', label: 'Entreprise' },
      { key: 'location', label: 'Localisation' },
      { key: 'startDate', label: 'Date de début' },
      { key: 'endDate', label: 'Date de fin' },
      { key: 'consultantCount', label: 'Nombre de consultants' },
      { key: 'hours', label: 'Heures' },
      { key: 'jeh', label: 'JEH' },
      { key: 'status', label: 'Statut' },
      { key: 'chargeId', label: 'Chargé d\'étude' },
      { key: 'description', label: 'Description' },
      { key: 'prixHT', label: 'Prix HT' },
      { key: 'missionTypeId', label: 'Type de mission' },
      { key: 'etape', label: 'Étape' },
      { key: 'isPublic', label: 'Visibilité publique' },
      { key: 'isArchived', label: 'Archivage' }
    ];

    for (const field of fieldsToCompare) {
      const currentValue = current[field.key as keyof EtudeData];
      const originalValue = original[field.key as keyof EtudeData];
      
      // Gestion spéciale pour les dates - ne pas considérer comme modification si on passe de null à une date vide
      if (field.key === 'startDate' || field.key === 'endDate') {
        const currentDate = currentValue ? new Date(currentValue).toISOString().split('T')[0] : null;
        const originalDate = originalValue ? new Date(originalValue).toISOString().split('T')[0] : null;
        
        if (currentDate !== originalDate && !(currentDate === null && originalDate === null)) {
          if (currentDate && !originalDate) {
            modifications.push(`Ajout de la ${field.label.toLowerCase()}`);
          } else if (!currentDate && originalDate) {
            modifications.push(`Suppression de la ${field.label.toLowerCase()}`);
          } else {
            modifications.push(`Modification de la ${field.label.toLowerCase()}`);
          }
        }
        continue;
      }

      // Gestion des valeurs null/undefined pour les autres champs
      if (currentValue === null && originalValue === null) continue;
      if (currentValue === undefined && originalValue === undefined) continue;
      if (currentValue === null && originalValue === undefined) continue;
      if (currentValue === undefined && originalValue === null) continue;
      
      // Comparaison des valeurs
      if (currentValue !== originalValue) {
        if (currentValue && !originalValue) {
          modifications.push(`Ajout de la ${field.label.toLowerCase()}`);
        } else if (!currentValue && originalValue) {
          modifications.push(`Suppression de la ${field.label.toLowerCase()}`);
        } else {
          modifications.push(`Modification de la ${field.label.toLowerCase()}`);
        }
      }
    }

    // Comparaison spéciale pour les arrays (chargeIds)
    if (JSON.stringify(current.chargeIds) !== JSON.stringify(original.chargeIds)) {
      modifications.push('Modification des chargés d\'étude');
    }

    return {
      hasChanges: modifications.length > 0,
      modifications
    };
  };

  const handleSave = async () => {
    if (!etude || !etude.id || !originalEtude) return;

    // Validation des dates
    if (etude.startDate && etude.endDate && etude.endDate < etude.startDate) {
      setSnackbar({
        open: true,
        message: 'La date de fin ne peut pas être antérieure à la date de début',
        severity: 'error'
      });
      return;
    }

    try {
      // Vérifier s'il y a eu des modifications
      const { hasChanges, modifications } = detectChanges(etude, originalEtude);

      // Préparer les données en remplaçant undefined par null pour Firebase
      const updateData: any = {
        ...etude,
        pricingType: pricingType,
        updatedAt: new Date()
      };

      // Remplacer undefined par null pour Firebase
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          updateData[key] = null;
        }
      });

      await updateDoc(doc(db, 'etudes', etude.id), updateData);

      // Ajouter une entrée d'historique seulement s'il y a eu des modifications
      if (hasChanges) {
        await addHistoryEntryWithModifications('Étude modifiée', modifications);
      }

      // Mettre à jour les données originales
      setOriginalEtude(etude);

      // Mettre à jour les postes de budget si les dates d'étude ont changé
      if (etude.startDate !== originalEtude?.startDate || etude.endDate !== originalEtude?.endDate) {
        await updateBudgetItemsDates();
      }

      setEditing(false);
      setSnackbar({
        open: true,
        message: hasChanges ? 'Étude mise à jour avec succès' : 'Aucune modification détectée',
        severity: hasChanges ? 'success' : 'info'
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour de l\'étude',
        severity: 'error'
      });
    }
  };

  const handleCancel = () => {
    setEditing(false);
    window.location.reload();
  };

  const updateBudgetItemsDates = async () => {
    if (!etude?.id) return;
    
    try {
      const budgetItemsRef = collection(db, 'budgetItems');
      const q = query(budgetItemsRef, where('etudeId', '==', etude.id));
      const querySnapshot = await getDocs(q);
      
      const updatePromises = querySnapshot.docs.map(async (doc) => {
        const item = doc.data();
        
        // Si les dates d'étude sont définies, convertir les semaines en dates
        if (etude.startDate && etude.endDate) {
          const startWeekMatch = item.startDate?.match(/S(\d+)/);
          const endWeekMatch = item.endDate?.match(/S(\d+)/);
          
          if (startWeekMatch || endWeekMatch) {
            let newStartDate = item.startDate;
            let newEndDate = item.endDate;
            
            if (startWeekMatch) {
              const weekNumber = parseInt(startWeekMatch[1]);
              const studyStart = new Date(etude.startDate);
              const weekStart = new Date(studyStart.getTime() + ((weekNumber - 1) * 7 * 24 * 60 * 60 * 1000));
              newStartDate = weekStart.toISOString().split('T')[0];
            }
            
            if (endWeekMatch) {
              const weekNumber = parseInt(endWeekMatch[1]);
              const studyStart = new Date(etude.startDate);
              const weekEnd = new Date(studyStart.getTime() + (weekNumber * 7 * 24 * 60 * 60 * 1000));
              newEndDate = weekEnd.toISOString().split('T')[0];
            }
            
            return updateDoc(doc.ref, {
              startDate: newStartDate,
              endDate: newEndDate
            });
          }
        } else {
          // Si les dates d'étude sont supprimées, convertir les dates en semaines
          const startDateMatch = item.startDate?.match(/^\d{4}-\d{2}-\d{2}$/);
          const endDateMatch = item.endDate?.match(/^\d{4}-\d{2}-\d{2}$/);
          
          if (startDateMatch || endDateMatch) {
            let newStartDate = item.startDate;
            let newEndDate = item.endDate;
            
            if (startDateMatch) {
              // Convertir la date en semaine (S1, S2, etc.)
              const date = new Date(item.startDate);
              const weekNumber = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000)) + 1;
              newStartDate = `S${weekNumber}`;
            }
            
            if (endDateMatch) {
              // Convertir la date en semaine (S1, S2, etc.)
              const date = new Date(item.endDate);
              const weekNumber = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000)) + 1;
              newEndDate = `S${weekNumber}`;
            }
            
            return updateDoc(doc.ref, {
              startDate: newStartDate,
              endDate: newEndDate
            });
          }
        }
      });
      
      await Promise.all(updatePromises.filter(Boolean));
      
      // Recharger les postes de budget
      await loadAssociatedData(etude.id);
      
      console.log('Postes de budget mis à jour avec les nouvelles dates d\'étude');
    } catch (error) {
      console.error('Erreur lors de la mise à jour des postes de budget:', error);
    }
  };

  const handleAddNewCompany = async () => {
    if (!newCompany.name.trim() || !currentUser) return;

    try {
      // Récupérer la structure de l'utilisateur
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!userDoc.exists()) {
        throw new Error("Utilisateur non trouvé");
      }

      const userData = userDoc.data();
      const userStructureId = userData.structureId;

      // Créer l'entreprise dans Firestore
      const companiesRef = collection(db, 'companies');
      const companyDoc = await addDoc(companiesRef, {
        ...newCompany,
        createdAt: new Date(),
        structureId: userStructureId,
        contacts: contacts
      });

      // Mettre à jour l'étude avec la nouvelle entreprise
      const companyName = newCompany.name.trim();
      setEtude({ ...etude, company: companyName, companyId: companyDoc.id });
      setAvailableCompanies(prev => [...prev, companyName].sort());

      // Réinitialiser le formulaire
      setNewCompany({
        name: '',
        description: '',
        address: '',
        city: '',
        postalCode: '',
        country: '',
        phone: '',
        email: '',
        website: '',
        logo: '',
        siret: ''
      });
      setContacts([]);
      setNewCompanyDialogOpen(false);

      setSnackbar({
        open: true,
        message: "Entreprise créée avec succès",
        severity: "success"
      });
    } catch (error) {
      console.error("Erreur lors de la création de l'entreprise:", error);
      setSnackbar({
        open: true,
        message: "Erreur lors de la création de l'entreprise",
        severity: "error"
      });
    }
  };

  const handleCancelNewCompany = () => {
    setNewCompany({
      name: '',
      description: '',
      address: '',
      city: '',
      postalCode: '',
      country: '',
      phone: '',
      email: '',
      website: '',
      logo: '',
      siret: ''
    });
    setContacts([]);
    setShowContactForm(false);
    setNewCompanyDialogOpen(false);
  };

  const handleAddContact = () => {
    if (!newContact.firstName || !newContact.lastName || !newContact.email || !currentUser) return;

    const contact: Contact = {
      id: crypto.randomUUID(),
      firstName: newContact.firstName,
      lastName: newContact.lastName,
      email: newContact.email,
      position: newContact.position || '',
      phone: newContact.phone,
      linkedin: newContact.linkedin,
      createdAt: new Date(),
      createdBy: currentUser.uid,
      isDefault: false
    };

    setContacts([...contacts, contact]);
    setNewContact({
      firstName: '',
      lastName: '',
      email: '',
      position: '',
      phone: '',
      linkedin: ''
    });
  };

  const handleRemoveContact = (contactId: string) => {
    setContacts(contacts.filter(contact => contact.id !== contactId));
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        setSnackbar({
          open: true,
          message: "Téléchargement du logo en cours...",
          severity: "info"
        });
        
        const tempCompanyId = crypto.randomUUID();
        const logoUrl = await uploadCompanyLogo(file, tempCompanyId);
        
        if (!logoUrl.startsWith('http://') && !logoUrl.startsWith('https://')) {
          throw new Error("URL du logo invalide");
        }
        
        setNewCompany({
          ...newCompany,
          logo: logoUrl
        });
        
        setSnackbar({
          open: true,
          message: "Logo téléchargé avec succès",
          severity: "success"
        });
      } catch (error) {
        console.error("Erreur lors du téléchargement du logo:", error);
        setSnackbar({
          open: true,
          message: "Erreur lors du téléchargement du logo",
          severity: "error"
        });
      }
    }
  };

  const handleContactChange = (field: keyof Omit<Contact, 'id' | 'createdAt' | 'createdBy'>, value: string) => {
    setNewContact(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addHistoryEntry = async (action: string, details: string) => {
    if (!etude?.id || !currentUser) return;

    try {
      const historyEntry: Omit<HistoryEntry, 'id'> = {
        date: new Date().toISOString(),
        action,
        details,
        type: 'etude',
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Utilisateur inconnu'
      };

      await addDoc(collection(db, 'etudeHistory'), {
        ...historyEntry,
        etudeId: etude.id
      });

      // Mettre à jour l'état local
      const newEntry: HistoryEntry = {
        id: crypto.randomUUID(),
        ...historyEntry
      };
      setHistoryEntries(prev => [newEntry, ...prev]);
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'entrée d\'historique:', error);
    }
  };

  const addHistoryEntryWithModifications = async (action: string, modifications: string[]) => {
    if (!etude?.id || !currentUser) return;

    try {
      const now = new Date();
      const sessionId = currentSessionId || crypto.randomUUID();
      
      // Vérifier s'il y a déjà une entrée récente (dans les 30 minutes) pour la même session
      const recentEntry = historyEntries.find(entry => {
        if (entry.sessionId === sessionId && entry.action === action) {
          const entryDate = new Date(entry.date);
          const timeDiff = now.getTime() - entryDate.getTime();
          return timeDiff <= 30 * 60 * 1000; // 30 minutes
        }
        return false;
      });

      if (recentEntry) {
        // Mettre à jour l'entrée existante avec les nouvelles modifications
        const updatedModifications = [...(recentEntry.modifications || []), ...modifications];
        
        // Mettre à jour dans Firestore
        const historyRef = doc(db, 'etudeHistory', recentEntry.id);
        await updateDoc(historyRef, {
          modifications: updatedModifications,
          date: now.toISOString()
        });

        // Mettre à jour l'état local
        setHistoryEntries(prev => prev.map(entry => 
          entry.id === recentEntry.id 
            ? { ...entry, modifications: updatedModifications, date: now.toISOString() }
            : entry
        ));
      } else {
        // Créer une nouvelle entrée
        const historyEntry: Omit<HistoryEntry, 'id'> = {
          date: now.toISOString(),
          action,
          details: `Modifications apportées à l'étude ${etude.numeroEtude}`,
          type: 'etude',
          userId: currentUser.uid,
          userName: currentUser.displayName || 'Utilisateur inconnu',
          modifications,
          sessionId
        };

        const docRef = await addDoc(collection(db, 'etudeHistory'), {
          ...historyEntry,
          etudeId: etude.id
        });

        // Mettre à jour l'état local
        const newEntry: HistoryEntry = {
          id: docRef.id,
          ...historyEntry
        };
        setHistoryEntries(prev => [newEntry, ...prev]);
      }

      // Mettre à jour la session ID pour les prochaines modifications
      if (!currentSessionId) {
        setCurrentSessionId(sessionId);
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'entrée d\'historique:', error);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !etude?.id || !currentUser) return;

    try {
      const noteData: Omit<EtudeNote, 'id'> = {
        content: newNote.trim(),
        createdAt: new Date(),
        createdBy: currentUser.uid,
        createdByName: currentUser.displayName || 'Utilisateur inconnu',
        createdByPhotoURL: currentUser.photoURL || undefined,
        etudeId: etude.id,
        etudeNumber: etude.numeroEtude
      };

      await addDoc(collection(db, 'etudeNotes'), noteData);
      
      // Mettre à jour l'état local
      const newNoteEntry: EtudeNote = {
        id: crypto.randomUUID(),
        ...noteData
      };
      setNotes(prev => [newNoteEntry, ...prev]);
      setNewNote('');

      await addHistoryEntry('Note ajoutée', `Nouvelle note ajoutée à l'étude ${etude.numeroEtude}`);

      setSnackbar({
        open: true,
        message: 'Note ajoutée avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la note:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de l\'ajout de la note',
        severity: 'error'
      });
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteDoc(doc(db, 'etudeNotes', noteId));
      setNotes(prev => prev.filter(note => note.id !== noteId));

      if (etude) {
        await addHistoryEntry('Note supprimée', `Note supprimée de l'étude ${etude.numeroEtude}`);
      }

      setSnackbar({
        open: true,
        message: 'Note supprimée avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la suppression de la note:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la suppression de la note',
        severity: 'error'
      });
    }
  };

  // Fonctions de gestion des documents
  const handleDocumentPreview = (document: Document) => {
    setSelectedDocument(document);
    setDocumentPreviewOpen(true);
  };

  const handleDocumentDownload = async (document: Document) => {
    try {
      if (document.url) {
        // Si le document a une URL, télécharger depuis cette URL
        const link = document.createElement('a');
        link.href = document.url;
        link.download = document.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Si pas d'URL, afficher un message d'erreur
        setSnackbar({
          open: true,
          message: 'Document non disponible pour le téléchargement',
          severity: 'warning'
        });
      }
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors du téléchargement',
        severity: 'error'
      });
    }
  };

  const handleDocumentDelete = async (documentId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      return;
    }

    try {
      setDeletingDocument(documentId);
      await deleteDoc(doc(db, 'documents', documentId));
      
      // Mettre à jour l'état local
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));

      if (etude) {
        await addHistoryEntry('Document supprimé', `Document supprimé de l'étude ${etude.numeroEtude}`);
      }

      setSnackbar({
        open: true,
        message: 'Document supprimé avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la suppression du document:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la suppression du document',
        severity: 'error'
      });
    } finally {
      setDeletingDocument(null);
    }
  };

  // Fonctions de gestion de la sélection multiple des documents
  const handleDocumentSelectionChange = (documentId: string, checked: boolean) => {
    if (checked) {
      setSelectedDocuments(prev => [...prev, documentId]);
    } else {
      setSelectedDocuments(prev => prev.filter(id => id !== documentId));
    }
  };

  const handleSelectAllDocuments = (checked: boolean) => {
    if (checked) {
      setSelectedDocuments(documents.map(doc => doc.id));
      setSelectAllDocuments(true);
    } else {
      setSelectedDocuments([]);
      setSelectAllDocuments(false);
    }
  };

  const handleDeleteSelectedDocuments = async () => {
    if (selectedDocuments.length === 0) return;
    
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${selectedDocuments.length} document(s) ?`)) {
      return;
    }

    try {
      // Supprimer tous les documents sélectionnés
      for (const documentId of selectedDocuments) {
        await deleteDoc(doc(db, 'documents', documentId));
      }
      
      // Mettre à jour l'état local
      setDocuments(prev => prev.filter(doc => !selectedDocuments.includes(doc.id)));

      if (etude) {
        await addHistoryEntry('Documents supprimés', `${selectedDocuments.length} document(s) supprimé(s) de l'étude ${etude.numeroEtude}`);
      }

      // Réinitialiser la sélection
      setSelectedDocuments([]);
      setSelectAllDocuments(false);

      setSnackbar({
        open: true,
        message: `${selectedDocuments.length} document(s) supprimé(s) avec succès`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la suppression des documents:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la suppression des documents',
        severity: 'error'
      });
    }
  };

  const handleDownloadSelectedDocuments = async () => {
    if (selectedDocuments.length === 0) return;
    
    try {
      for (const documentId of selectedDocuments) {
        const document = documents.find(doc => doc.id === documentId);
        if (document && document.url) {
          const link = document.createElement('a');
          link.href = document.url;
          link.download = document.name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
      
      setSnackbar({
        open: true,
        message: `${selectedDocuments.length} document(s) en cours de téléchargement`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors du téléchargement des documents:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors du téléchargement des documents',
        severity: 'error'
      });
    }
  };

  // Fonction pour reprendre l'édition d'un brouillon
  const handleResumeEditing = (document: Document) => {
    if (document.isDraft && document.quoteData) {
      // Stocker les données du brouillon dans localStorage pour les récupérer dans QuoteBuilder
      localStorage.setItem('resumeQuoteDraft', JSON.stringify({
        id: document.id,
        quoteData: document.quoteData,
        structureData: document.structureData,
        missionData: document.missionData,
        options: document.options,
        documentTitle: document.documentTitle
      }));
      
      // Naviguer vers QuoteBuilder avec l'ID de la mission
      navigate(`/quote-builder/${document.etudeId || document.missionId}`);
      
      // Fermer la popup
      setDocumentPreviewOpen(false);
    }
  };

  const handleCreateMissionType = async () => {
    if (!newMissionType.title?.trim() || !currentUser) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!userDoc.exists()) {
        throw new Error("Utilisateur non trouvé");
      }

      const userData = userDoc.data();
      const userStructureId = userData.structureId;

      const missionTypeData = {
        title: newMissionType.title,
        missionDescription: newMissionType.missionDescription || '',
        studentProfile: newMissionType.studentProfile || '',
        courseApplication: newMissionType.courseApplication || '',
        missionLearning: newMissionType.missionLearning || '',
        structureId: userStructureId
      };

      const docRef = await addDoc(collection(db, 'missionTypes'), missionTypeData);
      const newMissionTypeEntry: MissionDescription = {
        id: docRef.id,
        ...missionTypeData
      };

      setAvailableMissionTypes(prev => [...prev, newMissionTypeEntry]);
      setNewMissionType({
        title: '',
        missionDescription: '',
        studentProfile: '',
        courseApplication: '',
        missionLearning: '',
        structureId: ''
      });
      setMissionTypeDialogOpen(false);

      setSnackbar({
        open: true,
        message: 'Type de mission créé avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la création du type de mission:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la création du type de mission',
        severity: 'error'
      });
    }
  };

  const handleJehChange = (value: number) => {
    setEtude(prev => {
      if (!prev) return prev;
      const newEtude = { ...prev, jeh: value };
      if (jehLinked) {
        newEtude.hours = value * 8;
      }
      return newEtude;
    });
  };

  const handleHoursChange = (value: number) => {
    setEtude(prev => {
      if (!prev) return prev;
      const newEtude = { ...prev, hours: value };
      if (jehLinked) {
        newEtude.jeh = Math.round(value / 8);
      }
      return newEtude;
    });
  };

  const handleAddPlanningTask = async () => {
    if (!etude?.id || !newTask.title) return;

    try {
      const taskData = {
        ...newTask,
        etudeId: etude.id,
        createdAt: new Date(),
        createdBy: currentUser?.uid,
        status: 'À faire'
      } as PlanningTask;

      const docRef = await addDoc(collection(db, 'planningTasks'), taskData);
      
      // Créer la nouvelle tâche avec l'ID généré
      const newTaskWithId: PlanningTask = {
        id: docRef.id,
        ...taskData
      };

      // Mettre à jour l'état local immédiatement
      setPlanningTasks(prev => [...prev, newTaskWithId]);
      
      setPlanningDialogOpen(false);
      setNewTask({});
      
      setSnackbar({
        open: true,
        message: 'Tâche ajoutée avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la tâche:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de l\'ajout de la tâche',
        severity: 'error'
      });
    }
  };

  const handleAddRecruitmentTask = async () => {
    if (!etude?.id) return;
    
    // Si c'est un recrutement lié aux postes de budget, on peut créer un titre automatique
    if (linkedRecruitmentMode && selectedBudgetItems.length > 0) {
      const selectedItems = budgetItems.filter(item => selectedBudgetItems.includes(item.id));
      const autoTitle = `Recrutement pour ${selectedItems.map(item => item.title).join(', ')}`;
      setNewRecruitmentTask(prev => ({ ...prev, title: autoTitle }));
    }
    
    // Vérifier qu'on a un titre (soit saisi manuellement, soit généré automatiquement)
    if (!newRecruitmentTask.title) return;

    try {
      console.log('Début de création de tâche de recrutement');
      console.log('Mode lié:', linkedRecruitmentMode);
      console.log('Postes sélectionnés:', selectedBudgetItems);
      
      const taskData = {
        ...newRecruitmentTask,
        etudeId: etude.id,
        createdAt: new Date(),
        createdBy: currentUser?.uid,
        applications: 0,
        // Champs de publication par défaut
        isPublished: false,
        isPublic: false,
        // Nouveaux champs pour le recrutement lié aux postes de budget
        budgetItemIds: linkedRecruitmentMode ? selectedBudgetItems : undefined,
        studentsToRecruit: linkedRecruitmentMode ? recruitmentStudentsCount : undefined,
        recruitedStudents: 0,
        linkedRecruitment: linkedRecruitmentMode,
        // Champs pour les exigences de candidature par défaut
        requiresCV: false,
        requiresMotivation: false,
        // Lieu par défaut
        location: ''
      } as RecruitmentTask;

      console.log('Données de la tâche à créer:', taskData);

      const docRef = await addDoc(collection(db, 'recruitmentTasks'), taskData);
      console.log('Tâche créée dans Firestore avec ID:', docRef.id);
      
      // Créer la nouvelle tâche avec l'ID généré
      const newTaskWithId: RecruitmentTask = {
        id: docRef.id,
        ...taskData
      };

      // Mettre à jour l'état local immédiatement
      const updatedTasks = [...recruitmentTasks, newTaskWithId];
      setRecruitmentTasks(updatedTasks);
      console.log('État local des tâches mis à jour');
      
      // Synchroniser les postes de budget avec les nouvelles tâches
      await syncBudgetItemsFromRecruitmentTasksWithTasks(updatedTasks);
      console.log('Synchronisation des postes de budget terminée');
      
      setRecruitmentDialogOpen(false);
      setNewRecruitmentTask({});
      setLinkedRecruitmentMode(false);
      setSelectedBudgetItems([]);
      setRecruitmentStudentsCount(1);
      
      setSnackbar({
        open: true,
        message: linkedRecruitmentMode 
          ? `Tâche de recrutement ajoutée avec succès pour ${selectedBudgetItems.length} poste(s) de budget`
          : 'Tâche de recrutement ajoutée avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la tâche de recrutement:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de l\'ajout de la tâche de recrutement',
        severity: 'error'
      });
    }
  };

  const handleEditRecruitmentTask = async () => {
    if (!editingRecruitmentTask?.id || !etude?.id) return;

    try {
      console.log('Début de modification de tâche de recrutement:', editingRecruitmentTask.id);
      
      const updateData = {
        title: editingRecruitmentTask.title,
        description: editingRecruitmentTask.description,
        requiredSkills: editingRecruitmentTask.requiredSkills,
        remuneration: editingRecruitmentTask.remuneration,
        duration: editingRecruitmentTask.duration,
        status: editingRecruitmentTask.status,
        deadline: editingRecruitmentTask.deadline,
        startDate: editingRecruitmentTask.startDate,
        endDate: editingRecruitmentTask.endDate,
        location: editingRecruitmentTask.location,
        budgetItemIds: editingRecruitmentTask.budgetItemIds,
        studentsToRecruit: editingRecruitmentTask.studentsToRecruit,
        recruitedStudents: editingRecruitmentTask.recruitedStudents,
        linkedRecruitment: editingRecruitmentTask.linkedRecruitment,
        requiresCV: editingRecruitmentTask.requiresCV,
        requiresMotivation: editingRecruitmentTask.requiresMotivation
      };

      // Filtrer les champs undefined pour éviter l'erreur Firestore
      const filteredUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== undefined)
      );

      await updateDoc(doc(db, 'recruitmentTasks', editingRecruitmentTask.id), filteredUpdateData);
      console.log('Tâche mise à jour dans Firestore');
      
      // Mettre à jour l'état local
      const updatedTasks = recruitmentTasks.map(task => 
        task.id === editingRecruitmentTask.id ? editingRecruitmentTask : task
      );
      setRecruitmentTasks(updatedTasks);
      console.log('État local des tâches mis à jour');
      
      // Synchroniser les postes de budget avec les tâches mises à jour
      await syncBudgetItemsFromRecruitmentTasksWithTasks(updatedTasks);
      console.log('Synchronisation des postes de budget terminée');
      
      setEditRecruitmentDialogOpen(false);
      setEditingRecruitmentTask(null);
      
      setSnackbar({
        open: true,
        message: 'Tâche de recrutement modifiée avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la modification de la tâche de recrutement:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la modification de la tâche de recrutement',
        severity: 'error'
      });
    }
  };

  const handlePublishRecruitmentTask = async (taskId: string) => {
    try {
      const task = recruitmentTasks.find(t => t.id === taskId);
      if (!task) return;

      const taskRef = doc(db, 'recruitmentTasks', taskId);
      const newPublishedState = !task.isPublished;
      
      // Si on publie la tâche
      if (newPublishedState) {
        const updateData = {
          isPublished: true,
          publishedAt: new Date(),
          isPublic: true,
          status: 'Ouvert' as const
        };

        await updateDoc(taskRef, updateData);
        
        // Mise à jour de l'état local
        setRecruitmentTasks(prev => prev.map(t => 
          t.id === taskId ? { ...t, ...updateData } : t
        ));
        
        setSnackbar({
          open: true,
          message: "Tâche de recrutement publiée avec succès",
          severity: 'success'
        });
      } else {
        // Si on dépublie la tâche
        await updateDoc(taskRef, {
          isPublished: false,
          publishedAt: null,
          isPublic: false
        });
        
        // Mise à jour de l'état local
        setRecruitmentTasks(prev => prev.map(t => 
          t.id === taskId ? { 
            ...t, 
            isPublished: false, 
            publishedAt: null, 
            isPublic: false 
          } : t
        ));
        
        setSnackbar({
          open: true,
          message: "Tâche de recrutement dépubliée",
          severity: 'success'
        });
      }
    } catch (error) {
      console.error("Erreur lors de la publication:", error);
      setSnackbar({
        open: true,
        message: "Erreur lors de la publication de la tâche de recrutement",
        severity: 'error'
      });
    }
  };

  const handleDeleteRecruitmentTask = async (taskId: string) => {
    try {
      console.log('Début de suppression de la tâche de recrutement:', taskId);
      const task = recruitmentTasks.find(t => t.id === taskId);
      if (!task) {
        console.log('Tâche non trouvée');
        return;
      }

      console.log('Tâche à supprimer:', task.title);
      console.log('Postes de budget liés:', task.budgetItemIds);

      // Supprimer la tâche de Firestore
      await deleteDoc(doc(db, 'recruitmentTasks', taskId));
      console.log('Tâche supprimée de Firestore');
      
      // Mettre à jour l'état local et synchroniser immédiatement
      const updatedTasks = recruitmentTasks.filter(t => t.id !== taskId);
      setRecruitmentTasks(updatedTasks);
      console.log('État local des tâches mis à jour');
      
      // Synchroniser les postes de budget avec les tâches restantes
      await syncBudgetItemsFromRecruitmentTasksWithTasks(updatedTasks);
      console.log('Synchronisation des postes de budget terminée');

      setSnackbar({
        open: true,
        message: "Tâche de recrutement supprimée avec succès",
        severity: 'success'
      });
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      setSnackbar({
        open: true,
        message: "Erreur lors de la suppression de la tâche de recrutement",
        severity: 'error'
      });
    }
  };

  // Fonction pour ouvrir le dialogue d'ajout d'étudiants
  const handleOpenAddStudentDialog = async (task: RecruitmentTask) => {
    setSelectedTaskForAddStudent(task);
    setSelectedStudents([]);
    
    try {
      // Récupérer tous les utilisateurs de la structure
      const usersRef = collection(db, 'users');
      const usersQuery = query(usersRef, where('structureId', '==', etude?.structureId));
      const usersSnapshot = await getDocs(usersQuery);
      
      const allUsers = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Array<{
        id: string;
        displayName?: string;
        email?: string;
        photoURL?: string;
      }>;
      
      // Récupérer les candidatures existantes pour cette tâche (acceptées ou ajoutées manuellement)
      const applicationsRef = collection(db, 'applications');
      const applicationsQuery = query(
        applicationsRef, 
        where('missionId', '==', task.id),
        where('status', 'in', ['Acceptée', 'Ajouté manuellement'])
      );
      const applicationsSnapshot = await getDocs(applicationsQuery);
      
      const existingUserIds = applicationsSnapshot.docs.map(doc => doc.data().userId);
      console.log('🚫 Étudiants déjà recrutés:', existingUserIds);
      
      // Filtrer les utilisateurs qui ne sont pas encore recrutés
      const availableUsers = allUsers.filter(user => !existingUserIds.includes(user.id));
      console.log('✅ Étudiants disponibles:', availableUsers.map(u => u.displayName || u.email));
      
      setAvailableStudents(availableUsers);
      setAddStudentDialogOpen(true);
    } catch (error) {
      console.error('Erreur lors de la récupération des étudiants disponibles:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la récupération des étudiants disponibles',
        severity: 'error'
      });
    }
  };

  // Fonction pour ajouter manuellement des étudiants à une tâche
  const handleAddStudentsToTask = async () => {
    if (!selectedTaskForAddStudent || selectedStudents.length === 0) return;
    
    try {
      const batch = writeBatch(db);
      const newApplications: RecruitmentApplication[] = [];
      
      for (const studentId of selectedStudents) {
        const student = availableStudents.find(s => s.id === studentId);
        if (!student) continue;
        
        const applicationData = {
          missionId: selectedTaskForAddStudent.id,
          recruitmentTaskId: selectedTaskForAddStudent.id, // Ajouter ce champ requis
          userId: studentId,
          userEmail: student.email,
          userDisplayName: student.displayName || student.email?.split('@')[0] || 'Utilisateur',
          userPhotoURL: student.photoURL || null,
          status: 'Ajouté manuellement' as const, // Utiliser 'Ajouté manuellement' pour être cohérent
          submittedAt: new Date(),
          updatedAt: new Date(),
          addedManually: true,
          createdBy: currentUser?.uid
        };
        
        const docRef = doc(collection(db, 'applications'));
        batch.set(docRef, applicationData);
        
        newApplications.push({
          id: docRef.id,
          ...applicationData
        });
      }
      
      await batch.commit();
      
      // Mettre à jour l'état local
      setRecruitmentApplications(prev => [...prev, ...newApplications]);
      
      // Récupérer le nombre réel d'étudiants recrutés depuis les candidatures
      const applicationsRef = collection(db, 'applications');
      const applicationsQuery = query(
        applicationsRef, 
        where('missionId', '==', selectedTaskForAddStudent.id),
        where('status', 'in', ['Acceptée', 'Ajouté manuellement'])
      );
      const applicationsSnapshot = await getDocs(applicationsQuery);
      const realRecruitedCount = applicationsSnapshot.size;
      
      // Mettre à jour le nombre d'étudiants recrutés dans la tâche
      const updatedTask = {
        ...selectedTaskForAddStudent,
        recruitedStudents: realRecruitedCount
      };
      
      await updateDoc(doc(db, 'recruitmentTasks', selectedTaskForAddStudent.id), {
        recruitedStudents: realRecruitedCount
      });
      
      // Mettre à jour l'état local des tâches AVANT la synchronisation
      const updatedTasks = recruitmentTasks.map(task => 
        task.id === selectedTaskForAddStudent.id ? updatedTask : task
      );
      setRecruitmentTasks(updatedTasks);
      
      // Mettre à jour les compteurs et les étudiants recrutés
      await loadApplicationsCounts();
      
      // Synchroniser les postes de budget avec les tâches mises à jour
      await syncBudgetItemsFromRecruitmentTasksWithTasks(updatedTasks);
      
      // Recharger les étudiants recrutés après la synchronisation
      await loadRecruitedStudents();
      
      setAddStudentDialogOpen(false);
      setSelectedTaskForAddStudent(null);
      setSelectedStudents([]);
      setAvailableStudents([]);
      
      setSnackbar({
        open: true,
        message: `${selectedStudents.length} étudiant(s) ajouté(s) manuellement à la tâche`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de l\'ajout des étudiants:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de l\'ajout des étudiants',
        severity: 'error'
      });
    }
  };

  // Fonctions pour gérer les candidatures aux tâches de recrutement

  // Fonctions pour gérer les candidatures aux tâches de recrutement
  const fetchRecruitmentApplications = async (taskId: string) => {
    try {
      const applicationsRef = collection(db, 'applications');
      const q = query(applicationsRef, where('missionId', '==', taskId));
      const snapshot = await getDocs(q);
      
      const applications = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          recruitmentTaskId: data.missionId, // Mapper missionId vers recruitmentTaskId
          userId: data.userId,
          userEmail: data.userEmail,
          userDisplayName: data.userDisplayName || data.userEmail?.split('@')[0] || 'Utilisateur',
          userPhotoURL: data.userPhotoURL,
          cvUrl: data.cvUrl,
          cvUpdatedAt: data.cvUpdatedAt ? new Date(data.cvUpdatedAt) : undefined,
          motivationLetter: data.motivationLetter,
          status: data.status,
          submittedAt: data.submittedAt ? new Date(data.submittedAt) : new Date(),
          updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
          reviewedBy: data.reviewedBy,
          reviewedAt: data.reviewedAt ? new Date(data.reviewedAt) : undefined,
          reviewNotes: data.reviewNotes
        } as RecruitmentApplication;
      });
      
      setRecruitmentApplications(applications);
    } catch (error) {
      console.error('Erreur lors de la récupération des candidatures:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la récupération des candidatures',
        severity: 'error'
      });
    }
  };

  const handleOpenApplications = (task: RecruitmentTask) => {
    setSelectedRecruitmentTask(task);
    setApplicationsDialogOpen(true);
    fetchRecruitmentApplications(task.id);
  };

  const handleApplicationStatusChange = async (applicationId: string, newStatus: 'Acceptée' | 'Refusée') => {
    try {
      const application = recruitmentApplications.find(app => app.id === applicationId);
      if (!application) return;

      // Mettre à jour le statut dans Firestore
      await updateDoc(doc(db, 'applications', applicationId), {
        status: newStatus,
        reviewedBy: currentUser?.uid,
        reviewedAt: new Date(),
        updatedAt: new Date()
      });

      // Mettre à jour l'état local
      setRecruitmentApplications(prev => prev.map(app => 
        app.id === applicationId 
          ? { ...app, status: newStatus, reviewedBy: currentUser?.uid, reviewedAt: new Date(), updatedAt: new Date() }
          : app
      ));

      // Mettre à jour le nombre de candidatures acceptées dans la tâche
      const updatedApplications = recruitmentApplications.map(app => 
        app.id === applicationId ? { ...app, status: newStatus } : app
      );
      const acceptedApplications = updatedApplications.filter(app => app.status === 'Acceptée').length;

      // Mettre à jour la tâche de recrutement
      if (selectedRecruitmentTask) {
        await updateDoc(doc(db, 'recruitmentTasks', selectedRecruitmentTask.id), {
          recruitedStudents: acceptedApplications
        });

        setRecruitmentTasks(prev => prev.map(task => 
          task.id === selectedRecruitmentTask.id 
            ? { ...task, recruitedStudents: acceptedApplications }
            : task
        ));

        // Si la tâche est liée à des postes de budget, mettre aussi à jour les compteurs des postes
        if (selectedRecruitmentTask.budgetItemIds && selectedRecruitmentTask.budgetItemIds.length > 0) {
          try {
            const batch = writeBatch(db);
            selectedRecruitmentTask.budgetItemIds.forEach(budgetItemId => {
              const budgetItemRef = doc(db, 'budgetItems', budgetItemId);
              batch.update(budgetItemRef, { recruitedStudents: acceptedApplications });
            });
            await batch.commit();

            // Mettre à jour l'état local des postes de budget
            setBudgetItems(prev => prev.map(item =>
              selectedRecruitmentTask.budgetItemIds!.includes(item.id)
                ? { ...item, recruitedStudents: acceptedApplications }
                : item
            ));
          } catch (e) {
            console.warn('Impossible de mettre à jour les postes de budget liés:', e);
          }
        }

        // Recharge complète des données associées pour synchroniser toutes les vues/tables
        try {
          if (etude?.id) {
            await loadAssociatedData(etude.id);
          }
        } catch (e) {
          console.warn('Recharge des données associées échouée:', e);
        }
      }

      // Rafraîchir les compteurs et les étudiants recrutés
      if (selectedRecruitmentTask) {
        const newTotalCount = await getApplicationsCount(selectedRecruitmentTask.id);
        const newPendingCount = await getPendingApplicationsCount(selectedRecruitmentTask.id);
        
        setApplicationsCounts(prev => ({
          ...prev,
          [selectedRecruitmentTask.id]: newTotalCount
        }));
        
        setPendingApplicationsCounts(prev => ({
          ...prev,
          [selectedRecruitmentTask.id]: newPendingCount
        }));

        // Mettre à jour les étudiants recrutés pour cette tâche
        const recruitedStudents = await getRecruitedStudentsForTask(selectedRecruitmentTask.id);
        setRecruitedStudentsByTask(prev => ({
          ...prev,
          [selectedRecruitmentTask.id]: recruitedStudents
        }));
      }

      setSnackbar({
        open: true,
        message: `Candidature ${newStatus.toLowerCase()} avec succès`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour du statut',
        severity: 'error'
      });
    }
  };

  const handleViewApplicationDetail = (application: RecruitmentApplication) => {
    setSelectedApplication(application);
    setApplicationDetailDialogOpen(true);
  };

  // Synchronise les compteurs des postes de budget en fonction des tâches de recrutement existantes
  const syncBudgetItemsFromRecruitmentTasks = async () => {
    return syncBudgetItemsFromRecruitmentTasksWithTasks(recruitmentTasks);
  };

  // Version de la fonction qui accepte les tâches en paramètre
  const syncBudgetItemsFromRecruitmentTasksWithTasks = async (tasks: RecruitmentTask[]) => {
    if (!etude?.id) return;
    try {
      console.log('Début de syncBudgetItemsFromRecruitmentTasksWithTasks');
      console.log('Tâches de recrutement passées:', tasks.length);
      console.log('Postes de budget actuels:', budgetItems.length);
      
      // Construire un agrégat par budgetItemId à partir des tâches passées
      const aggregate: Record<string, { required: number; recruited: number }> = {};
      
      // Récupérer les vraies données des candidatures pour chaque tâche
      for (const task of tasks) {
        if (!task.budgetItemIds || task.budgetItemIds.length === 0) continue;
        
        const required = task.studentsToRecruit || 0;
        
        // Récupérer le nombre réel d'étudiants recrutés depuis les candidatures
        const applicationsRef = collection(db, 'applications');
        const applicationsQuery = query(
          applicationsRef, 
          where('missionId', '==', task.id),
          where('status', 'in', ['Acceptée', 'Ajouté manuellement'])
        );
        const applicationsSnapshot = await getDocs(applicationsQuery);
        const recruited = applicationsSnapshot.size;
        
        console.log(`Tâche ${task.title}: ${required} requis, ${recruited} recrutés (basé sur les candidatures)`);
        
        for (const bid of task.budgetItemIds) {
          if (!aggregate[bid]) aggregate[bid] = { required: 0, recruited: 0 };
          aggregate[bid].required += required;
          aggregate[bid].recruited += recruited;
        }
      }

      console.log('Agrégat des tâches par poste de budget:', aggregate);

      const batch = writeBatch(db);
      const updatedLocal = budgetItems.map(item => {
        const agg = aggregate[item.id];
        if (agg) {
          // Au moins une tâche liée → statut En cours + compteurs
          let recruitmentStatus = 'En cours';
          if (agg.required > 0) {
            recruitmentStatus = agg.recruited >= agg.required ? 'Terminé' : 'En cours';
          } else if (agg.recruited > 0) {
            recruitmentStatus = 'Terminé'; // Si des étudiants sont recrutés mais aucun requis, considérer comme terminé
          }
          
          const updates: any = {
            studentsToRecruit: agg.required,
            recruitedStudents: agg.recruited,
            recruitmentStatus: recruitmentStatus
          };
          batch.update(doc(db, 'budgetItems', item.id), updates);
          console.log(`Poste ${item.id} (${item.title}): Mise à jour avec recrutement - ${agg.required} étudiants requis, ${agg.recruited} recrutés`);
          return { ...item, ...updates } as BudgetItem;
        } else {
          // Aucune tâche liée → réinitialiser les champs
          const updates: any = {
            studentsToRecruit: deleteField(),
            recruitedStudents: 0,
            recruitmentStatus: deleteField()
          };
          batch.update(doc(db, 'budgetItems', item.id), updates);
          console.log(`Poste ${item.id} (${item.title}): Réinitialisation - aucune tâche de recrutement liée`);
          return { ...item, studentsToRecruit: undefined, recruitedStudents: 0, recruitmentStatus: undefined } as BudgetItem;
        }
      });

      await batch.commit();
      setBudgetItems(updatedLocal);
      console.log('syncBudgetItemsFromRecruitmentTasksWithTasks terminé avec succès');
    } catch (e) {
      console.error('syncBudgetItemsFromRecruitmentTasksWithTasks a échoué:', e);
    }
  };



  const handlePreviewCV = (cvUrl: string) => {
    setCvPreviewUrl(cvUrl);
    setCvPreviewOpen(true);
  };

  // Fonction pour récupérer le nombre de candidatures pour une tâche
  const getApplicationsCount = async (taskId: string) => {
    try {
      const applicationsRef = collection(db, 'applications');
      const q = query(applicationsRef, where('missionId', '==', taskId));
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('Erreur lors du comptage des candidatures:', error);
      return 0;
    }
  };

  // Fonction pour récupérer le nombre de candidatures en attente
  const getPendingApplicationsCount = async (taskId: string) => {
    try {
      const applicationsRef = collection(db, 'applications');
      const q = query(
        applicationsRef, 
        where('missionId', '==', taskId),
        where('status', '==', 'En attente')
      );
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('Erreur lors du comptage des candidatures en attente:', error);
      return 0;
    }
  };

  // Fonction pour charger tous les compteurs de candidatures
  const loadApplicationsCounts = async () => {
    const counts: {[taskId: string]: number} = {};
    const pendingCounts: {[taskId: string]: number} = {};
    
    for (const task of recruitmentTasks) {
      counts[task.id] = await getApplicationsCount(task.id);
      pendingCounts[task.id] = await getPendingApplicationsCount(task.id);
    }
    
    setApplicationsCounts(counts);
    setPendingApplicationsCounts(pendingCounts);
  };

  // Fonction pour récupérer les étudiants recrutés pour une tâche
  const getRecruitedStudentsForTask = async (taskId: string): Promise<RecruitmentApplication[]> => {
    try {
      console.log(`🔍 Recherche d'étudiants recrutés pour la tâche ${taskId}`);
      const applicationsRef = collection(db, 'applications');
      const q = query(
        applicationsRef, 
        where('missionId', '==', taskId),
        where('status', 'in', ['Acceptée', 'Ajouté manuellement'])
      );
      const snapshot = await getDocs(q);
      
      console.log(`📊 Trouvé ${snapshot.docs.length} candidatures acceptées pour la tâche ${taskId}`);
      
      const applications = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          recruitmentTaskId: data.recruitmentTaskId || data.missionId,
          userId: data.userId,
          userEmail: data.userEmail,
          userDisplayName: data.userDisplayName,
          userPhotoURL: data.userPhotoURL,
          cvUrl: data.cvUrl,
          cvUpdatedAt: data.cvUpdatedAt?.toDate(),
          motivationLetter: data.motivationLetter,
          status: data.status,
          submittedAt: data.submittedAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          reviewedBy: data.reviewedBy,
          reviewedAt: data.reviewedAt?.toDate(),
          reviewNotes: data.reviewNotes,
          addedManually: data.addedManually
        } as RecruitmentApplication;
      });
      
      console.log(`✅ Étudiants recrutés pour la tâche ${taskId}:`, applications.map(app => app.userDisplayName));
      return applications;
    } catch (error) {
      console.error('Erreur lors de la récupération des étudiants recrutés:', error);
      return [];
    }
  };

  // Fonction pour charger les étudiants recrutés pour toutes les tâches
  const loadRecruitedStudents = async () => {
    const recruitedStudents: {[taskId: string]: RecruitmentApplication[]} = {};
    
    for (const task of recruitmentTasks) {
      recruitedStudents[task.id] = await getRecruitedStudentsForTask(task.id);
    }
    
    setRecruitedStudentsByTask(recruitedStudents);
  };

  // Fonction pour ouvrir la popup des étudiants recrutés
  const handleOpenRecruitedStudents = (students: RecruitmentApplication[], title: string) => {
    setSelectedRecruitedStudents(students);
    setSelectedRecruitedStudentsTitle(title);
    setRecruitedStudentsDialogOpen(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !etude?.id) return;

    try {
      // Simuler l'upload (dans un vrai projet, utiliser Firebase Storage)
      const documentData: Document = {
        id: Date.now().toString(),
        name: file.name,
        type: getFileType(file.name),
        url: URL.createObjectURL(file),
        uploadedAt: new Date(),
        uploadedBy: currentUser?.uid || '',
        size: file.size
      };

      await addDoc(collection(db, 'documents'), {
        ...documentData,
        etudeId: etude.id
      });

      setDocuments([...documents, documentData]);
      setSnackbar({
        open: true,
        message: 'Document uploadé avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de l\'upload:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de l\'upload du document',
        severity: 'error'
      });
    }
  };

  const getFileType = (fileName: string): Document['type'] => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pptx':
      case 'ppt':
        return 'powerpoint';
      case 'pdf':
        return 'pdf';
      case 'xlsx':
      case 'xls':
        return 'excel';
      case 'docx':
      case 'doc':
        return 'word';
      default:
        return 'other';
    }
  };

  const calculateTotalBudget = () => {
    return budgetItems.reduce((total, item) => total + item.budget, 0);
  };

  const calculateTotalRemuneration = () => {
    return recruitmentTasks.reduce((total, task) => total + task.remuneration, 0);
  };

  // Rémunération totale basée uniquement sur heures * taux horaire des postes de budget
  const calculateTotalHourlyRemuneration = () => {
    return budgetItems.reduce((total, item) => {
      const hours = item.hoursCount || 0;
      const rate = item.hourlyRate || 0;
      return total + (hours * rate);
    }, 0);
  };

  const calculateTotalRemunerationCost = () => {
    return budgetItems.reduce((total, item) => {
      if (item.jehCount && item.jehRate) {
        return total + (item.jehCount * item.jehRate);
      } else if (item.hoursCount && item.hourlyRate) {
        return total + (item.hoursCount * item.hourlyRate);
      }
      return total;
    }, 0);
  };

  const calculateMargin = () => {
    const totalBudget = calculateTotalBudget();
    const totalRemunerationCost = calculateTotalRemunerationCost();
    return totalBudget - totalRemunerationCost;
  };

  const calculateRemunerationPercentage = () => {
    const totalBudget = calculateTotalBudget();
    if (totalBudget === 0) return 0;
    const totalRemunerationCost = calculateTotalRemunerationCost();
    return (totalRemunerationCost / totalBudget) * 100;
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Non définie';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'En cours':
        return 'primary';
      case 'Terminé':
        return 'success';
      case 'En attente':
        return 'warning';
      default:
        return 'default';
    }
  };

  // Fonctions pour le planning visuel
  const generateTimelineWeeks = (): string[] => {
    if (etude?.startDate && etude?.endDate) {
      // Si on a des dates, générer les semaines basées sur les dates
      const start = new Date(etude.startDate);
      const end = new Date(etude.endDate);
      const weeks = [];
      const current = new Date(start);
      
      while (current <= end) {
        const weekNumber = Math.ceil((current.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
        weeks.push(`S${weekNumber}`);
        current.setDate(current.getDate() + 7);
      }
      
      // Appliquer le zoom
      const baseWeeks = weeks.length > 0 ? weeks : ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
      
      if (timelineZoom >= 1) {
        // Zoom : répéter les semaines
        const zoomedWeeks = [];
        for (let i = 0; i < baseWeeks.length; i++) {
          for (let j = 0; j < timelineZoom; j++) {
            zoomedWeeks.push(baseWeeks[i]);
          }
        }
        return zoomedWeeks;
      } else {
        // Dézoom : prendre une partie des semaines
        const numWeeks = Math.max(1, Math.floor(baseWeeks.length * timelineZoom));
        return baseWeeks.slice(0, numWeeks);
      }
    } else {
      // Sinon, utiliser des semaines génériques avec zoom
      // Calculer le maximum basé sur les budget items existants (début ET fin)
      const maxWeekFromBudgetItems = budgetItems.reduce((max, item) => {
        // Vérifier la date de début
        const startWeekMatch = item.startDate.match(/S(\d+)/);
        if (startWeekMatch) {
          const startWeekNumber = parseInt(startWeekMatch[1]);
          max = Math.max(max, startWeekNumber);
        }
        
        // Vérifier la date de fin
        const endWeekMatch = item.endDate.match(/S(\d+)/);
        if (endWeekMatch) {
          const endWeekNumber = parseInt(endWeekMatch[1]);
          max = Math.max(max, endWeekNumber);
        }
        
        return max;
      }, 4); // Minimum 4 semaines
      
      const effectiveMaxWeeks = Math.max(maxWeeks, maxWeekFromBudgetItems);
      
      const baseWeeks = [];
      for (let i = 1; i <= effectiveMaxWeeks; i++) {
        baseWeeks.push(`S${i}`);
      }
      
      if (timelineZoom >= 1) {
        // Zoom : répéter les semaines
        const zoomedWeeks = [];
        for (let i = 0; i < baseWeeks.length; i++) {
          for (let j = 0; j < timelineZoom; j++) {
            zoomedWeeks.push(baseWeeks[i]);
          }
        }
        return zoomedWeeks;
      } else {
        // Dézoom : prendre une partie des semaines
        const numWeeks = Math.max(1, Math.floor(baseWeeks.length * timelineZoom));
        return baseWeeks.slice(0, numWeeks);
      }
    }
  };

  const calculateTaskPosition = (startDate: string): number => {
    if (!etude?.startDate || !etude?.endDate) {
      // Si pas de dates d'étude, utiliser la semaine comme position
      const weekMatch = startDate.match(/S(\d+)/);
      if (weekMatch) {
        const weekNumber = parseInt(weekMatch[1]);
        const effectiveMaxWeeks = Math.max(maxWeeks, getMinRequiredWeeks());
        let totalWeeks;
        if (timelineZoom >= 1) {
          totalWeeks = effectiveMaxWeeks * timelineZoom;
        } else {
          // Pour les dézooms, calculer le nombre de semaines affichées
          totalWeeks = Math.max(1, Math.floor(effectiveMaxWeeks * timelineZoom));
        }
        // S'assurer que la position ne dépasse pas 100%
        return Math.max(0, Math.min(100, ((weekNumber - 1) / totalWeeks) * 100));
      }
      return 0;
    }
    
    // Si les dates d'étude sont définies, convertir les semaines en dates réelles
    let actualStartDate = startDate;
    const weekMatch = startDate.match(/S(\d+)/);
    if (weekMatch && etude.startDate) {
      const weekNumber = parseInt(weekMatch[1]);
      const studyStart = new Date(etude.startDate);
      const weekStart = new Date(studyStart.getTime() + ((weekNumber - 1) * 7 * 24 * 60 * 60 * 1000));
      actualStartDate = weekStart.toISOString().split('T')[0];
    }
    
    const studyStart = new Date(etude.startDate);
    const studyEnd = new Date(etude.endDate);
    const taskStart = new Date(actualStartDate);
    
    const totalDuration = studyEnd.getTime() - studyStart.getTime();
    const taskOffset = taskStart.getTime() - studyStart.getTime();
    
    // S'assurer que la position ne dépasse pas 100%
    return Math.max(0, Math.min(100, (taskOffset / totalDuration) * 100));
  };

  const calculateTaskWidth = (startDate: string, endDate: string): number => {
    if (!etude?.startDate || !etude?.endDate) {
      // Si pas de dates d'étude, calculer la largeur basée sur les semaines
      const effectiveMaxWeeks = Math.max(maxWeeks, getMinRequiredWeeks());
      let totalWeeks;
      if (timelineZoom >= 1) {
        totalWeeks = effectiveMaxWeeks * timelineZoom;
      } else {
        // Pour les dézooms, calculer le nombre de semaines affichées
        totalWeeks = Math.max(1, Math.floor(effectiveMaxWeeks * timelineZoom));
      }
      
      // Calculer la durée en semaines
      const startWeekMatch = startDate.match(/S(\d+)/);
      const endWeekMatch = endDate.match(/S(\d+)/);
      
      if (startWeekMatch && endWeekMatch) {
        const startWeek = parseInt(startWeekMatch[1]);
        const endWeek = parseInt(endWeekMatch[1]);
        const duration = Math.max(1, endWeek - startWeek + 1);
        // S'assurer que la largeur ne dépasse pas 100% et reste dans les limites
        const calculatedWidth = (duration / effectiveMaxWeeks) * 100;
        return Math.max(5, Math.min(100, calculatedWidth));
      }
      
      return Math.max(5, Math.min(100, (100 / totalWeeks))); // Largeur par défaut avec limites
    }
    
    // Si les dates d'étude sont définies, convertir les semaines en dates réelles
    let actualStartDate = startDate;
    let actualEndDate = endDate;
    
    const startWeekMatch = startDate.match(/S(\d+)/);
    const endWeekMatch = endDate.match(/S(\d+)/);
    
    if (startWeekMatch && etude.startDate) {
      const weekNumber = parseInt(startWeekMatch[1]);
      const studyStart = new Date(etude.startDate);
      const weekStart = new Date(studyStart.getTime() + ((weekNumber - 1) * 7 * 24 * 60 * 60 * 1000));
      actualStartDate = weekStart.toISOString().split('T')[0];
    }
    
    if (endWeekMatch && etude.startDate) {
      const weekNumber = parseInt(endWeekMatch[1]);
      const studyStart = new Date(etude.startDate);
      const weekEnd = new Date(studyStart.getTime() + (weekNumber * 7 * 24 * 60 * 60 * 1000));
      actualEndDate = weekEnd.toISOString().split('T')[0];
    }
    
    const studyStart = new Date(etude.startDate);
    const studyEnd = new Date(etude.endDate);
    const taskStart = new Date(actualStartDate);
    const taskEnd = new Date(actualEndDate);
    
    const totalDuration = studyEnd.getTime() - studyStart.getTime();
    const taskDuration = taskEnd.getTime() - taskStart.getTime();
    
    // S'assurer que la largeur reste dans les limites
    return Math.max(5, Math.min(100, (taskDuration / totalDuration) * 100));
  };

  const getTaskColor = (priority: string): string => {
    switch (priority) {
      case 'Haute':
        return '#ff4757';
      case 'Moyenne':
        return '#ffa502';
      case 'Basse':
        return '#2ed573';
      default:
        return '#667eea';
    }
  };

  const getBudgetItemColor = (color: string): string => {
    return color || '#667eea';
  };

  const availableColors = [
    '#667eea', // Bleu
    '#ff6b6b', // Rouge
    '#4ecdc4', // Turquoise
    '#45b7d1', // Bleu clair
    '#96ceb4', // Vert
    '#feca57', // Orange
    '#a55eea', // Violet
    '#26de81', // Vert vif
    '#fd79a8', // Rose
    '#fdcb6e', // Jaune
    '#6c5ce7', // Violet foncé
    '#00b894', // Vert émeraude
  ];

  const getUsedColors = (): string[] => {
    const usedColors = budgetItems.map(item => item.color).filter(Boolean);
    return [...new Set(usedColors)];
  };

  const handleBudgetItemClick = (item: BudgetItem, event: React.MouseEvent) => {
    console.log('🖱️ Budget item click:', item.title);
    event.stopPropagation();
    setEditingBudgetItem(item);
    setNewBudgetItem({
      title: item.title,
      description: item.description,
      budget: item.budget,
      color: item.color,
      startDate: item.startDate,
      endDate: item.endDate,
      jehCount: item.jehCount,
      jehRate: item.jehRate,
      hoursCount: item.hoursCount,
      hourlyRate: item.hourlyRate
    });
    
    // Calculer la position de la popup au-dessus du poste de budget
    const timelineElement = document.querySelector('[data-timeline]') as HTMLElement;
    if (timelineElement) {
      const timelineRect = timelineElement.getBoundingClientRect();
      
      // Calculer la position du poste de budget dans la timeline
      const startWeek = parseInt(item.startDate.match(/S(\d+)/)?.[1] || '1');
      const endWeek = parseInt(item.endDate.match(/S(\d+)/)?.[1] || '1');
      const effectiveMaxWeeks = Math.max(maxWeeks, getMinRequiredWeeks());
      
      // Calculer la position en pourcentage
      const startPercentage = ((startWeek - 1) / effectiveMaxWeeks) * 100;
      const endPercentage = ((endWeek - 1) / effectiveMaxWeeks) * 100;
      const centerPercentage = (startPercentage + endPercentage) / 2;
      
      // Calculer la position X dans la timeline
      const timelineWidth = timelineRect.width;
      const x = timelineRect.left + (centerPercentage / 100) * timelineWidth;
      
      // Positionner la popup au-dessus de la timeline
      const y = timelineRect.top - 250; // 20px au-dessus de la timeline
      
      console.log('📍 Edit popup position:', { x, y, centerPercentage });
      setQuickBudgetPosition({ x, y });
    } else {
      // Fallback : utiliser la position du clic avec un décalage vers le haut
      const x = event.clientX;
      const y = event.clientY - 100; // Décalage plus important vers le haut
      
      console.log('📍 Edit popup position (fallback):', { x, y });
      setQuickBudgetPosition({ x, y });
    }
    
    setQuickBudgetDialogOpen(true);
  };

  const handleBudgetItemResizeStart = (item: BudgetItem, event: React.MouseEvent, type: 'start' | 'end') => {
    event.stopPropagation();
    setResizingBudgetItem(item);
    setResizeStart(event.clientX);
    setResizeType(type);
  };

  const handleBudgetItemMoveStart = (item: BudgetItem, event: React.MouseEvent) => {
    event.stopPropagation();
    setResizingBudgetItem(item);
    setResizeStart(event.clientX);
    setResizeType('move');
  };

  const handleBudgetItemResizeMove = (event: MouseEvent) => {
    if (!resizingBudgetItem || !resizeType) return;

    const timelineElement = document.querySelector('[data-timeline]') as HTMLElement;
    if (!timelineElement) return;

    const timelineRect = timelineElement.getBoundingClientRect();
    const timelineWidth = timelineRect.width;
    
    // Calculer la position du curseur en pourcentage dans la timeline
    const cursorX = event.clientX - timelineRect.left;
    const cursorPercentage = (cursorX / timelineWidth) * 100;
    
    // Calculer le nombre de semaines total affiché
    const effectiveMaxWeeks = Math.max(maxWeeks, getMinRequiredWeeks());
    const totalWeeks = timelineZoom >= 1 ? effectiveMaxWeeks * timelineZoom : Math.max(1, Math.floor(effectiveMaxWeeks * timelineZoom));
    
    // Calculer la semaine correspondant à la position du curseur
    const cursorWeek = Math.max(1, Math.min(effectiveMaxWeeks, Math.round((cursorPercentage / 100) * totalWeeks)));

    if (resizeType === 'start') {
      const endWeek = parseInt(resizingBudgetItem.endDate.match(/S(\d+)/)?.[1] || '1');
      const newStartWeek = Math.max(1, Math.min(endWeek - 1, cursorWeek));
      
      setBudgetItems(prev => prev.map(item => 
        item.id === resizingBudgetItem.id 
          ? { ...item, startDate: `S${newStartWeek}` }
          : item
      ));
      
      // Mettre à jour resizingBudgetItem en temps réel
      setResizingBudgetItem(prev => prev ? { ...prev, startDate: `S${newStartWeek}` } : null);
    } else if (resizeType === 'end') {
      const startWeek = parseInt(resizingBudgetItem.startDate.match(/S(\d+)/)?.[1] || '1');
      const newEndWeek = Math.max(startWeek + 1, Math.min(effectiveMaxWeeks, cursorWeek));
      
      setBudgetItems(prev => prev.map(item => 
        item.id === resizingBudgetItem.id 
          ? { ...item, endDate: `S${newEndWeek}` }
          : item
      ));
      
      // Mettre à jour resizingBudgetItem en temps réel
      setResizingBudgetItem(prev => prev ? { ...prev, endDate: `S${newEndWeek}` } : null);
    } else if (resizeType === 'move') {
      // Déplacer la box entière
      const currentStartWeek = parseInt(resizingBudgetItem.startDate.match(/S(\d+)/)?.[1] || '1');
      const currentEndWeek = parseInt(resizingBudgetItem.endDate.match(/S(\d+)/)?.[1] || '1');
      const duration = currentEndWeek - currentStartWeek + 1;
      
      // Calculer la nouvelle position en fonction du curseur
      const newStartWeek = Math.max(1, Math.min(effectiveMaxWeeks - duration + 1, cursorWeek));
      const newEndWeek = newStartWeek + duration - 1;
      
      setBudgetItems(prev => prev.map(item => 
        item.id === resizingBudgetItem.id 
          ? { ...item, startDate: `S${newStartWeek}`, endDate: `S${newEndWeek}` }
          : item
      ));
      
      // Mettre à jour resizingBudgetItem en temps réel
      setResizingBudgetItem(prev => prev ? { 
        ...prev, 
        startDate: `S${newStartWeek}`, 
        endDate: `S${newEndWeek}` 
      } : null);
    }
  };

    const handleBudgetItemResizeEnd = () => {
    console.log('🔚 Resize end - resizingBudgetItem:', resizingBudgetItem);
    console.log('🔚 Resize end - resizeType:', resizeType);
    
    if (resizingBudgetItem) {
      // Récupérer les données mises à jour depuis l'état local
      const updatedItem = budgetItems.find(item => item.id === resizingBudgetItem.id);
      console.log('🔚 Resize end - updatedItem:', updatedItem);
      
      if (updatedItem) {
        // Sauvegarder directement les nouvelles dates dans Firestore
        const updateData = {
          startDate: updatedItem.startDate,
          endDate: updatedItem.endDate
        };
        
        const actionType = resizeType === 'move' ? 'déplacement' : 'redimensionnement';
        
        console.log(`💾 Sauvegarde ${actionType}:`, updateData);
        
        // Mettre à jour Firestore directement
        updateDoc(doc(db!, 'budgetItems', updatedItem.id), updateData)
          .then(() => {
            console.log(`✅ ${actionType} sauvegardé:`, updateData);
            setSnackbar({
              open: true,
              message: resizeType === 'move' ? 'Poste déplacé avec succès' : 'Période mise à jour avec succès',
              severity: 'success'
            });
          })
          .catch((error) => {
            console.error(`❌ Erreur lors de la sauvegarde du ${actionType}:`, error);
            setSnackbar({
              open: true,
              message: resizeType === 'move' ? 'Erreur lors du déplacement' : 'Erreur lors de la mise à jour de la période',
              severity: 'error'
            });
          });
      } else {
        console.log('🔚 Resize end - updatedItem non trouvé');
      }
    }
    setResizingBudgetItem(null);
    setResizeStart(0);
    setResizeType(null);
  };

  // Fermer la popup quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quickBudgetDialogOpen && !isDraggingPopup) {
        // Vérifier si le clic est sur la popup elle-même
        const target = event.target as Element;
        if (target && target.closest('[data-popup="budget-item"]')) {
          return; // Ne pas fermer si on clique sur la popup
        }
        
        // Attendre un peu pour éviter de fermer immédiatement
        setTimeout(() => {
          setQuickBudgetDialogOpen(false);
          setEditingBudgetItem(null);
          setNewBudgetItem({});
        }, 100);
      }
    };

    if (quickBudgetDialogOpen) {
      // Utiliser un délai pour éviter la fermeture immédiate
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 200);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [quickBudgetDialogOpen, isDraggingPopup]);

  // Fonctions pour le déplacement de la popup
  const handlePopupMouseDown = (event: React.MouseEvent) => {
    // Vérifier si on clique sur la zone de titre (header) de la popup
    const target = event.target as Element;
    const popupHeader = target.closest('[data-popup-header]');
    
    if (popupHeader) {
      event.preventDefault();
      event.stopPropagation();
      
      setIsDraggingPopup(true);
      setDragStartPosition({ x: event.clientX, y: event.clientY });
      
      // Calculer l'offset simple
      setDragOffset({
        x: event.clientX - quickBudgetPosition.x,
        y: event.clientY - quickBudgetPosition.y
      });
    }
  };

  const handlePopupMouseMove = (event: MouseEvent) => {
    if (isDraggingPopup) {
      event.preventDefault();
      
      const newX = event.clientX - dragOffset.x;
      const newY = event.clientY - dragOffset.y;
      
      // Limiter la position de la popup dans les limites de la fenêtre
      const popupWidth = 320; // Largeur approximative de la popup
      const popupHeight = 400; // Hauteur approximative de la popup
      const maxX = window.innerWidth - popupWidth;
      const maxY = window.innerHeight - popupHeight;
      
      // Ajouter une marge de sécurité
      const margin = 20;
      
      setQuickBudgetPosition({
        x: Math.max(margin, Math.min(newX, maxX - margin)),
        y: Math.max(margin, Math.min(newY, maxY - margin))
      });
    }
  };

  const handlePopupMouseUp = () => {
    if (isDraggingPopup) {
      setIsDraggingPopup(false);
      
      // Vérifier si la popup est complètement hors de l'écran et la recentrer si nécessaire
      const popupWidth = 320;
      const popupHeight = 400;
      const margin = 20;
      
      let newX = quickBudgetPosition.x;
      let newY = quickBudgetPosition.y;
      
      // Vérifier les limites horizontales
      if (newX < margin) {
        newX = margin;
      } else if (newX > window.innerWidth - popupWidth - margin) {
        newX = window.innerWidth - popupWidth - margin;
      }
      
      // Vérifier les limites verticales
      if (newY < margin) {
        newY = margin;
      } else if (newY > window.innerHeight - popupHeight - margin) {
        newY = window.innerHeight - popupHeight - margin;
      }
      
      // Mettre à jour la position si nécessaire
      if (newX !== quickBudgetPosition.x || newY !== quickBudgetPosition.y) {
        setQuickBudgetPosition({ x: newX, y: newY });
      }
      
      // Sauvegarder la position dans le localStorage
      localStorage.setItem('budgetPopupPosition', JSON.stringify({ x: newX, y: newY }));
    }
  };

  // Event listeners pour le déplacement de la popup
  useEffect(() => {
    if (isDraggingPopup) {
      document.addEventListener('mousemove', handlePopupMouseMove);
      document.addEventListener('mouseup', handlePopupMouseUp);
      
      // Empêcher la sélection de texte pendant le déplacement
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handlePopupMouseMove);
        document.removeEventListener('mouseup', handlePopupMouseUp);
        
        // Restaurer la sélection de texte
        document.body.style.userSelect = '';
      };
    }
  }, [isDraggingPopup, dragOffset]);

  // Gérer le redimensionnement de la fenêtre pour maintenir la popup visible
  useEffect(() => {
    const handleResize = () => {
      if (quickBudgetDialogOpen) {
        const popupWidth = 320;
        const popupHeight = 400;
        const margin = 20;
        
        let newX = quickBudgetPosition.x;
        let newY = quickBudgetPosition.y;
        
        // Vérifier les limites horizontales
        if (newX > window.innerWidth - popupWidth - margin) {
          newX = window.innerWidth - popupWidth - margin;
        }
        
        // Vérifier les limites verticales
        if (newY > window.innerHeight - popupHeight - margin) {
          newY = window.innerHeight - popupHeight - margin;
        }
        
        // Mettre à jour la position si nécessaire
        if (newX !== quickBudgetPosition.x || newY !== quickBudgetPosition.y) {
          setQuickBudgetPosition({ x: newX, y: newY });
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [quickBudgetDialogOpen, quickBudgetPosition]);

  // Event listeners pour le redimensionnement
  useEffect(() => {
    if (resizingBudgetItem) {
      document.addEventListener('mousemove', handleBudgetItemResizeMove);
      document.addEventListener('mouseup', handleBudgetItemResizeEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleBudgetItemResizeMove);
        document.removeEventListener('mouseup', handleBudgetItemResizeEnd);
      };
    }
  }, [resizingBudgetItem, resizeType, resizeStart]);

  const formatBudgetItemDate = (date: string): string => {
    if (date.match(/S\d+/)) {
      const weekNumber = date.match(/S(\d+)/)?.[1];
      return `Semaine ${weekNumber}`;
    }
    
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return 'Date invalide';
      }
      
      // Calculer le jour depuis le début de l'étude
      if (etude?.startDate) {
        const studyStart = new Date(etude.startDate);
        const daysDiff = Math.floor((dateObj.getTime() - studyStart.getTime()) / (1000 * 60 * 60 * 24));
        const weekNumber = Math.floor(daysDiff / 7) + 1;
        const dayInWeek = (daysDiff % 7) + 1;
        return `Jour ${dayInWeek} - Semaine ${weekNumber}`;
      }
      
      return dateObj.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit' 
      });
    } catch (error) {
      return 'Date invalide';
    }
  };

  // Fonctions pour la sélection de plage
  const handleTimelineMouseDown = (event: React.MouseEvent) => {
    console.log('🖱️ MouseDown event triggered');
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    
    console.log('📊 Selection start:', percentage);
    setIsSelectingRange(true);
    setSelectionStart(percentage);
    setSelectionEnd(percentage);
    setMousePosition(percentage);
  };

  const handleTimelineMouseMove = (event: React.MouseEvent) => {
    if (!isSelectingRange) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    
    console.log('📊 Selection end:', percentage);
    setSelectionEnd(percentage);
    setMousePosition(percentage);
  };

  const handleTimelineMouseUp = (event: React.MouseEvent) => {
    console.log('🖱️ MouseUp event triggered, isSelectingRange:', isSelectingRange);
    if (!isSelectingRange) return;
    
    setIsSelectingRange(false);
    
    // Vérifier que la sélection a une largeur minimale
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    const width = end - start;
    
    console.log('📊 Selection width:', width, 'start:', start, 'end:', end);
    
    if (width > 2) { // Au moins 2% de largeur
      // Convertir les pourcentages en dates
      const dates = convertPercentageToDates(start, end);
      console.log('📅 Converted dates:', dates);
      
      if (dates && dates.startDate && dates.endDate) {
        // Créer un poste temporaire qui apparaîtra immédiatement
        const tempBudgetItem: BudgetItem = {
          id: `temp-${Date.now()}`,
          title: 'Nouveau poste',
          description: '',
          budget: 0,
          color: '#667eea',
          startDate: dates.startDate,
          endDate: dates.endDate,
          status: 'Planifié',
          createdAt: new Date(),
          createdBy: currentUser?.uid || '',
          etudeId: etude?.id || ''
        };
        
        // Ajouter le poste temporaire à la liste
        setCreatingBudgetItem(tempBudgetItem);
        setBudgetItems(prev => [...prev, tempBudgetItem]);
        
        // Préparer les données pour la popup
        setNewBudgetItem({
          startDate: dates.startDate,
          endDate: dates.endDate,
          title: 'Nouveau poste',
          description: '',
          budget: 0,
          color: '#667eea',
          status: 'Planifié'
        });
        
        // Positionner la popup près de la sélection avec un petit décalage
        const x = event.clientX;
        const y = event.clientY - 50; // Décalage vers le haut pour éviter que la popup cache le curseur
        
        console.log('📍 Popup position:', { x, y });
        setQuickBudgetPosition({ x, y });
        setQuickBudgetDialogOpen(true);
      } else {
        console.warn('Impossible de calculer les dates pour la sélection');
        setSnackbar({
          open: true,
          message: 'Impossible de créer le poste de budget : dates d\'étude manquantes',
          severity: 'warning'
        });
      }
    }
  };

  const convertPercentageToDates = (startPercent: number, endPercent: number) => {
    if (!etude?.startDate || !etude?.endDate) {
      // Si pas de dates d'étude, générer des semaines basées sur maxWeeks
      const effectiveMaxWeeks = Math.max(maxWeeks, getMinRequiredWeeks());
      const startWeek = Math.floor((startPercent / 100) * effectiveMaxWeeks) + 1;
      const endWeek = Math.floor((endPercent / 100) * effectiveMaxWeeks) + 1;
      
      // S'assurer que les semaines sont dans les limites
      const clampedStartWeek = Math.max(1, Math.min(effectiveMaxWeeks, startWeek));
      const clampedEndWeek = Math.max(1, Math.min(effectiveMaxWeeks, endWeek));
      
      return {
        startDate: `S${clampedStartWeek}`,
        endDate: `S${clampedEndWeek}`
      };
    }
    
    try {
      // Nettoyer et valider les dates d'entrée
      const startDateStr = etude.startDate.toString().split('T')[0];
      const endDateStr = etude.endDate.toString().split('T')[0];
      
      const studyStart = new Date(startDateStr);
      const studyEnd = new Date(endDateStr);
      
      // Vérifier que les dates sont valides
      if (isNaN(studyStart.getTime()) || isNaN(studyEnd.getTime())) {
        console.error('Dates d\'étude invalides:', startDateStr, endDateStr);
        return null;
      }
      
      const totalDuration = studyEnd.getTime() - studyStart.getTime();
      
      // Vérifier que la durée est positive
      if (totalDuration <= 0) {
        console.error('Durée d\'étude invalide - fin avant début');
        return null;
      }
      
      // Limiter les pourcentages entre 0 et 100
      const clampedStart = Math.max(0, Math.min(100, startPercent));
      const clampedEnd = Math.max(0, Math.min(100, endPercent));
      
      const startOffset = (clampedStart / 100) * totalDuration;
      const endOffset = (clampedEnd / 100) * totalDuration;
      
      const startDate = new Date(studyStart.getTime() + startOffset);
      const endDate = new Date(studyStart.getTime() + endOffset);
      
      // Vérifier que les dates calculées sont valides
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error('Erreur lors du calcul des dates finales');
        return null;
      }
      
      // S'assurer que la date de fin n'est pas avant la date de début
      if (endDate.getTime() < startDate.getTime()) {
        console.error('Date de fin calculée avant la date de début');
        return null;
      }
      
      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      };
    } catch (error) {
      console.error('Erreur lors de la conversion des pourcentages en dates:', error);
      return null;
    }
  };

  const handleBudgetItemSave = async () => {
    // Cette fonction n'est plus nécessaire car la sauvegarde se fait automatiquement
    // On ferme juste la popup
    setQuickBudgetDialogOpen(false);
    setNewBudgetItem({});
    setCreatingBudgetItem(null);
  };

  const handleBudgetItemUpdate = async (itemToUpdate?: BudgetItem) => {
    // Cette fonction n'est plus nécessaire car les mises à jour se font automatiquement
    // On ferme juste l'édition
    setEditingBudgetItem(null);
    setNewBudgetItem({});
  };

  // Fonction pour mettre à jour automatiquement un poste de budget (nouveau ou existant)
  const updateBudgetItemAutomatically = async (itemId: string, updates: Partial<BudgetItem>) => {
    try {
      if (!db) {
        throw new Error('Connexion Firestore non disponible');
      }

      // Mettre à jour l'état local immédiatement
      setBudgetItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      ));

      // Si c'est un poste temporaire (commence par 'temp-'), le créer dans la DB
      if (itemId.startsWith('temp-')) {
        const currentItem = budgetItems.find(item => item.id === itemId);
        if (!currentItem) return;

        const updatedItem = { ...currentItem, ...updates };

        // Créer l'objet de données en filtrant les champs undefined
        const budgetData = {
          title: updatedItem.title,
          description: updatedItem.description || '',
          budget: updatedItem.budget,
          color: updatedItem.color || '#667eea',
          startDate: updatedItem.startDate,
          endDate: updatedItem.endDate,
          status: updatedItem.status || 'Planifié',
          etudeId: etude?.id,
          createdAt: new Date(),
          createdBy: currentUser?.uid,
          ...(updatedItem.jehCount !== undefined && { jehCount: updatedItem.jehCount }),
          ...(updatedItem.jehRate !== undefined && { jehRate: updatedItem.jehRate }),
          ...(updatedItem.hoursCount !== undefined && { hoursCount: updatedItem.hoursCount }),
          ...(updatedItem.hourlyRate !== undefined && { hourlyRate: updatedItem.hourlyRate })
        };

        const docRef = await addDoc(collection(db, 'budgetItems'), budgetData);
        
        // Remplacer le poste temporaire par le vrai poste avec l'ID de la DB
        const newBudgetItemWithId: BudgetItem = {
          id: docRef.id,
          title: updatedItem.title,
          description: updatedItem.description || '',
          budget: updatedItem.budget,
          color: updatedItem.color || '#667eea',
          startDate: updatedItem.startDate,
          endDate: updatedItem.endDate,
          status: updatedItem.status || 'Planifié',
          etudeId: etude?.id || '',
          createdAt: new Date(),
          createdBy: currentUser?.uid || '',
          jehCount: updatedItem.jehCount,
          jehRate: updatedItem.jehRate,
          hoursCount: updatedItem.hoursCount,
          hourlyRate: updatedItem.hourlyRate
        };

        // Mettre à jour l'état avec le nouvel ID
        setBudgetItems(prev => prev.map(item => 
          item.id === itemId ? newBudgetItemWithId : item
        ));

        // Mettre à jour le poste en cours de création
        if (creatingBudgetItem?.id === itemId) {
          setCreatingBudgetItem(newBudgetItemWithId);
        }

      } else {
        // Si c'est un poste existant, le mettre à jour dans la DB
        // Créer l'objet de mise à jour en filtrant les champs undefined
        const updateData = {
          ...(updates.title !== undefined && { title: updates.title }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.budget !== undefined && { budget: updates.budget }),
          ...(updates.color !== undefined && { color: updates.color }),
          ...(updates.startDate !== undefined && { startDate: updates.startDate }),
          ...(updates.endDate !== undefined && { endDate: updates.endDate }),
          ...(updates.jehCount !== undefined && { jehCount: updates.jehCount }),
          ...(updates.jehRate !== undefined && { jehRate: updates.jehRate }),
          ...(updates.hoursCount !== undefined && { hoursCount: updates.hoursCount }),
          ...(updates.hourlyRate !== undefined && { hourlyRate: updates.hourlyRate })
        };

        await updateDoc(doc(db, 'budgetItems', itemId), updateData);
      }

    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde automatique:', error);
      // Ne pas afficher d'erreur à l'utilisateur pour éviter le spam
    }
  };

  // Fonction pour mettre à jour le poste temporaire en temps réel et sauvegarder automatiquement
  const updateTemporaryBudgetItem = async (updates: Partial<BudgetItem>) => {
    if (creatingBudgetItem) {
      await updateBudgetItemAutomatically(creatingBudgetItem.id, updates);
    }
  };

  // Fonction pour supprimer un poste de budget
  const handleDeleteBudgetItem = async (itemId: string) => {
    try {
      // Supprimer de Firestore
      await deleteDoc(doc(db, 'budgetItems', itemId));
      
      // Mettre à jour l'état local
      setBudgetItems(prev => prev.filter(item => item.id !== itemId));
      
      // Si c'était le poste en cours de création, le nettoyer
      if (creatingBudgetItem?.id === itemId) {
        setCreatingBudgetItem(null);
      }
      
      setSnackbar({
        open: true,
        message: 'Poste de budget supprimé avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la suppression du poste de budget:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la suppression du poste de budget',
        severity: 'error'
      });
    }
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        bgcolor: '#f5f5f7'
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress 
            size={60} 
            sx={{ 
              color: '#667eea',
              mb: 2,
              animation: `${pulse} 2s infinite`
            }} 
          />
          <Typography variant="h6" sx={{ color: '#1d1d1f', fontWeight: 500 }}>
            Chargement de l'étude...
          </Typography>
        </Box>
      </Box>
    );
  }

  if (!etude) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Étude non trouvée</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      bgcolor: '#f5f5f7',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header moderne */}
      <Box sx={{ 
        bgcolor: 'white',
        color: '#1d1d1f',
        py: 2,
        px: 3,
        position: 'relative',
        overflow: 'hidden',
        borderBottom: '1px solid #e5e5e7',
        flexShrink: 0
      }}>
        {/* Breadcrumb */}
        <Breadcrumbs 
          separator={<NavigateNextIcon fontSize="small" sx={{ color: '#86868b' }} />}
          sx={{ mb: 2, color: '#86868b' }}
        >
          <Link
            color="inherit"
            href="#"
            onClick={(e) => { e.preventDefault(); navigate('/app/etude'); }}
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              textDecoration: 'none',
              color: '#667eea',
              '&:hover': { textDecoration: 'underline' }
            }}
          >
            <HomeIcon sx={{ mr: 0.5, fontSize: 20 }} />
            Études
          </Link>
          <Typography sx={{ color: '#1d1d1f', fontWeight: 500 }}>
            Étude {etude.numeroEtude}
          </Typography>
        </Breadcrumbs>

        {/* Header principal */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          position: 'relative',
          zIndex: 1
        }}>
          <Box sx={{ animation: `${slideInLeft} 0.6s ease-out` }}>
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 800,
                mb: 1,
                textShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              Étude {etude.numeroEtude}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip 
                label={etude.status} 
                color={getStatusColor(etude.status) as any}
                sx={{ 
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  height: 28,
                  '& .MuiChip-label': { px: 1.5 }
                }}
              />
              <Chip 
                label={etude.etape} 
                variant="outlined"
                sx={{ 
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  height: 28,
                  borderColor: '#667eea',
                  color: '#667eea',
                  '& .MuiChip-label': { px: 1.5 }
                }}
              />
            </Box>
          </Box>

          {/* Logo et nom de l'entreprise à droite */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            animation: `${fadeInUp} 0.6s ease-out 0.2s both`
          }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1.5,
              p: 1.5,
              borderRadius: 2,
              bgcolor: '#f8f9fa',
              border: '1px solid #e5e5e7'
            }}>
              <Avatar
                src={etude.companyLogo || undefined}
                sx={{ 
                  width: 32, 
                  height: 32,
                  bgcolor: etude.companyLogo ? 'transparent' : '#667eea',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  '& img': {
                    objectFit: 'cover',
                    borderRadius: '50%'
                  }
                }}
              >
                {etude.company?.charAt(0)?.toUpperCase() || 'E'}
              </Avatar>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 600,
                  color: '#1d1d1f',
                  fontSize: '0.875rem'
                }}
              >
                {etude.company}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Contenu principal */}
      <Box sx={{ 
        px: 3, 
        position: 'relative', 
        zIndex: 2,
        flex: 1,
        pb: 4,
        mt: 0,
        overflow: 'auto'
      }}>
        {/* Onglets stylisés */}
        <Paper sx={{ 
          mb: 3, 
          mt: 2,
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <Tabs 
            value={tabValue} 
            onChange={(e, newValue) => setTabValue(newValue)}
            sx={{
              bgcolor: 'white',
              '& .MuiTab-root': {
                minHeight: 64,
                fontSize: '0.875rem',
                fontWeight: 600,
                textTransform: 'none',
                '&.Mui-selected': {
                  color: '#667eea',
                  '& .MuiSvgIcon-root': {
                    color: '#667eea'
                  }
                }
              },
              '& .MuiTabs-indicator': {
                height: 3,
                bgcolor: '#667eea'
              }
            }}
          >
            <Tab 
              label="Informations générales" 
              icon={<SettingsIcon />} 
              iconPosition="start"
            />
            <Tab 
              label="Planning & Budget" 
              icon={<TimelineIcon />} 
              iconPosition="start"
            />
            <Tab 
              label="Recrutement" 
              icon={<PeopleIcon />} 
              iconPosition="start"
            />
            <Tab 
              label="Documents" 
              icon={<DescriptionTabIcon />} 
              iconPosition="start"
            />
          </Tabs>
        </Paper>

        {/* Tab Content */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {/* Informations principales */}
            <Grid item xs={12} md={8}>
              <Paper sx={{ 
                p: 3, 
                mb: 3, 
                borderRadius: 3,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                animation: `${fadeInUp} 0.6s ease-out`
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#1d1d1f' }}>
                    Informations générales
                  </Typography>
                  <Box>
                    {editing ? (
                      <>
                        <Button
                          startIcon={<SaveIcon />}
                          onClick={handleSave}
                          variant="contained"
                          sx={{ 
                            mr: 1,
                            bgcolor: '#667eea',
                            '&:hover': { bgcolor: '#5a6fd8' }
                          }}
                        >
                          Sauvegarder
                        </Button>
                        <Button
                          startIcon={<CancelIcon />}
                          onClick={handleCancel}
                          variant="outlined"
                          sx={{ 
                            borderColor: '#d2d2d7',
                            color: '#1d1d1f',
                            '&:hover': { 
                              borderColor: '#1d1d1f',
                              bgcolor: 'rgba(0,0,0,0.04)'
                            }
                          }}
                        >
                          Annuler
                        </Button>
                      </>
                    ) : (
                      <Button
                        startIcon={<EditIcon />}
                        onClick={() => setEditing(true)}
                        variant="outlined"
                        sx={{ 
                          borderColor: '#667eea',
                          color: '#667eea',
                          '&:hover': { 
                            borderColor: '#5a6fd8',
                            bgcolor: 'rgba(102, 126, 234, 0.04)'
                          }
                        }}
                      >
                        Modifier
                      </Button>
                    )}
                  </Box>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 2,
                      p: 2,
                      bgcolor: '#f8f9fa',
                      borderRadius: 2
                    }}>
                      <BusinessIcon sx={{ mr: 2, color: '#667eea', fontSize: 28 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
                        Entreprise
                      </Typography>
                    </Box>
                    {editing ? (
                      <FormControl fullWidth>
                        <Select
                          value={etude.company}
                          onChange={async (e) => {
                            if (e.target.value === '__new__') {
                              setNewCompanyDialogOpen(true);
                            } else {
                              // Récupérer l'ID de l'entreprise sélectionnée
                              try {
                                const companiesRef = collection(db, 'companies');
                                const companyQuery = query(companiesRef, where('name', '==', e.target.value));
                                const companySnapshot = await getDocs(companyQuery);
                                
                                if (!companySnapshot.empty) {
                                  const companyDoc = companySnapshot.docs[0];
                                  setEtude({ 
                                    ...etude, 
                                    company: e.target.value,
                                    companyId: companyDoc.id 
                                  });
                                } else {
                                  setEtude({ ...etude, company: e.target.value });
                                }
                              } catch (error) {
                                console.warn('Erreur lors de la récupération de l\'ID de l\'entreprise:', error);
                                setEtude({ ...etude, company: e.target.value });
                              }
                            }
                          }}
                          displayEmpty
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                              '&:hover': {
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: '#667eea'
                                }
                              },
                              '&.Mui-focused': {
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: '#667eea'
                                }
                              }
                            }
                          }}
                        >
                          <MenuItem value="" disabled>
                            Sélectionner une entreprise
                          </MenuItem>
                          {availableCompanies.map((company) => (
                            <MenuItem key={company} value={company}>
                              {company}
                            </MenuItem>
                          ))}
                          <MenuItem value="__new__" sx={{ 
                            borderTop: '1px solid #e5e5e7',
                            color: '#667eea',
                            fontWeight: 500
                          }}>
                            + Ajouter une nouvelle entreprise
                          </MenuItem>
                        </Select>
                      </FormControl>
                    ) : (
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          fontWeight: 500, 
                          color: '#1d1d1f', 
                          pl: 2,
                          cursor: 'pointer',
                          '&:hover': { textDecoration: 'underline' }
                        }}
                        onClick={() => {
                          if (etude.companyId) {
                            navigate(`/app/entreprises/${etude.companyId}`);
                          } else {
                            // Fallback vers la recherche par nom si pas d'ID
                            navigate(`/app/entreprises?search=${encodeURIComponent(etude.company)}`);
                          }
                        }}
                      >
                        {etude.company}
                      </Typography>
                    )}
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 2,
                      p: 2,
                      bgcolor: '#f8f9fa',
                      borderRadius: 2
                    }}>
                      <LocationIcon sx={{ mr: 2, color: '#667eea', fontSize: 28 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
                        Localisation
                      </Typography>
                    </Box>
                    {editing ? (
                      <TextField
                        fullWidth
                        value={etude.location || ''}
                        onChange={(e) => setEtude({ ...etude, location: e.target.value })}
                        variant="outlined"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            '&:hover': {
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#667eea'
                              }
                            },
                            '&.Mui-focused': {
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#667eea'
                              }
                            }
                          }
                        }}
                      />
                    ) : (
                      <Typography variant="body1" sx={{ fontWeight: 500, color: '#1d1d1f', pl: 2 }}>
                        {etude.location || 'Non définie'}
                      </Typography>
                    )}
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 2,
                      p: 2,
                      bgcolor: '#f8f9fa',
                      borderRadius: 2
                    }}>
                      <CalendarIcon sx={{ mr: 2, color: '#667eea', fontSize: 28 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
                        Date de début
                      </Typography>
                    </Box>
                    {editing ? (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                          fullWidth
                          type="date"
                          value={etude.startDate || ''}
                          onChange={(e) => setEtude({ ...etude, startDate: e.target.value })}
                          variant="outlined"
                          InputLabelProps={{ shrink: true }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                              '&:hover': {
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: '#667eea'
                                }
                              },
                              '&.Mui-focused': {
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: '#667eea'
                                }
                              }
                            }
                          }}
                        />
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => setEtude({ ...etude, startDate: null })}
                          sx={{
                            minWidth: 'auto',
                            px: 2,
                            borderColor: '#d2d2d7',
                            color: '#86868b',
                            '&:hover': {
                              borderColor: '#86868b',
                              bgcolor: 'rgba(134, 134, 139, 0.04)'
                            }
                          }}
                        >
                          Effacer
                        </Button>
                      </Box>
                    ) : (
                      <Typography variant="body1" sx={{ fontWeight: 500, color: '#1d1d1f', pl: 2 }}>
                        {formatDate(etude.startDate)}
                      </Typography>
                    )}
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 2,
                      p: 2,
                      bgcolor: '#f8f9fa',
                      borderRadius: 2
                    }}>
                      <CalendarIcon sx={{ mr: 2, color: '#667eea', fontSize: 28 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
                        Date de fin
                      </Typography>
                    </Box>
                    {editing ? (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                          fullWidth
                          type="date"
                          value={etude.endDate || ''}
                          onChange={(e) => setEtude({ ...etude, endDate: e.target.value })}
                          variant="outlined"
                          InputLabelProps={{ shrink: true }}
                          inputProps={{
                            min: etude.startDate || undefined
                          }}
                          error={etude.endDate && etude.startDate && etude.endDate < etude.startDate}
                          helperText={etude.endDate && etude.startDate && etude.endDate < etude.startDate ? 
                            'La date de fin ne peut pas être antérieure à la date de début' : ''}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                              '&:hover': {
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: etude.endDate && etude.startDate && etude.endDate < etude.startDate ? '#ff4757' : '#667eea'
                                }
                              },
                              '&.Mui-focused': {
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: etude.endDate && etude.startDate && etude.endDate < etude.startDate ? '#ff4757' : '#667eea'
                                }
                              },
                              '&.Mui-error': {
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: '#ff4757'
                                }
                              }
                            }
                          }}
                        />
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => setEtude({ ...etude, endDate: null })}
                          sx={{
                            minWidth: 'auto',
                            px: 2,
                            borderColor: '#d2d2d7',
                            color: '#86868b',
                            '&:hover': {
                              borderColor: '#86868b',
                              bgcolor: 'rgba(134, 134, 139, 0.04)'
                            }
                          }}
                        >
                          Effacer
                        </Button>
                      </Box>
                    ) : (
                      <Typography variant="body1" sx={{ fontWeight: 500, color: '#1d1d1f', pl: 2 }}>
                        {formatDate(etude.endDate)}
                      </Typography>
                    )}
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 2,
                      p: 2,
                      bgcolor: '#f8f9fa',
                      borderRadius: 2
                    }}>
                      <AssignmentIcon sx={{ mr: 2, color: '#667eea', fontSize: 28 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
                        Type de mission
                      </Typography>
                    </Box>
                    {editing ? (
                      <FormControl fullWidth>
                        <Select
                          value={etude.missionTypeId || ''}
                          onChange={(e) => {
                            if (e.target.value === '__new__') {
                              setMissionTypeDialogOpen(true);
                            } else {
                              const selectedType = availableMissionTypes.find(type => type.id === e.target.value);
                              setEtude({ 
                                ...etude, 
                                missionTypeId: e.target.value,
                                missionTypeName: selectedType?.title || ''
                              });
                            }
                          }}
                          displayEmpty
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                              '&:hover': {
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: '#667eea'
                                }
                              },
                              '&.Mui-focused': {
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: '#667eea'
                                }
                              }
                            }
                          }}
                        >
                          <MenuItem value="" disabled>
                            Sélectionner un type de mission
                          </MenuItem>
                          {availableMissionTypes.map((type) => (
                            <MenuItem key={type.id} value={type.id}>
                              {type.title}
                            </MenuItem>
                          ))}
                          <MenuItem value="__new__" sx={{ 
                            borderTop: '1px solid #e5e5e7',
                            color: '#667eea',
                            fontWeight: 500
                          }}>
                            + Ajouter un nouveau type de mission
                          </MenuItem>
                        </Select>
                      </FormControl>
                    ) : (
                      <Typography variant="body1" sx={{ fontWeight: 500, color: '#1d1d1f', pl: 2 }}>
                        {etude.missionTypeName || 'Non défini'}
                      </Typography>
                    )}
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      mb: 2,
                      p: 2,
                      bgcolor: '#f8f9fa',
                      borderRadius: 2
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <WorkHistoryIcon sx={{ mr: 2, color: '#667eea', fontSize: 28 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
                          Nombre de JEH / Heures
                        </Typography>
                      </Box>
                      {editing && (
                        <IconButton
                          onClick={(event) => setPricingMenuAnchor(event.currentTarget)}
                          sx={{
                            color: '#86868b',
                            p: 0,
                            '&:hover': {
                              bgcolor: 'rgba(134, 134, 139, 0.1)'
                            }
                          }}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      )}
                    </Box>
                    {editing ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {pricingType === 'jeh' ? (
                          <>
                            <TextField
                              type="number"
                              label="JEH"
                              value={etude.jeh || ''}
                              onChange={(e) => handleJehChange(Number(e.target.value))}
                              variant="outlined"
                              sx={{
                                flex: 1,
                                '& .MuiOutlinedInput-root': {
                                  borderRadius: 2,
                                  '&:hover': {
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      borderColor: '#667eea'
                                    }
                                  },
                                  '&.Mui-focused': {
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      borderColor: '#667eea'
                                    }
                                  }
                                }
                              }}
                            />
                            <IconButton
                              onClick={() => setJehLinked(!jehLinked)}
                              sx={{
                                color: jehLinked ? '#667eea' : '#86868b',
                                '&:hover': {
                                  bgcolor: jehLinked ? 'rgba(102, 126, 234, 0.1)' : 'rgba(134, 134, 139, 0.1)'
                                }
                              }}
                            >
                              {jehLinked ? '🔗' : '🔓'}
                            </IconButton>
                            <TextField
                              type="number"
                              label="Heures"
                              value={etude.hours || ''}
                              onChange={(e) => handleHoursChange(Number(e.target.value))}
                              variant="outlined"
                              sx={{
                                flex: 1,
                                '& .MuiOutlinedInput-root': {
                                  borderRadius: 2,
                                  '&:hover': {
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      borderColor: '#667eea'
                                    }
                                  },
                                  '&.Mui-focused': {
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      borderColor: '#667eea'
                                    }
                                  }
                                }
                              }}
                            />
                          </>
                        ) : (
                          <TextField
                            type="number"
                            label="Nombre d'heures"
                            value={etude.hours || ''}
                            onChange={(e) => setEtude({ ...etude, hours: Number(e.target.value) })}
                            variant="outlined"
                            fullWidth
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                '&:hover': {
                                  '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#667eea'
                                  }
                                },
                                '&.Mui-focused': {
                                  '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#667eea'
                                  }
                                }
                              }
                            }}
                          />
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body1" sx={{ fontWeight: 500, color: '#1d1d1f', pl: 2 }}>
                        {pricingType === 'jeh' 
                          ? `${etude.jeh || 0} JEH (${etude.hours || 0} heures)`
                          : `${etude.hours || 0} heures`
                        }
                      </Typography>
                    )}
                  </Grid>

                  <Grid item xs={12}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 2,
                      p: 2,
                      bgcolor: '#f8f9fa',
                      borderRadius: 2
                    }}>
                      <DescriptionIcon sx={{ mr: 2, color: '#667eea', fontSize: 28 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
                        Description
                      </Typography>
                    </Box>
                    {editing ? (
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        value={etude.description || ''}
                        onChange={(e) => setEtude({ ...etude, description: e.target.value })}
                        variant="outlined"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            '&:hover': {
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#667eea'
                              }
                            },
                            '&.Mui-focused': {
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#667eea'
                              }
                            }
                          }
                        }}
                      />
                    ) : (
                      <Typography variant="body1" sx={{ color: '#1d1d1f', pl: 2, lineHeight: 1.6 }}>
                        {etude.description || 'Aucune description'}
                      </Typography>
                    )}
                  </Grid>

                  <Grid item xs={12}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 2,
                      p: 2,
                      bgcolor: '#f8f9fa',
                      borderRadius: 2
                    }}>
                      <PersonIcon sx={{ mr: 2, color: '#667eea', fontSize: 28 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
                        Chargés d'étude
                      </Typography>
                    </Box>
                    {editing ? (
                      <Box sx={{ pl: 2 }}>
                        <FormControl fullWidth sx={{ mb: 2 }}>
                          <Select
                            multiple
                            value={etude.chargeIds || [etude.chargeId]}
                            onChange={(e) => {
                              const selectedIds = e.target.value as string[];
                              const selectedCharges = availableCharges.filter(charge => selectedIds.includes(charge.id));
                              setEtude({
                                ...etude,
                                chargeIds: selectedIds,
                                chargeId: selectedIds[0] || '',
                                chargeName: selectedCharges.map(c => c.displayName).join(', '),
                                chargePhotoURL: selectedCharges[0]?.photoURL || null
                              });
                            }}
                            renderValue={(selected) => (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {(selected as string[]).map((value) => {
                                  const charge = availableCharges.find(c => c.id === value);
                                  return (
                                    <Chip 
                                      key={value} 
                                      label={charge?.displayName || value}
                                      size="small"
                                      sx={{ 
                                        bgcolor: '#667eea',
                                        color: 'white',
                                        '& .MuiChip-deleteIcon': {
                                          color: 'white'
                                        }
                                      }}
                                    />
                                  );
                                })}
                              </Box>
                            )}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                '&:hover': {
                                  '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#667eea'
                                  }
                                },
                                '&.Mui-focused': {
                                  '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#667eea'
                                  }
                                }
                              }
                            }}
                          >
                            {availableCharges.map((charge) => (
                              <MenuItem key={charge.id} value={charge.id}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <Avatar
                                    src={charge.photoURL}
                                    sx={{ 
                                      width: 24, 
                                      height: 24,
                                      fontSize: '0.75rem'
                                    }}
                                  >
                                    {charge.displayName?.charAt(0)}
                                  </Avatar>
                                  {charge.displayName}
                                </Box>
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Box>
                    ) : (
                      <Box sx={{ pl: 2 }}>
                        {etude.chargeIds && etude.chargeIds.length > 1 ? (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {etude.chargeIds.map((chargeId) => {
                              const charge = availableCharges.find(c => c.id === chargeId);
                              return (
                                <Box key={chargeId} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Avatar
                                    src={charge?.photoURL}
                                    sx={{ 
                                      width: 32, 
                                      height: 32,
                                      border: '2px solid white',
                                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                      fontSize: '0.875rem'
                                    }}
                                  >
                                    {charge?.displayName?.charAt(0)}
                                  </Avatar>
                                  <Typography variant="body1" sx={{ fontWeight: 500, color: '#1d1d1f' }}>
                                    {charge?.displayName}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Box>
                        ) : (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar
                              src={etude.chargePhotoURL}
                              sx={{ 
                                width: 40, 
                                height: 40,
                                border: '2px solid white',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                              }}
                            >
                              {etude.chargeName?.charAt(0)}
                            </Avatar>
                            <Typography variant="body1" sx={{ fontWeight: 500, color: '#1d1d1f' }}>
                              {etude.chargeName}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}
                  </Grid>
                </Grid>
              </Paper>

              {/* Menu pour le type de tarification */}
              <Menu
                anchorEl={pricingMenuAnchor}
                open={Boolean(pricingMenuAnchor)}
                onClose={() => setPricingMenuAnchor(null)}
                PaperProps={{
                  sx: {
                    borderRadius: 2,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    border: '1px solid #e5e5e7'
                  }
                }}
              >
                <MenuItem
                  onClick={() => {
                    setPricingType('jeh');
                    setEtude(prev => prev ? { ...prev, pricingType: 'jeh' } : null);
                    setPricingMenuAnchor(null);
                  }}
                  sx={{
                    color: pricingType === 'jeh' ? '#667eea' : '#1d1d1f',
                    fontWeight: pricingType === 'jeh' ? 600 : 400,
                    '&:hover': {
                      bgcolor: 'rgba(102, 126, 234, 0.08)'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">JEH (Journée d'Étude Homme)</Typography>
                    {pricingType === 'jeh' && (
                      <Box sx={{ 
                        width: 6, 
                        height: 6, 
                        borderRadius: '50%', 
                        bgcolor: '#667eea' 
                      }} />
                    )}
                  </Box>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setPricingType('hourly');
                    setEtude(prev => prev ? { ...prev, pricingType: 'hourly' } : null);
                    setPricingMenuAnchor(null);
                  }}
                  sx={{
                    color: pricingType === 'hourly' ? '#667eea' : '#1d1d1f',
                    fontWeight: pricingType === 'hourly' ? 600 : 400,
                    '&:hover': {
                      bgcolor: 'rgba(102, 126, 234, 0.08)'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">Tarification horaire</Typography>
                    {pricingType === 'hourly' && (
                      <Box sx={{ 
                        width: 6, 
                        height: 6, 
                        borderRadius: '50%', 
                        bgcolor: '#667eea' 
                      }} />
                    )}
                  </Box>
                </MenuItem>
              </Menu>


            </Grid>

            {/* Historique */}
            <Grid item xs={12} md={4}>
              <Card sx={{ 
                mb: 3, 
                borderRadius: 3,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                animation: `${fadeInUp} 0.6s ease-out 0.2s both`
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: '#1d1d1f' }}>
                    Historique
                  </Typography>
                  
                  <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    {historyEntries.map((entry, index) => (
                      <Box 
                        key={entry.id} 
                        sx={{ 
                          mb: 2, 
                          p: 2, 
                          bgcolor: '#f8f9fa', 
                          borderRadius: 2,
                          animation: `${fadeInUp} 0.6s ease-out ${index * 0.1}s both`
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1d1d1f', mb: 0.5 }}>
                          {entry.action}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#86868b', mb: 1 }}>
                          {entry.details}
                        </Typography>
                        
                        {/* Affichage des modifications détaillées */}
                        {entry.modifications && entry.modifications.length > 0 && (
                          <Box sx={{ mb: 1, pl: 1, borderLeft: '3px solid #667eea' }}>
                            {entry.modifications.map((modification, modIndex) => (
                              <Typography 
                                key={modIndex} 
                                variant="body2" 
                                sx={{ 
                                  color: '#1d1d1f', 
                                  fontSize: '0.875rem',
                                  mb: 0.5,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5
                                }}
                              >
                                <Box 
                                  component="span" 
                                  sx={{ 
                                    width: 6, 
                                    height: 6, 
                                    borderRadius: '50%', 
                                    bgcolor: '#667eea',
                                    flexShrink: 0
                                  }} 
                                />
                                {modification}
                              </Typography>
                            ))}
                          </Box>
                        )}
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: '#86868b' }}>
                            {new Date(entry.date).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#667eea', fontWeight: 500 }}>
                            {entry.userName}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                    {historyEntries.length === 0 && (
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="body2" sx={{ color: '#86868b' }}>
                          Aucun historique disponible
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>

              {/* Notes */}
              <Card sx={{ 
                borderRadius: 3,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                animation: `${fadeInUp} 0.6s ease-out 0.3s both`
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#1d1d1f' }}>
                      Notes
                    </Typography>
                    <Button
                      startIcon={<AddIcon />}
                      onClick={() => setNoteDialogOpen(true)}
                      variant="outlined"
                      size="small"
                      sx={{ 
                        borderColor: '#667eea',
                        color: '#667eea',
                        '&:hover': { 
                          borderColor: '#5a6fd8',
                          bgcolor: 'rgba(102, 126, 234, 0.04)'
                        }
                      }}
                    >
                      Ajouter
                    </Button>
                  </Box>
                  
                  <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {notes.map((note, index) => (
                      <Box 
                        key={note.id} 
                        sx={{ 
                          mb: 2, 
                          p: 2, 
                          bgcolor: '#f8f9fa', 
                          borderRadius: 2,
                          animation: `${fadeInUp} 0.6s ease-out ${index * 0.1}s both`
                        }}
                      >
                        <Typography variant="body2" sx={{ color: '#1d1d1f', mb: 1, lineHeight: 1.5 }}>
                          {note.content}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: '#86868b' }}>
                            {new Date(note.createdAt).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteNote(note.id)}
                            sx={{ 
                              color: '#86868b',
                              '&:hover': {
                                color: '#ff4757',
                                bgcolor: 'rgba(255, 71, 87, 0.1)'
                              }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    ))}
                    {notes.length === 0 && (
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="body2" sx={{ color: '#86868b' }}>
                          Aucune note
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Planning & Budget Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1d1d1f' }}>
              Planning & Budget
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<DescriptionIcon />}
              onClick={handleCreateQuoteFromEtude}
              sx={{
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: '500'
              }}
            >
              Créer une proposition commerciale
            </Button>
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ 
                p: 3, 
                borderRadius: 3,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                animation: `${fadeInUp} 0.6s ease-out`
              }}>
                {/* Header du planning */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#1d1d1f' }}>
                    Planning visuel
                </Typography>

                </Box>

                {/* Onglets de vue et contrôles de zoom */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      size="small"
                        sx={{ 
                        bgcolor: '#667eea',
                        color: 'white',
                        borderRadius: 2,
                        px: 2,
                        py: 0.5,
                        fontSize: '0.875rem',
                        textTransform: 'none',
                        '&:hover': { bgcolor: '#5a6fd8' }
                      }}
                    >
                      Vision planning
                    </Button>
                  </Box>

                  {/* Contrôles de zoom et extension des semaines */}
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {/* Contrôles pour étendre/réduire les semaines */}
                    <Tooltip title="Gérer le nombre de semaines">
                      <Box sx={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        bgcolor: 'white',
                        borderRadius: 2,
                        border: '1px solid #e5e5e7',
                        px: 1,
                        py: 0.5
                      }}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            const minRequiredWeeks = Math.max(4, getMinRequiredWeeks());
                            setMaxWeeks(prev => Math.max(minRequiredWeeks, prev - 1));
                          }}
                          disabled={maxWeeks <= Math.max(4, getMinRequiredWeeks())}
                          sx={{ 
                            color: maxWeeks <= Math.max(4, getMinRequiredWeeks()) ? '#d2d2d7' : '#667eea',
                            p: 0.5,
                            '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.1)' }
                          }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>-</Typography>
                        </IconButton>
                        <TextField
                          size="small"
                          value={maxWeeks}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            if (!isNaN(value) && value >= Math.max(4, getMinRequiredWeeks())) {
                              setMaxWeeks(value);
                            }
                          }}
                          onBlur={(e) => {
                            const value = parseInt(e.target.value);
                            if (isNaN(value) || value < Math.max(4, getMinRequiredWeeks())) {
                              setMaxWeeks(Math.max(4, getMinRequiredWeeks()));
                            }
                          }}
                          inputProps={{
                            style: {
                              fontSize: '0.7rem',
                              fontWeight: 500,
                              textAlign: 'center',
                              padding: '2px 4px',
                              minWidth: '30px',
                              maxWidth: '50px'
                            }
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              border: 'none',
                              '& fieldset': { border: 'none' },
                              '&:hover fieldset': { border: 'none' },
                              '&.Mui-focused fieldset': { border: 'none' }
                            },
                            minWidth: '40px',
                            maxWidth: '60px'
                          }}
                        />
                        <Typography variant="caption" sx={{ 
                          color: '#86868b', 
                          fontSize: '0.7rem',
                          fontWeight: 500
                        }}>
                          semaines
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => setMaxWeeks(prev => prev + 1)}
                          sx={{ 
                            color: '#667eea',
                            p: 0.5,
                            '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.1)' }
                          }}
                        >
                          <AddIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    </Tooltip>

                    {/* Contrôles de zoom */}
                    <Tooltip title="Zoom: +/- ou clic sur les boutons">
                      <Box sx={{ 
                        display: 'flex',
                        gap: 0.5,
                        bgcolor: 'white',
                        borderRadius: 2,
                        border: '1px solid #e5e5e7',
                        p: 0.5
                      }}>
                        <IconButton
                          size="small"
                          onClick={() => setTimelineZoom(prev => {
                            const current = Math.round(prev * 100);
                            if (current <= 25) return 0.25;
                            if (current <= 50) return 0.25;
                            if (current <= 75) return 0.5;
                            if (current <= 100) return 0.75;
                            if (current <= 150) return 1;
                            if (current <= 200) return 1.5;
                            if (current <= 250) return 2;
                            return 2.5;
                          })}
                          disabled={timelineZoom <= 0.25}
                          sx={{ 
                            color: timelineZoom <= 0.25 ? '#d2d2d7' : '#667eea',
                            '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.1)' }
                          }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>-</Typography>
                        </IconButton>
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          px: 1,
                          minWidth: 40,
                          justifyContent: 'center'
                        }}>
                          <Typography variant="caption" sx={{ 
                            color: '#86868b', 
                            fontWeight: 600,
                            fontSize: '0.75rem'
                          }}>
                            {Math.round(timelineZoom * 100)}%
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => setTimelineZoom(prev => {
                            const current = Math.round(prev * 100);
                            if (current < 25) return 0.25;
                            if (current < 50) return 0.5;
                            if (current < 75) return 0.75;
                            if (current < 100) return 1;
                            if (current < 150) return 1.5;
                            if (current < 200) return 2;
                            if (current < 250) return 2.5;
                            return 3;
                          })}
                          disabled={timelineZoom >= 3}
                          sx={{ 
                            color: timelineZoom >= 3 ? '#d2d2d7' : '#667eea',
                            '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.1)' }
                          }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>+</Typography>
                        </IconButton>
                      </Box>
                    </Tooltip>
                  </Box>
                </Box>

                                {/* Timeline visuel */}
                <Box 
                  data-timeline
                  sx={{ 
                    bgcolor: 'white', 
                    borderRadius: 3, 
                    p: 3, 
                    border: '1px solid #e5e5e7',
                    position: 'relative',
                    minHeight: 300
                  }}
                >

                  {/* Timeline header */}
                  <Box sx={{ 
                    display: 'flex', 
                    mb: 2, 
                    borderBottom: '2px solid #f1f2f6',
                    pb: 1
                  }}>
                    <Box sx={{ width: 120, flexShrink: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
                        Postes de budget
                          </Typography>
                    </Box>
                    <Box sx={{ flex: 1, display: 'flex' }}>
                      {generateTimelineWeeks().map((week, index) => (
                        <Box 
                          key={index}
                          sx={{ 
                            flex: 1, 
                            textAlign: 'center',
                            borderRight: index < generateTimelineWeeks().length - 1 ? '1px solid #e5e5e7' : 'none'
                          }}
                        >
                          <Typography variant="caption" sx={{ 
                            fontWeight: 600, 
                            color: '#86868b',
                            fontSize: '0.75rem'
                          }}>
                            {week}
                            </Typography>
                        </Box>
                      ))}
                    </Box>
                    <Box sx={{ width: 40, flexShrink: 0 }} />
                  </Box>

                  {/* Lignes de postes de budget */}
                  <Box sx={{ position: 'relative' }}>
                      {budgetItems.map((item, index) => (
                        <Box 
                          key={item.id}
                          sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            mb: 2,
                            animation: `${fadeInUp} 0.6s ease-out ${index * 0.1}s both`
                          }}
                        >
                          {/* Nom du poste */}
                          <Box sx={{ width: 120, flexShrink: 0 }}>
                            <Typography variant="body2" sx={{ 
                              fontWeight: 500, 
                              color: '#1d1d1f',
                              fontSize: '0.875rem'
                            }}>
                              {item.title}
                              </Typography>
                          </Box>

                          {/* Barre de budget */}
                          <Box sx={{ 
                            flex: 1, 
                            position: 'relative',
                            height: 40,
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            <Box 
                              onClick={(e) => handleBudgetItemClick(item, e)}
                              sx={{ 
                                position: 'absolute',
                                left: `${Math.max(0, Math.min(100 - calculateTaskWidth(item.startDate, item.endDate), calculateTaskPosition(item.startDate)))}%`,
                                width: `${calculateTaskWidth(item.startDate, item.endDate)}%`,
                                height: 32,
                                bgcolor: getBudgetItemColor(item.color),
                                borderRadius: 3,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease-in-out',
                                zIndex: 10,
                                padding: '4px 8px',
                                minWidth: '80px',
                                maxWidth: '100%',
                                overflow: 'hidden',
                                '&:hover': {
                                  transform: 'translateY(-1px)',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                }
                              }}
                            >
                              {/* Poignée de redimensionnement gauche */}
                              <Box
                                onMouseDown={(e) => handleBudgetItemResizeStart(item, e, 'start')}
                                sx={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 0,
                                  width: 8,
                                  height: '100%',
                                  cursor: 'ew-resize',
                                  zIndex: 11,
                                  '&:hover': {
                                    bgcolor: 'rgba(255,255,255,0.3)'
                                  }
                                }}
                              />
                              
                              {/* Zone de déplacement (centre) */}
                              <Box
                                onMouseDown={(e) => handleBudgetItemMoveStart(item, e)}
                                sx={{
                                  position: 'absolute',
                                  left: 8,
                                  right: 8,
                                  top: 0,
                                  height: '100%',
                                  cursor: 'grab',
                                  zIndex: 10,
                                  '&:hover': {
                                    bgcolor: 'rgba(255,255,255,0.1)'
                                  },
                                  '&:active': {
                                    cursor: 'grabbing'
                                  }
                                }}
                              />
                              
                              {/* Poignée de redimensionnement droite */}
                              <Box
                                onMouseDown={(e) => handleBudgetItemResizeStart(item, e, 'end')}
                                sx={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 0,
                                  width: 8,
                                  height: '100%',
                                  cursor: 'ew-resize',
                                  zIndex: 11,
                                  '&:hover': {
                                    bgcolor: 'rgba(255,255,255,0.3)'
                                  }
                                }}
                              />
                              <Typography variant="caption" sx={{ 
                                color: 'white', 
                                fontWeight: 600,
                                fontSize: '0.7rem',
                                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                lineHeight: 1.2,
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '100%',
                                px: 0.5,
                                py: 0.25
                              }}>
                                {item.title} - {item.budget}€ HT
                              </Typography>
                              <Typography variant="caption" sx={{ 
                                color: 'white', 
                                fontWeight: 400,
                                fontSize: '0.6rem',
                                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                opacity: 0.9,
                                lineHeight: 1.1,
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '100%',
                                px: 0.5,
                                py: 0.25
                              }}>
                                {formatBudgetItemDate(item.startDate)} - {formatBudgetItemDate(item.endDate)}
                              </Typography>
                              

                            </Box>
                          </Box>

                          {/* Actions */}
                          <Box sx={{ 
                            width: 40, 
                            flexShrink: 0,
                            display: 'flex',
                            justifyContent: 'center'
                          }}>
                            {/* Espace réservé pour actions futures */}
                          </Box>
                        </Box>
                      ))}
                      
                                              {/* Ligne pour créer un nouveau poste */}
                        <Box 
                          sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            mb: 2,
                            height: 40,
                            borderTop: budgetItems.length > 0 ? '1px solid #e5e5e7' : 'none',
                            pt: budgetItems.length > 0 ? 2 : 0
                          }}
                        >
                        {/* Espace pour le nom */}
                        <Box sx={{ width: 120, flexShrink: 0 }}>
                          <Typography variant="body2" sx={{ 
                            fontWeight: 500, 
                            color: '#86868b',
                            fontSize: '0.875rem',
                            fontStyle: 'italic'
                          }}>
                            Nouveau poste
                      </Typography>
                        </Box>

                        {/* Zone de sélection interactive */}
                        <Box 
                          sx={{ 
                            flex: 1, 
                            position: 'relative',
                            height: 40,
                            display: 'flex',
                            alignItems: 'center',
                            cursor: isSelectingRange ? 'crosshair' : 'pointer',
                            userSelect: 'none'
                          }}
                          onMouseDown={handleTimelineMouseDown}
                          onMouseMove={handleTimelineMouseMove}
                          onMouseUp={handleTimelineMouseUp}
                          onMouseLeave={() => setIsSelectingRange(false)}
                        >
                          {/* Indication visuelle de la zone de sélection */}
                          <Box sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            border: '2px dashed #e5e5e7',
                            borderRadius: 2,
                            bgcolor: 'rgba(102, 126, 234, 0.02)',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              borderColor: '#667eea',
                              bgcolor: 'rgba(102, 126, 234, 0.05)'
                            }
                          }} />
                          
                          {/* Indication de sélection en cours */}
                          {isSelectingRange && (
                            <Box sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              bgcolor: 'rgba(102, 126, 234, 0.1)',
                              zIndex: 5,
                              pointerEvents: 'none'
                            }}>
                              <Box sx={{
                                position: 'absolute',
                                top: 0,
                                left: `${Math.min(selectionStart, selectionEnd)}%`,
                                width: `${Math.abs(selectionEnd - selectionStart)}%`,
                                height: '100%',
                                bgcolor: 'rgba(102, 126, 234, 0.3)',
                                border: '2px solid #667eea',
                                borderRadius: 1
                              }} />
                            </Box>
                          )}
                          
                          {/* Texte d'aide */}
                          {!isSelectingRange && (
                            <Box sx={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              color: '#86868b',
                              fontSize: '0.75rem',
                              pointerEvents: 'none',
                              textAlign: 'center'
                            }}>
                              Glissez pour créer un nouveau poste
                            </Box>
                          )}
                        </Box>

                        {/* Actions */}
                        <Box sx={{ 
                          width: 40, 
                          flexShrink: 0,
                          display: 'flex',
                          justifyContent: 'center'
                        }}>
                          {/* Espace réservé pour actions futures */}
                        </Box>
                      </Box>
                    </Box>

                    {budgetItems.length === 0 && (
                        <Box sx={{ 
                          textAlign: 'center', 
                          py: 8,
                          color: '#86868b'
                        }}>
                          <CalendarMonthIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                          <Typography variant="h6" sx={{ mb: 1, fontWeight: 500 }}>
                            Aucun poste de budget
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 2 }}>
                            Commencez par ajouter votre premier poste de budget
                          </Typography>
                          <Typography variant="caption" sx={{ 
                            color: '#667eea',
                            fontStyle: 'italic',
                            display: 'block'
                          }}>
                            💡 Glissez-déposez sur la timeline pour créer un poste de budget
                            {!etude?.startDate || !etude?.endDate ? ' (utilise les semaines S1, S2, etc.)' : ''}
                      </Typography>
                    </Box>
                  )}


                  </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ 
                borderRadius: 3,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                animation: `${fadeInUp} 0.6s ease-out 0.2s both`
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: '#1d1d1f' }}>
                    Montant total
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 800, color: '#667eea', mb: 2 }}>
                    {calculateTotalBudget().toFixed(2)} € HT
                  </Typography>
                  
                  {/* Barre de progression marge vs rémunération */}
                  <Box sx={{ mt: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="caption" sx={{ color: '#667eea', fontWeight: 600 }}>
                        Marge: {calculateMargin().toFixed(2)}€
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#86868b', fontWeight: 500 }}>
                        Rémunération: {calculateTotalRemunerationCost().toFixed(2)}€ ({calculateRemunerationPercentage().toFixed(1)}%)
                      </Typography>
                    </Box>
                    
                    <Box sx={{ 
                      width: '100%', 
                      height: 8, 
                      bgcolor: '#f0f0f0', 
                      borderRadius: 4,
                      overflow: 'hidden',
                      position: 'relative'
                    }}>
                      <Box sx={{ 
                        width: `${100 - calculateRemunerationPercentage()}%`,
                        height: '100%',
                        bgcolor: '#667eea',
                        borderRadius: 4,
                        transition: 'width 0.3s ease-in-out'
                      }} />
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                      <Typography variant="caption" sx={{ color: '#667eea', fontWeight: 600 }}>
                        Marge {(100 - calculateRemunerationPercentage()).toFixed(1)}%
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#86868b', fontWeight: 600 }}>
                        Coût {calculateRemunerationPercentage().toFixed(1)}%
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Recrutement Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1d1d1f' }}>
              Recrutement
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setRecruitmentDialogOpen(true);
                setLinkedRecruitmentMode(false);
                setSelectedBudgetItems([]);
                setRecruitmentStudentsCount(1);
                setNewRecruitmentTask({});
              }}
              sx={{
                bgcolor: '#667eea',
                '&:hover': { bgcolor: '#5a6fd8' },
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600
              }}
            >
              Créer une tâche de recrutement
            </Button>
          </Box>

          <Grid container spacing={3}>
            {/* Tâches de recrutement */}
            <Grid item xs={12} md={9}>
              <Paper sx={{ 
                p: 3, 
                borderRadius: 3,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                animation: `${fadeInUp} 0.6s ease-out 0.2s both`
              }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: '#1d1d1f' }}>
                  Tâches de recrutement
                </Typography>
                {/* Postes de budget intégrés */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: '#1d1d1f' }}>
                    Postes de budget
                  </Typography>
                  {budgetItems.length > 0 ? (
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                            <TableCell sx={{ fontWeight: 600 }}>Poste</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Montant HT</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                              {etude?.pricingType === 'jeh' ? 'JEH' : 'Heures'}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                              {etude?.pricingType === 'jeh' ? 'Taux JEH' : 'Taux horaire'}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Période</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Recrutement</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Statut</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {budgetItems.map((item, index) => (
                            <TableRow 
                              key={item.id}
                              onClick={() => {
                                setEditingBudgetItem(item);
                                // Initialiser newBudgetItem avec les données du poste à éditer
                                setNewBudgetItem({
                                  title: item.title,
                                  description: item.description,
                                  budget: item.budget,
                                  color: item.color,
                                  startDate: item.startDate,
                                  endDate: item.endDate,
                                  jehCount: item.jehCount,
                                  jehRate: item.jehRate,
                                  hoursCount: item.hoursCount,
                                  hourlyRate: item.hourlyRate
                                });
                                setQuickBudgetDialogOpen(true);
                              }}
                              sx={{ 
                                animation: `${fadeInUp} 0.6s ease-out ${index * 0.1}s both`,
                                '&:hover': {
                                  bgcolor: '#f8f9fa',
                                  cursor: 'pointer'
                                }
                              }}
                            >
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Box
                                    sx={{
                                      width: 12,
                                      height: 12,
                                      borderRadius: '50%',
                                      bgcolor: item.color
                                    }}
                                  />
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {item.title}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#2ed573' }}>
                                  {item.budget.toFixed(2)} €
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {etude?.pricingType === 'jeh' 
                                    ? `${item.jehCount || 0} JEH`
                                    : `${item.hoursCount || 0}h`
                                  }
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="text.secondary">
                                  {etude?.pricingType === 'jeh' 
                                    ? `${item.jehRate || 0} €/JEH`
                                    : `${item.hourlyRate || 0} €/h`
                                  }
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="text.secondary">
                                  {(!etude?.startDate || !etude?.endDate)
                                    ? `${formatBudgetItemDate(item.startDate)} - ${formatBudgetItemDate(item.endDate)}`
                                    : `${formatDate(item.startDate)} - ${formatDate(item.endDate)}`}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                {typeof item.studentsToRecruit === 'number' ? (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography 
                                      variant="body2" 
                                      sx={{ 
                                        fontWeight: 600, 
                                        color: '#667eea',
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                        '&:hover': {
                                          color: '#5a6fd8'
                                        }
                                      }}
                                      onClick={async () => {
                                        console.log('🖱️ Clic sur étudiants recrutés pour le poste de budget:', item.id);
                                        // Récupérer les étudiants recrutés pour ce poste de budget
                                        const recruitedStudents: RecruitmentApplication[] = [];
                                        
                                        // Trouver les tâches liées à ce poste de budget
                                        const linkedTasks = recruitmentTasks.filter(task => 
                                          task.budgetItemIds && task.budgetItemIds.includes(item.id)
                                        );
                                        
                                        console.log('🔗 Tâches liées au poste:', linkedTasks.map(t => t.title));
                                        
                                        for (const task of linkedTasks) {
                                          let taskStudents = recruitedStudentsByTask[task.id];
                                          if (!taskStudents) {
                                            // Charger les données si elles ne sont pas disponibles
                                            taskStudents = await getRecruitedStudentsForTask(task.id);
                                            setRecruitedStudentsByTask(prev => ({
                                              ...prev,
                                              [task.id]: taskStudents
                                            }));
                                          }
                                          recruitedStudents.push(...taskStudents);
                                        }
                                        
                                        console.log('📊 Étudiants recrutés pour le poste:', recruitedStudents.length);
                                        
                                        if (recruitedStudents.length > 0) {
                                          handleOpenRecruitedStudents(recruitedStudents, `Étudiants recrutés - ${item.title}`);
                                        } else {
                                          console.log('❌ Aucun étudiant recruté pour ce poste de budget');
                                        }
                                      }}
                                    >
                                      {(item.recruitedStudents ?? 0)}/{item.studentsToRecruit} étudiants
                                    </Typography>
                                    {item.linkedBudgetItems && item.linkedBudgetItems.length > 0 && (
                                      <Chip 
                                        label={`Lié à ${item.linkedBudgetItems.length} poste(s)`}
                                        size="small"
                                        sx={{ 
                                          bgcolor: '#667eea',
                                          color: 'white',
                                          fontSize: '0.7rem'
                                        }}
                                      />
                                    )}
                                  </Box>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    Non défini
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                {item.recruitmentStatus ? (
                                  <Chip 
                                    label={item.recruitmentStatus}
                                    size="small"
                                    color={
                                      item.recruitmentStatus === 'Terminé' ? 'success' :
                                      item.recruitmentStatus === 'En cours' ? 'warning' : 'default'
                                    }
                                    sx={{ fontSize: '0.7rem' }}
                                  />
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    -
                                  </Typography>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <TimelineIcon sx={{ fontSize: 48, color: '#d2d2d7', mb: 1 }} />
                      <Typography variant="body2" sx={{ color: '#86868b' }}>
                        Aucun poste de budget
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Divider sx={{ my: 2 }} />
                <List>
                  {recruitmentTasks.map((task, index) => (
                    <ListItem 
                      key={task.id} 
                      divider
                      onClick={() => {
                        setEditingRecruitmentTask(task);
                        setEditRecruitmentDialogOpen(true);
                      }}
                      sx={{ 
                        animation: `${fadeInUp} 0.6s ease-out ${index * 0.1}s both`,
                        '&:hover': {
                          bgcolor: '#f8f9fa',
                          borderRadius: 2,
                          cursor: 'pointer'
                        }
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ 
                          bgcolor: '#667eea',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                        }}>
                          <PeopleIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
                              {task.title}
                            </Typography>
                            {task.isPublished && (
                              <Chip 
                                label="Publié" 
                                size="small"
                                sx={{ 
                                  bgcolor: '#2ed573',
                                  color: 'white',
                                  fontSize: '0.7rem',
                                  height: 20
                                }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box component="div">
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {task.description}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                              <Typography variant="caption" color="text.secondary">
                                {task.remuneration}€ HT
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {task.duration}h
                              </Typography>
                              {task.location && (
                                <Typography variant="caption" color="text.secondary">
                                  📍 {task.location}
                                </Typography>
                              )}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {applicationsCounts[task.id] || 0} candidatures
                                </Typography>
                                {pendingApplicationsCounts[task.id] > 0 && (
                                  <Chip
                                    label={`${pendingApplicationsCounts[task.id]} à traiter`}
                                    size="small"
                                    sx={{
                                      bgcolor: '#ffa502',
                                      color: 'white',
                                      fontSize: '0.6rem',
                                      height: 16,
                                      fontWeight: 600
                                    }}
                                  />
                                )}
                              </Box>
                              {task.linkedRecruitment && task.budgetItemIds && task.budgetItemIds.length > 0 && (
                                <Chip 
                                  label={`Lié à ${task.budgetItemIds.length} poste(s) de budget`}
                                  size="small"
                                  sx={{ 
                                    bgcolor: '#667eea',
                                    color: 'white',
                                    fontSize: '0.7rem'
                                  }}
                                />
                              )}
                              {task.studentsToRecruit && (
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    color: '#667eea', 
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    '&:hover': {
                                      color: '#5a6fd8'
                                    }
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    console.log('🖱️ Clic sur étudiants recrutés pour la tâche:', task.id);
                                    console.log('📊 Données disponibles:', recruitedStudentsByTask[task.id]);
                                    console.log('📊 Nombre d\'étudiants recrutés:', recruitedStudentsByTask[task.id]?.length || 0);
                                    
                                    // Charger les données si elles ne sont pas disponibles
                                    if (!recruitedStudentsByTask[task.id]) {
                                      console.log('🔄 Chargement des données pour la tâche:', task.id);
                                      getRecruitedStudentsForTask(task.id).then(students => {
                                        console.log('✅ Étudiants chargés:', students);
                                        if (students.length > 0) {
                                          setRecruitedStudentsByTask(prev => ({
                                            ...prev,
                                            [task.id]: students
                                          }));
                                          handleOpenRecruitedStudents(students, `Étudiants recrutés - ${task.title}`);
                                        } else {
                                          console.log('❌ Aucun étudiant recruté trouvé');
                                        }
                                      });
                                    } else if (recruitedStudentsByTask[task.id].length > 0) {
                                      handleOpenRecruitedStudents(recruitedStudentsByTask[task.id], `Étudiants recrutés - ${task.title}`);
                                    } else {
                                      console.log('❌ Aucun étudiant recruté pour cette tâche');
                                    }
                                  }}
                                >
                                  {task.recruitedStudents || 0}/{task.studentsToRecruit} étudiants recrutés
                                </Typography>
                              )}
                            </Box>
                            

                          </Box>
                        }
                      />
                      

                      <ListItemSecondaryAction>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip 
                            label={task.status} 
                            size="small"
                            sx={{ 
                              fontWeight: 600,
                              bgcolor: task.status === 'Fermé' ? '#ff4757' : task.status === 'En cours' ? '#ffa502' : '#2ed573',
                              color: 'white'
                            }}
                          />
                          <Button
                            size="small"
                            variant={task.isPublished ? "outlined" : "contained"}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePublishRecruitmentTask(task.id);
                            }}
                            sx={{
                              minWidth: 'auto',
                              px: 2,
                              py: 0.5,
                              fontSize: '0.75rem',
                              textTransform: 'none',
                              bgcolor: task.isPublished ? 'transparent' : '#667eea',
                              color: task.isPublished ? '#667eea' : 'white',
                              borderColor: task.isPublished ? '#667eea' : 'transparent',
                              '&:hover': {
                                bgcolor: task.isPublished ? 'rgba(102, 126, 234, 0.04)' : '#5a6fd8',
                                borderColor: task.isPublished ? '#5a6fd8' : 'transparent'
                              }
                            }}
                          >
                            {task.isPublished ? 'Dépublier' : 'Publier'}
                          </Button>
                          <Badge
                            badgeContent={pendingApplicationsCounts[task.id] || 0}
                            color="warning"
                            sx={{
                              '& .MuiBadge-badge': {
                                fontSize: '0.6rem',
                                minWidth: 16,
                                height: 16
                              }
                            }}
                          >
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenApplications(task);
                              }}
                              sx={{
                                color: '#667eea',
                                '&:hover': {
                                  bgcolor: 'rgba(102, 126, 234, 0.04)'
                                }
                              }}
                            >
                              <PeopleIcon fontSize="small" />
                            </IconButton>
                          </Badge>
                          <Tooltip title="Ajouter des étudiants manuellement">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAddStudentDialog(task);
                              }}
                              sx={{
                                color: '#2ed573',
                                '&:hover': {
                                  bgcolor: 'rgba(46, 213, 115, 0.04)'
                                }
                              }}
                            >
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {/* Suppression déplacée dans le dialogue d'édition */}
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>

            {/* Résumé financier */}
            <Grid item xs={12} md={3}>
              <Card sx={{ 
                borderRadius: 3,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                animation: `${fadeInUp} 0.6s ease-out 0.2s both`
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: '#1d1d1f' }}>
                    Rémunération totale
                  </Typography>
                  <Typography 
                    variant={calculateTotalHourlyRemuneration() >= 100000 ? "h4" : "h3"} 
                    sx={{ fontWeight: 800, color: '#2ed573', mb: 2 }}
                  >
                    {calculateTotalHourlyRemuneration().toFixed(2)} €
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    {recruitmentTasks.length} tâches de recrutement
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Documents Tab */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1d1d1f' }}>
              Documents
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {selectedDocuments.length > 0 && (
                <>
                  <Button
                    startIcon={<DeleteIcon />}
                    onClick={handleDeleteSelectedDocuments}
                    variant="outlined"
                    color="error"
                    sx={{ 
                      borderColor: '#f44336',
                      color: '#f44336',
                      '&:hover': { 
                        borderColor: '#d32f2f',
                        bgcolor: 'rgba(244, 67, 54, 0.04)'
                      }
                    }}
                  >
                    Supprimer ({selectedDocuments.length})
                  </Button>
                  <Button
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadSelectedDocuments}
                    variant="outlined"
                    sx={{ 
                      borderColor: '#4caf50',
                      color: '#4caf50',
                      '&:hover': { 
                        borderColor: '#388e3c',
                        bgcolor: 'rgba(76, 175, 80, 0.04)'
                      }
                    }}
                  >
                    Télécharger ({selectedDocuments.length})
                  </Button>
                </>
              )}
              <Button
                startIcon={<PowerSettingsNewIcon />}
                onClick={() => setPowerpointDialogOpen(true)}
                variant="outlined"
                sx={{ 
                  borderColor: '#667eea',
                  color: '#667eea',
                  '&:hover': { 
                    borderColor: '#5a6fd8',
                    bgcolor: 'rgba(102, 126, 234, 0.04)'
                  }
                }}
              >
                Générer PowerPoint
              </Button>
              <Button
                startIcon={<UploadIcon />}
                onClick={() => setDocumentDialogOpen(true)}
                variant="contained"
                sx={{ 
                  bgcolor: '#667eea',
                  '&:hover': { bgcolor: '#5a6fd8' }
                }}
              >
                Upload Document
              </Button>
            </Box>
          </Box>

          <Paper sx={{ 
            p: 3, 
            borderRadius: 3,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            animation: `${fadeInUp} 0.6s ease-out`
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#1d1d1f' }}>
                Documents de l'étude
              </Typography>
              {selectedDocuments.length > 0 && (
                <Typography variant="body2" sx={{ color: '#667eea', fontWeight: 500 }}>
                  {selectedDocuments.length} document(s) sélectionné(s)
                </Typography>
              )}
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                    <TableCell sx={{ fontWeight: 600, width: '50px' }}>
                      <Checkbox
                        checked={selectAllDocuments}
                        indeterminate={selectedDocuments.length > 0 && selectedDocuments.length < documents.length}
                        onChange={(e) => handleSelectAllDocuments(e.target.checked)}
                        sx={{ 
                          color: '#667eea',
                          '&.Mui-checked': { color: '#667eea' }
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Nom</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Statut</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Date d'upload</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {documents.map((doc, index) => (
                    <TableRow 
                      key={doc.id}
                      sx={{ 
                        animation: `${fadeInUp} 0.6s ease-out ${index * 0.1}s both`,
                        '&:hover': { bgcolor: '#f8f9fa' },
                        // Différencier visuellement les brouillons
                        bgcolor: doc.isDraft ? 'rgba(255, 193, 7, 0.05)' : 'transparent'
                      }}
                    >
                      <TableCell sx={{ width: '50px' }}>
                        <Checkbox
                          checked={selectedDocuments.includes(doc.id)}
                          onChange={(e) => handleDocumentSelectionChange(doc.id, e.target.checked)}
                          sx={{ 
                            color: '#667eea',
                            '&.Mui-checked': { color: '#667eea' }
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {doc.name}
                          {doc.isDraft && (
                            <Chip 
                              label="Brouillon" 
                              size="small" 
                              sx={{ 
                                bgcolor: '#FFC107', 
                                color: '#000',
                                fontSize: '0.7rem',
                                height: '20px'
                              }} 
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Chip 
                            label={doc.isDraft ? 'Brouillon' : 'Final'} 
                            size="small"
                            sx={{ 
                              fontWeight: 600,
                              bgcolor: doc.isDraft ? '#FFC107' : '#4CAF50',
                              color: doc.isDraft ? '#000' : 'white',
                              fontSize: '0.7rem',
                              maxWidth: '80px',
                              '& .MuiChip-label': {
                                fontSize: '0.65rem',
                                px: 1
                              }
                            }}
                          />
                          {doc.uploadedBy && (
                            <Typography variant="caption" sx={{ color: '#8E8E93', fontSize: '0.7rem' }}>
                              Par: {doc.uploadedBy}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {doc.uploadedAt && typeof doc.uploadedAt === 'object' && doc.uploadedAt.toDate ? 
                          formatDate(doc.uploadedAt.toDate().toISOString()) :
                          doc.uploadedAt && typeof doc.uploadedAt === 'string' ? 
                            formatDate(doc.uploadedAt) :
                            'Date invalide'
                        }
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {!doc.isDraft && (
                            <Tooltip title="Aperçu">
                              <IconButton 
                                size="small" 
                                sx={{ color: '#667eea' }}
                                onClick={() => handleDocumentPreview(doc)}
                              >
                                <VisibilityIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          {doc.isDraft && doc.quoteData && (
                            <Tooltip title="Reprendre l'édition">
                              <IconButton 
                                size="small" 
                                sx={{ color: '#34D399' }}
                                onClick={() => handleResumeEditing(doc)}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          {!doc.isDraft && (
                            <Tooltip title="Télécharger">
                              <IconButton 
                                size="small" 
                                sx={{ color: '#2ed573' }}
                                onClick={() => handleDocumentDownload(doc)}
                              >
                                <DownloadIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Supprimer">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => handleDocumentDelete(doc.id)}
                              disabled={deletingDocument === doc.id}
                            >
                              {deletingDocument === doc.id ? (
                                <CircularProgress size={16} />
                              ) : (
                                <DeleteIcon />
                              )}
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {documents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4 }}>
                        <FolderIcon sx={{ fontSize: 64, color: '#d2d2d7', mb: 2 }} />
                        <Typography variant="h6" sx={{ color: '#86868b', mb: 1 }}>
                          Aucun document disponible
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#86868b' }}>
                          Commencez par créer une proposition commerciale ou uploader un document
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </TabPanel>

        {/* Dialogs */}
        
        {/* Planning Task Dialog */}
        <Dialog 
          open={planningDialogOpen} 
          onClose={() => setPlanningDialogOpen(false)} 
          maxWidth="md" 
          fullWidth
          PaperProps={{
            sx: { borderRadius: 3 }
          }}
        >
          <DialogTitle sx={{ fontWeight: 700, color: '#1d1d1f' }}>
            Ajouter une tâche de planning
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#1d1d1f' }}>
                    Informations de la tâche
                  </Typography>
                  <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="Titre de la tâche"
                  value={newTask.title || ''}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Description"
                  value={newTask.description || ''}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
                    <TextField
                      fullWidth
                      type="number"
                      label="Budget (€ HT)"
                      value={newTask.budget || ''}
                      onChange={(e) => setNewTask({ ...newTask, budget: Number(e.target.value) })}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">€ HT</InputAdornment>,
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2
                        }
                      }}
                    />
                    <FormControl fullWidth>
                      <InputLabel>Priorité</InputLabel>
                      <Select
                        value={newTask.priority || 'Moyenne'}
                        label="Priorité"
                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                        sx={{
                          borderRadius: 2
                        }}
                      >
                        <MenuItem value="Basse">Basse</MenuItem>
                        <MenuItem value="Moyenne">Moyenne</MenuItem>
                        <MenuItem value="Haute">Haute</MenuItem>
                      </Select>
                    </FormControl>
                  </Stack>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#1d1d1f' }}>
                    Dates et priorité
                  </Typography>
                  
                  <Stack spacing={2}>
                <TextField
                  fullWidth
                  type="date"
                  label="Date de début"
                  InputLabelProps={{ shrink: true }}
                  value={newTask.startDate || ''}
                  onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
                <TextField
                  fullWidth
                  type="date"
                  label="Date de fin"
                  InputLabelProps={{ shrink: true }}
                  value={newTask.endDate || ''}
                  onChange={(e) => setNewTask({ ...newTask, endDate: e.target.value })}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
                  </Stack>
                </Box>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button 
              onClick={() => setPlanningDialogOpen(false)}
              sx={{ color: '#86868b' }}
            >
              Annuler
            </Button>
            <Button 
              onClick={handleAddPlanningTask} 
              variant="contained"
              sx={{ 
                bgcolor: '#667eea',
                '&:hover': { bgcolor: '#5a6fd8' }
              }}
            >
              Ajouter
            </Button>
          </DialogActions>
        </Dialog>

        {/* Budget Item Dialog (Style Mac) */}
        <Dialog 
          open={budgetItemDialogOpen} 
          onClose={() => setBudgetItemDialogOpen(false)} 
          maxWidth="xs" 
          fullWidth
          PaperProps={{
            sx: { 
              borderRadius: 3,
              position: 'relative',
              overflow: 'visible'
            }
          }}
        >
          <DialogTitle sx={{ 
            fontWeight: 700, 
            color: '#1d1d1f',
            pb: 1
          }}>
            Nouveau poste de budget
          </DialogTitle>
          <DialogContent sx={{ pt: 0 }}>
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="Nom du poste"
                value={newBudgetItem.title || ''}
                onChange={(e) => setNewBudgetItem({ ...newBudgetItem, title: e.target.value })}
                autoFocus
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2
                  }
                }}
              />
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Description (optionnel)"
                value={newBudgetItem.description || ''}
                onChange={(e) => setNewBudgetItem({ ...newBudgetItem, description: e.target.value })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2
                  }
                }}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Budget (€ HT)"
                  value={newBudgetItem.budget || ''}
                  onChange={(e) => setNewBudgetItem({ ...newBudgetItem, budget: Number(e.target.value) })}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">€ HT</InputAdornment>,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
                <Box>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: '#1d1d1f' }}>
                    Couleur
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {availableColors.map((color) => (
                      <Box
                        key={color}
                        onClick={() => setNewBudgetItem({ ...newBudgetItem, color })}
                    sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          bgcolor: color,
                          cursor: 'pointer',
                          border: newBudgetItem.color === color ? '3px solid #1d1d1f' : '2px solid #e5e5e7',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            transform: 'scale(1.1)',
                            borderColor: '#1d1d1f'
                          }
                        }}
                      />
                    ))}
                  </Box>
                  {getUsedColors().length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="caption" sx={{ color: '#86868b', display: 'block', mb: 1 }}>
                        Couleurs utilisées
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {getUsedColors().map((color) => (
                          <Box
                            key={color}
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              bgcolor: color,
                              border: '1px solid #e5e5e7'
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
              <Box sx={{ 
                p: 2, 
                bgcolor: '#f8f9fa', 
                borderRadius: 2,
                border: '1px solid #e5e5e7'
              }}>
                <Typography variant="caption" sx={{ color: '#86868b', display: 'block', mb: 1 }}>
                  Période sélectionnée
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500, color: '#1d1d1f' }}>
                  {formatDate(newBudgetItem.startDate)} - {formatDate(newBudgetItem.endDate)}
                </Typography>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0 }}>
            <Button 
              onClick={() => setBudgetItemDialogOpen(false)}
              sx={{ color: '#86868b' }}
            >
              Annuler
            </Button>
          </DialogActions>
        </Dialog>

        {/* Quick Budget Item Dialog - Popup style */}
        {quickBudgetDialogOpen && (
          <Box
            data-popup="budget-item"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={handlePopupMouseDown}
            sx={{
              position: 'fixed',
              left: quickBudgetPosition.x,
              top: quickBudgetPosition.y,
              zIndex: 1000,
              bgcolor: 'white',
              borderRadius: 2,
              boxShadow: isDraggingPopup 
                ? '0 12px 40px rgba(0,0,0,0.2)' 
                : '0 8px 32px rgba(0,0,0,0.12)',
              border: isDraggingPopup 
                ? '2px solid #667eea' 
                : '1px solid #e5e5e7',
              p: 2,
              minWidth: 280,
              maxWidth: 320,
              animation: isDraggingPopup ? 'none' : 'slideInUp 0.2s ease-out',
              cursor: isDraggingPopup ? 'grabbing' : 'default',
              transform: isDraggingPopup ? 'scale(1.02)' : 'scale(1)',
              transition: isDraggingPopup ? 'none' : 'all 0.2s ease-in-out'
            }}
          >
            <Box 
              data-popup-header
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                mb: 2,
                cursor: 'grab',
                userSelect: 'none',
                p: 0.5,
                borderRadius: 1,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  bgcolor: 'rgba(102, 126, 234, 0.05)',
                  cursor: 'grab'
                },
                '&:active': {
                  cursor: 'grabbing',
                  bgcolor: 'rgba(102, 126, 234, 0.1)'
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    bgcolor: newBudgetItem.color || '#667eea',
                    mr: 1
                  }}
                />
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
                  {editingBudgetItem ? editingBudgetItem.title : 'Nouveau poste de budget'}
                </Typography>
                <DragIndicatorIcon 
                  sx={{ 
                    fontSize: 16, 
                    color: '#86868b', 
                    ml: 1,
                    opacity: 0.6,
                    '&:hover': {
                      opacity: 1
                    }
                  }} 
                />
              </Box>
              
              {/* Icône de suppression pour les postes existants */}
              {editingBudgetItem && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteBudgetItem(editingBudgetItem.id);
                    setQuickBudgetDialogOpen(false);
                    setEditingBudgetItem(null);
                    setNewBudgetItem({});
                  }}
                  sx={{
                    color: '#ff4757',
                    '&:hover': {
                      bgcolor: 'rgba(255, 71, 87, 0.1)'
                    }
                  }}
                >
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              )}
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ color: '#86868b', display: 'block', mb: 0.5 }}>
                Nom du poste
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e5e7', borderRadius: 1 }}>
                <TextField
                  size="small"
                  placeholder="Nom du poste"
                  value={newBudgetItem.title || ''}
                  onChange={async (e) => {
                    const newTitle = e.target.value;
                    setNewBudgetItem({ ...newBudgetItem, title: newTitle });
                    
                    // Sauvegarder automatiquement
                    if (creatingBudgetItem) {
                      await updateBudgetItemAutomatically(creatingBudgetItem.id, { title: newTitle });
                    } else if (editingBudgetItem) {
                      await updateBudgetItemAutomatically(editingBudgetItem.id, { title: newTitle });
                    }
                  }}
                  inputProps={{
                    style: { 
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      padding: '8px 12px',
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
                      userSelect: 'none'
                    }
                  }}
                  sx={{
                    flex: 1,
                    '& .MuiOutlinedInput-root': {
                      border: 'none',
                      '& fieldset': { border: 'none' },
                      '&:hover fieldset': { border: 'none' },
                      '&.Mui-focused fieldset': { border: 'none' }
                    }
                  }}
                />
              </Box>
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ color: '#86868b', display: 'block', mb: 0.5 }}>
                Budget (€ HT)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e5e7', borderRadius: 1 }}>
                <IconButton
                  size="small"
                  onClick={async () => {
                    const currentBudget = newBudgetItem.budget || 0;
                    const newBudget = Math.max(0, currentBudget - 100);
                    setNewBudgetItem({ ...newBudgetItem, budget: newBudget });
                    
                    // Sauvegarder automatiquement
                    if (creatingBudgetItem) {
                      await updateBudgetItemAutomatically(creatingBudgetItem.id, { budget: newBudget });
                    } else if (editingBudgetItem) {
                      await updateBudgetItemAutomatically(editingBudgetItem.id, { budget: newBudget });
                    }
                    setTempBudgetInput(''); // Vider l'input temporaire
                  }}
                  sx={{ 
                    color: '#86868b',
                    p: 0.5,
                    '&:hover': { bgcolor: 'rgba(134, 134, 139, 0.1)' }
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>-</Typography>
                </IconButton>
                <TextField
                  size="small"
                  type="text"
                  placeholder="0"
                  value={tempBudgetInput || (newBudgetItem.budget !== undefined && newBudgetItem.budget !== null ? newBudgetItem.budget.toString() : '')}
                  onChange={async (e) => {
                    const value = e.target.value;
                    console.log('🔢 Budget input value:', value);
                    
                    // Permettre les chiffres, virgules et points (max 2 décimales)
                    if (value === '' || /^[\d.,]*$/.test(value)) {
                      // Vérifier qu'il n'y a qu'un seul séparateur décimal
                      const decimalSeparators = (value.match(/[.,]/g) || []).length;
                      if (decimalSeparators <= 1) {
                        // Vérifier qu'il n'y a pas plus de 2 chiffres après le séparateur
                        const parts = value.split(/[.,]/);
                        if (parts.length === 1 || (parts.length === 2 && parts[1].length <= 2)) {
                                              console.log('✅ Budget validation passed for:', value);
                        
                        // Toujours mettre à jour la valeur temporaire
                        setTempBudgetInput(value);
                        
                        if (value === '') {
                          setNewBudgetItem({ ...newBudgetItem, budget: 0 });
                          // Sauvegarder automatiquement
                          if (creatingBudgetItem) {
                            await updateBudgetItemAutomatically(creatingBudgetItem.id, { budget: 0 });
                          } else if (editingBudgetItem) {
                            await updateBudgetItemAutomatically(editingBudgetItem.id, { budget: 0 });
                          }
                        } else if (value === ',' || value === '.') {
                          // Permettre la saisie temporaire
                          console.log('🔢 Budget decimal separator, keeping temp input');
                        } else {
                          // Vérifier si la valeur se termine par . ou ,
                          const endsWithDecimal = value.endsWith('.') || value.endsWith(',');
                          
                          if (endsWithDecimal) {
                            // Pour les valeurs qui se terminent par . ou , on garde la saisie
                            console.log('🔢 Budget decimal input, keeping temp input');
                          } else {
                            // Valeur complète, convertir normalement
                            const newBudget = parseFloat(value.replace(',', '.'));
                            if (!isNaN(newBudget)) {
                              console.log('🔢 Complete budget value:', newBudget);
                              setNewBudgetItem({ ...newBudgetItem, budget: newBudget });
                              // Sauvegarder automatiquement
                              if (creatingBudgetItem) {
                                await updateBudgetItemAutomatically(creatingBudgetItem.id, { budget: newBudget });
                              } else if (editingBudgetItem) {
                                await updateBudgetItemAutomatically(editingBudgetItem.id, { budget: newBudget });
                              }
                              setTempBudgetInput(''); // Vider l'input temporaire
                            }
                          }
                        }
                      } else {
                        console.log('❌ Too many decimal places for budget:', value);
                      }
                    } else {
                      console.log('❌ Too many decimal separators for budget:', value);
                    }
                  } else {
                    console.log('❌ Budget validation failed for:', value);
                  }
                  }}
                  inputProps={{
                    style: { 
                      textAlign: 'center',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      padding: '4px 8px',
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
                      userSelect: 'none'
                    }
                  }}
                  sx={{
                    flex: 1,
                    '& .MuiOutlinedInput-root': {
                      border: 'none',
                      '& fieldset': { border: 'none' },
                      '&:hover fieldset': { border: 'none' },
                      '&.Mui-focused fieldset': { border: 'none' }
                    }
                  }}
                />
                <IconButton
                  size="small"
                  onClick={async () => {
                    const currentBudget = newBudgetItem.budget || 0;
                    const newBudget = currentBudget + 100;
                    setNewBudgetItem({ ...newBudgetItem, budget: newBudget });
                    
                    // Sauvegarder automatiquement
                    if (creatingBudgetItem) {
                      await updateBudgetItemAutomatically(creatingBudgetItem.id, { budget: newBudget });
                    } else if (editingBudgetItem) {
                      await updateBudgetItemAutomatically(editingBudgetItem.id, { budget: newBudget });
                    }
                    setTempBudgetInput(''); // Vider l'input temporaire
                  }}
                  sx={{ 
                    color: '#86868b',
                    p: 0.5,
                    '&:hover': { bgcolor: 'rgba(134, 134, 139, 0.1)' }
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>+</Typography>
                </IconButton>
              </Box>
            </Box>
            
            {/* Champs spécifiques selon le type de tarification */}
            {pricingType === 'jeh' ? (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: '#86868b', display: 'block', mb: 0.5 }}>
                      Nombre de JEH assignées
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e5e7', borderRadius: 1 }}>
                      <IconButton
                        size="small"
                        onClick={async () => {
                          const currentJeh = newBudgetItem.jehCount || 0;
                          const newJeh = Math.max(0, currentJeh - 0.5);
                          const jehValue = parseFloat(newJeh.toFixed(1));
                          setNewBudgetItem({ ...newBudgetItem, jehCount: jehValue });
                          
                          // Sauvegarder automatiquement
                          if (creatingBudgetItem) {
                            await updateBudgetItemAutomatically(creatingBudgetItem.id, { jehCount: jehValue });
                          } else if (editingBudgetItem) {
                            await updateBudgetItemAutomatically(editingBudgetItem.id, { jehCount: jehValue });
                          }
                        }}
                        sx={{ 
                          color: '#86868b',
                          p: 0.5,
                          '&:hover': { bgcolor: 'rgba(134, 134, 139, 0.1)' }
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>-</Typography>
                      </IconButton>
                      <TextField
                        size="small"
                        type="text"
                        value={tempJehInput || (newBudgetItem.jehCount !== undefined && newBudgetItem.jehCount !== null ? newBudgetItem.jehCount.toString() : '')}
                        onChange={async (e) => {
                          const value = e.target.value;
                          console.log('🔢 Input value:', value);
                          
                          // Validation pour permettre jusqu'à 2 chiffres après le point
                          if (value === '' || /^[\d.,]*$/.test(value)) {
                            // Vérifier qu'il n'y a qu'un seul séparateur décimal
                            const decimalSeparators = (value.match(/[.,]/g) || []).length;
                            if (decimalSeparators <= 1) {
                              // Vérifier qu'il n'y a pas plus de 2 chiffres après le séparateur
                              const parts = value.split(/[.,]/);
                              if (parts.length === 1 || (parts.length === 2 && parts[1].length <= 2)) {
                                console.log('✅ Validation passed for:', value);
                                
                                // Toujours mettre à jour la valeur temporaire
                                setTempJehInput(value);
                                
                                if (value === '') {
                                  setNewBudgetItem({ ...newBudgetItem, jehCount: 0 });
                                  // Sauvegarder automatiquement
                                  if (creatingBudgetItem) {
                                    await updateBudgetItemAutomatically(creatingBudgetItem.id, { jehCount: 0 });
                                  } else if (editingBudgetItem) {
                                    await updateBudgetItemAutomatically(editingBudgetItem.id, { jehCount: 0 });
                                  }
                                } else if (value === ',' || value === '.') {
                                  // Permettre la saisie temporaire
                                  console.log('🔢 Decimal separator, keeping temp input');
                                } else {
                                  // Vérifier si la valeur se termine par . ou ,
                                  const endsWithDecimal = value.endsWith('.') || value.endsWith(',');
                                  
                                  if (endsWithDecimal) {
                                    // Pour les valeurs qui se terminent par . ou , on garde la saisie
                                    console.log('🔢 Decimal input, keeping temp input');
                                  } else {
                                    // Valeur complète, convertir normalement
                                    const jehCount = parseFloat(value.replace(',', '.'));
                                    if (!isNaN(jehCount)) {
                                      console.log('🔢 Complete value:', jehCount);
                                      setNewBudgetItem({ ...newBudgetItem, jehCount });
                                      // Sauvegarder automatiquement
                                      if (creatingBudgetItem) {
                                        await updateBudgetItemAutomatically(creatingBudgetItem.id, { jehCount });
                                      } else if (editingBudgetItem) {
                                        await updateBudgetItemAutomatically(editingBudgetItem.id, { jehCount });
                                      }
                                      setTempJehInput(''); // Vider l'input temporaire
                                    }
                                  }
                                }
                              } else {
                                console.log('❌ Too many decimal places for:', value);
                              }
                            } else {
                              console.log('❌ Too many decimal separators for:', value);
                            }
                          } else {
                            console.log('❌ Validation failed for:', value);
                          }
                        }}
                        inputProps={{
                          style: { 
                            textAlign: 'center',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            padding: '4px 8px',
                            WebkitUserSelect: 'none',
                            MozUserSelect: 'none',
                            msUserSelect: 'none',
                            userSelect: 'none'
                          }
                        }}
                        sx={{
                          flex: 1,
                          '& .MuiOutlinedInput-root': {
                            border: 'none',
                            '& fieldset': { border: 'none' },
                            '&:hover fieldset': { border: 'none' },
                            '&.Mui-focused fieldset': { border: 'none' }
                          }
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={async () => {
                          const currentJeh = newBudgetItem.jehCount || 0;
                          const newJeh = currentJeh + 0.5;
                          const jehValue = parseFloat(newJeh.toFixed(1));
                          setNewBudgetItem({ ...newBudgetItem, jehCount: jehValue });
                          
                          // Sauvegarder automatiquement
                          if (creatingBudgetItem) {
                            await updateBudgetItemAutomatically(creatingBudgetItem.id, { jehCount: jehValue });
                          } else if (editingBudgetItem) {
                            await updateBudgetItemAutomatically(editingBudgetItem.id, { jehCount: jehValue });
                          }
                        }}
                        sx={{ 
                          color: '#86868b',
                          p: 0.5,
                          '&:hover': { bgcolor: 'rgba(134, 134, 139, 0.1)' }
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>+</Typography>
                      </IconButton>
                    </Box>
                  </Box>
                  
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: '#86868b', display: 'block', mb: 0.5 }}>
                      Rémunération brute / JEH (€)
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e5e7', borderRadius: 1 }}>
                      <IconButton
                        size="small"
                        onClick={async () => {
                          const currentRate = newBudgetItem.jehRate || 0;
                          const newRate = Math.max(0, currentRate - 10);
                          const rateValue = parseFloat(newRate.toFixed(2));
                          setNewBudgetItem({ ...newBudgetItem, jehRate: rateValue });
                          
                          // Sauvegarder automatiquement
                          if (creatingBudgetItem) {
                            await updateBudgetItemAutomatically(creatingBudgetItem.id, { jehRate: rateValue });
                          } else if (editingBudgetItem) {
                            await updateBudgetItemAutomatically(editingBudgetItem.id, { jehRate: rateValue });
                          }
                        }}
                        sx={{ 
                          color: '#86868b',
                          p: 0.5,
                          '&:hover': { bgcolor: 'rgba(134, 134, 139, 0.1)' }
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>-</Typography>
                      </IconButton>
                      <TextField
                        size="small"
                        type="text"
                        value={tempJehRateInput || (newBudgetItem.jehRate !== undefined && newBudgetItem.jehRate !== null ? newBudgetItem.jehRate.toString() : '')}
                        onChange={async (e) => {
                          const value = e.target.value;
                          console.log('🔢 Input jeh rate value:', value);
                          
                          // Validation pour permettre jusqu'à 2 chiffres après le point
                          if (value === '' || /^[\d.,]*$/.test(value)) {
                            // Vérifier qu'il n'y a qu'un seul séparateur décimal
                            const decimalSeparators = (value.match(/[.,]/g) || []).length;
                            if (decimalSeparators <= 1) {
                              // Vérifier qu'il n'y a pas plus de 2 chiffres après le séparateur
                              const parts = value.split(/[.,]/);
                              if (parts.length === 1 || (parts.length === 2 && parts[1].length <= 2)) {
                                console.log('✅ Jeh rate validation passed for:', value);
                                
                                // Toujours mettre à jour la valeur temporaire
                                setTempJehRateInput(value);
                                
                                if (value === '') {
                                  setNewBudgetItem({ ...newBudgetItem, jehRate: 0 });
                                  // Sauvegarder automatiquement
                                  if (creatingBudgetItem) {
                                    await updateBudgetItemAutomatically(creatingBudgetItem.id, { jehRate: 0 });
                                  } else if (editingBudgetItem) {
                                    await updateBudgetItemAutomatically(editingBudgetItem.id, { jehRate: 0 });
                                  }
                                } else if (value === ',' || value === '.') {
                                  // Permettre la saisie temporaire
                                  console.log('🔢 Decimal separator, keeping temp input');
                                } else {
                                  // Vérifier si la valeur se termine par . ou ,
                                  const endsWithDecimal = value.endsWith('.') || value.endsWith(',');
                                  
                                  if (endsWithDecimal) {
                                    // Pour les valeurs qui se terminent par . ou , on garde la saisie
                                    console.log('🔢 Decimal input, keeping temp input');
                                  } else {
                                    // Valeur complète, convertir normalement
                                    const jehRate = parseFloat(value.replace(',', '.'));
                                    if (!isNaN(jehRate)) {
                                      console.log('🔢 Complete jeh rate value:', jehRate);
                                      setNewBudgetItem({ ...newBudgetItem, jehRate });
                                      // Sauvegarder automatiquement
                                      if (creatingBudgetItem) {
                                        await updateBudgetItemAutomatically(creatingBudgetItem.id, { jehRate });
                                      } else if (editingBudgetItem) {
                                        await updateBudgetItemAutomatically(editingBudgetItem.id, { jehRate });
                                      }
                                      setTempJehRateInput(''); // Vider l'input temporaire
                                    }
                                  }
                                }
                              } else {
                                console.log('❌ Too many decimal places for jeh rate:', value);
                              }
                            } else {
                              console.log('❌ Too many decimal separators for jeh rate:', value);
                            }
                          } else {
                            console.log('❌ Jeh rate validation failed for:', value);
                          }
                        }}
                        inputProps={{
                          style: { 
                            textAlign: 'center',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            padding: '4px 8px',
                            WebkitUserSelect: 'none',
                            MozUserSelect: 'none',
                            msUserSelect: 'none',
                            userSelect: 'none'
                          }
                        }}
                        sx={{
                          flex: 1,
                          '& .MuiOutlinedInput-root': {
                            border: 'none',
                            '& fieldset': { border: 'none' },
                            '&:hover fieldset': { border: 'none' },
                            '&.Mui-focused fieldset': { border: 'none' }
                          }
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={async () => {
                          const currentRate = newBudgetItem.jehRate || 0;
                          const newRate = currentRate + 10;
                          const rateValue = parseFloat(newRate.toFixed(2));
                          setNewBudgetItem({ ...newBudgetItem, jehRate: rateValue });
                          
                          // Sauvegarder automatiquement
                          if (creatingBudgetItem) {
                            await updateBudgetItemAutomatically(creatingBudgetItem.id, { jehRate: rateValue });
                          } else if (editingBudgetItem) {
                            await updateBudgetItemAutomatically(editingBudgetItem.id, { jehRate: rateValue });
                          }
                        }}
                        sx={{ 
                          color: '#86868b',
                          p: 0.5,
                          '&:hover': { bgcolor: 'rgba(134, 134, 139, 0.1)' }
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>+</Typography>
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              </Box>
            ) : (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: '#86868b', display: 'block', mb: 0.5 }}>
                      Nombre d'heures assignées
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e5e7', borderRadius: 1 }}>
                      <IconButton
                        size="small"
                        onClick={async () => {
                          const currentHours = newBudgetItem.hoursCount || 0;
                          const newHours = Math.max(0, currentHours - 0.5);
                          const hoursValue = parseFloat(newHours.toFixed(1));
                          setNewBudgetItem({ ...newBudgetItem, hoursCount: hoursValue });
                          
                          // Sauvegarder automatiquement
                          if (creatingBudgetItem) {
                            await updateBudgetItemAutomatically(creatingBudgetItem.id, { hoursCount: hoursValue });
                          } else if (editingBudgetItem) {
                            await updateBudgetItemAutomatically(editingBudgetItem.id, { hoursCount: hoursValue });
                          }
                        }}
                        sx={{ 
                          color: '#86868b',
                          p: 0.5,
                          '&:hover': { bgcolor: 'rgba(134, 134, 139, 0.1)' }
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>-</Typography>
                      </IconButton>
                      <TextField
                        size="small"
                        type="text"
                        value={tempHoursInput || (newBudgetItem.hoursCount !== undefined && newBudgetItem.hoursCount !== null ? newBudgetItem.hoursCount.toString() : '')}
                        onChange={async (e) => {
                          const value = e.target.value;
                          console.log('🔢 Input hours value:', value);
                          
                          // Validation pour permettre jusqu'à 2 chiffres après le point
                          if (value === '' || /^[\d.,]*$/.test(value)) {
                            // Vérifier qu'il n'y a qu'un seul séparateur décimal
                            const decimalSeparators = (value.match(/[.,]/g) || []).length;
                            if (decimalSeparators <= 1) {
                              // Vérifier qu'il n'y a pas plus de 2 chiffres après le séparateur
                              const parts = value.split(/[.,]/);
                              if (parts.length === 1 || (parts.length === 2 && parts[1].length <= 2)) {
                                console.log('✅ Hours validation passed for:', value);
                                
                                // Toujours mettre à jour la valeur temporaire
                                setTempHoursInput(value);
                                
                                if (value === '') {
                                  setNewBudgetItem({ ...newBudgetItem, hoursCount: 0 });
                                  // Sauvegarder automatiquement
                                  if (creatingBudgetItem) {
                                    await updateBudgetItemAutomatically(creatingBudgetItem.id, { hoursCount: 0 });
                                  } else if (editingBudgetItem) {
                                    await updateBudgetItemAutomatically(editingBudgetItem.id, { hoursCount: 0 });
                                  }
                                } else if (value === ',' || value === '.') {
                                  // Permettre la saisie temporaire
                                  console.log('🔢 Decimal separator, keeping temp input');
                                } else {
                                  // Vérifier si la valeur se termine par . ou ,
                                  const endsWithDecimal = value.endsWith('.') || value.endsWith(',');
                                  
                                  if (endsWithDecimal) {
                                    // Pour les valeurs qui se terminent par . ou , on garde la saisie
                                    console.log('🔢 Decimal input, keeping temp input');
                                  } else {
                                    // Valeur complète, convertir normalement
                                    const hoursCount = parseFloat(value.replace(',', '.'));
                                    if (!isNaN(hoursCount)) {
                                      console.log('🔢 Complete value:', hoursCount);
                                      setNewBudgetItem({ ...newBudgetItem, hoursCount });
                                      // Sauvegarder automatiquement
                                      if (creatingBudgetItem) {
                                        await updateBudgetItemAutomatically(creatingBudgetItem.id, { hoursCount });
                                      } else if (editingBudgetItem) {
                                        await updateBudgetItemAutomatically(editingBudgetItem.id, { hoursCount });
                                      }
                                      setTempHoursInput(''); // Vider l'input temporaire
                                    }
                                  }
                                }
                              } else {
                                console.log('❌ Too many decimal places for hours:', value);
                              }
                            } else {
                              console.log('❌ Too many decimal separators for hours:', value);
                            }
                          } else {
                            console.log('❌ Hours validation failed for:', value);
                          }
                        }}
                        inputProps={{
                          style: { 
                            textAlign: 'center',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            padding: '4px 8px',
                            WebkitUserSelect: 'none',
                            MozUserSelect: 'none',
                            msUserSelect: 'none',
                            userSelect: 'none'
                          }
                        }}
                        sx={{
                          flex: 1,
                          '& .MuiOutlinedInput-root': {
                            border: 'none',
                            '& fieldset': { border: 'none' },
                            '&:hover fieldset': { border: 'none' },
                            '&.Mui-focused fieldset': { border: 'none' }
                          }
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => {
                          const currentHours = newBudgetItem.hoursCount || 0;
                          const newHours = currentHours + 0.5;
                          setNewBudgetItem({ ...newBudgetItem, hoursCount: parseFloat(newHours.toFixed(1)) });
                          updateTemporaryBudgetItem({ hoursCount: parseFloat(newHours.toFixed(1)) });
                        }}
                        sx={{ 
                          color: '#86868b',
                          p: 0.5,
                          '&:hover': { bgcolor: 'rgba(134, 134, 139, 0.1)' }
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>+</Typography>
                      </IconButton>
                    </Box>
                  </Box>
                  
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: '#86868b', display: 'block', mb: 0.5 }}>
                      Rémunération horaire brute (€)
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e5e7', borderRadius: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          const currentRate = newBudgetItem.hourlyRate || 0;
                          const newRate = Math.max(0, currentRate - 5);
                          setNewBudgetItem({ ...newBudgetItem, hourlyRate: parseFloat(newRate.toFixed(2)) });
                          updateTemporaryBudgetItem({ hourlyRate: parseFloat(newRate.toFixed(2)) });
                        }}
                        sx={{ 
                          color: '#86868b',
                          p: 0.5,
                          '&:hover': { bgcolor: 'rgba(134, 134, 139, 0.1)' }
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>-</Typography>
                      </IconButton>
                      <TextField
                        size="small"
                        type="text"
                        value={tempHourlyRateInput || (newBudgetItem.hourlyRate !== undefined && newBudgetItem.hourlyRate !== null ? newBudgetItem.hourlyRate.toString() : '')}
                        onChange={(e) => {
                          const value = e.target.value;
                          console.log('🔢 Input hourly rate value:', value);
                          
                          // Validation pour permettre jusqu'à 2 chiffres après le point
                          if (value === '' || /^[\d.,]*$/.test(value)) {
                            // Vérifier qu'il n'y a qu'un seul séparateur décimal
                            const decimalSeparators = (value.match(/[.,]/g) || []).length;
                            if (decimalSeparators <= 1) {
                              // Vérifier qu'il n'y a pas plus de 2 chiffres après le séparateur
                              const parts = value.split(/[.,]/);
                              if (parts.length === 1 || (parts.length === 2 && parts[1].length <= 2)) {
                                console.log('✅ Hourly rate validation passed for:', value);
                                
                                // Toujours mettre à jour la valeur temporaire
                                setTempHourlyRateInput(value);
                                
                                if (value === '') {
                                  setNewBudgetItem({ ...newBudgetItem, hourlyRate: 0 });
                                  updateTemporaryBudgetItem({ hourlyRate: 0 });
                                } else if (value === ',' || value === '.') {
                                  // Permettre la saisie temporaire
                                  console.log('🔢 Decimal separator, keeping temp input');
                                } else {
                                  // Vérifier si la valeur se termine par . ou ,
                                  const endsWithDecimal = value.endsWith('.') || value.endsWith(',');
                                  
                                  if (endsWithDecimal) {
                                    // Pour les valeurs qui se terminent par . ou , on garde la saisie
                                    console.log('🔢 Decimal input, keeping temp input');
                                  } else {
                                    // Valeur complète, convertir normalement
                                    const hourlyRate = parseFloat(value.replace(',', '.'));
                                    if (!isNaN(hourlyRate)) {
                                      console.log('🔢 Complete hourly rate value:', hourlyRate);
                                      setNewBudgetItem({ ...newBudgetItem, hourlyRate });
                                      updateTemporaryBudgetItem({ hourlyRate });
                                      setTempHourlyRateInput(''); // Vider l'input temporaire
                                    }
                                  }
                                }
                              } else {
                                console.log('❌ Too many decimal places for hourly rate:', value);
                              }
                            } else {
                              console.log('❌ Too many decimal separators for hourly rate:', value);
                            }
                          } else {
                            console.log('❌ Hourly rate validation failed for:', value);
                          }
                        }}
                        inputProps={{
                          style: { 
                            textAlign: 'center',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            padding: '4px 8px',
                            WebkitUserSelect: 'none',
                            MozUserSelect: 'none',
                            msUserSelect: 'none',
                            userSelect: 'none'
                          }
                        }}
                        sx={{
                          flex: 1,
                          '& .MuiOutlinedInput-root': {
                            border: 'none',
                            '& fieldset': { border: 'none' },
                            '&:hover fieldset': { border: 'none' },
                            '&.Mui-focused fieldset': { border: 'none' }
                          }
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => {
                          const currentRate = newBudgetItem.hourlyRate || 0;
                          const newRate = currentRate + 5;
                          setNewBudgetItem({ ...newBudgetItem, hourlyRate: parseFloat(newRate.toFixed(2)) });
                          updateTemporaryBudgetItem({ hourlyRate: parseFloat(newRate.toFixed(2)) });
                        }}
                        sx={{ 
                          color: '#86868b',
                          p: 0.5,
                          '&:hover': { bgcolor: 'rgba(134, 134, 139, 0.1)' }
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>+</Typography>
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              </Box>
            )}
            
            {/* Champs pour modifier les dates */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: '#86868b', display: 'block', mb: 0.5 }}>
                  Semaine de début
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e5e7', borderRadius: 1 }}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      const currentWeek = parseInt(newBudgetItem.startDate?.match(/S(\d+)/)?.[1] || '1');
                      const newWeek = Math.max(1, currentWeek - 1);
                      const newStartDate = `S${newWeek}`;
                      setNewBudgetItem({ ...newBudgetItem, startDate: newStartDate });
                      updateTemporaryBudgetItem({ startDate: newStartDate });
                    }}
                    sx={{ 
                      color: '#86868b',
                      p: 0.5,
                      '&:hover': { bgcolor: 'rgba(134, 134, 139, 0.1)' }
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>-</Typography>
                  </IconButton>
                  <TextField
                    size="small"
                    value={newBudgetItem.startDate?.match(/S(\d+)/)?.[1] || ''}
                    onChange={(e) => {
                      const weekNumber = parseInt(e.target.value) || 1;
                      const newStartDate = `S${Math.max(1, weekNumber)}`;
                      setNewBudgetItem({ ...newBudgetItem, startDate: newStartDate });
                      updateTemporaryBudgetItem({ startDate: newStartDate });
                    }}
                    inputProps={{
                      style: { 
                        textAlign: 'center',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        padding: '4px 8px'
                      }
                    }}
                    sx={{
                      flex: 1,
                      '& .MuiOutlinedInput-root': {
                        border: 'none',
                        '& fieldset': { border: 'none' },
                        '&:hover fieldset': { border: 'none' },
                        '&.Mui-focused fieldset': { border: 'none' }
                      }
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      const currentWeek = parseInt(newBudgetItem.startDate?.match(/S(\d+)/)?.[1] || '1');
                      const newWeek = currentWeek + 1;
                      const newStartDate = `S${newWeek}`;
                      setNewBudgetItem({ ...newBudgetItem, startDate: newStartDate });
                      updateTemporaryBudgetItem({ startDate: newStartDate });
                    }}
                    sx={{ 
                      color: '#86868b',
                      p: 0.5,
                      '&:hover': { bgcolor: 'rgba(134, 134, 139, 0.1)' }
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>+</Typography>
                  </IconButton>
                </Box>
              </Box>
              
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: '#86868b', display: 'block', mb: 0.5 }}>
                  Semaine de fin
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e5e7', borderRadius: 1 }}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      const currentWeek = parseInt(newBudgetItem.endDate?.match(/S(\d+)/)?.[1] || '1');
                      const startWeek = parseInt(newBudgetItem.startDate?.match(/S(\d+)/)?.[1] || '1');
                      const newWeek = Math.max(startWeek, currentWeek - 1);
                      const newEndDate = `S${newWeek}`;
                      setNewBudgetItem({ ...newBudgetItem, endDate: newEndDate });
                      updateTemporaryBudgetItem({ endDate: newEndDate });
                    }}
                    sx={{ 
                      color: '#86868b',
                      p: 0.5,
                      '&:hover': { bgcolor: 'rgba(134, 134, 139, 0.1)' }
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>-</Typography>
                  </IconButton>
                  <TextField
                    size="small"
                    value={newBudgetItem.endDate?.match(/S(\d+)/)?.[1] || ''}
                    onChange={(e) => {
                      const weekNumber = parseInt(e.target.value) || 1;
                      const startWeek = parseInt(newBudgetItem.startDate?.match(/S(\d+)/)?.[1] || '1');
                      const newWeek = Math.max(startWeek, weekNumber);
                      const newEndDate = `S${newWeek}`;
                      setNewBudgetItem({ ...newBudgetItem, endDate: newEndDate });
                      updateTemporaryBudgetItem({ endDate: newEndDate });
                    }}
                    inputProps={{
                      style: { 
                        textAlign: 'center',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        padding: '4px 8px'
                      }
                    }}
                    sx={{
                      flex: 1,
                      '& .MuiOutlinedInput-root': {
                        border: 'none',
                        '& fieldset': { border: 'none' },
                        '&:hover fieldset': { border: 'none' },
                        '&.Mui-focused fieldset': { border: 'none' }
                      }
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      const currentWeek = parseInt(newBudgetItem.endDate?.match(/S(\d+)/)?.[1] || '1');
                      const newWeek = currentWeek + 1;
                      const newEndDate = `S${newWeek}`;
                      setNewBudgetItem({ ...newBudgetItem, endDate: newEndDate });
                      updateTemporaryBudgetItem({ endDate: newEndDate });
                    }}
                    sx={{ 
                      color: '#86868b',
                      p: 0.5,
                      '&:hover': { bgcolor: 'rgba(134, 134, 139, 0.1)' }
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>+</Typography>
                  </IconButton>
                </Box>
              </Box>
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ color: '#86868b', display: 'block', mb: 1 }}>
                Couleur
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {availableColors.slice(0, 8).map((color) => (
                  <Box
                    key={color}
                    onClick={() => {
                      setNewBudgetItem({ ...newBudgetItem, color });
                      updateTemporaryBudgetItem({ color });
                    }}
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      bgcolor: color,
                      cursor: 'pointer',
                      border: newBudgetItem.color === color ? '2px solid #1d1d1f' : '1px solid #e5e5e7',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'scale(1.1)'
                      }
                    }}
                  />
                ))}
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                onClick={() => {
                  // Supprimer le poste temporaire si on annule
                  if (creatingBudgetItem) {
                    setBudgetItems(prev => prev.filter(item => item.id !== creatingBudgetItem.id));
                    setCreatingBudgetItem(null);
                  }
                  setQuickBudgetDialogOpen(false);
                  setEditingBudgetItem(null);
                  setNewBudgetItem({});
                }}
                sx={{ color: '#86868b' }}
              >
                Annuler
              </Button>

            </Box>
          </Box>
        )}

        {/* Recruitment Task Dialog */}
        <Dialog 
          open={recruitmentDialogOpen} 
          onClose={() => setRecruitmentDialogOpen(false)} 
          maxWidth="md" 
          fullWidth
          PaperProps={{
            sx: { borderRadius: 3 }
          }}
        >
          <DialogTitle sx={{ fontWeight: 700, color: '#1d1d1f' }}>
            Ajouter une tâche de recrutement
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Titre du poste"
                  value={newRecruitmentTask.title || ''}
                  onChange={(e) => setNewRecruitmentTask({ ...newRecruitmentTask, title: e.target.value })}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Description du poste"
                  value={newRecruitmentTask.description || ''}
                  onChange={(e) => setNewRecruitmentTask({ ...newRecruitmentTask, description: e.target.value })}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
              </Grid>
              
              {/* Section pour le recrutement lié aux postes de budget */}
              <Grid item xs={12}>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: '#f8f9fa', 
                  borderRadius: 2,
                  border: '1px solid #e5e5e7'
                }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#1d1d1f' }}>
                    Recrutement lié aux postes de budget
                  </Typography>
                  
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={linkedRecruitmentMode}
                        onChange={(e) => setLinkedRecruitmentMode(e.target.checked)}
                      />
                    }
                    label="Lier à des postes de budget"
                  />
                  
                  {linkedRecruitmentMode && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1, color: '#86868b' }}>
                        Sélectionner les postes de budget concernés :
                      </Typography>
                      <Box sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e5e5e7', borderRadius: 1, p: 1 }}>
                        {budgetItems.map((item) => (
                          <FormControlLabel
                            key={item.id}
                            control={
                              <Checkbox
                                checked={selectedBudgetItems.includes(item.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedBudgetItems([...selectedBudgetItems, item.id]);
                                  } else {
                                    setSelectedBudgetItems(selectedBudgetItems.filter(id => id !== item.id));
                                  }
                                }}
                              />
                            }
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box
                                  sx={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    bgcolor: item.color
                                  }}
                                />
                                <Typography variant="body2">
                                  {item.title} - {item.budget}€ HT
                                </Typography>
                              </Box>
                            }
                          />
                        ))}
                      </Box>
                      
                      <TextField
                        fullWidth
                        type="number"
                        label="Nombre d'étudiants à recruter"
                        value={recruitmentStudentsCount}
                        onChange={(e) => setRecruitmentStudentsCount(Number(e.target.value) || 1)}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">👥</InputAdornment>,
                        }}
                        sx={{
                          mt: 2,
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2
                          }
                        }}
                      />
                      
                                             {selectedBudgetItems.length > 1 && (
                         <Alert severity="info" sx={{ mt: 2 }}>
                           <Typography variant="body2">
                             {recruitmentStudentsCount === 1 
                               ? `Un seul étudiant sera recruté pour les ${selectedBudgetItems.length} postes sélectionnés.`
                               : `${recruitmentStudentsCount} étudiants seront recrutés pour les ${selectedBudgetItems.length} postes sélectionnés.`
                             }
                           </Typography>
                         </Alert>
                       )}
                    </Box>
                  )}
                </Box>
              </Grid>
              
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Rémunération (€ HT)"
                  value={newRecruitmentTask.remuneration || ''}
                  onChange={(e) => setNewRecruitmentTask({ ...newRecruitmentTask, remuneration: Number(e.target.value) })}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">€ HT</InputAdornment>,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Durée (heures)"
                  value={newRecruitmentTask.duration || ''}
                  onChange={(e) => setNewRecruitmentTask({ ...newRecruitmentTask, duration: Number(e.target.value) })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">h</InputAdornment>,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Date de début"
                  InputLabelProps={{ shrink: true }}
                  value={newRecruitmentTask.startDate || ''}
                  onChange={(e) => setNewRecruitmentTask({ ...newRecruitmentTask, startDate: e.target.value })}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Date de fin"
                  InputLabelProps={{ shrink: true }}
                  value={newRecruitmentTask.endDate || ''}
                  onChange={(e) => setNewRecruitmentTask({ ...newRecruitmentTask, endDate: e.target.value })}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Lieu"
                  value={newRecruitmentTask.location || ''}
                  onChange={(e) => setNewRecruitmentTask({ ...newRecruitmentTask, location: e.target.value })}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: '#f8f9fa', 
                  borderRadius: 2,
                  border: '1px solid #e5e5e7'
                }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#1d1d1f' }}>
                    Exigences de candidature
                  </Typography>
                  
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={newRecruitmentTask.requiresCV || false}
                        onChange={(e) => setNewRecruitmentTask({ ...newRecruitmentTask, requiresCV: e.target.checked })}
                        sx={{
                          color: '#0071e3',
                          '&.Mui-checked': {
                            color: '#0071e3',
                          },
                        }}
                      />
                    }
                    label="CV requis"
                    sx={{ mb: 1 }}
                  />
                  
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={newRecruitmentTask.requiresMotivation || false}
                        onChange={(e) => setNewRecruitmentTask({ ...newRecruitmentTask, requiresMotivation: e.target.checked })}
                        sx={{
                          color: '#0071e3',
                          '&.Mui-checked': {
                            color: '#0071e3',
                          },
                        }}
                      />
                    }
                    label="Lettre de motivation requise"
                  />
                </Box>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button 
              onClick={() => {
                setRecruitmentDialogOpen(false);
                setLinkedRecruitmentMode(false);
                setSelectedBudgetItems([]);
                setRecruitmentStudentsCount(1);
              }}
              sx={{ color: '#86868b' }}
            >
              Annuler
            </Button>
            <Button 
              onClick={handleAddRecruitmentTask} 
              variant="contained"
              disabled={
                (linkedRecruitmentMode && selectedBudgetItems.length === 0) ||
                (!linkedRecruitmentMode && !newRecruitmentTask.title?.trim())
              }
              sx={{ 
                bgcolor: '#667eea',
                '&:hover': { bgcolor: '#5a6fd8' }
              }}
            >
              Ajouter
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Recruitment Task Dialog */}
        <Dialog 
          open={editRecruitmentDialogOpen} 
          onClose={() => {
            setEditRecruitmentDialogOpen(false);
            setEditingRecruitmentTask(null);
          }} 
          maxWidth="md" 
          fullWidth
          PaperProps={{
            sx: { borderRadius: 3 }
          }}
        >
          <DialogTitle sx={{ fontWeight: 700, color: '#1d1d1f' }}>
            Modifier la tâche de recrutement
          </DialogTitle>
          <DialogContent sx={{ p: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sx={{ pt: 1 }}>
                <TextField
                  fullWidth
                  label="Titre de la tâche"
                  value={editingRecruitmentTask?.title || ''}
                  onChange={(e) => setEditingRecruitmentTask(prev => 
                    prev ? { ...prev, title: e.target.value } : null
                  )}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Description"
                  value={editingRecruitmentTask?.description || ''}
                  onChange={(e) => setEditingRecruitmentTask(prev => 
                    prev ? { ...prev, description: e.target.value } : null
                  )}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
              </Grid>
              
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Rémunération (€ HT)"
                  value={editingRecruitmentTask?.remuneration || 0}
                  onChange={(e) => setEditingRecruitmentTask(prev => 
                    prev ? { ...prev, remuneration: Number(e.target.value) || 0 } : null
                  )}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">€</InputAdornment>,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
              </Grid>
              
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Durée (heures)"
                  value={editingRecruitmentTask?.duration || 0}
                  onChange={(e) => setEditingRecruitmentTask(prev => 
                    prev ? { ...prev, duration: Number(e.target.value) || 0 } : null
                  )}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">h</InputAdornment>,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
              </Grid>
              

              
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Date de début"
                  value={editingRecruitmentTask?.startDate || ''}
                  onChange={(e) => setEditingRecruitmentTask(prev => 
                    prev ? { ...prev, startDate: e.target.value } : null
                  )}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
              </Grid>
              
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Date de fin"
                  value={editingRecruitmentTask?.endDate || ''}
                  onChange={(e) => setEditingRecruitmentTask(prev => 
                    prev ? { ...prev, endDate: e.target.value } : null
                  )}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Lieu"
                  value={editingRecruitmentTask?.location || ''}
                  onChange={(e) => setEditingRecruitmentTask(prev => 
                    prev ? { ...prev, location: e.target.value } : null
                  )}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: '#f8f9fa', 
                  borderRadius: 2,
                  border: '1px solid #e5e5e7'
                }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#1d1d1f' }}>
                    Exigences de candidature
                  </Typography>
                  
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={editingRecruitmentTask?.requiresCV || false}
                        onChange={(e) => setEditingRecruitmentTask(prev => 
                          prev ? { ...prev, requiresCV: e.target.checked } : null
                        )}
                        sx={{
                          color: '#0071e3',
                          '&.Mui-checked': {
                            color: '#0071e3',
                          },
                        }}
                      />
                    }
                    label="CV requis"
                    sx={{ mb: 1 }}
                  />
                  
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={editingRecruitmentTask?.requiresMotivation || false}
                        onChange={(e) => setEditingRecruitmentTask(prev => 
                          prev ? { ...prev, requiresMotivation: e.target.checked } : null
                        )}
                        sx={{
                          color: '#0071e3',
                          '&.Mui-checked': {
                            color: '#0071e3',
                          },
                        }}
                      />
                    }
                    label="Lettre de motivation requise"
                  />
                </Box>
              </Grid>
              
              {/* Affichage des postes de budget liés à la tâche */}
              {editingRecruitmentTask?.budgetItemIds && editingRecruitmentTask.budgetItemIds.length > 0 && (
                <Grid item xs={12}>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: '#f8f9fa', 
                    borderRadius: 2,
                    border: '1px solid #e5e5e7'
                  }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#1d1d1f' }}>
                      Postes de budget liés
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {editingRecruitmentTask.budgetItemIds.map((id) => {
                        const bi = budgetItems.find(b => b.id === id);
                        if (!bi) return null;
                        return (
                          <Chip 
                            key={id}
                            label={`${bi.title} (${editingRecruitmentTask.recruitedStudents || 0}/${bi.studentsToRecruit || 0})`}
                            sx={{
                              bgcolor: '#eef2ff',
                              color: '#27326a'
                            }}
                          />
                        );
                      })}
                    </Stack>
                  </Box>
                </Grid>
              )}

              {editingRecruitmentTask?.linkedRecruitment && (
                <Grid item xs={12}>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: '#f8f9fa', 
                    borderRadius: 2,
                    border: '1px solid #e5e5e7'
                  }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#1d1d1f' }}>
                      Recrutement lié aux postes de budget
                    </Typography>
                    
                    <TextField
                      fullWidth
                      type="number"
                      label="Nombre d'étudiants à recruter"
                      value={editingRecruitmentTask?.studentsToRecruit || 1}
                      onChange={(e) => setEditingRecruitmentTask(prev => 
                        prev ? { ...prev, studentsToRecruit: Number(e.target.value) || 1 } : null
                      )}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">Étudiants</InputAdornment>,
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2
                        }
                      }}
                    />
                    
                    <TextField
                      fullWidth
                      type="number"
                      label="Étudiants déjà recrutés"
                      value={editingRecruitmentTask?.recruitedStudents || 0}
                      onChange={(e) => setEditingRecruitmentTask(prev => 
                        prev ? { ...prev, recruitedStudents: Number(e.target.value) || 0 } : null
                      )}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">Recrutés</InputAdornment>,
                      }}
                      sx={{
                        mt: 2,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2
                        }
                      }}
                    />
                  </Box>
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 3, justifyContent: 'space-between' }}>
            <Button 
              color="error"
              variant="outlined"
              onClick={async () => {
                if (!editingRecruitmentTask?.id) return;
                const ok = window.confirm('Confirmer la suppression de cette tâche de recrutement ?');
                if (!ok) return;
                await handleDeleteRecruitmentTask(editingRecruitmentTask.id);
                setEditRecruitmentDialogOpen(false);
                setEditingRecruitmentTask(null);
              }}
            >
              Supprimer
            </Button>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                onClick={() => {
                  setEditRecruitmentDialogOpen(false);
                  setEditingRecruitmentTask(null);
                }}
                sx={{ color: '#86868b' }}
              >
                Annuler
              </Button>
              <Button 
                onClick={handleEditRecruitmentTask} 
                variant="contained"
                disabled={!editingRecruitmentTask?.title?.trim()}
                sx={{ 
                  bgcolor: '#667eea',
                  '&:hover': { bgcolor: '#5a6fd8' }
                }}
              >
                Modifier
              </Button>
            </Box>
          </DialogActions>
        </Dialog>

        {/* Document Upload Dialog */}
        <Dialog 
          open={documentDialogOpen} 
          onClose={() => setDocumentDialogOpen(false)} 
          maxWidth="sm" 
          fullWidth
          PaperProps={{
            sx: { borderRadius: 3 }
          }}
        >
          <DialogTitle sx={{ fontWeight: 700, color: '#1d1d1f' }}>
            Upload de document
          </DialogTitle>
          <DialogContent>
            <Box sx={{ 
              p: 4, 
              border: '2px dashed #667eea', 
              borderRadius: 3, 
              textAlign: 'center',
              bgcolor: 'rgba(102, 126, 234, 0.04)'
            }}>
              <input
                type="file"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button
                  component="span"
                  startIcon={<UploadIcon />}
                  variant="outlined"
                  sx={{ 
                    mb: 2,
                    borderColor: '#667eea',
                    color: '#667eea',
                    '&:hover': { 
                      borderColor: '#5a6fd8',
                      bgcolor: 'rgba(102, 126, 234, 0.04)'
                    }
                  }}
                >
                  Sélectionner un fichier
                </Button>
              </label>
              <Typography variant="body2" color="text.secondary">
                Glissez-déposez un fichier ou cliquez pour sélectionner
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button 
              onClick={() => setDocumentDialogOpen(false)}
              sx={{ color: '#86868b' }}
            >
              Fermer
            </Button>
          </DialogActions>
        </Dialog>

        {/* PowerPoint Generation Dialog */}
        <Dialog 
          open={powerpointDialogOpen} 
          onClose={() => setPowerpointDialogOpen(false)} 
          maxWidth="md" 
          fullWidth
          PaperProps={{
            sx: { borderRadius: 3 }
          }}
        >
          <DialogTitle sx={{ fontWeight: 700, color: '#1d1d1f' }}>
            Générer un document PowerPoint
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ mb: 3, color: '#1d1d1f' }}>
              Utilisez les balises suivantes dans votre template :
            </Typography>
            <Box sx={{ mb: 4, p: 3, bgcolor: '#f8f9fa', borderRadius: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#1d1d1f' }}>
                Balises disponibles :
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
                    {'{{ETUDE_NUMERO}}'} - Numéro de l'étude
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
                    {'{{ENTREPRISE}}'} - Nom de l'entreprise
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
                    {'{{CHARGE_MISSION}}'} - Chargé de mission
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
                    {'{{DESCRIPTION}}'} - Description de l'étude
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
                    {'{{BUDGET_TOTAL}}'} - Budget total
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
                    {'{{DATE_CREATION}}'} - Date de création
                  </Typography>
                </Grid>
              </Grid>
            </Box>
            <TextField
              fullWidth
              multiline
              rows={6}
              label="Template PowerPoint (utilisez les balises ci-dessus)"
              value={powerpointTemplate}
              onChange={(e) => setPowerpointTemplate(e.target.value)}
              placeholder="Exemple: Présentation de l'étude {{ETUDE_NUMERO}} pour {{ENTREPRISE}}..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button 
              onClick={() => setPowerpointDialogOpen(false)}
              sx={{ color: '#86868b' }}
            >
              Annuler
            </Button>
            <Button 
              variant="contained" 
              startIcon={<PowerSettingsNewIcon />}
              sx={{ 
                bgcolor: '#667eea',
                '&:hover': { bgcolor: '#5a6fd8' }
              }}
            >
              Générer PowerPoint
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog pour ajouter une nouvelle entreprise */}
        <StyledDialog 
          open={newCompanyDialogOpen} 
          onClose={handleCancelNewCompany} 
          maxWidth="sm" 
          fullWidth
        >
          <DialogTitle sx={{ 
            textAlign: 'center', 
            fontSize: '1.5rem', 
            fontWeight: 500,
            pt: 4
          }}>
            Nouvelle entreprise
          </DialogTitle>
          <DialogContent sx={{ px: 4 }}>
            <Stack spacing={3} sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                  Nom de l'entreprise *
                </Typography>
                <StyledTextField
                  value={newCompany.name}
                  onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                  fullWidth
                  placeholder="Entrez le nom de l'entreprise"
                />
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                  Logo
                </Typography>
                <Box
                  component="label"
                  sx={{
                    width: '100%',
                    height: '100px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: theme => `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      borderColor: theme => theme.palette.primary.main,
                      bgcolor: theme => alpha(theme.palette.primary.main, 0.05),
                    }
                  }}
                >
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CloudUploadIcon />
                    <Typography>
                      {newCompany.logo ? 'Changer le logo' : 'Importer un logo'}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                  Adresse
                </Typography>
                <StyledTextField
                  value={newCompany.address}
                  onChange={(e) => setNewCompany({ ...newCompany, address: e.target.value })}
                  fullWidth
                  placeholder="Adresse de l'entreprise"
                />
              </Box>

              <Grid container>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                      Code postal
                    </Typography>
                    <StyledTextField
                      value={newCompany.postalCode}
                      onChange={(e) => setNewCompany({ ...newCompany, postalCode: e.target.value })}
                      fullWidth
                      placeholder="Code postal"
                    />
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', ml: 2 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                      Ville
                    </Typography>
                    <StyledTextField
                      value={newCompany.city}
                      onChange={(e) => setNewCompany({ ...newCompany, city: e.target.value })}
                      fullWidth
                      placeholder="Ville"
                    />
                  </Box>
                </Grid>
              </Grid>

              <Grid container>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                      SIRET
                    </Typography>
                    <StyledTextField
                      value={newCompany.siret}
                      onChange={(e) => setNewCompany({ ...newCompany, siret: e.target.value })}
                      fullWidth
                      placeholder="Numéro SIRET"
                    />
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', ml: 2 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                      Pays
                    </Typography>
                    <StyledTextField
                      value={newCompany.country}
                      onChange={(e) => setNewCompany({ ...newCompany, country: e.target.value })}
                      fullWidth
                      placeholder="Pays"
                    />
                  </Box>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Contacts
                  </Typography>
                  <Button
                    startIcon={<PersonAddIcon />}
                    onClick={() => setShowContactForm(true)}
                    sx={{
                      color: 'primary.main',
                      '&:hover': {
                        bgcolor: theme => alpha(theme.palette.primary.main, 0.05),
                      }
                    }}
                  >
                    Ajouter un contact
                  </Button>
                </Box>

                {contacts.map((contact) => (
                  <Paper
                    key={contact.id}
                    sx={{
                      p: 2,
                      mb: 1,
                      borderRadius: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      bgcolor: theme => alpha(theme.palette.background.default, 0.5),
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        bgcolor: theme => alpha(theme.palette.background.default, 0.8),
                      }
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {contact.firstName} {contact.lastName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {contact.position} • {contact.email}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveContact(contact.id);
                      }}
                      sx={{ 
                        color: 'text.secondary',
                        '&:hover': {
                          color: 'error.main',
                          bgcolor: theme => alpha(theme.palette.error.main, 0.1),
                        }
                      }}
                    >
                      <CloseIcon />
                    </IconButton>
                  </Paper>
                ))}

                {showContactForm && (
                  <Paper sx={{ 
                    p: 2, 
                    mt: 2, 
                    borderRadius: '12px',
                    bgcolor: theme => alpha(theme.palette.background.default, 0.5)
                  }}>
                    <Stack spacing={2}>
                      <Grid container>
                        <Grid item xs={6}>
                          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <StyledTextField
                              placeholder="Prénom"
                              value={newContact.firstName}
                              onChange={(e) => handleContactChange('firstName', e.target.value)}
                              fullWidth
                            />
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', ml: 2 }}>
                            <StyledTextField
                              placeholder="Nom"
                              value={newContact.lastName}
                              onChange={(e) => handleContactChange('lastName', e.target.value)}
                              fullWidth
                            />
                          </Box>
                        </Grid>
                      </Grid>
                      <StyledTextField
                        placeholder="Email"
                        value={newContact.email}
                        onChange={(e) => handleContactChange('email', e.target.value)}
                        fullWidth
                      />
                      <StyledTextField
                        placeholder="Poste"
                        value={newContact.position}
                        onChange={(e) => handleContactChange('position', e.target.value)}
                        fullWidth
                      />
                      <StyledTextField
                        placeholder="Téléphone"
                        value={newContact.phone}
                        onChange={(e) => handleContactChange('phone', e.target.value)}
                        fullWidth
                      />
                      <StyledTextField
                        placeholder="LinkedIn"
                        value={newContact.linkedin}
                        onChange={(e) => handleContactChange('linkedin', e.target.value)}
                        fullWidth
                      />
                      <FormControl fullWidth>
                        <InputLabel>Genre</InputLabel>
                        <Select
                          value={newContact.gender || ''}
                          onChange={(e) => handleContactChange('gender', e.target.value)}
                          label="Genre"
                        >
                          <MenuItem value="">Non spécifié</MenuItem>
                          <MenuItem value="homme">Homme</MenuItem>
                          <MenuItem value="femme">Femme</MenuItem>
                        </Select>
                      </FormControl>
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Button
                          onClick={() => setShowContactForm(false)}
                          sx={{ color: 'text.secondary' }}
                        >
                          Annuler
                        </Button>
                        <Button
                          onClick={handleAddContact}
                          variant="contained"
                        >
                          Ajouter
                        </Button>
                      </Box>
                    </Stack>
                  </Paper>
                )}
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 4, justifyContent: 'flex-end' }}>
            <Button
              onClick={handleCancelNewCompany}
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  bgcolor: theme => alpha(theme.palette.text.secondary, 0.05),
                }
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleAddNewCompany}
              variant="contained"
              disabled={!newCompany.name}
            >
              Créer
            </Button>
          </DialogActions>
        </StyledDialog>

        {/* Dialog pour ajouter une note */}
        <Dialog 
          open={noteDialogOpen} 
          onClose={() => setNoteDialogOpen(false)} 
          maxWidth="sm" 
          fullWidth
          PaperProps={{
            sx: { borderRadius: 3 }
          }}
        >
          <DialogTitle sx={{ fontWeight: 700, color: '#1d1d1f' }}>
            Ajouter une note
          </DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Contenu de la note"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              variant="outlined"
              sx={{
                mt: 2,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button 
              onClick={() => setNoteDialogOpen(false)}
              sx={{ color: '#86868b' }}
            >
              Annuler
            </Button>
            <Button 
              onClick={handleAddNote} 
              variant="contained"
              disabled={!newNote.trim()}
              sx={{ 
                bgcolor: '#667eea',
                '&:hover': { bgcolor: '#5a6fd8' }
              }}
            >
              Ajouter
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog pour créer un nouveau type de mission */}
        <StyledDialog 
          open={missionTypeDialogOpen} 
          onClose={() => setMissionTypeDialogOpen(false)} 
          maxWidth="md" 
          fullWidth
        >
          <DialogTitle sx={{ 
            textAlign: 'center', 
            fontSize: '1.5rem', 
            fontWeight: 500,
            pt: 4
          }}>
            Nouveau type de mission
          </DialogTitle>
          <DialogContent sx={{ px: 4, maxHeight: '70vh', overflow: 'auto' }}>
            <Stack spacing={3} sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                  Titre du type de mission *
                </Typography>
                <StyledTextField
                  value={newMissionType.title}
                  onChange={(e) => setNewMissionType({ ...newMissionType, title: e.target.value })}
                  fullWidth
                  placeholder="Entrez le titre du type de mission"
                />
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                  Description du type de mission
                </Typography>
                <StyledTextField
                  multiline
                  rows={3}
                  value={newMissionType.missionDescription}
                  onChange={(e) => setNewMissionType({ ...newMissionType, missionDescription: e.target.value })}
                  fullWidth
                  placeholder="Décrivez le type de mission"
                />
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                  Profil d'étudiant attendu
                </Typography>
                <StyledTextField
                  multiline
                  rows={3}
                  value={newMissionType.studentProfile}
                  onChange={(e) => setNewMissionType({ ...newMissionType, studentProfile: e.target.value })}
                  fullWidth
                  placeholder="Décrivez le profil d'étudiant attendu"
                />
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                  Mise en pratique du cours
                </Typography>
                <StyledTextField
                  multiline
                  rows={3}
                  value={newMissionType.courseApplication}
                  onChange={(e) => setNewMissionType({ ...newMissionType, courseApplication: e.target.value })}
                  fullWidth
                  placeholder="Décrivez la mise en pratique du cours"
                />
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                  Apprentissage du type de mission
                </Typography>
                <StyledTextField
                  multiline
                  rows={3}
                  value={newMissionType.missionLearning}
                  onChange={(e) => setNewMissionType({ ...newMissionType, missionLearning: e.target.value })}
                  fullWidth
                  placeholder="Décrivez l'apprentissage du type de mission"
                />
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 4, justifyContent: 'flex-end' }}>
            <Button
              onClick={() => setMissionTypeDialogOpen(false)}
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  bgcolor: theme => alpha(theme.palette.text.secondary, 0.05),
                }
              }}
            >
              Annuler
            </Button>
            <Button
              variant="contained"
              onClick={handleCreateMissionType}
              disabled={!newMissionType.title?.trim()}
              sx={{
                bgcolor: theme => theme.palette.primary.main,
                '&:hover': {
                  bgcolor: theme => theme.palette.primary.dark
                }
              }}
            >
              Créer
            </Button>
          </DialogActions>
        </StyledDialog>

        {/* Dialog pour afficher les candidatures */}
        <Dialog
          open={applicationsDialogOpen}
          onClose={() => setApplicationsDialogOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 3, overflow: 'hidden' }
          }}
        >
          <DialogTitle sx={{ 
            fontWeight: 700, 
            color: '#1d1d1f',
            borderBottom: '1px solid #f0f0f0',
            pb: 2
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Candidatures
              </Typography>
              <Chip
                label={`${recruitmentApplications.length} candidature${recruitmentApplications.length > 1 ? 's' : ''}`}
                size="small"
                sx={{
                  bgcolor: '#667eea',
                  color: 'white',
                  fontWeight: 600
                }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: '#86868b', mt: 1 }}>
              {selectedRecruitmentTask?.title}
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            {recruitmentApplications.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Box sx={{ 
                  width: 80, 
                  height: 80, 
                  borderRadius: '50%', 
                  bgcolor: '#f8f9fa', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3
                }}>
                  <PeopleIcon sx={{ fontSize: 32, color: '#d2d2d7' }} />
                </Box>
                <Typography variant="h6" sx={{ color: '#86868b', mb: 1, fontWeight: 600 }}>
                  Aucune candidature
                </Typography>
                <Typography variant="body2" sx={{ color: '#86868b' }}>
                  Aucun étudiant n'a encore postulé pour cette tâche de recrutement.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ maxHeight: 500, overflowY: 'auto' }}>
                {recruitmentApplications.map((application, index) => (
                  <Box
                    key={application.id}
                    sx={{
                      p: 3,
                      borderBottom: index < recruitmentApplications.length - 1 ? '1px solid #f0f0f0' : 'none',
                      '&:hover': {
                        bgcolor: '#fafafa'
                      },
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                      {/* Avatar */}
                      <Avatar 
                        src={application.userPhotoURL}
                        sx={{ 
                          width: 48, 
                          height: 48,
                          bgcolor: '#667eea',
                          fontSize: '1.2rem',
                          fontWeight: 600
                        }}
                      >
                        {application.userDisplayName?.charAt(0)?.toUpperCase()}
                      </Avatar>

                      {/* Contenu principal */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                          <Typography variant="h6" sx={{ 
                            fontWeight: 600, 
                            color: '#1d1d1f',
                            fontSize: '1rem'
                          }}>
                            {application.userDisplayName}
                          </Typography>
                          <Chip
                            label={application.status}
                            size="small"
                            sx={{
                              fontWeight: 600,
                              bgcolor: application.status === 'Refusée' ? '#ff4757' : 
                                       application.status === 'Acceptée' ? '#2ed573' : 
                                       application.status === 'Ajouté manuellement' ? '#667eea' : '#ffa502',
                              color: 'white',
                              fontSize: '0.7rem',
                              height: 20
                            }}
                          />
                          {application.addedManually && (
                            <Chip
                              label="Ajouté manuellement"
                              size="small"
                              sx={{
                                fontWeight: 600,
                                bgcolor: '#667eea',
                                color: 'white',
                                fontSize: '0.6rem',
                                height: 16
                              }}
                            />
                          )}
                        </Box>
                        
                        <Typography variant="body2" sx={{ 
                          color: '#86868b', 
                          mb: 1,
                          fontSize: '0.875rem'
                        }}>
                          {application.userEmail}
                        </Typography>
                        
                        <Typography variant="caption" sx={{ 
                          color: '#a0a0a0',
                          fontSize: '0.75rem'
                        }}>
                          {application.addedManually 
                            ? `Ajouté manuellement le ${application.submittedAt.toLocaleDateString('fr-FR')}`
                            : `Candidature soumise le ${application.submittedAt.toLocaleDateString('fr-FR')}`
                          }
                        </Typography>
                      </Box>

                      {/* Actions */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => handleViewApplicationDetail(application)}
                          sx={{
                            fontSize: '0.75rem',
                            textTransform: 'none',
                            color: '#667eea',
                            fontWeight: 500,
                            '&:hover': {
                              bgcolor: 'rgba(102, 126, 234, 0.04)'
                            }
                          }}
                        >
                          Détails
                        </Button>
                        
                        {application.status === 'En attente' && (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleApplicationStatusChange(application.id, 'Acceptée')}
                              sx={{
                                fontSize: '0.75rem',
                                textTransform: 'none',
                                bgcolor: '#2ed573',
                                px: 2,
                                py: 0.5,
                                minWidth: 'auto',
                                '&:hover': { bgcolor: '#26c066' }
                              }}
                            >
                              Accepter
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleApplicationStatusChange(application.id, 'Refusée')}
                              sx={{
                                fontSize: '0.75rem',
                                textTransform: 'none',
                                borderColor: '#ff4757',
                                color: '#ff4757',
                                px: 2,
                                py: 0.5,
                                minWidth: 'auto',
                                '&:hover': {
                                  bgcolor: 'rgba(255, 71, 87, 0.04)',
                                  borderColor: '#e63946'
                                }
                              }}
                            >
                              Refuser
                            </Button>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3, borderTop: '1px solid #f0f0f0' }}>
            <Button
              onClick={() => setApplicationsDialogOpen(false)}
              sx={{ 
                color: '#86868b',
                fontWeight: 500
              }}
            >
              Fermer
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog pour afficher les détails d'une candidature */}
        <Dialog
          open={applicationDetailDialogOpen}
          onClose={() => setApplicationDetailDialogOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 3, overflow: 'hidden' }
          }}
        >
          <DialogTitle sx={{ 
            fontWeight: 700, 
            color: '#1d1d1f',
            borderBottom: '1px solid #f0f0f0',
            pb: 2
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Avatar 
                src={selectedApplication?.userPhotoURL}
                sx={{ 
                  width: 56, 
                  height: 56,
                  bgcolor: '#667eea',
                  fontSize: '1.4rem',
                  fontWeight: 600
                }}
              >
                {selectedApplication?.userDisplayName?.charAt(0)?.toUpperCase()}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#1d1d1f', mb: 0.5 }}>
                  {selectedApplication?.userDisplayName}
                </Typography>
                <Typography variant="body2" sx={{ color: '#86868b', mb: 1 }}>
                  {selectedApplication?.userEmail}
                </Typography>
                <Chip
                  label={selectedApplication?.status}
                  size="small"
                  sx={{
                    fontWeight: 600,
                    bgcolor: selectedApplication?.status === 'Refusée' ? '#ff4757' : 
                             selectedApplication?.status === 'Acceptée' ? '#2ed573' : '#ffa502',
                    color: 'white',
                    fontSize: '0.75rem'
                  }}
                />
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            {selectedApplication && (
              <Box sx={{ maxHeight: 600, overflowY: 'auto' }}>
                {/* Informations de base */}
                <Box sx={{ p: 4, borderBottom: '1px solid #f0f0f0' }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#1d1d1f', mb: 3 }}>
                    Informations de candidature
                  </Typography>
                  
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                    <Box>
                      <Typography variant="caption" sx={{ 
                        color: '#86868b', 
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                        mb: 1,
                        display: 'block'
                      }}>
                        Date de candidature
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {selectedApplication.submittedAt.toLocaleDateString('fr-FR')} à {selectedApplication.submittedAt.toLocaleTimeString('fr-FR')}
                      </Typography>
                    </Box>
                    
                    {selectedApplication.reviewedBy && (
                      <Box>
                        <Typography variant="caption" sx={{ 
                          color: '#86868b', 
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          letterSpacing: '0.5px',
                          mb: 1,
                          display: 'block'
                        }}>
                          Évalué par
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {selectedApplication.reviewedBy}
                        </Typography>
                      </Box>
                    )}
                    
                    {selectedApplication.reviewedAt && (
                      <Box>
                        <Typography variant="caption" sx={{ 
                          color: '#86868b', 
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          letterSpacing: '0.5px',
                          mb: 1,
                          display: 'block'
                        }}>
                          Date d'évaluation
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {selectedApplication.reviewedAt.toLocaleDateString('fr-FR')} à {selectedApplication.reviewedAt.toLocaleTimeString('fr-FR')}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* CV */}
                {selectedApplication.cvUrl && (
                  <Box sx={{ p: 4, borderBottom: '1px solid #f0f0f0' }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#1d1d1f', mb: 3 }}>
                      CV
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        href={selectedApplication.cvUrl}
                        target="_blank"
                        sx={{
                          bgcolor: '#667eea',
                          '&:hover': { bgcolor: '#5a6fd8' },
                          px: 3,
                          py: 1.5,
                          borderRadius: 2
                        }}
                      >
                        Télécharger
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => handlePreviewCV(selectedApplication.cvUrl!)}
                        sx={{
                          borderColor: '#667eea',
                          color: '#667eea',
                          '&:hover': {
                            bgcolor: 'rgba(102, 126, 234, 0.04)',
                            borderColor: '#5a6fd8'
                          },
                          px: 3,
                          py: 1.5,
                          borderRadius: 2
                        }}
                      >
                        Prévisualiser
                      </Button>
                    </Box>
                  </Box>
                )}

                {/* Lettre de motivation */}
                {selectedApplication.motivationLetter && (
                  <Box sx={{ p: 4 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#1d1d1f', mb: 3 }}>
                      Lettre de motivation
                    </Typography>
                    <Paper sx={{ 
                      p: 3, 
                      bgcolor: '#fafafa', 
                      borderRadius: 3,
                      border: '1px solid #f0f0f0'
                    }}>
                      <Typography variant="body1" sx={{ 
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.6,
                        color: '#2c2c2c'
                      }}>
                        {selectedApplication.motivationLetter}
                      </Typography>
                    </Paper>
                  </Box>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 4, borderTop: '1px solid #f0f0f0' }}>
            {selectedApplication?.status === 'En attente' && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => {
                    handleApplicationStatusChange(selectedApplication.id, 'Acceptée');
                    setApplicationDetailDialogOpen(false);
                  }}
                  sx={{
                    bgcolor: '#2ed573',
                    '&:hover': { bgcolor: '#26c066' },
                    px: 3,
                    py: 1.5,
                    borderRadius: 2
                  }}
                >
                  Accepter
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    handleApplicationStatusChange(selectedApplication.id, 'Refusée');
                    setApplicationDetailDialogOpen(false);
                  }}
                  sx={{
                    borderColor: '#ff4757',
                    color: '#ff4757',
                    '&:hover': {
                      bgcolor: 'rgba(255, 71, 87, 0.04)',
                      borderColor: '#e63946'
                    },
                    px: 3,
                    py: 1.5,
                    borderRadius: 2
                  }}
                >
                  Refuser
                </Button>
              </Box>
            )}
            <Button
              onClick={() => setApplicationDetailDialogOpen(false)}
              sx={{ 
                color: '#86868b',
                fontWeight: 500,
                px: 3,
                py: 1.5
              }}
            >
              Fermer
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog pour prévisualiser le CV */}
        <Dialog
          open={cvPreviewOpen}
          onClose={() => setCvPreviewOpen(false)}
          maxWidth="lg"
          fullWidth
          PaperProps={{
            sx: { 
              borderRadius: 3, 
              overflow: 'hidden',
              height: '90vh'
            }
          }}
        >
          <DialogTitle sx={{ 
            fontWeight: 700, 
            color: '#1d1d1f',
            borderBottom: '1px solid #f0f0f0',
            pb: 2
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Prévisualisation du CV
              </Typography>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                href={cvPreviewUrl}
                target="_blank"
                sx={{
                  borderColor: '#667eea',
                  color: '#667eea',
                  '&:hover': {
                    bgcolor: 'rgba(102, 126, 234, 0.04)',
                    borderColor: '#5a6fd8'
                  }
                }}
              >
                Télécharger
              </Button>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ p: 0, height: '100%' }}>
            <Box sx={{ height: '100%', width: '100%' }}>
              <iframe
                src={`${cvPreviewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none'
                }}
                title="CV Preview"
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, borderTop: '1px solid #f0f0f0' }}>
            <Button
              onClick={() => setCvPreviewOpen(false)}
              sx={{ 
                color: '#86868b',
                fontWeight: 500
              }}
            >
              Fermer
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          sx={{
            zIndex: 9999,
            '& .MuiSnackbar-root': {
              zIndex: 9999
            }
          }}
        >
          <Alert 
            severity={snackbar.severity} 
            onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
            variant="filled"
            sx={{ 
              width: '100%',
              zIndex: 9999,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>

        {/* Dialog pour ajouter manuellement des étudiants */}
        <Dialog
          open={addStudentDialogOpen}
          onClose={() => setAddStudentDialogOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 3 }
          }}
        >
          <DialogTitle sx={{ 
            fontWeight: 700, 
            color: '#1d1d1f',
            borderBottom: '1px solid #f0f0f0',
            pb: 2
          }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Ajouter des étudiants manuellement
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {selectedTaskForAddStudent?.title}
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Sélectionnez les étudiants de votre structure à ajouter à cette tâche de recrutement :
            </Typography>
            
            {availableStudents.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <PeopleIcon sx={{ fontSize: 48, color: '#d2d2d7', mb: 1 }} />
                <Typography variant="body2" sx={{ color: '#86868b' }}>
                  Aucun étudiant disponible à ajouter
                </Typography>
              </Box>
            ) : (
              <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                {availableStudents.map((student) => (
                  <Box
                    key={student.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      p: 2,
                      mb: 1,
                      border: '1px solid #f0f0f0',
                      borderRadius: 2,
                      cursor: 'pointer',
                      bgcolor: selectedStudents.includes(student.id) ? 'rgba(102, 126, 234, 0.04)' : 'transparent',
                      '&:hover': {
                        bgcolor: 'rgba(102, 126, 234, 0.02)'
                      }
                    }}
                    onClick={() => {
                      setSelectedStudents(prev => 
                        prev.includes(student.id)
                          ? prev.filter(id => id !== student.id)
                          : [...prev, student.id]
                      );
                    }}
                  >
                    <Checkbox
                      checked={selectedStudents.includes(student.id)}
                      sx={{
                        color: '#667eea',
                        '&.Mui-checked': {
                          color: '#667eea'
                        }
                      }}
                    />
                    <Avatar
                      src={student.photoURL || undefined}
                      sx={{ 
                        width: 40, 
                        height: 40, 
                        mr: 2,
                        bgcolor: '#667eea'
                      }}
                    >
                      {student.displayName?.charAt(0) || student.email?.charAt(0) || 'U'}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {student.displayName || student.email?.split('@')[0] || 'Utilisateur'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {student.email}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3, borderTop: '1px solid #f0f0f0' }}>
            <Button
              onClick={handleAddStudentsToTask}
              disabled={selectedStudents.length === 0}
              variant="contained"
              sx={{
                bgcolor: '#667eea',
                '&:hover': { bgcolor: '#5a6fd8' },
                fontWeight: 600
              }}
            >
              Ajouter {selectedStudents.length} étudiant(s)
            </Button>
            <Button
              onClick={() => setAddStudentDialogOpen(false)}
              sx={{ 
                color: '#86868b',
                fontWeight: 500
              }}
            >
              Annuler
            </Button>
          </DialogActions>
        </Dialog>

        {/* Popup des étudiants recrutés */}
        <Dialog
          open={recruitedStudentsDialogOpen}
          onClose={() => setRecruitedStudentsDialogOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 3, overflow: 'hidden' }
          }}
        >
          <DialogTitle sx={{ 
            fontWeight: 700, 
            color: '#1d1d1f',
            borderBottom: '1px solid #f0f0f0',
            pb: 2
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {selectedRecruitedStudentsTitle}
              </Typography>
              <Chip
                label={`${selectedRecruitedStudents.length} étudiant(s) recruté(s)`}
                size="small"
                sx={{
                  bgcolor: '#2ed573',
                  color: 'white',
                  fontWeight: 600
                }}
              />
            </Box>
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            {selectedRecruitedStudents.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Box sx={{ 
                  width: 80, 
                  height: 80, 
                  borderRadius: '50%', 
                  bgcolor: '#f8f9fa', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3
                }}>
                  <PeopleIcon sx={{ fontSize: 32, color: '#d2d2d7' }} />
                </Box>
                <Typography variant="h6" sx={{ color: '#86868b', mb: 1, fontWeight: 600 }}>
                  Aucun étudiant recruté
                </Typography>
                <Typography variant="body2" sx={{ color: '#86868b' }}>
                  Aucun étudiant n'a encore été recruté pour cette tâche.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ maxHeight: 500, overflowY: 'auto' }}>
                {selectedRecruitedStudents.map((student, index) => (
                  <Box
                    key={student.id}
                    sx={{
                      p: 3,
                      borderBottom: index < selectedRecruitedStudents.length - 1 ? '1px solid #f0f0f0' : 'none',
                      '&:hover': {
                        bgcolor: '#fafafa'
                      },
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                      {/* Avatar */}
                      <Avatar 
                        src={student.userPhotoURL || undefined}
                        sx={{ 
                          width: 48, 
                          height: 48,
                          bgcolor: student.userPhotoURL ? 'transparent' : '#2ed573',
                          fontSize: '1.2rem',
                          fontWeight: 600,
                          border: student.userPhotoURL ? '2px solid #e5e5e7' : 'none'
                        }}
                      >
                        {!student.userPhotoURL && student.userDisplayName?.charAt(0)?.toUpperCase()}
                      </Avatar>

                      {/* Contenu principal */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                          <Typography variant="h6" sx={{ 
                            fontWeight: 600, 
                            color: '#1d1d1f',
                            fontSize: '1rem'
                          }}>
                            {student.userDisplayName}
                          </Typography>
                          <Chip
                            label="Recruté"
                            size="small"
                            sx={{
                              fontWeight: 600,
                              bgcolor: '#2ed573',
                              color: 'white',
                              fontSize: '0.7rem',
                              height: 20
                            }}
                          />
                          {student.addedManually && (
                            <Chip
                              label="Ajouté manuellement"
                              size="small"
                              sx={{
                                fontWeight: 600,
                                bgcolor: '#667eea',
                                color: 'white',
                                fontSize: '0.6rem',
                                height: 16
                              }}
                            />
                          )}
                        </Box>
                        
                        <Typography variant="body2" sx={{ 
                          color: '#86868b', 
                          mb: 1,
                          fontSize: '0.875rem'
                        }}>
                          {student.userEmail}
                        </Typography>
                        
                        <Typography variant="caption" sx={{ 
                          color: '#a0a0a0',
                          fontSize: '0.75rem'
                        }}>
                          {student.addedManually 
                            ? `Ajouté manuellement le ${student.submittedAt.toLocaleDateString('fr-FR')}`
                            : `Candidature acceptée le ${student.submittedAt.toLocaleDateString('fr-FR')}`
                          }
                        </Typography>

                        {/* CV et Lettre de motivation affichés directement */}
                        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {student.cvUrl && (
                            <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 2, border: '1px solid #e5e5e7' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#1d1d1f' }}>
                                📄 CV
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" sx={{ color: '#666', fontSize: '0.875rem' }}>
                                  CV disponible
                                </Typography>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    setCvPreviewUrl(student.cvUrl!);
                                    setCvPreviewOpen(true);
                                  }}
                                  sx={{
                                    fontSize: '0.75rem',
                                    textTransform: 'none',
                                    borderColor: '#667eea',
                                    color: '#667eea',
                                    '&:hover': {
                                      bgcolor: 'rgba(102, 126, 234, 0.04)',
                                      borderColor: '#5a6fd8'
                                    }
                                  }}
                                >
                                  Voir CV
                                </Button>
                              </Box>
                            </Box>
                          )}

                          {student.motivationLetter && (
                            <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 2, border: '1px solid #e5e5e7' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#1d1d1f' }}>
                                💌 Lettre de motivation
                              </Typography>
                              <Typography variant="body2" sx={{ color: '#666', fontSize: '0.875rem', mb: 2 }}>
                                {student.motivationLetter.length > 200 
                                  ? `${student.motivationLetter.substring(0, 200)}...` 
                                  : student.motivationLetter
                                }
                              </Typography>
                              {student.motivationLetter.length > 200 && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    setSelectedApplication(student);
                                    setApplicationDetailDialogOpen(true);
                                  }}
                                  sx={{
                                    fontSize: '0.75rem',
                                    textTransform: 'none',
                                    borderColor: '#ffa502',
                                    color: '#ffa502',
                                    '&:hover': {
                                      bgcolor: 'rgba(255, 165, 2, 0.04)',
                                      borderColor: '#e69500'
                                    }
                                  }}
                                >
                                  Voir plus
                                </Button>
                              )}
                            </Box>
                          )}
                        </Box>
                      </Box>

                      {/* Actions */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {student.motivationLetter && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setSelectedApplication(student);
                              setApplicationDetailDialogOpen(true);
                            }}
                            sx={{
                              fontSize: '0.75rem',
                              textTransform: 'none',
                              borderColor: '#ffa502',
                              color: '#ffa502',
                              '&:hover': {
                                bgcolor: 'rgba(255, 165, 2, 0.04)',
                                borderColor: '#e69500'
                              }
                            }}
                          >
                            Voir motivation
                          </Button>
                        )}
                        {student.cvUrl && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setCvPreviewUrl(student.cvUrl!);
                              setCvPreviewOpen(true);
                            }}
                            sx={{
                              fontSize: '0.75rem',
                              textTransform: 'none',
                              borderColor: '#667eea',
                              color: '#667eea',
                              '&:hover': {
                                bgcolor: 'rgba(102, 126, 234, 0.04)',
                                borderColor: '#5a6fd8'
                              }
                            }}
                          >
                            Voir CV
                          </Button>
                        )}
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={async () => {
                            const confirmDelete = window.confirm(
                              `Êtes-vous sûr de vouloir supprimer ${student.userDisplayName} de cette tâche de recrutement ?`
                            );
                            if (confirmDelete) {
                              try {
                                // Supprimer la candidature de Firestore
                                await deleteDoc(doc(db, 'applications', student.id));
                                
                                // Mettre à jour l'état local
                                setSelectedRecruitedStudents(prev => 
                                  prev.filter(s => s.id !== student.id)
                                );
                                
                                                                // Mettre à jour le compteur dans la tâche
                                const taskId = student.recruitmentTaskId;
                                if (taskId) {
                                  const task = recruitmentTasks.find(t => t.id === taskId);
                                  if (task) {
                                    const newRecruitedCount = Math.max(0, (task.recruitedStudents || 0) - 1);
                                    
                                    // Mettre à jour dans Firestore
                                    await updateDoc(doc(db, 'recruitmentTasks', taskId), {
                                      recruitedStudents: newRecruitedCount
                                    });
                                    
                                    // Mettre à jour l'état local des tâches
                                    setRecruitmentTasks(prev => prev.map(t => 
                                      t.id === taskId ? { ...t, recruitedStudents: newRecruitedCount } : t
                                    ));
                                    
                                    // Mettre à jour les postes de budget liés
                                    if (task.budgetItemIds && task.budgetItemIds.length > 0) {
                                      const batch = writeBatch(db);
                                      
                                      for (const budgetItemId of task.budgetItemIds) {
                                        const budgetItem = budgetItems.find(bi => bi.id === budgetItemId);
                                        if (budgetItem) {
                                          // Recalculer le nombre d'étudiants recrutés pour ce poste
                                          const linkedTasks = recruitmentTasks.filter(t => 
                                            t.budgetItemIds && t.budgetItemIds.includes(budgetItemId)
                                          );
                                          
                                          let totalRecruited = 0;
                                          for (const linkedTask of linkedTasks) {
                                            if (linkedTask.id === taskId) {
                                              totalRecruited += newRecruitedCount;
                                            } else {
                                              totalRecruited += linkedTask.recruitedStudents || 0;
                                            }
                                          }
                                          
                                          batch.update(doc(db, 'budgetItems', budgetItemId), {
                                            recruitedStudents: totalRecruited
                                          });
                                        }
                                      }
                                      
                                      await batch.commit();
                                      
                                      // Mettre à jour l'état local des postes de budget
                                      setBudgetItems(prev => prev.map(item => {
                                        if (task.budgetItemIds && task.budgetItemIds.includes(item.id)) {
                                          const linkedTasks = recruitmentTasks.filter(t => 
                                            t.budgetItemIds && t.budgetItemIds.includes(item.id)
                                          );
                                          
                                          let totalRecruited = 0;
                                          for (const linkedTask of linkedTasks) {
                                            if (linkedTask.id === taskId) {
                                              totalRecruited += newRecruitedCount;
                                            } else {
                                              totalRecruited += linkedTask.recruitedStudents || 0;
                                            }
                                          }
                                          
                                          return { ...item, recruitedStudents: totalRecruited };
                                        }
                                        return item;
                                      }));
                                    }
                                  }
                                }
                                
                                // Recharger toutes les données
                                await loadApplicationsCounts();
                                await loadRecruitedStudents();
                                
                                setSnackbar({
                                  open: true,
                                  message: `${student.userDisplayName} a été supprimé de la tâche`,
                                  severity: 'success'
                                });
                              } catch (error) {
                                console.error('Erreur lors de la suppression:', error);
                                setSnackbar({
                                  open: true,
                                  message: 'Erreur lors de la suppression de l\'étudiant',
                                  severity: 'error'
                                });
                              }
                            }
                          }}
                          sx={{
                            fontSize: '0.75rem',
                            textTransform: 'none',
                            borderColor: '#ff4757',
                            color: '#ff4757',
                            '&:hover': {
                              bgcolor: 'rgba(255, 71, 87, 0.04)',
                              borderColor: '#e63946'
                            }
                          }}
                        >
                          Supprimer
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3, borderTop: '1px solid #f0f0f0' }}>
            <Button
              onClick={() => setRecruitedStudentsDialogOpen(false)}
              sx={{ 
                color: '#86868b',
                fontWeight: 500
              }}
            >
              Fermer
            </Button>
          </DialogActions>
        </Dialog>

        {/* Popup de prévisualisation des documents */}
        <Dialog
          open={documentPreviewOpen}
          onClose={() => setDocumentPreviewOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)'
            }
          }}
        >
          <DialogTitle sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            borderBottom: '1px solid #f0f0f0',
            pb: 2
          }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
                Aperçu du document
              </Typography>
              {selectedDocument && (
                <Typography variant="body2" sx={{ color: '#8E8E93', mt: 0.5 }}>
                  {selectedDocument.name}
                </Typography>
              )}
            </Box>
            <IconButton
              onClick={() => setDocumentPreviewOpen(false)}
              sx={{ color: '#8E8E93' }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
          <DialogContent sx={{ p: 3 }}>
            {selectedDocument ? (
              <Box>
                {/* Informations du document */}
                <Paper sx={{ p: 3, mb: 3, bgcolor: '#f8f9fa' }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#8E8E93', mb: 0.5 }}>
                        Statut
                      </Typography>
                      <Chip 
                        label={selectedDocument.isDraft ? 'Brouillon' : 'Final'} 
                        size="small"
                        sx={{ 
                          fontWeight: 600,
                          bgcolor: selectedDocument.isDraft ? '#FFC107' : '#4CAF50',
                          color: selectedDocument.isDraft ? '#000' : 'white',
                          maxWidth: '80px',
                          '& .MuiChip-label': {
                            fontSize: '0.65rem',
                            px: 1
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#8E8E93', mb: 0.5 }}>
                        Créé par
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {selectedDocument.uploadedBy || 'Utilisateur inconnu'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#8E8E93', mb: 0.5 }}>
                        Taille
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {(selectedDocument.size / 1024 / 1024).toFixed(2)} MB
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" sx={{ color: '#8E8E93', mb: 0.5 }}>
                        Date de création
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {selectedDocument.uploadedAt && typeof selectedDocument.uploadedAt === 'object' && selectedDocument.uploadedAt.toDate ? 
                          formatDate(selectedDocument.uploadedAt.toDate().toISOString()) :
                          selectedDocument.uploadedAt && typeof selectedDocument.uploadedAt === 'string' ? 
                            formatDate(selectedDocument.uploadedAt) :
                            'Date invalide'
                        }
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>

                {/* Aperçu du contenu */}
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#1d1d1f' }}>
                  Aperçu du contenu
                </Typography>
                
                {selectedDocument.url ? (
                  <Box sx={{ 
                    border: '1px solid #e0e0e0', 
                    borderRadius: 2, 
                    p: 2, 
                    bgcolor: 'white',
                    minHeight: '300px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Typography variant="body1" sx={{ color: '#8E8E93' }}>
                      Aperçu du document disponible
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ 
                    border: '1px solid #e0e0e0', 
                    borderRadius: 2, 
                    p: 3, 
                    bgcolor: 'white',
                    minHeight: '300px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <DescriptionIcon sx={{ fontSize: 64, color: '#d2d2d7', mb: 2 }} />
                      <Typography variant="h6" sx={{ color: '#86868b', mb: 1 }}>
                        Aperçu non disponible
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#86868b' }}>
                        Ce document n'a pas encore été uploadé ou l'aperçu n'est pas supporté
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            )}
          </DialogContent>
          
          <DialogActions sx={{ p: 3, borderTop: '1px solid #f0f0f0' }}>
            {selectedDocument && (
              <>
                {selectedDocument.isDraft && selectedDocument.quoteData && (
                  <Button
                    variant="contained"
                    onClick={() => handleResumeEditing(selectedDocument)}
                    sx={{ 
                      backgroundColor: '#34D399',
                      '&:hover': { backgroundColor: '#10B981' }
                    }}
                    startIcon={<EditIcon />}
                  >
                    Reprendre l'édition
                  </Button>
                )}
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={() => {
                    handleDocumentDownload(selectedDocument);
                    setDocumentPreviewOpen(false);
                  }}
                  sx={{
                    borderColor: '#2ed573',
                    color: '#2ed573',
                    '&:hover': {
                      borderColor: '#28a745',
                      bgcolor: 'rgba(46, 213, 115, 0.04)'
                    }
                  }}
                >
                  Télécharger
                </Button>
              </>
            )}
            <Button
              onClick={() => setDocumentPreviewOpen(false)}
              sx={{ 
                color: '#86868b',
                fontWeight: 500
              }}
            >
              Fermer
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default EtudeDetails;
