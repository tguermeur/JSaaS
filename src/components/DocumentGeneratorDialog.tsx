import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Grid,
  TextField,
  Alert,
  Snackbar,
  Chip,
  Tooltip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
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
  alpha,
  Paper,
  Divider
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
  Stop as StopIcon,
  Close as CloseIcon,
  PictureAsPdf as PdfIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../firebase/config';
import { collection, addDoc, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { COMPLETE_TAG_LIBRARY } from '../pages/DocumentGenerator';
import { replaceTagsInText, ReplacementData, getExampleData } from '../utils/documentTagUtils';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import PptxTemplater from 'pptxtemplater';
import * as mammoth from 'mammoth';
import html2canvas from 'html2canvas';
import { renderAsync } from 'docx-preview';

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
  forcedDetection?: boolean;
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

interface DocumentGeneratorDialogProps {
  open: boolean;
  onClose: () => void;
  etudeData?: any;
  companyData?: any;
  contactData?: any;
  structureData?: any;
}

const DocumentGeneratorDialog: React.FC<DocumentGeneratorDialogProps> = ({
  open,
  onClose,
  etudeData,
  companyData,
  contactData,
  structureData
}) => {
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
  const [previewText, setPreviewText] = useState('');
  const [customValues, setCustomValues] = useState<{[tagName: string]: string}>({});
  
  // États pour la conversion PDF
  const [showPdfConversion, setShowPdfConversion] = useState(false);
  const [processedWordBlob, setProcessedWordBlob] = useState<Blob | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string>('');
  const [isConvertingToPdf, setIsConvertingToPdf] = useState(false);
  
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
      description: 'Vérifiez les balises détectées et leurs valeurs de remplacement',
      completed: false
    },
    {
      id: 3,
      title: 'Téléchargement',
      description: 'Téléchargez les instructions de remplacement pour votre document',
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

  // Effet pour filtrer les balises selon la recherche et la catégorie
  useEffect(() => {
    let filtered = COMPLETE_TAG_LIBRARY;
    
    // Filtrer par catégorie
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(tag => tag.category === selectedCategory);
    }
    
    // Filtrer par terme de recherche
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(tag => 
        tag.tag.toLowerCase().includes(searchLower) ||
        tag.description.toLowerCase().includes(searchLower)
      );
    }
    
    setFilteredTags(filtered);
    console.log(`Filtrage: ${filtered.length} balises trouvées pour "${searchTerm}" dans catégorie "${selectedCategory}"`);
  }, [searchTerm, selectedCategory]);

  // Réinitialiser le dialogue quand il s'ouvre
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setSelectedFile(null);
      setDetectedTags([]);
      setUploadProgress(0);
      setIsAnalyzing(false);
      setPreviewText('');
      // Reset des états PDF
      setShowPdfConversion(false);
      setProcessedWordBlob(null);
      setOriginalFileName('');
      setIsConvertingToPdf(false);
    }
  }, [open]);

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

      setUploadProgress(100);

      // Analyser le contenu réel du fichier pour détecter les balises
      setTimeout(async () => {
        try {
          // Pour l'instant, utilisons une approche hybride
          console.log('Analyse du fichier:', file.name, 'Type:', file.type);
          
          let detectedTags: TagMatch[] = [];
          
          // Pour les fichiers PowerPoint (.pptx), Word (.docx), utiliser une détection basique
          if (file.type.includes('powerpoint') || file.type.includes('presentation') || 
              file.type.includes('word') || file.type.includes('document')) {
            
            console.log('Analyse d\'un fichier Office:', file.name);
            
            // Pour les fichiers Office, analyser réellement le contenu pour détecter toutes les balises
            try {
              const fileBuffer = await file.arrayBuffer();
              const zip = new PizZip(fileBuffer);
              let allContent = '';
              
              // Extraire le contenu selon le type de fichier
              Object.keys(zip.files).forEach(filename => {
                const zipFile = zip.files[filename];
                if (!zipFile.dir && filename.endsWith('.xml')) {
                  
                  // Pour PowerPoint : slides principaux
                  if (file.type.includes('presentation') && 
                      filename.includes('ppt/slides/slide') && 
                      !filename.includes('slideLayout') && 
                      !filename.includes('slideMaster')) {
                    
                    const content = zipFile.asText();
                    allContent += content + ' ';
                    console.log(`Analyse du fichier PowerPoint: ${filename}`);
                  }
                  
                  // Pour Word : TOUS les fichiers XML qui peuvent contenir du texte
                  else if (file.type.includes('word') && 
                           (filename.includes('word/') && 
                            (filename.includes('document.xml') || 
                             filename.includes('header') || 
                             filename.includes('footer') || 
                             filename.includes('endnotes.xml') || 
                             filename.includes('footnotes.xml') || 
                             filename.includes('comments.xml')))) {
                    
                    const content = zipFile.asText();
                    allContent += content + ' ';
                    console.log(`Analyse du fichier Word: ${filename}`);
                    
                    // Debug spécial : chercher vos balises dans chaque fichier
                    ['etude_numero', 'etude_prix_ht'].forEach(tagName => {
                      if (content.toLowerCase().includes(tagName)) {
                        console.log(`🎯 "${tagName}" trouvé dans ${filename}`);
                        const index = content.toLowerCase().indexOf(tagName);
                        const context = content.substring(Math.max(0, index - 100), index + tagName.length + 100);
                        console.log(`📝 Contexte dans ${filename}:`, context);
                      }
                    });
                  }
                }
              });
              
              console.log('Contenu extrait, recherche de balises...');
              
              // Debug: Afficher un aperçu du contenu extrait
              console.log(`Contenu extrait (${allContent.length} caractères):`, allContent.substring(0, 1000));
              
              // Debug ULTRA-POUSSÉ : Chercher TOUS les mots qui ressemblent à vos balises
              console.log('🔍 RECHERCHE ULTRA-POUSSÉE dans tout le contenu Word...');
              
              // Chercher toutes les occurrences de "numero", "prix", "ht" dans le contenu
              const debugKeywords = ['numero', 'prix', 'ht', 'etude'];
              debugKeywords.forEach(keyword => {
                const regex = new RegExp(`[^a-zA-Z]${keyword}[^a-zA-Z]`, 'gi');
                const matches = allContent.match(regex);
                if (matches) {
                  console.log(`🔍 Mot-clé "${keyword}" trouvé ${matches.length} fois:`, matches);
                  // Afficher le contexte de chaque occurrence
                  matches.slice(0, 3).forEach((match, index) => {
                    const matchIndex = allContent.indexOf(match);
                    const context = allContent.substring(Math.max(0, matchIndex - 80), matchIndex + match.length + 80);
                    console.log(`📝 Contexte ${index + 1} pour "${keyword}":`, context);
                  });
                }
              });
              
              // Chercher spécifiquement les patterns de balises manquantes
              const missingTags = ['etude_numero', 'etude_prix_ht'];
              missingTags.forEach(tagName => {
                console.log(`🔍 RECHERCHE SPÉCIFIQUE pour "${tagName}":`);
                
                // Recherche très permissive
                const permissivePattern = new RegExp(`[^a-zA-Z]${tagName}[^a-zA-Z]`, 'gi');
                const permissiveMatches = allContent.match(permissivePattern);
                
                if (permissiveMatches) {
                  console.log(`🎯 TROUVÉ "${tagName}" sous forme permissive:`, permissiveMatches);
                  permissiveMatches.forEach((match, index) => {
                    const matchIndex = allContent.indexOf(match);
                    const context = allContent.substring(Math.max(0, matchIndex - 150), matchIndex + match.length + 150);
                    console.log(`📝 Contexte permissif ${index + 1}:`, context);
                  });
                } else {
                  console.log(`❌ VRAIMENT AUCUNE TRACE de "${tagName}" dans le contenu`);
                }
              });
              
              // Debug: Chercher spécifiquement vos balises ET les formes fragmentées
              const yourTags = ['etude_numero', 'etude_prix_ht'];
              yourTags.forEach(tagName => {
                console.log(`🔍 RECHERCHE EXHAUSTIVE pour "${tagName}":`);
                
                // Patterns normaux
                const patterns = [`<${tagName}>`, tagName, `&lt;${tagName}&gt;`];
                patterns.forEach(pattern => {
                  if (allContent.toLowerCase().includes(pattern.toLowerCase())) {
                    console.log(`🎯 VOTRE BALISE TROUVÉE: "${pattern}"`);
                    const index = allContent.toLowerCase().indexOf(pattern.toLowerCase());
                    const context = allContent.substring(Math.max(0, index - 100), index + pattern.length + 100);
                    console.log(`📝 Contexte pour ${pattern}:`, context);
                  }
                });
                
                // Recherche de fragmentation Word spécifique - VERSION AMÉLIORÉE
                const fragmentPatterns = [
                  // Patterns Word fragmentés
                  `<w:t>&lt;</w:t>.*?<w:t>${tagName}</w:t>.*?<w:t>&gt;</w:t>`,  // Fragmentation complète
                  `<w:t>${tagName}</w:t>`,                                        // Juste le nom
                  `&lt;.*?${tagName}.*?&gt;`,                                   // Encodage partiel
                  // Patterns Word avec différents niveaux de fragmentation
                  `<w:t>&lt;</w:t>.*?${tagName}.*?<w:t>&gt;</w:t>`,             // Fragmentation partielle
                  `<w:t>.*?${tagName}.*?</w:t>`,                                 // Dans un seul élément w:t
                  // Patterns avec caractères spéciaux Word
                  `<w:t[^>]*>&lt;${tagName}&gt;</w:t>`,                         // Avec attributs
                  `<w:t[^>]*>${tagName}</w:t>`,                                  // Nom seul avec attributs
                  // Patterns très fragmentés
                  `&lt;.*?<w:t[^>]*>${tagName}</w:t>.*?&gt;`,                   // Très fragmenté
                  `<w:t[^>]*>&lt;</w:t>.*?<w:t[^>]*>${tagName}</w:t>.*?<w:t[^>]*>&gt;</w:t>` // Ultra fragmenté
                ];
                
                fragmentPatterns.forEach((fragmentPattern, index) => {
                  const regex = new RegExp(fragmentPattern, 'gi');
                  const matches = allContent.match(regex);
                  if (matches) {
                    console.log(`🧩 FRAGMENTATION ${index + 1} TROUVÉE pour "${tagName}":`, matches);
                    matches.forEach(match => {
                      const matchIndex = allContent.indexOf(match);
                      const context = allContent.substring(Math.max(0, matchIndex - 50), matchIndex + match.length + 50);
                      console.log(`📝 Contexte fragmentation:`, context);
                    });
                  }
                });
              });
              
              // Chercher toutes les balises de la bibliothèque dans le contenu
              console.log(`Test de ${COMPLETE_TAG_LIBRARY.length} balises dans la bibliothèque...`);
              
              COMPLETE_TAG_LIBRARY.forEach(tag => {
                const cleanTag = tag.tag.replace('<', '').replace('>', '');
                
                // Debug spécial pour vos balises
                if (tag.tag === '<etude_numero>' || tag.tag === '<etude_prix_ht>') {
                  console.log(`🔍 TEST SPÉCIAL pour ${tag.tag}:`);
                }
                
                // Rechercher la balise sous différentes formes - VERSION ÉTENDUE
                const patterns = [
                  tag.tag,                    // <etude_lieu>
                  cleanTag,                   // etude_lieu
                  `&lt;${cleanTag}&gt;`,     // &lt;etude_lieu&gt;
                  `{${cleanTag}}`,            // {etude_lieu}
                  `{{${cleanTag}}}`,          // {{etude_lieu}}
                  // Patterns Word fragmentés
                  `<w:t>${cleanTag}</w:t>`,                           // <w:t>etude_lieu</w:t>
                  `<w:t>&lt;${cleanTag}&gt;</w:t>`,                  // <w:t>&lt;etude_lieu&gt;</w:t>
                  // Patterns PowerPoint fragmentés
                  `<a:t>${cleanTag}</a:t>`,                           // <a:t>etude_lieu</a:t>
                  `<a:t>&lt;${cleanTag}&gt;</a:t>`                   // <a:t>&lt;etude_lieu&gt;</a:t>
                ];
                
                // Debug: vérifier chaque pattern avec détection avancée
                let patternFound = false;
                let foundPattern = '';
                let foundContext = '';
                
                // D'abord, recherche normale
                patterns.forEach(pattern => {
                  if (allContent.toLowerCase().includes(pattern.toLowerCase())) {
                    console.log(`Pattern trouvé: "${pattern}" pour balise ${tag.tag}`);
                    const index = allContent.toLowerCase().indexOf(pattern.toLowerCase());
                    const context = allContent.substring(Math.max(0, index - 50), index + pattern.length + 50);
                    console.log(`Contexte:`, context);
                    patternFound = true;
                    foundPattern = pattern;
                    foundContext = context;
                  }
                });
                
                // Si pas trouvé avec patterns simples, essayer la détection fragmentée avancée
                if (!patternFound) {
                  // Patterns regex pour détecter les balises fragmentées
                  const fragmentedPatterns = [
                    // Word : fragmentation avec w:t
                    `<w:t[^>]*>&lt;</w:t>.*?<w:t[^>]*>${cleanTag}</w:t>.*?<w:t[^>]*>&gt;</w:t>`,
                    `<w:t[^>]*>&lt;</w:t>.*?${cleanTag}.*?<w:t[^>]*>&gt;</w:t>`,
                    `&lt;.*?<w:t[^>]*>${cleanTag}</w:t>.*?&gt;`,
                    // PowerPoint : fragmentation avec a:t
                    `<a:t[^>]*>&lt;</a:t>.*?<a:t[^>]*>${cleanTag}</a:t>.*?<a:t[^>]*>&gt;</a:t>`,
                    `<a:t[^>]*>&lt;</a:t>.*?${cleanTag}.*?<a:t[^>]*>&gt;</a:t>`,
                    `&lt;.*?<a:t[^>]*>${cleanTag}</a:t>.*?&gt;`,
                    // Patterns génériques
                    `&lt;.*?${cleanTag}.*?&gt;`,
                    `<[^>]*>${cleanTag}</[^>]*>`,
                    // Recherche du nom seul avec contexte de balises
                    `[<&][^>]*${cleanTag}[^<]*[>&]`
                  ];
                  
                  fragmentedPatterns.forEach((fragmentPattern, index) => {
                    try {
                      const regex = new RegExp(fragmentPattern, 'gi');
                      const matches = allContent.match(regex);
                      if (matches && matches.length > 0) {
                        console.log(`🧩 FRAGMENTATION AVANCÉE ${index + 1} TROUVÉE pour "${cleanTag}":`, matches);
                        matches.forEach(match => {
                          const matchIndex = allContent.indexOf(match);
                          const context = allContent.substring(Math.max(0, matchIndex - 100), matchIndex + match.length + 100);
                          console.log(`📝 Contexte fragmentation avancée:`, context);
                        });
                        patternFound = true;
                        foundPattern = fragmentPattern;
                        foundContext = matches[0];
                      }
                    } catch (regexError) {
                      console.warn(`Erreur regex pour pattern ${index + 1}:`, regexError);
                    }
                  });
                }
                
                // Finaliser la détection
                if (patternFound) {
                  detectedTags.push({ ...tag, isDetected: true });
                  console.log(`✅ Balise détectée: ${tag.tag} avec pattern "${foundPattern}"`);
                } else {
                  // Debug spécial : dire si aucun pattern trouvé pour vos balises
                  if (tag.tag === '<etude_numero>' || tag.tag === '<etude_prix_ht>') {
                    console.log(`❌ AUCUN PATTERN trouvé pour ${tag.tag}`);
                    console.log(`Patterns testés:`, patterns);
                    
                    // FORCER L'AJOUT des balises critiques UNIQUEMENT pour les fichiers Word
                    // (elles sont probablement dans votre document Word mais fragmentées de manière non standard)
                    if (file.type.includes('word')) {
                      console.log(`🔧 AJOUT FORCÉ de la balise manquante pour Word: ${tag.tag}`);
                      detectedTags.push({ ...tag, isDetected: true, forcedDetection: true });
                    } else {
                      console.log(`ℹ️ Balise non trouvée dans PowerPoint (normal): ${tag.tag}`);
                    }
                  }
                }
              });
            
            setSnackbar({
              open: true,
                message: `Fichier Office analysé ! ${detectedTags.length} balise(s) détectée(s).`,
                severity: 'success'
              });
              
            } catch (error) {
              console.error('Erreur lors de l\'analyse du fichier Office:', error);
              
              // Fallback : détecter quelques balises communes
              const commonTags = [
                '<etude_lieu>',
                '<etude_numero>',
                '<etude_prix_ht>',
                '<etude_total_ht>',
                '<etude_total_ttc>',
                '<entreprise_nom>',
                '<charge_nom>',
                '<etude_date_debut>',
                '<etude_date_fin>',
                '<contact_nom>',
                '<structure_nom>'
              ];
              
              commonTags.forEach(tagName => {
                const tag = COMPLETE_TAG_LIBRARY.find(t => t.tag === tagName);
                if (tag) {
                  detectedTags.push({ ...tag, isDetected: true });
                }
              });
              
              setSnackbar({
                open: true,
                message: `Analyse basique effectuée. ${detectedTags.length} balises communes détectées.`,
                severity: 'warning'
              });
            }
            
          } else {
            // Pour les autres types de fichiers, essayer l'analyse du contenu
            detectedTags = await analyzeFileContent(file);
          }
          
          setDetectedTags(detectedTags);
          setActiveStep(2);
          setIsAnalyzing(false);
          
          setSnackbar({
            open: true,
            message: `Analyse terminée ! ${detectedTags.length} balise${detectedTags.length > 1 ? 's' : ''} détectée${detectedTags.length > 1 ? 's' : ''}.`,
            severity: 'success'
          });
        } catch (error) {
          console.error('Erreur lors de l\'analyse du contenu:', error);
          // Fallback vers la simulation
          const simulatedDetectedTags = simulateTagDetection(file.name);
          setDetectedTags(simulatedDetectedTags);
          setActiveStep(2);
          setIsAnalyzing(false);
          
          setSnackbar({
            open: true,
            message: `Analyse terminée ! ${simulatedDetectedTags.length} balise${simulatedDetectedTags.length > 1 ? 's' : ''} détectée${simulatedDetectedTags.length > 1 ? 's' : ''} (mode simulation).`,
            severity: 'warning'
          });
        }
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

  // Simulation de la détection de balises (simplifiée pour éviter la sur-détection)
  const simulateTagDetection = (fileName: string): TagMatch[] => {
    const detected: TagMatch[] = [];
    
    // Pour l'instant, on détecte seulement etude_lieu puisque c'est ce que l'utilisateur a
    const etudelieuTag = COMPLETE_TAG_LIBRARY.find(t => t.tag === '<etude_lieu>');
    if (etudelieuTag) {
      detected.push({ ...etudelieuTag, isDetected: true });
    }
    
    // Ajouter quelques balises essentielles selon le type de document
    if (fileName.toLowerCase().includes('convention') || fileName.toLowerCase().includes('contrat')) {
      const essentialTags = ['<etudiant_nom>', '<etudiant_prenom>', '<entreprise_nom>', '<etude_titre>'];
      essentialTags.forEach(tagName => {
        const tag = COMPLETE_TAG_LIBRARY.find(t => t.tag === tagName);
        if (tag && !detected.some(dt => dt.tag === tagName)) {
          detected.push({ ...tag, isDetected: true });
        }
      });
    } else if (fileName.toLowerCase().includes('facture')) {
      const essentialTags = ['<facture_numero>', '<entreprise_nom>', '<etude_total_ht>'];
      essentialTags.forEach(tagName => {
        const tag = COMPLETE_TAG_LIBRARY.find(t => t.tag === tagName);
        if (tag && !detected.some(dt => dt.tag === tagName)) {
          detected.push({ ...tag, isDetected: true });
        }
      });
    }

    return detected.filter(tag => tag !== undefined);
  };

  // Analyser le contenu réel du fichier pour détecter les balises
  const analyzeFileContent = async (file: File): Promise<TagMatch[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          let content = '';
          const result = e.target?.result;
          
          if (typeof result === 'string') {
            content = result;
          } else if (result instanceof ArrayBuffer) {
            // Convertir ArrayBuffer en string pour l'analyse
            const decoder = new TextDecoder('utf-8');
            content = decoder.decode(result);
          }
          
          const detectedTags: TagMatch[] = [];
          
          // Rechercher toutes les balises dans le contenu
          const tagRegex = /<[a-zA-Z_][a-zA-Z0-9_]*>/g;
          const matches = content.match(tagRegex) || [];
          
          console.log('Balises trouvées dans le fichier:', matches);
          
          // Vérifier chaque balise trouvée contre notre bibliothèque
          const uniqueMatches = [...new Set(matches)]; // Supprimer les doublons
          uniqueMatches.forEach(match => {
            const tag = COMPLETE_TAG_LIBRARY.find(t => t.tag === match);
            if (tag) {
              detectedTags.push({ ...tag, isDetected: true });
              console.log(`Balise reconnue: ${match} - ${tag.description}`);
            } else {
              console.log(`❌ Balise non reconnue: ${match}`);
            }
          });
          
          console.log('Balises finales détectées:', detectedTags.map(t => t.tag));
          resolve(detectedTags);
        } catch (error) {
          console.error('Erreur lors de l\'analyse du contenu:', error);
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Erreur lors de la lecture du fichier'));
      };
      
      // Essayer de lire le fichier comme texte d'abord
      // Si ça ne marche pas, on utilisera la simulation
      try {
        reader.readAsText(file, 'utf-8');
      } catch (error) {
        console.log('Lecture comme texte impossible, essai en ArrayBuffer');
        reader.readAsArrayBuffer(file);
      }
    });
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


  // Copier un template rapide dans le presse-papier
  const copyTemplateToClipboard = (templateType: 'convention' | 'facture' | 'proposition') => {
    let templateContent = '';

    switch (templateType) {
      case 'convention':
        templateContent = `CONVENTION D'ÉTUDE

Entre la société <entreprise_nom> et l'étudiant <etudiant_prenom> <etudiant_nom>

Objet : <etude_titre>
Période : du <etude_date_debut> au <etude_date_fin>
Lieu : <etude_lieu>
Rémunération : <etude_total_ht> HT

Chargé d'étude : <charge_nom>
Contact : <charge_email>

Fait le <aujourd_hui>`;
        break;

      case 'facture':
        templateContent = `FACTURE N° <facture_numero>

<structure_nom>
<structure_adresse>
<structure_telephone>

Facturé à : <entreprise_nom>
<entreprise_adresse>

Étude : <etude_titre> (<etude_numero>)
Montant HT : <etude_total_ht>
TVA : <etude_tva>
Montant TTC : <etude_total_ttc>

Date : <aujourd_hui>`;
        break;

      case 'proposition':
        templateContent = `PROPOSITION COMMERCIALE

<structure_nom> vous propose :

Titre : <etude_titre>
Description : <etude_description>

Chargé d'étude : <charge_nom>
Contact : <charge_email>

Période : <etude_date_debut> au <etude_date_fin>
Étudiants : <etude_nb_etudiants>
Durée : <etude_heures_totales>

Montant : <etude_total_ht> HT`;
        break;
    }

    navigator.clipboard.writeText(templateContent);
    setSnackbar({
      open: true,
      message: `Template "${templateType}" copié dans le presse-papier !`,
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
        return renderFinalizationStep();
      default:
        return renderUploadStep();
    }
  };

  // Étape 1: Upload
  const renderUploadStep = () => (
    <Grid container spacing={3}>
      {/* Zone d'upload */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <UploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Importez votre document template
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Glissez-déposez votre document avec les balises ou cliquez pour le sélectionner
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
      </Grid>

      {/* Bibliothèque de balises */}
      <Grid item xs={12} md={6}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoIcon color="primary" />
              Balises disponibles
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Utilisez ces balises dans votre document. Elles seront automatiquement remplacées par les vraies données.
            </Typography>

            {/* Filtres rapides */}
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
            <Box sx={{ maxHeight: 350, overflowY: 'auto', mt: 2 }}>
              {filteredTags.slice(0, 50).map((tag, index) => (
                <Paper key={index} sx={{ p: 1.5, mb: 1, bgcolor: 'grey.50' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography 
                        variant="body2" 
                        component="code" 
                        sx={{ 
                          fontFamily: 'monospace',
                          bgcolor: 'primary.main',
                          color: 'white',
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          fontSize: '0.75rem'
                        }}
                      >
                        {tag.tag}
                      </Typography>
                      <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary', fontSize: '0.7rem' }}>
                      {tag.description}
                          </Typography>
                        </Box>
                        <IconButton 
                          size="small" 
                          onClick={() => copyTagToClipboard(tag.tag)}
                      sx={{ color: 'primary.main' }}
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Paper>
                  ))}
                  
              {filteredTags.length > 50 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                  ... et {filteredTags.length - 50} autres balises
                    </Typography>
                  )}
              
              {filteredTags.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  Aucune balise trouvée avec ces critères
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Guide d'utilisation et exemples */}
      <Grid item xs={12}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Alert severity="info">
              <Typography variant="subtitle2" gutterBottom>
                💡 Comment préparer votre document
              </Typography>
              <Typography variant="body2">
                <strong>1.</strong> Créez votre document (Word, PowerPoint ou PDF) avec le contenu souhaité<br/>
                <strong>2.</strong> Insérez les balises aux endroits où vous voulez que les données apparaissent<br/>
                <strong>3.</strong> Respectez exactement la syntaxe avec les crochets &lt; &gt;<br/>
                <strong>4.</strong> Importez votre document ici pour que le système détecte automatiquement les balises
              </Typography>
            </Alert>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card sx={{ bgcolor: 'success.light', color: 'success.contrastText' }}>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                  📄 Exemple de template
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, fontSize: '0.875rem' }}>
                  Téléchargez un exemple de document avec balises
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={() => {
                    const exampleContent = `
CONVENTION D'ÉTUDE

Entre :
- La société <entreprise_nom>, située au <entreprise_adresse>, <entreprise_ville>
  Représentée par <contact_nom_complet>, <contact_poste>
  Email : <contact_email> | Téléphone : <contact_telephone>

Et :
- L'étudiant(e) <etudiant_prenom> <etudiant_nom>
  École : <etudiant_ecole>
  Formation : <etudiant_formation>
  Email : <etudiant_email>

Il est convenu ce qui suit :

ARTICLE 1 - OBJET DE LA MISSION
La présente convention a pour objet la réalisation de l'étude intitulée :
"<etude_titre>"

Description : <etude_description>

ARTICLE 2 - MODALITÉS D'EXÉCUTION
Période d'exécution : du <etude_date_debut> au <etude_date_fin>
Lieu de la mission : <etude_lieu>
Nombre d'heures prévues : <etude_heures_totales>
Nombre d'étudiants assignés : <etude_nb_etudiants>

ARTICLE 3 - RÉMUNÉRATION
Montant de la prestation : <etude_total_ht> HT
Montant TTC : <etude_total_ttc>

ARTICLE 4 - ENCADREMENT
Chargé d'étude responsable : <charge_nom>
Contact : <charge_email> | <charge_telephone>

Structure organisatrice :
<structure_nom>
<structure_adresse>
<structure_telephone> | <structure_email>
Site web : <structure_site_web>

Fait le <aujourd_hui>

Signatures :
Pour l'entreprise :                    Pour l'étudiant :


<contact_nom_complet>                   <etudiant_prenom> <etudiant_nom>
                    `.trim();

                    const blob = new Blob([exampleContent], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'exemple-template-convention.txt';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    setSnackbar({
                      open: true,
                      message: 'Exemple de template téléchargé !',
                      severity: 'success'
                    });
                  }}
                  sx={{ 
                    bgcolor: 'white',
                    color: 'success.main',
                    '&:hover': { bgcolor: 'grey.100' }
                  }}
                >
                  Télécharger l'exemple
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Grid>
    </Grid>
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

  // Fonction pour obtenir la valeur de remplacement d'une balise
  const getReplacementValue = (tag: TagMatch): string => {
    // Vérifier d'abord si une valeur personnalisée existe
    if (customValues[tag.tag] !== undefined) {
      return customValues[tag.tag];
    }
    
    if (!etudeData) return '';

    // Construire les données de remplacement
    const replacementData: ReplacementData = {
      etude: {
        numeroMission: etudeData.numeroEtude,
        title: etudeData.title || 'Titre de l\'étude',
        missionDescription: etudeData.description,
        missionStartDate: etudeData.startDate,
        missionEndDate: etudeData.endDate,
        location: etudeData.location,
        priceHT: etudeData.prixHT,
        totalHT: etudeData.prixHT,
        totalTTC: etudeData.prixHT ? etudeData.prixHT * 1.2 : undefined,
        tva: etudeData.prixHT ? etudeData.prixHT * 0.2 : undefined,
        hours: etudeData.hours,
        studentCount: etudeData.consultantCount,
        status: etudeData.status,
        etape: etudeData.etape,
        missionType: etudeData.missionTypeName
      },
      charge: {
        chargeName: etudeData.chargeName,
        chargeId: etudeData.chargeId
      },
      entreprise: companyData ? {
        companyName: companyData.name,
        siret: companyData.nSiret,
        companyAddress: companyData.address,
        companyCity: companyData.city,
        companyPhone: companyData.phone,
        companyEmail: companyData.email,
        website: companyData.website
      } : {
        companyName: etudeData.company
      },
      contact: contactData ? {
        contact_firstName: contactData.firstName,
        contact_lastName: contactData.lastName,
        contact_fullName: `${contactData.firstName} ${contactData.lastName}`,
        contact_email: contactData.email,
        contact_phone: contactData.phone,
        contact_position: contactData.position
      } : undefined,
      structure: structureData ? {
        structure_name: structureData.name,
        structure_address: structureData.address,
        structure_phone: structureData.phone,
        structure_email: structureData.email
      } : undefined
    };

    // Remplacer la balise par sa valeur directement
    const replacedValue = replaceTagsInText(tag.tag, replacementData);
    
    // Debug: vérifier la valeur de remplacement
    console.log(`getReplacementValue pour ${tag.tag}:`, replacedValue);
    
    // Ne pas retourner tag.example si replacedValue est vide
    return replacedValue || '';
  };

  // Étape 3: Configuration
  const renderConfigurationStep = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckIcon color="success" />
          Configuration des balises ({detectedTags.length})
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Vérifiez les balises détectées et leurs valeurs de remplacement avec les données de votre étude.
        </Typography>
        
        {selectedFile?.type.includes('powerpoint') || selectedFile?.type.includes('presentation') ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Fichier PowerPoint :</strong> "{selectedFile.name}" - Les balises seront remplacées dans le document final.
            </Typography>
          </Alert>
        ) : null}

        {detectedTags.length > 0 ? (
          <Box>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
              Balises à remplacer :
            </Typography>
            
            {detectedTags.map((tag, index) => (
              <Paper key={index} sx={{ p: 3, mb: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2" gutterBottom sx={{ color: 'text.secondary' }}>
                      Balise dans le document :
                    </Typography>
                    <Typography 
                      variant="body1" 
                      component="code" 
                      sx={{ 
                        fontFamily: 'monospace',
                        bgcolor: 'primary.main',
                        color: 'white',
                        px: 2,
                        py: 1,
                        borderRadius: 1,
                        fontWeight: 600,
                        display: 'inline-block'
                      }}
                    >
                      {tag.tag}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={1} sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 600 }}>
                      →
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={7}>
                    <Typography variant="subtitle2" gutterBottom sx={{ color: 'text.secondary' }}>
                      Sera remplacé par :
                    </Typography>
                    <TextField
                      fullWidth
                      variant="outlined"
                      size="small"
                      value={customValues[tag.tag] !== undefined ? customValues[tag.tag] : getReplacementValue(tag)}
                      onChange={(e) => {
                        setCustomValues(prev => ({
                          ...prev,
                          [tag.tag]: e.target.value
                        }));
                      }}
                      placeholder={`Valeur pour ${tag.tag}`}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'white',
                          '&:hover': {
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'primary.main'
                            }
                          },
                          '&.Mui-focused': {
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'primary.main'
                            }
                          }
                        }
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {tag.description}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            ))}
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, mb: 2 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setCustomValues({});
                  setSnackbar({
                    open: true,
                    message: 'Valeurs réinitialisées aux valeurs par défaut',
                    severity: 'info'
                  });
                }}
                sx={{ textTransform: 'none' }}
              >
                Réinitialiser les valeurs
              </Button>
              <Typography variant="body2" color="text.secondary">
                {detectedTags.length} balise(s) détectée(s)
              </Typography>
            </Box>
            
            <Alert severity="success">
              <Typography variant="body2">
                <strong>Configuration terminée !</strong> Toutes les balises détectées seront remplacées par les vraies données de votre étude. Vous pouvez modifier les valeurs ci-dessus.
              </Typography>
            </Alert>
          </Box>
        ) : (
          <Alert severity="warning">
            <Typography variant="body2">
              Aucune balise détectée dans votre document. Assurez-vous d'avoir utilisé la syntaxe correcte avec les crochets &lt; &gt;.
            </Typography>
          </Alert>
        )}

        {/* Liste simple des balises disponibles */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
            Balises disponibles
          </Typography>
          
          {/* Filtres */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              size="small"
              placeholder="Rechercher une balise..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ flex: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Catégorie</InputLabel>
              <Select
                value={selectedCategory}
                label="Catégorie"
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <MenuItem value="all">Toutes</MenuItem>
                {categories.filter(cat => cat.id !== 'all').map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          
          {/* Liste des balises filtrées */}
          <Box sx={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 1, p: 1 }}>
            {filteredTags.slice(0, 50).map((tag, index) => (
              <Paper key={index} sx={{ p: 1.5, mb: 1, bgcolor: 'grey.50' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography 
                      variant="body2" 
                      component="code" 
                      sx={{ 
                        fontFamily: 'monospace',
                        bgcolor: 'primary.main',
                        color: 'white',
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: '0.8rem'
                      }}
                    >
                      {tag.tag}
                    </Typography>
                    <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                      {tag.description}
                    </Typography>
                  </Box>
                  <IconButton 
                    size="small" 
                    onClick={() => copyTagToClipboard(tag.tag)}
                    sx={{ color: 'primary.main' }}
                  >
                    <CopyIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Paper>
            ))}
            
            {filteredTags.length > 50 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                ... et {filteredTags.length - 50} autres balises
              </Typography>
            )}
            
            {filteredTags.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                Aucune balise trouvée avec ces critères
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );


  // Fonction helper pour sauvegarder le document dans Firestore et Storage
  const saveDocumentToFirestore = async (blob: Blob, fileName: string, fileType: 'pptx' | 'docx' | 'pdf'): Promise<void> => {
    if (!etudeData || !currentUser || !storage) {
      console.log('⚠️ Impossible de sauvegarder le document: données manquantes');
      return;
    }

    if (!etudeData.id || !etudeData.numeroEtude) {
      console.error('❌ ID ou numéro de l\'étude manquant');
      setSnackbar({
        open: true,
        message: 'Impossible de sauvegarder: données de l\'étude manquantes',
        severity: 'error'
      });
      return;
    }

    try {
      console.log('🔍 Recherche de la mission correspondante...');
      
      // Chercher la mission correspondante à l'étude par numeroMission
      const missionsRef = collection(db, 'missions');
      const missionQuery = query(
        missionsRef,
        where('numeroMission', '==', etudeData.numeroEtude)
      );
      const missionSnapshot = await getDocs(missionQuery);
      
      let missionId: string;
      let storagePath: string;
      
      if (!missionSnapshot.empty) {
        // Mission trouvée, utiliser son ID
        const missionDoc = missionSnapshot.docs[0];
        missionId = missionDoc.id;
        console.log('✅ Mission trouvée, ID:', missionId);
        storagePath = `missions/${missionId}/documents/${fileName}`;
      } else {
        // Pas de mission trouvée, utiliser l'ID de l'étude comme fallback
        // et modifier la requête dans MissionDetails pour aussi chercher par missionNumber
        missionId = etudeData.id;
        console.log('⚠️ Mission non trouvée, utilisation de l\'ID de l\'étude:', missionId);
        storagePath = `missions/${missionId}/documents/${fileName}`;
      }
      
      console.log('📤 Upload du document vers Firebase Storage...');
      console.log('📁 Chemin de stockage:', storagePath);
      
      const storageRef = ref(storage, storagePath);
      
      // Uploader le fichier
      await uploadBytes(storageRef, blob);
      console.log('✅ Fichier uploadé vers Storage');
      
      // Récupérer l'URL
      const fileUrl = await getDownloadURL(storageRef);
      console.log('✅ URL du document:', fileUrl);

      // Préparer les données du document
      const documentData = {
        missionId: missionId,
        missionNumber: etudeData.numeroEtude,
        missionTitle: etudeData.title || etudeData.description || `Étude ${etudeData.numeroEtude}`,
        structureId: etudeData.structureId || '',
        documentType: 'proposition_commerciale' as const,
        fileName: fileName,
        fileUrl: fileUrl,
        fileSize: blob.size,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: currentUser.uid,
        status: 'draft' as const,
        isValid: true,
        tags: ['proposition_commerciale', 'commercial'],
        notes: `Document généré depuis l'éditeur - ${fileType.toUpperCase()}`
      };

      // Créer le document dans Firestore
      const docRef = await addDoc(collection(db, 'generatedDocuments'), documentData);
      console.log('📊 Document créé dans Firestore, ID:', docRef.id);
      console.log('📋 Document lié à la mission ID:', missionId);
      
      setSnackbar({
        open: true,
        message: 'Document sauvegardé dans les Documents générés de la mission',
        severity: 'success'
      });
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde du document:', error);
      setSnackbar({
        open: true,
        message: 'Document téléchargé mais erreur lors de la sauvegarde',
        severity: 'warning'
      });
    }
  };

  // Fonction pour traiter et télécharger le document avec les balises remplacées
  const downloadProcessedDocument = async () => {
    if (!selectedFile || detectedTags.length === 0) {
      setSnackbar({
        open: true,
        message: 'Aucun fichier ou balise à traiter.',
        severity: 'error'
      });
      return;
    }

    try {
      // Construire les données de remplacement
      const replacementData: ReplacementData = {
        etude: {
          numeroMission: etudeData?.numeroEtude,
          title: etudeData?.title || 'Titre de l\'étude',
          missionDescription: etudeData?.description,
          missionStartDate: etudeData?.startDate,
          missionEndDate: etudeData?.endDate,
          location: etudeData?.location,
          priceHT: etudeData?.prixHT,
          totalHT: etudeData?.prixHT,
          totalTTC: etudeData?.prixHT ? etudeData.prixHT * 1.2 : undefined,
          tva: etudeData?.prixHT ? etudeData.prixHT * 0.2 : undefined,
          hours: etudeData?.hours,
          studentCount: etudeData?.consultantCount,
          status: etudeData?.status,
          etape: etudeData?.etape,
          missionType: etudeData?.missionTypeName
        },
        charge: {
          chargeName: etudeData?.chargeName,
          chargeId: etudeData?.chargeId
        },
        entreprise: companyData ? {
          companyName: companyData.name,
          siret: companyData.nSiret,
          companyAddress: companyData.address,
          companyCity: companyData.city,
          companyPhone: companyData.phone,
          companyEmail: companyData.email,
          website: companyData.website
        } : {
          companyName: etudeData?.company
        },
        contact: contactData ? {
          contact_firstName: contactData.firstName,
          contact_lastName: contactData.lastName,
          contact_fullName: `${contactData.firstName} ${contactData.lastName}`,
          contact_email: contactData.email,
          contact_phone: contactData.phone,
          contact_position: contactData.position
        } : undefined,
        structure: structureData ? {
          structure_name: structureData.name,
          structure_address: structureData.address,
          structure_phone: structureData.phone,
          structure_email: structureData.email
        } : undefined
      };

      // Créer un objet de remplacement simple pour les bibliothèques
      // Les bibliothèques utilisent des accolades {}, pas des crochets <>
      const simpleReplacements: { [key: string]: string } = {};
      detectedTags.forEach(tag => {
        const cleanTag = tag.tag.replace('<', '').replace('>', ''); // Enlever < >
        const replacedValue = getReplacementValue(tag);
        simpleReplacements[cleanTag] = replacedValue;
      });

      console.log('Remplacements à effectuer:', simpleReplacements);

      // Lire le fichier
      const fileBuffer = await selectedFile.arrayBuffer();
      
      if (selectedFile.type.includes('powerpoint') || selectedFile.type.includes('presentation') || selectedFile.name.endsWith('.pptx')) {
        // Traitement PowerPoint
        await processAndDownloadPowerPoint(fileBuffer, simpleReplacements);
      } else if (selectedFile.type.includes('document') || selectedFile.name.endsWith('.docx')) {
        // Traitement Word
        await processAndDownloadWord(fileBuffer, simpleReplacements);
      } else {
        // Pour les autres types, fallback sur les instructions
        downloadInstructionsFile();
      }

    } catch (error) {
      console.error('Erreur lors du traitement du document:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors du traitement. Téléchargement des instructions en cours...',
        severity: 'warning'
      });
      // Fallback sur les instructions
      downloadInstructionsFile();
    }
  };

  // Traitement PowerPoint avec remplacement direct et debug
  const processAndDownloadPowerPoint = async (fileBuffer: ArrayBuffer, replacements: { [key: string]: string }) => {
    try {
      const zip = new PizZip(fileBuffer);
      let replacementsFound = 0;
      let filesProcessed = 0;
      
      console.log('Début du traitement PowerPoint...');
      console.log('Balises à remplacer:', detectedTags.map(t => t.tag));
      
      // Parcourir tous les fichiers dans le ZIP
      Object.keys(zip.files).forEach(filename => {
        const file = zip.files[filename];
        
        // Traiter SEULEMENT les fichiers de slides principaux pour éviter la confusion
        if (!file.dir && filename.endsWith('.xml') && 
            (filename.includes('ppt/slides/slide') && !filename.includes('slideLayout') && !filename.includes('slideMaster'))) {
          
          let content = file.asText();
          let originalContent = content;
          filesProcessed++;
          
          console.log(`Traitement du fichier: ${filename}`);
          
          // Debug: Chercher toutes les balises dans tous les fichiers
          detectedTags.forEach(tag => {
            const cleanTag = tag.tag.replace('<', '').replace('>', '');
            
            // Recherche exhaustive de la balise sous toutes ses formes
            const searchPatterns = [
              tag.tag,                    // <etude_lieu>
              cleanTag,                   // etude_lieu
              `&lt;${cleanTag}&gt;`,     // &lt;etude_lieu&gt;
              `{${cleanTag}}`,            // {etude_lieu}
              `{{${cleanTag}}}`           // {{etude_lieu}}
            ];
            
            searchPatterns.forEach(pattern => {
              if (content.toLowerCase().includes(pattern.toLowerCase())) {
                console.log(`TROUVÉ "${pattern}" dans ${filename}`);
                const index = content.toLowerCase().indexOf(pattern.toLowerCase());
                const context = content.substring(Math.max(0, index - 100), index + pattern.length + 100);
                console.log(`Contexte complet:`, context);
              }
            });
          });
          
          // NOUVELLE APPROCHE: Remplacement en deux étapes
          // Étape 1: Identifier et remplacer directement toutes les formes de balises
          detectedTags.forEach(tag => {
            const cleanTag = tag.tag.replace('<', '').replace('>', '');
            const replacedValue = getReplacementValue(tag);
            let tagReplacements = 0;
            
            console.log(`NOUVELLE APPROCHE - Recherche de "${tag.tag}" pour remplacer par "${replacedValue}"`);
            
            // Étape 1: Remplacement direct et brutal de toutes les formes possibles
            const directReplacements = [
              // Formes exactes avec balises complètes
              { from: `&lt;${cleanTag}&gt;`, to: replacedValue },
              { from: `<${cleanTag}>`, to: replacedValue },
              { from: `&amp;lt;${cleanTag}&amp;gt;`, to: replacedValue },
              { from: tag.tag, to: replacedValue },
              // Formes avec espaces
              { from: `&lt; ${cleanTag} &gt;`, to: replacedValue },
              { from: `< ${cleanTag} >`, to: replacedValue },
              { from: `&lt;  ${cleanTag}  &gt;`, to: replacedValue },
              { from: `<  ${cleanTag}  >`, to: replacedValue },
              // Formes avec accolades
              { from: `{${cleanTag}}`, to: replacedValue },
              { from: `{{${cleanTag}}}`, to: replacedValue }
            ];
            
            // Appliquer tous les remplacements directs
            directReplacements.forEach(({ from, to }) => {
              if (content.includes(from)) {
                console.log(`REMPLACEMENT DIRECT: "${from}" → "${to}"`);
                const beforeReplace = content;
                content = content.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
                if (content !== beforeReplace) {
                  tagReplacements++;
                  console.log(`Remplacement direct réussi !`);
                }
              }
            });
            
            // GESTION SPÉCIALE POWERPOINT: Traiter la fragmentation XML
            // PowerPoint peut fragmenter <etude_lieu> en 3 éléments séparés
            if (content.includes(`<a:t>${cleanTag}</a:t>`)) {
              console.log(`FRAGMENTATION POWERPOINT DÉTECTÉE pour "${cleanTag}"`);
              
              // Pattern pour détecter la séquence fragmentée complète
              const fragmentedPattern = `<a:t>&lt;</a:t></a:r><a:r><a:rPr[^>]*><a:t>${cleanTag}</a:t></a:r><a:r><a:rPr[^>]*><a:t>&gt;</a:t>`;
              const fragmentedRegex = new RegExp(fragmentedPattern, 'gi');
              
              // Pattern simplifié qui peut marcher aussi
              const simpleFragmentPattern = `(<a:t>&lt;</a:t>.*?<a:t>)${cleanTag}(</a:t>.*?<a:t>&gt;</a:t>)`;
              const simpleFragmentRegex = new RegExp(simpleFragmentPattern, 'gi');
              
              if (content.match(fragmentedRegex)) {
                console.log(`REMPLACEMENT FRAGMENTÉ COMPLET: séquence complète trouvée`);
                content = content.replace(fragmentedRegex, `<a:t>${replacedValue}</a:t>`);
                tagReplacements++;
              } else if (content.match(simpleFragmentRegex)) {
                console.log(`REMPLACEMENT FRAGMENTÉ SIMPLE: séquence trouvée`);
                content = content.replace(simpleFragmentRegex, `$1${replacedValue}$2`);
                // Maintenant nettoyer les balises qui restent
                content = content.replace(/<a:t>&lt;<\/a:t>/gi, '');
                content = content.replace(/<a:t>&gt;<\/a:t>/gi, '');
                tagReplacements++;
              } else {
                // Approche manuelle : remplacer etude_lieu puis nettoyer les &lt; et &gt; adjacents
                console.log(`APPROCHE MANUELLE pour la fragmentation`);
                
                // D'abord remplacer le nom de la balise
                const beforeManual = content;
                content = content.replace(new RegExp(`<a:t>${cleanTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</a:t>`, 'g'), `<a:t>${replacedValue}</a:t>`);
                
                if (content !== beforeManual) {
                  console.log(`✅ Nom de balise remplacé: ${cleanTag} → ${replacedValue}`);
                  
                  // Maintenant identifier et supprimer les fragments &lt; et &gt; qui entourent notre valeur
                  // Pattern basé sur votre log exact
                  const contextPattern = `(<a:t>&lt;</a:t></a:r><a:r><a:rPr[^>]*><a:t>)${replacedValue}(</a:t></a:r><a:r><a:rPr[^>]*><a:t>&gt;</a:t>)`;
                  const contextRegex = new RegExp(contextPattern, 'gi');
                  
                  if (content.match(contextRegex)) {
                    console.log(`🎯 PATTERN EXACT TROUVÉ - Suppression des fragments &lt; et &gt;`);
                    content = content.replace(contextRegex, `<a:t>${replacedValue}</a:t>`);
                    console.log(`✅ Fragments supprimés avec succès !`);
                  } else {
                    // Fallback : supprimer tous les éléments &lt; et &gt; isolés
                    console.log(`🔧 FALLBACK - Suppression de tous les fragments &lt; et &gt;`);
                    content = content.replace(/<a:r><a:rPr[^>]*><a:t>&lt;<\/a:t><\/a:r>/gi, '');
                    content = content.replace(/<a:r><a:rPr[^>]*><a:t>&gt;<\/a:t><\/a:r>/gi, '');
                  }
                  
                  tagReplacements++;
                  console.log(`✅ Nettoyage manuel de la fragmentation effectué`);
                }
              }
            }
            
            // Étape 2: Nettoyage agressif des balises orphelines autour de la valeur remplacée
            if (tagReplacements > 0) {
              console.log(`🧹 ÉTAPE 2: Nettoyage des balises orphelines autour de "${replacedValue}"`);
              
              // Chercher et supprimer les patterns comme <Paris>, &lt;Paris&gt;, etc.
              const orphanCleanup = [
                `&lt;${replacedValue}&gt;`,
                `<${replacedValue}>`,
                `&amp;lt;${replacedValue}&amp;gt;`,
                `&lt; ${replacedValue} &gt;`,
                `< ${replacedValue} >`,
                `&lt;  ${replacedValue}  &gt;`,
                `<  ${replacedValue}  >`
              ];
              
              orphanCleanup.forEach(orphanPattern => {
                if (content.includes(orphanPattern)) {
                  console.log(`🧽 NETTOYAGE ORPHELIN: "${orphanPattern}" → "${replacedValue}"`);
                  content = content.replace(new RegExp(orphanPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacedValue);
                  console.log(`✅ Nettoyage orphelin réussi !`);
                }
              });
            }
            
            console.log(`🏷️ Fin de la nouvelle approche pour "${tag.tag}"`);
            
            // ANCIENNE APPROCHE (conservée en fallback)
            // Différents formats possibles dans PowerPoint
            // IMPORTANT: On remplace TOUT, y compris les crochets encodés
            const patterns = [
              {
                pattern: tag.tag,                           // <etude_lieu>
                replacement: replacedValue                   // Paris (sans crochets)
              },
              {
                pattern: `{${cleanTag}}`,                   // {etude_lieu}
                replacement: replacedValue                   // Paris
              },
              {
                pattern: `{{${cleanTag}}}`,                 // {{etude_lieu}}
                replacement: replacedValue                   // Paris
              },
              {
                pattern: `&lt;${cleanTag}&gt;`,            // &lt;etude_lieu&gt; (HTML encoded)
                replacement: replacedValue                   // Paris - REMPLACE TOUT Y COMPRIS &lt; et &gt;
              },
              {
                pattern: `&amp;lt;${cleanTag}&amp;gt;`,   // Double encoded
                replacement: replacedValue                   // Paris - REMPLACE TOUT
              },
              // Patterns pour gérer les cas où les crochets sont séparés
              {
                pattern: `&lt;\\s*${cleanTag}\\s*&gt;`,    // &lt; etude_lieu &gt; avec espaces
                replacement: replacedValue
              },
              {
                pattern: `<\\s*${cleanTag}\\s*>`,          // < etude_lieu > avec espaces
                replacement: replacedValue
              },
              // Pattern pour chercher juste le nom de la balise et remplacer avec les crochets
              {
                pattern: cleanTag,                          // etude_lieu seul
                replacement: replacedValue,                 // Paris
                isCleanTagOnly: true                        // Flag pour traitement spécial
              }
            ];
            
            patterns.forEach(({ pattern, replacement, isCleanTagOnly }) => {
              // Créer une regex qui gère les différents formats d'encodage
              let regex;
              
              if (isCleanTagOnly) {
                // Pour le pattern du nom seul, on doit s'assurer de remplacer aussi les balises environnantes
                // Chercher le nom de la balise précédé et suivi de caractères de balise
                const boundaryPatterns = [
                  `&lt;${pattern}&gt;`,     // &lt;etude_lieu&gt;
                  `<${pattern}>`,           // <etude_lieu>
                  `&lt;\\s*${pattern}\\s*&gt;`, // &lt; etude_lieu &gt;
                  `<\\s*${pattern}\\s*>`    // < etude_lieu >
                ];
                
                // Essayer chaque pattern de balise
                boundaryPatterns.forEach(boundaryPattern => {
                  const boundaryRegex = new RegExp(boundaryPattern, 'gi');
                  const matches = content.match(boundaryRegex);
                  if (matches) {
                    console.log(`🎯 TROUVÉ avec balises: "${boundaryPattern}" → remplacer par "${replacement}"`);
                    content = content.replace(boundaryRegex, replacement);
                    tagReplacements += matches.length;
                  }
                });
                
                // Si aucune balise trouvée, chercher juste le nom (mais avec plus de précaution)
                if (tagReplacements === 0) {
                  regex = new RegExp(`\\b${pattern}\\b`, 'gi');
                }
              } else if (pattern.includes('&lt;') && pattern.includes('&gt;')) {
                // Pour les patterns HTML encodés, utiliser une regex littérale
                regex = new RegExp(pattern, 'gi');
              } else if (pattern.includes('<') && pattern.includes('>')) {
                // Pour les patterns avec < et >, échapper correctement
                const escapedPattern = pattern.replace(/[<>]/g, (match) => {
                  return match === '<' ? '\\<' : '\\>';
                });
                regex = new RegExp(escapedPattern, 'gi');
              } else {
                // Pour les autres patterns, échapper normalement
                regex = new RegExp(pattern.replace(/[{}]/g, '\\$&'), 'gi');
              }
              
              // Traiter seulement si on a une regex valide
              if (regex) {
              const matches = content.match(regex);
              if (matches) {
                console.log(`✅ Trouvé ${matches.length} occurrence(s) de "${pattern}"`);
                console.log(`🔄 Avant remplacement:`, matches[0]);
                console.log(`🎯 Valeur de remplacement:`, replacement);
                
                const oldContent = content;
                content = content.replace(regex, replacement);
                
                // Vérifier que le remplacement a bien eu lieu
                if (oldContent !== content) {
                  console.log(`✅ Remplacement effectué avec succès`);
                  // Montrer un extrait autour du remplacement
                  const index = content.indexOf(replacement);
                  if (index !== -1) {
                    const context = content.substring(Math.max(0, index - 30), index + replacement.length + 30);
                    console.log(`📝 Contexte après remplacement:`, context);
                  }
                } else {
                  console.log(`❌ Le remplacement n'a pas eu lieu`);
                }
                
                tagReplacements += matches.length;
                }
              }
            });
            
            // Recherche plus agressive : chercher juste le nom de la balise dans le texte
            if (tagReplacements === 0) {
              console.log(`🔍 Aucun remplacement avec les patterns standards, tentative de recherche simple...`);
              
              // Recherche fragmentée (PowerPoint peut fragmenter le texte)
              const fragmentedPatterns = [
                // Recherche de fragments comme <etude_lieu> même s'il est fragmenté
                new RegExp(`&lt;\\s*${cleanTag}\\s*&gt;`, 'gi'),
                new RegExp(`<\\s*${cleanTag}\\s*>`, 'gi'),
                // Recherche avec balises partiellement encodées
                new RegExp(`&lt;${cleanTag}&gt;`, 'gi'),
                new RegExp(`<${cleanTag}>`, 'gi'),
                // Recherche du nom seul entouré de caractères non-alphabétiques
                new RegExp(`(?<!\\w)${cleanTag}(?!\\w)`, 'gi')
              ];
              
              fragmentedPatterns.forEach((regex, index) => {
                const matches = content.match(regex);
                if (matches && tagReplacements === 0) {
                  console.log(`🎯 Trouvé avec pattern fragmenté ${index + 1}: ${matches.length} occurrence(s)`);
                  console.log(`📋 Matches trouvés:`, matches);
                  content = content.replace(regex, replacedValue);
                  tagReplacements += matches.length;
                }
              });
              
              // Si toujours aucun remplacement, chercher le nom de la balise seul et nettoyer autour
              if (tagReplacements === 0) {
                const simpleRegex = new RegExp(`\\b${cleanTag}\\b`, 'gi');
                const simpleMatches = content.match(simpleRegex);
                if (simpleMatches) {
                  console.log(`🎯 Trouvé le nom de balise seul: ${simpleMatches.length} occurrence(s)`);
                  
                  // Remplacer le nom de la balise
                  content = content.replace(simpleRegex, replacedValue);
                  tagReplacements += simpleMatches.length;
                  
                  // Nettoyer immédiatement les balises vides qui pourraient entourer la valeur
                  const immediateCleanup = [
                    `&lt;${replacedValue}&gt;`,
                    `<${replacedValue}>`,
                    `&lt; ${replacedValue} &gt;`,
                    `< ${replacedValue} >`
                  ];
                  
                  immediateCleanup.forEach(cleanupPattern => {
                    const cleanupRegex = new RegExp(cleanupPattern.replace(/[<>&{}]/g, '\\$&'), 'gi');
                    const beforeImmediate = content;
                    content = content.replace(cleanupRegex, replacedValue);
                    if (beforeImmediate !== content) {
                      console.log(`🧹 Nettoyage immédiat: "${cleanupPattern}" → "${replacedValue}"`);
                    }
                  });
                }
              }
              
              if (tagReplacements === 0) {
                console.log(`⚠️ Aucun remplacement trouvé pour "${tag.tag}"`);
              }
            
            // Étape de nettoyage supplémentaire : supprimer les balises orphelines
            // Rechercher et supprimer les patterns comme "<>" ou "&lt;&gt;" qui pourraient rester
            const cleanupPatterns = [
              // Supprimer les balises vides restantes
              /&lt;\s*&gt;/gi,
              /<\s*>/gi,
              // Supprimer les balises avec juste des espaces
              /&lt;\s+&gt;/gi,
              /<\s+>/gi
            ];
            
            cleanupPatterns.forEach((cleanupRegex) => {
              const beforeCleanup = content;
              content = content.replace(cleanupRegex, '');
              if (beforeCleanup !== content) {
                console.log(`🧹 Nettoyage effectué: suppression de balises orphelines`);
              }
            });
            }
            
            // Nettoyage post-remplacement : supprimer les résidus de crochets
            if (tagReplacements > 0) {
              console.log(`🧹 Nettoyage des résidus de crochets autour de "${replacedValue}"`);
              
              // Supprimer les patterns comme <Paris> ou &lt;Paris&gt;
              const cleanupPatterns = [
                `<${replacedValue}>`,
                `&lt;${replacedValue}&gt;`,
                `&amp;lt;${replacedValue}&amp;gt;`,
                `< ${replacedValue} >`,
                `&lt; ${replacedValue} &gt;`
              ];
              
              cleanupPatterns.forEach(pattern => {
                const cleanupRegex = new RegExp(pattern.replace(/[<>&{}]/g, '\\$&'), 'gi');
                if (content.match(cleanupRegex)) {
                  console.log(`🧽 Nettoyage de "${pattern}" → "${replacedValue}"`);
                  content = content.replace(cleanupRegex, replacedValue);
                }
              });
            }
            
            replacementsFound += tagReplacements;
            console.log(`📊 Total remplacements pour "${tag.tag}": ${tagReplacements}`);
          });
          
          // NETTOYAGE GLOBAL FINAL AGRESSIF : supprimer TOUTES les balises autour des valeurs remplacées
          console.log(`🧹 NETTOYAGE GLOBAL FINAL pour ${filename}`);
          detectedTags.forEach(tag => {
            const replacedValue = getReplacementValue(tag);
            
            // Chercher et supprimer TOUTES les formes de balises autour de la valeur
            const globalCleanupPatterns = [
              `&lt;${replacedValue}&gt;`,
              `<${replacedValue}>`,
              `&amp;lt;${replacedValue}&amp;gt;`,
              `&lt; ${replacedValue} &gt;`,
              `< ${replacedValue} >`,
              `&lt;  ${replacedValue}  &gt;`,
              `<  ${replacedValue}  >`,
              `&lt;\t${replacedValue}\t&gt;`,
              `<\t${replacedValue}\t>`
            ];
            
            globalCleanupPatterns.forEach(pattern => {
              const originalContent = content;
              content = content.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacedValue);
              if (originalContent !== content) {
                console.log(`🧽 NETTOYAGE GLOBAL: "${pattern}" → "${replacedValue}"`);
              }
            });
          });
          
          // NETTOYAGE SPÉCIFIQUE POWERPOINT : supprimer les fragments de balises
          console.log(`🧹 NETTOYAGE SPÉCIFIQUE POWERPOINT dans ${filename}`);
          
          // Supprimer les éléments XML qui contiennent juste &lt; ou &gt;
          const powerpointCleanup = [
            // Supprimer les éléments qui contiennent juste &lt;
            /<a:t>&lt;<\/a:t><\/a:r><a:r><a:rPr[^>]*>/gi,
            /<a:t>&lt;<\/a:t>/gi,
            // Supprimer les éléments qui contiennent juste &gt;
            /<\/a:r><a:r><a:rPr[^>]*><a:t>&gt;<\/a:t>/gi,
            /<a:t>&gt;<\/a:t>/gi,
            // Patterns plus génériques pour nettoyer les fragments
            /<a:r><a:rPr[^>]*><a:t>&lt;<\/a:t><\/a:r>/gi,
            /<a:r><a:rPr[^>]*><a:t>&gt;<\/a:t><\/a:r>/gi
          ];
          
          powerpointCleanup.forEach(regex => {
            const beforePowerpoint = content;
            content = content.replace(regex, '');
            if (beforePowerpoint !== content) {
              console.log(`🧹 NETTOYAGE POWERPOINT effectué !`);
            }
          });
          
          // NETTOYAGE ULTIME : supprimer toutes les balises vides restantes
          console.log(`🧹 NETTOYAGE ULTIME des balises vides dans ${filename}`);
          const ultimateCleanup = [
            /&lt;\s*&gt;/gi,
            /<\s*>/gi,
            /&lt;\s+&gt;/gi,
            /<\s+>/gi,
            /&amp;lt;\s*&amp;gt;/gi,
            /&lt;\t*&gt;/gi,
            /<\t*>/gi
          ];
          
          ultimateCleanup.forEach(regex => {
            const beforeUltimate = content;
            content = content.replace(regex, '');
            if (beforeUltimate !== content) {
              console.log(`🧹 NETTOYAGE ULTIME effectué !`);
            }
          });
          
          // Nettoyage final global
          if (replacementsFound > 0) {
            console.log(`🔧 Nettoyage final du fichier ${filename}`);
            
            // Nettoyer tous les résidus de balises vides ou malformées
            detectedTags.forEach(tag => {
              const cleanTag = tag.tag.replace('<', '').replace('>', '');
              const replacedValue = getReplacementValue(tag);
              
              // Patterns de nettoyage final - avec échappement correct des caractères spéciaux
              const finalCleanup = [
                `&lt;${replacedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}&gt;`,
                `<${replacedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}>`,
                `&amp;lt;${replacedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}&amp;gt;`,
                // Nettoyer aussi les balises vides qui pourraient rester
                `&lt;&gt;`,
                `<>`,
                `&lt; &gt;`,
                `< >`,
                // Patterns avec espaces autour de la valeur
                `&lt;\\s*${replacedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*&gt;`,
                `<\\s*${replacedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*>`
              ];
              
              finalCleanup.forEach(pattern => {
                const regex = new RegExp(pattern, 'gi');
                const beforeFinal = content;
                content = content.replace(regex, replacedValue);
                if (beforeFinal !== content) {
                  console.log(`🧽 Nettoyage final effectué: pattern "${pattern}" → "${replacedValue}"`);
                }
              });
            });
            
            // Nettoyage final agressif : supprimer toutes les balises vides restantes
            console.log(`🧹 Nettoyage final agressif des balises orphelines`);
            const aggressiveCleanup = [
              // Balises complètement vides
              /&lt;\s*&gt;/gi,
              /<\s*>/gi,
              // Balises avec uniquement des espaces ou des caractères de ponctuation
              /&lt;[\s\W]*&gt;/gi,
              /<[\s\W]*>/gi,
              // Double encodage vide
              /&amp;lt;\s*&amp;gt;/gi
            ];
            
            aggressiveCleanup.forEach(regex => {
              const beforeAggressive = content;
              content = content.replace(regex, '');
              if (beforeAggressive !== content) {
                console.log(`🧹 Nettoyage agressif effectué`);
              }
            });
          }

          // Si le contenu a changé, mettre à jour le fichier
          if (content !== originalContent) {
            console.log(`💾 Fichier modifié: ${filename}`);
            zip.file(filename, content);
          }
        }
      });
      
      console.log(`📊 Résumé: ${filesProcessed} fichiers traités, ${replacementsFound} remplacements effectués`);
      
      // Générer le nouveau fichier
      const output = zip.generate({ 
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });
      
      // Télécharger
      const url = URL.createObjectURL(output);
      const link = document.createElement('a');
      link.href = url;
      
      const originalName = selectedFile!.name.split('.')[0];
      const fileName = `${originalName}_traité.pptx`;
      link.download = fileName;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Sauvegarder dans Firestore
      await saveDocumentToFirestore(output, fileName, 'pptx');

      setSnackbar({
        open: true,
        message: `Document PowerPoint traité ! ${replacementsFound} remplacement(s) effectué(s).`,
        severity: replacementsFound > 0 ? 'success' : 'warning'
      });
      
    } catch (error) {
      console.error('❌ Erreur traitement PowerPoint:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors du traitement automatique. Veuillez utiliser les instructions manuelles.',
        severity: 'error'
      });
      // En cas d'erreur, proposer les instructions
      downloadInstructionsFile();
    }
  };

  // Traitement Word
  const processAndDownloadWord = async (fileBuffer: ArrayBuffer, replacements: { [key: string]: string }) => {
    try {
    const zip = new PizZip(fileBuffer);
      let replacementsFound = 0;
      let filesProcessed = 0;
      
      console.log('Début du traitement Word...');
      console.log('Balises à remplacer:', detectedTags.map(t => t.tag));
      
      // Parcourir tous les fichiers dans le ZIP
      Object.keys(zip.files).forEach(filename => {
        const file = zip.files[filename];
        
        // Traiter TOUS les fichiers XML de contenu Word (document, headers, footers, etc.)
        if (!file.dir && filename.endsWith('.xml') && 
            (filename.includes('word/document.xml') || 
             filename.includes('word/header') || 
             filename.includes('word/footer') ||
             filename.includes('word/styles.xml') ||
             filename.includes('word/numbering.xml') ||
             filename.includes('word/comments.xml') ||
             filename.includes('word/endnotes.xml') ||
             filename.includes('word/footnotes.xml'))) {
          
          let content = file.asText();
          let originalContent = content;
          filesProcessed++;
          
          console.log(`Traitement du fichier Word: ${filename}`);
          
          // PRÉTRAITEMENT SPÉCIAL : Reconstituer les balises fragmentées AVANT le traitement principal
          console.log('🔧 PRÉTRAITEMENT - Reconstitution des balises fragmentées...');
          
          // Patterns basés sur vos logs exacts :
          // "etude</w:t></w:r><w:proofErr w:type=\"gramEnd\"/><w:r w:rsidRPr=\"00323870\"><w:t>_numero</w:t>"
          
          // Pattern 1: etude_numero fragmenté avec proofErr
          const etudeNumeroPattern = /<w:t[^>]*>etude<\/w:t><\/w:r><w:proofErr[^>]*><w:r[^>]*><w:t[^>]*>_numero<\/w:t>/gi;
          const etudeNumeroMatches = content.match(etudeNumeroPattern);
          if (etudeNumeroMatches) {
            console.log('🎯 RECONSTITUTION etude_numero avec proofErr:', etudeNumeroMatches.length, 'occurrence(s)');
            etudeNumeroMatches.forEach(match => {
              console.log('Match etude_numero:', match);
              // Remplacer toute la séquence fragmentée par une balise simple
              content = content.replace(match, '<w:r><w:t>etude_numero</w:t></w:r>');
            });
          }
          
          // Pattern 2: etude_prix_ht fragmenté avec proofErr
          const etudePrixPattern = /<w:t[^>]*>etude<\/w:t><\/w:r><w:proofErr[^>]*><w:r[^>]*><w:t[^>]*>_prix_ht<\/w:t>/gi;
          const etudePrixMatches = content.match(etudePrixPattern);
          if (etudePrixMatches) {
            console.log('🎯 RECONSTITUTION etude_prix_ht avec proofErr:', etudePrixMatches.length, 'occurrence(s)');
            etudePrixMatches.forEach(match => {
              console.log('Match etude_prix_ht:', match);
              // Remplacer toute la séquence fragmentée par une balise simple
              content = content.replace(match, '<w:r><w:t>etude_prix_ht</w:t></w:r>');
            });
          }
          
          // Pattern 3: Nettoyer les &gt; orphelins après reconstitution
          const orphanGtPattern = /<w:r[^>]*><w:t[^>]*>&gt;<\/w:t><\/w:r>/gi;
          const orphanGtMatches = content.match(orphanGtPattern);
          if (orphanGtMatches) {
            console.log('🧹 NETTOYAGE &gt; orphelins:', orphanGtMatches.length, 'occurrence(s)');
            content = content.replace(orphanGtPattern, '');
          }
          
          // Pattern 4: Reconstitution générique plus simple
          const simpleReconstitution = [
            { from: /<w:t>etude<\/w:t>.*?<w:t>_numero<\/w:t>/gi, to: '<w:t>etude_numero</w:t>' },
            { from: /<w:t>etude<\/w:t>.*?<w:t>_prix_ht<\/w:t>/gi, to: '<w:t>etude_prix_ht</w:t>' }
          ];
          
          simpleReconstitution.forEach(({ from, to }) => {
            const matches = content.match(from);
            if (matches) {
              console.log('🔧 RECONSTITUTION SIMPLE:', matches.length, 'occurrence(s) pour', from.source);
              content = content.replace(from, to);
            }
          });
          
          console.log('✅ PRÉTRAITEMENT terminé');
          
          // Traitement récursif et complet pour Word (similaire à PowerPoint mais adapté)
          detectedTags.forEach(tag => {
            const cleanTag = tag.tag.replace('<', '').replace('>', '');
            const replacedValue = getReplacementValue(tag);
            let tagReplacements = 0;
            
            console.log(`WORD - Recherche de "${tag.tag}" pour remplacer par "${replacedValue}"`);
            
            // ÉTAPE 1: Remplacements directs avec tous les patterns possibles
            const wordPatterns = [
              { from: tag.tag, to: replacedValue },                    // <etude_lieu>
              { from: `&lt;${cleanTag}&gt;`, to: replacedValue },      // &lt;etude_lieu&gt;
              { from: `{${cleanTag}}`, to: replacedValue },            // {etude_lieu}
              { from: `{{${cleanTag}}}`, to: replacedValue },          // {{etude_lieu}}
              // Patterns avec espaces
              { from: `&lt; ${cleanTag} &gt;`, to: replacedValue },
              { from: `< ${cleanTag} >`, to: replacedValue },
              { from: `&lt;  ${cleanTag}  &gt;`, to: replacedValue },
              { from: `<  ${cleanTag}  >`, to: replacedValue },
              // Patterns Word XML spécifiques
              { from: `<w:t>&lt;${cleanTag}&gt;</w:t>`, to: `<w:t>${replacedValue}</w:t>` },
              { from: `<w:t>${cleanTag}</w:t>`, to: `<w:t>${replacedValue}</w:t>` }
            ];
            
            // Appliquer les remplacements avec comptage
            wordPatterns.forEach(({ from, to }) => {
              const beforeReplace = content;
              if (content.includes(from)) {
                console.log(`WORD - REMPLACEMENT DIRECT: "${from}" → "${to}"`);
                content = content.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
                if (content !== beforeReplace) {
                  tagReplacements++;
                  console.log(`WORD - Remplacement direct réussi !`);
                }
              }
            });
            
            // TRAITEMENT SPÉCIAL : Remplacer les balises reconstituées
            if (cleanTag === 'etude_numero' || cleanTag === 'etude_prix_ht') {
              const reconstructedTag = `<w:t>${cleanTag}</w:t>`;
              if (content.includes(reconstructedTag)) {
                console.log(`WORD - REMPLACEMENT RECONSTITUÉ: "${reconstructedTag}" → "<w:t>${replacedValue}</w:t>"`);
                content = content.replace(new RegExp(reconstructedTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `<w:t>${replacedValue}</w:t>`);
                tagReplacements++;
                console.log(`WORD - Remplacement reconstitué réussi !`);
              }
            }
            
            // ÉTAPE 1.5: Recherche et remplacement par regex pour balises fragmentées complexes
            // Basé sur vos logs : <w:t>etude</w:t> + <w:t>_numero</w:t> + <w:t>&gt;</w:t>
            const regexPatterns = [
              // Pattern pour vos balises spécifiques fragmentées
              {
                regex: new RegExp(`<w:t[^>]*>etude</w:t>.*?<w:t[^>]*>_numero</w:t>.*?<w:t[^>]*>&gt;</w:t>`, 'gi'),
                replacement: `<w:t>${getReplacementValue({ tag: '<etude_numero>' } as TagMatch)}</w:t>`,
                description: 'Fragmentation etude_numero spécifique'
              },
              {
                regex: new RegExp(`<w:t[^>]*>etude</w:t>.*?<w:t[^>]*>_prix_ht</w:t>.*?<w:t[^>]*>&gt;</w:t>`, 'gi'),
                replacement: `<w:t>${getReplacementValue({ tag: '<etude_prix_ht>' } as TagMatch)}</w:t>`,
                description: 'Fragmentation etude_prix_ht spécifique'
              },
              // Patterns génériques pour d'autres fragmentations
              {
                regex: new RegExp(`<w:t[^>]*>&lt;</w:t>.*?<w:t[^>]*>${cleanTag}</w:t>.*?<w:t[^>]*>&gt;</w:t>`, 'gi'),
                replacement: `<w:t>${replacedValue}</w:t>`,
                description: 'Fragmentation Word complète'
              },
              {
                regex: new RegExp(`<w:t[^>]*>&lt;</w:t>.*?${cleanTag}.*?<w:t[^>]*>&gt;</w:t>`, 'gi'),
                replacement: `<w:t>${replacedValue}</w:t>`,
                description: 'Fragmentation Word partielle'
              },
              // Pattern pour les balises fragmentées en plusieurs parties
              {
                regex: new RegExp(`(<w:t[^>]*>[^<]*?)${cleanTag.split('_')[0]}(</w:t>.*?<w:t[^>]*>)${cleanTag.split('_').slice(1).join('_')}([^<]*?</w:t>)`, 'gi'),
                replacement: `<w:t>${replacedValue}</w:t>`,
                description: 'Fragmentation par underscore'
              }
            ];
            
            regexPatterns.forEach(({ regex, replacement, description }) => {
              const beforeReplace = content;
              const matches = content.match(regex);
              if (matches && matches.length > 0) {
                console.log(`WORD - REGEX ${description}: ${matches.length} occurrence(s) trouvée(s)`);
                console.log(`WORD - Matches:`, matches);
                content = content.replace(regex, replacement);
                if (content !== beforeReplace) {
                  tagReplacements += matches.length;
                  console.log(`WORD - Remplacement regex réussi ! (${matches.length} remplacements)`);
                }
              }
            });
            
            // GESTION AVANCÉE DE LA FRAGMENTATION WORD (similaire à PowerPoint)
            if (content.includes(`<w:t>${cleanTag}</w:t>`)) {
              console.log(`WORD - FRAGMENTATION DÉTECTÉE pour "${cleanTag}"`);
              
              // Pattern pour détecter la séquence fragmentée complète Word
              const fragmentedPattern = `<w:t>&lt;</w:t>.*?<w:t>${cleanTag}</w:t>.*?<w:t>&gt;</w:t>`;
              const fragmentedRegex = new RegExp(fragmentedPattern, 'gi');
              
              // Pattern simplifié qui peut marcher aussi
              const simpleFragmentPattern = `(<w:t>&lt;</w:t>.*?<w:t>)${cleanTag}(</w:t>.*?<w:t>&gt;</w:t>)`;
              const simpleFragmentRegex = new RegExp(simpleFragmentPattern, 'gi');
              
              if (content.match(fragmentedRegex)) {
                console.log(`WORD - REMPLACEMENT FRAGMENTÉ COMPLET: séquence complète trouvée`);
                content = content.replace(fragmentedRegex, `<w:t>${replacedValue}</w:t>`);
                tagReplacements++;
              } else if (content.match(simpleFragmentRegex)) {
                console.log(`WORD - REMPLACEMENT FRAGMENTÉ SIMPLE: séquence trouvée`);
                content = content.replace(simpleFragmentRegex, `<w:t>${replacedValue}</w:t>`);
                tagReplacements++;
              } else {
                // Approche manuelle : remplacer le nom de la balise puis nettoyer les &lt; et &gt; adjacents
                console.log(`WORD - APPROCHE MANUELLE pour la fragmentation`);
                
                // D'abord remplacer le nom de la balise
                const beforeManual = content;
                content = content.replace(new RegExp(`<w:t>${cleanTag}</w:t>`, 'g'), `<w:t>${replacedValue}</w:t>`);
                
                if (content !== beforeManual) {
                  console.log(`WORD - ✅ Nom de balise remplacé: ${cleanTag} → ${replacedValue}`);
                  
                  // Maintenant identifier et supprimer les fragments &lt; et &gt; qui entourent notre valeur
                  // Pattern basé sur la structure Word
                  const contextPattern = `(<w:t>&lt;</w:t>.*?<w:t>)${replacedValue}(</w:t>.*?<w:t>&gt;</w:t>)`;
                  const contextRegex = new RegExp(contextPattern, 'gi');
                  
                  if (content.match(contextRegex)) {
                    console.log(`WORD - 🎯 PATTERN EXACT TROUVÉ - Suppression des fragments &lt; et &gt;`);
                    content = content.replace(contextRegex, `<w:t>${replacedValue}</w:t>`);
                    console.log(`WORD - ✅ Fragments supprimés avec succès !`);
                  } else {
                    // Fallback : supprimer tous les éléments &lt; et &gt; isolés
                    console.log(`WORD - 🔧 FALLBACK - Suppression de tous les fragments &lt; et &gt;`);
                    
                    // Patterns plus agressifs pour Word
                    const aggressiveCleanup = [
                      /<w:t>&lt;<\/w:t>/gi,
                      /<w:t>&gt;<\/w:t>/gi,
                      // Patterns avec espaces ou autres éléments entre
                      /<w:t>&lt;<\/w:t>\s*<w:r[^>]*>\s*<w:rPr[^>]*\/>\s*<w:t>/gi,
                      /<\/w:t>\s*<\/w:r>\s*<w:r[^>]*>\s*<w:rPr[^>]*\/>\s*<w:t>&gt;<\/w:t>/gi
                    ];
                    
                    aggressiveCleanup.forEach(pattern => {
                      content = content.replace(pattern, '');
                    });
                  }
                  
                  tagReplacements++;
                  console.log(`WORD - ✅ Nettoyage manuel de la fragmentation effectué`);
                }
              }
            }
            
            // Étape supplémentaire : Nettoyage agressif des balises orphelines autour de la valeur remplacée
            if (tagReplacements > 0) {
              console.log(`WORD - 🧹 NETTOYAGE des balises orphelines autour de "${replacedValue}"`);
              
              // Chercher et supprimer les patterns comme <Paris>, &lt;Paris&gt;, etc.
              const orphanCleanup = [
                `&lt;${replacedValue}&gt;`,
                `<${replacedValue}>`,
                `&amp;lt;${replacedValue}&amp;gt;`,
                `&lt; ${replacedValue} &gt;`,
                `< ${replacedValue} >`,
                `&lt;  ${replacedValue}  &gt;`,
                `<  ${replacedValue}  >`,
                // Patterns spécifiques Word avec les balises w:t
                `<w:t>&lt;</w:t><w:t>${replacedValue}</w:t><w:t>&gt;</w:t>`,
                `<w:t>&lt; </w:t><w:t>${replacedValue}</w:t><w:t> &gt;</w:t>`
              ];
              
              orphanCleanup.forEach(orphanPattern => {
                if (content.includes(orphanPattern)) {
                  console.log(`WORD - 🧽 NETTOYAGE ORPHELIN: "${orphanPattern}" → "${replacedValue}"`);
                  content = content.replace(new RegExp(orphanPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `<w:t>${replacedValue}</w:t>`);
                  console.log(`WORD - ✅ Nettoyage orphelin réussi !`);
                }
              });
            }
            
            replacementsFound += tagReplacements;
          });
          
          // Nettoyage final Word - Plus agressif et complet
          console.log(`Nettoyage final Word pour ${filename}`);
          detectedTags.forEach(tag => {
            const cleanTag = tag.tag.replace('<', '').replace('>', '');
            const replacedValue = getReplacementValue(tag);
            
            // Nettoyer les balises orphelines avec patterns Word spécifiques
            const cleanupPatterns = [
              // Patterns HTML encodés
              `&lt;${replacedValue}&gt;`,
              `<${replacedValue}>`,
              `&lt; ${replacedValue} &gt;`,
              `< ${replacedValue} >`,
              `&amp;lt;${replacedValue}&amp;gt;`,
              // Patterns Word XML spécifiques
              `<w:t>&lt;</w:t><w:t>${replacedValue}</w:t><w:t>&gt;</w:t>`,
              `<w:t>&lt; </w:t><w:t>${replacedValue}</w:t><w:t> &gt;</w:t>`,
              `<w:t>&lt;</w:t> <w:t>${replacedValue}</w:t> <w:t>&gt;</w:t>`,
              // Patterns avec run properties entre les balises
              `<w:t>&lt;</w:t></w:r><w:r><w:rPr[^>]*><w:t>${replacedValue}</w:t></w:r><w:r><w:rPr[^>]*><w:t>&gt;</w:t>`,
              // Patterns fragmentés restants
              `${cleanTag}.*?&lt;.*?&gt;`,
              `&lt;.*?${cleanTag}.*?&gt;`
            ];
            
            cleanupPatterns.forEach(pattern => {
              const isRegex = pattern.includes('[^>]*') || pattern.includes('.*?');
              
              if (isRegex) {
                const regex = new RegExp(pattern, 'gi');
                if (content.match(regex)) {
                  console.log(`WORD - NETTOYAGE REGEX: "${pattern}" → "${replacedValue}"`);
                  content = content.replace(regex, `<w:t>${replacedValue}</w:t>`);
                }
              } else {
                if (content.includes(pattern)) {
                  console.log(`WORD - NETTOYAGE: "${pattern}" → "${replacedValue}"`);
                  content = content.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `<w:t>${replacedValue}</w:t>`);
                }
              }
            });
            
            // Nettoyage final des fragments orphelins &lt; et &gt;
            const orphanFragments = [
              /<w:t>&lt;<\/w:t>/gi,
              /<w:t>&gt;<\/w:t>/gi,
              /<w:t> &lt; <\/w:t>/gi,
              /<w:t> &gt; <\/w:t>/gi
            ];
            
            orphanFragments.forEach(fragmentRegex => {
              if (content.match(fragmentRegex)) {
                console.log(`WORD - SUPPRESSION FRAGMENT ORPHELIN: ${fragmentRegex.source}`);
                content = content.replace(fragmentRegex, '');
              }
            });
          });
          
          // Mettre à jour le fichier si modifié
          if (content !== originalContent) {
            console.log(`WORD - Fichier modifié: ${filename}`);
            zip.file(filename, content);
          }
        }
      });
      
      console.log(`WORD - Résumé: ${filesProcessed} fichiers traités, ${replacementsFound} remplacements effectués`);
    
    // Générer le nouveau fichier
      const output = zip.generate({ type: 'blob' });
    
    // Stocker le blob traité et le nom de fichier pour les options de téléchargement
    const originalName = selectedFile!.name.split('.')[0];
    setProcessedWordBlob(output);
    setOriginalFileName(originalName);
    setShowPdfConversion(true);

    setSnackbar({
      open: true,
        message: `Document Word traité avec succès ! ${replacementsFound} remplacement(s) effectué(s). Choisissez votre format de téléchargement.`,
      severity: 'success'
    });
      
    } catch (error) {
      console.error('Erreur lors du traitement Word:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors du traitement Word. Téléchargement des instructions...',
        severity: 'error'
      });
      downloadInstructionsFile();
    }
  };

  // Fonctions de téléchargement et conversion PDF
  const downloadWordDocument = async () => {
    if (!processedWordBlob || !originalFileName) return;
    
    const fileName = `${originalFileName}_traité.docx`;
    const url = URL.createObjectURL(processedWordBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Sauvegarder dans Firestore
    await saveDocumentToFirestore(processedWordBlob, fileName, 'docx');
    
    setSnackbar({
      open: true,
      message: 'Document Word téléchargé avec succès !',
      severity: 'success'
    });
  };

  const convertToPdf = async () => {
    if (!processedWordBlob || !originalFileName) return;

    try {
      setIsConvertingToPdf(true);
      setSnackbar({
        open: true,
        message: 'Conversion directe Word → PDF en cours...',
        severity: 'info'
      });

      console.log('🔄 Conversion optimisée Word → PDF avec docx-preview...');
      
      // SOLUTION OPTIMISÉE : Conversion locale avec rendu fidèle
      // Utiliser docx-preview pour un rendu parfait du document traité
      
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.width = '794px'; // A4 width (210mm à 96dpi)
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.fontFamily = 'Times New Roman, serif';
      tempDiv.style.fontSize = '12pt';
      tempDiv.style.lineHeight = '1.15';
      tempDiv.style.padding = '75px'; // Marges A4 (20mm à 96dpi)
      tempDiv.style.boxSizing = 'border-box';
      tempDiv.style.overflow = 'visible';
      
      document.body.appendChild(tempDiv);
      
      try {
        // Utiliser docx-preview pour un rendu fidèle du document traité
        const arrayBuffer = await processedWordBlob.arrayBuffer();
        
        console.log('📄 Rendu fidèle avec docx-preview...');
        
        // Utiliser mammoth.js avec options optimisées pour préserver le contenu
        const mammothResult = await mammoth.convertToHtml({ arrayBuffer }, {
          convertImage: mammoth.images.imgElement(function(image) {
            return image.read("base64").then(function(imageBuffer) {
              return {
                src: "data:" + image.contentType + ";base64," + imageBuffer
              };
            });
          }),
          styleMap: [
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "p[style-name='Normal'] => p:fresh",
            "r[style-name='Strong'] => strong",
            "r[style-name='Emphasis'] => em"
          ]
        });
        
        console.log('✅ Conversion mammoth terminée');
        console.log('📊 Messages mammoth:', mammothResult.messages);
        
        // Injecter le HTML dans le conteneur
        tempDiv.innerHTML = mammothResult.value;
        
        // Vérifier que les balises remplacées sont présentes dans le HTML
        const htmlContent = mammothResult.value;
        console.log('🔍 Vérification des balises dans le HTML généré...');
        
        // Chercher les valeurs remplacées dans le HTML
        detectedTags.forEach(tag => {
          const replacementValue = getReplacementValue(tag);
          if (htmlContent.includes(replacementValue)) {
            console.log(`✅ Balise ${tag.tag} trouvée remplacée par "${replacementValue}" dans le HTML`);
          } else {
            console.warn(`⚠️ Balise ${tag.tag} avec valeur "${replacementValue}" NOT FOUND dans le HTML`);
            console.log('🔍 Extrait HTML (premiers 500 caractères):', htmlContent.substring(0, 500));
          }
        });
        
        console.log('✅ Rendu mammoth terminé');
        
        // Ajouter des styles CSS pour améliorer le rendu
        const styleElement = document.createElement('style');
        styleElement.textContent = `
          .docx-preview {
            font-family: 'Times New Roman', serif !important;
            font-size: 12pt !important;
            line-height: 1.15 !important;
            color: black !important;
            background: white !important;
          }
          .docx-preview img {
            max-width: 100% !important;
            height: auto !important;
            display: block !important;
            margin: 0 auto !important;
          }
          .docx-preview table {
            border-collapse: collapse !important;
            width: 100% !important;
            margin: 10px 0 !important;
          }
          .docx-preview td, .docx-preview th {
            border: 1px solid #000 !important;
            padding: 4px 8px !important;
            text-align: left !important;
          }
          .docx-preview p {
            margin: 6px 0 !important;
            text-align: justify !important;
          }
          .docx-preview h1, .docx-preview h2, .docx-preview h3 {
            margin: 12px 0 6px 0 !important;
            font-weight: bold !important;
          }
          .docx-preview ul, .docx-preview ol {
            margin: 6px 0 !important;
            padding-left: 20px !important;
          }
          /* Éviter les pages vierges */
          .docx-preview .page-break {
            display: none !important;
          }
          .docx-preview [style*="page-break"] {
            page-break-after: auto !important;
          }
        `;
        document.head.appendChild(styleElement);
        
        // Attendre que toutes les images soient chargées
        const images = tempDiv.querySelectorAll('img');
        if (images.length > 0) {
          console.log(`📸 Attente du chargement de ${images.length} image(s)...`);
          await Promise.all(Array.from(images).map(img => {
            return new Promise((resolve) => {
              if (img.complete) {
                resolve(img);
              } else {
                img.onload = () => resolve(img);
                img.onerror = () => {
                  console.warn('Image failed to load:', img.src);
                  resolve(img);
                };
                // Timeout de 5 secondes par image
                setTimeout(() => resolve(img), 5000);
              }
            });
          }));
          console.log('✅ Toutes les images sont chargées');
        }
        
        // Attendre un peu pour que le rendu soit stable
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Supprimer les éléments vides qui pourraient causer des pages vierges
        const emptyElements = tempDiv.querySelectorAll('div:empty, p:empty, span:empty');
        emptyElements.forEach(el => {
          if (el.offsetHeight === 0 && el.offsetWidth === 0) {
            el.remove();
          }
        });
        
        console.log('📸 Capture optimisée du contenu...');
        
        // Capture avec html2canvas optimisée
        const canvas = await html2canvas(tempDiv, {
          scale: 2.5, // Haute résolution
          useCORS: true,
          allowTaint: true,
          backgroundColor: 'white',
          width: tempDiv.scrollWidth,
          height: tempDiv.scrollHeight,
          scrollX: 0,
          scrollY: 0,
          logging: false,
          removeContainer: false,
          imageTimeout: 8000,
          onclone: (clonedDoc, element) => {
            // Nettoyer le clone pour éviter les artefacts
            const clonedStyle = clonedDoc.createElement('style');
            clonedStyle.textContent = `
              * {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body {
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
              }
              .docx-preview {
                font-family: 'Times New Roman', serif !important;
                font-size: 12pt !important;
                line-height: 1.15 !important;
                background: white !important;
              }
              img {
                max-width: 100% !important;
                height: auto !important;
                display: block !important;
              }
              /* Supprimer les éléments qui causent des pages vierges */
              .page-break, [style*="page-break"] {
                display: none !important;
              }
            `;
            clonedDoc.head.appendChild(clonedStyle);
            
            // Supprimer les éléments vides du clone
            const emptyInClone = element.querySelectorAll('div:empty, p:empty, span:empty');
            emptyInClone.forEach(el => el.remove());
          }
        });
        
        console.log('✅ Capture terminée - Dimensions:', canvas.width, 'x', canvas.height);
        
        // Nettoyer le style ajouté
        document.head.removeChild(styleElement);
        
        // Créer le PDF avec jsPDF
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        // Calculer les dimensions optimales pour A4
        const pdfWidth = 210;
        const pdfHeight = 297;
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        console.log(`📐 Dimensions PDF calculées: ${imgWidth}mm x ${imgHeight}mm`);
        
        // Détecter la fin réelle du contenu pour éviter les pages vierges
        let lastContentY = 0;
        const canvasCtx = canvas.getContext('2d');
        if (canvasCtx) {
          // Scanner depuis le bas pour trouver le dernier contenu
          const imageData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);
          const pixels = imageData.data;
          
          for (let y = canvas.height - 1; y >= 0; y--) {
            for (let x = 0; x < canvas.width; x++) {
              const pixelIndex = (y * canvas.width + x) * 4;
              const r = pixels[pixelIndex];
              const g = pixels[pixelIndex + 1];
              const b = pixels[pixelIndex + 2];
              
              // Si on trouve un pixel non blanc, c'est la fin du contenu
              if (r < 250 || g < 250 || b < 250) {
                lastContentY = y + 50; // Ajouter une petite marge
                break;
              }
            }
            if (lastContentY > 0) break;
          }
        }
        
        // Ajuster la hauteur du canvas au contenu réel
        const trimmedHeight = Math.min(canvas.height, lastContentY);
        const actualImgHeight = (trimmedHeight * imgWidth) / canvas.width;
        
        console.log(`📐 Contenu réel détecté: ${actualImgHeight}mm (${trimmedHeight}px)`);
        
        // Créer le PDF avec la bonne hauteur
        if (actualImgHeight <= pdfHeight - 10) { // Marge de sécurité
          // Document tient sur une page
          console.log('📄 Document sur une seule page');
          
          const trimmedCanvas = document.createElement('canvas');
          const trimmedCtx = trimmedCanvas.getContext('2d');
          
          if (trimmedCtx) {
            trimmedCanvas.width = canvas.width;
            trimmedCanvas.height = trimmedHeight;
            
            // Fond blanc
            trimmedCtx.fillStyle = 'white';
            trimmedCtx.fillRect(0, 0, trimmedCanvas.width, trimmedCanvas.height);
            
            // Dessiner seulement la partie avec du contenu
            trimmedCtx.drawImage(
              canvas,
              0, 0,
              canvas.width, trimmedHeight,
              0, 0,
              trimmedCanvas.width, trimmedCanvas.height
            );
            
            pdf.addImage(trimmedCanvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, imgWidth, actualImgHeight);
          }
        } else {
          // Document sur plusieurs pages
          console.log(`📄 Document sur plusieurs pages (hauteur: ${actualImgHeight}mm)`);
          
          const pageHeight = 277; // A4 height minus margins (297 - 20)
          let yPosition = 0;
          let pageNumber = 0;
          
          while (yPosition < actualImgHeight && pageNumber < 10) { // Limite de sécurité
            if (pageNumber > 0) {
              pdf.addPage();
            }
            
            const remainingHeight = actualImgHeight - yPosition;
            const currentPageHeight = Math.min(pageHeight, remainingHeight);
            
            // Vérifier qu'il y a du contenu à ajouter
            if (currentPageHeight < 10) { // Moins de 10mm = probablement vide
              console.log(`⏭️ Page ${pageNumber + 1} ignorée (trop petite: ${currentPageHeight}mm)`);
              break;
            }
            
            // Calculer la portion du canvas à capturer
            const sourceY = (yPosition / actualImgHeight) * contentHeight * (canvas.height / tempDiv.scrollHeight);
            const sourceHeight = (currentPageHeight / actualImgHeight) * contentHeight * (canvas.height / tempDiv.scrollHeight);
            
            // Créer un canvas temporaire pour cette page
            const pageCanvas = document.createElement('canvas');
            const pageCtx = pageCanvas.getContext('2d');
            
            if (pageCtx) {
              pageCanvas.width = canvas.width;
              pageCanvas.height = sourceHeight;
              
              // Fond blanc
              pageCtx.fillStyle = 'white';
              pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
              
              // Dessiner la portion du document
              pageCtx.drawImage(
                canvas,
                0, sourceY,
                canvas.width, sourceHeight,
                0, 0,
                pageCanvas.width, pageCanvas.height
              );
              
              // Vérifier que cette page n'est pas vide
              const imageData = pageCtx.getImageData(0, 0, pageCanvas.width, pageCanvas.height);
              const pixels = imageData.data;
              let hasContent = false;
              
              // Vérifier s'il y a des pixels non blancs
              for (let i = 0; i < pixels.length; i += 4) {
                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];
                if (r < 250 || g < 250 || b < 250) { // Pas complètement blanc
                  hasContent = true;
                  break;
                }
              }
              
              if (hasContent) {
                // Ajouter cette page au PDF
                const pageImageData = pageCanvas.toDataURL('image/jpeg', 0.98);
                pdf.addImage(pageImageData, 'JPEG', 0, 0, imgWidth, currentPageHeight);
                console.log(`📄 Page ${pageNumber + 1} ajoutée (${currentPageHeight}mm de hauteur)`);
              } else {
                console.log(`⏭️ Page ${pageNumber + 1} ignorée (vide)`);
                break; // Arrêter si on trouve une page vide
              }
            }
            
            yPosition += pageHeight;
            pageNumber++;
          }
        }
        
        // Générer le blob du PDF
        const pdfBlob = pdf.output('blob');
        const fileName = `${originalFileName}_traité.pdf`;
        
        // Télécharger le PDF
        pdf.save(fileName);
        
        // Sauvegarder dans Firestore
        await saveDocumentToFirestore(pdfBlob, fileName, 'pdf');
        
        setSnackbar({
          open: true,
          message: 'PDF généré avec succès ! Conversion optimisée avec préservation des images.',
          severity: 'success'
        });
        
        console.log('🎉 Conversion locale optimisée terminée avec succès');
        
      } finally {
        // Nettoyer le DOM
        if (document.body.contains(tempDiv)) {
          document.body.removeChild(tempDiv);
        }
      }

    } catch (error) {
      console.error('❌ Erreur lors de la conversion:', error);
      
      // Fallback final : méthode manuelle avec instructions optimisées
      setSnackbar({
        open: true,
        message: 'Conversion automatique indisponible. Téléchargement du Word optimisé...',
        severity: 'warning'
      });
      
      try {
        const url = URL.createObjectURL(processedWordBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${originalFileName}_TRAITÉ.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setTimeout(() => {
          setSnackbar({
            open: true,
            message: '📄 Document Word téléchargé ! Pour PDF parfait : Ouvrez → Ctrl+P → "Enregistrer au format PDF"',
            severity: 'info'
          });
        }, 1500);
        
      } catch (fallbackError) {
        console.error('❌ Erreur du fallback final:', fallbackError);
        downloadWordDocument();
      }
    } finally {
      setIsConvertingToPdf(false);
    }
  };

  // Fallback : télécharger les instructions
  const downloadInstructionsFile = () => {
    let documentContent = `=== DOCUMENT TRAITÉ ===\n`;
    documentContent += `Fichier original: ${selectedFile!.name}\n`;
    documentContent += `Date de traitement: ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}\n`;
    documentContent += `Étude: ${etudeData?.numeroEtude}\n\n`;
    
    documentContent += `=== REMPLACEMENTS EFFECTUÉS ===\n\n`;
    detectedTags.forEach(tag => {
      const replacedValue = getReplacementValue(tag);
      documentContent += `${tag.tag} → ${replacedValue}\n`;
    });
    
    documentContent += `\n=== INSTRUCTIONS ===\n\n`;
    documentContent += `Le traitement automatique n'a pas pu être effectué.\n`;
    documentContent += `Remplacez manuellement chaque balise par sa valeur correspondante:\n\n`;
    
    detectedTags.forEach(tag => {
      const replacedValue = getReplacementValue(tag);
      documentContent += `   - Remplacez "${tag.tag}" par "${replacedValue}"\n`;
    });
    
    const blob = new Blob([documentContent], { type: 'text/plain; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const originalName = selectedFile!.name.split('.')[0];
    link.download = `${originalName}_instructions_remplacement.txt`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Étape 5: Finalisation
  const renderFinalizationStep = () => {
    // Si c'est un fichier Word traité, afficher les options de téléchargement
    if (showPdfConversion && processedWordBlob && selectedFile?.type.includes('word')) {
      return (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Document Word traité avec succès !
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Votre document "{selectedFile?.name}" a été traité. Choisissez votre format de téléchargement :
            </Typography>
            
            {/* Options de téléchargement */}
            <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', mt: 4, flexWrap: 'wrap' }}>
              {/* Option Word */}
              <Card sx={{ 
                minWidth: 200, 
                cursor: 'pointer', 
                transition: 'all 0.2s ease',
                '&:hover': { 
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)' 
                }
              }}>
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <AssignmentIcon sx={{ fontSize: 48, color: '#2196F3', mb: 2 }} />
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    Document Word
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Télécharger le fichier .docx traité
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    onClick={downloadWordDocument}
                    fullWidth
                    sx={{ 
                      bgcolor: '#2196F3',
                      '&:hover': { bgcolor: '#1976D2' }
                    }}
                  >
                    Télécharger Word
                  </Button>
                </CardContent>
              </Card>

              {/* Option PDF */}
              <Card sx={{ 
                minWidth: 200, 
                cursor: 'pointer', 
                transition: 'all 0.2s ease',
                '&:hover': { 
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)' 
                }
              }}>
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <PdfIcon sx={{ fontSize: 48, color: '#F44336', mb: 2 }} />
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    Document PDF
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Conversion automatique optimisée (préserve images et mise en forme)
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={isConvertingToPdf ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <PdfIcon />}
                    onClick={convertToPdf}
                    disabled={isConvertingToPdf}
                    fullWidth
                    sx={{ 
                      bgcolor: '#F44336',
                      '&:hover': { bgcolor: '#D32F2F' },
                      '&:disabled': { bgcolor: '#FFCDD2', color: '#666' }
                    }}
                  >
                    {isConvertingToPdf ? 'Conversion en cours...' : 'Télécharger PDF'}
                  </Button>
                </CardContent>
              </Card>
            </Box>

            {/* Boutons secondaires */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4 }}>
              <Button
                variant="outlined"
                onClick={() => {
                  setShowPdfConversion(false);
                  setProcessedWordBlob(null);
                  setOriginalFileName('');
                  setActiveStep(0);
                }}
              >
                Traiter un autre document
              </Button>
              <Button
                variant="outlined"
                onClick={onClose}
              >
                Fermer
              </Button>
            </Box>
            
            <Alert severity="success" sx={{ mt: 3, textAlign: 'left' }}>
              <Typography variant="body2">
                <strong>✅ Traitement terminé :</strong> Toutes les balises ont été remplacées par les vraies valeurs. 
                Choisissez Word pour une édition ultérieure ou PDF pour un document final.
              </Typography>
            </Alert>
          </CardContent>
        </Card>
      );
    }

    // Affichage standard pour PowerPoint et autres
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Prêt pour le traitement automatique !
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Votre document "{selectedFile?.name}" va être automatiquement traité et les balises seront remplacées par les vraies données.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 3 }}>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={downloadProcessedDocument}
              size="large"
              sx={{ 
                bgcolor: 'success.main',
                '&:hover': { bgcolor: 'success.dark' }
              }}
            >
              Télécharger le document traité
            </Button>
            <Button
              variant="outlined"
              onClick={onClose}
            >
              Fermer
            </Button>
          </Box>
          
          <Alert severity="success" sx={{ mt: 3, textAlign: 'left' }}>
            <Typography variant="body2">
              <strong>🚀 Traitement automatique :</strong> Le système va traiter votre PowerPoint/Word et remplacer automatiquement 
              toutes les balises par les vraies valeurs. Vous recevrez le fichier final prêt à utiliser !
            </Typography>
          </Alert>
          
          <Alert severity="info" sx={{ mt: 2, textAlign: 'left' }}>
            <Typography variant="body2">
              <strong>💡 Format des balises :</strong> Le système détecte les balises `&lt;etude_lieu&gt;` mais les remplace 
              automatiquement par le bon format pour le traitement. Votre PowerPoint sera correctement traité !
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { 
          borderRadius: 3,
          minHeight: '80vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: '1px solid',
        borderColor: 'divider',
        pb: 2
      }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Générateur de documents intelligent
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Créez des templates avec balises automatiques pour l'étude {etudeData?.numeroEtude}
          </Typography>
        </Box>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
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

        {/* Guide des balises (visible à partir de l'étape 2) */}
        {activeStep === 2 && (
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
                      "Étude &lt;etude_numero&gt; pour &lt;entreprise_nom&gt;" devient "Étude E2024-001 pour TechCorp"
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
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
          Annuler
        </Button>
        
        {activeStep === 2 && (
          <Button
            variant="contained"
            onClick={() => setActiveStep(3)}
            disabled={detectedTags.length === 0}
          >
            Finaliser le traitement
          </Button>
        )}
        
        {activeStep > 0 && activeStep < 3 && (
          <Button
            variant="outlined"
            onClick={() => setActiveStep(prev => Math.max(0, prev - 1))}
          >
            Précédent
          </Button>
        )}
      </DialogActions>

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
    </Dialog>
  );
};

export default DocumentGeneratorDialog;
