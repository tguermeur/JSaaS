import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Container,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Breadcrumbs,
  Link,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  TextField,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  DialogContentText,
  FormControl,
  InputLabel,
  Select,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  Business as BusinessIcon,
  LocationOn as LocationOnIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Description as DescriptionIcon,
  NoteAdd as NoteAddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  Add as AddIcon,
  Upload as UploadIcon,
  Reply as ReplyIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { auditService, Mission } from '../services/auditService';
import { DocumentType, DOCUMENT_TYPES } from '../types/templates';
import { collection, query, where, orderBy, getDocs, doc, deleteDoc, getDoc, updateDoc, addDoc } from 'firebase/firestore';
import { db, storage, getStorageInstance } from '../firebase/config';
import app, { isStorageAvailable } from '../firebase/config';
import { FileText, Download, Trash2, Upload } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useSnackbar } from 'notistack';
import { SelectChangeEvent } from '@mui/material/Select';
import TaggingInput from '../components/ui/TaggingInput';
import { NotificationService } from '../services/notificationService';

interface GeneratedDocument {
  id: string;
  missionId: string;
  missionNumber: string;
  missionTitle: string;
  structureId: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  isSigned: boolean;
  createdBy: string;
  isAudited: boolean;
  auditedAt?: Date;
  auditedBy?: string;
  auditNotes?: string;
  signedFileUrl?: string;
  signedAt?: Date;
  signedBy?: string;
}

interface DocumentNote {
  id: string;
  content: string;
  documentId: string;
  documentName: string;
  createdAt: Date;
  createdBy: string;
  createdByName: string;
  createdByPhotoURL?: string;
  missionId: string;
  type: 'document' | 'mission';
}

interface MissionNote {
  id: string;
  content: string;
  missionId: string;
  createdAt: Date;
  createdBy: string;
  createdByName: string;
  createdByPhotoURL?: string;
  type: 'document' | 'mission';
  isClosed?: boolean;
  closedAt?: Date;
  closedBy?: string;
  isReply: boolean;
  replyToNoteId: string;
}

