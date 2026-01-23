import React, { useState, useEffect, useRef } from 'react';
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
  Checkbox,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, onSnapshot, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import axios from 'axios';
import TwoFactorDialog from '../components/common/TwoFactorDialog';
import { canAccessPage, type UserStatus } from '../utils/permissions';
import { Template } from '../types/templates';
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
  address: string;
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

const HumanResources = () => {
  const { currentUser, updateLastActivity } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [completionFilter, setCompletionFilter] = useState<string>('all');
  const [validationFilter, setValidationFilter] = useState<string>('all');

  // Modifions les états pour permettre la sélection multiple
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [completionFilters, setCompletionFilters] = useState<string[]>([]);
  const [validationFilters, setValidationFilters] = useState<string[]>([]);

  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editedUser, setEditedUser] = useState<UserDetails | null>(null);
  const [currentUserStatus, setCurrentUserStatus] = useState<string>('');
  const [decryptedUserData, setDecryptedUserData] = useState<UserDetails | null>(null);
  const [twoFactorDialogOpen, setTwoFactorDialogOpen] = useState(false);
  const [hasDecryptionAccess, setHasDecryptionAccess] = useState(false);
  const [hasTwoFactor, setHasTwoFactor] = useState(false);
  const [userDocuments, setUserDocuments] = useState<Document[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [userStructureId, setUserStructureId] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isGeneratingConvention, setIsGeneratingConvention] = useState(false);
  const [pendingEditAfterDecrypt, setPendingEditAfterDecrypt] = useState(false);
  // Ref pour suivre si la génération est en cours (pour éviter les problèmes de closure)
  const isGeneratingConventionRef = useRef(false);
  
  // États pour le viewer de document
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [currentViewingDocument, setCurrentViewingDocument] = useState<Document | null>(null);

  const [searchParams] = useSearchParams();

  // Fonction pour gérer la sélection multiple des filtres
  const handleFilterChange = (filterType: string, value: string) => {
    switch (filterType) {
      case 'status':
        if (value === 'all') {
          setStatusFilters([]);
        } else {
          setStatusFilters(prev => 
            prev.includes(value) 
              ? prev.filter(item => item !== value) 
              : [...prev, value]
          );
        }
        break;
      case 'completion':
        if (value === 'all') {
          setCompletionFilters([]);
        } else {
          setCompletionFilters(prev => 
            prev.includes(value) 
              ? prev.filter(item => item !== value) 
              : [...prev, value]
          );
        }
        break;
      case 'validation':
        if (value === 'all') {
          setValidationFilters([]);
        } else {
          setValidationFilters(prev => 
            prev.includes(value) 
              ? prev.filter(item => item !== value) 
              : [...prev, value]
          );
        }
        break;
    }
  };

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
    
    return { display: String(value), isEncrypted: false };
  };

  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser) return;

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
          
          const usersData = querySnapshot.docs.map(doc => {
            const data = doc.data();
            // Gérer la compatibilité avec les anciennes données qui utilisent studyYear
            const graduationYear = data.graduationYear || data.studyYear || '';
            return {
              id: doc.id,
              ...data,
              graduationYear,
              lastLogin: data.lastLogin || null,
              isOnline: data.isOnline || false
            };
          }) as UserDetails[];
          
          setUsers(usersData);

          await fetchConventionTemplate(structureId);
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des données:", error);
      }
    };

    fetchUsers();
  }, [currentUser]);

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
        const isUserAdmin = normalizedStatus === 'admin';
        const isUserSuperAdmin = normalizedStatus === 'superadmin';
        
        console.log("Données utilisateur pour permissions:", {
          status: userData.status,
          isUserAdmin,
          isUserSuperAdmin,
          poles: userData.poles
        }); // Debug
        
        setIsAdmin(isUserAdmin);
        setIsSuperAdmin(isUserSuperAdmin);
        
        // Vérifier si l'utilisateur est membre du pôle RH
        const isHR = userData.poles?.some((pole: any) => 
          pole.poleId === 'rh' || pole.name === 'Ressources humaines'
        );
        console.log("Est membre RH:", isHR); // Debug
        setIsHRMember(isHR);
        
        // Vérifier si l'utilisateur a la 2FA activée
        const has2FA = userData.twoFactorEnabled === true;
        setHasTwoFactor(has2FA);
        
        // Vérifier si l'utilisateur a accès au décryptage (admin ou superadmin)
        const canDecrypt = isUserAdmin || isUserSuperAdmin || isHR;
        setHasDecryptionAccess(canDecrypt);
      } catch (error) {
        console.error("Erreur lors de la vérification du rôle:", error);
      }
    };

    checkUserRole();
  }, [currentUser]);

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
              uploadedByName = userData?.displayName || `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || 'Inconnu';
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

  // Fonction pour ouvrir/télécharger un document avec support du décryptage
  const handleDocumentClick = async (document: Document) => {
    if (!document.url) return;
    
    try {
      // Extraire le chemin du fichier depuis l'URL ou storagePath
      let path: string | null = null;
      
      // Fonction helper pour extraire le chemin depuis une URL
      const extractPathFromUrl = (url: string): string | null => {
        try {
          const urlObj = new URL(url);
          const pathStartIndex = urlObj.pathname.indexOf('/o/') + 3;
          if (pathStartIndex > 2) {
            const encodedPath = urlObj.pathname.substring(pathStartIndex);
            return decodeURIComponent(encodedPath.replace(/%2F/g, '/'));
          }
        } catch (e) {
          console.error(`Erreur parsing URL:`, e);
        }
        return null;
      };
      
      // Utiliser storagePath si c'est un chemin valide (pas une URL)
      if (document.storagePath && !document.storagePath.startsWith('http')) {
        path = document.storagePath;
      } else {
        // Essayer d'extraire depuis storagePath s'il est une URL
        if (document.storagePath && document.storagePath.startsWith('http')) {
          path = extractPathFromUrl(document.storagePath);
        }
        
        // Sinon, extraire depuis l'URL du document
        if (!path) {
          path = extractPathFromUrl(document.url);
        }
      }
      
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
        
        // Vérifier d'abord si le fichier est chiffré
        try {
          const functions = getFunctions();
          const isFileEncrypted = httpsCallable(functions, 'isFileEncrypted');
          
          const checkResult = await isFileEncrypted({ filePath: path });
          const isEncrypted = (checkResult.data as any)?.encrypted;
          
          if (isEncrypted) {
            // Le fichier est chiffré, utiliser decryptFile
            setViewerLoading(true);
            setViewerError(null);
            try {
              console.log(`[HumanResources] Appel decryptFile avec filePath:`, path);
              
              const response = await axios.get(
                `https://us-central1-jsaas-dd2f7.cloudfunctions.net/decryptFile`,
                {
                  params: { filePath: path },
                  headers: {
                    'Authorization': `Bearer ${token}`
                  },
                  responseType: 'blob',
                  timeout: 60000 // 60 secondes
                }
              );
              
              // Fichier déchiffré avec succès
              const blob = new Blob([response.data], { type: 'application/pdf' });
              const url = URL.createObjectURL(blob);
              console.log('✅ Document déchiffré, URL blob créée:', url.substring(0, 50) + '...');
              setViewerUrl(url);
              setCurrentViewingDocument(document);
              setViewerOpen(true);
              setViewerLoading(false);
              
              // Ajouter un log dans l'historique
              if (selectedUser && currentUser) {
                try {
                  const historyRef = collection(db, 'history');
                  await addDoc(historyRef, {
                    userId: selectedUser.id,
                    date: new Date().toISOString(),
                    action: 'Consultation de document',
                    details: `Document "${document.name}" consulté par ${currentUser.displayName || currentUser.email}`,
                    type: 'document'
                  });
                  // Rafraîchir l'historique
                  fetchUserHistory(selectedUser.id);
                } catch (historyError) {
                  console.error('Erreur lors de l\'ajout du log dans l\'historique:', historyError);
                }
              }
            } catch (decryptError: any) {
              console.error('Erreur lors du déchiffrement:', decryptError);
              setViewerLoading(false);
              if (decryptError.response?.status === 403) {
                const errorMsg = decryptError.response?.data?.error || 'Accès refusé';
                if (errorMsg.includes('2FA')) {
                  setViewerError('Ce document est chiffré. Veuillez activer l\'authentification à deux facteurs (2FA) pour y accéder.');
                } else {
                  setViewerError('Accès refusé à ce document chiffré');
                }
              } else {
                setViewerError(`Erreur lors du déchiffrement: ${decryptError.message || 'Erreur inconnue'}`);
              }
            }
          } else {
            // Le fichier n'est pas chiffré, téléchargement direct
            setViewerLoading(true);
            setViewerError(null);
            try {
              const storage = getStorage();
              const fileRef = ref(storage, path);
              const url = await getDownloadURL(fileRef);
              console.log('✅ URL Firebase Storage obtenue:', url.substring(0, 100) + '...');
              setViewerUrl(url);
              setCurrentViewingDocument(document);
              setViewerOpen(true);
              setViewerLoading(false);
              
              // Ajouter un log dans l'historique
              if (selectedUser && currentUser) {
                try {
                  const historyRef = collection(db, 'history');
                  await addDoc(historyRef, {
                    userId: selectedUser.id,
                    date: new Date().toISOString(),
                    action: 'Consultation de document',
                    details: `Document "${document.name}" consulté par ${currentUser.displayName || currentUser.email}`,
                    type: 'document'
                  });
                  // Rafraîchir l'historique
                  fetchUserHistory(selectedUser.id);
                } catch (historyError) {
                  console.error('Erreur lors de l\'ajout du log dans l\'historique:', historyError);
                }
              }
            } catch (downloadError: any) {
              // Si le téléchargement direct échoue, le fichier est probablement chiffré
              // mais les métadonnées ne sont pas encore propagées, essayer decryptFile
              console.warn('Téléchargement direct échoué, tentative de déchiffrement (métadonnées peut-être pas encore propagées):', downloadError);
              try {
                const response = await axios.get(
                  `https://us-central1-jsaas-dd2f7.cloudfunctions.net/decryptFile`,
                  {
                    params: { filePath: path },
                    headers: {
                      'Authorization': `Bearer ${token}`
                    },
                    responseType: 'blob'
                  }
                );
                
                const blob = new Blob([response.data], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                console.log('✅ Document déchiffré (fallback), URL blob créée:', url.substring(0, 50) + '...');
                setViewerUrl(url);
                setCurrentViewingDocument(document);
                setViewerOpen(true);
                setViewerLoading(false);
                
                // Ajouter un log dans l'historique
                if (selectedUser && currentUser) {
                  try {
                    const historyRef = collection(db, 'history');
                    await addDoc(historyRef, {
                      userId: selectedUser.id,
                      date: new Date().toISOString(),
                      action: 'Consultation de document',
                      details: `Document "${document.name}" consulté par ${currentUser.displayName || currentUser.email}`,
                      type: 'document'
                    });
                    // Rafraîchir l'historique
                    fetchUserHistory(selectedUser.id);
                  } catch (historyError) {
                    console.error('Erreur lors de l\'ajout du log dans l\'historique:', historyError);
                  }
                }
              } catch (decryptError: any) {
                console.error('Erreur déchiffrement:', decryptError);
                setViewerLoading(false);
                if (decryptError.response?.status === 403) {
                  const errorMsg = decryptError.response?.data?.error || 'Accès refusé';
                  if (errorMsg.includes('2FA')) {
                    setViewerError('Ce document est chiffré. Veuillez activer l\'authentification à deux facteurs (2FA) pour y accéder.');
                  } else {
                    setViewerError('Accès refusé à ce document chiffré');
                  }
                } else {
                  setViewerError(`Erreur lors de l'ouverture du document: ${decryptError.message || 'Erreur inconnue'}`);
                }
              }
            }
          }
        } catch (error: any) {
          // Si la vérification échoue complètement, essayer decryptFile directement
          console.warn('Erreur lors de la vérification du chiffrement, tentative de déchiffrement:', error);
          setViewerLoading(true);
          setViewerError(null);
          try {
            const response = await axios.get(
              `https://us-central1-jsaas-dd2f7.cloudfunctions.net/decryptFile`,
              {
                params: { filePath: path },
                headers: {
                  'Authorization': `Bearer ${token}`
                },
                responseType: 'blob'
              }
            );
            
            const blob = new Blob([response.data]);
            const url = URL.createObjectURL(blob);
            setViewerUrl(url);
            setCurrentViewingDocument(document);
            setViewerOpen(true);
            setViewerLoading(false);
            
            // Ajouter un log dans l'historique
            if (selectedUser && currentUser) {
              try {
                const historyRef = collection(db, 'history');
                await addDoc(historyRef, {
                  userId: selectedUser.id,
                  date: new Date().toISOString(),
                  action: 'Consultation de document',
                  details: `Document "${document.name}" consulté par ${currentUser.displayName || currentUser.email}`,
                  type: 'document'
                });
                // Rafraîchir l'historique
                fetchUserHistory(selectedUser.id);
              } catch (historyError) {
                console.error('Erreur lors de l\'ajout du log dans l\'historique:', historyError);
              }
            }
          } catch (decryptError: any) {
            console.error('Erreur déchiffrement:', decryptError);
            setViewerLoading(false);
            if (decryptError.response?.status === 403) {
              const errorMsg = decryptError.response?.data?.error || 'Accès refusé';
              if (errorMsg.includes('2FA')) {
                setViewerError('Ce document est chiffré. Veuillez activer l\'authentification à deux facteurs (2FA) pour y accéder.');
              } else {
                setViewerError('Accès refusé à ce document chiffré');
              }
            } else if (decryptError.response?.status === 404) {
              // Le fichier n'existe pas ou n'est pas chiffré, essayer le téléchargement direct
              try {
                const storage = getStorage();
                const fileRef = ref(storage, path);
                const url = await getDownloadURL(fileRef);
                setViewerUrl(url);
                setCurrentViewingDocument(document);
                setViewerOpen(true);
                setViewerLoading(false);
                
                // Ajouter un log dans l'historique
                if (selectedUser && currentUser) {
                  try {
                    const historyRef = collection(db, 'history');
                    await addDoc(historyRef, {
                      userId: selectedUser.id,
                      date: new Date().toISOString(),
                      action: 'Consultation de document',
                      details: `Document "${document.name}" consulté par ${currentUser.displayName || currentUser.email}`,
                      type: 'document'
                    });
                    // Rafraîchir l'historique
                    fetchUserHistory(selectedUser.id);
                  } catch (historyError) {
                    console.error('Erreur lors de l\'ajout du log dans l\'historique:', historyError);
                  }
                }
              } catch (downloadError: any) {
                setViewerError('Erreur lors de l\'ouverture du document');
              }
            } else {
              setViewerError(`Erreur lors de l'ouverture du document: ${decryptError.message || 'Erreur inconnue'}`);
            }
          }
        }
      }
    } catch (error: any) {
      console.error(`Erreur lors de l'ouverture du document:`, error);
      setViewerError(`Erreur lors de l'ouverture du document`);
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

  // Fonction pour remplacer les balises par leurs valeurs
  const replaceTags = async (text: string, structureData?: any, userDataOverride?: UserDetails): Promise<string> => {
    if (!text || !selectedUser) return text;

    try {
      // Utiliser les données passées en paramètre si disponibles, sinon getDisplayUser()
      // Cela permet de garantir l'utilisation des données décryptées même si l'état React n'est pas encore synchronisé
      const userData = userDataOverride || getDisplayUser();
      
      // Récupérer les données de la structure si nécessaire
      let structureInfo = structureData;
      const structureId = currentUser?.structureId;
      if (!structureInfo && structureId) {
        try {
          const structureDoc = await getDoc(doc(db, 'structures', structureId));
          if (structureDoc.exists()) {
            structureInfo = structureDoc.data();
          }
        } catch (error) {
          console.error('Erreur lors de la récupération de la structure:', error);
        }
      }

      // Récupérer le président du mandat le plus récent
      let presidentFullName = '[Président non disponible]';
      if (structureId) {
        try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('structureId', '==', structureId));
          const usersSnapshot = await getDocs(q);
          
          const members = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            mandat: doc.data().mandat || null,
            bureauRole: doc.data().bureauRole || null,
            poles: doc.data().poles || [],
            firstName: doc.data().firstName || '',
            lastName: doc.data().lastName || '',
            displayName: doc.data().displayName || ''
          }));

          // Filtrer les présidents (via bureauRole ou pôle 'pre')
          const presidents = members.filter(member => {
            const hasPresidentRole = member.bureauRole === 'president' || 
              member.poles?.some((p: any) => p.poleId === 'pre');
            return hasPresidentRole && member.mandat;
          });

          if (presidents.length > 0) {
            // Trier les mandats pour trouver le plus récent
            const sortedPresidents = presidents.sort((a, b) => {
              if (!a.mandat || !b.mandat) return 0;
              // Comparer les années de début des mandats (format: "2024-2025")
              const aYear = parseInt(a.mandat.split('-')[0]);
              const bYear = parseInt(b.mandat.split('-')[0]);
              return bYear - aYear; // Plus récent en premier
            });

            const mostRecentPresident = sortedPresidents[0];
            // Construire le nom complet : prénom + nom ou displayName
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

      const replacements: { [key: string]: string } = {
        // Balises utilisateur/étudiant - utiliser userData (qui contient les données décryptées si disponibles)
        '<user_nom>': userData.lastName || '[Nom non disponible]',
        '<user_prenom>': userData.firstName || '[Prénom non disponible]',
        '<user_email>': userData.email || '[Email non disponible]',
        '<user_ecole>': userData.ecole || '[École non disponible]',
        '<user_nom_complet>': `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || '[Nom complet non disponible]',
        '<user_telephone>': userData.phone || '[Téléphone non disponible]',
        '<user_numero_securite_sociale>': userData.socialSecurityNumber || '[Numéro de sécurité sociale non disponible]',
        '<user_numero_etudiant>': userData.studentId || '[Numéro étudiant non disponible]',
        '<user_adresse>': userData.address || '[Adresse non disponible]',
        '<user_ville>': userData.city || '[Ville non disponible]',
        '<user_code_postal>': userData.postalCode || '[Code postal non disponible]',
        '<user_pays>': userData.country || '[Pays non disponible]',
        '<user_formation>': userData.formation || '[Formation non disponible]',
        '<user_programme>': userData.program || '[Programme non disponible]',
        '<user_annee_diplome>': userData.graduationYear || '[Année de diplômation non disponible]',
        '<user_nationalite>': userData.nationality || '[Nationalité non disponible]',
        '<user_genre>': userData.gender || '[Genre non disponible]',
        '<user_lieu_naissance>': userData.birthPlace || '[Lieu de naissance non disponible]',
        '<user_date_naissance>': userData.birthDate || '[Date de naissance non disponible]',
        
        // Balises système
        '<generationDate>': new Date().toLocaleDateString('fr-FR'),
        '<mission_date_generation>': new Date().toLocaleDateString('fr-FR'),
        '<mission_date_generation_plus_1_an>': (() => {
          const today = new Date();
          const oneYearLater = new Date(today);
          oneYearLater.setDate(today.getDate() + 365);
          return oneYearLater.toLocaleDateString('fr-FR');
        })(),
        
        // Balises de la structure
        '<structure_nom>': structureInfo?.nom || '[Nom de la structure non disponible]',
        '<structure_siret>': structureInfo?.siret || '[SIRET de la structure non disponible]',
        '<structure_adresse>': structureInfo?.address || '[Adresse de la structure non disponible]',
        '<structure_ville>': structureInfo?.city || '[Ville de la structure non disponible]',
        '<structure_code_postal>': structureInfo?.postalCode || '[Code postal de la structure non disponible]',
        '<structure_pays>': structureInfo?.country || '[Pays de la structure non disponible]',
        '<structure_telephone>': structureInfo?.phone || '[Téléphone de la structure non disponible]',
        '<structure_email>': structureInfo?.email || '[Email de la structure non disponible]',
        '<structure_site_web>': structureInfo?.website || '[Site web de la structure non disponible]',
        '<structure_president_nom_complet>': presidentFullName,
      };

      let result = text;
      Object.entries(replacements).forEach(([tag, value]) => {
        const regex = new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        result = result.replace(regex, value);
      });

      // Vérifier s'il reste des balises non remplacées
      const remainingTags = result.match(/<[^>]+>/g);
      if (remainingTags) {
        remainingTags.forEach(tag => {
          const tagName = tag.replace(/[<>]/g, '');
          result = result.replace(tag, `[Information "${tagName}" non disponible]`);
          console.warn(`[replaceTags] Balise inconnue non remplacée : ${tag}`);
        });
      }

      return result;
    } catch (error) {
      console.error('Erreur lors du remplacement des balises:', error);
      return text;
    }
  };

  // Fonction interne pour générer la convention (sans vérification de décryptage)
  // Accepte un paramètre optionnel avec les données utilisateur décryptées pour garantir leur utilisation
  const doGenerateConvention = async (decryptedUserDataOverride?: UserDetails) => {
    if (!conventionTemplate || !selectedUser) {
      console.error('[doGenerateConvention] Template ou utilisateur manquant:', { conventionTemplate, selectedUser: !!selectedUser });
      setIsGeneratingConvention(false);
      isGeneratingConventionRef.current = false;
      return;
    }
    
    // S'assurer que le template est bien récupéré depuis TemplateAssignment
    if (!conventionTemplate && userStructureId) {
      console.log('[doGenerateConvention] Template non chargé, chargement...');
      await fetchConventionTemplate(userStructureId);
      // Attendre un peu pour que l'état soit mis à jour
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (!conventionTemplate) {
        console.error('[doGenerateConvention] Aucun template trouvé après chargement');
        setIsGeneratingConvention(false);
        isGeneratingConventionRef.current = false;
        setSnackbar({
          open: true,
          message: 'Aucun template de convention étudiante n\'est assigné. Veuillez assigner un template dans les paramètres.',
          severity: 'error'
        });
        return;
      }
    }
    
    // Utiliser les données décryptées passées en paramètre, ou celles de l'état
    // Cela garantit qu'on utilise toujours les données décryptées même si l'état React n'est pas encore synchronisé
    const userDataToUse = decryptedUserDataOverride || decryptedUserData || selectedUser;
    console.log('[doGenerateConvention] Utilisation des données:', {
      hasOverride: !!decryptedUserDataOverride,
      hasDecryptedData: !!decryptedUserData,
      hasSelectedUser: !!selectedUser,
      userDataId: userDataToUse?.id
    });
    
    console.log('[doGenerateConvention] Début de la génération de la convention');
    console.log('[doGenerateConvention] Données décryptées disponibles:', !!decryptedUserData);
    console.log('[doGenerateConvention] Utilisateur sélectionné:', selectedUser.id);
    
    try {
      // Récupérer le template depuis Firestore
      const templateRef = doc(db, 'templates', conventionTemplate);
      const templateDoc = await getDoc(templateRef);
      
      if (!templateDoc.exists()) {
        throw new Error('Template non trouvé');
      }

      const templateData = templateDoc.data() as Template;
      console.log('[doGenerateConvention] Template récupéré:', {
        id: templateDoc.id,
        name: templateData.name,
        hasPdfUrl: !!templateData.pdfUrl,
        variablesCount: templateData.variables?.length || 0
      });
      
      let pdfUrl = templateData.pdfUrl;

      if (!pdfUrl) {
        throw new Error('URL du PDF non trouvée dans le template');
      }
      
      // Si pdfUrl est un chemin Storage, obtenir l'URL de téléchargement
      if (pdfUrl && !pdfUrl.startsWith('http')) {
        console.log('[doGenerateConvention] pdfUrl est un chemin Storage, obtention de l\'URL de téléchargement...');
        try {
          const storage = getStorage();
          const storageRef = ref(storage, pdfUrl);
          pdfUrl = await getDownloadURL(storageRef);
          console.log('[doGenerateConvention] URL de téléchargement obtenue');
        } catch (storageError: any) {
          console.error('[doGenerateConvention] Erreur lors de l\'obtention de l\'URL Storage:', storageError);
          throw new Error('Impossible d\'accéder au fichier PDF du template');
        }
      }

      console.log('[doGenerateConvention] Téléchargement du PDF depuis:', pdfUrl);
      // Télécharger le fichier
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        console.error('[doGenerateConvention] Erreur HTTP lors du téléchargement:', response.status, response.statusText);
        throw new Error(`Erreur lors du téléchargement du PDF: ${response.status} ${response.statusText}`);
      }
      
      const pdfBlob = await response.blob();
      console.log('[doGenerateConvention] PDF téléchargé, taille:', pdfBlob.size, 'bytes');
      
      // Créer un nouveau PDF avec les variables remplacées
      const pdfDoc = await PDFLib.PDFDocument.load(await pdfBlob.arrayBuffer());
      const pages = pdfDoc.getPages();
      
      // Remplacer les variables sur chaque page (même méthode que MissionDetails.tsx et EntrepriseDetail.tsx)
      const helveticaFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
      const helveticaFontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      
      for (const variable of templateData.variables) {
        if (variable.position.page > pages.length) continue;
        
        const page = pages[variable.position.page - 1];
        const pageHeight = page.getHeight();
        
        try {
          // Obtenir la valeur de la variable
          let valueToReplace = '';
          if (variable.type === 'raw') {
            valueToReplace = variable.rawText || '';
          } else if (variable.variableId) {
            // Utiliser variableId pour obtenir la balise
            valueToReplace = getTagFromVariableId(variable.variableId);
          } else if (variable.fieldId) {
            // Fallback sur fieldId pour compatibilité
            const tag = getTagFromVariableId(variable.fieldId);
            valueToReplace = tag || `<${variable.fieldId}>`;
          }
          
          // Utiliser replaceTags pour remplacer les balises par leurs valeurs
          // Passer explicitement les données décryptées pour garantir leur utilisation
          const value = await replaceTags(valueToReplace, undefined, userDataToUse);
          
          if (value && value.trim()) {
            // Appliquer les styles et la position (identique à MissionDetails.tsx)
            const fontSize = variable.fontSize || 12;
            const font = variable.isBold ? helveticaFontBold : helveticaFont;
            const { x, y } = variable.position;
            const { width, height } = variable;
            const textAlign = variable.textAlign || 'left';
            const verticalAlign = variable.verticalAlign || 'top';
            
            // Calculer la position Y en fonction de l'alignement vertical (identique à MissionDetails.tsx)
            let yPos = pageHeight - y;
            const textHeight = font.heightAtSize(fontSize);
            if (verticalAlign === 'middle') {
              yPos = pageHeight - y - (height / 2) + (fontSize * -0.25);
            } else if (verticalAlign === 'bottom') {
              yPos = pageHeight - (y + height) + fontSize * 0.8;
            }
            
            // Fonction pour nettoyer le texte
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
            
            // Découper le texte en lignes selon la largeur max
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
            
            const cleanedValue = cleanTextForPDF(value);
            const lines = splitTextToLines(cleanedValue.trim(), font, fontSize, width);
            let lineY = yPos;
            const lineHeight = fontSize * 1.2;
            
            // Dessiner chaque ligne
            for (let i = 0; i < lines.length; i++) {
              const line = cleanTextForPDF(lines[i]);
              let xLine = x;
              const lineWidth = font.widthOfTextAtSize(line, fontSize);
              
              // Calculer la position X en fonction de l'alignement horizontal
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
                // Si l'erreur persiste, essayer avec un texte encore plus nettoyé
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
          console.error(`Erreur lors du traitement de la variable ${variable.name || variable.variableId}:`, err);
        }
      }
      
      // Générer le PDF final
      console.log('[doGenerateConvention] Génération du PDF final...');
      const modifiedPdfBytes = await pdfDoc.save();
      // pdfDoc.save() retourne un Uint8Array, créer un nouveau ArrayBuffer pour le Blob
      const arrayBuffer = new ArrayBuffer(modifiedPdfBytes.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      uint8Array.set(modifiedPdfBytes);
      // Utiliser une assertion de type pour résoudre le problème de compatibilité TypeScript
      const modifiedBlob = new Blob([arrayBuffer as ArrayBuffer], { type: 'application/pdf' });
      
      console.log('[doGenerateConvention] PDF généré, taille:', modifiedBlob.size, 'bytes');
      
      // Créer un lien de téléchargement avec un mécanisme plus fiable
      // Utiliser les données décryptées pour le nom du fichier
      const userDisplay = userDataToUse;
      const fileName = `Convention_${userDisplay.firstName || 'Utilisateur'}_${userDisplay.lastName || 'Inconnu'}.pdf`;
      console.log('[doGenerateConvention] Téléchargement du fichier:', fileName);
      
      // Créer un blob URL
      const downloadUrl = window.URL.createObjectURL(modifiedBlob);
      
      // Méthode 1: Essayer avec un élément <a> (méthode standard)
      try {
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        link.style.display = 'none';
        
        // Ajouter au DOM
        document.body.appendChild(link);
        
        // Déclencher le téléchargement
        link.click();
        
        // Attendre un peu avant de retirer le lien pour s'assurer que le téléchargement démarre
        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
          window.URL.revokeObjectURL(downloadUrl);
        }, 500);
        
        console.log('[doGenerateConvention] Téléchargement déclenché via élément <a>');
      } catch (error) {
        console.error('[doGenerateConvention] Erreur lors du téléchargement via <a>:', error);
        
        // Méthode 2: Fallback avec window.open (pour certains navigateurs)
        try {
          const newWindow = window.open(downloadUrl, '_blank');
          if (newWindow) {
            console.log('[doGenerateConvention] Téléchargement déclenché via window.open');
            // Nettoyer après un délai
            setTimeout(() => {
              window.URL.revokeObjectURL(downloadUrl);
            }, 1000);
          } else {
            throw new Error('Impossible d\'ouvrir une nouvelle fenêtre');
          }
        } catch (fallbackError) {
          console.error('[doGenerateConvention] Erreur lors du téléchargement via window.open:', fallbackError);
          // Méthode 3: Télécharger via l'API fetch (dernier recours)
          try {
            const response = await fetch(downloadUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            window.URL.revokeObjectURL(downloadUrl);
            console.log('[doGenerateConvention] Téléchargement déclenché via fetch fallback');
          } catch (finalError) {
            console.error('[doGenerateConvention] Toutes les méthodes de téléchargement ont échoué:', finalError);
            throw new Error('Impossible de télécharger le fichier. Veuillez réessayer.');
          }
        }
      }

      setSnackbar({
        open: true,
        message: 'Convention générée et téléchargée avec succès',
        severity: 'success'
      });
      
      console.log('[doGenerateConvention] Convention générée avec succès');
    } catch (error: any) {
      console.error('[doGenerateConvention] Erreur lors de la génération de la convention:', error);
      console.error('[doGenerateConvention] Détails de l\'erreur:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        conventionTemplate,
        selectedUser: selectedUser?.id,
        hasDecryptedData: !!decryptedUserData
      });
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Erreur lors de la génération de la convention',
        severity: 'error'
      });
    } finally {
      setIsGeneratingConvention(false);
      isGeneratingConventionRef.current = false;
      console.log('[doGenerateConvention] Génération terminée (succès ou échec)');
    }
  };

  // Fonction publique pour générer la convention (avec vérification de décryptage)
  const generateConvention = async () => {
    if (!selectedUser || isGeneratingConvention) {
      console.warn('[generateConvention] Utilisateur non sélectionné ou génération en cours');
      return;
    }
    
    // Vérifier que le template est chargé, sinon le charger
    if (!conventionTemplate && userStructureId) {
      console.log('[generateConvention] Template non chargé, chargement...');
      await fetchConventionTemplate(userStructureId);
      // Attendre un peu pour que l'état soit mis à jour
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Vérifier à nouveau après le chargement
      if (!conventionTemplate) {
        // Essayer une dernière fois avec un délai plus long
        await new Promise(resolve => setTimeout(resolve, 200));
        if (!conventionTemplate) {
          setSnackbar({
            open: true,
            message: 'Aucun template de convention étudiante n\'est assigné. Veuillez assigner un template dans les paramètres.',
            severity: 'error'
          });
          setIsGeneratingConvention(false);
          isGeneratingConventionRef.current = false;
          return;
        }
      }
    }
    
    if (!conventionTemplate) {
      setSnackbar({
        open: true,
        message: 'Aucun template de convention étudiante n\'est assigné. Veuillez assigner un template dans les paramètres.',
        severity: 'error'
      });
      setIsGeneratingConvention(false);
      isGeneratingConventionRef.current = false;
      return;
    }
    
    console.log('[generateConvention] Début de la génération, template:', conventionTemplate);
    console.log('[generateConvention] État actuel:', {
      hasDecryptedData: !!decryptedUserData,
      canDecrypt: canDecryptData(),
      isGeneratingConvention
    });
    
    // Définir isGeneratingConvention AVANT toute autre opération
    setIsGeneratingConvention(true);
    isGeneratingConventionRef.current = true;
    
    // Si les données ne sont pas décryptées mais que l'utilisateur a les accès, décrypter automatiquement
    if (!decryptedUserData && canDecryptData()) {
      console.log('[generateConvention] Données non décryptées, démarrage du décryptage...');
      try {
        const deviceIsSecure = await isCurrentDeviceSecure();
        console.log('[generateConvention] Appareil sécurisé:', deviceIsSecure);
        
        if (deviceIsSecure) {
          try {
            console.log('[generateConvention] Appel de handleDecryptData (appareil sécurisé)...');
            // Attendre un peu pour que setIsGeneratingConvention(true) soit appliqué
            await new Promise(resolve => setTimeout(resolve, 150));
            console.log('[generateConvention] isGeneratingConvention après délai:', isGeneratingConvention);
            
            // Passer explicitement que c'est pour la génération
            // handleDecryptData va vérifier isGeneratingConvention et appeler doGenerateConvention
            await handleDecryptData();
            // Ne pas retourner ici, handleDecryptData va gérer l'appel à doGenerateConvention
            // Mais attendre un peu pour voir si handleDecryptData a bien été appelé
            console.log('[generateConvention] handleDecryptData appelé, attente de la génération...');
            return;
          } catch (decryptError: any) {
            console.error('[generateConvention] Erreur lors du décryptage automatique:', decryptError);
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
          // Si l'appareil n'est pas sécurisé, ouvrir le dialog 2FA
          console.log('[generateConvention] Appareil non sécurisé, ouverture du dialog 2FA...');
          // Le décryptage via 2FA appellera automatiquement doGenerateConvention
          setTwoFactorDialogOpen(true);
          setSnackbar({
            open: true,
            message: 'Veuillez entrer votre code 2FA pour décrypter les données',
            severity: 'info'
          });
          // Ne pas retourner ici, laisser le dialog 2FA gérer le décryptage et la génération
          return;
        }
      } catch (error: any) {
        console.error('[generateConvention] Erreur lors de la vérification de sécurité:', error);
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
    
    // Si les données sont déjà décryptées ou si l'utilisateur n'a pas besoin de décryptage, générer directement
    console.log('[generateConvention] Données déjà décryptées ou pas besoin de décryptage, génération directe...');
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

    // Si l'utilisateur a accès au décryptage, décrypter les données avant d'ouvrir le modal
    if (hasDecryptionAccess) {
      try {
        // Vérifier si l'appareil est sécurisé
        const isSecure = await isCurrentDeviceSecure();
        
        if (isSecure) {
          // Appareil sécurisé, décrypter directement
          try {
            const functions = getFunctions();
            const decryptUserData = httpsCallable(functions, 'decryptUserData');
            const deviceId = getDeviceId();
            
            const result = await decryptUserData({ 
              userId: selectedUser.id,
              deviceId: deviceId || undefined,
              twoFactorCode: undefined
            });
            
            if (result.data && (result.data as any).success && (result.data as any).decryptedData) {
              const decryptedData = (result.data as any).decryptedData;
              // Fusionner les données décryptées avec les données de l'utilisateur sélectionné
              // Les valeurs décryptées remplacent les valeurs cryptées
              const mergedData: UserDetails = {
                ...selectedUser,
                ...decryptedData
              };
              // S'assurer que toutes les valeurs cryptées sont remplacées par les valeurs décryptées
              // En parcourant tous les champs sensibles
              const sensitiveFields: (keyof UserDetails)[] = [
                'firstName', 'lastName', 'birthDate', 'birthPlace', 'birthPostalCode',
                'gender', 'nationality', 'email', 'phone', 'address',
                'studentId', 'graduationYear', 'socialSecurityNumber'
              ];
              
              sensitiveFields.forEach((field: keyof UserDetails) => {
                if (decryptedData[field] && !isEncrypted(decryptedData[field])) {
                  (mergedData as any)[field] = decryptedData[field];
                }
              });
              
              setDecryptedUserData(mergedData);
              setEditedUser({ ...mergedData });
              setEditModalOpen(true);
            } else {
              // Si le décryptage échoue, utiliser les données originales
              setEditedUser({ ...selectedUser });
              setEditModalOpen(true);
            }
          } catch (decryptError) {
            console.error('Erreur lors du décryptage pour modification:', decryptError);
            // En cas d'erreur, ouvrir le modal avec les données non décryptées
            setEditedUser({ ...selectedUser });
            setEditModalOpen(true);
          }
        } else {
          // Appareil non sécurisé, demander le code 2FA
          // Stocker l'intention d'ouvrir le modal après décryptage
          setPendingEditAfterDecrypt(true);
          setTwoFactorDialogOpen(true);
          // Le modal d'édition sera ouvert après la vérification 2FA via useEffect
        }
      } catch (error) {
        console.error('Erreur lors du décryptage pour modification:', error);
        // En cas d'erreur, ouvrir le modal avec les données non décryptées
        setEditedUser({ ...selectedUser });
        setEditModalOpen(true);
      }
    } else {
      // Pas d'accès au décryptage, utiliser les données telles quelles
      setEditedUser({ ...selectedUser });
      setEditModalOpen(true);
    }
  };

  // Fonction pour vérifier si l'utilisateur peut modifier les profils
  const canEditUser = () => {
    // Utiliser directement le statut actuel de l'utilisateur
    // Inclure aussi les personnes qui ont accès au décryptage (hasDecryptionAccess)
    const canEdit = currentUserStatus === 'Admin' || 
                   currentUserStatus === 'Superadmin' || 
                   currentUserStatus === 'superadmin' || // Variante minuscule
                   isHRMember || // Vérifier aussi les membres RH
                   hasDecryptionAccess || // Personnes ayant accès au décryptage
                   (currentUser && currentUser.email?.includes('admin')); // Fallback pour les admins
    
    console.log("Permissions d'édition:", { 
      currentUserStatus,
      isAdmin, 
      isHRMember, 
      isSuperAdmin,
      hasDecryptionAccess,
      canEdit,
      currentUserEmail: currentUser?.email
    });
    return canEdit;
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setEditedUser(null);
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
      updateData.address = cleanValue(editedUser.address);
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

  // Fonction pour vérifier si l'utilisateur peut décrypter les données
  const canDecryptData = (): boolean => {
    return hasDecryptionAccess && hasTwoFactor && selectedUser !== null;
  };

  // Fonction pour obtenir le message d'erreur de déchiffrement
  const getDecryptionErrorMessage = (): string | null => {
    if (!selectedUser) {
      return 'Aucun utilisateur sélectionné';
    }
    
    if (!hasDecryptionAccess) {
      return 'Vous n\'avez pas les permissions nécessaires pour déchiffrer les données. Seuls les administrateurs, super-administrateurs et les membres du pôle RH peuvent déchiffrer les données.';
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

    setIsDecrypting(true);
    try {
      console.log('[handleDecryptData] Appel de la Cloud Function decryptUserData...');
      const functions = getFunctions();
      const decryptUserData = httpsCallable(functions, 'decryptUserData');
      
      // Récupérer le deviceId de l'appareil actuel
      const deviceId = getDeviceId();
      
      // Envoyer le deviceId et le code 2FA (optionnel si appareil sécurisé)
      const result = await decryptUserData({ 
        userId: selectedUser.id,
        deviceId: deviceId || undefined,
        twoFactorCode: twoFactorCode || undefined
      });
      
      if (result.data && (result.data as any).success && (result.data as any).decryptedData) {
        const decryptedData = (result.data as any).decryptedData;
        // Fusionner les données décryptées avec les données de l'utilisateur sélectionné
        const mergedData = {
          ...selectedUser,
          ...decryptedData
        };
        
        // S'assurer que toutes les valeurs cryptées sont remplacées par les valeurs décryptées
        const sensitiveFields: (keyof UserDetails)[] = [
          'firstName', 'lastName', 'birthDate', 'birthPlace', 'birthPostalCode',
          'gender', 'nationality', 'email', 'phone', 'address',
          'studentId', 'graduationYear', 'socialSecurityNumber'
        ];
        
        sensitiveFields.forEach((field: keyof UserDetails) => {
          if (decryptedData[field] && !isEncrypted(decryptedData[field])) {
            (mergedData as any)[field] = decryptedData[field];
          }
        });
        
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
        
        // Si on était en train de générer la convention, continuer la génération
        // Utiliser la ref pour éviter les problèmes de closure
        const shouldGenerate = isGeneratingConventionRef.current;
        console.log('[handleDecryptData] Vérification de isGeneratingConvention:', isGeneratingConvention, 'ref:', shouldGenerate);
        
        if (shouldGenerate || isGeneratingConvention) {
          console.log('[handleDecryptData] ✅ Génération de convention en attente, données décryptées disponibles');
          console.log('[handleDecryptData] mergedData disponible:', !!mergedData, 'selectedUser.id:', selectedUser.id);
          
          // Ne pas afficher le message de succès si on génère la convention (on affichera un message après)
          // Attendre un peu pour que l'état React soit synchronisé, puis générer
          setTimeout(async () => {
            try {
              console.log('[handleDecryptData] ⏳ Début du setTimeout pour doGenerateConvention...');
              console.log('[handleDecryptData] État avant génération:', {
                isGeneratingConvention,
                isGeneratingConventionRef: isGeneratingConventionRef.current,
                hasMergedData: !!mergedData,
                mergedDataId: mergedData?.id,
                selectedUserId: selectedUser.id,
                conventionTemplate
              });
              
              // Vérifier que les données sont bien décryptées avant de générer
              // Utiliser mergedData directement car decryptedUserData peut ne pas être encore mis à jour
              if (mergedData && mergedData.id === selectedUser.id) {
                console.log('[handleDecryptData] ✅ Données valides, attente de la synchronisation React...');
                // Les données sont déjà mises à jour via setDecryptedUserData(mergedData) plus haut
                // Attendre un tick pour que l'état React soit synchronisé
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Vérifier que le template est toujours disponible
                if (!conventionTemplate && userStructureId) {
                  console.log('[handleDecryptData] Template non chargé, rechargement...');
                  await fetchConventionTemplate(userStructureId);
                  await new Promise(resolve => setTimeout(resolve, 200));
                }
                
                if (!conventionTemplate) {
                  throw new Error('Aucun template de convention étudiante n\'est assigné. Veuillez assigner un template dans les paramètres.');
                }
                
                console.log('[handleDecryptData] 🚀 Appel de doGenerateConvention avec template:', conventionTemplate);
                console.log('[handleDecryptData] Passage des données décryptées explicitement:', {
                  mergedDataId: mergedData.id,
                  mergedDataFirstName: mergedData.firstName,
                  mergedDataLastName: mergedData.lastName
                });
                // Maintenant générer la convention en passant explicitement les données décryptées
                // Cela garantit que les balises seront remplacées avec les données décryptées
                await doGenerateConvention(mergedData);
                console.log('[handleDecryptData] ✅ doGenerateConvention terminé');
              } else {
                console.error('[handleDecryptData] ❌ Les données décryptées ne sont pas disponibles pour la génération', {
                  hasMergedData: !!mergedData,
                  mergedDataId: mergedData?.id,
                  selectedUserId: selectedUser.id
                });
                setIsGeneratingConvention(false);
                isGeneratingConventionRef.current = false;
                setSnackbar({
                  open: true,
                  message: 'Erreur : les données décryptées ne sont pas disponibles',
                  severity: 'error'
                });
              }
            } catch (error: any) {
              console.error('[handleDecryptData] ❌ Erreur lors de la génération de la convention après décryptage:', error);
              console.error('[handleDecryptData] Détails de l\'erreur:', {
                message: error?.message,
                stack: error?.stack,
                name: error?.name
              });
              setIsGeneratingConvention(false);
              isGeneratingConventionRef.current = false;
              setSnackbar({
                open: true,
                message: error?.message || 'Erreur lors de la génération de la convention',
                severity: 'error'
              });
            }
          }, 300); // Augmenté le délai pour laisser plus de temps à React
        } else {
          console.log('[handleDecryptData] Pas de génération en cours, affichage du message de succès');
          // Si on ne génère pas de convention, afficher le message de succès
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
      throw new Error(error.message || 'Erreur lors du décryptage des données');
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
      
      // Vérifier si l'appareil est sécurisé
      const deviceIsSecure = await isCurrentDeviceSecure();
      
      if (deviceIsSecure) {
        // Décrypter automatiquement sans demander le code 2FA
        try {
          await handleDecryptData();
        } catch (error: any) {
          // Si le décryptage automatique échoue (par exemple si l'appareil n'est plus sécurisé),
          // demander le code 2FA
          console.warn('Décryptage automatique échoué, demande du code 2FA:', error);
          const errorMsg = error?.response?.data?.error || error?.message || 'Erreur inconnue lors du décryptage';
          setSnackbar({
            open: true,
            message: `Erreur lors du décryptage: ${errorMsg}`,
            severity: 'error'
          });
        }
      } else {
        // Ouvrir le dialog 2FA
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
          
          const unsubscribe = onSnapshot(q, (snapshot) => {
            const onlineUserIds = snapshot.docs.map(doc => doc.data().userId);
            setOnlineUsers(onlineUserIds);
            
            // Mettre à jour le statut en ligne des utilisateurs dans l'état local
            setUsers(prevUsers => 
              prevUsers.map(user => ({
                ...user,
                isOnline: onlineUserIds.includes(user.id)
              }))
            );
          });

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

  return (
    <Box sx={{ 
      width: '100%',
      height: '100vh',
      bgcolor: '#f5f5f7',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <Box sx={{ 
        display: 'flex', 
        gap: 2,
        flex: 1,
        overflow: 'hidden',
        p: 2
      }}>
        {/* Liste des membres - Style Apple */}
        <Paper 
          elevation={0}
          sx={{ 
            width: '380px',
            borderRadius: '20px',
            overflow: 'hidden',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#ffffff',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
          }}
        >
          <Box sx={{ 
            p: 3, 
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)', 
            flexShrink: 0,
            bgcolor: '#fafafa'
          }}>
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
                    <SearchIcon sx={{ color: '#86868b', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  fontSize: '0.875rem',
                  bgcolor: '#f5f5f7',
                  border: 'none',
                  '& fieldset': {
                    border: 'none'
                  },
                  '&:hover': {
                    bgcolor: '#e8e8ed'
                  },
                  '&.Mui-focused': {
                    bgcolor: '#ffffff',
                    boxShadow: '0 0 0 4px rgba(0, 122, 255, 0.1)'
                  }
                },
                '& .MuiOutlinedInput-input': {
                  py: 1.5,
                  fontSize: '0.875rem',
                  color: '#1d1d1f'
                }
              }}
            />
            
            {/* Filtres sur une même ligne avec sélection multiple */}
            <Box sx={{ 
              display: 'flex', 
              gap: 1.5, 
              mt: 2.5,
              flexWrap: 'nowrap',
              overflowX: 'auto',
              pb: 1,
              '&::-webkit-scrollbar': {
                display: 'none'
              }
            }}>
              {/* Filtre par statut */}
              <FormControl size="small" sx={{ minWidth: 100, flexShrink: 0 }}>
                <Select
                  multiple
                  value={statusFilters}
                  onChange={(e) => {
                    const value = e.target.value as string[];
                    if (value.includes('all')) {
                      setStatusFilters([]);
                    } else {
                      setStatusFilters(value);
                    }
                  }}
                  displayEmpty
                  renderValue={(selected) => {
                    if (selected.length === 0) return 'Statut';
                    if (selected.length === 1) {
                      const value = selected[0];
                      const label = getStatusLabel(value);
                      // Mettre au pluriel pour l'affichage
                      if (label === 'Étudiant') return 'Étudiants';
                      if (label === 'Membre') return 'Membres';
                      if (label === 'Administrateur') return 'Administrateurs';
                      if (label === 'Super administrateur') return 'Super administrateurs';
                      return label;
                    }
                    return `${selected.length} statuts`;
                  }}
                  sx={{ 
                    borderRadius: '10px',
                    fontSize: '0.75rem',
                    height: '36px',
                    backgroundColor: '#f5f5f7',
                    border: 'none',
                    '& .MuiSelect-select': {
                      py: 0.75,
                      color: '#1d1d1f',
                      fontWeight: 500
                    },
                    '&:hover': {
                      backgroundColor: '#e8e8ed'
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      border: 'none'
                    }
                  }}
                >
                  <MenuItem value="all">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={statusFilters.length === 0}
                        indeterminate={statusFilters.length > 0 && statusFilters.length < 3}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Tous les statuts" />
                  </MenuItem>
                  <MenuItem value="Étudiant">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={statusFilters.includes('Étudiant')}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Étudiants" />
                  </MenuItem>
                  <MenuItem value="Membre">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={statusFilters.includes('Membre')}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Membres" />
                  </MenuItem>
                  <MenuItem value="Admin">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={statusFilters.includes('Admin')}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Administrateurs" />
                  </MenuItem>
                </Select>
              </FormControl>
              
              {/* Filtre par complétion */}
              <FormControl size="small" sx={{ minWidth: 100, flexShrink: 0 }}>
                <Select
                  multiple
                  value={completionFilters}
                  onChange={(e) => {
                    const value = e.target.value as string[];
                    if (value.includes('all')) {
                      setCompletionFilters([]);
                    } else {
                      setCompletionFilters(value);
                    }
                  }}
                  displayEmpty
                  renderValue={(selected) => {
                    if (selected.length === 0) return 'Profil';
                    if (selected.length === 1) {
                      const value = selected[0];
                      switch(value) {
                        case 'complete': return 'Complétés';
                        case 'incomplete': return 'Incomplets';
                        default: return value;
                      }
                    }
                    return `${selected.length} profils`;
                  }}
                  sx={{ 
                    borderRadius: '10px',
                    fontSize: '0.75rem',
                    height: '36px',
                    backgroundColor: '#f5f5f7',
                    border: 'none',
                    '& .MuiSelect-select': {
                      py: 0.75,
                      color: '#1d1d1f',
                      fontWeight: 500
                    },
                    '&:hover': {
                      backgroundColor: '#e8e8ed'
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      border: 'none'
                    }
                  }}
                >
                  <MenuItem value="all">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={completionFilters.length === 0}
                        indeterminate={completionFilters.length > 0 && completionFilters.length < 2}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Tous les profils" />
                  </MenuItem>
                  <MenuItem value="complete">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={completionFilters.includes('complete')}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Complétés" />
                  </MenuItem>
                  <MenuItem value="incomplete">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={completionFilters.includes('incomplete')}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Incomplets" />
                  </MenuItem>
                </Select>
              </FormControl>
              
              {/* Filtre par validation */}
              <FormControl size="small" sx={{ minWidth: 100, flexShrink: 0 }}>
                <Select
                  multiple
                  value={validationFilters}
                  onChange={(e) => {
                    const value = e.target.value as string[];
                    if (value.includes('all')) {
                      setValidationFilters([]);
                    } else {
                      setValidationFilters(value);
                    }
                  }}
                  displayEmpty
                  renderValue={(selected) => {
                    if (selected.length === 0) return 'Dossier';
                    if (selected.length === 1) {
                      const value = selected[0];
                      switch(value) {
                        case 'validated': return 'Validés';
                        case 'notValidated': return 'Non validés';
                        default: return value;
                      }
                    }
                    return `${selected.length} dossiers`;
                  }}
                  sx={{ 
                    borderRadius: '10px',
                    fontSize: '0.75rem',
                    height: '36px',
                    backgroundColor: '#f5f5f7',
                    border: 'none',
                    '& .MuiSelect-select': {
                      py: 0.75,
                      color: '#1d1d1f',
                      fontWeight: 500
                    },
                    '&:hover': {
                      backgroundColor: '#e8e8ed'
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      border: 'none'
                    }
                  }}
                >
                  <MenuItem value="all">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={validationFilters.length === 0}
                        indeterminate={validationFilters.length > 0 && validationFilters.length < 2}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Tous les dossiers" />
                  </MenuItem>
                  <MenuItem value="validated">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={validationFilters.includes('validated')}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Validés" />
                  </MenuItem>
                  <MenuItem value="notValidated">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={validationFilters.includes('notValidated')}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Non validés" />
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>

          <List sx={{ 
            p: 0,
            flex: 1,
            overflowY: 'auto',
            minHeight: 0,
            pb: 2,
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
            {filteredUsers.map((user) => (
              <ListItem
                key={user.id}
                sx={{
                  borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
                  px: 3,
                  py: 2,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    backgroundColor: '#f5f5f7',
                    transform: 'translateX(4px)'
                  },
                  '&:active': {
                    backgroundColor: '#e8e8ed'
                  },
                  cursor: 'pointer'
                }}
                onClick={() => handleUserClick(user)}
              >
                <ListItemAvatar>
                  <Avatar 
                    src={user.photoURL}
                    sx={{ 
                      width: 48, 
                      height: 48,
                      bgcolor: user.photoURL ? 'transparent' : '#007AFF',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      border: '2px solid rgba(0, 0, 0, 0.04)'
                    }}
                  >
                    {!user.photoURL && `${user.firstName?.charAt(0)}${user.lastName?.charAt(0)}`}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                        <Typography 
                          variant="body1" 
                          component="span"
                          sx={{
                            color: isEncrypted(user.firstName) || isEncrypted(user.lastName) ? '#007AFF' : '#1d1d1f',
                            fontStyle: isEncrypted(user.firstName) || isEncrypted(user.lastName) ? 'italic' : 'normal',
                            fontWeight: 500,
                            fontSize: '0.9375rem',
                            letterSpacing: '-0.01em'
                          }}
                        >
                          {formatValue(user.firstName, 'firstName').display} {formatValue(user.lastName, 'lastName').display}
                        </Typography>
                        {(isEncrypted(user.firstName) || isEncrypted(user.lastName)) && (
                          <LockIcon sx={{ fontSize: 14, color: '#007AFF' }} />
                        )}
                      </Box>
                      <Chip 
                        label={getStatusLabel(user.status)} 
                        size="small"
                        sx={{ 
                          fontSize: '0.6875rem',
                          height: '22px',
                          fontWeight: 500,
                          bgcolor: getStatusColor(user.status) === 'primary' ? '#007AFF' : 
                                   getStatusColor(user.status) === 'success' ? '#34C759' :
                                   getStatusColor(user.status) === 'info' ? '#5AC8FA' : '#FF9500',
                          color: '#ffffff',
                          border: 'none'
                        }}
                      />
                    </Box>
                  }
                  secondary={
                    user.phone && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <Typography 
                          variant="body2" 
                          component="span"
                          sx={{
                            fontStyle: isEncrypted(user.phone) ? 'italic' : 'normal',
                            color: isEncrypted(user.phone) ? '#007AFF' : '#86868b',
                            fontSize: '0.8125rem'
                          }}
                        >
                          {formatValue(user.phone, 'phone').display}
                        </Typography>
                        {isEncrypted(user.phone) && (
                          <LockIcon sx={{ fontSize: 12, color: '#007AFF' }} />
                        )}
                      </Box>
                    )
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* Détails du membre - Style Apple */}
        <Paper 
          elevation={0}
          sx={{ 
            flex: 1,
            borderRadius: '20px',
            overflow: 'hidden',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#ffffff',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
          }}
        >
          {selectedUser ? (
            <>
              <Box sx={{ 
                p: 4, 
                borderBottom: '1px solid rgba(0, 0, 0, 0.06)', 
                flexShrink: 0,
                bgcolor: '#fafafa'
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Avatar 
                      src={getDisplayUser().photoURL}
                      sx={{ 
                        width: 72, 
                        height: 72,
                        bgcolor: getDisplayUser().photoURL ? 'transparent' : '#007AFF',
                        fontSize: '1.25rem',
                        fontWeight: 600,
                        border: '3px solid rgba(0, 0, 0, 0.04)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                      }}
                    >
                      {!getDisplayUser().photoURL && `${getDisplayUser().firstName?.charAt(0)}${getDisplayUser().lastName?.charAt(0)}`}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography 
                        variant="h5"
                        sx={{
                          fontWeight: 600,
                          fontSize: '1.5rem',
                          letterSpacing: '-0.02em',
                          color: '#1d1d1f'
                        }}
                      >
                        {`${getDisplayUser().firstName} ${getDisplayUser().lastName}`}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                        <Chip 
                          label={getStatusLabel(getDisplayUser().status)} 
                          size="small"
                          sx={{ 
                            fontWeight: 500,
                            fontSize: '0.75rem',
                            height: '24px',
                            bgcolor: getStatusColor(getDisplayUser().status) === 'primary' ? '#007AFF' : 
                                     getStatusColor(getDisplayUser().status) === 'success' ? '#34C759' :
                                     getStatusColor(getDisplayUser().status) === 'info' ? '#5AC8FA' : '#FF9500',
                            color: '#ffffff',
                            border: 'none'
                          }}
                        />
                        <Chip 
                          label={isProfileComplete(getDisplayUser()) ? 'Profil complété' : 'Profil incomplet'} 
                          size="small"
                          sx={{
                            fontWeight: 500,
                            fontSize: '0.75rem',
                            height: '24px',
                            bgcolor: isProfileComplete(getDisplayUser()) ? '#34C759' : '#FF9500',
                            color: '#ffffff',
                            border: 'none'
                          }}
                        />
                        {getDisplayUser().dossierValidated && (
                          <Chip 
                            label="Dossier validé" 
                            size="small"
                            sx={{
                              fontWeight: 500,
                              fontSize: '0.75rem',
                              height: '24px',
                              bgcolor: '#34C759',
                              color: '#ffffff',
                              border: 'none'
                            }}
                          />
                        )}
                      </Box>
                      {getDisplayUser().lastLogin && (
                        <Typography 
                          variant="body2" 
                          sx={{
                            color: '#86868b',
                            fontSize: '0.8125rem'
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
                      )}
                    </Box>
                  </Box>
                  <IconButton
                    onClick={(event) => setAnchorEl(event.currentTarget)}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5, mt: 3, alignItems: 'center' }}>
                  {(() => {
                    const errorMessage = getDecryptionErrorMessage();
                    const tooltipTitle = decryptedUserData 
                      ? "Données décryptées - Cliquez pour masquer" 
                      : errorMessage 
                        ? errorMessage 
                        : "Cliquez pour décrypter les données";
                    const buttonColor = decryptedUserData ? '#34C759' : (errorMessage ? '#FF3B30' : '#007AFF');
                    const hoverBgColor = decryptedUserData 
                      ? 'rgba(52, 199, 89, 0.1)' 
                      : (errorMessage ? 'rgba(255, 59, 48, 0.1)' : 'rgba(0, 122, 255, 0.1)');
                    
                    return (
                      <Tooltip title={tooltipTitle}>
                        <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          {isDecrypting && (
                            <CircularProgress
                              size={56}
                              sx={{
                                color: decryptedUserData ? '#34C759' : '#007AFF',
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
                          )}
                          <IconButton
                            onClick={handleLockButtonClick}
                            disabled={isDecrypting || !selectedUser}
                            sx={{ 
                              color: buttonColor,
                              border: `2px solid ${buttonColor}`,
                              borderRadius: '12px',
                              width: 44,
                              height: 44,
                              transition: 'all 0.2s ease',
                              position: 'relative',
                              zIndex: 1,
                              bgcolor: '#ffffff',
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
                          borderRadius: '12px',
                          px: 3,
                          py: 1.25,
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          textTransform: 'none',
                          bgcolor: '#007AFF',
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
                        borderRadius: '12px',
                        px: 3,
                        py: 1.25,
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        textTransform: 'none',
                        borderColor: '#FF3B30',
                        color: '#FF3B30',
                        '&:hover': {
                          borderColor: '#FF3B30',
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
                        borderRadius: '12px',
                        px: 3,
                        py: 1.25,
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        textTransform: 'none',
                        bgcolor: '#34C759',
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
                px: 4,
                bgcolor: '#fafafa'
              }}>
                <Tabs 
                  value={currentTab} 
                  onChange={handleTabChange}
                  variant="fullWidth"
                  sx={{
                    '& .MuiTab-root': {
                      textTransform: 'none',
                      fontSize: '0.9375rem',
                      fontWeight: 500,
                      color: '#86868b',
                      minHeight: 56,
                      letterSpacing: '-0.01em',
                      '&.Mui-selected': {
                        color: '#007AFF',
                        fontWeight: 600
                      }
                    },
                    '& .MuiTabs-indicator': {
                      height: 3,
                      borderRadius: '3px 3px 0 0',
                      bgcolor: '#007AFF'
                    }
                  }}
                >
                  <Tab label="Dossier" />
                  <Tab label="Documents" />
                  <Tab label="Missions" />
                  <Tab label="Historique" />
                </Tabs>
              </Box>

              <Box sx={{ 
                p: 4, 
                pb: 4, 
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
                {currentTab === 0 && (
                  <Box>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        mb: 2.5,
                        fontWeight: 600,
                        fontSize: '1.25rem',
                        letterSpacing: '-0.01em',
                        color: '#1d1d1f'
                      }}
                    >
                      Informations personnelles
                    </Typography>
                    <Box sx={{ 
                      display: 'grid', 
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                      gap: 2
                    }}>
                      {/* Colonne 1 - Informations d'identité */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box sx={{ 
                          p: 1.5,
                          borderRadius: '10px',
                          bgcolor: '#f5f5f7',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: '#e8e8ed'
                          }
                        }}>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              mb: 0.5,
                              display: 'block',
                              color: '#86868b',
                              fontSize: '0.6875rem',
                              fontWeight: 500,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            Prénom
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography 
                              variant="body2"
                              sx={{ 
                                color: isEncrypted(getDisplayUser()?.firstName) && !decryptedUserData ? '#007AFF' : '#1d1d1f',
                                fontWeight: isEncrypted(getDisplayUser()?.firstName) && !decryptedUserData ? 600 : 400,
                                fontStyle: isEncrypted(getDisplayUser()?.firstName) && !decryptedUserData ? 'italic' : 'normal',
                                fontSize: '0.875rem',
                                letterSpacing: '-0.01em'
                              }}
                            >
                              {formatValue(getDisplayUser()?.firstName, 'firstName').display}
                            </Typography>
                            {formatValue(getDisplayUser()?.firstName, 'firstName').isEncrypted && !decryptedUserData && (
                              <Tooltip title="Données cryptées et protégées">
                                <LockIcon sx={{ fontSize: 14, color: '#007AFF' }} />
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ 
                          p: 1.5,
                          borderRadius: '10px',
                          bgcolor: '#f5f5f7',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: '#e8e8ed'
                          }
                        }}>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              mb: 0.5,
                              display: 'block',
                              color: '#86868b',
                              fontSize: '0.6875rem',
                              fontWeight: 500,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            Nom
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography 
                              variant="body2"
                              sx={{ 
                                color: isEncrypted(getDisplayUser()?.lastName) && !decryptedUserData ? '#007AFF' : '#1d1d1f',
                                fontWeight: isEncrypted(getDisplayUser()?.lastName) && !decryptedUserData ? 600 : 400,
                                fontStyle: isEncrypted(getDisplayUser()?.lastName) && !decryptedUserData ? 'italic' : 'normal',
                                fontSize: '0.875rem',
                                letterSpacing: '-0.01em'
                              }}
                            >
                              {formatValue(getDisplayUser()?.lastName, 'lastName').display}
                            </Typography>
                            {formatValue(getDisplayUser()?.lastName, 'lastName').isEncrypted && !decryptedUserData && (
                              <Tooltip title="Données cryptées et protégées">
                                <LockIcon sx={{ fontSize: 14, color: '#007AFF' }} />
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ 
                          p: 1.5,
                          borderRadius: '10px',
                          bgcolor: '#f5f5f7',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: '#e8e8ed'
                          }
                        }}>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              mb: 0.5,
                              display: 'block',
                              color: '#86868b',
                              fontSize: '0.6875rem',
                              fontWeight: 500,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            Date de naissance
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography 
                              variant="body2"
                              sx={{ 
                                color: isEncrypted(getDisplayUser()?.birthDate) && !decryptedUserData ? '#007AFF' : '#1d1d1f',
                                fontWeight: isEncrypted(getDisplayUser()?.birthDate) && !decryptedUserData ? 600 : 400,
                                fontStyle: isEncrypted(getDisplayUser()?.birthDate) && !decryptedUserData ? 'italic' : 'normal',
                                fontSize: '0.875rem',
                                letterSpacing: '-0.01em'
                              }}
                            >
                              {formatValue(getDisplayUser()?.birthDate, 'birthDate').display}
                            </Typography>
                            {formatValue(getDisplayUser()?.birthDate, 'birthDate').isEncrypted && !decryptedUserData && (
                              <Tooltip title="Données cryptées et protégées">
                                <LockIcon sx={{ fontSize: 14, color: '#007AFF' }} />
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ 
                          p: 1.5,
                          borderRadius: '10px',
                          bgcolor: '#f5f5f7',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: '#e8e8ed'
                          }
                        }}>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              mb: 0.5,
                              display: 'block',
                              color: '#86868b',
                              fontSize: '0.6875rem',
                              fontWeight: 500,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            Lieu de naissance
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography 
                              variant="body2"
                              sx={{ 
                                color: isEncrypted(getDisplayUser()?.birthPlace) && !decryptedUserData ? '#007AFF' : '#1d1d1f',
                                fontWeight: isEncrypted(getDisplayUser()?.birthPlace) && !decryptedUserData ? 600 : 400,
                                fontStyle: isEncrypted(getDisplayUser()?.birthPlace) && !decryptedUserData ? 'italic' : 'normal',
                                fontSize: '0.875rem',
                                letterSpacing: '-0.01em'
                              }}
                            >
                              {formatValue(getDisplayUser()?.birthPlace, 'birthPlace').display}
                            </Typography>
                            {formatValue(getDisplayUser()?.birthPlace, 'birthPlace').isEncrypted && !decryptedUserData && (
                              <Tooltip title="Données cryptées et protégées">
                                <LockIcon sx={{ fontSize: 14, color: '#007AFF' }} />
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ 
                          p: 1.5,
                          borderRadius: '10px',
                          bgcolor: '#f5f5f7',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: '#e8e8ed'
                          }
                        }}>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              mb: 0.5,
                              display: 'block',
                              color: '#86868b',
                              fontSize: '0.6875rem',
                              fontWeight: 500,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            Sexe
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography 
                              variant="body2"
                              sx={{ 
                                color: isEncrypted(getDisplayUser()?.gender) && !decryptedUserData ? '#007AFF' : '#1d1d1f',
                                fontWeight: isEncrypted(getDisplayUser()?.gender) && !decryptedUserData ? 600 : 400,
                                fontStyle: isEncrypted(getDisplayUser()?.gender) && !decryptedUserData ? 'italic' : 'normal',
                                fontSize: '0.875rem',
                                letterSpacing: '-0.01em'
                              }}
                            >
                              {formatValue(getDisplayUser()?.gender, 'gender').display}
                            </Typography>
                            {formatValue(getDisplayUser()?.gender, 'gender').isEncrypted && !decryptedUserData && (
                              <Tooltip title="Données cryptées et protégées">
                                <LockIcon sx={{ fontSize: 14, color: '#007AFF' }} />
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                      </Box>

                      {/* Colonne 2 - Informations de contact */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box sx={{ 
                          p: 1.5,
                          borderRadius: '10px',
                          bgcolor: '#f5f5f7',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: '#e8e8ed'
                          }
                        }}>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              mb: 0.5,
                              display: 'block',
                              color: '#86868b',
                              fontSize: '0.6875rem',
                              fontWeight: 500,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            Email
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography 
                              variant="body2"
                              sx={{ 
                                color: isEncrypted(getDisplayUser()?.email) && !decryptedUserData ? '#007AFF' : '#1d1d1f',
                                fontWeight: isEncrypted(getDisplayUser()?.email) && !decryptedUserData ? 600 : 400,
                                fontStyle: isEncrypted(getDisplayUser()?.email) && !decryptedUserData ? 'italic' : 'normal',
                                fontSize: '0.875rem',
                                letterSpacing: '-0.01em'
                              }}
                            >
                              {formatValue(getDisplayUser()?.email, 'email').display}
                            </Typography>
                            {formatValue(getDisplayUser()?.email, 'email').isEncrypted && !decryptedUserData && (
                              <Tooltip title="Données cryptées et protégées">
                                <LockIcon sx={{ fontSize: 14, color: '#007AFF' }} />
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ 
                          p: 1.5,
                          borderRadius: '10px',
                          bgcolor: '#f5f5f7',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: '#e8e8ed'
                          }
                        }}>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              mb: 0.5,
                              display: 'block',
                              color: '#86868b',
                              fontSize: '0.6875rem',
                              fontWeight: 500,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            Numéro de téléphone
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography 
                              variant="body2"
                              sx={{ 
                                color: isEncrypted(getDisplayUser()?.phone) && !decryptedUserData ? '#007AFF' : '#1d1d1f',
                                fontWeight: isEncrypted(getDisplayUser()?.phone) && !decryptedUserData ? 600 : 400,
                                fontStyle: isEncrypted(getDisplayUser()?.phone) && !decryptedUserData ? 'italic' : 'normal',
                                fontSize: '0.875rem',
                                letterSpacing: '-0.01em'
                              }}
                            >
                              {formatValue(getDisplayUser()?.phone, 'phone').display}
                            </Typography>
                            {formatValue(getDisplayUser()?.phone, 'phone').isEncrypted && !decryptedUserData && (
                              <Tooltip title="Données cryptées et protégées">
                                <LockIcon sx={{ fontSize: 14, color: '#007AFF' }} />
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ 
                          p: 1.5,
                          borderRadius: '10px',
                          bgcolor: '#f5f5f7',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: '#e8e8ed'
                          }
                        }}>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              mb: 0.5,
                              display: 'block',
                              color: '#86868b',
                              fontSize: '0.6875rem',
                              fontWeight: 500,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            Adresse
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography 
                              variant="body2"
                              sx={{ 
                                color: isEncrypted(getDisplayUser()?.address) && !decryptedUserData ? '#007AFF' : '#1d1d1f',
                                fontWeight: isEncrypted(getDisplayUser()?.address) && !decryptedUserData ? 600 : 400,
                                fontStyle: isEncrypted(getDisplayUser()?.address) && !decryptedUserData ? 'italic' : 'normal',
                                fontSize: '0.875rem',
                                letterSpacing: '-0.01em'
                              }}
                            >
                              {formatValue(getDisplayUser()?.address, 'address').display}
                            </Typography>
                            {formatValue(getDisplayUser()?.address, 'address').isEncrypted && !decryptedUserData && (
                              <Tooltip title="Données cryptées et protégées">
                                <LockIcon sx={{ fontSize: 14, color: '#007AFF' }} />
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ 
                          p: 1.5,
                          borderRadius: '10px',
                          bgcolor: '#f5f5f7',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: '#e8e8ed'
                          }
                        }}>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              mb: 0.5,
                              display: 'block',
                              color: '#86868b',
                              fontSize: '0.6875rem',
                              fontWeight: 500,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            Code postal de naissance
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography 
                              variant="body2"
                              sx={{ 
                                color: isEncrypted(getDisplayUser()?.birthPostalCode) && !decryptedUserData ? '#007AFF' : '#1d1d1f',
                                fontWeight: isEncrypted(getDisplayUser()?.birthPostalCode) && !decryptedUserData ? 600 : 400,
                                fontStyle: isEncrypted(getDisplayUser()?.birthPostalCode) && !decryptedUserData ? 'italic' : 'normal',
                                fontSize: '0.875rem',
                                letterSpacing: '-0.01em'
                              }}
                            >
                              {formatValue(getDisplayUser()?.birthPostalCode, 'birthPostalCode').display}
                            </Typography>
                            {formatValue(getDisplayUser()?.birthPostalCode, 'birthPostalCode').isEncrypted && !decryptedUserData && (
                              <Tooltip title="Données cryptées et protégées">
                                <LockIcon sx={{ fontSize: 14, color: '#007AFF' }} />
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                      </Box>

                      {/* Colonne 3 - Informations administratives */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box sx={{ 
                          p: 1.5,
                          borderRadius: '10px',
                          bgcolor: '#f5f5f7',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: '#e8e8ed'
                          }
                        }}>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              mb: 0.5,
                              display: 'block',
                              color: '#86868b',
                              fontSize: '0.6875rem',
                              fontWeight: 500,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            Numéro étudiant
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography 
                              variant="body2"
                              sx={{ 
                                color: isEncrypted(getDisplayUser()?.studentId) && !decryptedUserData ? '#007AFF' : '#1d1d1f',
                                fontWeight: isEncrypted(getDisplayUser()?.studentId) && !decryptedUserData ? 600 : 400,
                                fontStyle: isEncrypted(getDisplayUser()?.studentId) && !decryptedUserData ? 'italic' : 'normal',
                                fontSize: '0.875rem',
                                letterSpacing: '-0.01em'
                              }}
                            >
                              {formatValue(getDisplayUser()?.studentId, 'studentId').display}
                            </Typography>
                            {formatValue(getDisplayUser()?.studentId, 'studentId').isEncrypted && !decryptedUserData && (
                              <Tooltip title="Données cryptées et protégées">
                                <LockIcon sx={{ fontSize: 14, color: '#007AFF' }} />
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ 
                          p: 1.5,
                          borderRadius: '10px',
                          bgcolor: '#f5f5f7',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: '#e8e8ed'
                          }
                        }}>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              mb: 0.5,
                              display: 'block',
                              color: '#86868b',
                              fontSize: '0.6875rem',
                              fontWeight: 500,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            Année de diplomation
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography 
                              variant="body2"
                              sx={{ 
                                color: isEncrypted(getDisplayUser()?.graduationYear) && !decryptedUserData ? '#007AFF' : '#1d1d1f',
                                fontWeight: isEncrypted(getDisplayUser()?.graduationYear) && !decryptedUserData ? 600 : 400,
                                fontStyle: isEncrypted(getDisplayUser()?.graduationYear) && !decryptedUserData ? 'italic' : 'normal',
                                fontSize: '0.875rem',
                                letterSpacing: '-0.01em'
                              }}
                            >
                              {formatValue(getDisplayUser()?.graduationYear, 'graduationYear').display}
                            </Typography>
                            {formatValue(getDisplayUser()?.graduationYear, 'graduationYear').isEncrypted && !decryptedUserData && (
                              <Tooltip title="Données cryptées et protégées">
                                <LockIcon sx={{ fontSize: 14, color: '#007AFF' }} />
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ 
                          p: 1.5,
                          borderRadius: '10px',
                          bgcolor: isEncrypted(getDisplayUser()?.socialSecurityNumber) && !decryptedUserData
                            ? 'rgba(0, 122, 255, 0.08)' 
                            : '#f5f5f7',
                          border: isEncrypted(getDisplayUser()?.socialSecurityNumber) && !decryptedUserData
                            ? '2px solid rgba(0, 122, 255, 0.2)'
                            : '2px solid transparent',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: isEncrypted(getDisplayUser()?.socialSecurityNumber) && !decryptedUserData
                              ? 'rgba(0, 122, 255, 0.12)' 
                              : '#e8e8ed'
                          }
                        }}>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              mb: 0.5,
                              display: 'block',
                              color: '#86868b',
                              fontSize: '0.6875rem',
                              fontWeight: 500,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            Numéro de sécurité sociale
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography 
                              variant="body2"
                              sx={{ 
                                color: isEncrypted(getDisplayUser()?.socialSecurityNumber) && !decryptedUserData ? '#007AFF' : '#1d1d1f',
                                fontWeight: isEncrypted(getDisplayUser()?.socialSecurityNumber) && !decryptedUserData ? 600 : 500,
                                fontStyle: isEncrypted(getDisplayUser()?.socialSecurityNumber) && !decryptedUserData ? 'italic' : 'normal',
                                fontSize: '0.875rem',
                                letterSpacing: '-0.01em'
                              }}
                            >
                              {formatValue(getDisplayUser()?.socialSecurityNumber, 'socialSecurityNumber').display}
                            </Typography>
                            {formatValue(getDisplayUser()?.socialSecurityNumber, 'socialSecurityNumber').isEncrypted && !decryptedUserData && (
                              <Tooltip title="Données cryptées et protégées - Informations sensibles">
                                <LockIcon sx={{ fontSize: 16, color: '#007AFF' }} />
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ 
                          p: 1.5,
                          borderRadius: '10px',
                          bgcolor: '#f5f5f7',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: '#e8e8ed'
                          }
                        }}>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              mb: 0.5,
                              display: 'block',
                              color: '#86868b',
                              fontSize: '0.6875rem',
                              fontWeight: 500,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            Nationalité
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography 
                              variant="body2"
                              sx={{ 
                                color: isEncrypted(getDisplayUser()?.nationality) && !decryptedUserData ? '#007AFF' : '#1d1d1f',
                                fontWeight: isEncrypted(getDisplayUser()?.nationality) && !decryptedUserData ? 600 : 400,
                                fontStyle: isEncrypted(getDisplayUser()?.nationality) && !decryptedUserData ? 'italic' : 'normal',
                                fontSize: '0.875rem',
                                letterSpacing: '-0.01em'
                              }}
                            >
                              {formatValue(getDisplayUser()?.nationality, 'nationality').display}
                            </Typography>
                            {formatValue(getDisplayUser()?.nationality, 'nationality').isEncrypted && !decryptedUserData && (
                              <Tooltip title="Données cryptées et protégées">
                                <LockIcon sx={{ fontSize: 14, color: '#007AFF' }} />
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                )}

                {currentTab === 1 && (
                  <Box>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        mb: 3,
                        fontWeight: 600,
                        fontSize: '1.25rem',
                        letterSpacing: '-0.01em',
                        color: '#1d1d1f'
                      }}
                    >
                      Documents
                    </Typography>
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
                              borderRadius: '12px',
                              bgcolor: '#f5f5f7',
                              border: '1px solid transparent',
                              cursor: 'pointer',
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              '&:hover': {
                                bgcolor: '#e8e8ed',
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
                                    color: '#1d1d1f',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {document.name}
                                </Typography>
                              </Box>
                            </Box>
                            {document.createdAt && (
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: '#86868b',
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
                            )}
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Box sx={{ 
                        textAlign: 'center', 
                        py: 6,
                        color: '#86868b'
                      }}>
                        <FileIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                          Aucun document disponible
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}

                {currentTab === 2 && (
                  <Box>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        mb: 3,
                        fontWeight: 600,
                        fontSize: '1.25rem',
                        letterSpacing: '-0.01em',
                        color: '#1d1d1f'
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
                              borderRadius: '16px',
                              bgcolor: '#f5f5f7',
                              border: '1px solid rgba(0, 0, 0, 0.05)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 1.5,
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                bgcolor: '#e8e8ed',
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
                                  color: '#1d1d1f'
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
                                           mission.status === 'Terminée' ? '#34C759' : '#FF3B30',
                                  color: '#ffffff',
                                  border: 'none'
                                }}
                              />
                            </Box>
                            <Typography 
                              variant="body2" 
                              sx={{
                                color: '#86868b',
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
                                  color: '#86868b',
                                  fontSize: '0.8125rem'
                                }}
                              >
                                {mission.startDate} - {mission.endDate}
                              </Typography>
                              <Typography 
                                variant="body2" 
                                sx={{
                                  fontWeight: 600,
                                  color: '#1d1d1f',
                                  fontSize: '0.875rem'
                                }}
                              >
                                {mission.remuneration}
                              </Typography>
                            </Box>
                            <Typography 
                              variant="caption" 
                              sx={{
                                color: '#86868b',
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
                          color: '#86868b'
                        }}>
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                            Aucune mission effectuée
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                )}

                {currentTab === 3 && (
                  <Box>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        mb: 3,
                        fontWeight: 600,
                        fontSize: '1.25rem',
                        letterSpacing: '-0.01em',
                        color: '#1d1d1f'
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
                              borderRadius: '16px',
                              bgcolor: '#f5f5f7',
                              border: '1px solid rgba(0, 0, 0, 0.05)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 1,
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                bgcolor: '#e8e8ed',
                                transform: 'translateY(-2px)',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                              }
                            }}
                          >
                            <Typography 
                              variant="caption" 
                              sx={{
                                color: '#86868b',
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
                                color: '#1d1d1f',
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
                                    bgcolor: '#34C759',
                                    color: '#ffffff',
                                    border: 'none'
                                  }}
                                />
                                <Typography 
                                  variant="caption" 
                                  sx={{
                                    color: '#86868b',
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
                                    color: '#86868b',
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
                                    bgcolor: '#34C759',
                                    color: '#ffffff',
                                    border: 'none'
                                  }}
                                />
                                <Typography 
                                  variant="caption" 
                                  sx={{
                                    color: '#86868b',
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
                                    bgcolor: entry.action.includes('Décryptage') ? '#007AFF' : '#86868b',
                                    color: '#ffffff',
                                    border: 'none'
                                  }}
                                />
                                <Typography 
                                  variant="caption" 
                                  sx={{
                                    color: '#86868b',
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
                                  color: '#86868b',
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
                          color: '#86868b'
                        }}>
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                            Aucun historique disponible
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                )}
              </Box>
            </>
          ) : (
            <Box sx={{ 
              p: 6, 
              textAlign: 'center', 
              color: '#86868b',
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
                  color: '#1d1d1f',
                  mb: 1
                }}
              >
                Sélectionnez un membre
              </Typography>
              <Typography 
                variant="body2"
                sx={{
                  fontSize: '0.875rem',
                  color: '#86868b'
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
      >
        <MenuItem 
          onClick={handleEditUser}
          disabled={!canEditUser()}
          title={!canEditUser() ? "Seuls les admins, membres RH, superadmins et personnes ayant accès au décryptage peuvent modifier les profils" : ""}
        >
          Modifier
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Désactiver le compte</MenuItem>
        <MenuItem 
          onClick={handleDeleteUser}
          disabled={!selectedUser || !canEditUser()}
          sx={{ color: 'error.main' }}
          title={!canEditUser() ? "Seuls les admins, membres RH, superadmins et personnes ayant accès au décryptage peuvent supprimer les utilisateurs" : ""}
        >
          Supprimer
        </MenuItem>
      </Menu>

      {/* Modal d'édition des informations utilisateur */}
      <Dialog
        open={editModalOpen}
        onClose={handleCloseEditModal}
        maxWidth="md"
        fullWidth
        sx={{
          zIndex: 9999,
          '& .MuiDialog-container': {
            zIndex: 9999
          }
        }}
        PaperProps={{
          sx: {
            zIndex: 9999
          }
        }}
      >
        <DialogTitle>
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
                    <MenuItem value="Homme">Homme</MenuItem>
                    <MenuItem value="Femme">Femme</MenuItem>
                    <MenuItem value="Autre">Autre</MenuItem>
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
                  multiline
                  rows={2}
                />
              </Grid>

              {/* Informations académiques */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', mt: 3 }}>
                  Informations académiques
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Numéro étudiant"
                  value={getDecryptedFieldValue('studentId')}
                  onChange={(e) => handleInputChange('studentId', e.target.value)}
                  variant="outlined"
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

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        sx={{
          zIndex: 9999, // z-index très élevé pour être au-dessus de tout (sidebar, dialogs, etc.)
          position: 'fixed',
          bottom: '24px !important',
          left: '80px !important', // Décaler à droite pour éviter la sidebar
          '& .MuiSnackbar-root': {
            zIndex: 9999
          }
        }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 9999,
            '& .MuiAlert-message': {
              width: '100%'
            }
          }}
        >
          {snackbar.message.includes('2FA') || snackbar.message.includes('authentification à deux facteurs') ? (
            <Box>
              {snackbar.message.split(/(authentification à deux facteurs \(2FA\)|2FA)/i).map((part, index) => {
                if (index % 2 === 1) {
                  // C'est la partie 2FA, la rendre cliquable
                  return (
                    <Typography
                      key={index}
                      component="span"
                      onClick={() => {
                        navigate('/app/profile?tab=security');
                        setSnackbar(prev => ({ ...prev, open: false }));
                      }}
                      sx={{
                        color: '#007AFF',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontWeight: 600,
                        '&:hover': {
                          color: '#0051D5'
                        }
                      }}
                    >
                      {part}
                    </Typography>
                  );
                }
                return <span key={index}>{part}</span>;
              })}
            </Box>
          ) : (
            snackbar.message
          )}
        </Alert>
      </Snackbar>

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

      {/* Modal de visualisation de document */}
      <Dialog
        open={viewerOpen}
        onClose={() => {
          setViewerOpen(false);
          if (viewerUrl && viewerUrl.startsWith('blob:')) {
            URL.revokeObjectURL(viewerUrl);
          }
          setViewerUrl(null);
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
        <DialogTitle sx={{ 
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
              setViewerError(null);
              setViewerLoading(false);
            }}
            sx={{ color: 'text.secondary' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, position: 'relative', height: '100%', minHeight: '400px' }}>
          {viewerLoading && (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100%',
              flexDirection: 'column',
              gap: 2
            }}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                Chargement du document...
              </Typography>
            </Box>
          )}
          {viewerError && !viewerLoading && (
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
              <Alert severity="warning" sx={{ width: '100%' }}>{viewerError}</Alert>
            </Box>
          )}
          {viewerUrl && !viewerLoading && !viewerError && (
            <Box sx={{ 
              height: '100%', 
              width: '100%',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: '#f5f5f5'
            }}>
              {viewerUrl.startsWith('blob:') ? (
                // Pour les blobs (fichiers déchiffrés), utiliser un embed avec fallback iframe
                <Box sx={{ 
                  height: '100%', 
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  p: 3
                }}>
                  <embed
                    src={`${viewerUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                    type="application/pdf"
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      flex: 1,
                      minHeight: '500px'
                    }}
                    onLoad={() => {
                      console.log('✅ Embed blob chargé avec succès');
                    }}
                    onError={(e) => {
                      console.error('❌ Erreur chargement embed blob:', e);
                    }}
                  />
                  {/* Message d'aide et bouton pour ouvrir dans un nouvel onglet */}
                  <Box sx={{ 
                    position: 'absolute', 
                    bottom: 16,
                    right: 16,
                    display: 'flex',
                    gap: 2,
                    alignItems: 'center'
                  }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      Si le PDF ne s'affiche pas, utilisez le bouton ci-dessous
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => {
                        if (viewerUrl) {
                          window.open(viewerUrl, '_blank');
                        }
                      }}
                    >
                      Ouvrir dans un nouvel onglet
                    </Button>
                  </Box>
                </Box>
              ) : (
                // Pour les URLs Firebase Storage, utiliser un iframe
                <iframe
                  src={viewerUrl}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    flex: 1
                  }}
                  title="Document viewer"
                  onLoad={() => {
                    console.log('✅ Iframe chargée avec succès');
                  }}
                  onError={(e) => {
                    console.error('❌ Erreur chargement iframe:', e);
                    setViewerError('Impossible de charger le document. Il est peut-être chiffré.');
                  }}
                />
              )}
            </Box>
          )}
          {!viewerUrl && !viewerLoading && !viewerError && (
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
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={async () => {
              if (viewerUrl && currentViewingDocument) {
                const link = document.createElement('a');
                link.href = viewerUrl;
                link.download = currentViewingDocument.name || 'document.pdf';
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
              setViewerError(null);
              setViewerLoading(false);
            }}
          >
            Fermer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HumanResources; 