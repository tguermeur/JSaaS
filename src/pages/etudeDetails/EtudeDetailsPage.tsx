import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Stack,
  alpha,
  Menu,
  FormControlLabel,
  Checkbox,
  Portal
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
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
  Dashboard as DashboardIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Description as DescriptionTabIcon,
  Settings as SettingsIcon,
  CloudUpload as CloudUploadIcon,
  PersonAdd as PersonAddIcon,
  Close as CloseIcon,
  DragIndicator as DragIndicatorIcon,
  MoreVert as MoreVertIcon,
  CalendarMonth as CalendarMonthIcon,
  AutoAwesome as AutoIcon,
  Description as DescriptionIconJE,
  CheckCircle as CheckCircleIcon,
  School as SchoolIcon,
  Receipt as ReceiptIcon,
  FileUpload as FileUploadIcon,
  PlayArrow as PlayArrowIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { decryptUserDisplayData, decryptUsersList, getDecryptedUserDisplayName, getSafeDisplayName } from '../../utils/decryptUserUtils';
import { prepareDecryptedDocumentContext } from '../../utils/documentDecryptUtils';
import UserReferenceText from '../../components/common/UserReferenceText';
import UserNameText from '../../components/common/UserNameText';
import UserAvatarInitials from '../../components/common/UserAvatarInitials';
import { db, storage } from '../../firebase/config';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, deleteDoc, deleteField, writeBatch, limit } from 'firebase/firestore';
import { ASSOCIATED_QUERY_LIMIT } from '../../hooks/useEtudeAssociatedData';
import { getDownloadURL, ref, uploadBytes, deleteObject } from 'firebase/storage';
import { styled } from '@mui/material';
import { tokens } from '../../theme/tokens';
import { dsTabsSx, dsDetailHeaderSx, dsPageCanvasSx } from '../../components/ds';
import { PersonRow } from '../../components/ds/MissionDetailsPrimitives';
import {
  ETUDE_DETAIL_TABS,
  useEtudeDetailTabs,
  type EtudeDetailTabId,
} from '../../hooks/useEtudeDetailTabs';
import {
  EtudeDetailShell,
} from './EtudeDetailShell';
import { EtudeDetailSidebarPanel } from './EtudeDetailSidebarPanel';
import { OverviewTab } from './OverviewTab';
import { PlanningTab } from './PlanningTab';
import { RecruitmentTab } from './RecruitmentTab';
import { DocumentsTab } from './DocumentsTab';
import { ComplianceTab } from './ComplianceTab';
import { fadeInUp, slideInUp, slideInLeft, pulse, scaleIn } from '../../styles/animations';
import { uploadCompanyLogo } from '../../firebase/storage';
import DocumentGeneratorDialog from '../../components/DocumentGeneratorDialog';
import { DocumentType, TemplateVariable } from '../../types/templates';
import { PDFDocument } from 'pdf-lib';
import {
  EtudeEtape,
  ETUDE_ETAPE_LABELS,
  ETUDE_ETAPE_ORDER,
  ETUDE_ETAPE_COLORS,
  statusToEtape,
  Avenant,
  ConsultantJehAllocation,
  QualityChecklist,
  BudgetItem as BudgetItemType,
} from '../../types/etude';
import { JUNIOR_WORKSPACE } from '../detailWorkspace';
import {
  addAvenant,
  getAvenants,
  updateAvenant,
  deleteAvenant,
  updateConsultantAllocations,
  updateQualityChecklist,
  updateBudgetItemInvoiceStatus,
} from '../../services/etudeService';

// Animations imported from '../../styles/animations'

// Styles personnalisés
const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: tokens.radius.md,
    transition: tokens.transitions.default,
    '&:hover': {
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.primary.main,
      },
    },
  },
}));

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: tokens.radius.xxl,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
    animation: `${scaleIn} 0.3s ease-out`,
  },
}));

// scaleIn imported from '../../styles/animations'

// Aligné sur MissionDetails : mêmes statuts/étapes que les missions (Tresorerie, Audit)
export type EtudeStatus = 'Négociation' | 'Recrutement' | 'Date de mission' | 'Facturation' | 'Audit' | 'Archivé';

export const ETUDE_STATUS_OPTIONS: EtudeStatus[] = ['Négociation', 'Recrutement', 'Date de mission', 'Facturation', 'Audit', 'Archivé'];

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
  status: string; // EtudeStatus en pratique, string pour rétrocompatibilité
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
  etape: EtudeEtape;
  permissions?: {
    viewers: string[];
    editors: string[];
  };
  isArchived?: boolean;
  pricingType?: 'jeh' | 'hourly';
  // Champs JE enrichis
  consultantAllocations?: ConsultantJehAllocation[];
  qualityChecklist?: QualityChecklist;
  satisfactionScore?: number;
  mandat?: string;
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
  uploadedAt: Date | { toDate?: () => Date };
  uploadedBy: string;
  uploadedByName?: string;
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
  nSiret?: string;
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

const RecruitmentUserAvatar: React.FC<{
  userId: string;
  displayName?: string;
  email?: string;
}> = ({ userId, displayName, email }) => (
  <UserAvatarInitials user={{ id: userId, displayName, email }} />
);

const RecruitmentUserName: React.FC<{
  userId: string;
  displayName?: string;
  email: string;
  sx?: object;
  variant?: 'body1' | 'body2' | 'h6' | 'h5';
}> = ({ userId, displayName, email, sx, variant = 'body2' }) => (
  <UserReferenceText
    userId={userId}
    name={displayName}
    fallback={email.split('@')[0] || 'Utilisateur'}
    variant={variant}
    sx={sx}
  />
);

const workspaceConfig = JUNIOR_WORKSPACE;
void workspaceConfig;

