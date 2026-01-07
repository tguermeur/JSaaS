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
  AppBar,
  Toolbar,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
// Ajout de l'import ContentCopyIcon pour les balises si pas déjà présent (il l'est déjà pour le header)
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
  Remove as RemoveIcon,
  ContentCopy as ContentCopyIcon,
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
  Code as CodeIcon, // Nouvel icône pour les balises
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import { useMission } from '../contexts/MissionContext';
import { getFileURL } from '../firebase/storage';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import pdfjs from '../utils/pdfWorker';
import { PDFDocument, rgb } from 'pdf-lib';

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
  fileName?: string;
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
  { tag: '<mission_date_debut>', variableId: 'missionDateDebut', description: 'Date de début (date seule)', example: '01/01/2024' },
  { tag: '<mission_date_heure_debut>', variableId: 'missionDateHeureDebut', description: 'Date et heure de début', example: '01/01/2024 à 09:00' },
  { tag: '<mission_date_fin>', variableId: 'missionDateFin', description: 'Date de fin (date seule)', example: '31/01/2024' },
  { tag: '<mission_date_heure_fin>', variableId: 'missionDateHeureFin', description: 'Date et heure de fin', example: '31/01/2024 à 17:00' },
  { tag: '<mission_lieu>', variableId: 'location', description: 'Lieu de la mission', example: 'Paris' },
  { tag: '<mission_entreprise>', variableId: 'company', description: 'Nom de l\'entreprise', example: 'Entreprise SA' },
  { tag: '<mission_type>', variableId: 'missionType', description: 'Type de mission', example: 'Consulting' },
  { tag: '<mission_date_generation>', variableId: 'generationDate', description: 'Date de génération du document', example: '01/01/2024' },
  { tag: '<mission_date_generation_plus_1_an>', variableId: 'generationDatePlusOneYear', description: 'Date de génération + 1 an (365 jours)', example: '01/01/2025' },
  { tag: '<mission_prix>', variableId: 'priceHT', description: 'Prix HT', example: '1000€' },
  { tag: '<mission_prix_horaire_ht>', variableId: 'priceHT', description: 'Prix horaire HT', example: '25.00' },
  { tag: '<mission_prix_total_heures_ht>', variableId: 'totalHoursHT', description: 'Prix total des heures travaillées HT (prix horaire × nombre d\'heures)', example: '1000.00' },
  { tag: '<mission_description>', variableId: 'missionDescription', description: 'Description de la mission', example: 'Description détaillée...' },
  { tag: '<mission_titre>', variableId: 'title', description: 'Titre', example: 'Titre de la mission' },
  { tag: '<mission_heures>', variableId: 'hours', description: 'Nombre d\'heures', example: '40' },
  { tag: '<mission_nb_etudiants>', variableId: 'studentCount', description: 'Nombre d\'étudiants', example: '4' },
  
  // Tags pour les dépenses (jusqu'à 4 dépenses)
  { tag: '<depense1_nom>', variableId: 'nomdepense1', description: 'Nom de la dépense 1', example: 'Frais de déplacement' },
  { tag: '<depense1_tva>', variableId: 'tvadepense1', description: 'TVA de la dépense 1 (%)', example: '20' },
  { tag: '<depense1_prix>', variableId: 'totaldepense1', description: 'Prix HT de la dépense 1', example: '150.00' },
  { tag: '<depense2_nom>', variableId: 'nomdepense2', description: 'Nom de la dépense 2', example: 'Matériel' },
  { tag: '<depense2_tva>', variableId: 'tvadepense2', description: 'TVA de la dépense 2 (%)', example: '20' },
  { tag: '<depense2_prix>', variableId: 'totaldepense2', description: 'Prix HT de la dépense 2', example: '200.00' },
  { tag: '<depense3_nom>', variableId: 'nomdepense3', description: 'Nom de la dépense 3', example: 'Formation' },
  { tag: '<depense3_tva>', variableId: 'tvadepense3', description: 'TVA de la dépense 3 (%)', example: '10' },
  { tag: '<depense3_prix>', variableId: 'totaldepense3', description: 'Prix HT de la dépense 3', example: '300.00' },
  { tag: '<depense4_nom>', variableId: 'nomdepense4', description: 'Nom de la dépense 4', example: 'Autre frais' },
  { tag: '<depense4_tva>', variableId: 'tvadepense4', description: 'TVA de la dépense 4 (%)', example: '20' },
  { tag: '<depense4_prix>', variableId: 'totaldepense4', description: 'Prix HT de la dépense 4', example: '100.00' },
  
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
  { tag: '<user_numero_etudiant>', variableId: 'studentId', description: 'Numéro étudiant', example: '183934' },
  
  // Tags pour les entreprises
  { tag: '<entreprise_nom>', variableId: 'name', description: 'Nom de l\'entreprise', example: 'Entreprise SA' },
  { tag: '<entreprise_siren>', variableId: 'siren', description: 'Numéro SIREN', example: '123456789' },
  { tag: '<entreprise_nsiret>', variableId: 'nSiret', description: 'Numéro nSiret', example: '12345678901234' },
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
  { tag: '<structure_president_nom_complet>', variableId: 'structure_president_fullName', description: 'Prénom et Nom du président du mandat le plus récent', example: 'Jean Dupont' }
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

  // Si c'est la date de génération + 1 an, retourner la date actuelle + 365 jours
  if (variableId === 'generationDatePlusOneYear') {
    const today = new Date();
    const oneYearLater = new Date(today);
    oneYearLater.setDate(today.getDate() + 365);
    return oneYearLater.toLocaleDateString('fr-FR');
  }

  // Si c'est le type de mission, utiliser directement la valeur de la mission
  if (variableId === 'missionType') {
    return missionData?.missionType || '';
  }

  // Si c'est le prix total des heures travaillées HT, calculer priceHT * hours
  if (variableId === 'totalHoursHT') {
    if (missionData?.priceHT && missionData?.hours) {
      const total = missionData.priceHT * missionData.hours;
      return total.toFixed(2);
    }
    return '0.00';
  }

  // Gestion des dates de début et fin avec formatage spécifique
  if (variableId === 'missionDateDebut') {
    // Date seule de début
    if (missionData?.startDate) {
      const date = new Date(missionData.startDate);
      return date.toLocaleDateString('fr-FR');
    }
    return '';
  }

  if (variableId === 'missionDateHeureDebut') {
    // Date et heure de début au format jj/mm/aaaa à hh:mm
    if (missionData?.startDate) {
      const date = new Date(missionData.startDate);
      const dateStr = date.toLocaleDateString('fr-FR');
      const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      return `${dateStr} à ${timeStr}`;
    }
    return '';
  }

  if (variableId === 'missionDateFin') {
    // Date seule de fin
    if (missionData?.endDate) {
      const date = new Date(missionData.endDate);
      return date.toLocaleDateString('fr-FR');
    }
    return '';
  }

  if (variableId === 'missionDateHeureFin') {
    // Date et heure de fin au format jj/mm/aaaa à hh:mm
    if (missionData?.endDate) {
      const date = new Date(missionData.endDate);
      const dateStr = date.toLocaleDateString('fr-FR');
      const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      return `${dateStr} à ${timeStr}`;
    }
    return '';
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

// Fonction pour remplacer les balises par leurs exemples (pour l'aperçu)
const replaceTagsWithExamples = (text: string): string => {
  if (!text) return '';
  try {
    let result = text;
    VARIABLE_TAGS.forEach(({ tag, example }) => {
      result = result.replace(new RegExp(escapeRegExp(tag), 'g'), example || '');
    });
    return result;
  } catch (error) {
    console.error('Erreur lors du remplacement des balises par les exemples:', error);
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
      
      const templatesList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // S'assurer que le champ file est rempli avec pdfUrl si nécessaire
          file: data.file || (data.pdfUrl ? {
            url: data.pdfUrl,
            name: data.fileName || 'template.pdf',
            type: 'application/pdf'
          } : null)
        } as Template;
      });
      
      setTemplates(templatesList);
      
      // Si un template est sélectionné, mettre à jour son URL si nécessaire
      if (selectedTemplate) {
        const updatedSelected = templatesList.find(t => t.id === selectedTemplate.id);
        if (updatedSelected) {
          setSelectedTemplate(updatedSelected);
        }
      }
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
        id: 'nSiret',
        name: 'nSiret',
        description: 'Numéro nSiret de l\'entreprise',
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
  const replacePdfInputRef = useRef<HTMLInputElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [replacePdfDialogOpen, setReplacePdfDialogOpen] = useState(false);
  const [replacementPdfFile, setReplacementPdfFile] = useState<File | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateTemplateName, setDuplicateTemplateName] = useState<string>('');
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false); // État pour le dialogue des balises
  const [renameDialogOpen, setRenameDialogOpen] = useState(false); // État pour le dialogue de renommage
  const [newTemplateName, setNewTemplateName] = useState<string>(''); // État pour le nouveau nom
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false); // État pour le dialogue d'aperçu
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // URL du PDF généré pour l'aperçu
  const [generatingPreview, setGeneratingPreview] = useState(false); // État pour la génération de l'aperçu
  
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

  const handleReplacePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReplacementPdfFile(e.target.files[0]);
    }
  };

  const handleReplacePdf = async () => {
    if (!selectedTemplate || !replacementPdfFile || !currentUser) {
      setSnackbar({
        open: true,
        message: 'Veuillez sélectionner un fichier PDF',
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
      const fileName = `${Date.now()}_${replacementPdfFile.name.replace(/\s+/g, '_')}`;
      const storageRef = ref(storage, `templates/${fileName}`);

      // Upload du nouveau fichier
      await uploadBytes(storageRef, replacementPdfFile);
      const newPdfUrl = await getDownloadURL(storageRef);

      // Supprimer l'ancien fichier du storage si possible (optionnel, pour économiser l'espace)
      // Note: On garde l'ancien fichier pour l'historique, mais on peut le supprimer si nécessaire
      try {
        if (selectedTemplate.pdfUrl && selectedTemplate.fileName) {
          // Utiliser le fileName stocké dans le template pour supprimer l'ancien fichier
          const oldStorageRef = ref(storage, `templates/${selectedTemplate.fileName}`);
          await deleteObject(oldStorageRef).catch(error => {
            console.warn('Impossible de supprimer l\'ancien fichier (peut ne plus exister):', error);
          });
        }
      } catch (deleteError) {
        console.warn('Erreur lors de la tentative de suppression de l\'ancien fichier:', deleteError);
        // Ne pas bloquer si la suppression échoue - le fichier pourrait ne plus exister ou être utilisé ailleurs
      }

      // Mettre à jour le document dans Firestore avec le nouveau PDF
      const templateRef = doc(db, 'templates', selectedTemplate.id);
      await updateDoc(templateRef, {
        pdfUrl: newPdfUrl,
        fileName: fileName,
        updatedAt: serverTimestamp()
      });

      // Mettre à jour l'état local
      const updatedTemplate = {
        ...selectedTemplate,
        pdfUrl: newPdfUrl,
        fileName: fileName,
        file: {
          url: newPdfUrl, // Utiliser l'URL Firebase au lieu de createObjectURL pour la persistance
          name: replacementPdfFile.name,
          type: replacementPdfFile.type
        }
      };

      setTemplates(prev => prev.map(template =>
        template.id === selectedTemplate.id ? updatedTemplate : template
      ));
      setSelectedTemplate(updatedTemplate);

      // Réinitialiser le formulaire
      setReplacementPdfFile(null);
      setReplacePdfDialogOpen(false);

      // Réinitialiser le nombre de pages et le document PDF pour forcer le rechargement
      setNumPages(0);
      setPdfDocument(null);
      setPageNumber(1);

      setSnackbar({
        open: true,
        message: 'PDF remplacé avec succès. Les balises existantes sont conservées.',
        severity: 'success'
      });

    } catch (error) {
      console.error('Erreur lors du remplacement du PDF:', error);
      setSnackbar({
        open: true,
        message: `Erreur lors du remplacement du PDF: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReplacePdfDialog = () => {
    setReplacePdfDialogOpen(true);
    setReplacementPdfFile(null);
  };

  const handleCloseReplacePdfDialog = () => {
    setReplacePdfDialogOpen(false);
    setReplacementPdfFile(null);
  };

  const handleOpenDuplicateDialog = () => {
    if (selectedTemplate) {
      setDuplicateTemplateName(`${selectedTemplate.name} (copie)`);
      setDuplicateDialogOpen(true);
    }
  };

  const handleCloseDuplicateDialog = () => {
    setDuplicateDialogOpen(false);
    setDuplicateTemplateName('');
  };

  const handleDuplicateTemplate = async () => {
    if (!selectedTemplate || !duplicateTemplateName.trim() || !currentUser) {
      setSnackbar({
        open: true,
        message: 'Veuillez saisir un nom pour la nouvelle template',
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

      // Créer une copie du template avec un nouveau nom
      // Générer de nouveaux IDs uniques pour chaque variable
      const duplicatedVariables = selectedTemplate.variables.map((v, index) => ({
        ...v,
        id: `${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
      }));

      const duplicatedTemplateData: FirestoreTemplate = {
        name: duplicateTemplateName.trim(),
        description: selectedTemplate.description || '',
        pdfUrl: selectedTemplate.pdfUrl,
        fileName: selectedTemplate.fileName,
        variables: duplicatedVariables,
        createdAt: new Date(),
        createdBy: currentUser.uid,
        structureId: userData.structureId
      };

      // Créer le nouveau document dans Firestore
      const docRef = await addDoc(collection(db, 'templates'), duplicatedTemplateData);

      // Mettre à jour l'état local
      const newDuplicatedTemplate: Template = {
        id: docRef.id,
        name: duplicatedTemplateData.name,
        description: duplicatedTemplateData.description,
        file: selectedTemplate.file,
        pdfUrl: duplicatedTemplateData.pdfUrl,
        fileName: duplicatedTemplateData.fileName,
        variables: duplicatedTemplateData.variables
      };

      setTemplates(prev => [...prev, newDuplicatedTemplate]);
      setSelectedTemplate(newDuplicatedTemplate);

      setSnackbar({
        open: true,
        message: 'Template dupliquée avec succès',
        severity: 'success'
      });

      handleCloseDuplicateDialog();
    } catch (error) {
      console.error('Erreur lors de la duplication du template:', error);
      setSnackbar({
        open: true,
        message: `Erreur lors de la duplication du template: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
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
        fileName,
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
          url: pdfUrl, // Utiliser l'URL Firebase pour la persistance
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
          {variable.type === 'raw' 
            ? replaceTags(variable.rawText || '', missionData, currentUser, {})
            : variable.name}
          
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
      // Ajustement pour la nouvelle structure : vérifier si le clic est dans le panneau latéral ou sur un élément de menu
      const sidebar = document.querySelector('.properties-sidebar');
      const isClickInsideSidebar = sidebar?.contains(target);
      const isClickInsideMenu = target.closest('.MuiMenu-root') || target.closest('.MuiDialog-root');
      const isClickInsidePdfContainer = pdfContainerRef.current?.contains(target);

      if (!isClickInsideSidebar && !isClickInsideMenu && !isClickInsidePdfContainer) {
        // Optionnel : Désélectionner si on clique vraiment en dehors de tout
        // setSelectedPlacedVariable(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
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

  // Fonction pour obtenir l'URL du PDF avec proxy si nécessaire
  const getPdfUrl = React.useCallback((url: string): string => {
    if (!url) return '';
    
    // En développement, utiliser le proxy pour éviter les problèmes CORS
    const isDevelopment = window.location.hostname === 'localhost';
    if (isDevelopment && url.includes('firebasestorage.googleapis.com')) {
      // Extraire le chemin et les paramètres de l'URL Firebase
      try {
        const firebaseUrl = new URL(url);
        // Construire l'URL du proxy avec le chemin et les paramètres
        const proxyUrl = '/pdf-proxy' + firebaseUrl.pathname + firebaseUrl.search;
        return proxyUrl;
      } catch (error) {
        console.error('Erreur lors de la construction de l\'URL proxy:', error);
        // En cas d'erreur, utiliser l'URL originale
        return url;
      }
    }
    
    return url;
  }, []);

  const renderPDF = () => {
    if (!selectedTemplate?.file?.url) return null;

    // Utiliser le proxy en développement pour éviter les problèmes CORS
    const pdfUrl = getPdfUrl(selectedTemplate.file.url);

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
            file={pdfUrl}
            onLoadSuccess={(pdf) => handleDocumentLoadSuccess({ numPages: pdf.numPages, pdf })}
            onLoadError={(error) => {
              console.error('Erreur de chargement du PDF:', error);
              // Ne pas afficher d'erreur immédiatement car cela peut être un problème temporaire
              console.warn('Le PDF n\'a pas pu être chargé. Vérifiez les règles Firebase Storage et les permissions.');
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
              <Tooltip
                key={variable.id}
                title={
                  <Box sx={{ p: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{variable.name}</Typography>
                    {variable.type === 'raw' && (
                      <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
                        {variable.rawText}
                      </Typography>
                    )}
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.8 }}>
                      {variable.fontSize}pt • {variable.fontFamily || 'Arial'}
                    </Typography>
                  </Box>
                }
                arrow
                placement="top"
              >
              <Box
                component="div"
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
                    : '1px solid rgba(0, 113, 227, 0.3)',
                  cursor: draggingVariable === variable.id ? 'grabbing' : 'grab',
                  userSelect: 'none',
                  zIndex: draggingVariable === variable.id ? 1000 : 1,
                  display: 'flex',
                  alignItems: variable.verticalAlign === 'top' ? 'flex-start' :
                             variable.verticalAlign === 'bottom' ? 'flex-end' :
                             'center',  // 'middle' ou par défaut
                  justifyContent: variable.textAlign === 'left' ? 'flex-start' : 
                                 variable.textAlign === 'right' ? 'flex-end' : 
                                 variable.textAlign === 'justify' ? 'space-between' : 'center',
                  textRendering: 'geometricPrecision',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  pointerEvents: 'auto',
                  overflow: 'hidden',
                  textAlign: variable.textAlign === 'justify' ? 'justify' : variable.textAlign,
                  transition: draggingVariable === variable.id ? 'none' : 'all 0.2s ease',
                  padding: '2px',  // Petit padding pour éviter que le texte touche les bords
                  boxSizing: 'border-box',
                  // Ajout pour garantir la visibilité minimale au survol
                  '&:hover': {
                    backgroundColor: 'rgba(0, 113, 227, 0.2)',
                    border: '1px solid rgba(0, 113, 227, 0.5)',
                    zIndex: 100, // Passer au premier plan au survol
                  }
                }}
                onClick={(e) => handleVariableSelect(variable.id, e)}
                onMouseDown={(e) => handleVariableMouseDown(e, variable.id)}
                onMouseUp={handleVariableMouseUp}
                onMouseMove={handleVariableMouseMove}
              >
                <Box
                  sx={{
                    width: '100%',
                    maxWidth: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: variable.textAlign === 'left' ? 'flex-start' : 
                               variable.textAlign === 'right' ? 'flex-end' : 
                               variable.textAlign === 'justify' ? 'stretch' : 'center',
                    justifyContent: variable.verticalAlign === 'top' ? 'flex-start' :
                                   variable.verticalAlign === 'bottom' ? 'flex-end' :
                                   'center',
                    overflow: 'hidden',
                    wordBreak: 'break-word',
                    lineHeight: variable.lineHeight || 1.2,
                    textAlign: variable.textAlign,
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      display: 'block',
                      width: '100%',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      lineHeight: variable.lineHeight || 1.2,
                    }}
                  >
                    {variable.type === 'raw' 
            ? replaceTags(variable.rawText || '', missionData, currentUser, {})
            : variable.name}
                  </Box>
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
              </Tooltip>
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
        
        const missionFields = [
          { id: 'numeroMission', name: 'Numéro de mission', description: 'Numéro unique de la mission', type: 'text' },
          { id: 'chargeName', name: 'Prénom Nom CDM', description: 'Nom du chef de mission', type: 'text' },
          { id: 'missionDateDebut', name: 'Date de début (date seule)', description: 'Date de début de la mission (format: jj/mm/aaaa)', type: 'date' },
          { id: 'missionDateHeureDebut', name: 'Date et heure de début', description: 'Date et heure de début de la mission (format: jj/mm/aaaa à hh:mm)', type: 'date' },
          { id: 'missionDateFin', name: 'Date de fin (date seule)', description: 'Date de fin de la mission (format: jj/mm/aaaa)', type: 'date' },
          { id: 'missionDateHeureFin', name: 'Date et heure de fin', description: 'Date et heure de fin de la mission (format: jj/mm/aaaa à hh:mm)', type: 'date' },
          { id: 'location', name: 'Lieu de la mission', description: 'Lieu où se déroule la mission', type: 'text' },
          { id: 'company', name: 'Nom de l\'entreprise', description: 'Entreprise pour laquelle la mission est réalisée', type: 'text' },
          { id: 'missionType', name: 'Type de mission', description: 'Type de la mission', type: 'text' },
          { id: 'generationDate', name: 'Date de génération', description: 'Date à laquelle le document est généré', type: 'date' },
          { id: 'generationDatePlusOneYear', name: 'Date de génération + 1 an', description: 'Date de génération + 365 jours', type: 'date' },
          { id: 'priceHT', name: 'Prix horaire HT', description: 'Prix horaire hors taxes', type: 'number' },
          { id: 'totalHoursHT', name: 'Prix total des heures travaillées HT', description: 'Prix total des heures travaillées HT (prix horaire × nombre d\'heures)', type: 'number' },
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
          { id: 'studentProfile', name: 'Profil étudiant', description: 'Profil type de l\'étudiant recherché', type: 'text' },
          // Dépenses (jusqu'à 4)
          { id: 'nomdepense1', name: 'Nom dépense 1', description: 'Nom de la première dépense', type: 'text' },
          { id: 'tvadepense1', name: 'TVA dépense 1', description: 'TVA de la première dépense (%)', type: 'number' },
          { id: 'totaldepense1', name: 'Prix HT dépense 1', description: 'Prix HT de la première dépense', type: 'number' },
          { id: 'nomdepense2', name: 'Nom dépense 2', description: 'Nom de la deuxième dépense', type: 'text' },
          { id: 'tvadepense2', name: 'TVA dépense 2', description: 'TVA de la deuxième dépense (%)', type: 'number' },
          { id: 'totaldepense2', name: 'Prix HT dépense 2', description: 'Prix HT de la deuxième dépense', type: 'number' },
          { id: 'nomdepense3', name: 'Nom dépense 3', description: 'Nom de la troisième dépense', type: 'text' },
          { id: 'tvadepense3', name: 'TVA dépense 3', description: 'TVA de la troisième dépense (%)', type: 'number' },
          { id: 'totaldepense3', name: 'Prix HT dépense 3', description: 'Prix HT de la troisième dépense', type: 'number' },
          { id: 'nomdepense4', name: 'Nom dépense 4', description: 'Nom de la quatrième dépense', type: 'text' },
          { id: 'tvadepense4', name: 'TVA dépense 4', description: 'TVA de la quatrième dépense (%)', type: 'number' },
          { id: 'totaldepense4', name: 'Prix HT dépense 4', description: 'Prix HT de la quatrième dépense', type: 'number' }
        ];

        const userFields = [
          { id: 'lastName', name: 'Nom de famille', description: 'Nom de famille de l\'utilisateur', type: 'text' },
          { id: 'firstName', name: 'Prénom', description: 'Prénom de l\'utilisateur', type: 'text' },
          { id: 'email', name: 'Adresse email', description: 'Adresse email de l\'utilisateur', type: 'text' },
          { id: 'ecole', name: 'École', description: 'École de formation de l\'utilisateur', type: 'text' },
          { id: 'phone', name: 'Téléphone', description: 'Numéro de téléphone de l\'utilisateur', type: 'text' },
          { id: 'socialSecurityNumber', name: 'Numéro de sécurité sociale', description: 'Numéro de sécurité sociale de l\'utilisateur', type: 'text' },
          { id: 'studentId', name: 'Numéro étudiant', description: 'Numéro étudiant de l\'utilisateur', type: 'text' },
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
          { id: 'nSiret', name: 'Numéro nSiret', description: 'Numéro nSiret de l\'entreprise', type: 'text' },
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
          { id: 'nSiret', name: 'nSiret', description: 'Numéro nSiret de la structure (14 chiffres)', type: 'text' },
          { id: 'tvaNumber', name: 'N° de TVA intracommunautaire', description: 'Numéro de TVA intracommunautaire de la structure (format FR + 11 chiffres)', type: 'text' },
          { id: 'apeCode', name: 'Code APE', description: 'Code APE de la structure (4 chiffres + 1 lettre)', type: 'text' },
          { id: 'structure_address', name: 'Adresse de la structure', description: 'Adresse de la structure', type: 'text' },
          { id: 'structure_phone', name: 'N° de téléphone de la structure', description: 'N° de téléphone de la structure', type: 'text' },
          { id: 'structure_email', name: 'Email de la structure', description: 'Email de la structure', type: 'text' },
          { id: 'structure_president_fullName', name: 'Prénom et Nom du président', description: 'Prénom et Nom du président du mandat le plus récent', type: 'text' }
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
      missionDateDebut: '<mission_date_debut>',
      missionDateHeureDebut: '<mission_date_heure_debut>',
      missionDateFin: '<mission_date_fin>',
      missionDateHeureFin: '<mission_date_heure_fin>',
      location: '<mission_lieu>',
      company: '<mission_entreprise>',
      priceHT: '<mission_prix_horaire_ht>',
      totalHoursHT: '<mission_prix_total_heures_ht>',
      missionDescription: '<mission_description>',
      title: '<mission_titre>',
      hours: '<mission_heures>',
      studentCount: '<mission_nb_etudiants>',
      generationDate: '<mission_date_generation>',
      generationDatePlusOneYear: '<mission_date_generation_plus_1_an>',
      
      // User
      lastName: '<user_nom>',
      firstName: '<user_prenom>',
      email: '<user_email>',
      ecole: '<user_ecole>',
      displayName: '<user_nom_complet>',
      phone: '<user_telephone>',
      socialSecurityNumber: '<user_numero_securite_sociale>',
      studentId: '<user_numero_etudiant>',
      
      // Company
      companyName: '<company_nom>',
      siren: '<company_siren>',
      nSiret: '<company_nsiret>',
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
      structure_president_fullName: '<structure_president_nom_complet>',
      charge_email: '<charge_email>',
      charge_phone: '<charge_phone>',
      totalHT: '<total_ht>',
      totalTTC: '<total_ttc>',
      tva: '<tva>',
      courseApplication: '<course_application>',
      missionLearning: '<mission_learning>',
      studentProfile: '<student_profile>',
      // Dépenses
      nomdepense1: '<depense1_nom>',
      tvadepense1: '<depense1_tva>',
      totaldepense1: '<depense1_prix>',
      nomdepense2: '<depense2_nom>',
      tvadepense2: '<depense2_tva>',
      totaldepense2: '<depense2_prix>',
      nomdepense3: '<depense3_nom>',
      tvadepense3: '<depense3_tva>',
      totaldepense3: '<depense3_prix>',
      nomdepense4: '<depense4_nom>',
      tvadepense4: '<depense4_tva>',
      totaldepense4: '<depense4_prix>'
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

  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setRawText((prev) => prev + tag);
    setSnackbar({
      open: true,
      message: `Balise ${tag} ajoutée au texte`,
      severity: 'success'
    });
    setTagsDialogOpen(false);
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

  const handleRenameTemplate = async () => {
    if (!selectedTemplate || !newTemplateName.trim() || !currentUser) {
      return;
    }

    try {
      setLoading(true);
      
      // Mettre à jour dans Firestore
      const templateRef = doc(db, 'templates', selectedTemplate.id);
      await updateDoc(templateRef, { 
        name: newTemplateName.trim(),
        updatedAt: serverTimestamp()
      });
      
      // Mettre à jour localement
      const updatedTemplate = { ...selectedTemplate, name: newTemplateName.trim() };
      setTemplates(templates.map(t => t.id === selectedTemplate.id ? updatedTemplate : t));
      setSelectedTemplate(updatedTemplate);
      
      setRenameDialogOpen(false);
      setSnackbar({
        open: true,
        message: 'Template renommé avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors du renommage:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors du renommage du template',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePreview = async () => {
    if (!selectedTemplate || !currentUser) {
      setSnackbar({
        open: true,
        message: 'Veuillez sélectionner un template',
        severity: 'error'
      });
      return;
    }

    try {
      setGeneratingPreview(true);

      // Récupérer le structureId de l'utilisateur
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();
      
      if (!userData?.structureId) {
        throw new Error('Aucune structure associée à l\'utilisateur');
      }

      // Récupérer les données de la structure
      const structureDoc = await getDoc(doc(db, 'structures', userData.structureId));
      const structureData = structureDoc.exists() ? structureDoc.data() : null;

      // Récupérer les données de contact si une mission est disponible
      let contactData: any = null;
      if (missionData?.companyId) {
        try {
          // Récupérer le contact par défaut de l'entreprise
          const contactsQuery = query(
            collection(db, 'contacts'),
            where('companyId', '==', missionData.companyId),
            where('isDefault', '==', true)
          );
          const contactsSnapshot = await getDocs(contactsQuery);
          if (!contactsSnapshot.empty) {
            contactData = contactsSnapshot.docs[0].data();
          }
        } catch (error) {
          console.warn('Erreur lors de la récupération du contact:', error);
        }
      }

      // Charger le PDF template
      const pdfUrl = selectedTemplate.pdfUrl;
      let finalPdfUrl;
      if (pdfUrl.startsWith('http')) {
        finalPdfUrl = pdfUrl;
      } else {
        const storageRef = ref(storage, pdfUrl);
        finalPdfUrl = await getDownloadURL(storageRef);
      }

      const response = await fetch(finalPdfUrl);
      const pdfBlob = await response.blob();
      const pdfBytes = await pdfBlob.arrayBuffer();

      // Charger le PDF dans PDFDocument
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const helveticaFont = await pdfDoc.embedFont('Helvetica');
      const helveticaFontBold = await pdfDoc.embedFont('Helvetica-Bold');
      const pages = pdfDoc.getPages();

      // Fonction pour obtenir la valeur d'une variable
      const getVariableValueForPreview = (variableId: string): string => {
        // Si c'est la date de génération
        if (variableId === 'generationDate') {
          return new Date().toLocaleDateString('fr-FR');
        }

        // Si c'est la date de génération + 1 an
        if (variableId === 'generationDatePlusOneYear') {
          const today = new Date();
          const oneYearLater = new Date(today);
          oneYearLater.setDate(today.getDate() + 365);
          return oneYearLater.toLocaleDateString('fr-FR');
        }

        // Gestion spéciale des dates de mission
        if (variableId === 'missionDateDebut' && missionData?.startDate) {
          const date = new Date(missionData.startDate);
          return date.toLocaleDateString('fr-FR');
        }
        if (variableId === 'missionDateHeureDebut' && missionData?.startDate) {
          const date = new Date(missionData.startDate);
          const dateStr = date.toLocaleDateString('fr-FR');
          const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          return `${dateStr} à ${timeStr}`;
        }
        if (variableId === 'missionDateFin' && missionData?.endDate) {
          const date = new Date(missionData.endDate);
          return date.toLocaleDateString('fr-FR');
        }
        if (variableId === 'missionDateHeureFin' && missionData?.endDate) {
          const date = new Date(missionData.endDate);
          const dateStr = date.toLocaleDateString('fr-FR');
          const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          return `${dateStr} à ${timeStr}`;
        }

        // Calcul du prix total des heures travaillées HT
        if (variableId === 'totalHoursHT' && missionData?.priceHT && missionData?.hours) {
          const total = missionData.priceHT * missionData.hours;
          return total.toFixed(2);
        }

        // Utiliser les données de mission si disponibles
        if (missionData) {
          const field = variableId.split('_')[1] || variableId;
          if (missionData[field as keyof typeof missionData] !== undefined) {
            const value = missionData[field as keyof typeof missionData];
            if (value instanceof Date) {
              return value.toLocaleDateString('fr-FR');
            }
            return value?.toString() || '';
          }
        }

        // Utiliser les données utilisateur si disponibles
        if (currentUser) {
          const field = variableId.split('_')[1] || variableId;
          if (currentUser[field as keyof typeof currentUser] !== undefined) {
            const value = currentUser[field as keyof typeof currentUser];
            if (value instanceof Date) {
              return value.toLocaleDateString('fr-FR');
            }
            return value?.toString() || '';
          }
        }

        // Utiliser les données de contact si disponibles
        if (contactData && variableId.startsWith('contact_')) {
          const field = variableId.replace('contact_', '');
          if (field === 'fullName') {
            const firstName = contactData.firstName || '';
            const lastName = contactData.lastName || '';
            return `${firstName} ${lastName}`.trim();
          }
          if (contactData[field as keyof typeof contactData] !== undefined) {
            const value = contactData[field as keyof typeof contactData];
            if (value instanceof Date) {
              return value.toLocaleDateString('fr-FR');
            }
            return value?.toString() || '';
          }
        }

        // Utiliser les données de structure si disponibles
        if (structureData) {
          // Gestion des champs de structure avec préfixe
          if (variableId.startsWith('structure_')) {
            const field = variableId.replace('structure_', '');
            // Gestion spéciale pour structure_president_fullName
            if (field === 'president_fullName' || field === 'president_nom_complet') {
              // Essayer de récupérer le président du mandat le plus récent
              if (structureData.presidents && Array.isArray(structureData.presidents) && structureData.presidents.length > 0) {
                const latestPresident = structureData.presidents[structureData.presidents.length - 1];
                if (latestPresident.firstName && latestPresident.lastName) {
                  return `${latestPresident.firstName} ${latestPresident.lastName}`;
                }
              }
            }
            if (structureData[field as keyof typeof structureData] !== undefined) {
              const value = structureData[field as keyof typeof structureData];
              if (value instanceof Date) {
                return value.toLocaleDateString('fr-FR');
              }
              return value?.toString() || '';
            }
          } else if (structureData[variableId as keyof typeof structureData] !== undefined) {
            const value = structureData[variableId as keyof typeof structureData];
            if (value instanceof Date) {
              return value.toLocaleDateString('fr-FR');
            }
            return value?.toString() || '';
          }
        }

        // Valeurs par défaut pour l'aperçu
        const defaultValues: { [key: string]: string } = {
          numeroMission: 'M2024-001',
          chargeName: 'Jean Dupont',
          missionDateDebut: new Date().toLocaleDateString('fr-FR'),
          missionDateHeureDebut: `${new Date().toLocaleDateString('fr-FR')} à 09:00`,
          missionDateFin: new Date().toLocaleDateString('fr-FR'),
          missionDateHeureFin: `${new Date().toLocaleDateString('fr-FR')} à 17:00`,
          location: 'Paris',
          company: 'Entreprise SA',
          missionType: 'Consulting',
          priceHT: '25.00',
          totalHoursHT: '1000.00',
          missionDescription: 'Description détaillée de la mission',
          title: 'Titre de la mission',
          hours: '40',
          studentCount: '4',
          lastName: 'Dupont',
          firstName: 'Jean',
          email: 'jean.dupont@email.com',
          ecole: 'École ABC',
          phone: '06 12 34 56 78',
          address: '123 rue Example',
          city: 'Paris',
          contact_fullName: 'Jean Dupont',
          contact_firstName: 'Jean',
          contact_lastName: 'Dupont',
          contact_email: 'jean.dupont@email.com',
          contact_phone: '06 12 34 56 78',
          contact_position: 'Chef de projet',
          contact_linkedin: 'https://www.linkedin.com/in/jean-dupont',
          structure_name: structureData?.name || 'Ma Structure',
          structure_siret: structureData?.nSiret || '12345678901234',
          structure_address: structureData?.address || '123 rue Example',
          structure_city: structureData?.city || 'Paris',
          structure_postalCode: structureData?.postalCode || '75000',
          structure_country: structureData?.country || 'France',
          structure_phone: structureData?.phone || '01 23 45 67 89',
          structure_email: structureData?.email || 'contact@structure.fr',
          structure_website: structureData?.website || 'www.structure.fr',
          structure_president_fullName: 'Jean Dupont',
        };

        return defaultValues[variableId] || '';
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

      // Fonction pour diviser le texte en lignes selon la largeur max, en préservant les retours à la ligne
      const splitTextToLines = (text: string, font: any, fontSize: number, maxWidth: number): string[] => {
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

      // Appliquer les variables sur chaque page
      selectedTemplate.variables.forEach(variable => {
        const pageIndex = variable.position.page - 1;
        if (pageIndex < 0 || pageIndex >= pages.length) return;

        const page = pages[pageIndex];
        const font = variable.isBold ? helveticaFontBold : helveticaFont;
        const fontSize = variable.fontSize || 12;

        // Obtenir le texte à afficher
        let textToDisplay = '';
        if (variable.type === 'raw' && variable.rawText) {
          // Remplacer les balises dans le texte brut
          let processedText = variable.rawText;
          // Parcourir toutes les balises et les remplacer
          VARIABLE_TAGS.forEach(({ tag, variableId }) => {
            const value = getVariableValueForPreview(variableId);
            // Utiliser une expression régulière globale pour remplacer toutes les occurrences
            const regex = new RegExp(escapeRegExp(tag), 'g');
            processedText = processedText.replace(regex, value || '');
          });
          // Vérifier s'il reste des balises non remplacées (format <xxx_yyy>)
          const remainingTags = processedText.match(/<[^>]+>/g);
          if (remainingTags) {
            // Remplacer les balises restantes par une chaîne vide
            remainingTags.forEach(tag => {
              processedText = processedText.replace(new RegExp(escapeRegExp(tag), 'g'), '');
            });
          }
          textToDisplay = processedText;
        } else if (variable.variableId) {
          textToDisplay = getVariableValueForPreview(variable.variableId);
        } else {
          textToDisplay = variable.name;
        }

        const lineHeightMultiplier = variable.lineHeight || 1.2;
        const cleanedValue = cleanTextForPDF(textToDisplay);
        const lines = splitTextToLines(cleanedValue.trim(), font, fontSize, variable.width);
        
        // Calculer la hauteur totale du texte
        const lineHeight = fontSize * lineHeightMultiplier;
        const totalTextHeight = lines.length * lineHeight;
        
        // Calculer la position Y de départ en fonction de l'alignement vertical
        // Le système de coordonnées PDF a l'origine en bas à gauche
        // Offset pour abaisser légèrement les balises (en pixels)
        const pageHeight = 842;
        const x = variable.position.x;
        const y = variable.position.y;
        const width = variable.width;
        const height = variable.height;
        const textAlign = variable.textAlign;
        const verticalAlign = variable.verticalAlign;
        
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
                  font: font,
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
                    font: font,
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
      });

      // Générer le PDF en bytes
      const generatedPdfBytes = await pdfDoc.save();
      const blob = new Blob([generatedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      setPreviewUrl(url);
      setPreviewDialogOpen(true);
    } catch (error) {
      console.error('Erreur lors de la génération de l\'aperçu:', error);
      setSnackbar({
        open: true,
        message: `Erreur lors de la génération de l'aperçu: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        severity: 'error'
      });
    } finally {
      setGeneratingPreview(false);
    }
  };

return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#f5f5f5' }}>
        {/* HEADER */}
        <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid #e0e0e0', bgcolor: 'white' }}>
            <Toolbar variant="dense" sx={{ justifyContent: 'space-between', minHeight: 64 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 250 }}>
                        <Select
                            displayEmpty
                            value={selectedTemplate?.id || ''}
                            onChange={(e) => {
                                const template = templates.find(t => t.id === e.target.value);
                                setSelectedTemplate(template || null);
                            }}
                            renderValue={(value) => {
                                if (!value) return <Typography color="text.secondary">Sélectionner un modèle</Typography>;
                                const template = templates.find(t => t.id === value);
                                return template?.name;
                            }}
                        >
                            <MenuItem value="" disabled>Sélectionner un modèle</MenuItem>
                            {templates.map(t => (
                                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {selectedTemplate && (
                        <IconButton
                            size="small"
                            onClick={() => {
                                setNewTemplateName(selectedTemplate.name);
                                setRenameDialogOpen(true);
                            }}
                        >
                            <EditIcon />
                        </IconButton>
                    )}
                    <Button startIcon={<AddIcon />} size="small" onClick={() => setOpenDialog(true)}>
                        Nouveau
                    </Button>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton onClick={() => setPageNumber(Math.max(1, pageNumber - 1))} disabled={pageNumber <= 1} size="small">
                         <KeyboardArrowDownIcon sx={{ transform: 'rotate(90deg)' }} />
                    </IconButton>
                    <Typography variant="body2">Page {pageNumber} / {numPages || 1}</Typography>
                    <IconButton onClick={() => setPageNumber(Math.min(numPages || 1, pageNumber + 1))} disabled={pageNumber >= (numPages || 1)} size="small">
                         <KeyboardArrowDownIcon sx={{ transform: 'rotate(-90deg)' }} />
                    </IconButton>
                    <Divider orientation="vertical" flexItem variant="middle" />
                    <Box sx={{ width: 100, display: 'flex', alignItems: 'center' }}>
                        <Slider
                            size="small"
                            value={zoom}
                            min={0.5}
                            max={2}
                            step={0.1}
                            onChange={(_, v) => setZoom(v as number)}
                        />
                    </Box>
                    <Typography variant="caption" sx={{ width: 35 }}>{Math.round(zoom * 100)}%</Typography>
                    {selectedTemplate && (
                        <>
                            <Divider orientation="vertical" flexItem variant="middle" />
                            <Tooltip title="Générer et afficher l'aperçu du document">
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={handleGeneratePreview}
                                    disabled={generatingPreview}
                                    startIcon={generatingPreview ? <CircularProgress size={16} /> : <VisibilityIcon />}
                                >
                                    {generatingPreview ? 'Génération...' : 'Aperçu PDF'}
                                </Button>
                            </Tooltip>
                        </>
                    )}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {selectedTemplate && (
                        <>
                             <Button
                                variant="outlined"
                                size="small"
                                onClick={handleOpenReplacePdfDialog}
                                startIcon={<UploadIcon />}
                             >
                                PDF
                             </Button>
                             <Button
                                variant="outlined"
                                size="small"
                                onClick={handleOpenDuplicateDialog}
                                startIcon={<ContentCopyIcon />}
                             >
                                Dupliquer
                             </Button>
                             <Button
                                variant="contained"
                                color="primary"
                                onClick={handleSaveVariables}
                                disabled={loading || !hasUnsavedChanges}
                                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                             >
                                Enregistrer
                             </Button>
                        </>
                    )}
                </Box>
            </Toolbar>
        </AppBar>

        {/* MAIN CONTENT */}
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* CANVAS AREA */}
            <Box
                sx={{
                    flex: 1,
                    bgcolor: '#F3F4F6',
                    overflow: 'auto',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    p: 4
                }}
                onClick={() => setSelectedPlacedVariable(null)}
            >
                {selectedTemplate ? (
                     <Box
                        sx={{
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                            // Ensure relative positioning for absolute children (PDF pages)
                            position: 'relative',
                            display: 'inline-block' 
                        }}
                     >
                        <Paper
                            elevation={3}
                            ref={pdfContainerRef}
                            onClick={handlePdfClick}
                            onMouseMove={(e) => {
                                if (resizingVariable) handleResizeMove(e);
                                else handleVariableMouseMove(e);
                            }}
                            onMouseUp={() => {
                                if (resizingVariable) handleResizeEnd();
                                else handleVariableMouseUp();
                            }}
                            onMouseLeave={() => {
                                if (resizingVariable) handleResizeEnd();
                                else handleVariableMouseUp();
                            }}
                            sx={{
                                position: 'relative',
                                width: 595 * zoom,
                                height: 842 * zoom,
                                overflow: 'hidden',
                                bgcolor: 'white'
                            }}
                        >
                             {renderPDF()}
                        </Paper>
                     </Box>
                ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
                        <Typography>Sélectionnez ou créez un modèle pour commencer</Typography>
                    </Box>
                )}
            </Box>

            {/* RIGHT SIDEBAR (INSPECTOR) */}
            <Paper
                square
                elevation={0}
                className="properties-sidebar"
                sx={{
                    width: 350,
                    borderLeft: '1px solid #e0e0e0',
                    display: 'flex',
                    flexDirection: 'column',
                    bgcolor: 'white',
                    zIndex: 10,
                    height: '100%'
                }}
            >
                {selectedTemplate ? (
                    selectedPlacedVariable ? (
                        // STATE 2: PROPERTIES
                        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography variant="subtitle1" fontWeight="bold">Propriétés</Typography>
                                <IconButton size="small" onClick={() => setSelectedPlacedVariable(null)}>
                                    <CloseIcon />
                                </IconButton>
                            </Box>
                            <Box sx={{ p: 2, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {/* Content Editing */}
                                <Box>
                                    <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ mb: 1, display: 'block' }}>
                                        {selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.type === 'raw' ? 'CONTENU DU TEXTE' : 'NOM DE LA VARIABLE'}
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        multiline={selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.type === 'raw'}
                                        rows={selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.type === 'raw' ? 4 : 1}
                                        value={
                                            selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.type === 'raw'
                                                ? selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.rawText
                                                : selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.name
                                        }
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const isRaw = selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.type === 'raw';
                                            
                                            const updatedVariables = selectedTemplate.variables.map(v =>
                                                v.id === selectedPlacedVariable
                                                    ? { 
                                                        ...v, 
                                                        [isRaw ? 'rawText' : 'name']: val,
                                                        ...(isRaw ? { name: val.substring(0, 20) + (val.length > 20 ? '...' : '') } : {})
                                                      }
                                                    : v
                                            );
                                            setSelectedTemplate({ ...selectedTemplate, variables: updatedVariables });
                                            setHasUnsavedChanges(true);
                                        }}
                                    />
                                </Box>

                                {/* Position */}
                                <Box>
                                    <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ mb: 1, display: 'block' }}>POSITION & TAILLE</Typography>
                                    <Grid container spacing={2}>
                                        <Grid item xs={6}>
                                            <TextField
                                                label="X"
                                                size="small"
                                                type="number"
                                                fullWidth
                                                value={Math.round(selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.position.x || 0)}
                                                onChange={(e) => {
                                                    const updatedVariables = selectedTemplate.variables.map(v =>
                                                        v.id === selectedPlacedVariable ? { ...v, position: { ...v.position, x: Number(e.target.value) } } : v
                                                    );
                                                    setSelectedTemplate({ ...selectedTemplate, variables: updatedVariables });
                                                    setHasUnsavedChanges(true);
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={6}>
                                            <TextField
                                                label="Y"
                                                size="small"
                                                type="number"
                                                fullWidth
                                                value={Math.round(selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.position.y || 0)}
                                                onChange={(e) => {
                                                    const updatedVariables = selectedTemplate.variables.map(v =>
                                                        v.id === selectedPlacedVariable ? { ...v, position: { ...v.position, y: Number(e.target.value) } } : v
                                                    );
                                                    setSelectedTemplate({ ...selectedTemplate, variables: updatedVariables });
                                                    setHasUnsavedChanges(true);
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={6}>
                                            <TextField
                                                label="Largeur"
                                                size="small"
                                                type="number"
                                                fullWidth
                                                value={Math.round(selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.width || 100)}
                                                onChange={(e) => {
                                                    const updatedVariables = selectedTemplate.variables.map(v =>
                                                        v.id === selectedPlacedVariable ? { ...v, width: Number(e.target.value) } : v
                                                    );
                                                    setSelectedTemplate({ ...selectedTemplate, variables: updatedVariables });
                                                    setHasUnsavedChanges(true);
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={6}>
                                            <TextField
                                                label="Hauteur"
                                                size="small"
                                                type="number"
                                                fullWidth
                                                value={Math.round(selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.height || 30)}
                                                onChange={(e) => {
                                                    const updatedVariables = selectedTemplate.variables.map(v =>
                                                        v.id === selectedPlacedVariable ? { ...v, height: Number(e.target.value) } : v
                                                    );
                                                    setSelectedTemplate({ ...selectedTemplate, variables: updatedVariables });
                                                    setHasUnsavedChanges(true);
                                                }}
                                            />
                                        </Grid>
                                    </Grid>
                                </Box>

                                {/* Typography */}
                                <Box>
                                    <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ mb: 1, display: 'block' }}>TYPOGRAPHIE</Typography>
                                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                        <InputLabel>Police</InputLabel>
                                        <Select
                                            label="Police"
                                            value={selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.fontFamily || 'Arial'}
                                            onChange={(e) => {
                                                const updatedVariables = selectedTemplate.variables.map(v =>
                                                    v.id === selectedPlacedVariable ? { ...v, fontFamily: e.target.value } : v
                                                );
                                                setSelectedTemplate({ ...selectedTemplate, variables: updatedVariables });
                                                setHasUnsavedChanges(true);
                                            }}
                                        >
                                            {FONT_FAMILIES.map(font => (
                                                <MenuItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>{font.label}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    
                                    <Grid container spacing={2}>
                                        <Grid item xs={6}>
                                            <TextField
                                                label="Taille (pt)"
                                                size="small"
                                                type="number"
                                                fullWidth
                                                value={selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.fontSize || 12}
                                                onChange={(e) => {
                                                    const updatedVariables = selectedTemplate.variables.map(v =>
                                                        v.id === selectedPlacedVariable ? { ...v, fontSize: Number(e.target.value) } : v
                                                    );
                                                    setSelectedTemplate({ ...selectedTemplate, variables: updatedVariables });
                                                    setHasUnsavedChanges(true);
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={6}>
                                            <TextField
                                                label="Interligne"
                                                size="small"
                                                type="number"
                                                fullWidth
                                                inputProps={{ step: 0.1, min: 0.5, max: 3 }}
                                                value={selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.lineHeight || 1.2}
                                                onChange={(e) => {
                                                    const updatedVariables = selectedTemplate.variables.map(v =>
                                                        v.id === selectedPlacedVariable ? { ...v, lineHeight: Number(e.target.value) } : v
                                                    );
                                                    setSelectedTemplate({ ...selectedTemplate, variables: updatedVariables });
                                                    setHasUnsavedChanges(true);
                                                }}
                                            />
                                        </Grid>
                                    </Grid>
                                </Box>

                                {/* Appearance & Alignment */}
                                <Box>
                                    <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ mb: 1, display: 'block' }}>APPARENCE</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                        <Typography variant="body2">Gras</Typography>
                                        <Switch
                                            size="small"
                                            checked={selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.isBold || false}
                                            onChange={(e) => {
                                                const updatedVariables = selectedTemplate.variables.map(v =>
                                                    v.id === selectedPlacedVariable ? { ...v, isBold: e.target.checked } : v
                                                );
                                                setSelectedTemplate({ ...selectedTemplate, variables: updatedVariables });
                                                setHasUnsavedChanges(true);
                                            }}
                                        />
                                    </Box>
                                    
                                    <Typography variant="caption" sx={{ mb: 0.5, display: 'block' }}>Alignement Horizontal</Typography>
                                    <Box sx={{ display: 'flex', bgcolor: '#f5f5f5', borderRadius: 1, p: 0.5, mb: 2 }}>
                                        {['left', 'center', 'right', 'justify'].map((align) => (
                                            <IconButton
                                                key={align}
                                                size="small"
                                                sx={{ flex: 1, bgcolor: selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.textAlign === align ? 'white' : 'transparent', borderRadius: 0.5, boxShadow: selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.textAlign === align ? 1 : 0 }}
                                                onClick={() => {
                                                    const updatedVariables = selectedTemplate.variables.map(v =>
                                                        v.id === selectedPlacedVariable ? { ...v, textAlign: align as any } : v
                                                    );
                                                    setSelectedTemplate({ ...selectedTemplate, variables: updatedVariables });
                                                    setHasUnsavedChanges(true);
                                                }}
                                            >
                                                {align === 'left' && <FormatAlignLeftIcon fontSize="small" />}
                                                {align === 'center' && <FormatAlignCenterIcon fontSize="small" />}
                                                {align === 'right' && <FormatAlignRightIcon fontSize="small" />}
                                                {align === 'justify' && <FormatAlignJustifyIcon fontSize="small" />}
                                            </IconButton>
                                        ))}
                                    </Box>
                                    
                                    <Typography variant="caption" sx={{ mb: 0.5, display: 'block' }}>Alignement Vertical</Typography>
                                    <Box sx={{ display: 'flex', bgcolor: '#f5f5f5', borderRadius: 1, p: 0.5 }}>
                                        {['top', 'middle', 'bottom'].map((align) => (
                                            <IconButton
                                                key={align}
                                                size="small"
                                                sx={{ flex: 1, bgcolor: selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.verticalAlign === align ? 'white' : 'transparent', borderRadius: 0.5, boxShadow: selectedTemplate.variables.find(v => v.id === selectedPlacedVariable)?.verticalAlign === align ? 1 : 0 }}
                                                onClick={() => {
                                                    const updatedVariables = selectedTemplate.variables.map(v =>
                                                        v.id === selectedPlacedVariable ? { ...v, verticalAlign: align as any } : v
                                                    );
                                                    setSelectedTemplate({ ...selectedTemplate, variables: updatedVariables });
                                                    setHasUnsavedChanges(true);
                                                }}
                                            >
                                                {align === 'top' && <VerticalAlignTopIcon fontSize="small" />}
                                                {align === 'middle' && <VerticalAlignCenterIcon fontSize="small" />}
                                                {align === 'bottom' && <VerticalAlignBottomIcon fontSize="small" />}
                                            </IconButton>
                                        ))}
                                    </Box>
                                </Box>
                            </Box>
                            <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
                                <Button
                                    fullWidth
                                    variant="outlined"
                                    color="error"
                                    startIcon={<DeleteIcon />}
                                    onClick={() => handleDeleteVariable(selectedPlacedVariable)}
                                >
                                    Supprimer la variable
                                </Button>
                            </Box>
                        </Box>
                    ) : (
                        // STATE 1: AVAILABLE VARIABLES
                        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
                                <Typography variant="subtitle1" fontWeight="bold">Variables disponibles</Typography>
                            </Box>
                            <Box sx={{ flex: 1, overflowY: 'auto' }}>
                                {/* Raw Text Input Section */}
                                <Box sx={{ p: 2, borderBottom: '1px solid #f0f0f0' }}>
                                    <Typography variant="caption" color="text.secondary" fontWeight="bold" gutterBottom>TEXTE LIBRE</Typography>
                                    <TextField
                                        fullWidth
                                        multiline
                                        rows={2}
                                        size="small"
                                        placeholder="Ajouter du texte brut..."
                                        value={rawText}
                                        onChange={(e) => setRawText(e.target.value)}
                                        sx={{ mb: 1 }}
                                    />
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                      <Button
                                          fullWidth
                                          variant="outlined"
                                          size="small"
                                          startIcon={isAddingRawText ? <CheckIcon /> : <AddIcon />}
                                          onClick={() => {
                                              setIsAddingRawText(!isAddingRawText);
                                              setSelectedVariableId(null);
                                          }}
                                          color={isAddingRawText ? "success" : "primary"}
                                          disabled={!rawText.trim()}
                                      >
                                          {isAddingRawText ? "Placer" : "Ajouter"}
                                      </Button>
                                      <Tooltip title="Insérer une balise dynamique">
                                        <IconButton size="small" onClick={() => setTagsDialogOpen(true)}>
                                          <CodeIcon />
                                        </IconButton>
                                      </Tooltip>
                                    </Box>
                                </Box>

                                {/* Database Fields Accordions */}
                                {Object.keys(databaseFields).map((key) => {
                                    const dataSourceKey = key as keyof DatabaseFields;
                                    const dataSourceName = {
                                        missions: 'Missions',
                                        users: 'Utilisateurs',
                                        companies: 'Entreprises',
                                        contacts: 'Contacts',
                                        expenseNotes: 'Notes de frais',
                                        workingHours: 'Heures de travail',
                                        amendments: 'Avenants',
                                        structures: 'Structure'
                                    }[dataSourceKey] || key;

                                    return (
                                        <Accordion key={key} disableGutters elevation={0} sx={{ '&:before': { display: 'none' }, borderBottom: '1px solid #f0f0f0' }}>
                                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                <Typography variant="body2" fontWeight="medium">{dataSourceName}</Typography>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ p: 1, pt: 0 }}>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                    {databaseFields[dataSourceKey].map(field => (
                                                        <Tooltip key={field.id} title={field.description} arrow placement="left">
                                                            <Chip
                                                                label={field.name}
                                                                size="small"
                                                                onClick={() => {
                                                                    setSelectedDatabase(dataSourceKey);
                                                                    setSelectedVariableId(selectedVariableId === field.id ? null : field.id);
                                                                }}
                                                                color={selectedVariableId === field.id ? "primary" : "default"}
                                                                sx={{ cursor: 'pointer' }}
                                                            />
                                                        </Tooltip>
                                                    ))}
                                                </Box>
                                            </AccordionDetails>
                                        </Accordion>
                                    );
                                })}
                            </Box>
                        </Box>
                    )
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', p: 3, textAlign: 'center' }}>
                         <TextSnippetIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 2 }} />
                         <Typography variant="body2" color="text.secondary">
                             Aucun template sélectionné
                         </Typography>
                    </Box>
                )}
            </Paper>
        </Box>

        {/* Dialogs */}
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
      
      <Dialog open={replacePdfDialogOpen} onClose={handleCloseReplacePdfDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Remplacer le PDF du template</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Sélectionnez un nouveau fichier PDF pour remplacer le PDF actuel du template "{selectedTemplate?.name}".
            Les balises existantes seront conservées et resteront aux mêmes positions.
          </DialogContentText>
          <Button
            variant="outlined"
            component="label"
            startIcon={<UploadIcon />}
            fullWidth
          >
            {replacementPdfFile ? replacementPdfFile.name : 'Sélectionner un nouveau PDF'}
            <input
              type="file"
              hidden
              accept=".pdf"
              ref={replacePdfInputRef}
              onChange={handleReplacePdfFileChange}
            />
          </Button>
          {replacementPdfFile && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Le nouveau PDF sera uploadé et remplacera l'ancien. Les balises existantes seront conservées.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseReplacePdfDialog}>Annuler</Button>
          <Button
            onClick={handleReplacePdf}
            variant="contained"
            disabled={!replacementPdfFile || loading}
            startIcon={loading ? <CircularProgress size={20} /> : <UploadIcon />}
          >
            {loading ? 'Remplacement...' : 'Remplacer le PDF'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={duplicateDialogOpen} onClose={handleCloseDuplicateDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Dupliquer le template</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Entrez un nom pour la nouvelle template dupliquée. Toutes les variables et le PDF seront copiés.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Nom de la nouvelle template"
            fullWidth
            variant="outlined"
            value={duplicateTemplateName}
            onChange={(e) => setDuplicateTemplateName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && duplicateTemplateName.trim()) {
                handleDuplicateTemplate();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDuplicateDialog}>Annuler</Button>
          <Button
            onClick={handleDuplicateTemplate}
            variant="contained"
            disabled={!duplicateTemplateName.trim() || loading}
            startIcon={loading ? <CircularProgress size={20} /> : <ContentCopyIcon />}
          >
            {loading ? 'Duplication...' : 'Dupliquer'}
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

      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Renommer le template</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nom du template"
            fullWidth
            variant="outlined"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && newTemplateName.trim() && selectedTemplate) {
                handleRenameTemplate();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Annuler</Button>
          <Button
            onClick={handleRenameTemplate}
            variant="contained"
            disabled={!newTemplateName.trim() || !selectedTemplate || loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={tagsDialogOpen} onClose={() => setTagsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Balises disponibles</Typography>
            <IconButton onClick={() => setTagsDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {['Mission', 'Utilisateur', 'Entreprise', 'Notes de frais & Dépenses', 'Heures de travail', 'Avenants', 'Contacts', 'Structure'].map((cat) => (
              <Chip
                key={cat}
                label={cat}
                size="small"
                variant="outlined"
                onClick={() => {
                  const element = document.getElementById(`category-${cat}`);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                clickable
              />
            ))}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" paragraph>
            Cliquez sur une balise pour l'insérer dans votre texte. Ces balises seront remplacées automatiquement lors de la génération du document.
          </Typography>
          
          {[
            { title: 'Mission', prefix: ['<mission_', '<total_', '<tva>'] },
            { title: 'Utilisateur', prefix: ['<user_'] },
            { title: 'Entreprise', prefix: ['<entreprise_'] },
            { title: 'Notes de frais & Dépenses', prefix: ['<note_frais_', '<depense'] },
            { title: 'Heures de travail', prefix: ['<workingHours'] },
            { title: 'Avenants', prefix: ['<amendment'] },
            { title: 'Contacts', prefix: ['<contact'] },
            { title: 'Structure', prefix: ['<structure_', '<charge_'] },
          ].map(category => {
            const categoryTags = VARIABLE_TAGS.filter(tag => category.prefix.some(p => tag.tag.startsWith(p)));
            
            if (categoryTags.length === 0) return null;

            return (
              <Box key={category.title} id={`category-${category.title}`} sx={{ mb: 3, scrollMarginTop: '20px' }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'primary.main', fontWeight: 'bold', borderBottom: '1px solid #eee', pb: 0.5 }}>
                  {category.title}
                </Typography>
                <Grid container spacing={2}>
                  {categoryTags.map((tagItem) => (
                    <Grid item xs={12} sm={6} md={4} key={tagItem.tag}>
                      <Card 
                        variant="outlined" 
                        sx={{ 
                          cursor: 'pointer', 
                          '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                        onClick={() => handleCopyTag(tagItem.tag)}
                      >
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                            <Chip label={tagItem.tag} size="small" color="primary" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', height: 24 }} />
                          </Box>
                          <Typography variant="body2" fontWeight="bold" sx={{ fontSize: '0.85rem', lineHeight: 1.2, mb: 0.5 }}>{tagItem.description}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>Ex: {tagItem.example}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            );
          })}
        </DialogContent>
      </Dialog>

      <Dialog
        open={previewDialogOpen}
        onClose={() => {
          setPreviewDialogOpen(false);
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Aperçu du document</Typography>
            <IconButton
              size="small"
              onClick={() => {
                setPreviewDialogOpen(false);
                if (previewUrl) {
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Alert 
            severity="info" 
            sx={{ m: 2, mb: 1 }}
            icon={<InfoIcon />}
          >
            <Typography variant="body2">
              <strong>Note :</strong> L'aperçu peut parfois être tronqué ou ne pas refléter exactement le rendu final. 
              Pour un résultat précis, il est recommandé de tester directement avec les boutons de génération de documents.
            </Typography>
          </Alert>
          {previewUrl && (
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
              <iframe
                src={previewUrl}
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  border: 'none' 
                }}
                title="Document Preview"
              />
            </Box>
          )}
        </DialogContent>
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
    </Box>
  );
};

export default TemplatesPDF;