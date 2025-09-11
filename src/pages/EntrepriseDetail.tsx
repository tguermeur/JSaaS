import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Avatar,
  Button,
  Grid,
  Paper,
  Divider,
  Tab,
  Tabs,
  IconButton,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  Link,
  InputBase,
  Menu,
  MenuItem
} from '@mui/material';
import {
  Business as BusinessIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Language as LanguageIcon,
  LocationOn as LocationIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  Note as NoteIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  LinkedIn as LinkedInIcon,
  CloudUpload as CloudUploadIcon,
  History as HistoryIcon,
  MoreVert as MoreVertIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  NoteAdd as NoteAddIcon
} from '@mui/icons-material';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { Company, Contact, ContactNote } from './Entreprises';
import { uploadCompanyLogo } from '../firebase/storage';
import { DocumentType, TemplateAssignment } from '../types/templates';
import { ref, getDownloadURL, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase/config';
import { PDFDocument } from 'pdf-lib';
import { getTagFromVariableId, replaceTags } from '../utils/tagUtils';
import { formatDate } from '../utils/dateUtils';
import TaggingInput from '../components/ui/TaggingInput';
import { NotificationService } from '../services/notificationService';

interface UserData {
  firstName: string;
  lastName: string;
}

interface TemplateVariable {
  name: string;
  type: 'raw' | 'variable';
  variableId?: string;
  rawText?: string;
  position: {
    page: number;
    x: number;
    y: number;
  };
  width: number;
  height: number;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
}

interface Mission {
  id: string;
  title: string;
  status: string;
  totalTTC: number;
  companyId: string;
  numeroMission: number;
  startDate: Date;
  endDate?: Date;
  hours: number;
  priceHT: number;
  contactId?: string;
  contact?: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    position?: string;
  };
}

interface Note {
  id: string;
  content: string;
  createdBy: string;
  authorName?: string;
  createdAt: Date;
}

interface HistoryItem {
  id: string;
  type: 'creation' | 'modification' | 'mission' | 'contact' | 'note';
  description: string;
  createdBy: string;
  authorName?: string;
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

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

interface FirestoreData {
  name?: string;
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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  structureId?: string;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box
    role="tabpanel"
    hidden={value !== index}
    sx={{ py: 3 }}
  >
    {value === index && children}
  </Box>
);

const LinkedIn: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-linkedin" viewBox="0 0 16 16">
    <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.28C3.3 3.34 4.42 4.46 5.54 5.58c1.12 1.12 2.24 2.24 3.36 3.36 1.12-1.12 2.24-2.24 3.36-3.36 4.48-1.12-1.12-2.24-2.24-3.36-3.36z"/>
  </svg>
);

const convertMissionData = async (data: any): Promise<Mission> => {
  let contact = null;
  if (data.contactId) {
    console.log('contactId utilisé', data.contactId);
    const contactDoc = await getDoc(doc(db, 'contacts', data.contactId));
    if (contactDoc.exists()) {
      const contactData = contactDoc.data();
      contact = {
        firstName: contactData.firstName,
        lastName: contactData.lastName,
        email: contactData.email,
        phone: contactData.phone,
        position: contactData.position
      };
    }
    console.log('contact récupéré', contact);
  }

  return {
    id: data.id || '',
    title: data.title || '',
    numeroMission: data.numeroMission || '',
    status: data.status || 'en_cours',
    totalTTC: Number(data.totalTTC) || 0,
    companyId: data.companyId || '',
    startDate: data.startDate ? new Date(data.startDate) : new Date(),
    endDate: data.endDate ? new Date(data.endDate) : null,
    hours: Number(data.hours) || 0,
    priceHT: Number(data.priceHT) || 0,
    contactId: data.contactId,
    contact: contact
  };
};

const EntrepriseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [newNote, setNewNote] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editedCompany, setEditedCompany] = useState<Partial<Company>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addContactDialogOpen, setAddContactDialogOpen] = useState(false);
  const [newContact, setNewContact] = useState<Partial<Contact>>({});
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userStructureId, setUserStructureId] = useState<string | null>(null);
  const [conventionTemplate, setConventionTemplate] = useState<string | null>(null);
  const [generatingConvention, setGeneratingConvention] = useState(false);
  const [editContactDialogOpen, setEditContactDialogOpen] = useState(false);
  const [deleteContactDialogOpen, setDeleteContactDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [editContact, setEditContact] = useState<Partial<Contact>>({});
  const [contactMenuAnchor, setContactMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedContactForMenu, setSelectedContactForMenu] = useState<Contact | null>(null);
  const [availableUsers, setAvailableUsers] = useState<TaggedUser[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<TaggedUser[]>([]);

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (!id) return;

      try {
        const companyDoc = await getDoc(doc(db, 'companies', id));
        if (companyDoc.exists()) {
          const data = companyDoc.data() as FirestoreData;

          // Charger les contacts depuis la collection contacts
          const contactsQuery = query(
            collection(db, 'contacts'),
            where('companyId', '==', id)
          );
          const contactsSnapshot = await getDocs(contactsQuery);
          const contacts = contactsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Contact[];

          setCompany({
            id: companyDoc.id,
            name: data.name || '',
            siret: data.siret,
            description: data.description,
            address: data.address,
            city: data.city,
            postalCode: data.postalCode,
            country: data.country,
            phone: data.phone,
            email: data.email,
            website: data.website,
            logo: data.logo,
            contacts: contacts,
            missionsCount: data.missionsCount || 0,
            totalRevenue: data.totalRevenue || 0,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate(),
            structureId: data.structureId || ''
          } as Company);

          // Charger les missions
          const missionsQuery = query(
            collection(db, 'missions'),
            where('companyId', '==', id)
          );
          const missionsSnapshot = await getDocs(missionsQuery);
          const missionsPromises = missionsSnapshot.docs.map(doc => {
            const data = { id: doc.id, ...doc.data() };
            return convertMissionData(data);
          });
          const missionsData = await Promise.all(missionsPromises);
          console.log('missionsData', missionsData);
          setMissions(missionsData);

          // Charger les notes avec les informations de l'auteur
          const notesQuery = query(
            collection(db, 'notes'),
            where('companyId', '==', id)
          );
          const notesSnapshot = await getDocs(notesQuery);
          const notesData = await Promise.all(notesSnapshot.docs.map(async docSnapshot => {
            const data = docSnapshot.data();
            const userDoc = await getDoc(doc(db, 'users', data.createdBy));
            const userData = userDoc.data() as UserData | null;
            return {
              id: docSnapshot.id,
              content: data.content || '',
              createdBy: data.createdBy || '',
              authorName: userData ? `${userData.firstName} ${userData.lastName}` : 'Utilisateur inconnu',
              createdAt: data.createdAt?.toDate() || new Date()
            };
          })) as Note[];
          setNotes(notesData);
          
          // Charger l'historique avec les informations de l'auteur
          const historyQuery = query(
            collection(db, 'history'),
            where('companyId', '==', id)
          );
          const historySnapshot = await getDocs(historyQuery);
          const historyData = await Promise.all(historySnapshot.docs.map(async docSnapshot => {
            const data = docSnapshot.data();
            const userDoc = await getDoc(doc(db, 'users', data.createdBy));
            const userData = userDoc.data() as UserData | null;
            
            return {
              id: docSnapshot.id,
              type: data.type || 'modification',
              description: data.description || '',
              createdBy: data.createdBy || '',
              authorName: userData ? `${userData.firstName} ${userData.lastName}` : 'Utilisateur inconnu'
            };
          })) as HistoryItem[];
          setHistory(historyData);
          
          // Mettre à jour les statistiques
          await updateCompanyStats();
          
          // Récupérer les utilisateurs disponibles pour le tagging
          await fetchAvailableUsers();
        }
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      }
    };

    fetchCompanyData();
  }, [id]);

  // Récupérer la structure de l'utilisateur et le template de convention
  useEffect(() => {
    const fetchUserStructureAndTemplate = async () => {
      if (!currentUser) return;

      try {
        // Récupérer la structure de l'utilisateur
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!userDocSnap.exists()) {
          throw new Error("Utilisateur non trouvé");
        }

        const structureId = userDocSnap.data().structureId;
        setUserStructureId(structureId);

        // Récupérer le template de convention assigné pour cette structure
        const assignmentsQuery = query(
          collection(db, 'templateAssignments'),
          where('structureId', '==', structureId),
          where('documentType', '==', 'convention_entreprise')
        );
        
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        
        if (!assignmentsSnapshot.empty) {
          const assignment = assignmentsSnapshot.docs[0].data() as TemplateAssignment;
          setConventionTemplate(assignment.templateId);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération du template de convention:', error);
      }
    };

    fetchUserStructureAndTemplate();
  }, [currentUser]);

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

  const handleSaveNote = async () => {
    if (!newNote.trim() || !company || !currentUser) return;

    try {
      const noteRef = collection(db, 'notes');
      const docRef = await addDoc(noteRef, {
        content: newNote,
        companyId: company.id,
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid
      });

      // Envoyer des notifications aux utilisateurs taggés
      if (taggedUsers.length > 0) {
        const notificationPromises = taggedUsers.map(user => 
          NotificationService.sendToUser(
            user.id,
            'mission_update',
            'Nouvelle note sur l\'entreprise',
            `${currentUser.displayName || currentUser.email} vous a mentionné dans une note sur l'entreprise ${company.name}`,
            'medium',
            {
              companyId: company.id,
              companyName: company.name,
              noteId: docRef.id,
              mentionedBy: currentUser.uid,
              source: 'entreprise',
              redirectUrl: `/app/entreprises/${company.id}`
            }
          )
        );

        try {
          await Promise.all(notificationPromises);
          setSnackbar({
            open: true,
            message: `${taggedUsers.length} notification(s) envoyée(s)`,
            severity: 'success'
          });
        } catch (notificationError) {
          console.error('Erreur lors de l\'envoi des notifications:', notificationError);
          // Ne pas faire échouer l'ajout de la note si les notifications échouent
        }
      }

      setNewNote('');
      setTaggedUsers([]);
      
      // Recharger les notes avec les informations de l'auteur
      const notesQuery = query(
        collection(db, 'notes'),
        where('companyId', '==', company.id)
      );
      const notesSnapshot = await getDocs(notesQuery);
      const notesData = await Promise.all(notesSnapshot.docs.map(async docSnapshot => {
        const data = docSnapshot.data();
        const userDoc = await getDoc(doc(db, 'users', data.createdBy));
        const userData = userDoc.data() as UserData | null;
        return {
          id: docSnapshot.id,
          content: data.content || '',
          createdBy: data.createdBy || '',
          authorName: userData ? `${userData.firstName} ${userData.lastName}` : 'Utilisateur inconnu',
          createdAt: data.createdAt?.toDate() || new Date()
        };
      })) as Note[];
      setNotes(notesData);
      
      // Ajouter une entrée dans l'historique
      await addHistoryEntry('note', 'Ajout d\'une nouvelle note');
      
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

  const handleEditClick = () => {
    setEditedCompany(company || {});
    setEditMode(true);
  };

  const handleEditClose = () => {
    setEditMode(false);
    setEditedCompany({});
  };

  const handleEditSave = async () => {
    if (!id || !editedCompany) return;

    try {
      const companyRef = doc(db, 'companies', id);
      
      // Filtrer les champs undefined
      const updateData = Object.entries(editedCompany).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);

      await updateDoc(companyRef, updateData);
      
      setCompany(prev => prev ? { ...prev, ...updateData } : null);
      setEditMode(false);
      setSnackbar({
        open: true,
        message: 'Entreprise mise à jour avec succès',
        severity: 'success'
      });
      
      // Ajouter une entrée dans l'historique
      await addHistoryEntry('modification', 'Modification des informations de l\'entreprise');
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour de l\'entreprise',
        severity: 'error'
      });
    }
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!id) return;

    try {
      // Supprimer l'entreprise
      await deleteDoc(doc(db, 'companies', id));
      
      // Supprimer les notes associées
      const notesQuery = query(
        collection(db, 'notes'),
        where('companyId', '==', id)
      );
      const notesSnapshot = await getDocs(notesQuery);
      const deleteNotesPromises = notesSnapshot.docs.map(doc => 
        deleteDoc(doc.ref)
      );
      await Promise.all(deleteNotesPromises);

      setSnackbar({
        open: true,
        message: 'Entreprise supprimée avec succès',
        severity: 'success'
      });
      
      // Rediriger vers la liste des entreprises
      navigate('/app/entreprises');
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la suppression de l\'entreprise',
        severity: 'error'
      });
    }
  };

  const handleAddContact = async () => {
    if (!company || !currentUser || !newContact.firstName || !newContact.lastName || !newContact.email) return;

    try {
      // Créer le contact dans la collection contacts
      const contactData = {
        firstName: newContact.firstName,
        lastName: newContact.lastName,
        email: newContact.email,
        position: newContact.position || '',
        phone: newContact.phone || '',
        linkedin: newContact.linkedin || '',
        gender: newContact.gender || undefined,
        createdAt: new Date(),
        createdBy: currentUser.uid,
        isDefault: !company.contacts || company.contacts.length === 0,
        companyId: company.id,
        structureId: company.structureId
      };

      const contactRef = await addDoc(collection(db, 'contacts'), contactData);
      const contact = { id: contactRef.id, ...contactData };

      // Mettre à jour l'état local
      setCompany(prev => prev ? { 
        ...prev, 
        contacts: [...(prev.contacts || []), contact] 
      } : null);

      setAddContactDialogOpen(false);
      setNewContact({});
      setSnackbar({
        open: true,
        message: 'Contact ajouté avec succès',
        severity: 'success'
      });
      
      // Ajouter une entrée dans l'historique
      await addHistoryEntry('contact', `Ajout du contact ${contact.firstName} ${contact.lastName}`);
    } catch (error) {
      console.error('Erreur lors de l\'ajout du contact:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de l\'ajout du contact',
        severity: 'error'
      });
    }
  };

  const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file || !company) return;

    try {
      // Afficher un indicateur de chargement
      setSnackbar({
        open: true,
        message: "Téléchargement du logo en cours...",
        severity: "success"
      });
      
      // Télécharger le logo vers Firebase Storage
      const logoUrl = await uploadCompanyLogo(file, company.id);
      
      // Mettre à jour l'entreprise avec le nouveau logo
      const companyRef = doc(db, 'companies', company.id);
      await updateDoc(companyRef, {
        logo: logoUrl
      });
      
      // Mettre à jour l'état local
      setCompany(prev => prev ? { ...prev, logo: logoUrl } : null);
      
      setSnackbar({
        open: true,
        message: "Logo mis à jour avec succès",
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
  };

  // Fonction pour générer la convention entreprise
  const handleGenerateConvention = async () => {
    if (!company || !conventionTemplate) {
      setSnackbar({
        open: true,
        message: 'Aucun template de convention n\'est assigné',
        severity: 'error'
      });
      return;
    }

    setGeneratingConvention(true);
    try {
      // Récupérer le template
      const templateDoc = await getDoc(doc(db, 'templates', conventionTemplate));
      
      if (!templateDoc.exists()) {
        throw new Error("Template non trouvé");
      }

      const templateData = templateDoc.data();
      const templatePdfUrl = templateData.pdfUrl;
      const templateVariables = (templateData.variables || []) as TemplateVariable[];

      // 1. Charger et modifier le PDF
      const storageRef = ref(storage, templatePdfUrl);
      const pdfUrl = await getDownloadURL(storageRef);
      
      const response = await fetch(pdfUrl);
      const pdfBlob = await response.blob();
      const pdfBytes = await pdfBlob.arrayBuffer();

      const pdfDoc = await PDFDocument.load(pdfBytes);
      const helveticaFont = await pdfDoc.embedFont('Helvetica');
      const pages = pdfDoc.getPages();

      // Tableau pour stocker les variables non reconnues
      const unrecognizedVariables: string[] = [];

      // Préparer les données de l'entreprise pour le remplacement des tags
      const companyData = {
        name: company.name,
        siren: company.siret?.substring(0, 9), // Extraire le SIREN du SIRET
        address: company.address,
        city: company.city,
        country: company.country,
        phone: company.phone,
        email: company.email,
        website: company.website,
        description: company.description
      };

      // 2. Traiter chaque variable du template
      for (const variable of templateVariables) {
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

          const value = await replaceTags(valueToReplace, null, null, companyData);

          if (value === undefined || value === null) {
            unrecognizedVariables.push(variable.name || variable.variableId || 'Variable sans nom');
            continue;
          }

          if (value && value.trim()) {
            // Appliquer les styles et la position
            const fontSize = variable.fontSize || 12;
            const { x, y } = variable.position;
            const { width, height } = variable;
            const textAlign = variable.textAlign || 'left';
            const verticalAlign = variable.verticalAlign || 'top';

            // Calculer la position Y en fonction de l'alignement vertical
            let yPos = pageHeight - y;
            if (verticalAlign === 'middle') {
              yPos = pageHeight - (y + height / 2);
            } else if (verticalAlign === 'bottom') {
              yPos = pageHeight - (y + height);
            }

            // Calculer la position X en fonction de l'alignement horizontal
            let xPos = x;
            const textWidth = helveticaFont.widthOfTextAtSize(value, fontSize);
            if (textAlign === 'center') {
              xPos = x + (width - textWidth) / 2;
            } else if (textAlign === 'right') {
              xPos = x + width - textWidth;
            }

            // Dessiner le texte avec les styles appropriés
            page.drawText(value.trim(), {
              x: xPos,
              y: yPos,
              size: fontSize,
              font: helveticaFont,
              maxWidth: width,
              lineHeight: fontSize * 1.2
            });
          }
        } catch (err) {
          console.error(`Erreur lors du traitement de la variable ${variable.name}:`, err);
          unrecognizedVariables.push(variable.name || variable.variableId || 'Variable sans nom');
        }
      }

      // Si des variables n'ont pas été reconnues, afficher un message d'erreur
      if (unrecognizedVariables.length > 0) {
        setSnackbar({
          open: true,
          message: `Variables non reconnues : ${unrecognizedVariables.join(', ')}`,
          severity: 'error'
        });
        setGeneratingConvention(false);
        return;
      }

      // 3. Sauvegarder le PDF modifié
      const modifiedPdfBytes = await pdfDoc.save();
      
      // Créer le nom du fichier
      const fileName = `Convention_${company.name.replace(/\s+/g, '_')}.pdf`;

      // Uploader le fichier modifié
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      const storagePath = `companies/${company.id}/documents/${fileName}`;
      const documentStorageRef = ref(storage, storagePath);
      await uploadBytes(documentStorageRef, blob);
      const documentUrl = await getDownloadURL(documentStorageRef);

      // Créer le document dans Firestore
      const documentData = {
        companyId: company.id,
        documentType: 'convention_entreprise',
        fileName,
        fileUrl: documentUrl,
        fileSize: blob.size,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: currentUser?.uid || '',
        status: 'draft',
        isValid: true,
        tags: ['convention_entreprise']
      };

      await addDoc(collection(db, 'generatedDocuments'), documentData);

      // Télécharger le document
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Ajouter une entrée dans l'historique
      await addHistoryEntry('modification', 'Génération de la convention entreprise');
      
      setSnackbar({
        open: true,
        message: 'Convention générée avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la génération de la convention:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la génération de la convention',
        severity: 'error'
      });
    } finally {
      setGeneratingConvention(false);
    }
  };

  // Fonction pour ajouter une entrée dans l'historique
  const addHistoryEntry = async (type: HistoryItem['type'], description: string) => {
    if (!company || !currentUser) return;
    
    try {
      const historyRef = collection(db, 'history');
      const docRef = await addDoc(historyRef, {
        companyId: company.id,
        type,
        description,
        createdBy: currentUser.uid
      });

      // Mettre à jour l'état local avec la nouvelle entrée
      const newEntry: HistoryItem = {
        id: docRef.id,
        type,
        description,
        createdBy: currentUser.uid,
        authorName: currentUser.displayName || 'Utilisateur inconnu'
      };
      setHistory(prev => [newEntry, ...prev]);
    } catch (error) {
      console.error('Erreur lors de l\'ajout dans l\'historique:', error);
    }
  };

  const updateCompanyStats = async () => {
    if (!company) return;

    try {
      // Récupérer toutes les missions de l'entreprise
      const missionsRef = collection(db, 'missions');
      const missionsQuery = query(missionsRef, where('companyId', '==', company.id));
      const missionsSnapshot = await getDocs(missionsQuery);
      
      // Récupérer les missions
      const missions = missionsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || '',
          numeroMission: data.numeroMission || 0,
          companyId: data.companyId || '',
          startDate: data.startDate ? new Date(data.startDate) : new Date(),
          endDate: data.endDate ? new Date(data.endDate) : null,
          status: data.status || 'en_cours',
          totalTTC: Number(data.totalTTC) || 0
        } as Mission;
      });

      // Calculer les statistiques
      const missionsCount = missions.length;
      const totalRevenue = missions
        .filter(mission => mission.status === 'paid')
        .reduce((total, mission) => total + (mission.totalTTC || 0), 0);

      // Mettre à jour l'entreprise dans Firestore
      const companyRef = doc(db, 'companies', company.id);
      await updateDoc(companyRef, {
        missionsCount,
        totalRevenue,
        updatedAt: new Date()
      });

      // Mettre à jour l'état local
      setCompany(prev => prev ? { ...prev, missionsCount, totalRevenue } : null);
      setMissions(missions);
    } catch (error) {
      console.error('Erreur lors de la mise à jour des statistiques:', error);
    }
  };

  const handleContactMenuOpen = (event: React.MouseEvent<HTMLElement>, contact: Contact) => {
    setContactMenuAnchor(event.currentTarget);
    setSelectedContactForMenu(contact);
  };

  const handleContactMenuClose = () => {
    setContactMenuAnchor(null);
    setSelectedContactForMenu(null);
  };

  const handleEditContactClick = () => {
    if (selectedContactForMenu) {
      setEditContact(selectedContactForMenu);
      setEditContactDialogOpen(true);
    }
    handleContactMenuClose();
  };

  const handleDeleteContactClick = () => {
    if (selectedContactForMenu) {
      setSelectedContact(selectedContactForMenu);
      setDeleteContactDialogOpen(true);
    }
    handleContactMenuClose();
  };

  const handleSetDefaultContact = async () => {
    if (!company || !selectedContactForMenu) return;

    try {
      const updatedContacts = company.contacts?.map(contact => ({
        ...contact,
        isDefault: contact.id === selectedContactForMenu.id
      })) || [];

      const companyRef = doc(db, 'companies', company.id);
      await updateDoc(companyRef, {
        contacts: updatedContacts
      });

      setCompany(prev => prev ? { ...prev, contacts: updatedContacts } : null);
      setSnackbar({
        open: true,
        message: 'Contact principal mis à jour',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du contact principal:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour du contact principal',
        severity: 'error'
      });
    }
    handleContactMenuClose();
  };

  const handleEditContactSave = async () => {
    if (!company || !editContact.id) return;

    try {
      // Mettre à jour le contact dans la collection contacts
      const contactRef = doc(db, 'contacts', editContact.id);
      await updateDoc(contactRef, {
        firstName: editContact.firstName,
        lastName: editContact.lastName,
        email: editContact.email,
        position: editContact.position || '',
        phone: editContact.phone || '',
        linkedin: editContact.linkedin || '',
        gender: editContact.gender || undefined
      });

      // Mettre à jour l'état local
      setCompany(prev => prev ? {
        ...prev,
        contacts: prev.contacts?.map(contact => 
          contact.id === editContact.id ? { ...contact, ...editContact } : contact
        ) || []
      } : null);

      setEditContactDialogOpen(false);
      setEditContact({});
      setSnackbar({
        open: true,
        message: 'Contact mis à jour avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du contact:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour du contact',
        severity: 'error'
      });
    }
  };

  const handleDeleteContactConfirm = async () => {
    if (!company || !selectedContact) return;

    try {
      // Supprimer le contact de la collection contacts
      await deleteDoc(doc(db, 'contacts', selectedContact.id));

      // Mettre à jour l'état local
      setCompany(prev => prev ? {
        ...prev,
        contacts: prev.contacts?.filter(contact => contact.id !== selectedContact.id) || []
      } : null);

      setDeleteContactDialogOpen(false);
      setSelectedContact(null);
      setSnackbar({
        open: true,
        message: 'Contact supprimé avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la suppression du contact:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la suppression du contact',
        severity: 'error'
      });
    }
  };

  // Fonction pour supprimer une note
  const handleDeleteNote = async (noteId: string) => {
    if (!company || !currentUser) return;

    try {
      // Supprimer la note de Firestore
      await deleteDoc(doc(db, 'notes', noteId));

      // Mettre à jour l'état local
      setNotes(prev => prev.filter(note => note.id !== noteId));

      // Ajouter une entrée dans l'historique
      await addHistoryEntry('note', 'Suppression d\'une note');

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

  const handleAddContactNote = async () => {
    // Suppression de la fonction
  };

  if (!company) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        bgcolor: '#f5f5f7' 
      }}>
        <Typography>Chargement...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: '#f5f5f7', minHeight: '100vh' }}>
      {/* Header */}
      <Box 
        sx={{ 
          bgcolor: 'white', 
          borderBottom: '1px solid #e5e5e7',
          position: 'sticky',
          top: 0,
          zIndex: 1000
        }}
      >
        <Box 
          sx={{ 
            maxWidth: 1200, 
            mx: 'auto', 
            px: 3,
            py: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 3
          }}
        >
          <Box sx={{ position: 'relative' }}>
            {company.logo ? (
              <Box
                component="img"
                src={company.logo}
                alt={company.name}
                sx={{
                  width: 100,
                  height: 100,
                  objectFit: 'contain',
                  bgcolor: 'white'
                }}
              />
            ) : (
              <Avatar 
                sx={{ 
                  width: 100, 
                  height: 100,
                  bgcolor: '#f5f5f7',
                  color: '#1d1d1f'
                }}
              >
                <BusinessIcon sx={{ fontSize: 50 }} />
              </Avatar>
            )}
            <Button
              component="label"
              variant="outlined"
              size="small"
              startIcon={<CloudUploadIcon />}
              sx={{
                position: 'absolute',
                bottom: -10,
                right: -10,
                minWidth: 'auto',
                p: 1,
                borderRadius: '50%',
                bgcolor: 'white',
                borderColor: '#d2d2d7',
                '&:hover': {
                  bgcolor: '#f5f5f7',
                  borderColor: '#86868b'
                }
              }}
            >
              <input
                type="file"
                hidden
                accept="image/*"
                ref={fileInputRef}
                onChange={handleLogoChange}
              />
            </Button>
          </Box>
          
          <Box sx={{ flex: 1 }}>
            <Typography 
              variant="h3" 
              sx={{ 
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 1
              }}
            >
              {company.name}
            </Typography>
            <Stack direction="row" spacing={2}>
              {company.siret && (
                <Chip 
                  label={`SIRET: ${company.siret}`}
                  sx={{ 
                    bgcolor: '#f5f5f7',
                    color: '#1d1d1f',
                    borderRadius: '0.8rem'
                  }}
                />
              )}
              <Chip 
                label={`${missions.length} missions`}
                sx={{ 
                  bgcolor: '#f5f5f7',
                  color: '#1d1d1f',
                  borderRadius: '0.8rem'
                }}
              />
            </Stack>
          </Box>
          
          <Stack direction="row" spacing={2}>
            <Button
              startIcon={<EditIcon />}
              onClick={handleEditClick}
              sx={{
                color: '#0066cc',
                '&:hover': {
                  bgcolor: 'transparent',
                  color: '#0077ed'
                }
              }}
            >
              Modifier
            </Button>
            <Button
              startIcon={<DeleteIcon />}
              onClick={handleDeleteClick}
              sx={{
                color: '#ff3b30',
                '&:hover': {
                  bgcolor: 'transparent',
                  color: '#ff453a'
                }
              }}
            >
              Supprimer
            </Button>
            <Button
              variant="contained"
              startIcon={generatingConvention ? <CircularProgress size={20} /> : <AssignmentIcon />}
              onClick={handleGenerateConvention}
              disabled={generatingConvention || !conventionTemplate}
              sx={{
                bgcolor: '#0066cc',
                '&:hover': {
                  bgcolor: '#0077ed'
                },
                '&.Mui-disabled': {
                  bgcolor: '#86868b'
                }
              }}
            >
              {generatingConvention ? 'Génération...' : 'Générer la convention'}
            </Button>
          </Stack>
        </Box>

        <Tabs 
          value={activeTab} 
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ 
            px: 3,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 500,
              color: '#86868b',
              '&.Mui-selected': {
                color: '#1d1d1f'
              }
            },
            '& .MuiTabs-indicator': {
              bgcolor: '#0066cc'
            }
          }}
        >
          <Tab label="Aperçu" />
          <Tab label="Missions" />
          <Tab label="Contacts" />
          <Tab label="Notes" />
          <Tab label="Historique" />
        </Tabs>
      </Box>

      {/* Content */}
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: 3, py: 4 }}>
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={4}>
            <Grid item xs={12} md={8}>
              <Paper 
                sx={{ 
                  p: 3, 
                  borderRadius: '1.2rem',
                  border: '1px solid #e5e5e7'
                }}
              >
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: '#1d1d1f',
                    fontWeight: 600,
                    mb: 3
                  }}
                >
                  Informations
                </Typography>
                
                <Grid container spacing={3}>
                  {company.address && (
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <LocationIcon sx={{ color: '#86868b' }} />
                        <Typography>
                          {company.address}
                          {company.postalCode && company.city && `, ${company.postalCode} ${company.city}`}
                          {company.city && !company.postalCode && `, ${company.city}`}
                          {company.country && `, ${company.country}`}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  
                  {company.phone && (
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <PhoneIcon sx={{ color: '#86868b' }} />
                        <Typography>{company.phone}</Typography>
                      </Box>
                    </Grid>
                  )}
                  
                  {company.email && (
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <EmailIcon sx={{ color: '#86868b' }} />
                        <Typography>{company.email}</Typography>
                      </Box>
                    </Grid>
                  )}
                  
                  {company.website && (
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <LanguageIcon sx={{ color: '#86868b' }} />
                        <Typography>{company.website}</Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </Paper>

              {/* Section Notes dans Aperçu */}
              <Paper 
                sx={{ 
                  p: 3, 
                  borderRadius: '1.2rem',
                  border: '1px solid #e5e5e7',
                  mt: 3
                }}
              >
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  mb: 3
                }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      color: '#1d1d1f',
                      fontWeight: 600
                    }}
                  >
                    Notes récentes
                  </Typography>
                  <Button
                    onClick={() => setActiveTab(3)}
                    sx={{
                      color: '#0066cc',
                      '&:hover': {
                        bgcolor: 'transparent',
                        color: '#0077ed'
                      }
                    }}
                  >
                    Voir toutes
                  </Button>
                </Box>
                
                {notes.length > 0 ? (
                  <List sx={{ p: 0 }}>
                    {notes.slice(0, 3).map((note, index) => (
                      <React.Fragment key={note.id}>
                        <ListItem 
                          sx={{ 
                            p: 2,
                            '&:hover': {
                              bgcolor: '#f9f9f9'
                            }
                          }}
                        >
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: '#f5f5f7', color: '#1d1d1f', width: 32, height: 32 }}>
                              <NoteIcon sx={{ fontSize: 16 }} />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Typography 
                                component="span"
                                sx={{ 
                                  color: '#1d1d1f',
                                  whiteSpace: 'pre-wrap',
                                  fontSize: '0.875rem',
                                  lineHeight: 1.4
                                }}
                              >
                                {note.content.length > 150 
                                  ? `${note.content.substring(0, 150)}...` 
                                  : note.content
                                }
                              </Typography>
                            }
                            secondary={
                              <Box component="span" sx={{ mt: 1 }}>
                                <Typography 
                                  component="span"
                                  variant="caption" 
                                  sx={{ 
                                    color: '#86868b',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1
                                  }}
                                >
                                  <PersonIcon sx={{ fontSize: 14 }} />
                                  {note.authorName} • {formatDate(note.createdAt)}
                                </Typography>
                              </Box>
                            }
                          />
                          <IconButton
                            onClick={() => handleDeleteNote(note.id)}
                            size="small"
                            sx={{
                              color: '#86868b',
                              '&:hover': {
                                bgcolor: 'transparent',
                                color: '#ff3b30'
                              }
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </ListItem>
                        {index < Math.min(notes.length, 3) - 1 && (
                          <Divider />
                        )}
                      </React.Fragment>
                    ))}
                  </List>
                ) : (
                  <Typography 
                    align="center" 
                    sx={{ 
                      color: '#86868b',
                      py: 3
                    }}
                  >
                    Aucune note
                  </Typography>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper 
                sx={{ 
                  p: 3, 
                  borderRadius: '1.2rem',
                  border: '1px solid #e5e5e7'
                }}
              >
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: '#1d1d1f',
                    fontWeight: 600,
                    mb: 3
                  }}
                >
                  Statistiques
                </Typography>
                
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" color="#86868b">
                      Missions totales
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#1d1d1f', fontWeight: 600 }}>
                      {missions.length}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="body2" color="#86868b">
                      Missions en cours
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#1d1d1f', fontWeight: 600 }}>
                      {missions.filter(m => m.status === 'en_cours').length}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="#86868b">
                      CA Total
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#1d1d1f', fontWeight: 600 }}>
                      {new Intl.NumberFormat('fr-FR', { 
                        style: 'currency', 
                        currency: 'EUR',
                        maximumFractionDigits: 0
                      }).format(missions.reduce((total, mission) => {
                        return total + (mission.totalTTC || 0);
                      }, 0))}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Paper 
            sx={{ 
              borderRadius: '1.2rem',
              border: '1px solid #e5e5e7',
              overflow: 'hidden'
            }}
          >
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e5e7' }}>
              <Typography variant="h6" sx={{ color: '#1d1d1f', fontWeight: 600 }}>
                Missions
              </Typography>
            </Box>
            
            <List sx={{ p: 0 }}>
              {missions.map((mission, index) => (
                <React.Fragment key={mission.id}>
                  <ListItem 
                    sx={{ 
                      p: 3,
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: '#f9f9f9'
                      }
                    }}
                    onClick={() => navigate(`/app/mission/${mission.numeroMission}`)}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: '#f5f5f7', color: '#1d1d1f' }}>
                        <AssignmentIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Typography 
                            component="span" 
                            sx={{ color: '#1d1d1f', fontWeight: 500, flex: 1 }}
                          >
                            {mission.title || `Mission #${mission.numeroMission}`}
                          </Typography>
                          <Typography 
                            sx={{ 
                              color: '#1d1d1f',
                              fontWeight: 600
                            }}
                          >
                            {new Intl.NumberFormat('fr-FR', { 
                              style: 'currency', 
                              currency: 'EUR',
                              maximumFractionDigits: 0
                            }).format(mission.totalTTC)}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                            <Chip 
                              label={mission.status}
                              size="small"
                              sx={{ 
                                bgcolor: mission.status === 'en_cours' ? '#e3f2fd' : '#f5f5f7',
                                color: mission.status === 'en_cours' ? '#0066cc' : '#86868b',
                                borderRadius: '0.6rem'
                              }}
                            />
                            <span style={{ color: '#86868b', fontSize: '0.875rem' }}>
                              {mission.hours} heures • {mission.priceHT}€/h
                            </span>
                          </Box>
                          {(mission.contact && mission.contact.firstName && mission.contact.lastName) ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                              <PersonIcon sx={{ fontSize: 16, color: '#86868b' }} />
                              <span style={{ color: '#86868b', fontSize: '0.875rem' }}>
                                {mission.contact.firstName} {mission.contact.lastName}
                                {mission.contact.position && ` • ${mission.contact.position}`}
                              </span>
                            </Box>
                          ) : (
                            <span style={{ color: '#86868b', fontSize: '0.875rem', display: 'block', marginTop: '8px' }}>
                              Aucun contact associé
                            </span>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < missions.length - 1 && (
                    <Divider />
                  )}
                </React.Fragment>
              ))}
              {missions.length === 0 && (
                <ListItem sx={{ p: 4 }}>
                  <ListItemText 
                    primary={
                      <Typography 
                        align="center" 
                        sx={{ color: '#86868b' }}
                      >
                        Aucune mission
                      </Typography>
                    }
                  />
                </ListItem>
              )}
            </List>
          </Paper>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Paper 
            sx={{ 
              borderRadius: '1.2rem',
              border: '1px solid #e5e5e7'
            }}
          >
            <Box sx={{ 
              p: 3, 
              borderBottom: '1px solid #e5e5e7',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Typography variant="h6" sx={{ color: '#1d1d1f', fontWeight: 600 }}>
                Contacts
              </Typography>
              <Button
                startIcon={<AddIcon />}
                onClick={() => setAddContactDialogOpen(true)}
                sx={{
                  color: '#0066cc',
                  '&:hover': {
                    bgcolor: 'transparent',
                    color: '#0077ed'
                  }
                }}
              >
                Ajouter
              </Button>
            </Box>
            
            <List sx={{ p: 0 }}>
              {company.contacts?.map((contact, index) => (
                <React.Fragment key={contact.id}>
                  <ListItem 
                    sx={{ 
                      p: 3,
                      '&:hover': {
                        bgcolor: '#f9f9f9',
                        borderRadius: index === 0 ? '1.2rem 1.2rem 0 0' : 
                                     index === (company.contacts?.length || 0) - 1 ? '0 0 1.2rem 1.2rem' : 
                                     '0'
                      }
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: '#f5f5f7', color: '#1d1d1f' }}>
                        <PersonIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography 
                            component="span"
                            sx={{ color: '#1d1d1f', fontWeight: 500 }}
                          >
                            {contact.firstName} {contact.lastName}
                          </Typography>
                          {contact.isDefault && (
                            <Chip
                              label="Contact principal"
                              size="small"
                              sx={{
                                bgcolor: '#e8f0fe',
                                color: '#0066cc',
                                fontSize: '0.75rem',
                                height: '20px'
                              }}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box component="span" sx={{ mt: 1 }}>
                          <Typography 
                            component="span"
                            variant="body2" 
                            sx={{ color: '#86868b' }}
                          >
                            {contact.position}
                          </Typography>
                          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                            <Typography 
                              component="span"
                              variant="body2" 
                              sx={{ 
                                color: '#0066cc',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5
                              }}
                            >
                              <EmailIcon sx={{ fontSize: 16 }} />
                              {contact.email}
                            </Typography>
                            {contact.phone && (
                              <Typography 
                                component="span"
                                variant="body2" 
                                sx={{ 
                                  color: '#0066cc',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5
                                }}
                              >
                                <PhoneIcon sx={{ fontSize: 16 }} />
                                {contact.phone}
                              </Typography>
                            )}
                            {contact.linkedin && (
                              <Link
                                href={contact.linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ 
                                  color: '#0066cc',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                  textDecoration: 'none',
                                  '&:hover': {
                                    textDecoration: 'underline'
                                  }
                                }}
                              >
                                <LinkedInIcon sx={{ fontSize: 16 }} />
                                LinkedIn
                              </Link>
                            )}
                          </Stack>
                          {contact.notes && contact.notes.length > 0 && (
                            <Box component="span" sx={{ mt: 2 }}>
                              <Typography 
                                component="span"
                                variant="body2" 
                                sx={{ 
                                  color: '#86868b',
                                  fontWeight: 500,
                                  mb: 1
                                }}
                              >
                                Notes
                              </Typography>
                              {contact.notes.map((note, noteIndex) => (
                                <Box 
                                  key={note.id}
                                  component="span"
                                  sx={{ 
                                    p: 2,
                                    bgcolor: '#f5f5f7',
                                    borderRadius: '0.8rem',
                                    mb: noteIndex < contact.notes!.length - 1 ? 1 : 0
                                  }}
                                >
                                  <Typography component="span" variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                    {note.content}
                                  </Typography>
                                  <Typography 
                                    component="span"
                                    variant="caption" 
                                    sx={{ 
                                      color: '#86868b',
                                      display: 'block',
                                      mt: 1
                                    }}
                                  >
                                    {note.authorName} • {formatDate(note.createdAt)}
                                  </Typography>
                                </Box>
                              ))}
                            </Box>
                          )}
                        </Box>
                      }
                    />
                    <IconButton
                      onClick={(e) => handleContactMenuOpen(e, contact)}
                      sx={{
                        color: '#86868b',
                        '&:hover': {
                          bgcolor: 'transparent',
                          color: '#1d1d1f'
                        }
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </ListItem>
                  {index < (company.contacts?.length || 0) - 1 && (
                    <Divider />
                  )}
                </React.Fragment>
              ))}
              {!company.contacts?.length && (
                <ListItem sx={{ p: 4 }}>
                  <ListItemText 
                    primary={
                      <Typography 
                        align="center" 
                        sx={{ color: '#86868b' }}
                      >
                        Aucun contact
                      </Typography>
                    }
                  />
                </ListItem>
              )}
            </List>
          </Paper>
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper 
                sx={{ 
                  borderRadius: '1.2rem',
                  border: '1px solid #e5e5e7'
                }}
              >
                <Box sx={{ p: 3, borderBottom: '1px solid #e5e5e7' }}>
                  <Typography variant="h6" sx={{ color: '#1d1d1f', fontWeight: 600 }}>
                    Notes
                  </Typography>
                </Box>
                
                <List sx={{ p: 0 }}>
                  {notes.map((note, index) => (
                    <React.Fragment key={note.id}>
                      <ListItem 
                        sx={{ 
                          p: 3,
                          '&:hover': {
                            bgcolor: '#f9f9f9'
                          }
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: '#f5f5f7', color: '#1d1d1f' }}>
                            <NoteIcon />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography 
                              component="span"
                              sx={{ 
                                color: '#1d1d1f',
                                whiteSpace: 'pre-wrap'
                              }}
                            >
                              {note.content}
                            </Typography>
                          }
                          secondary={
                            <Box component="span" sx={{ mt: 1 }}>
                              <Typography 
                                component="span"
                                variant="body2" 
                                sx={{ 
                                  color: '#86868b',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1
                                }}
                              >
                                <PersonIcon sx={{ fontSize: 16 }} />
                                {note.authorName}
                              </Typography>
                            </Box>
                          }
                        />
                        <IconButton
                          onClick={() => handleDeleteNote(note.id)}
                          sx={{
                            color: '#86868b',
                            '&:hover': {
                              bgcolor: 'transparent',
                              color: '#ff3b30'
                            }
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItem>
                      {index < notes.length - 1 && (
                        <Divider />
                      )}
                    </React.Fragment>
                  ))}
                  {notes.length === 0 && (
                    <ListItem sx={{ p: 4 }}>
                      <ListItemText 
                        primary={
                          <Typography 
                            align="center" 
                            sx={{ color: '#86868b' }}
                          >
                            Aucune note
                          </Typography>
                        }
                      />
                    </ListItem>
                  )}
                </List>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper 
                sx={{ 
                  p: 3, 
                  borderRadius: '1.2rem',
                  border: '1px solid #e5e5e7'
                }}
              >
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: '#1d1d1f',
                    fontWeight: 600,
                    mb: 2
                  }}
                >
                  Ajouter une note
                </Typography>
                
                <TaggingInput
                  value={newNote}
                  onChange={setNewNote}
                  placeholder="Écrivez votre note ici..."
                  multiline={true}
                  rows={4}
                  availableUsers={availableUsers}
                  onTaggedUsersChange={setTaggedUsers}
                />
                
                <Box sx={{ mb: 2 }} />
                
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveNote}
                  disabled={!newNote.trim()}
                  sx={{
                    bgcolor: '#0066cc',
                    borderRadius: '0.8rem',
                    py: 1,
                    '&:hover': {
                      bgcolor: '#0077ed'
                    },
                    '&.Mui-disabled': {
                      bgcolor: '#86868b'
                    }
                  }}
                >
                  Enregistrer
                </Button>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={4}>
          <Paper 
            sx={{ 
              p: 3, 
              borderRadius: '1.2rem',
              border: '1px solid #e5e5e7'
            }}
          >
            <Typography 
              variant="h6" 
              sx={{ 
                color: '#1d1d1f',
                fontWeight: 600,
                mb: 3
              }}
            >
              Historique des modifications
            </Typography>
            
            {history.length === 0 ? (
              <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                Aucun historique disponible
              </Typography>
            ) : (
              <List sx={{ p: 0 }}>
                {history.map((item, index) => (
                  <React.Fragment key={item.id}>
                    <ListItem 
                      sx={{ 
                        p: 3,
                        '&:hover': {
                          bgcolor: '#f9f9f9'
                        }
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: '#f5f5f7', color: '#1d1d1f' }}>
                          {item.type === 'creation' && <BusinessIcon />}
                          {item.type === 'modification' && <EditIcon />}
                          {item.type === 'mission' && <AssignmentIcon />}
                          {item.type === 'contact' && <PersonIcon />}
                          {item.type === 'note' && <NoteIcon />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography 
                            component="span"
                            sx={{ 
                              color: '#1d1d1f',
                              fontWeight: 500
                            }}
                          >
                            {item.description}
                          </Typography>
                        }
                        secondary={
                          <Box component="span" sx={{ mt: 1 }}>
                            <Typography 
                              component="span"
                              variant="body2" 
                              sx={{ 
                                color: '#86868b',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1
                              }}
                            >
                              <PersonIcon sx={{ fontSize: 16 }} />
                              {item.authorName}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < history.length - 1 && (
                      <Divider />
                    )}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </TabPanel>
      </Box>

      {/* Dialog d'édition */}
      <Dialog 
        open={editMode} 
        onClose={handleEditClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Modifier l'entreprise</Typography>
            <IconButton onClick={handleEditClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Nom"
                fullWidth
                value={editedCompany.name || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="SIRET"
                fullWidth
                value={editedCompany.siret || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, siret: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={3}
                value={editedCompany.description || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Adresse"
                fullWidth
                value={editedCompany.address || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, address: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Code postal"
                fullWidth
                value={editedCompany.postalCode || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, postalCode: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Ville"
                fullWidth
                value={editedCompany.city || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, city: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Pays"
                fullWidth
                value={editedCompany.country || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, country: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Téléphone"
                fullWidth
                value={editedCompany.phone || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, phone: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email"
                fullWidth
                value={editedCompany.email || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, email: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Site web"
                fullWidth
                value={editedCompany.website || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, website: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditClose}>Annuler</Button>
          <Button 
            onClick={handleEditSave}
            variant="contained"
            startIcon={<SaveIcon />}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer cette entreprise ? Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
          <Button 
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog d'ajout de contact */}
      <Dialog 
        open={addContactDialogOpen} 
        onClose={() => setAddContactDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '1.2rem',
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle sx={{ 
          p: 3, 
          borderBottom: '1px solid #e5e5e7',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
            Ajouter un contact
          </Typography>
          <IconButton 
            onClick={() => setAddContactDialogOpen(false)} 
            size="small"
            sx={{ 
              color: '#86868b',
              '&:hover': {
                bgcolor: 'transparent',
                color: '#1d1d1f'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 4 }}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 3
          }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#86868b', 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Prénom *
                  </Typography>
                  <TextField
                    fullWidth
                    value={newContact.firstName || ''}
                    onChange={(e) => setNewContact(prev => ({ ...prev, firstName: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez le prénom"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: '#f5f5f7',
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#86868b', 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Nom *
                  </Typography>
                  <TextField
                    fullWidth
                    value={newContact.lastName || ''}
                    onChange={(e) => setNewContact(prev => ({ ...prev, lastName: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez le nom"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: '#f5f5f7',
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#86868b', 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Email *
                  </Typography>
                  <TextField
                    fullWidth
                    type="email"
                    value={newContact.email || ''}
                    onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez l'email"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: '#f5f5f7',
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#86868b', 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Téléphone
                  </Typography>
                  <TextField
                    fullWidth
                    type="tel"
                    value={newContact.phone || ''}
                    onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez le numéro de téléphone"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: '#f5f5f7',
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#86868b', 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Poste
                  </Typography>
                  <TextField
                    fullWidth
                    value={newContact.position || ''}
                    onChange={(e) => setNewContact(prev => ({ ...prev, position: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez le poste"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: '#f5f5f7',
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#86868b', 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    LinkedIn
                  </Typography>
                  <TextField
                    fullWidth
                    type="url"
                    value={newContact.linkedin || ''}
                    onChange={(e) => setNewContact(prev => ({ ...prev, linkedin: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez l'URL du profil LinkedIn"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: '#f5f5f7',
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#86868b', 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Sexe
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1.5,
                        cursor: 'pointer',
                        p: 1,
                        borderRadius: '0.6rem',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: '#f5f5f7'
                        }
                      }}
                      onClick={() => setNewContact(prev => ({ ...prev, gender: 'homme' }))}
                    >
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          border: '2px solid',
                          borderColor: newContact.gender === 'homme' ? '#0066cc' : '#d2d2d7',
                          bgcolor: newContact.gender === 'homme' ? '#0066cc' : 'transparent',
                          position: 'relative',
                          transition: 'all 0.2s ease',
                          '&::after': newContact.gender === 'homme' ? {
                            content: '""',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: 'white'
                          } : {}
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: '0.875rem',
                          color: newContact.gender === 'homme' ? '#1d1d1f' : '#86868b',
                          fontWeight: newContact.gender === 'homme' ? 500 : 400,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Homme
                      </Typography>
                    </Box>
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1.5,
                        cursor: 'pointer',
                        p: 1,
                        borderRadius: '0.6rem',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: '#f5f5f7'
                        }
                      }}
                      onClick={() => setNewContact(prev => ({ ...prev, gender: 'femme' }))}
                    >
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          border: '2px solid',
                          borderColor: newContact.gender === 'femme' ? '#0066cc' : '#d2d2d7',
                          bgcolor: newContact.gender === 'femme' ? '#0066cc' : 'transparent',
                          position: 'relative',
                          transition: 'all 0.2s ease',
                          '&::after': newContact.gender === 'femme' ? {
                            content: '""',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: 'white'
                          } : {}
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: '0.875rem',
                          color: newContact.gender === 'femme' ? '#1d1d1f' : '#86868b',
                          fontWeight: newContact.gender === 'femme' ? 500 : 400,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Femme
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ 
          p: 3, 
          borderTop: '1px solid #e5e5e7',
          justifyContent: 'flex-end',
          gap: 1
        }}>
          <Button 
            onClick={() => setAddContactDialogOpen(false)}
            sx={{ 
              color: '#86868b',
              '&:hover': {
                bgcolor: 'transparent',
                color: '#1d1d1f'
              }
            }}
          >
            Annuler
          </Button>
          <Button 
            onClick={handleAddContact}
            variant="contained"
            disabled={!newContact.firstName || !newContact.lastName || !newContact.email}
            sx={{
              bgcolor: '#0066cc',
              borderRadius: '0.8rem',
              px: 3,
              py: 1,
              '&:hover': {
                bgcolor: '#0077ed'
              },
              '&.Mui-disabled': {
                bgcolor: '#86868b'
              }
            }}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog d'édition de contact */}
      <Dialog
        open={editContactDialogOpen}
        onClose={() => setEditContactDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '1.2rem',
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle sx={{ 
          p: 3, 
          borderBottom: '1px solid #e5e5e7',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
            Modifier le contact
          </Typography>
          <IconButton 
            onClick={() => setEditContactDialogOpen(false)} 
            size="small"
            sx={{ 
              color: '#86868b',
              '&:hover': {
                bgcolor: 'transparent',
                color: '#1d1d1f'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 4 }}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 3
          }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#86868b', 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Prénom *
                  </Typography>
                  <TextField
                    fullWidth
                    value={editContact.firstName || ''}
                    onChange={(e) => setEditContact(prev => ({ ...prev, firstName: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez le prénom"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: '#f5f5f7',
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#86868b', 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Nom *
                  </Typography>
                  <TextField
                    fullWidth
                    value={editContact.lastName || ''}
                    onChange={(e) => setEditContact(prev => ({ ...prev, lastName: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez le nom"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: '#f5f5f7',
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#86868b', 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Email *
                  </Typography>
                  <TextField
                    fullWidth
                    type="email"
                    value={editContact.email || ''}
                    onChange={(e) => setEditContact(prev => ({ ...prev, email: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez l'email"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: '#f5f5f7',
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#86868b', 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Téléphone
                  </Typography>
                  <TextField
                    fullWidth
                    type="tel"
                    value={editContact.phone || ''}
                    onChange={(e) => setEditContact(prev => ({ ...prev, phone: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez le numéro de téléphone"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: '#f5f5f7',
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#86868b', 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Poste
                  </Typography>
                  <TextField
                    fullWidth
                    value={editContact.position || ''}
                    onChange={(e) => setEditContact(prev => ({ ...prev, position: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez le poste"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: '#f5f5f7',
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#86868b', 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    LinkedIn
                  </Typography>
                  <TextField
                    fullWidth
                    type="url"
                    value={editContact.linkedin || ''}
                    onChange={(e) => setEditContact(prev => ({ ...prev, linkedin: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez l'URL du profil LinkedIn"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: '#f5f5f7',
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#86868b', 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Sexe
                  </Typography>
                                    <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1.5,
                        cursor: 'pointer',
                        p: 1,
                        borderRadius: '0.6rem',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: '#f5f5f7'
                        }
                      }}
                      onClick={() => setEditContact(prev => ({ ...prev, gender: 'homme' }))}
                    >
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          border: '2px solid',
                          borderColor: editContact.gender === 'homme' ? '#0066cc' : '#d2d2d7',
                          bgcolor: editContact.gender === 'homme' ? '#0066cc' : 'transparent',
                          position: 'relative',
                          transition: 'all 0.2s ease',
                          '&::after': editContact.gender === 'homme' ? {
                            content: '""',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: 'white'
                          } : {}
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: '0.875rem',
                          color: editContact.gender === 'homme' ? '#1d1d1f' : '#86868b',
                          fontWeight: editContact.gender === 'homme' ? 500 : 400,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Homme
                      </Typography>
                    </Box>
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1.5,
                        cursor: 'pointer',
                        p: 1,
                        borderRadius: '0.6rem',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: '#f5f5f7'
                        }
                      }}
                      onClick={() => setEditContact(prev => ({ ...prev, gender: 'femme' }))}
                    >
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          border: '2px solid',
                          borderColor: editContact.gender === 'femme' ? '#0066cc' : '#d2d2d7',
                          bgcolor: editContact.gender === 'femme' ? '#0066cc' : 'transparent',
                          position: 'relative',
                          transition: 'all 0.2s ease',
                          '&::after': editContact.gender === 'femme' ? {
                            content: '""',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: 'white'
                          } : {}
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: '0.875rem',
                          color: editContact.gender === 'femme' ? '#1d1d1f' : '#86868b',
                          fontWeight: editContact.gender === 'femme' ? 500 : 400,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Femme
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ 
          p: 3, 
          borderTop: '1px solid #e5e5e7',
          justifyContent: 'flex-end',
          gap: 1
        }}>
          <Button 
            onClick={() => setEditContactDialogOpen(false)}
            sx={{ 
              color: '#86868b',
              '&:hover': {
                bgcolor: 'transparent',
                color: '#1d1d1f'
              }
            }}
          >
            Annuler
          </Button>
          <Button 
            onClick={handleEditContactSave}
            variant="contained"
            disabled={!editContact.firstName || !editContact.lastName || !editContact.email}
            sx={{
              bgcolor: '#0066cc',
              borderRadius: '0.8rem',
              px: 3,
              py: 1,
              '&:hover': {
                bgcolor: '#0077ed'
              },
              '&.Mui-disabled': {
                bgcolor: '#86868b'
              }
            }}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmation de suppression de contact */}
      <Dialog
        open={deleteContactDialogOpen}
        onClose={() => setDeleteContactDialogOpen(false)}
      >
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer ce contact ? Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteContactDialogOpen(false)}>Annuler</Button>
          <Button 
            onClick={handleDeleteContactConfirm}
            color="error"
            variant="contained"
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar pour les notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Menu d'actions du contact */}
      <Menu
        anchorEl={contactMenuAnchor}
        open={Boolean(contactMenuAnchor)}
        onClose={handleContactMenuClose}
        PaperProps={{
          sx: {
            borderRadius: '1.2rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            minWidth: 200
          }
        }}
      >
        <MenuItem onClick={handleEditContactClick}>
          <EditIcon sx={{ mr: 1, fontSize: 20 }} />
          Modifier
        </MenuItem>
        <MenuItem onClick={handleSetDefaultContact}>
          {selectedContactForMenu?.isDefault ? (
            <>
              <StarIcon sx={{ mr: 1, fontSize: 20, color: '#0066cc' }} />
              Retirer comme contact principal
            </>
          ) : (
            <>
              <StarBorderIcon sx={{ mr: 1, fontSize: 20 }} />
              Définir comme contact principal
            </>
          )}
        </MenuItem>
        <MenuItem 
          onClick={handleDeleteContactClick}
          sx={{ color: '#ff3b30' }}
        >
          <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
          Supprimer
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default EntrepriseDetail;