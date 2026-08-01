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
  TableSortLabel,
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
  ListItemButton,
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
  Autocomplete,
  Grow
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
  Info as InfoIcon,
  ViewColumn as ViewColumnIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  WbSunny as TodayIcon,
  TableChart as TableChartIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { getProspects, createProspect, deleteProspect, updateProspect } from '../firebase/prospects';
import { getRelanceSuggestions, computeProspectScores, type RelanceSuggestion } from '../services/scoringService';
import { decryptUsersList, getSafeDisplayName } from '../utils/decryptUserUtils';
import { batchDecryptForStructure } from '../utils/batchDecrypt';
import UserNameText from '../components/common/UserNameText';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, deleteDoc, serverTimestamp, writeBatch, addDoc, Timestamp, orderBy, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase/config';
import { getStructureTokens, StructureTokens } from '../services/tokenService';
import { useNavigate } from 'react-router-dom';
import { downloadExtension } from '../api/extension';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { fadeIn } from '../styles/animations';
import { tokens } from '../theme/tokens';
import { StyledCard, StyledButton, StyledTextField, StyledChip, StyledTableRow } from '../components/styled';
import { AppPageShell, CommercialViewTabs, KpiCard, RelancePill } from '../components/ds';
import { CommercialTodayView, CommercialAgendaView, CommercialTableView, type CommercialViewId } from './commercialViews';
import { relanceState, toIsoDate } from '../utils/commercialRelance';
import Papa from 'papaparse';
import { usePermission } from '../hooks/usePermission';
import AccessDenied from '../components/common/AccessDenied';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type ColumnSizingState,
  type VisibilityState
} from '@tanstack/react-table';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

// Colonnes du tableau Liste (style Twenty) — Notes tout à gauche
const TABLE_COLUMNS = [
  { id: 'notes', label: 'Notes', sortKey: 'notes' },
  { id: 'nom', label: 'Nom', sortKey: 'nom' },
  { id: 'entreprise', label: 'Entreprise', sortKey: 'entreprise' },
  { id: 'statut', label: 'Statut', sortKey: 'statut' },
  { id: 'aiScore', label: 'Priorité IA', sortKey: 'aiScore' },
  { id: 'ownerId', label: 'Propriétaire', sortKey: 'ownerId' },
  { id: 'derniereInteraction', label: 'Dernière activité', sortKey: 'derniereInteraction' }
] as const;

// --- VUE ENTREPRISES (liste CRM TanStack Table + resize/reorder colonnes) ---
export interface CompanyRow {
  id: string;
  name: string;
  domain: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  secteur?: string;
  accountOwnerId: string;
  createdById: string;
  createdAt: string;
  logo?: string;
  /** Score IA (priorité) — même donnée que les prospects */
  aiScore?: number;
}
// Métadonnées de toutes les colonnes : visibilité, ordre, redimensionnement (+ Notation = même données que Prospects)
const ENTREPRISE_COLUMNS_META: { id: string; label: string; minSize: number; defaultSize: number }[] = [
  { id: 'name', label: 'Nom', minSize: 120, defaultSize: 220 },
  { id: 'domain', label: 'Domaine', minSize: 120, defaultSize: 180 },
  { id: 'email', label: 'Email', minSize: 140, defaultSize: 200 },
  { id: 'telephone', label: 'Téléphone', minSize: 120, defaultSize: 140 },
  { id: 'adresse', label: 'Adresse', minSize: 140, defaultSize: 220 },
  { id: 'secteur', label: 'Secteur', minSize: 100, defaultSize: 140 },
  { id: 'aiScore', label: 'Notation', minSize: 90, defaultSize: 100 },
  { id: 'accountOwnerId', label: 'Responsable du compte', minSize: 140, defaultSize: 180 },
  { id: 'createdById', label: 'Créé par', minSize: 120, defaultSize: 140 },
  { id: 'createdAt', label: 'Date de création', minSize: 120, defaultSize: 140 }
];

/** Disposition du tableau Commercial sauvegardée par utilisateur (Firestore users/{uid}) */
export interface CommercialTableLayout {
  listView?: { visibleColumns: string[] };
  companiesView?: {
    visibleColumnIds: string[];
    columnOrder: string[];
    columnSizing: Record<string, number>;
  };
}

const DEFAULT_LIST_VISIBLE_COLUMNS = TABLE_COLUMNS.map(c => c.id);
const DEFAULT_COMPANIES_VISIBLE_IDS = ENTREPRISE_COLUMNS_META.map(c => c.id);
const DEFAULT_COMPANIES_ORDER = ENTREPRISE_COLUMNS_META.map(c => c.id);
const defaultCompaniesSizing = (): ColumnSizingState => {
  const s: ColumnSizingState = {};
  ENTREPRISE_COLUMNS_META.forEach(c => { s[c.id] = c.defaultSize; });
  return s;
};

