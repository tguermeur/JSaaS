import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  TextField,
  Stepper,
  Step,
  StepLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Chip,
  Tooltip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  CircularProgress,
  Badge,
  useTheme,
  alpha
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  AutoAwesome as AutoIcon,
  Visibility as PreviewIcon,
  Download as DownloadIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Assignment as AssignmentIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  School as SchoolIcon,
  Receipt as ReceiptIcon,
  Work as WorkIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../firebase/config';
import { collection, addDoc, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import BackButton from '../components/ui/BackButton';

// Types et interfaces
interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  detectedTags: TagMatch[];
  createdAt: Date;
  createdBy: string;
  structureId: string;
}

interface TagMatch {
  tag: string;
  variableId: string;
  category: string;
  description: string;
  example: string;
  isDetected: boolean;
  position?: {
    page?: number;
    context?: string;
  };
}

interface DocumentGenerationStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

// Bibliothèque complète des balises disponibles
export const COMPLETE_TAG_LIBRARY: TagMatch[] = [
  // === BALISES MISSION/ÉTUDE ===
  { tag: '<etude_numero>', variableId: 'numeroMission', category: 'Étude', description: 'Numéro unique de l\'étude', example: 'E2024-001', isDetected: false },
  { tag: '<etude_titre>', variableId: 'title', category: 'Étude', description: 'Titre de l\'étude', example: 'Développement application mobile', isDetected: false },
  { tag: '<etude_description>', variableId: 'missionDescription', category: 'Étude', description: 'Description détaillée de l\'étude', example: 'Développement d\'une application...', isDetected: false },
  { tag: '<etude_date_debut>', variableId: 'missionStartDate', category: 'Étude', description: 'Date de début de l\'étude', example: '01/01/2024', isDetected: false },
  { tag: '<etude_date_fin>', variableId: 'missionEndDate', category: 'Étude', description: 'Date de fin de l\'étude', example: '31/01/2024', isDetected: false },
  { tag: '<etude_lieu>', variableId: 'location', category: 'Étude', description: 'Lieu de réalisation de l\'étude', example: 'Paris', isDetected: false },
  { tag: '<etude_prix_ht>', variableId: 'priceHT', category: 'Étude', description: 'Prix HT de l\'étude', example: '5000€', isDetected: false },
  { tag: '<etude_total_ht>', variableId: 'totalHT', category: 'Étude', description: 'Montant total HT', example: '5000€', isDetected: false },
  { tag: '<etude_total_ttc>', variableId: 'totalTTC', category: 'Étude', description: 'Montant total TTC', example: '6000€', isDetected: false },
  { tag: '<etude_tva>', variableId: 'tva', category: 'Étude', description: 'Montant de la TVA', example: '1000€', isDetected: false },
  { tag: '<etude_heures_totales>', variableId: 'hours', category: 'Étude', description: 'Nombre total d\'heures', example: '200h', isDetected: false },
  { tag: '<etude_nb_etudiants>', variableId: 'studentCount', category: 'Étude', description: 'Nombre d\'étudiants assignés', example: '4', isDetected: false },
  { tag: '<etude_heures_par_etudiant>', variableId: 'hoursPerStudent', category: 'Étude', description: 'Heures par étudiant', example: '50h', isDetected: false },
  { tag: '<etude_statut>', variableId: 'status', category: 'Étude', description: 'Statut actuel de l\'étude', example: 'En cours', isDetected: false },
  { tag: '<etude_etape>', variableId: 'etape', category: 'Étude', description: 'Étape actuelle', example: 'Recrutement', isDetected: false },
  { tag: '<etude_type>', variableId: 'missionType', category: 'Étude', description: 'Type d\'étude', example: 'Développement', isDetected: false },
  { tag: '<etude_date_creation>', variableId: 'createdAt', category: 'Étude', description: 'Date de création de l\'étude', example: '01/12/2023', isDetected: false },
  { tag: '<etude_date_maj>', variableId: 'updatedAt', category: 'Étude', description: 'Date de dernière mise à jour', example: '15/01/2024', isDetected: false },
  { tag: '<date_generation_document>', variableId: 'generationDate', category: 'Étude', description: 'Date de génération du document', example: '20/01/2024', isDetected: false },

  // === BALISES CHARGÉ D'ÉTUDE ===
  { tag: '<charge_nom>', variableId: 'chargeName', category: 'Chargé d\'étude', description: 'Nom complet du chargé d\'étude', example: 'Jean Dupont', isDetected: false },
  { tag: '<charge_prenom>', variableId: 'chargeFirstName', category: 'Chargé d\'étude', description: 'Prénom du chargé d\'étude', example: 'Jean', isDetected: false },
  { tag: '<charge_nom_famille>', variableId: 'chargeLastName', category: 'Chargé d\'étude', description: 'Nom de famille du chargé d\'étude', example: 'Dupont', isDetected: false },
  { tag: '<charge_email>', variableId: 'charge_email', category: 'Chargé d\'étude', description: 'Email du chargé d\'étude', example: 'jean.dupont@structure.fr', isDetected: false },
  { tag: '<charge_telephone>', variableId: 'charge_phone', category: 'Chargé d\'étude', description: 'Téléphone du chargé d\'étude', example: '01 23 45 67 89', isDetected: false },
  { tag: '<charge_id>', variableId: 'chargeId', category: 'Chargé d\'étude', description: 'Identifiant du chargé d\'étude', example: 'CDM001', isDetected: false },

  // === BALISES ÉTUDIANT ===
  { tag: '<etudiant_nom>', variableId: 'lastName', category: 'Étudiant', description: 'Nom de famille de l\'étudiant', example: 'Martin', isDetected: false },
  { tag: '<etudiant_prenom>', variableId: 'firstName', category: 'Étudiant', description: 'Prénom de l\'étudiant', example: 'Marie', isDetected: false },
  { tag: '<etudiant_nom_complet>', variableId: 'displayName', category: 'Étudiant', description: 'Nom complet de l\'étudiant', example: 'Marie Martin', isDetected: false },
  { tag: '<etudiant_email>', variableId: 'email', category: 'Étudiant', description: 'Email de l\'étudiant', example: 'marie.martin@ecole.fr', isDetected: false },
  { tag: '<etudiant_telephone>', variableId: 'phone', category: 'Étudiant', description: 'Téléphone de l\'étudiant', example: '06 12 34 56 78', isDetected: false },
  { tag: '<etudiant_ecole>', variableId: 'ecole', category: 'Étudiant', description: 'École de l\'étudiant', example: 'École Supérieure de Commerce', isDetected: false },
  { tag: '<etudiant_formation>', variableId: 'formation', category: 'Étudiant', description: 'Formation suivie', example: 'Master Marketing Digital', isDetected: false },
  { tag: '<etudiant_programme>', variableId: 'program', category: 'Étudiant', description: 'Programme d\'études', example: 'PGE', isDetected: false },
  { tag: '<etudiant_annee_diplome>', variableId: 'graduationYear', category: 'Étudiant', description: 'Année de diplômation', example: '2024', isDetected: false },
  { tag: '<etudiant_adresse>', variableId: 'address', category: 'Étudiant', description: 'Adresse de l\'étudiant', example: '123 rue de la Paix', isDetected: false },
  { tag: '<etudiant_ville>', variableId: 'city', category: 'Étudiant', description: 'Ville de résidence', example: 'Paris', isDetected: false },
  { tag: '<etudiant_nationalite>', variableId: 'nationality', category: 'Étudiant', description: 'Nationalité', example: 'Française', isDetected: false },
  { tag: '<etudiant_genre>', variableId: 'gender', category: 'Étudiant', description: 'Genre', example: 'F', isDetected: false },
  { tag: '<etudiant_date_naissance>', variableId: 'birthDate', category: 'Étudiant', description: 'Date de naissance', example: '15/03/2000', isDetected: false },
  { tag: '<etudiant_lieu_naissance>', variableId: 'birthPlace', category: 'Étudiant', description: 'Lieu de naissance', example: 'Lyon', isDetected: false },
  { tag: '<etudiant_numero_securite_sociale>', variableId: 'socialSecurityNumber', category: 'Étudiant', description: 'Numéro de sécurité sociale', example: '2 00 03 75 123 456 78', isDetected: false },
  { tag: '<etudiant_id>', variableId: 'studentId', category: 'Étudiant', description: 'Identifiant étudiant', example: 'ETU2024001', isDetected: false },
  { tag: '<etudiant_niveau_etudes>', variableId: 'studyLevel', category: 'Étudiant', description: 'Niveau d\'études', example: 'Master 2', isDetected: false },
  { tag: '<etudiant_specialite>', variableId: 'speciality', category: 'Étudiant', description: 'Spécialité', example: 'Marketing Digital', isDetected: false },

  // === BALISES ENTREPRISE ===
  { tag: '<entreprise_nom>', variableId: 'companyName', category: 'Entreprise', description: 'Nom de l\'entreprise', example: 'TechCorp SARL', isDetected: false },
  { tag: '<entreprise_raison_sociale>', variableId: 'companyName', category: 'Entreprise', description: 'Raison sociale', example: 'TechCorp SARL', isDetected: false },
  { tag: '<entreprise_nsiret>', variableId: 'nSiret', category: 'Entreprise', description: 'Numéro nSiret', example: '12345678901234', isDetected: false },
  { tag: '<entreprise_siren>', variableId: 'siren', category: 'Entreprise', description: 'Numéro SIREN', example: '123456789', isDetected: false },
  { tag: '<entreprise_adresse>', variableId: 'companyAddress', category: 'Entreprise', description: 'Adresse de l\'entreprise', example: '456 Avenue des Affaires', isDetected: false },
  { tag: '<entreprise_ville>', variableId: 'companyCity', category: 'Entreprise', description: 'Ville du siège', example: 'Paris', isDetected: false },
  { tag: '<entreprise_code_postal>', variableId: 'companyPostalCode', category: 'Entreprise', description: 'Code postal', example: '75001', isDetected: false },
  { tag: '<entreprise_pays>', variableId: 'country', category: 'Entreprise', description: 'Pays', example: 'France', isDetected: false },
  { tag: '<entreprise_telephone>', variableId: 'companyPhone', category: 'Entreprise', description: 'Téléphone de l\'entreprise', example: '01 23 45 67 89', isDetected: false },
  { tag: '<entreprise_email>', variableId: 'companyEmail', category: 'Entreprise', description: 'Email de l\'entreprise', example: 'contact@techcorp.fr', isDetected: false },
  { tag: '<entreprise_site_web>', variableId: 'website', category: 'Entreprise', description: 'Site web', example: 'www.techcorp.fr', isDetected: false },
  { tag: '<entreprise_description>', variableId: 'companyDescription', category: 'Entreprise', description: 'Description de l\'entreprise', example: 'Société spécialisée en...', isDetected: false },
  { tag: '<entreprise_secteur>', variableId: 'sector', category: 'Entreprise', description: 'Secteur d\'activité', example: 'Technologies', isDetected: false },
  { tag: '<entreprise_taille>', variableId: 'size', category: 'Entreprise', description: 'Taille de l\'entreprise', example: 'PME', isDetected: false },

  // === BALISES CONTACT ENTREPRISE ===
  { tag: '<contact_nom>', variableId: 'contact_lastName', category: 'Contact', description: 'Nom du contact', example: 'Dubois', isDetected: false },
  { tag: '<contact_prenom>', variableId: 'contact_firstName', category: 'Contact', description: 'Prénom du contact', example: 'Pierre', isDetected: false },
  { tag: '<contact_nom_complet>', variableId: 'contact_fullName', category: 'Contact', description: 'Nom complet du contact', example: 'Pierre Dubois', isDetected: false },
  { tag: '<contact_email>', variableId: 'contact_email', category: 'Contact', description: 'Email du contact', example: 'pierre.dubois@techcorp.fr', isDetected: false },
  { tag: '<contact_telephone>', variableId: 'contact_phone', category: 'Contact', description: 'Téléphone du contact', example: '01 23 45 67 90', isDetected: false },
  { tag: '<contact_poste>', variableId: 'contact_position', category: 'Contact', description: 'Poste occupé', example: 'Directeur Technique', isDetected: false },
  { tag: '<contact_linkedin>', variableId: 'contact_linkedin', category: 'Contact', description: 'Profil LinkedIn', example: 'linkedin.com/in/pierre-dubois', isDetected: false },

  // === BALISES STRUCTURE ===
  { tag: '<structure_nom>', variableId: 'structure_name', category: 'Structure', description: 'Nom de la structure', example: 'Junior Entreprise XYZ', isDetected: false },
  { tag: '<structure_siret>', variableId: 'structure_siret', category: 'Structure', description: 'SIRET de la structure', example: '98765432109876', isDetected: false },
  { tag: '<structure_adresse>', variableId: 'structure_address', category: 'Structure', description: 'Adresse de la structure', example: '789 Rue de l\'École', isDetected: false },
  { tag: '<structure_ville>', variableId: 'structure_city', category: 'Structure', description: 'Ville de la structure', example: 'Lyon', isDetected: false },
  { tag: '<structure_code_postal>', variableId: 'structure_postalCode', category: 'Structure', description: 'Code postal de la structure', example: '69000', isDetected: false },
  { tag: '<structure_pays>', variableId: 'structure_country', category: 'Structure', description: 'Pays de la structure', example: 'France', isDetected: false },
  { tag: '<structure_telephone>', variableId: 'structure_phone', category: 'Structure', description: 'Téléphone de la structure', example: '04 78 90 12 34', isDetected: false },
  { tag: '<structure_email>', variableId: 'structure_email', category: 'Structure', description: 'Email de la structure', example: 'contact@je-xyz.fr', isDetected: false },
  { tag: '<structure_site_web>', variableId: 'structure_website', category: 'Structure', description: 'Site web de la structure', example: 'www.je-xyz.fr', isDetected: false },
  { tag: '<structure_tva>', variableId: 'structure_tvaNumber', category: 'Structure', description: 'Numéro de TVA', example: 'FR12345678901', isDetected: false },
  { tag: '<structure_ape>', variableId: 'structure_apeCode', category: 'Structure', description: 'Code APE', example: '7022Z', isDetected: false },

  // === BALISES NOTES DE FRAIS ===
  { tag: '<frais_montant>', variableId: 'expenseAmount', category: 'Frais', description: 'Montant des frais', example: '150.50€', isDetected: false },
  { tag: '<frais_description>', variableId: 'expenseDescription', category: 'Frais', description: 'Description des frais', example: 'Transport et hébergement', isDetected: false },
  { tag: '<frais_date>', variableId: 'expenseDate', category: 'Frais', description: 'Date des frais', example: '15/01/2024', isDetected: false },
  { tag: '<frais_statut>', variableId: 'expenseStatus', category: 'Frais', description: 'Statut de la note de frais', example: 'Validée', isDetected: false },
  { tag: '<frais_type>', variableId: 'expenseType', category: 'Frais', description: 'Type de frais', example: 'Transport', isDetected: false },

  // === BALISES HEURES DE TRAVAIL ===
  { tag: '<heures_date>', variableId: 'workingHoursDate', category: 'Heures', description: 'Date des heures travaillées', example: '15/01/2024', isDetected: false },
  { tag: '<heures_debut>', variableId: 'startTime', category: 'Heures', description: 'Heure de début', example: '09:00', isDetected: false },
  { tag: '<heures_fin>', variableId: 'endTime', category: 'Heures', description: 'Heure de fin', example: '17:30', isDetected: false },
  { tag: '<heures_pause>', variableId: 'breaks', category: 'Heures', description: 'Durée des pauses', example: '1h00', isDetected: false },
  { tag: '<heures_total>', variableId: 'totalHours', category: 'Heures', description: 'Total des heures travaillées', example: '7h30', isDetected: false },

  // === BALISES AVENANTS ===
  { tag: '<avenant_numero>', variableId: 'amendmentNumber', category: 'Avenant', description: 'Numéro d\'avenant', example: 'AV001', isDetected: false },
  { tag: '<avenant_date>', variableId: 'amendmentDate', category: 'Avenant', description: 'Date de l\'avenant', example: '20/01/2024', isDetected: false },
  { tag: '<avenant_motif>', variableId: 'amendmentReason', category: 'Avenant', description: 'Motif de l\'avenant', example: 'Extension de délai', isDetected: false },
  { tag: '<avenant_nouvelle_date_fin>', variableId: 'amendmentNewEndDate', category: 'Avenant', description: 'Nouvelle date de fin', example: '15/02/2024', isDetected: false },
  { tag: '<avenant_heures_supplementaires>', variableId: 'amendmentAdditionalHours', category: 'Avenant', description: 'Heures supplémentaires', example: '20h', isDetected: false },

  // === BALISES FACTURATIONS ===
  { tag: '<facture_numero>', variableId: 'invoiceNumber', category: 'Facturation', description: 'Numéro de facture', example: 'FAC-2024-001', isDetected: false },
  { tag: '<facture_date>', variableId: 'invoiceDate', category: 'Facturation', description: 'Date de facture', example: '31/01/2024', isDetected: false },
  { tag: '<facture_echeance>', variableId: 'invoiceDueDate', category: 'Facturation', description: 'Date d\'échéance', example: '28/02/2024', isDetected: false },
  { tag: '<facture_montant_ht>', variableId: 'invoiceAmountHT', category: 'Facturation', description: 'Montant HT de la facture', example: '5000€', isDetected: false },
  { tag: '<facture_montant_ttc>', variableId: 'invoiceAmountTTC', category: 'Facturation', description: 'Montant TTC de la facture', example: '6000€', isDetected: false },
  { tag: '<facture_tva>', variableId: 'invoiceTVA', category: 'Facturation', description: 'Montant de la TVA', example: '1000€', isDetected: false },

  // === BALISES SYSTÈME ===
  { tag: '<aujourd_hui>', variableId: 'currentDate', category: 'Système', description: 'Date du jour', example: '25/01/2024', isDetected: false },
  { tag: '<heure_actuelle>', variableId: 'currentTime', category: 'Système', description: 'Heure actuelle', example: '14:30', isDetected: false },
  { tag: '<annee_actuelle>', variableId: 'currentYear', category: 'Système', description: 'Année en cours', example: '2024', isDetected: false },
  { tag: '<mois_actuel>', variableId: 'currentMonth', category: 'Système', description: 'Mois en cours', example: 'Janvier', isDetected: false }
];

