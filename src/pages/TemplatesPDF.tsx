// Ajoutez ces imports au début du fichier
import { db, storage } from '../firebase/config';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, getDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  TextField,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Paper,
  Chip,
  MenuItem,
  Tooltip,
  Slider,
  Select,
  FormControl,
  InputLabel,
  Snackbar,
  Alert,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Popover,
  Switch,
  useTheme,
  alpha,
  Menu
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Save as SaveIcon,
  DragIndicator as DragIcon,
  FormatSize as FormatSizeIcon,
  Check as CheckIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  FormatAlignLeft as FormatAlignLeftIcon,
  FormatAlignCenter as FormatAlignCenterIcon,
  FormatAlignRight as FormatAlignRightIcon,
  FormatAlignJustify as FormatAlignJustifyIcon,
  VerticalAlignTop as VerticalAlignTopIcon,
  VerticalAlignCenter as VerticalAlignCenterIcon,
  VerticalAlignBottom as VerticalAlignBottomIcon,
  Info as InfoIcon,
  TextSnippet as TextSnippetIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';
import { useMission } from '../contexts/MissionContext';
import { getFileURL } from '../firebase/storage';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import pdfjs from '../utils/pdfWorker';
import BackButton from '../components/ui/BackButton';

// Configuration du worker PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

// Remplacer la constante MISSION_VARIABLES par DATABASE_FIELDS
interface DatabaseField {
  id: string;
  name: string;
  description: string;
  type: string;
}

interface DatabaseFields {
  missions: DatabaseField[];
  users: DatabaseField[];
  companies: DatabaseField[];
  contacts: DatabaseField[];
  expenseNotes: DatabaseField[];
  workingHours: DatabaseField[];
  amendments: DatabaseField[];
  structures: DatabaseField[]; // Ajout des champs de structure
}

// Tailles de police disponibles
const FONT_SIZES = [5,5.5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32];

// Ajouter cette constante en haut du fichier avec les autres constantes
const FONT_FAMILIES = [
  { value: 'Calibri', label: 'Calibri' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Courier', label: 'Courier' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Georgia', label: 'Georgia' }
];

interface TemplateVariable {
  id: string;
  name: string;
  description: string;
  type: 'text' | 'number' | 'date' | 'list' | 'raw';
  variableId?: string;
  rawText?: string;
  fieldId?: string;
  position: {
    x: number;
    y: number;
    page: number;
  };
  fontSize: number;
  fontFamily?: string;
  lineHeight?: number; // Ajout de la propriété lineHeight
  dataSource?: 'missions' | 'users' | 'companies' | 'contacts' | 'expenseNotes' | 'workingHours' | 'amendments' | 'structures';
  width: number;
  height: number;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  verticalAlign: 'top' | 'middle' | 'bottom';
  isBold?: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string;
  file: {
    url: string;
    name: string;
    type: string;
  } | null;
  pdfUrl: string;
  fileName: string;
  variables: TemplateVariable[];
}

interface FirestoreTemplate {
  name: string;
  description: string;
  pdfUrl: string;
  variables: TemplateVariable[];
  createdAt: Date;
  createdBy: string;
  structureId: string;
}

// Ajouter une interface pour les balises
interface TagMapping {
  tag: string;
  variableId: string;
  description: string;
  example: string;
}

// Créer un mapping des balises disponibles basé sur DATABASE_FIELDS
export const VARIABLE_TAGS: TagMapping[] = [
  // Tags pour les missions
  { tag: '<mission_numero>', variableId: 'numeroMission', description: 'Numéro de mission', example: 'M2024-001' },
  { tag: '<mission_cdm>', variableId: 'chargeName', description: 'Prénom Nom CDM', example: 'Jean Dupont' },
  { tag: '<mission_debut>', variableId: 'missionStartDate', description: 'Début de mission', example: '01/01/2024' },
  { tag: '<mission_fin>', variableId: 'missionEndDate', description: 'Fin de mission', example: '31/01/2024' },
  { tag: '<mission_lieu>', variableId: 'location', description: 'Lieu de la mission', example: 'Paris' },
  { tag: '<mission_entreprise>', variableId: 'company', description: 'Nom de l\'entreprise', example: 'Entreprise SA' },
  { tag: '<mission_type>', variableId: 'missionType', description: 'Type de mission', example: 'Consulting' },
  { tag: '<mission_date_generation>', variableId: 'generationDate', description: 'Date de génération du document', example: '01/01/2024' },
  { tag: '<mission_prix>', variableId: 'priceHT', description: 'Prix HT', example: '1000€' },
  { tag: '<mission_description>', variableId: 'missionDescription', description: 'Description de la mission', example: 'Description détaillée...' },
  { tag: '<mission_titre>', variableId: 'title', description: 'Titre', example: 'Titre de la mission' },
  { tag: '<mission_heures>', variableId: 'hours', description: 'Nombre d\'heures', example: '40' },
  { tag: '<mission_nb_etudiants>', variableId: 'studentCount', description: 'Nombre d\'étudiants', example: '4' },
  
  // Tags pour les utilisateurs
  { tag: '<user_nom>', variableId: 'lastName', description: 'Nom de famille', example: 'Dupont' },
  { tag: '<user_prenom>', variableId: 'firstName', description: 'Prénom', example: 'Jean' },
  { tag: '<user_email>', variableId: 'email', description: 'Adresse email', example: 'jean.dupont@email.com' },
  { tag: '<user_ecole>', variableId: 'ecole', description: 'École', example: 'École ABC' },
  { tag: '<user_telephone>', variableId: 'phone', description: 'Téléphone', example: '06 12 34 56 78' },
  { tag: '<user_adresse>', variableId: 'address', description: 'Adresse', example: '123 rue Example' },
  { tag: '<user_ville>', variableId: 'city', description: 'Ville', example: 'Paris' },
  { tag: '<user_formation>', variableId: 'formation', description: 'Formation', example: 'Informatique' },
  { tag: '<user_programme>', variableId: 'program', description: 'Programme', example: 'PGE' },
  { tag: '<user_annee_diplome>', variableId: 'graduationYear', description: 'Année de diplômation', example: '2024' },
  { tag: '<user_nationalite>', variableId: 'nationality', description: 'Nationalité', example: 'Française' },
  { tag: '<user_genre>', variableId: 'gender', description: 'Genre', example: 'M' },
  { tag: '<user_lieu_naissance>', variableId: 'birthPlace', description: 'Lieu de naissance', example: 'Paris' },
  { tag: '<user_date_naissance>', variableId: 'birthDate', description: 'Date de naissance', example: '01/01/2000' },
  
  // Tags pour les entreprises
  { tag: '<entreprise_nom>', variableId: 'name', description: 'Nom de l\'entreprise', example: 'Entreprise SA' },
  { tag: '<entreprise_siren>', variableId: 'siren', description: 'Numéro SIREN', example: '123456789' },
  { tag: '<entreprise_adresse>', variableId: 'address', description: 'Adresse', example: '123 rue Example' },
  { tag: '<entreprise_ville>', variableId: 'city', description: 'Ville', example: 'Paris' },
  { tag: '<entreprise_pays>', variableId: 'country', description: 'Pays', example: 'France' },
  { tag: '<entreprise_telephone>', variableId: 'phone', description: 'Téléphone', example: '01 23 45 67 89' },
  { tag: '<entreprise_email>', variableId: 'email', description: 'Email', example: 'contact@entreprise.fr' },
  { tag: '<entreprise_site_web>', variableId: 'website', description: 'Site web', example: 'www.entreprise.fr' },
  { tag: '<entreprise_description>', variableId: 'description', description: 'Description', example: 'Description de l\'entreprise' },
  
  // Tags pour les notes de frais
  { tag: '<note_frais_montant>', variableId: 'amount', description: 'Montant de la note de frais', example: '150€' },
  { tag: '<note_frais_description>', variableId: 'description', description: 'Description de la note de frais', example: 'Frais de transport' },
  { tag: '<note_frais_date>', variableId: 'date', description: 'Date de la note de frais', example: '01/01/2024' },
  { tag: '<note_frais_statut>', variableId: 'status', description: 'Statut de la note de frais', example: 'Validée' },
  { tag: '<note_frais_creation>', variableId: 'createdAt', description: 'Date de création', example: '01/01/2024' },
  { tag: '<note_frais_maj>', variableId: 'updatedAt', description: 'Date de mise à jour', example: '02/01/2024' },
  
  // Tags pour les heures de travail
  { tag: '<workingHoursDateDebut>', variableId: 'startDate', description: 'Date de début des heures travaillées', example: '01/01/2024' },
  { tag: '<workingHoursHeureDebut>', variableId: 'startTime', description: 'Heure de début', example: '09:00' },
  { tag: '<workingHoursDateFin>', variableId: 'endDate', description: 'Date de fin des heures travaillées', example: '01/01/2024' },
  { tag: '<workingHoursHeureFin>', variableId: 'endTime', description: 'Heure de fin', example: '17:00' },
  { tag: '<workingHoursPauses>', variableId: 'breaks', description: 'Liste des pauses', example: '12:00-13:00' },
  { tag: '<workingHoursTotal>', variableId: 'totalHours', description: 'Total des heures travaillées', example: '7.5' },
  { tag: '<workingHoursCreation>', variableId: 'createdAt', description: 'Date de création', example: '01/01/2024' },
  { tag: '<workingHoursMaj>', variableId: 'updatedAt', description: 'Date de mise à jour', example: '02/01/2024' },
  
  // Tags pour les avenants
  { tag: '<amendment_planned_start_date>', variableId: 'plannedStartDate', description: 'Date de début prévue', example: '01/01/2024' },
  { tag: '<amendment_planned_end_date>', variableId: 'plannedEndDate', description: 'Date de fin prévue', example: '31/01/2024' },
  { tag: '<amendment_actual_start_date>', variableId: 'actualStartDate', description: 'Date de début réelle', example: '01/01/2024' },
  { tag: '<amendment_actual_end_date>', variableId: 'actualEndDate', description: 'Date de fin réelle', example: '31/01/2024' },
  { tag: '<amendment_planned_hours>', variableId: 'plannedHours', description: 'Heures prévues', example: '40' },
  { tag: '<amendment_actual_hours>', variableId: 'actualHours', description: 'Heures réelles', example: '35' },
  { tag: '<amendment_reason>', variableId: 'reason', description: 'Motif', example: 'Modification des dates' },
  { tag: '<amendment_created_at>', variableId: 'createdAt', description: 'Date de création', example: '01/01/2024' },
  { tag: '<amendment_created_by>', variableId: 'createdByName', description: 'Créé par', example: 'Jean Dupont' },
  
  // Tags pour les contacts
  { tag: '<contact_fullName>', variableId: 'contact_fullName', description: 'Prénom et Nom du contact', example: 'Jean Dupont' },
  { tag: '<contact_firstName>', variableId: 'contact_firstName', description: 'Prénom du contact', example: 'Jean' },
  { tag: '<contact_lastName>', variableId: 'contact_lastName', description: 'Nom du contact', example: 'Dupont' },
  { tag: '<contact_email>', variableId: 'contact_email', description: 'Email du contact', example: 'jean.dupont@email.com' },
  { tag: '<contact_phone>', variableId: 'contact_phone', description: 'Téléphone du contact', example: '06 12 34 56 78' },
  { tag: '<contact_position>', variableId: 'contact_position', description: 'Poste du contact', example: 'Chef de projet' },
  { tag: '<contact_linkedin>', variableId: 'contact_linkedin', description: 'URL du profil LinkedIn du contact', example: 'https://www.linkedin.com/in/jean-dupont' },
  
  // Tags pour la structure
  { tag: '<structure_nom>', variableId: 'structure_name', description: 'Nom de la structure', example: 'Ma Structure' },
  { tag: '<structure_siret>', variableId: 'structure_siret', description: 'Numéro SIRET de la structure', example: '12345678901234' },
  { tag: '<structure_adresse>', variableId: 'structure_address', description: 'Adresse de la structure', example: '123 rue Example' },
  { tag: '<structure_ville>', variableId: 'structure_city', description: 'Ville de la structure', example: 'Paris' },
  { tag: '<structure_code_postal>', variableId: 'structure_postalCode', description: 'Code postal de la structure', example: '75000' },
  { tag: '<structure_pays>', variableId: 'structure_country', description: 'Pays de la structure', example: 'France' },
  { tag: '<structure_telephone>', variableId: 'structure_phone', description: 'Téléphone de la structure', example: '01 23 45 67 89' },
  { tag: '<structure_email>', variableId: 'structure_email', description: 'Email de la structure', example: 'contact@structure.fr' },
  { tag: '<structure_site_web>', variableId: 'structure_website', description: 'Site web de la structure', example: 'www.structure.fr' },
  { tag: '<structure_site_web>', variableId: 'structure_website', description: 'Site web de la structure', example: 'www.structure.fr' },
  { tag: '<structure_email>', variableId: 'structure_email', description: 'Email de la structure', example: 'contact@structure.fr' },
  { tag: '<structure_site_web>', variableId: 'structure_website', description: 'Site web de la structure', example: 'www.structure.fr' },
  { tag: '<structure_address>', variableId: 'structure_address', description: 'Adresse de la structure', example: '123 rue Example' },
  { tag: '<structure_phone>', variableId: 'structure_phone', description: 'N° de téléphone de la structure', example: '01 23 45 67 89' },
  { tag: '<structure_email>', variableId: 'structure_email', description: 'Email de la structure', example: 'contact@structure.fr' }
];

