import React, { useState, useEffect } from 'react';
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
import { Document, Folder, ViewMode, BreadcrumbItem } from '../types/document';
import { formatFileSize } from '../utils/fileUtils';
import DocumentCard from '../components/documents/DocumentCard';
import DocumentRow from '../components/documents/DocumentRow';
import FolderCard from '../components/documents/FolderCard';
import UploadModal from '../components/documents/UploadModal';

const Documents: React.FC = () => {
  const { currentUser, userData } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [missionDocuments, setMissionDocuments] = useState<{ [missionId: string]: { mission: any; documents: Document[] } }>({});
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
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
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
      const missionsFolderColorRef = doc(db, 'structures', structureId, 'folderColors', MISSIONS_FOLDER_ID);
      const missionsFolderColorDoc = await getDoc(missionsFolderColorRef);
      if (missionsFolderColorDoc.exists()) {
        const data = missionsFolderColorDoc.data();
        setSavedFolderColors(prev => ({ ...prev, [MISSIONS_FOLDER_ID]: data.color || '#FF9500' }));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des couleurs de dossiers:', error);
    }
  };

  // Charger les documents et dossiers
  useEffect(() => {
    if (!structureId || !currentUser) return;

    // Si on est dans le dossier Missions, ne pas charger les documents normaux
    if (currentFolderId === MISSIONS_FOLDER_ID) {
      setLoading(false);
      if (currentMissionId) {
        loadMissionDocuments(currentMissionId);
      }
      return;
    }

    const loadDocuments = async () => {
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

        setDocuments(docsList);

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
    };

    loadDocuments();
  }, [structureId, currentUser, currentFolderId, currentMissionId]);

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

  // Charger les documents d'une mission spécifique
  const loadMissionDocuments = async (missionId: string) => {
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
    
    // Si c'est le dossier virtuel "Missions"
    if (folder.id === MISSIONS_FOLDER_ID) {
      setCurrentFolderId(MISSIONS_FOLDER_ID);
      setCurrentMissionId(null);
      updateBreadcrumbs(MISSIONS_FOLDER_ID, 'Missions');
      loadMissions();
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

  const handleDocumentOpen = (document: Document) => {
    if (!canAccessRestricted(document)) {
      setSnackbar({
        open: true,
        message: 'Vous n\'avez pas accès à ce document',
        severity: 'error',
      });
      return;
    }
    setPreviewDocument(document);
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
      const link = document.createElement('a');
      link.href = doc.url;
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

  const handlePropertiesClick = async (type: 'document' | 'folder', item: Document | Folder) => {
    setItemProperties({ type, item });
    
    if (type === 'folder') {
      const folder = item as Folder;
      
      // Charger la couleur depuis Firestore si c'est un dossier virtuel ou une mission
      if (folder.id === MISSIONS_FOLDER_ID) {
        try {
          const folderColorRef = doc(db, 'structures', structureId, 'folderColors', MISSIONS_FOLDER_ID);
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
        const folderColorRef = doc(db, 'structures', structureId, 'folderColors', MISSIONS_FOLDER_ID);
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
        // Supprimer le fichier du Storage
        await deleteFile(docToDelete.storagePath);
        // Supprimer le document de Firestore
        await deleteDoc(doc(db, 'structures', structureId, 'documents', docToDelete.id));
        setSnackbar({
          open: true,
          message: 'Document supprimé avec succès',
          severity: 'success',
        });
      } else {
        const folderToDelete = itemToDelete.item as Folder;
        // Supprimer le dossier de Firestore
        await deleteDoc(doc(db, 'structures', structureId, 'folders', folderToDelete.id));
        setSnackbar({
          open: true,
          message: 'Dossier supprimé avec succès',
          severity: 'success',
        });
      }

      setDeleteDialogOpen(false);
      setItemToDelete(null);

      // Recharger les données
      const docsRef = collection(db, 'structures', structureId, 'documents');
      const docsQuery = query(
        docsRef,
        where('parentFolderId', '==', currentFolderId),
        orderBy('createdAt', 'desc')
      );
      const docsSnapshot = await getDocs(docsQuery);
      const docsList: Document[] = docsSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt,
      } as Document));
      setDocuments(docsList);

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
      console.error('Erreur lors de la suppression:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la suppression',
        severity: 'error',
      });
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
              {currentFolderId !== MISSIONS_FOLDER_ID && documents
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
                    <TableCell>Taille</TableCell>
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
                      <TableCell>
                        {folderSizes[MISSIONS_FOLDER_ID] !== undefined 
                          ? formatFileSize(folderSizes[MISSIONS_FOLDER_ID])
                          : '-'}
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
                        {folderSizes[mission.id] !== undefined 
                          ? formatFileSize(folderSizes[mission.id])
                          : '-'}
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
                        {folderSizes[folder.id] !== undefined 
                          ? formatFileSize(folderSizes[folder.id])
                          : '-'}
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
                  {documents
                    .filter((doc) => canAccessRestricted(doc) && !doc.missionId)
                    .map((document) => (
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
                                  <TableCell>Taille</TableCell>
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
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>{previewDocument?.name}</DialogTitle>
        <DialogContent>
          {previewDocument && (
            <Box>
              {previewDocument.type.startsWith('image/') ? (
                <img
                  src={previewDocument.url}
                  alt={previewDocument.name}
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              ) : previewDocument.type === 'application/pdf' ? (
                <iframe
                  src={previewDocument.url}
                  style={{ width: '100%', height: '600px', border: 'none' }}
                  title={previewDocument.name}
                />
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

