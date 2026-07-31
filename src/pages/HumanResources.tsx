import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Button,
  Tabs,
  Tab,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
  FormControl,
  InputLabel,
  Select,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  Email as EmailIcon,
  Edit as EditIcon,
  PersonOff as PersonOffIcon,
  DeleteOutline as DeleteIcon,
  Download as DownloadIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { inviteStructureMemberByEmail } from '../services/structureInviteService';
import JSZip from 'jszip';
import { CircularProgress, Skeleton } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, onSnapshot, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import axios from 'axios';
import TwoFactorDialog from '../components/common/TwoFactorDialog';
import { canAccessPage, type UserStatus } from '../utils/permissions';
import { formatPhoneDisplay } from '../utils/formatPhone';
import {
  ensureFileNameWithExtension,
  fetchDocumentBlobForDownload,
  is2FARequiredError,
  isImageContentType,
  isPdfContentType,
} from '../utils/decryptFileUtils';
import {
  decryptUserDisplayData,
  decryptUsersListProgressive,
  getDecryptedUserDisplayName,
} from '../utils/decryptUserUtils';
import { decryptUserForDocument, decryptStructureForDocument } from '../utils/documentDecryptUtils';
import UserNameText from '../components/common/UserNameText';
import UserNameSkeleton from '../components/common/UserNameSkeleton';
import { userNeedsNameDecrypt } from '../utils/decryptUserUtils';
import UserAvatarInitials from '../components/common/UserAvatarInitials';
import { Template } from '../types/templates';
import { usePermission } from '../hooks/usePermission';
import AccessDenied from '../components/common/AccessDenied';
import * as PDFLib from 'pdf-lib';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Document } from '../types/document';
import { orderBy } from 'firebase/firestore';
import { 
  InsertDriveFile as FileIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  Description as DocIcon,
} from '@mui/icons-material';
import { alpha } from '@mui/material';
import { tokens } from '../theme/tokens';
import { AppPageShell, dsTabsSx, KpiCard, FilterChipGroup } from '../components/ds';
import StatusChip from '../components/common/StatusChip';
import { getStructureAcademicConfig } from '../services/structureAcademicService';

interface HistoryEntry {
  id: string;
  date: string;
  action: string;
  details: string;
  type: 'mission' | 'profile' | 'document' | 'system';
  userId: string;
}

interface UserDetails {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  birthPlace: string;
  birthPostalCode: string;
  gender: string;
  nationality: string;
  email: string;
  studentId: string;
  graduationYear: string;
  campus?: string;
  program?: string;
  address: string;
  postalCode: string;
  city: string;
  socialSecurityNumber: string;
  phone: string;
  status?: 'Étudiant' | 'Membre' | 'Admin' | 'Superadmin';
  photoURL?: string;
  dossierValidated?: boolean;
  dossierValidationDate?: string;
  dossierValidatedBy?: string;
  lastLogin?: Timestamp;
  isOnline?: boolean;
  documents: {
    name: string;
    date: string;
    size: string;
  }[];
  missions?: {
    id: string;
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    status: 'En cours' | 'Terminée' | 'Annulée';
    location: string;
    remuneration: string;
  }[];
  history?: HistoryEntry[];
}

const STATUS_FILTER_OPTIONS = ['Étudiants', 'Membres', 'Administrateurs'];
const STATUS_FILTER_TO_VALUE: Record<string, string> = {
  Étudiants: 'Étudiant',
  Membres: 'Membre',
  Administrateurs: 'Admin',
};
const STATUS_VALUE_TO_FILTER = Object.fromEntries(
  Object.entries(STATUS_FILTER_TO_VALUE).map(([label, value]) => [value, label]),
);

const COMPLETION_FILTER_OPTIONS = ['Complétés', 'Incomplets'];
const COMPLETION_FILTER_TO_VALUE: Record<string, string> = {
  Complétés: 'complete',
  Incomplets: 'incomplete',
};
const COMPLETION_VALUE_TO_FILTER = Object.fromEntries(
  Object.entries(COMPLETION_FILTER_TO_VALUE).map(([label, value]) => [value, label]),
);

const VALIDATION_FILTER_OPTIONS = ['Validés', 'Non validés'];
const VALIDATION_FILTER_TO_VALUE: Record<string, string> = {
  Validés: 'validated',
  'Non validés': 'notValidated',
};
const VALIDATION_VALUE_TO_FILTER = Object.fromEntries(
  Object.entries(VALIDATION_FILTER_TO_VALUE).map(([label, value]) => [value, label]),
);