// Ajouter la fonction utilitaire escapeRegExp si elle n'existe pas
const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Fonction pour obtenir la valeur d'une variable à partir des balises
const getVariableValue = (variableId: string, missionData: any, userData: any, companyData: any): string => {
  // Si c'est la date de génération, retourner la date actuelle
  if (variableId === 'generationDate') {
    return new Date().toLocaleDateString('fr-FR');
  }

  // Si c'est le type de mission, utiliser directement la valeur de la mission
  if (variableId === 'missionType') {
    return missionData?.missionType || '';
  }

  // Pour les autres champs, utiliser la logique existante
  const field = variableId.split('_')[1] || variableId;
  if (missionData && missionData[field] !== undefined) {
    return missionData[field].toString();
  }
  if (userData && userData[field] !== undefined) {
    return userData[field].toString();
  }
  if (companyData && companyData[field] !== undefined) {
    return companyData[field].toString();
  }
  return '';
};

// Modifier la fonction replaceTags pour logger les balises non remplacées
const replaceTags = (text: string, missionData?: any, userData?: any, companyData?: any): string => {
  if (!text) return '';
  try {
    let result = text;
    VARIABLE_TAGS.forEach(({ tag, variableId }) => {
      const value = getVariableValue(variableId, missionData, userData, companyData);
      result = result.replace(new RegExp(escapeRegExp(tag), 'g'), value || '');
    });
    return result;
  } catch (error) {
    console.error('Erreur lors du remplacement des balises:', error);
    return text;
  }
};

// Modifier la fonction fetchPdfAsBase64
const fetchPdfAsBase64 = async (url: string): Promise<string> => {
  try {
    // Détecter l'environnement
    const isDevelopment = window.location.hostname === 'localhost';
    
    // Construire l'URL appropriée
    const fetchUrl = isDevelopment 
      ? url.replace('https://firebasestorage.googleapis.com', '/pdf-proxy')
      : url;
    
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf'
      },
      credentials: isDevelopment ? 'same-origin' : 'omit' // Ne pas envoyer de credentials en production
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Erreur lors du chargement du PDF:', error);
    throw error;
  }
};

const formatVariableName = (name: string): string => {
  // Convertit "priceHT" en "PriceHT"
  return name.replace(/([A-Z])/g, '$1').replace(/\s+/g, '');
};

