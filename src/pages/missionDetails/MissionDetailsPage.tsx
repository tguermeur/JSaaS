import React, { useEffect, useState, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  LinearProgress,
  Button,
  Avatar,
  Grid,
  Divider,
  Alert,
  Tabs,
  Tab,
  TextField,
  IconButton,
  Autocomplete,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Tooltip,
  Menu,
  MenuItem,
  Snackbar,
  ListItemIcon,
  TableFooter,
  Collapse,
  InputAdornment,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  Business as BusinessIcon,
  LocationOn as LocationOnIcon,
  CalendarToday as CalendarIcon,
  People as PeopleIcon,
  Description as DescriptionIcon,
  Assignment as AssignmentIcon,
  Receipt as ReceiptIcon,
  Handshake as HandshakeIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Person as PersonIcon,
  Timer as TimerIcon,
  PublicOff as PublicOffIcon,
  Public as PublicIcon,
  PictureAsPdf as PdfIcon,
  Share as ShareIcon,
  PersonAdd as PersonAddIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  DeleteOutline as DeleteIcon,
  NoteAdd as NoteAddIcon,
  AccessTime as AccessTimeIcon,
  Group as GroupIcon,
  Info as InfoIcon,
  UploadFile as UploadFileIcon,
  Download as DownloadIcon,
  MoreVert as MoreVertIcon,
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
  Dashboard as DashboardIcon,
  Timeline as TimelineIcon,
  Upload as UploadIcon,
  Gesture as GestureIcon,
  Category as CategoryIcon,
  DragIndicator as DragIndicatorIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { doc, collection, query, where, getDocs, addDoc, updateDoc, orderBy, deleteDoc, getDoc, setDoc, writeBatch, limit, deleteField } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { decryptUsersList, decryptUserDisplayData, getDecryptedUserDisplayName, decryptUsersListProgressive, isEncryptedField, getSafeDisplayName } from '../../utils/decryptUserUtils';
import { prepareDecryptedDocumentContext } from '../../utils/documentDecryptUtils';
import { createFilterOptions } from '@mui/material';
import { getDownloadURL, ref, uploadBytes, deleteObject } from 'firebase/storage';
import { db, app, storage, getAppFunctions } from '../../firebase/config';
import { JOBSERVICE_WORKSPACE } from '../detailWorkspace';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import AccessDenied from '../../components/common/AccessDenied';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { useSnackbar } from 'notistack';
import { SelectChangeEvent } from '@mui/material/Select';
import { DocumentType, TemplateVariable, DOCUMENT_TYPES } from '../../types/templates';
import { Contact } from '../../firebase/contacts';
import TaggingInput from '../../components/ui/TaggingInput';
import UserNameText from '../../components/common/UserNameText';
import UserReferenceText from '../../components/common/UserReferenceText';
import UserAvatarInitials from '../../components/common/UserAvatarInitials';
import { NotificationService } from '../../services/notificationService';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { tokens } from '../../theme/tokens';
import { dsPageCanvasSx } from '../../components/ds';
import {
  useMissionDetailTabs,
  type MissionDetailTabId,
} from '../../hooks/useMissionDetailTabs';
import {
  MissionDetailShell,
  MissionDetailSidebarPanel,
  ActivityTab,
} from './index';
import SendForSignatureDialog from '../../components/signatures/SendForSignatureDialog';
import {
  MissionDetailHeaderV2,
  MissionSaveBar,
  MissionOverviewTabV2,
  MissionCandidatesTabV2,
  MissionDocumentsTabV2,
  MissionNotesTabV2,
  mdV2RootSx,
} from './v2';
import { AvenantStudentSelectDialog } from './v2/AvenantStudentSelectDialog';
import { LetterMissionStudentSelectDialog } from './v2/LetterMissionStudentSelectDialog';
import { GenerateFromTemplateDialog } from './v2/GenerateFromTemplateDialog';
import AddCandidatesDialog, {
  type CandidateApplicationStatus,
  type CandidatePick,
} from './v2/AddCandidatesDialog';
import { toDateFromFirestore, formatShortDate } from '../../utils/dateUtils';
import { resolveTagFromVariableId, tagNeedsChargeData, tagNeedsMissionTypeData } from '../../utils/variableTags';
import {
  applyTagReplacements,
  buildTagReplacements,
  detectMissingTags,
  reviewTemplateTags,
  type TagReplacementContext,
} from '../../utils/documentTagEngine';

import { parseWorkingHoursFromFirestoreDocs, fetchWorkingHoursForApplications, buildWorkingHoursDocumentData, type WorkingHourEntry } from './workingHoursUtils';
// --- STRICT MODE DROPPABLE FIX ---
// Nécessaire pour React 18 + react-beautiful-dnd
const StrictModeDroppable = ({ children, ...props }: any) => {
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

// Interface pour DocumentTag
interface AssignedTemplateData {
  id: string;
  name?: string;
  pdfUrl: string;
  variables?: TemplateVariable[];
  generationType: 'template' | 'editor';
  assignmentId?: string;
}

interface DocumentTag {
  id: string;
  name: string;
  color?: string;
}

interface MissionExpense {
  id: string;
  name: string;
  tva: number; // Pourcentage de TVA (ex: 20 pour 20%)
  priceHT: number;
  isSaved?: boolean; // Indique si la dépense est enregistrée dans la mission
  savedIndex?: number; // Index de sauvegarde dans la mission (1, 2, 3, etc.)
}

type MissionEtape = 'Négociation' | 'Recrutement' | 'Date de mission' | 'Facturation' | 'Audit' | 'Archivé';

interface FirestoreCompanyData {
  name: string;
  nSiret?: string;
  siret?: string;
  createdAt: Date;
  structureId: string;
  missionsCount: number;
  totalRevenue: number;
}

interface Mission {
  id: string;
  numeroMission: string;
  structureId: string;
  companyId: string; // ID de l'entreprise
  company: string; // Nom de l'entreprise
  location: string;
  startDate: string;
  endDate: string;
  description: string;
  missionTypeId?: string; // ID du type de mission
  studentCount: number;
  hoursPerStudent: string;
  chargeId: string;
  chargeName: string;
  title: string;
  salary: string;
  hours: number;
  requiresCV: boolean;
  requiresMotivation: boolean;
  isPublished: boolean;
  isPublic: boolean;
  priceHT: number;
  totalHT?: number;
  totalTTC?: number;
  tva?: number;
  updatedAt: Date;
  etape: MissionEtape;
  ecole?: string;
  createdBy?: string;
  permissions?: MissionPermissions;
  contactId?: string;
  contact?: Contact;
  isArchived?: boolean;
  mandat?: string; // Format: "2022-2023", "2023-2024", etc.
  // Champs de dépenses (nomdepense1, tvadepense1, totaldepense1, etc.)
  [key: string]: any; // Pour permettre les champs dynamiques de dépenses
}

interface MissionPermissions {
  viewers: string[];  // IDs des utilisateurs ayant accès en lecture
  editors: string[];  // IDs des utilisateurs ayant accès en modification
}

interface MissionUser {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'viewer' | 'editor';
}

interface Application {
  id: string;
  userId: string;
  missionId: string;
  status: 'En attente' | 'Acceptée' | 'Refusée';
  createdAt: Date;
  updatedAt: Date;
  userEmail: string;
  userPhotoURL?: string;
  userDisplayName?: string;
  userPhone?: string;
  userStudentId?: string;
  cvUrl?: string;
  cvUpdatedAt?: Date;
  motivationLetter?: string;
  submittedAt: Date;
  isDossierValidated?: boolean;
  workingHours?: WorkingHourEntry[];
  mission?: Mission;
  /** Valeurs saisies pour les balises PDF propres à l'avenant (reason, amendment_*, etc.) */
  documentTagOverrides?: Record<string, string>;
}


interface ExpenseNote {
  id: string;
  missionId: string;
  userId: string;
  amount: number;
  description: string;
  date: Date;
  status: 'En attente' | 'Validée' | 'Refusée';
  attachmentUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface WorkingHourBreak {
  start: string;
  end: string;
}

interface WorkingHour {
  id: string;
  applicationId: string;
  userId: string;
  missionId: string;
  hours: Array<{
    date: string;
    startTime: string;
    endTime: string;
    breaks: WorkingHourBreak[];
  }>;
  createdAt: Date;
  updatedAt: Date;
}

interface User {
  id: string;
  displayName: string;
  email: string;
  photoURL: string;
  ecole: string;
  firstName?: string;
  lastName?: string;
}

interface Structure {
  id: string;
  nom: string;
  ecole: string;
}

interface ExtendedUser {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  status?: string;
  structureId?: string;
  ecole?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  permissions?: {
    viewers: string[];
    editors: string[];
  };
}

interface StructureMember {
  id: string;
  displayName: string;
  email: string;
  status?: string;
  structureId?: string;
  photoURL?: string;
}

interface HistoryEntry {
  id: string;
  date: string;
  action: string;
  details: string;
  type: 'mission' | 'profile' | 'document' | 'system';
  userId: string;
}

interface UserData {
  id: string;
  displayName: string;
  email: string;
  photoURL: string;
  ecole: string;
  firstName?: string;
  lastName?: string;
}

interface FirestoreUserData {
  displayName?: string;
  email?: string;
  photoURL?: string;
  status?: string;
  structureId?: string;
  ecole?: string;
  firstName?: string;
  lastName?: string;
}

type UserRole = {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'viewer' | 'editor';
};

interface MissionNote {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string;
  createdByName: string;
  createdByPhotoURL?: string;
  missionId: string;
  missionNumber: string;
}

interface GeneratedDocument {
  id: string;
  // Informations sur la mission
  missionId: string;
  missionNumber: string;
  missionTitle: string;
  structureId: string;
  
  // Informations sur le document
  documentType: DocumentType;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  version: number;  // Pour garder un historique des versions
  
  // Informations sur la création
  createdAt: Date;
  createdBy: string;
  createdByName?: string;
  createdByPhotoURL?: string;
  
  // Informations sur la dernière modification
  updatedAt: Date;
  updatedBy?: string;
  updatedByName?: string;
  
  // Informations sur l'étudiant (si applicable)
  applicationId?: string;
  applicationUserName?: string;
  applicationUserEmail?: string;
  
  // Statut du document
  status: 'draft' | 'final' | 'archived';
  isValid: boolean;  // Pour marquer si le document est toujours valide
  
  // Métadonnées supplémentaires
  tags: DocumentTag[];  // Pour faciliter la recherche et le filtrage
  notes?: string;   // Pour des commentaires ou des notes sur le document
  signedFileUrl?: string;
  signedFileName?: string;
  signedAt?: Date;
  originalDocumentId?: string;  // Pour lier les versions signées à leur document original
  expenseNoteId?: string;
  category?: 'contrats' | 'facturation' | 'autres';  // Catégorie pour les documents uploadés manuellement
  isUploaded?: boolean;  // Indique si le document a été uploadé manuellement
  
  // Informations spécifiques aux factures
  isInvoice?: boolean;  // Indique si le document est une facture
  invoiceSentDate?: Date;  // Date d'envoi de la facture
  invoiceDueDate?: Date;  // Date d'échéance de la facture
  invoiceAmount?: number;  // Montant de la facture (TTC + notes de frais)

  // Signature électronique (SES)
  isSigned?: boolean;
  locked?: boolean;
  signatureRequestId?: string;
  signatureStatus?: 'pending' | 'completed' | 'cancelled' | string;
  sealedStoragePath?: string;
}

interface EditableFieldProps {
  icon: React.ReactNode;
  label: string;
  field: string;
  initialValue: string;
  type?: 'text' | 'number' | 'date' | 'select';
  options?: { value: string; label: string }[];
  mission: Mission | null;
  onUpdate: (missionId: string, data: Partial<Mission>) => Promise<void>;
  onFieldChange: (field: keyof Mission, value: string | number) => void;
  isGlobalEditing?: boolean;
}

interface EditableFieldRef {
  getValue: () => string;
  setValue: (value: string) => void;
}

const EditableField = forwardRef<EditableFieldRef, EditableFieldProps>(({
  icon,
  label,
  field,
  initialValue,
  type = 'text',
  options = [],
  mission,
  onUpdate,
  onFieldChange,
  isGlobalEditing
}, ref) => {
  const [localValue, setLocalValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isGlobalEditing) {
      setLocalValue(initialValue);
    }
  }, [initialValue, isGlobalEditing]);

  useEffect(() => {
    setIsEditing(isGlobalEditing);
  }, [isGlobalEditing]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | { value: unknown }>) => {
    const newValue = event.target.value as string;
    setLocalValue(newValue);
    onFieldChange(field as keyof Mission, newValue);
  };

  useImperativeHandle(ref, () => ({
    getValue: () => localValue,
    setValue: (value: string) => setLocalValue(value)
  }));

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 2,
      mb: 2.5
    }}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        width: 40,
        height: 40,
        borderRadius: '10px',
        backgroundColor: '#f5f5f7',
        color: '#1d1d1f'
      }}>
        {icon}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ 
          fontSize: '0.875rem', 
          color: '#86868b',
          mb: 0.5,
          letterSpacing: '-0.01em',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
        }}>
          {label}
        </Typography>
        <TextField
          select={type === 'select'}
          fullWidth
          value={localValue}
          onChange={handleChange}
          disabled={!isEditing}
          type={type === 'select' ? undefined : type}
          variant="outlined"
          size="small"
          sx={{ 
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px',
              backgroundColor: isEditing ? '#f5f5f7' : 'transparent',
              '& fieldset': { 
                border: 'none' 
              },
              '&:hover fieldset': {
                borderColor: 'transparent'
              },
              '&.Mui-focused fieldset': {
                borderColor: '#007AFF',
                borderWidth: '1px'
              }
            }
          }}
        >
          {type === 'select' && options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Box>
    </Box>
  );
});