const DocumentGenerator: React.FC = () => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // États principaux
  const [activeStep, setActiveStep] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedTags, setDetectedTags] = useState<TagMatch[]>([]);
  const [filteredTags, setFilteredTags] = useState<TagMatch[]>(COMPLETE_TAG_LIBRARY);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [documentTemplate, setDocumentTemplate] = useState<DocumentTemplate | null>(null);
  
  // États pour les alertes et notifications
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Étapes du processus
  const steps: DocumentGenerationStep[] = [
    {
      id: 0,
      title: 'Import du document',
      description: 'Importez votre document (PDF, Word, PowerPoint)',
      completed: false
    },
    {
      id: 1,
      title: 'Détection des balises',
      description: 'Analyse automatique et détection des balises dans votre document',
      completed: false
    },
    {
      id: 2,
      title: 'Configuration',
      description: 'Vérifiez et configurez les balises détectées',
      completed: false
    },
    {
      id: 3,
      title: 'Prévisualisation',
      description: 'Prévisualisez le résultat avec des données d\'exemple',
      completed: false
    },
    {
      id: 4,
      title: 'Finalisation',
      description: 'Enregistrez votre template pour utilisation future',
      completed: false
    }
  ];

  // Catégories disponibles
  const categories = [
    { id: 'all', label: 'Toutes les catégories', icon: <FilterIcon /> },
    { id: 'Étude', label: 'Étude/Mission', icon: <AssignmentIcon /> },
    { id: 'Étudiant', label: 'Étudiant', icon: <SchoolIcon /> },
    { id: 'Entreprise', label: 'Entreprise', icon: <BusinessIcon /> },
    { id: 'Contact', label: 'Contact', icon: <PersonIcon /> },
    { id: 'Structure', label: 'Structure', icon: <WorkIcon /> },
    { id: 'Frais', label: 'Notes de frais', icon: <ReceiptIcon /> },
    { id: 'Heures', label: 'Heures de travail', icon: <WorkIcon /> },
    { id: 'Avenant', label: 'Avenants', icon: <EditIcon /> },
    { id: 'Facturation', label: 'Facturation', icon: <ReceiptIcon /> },
    { id: 'Système', label: 'Système', icon: <InfoIcon /> }
  ];

  // Filtrage des balises
  useEffect(() => {
    let filtered = COMPLETE_TAG_LIBRARY;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(tag => tag.category === selectedCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter(tag => 
        tag.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tag.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tag.example.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredTags(filtered);
  }, [searchTerm, selectedCategory]);

  // Gestion de l'upload de fichier
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint'
    ];

    if (!allowedTypes.includes(file.type)) {
      setSnackbar({
        open: true,
        message: 'Type de fichier non supporté. Veuillez utiliser un fichier PDF, Word ou PowerPoint.',
        severity: 'error'
      });
      return;
    }

    setSelectedFile(file);
    setActiveStep(1);
    analyzeDocument(file);
  };

  // Analyse automatique du document
  const analyzeDocument = async (file: File) => {
    setIsAnalyzing(true);
    setUploadProgress(0);

    try {
      // Simulation de l'upload avec progress
      const uploadInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(uploadInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Upload du fichier vers Firebase Storage
      const fileName = `${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `document-templates/${fileName}`);
      await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(storageRef);

      setUploadProgress(100);

      // Simulation de l'analyse du contenu (ici on simule la détection)
      setTimeout(() => {
        const simulatedDetectedTags = simulateTagDetection(file.name);
        setDetectedTags(simulatedDetectedTags);
        setActiveStep(2);
        setIsAnalyzing(false);
        
        setSnackbar({
          open: true,
          message: `Analyse terminée ! ${simulatedDetectedTags.length} balises détectées.`,
          severity: 'success'
        });
      }, 1500);

    } catch (error) {
      console.error('Erreur lors de l\'analyse:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de l\'analyse du document.',
        severity: 'error'
      });
      setIsAnalyzing(false);
    }
  };

  // Simulation de la détection de balises (à remplacer par une vraie analyse)
  const simulateTagDetection = (fileName: string): TagMatch[] => {
    // Simulation basée sur le nom du fichier
    const detected: TagMatch[] = [];
    
    if (fileName.toLowerCase().includes('convention') || fileName.toLowerCase().includes('contrat')) {
      // Balises typiques pour une convention
      detected.push(
        { ...COMPLETE_TAG_LIBRARY.find(tag => tag.tag === '<etudiant_nom>')!, isDetected: true },
        { ...COMPLETE_TAG_LIBRARY.find(tag => tag.tag === '<etudiant_prenom>')!, isDetected: true },
        { ...COMPLETE_TAG_LIBRARY.find(tag => tag.tag === '<entreprise_nom>')!, isDetected: true },
        { ...COMPLETE_TAG_LIBRARY.find(tag => tag.tag === '<etude_titre>')!, isDetected: true },
        { ...COMPLETE_TAG_LIBRARY.find(tag => tag.tag === '<etude_date_debut>')!, isDetected: true },
        { ...COMPLETE_TAG_LIBRARY.find(tag => tag.tag === '<etude_date_fin>')!, isDetected: true },
        { ...COMPLETE_TAG_LIBRARY.find(tag => tag.tag === '<structure_nom>')!, isDetected: true }
      );
    } else if (fileName.toLowerCase().includes('facture')) {
      // Balises typiques pour une facture
      detected.push(
        { ...COMPLETE_TAG_LIBRARY.find(tag => tag.tag === '<facture_numero>')!, isDetected: true },
        { ...COMPLETE_TAG_LIBRARY.find(tag => tag.tag === '<entreprise_nom>')!, isDetected: true },
        { ...COMPLETE_TAG_LIBRARY.find(tag => tag.tag === '<etude_total_ht>')!, isDetected: true },
        { ...COMPLETE_TAG_LIBRARY.find(tag => tag.tag === '<etude_total_ttc>')!, isDetected: true },
        { ...COMPLETE_TAG_LIBRARY.find(tag => tag.tag === '<aujourd_hui>')!, isDetected: true }
      );
    } else {
      // Détection générique
      detected.push(
        { ...COMPLETE_TAG_LIBRARY.find(tag => tag.tag === '<etude_titre>')!, isDetected: true },
        { ...COMPLETE_TAG_LIBRARY.find(tag => tag.tag === '<entreprise_nom>')!, isDetected: true },
        { ...COMPLETE_TAG_LIBRARY.find(tag => tag.tag === '<aujourd_hui>')!, isDetected: true }
      );
    }

    return detected.filter(tag => tag !== undefined);
  };

  // Copier une balise dans le presse-papier
  const copyTagToClipboard = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setSnackbar({
      open: true,
      message: `Balise ${tag} copiée !`,
      severity: 'success'
    });
  };

  // Rendu du contenu selon l'étape active
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return renderUploadStep();
      case 1:
        return renderAnalysisStep();
      case 2:
        return renderConfigurationStep();
      case 3:
        return renderPreviewStep();
      case 4:
        return renderFinalizationStep();
      default:
        return renderUploadStep();
    }
  };

  // Étape 1: Upload
  const renderUploadStep = () => (
    <Card>
      <CardContent sx={{ textAlign: 'center', py: 6 }}>
        <UploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Importez votre document
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Glissez-déposez votre document ou cliquez pour le sélectionner
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Formats supportés : PDF, Word (.docx), PowerPoint (.pptx)
        </Typography>
        
        <Button
          variant="contained"
          size="large"
          startIcon={<UploadIcon />}
          onClick={() => fileInputRef.current?.click()}
          sx={{ mt: 2 }}
        >
          Choisir un fichier
        </Button>
        
        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept=".pdf,.docx,.doc,.pptx,.ppt"
          onChange={handleFileSelect}
        />
      </CardContent>
    </Card>
  );

  // Étape 2: Analyse
  const renderAnalysisStep = () => (
    <Card>
      <CardContent sx={{ textAlign: 'center', py: 6 }}>
        {isAnalyzing ? (
          <>
            <AutoIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Analyse en cours...
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Nous analysons votre document "{selectedFile?.name}" pour détecter automatiquement les balises.
            </Typography>
            
            <Box sx={{ width: '100%', maxWidth: 400, mx: 'auto', mt: 3 }}>
              <LinearProgress 
                variant="determinate" 
                value={uploadProgress} 
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="body2" sx={{ mt: 1 }}>
                {uploadProgress}% - {uploadProgress < 90 ? 'Upload en cours...' : 'Analyse du contenu...'}
              </Typography>
            </Box>
          </>
        ) : (
          <>
            <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Analyse terminée !
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {detectedTags.length} balises détectées dans votre document.
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  );

  // Étape 3: Configuration
  const renderConfigurationStep = () => (
    <Grid container spacing={3}>
      {/* Balises détectées */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckIcon color="success" />
              Balises détectées ({detectedTags.length})
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Ces balises ont été automatiquement détectées dans votre document.
            </Typography>
            
            {detectedTags.length > 0 ? (
              <List>
                {detectedTags.map((tag, index) => (
                  <ListItem key={index} divider>
                    <ListItemIcon>
                      <CheckIcon color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1" component="code" sx={{ 
                            bgcolor: 'grey.100', 
                            px: 1, 
                            py: 0.5, 
                            borderRadius: 1,
                            fontFamily: 'monospace'
                          }}>
                            {tag.tag}
                          </Typography>
                          <IconButton size="small" onClick={() => copyTagToClipboard(tag.tag)}>
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2">{tag.description}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Exemple: {tag.example}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Alert severity="info">
                Aucune balise détectée automatiquement. Vous pouvez en ajouter manuellement depuis la bibliothèque.
              </Alert>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Bibliothèque de balises */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Bibliothèque de balises
            </Typography>
            
            {/* Filtres */}
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Rechercher une balise..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                sx={{ mb: 2 }}
              />
              
              <FormControl fullWidth size="small">
                <InputLabel>Catégorie</InputLabel>
                <Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  label="Catégorie"
                >
                  {categories.map(category => (
                    <MenuItem key={category.id} value={category.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {category.icon}
                        {category.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Liste des balises filtrées */}
            <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
              {filteredTags.map((tag, index) => (
                <Accordion key={index} sx={{ mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                      <Chip 
                        label={tag.category} 
                        size="small" 
                        color="primary" 
                        variant="outlined" 
                      />
                      <Typography variant="body2" component="code" sx={{ 
                        fontFamily: 'monospace',
                        flex: 1
                      }}>
                        {tag.tag}
                      </Typography>
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          copyTagToClipboard(tag.tag);
                        }}
                      >
                        <CopyIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" paragraph>
                      {tag.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      <strong>Exemple:</strong> {tag.example}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  // Étape 4: Prévisualisation
  const renderPreviewStep = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Prévisualisation avec données d'exemple
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          Cette prévisualisation montre comment vos balises seront remplacées par de vraies données.
        </Alert>
        
        <Button
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={() => setActiveStep(4)}
          sx={{ mr: 2 }}
        >
          Valider et continuer
        </Button>
        <Button
          variant="outlined"
          startIcon={<PreviewIcon />}
        >
          Télécharger l'aperçu
        </Button>
      </CardContent>
    </Card>
  );

  // Étape 5: Finalisation
  const renderFinalizationStep = () => (
    <Card>
      <CardContent sx={{ textAlign: 'center', py: 6 }}>
        <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Template créé avec succès !
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Votre template est maintenant prêt à être utilisé pour générer des documents automatiquement.
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 3 }}>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
          >
            Télécharger le template
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setActiveStep(0);
              setSelectedFile(null);
              setDetectedTags([]);
            }}
          >
            Créer un nouveau template
          </Button>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      <BackButton />
      
      {/* En-tête */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Générateur de documents
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Créez des templates de documents intelligents avec des balises automatiques
        </Typography>
      </Box>

      {/* Stepper */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((step) => (
              <Step key={step.id}>
                <StepLabel>
                  <Typography variant="body2">{step.title}</Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      {/* Contenu de l'étape active */}
      {renderStepContent()}

      {/* Guide des balises (toujours visible) */}
      {activeStep >= 2 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📖 Guide d'utilisation des balises
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Alert severity="info">
                  <Typography variant="subtitle2" gutterBottom>
                    Comment utiliser les balises
                  </Typography>
                  <Typography variant="body2">
                    Placez les balises directement dans votre document à l'endroit où vous voulez que les données apparaissent.
                  </Typography>
                </Alert>
              </Grid>
              <Grid item xs={12} md={4}>
                <Alert severity="success">
                  <Typography variant="subtitle2" gutterBottom>
                    Exemple pratique
                  </Typography>
                  <Typography variant="body2">
                    "Bonjour &lt;etudiant_prenom&gt; &lt;etudiant_nom&gt;" devient "Bonjour Marie Martin"
                  </Typography>
                </Alert>
              </Grid>
              <Grid item xs={12} md={4}>
                <Alert severity="warning">
                  <Typography variant="subtitle2" gutterBottom>
                    Important
                  </Typography>
                  <Typography variant="body2">
                    Respectez exactement la syntaxe des balises avec les crochets &lt; &gt;
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Snackbar pour les notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DocumentGenerator;