const EtudeDetails: React.FC = () => {
  const { etudeNumber } = useParams<{ etudeNumber: string }>();
  const navigate = useNavigate();
  const { currentUser, userData } = useAuth();
  const userStructureId = userData?.structureId || null;
  
  const [etude, setEtude] = useState<EtudeData | null>(null);
  const [originalEtude, setOriginalEtude] = useState<EtudeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [availableCharges, setAvailableCharges] = useState<ChargeData[]>([]);
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
  const [availableMissionTypes, setAvailableMissionTypes] = useState<MissionDescription[]>([]);
  const [activeTab, setActiveTab] = useState<EtudeDetailTabId>('overview');
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
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
    actionLabel?: string;
    actionUrl?: string;
  }>({
    open: false,
    message: '',
    severity: 'success'
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

  // États pour le générateur de documents
  const [documentGeneratorOpen, setDocumentGeneratorOpen] = useState(false);
  const [companyFullData, setCompanyFullData] = useState<any>(null);
  const [structureFullData, setStructureFullData] = useState<any>(null);
  const [selectedStudentForDocument, setSelectedStudentForDocument] = useState<RecruitmentApplication | null>(null);
  const [documentGeneratorOpenForType, setDocumentGeneratorOpenForType] = useState<{ open: boolean; documentType?: DocumentType; studentId?: string }>({ open: false });
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ progress: number; message: string } | null>(null);

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
    nSiret: ''
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
        
        // Récupérer les détails de l'étude (filtrer par structure si connue pour respecter les règles Firestore)
        const etudesRef = collection(db, 'etudes');
        const etudeQuery = userStructureId
          ? query(
              etudesRef,
              where('structureId', '==', userStructureId),
              where('numeroEtude', '==', etudeNumber)
            )
          : query(etudesRef, where('numeroEtude', '==', etudeNumber));
        
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
        let etudeData = { id: etudeDoc.id, ...etudeDoc.data() } as EtudeData;

        // Récupérer les informations de l'entreprise (ID, nom et logo)
        if (etudeData.company) {
          try {
            const companiesRef = collection(db, 'companies');
            const companyConstraints = [where('name', '==', etudeData.company)];
            if (etudeData.structureId) companyConstraints.push(where('structureId', '==', etudeData.structureId));
            const companyQuery = query(companiesRef, ...companyConstraints);
            const companySnapshot = await getDocs(companyQuery);
            
            if (!companySnapshot.empty) {
              const companyDoc = companySnapshot.docs[0];
              const companyData = companyDoc.data();
              etudeData.companyId = companyDoc.id;
              etudeData.companyLogo = companyData.logo || null;
            }
          } catch (error) {
            console.warn('Erreur lors de la récupération des informations de l\'entreprise:', error);
          }
        }
        
        // Charger les avenants
        try {
          const avenants = await getAvenants(etudeDoc.id);
          (etudeData as any)._avenants = avenants;
        } catch {
          (etudeData as any)._avenants = [];
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
            where('status', 'in', ['membre', 'admin', 'superadmin'])
          );
          
          const usersSnapshot = await getDocs(usersQuery);
          const chargesListRaw = usersSnapshot.docs.map(doc => {
            const userData = doc.data();
            return {
              id: doc.id,
              displayName: userData.displayName || 'Utilisateur sans nom',
              firstName: userData.firstName,
              lastName: userData.lastName,
              photoURL: userData.photoURL
            };
          });
          const chargesListDecrypted = await decryptUsersList(chargesListRaw);
          const chargesList = chargesListDecrypted.map(u => ({
            id: u.id,
            displayName: u.displayName || 'Utilisateur sans nom',
            photoURL: (chargesListRaw.find(r => r.id === u.id) as any)?.photoURL
          }));
          setAvailableCharges(chargesList);
        }

        // Charger les données associées
        await loadAssociatedData(etudeDoc.id, etudeData.structureId);

        // Charger les données complètes pour le générateur de documents
        await loadCompleteDataForGenerator(etudeData);

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
  }, [etudeNumber, currentUser, navigate, userStructureId]);

  // Fonction pour charger les données complètes pour le générateur de documents
  const loadCompleteDataForGenerator = async (etudeData: EtudeData) => {
    try {
      // Charger les données complètes de l'entreprise
      if (etudeData.companyId) {
        const companyDoc = await getDoc(doc(db, 'companies', etudeData.companyId));
        if (companyDoc.exists()) {
          setCompanyFullData(companyDoc.data());
        }
      }

      // Charger les données complètes de la structure
      if (etudeData.structureId) {
        const structureDoc = await getDoc(doc(db, 'structures', etudeData.structureId));
        if (structureDoc.exists()) {
          setStructureFullData(structureDoc.data());
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données complètes:', error);
    }
  };

  // Fonction pour ouvrir le générateur de documents
  const handleOpenDocumentGenerator = () => {
    setDocumentGeneratorOpen(true);
  };

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

  // Récupérer le template assigné pour un type de document donné (depuis templateAssignments)
  const getAssignedTemplate = async (documentType: DocumentType) => {
    if (!etude?.structureId) return null;

    try {
      const assignmentsQuery = query(
        collection(db, 'templateAssignments'),
        where('structureId', '==', etude.structureId),
        where('documentType', '==', documentType)
      );

      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      if (assignmentsSnapshot.empty) return null;

      const assignmentDoc = assignmentsSnapshot.docs[0];
      const assignmentData = assignmentDoc.data();
      
      const templateDoc = await getDoc(doc(db, 'templates', assignmentData.templateId));
      if (!templateDoc.exists()) return null;

      const templateData = templateDoc.data();
      return {
        id: templateDoc.id,
        name: templateData.name,
        description: templateData.description,
        pdfUrl: templateData.pdfUrl,
        fileName: templateData.fileName || '',
        variables: templateData.variables || [],
        assignmentId: assignmentDoc.id,
        generationType: assignmentData.generationType || 'template'
      };
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du template assigné:', error);
      return null;
    }
  };

  // Fonction utilitaire pour convertir variableId en balise
  const getTagFromVariableId = (variableId: string): string => {
    const tagMappings: { [key: string]: string } = {
      // Étude - utiliser les mêmes variableId que dans les templates pour les missions mais avec des balises adaptées
      'numeroMission': '<etude_numero>', // Les templates utilisent numeroMission mais on le mappe vers etude_numero
      'numeroEtude': '<etude_numero>',
      'chargeName': '<etude_cdm>',
      'missionDateDebut': '<etude_date_debut>',
      'startDate': '<etude_date_debut>',
      'missionDateFin': '<etude_date_fin>',
      'endDate': '<etude_date_fin>',
      'location': '<etude_lieu>',
      'company': '<etude_entreprise>',
      'prixHT': '<etude_prix_ht>',
      'priceHT': '<etude_prix_ht>',
      'missionDescription': '<etude_description>',
      'description': '<etude_description>',
      'title': '<etude_titre>',
      'hours': '<etude_heures>',
      'consultantCount': '<etude_nb_consultants>',
      'studentCount': '<etude_nb_consultants>',
      'etape': '<etude_etape>',
      'status': '<etude_statut>',
      'missionType': '<etude_type>',
      'missionTypeName': '<etude_type>',
      'generationDate': '<generationDate>',
      'generationDatePlusOneYear': '<etude_date_generation_plus_1_an>',
      
      // Balises spécifiques JE
      'etudeJehTotal': '<etude_jeh_total>',
      'etudeDureeSemaines': '<etude_duree_semaines>',
      'phaseListe': '<phase_liste>',
      
      // User
      'lastName': '<user_nom>',
      'firstName': '<user_prenom>',
      'email': '<user_email>',
      'ecole': '<user_ecole>',
      'displayName': '<user_nom_complet>',
      'studentId': '<user_numero_etudiant>',
      
      // Contact
      'contact_lastName': '<contact_nom>',
      'contact_firstName': '<contact_prenom>',
      'contact_email': '<contact_email>',
      'contact_phone': '<contact_telephone>',
      'contact_position': '<contact_poste>',
      'contact_linkedin': '<contact_linkedin>',
      'contact_fullName': '<contact_nom_complet>',
      
      // Structure
      'structure_name': '<structure_nom>',
      'structure_nom': '<structure_nom>',
      'structure_address': '<structure_adresse>',
      'structure_phone': '<structure_telephone>',
      'structure_email': '<structure_email>',
      'structure_siret': '<structure_siret>',
      'structure_tvaNumber': '<structure_tvaNumber>',
      'structure_apeCode': '<structure_apeCode>',
      'structure_president_fullName': '<structure_president_nom_complet>',
      
      // Entreprise
      'companyName': '<entreprise_nom>',
      'name': '<entreprise_nom>',
      'nSiret': '<entreprise_nsiret>',
      'companyAddress': '<entreprise_adresse>',
      'address': '<entreprise_adresse>',
      'companyCity': '<entreprise_ville>',
      'city': '<entreprise_ville>',
      'companyPhone': '<entreprise_telephone>',
      'phone': '<entreprise_telephone>',
      'companyEmail': '<entreprise_email>',
      'website': '<entreprise_site_web>',
      
      // Totaux
      'totalHT': '<totalHT>',
      'totalTTC': '<totalTTC>',
      'tva': '<tva>',
    };
    return tagMappings[variableId] || `<${variableId}>`;
  };

  // Fonction pour remplacer les balises par leurs valeurs (adaptée pour les études)
  const replaceTags = async (
    text: string,
    studentData?: any,
    structureData?: any,
    tempDataOverride?: { [key: string]: string },
    cachedData?: {
      userData?: any;
      chargeData?: any;
      presidentFullName?: string | null;
    }
  ): Promise<string> => {
    if (!text || !etude) return text;

    try {
      const rawContact = contacts.find(c => c.isDefault) || contacts[0];
      let userDataRaw = cachedData?.userData || studentData;
      let chargeDataRaw = cachedData?.chargeData;
      let structureDataResolved = structureData || structureFullData;
      let companyDataRaw = companyFullData;
      const presidentFullName = cachedData?.presidentFullName || '';

      const userIdForDecrypt = userDataRaw?.id as string | undefined;
      const decryptedCtx = await prepareDecryptedDocumentContext({
        userId: userIdForDecrypt,
        userData: userDataRaw,
        chargeId: etude.chargeId,
        chargeData: chargeDataRaw,
        contactId: rawContact?.id,
        contactData: rawContact ? { ...rawContact } : null,
        companyId: companyDataRaw?.id,
        companyData: companyDataRaw,
        structureId: etude.structureId || structureFullData?.id,
        structureData: structureDataResolved,
      });

      const decryptedUserData = decryptedCtx.userData ?? userDataRaw;
      const chargeData = decryptedCtx.chargeData ?? chargeDataRaw;
      const contactData = decryptedCtx.contactData ?? rawContact;
      const company = decryptedCtx.companyData ?? companyDataRaw;
      structureDataResolved = decryptedCtx.structureData ?? structureDataResolved;

      // Calculer les totaux
      const totalHT = etude.prixHT || 0;
      const tva = totalHT * 0.2;
      const totalTTC = totalHT + tva;

      let etudeCdmLabel = etude.chargeName || '[Chargé d\'étude non disponible]';
      if (etude.chargeId) {
        try {
          etudeCdmLabel = await getDecryptedUserDisplayName(
            etude.chargeId,
            chargeData || { displayName: etude.chargeName }
          );
        } catch {
          etudeCdmLabel = getSafeDisplayName(chargeData || { displayName: etude.chargeName }) || etudeCdmLabel;
        }
      }

      const contact = contactData as {
        lastName?: string;
        firstName?: string;
        email?: string;
        phone?: string;
        position?: string;
        linkedin?: string;
      } | null | undefined;
      const companyInfo = company as {
        name?: string;
        nSiret?: string;
        address?: string;
        city?: string;
        country?: string;
        phone?: string;
        email?: string;
        website?: string;
        description?: string;
      } | null | undefined;
      const structureResolved = structureDataResolved as Record<string, string | undefined> | null | undefined;

      const replacements: { [key: string]: string } = {
        // Balises de l'étude
        '<etude_numero>': etude.numeroEtude || '[Numéro d\'étude non disponible]',
        '<etude_cdm>': etudeCdmLabel,
        '<etude_date_debut>': etude.startDate ? new Date(etude.startDate).toLocaleDateString('fr-FR') : '[Date de début non disponible]',
        '<etude_date_fin>': etude.endDate ? new Date(etude.endDate).toLocaleDateString('fr-FR') : '[Date de fin non disponible]',
        '<etude_lieu>': etude.location || '[Lieu non disponible]',
        '<etude_entreprise>': etude.company || '[Entreprise non disponible]',
        '<etude_prix_ht>': typeof etude.prixHT === 'number' ? etude.prixHT.toFixed(2) + '€' : '[Prix HT non disponible]',
        '<etude_description>': etude.description || '[Description non disponible]',
        '<etude_titre>': etude.title || '[Titre non disponible]',
        '<etude_heures>': typeof etude.hours === 'number' ? etude.hours.toString() : '[Heures non disponibles]',
        '<etude_nb_consultants>': typeof etude.consultantCount === 'number' ? etude.consultantCount.toString() : '[Nombre de consultants non disponible]',
        '<etude_etape>': etude.etape || '[Étape non disponible]',
        '<etude_statut>': etude.status || '[Statut non disponible]',
        '<etude_type>': etude.missionTypeName || '[Type d\'étude non disponible]',
        '<generationDate>': new Date().toLocaleDateString('fr-FR'),
        '<generationDatePlusOneYear>': new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR'),
        '<etude_date_generation_plus_1_an>': new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR'),
        
        // Balises spécifiques JE
        '<etude_jeh_total>': budgetItems.reduce((sum, item) => sum + (item.jehCount || 0), 0).toString() || '0',
        '<etude_duree_semaines>': (() => {
          if (!etude.startDate || !etude.endDate) return '[Durée non disponible]';
          const start = new Date(etude.startDate);
          const end = new Date(etude.endDate);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
          return diffWeeks.toString();
        })(),
        '<phase_liste>': budgetItems.map(item => `${item.title}: ${item.jehCount || 0} JEH`).join(', ') || '[Aucune phase]',
        
        // Balises pour les totaux
        '<totalHT>': totalHT.toFixed(2) + '€',
        '<totalTTC>': totalTTC.toFixed(2) + '€',
        '<tva>': tva.toFixed(2) + '€',
        
        // Balises utilisateur (avec données décryptées)
        '<user_nom>': decryptedUserData?.lastName || '[Nom non disponible]',
        '<user_prenom>': decryptedUserData?.firstName || '[Prénom non disponible]',
        '<user_email>': decryptedUserData?.email || '[Email non disponible]',
        '<user_ecole>': decryptedUserData?.ecole || '[École non disponible]',
        '<user_nom_complet>': decryptedUserData?.displayName || '[Nom complet non disponible]',
        '<user_telephone>': decryptedUserData?.phone || '[Téléphone non disponible]',
        '<user_numero_etudiant>': decryptedUserData?.studentId || '[Numéro étudiant non disponible]',
        '<user_formation>': decryptedUserData?.formation || '[Formation non disponible]',
        '<user_specialite>': decryptedUserData?.speciality || '[Spécialité non disponible]',
        '<user_niveau_etude>': decryptedUserData?.studyLevel || '[Niveau d\'études non disponible]',
        
        // Balises de contact
        '<contact_nom>': contact?.lastName || '[Nom du contact non disponible]',
        '<contact_prenom>': contact?.firstName || '[Prénom du contact non disponible]',
        '<contact_email>': contact?.email || '[Email du contact non disponible]',
        '<contact_telephone>': contact?.phone || '[Téléphone du contact non disponible]',
        '<contact_poste>': contact?.position || '[Poste du contact non disponible]',
        '<contact_linkedin>': contact?.linkedin || '[LinkedIn du contact non disponible]',
        '<contact_nom_complet>': `${contact?.firstName || ''} ${contact?.lastName || ''}`.trim() || '[Nom complet du contact non disponible]',
        
        // Balises de la structure
        '<structure_nom>': structureResolved?.nom || '[Nom de la structure non disponible]',
        '<structure_address>': structureResolved?.address || '[Adresse de la structure non disponible]',
        '<structure_phone>': structureResolved?.phone || '[Téléphone de la structure non disponible]',
        '<structure_email>': structureResolved?.email || '[Email de la structure non disponible]',
        '<structure_siret>': structureResolved?.siret || '[SIRET de la structure non disponible]',
        '<structure_tvaNumber>': structureResolved?.tvaNumber || '[Numéro de TVA de la structure non disponible]',
        '<structure_apeCode>': structureResolved?.apeCode || '[Code APE de la structure non disponible]',
        '<structure_president_nom_complet>': presidentFullName || '[Président non disponible]',
        
        // Balises pour l'entreprise
        '<entreprise_nom>': companyInfo?.name || etude.company || '[Nom entreprise non disponible]',
        '<entreprise_siren>': companyInfo?.nSiret ? companyInfo.nSiret.substring(0, 9) : '[SIREN non disponible]',
        '<entreprise_nsiret>': companyInfo?.nSiret || '[SIRET non disponible]',
        '<entreprise_adresse>': companyInfo?.address || '[Adresse entreprise non disponible]',
        '<entreprise_ville>': companyInfo?.city || '[Ville entreprise non disponible]',
        '<entreprise_pays>': companyInfo?.country || '[Pays entreprise non disponible]',
        '<entreprise_telephone>': companyInfo?.phone || '[Téléphone entreprise non disponible]',
        '<entreprise_email>': companyInfo?.email || '[Email entreprise non disponible]',
        '<entreprise_site_web>': companyInfo?.website || '[Site web entreprise non disponible]',
        '<entreprise_description>': companyInfo?.description || '[Description entreprise non disponible]',
        
        // Balises du chargé d'étude
        '<charge_email>': chargeData?.email || '',
        '<charge_phone>': chargeData?.phone || '',
      };

      let result = text;

      Object.entries(replacements).forEach(([tag, value]) => {
        const regex = new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const tempValue = tempDataOverride?.[tag.replace(/[<>]/g, '')];
        const finalValue = tempValue || value;
        result = result.replace(regex, finalValue);
      });

      // Vérifier s'il reste des balises non remplacées
      const remainingTags = result.match(/<[^>]+>/g);
      if (remainingTags) {
        remainingTags.forEach(tag => {
          const tagName = tag.replace(/[<>]/g, '');
          result = result.replace(tag, `[Information "${tagName}" non disponible]`);
        });
      }

      return result;
    } catch (error) {
      console.error('Erreur lors du remplacement des variables:', error);
      setSnackbar({
        open: true,
        message: 'Une erreur est survenue lors du remplacement des variables',
        severity: 'error'
      });
      return text;
    }
  };

  const escapeRegExp = (string: string): string => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // Fonction principale pour générer un document à partir d'un template assigné
  const generateDocument = async (
    documentType: DocumentType,
    studentId?: string,
    ignoreMissingData: boolean = false,
    forceDownload: boolean = false
  ) => {
    if (etude?.isArchived) {
      setSnackbar({
        open: true,
        message: 'Impossible de générer des documents pour une étude archivée',
        severity: 'error'
      });
      return;
    }
    
    // Protection contre les appels multiples
    if (generatingDoc) {
      console.log('⚠️ Génération déjà en cours, ignoré');
      return;
    }
    
    try {
      setGeneratingDoc(true);
      
      console.log('🚀 Début de la génération du document:', documentType);
      
      // 1. Récupérer l'assignation du template
      if (forceDownload) {
        setDownloadProgress({ progress: 50, message: 'Récupération du template...' });
      }
      console.log('📄 Récupération de l\'assignation du template...');
      const assignmentsRef = collection(db, 'templateAssignments');
      const assignmentQuery = query(
        assignmentsRef,
        where('documentType', '==', documentType),
        where('structureId', '==', etude.structureId)
      );
      
      const assignmentSnapshot = await getDocs(assignmentQuery);
      console.log('📄 Assignations trouvées:', assignmentSnapshot.size);
      
      if (assignmentSnapshot.empty) {
        throw new Error(`Aucun template assigné pour le type de document "${documentType}" et la structure "${etude.structureId}". Veuillez vérifier les assignations dans les paramètres.`);
      }

      // Supprimer l'ancien document s'il existe
      console.log('🗑️ Suppression des anciens documents...');
      const existingDocsQuery = query(
        collection(db, 'generatedDocuments'),
        where('etudeId', '==', etude.id || ''),
        where('documentType', '==', documentType)
      );
      const existingDocsSnapshot = await getDocs(existingDocsQuery);
      console.log('🗑️ Anciens documents trouvés:', existingDocsSnapshot.size);
      
      for (const doc of existingDocsSnapshot.docs) {
        const docData = doc.data();
        // Supprimer de Storage
        if (docData.fileUrl && storage) {
          const oldStorageRef = ref(storage, docData.fileUrl);
          try {
            await deleteObject(oldStorageRef);
            console.log('🗑️ Fichier supprimé de Storage:', docData.fileUrl);
          } catch (error) {
            console.error('Erreur lors de la suppression de l\'ancien fichier:', error);
          }
        }
        // Supprimer de Firestore
        await deleteDoc(doc.ref);
        console.log('🗑️ Document supprimé de Firestore:', doc.id);
      }

      const assignmentData = assignmentSnapshot.docs[0].data();
      const templateId = assignmentData.templateId;
      const generationType = assignmentData.generationType || 'template';
      console.log('📄 Template ID:', templateId);
      console.log('📄 Type de génération:', generationType);
      
      // Vérifier le type de génération
      if (generationType === 'editor') {
        console.log('📝 Type de génération: éditeur - redirection vers QuoteBuilder');
        // Rediriger vers l'éditeur (QuoteBuilder)
        const url = `/app/etude/${etude.numeroEtude}/quote?template=${templateId}`;
        navigate(url);
        setGeneratingDoc(false);
        return;
      }
      
      // 2. Récupérer le template avec cet ID
      if (forceDownload) {
        setDownloadProgress({ progress: 60, message: 'Chargement du template...' });
      }
      console.log('📄 Récupération du template...');
      const templateRef = doc(db, 'templates', templateId);
      const templateSnap = await getDoc(templateRef);
      
      if (!templateSnap.exists()) {
        throw new Error('Le template assigné n\'existe plus. Veuillez en assigner un nouveau.');
      }

      const templateData = templateSnap.data();
      const templatePdfUrl = templateData.pdfUrl;
      const templateVariables = (templateData.variables || []) as TemplateVariable[];
      console.log('📄 Template récupéré, variables:', templateVariables.length);

      // 3. Charger et modifier le PDF
      if (forceDownload) {
        setDownloadProgress({ progress: 70, message: 'Téléchargement du PDF...' });
      }
      console.log('📄 Chargement du PDF template...');
      console.log('📄 Template PDF URL:', templatePdfUrl);
      
      let pdfUrl;
      if (templatePdfUrl.startsWith('http')) {
        console.log('📄 URL directe détectée');
        pdfUrl = templatePdfUrl;
      } else {
        console.log('📄 Chemin Storage détecté, récupération de l\'URL');
        if (!storage) {
          throw new Error('Firebase Storage n\'est pas initialisé. Vérifiez la configuration Firebase.');
        }
        const storageRef = ref(storage, templatePdfUrl);
        pdfUrl = await getDownloadURL(storageRef);
      }
      
      console.log('📄 URL finale du PDF:', pdfUrl);
      const response = await fetch(pdfUrl);
      const pdfBlob = await response.blob();
      const pdfBytes = await pdfBlob.arrayBuffer();
      console.log('📄 PDF chargé, taille:', pdfBytes.byteLength);

      console.log('📄 Chargement du PDF dans PDFDocument...');
      const pdfDoc = await PDFDocument.load(pdfBytes);
      console.log('📄 PDFDocument chargé, pages:', pdfDoc.getPageCount());
      
      const helveticaFont = await pdfDoc.embedFont('Helvetica');
      const helveticaFontBold = await pdfDoc.embedFont('Helvetica-Bold');
      const pages = pdfDoc.getPages();
      console.log('📄 Polices chargées, pages récupérées');

      // 3.1. Récupérer toutes les données nécessaires en parallèle
      console.log('🏢 Récupération des données en parallèle...');
      const dataPromises: Promise<any>[] = [];
      
      // Structure
      let structureDataPromise: Promise<any> = Promise.resolve(null);
      if (etude.structureId) {
        structureDataPromise = getDoc(doc(db, 'structures', etude.structureId)).then(doc => {
          if (doc.exists()) {
            return { ...doc.data(), id: doc.id };
          }
          return null;
        });
        dataPromises.push(structureDataPromise);
      }
      
      // User data (si studentId)
      let userDataPromise: Promise<any> = Promise.resolve(null);
      if (studentId) {
        userDataPromise = getDoc(doc(db, 'users', studentId)).then(doc => {
          return doc.exists() ? doc.data() : null;
        });
        dataPromises.push(userDataPromise);
      }
      
      // Charge data
      const chargeDataPromise = getDoc(doc(db, 'users', etude.chargeId)).then(doc => {
        return doc.exists() ? doc.data() : null;
      });
      dataPromises.push(chargeDataPromise);
      
      // President data (si structureId)
      let presidentFullNamePromise: Promise<string | null> = Promise.resolve(null);
      if (etude.structureId) {
        presidentFullNamePromise = (async () => {
          try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('structureId', '==', etude.structureId));
            const usersSnapshot = await getDocs(q);
            
            let members = usersSnapshot.docs.map(docSnap => ({
              id: docSnap.id,
              ...docSnap.data(),
              mandat: docSnap.data().mandat || null,
              bureauRole: docSnap.data().bureauRole || null,
              poles: docSnap.data().poles || [],
              firstName: docSnap.data().firstName || '',
              lastName: docSnap.data().lastName || '',
              displayName: docSnap.data().displayName || ''
            }));

            const presidents = members.filter((member: any) => {
              const hasPresidentRole = member.bureauRole === 'president' || 
                member.poles?.some((p: any) => p.poleId === 'pre');
              return hasPresidentRole && member.mandat;
            });

            if (presidents.length > 0) {
              const sortedPresidents = presidents.sort((a, b) => {
                if (!a.mandat || !b.mandat) return 0;
                const aYear = parseInt(a.mandat.split('-')[0]);
                const bYear = parseInt(b.mandat.split('-')[0]);
                return bYear - aYear;
              });

              const mostRecentPresident = sortedPresidents[0];
              if (mostRecentPresident.firstName && mostRecentPresident.lastName) {
                return `${mostRecentPresident.firstName} ${mostRecentPresident.lastName}`.trim();
              } else if (mostRecentPresident.displayName) {
                return mostRecentPresident.displayName;
              }
            }
            return null;
          } catch (error) {
            console.error('Erreur lors de la récupération du président:', error);
            return null;
          }
        })();
        dataPromises.push(presidentFullNamePromise);
      }
      
      // Attendre toutes les requêtes en parallèle
      const [
        structureData,
        userData,
        chargeData,
        presidentFullName
      ] = await Promise.all([
        structureDataPromise,
        userDataPromise,
        chargeDataPromise,
        presidentFullNamePromise
      ]);

      const decryptedCtx = await prepareDecryptedDocumentContext({
        userId: studentId,
        userData,
        chargeId: etude.chargeId,
        chargeData,
        contactId: (contacts.find(c => c.isDefault) || contacts[0])?.id,
        contactData: (() => {
          const c = contacts.find(ct => ct.isDefault) || contacts[0];
          return c ? { ...c } : null;
        })(),
        companyId: companyFullData?.id,
        companyData: companyFullData,
        structureId: etude.structureId || structureFullData?.id,
        structureData: structureData ?? structureFullData,
      });

      console.log('✅ Toutes les données récupérées et déchiffrées en parallèle');

      // 4. Traiter chaque variable du template
      if (forceDownload) {
        setDownloadProgress({ progress: 80, message: 'Traitement des variables...' });
      }
      console.log('🔧 Traitement des variables du template...');
      const totalVariables = templateVariables.length;
      for (let i = 0; i < templateVariables.length; i++) {
        const variable = templateVariables[i];
        if (forceDownload && i % Math.max(1, Math.floor(totalVariables / 10)) === 0) {
          setDownloadProgress({ 
            progress: 80 + Math.floor((i / totalVariables) * 15), 
            message: `Traitement des variables (${i + 1}/${totalVariables})...` 
          });
        }
        
        const page = pages[variable.position.page - 1] || pages[0];
        const pageHeight = page.getHeight();

        try {
          // Obtenir la valeur de la variable
          let valueToReplace;
          if (variable.type === 'raw') {
            valueToReplace = variable.rawText || '';
          } else if (variable.variableId) {
            valueToReplace = getTagFromVariableId(variable.variableId);
          } else {
            valueToReplace = '';
          }

          const value = await replaceTags(valueToReplace, decryptedCtx.userData ?? userData, decryptedCtx.structureData ?? structureData, {}, {
            userData: decryptedCtx.userData ?? userData,
            chargeData: decryptedCtx.chargeData ?? chargeData,
            presidentFullName
          });

          if (value && value.trim()) {
            // Appliquer les styles et la position
            const fontSize = variable.fontSize || 12;
            const { x, y } = variable.position;
            const { width, height } = variable;
            const textAlign = variable.textAlign || 'left';
            const verticalAlign = variable.verticalAlign || 'top';
            const lineHeightMultiplier = variable.lineHeight || 1.2;

            // Découper le texte en lignes selon la largeur max
            const splitTextToLines = (text: string, font: any, fontSize: number, maxWidth: number) => {
              if (!text) return [];
              
              const paragraphs = text.split(/\r?\n/);
              const lines: string[] = [];
              
              paragraphs.forEach((paragraph, paragraphIndex) => {
                if (paragraphIndex > 0) {
                  lines.push('');
                }
                
                const words = paragraph.split(' ');
                let currentLine = '';
                
                for (let i = 0; i < words.length; i++) {
                  const testLine = currentLine ? currentLine + ' ' + words[i] : words[i];
                  const testWidth = font.widthOfTextAtSize(testLine, fontSize);
                  
                  if (testWidth > maxWidth && currentLine) {
                    lines.push(currentLine);
                    currentLine = words[i];
                  } else {
                    currentLine = testLine;
                  }
                }
                
                if (currentLine) {
                  lines.push(currentLine);
                }
              });
              
              return lines;
            };

            // Fonction pour nettoyer le texte des caractères non-encodables
            const cleanTextForPDF = (text: string): string => {
              if (!text) return '';
              return text
                .replace(/\u202F/g, ' ')
                .replace(/\u00A0/g, ' ')
                .replace(/\u2019/g, "'")
                .replace(/\u2018/g, "'")
                .replace(/\u201C/g, '"')
                .replace(/\u201D/g, '"')
                .replace(/\u2013/g, '-')
                .replace(/\u2014/g, '-')
                .replace(/\u2026/g, '...')
                .replace(/[^\x00-\x7F]/g, (char) => {
                  const charCode = char.charCodeAt(0);
                  if (charCode >= 0x00A0 && charCode <= 0x00FF) {
                    return char;
                  }
                  if (charCode === 0x20AC) {
                    return '€';
                  }
                  return ' ';
                });
            };

            const font = variable.isBold ? helveticaFontBold : helveticaFont;
            const cleanedValue = cleanTextForPDF(value);
            const lines = splitTextToLines(cleanedValue.trim(), font, fontSize, width);
            
            // Calculer la hauteur totale du texte
            const lineHeight = fontSize * lineHeightMultiplier;
            const totalTextHeight = lines.length * lineHeight;
            
            // Calculer la position Y de départ
            const verticalOffset = 4;
            let startY: number;
            
            if (verticalAlign === 'top') {
              startY = pageHeight - y - fontSize * 0.8 - verticalOffset;
            } else if (verticalAlign === 'bottom') {
              startY = pageHeight - y - height + fontSize * 0.8 + (totalTextHeight - lineHeight) - verticalOffset;
            } else {
              const verticalCenter = pageHeight - y - (height / 2);
              startY = verticalCenter + (totalTextHeight / 2) - lineHeight + (fontSize * 0.8) - verticalOffset;
            }

            const minY = pageHeight - y - height + fontSize * 0.5;
            const maxY = pageHeight - y - fontSize * 0.2;
            
            if (startY > maxY) {
              startY = maxY;
            }
            if (startY - (totalTextHeight - lineHeight) < minY) {
              startY = minY + (totalTextHeight - lineHeight);
            }

            // Dessiner chaque ligne
            let lineY = startY;
            for (let i = 0; i < lines.length; i++) {
              const line = cleanTextForPDF(lines[i]);
              
              if (line && line.trim()) {
                let xLine = x;
                const lineWidth = font.widthOfTextAtSize(line, fontSize);
                
                if (textAlign === 'center') {
                  xLine = x + (width - lineWidth) / 2;
                } else if (textAlign === 'right') {
                  xLine = x + width - lineWidth;
                }
                
                xLine = Math.max(x, Math.min(xLine, x + width - 1));
                
                try {
                  if (lineY >= minY && lineY <= maxY) {
                    page.drawText(line, {
                      x: xLine,
                      y: lineY,
                      size: fontSize,
                      font,
                      maxWidth: width
                    });
                  }
                } catch (drawError) {
                  const fallbackLine = line.replace(/[^\x20-\x7E]/g, ' ');
                  if (lineY >= minY && lineY <= maxY && fallbackLine.trim()) {
                    try {
                      page.drawText(fallbackLine, {
                        x: xLine,
                        y: lineY,
                        size: fontSize,
                        font,
                        maxWidth: width
                      });
                    } catch (fallbackError) {
                      console.error(`Impossible de dessiner la ligne ${i}:`, fallbackError);
                    }
                  }
                }
              }
              
              lineY -= lineHeight;
              
              if (lineY < minY) {
                break;
              }
            }
          }
        } catch (err) {
          console.error(`Erreur lors du traitement de la variable ${variable.name}:`, err);
        }
      }

      // 5. Sauvegarder le PDF modifié
      console.log('💾 Sauvegarde du PDF modifié...');
      const modifiedPdfBytes = await pdfDoc.save();
      console.log('💾 PDF sauvegardé, taille:', modifiedPdfBytes.byteLength);
      
      // Créer le nom du fichier avec décryptage des données utilisateur
      let fileName;
      if (documentType === 'convention_etude') {
        fileName = `CE_${etude.numeroEtude}.pdf`;
      } else if (documentType === 'recapitulatif_mission' && userData) {
        // Décrypter le nom de l'utilisateur pour le nom de fichier
        let decryptedDisplayName = userData.displayName;
        if (userData.displayName?.startsWith('ENC:') || userData.firstName?.startsWith('ENC:') || userData.lastName?.startsWith('ENC:')) {
          try {
            const userId = userData.id || studentId;
            if (userId) {
              const decrypted = await decryptUserDisplayData(userId, {
                displayName: userData.displayName,
                firstName: userData.firstName,
                lastName: userData.lastName
              });
              decryptedDisplayName = decrypted.displayName;
            }
          } catch (error) {
            console.warn('Erreur lors du décryptage pour le nom de fichier:', error);
          }
        }
        const nomFamille = decryptedDisplayName?.split(' ').pop()?.toUpperCase() || 'ETUDIANT';
        fileName = `RM_${nomFamille}_${etude.numeroEtude}.pdf`;
      } else if (documentType === 'proces_verbal_recette') {
        fileName = `PV_${etude.numeroEtude}.pdf`;
      } else if (documentType === 'rapport_pedagogique') {
        fileName = `RP_${etude.numeroEtude}.pdf`;
      } else {
        fileName = `${documentType}_${etude.numeroEtude}.pdf`;
      }
      console.log('📁 Nom du fichier:', fileName);

      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      
      // Si forceDownload est true, télécharger directement le PDF
      if (forceDownload) {
        setDownloadProgress({ progress: 95, message: 'Finalisation du téléchargement...' });
        console.log('📥 Téléchargement forcé du PDF...');
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(url), 100);
        
        console.log('✅ PDF téléchargé avec succès');
        setDownloadProgress({ progress: 100, message: 'Téléchargement terminé' });
        setTimeout(() => {
          setDownloadProgress(null);
        }, 500);
      }

      // Uploader le fichier modifié vers Storage
      console.log('☁️ Upload du fichier vers Storage...');
      let documentUrl;
      let uploadSucceeded = false;
      
      if (!storage) {
        console.warn('⚠️ Firebase Storage non disponible - génération du document en mode téléchargement uniquement');
        if (!forceDownload) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 100);
          setSnackbar({
            open: true,
            message: 'Document téléchargé avec succès (Storage non disponible)',
            severity: 'success'
          });
          return;
        }
      } else {
        try {
          const storagePath = `etudes/${etude.id}/documents/${fileName}`;
          const documentStorageRef = ref(storage, storagePath);
          const metadata = {
            contentType: 'application/pdf',
            customMetadata: {
              etudeId: etude.id || '',
              documentType: documentType,
              generatedAt: new Date().toISOString()
            }
          };
          await uploadBytes(documentStorageRef, blob, metadata);
          console.log('☁️ Fichier uploadé vers Storage');
          documentUrl = await getDownloadURL(documentStorageRef);
          console.log('☁️ URL du document:', documentUrl);
          uploadSucceeded = true;
        } catch (uploadError: any) {
          console.warn('⚠️ Erreur lors de l\'upload vers Storage:', uploadError);
          uploadSucceeded = false;
        }
      }

      // Préparer les tags
      const tags: string[] = [documentType];
      if (studentId) {
        tags.push('student_document');
      }

      // Créer le document dans Firestore (seulement si l'upload vers Storage a réussi)
      if (uploadSucceeded && documentUrl) {
        console.log('📊 Création du document dans Firestore...');
        const documentData = {
          etudeId: etude.id,
          etudeNumber: etude.numeroEtude,
          etudeTitle: etude.title || '',
          structureId: etude.structureId,
          documentType,
          fileName,
          fileUrl: documentUrl,
          fileSize: blob.size,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: currentUser?.uid || '',
          status: 'draft',
          isValid: true,
          tags,
          notes: studentId ? `Document généré pour ${userData?.displayName || 'étudiant'}` : 'Document généré'
        };

        if (studentId) {
          documentData.studentId = studentId;
          documentData.studentName = userData?.displayName || '';
          documentData.studentEmail = userData?.email || '';
        }

        const docRef = await addDoc(collection(db, 'generatedDocuments'), documentData);
        console.log('📊 Document créé dans Firestore, ID:', docRef.id);
      } else {
        console.log('⚠️ Document généré mais non sauvegardé (Storage non disponible)');
      }

      // Télécharger le document seulement si forceDownload n'est pas déjà fait
      if (!forceDownload) {
        console.log('⬇️ Téléchargement du document...');
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
      console.log('✅ Document téléchargé avec succès');

      setSnackbar({
        open: true,
        message: 'Document généré avec succès',
        severity: 'success'
      });
    } catch (error: unknown) {
      console.error('❌ Erreur lors de la génération du document:', error);
      setDownloadProgress(null);
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la génération du document';
      const isTemplateError = errorMessage.includes('Aucun template assigné') || errorMessage.includes("template assigné n'existe plus");
      setSnackbar({
        open: true,
        message: isTemplateError
          ? 'Aucun template assigné pour ce type de document.'
          : errorMessage,
        severity: 'error',
        ...(isTemplateError && {
          actionLabel: 'Assigner une template',
          actionUrl: '/app/settings/template-assignment'
        })
      });
      throw error;
    } finally {
      console.log('🏁 Fin de la génération du document');
      setGeneratingDoc(false);
      if (!forceDownload) {
        setDownloadProgress(null);
      }
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
      
      // Trouver le contact principal (isDefault = true) ou le premier contact disponible
      const mainContact = contacts.find(contact => contact.isDefault) || contacts[0];
      
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
      } else {
        console.warn('Aucun contact trouvé pour cette étude');
      }
      
      const url = `/app/etude/${etude.numeroEtude}/quote?${urlParams.toString()}`;
      navigate(url);
    } catch (error) {
      console.error('Erreur lors de l\'ouverture de la proposition commerciale:', error);
      navigate(`/app/etude/${etude.numeroEtude}/quote`);
    }
  };

  const loadAssociatedData = async (etudeId: string, structureId?: string) => {
    try {
      // Charger les tâches de planning
      const planningRef = collection(db, 'planningTasks');
      const planningQuery = query(planningRef, where('etudeId', '==', etudeId), limit(ASSOCIATED_QUERY_LIMIT));
      const planningSnapshot = await getDocs(planningQuery);
      const planningData = planningSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PlanningTask[];
      setPlanningTasks(planningData);

      // Charger les tâches de recrutement
      const recruitmentRef = collection(db, 'recruitmentTasks');
      const recruitmentQuery = query(recruitmentRef, where('etudeId', '==', etudeId), limit(ASSOCIATED_QUERY_LIMIT));
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
      }
      setRecruitedStudentsByTask(recruitedStudents);

      // Charger les postes de budget
      const budgetRef = collection(db, 'budgetItems');
      const budgetQuery = query(budgetRef, where('etudeId', '==', etudeId), limit(ASSOCIATED_QUERY_LIMIT));
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
      const documentsQuery = query(documentsRef, where('etudeId', '==', etudeId), limit(ASSOCIATED_QUERY_LIMIT));
      const documentsSnapshot = await getDocs(documentsQuery);
      const documentsData = documentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Document[];
      setDocuments(documentsData);

      // Charger les notes
      const notesRef = collection(db, 'etudeNotes');
      const notesQuery = query(notesRef, where('etudeId', '==', etudeId), limit(ASSOCIATED_QUERY_LIMIT));
      const notesSnapshot = await getDocs(notesQuery);
      const notesData = notesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EtudeNote[];
      setNotes(notesData);

      // Charger l'historique
      const historyRef = collection(db, 'etudeHistory');
      const historyQuery = query(historyRef, where('etudeId', '==', etudeId), limit(ASSOCIATED_QUERY_LIMIT));
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
          const contactsQuery = query(contactsRef, where('companyId', '==', etude.companyId), limit(ASSOCIATED_QUERY_LIMIT));
          const contactsSnapshot = await getDocs(contactsQuery);
          const contactsData = contactsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Contact[];
          setContacts(contactsData);
        } catch (error) {
          console.warn('Erreur lors du chargement des contacts via companyId:', error);
        }
      } else if (etude?.company && structureId) {
        // Si pas de companyId, essayer de trouver l'entreprise par nom (même structure uniquement)
        try {
          const companiesRef = collection(db, 'companies');
          const companiesQuery = query(
            companiesRef,
            where('name', '==', etude.company),
            where('structureId', '==', structureId)
          );
          const companiesSnapshot = await getDocs(companiesQuery);
          
          if (!companiesSnapshot.empty) {
            const companyDoc = companiesSnapshot.docs[0];
            const companyData = companyDoc.data();
            
            // Maintenant chercher les contacts avec l'ID de l'entreprise
            const contactsRef = collection(db, 'contacts');
            const contactsQuery = query(contactsRef, where('companyId', '==', companyDoc.id), limit(ASSOCIATED_QUERY_LIMIT));
            const contactsSnapshot = await getDocs(contactsQuery);
            const contactsData = contactsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Contact[];
            setContacts(contactsData);
          } else {
            setContacts([]);
          }
        } catch (error) {
          console.warn('Erreur lors du chargement des contacts via nom d\'entreprise:', error);
          setContacts([]);
        }
      } else {
        setContacts([]);
      }
    } catch (error: unknown) {
      console.error('Erreur lors du chargement des données associées:', error);
      const isPermissionDenied = error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'permission-denied';
      setSnackbar({
        open: true,
        message: isPermissionDenied
          ? 'Droits insuffisants pour afficher les données associées à cette étude.'
          : 'Erreur lors du chargement des données associées.',
        severity: 'error'
      });
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
      await loadAssociatedData(etude.id, etude.structureId);
      
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
        nSiret: ''
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
      nSiret: ''
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
        userName: getSafeDisplayName(userData) || currentUser.email || 'Utilisateur inconnu'
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
          userName: getSafeDisplayName(userData) || currentUser.email || 'Utilisateur inconnu',
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
      const noteData: Record<string, unknown> = {
        content: newNote.trim(),
        createdAt: new Date(),
        createdBy: currentUser.uid,
        createdByName: getSafeDisplayName(userData) || currentUser.email || 'Utilisateur inconnu',
        etudeId: etude.id,
        etudeNumber: etude.numeroEtude
      };
      if (currentUser.photoURL != null) {
        noteData.createdByPhotoURL = currentUser.photoURL;
      }

      await addDoc(collection(db, 'etudeNotes'), noteData);
      
      // Mettre à jour l'état local
      const newNoteEntry: EtudeNote = {
        id: crypto.randomUUID(),
        content: noteData.content as string,
        createdAt: noteData.createdAt as Date,
        createdBy: noteData.createdBy as string,
        createdByName: noteData.createdByName as string,
        createdByPhotoURL: (noteData.createdByPhotoURL as string) ?? undefined,
        etudeId: noteData.etudeId as string,
        etudeNumber: noteData.etudeNumber as string
      };
      setNotes(prev => [newNoteEntry, ...prev]);
      setNewNote('');

      await addHistoryEntry('Note ajoutée', `Nouvelle note ajoutée à l'étude ${etude.numeroEtude}`);

      setSnackbar({
        open: true,
        message: 'Note ajoutée avec succès',
        severity: 'success'
      });
    } catch (error: unknown) {
      console.error('Erreur lors de l\'ajout de la note:', error);
      const isPermissionDenied = error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'permission-denied';
      setSnackbar({
        open: true,
        message: isPermissionDenied ? 'Droits insuffisants pour ajouter une note.' : 'Erreur lors de l\'ajout de la note',
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

  const handleDocumentDownload = async (doc: Document) => {
    try {
      if (doc.url) {
        const link = window.document.createElement('a');
        link.href = doc.url;
        link.download = doc.name;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
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
        const docItem = documents.find(doc => doc.id === documentId);
        if (docItem?.url) {
          const link = window.document.createElement('a');
          link.href = docItem.url;
          link.download = docItem.name;
          window.document.body.appendChild(link);
          link.click();
          window.document.body.removeChild(link);
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
        // Lieu par défaut - utiliser la valeur du formulaire
        location: newRecruitmentTask.location || ''
      } as RecruitmentTask;


      const docRef = await addDoc(collection(db, 'recruitmentTasks'), taskData);
      
      // Créer la nouvelle tâche avec l'ID généré
      const newTaskWithId: RecruitmentTask = {
        id: docRef.id,
        ...taskData
      };

      // Mettre à jour l'état local immédiatement
      const updatedTasks = [...recruitmentTasks, newTaskWithId];
      setRecruitmentTasks(updatedTasks);
      
      // Synchroniser les postes de budget avec les nouvelles tâches
      await syncBudgetItemsFromRecruitmentTasksWithTasks(updatedTasks);
      
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
      
      // Mettre à jour l'état local
      const updatedTasks = recruitmentTasks.map(task => 
        task.id === editingRecruitmentTask.id ? editingRecruitmentTask : task
      );
      setRecruitmentTasks(updatedTasks);
      
      // Synchroniser les postes de budget avec les tâches mises à jour
      await syncBudgetItemsFromRecruitmentTasksWithTasks(updatedTasks);
      
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
      const task = recruitmentTasks.find(t => t.id === taskId);
      if (!task) {
        return;
      }

      // Supprimer la tâche de Firestore
      await deleteDoc(doc(db, 'recruitmentTasks', taskId));
      
      // Mettre à jour l'état local et synchroniser immédiatement
      const updatedTasks = recruitmentTasks.filter(t => t.id !== taskId);
      setRecruitmentTasks(updatedTasks);
      
      // Synchroniser les postes de budget avec les tâches restantes
      await syncBudgetItemsFromRecruitmentTasksWithTasks(updatedTasks);

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
      
      const allUsersRaw = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Array<{
        id: string;
        displayName?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        photoURL?: string;
      }>;

      const allUsers = await decryptUsersList(allUsersRaw);
      
      // Récupérer les candidatures existantes pour cette tâche (acceptées ou ajoutées manuellement)
      const applicationsRef = collection(db, 'applications');
      const applicationsQuery = query(
        applicationsRef, 
        where('missionId', '==', task.id),
        where('status', 'in', ['Acceptée', 'Ajouté manuellement'])
      );
      const applicationsSnapshot = await getDocs(applicationsQuery);
      
      const existingUserIds = applicationsSnapshot.docs.map(doc => doc.data().userId);
      
      // Filtrer les utilisateurs qui ne sont pas encore recrutés
      const availableUsers = allUsers.filter(user => !existingUserIds.includes(user.id));
      
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
          userDisplayName: getSafeDisplayName(student) || student.email?.split('@')[0] || 'Utilisateur',
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
            await loadAssociatedData(etude.id, etude.structureId);
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
        
        for (const bid of task.budgetItemIds) {
          if (!aggregate[bid]) aggregate[bid] = { required: 0, recruited: 0 };
          aggregate[bid].required += required;
          aggregate[bid].recruited += recruited;
        }
      }

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
          return { ...item, ...updates } as BudgetItem;
        } else {
          // Aucune tâche liée → réinitialiser les champs
          const updates: any = {
            studentsToRecruit: deleteField(),
            recruitedStudents: 0,
            recruitmentStatus: deleteField()
          };
          batch.update(doc(db, 'budgetItems', item.id), updates);
          return { ...item, studentsToRecruit: undefined, recruitedStudents: 0, recruitmentStatus: undefined } as BudgetItem;
        }
      });

      await batch.commit();
      setBudgetItems(updatedLocal);
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
      const applicationsRef = collection(db, 'applications');
      const q = query(
        applicationsRef,
        where('missionId', '==', taskId),
        where('status', 'in', ['Acceptée', 'Ajouté manuellement']),
        limit(ASSOCIATED_QUERY_LIMIT)
      );
      const snapshot = await getDocs(q);
      
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
          cvUpdatedAt: data.cvUpdatedAt && typeof data.cvUpdatedAt.toDate === 'function' ? data.cvUpdatedAt.toDate() : data.cvUpdatedAt,
          motivationLetter: data.motivationLetter,
          status: data.status,
          submittedAt: data.submittedAt && typeof data.submittedAt.toDate === 'function' ? data.submittedAt.toDate() : data.submittedAt || new Date(),
          updatedAt: data.updatedAt && typeof data.updatedAt.toDate === 'function' ? data.updatedAt.toDate() : data.updatedAt || new Date(),
          reviewedBy: data.reviewedBy,
          reviewedAt: data.reviewedAt && typeof data.reviewedAt.toDate === 'function' ? data.reviewedAt.toDate() : data.reviewedAt,
          reviewNotes: data.reviewNotes,
          addedManually: data.addedManually
        } as RecruitmentApplication;
      });
      
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
    if (!file || !etude?.id || !storage) return;

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `etudes/${etude.id}/documents/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const downloadUrl = await getDownloadURL(storageRef);

      const uploadedByName = getSafeDisplayName(userData) || currentUser?.email || 'Utilisateur';
      const documentPayload = {
        name: file.name,
        type: getFileType(file.name),
        url: downloadUrl,
        uploadedAt: new Date(),
        uploadedBy: currentUser?.uid || '',
        uploadedByName,
        size: file.size,
        etudeId: etude.id
      };

      const docRef = await addDoc(collection(db, 'documents'), documentPayload);

      const newDocument: Document = {
        id: docRef.id,
        name: file.name,
        type: getFileType(file.name),
        url: downloadUrl,
        uploadedAt: new Date(),
        uploadedBy: currentUser?.uid || '',
        uploadedByName,
        size: file.size
      };

      setDocuments([...documents, newDocument]);
      setDocumentDialogOpen(false);
      if (event.target) (event.target as HTMLInputElement).value = '';
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

  const formatDocumentUploadDate = (uploadedAt: Document['uploadedAt']): string => {
    if (!uploadedAt) return '—';
    const date = typeof uploadedAt === 'object' && uploadedAt !== null && 'toDate' in uploadedAt && typeof (uploadedAt as { toDate: () => Date }).toDate === 'function'
      ? (uploadedAt as { toDate: () => Date }).toDate()
      : uploadedAt instanceof Date
        ? uploadedAt
        : new Date(String(uploadedAt));
    return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Fonction utilitaire pour formater les dates de manière sécurisée
  const formatSafeDate = (date: any, options?: Intl.DateTimeFormatOptions): string => {
    if (!date) return 'Non définie';
    
    let dateObj: Date;
    
    // Si c'est déjà un objet Date
    if (date instanceof Date) {
      dateObj = date;
    }
    // Si c'est un Timestamp Firebase
    else if (date && typeof date.toDate === 'function') {
      dateObj = date.toDate();
    }
    // Si c'est une chaîne ou un nombre
    else if (typeof date === 'string' || typeof date === 'number') {
      dateObj = new Date(date);
    }
    // Sinon, essayer de le convertir
    else {
      try {
        dateObj = new Date(date);
      } catch {
        return 'Date invalide';
      }
    }
    
    // Vérifier si la date est valide
    if (isNaN(dateObj.getTime())) {
      return 'Date invalide';
    }
    
    return dateObj.toLocaleDateString('fr-FR', options || {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Fonction utilitaire pour formater l'heure de manière sécurisée
  const formatSafeTime = (date: any): string => {
    if (!date) return '';
    
    let dateObj: Date;
    
    if (date instanceof Date) {
      dateObj = date;
    } else if (date && typeof date.toDate === 'function') {
      dateObj = date.toDate();
    } else {
      try {
        dateObj = new Date(date);
      } catch {
        return '';
      }
    }
    
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    return dateObj.toLocaleTimeString('fr-FR');
  };

  // Couleurs pour les anciennes valeurs de statut (rétrocompatibilité)
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Négociation':
        return 'warning';
      case 'Recrutement':
        return 'info';
      case 'Date de mission':
        return 'primary';
      case 'Facturation':
        return 'primary';
      case 'Audit':
        return 'success';
      case 'Archivé':
        return 'default';
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

  // Nouveau workflow d'étapes JE
  const currentEtape: EtudeEtape = etude?.etape && ETUDE_ETAPE_ORDER.includes(etude.etape as EtudeEtape)
    ? (etude.etape as EtudeEtape)
    : statusToEtape((etude?.status || 'Négociation') as any);
  const currentEtapeIndex = ETUDE_ETAPE_ORDER.indexOf(currentEtape);
  const etapeProgress = ((currentEtapeIndex + 1) / ETUDE_ETAPE_ORDER.length) * 100;

  // Qualité checklist
  const qualityChecklist: QualityChecklist = etude?.qualityChecklist || {
    conventionSignee: false,
    assuranceVerifiee: false,
    pvRecetteObtenu: false,
    satisfactionEnvoyee: false,
    bvEmis: false,
    facturePayee: false,
    rapportPedagogiqueRedige: false,
  };
  const qualityItems = Object.entries(qualityChecklist);
  const qualityDone = qualityItems.filter(([, v]) => v).length;
  const qualityTotal = qualityItems.length;
  const qualityPercent = Math.round((qualityDone / qualityTotal) * 100);

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
        return tokens.colors.primary;
    }
  };

  const getBudgetItemColor = (color: string): string => {
    return color || tokens.colors.primary;
  };

  const availableColors = [
    tokens.colors.primary, // Bleu
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
      
      setQuickBudgetPosition({ x, y });
    } else {
      // Fallback : utiliser la position du clic avec un décalage vers le haut
      const x = event.clientX;
      const y = event.clientY - 100; // Décalage plus important vers le haut
      
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
    
    if (resizingBudgetItem) {
      // Récupérer les données mises à jour depuis l'état local
      const updatedItem = budgetItems.find(item => item.id === resizingBudgetItem.id);
      
      if (updatedItem) {
        // Sauvegarder directement les nouvelles dates dans Firestore
        const updateData = {
          startDate: updatedItem.startDate,
          endDate: updatedItem.endDate
        };
        
        const actionType = resizeType === 'move' ? 'déplacement' : 'redimensionnement';
        
        
        // Mettre à jour Firestore directement
        updateDoc(doc(db!, 'budgetItems', updatedItem.id), updateData)
          .then(() => {
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
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    
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
    
    setSelectionEnd(percentage);
    setMousePosition(percentage);
  };

  const handleTimelineMouseUp = (event: React.MouseEvent) => {
    if (!isSelectingRange) return;
    
    setIsSelectingRange(false);
    
    // Vérifier que la sélection a une largeur minimale
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    const width = end - start;
    
    
    if (width > 2) { // Au moins 2% de largeur
      // Convertir les pourcentages en dates
      const dates = convertPercentageToDates(start, end);
      
      if (dates && dates.startDate && dates.endDate) {
        // Créer un poste temporaire qui apparaîtra immédiatement
        const tempBudgetItem: BudgetItem = {
          id: `temp-${Date.now()}`,
          title: 'Nouveau poste',
          description: '',
          budget: 0,
          color: tokens.colors.primary,
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
          color: tokens.colors.primary,
          status: 'Planifié'
        });
        
        // Positionner la popup près de la sélection avec un petit décalage
        const x = event.clientX;
        const y = event.clientY - 50; // Décalage vers le haut pour éviter que la popup cache le curseur
        
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
          color: updatedItem.color || tokens.colors.primary,
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
          color: updatedItem.color || tokens.colors.primary,
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

  const tabCounts = useEtudeDetailTabs({
    recruitmentTasks,
    documents,
    avenants: (etude as EtudeData & { _avenants?: unknown[] })?._avenants,
  });

  const etudeTabIcons: Record<EtudeDetailTabId, React.ReactElement> = {
    overview: <DashboardIcon />,
    planning: <TimelineIcon />,
    recruitment: <PeopleIcon />,
    documents: <FolderIcon />,
    compliance: <CheckCircleIcon />,
  };

  const handleToggleEtudePublic = async (value: boolean) => {
    if (!etude?.id) return;
    try {
      await updateDoc(doc(db, 'etudes', etude.id), { isPublic: value, updatedAt: new Date() });
      setEtude({ ...etude, isPublic: value });
      setOriginalEtude((prev) => (prev ? { ...prev, isPublic: value } : prev));
    } catch (error) {
      console.error('Erreur mise à jour visibilité:', error);
    }
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        bgcolor: tokens.colors.bgSubtle
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress 
            size={60} 
            sx={{ 
              color: tokens.colors.primary,
              mb: 2,
              animation: `${pulse} 2s infinite`
            }} 
          />
          <Typography variant="h6" sx={{ color: tokens.colors.textPrimary, fontWeight: 500 }}>
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

  const updatedAtLabel = (() => {
    const raw = (etude as EtudeData & { updatedAt?: { toDate?: () => Date } | Date | string }).updatedAt ?? etude.createdAt;
    if (!raw) return undefined;
    const date = typeof (raw as { toDate?: () => Date }).toDate === 'function'
      ? (raw as { toDate: () => Date }).toDate()
      : new Date(raw as string | Date);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  })();

  return (
    <Box sx={dsPageCanvasSx}>
      <Box sx={{ ...dsDetailHeaderSx, px: { xs: 2, md: 4 }, pt: 2, pb: 0 }}>
        <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Button
              startIcon={<ChevronLeftIcon />}
              onClick={() => navigate('/app/etude')}
              sx={{ color: tokens.colors.textSecondary, textTransform: 'none' }}
            >
              Retour aux études
            </Button>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {editing ? (
                <>
                  <Button
                    size="small"
                    startIcon={<SaveIcon />}
                    variant="contained"
                    onClick={handleSave}
                    sx={{ textTransform: 'none' }}
                  >
                    Enregistrer
                  </Button>
                  <Button
                    size="small"
                    startIcon={<CancelIcon />}
                    variant="outlined"
                    onClick={handleCancel}
                    sx={{ textTransform: 'none' }}
                  >
                    Annuler
                  </Button>
                </>
              ) : (
                <Tooltip title="Modifier">
                  <IconButton onClick={() => setEditing(true)}><EditIcon /></IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
          <Typography component="h1" sx={{ fontSize: '1.25rem', fontWeight: 600, color: tokens.colors.gray900, mb: 1 }}>
            Étude #{etude.numeroEtude}
            {etude.isArchived && (
              <Chip label="Archivée" size="small" sx={{ ml: 1.5, verticalAlign: 'middle' }} />
            )}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
            <Chip
              label={etude.status}
              size="small"
              color={getStatusColor(etude.status) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
              sx={{ fontWeight: 600 }}
            />
            <Chip
              label={ETUDE_ETAPE_LABELS[currentEtape]}
              size="small"
              variant="outlined"
              sx={{
                fontWeight: 500,
                borderColor: ETUDE_ETAPE_COLORS[currentEtape],
                color: ETUDE_ETAPE_COLORS[currentEtape],
              }}
            />
            <LinearProgress
              variant="determinate"
              value={etapeProgress}
              sx={{
                flex: 1,
                minWidth: 120,
                maxWidth: 240,
                height: 6,
                borderRadius: 3,
                bgcolor: tokens.colors.gray100,
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  bgcolor: ETUDE_ETAPE_COLORS[currentEtape],
                },
              }}
            />
          </Box>
          <Tabs
            value={activeTab}
            onChange={(_, value: EtudeDetailTabId) => setActiveTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mt: 1, ...dsTabsSx }}
          >
            {ETUDE_DETAIL_TABS.map((tab) => {
              const count =
                tab.id === 'recruitment' ? tabCounts.recruitment
                  : tab.id === 'documents' ? tabCounts.documents
                    : tab.id === 'compliance' ? tabCounts.compliance
                      : null;
              return (
                <Tab
                  key={tab.id}
                  value={tab.id}
                  icon={etudeTabIcons[tab.id]}
                  iconPosition="start"
                  label={count != null && count > 0 ? `${tab.label} (${count})` : tab.label}
                />
              );
            })}
          </Tabs>
        </Box>
      </Box>

      <EtudeDetailShell
        sidebar={
          <EtudeDetailSidebarPanel
            numeroEtude={etude.numeroEtude}
            mandat={etude.mandat}
            missionTypeLabel={etude.missionTypeName || undefined}
            createdById={etude.createdBy}
            updatedAtLabel={updatedAtLabel}
            chargeId={etude.chargeId}
            chargeName={etude.chargeName}
            companyName={etude.company}
            companyLogo={etude.companyLogo}
            statusLabel={etude.status}
            etapeLabel={ETUDE_ETAPE_LABELS[currentEtape]}
            isPublic={etude.isPublic}
            onTogglePublic={(value) => void handleToggleEtudePublic(value)}
          />
        }
      >
        {activeTab === 'overview' && (
        <OverviewTab>
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
                  <Typography variant="h5" sx={{ fontWeight: 700, color: tokens.colors.textPrimary }}>
                    Informations générales
                  </Typography>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 2,
                      p: 2,
                      bgcolor: tokens.colors.bgDefault,
                      borderRadius: 2
                    }}>
                      <BusinessIcon sx={{ mr: 2, color: tokens.colors.primary, fontSize: 28 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
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
                                const companyConstraints = [where('name', '==', e.target.value)];
                                if (userStructureId) companyConstraints.push(where('structureId', '==', userStructureId));
                                const companyQuery = query(companiesRef, ...companyConstraints);
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
                                  borderColor: tokens.colors.primary
                                }
                              },
                              '&.Mui-focused': {
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: tokens.colors.primary
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
                            color: tokens.colors.primary,
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
                          color: tokens.colors.textPrimary, 
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
                      bgcolor: tokens.colors.bgDefault,
                      borderRadius: 2
                    }}>
                      <LocationIcon sx={{ mr: 2, color: tokens.colors.primary, fontSize: 28 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
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
                                borderColor: tokens.colors.primary
                              }
                            },
                            '&.Mui-focused': {
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: tokens.colors.primary
                              }
                            }
                          }
                        }}
                      />
                    ) : (
                      <Typography variant="body1" sx={{ fontWeight: 500, color: tokens.colors.textPrimary, pl: 2 }}>
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
                      bgcolor: tokens.colors.bgDefault,
                      borderRadius: 2
                    }}>
                      <CalendarIcon sx={{ mr: 2, color: tokens.colors.primary, fontSize: 28 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
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
                                  borderColor: tokens.colors.primary
                                }
                              },
                              '&.Mui-focused': {
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: tokens.colors.primary
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
                            color: tokens.colors.textSecondary,
                            '&:hover': {
                              borderColor: tokens.colors.textSecondary,
                              bgcolor: 'rgba(134, 134, 139, 0.04)'
                            }
                          }}
                        >
                          Effacer
                        </Button>
                      </Box>
                    ) : (
                      <Typography variant="body1" sx={{ fontWeight: 500, color: tokens.colors.textPrimary, pl: 2 }}>
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
                      bgcolor: tokens.colors.bgDefault,
                      borderRadius: 2
                    }}>
                      <CalendarIcon sx={{ mr: 2, color: tokens.colors.primary, fontSize: 28 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
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
                                  borderColor: etude.endDate && etude.startDate && etude.endDate < etude.startDate ? '#ff4757' : tokens.colors.primary
                                }
                              },
                              '&.Mui-focused': {
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: etude.endDate && etude.startDate && etude.endDate < etude.startDate ? '#ff4757' : tokens.colors.primary
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
                            color: tokens.colors.textSecondary,
                            '&:hover': {
                              borderColor: tokens.colors.textSecondary,
                              bgcolor: 'rgba(134, 134, 139, 0.04)'
                            }
                          }}
                        >
                          Effacer
                        </Button>
                      </Box>
                    ) : (
                      <Typography variant="body1" sx={{ fontWeight: 500, color: tokens.colors.textPrimary, pl: 2 }}>
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
                      bgcolor: tokens.colors.bgDefault,
                      borderRadius: 2
                    }}>
                      <AssignmentIcon sx={{ mr: 2, color: tokens.colors.primary, fontSize: 28 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
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
                                  borderColor: tokens.colors.primary
                                }
                              },
                              '&.Mui-focused': {
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: tokens.colors.primary
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
                            color: tokens.colors.primary,
                            fontWeight: 500
                          }}>
                            + Ajouter un nouveau type de mission
                          </MenuItem>
                        </Select>
                      </FormControl>
                    ) : (
                      <Typography variant="body1" sx={{ fontWeight: 500, color: tokens.colors.textPrimary, pl: 2 }}>
                        {etude.missionTypeName || 'Non défini'}
                      </Typography>
                    )}
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 2,
                      p: 2,
                      bgcolor: tokens.colors.bgDefault,
                      borderRadius: 2
                    }}>
                      <PowerSettingsNewIcon sx={{ mr: 2, color: tokens.colors.primary, fontSize: 28 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
                        Étape
                      </Typography>
                    </Box>
                    {editing ? (
                      <FormControl fullWidth>
                        <Select
                          value={currentEtape}
                          onChange={(e) => {
                            const newEtape = e.target.value as EtudeEtape;
                            setEtude({ ...etude, etape: newEtape, status: ETUDE_ETAPE_LABELS[newEtape] });
                          }}
                          displayEmpty
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                              '&:hover': {
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: tokens.colors.primary
                                }
                              },
                              '&.Mui-focused': {
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: tokens.colors.primary
                                }
                              }
                            }
                          }}
                        >
                          {ETUDE_ETAPE_ORDER.map((e) => (
                            <MenuItem key={e} value={e}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: ETUDE_ETAPE_COLORS[e] }} />
                                {ETUDE_ETAPE_LABELS[e]}
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      <Box sx={{ pl: 2, width: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Chip
                            size="small"
                            label={ETUDE_ETAPE_LABELS[currentEtape]}
                            sx={{
                              bgcolor: ETUDE_ETAPE_COLORS[currentEtape],
                              color: '#fff',
                              fontWeight: 600,
                            }}
                          />
                          <Typography variant="caption" sx={{ color: tokens.colors.textSecondary }}>
                            {currentEtapeIndex + 1}/{ETUDE_ETAPE_ORDER.length}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={etapeProgress}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            bgcolor: '#e0e0e0',
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 3,
                              bgcolor: ETUDE_ETAPE_COLORS[currentEtape],
                            },
                          }}
                        />
                      </Box>
                    )}
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      mb: 2,
                      p: 2,
                      bgcolor: tokens.colors.bgDefault,
                      borderRadius: 2
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <WorkHistoryIcon sx={{ mr: 2, color: tokens.colors.primary, fontSize: 28 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
                          Nombre de JEH / Heures
                        </Typography>
                      </Box>
                      {editing && (
                        <IconButton
                          onClick={(event) => setPricingMenuAnchor(event.currentTarget)}
                          sx={{
                            color: tokens.colors.textSecondary,
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
                                      borderColor: tokens.colors.primary
                                    }
                                  },
                                  '&.Mui-focused': {
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      borderColor: tokens.colors.primary
                                    }
                                  }
                                }
                              }}
                            />
                            <IconButton
                              onClick={() => setJehLinked(!jehLinked)}
                              sx={{
                                color: jehLinked ? tokens.colors.primary : tokens.colors.textSecondary,
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
                                      borderColor: tokens.colors.primary
                                    }
                                  },
                                  '&.Mui-focused': {
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      borderColor: tokens.colors.primary
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
                                    borderColor: tokens.colors.primary
                                  }
                                },
                                '&.Mui-focused': {
                                  '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: tokens.colors.primary
                                  }
                                }
                              }
                            }}
                          />
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body1" sx={{ fontWeight: 500, color: tokens.colors.textPrimary, pl: 2 }}>
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
                      bgcolor: tokens.colors.bgDefault,
                      borderRadius: 2
                    }}>
                      <DescriptionIcon sx={{ mr: 2, color: tokens.colors.primary, fontSize: 28 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
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
                                borderColor: tokens.colors.primary
                              }
                            },
                            '&.Mui-focused': {
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: tokens.colors.primary
                              }
                            }
                          }
                        }}
                      />
                    ) : (
                      <Typography variant="body1" sx={{ color: tokens.colors.textPrimary, pl: 2, lineHeight: 1.6 }}>
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
                      bgcolor: tokens.colors.bgDefault,
                      borderRadius: 2
                    }}>
                      <PersonIcon sx={{ mr: 2, color: tokens.colors.primary, fontSize: 28 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
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
                                chargeName: selectedCharges.map(c => getSafeDisplayName(c)).join(', '),
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
                                        bgcolor: tokens.colors.primary,
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
                                    borderColor: tokens.colors.primary
                                  }
                                },
                                '&.Mui-focused': {
                                  '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: tokens.colors.primary
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
                                <PersonRow
                                  key={chargeId}
                                  userId={chargeId}
                                  name={charge?.displayName}
                                  subtitle={undefined}
                                />
                              );
                            })}
                          </Box>
                        ) : (
                          <PersonRow userId={etude.chargeId} name={etude.chargeName} />
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
                    color: pricingType === 'jeh' ? tokens.colors.primary : tokens.colors.textPrimary,
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
                        bgcolor: tokens.colors.primary 
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
                    color: pricingType === 'hourly' ? tokens.colors.primary : tokens.colors.textPrimary,
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
                        bgcolor: tokens.colors.primary 
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
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: tokens.colors.textPrimary }}>
                    Historique
                  </Typography>
                  
                  <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    {historyEntries.map((entry, index) => (
                      <Box 
                        key={entry.id} 
                        sx={{ 
                          mb: 2, 
                          p: 2, 
                          bgcolor: tokens.colors.bgDefault, 
                          borderRadius: 2,
                          animation: `${fadeInUp} 0.6s ease-out ${index * 0.1}s both`
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: tokens.colors.textPrimary, mb: 0.5 }}>
                          {entry.action}
                        </Typography>
                        <Typography variant="body2" sx={{ color: tokens.colors.textSecondary, mb: 1 }}>
                          {entry.details}
                        </Typography>
                        
                        {/* Affichage des modifications détaillées */}
                        {entry.modifications && entry.modifications.length > 0 && (
                          <Box sx={{ mb: 1, pl: 1, borderLeft: `3px solid ${tokens.colors.brandTeal}` }}>
                            {entry.modifications.map((modification, modIndex) => (
                              <Typography 
                                key={modIndex} 
                                variant="body2" 
                                sx={{ 
                                  color: tokens.colors.textPrimary, 
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
                                    bgcolor: tokens.colors.primary,
                                    flexShrink: 0
                                  }} 
                                />
                                {modification}
                              </Typography>
                            ))}
                          </Box>
                        )}
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: tokens.colors.textSecondary }}>
                            {formatSafeDate(entry.date, {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Typography>
                          <UserReferenceText
                            userId={entry.userId}
                            name={entry.userName}
                            fallback="Utilisateur"
                            variant="caption"
                            sx={{ color: tokens.colors.primary, fontWeight: 500 }}
                          />
                        </Box>
                      </Box>
                    ))}
                    {historyEntries.length === 0 && (
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>
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
                    <Typography variant="h6" sx={{ fontWeight: 700, color: tokens.colors.textPrimary }}>
                      Notes
                    </Typography>
                    <Button
                      startIcon={<AddIcon />}
                      onClick={() => setNoteDialogOpen(true)}
                      variant="outlined"
                      size="small"
                      sx={{ 
                        borderColor: tokens.colors.primary,
                        color: tokens.colors.primary,
                        '&:hover': { 
                          borderColor: tokens.colors.primaryDark,
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
                          bgcolor: tokens.colors.bgDefault, 
                          borderRadius: 2,
                          animation: `${fadeInUp} 0.6s ease-out ${index * 0.1}s both`
                        }}
                      >
                        <Typography variant="body2" sx={{ color: tokens.colors.textPrimary, mb: 1, lineHeight: 1.5 }}>
                          {note.content}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: tokens.colors.textSecondary }}>
                            {formatSafeDate(note.createdAt, {
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
                              color: tokens.colors.textSecondary,
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
                        <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>
                          Aucune note
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </OverviewTab>
        )}

        {activeTab === 'planning' && (
        <PlanningTab>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: tokens.colors.textPrimary }}>
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
                  <Typography variant="h5" sx={{ fontWeight: 700, color: tokens.colors.textPrimary }}>
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
                        bgcolor: tokens.colors.primary,
                        color: 'white',
                        borderRadius: 2,
                        px: 2,
                        py: 0.5,
                        fontSize: '0.875rem',
                        textTransform: 'none',
                        '&:hover': { bgcolor: tokens.colors.primaryDark }
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
                            color: maxWeeks <= Math.max(4, getMinRequiredWeeks()) ? '#d2d2d7' : tokens.colors.primary,
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
                          color: tokens.colors.textSecondary, 
                          fontSize: '0.7rem',
                          fontWeight: 500
                        }}>
                          semaines
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => setMaxWeeks(prev => prev + 1)}
                          sx={{ 
                            color: tokens.colors.primary,
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
                            color: timelineZoom <= 0.25 ? '#d2d2d7' : tokens.colors.primary,
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
                            color: tokens.colors.textSecondary, 
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
                            color: timelineZoom >= 3 ? '#d2d2d7' : tokens.colors.primary,
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
                      <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
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
                            color: tokens.colors.textSecondary,
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
                              color: tokens.colors.textPrimary,
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
                            color: tokens.colors.textSecondary,
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
                              borderColor: tokens.colors.primary,
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
                                border: `2px solid ${tokens.colors.brandTeal}`,
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
                              color: tokens.colors.textSecondary,
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
                          color: tokens.colors.textSecondary
                        }}>
                          <CalendarMonthIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                          <Typography variant="h6" sx={{ mb: 1, fontWeight: 500 }}>
                            Aucun poste de budget
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 2 }}>
                            Commencez par ajouter votre premier poste de budget
                          </Typography>
                          <Typography variant="caption" sx={{ 
                            color: tokens.colors.primary,
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
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: tokens.colors.textPrimary }}>
                    Montant total
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 800, color: tokens.colors.primary, mb: 2 }}>
                    {calculateTotalBudget().toFixed(2)} € HT
                  </Typography>
                  
                  {/* Barre de progression marge vs rémunération */}
                  <Box sx={{ mt: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="caption" sx={{ color: tokens.colors.primary, fontWeight: 600 }}>
                        Marge: {calculateMargin().toFixed(2)}€
                      </Typography>
                      <Typography variant="caption" sx={{ color: tokens.colors.textSecondary, fontWeight: 500 }}>
                        Rémunération: {calculateTotalRemunerationCost().toFixed(2)}€ ({calculateRemunerationPercentage().toFixed(1)}%)
                      </Typography>
                    </Box>
                    
                    <Box sx={{ 
                      width: '100%', 
                      height: 8, 
                      bgcolor: tokens.colors.borderLight, 
                      borderRadius: 4,
                      overflow: 'hidden',
                      position: 'relative'
                    }}>
                      <Box sx={{ 
                        width: `${100 - calculateRemunerationPercentage()}%`,
                        height: '100%',
                        bgcolor: tokens.colors.primary,
                        borderRadius: 4,
                        transition: 'width 0.3s ease-in-out'
                      }} />
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                      <Typography variant="caption" sx={{ color: tokens.colors.primary, fontWeight: 600 }}>
                        Marge {(100 - calculateRemunerationPercentage()).toFixed(1)}%
                      </Typography>
                      <Typography variant="caption" sx={{ color: tokens.colors.textSecondary, fontWeight: 600 }}>
                        Coût {calculateRemunerationPercentage().toFixed(1)}%
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </PlanningTab>
        )}

        {activeTab === 'recruitment' && (
        <RecruitmentTab>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: tokens.colors.textPrimary }}>
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
                bgcolor: tokens.colors.primary,
                '&:hover': { bgcolor: tokens.colors.primaryDark },
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
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: tokens.colors.textPrimary }}>
                  Tâches de recrutement
                </Typography>
                {/* Postes de budget intégrés */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: tokens.colors.textPrimary }}>
                    Postes de budget
                  </Typography>
                  {budgetItems.length > 0 ? (
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow sx={{ bgcolor: tokens.colors.bgDefault }}>
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
                                  bgcolor: tokens.colors.bgDefault,
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
                                        color: tokens.colors.primary,
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                          color: tokens.colors.primaryDark,
                                          backgroundColor: 'rgba(102, 126, 234, 0.1)',
                                          borderRadius: '4px',
                                          padding: '2px 4px',
                                          margin: '-2px -4px'
                                        }
                                      }}
                                      onClick={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        // Message temporaire pour confirmer que le clic fonctionne
                                        // Récupérer les étudiants recrutés pour ce poste de budget
                                        const recruitedStudents: RecruitmentApplication[] = [];
                                        
                                        // Trouver les tâches liées à ce poste de budget
                                        const linkedTasks = recruitmentTasks.filter(task => 
                                          task.budgetItemIds && task.budgetItemIds.includes(item.id)
                                        );
                                        
                                        
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
                                        
                                        
                                        // Toujours ouvrir la boîte de dialogue, même si elle est vide
                                        handleOpenRecruitedStudents(recruitedStudents, `Étudiants recrutés - ${item.title}`);
                                      }}
                                    >
                                      {(item.recruitedStudents ?? 0)}/{item.studentsToRecruit} étudiants
                                    </Typography>
                                    {item.linkedBudgetItems && item.linkedBudgetItems.length > 0 && (
                                      <Chip 
                                        label={`Lié à ${item.linkedBudgetItems.length} poste(s)`}
                                        size="small"
                                        sx={{ 
                                          bgcolor: tokens.colors.primary,
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
                      <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>
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
                          bgcolor: tokens.colors.bgDefault,
                          borderRadius: 2,
                          cursor: 'pointer'
                        }
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ 
                          bgcolor: tokens.colors.primary,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                        }}>
                          <PeopleIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
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
                          <Box component="span">
                            <span style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '0.875rem', display: 'block', marginBottom: '8px' }}>
                              {task.description}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                              <span style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '0.75rem' }}>
                                {task.remuneration}€ HT
                              </span>
                              <span style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '0.75rem' }}>
                                {task.duration}h
                              </span>
                              {task.location && (
                                <span style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '0.75rem' }}>
                                  📍 {task.location}
                                </span>
                              )}
                              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '0.75rem' }}>
                                  {applicationsCounts[task.id] || 0} candidatures
                                </span>
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
                              </span>
                              {task.linkedRecruitment && task.budgetItemIds && task.budgetItemIds.length > 0 && (
                                <span style={{ 
                                  backgroundColor: tokens.colors.primary,
                                  color: 'white',
                                  fontSize: '0.7rem',
                                  padding: '2px 8px',
                                  borderRadius: tokens.radius.md,
                                  display: 'inline-block'
                                }}>
                                  Lié à {task.budgetItemIds.length} poste(s) de budget
                                </span>
                              )}
                              {typeof task.studentsToRecruit === 'number' && (
                                <span 
                                  style={{ 
                                    color: tokens.colors.primary, 
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    fontSize: '0.75rem',
                                    transition: 'all 0.2s ease'
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Message temporaire pour confirmer que le clic fonctionne
                                    
                                    // Charger les données si elles ne sont pas disponibles
                                    if (!recruitedStudentsByTask[task.id]) {
                                      getRecruitedStudentsForTask(task.id).then(students => {
                                        setRecruitedStudentsByTask(prev => ({
                                          ...prev,
                                          [task.id]: students
                                        }));
                                        // Toujours ouvrir la boîte de dialogue, même si elle est vide
                                        handleOpenRecruitedStudents(students, `Étudiants recrutés - ${task.title}`);
                                      });
                                    } else {
                                      // Toujours ouvrir la boîte de dialogue, même si elle est vide
                                      handleOpenRecruitedStudents(recruitedStudentsByTask[task.id], `Étudiants recrutés - ${task.title}`);
                                    }
                                  }}
                                >
                                  {task.recruitedStudents || 0}/{task.studentsToRecruit} étudiants recrutés
                                </span>
                              )}
                            </span>
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
                              bgcolor: task.isPublished ? 'transparent' : tokens.colors.primary,
                              color: task.isPublished ? tokens.colors.primary : 'white',
                              borderColor: task.isPublished ? tokens.colors.primary : 'transparent',
                              '&:hover': {
                                bgcolor: task.isPublished ? 'rgba(102, 126, 234, 0.04)' : tokens.colors.primaryDark,
                                borderColor: task.isPublished ? tokens.colors.primaryDark : 'transparent'
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
                                color: tokens.colors.primary,
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
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: tokens.colors.textPrimary }}>
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
        </RecruitmentTab>
        )}

        {activeTab === 'documents' && (
        <DocumentsTab>
          {structureFullData?.structureType === 'junior' ? (
            // Workflow spécialisé pour les Junior-Entreprises
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: tokens.colors.textPrimary }}>
                  Documents - Workflow Projet
                </Typography>
                <Button
                  startIcon={<UploadIcon />}
                  onClick={() => setDocumentDialogOpen(true)}
                  variant="outlined"
                  sx={{ 
                    borderColor: tokens.colors.primary,
                    color: tokens.colors.primary,
                    '&:hover': { 
                      borderColor: tokens.colors.primaryDark,
                      bgcolor: 'rgba(102, 126, 234, 0.04)'
                    }
                  }}
                >
                  Upload Document
                </Button>
              </Box>

              {/* Étape 1 : Avant-Vente */}
              <Accordion defaultExpanded sx={{ mb: 2, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                    <Box sx={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: '50%', 
                      bgcolor: tokens.colors.primary, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 700
                    }}>
                      1
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
                        Avant-Vente
                      </Typography>
                      <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>
                        Proposition commerciale et convention d'étude
                      </Typography>
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={3}>
                    <Card variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Proposition Commerciale
                          </Typography>
                          <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>
                            Document de présentation (PPTX/PDF externe)
                          </Typography>
                        </Box>
                        <Button
                          startIcon={<FileUploadIcon />}
                          onClick={() => setDocumentDialogOpen(true)}
                          variant="outlined"
                          size="small"
                        >
                          Uploader
                        </Button>
                      </Box>
                    </Card>
                    <Card variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Convention d'Étude
                          </Typography>
                          <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>
                            Génération automatique via template
                          </Typography>
                        </Box>
                        <Button
                          startIcon={<PlayArrowIcon />}
                          onClick={() => generateDocument('convention_etude', undefined, false, false)}
                          variant="contained"
                          size="small"
                          sx={{ bgcolor: tokens.colors.primary }}
                          disabled={generatingDoc}
                        >
                          {generatingDoc ? 'Génération...' : 'Générer'}
                        </Button>
                      </Box>
                    </Card>
                  </Stack>
                </AccordionDetails>
              </Accordion>

              {/* Étape 2 : Recrutement & Staffing */}
              <Accordion defaultExpanded sx={{ mb: 2, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                    <Box sx={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: '50%', 
                      bgcolor: '#4CAF50', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 700
                    }}>
                      2
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
                        Recrutement & Staffing
                      </Typography>
                      <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>
                        Récapitulatifs de mission pour les étudiants staffés
                      </Typography>
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                      Étudiants staffés sur l'étude
                    </Typography>
                    {recruitmentTasks.length === 0 ? (
                      <Alert severity="info">
                        Aucune tâche de recrutement trouvée. Créez d'abord des tâches de recrutement dans l'onglet Recrutement.
                      </Alert>
                    ) : (
                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Étudiant</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Tâche</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>JEH</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {recruitmentTasks.flatMap(task => 
                              (recruitedStudentsByTask[task.id] || []).map((student, idx) => (
                                <TableRow key={`${task.id}-${student.id}-${idx}`}>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Avatar src={student.userPhotoURL || undefined} sx={{ width: 32, height: 32 }}>
                                        <RecruitmentUserAvatar
                                          userId={student.userId}
                                          displayName={student.userDisplayName}
                                          email={student.userEmail}
                                        />
                                      </Avatar>
                                      <RecruitmentUserName
                                        userId={student.userId}
                                        displayName={student.userDisplayName}
                                        email={student.userEmail}
                                      />
                                    </Box>
                                  </TableCell>
                                  <TableCell>{task.title}</TableCell>
                                  <TableCell>
                                    {budgetItems
                                      .filter(bi => task.budgetItemIds?.includes(bi.id))
                                      .reduce((sum, bi) => sum + (bi.jehCount || 0), 0).toFixed(1)} JEH
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      startIcon={<DescriptionIconJE />}
                                      onClick={() => generateDocument('recapitulatif_mission', student.userId, false, false)}
                                      variant="outlined"
                                      size="small"
                                      disabled={generatingDoc}
                                    >
                                      {generatingDoc ? 'Génération...' : 'Générer RM'}
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                            {recruitmentTasks.every(task => !recruitedStudentsByTask[task.id] || recruitedStudentsByTask[task.id].length === 0) && (
                              <TableRow>
                                <TableCell colSpan={4} sx={{ textAlign: 'center', py: 3 }}>
                                  <PeopleIcon sx={{ fontSize: 48, color: '#d2d2d7', mb: 1 }} />
                                  <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>
                                    Aucun étudiant recruté pour le moment
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>

              {/* Étape 3 : Suivi & Clôture */}
              <Accordion defaultExpanded sx={{ mb: 2, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                    <Box sx={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: '50%', 
                      bgcolor: '#FF9800', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 700
                    }}>
                      3
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
                        Suivi & Clôture
                      </Typography>
                      <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>
                        PV de recette et rapport pédagogique
                      </Typography>
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <Card variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                            PV de Recette Finale
                          </Typography>
                          <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>
                            Déclenche la facturation du solde
                          </Typography>
                        </Box>
                        <Button
                          startIcon={<CheckCircleIcon />}
                          onClick={() => generateDocument('proces_verbal_recette', undefined, false, false)}
                          variant="contained"
                          size="small"
                          sx={{ bgcolor: '#FF9800' }}
                          disabled={generatingDoc}
                        >
                          {generatingDoc ? 'Génération...' : 'Générer PV'}
                        </Button>
                      </Box>
                    </Card>
                    <Card variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Rapport Pédagogique
                          </Typography>
                          <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>
                            Bilan pédagogique de l'étude
                          </Typography>
                        </Box>
                        <Button
                          startIcon={<SchoolIcon />}
                          onClick={() => generateDocument('rapport_pedagogique', undefined, false, false)}
                          variant="outlined"
                          size="small"
                          disabled={generatingDoc}
                        >
                          {generatingDoc ? 'Génération...' : 'Générer'}
                        </Button>
                      </Box>
                    </Card>
                  </Stack>
                </AccordionDetails>
              </Accordion>

              {/* Liste des documents existants */}
              {documents.length > 0 && (
                <Paper sx={{ mt: 3, p: 3, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                    Documents uploadés
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Nom</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {documents.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell>{doc.name}</TableCell>
                            <TableCell>
                              {formatDocumentUploadDate(doc.uploadedAt)}
                            </TableCell>
                            <TableCell>
                              <IconButton size="small" onClick={() => handleDocumentPreview(doc)}>
                                <VisibilityIcon />
                              </IconButton>
                              <IconButton size="small" onClick={() => handleDocumentDownload(doc)}>
                                <DownloadIcon />
                              </IconButton>
                              <IconButton size="small" color="error" onClick={() => handleDocumentDelete(doc.id)}>
                                <DeleteIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}
            </Box>
          ) : (
            // Workflow classique pour les Job Services
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: tokens.colors.textPrimary }}>
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
                    startIcon={<AutoIcon />}
                    onClick={handleOpenDocumentGenerator}
                    variant="outlined"
                    sx={{ 
                      borderColor: tokens.colors.primary,
                      color: tokens.colors.primary,
                      '&:hover': { 
                        borderColor: tokens.colors.primaryDark,
                        bgcolor: 'rgba(102, 126, 234, 0.04)'
                      }
                    }}
                  >
                    Générateur intelligent
                  </Button>
                  <Button
                    startIcon={<UploadIcon />}
                    onClick={() => setDocumentDialogOpen(true)}
                    variant="contained"
                    sx={{ 
                      bgcolor: tokens.colors.primary,
                      '&:hover': { bgcolor: tokens.colors.primaryDark }
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
                  <Typography variant="h5" sx={{ fontWeight: 700, color: tokens.colors.textPrimary }}>
                    Documents de la mission
                  </Typography>
                  {selectedDocuments.length > 0 && (
                    <Typography variant="body2" sx={{ color: tokens.colors.primary, fontWeight: 500 }}>
                      {selectedDocuments.length} document(s) sélectionné(s)
                    </Typography>
                  )}
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: tokens.colors.bgDefault }}>
                        <TableCell sx={{ fontWeight: 600, width: '50px' }}>
                          <Checkbox
                            checked={selectAllDocuments}
                            indeterminate={selectedDocuments.length > 0 && selectedDocuments.length < documents.length}
                            onChange={(e) => handleSelectAllDocuments(e.target.checked)}
                            sx={{ 
                              color: tokens.colors.primary,
                              '&.Mui-checked': { color: tokens.colors.primary }
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
                            '&:hover': { bgcolor: tokens.colors.bgDefault },
                            bgcolor: doc.isDraft ? 'rgba(255, 193, 7, 0.05)' : 'transparent'
                          }}
                        >
                          <TableCell sx={{ width: '50px' }}>
                            <Checkbox
                              checked={selectedDocuments.includes(doc.id)}
                              onChange={(e) => handleDocumentSelectionChange(doc.id, e.target.checked)}
                              sx={{ 
                                color: tokens.colors.primary,
                                '&.Mui-checked': { color: tokens.colors.primary }
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
                                  Par:{' '}
                                  <UserReferenceText
                                    component="span"
                                    userId={doc.uploadedBy}
                                    name={doc.uploadedByName}
                                    fallback="Utilisateur"
                                    variant="caption"
                                    sx={{ color: '#8E8E93', fontSize: '0.7rem' }}
                                  />
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            {formatDocumentUploadDate(doc.uploadedAt)}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              {!doc.isDraft && (
                                <Tooltip title="Aperçu">
                                  <IconButton 
                                    size="small" 
                                    sx={{ color: tokens.colors.primary }}
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
                            <Typography variant="h6" sx={{ color: tokens.colors.textSecondary, mb: 1 }}>
                              Aucun document disponible
                            </Typography>
                            <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>
                              Commencez par créer une proposition commerciale ou uploader un document
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Box>
          )}
        </DocumentsTab>
        )}

        {activeTab === 'compliance' && (
        <ComplianceTab>
        {/* Avenants */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: tokens.colors.textPrimary }}>
                Avenants
              </Typography>
              {editing && (
                <Button
                  startIcon={<AddIcon />}
                  variant="contained"
                  onClick={async () => {
                    if (!etude?.id) return;
                    try {
                      const existingAvenants = await getAvenants(etude.id);
                      const newAvenant: Omit<Avenant, 'id'> = {
                        etudeId: etude.id,
                        numero: existingAvenants.length + 1,
                        raison: '',
                        status: 'brouillon',
                        modifications: {},
                        createdAt: new Date(),
                        createdBy: currentUser?.uid || '',
                        createdByName: getSafeDisplayName(userData),
                      };
                      await addAvenant(etude.id, newAvenant);
                      // Refresh
                      const updated = await getAvenants(etude.id);
                      setEtude({ ...etude, _avenants: updated } as any);
                    } catch (err) {
                      console.error('Erreur création avenant:', err);
                    }
                  }}
                  sx={{
                    bgcolor: tokens.colors.primary,
                    '&:hover': { bgcolor: tokens.colors.primaryDark },
                    borderRadius: 2,
                  }}
                >
                  Nouvel avenant
                </Button>
              )}
            </Box>

            {(etude as any)?._avenants?.length > 0 ? (
              (etude as any)._avenants.map((av: Avenant) => (
                <Paper key={av.id} sx={{ p: 3, mb: 2, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Avenant n°{av.numero}
                    </Typography>
                    <Chip
                      size="small"
                      label={
                        av.status === 'brouillon' ? 'Brouillon' :
                        av.status === 'en_validation' ? 'En validation' :
                        av.status === 'signe' ? 'Signé' : 'Refusé'
                      }
                      color={
                        av.status === 'signe' ? 'success' :
                        av.status === 'refuse' ? 'error' :
                        av.status === 'en_validation' ? 'warning' : 'default'
                      }
                    />
                  </Box>
                  <Typography variant="body2" sx={{ color: tokens.colors.textSecondary, mb: 1 }}>
                    Raison : {av.raison || 'Non renseignée'}
                  </Typography>
                  {av.modifications.budget && (
                    <Typography variant="body2">
                      Budget : {av.modifications.budget.avant}€ → {av.modifications.budget.apres}€
                    </Typography>
                  )}
                  {av.modifications.jehTotal && (
                    <Typography variant="body2">
                      JEH : {av.modifications.jehTotal.avant} → {av.modifications.jehTotal.apres}
                    </Typography>
                  )}
                  {av.modifications.duree && (
                    <Typography variant="body2">
                      Durée prolongée jusqu'au {new Date(av.modifications.duree.dateFinApres).toLocaleDateString('fr-FR')}
                    </Typography>
                  )}
                  <Typography variant="caption" sx={{ color: tokens.colors.textSecondary, mt: 1, display: 'block' }}>
                    Créé le {av.createdAt instanceof Date ? av.createdAt.toLocaleDateString('fr-FR') : new Date(av.createdAt).toLocaleDateString('fr-FR')} par{' '}
                    <UserReferenceText
                      component="span"
                      userId={av.createdBy}
                      name={av.createdByName}
                      fallback="Utilisateur"
                      variant="caption"
                      sx={{ color: tokens.colors.textSecondary }}
                    />
                  </Typography>
                </Paper>
              ))
            ) : (
              <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, bgcolor: tokens.colors.bgDefault }}>
                <AssignmentIcon sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
                <Typography variant="body1" sx={{ color: tokens.colors.textSecondary }}>
                  Aucun avenant pour cette étude
                </Typography>
                <Typography variant="body2" sx={{ color: '#b0b0b0', mt: 1 }}>
                  Les avenants permettent de modifier les conditions d'une convention d'étude signée
                </Typography>
              </Paper>
            )}
          </Box>

        {/* Qualité */}
          <Grid container spacing={3}>
            {/* Checklist Qualité */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: tokens.colors.textPrimary }}>
                    Checklist qualité
                  </Typography>
                  <Chip
                    size="small"
                    label={`${qualityPercent}%`}
                    sx={{
                      bgcolor: qualityPercent === 100 ? '#4CAF50' : qualityPercent >= 50 ? '#FF9800' : '#f44336',
                      color: '#fff',
                      fontWeight: 700,
                    }}
                  />
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={qualityPercent}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    mb: 3,
                    bgcolor: '#e0e0e0',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 4,
                      bgcolor: qualityPercent === 100 ? '#4CAF50' : qualityPercent >= 50 ? '#FF9800' : '#f44336',
                    },
                  }}
                />
                {[
                  { key: 'conventionSignee', label: 'Convention d\'étude signée' },
                  { key: 'assuranceVerifiee', label: 'Assurance RC Pro vérifiée' },
                  { key: 'pvRecetteObtenu', label: 'PV de recette obtenu' },
                  { key: 'satisfactionEnvoyee', label: 'Enquête satisfaction envoyée' },
                  { key: 'bvEmis', label: 'Bulletins de versement émis' },
                  { key: 'facturePayee', label: 'Facture payée' },
                  { key: 'rapportPedagogiqueRedige', label: 'Rapport pédagogique rédigé' },
                ].map((item) => (
                  <FormControlLabel
                    key={item.key}
                    control={
                      <Checkbox
                        checked={qualityChecklist[item.key] || false}
                        onChange={async (e) => {
                          if (!etude?.id) return;
                          const updated = { ...qualityChecklist, [item.key]: e.target.checked };
                          try {
                            await updateQualityChecklist(etude.id, updated);
                            setEtude({ ...etude, qualityChecklist: updated } as any);
                          } catch (err) {
                            console.error('Erreur mise à jour checklist:', err);
                          }
                        }}
                        sx={{ '&.Mui-checked': { color: tokens.colors.primary } }}
                      />
                    }
                    label={item.label}
                    sx={{
                      display: 'flex',
                      mb: 1,
                      p: 1,
                      borderRadius: 1,
                      bgcolor: qualityChecklist[item.key] ? 'rgba(102, 126, 234, 0.05)' : 'transparent',
                      '& .MuiFormControlLabel-label': {
                        textDecoration: qualityChecklist[item.key] ? 'line-through' : 'none',
                        color: qualityChecklist[item.key] ? tokens.colors.textSecondary : tokens.colors.textPrimary,
                      },
                    }}
                  />
                ))}
              </Paper>
            </Grid>

            {/* Score satisfaction & Étape actuelle */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, mb: 3, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: tokens.colors.textPrimary, mb: 2 }}>
                  Progression de l'étude
                </Typography>
                <Box sx={{ mb: 2 }}>
                  {ETUDE_ETAPE_ORDER.map((etape, index) => {
                    const isCurrent = etape === currentEtape;
                    const isDone = index < currentEtapeIndex;
                    return (
                      <Box
                        key={etape}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          py: 0.75,
                          px: 1.5,
                          borderRadius: 1,
                          bgcolor: isCurrent ? 'rgba(102, 126, 234, 0.08)' : 'transparent',
                          borderLeft: `3px solid ${isDone ? '#4CAF50' : isCurrent ? ETUDE_ETAPE_COLORS[etape] : '#e0e0e0'}`,
                          mb: 0.5,
                        }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: isDone ? '#4CAF50' : isCurrent ? ETUDE_ETAPE_COLORS[etape] : '#e0e0e0',
                          }}
                        />
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: isCurrent ? 700 : 400,
                            color: isDone ? '#4CAF50' : isCurrent ? tokens.colors.textPrimary : tokens.colors.textSecondary,
                            textDecoration: isDone ? 'line-through' : 'none',
                          }}
                        >
                          {ETUDE_ETAPE_LABELS[etape]}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Paper>

              {/* Score satisfaction */}
              <Paper sx={{ p: 3, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: tokens.colors.textPrimary, mb: 2 }}>
                  Satisfaction client
                </Typography>
                {etude?.satisfactionScore ? (
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h2" sx={{ fontWeight: 800, color: tokens.colors.primary }}>
                      {etude.satisfactionScore.toFixed(1)}
                    </Typography>
                    <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>/ 5</Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mt: 1 }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Box
                          key={star}
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            bgcolor: star <= (etude.satisfactionScore || 0) ? '#FFD700' : '#e0e0e0',
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>
                      Aucune enquête de satisfaction soumise
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        </ComplianceTab>
        )}
      </EtudeDetailShell>

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
          <DialogTitle sx={{ fontWeight: 700, color: tokens.colors.textPrimary }}>
            Ajouter une tâche de planning
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: tokens.colors.textPrimary }}>
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
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: tokens.colors.textPrimary }}>
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
              sx={{ color: tokens.colors.textSecondary }}
            >
              Annuler
            </Button>
            <Button 
              onClick={handleAddPlanningTask} 
              variant="contained"
              sx={{ 
                bgcolor: tokens.colors.primary,
                '&:hover': { bgcolor: tokens.colors.primaryDark }
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
            color: tokens.colors.textPrimary,
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
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: tokens.colors.textPrimary }}>
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
                            borderColor: tokens.colors.textPrimary
                          }
                        }}
                      />
                    ))}
                  </Box>
                  {getUsedColors().length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="caption" sx={{ color: tokens.colors.textSecondary, display: 'block', mb: 1 }}>
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
                bgcolor: tokens.colors.bgDefault, 
                borderRadius: 2,
                border: '1px solid #e5e5e7'
              }}>
                <Typography variant="caption" sx={{ color: tokens.colors.textSecondary, display: 'block', mb: 1 }}>
                  Période sélectionnée
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500, color: tokens.colors.textPrimary }}>
                  {formatDate(newBudgetItem.startDate)} - {formatDate(newBudgetItem.endDate)}
                </Typography>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0 }}>
            <Button 
              onClick={() => setBudgetItemDialogOpen(false)}
              sx={{ color: tokens.colors.textSecondary }}
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
                ? `2px solid ${tokens.colors.brandTeal}` 
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
                    bgcolor: newBudgetItem.color || tokens.colors.primary,
                    mr: 1
                  }}
                />
                <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
                  {editingBudgetItem ? editingBudgetItem.title : 'Nouveau poste de budget'}
                </Typography>
                <DragIndicatorIcon 
                  sx={{ 
                    fontSize: 16, 
                    color: tokens.colors.textSecondary, 
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
              <Typography variant="caption" sx={{ color: tokens.colors.textSecondary, display: 'block', mb: 0.5 }}>
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
              <Typography variant="caption" sx={{ color: tokens.colors.textSecondary, display: 'block', mb: 0.5 }}>
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
                    color: tokens.colors.textSecondary,
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
                    
                    // Permettre les chiffres, virgules et points (max 2 décimales)
                    if (value === '' || /^[\d.,]*$/.test(value)) {
                      // Vérifier qu'il n'y a qu'un seul séparateur décimal
                      const decimalSeparators = (value.match(/[.,]/g) || []).length;
                      if (decimalSeparators <= 1) {
                        // Vérifier qu'il n'y a pas plus de 2 chiffres après le séparateur
                        const parts = value.split(/[.,]/);
                        if (parts.length === 1 || (parts.length === 2 && parts[1].length <= 2)) {
                        
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
                        } else {
                          // Vérifier si la valeur se termine par . ou ,
                          const endsWithDecimal = value.endsWith('.') || value.endsWith(',');
                          
                          if (endsWithDecimal) {
                            // Pour les valeurs qui se terminent par . ou , on garde la saisie
                          } else {
                            // Valeur complète, convertir normalement
                            const newBudget = parseFloat(value.replace(',', '.'));
                            if (!isNaN(newBudget)) {
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
                      }
                    } else {
                    }
                  } else {
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
                    color: tokens.colors.textSecondary,
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
                    <Typography variant="caption" sx={{ color: tokens.colors.textSecondary, display: 'block', mb: 0.5 }}>
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
                          color: tokens.colors.textSecondary,
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
                          
                          // Validation pour permettre jusqu'à 2 chiffres après le point
                          if (value === '' || /^[\d.,]*$/.test(value)) {
                            // Vérifier qu'il n'y a qu'un seul séparateur décimal
                            const decimalSeparators = (value.match(/[.,]/g) || []).length;
                            if (decimalSeparators <= 1) {
                              // Vérifier qu'il n'y a pas plus de 2 chiffres après le séparateur
                              const parts = value.split(/[.,]/);
                              if (parts.length === 1 || (parts.length === 2 && parts[1].length <= 2)) {
                                
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
                                } else {
                                  // Vérifier si la valeur se termine par . ou ,
                                  const endsWithDecimal = value.endsWith('.') || value.endsWith(',');
                                  
                                  if (endsWithDecimal) {
                                    // Pour les valeurs qui se terminent par . ou , on garde la saisie
                                  } else {
                                    // Valeur complète, convertir normalement
                                    const jehCount = parseFloat(value.replace(',', '.'));
                                    if (!isNaN(jehCount)) {
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
                              }
                            } else {
                            }
                          } else {
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
                          color: tokens.colors.textSecondary,
                          p: 0.5,
                          '&:hover': { bgcolor: 'rgba(134, 134, 139, 0.1)' }
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>+</Typography>
                      </IconButton>
                    </Box>
                  </Box>
                  
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: tokens.colors.textSecondary, display: 'block', mb: 0.5 }}>
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
                          color: tokens.colors.textSecondary,
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
                          
                          // Validation pour permettre jusqu'à 2 chiffres après le point
                          if (value === '' || /^[\d.,]*$/.test(value)) {
                            // Vérifier qu'il n'y a qu'un seul séparateur décimal
                            const decimalSeparators = (value.match(/[.,]/g) || []).length;
                            if (decimalSeparators <= 1) {
                              // Vérifier qu'il n'y a pas plus de 2 chiffres après le séparateur
                              const parts = value.split(/[.,]/);
                              if (parts.length === 1 || (parts.length === 2 && parts[1].length <= 2)) {
                                
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
                                } else {
                                  // Vérifier si la valeur se termine par . ou ,
                                  const endsWithDecimal = value.endsWith('.') || value.endsWith(',');
                                  
                                  if (endsWithDecimal) {
                                    // Pour les valeurs qui se terminent par . ou , on garde la saisie
                                  } else {
                                    // Valeur complète, convertir normalement
                                    const jehRate = parseFloat(value.replace(',', '.'));
                                    if (!isNaN(jehRate)) {
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
                              }
                            } else {
                            }
                          } else {
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
                          color: tokens.colors.textSecondary,
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
                    <Typography variant="caption" sx={{ color: tokens.colors.textSecondary, display: 'block', mb: 0.5 }}>
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
                          color: tokens.colors.textSecondary,
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
                          
                          // Validation pour permettre jusqu'à 2 chiffres après le point
                          if (value === '' || /^[\d.,]*$/.test(value)) {
                            // Vérifier qu'il n'y a qu'un seul séparateur décimal
                            const decimalSeparators = (value.match(/[.,]/g) || []).length;
                            if (decimalSeparators <= 1) {
                              // Vérifier qu'il n'y a pas plus de 2 chiffres après le séparateur
                              const parts = value.split(/[.,]/);
                              if (parts.length === 1 || (parts.length === 2 && parts[1].length <= 2)) {
                                
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
                                } else {
                                  // Vérifier si la valeur se termine par . ou ,
                                  const endsWithDecimal = value.endsWith('.') || value.endsWith(',');
                                  
                                  if (endsWithDecimal) {
                                    // Pour les valeurs qui se terminent par . ou , on garde la saisie
                                  } else {
                                    // Valeur complète, convertir normalement
                                    const hoursCount = parseFloat(value.replace(',', '.'));
                                    if (!isNaN(hoursCount)) {
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
                              }
                            } else {
                            }
                          } else {
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
                          color: tokens.colors.textSecondary,
                          p: 0.5,
                          '&:hover': { bgcolor: 'rgba(134, 134, 139, 0.1)' }
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>+</Typography>
                      </IconButton>
                    </Box>
                  </Box>
                  
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: tokens.colors.textSecondary, display: 'block', mb: 0.5 }}>
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
                          color: tokens.colors.textSecondary,
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
                          
                          // Validation pour permettre jusqu'à 2 chiffres après le point
                          if (value === '' || /^[\d.,]*$/.test(value)) {
                            // Vérifier qu'il n'y a qu'un seul séparateur décimal
                            const decimalSeparators = (value.match(/[.,]/g) || []).length;
                            if (decimalSeparators <= 1) {
                              // Vérifier qu'il n'y a pas plus de 2 chiffres après le séparateur
                              const parts = value.split(/[.,]/);
                              if (parts.length === 1 || (parts.length === 2 && parts[1].length <= 2)) {
                                
                                // Toujours mettre à jour la valeur temporaire
                                setTempHourlyRateInput(value);
                                
                                if (value === '') {
                                  setNewBudgetItem({ ...newBudgetItem, hourlyRate: 0 });
                                  updateTemporaryBudgetItem({ hourlyRate: 0 });
                                } else if (value === ',' || value === '.') {
                                  // Permettre la saisie temporaire
                                } else {
                                  // Vérifier si la valeur se termine par . ou ,
                                  const endsWithDecimal = value.endsWith('.') || value.endsWith(',');
                                  
                                  if (endsWithDecimal) {
                                    // Pour les valeurs qui se terminent par . ou , on garde la saisie
                                  } else {
                                    // Valeur complète, convertir normalement
                                    const hourlyRate = parseFloat(value.replace(',', '.'));
                                    if (!isNaN(hourlyRate)) {
                                      setNewBudgetItem({ ...newBudgetItem, hourlyRate });
                                      updateTemporaryBudgetItem({ hourlyRate });
                                      setTempHourlyRateInput(''); // Vider l'input temporaire
                                    }
                                  }
                                }
                              } else {
                              }
                            } else {
                            }
                          } else {
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
                          color: tokens.colors.textSecondary,
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
                <Typography variant="caption" sx={{ color: tokens.colors.textSecondary, display: 'block', mb: 0.5 }}>
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
                      color: tokens.colors.textSecondary,
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
                      color: tokens.colors.textSecondary,
                      p: 0.5,
                      '&:hover': { bgcolor: 'rgba(134, 134, 139, 0.1)' }
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>+</Typography>
                  </IconButton>
                </Box>
              </Box>
              
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: tokens.colors.textSecondary, display: 'block', mb: 0.5 }}>
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
                      color: tokens.colors.textSecondary,
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
                      color: tokens.colors.textSecondary,
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
              <Typography variant="caption" sx={{ color: tokens.colors.textSecondary, display: 'block', mb: 1 }}>
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
                sx={{ color: tokens.colors.textSecondary }}
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
          <DialogTitle sx={{ fontWeight: 700, color: tokens.colors.textPrimary }}>
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
                  bgcolor: tokens.colors.bgDefault, 
                  borderRadius: 2,
                  border: '1px solid #e5e5e7'
                }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: tokens.colors.textPrimary }}>
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
                      <Typography variant="body2" sx={{ mb: 1, color: tokens.colors.textSecondary }}>
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
                  bgcolor: tokens.colors.bgDefault, 
                  borderRadius: 2,
                  border: '1px solid #e5e5e7'
                }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: tokens.colors.textPrimary }}>
                    Exigences de candidature
                  </Typography>
                  
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={newRecruitmentTask.requiresCV || false}
                        onChange={(e) => setNewRecruitmentTask({ ...newRecruitmentTask, requiresCV: e.target.checked })}
                        sx={{
                          color: tokens.colors.brandTeal,
                          '&.Mui-checked': {
                            color: tokens.colors.brandTeal,
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
                          color: tokens.colors.brandTeal,
                          '&.Mui-checked': {
                            color: tokens.colors.brandTeal,
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
              sx={{ color: tokens.colors.textSecondary }}
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
                bgcolor: tokens.colors.primary,
                '&:hover': { bgcolor: tokens.colors.primaryDark }
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
          <DialogTitle sx={{ fontWeight: 700, color: tokens.colors.textPrimary }}>
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
                  bgcolor: tokens.colors.bgDefault, 
                  borderRadius: 2,
                  border: '1px solid #e5e5e7'
                }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: tokens.colors.textPrimary }}>
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
                          color: tokens.colors.brandTeal,
                          '&.Mui-checked': {
                            color: tokens.colors.brandTeal,
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
                          color: tokens.colors.brandTeal,
                          '&.Mui-checked': {
                            color: tokens.colors.brandTeal,
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
                    bgcolor: tokens.colors.bgDefault, 
                    borderRadius: 2,
                    border: '1px solid #e5e5e7'
                  }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: tokens.colors.textPrimary }}>
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
                    bgcolor: tokens.colors.bgDefault, 
                    borderRadius: 2,
                    border: '1px solid #e5e5e7'
                  }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: tokens.colors.textPrimary }}>
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
                sx={{ color: tokens.colors.textSecondary }}
              >
                Annuler
              </Button>
              <Button 
                onClick={handleEditRecruitmentTask} 
                variant="contained"
                disabled={!editingRecruitmentTask?.title?.trim()}
                sx={{ 
                  bgcolor: tokens.colors.primary,
                  '&:hover': { bgcolor: tokens.colors.primaryDark }
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
          <DialogTitle sx={{ fontWeight: 700, color: tokens.colors.textPrimary }}>
            Upload de document
          </DialogTitle>
          <DialogContent>
            <Box sx={{ 
              p: 4, 
              border: `2px dashed ${tokens.colors.brandTeal}`, 
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
                    borderColor: tokens.colors.primary,
                    color: tokens.colors.primary,
                    '&:hover': { 
                      borderColor: tokens.colors.primaryDark,
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
              sx={{ color: tokens.colors.textSecondary }}
            >
              Fermer
            </Button>
          </DialogActions>
        </Dialog>

        {/* Document Generation Dialog */}
        <Dialog 
          open={powerpointDialogOpen} 
          onClose={() => setPowerpointDialogOpen(false)} 
          maxWidth="md" 
          fullWidth
          PaperProps={{
            sx: { borderRadius: 3 }
          }}
        >
          <DialogTitle sx={{ fontWeight: 700, color: tokens.colors.textPrimary }}>
            Générer un document
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ mb: 3, color: tokens.colors.textPrimary }}>
              Utilisez les balises suivantes dans votre template :
            </Typography>
            <Box sx={{ mb: 4, p: 3, bgcolor: tokens.colors.bgDefault, borderRadius: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: tokens.colors.textPrimary }}>
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
              label="Template document (utilisez les balises ci-dessus)"
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
              sx={{ color: tokens.colors.textSecondary }}
            >
              Annuler
            </Button>
            <Button 
              variant="contained" 
              startIcon={<PowerSettingsNewIcon />}
              sx={{ 
                bgcolor: tokens.colors.primary,
                '&:hover': { bgcolor: tokens.colors.primaryDark }
              }}
            >
              Générer document
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
                    borderRadius: tokens.radius.md,
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
                      nSiret
                    </Typography>
                    <StyledTextField
                      value={newCompany.nSiret}
                      onChange={(e) => setNewCompany({ ...newCompany, nSiret: e.target.value })}
                      fullWidth
                      placeholder="Numéro nSiret"
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
                      borderRadius: tokens.radius.md,
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
                    borderRadius: tokens.radius.md,
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
          <DialogTitle sx={{ fontWeight: 700, color: tokens.colors.textPrimary }}>
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
              sx={{ color: tokens.colors.textSecondary }}
            >
              Annuler
            </Button>
            <Button 
              onClick={handleAddNote} 
              variant="contained"
              disabled={!newNote.trim()}
              sx={{ 
                bgcolor: tokens.colors.primary,
                '&:hover': { bgcolor: tokens.colors.primaryDark }
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
            color: tokens.colors.textPrimary,
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
                  bgcolor: tokens.colors.primary,
                  color: 'white',
                  fontWeight: 600
                }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: tokens.colors.textSecondary, mt: 1 }}>
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
                  bgcolor: tokens.colors.bgDefault, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3
                }}>
                  <PeopleIcon sx={{ fontSize: 32, color: '#d2d2d7' }} />
                </Box>
                <Typography variant="h6" sx={{ color: tokens.colors.textSecondary, mb: 1, fontWeight: 600 }}>
                  Aucune candidature
                </Typography>
                <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>
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
                          bgcolor: tokens.colors.primary,
                          fontSize: '1.2rem',
                          fontWeight: 600
                        }}
                      >
                        <RecruitmentUserAvatar
                          userId={application.userId}
                          displayName={application.userDisplayName}
                          email={application.userEmail}
                        />
                      </Avatar>

                      {/* Contenu principal */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                          <RecruitmentUserName
                            userId={application.userId}
                            displayName={application.userDisplayName}
                            email={application.userEmail}
                            variant="h6"
                            sx={{ fontWeight: 600, color: tokens.colors.textPrimary, fontSize: '1rem' }}
                          />
                          <Chip
                            label={application.status}
                            size="small"
                            sx={{
                              fontWeight: 600,
                              bgcolor: application.status === 'Refusée' ? '#ff4757' : 
                                       application.status === 'Acceptée' ? '#2ed573' : 
                                       application.status === 'Ajouté manuellement' ? tokens.colors.primary : '#ffa502',
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
                                bgcolor: tokens.colors.primary,
                                color: 'white',
                                fontSize: '0.6rem',
                                height: 16
                              }}
                            />
                          )}
                        </Box>
                        
                        <Typography variant="body2" sx={{ 
                          color: tokens.colors.textSecondary, 
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
                            ? `Ajouté manuellement le ${formatSafeDate(application.submittedAt)}`
                            : `Candidature soumise le ${formatSafeDate(application.submittedAt)}`
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
                            color: tokens.colors.primary,
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
                color: tokens.colors.textSecondary,
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
            color: tokens.colors.textPrimary,
            borderBottom: '1px solid #f0f0f0',
            pb: 2
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Avatar 
                src={selectedApplication?.userPhotoURL}
                sx={{ 
                  width: 56, 
                  height: 56,
                  bgcolor: tokens.colors.primary,
                  fontSize: '1.4rem',
                  fontWeight: 600
                }}
              >
                {selectedApplication && (
                  <RecruitmentUserAvatar
                    userId={selectedApplication.userId}
                    displayName={selectedApplication.userDisplayName}
                    email={selectedApplication.userEmail}
                  />
                )}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                {selectedApplication && (
                  <RecruitmentUserName
                    userId={selectedApplication.userId}
                    displayName={selectedApplication.userDisplayName}
                    email={selectedApplication.userEmail}
                    variant="h5"
                    sx={{ fontWeight: 700, color: tokens.colors.textPrimary, mb: 0.5 }}
                  />
                )}
                <Typography variant="body2" sx={{ color: tokens.colors.textSecondary, mb: 1 }}>
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
                  <Typography variant="h6" sx={{ fontWeight: 600, color: tokens.colors.textPrimary, mb: 3 }}>
                    Informations de candidature
                  </Typography>
                  
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                    <Box>
                      <Typography variant="caption" sx={{ 
                        color: tokens.colors.textSecondary, 
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                        mb: 1,
                        display: 'block'
                      }}>
                        Date de candidature
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {formatSafeDate(selectedApplication.submittedAt)} à {formatSafeTime(selectedApplication.submittedAt)}
                      </Typography>
                    </Box>
                    
                    {selectedApplication.reviewedBy && (
                      <Box>
                        <Typography variant="caption" sx={{ 
                          color: tokens.colors.textSecondary, 
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
                          color: tokens.colors.textSecondary, 
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          letterSpacing: '0.5px',
                          mb: 1,
                          display: 'block'
                        }}>
                          Date d'évaluation
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {formatSafeDate(selectedApplication.reviewedAt)} à {formatSafeTime(selectedApplication.reviewedAt)}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* CV */}
                {selectedApplication.cvUrl && (
                  <Box sx={{ p: 4, borderBottom: '1px solid #f0f0f0' }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: tokens.colors.textPrimary, mb: 3 }}>
                      CV
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        href={selectedApplication.cvUrl}
                        target="_blank"
                        sx={{
                          bgcolor: tokens.colors.primary,
                          '&:hover': { bgcolor: tokens.colors.primaryDark },
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
                          borderColor: tokens.colors.primary,
                          color: tokens.colors.primary,
                          '&:hover': {
                            bgcolor: 'rgba(102, 126, 234, 0.04)',
                            borderColor: tokens.colors.primaryDark
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
                    <Typography variant="h6" sx={{ fontWeight: 600, color: tokens.colors.textPrimary, mb: 3 }}>
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
                color: tokens.colors.textSecondary,
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
            color: tokens.colors.textPrimary,
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
                  borderColor: tokens.colors.primary,
                  color: tokens.colors.primary,
                  '&:hover': {
                    bgcolor: 'rgba(102, 126, 234, 0.04)',
                    borderColor: tokens.colors.primaryDark
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
                color: tokens.colors.textSecondary,
                fontWeight: 500
              }}
            >
              Fermer
            </Button>
          </DialogActions>
        </Dialog>

        {createPortal(
          <Snackbar
            open={snackbar.open}
            autoHideDuration={snackbar.actionUrl ? 12000 : 6000}
            onClose={() => setSnackbar(prev => ({ ...prev, open: false, actionLabel: undefined, actionUrl: undefined }))}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            sx={{ zIndex: 10000 }}
          >
            <Alert 
              severity={snackbar.severity} 
              onClose={() => setSnackbar(prev => ({ ...prev, open: false, actionLabel: undefined, actionUrl: undefined }))}
              variant="filled"
              action={snackbar.actionUrl && snackbar.actionLabel ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    navigate(snackbar.actionUrl!);
                    setSnackbar(prev => ({ ...prev, open: false, actionLabel: undefined, actionUrl: undefined }));
                  }}
                  sx={{ fontWeight: 600, textDecoration: 'underline' }}
                >
                  {snackbar.actionLabel}
                </Button>
              ) : undefined}
              sx={{ 
                width: '100%',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
              }}
            >
              {snackbar.message}
            </Alert>
          </Snackbar>,
          document.body
        )}

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
            color: tokens.colors.textPrimary,
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
                <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>
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
                        color: tokens.colors.primary,
                        '&.Mui-checked': {
                          color: tokens.colors.primary
                        }
                      }}
                    />
                    <Avatar
                      src={student.photoURL || undefined}
                      sx={{ 
                        width: 40, 
                        height: 40, 
                        mr: 2,
                        bgcolor: tokens.colors.primary
                      }}
                    >
                      <UserAvatarInitials user={{ id: student.id, displayName: student.displayName, email: student.email }} />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <UserNameText
                        user={{ id: student.id, displayName: student.displayName, email: student.email }}
                        fallback={student.email?.split('@')[0] || 'Utilisateur'}
                        variant="body1"
                        sx={{ fontWeight: 600 }}
                      />
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
                bgcolor: tokens.colors.primary,
                '&:hover': { bgcolor: tokens.colors.primaryDark },
                fontWeight: 600
              }}
            >
              Ajouter {selectedStudents.length} étudiant(s)
            </Button>
            <Button
              onClick={() => setAddStudentDialogOpen(false)}
              sx={{ 
                color: tokens.colors.textSecondary,
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
            color: tokens.colors.textPrimary,
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
                  bgcolor: tokens.colors.bgDefault, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3
                }}>
                  <PeopleIcon sx={{ fontSize: 32, color: '#d2d2d7' }} />
                </Box>
                <Typography variant="h6" sx={{ color: tokens.colors.textSecondary, mb: 1, fontWeight: 600 }}>
                  Aucun étudiant recruté
                </Typography>
                <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>
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
                        {!student.userPhotoURL && (
                          <RecruitmentUserAvatar
                            userId={student.userId}
                            displayName={student.userDisplayName}
                            email={student.userEmail}
                          />
                        )}
                      </Avatar>

                      {/* Contenu principal */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                          <RecruitmentUserName
                            userId={student.userId}
                            displayName={student.userDisplayName}
                            email={student.userEmail}
                            variant="h6"
                            sx={{ fontWeight: 600, color: tokens.colors.textPrimary, fontSize: '1rem' }}
                          />
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
                                bgcolor: tokens.colors.primary,
                                color: 'white',
                                fontSize: '0.6rem',
                                height: 16
                              }}
                            />
                          )}
                        </Box>
                        
                        <Typography variant="body2" sx={{ 
                          color: tokens.colors.textSecondary, 
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
                            ? `Ajouté manuellement le ${formatSafeDate(student.submittedAt)}`
                            : `Candidature acceptée le ${formatSafeDate(student.submittedAt)}`
                          }
                        </Typography>

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
                              borderColor: tokens.colors.primary,
                              color: tokens.colors.primary,
                              '&:hover': {
                                bgcolor: 'rgba(102, 126, 234, 0.04)',
                                borderColor: tokens.colors.primaryDark
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
                              'Êtes-vous sûr de vouloir supprimer cet étudiant de cette tâche de recrutement ?'
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
                                  message: 'L\'étudiant a été supprimé de la tâche',
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
                color: tokens.colors.textSecondary,
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
              borderRadius: tokens.radius.lg,
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
              <Typography variant="h5" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
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
          
          <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', minHeight: 400 }}>
            {selectedDocument ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                {/* Ligne d’infos compacte */}
                <Box sx={{ px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                  <UserReferenceText
                    userId={selectedDocument.uploadedBy}
                    name={selectedDocument.uploadedByName}
                    fallback="—"
                    variant="body2"
                    sx={{ color: 'text.secondary' }}
                  />
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDocumentUploadDate(selectedDocument.uploadedAt)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedDocument.size != null ? `${(selectedDocument.size / 1024 / 1024).toFixed(2)} Mo` : '—'}
                  </Typography>
                  {selectedDocument.isDraft && (
                    <Chip label="Brouillon" size="small" sx={{ bgcolor: '#FFE082', color: '#000' }} />
                  )}
                </Box>

                {/* Aperçu PDF ou lien */}
                {selectedDocument.url ? (
                  selectedDocument.type === 'pdf' ? (
                    <Box sx={{ flex: 1, minHeight: '72vh', height: '72vh', p: 2 }}>
                      <iframe
                        title={selectedDocument.name}
                        src={selectedDocument.url}
                        style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
                      />
                    </Box>
                  ) : (
                    <Box sx={{ flex: 1, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
                      <Button
                        variant="outlined"
                        href={selectedDocument.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        startIcon={<VisibilityIcon />}
                      >
                        Ouvrir le document
                      </Button>
                    </Box>
                  )
                ) : (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      Aucun fichier associé
                    </Typography>
                  </Box>
                )}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
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
                color: tokens.colors.textSecondary,
                fontWeight: 500
              }}
            >
              Fermer
            </Button>
          </DialogActions>
        </Dialog>

        {/* Générateur de documents intelligent */}
        <DocumentGeneratorDialog
          open={documentGeneratorOpen || documentGeneratorOpenForType.open}
          onClose={() => {
            setDocumentGeneratorOpen(false);
            setDocumentGeneratorOpenForType({ open: false });
          }}
          etudeData={etude}
          companyData={companyFullData}
          contactData={contacts.find(c => c.isDefault) || contacts[0]}
          structureData={structureFullData}
          budgetItems={budgetItems}
          studentId={documentGeneratorOpenForType.studentId}
          documentType={documentGeneratorOpenForType.documentType}
        />

        {/* Indicateur de progression pour la génération de documents */}
        {downloadProgress && (
          <Box
            sx={{
              position: 'fixed',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9999,
              minWidth: 300,
              maxWidth: 500,
              bgcolor: 'background.paper',
              borderRadius: 2,
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              p: 2,
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <LinearProgress 
              variant="determinate" 
              value={downloadProgress.progress} 
              sx={{ 
                height: 8, 
                borderRadius: 4,
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                mb: 1,
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4
                }
              }} 
            />
            <Typography 
              variant="caption" 
              sx={{ 
                display: 'block', 
                textAlign: 'center',
                color: 'text.secondary',
                fontSize: '0.75rem'
              }}
            >
              {downloadProgress.message}
            </Typography>
          </Box>
        )}
    </Box>
  );
};

export default EtudeDetails;