interface TaggedUser {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

const AuditMissionDetails: React.FC = () => {
  const { missionId } = useParams<{ missionId: string }>();
  const navigate = useNavigate();
  const [mission, setMission] = useState<Mission | null>(null);
  const [generatedDocuments, setGeneratedDocuments] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth();
  const [userNames, setUserNames] = useState<{ [key: string]: string }>({});
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [missionNotes, setMissionNotes] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedDocument, setSelectedDocument] = useState<GeneratedDocument | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [newDocumentName, setNewDocumentName] = useState('');
  const [documentNote, setDocumentNote] = useState('');
  const { enqueueSnackbar } = useSnackbar();
  const [documentNotes, setDocumentNotes] = useState<DocumentNote[]>([]);
  const [addDocumentDialogOpen, setAddDocumentDialogOpen] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState('');
  const [isDocumentSigned, setIsDocumentSigned] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [missionNotesList, setMissionNotesList] = useState<MissionNote[]>([]);
  const [noteMenuAnchorEl, setNoteMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedNote, setSelectedNote] = useState<MissionNote | null>(null);
  const [editNoteDialogOpen, setEditNoteDialogOpen] = useState(false);
  const [editedNoteContent, setEditedNoteContent] = useState('');
  const [replyNoteDialogOpen, setReplyNoteDialogOpen] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [replyingToNote, setReplyingToNote] = useState<MissionNote | null>(null);
  const [confirmAuditDialogOpen, setConfirmAuditDialogOpen] = useState(false);
  const [documentToAudit, setDocumentToAudit] = useState<GeneratedDocument | null>(null);
  const [confirmArchiveDialogOpen, setConfirmArchiveDialogOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<TaggedUser[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<TaggedUser[]>([]);
  const [documentTaggedUsers, setDocumentTaggedUsers] = useState<TaggedUser[]>([]);
  const [replyTaggedUsers, setReplyTaggedUsers] = useState<TaggedUser[]>([]);
  
  // Fonction pour récupérer les documents générés
  const fetchGeneratedDocuments = async () => {
    if (!missionId) return;

    try {
      const documentsQuery = query(
        collection(db, 'generatedDocuments'),
        where('missionId', '==', missionId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(documentsQuery);
      const documents = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          auditedAt: data.auditedAt?.toDate() || null
        } as GeneratedDocument;
      });
      
      setGeneratedDocuments(documents);

      // Récupérer les IDs des utilisateurs qui ont généré des documents
      const userIds = [...new Set([
        ...documents.map(doc => doc.createdBy),
        ...documents.map(doc => doc.auditedBy)
      ])].filter(Boolean);
      
      if (userIds.length > 0) {
        await fetchUserNames(userIds);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des documents générés:', error);
      setError('Erreur lors de la récupération des documents générés');
    }
  };

  // Fonction pour récupérer les informations des utilisateurs
  const fetchUserNames = async (userIds: string[]) => {
    try {
      const uniqueIds = [...new Set(userIds)];
      const userPromises = uniqueIds.map(async (userId) => {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          return { id: userId, name: userData.displayName || 'Utilisateur inconnu' };
        }
        return { id: userId, name: 'Utilisateur inconnu' };
      });

      const users = await Promise.all(userPromises);
      const userNamesMap = users.reduce((acc, user) => {
        acc[user.id] = user.name;
        return acc;
      }, {} as { [key: string]: string });

      setUserNames(userNamesMap);
    } catch (error) {
      console.error('Erreur lors de la récupération des noms d\'utilisateurs:', error);
    }
  };

  // Fonction pour récupérer les utilisateurs disponibles pour le tagging
  const fetchAvailableUsers = async () => {
    try {
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          displayName: data.displayName || 'Utilisateur inconnu',
          email: data.email || '',
          photoURL: data.photoURL || '',
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          role: data.role || ''
        } as TaggedUser;
      });
      setAvailableUsers(users);
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
    }
  };

  // Charger les détails de la mission et ses documents
  useEffect(() => {
    const fetchMissionDetails = async () => {
      if (!missionId) return;
      
      try {
        setLoading(true);
        // Récupérer les détails de la mission
        const missionDetails = await auditService.getMissionById(missionId);
        
        if (!missionDetails) {
          setError('Mission non trouvée');
          return;
        }
        
        setMission(missionDetails);
        
        // Récupérer les documents générés
        await fetchGeneratedDocuments();
        
        // Récupérer les utilisateurs disponibles pour le tagging
        await fetchAvailableUsers();
      } catch (err) {
        setError('Erreur lors du chargement des données');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMissionDetails();
  }, [missionId]);

  const handleBackToAudit = () => {
    navigate('/app/audit');
  };

  const handleDownloadDocument = async (document: GeneratedDocument) => {
    try {
      window.open(document.fileUrl, '_blank');
    } catch (error) {
      console.error('Erreur lors du téléchargement du document:', error);
      setError('Erreur lors du téléchargement du document');
    }
  };

  const handleDeleteDocument = async (document: GeneratedDocument) => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de supprimer un document d\'une mission archivée', { variant: 'error' });
      return;
    }

    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      return;
    }

    try {
      const docRef = doc(db, 'generatedDocuments', document.id);
      await deleteDoc(docRef);
      await fetchGeneratedDocuments();
    } catch (error) {
      console.error('Erreur lors de la suppression du document:', error);
      setError('Erreur lors de la suppression du document');
    }
  };

  const handleToggleAudit = async (document: GeneratedDocument) => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de modifier un document d\'une mission archivée', { variant: 'error' });
      return;
    }

    if (!document.isSigned) {
      setDocumentToAudit(document);
      setConfirmAuditDialogOpen(true);
      return;
    }

    try {
      const docRef = doc(db, 'generatedDocuments', document.id);
      const newAuditStatus = !document.isAudited;
      
      await updateDoc(docRef, {
        isAudited: newAuditStatus,
        auditedAt: newAuditStatus ? new Date() : null,
        auditedBy: newAuditStatus ? currentUser?.uid : null,
        updatedAt: new Date()
      });

      // Mettre à jour l'état local
      setGeneratedDocuments(prev => prev.map(doc => 
        doc.id === document.id 
          ? {
              ...doc,
              isAudited: newAuditStatus,
              auditedAt: newAuditStatus ? new Date() : undefined,
              auditedBy: newAuditStatus ? currentUser?.uid : undefined
            }
          : doc
      ));
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut d\'audit:', error);
      setError('Erreur lors de la mise à jour du statut d\'audit');
    }
  };

  const handleConfirmAudit = async () => {
    if (!documentToAudit) return;

    try {
      const docRef = doc(db, 'generatedDocuments', documentToAudit.id);
      const newAuditStatus = !documentToAudit.isAudited;
      
      await updateDoc(docRef, {
        isAudited: newAuditStatus,
        auditedAt: newAuditStatus ? new Date() : null,
        auditedBy: newAuditStatus ? currentUser?.uid : null,
        updatedAt: new Date()
      });

      // Mettre à jour l'état local
      setGeneratedDocuments(prev => prev.map(doc => 
        doc.id === documentToAudit.id 
          ? {
              ...doc,
              isAudited: newAuditStatus,
              auditedAt: newAuditStatus ? new Date() : undefined,
              auditedBy: newAuditStatus ? currentUser?.uid : undefined
            }
          : doc
      ));

      setConfirmAuditDialogOpen(false);
      setDocumentToAudit(null);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut d\'audit:', error);
      setError('Erreur lors de la mise à jour du statut d\'audit');
    }
  };

  const handleUploadSignedVersion = async (document: GeneratedDocument, event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0]) return;
    
    try {
      setUploadingDoc(document.id);
      const file = event.target.files[0];
      
      // Vérifier que Firebase Storage est disponible et valide
      // Note: storage est importé directement depuis config.ts comme dans Profile.tsx
      // Essayer d'obtenir une instance Storage (asynchrone si nécessaire)
      let storageInstance = storage;
      if (!storageInstance && app) {
        console.log('⏳ Storage null, tentative d\'initialisation asynchrone...');
        try {
          storageInstance = await getStorageInstance();
        } catch (error) {
          console.error('❌ Erreur lors de l\'initialisation asynchrone:', error);
        }
      }
      
      if (!storageInstance || !app) {
        console.error('Firebase Storage non disponible - storage:', !!storageInstance, 'app:', !!app, 'isAvailable:', isStorageAvailable());
        setError('Erreur: Firebase Storage n\'est pas activé dans votre projet Firebase. Veuillez activer Storage dans la console Firebase (console.firebase.google.com) puis recharger la page.');
        return;
      }
      
      // Créer le chemin de stockage
      const storagePath = `missions/${document.missionId}/documents/signed_${document.fileName}`;
      let storageRef;
      try {
        storageRef = ref(storageInstance, storagePath);
      } catch (refError: any) {
        console.error('Erreur lors de la création de la référence Storage:', refError);
        setError('Erreur: Impossible de créer la référence de stockage. Firebase Storage n\'est pas correctement initialisé.');
        return;
      }

      // Téléverser le fichier
      await uploadBytes(storageRef, file);
      const signedUrl = await getDownloadURL(storageRef);

      // Mettre à jour le document dans Firestore
      const docRef = doc(db, 'generatedDocuments', document.id);
      await updateDoc(docRef, {
        isSigned: true,
        signedFileUrl: signedUrl,
        signedAt: new Date(),
        signedBy: currentUser?.uid,
        updatedAt: new Date()
      });

      // Mettre à jour l'état local
      setGeneratedDocuments(prev => prev.map(doc => 
        doc.id === document.id 
          ? {
              ...doc,
              isSigned: true,
              signedFileUrl: signedUrl,
              signedAt: new Date(),
              signedBy: currentUser?.uid
            }
          : doc
      ));

      // Réinitialiser le champ de fichier
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Erreur lors du téléversement de la version signée:', error);
      setError('Erreur lors du téléversement de la version signée');
    } finally {
      setUploadingDoc(null);
    }
  };

  // Fonction pour obtenir le libellé du type de document
  const getDocumentTypeLabel = (type: string): string => {
    return DOCUMENT_TYPES[type as DocumentType] || type;
  };

  // Trier les documents par type
  const documentTypes = [
    'proposition_commerciale',
    'lettre_mission',
    'convention_entreprise',
    'convention_etudiant',
    'avenant',
    'facture',
    'note_frais'
  ];

  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
  }, []);

  const handleRowClick = useCallback((document: GeneratedDocument) => {
    // Logique pour ouvrir le document
  }, []);

  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLButtonElement>, doc: GeneratedDocument) => {
    event.stopPropagation(); // Empêcher l'ouverture du fichier
    setAnchorEl(event.currentTarget);
    setSelectedDocument(doc);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
    setSelectedDocument(null);
  }, []);

  const handleRenameClick = useCallback(() => {
    setNewDocumentName(selectedDocument?.fileName || '');
    setRenameDialogOpen(true);
  }, [selectedDocument]);

  const handleNoteClick = useCallback(() => {
    setNoteDialogOpen(true);
  }, []);

  const handleDeleteClick = useCallback(() => {
    if (selectedDocument) {
      handleDeleteDocument(selectedDocument);
    }
    handleMenuClose();
  }, [selectedDocument]);

  const handleRenameDocument = async () => {
    if (!selectedDocument || !newDocumentName.trim()) return;

    try {
      const docRef = doc(db, 'generatedDocuments', selectedDocument.id);
      await updateDoc(docRef, {
        fileName: newDocumentName,
        updatedAt: new Date()
      });

      setGeneratedDocuments(prev => prev.map(doc => 
        doc.id === selectedDocument.id 
          ? { ...doc, fileName: newDocumentName }
          : doc
      ));

      setRenameDialogOpen(false);
      setNewDocumentName('');
      enqueueSnackbar('Document renommé avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors du renommage:', error);
      enqueueSnackbar('Erreur lors du renommage du document', { variant: 'error' });
    }
  };

  const handleSaveNote = useCallback(async () => {
    if (!selectedDocument || !documentNote.trim()) {
      console.log('Document ou note manquant:', { selectedDocument, documentNote });
      return;
    }

    try {
      console.log('Début de l\'enregistrement de la note:', {
        documentId: selectedDocument.id,
        noteContent: documentNote
      });

      const noteData = {
        content: documentNote.trim(),
        documentId: selectedDocument.id,
        documentName: selectedDocument.fileName,
        missionId: selectedDocument.missionId,
        createdAt: new Date(),
        createdBy: currentUser?.uid || '',
        createdByName: currentUser?.displayName || 'Utilisateur inconnu',
        createdByPhotoURL: currentUser?.photoURL || null, // Utiliser null au lieu de undefined
        type: 'document' as const
      };

      console.log('Données de la note à enregistrer:', noteData);

      const docRef = await addDoc(collection(db, 'notes'), noteData);
      console.log('Note enregistrée avec l\'ID:', docRef.id);

      const newNote = {
        id: docRef.id,
        ...noteData
      } as DocumentNote;

      // Mettre à jour l'état local avec la nouvelle note
      setDocumentNotes(prev => {
        console.log('Mise à jour des notes:', [...prev, newNote]);
        return [newNote, ...prev];
      });

      // Envoyer des notifications aux utilisateurs taggés
      if (documentTaggedUsers.length > 0) {
        const notificationPromises = documentTaggedUsers.map(user => 
          NotificationService.sendToUser(
            user.id,
            'mission_update',
            'Nouvelle note sur un document',
            `${currentUser?.displayName || currentUser?.email} vous a mentionné dans une note sur le document "${selectedDocument.fileName}" de la mission ${mission?.numeroMission || selectedDocument.missionNumber}`,
            'medium',
            {
              missionId: selectedDocument.missionId,
              missionNumber: mission?.numeroMission || selectedDocument.missionNumber,
              documentId: selectedDocument.id,
              documentName: selectedDocument.fileName,
              noteId: docRef.id,
              mentionedBy: currentUser?.uid,
              source: 'audit',
              redirectUrl: `/app/audit/mission/${selectedDocument.missionId}`
            }
          )
        );

        try {
          await Promise.all(notificationPromises);
          enqueueSnackbar(`${documentTaggedUsers.length} notification(s) envoyée(s)`, { variant: 'success' });
        } catch (notificationError) {
          console.error('Erreur lors de l\'envoi des notifications:', notificationError);
          // Ne pas faire échouer l'ajout de la note si les notifications échouent
        }
      }
      
      // Fermer la boîte de dialogue et réinitialiser le champ de note
      setNoteDialogOpen(false);
      setDocumentNote('');
      setDocumentTaggedUsers([]);
      
      enqueueSnackbar('Note ajoutée avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur détaillée lors de l\'ajout de la note:', error);
      enqueueSnackbar('Erreur lors de l\'ajout de la note', { variant: 'error' });
    }
  }, [selectedDocument, documentNote, currentUser, documentTaggedUsers, mission, enqueueSnackbar]);

  const handleMarkAsSigned = async () => {
    if (!selectedDocument) return;

    try {
      const docRef = doc(db, 'generatedDocuments', selectedDocument.id);
      await updateDoc(docRef, {
        isSigned: true,
        signedAt: new Date(),
        signedBy: currentUser?.uid,
        updatedAt: new Date()
      });

      setGeneratedDocuments(prev => prev.map(doc => 
        doc.id === selectedDocument.id 
          ? { 
              ...doc, 
              isSigned: true,
              signedAt: new Date(),
              signedBy: currentUser?.uid
            }
          : doc
      ));

      handleMenuClose();
      enqueueSnackbar('Document marqué comme signé', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors du marquage du document comme signé:', error);
      enqueueSnackbar('Erreur lors du marquage du document', { variant: 'error' });
    }
  };

  // Modifier la fonction de chargement des notes de document
  useEffect(() => {
    const fetchDocumentNotes = async () => {
      if (!mission?.id) {
        console.log('Mission ID manquant pour le chargement des notes');
        return;
      }

      try {
        console.log('Chargement des notes pour la mission:', mission.id);
        const notesRef = collection(db, 'notes');
        const q = query(
          notesRef,
          where('missionId', '==', mission.id),
          where('type', '==', 'document')
        );

        const snapshot = await getDocs(q);
        const notes = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate()
        })) as DocumentNote[];

        console.log('Notes chargées:', notes);

        // Trier les notes par date de création (les plus récentes en premier)
        notes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setDocumentNotes(notes);
      } catch (error) {
        console.error('Erreur lors du chargement des notes:', error);
      }
    };

    fetchDocumentNotes();
  }, [mission?.id]);

  // Modifier la fonction de chargement des notes de mission
  useEffect(() => {
    const fetchMissionNotes = async () => {
      if (!mission?.id) return;

      try {
        console.log('Chargement des notes pour la mission:', mission.id);
        const notesRef = collection(db, 'notes');
        const q = query(
          notesRef,
          where('missionId', '==', mission.id),
          where('type', '==', 'mission')
        );

        const snapshot = await getDocs(q);
        console.log('Notes récupérées:', snapshot.docs.length);
        
        const notes = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate()
        })) as MissionNote[];

        console.log('Notes transformées:', notes);

        // Organiser les notes et leurs réponses
        const mainNotes = notes.filter(note => !note.isReply);
        const replies = notes.filter(note => note.isReply);

        console.log('Notes principales:', mainNotes);
        console.log('Réponses:', replies);

        // Créer une liste ordonnée avec les réponses placées après leurs notes parentes
        const organizedNotes: MissionNote[] = [];
        mainNotes.forEach(note => {
          organizedNotes.push(note);
          const noteReplies = replies.filter(reply => reply.replyToNoteId === note.id);
          console.log(`Réponses pour la note ${note.id}:`, noteReplies);
          organizedNotes.push(...noteReplies);
        });

        // Trier par date de création
        organizedNotes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        console.log('Notes organisées finales:', organizedNotes);
        setMissionNotesList(organizedNotes);
      } catch (error) {
        console.error('Erreur lors du chargement des notes de mission:', error);
      }
    };

    fetchMissionNotes();
  }, [mission?.id]);

  const handleAddDocument = () => {
    setAddDocumentDialogOpen(true);
  };

  const handleCloseAddDocument = () => {
    setAddDocumentDialogOpen(false);
    setSelectedDocumentType('');
    setIsDocumentSigned(false);
    setDocumentFile(null);
  };

  const handleDocumentTypeChange = (event: SelectChangeEvent) => {
    setSelectedDocumentType(event.target.value);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setDocumentFile(event.target.files[0]);
    }
  };

  const handleSubmitDocument = async () => {
    if (!documentFile || !selectedDocumentType || !mission) return;

    try {
      // Vérifier que Firebase Storage est disponible et valide
      // Essayer d'obtenir une instance Storage (asynchrone si nécessaire)
      let storageInstance = storage;
      if (!storageInstance && app) {
        console.log('⏳ Storage null, tentative d\'initialisation asynchrone...');
        try {
          storageInstance = await getStorageInstance();
        } catch (error) {
          console.error('❌ Erreur lors de l\'initialisation asynchrone:', error);
        }
      }
      
      if (!storageInstance || !app) {
        console.error('Firebase Storage non disponible - storage:', !!storageInstance, 'app:', !!app, 'isAvailable:', isStorageAvailable());
        enqueueSnackbar(
          'Erreur: Firebase Storage n\'est pas activé dans votre projet Firebase. Veuillez activer Storage dans la console Firebase (console.firebase.google.com) puis recharger la page.',
          { variant: 'error', autoHideDuration: 10000 }
        );
        return;
      }

      // Fonction helper pour déterminer le contentType basé sur l'extension
      const getContentTypeFromFileName = (fileName: string): string => {
        const extension = fileName.split('.').pop()?.toLowerCase();
        const contentTypeMap: Record<string, string> = {
          'pdf': 'application/pdf',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'ppt': 'application/vnd.ms-powerpoint',
          'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'txt': 'text/plain',
          'csv': 'text/csv'
        };
        return contentTypeMap[extension || ''] || 'application/octet-stream';
      };

      // Déterminer le contentType
      let contentType = documentFile.type || getContentTypeFromFileName(documentFile.name);
      
      // Logger les informations du fichier pour le débogage
      console.log('📤 Informations du fichier à uploader:', {
        name: documentFile.name,
        size: documentFile.size,
        type: documentFile.type,
        contentType: contentType,
        lastModified: documentFile.lastModified
      });

      // Vérifier que le contentType est autorisé par les règles Storage
      const allowedContentTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      const isImage = contentType.startsWith('image/');
      const isText = contentType.startsWith('text/');
      
      if (!allowedContentTypes.includes(contentType) && !isImage && !isText) {
        console.warn('⚠️ ContentType non autorisé:', contentType);
        enqueueSnackbar(`Type de fichier non autorisé: ${contentType}. Types acceptés: PDF, Word, PowerPoint, Excel, images, texte.`, { variant: 'error' });
        return;
      }

      // Créer un nouveau File avec le contentType correct si nécessaire
      let fileToUpload = documentFile;
      if (!documentFile.type || documentFile.type === 'application/octet-stream') {
        // Créer un nouveau File avec le contentType correct
        fileToUpload = new File([documentFile], documentFile.name, { type: contentType });
        console.log('📝 ContentType corrigé:', contentType);
      }

      // Créer le chemin de stockage
      const storagePath = `missions/${mission.id}/documents/${fileToUpload.name}`;
      
      let storageRef;
      try {
        storageRef = ref(storageInstance, storagePath);
        console.log('✅ Référence Storage créée:', storagePath);
      } catch (refError: any) {
        console.error('❌ Erreur lors de la création de la référence Storage:', refError);
        enqueueSnackbar('Erreur: Impossible de créer la référence de stockage. Firebase Storage n\'est pas correctement initialisé.', { variant: 'error' });
        return;
      }

      // Téléverser le fichier avec gestion d'erreur améliorée
      try {
        console.log('⏳ Début de l\'upload vers Firebase Storage...');
        console.log('📋 Fichier final:', {
          name: fileToUpload.name,
          size: fileToUpload.size,
          type: fileToUpload.type
        });
        await uploadBytes(storageRef, fileToUpload);
        console.log('✅ Upload réussi vers Firebase Storage');
        
        const fileUrl = await getDownloadURL(storageRef);
        console.log('✅ URL de téléchargement obtenue:', fileUrl);

      // Créer le document dans Firestore
      const documentData: Omit<GeneratedDocument, 'id'> = {
        missionId: mission.id,
        missionNumber: mission.numeroMission || '',
        missionTitle: mission.description || '',
        structureId: mission.structureId || '',
        documentType: selectedDocumentType,
        fileName: documentFile.name,
        fileUrl: fileUrl,
        fileSize: documentFile.size,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        isSigned: isDocumentSigned,
        createdBy: currentUser?.uid || '',
        isAudited: false,
        auditedAt: null,
        auditedBy: null,
        auditNotes: null,
        signedFileUrl: null,
        signedAt: null,
        signedBy: null
      };

        const docRef = await addDoc(collection(db, 'generatedDocuments'), documentData);
        const newDocument = { id: docRef.id, ...documentData };
        
        // Mettre à jour l'état local
        setGeneratedDocuments(prev => [newDocument, ...prev]);
        
        // Fermer la boîte de dialogue et réinitialiser les champs
        handleCloseAddDocument();
        
        enqueueSnackbar('Document ajouté avec succès', { variant: 'success' });
      } catch (uploadError: any) {
        console.error('❌ Erreur lors de l\'upload:', uploadError);
        console.error('Détails de l\'erreur:', {
          code: uploadError.code,
          message: uploadError.message,
          serverResponse: uploadError.serverResponse
        });
        
        // Messages d'erreur plus spécifiques
        let errorMessage = 'Erreur lors de l\'ajout du document';
        if (uploadError.code === 'storage/unauthorized') {
          errorMessage = 'Erreur: Vous n\'avez pas la permission d\'uploader ce fichier. Vérifiez les règles de sécurité Storage.';
        } else if (uploadError.code === 'storage/invalid-format') {
          errorMessage = 'Erreur: Format de fichier non autorisé. Types acceptés: PDF, Word, PowerPoint, Excel, images, texte.';
        } else if (uploadError.code === 'storage/quota-exceeded') {
          errorMessage = 'Erreur: Quota de stockage dépassé.';
        } else if (uploadError.message) {
          errorMessage = `Erreur: ${uploadError.message}`;
        }
        
        enqueueSnackbar(errorMessage, { variant: 'error', autoHideDuration: 8000 });
      }
    } catch (error: any) {
      console.error('❌ Erreur générale lors de l\'ajout du document:', error);
      enqueueSnackbar('Erreur lors de l\'ajout du document', { variant: 'error' });
    }
  };

  const handleDeleteNote = useCallback(async (noteId: string) => {
    try {
      await deleteDoc(doc(db, 'notes', noteId));
      setDocumentNotes(prev => prev.filter(note => note.id !== noteId));
      enqueueSnackbar('Note supprimée avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de la suppression de la note:', error);
      enqueueSnackbar('Erreur lors de la suppression de la note', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  const handleToggleSigned = useCallback(async (document: GeneratedDocument) => {
    try {
      const docRef = doc(db, 'generatedDocuments', document.id);
      const newSignedState = !document.isSigned;
      
      await updateDoc(docRef, {
        isSigned: newSignedState,
        signedAt: newSignedState ? new Date() : null,
        signedBy: newSignedState ? currentUser?.uid : null,
        updatedAt: new Date()
      });

      setGeneratedDocuments(prev => prev.map(doc => 
        doc.id === document.id 
          ? { 
              ...doc, 
              isSigned: newSignedState,
              signedAt: newSignedState ? new Date() : null,
              signedBy: newSignedState ? currentUser?.uid : null
            }
          : doc
      ));

      enqueueSnackbar(
        newSignedState ? 'Document marqué comme signé' : 'Document marqué comme non signé', 
        { variant: 'success' }
      );
    } catch (error) {
      console.error('Erreur lors de la modification du statut de signature:', error);
      enqueueSnackbar('Erreur lors de la modification du statut', { variant: 'error' });
    }
  }, [currentUser, enqueueSnackbar]);

  const handleSaveMissionNote = useCallback(async () => {
    if (!missionId || !missionNotes.trim()) return;

    try {
      const noteData = {
        content: missionNotes.trim(),
        missionId,
        createdAt: new Date(),
        createdBy: currentUser?.uid || '',
        createdByName: currentUser?.displayName || 'Utilisateur inconnu',
        createdByPhotoURL: currentUser?.photoURL || null, // Utiliser null au lieu de undefined
        type: 'mission' as const,
        isClosed: false,
        isReply: false,
        replyToNoteId: ''
      };

      const docRef = await addDoc(collection(db, 'notes'), noteData);
      
      const newNote = {
        id: docRef.id,
        ...noteData
      } as MissionNote;

      setMissionNotesList(prev => [newNote, ...prev]);
      setMissionNotes('');

      // Envoyer des notifications aux utilisateurs taggés
      if (taggedUsers.length > 0) {
        const notificationPromises = taggedUsers.map(user => 
          NotificationService.sendToUser(
            user.id,
            'mission_update',
            'Nouvelle note sur la mission',
            `${currentUser?.displayName || currentUser?.email} vous a mentionné dans une note sur la mission ${mission?.numeroMission}`,
            'medium',
            {
              missionId,
              missionNumber: mission?.numeroMission,
              noteId: docRef.id,
              mentionedBy: currentUser?.uid,
              source: 'audit',
              redirectUrl: `/app/audit/mission/${missionId}`
            }
          )
        );

        try {
          await Promise.all(notificationPromises);
          enqueueSnackbar(`${taggedUsers.length} notification(s) envoyée(s)`, { variant: 'success' });
        } catch (notificationError) {
          console.error('Erreur lors de l\'envoi des notifications:', notificationError);
        }
      }

      enqueueSnackbar('Note ajoutée avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la note:', error);
      enqueueSnackbar('Erreur lors de l\'ajout de la note', { variant: 'error' });
    }
  }, [missionId, missionNotes, currentUser, taggedUsers, mission, enqueueSnackbar]);

  const handleNoteMenuOpen = (event: React.MouseEvent<HTMLButtonElement>, note: MissionNote) => {
    event.stopPropagation();
    setNoteMenuAnchorEl(event.currentTarget);
    setSelectedNote(note);
  };

  const handleNoteMenuClose = () => {
    setNoteMenuAnchorEl(null);
    setSelectedNote(null);
  };

  const handleEditNote = () => {
    if (selectedNote) {
      setEditedNoteContent(selectedNote.content);
      setEditNoteDialogOpen(true);
    }
    handleNoteMenuClose();
  };

  const handleReplyNote = () => {
    if (selectedNote) {
      console.log('Note sélectionnée pour la réponse:', selectedNote);
      setReplyingToNote(selectedNote);
      setReplyContent('');
      setReplyNoteDialogOpen(true);
    }
    handleNoteMenuClose();
  };

  const handleCloseNote = async () => {
    if (!selectedNote || selectedNote.isReply) return;

    try {
      // Mettre à jour la note principale
      const noteRef = doc(db, 'notes', selectedNote.id);
      await updateDoc(noteRef, {
        isClosed: true,
        closedAt: new Date(),
        closedBy: currentUser?.uid
      });

      // Trouver et mettre à jour toutes les réponses associées
      const replies = missionNotesList.filter(reply => 
        reply.isReply && reply.replyToNoteId === selectedNote.id
      );

      const updatePromises = replies.map(reply => {
        const replyRef = doc(db, 'notes', reply.id);
        return updateDoc(replyRef, {
          isClosed: true,
          closedAt: new Date(),
          closedBy: currentUser?.uid
        });
      });

      await Promise.all(updatePromises);

      // Mettre à jour l'état local
      setMissionNotesList(prev => prev.map(note => 
        note.id === selectedNote.id || (note.isReply && note.replyToNoteId === selectedNote.id)
          ? { ...note, isClosed: true, closedAt: new Date(), closedBy: currentUser?.uid }
          : note
      ));

      enqueueSnackbar('Note et réponses clôturées avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de la clôture de la note:', error);
      enqueueSnackbar('Erreur lors de la clôture de la note', { variant: 'error' });
    }
    handleNoteMenuClose();
  };

  const handleReopenNote = async () => {
    if (!selectedNote || selectedNote.isReply) return;

    try {
      // Mettre à jour la note principale
      const noteRef = doc(db, 'notes', selectedNote.id);
      await updateDoc(noteRef, {
        isClosed: false,
        closedAt: null,
        closedBy: null
      });

      // Trouver et mettre à jour toutes les réponses associées
      const replies = missionNotesList.filter(reply => 
        reply.isReply && reply.replyToNoteId === selectedNote.id
      );

      const updatePromises = replies.map(reply => {
        const replyRef = doc(db, 'notes', reply.id);
        return updateDoc(replyRef, {
          isClosed: false,
          closedAt: null,
          closedBy: null
        });
      });

      await Promise.all(updatePromises);

      // Mettre à jour l'état local
      setMissionNotesList(prev => prev.map(note => 
        note.id === selectedNote.id || (note.isReply && note.replyToNoteId === selectedNote.id)
          ? { ...note, isClosed: false, closedAt: null, closedBy: null }
          : note
      ));

      enqueueSnackbar('Note et réponses réouvertes avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de la réouverture de la note:', error);
      enqueueSnackbar('Erreur lors de la réouverture de la note', { variant: 'error' });
    }
    handleNoteMenuClose();
  };

  const handleSaveEditedNote = async () => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible de modifier une note d\'une mission archivée', { variant: 'error' });
      return;
    }

    if (!selectedNote || !editedNoteContent.trim()) return;

    try {
      const noteRef = doc(db, 'notes', selectedNote.id);
      await updateDoc(noteRef, {
        content: editedNoteContent.trim(),
        updatedAt: new Date()
      });

      setMissionNotesList(prev => prev.map(note => 
        note.id === selectedNote.id 
          ? { ...note, content: editedNoteContent.trim(), updatedAt: new Date() }
          : note
      ));

      setEditNoteDialogOpen(false);
      enqueueSnackbar('Note modifiée avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors de la modification de la note:', error);
      enqueueSnackbar('Erreur lors de la modification de la note', { variant: 'error' });
    }
  };

  const handleSaveReply = async () => {
    if (mission?.isArchived) {
      enqueueSnackbar('Impossible d\'ajouter une réponse à une mission archivée', { variant: 'error' });
      return;
    }

    console.log('Début handleSaveReply');
    console.log('Note à laquelle on répond:', replyingToNote);
    console.log('Contenu de la réponse:', replyContent);

    if (!replyingToNote || !replyContent.trim()) {
      console.log('Validation échouée:', { replyingToNote, replyContent });
      return;
    }

    try {
      console.log('Préparation des données de réponse');
      const replyData = {
        content: replyContent.trim(),
        missionId: replyingToNote.missionId,
        createdAt: new Date(),
        createdBy: currentUser?.uid || '',
        createdByName: currentUser?.displayName || 'Utilisateur inconnu',
        createdByPhotoURL: currentUser?.photoURL || null, // Utiliser null au lieu de undefined
        type: 'mission' as const,
        isReply: true,
        replyToNoteId: replyingToNote.id,
        isClosed: false
      };

      console.log('Données de réponse à enregistrer:', replyData);

      const docRef = await addDoc(collection(db, 'notes'), replyData);
      console.log('Réponse enregistrée avec l\'ID:', docRef.id);
      
      // Créer la nouvelle réponse avec l'ID généré
      const newReply = {
        id: docRef.id,
        ...replyData,
        createdAt: new Date()
      } as MissionNote;

      console.log('Nouvelle réponse créée:', newReply);

      // Mettre à jour l'état local
      setMissionNotesList(prevNotes => {
        console.log('Notes actuelles:', prevNotes);
        const updatedNotes = [...prevNotes];
        const parentNoteIndex = updatedNotes.findIndex(note => note.id === replyingToNote.id);
        console.log('Index de la note parente:', parentNoteIndex);
        
        if (parentNoteIndex !== -1) {
          // Insérer la réponse juste après la note parente
          updatedNotes.splice(parentNoteIndex + 1, 0, newReply);
          console.log('Réponse insérée après la note parente');
        } else {
          // Si la note parente n'est pas trouvée, ajouter au début
          updatedNotes.unshift(newReply);
          console.log('Réponse ajoutée au début car note parente non trouvée');
        }
        
        console.log('Notes mises à jour:', updatedNotes);
        return updatedNotes;
      });

      // Envoyer des notifications aux utilisateurs taggés
      if (replyTaggedUsers.length > 0) {
        const notificationPromises = replyTaggedUsers.map(user => 
          NotificationService.sendToUser(
            user.id,
            'mission_update',
            'Réponse à une note',
            `${currentUser?.displayName || currentUser?.email} vous a mentionné dans une réponse à une note sur la mission ${mission?.numeroMission}`,
            'medium',
            {
              missionId: replyingToNote.missionId,
              missionNumber: mission?.numeroMission,
              noteId: docRef.id,
              parentNoteId: replyingToNote.id,
              mentionedBy: currentUser?.uid,
              source: 'audit',
              redirectUrl: `/app/audit/mission/${replyingToNote.missionId}`
            }
          )
        );

        try {
          await Promise.all(notificationPromises);
          enqueueSnackbar(`${replyTaggedUsers.length} notification(s) envoyée(s)`, { variant: 'success' });
        } catch (notificationError) {
          console.error('Erreur lors de l\'envoi des notifications:', notificationError);
          // Ne pas faire échouer l'ajout de la réponse si les notifications échouent
        }
      }

      // Fermer la boîte de dialogue et réinitialiser le contenu
      setReplyNoteDialogOpen(false);
      setReplyContent('');
      setReplyingToNote(null);
      setReplyTaggedUsers([]);
      
      console.log('Réponse ajoutée avec succès');
      enqueueSnackbar('Réponse ajoutée avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur détaillée lors de l\'ajout de la réponse:', error);
      enqueueSnackbar('Erreur lors de l\'ajout de la réponse', { variant: 'error' });
    }
  };

  const handleArchiveMission = async () => {
    // Vérifier que tous les documents sont audités
    const allDocumentsAudited = generatedDocuments.every(doc => doc.isAudited);
    if (!allDocumentsAudited) {
      enqueueSnackbar('Tous les documents doivent être audités avant d\'archiver la mission', { variant: 'error' });
      return;
    }

    // Vérifier que toutes les notes sont clôturées
    const allNotesClosed = missionNotesList.every(note => note.isClosed);
    if (!allNotesClosed) {
      enqueueSnackbar('Toutes les notes doivent être clôturées avant d\'archiver la mission', { variant: 'error' });
      return;
    }

    setConfirmArchiveDialogOpen(true);
  };

  const handleConfirmArchive = async () => {
    try {
      const missionRef = doc(db, 'missions', missionId!);
      await updateDoc(missionRef, {
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: currentUser?.uid
      });

      // Mettre à jour l'état local
      setMission(prev => prev ? {
        ...prev,
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: currentUser?.uid
      } : null);

      enqueueSnackbar('Mission archivée avec succès', { variant: 'success' });
      setConfirmArchiveDialogOpen(false);
    } catch (error) {
      console.error('Erreur lors de l\'archivage de la mission:', error);
      enqueueSnackbar('Erreur lors de l\'archivage de la mission', { variant: 'error' });
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={handleBackToAudit}
        >
          Retour à l'audit
        </Button>
      </Container>
    );
  }

  if (!mission) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          Mission non trouvée
        </Alert>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={handleBackToAudit}
        >
          Retour à l'audit
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ 
      p: { xs: 2, md: 4 },
      maxWidth: '1400px',
      margin: '0 auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <Grid container spacing={3}>
        {/* Colonne principale (75%) */}
        <Grid item xs={12} md={9}>
          <Paper sx={{ 
            p: 3, 
            mb: 3,
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
            bgcolor: '#fff'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={handleBackToAudit}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                Retour à l'audit
              </Button>
              {!mission?.isArchived && (
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={handleArchiveMission}
                  sx={{
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontWeight: 500,
                    borderColor: '#007AFF',
                    color: '#007AFF',
                    '&:hover': {
                      borderColor: '#0A84FF',
                      backgroundColor: 'rgba(0, 122, 255, 0.04)'
                    }
                  }}
                >
                  Archiver la mission
                </Button>
              )}
            </Box>

            <Typography variant="h4" sx={{ 
              fontWeight: 600,
              color: '#1d1d1f',
              mb: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 2
            }}>
              Mission #{mission?.numeroMission}
              {mission?.isArchived && (
                <Chip
                  label="Archivée"
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(0, 122, 255, 0.1)',
                    color: '#007AFF',
                    fontWeight: 500,
                    borderRadius: '6px'
                  }}
                />
              )}
            </Typography>

            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 2.5
                }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2
                  }}>
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
                      <BusinessIcon />
                    </Box>
                    <Box>
                      <Typography sx={{ 
                        fontSize: '0.875rem', 
                        color: '#86868b',
                        mb: 0.5
                      }}>
                        Entreprise
                      </Typography>
                      <Typography sx={{ 
                        fontSize: '1rem',
                        fontWeight: 500,
                        color: '#1d1d1f'
                      }}>
                        {mission?.company || '-'}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2
                  }}>
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
                      <LocationOnIcon />
                    </Box>
                    <Box>
                      <Typography sx={{ 
                        fontSize: '0.875rem', 
                        color: '#86868b',
                        mb: 0.5
                      }}>
                        Localisation
                      </Typography>
                      <Typography sx={{ 
                        fontSize: '1rem',
                        fontWeight: 500,
                        color: '#1d1d1f'
                      }}>
                        {mission?.location || '-'}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2
                  }}>
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
                      <PersonIcon />
                    </Box>
                    <Box>
                      <Typography sx={{ 
                        fontSize: '0.875rem', 
                        color: '#86868b',
                        mb: 0.5
                      }}>
                        Auditeur
                      </Typography>
                      <Typography sx={{ 
                        fontSize: '1rem',
                        fontWeight: 500,
                        color: '#1d1d1f'
                      }}>
                        {mission?.auditor && userNames[mission.auditor] ? userNames[mission.auditor] : 'Non assigné'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 2.5
                }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2
                  }}>
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
                      <PersonIcon />
                    </Box>
                    <Box>
                      <Typography sx={{ 
                        fontSize: '0.875rem', 
                        color: '#86868b',
                        mb: 0.5
                      }}>
                        Chargé de mission
                      </Typography>
                      <Typography sx={{ 
                        fontSize: '1rem',
                        fontWeight: 500,
                        color: '#1d1d1f'
                      }}>
                        {mission?.missionManager || 'Non assigné'}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2
                  }}>
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
                      <CalendarIcon />
                    </Box>
                    <Box>
                      <Typography sx={{ 
                        fontSize: '0.875rem', 
                        color: '#86868b',
                        mb: 0.5
                      }}>
                        Période
                      </Typography>
                      <Typography sx={{ 
                        fontSize: '1rem',
                        fontWeight: 500,
                        color: '#1d1d1f'
                      }}>
                        {mission?.startDate ? new Date(mission.startDate).toLocaleDateString() : '-'} - {mission?.endDate ? new Date(mission.endDate).toLocaleDateString() : '-'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Documents générés */}
          <Paper sx={{ 
            p: 3,
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
            bgcolor: '#fff'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Documents</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddDocument}
                disabled={mission?.isArchived}
                sx={{
                  opacity: mission?.isArchived ? 0.5 : 1,
                  '&.Mui-disabled': {
                    backgroundColor: 'rgba(0, 0, 0, 0.12)',
                    color: 'rgba(0, 0, 0, 0.26)'
                  }
                }}
              >
                Ajouter un document
              </Button>
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nom du document</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Généré par</TableCell>
                    <TableCell>Date de création</TableCell>
                    <TableCell>Statut</TableCell>
                    <TableCell>Statut d'audit</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {documentTypes.map((docType) => {
                    const documents = generatedDocuments.filter(doc => doc.documentType === docType);
                    if (documents.length === 0) return null;

                    return (
                      <React.Fragment key={docType}>
                        <TableRow
                          sx={{
                            backgroundColor: '#f5f5f7',
                          }}
                        >
                          <TableCell
                            colSpan={7}
                            sx={{
                              py: 1.5,
                              px: 2,
                              fontWeight: 500,
                              color: '#1d1d1f',
                            }}
                          >
                            {getDocumentTypeLabel(docType)} ({documents.length})
                          </TableCell>
                        </TableRow>
                        {documents.map((doc) => (
                          <TableRow 
                            key={doc.id}
                            onClick={() => window.open(doc.fileUrl, '_blank')}
                            sx={{
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: 'rgba(0, 0, 0, 0.02)',
                              },
                            }}
                          >
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <FileText size={20} />
                                <Typography sx={{ 
                                  fontSize: '0.875rem',
                                  color: '#1d1d1f'
                                }}>
                                  {doc.fileName}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={getDocumentTypeLabel(doc.documentType)}
                                size="small"
                                sx={{
                                  backgroundColor: 'rgba(0, 122, 255, 0.1)',
                                  color: '#007AFF',
                                  fontWeight: 500,
                                  borderRadius: '6px'
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography sx={{ fontSize: '0.875rem' }}>
                                  {userNames[doc.createdBy] || 'N/A'}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography sx={{ fontSize: '0.875rem' }}>
                                {doc.createdAt.toLocaleDateString()}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleSigned(doc);
                                }}
                                startIcon={doc.isSigned ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
                                sx={{
                                  borderColor: doc.isSigned ? '#34C759' : '#FF9500',
                                  color: doc.isSigned ? '#34C759' : '#FF9500',
                                  backgroundColor: doc.isSigned ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 149, 0, 0.1)',
                                  '&:hover': {
                                    borderColor: doc.isSigned ? '#32B350' : '#FF9500',
                                    backgroundColor: doc.isSigned ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255, 149, 0, 0.2)',
                                  },
                                  textTransform: 'none',
                                  borderRadius: '8px',
                                  fontWeight: 500
                                }}
                              >
                                {doc.isSigned ? 'Signé' : 'Non signé'}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleAudit(doc);
                                }}
                                startIcon={doc.isAudited ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
                                sx={{
                                  borderColor: doc.isAudited ? '#34C759' : '#FF9500',
                                  color: doc.isAudited ? '#34C759' : '#FF9500',
                                  backgroundColor: doc.isAudited ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 149, 0, 0.1)',
                                  '&:hover': {
                                    borderColor: doc.isAudited ? '#32B350' : '#FF9500',
                                    backgroundColor: doc.isAudited ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255, 149, 0, 0.2)',
                                  },
                                  textTransform: 'none',
                                  borderRadius: '8px',
                                  fontWeight: 500
                                }}
                              >
                                {doc.isAudited ? 'Audité' : 'Non audité'}
                              </Button>
                            </TableCell>
                            <TableCell align="right">
                              <IconButton
                                onClick={(e) => handleMenuOpen(e, doc)}
                                size="small"
                                sx={{ 
                                  color: '#86868b',
                                  '&:hover': {
                                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                                  }
                                }}
                              >
                                <MoreVertIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Colonne des notes (25%) */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ 
            p: 3,
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
            bgcolor: '#fff',
            position: 'sticky',
            top: 24
          }}>
            <Typography variant="h6" sx={{ 
              fontWeight: 500,
              color: '#1d1d1f',
              mb: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              <NoteAddIcon sx={{ fontSize: 20 }} />
              Notes d'audit
            </Typography>

            {/* Liste des notes */}
            <Box sx={{ 
              maxHeight: 'calc(100vh - 400px)',
              overflowY: 'auto',
              mb: 3
            }}>
              {/* Combiner les notes de mission et les notes de documents */}
              {[...missionNotesList, ...documentNotes].length === 0 ? (
                <Typography 
                  variant="body2" 
                  sx={{ 
                    textAlign: 'center',
                    color: '#86868b',
                    py: 4
                  }}
                >
                  Aucune note pour le moment
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Notes de mission */}
                  {missionNotesList
                    .filter(note => !note.isReply) // Ne pas afficher les réponses ici
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // Trier par date (plus récent en premier)
                    .map((note) => {
                    // Trouver toutes les réponses pour cette note
                    const replies = missionNotesList.filter(reply => 
                      reply.isReply && reply.replyToNoteId === note.id
                    );

                    return (
                      <Box key={note.id} sx={{ mb: 2 }}>
                        {/* Note principale */}
                        <Paper
                          sx={{
                            p: 2,
                            backgroundColor: note.isClosed ? '#f8f8f8' : '#f5f5f7',
                            borderRadius: '12px',
                            border: '1px solid',
                            borderColor: note.isClosed ? 'rgba(0, 0, 0, 0.08)' : 'divider',
                            position: 'relative',
                            opacity: note.isClosed ? 0.85 : 1,
                            transition: 'all 0.2s ease-in-out',
                            '&::before': note.isClosed ? {
                              content: '""',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '4px',
                              height: '100%',
                              backgroundColor: '#34C759',
                              borderTopLeftRadius: '12px',
                              borderBottomLeftRadius: '12px'
                            } : {}
                          }}
                        >
                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Avatar
                                  src={note.createdByPhotoURL}
                                  sx={{ 
                                    width: 24, 
                                    height: 24,
                                    opacity: note.isClosed ? 0.7 : 1
                                  }}
                                >
                                  {note.createdByName.charAt(0)}
                                </Avatar>
                                <Typography 
                                  component="span" 
                                  variant="subtitle2" 
                                  sx={{ 
                                    fontWeight: 500,
                                    color: note.isClosed ? '#86868b' : '#1d1d1f'
                                  }}
                                >
                                  {note.createdByName}
                                </Typography>
                                <Typography 
                                  component="span" 
                                  variant="caption" 
                                  sx={{ 
                                    color: note.isClosed ? '#86868b' : '#86868b',
                                    opacity: note.isClosed ? 0.7 : 1
                                  }}
                                >
                                  {note.createdAt.toLocaleDateString()}
                                </Typography>
                              </Box>
                              <IconButton
                                size="small"
                                onClick={(e) => handleNoteMenuOpen(e, note)}
                                sx={{ 
                                  color: '#86868b',
                                  '&:hover': {
                                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                                  }
                                }}
                              >
                                <MoreVertIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>
                          <Box 
                            sx={{ 
                              whiteSpace: 'pre-wrap',
                              color: note.isClosed ? '#86868b' : '#1d1d1f',
                              opacity: note.isClosed ? 0.8 : 1,
                              fontSize: '0.875rem',
                              lineHeight: 1.5
                            }}
                          >
                            {note.content}
                          </Box>

                          {/* Réponses dans la même bulle */}
                          {replies.length > 0 && (
                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(0, 0, 0, 0.08)' }}>
                              {replies
                                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()) // Trier les réponses par date (plus ancien en premier)
                                .map((reply) => (
                                <Box key={reply.id} sx={{ mb: 2, '&:last-child': { mb: 0 } }}>
                                  <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 1,
                                    mb: 1,
                                    color: '#007AFF',
                                    fontSize: '0.75rem',
                                    fontWeight: 500
                                  }}>
                                    <ReplyIcon sx={{ fontSize: 16 }} />
                                    <Typography variant="caption">
                                      Réponse de {reply.createdByName}
                                    </Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Avatar
                                        src={reply.createdByPhotoURL}
                                        sx={{ 
                                          width: 24, 
                                          height: 24,
                                          opacity: reply.isClosed ? 0.7 : 1
                                        }}
                                      >
                                        {reply.createdByName.charAt(0)}
                                      </Avatar>
                                      <Typography 
                                        component="span" 
                                        variant="caption" 
                                        sx={{ 
                                          color: reply.isClosed ? '#86868b' : '#86868b',
                                          opacity: reply.isClosed ? 0.7 : 1
                                        }}
                                      >
                                        {reply.createdAt.toLocaleDateString()}
                                      </Typography>
                                    </Box>
                                    <IconButton
                                      size="small"
                                      onClick={(e) => handleNoteMenuOpen(e, reply)}
                                      sx={{ 
                                        color: '#86868b',
                                        '&:hover': {
                                          backgroundColor: 'rgba(0, 0, 0, 0.04)'
                                        }
                                      }}
                                    >
                                      <MoreVertIcon fontSize="small" />
                                    </IconButton>
                                  </Box>
                                  <Box 
                                    sx={{ 
                                      whiteSpace: 'pre-wrap',
                                      color: reply.isClosed ? '#86868b' : '#1d1d1f',
                                      opacity: reply.isClosed ? 0.8 : 1,
                                      fontSize: '0.875rem',
                                      lineHeight: 1.5
                                    }}
                                  >
                                    {reply.content}
                                  </Box>
                                </Box>
                              ))}
                            </Box>
                          )}
                        </Paper>
                      </Box>
                    );
                  })}

                  {/* Notes de documents */}
                  {documentNotes
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // Trier par date (plus récent en premier)
                    .map((note) => (
                    <Box key={note.id} sx={{ mb: 2 }}>
                      <Paper
                        sx={{
                          p: 2,
                          backgroundColor: '#f5f5f7', // Même couleur que les notes basiques
                          borderRadius: '12px',
                          border: '1px solid',
                          borderColor: 'divider',
                          position: 'relative',
                          transition: 'all 0.2s ease-in-out',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '3px',
                            height: '100%',
                            backgroundColor: '#007AFF',
                            borderTopLeftRadius: '12px',
                            borderBottomLeftRadius: '12px'
                          }
                        }}
                      >
                        {/* Indicateur de document - plus subtil */}
                        <Box sx={{ 
                          mb: 1.5,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5
                        }}>
                          <DescriptionIcon sx={{ fontSize: 14, color: '#007AFF' }} />
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              color: '#007AFF',
                              fontSize: '0.75rem',
                              fontWeight: 500
                            }}
                          >
                            {note.documentName}
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar
                              src={note.createdByPhotoURL}
                              sx={{ width: 24, height: 24 }}
                            >
                              {note.createdByName.charAt(0)}
                            </Avatar>
                            <Typography 
                              component="span" 
                              variant="subtitle2" 
                              sx={{ 
                                fontWeight: 500,
                                color: '#1d1d1f'
                              }}
                            >
                              {note.createdByName}
                            </Typography>
                            <Typography 
                              component="span" 
                              variant="caption" 
                              sx={{ 
                                color: '#86868b'
                              }}
                            >
                              {note.createdAt.toLocaleDateString()}
                            </Typography>
                          </Box>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteNote(note.id)}
                            sx={{ 
                              color: '#FF3B30',
                              '&:hover': {
                                backgroundColor: 'rgba(255, 59, 48, 0.04)'
                              }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                        <Box 
                          sx={{ 
                            whiteSpace: 'pre-wrap',
                            color: '#1d1d1f',
                            fontSize: '0.875rem',
                            lineHeight: 1.5
                          }}
                        >
                          {note.content}
                        </Box>
                      </Paper>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            <TaggingInput
              value={missionNotes}
              onChange={setMissionNotes}
              placeholder={mission?.isArchived ? "Impossible d'ajouter des notes à une mission archivée" : "Ajouter une note générale..."}
              multiline={true}
              rows={4}
              availableUsers={availableUsers}
              onTaggedUsersChange={setTaggedUsers}
            />

            <Button
              fullWidth
              variant="contained"
              onClick={handleSaveMissionNote}
              disabled={!missionNotes.trim() || mission?.isArchived}
              sx={{
                mt: 2, // Ajouter du padding au-dessus du bouton
                backgroundColor: '#007AFF',
                '&:hover': {
                  backgroundColor: '#0A84FF'
                },
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 500,
                py: 1.5
              }}
            >
              Enregistrer la note
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Menu pour les actions sur les documents */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
        PaperProps={{
          sx: {
            mt: 1,
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
            borderRadius: '12px',
            minWidth: 180
          }
        }}
      >
        <MenuItem onClick={handleNoteClick} sx={{ py: 1.5 }} disabled={mission?.isArchived}>
          <ListItemIcon>
            <NoteAddIcon fontSize="small" sx={{ color: mission?.isArchived ? '#86868b' : '#007AFF' }} />
          </ListItemIcon>
          <ListItemText>Ajouter une note</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleRenameClick} sx={{ py: 1.5 }} disabled={mission?.isArchived}>
          <ListItemIcon>
            <EditIcon fontSize="small" sx={{ color: mission?.isArchived ? '#86868b' : '#007AFF' }} />
          </ListItemIcon>
          <ListItemText>Renommer</ListItemText>
        </MenuItem>
        <MenuItem 
          onClick={handleMarkAsSigned} 
          sx={{ py: 1.5 }}
          disabled={selectedDocument?.isSigned || mission?.isArchived}
        >
          <ListItemIcon>
            <CheckCircleOutlineIcon fontSize="small" sx={{ color: mission?.isArchived ? '#86868b' : '#34C759' }} />
          </ListItemIcon>
          <ListItemText>
            {selectedDocument?.isSigned ? 'Document signé' : 'Marquer comme signé'}
          </ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteClick} sx={{ py: 1.5, color: '#FF3B30' }} disabled={mission?.isArchived}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: mission?.isArchived ? '#86868b' : '#FF3B30' }} />
          </ListItemIcon>
          <ListItemText>Supprimer</ListItemText>
        </MenuItem>
      </Menu>

      {/* Dialog pour renommer le document */}
      <Dialog 
        open={renameDialogOpen} 
        onClose={() => setRenameDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
          }
        }}
      >
        <DialogTitle sx={{ 
          pb: 1,
          fontWeight: 500,
          color: '#1d1d1f'
        }}>
          Renommer le document
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            autoFocus
            fullWidth
            label="Nouveau nom"
            value={newDocumentName}
            onChange={(e) => setNewDocumentName(e.target.value)}
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                backgroundColor: '#f5f5f7',
                '& fieldset': {
                  borderColor: 'transparent'
                },
                '&:hover fieldset': {
                  borderColor: '#d2d2d7'
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#007AFF'
                }
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setRenameDialogOpen(false)}
            sx={{
              color: '#1d1d1f',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleRenameDocument}
            variant="contained"
            sx={{
              backgroundColor: '#007AFF',
              '&:hover': {
                backgroundColor: '#0A84FF'
              },
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 500
            }}
          >
            Renommer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog pour ajouter une note */}
      <Dialog 
        open={noteDialogOpen} 
        onClose={() => setNoteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
          }
        }}
      >
        <DialogTitle sx={{ 
          pb: 1,
          fontWeight: 500,
          color: '#1d1d1f'
        }}>
          Ajouter une note au document
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {/* Liste des notes existantes */}
          {documentNotes.filter(note => note.documentId === selectedDocument?.id).length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, color: '#1d1d1f' }}>
                Notes existantes
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {documentNotes
                  .filter(note => note.documentId === selectedDocument?.id)
                  .map((note) => (
                    <Paper
                      key={note.id}
                      sx={{
                        p: 2,
                        backgroundColor: '#f5f5f7',
                        borderRadius: '12px',
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar
                            src={note.createdByPhotoURL}
                            sx={{ width: 24, height: 24 }}
                          >
                            {note.createdByName.charAt(0)}
                          </Avatar>
                          <Typography component="span" variant="subtitle2" sx={{ fontWeight: 500 }}>
                            {note.createdByName}
                          </Typography>
                          <Typography component="span" variant="caption" sx={{ color: '#86868b' }}>
                            {note.createdAt.toLocaleDateString()}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteNote(note.id)}
                          sx={{ 
                            color: '#FF3B30',
                            '&:hover': {
                              backgroundColor: 'rgba(255, 59, 48, 0.04)'
                            }
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <Typography component="div" variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {note.content}
                      </Typography>
                    </Paper>
                  ))}
              </Box>
            </Box>
          )}

          {/* Champ pour ajouter une nouvelle note */}
          <TaggingInput
            value={documentNote}
            onChange={setDocumentNote}
            placeholder="Nouvelle note"
            multiline={true}
            rows={4}
            availableUsers={availableUsers}
            onTaggedUsersChange={setDocumentTaggedUsers}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setNoteDialogOpen(false)}
            sx={{
              color: '#1d1d1f',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSaveNote}
            variant="contained"
            disabled={!documentNote.trim()}
            sx={{
              backgroundColor: '#007AFF',
              '&:hover': {
                backgroundColor: '#0A84FF'
              },
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 500
            }}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Document Dialog */}
      <Dialog
        open={addDocumentDialogOpen}
        onClose={handleCloseAddDocument}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
          }
        }}
      >
        <DialogTitle sx={{ 
          pb: 1,
          fontWeight: 500,
          color: '#1d1d1f',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <DescriptionIcon sx={{ fontSize: 20, color: '#007AFF' }} />
          Ajouter un document
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Type de document</InputLabel>
              <Select
                value={selectedDocumentType}
                onChange={handleDocumentTypeChange}
                label="Type de document"
                sx={{
                  borderRadius: '12px',
                  backgroundColor: '#f5f5f7',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'transparent'
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d2d2d7'
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#007AFF'
                  }
                }}
              >
                <MenuItem value="proposition_commerciale">Proposition commerciale</MenuItem>
                <MenuItem value="lettre_mission">Lettre de mission</MenuItem>
                <MenuItem value="avenant">Avenant</MenuItem>
                <MenuItem value="note_frais">Note de frais</MenuItem>
                <MenuItem value="facture">Facture</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ 
              mb: 3,
              p: 3,
              border: '2px dashed',
              borderColor: '#d2d2d7',
              borderRadius: '12px',
              backgroundColor: '#f5f5f7',
              textAlign: 'center'
            }}>
              <input
                accept="application/pdf,.doc,.docx"
                style={{ display: 'none' }}
                id="document-file"
                type="file"
                onChange={handleFileChange}
              />
              <label htmlFor="document-file">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<UploadIcon />}
                  sx={{
                    borderColor: '#007AFF',
                    color: '#007AFF',
                    '&:hover': {
                      borderColor: '#0A84FF',
                      backgroundColor: 'rgba(0, 122, 255, 0.04)'
                    },
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontWeight: 500
                  }}
                >
                  Sélectionner un fichier
                </Button>
              </label>
              {documentFile ? (
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                  <FileText size={20} color="#1d1d1f" />
                  <Typography variant="body2" sx={{ color: '#1d1d1f' }}>
                    {documentFile.name}
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body2" sx={{ mt: 2, color: '#86868b' }}>
                  Glissez-déposez un fichier ou cliquez pour sélectionner
                </Typography>
              )}
            </Box>

            <FormControlLabel
              control={
                <Checkbox
                  checked={isDocumentSigned}
                  onChange={(e) => setIsDocumentSigned(e.target.checked)}
                  sx={{
                    color: '#007AFF',
                    '&.Mui-checked': {
                      color: '#007AFF',
                    },
                  }}
                />
              }
              label={
                <Typography sx={{ color: '#1d1d1f' }}>
                  Document signé
                </Typography>
              }
              sx={{
                '& .MuiFormControlLabel-label': {
                  fontSize: '0.875rem'
                }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={handleCloseAddDocument}
            sx={{
              color: '#1d1d1f',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmitDocument}
            variant="contained"
            disabled={!documentFile || !selectedDocumentType}
            sx={{
              backgroundColor: '#007AFF',
              '&:hover': {
                backgroundColor: '#0A84FF'
              },
              '&.Mui-disabled': {
                backgroundColor: 'rgba(0, 0, 0, 0.12)',
                color: 'rgba(0, 0, 0, 0.26)'
              },
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 500
            }}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Menu pour les actions sur les notes */}
      <Menu
        anchorEl={noteMenuAnchorEl}
        open={Boolean(noteMenuAnchorEl)}
        onClose={handleNoteMenuClose}
        PaperProps={{
          sx: {
            mt: 1,
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
            borderRadius: '12px',
            minWidth: 180
          }
        }}
      >
        {selectedNote?.isClosed ? [
          !selectedNote.isReply && !mission?.isArchived && (
            <MenuItem key="reopen" onClick={handleReopenNote} sx={{ py: 1.5 }}>
              <ListItemIcon>
                <CheckCircleOutlineIcon fontSize="small" sx={{ color: '#34C759' }} />
              </ListItemIcon>
              <ListItemText>Réouvrir la note</ListItemText>
            </MenuItem>
          )
        ] : [
          selectedNote?.createdBy === currentUser?.uid && !selectedNote.isReply && !mission?.isArchived && (
            <MenuItem key="edit" onClick={handleEditNote} sx={{ py: 1.5 }}>
              <ListItemIcon>
                <EditIcon fontSize="small" sx={{ color: '#007AFF' }} />
              </ListItemIcon>
              <ListItemText>Modifier</ListItemText>
            </MenuItem>
          ),
          !mission?.isArchived && (
            <MenuItem key="reply" onClick={handleReplyNote} sx={{ py: 1.5 }}>
              <ListItemIcon>
                <ReplyIcon fontSize="small" sx={{ color: '#007AFF' }} />
              </ListItemIcon>
              <ListItemText>Répondre</ListItemText>
            </MenuItem>
          ),
          !selectedNote?.isReply && !mission?.isArchived && (
            <MenuItem key="close" onClick={handleCloseNote} sx={{ py: 1.5 }}>
              <ListItemIcon>
                <CloseIcon fontSize="small" sx={{ color: '#007AFF' }} />
              </ListItemIcon>
              <ListItemText>Clôturer</ListItemText>
            </MenuItem>
          ),
          <Divider key="divider" />,
          !mission?.isArchived && (
            <MenuItem 
              key="delete"
              onClick={() => selectedNote && handleDeleteNote(selectedNote.id)} 
              sx={{ py: 1.5, color: '#FF3B30' }}
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" sx={{ color: '#FF3B30' }} />
              </ListItemIcon>
              <ListItemText>Supprimer</ListItemText>
            </MenuItem>
          )
        ].filter(Boolean)}
      </Menu>

      {/* Dialog pour modifier une note */}
      <Dialog 
        open={editNoteDialogOpen} 
        onClose={() => setEditNoteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
          }
        }}
      >
        <DialogTitle sx={{ 
          pb: 1,
          fontWeight: 500,
          color: '#1d1d1f'
        }}>
          Modifier la note
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TaggingInput
            value={editedNoteContent}
            onChange={setEditedNoteContent}
            placeholder="Modifier la note"
            multiline={true}
            rows={4}
            availableUsers={availableUsers}
            onTaggedUsersChange={setTaggedUsers}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setEditNoteDialogOpen(false)}
            sx={{
              color: '#1d1d1f',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSaveEditedNote}
            variant="contained"
            disabled={!editedNoteContent.trim()}
            sx={{
              backgroundColor: '#007AFF',
              '&:hover': {
                backgroundColor: '#0A84FF'
              },
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 500
            }}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog pour répondre à une note */}
      <Dialog 
        open={replyNoteDialogOpen} 
        onClose={() => {
          setReplyNoteDialogOpen(false);
          setReplyingToNote(null);
          setReplyContent('');
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
          }
        }}
      >
        <DialogTitle sx={{ 
          pb: 1,
          fontWeight: 500,
          color: '#1d1d1f'
        }}>
          Répondre à la note
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {replyingToNote && (
            <Box sx={{ mb: 2, p: 2, bgcolor: '#f5f5f7', borderRadius: '8px' }}>
              <Typography variant="body2" sx={{ color: '#86868b', mb: 1 }}>
                Répondre à :
              </Typography>
              <Typography variant="body1">
                {replyingToNote.content}
              </Typography>
            </Box>
          )}
          <TaggingInput
            value={replyContent}
            onChange={setReplyContent}
            placeholder="Votre réponse..."
            multiline={true}
            rows={4}
            availableUsers={availableUsers}
            onTaggedUsersChange={setReplyTaggedUsers}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => {
              setReplyNoteDialogOpen(false);
              setReplyingToNote(null);
              setReplyContent('');
            }}
            sx={{
              color: '#1d1d1f',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSaveReply}
            variant="contained"
            disabled={!replyContent.trim()}
            sx={{
              backgroundColor: '#007AFF',
              '&:hover': {
                backgroundColor: '#0A84FF'
              },
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 500
            }}
          >
            Envoyer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmation pour l'audit d'un document non signé */}
      <Dialog
        open={confirmAuditDialogOpen}
        onClose={() => {
          setConfirmAuditDialogOpen(false);
          setDocumentToAudit(null);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
          }
        }}
      >
        <DialogTitle sx={{ 
          pb: 1,
          fontWeight: 500,
          color: '#1d1d1f'
        }}>
          Confirmer l'audit
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <DialogContentText>
            Attention, vous êtes sur le point d'auditer un document qui n'est pas signé. Êtes-vous sûr de vouloir continuer ?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => {
              setConfirmAuditDialogOpen(false);
              setDocumentToAudit(null);
            }}
            sx={{
              color: '#1d1d1f',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleConfirmAudit}
            variant="contained"
            sx={{
              backgroundColor: '#007AFF',
              '&:hover': {
                backgroundColor: '#0A84FF'
              },
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 500
            }}
          >
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ajouter la boîte de dialogue de confirmation d'archivage */}
      <Dialog
        open={confirmArchiveDialogOpen}
        onClose={() => setConfirmArchiveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
          }
        }}
      >
        <DialogTitle sx={{ 
          pb: 1,
          fontWeight: 500,
          color: '#1d1d1f'
        }}>
          Confirmer l'archivage
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <DialogContentText>
            Êtes-vous sûr de vouloir archiver cette mission ? Cette action est irréversible et empêchera toute modification ultérieure des documents et des notes.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setConfirmArchiveDialogOpen(false)}
            sx={{
              color: '#1d1d1f',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleConfirmArchive}
            variant="contained"
            sx={{
              backgroundColor: '#007AFF',
              '&:hover': {
                backgroundColor: '#0A84FF'
              },
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 500
            }}
          >
            Archiver
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AuditMissionDetails; 