import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Breadcrumbs,
  Link,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
  CircularProgress,
  Chip,
  Collapse,
  Divider,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Home as HomeIcon,
  Folder as FolderIcon,
  CreateNewFolder as CreateFolderIcon,
  CloudUpload as UploadIcon,
  ViewModule as GridIcon,
  ViewList as ListIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Lock as LockIcon,
  Assignment as AssignmentIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Edit as EditIcon,
  Info as InfoIcon,
  ColorLens as ColorIcon,
  InsertDriveFile as FileTextIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../utils/dateUtils';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  getDoc,
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import { db, storage } from '../firebase/config';
import { deleteFile } from '../firebase/storage';
import { ref, listAll, getMetadata, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { Document, Folder, ViewMode, BreadcrumbItem } from '../types/document';
import { formatFileSize } from '../utils/fileUtils';
import DocumentCard from '../components/documents/DocumentCard';
import DocumentRow from '../components/documents/DocumentRow';
import FolderCard from '../components/documents/FolderCard';
import UploadModal from '../components/documents/UploadModal';
import { trackUserActivity } from '../services/userActivityService';

const Documents: React.FC = () => {
  const { currentUser, userData } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [missionDocuments, setMissionDocuments] = useState<{ [missionId: string]: { mission: any; documents: Document[] } }>({});
  const [personalDocumentsByFolder, setPersonalDocumentsByFolder] = useState<{ [folderId: string]: Document[] }>({});
  const [expandedMissions, setExpandedMissions] = useState<Set<string>>(new Set());
  const [missions, setMissions] = useState<any[]>([]);
  const [missionsFolderDocuments, setMissionsFolderDocuments] = useState<Document[]>([]);
  const [currentMissionId, setCurrentMissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: 'Documents' },
  ]);
  
  // ID spécial pour le dossier virtuel "Missions"
  const MISSIONS_FOLDER_ID = '__missions__';
  // ID Firestore pour stocker la couleur (ne peut pas utiliser __missions__ car réservé par Firebase)
  const MISSIONS_FOLDER_FIRESTORE_ID = 'missions-folder-color';
  // ID spécial pour le dossier virtuel "Documents Étudiants"
  const STUDENTS_DOCUMENTS_FOLDER_ID = '__students_documents__';
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'document' | 'folder'; item: Document | Folder } | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [itemToRename, setItemToRename] = useState<{ type: 'document' | 'folder'; item: Document | Folder } | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [propertiesDialogOpen, setPropertiesDialogOpen] = useState(false);
  const [itemProperties, setItemProperties] = useState<{ type: 'document' | 'folder'; item: Document | Folder } | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>('#007AFF');
  const [folderSize, setFolderSize] = useState<number>(0);
  const [folderSizes, setFolderSizes] = useState<{ [folderId: string]: number }>({});
  const [savedFolderColors, setSavedFolderColors] = useState<{ [folderId: string]: string }>({});
  
  // États pour les filtres
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>('all');
  const [studentFilter, setStudentFilter] = useState<string>('all');
  
  // Fonctions pour extraire le type de document et l'étudiant depuis le nom
  const extractDocumentType = (documentName: string): string => {
    // Format: "Type de document - Nom Étudiant"
    const parts = documentName.split(' - ');
    return parts[0] || documentName;
  };
  
  const extractStudentName = (documentName: string): string => {
    // Format: "Type de document - Nom Étudiant"
    const parts = documentName.split(' - ');
    return parts.length > 1 ? parts.slice(1).join(' - ') : '';
  };
  
  // Obtenir les types de documents uniques et les étudiants uniques
  const getUniqueDocumentTypes = (docs: Document[]): string[] => {
    const types = new Set<string>();
    docs.forEach(doc => {
      if (doc.isPersonalDocument) {
        const type = extractDocumentType(doc.name);
        if (type) types.add(type);
      }
    });
    return Array.from(types).sort();
  };
  
  const getUniqueStudents = (docs: Document[]): string[] => {
    const students = new Set<string>();
    docs.forEach(doc => {
      if (doc.isPersonalDocument && doc.uploadedByName) {
        students.add(doc.uploadedByName);
      }
    });
    return Array.from(students).sort();
  };
  
  // Filtrer les documents selon les filtres sélectionnés
  const getFilteredDocuments = (docs: Document[]): Document[] => {
    if (currentFolderId !== STUDENTS_DOCUMENTS_FOLDER_ID) {
      return docs;
    }
    
    let filtered = docs;
    
    // Filtrer par type de document
    if (documentTypeFilter !== 'all') {
      filtered = filtered.filter(doc => {
        if (!doc.isPersonalDocument) return true;
        const docType = extractDocumentType(doc.name);
        return docType === documentTypeFilter;
      });
    }
    
    // Filtrer par étudiant
    if (studentFilter !== 'all') {
      filtered = filtered.filter(doc => {
        if (!doc.isPersonalDocument) return true;
        return doc.uploadedByName === studentFilter;
      });
    }
    
    return filtered;
  };
  
  // Couleurs macOS pour les dossiers
  const folderColors = [
    { name: 'Bleu', value: '#007AFF' },
    { name: 'Rouge', value: '#FF3B30' },
    { name: 'Orange', value: '#FF9500' },
    { name: 'Jaune', value: '#FFCC00' },
    { name: 'Vert', value: '#34C759' },
    { name: 'Turquoise', value: '#5AC8FA' },
    { name: 'Violet', value: '#AF52DE' },
    { name: 'Rose', value: '#FF2D55' },
  ];
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  const structureId = userData?.structureId || currentUser?.structureId;
  const userRole = userData?.status || currentUser?.status;

  // Vérifier si l'utilisateur peut accéder à un élément restreint
  const canAccessRestricted = (item: Document | Folder): boolean => {
    if (!item.isRestricted) return true;
    if (userRole === 'superadmin') return true;
    if (userRole === 'admin') return true;
    if (item.allowedRoles && item.allowedRoles.includes(userRole || '')) return true;
    return false;
  };

  // Toggle l'expansion d'une mission
  const toggleMission = (missionId: string) => {
    setExpandedMissions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(missionId)) {
        newSet.delete(missionId);
      } else {
        newSet.add(missionId);
      }
      return newSet;
    });
  };

  // Charger les missions au démarrage
  useEffect(() => {
    if (!structureId || !currentUser) return;
    loadMissions();
    loadFolderColors();
  }, [structureId, currentUser]);

  // Charger les couleurs personnalisées des dossiers
  const loadFolderColors = async () => {
    if (!structureId) return;
    
    try {
      // Charger la couleur du dossier "Missions"
      const missionsFolderColorRef = doc(db, 'structures', structureId, 'folderColors', MISSIONS_FOLDER_FIRESTORE_ID);
      const missionsFolderColorDoc = await getDoc(missionsFolderColorRef);
      if (missionsFolderColorDoc.exists()) {
        const data = missionsFolderColorDoc.data();
        setSavedFolderColors(prev => ({ ...prev, [MISSIONS_FOLDER_ID]: data.color || '#FF9500' }));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des couleurs de dossiers:', error);
    }
  };

  // Charger les documents d'une mission spécifique
  const loadMissionDocuments = useCallback(async (missionId: string) => {
    if (!structureId || !missionId) return;

    try {
      setLoading(true);
      const allDocuments: Document[] = [];

      // Récupérer la mission pour obtenir le chargé de mission
      let chargeName = '';
      try {
        const missionDoc = await getDoc(doc(db, 'missions', missionId));
        if (missionDoc.exists()) {
          const missionData = missionDoc.data();
          chargeName = missionData.chargeName || '';
        }
      } catch (e) {
        console.error('Erreur lors de la récupération de la mission:', e);
      }

      // 1. Charger depuis generatedDocuments
      const generatedDocsRef = collection(db, 'generatedDocuments');
      const generatedDocsQuery = query(
        generatedDocsRef,
        where('missionId', '==', missionId)
      );
      const generatedDocsSnapshot = await getDocs(generatedDocsQuery);

      for (const docSnap of generatedDocsSnapshot.docs) {
        const data = docSnap.data();
        
        // Utiliser le chargé de mission comme créateur pour les documents de mission
        const uploadedByName = chargeName || 'Inconnu';

        allDocuments.push({
          id: docSnap.id,
          name: data.fileName || 'Document sans nom',
          size: data.fileSize || 0,
          type: data.fileName?.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
          url: data.fileUrl || '',
          storagePath: data.fileUrl || '',
          parentFolderId: null,
          uploadedBy: data.createdBy || '',
          uploadedByName,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt,
          structureId: data.structureId || structureId,
          isRestricted: false,
          missionId: data.missionId,
          missionNumber: data.missionNumber,
          missionTitle: data.missionTitle,
          isPinned: data.isPinned || false,
        } as Document);
      }

      // 2. Charger depuis structures/{structureId}/documents avec missionId
      const structureDocsRef = collection(db, 'structures', structureId, 'documents');
      const structureDocsQuery = query(
        structureDocsRef,
        where('missionId', '==', missionId)
      );
      
      let structureDocsSnapshot;
      try {
        structureDocsSnapshot = await getDocs(structureDocsQuery);
      } catch (error: any) {
        // Si l'index n'existe pas, on ignore cette source
        console.warn('Index missionId non disponible pour structures/documents');
        structureDocsSnapshot = { docs: [] };
      }

      for (const docSnap of structureDocsSnapshot.docs) {
        const data = docSnap.data();
        
        // Utiliser le chargé de mission comme créateur pour les documents de mission
        const uploadedByName = chargeName || 'Inconnu';

        allDocuments.push({
          id: docSnap.id,
          name: data.name || 'Document sans nom',
          size: data.size || 0,
          type: data.type || 'application/octet-stream',
          url: data.url || '',
          storagePath: data.storagePath || '',
          parentFolderId: data.parentFolderId,
          uploadedBy: data.uploadedBy || '',
          uploadedByName,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt,
          structureId: data.structureId || structureId,
          isRestricted: data.isRestricted || false,
          missionId: data.missionId,
          missionNumber: data.missionNumber,
          missionTitle: data.missionTitle,
          isPinned: data.isPinned || false,
        } as Document);
      }

      // Trier par date de création
      allDocuments.sort((a, b) => {
        const aDate = a.createdAt && (a.createdAt as any).toDate 
          ? (a.createdAt as any).toDate() 
          : new Date(a.createdAt as Date || 0);
        const bDate = b.createdAt && (b.createdAt as any).toDate 
          ? (b.createdAt as any).toDate() 
          : new Date(b.createdAt as Date || 0);
        return bDate.getTime() - aDate.getTime();
      });

      setMissionsFolderDocuments(allDocuments);
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement des documents de mission:', error);
      setLoading(false);
    }
  }, [structureId]);

  // Charger les documents et dossiers
  const loadDocuments = useCallback(async () => {
    if (!structureId || !currentUser) return;

    // Si on est dans le dossier Missions, ne pas charger les documents normaux
    if (currentFolderId === MISSIONS_FOLDER_ID) {
      setLoading(false);
      if (currentMissionId) {
        loadMissionDocuments(currentMissionId);
      }
      return;
    }

    setLoading(true);
    try {
      // Charger les missions de la structure
        const missionsRef = collection(db, 'missions');
        const missionsQuery = query(
          missionsRef,
          where('structureId', '==', structureId)
        );
        const missionsSnapshot = await getDocs(missionsQuery);
        const missionsMap: { [id: string]: any } = {};
        missionsSnapshot.docs.forEach(doc => {
          missionsMap[doc.id] = {
            id: doc.id,
            ...doc.data(),
          };
        });

        // Charger les documents liés aux missions
        const missionDocsRef = collection(db, 'structures', structureId, 'documents');
        const missionDocsQuery = query(
          missionDocsRef,
          where('missionId', '!=', null)
        );
        let missionDocsSnapshot;
        try {
          missionDocsSnapshot = await getDocs(missionDocsQuery);
        } catch (error: any) {
          // Si l'index n'existe pas encore, on charge tous les documents et on filtre
          console.warn('Index missionId non disponible, chargement de tous les documents...');
          const allDocsQuery = query(missionDocsRef);
          missionDocsSnapshot = await getDocs(allDocsQuery);
        }

        const missionDocsMap: { [missionId: string]: Document[] } = {};
        
        for (const docSnap of missionDocsSnapshot.docs) {
          const data = docSnap.data();
          // Filtrer les documents qui ont un missionId
          if (!data.missionId) continue;
          
          // Récupérer le nom de l'utilisateur
          let uploadedByName = '';
          try {
            const userDoc = await getDoc(doc(db, 'users', data.uploadedBy));
            const userData = userDoc.data();
            uploadedByName = userData?.displayName || userData?.firstName + ' ' + userData?.lastName || 'Inconnu';
          } catch (e) {
            console.error('Erreur lors de la récupération du nom utilisateur:', e);
          }

          const missionId = data.missionId;
          if (!missionDocsMap[missionId]) {
            missionDocsMap[missionId] = [];
          }

          const mission = missionsMap[missionId];
          missionDocsMap[missionId].push({
            id: docSnap.id,
            ...data,
            uploadedByName,
            missionNumber: mission?.numeroMission || data.missionNumber,
            missionTitle: mission?.description || mission?.company || data.missionTitle || 'Mission inconnue',
            createdAt: data.createdAt,
          } as Document);
        }

        // Organiser les documents par mission
        const missionDocumentsMap: { [missionId: string]: { mission: any; documents: Document[] } } = {};
        Object.keys(missionDocsMap).forEach(missionId => {
          const mission = missionsMap[missionId];
          if (mission) {
            // Trier les documents par date de création
            missionDocsMap[missionId].sort((a, b) => {
              const aDate = a.createdAt && (a.createdAt as any).toDate 
                ? (a.createdAt as any).toDate() 
                : new Date(a.createdAt as Date || 0);
              const bDate = b.createdAt && (b.createdAt as any).toDate 
                ? (b.createdAt as any).toDate() 
                : new Date(b.createdAt as Date || 0);
              return bDate.getTime() - aDate.getTime();
            });

            missionDocumentsMap[missionId] = {
              mission,
              documents: missionDocsMap[missionId],
            };
          }
        });

        setMissionDocuments(missionDocumentsMap);

        // Charger les documents
        const docsRef = collection(db, 'structures', structureId, 'documents');
        let docsSnapshot;
        try {
          // Si currentFolderId est null, charger tous les documents sans parentFolderId ET sans missionId
          if (currentFolderId === null) {
            const docsQuery = query(
              docsRef,
              where('parentFolderId', '==', null),
              orderBy('createdAt', 'desc')
            );
            try {
              docsSnapshot = await getDocs(docsQuery);
            } catch (error: any) {
              // Si l'index n'est pas disponible, charger tous les documents et filtrer
              console.warn('Index parentFolderId non disponible, chargement de tous les documents...');
              const allDocsQuery = query(docsRef);
              const allDocsSnapshot = await getDocs(allDocsQuery);
              // Filtrer les documents sans parentFolderId et sans missionId
              docsSnapshot = {
                docs: allDocsSnapshot.docs.filter(doc => {
                  const data = doc.data();
                  return data.parentFolderId === null || data.parentFolderId === undefined;
                })
              } as any;
            }
          } else {
          const docsQuery = query(
            docsRef,
            where('parentFolderId', '==', currentFolderId),
            orderBy('createdAt', 'desc')
          );
          docsSnapshot = await getDocs(docsQuery);
          }
        } catch (indexError: any) {
          // Si l'index n'est pas encore prêt, charger sans orderBy
          if (indexError?.code === 'failed-precondition') {
            console.warn('Index en cours de construction, chargement sans tri...');
            if (currentFolderId === null) {
              const allDocsQuery = query(docsRef);
              const allDocsSnapshot = await getDocs(allDocsQuery);
              docsSnapshot = {
                docs: allDocsSnapshot.docs.filter(doc => {
                  const data = doc.data();
                  return (data.parentFolderId === null || data.parentFolderId === undefined) && !data.missionId;
                })
              } as any;
            } else {
            const docsQuery = query(
              docsRef,
              where('parentFolderId', '==', currentFolderId)
            );
            docsSnapshot = await getDocs(docsQuery);
            }
          } else {
            throw indexError;
          }
        }

        const docsList: Document[] = [];
        for (const docSnap of docsSnapshot.docs) {
          const data = docSnap.data();
          
          // Exclure les documents liés aux missions (ils seront affichés dans la section dédiée)
          if (data.missionId) continue;
          
          // Pour le dossier racine, vérifier que parentFolderId est bien null/undefined
          if (currentFolderId === null && (data.parentFolderId !== null && data.parentFolderId !== undefined)) {
            continue;
          }
          
          // Récupérer le nom de l'utilisateur
          let uploadedByName = '';
          try {
            if (data.uploadedBy) {
            const userDoc = await getDoc(doc(db, 'users', data.uploadedBy));
            const userData = userDoc.data();
            uploadedByName = userData?.displayName || userData?.firstName + ' ' + userData?.lastName || 'Inconnu';
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
        
        // Si l'index n'était pas disponible, trier manuellement
        if (docsList.length > 0 && docsList[0].createdAt) {
          docsList.sort((a, b) => {
            const aDate = a.createdAt && (a.createdAt as any).toDate 
              ? (a.createdAt as any).toDate() 
              : new Date(a.createdAt as Date || 0);
            const bDate = b.createdAt && (b.createdAt as any).toDate 
              ? (b.createdAt as any).toDate() 
              : new Date(b.createdAt as Date || 0);
            return bDate.getTime() - aDate.getTime();
          });
        }

        // 3. Récupérer les documents personnels de tous les utilisateurs de la structure
        const STUDENTS_DOCUMENTS_FOLDER_ID = '__students_documents__';
        const personalDocsList: Document[] = [];
        
        try {
          const usersRef = collection(db, 'users');
          const usersQuery = query(
            usersRef,
            where('structureId', '==', structureId)
          );
          const usersSnapshot = await getDocs(usersQuery);
          
          for (const userDocSnap of usersSnapshot.docs) {
            const userData = userDocSnap.data();
            const userId = userDocSnap.id;
            
            if (!userData) continue;
            
            const userName = userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Inconnu';
            
            // Fonction helper pour créer un document depuis une URL
            const createDocumentFromUrl = (url: string | undefined, displayName: string, type: string = 'application/pdf'): Document | null => {
              if (!url) return null;
              
              // Extraire le chemin depuis l'URL Firebase Storage
              let storagePath = url;
              if (url.startsWith('http')) {
                try {
                  const urlObj = new URL(url);
                  const pathStartIndex = urlObj.pathname.indexOf('/o/') + 3;
                  if (pathStartIndex > 2) {
                    const encodedPath = urlObj.pathname.substring(pathStartIndex);
                    // Extraire le chemin avant le '?' (qui contient les paramètres)
                    const pathWithoutParams = encodedPath.split('?')[0];
                    storagePath = decodeURIComponent(pathWithoutParams.replace(/%2F/g, '/'));
                  }
                } catch (e) {
                  console.error('Erreur lors de l\'extraction du chemin depuis l\'URL:', e);
                  // Si on ne peut pas extraire, utiliser l'URL complète
                  storagePath = url;
                }
              }
              
              // Convertir la date en Timestamp si nécessaire
              let createdAt: any = new Date();
              if (userData.updatedAt) {
                createdAt = userData.updatedAt;
              } else if (userData.createdAt) {
                createdAt = userData.createdAt;
              }
              
              return {
                id: `profile_${userId}_${displayName.toLowerCase().replace(/\s+/g, '_')}`,
                name: `${displayName} - ${userName}`, // Ajouter le nom de l'utilisateur au nom du document
                url: url,
                type: type,
                size: 0,
                storagePath: storagePath, // Utiliser le chemin extrait
                parentFolderId: STUDENTS_DOCUMENTS_FOLDER_ID, // Mettre dans le dossier "Documents Étudiants"
                uploadedBy: userId,
                uploadedByName: userName,
                createdAt: createdAt,
                structureId: structureId,
                isRestricted: false,
                isPersonalDocument: true, // Marquer comme document personnel
              } as Document;
            };
            
            // Ajouter les documents personnels
            if (userData.cvUrl) {
              const doc = createDocumentFromUrl(userData.cvUrl, 'CV', 'application/pdf');
              if (doc) personalDocsList.push(doc);
            }
            
            if (userData.identityCardUrl) {
              const doc = createDocumentFromUrl(userData.identityCardUrl, 'Carte d\'identité', 'application/pdf');
              if (doc) personalDocsList.push(doc);
            }
            
            if (userData.identityCardRectoUrl) {
              const doc = createDocumentFromUrl(userData.identityCardRectoUrl, 'Carte d\'identité (Recto)', 'application/pdf');
              if (doc) personalDocsList.push(doc);
            }
            
            if (userData.identityCardVersoUrl) {
              const doc = createDocumentFromUrl(userData.identityCardVersoUrl, 'Carte d\'identité (Verso)', 'application/pdf');
              if (doc) personalDocsList.push(doc);
            }
            
            if (userData.ribUrl) {
              const doc = createDocumentFromUrl(userData.ribUrl, 'RIB', 'application/pdf');
              if (doc) personalDocsList.push(doc);
            }
            
            if (userData.schoolCertificateUrl) {
              const doc = createDocumentFromUrl(userData.schoolCertificateUrl, 'Certificat de scolarité', 'application/pdf');
              if (doc) personalDocsList.push(doc);
            }
            
            if (userData.healthCardUrl) {
              const doc = createDocumentFromUrl(userData.healthCardUrl, 'Carte Vitale', 'application/pdf');
              if (doc) personalDocsList.push(doc);
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
                    doc.id = `custom_${userId}_${customDoc.id || Date.now()}`;
                    if (customDoc.uploadedAt) {
                      doc.createdAt = customDoc.uploadedAt;
                    }
                    personalDocsList.push(doc);
                  }
                }
              }
            }
          }
          
          // Trier les documents personnels par date
          personalDocsList.sort((a, b) => {
            const dateA = a.createdAt && (a.createdAt as any).toDate 
              ? (a.createdAt as any).toDate() 
              : new Date(a.createdAt as Date || 0);
            const dateB = b.createdAt && (b.createdAt as any).toDate 
              ? (b.createdAt as any).toDate() 
              : new Date(b.createdAt as Date || 0);
            return dateB.getTime() - dateA.getTime();
          });
        } catch (error) {
          console.error('Erreur lors de la récupération des documents personnels:', error);
        }
        
        // Si on est dans le dossier "Documents Étudiants", afficher les documents personnels
        if (currentFolderId === STUDENTS_DOCUMENTS_FOLDER_ID) {
          setDocuments(personalDocsList);
          setFolders([]);
        } else {
          // Sinon, afficher les documents normaux
          setDocuments(docsList);
        }

        // Charger les dossiers
        // Note: Les dossiers sont également stockés dans la collection documents avec un type spécial
        // Pour simplifier, on peut créer une sous-collection folders ou utiliser un champ type
        // Ici, on va créer une collection séparée pour les dossiers
        const foldersRef = collection(db, 'structures', structureId, 'folders');
        let foldersSnapshot;
        try {
          const foldersQuery = query(
            foldersRef,
            where('parentFolderId', '==', currentFolderId),
            orderBy('createdAt', 'desc')
          );
          foldersSnapshot = await getDocs(foldersQuery);
        } catch (indexError: any) {
          // Si l'index n'est pas encore prêt, charger sans orderBy
          if (indexError?.code === 'failed-precondition') {
            console.warn('Index en cours de construction, chargement sans tri...');
            const foldersQuery = query(
              foldersRef,
              where('parentFolderId', '==', currentFolderId)
            );
            foldersSnapshot = await getDocs(foldersQuery);
            // Trier manuellement côté client après le chargement
            // On continuera avec la snapshot normale et on triera dans la boucle
          } else {
            throw indexError;
          }
        }

        const foldersList: Folder[] = [];
        for (const folderSnap of foldersSnapshot.docs) {
          const data = folderSnap.data();
          // Récupérer le nom de l'utilisateur
          let createdByName = '';
          try {
            const userDoc = await getDoc(doc(db, 'users', data.createdBy));
            const userData = userDoc.data();
            createdByName = userData?.displayName || userData?.firstName + ' ' + userData?.lastName || 'Inconnu';
          } catch (e) {
            console.error('Erreur lors de la récupération du nom utilisateur:', e);
          }

          foldersList.push({
            id: folderSnap.id,
            ...data,
            createdByName,
            createdAt: data.createdAt,
          } as Folder);
        }
        
        // Ajouter le dossier "Documents Étudiants" (uniquement à la racine et s'il y a des documents)
        if (currentFolderId === null && personalDocsList.length > 0) {
          foldersList.push({
            id: STUDENTS_DOCUMENTS_FOLDER_ID,
            name: 'Documents Étudiants',
            parentFolderId: null,
            createdBy: '',
            createdByName: '',
            createdAt: new Date(),
            structureId: structureId,
            isRestricted: false,
            isPersonalFolder: true,
          } as Folder);
        }
        
        // Si on est dans le dossier "Documents Étudiants", ne pas afficher les dossiers normaux
        if (currentFolderId === STUDENTS_DOCUMENTS_FOLDER_ID) {
          setFolders([]);
        } else {
          // Si l'index n'était pas disponible, trier manuellement
          if (foldersList.length > 0 && foldersList[0].createdAt) {
            foldersList.sort((a, b) => {
              const aDate = a.createdAt && (a.createdAt as any).toDate 
                ? (a.createdAt as any).toDate() 
                : new Date(a.createdAt as Date || 0);
              const bDate = b.createdAt && (b.createdAt as any).toDate 
                ? (b.createdAt as any).toDate() 
                : new Date(b.createdAt as Date || 0);
              return bDate.getTime() - aDate.getTime();
            });
          }
          
          setFolders(foldersList);
        }

        // Calculer la taille de chaque dossier
        const calculateFolderSizes = async () => {
          const sizes: { [folderId: string]: number } = {};
          
          for (const folder of foldersList) {
            try {
              let totalSize = 0;
              
              // Fonction récursive pour calculer la taille d'un dossier
              const calculateFolderSizeRecursive = async (folderId: string): Promise<number> => {
                let size = 0;
                
                // Documents directs dans ce dossier
                const docsRef = collection(db, 'structures', structureId, 'documents');
                let folderDocsSnapshot;
                try {
                  const folderDocsQuery = query(docsRef, where('parentFolderId', '==', folderId));
                  folderDocsSnapshot = await getDocs(folderDocsQuery);
                } catch {
                  const allDocsSnapshot = await getDocs(docsRef);
                  folderDocsSnapshot = {
                    docs: allDocsSnapshot.docs.filter(doc => {
                      const data = doc.data();
                      return data.parentFolderId === folderId && !data.missionId;
                    })
                  } as any;
                }
                
                folderDocsSnapshot.docs.forEach(doc => {
                  const data = doc.data();
                  if (data.size) {
                    size += data.size;
                  }
                });
                
                // Sous-dossiers
                const foldersRef = collection(db, 'structures', structureId, 'folders');
                let childFoldersSnapshot;
                try {
                  const childFoldersQuery = query(foldersRef, where('parentFolderId', '==', folderId));
                  childFoldersSnapshot = await getDocs(childFoldersQuery);
                } catch {
                  const allFoldersSnapshot = await getDocs(foldersRef);
                  childFoldersSnapshot = {
                    docs: allFoldersSnapshot.docs.filter(doc => {
                      const data = doc.data();
                      return data.parentFolderId === folderId;
                    })
                  } as any;
                }
                
                // Calculer récursivement la taille de chaque sous-dossier
                for (const subFolderDoc of childFoldersSnapshot.docs) {
                  const subFolderSize = await calculateFolderSizeRecursive(subFolderDoc.id);
                  size += subFolderSize;
                }
                
                return size;
              };
              
              totalSize = await calculateFolderSizeRecursive(folder.id);
              sizes[folder.id] = totalSize;
            } catch (error) {
              console.error(`Erreur lors du calcul de la taille du dossier ${folder.id}:`, error);
              sizes[folder.id] = 0;
            }
          }
          
          setFolderSizes(prev => ({ ...prev, ...sizes }));
        };
        
        // Calculer les tailles de manière asynchrone sans bloquer le chargement
        calculateFolderSizes();

        // Calculer la taille du dossier racine si on est à la racine
        if (currentFolderId === null) {
          const calculateRootSize = async () => {
            try {
              let totalSize = 0;
              
              // Documents à la racine (sans parentFolderId et sans missionId)
              const docsRef = collection(db, 'structures', structureId, 'documents');
              let docsSnapshot;
              try {
                const docsQuery = query(
                  docsRef,
                  where('parentFolderId', '==', null)
                );
                docsSnapshot = await getDocs(docsQuery);
              } catch {
                const allDocsSnapshot = await getDocs(docsRef);
                docsSnapshot = {
                  docs: allDocsSnapshot.docs.filter(doc => {
                    const data = doc.data();
                    return (data.parentFolderId === null || data.parentFolderId === undefined) && !data.missionId;
                  })
                } as any;
              }
              
              docsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.size) {
                  totalSize += data.size;
                }
              });
              
              // Taille de tous les dossiers à la racine (récursif)
              const foldersRef = collection(db, 'structures', structureId, 'folders');
              let rootFoldersSnapshot;
              try {
                const rootFoldersQuery = query(foldersRef, where('parentFolderId', '==', null));
                rootFoldersSnapshot = await getDocs(rootFoldersQuery);
              } catch {
                const allFoldersSnapshot = await getDocs(foldersRef);
                rootFoldersSnapshot = {
                  docs: allFoldersSnapshot.docs.filter(doc => {
                    const data = doc.data();
                    return data.parentFolderId === null || data.parentFolderId === undefined;
                  })
                } as any;
              }
              
              const calculateFolderSizeRecursive = async (folderId: string): Promise<number> => {
                let size = 0;
                
                const folderDocsQuery = query(docsRef, where('parentFolderId', '==', folderId));
                let folderDocsSnapshot;
                try {
                  folderDocsSnapshot = await getDocs(folderDocsQuery);
                } catch {
                  const allDocsSnapshot = await getDocs(docsRef);
                  folderDocsSnapshot = {
                    docs: allDocsSnapshot.docs.filter(doc => {
                      const data = doc.data();
                      return data.parentFolderId === folderId && !data.missionId;
                    })
                  } as any;
                }
                
                folderDocsSnapshot.docs.forEach(doc => {
                  const data = doc.data();
                  if (data.size) {
                    size += data.size;
                  }
                });
                
                const childFoldersQuery = query(foldersRef, where('parentFolderId', '==', folderId));
                let childFoldersSnapshot;
                try {
                  childFoldersSnapshot = await getDocs(childFoldersQuery);
                } catch {
                  const allFoldersSnapshot = await getDocs(foldersRef);
                  childFoldersSnapshot = {
                    docs: allFoldersSnapshot.docs.filter(doc => {
                      const data = doc.data();
                      return data.parentFolderId === folderId;
                    })
                  } as any;
                }
                
                for (const subFolderDoc of childFoldersSnapshot.docs) {
                  const subFolderSize = await calculateFolderSizeRecursive(subFolderDoc.id);
                  size += subFolderSize;
                }
                
                return size;
              };
              
              for (const folderDoc of rootFoldersSnapshot.docs) {
                const folderSize = await calculateFolderSizeRecursive(folderDoc.id);
                totalSize += folderSize;
              }
              
              setFolderSizes(prev => ({ ...prev, [null as any]: totalSize }));
            } catch (error) {
              console.error('Erreur lors du calcul de la taille du dossier racine:', error);
            }
          };
          
          calculateRootSize();
        }

        // Calculer la taille du dossier Missions
        const calculateMissionsSize = async () => {
          try {
            let totalSize = 0;
            
            // Documents avec missionId
            const docsRef = collection(db, 'structures', structureId, 'documents');
            let docsSnapshot;
            try {
              const docsQuery = query(docsRef, where('missionId', '!=', null));
              docsSnapshot = await getDocs(docsQuery);
            } catch {
              const allDocsSnapshot = await getDocs(docsRef);
              docsSnapshot = {
                docs: allDocsSnapshot.docs.filter(doc => {
                  const data = doc.data();
                  return data.missionId != null;
                })
              } as any;
            }
            
            docsSnapshot.docs.forEach(doc => {
              const data = doc.data();
              if (data.size) {
                totalSize += data.size;
              }
            });
            
            // Documents générés
            const generatedDocsRef = collection(db, 'generatedDocuments');
            const generatedDocsQuery = query(
              generatedDocsRef,
              where('structureId', '==', structureId)
            );
            const generatedDocsSnapshot = await getDocs(generatedDocsQuery);
            
            generatedDocsSnapshot.docs.forEach(doc => {
              const data = doc.data();
              if (data.fileSize) {
                totalSize += data.fileSize;
              }
            });
            
            setFolderSizes(prev => ({ ...prev, [MISSIONS_FOLDER_ID]: totalSize }));
          } catch (error) {
            console.error('Erreur lors du calcul de la taille du dossier Missions:', error);
          }
        };
        
        calculateMissionsSize();
      } catch (error: any) {
        console.error('Erreur lors du chargement des documents:', error);
        if (error?.code === 'failed-precondition' && error?.message?.includes('index')) {
          setSnackbar({
            open: true,
            message: 'Les index sont en cours de construction. Veuillez patienter quelques minutes et rafraîchir la page.',
            severity: 'warning',
          });
        } else {
          setSnackbar({
            open: true,
            message: 'Erreur lors du chargement des documents',
            severity: 'error',
          });
        }
      } finally {
        setLoading(false);
      }
  }, [structureId, currentUser, currentFolderId, currentMissionId, loadMissionDocuments]);

  // Charger les documents et dossiers
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Mettre à jour les breadcrumbs lors du changement de dossier
  const updateBreadcrumbs = (folderId: string | null, folderName: string) => {
    if (folderId === null) {
      setBreadcrumbs([{ id: null, name: 'Documents' }]);
      return;
    }

    // Pour simplifier, on reconstruit les breadcrumbs
    // Dans une vraie implémentation, on devrait charger la hiérarchie complète
    const newBreadcrumbs: BreadcrumbItem[] = [
      { id: null, name: 'Documents' },
      { id: folderId, name: folderName },
    ];
    setBreadcrumbs(newBreadcrumbs);
  };

  // Charger les missions de la structure
  const loadMissions = async () => {
    if (!structureId) return;

    try {
      const missionsRef = collection(db, 'missions');
      const missionsQuery = query(
        missionsRef,
        where('structureId', '==', structureId),
        orderBy('createdAt', 'desc')
      );
      
      let missionsSnapshot;
      try {
        missionsSnapshot = await getDocs(missionsQuery);
      } catch (error: any) {
        if (error?.code === 'failed-precondition') {
          // Si l'index n'est pas prêt, charger sans orderBy
          const missionsQueryNoOrder = query(
            missionsRef,
            where('structureId', '==', structureId)
          );
          missionsSnapshot = await getDocs(missionsQueryNoOrder);
        } else {
          throw error;
        }
      }

      const missionsList = missionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        folderColor: doc.data().folderColor || '#FF9500', // Couleur par défaut pour les missions
      }));

      // Trier manuellement si nécessaire
      missionsList.sort((a, b) => {
        const aDate = a.createdAt?.toDate?.() || new Date(0);
        const bDate = b.createdAt?.toDate?.() || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });

      setMissions(missionsList);

      // Calculer la taille de chaque mission
      const calculateMissionsSizes = async () => {
        const sizes: { [missionId: string]: number } = {};
        
        for (const mission of missionsList) {
          try {
            let totalSize = 0;
            
            // Documents depuis structures/{structureId}/documents
            const docsRef = collection(db, 'structures', structureId, 'documents');
            let docsSnapshot;
            try {
              const docsQuery = query(docsRef, where('missionId', '==', mission.id));
              docsSnapshot = await getDocs(docsQuery);
            } catch {
              const allDocsSnapshot = await getDocs(docsRef);
              docsSnapshot = {
                docs: allDocsSnapshot.docs.filter(doc => {
                  const data = doc.data();
                  return data.missionId === mission.id;
                })
              } as any;
            }
            
            docsSnapshot.docs.forEach(doc => {
              const data = doc.data();
              if (data.size) {
                totalSize += data.size;
              }
            });
            
            // Documents générés
            const generatedDocsRef = collection(db, 'generatedDocuments');
            const generatedDocsQuery = query(
              generatedDocsRef,
              where('missionId', '==', mission.id)
            );
            const generatedDocsSnapshot = await getDocs(generatedDocsQuery);
            
            generatedDocsSnapshot.docs.forEach(doc => {
              const data = doc.data();
              if (data.fileSize) {
                totalSize += data.fileSize;
              }
            });
            
            sizes[mission.id] = totalSize;
          } catch (error) {
            console.error(`Erreur lors du calcul de la taille de la mission ${mission.id}:`, error);
            sizes[mission.id] = 0;
          }
        }
        
        setFolderSizes(prev => ({ ...prev, ...sizes }));
      };
      
      calculateMissionsSizes();
    } catch (error) {
      console.error('Erreur lors du chargement des missions:', error);
    }
  };


  const handleFolderClick = (folder: Folder) => {
    if (!canAccessRestricted(folder)) {
      setSnackbar({
        open: true,
        message: 'Vous n\'avez pas accès à ce dossier',
        severity: 'error',
      });
      return;
    }
    
    // Réinitialiser les filtres lors du changement de dossier
    setDocumentTypeFilter('all');
    setStudentFilter('all');
    
    // Si c'est le dossier virtuel "Missions"
    if (folder.id === MISSIONS_FOLDER_ID) {
      setCurrentFolderId(MISSIONS_FOLDER_ID);
      setCurrentMissionId(null);
      updateBreadcrumbs(MISSIONS_FOLDER_ID, 'Missions');
      loadMissions();
      return;
    }
    
    // Si c'est le dossier "Documents Étudiants", charger les documents personnels
    if (folder.isPersonalFolder && folder.id === STUDENTS_DOCUMENTS_FOLDER_ID) {
      setCurrentFolderId(folder.id);
      setCurrentMissionId(null);
      updateBreadcrumbs(folder.id, folder.name);
      // Les documents seront chargés lors du prochain loadDocuments
      loadDocuments();
      return;
    }
    
    setCurrentFolderId(folder.id);
    setCurrentMissionId(null);
    updateBreadcrumbs(folder.id, folder.name);
  };

  // Gérer le clic sur une mission dans le dossier Missions
  const handleMissionClick = (mission: any) => {
    setCurrentMissionId(mission.id);
    setBreadcrumbs([
      { id: null, name: 'Documents' },
      { id: MISSIONS_FOLDER_ID, name: 'Missions' },
      { id: mission.id, name: `Mission ${mission.numeroMission || mission.id}` },
    ]);
    loadMissionDocuments(mission.id);
    
    // Calculer la taille de la mission
    const calculateMissionSize = async () => {
      if (!structureId || !mission.id) return;
      
      try {
        let totalSize = 0;
        
        // Documents depuis structures/{structureId}/documents
        const docsRef = collection(db, 'structures', structureId, 'documents');
        let docsSnapshot;
        try {
          const docsQuery = query(docsRef, where('missionId', '==', mission.id));
          docsSnapshot = await getDocs(docsQuery);
        } catch {
          const allDocsSnapshot = await getDocs(docsRef);
          docsSnapshot = {
            docs: allDocsSnapshot.docs.filter(doc => {
              const data = doc.data();
              return data.missionId === mission.id;
            })
          } as any;
        }
        
        docsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.size) {
            totalSize += data.size;
          }
        });
        
        // Documents générés
        const generatedDocsRef = collection(db, 'generatedDocuments');
        const generatedDocsQuery = query(
          generatedDocsRef,
          where('missionId', '==', mission.id)
        );
        const generatedDocsSnapshot = await getDocs(generatedDocsQuery);
        
        generatedDocsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.fileSize) {
            totalSize += data.fileSize;
          }
        });
        
        setFolderSizes(prev => ({ ...prev, [mission.id]: totalSize }));
      } catch (error) {
        console.error('Erreur lors du calcul de la taille de la mission:', error);
      }
    };
    
    calculateMissionSize();
  };

  const handleBreadcrumbClick = (item: BreadcrumbItem) => {
    // Réinitialiser les filtres lors du changement de dossier
    setDocumentTypeFilter('all');
    setStudentFilter('all');
    
    if (item.id === null) {
      setCurrentFolderId(null);
      setCurrentMissionId(null);
      setBreadcrumbs([{ id: null, name: 'Documents' }]);
    } else if (item.id === MISSIONS_FOLDER_ID) {
      setCurrentFolderId(MISSIONS_FOLDER_ID);
      setCurrentMissionId(null);
      setBreadcrumbs([
        { id: null, name: 'Documents' },
        { id: MISSIONS_FOLDER_ID, name: 'Missions' },
      ]);
      loadMissions();
    } else if (item.id === STUDENTS_DOCUMENTS_FOLDER_ID) {
      // C'est le dossier "Documents Étudiants"
      setCurrentFolderId(item.id);
      setCurrentMissionId(null);
      setBreadcrumbs([
        { id: null, name: 'Documents' },
        { id: item.id, name: 'Documents Étudiants' },
      ]);
      loadDocuments();
    } else {
      // Vérifier si c'est une mission
      const mission = missions.find(m => m.id === item.id);
      if (mission) {
        handleMissionClick(mission);
      } else {
        setCurrentFolderId(item.id);
        setCurrentMissionId(null);
      updateBreadcrumbs(item.id, item.name);
      }
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !structureId || !currentUser) {
      setSnackbar({
        open: true,
        message: 'Veuillez entrer un nom de dossier',
        severity: 'error',
      });
      return;
    }

    try {
      const folderData: Omit<Folder, 'id'> = {
        name: newFolderName.trim(),
        parentFolderId: currentFolderId,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp() as any,
        structureId,
        isRestricted: false,
      };

      await addDoc(
        collection(db, 'structures', structureId, 'folders'),
        folderData
      );

      setNewFolderName('');
      setCreateFolderDialogOpen(false);
      setSnackbar({
        open: true,
        message: 'Dossier créé avec succès',
        severity: 'success',
      });

      // Recharger les dossiers
      const foldersRef = collection(db, 'structures', structureId, 'folders');
      const foldersQuery = query(
        foldersRef,
        where('parentFolderId', '==', currentFolderId),
        orderBy('createdAt', 'desc')
      );
      const foldersSnapshot = await getDocs(foldersQuery);
      const foldersList: Folder[] = foldersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt,
      } as Folder));
      setFolders(foldersList);
    } catch (error: any) {
      console.error('Erreur lors de la création du dossier:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la création du dossier',
        severity: 'error',
      });
    }
  };

  const handleDocumentOpen = async (document: Document) => {
    if (!canAccessRestricted(document)) {
      setSnackbar({
        open: true,
        message: 'Vous n\'avez pas accès à ce document',
        severity: 'error',
      });
      return;
    }

    // Pour les documents personnels, obtenir une URL signée avec authentification
    if (document.isPersonalDocument && document.storagePath) {
      // Déclarer storagePath avant le try pour qu'il soit accessible dans le catch
      let storagePath = document.storagePath;
      let documentOpenedSuccessfully = false;
      
      try {
        setLoading(true);
        
        // Extraire le chemin depuis l'URL si nécessaire
        if (storagePath && storagePath.startsWith('http')) {
          // Si c'est une URL, extraire le chemin
          try {
            const urlObj = new URL(storagePath);
            const pathStartIndex = urlObj.pathname.indexOf('/o/') + 3;
            if (pathStartIndex > 2) {
              const encodedPath = urlObj.pathname.substring(pathStartIndex);
              // Extraire le chemin avant le '?' (qui contient les paramètres)
              const pathWithoutParams = encodedPath.split('?')[0];
              storagePath = decodeURIComponent(pathWithoutParams.replace(/%2F/g, '/'));
            }
          } catch (e) {
            console.error('Erreur lors de l\'extraction du chemin:', e);
          }
        }
        
        if (!storagePath) {
          console.error('Impossible d\'extraire le chemin du document:', document);
          setSnackbar({
            open: true,
            message: 'Impossible d\'accéder à ce document',
            severity: 'error',
          });
          return;
        }
        
        console.log('[Documents] Tentative d\'accès au document:', {
          storagePath,
          documentName: document.name,
          isPersonalDocument: document.isPersonalDocument,
          userId: currentUser?.uid,
          userStatus: userData?.status,
          userRole: userData?.role,
          userStructureId: userData?.structureId
        });
        
        // Vérifier les permissions côté client avant d'appeler getDownloadURL
        // Si l'utilisateur est admin/membre avec structureId, il devrait pouvoir accéder
        const canAccess = userData?.status === 'admin' || 
                          userData?.status === 'admin_structure' || 
                          userData?.status === 'member' || 
                          userData?.status === 'membre' ||
                          userData?.status === 'superadmin' ||
                          userData?.role === 'admin' ||
                          userData?.role === 'admin_structure' ||
                          userData?.role === 'member' ||
                          userData?.role === 'membre' ||
                          userData?.role === 'superadmin';
        
        if (!canAccess && currentUser?.uid !== document.uploadedBy) {
          setSnackbar({
            open: true,
            message: 'Vous n\'avez pas les permissions nécessaires pour accéder à ce document',
            severity: 'error',
          });
          return;
        }
        
        // Forcer la régénération du token pour s'assurer qu'il a les bonnes permissions
        const auth = getAuth();
        const firebaseUser = auth.currentUser;
        if (firebaseUser) {
          await firebaseUser.getIdToken(true); // Force token refresh
        }
        
        // Utiliser la même logique que DocumentsTab : utiliser decryptFile
        // Cela fonctionne pour les fichiers chiffrés et non chiffrés
        setLoading(true);
        setPreviewError(null);
        
        try {
          // Obtenir le token d'authentification
          const auth = getAuth();
          const firebaseUser = auth.currentUser;
          if (!firebaseUser) {
            throw new Error('Utilisateur non authentifié');
          }
          const token = await firebaseUser.getIdToken(true); // Force refresh du token
          
          // Utiliser decryptFile (fonctionne même pour les fichiers non chiffrés)
          const axios = (await import('axios')).default;
          const response = await axios.get(
            `https://us-central1-jsaas-dd2f7.cloudfunctions.net/decryptFile`,
            {
              params: { filePath: storagePath },
              headers: {
                'Authorization': `Bearer ${token}`
              },
              responseType: 'blob',
              timeout: 60000 // 60 secondes
            }
          );
          
          // Créer le blob et l'URL blob
          let dataToBlob: BlobPart;
          if (response.data instanceof Blob) {
            dataToBlob = response.data;
          } else if (response.data instanceof ArrayBuffer) {
            dataToBlob = response.data;
          } else {
            dataToBlob = new Uint8Array(response.data as any);
          }
          
          const contentType = response.headers['content-type'] || response.headers['Content-Type'] || 'application/pdf';
          const blob = new Blob([dataToBlob], { type: contentType });
          
          // Vérifier que le blob n'est pas vide
          if (blob.size === 0) {
            throw new Error('Le document est vide');
          }
          
          const blobUrl = URL.createObjectURL(blob);
          
          // Créer un document avec l'URL blob
          const documentWithBlobUrl = {
            ...document,
            url: blobUrl,
            blobUrl: blobUrl // Conserver l'URL blob pour le nettoyage
          };
          
          setPreviewDocument(documentWithBlobUrl);
          setPreviewDialogOpen(true);
          setLoading(false);
          documentOpenedSuccessfully = true;
          
          if (currentUser) {
            trackUserActivity(currentUser.uid, 'document', {
              id: document.id,
              title: document.name,
              subtitle: 'Documents',
              url: blobUrl
            });
          }
          // Retourner immédiatement après succès pour éviter que le catch principal s'exécute
          return;
        } catch (error: any) {
          console.error('[Documents] Erreur lors de la récupération du document:', {
            error,
            code: error?.code,
            message: error?.message,
            status: error?.response?.status,
            storagePath: storagePath || document.storagePath,
            documentName: document.name,
            userId: currentUser?.uid,
            userStatus: userData?.status,
            userRole: userData?.role,
            userStructureId: userData?.structureId
          });
          
          setLoading(false);
          
          // Gérer les erreurs spécifiques
          if (error?.response?.status === 403) {
            const errorMsg = error?.response?.data?.error || 'Accès refusé';
            if (errorMsg.includes('2FA')) {
              setSnackbar({
                open: true,
                message: 'Ce document est chiffré. Veuillez activer l\'authentification à deux facteurs (2FA) pour y accéder.',
                severity: 'warning',
              });
            } else {
              setSnackbar({
                open: true,
                message: 'Le document n\'est plus disponible ou a été supprimé',
                severity: 'error',
              });
            }
          } else if (error?.response?.status === 404) {
            setSnackbar({
              open: true,
              message: 'Le document n\'est plus disponible ou a été supprimé',
              severity: 'error',
            });
          } else {
            setSnackbar({
              open: true,
              message: error?.message?.includes('vide') || error?.message?.includes('supprimé')
                ? 'Le document n\'est plus disponible ou a été supprimé'
                : `Erreur lors de l'ouverture du document: ${error?.message || 'Erreur inconnue'}`,
              severity: 'error',
            });
          }
        }
        } catch (error: any) {
          // Ne pas afficher d'erreur si le document s'est déjà ouvert avec succès
          if (documentOpenedSuccessfully) {
            return;
          }
          
          console.error('[Documents] Erreur lors de la récupération de l\'URL du document:', {
            error,
            code: error?.code,
            message: error?.message,
            storagePath: storagePath || document.storagePath,
            documentName: document.name,
            userId: currentUser?.uid,
            userStatus: userData?.status,
            userRole: userData?.role,
            userStructureId: userData?.structureId
          });
          
          // Si l'erreur est 403, ne pas utiliser l'URL directe car elle ne fonctionnera probablement pas
          // Afficher directement le message d'erreur
          setLoading(false);
          
          setSnackbar({
            open: true,
            message: error?.code === 'storage/unauthorized' || error?.response?.status === 403
              ? 'Le document n\'est plus disponible ou a été supprimé' 
              : 'Erreur lors de l\'ouverture du document',
            severity: 'error',
          });
        } finally {
          setLoading(false);
        }
      return;
    }

    // Pour les autres documents, vérifier l'URL avant de l'afficher
    if (document.url) {
      // Vérifier que l'URL est accessible (sauf si c'est déjà une URL signée)
      // Les URLs Firebase Storage signées contiennent généralement un token
      const isSignedUrl = document.url.includes('token=') || document.url.includes('alt=media');
      
      if (!isSignedUrl) {
        // Si l'URL n'est pas signée, essayer d'obtenir une URL signée
        try {
          // Extraire le chemin depuis l'URL si possible
          let storagePath = document.storagePath || document.url;
          if (storagePath.startsWith('http')) {
            try {
              const urlObj = new URL(storagePath);
              const pathStartIndex = urlObj.pathname.indexOf('/o/') + 3;
              if (pathStartIndex > 2) {
                const encodedPath = urlObj.pathname.substring(pathStartIndex);
                const pathWithoutParams = encodedPath.split('?')[0];
                storagePath = decodeURIComponent(pathWithoutParams.replace(/%2F/g, '/'));
              }
            } catch (e) {
              console.warn('Impossible d\'extraire le chemin depuis l\'URL:', e);
            }
          }
          
          // Essayer d'obtenir une URL signée
          if (storagePath && !storagePath.startsWith('http')) {
            const auth = getAuth();
            const firebaseUser = auth.currentUser;
            if (firebaseUser) {
              await firebaseUser.getIdToken(true);
            }
            const storageRef = ref(storage, storagePath);
            const downloadURL = await getDownloadURL(storageRef);
            document = { ...document, url: downloadURL };
          }
        } catch (urlError: any) {
          // Si on ne peut pas obtenir une URL signée, vérifier l'URL originale
          try {
            const response = await fetch(document.url, { method: 'HEAD' });
            if (!response.ok && response.status === 403) {
              setSnackbar({
                open: true,
                message: 'Le document n\'est plus disponible ou a été supprimé',
                severity: 'error',
              });
              return;
            }
          } catch (fetchError: any) {
            // Si la vérification échoue, on continue quand même (peut être un problème CORS)
            console.warn('Impossible de vérifier l\'URL du document:', fetchError);
          }
        }
      }
    }

    if (currentUser) {
      trackUserActivity(currentUser.uid, 'document', {
        id: document.id,
        title: document.name,
        subtitle: 'Documents',
        url: document.url
      });
    }

    setPreviewDocument(document);
    setPreviewError(null);
    setPreviewDialogOpen(true);
  };

  const handleDocumentDownload = async (doc: Document) => {
    if (!canAccessRestricted(doc)) {
      setSnackbar({
        open: true,
        message: 'Vous n\'avez pas accès à ce document',
        severity: 'error',
      });
      return;
    }

    try {
      let downloadUrl = doc.url;
      
      // Pour les documents personnels, obtenir une URL signée avec authentification
      if (doc.isPersonalDocument && doc.storagePath) {
        try {
          // Extraire le chemin depuis l'URL si nécessaire
          let storagePath = doc.storagePath;
          if (storagePath && storagePath.startsWith('http')) {
            // Si c'est une URL, extraire le chemin
            try {
              const urlObj = new URL(storagePath);
              const pathStartIndex = urlObj.pathname.indexOf('/o/') + 3;
              if (pathStartIndex > 2) {
                const encodedPath = urlObj.pathname.substring(pathStartIndex);
                // Extraire le chemin avant le '?' (qui contient les paramètres)
                const pathWithoutParams = encodedPath.split('?')[0];
                storagePath = decodeURIComponent(pathWithoutParams.replace(/%2F/g, '/'));
              }
            } catch (e) {
              console.error('Erreur lors de l\'extraction du chemin:', e);
            }
          }
          
          if (!storagePath) {
            console.error('Impossible d\'extraire le chemin du document:', doc);
            setSnackbar({
              open: true,
              message: 'Impossible d\'accéder à ce document',
              severity: 'error',
            });
            return;
          }
          
          // Forcer la régénération du token pour s'assurer qu'il a les bonnes permissions
          const auth = getAuth();
          const firebaseUser = auth.currentUser;
          if (firebaseUser) {
            await firebaseUser.getIdToken(true); // Force token refresh
          }
          
          const storageRef = ref(storage, storagePath);
          downloadUrl = await getDownloadURL(storageRef);
        } catch (error: any) {
          console.error('Erreur lors de la récupération de l\'URL du document:', error);
          setSnackbar({
            open: true,
            message: error?.code === 'storage/unauthorized' || error?.response?.status === 403
              ? 'Le document n\'est plus disponible ou a été supprimé' 
              : 'Erreur lors du téléchargement',
            severity: 'error',
          });
          return;
        }
      }
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      console.error('Erreur lors du téléchargement:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors du téléchargement',
        severity: 'error',
      });
    }
  };

  const handleDeleteClick = (type: 'document' | 'folder', item: Document | Folder) => {
    setItemToDelete({ type, item });
    setDeleteDialogOpen(true);
  };

  const handleRenameClick = (type: 'document' | 'folder', item: Document | Folder) => {
    setItemToRename({ type, item });
    setNewItemName(item.name);
    setRenameDialogOpen(true);
  };

  const handlePinToggle = async (document: Document) => {
    if (!structureId || !currentUser) return;
    
    try {
      const newPinnedState = !document.isPinned;
      
      // Vérifier si le document vient de generatedDocuments ou de structures/documents
      // Les documents de generatedDocuments ont généralement un missionId et pas de parentFolderId
      // ou on peut vérifier s'ils existent dans generatedDocuments
      let isGeneratedDocument = false;
      try {
        const generatedDocRef = doc(db, 'generatedDocuments', document.id);
        const generatedDocSnap = await getDoc(generatedDocRef);
        isGeneratedDocument = generatedDocSnap.exists();
      } catch (e) {
        // Si l'erreur n'est pas liée à l'existence, continuer
        console.log('Vérification generatedDocuments:', e);
      }
      
      if (isGeneratedDocument) {
        // Document dans generatedDocuments
        const generatedDocRef = doc(db, 'generatedDocuments', document.id);
        await updateDoc(generatedDocRef, {
          isPinned: newPinnedState,
          updatedAt: serverTimestamp()
        });
        
        // Mettre à jour l'état local pour les documents de mission
        setMissionsFolderDocuments(prev => prev.map(doc => 
          doc.id === document.id ? { ...doc, isPinned: newPinnedState } : doc
        ));
      } else {
        // Document dans structures/{structureId}/documents
        const docRef = doc(db, 'structures', structureId, 'documents', document.id);
        await updateDoc(docRef, {
          isPinned: newPinnedState,
          updatedAt: serverTimestamp()
        });
        
        // Mettre à jour l'état local
        setDocuments(prev => prev.map(doc => 
          doc.id === document.id ? { ...doc, isPinned: newPinnedState } : doc
        ));
      }
      
      setSnackbar({
        open: true,
        message: newPinnedState ? 'Document épinglé' : 'Document désépinglé',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de l\'épinglage du document:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de l\'épinglage du document',
        severity: 'error'
      });
    }
  };

  const handlePropertiesClick = async (type: 'document' | 'folder', item: Document | Folder) => {
    setItemProperties({ type, item });
    
    if (type === 'folder') {
      const folder = item as Folder;
      
      // Charger la couleur depuis Firestore si c'est un dossier virtuel ou une mission
      if (folder.id === MISSIONS_FOLDER_ID) {
        try {
          const folderColorRef = doc(db, 'structures', structureId, 'folderColors', MISSIONS_FOLDER_FIRESTORE_ID);
          const folderColorDoc = await getDoc(folderColorRef);
          const color = folderColorDoc.exists() ? folderColorDoc.data().color : '#FF9500';
          setSelectedColor(color);
          // Mettre à jour l'item avec la couleur chargée
          setItemProperties({ type, item: { ...folder, color } });
        } catch (error) {
          setSelectedColor('#FF9500');
        }
      } else if (folder.parentFolderId === MISSIONS_FOLDER_ID) {
        // C'est une mission, charger depuis le document de la mission
        try {
          const missionRef = doc(db, 'missions', folder.id);
          const missionDoc = await getDoc(missionRef);
          const color = missionDoc.exists() && missionDoc.data().folderColor 
            ? missionDoc.data().folderColor 
            : '#FF9500';
          setSelectedColor(color);
          // Mettre à jour l'item avec la couleur chargée
          setItemProperties({ type, item: { ...folder, color } });
        } catch (error) {
          setSelectedColor('#FF9500');
        }
      } else {
        setSelectedColor(folder.color || '#007AFF');
      }
      
      // Calculer la taille totale du dossier (somme des documents qu'il contient)
      if (structureId) {
        try {
          let totalSize = 0;
          
          // Si c'est le dossier virtuel "Missions", calculer la taille de tous les documents de toutes les missions
          if (folder.id === MISSIONS_FOLDER_ID) {
            // 1. Récupérer tous les documents avec missionId (depuis structures/{structureId}/documents)
            const docsRef = collection(db, 'structures', structureId, 'documents');
            const docsQuery = query(docsRef, where('missionId', '!=', null));
            const docsSnapshot = await getDocs(docsQuery);
            
            docsSnapshot.docs.forEach(doc => {
              const data = doc.data();
              totalSize += data.size || 0;
            });
            
            // 2. Récupérer tous les documents générés (depuis generatedDocuments)
            const generatedDocsRef = collection(db, 'generatedDocuments');
            const generatedDocsQuery = query(
              generatedDocsRef,
              where('structureId', '==', structureId)
            );
            const generatedDocsSnapshot = await getDocs(generatedDocsQuery);
            
            generatedDocsSnapshot.docs.forEach(doc => {
              const data = doc.data();
              totalSize += data.size || 0;
            });
          } else {
            // Pour un dossier normal, chercher les documents avec parentFolderId
            const docsRef = collection(db, 'structures', structureId, 'documents');
            let docsSnapshot;
            try {
              const docsQuery = query(docsRef, where('parentFolderId', '==', folder.id));
              docsSnapshot = await getDocs(docsQuery);
            } catch (error: any) {
              console.warn('Erreur lors de la récupération des documents pour la taille:', error);
              // Si l'index n'existe pas, charger tous les documents et filtrer
              const allDocsQuery = query(docsRef);
              const allDocsSnapshot = await getDocs(allDocsQuery);
              docsSnapshot = {
                docs: allDocsSnapshot.docs.filter(doc => {
                  const data = doc.data();
                  return data.parentFolderId === folder.id && !data.missionId;
                })
              } as any;
            }
            
            // Ajouter la taille des documents dans Firestore
            docsSnapshot.docs.forEach(doc => {
              const data = doc.data();
              if (data.size) {
                totalSize += data.size;
              }
            });
            
            // Récupérer récursivement les sous-dossiers et leurs documents
            const foldersRef = collection(db, 'structures', structureId, 'folders');
            const subFoldersQuery = query(foldersRef, where('parentFolderId', '==', folder.id));
            let subFoldersSnapshot;
            try {
              subFoldersSnapshot = await getDocs(subFoldersQuery);
            } catch (error: any) {
              // Si l'index n'existe pas, charger tous les dossiers et filtrer
              const allFoldersQuery = query(foldersRef);
              const allFoldersSnapshot = await getDocs(allFoldersQuery);
              subFoldersSnapshot = {
                docs: allFoldersSnapshot.docs.filter(doc => {
                  const data = doc.data();
                  return data.parentFolderId === folder.id;
                })
              } as any;
            }
            
            // Fonction récursive pour calculer la taille d'un dossier
            const calculateFolderSizeRecursive = async (folderId: string): Promise<number> => {
              let size = 0;
              
              // Documents directs dans ce dossier
              const folderDocsQuery = query(docsRef, where('parentFolderId', '==', folderId));
              let folderDocsSnapshot;
              try {
                folderDocsSnapshot = await getDocs(folderDocsQuery);
              } catch {
                const allDocsSnapshot = await getDocs(docsRef);
                folderDocsSnapshot = {
                  docs: allDocsSnapshot.docs.filter(doc => {
                    const data = doc.data();
                    return data.parentFolderId === folderId && !data.missionId;
                  })
                } as any;
              }
              
              folderDocsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.size) {
                  size += data.size;
                }
              });
              
              // Sous-dossiers
              const childFoldersQuery = query(foldersRef, where('parentFolderId', '==', folderId));
              let childFoldersSnapshot;
              try {
                childFoldersSnapshot = await getDocs(childFoldersQuery);
              } catch {
                const allFoldersSnapshot = await getDocs(foldersRef);
                childFoldersSnapshot = {
                  docs: allFoldersSnapshot.docs.filter(doc => {
                    const data = doc.data();
                    return data.parentFolderId === folderId;
                  })
                } as any;
              }
              
              // Calculer récursivement la taille de chaque sous-dossier
              for (const subFolderDoc of childFoldersSnapshot.docs) {
                const subFolderSize = await calculateFolderSizeRecursive(subFolderDoc.id);
                size += subFolderSize;
              }
              
              return size;
            };
            
            // Calculer récursivement la taille des sous-dossiers
            for (const subFolderDoc of subFoldersSnapshot.docs) {
              const subFolderSize = await calculateFolderSizeRecursive(subFolderDoc.id);
              totalSize += subFolderSize;
            }
            
            // Si Storage est disponible, aussi compter les fichiers orphelins dans ce dossier
            // Note: Pour les fichiers orphelins, on ne peut pas savoir à quel dossier ils appartiennent
            // car ils n'ont pas de parentFolderId dans Firestore. On les compte donc tous dans le dossier racine.
            if (storage && folder.id === null) {
              try {
                const storageRef = ref(storage, `structures/${structureId}/documents`);
                const storageList = await listAll(storageRef);
                
                // Créer un Set des chemins de storage des documents déjà comptés dans Firestore
                const allDocsRef = collection(db, 'structures', structureId, 'documents');
                const allDocsSnapshot = await getDocs(allDocsRef);
                const countedPaths = new Set(
                  allDocsSnapshot.docs.map(doc => doc.data().storagePath).filter(Boolean)
                );
                
                // Ajouter la taille des fichiers orphelins (pas dans Firestore)
                for (const itemRef of storageList.items) {
                  const fullPath = itemRef.fullPath;
                  
                  if (!countedPaths.has(fullPath)) {
                    try {
                      const metadata = await getMetadata(itemRef);
                      totalSize += metadata.size || 0;
                    } catch (error) {
                      console.warn(`Erreur lors de la récupération des métadonnées pour ${itemRef.name}:`, error);
                    }
                  }
                }
              } catch (storageError: any) {
                console.warn('Erreur lors de la vérification Storage pour la taille du dossier:', storageError);
              }
            }
          }
          
          setFolderSize(totalSize);
        } catch (error) {
          console.error('Erreur lors du calcul de la taille du dossier:', error);
          setFolderSize(0);
        }
      }
    }
    
    setPropertiesDialogOpen(true);
  };

  const handleColorChange = async (color: string) => {
    if (!itemProperties || itemProperties.type !== 'folder' || !structureId) return;
    
    const folder = itemProperties.item as Folder;
    
    try {
      // Cas 1: Dossier virtuel "Missions"
      if (folder.id === MISSIONS_FOLDER_ID) {
        const folderColorRef = doc(db, 'structures', structureId, 'folderColors', MISSIONS_FOLDER_FIRESTORE_ID);
        await setDoc(folderColorRef, {
          color,
          updatedAt: serverTimestamp() as any,
        }, { merge: true });
        
        // Mettre à jour localement
        setSavedFolderColors(prev => ({ ...prev, [MISSIONS_FOLDER_ID]: color }));
        setItemProperties({ ...itemProperties, item: { ...folder, color } });
        setSelectedColor(color);
        
        setSnackbar({
          open: true,
          message: 'Couleur du dossier mise à jour',
          severity: 'success',
        });
        return;
      }
      
      // Cas 2: Mission individuelle (parentFolderId === MISSIONS_FOLDER_ID)
      if (folder.parentFolderId === MISSIONS_FOLDER_ID) {
        const missionRef = doc(db, 'missions', folder.id);
        
        // Vérifier que la mission existe
        const missionDoc = await getDoc(missionRef);
        if (!missionDoc.exists()) {
          setSnackbar({
            open: true,
            message: 'Cette mission n\'existe pas dans la base de données',
            severity: 'error',
          });
          return;
        }
        
        await updateDoc(missionRef, {
          folderColor: color,
          updatedAt: serverTimestamp() as any,
        });
        
        // Mettre à jour localement dans la liste des missions
        setMissions(prev => prev.map(m => 
          m.id === folder.id ? { ...m, folderColor: color } : m
        ));
        
        setItemProperties({ ...itemProperties, item: { ...folder, color } });
        setSelectedColor(color);
        
        setSnackbar({
          open: true,
          message: 'Couleur du dossier mise à jour',
          severity: 'success',
        });
        return;
      }
      
      // Cas 3: Dossier normal
      const folderRef = doc(db, 'structures', structureId, 'folders', folder.id);
      
      // Vérifier que le document existe avant de le mettre à jour
      const folderDoc = await getDoc(folderRef);
      if (!folderDoc.exists()) {
        setSnackbar({
          open: true,
          message: 'Ce dossier n\'existe pas dans la base de données',
          severity: 'error',
        });
        return;
      }
      
      await updateDoc(folderRef, {
        color,
        updatedAt: serverTimestamp() as any,
      });
      
      // Mettre à jour localement
      setFolders(prev => prev.map(f => 
        f.id === folder.id ? { ...f, color } : f
      ));
      
      setItemProperties({ ...itemProperties, item: { ...folder, color } });
      setSelectedColor(color);
      
      setSnackbar({
        open: true,
        message: 'Couleur du dossier mise à jour',
        severity: 'success',
      });
    } catch (error: any) {
      console.error('Erreur lors du changement de couleur:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors du changement de couleur',
        severity: 'error',
      });
    }
  };

  const handleRenameConfirm = async () => {
    if (!itemToRename || !newItemName.trim() || !structureId) return;

    try {
      if (itemToRename.type === 'document') {
        const docToRename = itemToRename.item as Document;
        const docRef = doc(db, 'structures', structureId, 'documents', docToRename.id);
        await updateDoc(docRef, {
          name: newItemName.trim(),
          updatedAt: serverTimestamp() as any,
        });
        
        // Mettre à jour localement
        setDocuments(prev => prev.map(d => 
          d.id === docToRename.id 
            ? { ...d, name: newItemName.trim() }
            : d
        ));

        // Mettre à jour dans les documents de mission si nécessaire
        if (docToRename.missionId && missionDocuments[docToRename.missionId]) {
          setMissionDocuments(prev => ({
            ...prev,
            [docToRename.missionId!]: {
              ...prev[docToRename.missionId!],
              documents: prev[docToRename.missionId!].documents.map(d => 
                d.id === docToRename.id 
                  ? { ...d, name: newItemName.trim() }
                  : d
              ),
            },
          }));
        }

        setSnackbar({
          open: true,
          message: 'Document renommé avec succès',
          severity: 'success',
        });
      } else {
        const folderToRename = itemToRename.item as Folder;
        const folderRef = doc(db, 'structures', structureId, 'folders', folderToRename.id);
        await updateDoc(folderRef, {
          name: newItemName.trim(),
          updatedAt: serverTimestamp() as any,
        });
        
        // Mettre à jour localement
        setFolders(prev => prev.map(f => 
          f.id === folderToRename.id 
            ? { ...f, name: newItemName.trim() }
            : f
        ));

        // Mettre à jour les breadcrumbs si nécessaire
        setBreadcrumbs(prev => prev.map(b => 
          b.id === folderToRename.id 
            ? { ...b, name: newItemName.trim() }
            : b
        ));

        setSnackbar({
          open: true,
          message: 'Dossier renommé avec succès',
          severity: 'success',
        });
      }

      setRenameDialogOpen(false);
      setItemToRename(null);
      setNewItemName('');
    } catch (error: any) {
      console.error('Erreur lors du renommage:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors du renommage',
        severity: 'error',
      });
    }
  };

  // Drag and Drop Logic
  const handleDragStart = (e: React.DragEvent, type: 'document' | 'folder', item: Document | Folder) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type, id: item.id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetFolder: Folder) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;

    const { type, id } = JSON.parse(data);
    if (!structureId || !id) return;

    // Empêcher de déplacer un dossier dans lui-même ou dans un dossier spécial
    if (type === 'folder' && (id === targetFolder.id || targetFolder.id === MISSIONS_FOLDER_ID)) return;
    
    // Empêcher de déplacer quoi que ce soit DANS le dossier "Missions" racine (sauf si logique spécifique ajoutée)
    // Mais on peut autoriser le drop sur une Mission spécifique (qui agit comme un dossier)
    const isMissionFolder = targetFolder.parentFolderId === MISSIONS_FOLDER_ID;
    
    try {
      if (type === 'document') {
        const docRef = doc(db, 'structures', structureId, 'documents', id);
        
        // Si la cible est une mission, on met à jour missionId
        if (isMissionFolder) {
           await updateDoc(docRef, {
            missionId: targetFolder.id,
            missionNumber: (targetFolder as any).numeroMission || '', // Suppose folder has extra data or we fetch it
            parentFolderId: null, // Reset parent folder as it's now attached to a mission
            updatedAt: serverTimestamp() as any,
          });
          // Note: Updating local state for mission move is complex, reload might be easier or update properly
          // For now, let's just handle regular folder move
        } else {
          // Déplacement vers un dossier normal
          await updateDoc(docRef, {
            parentFolderId: targetFolder.id,
            missionId: null, // Detach from mission if moving to regular folder
            updatedAt: serverTimestamp() as any,
          });
        }

        // Mise à jour locale (retirer de la vue actuelle)
        setDocuments(prev => prev.filter(d => d.id !== id));
        
        setSnackbar({
          open: true,
          message: 'Document déplacé avec succès',
          severity: 'success',
        });
      } else if (type === 'folder') {
        // Déplacement de dossier (seulement vers un autre dossier normal)
        if (isMissionFolder) {
           setSnackbar({
            open: true,
            message: 'Impossible de déplacer un dossier dans une mission',
            severity: 'warning',
          });
          return;
        }

        const folderRef = doc(db, 'structures', structureId, 'folders', id);
        await updateDoc(folderRef, {
          parentFolderId: targetFolder.id,
          updatedAt: serverTimestamp() as any,
        });

        // Mise à jour locale
        setFolders(prev => prev.filter(f => f.id !== id));

        setSnackbar({
          open: true,
          message: 'Dossier déplacé avec succès',
          severity: 'success',
        });
      }
    } catch (error) {
      console.error('Erreur lors du déplacement:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors du déplacement',
        severity: 'error',
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete || !structureId) return;

    try {
      if (itemToDelete.type === 'document') {
        const docToDelete = itemToDelete.item as Document;
        
        // Vérifier si c'est un document personnel (créé dynamiquement depuis le profil utilisateur)
        const isPersonalDoc = docToDelete.id.startsWith('profile_') || docToDelete.isPersonalDocument;
        
        if (isPersonalDoc && docToDelete.uploadedBy) {
          // C'est un document personnel, il faut supprimer la référence dans le profil utilisateur
          const userId = docToDelete.uploadedBy;
          const userRef = doc(db, 'users', userId);
          
          try {
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
              const userData = userDoc.data();
              const updates: any = {};
              
              // Identifier quel champ supprimer en fonction du nom du document et du storagePath
              const docName = docToDelete.name.toLowerCase();
              const storagePath = (docToDelete.storagePath || '').toLowerCase();
              
              // Vérifier d'abord le storagePath qui est plus fiable
              if (storagePath.includes('schoolcertificate') || docName.includes('certificat de scolarité') || docName.includes('schoolcertificate')) {
                updates.schoolCertificateUrl = null;
              } else if (storagePath.includes('healthcard') || docName.includes('carte vitale') || docName.includes('healthcard')) {
                updates.healthCardUrl = null;
              } else if (storagePath.includes('cv') || (docName.includes('cv') && !docName.includes('carte vitale'))) {
                updates.cvUrl = null;
              } else if (storagePath.includes('identitycard') || docName.includes('carte d\'identité') || docName.includes('identitycard')) {
                if (storagePath.includes('recto') || docName.includes('recto')) {
                  updates.identityCardRectoUrl = null;
                } else if (storagePath.includes('verso') || docName.includes('verso')) {
                  updates.identityCardVersoUrl = null;
                } else {
                  updates.identityCardUrl = null;
                }
              } else if (storagePath.includes('rib') || docName.includes('rib')) {
                updates.ribUrl = null;
              } else {
                // Si on ne peut pas identifier le type, essayer de supprimer tous les champs possibles
                // en vérifiant si l'URL correspond
                const docUrl = docToDelete.url || '';
                if (userData.schoolCertificateUrl === docUrl) {
                  updates.schoolCertificateUrl = null;
                } else if (userData.healthCardUrl === docUrl) {
                  updates.healthCardUrl = null;
                } else if (userData.cvUrl === docUrl) {
                  updates.cvUrl = null;
                } else if (userData.identityCardUrl === docUrl) {
                  updates.identityCardUrl = null;
                } else if (userData.identityCardRectoUrl === docUrl) {
                  updates.identityCardRectoUrl = null;
                } else if (userData.identityCardVersoUrl === docUrl) {
                  updates.identityCardVersoUrl = null;
                } else if (userData.ribUrl === docUrl) {
                  updates.ribUrl = null;
                }
              }
              
              // Mettre à jour le profil utilisateur
              if (Object.keys(updates).length > 0) {
                await updateDoc(userRef, updates);
                console.log('Référence du document personnel supprimée du profil utilisateur');
              }
            }
          } catch (userError: any) {
            console.warn('Erreur lors de la suppression de la référence dans le profil utilisateur:', userError);
          }
        }
        
        // Essayer de supprimer le fichier du Storage, mais continuer même si ça échoue
        if (docToDelete.storagePath) {
          try {
            await deleteFile(docToDelete.storagePath);
          } catch (storageError: any) {
            // Ignorer l'erreur si le fichier n'existe pas ou n'est pas accessible
            // (object-not-found, 404, 403/unauthorized)
            const isIgnorableError = 
              storageError?.code === 'storage/object-not-found' ||
              storageError?.code === 'storage/unauthorized' ||
              storageError?.code === '404' ||
              storageError?.response?.status === 403 ||
              storageError?.response?.status === 404;
            
            if (!isIgnorableError) {
              console.warn('Erreur lors de la suppression du fichier Storage (continuons quand même):', storageError);
            }
            // Continuer même si la suppression du fichier échoue
          }
        }
        
        // Si ce n'est pas un document personnel, essayer de supprimer de Firestore
        if (!isPersonalDoc) {
          const docRef = doc(db, 'structures', structureId, 'documents', docToDelete.id);
          
          try {
            await deleteDoc(docRef);
            setSnackbar({
              open: true,
              message: 'Document supprimé avec succès',
              severity: 'success',
            });
          } catch (deleteError: any) {
            // Si l'erreur est "not found", le document n'existe plus, c'est OK
            if (deleteError?.code === 'not-found' || deleteError?.code === 'permission-denied') {
              console.warn('Le document n\'existe pas ou n\'a pas pu être supprimé (permissions):', deleteError);
              // Essayer quand même de mettre à jour l'état local en retirant le document de la liste
              setDocuments(prev => prev.filter(d => d.id !== docToDelete.id));
              setSnackbar({
                open: true,
                message: 'Document retiré de la liste (peut-être déjà supprimé)',
                severity: 'info',
              });
            } else {
              // Pour les autres erreurs, relancer l'erreur
              throw deleteError;
            }
          }
        } else {
          // Pour les documents personnels, on a déjà supprimé la référence dans le profil
          setSnackbar({
            open: true,
            message: 'Document personnel supprimé avec succès',
            severity: 'success',
          });
        }
      } else {
        const folderToDelete = itemToDelete.item as Folder;
        const folderRef = doc(db, 'structures', structureId, 'folders', folderToDelete.id);
        
        try {
          await deleteDoc(folderRef);
          setSnackbar({
            open: true,
            message: 'Dossier supprimé avec succès',
            severity: 'success',
          });
        } catch (deleteError: any) {
          // Si l'erreur est "not found", le dossier n'existe plus, c'est OK
          if (deleteError?.code === 'not-found' || deleteError?.code === 'permission-denied') {
            console.warn('Le dossier n\'existe pas ou n\'a pas pu être supprimé (permissions):', deleteError);
            // Essayer quand même de mettre à jour l'état local en retirant le dossier de la liste
            setFolders(prev => prev.filter(f => f.id !== folderToDelete.id));
            setSnackbar({
              open: true,
              message: 'Dossier retiré de la liste (peut-être déjà supprimé)',
              severity: 'info',
            });
          } else {
            // Pour les autres erreurs, relancer l'erreur
            throw deleteError;
          }
        }
      }

      setDeleteDialogOpen(false);
      setItemToDelete(null);

      // Utiliser loadDocuments() pour recharger les données de manière cohérente
      await loadDocuments();
    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error);
      setSnackbar({
        open: true,
        message: error?.message || 'Erreur lors de la suppression',
        severity: 'error',
      });
      // Recharger quand même pour s'assurer que l'état est à jour
      try {
        await loadDocuments();
      } catch (reloadError) {
        console.error('Erreur lors du rechargement après suppression:', reloadError);
      }
    }
  };

  const handleUploadSuccess = () => {
    // Recharger les documents
    if (!structureId) return;
    const docsRef = collection(db, 'structures', structureId, 'documents');
    const docsQuery = query(
      docsRef,
      where('parentFolderId', '==', currentFolderId),
      orderBy('createdAt', 'desc')
    );
    getDocs(docsQuery).then((docsSnapshot) => {
      const docsList: Document[] = docsSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt,
      } as Document));
      setDocuments(docsList);
    });
  };

  if (!structureId || !currentUser) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Chargement...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            Documents
          </Typography>
          <Breadcrumbs separator="›" sx={{ mb: 1 }}>
            {breadcrumbs.map((item, index) => (
              <Link
                key={index}
                component="button"
                variant="body2"
                onClick={() => handleBreadcrumbClick(item)}
                sx={{
                  textDecoration: 'none',
                  color: index === breadcrumbs.length - 1 ? 'text.primary' : 'text.secondary',
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >
                {item.id === null ? <HomeIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} /> : <FolderIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />}
                {item.name}
              </Link>
            ))}
          </Breadcrumbs>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            onClick={() => setViewMode('grid')}
            color={viewMode === 'grid' ? 'primary' : 'default'}
          >
            <GridIcon />
          </IconButton>
          <IconButton
            onClick={() => setViewMode('list')}
            color={viewMode === 'list' ? 'primary' : 'default'}
          >
            <ListIcon />
          </IconButton>
          <Button
            variant="outlined"
            startIcon={<CreateFolderIcon />}
            onClick={() => setCreateFolderDialogOpen(true)}
          >
            Créer un dossier
          </Button>
          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            onClick={() => setUploadModalOpen(true)}
          >
            Téléverser
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Filtres pour le dossier "Documents Étudiants" */}
          {currentFolderId === STUDENTS_DOCUMENTS_FOLDER_ID && documents.length > 0 && (
            <Box sx={{ 
              mb: 3, 
              p: 2, 
              bgcolor: '#f5f5f7', 
              borderRadius: '12px',
              border: '1px solid rgba(0, 0, 0, 0.05)'
            }}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Type de document</InputLabel>
                  <Select
                    value={documentTypeFilter}
                    label="Type de document"
                    onChange={(e) => setDocumentTypeFilter(e.target.value)}
                  >
                    <MenuItem value="all">Tous les types</MenuItem>
                    {getUniqueDocumentTypes(documents).map((type) => (
                      <MenuItem key={type} value={type}>{type}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Étudiant</InputLabel>
                  <Select
                    value={studentFilter}
                    label="Étudiant"
                    onChange={(e) => setStudentFilter(e.target.value)}
                  >
                    <MenuItem value="all">Tous les étudiants</MenuItem>
                    {getUniqueStudents(documents).map((student) => (
                      <MenuItem key={student} value={student}>{student}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                {(documentTypeFilter !== 'all' || studentFilter !== 'all') && (
                  <Button
                    size="small"
                    onClick={() => {
                      setDocumentTypeFilter('all');
                      setStudentFilter('all');
                    }}
                    sx={{ ml: 'auto' }}
                  >
                    Réinitialiser
                  </Button>
                )}
              </Box>
            </Box>
          )}
          
          {/* Vue Grille */}
          {viewMode === 'grid' && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {/* Afficher le dossier virtuel "Missions" à la racine */}
              {currentFolderId === null && (
                <Box sx={{ width: 120, flexShrink: 0 }}>
                  <FolderCard
                    folder={{
                      id: MISSIONS_FOLDER_ID,
                      name: 'Missions',
                      parentFolderId: null,
                      createdBy: '',
                      createdAt: new Date(),
                      structureId: structureId || '',
                      isRestricted: false,
                      color: savedFolderColors[MISSIONS_FOLDER_ID] || '#FF9500',
                    } as Folder}
                    onOpen={handleFolderClick}
                    onProperties={(folder) => handlePropertiesClick('folder', folder)}
                    canAccess={true}
                    canDelete={false}
                    canRename={false}
                  />
                </Box>
              )}
              
              {/* Afficher les missions si on est dans le dossier Missions */}
              {currentFolderId === MISSIONS_FOLDER_ID && !currentMissionId && missions.map((mission) => (
                <Box key={mission.id} sx={{ width: 120, flexShrink: 0 }}>
                  <FolderCard
                    folder={{
                      id: mission.id,
                      name: `Mission ${mission.numeroMission || mission.id}${mission.description ? ` - ${mission.description}` : ''}${mission.company ? ` (${mission.company})` : ''}`,
                      parentFolderId: MISSIONS_FOLDER_ID,
                      createdBy: mission.createdBy || '',
                      createdAt: mission.createdAt || new Date(),
                      structureId: structureId || '',
                      isRestricted: false,
                      color: mission.folderColor || '#FF9500',
                    } as Folder}
                    onOpen={() => handleMissionClick(mission)}
                    onProperties={(folder) => handlePropertiesClick('folder', folder)}
                    canAccess={true}
                    canDelete={false}
                    canRename={false}
                    onDrop={(e) => handleDrop(e, {
                      id: mission.id,
                      name: `Mission ${mission.numeroMission || mission.id}`,
                      parentFolderId: MISSIONS_FOLDER_ID,
                      createdBy: mission.createdBy || '',
                      createdAt: mission.createdAt || new Date(),
                      structureId: structureId || '',
                      isRestricted: false,
                    } as Folder)}
                    onDragOver={handleDragOver}
                  />
                </Box>
              ))}
              
              {/* Afficher les documents de mission si on est dans une mission spécifique */}
              {currentFolderId === MISSIONS_FOLDER_ID && currentMissionId && missionsFolderDocuments
                .filter((doc) => canAccessRestricted(doc))
                .map((document) => (
                  <Box key={document.id} sx={{ width: 120, flexShrink: 0 }}>
                    <DocumentCard
                      document={document}
                      onOpen={handleDocumentOpen}
                      onDownload={handleDocumentDownload}
                      onDelete={(doc) => handleDeleteClick('document', doc)}
                      onRename={(doc) => handleRenameClick('document', doc)}
                      onProperties={(doc) => handlePropertiesClick('document', doc)}
                      onPin={handlePinToggle}
                      onDragStart={(e) => handleDragStart(e, 'document', document)}
                      canDelete={userRole === 'admin' || userRole === 'superadmin' || document.uploadedBy === currentUser.uid}
                      canRename={userRole === 'admin' || userRole === 'superadmin' || document.uploadedBy === currentUser.uid}
                    />
                  </Box>
                ))}
              
              {/* Dossiers normaux (hors dossier Missions) */}
              {currentFolderId !== MISSIONS_FOLDER_ID && folders.map((folder) => (
                  <Box key={folder.id} sx={{ width: 120, flexShrink: 0 }}>
                  <FolderCard
                    folder={folder}
                    onOpen={handleFolderClick}
                    onDelete={(folder) => handleDeleteClick('folder', folder)}
                    onRename={(folder) => handleRenameClick('folder', folder)}
                    onProperties={(folder) => handlePropertiesClick('folder', folder)}
                    canAccess={canAccessRestricted(folder)}
                    canDelete={userRole === 'admin' || userRole === 'superadmin' || folder.createdBy === currentUser.uid}
                    canRename={userRole === 'admin' || userRole === 'superadmin' || folder.createdBy === currentUser.uid}
                    onDragStart={(e) => handleDragStart(e, 'folder', folder)}
                    onDrop={(e) => handleDrop(e, folder)}
                    onDragOver={handleDragOver}
                  />
                </Box>
              ))}
              
              {/* Documents normaux (hors dossier Missions) */}
              {currentFolderId !== MISSIONS_FOLDER_ID && getFilteredDocuments(documents)
                .filter((doc) => canAccessRestricted(doc) && !doc.missionId)
                .map((document) => (
                  <Box key={document.id} sx={{ width: 120, flexShrink: 0 }}>
                    <DocumentCard
                      document={document}
                      onOpen={handleDocumentOpen}
                      onDownload={handleDocumentDownload}
                      onDelete={(doc) => handleDeleteClick('document', doc)}
                      onRename={(doc) => handleRenameClick('document', doc)}
                      onProperties={(doc) => handlePropertiesClick('document', doc)}
                      onPin={handlePinToggle}
                      onDragStart={(e) => handleDragStart(e, 'document', document)}
                      canDelete={userRole === 'admin' || userRole === 'superadmin' || document.uploadedBy === currentUser.uid}
                      canRename={userRole === 'admin' || userRole === 'superadmin' || document.uploadedBy === currentUser.uid}
                    />
                  </Box>
                ))}
            </Box>
          )}

          {/* Vue Liste */}
          {viewMode === 'list' && (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nom</TableCell>
                    <TableCell>Date de création</TableCell>
                    <TableCell>Créé par</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Afficher le dossier virtuel "Missions" à la racine */}
                  {currentFolderId === null && (
                    <TableRow
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleFolderClick({
                        id: MISSIONS_FOLDER_ID,
                        name: 'Missions',
                        parentFolderId: null,
                        createdBy: '',
                        createdAt: new Date(),
                        structureId: structureId || '',
                        isRestricted: false,
                        color: savedFolderColors[MISSIONS_FOLDER_ID] || '#FF9500',
                      } as Folder)}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FolderIcon sx={{ color: savedFolderColors[MISSIONS_FOLDER_ID] || '#FF9500' }} />
                          <Typography variant="body2">Missions</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell align="right"></TableCell>
                    </TableRow>
                  )}
                  
                  {/* Afficher les missions si on est dans le dossier Missions */}
                  {currentFolderId === MISSIONS_FOLDER_ID && !currentMissionId && missions.map((mission) => (
                    <TableRow
                      key={mission.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleMissionClick(mission)}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FolderIcon sx={{ color: mission.folderColor || '#FF9500' }} />
                          <Typography variant="body2">
                            Mission {mission.numeroMission || mission.id}{mission.description ? ` - ${mission.description}` : ''}{mission.company ? ` (${mission.company})` : ''}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {mission.createdAt && (mission.createdAt as any).toDate
                          ? (mission.createdAt as any).toDate().toLocaleDateString('fr-FR')
                          : new Date(mission.createdAt || 0).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell align="right"></TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Afficher les documents de mission si on est dans une mission spécifique */}
                  {currentFolderId === MISSIONS_FOLDER_ID && currentMissionId && missionsFolderDocuments
                    .filter((doc) => canAccessRestricted(doc))
                    .map((document) => (
                      <DocumentRow
                        key={document.id}
                        document={document}
                        onOpen={handleDocumentOpen}
                        onDownload={handleDocumentDownload}
                        onDelete={(doc) => handleDeleteClick('document', doc)}
                        onRename={(doc) => handleRenameClick('document', doc)}
                        onPin={handlePinToggle}
                        canDelete={userRole === 'admin' || userRole === 'superadmin' || document.uploadedBy === currentUser.uid}
                        canRename={userRole === 'admin' || userRole === 'superadmin' || document.uploadedBy === currentUser.uid}
                      />
                    ))}
                  
                  {/* Dossiers normaux (hors dossier Missions) */}
                  {currentFolderId !== MISSIONS_FOLDER_ID && folders.map((folder) => (
                    <TableRow
                      key={folder.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleFolderClick(folder)}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FolderIcon sx={{ color: folder.color || '#007AFF' }} />
                          <Typography variant="body2">{folder.name}</Typography>
                          {folder.isRestricted && (
                            <LockIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {folder.createdAt && (folder.createdAt as any).toDate
                          ? (folder.createdAt as any).toDate().toLocaleDateString('fr-FR')
                          : new Date(folder.createdAt as Date).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell>{folder.createdByName || 'Inconnu'}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameClick('folder', folder);
                          }}
                          title="Renommer"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        {(userRole === 'admin' || userRole === 'superadmin' || folder.createdBy === currentUser.uid) && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick('folder', folder);
                          }}
                            title="Supprimer"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {getFilteredDocuments(documents)
                    .filter((doc) => canAccessRestricted(doc) && !doc.missionId)
                    .map((document) => (
                      <DocumentRow
                        key={document.id}
                        document={document}
                        onOpen={handleDocumentOpen}
                        onDownload={handleDocumentDownload}
                        onDelete={(doc) => handleDeleteClick('document', doc)}
                        onRename={(doc) => handleRenameClick('document', doc)}
                        onPin={handlePinToggle}
                        canDelete={userRole === 'admin' || userRole === 'superadmin' || document.uploadedBy === currentUser.uid}
                        canRename={userRole === 'admin' || userRole === 'superadmin' || document.uploadedBy === currentUser.uid}
                      />
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Section Documents par Mission */}
          {Object.keys(missionDocuments).length > 0 && currentFolderId === null && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssignmentIcon />
                Documents des missions
              </Typography>
              {Object.entries(missionDocuments).map(([missionId, { mission, documents: missionDocs }]) => {
                const accessibleDocs = missionDocs.filter(doc => canAccessRestricted(doc));
                if (accessibleDocs.length === 0) return null;
                
                const isExpanded = expandedMissions.has(missionId);
                const missionDisplayName = mission.numeroMission 
                  ? `Mission ${mission.numeroMission}${mission.description ? ` - ${mission.description}` : ''}${mission.company ? ` (${mission.company})` : ''}`
                  : `Mission ${missionId}`;

                return (
                  <Paper key={missionId} sx={{ mb: 2 }}>
                    <Box
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        '&:hover': {
                          backgroundColor: 'action.hover',
                        },
                      }}
                      onClick={() => toggleMission(missionId)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        <Typography variant="h6" sx={{ fontWeight: 500 }}>
                          {missionDisplayName}
                        </Typography>
                        <Chip 
                          label={`${accessibleDocs.length} document${accessibleDocs.length > 1 ? 's' : ''}`} 
                          size="small" 
                          color="primary"
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                    <Collapse in={isExpanded}>
                      <Box sx={{ p: 2, pt: 0 }}>
                        {viewMode === 'grid' ? (
                          <Grid container spacing={2}>
                            {accessibleDocs.map((document) => (
                              <Grid item xs={12} sm={6} md={4} lg={3} key={document.id}>
                                <DocumentCard
                                  document={document}
                                  onOpen={handleDocumentOpen}
                                  onDownload={handleDocumentDownload}
                                  onDelete={(doc) => handleDeleteClick('document', doc)}
                                  canDelete={userRole === 'admin' || userRole === 'superadmin' || document.uploadedBy === currentUser.uid}
                                />
                              </Grid>
                            ))}
                          </Grid>
                        ) : (
                          <TableContainer component={Paper} variant="outlined">
                            <Table>
                              <TableHead>
                                <TableRow>
                                  <TableCell>Nom</TableCell>
                                  <TableCell>Date de création</TableCell>
                                  <TableCell>Créé par</TableCell>
                                  <TableCell align="right">Actions</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {accessibleDocs.map((document) => (
                                  <DocumentRow
                                    key={document.id}
                                    document={document}
                                    onOpen={handleDocumentOpen}
                                    onDownload={handleDocumentDownload}
                                    onDelete={(doc) => handleDeleteClick('document', doc)}
                                    onRename={(doc) => handleRenameClick('document', doc)}
                                    canDelete={userRole === 'admin' || userRole === 'superadmin' || document.uploadedBy === currentUser.uid}
                                    canRename={userRole === 'admin' || userRole === 'superadmin' || document.uploadedBy === currentUser.uid}
                                  />
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        )}
                      </Box>
                    </Collapse>
                  </Paper>
                );
              })}
            </Box>
          )}

          {/* Message vide pour le dossier Missions */}
          {currentFolderId === MISSIONS_FOLDER_ID && !currentMissionId && missions.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <FolderIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                Aucune mission
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Aucune mission n'a été créée pour cette structure
              </Typography>
            </Box>
          )}
          
          {/* Message vide pour une mission sans documents */}
          {currentFolderId === MISSIONS_FOLDER_ID && currentMissionId && missionsFolderDocuments.filter((doc) => canAccessRestricted(doc)).length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <FolderIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                Aucun document
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Cette mission ne contient aucun document
              </Typography>
            </Box>
          )}
          
          {/* Message vide pour la racine */}
          {currentFolderId === null && folders.length === 0 && documents.filter((doc) => canAccessRestricted(doc) && !doc.missionId).length === 0 && Object.keys(missionDocuments).length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <FolderIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                Aucun document ou dossier
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Commencez par téléverser un fichier ou créer un dossier
              </Typography>
            </Box>
          )}
          
          {/* Message vide pour un dossier normal */}
          {currentFolderId !== null && currentFolderId !== MISSIONS_FOLDER_ID && folders.length === 0 && documents.filter((doc) => canAccessRestricted(doc) && !doc.missionId).length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <FolderIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                Dossier vide
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ce dossier ne contient aucun document ou sous-dossier
              </Typography>
            </Box>
          )}
        </>
      )}

      {/* Modal de création de dossier */}
      <Dialog open={createFolderDialogOpen} onClose={() => setCreateFolderDialogOpen(false)}>
        <DialogTitle>Créer un nouveau dossier</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nom du dossier"
            fullWidth
            variant="outlined"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleCreateFolder();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateFolderDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleCreateFolder} variant="contained">
            Créer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal d'aperçu */}
      <Dialog
        open={previewDialogOpen}
        onClose={() => {
          // Nettoyer l'URL blob si elle existe
          if (previewDocument?.url && previewDocument.url.startsWith('blob:')) {
            URL.revokeObjectURL(previewDocument.url);
          }
          setPreviewDialogOpen(false);
          setPreviewError(null);
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>{previewDocument?.name}</DialogTitle>
        <DialogContent>
          {previewDocument && (
            <Box>
              {previewError ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body1" color="error" sx={{ mb: 2 }}>
                    {previewError}
                  </Typography>
                </Box>
              ) : previewDocument.type.startsWith('image/') ? (
                <img
                  src={previewDocument.url}
                  alt={previewDocument.name}
                  style={{ maxWidth: '100%', height: 'auto' }}
                  onError={() => {
                    setPreviewError('Le document n\'est plus disponible ou a été supprimé');
                  }}
                />
              ) : previewDocument.type === 'application/pdf' ? (
                <Box sx={{ 
                  height: '100%', 
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '600px',
                  position: 'relative'
                }}>
                  {previewDocument.url && previewDocument.url.startsWith('blob:') ? (
                    // Pour les blobs (fichiers téléchargés), utiliser un embed
                    <embed
                      src={`${previewDocument.url}#toolbar=0&navpanes=0&scrollbar=0`}
                      type="application/pdf"
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        flex: 1,
                        minHeight: '600px'
                      }}
                      onLoad={() => {
                        console.log('✅ Embed blob chargé avec succès');
                      }}
                      onError={(e) => {
                        console.error('❌ Erreur chargement embed blob:', e);
                        setPreviewError('Le document n\'est plus disponible ou a été supprimé');
                      }}
                    />
                  ) : (
                    // Pour les URLs Firebase Storage, utiliser un iframe avec timeout de détection d'erreur
                    <>
                      <iframe
                        src={previewDocument.url}
                        style={{ width: '100%', height: '600px', border: 'none' }}
                        title={previewDocument.name}
                        onLoad={(e) => {
                          // Timeout pour détecter si le document ne charge pas (erreur 403)
                          const timeoutId = setTimeout(() => {
                            // Si après 2 secondes on n'a pas de contenu, c'est probablement une erreur
                            setPreviewError('Le document n\'est plus disponible ou a été supprimé');
                          }, 2000);
                          
                          // Vérifier si l'iframe a chargé correctement
                          try {
                            const iframe = e.target as HTMLIFrameElement;
                            // Si on peut accéder au contenu et qu'il n'est pas vide, c'est bon
                            if (iframe.contentDocument?.body?.textContent && 
                                iframe.contentDocument.body.textContent.trim() !== '') {
                              clearTimeout(timeoutId);
                              const bodyText = iframe.contentDocument.body.textContent || '';
                              if (bodyText.includes('403') || 
                                  bodyText.includes('Permission denied') ||
                                  bodyText.includes('error') ||
                                  bodyText.includes('Error')) {
                                setPreviewError('Le document n\'est plus disponible ou a été supprimé');
                              }
                            }
                          } catch (err) {
                            // Cross-origin, on ne peut pas vérifier le contenu
                            // Le timeout gérera la détection d'erreur
                          }
                        }}
                        onError={() => {
                          setPreviewError('Le document n\'est plus disponible ou a été supprimé');
                        }}
                      />
                    </>
                  )}
                  {previewError && (
                    <Box sx={{ 
                      textAlign: 'center', 
                      py: 4, 
                      position: 'absolute', 
                      top: '50%', 
                      left: '50%', 
                      transform: 'translate(-50%, -50%)', 
                      zIndex: 1000,
                      bgcolor: 'background.paper',
                      p: 3,
                      borderRadius: 2,
                      boxShadow: 3
                    }}>
                      <Typography variant="body1" color="error" sx={{ mb: 2 }}>
                        {previewError}
                      </Typography>
                    </Box>
                  )}
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    Aperçu non disponible pour ce type de fichier
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleDocumentDownload(previewDocument)}
                  >
                    Télécharger
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialogOpen(false)}>Fermer</Button>
          {previewDocument && (
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={() => handleDocumentDownload(previewDocument)}
            >
              Télécharger
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Modal de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer {itemToDelete?.type === 'document' ? 'ce document' : 'ce dossier'} ?
            Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de propriétés */}
      <Dialog 
        open={propertiesDialogOpen} 
        onClose={() => setPropertiesDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InfoIcon color="primary" />
          Propriétés
        </DialogTitle>
        <DialogContent>
          {itemProperties && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'action.hover',
                    borderRadius: 2,
                  }}
                >
                  {itemProperties.type === 'folder' ? (
                    <FolderIcon sx={{ fontSize: 40, color: (itemProperties.item as Folder).color || '#FF9500' }} />
                  ) : (
                    <UploadIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                  )}
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {itemProperties.item.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {itemProperties.type === 'folder' ? 'Dossier' : (itemProperties.item as Document).type}
                  </Typography>
                </Box>
              </Box>

              <Divider />

              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">Créé par :</Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="body2">
                    {itemProperties.type === 'folder' 
                      ? (itemProperties.item as Folder).createdByName || 'Inconnu'
                      : (itemProperties.item as Document).uploadedByName || 'Inconnu'
                    }
                  </Typography>
                </Grid>

                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">Date de création :</Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="body2">
                    {itemProperties.item.createdAt && (itemProperties.item.createdAt as any).toDate
                      ? formatDate((itemProperties.item.createdAt as any).toDate())
                      : itemProperties.item.createdAt
                      ? formatDate(new Date(itemProperties.item.createdAt as any))
                      : 'Non disponible'}
                  </Typography>
                </Grid>

                {itemProperties.type === 'document' && (
                  <>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="text.secondary">Taille :</Typography>
                    </Grid>
                    <Grid item xs={8}>
                      <Typography variant="body2">
                        {formatFileSize((itemProperties.item as Document).size)}
                      </Typography>
                    </Grid>
                  </>
                )}
              </Grid>

              {itemProperties.type === 'folder' && 
               (itemProperties.item as Folder).id !== MISSIONS_FOLDER_ID && 
               (itemProperties.item as Folder).parentFolderId !== MISSIONS_FOLDER_ID && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ColorIcon fontSize="small" />
                    Couleur du dossier
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {['#FF9500', '#FF3B30', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FF2D55', '#8E8E93'].map((color) => {
                      const folder = itemProperties.item as Folder;
                      const isSelected = folder.color === color || (!folder.color && color === '#FF9500');
                      return (
                        <Box
                          key={color}
                          onClick={() => handleColorChange(color)}
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            bgcolor: color,
                            cursor: 'pointer',
                            border: isSelected ? '3px solid white' : 'none',
                            boxShadow: isSelected ? '0 0 0 2px #007AFF' : 'none',
                            transition: 'transform 0.2s',
                            '&:hover': {
                              transform: 'scale(1.1)',
                            },
                          }}
                        />
                      );
                    })}
                    <IconButton 
                      size="small" 
                      onClick={() => handleColorChange('#FF9500')}
                      title="Couleur par défaut"
                      sx={{ 
                        border: !(itemProperties.item as Folder).color ? '2px solid #007AFF' : '1px solid #ccc',
                      }}
                    >
                      <FolderIcon sx={{ color: '#FF9500' }} />
                    </IconButton>
                  </Box>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPropertiesDialogOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      {/* Modal de renommage */}
      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)}>
        <DialogTitle>
          Renommer {itemToRename?.type === 'document' ? 'le document' : 'le dossier'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={itemToRename?.type === 'document' ? 'Nom du document' : 'Nom du dossier'}
            fullWidth
            variant="outlined"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleRenameConfirm();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setRenameDialogOpen(false);
            setNewItemName('');
            setItemToRename(null);
          }}>
            Annuler
          </Button>
          <Button 
            onClick={handleRenameConfirm} 
            variant="contained"
            disabled={!newItemName.trim()}
          >
            Renommer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de propriétés */}
      <Dialog 
        open={propertiesDialogOpen} 
        onClose={() => setPropertiesDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {itemProperties?.type === 'folder' && itemProperties?.item ? (
              <FolderIcon sx={{ fontSize: 40, color: (itemProperties.item as Folder).color || '#007AFF' }} />
            ) : itemProperties?.type === 'document' && itemProperties?.item ? (
              <FileTextIcon sx={{ fontSize: 40, color: '#86868b' }} />
            ) : (
              <FileTextIcon sx={{ fontSize: 40, color: '#86868b' }} />
            )}
            <Typography variant="h6">{itemProperties?.item?.name || 'Propriétés'}</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {itemProperties?.item ? (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Informations générales
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Type:
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {itemProperties.type === 'document' ? 'Document' : 'Dossier'}
                    </Typography>
                  </Box>
                  
                  {itemProperties.type === 'document' ? (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Taille:
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {formatFileSize((itemProperties.item as Document).size || 0)}
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Taille:
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {(() => {
                          const folder = itemProperties.item as Folder;
                          let sizeKey: string | null = null;
                          
                          if (folder.id === MISSIONS_FOLDER_ID) {
                            sizeKey = MISSIONS_FOLDER_ID;
                          } else if (folder.parentFolderId === MISSIONS_FOLDER_ID) {
                            sizeKey = folder.id;
                          } else {
                            sizeKey = folder.id;
                          }
                          
                          return folderSizes[sizeKey] !== undefined 
                            ? formatFileSize(folderSizes[sizeKey])
                            : '-';
                        })()}
                      </Typography>
                    </Box>
                  )}
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Créé le:
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {itemProperties.item.createdAt && (itemProperties.item.createdAt as any).toDate
                        ? (itemProperties.item.createdAt as any).toDate().toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : itemProperties.item.createdAt 
                        ? new Date(itemProperties.item.createdAt as Date).toLocaleDateString('fr-FR')
                        : 'Non disponible'}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Créé par:
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {itemProperties.type === 'document' 
                        ? (itemProperties.item as Document).uploadedByName || 'Inconnu'
                        : (itemProperties.item as Folder).createdByName || 'Inconnu'}
                    </Typography>
                  </Box>
                  
                  {itemProperties.item.updatedAt && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Modifié le:
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {(itemProperties.item.updatedAt as any).toDate
                          ? (itemProperties.item.updatedAt as any).toDate().toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : new Date(itemProperties.item.updatedAt as Date).toLocaleDateString('fr-FR')}
                      </Typography>
                    </Box>
                  )}
                  
                  {itemProperties.type === 'document' && (itemProperties.item as Document).missionNumber && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Mission:
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {(itemProperties.item as Document).missionNumber}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>

              {/* Section changement de couleur pour tous les dossiers */}
              {itemProperties.type === 'folder' && (
                <Box>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                    Couleur du dossier
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {folderColors.map((color) => (
                      <Tooltip key={color.value} title={color.name}>
                        <Box
                          onClick={() => handleColorChange(color.value)}
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            backgroundColor: color.value,
                            cursor: 'pointer',
                            border: selectedColor === color.value ? '3px solid #000' : '2px solid transparent',
                            boxShadow: selectedColor === color.value 
                              ? '0 0 0 2px rgba(0,0,0,0.1)' 
                              : '0 2px 4px rgba(0,0,0,0.1)',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              transform: 'scale(1.1)',
                              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                            },
                          }}
                        />
                      </Tooltip>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ mt: 2, textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                Chargement des propriétés...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPropertiesDialogOpen(false)} variant="contained">
            Fermer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal d'upload */}
      <UploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        structureId={structureId}
        parentFolderId={currentFolderId}
        currentUserId={currentUser.uid}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default Documents;