const CompactEditableField = ({ 
  label, 
  value, 
  onChange, 
  multiline = false,
  rows = 1,
  type = 'text'
}: { 
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  type?: 'text' | 'number';
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSave = () => {
    onChange(localValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalValue(value);
    setIsEditing(false);
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'flex-start',
      gap: 2,
      mb: 2
    }}>
      <Typography sx={{ 
        minWidth: '150px',
        color: '#86868b',
        fontSize: '0.875rem'
      }}>
        {label}
      </Typography>
      {isEditing ? (
        <Box sx={{ flex: 1, display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            variant="outlined"
            size="small"
            multiline={multiline}
            rows={rows}
            type={type}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
                backgroundColor: 'white',
                fontSize: '0.875rem'
              }
            }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton 
              size="small" 
              onClick={handleSave}
              sx={{ color: '#34C759' }}
            >
              <SaveIcon />
            </IconButton>
            <IconButton 
              size="small" 
              onClick={handleCancel}
              sx={{ color: '#FF3B30' }}
            >
              <CancelIcon />
            </IconButton>
          </Box>
        </Box>
      ) : (
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center',
          gap: 1
        }}>
          <Typography sx={{ 
            fontSize: '0.875rem',
            color: '#1d1d1f',
            whiteSpace: multiline ? 'pre-wrap' : 'normal'
          }}>
            {value || '-'}
          </Typography>
          <IconButton 
            size="small" 
            onClick={() => setIsEditing(true)}
            sx={{ 
              color: '#86868b',
              '&:hover': {
                color: '#1d1d1f'
              }
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
    </Box>
  );
};

const CompactEditableSection = ({ 
  title,
  fields,
  isEditing,
  onEdit,
  onSave,
  onCancel
}: { 
  title: string;
  fields: Array<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    multiline?: boolean;
    rows?: number;
    type?: 'text' | 'number';
    options?: { value: string; label: string }[];
  }>;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}) => {
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 2 
      }}>
        <Typography variant="h6" sx={{ fontWeight: 500, color: '#1d1d1f' }}>
          {title}
        </Typography>
        {!isEditing ? (
          <IconButton 
            size="small" 
            onClick={onEdit}
            sx={{ 
              color: '#86868b',
              '&:hover': {
                color: '#1d1d1f'
              }
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton 
              size="small" 
              onClick={onSave}
              sx={{ color: '#34C759' }}
            >
              <SaveIcon />
            </IconButton>
            <IconButton 
              size="small" 
              onClick={onCancel}
              sx={{ color: '#FF3B30' }}
            >
              <CancelIcon />
            </IconButton>
          </Box>
        )}
      </Box>
      
      <Box sx={{ 
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: 2,
        backgroundColor: '#f5f5f7',
        p: 2,
        borderRadius: '12px'
      }}>
        {fields.map((field, index) => (
          <Box key={index}>
            <Typography sx={{ 
              fontSize: '0.875rem',
              color: '#86868b',
              mb: 0.5
            }}>
              {field.label}
            </Typography>
            {isEditing ? (
              field.type === 'select' ? (
                <TextField
                  select
                  fullWidth
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      backgroundColor: 'white',
                      fontSize: '0.875rem'
                    }
                  }}
                >
                  {(field.options || []).map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <TextField
                  fullWidth
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  variant="outlined"
                  size="small"
                  multiline={field.multiline}
                  rows={field.rows}
                  type={field.type}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                      backgroundColor: 'white',
                      fontSize: '0.875rem'
                    }
                  }}
                />
              )
            ) : (
              <Typography sx={{ 
                fontSize: '0.875rem',
                color: '#1d1d1f',
                whiteSpace: field.multiline ? 'pre-wrap' : 'normal'
              }}>
                {field.type === 'select'
                  ? (field.options?.find(opt => opt.value === field.value)?.label || '-')
                  : (field.value || '-')}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const MissionEtape: React.FC<{ etape: MissionEtape; onEtapeChange?: (newEtape: MissionEtape) => void; isEditing?: boolean; isArchived?: boolean }> = ({ etape, onEtapeChange, isEditing, isArchived }) => {
  // Si la mission est archivée, afficher uniquement "Archivé"
  if (isArchived) {
    return (
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: 'grey.400',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1,
              }}
            >
              <Typography sx={{ fontSize: '0.875rem' }}>A</Typography>
            </Box>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontWeight: 'bold',
              }}
            >
              Archivé
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  const etapes: MissionEtape[] = ['Négociation', 'Recrutement', 'Date de mission', 'Facturation', 'Audit'];
  const currentIndex = etapes.indexOf(etape);

  const handleEtapeClick = (newEtape: MissionEtape) => {
    if (isEditing && onEtapeChange) {
      onEtapeChange(newEtape);
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {etapes.map((e, index) => (
          <Box
            key={e}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: 1,
              position: 'relative',
              cursor: isEditing ? 'pointer' : 'default',
              '&:hover': isEditing ? {
                opacity: 0.8
              } : {}
            }}
            onClick={() => handleEtapeClick(e)}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: index <= currentIndex ? 'primary.main' : 'grey.300',
                color: index <= currentIndex ? 'white' : 'text.secondary',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1,
                zIndex: 1,
              }}
            >
              {index + 1}
            </Box>
            <Typography
              variant="body2"
              sx={{
                color: index <= currentIndex ? 'primary.main' : 'text.secondary',
                fontWeight: index === currentIndex ? 'bold' : 'normal',
              }}
            >
              {e}
            </Typography>
            {index < etapes.length - 1 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 20,
                  left: '50%',
                  width: '100%',
                  height: 2,
                  backgroundColor: index < currentIndex ? 'primary.main' : 'grey.300',
                  zIndex: 0,
                }}
              />
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

import { trackUserActivity } from '../../services/userActivityService';

const MissionDetails: React.FC = () => {
  const workspaceConfig = JOBSERVICE_WORKSPACE;
  void workspaceConfig;
  const { missionId } = useParams<{ missionId: string }>();
  const navigate = useNavigate();
  const { currentUser, userData } = useAuth();
  const { canRead, canWrite, loading: permissionLoading } = usePermission('mission');
  const [mission, setMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMission, setEditedMission] = useState<Mission | null>(null);
  const [companies, setCompanies] = useState<Array<{id: string; name: string; nSiret?: string; siret?: string}>>([]);
  const [descriptions, setDescriptions] = useState<string[]>([]);
  const [notes, setNotes] = useState<MissionNote[]>([]);
  const [generatedDocuments, setGeneratedDocuments] = useState<GeneratedDocument[]>([]);
  const [newNote, setNewNote] = useState<string>('');
  const [loadingNotes, setLoadingNotes] = useState<boolean>(false);
  const filter = createFilterOptions<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fieldsRef = useRef<{ [key: string]: any }>({});
  const [structureMembers, setStructureMembers] = useState<StructureMember[]>([]);
  const [priceHT, setPriceHT] = useState<number>(0);
  const [totalHT, setTotalHT] = useState<number>(0);
  const [totalTTC, setTotalTTC] = useState<number>(0);
  const [expenses, setExpenses] = useState<MissionExpense[]>([]);
  const [generatingDocType, setGeneratingDocType] = useState<DocumentType | null>(null);
  const assignedTemplateCacheRef = useRef(new Map<string, AssignedTemplateData>());
  const [downloadProgress, setDownloadProgress] = useState<{ progress: number; message: string } | null>(null);
  const [isPriceSaved, setIsPriceSaved] = useState<boolean>(true);
  /** Snapshot des dépenses après dernier enregistrement (pour Annuler). */
  const [savedExpenses, setSavedExpenses] = useState<MissionExpense[]>([]);
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [isEditingAnnouncement, setIsEditingAnnouncement] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [expandedApplication, setExpandedApplication] = useState<string | null>(null);
  const [openAddCandidateDialog, setOpenAddCandidateDialog] = useState(false);
  const [pcButtonText, setPcButtonText] = useState('Créer une proposition commerciale');
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const [userHistory, setUserHistory] = useState<HistoryEntry[]>([]);
  const [missionUsers, setMissionUsers] = useState<MissionUser[]>([]);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<MissionDetailTabId>('overview');
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [overflowAnchor, setOverflowAnchor] = useState<HTMLElement | null>(null);

  const tabCounts = useMissionDetailTabs({
    applications,
    documents: generatedDocuments,
    notes,
  });
  const [selectedRole, setSelectedRole] = useState<'viewer' | 'editor'>('viewer');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  // Ajout des nouveaux états après les états existants
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editedNoteContent, setEditedNoteContent] = useState<string>('');
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });
  // Ajouter ce state pour le dialogue de confirmation
  const [documentConfirmDialog, setDocumentConfirmDialog] = useState<{
    open: boolean;
    documentType: DocumentType;
    existingDoc: GeneratedDocument | null;
    application?: Application;
    action?: 'cancel' | 'replace' | 'keep';
  }>({
    open: false,
    documentType: 'proposition_commerciale',
    existingDoc: null
  });
  // Ajouter ces states pour gérer les différents dialogues et menus
  const [documentMenuAnchor, setDocumentMenuAnchor] = useState<{
    element: null | HTMLElement;
    document: GeneratedDocument | null;
  }>({
    element: null,
    document: null
  });

  const [documentDialogs, setDocumentDialogs] = useState<{
    rename: boolean;
    info: boolean;
    signedVersion: boolean;
    sendSignature: boolean;
    selectedDocument: GeneratedDocument | null;
    newFileName: string;
  }>({
    rename: false,
    info: false,
    signedVersion: false,
    sendSignature: false,
    selectedDocument: null,
    newFileName: ''
  });

  const [openNewCompanyDialog, setOpenNewCompanyDialog] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');

  // Ajouter après les autres états
  const [workingHoursDialog, setWorkingHoursDialog] = useState<{
    open: boolean;
    application: Application | null;
  }>({
    open: false,
    application: null
  });

  const [newWorkingHour, setNewWorkingHour] = useState<{
    date: string;
    startTime: string;
    endTime: string;
  }>({
    date: '',
    startTime: '',
    endTime: ''
  });

  // Ajoutez cet état au début du composant
  const [unsavedChanges, setUnsavedChanges] = useState<{ [key: string]: boolean }>({});
  const [savingWorkingHours, setSavingWorkingHours] = useState<{ [key: string]: boolean }>({});
  const [loadingWorkingHoursDialog, setLoadingWorkingHoursDialog] = useState(false);
  const [applicationsLoaded, setApplicationsLoaded] = useState(false);
  
  // États pour les templates de proposition commerciale
  const [quoteTemplates, setQuoteTemplates] = useState<Array<{ id: string; name: string; structureId: string }>>([]);
  const [selectedQuoteTemplate, setSelectedQuoteTemplate] = useState<string>('');



  // Ajouter cet état avec les autres états
  const [expenseNotes, setExpenseNotes] = useState<ExpenseNote[]>([]);

  // Ajouter cet état avec les autres états
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [openPreview, setOpenPreview] = useState(false);

  const [expenseMenuAnchor, setExpenseMenuAnchor] = useState<{
    element: null | HTMLElement;
    note: ExpenseNote | null;
  }>({
    element: null,
    note: null
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);

  const [openAddExpenseDialog, setOpenAddExpenseDialog] = useState(false);
  const [newExpense, setNewExpense] = useState<{
    userId: string;
    description: string;
    amount: number;
    date: string;
    attachmentUrl: string;
  }>({
    userId: '',
    description: '',
    amount: 0,
    date: '',
    attachmentUrl: ''
  });

  const [missionTypes, setMissionTypes] = useState<Array<{id: string; title: string}>>([]);

  const [openNewMissionTypeDialog, setOpenNewMissionTypeDialog] = useState(false);
  const [newMissionType, setNewMissionType] = useState({
    title: '',
    studentProfile: '',
    courseApplication: '',
    missionLearning: ''
  });

  // États pour gérer date et heure séparément pour startDate et endDate
  const [startDateDate, setStartDateDate] = useState<string>('');
  const [startDateTime, setStartDateTime] = useState<string>('');
  const [endDateDate, setEndDateDate] = useState<string>('');
  const [endDateTime, setEndDateTime] = useState<string>('');

  // État pour le dialog d'upload de document avec drag & drop
  const [uploadDialog, setUploadDialog] = useState<{
    open: boolean;
    category: 'contrats' | 'facturation' | 'autres';
    file: File | null;
    isDragging: boolean;
    isInvoice: boolean;
    invoiceSentDate: string;
    invoiceDueDate: string;
    invoiceAmount: string;
  }>({
    open: false,
    category: 'autres',
    file: null,
    isDragging: false,
    isInvoice: false,
    invoiceSentDate: new Date().toISOString().split('T')[0],
    invoiceDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    invoiceAmount: '0.00'
  });

  // État pour la popup de données manquantes
  const [missingDataDialog, setMissingDataDialog] = useState<{
    open: boolean;
    detecting?: boolean;
    missingData: Array<{
      tag: string;
      label: string;
      category: string;
      value?: string;
      isEditing?: boolean;
    }>;
    documentType: DocumentType;
    application?: Application;
    expenseNote?: ExpenseNote;
  }>({
    open: false,
    missingData: [],
    documentType: 'proposition_commerciale'
  });

  // État pour les données temporaires de la popup
  const [tempData, setTempData] = useState<{
    [key: string]: string;
  }>({});

  const [avenantDialog, setAvenantDialog] = useState<{
    open: boolean;
    step: 'setup' | 'review';
    selectedApplicationId: string | null;
    templateTags: Array<{ tag: string; label: string; category: string; value: string; isMissing: boolean }>;
    checkingMissing: boolean;
    templateName: string | null;
    templateId: string | null;
    templateOptions: Array<{ id: string; name: string }>;
    templateLoading: boolean;
    templateSaving: boolean;
    templateMissing: boolean;
  }>({
    open: false,
    step: 'setup',
    selectedApplicationId: null,
    templateTags: [],
    checkingMissing: false,
    templateName: null,
    templateId: null,
    templateOptions: [],
    templateLoading: false,
    templateSaving: false,
    templateMissing: false,
  });

  const [lmDialogOpen, setLmDialogOpen] = useState(false);
  const [manualGeneratorOpen, setManualGeneratorOpen] = useState(false);

  // États pour le système de tagging
  const [taggedUsers, setTaggedUsers] = useState<Array<{
    id: string;
    displayName: string;
    email: string;
    photoURL?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  }>>([]);
  const [availableUsersForTagging, setAvailableUsersForTagging] = useState<Array<{
    id: string;
    displayName: string;
    email: string;
    photoURL?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  }>>([]);

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Fonction pour vérifier si l'utilisateur actuel peut gérer les permissions
  const canManagePermissions = useCallback(() => {
    if (!currentUser || !mission) return false;
    if (userData?.status === 'superadmin' || userData?.status === 'admin') return true;
    return mission.createdBy === currentUser.uid;
  }, [currentUser, mission, userData]);

  // Fonction pour vérifier si l'utilisateur actuel peut supprimer des documents
  const canDeleteDocument = useCallback(() => {
    if (!currentUser || !mission) return false;
    // Ne pas permettre la suppression si la mission est archivée
    if (mission.isArchived) return false;
    // Permettre aux superadmins et admins de supprimer
    return userData?.status === 'superadmin' || userData?.status === 'admin';
  }, [currentUser, mission, userData]);

  // Fonction pour charger les utilisateurs ayant accès à la mission
  const fetchMissionUsers = useCallback(async () => {
    if (!mission?.permissions) return;
    
    try {
      const userPromises = [...mission.permissions.viewers.map(async (id) => {
        const userDoc = await getDoc(doc(db, 'users', id));
        if (userDoc.exists()) {
          const userData = userDoc.data() as FirestoreUserData;
          const user: UserRole = {
            id: userDoc.id,
            displayName: userData.displayName || '',
            email: userData.email || '',
            photoURL: userData.photoURL,
            role: 'viewer'
          };
          return user;
        }
        return null;
      }), ...mission.permissions.editors.map(async (id) => {
        const userDoc = await getDoc(doc(db, 'users', id));
        if (userDoc.exists()) {
          const userData = userDoc.data() as FirestoreUserData;
          const user: UserRole = {
            id: userDoc.id,
            displayName: userData.displayName || '',
            email: userData.email || '',
            photoURL: userData.photoURL,
            role: 'editor'
          };
          return user;
        }
        return null;
      })];

      let users = (await Promise.all(userPromises)).filter((user): user is UserRole => user !== null);
      users = await decryptUsersList(users as any);
      setMissionUsers(users);
    } catch (error) {
      console.error("Erreur lors du chargement des utilisateurs de la mission:", error);
    }
  }, [mission?.permissions]);

  // Fonction pour ajouter un utilisateur aux permissions
  const handleAddUserPermission = async () => {
    if (!selectedUserId || !mission || !selectedRole) return;

    try {
      // Vérifier si l'utilisateur n'est pas déjà dans les permissions
      const isAlreadyViewer = mission.permissions?.viewers.includes(selectedUserId);
      const isAlreadyEditor = mission.permissions?.editors.includes(selectedUserId);

      if (isAlreadyViewer || isAlreadyEditor) {
        enqueueSnackbar("Cet utilisateur a déjà un accès à la mission", { variant: 'warning' });
        return;
      }

      const updatedPermissions = {
        viewers: [...(mission.permissions?.viewers || [])],
        editors: [...(mission.permissions?.editors || [])]
      };

      if (selectedRole === 'viewer') {
        updatedPermissions.viewers.push(selectedUserId);
      } else {
        updatedPermissions.editors.push(selectedUserId);
      }

      // Mettre à jour Firestore
      await updateDoc(doc(db, 'missions', mission.id), {
        permissions: updatedPermissions
      });

      // Récupérer les informations de l'utilisateur ajouté
      const userDoc = await getDoc(doc(db, 'users', selectedUserId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const decrypted = await decryptUserDisplayData(selectedUserId, userData);
        const newUser: UserRole = {
          id: selectedUserId,
          displayName: decrypted.displayName || userData.displayName || '',
          email: userData.email || '',
          photoURL: userData.photoURL,
          role: selectedRole
        };

        // Mettre à jour l'état local
        setMission(prev => {
          if (!prev) return null;
          return {
            ...prev,
            permissions: updatedPermissions
          };
        });

        // Ajouter le nouvel utilisateur à la liste
        setMissionUsers(prev => [...prev, newUser]);
      }

      // Réinitialiser les sélections
      setSelectedUserId(null);
      setSelectedRole('viewer');
      
      enqueueSnackbar("Accès ajouté avec succès", { variant: 'success' });
    } catch (error) {
      console.error("Erreur lors de l'ajout des permissions:", error);
      enqueueSnackbar("Erreur lors de l'ajout de l'accès", { variant: 'error' });
    }
  };

  // Fonction pour retirer un utilisateur des permissions
  const handleRemoveUserPermission = async (userId: string) => {
    if (!mission) return;

    try {
      const updatedPermissions = {
        viewers: (mission.permissions?.viewers || []).filter(id => id !== userId),
        editors: (mission.permissions?.editors || []).filter(id => id !== userId)
      };

      await updateDoc(doc(db, 'missions', mission.id), {
        permissions: updatedPermissions
      });

      // Mettre à jour l'état local
      setMission(prev => {
        if (!prev) return null;
        return {
          ...prev,
          permissions: updatedPermissions
        };
      });

      // Mettre à jour la liste des utilisateurs
      setMissionUsers(prev => prev.filter(user => user.id !== userId));
      
      enqueueSnackbar("Accès supprimé avec succès", { variant: 'success' });
    } catch (error) {
      console.error("Erreur lors de la suppression des permissions:", error);
      enqueueSnackbar("Erreur lors de la suppression de l'accès", { variant: 'error' });
    }
  };

  // Effet pour charger les utilisateurs de la mission
  useEffect(() => {
    if (mission?.permissions) {
      fetchMissionUsers();
    }
  }, [mission?.permissions, fetchMissionUsers]);

  // Fonction pour vérifier automatiquement si la date de mission est atteinte
  const checkAndUpdateMissionDate = async (missionData: Mission) => {
    if (!missionData.startDate) return;

    try {
      const startDate = new Date(missionData.startDate);
      const today = new Date();
      
      // Réinitialiser les heures pour comparer uniquement les dates
      today.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);
      
      // Si la date de début est aujourd'hui ou passée, et que l'étape est "Recrutement" ou antérieure
      if (startDate <= today) {
        const etapes: MissionEtape[] = ['Négociation', 'Recrutement', 'Date de mission', 'Facturation', 'Audit'];
        const currentIndex = etapes.indexOf(missionData.etape);
        const dateDeMissionIndex = etapes.indexOf('Date de mission');
        
        // Si l'étape actuelle est avant "Date de mission", passer à "Date de mission"
        if (currentIndex < dateDeMissionIndex) {
          const missionRef = doc(db, 'missions', missionData.id);
          await updateDoc(missionRef, {
            etape: 'Date de mission',
            updatedAt: new Date()
          });
          setMission(prev => prev ? { ...prev, etape: 'Date de mission' } : null);
          setEditedMission(prev => prev ? { ...prev, etape: 'Date de mission' } : null);
        }
      }
    } catch (error) {
      console.error('Erreur lors de la vérification de la date de mission:', error);
    }
  };

  useEffect(() => {
    const fetchMissionDetails = async () => {
      if (!currentUser) {
        setError("Veuillez vous connecter pour accéder à cette page");
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Utiliser userData Auth (évite getDoc users redondant) + mission en parallèle
        const authUser = userData;
        if (!authUser) {
          throw new Error("Données utilisateur non trouvées");
        }

        const userStatus = authUser.status || 'user';
        const userStructureId = authUser.structureId;
        const isEntreprise = userStatus === 'entreprise';

        // Les entreprises ne peuvent pas accéder à la page MissionDetails
        if (isEntreprise) {
          setError("Les entreprises ne peuvent pas accéder à cette page.");
          setLoading(false);
          setTimeout(() => {
            navigate('/app/billing-page');
          }, 2000);
          return;
        }

        if (!userStructureId && userStatus !== 'superadmin') {
          throw new Error("Aucune structure associée à l'utilisateur");
        }

        if (!missionId) {
          throw new Error("ID de mission manquant");
        }

        const missionDoc = await getDoc(doc(db, 'missions', missionId));
        
        if (!missionDoc.exists()) {
          throw new Error("Mission non trouvée");
        }

        const missionData = missionDoc.data();
        
        if (userStatus === 'superadmin') {
          // Superadmin a accès à tout
        } else if (missionData.structureId !== userStructureId) {
          throw new Error("Mission non trouvée ou accès non autorisé");
        }

        const typedMissionData = missionData as {
          structureId?: string;
          contactId?: string;
          chargeId?: string;
          etape?: MissionEtape;
          priceHT?: number;
          hours?: number;
          isPublished?: boolean;
          [key: string]: any;
        };
        
        if (!typedMissionData.structureId && userStructureId) {
          await updateDoc(doc(db, 'missions', missionDoc.id), {
            structureId: userStructureId,
            updatedAt: new Date()
          });
          typedMissionData.structureId = userStructureId;
        }

        // Contact + charge en parallèle
        const [contactSnap, chargeSnap] = await Promise.all([
          typedMissionData.contactId
            ? getDoc(doc(db, 'contacts', typedMissionData.contactId))
            : Promise.resolve(null),
          typedMissionData.chargeId
            ? getDoc(doc(db, 'users', typedMissionData.chargeId))
            : Promise.resolve(null),
        ]);

        let contact = null;
        if (contactSnap?.exists()) {
          const contactData = contactSnap.data();
          contact = {
            id: contactSnap.id,
            firstName: contactData.firstName,
            lastName: contactData.lastName,
            email: contactData.email,
            phone: contactData.phone,
            position: contactData.position,
            createdAt: contactData.createdAt?.toDate() || new Date()
          };
        }

        const mission = {
          id: missionDoc.id,
          ...typedMissionData,
          contact,
          etape: typedMissionData.etape || 'Négociation',
          structureId: typedMissionData.structureId || userStructureId,
          missionTypeId: typedMissionData.missionTypeId || null,
          updatedAt: toDateFromFirestore(typedMissionData.updatedAt),
        } as Mission;

        if (mission.chargeId && chargeSnap?.exists()) {
          try {
            const chargeData = chargeSnap.data();
            const decryptedChargeName = await getDecryptedUserDisplayName(mission.chargeId, {
              displayName: isEncryptedField(mission.chargeName) ? undefined : mission.chargeName || chargeData.displayName,
              firstName: chargeData.firstName,
              lastName: chargeData.lastName,
            });
            if (decryptedChargeName && decryptedChargeName !== 'Inconnu') {
              mission.chargeName = decryptedChargeName;
            }
            if (!mission.mandat && chargeData.mandat) {
              mission.mandat = chargeData.mandat;
              await updateDoc(doc(db, 'missions', mission.id), {
                mandat: chargeData.mandat,
                ...(decryptedChargeName && decryptedChargeName !== 'Inconnu'
                  ? { chargeName: decryptedChargeName }
                  : {}),
              });
            } else if (decryptedChargeName && decryptedChargeName !== 'Inconnu' && isEncryptedField(typedMissionData.chargeName)) {
              // Soft cleanup : remplacer ENC: dénormalisé par le nom clair
              await updateDoc(doc(db, 'missions', mission.id), { chargeName: decryptedChargeName });
            }
          } catch (error) {
            console.error('Erreur lors de la récupération du chargé de mission:', error);
          }
        }

        setMission(mission);
        setEditedMission({ ...mission });
        setIsPublished(mission.isPublished || false);

        // Vérifier automatiquement si la date de mission est atteinte
        await checkAndUpdateMissionDate(mission);

        // Initialiser les dates et heures séparément
        if (mission.startDate) {
          const startDateObj = new Date(mission.startDate);
          setStartDateDate(startDateObj.toISOString().split('T')[0]);
          setStartDateTime(startDateObj.toTimeString().slice(0, 5)); // HH:MM
        } else {
          setStartDateDate('');
          setStartDateTime('');
        }

        if (mission.endDate) {
          const endDateObj = new Date(mission.endDate);
          setEndDateDate(endDateObj.toISOString().split('T')[0]);
          setEndDateTime(endDateObj.toTimeString().slice(0, 5)); // HH:MM
        } else {
          setEndDateDate('');
          setEndDateTime('');
        }

        setPriceHT(typedMissionData.priceHT ?? 0);

        // Charger les dépenses depuis la mission (nomdepense1, tvadepense1, totaldepense1, etc.)
        const loadedExpenses: MissionExpense[] = [];
        let index = 1;
        while (true) {
          const nameKey = `nomdepense${index}`;
          const tvaKey = `tvadepense${index}`;
          const totalKey = `totaldepense${index}`;

          if (typedMissionData[nameKey] && typedMissionData[totalKey]) {
            loadedExpenses.push({
              id: `expense-${mission.id}-${index}`,
              name: typedMissionData[nameKey] || '',
              tva: typedMissionData[tvaKey] || 20,
              priceHT: typedMissionData[totalKey] || 0,
              isSaved: true,
              savedIndex: index,
            });
            index++;
          } else {
            break;
          }
        }
        setExpenses(loadedExpenses);
        setSavedExpenses(loadedExpenses.map((e) => ({ ...e })));

        const { totalHT, totalTTC } = calculatePrices(
          typedMissionData.priceHT ?? 0,
          typedMissionData.hours,
          loadedExpenses
        );
        setTotalHT(totalHT);
        setTotalTTC(totalTTC);
        setIsPriceSaved(true);

      } catch (err) {
        console.error('Erreur détaillée:', err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Une erreur inattendue est survenue");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMissionDetails();
  }, [currentUser, missionId, userData, navigate]);

  // Mettre à jour le texte du bouton PC quand la mission est chargée
  useEffect(() => {
    const updatePcButtonText = async () => {
      if (mission?.structureId) {
        try {
          const assignedTemplate = await getAssignedTemplate('proposition_commerciale');
          if (assignedTemplate) {
            if (assignedTemplate.generationType === 'template') {
              setPcButtonText('Télécharger Template PDF');
            } else {
              setPcButtonText('Créer avec Éditeur');
            }
          } else {
            setPcButtonText('Créer une proposition commerciale');
          }
        } catch (error) {
          setPcButtonText('Créer une proposition commerciale');
        }
      }
    };
    
    updatePcButtonText();
  }, [mission?.structureId]);

  useEffect(() => {
    const fetchCompanies = async () => {
      if (!currentUser) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        const userStatus = userData?.status || 'user';
        const userStructureId = userData?.structureId;
        const isEntreprise = userStatus === 'entreprise';

        const companiesRef = collection(db, 'companies');
        let companiesQuery;

        if (userStatus === 'superadmin') {
          companiesQuery = query(companiesRef);
        } else if (isEntreprise) {
          // Les entreprises n'ont pas besoin de charger la liste des entreprises
          setCompanies([]);
          return;
        } else if (userStructureId) {
          companiesQuery = query(
            companiesRef,
            where('structureId', '==', userStructureId)
          );
        } else {
          // Pas de structureId et pas une entreprise, on ne charge rien
          setCompanies([]);
          return;
        }

        const snapshot = await getDocs(companiesQuery);
        let companiesList = snapshot.docs.map(docSnap => {
          const data = docSnap.data() as FirestoreCompanyData;
          return {
            id: docSnap.id,
            name: data.name,
            nSiret: data.nSiret,
            siret: data.siret
          } as { id: string; name: string; nSiret?: string; siret?: string };
        });

        const isEncrypted = (v: any) => typeof v === 'string' && v.startsWith('ENC:');
        const needsDecrypt = companiesList.some(c => isEncrypted(c.name) || isEncrypted(c.nSiret) || isEncrypted((c as any).siret));
        if (needsDecrypt) {
          const decryptCompanyDataForStructure = httpsCallable(getAppFunctions(), 'decryptCompanyDataForStructure');
          companiesList = await Promise.all(companiesList.map(async (company) => {
            const data = snapshot.docs.find(d => d.id === company.id)?.data() as FirestoreCompanyData | undefined;
            if (!data || !(isEncrypted(data.name) || isEncrypted(data.nSiret) || isEncrypted(data.siret))) return company;
            try {
              const result = await decryptCompanyDataForStructure({ companyId: company.id });
              const dec = (result.data as any)?.decryptedData;
              if (!dec) return company;
              return {
                ...company,
                name: (dec.name && !isEncrypted(dec.name) ? dec.name : company.name) ?? company.name,
                nSiret: (dec.nSiret != null && !isEncrypted(dec.nSiret) ? String(dec.nSiret) : dec.siret && !isEncrypted(dec.siret) ? String(dec.siret) : company.nSiret) ?? company.nSiret
              };
            } catch (e) {
              console.warn('Décryptage entreprise ignoré:', company.id, e);
              return company;
            }
          }));
        }
        setCompanies(companiesList);
      } catch (error) {
        console.error("Erreur lors du chargement des entreprises:", error);
      }
    };

    fetchCompanies();
  }, [currentUser]);

  // Si companyId est correct mais company="Organisation inconnue" (ex. conversion ambassadeur), resynchroniser le nom
  useEffect(() => {
    if (!mission?.id || !mission.companyId || companies.length === 0) return;
    const selected = companies.find((c) => c.id === mission.companyId);
    if (!selected?.name) return;
    const stored = (mission.company || '').trim();
    if (stored && stored !== 'Organisation inconnue') return;

    setMission((prev) => (prev ? { ...prev, company: selected.name } : prev));
    setEditedMission((prev) => (prev ? { ...prev, company: selected.name } : prev));
    void updateDoc(doc(db, 'missions', mission.id), {
      company: selected.name,
      updatedAt: new Date(),
    }).catch((err) => {
      console.warn('Resync nom entreprise ignoré:', err);
    });
  }, [mission?.id, mission?.companyId, mission?.company, companies]);

  useEffect(() => {
    const fetchDescriptions = async () => {
      if (!mission?.structureId) return;

      try {
        const descriptionsRef = collection(db, 'missionTypes');
        const descriptionsQuery = query(
          descriptionsRef,
          where('structureId', '==', mission.structureId)
        );

        const snapshot = await getDocs(descriptionsQuery);
        const descriptionsList = snapshot.docs.map(doc => doc.data().title);
        setDescriptions(descriptionsList);
      } catch (error) {
        console.error("Erreur lors du chargement des descriptions:", error);
      }
    };

    fetchDescriptions();
  }, [mission?.structureId]);

  useEffect(() => {
    const fetchStructureMembers = async () => {
      if (!mission?.structureId) return;

      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('structureId', '==', mission.structureId));
        const snapshot = await getDocs(q);
        let membersList = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            displayName: data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || '',
            email: data.email || '',
            status: data.status,
            structureId: data.structureId,
            photoURL: data.photoURL || '',
            firstName: data.firstName || '',
            lastName: data.lastName || ''
          } as StructureMember & { firstName?: string; lastName?: string };
        });

        const isEncrypted = (v: any) => typeof v === 'string' && v.startsWith('ENC:');
        const needsDecrypt = membersList.some((m: any) =>
          isEncrypted(m.displayName) || isEncrypted(m.firstName) || isEncrypted(m.lastName)
        );
        setStructureMembers(membersList);

        // Préparer les utilisateurs pour le tagging (mise à jour initiale)
        const taggingUsersInitial = membersList.map((m: any) => ({
          id: m.id,
          displayName: m.displayName || '',
          email: m.email || '',
          photoURL: m.photoURL || '',
          firstName: m.firstName || '',
          lastName: m.lastName || '',
          role: m.status || 'membre'
        }));
        setAvailableUsersForTagging(taggingUsersInitial);

        if (needsDecrypt) {
          await decryptUsersListProgressive(membersList, (decrypted) => {
            setStructureMembers(decrypted);
            setAvailableUsersForTagging(
              decrypted.map((m: any) => ({
                id: m.id,
                displayName: m.displayName || '',
                email: m.email || '',
                photoURL: m.photoURL || '',
                firstName: m.firstName || '',
                lastName: m.lastName || '',
                role: m.status || 'membre'
              }))
            );
          });
        }
      } catch (error) {
        console.error("Erreur lors du chargement des membres:", error);
      }
    };

    fetchStructureMembers();
  }, [mission?.structureId]);

  // Mettre à jour chargeName avec la valeur décryptée lorsque structureMembers sont chargés
  useEffect(() => {
    if (!mission?.chargeId) return;

    const syncChargeName = async () => {
      const member = structureMembers.find((m) => m.id === mission.chargeId);
      if (member?.displayName && !isEncryptedField(member.displayName)) {
        if (mission.chargeName !== member.displayName) {
          setMission((prev) => (prev ? { ...prev, chargeName: member.displayName } : null));
          setEditedMission((prev) => (prev ? { ...prev, chargeName: member.displayName } : null));
        }
        return;
      }
      if (isEncryptedField(mission.chargeName)) {
        const decrypted = await getDecryptedUserDisplayName(mission.chargeId, {
          displayName: mission.chargeName,
        });
        if (decrypted && decrypted !== 'Inconnu' && decrypted !== mission.chargeName) {
          setMission((prev) => (prev ? { ...prev, chargeName: decrypted } : null));
          setEditedMission((prev) => (prev ? { ...prev, chargeName: decrypted } : null));
        }
      }
    };

    void syncChargeName();
  }, [mission?.chargeId, mission?.chargeName, structureMembers]);

  useEffect(() => {
    const fetchApplications = async () => {
      if (!mission?.id || applicationsLoaded) return;

      try {
        setLoadingApplications(true);
        const applicationsRef = collection(db, 'applications');
        const q = query(applicationsRef, where('missionId', '==', mission.id));
        const snapshot = await getDocs(q);
        
        // Récupérer tous les IDs des applications
        const applicationIds = snapshot.docs.map(doc => doc.id);
        const workingHoursMap = await fetchWorkingHoursForApplications(applicationIds);

        // Construire la liste des applications avec leurs horaires
        const applicationsList = await Promise.all(snapshot.docs.map(async (docSnapshot) => {
          const applicationData = docSnapshot.data();
          const userData = await getDoc(doc(db, 'users', applicationData.userId));
          const userDocData = userData.data() as Record<string, unknown> | undefined;
          const userDisplayName = await getDecryptedUserDisplayName(applicationData.userId, userDocData || null);
          const rawPhone = typeof userDocData?.phone === 'string' ? userDocData.phone : '';
          const rawStudentId = typeof userDocData?.studentId === 'string' ? userDocData.studentId : '';
          
          // Fonction helper pour convertir les dates Firestore
          const convertFirestoreDate = (dateValue: any): Date => {
            if (!dateValue) return new Date();
            if (dateValue.toDate && typeof dateValue.toDate === 'function') {
              return dateValue.toDate();
            }
            if (dateValue instanceof Date) {
              return dateValue;
            }
            return new Date(dateValue);
          };

          return {
            id: docSnapshot.id,
            userId: applicationData.userId,
            missionId: applicationData.missionId,
            status: applicationData.status,
            createdAt: convertFirestoreDate(applicationData.createdAt),
            updatedAt: convertFirestoreDate(applicationData.updatedAt),
            userEmail: applicationData.userEmail,
            userPhotoURL: (userDocData?.photoURL as string | undefined) || null,
            userDisplayName: userDisplayName === 'Inconnu' ? '' : userDisplayName,
            userPhone: rawPhone,
            userStudentId: rawStudentId,
            cvUrl: applicationData.cvUrl,
            cvUpdatedAt: applicationData.cvUpdatedAt ? convertFirestoreDate(applicationData.cvUpdatedAt) : null,
            motivationLetter: applicationData.motivationLetter,
            submittedAt: convertFirestoreDate(applicationData.submittedAt),
            isDossierValidated: userDocData?.dossierValidated || false,
            workingHours: workingHoursMap.get(docSnapshot.id) || [],
            documentTagOverrides: (applicationData.documentTagOverrides as Record<string, string> | undefined) ?? {},
          } as Application;
        }));

        setApplications(applicationsList);
        setApplicationsLoaded(true);
      } catch (error) {
        console.error("Erreur lors du chargement des candidatures:", error);
      } finally {
        setLoadingApplications(false);
      }
    };

    fetchApplications();
  }, [mission?.id, applicationsLoaded]);

  useEffect(() => {
    const applicationId = workingHoursDialog.application?.id;
    if (!workingHoursDialog.open || !applicationId) return;

    let cancelled = false;
    const reloadWorkingHours = async () => {
      setLoadingWorkingHoursDialog(true);
      try {
        const hoursMap = await fetchWorkingHoursForApplications([applicationId]);
        const hours = hoursMap.get(applicationId) || [];
        if (cancelled) return;

        setApplications((prev) =>
          prev.map((app) => (app.id === applicationId ? { ...app, workingHours: hours } : app))
        );
        setWorkingHoursDialog((prev) =>
          prev.application?.id === applicationId
            ? { ...prev, application: { ...prev.application, workingHours: hours } }
            : prev
        );
      } catch (error) {
        console.error('Erreur lors du chargement des horaires:', error);
      } finally {
        if (!cancelled) setLoadingWorkingHoursDialog(false);
      }
    };

    void reloadWorkingHours();
    return () => {
      cancelled = true;
    };
  }, [workingHoursDialog.open, workingHoursDialog.application?.id]);

  useEffect(() => {
    const fetchNotes = async () => {
      if (!mission?.id) return;

      try {
        setLoadingNotes(true);
        const notesRef = collection(db, 'notes');
        const q = query(
          notesRef, 
          where('missionId', '==', mission.id)
        );
        
        const snapshot = await getDocs(q);
        const notesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate()
        })) as MissionNote[];

        // Trier par date de création (plus récent en premier)
        notesData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        setNotes(notesData);
      } catch (error) {
        console.error('Erreur lors du chargement des notes:', error);
      } finally {
        setLoadingNotes(false);
      }
    };

    fetchNotes();
  }, [mission?.id]);

  useEffect(() => {
    const fetchExpenseNotes = async () => {
      if (!mission?.id) return;

      try {
        const expensesRef = collection(db, 'expenseNotes');
        const q = query(expensesRef, where('missionId', '==', mission.id));
        const snapshot = await getDocs(q);
        
        const notes = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date.toDate(),
          createdAt: doc.data().createdAt.toDate(),
          updatedAt: doc.data().updatedAt.toDate()
        })) as ExpenseNote[];

        setExpenseNotes(notes);
      } catch (error) {
        console.error('Erreur lors du chargement des notes de frais:', error);
        setError('Erreur lors du chargement des notes de frais');
      }
    };

    fetchExpenseNotes();
  }, [mission?.id]);

  const handleCreateCompany = async () => {
    if (!currentUser || !newCompanyName.trim()) {
      setError("Veuillez vous connecter et saisir un nom d'entreprise");
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!userDoc.exists()) {
        throw new Error("Utilisateur non trouvé");
      }

      const userData = userDoc.data();
      if (!userData) {
        throw new Error("Données utilisateur non trouvées");
      }

      const userStructureId = userData.structureId;

      const companiesRef = collection(db, 'companies');
      const newCompanyRef = await addDoc(companiesRef, {
        name: newCompanyName,
        createdAt: new Date(),
        structureId: userStructureId,
        missionsCount: 0,
        totalRevenue: 0
      });

      const newCompany = {
        id: newCompanyRef.id,
        name: newCompanyName
      };

      setCompanies(prev => [...prev, newCompany]);
      setNewCompanyName('');
      setOpenNewCompanyDialog(false);

      // Mettre à jour la mission avec la nouvelle entreprise
      if (mission) {
        handleUpdateMission(mission.id, {
          companyId: newCompanyRef.id,
          company: newCompanyName
        });
      }

      return newCompany;
    } catch (error) {
      console.error("Erreur lors de la création de l'entreprise:", error);
      return null;
    }
  };

  const handleCreateDescription = async (newDescription: string) => {
    if (!currentUser) {
      setError("Veuillez vous connecter pour créer une description");
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!userDoc.exists()) {
        throw new Error("Utilisateur non trouvé");
      }

      const userData = userDoc.data();
      if (!userData) {
        throw new Error("Données utilisateur non trouvées");
      }

      const userStructureId = userData.structureId;

      const descriptionsRef = collection(db, 'descriptions');
      await addDoc(descriptionsRef, {
        text: newDescription,
        createdAt: new Date(),
        structureId: userStructureId
      });
      setDescriptions([...descriptions, newDescription]);
      return newDescription;
    } catch (error) {
      console.error("Erreur lors de la création de la description:", error);
      return null;
    }
  };

  const checkMissionNumberExists = async (numeroMission: string): Promise<boolean> => {
    if (!mission) return false;
    if (numeroMission === mission.numeroMission) return false;
    
    const missionsRef = collection(db, 'missions');
    const q = query(missionsRef, where('numeroMission', '==', numeroMission));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  };

  const handleEdit = () => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de modifier une mission archivée', { variant: 'error' });
      return;
    }
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (!mission) {
      setError("Mission non trouvée");
      return;
    }
    setEditedMission({ ...mission });
    setIsEditing(false);
    
    // Réinitialiser les dates et heures
    if (mission.startDate) {
      const startDateObj = new Date(mission.startDate);
      setStartDateDate(startDateObj.toISOString().split('T')[0]);
      setStartDateTime(startDateObj.toTimeString().slice(0, 5));
    } else {
      setStartDateDate('');
      setStartDateTime('');
    }

    if (mission.endDate) {
      const endDateObj = new Date(mission.endDate);
      setEndDateDate(endDateObj.toISOString().split('T')[0]);
      setEndDateTime(endDateObj.toTimeString().slice(0, 5));
    } else {
      setEndDateDate('');
      setEndDateTime('');
    }
  };

  const handleSave = async () => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de modifier une mission archivée', { variant: 'error' });
      return;
    }
    try {
      if (!mission?.id) return;

      const updatedData: Partial<Mission> = {};
      
      // Combiner date et heure pour startDate et endDate
      if (startDateDate && startDateTime) {
        updatedData.startDate = new Date(`${startDateDate}T${startDateTime}`).toISOString();
      } else if (startDateDate) {
        updatedData.startDate = new Date(`${startDateDate}T00:00:00`).toISOString();
      }

      if (endDateDate && endDateTime) {
        updatedData.endDate = new Date(`${endDateDate}T${endDateTime}`).toISOString();
      } else if (endDateDate) {
        updatedData.endDate = new Date(`${endDateDate}T00:00:00`).toISOString();
      }

      // Récupérer les valeurs des champs éditables
      Object.keys(fieldsRef.current).forEach((field) => {
        const fieldRef = fieldsRef.current[field as keyof typeof fieldsRef.current];
        if (fieldRef?.getValue) {
          const value = fieldRef.getValue();
          const typedField = field as keyof Mission;
          
          // Ignorer startDate et endDate car on les gère séparément
          if (field === 'startDate' || field === 'endDate') {
            return;
          }
          
          if (field === 'hours' || field === 'priceHT') {
            (updatedData[typedField] as number) = Number(value);
          } else if (field === 'requiresCV' || field === 'requiresMotivation' || field === 'isPublished' || field === 'isPublic') {
            (updatedData[typedField] as boolean) = value === 'true';
          } else {
            (updatedData[typedField] as string) = value;
          }
        }
      });

      // Ajouter la description si elle a été modifiée
      if (mission.description) {
        updatedData.description = mission.description;
      }

      // Ajouter le type de mission s'il a été modifié
      if (mission.missionTypeId) {
        updatedData.missionTypeId = mission.missionTypeId;
      }

      // Ajouter la modification de l'étape si elle a changé
      if (mission.etape) {
        updatedData.etape = mission.etape;
      }

      // Ajouter les modifications du chargé de mission
      if (mission.chargeId && mission.chargeName) {
        updatedData.chargeId = mission.chargeId;
        updatedData.chargeName = mission.chargeName;
      }

      // Ajouter les modifications de l'entreprise
      if (mission.companyId) {
        const selectedCompany = companies.find(c => c.id === mission.companyId);
        if (selectedCompany) {
          updatedData.companyId = selectedCompany.id;
          updatedData.company = selectedCompany.name;
        }
      }

      // Ajouter les modifications du contact
      if (mission.contactId) {
        const selectedContact = contacts.find(c => c.id === mission.contactId);
        if (selectedContact) {
          updatedData.contactId = selectedContact.id;
          updatedData.contact = {
            firstName: selectedContact.firstName,
            lastName: selectedContact.lastName,
            email: selectedContact.email,
            phone: selectedContact.phone,
            position: selectedContact.position
          };
        }
      }

      // Mettre à jour la mission dans Firestore
      const missionRef = doc(db, 'missions', mission.id);
      await updateDoc(missionRef, {
        ...updatedData,
        updatedAt: new Date()
      });

      // Mettre à jour l'état local
      const updatedMission = { ...mission, ...updatedData } as Mission;
      setMission(updatedMission);
      setEditedMission(updatedMission);
      setIsEditing(false);
      
      // Mettre à jour les dates et heures locales après sauvegarde
      if (updatedData.startDate) {
        const startDateObj = new Date(updatedData.startDate);
        setStartDateDate(startDateObj.toISOString().split('T')[0]);
        setStartDateTime(startDateObj.toTimeString().slice(0, 5));
      }
      if (updatedData.endDate) {
        const endDateObj = new Date(updatedData.endDate);
        setEndDateDate(endDateObj.toISOString().split('T')[0]);
        setEndDateTime(endDateObj.toTimeString().slice(0, 5));
      }
      
      setSnackbar({
        open: true,
        message: 'Modifications enregistrées avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la mission:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour de la mission',
        severity: 'error'
      });
    }
  };

  const InfoItemEditable = ({ icon, label, field, value }: { 
    icon: React.ReactNode, 
    label: string, 
    field: string, 
    value: string 
  }) => {
    const navigate = useNavigate();
    const isCompanyField = field === 'company';
    const isMissionTypeField = field === 'missionType';

    const handleClick = () => {
      if (isCompanyField && mission?.companyId) {
        navigate(`/app/entreprises/${mission.companyId}`);
      } else if (isMissionTypeField && mission?.missionTypeId) {
        navigate(`/app/settings/mission-descriptions?id=${mission.missionTypeId}`);
      }
    };

    const isClickable = (isCompanyField && mission?.companyId) || (isMissionTypeField && mission?.missionTypeId);

    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2,
        mb: 2.5,
        cursor: isClickable ? 'pointer' : 'default',
        '&:hover': isClickable ? {
          '& .field-value': {
            color: '#007AFF',
            textDecoration: 'underline'
          }
        } : {}
      }}
      onClick={handleClick}
      >
        <Box sx={{
          width: 40,
          height: 40,
          borderRadius: '10px',
          backgroundColor: '#f5f5f7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#1d1d1f'
        }}>
          {icon}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ 
            fontSize: '0.875rem', 
            color: '#86868b',
            mb: 0.5,
            letterSpacing: '-0.01em',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
          }}>
            {label}
          </Typography>
          <Typography sx={{ 
            fontSize: '1rem', 
            fontWeight: '500',
            color: '#1d1d1f',
            letterSpacing: '-0.01em',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
          }} className="field-value">
            {value}
          </Typography>
        </Box>
      </Box>
    );
  };

  const calculatePrices = (hourlyRate: number, hours: number | undefined, expensesList: MissionExpense[] = []) => {
    // Calcul du total HT de la mission
    const missionTotalHT = hourlyRate * (hours || 0);
    
    // Calcul du total HT des dépenses
    const expensesTotalHT = expensesList.reduce((sum, expense) => sum + expense.priceHT, 0);
    
    // Total HT global
    const totalHT = missionTotalHT + expensesTotalHT;
    
    // Calcul de la TVA de la mission (20%)
    const missionTVA = missionTotalHT * 0.2;
    
    // Calcul de la TVA des dépenses
    const expensesTVA = expensesList.reduce((sum, expense) => {
      const expenseTVA = expense.priceHT * (expense.tva / 100);
      return sum + expenseTVA;
    }, 0);
    
    // Total TVA
    const tva = Math.round((missionTVA + expensesTVA) * 100) / 100;
    
    // Total TTC
    const totalTTC = totalHT + tva;
    
    return { totalHT, totalTTC, tva };
  };

  const getAssignedTemplate = async (documentType: DocumentType, forceRefresh = false): Promise<AssignedTemplateData | null> => {
    if (!mission?.structureId) return null;

    const cacheKey = `${mission.structureId}_${documentType}`;
    if (forceRefresh) {
      assignedTemplateCacheRef.current.delete(cacheKey);
    }
    const cached = assignedTemplateCacheRef.current.get(cacheKey);
    if (cached) return cached;

    try {
      const assignmentsQuery = query(
        collection(db, 'templateAssignments'),
        where('structureId', '==', mission.structureId),
        where('documentType', '==', documentType)
      );

      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      if (!assignmentsSnapshot.empty) {
        const assignmentDoc = assignmentsSnapshot.docs[0];
        const assignmentData = assignmentDoc.data();

        const templateDoc = await getDoc(doc(db, 'templates', assignmentData.templateId));
        if (!templateDoc.exists()) return null;

        const templateData = templateDoc.data();
        const result: AssignedTemplateData = {
          id: templateDoc.id,
          name: (templateData.name as string) || DOCUMENT_TYPES[documentType],
          pdfUrl: templateData.pdfUrl as string,
          variables: (templateData.variables || []) as TemplateVariable[],
          assignmentId: assignmentDoc.id,
          generationType: (assignmentData.generationType || 'template') as 'template' | 'editor'
        };
        assignedTemplateCacheRef.current.set(cacheKey, result);
        return result;
      }

      // Repli : template universel (même logique que la page Assignation des templates)
      const universalQuery = query(
        collection(db, 'templates'),
        where('isUniversal', '==', true),
        where('universalDocumentType', '==', documentType)
      );
      const universalSnapshot = await getDocs(universalQuery);
      if (!universalSnapshot.empty) {
        const templateDoc = universalSnapshot.docs[0];
        const templateData = templateDoc.data();
        const result: AssignedTemplateData = {
          id: templateDoc.id,
          name: (templateData.name as string) || DOCUMENT_TYPES[documentType],
          pdfUrl: templateData.pdfUrl as string,
          variables: (templateData.variables || []) as TemplateVariable[],
          generationType: 'template'
        };
        assignedTemplateCacheRef.current.set(cacheKey, result);
        return result;
      }

      return null;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du template:', error);
      return null;
    }
  };

  const downloadTemplatePDF = async (documentType: DocumentType, forceDownload: boolean = true) => {
    console.log('📥 Téléchargement du PDF template pour:', documentType);
    
    try {
      setDownloadProgress({ progress: 10, message: 'Récupération du template...' });
      
      const assignedTemplate = await getAssignedTemplate(documentType);
      if (!assignedTemplate) {
        setDownloadProgress(null);
        enqueueSnackbar('Aucune template assignée pour ce type de document', { variant: 'error' });
        return;
      }

      if (assignedTemplate.generationType === 'editor') {
        setDownloadProgress(null);
        enqueueSnackbar('Ce type de document utilise l\'éditeur, pas de PDF template à télécharger', { variant: 'info' });
        return;
      }

      // Télécharger le PDF template
      console.log('📥 PDF URL à télécharger:', assignedTemplate.pdfUrl);
      setDownloadProgress({ progress: 30, message: 'Génération du document...' });
      
      // Générer le document avec les variables remplacées
      console.log('📄 Génération du document avec variables remplacées...');
      await generateDocument(documentType, undefined, undefined, false, true);
      
      setDownloadProgress({ progress: 100, message: 'Téléchargement terminé' });
      setTimeout(() => {
        setDownloadProgress(null);
      }, 500);
    } catch (error: unknown) {
      console.error('❌ Erreur lors du téléchargement du PDF template:', error);
      setDownloadProgress(null);
      const isPermissionDenied = error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'permission-denied';
      const message = isPermissionDenied
        ? 'Accès refusé. Vérifiez que votre compte a les accès "Missions" dans Réglages > Accès.'
        : 'Erreur lors du téléchargement du template';
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  const getButtonText = async (documentType: DocumentType) => {
    try {
      const assignedTemplate = await getAssignedTemplate(documentType);
      if (assignedTemplate) {
        if (assignedTemplate.generationType === 'template') {
          return 'Télécharger Template PDF';
        } else {
          return 'Créer avec Éditeur';
        }
      } else {
        return 'Créer une proposition commerciale';
      }
    } catch (error) {
      return 'Créer une proposition commerciale';
    }
  };

  type DocumentGenerationCache = {
    userData?: Record<string, unknown> | null;
    chargeData?: Record<string, unknown> | null;
    contactData?: Record<string, unknown> | null;
    companyData?: Record<string, unknown> | null;
    structureData?: Record<string, unknown> | null;
    missionTypeData?: Record<string, unknown> | null;
    presidentFullName?: string | null;
    workingHoursData?: ReturnType<typeof buildWorkingHoursDocumentData> | null;
  };

  const loadDocumentGenerationCache = async (
    application: Application | undefined,
    tagList: string[]
  ): Promise<DocumentGenerationCache> => {
    if (!mission) return {};

    const needsUserData = application?.userId && tagList.some((t) =>
      t.startsWith('user_') || ['graduationYear', 'gender', 'birthPlace', 'birthDate', 'address', 'nationality', 'socialSecurityNumber', 'phone', 'program'].includes(t)
    );
    const needsChargeData = tagList.some((t) => tagNeedsChargeData(t));
    const needsMissionTypeData = !!mission.missionTypeId && tagList.some((t) => tagNeedsMissionTypeData(t));
    const needsStructureData = !!mission.structureId && tagList.some((t) =>
      (t.startsWith('structure_') && t !== 'structure_president_nom_complet') ||
      t === 'gratification_nette' ||
      t === 'gratification_brute' ||
      t === 'total_a_payer' ||
      t === 'mission_gratificationhorraire'
    );
    const needsPresident = !!mission.structureId && tagList.includes('structure_president_nom_complet');
    const needsWorkingHours = !!application && tagList.some((t) =>
      t.startsWith('workinghours_') ||
      t.startsWith('workingHours') ||
      t === 'heures_detaillees' ||
      t === 'heuresDetaillees' ||
      t === 'heures_finalement_travaillees' ||
      t === 'workingHoursTotal' ||
      t === 'amendment_new_hours' ||
      t === 'amendment_actual_hours' ||
      t === 'actualHours'
    );
    const needsCompany = tagList.some((t) =>
      t.startsWith('entreprise_') || t === 'siren' || t === 'nSiret' || t === 'companyName' || t === 'mission_entreprise'
    );

    const [
      userData,
      chargeData,
      missionTypeData,
      structureData,
      presidentFullName,
      workingHoursData,
      companyDataFull,
    ] = await Promise.all([
      needsUserData
        ? getDoc(doc(db, 'users', application!.userId)).then((d) => (d.exists() ? d.data() : null))
        : Promise.resolve(null),
      needsChargeData
        ? getDoc(doc(db, 'users', mission.chargeId)).then((d) => (d.exists() ? d.data() : null))
        : Promise.resolve(null),
      needsMissionTypeData
        ? getDoc(doc(db, 'missionTypes', mission.missionTypeId!)).then((d) => (d.exists() ? d.data() : null))
        : Promise.resolve(null),
      needsStructureData
        ? getDoc(doc(db, 'structures', mission.structureId!)).then((d) => (d.exists() ? { ...d.data(), id: d.id } : null))
        : Promise.resolve(null),
      needsPresident
        ? (async () => {
            try {
              const usersRef = collection(db, 'users');
              const q = query(usersRef, where('structureId', '==', mission.structureId));
              const usersSnapshot = await getDocs(q);

              let members = usersSnapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data(),
                mandat: docSnap.data().mandat || null,
                bureauRole: docSnap.data().bureauRole || null,
                poles: docSnap.data().poles || [],
                firstName: docSnap.data().firstName || '',
                lastName: docSnap.data().lastName || '',
                displayName: docSnap.data().displayName || '',
              }));
              members = await decryptUsersList(members as Parameters<typeof decryptUsersList>[0]);

              const presidents = members.filter((member) => {
                const hasPresidentRole = member.bureauRole === 'president' ||
                  member.poles?.some((p: { poleId?: string }) => p.poleId === 'pre');
                return hasPresidentRole && member.mandat;
              });

              if (presidents.length > 0) {
                const sortedPresidents = presidents.sort((a, b) => {
                  if (!a.mandat || !b.mandat) return 0;
                  const aYear = parseInt(a.mandat.split('-')[0], 10);
                  const bYear = parseInt(b.mandat.split('-')[0], 10);
                  return bYear - aYear;
                });

                const mostRecentPresident = sortedPresidents[0];
                if (mostRecentPresident.firstName && mostRecentPresident.lastName) {
                  return `${mostRecentPresident.firstName} ${mostRecentPresident.lastName}`.trim();
                }
                if (mostRecentPresident.displayName) {
                  return mostRecentPresident.displayName;
                }
              }
              return null;
            } catch (error) {
              console.error('Erreur lors de la récupération du président:', error);
              return null;
            }
          })()
        : Promise.resolve(null),
      needsWorkingHours
        ? getDocs(query(
            collection(db, 'workingHours'),
            where('applicationId', '==', application!.id)
          )).then((snapshot) => buildWorkingHoursDocumentData(snapshot.docs))
        : Promise.resolve(null),
      needsCompany && mission.companyId
        ? getDoc(doc(db, 'companies', mission.companyId)).then((d) =>
            d.exists() ? { id: d.id, ...d.data() } : null
          )
        : Promise.resolve(null),
    ]);

    const decryptedCtx = await prepareDecryptedDocumentContext({
      userId: application?.userId,
      userData,
      chargeId: mission.chargeId,
      chargeData,
      contactId: mission.contactId,
      contactData: mission.contact ? { ...mission.contact } : null,
      companyId: mission.companyId,
      companyData: companyDataFull,
      structureId: mission.structureId,
      structureData,
    });

    return {
      userData: decryptedCtx.userData ?? userData,
      chargeData: decryptedCtx.chargeData ?? chargeData,
      contactData: decryptedCtx.contactData ?? (mission.contact ? { ...mission.contact } : null),
      companyData: decryptedCtx.companyData ?? companyDataFull,
      structureData: decryptedCtx.structureData ?? structureData,
      missionTypeData,
      presidentFullName,
      workingHoursData,
    };
  };

  const resolveVariableTag = (variable: TemplateVariable): string => {
    if (variable.type === 'raw') return variable.rawText || '';
    const id = variable.variableId || variable.fieldId;
    if (!id) return '';
    return resolveTagFromVariableId(id, variable.dataSource);
  };

  const extractTemplateTagNames = (templateVariables: TemplateVariable[]): string[] => {
    const allTagNames = new Set<string>();
    for (const variable of templateVariables) {
      const valueToCheck = resolveVariableTag(variable);
      const tags = valueToCheck.match(/<[^>]+>/g) || [];
      tags.forEach((tag) => allTagNames.add(tag.replace(/[<>]/g, '')));
    }
    return [...allTagNames];
  };

  // Détection des données manquantes via le moteur documentTagEngine
  const detectMissingData = async (documentType: DocumentType, application?: Application, expenseNote?: ExpenseNote) => {
    if (!mission) return [];
    try {
      const review = await fetchTemplateTagsReview(documentType, application, expenseNote);
      return detectMissingTags(review);
    } catch (error) {
      console.error('Erreur lors de la détection des données manquantes:', error);
      return [];
    }
  };

  type TemplateTagReviewItem = {
    tag: string;
    label: string;
    category: string;
    value: string;
    isMissing: boolean;
  };

  const fetchTemplateTagsReview = async (
    documentType: DocumentType,
    application?: Application,
    expenseNote?: ExpenseNote
  ): Promise<TemplateTagReviewItem[]> => {
    if (!mission) return [];

    const templateData = await getAssignedTemplate(documentType, documentType === 'avenant');
    if (!templateData) return [];

    const tagList = extractTemplateTagNames((templateData.variables || []) as TemplateVariable[]);
    if (tagList.length === 0) return [];

    const cache = await loadDocumentGenerationCache(application, tagList);
    const tagOverrideSeed = application?.documentTagOverrides ?? {};

    // Construit le contexte puis résout tag-par-tag (pas de join/split fragile)
    const replacements = await buildReplacementsForContext(
      application,
      cache.structureData,
      tagOverrideSeed,
      cache,
      documentType
    );

    return reviewTemplateTags(tagList, replacements, tagOverrideSeed);
  };

  /** Hydrate le contexte (cache / fetch / decrypt) puis construit la carte de remplacements. */
  const buildReplacementsForContext = async (
    application?: Application,
    structureData?: Record<string, unknown> | null,
    tempDataOverride?: { [key: string]: string },
    cachedData?: {
      userData?: Record<string, unknown> | null;
      chargeData?: Record<string, unknown> | null;
      contactData?: Record<string, unknown> | null;
      companyData?: Record<string, unknown> | null;
      structureData?: Record<string, unknown> | null;
      missionTypeData?: Record<string, unknown> | null;
      presidentFullName?: string | null;
      workingHoursData?: {
        hours?: Array<{
          date?: string;
          startTime?: string;
          endTime?: string;
          breaks?: Array<{ start?: string; end?: string }>;
        }>;
        createdAt?: { toDate?: () => Date };
        updatedAt?: { toDate?: () => Date };
      } | null;
    },
    documentType?: DocumentType
  ): Promise<Record<string, string>> => {
    if (!mission) return {};

    let userData = cachedData?.userData;
    if (!userData && application?.userId) {
      const userDoc = await getDoc(doc(db, 'users', application.userId));
      if (userDoc.exists()) {
        userData = userDoc.data();
      }
    }

    let chargeData = cachedData?.chargeData;
    if (!chargeData && mission.chargeId) {
      const chargeDoc = await getDoc(doc(db, 'users', mission.chargeId));
      chargeData = chargeDoc.exists() ? chargeDoc.data() : null;
    }

    let companyData = cachedData?.companyData;
    if (!companyData && mission.companyId) {
      const companyDoc = await getDoc(doc(db, 'companies', mission.companyId));
      if (companyDoc.exists()) {
        companyData = { id: companyDoc.id, ...companyDoc.data() };
      } else {
        const fromList = companies.find((c) => c.id === mission.companyId);
        if (fromList) companyData = fromList as unknown as Record<string, unknown>;
      }
    }

    let contactData = cachedData?.contactData ?? (mission.contact as Record<string, unknown> | undefined);
    let structureDataResolved = cachedData?.structureData ?? structureData;
    if (!structureDataResolved && mission.structureId) {
      const structureDoc = await getDoc(doc(db, 'structures', mission.structureId));
      if (structureDoc.exists()) {
        structureDataResolved = { id: structureDoc.id, ...structureDoc.data() };
      }
    }

    const decrypted = await prepareDecryptedDocumentContext({
      userId: application?.userId,
      userData,
      chargeId: mission.chargeId,
      chargeData,
      contactId: mission.contactId,
      contactData: contactData ? { ...contactData } : null,
      companyId: mission.companyId,
      companyData,
      structureId: mission.structureId,
      structureData: structureDataResolved,
    });
    userData = decrypted.userData ?? userData;
    chargeData = decrypted.chargeData ?? chargeData;
    contactData = decrypted.contactData ?? contactData;
    companyData = decrypted.companyData ?? companyData;
    structureDataResolved = decrypted.structureData ?? structureDataResolved;

    let missionTypeData = cachedData?.missionTypeData;
    if (!missionTypeData && mission.missionTypeId) {
      const missionTypeDoc = await getDoc(doc(db, 'missionTypes', mission.missionTypeId));
      missionTypeData = missionTypeDoc.exists() ? missionTypeDoc.data() : null;
    }

    let presidentFullName = '';
    if (cachedData && 'presidentFullName' in cachedData) {
      presidentFullName = cachedData.presidentFullName || '';
    } else if (mission.structureId) {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('structureId', '==', mission.structureId));
        const usersSnapshot = await getDocs(q);

        let members = usersSnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
          mandat: docSnap.data().mandat || null,
          bureauRole: docSnap.data().bureauRole || null,
          poles: docSnap.data().poles || [],
          firstName: docSnap.data().firstName || '',
          lastName: docSnap.data().lastName || '',
          displayName: docSnap.data().displayName || '',
        }));
        members = await decryptUsersList(members as Parameters<typeof decryptUsersList>[0]);

        const presidents = members.filter((member) => {
          const hasPresidentRole =
            member.bureauRole === 'president' ||
            member.poles?.some((p: { poleId?: string }) => p.poleId === 'pre');
          return hasPresidentRole && member.mandat;
        });

        if (presidents.length > 0) {
          const sortedPresidents = presidents.sort((a, b) => {
            if (!a.mandat || !b.mandat) return 0;
            const aYear = parseInt(a.mandat.split('-')[0], 10);
            const bYear = parseInt(b.mandat.split('-')[0], 10);
            return bYear - aYear;
          });
          const mostRecentPresident = sortedPresidents[0];
          if (mostRecentPresident.firstName && mostRecentPresident.lastName) {
            presidentFullName = `${mostRecentPresident.firstName} ${mostRecentPresident.lastName}`.trim();
          } else if (mostRecentPresident.displayName) {
            presidentFullName = mostRecentPresident.displayName;
          }
        }
      } catch (error) {
        console.error('Erreur lors de la récupération du président:', error);
      }
    }

    const workingHoursSlots =
      cachedData?.workingHoursData?.hours?.length
        ? cachedData.workingHoursData.hours
        : application?.workingHours ?? [];

    const whCreation = (() => {
      const d = cachedData?.workingHoursData?.createdAt;
      if (d && typeof d.toDate === 'function') return d.toDate().toLocaleDateString('fr-FR');
      return application?.createdAt ? new Date(application.createdAt).toLocaleDateString('fr-FR') : '';
    })();
    const whMaj = (() => {
      const d = cachedData?.workingHoursData?.updatedAt;
      if (d && typeof d.toDate === 'function') return d.toDate().toLocaleDateString('fr-FR');
      return application?.updatedAt ? new Date(application.updatedAt).toLocaleDateString('fr-FR') : '';
    })();

    if (!missionTypeData && mission.missionTypeId) {
      const fromList = missionTypes.find((t) => t.id === mission.missionTypeId);
      if (fromList) missionTypeData = fromList as unknown as Record<string, unknown>;
    }

    const ctx: TagReplacementContext = {
      mission: mission as unknown as Record<string, unknown>,
      documentType,
      application: application
        ? {
            userDisplayName: application.userDisplayName,
            userEmail: application.userEmail,
            userPhone: application.userPhone,
            userStudentId: application.userStudentId,
            createdAt: application.createdAt,
            updatedAt: application.updatedAt,
            documentTagOverrides: application.documentTagOverrides,
            workingHours: application.workingHours,
            gratificationBrute: (application as { gratificationBrute?: number }).gratificationBrute,
            gratificationNet: (application as { gratificationNet?: number }).gratificationNet,
          }
        : null,
      userData: userData as Record<string, unknown> | null,
      chargeData: chargeData as Record<string, unknown> | null,
      contactData: contactData as Record<string, unknown> | null,
      companyData: companyData as Record<string, unknown> | null,
      structureData: structureDataResolved as Record<string, unknown> | null,
      missionTypeData: missionTypeData as Record<string, unknown> | null,
      presidentFullName,
      workingHoursSlots,
      workingHoursCreatedAt: whCreation,
      workingHoursUpdatedAt: whMaj,
      tempDataOverride,
    };

    return buildTagReplacements(ctx);
  };

  const replaceTags = async (
    text: string,
    application?: Application,
    structureData?: Record<string, unknown> | null,
    tempDataOverride?: { [key: string]: string },
    cachedData?: {
      userData?: Record<string, unknown> | null;
      chargeData?: Record<string, unknown> | null;
      contactData?: Record<string, unknown> | null;
      companyData?: Record<string, unknown> | null;
      structureData?: Record<string, unknown> | null;
      missionTypeData?: Record<string, unknown> | null;
      presidentFullName?: string | null;
      workingHoursData?: {
        hours?: Array<{
          date?: string;
          startTime?: string;
          endTime?: string;
          breaks?: Array<{ start?: string; end?: string }>;
        }>;
        createdAt?: { toDate?: () => Date };
        updatedAt?: { toDate?: () => Date };
      } | null;
    },
    documentType?: DocumentType
  ) => {
    if (!text || !mission) return text;

    try {
      const replacements = await buildReplacementsForContext(
        application,
        structureData,
        tempDataOverride,
        cachedData,
        documentType
      );
      return applyTagReplacements(text, replacements, {
        tempDataOverride,
        mission: mission as unknown as Record<string, unknown>,
      });
    } catch (error) {
      console.error('Erreur lors du remplacement des variables:', error);
      setSnackbar({
        open: true,
        message: 'Une erreur est survenue lors du remplacement des variables',
        severity: 'error',
      });
      return text;
    }
  };


  const generateDocument = async (
    documentType: DocumentType,
    application?: Application,
    expenseNote?: ExpenseNote,
    ignoreMissingData: boolean = false,
    forceDownload: boolean = false,
    tempDataOverride?: Record<string, string>
  ) => {
    const activeTempData = tempDataOverride ?? tempData;
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de générer des documents pour une mission archivée', { variant: 'error' });
      return;
    }

    if (documentType === 'avenant' && !application) {
      enqueueSnackbar('Sélectionnez un étudiant pour générer l\'avenant', { variant: 'warning' });
      return;
    }

    if (documentType === 'lettre_mission' && !application) {
      enqueueSnackbar('Sélectionnez un étudiant pour générer la lettre de mission', { variant: 'warning' });
      return;
    }
    
    // Protection contre les appels multiples
    if (generatingDocType) {
      console.log('⚠️ Génération déjà en cours, ignoré');
      return;
    }
    
    try {
      setGeneratingDocType(documentType);
      
      console.log('🚀 Début de la génération du document:', documentType);
      
      // Vérifier les données de la mission
      console.log('📋 Données de la mission:', {
        id: mission.id,
        structureId: mission.structureId,
        documentType,
        application: application ? {
          id: application.id,
          userId: application.userId
        } : 'pas d\'application',
        expenseNote: expenseNote ? {
          id: expenseNote.id,
          amount: expenseNote.amount,
          description: expenseNote.description
        } : 'pas de note de frais'
      });

      // Détecter les données manquantes avant de générer le document
      if (forceDownload) {
        setDownloadProgress({ progress: 40, message: 'Vérification des données...' });
      }
      console.log('🔍 Vérification des données manquantes...');
      if (!ignoreMissingData) {
        const missingData = await detectMissingData(documentType, application, expenseNote);

        if (missingData.length > 0) {
          console.log('⚠️ Données manquantes détectées:', missingData);
          setGeneratingDocType(null);
          // Fermer la popup LM (loader) avant d'ouvrir celle des manquantes
          if (documentType === 'lettre_mission') {
            setLmDialogOpen(false);
            await new Promise((resolve) => setTimeout(resolve, 80));
          }
          setMissingDataDialog({
            open: true,
            detecting: false,
            missingData,
            documentType,
            application,
            expenseNote
          });
          if (forceDownload) {
            setDownloadProgress(null);
          }
          return;
        }
        console.log('✅ Aucune donnée manquante, génération en cours...');
      } else {
        console.log('✅ Vérification des données ignorée (saisie modale ou forçage)');
        setMissingDataDialog((prev) => ({ ...prev, open: false, detecting: false }));
      }
      
      // 1. Récupérer l'assignation du template
      if (forceDownload) {
        setDownloadProgress({ progress: 50, message: 'Récupération du template...' });
      }
      console.log('📄 Récupération de l\'assignation du template...');
      const assignedTemplate = await getAssignedTemplate(documentType, documentType === 'avenant');
      console.log('📄 Template assigné:', assignedTemplate ? assignedTemplate.id : 'aucun');

      if (!assignedTemplate) {
        throw new Error(`Aucun template assigné pour le type de document "${documentType}" et la structure "${mission.structureId}". Veuillez vérifier les assignations dans les paramètres.`);
      }

      // Supprimer l'ancien document s'il existe
      console.log('🗑️ Suppression des anciens documents...');
      const existingDocsQuery = query(
        collection(db, 'generatedDocuments'),
        where('structureId', '==', mission.structureId),
        where('missionId', '==', mission.id),
        where('documentType', '==', documentType)
      );
      const existingDocsSnapshot = await getDocs(existingDocsQuery);
      const docsToDelete =
        (documentType === 'avenant' || documentType === 'lettre_mission') && application
          ? existingDocsSnapshot.docs.filter(
              (docSnap) => docSnap.data().applicationId === application.id
            )
          : existingDocsSnapshot.docs;
      console.log('🗑️ Anciens documents trouvés:', docsToDelete.length);

      // Garde-fou : ne pas détruire un document engagé dans une signature
      // (signatureStatus cancelled reste supprimable). Dupliqué dans EtudeDetailsPage.
      const isSignatureProtected = (data: Record<string, unknown>): boolean => {
        if (data.signatureStatus === 'cancelled') return false;
        if (data.signatureStatus === 'pending' || data.signatureStatus === 'completed') return true;
        return Boolean(data.signatureRequestId);
      };
      const hasProtectedDoc = docsToDelete.some((docSnap) =>
        isSignatureProtected(docSnap.data() as Record<string, unknown>)
      );
      if (hasProtectedDoc) {
        enqueueSnackbar(
          'Ce document est engagé dans un processus de signature et ne peut pas être régénéré. Annulez la demande de signature avant de le régénérer.',
          { variant: 'error' }
        );
        setGeneratingDocType(null);
        if (forceDownload) {
          setDownloadProgress(null);
        }
        return;
      }

      for (const doc of docsToDelete) {
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

      const templateId = assignedTemplate.id;
      const generationType = assignedTemplate.generationType || 'template';
      console.log('📄 Template ID:', templateId);
      console.log('📄 Type de génération:', generationType);
      
      // Vérifier le type de génération
      if (generationType === 'editor') {
        console.log('📝 Type de génération: éditeur - redirection vers QuoteBuilder');
        // Rediriger vers l'éditeur (QuoteBuilder)
        const url = `/app/mission/${mission.id}/quote?template=${templateId}`;
        navigate(url);
        setGeneratingDocType(null);
        return;
      }
      
      // 2. Utiliser le template récupéré
      if (forceDownload) {
        setDownloadProgress({ progress: 60, message: 'Chargement du template...' });
      }
      console.log('📄 Récupération du template...');
      const templatePdfUrl = assignedTemplate.pdfUrl;
      const templateVariables = (assignedTemplate.variables || []) as TemplateVariable[];
      console.log('📄 Template récupéré, variables:', templateVariables.length);

      // 3. Charger et modifier le PDF
      if (forceDownload) {
        setDownloadProgress({ progress: 70, message: 'Téléchargement du PDF...' });
      }
      console.log('📄 Chargement du PDF template...');
      console.log('📄 Template PDF URL:', templatePdfUrl);
      
      let pdfUrl;
      if (templatePdfUrl.startsWith('http')) {
        // Si c'est déjà une URL complète, l'utiliser directement
        console.log('📄 URL directe détectée');
        pdfUrl = templatePdfUrl;
      } else {
        // Sinon, utiliser Firebase Storage
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
      const { PDFDocument } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.load(pdfBytes);
      console.log('📄 PDFDocument chargé, pages:', pdfDoc.getPageCount());
      
      const helveticaFont = await pdfDoc.embedFont('Helvetica');
      const helveticaFontBold = await pdfDoc.embedFont('Helvetica-Bold');
      const pages = pdfDoc.getPages();
      console.log('📄 Polices chargées, pages récupérées');

      // 3.1. Récupérer toutes les données nécessaires en parallèle pour optimiser les performances
      console.log('🏢 Récupération des données en parallèle...');
      const dataPromises: Promise<any>[] = [];
      
      // Structure
      let structureDataPromise: Promise<any> = Promise.resolve(null);
      if (mission.structureId) {
        structureDataPromise = getDoc(doc(db, 'structures', mission.structureId)).then(doc => {
          if (doc.exists()) {
            return { ...doc.data(), id: doc.id };
          }
          return null;
        });
        dataPromises.push(structureDataPromise);
      }
      
      // User data (si application)
      let userDataPromise: Promise<any> = Promise.resolve(null);
      if (application?.userId) {
        userDataPromise = getDoc(doc(db, 'users', application.userId)).then(doc => {
          return doc.exists() ? doc.data() : null;
        });
        dataPromises.push(userDataPromise);
      }
      
      // Charge data
      const chargeDataPromise = getDoc(doc(db, 'users', mission.chargeId)).then(doc => {
        return doc.exists() ? doc.data() : null;
      });
      dataPromises.push(chargeDataPromise);
      
      // Mission type data
      let missionTypeDataPromise: Promise<any> = Promise.resolve(null);
      if (mission.missionTypeId) {
        missionTypeDataPromise = getDoc(doc(db, 'missionTypes', mission.missionTypeId)).then(doc => {
          return doc.exists() ? doc.data() : null;
        });
        dataPromises.push(missionTypeDataPromise);
      }
      
      // Working hours (si application)
      let workingHoursDataPromise: Promise<any> = Promise.resolve(null);
      if (application) {
        const workingHoursRef = collection(db, 'workingHours');
        const workingHoursQuery = query(
          workingHoursRef,
          where('applicationId', '==', application.id)
        );
        workingHoursDataPromise = getDocs(workingHoursQuery).then((snapshot) =>
          buildWorkingHoursDocumentData(snapshot.docs)
        );
        dataPromises.push(workingHoursDataPromise);
      }
      
      // President data (si structureId)
      let presidentFullNamePromise: Promise<string | null> = Promise.resolve(null);
      if (mission.structureId) {
        presidentFullNamePromise = (async () => {
          try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('structureId', '==', mission.structureId));
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
            members = await decryptUsersList(members as any);

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
        missionTypeData,
        workingHoursData,
        presidentFullName
      ] = await Promise.all([
        structureDataPromise,
        userDataPromise,
        chargeDataPromise,
        missionTypeDataPromise,
        workingHoursDataPromise,
        presidentFullNamePromise
      ]);

      let companyDataFull: Record<string, unknown> | null = null;
      if (mission.companyId) {
        const companyDoc = await getDoc(doc(db, 'companies', mission.companyId));
        if (companyDoc.exists()) {
          companyDataFull = { id: companyDoc.id, ...companyDoc.data() };
        }
      }

      const decryptedCtx = await prepareDecryptedDocumentContext({
        userId: application?.userId,
        userData,
        chargeId: mission.chargeId,
        chargeData,
        contactId: mission.contactId,
        contactData: mission.contact ? { ...mission.contact } : null,
        companyId: mission.companyId,
        companyData: companyDataFull,
        structureId: mission.structureId,
        structureData,
      });

      console.log('✅ Toutes les données récupérées et déchiffrées en parallèle');

      // 5. Traiter chaque variable du template
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
        // Logs réduits pour améliorer les performances
        // console.log(`🔧 Traitement de la variable: ${variable.name || variable.variableId}`);
        const page = pages[variable.position.page - 1] || pages[0];
        const pageHeight = page.getHeight();

        try {
          // Obtenir la valeur de la variable
          let valueToReplace = resolveVariableTag(variable);

          // Si c'est une note de frais, ajouter les variables spécifiques
          if (documentType === 'note_de_frais' && expenseNote) {
            valueToReplace = valueToReplace
              .replace('<expense_amount>', expenseNote.amount.toString())
              .replace('<expense_description>', expenseNote.description)
              .replace('<expense_date>', expenseNote.date.toLocaleDateString());
          }

          // Si c'est une lettre de mission et qu'il y a des heures de travail, ajouter les variables spécifiques
          if (documentType === 'lettre_mission' && workingHoursData?.hours?.length) {
            const first = workingHoursData.hours[0];
            const totalHours = workingHoursData.hours.reduce((total: number, wh: any) => {
              return total + calculateWorkingHours(wh.startTime, wh.endTime, wh.breaks);
            }, 0);
            const formatWhDate = (d?: unknown) => {
              if (!d) return '';
              if (typeof (d as { toDate?: () => Date }).toDate === 'function') {
                return (d as { toDate: () => Date }).toDate().toLocaleDateString('fr-FR');
              }
              return String(d);
            };

            valueToReplace = valueToReplace
              .replace('<workingHoursDateDebut>', first?.date || '')
              .replace('<workinghours_date_debut>', first?.date || '')
              .replace('<workingHoursHeureDebut>', first?.startTime || '')
              .replace('<workinghours_heure_debut>', first?.startTime || '')
              .replace('<workingHoursDateFin>', first?.date || '')
              .replace('<workinghours_date_fin>', first?.date || '')
              .replace('<workingHoursHeureFin>', first?.endTime || '')
              .replace('<workinghours_heure_fin>', first?.endTime || '')
              .replace('<workingHoursPauses>', first?.breaks?.map((b: any) => `${b.start}-${b.end}`).join(', ') || '')
              .replace('<workinghours_pauses>', first?.breaks?.map((b: any) => `${b.start}-${b.end}`).join(', ') || '')
              .replace('<workingHoursTotal>', totalHours.toFixed(2))
              .replace('<workinghours_total>', totalHours.toFixed(2))
              .replace('<workingHoursCreation>', formatWhDate(workingHoursData.createdAt))
              .replace('<workinghours_creation>', formatWhDate(workingHoursData.createdAt))
              .replace('<workingHoursMaj>', formatWhDate(workingHoursData.updatedAt))
              .replace('<workinghours_maj>', formatWhDate(workingHoursData.updatedAt));
          }

          // Logs réduits pour améliorer les performances
          // console.log(`🔧 Valeur avant remplacement: ${valueToReplace}`);
          const value = await replaceTags(valueToReplace, application, decryptedCtx.structureData ?? structureData, activeTempData, {
            userData: decryptedCtx.userData,
            chargeData: decryptedCtx.chargeData,
            contactData: decryptedCtx.contactData,
            companyData: decryptedCtx.companyData,
            structureData: decryptedCtx.structureData ?? structureData,
            missionTypeData,
            presidentFullName,
            workingHoursData
          }, documentType);
          // console.log(`🔧 Valeur après remplacement: ${value}`);

          if (value && value.trim()) {
            // Appliquer les styles et la position
            const fontSize = variable.fontSize || 12;
            const { x, y } = variable.position;
            const { width, height } = variable;
            const textAlign = variable.textAlign || 'left';
            const verticalAlign = variable.verticalAlign || 'top';
            const lineHeightMultiplier = variable.lineHeight || 1.2;

            // Découper le texte en lignes selon la largeur max, en préservant les retours à la ligne
            const splitTextToLines = (text, font, fontSize, maxWidth) => {
              if (!text) return [];
              
              // D'abord, diviser le texte par les retours à la ligne pour préserver les sauts de ligne existants
              const paragraphs = text.split(/\r?\n/);
              const lines: string[] = [];
              
              // Pour chaque paragraphe (ligne séparée par un retour à la ligne)
              paragraphs.forEach((paragraph, paragraphIndex) => {
                // Si ce n'est pas le premier paragraphe, ajouter une ligne vide pour le retour à la ligne
                if (paragraphIndex > 0) {
                  lines.push('');
                }
                
                // Ensuite, diviser chaque paragraphe en mots et créer des lignes selon la largeur
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

            // Fonction pour nettoyer le texte des caractères non-encodables en WinAnsi
            const cleanTextForPDF = (text: string): string => {
              if (!text) return '';
              // Remplacer les caractères Unicode problématiques par leurs équivalents ASCII
              return text
                .replace(/\u202F/g, ' ') // Espace insécable fine (0x202f) -> espace normal
                .replace(/\u00A0/g, ' ') // Espace insécable (nbsp) -> espace normal
                .replace(/\u2019/g, "'") // Apostrophe courbe -> apostrophe droite
                .replace(/\u2018/g, "'") // Guillemet simple ouvrant -> apostrophe
                .replace(/\u201C/g, '"') // Guillemet double ouvrant -> guillemet droit
                .replace(/\u201D/g, '"') // Guillemet double fermant -> guillemet droit
                .replace(/\u2013/g, '-') // Tiret cadratin -> tiret
                .replace(/\u2014/g, '-') // Tiret cadratin long -> tiret
                .replace(/\u2026/g, '...') // Points de suspension -> trois points
                .replace(/[^\x00-\x7F]/g, (char) => {
                  // Pour les autres caractères non-ASCII, essayer de les convertir
                  // ou les remplacer par un caractère de remplacement
                  const charCode = char.charCodeAt(0);
                  // Caractères Latin-1 (0x00A0-0x00FF), les garder tels quels
                  if (charCode >= 0x00A0 && charCode <= 0x00FF) {
                    return char;
                  }
                  // Signe euro (€) - U+20AC (8364)
                  if (charCode === 0x20AC) {
                    return '€';
                  }
                  // Caractères accentués français courants (é, è, ê, ë, à, â, ç, etc.)
                  // Ces caractères sont dans la plage Latin-1, donc déjà gérés ci-dessus
                  // Pour les autres, remplacer par un espace
                  return ' ';
                });
            };

            const font = variable.isBold ? helveticaFontBold : helveticaFont;
            const cleanedValue = cleanTextForPDF(value);
            const lines = splitTextToLines(cleanedValue.trim(), font, fontSize, width);
            
            // Calculer la hauteur totale du texte
            const lineHeight = fontSize * lineHeightMultiplier;
            const totalTextHeight = lines.length * lineHeight;
            
            // Calculer la position Y de départ en fonction de l'alignement vertical
            // Le système de coordonnées PDF a l'origine en bas à gauche
            // Offset pour abaisser légèrement les balises (en pixels)
            const verticalOffset = 4; // Ajustement pour corriger le décalage vertical
            let startY: number;
            
            if (verticalAlign === 'top') {
              // Le texte commence en haut de la zone (y + height dans le système PDF)
              // On commence à partir du haut et on descend
              startY = pageHeight - y - fontSize * 0.8 - verticalOffset;
            } else if (verticalAlign === 'bottom') {
              // Le texte est aligné en bas, on commence en bas de la zone
              // y est le bas de la zone dans le système de coordonnées PDF
              startY = pageHeight - y - height + fontSize * 0.8 + (totalTextHeight - lineHeight) - verticalOffset;
            } else {
              // 'middle' : centrer verticalement
              const verticalCenter = pageHeight - y - (height / 2);
              startY = verticalCenter + (totalTextHeight / 2) - lineHeight + (fontSize * 0.8) - verticalOffset;
            }

            // S'assurer que le texte ne dépasse pas les limites de la zone
            const minY = pageHeight - y - height + fontSize * 0.5; // Bas de la zone avec marge
            const maxY = pageHeight - y - fontSize * 0.2; // Haut de la zone avec marge
            
            // Si le texte dépasse, ajuster
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
              
              // Si la ligne n'est pas vide, la dessiner
              if (line && line.trim()) {
                // Calculer la position X en fonction de l'alignement horizontal
                let xLine = x;
                const lineWidth = font.widthOfTextAtSize(line, fontSize);
                
                if (textAlign === 'center') {
                  xLine = x + (width - lineWidth) / 2;
                } else if (textAlign === 'right') {
                  xLine = x + width - lineWidth;
                } else {
                  // 'left' ou 'justify'
                  xLine = x;
                }
                
                // S'assurer que le texte reste dans les limites horizontales
                xLine = Math.max(x, Math.min(xLine, x + width - 1));
                
                try {
                  // Dessiner uniquement si la ligne est dans les limites verticales
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
                  // Si l'erreur persiste, essayer avec un texte encore plus nettoyé
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
              // Même si la ligne est vide, on descend quand même pour préserver l'espacement du retour à la ligne
              
              // Passer à la ligne suivante (descendre dans le système PDF)
              lineY -= lineHeight;
              
              // Arrêter si on dépasse les limites
              if (lineY < minY) {
                break;
              }
            }
          }
        } catch (err) {
          console.error(`Erreur lors du traitement de la variable ${variable.name}:`, err);
        }
      }

      // 6. Sauvegarder le PDF modifié
      console.log('💾 Sauvegarde du PDF modifié...');
      const modifiedPdfBytes = await pdfDoc.save();
      console.log('💾 PDF sauvegardé, taille:', modifiedPdfBytes.byteLength);
      
      // Créer le nom du fichier
      let fileName;
      if (documentType === 'proposition_commerciale') {
        fileName = `PC_${mission.numeroMission}.pdf`;
      } else if (documentType === 'lettre_mission' && application) {
        const nomFamille = application.userDisplayName?.split(' ').pop()?.toUpperCase() || 'ETUDIANT';
        fileName = `LM_${nomFamille}_${mission.numeroMission}.pdf`;
      } else if (documentType === 'avenant' && application) {
        const nomFamille = application.userDisplayName?.split(' ').pop()?.toUpperCase() || 'ETUDIANT';
        fileName = `AV_${nomFamille}_${mission.numeroMission}.pdf`;
      } else if (documentType === 'note_de_frais' && expenseNote) {
        fileName = `NF_${expenseNote.id}_${mission.numeroMission}.pdf`;
      } else {
        fileName = `${documentType}_${mission.numeroMission}.pdf`;
      }
      console.log('📁 Nom du fichier:', fileName);

      // Créer le blob une seule fois pour l'utiliser partout
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      
      // Si forceDownload est true, télécharger directement le PDF
      if (forceDownload) {
        if (forceDownload) {
          setDownloadProgress({ progress: 95, message: 'Finalisation du téléchargement...' });
        }
        console.log('📥 Téléchargement forcé du PDF...');
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Nettoyer l'URL temporaire
        setTimeout(() => URL.revokeObjectURL(url), 100);
        
        console.log('✅ PDF téléchargé avec succès');
        if (forceDownload) {
          setDownloadProgress({ progress: 100, message: 'Téléchargement terminé' });
          setTimeout(() => {
            setDownloadProgress(null);
          }, 500);
        }
        // Ne pas retourner ici, continuer pour sauvegarder dans Firestore
      }

      // Uploader le fichier modifié (même si forceDownload est true, on sauvegarde quand même)
      console.log('☁️ Upload du fichier vers Storage...');
      let documentUrl;
      let uploadSucceeded = false;
      
      if (!storage) {
        console.warn('⚠️ Firebase Storage non disponible - génération du document en mode téléchargement uniquement');
        // Si Storage n'est pas disponible, on force le téléchargement
        if (!forceDownload) {
          console.log('📥 Mode téléchargement forcé car Storage non disponible');
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Nettoyer l'URL temporaire
          setTimeout(() => URL.revokeObjectURL(url), 100);
          
          console.log('✅ PDF téléchargé avec succès (mode Storage non disponible)');
          enqueueSnackbar('Document téléchargé avec succès (Storage non disponible)', { variant: 'success' });
          return;
        }
      } else {
        try {
          // Logs de débogage pour comprendre pourquoi les règles échouent
          console.log('🔍 Débogage des permissions Storage:');
          console.log('  - Utilisateur UID:', currentUser?.uid);
          console.log('  - Mission ID:', mission.id);
          console.log('  - Mission structureId:', mission.structureId);
          console.log('  - Mission createdBy:', mission.createdBy);
          console.log('  - Mission permissions:', mission.permissions);
          
          // Récupérer les données utilisateur complètes depuis Firestore
          if (currentUser?.uid) {
            try {
              const userDocRef = doc(db, 'users', currentUser.uid);
              const userDocSnap = await getDoc(userDocRef);
              if (userDocSnap.exists()) {
                const userDataFromFirestore = userDocSnap.data();
                console.log('  - User status:', userDataFromFirestore.status);
                console.log('  - User role:', userDataFromFirestore.role);
                console.log('  - User structureId:', userDataFromFirestore.structureId);
                console.log('  - StructureId match:', userDataFromFirestore.structureId === mission.structureId);
                console.log('  - Is superadmin:', userDataFromFirestore.status === 'superadmin' || userDataFromFirestore.role === 'superadmin');
                console.log('  - Is admin/membre:', userDataFromFirestore.status && ['admin', 'membre', 'admin_structure'].includes(userDataFromFirestore.status));
                console.log('  - Is creator:', mission.createdBy === currentUser.uid);
                if (mission.permissions) {
                  console.log('  - In viewers:', mission.permissions.viewers?.includes(currentUser.uid));
                  console.log('  - In editors:', mission.permissions.editors?.includes(currentUser.uid));
                }
              }
            } catch (userDataError) {
              console.warn('  - Erreur lors de la récupération des données utilisateur:', userDataError);
            }
          }
          
          const storagePath = `missions/${mission.id}/documents/${fileName}`;
          const documentStorageRef = ref(storage, storagePath);
          // Spécifier explicitement le contentType dans les métadonnées
          const metadata = {
            contentType: 'application/pdf',
            customMetadata: {
              missionId: mission.id,
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
          console.warn('⚠️ Erreur lors de l\'upload vers Storage (le téléchargement continuera):', uploadError);
          console.warn('⚠️ Code d\'erreur:', uploadError.code);
          console.warn('⚠️ Message d\'erreur:', uploadError.message);
          // Ne pas bloquer le processus - le téléchargement fonctionnera quand même
          uploadSucceeded = false;
        }
      }

      // Préparer les tags
      const tags: DocumentTag[] = [documentType as DocumentTag];
      if (application) {
        tags.push('student_document');
      }
      if (documentType === 'proposition_commerciale') {
        tags.push('commercial');
      }
      if (documentType === 'note_de_frais') {
        tags.push('expense');
      }

      // Créer le document dans Firestore (seulement si l'upload vers Storage a réussi)
      if (uploadSucceeded && documentUrl) {
        console.log('📊 Création du document dans Firestore...');
        console.log('📊 Création du document dans Firestore...');
        let creatorDisplayName = getSafeDisplayName(userData, '');
        if ((!creatorDisplayName || creatorDisplayName === 'Utilisateur') && currentUser?.uid) {
          const decrypted = await getDecryptedUserDisplayName(currentUser.uid, userData || null);
          if (decrypted && decrypted !== 'Inconnu') {
            creatorDisplayName = decrypted;
          }
        }
        if (!creatorDisplayName || creatorDisplayName === 'Utilisateur') {
          creatorDisplayName = currentUser?.email || 'Utilisateur';
        }

        const documentData: Omit<GeneratedDocument, 'id'> = {
          missionId: mission.id,
          missionNumber: mission.numeroMission,
          missionTitle: mission.title || '',
          structureId: mission.structureId,
          documentType,
          fileName,
          fileUrl: documentUrl,
          fileSize: blob.size,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: currentUser?.uid || '',
          createdByName: creatorDisplayName,
          createdByPhotoURL: userData?.photoURL || currentUser?.photoURL || undefined,
          status: 'draft',
          isValid: true,
          tags,
        notes: expenseNote ? `Note de frais de ${expenseNote.amount}€` : 
               application ? `Document généré pour ${application.userDisplayName}` : 
               'Document généré'
      };

      if (application) {
        documentData.applicationId = application.id;
        documentData.applicationUserName = application.userDisplayName ?? '';
        documentData.applicationUserEmail = application.userEmail ?? '';
      }

      if (expenseNote) {
        documentData.expenseNoteId = expenseNote.id;
      }

        // Firestore n'accepte pas undefined : retirer les champs undefined
        const sanitizedData = Object.fromEntries(
          Object.entries(documentData).filter(([, v]) => v !== undefined)
        ) as Omit<GeneratedDocument, 'id'>;
        const docRef = await addDoc(collection(db, 'generatedDocuments'), sanitizedData);
        console.log('📊 Document créé dans Firestore, ID:', docRef.id);
        const newDocument = { id: docRef.id, ...sanitizedData };
        setGeneratedDocuments(prev => [newDocument, ...prev]);
        console.log('✅ Document sauvegardé dans Firestore et ajouté à la liste');
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

      enqueueSnackbar('Document généré avec succès', { variant: 'success' });
    } catch (error: unknown) {
      console.error('❌ Erreur lors de la génération du document:', error);
      console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'Pas de stack trace');
      setMissingDataDialog((prev) => (prev.detecting ? { ...prev, open: false, detecting: false } : prev));
      setDownloadProgress(null);
      const isPermissionDenied = error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'permission-denied';
      const message = isPermissionDenied
        ? 'Accès refusé. Vérifiez : 1) Réglages > Accès > Missions (lecture + modification) 2) Votre profil a bien le champ status ou role (membre/admin) et structureId identique à la mission.'
        : 'Erreur lors de la génération du document';
      enqueueSnackbar(message, { variant: 'error' });
      throw error;
    } finally {
      console.log('🏁 Fin de la génération du document');
      setGeneratingDocType(null);
      if (!forceDownload) {
        setDownloadProgress(null);
      }
    }
  };

  /**
   * Handler du dialogue de confirmation de régénération.
   * IMPORTANT : ce dialogue n'est PAS encore câblé — `setDocumentConfirmDialog({ open: true })`
   * n'est appelé nulle part. Aujourd'hui `generateDocument` remplace automatiquement les
   * documents existants (avec garde-fou signature). Le câblage complet (ouverture + reprise
   * keep/replace) est prévu au LOT 4.
   */
  const handleDocumentConfirmation = (
    action: 'cancel' | 'replace' | 'keep'
  ): void => {
    if (action === 'cancel') {
      setDocumentConfirmDialog((prev) => ({
        ...prev,
        open: false,
        action: 'cancel',
      }));
      return;
    }
    setDocumentConfirmDialog((prev) => ({
      ...prev,
      open: false,
      action,
    }));
  };

  const handleSavePrice = async () => {
    if (!mission) {
      setError("Mission non trouvée");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // Vérifier si le prix ou les dépenses ont réellement changé
      const hasPriceChanged = mission.priceHT !== priceHT;
      // Note: on sauvegarde toujours les dépenses pour s'assurer qu'elles sont à jour

      // Calculer les nouveaux totaux avant la mise à jour (avec les dépenses)
      const { totalHT: newTotalHT, totalTTC: newTotalTTC, tva: newTva } = calculatePrices(priceHT, mission.hours, expenses);

      const missionRef = doc(db, 'missions', mission.id);
      
      // Préparer les données de mise à jour avec les dépenses
      const updateData: any = {
        totalHT: newTotalHT,
        totalTTC: newTotalTTC,
        tva: newTva,
        updatedAt: new Date()
      };

      // Ajouter le prix si il a changé
      if (hasPriceChanged) {
        updateData.priceHT = priceHT;
      }

      // Supprimer toutes les anciennes dépenses (nomdepense1, tvadepense1, totaldepense1, etc.)
      // On va d'abord récupérer la mission pour voir combien de dépenses existent
      const missionDoc = await getDoc(missionRef);
      if (missionDoc.exists()) {
        const missionData = missionDoc.data();
        let index = 1;
        while (true) {
          const nameKey = `nomdepense${index}`;
          const tvaKey = `tvadepense${index}`;
          const totalKey = `totaldepense${index}`;
          
          if (missionData[nameKey] || missionData[tvaKey] || missionData[totalKey]) {
            updateData[nameKey] = deleteField(); // Supprimer le champ
            updateData[tvaKey] = deleteField();
            updateData[totalKey] = deleteField();
            index++;
          } else {
            break;
          }
        }
      }

      // Ajouter les nouvelles dépenses
      expenses.forEach((expense, index) => {
        const num = index + 1;
        updateData[`nomdepense${num}`] = expense.name;
        updateData[`tvadepense${num}`] = expense.tva;
        updateData[`totaldepense${num}`] = expense.priceHT;
      });

      // Mettre à jour la mission
      await updateDoc(missionRef, updateData);

      // Mettre à jour l'état local de la mission immédiatement
      const updatedMission = {
        ...mission,
        priceHT: priceHT,
        totalHT: newTotalHT,
        totalTTC: newTotalTTC,
        tva: newTva
      };
      
      console.log("💰 Prix mis à jour dans l'état local:", {
        priceHT: updatedMission.priceHT,
        totalHT: updatedMission.totalHT,
        totalTTC: updatedMission.totalTTC,
        tva: updatedMission.tva,
        hours: updatedMission.hours
      });
      
      setMission(updatedMission);
      setEditedMission(updatedMission);

      // Mettre à jour les états locaux pour l'affichage
      setTotalHT(newTotalHT);
      setTotalTTC(newTotalTTC);

      setIsPriceSaved(true);
      setSavedExpenses(expenses.map((e) => ({ ...e })));
      const message = hasPriceChanged 
        ? "Prix horaire HT et dépenses enregistrés avec succès"
        : "Dépenses enregistrées avec succès";
      enqueueSnackbar(message, { variant: 'success' });
    } catch (err) {
      console.error("Erreur lors de la sauvegarde du prix:", err);
      setError("Erreur lors de la sauvegarde du prix");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveExpense = async (expenseIndex: number) => {
    if (!mission) {
      enqueueSnackbar('Mission non trouvée', { variant: 'error' });
      return;
    }

    const expense = expenses[expenseIndex];
    if (!expense.name || expense.priceHT <= 0) {
      enqueueSnackbar('Veuillez remplir tous les champs de la dépense', { variant: 'warning' });
      return;
    }

    // Vérifier que toutes les dépenses précédentes sont remplies
    for (let i = 0; i < expenseIndex; i++) {
      const prevExpense = expenses[i];
      if (!prevExpense.isSaved && (!prevExpense.name || prevExpense.priceHT <= 0)) {
        enqueueSnackbar('Veuillez d\'abord remplir et enregistrer la dépense précédente', { variant: 'warning' });
        return;
      }
    }

    try {
      setIsSaving(true);
      const missionRef = doc(db, 'missions', mission.id);
      
      // Utiliser l'index séquentiel (expenseIndex + 1) pour maintenir l'ordre
      const nextIndex = expenseIndex + 1;

      // Supprimer toutes les dépenses existantes dans la DB pour réorganiser
      const missionDoc = await getDoc(missionRef);
      const updateData: any = {
        updatedAt: new Date()
      };
      
      if (missionDoc.exists()) {
        const missionData = missionDoc.data();
        let index = 1;
        while (true) {
          const nameKey = `nomdepense${index}`;
          const tvaKey = `tvadepense${index}`;
          const totalKey = `totaldepense${index}`;
          if (missionData[nameKey] || missionData[tvaKey] || missionData[totalKey]) {
            updateData[nameKey] = deleteField();
            updateData[tvaKey] = deleteField();
            updateData[totalKey] = deleteField();
            index++;
          } else {
            break;
          }
        }
      }

      // Réenregistrer toutes les dépenses enregistrées jusqu'à l'index actuel (y compris celle qu'on sauvegarde)
      // Prendre toutes les dépenses jusqu'à l'index actuel (elles sont toutes enregistrées grâce à la vérification précédente)
      const expensesToSave = expenses.slice(0, expenseIndex + 1);
      expensesToSave.forEach((exp, idx) => {
        const num = idx + 1;
        updateData[`nomdepense${num}`] = exp.name;
        updateData[`tvadepense${num}`] = exp.tva;
        updateData[`totaldepense${num}`] = exp.priceHT;
      });

      // Recalculer les totaux
      const { totalHT: newTotalHT, totalTTC: newTotalTTC, tva: newTva } = calculatePrices(priceHT, mission.hours, expenses);
      updateData.totalHT = newTotalHT;
      updateData.totalTTC = newTotalTTC;
      updateData.tva = newTva;

      await updateDoc(missionRef, updateData);

      // Mettre à jour l'état local de la dépense
      const updatedExpenses = [...expenses];
      updatedExpenses[expenseIndex] = {
        ...expense,
        isSaved: true,
        savedIndex: nextIndex
      };
      setExpenses(updatedExpenses);

      // Mettre à jour les totaux
      setTotalHT(newTotalHT);
      setTotalTTC(newTotalTTC);

      // Mettre à jour la mission
      setMission(prev => prev ? {
        ...prev,
        totalHT: newTotalHT,
        totalTTC: newTotalTTC,
        tva: newTva,
        [`nomdepense${nextIndex}`]: expense.name,
        [`tvadepense${nextIndex}`]: expense.tva,
        [`totaldepense${nextIndex}`]: expense.priceHT
      } : null);

      enqueueSnackbar('Dépense enregistrée avec succès', { variant: 'success' });
    } catch (err) {
      console.error("Erreur lors de la sauvegarde de la dépense:", err);
      enqueueSnackbar('Erreur lors de la sauvegarde de la dépense', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !mission) {
      return;
    }

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) {
      return;
    }

    // Réorganiser les dépenses dans l'état local
    const reorderedExpenses = Array.from(expenses);
    const [removed] = reorderedExpenses.splice(sourceIndex, 1);
    reorderedExpenses.splice(destinationIndex, 0, removed);

    // Mettre à jour les savedIndex pour refléter le nouvel ordre
    const updatedExpenses = reorderedExpenses.map((exp, idx) => ({
      ...exp,
      savedIndex: exp.isSaved ? idx + 1 : exp.savedIndex
    }));

    setExpenses(updatedExpenses);

    // Recalculer les totaux
    const { totalHT: newTotalHT, totalTTC: newTotalTTC, tva: newTva } = calculatePrices(priceHT, mission.hours, updatedExpenses);
    setTotalHT(newTotalHT);
    setTotalTTC(newTotalTTC);

    // Si toutes les dépenses sont enregistrées, mettre à jour la base de données
    const allSaved = updatedExpenses.every(exp => exp.isSaved);
    if (allSaved) {
      try {
        setIsSaving(true);
        const missionRef = doc(db, 'missions', mission.id);

        // Supprimer toutes les dépenses existantes dans la DB
        const updateData: any = {
          updatedAt: new Date()
        };

        const missionDoc = await getDoc(missionRef);
        if (missionDoc.exists()) {
          const missionData = missionDoc.data();
          let index = 1;
          while (true) {
            const nameKey = `nomdepense${index}`;
            const tvaKey = `tvadepense${index}`;
            const totalKey = `totaldepense${index}`;
            if (missionData[nameKey] || missionData[tvaKey] || missionData[totalKey]) {
              updateData[nameKey] = deleteField();
              updateData[tvaKey] = deleteField();
              updateData[totalKey] = deleteField();
              index++;
            } else {
              break;
            }
          }
        }

        // Réenregistrer les dépenses dans le nouvel ordre
        updatedExpenses.forEach((exp, idx) => {
          const num = idx + 1;
          updateData[`nomdepense${num}`] = exp.name;
          updateData[`tvadepense${num}`] = exp.tva;
          updateData[`totaldepense${num}`] = exp.priceHT;
        });

        updateData.totalHT = newTotalHT;
        updateData.totalTTC = newTotalTTC;
        updateData.tva = newTva;

        await updateDoc(missionRef, updateData);

        // Mettre à jour la mission
        setMission(prev => prev ? {
          ...prev,
          totalHT: newTotalHT,
          totalTTC: newTotalTTC,
          tva: newTva
        } : null);

        enqueueSnackbar('Ordre des dépenses mis à jour', { variant: 'success' });
      } catch (err) {
        console.error("Erreur lors de la mise à jour de l'ordre des dépenses:", err);
        enqueueSnackbar('Erreur lors de la mise à jour de l\'ordre des dépenses', { variant: 'error' });
        // Recharger les dépenses depuis la DB en cas d'erreur
        const missionDoc = await getDoc(doc(db, 'missions', mission.id));
        if (missionDoc.exists()) {
          const missionData = missionDoc.data();
          const loadedExpenses: MissionExpense[] = [];
          let index = 1;
          while (true) {
            const nameKey = `nomdepense${index}`;
            const tvaKey = `tvadepense${index}`;
            const totalKey = `totaldepense${index}`;
            
            if (missionData[nameKey] && missionData[totalKey]) {
              loadedExpenses.push({
                id: `expense-${mission.id}-${index}`,
                name: missionData[nameKey] || '',
                tva: missionData[tvaKey] || 20,
                priceHT: missionData[totalKey] || 0,
                isSaved: true,
                savedIndex: index
              });
              index++;
            } else {
              break;
            }
          }
          setExpenses(loadedExpenses);
        }
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleDeleteExpense = async (expenseIndex: number) => {
    if (!mission) {
      enqueueSnackbar('Mission non trouvée', { variant: 'error' });
      return;
    }

    const expense = expenses[expenseIndex];
    if (!expense.isSaved || !expense.savedIndex) {
      // Si la dépense n'est pas enregistrée, on la supprime simplement de la liste
      const updatedExpenses = expenses.filter((_, i) => i !== expenseIndex);
      setExpenses(updatedExpenses);
      if (mission) {
        const { totalHT, totalTTC } = calculatePrices(priceHT, mission.hours, updatedExpenses);
        setTotalHT(totalHT);
        setTotalTTC(totalTTC);
      }
      return;
    }

    try {
      setIsSaving(true);
      const missionRef = doc(db, 'missions', mission.id);
      const savedIndex = expense.savedIndex;

      // Supprimer la dépense et réorganiser les dépenses suivantes
      const updateData: any = {
        updatedAt: new Date()
      };

      // Supprimer toutes les dépenses existantes dans la DB
      const missionDoc = await getDoc(missionRef);
      if (missionDoc.exists()) {
        const missionData = missionDoc.data();
        let index = 1;
        while (true) {
          const nameKey = `nomdepense${index}`;
          const tvaKey = `tvadepense${index}`;
          const totalKey = `totaldepense${index}`;
          if (missionData[nameKey] || missionData[tvaKey] || missionData[totalKey]) {
            updateData[nameKey] = deleteField();
            updateData[tvaKey] = deleteField();
            updateData[totalKey] = deleteField();
            index++;
          } else {
            break;
          }
        }
      }

      // Recalculer les totaux sans cette dépense
      const updatedExpenses = expenses.filter((_, i) => i !== expenseIndex);
      
      // Réorganiser les dépenses restantes : dépense 2 devient dépense 1, etc.
      const reorganizedExpenses = updatedExpenses.map((exp, idx) => ({
        ...exp,
        savedIndex: idx + 1
      }));

      // Réenregistrer les dépenses réorganisées
      reorganizedExpenses.forEach((exp, idx) => {
        const num = idx + 1;
        updateData[`nomdepense${num}`] = exp.name;
        updateData[`tvadepense${num}`] = exp.tva;
        updateData[`totaldepense${num}`] = exp.priceHT;
      });

      const { totalHT: newTotalHT, totalTTC: newTotalTTC, tva: newTva } = calculatePrices(priceHT, mission.hours, updatedExpenses);
      updateData.totalHT = newTotalHT;
      updateData.totalTTC = newTotalTTC;
      updateData.tva = newTva;

      await updateDoc(missionRef, updateData);

      // Mettre à jour l'état local avec les dépenses réorganisées
      setExpenses(reorganizedExpenses);
      setTotalHT(newTotalHT);
      setTotalTTC(newTotalTTC);

      // Mettre à jour la mission
      setMission(prev => prev ? {
        ...prev,
        totalHT: newTotalHT,
        totalTTC: newTotalTTC,
        tva: newTva
      } : null);

      enqueueSnackbar('Dépense supprimée avec succès', { variant: 'success' });
    } catch (err) {
      console.error("Erreur lors de la suppression de la dépense:", err);
      enqueueSnackbar('Erreur lors de la suppression de la dépense', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishMission = async () => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de publier une mission archivée', { variant: 'error' });
      return;
    }
    try {
      setIsSaving(true);
      const missionRef = doc(db, 'missions', mission.id);
      const newPublishedState = !isPublished;
      
      // Si on publie la mission
      if (newPublishedState) {
        const updateData = {
          isPublished: true,
          publishedAt: new Date(),
          etape: 'Recrutement' as MissionEtape,
          updatedAt: new Date()
        };

        await updateDoc(missionRef, updateData);
        
        // Mise à jour de l'état local
        setMission(prev => prev ? { ...prev, ...updateData } : null);
        setIsPublished(true);
        enqueueSnackbar("Mission publiée avec succès", { variant: 'success' });
      } else {
        // Si on dépublie la mission
        await updateDoc(missionRef, {
          isPublished: false,
          publishedAt: null,
          updatedAt: new Date()
        });
        
        setIsPublished(false);
        enqueueSnackbar("Mission dépubliée", { variant: 'success' });
      }
    } catch (error) {
      console.error("Erreur lors de la publication:", error);
      setError("Erreur lors de la publication de la mission");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateApplicationStatus = async (applicationId: string, newStatus: 'En attente' | 'Acceptée' | 'Refusée') => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de modifier le statut d\'une candidature pour une mission archivée', { variant: 'error' });
      return;
    }
    try {
      const applicationRef = doc(db, 'applications', applicationId);
      const currentApplication = applications.find(app => app.id === applicationId);
      
      // Vérifier si le statut a réellement changé
      if (currentApplication?.status === newStatus) {
        return;
      }

      await updateDoc(applicationRef, {
        status: newStatus,
        updatedAt: new Date()
      });

      setApplications(prev => prev.map(app => 
        app.id === applicationId ? { ...app, status: newStatus } : app
      ));

      enqueueSnackbar(`Candidature ${newStatus.toLowerCase()}`, { variant: 'success' });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut:", error);
      enqueueSnackbar("Erreur lors de la mise à jour du statut", { variant: 'error' });
    }
  };

  const handleUpdateDossierValidation = async (applicationId: string, isValidated: boolean) => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de modifier la validation du dossier pour une mission archivée', { variant: 'error' });
      return;
    }
    try {
      const applicationRef = doc(db, 'applications', applicationId);
      const currentApplication = applications.find(app => app.id === applicationId);
      
      // Vérifier si l'état de validation a réellement changé
      if (currentApplication?.isDossierValidated === isValidated) {
        return;
      }

      // Mettre à jour l'application dans Firestore
      await updateDoc(applicationRef, {
        isDossierValidated: isValidated,
        updatedAt: new Date()
      });

      // Mettre à jour l'état local
      setApplications(prev => prev.map(app => 
        app.id === applicationId ? { 
          ...app, 
          isDossierValidated: isValidated,
          updatedAt: new Date()
        } : app
      ));

      // Mettre à jour également l'utilisateur dans Firestore
      if (currentApplication?.userId) {
        const userRef = doc(db, 'users', currentApplication.userId);
        await updateDoc(userRef, {
          dossierValidated: isValidated,
          updatedAt: new Date()
        });
      }

      enqueueSnackbar(`Dossier ${isValidated ? 'validé' : 'invalidé'}`, { variant: 'success' });
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la validation:", error);
      enqueueSnackbar("Erreur lors de la mise à jour de la validation", { variant: 'error' });
    }
  };

  const ApplicationCard = ({ application, canWrite: canWriteApplication }: { application: Application; canWrite: boolean }) => {
    const isExpanded = expandedApplication === application.id;

    return (
      <Paper
        sx={{
          p: 2,
          borderRadius: '12px',
          border: '1px solid',
          borderColor: 'divider',
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.02)'
          }
        }}
        onClick={() => setExpandedApplication(isExpanded ? null : application.id)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: isExpanded ? 2 : 0 }}>
          <Avatar
            src={application.userPhotoURL || undefined}
            sx={{ width: 40, height: 40 }}
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              target.src = '';
              target.style.display = 'none';
            }}
          >
            {application.userEmail.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <UserReferenceText
                  userId={application.userId}
                  name={application.userDisplayName}
                  fallback={application.userEmail.split('@')[0]}
                  sx={{ fontWeight: 500, fontSize: 16 }}
                />
                <Typography variant="body2" color="text.secondary">
                  {application.userEmail}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {/* Toujours afficher l'état de validation du dossier */}
                <Chip
                  icon={application.isDossierValidated ? <CheckCircleIcon fontSize="small" /> : <WarningIcon fontSize="small" />}
                  label={application.isDossierValidated ? "Dossier validé" : "Dossier non validé"}
                  size="small"
                  color={application.isDossierValidated ? "success" : "warning"}
                  sx={{ mr: 1 }}
                />
                <Chip
                  label={application.status}
                  size="small"
                  color={
                    application.status === 'Acceptée' ? 'success' :
                    application.status === 'Refusée' ? 'error' : 'default'
                  }
                />
              </Box>
            </Box>
            {application.userId !== 'manual' && (
              <Typography variant="body2" color="text.secondary">
                Candidature envoyée le {application.submittedAt.toLocaleDateString()}
              </Typography>
            )}
          </Box>
        </Box>

        {isExpanded && (
          <Box sx={{ mt: 2 }}>
            {application.cvUrl && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  CV mis à jour le {application.cvUpdatedAt?.toLocaleDateString()}
                </Typography>
                <Button
                  size="small"
                  startIcon={<PdfIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(application.cvUrl || '', '_blank');
                  }}
                  sx={{
                    color: '#2E3B7C',
                    '&:hover': {
                      backgroundColor: 'rgba(46, 59, 124, 0.04)',
                    },
                  }}
                >
                  Voir le CV
                </Button>
              </Box>
            )}

            {application.motivationLetter && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Lettre de motivation
                </Typography>
                <Typography variant="body2" sx={{ 
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  p: 2,
                  borderRadius: '8px',
                  whiteSpace: 'pre-wrap'
                }}>
                  {application.motivationLetter}
                </Typography>
              </Box>
            )}

            {canWriteApplication && application.status === 'Acceptée' && (
              <Box sx={{ mt: 2, mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  État du dossier
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Button
                    size="small"
                    variant={application.isDossierValidated ? "contained" : "outlined"}
                    color="success"
                    startIcon={<CheckCircleIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateDossierValidation(application.id, true);
                    }}
                  >
                    Valider
                  </Button>
                  <Button
                    size="small"
                    variant={application.isDossierValidated === false ? "contained" : "outlined"}
                    color="warning"
                    startIcon={<WarningIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateDossierValidation(application.id, false);
                    }}
                  >
                    Non validé
                  </Button>
                  <Box sx={{ flex: 1 }} />
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<CancelIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateApplicationStatus(application.id, 'Refusée');
                    }}
                  >
                    Refuser la candidature
                  </Button>
                </Box>
              </Box>
            )}

            {canWriteApplication && application.status === 'En attente' && (
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdateApplicationStatus(application.id, 'Refusée');
                  }}
                >
                  Refuser
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdateApplicationStatus(application.id, 'Acceptée');
                  }}
                >
                  Accepter
                </Button>
              </Box>
            )}

            {canWriteApplication && application.status === 'Refusée' && (
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdateApplicationStatus(application.id, 'Acceptée');
                  }}
                >
                  Ré-accepter la candidature
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Paper>
    );
  };

  const handleAddCandidates = async (users: CandidatePick[], status: CandidateApplicationStatus) => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible d\'ajouter un candidat à une mission archivée', { variant: 'error' });
      return;
    }
    if (!mission?.id) return;

    try {
      for (const user of users) {
        const applicationData: Application = {
          id: '',
          userId: user.id,
          missionId: mission.id,
          status,
          createdAt: new Date(),
          updatedAt: new Date(),
          userEmail: user.email,
          submittedAt: new Date(),
          cvUrl: null,
          cvUpdatedAt: null,
          motivationLetter: null,
          isDossierValidated: false
        };

        const docRef = await addDoc(collection(db, 'applications'), applicationData);
        applicationData.id = docRef.id;

        setApplications(prev => [...prev, applicationData]);
      }

      enqueueSnackbar(`${users.length} candidat(s) ajouté(s) avec succès`, { variant: 'success' });
    } catch (error) {
      console.error("Erreur lors de l'ajout des candidats:", error);
      enqueueSnackbar("Erreur lors de l'ajout des candidats", { variant: 'error' });
      throw error;
    }
  };

  const fetchAvailableUsers = async () => {
    if (!mission?.structureId) return;

    try {
      setLoadingUsers(true);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('structureId', '==', mission.structureId));
      const snapshot = await getDocs(q);
      const usersList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          email: data.email || '',
          displayName: data.displayName || '',
          photoURL: data.photoURL,
          status: data.status,
          structureId: data.structureId,
          ecole: data.ecole,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          address: data.address,
          city: data.city,
          country: data.country,
          formation: data.formation,
          speciality: data.speciality,
          studyLevel: data.studyLevel
        } as ExtendedUser;
      });
      setAvailableUsers(usersList);
      void decryptUsersListProgressive(usersList, setAvailableUsers);
    } catch (error) {
      console.error("Erreur lors du chargement des utilisateurs:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Charger les utilisateurs pour le dialog permissions (pas au chargement de page)
  useEffect(() => {
    if (isPermissionsDialogOpen && mission?.structureId) {
      void fetchAvailableUsers();
    }
  }, [isPermissionsDialogOpen, mission?.structureId]);

  const handleUpdateMission = async (missionId: string, updatedData: Partial<Mission>) => {
    if (!updatedData) return;
    
    try {
      const missionRef = doc(db, 'missions', missionId);
      
      // Si le chargé de mission change, récupérer son mandat
      if (updatedData.chargeId && updatedData.chargeId !== mission?.chargeId) {
        try {
          const chargeDoc = await getDoc(doc(db, 'users', updatedData.chargeId));
          if (chargeDoc.exists()) {
            const chargeData = chargeDoc.data();
            updatedData.mandat = chargeData.mandat || undefined;
          }
        } catch (error) {
          console.error('Erreur lors de la récupération du mandat du chargé de mission:', error);
        }
      }
      
      // Vérifier si des données ont réellement été modifiées
      const hasChanges = Object.keys(updatedData).some(key => {
        const currentValue = mission?.[key as keyof Mission];
        const newValue = updatedData[key as keyof Mission];
        return JSON.stringify(currentValue) !== JSON.stringify(newValue);
      });

      // N'inclure updatedAt que si des changements ont été effectués
      const dataToUpdate = {
        ...updatedData,
        ...(hasChanges ? { updatedAt: new Date() } : {})
      };
      
      await updateDoc(missionRef, dataToUpdate);
      
      // Mise à jour de l'état local
      setMission(prev => prev ? { ...prev, ...updatedData } : null);
      setEditedMission(prev => prev ? { ...prev, ...updatedData } : null);
      
      if (hasChanges) {
        enqueueSnackbar('Mission mise à jour avec succès', { variant: 'success' });
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la mission:', error);
      enqueueSnackbar('Erreur lors de la mise à jour de la mission', { variant: 'error' });
    }
  };

  const handleInputChange = (field: keyof Mission, event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (field === 'hours' || field === 'studentCount') {
      const numValue = parseInt(value) || 0;
      handleFieldChange(field, numValue);
      
      // Mise à jour des totaux si les heures sont modifiées
      if (field === 'hours') {
        const totalHT = priceHT * numValue;
        const totalTTC = totalHT * 1.2;
        setTotalHT(totalHT);
        setTotalTTC(totalTTC);
      }
    } else {
      handleFieldChange(field, value);
    }
  };

  const handleBooleanChange = (field: keyof Mission, value: boolean) => {
    handleFieldChange(field, value);
  };

  const handleFieldChange = (field: keyof Mission, value: string | number | boolean | null) => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de modifier une mission archivée', { variant: 'error' });
      return;
    }
    if (!mission) return;

    const updatedMission = { ...mission };
    if (field === 'chargeId') {
      updatedMission.chargeId = value as string;
      // Récupérer le nom du chargé de mission à partir de son ID
      const selectedMember = structureMembers.find(m => m.id === value);
      if (selectedMember) {
        updatedMission.chargeName = selectedMember.displayName;
      }
    } else {
      updatedMission[field] = value as any;
    }
    setMission(updatedMission);
  };

  const handleAutocompleteChange = (field: keyof Mission, value: string | null) => {
    if (value !== null) {
      handleFieldChange(field, value);
    }
  };

  const fetchUserHistory = async (userId: string) => {
    try {
      const historyRef = collection(db, 'history');
      const q = query(historyRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      const historyData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HistoryEntry[];
      
      // Trier l'historique par date décroissante
      const sortedHistory = historyData.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      setUserHistory(sortedHistory);
    } catch (error) {
      console.error("Erreur lors de la récupération de l'historique:", error);
    }
  };

  const handleAddNote = async () => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible d\'ajouter une note à une mission archivée', { variant: 'error' });
      return;
    }
    if (!mission?.id || !currentUser || !newNote.trim()) return;

    try {
      const noteDataRaw: Omit<MissionNote, 'id'> = {
        content: newNote.trim(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: currentUser.uid,
        createdByName: getSafeDisplayName(userData) || currentUser.email || 'Utilisateur',
        createdByPhotoURL: currentUser.photoURL ?? null,
        missionId: mission.id,
        missionNumber: mission.numeroMission
      };
      // Firestore n'accepte pas undefined : ne garder que les champs définis
      const noteData = Object.fromEntries(
        Object.entries(noteDataRaw).filter(([, v]) => v !== undefined)
      ) as Omit<MissionNote, 'id'>;

      // Ajouter la note dans Firestore
      const docRef = await addDoc(collection(db, 'notes'), noteData);

      // Mettre à jour l'état local
      setNotes(prev => [{
        id: docRef.id,
        ...noteData
      }, ...prev]);

      // Envoyer des notifications aux utilisateurs taggés
      if (taggedUsers.length > 0) {
        const notificationPromises = taggedUsers.map(user => 
          NotificationService.sendToUser(
            user.id,
            'mission_note',
            'Nouvelle note sur la mission',
            `${getSafeDisplayName(userData) || currentUser.email} vous a mentionné dans une note sur la mission ${mission.numeroMission}`,
            'medium',
            {
              missionId: mission.id,
              missionNumber: mission.numeroMission,
              noteId: docRef.id,
              mentionedBy: currentUser.uid
            }
          )
        );

        try {
          await Promise.all(notificationPromises);
          enqueueSnackbar(`${taggedUsers.length} notification(s) envoyée(s)`, { variant: 'success' });
        } catch (notificationError) {
          console.error('Erreur lors de l\'envoi des notifications:', notificationError);
          // Ne pas faire échouer l'ajout de la note si les notifications échouent
        }
      }

      // Réinitialiser le champ de saisie et les utilisateurs taggés
      setNewNote('');
      setTaggedUsers([]);
      enqueueSnackbar('Note ajoutée avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la note:', error);
      enqueueSnackbar('Erreur lors de l\'ajout de la note', { variant: 'error' });
    }
  };

  // Fonction pour gérer les changements des utilisateurs taggés
  const handleTaggedUsersChange = (users: Array<{
    id: string;
    displayName: string;
    email: string;
    photoURL?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  }>) => {
    setTaggedUsers(users);
  };

  // Fonction pour formater le contenu des notes avec les mentions en gras
  const formatNoteContent = (content: string) => {
    // Regex pour détecter les mentions @Nom ou @Prénom Nom (1 ou 2 mots)
    const mentionRegex = /@[A-Za-zÀ-ÿ'\-]+( [A-Za-zÀ-ÿ'\-]+)?/g;
    let lastIndex = 0;
    let match;
    let key = 0;
    const result = [];
    while ((match = mentionRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        result.push(
          <span key={`text-${key++}`}>{content.substring(lastIndex, match.index)}</span>
        );
      }
      result.push(
        <Box
          key={`mention-${key++}`}
          component="span"
          sx={{
            fontWeight: 'bold',
            color: '#007AFF',
            backgroundColor: '#e3f2fd',
            padding: '2px 4px',
            borderRadius: '4px',
            margin: '0 2px',
            display: 'inline-block'
          }}
        >
          {match[0]}
        </Box>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      result.push(
        <span key={`text-${key++}`}>{content.substring(lastIndex)}</span>
      );
    }
    return result;
  };

  // Ajout des nouvelles fonctions de gestion des notes
  const handleEditNote = (note: MissionNote) => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de modifier une note d\'une mission archivée', { variant: 'error' });
      return;
    }
    setEditingNoteId(note.id);
    setEditedNoteContent(note.content);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditedNoteContent('');
  };

  const handleSaveNote = async (noteId: string) => {
    if (!editedNoteContent.trim()) return;

    try {
      const noteRef = doc(db, 'notes', noteId);
      const currentNote = notes.find(note => note.id === noteId);
      
      // Vérifier si le contenu a réellement changé
      if (currentNote?.content === editedNoteContent.trim()) {
        setEditingNoteId(null);
        setEditedNoteContent('');
        return;
      }

      const updateData = {
        content: editedNoteContent.trim(),
        updatedAt: new Date()
      };

      await updateDoc(noteRef, updateData);

      setNotes(prev => prev.map(note => 
        note.id === noteId 
          ? { 
              ...note, 
              content: editedNoteContent.trim(),
              updatedAt: new Date()
            }
          : note
      ));

      setEditingNoteId(null);
      setEditedNoteContent('');
      enqueueSnackbar('Note modifiée avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de la modification de la note:', error);
      enqueueSnackbar('Erreur lors de la modification de la note', { variant: 'error' });
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de supprimer une note d\'une mission archivée', { variant: 'error' });
      return;
    }
    try {
      await deleteDoc(doc(db, 'notes', noteId));
      setNotes(prev => prev.filter(note => note.id !== noteId));
      enqueueSnackbar('Note supprimée avec succès', { variant: 'success' });

      // Supprimer les notifications liées à cette note
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('metadata.noteId', '==', noteId)
      );
      const notificationsSnapshot = await getDocs(notificationsQuery);
      const deletePromises = notificationsSnapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Erreur lors de la suppression de la note:', error);
      enqueueSnackbar('Erreur lors de la suppression de la note', { variant: 'error' });
    }
  };

  const calculateAndUpdatePrices = async (forceUpdate: boolean = false, showNotification: boolean = false) => {
    if (!mission?.id || !mission.priceHT || !mission.hours) return;

    // Si les totaux existent déjà et qu'on ne force pas la mise à jour, on ne fait rien
    if (!forceUpdate && mission.totalHT && mission.totalTTC) return;

    try {
      const { totalHT, totalTTC, tva } = calculatePrices(mission.priceHT, mission.hours, expenses);

      // Vérifier si les montants ont changé
      const hasChanged =
        mission.totalHT !== totalHT ||
        mission.totalTTC !== totalTTC ||
        mission.tva !== tva;

      if (!hasChanged) return; // Ne rien faire si rien n'a changé

      // Mise à jour dans Firestore
      const missionRef = doc(db, 'missions', mission.id);
      await updateDoc(missionRef, {
        totalHT,
        totalTTC,
        tva
      });

      // Mise à jour de l'état local
      setMission(prev => prev ? {
        ...prev,
        totalHT,
        totalTTC,
        tva
      } : null);

      // Afficher la notification uniquement si demandé (pas lors du chargement initial)
      if (showNotification) {
        enqueueSnackbar('Montants mis à jour avec succès', { variant: 'success' });
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour des montants:', error);
      enqueueSnackbar('Erreur lors de la mise à jour des montants', { variant: 'error' });
    }
  };

  // Effet unique consolidé pour le calcul des montants
  useEffect(() => {
    if (mission && mission.priceHT && mission.hours) {
      // Utiliser un timeout pour éviter les appels multiples lors du chargement initial
      const timeoutId = setTimeout(() => {
        calculateAndUpdatePrices(false);
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [mission?.id, mission?.priceHT, mission?.hours, expenses]);

  // Ajouter cette nouvelle fonction
  const handleCompanyClick = async (companyName: string) => {
    if (!currentUser || !companyName) return;

    try {
      const companiesRef = collection(db, 'companies');
      const q = query(companiesRef, where('name', '==', companyName));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const companyId = snapshot.docs[0].id;
        navigate(`/app/entreprises/${companyId}`);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'entreprise:', error);
    }
  };

  const fetchGeneratedDocuments = async () => {
    if (!mission?.id && !mission?.numeroMission) return;

    try {
      // Filtrer par structureId pour respecter les règles Firestore
      const structureId = mission.structureId;
      if (!structureId) {
        setGeneratedDocuments([]);
        return;
      }

      // Chercher les documents par missionId OU par missionNumber
      const documentsQuery = query(
        collection(db, 'generatedDocuments'),
        where('structureId', '==', structureId),
        where('missionNumber', '==', mission.numeroMission),
        orderBy('createdAt', 'desc')
      );

      let snapshot;
      try {
        snapshot = await getDocs(documentsQuery);
      } catch (error: any) {
        // Si la requête échoue (index manquant), essayer avec missionId
        const documentsQueryById = query(
          collection(db, 'generatedDocuments'),
          where('structureId', '==', structureId),
          where('missionId', '==', mission.id),
          orderBy('createdAt', 'desc')
        );
        snapshot = await getDocs(documentsQueryById);
      }

      const documents = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          tags: data.tags || [], // S'assurer que tags est toujours un tableau
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          // Convertir les dates spécifiques aux factures
          invoiceSentDate: data.invoiceSentDate?.toDate?.() || data.invoiceSentDate,
          invoiceDueDate: data.invoiceDueDate?.toDate?.() || data.invoiceDueDate,
          signedAt: data.signedAt?.toDate?.() || data.signedAt
        } as GeneratedDocument;
      });
      
      setGeneratedDocuments(documents);
    } catch (error) {
      console.error('Erreur lors de la récupération des documents générés:', error);
      enqueueSnackbar('Erreur lors de la récupération des documents', { variant: 'error' });
    }
  };

  // Ajouter un useEffect pour surveiller les changements de mission.id ou missionNumber
  useEffect(() => {
    if (mission?.id || mission?.numeroMission) {
      fetchGeneratedDocuments();
    }
  }, [mission?.id, mission?.numeroMission]);

  // Charger les templates de proposition commerciale
  useEffect(() => {
    if (mission?.structureId) {
      fetchQuoteTemplates();
    }
  }, [mission?.structureId]);

  const fetchQuoteTemplates = async () => {
    if (!mission?.structureId) return;
    
    try {
      const templatesRef = collection(db, 'quoteTemplates');
      const q = query(
        templatesRef,
        where('structureId', '==', mission.structureId)
      );
      const querySnapshot = await getDocs(q);
      
      const templates: Array<{ id: string; name: string; structureId: string }> = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        templates.push({
          id: doc.id,
          name: data.name,
          structureId: data.structureId
        });
      });
      
      // Trier côté client par createdAt décroissant
      templates.sort((a, b) => {
        const aData = querySnapshot.docs.find(doc => doc.id === a.id)?.data();
        const bData = querySnapshot.docs.find(doc => doc.id === b.id)?.data();
        const aCreatedAt = aData?.createdAt?.toDate?.() || new Date(0);
        const bCreatedAt = bData?.createdAt?.toDate?.() || new Date(0);
        return bCreatedAt.getTime() - aCreatedAt.getTime();
      });
      
      setQuoteTemplates(templates);
    } catch (error) {
      console.error('Erreur lors de la récupération des templates de proposition commerciale:', error);
    }
  };

  const loadQuoteTemplate = async (templateId: string) => {
    try {
      const templateRef = doc(db, 'quoteTemplates', templateId);
      const templateDoc = await getDoc(templateRef);
      
      if (templateDoc.exists()) {
        const templateData = templateDoc.data();
        // Retourner les données du template pour utilisation dans QuoteBuilder
        return templateData;
      } else {
        throw new Error('Template non trouvé');
      }
    } catch (error) {
      console.error('Erreur lors du chargement du template:', error);
      throw error;
    }
  };

  const handleCreateQuote = async () => {
    if (selectedQuoteTemplate) {
      try {
        const templateData = await loadQuoteTemplate(selectedQuoteTemplate);
        // Rediriger vers QuoteBuilder avec les données du template
        navigate(`/quote-builder/${mission?.id}?template=${selectedQuoteTemplate}`);
      } catch (error) {
        enqueueSnackbar('Erreur lors du chargement du template', { variant: 'error' });
      }
    } else {
      // Rediriger vers QuoteBuilder sans template
      navigate(`/quote-builder/${mission?.id}`);
    }
  };



  // Fonctions de gestion des documents
  const handleDocumentMenuOpen = (event: React.MouseEvent<HTMLButtonElement>, document: GeneratedDocument) => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de modifier les documents d\'une mission archivée', { variant: 'error' });
      return;
    }
    event.stopPropagation();
    setDocumentMenuAnchor({
      element: event.currentTarget,
      document
    });
  };

  const handleDocumentMenuClose = () => {
    setDocumentMenuAnchor({
      element: null,
      document: null
    });
  };

  const handleRenameDocument = async () => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de renommer un document d\'une mission archivée', { variant: 'error' });
      return;
    }
    if (!documentDialogs.selectedDocument || !documentDialogs.newFileName) return;

    try {
      const docRef = doc(db, 'generatedDocuments', documentDialogs.selectedDocument.id);
      await updateDoc(docRef, {
        fileName: documentDialogs.newFileName,
        updatedAt: new Date()
      });

      setGeneratedDocuments(prev => prev.map(doc => 
        doc.id === documentDialogs.selectedDocument?.id
          ? { ...doc, fileName: documentDialogs.newFileName, updatedAt: new Date() }
          : doc
      ));

      enqueueSnackbar('Document renommé avec succès', { variant: 'success' });
      setDocumentDialogs(prev => ({ ...prev, rename: false }));
    } catch (error) {
      console.error('Erreur lors du renommage:', error);
      enqueueSnackbar('Erreur lors du renommage du document', { variant: 'error' });
    }
  };

  const handleDeleteDocument = async (document: GeneratedDocument) => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de supprimer un document d\'une mission archivée', { variant: 'error' });
      return;
    }

    // Vérifier les permissions
    if (!canDeleteDocument()) {
      enqueueSnackbar('Vous n\'avez pas les permissions pour supprimer ce document', { variant: 'error' });
      return;
    }

    try {
      // Supprimer de Firestore
      await deleteDoc(doc(db, 'generatedDocuments', document.id));
      
      // Supprimer de Storage (gérer l'erreur 404 si le fichier n'existe pas)
      if (document.fileUrl) {
        try {
          const storageRef = ref(storage, document.fileUrl);
          await deleteObject(storageRef);
        } catch (storageError: any) {
          // Ignorer l'erreur si le fichier n'existe pas (404/object-not-found)
          if (storageError?.code === 'storage/object-not-found' || storageError?.code === '404') {
            console.warn('Le fichier n\'existe pas dans Storage, suppression de Firestore effectuée:', document.fileUrl);
          } else {
            // Relancer l'erreur si c'est une autre erreur
            throw storageError;
          }
        }
      }

      // Mettre à jour l'état local
      setGeneratedDocuments(prev => prev.filter(doc => doc.id !== document.id));
      handleDocumentMenuClose();
      enqueueSnackbar('Document supprimé avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      enqueueSnackbar('Erreur lors de la suppression du document', { variant: 'error' });
    }
  };

  const handleUploadSignedVersion = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de modifier un document d\'une mission archivée', { variant: 'error' });
      return;
    }
    if (!event.target.files || !event.target.files[0] || !documentDialogs.selectedDocument || !mission) return;

    try {
      const selectedDoc = documentDialogs.selectedDocument;
      const file = event.target.files[0];
      
      // Utiliser le même nom de fichier que l'original
      const fileName = selectedDoc.fileName;
      const storagePath = `missions/${mission.id}/documents/${fileName}`;
      const storageRef = ref(storage, storagePath);

      // Supprimer l'ancien document non signé
      try {
        // Supprimer de Storage
        const oldStorageRef = ref(storage, selectedDoc.fileUrl);
        await deleteObject(oldStorageRef);

        // Supprimer de Firestore
        await deleteDoc(doc(db, 'generatedDocuments', selectedDoc.id));
      } catch (error) {
        console.error('Erreur lors de la suppression de l\'ancien document:', error);
      }

      // Upload du nouveau document signé
      await uploadBytes(storageRef, file);
      const signedUrl = await getDownloadURL(storageRef);

      // Créer le nouveau document avec le même nom mais marqué comme signé
      const newDocumentData: Omit<GeneratedDocument, 'id'> = {
        missionId: mission.id,
        missionNumber: mission.numeroMission || '',
        missionTitle: mission.title || '',
        structureId: mission.structureId || '',
        documentType: selectedDoc.documentType,
        fileName,
        fileUrl: signedUrl,
        fileSize: file.size,
        version: selectedDoc.version || 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: currentUser?.uid || '',
        createdByName: getSafeDisplayName(userData),
        status: 'draft',
        isValid: true,
        tags: [
          ...(selectedDoc.tags || []).filter(tag => {
            if (typeof tag === 'string') {
              return tag !== 'signed';
            }
            return tag.name !== 'signed';
          }),
          'signed'
        ],
        notes: selectedDoc.notes
      };

      // Ajouter les champs optionnels s'ils existent
      if (userData?.photoURL) {
        newDocumentData.createdByPhotoURL = userData.photoURL;
      }
      if (selectedDoc.applicationId) {
        newDocumentData.applicationId = selectedDoc.applicationId;
      }
      if (selectedDoc.applicationUserName) {
        newDocumentData.applicationUserName = selectedDoc.applicationUserName;
      }
      if (selectedDoc.applicationUserEmail) {
        newDocumentData.applicationUserEmail = selectedDoc.applicationUserEmail;
      }

      // Sauvegarder dans Firestore
      const newDocRef = await addDoc(collection(db, 'generatedDocuments'), newDocumentData);
      const newDocument: GeneratedDocument = { id: newDocRef.id, ...newDocumentData };

      // Mettre à jour l'état local en retirant l'ancien document et ajoutant le nouveau
      setGeneratedDocuments(prev => [
        newDocument,
        ...prev.filter(doc => doc.id !== selectedDoc.id)
      ]);

      setDocumentDialogs(prev => ({ ...prev, signedVersion: false }));
      enqueueSnackbar('Document signé ajouté avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la version signée:', error);
      enqueueSnackbar('Erreur lors de l\'ajout de la version signée', { variant: 'error' });
    }
  };

  // Ouvrir le dialog d'upload
  const handleOpenUploadDialog = (category: 'contrats' | 'facturation' | 'autres', file?: File) => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible d\'uploader un document pour une mission archivée', { variant: 'error' });
      return;
    }
    
    // Calculer le montant par défaut de la facture (TTC + notes de frais)
    const calculateDefaultInvoiceAmount = () => {
      if (category !== 'facturation' || !mission) return '0.00';
      
      // Calculer le TTC
      const priceHT = mission.priceHT || parseFloat(mission.salary || '0');
      const totalHours = mission.totalHours || 0;
      const totalHT = mission.totalHT || (priceHT * totalHours);
      const totalTTC = mission.totalTTC || (totalHT * 1.2);
      
      // Calculer les notes de frais validées
      const validatedExpensesTotal = expenseNotes
        .filter(note => note.status === 'Validée')
        .reduce((total, note) => total + note.amount, 0);
      
      const finalAmount = totalTTC + validatedExpensesTotal;
      return finalAmount.toFixed(2);
    };
    
    // Récupérer le nombre de jours d'échéance depuis la structure (par défaut 30)
    const fetchPaymentTerms = async () => {
      if (mission?.structureId) {
        try {
          const structureDoc = await getDoc(doc(db, 'structures', mission.structureId));
          const paymentTermsDays = structureDoc.data()?.paymentTermsDays || 30;
          
          const today = new Date();
          const dueDate = new Date(today);
          dueDate.setDate(dueDate.getDate() + paymentTermsDays);
          
          const defaultAmount = calculateDefaultInvoiceAmount();
          
          setUploadDialog({
            open: true,
            category,
            file: file || null,
            isDragging: false,
            isInvoice: category === 'facturation',
            invoiceSentDate: today.toISOString().split('T')[0],
            invoiceDueDate: dueDate.toISOString().split('T')[0],
            invoiceAmount: defaultAmount
          });
        } catch (error) {
          console.error('Erreur lors de la récupération des termes de paiement:', error);
          // Utiliser les valeurs par défaut en cas d'erreur
          const today = new Date();
          const dueDate = new Date(today);
          dueDate.setDate(dueDate.getDate() + 30);
          
          const defaultAmount = calculateDefaultInvoiceAmount();
          
          setUploadDialog({
            open: true,
            category,
            file: file || null,
            isDragging: false,
            isInvoice: category === 'facturation',
            invoiceSentDate: today.toISOString().split('T')[0],
            invoiceDueDate: dueDate.toISOString().split('T')[0],
            invoiceAmount: defaultAmount
          });
        }
      }
    };
    
    fetchPaymentTerms();
  };

  const handleUploadDocument = async (event: React.ChangeEvent<HTMLInputElement>, category: 'contrats' | 'facturation' | 'autres') => {
    if (!event.target.files || !event.target.files[0]) return;
    const file = event.target.files[0];
    handleOpenUploadDialog(category, file);
    event.target.value = ''; // Réinitialiser l'input
  };

  // Fonction pour vérifier les permissions avant l'upload
  const checkUploadPermissions = async (): Promise<{ canUpload: boolean; reason?: string }> => {
    if (!currentUser || !mission) {
      return { canUpload: false, reason: 'Utilisateur ou mission non trouvé' };
    }

    // Récupérer les données de l'utilisateur depuis Firestore pour être sûr
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!userDoc.exists()) {
        return { canUpload: false, reason: 'Document utilisateur non trouvé dans Firestore' };
      }

      const freshUserData = userDoc.data();
      console.log('🔍 Vérification des permissions:', {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userStatus: freshUserData?.status,
        userStructureId: freshUserData?.structureId,
        missionId: mission.id,
        missionStructureId: mission.structureId,
        missionCreatedBy: mission.createdBy
      });

      // Superadmin peut tout faire
      if (freshUserData?.status === 'superadmin' || freshUserData?.role === 'superadmin') {
        console.log('✅ Superadmin détecté');
        return { canUpload: true };
      }

      // Vérifier que l'utilisateur a un structureId
      if (!freshUserData?.structureId) {
        return { 
          canUpload: false, 
          reason: 'Votre compte n\'est pas associé à une structure. Contactez un administrateur.' 
        };
      }

      // Vérifier que la mission a un structureId
      if (!mission.structureId) {
        return { 
          canUpload: false, 
          reason: 'Cette mission n\'est pas associée à une structure.' 
        };
      }

      // Vérifier que les structures correspondent
      if (freshUserData.structureId !== mission.structureId) {
        return { 
          canUpload: false, 
          reason: `Vous faites partie d'une autre structure. Votre structure: ${freshUserData.structureId}, Structure de la mission: ${mission.structureId}` 
        };
      }

      // Vérifier le statut de l'utilisateur
      const allowedStatuses = ['admin', 'membre', 'admin_structure'];
      if (!allowedStatuses.includes(freshUserData.status)) {
        return { 
          canUpload: false, 
          reason: `Votre statut (${freshUserData.status}) ne permet pas d'uploader des documents. Statut requis: admin, member, ou membre.` 
        };
      }

      console.log('✅ Permissions validées');
      return { canUpload: true };

    } catch (error) {
      console.error('Erreur lors de la vérification des permissions:', error);
      return { canUpload: false, reason: 'Erreur lors de la vérification des permissions' };
    }
  };

  // Fonction pour uploader effectivement le document
  const handleConfirmUpload = async () => {
    if (!uploadDialog.file || !mission) return;

    // Vérifier les permissions avant l'upload
    const permissionCheck = await checkUploadPermissions();
    if (!permissionCheck.canUpload) {
      enqueueSnackbar(
        permissionCheck.reason || 'Vous n\'avez pas les permissions pour uploader ce document',
        { variant: 'error', autoHideDuration: 8000 }
      );
      return;
    }

    const file = uploadDialog.file;
    const category = uploadDialog.category;
    const timestamp = Date.now();
    
    // Nettoyer le nom de fichier pour éviter les caractères spéciaux qui pourraient causer des problèmes
    const cleanFileName = file.name
      .replace(/[[\]]/g, '_')  // Remplacer les crochets par des underscores
      .replace(/[<>:"/\\|?*]/g, '_');  // Remplacer les autres caractères problématiques
    
    const fileName = `${timestamp}_${cleanFileName}`;
    const storagePath = `missions/${mission.id}/documents/${fileName}`;
    const storageRef = ref(storage, storagePath);

    try {
      console.log('📤 Upload du fichier:', { storagePath, fileName });

      // Upload du fichier vers Storage
      await uploadBytes(storageRef, file);
      console.log('✅ Fichier uploadé avec succès');
      
      const fileUrl = await getDownloadURL(storageRef);
      console.log('✅ URL récupérée:', fileUrl);

      // Déterminer le documentType en fonction de la catégorie
      let documentType: DocumentType = 'proposition_commerciale';
      if (category === 'contrats') {
        documentType = 'convention_etudiant';
      } else if (category === 'facturation') {
        documentType = 'facture';
      }

      // Créer le document dans Firestore
      const newDocumentData: Omit<GeneratedDocument, 'id'> = {
        missionId: mission.id,
        missionNumber: mission.numeroMission || '',
        missionTitle: mission.title || '',
        structureId: mission.structureId || '',
        documentType,
        fileName: file.name,
        fileUrl,
        fileSize: file.size,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: currentUser?.uid || '',
        createdByName: getSafeDisplayName(userData),
        status: 'final',
        isValid: true,
        tags: [],
        category,
        isUploaded: true
      };

      // Ajouter les champs pour les factures
      if (uploadDialog.isInvoice) {
        newDocumentData.isInvoice = true;
        newDocumentData.invoiceSentDate = new Date(uploadDialog.invoiceSentDate);
        newDocumentData.invoiceDueDate = new Date(uploadDialog.invoiceDueDate);
        newDocumentData.invoiceAmount = parseFloat(uploadDialog.invoiceAmount) || 0;
      }

      // Ajouter les champs optionnels s'ils existent
      if (userData?.photoURL) {
        newDocumentData.createdByPhotoURL = userData.photoURL;
      }

      // Sauvegarder dans Firestore
      const newDocRef = await addDoc(collection(db, 'generatedDocuments'), newDocumentData);
      const newDocument: GeneratedDocument = { id: newDocRef.id, ...newDocumentData };

      // Mettre à jour l'état local
      setGeneratedDocuments(prev => [newDocument, ...prev]);

      // Fermer le dialog
      setUploadDialog({
        open: false,
        category: 'autres',
        file: null,
        isDragging: false,
        isInvoice: false,
        invoiceSentDate: new Date().toISOString().split('T')[0],
        invoiceDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        invoiceAmount: '0.00'
      });

      enqueueSnackbar('Document uploadé avec succès', { variant: 'success' });
    } catch (error: any) {
      console.error('Erreur lors de l\'upload du document:', error);
      
      let errorMessage = 'Erreur lors de l\'upload du document';
      
      if (error.code === 'storage/unauthorized') {
        errorMessage = 'Vous n\'avez pas les permissions pour uploader un document sur cette mission. Vérifiez que vous faites partie de la même structure.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      enqueueSnackbar(errorMessage, { variant: 'error', autoHideDuration: 6000 });
    }
  };

  // Ajouter ces fonctions avant le return
  const handleOpenWorkingHours = async (application: Application) => {
    // Trouver la dernière date enregistrée
    let defaultDate = new Date();
    if (application.workingHours && application.workingHours.length > 0) {
      // Trier les dates par ordre décroissant
      const sortedDates = application.workingHours
        .map(wh => new Date(wh.date))
        .sort((a, b) => b.getTime() - a.getTime());
      
      // Prendre la dernière date et ajouter un jour
      const lastDate = sortedDates[0];
      defaultDate = new Date(lastDate);
      defaultDate.setDate(defaultDate.getDate() + 1);
    } else if (mission?.startDate) {
      // Si pas de dates enregistrées, utiliser la date de début de mission
      defaultDate = new Date(mission.startDate);
    }

    const defaultStartTime = "08:00";
    
    const newWorkingHour = {
      id: `temp-${Date.now()}`, // ID temporaire
      date: defaultDate.toISOString().split('T')[0],
      startTime: defaultStartTime,
      endTime: "17:00",
      applicationId: application.id,
      breaks: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Mettre à jour l'état local uniquement
    setApplications(prev => prev.map(app => 
      app.id === application.id 
        ? { 
            ...app, 
            workingHours: [...(app.workingHours || []), newWorkingHour]
          }
        : app
    ));

    // Marquer comme non sauvegardé
    setUnsavedChanges(prev => ({
      ...prev,
      [application.id]: true
    }));
  };

  const persistApplicationWorkingHours = useCallback(
    async (application: Application, hours: WorkingHourEntry[]) => {
      if (!mission?.id) return;

      const workingHoursRef = collection(db, 'workingHours');
      const existing = await getDocs(
        query(workingHoursRef, where('applicationId', '==', application.id))
      );

      const batch = writeBatch(db);
      existing.docs.forEach((docSnap) => batch.delete(docSnap.ref));

      if (hours.length > 0) {
        const newDocRef = doc(workingHoursRef);
        batch.set(newDocRef, {
          applicationId: application.id,
          userId: application.userId,
          missionId: mission.id,
          hours: hours.map(({ date, startTime, endTime, breaks }) => ({
            date,
            startTime,
            endTime,
            breaks: breaks || [],
          })),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      await batch.commit();
    },
    [mission?.id]
  );

  const handleCloseWorkingHours = () => {
    setWorkingHoursDialog({
      open: false,
      application: null
    });
    setNewWorkingHour({
      date: '',
      startTime: '',
      endTime: ''
    });
  };

  const handleAddWorkingHour = async (applicationId: string) => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible d\'ajouter des plages horaires à une mission archivée', { variant: 'error' });
      return;
    }
    if (!newWorkingHour.date || !newWorkingHour.startTime || !newWorkingHour.endTime) return;

    const application =
      applications.find((app) => app.id === applicationId) || workingHoursDialog.application;
    if (!application) return;

    try {
      setSavingWorkingHours((prev) => ({ ...prev, [applicationId]: true }));

      const newEntry: WorkingHourEntry = {
        id: `temp_${Date.now()}`,
        date: newWorkingHour.date,
        startTime: newWorkingHour.startTime,
        endTime: newWorkingHour.endTime,
        breaks: [],
      };
      const updatedHours = [...(application.workingHours || []), newEntry];

      await persistApplicationWorkingHours(application, updatedHours);

      const hoursMap = await fetchWorkingHoursForApplications([applicationId]);
      const persistedHours = hoursMap.get(applicationId) || updatedHours;

      setApplications((prev) =>
        prev.map((app) => (app.id === applicationId ? { ...app, workingHours: persistedHours } : app))
      );
      setWorkingHoursDialog((prev) =>
        prev.application?.id === applicationId
          ? { ...prev, application: { ...prev.application, workingHours: persistedHours } }
          : prev
      );

      setNewWorkingHour({ date: '', startTime: '', endTime: '' });
      setUnsavedChanges((prev) => ({ ...prev, [applicationId]: false }));
      enqueueSnackbar('Horaires ajoutés avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de l\'ajout des horaires:', error);
      enqueueSnackbar('Erreur lors de l\'ajout des horaires', { variant: 'error' });
    } finally {
      setSavingWorkingHours((prev) => ({ ...prev, [applicationId]: false }));
    }
  };

  const handleDeleteWorkingHour = async (workingHourId: string) => {
    const application =
      applications.find((app) => app.workingHours?.some((wh) => wh.id === workingHourId)) ||
      workingHoursDialog.application;
    if (!application) return;

    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de modifier les heures de travail pour une mission archivée', { variant: 'error' });
      return;
    }

    try {
      setSavingWorkingHours((prev) => ({ ...prev, [application.id]: true }));

      const updatedHours = (application.workingHours || []).filter((wh) => wh.id !== workingHourId);
      await persistApplicationWorkingHours(application, updatedHours);

      setApplications((prev) =>
        prev.map((app) =>
          app.id === application.id ? { ...app, workingHours: updatedHours } : app
        )
      );
      setWorkingHoursDialog((prev) =>
        prev.application?.id === application.id
          ? { ...prev, application: { ...prev.application, workingHours: updatedHours } }
          : prev
      );
      setUnsavedChanges((prev) => ({ ...prev, [application.id]: false }));
      enqueueSnackbar('Horaire supprimé', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de la suppression des horaires:', error);
      enqueueSnackbar('Erreur lors de la suppression des horaires', { variant: 'error' });
    } finally {
      setSavingWorkingHours((prev) => ({ ...prev, [application.id]: false }));
    }
  };

  const handleUpdateWorkingHour = async (id: string, field: string, value: string) => {
    // Mise à jour uniquement de l'état local
    setApplications(prev => prev.map(app => ({
      ...app,
      workingHours: app.workingHours?.map(wh => 
        wh.id === id ? { ...wh, [field]: value } : wh
      )
    })));

    // Marquer les changements non sauvegardés
    const application = applications.find(app => 
      app.workingHours?.some(wh => wh.id === id)
    );
    if (application) {
      setUnsavedChanges(prev => ({
        ...prev,
        [application.id]: true
      }));
    }
  };

  const calculateWorkingHours = (startTime: string, endTime: string, breaks: { start: string, end: string }[] = []) => {
    const start = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);
    
    let totalMinutes = (end.getTime() - start.getTime()) / 1000 / 60;
    
    // Soustraire les pauses
    breaks.forEach(breakTime => {
      const breakStart = new Date(`1970-01-01T${breakTime.start}`);
      const breakEnd = new Date(`1970-01-01T${breakTime.end}`);
      const breakMinutes = (breakEnd.getTime() - breakStart.getTime()) / 1000 / 60;
      totalMinutes -= breakMinutes;
    });
    
    return totalMinutes / 60; // Convertir en heures
  };

  const handleAddBreak = async (workingHourId: string) => {
    const defaultBreak = {
      start: "12:00",
      end: "13:00"
    };

    // Mise à jour uniquement de l'état local
    setApplications(prev => prev.map(app => ({
      ...app,
      workingHours: app.workingHours?.map(wh => 
        wh.id === workingHourId 
          ? { ...wh, breaks: [...(wh.breaks || []), defaultBreak] }
          : wh
      )
    })));

    // Marquer les changements comme non sauvegardés
    const application = applications.find(app => 
      app.workingHours?.some(wh => wh.id === workingHourId)
    );
    if (application) {
      setUnsavedChanges(prev => ({
        ...prev,
        [application.id]: true
      }));
    }
  };

  const handleUpdateBreak = (workingHourId: string, breakIndex: number, field: 'start' | 'end', value: string) => {
    // Mise à jour uniquement de l'état local
    setApplications(prev => prev.map(app => ({
      ...app,
      workingHours: app.workingHours?.map(wh => 
        wh.id === workingHourId 
          ? {
              ...wh,
              breaks: wh.breaks?.map((breakItem, idx) =>
                idx === breakIndex
                  ? { ...breakItem, [field]: value }
                  : breakItem
              ) || []
            }
          : wh
      )
    })));

    // Marquer les changements comme non sauvegardés
    const application = applications.find(app => 
      app.workingHours?.some(wh => wh.id === workingHourId)
    );
    if (application) {
      setUnsavedChanges(prev => ({
        ...prev,
        [application.id]: true
      }));
    }
  };

  const handleDeleteBreak = (workingHourId: string, breakIndex: number) => {
    // Mise à jour uniquement de l'état local
    setApplications(prev => prev.map(app => ({
      ...app,
      workingHours: app.workingHours?.map(wh => 
        wh.id === workingHourId 
          ? {
              ...wh,
              breaks: wh.breaks?.filter((_, idx) => idx !== breakIndex) || []
            }
          : wh
      )
    })));

    // Marquer les changements comme non sauvegardés
    const application = applications.find(app => 
      app.workingHours?.some(wh => wh.id === workingHourId)
    );
    if (application) {
      setUnsavedChanges(prev => ({
        ...prev,
        [application.id]: true
      }));
    }
  };

  const handleSaveWorkingHours = async (application: Application) => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de modifier les heures de travail pour une mission archivée', { variant: 'error' });
      return;
    }
    try {
      if (!application.workingHours || !mission) return;

      setSavingWorkingHours(prev => ({ ...prev, [application.id]: true }));
      await persistApplicationWorkingHours(application, application.workingHours);

      setUnsavedChanges(prev => ({
        ...prev,
        [application.id]: false
      }));
      
      enqueueSnackbar("Horaires enregistrés avec succès", { variant: "success" });
    } catch (error) {
      console.error("Erreur lors de l'enregistrement des horaires:", error);
      enqueueSnackbar("Erreur lors de l'enregistrement des horaires", { variant: "error" });
    } finally {
      setSavingWorkingHours(prev => ({ ...prev, [application.id]: false }));
    }
  };

  const handleUpdateExpenseStatus = async (expenseId: string, newStatus: 'Validée' | 'Refusée') => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de modifier le statut d\'une note de frais d\'une mission archivée', { variant: 'error' });
      return;
    }
    try {
      const expenseRef = doc(db, 'expenseNotes', expenseId);
      await updateDoc(expenseRef, {
        status: newStatus,
        updatedAt: new Date()
      });

      // Mettre à jour l'état local
      setExpenseNotes(prev => prev.map(note => 
        note.id === expenseId 
          ? { ...note, status: newStatus, updatedAt: new Date() }
          : note
      ));

      // Notification in-app + email gérées par Cloud Function onExpenseNoteWrite

      enqueueSnackbar(`Note de frais ${newStatus.toLowerCase()}`, { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      enqueueSnackbar('Erreur lors de la mise à jour du statut', { variant: 'error' });
    }
  };

  const handlePreview = (url: string) => {
    setPreviewUrl(url);
    setOpenPreview(true);
  };

  // Modifier la gestion du clic sur le menu pour vérifier d'abord si un template existe
  const handleGenerateExpenseDocument = async (note: ExpenseNote) => {
    try {
      if (!mission?.structureId) {
        enqueueSnackbar('Erreur : Structure non trouvée', { variant: 'error' });
        return;
      }

      // Récupérer l'application correspondante pour obtenir le nom de l'étudiant
      const application = applications.find(app => app.userId === note.userId);
      if (!application) {
        enqueueSnackbar('Erreur : Étudiant non trouvé', { variant: 'error' });
        return;
      }

      // Extraire le nom de famille (dernier mot du nom complet)
      const nomFamille = application.userDisplayName?.split(' ').pop()?.toUpperCase() || 'INCONNU';

      // Vérifier si un template est assigné
      const assignmentsRef = collection(db, 'templateAssignments');
      const assignmentQuery = query(
        assignmentsRef,
        where('documentType', '==', 'note_de_frais'),
        where('structureId', '==', mission.structureId)
      );
      
      const assignmentSnapshot = await getDocs(assignmentQuery);
      
      if (assignmentSnapshot.empty) {
        enqueueSnackbar(
          'Aucun template de note de frais n\'est assigné. Veuillez en assigner un dans les paramètres.',
          { 
            variant: 'warning',
            action: (
              <Button 
                color="inherit" 
                size="small"
                onClick={() => navigate('/app/settings/template-assignment')}
              >
                Assigner un template
              </Button>
            )
          }
        );
        return;
      }

      // Vérifier si le template existe toujours
      const assignmentData = assignmentSnapshot.docs[0].data();
      const templateRef = doc(db, 'templates', assignmentData.templateId);
      const templateDoc = await getDoc(templateRef);

      if (!templateDoc.exists()) {
        enqueueSnackbar(
          'Le template assigné n\'existe plus. Veuillez en assigner un nouveau.',
          { 
            variant: 'error',
            action: (
              <Button 
                color="inherit" 
                size="small"
                onClick={() => navigate('/app/settings/template-assignment')}
              >
                Assigner un template
              </Button>
            )
          }
        );
        return;
      }

      // Générer le document avec le nom formaté
      const fileName = `NF_${nomFamille}_${mission.numeroMission}.pdf`;
      await generateDocument('note_de_frais', undefined, note);
      
      enqueueSnackbar('Document de note de frais généré avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de la génération de la note de frais:', error);
      enqueueSnackbar(
        'Erreur lors de la génération de la note de frais. Veuillez réessayer.',
        { variant: 'error' }
      );
    }
  };

  const handleExpenseMenuOpen = (event: React.MouseEvent<HTMLButtonElement>, note: ExpenseNote) => {
    event.stopPropagation();
    setExpenseMenuAnchor({
      element: event.currentTarget,
      note
    });
  };

  const handleExpenseMenuClose = () => {
    setExpenseMenuAnchor({
      element: null,
      note: null
    });
  };

  const handleInvalidateExpense = async (expenseId: string) => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de modifier une note de frais d\'une mission archivée', { variant: 'error' });
      return;
    }
    try {
      const expenseRef = doc(db, 'expenseNotes', expenseId);
      await updateDoc(expenseRef, {
        status: 'En attente',
        updatedAt: new Date()
      });

      // Mettre à jour l'état local
      setExpenseNotes(prev => prev.map(note => 
        note.id === expenseId 
          ? { ...note, status: 'En attente', updatedAt: new Date() }
          : note
      ));

      enqueueSnackbar('Note de frais dévalidée', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de la dévalidation:', error);
      enqueueSnackbar('Erreur lors de la dévalidation', { variant: 'error' });
    }
  };

  const handleDeleteMission = async () => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de supprimer une mission archivée', { variant: 'error' });
      return;
    }
    try {
      setIsDeleting(true);

      // Vérifier si cette mission a été convertie depuis un salon ambassadeur
      let isConvertedFromAmbassadorEvent = false;
      let originalEventId: string | null = null;
      
      // Chercher un événement ambassadeur qui a ce convertedMissionId
      const ambassadorEventsQuery = query(
        collection(db, 'missions'),
        where('type', '==', 'ambassadeur_event')
      );
      const ambassadorEventsSnapshot = await getDocs(ambassadorEventsQuery);
      
      for (const eventDoc of ambassadorEventsSnapshot.docs) {
        const eventData = eventDoc.data();
        const convertedMissionId = (eventData as any).convertedMissionId;
        if (convertedMissionId === mission.id) {
          isConvertedFromAmbassadorEvent = true;
          originalEventId = eventDoc.id;
          break;
        }
      }
      
      // Si pas trouvé via convertedMissionId, chercher par titre (pour les conversions anciennes)
      if (!isConvertedFromAmbassadorEvent && mission.title) {
        for (const eventDoc of ambassadorEventsSnapshot.docs) {
          const eventData = eventDoc.data();
          const eventTitle = eventData.title || eventData.campaignName;
          if (eventTitle === mission.title && eventData.type === 'ambassadeur_event') {
            isConvertedFromAmbassadorEvent = true;
            originalEventId = eventDoc.id;
            break;
          }
        }
      }

      // 1. Récupérer toutes les applications liées à la mission
      const applicationsRef = collection(db, 'applications');
      const applicationsQuery = query(applicationsRef, where('missionId', '==', mission.id));
      const applicationsSnapshot = await getDocs(applicationsQuery);

      // 2. Récupérer tous les documents générés liés à la mission
      const documentsRef = collection(db, 'generatedDocuments');
      const documentsQuery = query(documentsRef, where('missionId', '==', mission.id));
      const documentsSnapshot = await getDocs(documentsQuery);

      // 3. Récupérer toutes les notes liées à la mission
      const notesRef = collection(db, 'notes');
      const notesQuery = query(notesRef, where('missionId', '==', mission.id));
      const notesSnapshot = await getDocs(notesQuery);

      // 4. Récupérer toutes les notes de frais liées à la mission
      const expenseNotesRef = collection(db, 'expenseNotes');
      const expenseNotesQuery = query(expenseNotesRef, where('missionId', '==', mission.id));
      const expenseNotesSnapshot = await getDocs(expenseNotesQuery);

      // 5. Récupérer tous les horaires de travail liés aux applications
      const workingHoursPromises = applicationsSnapshot.docs.map(async (appDoc) => {
        const workingHoursRef = collection(db, 'workingHours');
        const workingHoursQuery = query(workingHoursRef, where('applicationId', '==', appDoc.id));
        return getDocs(workingHoursQuery);
      });
      const workingHoursSnapshots = await Promise.all(workingHoursPromises);

      // Supprimer tous les fichiers du storage
      const deleteStorageFiles = async () => {
        for (const doc of documentsSnapshot.docs) {
          const data = doc.data();
          if (data.fileUrl) {
            try {
              const fileRef = ref(storage, data.fileUrl);
              await deleteObject(fileRef);
            } catch (error) {
              console.error('Erreur lors de la suppression du fichier:', error);
            }
          }
        }

        // Supprimer les pièces jointes des notes de frais
        for (const note of expenseNotesSnapshot.docs) {
          const data = note.data();
          if (data.attachmentUrl) {
            try {
              const fileRef = ref(storage, data.attachmentUrl);
              await deleteObject(fileRef);
            } catch (error) {
              console.error('Erreur lors de la suppression de la pièce jointe:', error);
            }
          }
        }
      };

      // Supprimer tous les documents de Firestore
      const deleteFirestoreDocuments = async () => {
        const batch = writeBatch(db);

        // Supprimer la mission
        batch.delete(doc(db, 'missions', mission.id));

        // Supprimer les applications seulement si la mission n'a pas été convertie depuis un salon ambassadeur
        // Si elle a été convertie, les candidatures doivent rester liées au salon original
        if (!isConvertedFromAmbassadorEvent) {
          applicationsSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
          });
        } else {
          // Si la mission a été convertie depuis un salon, mettre à jour les candidatures pour les relier au salon original
          if (originalEventId) {
            applicationsSnapshot.docs.forEach((appDoc) => {
              batch.update(appDoc.ref, {
                missionId: originalEventId,
                updatedAt: new Date()
              });
            });
          }
        }

        // Supprimer les documents générés
        documentsSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        // Supprimer les notes
        notesSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        // Supprimer les notes de frais
        expenseNotesSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        // Supprimer les horaires de travail
        workingHoursSnapshots.forEach((snapshot) => {
          snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
          });
        });

        await batch.commit();
      };

      // Exécuter les suppressions en parallèle
      await Promise.all([
        deleteStorageFiles(),
        deleteFirestoreDocuments()
      ]);
      
      // Rediriger vers la liste des missions
      navigate('/app/mission');
      
      enqueueSnackbar('Mission et données associées supprimées avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de la suppression de la mission:', error);
      enqueueSnackbar('Erreur lors de la suppression de la mission', { variant: 'error' });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const generateNextMissionNumber = async (structureId: string): Promise<string> => {
    const now = new Date();
    const yearStr = now.getFullYear().toString().slice(-2);
    const monthStr = (now.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `${yearStr}${monthStr}`;

    try {
      const missionsSnapshot = await getDocs(
        query(collection(db, 'missions'), where('structureId', '==', structureId))
      );
      const sequences = missionsSnapshot.docs
        .map((d) => d.data().numeroMission as string)
        .filter((n) => n && n.length === 6 && n.startsWith(prefix))
        .map((n) => parseInt(n.slice(-2), 10))
        .filter((n) => !Number.isNaN(n) && n > 0)
        .sort((a, b) => b - a);
      const next = sequences.length > 0 ? sequences[0] + 1 : 1;
      return `${prefix}${next.toString().padStart(2, '0')}`;
    } catch {
      return `${prefix}01`;
    }
  };

  const handleDuplicateMission = async () => {
    if (!mission || !currentUser) return;
    if (!mission.structureId) {
      enqueueSnackbar('Impossible de dupliquer : structure manquante', { variant: 'error' });
      return;
    }

    try {
      enqueueSnackbar('Duplication en cours…', { variant: 'info' });
      const numeroMission = await generateNextMissionNumber(mission.structureId);

      const duplicated: Record<string, unknown> = {
        numeroMission,
        structureId: mission.structureId,
        companyId: mission.companyId || '',
        company: mission.company || '',
        location: mission.location || '',
        startDate: mission.startDate || '',
        endDate: mission.endDate || '',
        description: mission.description || '',
        missionTypeId: mission.missionTypeId || null,
        studentCount: mission.studentCount || 0,
        hoursPerStudent: mission.hoursPerStudent || '',
        chargeId: mission.chargeId || currentUser.uid,
        chargeName: mission.chargeName || '',
        title: mission.title ? `${mission.title} (copie)` : `Copie de ${mission.numeroMission}`,
        salary: mission.salary || '10',
        hours: mission.hours || 0,
        requiresCV: mission.requiresCV ?? false,
        requiresMotivation: mission.requiresMotivation ?? false,
        isPublished: false,
        isPublic: false,
        priceHT: mission.priceHT || 0,
        totalHT: mission.totalHT || 0,
        totalTTC: mission.totalTTC || 0,
        tva: mission.tva ?? 20,
        ecole: mission.ecole || null,
        contactId: mission.contactId || null,
        contact: mission.contact || null,
        mandat: mission.mandat || null,
        status: 'En attente',
        etape: 'Négociation' as MissionEtape,
        isArchived: false,
        createdAt: new Date(),
        createdBy: currentUser.uid,
        updatedAt: new Date(),
      };

      // Retirer les null Firestore-inutiles pour rester cohérent
      Object.keys(duplicated).forEach((key) => {
        if (duplicated[key] === null || duplicated[key] === undefined) {
          delete duplicated[key];
        }
      });

      const docRef = await addDoc(collection(db, 'missions'), duplicated);
      enqueueSnackbar(`Mission ${numeroMission} créée`, { variant: 'success' });
      navigate(`/app/mission/${docRef.id}`);
    } catch (error) {
      console.error('Erreur lors de la duplication de la mission:', error);
      enqueueSnackbar('Erreur lors de la duplication de la mission', { variant: 'error' });
    }
  };

  // Ajouter cet effet pour charger le hourlyRate de la structure
  useEffect(() => {
    const fetchStructureHourlyRate = async () => {
      if (!mission?.structureId) return;

      try {
        const structureDoc = await getDoc(doc(db, 'structures', mission.structureId));
        if (structureDoc.exists()) {
          const structureData = structureDoc.data();
          if (structureData.hourlyRate && !mission.priceHT) {
            setPriceHT(structureData.hourlyRate);
            if (mission.hours) {
              const totalHT = structureData.hourlyRate * mission.hours;
              const totalTTC = totalHT * 1.2;
              setTotalHT(totalHT);
              setTotalTTC(totalTTC);
            }
          }
        }
      } catch (error) {
        console.error("Erreur lors de la récupération du taux horaire:", error);
      }
    };

    fetchStructureHourlyRate();
  }, [mission?.structureId, mission?.hours, mission?.priceHT]);

  const fetchContacts = async (companyId: string) => {
    try {
      const contactsQuery = query(
        collection(db, 'contacts'),
        where('companyId', '==', companyId)
      );
      const snapshot = await getDocs(contactsQuery);
      let contactsData = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt || 0)
        } as Contact;
      });

      const isEncrypted = (v: any) => typeof v === 'string' && v.startsWith('ENC:');
      const needsDecrypt = contactsData.some((c: any) => isEncrypted(c.email) || isEncrypted(c.phone));
      if (needsDecrypt) {
        const decryptContactDataForStructure = httpsCallable(getAppFunctions(), 'decryptContactDataForStructure');
        contactsData = await Promise.all(contactsData.map(async (contact: any) => {
          if (!isEncrypted(contact.email) && !isEncrypted(contact.phone)) return contact;
          try {
            const result = await decryptContactDataForStructure({ contactId: contact.id });
            const dec = (result.data as any)?.decryptedData;
            if (!dec) return contact;
            return {
              ...contact,
              email: (dec.email && !isEncrypted(dec.email) ? dec.email : contact.email) ?? contact.email,
              phone: (dec.phone && !isEncrypted(dec.phone) ? dec.phone : contact.phone) ?? contact.phone
            };
          } catch (e) {
            console.warn('Décryptage contact ignoré:', contact.id, e);
            return contact;
          }
        }));
      }
      setContacts(contactsData);
    } catch (error) {
      console.error("Erreur lors de la récupération des contacts:", error);
      enqueueSnackbar("Erreur lors de la récupération des contacts", { variant: 'error' });
    }
  };

  const handleContactChange = async (contactId: string) => {
    if (!mission) return;
    
    try {
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) return;

      const missionRef = doc(db, 'missions', mission.id);
      await updateDoc(missionRef, {
        contactId: contactId,
        contact: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          position: contact.position
        },
        updatedAt: new Date()
      });

      setMission(prev => prev ? { 
        ...prev, 
        contactId, 
        contact: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          position: contact.position
        }
      } : null);
      enqueueSnackbar("Contact mis à jour avec succès", { variant: 'success' });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du contact:", error);
      enqueueSnackbar("Erreur lors de la mise à jour du contact", { variant: 'error' });
    }
  };

  useEffect(() => {
    if (mission?.companyId) {
      fetchContacts(mission.companyId);
    }
  }, [mission?.companyId]);

  const handleAddExpense = async () => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible d\'ajouter une note de frais à une mission archivée', { variant: 'error' });
      return;
    }
    if (!mission?.id) return;
    
    try {
      const newExpenseRef = await addDoc(collection(db, 'expenseNotes'), {
        missionId: mission.id,
        userId: newExpense.userId,
        amount: newExpense.amount,
        description: newExpense.description,
        date: new Date(newExpense.date),
        status: 'En attente' as const,
        attachmentUrl: newExpense.attachmentUrl,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const newExpenseData: ExpenseNote = {
        id: newExpenseRef.id,
        missionId: mission.id,
        userId: newExpense.userId,
        amount: newExpense.amount,
        description: newExpense.description,
        date: new Date(newExpense.date),
        status: 'En attente',
        attachmentUrl: newExpense.attachmentUrl,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      setExpenseNotes(prev => [...prev, newExpenseData]);

      setNewExpense({
        userId: '',
        description: '',
        amount: 0,
        date: '',
        attachmentUrl: ''
      });

      setOpenAddExpenseDialog(false);
      enqueueSnackbar('Note de frais ajoutée avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la note de frais:', error);
      enqueueSnackbar('Erreur lors de l\'ajout de la note de frais', { variant: 'error' });
    }
  };

  const handleExpenseFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !mission?.id || !currentUser?.uid) return;

    try {
      const storageRef = ref(storage, `expenses/${currentUser.uid}/${mission.id}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setNewExpense(prev => ({ ...prev, attachmentUrl: url }));
      enqueueSnackbar('Fichier ajouté avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de l\'upload du fichier:', error);
      enqueueSnackbar('Erreur lors de l\'upload du fichier', { variant: 'error' });
    }
  };

  const handleEtapeChange = async (newEtape: MissionEtape) => {
    if (mission) {
      try {
        const missionRef = doc(db, 'missions', mission.id);
        await updateDoc(missionRef, {
          etape: newEtape,
          updatedAt: new Date()
        });
        setMission(prev => prev ? { ...prev, etape: newEtape } : null);
        setEditedMission(prev => prev ? { ...prev, etape: newEtape } : null);
      } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'étape:', error);
        enqueueSnackbar('Erreur lors de la mise à jour de l\'étape', { variant: 'error' });
      }
    }
  };

  useEffect(() => {
    const fetchMissionTypes = async () => {
      try {
        const missionTypesRef = collection(db, 'missionTypes');
        const q = query(missionTypesRef, where('structureId', '==', mission.structureId));
        const querySnapshot = await getDocs(q);
        const types = querySnapshot.docs.map(doc => ({
          id: doc.id,
          title: doc.data().title
        }));
        setMissionTypes(types);
      } catch (error) {
        console.error('Erreur lors de la récupération des types de mission:', error);
      }
    };

    if (mission?.structureId) {
      fetchMissionTypes();
    }
  }, [mission?.structureId]);

  const handleCreateMissionType = async () => {
    if (!mission?.structureId || !newMissionType.title.trim()) return;

    try {
      const missionTypeRef = collection(db, 'missionTypes');
      const newMissionTypeData = {
        title: newMissionType.title,
        structureId: mission.structureId,
        studentProfile: newMissionType.studentProfile,
        courseApplication: newMissionType.courseApplication,
        missionLearning: newMissionType.missionLearning,
        createdAt: new Date(),
        createdBy: currentUser?.uid
      };

      const docRef = await addDoc(missionTypeRef, newMissionTypeData);
      
      // Mettre à jour la liste des types de mission
      setMissionTypes(prev => [...prev, { 
        id: docRef.id, 
        title: newMissionType.title,
        studentProfile: newMissionType.studentProfile,
        courseApplication: newMissionType.courseApplication,
        missionLearning: newMissionType.missionLearning
      }]);
      
      // Sélectionner automatiquement le nouveau type
      handleFieldChange('missionTypeId', docRef.id);
      
      setOpenNewMissionTypeDialog(false);
      setNewMissionType({ 
        title: '',
        studentProfile: '',
        courseApplication: '',
        missionLearning: ''
      });
      enqueueSnackbar('Type de mission créé avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de la création du type de mission:', error);
      enqueueSnackbar('Erreur lors de la création du type de mission', { variant: 'error' });
    }
  };

  const fetchAvenantTemplateOptions = async (structureId: string) => {
    const [structureSnap, universalSnap] = await Promise.all([
      getDocs(query(collection(db, 'templates'), where('structureId', '==', structureId))),
      getDocs(
        query(
          collection(db, 'templates'),
          where('isUniversal', '==', true),
          where('universalDocumentType', '==', 'avenant')
        )
      ),
    ]);

    const byId = new Map<string, { id: string; name: string }>();
    structureSnap.docs.forEach((d) => {
      byId.set(d.id, { id: d.id, name: (d.data().name as string) || 'Sans nom' });
    });
    universalSnap.docs.forEach((d) => {
      if (!byId.has(d.id)) {
        byId.set(d.id, { id: d.id, name: (d.data().name as string) || 'Sans nom' });
      }
    });
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  };

  const saveAvenantTemplateAssignment = async (structureId: string, templateId: string) => {
    const existingQuery = query(
      collection(db, 'templateAssignments'),
      where('structureId', '==', structureId),
      where('documentType', '==', 'avenant')
    );
    const existingSnap = await getDocs(existingQuery);
    await Promise.all(
      existingSnap.docs
        .filter((d) => d.id !== `${structureId}_avenant`)
        .map((d) => deleteDoc(d.ref))
    );

    const templateDoc = await getDoc(doc(db, 'templates', templateId));
    const templateData = templateDoc.data() || {};

    await setDoc(doc(db, 'templateAssignments', `${structureId}_avenant`), {
      structureId,
      documentType: 'avenant',
      templateId,
      isUniversal: !!templateData.isUniversal,
      universalDocumentType: templateData.universalDocumentType || null,
      generationType: 'template',
      updatedAt: new Date(),
    });

    assignedTemplateCacheRef.current.delete(`${structureId}_avenant`);
  };

  // Fonctions pour gérer la popup de données manquantes
  const handleDocumentGenerateRequest = async (documentType: DocumentType) => {
    if (documentType === 'lettre_mission') {
      if (applications.length === 0) {
        enqueueSnackbar('Aucun candidat sur cette mission — impossible de générer une LM', {
          variant: 'warning',
        });
        return;
      }
      setLmDialogOpen(true);
      return;
    }

    if (documentType === 'avenant') {
      if (!mission?.structureId) return;
      setAvenantDialog({
        open: true,
        step: 'setup',
        selectedApplicationId: null,
        templateTags: [],
        checkingMissing: false,
        templateName: null,
        templateId: null,
        templateOptions: [],
        templateLoading: true,
        templateSaving: false,
        templateMissing: false,
      });
      setTempData({});
      try {
        const [template, optionsRaw] = await Promise.all([
          getAssignedTemplate('avenant'),
          fetchAvenantTemplateOptions(mission.structureId),
        ]);
        let options = optionsRaw;
        if (template?.id && !options.some((o) => o.id === template.id)) {
          options = [{ id: template.id, name: template.name || 'Template assigné' }, ...options];
        }
        const resolvedId = template?.id || options[0]?.id || null;
        setAvenantDialog((prev) => ({
          ...prev,
          open: true,
          templateName: template?.name || options.find((o) => o.id === resolvedId)?.name || null,
          templateId: resolvedId,
          templateOptions: options,
          templateLoading: false,
          templateSaving: false,
          templateMissing: options.length === 0,
        }));
      } catch {
        setAvenantDialog((prev) => ({
          ...prev,
          open: true,
          templateLoading: false,
          templateSaving: false,
          templateMissing: true,
        }));
      }
      return;
    }
    void generateDocument(documentType);
  };

  const handleCloseLmDialog = () => {
    if (generatingDocType === 'lettre_mission') return;
    setLmDialogOpen(false);
  };

  /** Préremplissage signature : client/étudiant + structure (ordre = zones préconfigurées) */
  const signatureDefaultSigners = useMemo(() => {
    const selected = documentDialogs.selectedDocument;
    if (!selected) return undefined;

    const isDualSignerDoc = (
      ['proposition_commerciale', 'lettre_mission', 'avenant'] as string[]
    ).includes(selected.documentType);

    const structureFirstName = (userData?.firstName || '').trim();
    const structureLastName = (userData?.lastName || '').trim();
    const structureEmail = (userData?.email || currentUser?.email || '').trim();
    const structureName =
      `${structureFirstName} ${structureLastName}`.trim() ||
      getSafeDisplayName(userData, structureEmail);
    const structureSigner = {
      firstName: structureFirstName,
      lastName: structureLastName,
      email: structureEmail,
      name: structureName,
      role: 'structure' as const,
    };

    if (selected.documentType === 'proposition_commerciale') {
      const contact = mission?.contact;
      const firstName = (contact?.firstName || '').trim();
      const lastName = (contact?.lastName || '').trim();
      const email = (contact?.email || '').trim();
      const name = `${firstName} ${lastName}`.trim();
      const counterparty = {
        firstName,
        lastName,
        email,
        name,
        role: 'counterparty' as const,
      };
      return isDualSignerDoc ? [counterparty, structureSigner] : [counterparty];
    }

    const app =
      (selected.applicationId
        ? applications.find((a) => a.id === selected.applicationId)
        : undefined) ||
      (selected.applicationUserEmail
        ? applications.find((a) => a.userEmail === selected.applicationUserEmail)
        : undefined);

    const displayName = (app?.userDisplayName || selected.applicationUserName || '').trim();
    const email = (app?.userEmail || selected.applicationUserEmail || '').trim();
    if (!displayName && !email && !isDualSignerDoc) return undefined;

    const parts = displayName.split(/\s+/).filter(Boolean);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ');
    const counterparty = {
      firstName,
      lastName,
      email,
      name: displayName,
      role: 'counterparty' as const,
    };

    return isDualSignerDoc ? [counterparty, structureSigner] : [counterparty];
  }, [
    documentDialogs.selectedDocument,
    applications,
    mission?.contact,
    userData,
    currentUser?.email,
  ]);

  const handleLmGenerate = async (applicationId: string) => {
    const application = applications.find((app) => app.id === applicationId);
    if (!application || generatingDocType === 'lettre_mission') return;
    try {
      await generateDocument('lettre_mission', application);
    } catch (error) {
      console.error('Erreur génération lettre de mission:', error);
    } finally {
      setLmDialogOpen(false);
    }
  };

  const handleCloseAvenantDialog = () => {
    if (generatingDocType === 'avenant') return;
    setAvenantDialog({
      open: false,
      step: 'setup',
      selectedApplicationId: null,
      templateTags: [],
      checkingMissing: false,
      templateName: null,
      templateId: null,
      templateOptions: [],
      templateLoading: false,
      templateSaving: false,
      templateMissing: false,
    });
    setTempData({});
  };

  const handleAvenantTemplateChange = async (templateId: string) => {
    if (!mission?.structureId) return;
    const option = avenantDialog.templateOptions.find((o) => o.id === templateId);
    setAvenantDialog((prev) => ({
      ...prev,
      templateId,
      templateName: option?.name || prev.templateName,
      templateSaving: true,
    }));
    try {
      await saveAvenantTemplateAssignment(mission.structureId, templateId);
      enqueueSnackbar('Template avenant mis à jour', { variant: 'success' });
      if (avenantDialog.step === 'review' && avenantDialog.selectedApplicationId) {
        const application = applications.find((app) => app.id === avenantDialog.selectedApplicationId);
        if (application) {
          setAvenantDialog((prev) => ({ ...prev, checkingMissing: true }));
          const tags = await fetchTemplateTagsReview('avenant', application);
          setAvenantDialog((prev) => ({
            ...prev,
            checkingMissing: false,
            templateTags: tags,
          }));
        }
      }
    } catch (error) {
      console.error('Erreur assignation template avenant:', error);
      enqueueSnackbar('Impossible de changer le template', { variant: 'error' });
    } finally {
      setAvenantDialog((prev) => ({ ...prev, templateSaving: false }));
    }
  };

  const handleAvenantContinue = async (applicationId: string) => {
    const application = applications.find((app) => app.id === applicationId);
    if (!application) return;

    setAvenantDialog((prev) => ({
      ...prev,
      step: 'review',
      selectedApplicationId: applicationId,
      checkingMissing: true,
      templateTags: [],
    }));
    setTempData({});

    try {
      const tags = await fetchTemplateTagsReview('avenant', application);
      setAvenantDialog((prev) => ({
        ...prev,
        checkingMissing: false,
        templateTags: tags,
      }));
    } catch (error) {
      console.error('Erreur vérification balises avenant:', error);
      setAvenantDialog((prev) => ({ ...prev, checkingMissing: false, step: 'setup' }));
      enqueueSnackbar('Impossible de vérifier les balises du template', { variant: 'error' });
    }
  };

  const handleAvenantBack = () => {
    setAvenantDialog((prev) => ({
      ...prev,
      step: 'setup',
      selectedApplicationId: null,
      templateTags: [],
      checkingMissing: false,
    }));
    setTempData({});
  };

  const handleAvenantRefreshMissing = async () => {
    if (!avenantDialog.selectedApplicationId) return;
    const application = applications.find((app) => app.id === avenantDialog.selectedApplicationId);
    if (!application) return;

    setAvenantDialog((prev) => ({ ...prev, checkingMissing: true }));
    try {
      const tags = await fetchTemplateTagsReview('avenant', application);
      setAvenantDialog((prev) => ({
        ...prev,
        checkingMissing: false,
        templateTags: tags,
      }));
    } catch (error) {
      console.error('Erreur actualisation balises avenant:', error);
      setAvenantDialog((prev) => ({ ...prev, checkingMissing: false }));
      enqueueSnackbar('Impossible d\'actualiser les balises', { variant: 'error' });
    }
  };

  const patchAvenantTemplateTag = (tag: string, value: string) => {
    const trimmed = value.trim();
    const relatedTags =
      tag === 'amendment_new_hours' ||
      tag === 'amendment_actual_hours' ||
      tag === 'actualHours'
        ? new Set(['amendment_new_hours', 'amendment_actual_hours', 'actualHours'])
        : new Set([tag]);
    setAvenantDialog((prev) => ({
      ...prev,
      templateTags: prev.templateTags.map((item) =>
        relatedTags.has(item.tag) ? { ...item, value: trimmed, isMissing: !trimmed } : item
      ),
    }));
    setTempData((prev) => {
      const next = { ...prev };
      relatedTags.forEach((t) => delete next[t]);
      return next;
    });
  };

  const persistDocumentTagValue = async (
    tag: string,
    value: string,
    applicationForUser?: Application
  ): Promise<'application_override' | 'entity' | 'temp_only'> => {
    if (!mission) return 'temp_only';

    if (tag.startsWith('mission_')) {
      const field = tag.replace('mission_', '') as keyof Mission;
      await handleUpdateMission(mission.id, { [field]: value });
      return 'entity';
    }
    if (tag.startsWith('contact_')) {
      if (mission.contactId) {
        await updateDoc(doc(db, 'contacts', mission.contactId), {
          [tag.replace('contact_', '')]: value,
        });
      }
      return 'entity';
    }
    if (tag.startsWith('user_')) {
      if (applicationForUser?.userId) {
        const userDocRef = doc(db, 'users', applicationForUser.userId);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          await updateDoc(userDocRef, { [tag.replace('user_', '')]: value });
        } else {
          await setDoc(userDocRef, { [tag.replace('user_', '')]: value }, { merge: true });
        }
      }
      return 'entity';
    }
    if (tag.startsWith('structure_')) {
      if (tag === 'structure_president_nom_complet') {
        return 'temp_only';
      }
      if (mission.structureId) {
        await updateDoc(doc(db, 'structures', mission.structureId), {
          [tag.replace('structure_', '')]: value,
        });
      }
      return 'entity';
    }
    if (tag.startsWith('entreprise_')) {
      if (mission.companyId) {
        await updateDoc(doc(db, 'companies', mission.companyId), {
          [tag.replace('entreprise_', '')]: value,
        });
      }
      return 'entity';
    }
    if (tag.startsWith('charge_')) {
      const chargeDocRef = doc(db, 'users', mission.chargeId);
      const chargeDoc = await getDoc(chargeDocRef);
      if (chargeDoc.exists()) {
        await updateDoc(chargeDocRef, { [tag.replace('charge_', '')]: value });
      } else {
        await setDoc(chargeDocRef, { [tag.replace('charge_', '')]: value }, { merge: true });
      }
      return 'entity';
    }
    if (applicationForUser?.id) {
      await updateDoc(doc(db, 'applications', applicationForUser.id), {
        [`documentTagOverrides.${tag}`]: value,
        updatedAt: new Date(),
      });
      setApplications((prev) =>
        prev.map((app) =>
          app.id === applicationForUser.id
            ? {
                ...app,
                documentTagOverrides: { ...(app.documentTagOverrides ?? {}), [tag]: value },
              }
            : app
        )
      );
      return 'application_override';
    }
    return 'temp_only';
  };

  const handleAvenantSaveField = async (tag: string, value: string) => {
    const application = avenantDialog.selectedApplicationId
      ? applications.find((app) => app.id === avenantDialog.selectedApplicationId)
      : undefined;
    if (!application) return;

    try {
      const result = await persistDocumentTagValue(tag, value, application);
      patchAvenantTemplateTag(tag, value);
      enqueueSnackbar(
        result === 'temp_only' ? 'Valeur conservée pour cette génération' : 'Valeur enregistrée',
        { variant: result === 'temp_only' ? 'info' : 'success' }
      );
    } catch (error) {
      console.error('Erreur enregistrement balise avenant:', error);
      enqueueSnackbar('Erreur lors de l\'enregistrement', { variant: 'error' });
    }
  };

  const handleAvenantGenerate = async () => {
    const application = applications.find((app) => app.id === avenantDialog.selectedApplicationId);
    if (!application || generatingDocType === 'avenant') return;

    const effectiveTempData = avenantDialog.templateTags.reduce<Record<string, string>>((acc, item) => {
      acc[item.tag] = tempData[item.tag] !== undefined ? tempData[item.tag] : (item.value || '');
      return acc;
    }, {});
    const mergedTempData = {
      ...(application.documentTagOverrides ?? {}),
      ...effectiveTempData,
      ...tempData,
    };

    try {
      await generateDocument('avenant', application, undefined, true, false, mergedTempData);
      setAvenantDialog({
        open: false,
        step: 'setup',
        selectedApplicationId: null,
        templateTags: [],
        checkingMissing: false,
        templateName: null,
        templateId: null,
        templateOptions: [],
        templateLoading: false,
        templateSaving: false,
        templateMissing: false,
      });
      setTempData({});
    } catch (error) {
      console.error('Erreur génération avenant:', error);
    }
  };

  const handleCloseMissingDataDialog = () => {
    setMissingDataDialog({
      open: false,
      detecting: false,
      missingData: [],
      documentType: 'proposition_commerciale'
    });
    setGeneratingDocType(null);
  };

  const handleGenerateAnyway = async () => {
    console.log('🔄 Génération avec données manquantes...');
    const { documentType, application, expenseNote } = missingDataDialog;
    
    // Fermer la popup
    setMissingDataDialog({
      open: false,
      missingData: [],
      documentType: 'proposition_commerciale'
    });
    
    // Relancer la génération du document en ignorant les données manquantes
    console.log('🔄 Relance de la génération avec documentType:', documentType);
    // On passe ignoreMissingData = true pour ignorer les données manquantes
    await generateDocument(documentType, application, expenseNote, true);
  };

  const handleGenerateWithTempData = async () => {
    console.log('🔄 Génération avec données temporaires...');
    const { documentType, application, expenseNote } = missingDataDialog;
    
    // Fermer la popup
    setMissingDataDialog({
      open: false,
      missingData: [],
      documentType: 'proposition_commerciale'
    });
    
    // Relancer la génération du document avec les données temporaires
    console.log('🔄 Relance de la génération avec tempData:', tempData);
    // On passe ignoreMissingData = true pour ignorer les données manquantes
    await generateDocument(documentType, application, expenseNote, true);
  };

  const handleRefreshData = async () => {
    // Rafraîchir les données manquantes en recalculant la liste
    if (mission && missingDataDialog.open) {
      console.log('🔄 Rafraîchissement des données manquantes...');
      // Recréer la liste des données manquantes
      const newMissingData = await detectMissingData(
        missingDataDialog.documentType, 
        missingDataDialog.application, 
        missingDataDialog.expenseNote
      );
      
      // Mettre à jour la popup avec les nouvelles données manquantes
      setMissingDataDialog(prev => ({
        ...prev,
        missingData: newMissingData
      }));
      
      console.log('✅ Données manquantes rafraîchies');
    }
  };

  // Fonctions pour gérer l'édition des données manquantes
  const handleEditMissingData = (tag: string, value: string) => {
    setTempData(prev => ({
      ...prev,
      [tag]: value
    }));
  };

  const handleSaveMissingData = async (
    tag: string,
    value: string,
    applicationOverride?: Application
  ) => {
    if (!mission) return;

    const applicationForUser =
      applicationOverride ??
      missingDataDialog.application ??
      (avenantDialog.selectedApplicationId
        ? applications.find((app) => app.id === avenantDialog.selectedApplicationId)
        : undefined);

    try {
      await persistDocumentTagValue(tag, value, applicationForUser);

      setTempData((prev) => {
        const newTempData = { ...prev };
        delete newTempData[tag];
        return newTempData;
      });

      setMissingDataDialog((prev) => ({
        ...prev,
        missingData: prev.missingData.filter((item) => item.tag !== tag),
      }));
      await handleRefreshData();

      enqueueSnackbar('Donnée sauvegardée avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      enqueueSnackbar('Erreur lors de la sauvegarde', { variant: 'error' });
    }
  };

  const handleCancelMissingDataEdit = (tag: string) => {
    setTempData(prev => {
      const newTempData = { ...prev };
      delete newTempData[tag];
      return newTempData;
    });
  };

  // Ajout du composant juste après EditableField
  const EditableSelectField = forwardRef<any, {
    icon: React.ReactNode;
    label: string;
    field: string;
    initialValue: string;
    options: { value: string; label: string }[];
    mission: Mission | null;
    onUpdate: (missionId: string, data: Partial<Mission>) => Promise<void>;
    onFieldChange: (field: keyof Mission, value: string) => void;
    isGlobalEditing?: boolean;
  }>(
    ({ icon, label, field, initialValue, options, mission, onUpdate, onFieldChange, isGlobalEditing }, ref) => {
      const [localValue, setLocalValue] = useState(initialValue);
      const [isEditing, setIsEditing] = useState(false);

      useEffect(() => {
        if (!isGlobalEditing) {
          setLocalValue(initialValue);
        }
      }, [initialValue, isGlobalEditing]);

      useEffect(() => {
        setIsEditing(isGlobalEditing);
      }, [isGlobalEditing]);

      useImperativeHandle(ref, () => ({
        getValue: () => localValue,
        setValue: (value: string) => setLocalValue(value)
      }));

      return (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          mb: 2.5
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: '10px',
            backgroundColor: '#f5f5f7',
            color: '#1d1d1f'
          }}>
            {icon}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ 
              fontSize: '0.875rem', 
              color: '#86868b',
              mb: 0.5,
              letterSpacing: '-0.01em',
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
            }}>
              {label}
            </Typography>
            <TextField
              select
              fullWidth
              value={localValue}
              onChange={(e) => {
                setLocalValue(e.target.value);
                onFieldChange(field as keyof Mission, e.target.value);
              }}
              disabled={!isEditing}
              variant="outlined"
              size="small"
              sx={{ 
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  backgroundColor: isEditing ? '#f5f5f7' : 'transparent',
                  '& fieldset': { 
                    border: 'none' 
                  },
                  '&:hover fieldset': {
                    borderColor: 'transparent'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#007AFF',
                    borderWidth: '1px'
                  }
                }
              }}
            >
              {options.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </Box>
      );
    }
  );

  const isEtudiantViewer = userData?.status === 'etudiant';
  const studentCanViewMission =
    isEtudiantViewer &&
    !!mission &&
    !!userData?.structureId &&
    mission.structureId === userData.structureId;
  // Staff: usePermission('mission'). Étudiants: lecture si même structure (rules Firestore).
  const canViewMission = isEtudiantViewer ? studentCanViewMission : canRead;

  if (loading || (!isEtudiantViewer && permissionLoading)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button
          startIcon={<ChevronLeftIcon />}
          onClick={() => navigate(isEtudiantViewer ? '/app/available-missions' : '/mission')}
          sx={{ mt: 2 }}
        >
          Retour aux missions
        </Button>
      </Box>
    );
  }

  if (!canViewMission) {
    return (
      <AccessDenied
        pageName="Détail de la mission"
        message="Vous n'avez pas les permissions nécessaires pour accéder à cette mission."
      />
    );
  }


  const updatedAtLabel = mission?.updatedAt ? formatShortDate(mission.updatedAt) : undefined;
  const missionTypeLabel = mission?.missionTypeId
    ? missionTypes.find((t) => t.id === mission.missionTypeId)?.title
    : undefined;
  const createdByName = mission?.createdBy
    ? structureMembers.find((m) => m.id === mission.createdBy)?.displayName
    : undefined;

  const activityEntries = userHistory.map((entry) => ({
    id: entry.id,
    date: entry.date,
    action: entry.action,
    details: entry.details,
    userId: entry.userId,
    actorName: structureMembers.find((m) => m.id === entry.userId)?.displayName || 'Utilisateur',
  }));

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    }).format(value);

  const acceptedCount = applications.filter((a) => a.status === 'Acceptée').length;
  const workingHoursApplication = workingHoursDialog.application
    ? applications.find((a) => a.id === workingHoursDialog.application!.id) ?? workingHoursDialog.application
    : null;
  const contactLabel = mission?.contact
    ? `${mission.contact.firstName || ''} ${mission.contact.lastName || ''}`.trim()
    : '';
  const contactOptions = contacts.map((c) => ({
    value: c.id,
    label: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || 'Contact',
  }));

  const handleOverviewFieldSave = (field: string, value: string | number | boolean) => {
    if (!mission?.id) return;
    if (mission.isArchived) {
      enqueueSnackbar('Impossible de modifier une mission archivée', { variant: 'error' });
      return;
    }
    if (field === 'companyId') {
      const company = companies.find((c) => c.id === value);
      setMission((prev) =>
        prev
          ? {
              ...prev,
              companyId: value as string,
              company: company?.name || '',
              // Reset contact if company changes
              ...(prev.companyId !== value
                ? { contactId: undefined, contact: undefined }
                : {}),
            }
          : null
      );
      return;
    }
    if (field === 'contactId') {
      const contact = contacts.find((c) => c.id === value);
      if (!contact) return;
      setMission((prev) =>
        prev
          ? {
              ...prev,
              contactId: value as string,
              contact: {
                firstName: contact.firstName,
                lastName: contact.lastName,
                email: contact.email,
                phone: contact.phone,
                position: contact.position,
              } as Mission['contact'],
            }
          : null
      );
      return;
    }
    if (field === 'chargeId') {
      const member = structureMembers.find((c) => c.id === value);
      const chargeName =
        member?.displayName && !isEncryptedField(member.displayName) ? member.displayName : '';
      setMission((prev) =>
        prev
          ? {
              ...prev,
              chargeId: value as string,
              ...(chargeName ? { chargeName } : {}),
            }
          : null
      );
      return;
    }
    if (field === 'hours') {
      const hours = typeof value === 'number' ? value : parseInt(String(value), 10) || 0;
      handleFieldChange('hours', hours);
      const { totalHT: th, totalTTC: tt } = calculatePrices(priceHT, hours, expenses);
      setTotalHT(th);
      setTotalTTC(tt);
      setIsPriceSaved(false);
      return;
    }
    if (field === 'numeroMission') {
      handleFieldChange('numeroMission', String(value));
      return;
    }
    handleFieldChange(field as keyof Mission, value);
  };

  const handleOverviewDateSave = (which: 'start' | 'end', date: string, time: string) => {
    if (!mission?.id) return;
    if (mission.isArchived) {
      enqueueSnackbar('Impossible de modifier une mission archivée', { variant: 'error' });
      return;
    }
    if (which === 'start') {
      setStartDateDate(date);
      setStartDateTime(time);
    } else {
      setEndDateDate(date);
      setEndDateTime(time);
    }
  };

  const handleOverviewToggle = (field: string, value: boolean) => {
    if (!mission?.id) return;
    if (field === 'isPublished') {
      if (value !== isPublished) void handlePublishMission();
      return;
    }
    if (field === 'isArchived') {
      void handleUpdateMission(mission.id, { isArchived: value });
      return;
    }
    // CV / motivation / public : draft local, enregistrés via MissionSaveBar
    handleFieldChange(field as keyof Mission, value);
  };

  const applyDatesFromMission = (m: Mission) => {
    if (m.startDate) {
      const startDateObj = new Date(m.startDate);
      setStartDateDate(startDateObj.toISOString().split('T')[0]);
      setStartDateTime(startDateObj.toTimeString().slice(0, 5));
    } else {
      setStartDateDate('');
      setStartDateTime('');
    }
    if (m.endDate) {
      const endDateObj = new Date(m.endDate);
      setEndDateDate(endDateObj.toISOString().split('T')[0]);
      setEndDateTime(endDateObj.toTimeString().slice(0, 5));
    } else {
      setEndDateDate('');
      setEndDateTime('');
    }
  };

  const getDateParts = (iso?: string | null) => {
    if (!iso) return { date: '', time: '' };
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { date: '', time: '' };
    return {
      date: d.toISOString().split('T')[0],
      time: d.toTimeString().slice(0, 5),
    };
  };

  const collectDirtyFields = (): string[] => {
    if (!mission || !editedMission) return [];
    const fields: string[] = [];
    const scalarKeys: Array<{ key: keyof Mission; label: string }> = [
      { key: 'numeroMission', label: 'numeroMission' },
      { key: 'missionTypeId', label: 'missionTypeId' },
      { key: 'companyId', label: 'companyId' },
      { key: 'contactId', label: 'contactId' },
      { key: 'chargeId', label: 'chargeId' },
      { key: 'location', label: 'location' },
      { key: 'description', label: 'description' },
      { key: 'studentCount', label: 'studentCount' },
      { key: 'hoursPerStudent', label: 'hoursPerStudent' },
      { key: 'hours', label: 'hours' },
      { key: 'salary', label: 'salary' },
      { key: 'requiresCV', label: 'requiresCV' },
      { key: 'requiresMotivation', label: 'requiresMotivation' },
    ];
    for (const { key, label } of scalarKeys) {
      if (JSON.stringify(mission[key] ?? null) !== JSON.stringify(editedMission[key] ?? null)) {
        fields.push(label);
      }
    }
    if (JSON.stringify(mission.contact ?? null) !== JSON.stringify(editedMission.contact ?? null)) {
      if (!fields.includes('contactId')) fields.push('contactId');
    }
    const savedStart = getDateParts(editedMission.startDate);
    if (startDateDate !== savedStart.date || startDateTime !== savedStart.time) {
      fields.push('startDate');
    }
    const savedEnd = getDateParts(editedMission.endDate);
    if (endDateDate !== savedEnd.date || endDateTime !== savedEnd.time) {
      fields.push('endDate');
    }
    if (!isPriceSaved) {
      if ((mission.priceHT || 0) !== priceHT || (editedMission.priceHT || 0) !== priceHT) {
        fields.push('priceHT');
      }
      if (JSON.stringify(expenses) !== JSON.stringify(savedExpenses)) {
        fields.push('expenses');
      }
      if (!fields.includes('priceHT') && !fields.includes('expenses')) {
        fields.push('priceHT');
      }
    }
    return fields;
  };

  const handleSavePendingChanges = async () => {
    if (!mission || !editedMission) return;
    if (mission.isArchived) {
      enqueueSnackbar('Impossible de modifier une mission archivée', { variant: 'error' });
      return;
    }

    const dirty = collectDirtyFields();
    if (dirty.length === 0) return;

    try {
      setIsSaving(true);
      setError(null);
      const missionRef = doc(db, 'missions', mission.id);
      const updateData: Record<string, unknown> = {};

      const syncKeys: (keyof Mission)[] = [
        'numeroMission',
        'missionTypeId',
        'companyId',
        'company',
        'contactId',
        'contact',
        'chargeId',
        'chargeName',
        'location',
        'description',
        'studentCount',
        'hoursPerStudent',
        'hours',
        'salary',
        'requiresCV',
        'requiresMotivation',
      ];
      for (const key of syncKeys) {
        if (JSON.stringify(mission[key] ?? null) !== JSON.stringify(editedMission[key] ?? null)) {
          updateData[key] = mission[key] ?? null;
        }
      }

      const savedStart = getDateParts(editedMission.startDate);
      if (startDateDate !== savedStart.date || startDateTime !== savedStart.time) {
        updateData.startDate = startDateDate
          ? new Date(`${startDateDate}T${startDateTime || '00:00'}`).toISOString()
          : null;
      }
      const savedEnd = getDateParts(editedMission.endDate);
      if (endDateDate !== savedEnd.date || endDateTime !== savedEnd.time) {
        updateData.endDate = endDateDate
          ? new Date(`${endDateDate}T${endDateTime || '00:00'}`).toISOString()
          : null;
      }

      if (updateData.chargeId && updateData.chargeId !== editedMission.chargeId) {
        try {
          const chargeDoc = await getDoc(doc(db, 'users', updateData.chargeId as string));
          if (chargeDoc.exists()) {
            updateData.mandat = chargeDoc.data().mandat || null;
          }
        } catch (err) {
          console.error('Erreur lors de la récupération du mandat du chargé de mission:', err);
        }
      }

      const pricingDirty = !isPriceSaved || dirty.includes('hours') || dirty.includes('priceHT') || dirty.includes('expenses');
      if (pricingDirty) {
        const hours = (typeof updateData.hours === 'number' ? updateData.hours : mission.hours) || 0;
        const { totalHT: newTotalHT, totalTTC: newTotalTTC, tva: newTva } = calculatePrices(
          priceHT,
          hours,
          expenses
        );
        updateData.priceHT = priceHT;
        updateData.totalHT = newTotalHT;
        updateData.totalTTC = newTotalTTC;
        updateData.tva = newTva;

        const missionDoc = await getDoc(missionRef);
        if (missionDoc.exists()) {
          const missionData = missionDoc.data();
          let index = 1;
          while (true) {
            const nameKey = `nomdepense${index}`;
            const tvaKey = `tvadepense${index}`;
            const totalKey = `totaldepense${index}`;
            if (missionData[nameKey] || missionData[tvaKey] || missionData[totalKey]) {
              updateData[nameKey] = deleteField();
              updateData[tvaKey] = deleteField();
              updateData[totalKey] = deleteField();
              index++;
            } else {
              break;
            }
          }
        }
        expenses.forEach((expense, index) => {
          const num = index + 1;
          updateData[`nomdepense${num}`] = expense.name;
          updateData[`tvadepense${num}`] = expense.tva;
          updateData[`totaldepense${num}`] = expense.priceHT;
        });
      }

      if (Object.keys(updateData).length === 0) {
        setIsPriceSaved(true);
        return;
      }

      updateData.updatedAt = new Date();
      await updateDoc(missionRef, updateData);

      // L'état local `mission` contient déjà les champs formulaire ;
      // on synchronise dates / tarifs / mandat puis on fige le snapshot.
      const nextMission: Mission = {
        ...mission,
        ...(typeof updateData.startDate !== 'undefined'
          ? { startDate: (updateData.startDate as string | null) || undefined }
          : {}),
        ...(typeof updateData.endDate !== 'undefined'
          ? { endDate: (updateData.endDate as string | null) || undefined }
          : {}),
        ...(typeof updateData.mandat !== 'undefined'
          ? { mandat: (updateData.mandat as string | null) || undefined }
          : {}),
        ...(pricingDirty
          ? {
              priceHT,
              totalHT: updateData.totalHT as number,
              totalTTC: updateData.totalTTC as number,
              tva: updateData.tva as number,
            }
          : {}),
      };
      setMission(nextMission);
      setEditedMission({ ...nextMission });
      if (pricingDirty) {
        setTotalHT(updateData.totalHT as number);
        setTotalTTC(updateData.totalTTC as number);
        setIsPriceSaved(true);
        const persistedExpenses = expenses.map((e, idx) => ({
          ...e,
          isSaved: true,
          savedIndex: idx + 1,
        }));
        setExpenses(persistedExpenses);
        setSavedExpenses(persistedExpenses.map((e) => ({ ...e })));
      }
      enqueueSnackbar('Modifications enregistrées', { variant: 'success' });
    } catch (err) {
      console.error('Erreur lors de l’enregistrement des modifications:', err);
      enqueueSnackbar('Erreur lors de l’enregistrement', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardPendingChanges = () => {
    if (!editedMission) return;
    setMission({ ...editedMission });
    setPriceHT(editedMission.priceHT || 0);
    const restoredExpenses = savedExpenses.map((e) => ({ ...e }));
    setExpenses(restoredExpenses);
    applyDatesFromMission(editedMission);
    const { totalHT: th, totalTTC: tt } = calculatePrices(
      editedMission.priceHT || 0,
      editedMission.hours,
      restoredExpenses
    );
    setTotalHT(th);
    setTotalTTC(tt);
    setIsPriceSaved(true);
  };

  const handleAddExpenseRow = () => {
    if (expenses.length >= 4) return;
    const newExpense: MissionExpense = {
      id: `expense-new-${Date.now()}`,
      name: '',
      tva: 20,
      priceHT: 0,
    };
    setExpenses([...expenses, newExpense]);
    setIsPriceSaved(false);
  };

  const handleLocalExpenseDelete = (index: number) => {
    const updated = expenses.filter((_, i) => i !== index);
    setExpenses(updated);
    setIsPriceSaved(false);
    if (mission) {
      const { totalHT: th, totalTTC: tt } = calculatePrices(priceHT, mission.hours, updated);
      setTotalHT(th);
      setTotalTTC(tt);
    }
  };

  const chargeDisplayName = (() => {
    if (!mission?.chargeId) return '';
    const member = structureMembers.find((m) => m.id === mission.chargeId);
    if (member?.displayName && !isEncryptedField(member.displayName)) return member.displayName;
    if (mission.chargeName && !isEncryptedField(mission.chargeName)) return mission.chargeName;
    return '';
  })();

  const chargeSelectOptions = structureMembers.map((m) => ({
    value: m.id,
    label: isEncryptedField(m.displayName) ? 'Membre' : m.displayName,
  }));

  const dirtyFields = collectDirtyFields();
  const dirtyCount = dirtyFields.length;

  const renderMissionDetailBody = (): React.ReactNode => {
    if (!mission) return null;

    switch (activeTab) {
      case 'overview':
        return (
          <MissionOverviewTabV2
            canWrite={canWrite}
            isArchived={mission.isArchived}
            totalHT={totalHT}
            totalTTC={totalTTC}
            tvaPercent={20}
            studentCount={mission.studentCount || 0}
            hoursPerStudent={mission.hoursPerStudent || 0}
            applicationsCount={applications.length}
            acceptedCount={acceptedCount}
            hours={mission.hours || 0}
            priceHT={priceHT}
            formatCurrency={formatCurrency}
            title={mission.numeroMission || ''}
            missionTypeId={mission.missionTypeId}
            missionTypeLabel={missionTypeLabel}
            missionTypeOptions={missionTypes.map((t) => ({ value: t.id, label: t.title }))}
            companyId={mission.companyId}
            companyName={mission.company}
            companyOptions={companies.map((c) => ({ value: c.id, label: c.name }))}
            contactId={mission.contactId}
            contactLabel={contactLabel}
            contactOptions={contactOptions}
            chargeId={mission.chargeId}
            chargeName={
              chargeDisplayName ||
              (mission.chargeName && !isEncryptedField(mission.chargeName) ? mission.chargeName : '')
            }
            chargeOptions={chargeSelectOptions}
            location={mission.location || ''}
            startDate={startDateDate}
            startTime={startDateTime}
            endDate={endDateDate}
            endTime={endDateTime}
            description={mission.description || ''}
            salary={mission.salary || ''}
            isPublished={isPublished}
            requiresCV={mission.requiresCV}
            requiresMotivation={mission.requiresMotivation}
            expenses={expenses}
            onFieldSave={handleOverviewFieldSave}
            onDateSave={handleOverviewDateSave}
            onDescriptionSave={(v) => {
              handleFieldChange('description', v);
            }}
            onPriceHTChange={(v) => {
              setPriceHT(v);
              setIsPriceSaved(false);
              const { totalHT: th, totalTTC: tt } = calculatePrices(v, mission.hours, expenses);
              setTotalHT(th);
              setTotalTTC(tt);
            }}
            onPriceHTBlur={() => {
              /* draft only — save via MissionSaveBar */
            }}
            onSalarySave={(v) => handleOverviewFieldSave('salary', v)}
            onTvaSave={() => {}}
            onAddExpense={handleAddExpenseRow}
            onExpenseChange={(index, patch) => {
              const updated = [...expenses];
              updated[index] = { ...updated[index], ...patch };
              setExpenses(updated);
              setIsPriceSaved(false);
              const { totalHT: th, totalTTC: tt } = calculatePrices(priceHT, mission.hours, updated);
              setTotalHT(th);
              setTotalTTC(tt);
            }}
            onExpenseSave={() => {
              /* draft only — save via MissionSaveBar */
            }}
            onExpenseDelete={handleLocalExpenseDelete}
            onToggle={handleOverviewToggle}
          />
        );
      case 'candidates':
        return (
          <MissionCandidatesTabV2
            applications={applications}
            canWrite={canWrite}
            loading={loadingApplications}
            onAddCandidate={() => setOpenAddCandidateDialog(true)}
            onAccept={(id) => void handleUpdateApplicationStatus(id, 'Acceptée')}
            onReject={(id) => void handleUpdateApplicationStatus(id, 'Refusée')}
            onWorkingHours={(app) => setWorkingHoursDialog({ open: true, application: app })}
            onDownloadCv={(url) => window.open(url, '_blank')}
          />
        );
      case 'documents':
        return (
          <MissionDocumentsTabV2
            documents={generatedDocuments}
            canWrite={canWrite}
            generatingDocType={generatingDocType}
            onGenerate={(type) => void handleDocumentGenerateRequest(type)}
            onGenerateFromTemplate={() => setManualGeneratorOpen(true)}
            onUpload={(files, category) => {
              Array.from(files).forEach((file) => handleOpenUploadDialog(category, file));
            }}
            onOpenDocument={(doc) => {
              if (currentUser) {
                trackUserActivity(currentUser.uid, 'document', {
                  id: doc.id,
                  title: doc.fileName || 'Document',
                  subtitle: `Mission ${mission.numeroMission}`,
                  url: doc.fileUrl,
                });
              }
              window.open(doc.fileUrl, '_blank');
            }}
            onDocumentMenu={(e, doc) => handleDocumentMenuOpen(e, doc)}
          />
        );
      case 'notes':
        return (
          <MissionNotesTabV2
            notes={notes}
            loading={loadingNotes}
            canWrite={canWrite}
            newNote={newNote}
            onNewNoteChange={setNewNote}
            onAddNote={() => void handleAddNote()}
            composerSlot={
              <TaggingInput
                value={newNote}
                onChange={setNewNote}
                placeholder="Ajouter une note… utilisez @ pour mentionner un membre"
                multiline
                rows={3}
                availableUsers={availableUsersForTagging}
                onTaggedUsersChange={handleTaggedUsersChange}
              />
            }
            editingNoteId={editingNoteId}
            editedContent={editedNoteContent}
            onEditContentChange={setEditedNoteContent}
            onEditNote={handleEditNote}
            onSaveNote={(id) => void handleSaveNote(id)}
            onCancelEdit={() => { setEditingNoteId(null); setEditedNoteContent(''); }}
            onDeleteNote={(id) => void handleDeleteNote(id)}
            currentUserInitials={
              (currentUser?.displayName || currentUser?.email || 'MO').slice(0, 2).toUpperCase()
            }
          />
        );
      case 'activity':
        return <ActivityTab entries={activityEntries} />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ ...dsPageCanvasSx, ...mdV2RootSx }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2, mx: { xs: 2, md: 4 }, mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2, mx: { xs: 2, md: 4 } }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {mission && (
        <MissionDetailHeaderV2
          numeroMission={mission.numeroMission}
          title={mission.numeroMission || ''}
          etape={mission.etape}
          isPublished={isPublished}
          isArchived={mission.isArchived}
          activeTab={activeTab}
          tabCounts={tabCounts}
          canWrite={canWrite}
          onBack={() => navigate('/app/mission')}
          onTabChange={setActiveTab}
          onTitleSave={(t) => {
            handleFieldChange('numeroMission', t);
          }}
          onEtapeChange={(e) => void handleEtapeChange(e as MissionEtape)}
          onShare={() => setIsPermissionsDialogOpen(true)}
          onGoDocuments={() => setActiveTab('documents')}
          onNewDocument={() => setActiveTab('documents')}
          overflowOpen={overflowOpen}
          overflowAnchor={overflowAnchor}
          onOverflowToggle={(el) => {
            setOverflowAnchor(el);
            setOverflowOpen(!!el);
          }}
          onDelete={() => setDeleteDialogOpen(true)}
          onArchive={() => {
            void handleUpdateMission(mission.id, { isArchived: !mission.isArchived });
          }}
          onDuplicate={() => {
            void handleDuplicateMission();
          }}
        />
      )}

      <MissionDetailShell
        sidebar={
          <MissionDetailSidebarPanel
            numeroMission={mission?.numeroMission || ''}
            mandat={mission?.mandat}
            missionTypeLabel={missionTypeLabel}
            createdByName={createdByName}
            createdById={mission?.createdBy}
            updatedAtLabel={updatedAtLabel}
            chargeName={
              chargeDisplayName ||
              (mission.chargeName && !isEncryptedField(mission.chargeName) ? mission.chargeName : undefined)
            }
            chargeId={mission?.chargeId}
            chargeEmail={structureMembers.find((m) => m.id === mission?.chargeId)?.email}
            contactName={mission?.contact ? `${mission.contact.firstName} ${mission.contact.lastName}` : undefined}
            contactEmail={mission?.contact?.email}
            users={missionUsers}
            isPublished={isPublished}
            canWrite={canWrite}
            isSaving={isSaving}
            onOpenPermissions={() => setIsPermissionsDialogOpen(true)}
            onTogglePublished={() => { void handlePublishMission(); }}
          />
        }
      >
        {renderMissionDetailBody()}
      </MissionDetailShell>

      <MissionSaveBar
        dirtyCount={dirtyCount}
        dirtyFields={dirtyFields}
        onSave={() => void handleSavePendingChanges()}
        onDiscard={handleDiscardPendingChanges}
      />

      <AddCandidatesDialog
        open={openAddCandidateDialog}
        structureId={mission?.structureId}
        existingUserIds={applications.map((a) => a.userId)}
        onClose={() => setOpenAddCandidateDialog(false)}
        onSubmit={handleAddCandidates}
      />

      {/* Dialog pour gérer les permissions */}
      <Dialog 
        open={isPermissionsDialogOpen} 
        onClose={() => setIsPermissionsDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
            p: 3
          }
        }}
      >
        <DialogTitle sx={{ 
          p: 0, 
          mb: 3,
          fontSize: '1.5rem',
          fontWeight: 600,
          color: '#1d1d1f'
        }}>
          Gérer les accès à la mission
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ 
              mb: 2,
              color: '#1d1d1f',
              fontWeight: 500
            }}>
              Ajouter un utilisateur
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Autocomplete
                fullWidth
                options={availableUsers}
                getOptionLabel={(option) => {
                  const name = getSafeDisplayName(option);
                  return name === option.email ? option.email : `${name} (${option.email})`;
                }}
                onChange={(_, value) => setSelectedUserId(value?.id || null)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Sélectionner un utilisateur"
                    variant="outlined"
                    size="small"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '8px',
                        backgroundColor: 'white',
                        '& fieldset': {
                          borderColor: '#d2d2d7',
                        },
                        '&:hover fieldset': {
                          borderColor: '#1d1d1f',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#007AFF',
                        }
                      }
                    }}
                  />
                )}
              />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Rôle</InputLabel>
                <Select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as 'viewer' | 'editor')}
                  label="Rôle"
                  sx={{
                    borderRadius: '8px',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#d2d2d7',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#1d1d1f',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#007AFF',
                    }
                  }}
                >
                  <MenuItem value="viewer">Lecteur</MenuItem>
                  <MenuItem value="editor">Modificateur</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="contained"
                onClick={handleAddUserPermission}
                disabled={!selectedUserId}
                sx={{
                  backgroundColor: '#007AFF',
                  '&:hover': {
                    backgroundColor: '#0A84FF'
                  },
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 500,
                  px: 2,
                  py: 1
                }}
              >
                Ajouter
              </Button>
            </Box>
          </Box>

          <Typography variant="subtitle1" sx={{ 
            mb: 2,
            color: '#1d1d1f',
            fontWeight: 500
          }}>
            Utilisateurs ayant accès
          </Typography>
          <List sx={{ 
            bgcolor: '#f5f5f7',
            borderRadius: '12px',
            p: 2
          }}>
            {missionUsers.map((user) => (
              <ListItem
                key={user.id}
                sx={{
                  bgcolor: 'white',
                  borderRadius: '8px',
                  mb: 1,
                  '&:last-child': {
                    mb: 0
                  }
                }}
                secondaryAction={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={user.role === 'editor' ? 'Modificateur' : 'Lecteur'}
                      color={user.role === 'editor' ? 'primary' : 'default'}
                      size="small"
                      sx={{
                        borderRadius: '8px',
                        height: '28px',
                        fontWeight: '500'
                      }}
                    />
                    <IconButton
                      edge="end"
                      aria-label="supprimer"
                      onClick={() => handleRemoveUserPermission(user.id)}
                      sx={{
                        color: '#86868b',
                        '&:hover': {
                          color: '#FF3B30'
                        }
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemAvatar>
                  <Avatar 
                    src={user.photoURL || undefined}
                    sx={{ 
                      width: 40, 
                      height: 40,
                      bgcolor: '#f5f5f7'
                    }}
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      target.src = '';
                      target.style.display = 'none';
                    }}
                  >
                    {!user.photoURL && user.displayName[0]}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={user.displayName}
                  secondary={user.email}
                  primaryTypographyProps={{
                    sx: {
                      color: '#1d1d1f',
                      fontWeight: 500
                    }
                  }}
                  secondaryTypographyProps={{
                    sx: {
                      color: '#86868b'
                    }
                  }}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ p: 0, mt: 3 }}>
          <Button 
            onClick={() => setIsPermissionsDialogOpen(false)}
            sx={{
              color: '#1d1d1f',
              textTransform: 'none',
              fontWeight: 500,
              '&:hover': {
                backgroundColor: 'transparent',
                opacity: 0.7
              }
            }}
          >
            Fermer
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Dialog de confirmation pour les documents */}
      <Dialog
        open={documentConfirmDialog.open}
        onClose={() => handleDocumentConfirmation('cancel')}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          pb: 1,
          fontWeight: 500
        }}>
          Document existant
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {documentConfirmDialog.documentType === 'lettre_mission' 
              ? "Une lettre de mission existe déjà pour cet étudiant."
              : "Un document de ce type existe déjà pour cette mission."}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Document existant : {documentConfirmDialog.existingDoc?.fileName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Généré le {documentConfirmDialog.existingDoc?.createdAt.toLocaleDateString()}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => handleDocumentConfirmation('cancel')}
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
            onClick={() => handleDocumentConfirmation('keep')}
            variant="outlined"
            color="primary"
          >
            Conserver les deux
          </Button>
          <Button
            onClick={() => handleDocumentConfirmation('replace')}
            variant="contained"
            color="primary"
          >
            Remplacer l'ancien
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ajouter les menus et dialogues */}
      <Menu
        anchorEl={documentMenuAnchor.element}
        open={Boolean(documentMenuAnchor.element)}
        onClose={handleDocumentMenuClose}
        onClick={(e) => e.stopPropagation()}
        PaperProps={{
          sx: {
            mt: 1,
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
            borderRadius: '12px'
          }
        }}
      >
        <MenuItem
          onClick={() => {
            setDocumentDialogs(prev => ({
              ...prev,
              rename: true,
              selectedDocument: documentMenuAnchor.document,
              newFileName: documentMenuAnchor.document?.fileName || ''
            }));
            handleDocumentMenuClose();
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Renommer</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDocumentDialogs(prev => ({
              ...prev,
              info: true,
              selectedDocument: documentMenuAnchor.document
            }));
            handleDocumentMenuClose();
          }}
        >
          <ListItemIcon>
            <InfoIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Informations</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDocumentDialogs(prev => ({
              ...prev,
              signedVersion: true,
              selectedDocument: documentMenuAnchor.document
            }));
            handleDocumentMenuClose();
          }}
        >
          <ListItemIcon>
            <UploadFileIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Ajouter version signée</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={
            !!documentMenuAnchor.document?.locked ||
            !!documentMenuAnchor.document?.isSigned ||
            documentMenuAnchor.document?.signatureStatus === 'pending'
          }
          onClick={() => {
            setDocumentDialogs(prev => ({
              ...prev,
              sendSignature: true,
              selectedDocument: documentMenuAnchor.document
            }));
            handleDocumentMenuClose();
          }}
        >
          <ListItemIcon>
            <GestureIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {documentMenuAnchor.document?.signatureStatus === 'pending'
              ? 'Signature en cours…'
              : documentMenuAnchor.document?.isSigned || documentMenuAnchor.document?.locked
                ? 'Déjà signé'
                : 'Envoyer en signature'}
          </ListItemText>
        </MenuItem>
        {canDeleteDocument() && !(documentMenuAnchor.document?.locked || documentMenuAnchor.document?.isSigned) && [
          <Divider key="divider" />,
          <MenuItem
            key="delete"
            onClick={() => {
              if (documentMenuAnchor.document) {
                handleDeleteDocument(documentMenuAnchor.document);
              }
            }}
            sx={{ color: '#FF3B30' }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" sx={{ color: '#FF3B30' }} />
            </ListItemIcon>
            <ListItemText>Supprimer</ListItemText>
          </MenuItem>
        ]}
      </Menu>

      {/* Dialog de renommage */}
      <Dialog
        open={documentDialogs.rename}
        onClose={() => setDocumentDialogs(prev => ({ ...prev, rename: false }))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Renommer le document</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nouveau nom"
            value={documentDialogs.newFileName}
            onChange={(e) => setDocumentDialogs(prev => ({ ...prev, newFileName: e.target.value }))}
            margin="dense"
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDocumentDialogs(prev => ({ ...prev, rename: false }))}>
            Annuler
          </Button>
          <Button onClick={handleRenameDocument} variant="contained" color="primary">
            Renommer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog d'informations */}
      <Dialog
        open={documentDialogs.info}
        onClose={() => setDocumentDialogs(prev => ({ ...prev, info: false }))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Informations du document</DialogTitle>
        <DialogContent>
          <List>
            <ListItem>
              <ListItemText
                primary="Nom du fichier"
                secondary={documentDialogs.selectedDocument?.fileName}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Type de document"
                secondary={documentDialogs.selectedDocument?.documentType}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Créé le"
                secondary={documentDialogs.selectedDocument?.createdAt.toLocaleString('fr-FR', {
                  dateStyle: 'long',
                  timeStyle: 'short'
                })}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Créé par"
                secondary={
                  <UserReferenceText
                    userId={documentDialogs.selectedDocument?.createdBy}
                    name={documentDialogs.selectedDocument?.createdByName}
                    fallback={documentDialogs.selectedDocument?.createdBy || 'Utilisateur'}
                    component="span"
                  />
                }
              />
            </ListItem>
            {documentDialogs.selectedDocument?.applicationUserName && (
              <ListItem>
                <ListItemText
                  primary="Étudiant concerné"
                  secondary={documentDialogs.selectedDocument.applicationUserName}
                />
              </ListItem>
            )}
            {documentDialogs.selectedDocument?.signedFileUrl && (
              <ListItem>
                <ListItemText
                  primary="Version signée"
                  secondary={`Ajoutée le ${documentDialogs.selectedDocument.signedAt?.toLocaleString('fr-FR', {
                    dateStyle: 'long',
                    timeStyle: 'short'
                  })}`}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() => window.open(documentDialogs.selectedDocument?.signedFileUrl, '_blank')}
                  >
                    <DownloadIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDocumentDialogs(prev => ({ ...prev, info: false }))}>
            Fermer
          </Button>
        </DialogActions>
      </Dialog>

      <SendForSignatureDialog
        open={documentDialogs.sendSignature}
        onClose={() => setDocumentDialogs((prev) => ({ ...prev, sendSignature: false }))}
        generatedDocumentId={documentDialogs.selectedDocument?.id || ''}
        documentTitle={documentDialogs.selectedDocument?.fileName}
        documentType={documentDialogs.selectedDocument?.documentType}
        structureId={mission?.structureId || userData?.structureId}
        defaultSigners={signatureDefaultSigners}
        onCreated={(requestId) => {
          const selectedId = documentDialogs.selectedDocument?.id;
          if (selectedId) {
            setGeneratedDocuments((prev) =>
              prev.map((d) =>
                d.id === selectedId
                  ? { ...d, signatureRequestId: requestId, signatureStatus: 'pending' }
                  : d
              )
            );
          }
          void fetchGeneratedDocuments();
          enqueueSnackbar('Invitations de signature envoyées', { variant: 'success' });
        }}
      />

      {/* Dialog d'ajout de version signée */}
      <Dialog
        open={documentDialogs.signedVersion}
        onClose={() => setDocumentDialogs(prev => ({ ...prev, signedVersion: false }))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Ajouter la version signée</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Sélectionnez le fichier PDF signé. Le document original sera remplacé par cette version.
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Cette action remplacera le document actuel par sa version signée.
          </Alert>
          <input
            type="file"
            accept=".pdf"
            onChange={handleUploadSignedVersion}
            style={{ display: 'none' }}
            id="signed-file-input"
          />
          <label htmlFor="signed-file-input">
            <Button
              variant="outlined"
              component="span"
              startIcon={<UploadFileIcon />}
            >
              Sélectionner le fichier signé
            </Button>
          </label>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDocumentDialogs(prev => ({ ...prev, signedVersion: false }))}>
            Annuler
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog pour ajouter une nouvelle entreprise */}
      <Dialog 
        open={openNewCompanyDialog} 
        onClose={() => setOpenNewCompanyDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Ajouter une nouvelle entreprise</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nom de l'entreprise"
            fullWidth
            value={newCompanyName}
            onChange={(e) => setNewCompanyName(e.target.value)}
            variant="outlined"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNewCompanyDialog(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleCreateCompany}
            variant="contained"
            disabled={!newCompanyName.trim()}
          >
            Créer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ajouter ce dialogue à la fin du composant, juste avant le dernier </Box> */}
      <Dialog
        open={workingHoursDialog.open}
        onClose={handleCloseWorkingHours}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          Horaires de travail —{' '}
          <UserReferenceText
            userId={workingHoursApplication?.userId}
            name={workingHoursApplication?.userDisplayName}
            fallback="Candidat"
            component="span"
            sx={{ fontSize: 'inherit', fontWeight: 'inherit' }}
          />
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, color: '#1d1d1f' }}>
              Ajouter des horaires
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="date"
                  label="Date"
                  value={newWorkingHour.date}
                  onChange={(e) => setNewWorkingHour(prev => ({ ...prev, date: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  disabled={loadingWorkingHoursDialog || !!savingWorkingHours[workingHoursApplication?.id || '']}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px'
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  type="time"
                  label="Heure de début"
                  value={newWorkingHour.startTime}
                  onChange={(e) => setNewWorkingHour(prev => ({ ...prev, startTime: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  disabled={loadingWorkingHoursDialog || !!savingWorkingHours[workingHoursApplication?.id || '']}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px'
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  type="time"
                  label="Heure de fin"
                  value={newWorkingHour.endTime}
                  onChange={(e) => setNewWorkingHour(prev => ({ ...prev, endTime: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  disabled={loadingWorkingHoursDialog || !!savingWorkingHours[workingHoursApplication?.id || '']}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px'
                    }
                  }}
                />
              </Grid>
              {canWrite && (
                <Grid item xs={12} sm={2}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => void handleAddWorkingHour(workingHoursApplication?.id || '')}
                    disabled={
                      mission?.isArchived ||
                      loadingWorkingHoursDialog ||
                      !!savingWorkingHours[workingHoursApplication?.id || '']
                    }
                    sx={{
                      height: '100%',
                      borderRadius: '12px',
                      textTransform: 'none'
                    }}
                  >
                    Ajouter
                  </Button>
                </Grid>
              )}
            </Grid>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle2" sx={{ mb: 2, color: '#1d1d1f' }}>
            Horaires enregistrés
          </Typography>
          <TableContainer component={Paper} sx={{ borderRadius: '12px' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Début</TableCell>
                  <TableCell>Fin</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingWorkingHoursDialog ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <CircularProgress size={24} sx={{ my: 2 }} />
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {workingHoursApplication?.workingHours?.map((wh) => (
                      <TableRow key={wh.id}>
                        <TableCell>{new Date(wh.date).toLocaleDateString('fr-FR')}</TableCell>
                        <TableCell>{wh.startTime}</TableCell>
                        <TableCell>{wh.endTime}</TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => void handleDeleteWorkingHour(wh.id)}
                            disabled={!!savingWorkingHours[workingHoursApplication?.id || '']}
                            sx={{ color: '#FF3B30' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!workingHoursApplication?.workingHours ||
                      workingHoursApplication.workingHours.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography color="text.secondary" sx={{ py: 2 }}>
                            Aucun horaire enregistré
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCloseWorkingHours}>
            Fermer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openPreview}
        onClose={() => setOpenPreview(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            maxHeight: '90vh'
          }
        }}
      >
        <DialogContent sx={{ p: 0, height: '100%' }}>
          {previewUrl && (
            <iframe
              src={previewUrl}
              style={{ 
                width: '100%', 
                height: '100%', 
                border: 'none' 
              }}
              title="Document Preview"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Ajouter le menu pour les actions des notes de frais (à ajouter avant la dernière balise </Box>) */}
      <Menu
        anchorEl={expenseMenuAnchor.element}
        open={Boolean(expenseMenuAnchor.element)}
        onClose={handleExpenseMenuClose}
        onClick={(e) => e.stopPropagation()}
        PaperProps={{
          sx: {
            mt: 1,
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
            borderRadius: '12px'
          }
        }}
      >
        {[
          // Options pour le statut "En attente"
          ...(expenseMenuAnchor.note?.status === 'En attente' ? [
            <MenuItem
              key="validate"
              onClick={() => {
                if (expenseMenuAnchor.note) {
                  handleUpdateExpenseStatus(expenseMenuAnchor.note.id, 'Validée');
                  handleExpenseMenuClose();
                }
              }}
            >
              <ListItemIcon>
                <CheckCircleIcon fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText>Valider</ListItemText>
            </MenuItem>,
            <MenuItem
              key="refuse"
              onClick={() => {
                if (expenseMenuAnchor.note) {
                  handleUpdateExpenseStatus(expenseMenuAnchor.note.id, 'Refusée');
                  handleExpenseMenuClose();
                }
              }}
            >
              <ListItemIcon>
                <CancelIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Refuser</ListItemText>
            </MenuItem>
          ] : []),

          // Options pour le statut "Validée"
          ...(expenseMenuAnchor.note?.status === 'Validée' ? [
            <MenuItem
              key="generate"
              onClick={() => {
                if (expenseMenuAnchor.note) {
                  handleGenerateExpenseDocument(expenseMenuAnchor.note);
                  handleExpenseMenuClose();
                }
              }}
            >
              <ListItemIcon>
                <DescriptionIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Générer le document</ListItemText>
            </MenuItem>,
            <MenuItem
              key="refuse-validated"
              onClick={() => {
                if (expenseMenuAnchor.note) {
                  handleUpdateExpenseStatus(expenseMenuAnchor.note.id, 'Refusée');
                  handleExpenseMenuClose();
                }
              }}
            >
              <ListItemIcon>
                <CancelIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Refuser</ListItemText>
            </MenuItem>,
            <MenuItem
              key="invalidate"
              onClick={() => {
                if (expenseMenuAnchor.note) {
                  handleInvalidateExpense(expenseMenuAnchor.note.id);
                  handleExpenseMenuClose();
                }
              }}
            >
              <ListItemIcon>
                <CancelIcon fontSize="small" color="warning" />
              </ListItemIcon>
              <ListItemText>Dévalider</ListItemText>
            </MenuItem>
          ] : []),

          // Options pour le statut "Refusée"
          ...(expenseMenuAnchor.note?.status === 'Refusée' ? [
            <MenuItem
              key="validate-refused"
              onClick={() => {
                if (expenseMenuAnchor.note) {
                  handleUpdateExpenseStatus(expenseMenuAnchor.note.id, 'Validée');
                  handleExpenseMenuClose();
                }
              }}
            >
              <ListItemIcon>
                <CheckCircleIcon fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText>Valider</ListItemText>
            </MenuItem>
          ] : [])
        ]}
      </Menu>

      {/* Dialog de confirmation de suppression */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
          }
        }}
      >
        <DialogTitle sx={{ 
          pb: 1,
          color: '#1d1d1f',
          fontWeight: 500
        }}>
          Confirmer la suppression
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 1 }}>
            Êtes-vous sûr de vouloir supprimer cette mission ?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Cette action est irréversible. Toutes les données associées à la mission seront supprimées.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
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
            onClick={handleDeleteMission}
            variant="contained"
            color="error"
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
            sx={{
              bgcolor: '#FF3B30',
              '&:hover': {
                bgcolor: '#FF453A'
              }
            }}
          >
            {isDeleting ? 'Suppression...' : 'Supprimer la mission'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialogue d'ajout de note de frais */}
      <Dialog
        open={openAddExpenseDialog}
        onClose={() => setOpenAddExpenseDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)'
          }
        }}
      >
        <DialogTitle sx={{ 
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <ReceiptIcon sx={{ fontSize: 20 }} />
          Ajouter une note de frais
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Étudiant</InputLabel>
              <Select
                value={newExpense.userId || ''}
                onChange={(e) => setNewExpense(prev => ({
                  ...prev,
                  userId: e.target.value
                }))}
                label="Étudiant"
              >
                {applications
                  .filter(app => app.status === 'Acceptée')
                  .map(app => (
                    <MenuItem key={app.userId} value={app.userId}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar
                          src={app.userPhotoURL || undefined}
                          sx={{ width: 24, height: 24 }}
                          onError={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            target.src = '';
                            target.style.display = 'none';
                          }}
                        >
                        <UserAvatarInitials user={{ id: app.userId, displayName: app.userDisplayName, email: app.userEmail }} />
                        </Avatar>
                        <UserReferenceText
                          userId={app.userId}
                          name={app.userDisplayName}
                          fallback={app.userEmail.split('@')[0]}
                        />
                      </Box>
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Description"
              value={newExpense.description}
              onChange={(e) => setNewExpense(prev => ({
                ...prev,
                description: e.target.value
              }))}
            />

            <TextField
              fullWidth
              label="Montant"
              type="number"
              value={newExpense.amount}
              onChange={(e) => setNewExpense(prev => ({
                ...prev,
                amount: parseFloat(e.target.value) || 0
              }))}
              InputProps={{
                endAdornment: <InputAdornment position="end">€</InputAdornment>
              }}
            />

            <TextField
              fullWidth
              label="Date"
              type="date"
              value={newExpense.date}
              onChange={(e) => setNewExpense(prev => ({
                ...prev,
                date: e.target.value
              }))}
              InputLabelProps={{
                shrink: true
              }}
            />

            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadIcon />}
              sx={{ mt: 1 }}
            >
              Ajouter un justificatif
              <input
                type="file"
                hidden
                onChange={handleExpenseFileUpload}
                accept=".pdf,.jpg,.jpeg,.png"
              />
            </Button>
            {newExpense.attachmentUrl && (
              <Typography variant="caption" color="success.main">
                Fichier ajouté avec succès
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            onClick={() => setOpenAddExpenseDialog(false)}
            sx={{ borderRadius: '10px' }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleAddExpense}
            disabled={!newExpense.userId || !newExpense.description || !newExpense.amount || !newExpense.date}
            sx={{ borderRadius: '10px' }}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog pour créer un nouveau type de mission */}
      <Dialog
        open={openNewMissionTypeDialog}
        onClose={() => setOpenNewMissionTypeDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Nouveau type de mission</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Titre"
            type="text"
            fullWidth
            value={newMissionType.title}
            onChange={(e) => setNewMissionType(prev => ({ ...prev, title: e.target.value }))}
          />
          <TextField
            margin="dense"
            label="Profil étudiant"
            type="text"
            fullWidth
            multiline
            rows={4}
            value={newMissionType.studentProfile}
            onChange={(e) => setNewMissionType(prev => ({ ...prev, studentProfile: e.target.value }))}
          />
          <TextField
            margin="dense"
            label="Application du cours"
            type="text"
            fullWidth
            multiline
            rows={4}
            value={newMissionType.courseApplication}
            onChange={(e) => setNewMissionType(prev => ({ ...prev, courseApplication: e.target.value }))}
          />
          <TextField
            margin="dense"
            label="Apprentissage de la mission"
            type="text"
            fullWidth
            multiline
            rows={4}
            value={newMissionType.missionLearning}
            onChange={(e) => setNewMissionType(prev => ({ ...prev, missionLearning: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNewMissionTypeDialog(false)}>Annuler</Button>
          <Button onClick={handleCreateMissionType} variant="contained" color="primary">
            Créer
          </Button>
        </DialogActions>
      </Dialog>

      <LetterMissionStudentSelectDialog
        open={lmDialogOpen}
        applications={applications.map((app) => ({
          id: app.id,
          userId: app.userId,
          userEmail: app.userEmail,
          userDisplayName: app.userDisplayName,
          status: app.status,
        }))}
        generating={generatingDocType === 'lettre_mission'}
        onClose={handleCloseLmDialog}
        onGenerate={(id) => void handleLmGenerate(id)}
      />

      <GenerateFromTemplateDialog
        open={manualGeneratorOpen}
        onClose={() => setManualGeneratorOpen(false)}
        structureId={mission?.structureId || ''}
        missionId={mission?.id || ''}
      />

      {/* Dialog pour les données manquantes */}
      <AvenantStudentSelectDialog
        open={avenantDialog.open}
        step={avenantDialog.step}
        applications={applications.map((app) => ({
          id: app.id,
          userId: app.userId,
          userEmail: app.userEmail,
          userDisplayName: app.userDisplayName,
          status: app.status,
        }))}
        templateName={avenantDialog.templateName}
        templateId={avenantDialog.templateId}
        templateOptions={avenantDialog.templateOptions}
        templateLoading={avenantDialog.templateLoading}
        templateSaving={avenantDialog.templateSaving}
        templateMissing={avenantDialog.templateMissing}
        canChangeTemplate={canWrite}
        generating={generatingDocType === 'avenant'}
        checkingMissing={avenantDialog.checkingMissing}
        templateTags={avenantDialog.templateTags}
        tempData={tempData}
        onClose={handleCloseAvenantDialog}
        onContinue={(id) => void handleAvenantContinue(id)}
        onGenerate={() => void handleAvenantGenerate()}
        onBack={handleAvenantBack}
        onRefreshMissing={() => void handleAvenantRefreshMissing()}
        onTemplateChange={(id) => void handleAvenantTemplateChange(id)}
        onTempDataChange={handleEditMissingData}
        onSaveMissingField={(tag, value) => void handleAvenantSaveField(tag, value)}
      />

      {/* Loader commun pendant génération / téléchargement — tous les types de templates */}
      <Dialog
        open={!!generatingDocType}
        disableEscapeKeyDown
        onClose={() => undefined}
        PaperProps={{
          sx: {
            borderRadius: '12px',
            minWidth: { xs: '90%', sm: 360 },
            px: 1,
          },
        }}
      >
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            py: 4,
            px: 3,
          }}
        >
          <CircularProgress size={40} sx={{ color: '#173B6C' }} />
          <Typography
            sx={{
              fontSize: 16,
              fontWeight: 600,
              color: tokens.colors.gray900,
              textAlign: 'center',
            }}
          >
            Génération{' '}
            {generatingDocType
              ? `de ${DOCUMENT_TYPES[generatingDocType].toLowerCase()}`
              : 'du document'}
            …
          </Typography>
          <Typography sx={{ fontSize: 13, color: tokens.colors.gray500, textAlign: 'center' }}>
            Préparation du PDF — merci de patienter quelques instants.
          </Typography>
          <LinearProgress sx={{ width: '100%', maxWidth: 280, mt: 1 }} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={missingDataDialog.open}
        onClose={(_event, reason) => {
          if (missingDataDialog.detecting) return;
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            handleCloseMissingDataDialog();
          }
        }}
        disableEscapeKeyDown={!!missingDataDialog.detecting}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          color: 'warning.main'
        }}>
          <WarningIcon />
          Données manquantes pour la génération du document
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Les informations suivantes sont manquantes pour générer le document. 
            Vous pouvez compléter ces informations directement ici, les sauvegarder, puis générer le document.
          </Typography>
          
          <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
            {missingDataDialog.detecting ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 4, gap: 2 }}>
                <CircularProgress size={32} />
                <Typography variant="body2" color="text.secondary">
                  Analyse du template en cours…
                </Typography>
              </Box>
            ) : missingDataDialog.missingData.length > 0 && (
              <Box>
                {Object.entries(
                  missingDataDialog.missingData.reduce((acc, item) => {
                    if (!acc[item.category]) {
                      acc[item.category] = [];
                    }
                    acc[item.category].push(item);
                    return acc;
                  }, {} as Record<string, typeof missingDataDialog.missingData>)
                ).map(([category, items]) => (
                  <Box key={category} sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ 
                      color: 'primary.main', 
                      mb: 1,
                      fontWeight: 600
                    }}>
                      {category}
                    </Typography>
                    <List dense>
                      {items.map((item, index) => (
                        <ListItem key={index} sx={{ 
                          py: 1,
                          backgroundColor: '#f8f9fa',
                          borderRadius: 1,
                          mb: 1,
                          alignItems: 'center'
                        }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <InfoIcon color="warning" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText 
                            primary={item.label}
                            secondary={`Balise: <${item.tag}>`}
                            primaryTypographyProps={{ 
                              fontSize: '0.875rem',
                              fontWeight: 500
                            }}
                            secondaryTypographyProps={{ 
                              fontSize: '0.75rem',
                              fontFamily: 'monospace'
                            }}
                            sx={{ flex: 1, mr: 2 }}
                          />
                          
                          <Box sx={{ 
                            display: 'flex', 
                            gap: 1, 
                            alignItems: 'center',
                            minWidth: 300
                          }}>
                            <TextField
                              size="small"
                              placeholder={`Saisir ${item.label.toLowerCase()}`}
                              value={tempData[item.tag] || ''}
                              onChange={(e) => handleEditMissingData(item.tag, e.target.value)}
                              sx={{ 
                                flex: 1,
                                '& .MuiOutlinedInput-root': {
                                  borderRadius: '8px',
                                  fontSize: '0.875rem'
                                }
                              }}
                            />
                            {tempData[item.tag] && tempData[item.tag].trim() && (
                              <>
                                <IconButton
                                  size="small"
                                  onClick={() => handleSaveMissingData(item.tag, tempData[item.tag])}
                                  sx={{ 
                                    color: 'success.main',
                                    '&:hover': { backgroundColor: 'success.light' }
                                  }}
                                >
                                  <SaveIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleCancelMissingDataEdit(item.tag)}
                                  sx={{ 
                                    color: 'error.main',
                                    '&:hover': { backgroundColor: 'error.light' }
                                  }}
                                >
                                  <CancelIcon fontSize="small" />
                                </IconButton>
                              </>
                            )}
                          </Box>
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button 
            onClick={handleCloseMissingDataDialog}
            sx={{ borderRadius: '10px' }}
          >
            Annuler
          </Button>
          <Button
            variant="outlined"
            onClick={handleGenerateAnyway}
            sx={{ 
              borderRadius: '10px',
              borderColor: 'warning.main',
              color: 'warning.main',
              '&:hover': {
                borderColor: 'warning.dark',
                backgroundColor: 'warning.light'
              }
            }}
          >
            Générer avec données par défaut
          </Button>
          <Button
            variant="contained"
            onClick={handleGenerateWithTempData}
            sx={{ 
              borderRadius: '10px',
              backgroundColor: 'success.main',
              '&:hover': {
                backgroundColor: 'success.dark'
              }
            }}
          >
            Générer avec données saisies
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog d'upload de document avec drag & drop */}
      <Dialog
        open={uploadDialog.open}
        onClose={() => setUploadDialog({ ...uploadDialog, open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid #e5e5ea',
          pb: 2,
          fontWeight: 600
        }}>
          {uploadDialog.category === 'contrats' && 'Uploader un contrat'}
          {uploadDialog.category === 'facturation' && 'Uploader une facture'}
          {uploadDialog.category === 'autres' && 'Uploader un document'}
        </DialogTitle>
        <DialogContent sx={{ mt: 3 }}>
          {/* Zone de drag & drop */}
          <Box
            onDragOver={(e) => {
              e.preventDefault();
              setUploadDialog({ ...uploadDialog, isDragging: true });
            }}
            onDragLeave={() => {
              setUploadDialog({ ...uploadDialog, isDragging: false });
            }}
            onDrop={(e) => {
              e.preventDefault();
              setUploadDialog({ ...uploadDialog, isDragging: false });
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                const droppedFile = e.dataTransfer.files[0];
                setUploadDialog({ ...uploadDialog, file: droppedFile, isDragging: false });
              }
            }}
            sx={{
              border: uploadDialog.isDragging 
                ? '2px dashed #007AFF' 
                : uploadDialog.file 
                  ? '2px solid #34C759'
                  : '2px dashed #c7c7cc',
              borderRadius: '12px',
              p: 4,
              textAlign: 'center',
              backgroundColor: uploadDialog.isDragging 
                ? 'rgba(0, 122, 255, 0.05)' 
                : uploadDialog.file
                  ? 'rgba(52, 199, 89, 0.05)'
                  : '#f5f5f7',
              transition: 'all 0.2s',
              cursor: 'pointer',
              mb: 3
            }}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '*/*';
              input.onchange = (e: any) => {
                if (e.target.files && e.target.files[0]) {
                  setUploadDialog({ ...uploadDialog, file: e.target.files[0] });
                }
              };
              input.click();
            }}
          >
            {uploadDialog.file ? (
              <>
                <CheckCircleIcon sx={{ fontSize: 48, color: '#34C759', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 500, mb: 1 }}>
                  {uploadDialog.file.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {(uploadDialog.file.size / 1024 / 1024).toFixed(2)} MB
                </Typography>
              </>
            ) : (
              <>
                <CloudUploadIcon sx={{ fontSize: 48, color: '#86868b', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 500, mb: 1 }}>
                  Glissez-déposez votre fichier ici
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ou cliquez pour sélectionner un fichier
                </Typography>
              </>
            )}
          </Box>

          {/* Checkbox pour indiquer si c'est une facture (uniquement pour la catégorie facturation) */}
          {uploadDialog.category === 'facturation' && (
            <>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={uploadDialog.isInvoice}
                    onChange={(e) => setUploadDialog({ ...uploadDialog, isInvoice: e.target.checked })}
                    sx={{
                      color: '#007AFF',
                      '&.Mui-checked': {
                        color: '#007AFF'
                      }
                    }}
                  />
                }
                label="Ce document est une facture"
                sx={{ mb: 2 }}
              />

              {/* Champs de date si c'est une facture */}
              {uploadDialog.isInvoice && (
                <Box sx={{ 
                  p: 2, 
                  backgroundColor: '#f5f5f7', 
                  borderRadius: '12px',
                  border: '1px solid #e5e5ea'
                }}>
                  <TextField
                    fullWidth
                    label="Date d'envoi"
                    type="date"
                    value={uploadDialog.invoiceSentDate}
                    onChange={async (e) => {
                      const sentDate = new Date(e.target.value);
                      
                      // Récupérer le nombre de jours depuis la structure
                      let paymentTermsDays = 30;
                      if (mission?.structureId) {
                        try {
                          const structureDoc = await getDoc(doc(db, 'structures', mission.structureId));
                          paymentTermsDays = structureDoc.data()?.paymentTermsDays || 30;
                        } catch (error) {
                          console.error('Erreur lors de la récupération des termes de paiement:', error);
                        }
                      }
                      
                      // Calculer la date d'échéance
                      const dueDate = new Date(sentDate);
                      dueDate.setDate(dueDate.getDate() + paymentTermsDays);
                      
                      setUploadDialog({ 
                        ...uploadDialog, 
                        invoiceSentDate: e.target.value,
                        invoiceDueDate: dueDate.toISOString().split('T')[0]
                      });
                    }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="Date d'échéance"
                    type="date"
                    value={uploadDialog.invoiceDueDate}
                    onChange={(e) => setUploadDialog({ ...uploadDialog, invoiceDueDate: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                    helperText="Calculée automatiquement selon les paramètres de la structure"
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="Montant de la facture (€)"
                    type="number"
                    value={uploadDialog.invoiceAmount}
                    onChange={(e) => setUploadDialog({ ...uploadDialog, invoiceAmount: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                    helperText="TTC + notes de frais validées (montant calculé automatiquement, modifiable)"
                    inputProps={{
                      step: "0.01",
                      min: "0"
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: 'rgba(0, 122, 255, 0.03)',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 122, 255, 0.05)'
                        },
                        '&.Mui-focused': {
                          backgroundColor: 'white'
                        }
                      }
                    }}
                  />
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #e5e5ea' }}>
          <Button
            onClick={() => setUploadDialog({ 
              open: false,
              category: 'autres',
              file: null,
              isDragging: false,
              isInvoice: false,
              invoiceSentDate: new Date().toISOString().split('T')[0],
              invoiceDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              invoiceAmount: '0.00'
            })}
            sx={{
              textTransform: 'none',
              color: '#86868b',
              fontWeight: 500
            }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmUpload}
            disabled={!uploadDialog.file}
            sx={{
              textTransform: 'none',
              backgroundColor: '#007AFF',
              fontWeight: 500,
              '&:hover': {
                backgroundColor: '#0A84FF'
              },
              '&:disabled': {
                backgroundColor: '#f5f5f7',
                color: '#c7c7cc'
              }
            }}
          >
            Uploader
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MissionDetails;