const TemplatesPDF: React.FC = () => {
  const theme = useTheme();
  const { missionData } = useMission();
  const { currentUser } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [numPages, setNumPages] = useState<number>(0);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [selectedVariable, setSelectedVariable] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<number>(12);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedPosition, setSelectedPosition] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0 });
  const [resizeDirection, setResizeDirection] = useState<'nw' | 'ne' | 'sw' | 'se'>('se');
  const [missionTypes, setMissionTypes] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [databaseFields, setDatabaseFields] = useState<DatabaseFields>({
    missions: [],
    users: [],
    companies: [],
    contacts: [],
    expenseNotes: [],
    workingHours: [],
    amendments: [],
    structures: []
  });
  const [defaultTemplates, setDefaultTemplates] = useState<{ [key: string]: string }>({});
  const [selectedPlacedVariable, setSelectedPlacedVariable] = useState<string | null>(null);

  // Ajout des états pour la gestion du line-height
  const [lineHeightDialogOpen, setLineHeightDialogOpen] = useState(false);
  const [selectedLineHeight, setSelectedLineHeight] = useState<number>(1.2);

  // Fonction pour récupérer les templates
  const fetchTemplates = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      
      // Récupérer le structureId de l'utilisateur
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();
      
      if (!userData?.structureId) {
        throw new Error('Aucune structure associée à l\'utilisateur');
      }

      // Récupérer les templates de la structure
      const templatesRef = collection(db, 'templates');
      const q = query(templatesRef, where('structureId', '==', userData.structureId));
      const snapshot = await getDocs(q);
      
      const templatesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Template[];
      
      setTemplates(templatesList);
    } catch (error) {
      console.error("Erreur lors du chargement des templates:", error);
      setSnackbar({
        open: true,
        message: "Erreur lors du chargement des templates",
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDefaultTemplates = async () => {
    try {
      const defaultTemplatesSnapshot = await getDocs(query(
        collection(db, 'defaultTemplateAssignments')
      ));
      
      const defaultTemplatesMap: { [key: string]: string } = {};
      defaultTemplatesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        defaultTemplatesMap[data.templateId] = data.documentType;
      });
      setDefaultTemplates(defaultTemplatesMap);
    } catch (error) {
      console.error('Erreur lors du chargement des templates par défaut:', error);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchTemplates();
      fetchDatabaseFields();
      fetchMissionTypes();
      fetchDefaultTemplates();
    }
  }, [currentUser]);

  // Sources de données
  const missionsDataSource = {
    id: 'missions',
    name: 'Missions',
    description: 'Informations des missions',
    fields: [
      {
        id: 'title',
        name: 'Titre',
        description: 'Titre de la mission',
        type: 'text'
      },
      {
        id: 'missionType',
        name: 'Type de mission',
        description: 'Type de la mission',
        type: 'text'
      },
      {
        id: 'generationDate',
        name: 'Date de génération',
        description: 'Date à laquelle le document est généré',
        type: 'date'
      },
      {
        id: 'status',
        name: 'Statut',
        description: 'Statut de la mission',
        type: 'text'
      },
      {
        id: 'totalTTC',
        name: 'Total TTC',
        description: 'Montant total TTC de la mission',
        type: 'number'
      }
    ]
  };

  const usersDataSource = {
    id: 'users',
    name: 'Utilisateurs',
    description: 'Informations des utilisateurs',
    fields: [
      {
        id: 'firstName',
        name: 'Prénom',
        description: 'Prénom de l\'utilisateur',
        type: 'text'
      },
      {
        id: 'lastName',
        name: 'Nom',
        description: 'Nom de l\'utilisateur',
        type: 'text'
      },
      {
        id: 'email',
        name: 'Email',
        description: 'Email de l\'utilisateur',
        type: 'text'
      }
    ]
  };

  const companiesDataSource = {
    id: 'companies',
    name: 'Entreprises',
    description: 'Informations des entreprises',
    fields: [
      {
        id: 'name',
        name: 'Nom de l\'entreprise',
        description: 'Nom de l\'entreprise',
        type: 'text'
      },
      {
        id: 'siret',
        name: 'SIRET',
        description: 'Numéro SIRET de l\'entreprise',
        type: 'text'
      },
      {
        id: 'address',
        name: 'Adresse',
        description: 'Adresse de l\'entreprise',
        type: 'text'
      }
    ]
  };

  const expenseNotesDataSource = {
    id: 'expenseNotes',
    name: 'Notes de frais',
    description: 'Informations des notes de frais',
    fields: [
      {
        id: 'amount',
        name: 'Montant',
        description: 'Montant de la note de frais',
        type: 'number'
      },
      {
        id: 'description',
        name: 'Description',
        description: 'Description de la note de frais',
        type: 'text'
      }
    ]
  };

  const workingHoursDataSource = {
    id: 'workingHours',
    name: 'Heures de travail',
    description: 'Informations des heures de travail',
    fields: [
      {
        id: 'startDate',
        name: 'Date de début',
        description: 'Date de début des heures travaillées',
        type: 'date'
      },
      {
        id: 'startTime',
        name: 'Heure de début',
        description: 'Heure de début des heures travaillées',
        type: 'text'
      },
      {
        id: 'endDate',
        name: 'Date de fin',
        description: 'Date de fin des heures travaillées',
        type: 'date'
      },
      {
        id: 'endTime',
        name: 'Heure de fin',
        description: 'Heure de fin des heures travaillées',
        type: 'text'
      },
      {
        id: 'breaks',
        name: 'Pauses',
        description: 'Liste des pauses',
        type: 'array'
      },
      {
        id: 'totalHours',
        name: 'Total des heures',
        description: 'Total des heures travaillées',
        type: 'number'
      }
    ]
  };

  const amendmentsDataSource = {
    id: 'amendments',
    name: 'Avenants',
    description: 'Informations des avenants',
    fields: [
      {
        id: 'reason',
        name: 'Motif',
        description: 'Motif de l\'avenant',
        type: 'text'
      },
      {
        id: 'createdAt',
        name: 'Date de création',
        description: 'Date de création de l\'avenant',
        type: 'date'
      }
    ]
  };

  const contactsDataSource = {
    id: 'contacts',
    name: 'Contacts',
    description: 'Informations des contacts',
    fields: [
      {
        id: 'firstName',
        name: 'Prénom',
        description: 'Prénom du contact',
        type: 'text'
      },
      {
        id: 'lastName',
        name: 'Nom',
        description: 'Nom du contact',
        type: 'text'
      },
      {
        id: 'email',
        name: 'Email',
        description: 'Email du contact',
        type: 'text'
      },
      {
        id: 'phone',
        name: 'Téléphone',
        description: 'Numéro de téléphone du contact',
        type: 'text'
      },
      {
        id: 'position',
        name: 'Poste',
        description: 'Poste occupé par le contact',
        type: 'text'
      },
      {
        id: 'linkedin',
        name: 'LinkedIn',
        description: 'URL du profil LinkedIn du contact',
        type: 'text'
      },
      {
        id: 'isDefault',
        name: 'Contact principal',
        description: 'Indique si c\'est le contact principal de l\'entreprise',
        type: 'boolean'
      },
      {
        id: 'companyId',
        name: 'ID Entreprise',
        description: 'Identifiant de l\'entreprise associée',
        type: 'text'
      },
      {
        id: 'createdAt',
        name: 'Date de création',
        description: 'Date de création du contact',
        type: 'date'
      },
      {
        id: 'updatedAt',
        name: 'Date de mise à jour',
        description: 'Date de dernière mise à jour du contact',
        type: 'date'
      }
    ]
  };

  // Liste des sources de données
  const dataSources = [
    missionsDataSource,
    usersDataSource,
    companiesDataSource,
    contactsDataSource,
    expenseNotesDataSource,
    workingHoursDataSource,
    amendmentsDataSource
  ];

  const [openDialog, setOpenDialog] = useState(false);
  const [openFontSizeDialog, setOpenFontSizeDialog] = useState(false);
  const [selectedVariableId, setSelectedVariableId] = useState<string | null>(null);
  const [selectedVariableForEdit, setSelectedVariableForEdit] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [draggingVariable, setDraggingVariable] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [currentFontSize, setCurrentFontSize] = useState<number>(12);
  const [scale, setScale] = useState<number>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  
  const [newTemplate, setNewTemplate] = useState<{
    name: string;
    description: string;
    file: File | null;
  }>({
    name: '',
    description: '',
    file: null
  });
  
  // Ajouter un état pour la sélection de la base de données
  const [selectedDatabase, setSelectedDatabase] = useState<'missions' | 'users' | 'companies' | 'contacts' | 'expenseNotes' | 'workingHours' | 'amendments' | 'structures'>('missions');
  
  // Réinitialiser le message de succès après 3 secondes
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);
  
  // Ajout des états au début du composant
  const [rawText, setRawText] = useState<string>('');
  const [isAddingRawText, setIsAddingRawText] = useState<boolean>(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  // Ajouter ces états et fonctions pour gérer le redimensionnement
  const [resizingVariable, setResizingVariable] = useState<string | null>(null);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });
  
  // Ajouter un état pour suivre les modifications
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedVariables, setLastSavedVariables] = useState<TemplateVariable[]>([]);
  
  // Ajouter un état pour le zoom
  const [zoom, setZoom] = useState(1);
  
  // Ajouter un état pour la position de la popup
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Fonction pour obtenir la valeur d'une variable à partir des données
  const getVariableDataValue = (variableId: string): string => {
    // Si c'est une variable de mission
    if (databaseFields.missions.some(field => field.id === variableId)) {
      const missionField = missionData[variableId as keyof typeof missionData];
      if (missionField instanceof Date) {
        return missionField.toLocaleDateString();
      }
      return missionField?.toString() || '';
    }
    
    // Si c'est une variable utilisateur
    if (databaseFields.users.some(field => field.id === variableId)) {
      const userField = currentUser?.[variableId as keyof typeof currentUser];
      if (userField instanceof Date) {
        return userField.toLocaleDateString();
      }
      return userField?.toString() || '';
    }
    
    return '';
  };
  
  const handleOpenDialog = () => {
    setOpenDialog(true);
  };
  
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setNewTemplate({
      name: '',
      description: '',
      file: null
    });
  };
  
  const handleOpenFontSizeDialog = (variableId: string) => {
    if (selectedTemplate) {
      const variable = selectedTemplate.variables.find(v => v.id === variableId);
      if (variable) {
        setCurrentFontSize(variable.fontSize);
        setSelectedVariableForEdit(variableId);
        setOpenFontSizeDialog(true);
      }
    }
  };
  
  const handleCloseFontSizeDialog = () => {
    setOpenFontSizeDialog(false);
    setSelectedVariableForEdit(null);
  };
  
  const handleSaveFontSize = () => {
    if (selectedTemplate && selectedVariableForEdit) {
      const updatedVariables = selectedTemplate.variables.map(variable => 
        variable.id === selectedVariableForEdit 
          ? { ...variable, fontSize: currentFontSize } 
          : variable
      );
      
      const updatedTemplate = {
        ...selectedTemplate,
        variables: updatedVariables
      };
      
      setTemplates(templates.map(t => 
        t.id === selectedTemplate.id ? updatedTemplate : t
      ));
      
      setSelectedTemplate(updatedTemplate);
      handleCloseFontSizeDialog();
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setNewTemplate({
        ...newTemplate,
        file: e.target.files[0]
      });
    }
  };
  
  const handleSaveTemplate = async () => {
    if (!newTemplate.name || !newTemplate.file || !currentUser) {
      setSnackbar({
        open: true,
        message: 'Veuillez remplir tous les champs',
        severity: 'error'
      });
      return;
    }

    try {
      setLoading(true);
      
      // Récupérer le structureId de l'utilisateur
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();
      
      if (!userData?.structureId) {
        throw new Error('Aucune structure associée à l\'utilisateur');
      }
      
      // Créer un nom de fichier unique
      const fileName = `${Date.now()}_${newTemplate.file.name.replace(/\s+/g, '_')}`;
      const storageRef = ref(storage, `templates/${fileName}`);
      
      // Upload du fichier
      await uploadBytes(storageRef, newTemplate.file);
      const pdfUrl = await getDownloadURL(storageRef);

      // Créer le document dans Firestore
      const templateData: FirestoreTemplate = {
        name: newTemplate.name,
        description: newTemplate.description,
        pdfUrl,
        variables: [],
        createdAt: new Date(),
        createdBy: currentUser.uid,
        structureId: userData.structureId
      };

      console.log('Données du template à sauvegarder:', templateData);
      const docRef = await addDoc(collection(db, 'templates'), templateData);
      console.log('Template créé avec ID:', docRef.id);

      // Mettre à jour l'état local
      const newTemplateWithId = {
        id: docRef.id,
        name: templateData.name,
        description: templateData.description,
        file: {
          url: URL.createObjectURL(newTemplate.file),
          name: newTemplate.file.name,
          type: newTemplate.file.type
        },
        pdfUrl: templateData.pdfUrl,
        fileName,
        variables: templateData.variables
      };
      
      console.log('Nouveau template avec ID:', newTemplateWithId);
      setTemplates(prev => [...prev, newTemplateWithId]);

      setSnackbar({
        open: true,
        message: 'Template créé avec succès',
        severity: 'success'
      });
      
      // Réinitialiser le formulaire
      setNewTemplate({
        name: '',
        description: '',
        file: null
      });
      setOpenDialog(false);

    } catch (error) {
      console.error('Erreur lors de la création du template:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la création du template',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleDocumentLoadSuccess = ({ numPages, pdf }: { numPages: number, pdf: any }) => {
    setNumPages(numPages);
    setPdfDocument(pdf);
  };
  
  const handlePdfClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((!selectedVariableId && !isAddingRawText) || !pdfContainerRef.current || !selectedTemplate) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setSelectedPlacedVariable(null);
    
    const pdfRect = pdfContainerRef.current.getBoundingClientRect();
    const pdfWidth = 595 * zoom;
    const pdfHeight = 842 * zoom;
    
    // Calculer la position du PDF centré dans le conteneur
    const pdfLeft = pdfRect.left + (pdfRect.width - pdfWidth) / 2;
    const pdfTop = pdfRect.top + (pdfRect.height - pdfHeight) / 2;
    
    // Calcul des coordonnées relatives au conteneur PDF en tenant compte du zoom
    const relativeX = (e.clientX - pdfLeft) / zoom;
    const relativeY = (e.clientY - pdfTop) / zoom;
    
    // S'assurer que la position reste dans les limites du PDF
    const finalX = Math.max(0, Math.min(relativeX, 595 - 100));
    const finalY = Math.max(0, Math.min(relativeY, 842 - 30));
    
    if (isAddingRawText) {
      const newVariable: TemplateVariable = {
        id: Date.now().toString(),
        name: rawText.substring(0, 20) + (rawText.length > 20 ? '...' : ''),
        description: 'Texte personnalisé',
        type: 'raw',
        rawText: rawText,
        fontSize: currentFontSize,
        fontFamily: 'Arial',
        position: {
          x: finalX,
          y: finalY,
          page: pageNumber
        },
        width: 100,
        height: 30,
        textAlign: 'left',
        verticalAlign: 'middle'
      };
      
      const updatedTemplate = {
        ...selectedTemplate,
        variables: [...selectedTemplate.variables, newVariable]
      };
      
      setTemplates(prev => prev.map(t => 
        t.id === selectedTemplate.id ? updatedTemplate : t
      ));
      
      setSelectedTemplate(updatedTemplate);
      setRawText('');
      setIsAddingRawText(false);
    } else if (selectedVariableId) {
      const variable = databaseFields[selectedDatabase].find(v => v.id === selectedVariableId);
      if (variable) {
        const newVariable: TemplateVariable = {
          id: Date.now().toString(),
          name: variable.name,
          description: variable.description,
          type: variable.type as 'text' | 'number' | 'date' | 'list',
          variableId: variable.id,
          fontSize: currentFontSize,
          fontFamily: 'Arial',
          position: {
            x: finalX,
            y: finalY,
            page: pageNumber
          },
          width: 100,
          height: 30,
          textAlign: 'left',
          verticalAlign: 'middle'
        };
        
        const updatedTemplate = {
          ...selectedTemplate,
          variables: [...selectedTemplate.variables, newVariable]
        };
        
        setTemplates(prev => prev.map(t => 
          t.id === selectedTemplate.id ? updatedTemplate : t
        ));
        
        setSelectedTemplate(updatedTemplate);
        setSelectedVariableId(null);
      }
    }
  };
  
  const handleVariableMouseDown = (e: React.MouseEvent<HTMLDivElement>, variableId: string) => {
    if (!pdfContainerRef.current || !selectedTemplate) return;
    e.preventDefault();
    e.stopPropagation();

    const pdfRect = pdfContainerRef.current.getBoundingClientRect();
    const pdfWidth = 595 * zoom;
    const pdfHeight = 842 * zoom;
    
    // Calculer la position du PDF centré dans le conteneur
    const pdfLeft = pdfRect.left + (pdfRect.width - pdfWidth) / 2;
    const pdfTop = pdfRect.top + (pdfRect.height - pdfHeight) / 2;
    
    const variable = selectedTemplate.variables.find(v => v.id === variableId);
    if (!variable) return;

    // Position de la souris dans le conteneur PDF
    const mouseX = (e.clientX - pdfLeft) / zoom;
    const mouseY = (e.clientY - pdfTop) / zoom;

    // Offset entre la souris et le coin supérieur gauche de la variable
    const offsetX = mouseX - variable.position.x;
    const offsetY = mouseY - variable.position.y;

    setDraggingVariable(variableId);
    setDragOffset({
      x: offsetX,
      y: offsetY
    });
  };

  const handleVariableMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingVariable || !pdfContainerRef.current || !selectedTemplate) return;
    
    const pdfRect = pdfContainerRef.current.getBoundingClientRect();
    const pdfWidth = 595 * zoom;
    const pdfHeight = 842 * zoom;
    
    // Calculer la position du PDF centré dans le conteneur
    const pdfLeft = pdfRect.left + (pdfRect.width - pdfWidth) / 2;
    const pdfTop = pdfRect.top + (pdfRect.height - pdfHeight) / 2;
    
    const variable = selectedTemplate.variables.find(v => v.id === draggingVariable);
    if (!variable) return;

    // Calculer la nouvelle position en tenant compte de l'offset initial et du zoom
    const newX = Math.round((e.clientX - pdfLeft) / zoom - dragOffset.x);
    const newY = Math.round((e.clientY - pdfTop) / zoom - dragOffset.y);
    
    // Limiter la position en fonction de la taille du PDF et de la variable
    const maxX = 595 - variable.width;
    const maxY = 842 - variable.height;
    
    const finalX = Math.max(0, Math.min(newX, maxX));
    const finalY = Math.max(0, Math.min(newY, maxY));
    
    const updatedVariables = selectedTemplate.variables.map(v => 
      v.id === draggingVariable 
        ? { ...v, position: { ...v.position, x: finalX, y: finalY } } 
        : v
    );
    
    setSelectedTemplate({
      ...selectedTemplate,
      variables: updatedVariables
    });
    
    // Mettre à jour l'état des modifications
    setHasUnsavedChanges(true);
  };

  const handleVariableMouseUp = () => {
    if (draggingVariable && selectedTemplate) {
      // Mettre à jour les templates avec la nouvelle position
      setTemplates(templates.map(t => 
        t.id === selectedTemplate.id ? selectedTemplate : t
      ));
      
      setDraggingVariable(null);
    }
  };
  
  const handleDeleteVariable = async (variableId: string) => {
    if (!selectedTemplate) return;

    try {
      setLoading(true);
      
      // Mettre à jour l'état local d'abord
      const updatedVariables = selectedTemplate.variables.filter(
        variable => variable.id !== variableId
      );
      
      const updatedTemplate = {
        ...selectedTemplate,
        variables: updatedVariables
      };
      
      // Mettre à jour les états
      setTemplates(templates.map(t => 
        t.id === selectedTemplate.id ? updatedTemplate : t
      ));
      
      setSelectedTemplate(updatedTemplate);
      setSelectedPlacedVariable(null);
      setHasUnsavedChanges(true);

      // Sauvegarder les modifications dans la base de données
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();
      
      if (!userData?.structureId) {
        throw new Error('Aucune structure associée à l\'utilisateur');
      }

      const templateRef = doc(db, 'templates', selectedTemplate.id);
      await updateDoc(templateRef, {
        variables: updatedVariables,
        updatedAt: serverTimestamp(),
        structureId: userData.structureId
      });

      // Mettre à jour l'état des modifications
      setLastSavedVariables([...updatedVariables]);
      setHasUnsavedChanges(false);
      
      setSnackbar({
        open: true,
        message: 'Variable supprimée avec succès',
        severity: 'success'
      });
      
    } catch (error) {
      console.error('Erreur lors de la suppression de la variable:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la suppression de la variable',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteTemplate = async (templateId: string) => {
    // Vérifier si le template est un template universel
    if (defaultTemplates[templateId]) {
      setSnackbar({
        open: true,
        message: 'Impossible de supprimer un template universel',
        severity: 'error'
      });
      return;
    }

    setTemplateToDelete(templateId);
    setDeleteConfirmationOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!currentUser || !templateToDelete) return;

    try {
      // 1. Récupérer les données du template
      const templateDoc = await getDoc(doc(db, 'templates', templateToDelete));
      if (!templateDoc.exists()) {
        throw new Error('Template non trouvé');
      }

      const templateData = templateDoc.data();

      // 2. Supprimer le fichier PDF de Firebase Storage
      if (templateData.pdfUrl) {
        const storageRef = ref(storage, templateData.pdfUrl);
        await deleteObject(storageRef).catch(error => {
          console.error('Erreur lors de la suppression du fichier:', error);
        });
      }

      // 3. Supprimer le document de Firestore
      await deleteDoc(doc(db, 'templates', templateToDelete));

      // 4. Mettre à jour l'état local
      setTemplates(templates.filter(template => template.id !== templateToDelete));
      if (selectedTemplate?.id === templateToDelete) {
        setSelectedTemplate(null);
      }

      // 5. Afficher une notification de succès
      setSnackbar({
        open: true,
        message: 'Template supprimé avec succès',
        severity: 'success'
      });

    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la suppression du template',
        severity: 'error'
      });
    } finally {
      setDeleteConfirmationOpen(false);
      setTemplateToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmationOpen(false);
    setTemplateToDelete(null);
  };
  
  const handleSaveAll = () => {
    // Ici, vous pourriez implémenter la sauvegarde vers une API ou localStorage
    localStorage.setItem('pdfTemplates', JSON.stringify(templates));
    setSaveSuccess(true);
  };
  
  // Remplacer l'useEffect existant qui charge les templates
  useEffect(() => {
    const fetchTemplates = async () => {
      if (!currentUser) return;

      try {
        setLoading(true);
        
        // Récupérer le structureId de l'utilisateur
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        
        if (!userData?.structureId) {
          throw new Error('Aucune structure associée à l\'utilisateur');
        }

        // Récupérer les templates de la structure
        const templatesRef = collection(db, 'templates');
        const q = query(templatesRef, where('structureId', '==', userData.structureId));
        const snapshot = await getDocs(q);
        
        const templatesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Template[];
        
        setTemplates(templatesList);
      } catch (error) {
        console.error("Erreur lors du chargement des templates:", error);
        setSnackbar({
          open: true,
          message: "Erreur lors du chargement des templates",
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [currentUser]);
  
  // Modifier l'useEffect qui charge le PDF
  useEffect(() => {
    const loadSelectedTemplatePDF = async () => {
      if (!selectedTemplate?.pdfUrl) return;

      try {
        setLoading(true);
        
        // Convertir le PDF en base64
        const base64PDF = await fetchPdfAsBase64(selectedTemplate.pdfUrl);
        
        setSelectedTemplate(prev => {
          if (!prev) return null;
          return {
            ...prev,
            file: {
              url: base64PDF,
              name: prev.fileName || 'template.pdf',
              type: 'application/pdf'
            }
          };
        });

      } catch (error) {
        console.error('Erreur lors du chargement du PDF:', error);
        setSnackbar({
          open: true,
          message: 'Erreur lors du chargement du PDF',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    if (selectedTemplate && !selectedTemplate.file) {
      loadSelectedTemplatePDF();
    }
  }, [selectedTemplate?.id]);
  
  const handleVariableSelect = (variableId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    setSelectedPlacedVariable(variableId);
    setPopupPosition({
      x: rect.left + scrollLeft,
      y: rect.top + scrollTop - 100
    });
  };

  // Ajouter la popup dans le rendu des variables
  const renderVariablesOnPdf = () => {
    if (!selectedTemplate || !pdfDocument) return null;

    return selectedTemplate.variables.map((variable) => {
      const style: React.CSSProperties = {
        position: 'absolute',
        left: `${variable.position.x}px`,
        top: `${variable.position.y}px`,
        width: `${variable.width}px`,
        height: `${variable.height}px`,
        fontSize: `${variable.fontSize}px`,
        fontFamily: variable.fontFamily || 'Arial',
        lineHeight: variable.lineHeight || 1.2, // Ajout du line-height
        textAlign: variable.textAlign,
        display: 'flex',
        alignItems: variable.verticalAlign,
        justifyContent: variable.textAlign === 'justify' ? 'space-between' : variable.textAlign,
        fontWeight: variable.isBold ? 'bold' : 'normal',
        cursor: 'move',
        userSelect: 'none',
        overflow: 'hidden',
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap'
      };

      return (
        <Box
          component="div"
          key={variable.id}
          sx={style}
          onClick={(e) => handleVariableSelect(variable.id, e)}
          onMouseDown={(e) => handleVariableMouseDown(e, variable.id)}
          onMouseUp={handleVariableMouseUp}
          onMouseMove={handleVariableMouseMove}
        >
          {variable.type === 'raw' ? replaceTags(variable.rawText || '', missionData, currentUser, {}) : variable.name}
          
          {/* Poignées de redimensionnement */}
          {selectedPlacedVariable === variable.id && (
            <>
              {/* Poignée en bas à droite */}
              <Box
                sx={{
                  position: 'absolute',
                  right: '-5px',
                  bottom: '-5px',
                  width: '10px',
                  height: '10px',
                  backgroundColor: '#0071e3',
                  borderRadius: '50%',
                  cursor: 'nwse-resize',
                  zIndex: 1001
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleResizeStart(e, variable.id, 'se');
                }}
              />
              
              {/* Poignée en bas à gauche */}
              <Box
                sx={{
                  position: 'absolute',
                  left: '-5px',
                  bottom: '-5px',
                  width: '10px',
                  height: '10px',
                  backgroundColor: '#0071e3',
                  borderRadius: '50%',
                  cursor: 'nesw-resize',
                  zIndex: 1001
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleResizeStart(e, variable.id, 'sw');
                }}
              />
              
              {/* Poignée en haut à droite */}
              <Box
                sx={{
                  position: 'absolute',
                  right: '-5px',
                  top: '-5px',
                  width: '10px',
                  height: '10px',
                  backgroundColor: '#0071e3',
                  borderRadius: '50%',
                  cursor: 'nesw-resize',
                  zIndex: 1001
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleResizeStart(e, variable.id, 'ne');
                }}
              />
              
              {/* Poignée en haut à gauche */}
              <Box
                sx={{
                  position: 'absolute',
                  left: '-5px',
                  top: '-5px',
                  width: '10px',
                  height: '10px',
                  backgroundColor: '#0071e3',
                  borderRadius: '50%',
                  cursor: 'nwse-resize',
                  zIndex: 1001
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleResizeStart(e, variable.id, 'nw');
                }}
              />
            </>
          )}
        </Box>
      );
    });
  };

  // Modifier le gestionnaire de clic en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const popup = document.querySelector('.variable-popup');
      const isClickInsidePopup = popup?.contains(target);
      
      if (!isClickInsidePopup && !target.closest('.MuiMenu-root')) {
        setPopupPosition(null);
        setSelectedPlacedVariable(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [popupPosition]);
  
  const handleSaveVariables = async () => {
    if (!selectedTemplate || !currentUser) {
      console.error('Erreur: selectedTemplate ou currentUser manquant', { selectedTemplate, currentUser });
      setSnackbar({
        open: true,
        message: 'Erreur: données manquantes',
        severity: 'error'
      });
      return;
    }

    try {
      setLoading(true);
      
      // Récupérer le structureId de l'utilisateur
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();
      
      if (!userData?.structureId) {
        throw new Error('Aucune structure associée à l\'utilisateur');
      }

      // Fonction pour nettoyer les valeurs undefined
      const cleanValue = (value: any, defaultValue: any) => {
        return value === undefined ? defaultValue : value;
      };

      // Créer une copie des variables avec les valeurs par défaut si nécessaire
      const variablesToSave = selectedTemplate.variables.map(variable => {
        try {
          const cleanedVariable = {
            id: cleanValue(variable.id, ''),
            name: cleanValue(variable.name, ''),
            description: cleanValue(variable.description, ''),
            type: cleanValue(variable.type, 'text'),
            variableId: cleanValue(variable.variableId, null),
            rawText: cleanValue(variable.rawText, null),
            fieldId: cleanValue(variable.fieldId, null),
            position: {
              x: Number(cleanValue(variable.position?.x, 0)),
              y: Number(cleanValue(variable.position?.y, 0)),
              page: Number(cleanValue(variable.position?.page, 1))
            },
            fontSize: Number(cleanValue(variable.fontSize, 12)),
            fontFamily: cleanValue(variable.fontFamily, 'Arial'),
            lineHeight: Number(cleanValue(variable.lineHeight, 1.2)),
            dataSource: cleanValue(variable.dataSource, null),
            width: Number(cleanValue(variable.width, 100)),
            height: Number(cleanValue(variable.height, 30)),
            textAlign: cleanValue(variable.textAlign, 'left'),
            verticalAlign: cleanValue(variable.verticalAlign, 'middle'),
            isBold: Boolean(cleanValue(variable.isBold, false))
          };

          // Supprimer les propriétés null
          Object.keys(cleanedVariable).forEach(key => {
            if (cleanedVariable[key] === null) {
              delete cleanedVariable[key];
            }
          });

          return cleanedVariable;
        } catch (error) {
          console.error('Erreur lors de la préparation de la variable:', variable, error);
          throw new Error(`Erreur lors de la préparation de la variable ${variable.id}`);
        }
      });

      // Mise à jour du document dans Firestore
      const templateRef = doc(db, 'templates', selectedTemplate.id);
      await updateDoc(templateRef, {
        variables: variablesToSave,
        updatedAt: serverTimestamp(),
        structureId: userData.structureId
      });

      // Mise à jour de l'état local avec les variables sauvegardées
      const updatedTemplate = {
        ...selectedTemplate,
        variables: variablesToSave
      };

      // Mettre à jour les templates avec les variables sauvegardées
      setTemplates(prev => prev.map(template => 
        template.id === selectedTemplate.id ? updatedTemplate : template
      ));
      
      // Mettre à jour le template sélectionné
      setSelectedTemplate(updatedTemplate);

      // Mettre à jour l'état des modifications
      setLastSavedVariables([...variablesToSave]);
      setHasUnsavedChanges(false);

      setSnackbar({
        open: true,
        message: 'Variables enregistrées avec succès',
        severity: 'success'
      });

    } catch (error) {
      console.error('Erreur détaillée lors de la sauvegarde des variables:', error);
      setSnackbar({
        open: true,
        message: `Erreur lors de la sauvegarde des variables: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Ajouter un useEffect pour suivre les modifications
  useEffect(() => {
    if (selectedTemplate) {
      const currentVariables = selectedTemplate.variables;
      const savedVariables = lastSavedVariables;
      
      // Comparer les variables actuelles avec les dernières sauvegardées
      const hasChanges = JSON.stringify(currentVariables) !== JSON.stringify(savedVariables);
      setHasUnsavedChanges(hasChanges);
    }
  }, [selectedTemplate?.variables, lastSavedVariables]);

  // Modifier l'effet qui charge le template sélectionné
  useEffect(() => {
    if (selectedTemplate) {
      setLastSavedVariables([...selectedTemplate.variables]);
      setHasUnsavedChanges(false);
    }
  }, [selectedTemplate?.id]);
  
  const handleAddVariable = (variable: DatabaseField) => {
    if (!selectedTemplate) return;

    const newVariable: TemplateVariable = {
      id: `${Date.now()}`,
      name: variable.name,
      description: variable.description,
      type: variable.type as 'text' | 'number' | 'date' | 'list' | 'raw',
      fieldId: variable.id,
      position: { x: 0, y: 0, page: 1 },
      fontSize: currentFontSize,
      dataSource: selectedDatabase,
      width: 100,
      height: 30,
      textAlign: 'left',
      verticalAlign: 'middle'  // Définir l'alignement vertical par défaut à 'middle'
    };

    setSelectedTemplate(prev => {
      if (!prev) return null;
      return {
        ...prev,
        variables: [...prev.variables, newVariable]
      };
    });

    // Sauvegarde automatique après l'ajout d'une variable
    handleSaveVariables();
  };
  
  // Déplacer les options PDF au niveau du composant et utiliser useMemo
  const pdfOptions = React.useMemo(() => ({
    cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/'
  }), []);

  const renderPDF = () => {
    if (!selectedTemplate?.file?.url) return null;

    return (
      <Box 
        component="div"
        sx={{ 
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          width: '100%',
          height: '100%',
          margin: '0 auto',
          backgroundColor: 'white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            transform: `scale(${zoom})`,
            transformOrigin: 'top left'
          }}
        >
          <Document
            file={selectedTemplate.file.url}
            onLoadSuccess={(pdf) => handleDocumentLoadSuccess({ numPages: pdf.numPages, pdf })}
            onLoadError={(error) => {
              console.error('Erreur de chargement du PDF:', error);
              setSnackbar({
                open: true,
                message: 'Erreur lors du chargement du PDF',
                severity: 'error'
              });
            }}
            loading={
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            }
            options={pdfOptions}
          >
            <Page 
              pageNumber={pageNumber} 
              width={595}
              height={842}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
        </Box>
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            pointerEvents: 'none'
          }}
        >
          {selectedTemplate.variables
            .filter(v => v.position.page === pageNumber)
            .map(variable => (
              <Box
                component="div"
                key={variable.id}
                sx={{
                  position: 'absolute',
                  left: `${variable.position.x}px`,
                  top: `${variable.position.y}px`,
                  width: `${variable.width}px`,
                  height: `${variable.height}px`,
                  backgroundColor: selectedPlacedVariable === variable.id 
                    ? 'rgba(0, 113, 227, 0.3)' 
                    : 'rgba(0, 113, 227, 0.1)',
                  padding: '0px',
                  borderRadius: '2px',
                  fontSize: `${variable.fontSize}pt`,
                  fontFamily: variable.fontFamily || 'Arial',
                  fontWeight: variable.isBold ? 'bold' : 'normal',
                  border: selectedPlacedVariable === variable.id 
                    ? '1px solid #0071e3' 
                    : '1px solid transparent',
                  cursor: draggingVariable === variable.id ? 'grabbing' : 'grab',
                  userSelect: 'none',
                  zIndex: draggingVariable === variable.id ? 1000 : 1,
                  display: 'flex',
                  alignItems: 'center',  // Forcer l'alignement vertical au centre
                  justifyContent: variable.textAlign === 'left' ? 'flex-start' : 
                                 variable.textAlign === 'right' ? 'flex-end' : 
                                 variable.textAlign === 'justify' ? 'space-between' : 'center',
                  textRendering: 'geometricPrecision',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  pointerEvents: 'auto',
                  overflow: 'hidden',
                  textAlign: variable.textAlign === 'justify' ? 'justify' : variable.textAlign,
                  transition: draggingVariable === variable.id ? 'none' : 'all 0.2s ease'
                }}
                onClick={(e) => handleVariableSelect(variable.id, e)}
                onMouseDown={(e) => handleVariableMouseDown(e, variable.id)}
                onMouseUp={handleVariableMouseUp}
                onMouseMove={handleVariableMouseMove}
              >
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',  // Forcer l'alignement vertical au centre
                    justifyContent: variable.textAlign === 'left' ? 'flex-start' : 
                                   variable.textAlign === 'right' ? 'flex-end' : 
                                   variable.textAlign === 'justify' ? 'space-between' : 'center',
                  }}
                >
                  {variable.type === 'raw' ? replaceTags(variable.rawText || '', missionData, currentUser, {}) : variable.name}
                </Box>
                
                {/* Poignées de redimensionnement */}
                {selectedPlacedVariable === variable.id && (
                  <>
                    {/* Poignée en bas à droite */}
                    <Box
                      sx={{
                        position: 'absolute',
                        right: '-5px',
                        bottom: '-5px',
                        width: '10px',
                        height: '10px',
                        backgroundColor: '#0071e3',
                        borderRadius: '50%',
                        cursor: 'nwse-resize',
                        zIndex: 1001
                      }}
                      onMouseDown={(e) => handleResizeStart(e, variable.id, 'se')}
                    />
                  </>
                )}
              </Box>
            ))}
        </Box>
      </Box>
    );
  };
  
  // Ajouter cette fonction pour récupérer les champs dynamiquement
  const fetchDatabaseFields = async () => {
    if (!currentUser) return;

    try {
      // Récupérer le structureId de l'utilisateur
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();
      
      if (!userData?.structureId) {
        throw new Error('Aucune structure associée à l\'utilisateur');
      }

      // Récupérer les données de la structure
      const structureDoc = await getDoc(doc(db, 'structures', userData.structureId));
      const structureData = structureDoc.data();

      if (!structureData) {
        throw new Error('Structure non trouvée');
      }

      const missionsSnapshot = await getDocs(collection(db, 'missions'));
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const companiesSnapshot = await getDocs(collection(db, 'companies'));
      const expenseNotesSnapshot = await getDocs(collection(db, 'expenseNotes'));
      const workingHoursSnapshot = await getDocs(collection(db, 'workingHours'));

      if (!missionsSnapshot.empty || !usersSnapshot.empty || !companiesSnapshot.empty || 
          !expenseNotesSnapshot.empty || !workingHoursSnapshot.empty) {
        
        const missionDoc = missionsSnapshot.docs[0]?.data() || {};
        const userDoc = usersSnapshot.docs[0]?.data() || {};
        const companyDoc = companiesSnapshot.docs[0]?.data() || {};
        const expenseNoteDoc = expenseNotesSnapshot.docs[0]?.data() || {};
        const workingHourDoc = workingHoursSnapshot.docs[0]?.data() || {};

        // Définir les descriptions spécifiques pour chaque type de champ
        const fieldDescriptions: { [key: string]: string } = {
          // Champs des missions
          isPublic: "Indique si la mission est visible publiquement ou non",
          chargeId: "Numéro du chargé de mission",
          chargeName: "Nom complet du chargé de mission",
          numeroMission: "Numéro unique de la mission",
          missionStartDate: "Date de début de la mission",
          missionEndDate: "Date de fin de la mission",
          location: "Lieu où se déroule la mission",
          company: "Entreprise pour laquelle la mission est réalisée",
          priceHT: "Prix hors taxes de la mission",
          missionDescription: "Description détaillée de la mission",
          title: "Titre de la mission",
          hours: "Nombre total d'heures de la mission",
          missionStatus: "État actuel de la mission (En cours, Terminée, etc.)",
          hoursPerStudent: "Nombre d'heures allouées par étudiant",
          studentCount: "Nombre total d'étudiants sur la mission",
          structureId: "Identifiant de la structure associée à la mission",
          createdBy: "Identifiant de l'utilisateur ayant créé la mission",
          missionCreatedAt: "Date de création de la mission",
          missionUpdatedAt: "Date de dernière modification de la mission",
          updatedBy: "Identifiant de l'utilisateur ayant modifié la mission en dernier",
          
          // Champs des utilisateurs
          lastName: "Nom de famille de l'utilisateur",
          firstName: "Prénom de l'utilisateur",
          userEmail: "Adresse email de l'utilisateur",
          ecole: "École de formation de l'utilisateur",
          userPhone: "Numéro de téléphone de l'utilisateur",
          userAddress: "Adresse postale de l'utilisateur",
          userCity: "Ville de résidence de l'utilisateur",
          formation: "Formation suivie par l'utilisateur",
          speciality: "Spécialité de l'utilisateur",
          studyLevel: "Niveau d'études de l'utilisateur",
          displayName: "Nom complet de l'utilisateur",
          program: "Programme de l'utilisateur (PGE, Bachelor...)",
          graduationYear: "Année de diplômation de l'utilisateur",
          nationality: "Nationalité de l'utilisateur",
          gender: "Sexe de l'utilisateur",
          birthPlace: "Lieu de naissance de l'utilisateur",
          birthDate: "Date de naissance de l'utilisateur",
          studentId: "Identifiant unique de l'utilisateur",
          studentStatus: "Statut de l'utilisateur (Actif, Inactif, etc.)",
          studentUpdatedAt: "Date de dernière modification de l'utilisateur",
          socialSecurityNumber: "Numéro de sécurité sociale de l'utilisateur",
          
          // Champs des entreprises
          companyName: "Nom de l'entreprise",
          siren: "Numéro SIREN de l'entreprise",
          companyAddress: "Adresse du siège social",
          companyCity: "Ville du siège social",
          country: "Pays de l'entreprise",
          companyPhone: "Numéro de téléphone de l'entreprise",
          companyEmail: "Email de contact de l'entreprise",
          website: "Site web de l'entreprise",
          companyUpdatedAt: "Date de dernière modification de l'entreprise",
          
          // Champs des notes de frais
          amount: "Montant total de la note de frais",
          expenseDescription: "Description détaillée des frais",
          expenseDate: "Date de la note de frais",
          expenseStatus: "État de la note de frais (En attente, Validée, Refusée)",
          expenseCreatedAt: "Date de création de la note de frais",
          expenseUpdatedAt: "Date de dernière modification de la note de frais",
          
          // Variables supplémentaires trouvées dans le code
          email: "Adresse email",
          phone: "Numéro de téléphone",
          address: "Adresse",
          city: "Ville",
          description: "Description",
          name: "Nom",
          status: "Statut de la mission (En attente...)",
          date: "Date",
          userDisplayName: "Nom d'affichage de l'utilisateur",
          userNomComplet: "Nom complet de l'utilisateur",
          
          // Champs des heures de travail
          workingHoursDate: "Date des heures travaillées",
          workingHoursStartTime: "Heure de début",
          workingHoursEndTime: "Heure de fin",
          workingHoursBreaks: "Liste des pauses",
          workingHoursTotal: "Total des heures travaillées",
          workingHoursCreatedAt: "Date de création",
          workingHoursUpdatedAt: "Date de mise à jour",
          
          // Champs des avenants
          amendmentNumber: "Numéro d'avenant",
          amendmentDate: "Date de l'avenant",
          amendmentDescription: "Description de l'avenant",
          amendmentAmount: "Montant de l'avenant",
          amendmentStatus: "Statut de l'avenant",
          plannedStartDate: "Date de début prévue",
          plannedEndDate: "Date de fin prévue",
          actualStartDate: "Date de début réelle",
          actualEndDate: "Date de fin réelle",
          plannedHours: "Heures prévues",
          actualHours: "Heures réelles",
          reason: "Motif",
          createdAt: "Date de création",
          createdByName: "Créé par",
          
          // Champs des contacts
          contact_fullName: "Prénom et Nom du contact",
          contact_firstName: "Prénom du contact",
          contact_lastName: "Nom du contact",
          contact_email: "Email du contact",
          contact_phone: "Téléphone du contact",
          contact_position: "Poste du contact",
          contact_linkedin: "LinkedIn du contact",
          
          // Champs de la structure
          structure_name: "Nom de la structure",
          structure_siret: "Numéro SIRET de la structure",
          structure_address: "Adresse de la structure",
          structure_city: "Ville de la structure",
          structure_postalCode: "Code postal de la structure",
          structure_country: "Pays de la structure",
          structure_phone: "Téléphone de la structure",
          structure_email: "Email de la structure",
          structure_website: "Site web de la structure",
          structure_description: "Description de la structure",
          structure_tvaNumber: "Numéro de TVA intracommunautaire de la structure",
          structure_apeCode: "Code APE de la structure",
          charge_email: "Email du chargé de mission",
          charge_phone: "Téléphone du chargé de mission",
          totalHT: "Total HT",
          totalTTC: "Total TTC",
          tva: "Montant TVA",
          courseApplication: "Application du cours",
          missionLearning: "Apprentissage",
          studentProfile: "Profil étudiant"
        };

        const missionFields = [
          { id: 'numeroMission', name: 'Numéro de mission', description: 'Numéro unique de la mission', type: 'text' },
          { id: 'chargeName', name: 'Prénom Nom CDM', description: 'Nom du chef de mission', type: 'text' },
          { id: 'missionStartDate', name: 'Début de mission', description: 'Date de début de la mission', type: 'date' },
          { id: 'missionEndDate', name: 'Fin de mission', description: 'Date de fin de la mission', type: 'date' },
          { id: 'location', name: 'Lieu de la mission', description: 'Lieu où se déroule la mission', type: 'text' },
          { id: 'company', name: 'Nom de l\'entreprise', description: 'Entreprise pour laquelle la mission est réalisée', type: 'text' },
          { id: 'missionType', name: 'Type de mission', description: 'Type de la mission', type: 'text' },
          { id: 'generationDate', name: 'Date de génération', description: 'Date à laquelle le document est généré', type: 'date' },
          { id: 'priceHT', name: 'Prix HT', description: 'Prix hors taxes de la mission', type: 'number' },
          { id: 'missionDescription', name: 'Description de la mission', description: 'Description détaillée de la mission', type: 'text' },
          { id: 'title', name: 'Titre', description: 'Titre de la mission', type: 'text' },
          { id: 'hours', name: 'Nombre d\'heures', description: 'Nombre total d\'heures de la mission', type: 'number' },
          { id: 'studentCount', name: 'Nombre d\'étudiants', description: 'Nombre total d\'étudiants sur la mission', type: 'number' },
          { id: 'charge_email', name: 'Email du chargé de mission', description: 'Email du chargé de mission', type: 'text' },
          { id: 'charge_phone', name: 'Téléphone du chargé de mission', description: 'Téléphone du chargé de mission', type: 'text' },
          { id: 'totalHT', name: 'Total HT', description: 'Montant total hors taxes de la mission', type: 'number' },
          { id: 'totalTTC', name: 'Total TTC', description: 'Montant total toutes taxes comprises de la mission', type: 'number' },
          { id: 'tva', name: 'Montant TVA', description: 'Montant de la TVA calculé sur le total TTC', type: 'number' },
          { id: 'courseApplication', name: 'Application du cours', description: 'Gestion des papiers et application du cours', type: 'text' },
          { id: 'missionLearning', name: 'Apprentissage', description: 'Objectifs d\'apprentissage de la mission', type: 'text' },
          { id: 'studentProfile', name: 'Profil étudiant', description: 'Profil type de l\'étudiant recherché', type: 'text' }
        ];

        const userFields = [
          { id: 'lastName', name: 'Nom de famille', description: 'Nom de famille de l\'utilisateur', type: 'text' },
          { id: 'firstName', name: 'Prénom', description: 'Prénom de l\'utilisateur', type: 'text' },
          { id: 'email', name: 'Adresse email', description: 'Adresse email de l\'utilisateur', type: 'text' },
          { id: 'ecole', name: 'École', description: 'École de formation de l\'utilisateur', type: 'text' },
          { id: 'phone', name: 'Téléphone', description: 'Numéro de téléphone de l\'utilisateur', type: 'text' },
          { id: 'socialSecurityNumber', name: 'Numéro de sécurité sociale', description: 'Numéro de sécurité sociale de l\'utilisateur', type: 'text' },
          { id: 'address', name: 'Adresse', description: 'Adresse postale de l\'utilisateur', type: 'text' },
          { id: 'city', name: 'Ville', description: 'Ville de résidence de l\'utilisateur', type: 'text' },
          { id: 'formation', name: 'Formation', description: 'Formation suivie par l\'utilisateur', type: 'text' },
          { id: 'program', name: 'Programme', description: 'Programme de l\'utilisateur', type: 'text' },
          { id: 'graduationYear', name: 'Année de diplômation', description: 'Année de diplômation de l\'utilisateur', type: 'text' },
          { id: 'nationality', name: 'Nationalité', description: 'Nationalité de l\'utilisateur', type: 'text' },
          { id: 'gender', name: 'Genre', description: 'Genre de l\'utilisateur', type: 'text' },
          { id: 'birthPlace', name: 'Lieu de naissance', description: 'Lieu de naissance de l\'utilisateur', type: 'text' },
          { id: 'birthDate', name: 'Date de naissance', description: 'Date de naissance de l\'utilisateur', type: 'date' }
        ];

        const companyFields = [
          { id: 'companyName', name: 'Nom de l\'entreprise', description: 'Nom de l\'entreprise', type: 'text' },
          { id: 'siren', name: 'Numéro SIRET', description: 'Numéro SIRET de l\'entreprise', type: 'text' },
          { id: 'companyAddress', name: 'Adresse', description: 'Adresse du siège social', type: 'text' },
          { id: 'companyCity', name: 'Ville', description: 'Ville du siège social', type: 'text' },
          { id: 'country', name: 'Pays', description: 'Pays de l\'entreprise', type: 'text' },
          { id: 'companyPhone', name: 'Téléphone', description: 'Numéro de téléphone de l\'entreprise', type: 'text' },
          { id: 'companyEmail', name: 'Email', description: 'Email de contact de l\'entreprise', type: 'text' },
          { id: 'website', name: 'Site web', description: 'Site web de l\'entreprise', type: 'text' }
        ];

        const expenseNoteFields = [
          { id: 'amount', name: 'Montant', description: 'Montant de la note de frais', type: 'number' },
          { id: 'expenseDescription', name: 'Description', description: 'Description de la note de frais', type: 'text' },
          { id: 'expenseDate', name: 'Date', description: 'Date de la note de frais', type: 'date' }
        ];

        const workingHourFields = [
          { id: 'startDate', name: 'Date de début', description: 'Date de début des heures travaillées', type: 'date' },
          { id: 'startTime', name: 'Heure de début', description: 'Heure de début des heures travaillées', type: 'text' },
          { id: 'endDate', name: 'Date de fin', description: 'Date de fin des heures travaillées', type: 'date' },
          { id: 'endTime', name: 'Heure de fin', description: 'Heure de fin des heures travaillées', type: 'text' },
          { id: 'breaks', name: 'Pauses', description: 'Liste des pauses', type: 'array' },
          { id: 'totalHours', name: 'Total des heures', description: 'Total des heures travaillées', type: 'number' }
        ];

        const amendmentFields = [
          { id: 'plannedStartDate', name: 'Date de début prévue', description: 'Date de début prévue de l\'avenant', type: 'date' },
          { id: 'plannedEndDate', name: 'Date de fin prévue', description: 'Date de fin prévue de l\'avenant', type: 'date' },
          { id: 'actualStartDate', name: 'Date de début réelle', description: 'Date de début réelle de l\'avenant', type: 'date' },
          { id: 'actualEndDate', name: 'Date de fin réelle', description: 'Date de fin réelle de l\'avenant', type: 'date' },
          { id: 'plannedHours', name: 'Heures prévues', description: 'Nombre d\'heures prévues dans l\'avenant', type: 'number' },
          { id: 'actualHours', name: 'Heures réelles', description: 'Nombre d\'heures réelles de l\'avenant', type: 'number' },
          { id: 'reason', name: 'Motif', description: 'Motif de l\'avenant', type: 'text' }
        ];

        // Récupérer les champs de contacts
        const contactsFields: DatabaseField[] = [
          {
            id: 'contact_fullName',
            name: 'Prénom et Nom du contact',
            description: 'Prénom et Nom du contact principal de l\'entreprise',
            type: 'text'
          },
          {
            id: 'contact_firstName',
            name: 'Prénom du contact',
            description: 'Prénom du contact principal de l\'entreprise',
            type: 'text'
          },
          {
            id: 'contact_lastName',
            name: 'Nom du contact',
            description: 'Nom du contact principal de l\'entreprise',
            type: 'text'
          },
          {
            id: 'contact_email',
            name: 'Email du contact',
            description: 'Email du contact principal de l\'entreprise',
            type: 'text'
          },
          {
            id: 'contact_phone',
            name: 'Téléphone du contact',
            description: 'Numéro de téléphone du contact principal de l\'entreprise',
            type: 'text'
          },
          {
            id: 'contact_position',
            name: 'Poste du contact',
            description: 'Poste occupé par le contact principal de l\'entreprise',
            type: 'text'
          },
          {
            id: 'contact_linkedin',
            name: 'LinkedIn du contact',
            description: 'URL du profil LinkedIn du contact principal de l\'entreprise',
            type: 'text'
          }
        ];

        const structureFields = [
          { id: 'name', name: 'Nom', description: 'Nom de la structure', type: 'text' },
          { id: 'address', name: 'Adresse', description: 'Adresse de la structure', type: 'text' },
          { id: 'phone', name: 'Téléphone', description: 'Téléphone de la structure', type: 'text' },
          { id: 'email', name: 'Email', description: 'Email de contact de la structure', type: 'text' },
          { id: 'website', name: 'Site web', description: 'Site web de la structure', type: 'text' },
          { id: 'description', name: 'Description', description: 'Description de la structure', type: 'text' },
          { id: 'siret', name: 'SIRET', description: 'Numéro SIRET de la structure (14 chiffres)', type: 'text' },
          { id: 'tvaNumber', name: 'N° de TVA intracommunautaire', description: 'Numéro de TVA intracommunautaire de la structure (format FR + 11 chiffres)', type: 'text' },
          { id: 'apeCode', name: 'Code APE', description: 'Code APE de la structure (4 chiffres + 1 lettre)', type: 'text' },
          { id: 'structure_address', name: 'Adresse de la structure', description: 'Adresse de la structure', type: 'text' },
          { id: 'structure_phone', name: 'N° de téléphone de la structure', description: 'N° de téléphone de la structure', type: 'text' },
          { id: 'structure_email', name: 'Email de la structure', description: 'Email de la structure', type: 'text' }
        ];

        setDatabaseFields({
          missions: missionFields,
          users: userFields,
          companies: companyFields,
          contacts: contactsFields,
          expenseNotes: expenseNoteFields,
          workingHours: workingHourFields,
          amendments: amendmentFields,
          structures: structureFields
        });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des champs:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la récupération des données de la structure',
        severity: 'error'
      });
    }
  };

  // Ajouter cet useEffect pour charger les champs au montage du composant
  useEffect(() => {
    fetchDatabaseFields();
  }, []);
  
  // Ajouter ces états et fonctions pour gérer le redimensionnement
  const handleResizeStart = (e: React.MouseEvent, variableId: string, direction: 'nw' | 'ne' | 'sw' | 'se') => {
    if (!selectedTemplate) return;
    
    e.stopPropagation();
    setResizingVariable(variableId);
    setResizeDirection(direction);
    
    const variable = selectedTemplate.variables.find(v => v.id === variableId);
    if (variable) {
      setResizeStartPos({ x: e.clientX, y: e.clientY });
      setResizeStartSize({ width: variable.width, height: variable.height });
    }
  };

  const handleResizeMove = (e: React.MouseEvent) => {
    if (!resizingVariable || !resizeDirection || !selectedTemplate) return;
    
    const deltaX = (e.clientX - resizeStartPos.x) / zoom;
    const deltaY = (e.clientY - resizeStartPos.y) / zoom;
    
    const variable = selectedTemplate.variables.find(v => v.id === resizingVariable);
    if (!variable) return;
    
    let newWidth = resizeStartSize.width;
    let newHeight = resizeStartSize.height;
    
    // Ajuster uniquement la taille en fonction de la direction
    switch (resizeDirection) {
      case 'se':
        // Redimensionnement depuis le coin inférieur droit
        newWidth = Math.max(20, Math.min(resizeStartSize.width + deltaX, 595 - variable.position.x));
        newHeight = Math.max(20, Math.min(resizeStartSize.height + deltaY, 842 - variable.position.y));
        break;
      case 'sw':
        // Redimensionnement depuis le coin inférieur gauche
        newWidth = Math.max(20, Math.min(resizeStartSize.width - deltaX, variable.position.x + resizeStartSize.width));
        newHeight = Math.max(20, Math.min(resizeStartSize.height + deltaY, 842 - variable.position.y));
        break;
      case 'ne':
        // Redimensionnement depuis le coin supérieur droit
        newWidth = Math.max(20, Math.min(resizeStartSize.width + deltaX, 595 - variable.position.x));
        newHeight = Math.max(20, Math.min(resizeStartSize.height - deltaY, variable.position.y + resizeStartSize.height));
        break;
      case 'nw':
        // Redimensionnement depuis le coin supérieur gauche
        newWidth = Math.max(20, Math.min(resizeStartSize.width - deltaX, variable.position.x + resizeStartSize.width));
        newHeight = Math.max(20, Math.min(resizeStartSize.height - deltaY, variable.position.y + resizeStartSize.height));
        break;
    }
    
    const updatedVariables = selectedTemplate.variables.map(v => 
      v.id === resizingVariable 
        ? { 
            ...v, 
            width: newWidth, 
            height: newHeight
          } 
        : v
    );
    
    setSelectedTemplate({
      ...selectedTemplate,
      variables: updatedVariables
    });
    
    setHasUnsavedChanges(true);
  };

  const handleResizeEnd = () => {
    if (resizingVariable && selectedTemplate) {
      // Mettre à jour les templates avec la nouvelle taille
      setTemplates(templates.map(t => 
        t.id === selectedTemplate.id ? selectedTemplate : t
      ));
    }
    
    setResizingVariable(null);
    setResizeDirection(null);
  };

  const getTagFromVariableId = (variableId: string): string => {
    const tagMap: { [key: string]: string } = {
      // Mission
      numeroMission: '<mission_numero>',
      chargeName: '<mission_cdm>',
      missionStartDate: '<mission_debut>',
      missionEndDate: '<mission_fin>',
      location: '<mission_lieu>',
      company: '<mission_entreprise>',
      priceHT: '<mission_prix>',
      missionDescription: '<mission_description>',
      title: '<mission_titre>',
      hours: '<mission_heures>',
      studentCount: '<mission_nb_etudiants>',
      
      // User
      lastName: '<user_nom>',
      firstName: '<user_prenom>',
      email: '<user_email>',
      ecole: '<user_ecole>',
      displayName: '<user_nom_complet>',
      phone: '<user_telephone>',
      socialSecurityNumber: '<user_numero_securite_sociale>',
      
      // Company
      companyName: '<company_nom>',
      siren: '<company_siren>',
      companyAddress: '<company_adresse>',
      
      // Expense Note
      amount: '<expense_montant>',
      expenseDescription: '<expense_description>',
      expenseDate: '<expense_date>',
      
      // Working Hours
      workingHoursDate: '<working_hours_date>',
      workingHoursStartTime: '<working_hours_debut>',
      workingHoursEndTime: '<working_hours_fin>',
      workingHoursDescription: '<working_hours_description>',
      
      // Amendments
      amendmentNumber: '<amendment_number>',
      amendmentDate: '<amendment_date>',
      amendmentDescription: '<amendment_description>',
      amendmentAmount: '<amendment_amount>',
      amendmentStatus: '<amendment_status>',
      plannedStartDate: '<amendment_planned_start_date>',
      plannedEndDate: '<amendment_planned_end_date>',
      actualStartDate: '<amendment_actual_start_date>',
      actualEndDate: '<amendment_actual_end_date>',
      plannedHours: '<amendment_planned_hours>',
      actualHours: '<amendment_actual_hours>',
      reason: '<amendment_reason>',
      createdAt: '<amendment_created_at>',
      createdByName: '<amendment_created_by>',
      
      // Contacts
      contact_fullName: '<contact_fullName>',
      contact_firstName: '<contact_firstName>',
      contact_lastName: '<contact_lastName>',
      contact_email: '<contact_email>',
      contact_phone: '<contact_phone>',
      contact_position: '<contact_position>',
      contact_linkedin: '<contact_linkedin>',
      
      // Structure
      structure_name: '<structure_nom>',
      structure_siret: '<structure_siret>',
      structure_address: '<structure_adresse>',
      structure_city: '<structure_ville>',
      structure_postalCode: '<structure_code_postal>',
      structure_country: '<structure_pays>',
      structure_phone: '<structure_phone>',
      structure_email: '<structure_email>',
      structure_website: '<structure_site_web>',
      structure_description: '<structure_description>',
      structure_tvaNumber: '<structure_tvaNumber>',
      structure_apeCode: '<structure_apeCode>',
      charge_email: '<charge_email>',
      charge_phone: '<charge_phone>',
      totalHT: '<total_ht>',
      totalTTC: '<total_ttc>',
      tva: '<tva>',
      courseApplication: '<course_application>',
      missionLearning: '<mission_learning>',
      studentProfile: '<student_profile>'
    };

    return tagMap[variableId] || variableId;
  };

  // Fonction pour récupérer les types de mission
  const fetchMissionTypes = async () => {
    try {
      const missionTypesRef = collection(db, 'missionTypes');
      const missionTypesSnapshot = await getDocs(missionTypesRef);
      const types = missionTypesSnapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title
      }));
      setMissionTypes(types);
    } catch (error) {
      console.error('Erreur lors de la récupération des types de mission:', error);
    }
  };

  // Modifier aussi la création des variables de type 'raw'
  const handleSaveRawText = () => {
    if (!selectedTemplate || !rawText.trim()) return;

    const newVariable: TemplateVariable = {
      id: Date.now().toString(),
      name: rawText.substring(0, 20) + (rawText.length > 20 ? '...' : ''),
      description: 'Texte personnalisé',
      type: 'raw',
      rawText: rawText,
      fontSize: currentFontSize,
      fontFamily: 'Arial',
      position: {
        x: 0,
        y: 0,
        page: pageNumber
      },
      width: 100,
      height: 30,
      textAlign: 'left',
      verticalAlign: 'middle'  // Définir l'alignement vertical par défaut à 'middle'
    };

    setSelectedTemplate(prev => {
      if (!prev) return null;
      return {
        ...prev,
        variables: [...prev.variables, newVariable]
      };
    });

    setRawText('');
    setIsAddingRawText(false);
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    // ... autre logique existante ...
  };

  const handleOpenLineHeightDialog = (variableId: string) => {
    const variable = selectedTemplate?.variables.find(v => v.id === variableId);
    if (variable) {
      setSelectedVariableId(variableId);
      setSelectedLineHeight(variable.lineHeight || 1.2);
      setLineHeightDialogOpen(true);
    }
  };

  const handleCloseLineHeightDialog = () => {
    setLineHeightDialogOpen(false);
    setSelectedVariableId(null);
  };

  const handleSaveLineHeight = () => {
    if (selectedVariableId && selectedTemplate) {
      const updatedVariables = selectedTemplate.variables.map(variable => {
        if (variable.id === selectedVariableId) {
          return {
            ...variable,
            lineHeight: selectedLineHeight
          };
        }
        return variable;
      });

      setSelectedTemplate({
        ...selectedTemplate,
        variables: updatedVariables
      });
    }
    handleCloseLineHeightDialog();
  };

  return (
    <Box sx={{ p: 3 }}>
      <BackButton />
      {/* En-tête avec les boutons et le sélecteur de template */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          <FormControl sx={{ minWidth: 300 }}>
            <InputLabel>Template</InputLabel>
            <Select
              value={selectedTemplate?.id || ''}
              onChange={(e) => {
                const template = templates.find(t => t.id === e.target.value);
                setSelectedTemplate(template || null);
              }}
              label="Template"
            >
              {templates.map(template => (
                <MenuItem
                  key={template.id}
                  value={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.1)
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <TextSnippetIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography>{template.name}</Typography>
                  </Box>
                  {!defaultTemplates[template.id] && (
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTemplate(template.id);
                      }}
                      size="small"
                      sx={{
                        color: theme.palette.error.main,
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.error.main, 0.1)
                        }
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setOpenDialog(true)}
            startIcon={<AddIcon />}
          >
            Créer une nouvelle template
          </Button>
        </Box>
      </Box>

      {/* Bouton de sauvegarde fixe */}
      {selectedTemplate && (
        <Box
          sx={{
            position: 'fixed',
            top: 130,
            right: 75,
            zIndex: 1000,
            display: 'flex',
            gap: 1,
            backgroundColor: 'transparent'
          }}
        >
          <Button
            variant="contained"
            color="primary"
            onClick={handleSaveVariables}
            disabled={loading || !hasUnsavedChanges}
            startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
            sx={{
              boxShadow: 3,
              '&:hover': {
                boxShadow: 6
              },
              minWidth: '200px'
            }}
          >
            {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </Button>
        </Box>
      )}

      {/* Popup de modification rapide */}
      {selectedPlacedVariable && popupPosition && (
        <Box
          className="variable-popup"
          sx={{
            position: 'fixed',
            left: `${popupPosition.x}px`,
            top: `${popupPosition.y}px`,
            zIndex: 9999,
            backgroundColor: 'white',
            borderRadius: 1,
            boxShadow: 3,
            p: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            pointerEvents: 'auto',
            minWidth: '200px',
            border: '1px solid #e0e0e0'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">Police:</Typography>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={selectedTemplate?.variables.find(v => v.id === selectedPlacedVariable)?.fontFamily || 'Arial'}
                onChange={(e) => {
                  if (!selectedTemplate) return;
                  const updatedVariables = selectedTemplate.variables.map(v =>
                    v.id === selectedPlacedVariable
                      ? { ...v, fontFamily: e.target.value }
                      : v
                  );
                  setSelectedTemplate({
                    ...selectedTemplate,
                    variables: updatedVariables
                  });
                  setHasUnsavedChanges(true);
                }}
                size="small"
                onClick={(e) => e.stopPropagation()}
              >
                {FONT_FAMILIES.map(font => (
                  <MenuItem key={font.value} value={font.value} sx={{ fontFamily: font.value }}>
                    {font.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">Taille:</Typography>
            <FormControl size="small" sx={{ minWidth: 80 }}>
              <Select
                value={selectedTemplate?.variables.find(v => v.id === selectedPlacedVariable)?.fontSize || 12}
                onChange={(e) => {
                  if (!selectedTemplate) return;
                  const updatedVariables = selectedTemplate.variables.map(v =>
                    v.id === selectedPlacedVariable
                      ? { ...v, fontSize: Number(e.target.value) }
                      : v
                  );
                  setSelectedTemplate({
                    ...selectedTemplate,
                    variables: updatedVariables
                  });
                  setHasUnsavedChanges(true);
                }}
                size="small"
                onClick={(e) => e.stopPropagation()}
              >
                {FONT_SIZES.map(size => (
                  <MenuItem key={size} value={size}>
                    {size}pt
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {selectedPlacedVariable && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="body2">Gras:</Typography>
              <Switch
                size="small"
                checked={selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.isBold || false}
                onChange={(e) => {
                  const updatedVariables = selectedTemplate.variables.map(v =>
                    v.id === selectedPlacedVariable
                      ? { ...v, isBold: e.target.checked }
                      : v
                  );
                  setSelectedTemplate({
                    ...selectedTemplate,
                    variables: updatedVariables
                  });
                  setHasUnsavedChanges(true);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </Box>
          )}
        </Box>
      )}

      {/* Conteneur principal */}
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 150px)' }}>
        {/* Section des contrôles et variables */}
        {selectedTemplate && (
          <Box sx={{ mb: 2 }}>
            <Grid container spacing={2}>
              {/* Variables disponibles et propriétés */}
              <Grid item xs={12}>
                <Grid container spacing={2}>
                  {/* Variables disponibles */}
                  <Grid item xs={12}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          Variables disponibles
                          <Tooltip 
                            title={
                              <Box sx={{ p: 1 }}>
                                <Typography variant="subtitle2" gutterBottom>Description des variables :</Typography>
                                {databaseFields[selectedDatabase].map(variable => (
                                  <Box key={variable.id} sx={{ mb: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{variable.name} :</Typography>
                                    <Typography variant="body2">{variable.description}</Typography>
                                  </Box>
                                ))}
                              </Box>
                            }
                            arrow
                            placement="right"
                          >
                            <IconButton size="small" sx={{ ml: 1 }}>
                              <InfoIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Typography>
                        
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          {/* Colonne de gauche - Variables disponibles */}
                          <Box sx={{ flex: 1 }}>
                            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                              <InputLabel>Source des données</InputLabel>
                              <Select
                                value={selectedDatabase}
                                onChange={(e) => setSelectedDatabase(e.target.value as 'missions' | 'users' | 'companies' | 'contacts' | 'expenseNotes' | 'workingHours' | 'amendments' | 'structures')}
                                label="Source des données"
                              >
                                <MenuItem value="missions">Missions</MenuItem>
                                <MenuItem value="users">Utilisateurs</MenuItem>
                                <MenuItem value="companies">Entreprises</MenuItem>
                                <MenuItem value="contacts">Contacts</MenuItem>
                                <MenuItem value="expenseNotes">Notes de frais</MenuItem>
                                <MenuItem value="workingHours">Heures de travail</MenuItem>
                                <MenuItem value="amendments">Avenants</MenuItem>
                                <MenuItem value="structures">Structure</MenuItem>
                              </Select>
                            </FormControl>

                            <Box sx={{ maxHeight: '150px', overflowY: 'auto' }}>
                              {databaseFields[selectedDatabase].map(variable => (
                                <Tooltip 
                                  key={variable.id} 
                                  title={`${variable.description} - Type: ${variable.type}`}
                                  arrow
                                >
                                  <Chip
                                    label={variable.name}
                                    onClick={() => setSelectedVariableId(selectedVariableId === variable.id ? null : variable.id)}
                                    color={selectedVariableId === variable.id ? "primary" : "default"}
                                    sx={{ 
                                      m: 0.5, 
                                      cursor: 'pointer',
                                      fontSize: currentFontSize + 'px',
                                      height: 'auto',
                                      py: 0.5
                                    }}
                                  />
                                </Tooltip>
                              ))}
                            </Box>
                          </Box>

                          {/* Colonne de droite - Zone de texte */}
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              Texte à ajouter
                              <Tooltip 
                                title={
                                  <Box sx={{ 
                                    p: 1, 
                                    maxWidth: 400,
                                    maxHeight: '80vh',
                                    overflowY: 'auto',
                                    '&::-webkit-scrollbar': {
                                      width: '8px',
                                    },
                                    '&::-webkit-scrollbar-track': {
                                      background: '#f1f1f1',
                                      borderRadius: '4px',
                                    },
                                    '&::-webkit-scrollbar-thumb': {
                                      background: '#888',
                                      borderRadius: '4px',
                                      '&:hover': {
                                        background: '#555',
                                      },
                                    },
                                  }}>
                                    <Typography variant="subtitle2" gutterBottom>
                                      Comment inclure des variables dans le texte :
                                    </Typography>
                                    <Typography variant="body2" paragraph>
                                      Utilisez les balises suivantes dans votre texte :
                                    </Typography>

                                    {/* Balises pour les missions */}
                                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, color: 'primary.main' }}>
                                      Balises pour les missions :
                                    </Typography>
                                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                                      <Typography component="li" variant="body2">
                                        &lt;mission_numero&gt; - Numéro de mission
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;mission_cdm&gt; - Chef de mission
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;mission_date&gt; - Date de mission
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;mission_lieu&gt; - Lieu
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;mission_entreprise&gt; - Entreprise
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;mission_prix&gt; - Prix HT
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;mission_description&gt; - Description
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;mission_titre&gt; - Titre
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;mission_heures&gt; - Nombre d'heures
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;mission_statut&gt; - Statut
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;mission_heures_par_etudiant&gt; - Heures par étudiant
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;mission_nb_etudiants&gt; - Nombre d'étudiants
                                      </Typography>
                                    </Box>

                                    {/* Balises pour les utilisateurs */}
                                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, color: 'primary.main' }}>
                                      Balises pour les utilisateurs :
                                    </Typography>
                                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                                      <Typography component="li" variant="body2">
                                        &lt;user_nom&gt; - Nom utilisateur
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;user_prenom&gt; - Prénom utilisateur
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;user_email&gt; - Email
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;user_ecole&gt; - École
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;user_telephone&gt; - Téléphone
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;user_adresse&gt; - Adresse
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;user_ville&gt; - Ville
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;user_formation&gt; - Formation
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;user_programme&gt; - Programme
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;user_annee_diplome&gt; - Année de diplômation
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;user_nationalite&gt; - Nationalité
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;user_genre&gt; - Genre
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;user_lieu_naissance&gt; - Lieu de naissance
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;user_date_naissance&gt; - Date de naissance
                                      </Typography>
                                    </Box>

                                    {/* Balises pour les entreprises */}
                                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, color: 'primary.main' }}>
                                      Balises pour les entreprises :
                                    </Typography>
                                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                                      <Typography component="li" variant="body2">
                                        &lt;entreprise_nom&gt; - Nom de l'entreprise
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;entreprise_siren&gt; - Numéro SIREN
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;entreprise_adresse&gt; - Adresse
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;entreprise_ville&gt; - Ville
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;entreprise_pays&gt; - Pays
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;entreprise_telephone&gt; - Téléphone
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;entreprise_email&gt; - Email
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;entreprise_site_web&gt; - Site web
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;entreprise_description&gt; - Description
                                      </Typography>
                                    </Box>

                                    {/* Balises pour les notes de frais */}
                                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, color: 'primary.main' }}>
                                      Balises pour les notes de frais :
                                    </Typography>
                                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                                      <Typography component="li" variant="body2">
                                        &lt;note_frais_montant&gt; - Montant
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;note_frais_description&gt; - Description
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;note_frais_date&gt; - Date
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;note_frais_statut&gt; - Statut
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;note_frais_creation&gt; - Date de création
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;note_frais_maj&gt; - Date de mise à jour
                                      </Typography>
                                    </Box>

                                    {/* Balises pour les heures de travail */}
                                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, color: 'primary.main' }}>
                                      Balises pour les heures de travail :
                                    </Typography>
                                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                                      <Typography component="li" variant="body2">
                                        &lt;workingHoursDateDebut&gt; - Date de début des heures travaillées
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;workingHoursHeureDebut&gt; - Heure de début
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;workingHoursDateFin&gt; - Date de fin des heures travaillées
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;workingHoursHeureFin&gt; - Heure de fin
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;workingHoursPauses&gt; - Liste des pauses
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;workingHoursTotal&gt; - Total des heures travaillées
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;workingHoursCreation&gt; - Date de création
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;workingHoursMaj&gt; - Date de mise à jour
                                      </Typography>
                                    </Box>

                                    {/* Balises pour les avenants */}
                                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, color: 'primary.main' }}>
                                      Balises pour les avenants :
                                    </Typography>
                                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                                      <Typography component="li" variant="body2">
                                        &lt;amendment_planned_start_date&gt; - Date de début prévue
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;amendment_planned_end_date&gt; - Date de fin prévue
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;amendment_actual_start_date&gt; - Date de début réelle
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;amendment_actual_end_date&gt; - Date de fin réelle
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;amendment_planned_hours&gt; - Heures prévues
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;amendment_actual_hours&gt; - Heures réelles
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;amendment_reason&gt; - Motif
                                      </Typography>
                                    </Box>

                                    {/* Balises pour les contacts */}
                                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, color: 'primary.main' }}>
                                      Balises pour les contacts :
                                    </Typography>
                                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                                      <Typography component="li" variant="body2">
                                        &lt;contact_nom&gt; - Nom du contact
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;contact_prenom&gt; - Prénom du contact
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;contact_email&gt; - Email du contact
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;contact_telephone&gt; - Téléphone du contact
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;contact_poste&gt; - Poste du contact
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;contact_linkedin&gt; - LinkedIn du contact
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;contact_nom_complet&gt; - Nom complet du contact
                                      </Typography>
                                    </Box>

                                    {/* Balises pour les structures */}
                                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, color: 'primary.main' }}>
                                      Balises pour les structures :
                                    </Typography>
                                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                                      <Typography component="li" variant="body2">
                                        &lt;structure_nom&gt; - Nom de la structure
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;structure_siret&gt; - SIRET de la structure
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;structure_tvaNumber&gt; - N° de TVA intracommunautaire
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;structure_apeCode&gt; - Code APE
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;structure_ecole&gt; - École de la structure
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;structure_id&gt; - Identifiant de la structure
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;structure_creation&gt; - Date de création de la structure
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;structure_maj&gt; - Date de mise à jour de la structure
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;structure_address&gt; - Adresse de la structure
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;structure_phone&gt; - N° de téléphone de la structure
                                      </Typography>
                                      <Typography component="li" variant="body2">
                                        &lt;structure_email&gt; - Email de la structure
                                      </Typography>
                                    </Box>

                                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                                      Exemple :
                                    </Typography>
                                    <Typography variant="body2" sx={{ 
                                      p: 1, 
                                      bgcolor: 'rgba(0,0,0,0.04)', 
                                      borderRadius: 1,
                                      fontFamily: 'monospace'
                                    }}>
                                      Mission &lt;mission_numero&gt; du &lt;mission_date&gt; à &lt;mission_lieu&gt;
                                    </Typography>
                                    <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                                      Résultat : Mission M2024-001 du 01/01/2024 à Paris
                                    </Typography>
                                  </Box>
                                }
                                arrow
                                placement="right"
                              >
                                <span>
                                  <IconButton size="small">
                                    <InfoIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              </Typography>
                            
                            <TextField
                              id="raw-text-input"
                              fullWidth
                              size="small"
                              multiline
                              rows={4}
                              placeholder="Saisissez votre texte ici"
                              value={rawText}
                              onChange={(e) => setRawText(e.target.value)}
                              sx={{ mb: 1 }}
                            />

                            <Button
                              variant="contained"
                              fullWidth
                              startIcon={isAddingRawText ? <CheckIcon /> : <AddIcon />}
                              onClick={() => {
                                setIsAddingRawText(!isAddingRawText);
                                setSelectedVariableId(null);
                              }}
                              disabled={!rawText.trim()}
                              color={isAddingRawText ? "success" : "primary"}
                            >
                              {isAddingRawText ? "Cliquez sur le PDF pour placer le texte" : "Ajouter le texte"}
                            </Button>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Zone centrale avec le PDF */}
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {selectedTemplate ? (
            <Card sx={{ display: 'flex', flexDirection: 'column' }}>
              {/* Barre d'outils des propriététés */}
              {selectedPlacedVariable && (
                <Box sx={{ 
                  p: 1, 
                  borderBottom: 1, 
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  flexWrap: 'wrap'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">Position X:</Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={Math.round(selectedTemplate.variables.find(
                        v => v.id === selectedPlacedVariable
                      )?.position.x || 0)}
                      onChange={(e) => {
                        const newX = Number(e.target.value);
                        const updatedVariables = selectedTemplate.variables.map(v =>
                          v.id === selectedPlacedVariable
                            ? { ...v, position: { ...v.position, x: newX } }
                            : v
                        );
                        setSelectedTemplate({
                          ...selectedTemplate,
                          variables: updatedVariables
                        });
                        setHasUnsavedChanges(true);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      InputProps={{
                        endAdornment: <Typography variant="caption">px</Typography>
                      }}
                      sx={{ width: 80 }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">Y:</Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={Math.round(selectedTemplate.variables.find(
                        v => v.id === selectedPlacedVariable
                      )?.position.y || 0)}
                      onChange={(e) => {
                        const newY = Number(e.target.value);
                        const updatedVariables = selectedTemplate.variables.map(v =>
                          v.id === selectedPlacedVariable
                            ? { ...v, position: { ...v.position, y: newY } }
                            : v
                        );
                        setSelectedTemplate({
                          ...selectedTemplate,
                          variables: updatedVariables
                        });
                        setHasUnsavedChanges(true);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      InputProps={{
                        endAdornment: <Typography variant="caption">px</Typography>
                      }}
                      sx={{ width: 80 }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">Largeur:</Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={Math.round(selectedTemplate.variables.find(
                        v => v.id === selectedPlacedVariable
                      )?.width || 100)}
                      onChange={(e) => {
                        const newWidth = Number(e.target.value);
                        const updatedVariables = selectedTemplate.variables.map(v =>
                          v.id === selectedPlacedVariable
                            ? { ...v, width: newWidth }
                            : v
                        );
                        setSelectedTemplate({
                          ...selectedTemplate,
                          variables: updatedVariables
                        });
                        setHasUnsavedChanges(true);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      InputProps={{
                        endAdornment: <Typography variant="caption">px</Typography>
                      }}
                      sx={{ width: 80 }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">Hauteur:</Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={Math.round(selectedTemplate.variables.find(
                        v => v.id === selectedPlacedVariable
                      )?.height || 30)}
                      onChange={(e) => {
                        const newHeight = Number(e.target.value);
                        const updatedVariables = selectedTemplate.variables.map(v =>
                          v.id === selectedPlacedVariable
                            ? { ...v, height: newHeight }
                            : v
                        );
                        setSelectedTemplate({
                          ...selectedTemplate,
                          variables: updatedVariables
                        });
                        setHasUnsavedChanges(true);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      InputProps={{
                        endAdornment: <Typography variant="caption">px</Typography>
                      }}
                      sx={{ width: 80 }}
                    />
                  </Box>

                  <Divider orientation="vertical" flexItem />

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">Alignement:</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const updatedVariables = selectedTemplate.variables.map(v =>
                            v.id === selectedPlacedVariable
                              ? { ...v, textAlign: 'left' as const }
                              : v
                          );
                          setSelectedTemplate({
                            ...selectedTemplate,
                            variables: updatedVariables
                          });
                          setHasUnsavedChanges(true);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        color={selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.textAlign === 'left' ? 'primary' : 'default'}
                      >
                        <FormatAlignLeftIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const updatedVariables = selectedTemplate.variables.map(v =>
                            v.id === selectedPlacedVariable
                              ? { ...v, textAlign: 'center' as const }
                              : v
                          );
                          setSelectedTemplate({
                            ...selectedTemplate,
                            variables: updatedVariables
                          });
                          setHasUnsavedChanges(true);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        color={selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.textAlign === 'center' ? 'primary' : 'default'}
                      >
                        <FormatAlignCenterIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const updatedVariables = selectedTemplate.variables.map(v =>
                            v.id === selectedPlacedVariable
                              ? { ...v, textAlign: 'right' as const }
                              : v
                          );
                          setSelectedTemplate({
                            ...selectedTemplate,
                            variables: updatedVariables
                          });
                          setHasUnsavedChanges(true);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        color={selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.textAlign === 'right' ? 'primary' : 'default'}
                      >
                        <FormatAlignRightIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const updatedVariables = selectedTemplate.variables.map(v =>
                            v.id === selectedPlacedVariable
                              ? { ...v, textAlign: 'justify' as const }
                              : v
                          );
                          setSelectedTemplate({
                            ...selectedTemplate,
                            variables: updatedVariables
                          });
                          setHasUnsavedChanges(true);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        color={selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.textAlign === 'justify' ? 'primary' : 'default'}
                      >
                        <FormatAlignJustifyIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  <Divider orientation="vertical" flexItem />

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">Vertical:</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const updatedVariables = selectedTemplate.variables.map(v => 
                            v.id === selectedPlacedVariable 
                              ? { ...v, verticalAlign: 'top' as const }
                              : v
                          );
                          setSelectedTemplate({ ...selectedTemplate, variables: updatedVariables });
                          setHasUnsavedChanges(true);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        color={selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.verticalAlign === 'top' ? 'primary' : 'default'}
                      >
                        <VerticalAlignTopIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const updatedVariables = selectedTemplate.variables.map(v => 
                            v.id === selectedPlacedVariable 
                              ? { ...v, verticalAlign: 'middle' as const }
                              : v
                          );
                          setSelectedTemplate({ ...selectedTemplate, variables: updatedVariables });
                          setHasUnsavedChanges(true);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        color={selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.verticalAlign === 'middle' ? 'primary' : 'default'}
                      >
                        <VerticalAlignCenterIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const updatedVariables = selectedTemplate.variables.map(v => 
                            v.id === selectedPlacedVariable 
                              ? { ...v, verticalAlign: 'bottom' as const }
                              : v
                          );
                          setSelectedTemplate({ ...selectedTemplate, variables: updatedVariables });
                          setHasUnsavedChanges(true);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        color={selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.verticalAlign === 'bottom' ? 'primary' : 'default'}
                      >
                        <VerticalAlignBottomIcon fontSize="small" />
                      </IconButton>

                      {/* Ajout du contrôle d'espacement des lignes */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                          Espacement:
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(0, 0, 0, 0.23)', borderRadius: 1 }}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              const currentValue = selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.lineHeight || 1.2;
                              const newValue = Math.max(0.5, currentValue - 0.1);
                              const updatedVariables = selectedTemplate.variables.map(v => 
                                v.id === selectedPlacedVariable 
                                  ? { ...v, lineHeight: Number(newValue.toFixed(1)) }
                                  : v
                              );
                              setSelectedTemplate({ ...selectedTemplate, variables: updatedVariables });
                              setHasUnsavedChanges(true);
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            sx={{ p: 0.5 }}
                          >
                            <RemoveIcon fontSize="small" />
                          </IconButton>
                          <Typography
                            sx={{
                              px: 1,
                              minWidth: '40px',
                              textAlign: 'center',
                              userSelect: 'none'
                            }}
                          >
                            {(selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.lineHeight || 1.2).toFixed(1)}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              const currentValue = selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.lineHeight || 1.2;
                              const newValue = Math.min(3, currentValue + 0.1);
                              const updatedVariables = selectedTemplate.variables.map(v => 
                                v.id === selectedPlacedVariable 
                                  ? { ...v, lineHeight: Number(newValue.toFixed(1)) }
                                  : v
                              );
                              setSelectedTemplate({ ...selectedTemplate, variables: updatedVariables });
                              setHasUnsavedChanges(true);
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            sx={{ p: 0.5 }}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    </Box>
                  </Box>

                  <Box sx={{ flexGrow: 1 }} />

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      startIcon={<SaveIcon />}
                      variant="contained"
                      onClick={handleSaveVariables}
                      disabled={!hasUnsavedChanges}
                    >
                      Enregistrer
                    </Button>
                  </Box>
                </Box>
              )}

              <CardContent sx={{ display: 'flex', flexDirection: 'column', p: 2 }}>
                {/* Contrôle de zoom et variables sélectionnées */}
                <Box sx={{ 
                  mb: 2, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  gap: 2,
                  width: '100%'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2">Zoom:</Typography>
                    <Slider
                      value={zoom}
                      onChange={(_, newValue) => setZoom(newValue as number)}
                      min={0.5}
                      max={2}
                      step={0.1}
                      marks={[
                        { value: 0.5, label: '50%' },
                        { value: 1, label: '100%' },
                        { value: 2, label: '200%' }
                      ]}
                      sx={{ width: 200 }}
                    />
                    <Typography variant="body2">{Math.round(zoom * 100)}%</Typography>
                  </Box>

                  {/* Variables sélectionnées */}
                  <Box sx={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: 1,
                    maxWidth: '50%',
                    justifyContent: 'flex-end'
                  }}>
                    {selectedTemplate.variables.map(variable => (
                      <Chip
                        key={variable.id}
                        label={variable.name}
                        onClick={() => setSelectedPlacedVariable(variable.id)}
                        color={selectedPlacedVariable === variable.id ? "primary" : "default"}
                        onDelete={() => handleDeleteVariable(variable.id)}
                        size="small"
                      />
                    ))}
                  </Box>
                </Box>

                <Box sx={{ 
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  backgroundColor: '#f5f5f7',
                  borderRadius: 1,
                  overflow: 'auto',
                  p: 2,
                  pb: 8,
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none',
                  minHeight: `${842 * zoom + 32}px`, // Hauteur du PDF + padding
                  width: '100%'
                }}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      position: 'relative',
                      display: 'inline-block',
                      backgroundColor: 'transparent',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
                      '& .react-pdf__Document': {
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        MozUserSelect: 'none',
                        msUserSelect: 'none'
                      },
                      '& .react-pdf__Page': {
                        width: '100% !important',
                        height: '100% !important',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        MozUserSelect: 'none',
                        msUserSelect: 'none'
                      }
                    }}
                    ref={pdfContainerRef}
                    onClick={handlePdfClick}
                    onMouseMove={(e) => {
                      if (resizingVariable) {
                        handleResizeMove(e);
                      } else {
                        handleVariableMouseMove(e);
                      }
                    }}
                    onMouseUp={() => {
                      if (resizingVariable) {
                        handleResizeEnd();
                      } else {
                        handleVariableMouseUp();
                      }
                    }}
                    onMouseLeave={() => {
                      if (resizingVariable) {
                        handleResizeEnd();
                      } else {
                        handleVariableMouseUp();
                      }
                    }}
                  >
                    <Box
                      sx={{
                        position: 'relative',
                        display: 'inline-block',
                        width: `${595 * zoom}px`,
                        height: `${842 * zoom}px`,
                        maxWidth: '100%',
                        maxHeight: '100%',
                        overflow: 'hidden'
                      }}
                    >
                      {renderPDF()}
                    </Box>
                  </Paper>
                </Box>
                
                {numPages && numPages > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Button 
                      disabled={pageNumber <= 1} 
                      onClick={() => setPageNumber(pageNumber - 1)}
                    >
                      Précédent
                    </Button>
                    <Typography sx={{ mx: 2, display: 'flex', alignItems: 'center' }}>
                      Page {pageNumber} sur {numPages}
                    </Typography>
                    <Button 
                      disabled={pageNumber >= numPages} 
                      onClick={() => setPageNumber(pageNumber + 1)}
                    >
                      Suivant
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Aucun template sélectionné
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Sélectionnez un template existant ou créez-en un nouveau
                </Typography>
              </CardContent>
            </Card>
          )}
        </Box>
      </Box>

      {/* Garder les dialogues existants */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Ajouter un nouveau template</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nom du template"
            fullWidth
            variant="outlined"
            value={newTemplate.name}
            onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={newTemplate.description}
            onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <Button
            variant="outlined"
            component="label"
            startIcon={<UploadIcon />}
            fullWidth
          >
            {newTemplate.file ? newTemplate.file.name : 'Importer un PDF'}
            <input
              type="file"
              hidden
              accept=".pdf"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Annuler</Button>
          <Button 
            onClick={handleSaveTemplate} 
            variant="contained"
            disabled={!newTemplate.name || !newTemplate.file}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
      
      <Dialog open={openFontSizeDialog} onClose={handleCloseFontSizeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Modifier la taille de police</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography gutterBottom>
              Taille: {currentFontSize}pt
            </Typography>
            <Slider
              value={currentFontSize}
              min={5}
              max={32}
              step={1}
              marks={[
                { value: 5, label: '5pt' },
                { value: 10, label: '10pt' },
                { value: 16, label: '16pt' },
                { value: 24, label: '24pt' },
                { value: 32, label: '32pt' }
              ]}
              onChange={(_, newValue) => setCurrentFontSize(newValue as number)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFontSizeDialog}>Annuler</Button>
          <Button onClick={handleSaveFontSize} variant="contained">
            Appliquer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteConfirmationOpen}
        onClose={handleCancelDelete}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          Confirmer la suppression
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Êtes-vous sûr de vouloir supprimer ce template ? Cette action est irréversible.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} color="primary">
            Annuler
          </Button>
          <Button onClick={handleConfirmDelete} color="error" autoFocus>
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog open={lineHeightDialogOpen} onClose={handleCloseLineHeightDialog}>
        <DialogTitle>Modifier l'espacement des lignes</DialogTitle>
        <DialogContent>
          <TextField
            type="number"
            label="Espacement des lignes"
            value={selectedLineHeight}
            onChange={(e) => setSelectedLineHeight(parseFloat(e.target.value))}
            inputProps={{ step: 0.1, min: 0.5, max: 3 }}
            fullWidth
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseLineHeightDialog}>Annuler</Button>
          <Button onClick={handleSaveLineHeight} color="primary">
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {selectedPlacedVariable && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem onClick={() => handleOpenFontSizeDialog(selectedPlacedVariable)}>
            Modifier la taille de police
          </MenuItem>
          <MenuItem onClick={() => handleOpenLineHeightDialog(selectedPlacedVariable)}>
            Modifier l'espacement des lignes
          </MenuItem>
          <MenuItem onClick={() => handleDeleteVariable(selectedPlacedVariable)}>
            Supprimer
          </MenuItem>
        </Menu>
      )}
    </Box>
  );
};

export default TemplatesPDF; 