export interface CompanyUser {
  id: string;
  name: string;
  avatar?: string;
}
const MOCK_COMPANY_USERS: CompanyUser[] = [
  { id: 'u1', name: 'Marie Dupont' },
  { id: 'u2', name: 'Thomas Martin' },
  { id: 'u3', name: 'Léa Bernard' },
  { id: 'u4', name: 'Hugo Petit' },
  { id: 'u5', name: 'Emma Laurent' }
];
const MOCK_COMPANIES: CompanyRow[] = [
  { id: 'c1', name: 'Airbnb', domain: 'airbnb.com', email: 'contact@airbnb.com', telephone: '01 23 45 67 89', adresse: 'Paris', secteur: 'Tech', accountOwnerId: 'u1', createdById: 'u2', createdAt: '2024-01-15T10:00:00Z' },
  { id: 'c2', name: 'Amazon', domain: 'amazon.com', email: 'partenaires@amazon.fr', telephone: '01 34 56 78 90', adresse: 'Clichy', secteur: 'Retail', accountOwnerId: 'u2', createdById: 'u1', createdAt: '2024-02-20T14:30:00Z' },
  { id: 'c3', name: 'Apple', domain: 'apple.com', email: 'enterprise@apple.com', telephone: '08 00 94 04 76', adresse: 'Paris', secteur: 'Tech', accountOwnerId: 'u3', createdById: 'u3', createdAt: '2024-03-01T09:00:00Z' },
  { id: 'c4', name: 'Google', domain: 'google.com', email: 'sales@google.com', telephone: '01 42 68 53 00', adresse: 'Paris', secteur: 'Tech', accountOwnerId: 'u1', createdById: 'u4', createdAt: '2024-03-10T11:20:00Z' },
  { id: 'c5', name: 'Microsoft', domain: 'microsoft.com', email: 'info@microsoft.com', telephone: '01 55 69 61 00', adresse: 'Issy-les-Moulineaux', secteur: 'Tech', accountOwnerId: 'u4', createdById: 'u2', createdAt: '2024-04-05T08:45:00Z' },
  { id: 'c6', name: 'Meta', domain: 'meta.com', email: 'business@meta.com', telephone: '', adresse: 'Paris', secteur: 'Tech', accountOwnerId: 'u2', createdById: 'u1', createdAt: '2024-04-12T16:00:00Z' },
  { id: 'c7', name: 'Netflix', domain: 'netflix.com', email: 'partenaires@netflix.com', telephone: '', adresse: '', secteur: 'Média', accountOwnerId: 'u5', createdById: 'u5', createdAt: '2024-05-01T13:00:00Z' },
  { id: 'c8', name: 'Salesforce', domain: 'salesforce.com', email: 'contact@salesforce.com', telephone: '01 84 80 29 00', adresse: 'Paris', secteur: 'SaaS', accountOwnerId: 'u3', createdById: 'u3', createdAt: '2024-05-18T10:30:00Z' },
  { id: 'c9', name: 'Spotify', domain: 'spotify.com', email: 'ads@spotify.com', telephone: '', adresse: 'Paris', secteur: 'Média', accountOwnerId: 'u1', createdById: 'u4', createdAt: '2024-06-02T09:15:00Z' },
  { id: 'c10', name: 'Stripe', domain: 'stripe.com', email: 'support@stripe.com', telephone: '', adresse: '', secteur: 'Fintech', accountOwnerId: 'u4', createdById: 'u2', createdAt: '2024-06-20T14:00:00Z' },
  { id: 'c11', name: 'Uber', domain: 'uber.com', email: 'partenaires@uber.com', telephone: '', adresse: 'Paris', secteur: 'Mobilité', accountOwnerId: 'u5', createdById: 'u1', createdAt: '2024-07-08T11:45:00Z' },
  { id: 'c12', name: 'Slack', domain: 'slack.com', email: 'sales@slack.com', telephone: '', adresse: '', secteur: 'SaaS', accountOwnerId: 'u2', createdById: 'u5', createdAt: '2024-07-25T08:30:00Z' },
  { id: 'c13', name: 'Zoom', domain: 'zoom.us', email: 'enterprise@zoom.us', telephone: '', adresse: 'Paris', secteur: 'Tech', accountOwnerId: 'u3', createdById: 'u3', createdAt: '2024-08-10T15:20:00Z' },
  { id: 'c14', name: 'Adobe', domain: 'adobe.com', email: 'contact@adobe.com', telephone: '01 71 19 40 00', adresse: 'Paris', secteur: 'Tech', accountOwnerId: 'u1', createdById: 'u4', createdAt: '2024-08-28T09:00:00Z' },
  { id: 'c15', name: 'Tesla', domain: 'tesla.com', email: 'fleet@tesla.com', telephone: '', adresse: 'Boulogne', secteur: 'Automobile', accountOwnerId: 'u4', createdById: 'u2', createdAt: '2024-09-12T12:00:00Z' },
  { id: 'c16', name: 'Notion', domain: 'notion.so', email: 'hello@notion.so', telephone: '', adresse: '', secteur: 'SaaS', accountOwnerId: 'u5', createdById: 'u1', createdAt: '2024-09-30T10:45:00Z' }
];
const formatElapsed = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return 'À l\'instant';
  if (sec < 3600) return `Il y a ${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `Il y a ${Math.floor(sec / 3600)} h`;
  if (sec < 2592000) return `Il y a ${Math.floor(sec / 86400)} j`;
  if (sec < 31536000) return `Il y a ${Math.floor(sec / 2592000)} mois`;
  return `Il y a ${Math.floor(sec / 31536000)} an(s)`;
};

// En-tête de colonne sortable (drag pour réordonnancement) + handle resize
function SortableTh({ header, title }: { header: any; title: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: header.column.id });
  const style = {
    width: header.getSize(),
    minWidth: header.getSize(),
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };
  return (
    <th
      ref={setNodeRef}
      className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider relative group border-r border-gray-100 last:border-r-0 bg-gray-50"
      style={style}
    >
      <Tooltip title={title} placement="top">
        <span
          className="truncate block pr-2 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          {flexRender(header.column.columnDef.header, header.getContext())}
        </span>
      </Tooltip>
      <div
        onMouseDown={header.getResizeHandler()}
        onTouchStart={header.getResizeHandler()}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 opacity-0 group-hover:opacity-100"
        style={{ touchAction: 'none' }}
      />
    </th>
  );
}

// Données pour génération de prospects de test (superadmin)
const TEST_PRENOMS = ['Lucas', 'Emma', 'Hugo', 'Chloé', 'Louis', 'Léa', 'Gabriel', 'Manon', 'Raphaël', 'Jade', 'Arthur', 'Camille', 'Jules', 'Sarah', 'Adam', 'Inès', 'Paul', 'Marie', 'Nathan', 'Julie'];
const TEST_NOMS = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier'];
const TEST_ENTREPRISES = ['TechVision SAS', 'Innovation & Co', 'Digital Solutions France', 'Groupe Mercier', 'StartUp Lab', 'Consulting Partners', 'Agence Web Pro', 'DataDrive', 'CloudSoft', 'GreenEnergy SA', 'Finance & Stratégie', 'MediaGroup', 'Logistique Express', 'Santé Plus', 'EduFrance'];
const TEST_SECTEURS = ['Technologie', 'Conseil', 'Finance', 'Santé', 'Industrie', 'Services', 'Retail', 'Énergie', 'Média', 'Logistique', 'Formation', 'Construction', 'Agroalimentaire', 'Automobile', 'Luxe'];
const TEST_TAILLES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];
const TEST_SOURCES = ['Salon', 'LinkedIn', 'Recommandation', 'Site web', 'Appel entrant', 'Emailing', 'Prospection', 'Partenariat', 'Événement', 'Bouche-à-oreille'];
const TEST_POSTES = ['Directeur Général', 'DRH', 'DAF', 'Responsable Achats', 'Chef de projet', 'Directeur Commercial', 'Responsable Innovation', 'CEO', 'CTO', 'Responsable Marketing', 'Directeur Opérations'];
const TEST_VILLES = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nantes', 'Bordeaux', 'Lille', 'Strasbourg', 'Rennes', 'Montpellier', 'Nice', 'Nancy', 'Grenoble', 'Tours', 'Clermont-Ferrand'];
const TEST_NOTES = [
  'Intéressé par une démo. À rappeler fin du mois.',
  'Premier contact au salon. Échange de cartes.',
  'Demande de devis reçue. En attente de validation budget.',
  'Très réactif. Souhaite avancer rapidement.',
  'À recontacter après vacances.',
  'Projet en interne en cours. Nous recontacter.',
  'Bon feeling. Prochaine étape : visite sur site.',
  'Hésitant sur le périmètre. À préciser.',
  'Décision prévue au prochain CA.',
  null
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
  primary: tokens.colors.brandTeal,
  secondary: tokens.colors.textSecondary,
  background: tokens.colors.bgSubtle,
  surface: tokens.colors.bgPaper,
  border: tokens.colors.borderDefault,
  text: tokens.colors.textPrimary,
  error: tokens.colors.error,
  success: tokens.colors.success
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

// --- UTILS ---

const capitalizeWords = (str: string): string => {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const getOwnerDisplayName = (ownerId: string, structureMembers: any[] = []) => {
  const owner = structureMembers.find(m => m.id === ownerId);
  return owner ? owner.displayName : 'Non assigné';
};

const isEncrypted = (v: any): boolean => typeof v === 'string' && v.startsWith('ENC:');

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
  /** Score IA 0-100 (priorité prospect) */
  aiScore?: number;
  lastActivityAt?: any;
}

interface StructureMember {
  id: string;
  displayName: string;
  role: 'admin' | 'superadmin' | 'membre';
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
  const { canRead, canWrite, loading: permissionLoading } = usePermission('commercial');
  const navigate = useNavigate();
  const isSuperAdmin = userData?.status === 'superadmin' || userData?.role === 'superadmin';

  // Data States
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [decryptedProspects, setDecryptedProspects] = useState<Record<string, Partial<Prospect>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [structureMembers, setStructureMembers] = useState<StructureMember[]>([]);
  
  // UI States
  const [viewMode, setViewMode] = useState<CommercialViewId>('today');
  const [relancesDoneToday, setRelancesDoneToday] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showSalonMode, setShowSalonMode] = useState(false);
  // Vue Entreprises : même données que les prospects, affichage tableau par entreprise
  const [companiesSearch, setCompaniesSearch] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  // Colonnes : visibilité (ids visibles), ordre (réordonnancement drag), sizing (largeurs persistées)
  const [companiesVisibleColumnIds, setCompaniesVisibleColumnIds] = useState<string[]>(() =>
    ENTREPRISE_COLUMNS_META.map(c => c.id)
  );
  const [companiesColumnOrder, setCompaniesColumnOrder] = useState<string[]>(() =>
    ENTREPRISE_COLUMNS_META.map(c => c.id)
  );
  const [companiesColumnSizing, setCompaniesColumnSizing] = useState<ColumnSizingState>(() => {
    const s: ColumnSizingState = {};
    ENTREPRISE_COLUMNS_META.forEach(c => { s[c.id] = c.defaultSize; });
    return s;
  });
  const [companiesColumnPickerAnchor, setCompaniesColumnPickerAnchor] = useState<HTMLElement | null>(null);

  // Selection & Actions
  const [selectedProspects, setSelectedProspects] = useState<string[]>([]);
  const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'nom', direction: 'asc' });
  
  // Table view (style Twenty): colonnes visibles, filtres, menu ligne, ajout rapide
  const [visibleTableColumns, setVisibleTableColumns] = useState<string[]>(TABLE_COLUMNS.map(c => c.id));
  const [tableColumnCustomizeAnchor, setTableColumnCustomizeAnchor] = useState<null | HTMLElement>(null);
  const [filterTableStatus, setFilterTableStatus] = useState<string>('');
  const [filterTableOwnerId, setFilterTableOwnerId] = useState<string>('');
  const [rowMenuAnchorEl, setRowMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [rowMenuProspectId, setRowMenuProspectId] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false);

  // Persistance disposition tableau : chargée une fois, puis sauvegardée au changement (par user)
  const layoutReadyRef = React.useRef(false);
  useEffect(() => {
    if (!currentUser?.uid) return;
    const loadLayout = async () => {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const snap = await getDoc(userRef);
        const data = snap.data();
        const layout = data?.commercialTableLayout as CommercialTableLayout | undefined;
        if (layout?.listView?.visibleColumns?.length) {
          const valid = layout.listView.visibleColumns.filter(id => TABLE_COLUMNS.some(c => c.id === id));
          if (valid.length) setVisibleTableColumns(valid);
        }
        if (layout?.companiesView) {
          const cv = layout.companiesView;
          const validIds = (cv.visibleColumnIds || []).filter(id => ENTREPRISE_COLUMNS_META.some(c => c.id === id));
          const validOrder = (cv.columnOrder || []).filter(id => ENTREPRISE_COLUMNS_META.some(c => c.id === id));
          if (validIds.length) setCompaniesVisibleColumnIds(validIds);
          if (validOrder.length) setCompaniesColumnOrder(validOrder);
          if (cv.columnSizing && typeof cv.columnSizing === 'object') {
            const s: ColumnSizingState = {};
            ENTREPRISE_COLUMNS_META.forEach(c => {
              const v = cv.columnSizing[c.id];
              if (typeof v === 'number' && v >= c.minSize) s[c.id] = v;
            });
            if (Object.keys(s).length) setCompaniesColumnSizing(prev => ({ ...prev, ...s }));
          }
        }
      } catch (e) {
        console.error('Erreur chargement disposition tableau Commercial:', e);
      } finally {
        layoutReadyRef.current = true;
      }
    };
    loadLayout();
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!layoutReadyRef.current || !currentUser?.uid) return;
    const t = setTimeout(() => {
      const userRef = doc(db, 'users', currentUser.uid);
      updateDoc(userRef, {
        commercialTableLayout: {
          listView: { visibleColumns: visibleTableColumns },
          companiesView: {
            visibleColumnIds: companiesVisibleColumnIds,
            columnOrder: companiesColumnOrder,
            columnSizing: companiesColumnSizing
          }
        },
        lastCommercialLayoutUpdate: serverTimestamp()
      }).catch(e => console.error('Erreur sauvegarde disposition tableau:', e));
    }, 500);
    return () => clearTimeout(t);
  }, [currentUser?.uid, visibleTableColumns, companiesVisibleColumnIds, companiesColumnOrder, companiesColumnSizing]);
  
  // Imports
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  
  // Delete Dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Génération prospects de test (superadmin)
  const [isGenerateTestDialogOpen, setIsGenerateTestDialogOpen] = useState(false);
  const [generateTestCount, setGenerateTestCount] = useState(5);
  const [generateTestSubmitting, setGenerateTestSubmitting] = useState(false);
  
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

  // Scoring IA : suggestions de relance
  const [relanceSuggestions, setRelanceSuggestions] = useState<RelanceSuggestion[]>([]);
  const [relanceSuggestionsLoading, setRelanceSuggestionsLoading] = useState(false);

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

  // Charger les suggestions de relance (à afficher dans le bloc "À relancer")
  // En cas d'échec (ex. fonctions non déployées), on garde une liste vide sans faire planter la page
  useEffect(() => {
    if (!userData?.structureId || !canRead) return;
    setRelanceSuggestionsLoading(true);
    getRelanceSuggestions(userData.structureId, 10)
      .then(setRelanceSuggestions)
      .catch(() => { setRelanceSuggestions([]); })
      .finally(() => { setRelanceSuggestionsLoading(false); });
  }, [userData?.structureId, canRead, prospects.length]);

  const fetchStructureMembers = useCallback(async () => {
    if (!userData?.structureId) return;
    try {
      const q = query(
        collection(db, 'users'),
        where('structureId', '==', userData.structureId),
        limit(150)
      );
      const snapshot = await getDocs(q);
      const members = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          displayName: data.displayName || data.name || '',
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          role: (data.role || 'membre') as StructureMember['role'],
          poles: data.poles || [],
          mandat: data.mandat
        };
      });
      const decrypted = await decryptUsersList(members);
      setStructureMembers(decrypted.map(m => ({
        id: m.id,
        displayName: m.displayName || `${m.firstName || ''} ${m.lastName || ''}`.trim() || 'Utilisateur',
        role: m.role,
        poles: m.poles,
        mandat: m.mandat
      })) as StructureMember[]);
    } catch (error) {
      console.error(error);
    }
  }, [userData?.structureId]);

  // Déchiffrer les infos prospects (téléphone, email, adresse) — batch 1 callable
  useEffect(() => {
    if (!prospects.length || !canRead) return;
    const run = async () => {
      const toDecrypt = prospects.filter(
        (prospect) =>
          prospect.id &&
          (isEncrypted(prospect.telephone) || isEncrypted(prospect.email) || isEncrypted(prospect.adresse))
      );
      if (!toDecrypt.length) return;
      try {
        const results = await batchDecryptForStructure<Partial<Prospect>>(
          'prospect',
          toDecrypt.map((p) => p.id as string),
          ['telephone', 'phone', 'email', 'adresse']
        );
        if (Object.keys(results).length) {
          setDecryptedProspects((prev) => ({ ...prev, ...results }));
        }
      } catch {
        // ignorer si déchiffrement échoue
      }
    };
    void run();
  }, [prospects, canRead]);

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
            userName: getSafeDisplayName(userData, 'Utilisateur'),
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
      const list = getFilteredProspects();
      setSelectedProspects(list.map(p => p.id));
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
      { label: 'Nouveaux', count: prospects.filter(p => p.statut === 'non_qualifie').length, color: tokens.colors.brandTeal },
      { label: 'Contactés', count: prospects.filter(p => p.statut === 'contacte').length, color: tokens.colors.brandNavy300 },
      { label: 'Négo', count: prospects.filter(p => p.statut === 'negociation').length, color: tokens.colors.brandTeal700 },
      { label: 'Clients', count: won, color: tokens.colors.success }
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
      'non_qualifie': tokens.colors.textSecondary,
      'contacte': tokens.colors.brandTeal,
      'a_recontacter': tokens.colors.warning,
      'negociation': tokens.colors.brandTeal700,
      'abandon': tokens.colors.error,
      'deja_client': tokens.colors.success
    };
    return colors[status] || tokens.colors.textSecondary;
  };

  const getProspectName = (p: Prospect) => p.nom || p.name || 'Sans nom';
  const getDisplayProspect = (p: Prospect): Prospect => ({ ...p, ...decryptedProspects[p.id] });
  const getProspectCompany = (p: Prospect) => p.entreprise || p.company || 'Sans entreprise';

  const displayProspectsList = useMemo(
    () => prospects.map(p => getDisplayProspect(p)),
    [prospects, decryptedProspects],
  );

  const commercialMembers = useMemo(
    () => structureMembers.map(m => ({ id: m.id, displayName: m.displayName })),
    [structureMembers],
  );

  const dueRelanceCount = useMemo(
    () => displayProspectsList.filter(p => {
      const t = relanceState(p.dateRecontact).tone;
      return t === 'late' || t === 'today';
    }).length,
    [displayProspectsList],
  );

  const getFilteredProspects = () => {
    return prospects.filter(p => {
      const search = searchTerm.toLowerCase();
      const displayName = getProspectName(getDisplayProspect(p));
      return (
        displayName.toLowerCase().includes(search) ||
        (p.entreprise || '').toLowerCase().includes(search) ||
        (p.email || '').toLowerCase().includes(search)
      );
    });
  };

  // Liste filtrée + triée pour la vue tableau (filtres Statut / Propriétaire + tri colonne)
  const getFilteredAndSortedProspects = useMemo(() => {
    let list = prospects.filter(p => {
      const search = searchTerm.toLowerCase();
      const displayName = getProspectName(getDisplayProspect(p));
      const matchSearch =
        displayName.toLowerCase().includes(search) ||
        (p.entreprise || '').toLowerCase().includes(search) ||
        (p.email || '').toLowerCase().includes(search);
      if (!matchSearch) return false;
      if (filterTableStatus && p.statut !== filterTableStatus) return false;
      if (filterTableOwnerId && (p.ownerId || '') !== filterTableOwnerId) return false;
      return true;
    });
    const key = sortConfig.key;
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let aVal: string | number | undefined = a[key as keyof Prospect];
      let bVal: string | number | undefined = b[key as keyof Prospect];
      if (key === 'aiScore') {
        aVal = a.aiScore ?? 0;
        bVal = b.aiScore ?? 0;
        return dir * ((aVal as number) - (bVal as number));
      }
      if (key === 'derniereInteraction' || key === 'dateAjout') {
        aVal = a.derniereInteraction || a.dateAjout || a.dateCreation || '';
        bVal = b.derniereInteraction || b.dateAjout || b.dateCreation || '';
      }
      if (key === 'ownerId') {
        aVal = getOwnerDisplayName(a.ownerId || '', structureMembers);
        bVal = getOwnerDisplayName(b.ownerId || '', structureMembers);
      }
      if (key === 'nom') {
        aVal = getProspectName(getDisplayProspect(a));
        bVal = getProspectName(getDisplayProspect(b));
      }
      if (key === 'entreprise') {
        aVal = getProspectCompany(getDisplayProspect(a));
        bVal = getProspectCompany(getDisplayProspect(b));
      }
      if (key === 'notes') {
        aVal = getDisplayProspect(a).notes || '';
        bVal = getDisplayProspect(b).notes || '';
      }
      const aStr = String(aVal ?? '');
      const bStr = String(bVal ?? '');
      if (key === 'derniereInteraction' || key === 'dateAjout' || key === 'dateCreation') {
        const aDate = new Date(aVal as string).getTime();
        const bDate = new Date(bVal as string).getTime();
        return dir * (aDate - bDate);
      }
      return dir * (aStr.localeCompare(bStr, undefined, { sensitivity: 'base' }));
    });
    return list;
  }, [prospects, searchTerm, filterTableStatus, filterTableOwnerId, sortConfig, structureMembers, decryptedProspects]);

  // Données tableau Entreprises = mêmes prospects que Pipeline/Liste, formatées par ligne (une ligne = un prospect/entreprise)
  const companiesRows = useMemo(() => {
    const list = getFilteredAndSortedProspects;
    return list.map(p => {
      const d = getDisplayProspect(p);
      const companyName = getProspectCompany(d);
      const domain = (d.email || '').includes('@') ? (d.email || '').split('@')[1] : '';
      return {
        id: p.id,
        name: companyName,
        domain: domain || '—',
        email: d.email || '',
        telephone: p.telephone || '',
        adresse: p.adresse || '',
        secteur: p.secteur || '',
        accountOwnerId: p.ownerId || '',
        createdById: p.createdBy || '',
        createdAt: p.dateAjout || p.dateCreation || '',
        aiScore: p.aiScore
      } as CompanyRow;
    });
  }, [getFilteredAndSortedProspects, decryptedProspects]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleQuickAddProspect = async () => {
    const name = quickAddName.trim();
    if (!name || !userData?.structureId || !canWrite || quickAddSubmitting) return;
    setQuickAddSubmitting(true);
    try {
      const prospectData = {
        nom: name,
        name: name,
        entreprise: '',
        email: '',
        telephone: '',
        statut: 'non_qualifie',
        structureId: userData.structureId,
        createdBy: userData.uid ?? '',
        dateAjout: new Date().toISOString(),
        dateCreation: new Date().toISOString(),
        ownerId: userData.uid ?? ''
      };
      await createProspect(prospectData as any);
      setQuickAddName('');
      setQuickAddOpen(false);
      await fetchProspects();
      await fetchStructureTokens();
    } catch (err: any) {
      console.error('Quick add prospect:', err);
      let msg = err?.message || 'Erreur lors de la création';
      if (msg.includes('token') || msg.includes('Quota') || msg.includes('quota')) {
        msg = 'Quota mensuel atteint. Impossible d\'ajouter un prospect.';
      }
      setError(msg);
      setTimeout(() => setError(null), 5000);
    } finally {
      setQuickAddSubmitting(false);
    }
  };

  const handleRowMenuOpen = (event: React.MouseEvent<HTMLElement>, prospectId: string) => {
    event.stopPropagation();
    setRowMenuAnchorEl(event.currentTarget);
    setRowMenuProspectId(prospectId);
  };

  const handleRowMenuAssign = () => {
    if (rowMenuProspectId && rowMenuAnchorEl) {
      setSelectedProspects([rowMenuProspectId]);
      setActionMenuAnchorEl(rowMenuAnchorEl);
      setRowMenuAnchorEl(null);
      setRowMenuProspectId(null);
    }
  };

  const handleRowMenuDelete = () => {
    if (rowMenuProspectId) {
      setSelectedProspects([rowMenuProspectId]);
      setRowMenuAnchorEl(null);
      setRowMenuProspectId(null);
      setIsDeleteDialogOpen(true);
    }
  };

  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const pickOptional = <T,>(arr: (T | null)[]): T | null => arr[Math.floor(Math.random() * arr.length)];

  const buildTestProspectPayload = (index: number): Record<string, unknown> => {
    const prenom = pick(TEST_PRENOMS);
    const nomFamille = pick(TEST_NOMS);
    const nomComplet = `${prenom} ${nomFamille}`;
    const entreprise = pick(TEST_ENTREPRISES);
    const baseEmail = `${prenom.toLowerCase().replace(/\s/g, '')}.${nomFamille.toLowerCase()}${index}`;
    const domain = ['gmail.com', 'outlook.fr', 'entreprise.fr', 'orange.fr', 'free.fr'][index % 5];
    const email = `${baseEmail}@${domain}`;
    const telephone = `0${Math.floor(600000000 + Math.random() * 99999999)}`;
    const ville = pick(TEST_VILLES);
    const adresse = `${Math.floor(1 + Math.random() * 120)} rue ${pick(['de la République', 'Victor Hugo', 'Jean Jaurès', 'Gambetta', 'Nationale'])}, ${ville}`;
    const statut = pick(PIPELINE_STATUSES);
    const joursOffset = Math.floor(Math.random() * 60) - 20;
    const dateInteraction = new Date();
    dateInteraction.setDate(dateInteraction.getDate() + joursOffset);
    const dateRecontact = statut === 'a_recontacter' ? (() => { const d = new Date(); d.setDate(d.getDate() + Math.floor(Math.random() * 14)); return d.toISOString().split('T')[0]; })() : undefined;
    return {
      nom: nomComplet,
      name: nomComplet,
      entreprise,
      company: entreprise,
      email,
      telephone,
      poste: pick(TEST_POSTES),
      title: pick(TEST_POSTES),
      adresse,
      secteur: pick(TEST_SECTEURS),
      taille: pick(TEST_TAILLES),
      source: pick(TEST_SOURCES),
      notes: pickOptional(TEST_NOTES) ?? '',
      statut,
      valeurPotentielle: Math.floor(5000 + Math.random() * 45000),
      linkedinUrl: `https://linkedin.com/in/${baseEmail.replace(/\./g, '-')}`,
      location: ville,
      ...(dateRecontact ? { dateRecontact } : {}),
      dateAjout: dateInteraction.toISOString(),
      dateCreation: dateInteraction.toISOString(),
      derniereInteraction: dateInteraction.toISOString(),
      favori: Math.random() > 0.85,
      structureId: userData?.structureId || '',
      createdBy: userData?.uid || '',
      ownerId: structureMembers.length > 0 ? pick(structureMembers).id : (userData?.uid ?? '')
    };
  };

  const handleGenerateTestProspects = async () => {
    if (!userData?.structureId || !canWrite || generateTestSubmitting) return;
    const count = Math.min(20, Math.max(1, generateTestCount));
    setGenerateTestSubmitting(true);
    setError(null);
    let created = 0;
    let failed = 0;
    try {
      for (let i = 0; i < count; i++) {
        try {
          const raw = buildTestProspectPayload(i);
          const payload = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined)) as any;
          await createProspect(payload);
          created++;
        } catch (e) {
          console.error('Création prospect test:', e);
          failed++;
          if (failed >= 3) break;
        }
      }
      setIsGenerateTestDialogOpen(false);
      await fetchProspects();
      await fetchStructureTokens();
      if (created > 0) setError(null);
      if (failed > 0 && created === 0) setError('Quota de tokens insuffisant ou erreur. Aucun prospect créé.');
      else if (created < count) setError(`${created} prospect(s) créé(s). ${count - created - failed} non créés (quota ou erreur).`);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la génération.');
    } finally {
      setGenerateTestSubmitting(false);
    }
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
          userName: getSafeDisplayName(userData, 'Utilisateur'),
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
        userName: getSafeDisplayName(userData, 'Utilisateur'),
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
        const dp = getDisplayProspect(prospect);
        const prospectName = dp.nom || dp.name || 'Contact';
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
          description: `Relance prévue pour ${prospectName}${dp.entreprise ? ` - ${dp.entreprise}` : ''}`,
          updatedAt: serverTimestamp()
        });
      } else {
        // Créer un nouvel événement de calendrier pour la relance
        const dp = getDisplayProspect(prospect);
        const prospectName = dp.nom || dp.name || 'Contact';
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
          description: `Relance prévue pour ${prospectName}${dp.entreprise ? ` - ${dp.entreprise}` : ''}`,
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

  const openRelanceSchedule = useCallback((prospectId: string, anchor?: HTMLElement | null) => {
    const prospect = prospects.find(p => p.id === prospectId);
    const defaultDate = prospect?.dateRecontact || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      return toIsoDate(d);
    })();
    setRelanceProspectId(prospectId);
    setRelanceDate(defaultDate);
    if (anchor) {
      setRelancePopoverAnchor(anchor);
      return;
    }
    const centerElement = document.createElement('div');
    centerElement.style.position = 'fixed';
    centerElement.style.top = '50%';
    centerElement.style.left = '50%';
    centerElement.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(centerElement);
    setRelancePopoverAnchor(centerElement);
  }, [prospects]);

  const handleMarkRelanceDone = useCallback(async (prospect: Prospect) => {
    if (!currentUser || !canWrite) return;
    try {
      await updateDoc(doc(db, 'prospects', prospect.id), {
        dateRecontact: null,
        updatedAt: serverTimestamp(),
      });
      const activitiesRef = collection(db, 'prospects', prospect.id, 'activities');
      await addDoc(activitiesRef, {
        type: 'modification',
        userId: currentUser.uid,
        userName: getSafeDisplayName(userData, 'Utilisateur'),
        timestamp: serverTimestamp(),
        details: {
          field: 'Relance',
          oldValue: prospect.dateRecontact || 'Programmée',
          newValue: 'Effectuée',
        },
      });
      setProspects(prev => prev.map(p => (p.id === prospect.id ? { ...p, dateRecontact: undefined } : p)));
      setRelancesDoneToday(prev => prev + 1);
      await fetchCalendarEvents();
    } catch (err) {
      console.error('Erreur marquage relance faite:', err);
    }
  }, [currentUser, canWrite, userData?.displayName, fetchCalendarEvents]);

  const handleSnoozeRelance = useCallback(async (prospect: Prospect, days: number) => {
    if (!currentUser || !canWrite) return;
    const base = prospect.dateRecontact ? new Date(prospect.dateRecontact) : new Date();
    base.setDate(base.getDate() + days);
    const next = toIsoDate(base);
    setRelanceProspectId(prospect.id);
    setRelanceDate(next);
    try {
      await updateDoc(doc(db, 'prospects', prospect.id), {
        dateRecontact: next,
        updatedAt: serverTimestamp(),
      });
      setProspects(prev => prev.map(p => (p.id === prospect.id ? { ...p, dateRecontact: next } : p)));
      await fetchCalendarEvents();
    } catch (err) {
      console.error('Erreur report relance:', err);
    } finally {
      setRelanceProspectId(null);
      setRelanceDate('');
    }
  }, [currentUser, canWrite, fetchCalendarEvents]);

  const commercialActions = useMemo(() => ({
    onOpen: (id: string) => navigate(`/app/prospect/${id}`),
    onAdd: () => setIsCreateDialogOpen(true),
    onScheduleRelance: (p: Prospect, anchor?: HTMLElement | null) => openRelanceSchedule(p.id, anchor ?? null),
    onMarkDone: (p: Prospect) => { void handleMarkRelanceDone(p); },
    onSnooze: (p: Prospect, days: number) => { void handleSnoozeRelance(p, days); },
    onCompose: (p: Prospect) => {
      const email = getDisplayProspect(p).email;
      if (email) window.location.href = `mailto:${email}`;
    },
    onLog: (p: Prospect) => navigate(`/app/prospect/${p.id}`),
  }), [navigate, openRelanceSchedule, handleMarkRelanceDone, handleSnoozeRelance, decryptedProspects]);

  // --- SUB-COMPONENTS RENDER ---

  const renderKPIs = () => (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
      <KpiCard label="Total Prospects" value={stats.total} delta={12} deltaSuffix="%" sparkColor={tokens.colors.brandTeal} />
      <KpiCard label="Pipeline Actif" value={stats.active} sparkColor={tokens.colors.warning} />
      <KpiCard label="Taux de Conversion" value={`${stats.winRate}%`} sparkColor={tokens.colors.success} />
    </Box>
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
                  bgcolor: tokens.colors.textPrimary,
                  maxWidth: 320,
                  fontSize: '0.875rem',
                  '& .MuiTooltip-arrow': {
                    color: tokens.colors.textPrimary
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
                  boxShadow: tokens.shadows.lg
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
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: tokens.colors.textPrimary }}>
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
                  bgcolor: tokens.colors.borderLight,
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
                  onClick={() => navigate(`/app/prospect/${p.id}`)}
                  sx={{
                    px: 0, 
                    py: 1.5, 
                    borderBottom: `1px solid ${tokens.colors.bgSubtle}`,
                    '&:last-child': { borderBottom: 'none' }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: `${getStatusColor(p.statut)}20`, color: getStatusColor(p.statut), fontSize: '0.8rem', fontWeight: 700 }}>
                      {getProspectName(getDisplayProspect(p)).charAt(0)}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText 
                    primary={<Typography variant="subtitle2" fontWeight={600} noWrap>{getProspectName(getDisplayProspect(p))}</Typography>}
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'text.secondary', bgcolor: tokens.colors.bgSubtle, p: 1, borderRadius: tokens.radius.sm }}>
                    <CheckCircleIcon sx={{ color: '#34c759', fontSize: 20 }} />
                    <Typography variant="caption" fontWeight={600}>Aucune relance urgente</Typography>
                </Box>
                
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: 'text.primary' }}>Prochain événement :</Typography>
                
                <Paper 
                    elevation={0}
                    sx={{ 
                        p: 2, 
                        bgcolor: 'white', 
                        borderRadius: tokens.radius.md, 
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
                            sx={{ bgcolor: tokens.colors.bgSubtle, fontWeight: 700, fontSize: '0.7rem', height: 22, color: 'text.secondary' }} 
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
                <ListItem key={e.id} sx={{ px: 0, py: 1.5, borderBottom: `1px solid ${tokens.colors.bgSubtle}`, '&:last-child': { borderBottom: 'none' } }}>
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
          <Box sx={{ p: 3, bgcolor: '#fbfbfd', borderBottom: `1px solid ${tokens.colors.borderLight}` }}>
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
                      bgcolor: tokens.colors.borderLight,
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
                        borderBottom: i === 0 ? '1px solid #e5e5ea' : `1px dashed ${tokens.colors.borderLight}`,
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
                            bgcolor: tokens.colors.bgSubtle, 
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
                    bgcolor: snapshot.isDraggingOver ? `${getStatusColor(status)}10` : tokens.colors.bgSubtle,
                    borderRadius: tokens.radius.lg,
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
                          onClick={() => navigate(`/app/prospect/${prospect.id}`)}
                            sx={{
                              p: 2,
                            mb: 1.5,
                            borderRadius: tokens.radius.md,
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
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                             <Chip 
                              label={getOwnerDisplayName(prospect.ownerId || '', structureMembers)} 
                              size="small" 
                              sx={{ bgcolor: `${getStatusColor(status)}15`, color: getStatusColor(status), fontWeight: 700, fontSize: '0.7rem', height: 20 }} 
                            />
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {typeof prospect.aiScore === 'number' && (
                                <Chip
                                  label={prospect.aiScore}
                                  size="small"
                                  sx={{ height: 20, minWidth: 28, fontWeight: 700, fontSize: '0.7rem', bgcolor: prospect.aiScore >= 70 ? 'rgba(52, 199, 89, 0.2)' : prospect.aiScore >= 40 ? 'rgba(255, 159, 10, 0.2)' : 'rgba(142, 142, 147, 0.2)', color: prospect.aiScore >= 70 ? '#34c759' : prospect.aiScore >= 40 ? '#ff9f0a' : '#8e8e93' }}
                                />
                              )}
                              {relanceSuggestions.some(r => r.id === prospect.id) && (
                                <RelancePill label="Relancer" tone="late" size="sm" />
                              )}
                              {prospect.favori && <TrophyIcon sx={{ fontSize: 16, color: '#ffd700' }} />}
                            </Box>
                            </Box>
                          <Typography variant="subtitle2" fontWeight={600} noWrap title={getProspectName(getDisplayProspect(prospect))}>
                            {getProspectName(getDisplayProspect(prospect))}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            <BusinessIcon sx={{ fontSize: 14 }} /> {getProspectCompany(getDisplayProspect(prospect))}
                          </Typography>
                          {(getDisplayProspect(prospect).notes || '').trim() && (
                            <Typography variant="caption" sx={{ mt: 1, display: 'block', lineHeight: 1.3 }} color="text.secondary" noWrap title={(getDisplayProspect(prospect).notes || '').trim()}>
                              {(getDisplayProspect(prospect).notes || '').trim().slice(0, 60)}
                              {(getDisplayProspect(prospect).notes || '').trim().length > 60 ? '…' : ''}
                            </Typography>
                          )}
                          {getDaysSinceInteraction(prospect.derniereInteraction) > 10 && !relanceSuggestions.some(r => r.id === prospect.id) && (
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

  const filteredSortedList = getFilteredAndSortedProspects;
  const allSelectedInView = filteredSortedList.length > 0 && selectedProspects.length === filteredSortedList.length;
  const displayColumns = visibleTableColumns.length > 0 ? visibleTableColumns : TABLE_COLUMNS.map(c => c.id);

  const renderTable = () => (
    <TableContainer
      sx={{
        borderRadius: tokens.radius.md,
        overflow: 'hidden',
        border: '1px solid #e5e5ea',
        boxShadow: APPLE_SHADOWS.small
      }}
    >
      <Table size="medium">
        <TableHead>
          <TableRow sx={{ bgcolor: tokens.colors.bgSubtle, borderBottom: '1px solid #d2d2d7' }}>
            <TableCell padding="checkbox" sx={{ fontWeight: 600, color: tokens.colors.textPrimary, borderBottom: '1px solid #d2d2d7' }}>
              <Checkbox
                indeterminate={selectedProspects.length > 0 && selectedProspects.length < filteredSortedList.length}
                checked={filteredSortedList.length > 0 && allSelectedInView}
                onChange={handleSelectAll}
              />
            </TableCell>
            {TABLE_COLUMNS.filter(c => displayColumns.includes(c.id)).map(col => (
              <TableCell
                key={col.id}
                sortDirection={sortConfig.key === col.sortKey ? sortConfig.direction : false}
                sx={{ fontWeight: 600, color: tokens.colors.textPrimary, borderBottom: '1px solid #d2d2d7', whiteSpace: 'nowrap' }}
              >
                <TableSortLabel
                  active={sortConfig.key === col.sortKey}
                  direction={sortConfig.key === col.sortKey ? sortConfig.direction : 'asc'}
                  onClick={() => handleSort(col.sortKey)}
                >
                  {col.id === 'nom' && canWrite ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Tooltip title="Ajouter un prospect">
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); setQuickAddOpen(true); }}
                          sx={{ p: 0.25, color: APPLE_COLORS.primary }}
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {col.label}
                    </Box>
                  ) : (
                    col.label
                  )}
                </TableSortLabel>
              </TableCell>
            ))}
            <TableCell padding="checkbox" sx={{ fontWeight: 600, color: tokens.colors.textPrimary, borderBottom: '1px solid #d2d2d7', width: 48 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {quickAddOpen && canWrite && (
            <TableRow sx={{ bgcolor: '#f0f8ff', borderBottom: '1px solid #e5e5ea' }}>
              <TableCell padding="checkbox" />
              <TableCell colSpan={displayColumns.length}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    autoFocus
                    size="small"
                    placeholder="Nom du prospect (Entrée pour enregistrer)"
                    value={quickAddName}
                    onChange={(e) => setQuickAddName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleQuickAddProspect();
                      if (e.key === 'Escape') { setQuickAddOpen(false); setQuickAddName(''); }
                    }}
                    onBlur={() => { if (!quickAddName.trim()) setQuickAddOpen(false); }}
                    sx={{ flex: 1, maxWidth: 360 }}
                    InputProps={{ sx: { borderRadius: tokens.radius.sm, bgcolor: 'white' } }}
                  />
                  <Button size="small" variant="contained" onClick={handleQuickAddProspect} disabled={!quickAddName.trim() || quickAddSubmitting} sx={{ borderRadius: tokens.radius.sm, bgcolor: APPLE_COLORS.primary }}>
                    {quickAddSubmitting ? <CircularProgress size={20} color="inherit" /> : 'Ajouter'}
                  </Button>
                  <IconButton size="small" onClick={() => { setQuickAddOpen(false); setQuickAddName(''); }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              </TableCell>
              <TableCell padding="checkbox" />
            </TableRow>
          )}
          {filteredSortedList.map(p => {
            const isSelected = selectedProspects.indexOf(p.id) !== -1;
            return (
              <StyledTableRow
                key={p.id}
                onClick={() => navigate(`/app/prospect/${p.id}`)}
                sx={{ cursor: 'pointer' }}
                selected={isSelected}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onClick={(e) => { e.stopPropagation(); handleSelectOne(e, p.id); }}
                  />
                </TableCell>
                {displayColumns.includes('notes') && (
                  <TableCell sx={{ maxWidth: 220 }}>
                    <Tooltip title={(getDisplayProspect(p).notes || '').trim() || '—'} placement="top-start">
                      <Typography variant="body2" noWrap sx={{ maxWidth: 220 }} color="text.secondary">
                        {(getDisplayProspect(p).notes || '').trim() || '—'}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                )}
                {displayColumns.includes('nom') && (
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: tokens.colors.borderLight, color: tokens.colors.textPrimary, fontSize: '0.875rem', fontWeight: 600 }}>
                        {getProspectName(getDisplayProspect(p)).charAt(0)}
                      </Avatar>
                      <Typography variant="body2" fontWeight={500}>{getProspectName(getDisplayProspect(p))}</Typography>
                    </Box>
                  </TableCell>
                )}
                {displayColumns.includes('entreprise') && (
                  <TableCell>{getProspectCompany(getDisplayProspect(p))}</TableCell>
                )}
                {displayColumns.includes('statut') && (
                  <TableCell>
                    <StyledChip
                      label={getStatusLabel(p.statut)}
                      sx={{ bgcolor: `${getStatusColor(p.statut)}20`, color: getStatusColor(p.statut) }}
                    />
                  </TableCell>
                )}
                {displayColumns.includes('aiScore') && (
                  <TableCell>
                    {typeof p.aiScore === 'number' ? (
                      <Chip
                        size="small"
                        label={p.aiScore}
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          bgcolor: p.aiScore >= 70 ? 'rgba(52, 199, 89, 0.15)' : p.aiScore >= 40 ? 'rgba(255, 159, 10, 0.15)' : 'rgba(142, 142, 147, 0.15)',
                          color: p.aiScore >= 70 ? '#34c759' : p.aiScore >= 40 ? '#ff9f0a' : '#8e8e93',
                          borderRadius: tokens.radius.sm,
                        }}
                      />
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                )}
                {displayColumns.includes('ownerId') && (
                  <TableCell>{getOwnerDisplayName(p.ownerId || '', structureMembers)}</TableCell>
                )}
                {displayColumns.includes('derniereInteraction') && (
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(p.derniereInteraction || p.dateAjout || '').toLocaleDateString()}
                    </Typography>
                  </TableCell>
                )}
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <IconButton size="small" onClick={(e) => handleRowMenuOpen(e, p.id)} aria-label="Menu">
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
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

  const getCompanyUser = (id: string) => {
    const m = structureMembers.find(m => m.id === id);
    return m ? { id: m.id, name: m.displayName } : { id: '', name: 'Non assigné' };
  };
  const saveCompaniesCell = useCallback(async (rowId: string, colId: string, value: string) => {
    const patch: Partial<Prospect> =
      colId === 'accountOwnerId' ? { ownerId: value || undefined } :
      colId === 'email' ? { email: value } :
      colId === 'telephone' ? { telephone: value } :
      colId === 'adresse' ? { adresse: value } :
      colId === 'secteur' ? { secteur: value } : {};
    if (Object.keys(patch).length === 0) {
      setEditingCell(null);
      setEditingValue('');
      return;
    }
    try {
      await updateProspect(rowId, patch);
      await fetchProspects();
    } catch (e) {
      console.error('Erreur mise à jour prospect:', e);
    }
    setEditingCell(null);
    setEditingValue('');
  }, [fetchProspects]);

  // Construction des colonnes Entreprises : ordre + visibilité depuis state, avec size/minSize pour resize
  const companiesColumns = useMemo(() => {
    const metaById = Object.fromEntries(ENTREPRISE_COLUMNS_META.map(c => [c.id, c]));
    const orderedIds = companiesColumnOrder.filter(id => companiesVisibleColumnIds.includes(id));
    const renderCell = (colId: string, row: CompanyRow) => {
      const isEditing = editingCell?.rowId === row.id && editingCell?.colId === colId;
      const startEdit = () => { setEditingCell({ rowId: row.id, colId }); setEditingValue(String((row as any)[colId] ?? '')); };
      if (colId === 'name') {
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-sm">{row.name.charAt(0)}</div>
            <span className="font-medium text-gray-900">{row.name}</span>
          </div>
        );
      }
      if (colId === 'domain' || colId === 'email' || colId === 'telephone' || colId === 'adresse' || colId === 'secteur') {
        const val = (row as any)[colId] ?? '';
        if (isEditing) {
          return (
            <input
              className="w-full px-2 py-1 border-2 border-blue-500 rounded outline-none min-w-0"
              value={editingValue}
              onChange={e => setEditingValue(e.target.value)}
              onBlur={() => saveCompaniesCell(row.id, colId, editingValue)}
              onKeyDown={e => { if (e.key === 'Enter') saveCompaniesCell(row.id, colId, editingValue); }}
              onClick={e => e.stopPropagation()}
              autoFocus
            />
          );
        }
        return (
          <div className="cursor-pointer py-1 px-2 rounded hover:bg-gray-50 min-h-[28px] flex items-center truncate" onClick={e => { e.stopPropagation(); startEdit(); }} title={val}>
            {val || '—'}
          </div>
        );
      }
      if (colId === 'accountOwnerId') {
        const owner = getCompanyUser(row.accountOwnerId);
        if (isEditing) {
          return (
            <div className="min-w-[140px]" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
              <Autocomplete
                size="small"
                options={structureMembers}
                getOptionLabel={o => o.displayName}
                value={structureMembers.find(u => u.id === editingValue) ?? { id: row.accountOwnerId, displayName: owner.name, role: 'membre' as const }}
                onChange={(_, v) => { if (v) saveCompaniesCell(row.id, 'accountOwnerId', v.id); }}
                onBlur={() => setEditingCell(null)}
                renderInput={params => <TextField {...params} variant="outlined" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }} />}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>{option.displayName.charAt(0)}</Avatar>{option.displayName}</Box></li>
                )}
              />
            </div>
          );
        }
        return (
          <div className="cursor-pointer py-1 px-2 rounded hover:bg-gray-50 min-h-[28px] flex items-center gap-2" onClick={e => { e.stopPropagation(); startEdit(); }}>
            <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: tokens.colors.brandTeal, color: 'white' }}>{owner.name.charAt(0)}</Avatar>
            <span className="text-gray-900 truncate">{owner.name}</span>
          </div>
        );
      }
      if (colId === 'aiScore') {
        const score = row.aiScore;
        return typeof score === 'number' ? (
          <Chip
            size="small"
            label={score}
            sx={{
              fontWeight: 600,
              fontSize: '0.75rem',
              bgcolor: score >= 70 ? 'rgba(52, 199, 89, 0.15)' : score >= 40 ? 'rgba(255, 159, 10, 0.15)' : 'rgba(142, 142, 147, 0.15)',
              color: score >= 70 ? '#34c759' : score >= 40 ? '#ff9f0a' : '#8e8e93',
              borderRadius: tokens.radius.sm,
            }}
          />
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        );
      }
      if (colId === 'createdById') {
        const creator = getCompanyUser(row.createdById);
        return (
          <div className="flex items-center gap-2 py-1">
            <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: '#34c759', color: 'white' }}>{creator.name.charAt(0)}</Avatar>
            <span className="text-gray-600 truncate">{creator.name}</span>
          </div>
        );
      }
      if (colId === 'createdAt') return <span className="text-gray-500 text-sm">{formatElapsed(row.createdAt)}</span>;
      return null;
    };
    return orderedIds.map(id => {
      const meta = metaById[id];
      if (!meta) return null;
      return {
        id: meta.id,
        header: meta.label,
        accessorFn: (row: CompanyRow) => (row as any)[meta.id],
        size: companiesColumnSizing[meta.id] ?? meta.defaultSize,
        minSize: meta.minSize,
        enableResizing: true,
        cell: ({ row }: { row: { original: CompanyRow } }) => renderCell(meta.id, row.original)
      };
    }).filter(Boolean) as ColumnDef<CompanyRow, unknown>[];
  }, [editingCell, editingValue, saveCompaniesCell, companiesVisibleColumnIds, companiesColumnOrder, companiesColumnSizing, structureMembers]);

  const companiesFiltered = useMemo(() => {
    const q = companiesSearch.toLowerCase().trim();
    if (!q) return companiesRows;
    return companiesRows.filter(c =>
      c.name.toLowerCase().includes(q) || (c.domain || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) || (c.secteur || '').toLowerCase().includes(q)
    );
  }, [companiesRows, companiesSearch]);

  const companiesTable = useReactTable({
    data: companiesFiltered,
    columns: companiesColumns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnOrder: companiesColumnOrder,
      columnSizing: companiesColumnSizing
    },
    onColumnOrderChange: updater => setCompaniesColumnOrder(updater instanceof Function ? updater(companiesColumnOrder) : updater),
    onColumnSizingChange: updater => setCompaniesColumnSizing(updater instanceof Function ? updater(companiesColumnSizing) : updater),
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    defaultColumn: { minSize: 60 }
  });

  const handleCompaniesColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const visibleOrder = companiesColumnOrder.filter(id => companiesVisibleColumnIds.includes(id));
    const oldIndex = visibleOrder.indexOf(active.id as string);
    const newIndex = visibleOrder.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const newVisibleOrder = arrayMove(visibleOrder, oldIndex, newIndex);
    const hidden = companiesColumnOrder.filter(id => !companiesVisibleColumnIds.includes(id));
    setCompaniesColumnOrder([...newVisibleOrder, ...hidden]);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));

  const renderCompaniesView = () => (
    <Box sx={{ minHeight: '600px', bgcolor: '#fff' }} className="rounded-xl overflow-hidden border border-gray-200 flex flex-col">
      {/* Barre : recherche + bouton Colonnes (plus de sidebar gauche) */}
      <div className="flex items-center justify-between gap-3 p-3 border-b border-gray-200 flex-shrink-0">
        <TextField
          size="small"
          placeholder="Recherche globale..."
          value={companiesSearch}
          onChange={e => setCompaniesSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#6b7280', fontSize: 20 }} /></InputAdornment>,
            sx: { borderRadius: tokens.radius.sm, bgcolor: '#f9fafb' }
          }}
          sx={{ maxWidth: 320 }}
        />
        <Tooltip title="Choisir les colonnes à afficher">
          <Button
            size="small"
            startIcon={<ViewColumnIcon />}
            onClick={e => setCompaniesColumnPickerAnchor(e.currentTarget)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Colonnes
          </Button>
        </Tooltip>
      </div>
      {/* Popover : choix des colonnes (tous les champs DB) */}
      <Popover
        open={Boolean(companiesColumnPickerAnchor)}
        anchorEl={companiesColumnPickerAnchor}
        onClose={() => setCompaniesColumnPickerAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { borderRadius: tokens.radius.md, p: 1.5, minWidth: 260 } }}
      >
        <Typography variant="subtitle2" fontWeight={700} sx={{ px: 1, py: 0.5, mb: 0.5 }}>Colonnes visibles</Typography>
        <List dense>
          {ENTREPRISE_COLUMNS_META.map(col => (
            <ListItem key={col.id} disablePadding>
              <ListItemButton dense onClick={() => setCompaniesVisibleColumnIds(prev => prev.includes(col.id) ? prev.filter(c => c !== col.id) : [...prev, col.id].sort((a, b) => companiesColumnOrder.indexOf(a) - companiesColumnOrder.indexOf(b)))}>
                <Checkbox checked={companiesVisibleColumnIds.includes(col.id)} disableRipple size="small" sx={{ mr: 1 }} />
                <ListItemText primary={col.label} primaryTypographyProps={{ variant: 'body2' }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Popover>
      {/* Table : scroll horizontal, en-têtes sticky, resize au hover, réordonnancement drag */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCompaniesColumnDragEnd}>
          <table className="border-collapse" style={{ minWidth: '100%', tableLayout: 'fixed' }}>
            <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
              {companiesTable.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  <SortableContext items={hg.headers.map(h => h.column.id)} strategy={horizontalListSortingStrategy}>
                    {hg.headers.map(header => (
                      <SortableTh
                        key={header.id}
                        header={header}
                        title={ENTREPRISE_COLUMNS_META.find(m => m.id === header.column.id)?.label ?? String(header.column.columnDef.header)}
                      />
                    ))}
                  </SortableContext>
                </tr>
              ))}
            </thead>
            <tbody>
              {companiesTable.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  className="border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer"
                  onClick={() => navigate(`/app/prospect/${row.original.id}`)}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="py-2 px-4 align-middle truncate" style={{ width: cell.column.getSize(), minWidth: cell.column.getSize(), maxWidth: cell.column.getSize() }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </DndContext>
      </div>
    </Box>
  );

  // --- MAIN RENDER ---

  if (loading || permissionLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;

  // Afficher l'accès refusé si l'utilisateur n'a pas les permissions de lecture
  if (!canRead) {
    return (
      <AccessDenied 
        pageName="Pilotage Commercial" 
        message="Vous n'avez pas les permissions nécessaires pour accéder à cette page."
      />
    );
  }

  return (
    <AppPageShell
      eyebrow="Commercial"
      title="Pilotage Commercial"
      actions={
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {canWrite && selectedProspects.length > 0 && (
            <>
          <StyledButton
            variant="outlined"
                startIcon={<PersonIcon />}
                onClick={(e) => setActionMenuAnchorEl(e.currentTarget)}
            sx={{
                  borderColor: APPLE_COLORS.primary,
                  color: APPLE_COLORS.primary,
              '&:hover': {
                borderColor: tokens.colors.brandTeal700,
                bgcolor: tokens.colors.primaryAlpha10,
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
                borderColor: tokens.colors.error,
                color: tokens.colors.error,
                '&:hover': {
                  borderColor: tokens.colors.error,
                  bgcolor: tokens.colors.errorLight,
                }
              }}
            >
                Supprimer ({selectedProspects.length})
            </StyledButton>
            </>
          )}
          {isSuperAdmin && (
            <Tooltip title="Générer des prospects de test avec des données complètes (nom, entreprise, email, téléphone, adresse, secteur, etc.). Utilise les tokens de la structure.">
              <StyledButton
                variant="outlined"
                startIcon={<RocketIcon />}
                onClick={() => setIsGenerateTestDialogOpen(true)}
                sx={{
                  borderColor: tokens.colors.success,
                  color: tokens.colors.success,
                  '&:hover': { borderColor: tokens.colors.brandTeal700, bgcolor: tokens.colors.successLight }
                }}
              >
                Prospects de test
              </StyledButton>
            </Tooltip>
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
                  bgcolor: tokens.colors.textPrimary,
                  maxWidth: 400,
                  fontSize: '0.875rem',
                  '& .MuiTooltip-arrow': {
                    color: tokens.colors.textPrimary
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
                  bgcolor: tokens.colors.primaryAlpha10,
                  borderColor: tokens.colors.brandTeal700
                }
              }}
            >
              Extension JSConnect
            </StyledButton>
          </Tooltip>
          {canWrite && (
            <>
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
                  '&:hover': { bgcolor: tokens.colors.brandTeal700 },
                  '&:disabled': {
                    bgcolor: tokens.colors.gray200,
                    color: tokens.colors.textSecondary
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
            </>
          )}
        </Box>
      }
    >
    <Box sx={{ bgcolor: tokens.colors.surfaceAlt, minHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>

      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ m: 2, mb: 0, borderRadius: tokens.radius.md }}
        >
          {error}
        </Alert>
      )}

      <Box sx={{ px: 2, pt: 2, pb: 1, flexShrink: 0 }}>
        <CommercialViewTabs
          active={viewMode}
          onChange={id => setViewMode(id as CommercialViewId)}
          tabs={[
            { id: 'today', label: "Aujourd'hui", icon: <TodayIcon sx={{ fontSize: 16, color: viewMode === 'today' ? tokens.colors.brandTeal : tokens.colors.gray400 }} />, count: dueRelanceCount || undefined },
            { id: 'agenda', label: 'Agenda', icon: <CalendarMonthIcon sx={{ fontSize: 16, color: viewMode === 'agenda' ? tokens.colors.brandTeal : tokens.colors.gray400 }} /> },
            { id: 'table', label: 'Table', icon: <TableChartIcon sx={{ fontSize: 16, color: viewMode === 'table' ? tokens.colors.brandTeal : tokens.colors.gray400 }} />, count: prospects.length || undefined },
          ]}
        />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, bgcolor: tokens.colors.bgPaper, borderTop: `1px solid ${tokens.colors.divider}` }}>
        {viewMode === 'today' && (
          <CommercialTodayView
            prospects={displayProspectsList}
            members={commercialMembers}
            currentUserId={userData?.uid}
            currentUserName={userData?.displayName || 'vous'}
            doneToday={relancesDoneToday}
            objective={objectiveTarget}
            act={commercialActions}
            getName={getProspectName}
            getCompany={getProspectCompany}
          />
        )}
        {viewMode === 'agenda' && (
          <CommercialAgendaView
            prospects={displayProspectsList}
            events={events}
            members={commercialMembers}
            canWrite={canWrite}
            act={commercialActions}
            getName={getProspectName}
            getCompany={getProspectCompany}
          />
        )}
        {viewMode === 'table' && (
          <CommercialTableView
            prospects={displayProspectsList}
            members={commercialMembers}
            canWrite={canWrite}
            search={searchTerm}
            onSearchChange={setSearchTerm}
            filterStatus={filterTableStatus}
            onFilterStatusChange={setFilterTableStatus}
            filterOwnerId={filterTableOwnerId}
            onFilterOwnerIdChange={setFilterTableOwnerId}
            selectedIds={selectedProspects}
            onToggleAll={setSelectedProspects}
            onToggleOne={id => setSelectedProspects(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))}
            act={commercialActions}
            getName={getProspectName}
            getCompany={getProspectCompany}
          />
        )}
      </Box>

      {/* Menu d'assignation */}
      <Menu
        anchorEl={actionMenuAnchorEl}
        open={Boolean(actionMenuAnchorEl)}
        onClose={() => setActionMenuAnchorEl(null)}
        PaperProps={{ sx: { maxHeight: 400 } }}
      >
        {[
          <MenuItem key="title" disabled sx={{ opacity: 1, fontWeight: 700, color: 'text.primary' }}>Assigner à :</MenuItem>,
          <Divider key="div" />,
          ...(assignableMembers.length === 0
            ? [<MenuItem key="empty" disabled>Aucun membre du pôle commercial trouvé</MenuItem>]
            : assignableMembers.reduce((acc, member, index) => {
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
                  <MenuItem key={member.id} onClick={() => handleAssignProspects(member.id)} sx={{ pl: 4 }}>
                    <Avatar sx={{ width: 24, height: 24, mr: 1, fontSize: '0.7rem' }}>{member.displayName.charAt(0)}</Avatar>
                    <UserNameText user={member} component="span" />
                  </MenuItem>
                );
                return acc;
              }, [] as React.ReactNode[])
          )
        ]}
      </Menu>

      {/* Popover Personnaliser les colonnes (vue Liste) */}
      <Popover
        open={Boolean(tableColumnCustomizeAnchor)}
        anchorEl={tableColumnCustomizeAnchor}
        onClose={() => setTableColumnCustomizeAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { borderRadius: tokens.radius.md, p: 1, minWidth: 220 } }}
      >
        <Typography variant="subtitle2" fontWeight={700} sx={{ px: 1.5, py: 1 }}>Colonnes visibles</Typography>
        <List dense>
          {TABLE_COLUMNS.map(col => (
            <ListItem key={col.id} disablePadding>
              <ListItemButton dense onClick={() => setVisibleTableColumns(prev => prev.includes(col.id) ? prev.filter(c => c !== col.id) : [...prev, col.id].sort((a, b) => TABLE_COLUMNS.findIndex(x => x.id === a) - TABLE_COLUMNS.findIndex(x => x.id === b)))}>
                <Checkbox checked={visibleTableColumns.includes(col.id)} disableRipple size="small" sx={{ mr: 1 }} />
                <ListItemText primary={col.label} primaryTypographyProps={{ variant: 'body2' }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Popover>

      {/* Menu contextuel par ligne (vue Liste) */}
      <Menu
        anchorEl={rowMenuAnchorEl}
        open={Boolean(rowMenuAnchorEl)}
        onClose={() => { setRowMenuAnchorEl(null); setRowMenuProspectId(null); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { borderRadius: tokens.radius.md, minWidth: 180 } }}
      >
        <MenuItem
          onClick={() => {
            if (rowMenuProspectId) navigate(`/app/prospect/${rowMenuProspectId}`);
            setRowMenuAnchorEl(null);
            setRowMenuProspectId(null);
          }}
        >
          <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Ouvrir</ListItemText>
        </MenuItem>
        {canWrite && (
          <MenuItem key="assign" onClick={handleRowMenuAssign}>
            <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Assigner</ListItemText>
          </MenuItem>
        )}
        {canWrite && (
          <MenuItem
            key="delete"
            onClick={handleRowMenuDelete}
            sx={{ color: APPLE_COLORS.error }}
          >
            <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: APPLE_COLORS.error }} /></ListItemIcon>
            <ListItemText>Supprimer</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Dialog: Import CSV */}
      <Dialog
        open={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: tokens.radius.lg } }}
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
        PaperProps={{ sx: { borderRadius: tokens.radius.lg } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Nouveau Dossier Prospect</DialogTitle>
        <DialogContent>
          {structureTokens && structureTokens.tokensRemaining === 0 && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 2, 
                borderRadius: tokens.radius.md,
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
            <Alert severity="info" sx={{ mb: 2, borderRadius: tokens.radius.md }}>
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
                color: tokens.colors.textSecondary
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
        PaperProps={{ sx: { borderRadius: tokens.radius.xxl, height: '80vh', overflow: 'hidden' } }}
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
                    sx: { borderRadius: tokens.radius.md, bgcolor: tokens.colors.bgSubtle, '& fieldset': { border: 'none' } },
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
                    sx: { borderRadius: tokens.radius.md, bgcolor: tokens.colors.bgSubtle, '& fieldset': { border: 'none' } },
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
                        borderRadius: tokens.radius.md
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
                            <Box key={`devco-${mandat}`} sx={{ borderBottom: `1px solid ${tokens.colors.bgSubtle}` }}>
                              <ListSubheader 
                                sx={{ 
                                  bgcolor: tokens.colors.bgSubtle,
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
                                      primary={<UserNameText user={member} component="span" />}
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
                            <Box key={`other-${mandat}`} sx={{ borderBottom: `1px solid ${tokens.colors.bgSubtle}` }}>
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
                                      primary={<UserNameText user={member} component="span" />}
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
                    sx={{ bgcolor: APPLE_COLORS.primary, py: 1.5, borderRadius: tokens.radius.md, fontSize: '1rem' }}
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
              <IconButton onClick={() => setShowFullAgenda(false)} sx={{ bgcolor: tokens.colors.bgSubtle }}><CloseIcon /></IconButton>
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
                                        <Typography variant="subtitle2" fontWeight={700} sx={{ color: APPLE_COLORS.primary, bgcolor: 'rgba(0,113,227,0.1)', px: 1.5, py: 0.5, borderRadius: tokens.radius.sm }}>
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
                                navigate(`/app/prospect/${prospectId}`);
                              } else if (prospectId) {
                                navigate(`/app/prospect/${prospectId.replace('relance-', '')}`);
                              }
                            } else if (!evt.id.startsWith('relance-')) {
                              handleEditEvent(evt);
                            }
                          }}
                          sx={{
                                        p: 2.5, 
                                        borderRadius: tokens.radius.lg, 
                                        border: '1px solid #e5e5ea',
                                        display: 'flex', 
                                        gap: 2,
                                        transition: 'all 0.2s',
                                        cursor: 'pointer',
                                        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderColor: APPLE_COLORS.primary }
                                    }}
                                >
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 60, bgcolor: tokens.colors.bgSubtle, borderRadius: tokens.radius.md, p: 1, height: 'fit-content' }}>
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
                                                sx={{ height: 24, bgcolor: tokens.colors.bgSubtle, fontWeight: 600, fontSize: '0.75rem' }} 
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
        PaperProps={{ sx: { borderRadius: tokens.radius.xxl } }}
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
                sx: { borderRadius: tokens.radius.md, bgcolor: tokens.colors.bgSubtle, '& fieldset': { border: 'none' } },
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
                sx: { borderRadius: tokens.radius.md, bgcolor: tokens.colors.bgSubtle, '& fieldset': { border: 'none' } },
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
                    borderRadius: tokens.radius.md
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
                        <Box key={`devco-${mandat}`} sx={{ borderBottom: `1px solid ${tokens.colors.bgSubtle}` }}>
                          <ListSubheader 
                            sx={{ 
                              bgcolor: tokens.colors.bgSubtle,
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
                                  primary={<UserNameText user={member} component="span" />}
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
                        <Box key={`other-${mandat}`} sx={{ borderBottom: `1px solid ${tokens.colors.bgSubtle}` }}>
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
                                  primary={<UserNameText user={member} component="span" />}
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
            borderRadius: tokens.radius.lg,
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
                borderRadius: tokens.radius.sm,
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
                borderRadius: tokens.radius.sm,
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
                borderRadius: tokens.radius.sm,
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
                bgcolor: tokens.colors.bgSubtle,
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
                borderRadius: tokens.radius.sm,
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
                borderRadius: tokens.radius.sm,
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
        PaperProps={{ sx: { borderRadius: tokens.radius.lg } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: APPLE_COLORS.error }}>
          Confirmer la suppression
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2, borderRadius: tokens.radius.md }}>
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

      {/* Dialog: Génération prospects de test (superadmin) */}
      <Dialog
        open={isGenerateTestDialogOpen}
        onClose={() => !generateTestSubmitting && setIsGenerateTestDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: tokens.radius.lg } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Générer des prospects de test
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Crée des prospects avec des données complètes : nom, entreprise, email, téléphone, adresse, secteur, poste, source, notes, statut, valeur potentielle, LinkedIn, date de relance, etc.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <strong>Attention :</strong> chaque prospect consomme 1 token du quota de la structure.
          </Typography>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Nombre de prospects</InputLabel>
            <Select
              value={generateTestCount}
              onChange={(e) => setGenerateTestCount(Number(e.target.value))}
              label="Nombre de prospects"
              disabled={generateTestSubmitting}
            >
              <MenuItem value={3}>3</MenuItem>
              <MenuItem value={5}>5</MenuItem>
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={20}>20</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={() => setIsGenerateTestDialogOpen(false)}
            disabled={generateTestSubmitting}
          >
            Annuler
          </Button>
          <StyledButton
            variant="contained"
            startIcon={generateTestSubmitting ? <CircularProgress size={18} color="inherit" /> : <RocketIcon />}
            onClick={handleGenerateTestProspects}
            disabled={generateTestSubmitting}
            sx={{ bgcolor: '#34c759', '&:hover': { bgcolor: '#30b350' } }}
          >
            {generateTestSubmitting ? `Création...` : `Générer ${generateTestCount} prospect(s)`}
          </StyledButton>
        </DialogActions>
      </Dialog>
    </Box>
    </AppPageShell>
  );
};

export default Commercial; 