const HumanResources = () => {
  const { currentUser, updateLastActivity } = useAuth();
  const { canRead, canWrite, loading: permissionLoading } = usePermission('rh');
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserDetails[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userNamesDecrypting, setUserNamesDecrypting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [currentTab, setCurrentTab] = useState(0);
  const [conventionTemplate, setConventionTemplate] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [userHistory, setUserHistory] = useState<HistoryEntry[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isHRMember, setIsHRMember] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [completionFilters, setCompletionFilters] = useState<string[]>([]);
  const [validationFilters, setValidationFilters] = useState<string[]>([]);

  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editedUser, setEditedUser] = useState<UserDetails | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [currentUserStatus, setCurrentUserStatus] = useState<string>('');
  const [decryptedUserData, setDecryptedUserData] = useState<UserDetails | null>(null);
  const [twoFactorDialogOpen, setTwoFactorDialogOpen] = useState(false);
  const [hasDecryptionAccess, setHasDecryptionAccess] = useState(false);
  const [hasTwoFactor, setHasTwoFactor] = useState(false);
  const [userDocuments, setUserDocuments] = useState<Document[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [downloadingAllDocuments, setDownloadingAllDocuments] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    current: number;
    total: number;
    phase: 'decrypt' | 'zip';
  } | null>(null);
  const [userStructureId, setUserStructureId] = useState<string | null>(null);
  const [structurePrograms, setStructurePrograms] = useState<string[]>([]);
  const [structureCampuses, setStructureCampuses] = useState<string[]>([]);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isInlineEditDecrypting, setIsInlineEditDecrypting] = useState(false);
  const [isGeneratingConvention, setIsGeneratingConvention] = useState(false);
  const [pendingEditAfterDecrypt, setPendingEditAfterDecrypt] = useState(false);
  // Ref pour suivre si la génération est en cours (pour éviter les problèmes de closure)
  const isGeneratingConventionRef = useRef(false);
  
  // Cache pour le PDF template (éviter de re-télécharger à chaque génération)
  const templatePdfCacheRef = useRef<{ templateId: string; pdfUrl: string; arrayBuffer: ArrayBuffer } | null>(null);
  // Cache pour les données de la structure et du président (pré-calculées une fois)
  const conventionContextCacheRef = useRef<{ structureId: string; structureInfo: any; presidentFullName: string } | null>(null);
  
  // États pour le viewer de document
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerContentType, setViewerContentType] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [currentViewingDocument, setCurrentViewingDocument] = useState<Document | null>(null);
  const [twoFactorDocumentOpen, setTwoFactorDocumentOpen] = useState(false);
  const [pendingDecryptDocument, setPendingDecryptDocument] = useState<{
    path: string;
    token: string;
    document: Document;
  } | null>(null);
  const [pendingBulkDownload, setPendingBulkDownload] = useState<{
    token: string;
    documents: Document[];
  } | null>(null);

  // IDs des utilisateurs dont la photo de profil a échoué (404) pour afficher les initiales
  const [failedPhotoIds, setFailedPhotoIds] = useState<Set<string>>(new Set());

  // Dialog modification mot de passe (superadmin)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [searchParams] = useSearchParams();

  // Fonction pour normaliser les statuts de la base de données vers les valeurs des filtres
  const normalizeStatusForFilter = (status: string | undefined | null): string => {
    if (!status) return '';
    const normalized = status.trim().toLowerCase();
    const statusMap: { [key: string]: string } = {
      'etudiant': 'Étudiant',
      'student': 'Étudiant',
      'membre': 'Membre',
      'member': 'Membre',
      'admin': 'Admin',
      'administrator': 'Admin',
      'superadmin': 'Superadmin',
      'super admin': 'Superadmin'
    };
    return statusMap[normalized] || status;
  };

  // Fonction pour formater les statuts en français avec majuscules
  const getStatusLabel = (status: string | undefined | null): string => {
    if (!status || status.trim() === '') return 'NON DÉFINI';
    
    const statusMap: { [key: string]: string } = {
      'Étudiant': 'ÉTUDIANT',
      'Membre': 'MEMBRE',
      'Admin': 'ADMINISTRATEUR',
      'Superadmin': 'SUPER ADMINISTRATEUR',
      'Student': 'ÉTUDIANT',
      'Member': 'MEMBRE',
      'member': 'MEMBRE',
      'etudiant': 'ÉTUDIANT',
      'membre': 'MEMBRE',
      'admin': 'ADMINISTRATEUR',
      'superadmin': 'SUPER ADMINISTRATEUR',
      'Administrator': 'ADMINISTRATEUR',
      'SuperAdmin': 'SUPER ADMINISTRATEUR'
    };
    const normalizedStatus = status.trim();
    const label = statusMap[normalizedStatus] || statusMap[normalizedStatus.toLowerCase()] || normalizedStatus.toUpperCase();
    return label;
  };

  // Fonction pour obtenir la couleur du statut
  const getStatusColor = (status: string | undefined | null): 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'default' => {
    if (!status) return 'default';
    
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus.includes('étudiant') || normalizedStatus.includes('student')) {
      return 'primary';
    } else if (normalizedStatus.includes('membre') || normalizedStatus.includes('member')) {
      return 'success';
    } else if (normalizedStatus.includes('admin') || normalizedStatus.includes('administrator')) {
      return 'info';
    } else if (normalizedStatus.includes('super')) {
      return 'error';
    }
    return 'default';
  };

  const getUserStatusChipProps = (status: string | undefined | null): { status: string; sx?: object } => {
    const normalized = normalizeStatusForFilter(status);
    if (normalized === 'Étudiant') return { status: 'pending' };
    if (normalized === 'Membre') return { status: 'active' };
    if (normalized === 'Admin') {
      return { status: 'inactive', sx: { bgcolor: tokens.colors.infoLight, color: tokens.colors.info } };
    }
    return { status: 'inactive' };
  };

  // Définir la fonction isProfileComplete au début du composant
  const isProfileComplete = (user: UserDetails | null) => {
    if (!user) return false;
    
    const requiredFields = [
      user.firstName,
      user.lastName,
      user.birthDate,
      user.birthPlace,
      user.birthPostalCode,
      user.gender,
      user.nationality,
      user.email,
      user.studentId,
      user.graduationYear,
      user.address,
      user.socialSecurityNumber,
      user.phone
    ];

    return requiredFields.every(field => field && field.trim() !== '');
  };

  // Fonction pour vérifier si une valeur est cryptée
  const isEncrypted = (value: any): boolean => {
    return typeof value === 'string' && value.startsWith('ENC:');
  };

  // Fonction pour formater l'affichage d'une valeur (cryptée ou non)
  const formatValue = (value: any, fieldName: string): { display: string; isEncrypted: boolean } => {
    if (!value || value === '') {
      return { display: '[Non renseigné]', isEncrypted: false };
    }
    
    if (isEncrypted(value)) {
      return { 
        display: 'Données cryptées', 
        isEncrypted: true 
      };
    }
    
    if (fieldName === 'phone') {
      return { display: formatPhoneDisplay(String(value)), isEncrypted: false };
    }
    
    return { display: String(value), isEncrypted: false };
  };

  const SENSITIVE_USER_FIELDS: (keyof UserDetails)[] = [
    'firstName', 'lastName', 'birthDate', 'birthPlace', 'birthPostalCode',
    'gender', 'nationality', 'email', 'phone', 'address', 'postalCode', 'city',
    'studentId', 'graduationYear', 'socialSecurityNumber',
  ];

  const userHasEncryptedFields = (user: UserDetails): boolean =>
    SENSITIVE_USER_FIELDS.some((field) => isEncrypted(user[field]));

  const mergeDecryptedIntoUser = (base: UserDetails, decryptedData: Record<string, unknown>): UserDetails => {
    const merged: UserDetails = { ...base, ...decryptedData } as UserDetails;
    SENSITIVE_USER_FIELDS.forEach((field) => {
      const value = decryptedData[field as string];
      if (value != null && value !== '' && !isEncrypted(value)) {
        (merged as unknown as Record<string, unknown>)[field as string] = value;
      }
    });
    return merged;
  };

  /** Décryptage complet via la CF structure (accès page RH = accès aux données). */
  const decryptUserViaStructure = async (user: UserDetails): Promise<UserDetails | null> => {
    const decrypted = await decryptUserForDocument(user.id, user as Record<string, unknown>);
    if (!decrypted) return null;
    return mergeDecryptedIntoUser(user, decrypted as Record<string, unknown>);
  };

  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser) {
        setUsersLoading(false);
        return;
      }

      setUsersLoading(true);
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!userDocSnap.exists()) {
          console.error("Utilisateur non trouvé");
          return;
        }

        const structureId = userDocSnap.data()?.structureId;
        setUserStructureId(structureId);

        if (structureId) {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('structureId', '==', structureId));
          const querySnapshot = await getDocs(q);
          
          const usersData = querySnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            const graduationYear = data.graduationYear || data.studyYear || '';
            return {
              id: docSnap.id,
              ...data,
              graduationYear,
              lastLogin: data.lastLogin || null,
              isOnline: data.isOnline || false
            };
          }) as UserDetails[];

          const seenEmails = new Set<string>();
          const deduplicated = usersData.filter((u) => {
            const email = (u.email && typeof u.email === 'string' ? u.email : '').trim().toLowerCase();
            if (!email) return true;
            if (seenEmails.has(email)) return false;
            seenEmails.add(email);
            return true;
          });
          setUsers(deduplicated);
          setUserNamesDecrypting(true);
          void decryptUsersListProgressive(deduplicated, (updated) => {
            setUsers(updated);
            setUserNamesDecrypting(false);
          }).catch(() => setUserNamesDecrypting(false));

          void fetchConventionTemplate(structureId);
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des données:", error);
      } finally {
        setUsersLoading(false);
      }
    };

    fetchUsers();
  }, [currentUser]);

  useEffect(() => {
    if (!userStructureId) {
      setStructurePrograms([]);
      setStructureCampuses([]);
      return;
    }

    let cancelled = false;
    void getStructureAcademicConfig(userStructureId)
      .then((config) => {
        if (!cancelled) {
          setStructurePrograms(config.programs);
          setStructureCampuses(config.campuses);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStructurePrograms([]);
          setStructureCampuses([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userStructureId]);

  useEffect(() => {
    const checkUserRole = async () => {
      if (!currentUser) return;

      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!userDocSnap.exists()) {
          console.error("Utilisateur non trouvé");
          return;
        }

        const userData = userDocSnap.data();
        console.log("Données utilisateur:", userData); // Debug
        
        // Stocker le statut actuel de l'utilisateur
        const userStatus = userData.status || '';
        setCurrentUserStatus(userStatus);
        console.log("Statut utilisateur stocké:", userStatus);
        
        // Vérifier si l'utilisateur est admin ou superadmin
        const normalizedStatus = (userData.status || '').toLowerCase();
        const isUserAdmin = normalizedStatus === 'admin' || normalizedStatus === 'admin_structure';
        const isUserSuperAdmin = normalizedStatus === 'superadmin';
        
        setIsAdmin(isUserAdmin);
        setIsSuperAdmin(isUserSuperAdmin);
        
        const isHR = userData.poles?.some((pole: { poleId?: string; name?: string }) => 
          pole.poleId === 'rh' || pole.name === 'Ressources humaines'
        );
        setIsHRMember(!!isHR);
        
        setHasTwoFactor(userData.twoFactorEnabled === true);
        setHasDecryptionAccess(isUserAdmin || isUserSuperAdmin || !!isHR);
      } catch (error) {
        console.error("Erreur lors de la vérification du rôle:", error);
      }
    };

    checkUserRole();
  }, [currentUser]);

  // Accès page RH (Réglages > Accès) = accès décryptage / édition des données membres
  useEffect(() => {
    if (canRead) {
      setHasDecryptionAccess(true);
    }
  }, [canRead]);

  // Ajoutons une fonction pour vérifier si l'utilisateur peut valider les dossiers
  const canValidateDossier = () => {
    return isAdmin || isHRMember || isSuperAdmin;
  };

  // Ajoutons un log pour déboguer
  useEffect(() => {
    console.log("Peut valider les dossiers:", canValidateDossier());
    console.log("isAdmin:", isAdmin);
    console.log("isHRMember:", isHRMember);
    console.log("isSuperAdmin:", isSuperAdmin);
  }, [isAdmin, isHRMember, isSuperAdmin]);

  // Modifions la fonction de filtrage pour prendre en compte les sélections multiples
  const filteredUsers = users
    .filter(user => {
      // Vérifier si user est défini
      if (!user) return false;
      
      // Exclure les super administrateurs
      const normalizedUserStatus = normalizeStatusForFilter(user.status);
      if (normalizedUserStatus === 'Superadmin') return false;
      
      // Filtre par recherche
      const matchesSearch = 
        (user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
        (user.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
        (user.email?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
      
      // Filtre par statut (sélection multiple)
      const matchesStatus = statusFilters.length === 0 || (normalizedUserStatus && statusFilters.includes(normalizedUserStatus));
      
      // Filtre par complétion (sélection multiple)
      const isComplete = isProfileComplete(user);
      const matchesCompletion = 
        completionFilters.length === 0 || 
        (completionFilters.includes('complete') && isComplete) || 
        (completionFilters.includes('incomplete') && !isComplete);
      
      // Filtre par validation (sélection multiple)
      const matchesValidation = 
        validationFilters.length === 0 || 
        (validationFilters.includes('validated') && user.dossierValidated) || 
        (validationFilters.includes('notValidated') && !user.dossierValidated);
      
      return matchesSearch && matchesStatus && matchesCompletion && matchesValidation;
    })
    .sort((a, b) => {
      // Tri alphabétique par nom de famille, puis par prénom
      const lastNameA = (a.lastName || '').toLowerCase();
      const lastNameB = (b.lastName || '').toLowerCase();
      if (lastNameA !== lastNameB) {
        return lastNameA.localeCompare(lastNameB, 'fr');
      }
      const firstNameA = (a.firstName || '').toLowerCase();
      const firstNameB = (b.firstName || '').toLowerCase();
      return firstNameA.localeCompare(firstNameB, 'fr');
    });

  const hrMetrics = useMemo(() => {
    const members = users.filter((user) => normalizeStatusForFilter(user.status) !== 'Superadmin');
    return {
      totalMembers: members.length,
      onlineCount: members.filter((user) => user.isOnline).length,
      completeProfiles: members.filter((user) => isProfileComplete(user)).length,
      validatedDossiers: members.filter((user) => user.dossierValidated).length,
    };
  }, [users]);

  const handleUserClick = (user: UserDetails) => {
    setSelectedUser(user);
    setDecryptedUserData(null); // Réinitialiser les données décryptées lors du changement d'utilisateur
    fetchUserHistory(user.id);
    fetchUserDocuments(user.id);
  };

  // Fonction pour récupérer les documents de l'utilisateur
  const fetchUserDocuments = async (userId: string) => {
    if (!currentUser || !userStructureId) return;
    
    setLoadingDocuments(true);
    try {
      const docsList: Document[] = [];
      
      // 1. Récupérer les documents depuis structures/{structureId}/documents
      try {
        const docsRef = collection(db, 'structures', userStructureId, 'documents');
        const docsQuery = query(
          docsRef,
          where('uploadedBy', '==', userId),
          orderBy('createdAt', 'desc')
        );
        
        const docsSnapshot = await getDocs(docsQuery);
        
        for (const docSnap of docsSnapshot.docs) {
          const data = docSnap.data();
          // Exclure les documents liés aux missions pour l'instant
          if (data.missionId) continue;
          
          // Récupérer le nom de l'utilisateur
          let uploadedByName = '';
          try {
            if (data.uploadedBy) {
              const userDoc = await getDoc(doc(db, 'users', data.uploadedBy));
              const userData = userDoc.data();
              uploadedByName = await getDecryptedUserDisplayName(data.uploadedBy, userData || null);
            }
          } catch (e) {
            console.error('Erreur lors de la récupération du nom utilisateur:', e);
          }

          docsList.push({
            id: docSnap.id,
            ...data,
            uploadedByName,
            createdAt: data.createdAt,
          } as Document);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des documents de structure:', error);
      }
      
      // 2. Récupérer les documents personnels depuis le profil utilisateur
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        const userData = userDoc.data();
        
        if (userData) {
          // Fonction helper pour créer un document depuis une URL
          const createDocumentFromUrl = (url: string | undefined, displayName: string, type: string = 'application/pdf'): Document | null => {
            if (!url) return null;
            
            // Convertir la date en Timestamp si nécessaire
            let createdAt: Timestamp | Date = Timestamp.now();
            if (userData.updatedAt) {
              createdAt = userData.updatedAt instanceof Timestamp ? userData.updatedAt : 
                         userData.updatedAt instanceof Date ? userData.updatedAt : 
                         new Date(userData.updatedAt);
            } else if (userData.createdAt) {
              createdAt = userData.createdAt instanceof Timestamp ? userData.createdAt : 
                         userData.createdAt instanceof Date ? userData.createdAt : 
                         new Date(userData.createdAt);
            }
            
            return {
              id: `profile_${displayName.toLowerCase().replace(/\s+/g, '_')}`,
              name: displayName, // Utiliser le displayName comme nom d'affichage
              url: url,
              type: type,
              size: 0, // Taille inconnue pour les documents du profil
              storagePath: url, // Utiliser l'URL comme storagePath pour les documents du profil
              parentFolderId: null,
              uploadedBy: userId,
              uploadedByName: userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Inconnu',
              createdAt: createdAt,
              structureId: userData.structureId || userStructureId || '',
              isRestricted: false,
            } as Document;
          };
          
          // Ajouter les documents personnels
          if (userData.cvUrl) {
            const doc = createDocumentFromUrl(userData.cvUrl, 'CV', 'application/pdf');
            if (doc) docsList.push(doc);
          }
          
          if (userData.identityCardUrl) {
            const doc = createDocumentFromUrl(userData.identityCardUrl, 'Carte d\'identité', 'application/pdf');
            if (doc) docsList.push(doc);
          }
          
          if (userData.identityCardRectoUrl) {
            const doc = createDocumentFromUrl(userData.identityCardRectoUrl, 'Carte d\'identité (Recto)', 'application/pdf');
            if (doc) docsList.push(doc);
          }
          
          if (userData.identityCardVersoUrl) {
            const doc = createDocumentFromUrl(userData.identityCardVersoUrl, 'Carte d\'identité (Verso)', 'application/pdf');
            if (doc) docsList.push(doc);
          }
          
          if (userData.ribUrl) {
            const doc = createDocumentFromUrl(userData.ribUrl, 'RIB', 'application/pdf');
            if (doc) docsList.push(doc);
          }
          
          if (userData.schoolCertificateUrl) {
            const doc = createDocumentFromUrl(userData.schoolCertificateUrl, 'Certificat de scolarité', 'application/pdf');
            if (doc) docsList.push(doc);
          }
          
          if (userData.healthCardUrl) {
            const doc = createDocumentFromUrl(userData.healthCardUrl, 'Carte Vitale', 'application/pdf');
            if (doc) docsList.push(doc);
          }
          
          // Ajouter les documents personnalisés
          if (userData.customDocuments && Array.isArray(userData.customDocuments)) {
            for (const customDoc of userData.customDocuments) {
              if (customDoc.url) {
                const doc = createDocumentFromUrl(
                  customDoc.url,
                  customDoc.name || 'Document personnalisé',
                  'application/pdf'
                );
                if (doc) {
                  doc.id = `custom_${customDoc.id || Date.now()}`;
                  // Convertir uploadedAt en Timestamp si nécessaire
                  if (customDoc.uploadedAt) {
                    doc.createdAt = customDoc.uploadedAt instanceof Timestamp ? customDoc.uploadedAt : 
                                   customDoc.uploadedAt instanceof Date ? customDoc.uploadedAt : 
                                   new Date(customDoc.uploadedAt);
                  }
                  docsList.push(doc);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des documents personnels:', error);
      }
      
      // Trier par date de création (plus récent en premier)
      docsList.sort((a, b) => {
        const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 
                     a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 
                     b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      
      setUserDocuments(docsList);
    } catch (error) {
      console.error('Erreur lors de la récupération des documents:', error);
      setUserDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  // Fonction pour obtenir l'icône selon le type de fichier
  const getFileIcon = (type: string, name: string) => {
    if (type === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) {
      return <PdfIcon sx={{ fontSize: 32, color: '#d32f2f' }} />;
    }
    if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(name)) {
      return <ImageIcon sx={{ fontSize: 32, color: '#1976d2' }} />;
    }
    if (type.includes('word') || /\.(doc|docx)$/i.test(name)) {
      return <DocIcon sx={{ fontSize: 32, color: '#1976d2' }} />;
    }
    return <FileIcon sx={{ fontSize: 32, color: '#757575' }} />;
  };

  // Fonction pour formater la taille du fichier
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const extractPathFromStorageUrl = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const pathStartIndex = urlObj.pathname.indexOf('/o/') + 3;
      if (pathStartIndex > 2) {
        const encodedPath = urlObj.pathname.substring(pathStartIndex).split('?')[0];
        return decodeURIComponent(encodedPath.replace(/%2F/g, '/'));
      }
    } catch (e) {
      console.error('Erreur parsing URL Storage:', e);
    }
    return null;
  };

  const extractDocumentStoragePath = (doc: Document): string | null => {
    if (doc.storagePath && !doc.storagePath.startsWith('http')) {
      return doc.storagePath;
    }
    if (doc.storagePath?.startsWith('http')) {
      const fromStoragePath = extractPathFromStorageUrl(doc.storagePath);
      if (fromStoragePath) return fromStoragePath;
    }
    if (doc.url) return extractPathFromStorageUrl(doc.url);
    return null;
  };

  const sanitizeZipEntryName = (name: string, usedNames: Set<string>): string => {
    let base = (name || 'document').replace(/[/\\?%*:|"<>]/g, '_').trim() || 'document';
    if (!usedNames.has(base)) {
      usedNames.add(base);
      return base;
    }
    const dot = base.lastIndexOf('.');
    const ext = dot > 0 ? base.slice(dot) : '';
    const stem = dot > 0 ? base.slice(0, dot) : base;
    let i = 2;
    let candidate = `${stem}_${i}${ext}`;
    while (usedNames.has(candidate)) {
      i += 1;
      candidate = `${stem}_${i}${ext}`;
    }
    usedNames.add(candidate);
    return candidate;
  };

  /** Décrypte un document (decryptFile + repli Storage si 404), comme à l'ouverture. */
  const fetchDecryptedDocumentBlob = async (
    doc: Document,
    token: string,
    twoFactorCode?: string
  ): Promise<{ blob: Blob; contentType: string }> => {
    const path = extractDocumentStoragePath(doc);
    if (!path) {
      throw new Error(`Chemin Storage introuvable pour « ${doc.name} »`);
    }
    return fetchDocumentBlobForDownload({
      filePath: path,
      token,
      twoFactorCode,
      timeout: 120000,
    });
  };

  const handleDownloadAllDocuments = async (twoFactorCode?: string) => {
    if (!selectedUser || userDocuments.length === 0) return;

    const firebaseUser = getAuth().currentUser;
    if (!firebaseUser) {
      setSnackbar({ open: true, message: 'Utilisateur non authentifié', severity: 'error' });
      return;
    }

    setDownloadingAllDocuments(true);
    setDownloadProgress(null);
    try {
      const token = twoFactorCode && pendingBulkDownload?.token
        ? pendingBulkDownload.token
        : await firebaseUser.getIdToken(true);
      const docsToDownload = pendingBulkDownload?.documents ?? userDocuments;
      const total = docsToDownload.length;

      // Phase 1 : décrypter tous les documents avant toute mise en ZIP
      const decryptedEntries: { doc: Document; blob: Blob; contentType: string }[] = [];
      const failedNames: string[] = [];

      setDownloadProgress({ current: 0, total, phase: 'decrypt' });

      for (let i = 0; i < docsToDownload.length; i += 1) {
        const doc = docsToDownload[i];
        setDownloadProgress({ current: i, total, phase: 'decrypt' });

        if (!doc.url && !doc.storagePath) {
          failedNames.push(doc.name);
          continue;
        }

        try {
          const { blob, contentType } = await fetchDecryptedDocumentBlob(doc, token, twoFactorCode);
          decryptedEntries.push({ doc, blob, contentType });
        } catch (err: unknown) {
          const axiosErr = err as { response?: { status?: number } };
          if (!twoFactorCode && axiosErr?.response?.status === 403 && is2FARequiredError(err)) {
            setPendingBulkDownload({ token, documents: docsToDownload });
            setTwoFactorDocumentOpen(true);
            setDownloadProgress(null);
            return;
          }
          failedNames.push(doc.name);
        }

        setDownloadProgress({ current: i + 1, total, phase: 'decrypt' });
      }

      if (decryptedEntries.length === 0) {
        setSnackbar({
          open: true,
          message: 'Aucun document n\'a pu être déchiffré.',
          severity: 'error',
        });
        setDownloadProgress(null);
        return;
      }

      // Phase 2 : assembler le ZIP uniquement à partir des blobs déchiffrés
      setDownloadProgress({ current: 0, total: decryptedEntries.length, phase: 'zip' });
      const zip = new JSZip();
      const usedNames = new Set<string>();

      for (const { doc, blob, contentType } of decryptedEntries) {
        const entryName = ensureFileNameWithExtension(
          sanitizeZipEntryName(doc.name, usedNames),
          contentType
        );
        const buffer = await blob.arrayBuffer();
        const isBinary =
          contentType.startsWith('application/pdf') || contentType.startsWith('image/');
        zip.file(entryName, buffer, isBinary ? { compression: 'STORE' } : undefined);
      }

      setDownloadProgress({ current: decryptedEntries.length, total: decryptedEntries.length, phase: 'zip' });
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/zip',
      });
      const fileCount = decryptedEntries.length;
      const label =
        [selectedUser.firstName, selectedUser.lastName].filter(Boolean).join('_') ||
        selectedUser.id.slice(0, 8);
      const link = document.createElement('a');
      const objectUrl = URL.createObjectURL(zipBlob);
      link.href = objectUrl;
      link.download = `documents_${label}_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);

      if (currentUser) {
        try {
          await addDoc(collection(db, 'history'), {
            userId: selectedUser.id,
            date: new Date().toISOString(),
            action: 'Téléchargement de documents',
            details: `${fileCount} document(s) exporté(s) en ZIP par ${currentUser.displayName || currentUser.email}`,
            type: 'document',
          });
          fetchUserHistory(selectedUser.id);
        } catch (historyError) {
          console.error('Erreur log historique:', historyError);
        }
      }

      const failed = failedNames.length;
      setSnackbar({
        open: true,
        message:
          failed > 0
            ? `${fileCount} document(s) déchiffré(s) et téléchargé(s). ${failed} en échec.`
            : `${fileCount} document(s) déchiffré(s) et téléchargé(s) dans une archive ZIP.`,
        severity: failed > 0 ? 'warning' : 'success',
      });
      setPendingBulkDownload(null);
    } catch (error) {
      console.error('Erreur téléchargement groupé:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors du téléchargement des documents.',
        severity: 'error',
      });
    } finally {
      setDownloadingAllDocuments(false);
      setDownloadProgress(null);
    }
  };

  // Fonction pour ouvrir/télécharger un document avec support du décryptage
  const handleDocumentClick = async (document: Document) => {
    if (!document.url) return;
    
    try {
      const path = extractDocumentStoragePath(document);
      
      // Si on ne peut pas extraire le chemin, ouvrir directement l'URL
      if (!path) {
        window.open(document.url, '_blank');
        return;
      }

      if (path) {
        const auth = getAuth();
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) {
          throw new Error('Utilisateur Firebase non authentifié');
        }
        const token = await firebaseUser.getIdToken(true);

        setViewerOpen(true);
        setCurrentViewingDocument(document);
        setViewerLoading(true);
        setViewerError(null);
        if (viewerUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(viewerUrl);
        }
        setViewerUrl(null);
        setViewerContentType(null);

        const logDocumentView = async () => {
          if (!selectedUser || !currentUser) return;
          try {
            await addDoc(collection(db, 'history'), {
              userId: selectedUser.id,
              date: new Date().toISOString(),
              action: 'Consultation de document',
              details: `Document "${document.name}" consulté par ${currentUser.displayName || currentUser.email}`,
              type: 'document',
            });
            fetchUserHistory(selectedUser.id);
          } catch (historyError) {
            console.error('Erreur lors de l\'ajout du log dans l\'historique:', historyError);
          }
        };

        try {
          const { blob, contentType } = await fetchDocumentBlobForDownload({
            filePath: path,
            token,
            timeout: 120000,
          });
          const url = URL.createObjectURL(blob);
          const resolvedType =
            contentType && contentType !== 'application/octet-stream'
              ? contentType
              : document.type || contentType;
          setViewerContentType(resolvedType);
          setViewerUrl(url);
          setViewerLoading(false);
          await logDocumentView();
        } catch (err: any) {
          if (err?.response?.status === 403 && is2FARequiredError(err)) {
            setViewerOpen(false);
            setViewerLoading(false);
            setCurrentViewingDocument(null);
            setPendingDecryptDocument({ path, token, document });
            setTwoFactorDocumentOpen(true);
            return;
          }
          setViewerError(
            err?.response?.status === 403
              ? 'Accès refusé à ce document chiffré'
              : `Erreur lors de l'ouverture du document: ${err?.message || 'Erreur inconnue'}`
          );
          setViewerLoading(false);
        }
      }
    } catch (error: any) {
      console.error(`Erreur lors de l'ouverture du document:`, error);
      setViewerError(`Erreur lors de l'ouverture du document`);
    }
  };

  const handleVerifyDocument2FA = async (code: string) => {
    if (pendingBulkDownload) {
      setTwoFactorDocumentOpen(false);
      await handleDownloadAllDocuments(code);
      return;
    }

    const pending = pendingDecryptDocument;
    if (!pending) throw new Error('Session expirée. Veuillez rouvrir le document.');
    const { blob, contentType } = await fetchDocumentBlobForDownload({
      filePath: pending.path,
      token: pending.token,
      twoFactorCode: code,
      timeout: 120000,
    });
    const url = URL.createObjectURL(blob);
    setViewerContentType(contentType);
    setViewerUrl(url);
    setCurrentViewingDocument(pending.document);
    setViewerOpen(true);
    setViewerError(null);
    setPendingDecryptDocument(null);
    setTwoFactorDocumentOpen(false);
    if (selectedUser && currentUser) {
      try {
        await addDoc(collection(db, 'history'), {
          userId: selectedUser.id,
          date: new Date().toISOString(),
          action: 'Consultation de document',
          details: `Document "${pending.document.name}" consulté par ${currentUser.displayName || currentUser.email}`,
          type: 'document',
        });
        fetchUserHistory(selectedUser.id);
      } catch (e) {
        console.error('Erreur log historique:', e);
      }
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const fetchConventionTemplate = async (structureId: string) => {
    try {
      console.log('[fetchConventionTemplate] Recherche du template pour convention_etudiant, structureId:', structureId);
      
      // Chercher d'abord dans les assignations de la structure (comme dans TemplateAssignment.tsx)
      // Utiliser l'ID composite comme dans TemplateAssignment: structureId_documentType
      const assignmentId = `${structureId}_convention_etudiant`;
      let assignmentDoc;
      
      try {
        // Essayer de récupérer directement l'assignation avec l'ID composite
        assignmentDoc = await getDoc(doc(db, 'templateAssignments', assignmentId));
        
        if (assignmentDoc.exists()) {
          const assignmentData = assignmentDoc.data();
          const templateId = assignmentData.templateId;
          console.log('[fetchConventionTemplate] Template assigné trouvé via ID composite:', templateId);
          
          // Vérifier que le template existe toujours
          const templateDoc = await getDoc(doc(db, 'templates', templateId));
          if (templateDoc.exists()) {
            setConventionTemplate(templateId);
            return;
          } else {
            console.warn('[fetchConventionTemplate] Template assigné n\'existe plus, recherche alternative...');
          }
        }
      } catch (error) {
        console.warn('[fetchConventionTemplate] Erreur lors de la récupération via ID composite:', error);
      }
      
      // Fallback: Chercher dans les assignations de la structure avec une query
      const assignmentsQuery = query(
        collection(db, 'templateAssignments'),
        where('structureId', '==', structureId),
        where('documentType', '==', 'convention_etudiant')
      );
      
      let assignmentsSnapshot;
      try {
        assignmentsSnapshot = await getDocs(assignmentsQuery);
      } catch (queryError: any) {
        // Si l'index n'existe pas, charger toutes les assignations et filtrer
        console.warn('[fetchConventionTemplate] Index non disponible, chargement de toutes les assignations...');
        const allAssignmentsQuery = query(
          collection(db, 'templateAssignments'),
          where('structureId', '==', structureId)
        );
        const allAssignmentsSnapshot = await getDocs(allAssignmentsQuery);
        assignmentsSnapshot = {
          docs: allAssignmentsSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.documentType === 'convention_etudiant';
          })
        } as any;
      }

      if (!assignmentsSnapshot.empty) {
        const templateId = assignmentsSnapshot.docs[0].data().templateId;
        console.log('[fetchConventionTemplate] Template assigné trouvé via query:', templateId);
        
        // Vérifier que le template existe toujours
        const templateDoc = await getDoc(doc(db, 'templates', templateId));
        if (templateDoc.exists()) {
          setConventionTemplate(templateId);
          return;
        } else {
          console.warn('[fetchConventionTemplate] Template assigné n\'existe plus');
        }
      }
      
      // Si aucun template assigné, chercher un template universel
      console.log('[fetchConventionTemplate] Aucun template assigné, recherche d\'un template universel...');
      const universalTemplatesQuery = query(
        collection(db, 'templates'),
        where('isUniversal', '==', true),
        where('universalDocumentType', '==', 'convention_etudiant')
      );
      
      let universalTemplatesSnapshot;
      try {
        universalTemplatesSnapshot = await getDocs(universalTemplatesQuery);
      } catch (queryError: any) {
        // Si l'index n'existe pas, charger tous les templates universels et filtrer
        console.warn('[fetchConventionTemplate] Index universel non disponible, chargement de tous les templates...');
        const allTemplatesQuery = query(
          collection(db, 'templates'),
          where('isUniversal', '==', true)
        );
        const allTemplatesSnapshot = await getDocs(allTemplatesQuery);
        universalTemplatesSnapshot = {
          docs: allTemplatesSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.universalDocumentType === 'convention_etudiant';
          })
        } as any;
      }
      
      if (!universalTemplatesSnapshot.empty) {
        const templateId = universalTemplatesSnapshot.docs[0].id;
        console.log('[fetchConventionTemplate] Template universel trouvé:', templateId);
        setConventionTemplate(templateId);
      } else {
        console.warn('[fetchConventionTemplate] Aucun template trouvé (ni assigné ni universel)');
        setConventionTemplate(null);
      }
    } catch (error) {
      console.error('[fetchConventionTemplate] Erreur lors de la récupération du template:', error);
      setConventionTemplate(null);
    }
  };

  // Fonction pour convertir variableId en balise
  const getTagFromVariableId = (variableId: string): string => {
    const tagMap: { [key: string]: string } = {
      // User/Étudiant
      lastName: '<user_nom>',
      firstName: '<user_prenom>',
      email: '<user_email>',
      ecole: '<user_ecole>',
      displayName: '<user_nom_complet>',
      phone: '<user_telephone>',
      socialSecurityNumber: '<user_numero_securite_sociale>',
      studentId: '<user_numero_etudiant>',
      address: '<user_adresse>',
      city: '<user_ville>',
      postalCode: '<user_code_postal>',
      country: '<user_pays>',
      formation: '<user_formation>',
      program: '<user_programme>',
      campus: '<user_campus>',
      graduationYear: '<user_annee_diplome>',
      nationality: '<user_nationalite>',
      gender: '<user_genre>',
      birthPlace: '<user_lieu_naissance>',
      birthDate: '<user_date_naissance>',
      
      // Mission
      numeroMission: '<mission_numero>',
      chargeName: '<mission_cdm>',
      missionDateDebut: '<mission_date_debut>',
      missionDateHeureDebut: '<mission_date_heure_debut>',
      missionDateFin: '<mission_date_fin>',
      missionDateHeureFin: '<mission_date_heure_fin>',
      location: '<mission_lieu>',
      company: '<mission_entreprise>',
      priceHT: '<mission_prix>',
      missionDescription: '<mission_description>',
      title: '<mission_titre>',
      hours: '<mission_heures>',
      studentCount: '<mission_nb_etudiants>',
      generationDate: '<mission_date_generation>',
      generationDatePlusOneYear: '<mission_date_generation_plus_1_an>',
      
      // Company/Entreprise (ne pas confondre avec les champs utilisateur)
      companyName: '<entreprise_nom>',
      siren: '<entreprise_siren>',
      nSiret: '<entreprise_nsiret>',
      companyAddress: '<entreprise_adresse>',
      companyCity: '<entreprise_ville>',
      companyPostalCode: '<entreprise_code_postal>',
      companyCountry: '<entreprise_pays>',
      companyPhone: '<entreprise_telephone>',
      companyEmail: '<entreprise_email>',
      website: '<entreprise_site_web>',
      
      // Structure
      structure_name: '<structure_nom>',
      structure_siret: '<structure_siret>',
      structure_address: '<structure_adresse>',
      structure_city: '<structure_ville>',
      structure_postalCode: '<structure_code_postal>',
      structure_country: '<structure_pays>',
      structure_phone: '<structure_telephone>',
      structure_email: '<structure_email>',
      structure_website: '<structure_site_web>',
      structure_president_fullName: '<structure_president_nom_complet>',
    };

    return tagMap[variableId] || `<${variableId}>`;
  };

  const formatDateToFR = (dateStr: string | undefined | null): string => {
    if (!dateStr) return '';
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    return dateStr;
  };

  // Pré-charge les données de structure et président (appelée UNE SEULE FOIS avant la boucle de variables)
  const fetchConventionContext = async (): Promise<{ structureInfo: any; presidentFullName: string }> => {
    const structureId = currentUser?.structureId;
    
    // Utiliser le cache si disponible et même structure
    if (conventionContextCacheRef.current && conventionContextCacheRef.current.structureId === structureId) {
      return conventionContextCacheRef.current;
    }
    
    let structureInfo: any = null;
    let presidentFullName = '';
    
    if (structureId) {
      // Lancer les deux requêtes en parallèle
      const [structureResult, usersResult] = await Promise.allSettled([
        getDoc(doc(db, 'structures', structureId)),
        getDocs(query(collection(db, 'users'), where('structureId', '==', structureId)))
      ]);
      
      if (structureResult.status === 'fulfilled' && structureResult.value.exists()) {
        const rawStructure = { id: structureId, ...structureResult.value.data() };
        structureInfo = await decryptStructureForDocument(structureId, rawStructure);
      }
      
      if (usersResult.status === 'fulfilled') {
        const members = usersResult.value.docs.map(d => ({
          id: d.id,
          ...d.data(),
          mandat: d.data().mandat || null,
          bureauRole: d.data().bureauRole || null,
          poles: d.data().poles || [],
          firstName: d.data().firstName || '',
          lastName: d.data().lastName || '',
          displayName: d.data().displayName || ''
        }));

        const presidents = members.filter(member => {
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
          try {
            const presidentDecrypted = await decryptUserDisplayData(mostRecentPresident.id, {
              displayName: mostRecentPresident.displayName,
              firstName: mostRecentPresident.firstName,
              lastName: mostRecentPresident.lastName
            });
            if (presidentDecrypted.firstName && presidentDecrypted.lastName) {
              presidentFullName = `${presidentDecrypted.firstName} ${presidentDecrypted.lastName}`.trim();
            } else if (presidentDecrypted.displayName) {
              presidentFullName = presidentDecrypted.displayName;
            }
          } catch (error) {
            console.error('Erreur lors du décryptage du président:', error);
          }
        }
      }
    }
    
    const ctx = { structureId: structureId || '', structureInfo, presidentFullName };
    conventionContextCacheRef.current = ctx;
    return ctx;
  };

  // Remplace les balises par leurs valeurs (synchrone, pas d'appels réseau)
  const replaceTags = (
    text: string,
    context: { structureInfo: any; presidentFullName: string },
    userDataOverride?: UserDetails
  ): string => {
    if (!text || !selectedUser) return text;

    try {
      const userData = userDataOverride || getDisplayUser();
      const { structureInfo, presidentFullName } = context;

      const replacements: { [key: string]: string } = {
        '<user_nom>': userData.lastName || '',
        '<user_prenom>': userData.firstName || '',
        '<user_email>': userData.email || '',
        '<user_ecole>': userData.ecole || '',
        '<user_nom_complet>': `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
        '<user_telephone>': userData.phone || '',
        '<user_numero_securite_sociale>': userData.socialSecurityNumber || '',
        '<user_numero_etudiant>': userData.studentId || '',
        '<user_adresse>': userData.address || '',
        '<user_ville>': userData.city || '',
        '<user_code_postal>': userData.postalCode || '',
        '<user_pays>': userData.country || '',
        '<user_formation>': userData.formation || '',
        '<user_programme>': userData.program || '',
        '<user_campus>': userData.campus || '',
        '<user_annee_diplome>': userData.graduationYear || '',
        '<user_nationalite>': userData.nationality || '',
        '<user_genre>': userData.gender || '',
        '<user_lieu_naissance>': userData.birthPlace || '',
        '<user_code_postal_naissance>': userData.birthPostalCode || '',
        '<user_date_naissance>': formatDateToFR(userData.birthDate) || '',
        
        '<generationDate>': new Date().toLocaleDateString('fr-FR'),
        '<mission_date_generation>': new Date().toLocaleDateString('fr-FR'),
        '<mission_date_generation_plus_1_an>': (() => {
          const today = new Date();
          const oneYearLater = new Date(today);
          oneYearLater.setDate(today.getDate() + 365);
          return oneYearLater.toLocaleDateString('fr-FR');
        })(),
        
        '<structure_nom>': structureInfo?.nom || '',
        '<structure_siret>': structureInfo?.siret || '',
        '<structure_adresse>': structureInfo?.address || '',
        '<structure_ville>': structureInfo?.city || '',
        '<structure_code_postal>': structureInfo?.postalCode || '',
        '<structure_pays>': structureInfo?.country || '',
        '<structure_telephone>': structureInfo?.phone || '',
        '<structure_email>': structureInfo?.email || '',
        '<structure_site_web>': structureInfo?.website || '',
        '<structure_president_nom_complet>': presidentFullName,
      };

      let result = text;
      Object.entries(replacements).forEach(([tag, value]) => {
        const regex = new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        result = result.replace(regex, value);
      });

      const remainingTags = result.match(/<[^>]+>/g);
      if (remainingTags) {
        remainingTags.forEach(tag => {
          result = result.replace(tag, '');
        });
      }

      return result;
    } catch (error) {
      console.error('Erreur lors du remplacement des balises:', error);
      return text;
    }
  };

  const doGenerateConvention = async (decryptedUserDataOverride?: UserDetails) => {
    if (!conventionTemplate || !selectedUser) {
      console.error('[doGenerateConvention] Template ou utilisateur manquant');
      setIsGeneratingConvention(false);
      isGeneratingConventionRef.current = false;
      return;
    }
    
    const userDataToUse = decryptedUserDataOverride || decryptedUserData || selectedUser;
    console.log('[doGenerateConvention] Début de la génération pour:', selectedUser.id);
    
    try {
      // Lancer en parallèle : fetch template Firestore, fetch contexte convention, fetch PDF (si en cache sinon après)
      const [templateDoc, conventionContext] = await Promise.all([
        getDoc(doc(db, 'templates', conventionTemplate)),
        fetchConventionContext()
      ]);
      
      if (!templateDoc.exists()) {
        throw new Error('Template non trouvé');
      }

      const templateData = templateDoc.data() as Template;
      console.log('[doGenerateConvention] Template récupéré:', templateData.name, '- variables:', templateData.variables?.length || 0);
      
      let pdfUrl = templateData.pdfUrl;
      if (!pdfUrl) {
        throw new Error('URL du PDF non trouvée dans le template');
      }
      
      if (!pdfUrl.startsWith('http')) {
        const storage = getStorage();
        const storageRef = ref(storage, pdfUrl);
        pdfUrl = await getDownloadURL(storageRef);
      }

      // Utiliser le cache PDF si le template et l'URL n'ont pas changé
      let pdfArrayBuffer: ArrayBuffer;
      const cache = templatePdfCacheRef.current;
      if (cache && cache.templateId === conventionTemplate && cache.pdfUrl === pdfUrl) {
        console.log('[doGenerateConvention] Utilisation du PDF en cache');
        pdfArrayBuffer = cache.arrayBuffer;
      } else {
        console.log('[doGenerateConvention] Téléchargement du PDF...');
        const response = await fetch(pdfUrl);
        if (!response.ok) {
          throw new Error(`Erreur lors du téléchargement du PDF: ${response.status}`);
        }
        pdfArrayBuffer = await response.arrayBuffer();
        templatePdfCacheRef.current = { templateId: conventionTemplate, pdfUrl, arrayBuffer: pdfArrayBuffer };
        console.log('[doGenerateConvention] PDF téléchargé et mis en cache, taille:', pdfArrayBuffer.byteLength, 'bytes');
      }
      
      const pdfDoc = await PDFLib.PDFDocument.load(pdfArrayBuffer.slice(0));
      const pages = pdfDoc.getPages();
      const helveticaFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
      const helveticaFontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      
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
            return ' ';
          });
      };
      
      const splitTextToLines = (text: string, font: any, fontSize: number, maxWidth: number): string[] => {
        const words = text.split(' ');
        const lines: string[] = [];
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
        if (currentLine) lines.push(currentLine);
        return lines;
      };

      for (const variable of templateData.variables) {
        if (variable.position.page > pages.length) continue;
        
        const page = pages[variable.position.page - 1];
        const pageHeight = page.getHeight();
        
        try {
          let valueToReplace = '';
          if (variable.type === 'raw') {
            valueToReplace = variable.rawText || '';
          } else if (variable.variableId) {
            valueToReplace = getTagFromVariableId(variable.variableId);
          } else if (variable.fieldId) {
            const tag = getTagFromVariableId(variable.fieldId);
            valueToReplace = tag || `<${variable.fieldId}>`;
          }
          
          // replaceTags est maintenant synchrone (pas d'appels réseau)
          const value = replaceTags(valueToReplace, conventionContext, userDataToUse);
          
          if (value && value.trim()) {
            const fontSize = variable.fontSize || 12;
            const font = variable.isBold ? helveticaFontBold : helveticaFont;
            const { x, y } = variable.position;
            const { width, height } = variable;
            const textAlign = variable.textAlign || 'left';
            const verticalAlign = variable.verticalAlign || 'top';
            
            let yPos = pageHeight - y;
            if (verticalAlign === 'middle') {
              yPos = pageHeight - y - (height / 2) + (fontSize * -0.25);
            } else if (verticalAlign === 'bottom') {
              yPos = pageHeight - (y + height) + fontSize * 0.8;
            }
            
            const cleanedValue = cleanTextForPDF(value);
            const lines = splitTextToLines(cleanedValue.trim(), font, fontSize, width);
            let lineY = yPos;
            const lineHeight = fontSize * 1.2;
            
            for (let i = 0; i < lines.length; i++) {
              const line = cleanTextForPDF(lines[i]);
              let xLine = x;
              const lineWidth = font.widthOfTextAtSize(line, fontSize);
              
              if (textAlign === 'center') {
                xLine = x + (width - lineWidth) / 2;
              } else if (textAlign === 'right') {
                xLine = x + width - lineWidth;
              }
              
              try {
                page.drawText(line, {
                  x: xLine,
                  y: lineY,
                  size: fontSize,
                  font,
                  maxWidth: width,
                  lineHeight: lineHeight
                });
              } catch (drawError) {
                const fallbackLine = line.replace(/[^\x20-\x7E]/g, ' ');
                page.drawText(fallbackLine, {
                  x: xLine,
                  y: lineY,
                  size: fontSize,
                  font,
                  maxWidth: width,
                  lineHeight: lineHeight
                });
              }
              lineY -= lineHeight;
            }
          }
        } catch (err) {
          console.error(`Erreur variable ${variable.name || variable.variableId}:`, err);
        }
      }
      
      console.log('[doGenerateConvention] Génération du PDF final...');
      const modifiedPdfBytes = await pdfDoc.save();
      const arrayBuffer = new ArrayBuffer(modifiedPdfBytes.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      uint8Array.set(modifiedPdfBytes);
      const modifiedBlob = new Blob([arrayBuffer as ArrayBuffer], { type: 'application/pdf' });
      
      console.log('[doGenerateConvention] PDF généré, taille:', modifiedBlob.size, 'bytes');
      
      const userDisplay = userDataToUse;
      const fileName = `Convention_${userDisplay.firstName || 'Utilisateur'}_${userDisplay.lastName || 'Inconnu'}.pdf`;
      const downloadUrl = window.URL.createObjectURL(modifiedBlob);
      
      try {
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
          window.URL.revokeObjectURL(downloadUrl);
        }, 500);
      } catch (error) {
        const newWindow = window.open(downloadUrl, '_blank');
        if (!newWindow) {
          throw new Error('Impossible de télécharger le fichier. Veuillez réessayer.');
        }
        setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
      }

      setSnackbar({
        open: true,
        message: 'Convention générée et téléchargée avec succès',
        severity: 'success'
      });
      console.log('[doGenerateConvention] Convention générée avec succès');
    } catch (error: any) {
      console.error('[doGenerateConvention] Erreur:', error?.message);
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Erreur lors de la génération de la convention',
        severity: 'error'
      });
    } finally {
      setIsGeneratingConvention(false);
      isGeneratingConventionRef.current = false;
    }
  };

  // Fonction publique pour générer la convention (avec vérification de décryptage)
  const generateConvention = async () => {
    if (!selectedUser || isGeneratingConvention) {
      console.warn('[generateConvention] Utilisateur non sélectionné ou génération en cours');
      return;
    }
    
    if (!conventionTemplate && userStructureId) {
      await fetchConventionTemplate(userStructureId);
    }
    
    if (!conventionTemplate) {
      setSnackbar({
        open: true,
        message: 'Aucun template de convention étudiante n\'est assigné. Veuillez assigner un template dans les paramètres.',
        severity: 'error'
      });
      return;
    }
    
    console.log('[generateConvention] Début de la génération, template:', conventionTemplate);
    
    setIsGeneratingConvention(true);
    isGeneratingConventionRef.current = true;
    
    if (!decryptedUserData && canDecryptData()) {
      console.log('[generateConvention] Données non décryptées, démarrage du décryptage...');
      try {
        const deviceIsSecure = await isCurrentDeviceSecure();
        
        if (deviceIsSecure) {
          try {
            await handleDecryptData();
            return;
          } catch (decryptError: any) {
            console.error('[generateConvention] Erreur décryptage:', decryptError);
            setIsGeneratingConvention(false);
            isGeneratingConventionRef.current = false;
            setSnackbar({
              open: true,
              message: `Erreur lors du décryptage des données: ${decryptError?.message || 'Erreur inconnue'}`,
              severity: 'error'
            });
            return;
          }
        } else {
          setTwoFactorDialogOpen(true);
          setSnackbar({
            open: true,
            message: 'Veuillez entrer votre code 2FA pour décrypter les données',
            severity: 'info'
          });
          return;
        }
      } catch (error: any) {
        console.error('[generateConvention] Erreur vérification sécurité:', error);
        setIsGeneratingConvention(false);
        isGeneratingConventionRef.current = false;
        setSnackbar({
          open: true,
          message: `Erreur lors du décryptage des données: ${error?.message || 'Erreur inconnue'}`,
          severity: 'error'
        });
        return;
      }
    }
    
    await doGenerateConvention();
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

  const validateUserDossier = async () => {
    if (!selectedUser || !currentUser) return;

    try {
      const userRef = doc(db, 'users', selectedUser.id);
      
      // Mettre à jour le statut de validation du dossier
      await updateDoc(userRef, {
        dossierValidated: true,
        dossierValidationDate: new Date().toISOString(),
        dossierValidatedBy: currentUser.uid
      });

      // Mettre à jour la dernière activité
      await updateLastActivity();

      // Ajouter une entrée dans l'historique
      const historyRef = collection(db, 'history');
      await addDoc(historyRef, {
        userId: selectedUser.id,
        date: new Date().toISOString(),
        action: 'Validation du dossier',
        details: `Dossier validé par ${currentUser.displayName || currentUser.email}`,
        type: 'profile'
      });

      // Mettre à jour l'état local
      setSelectedUser({
        ...selectedUser,
        dossierValidated: true,
        dossierValidationDate: new Date().toISOString(),
        dossierValidatedBy: currentUser.uid
      });

      setSnackbar({
        open: true,
        message: 'Dossier validé avec succès',
        severity: 'success'
      });

      // Rafraîchir l'historique
      fetchUserHistory(selectedUser.id);
    } catch (error) {
      console.error('Erreur lors de la validation du dossier:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la validation du dossier',
        severity: 'error'
      });
    }
  };

  const unvalidateUserDossier = async () => {
    if (!selectedUser || !currentUser) return;

    try {
      const userRef = doc(db, 'users', selectedUser.id);
      
      // Mettre à jour le statut de validation du dossier
      await updateDoc(userRef, {
        dossierValidated: false,
        dossierValidationDate: null,
        dossierValidatedBy: null
      });

      // Mettre à jour la dernière activité
      await updateLastActivity();

      // Ajouter une entrée dans l'historique
      const historyRef = collection(db, 'history');
      await addDoc(historyRef, {
        userId: selectedUser.id,
        date: new Date().toISOString(),
        action: 'Dévalidation du dossier',
        details: `Dossier dévalidé par ${currentUser.displayName || currentUser.email}`,
        type: 'profile'
      });

      // Mettre à jour l'état local
      setSelectedUser({
        ...selectedUser,
        dossierValidated: false,
        dossierValidationDate: null,
        dossierValidatedBy: null
      });

      setSnackbar({
        open: true,
        message: 'Dossier dévalidé avec succès',
        severity: 'success'
      });

      // Rafraîchir l'historique
      fetchUserHistory(selectedUser.id);
    } catch (error) {
      console.error('Erreur lors de la dévalidation du dossier:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la dévalidation du dossier',
        severity: 'error'
      });
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser || !canEditUser()) {
      console.log("Accès refusé à la modification");
      setSnackbar({
        open: true,
        message: 'Vous n\'avez pas les permissions pour modifier ce profil',
        severity: 'error'
      });
      return;
    }

    console.log("Accès autorisé à la modification");
    setAnchorEl(null);

    // Si les données sont déjà décryptées, les utiliser directement
    if (decryptedUserData && decryptedUserData.id === selectedUser.id) {
      // Utiliser directement les données décryptées
      setEditedUser({ ...decryptedUserData });
      setEditModalOpen(true);
      return;
    }

    if ((canRead || hasDecryptionAccess) && userHasEncryptedFields(selectedUser)) {
      setIsDecrypting(true);
      try {
        let merged: UserDetails | null = null;
        if (canRead) {
          merged = await decryptUserViaStructure(selectedUser);
        } else {
          const isSecure = await isCurrentDeviceSecure();
          if (!isSecure) {
            setPendingEditAfterDecrypt(true);
            setTwoFactorDialogOpen(true);
            return;
          }
          const functions = getFunctions(undefined, (import.meta.env.VITE_FUNCTIONS_REGION as string) || 'us-central1');
          const decryptUserData = httpsCallable(functions, 'decryptUserData');
          const result = await decryptUserData({
            userId: selectedUser.id,
            deviceId: getDeviceId() || undefined,
          });
          const payload = result.data as { success?: boolean; decryptedData?: Record<string, unknown> };
          if (payload?.success && payload.decryptedData) {
            merged = mergeDecryptedIntoUser(selectedUser, payload.decryptedData);
          }
        }
        if (merged) {
          setDecryptedUserData(merged);
          setEditedUser({ ...merged });
        } else {
          setEditedUser({ ...selectedUser });
        }
        setEditModalOpen(true);
      } catch (decryptError: unknown) {
        console.error('Erreur lors du décryptage pour modification:', decryptError);
        const err = decryptError as { code?: string; message?: string };
        const msg =
          err?.code === 'functions/internal' || err?.message?.includes('Non autorisé')
            ? 'Accès aux données chiffrées non autorisé ou erreur serveur.'
            : (err?.message || 'Impossible de décrypter les données.');
        setSnackbar({ open: true, message: msg, severity: 'warning' });
        setEditedUser({ ...selectedUser });
        setEditModalOpen(true);
      } finally {
        setIsDecrypting(false);
      }
      return;
    }

    setEditedUser({ ...selectedUser });
    setEditModalOpen(true);
  };

  // Fonction pour vérifier si l'utilisateur peut modifier les profils
  const canEditUser = () => {
    const status = (currentUserStatus || '').toLowerCase();
    return (
      canWrite ||
      canRead ||
      status === 'admin' ||
      status === 'admin_structure' ||
      status === 'superadmin' ||
      isHRMember ||
      hasDecryptionAccess
    );
  };

  const handleSendPasswordResetEmail = async () => {
    if (!selectedUser || !canRead) return;
    setAnchorEl(null);
    try {
      const functions = getFunctions();
      const sendPasswordResetEmailToUser = httpsCallable(functions, 'sendPasswordResetEmailToUser');
      await sendPasswordResetEmailToUser({ userId: selectedUser.id });
      setSnackbar({ open: true, message: 'Email de réinitialisation envoyé avec succès.', severity: 'success' });
    } catch (err: any) {
      console.error('Erreur envoi email réinitialisation:', err);
      setSnackbar({
        open: true,
        message: err?.message || 'Impossible d\'envoyer l\'email de réinitialisation.',
        severity: 'error'
      });
    }
  };

  const handleOpenPasswordDialog = () => {
    setNewPassword('');
    setConfirmPassword('');
    setPasswordDialogOpen(true);
    setAnchorEl(null);
  };

  const handleClosePasswordDialog = () => {
    setPasswordDialogOpen(false);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSubmitNewPassword = async () => {
    if (!selectedUser || !currentUser) return;
    if (newPassword.length < 6) {
      setSnackbar({ open: true, message: 'Le mot de passe doit contenir au moins 6 caractères.', severity: 'warning' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSnackbar({ open: true, message: 'Les deux mots de passe ne correspondent pas.', severity: 'warning' });
      return;
    }
    setPasswordLoading(true);
    try {
      const functions = getFunctions();
      const updateUserPassword = httpsCallable(functions, 'updateUserPassword');
      await updateUserPassword({ userId: selectedUser.id, newPassword });
      setSnackbar({ open: true, message: 'Mot de passe mis à jour.', severity: 'success' });
      handleClosePasswordDialog();
    } catch (err: any) {
      console.error('Erreur modification mot de passe:', err);
      setSnackbar({
        open: true,
        message: err?.message || 'Impossible de modifier le mot de passe.',
        severity: 'error'
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setEditedUser(null);
  };

  const handleStartInlineEdit = async (section: string) => {
    if (!selectedUser || !canEditUser()) return;

    setEditingSection(section);

    if (decryptedUserData && decryptedUserData.id === selectedUser.id) {
      setEditedUser({ ...decryptedUserData });
      return;
    }

    if (canRead && userHasEncryptedFields(selectedUser)) {
      setIsInlineEditDecrypting(true);
      setEditedUser({ ...selectedUser });
      try {
        const merged = await decryptUserViaStructure(selectedUser);
        if (merged) {
          setDecryptedUserData(merged);
          setEditedUser({ ...merged });
        }
      } catch (error: unknown) {
        console.error('Erreur décryptage pour édition:', error);
        const err = error as { message?: string };
        setSnackbar({
          open: true,
          message: err?.message || 'Impossible de décrypter les données pour modification.',
          severity: 'warning',
        });
        setEditedUser({ ...selectedUser });
      } finally {
        setIsInlineEditDecrypting(false);
      }
      return;
    }

    setEditedUser({ ...selectedUser });
  };

  const handleCancelInlineEdit = () => {
    setEditingSection(null);
    setEditedUser(null);
    setIsInlineEditDecrypting(false);
  };

  const handleSaveInlineEdit = async () => {
    if (!editedUser || !currentUser) return;
    try {
      const userRef = doc(db, 'users', editedUser.id);
      const updateData: Record<string, any> = {};
      const cleanValue = (value: any) => {
        if (value === undefined || value === null) return null;
        if (typeof value === 'string' && value.trim() === '') return '';
        return value;
      };
      updateData.firstName = cleanValue(editedUser.firstName);
      updateData.lastName = cleanValue(editedUser.lastName);
      updateData.birthDate = cleanValue(editedUser.birthDate);
      updateData.birthPlace = cleanValue(editedUser.birthPlace);
      updateData.birthPostalCode = cleanValue(editedUser.birthPostalCode);
      updateData.gender = cleanValue(editedUser.gender);
      updateData.nationality = cleanValue(editedUser.nationality);
      updateData.email = cleanValue(editedUser.email);
      updateData.studentId = cleanValue(editedUser.studentId);
      updateData.graduationYear = cleanValue(editedUser.graduationYear);
      updateData.campus = cleanValue(editedUser.campus);
      updateData.address = cleanValue(editedUser.address);
      updateData.postalCode = cleanValue(editedUser.postalCode);
      updateData.city = cleanValue(editedUser.city);
      updateData.socialSecurityNumber = cleanValue(editedUser.socialSecurityNumber);
      updateData.phone = cleanValue(editedUser.phone);

      if (hasDecryptionAccess && decryptedUserData && decryptedUserData.id === editedUser.id) {
        try {
          const functions = getFunctions();
          const encryptUserData = httpsCallable(functions, 'encryptUserData');
          const result = await encryptUserData({ userId: editedUser.id, userData: updateData });
          if (result.data && (result.data as any).success && (result.data as any).encryptedData) {
            Object.assign(updateData, (result.data as any).encryptedData);
          }
        } catch (encryptError: any) {
          console.warn('Erreur lors du recryptage:', encryptError);
        }
      }

      await updateDoc(userRef, updateData);
      await updateLastActivity();
      const historyRef = collection(db, 'history');
      await addDoc(historyRef, {
        userId: editedUser.id,
        date: new Date().toISOString(),
        action: 'Modification du profil',
        details: `Profil modifié par ${currentUser.displayName || currentUser.email}`,
        type: 'profile'
      });

      setSelectedUser(editedUser);
      if (decryptedUserData && decryptedUserData.id === editedUser.id) {
        setDecryptedUserData(editedUser);
      }
      setUsers(prevUsers => prevUsers.map(user => user.id === editedUser.id ? editedUser : user));
      setSnackbar({ open: true, message: 'Profil modifié avec succès', severity: 'success' });
      setEditingSection(null);
      setEditedUser(null);
      setIsInlineEditDecrypting(false);
      fetchUserHistory(editedUser.id);
    } catch (error) {
      console.error('Erreur lors de la modification du profil:', error);
      setSnackbar({ open: true, message: 'Erreur lors de la modification du profil', severity: 'error' });
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser || !currentUser) return;
    
    // Vérifier les permissions avant de supprimer
    if (!canEditUser()) {
      setSnackbar({
        open: true,
        message: 'Vous n\'avez pas les permissions pour supprimer des utilisateurs',
        severity: 'error'
      });
      setAnchorEl(null);
      return;
    }
    
    // Demander confirmation
    const confirmMessage = `Êtes-vous sûr de vouloir supprimer l'utilisateur ${selectedUser.firstName} ${selectedUser.lastName} ?\n\nCette action est irréversible et supprimera toutes les données associées à cet utilisateur.`;
    
    if (!window.confirm(confirmMessage)) {
      setAnchorEl(null);
      return;
    }

    try {
      const userRef = doc(db, 'users', selectedUser.id);
      
      // Supprimer l'utilisateur de Firestore
      await deleteDoc(userRef);
      
      // Mettre à jour la liste des utilisateurs
      setUsers(prev => prev.filter(user => user.id !== selectedUser.id));
      
      // Réinitialiser la sélection
      setSelectedUser(null);
      setAnchorEl(null);
      
      // Ajouter une entrée dans l'historique
      const historyRef = collection(db, 'history');
      await addDoc(historyRef, {
        userId: selectedUser.id,
        date: new Date().toISOString(),
        action: 'Suppression d\'utilisateur',
        details: `Utilisateur ${selectedUser.firstName} ${selectedUser.lastName} supprimé par ${currentUser.displayName || currentUser.email}`,
        type: 'system'
      });

      setSnackbar({
        open: true,
        message: `Utilisateur ${selectedUser.firstName} ${selectedUser.lastName} supprimé avec succès`,
        severity: 'success'
      });
    } catch (error: any) {
      console.error('Erreur lors de la suppression de l\'utilisateur:', error);
      setSnackbar({
        open: true,
        message: error?.message || 'Erreur lors de la suppression de l\'utilisateur',
        severity: 'error'
      });
      setAnchorEl(null);
    }
  };

  const handleSaveUser = async () => {
    if (!editedUser || !currentUser) return;

    try {
      const userRef = doc(db, 'users', editedUser.id);
      
      // Préparer les données à sauvegarder en filtrant les valeurs undefined et null
      const updateData: Record<string, any> = {};
      
      // Fonction helper pour nettoyer les valeurs
      const cleanValue = (value: any) => {
        if (value === undefined || value === null) return null;
        if (typeof value === 'string' && value.trim() === '') return '';
        return value;
      };
      
      // Ajouter tous les champs avec des valeurs nettoyées
      updateData.firstName = cleanValue(editedUser.firstName);
      updateData.lastName = cleanValue(editedUser.lastName);
      updateData.birthDate = cleanValue(editedUser.birthDate);
      updateData.birthPlace = cleanValue(editedUser.birthPlace);
      updateData.birthPostalCode = cleanValue(editedUser.birthPostalCode);
      updateData.gender = cleanValue(editedUser.gender);
      updateData.nationality = cleanValue(editedUser.nationality);
      updateData.email = cleanValue(editedUser.email);
      updateData.studentId = cleanValue(editedUser.studentId);
      updateData.graduationYear = cleanValue(editedUser.graduationYear);
      updateData.campus = cleanValue(editedUser.campus);
      updateData.address = cleanValue(editedUser.address);
      updateData.postalCode = cleanValue(editedUser.postalCode);
      updateData.city = cleanValue(editedUser.city);
      updateData.socialSecurityNumber = cleanValue(editedUser.socialSecurityNumber);
      updateData.phone = cleanValue(editedUser.phone);

      // Si les données étaient décryptées, les recrypter avant de sauvegarder
      if (hasDecryptionAccess && decryptedUserData && decryptedUserData.id === editedUser.id) {
        try {
          const functions = getFunctions();
          const encryptUserData = httpsCallable(functions, 'encryptUserData');
          
          const result = await encryptUserData({
            userId: editedUser.id,
            userData: updateData
          });
          
          if (result.data && (result.data as any).success && (result.data as any).encryptedData) {
            // Utiliser les données chiffrées
            Object.assign(updateData, (result.data as any).encryptedData);
            console.log('Données recryptées avant sauvegarde');
          }
        } catch (encryptError: any) {
          console.warn('Erreur lors du recryptage des données (continuons quand même):', encryptError);
          // Continuer avec les données non chiffrées si le cryptage échoue
          // (pour la compatibilité avec les anciennes données)
        }
      }

      await updateDoc(userRef, updateData);

      // Mettre à jour la dernière activité
      await updateLastActivity();

      // Ajouter une entrée dans l'historique
      const historyRef = collection(db, 'history');
      await addDoc(historyRef, {
        userId: editedUser.id,
        date: new Date().toISOString(),
        action: 'Modification du profil',
        details: `Profil modifié par ${currentUser.displayName || currentUser.email}`,
        type: 'profile'
      });

      // Mettre à jour l'état local
      setSelectedUser(editedUser);
      if (decryptedUserData && decryptedUserData.id === editedUser.id) {
        setDecryptedUserData(editedUser);
      }
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === editedUser.id ? editedUser : user
        )
      );

      setSnackbar({
        open: true,
        message: 'Profil modifié avec succès',
        severity: 'success'
      });

      handleCloseEditModal();
      fetchUserHistory(editedUser.id);
    } catch (error) {
      console.error('Erreur lors de la modification du profil:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la modification du profil',
        severity: 'error'
      });
    }
  };

  const handleInputChange = (field: keyof UserDetails, value: string) => {
    if (editedUser) {
      setEditedUser({
        ...editedUser,
        [field]: value.trim() === '' ? '' : value
      });
    }
  };

  // Fonction helper pour obtenir la valeur décryptée d'un champ depuis editedUser
  const getDecryptedFieldValue = (field: keyof UserDetails): string => {
    if (!editedUser) return '';
    
    const value = editedUser[field];
    if (!value) return '';
    
    // Si la valeur est cryptée et qu'on a les données décryptées, utiliser la version décryptée
    if (isEncrypted(value)) {
      // D'abord vérifier si on a des données décryptées pour cet utilisateur
      if (decryptedUserData && editedUser.id === decryptedUserData.id) {
        const decryptedValue = decryptedUserData[field];
        if (decryptedValue && !isEncrypted(decryptedValue)) {
          return String(decryptedValue);
        }
      }
      // Si la valeur est cryptée mais qu'on n'a pas de version décryptée, retourner une chaîne vide
      // pour éviter d'afficher "ENC:..." dans les inputs
      return '';
    }
    
    // Si la valeur n'est pas cryptée, la retourner telle quelle
    return String(value);
  };

  const buildAcademicSelectOptions = (
    items: string[],
    currentValue?: string
  ): { value: string; label: string }[] => {
    const options = items.map((item) => ({ value: item, label: item }));
    const trimmed = currentValue?.trim();
    if (trimmed && !items.includes(trimmed)) {
      return [{ value: trimmed, label: trimmed }, ...options];
    }
    return options;
  };

  // Fonction pour vérifier si l'utilisateur peut décrypter les données
  const canDecryptData = (): boolean => {
    if (!selectedUser) return false;
    // Accès page RH : décryptage sans 2FA (aligné permissionPages)
    if (canRead) return true;
    return hasDecryptionAccess && hasTwoFactor;
  };

  // Fonction pour obtenir le message d'erreur de déchiffrement
  const getDecryptionErrorMessage = (): string | null => {
    if (!selectedUser) {
      return 'Aucun utilisateur sélectionné';
    }
    
    if (canRead) return null;

    if (!hasDecryptionAccess) {
      return 'Vous n\'avez pas les permissions nécessaires pour déchiffrer les données.';
    }
    
    if (!hasTwoFactor) {
      return 'Vous devez activer l\'authentification à deux facteurs (2FA) pour pouvoir déchiffrer les données. Veuillez activer la 2FA dans vos paramètres de sécurité.';
    }
    
    return null;
  };

  // Fonction pour générer l'ID de l'appareil actuel (identique à Login.tsx)
  const getDeviceId = (): string | null => {
    if (!currentUser?.uid) return null;
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    return `${currentUser.uid}_${btoa(userAgent + platform).substring(0, 16)}`;
  };

  // Fonction pour vérifier si l'appareil actuel est sécurisé
  const isCurrentDeviceSecure = async (): Promise<boolean> => {
    if (!currentUser) return false;
    
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) return false;
      
      const userData = userDocSnap.data();
      const secureDevices = userData?.secureDevices || [];
      const deviceId = getDeviceId();
      
      if (!deviceId) return false;
      
      // Vérifier si l'appareil actuel est dans la liste des appareils sécurisés
      return secureDevices.some((device: any) => device.deviceId === deviceId);
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'appareil sécurisé:', error);
      return false;
    }
  };

  // Fonction pour décrypter les données utilisateur
  const handleDecryptData = async (twoFactorCode?: string) => {
    console.log('[handleDecryptData] Début du décryptage', {
      hasSelectedUser: !!selectedUser,
      hasCurrentUser: !!currentUser,
      hasTwoFactorCode: !!twoFactorCode,
      isGeneratingConvention
    });
    
    if (!selectedUser || !currentUser) {
      console.error('[handleDecryptData] Utilisateur non sélectionné');
      throw new Error('Utilisateur non sélectionné');
    }

    // Valider le code 2FA si fourni
    if (twoFactorCode && twoFactorCode.length !== 6) {
      throw new Error('Le code doit contenir 6 chiffres');
    }

    setIsDecrypting(true);
    try {
      let mergedData: UserDetails | null = null;

      if (canRead) {
        mergedData = await decryptUserViaStructure(selectedUser);
      } else {
        const functions = getFunctions(undefined, (import.meta.env.VITE_FUNCTIONS_REGION as string) || 'us-central1');
        const decryptUserData = httpsCallable(functions, 'decryptUserData');
        const deviceId = getDeviceId();
        const result = await decryptUserData({
          userId: selectedUser.id,
          deviceId: deviceId || undefined,
          twoFactorCode: twoFactorCode || undefined,
        });
        if (result.data && (result.data as { success?: boolean; decryptedData?: Record<string, unknown> }).success) {
          const decryptedData = (result.data as { decryptedData: Record<string, unknown> }).decryptedData;
          mergedData = mergeDecryptedIntoUser(selectedUser, decryptedData);
        }
      }

      if (mergedData) {
        setDecryptedUserData(mergedData);
        setTwoFactorDialogOpen(false);
        
        // Si on attendait l'ouverture du modal d'édition, l'ouvrir maintenant
        if (pendingEditAfterDecrypt) {
          setEditedUser({ ...mergedData });
          setEditModalOpen(true);
          setPendingEditAfterDecrypt(false);
        }
        
        // Logger l'accès aux données décryptées dans l'historique
        try {
          const historyRef = collection(db, 'history');
          await addDoc(historyRef, {
            userId: selectedUser.id,
            date: new Date().toISOString(),
            action: 'Décryptage des données',
            details: `Données sensibles décryptées par ${currentUser.displayName || currentUser.email}`,
            type: 'profile'
          });
          
          // Rafraîchir l'historique
          fetchUserHistory(selectedUser.id);
        } catch (error) {
          console.error('Erreur lors de l\'ajout du log de décryptage:', error);
        }
        
        const shouldGenerate = isGeneratingConventionRef.current;
        
        if (shouldGenerate || isGeneratingConvention) {
          // Générer la convention directement avec les données décryptées (pas de setTimeout)
          try {
            await doGenerateConvention(mergedData);
          } catch (error: any) {
            console.error('[handleDecryptData] Erreur génération convention:', error);
            setIsGeneratingConvention(false);
            isGeneratingConventionRef.current = false;
            setSnackbar({
              open: true,
              message: error?.message || 'Erreur lors de la génération de la convention',
              severity: 'error'
            });
          }
        } else {
          setSnackbar({
            open: true,
            message: 'Données décryptées avec succès',
            severity: 'success'
          });
        }
      }
    } catch (error: any) {
      console.error('Erreur lors du décryptage:', error);
      // Si on était en train de générer, annuler le processus
      if (isGeneratingConvention || isGeneratingConventionRef.current) {
        setIsGeneratingConvention(false);
        isGeneratingConventionRef.current = false;
      }
      const msg = error?.code === 'functions/internal' || error?.message?.includes('Non autorisé')
        ? 'Accès aux données chiffrées refusé. Vérifiez vos droits (2FA, permission RH).'
        : (error?.message || 'Erreur lors du décryptage des données');
      setSnackbar({ open: true, message: msg, severity: 'warning' });
    } finally {
      setIsDecrypting(false);
    }
  };

  // Fonction pour gérer le clic sur le bouton cadenas
  const handleLockButtonClick = async () => {
    if (decryptedUserData) {
      // Masquer les données décryptées
      setDecryptedUserData(null);
      
      // Logger la masquage des données dans l'historique
      try {
        const historyRef = collection(db, 'history');
        await addDoc(historyRef, {
          userId: selectedUser!.id,
          date: new Date().toISOString(),
          action: 'Masquage des données',
          details: `Données sensibles masquées par ${currentUser?.displayName || currentUser?.email}`,
          type: 'profile'
        });
        
        // Rafraîchir l'historique
        fetchUserHistory(selectedUser!.id);
      } catch (error) {
        console.error('Erreur lors de l\'ajout du log de masquage:', error);
      }
    } else {
      // Vérifier les permissions et le 2FA avant de procéder
      const errorMessage = getDecryptionErrorMessage();
      if (errorMessage) {
        setSnackbar({
          open: true,
          message: errorMessage,
          severity: 'error'
        });
        return;
      }
      
      if (canRead) {
        try {
          await handleDecryptData();
        } catch (error: unknown) {
          const err = error as { message?: string };
          setSnackbar({
            open: true,
            message: err?.message || 'Erreur lors du décryptage',
            severity: 'error',
          });
        }
        return;
      }

      const deviceIsSecure = await isCurrentDeviceSecure();
      if (deviceIsSecure) {
        try {
          await handleDecryptData();
        } catch (error: unknown) {
          console.warn('Décryptage automatique échoué, demande du code 2FA:', error);
          const err = error as { message?: string };
          setSnackbar({
            open: true,
            message: err?.message || 'Erreur inconnue lors du décryptage',
            severity: 'error',
          });
        }
      } else {
        setTwoFactorDialogOpen(true);
      }
    }
  };

  // Fonction pour obtenir les données à afficher (décryptées si disponibles, sinon cryptées)
  const getDisplayUser = (): UserDetails => {
    return decryptedUserData || selectedUser || {} as UserDetails;
  };

  // Ajout d'un effet pour suivre les utilisateurs en ligne
  useEffect(() => {
    if (!currentUser) return;

    const fetchOnlineUsers = async () => {
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!userDocSnap.exists()) {
          console.error("Utilisateur non trouvé");
          return;
        }

        const structureId = userDocSnap.data()?.structureId;

        if (structureId) {
          // Écouter les changements de statut en ligne des utilisateurs
          const onlineUsersRef = collection(db, 'onlineUsers');
          const q = query(onlineUsersRef, where('structureId', '==', structureId));
          
          const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              const onlineUserIds = snapshot.docs.map((d) => d.data().userId as string).filter(Boolean);
              setOnlineUsers(onlineUserIds);
              setUsers((prevUsers) =>
                prevUsers.map((user) => ({
                  ...user,
                  isOnline: onlineUserIds.includes(user.id),
                }))
              );
            },
            (error) => {
              if ((error as { code?: string })?.code === 'permission-denied') {
                console.warn('[RH] onlineUsers non accessible — indicateur en ligne désactivé');
                return;
              }
              console.error('Erreur listener onlineUsers:', error);
            }
          );

          return () => unsubscribe();
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des utilisateurs en ligne:", error);
      }
    };

    fetchOnlineUsers();
  }, [currentUser]);

  // Ajout d'un intervalle pour mettre à jour périodiquement la dernière activité
  useEffect(() => {
    if (!currentUser) return;

    // Mettre à jour la dernière activité toutes les 3 minutes
    const activityInterval = setInterval(() => {
      updateLastActivity();
    }, 3 * 60 * 1000); // 3 minutes en millisecondes

    return () => clearInterval(activityInterval);
  }, [currentUser, updateLastActivity]);

  // Effet pour sélectionner l'utilisateur depuis l'URL
  useEffect(() => {
    const userId = searchParams.get('userId');
    if (userId && users.length > 0) {
      const userToSelect = users.find(user => user.id === userId);
      if (userToSelect) {
        handleUserClick(userToSelect);
      }
    }
  }, [searchParams, users]);

  // Afficher le chargement des permissions
  if (permissionLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Afficher l'accès refusé si l'utilisateur n'a pas les permissions de lecture
  if (!canRead) {
    return (
      <AccessDenied 
        pageName="Ressources Humaines" 
        message="Vous n'avez pas les permissions nécessaires pour accéder à cette page."
      />
    );
  }

  return (
    <AppPageShell
      eyebrow="Équipe"
      title="Ressources Humaines"
      contentOverflow="hidden"
      kpiColumns={4}
      kpiStrip={
        <>
          <KpiCard label="Total membres" value={hrMetrics.totalMembers} density="compact" />
          <KpiCard label="En ligne" value={hrMetrics.onlineCount} density="compact" sparkColor={tokens.colors.success} />
          <KpiCard label="Profils complets" value={hrMetrics.completeProfiles} density="compact" />
          <KpiCard label="Dossiers validés" value={hrMetrics.validatedDossiers} density="compact" />
        </>
      }
    >
    <Box sx={{ 
      display: 'flex', 
      gap: 2,
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      px: 2,
      py: 1,
    }}>
        {/* Liste des membres - Style Apple */}
        <Paper 
          elevation={0}
          sx={{ 
            width: '380px',
            borderRadius: tokens.radius.xl,
            overflow: 'hidden',
            flexShrink: 0,
            minHeight: 0,
            alignSelf: 'stretch',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: tokens.colors.bgPaper,
            border: `1px solid ${tokens.colors.divider}`,
            boxShadow: tokens.shadows.sm,
          }}
        >
          <Box sx={{ 
            px: 1.5,
            py: 1,
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)', 
            flexShrink: 0,
            bgcolor: tokens.colors.surfaceAlt
          }}>
            <Button
              fullWidth
              size="small"
              variant="outlined"
              startIcon={<PersonAddIcon />}
              onClick={() => setInviteDialogOpen(true)}
              sx={{ textTransform: 'none', borderRadius: tokens.radius.md, mb: 0.75, py: 0.5 }}
            >
              Inviter par email
            </Button>
            <TextField
              fullWidth
              placeholder="Rechercher un membre..."
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: tokens.colors.textSecondary, fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: tokens.radius.md,
                  fontSize: '0.8125rem',
                  bgcolor: tokens.colors.bgSubtle,
                  border: 'none',
                  '& fieldset': {
                    border: 'none'
                  },
                  '&:hover': {
                    bgcolor: tokens.colors.gray150
                  },
                  '&.Mui-focused': {
                    bgcolor: tokens.colors.bgPaper,
                    boxShadow: '0 0 0 4px tokens.colors.primaryAlpha10'
                  }
                },
                '& .MuiOutlinedInput-input': {
                  py: 0.875,
                  fontSize: '0.8125rem',
                  color: tokens.colors.textPrimary
                }
              }}
            />
            
            {/* Filtres DS — chips multi-sélection (compact) */}
            <Box sx={{ mt: 1 }}>
              <FilterChipGroup
                dense
                label="Statut"
                options={STATUS_FILTER_OPTIONS}
                value={statusFilters.map((value) => STATUS_VALUE_TO_FILTER[value]).filter(Boolean)}
                onChange={(labels) => setStatusFilters(labels.map((label) => STATUS_FILTER_TO_VALUE[label]).filter(Boolean))}
              />
              <FilterChipGroup
                dense
                label="Profil"
                options={COMPLETION_FILTER_OPTIONS}
                value={completionFilters.map((value) => COMPLETION_VALUE_TO_FILTER[value]).filter(Boolean)}
                onChange={(labels) => setCompletionFilters(labels.map((label) => COMPLETION_FILTER_TO_VALUE[label]).filter(Boolean))}
              />
              <FilterChipGroup
                dense
                label="Dossier"
                options={VALIDATION_FILTER_OPTIONS}
                value={validationFilters.map((value) => VALIDATION_VALUE_TO_FILTER[value]).filter(Boolean)}
                onChange={(labels) => setValidationFilters(labels.map((label) => VALIDATION_FILTER_TO_VALUE[label]).filter(Boolean))}
              />
            </Box>
          </Box>

          <List sx={{ 
            p: 1,
            flex: 1,
            overflowY: 'auto',
            minHeight: 0,
            '&::-webkit-scrollbar': {
              width: '6px'
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent'
            },
            '&::-webkit-scrollbar-thumb': {
              background: tokens.colors.gray300,
              borderRadius: tokens.radius.xs,
              '&:hover': {
                background: tokens.colors.gray400
              }
            }
          }}>
            {usersLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress size={32} />
              </Box>
            ) : filteredUsers.length === 0 ? (
              <Box sx={{ py: 4, px: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Aucun membre trouvé
                </Typography>
              </Box>
            ) : (
            filteredUsers.map((user) => {
              const isSelected = selectedUser?.id === user.id;
              const statusChipProps = getUserStatusChipProps(user.status);
              return (
              <ListItem
                key={user.id}
                sx={{
                  borderRadius: tokens.radius.md,
                  px: 1.5,
                  py: 1.25,
                  gap: 1.5,
                  mb: 0.25,
                  transition: tokens.transitions.fast,
                  bgcolor: isSelected ? `${tokens.colors.brandTeal}14` : 'transparent',
                  border: isSelected ? `1px solid ${tokens.colors.brandTeal}40` : '1px solid transparent',
                  '&:hover': {
                    bgcolor: isSelected ? `${tokens.colors.brandTeal}14` : tokens.colors.gray50,
                  },
                  cursor: 'pointer',
                }}
                onClick={() => handleUserClick(user)}
              >
                <ListItemAvatar sx={{ minWidth: 36 }}>
                  <Avatar 
                    src={failedPhotoIds.has(user.id) ? undefined : user.photoURL}
                    imgProps={{ onError: () => setFailedPhotoIds(prev => new Set(prev).add(user.id)) }}
                    sx={{ 
                      width: 36, 
                      height: 36,
                      bgcolor: (user.photoURL && !failedPhotoIds.has(user.id)) ? 'transparent' : tokens.colors.brandNavy,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      border: `1px solid ${tokens.colors.gray200}`,
                    }}
                  >
                    {(!user.photoURL || failedPhotoIds.has(user.id)) ? (
                      <UserAvatarInitials user={user} />
                    ) : null}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primaryTypographyProps={{ component: 'div' }}
                  secondaryTypographyProps={{ component: 'div' }}
                  sx={{ my: 0 }}
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0 }}>
                        {userNamesDecrypting && userNeedsNameDecrypt(user) ? (
                          <UserNameSkeleton width={120} sx={{ fontSize: 13 }} />
                        ) : (
                          <UserNameText
                            user={user}
                            component="span"
                            variant="body2"
                            sx={{
                              color: tokens.colors.gray900,
                              fontWeight: 600,
                              fontSize: 13,
                              letterSpacing: '-0.01em',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          />
                        )}
                        {user.isOnline ? (
                          <Box
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: tokens.radius.pill,
                              bgcolor: tokens.colors.success,
                              flexShrink: 0,
                              boxShadow: `0 0 0 2px ${tokens.colors.success}33`,
                            }}
                          />
                        ) : null}
                      </Box>
                      <StatusChip
                        status={statusChipProps.status}
                        label={getStatusLabel(user.status)}
                        sx={{
                          height: 20,
                          fontSize: 10,
                          flexShrink: 0,
                          ...statusChipProps.sx,
                        }}
                      />
                    </Box>
                  }
                  secondary={
                    user.phone ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                        <Typography 
                          variant="body2" 
                          component="span"
                          sx={{
                            fontStyle: isEncrypted(user.phone) ? 'italic' : 'normal',
                            color: isEncrypted(user.phone) ? tokens.colors.info : tokens.colors.gray500,
                            fontSize: 11,
                          }}
                        >
                          {formatValue(user.phone, 'phone').display}
                        </Typography>
                        {isEncrypted(user.phone) ? (
                          <LockIcon sx={{ fontSize: 11, color: tokens.colors.info }} />
                        ) : null}
                      </Box>
                    ) : null
                  }
                />
              </ListItem>
            );
            })
            )}
          </List>
        </Paper>

        {/* Détails du membre - Style Apple */}
        <Paper 
          elevation={0}
          sx={{ 
            flex: 1,
            borderRadius: tokens.radius.xl,
            overflow: 'hidden',
            minWidth: 0,
            minHeight: 0,
            alignSelf: 'stretch',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: tokens.colors.bgPaper,
            border: `1px solid ${tokens.colors.divider}`,
            boxShadow: tokens.shadows.sm,
          }}
        >
          {selectedUser ? (
            <>
              <Box sx={{ 
                px: 2.5,
                py: 2,
                borderBottom: '1px solid rgba(0, 0, 0, 0.06)', 
                flexShrink: 0,
                bgcolor: tokens.colors.surfaceAlt
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar 
                      src={failedPhotoIds.has(selectedUser.id) ? undefined : getDisplayUser().photoURL}
                      imgProps={{ onError: () => setFailedPhotoIds(prev => new Set(prev).add(selectedUser.id)) }}
                      sx={{ 
                        width: 52, 
                        height: 52,
                        bgcolor: (getDisplayUser().photoURL && !failedPhotoIds.has(selectedUser.id)) ? 'transparent' : tokens.colors.info,
                        fontSize: '1rem',
                        fontWeight: 600,
                        border: '2px solid rgba(0, 0, 0, 0.04)',
                        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)'
                      }}
                    >
                      {(!getDisplayUser().photoURL || failedPhotoIds.has(selectedUser.id)) ? (
                        <UserAvatarInitials user={{ id: selectedUser.id, ...getDisplayUser() }} />
                      ) : null}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <UserNameText
                        user={{ id: selectedUser.id, ...getDisplayUser() }}
                        variant="h5"
                        component="h2"
                        skeletonWidth={180}
                        sx={{
                          fontWeight: 600,
                          fontSize: '1.125rem',
                          letterSpacing: '-0.02em',
                          color: tokens.colors.textPrimary,
                          lineHeight: 1.3,
                        }}
                      />
                      <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, mb: 0.5, flexWrap: 'wrap' }}>
                        <StatusChip
                          {...getUserStatusChipProps(getDisplayUser().status)}
                          label={getStatusLabel(getDisplayUser().status)}
                          sx={{ height: 24, fontSize: 11, ...getUserStatusChipProps(getDisplayUser().status).sx }}
                        />
                        <StatusChip
                          status={isProfileComplete(getDisplayUser()) ? 'active' : 'pending'}
                          label={isProfileComplete(getDisplayUser()) ? 'Profil complété' : 'Profil incomplet'}
                          sx={{ height: 24, fontSize: 11 }}
                        />
                        {getDisplayUser().dossierValidated ? (
                          <StatusChip
                            status="active"
                            label="Dossier validé"
                            sx={{ height: 24, fontSize: 11 }}
                          />
                        ) : null}
                      </Box>
                      {getDisplayUser().lastLogin ? (
                        <Typography 
                          variant="body2" 
                          sx={{
                            color: tokens.colors.textSecondary,
                            fontSize: '0.75rem',
                            lineHeight: 1.3,
                          }}
                        >
                          Dernière connexion : {getDisplayUser().lastLogin instanceof Timestamp 
                            ? getDisplayUser().lastLogin.toDate().toLocaleString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : "Date inconnue"
                          }
                        </Typography>
                      ) : null}
                    </Box>
                  </Box>
                  <IconButton
                    onClick={(event) => setAnchorEl(event.currentTarget)}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, mt: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                  {(() => {
                    const errorMessage = getDecryptionErrorMessage();
                    const tooltipTitle = decryptedUserData 
                      ? "Données décryptées - Cliquez pour masquer" 
                      : errorMessage 
                        ? errorMessage 
                        : "Cliquez pour décrypter les données";
                    const buttonColor = decryptedUserData ? tokens.colors.success : (errorMessage ? tokens.colors.error : tokens.colors.info);
                    const hoverBgColor = decryptedUserData 
                      ? 'rgba(52, 199, 89, 0.1)' 
                      : (errorMessage ? 'rgba(255, 59, 48, 0.1)' : 'tokens.colors.primaryAlpha10');
                    
                    return (
                      <Tooltip title={tooltipTitle}>
                        <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          {isDecrypting ? (
                            <CircularProgress
                              size={44}
                              sx={{
                                color: decryptedUserData ? tokens.colors.success : tokens.colors.info,
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                zIndex: 0,
                                '& .MuiCircularProgress-circle': {
                                  strokeLinecap: 'round',
                                }
                              }}
                              thickness={3}
                            />
                          ) : null}
                          <IconButton
                            onClick={handleLockButtonClick}
                            disabled={isDecrypting || !selectedUser}
                            sx={{ 
                              color: buttonColor,
                              border: `2px solid ${buttonColor}`,
                              borderRadius: tokens.radius.md,
                              width: 36,
                              height: 36,
                              transition: 'all 0.2s ease',
                              position: 'relative',
                              zIndex: 1,
                              bgcolor: tokens.colors.bgPaper,
                              '&:hover': {
                                bgcolor: hoverBgColor,
                                transform: 'scale(1.05)'
                              },
                              '&:disabled': {
                                opacity: 0.7
                              }
                            }}
                          >
                            {decryptedUserData ? <LockOpenIcon /> : <LockIcon />}
                          </IconButton>
                        </Box>
                      </Tooltip>
                    );
                  })()}
                  <Tooltip 
                    title={
                      !conventionTemplate 
                        ? 'Aucun template de convention étudiante n\'est assigné. Veuillez assigner un template dans les paramètres.' 
                        : (!decryptedUserData && !canDecryptData()) 
                          ? 'Les données doivent être décryptées pour générer la convention' 
                          : ''
                    }
                  >
                    <span>
                      <Button 
                        variant="contained"
                        onClick={generateConvention}
                        disabled={!conventionTemplate || (!decryptedUserData && !canDecryptData()) || isGeneratingConvention}
                        sx={{
                          borderRadius: tokens.radius.md,
                          px: 2,
                          py: 0.75,
                          fontSize: '0.8125rem',
                          fontWeight: 500,
                          textTransform: 'none',
                          bgcolor: tokens.colors.info,
                          boxShadow: 'none',
                          '&:hover': {
                            bgcolor: '#0051D5',
                            boxShadow: '0 4px 12px rgba(0, 122, 255, 0.3)'
                          },
                          '&:disabled': {
                            bgcolor: '#d1d1d6',
                            color: '#8e8e93'
                          }
                        }}
                      >
                        {isGeneratingConvention ? 'Génération...' : 'Générer la convention étudiante'}
                      </Button>
                    </span>
                  </Tooltip>
                  {selectedUser.dossierValidated ? (
                    <Button 
                      variant="outlined" 
                      onClick={unvalidateUserDossier}
                      sx={{
                        borderRadius: tokens.radius.md,
                        px: 2,
                        py: 0.75,
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        textTransform: 'none',
                        borderColor: tokens.colors.error,
                        color: tokens.colors.error,
                        '&:hover': {
                          borderColor: tokens.colors.error,
                          bgcolor: 'rgba(255, 59, 48, 0.1)'
                        }
                      }}
                    >
                      Dévalider le dossier
                    </Button>
                  ) : (
                    <Button 
                      variant="contained" 
                      onClick={validateUserDossier}
                      sx={{
                        borderRadius: tokens.radius.md,
                        px: 2,
                        py: 0.75,
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        textTransform: 'none',
                        bgcolor: tokens.colors.success,
                        boxShadow: 'none',
                        '&:hover': {
                          bgcolor: '#28A745',
                          boxShadow: '0 4px 12px rgba(52, 199, 89, 0.3)'
                        }
                      }}
                    >
                      Valider le dossier
                    </Button>
                  )}
                </Box>
              </Box>

              <Box sx={{ 
                borderBottom: '1px solid rgba(0, 0, 0, 0.06)', 
                flexShrink: 0,
                px: 2.5,
                bgcolor: tokens.colors.surfaceAlt
              }}>
                <Tabs 
                  value={currentTab} 
                  onChange={handleTabChange}
                  variant="fullWidth"
                  sx={dsTabsSx}
                >
                  <Tab label="Dossier" />
                  <Tab label="Documents" />
                  <Tab label="Missions" />
                  <Tab label="Historique" />
                </Tabs>
              </Box>

              <Box sx={{ 
                px: 2.5,
                py: 2,
                flex: 1, 
                overflowY: 'auto', 
                minHeight: 0,
                '&::-webkit-scrollbar': {
                  width: '8px'
                },
                '&::-webkit-scrollbar-track': {
                  background: 'transparent'
                },
                '&::-webkit-scrollbar-thumb': {
                  background: '#d1d1d6',
                  borderRadius: '4px',
                  '&:hover': {
                    background: '#a1a1a6'
                  }
                }
              }}>
                {currentTab === 0 ? (
                  <Box>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        mb: 1,
                        fontWeight: 600,
                        fontSize: '1rem',
                        letterSpacing: '-0.01em',
                        color: tokens.colors.textPrimary
                      }}
                    >
                      Informations personnelles
                    </Typography>
                    {(() => {
                      const user = getDisplayUser();
                      const tfSx = { '& .MuiOutlinedInput-root': { backgroundColor: tokens.colors.bgDefault, '& fieldset': { borderColor: 'transparent' }, '&:hover fieldset': { borderColor: 'rgba(0,0,0,0.1)' }, '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: '1px' } }, '& .MuiInputBase-input': { fontSize: '0.875rem' } };
                      const renderField = (label: string, fieldKey: keyof UserDetails) => {
                        const value = user?.[fieldKey];
                        const formatted = formatValue(value, fieldKey as string);
                        const encrypted = formatted.isEncrypted && !decryptedUserData;
                        return (
                          <Grid item xs={12} sm={6} key={fieldKey as string}>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25, fontSize: '0.7rem' }}>
                                {label}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 500, color: encrypted ? tokens.colors.info : tokens.colors.textPrimary, fontStyle: encrypted ? 'italic' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-word' }}>
                                  {formatted.display}
                                </Typography>
                                {encrypted ? (
                                  <Tooltip title="Données cryptées et protégées">
                                    <LockIcon sx={{ fontSize: 13, color: tokens.colors.info }} />
                                  </Tooltip>
                                ) : null}
                              </Box>
                            </Box>
                          </Grid>
                        );
                      };
                      const renderSectionHeader = (title: string, sectionKey: string) => (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="subtitle1" fontWeight="bold">{title}</Typography>
                          {editingSection !== sectionKey ? (
                            canEditUser() ? (
                              <Button variant="outlined" startIcon={<EditIcon />} onClick={() => handleStartInlineEdit(sectionKey)} size="small" sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.75rem', py: 0.25, px: 1.5 }}>
                                Modifier
                              </Button>
                            ) : null
                          ) : (
                            <IconButton onClick={handleCancelInlineEdit} size="small"><CloseIcon fontSize="small" /></IconButton>
                          )}
                        </Box>
                      );
                      const renderSaveBar = () => (
                        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 0.5 }}>
                          <Button size="small" onClick={handleCancelInlineEdit} sx={{ textTransform: 'none' }}>Annuler</Button>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<SaveIcon />}
                            onClick={handleSaveInlineEdit}
                            disabled={isInlineEditDecrypting}
                            sx={{ textTransform: 'none' }}
                          >
                            Enregistrer
                          </Button>
                        </Grid>
                      );
                      const renderSkeletonInput = () => (
                        <Grid item xs={12} sm={6}>
                          <Skeleton variant="text" width="35%" height={14} animation="wave" sx={{ mb: 0.75 }} />
                          <Skeleton variant="rounded" height={40} animation="wave" sx={{ borderRadius: 1.5 }} />
                        </Grid>
                      );
                      const renderEditTextField = (
                        label: string,
                        fieldKey: keyof UserDetails,
                        extra?: { type?: string; inputProps?: object; InputLabelProps?: object; onChangeExtra?: (v: string) => string }
                      ) => {
                        if (isInlineEditDecrypting) return renderSkeletonInput();
                        return (
                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              size="small"
                              label={label}
                              type={extra?.type}
                              value={getDecryptedFieldValue(fieldKey)}
                              onChange={(e) => {
                                const v = extra?.onChangeExtra ? extra.onChangeExtra(e.target.value) : e.target.value;
                                handleInputChange(fieldKey, v);
                              }}
                              inputProps={extra?.inputProps}
                              InputLabelProps={extra?.InputLabelProps}
                              sx={tfSx}
                            />
                          </Grid>
                        );
                      };
                      const renderEditSelect = (
                        label: string,
                        fieldKey: keyof UserDetails,
                        options: { value: string; label: string }[]
                      ) => {
                        if (isInlineEditDecrypting) return renderSkeletonInput();
                        return (
                          <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small" sx={tfSx}>
                              <InputLabel>{label}</InputLabel>
                              <Select
                                value={getDecryptedFieldValue(fieldKey)}
                                label={label}
                                onChange={(e) => handleInputChange(fieldKey, e.target.value)}
                              >
                                {options.map((o) => (
                                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                        );
                      };
                      return (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                          {/* Section Identité */}
                          <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            {renderSectionHeader('Identité', 'identity')}
                            {editingSection === 'identity' && (editedUser || isInlineEditDecrypting) ? (
                              <Grid container spacing={1.25}>
                                {renderEditTextField('Prénom', 'firstName')}
                                {renderEditTextField('Nom', 'lastName')}
                                {renderEditTextField('Email', 'email')}
                                {renderEditTextField('Téléphone', 'phone')}
                                {renderEditTextField('Date de naissance', 'birthDate', { type: 'date', InputLabelProps: { shrink: true } })}
                                {renderEditSelect('Sexe', 'gender', [
                                  { value: 'M', label: 'Homme' },
                                  { value: 'F', label: 'Femme' },
                                  { value: 'Autre', label: 'Autre' },
                                ])}
                                {renderEditTextField('Lieu de naissance', 'birthPlace')}
                                {renderEditTextField('Code postal de naissance', 'birthPostalCode', {
                                  inputProps: { maxLength: 5 },
                                  onChangeExtra: (v) => v.replace(/\D/g, '').slice(0, 5),
                                })}
                                {renderEditTextField('Nationalité', 'nationality')}
                                {renderSaveBar()}
                              </Grid>
                            ) : (
                              <Grid container spacing={1.25}>
                                {renderField('Prénom', 'firstName')}
                                {renderField('Nom', 'lastName')}
                                {renderField('Email', 'email')}
                                {renderField('Téléphone', 'phone')}
                                {renderField('Date de naissance', 'birthDate')}
                                {renderField('Sexe', 'gender')}
                                {renderField('Lieu de naissance', 'birthPlace')}
                                {renderField('Code postal de naissance', 'birthPostalCode')}
                                {renderField('Nationalité', 'nationality')}
                              </Grid>
                            )}
                          </Paper>

                          {/* Section Adresse */}
                          <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            {renderSectionHeader('Adresse', 'address')}
                            {editingSection === 'address' && (editedUser || isInlineEditDecrypting) ? (
                              <Grid container spacing={1.25}>
                                {renderEditTextField('Adresse', 'address')}
                                {renderEditTextField('Code postal', 'postalCode', {
                                  inputProps: { maxLength: 5 },
                                  onChangeExtra: (v) => v.replace(/\D/g, '').slice(0, 5),
                                })}
                                {renderEditTextField('Ville', 'city')}
                                {renderSaveBar()}
                              </Grid>
                            ) : (
                              <Grid container spacing={1.25}>
                                {renderField('Adresse', 'address')}
                                {renderField('Code postal', 'postalCode')}
                                {renderField('Ville', 'city')}
                              </Grid>
                            )}
                          </Paper>

                          {/* Section Informations académiques */}
                          <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            {renderSectionHeader('Informations académiques', 'academic')}
                            {editingSection === 'academic' && (editedUser || isInlineEditDecrypting) ? (
                              <Grid container spacing={1.25}>
                                {structurePrograms.length > 0
                                  ? renderEditSelect(
                                      'Programme',
                                      'program',
                                      buildAcademicSelectOptions(structurePrograms, getDecryptedFieldValue('program'))
                                    )
                                  : renderEditTextField('Programme', 'program')}
                                {structureCampuses.length > 0
                                  ? renderEditSelect(
                                      'Campus',
                                      'campus',
                                      buildAcademicSelectOptions(structureCampuses, getDecryptedFieldValue('campus'))
                                    )
                                  : renderEditTextField('Campus', 'campus')}
                                {renderEditTextField('Numéro étudiant', 'studentId')}
                                {renderEditTextField('Année de diplomation', 'graduationYear')}
                                {renderEditTextField('N° Sécurité sociale', 'socialSecurityNumber', {
                                  inputProps: { maxLength: 15 },
                                  onChangeExtra: (v) => v.replace(/\D/g, '').slice(0, 15),
                                })}
                                {renderSaveBar()}
                              </Grid>
                            ) : (
                              <Grid container spacing={1.25}>
                                {renderField('Programme', 'program')}
                                {renderField('Campus', 'campus')}
                                {renderField('Numéro étudiant', 'studentId')}
                                {renderField('Année de diplomation', 'graduationYear')}
                                {renderField('Numéro de sécurité sociale', 'socialSecurityNumber')}
                              </Grid>
                            )}
                          </Paper>
                        </Box>
                      );
                    })()}
                  </Box>
                ) : null}

                {currentTab === 1 ? (
                  <Box>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 2,
                        mb: 3,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          fontSize: '1.25rem',
                          letterSpacing: '-0.01em',
                          color: tokens.colors.textPrimary,
                        }}
                      >
                        Documents
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={
                          downloadingAllDocuments ? (
                            <CircularProgress size={14} color="inherit" />
                          ) : (
                            <DownloadIcon fontSize="small" />
                          )
                        }
                        onClick={() => void handleDownloadAllDocuments()}
                        disabled={
                          loadingDocuments ||
                          downloadingAllDocuments ||
                          userDocuments.length === 0 ||
                          !selectedUser
                        }
                        sx={{
                          textTransform: 'none',
                          fontWeight: 500,
                          fontSize: '0.8125rem',
                          borderRadius: tokens.radius.md,
                          flexShrink: 0,
                        }}
                      >
                        {downloadProgress?.phase === 'decrypt'
                          ? `Déchiffrement ${downloadProgress.current}/${downloadProgress.total}…`
                          : downloadProgress?.phase === 'zip'
                            ? 'Création du ZIP…'
                            : 'Tout télécharger'}
                      </Button>
                    </Box>
                    {loadingDocuments ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : userDocuments.length > 0 ? (
                      <Box sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                        gap: 2
                      }}>
                        {userDocuments.map((document) => (
                          <Box
                            key={document.id}
                            onClick={() => handleDocumentClick(document)}
                            sx={{
                              p: 2.5,
                              borderRadius: tokens.radius.md,
                              bgcolor: tokens.colors.bgSubtle,
                              border: '1px solid transparent',
                              cursor: 'pointer',
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              '&:hover': {
                                bgcolor: tokens.colors.gray150,
                                borderColor: alpha('#000', 0.1),
                                transform: 'translateY(-2px)',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                              }
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                              {getFileIcon(document.type, document.name)}
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    fontWeight: 500,
                                    fontSize: '0.875rem',
                                    color: tokens.colors.textPrimary,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {document.name}
                                </Typography>
                              </Box>
                            </Box>
                            {document.createdAt ? (
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: tokens.colors.textSecondary,
                                  fontSize: '0.7rem',
                                  display: 'block'
                                }}
                              >
                                {document.createdAt instanceof Timestamp
                                  ? document.createdAt.toDate().toLocaleDateString('fr-FR', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })
                                  : new Date(document.createdAt).toLocaleDateString('fr-FR', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                              </Typography>
                            ) : null}
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Box sx={{ 
                        textAlign: 'center', 
                        py: 6,
                        color: tokens.colors.textSecondary
                      }}>
                        <FileIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                          Aucun document disponible
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ) : null}

                {currentTab === 2 ? (
                  <Box>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        mb: 3,
                        fontWeight: 600,
                        fontSize: '1.25rem',
                        letterSpacing: '-0.01em',
                        color: tokens.colors.textPrimary
                      }}
                    >
                      Missions effectuées
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {selectedUser?.missions && selectedUser.missions.length > 0 ? (
                        selectedUser.missions.map((mission) => (
                          <Box 
                            key={mission.id} 
                            sx={{ 
                              p: 3, 
                              borderRadius: tokens.radius.lg,
                              bgcolor: tokens.colors.bgSubtle,
                              border: '1px solid rgba(0, 0, 0, 0.05)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 1.5,
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                bgcolor: tokens.colors.gray150,
                                transform: 'translateY(-2px)',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                              }
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography 
                                variant="h6"
                                sx={{
                                  fontWeight: 600,
                                  fontSize: '1.0625rem',
                                  letterSpacing: '-0.01em',
                                  color: tokens.colors.textPrimary
                                }}
                              >
                                {mission.title}
                              </Typography>
                              <Chip 
                                label={mission.status} 
                                size="small"
                                sx={{
                                  fontSize: '0.75rem',
                                  height: '24px',
                                  fontWeight: 500,
                                  bgcolor: mission.status === 'En cours' ? '#5AC8FA' : 
                                           mission.status === 'Terminée' ? tokens.colors.success : tokens.colors.error,
                                  color: '#ffffff',
                                  border: 'none'
                                }}
                              />
                            </Box>
                            <Typography 
                              variant="body2" 
                              sx={{
                                color: tokens.colors.textSecondary,
                                fontSize: '0.875rem',
                                lineHeight: 1.5
                              }}
                            >
                              {mission.description}
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, pt: 1.5, borderTop: '1px solid rgba(0, 0, 0, 0.06)' }}>
                              <Typography 
                                variant="caption" 
                                sx={{
                                  color: tokens.colors.textSecondary,
                                  fontSize: '0.8125rem'
                                }}
                              >
                                {mission.startDate} - {mission.endDate}
                              </Typography>
                              <Typography 
                                variant="body2" 
                                sx={{
                                  fontWeight: 600,
                                  color: tokens.colors.textPrimary,
                                  fontSize: '0.875rem'
                                }}
                              >
                                {mission.remuneration}
                              </Typography>
                            </Box>
                            <Typography 
                              variant="caption" 
                              sx={{
                                color: tokens.colors.textSecondary,
                                fontSize: '0.8125rem'
                              }}
                            >
                              Lieu: {mission.location}
                            </Typography>
                          </Box>
                        ))
                      ) : (
                        <Box sx={{ 
                          p: 6, 
                          textAlign: 'center', 
                          color: tokens.colors.textSecondary
                        }}>
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                            Aucune mission effectuée
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                ) : null}

                {currentTab === 3 ? (
                  <Box>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        mb: 3,
                        fontWeight: 600,
                        fontSize: '1.25rem',
                        letterSpacing: '-0.01em',
                        color: tokens.colors.textPrimary
                      }}
                    >
                      Historique des actions
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {userHistory.length > 0 ? (
                        userHistory.map((entry) => (
                          <Box 
                            key={entry.id} 
                            sx={{ 
                              p: 3, 
                              borderRadius: tokens.radius.lg,
                              bgcolor: tokens.colors.bgSubtle,
                              border: '1px solid rgba(0, 0, 0, 0.05)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 1,
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                bgcolor: tokens.colors.gray150,
                                transform: 'translateY(-2px)',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                              }
                            }}
                          >
                            <Typography 
                              variant="caption" 
                              sx={{
                                color: tokens.colors.textSecondary,
                                fontSize: '0.75rem',
                                fontWeight: 500
                              }}
                            >
                              {new Date(entry.date).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </Typography>
                            <Typography 
                              variant="body1"
                              sx={{
                                fontWeight: 500,
                                fontSize: '0.9375rem',
                                color: tokens.colors.textPrimary,
                                letterSpacing: '-0.01em'
                              }}
                            >
                              {entry.action}
                            </Typography>
                            {entry.type === 'profile' && entry.action.includes('Validation') ? (
                              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Chip 
                                  label="Dossier validé" 
                                  size="small"
                                  sx={{
                                    fontSize: '0.75rem',
                                    height: '24px',
                                    fontWeight: 500,
                                    bgcolor: tokens.colors.success,
                                    color: '#ffffff',
                                    border: 'none'
                                  }}
                                />
                                <Typography 
                                  variant="caption" 
                                  sx={{
                                    color: tokens.colors.textSecondary,
                                    fontSize: '0.8125rem'
                                  }}
                                >
                                  par {entry.details.split(' par ')[1] || 'un administrateur'}
                                </Typography>
                              </Box>
                            ) : entry.type === 'profile' && entry.action.includes('Modification') ? (
                              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Chip 
                                  label="Profil modifié" 
                                  size="small"
                                  sx={{
                                    fontSize: '0.75rem',
                                    height: '24px',
                                    fontWeight: 500,
                                    bgcolor: '#5AC8FA',
                                    color: '#ffffff',
                                    border: 'none'
                                  }}
                                />
                                <Typography 
                                  variant="caption" 
                                  sx={{
                                    color: tokens.colors.textSecondary,
                                    fontSize: '0.8125rem'
                                  }}
                                >
                                  {entry.details}
                                </Typography>
                              </Box>
                            ) : entry.type === 'profile' && entry.action.includes('Complétion') ? (
                              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Chip 
                                  label="Profil complété" 
                                  size="small"
                                  sx={{
                                    fontSize: '0.75rem',
                                    height: '24px',
                                    fontWeight: 500,
                                    bgcolor: tokens.colors.success,
                                    color: '#ffffff',
                                    border: 'none'
                                  }}
                                />
                                <Typography 
                                  variant="caption" 
                                  sx={{
                                    color: tokens.colors.textSecondary,
                                    fontSize: '0.8125rem'
                                  }}
                                >
                                  {entry.details}
                                </Typography>
                              </Box>
                            ) : entry.type === 'profile' && (entry.action.includes('Décryptage') || entry.action.includes('Masquage')) ? (
                              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Chip 
                                  label={entry.action.includes('Décryptage') ? "Données décryptées" : "Données masquées"} 
                                  size="small"
                                  sx={{
                                    fontSize: '0.75rem',
                                    height: '24px',
                                    fontWeight: 500,
                                    bgcolor: entry.action.includes('Décryptage') ? tokens.colors.info : tokens.colors.textSecondary,
                                    color: '#ffffff',
                                    border: 'none'
                                  }}
                                />
                                <Typography 
                                  variant="caption" 
                                  sx={{
                                    color: tokens.colors.textSecondary,
                                    fontSize: '0.8125rem'
                                  }}
                                >
                                  {entry.details}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography 
                                variant="caption" 
                                sx={{
                                  color: tokens.colors.textSecondary,
                                  fontSize: '0.8125rem'
                                }}
                              >
                                {entry.details}
                              </Typography>
                            )}
                          </Box>
                        ))
                      ) : (
                        <Box sx={{ 
                          p: 6, 
                          textAlign: 'center', 
                          color: tokens.colors.textSecondary
                        }}>
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                            Aucun historique disponible
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                ) : null}
              </Box>
            </>
          ) : (
            <Box sx={{ 
              p: 6, 
              textAlign: 'center', 
              color: tokens.colors.textSecondary,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%'
            }}>
              <Typography 
                variant="h6"
                sx={{
                  fontSize: '1.125rem',
                  fontWeight: 500,
                  color: tokens.colors.textPrimary,
                  mb: 1
                }}
              >
                Sélectionnez un membre
              </Typography>
              <Typography 
                variant="body2"
                sx={{
                  fontSize: '0.875rem',
                  color: tokens.colors.textSecondary
                }}
              >
                Choisissez un membre dans la liste pour voir ses détails
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            mt: 1.5,
            minWidth: 260,
            borderRadius: 6,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.08)',
            py: 0.75,
            px: 0.75,
          },
        }}
        MenuListProps={{ sx: { py: 0 } }}
      >
        <MenuItem
          onClick={handleEditUser}
          disabled={!canEditUser()}
          title={!canEditUser() ? "Seuls les admins, membres RH, superadmins et personnes ayant accès au décryptage peuvent modifier les profils" : ""}
          sx={{
            py: 1.25,
            px: 1.5,
            gap: 1.5,
            borderRadius: 4,
            '&:hover': { bgcolor: 'action.hover' },
            '&.Mui-disabled': { opacity: 0.6 },
          }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: 'primary.main' }}>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Modifier le profil" primaryTypographyProps={{ fontSize: '0.9375rem', fontWeight: 500 }} />
        </MenuItem>
        {(isSuperAdmin || canRead) ? <Divider sx={{ my: 0.5 }} /> : null}
        {isSuperAdmin ? (
          <MenuItem
            onClick={handleOpenPasswordDialog}
            disabled={!selectedUser}
            sx={{
              py: 1.25,
              px: 1.5,
              gap: 1.5,
              borderRadius: 4,
              '&:hover': { bgcolor: 'action.hover' },
              '&.Mui-disabled': { opacity: 0.6 },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: 'primary.main' }}>
              <LockIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Modifier le mot de passe" primaryTypographyProps={{ fontSize: '0.9375rem', fontWeight: 500 }} />
          </MenuItem>
        ) : null}
        {(isSuperAdmin || canRead) ? (
          <MenuItem
            onClick={handleSendPasswordResetEmail}
            disabled={!selectedUser || !canRead}
            title={!canRead ? "Accès RH requis" : "Envoie un email à l'utilisateur pour qu'il réinitialise son mot de passe"}
            sx={{
              py: 1.25,
              px: 1.5,
              gap: 1.5,
              borderRadius: 4,
              '&:hover': { bgcolor: 'action.hover' },
              '&.Mui-disabled': { opacity: 0.6 },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: 'primary.main' }}>
              <EmailIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Envoyer un email de réinitialisation" primaryTypographyProps={{ fontSize: '0.9375rem', fontWeight: 500 }} />
          </MenuItem>
        ) : null}
        <Divider sx={{ my: 0.5 }} />
        <MenuItem
          onClick={() => setAnchorEl(null)}
          sx={{
            py: 1.25,
            px: 1.5,
            gap: 1.5,
            borderRadius: 4,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>
            <PersonOffIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Désactiver le compte" primaryTypographyProps={{ fontSize: '0.9375rem', fontWeight: 500 }} />
        </MenuItem>
        <MenuItem
          onClick={handleDeleteUser}
          disabled={!selectedUser || !canEditUser()}
          title={!canEditUser() ? "Seuls les admins, membres RH, superadmins et personnes ayant accès au décryptage peuvent supprimer les utilisateurs" : ""}
          sx={{
            py: 1.25,
            px: 1.5,
            gap: 1.5,
            borderRadius: 4,
            color: 'error.main',
            '&:hover': { bgcolor: (theme) => alpha(theme.palette.error.main, 0.08) },
            '&.Mui-disabled': { opacity: 0.6 },
          }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Supprimer" primaryTypographyProps={{ fontSize: '0.9375rem', fontWeight: 600 }} />
        </MenuItem>
      </Menu>

      {/* Dialog modification mot de passe (superadmin) */}
      <Dialog open={passwordDialogOpen} onClose={handleClosePasswordDialog} maxWidth="xs" fullWidth>
        <DialogTitle component="div">Modifier le mot de passe</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Utilisateur :{' '}
            {selectedUser ? (
              <UserNameText
                user={{ id: selectedUser.id, ...getDisplayUser() }}
                component="span"
                skeletonWidth={160}
              />
            ) : null}
          </Typography>
          <TextField
            fullWidth
            type="password"
            label="Nouveau mot de passe"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            margin="normal"
            autoComplete="new-password"
            helperText="Minimum 6 caractères"
          />
          <TextField
            fullWidth
            type="password"
            label="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            margin="normal"
            autoComplete="new-password"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePasswordDialog}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleSubmitNewPassword}
            disabled={passwordLoading || newPassword.length < 6 || newPassword !== confirmPassword}
          >
            {passwordLoading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal d'édition des informations utilisateur */}
      <Dialog
        open={editModalOpen}
        onClose={handleCloseEditModal}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle component="div">
          Modifier les informations de {getDecryptedFieldValue('firstName')} {getDecryptedFieldValue('lastName')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={3}>
              {/* Informations personnelles */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                  Informations personnelles
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Prénom"
                  value={getDecryptedFieldValue('firstName')}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nom"
                  value={getDecryptedFieldValue('lastName')}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Date de naissance"
                  type="date"
                  value={getDecryptedFieldValue('birthDate')}
                  onChange={(e) => handleInputChange('birthDate', e.target.value)}
                  variant="outlined"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Lieu de naissance"
                  value={getDecryptedFieldValue('birthPlace')}
                  onChange={(e) => handleInputChange('birthPlace', e.target.value)}
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Code postal de naissance"
                  value={getDecryptedFieldValue('birthPostalCode')}
                  onChange={(e) => handleInputChange('birthPostalCode', e.target.value)}
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Sexe</InputLabel>
                  <Select
                    value={getDecryptedFieldValue('gender')}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    label="Sexe"
                  >
                    <MenuItem value="M">Homme</MenuItem>
                    <MenuItem value="F">Femme</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nationalité"
                  value={getDecryptedFieldValue('nationality')}
                  onChange={(e) => handleInputChange('nationality', e.target.value)}
                  variant="outlined"
                />
              </Grid>

              {/* Informations de contact */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', mt: 3 }}>
                  Informations de contact
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={getDecryptedFieldValue('email')}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Numéro de téléphone"
                  value={getDecryptedFieldValue('phone')}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Adresse"
                  value={getDecryptedFieldValue('address')}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Code postal"
                  value={getDecryptedFieldValue('postalCode')}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 5);
                    handleInputChange('postalCode', value);
                  }}
                  variant="outlined"
                  inputProps={{ maxLength: 5 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Ville"
                  value={getDecryptedFieldValue('city')}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  variant="outlined"
                />
              </Grid>

              {/* Informations académiques */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', mt: 3 }}>
                  Informations académiques
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                {structurePrograms.length > 0 ? (
                  <FormControl fullWidth variant="outlined">
                    <InputLabel>Programme</InputLabel>
                    <Select
                      value={getDecryptedFieldValue('program')}
                      onChange={(e) => handleInputChange('program', e.target.value)}
                      label="Programme"
                    >
                      {buildAcademicSelectOptions(structurePrograms, getDecryptedFieldValue('program')).map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <TextField
                    fullWidth
                    label="Programme"
                    value={getDecryptedFieldValue('program')}
                    onChange={(e) => handleInputChange('program', e.target.value)}
                    variant="outlined"
                  />
                )}
              </Grid>

              <Grid item xs={12} sm={6}>
                {structureCampuses.length > 0 ? (
                  <FormControl fullWidth variant="outlined">
                    <InputLabel>Campus</InputLabel>
                    <Select
                      value={getDecryptedFieldValue('campus')}
                      onChange={(e) => handleInputChange('campus', e.target.value)}
                      label="Campus"
                    >
                      {buildAcademicSelectOptions(structureCampuses, getDecryptedFieldValue('campus')).map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <TextField
                    fullWidth
                    label="Campus"
                    value={getDecryptedFieldValue('campus')}
                    onChange={(e) => handleInputChange('campus', e.target.value)}
                    variant="outlined"
                  />
                )}
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Numéro étudiant"
                  value={getDecryptedFieldValue('studentId')}
                  onChange={(e) => handleInputChange('studentId', e.target.value)}
                  variant="outlined"
                  autoComplete="off"
                  inputProps={{
                    style: {
                      caretColor: tokens.colors.textPrimary,
                    },
                  }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Année de diplomation"
                  value={getDecryptedFieldValue('graduationYear')}
                  onChange={(e) => handleInputChange('graduationYear', e.target.value)}
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Numéro de sécurité sociale"
                  value={getDecryptedFieldValue('socialSecurityNumber')}
                  onChange={(e) => handleInputChange('socialSecurityNumber', e.target.value)}
                  variant="outlined"
                />
              </Grid>

            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseEditModal} color="inherit">
            Annuler
          </Button>
          <Button 
            onClick={handleSaveUser} 
            variant="contained" 
            color="primary"
            disabled={!editedUser}
          >
            Sauvegarder
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={inviteDialogOpen} onClose={() => !inviteSending && setInviteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Inviter un membre</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Un email d&apos;invitation sera envoyé avec un lien pour rejoindre votre structure.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            disabled={inviteSending}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialogOpen(false)} disabled={inviteSending}>
            Annuler
          </Button>
          <Button
            variant="contained"
            disabled={inviteSending || !inviteEmail.includes('@')}
            onClick={async () => {
              setInviteSending(true);
              try {
                const res = await inviteStructureMemberByEmail(inviteEmail.trim());
                if (!res.ok) {
                  setSnackbar({ open: true, message: res.error || 'Erreur', severity: 'error' });
                } else if (res.emailSkipped) {
                  setSnackbar({
                    open: true,
                    message: `Invitation enregistrée (email non envoyé : template non configuré).`,
                    severity: 'warning',
                  });
                  setInviteDialogOpen(false);
                  setInviteEmail('');
                } else {
                  setSnackbar({ open: true, message: 'Invitation envoyée', severity: 'success' });
                  setInviteDialogOpen(false);
                  setInviteEmail('');
                }
              } finally {
                setInviteSending(false);
              }
            }}
          >
            {inviteSending ? 'Envoi…' : 'Envoyer'}
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
            sx={{
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              '& .MuiAlert-message': {
                width: '100%'
              }
            }}
          >
            {snackbar.message.includes('2FA') || snackbar.message.includes('authentification à deux facteurs') ? (
              <Typography component="span" variant="body2" sx={{ display: 'inline' }}>
                {snackbar.message.split(/(authentification à deux facteurs \(2FA\)|2FA)/i).map((part, index) =>
                  index % 2 === 1 ? (
                    <span
                      key={index}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        navigate('/app/profile?tab=security');
                        setSnackbar(prev => ({ ...prev, open: false }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          navigate('/app/profile?tab=security');
                          setSnackbar(prev => ({ ...prev, open: false }));
                        }
                      }}
                      style={{
                        color: tokens.colors.info,
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {part}
                    </span>
                  ) : (
                    <span key={index}>{part}</span>
                  )
                )}
              </Typography>
            ) : (
              snackbar.message
            )}
          </Alert>
        </Snackbar>,
        document.body
      )}

      {/* Dialog 2FA pour décrypter les données */}
      <TwoFactorDialog
        open={twoFactorDialogOpen}
        onClose={() => {
          setTwoFactorDialogOpen(false);
          setPendingEditAfterDecrypt(false);
          // Si on était en train de générer la convention, annuler le processus
          if (isGeneratingConvention) {
            setIsGeneratingConvention(false);
          }
        }}
        onVerify={handleDecryptData}
        title="Décrypter les données"
        message="Veuillez entrer le code à 6 chiffres de votre application d'authentification pour décrypter et afficher les données sensibles."
      />

      <TwoFactorDialog
        open={twoFactorDocumentOpen}
        onClose={() => {
          setTwoFactorDocumentOpen(false);
          setPendingDecryptDocument(null);
          setPendingBulkDownload(null);
        }}
        onVerify={handleVerifyDocument2FA}
        title="Validation 2FA requise"
        message={
          pendingBulkDownload
            ? 'Des documents sont chiffrés. Entrez le code à 6 chiffres pour télécharger l\'archive complète.'
            : 'Ce document est chiffré. Entrez le code à 6 chiffres de votre application d\'authentification pour y accéder.'
        }
      />

      {/* Modal de visualisation de document */}
      <Dialog
        open={viewerOpen}
        onClose={() => {
          setViewerOpen(false);
          if (viewerUrl && viewerUrl.startsWith('blob:')) {
            URL.revokeObjectURL(viewerUrl);
          }
          setViewerUrl(null);
          setViewerContentType(null);
          setViewerError(null);
          setViewerLoading(false);
          setCurrentViewingDocument(null);
        }}
        maxWidth="lg"
        fullWidth
        sx={{
          zIndex: 9999,
          '& .MuiDialog-container': {
            zIndex: 9999
          }
        }}
        PaperProps={{
          sx: {
            height: '90vh',
            maxHeight: '90vh',
            zIndex: 9999
          }
        }}
      >
        <DialogTitle component="div" sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 1
        }}>
          Visualisation du document
          <IconButton
            onClick={() => {
              setViewerOpen(false);
              if (viewerUrl && viewerUrl.startsWith('blob:')) {
                URL.revokeObjectURL(viewerUrl);
              }
              setViewerUrl(null);
              setViewerContentType(null);
              setViewerError(null);
              setViewerLoading(false);
            }}
            sx={{ color: 'text.secondary' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, position: 'relative', height: '100%', minHeight: '400px' }}>
          {viewerLoading ? (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100%',
              flexDirection: 'column',
              gap: 2
            }}>
              <CircularProgress size={48} />
              <Typography variant="body1" color="text.secondary">
                Chargement du document...
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, textAlign: 'center' }}>
                Le décryptage peut prendre quelques secondes pour les documents protégés.
              </Typography>
            </Box>
          ) : null}
          {viewerError && !viewerLoading ? (
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
              <Alert severity="warning" sx={{ width: '100%' }}>{viewerError}</Alert>
            </Box>
          ) : null}
          {viewerUrl && !viewerLoading && !viewerError ? (
            <Box sx={{ 
              height: '100%', 
              width: '100%',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: '#f5f5f5'
            }}>
              {(() => {
                const ct = viewerContentType || currentViewingDocument?.type || '';
                const showPdf =
                  isPdfContentType(ct) ||
                  (currentViewingDocument?.name || '').toLowerCase().endsWith('.pdf');
                const showImage = isImageContentType(ct);

                if (showPdf) {
                  return (
                    <iframe
                      src={viewerUrl}
                      title={currentViewingDocument?.name || 'Document'}
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        flex: 1,
                        minHeight: 500,
                      }}
                    />
                  );
                }
                if (showImage) {
                  return (
                    <Box
                      sx={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 2,
                        overflow: 'auto',
                      }}
                    >
                      <img
                        src={viewerUrl}
                        alt={currentViewingDocument?.name || 'Document'}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                        }}
                      />
                    </Box>
                  );
                }
                return (
                  <Box
                    sx={{
                      p: 3,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                    }}
                  >
                    <Alert severity="info" sx={{ width: '100%' }}>
                      Aperçu non disponible pour ce type de fichier. Utilisez le téléchargement ou
                      ouvrez le document dans un nouvel onglet.
                    </Alert>
                    <Button variant="contained" onClick={() => window.open(viewerUrl, '_blank')}>
                      Ouvrir dans un nouvel onglet
                    </Button>
                  </Box>
                );
              })()}
            </Box>
          ) : null}
          {!viewerUrl && !viewerLoading && !viewerError ? (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100%',
              flexDirection: 'column',
              gap: 2
            }}>
              <Typography variant="body2" color="text.secondary">
                Aucun document à afficher
              </Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (viewerUrl) {
                window.open(viewerUrl, '_blank');
              }
            }}
            disabled={!viewerUrl || viewerLoading}
          >
            Ouvrir dans un nouvel onglet
          </Button>
          <Button
            onClick={async () => {
              if (viewerUrl && currentViewingDocument) {
                const link = document.createElement('a');
                link.href = viewerUrl;
                link.download = ensureFileNameWithExtension(
                  currentViewingDocument.name || 'document',
                  viewerContentType || 'application/octet-stream'
                );
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Ajouter un log dans l'historique pour le téléchargement
                if (selectedUser && currentUser) {
                  try {
                    const historyRef = collection(db, 'history');
                    await addDoc(historyRef, {
                      userId: selectedUser.id,
                      date: new Date().toISOString(),
                      action: 'Téléchargement de document',
                      details: `Document "${currentViewingDocument.name}" téléchargé par ${currentUser.displayName || currentUser.email}`,
                      type: 'document'
                    });
                    // Rafraîchir l'historique
                    fetchUserHistory(selectedUser.id);
                  } catch (historyError) {
                    console.error('Erreur lors de l\'ajout du log dans l\'historique:', historyError);
                  }
                }
              }
            }}
            disabled={!viewerUrl || viewerLoading}
          >
            Télécharger
          </Button>
          <Button
            onClick={() => {
              setViewerOpen(false);
              if (viewerUrl && viewerUrl.startsWith('blob:')) {
                URL.revokeObjectURL(viewerUrl);
              }
              setViewerUrl(null);
              setViewerContentType(null);
              setViewerError(null);
              setViewerLoading(false);
            }}
          >
            Fermer
          </Button>
        </DialogActions>
      </Dialog>
    </AppPageShell>
  );
};

export default HumanResources; 