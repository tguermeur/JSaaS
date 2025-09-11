import React, { useState, useEffect, useCallback } from 'react';
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
  TableSortLabel,
  Radio,
  RadioGroup,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  LinearProgress
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import FilterListIcon from '@mui/icons-material/FilterList';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import {
  MoreVert as MoreVertIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as CalendarIcon,
  Extension as ExtensionIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  Sort as SortIcon,
  Upload as UploadIcon,
  TableChart as TableChartIcon,
  Error as ErrorIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { getProspects, createProspect } from '../firebase/prospects';
import ProspectForm from '../components/ProspectForm';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { styled, alpha } from '@mui/material';
import { fadeIn } from '../styles/animations';
import Papa from 'papaparse';

// Les statuts pipeline sont maintenant dynamiques (string)
const PIPELINE_STATUSES = [
  'non_qualifie',
  'contacte',
  'a_recontacter',
  'negociation',
  'abandon',
  'deja_client'
];

// Ajout des constantes de style Apple
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

// Fonction utilitaire pour obtenir le displayName d'un ownerId
const getOwnerDisplayName = (ownerId: string, structureMembers: any[] = []) => {
  const owner = structureMembers.find(m => m.id === ownerId);
  return owner ? owner.displayName : ownerId;
};

// Fonction utilitaire pour formater la date
const getFormattedDate = (date: any) => {
  if (!date) return '';
  if (date.toDate) {
    // Firestore Timestamp
    return date.toDate().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  // String ou Date
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return '';
  return parsedDate.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// Redéfinir l'interface Prospect pour que statut soit string et inclure toutes les propriétés utilisées
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
}

interface StructureMember {
  id: string;
  displayName: string;
  role: 'admin' | 'superadmin' | 'member';
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

// Interfaces pour l'import Excel
interface ImportedProspect {
  nom?: string;
  name?: string;
  entreprise?: string;
  company?: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  location?: string;
  secteur?: string;
  title?: string;
  source?: string;
  notes?: string;
  linkedinUrl?: string;
  statut?: string;
}

interface ImportStep {
  label: string;
  description: string;
  completed: boolean;
  error?: string;
}

interface ColumnMapping {
  [key: string]: string;
}

// Ajout des styles personnalisés
const StyledCard = styled(Paper)(({ theme }) => ({
  borderRadius: '16px',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
  backdropFilter: 'blur(10px)',
  backgroundColor: alpha(theme.palette.background.paper, 0.8),
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
    transform: 'translateY(-2px)',
  },
  animation: `${fadeIn} 0.5s ease-out`,
}));

const StyledAvatar = styled(Avatar)(({ theme }) => ({
  width: 120,
  height: 120,
  borderRadius: '24px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    transform: 'scale(1.05)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
  },
}));

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: '12px',
  textTransform: 'none',
  fontWeight: 600,
  padding: '10px 24px',
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
}));

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

const StyledChip = styled(Chip)(({ theme }) => ({
  borderRadius: '8px',
  fontWeight: 500,
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-1px)',
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.04),
    transform: 'translateX(4px)',
  },
}));

// Fonction utilitaire pour mettre une majuscule à chaque mot
const capitalizeWords = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const Commercial: React.FC = (): JSX.Element => {
  const { userData, currentUser } = useAuth();
  const navigate = useNavigate();
  console.log("Données utilisateur:", userData);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('tous');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [structureMembers, setStructureMembers] = useState<StructureMember[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProspect, setNewProspect] = useState<Partial<Prospect>>({
    nom: '',
    entreprise: '',
    email: '',
    telephone: '',
    statut: 'nouveau',
    adresse: '',
    secteur: '',
    taille: '',
    source: '',
    notes: '',
    favori: false,
    structureId: userData?.structureId || '',
    createdBy: userData?.uid || ''
  });
  const [columnFilterAnchorEl, setColumnFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [visibleColumns, setVisibleColumns] = useState({
    nom: true,
    entreprise: true,
    statut: true,
    proprietaire: true,
    dateAjout: true
  });
  const [selectedProspects, setSelectedProspects] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'nom', direction: 'asc' });
  const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [sortAnchorEl, setSortAnchorEl] = useState<HTMLElement | null>(null);
  const [sortField, setSortField] = useState<string>('nom');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [currentFilterColumn, setCurrentFilterColumn] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, { order: 'asc' | 'desc' | null, values: string[] }>>({});
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectAll, setSelectAll] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'table' | 'pipeline'>('table');
  const [pipelineColumns, setPipelineColumns] = useState<Record<string, Prospect[]>>({});
  const [pipelineStatuses, setPipelineStatuses] = useState<string[]>(PIPELINE_STATUSES);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // États pour l'import Excel
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importedData, setImportedData] = useState<ImportedProspect[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [importSteps, setImportSteps] = useState<ImportStep[]>([
    { label: 'Sélection du fichier', description: 'Choisissez votre fichier Excel/CSV', completed: false },
    { label: 'Mapping des colonnes', description: 'Associez les colonnes du fichier aux champs', completed: false },
    { label: 'Validation des données', description: 'Vérifiez et corrigez les données', completed: false },
    { label: 'Import', description: 'Import des prospects dans la base', completed: false }
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccess, setImportSuccess] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Ajout d'un état pour le contexte de drag and drop
  const [dragContextId] = useState(() => `pipeline-${Date.now()}`);

  // Fonction utilitaire pour valider et normaliser un statut pipeline
  const validateStatus = (status: string | undefined): string => {
    if (!status || !PIPELINE_STATUSES.includes(status)) {
      console.warn('Statut pipeline inconnu, assigné à "Non qualifié" :', status);
      return 'Non qualifié';
    }
    return status;
  };

  // Fonction utilitaire pour valider un prospect
  const validateProspect = (prospect: Prospect): Prospect => {
    if (!prospect.id) {
      console.warn('Prospect sans ID détecté:', prospect);
      return {
        ...prospect,
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        statut: validateStatus(prospect.statut)
      };
    }
    return {
      ...prospect,
      statut: validateStatus(prospect.statut)
    };
  };

  const fetchProspects = useCallback(async () => {
    if (!userData?.structureId) {
      console.log("Structure ID non trouvé dans userData:", userData);
      setError("Structure ID non trouvé. Veuillez vous reconnecter.");
      return;
    }
    
    try {
      setLoading(true);
      const fetchedProspects = await getProspects(userData.structureId, userData.status);
      
      // Valider et normaliser tous les prospects
      const validatedProspects = fetchedProspects.map(validateProspect);
      
      // Générer les colonnes selon PIPELINE_STATUSES
      const newPipelineColumns: Record<string, Prospect[]> = {};
      PIPELINE_STATUSES.forEach(status => {
        newPipelineColumns[status] = validatedProspects.filter(p => validateStatus(p.statut) === status);
      });

      console.log('Prospects validés:', validatedProspects.map(p => ({ id: p.id, statut: p.statut })));
      console.log('Nouvelles colonnes:', Object.entries(newPipelineColumns).map(([status, prospects]) => ({
        status,
        count: prospects.length,
        ids: prospects.map(p => p.id)
      })));

      // Log pour déboguer les dates
      console.log('Exemple de dates dans les prospects:', validatedProspects.slice(0, 3).map(p => ({
        id: p.id,
        nom: p.nom,
        dateAjout: p.dateAjout,
        dateCreation: p.dateCreation,
        typeDateAjout: typeof p.dateAjout,
        typeDateCreation: typeof p.dateCreation
      })));

      setProspects(validatedProspects);
      setPipelineColumns(newPipelineColumns);
      setPipelineStatuses(PIPELINE_STATUSES);
      setError(null);
    } catch (err) {
      console.error("Erreur lors de la récupération des prospects:", err);
      setError("Impossible de charger les prospects. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }, [userData?.structureId, userData?.status]);

  const fetchStructureMembers = useCallback(async () => {
    if (!userData?.structureId) {
      console.log("Structure ID non trouvé dans userData:", userData);
      return;
    }
    
    try {
      console.log("Récupération des membres pour la structure:", userData.structureId);
      const membersRef = collection(db, 'users');
      const q = query(
        membersRef,
        where('structureId', '==', userData.structureId)
      );
      const querySnapshot = await getDocs(q);
      console.log("Nombre de membres trouvés:", querySnapshot.size);
      
      const members = querySnapshot.docs.map(doc => {
        const data = doc.data();
        console.log("Données du membre:", {
          id: doc.id,
          ...data
        });
        return {
          id: doc.id,
          displayName: data.displayName || data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Utilisateur sans nom',
          role: data.role || 'member'
        };
      });
      
      console.log("Membres transformés:", members);
      setStructureMembers(members);
    } catch (error) {
      console.error('Erreur lors de la récupération des membres:', error);
    }
  }, [userData?.structureId]);

  const handleOwnerChange = async (prospectId: string, newOwnerId: string) => {
    try {
      const prospectRef = doc(db, 'prospects', prospectId);
      await updateDoc(prospectRef, {
        ownerId: newOwnerId,
        updatedAt: serverTimestamp()
      });
      
      setProspects(prevProspects => 
        prevProspects.map(p => 
          p.id === prospectId ? { ...p, ownerId: newOwnerId } : p
        )
      );
    } catch (error) {
      console.error('Erreur lors de la mise à jour du propriétaire:', error);
    }
  };

  const handleCreateProspect = async () => {
    try {
      const prospectData = {
        ...newProspect,
        statut: newProspect.statut || 'nouveau',
        favori: newProspect.favori || false,
        structureId: userData?.structureId || '',
        createdBy: userData?.uid || '',
        dateAjout: new Date().toISOString(),
        dateCreation: new Date().toISOString(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await createProspect(prospectData as any);
      setIsCreateDialogOpen(false);
      fetchProspects();
      setNewProspect({
        nom: '',
        entreprise: '',
        email: '',
        telephone: '',
        statut: 'nouveau',
        adresse: '',
        secteur: '',
        taille: '',
        source: '',
        notes: '',
        favori: false,
        structureId: userData?.structureId || '',
        createdBy: userData?.uid || ''
      });
    } catch (error) {
      console.error('Erreur lors de la création du prospect:', error);
    }
  };

  useEffect(() => {
    console.log("Effet déclenché avec userData:", userData);
    if (userData?.structureId) {
      console.log("Structure ID disponible, lancement de fetchProspects");
      fetchProspects();
      fetchStructureMembers();
    } else {
      console.log("Structure ID non disponible, attente...");
    }
  }, [fetchProspects, userData, fetchStructureMembers]);

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const searchValue = event.target.value.toLowerCase();
    setSearchTerm(searchValue);
  };

  const handleFilterChange = (event: SelectChangeEvent<string>) => {
    setFilterStatus(event.target.value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'non_qualifie':
        return '#424242';
      case 'contacte':
        return '#1565c0';
      case 'a_recontacter':
        return '#e65100';
      case 'negociation':
        return '#2e7d32';
      case 'abandon':
        return '#c62828';
      case 'deja_client':
        return '#283593';
      default:
        return '#424242';
    }
  };

  const formatCurrency = (value: number | undefined) => {
    if (!value) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const formatDate = (date: any) => {
    if (!date) return 'Non spécifiée';
    
    try {
      // Si c'est un timestamp Firestore
      if (date.toDate) {
        return date.toDate().toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
      
      // Si c'est déjà un objet Date
      if (date instanceof Date) {
        return date.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
      
      // Si c'est une chaîne de caractères ou autre
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        console.warn('Date invalide détectée:', date);
        return 'Date invalide';
      }
      
      return parsedDate.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.error("Erreur lors du formatage de la date:", error, date);
      return 'Date invalide';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'non_qualifie':
        return 'Non qualifié';
      case 'contacte':
        return 'Contacté';
      case 'a_recontacter':
        return 'À recontacter';
      case 'negociation':
        return 'Négociation';
      case 'abandon':
        return 'Abandon';
      case 'deja_client':
        return 'Déjà client';
      default:
        return 'Non qualifié';
    }
  };

  const filteredProspects = prospects.filter(prospect => {
    console.log("Filtrage du prospect:", {
      id: prospect.id,
      nom: prospect.nom,
      name: prospect.name,
      entreprise: prospect.entreprise,
      company: prospect.company,
      statut: prospect.statut,
      structureId: prospect.structureId,
      linkedinUrl: prospect.linkedinUrl,
      source: prospect.source,
      title: prospect.title,
      location: prospect.location
    });

    const matchesSearch = 
      (prospect.nom?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (prospect.entreprise?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (prospect.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (prospect.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (prospect.company?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (prospect.linkedinUrl?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (prospect.title?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'tous' || 
      (prospect.statut === filterStatus || 
       (filterStatus === 'prospect' && prospect.statut === 'nouveau'));
    
    console.log("Résultats du filtrage pour le prospect:", {
      id: prospect.id,
      matchesSearch,
      matchesStatus,
      searchTerm,
      filterStatus,
      prospectStatut: prospect.statut
    });
    
    return matchesSearch && matchesStatus;
  });

  console.log("Résultats finaux du filtrage:", {
    nombreProspects: prospects.length,
    nombreProspectsFiltrés: filteredProspects.length,
    searchTerm,
    filterStatus
  });

  const getProspectName = (prospect: Prospect) => {
    return prospect.nom || prospect.name || 'Nom non spécifié';
  };

  const getProspectCompany = (prospect: Prospect) => {
    return prospect.entreprise || prospect.company || 'Entreprise non spécifiée';
  };

  const getProspectEmail = (prospect: Prospect) => {
    return prospect.email || 'Email non spécifié';
  };

  const getProspectPhone = (prospect: Prospect) => {
    return prospect.telephone || 'Téléphone non spécifié';
  };

  const getProspectSector = (prospect: Prospect) => {
    return prospect.secteur || prospect.title || 'Secteur non spécifié';
  };

  const getProspectAddress = (prospect: Prospect) => {
    return prospect.adresse || prospect.location || 'Adresse non spécifiée';
  };

  const getProspectStatus = (prospect: Prospect) => {
    return prospect.statut === 'nouveau' ? 'prospect' : prospect.statut;
  };

  const getProspectLastInteraction = (prospect: Prospect) => {
    return prospect.derniereInteraction || prospect.dateCreation || prospect.dateAjout;
  };

  const getProspectValue = (prospect: Prospect) => {
    return prospect.valeurPotentielle || 0;
  };

  const handleFormSuccess = () => {
    fetchProspects();
  };

  const handleExtensionClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleExtensionClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  const handleColumnFilterClick = (event: React.MouseEvent<HTMLElement>) => {
    setColumnFilterAnchorEl(event.currentTarget);
  };

  const handleColumnFilterClose = () => {
    setColumnFilterAnchorEl(null);
  };

  const toggleColumn = (column: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [column]: !prev[column as keyof typeof prev]
    }));
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedProspects(prospects.map(prospect => prospect.id));
    } else {
      setSelectedProspects([]);
    }
  };

  const handleSelectOne = (prospectId: string) => {
    setSelectedProspects(prev => {
      if (prev.includes(prospectId)) {
        return prev.filter(id => id !== prospectId);
      } else {
        return [...prev, prospectId];
      }
    });
  };

  const handleSort = (key: string) => {
    console.log('Tri demandé pour la clé:', key);
    setSortConfig(prev => {
      const newDirection = prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc';
      console.log('Nouvelle configuration de tri:', { key, direction: newDirection });
      return { key, direction: newDirection };
    });
  };

  const handleBulkAssign = async (ownerId: string) => {
    try {
      const batch = writeBatch(db);
      selectedProspects.forEach(prospectId => {
        const prospectRef = doc(db, 'prospects', prospectId);
        batch.update(prospectRef, {
          ownerId,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
      
      setProspects(prevProspects => 
        prevProspects.map(p => 
          selectedProspects.includes(p.id) ? { ...p, ownerId } : p
        )
      );
      setSelectedProspects([]);
      setActionMenuAnchorEl(null);
    } catch (error) {
      console.error('Erreur lors de l\'assignation en masse:', error);
    }
  };

  const handleBulkDelete = async () => {
    try {
      const batch = writeBatch(db);
      selectedProspects.forEach(prospectId => {
        const prospectRef = doc(db, 'prospects', prospectId);
        batch.delete(prospectRef);
      });
      await batch.commit();
      
      setProspects(prevProspects => 
        prevProspects.filter(p => !selectedProspects.includes(p.id))
      );
      setSelectedProspects([]);
      setActionMenuAnchorEl(null);
    } catch (error) {
      console.error('Erreur lors de la suppression en masse:', error);
    }
  };

  const sortedProspects = [...prospects].sort((a, b) => {
    const aValue = a[sortConfig.key as keyof Prospect];
    const bValue = b[sortConfig.key as keyof Prospect];
    
    console.log('Valeurs comparées:', {
      key: sortConfig.key,
      aValue,
      bValue,
      direction: sortConfig.direction
    });

    // Gestion des valeurs nulles ou undefined
    if (!aValue && !bValue) return 0;
    if (!aValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (!bValue) return sortConfig.direction === 'asc' ? 1 : -1;

    // Conversion en chaîne et normalisation
    const aStr = String(aValue).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const bStr = String(bValue).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    console.log('Valeurs normalisées:', {
      aStr,
      bStr
    });

    const result = sortConfig.direction === 'asc' 
      ? aStr.localeCompare(bStr, 'fr', { sensitivity: 'base' })
      : bStr.localeCompare(aStr, 'fr', { sensitivity: 'base' });

    console.log('Résultat du tri:', result);
    return result;
  });

  const handleSortClick = (event: React.MouseEvent<HTMLElement>) => {
    setSortAnchorEl(event.currentTarget);
  };

  const handleSortClose = () => {
    setSortAnchorEl(null);
  };

  const handleSortFieldChange = (field: string) => {
    setSortField(field);
    setSortConfig({ key: field, direction: sortOrder });
  };

  const handleSortOrderChange = (order: 'asc' | 'desc'): void => {
    if (!currentFilterColumn) return;
    
    // Mettre à jour le tri pour la colonne actuelle
    setSortConfig({ 
      key: currentFilterColumn, 
      direction: order 
    });
    
    // Mettre à jour les filtres de colonne
    setColumnFilters(prev => ({
      ...prev,
      [currentFilterColumn]: {
        ...prev[currentFilterColumn],
        order
      }
    }));
  };

  const sortOptions = [
    { value: 'nom', label: 'Nom' },
    { value: 'entreprise', label: 'Entreprise' },
    { value: 'statut', label: 'Statut' },
    { value: 'proprietaire', label: 'Propriétaire' },
    { value: 'dateAjout', label: 'Date d\'ajout' }
  ];

  const handleFilterClick = (event: React.MouseEvent<HTMLElement>, column: string) => {
    event.stopPropagation();
    console.log('Clic sur le filtre de la colonne:', column);
    
    setCurrentFilterColumn(column);
    setFilterAnchorEl(event.currentTarget);
    
    // Initialisation du filtre si nécessaire
    if (!columnFilters[column]) {
      // Récupérer toutes les valeurs uniques de la colonne
      const allValues = [...new Set(prospects.map(p => {
        switch (column) {
          case 'nom':
            return String(p.nom || p.name || '');
          case 'entreprise':
            return String(p.entreprise || p.company || '');
          case 'dateAjout':
            return String(p.dateAjout || p.dateCreation || '');
          default:
            return String(p[column as keyof Prospect] || '');
        }
      }).filter(v => v !== ''))];

      setColumnFilters(prev => ({
        ...prev,
        [column]: { 
          order: 'asc', 
          values: allValues // Tout est sélectionné par défaut
        }
      }));
    }
  };

  const handleFilterClose = () => {
    setFilterAnchorEl(null);
    // Ne pas réinitialiser currentFilterColumn ici pour garder le filtre actif
  };

  const getColumnValues = (column: string) => {
    const values = prospects
      .map(p => String(p[column as keyof Prospect] || ''))
      .filter(v => v !== '');
    
    return [...new Set(values)].sort();
  };

  const handleFilterValueChange = (value: string, checked: boolean) => {
    if (!currentFilterColumn) return;
    
    setColumnFilters(prev => {
      const currentFilter = prev[currentFilterColumn] || { order: 'asc', values: [] };
      const newValues = checked
        ? [...currentFilter.values, value]
        : currentFilter.values.filter(v => v !== value);
      
      // Mettre à jour l'état selectAll en fonction des valeurs sélectionnées
      const allValues = getFilteredValues(currentFilterColumn);
      const isAllSelected = newValues.length === allValues.length;
      setSelectAll(isAllSelected);
      
      return {
        ...prev,
        [currentFilterColumn]: {
          ...currentFilter,
          values: newValues
        }
      };
    });
  };

  const handleSelectAllChange = (checked: boolean) => {
    if (!currentFilterColumn) return;
    
    setSelectAll(checked);
    
    setColumnFilters(prev => {
      const currentFilter = prev[currentFilterColumn] || { order: 'asc', values: [] };
      const allValues = getFilteredValues(currentFilterColumn);
      
      return {
        ...prev,
        [currentFilterColumn]: {
          ...currentFilter,
          values: checked ? allValues : []
        }
      };
    });
  };

  const getFilteredValues = (column: string) => {
    let allValues: string[] = [];
    if (column === 'ownerId') {
      allValues = [...new Set(prospects.map(p => getOwnerDisplayName(p.ownerId || '', structureMembers)).filter(v => v !== ''))];
      // Ajouter 'Aucun propriétaire' si au moins un prospect n'a pas de ownerId
      const hasNoOwner = prospects.some(p => !p.ownerId);
      if (hasNoOwner && !allValues.includes('Aucun propriétaire')) {
        allValues.push('Aucun propriétaire');
      }
    } else if (column === 'dateAjout') {
      allValues = [...new Set(prospects.map(p => getFormattedDate(p.dateAjout || p.dateCreation || '')).filter(v => v !== ''))];
    } else {
      allValues = [...new Set(prospects.map(p => {
        switch (column) {
          case 'nom':
            return String(p.nom || p.name || '');
          case 'entreprise':
            return String(p.entreprise || p.company || '');
          default:
            return String(p[column as keyof Prospect] || '');
        }
      }).filter(v => v !== ''))];
    }
    // Filtrer selon la recherche
    if (!searchFilter) return allValues;
    return allValues.filter(value => 
      value.toLowerCase().includes(searchFilter.toLowerCase())
    );
  };

  const getFilteredAndSortedProspects = () => {
    let filtered = [...prospects];

    // Filtrage par terme de recherche
    if (searchTerm) {
      filtered = filtered.filter(prospect => {
        const searchFields = [
          prospect.nom,
          prospect.name,
          prospect.entreprise,
          prospect.company,
          prospect.email,
          prospect.telephone,
          prospect.adresse,
          prospect.secteur,
          prospect.title,
          prospect.location
        ].map(field => (field || '').toLowerCase());

        return searchFields.some(field => field.includes(searchTerm.toLowerCase()));
      });
    }

    // Filtrage par colonnes
    Object.entries(columnFilters).forEach(([column, filter]) => {
      if (filter.values && filter.values.length > 0) {
        filtered = filtered.filter(prospect => {
          let value = '';
          if (column === 'ownerId') {
            value = prospect.ownerId ? getOwnerDisplayName(prospect.ownerId || '', structureMembers) : 'Aucun propriétaire';
          } else if (column === 'dateAjout') {
            value = getFormattedDate(prospect.dateAjout || prospect.dateCreation || '');
          } else {
            switch (column) {
              case 'nom':
                value = String(prospect.nom || prospect.name || '');
                break;
              case 'entreprise':
                value = String(prospect.entreprise || prospect.company || '');
                break;
              default:
                value = String(prospect[column as keyof Prospect] || '');
            }
          }
          value = value.trim().toLowerCase();
          return filter.values.some(filterVal => value === filterVal.trim().toLowerCase());
        });
      }
    });

    // Tri
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let sortValueA = '';
        let sortValueB = '';
        switch (sortConfig.key) {
          case 'nom':
            sortValueA = String(a.nom || a.name || '').toLowerCase();
            sortValueB = String(b.nom || b.name || '').toLowerCase();
            break;
          case 'entreprise':
            sortValueA = String(a.entreprise || a.company || '').toLowerCase();
            sortValueB = String(b.entreprise || b.company || '').toLowerCase();
            break;
          case 'dateAjout':
            sortValueA = getFormattedDate(a.dateAjout || a.dateCreation || '').toLowerCase();
            sortValueB = getFormattedDate(b.dateAjout || b.dateCreation || '').toLowerCase();
            break;
          case 'ownerId':
            sortValueA = a.ownerId ? getOwnerDisplayName(a.ownerId || '', structureMembers).toLowerCase() : 'aucun propriétaire';
            sortValueB = b.ownerId ? getOwnerDisplayName(b.ownerId || '', structureMembers).toLowerCase() : 'aucun propriétaire';
            break;
          default:
            sortValueA = String(a[sortConfig.key as keyof Prospect] || '').toLowerCase();
            sortValueB = String(b[sortConfig.key as keyof Prospect] || '').toLowerCase();
        }
        if (sortConfig.direction === 'asc') {
          return sortValueA.localeCompare(sortValueB, 'fr', { sensitivity: 'base' });
        } else {
          return sortValueB.localeCompare(sortValueA, 'fr', { sensitivity: 'base' });
        }
      });
    }

    return filtered;
  };

  // Ajout d'un useEffect pour surveiller les changements de tri
  useEffect(() => {
    console.log('SortConfig changé:', sortConfig);
  }, [sortConfig]);

  // Fonction pour réinitialiser tous les filtres
  const handleResetFilters = () => {
    const newFilters: typeof columnFilters = {};
    Object.keys(visibleColumns).forEach((column) => {
      if (visibleColumns[column as keyof typeof visibleColumns]) {
        let allValues: string[] = [];
        if (column === 'ownerId') {
          allValues = [...new Set(prospects.map(p => getOwnerDisplayName(p.ownerId || '', structureMembers)).filter(v => v !== ''))];
        } else if (column === 'dateAjout') {
          allValues = [...new Set(prospects.map(p => getFormattedDate(p.dateAjout || p.dateCreation || '')).filter(v => v !== ''))];
        } else {
          allValues = [...new Set(prospects.map(p => {
            switch (column) {
              case 'nom':
                return String(p.nom || p.name || '');
              case 'entreprise':
                return String(p.entreprise || p.company || '');
              default:
                return String(p[column as keyof Prospect] || '');
            }
          }).filter(v => v !== ''))];
        }
        newFilters[column] = { order: 'asc', values: allValues };
      }
    });
    setColumnFilters(newFilters);
    setSearchFilter('');
    setSelectAll(true);
  };

  // Fonction utilitaire pour savoir si un filtre est actif sur une colonne
  const isFilterActive = (column: string) => {
    const filter = columnFilters[column];
    if (!filter) return false;
    let allValues: string[] = [];
    if (column === 'ownerId') {
      allValues = [...new Set(prospects.map(p => getOwnerDisplayName(p.ownerId || '', structureMembers)).filter(v => v !== ''))];
    } else if (column === 'dateAjout') {
      allValues = [...new Set(prospects.map(p => getFormattedDate(p.dateAjout || p.dateCreation || '')).filter(v => v !== ''))];
    } else {
      allValues = [...new Set(prospects.map(p => {
        switch (column) {
          case 'nom':
            return String(p.nom || p.name || '');
          case 'entreprise':
            return String(p.entreprise || p.company || '');
          default:
            return String(p[column as keyof Prospect] || '');
        }
      }).filter(v => v !== ''))];
    }
    return filter.values.length > 0 && filter.values.length < allValues.length;
  };

  const handleProspectClick = (prospectId: string, event: React.MouseEvent<HTMLElement>) => {
    // Empêcher la navigation si le clic est sur la checkbox
    if ((event.target as HTMLElement).closest('.MuiCheckbox-root')) {
      return;
    }
    navigate(`/prospect/${prospectId}`);
  };

  const handleViewModeChange = (event: React.MouseEvent<HTMLElement>, newMode: 'table' | 'pipeline' | null) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  // Fonctions pour l'import Excel
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12'
    ];

    if (!validTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      alert('Veuillez sélectionner un fichier CSV ou Excel valide');
      return;
    }

    setImportFile(file);
    parseFile(file);
  };

  const parseFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.error('Erreurs lors du parsing:', results.errors);
          alert('Erreur lors de la lecture du fichier');
          return;
        }

        const data = results.data as any[];
        if (data.length === 0) {
          alert('Le fichier ne contient aucune donnée');
          return;
        }

        // Extraire les colonnes disponibles
        const columns = Object.keys(data[0]);
        setAvailableColumns(columns);

        // Créer un mapping par défaut
        const defaultMapping: ColumnMapping = {};
        columns.forEach(col => {
          const lowerCol = col.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (lowerCol.includes('nom') || lowerCol.includes('name') || lowerCol.includes('prenom') || lowerCol.includes('firstname')) {
            defaultMapping[col] = 'nom';
          } else if (lowerCol.includes('entreprise') || lowerCol.includes('company') || lowerCol.includes('societe') || lowerCol.includes('organisation')) {
            defaultMapping[col] = 'entreprise';
          } else if (lowerCol.includes('email') || lowerCol.includes('mail') || lowerCol.includes('courriel')) {
            defaultMapping[col] = 'email';
          } else if (lowerCol.includes('telephone') || lowerCol.includes('phone') || lowerCol.includes('tel') || lowerCol.includes('mobile')) {
            defaultMapping[col] = 'telephone';
          } else if (lowerCol.includes('adresse') || lowerCol.includes('address') || lowerCol.includes('rue') || lowerCol.includes('street')) {
            defaultMapping[col] = 'adresse';
          } else if (lowerCol.includes('secteur') || lowerCol.includes('sector') || lowerCol.includes('industrie') || lowerCol.includes('domaine')) {
            defaultMapping[col] = 'secteur';
          } else if (lowerCol.includes('notes') || lowerCol.includes('commentaire') || lowerCol.includes('description')) {
            defaultMapping[col] = 'notes';
          } else if (lowerCol.includes('source') || lowerCol.includes('origine') || lowerCol.includes('provenance')) {
            defaultMapping[col] = 'source';
          } else if (lowerCol.includes('linkedin') || lowerCol.includes('profile') || lowerCol.includes('url')) {
            defaultMapping[col] = 'linkedinUrl';
          } else if (lowerCol.includes('statut') || lowerCol.includes('status') || lowerCol.includes('etat') || lowerCol.includes('phase')) {
            defaultMapping[col] = 'statut';
          }
        });

        setColumnMapping(defaultMapping);
        setImportedData(data);
        
        // Marquer l'étape 1 comme terminée
        setImportSteps(prev => prev.map((step, index) => 
          index === 0 ? { ...step, completed: true } : step
        ));
        setCurrentStep(1);
      },
      error: (error) => {
        console.error('Erreur Papa Parse:', error);
        alert('Erreur lors de la lecture du fichier');
      }
    });
  };

  const handleColumnMappingChange = (fileColumn: string, targetField: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [fileColumn]: targetField
    }));
  };

  const validateAndTransformData = () => {
    const transformedData: ImportedProspect[] = [];
    const errors: string[] = [];

    importedData.forEach((row, index) => {
      const prospect: ImportedProspect = {};
      
      Object.entries(columnMapping).forEach(([fileColumn, targetField]) => {
        const value = row[fileColumn];
        if (value !== undefined && value !== null && value !== '') {
          if (targetField === 'statut') {
            // Normaliser les statuts
            const normalizedStatus = normalizeStatus(value);
            if (normalizedStatus) {
              prospect[targetField] = normalizedStatus;
            } else {
              errors.push(`Ligne ${index + 1}: Statut invalide "${value}". Statuts valides : non_qualifie, contacte, a_recontacter, negociation, abandon, deja_client`);
            }
          } else if (targetField === 'email') {
            // Validation basique de l'email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailRegex.test(value)) {
              prospect[targetField] = value;
            } else {
              errors.push(`Ligne ${index + 1}: Email invalide "${value}"`);
            }
          } else {
            prospect[targetField] = value;
          }
        }
      });

      // Validation des champs obligatoires
      if (!prospect.nom && !prospect.name) {
        errors.push(`Ligne ${index + 1}: Nom manquant`);
      }
      if (!prospect.entreprise && !prospect.company) {
        errors.push(`Ligne ${index + 1}: Entreprise manquante`);
      }

      transformedData.push(prospect);
    });

    setImportErrors(errors);
    setImportedData(transformedData);
    
    if (errors.length === 0) {
      setImportSteps(prev => prev.map((step, index) => 
        index === 1 ? { ...step, completed: true } : step
      ));
      setCurrentStep(2);
    }
  };

  // Fonction pour normaliser les statuts
  const normalizeStatus = (status: string): string | null => {
    const lowerStatus = status.toLowerCase().trim();
    const statusMap: { [key: string]: string } = {
      'non qualifié': 'non_qualifie',
      'non qualifie': 'non_qualifie',
      'non-qualifié': 'non_qualifie',
      'non-qualifie': 'non_qualifie',
      'nouveau': 'non_qualifie',
      'contacté': 'contacte',
      'contacte': 'contacte',
      'à recontacter': 'a_recontacter',
      'a recontacter': 'a_recontacter',
      'négociation': 'negociation',
      'negociation': 'negociation',
      'abandon': 'abandon',
      'déjà client': 'deja_client',
      'deja client': 'deja_client',
      'client': 'deja_client'
    };

    return statusMap[lowerStatus] || (PIPELINE_STATUSES.includes(lowerStatus) ? lowerStatus : null);
  };

  const handleImportProspects = async () => {
    if (!currentUser) {
      alert('Erreur: Vous devez être connecté pour importer des prospects.');
      return;
    }

    if (!userData?.structureId) {
      alert('Erreur: Structure ID non trouvé');
      return;
    }

    if (!currentUser?.uid) {
      alert('Erreur: ID utilisateur non trouvé. Veuillez vous reconnecter.');
      return;
    }

    console.log('Début de l\'import avec:', {
      currentUser: currentUser?.uid,
      structureId: userData?.structureId,
      userData: userData
    });

    setIsImporting(true);
    setImportProgress(0);
    const success: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < importedData.length; i++) {
      const prospect = importedData[i];
      try {
        // Nettoyer les données en supprimant les champs vides
        const cleanProspect = Object.fromEntries(
          Object.entries(prospect).filter(([_, value]) => 
            value !== undefined && 
            value !== null && 
            value !== '' && 
            value !== 'undefined'
          )
        );

        const prospectData = {
          ...cleanProspect,
          statut: prospect.statut || 'non_qualifie',
          favori: false,
          structureId: userData.structureId,
          createdBy: currentUser.uid,
          dateAjout: new Date().toISOString(),
          dateCreation: new Date().toISOString(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        console.log('Données du prospect à importer:', prospectData);
        console.log('Dates créées:', {
          dateAjout: prospectData.dateAjout,
          dateCreation: prospectData.dateCreation
        });
        await createProspect(prospectData as any);
        success.push(`Ligne ${i + 1}: ${prospect.nom || prospect.name || 'Prospect'} importé avec succès`);
        
        // Log après import pour vérifier
        console.log(`Prospect ${i + 1} importé avec succès`);
      } catch (error) {
        console.error('Erreur détaillée pour la ligne', i + 1, ':', error);
        errors.push(`Ligne ${i + 1}: Erreur lors de l'import - ${error}`);
      }

      setImportProgress(((i + 1) / importedData.length) * 100);
    }

    setImportSuccess(success);
    setImportErrors(errors);
    setImportSteps(prev => prev.map((step, index) => 
      index === 2 ? { ...step, completed: true } : step
    ));
    setCurrentStep(3);
    setIsImporting(false);

    // Rafraîchir la liste des prospects
    fetchProspects();
  };

  const resetImport = () => {
    setImportFile(null);
    setImportedData([]);
    setColumnMapping({});
    setAvailableColumns([]);
    setImportSteps([
      { label: 'Sélection du fichier', description: 'Choisissez votre fichier Excel/CSV', completed: false },
      { label: 'Mapping des colonnes', description: 'Associez les colonnes du fichier aux champs', completed: false },
      { label: 'Validation des données', description: 'Vérifiez et corrigez les données', completed: false },
      { label: 'Import', description: 'Import des prospects dans la base', completed: false }
    ]);
    setCurrentStep(0);
    setImportProgress(0);
    setImportErrors([]);
    setImportSuccess([]);
    setIsImporting(false);
  };

  const handleImportDialogClose = () => {
    setIsImportDialogOpen(false);
    resetImport();
  };

  const renderPipelineView = () => {
    if (loading) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      );
    }

    return (
      <DragDropContext onDragEnd={onDragEnd}>
        <Box sx={{ display: 'flex', gap: 2, p: 2, overflowX: 'auto', minHeight: 'calc(100vh - 200px)' }}>
          {pipelineStatuses.map(status => (
            <Box
              key={status}
              sx={{
                minWidth: 300,
                width: 300,
                backgroundColor: '#f5f5f7',
                borderRadius: '12px',
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 2
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
                {getStatusLabel(status)}
                <Chip
                  label={pipelineColumns[status]?.length || 0}
                  size="small"
                  sx={{
                    ml: 1,
                    backgroundColor: '#e3f2fd',
                    color: '#0071e3',
                    fontWeight: 500
                  }}
                />
              </Typography>
              <Droppable droppableId={status}>
                {(provided, snapshot) => (
                  <Box
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    sx={{
                      flex: 1,
                      minHeight: 100,
                      backgroundColor: snapshot.isDraggingOver ? 'rgba(0, 113, 227, 0.04)' : '#ffffff',
                      borderRadius: '8px',
                      p: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    {(pipelineColumns[status] || []).map((prospect, index) => (
                      <Draggable 
                        key={prospect.id} 
                        draggableId={prospect.id} 
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <Paper
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            sx={{
                              p: 2,
                              backgroundColor: snapshot.isDragging ? 'rgba(0, 113, 227, 0.08)' : '#ffffff',
                              borderRadius: '8px',
                              border: '1px solid #e5e5ea',
                              cursor: 'grab',
                              '&:hover': {
                                backgroundColor: 'rgba(0, 113, 227, 0.04)',
                              },
                              transform: snapshot.isDragging ? 'scale(1.02)' : 'none',
                              transition: 'all 0.2s ease',
                              boxShadow: snapshot.isDragging ? '0 4px 8px rgba(0,0,0,0.1)' : 'none'
                            }}
                            onClick={(event: React.MouseEvent<HTMLDivElement>) => handleProspectClick(prospect.id, event)}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              {prospect.photoUrl ? (
                                <Avatar src={prospect.photoUrl} sx={{ width: 32, height: 32 }} />
                              ) : (
                                <Avatar sx={{ width: 32, height: 32, bgcolor: '#f5f5f7' }}>
                                  {(prospect.nom || prospect.name || '?').charAt(0)}
                                </Avatar>
                              )}
                              <Typography sx={{ fontWeight: 500 }}>
                                {prospect.nom || prospect.name || 'Non spécifié'}
                              </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ color: '#86868b' }}>
                              {capitalizeWords(prospect.entreprise || prospect.company || 'Non spécifié')}
                            </Typography>
                          </Paper>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </Box>
                )}
              </Droppable>
            </Box>
          ))}
        </Box>
      </DragDropContext>
    );
  };

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;

    const { source, destination } = result;
    const sourceStatus = source.droppableId as string;
    const destinationStatus = destination.droppableId as string;
    const prospectId = result.draggableId;

    // Vérification de la validité des données
    if (!prospectId || !sourceStatus || !destinationStatus) {
      console.error('Données de drag and drop invalides:', { prospectId, sourceStatus, destinationStatus });
      return;
    }

    // Trouver le prospect dans la liste complète
    const prospect = prospects.find(p => p.id === prospectId);
    if (!prospect) {
      console.error('Prospect non trouvé:', prospectId);
      return;
    }

    try {
      // Mise à jour dans Firebase
      const prospectRef = doc(db, 'prospects', prospectId);
      await updateDoc(prospectRef, {
        statut: destinationStatus,
        updatedAt: serverTimestamp()
      });

      // Mise à jour de l'état local
      const updatedProspect = { ...prospect, statut: destinationStatus };
      const updatedProspects = prospects.map(p => 
        p.id === prospectId ? updatedProspect : p
      );
      setProspects(updatedProspects);

      // Mise à jour des colonnes du pipeline
      setPipelineColumns(prevColumns => {
        const newColumns = { ...prevColumns };
        
        // Retirer le prospect de l'ancienne colonne
        newColumns[sourceStatus] = newColumns[sourceStatus].filter(p => p.id !== prospectId);
        
        // Ajouter le prospect à la nouvelle colonne
        newColumns[destinationStatus] = [
          ...newColumns[destinationStatus].slice(0, destination.index),
          updatedProspect,
          ...newColumns[destinationStatus].slice(destination.index)
        ];

        return newColumns;
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      fetchProspects();
    }
  };

  if (loading) {
    console.log("Chargement en cours...");
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    console.log("Erreur:", error);
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  console.log("Prospects filtrés:", getFilteredAndSortedProspects());
  console.log("Nombre de prospects:", getFilteredAndSortedProspects().length);
  console.log("Structure ID:", userData?.structureId);
  console.log("État de chargement:", loading);
  console.log("Erreur:", error);

  return (
    <Box sx={{ 
      p: 3, 
      background: theme => `linear-gradient(180deg, ${alpha(theme.palette.background.default, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
      minHeight: '100vh'
    }}>
      <Typography 
        variant="h4" 
        gutterBottom 
        sx={{ 
          fontWeight: 700,
          mb: 4,
          background: theme => `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: `${fadeIn} 0.5s ease-out`
        }}
      >
        Gestion des Clients
      </Typography>

      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 4,
        animation: `${fadeIn} 0.5s ease-out 0.2s both`
      }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <StyledButton
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsCreateDialogOpen(true)}
            sx={{
              bgcolor: '#0066cc',
              '&:hover': {
                bgcolor: '#0077ed'
              }
            }}
          >
            Nouveau prospect
          </StyledButton>
          <StyledButton
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => setIsImportDialogOpen(true)}
            sx={{
              borderColor: '#0066cc',
              color: '#0066cc',
              '&:hover': {
                borderColor: '#0077ed',
                bgcolor: 'rgba(0, 113, 227, 0.04)',
              }
            }}
          >
            Importer Excel
          </StyledButton>
          <StyledButton
            variant="outlined"
            startIcon={<ExtensionIcon />}
            onClick={handleExtensionClick}
            sx={{
              borderColor: '#0066cc',
              color: '#0066cc',
              '&:hover': {
                borderColor: '#0077ed',
                bgcolor: 'rgba(0, 113, 227, 0.04)',
              }
            }}
          >
            Installer l'extension
          </StyledButton>
          {selectedProspects.length > 0 && (
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
              Supprimer la sélection ({selectedProspects.length})
            </StyledButton>
          )}
        </Box>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewModeChange}
          aria-label="mode d'affichage"
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              border: '1px solid #d2d2d7',
              color: '#86868b',
              transition: 'all 0.3s ease',
              '&.Mui-selected': {
                backgroundColor: '#0066cc',
                color: 'white',
                '&:hover': {
                  backgroundColor: '#0077ed',
                },
              },
              '&:hover': {
                backgroundColor: 'rgba(0, 113, 227, 0.04)',
              },
            },
          }}
        >
          <ToggleButton value="table" aria-label="vue tableau">
            <ViewListIcon />
          </ToggleButton>
          <ToggleButton value="pipeline" aria-label="vue pipeline">
            <ViewKanbanIcon />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <StyledCard sx={{ mb: 3 }}>
        <Box sx={{ 
          p: 2,
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          borderBottom: '1px solid #e5e5e7'
        }}>
          <StyledTextField
            placeholder="Rechercher un prospect..."
            value={searchTerm}
            onChange={handleSearch}
            variant="outlined"
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#86868b' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              width: '300px',
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#f5f5f7',
                '&:hover': {
                  backgroundColor: '#ffffff',
                },
                '&.Mui-focused': {
                  backgroundColor: '#ffffff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                },
              },
            }}
          />
          <StyledButton
            variant="outlined"
            startIcon={<FilterListIcon />}
            onClick={handleResetFilters}
            sx={{
              borderColor: '#d2d2d7',
              color: '#86868b',
              '&:hover': {
                borderColor: '#0066cc',
                color: '#0066cc',
                bgcolor: 'rgba(0, 113, 227, 0.04)',
              }
            }}
          >
            Réinitialiser les filtres
          </StyledButton>
        </Box>

        {viewMode === 'table' ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f7' }}>
                  <TableCell padding="checkbox" sx={{ width: '48px' }}>
                    <Checkbox
                      checked={selectedProspects.length === prospects.length}
                      indeterminate={selectedProspects.length > 0 && selectedProspects.length < prospects.length}
                      onChange={handleSelectAll}
                      sx={{
                        color: '#0066cc',
                        '&.Mui-checked': {
                          color: '#0066cc',
                        },
                      }}
                    />
                  </TableCell>
                  {visibleColumns.nom && (
                    <TableCell sx={{ 
                      fontWeight: 600, 
                      color: '#1d1d1f',
                      fontSize: '14px',
                      py: 2
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        Nom
                        <IconButton
                          size="small"
                          onClick={(e) => handleFilterClick(e, 'nom')}
                          sx={{
                            color: isFilterActive('nom') ? '#0066cc' : '#86868b',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              backgroundColor: 'rgba(0, 113, 227, 0.04)',
                            },
                          }}
                        >
                          <FilterListIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  )}
                  {visibleColumns.entreprise && (
                    <TableCell sx={{ 
                      fontWeight: 600, 
                      color: '#1d1d1f',
                      fontSize: '14px',
                      py: 2
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        Entreprise
                        <IconButton
                          size="small"
                          onClick={(e) => handleFilterClick(e, 'entreprise')}
                          sx={{
                            color: isFilterActive('entreprise') ? '#0066cc' : '#86868b',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              backgroundColor: 'rgba(0, 113, 227, 0.04)',
                            },
                          }}
                        >
                          <FilterListIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  )}
                  {visibleColumns.statut && (
                    <TableCell sx={{ 
                      fontWeight: 600, 
                      color: '#1d1d1f',
                      fontSize: '14px',
                      py: 2
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        Statut
                        <IconButton
                          size="small"
                          onClick={(e) => handleFilterClick(e, 'statut')}
                          sx={{
                            color: isFilterActive('statut') ? '#0066cc' : '#86868b',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              backgroundColor: 'rgba(0, 113, 227, 0.04)',
                            },
                          }}
                        >
                          <FilterListIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  )}
                  {visibleColumns.proprietaire && (
                    <TableCell sx={{ 
                      fontWeight: 600, 
                      color: '#1d1d1f',
                      fontSize: '14px',
                      py: 2
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        Propriétaire
                        <IconButton
                          size="small"
                          onClick={(e) => handleFilterClick(e, 'ownerId')}
                          sx={{
                            color: isFilterActive('ownerId') ? '#0066cc' : '#86868b',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              backgroundColor: 'rgba(0, 113, 227, 0.04)',
                            },
                          }}
                        >
                          <FilterListIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  )}
                  {visibleColumns.dateAjout && (
                    <TableCell sx={{ 
                      fontWeight: 600, 
                      color: '#1d1d1f',
                      fontSize: '14px',
                      py: 2
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        Date d'ajout
                        <IconButton
                          size="small"
                          onClick={(e) => handleFilterClick(e, 'dateAjout')}
                          sx={{
                            color: isFilterActive('dateAjout') ? '#0066cc' : '#86868b',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              backgroundColor: 'rgba(0, 113, 227, 0.04)',
                            },
                          }}
                        >
                          <FilterListIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {getFilteredAndSortedProspects().map((prospect) => (
                  <StyledTableRow 
                    key={prospect.id}
                    onClick={(event) => handleProspectClick(prospect.id, event)}
                    selected={selectedProspects.includes(prospect.id)}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 113, 227, 0.04)',
                      },
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(0, 113, 227, 0.08)',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 113, 227, 0.12)',
                        },
                      },
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedProspects.includes(prospect.id)}
                        onChange={() => handleSelectOne(prospect.id)}
                        onClick={(e) => e.stopPropagation()}
                        sx={{
                          color: '#0066cc',
                          '&.Mui-checked': {
                            color: '#0066cc',
                          },
                        }}
                      />
                    </TableCell>
                    {visibleColumns.nom && (
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {prospect.photoUrl ? (
                            <Avatar 
                              src={prospect.photoUrl}
                              sx={{ 
                                width: 32, 
                                height: 32,
                                border: '1px solid #e5e5ea'
                              }}
                            />
                          ) : (
                            <Avatar 
                              sx={{ 
                                width: 32, 
                                height: 32,
                                bgcolor: '#f5f5f7',
                                border: '1px solid #e5e5ea'
                              }}
                            >
                              {(prospect.nom || prospect.name || '?').charAt(0)}
                            </Avatar>
                          )}
                          <Typography sx={{ fontWeight: 500 }}>
                            {prospect.nom || prospect.name || 'Non spécifié'}
                          </Typography>
                        </Box>
                      </TableCell>
                    )}
                    {visibleColumns.entreprise && (
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {prospect.companyLogoUrl ? (
                            <Avatar 
                              src={prospect.companyLogoUrl}
                              sx={{ 
                                width: 24, 
                                height: 24,
                                border: '1px solid #e5e5ea'
                              }}
                            />
                          ) : (
                            <Avatar 
                              sx={{ 
                                width: 24, 
                                height: 24,
                                bgcolor: '#f5f5f7',
                                border: '1px solid #e5e5ea'
                              }}
                            >
                              {(prospect.entreprise || prospect.company || '?').charAt(0)}
                            </Avatar>
                          )}
                          <Typography sx={{ color: '#1d1d1f' }}>
                            {capitalizeWords(prospect.entreprise || prospect.company || 'Non spécifié')}
                          </Typography>
                        </Box>
                      </TableCell>
                    )}
                    {visibleColumns.statut && (
                      <TableCell>
                        <StyledChip
                          label={getStatusLabel(prospect.statut)}
                          size="small"
                          sx={{
                            backgroundColor: `${getStatusColor(prospect.statut)}20`,
                            color: getStatusColor(prospect.statut),
                            fontWeight: 500,
                            borderRadius: '6px',
                            height: '24px'
                          }}
                        />
                      </TableCell>
                    )}
                    {visibleColumns.proprietaire && (
                      <TableCell>
                        <FormControl fullWidth size="small">
                          <Select
                            value={prospect.ownerId || ''}
                            onChange={(e) => handleOwnerChange(prospect.id, e.target.value)}
                            displayEmpty
                            sx={{
                              '& .MuiSelect-select': {
                                py: 1,
                                color: '#1d1d1f'
                              }
                            }}
                          >
                            <MenuItem value="">
                              <em>Aucun propriétaire</em>
                            </MenuItem>
                            {structureMembers.map((member) => (
                              <MenuItem key={member.id} value={member.id}>
                                {member.displayName}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                    )}
                    {visibleColumns.dateAjout && (
                      <TableCell>
                        <Typography sx={{ color: '#1d1d1f' }}>
                          {formatDate(prospect.dateAjout || prospect.dateCreation || prospect.derniereInteraction)}
                        </Typography>
                      </TableCell>
                    )}
                  </StyledTableRow>
                ))}
                {prospects.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="textSecondary">
                        Aucun prospect trouvé
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          renderPipelineView()
        )}
      </StyledCard>

      <Dialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: APPLE_SHADOWS.large,
            border: `1px solid ${APPLE_COLORS.border}`,
            overflow: 'hidden',
          }
        }}
      >
        <DialogTitle sx={{ 
          fontWeight: 600, 
          color: APPLE_COLORS.text,
          fontSize: '20px',
          borderBottom: `1px solid ${APPLE_COLORS.border}`,
          p: 3
        }}>
          Nouveau prospect
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Nom"
              value={newProspect.nom}
              onChange={(e) => setNewProspect({ ...newProspect, nom: e.target.value })}
              variant="outlined"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  transition: APPLE_TRANSITIONS.default,
                  '&:hover': {
                    backgroundColor: APPLE_COLORS.background,
                  },
                  '&.Mui-focused': {
                    backgroundColor: APPLE_COLORS.surface,
                    boxShadow: APPLE_SHADOWS.small,
                  },
                },
              }}
            />
            <TextField
              label="Entreprise"
              value={newProspect.entreprise}
              onChange={(e) => setNewProspect({ ...newProspect, entreprise: e.target.value })}
              variant="outlined"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  transition: APPLE_TRANSITIONS.default,
                  '&:hover': {
                    backgroundColor: APPLE_COLORS.background,
                  },
                  '&.Mui-focused': {
                    backgroundColor: APPLE_COLORS.surface,
                    boxShadow: APPLE_SHADOWS.small,
                  },
                },
              }}
            />
            <TextField
              label="Email"
              value={newProspect.email}
              onChange={(e) => setNewProspect({ ...newProspect, email: e.target.value })}
              variant="outlined"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  transition: APPLE_TRANSITIONS.default,
                  '&:hover': {
                    backgroundColor: APPLE_COLORS.background,
                  },
                  '&.Mui-focused': {
                    backgroundColor: APPLE_COLORS.surface,
                    boxShadow: APPLE_SHADOWS.small,
                  },
                },
              }}
            />
            <TextField
              label="Téléphone"
              value={newProspect.telephone}
              onChange={(e) => setNewProspect({ ...newProspect, telephone: e.target.value })}
              variant="outlined"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  transition: APPLE_TRANSITIONS.default,
                  '&:hover': {
                    backgroundColor: APPLE_COLORS.background,
                  },
                  '&.Mui-focused': {
                    backgroundColor: APPLE_COLORS.surface,
                    boxShadow: APPLE_SHADOWS.small,
                  },
                },
              }}
            />
            <TextField
              label="Adresse"
              value={newProspect.adresse}
              onChange={(e) => setNewProspect({ ...newProspect, adresse: e.target.value })}
              variant="outlined"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  transition: APPLE_TRANSITIONS.default,
                  '&:hover': {
                    backgroundColor: APPLE_COLORS.background,
                  },
                  '&.Mui-focused': {
                    backgroundColor: APPLE_COLORS.surface,
                    boxShadow: APPLE_SHADOWS.small,
                  },
                },
              }}
            />
            <TextField
              label="Secteur"
              value={newProspect.secteur}
              onChange={(e) => setNewProspect({ ...newProspect, secteur: e.target.value })}
              variant="outlined"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  transition: APPLE_TRANSITIONS.default,
                  '&:hover': {
                    backgroundColor: APPLE_COLORS.background,
                  },
                  '&.Mui-focused': {
                    backgroundColor: APPLE_COLORS.surface,
                    boxShadow: APPLE_SHADOWS.small,
                  },
                },
              }}
            />
            <TextField
              label="Taille"
              value={newProspect.taille}
              onChange={(e) => setNewProspect({ ...newProspect, taille: e.target.value })}
              variant="outlined"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  transition: APPLE_TRANSITIONS.default,
                  '&:hover': {
                    backgroundColor: APPLE_COLORS.background,
                  },
                  '&.Mui-focused': {
                    backgroundColor: APPLE_COLORS.surface,
                    boxShadow: APPLE_SHADOWS.small,
                  },
                },
              }}
            />
            <TextField
              label="Source"
              value={newProspect.source}
              onChange={(e) => setNewProspect({ ...newProspect, source: e.target.value })}
              variant="outlined"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  transition: APPLE_TRANSITIONS.default,
                  '&:hover': {
                    backgroundColor: APPLE_COLORS.background,
                  },
                  '&.Mui-focused': {
                    backgroundColor: APPLE_COLORS.surface,
                    boxShadow: APPLE_SHADOWS.small,
                  },
                },
              }}
            />
            <TextField
              label="Notes"
              value={newProspect.notes}
              onChange={(e) => setNewProspect({ ...newProspect, notes: e.target.value })}
              variant="outlined"
              size="small"
              multiline
              rows={3}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  transition: APPLE_TRANSITIONS.default,
                  '&:hover': {
                    backgroundColor: APPLE_COLORS.background,
                  },
                  '&.Mui-focused': {
                    backgroundColor: APPLE_COLORS.surface,
                    boxShadow: APPLE_SHADOWS.small,
                  },
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ 
          p: 3, 
          borderTop: `1px solid ${APPLE_COLORS.border}`,
          gap: 1
        }}>
          <Button
            onClick={() => setIsCreateDialogOpen(false)}
            sx={{
              color: APPLE_COLORS.primary,
              textTransform: 'none',
              fontWeight: 500,
              transition: APPLE_TRANSITIONS.default,
              '&:hover': {
                backgroundColor: 'rgba(0, 113, 227, 0.04)',
              },
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleCreateProspect}
            variant="contained"
            sx={{
              backgroundColor: APPLE_COLORS.primary,
              color: APPLE_COLORS.surface,
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 500,
              px: 3,
              transition: APPLE_TRANSITIONS.default,
              '&:hover': {
                backgroundColor: '#0077ed',
                transform: 'translateY(-1px)',
                boxShadow: APPLE_SHADOWS.medium,
              },
            }}
          >
            Créer
          </Button>
        </DialogActions>
      </Dialog>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleExtensionClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: APPLE_SHADOWS.large,
            border: `1px solid ${APPLE_COLORS.border}`,
            p: 3,
            width: 400,
          }
        }}
      >
        <Typography 
          variant="h6" 
          sx={{ 
            mb: 2, 
            fontWeight: 600,
            color: APPLE_COLORS.text,
            fontSize: '18px'
          }}
        >
          Installation de l'extension
        </Typography>
        <List>
          <ListItem sx={{ 
            borderRadius: '8px',
            transition: APPLE_TRANSITIONS.default,
            '&:hover': {
              backgroundColor: 'rgba(0, 113, 227, 0.04)',
            },
          }}>
            <ListItemIcon>
              <DownloadIcon sx={{ color: APPLE_COLORS.primary }} />
            </ListItemIcon>
            <ListItemText 
              primary="Télécharger l'extension"
              secondary="Cliquez sur le bouton ci-dessous pour télécharger l'extension"
              primaryTypographyProps={{
                sx: { 
                  fontWeight: 500,
                  color: APPLE_COLORS.text
                }
              }}
              secondaryTypographyProps={{
                sx: { 
                  color: APPLE_COLORS.secondary,
                  fontSize: '14px'
                }
              }}
            />
          </ListItem>
          <ListItem sx={{ 
            borderRadius: '8px',
            transition: APPLE_TRANSITIONS.default,
            '&:hover': {
              backgroundColor: 'rgba(0, 113, 227, 0.04)',
            },
          }}>
            <ListItemIcon>
              <ExtensionIcon sx={{ color: APPLE_COLORS.primary }} />
            </ListItemIcon>
            <ListItemText 
              primary="Installer l'extension"
              secondary="Ouvrez Chrome et accédez à chrome://extensions/ puis cliquez sur Charger l'extension non empaquetée"
              primaryTypographyProps={{
                sx: { 
                  fontWeight: 500,
                  color: APPLE_COLORS.text
                }
              }}
              secondaryTypographyProps={{
                sx: { 
                  color: APPLE_COLORS.secondary,
                  fontSize: '14px'
                }
              }}
            />
          </ListItem>
          <ListItem sx={{ 
            borderRadius: '8px',
            transition: APPLE_TRANSITIONS.default,
            '&:hover': {
              backgroundColor: 'rgba(0, 113, 227, 0.04)',
            },
          }}>
            <ListItemIcon>
              <CheckCircleIcon sx={{ color: APPLE_COLORS.success }} />
            </ListItemIcon>
            <ListItemText 
              primary="Activer l'extension"
              secondary="Activez le mode développeur et glissez-déposez le fichier téléchargé"
              primaryTypographyProps={{
                sx: { 
                  fontWeight: 500,
                  color: APPLE_COLORS.text
                }
              }}
              secondaryTypographyProps={{
                sx: { 
                  color: APPLE_COLORS.secondary,
                  fontSize: '14px'
                }
              }}
            />
          </ListItem>
        </List>
        <Button
          variant="contained"
          fullWidth
          startIcon={<DownloadIcon />}
          sx={{
            mt: 2,
            backgroundColor: APPLE_COLORS.primary,
            color: APPLE_COLORS.surface,
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 500,
            transition: APPLE_TRANSITIONS.default,
            '&:hover': {
              backgroundColor: '#0077ed',
              transform: 'translateY(-1px)',
              boxShadow: APPLE_SHADOWS.medium,
            },
          }}
          href="/extension/extension.zip"
          download
        >
          Télécharger l'extension
        </Button>
      </Popover>

      <Popover
        open={Boolean(columnFilterAnchorEl)}
        anchorEl={columnFilterAnchorEl}
        onClose={handleColumnFilterClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: 'none',
            border: '1px solid #e5e5ea',
            p: 2
          }
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Colonnes visibles
        </Typography>
        <List dense>
          {Object.entries(visibleColumns).map(([column, visible]) => (
            <ListItem
              key={column}
              button
              onClick={() => toggleColumn(column)}
              sx={{
                borderRadius: '8px',
                '&:hover': {
                  backgroundColor: 'rgba(0, 113, 227, 0.04)',
                },
              }}
            >
              <ListItemIcon>
                <Checkbox
                  checked={visible}
                  sx={{
                    color: '#0071e3',
                    '&.Mui-checked': {
                      color: '#0071e3',
                    },
                  }}
                />
              </ListItemIcon>
              <ListItemText 
                primary={column.charAt(0).toUpperCase() + column.slice(1)}
                sx={{ color: '#1d1d1f' }}
              />
            </ListItem>
          ))}
        </List>
      </Popover>

      <Popover
        open={Boolean(filterAnchorEl)}
        anchorEl={filterAnchorEl}
        onClose={handleFilterClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        container={document.body}
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: 'none',
            border: '1px solid #e5e5ea',
            p: 2,
            minWidth: 250,
            mt: 1
          }
        }}
      >
        {currentFilterColumn && (
          <>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Trier {currentFilterColumn}
            </Typography>
            <FormControl component="fieldset">
              <RadioGroup
                value={columnFilters[currentFilterColumn]?.order || 'asc'}
                onChange={(e) => handleSortOrderChange(e.target.value as 'asc' | 'desc')}
              >
                <FormControlLabel
                  value="asc"
                  control={
                    <Radio
                      sx={{
                        color: '#0071e3',
                        '&.Mui-checked': {
                          color: '#0071e3',
                        },
                      }}
                    />
                  }
                  label="A à Z"
                  sx={{
                    '&:hover': {
                      backgroundColor: 'rgba(0, 113, 227, 0.04)',
                      borderRadius: '8px',
                    },
                  }}
                />
                <FormControlLabel
                  value="desc"
                  control={
                    <Radio
                      sx={{
                        color: '#0071e3',
                        '&.Mui-checked': {
                          color: '#0071e3',
                        },
                      }}
                    />
                  }
                  label="Z à A"
                  sx={{
                    '&:hover': {
                      backgroundColor: 'rgba(0, 113, 227, 0.04)',
                      borderRadius: '8px',
                    },
                  }}
                />
              </RadioGroup>
            </FormControl>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Filtrer par
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Rechercher..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#0071e3',
                  },
                },
              }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Checkbox
                checked={selectAll}
                onChange={(e) => handleSelectAllChange(e.target.checked)}
                sx={{
                  color: '#0071e3',
                  '&.Mui-checked': {
                    color: '#0071e3',
                  },
                }}
              />
              <Typography variant="body2" sx={{ color: '#86868b' }}>
                Tout sélectionner
              </Typography>
            </Box>
            <List 
              sx={{ 
                maxHeight: '200px', 
                overflow: 'auto',
                '& .MuiListItem-root': {
                  py: 0.5
                }
              }}
            >
              {getFilteredValues(currentFilterColumn).map((value) => (
                <ListItem
                  key={value}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'rgba(0, 113, 227, 0.04)',
                      borderRadius: '8px',
                    },
                  }}
                >
                  <Checkbox
                    checked={columnFilters[currentFilterColumn]?.values.includes(value) || false}
                    onChange={(e) => handleFilterValueChange(value, e.target.checked)}
                    sx={{
                      color: '#0071e3',
                      '&.Mui-checked': {
                        color: '#0071e3',
                      },
                    }}
                  />
                  <ListItemText 
                    primary={value || 'Vide'} 
                    sx={{
                      '& .MuiTypography-root': {
                        fontSize: '0.875rem',
                      },
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </Popover>

      <Menu
        anchorEl={actionMenuAnchorEl}
        open={Boolean(actionMenuAnchorEl)}
        onClose={() => setActionMenuAnchorEl(null)}
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: 'none',
            border: '1px solid #e5e5ea',
            mt: 1
          }
        }}
      >
        {structureMembers.map((member) => (
          <MenuItem
            key={member.id}
            onClick={() => handleBulkAssign(member.id)}
            sx={{
              '&:hover': {
                backgroundColor: 'rgba(0, 113, 227, 0.04)',
              },
            }}
          >
            {member.displayName}
          </MenuItem>
        ))}
      </Menu>

      {/* Dialog de confirmation de suppression */}
      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: APPLE_SHADOWS.large,
            border: `1px solid ${APPLE_COLORS.border}`,
            overflow: 'hidden',
          }
        }}
      >
        <DialogTitle sx={{ 
          fontWeight: 600, 
          color: APPLE_COLORS.text,
          fontSize: '20px',
          borderBottom: `1px solid ${APPLE_COLORS.border}`,
          p: 3
        }}>
          Confirmer la suppression
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography>
            Êtes-vous sûr de vouloir supprimer {selectedProspects.length} prospect(s) ? Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ 
          p: 3, 
          borderTop: `1px solid ${APPLE_COLORS.border}`,
          gap: 1
        }}>
          <Button
            onClick={() => setIsDeleteDialogOpen(false)}
            sx={{
              color: APPLE_COLORS.primary,
              textTransform: 'none',
              fontWeight: 500,
              transition: APPLE_TRANSITIONS.default,
              '&:hover': {
                backgroundColor: 'rgba(0, 113, 227, 0.04)',
              },
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={() => {
              handleBulkDelete();
              setIsDeleteDialogOpen(false);
            }}
            variant="contained"
            sx={{
              backgroundColor: '#ff3b30',
              color: APPLE_COLORS.surface,
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 500,
              px: 3,
              transition: APPLE_TRANSITIONS.default,
              '&:hover': {
                backgroundColor: '#ff453a',
                transform: 'translateY(-1px)',
                boxShadow: APPLE_SHADOWS.medium,
              },
            }}
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog d'import Excel */}
      <Dialog
        open={isImportDialogOpen}
        onClose={handleImportDialogClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: APPLE_SHADOWS.large,
            border: `1px solid ${APPLE_COLORS.border}`,
            overflow: 'hidden',
          }
        }}
      >
        <DialogTitle sx={{ 
          fontWeight: 600, 
          color: APPLE_COLORS.text,
          fontSize: '20px',
          borderBottom: `1px solid ${APPLE_COLORS.border}`,
          p: 3
        }}>
          Importer des prospects depuis Excel/CSV
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Stepper activeStep={currentStep} orientation="vertical" sx={{ mb: 3 }}>
            {importSteps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel
                  error={step.error ? true : false}
                  icon={
                    step.completed ? (
                      <CheckCircleIcon sx={{ color: APPLE_COLORS.success }} />
                    ) : step.error ? (
                      <ErrorIcon sx={{ color: APPLE_COLORS.error }} />
                    ) : (
                      <WarningIcon sx={{ color: APPLE_COLORS.secondary }} />
                    )
                  }
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {step.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {step.description}
                  </Typography>
                  {step.error && (
                    <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                      {step.error}
                    </Typography>
                  )}
                </StepLabel>
                <StepContent>
                  {index === 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Button
                        variant="outlined"
                        component="label"
                        startIcon={<UploadIcon />}
                        sx={{
                          width: '100%',
                          py: 2,
                          borderColor: APPLE_COLORS.border,
                          '&:hover': {
                            borderColor: APPLE_COLORS.primary,
                            backgroundColor: 'rgba(0, 113, 227, 0.04)',
                          }
                        }}
                      >
                        {importFile ? importFile.name : 'Sélectionner un fichier Excel/CSV'}
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          hidden
                          onChange={handleFileUpload}
                        />
                      </Button>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Formats supportés : CSV, XLSX, XLS
                      </Typography>
                      <Button
                        variant="text"
                        startIcon={<DownloadIcon />}
                        href="/template-import-prospects.csv"
                        download
                        sx={{
                          mt: 2,
                          color: APPLE_COLORS.primary,
                          textTransform: 'none',
                          '&:hover': {
                            backgroundColor: 'rgba(0, 113, 227, 0.04)',
                          }
                        }}
                      >
                        Télécharger le modèle CSV
                      </Button>
                    </Box>
                  )}

                  {index === 1 && availableColumns.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                        Associez les colonnes de votre fichier aux champs du système :
                      </Typography>
                      <Box sx={{ display: 'grid', gap: 2 }}>
                        {availableColumns.map((column) => (
                          <FormControl key={column} fullWidth size="small">
                            <InputLabel>{column}</InputLabel>
                            <Select
                              value={columnMapping[column] || ''}
                              onChange={(e) => handleColumnMappingChange(column, e.target.value)}
                              label={column}
                              sx={{
                                '& .MuiSelect-select': {
                                  py: 1,
                                }
                              }}
                            >
                              <MenuItem value="">
                                <em>Ignorer cette colonne</em>
                              </MenuItem>
                              <MenuItem value="nom">Nom</MenuItem>
                              <MenuItem value="entreprise">Entreprise</MenuItem>
                              <MenuItem value="email">Email</MenuItem>
                              <MenuItem value="telephone">Téléphone</MenuItem>
                              <MenuItem value="adresse">Adresse</MenuItem>
                              <MenuItem value="secteur">Secteur</MenuItem>
                              <MenuItem value="source">Source</MenuItem>
                              <MenuItem value="notes">Notes</MenuItem>
                              <MenuItem value="linkedinUrl">URL LinkedIn</MenuItem>
                              <MenuItem value="statut">Statut</MenuItem>
                            </Select>
                          </FormControl>
                        ))}
                      </Box>
                      <Button
                        variant="contained"
                        onClick={validateAndTransformData}
                        sx={{
                          mt: 2,
                          backgroundColor: APPLE_COLORS.primary,
                          '&:hover': {
                            backgroundColor: '#0077ed',
                          }
                        }}
                      >
                        Valider et continuer
                      </Button>
                    </Box>
                  )}

                  {index === 2 && (
                    <Box sx={{ mt: 2 }}>
                      {importErrors.length > 0 && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Erreurs détectées ({importErrors.length}) :
                          </Typography>
                          <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                            {importErrors.map((error, idx) => (
                              <Typography key={idx} variant="body2" sx={{ mb: 0.5 }}>
                                • {error}
                              </Typography>
                            ))}
                          </Box>
                        </Alert>
                      )}
                      
                      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                        Aperçu des données ({importedData.length} prospects) :
                      </Typography>
                      <Box sx={{ maxHeight: 300, overflow: 'auto', border: `1px solid ${APPLE_COLORS.border}`, borderRadius: 1 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Nom</TableCell>
                              <TableCell>Entreprise</TableCell>
                              <TableCell>Email</TableCell>
                              <TableCell>Statut</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {importedData.slice(0, 10).map((prospect, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{prospect.nom || prospect.name || '-'}</TableCell>
                                <TableCell>{prospect.entreprise || prospect.company || '-'}</TableCell>
                                <TableCell>{prospect.email || '-'}</TableCell>
                                <TableCell>{prospect.statut || 'Non qualifié'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {importedData.length > 10 && (
                          <Typography variant="caption" color="text.secondary" sx={{ p: 1, display: 'block' }}>
                            ... et {importedData.length - 10} autres prospects
                          </Typography>
                        )}
                      </Box>
                      
                      {importErrors.length === 0 && (
                        <Button
                          variant="contained"
                          onClick={handleImportProspects}
                          disabled={isImporting}
                          sx={{
                            mt: 2,
                            backgroundColor: APPLE_COLORS.primary,
                            '&:hover': {
                              backgroundColor: '#0077ed',
                            }
                          }}
                        >
                          {isImporting ? 'Import en cours...' : 'Importer les prospects'}
                        </Button>
                      )}
                    </Box>
                  )}

                  {index === 3 && (
                    <Box sx={{ mt: 2 }}>
                      {isImporting && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Import en cours...
                          </Typography>
                          <LinearProgress 
                            variant="determinate" 
                            value={importProgress} 
                            sx={{ 
                              height: 8, 
                              borderRadius: 4,
                              backgroundColor: 'rgba(0, 113, 227, 0.1)',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: APPLE_COLORS.primary,
                              }
                            }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {Math.round(importProgress)}% terminé
                          </Typography>
                        </Box>
                      )}

                      {importSuccess.length > 0 && (
                        <Alert severity="success" sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Import réussi ({importSuccess.length} prospects) :
                          </Typography>
                          <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                            {importSuccess.slice(0, 5).map((success, idx) => (
                              <Typography key={idx} variant="body2" sx={{ mb: 0.5 }}>
                                ✓ {success}
                              </Typography>
                            ))}
                            {importSuccess.length > 5 && (
                              <Typography variant="body2" color="text.secondary">
                                ... et {importSuccess.length - 5} autres
                              </Typography>
                            )}
                          </Box>
                        </Alert>
                      )}

                      {importErrors.length > 0 && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Erreurs lors de l'import ({importErrors.length}) :
                          </Typography>
                          <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                            {importErrors.slice(0, 5).map((error, idx) => (
                              <Typography key={idx} variant="body2" sx={{ mb: 0.5 }}>
                                • {error}
                              </Typography>
                            ))}
                            {importErrors.length > 5 && (
                              <Typography variant="body2" color="text.secondary">
                                ... et {importErrors.length - 5} autres erreurs
                              </Typography>
                            )}
                          </Box>
                        </Alert>
                      )}
                    </Box>
                  )}
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </DialogContent>
        <DialogActions sx={{ 
          p: 3, 
          borderTop: `1px solid ${APPLE_COLORS.border}`,
          gap: 1
        }}>
          <Button
            onClick={handleImportDialogClose}
            sx={{
              color: APPLE_COLORS.primary,
              textTransform: 'none',
              fontWeight: 500,
              transition: APPLE_TRANSITIONS.default,
              '&:hover': {
                backgroundColor: 'rgba(0, 113, 227, 0.04)',
              },
            }}
          >
            {currentStep === 3 ? 'Terminer' : 'Annuler'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Commercial; 