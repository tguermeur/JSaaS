import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';

// Déclaration TypeScript pour l'API EyeDropper
declare global {
  interface Window {
    EyeDropper: {
      new (): {
        open(): Promise<{ sRGBHex: string }>;
      };
    };
  }
}
import {
  Box,
  Typography,
  Button,
  TextField,
  Grid,
  IconButton,
  Divider,
  FormControl,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  Avatar,
  CircularProgress,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormGroup,
  Checkbox,
  Dialog
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  ArrowUpward as UploadIcon,
  Close as CloseIcon,
  PhotoCamera as PhotoCameraIcon,
  Download as DownloadIcon,
  Description as ReceiptIcon,
  Person as PersonIcon,
  Language as TranslateIcon,
  Menu as MenuIcon,
  Info as InfoIcon,
  Business as BusinessIcon,
  Assignment as AssignmentIcon,
  Email as EmailIcon,
  Send as SendIcon,
  Palette as PaletteIcon,
  Colorize as ColorizeIcon,
  FormatAlignLeft as FormatAlignLeftIcon,
  FormatAlignCenter as FormatAlignCenterIcon,
  FormatAlignRight as FormatAlignRightIcon,
  FormatAlignJustify as FormatAlignJustifyIcon,
  TextIncrease as TextIncreaseIcon,
  TextDecrease as TextDecreaseIcon,
  FormatBold as FormatBoldIcon,
  FormatItalic as FormatItalicIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, where, addDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db, storage } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import { getDecryptedUserDisplayName } from '../utils/decryptUserUtils';
import { Document, Page, Text, View, StyleSheet, Font, Image as PDFImage, pdf } from '@react-pdf/renderer';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { installPdfPolyfills } from '../utils/pdfPolyfill';
import { tokens } from '../theme/tokens';

installPdfPolyfills();

// Types définis localement
interface Mission {
  id: string;
  numeroMission: string;
  structureId: string;
  companyId: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
  missionTypeId?: string;
  studentCount: number;
  hoursPerStudent: string;
  chargeId: string;
  chargeName: string;
  title: string;
  salary: string;
  hours: number;
  requiresCV: boolean;
  requiresMotivation: boolean;
  isPublished: boolean;
  isPublic: boolean;
  priceHT: number;
  totalHT?: number;
  totalTTC?: number;
  tva?: number;
  updatedAt: Date;
  etape: 'Négociation' | 'Recrutement' | 'Facturation' | 'Audit';
  ecole?: string;
  createdBy?: string;
  contactId?: string;
  isArchived?: boolean;
}

interface Contact {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position?: string;
  linkedin?: string;
  gender?: 'homme' | 'femme';
  isDefault?: boolean;
}

interface QuoteLine {
  id: string;
  designation: string;
  quantity: number;
  unitPrice: number;
  tva: number;
  totalHT: number;
  totalTTC: number;
}

interface QuoteData {
  id?: string;
  missionId: string;
  companyInfo: {
    name: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    siret: string;
    logo?: string;
  };
  clientInfo: {
    name: string;
    address: string;
    complement: string;
    postalCode: string;
    city: string;
    country: string;
    siret?: string;
    vatNumber?: string;
    logo?: string;
    email?: string;
    phone?: string;
  };
  quoteInfo: {
    number: string;
    issueDate: string;
    validityPeriod: number;
    currency: string;
  };
  lines: QuoteLine[];
  totals: {
    totalHT: number;
    totalTVA: number;
    totalTTC: number;
  };
  notes?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

// Styles CSS pour React-PDF qui reproduisent Material-UI
const styles = StyleSheet.create({
  // Page principale
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 20,
    paddingTop: 8,
    paddingHorizontal: 60, // Augmentation des marges horizontales
    fontSize: 10,
    lineHeight: 1.2,
    color: '#333'
  },
  
  // En-tête avec les deux sections côte à côte
  header: {
    flexDirection: 'row', // Les sections gauche et droite côte à côte
    marginBottom: 10, // Réduit de 15 à 10
    marginTop: 0
  },
  
  // Container pour les sections structure et client
  headerContainer: {
    flexDirection: 'row',
    marginBottom: 10, // Réduit de 15 à 10
    marginTop: 0,
    width: '100%'
  },
  
  // Sections principales
  leftSection: {
    width: '50%',
    padding: 16, // Réduit de 24 à 16
    paddingTop: 6, // Réduit le padding supérieur
    backgroundColor: 'white',
    borderRadius: 8, // borderRadius: 2 = 8px
    marginRight: 12, // spacing: 3 = 12px
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)', // boxShadow: 1
    minHeight: 200, // Hauteur minimale au lieu de fit-content
    alignItems: 'flex-start' // Aligner le contenu en haut à gauche
  },
  
  rightSection: {
    width: '50%',
    padding: 16, // Réduit de 24 à 16
    paddingTop: 6, // Réduit le padding supérieur
    backgroundColor: 'white',
    borderRadius: 8, // borderRadius: 2 = 8px
    marginLeft: 12, // spacing: 3 = 12px
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)', // boxShadow: 1
    minHeight: 200, // Hauteur minimale au lieu de fit-content
    alignItems: 'flex-start' // Aligner le contenu en haut à gauche
  },
  
  // Titres
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333'
  },
  
  companyName: {
    fontSize: 12, // Réduit de 14 à 12 pour une meilleure lisibilité
    fontWeight: 'bold', // Plus gras pour le contraste
    marginBottom: 3, // Réduit de 6 à 3
    marginTop: 0, // Pas de marge supérieure pour l'alignement - aligné avec structureName
    color: '#000000' // Noir pur au lieu de #333
  },
  
  infoText: {
    fontSize: 9, // Réduit de 10 à 9
    marginBottom: 1, // Réduit de 2 à 1 pour un interligne encore plus serré
    color: '#000000', // Noir pur au lieu de #666
    lineHeight: 1.2 // Réduit de 1.3 à 1.2 pour un interligne plus serré
  },
  
  // Logo
  logoContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 4, // Réduit de 8 à 4
    marginTop: 0, // Pas de marge supérieure
    minHeight: 110 // Hauteur minimale pour aligner les noms (100px logo + 6px marginBottom + 4px marginBottom container)
  },
  
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 6 // Réduit de 12 à 6
  },
  
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: tokens.colors.brandTeal,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6 // Réduit de 12 à 6
  },
  
  logoText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: 'bold'
  },
  
  logoSubtitle: {
    fontSize: 6,
    color: '#666',
    textAlign: 'center'
  },
  
  // Espaceur invisible pour maintenir l'alignement quand pas de logo
  logoSpacer: {
    width: 100,
    height: 110, // Aligné avec logoContainer minHeight (100px logo + 6px marginBottom + 4px marginBottom container)
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    margin: '0 auto',
    marginBottom: 4 // Même marginBottom que logoContainer
  },
  
  // Informations structure
  structureName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 3, // Réduit de 5 à 3
    marginTop: 0, // Pas de marge supérieure - aligné avec companyName
    color: '#000000'
  },
  
  structureInfo: {
    fontSize: 8, // Réduit de 9 à 8
    marginBottom: 1,
    color: '#000000'
  },
  
  // Section droite - Informations client
  clientTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6, // Réduit de 10 à 6
    color: '#000000'
  },
  
  clientInfo: {
    fontSize: 8, // Réduit de 9 à 8
    marginBottom: 1,
    color: '#000000'
  },
  
  // Section devis (pleine largeur en dessous)
  quoteSection: {
    width: '100%',
    padding: 10, // Réduit de 15 à 10
    borderRadius: 4
  },
  
  quoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10 // Réduit de 15 à 10
  },
  
  quoteTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: tokens.colors.textPrimary
  },
  
  quoteMeta: {
    alignItems: 'flex-end',
    marginTop: -5
  },
  
  quoteDate: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2
  },
  
  quoteValidity: {
    fontSize: 6,
    color: '#666',
    marginTop: 0
  },
  
  // Tableau
  table: {
    marginTop: 5
  },
  
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#6366f1', // Sera remplacé dynamiquement
    padding: 6, // Réduit de 8 à 6
    borderRadius: 4,
    marginBottom: 3 // Réduit de 5 à 3
  },
  
  tableHeaderCell: {
    flex: 1,
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  
  tableRow: {
    flexDirection: 'row',
    padding: 6, // Réduit de 8 à 6
    borderBottom: `1px solid ${tokens.colors.borderLight}`
  },
  
  tableCell: {
    flex: 1,
    fontSize: 8,
    textAlign: 'center'
  },
  
  // Totaux
  totals: {
    marginTop: 10, // Réduit de 20 à 10
    alignItems: 'flex-end'
  },
  
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3, // Réduit de 5 à 3
    minWidth: 150
  },
  
  totalLabel: {
    fontSize: 10,
    color: '#666'
  },
  
  totalValue: {
    fontSize: 10,
    color: '#666'
  },
  
  totalTTC: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6366f1' // Sera remplacé dynamiquement
  },
  
  // Bas de page
  footer: {
    position: 'absolute',
    bottom: 30, // Réduit pour rapprocher du numéro de page
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    fontSize: 8,
    color: '#666',
    opacity: 0.7
  },
  
  footerLine1: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 5
  },
  
  footerLine2: {
    flexDirection: 'row',
    justifyContent: 'center'
  },
  
  siretFooter: {
    fontSize: 8,
    color: '#666',
    marginRight: 10
  },
  
  tvaFooter: {
    fontSize: 8,
    color: '#666',
    marginRight: 10
  },
  
  apeFooter: {
    fontSize: 8,
    color: '#666',
    marginRight: 10
  },
  
  pageNumber: {
    fontSize: 8,
    color: '#666'
  },

  pageNumberContainer: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    fontSize: 8,
    color: '#666',
    opacity: 0.7
  },
  
  // Champ libre (ancien style - gardé pour compatibilité)
  freeFieldContainer: {
    marginTop: 15,
    padding: 10,
    border: '1px solid #e0e0e0',
    borderRadius: 4,
    backgroundColor: '#ffffff'
  },
  
  // Champ libre - pleine largeur
  freeFieldFullWidth: {
    width: '100%',
    marginTop: 4, // Réduit pour rapprocher des totaux (prix)
    marginBottom: 4, // Réduit pour rapprocher des encarts de signature
    padding: 10 // Réduit de 15 à 10
  },
  
  freeFieldText: {
    fontSize: 10,
    color: '#333',
    lineHeight: 1.5,
    textAlign: 'left'
  },
  
  // Caractéristiques de la prestation
  characteristicsTable: {
    marginTop: 2, // Réduit pour rapprocher de la proposition commerciale
    marginBottom: 10, // Réduit de 20 à 10
    width: '100%'
  },
  
  characteristicsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: tokens.colors.textPrimary,
    marginBottom: 8 // Réduit de 10 à 8
  },
  
  characteristicsRow: {
    flexDirection: 'row',
    paddingVertical: 4, // Réduit de 6 à 4
    paddingHorizontal: 8,
    borderBottom: '1px solid #e0e0e0'
  },
  
  characteristicsLabel: {
    fontSize: 8,
    color: '#333',
    fontWeight: 'bold',
    width: '45%',
    marginRight: 10
  },
  
  characteristicsValue: {
    fontSize: 8,
    color: '#666',
    width: '55%'
  },
  
  // Encarts de signature
  signatureContainer: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 10,
    width: '100%'
  },
  
  signatureBox: {
    flex: 1,
    border: '1px solid #000',
    padding: 8,
    paddingTop: 4,
    paddingLeft: 4,
    minHeight: 70,
    marginRight: 10
  },
  
  signatureBoxLast: {
    flex: 1,
    border: '1px solid #000',
    padding: 8,
    paddingTop: 4,
    paddingLeft: 4,
    minHeight: 70,
    marginRight: 0
  },
  
  signatureText: {
    fontSize: 7,
    color: '#000',
    marginBottom: 8,
    marginTop: 0,
    textAlign: 'left'
  },
  
  signatureSpace: {
    minHeight: 40,
    marginTop: 12,
    paddingTop: 6
  }
});

// Fonction pour formater les dates en français (DD/MM/YYYY)
const formatDateToFrench = (dateString: string): string => {
  if (!dateString) return '';
  
  // Si c'est déjà au format YYYY-MM-DD (format HTML date input)
  if (dateString.includes('-')) {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }
  
  // Si c'est une autre date, essayer de la parser
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
};

// Fonctions utilitaires pour extraire les données
const getStructureData = (structure: any, mission: Mission | null) => ({
  name: structure?.nom || mission?.company || '',
  address: structure?.adresse || structure?.address || mission?.location || '',
  city: structure?.city || structure?.ville || '',
  postalCode: structure?.postalCode || structure?.codePostal || '',
  email: structure?.email && structure.email !== 'Non renseigné' ? structure.email : null,
  phone: (structure?.telephone && structure.telephone !== 'Non renseigné') || 
         (structure?.phone && structure.phone !== 'Non renseigné') ? 
         (structure?.telephone || structure?.phone) : null,
  siret: structure?.siret || null,
  ape: structure?.ape || null,
  chargeName: mission?.chargeName || null
});

const getClientData = (quoteData: QuoteData) => ({
  name: quoteData.clientInfo.name,
  address: quoteData.clientInfo.address,
  postalCode: quoteData.clientInfo.postalCode,
  city: quoteData.clientInfo.city,
  country: quoteData.clientInfo.country
});

// Fonction pour télécharger une image depuis une URL et la convertir en base64
const fetchImageAsBase64 = async (url: string): Promise<string> => {
  try {
    console.log('🔄 fetchImageAsBase64: Téléchargement de l\'image depuis URL...', url.substring(0, 100) + '...');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'image/*'
      },
      credentials: 'omit' // Ne pas envoyer de credentials pour éviter les problèmes CORS
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const blob = await response.blob();
    console.log('🔄 fetchImageAsBase64: Blob reçu, type:', blob.type, 'taille:', blob.size);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        console.log('✅ fetchImageAsBase64: Image convertie en base64, longueur:', base64.length);
        resolve(base64);
      };
      reader.onerror = (error) => {
        console.error('❌ fetchImageAsBase64: Erreur lors de la lecture du blob:', error);
        reject(error);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('❌ fetchImageAsBase64: Erreur lors du téléchargement:', error);
    throw error;
  }
};

// Fonction pour convertir les images webp en PNG (format supporté par @react-pdf/renderer)
// Gère aussi les URLs Firebase Storage en les téléchargeant d'abord
const convertWebpToPng = async (imageSrc: string): Promise<string> => {
  // Si l'image est vide ou null, retourner telle quelle
  if (!imageSrc || imageSrc.trim() === '') {
    console.log('🔄 convertWebpToPng: Image vide, retour telle quelle');
    return imageSrc;
  }

  // Vérifier si c'est une URL externe (Firebase Storage, etc.)
  const isUrl = imageSrc.startsWith('http://') || imageSrc.startsWith('https://');
  
  // Si c'est une URL, la télécharger et la convertir en base64 d'abord
  if (isUrl) {
    console.log('🔄 convertWebpToPng: URL détectée, téléchargement en cours...');
    try {
      const base64Image = await fetchImageAsBase64(imageSrc);
      // Récursivement appeler la fonction avec la version base64
      return await convertWebpToPng(base64Image);
    } catch (error) {
      console.error('❌ convertWebpToPng: Erreur lors du téléchargement de l\'URL:', error);
      // En cas d'erreur, retourner l'URL originale (même si elle ne fonctionnera probablement pas)
      return imageSrc;
    }
  }

  // Vérifier si l'image est déjà dans un format supporté (PNG, JPEG)
  const isPng = imageSrc.includes('data:image/png') || imageSrc.includes('image/png');
  const isJpeg = imageSrc.includes('data:image/jpeg') || imageSrc.includes('data:image/jpg') || 
                 imageSrc.includes('image/jpeg') || imageSrc.includes('image/jpg');
  
  if (isPng || isJpeg) {
    // Si c'est déjà PNG ou JPEG, retourner l'image telle quelle
    console.log('🔄 convertWebpToPng: Image déjà en format compatible (PNG/JPEG), retour telle quelle');
    return imageSrc;
  }

  // Vérifier si l'image est en format webp (détection améliorée)
  const lowerSrc = imageSrc.toLowerCase();
  const isWebp = lowerSrc.includes('data:image/webp') || 
                 lowerSrc.includes('image/webp') ||
                 (imageSrc.startsWith('data:image/') && lowerSrc.includes('webp')) ||
                 (imageSrc.startsWith('data:') && lowerSrc.includes('webp'));
  
  // Si ce n'est pas du webp détecté mais que c'est du base64, essayer quand même la conversion
  // (peut être un format non détecté ou mal formaté)
  const isBase64 = imageSrc.startsWith('data:image/') || imageSrc.startsWith('data:');
  
  if (!isWebp && !isBase64) {
    console.log('🔄 convertWebpToPng: Format non reconnu et non base64, retour telle quelle');
    return imageSrc;
  }

  console.log('🔄 convertWebpToPng: Tentative de conversion...', {
    isWebp,
    isBase64,
    preview: imageSrc.substring(0, 100) + '...'
  });

  try {
    // Créer une image à partir de la source
    // Utiliser window.Image pour s'assurer qu'on utilise bien l'objet Image du DOM
    // Vérifier que window est disponible (navigateur)
    if (typeof window === 'undefined' || !window.Image) {
      console.error('❌ convertWebpToPng: window.Image non disponible');
      return imageSrc;
    }
    
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error('❌ convertWebpToPng: Timeout lors du chargement de l\'image');
        resolve(imageSrc); // En cas de timeout, retourner l'original
      }, 10000); // Timeout de 10 secondes
      
      img.onload = () => {
        clearTimeout(timeout);
        try {
          console.log('🔄 convertWebpToPng: Image chargée, dimensions:', img.width, 'x', img.height);
          
          // Créer un canvas pour convertir l'image
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.error('❌ convertWebpToPng: Impossible de créer le contexte canvas');
            resolve(imageSrc);
            return;
          }
          
          // Dessiner l'image sur le canvas
          ctx.drawImage(img, 0, 0);
          
          // Convertir le canvas en PNG (base64)
          const pngDataUrl = canvas.toDataURL('image/png');
          console.log('✅ convertWebpToPng: Image convertie en PNG avec succès', {
            originalLength: imageSrc.length,
            convertedLength: pngDataUrl.length,
            preview: pngDataUrl.substring(0, 100) + '...'
          });
          resolve(pngDataUrl);
        } catch (error) {
          clearTimeout(timeout);
          console.error('❌ convertWebpToPng: Erreur lors de la conversion webp -> PNG:', error);
          // En cas d'erreur, retourner l'image originale
          resolve(imageSrc);
        }
      };
      
      img.onerror = (error) => {
        clearTimeout(timeout);
        console.error('❌ convertWebpToPng: Erreur lors du chargement de l\'image pour conversion', error);
        // En cas d'erreur, retourner l'image originale
        resolve(imageSrc);
      };
      
      // Charger l'image
      console.log('🔄 convertWebpToPng: Chargement de l\'image...');
      img.src = imageSrc;
    });
  } catch (error) {
    console.error('❌ convertWebpToPng: Erreur dans la fonction:', error);
    // En cas d'erreur, retourner l'image originale
    return imageSrc;
  }
};

// Fonction pour gérer les logos
const getLogoSource = (logoPreview: string | null, structureLogo: string | null, quoteDataLogo?: string | null) => {
  // Priorité : logo uploadé > logo quoteData > logo structure > placeholder
  if (logoPreview) {
    return logoPreview; // Déjà en base64
  }
  
  if (quoteDataLogo) {
    // Vérifier si c'est déjà en base64
    if (quoteDataLogo.startsWith('data:image/')) {
      return quoteDataLogo;
    }
    // Si c'est une URL, on peut l'utiliser directement
    return quoteDataLogo;
  }
  
  if (structureLogo) {
    // Vérifier si c'est déjà en base64
    if (structureLogo.startsWith('data:image/')) {
      return structureLogo;
    }
    
    // Si c'est une URL, on peut l'utiliser directement
    // React-PDF peut gérer les URLs externes
    return structureLogo;
  }
  
  return null; // Utiliser le placeholder
};

// Composant PDF avec React-PDF
const QuotePDF = ({ mission, structure, quoteData, logoPreview, convertedStructureLogo, convertedClientLogo, footerSiret, footerTva, footerApe, showDocumentTitle, documentTitle, showFreeField, freeFieldText, freeFieldSegments, freeFieldFontSize = 10, freeFieldTextAlign = 'left', showSiret, showVatNumber, showLogo, showEmail, showPhone, showGlobalDiscount, globalDiscountPercent, globalDiscountAmount, showStructureLogo, showChargeMission, showStructureEmail, showStructurePhone, showStructureSiret, showMissionDate, showMissionValidity, showServiceCharacteristics, showStudentCount, showHours, showLocation, showMissionDescription, showDatesAndSchedule, templateColor = '#6366f1', contactFirstName, contactLastName, contacts }: {
  mission: Mission | null;
  structure: any;
  quoteData: QuoteData;
  logoPreview: string | null;
  convertedStructureLogo?: string | null;
  convertedClientLogo?: string | null;
  footerSiret: string;
  footerTva: string;
  footerApe: string;
  showDocumentTitle?: boolean;
  documentTitle?: string;
  showFreeField?: boolean;
  freeFieldText?: string;
  freeFieldSegments?: Array<{ text: string; fontSize?: number; textAlign?: string; fontWeight?: string; fontStyle?: string }> | null;
  freeFieldFontSize?: number;
  freeFieldTextAlign?: 'left' | 'center' | 'right' | 'justify';
  showSiret?: boolean;
  showVatNumber?: boolean;
  showLogo?: boolean;
  showEmail?: boolean;
  showPhone?: boolean;
  showGlobalDiscount?: boolean;
  globalDiscountPercent?: number;
  globalDiscountAmount?: number;
  showStructureLogo?: boolean;
  showChargeMission?: boolean;
  showStructureEmail?: boolean;
  showStructurePhone?: boolean;
  showStructureSiret?: boolean;
  showMissionDate?: boolean;
  showMissionValidity?: boolean;
  showServiceCharacteristics?: boolean;
  showStudentCount?: boolean;
  showHours?: boolean;
  showLocation?: boolean;
  showMissionDescription?: boolean;
  showDatesAndSchedule?: boolean;
  templateColor?: string;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  contacts?: Contact[];
}) => {
  const structureData = getStructureData(structure, mission);
  const clientData = getClientData(quoteData);
  
  // Trouver le contact principal (isDefault: true) pour le companyId de la mission
  const companyContacts = contacts?.filter(contact => contact.companyId === mission?.companyId) || [];
  const mainContact = companyContacts.find(contact => contact.isDefault) || companyContacts[0];
  
  // Créer les styles dynamiquement avec la couleur du template et les préférences du champ libre
  const dynamicStyles = StyleSheet.create({
    ...styles,
    tableHeader: {
      ...styles.tableHeader,
      backgroundColor: templateColor
    },
    totalTTC: {
      ...styles.totalTTC,
      color: templateColor
    },
    freeFieldText: {
      ...styles.freeFieldText,
      fontSize: freeFieldFontSize,
      textAlign: freeFieldTextAlign
    }
  });
  // Utiliser le logo converti de la structure si disponible, sinon utiliser l'original
  // Priorité : convertedStructureLogo > logoPreview > structure.logo > quoteData.companyInfo.logo
  // La conversion gère maintenant les URLs Firebase Storage, donc convertedStructureLogo devrait toujours être en base64 PNG
  const structureLogoValue = convertedStructureLogo || logoPreview || structure?.logo || quoteData?.companyInfo?.logo || null;
  
  // Utiliser le logo converti du client si disponible, sinon utiliser l'original
  const clientLogoValue = convertedClientLogo || quoteData?.clientInfo?.logo || null;
  
  // Logs de débogage pour le logo de la structure
  console.log('📄 QuotePDF - ===== DÉBUT DU RENDU PDF =====');
  console.log('📄 QuotePDF - logoPreview:', logoPreview ? logoPreview.substring(0, 100) + '...' : null);
  console.log('📄 QuotePDF - structure?.logo (from DB):', structure?.logo ? structure.logo.substring(0, 100) + '...' : null);
  console.log('📄 QuotePDF - quoteData?.companyInfo?.logo:', quoteData?.companyInfo?.logo ? quoteData.companyInfo.logo.substring(0, 100) + '...' : null);
  console.log('📄 QuotePDF - convertedStructureLogo:', convertedStructureLogo ? convertedStructureLogo.substring(0, 100) + '...' : null);
  
  // Vérifier le format du logo de structure final
  if (structureLogoValue) {
    const isWebp = structureLogoValue.toLowerCase().includes('data:image/webp') || structureLogoValue.toLowerCase().includes('image/webp');
    const isPng = structureLogoValue.toLowerCase().includes('data:image/png') || structureLogoValue.toLowerCase().includes('image/png');
    const isJpeg = structureLogoValue.toLowerCase().includes('data:image/jpeg') || structureLogoValue.toLowerCase().includes('data:image/jpg');
    console.log('📄 QuotePDF - structureLogoValue (final):', {
      preview: structureLogoValue.substring(0, 100) + '...',
      format: isWebp ? 'WEBP ⚠️' : isPng ? 'PNG ✅' : isJpeg ? 'JPEG ✅' : 'AUTRE ⚠️',
      longueur: structureLogoValue.length,
      utiliseConverti: structureLogoValue === convertedStructureLogo
    });
  } else {
    console.log('📄 QuotePDF - structureLogoValue (final):', null);
  }
  
  console.log('📄 QuotePDF - convertedClientLogo:', convertedClientLogo ? convertedClientLogo.substring(0, 100) + '...' : null);
  
  // Vérifier le format du logo client final
  if (clientLogoValue) {
    const isWebp = clientLogoValue.toLowerCase().includes('data:image/webp') || clientLogoValue.toLowerCase().includes('image/webp');
    const isPng = clientLogoValue.toLowerCase().includes('data:image/png') || clientLogoValue.toLowerCase().includes('image/png');
    const isJpeg = clientLogoValue.toLowerCase().includes('data:image/jpeg') || clientLogoValue.toLowerCase().includes('data:image/jpg');
    console.log('📄 QuotePDF - clientLogoValue (final):', {
      preview: clientLogoValue.substring(0, 100) + '...',
      format: isWebp ? 'WEBP ⚠️' : isPng ? 'PNG ✅' : isJpeg ? 'JPEG ✅' : 'AUTRE ⚠️',
      longueur: clientLogoValue.length,
      utiliseConverti: clientLogoValue === convertedClientLogo
    });
  } else {
    console.log('📄 QuotePDF - clientLogoValue (final):', null);
  }
  
  console.log('📄 QuotePDF - ===== FIN DU RENDU PDF =====');
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Section structure et client côte à côte */}
        <View style={styles.headerContainer}>
          {/* Section gauche - Structure */}
          <View style={styles.leftSection}>
            {/* Logo de la structure */}
            {showStructureLogo && (
              <View style={styles.logoContainer}>
                {/* Utiliser le logo converti (PNG) si disponible */}
                {structureLogoValue ? (
                  <PDFImage 
                    src={structureLogoValue} 
                    style={styles.logoImage}
                  />
                ) : (
                  <View style={styles.logoCircle}>
                    <Text style={styles.logoText}>JS</Text>
                  </View>
                )}
              </View>
            )}
            
            {/* Nom de la structure en gras */}
            <Text style={styles.companyName}>{structureData.name || 'Structure'}</Text>
            
            {/* Adresse */}
            {structureData.address && structureData.address.trim() !== '' && (
              <Text style={styles.infoText}>{structureData.address}</Text>
            )}
            
            {/* Code postal et ville */}
            {structureData.postalCode && structureData.postalCode.trim() !== '' && 
             structureData.city && structureData.city.trim() !== '' && (
              <Text style={styles.infoText}>
                {structureData.postalCode} {structureData.city}
              </Text>
            )}
            
            {/* SIRET de la structure */}
            {showStructureSiret && structureData.siret && structureData.siret.trim() !== '' && (
              <Text style={styles.infoText}>SIRET: {structureData.siret}</Text>
            )}
            
            {/* Email */}
            {showStructureEmail && structureData.email && structureData.email.trim() !== '' && (
              <Text style={styles.infoText}>{structureData.email}</Text>
            )}
            
            {/* Téléphone */}
            {showStructurePhone && structureData.phone && structureData.phone.trim() !== '' && (
              <Text style={styles.infoText}>{structureData.phone}</Text>
            )}
            
            {/* Chargé d'étude */}
            {showChargeMission && structureData.chargeName && structureData.chargeName.trim() !== '' && (
              <Text style={styles.infoText}>Chargé d'étude: {structureData.chargeName}</Text>
            )}
          </View>
          
          {/* Section droite - Client */}
          <View style={styles.rightSection}>
            {/* Logo du client si activé, sinon espaceur invisible pour l'alignement */}
            {showLogo && clientLogoValue ? (
              <View style={styles.logoContainer}>
                <PDFImage 
                  src={clientLogoValue} 
                  style={styles.logoImage}
                />
              </View>
            ) : (
              <View style={styles.logoSpacer} />
            )}
            
            {/* Nom de l'entreprise en gras */}
            <Text style={styles.companyName}>{clientData.name || 'Client'}</Text>
            
            {/* Adresse */}
            {clientData.address && clientData.address.trim() !== '' && (
              <Text style={styles.infoText}>{clientData.address}</Text>
            )}
            
            {/* Code postal et ville */}
            {clientData.postalCode && clientData.postalCode.trim() !== '' && 
             clientData.city && clientData.city.trim() !== '' && (
              <Text style={styles.infoText}>
                {clientData.postalCode} {clientData.city}
              </Text>
            )}
            
            {/* Pays */}
            {clientData.country && clientData.country.trim() !== '' && (
              <Text style={styles.infoText}>{clientData.country}</Text>
            )}
            
            {/* SIRET si activé */}
            {showSiret && quoteData.clientInfo.siret && quoteData.clientInfo.siret.trim() !== '' && (
              <Text style={styles.infoText}>SIRET: {quoteData.clientInfo.siret}</Text>
            )}
            
            {/* N° TVA si activé */}
            {showVatNumber && quoteData.clientInfo.vatNumber && (
              <Text style={styles.infoText}>N° TVA: {quoteData.clientInfo.vatNumber}</Text>
            )}
            
            {/* Email si activé */}
            {showEmail && quoteData.clientInfo.email && (
              <Text style={styles.infoText}>{quoteData.clientInfo.email}</Text>
            )}
            
            {/* Téléphone si activé */}
            {showPhone && quoteData.clientInfo.phone && (
              <Text style={styles.infoText}>{quoteData.clientInfo.phone}</Text>
            )}
          </View>
        </View>
        
        {/* En-tête Proposition commerciale (titre, date, validité) */}
        <View style={styles.quoteSection}>
          <View style={styles.quoteHeader}>
            <Text style={styles.quoteTitle}>
              {showDocumentTitle && documentTitle ? documentTitle.toUpperCase() : `PROPOSITION COMMERCIALE N° ${mission?.numeroMission || 'MISSION'}`}
            </Text>
            <View style={styles.quoteMeta}>
              {showMissionDate && (
                <Text style={styles.quoteDate}>Date: {formatDateToFrench(quoteData.quoteInfo.issueDate)}</Text>
              )}
              {showMissionValidity && (
                <Text style={styles.quoteValidity}>Période de validité: {quoteData.quoteInfo.validityPeriod} jours</Text>
              )}
            </View>
          </View>
        </View>
        
        {/* Caractéristiques de la prestation */}
        {showServiceCharacteristics && mission && (
          <View style={styles.characteristicsTable}>
            <Text style={styles.characteristicsTitle}>Caractéristiques de la prestation</Text>
            {showStudentCount && (
              <View style={styles.characteristicsRow}>
                <Text style={styles.characteristicsLabel}>Nombre d'étudiants à recruter, former, suivre :</Text>
                <Text style={styles.characteristicsValue}>{mission.studentCount || '-'}</Text>
              </View>
            )}
            {showHours && (
              <View style={styles.characteristicsRow}>
                <Text style={styles.characteristicsLabel}>Nombre d'heures :</Text>
                <Text style={styles.characteristicsValue}>{mission.hours || '-'}</Text>
              </View>
            )}
            {showLocation && (
              <View style={styles.characteristicsRow}>
                <Text style={styles.characteristicsLabel}>Lieu(x) de la mission :</Text>
                <Text style={styles.characteristicsValue}>{mission.location || '-'}</Text>
              </View>
            )}
            {showMissionDescription && (
              <View style={styles.characteristicsRow}>
                <Text style={styles.characteristicsLabel}>Description de la mission à effectuer par les étudiants :</Text>
                <Text style={styles.characteristicsValue}>{mission.description || '-'}</Text>
              </View>
            )}
            {showDatesAndSchedule && (mission.startDate || mission.endDate) && (
              <View style={styles.characteristicsRow}>
                <Text style={styles.characteristicsLabel}>Date(s) et horaires :</Text>
                <Text style={styles.characteristicsValue}>
                  {mission.startDate && mission.endDate 
                    ? `Du ${formatDateToFrench(mission.startDate)} au ${formatDateToFrench(mission.endDate)} compris.`
                    : mission.startDate 
                    ? `À partir du ${formatDateToFrench(mission.startDate)}.`
                    : mission.endDate
                    ? `Jusqu'au ${formatDateToFrench(mission.endDate)}.`
                    : '-'}
                  {mission.hours && mission.studentCount ? ` Pour un volume d'heures total de ${mission.hours} heures qui est réparti équitablement entre les étudiants recrutés.` : ''}
                </Text>
              </View>
            )}
          </View>
        )}
        
        {/* Tableau et totaux de la proposition commerciale */}
        <View style={styles.quoteSection}>
          {/* Tableau */}
          <View style={styles.table}>
            <View style={dynamicStyles.tableHeader}>
              <Text style={styles.tableHeaderCell}>Désignation</Text>
              <Text style={styles.tableHeaderCell}>Quantité</Text>
              <Text style={styles.tableHeaderCell}>Prix unit.</Text>
              <Text style={styles.tableHeaderCell}>TVA</Text>
              <Text style={styles.tableHeaderCell}>Montant HT</Text>
            </View>
            
            {quoteData.lines.map((line, index) => (
              <View key={line.id} style={styles.tableRow}>
                <Text style={styles.tableCell}>{line.designation || 'Description'}</Text>
                <Text style={styles.tableCell}>{line.quantity}</Text>
                <Text style={styles.tableCell}>{line.unitPrice.toFixed(2)} €</Text>
                <Text style={styles.tableCell}>{line.tva}%</Text>
                <Text style={styles.tableCell}>{line.totalHT.toFixed(2)} €</Text>
              </View>
            ))}
          </View>
          
          {/* Totaux */}
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total HT:</Text>
              <Text style={styles.totalValue}>{quoteData.totals.totalHT.toFixed(2)} €</Text>
            </View>
            
            {/* Remise globale si activée */}
            {showGlobalDiscount && globalDiscountPercent && globalDiscountPercent > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Remise ({globalDiscountPercent}%):</Text>
                <Text style={styles.totalValue}>-{globalDiscountAmount?.toFixed(2)} €</Text>
              </View>
            )}
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TVA 20%:</Text>
              <Text style={styles.totalValue}>{quoteData.totals.totalTVA.toFixed(2)} €</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={dynamicStyles.totalTTC}>Total TTC:</Text>
              <Text style={dynamicStyles.totalTTC}>{quoteData.totals.totalTTC.toFixed(2)} €</Text>
            </View>
          </View>
        </View>
        
        {/* Champ libre - pleine largeur */}
        {showFreeField && (freeFieldSegments || freeFieldText) && (
          <View style={styles.freeFieldFullWidth}>
            {freeFieldSegments && freeFieldSegments.length > 0 ? (() => {
              // Grouper les segments par alignement pour créer des blocs
              const groupedSegments: Array<Array<{ text: string; fontSize?: number; textAlign?: string; fontWeight?: string; fontStyle?: string }>> = [];
              let currentGroup: Array<{ text: string; fontSize?: number; textAlign?: string; fontWeight?: string; fontStyle?: string }> = [];
              let currentAlign = freeFieldSegments[0]?.textAlign || freeFieldTextAlign;
              
              freeFieldSegments.forEach((segment, index) => {
                if (segment.textAlign !== currentAlign && currentGroup.length > 0) {
                  groupedSegments.push([...currentGroup]);
                  currentGroup = [];
                  currentAlign = segment.textAlign || freeFieldTextAlign;
                }
                currentGroup.push(segment);
                if (index === freeFieldSegments.length - 1) {
                  groupedSegments.push(currentGroup);
                }
              });
              
              return groupedSegments.map((group, groupIndex) => {
                const align = group[0]?.textAlign || freeFieldTextAlign;
                return (
                  <View key={groupIndex} style={{ 
                    marginBottom: 4,
                    textAlign: align as 'left' | 'center' | 'right' | 'justify'
                  }}>
                    {group.map((segment, segIndex) => (
                      <Text 
                        key={segIndex} 
                        style={{ 
                          fontSize: segment.fontSize || freeFieldFontSize,
                          textAlign: segment.textAlign as 'left' | 'center' | 'right' | 'justify' || freeFieldTextAlign,
                          fontWeight: segment.fontWeight === 'bold' ? 'bold' : 'normal',
                          fontStyle: segment.fontStyle === 'italic' ? 'italic' : 'normal'
                        }}
                      >
                        {segment.text}
                      </Text>
                    ))}
                  </View>
                );
              });
            })() : (
              <Text style={dynamicStyles.freeFieldText}>{freeFieldText || ''}</Text>
            )}
          </View>
        )}
        
        {/* Encarts de signature */}
        <View style={styles.signatureContainer}>
          {/* Encart gauche - Structure */}
          <View style={styles.signatureBox}>
            <Text style={styles.signatureText}>
              Pour {structureData.name || 'Nom de la structure'}, Le Président
            </Text>
            <View style={styles.signatureSpace} />
          </View>
          
          {/* Encart droit - Client */}
          <View style={styles.signatureBoxLast}>
            <Text style={styles.signatureText}>
              {mainContact && mainContact.firstName && mainContact.lastName
                ? `${mainContact.firstName} ${mainContact.lastName} pour ${clientData.name || 'Nom de l\'entreprise'}`
                : clientData.name 
                ? `Pour ${clientData.name}`
                : 'Pour Nom de l\'entreprise'}
            </Text>
            <View style={styles.signatureSpace} />
          </View>
        </View>
        
        {/* Bas de page */}
        <View style={styles.footer}>
          {/* SIRET */}
          {footerSiret && (
            <Text style={styles.siretFooter}>SIRET: {footerSiret}</Text>
          )}
          
          {/* Tirets longs */}
          {footerSiret && (footerTva || footerApe) && (
            <Text style={styles.siretFooter}> — </Text>
          )}
          
          {/* TVA */}
          {footerTva && (
            <Text style={styles.tvaFooter}>N° TVA: {footerTva}</Text>
          )}
          
          {/* Tirets longs */}
          {footerTva && footerApe && (
            <Text style={styles.tvaFooter}> — </Text>
          )}
          
          {/* Code APE */}
          {footerApe && (
            <Text style={styles.apeFooter}>Code APE: {footerApe}</Text>
          )}
        </View>
        
        {/* Numérotation de page */}
        <View style={styles.pageNumberContainer}>
          <Text style={styles.pageNumber}>Page 1 / 1</Text>
        </View>
      </Page>
    </Document>
  );
};

const QuoteBuilder: React.FC = () => {
  const { missionId, missionNumber, etudeNumber } = useParams<{ missionId?: string; missionNumber?: string; etudeNumber?: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // Déterminer le type de document et le numéro
  // missionId a la priorité sur missionNumber pour la rétrocompatibilité
  const documentId = missionId || missionNumber;
  const documentNumber = documentId || etudeNumber;
  const isEtude = !!etudeNumber;
  
  // Récupérer les informations de contact depuis l'URL
  const urlParams = new URLSearchParams(window.location.search);
  const contactId = urlParams.get('contactId');
  const contactEmail = urlParams.get('contactEmail');
  const contactFirstName = urlParams.get('contactFirstName');
  const contactLastName = urlParams.get('contactLastName');
  const contactGender = urlParams.get('contactGender');
  
  console.log('QuoteBuilder - documentNumber:', documentNumber, 'isEtude:', isEtude);
  console.log('=== PARAMÈTRES DE CONTACT RÉCUPÉRÉS ===');
  console.log('contactId:', contactId);
  console.log('contactEmail:', contactEmail);
  console.log('contactFirstName:', contactFirstName);
  console.log('contactLastName:', contactLastName);
  console.log('contactGender:', contactGender);
  
  const [mission, setMission] = useState<Mission | null>(null);
  const [structure, setStructure] = useState<any>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [convertedStructureLogo, setConvertedStructureLogo] = useState<string | null>(null);
  const [convertedClientLogo, setConvertedClientLogo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [quoteData, setQuoteData] = useState<QuoteData>({
    missionId: '',
    companyInfo: {
      name: '',
      address: '',
      city: '',
      postalCode: '',
      country: '',
      siret: '',
      logo: ''
    },
    clientInfo: {
      name: '',
      address: '',
      complement: '',
      postalCode: '',
      city: '',
      country: '',
      siret: '',
      vatNumber: '',
      logo: '',
      email: '',
      phone: ''
    },
    quoteInfo: {
      number: '',
      issueDate: new Date().toISOString().split('T')[0],
      validityPeriod: 30,
      currency: 'EUR'
    },
    lines: [],
    totals: {
      totalHT: 0,
      totalTVA: 0,
      totalTTC: 0
    },
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  // États pour les informations du footer
  const [footerSiret, setFooterSiret] = useState<string>('');
  const [footerTva, setFooterTva] = useState<string>('FR12345678901');
  const [footerApe, setFooterApe] = useState<string>('');

  // État pour le panneau d'options
  const [optionsOpen, setOptionsOpen] = useState<boolean>(false);
  
  // États pour les options
  const [billingType, setBillingType] = useState<string>('complet');
  const [showSiret, setShowSiret] = useState<boolean>(false);
  const [showVatNumber, setShowVatNumber] = useState<boolean>(false);
  const [showLogo, setShowLogo] = useState<boolean>(false);
  const [showEmail, setShowEmail] = useState<boolean>(false);
  const [showPhone, setShowPhone] = useState<boolean>(false);
  const [showPaymentTerms, setShowPaymentTerms] = useState<boolean>(true);
  const [showDocumentTitle, setShowDocumentTitle] = useState<boolean>(false);
  const [documentTitle, setDocumentTitle] = useState<string>('');
  const [showFreeField, setShowFreeField] = useState<boolean>(false);
  const [freeFieldText, setFreeFieldText] = useState<string>('');
  const [freeFieldHtml, setFreeFieldHtml] = useState<string>(''); // HTML formaté pour l'éditeur
  const [freeFieldFontSize, setFreeFieldFontSize] = useState<number>(10);
  const [freeFieldTextAlign, setFreeFieldTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>('left');
  const freeFieldEditorRef = useRef<HTMLDivElement>(null);
  const [showGlobalDiscount, setShowGlobalDiscount] = useState<boolean>(false);
  
  // États pour les caractéristiques de la prestation
  const [showServiceCharacteristics, setShowServiceCharacteristics] = useState<boolean>(true);
  const [showStudentCount, setShowStudentCount] = useState<boolean>(true);
  const [showHours, setShowHours] = useState<boolean>(true);
  const [showLocation, setShowLocation] = useState<boolean>(true);
  const [showMissionDescription, setShowMissionDescription] = useState<boolean>(true);
  const [showDatesAndSchedule, setShowDatesAndSchedule] = useState<boolean>(true);
  
  // État pour la remise globale
  const [globalDiscountPercent, setGlobalDiscountPercent] = useState<number>(0);
  const [globalDiscountAmount, setGlobalDiscountAmount] = useState<number>(0);
  
  // États pour les options de structure
  const [showStructureLogo, setShowStructureLogo] = useState<boolean>(true);
  const [showChargeMission, setShowChargeMission] = useState<boolean>(true);
  const [showStructureEmail, setShowStructureEmail] = useState<boolean>(true);
  const [showStructurePhone, setShowStructurePhone] = useState<boolean>(true);
  const [showStructureSiret, setShowStructureSiret] = useState<boolean>(false);
  
  // États pour les options de mission
  const [showMissionDate, setShowMissionDate] = useState<boolean>(true);
  const [showMissionValidity, setShowMissionValidity] = useState<boolean>(true);
  
  // État pour la couleur du template
  const [templateColor, setTemplateColor] = useState<string>('#6366f1');
  const [colorPickerOpen, setColorPickerOpen] = useState<boolean>(false);
  
  // États pour les préférences de template
  const [savedTemplatePreferences, setSavedTemplatePreferences] = useState<any>(null);
  const [savePreferencesDialogOpen, setSavePreferencesDialogOpen] = useState<boolean>(false);
  
  // État local pour la saisie de date
  const [dateInputValue, setDateInputValue] = useState<string>('');
  
  // État pour la popup de création
  const [createPopupOpen, setCreatePopupOpen] = useState<boolean>(false);
  
  // Log de l'état de la popup pour déboguer
  useEffect(() => {
    console.log('État de la popup de création:', createPopupOpen);
  }, [createPopupOpen]);
  const [emailPopupOpen, setEmailPopupOpen] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [emailData, setEmailData] = useState({
    to: contactEmail || '',
    cc: '',
    subject: `Proposition commerciale ${etudeNumber || 'étude'}`,
    message: ''
  });
  
  // Mettre à jour les données email quand la popup s'ouvre
  useEffect(() => {
    if (emailPopupOpen && quoteData && structure) {
      // Utiliser l'email du contact principal s'il est disponible, sinon l'email du client
      const clientEmail = contactEmail || quoteData.clientInfo?.email || '';
      const structureEmail = structure.email || structure.mail || '';
      const numeroCommande = mission?.numeroMission || etudeNumber || 'mission';
      
      // Générer le message personnalisé selon le genre du contact
      let salutation = 'Bonjour,';
      if (contactGender && contactFirstName && contactLastName) {
        if (contactGender === 'homme') {
          salutation = `Bonjour Monsieur ${contactLastName},`;
        } else if (contactGender === 'femme') {
          salutation = `Bonjour Madame ${contactLastName},`;
        } else {
          salutation = `Bonjour ${contactFirstName} ${contactLastName},`;
        }
      }
      
      setEmailData({
        to: clientEmail,
        cc: structureEmail,
        subject: `Proposition commerciale N°${numeroCommande}`,
        message: `${salutation}

Vous trouverez ci-joint notre proposition commerciale N°${numeroCommande}.

N'hésitez pas à nous contacter pour toute question.

Cordialement,
${structure.nom || structure.name || 'Notre équipe'}`
      });
    }
  }, [emailPopupOpen, quoteData, structure, mission, etudeNumber, contactEmail, contactGender, contactFirstName, contactLastName]);
  
  // État pour vérifier si les données sont prêtes
  const [dataReady, setDataReady] = useState<boolean>(false);
  
  // État pour garder trace du brouillon en cours d'édition
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  
  // Synchroniser l'état local de la date avec les données
  useEffect(() => {
    if (quoteData?.quoteInfo?.issueDate) {
      setDateInputValue(formatDateToFrench(quoteData.quoteInfo.issueDate));
    }
  }, [quoteData?.quoteInfo?.issueDate]);

  // Synchroniser automatiquement les logos dans quoteData et structure quand logoPreview change
  useEffect(() => {
    if (logoPreview && structure && quoteData) {
      // Mettre à jour le logo de la structure
      if (!structure.logo || structure.logo !== logoPreview) {
        setStructure(prev => prev ? { ...prev, logo: logoPreview } : prev);
      }
      
      // Mettre à jour les logos dans quoteData
      if (!quoteData.companyInfo.logo || quoteData.companyInfo.logo !== logoPreview) {
        setQuoteData(prev => ({
          ...prev,
          companyInfo: {
            ...prev.companyInfo,
            logo: logoPreview
          }
        }));
      }
      
      // Ne pas écraser le logo du client s'il existe déjà (récupéré depuis la DB companies)
      // Le logoPreview est uniquement pour le logo de la structure
      // Le logo du client doit être récupéré depuis companies.logo
    }
  }, [logoPreview, structure, quoteData]);

  // Synchroniser le logo de la structure dans quoteData.companyInfo.logo
  useEffect(() => {
    if (structure) {
      const structureLogo = logoPreview || structure.logo || '';
      // Mettre à jour quoteData.companyInfo.logo avec le logo de la structure
      setQuoteData(prev => {
        if (prev.companyInfo.logo !== structureLogo) {
          return {
            ...prev,
            companyInfo: {
              ...prev.companyInfo,
              logo: structureLogo
            }
          };
        }
        return prev;
      });
    }
  }, [logoPreview, structure?.logo]);

  // Convertir les logos webp en PNG pour la compatibilité avec @react-pdf/renderer
  useEffect(() => {
    const convertLogos = async () => {
      console.log('🔄 ===== DÉBUT DE LA CONVERSION DES LOGOS =====');
      
      // Convertir le logo de la structure
      const structureLogo = logoPreview || structure?.logo || quoteData?.companyInfo?.logo || null;
      if (structureLogo) {
        console.log('🔄 [STRUCTURE] Conversion du logo de la structure...');
        console.log('🔄 [STRUCTURE] Source:', structureLogo.substring(0, 100) + '...');
        const isWebp = structureLogo.toLowerCase().includes('data:image/webp') || structureLogo.toLowerCase().includes('image/webp');
        const isPng = structureLogo.toLowerCase().includes('data:image/png') || structureLogo.toLowerCase().includes('image/png');
        const isJpeg = structureLogo.toLowerCase().includes('data:image/jpeg') || structureLogo.toLowerCase().includes('data:image/jpg');
        console.log('📋 [STRUCTURE] Format détecté:', {
          WEBP: isWebp,
          PNG: isPng,
          JPEG: isJpeg,
          AUTRE: !isWebp && !isPng && !isJpeg
        });
        
        try {
          const converted = await convertWebpToPng(structureLogo);
          const wasConverted = converted !== structureLogo;
          const isConvertedPng = converted.toLowerCase().includes('data:image/png') || converted.toLowerCase().includes('image/png');
          
          console.log('✅ [STRUCTURE] Résultat de la conversion:', {
            converti: wasConverted ? 'OUI (WEBP → PNG)' : 'NON (déjà compatible)',
            estPNG: isConvertedPng,
            longueurOriginale: structureLogo.length,
            longueurConvertie: converted.length,
            preview: converted.substring(0, 100) + '...'
          });
          
          setConvertedStructureLogo(converted);
          console.log('✅ [STRUCTURE] État convertedStructureLogo mis à jour');
        } catch (error) {
          console.error('❌ [STRUCTURE] Erreur lors de la conversion:', error);
          setConvertedStructureLogo(structureLogo);
        }
      } else {
        console.log('⚠️ [STRUCTURE] Pas de logo de structure à convertir');
        setConvertedStructureLogo(null);
      }

      // Convertir le logo du client
      const clientLogo = quoteData?.clientInfo?.logo || null;
      if (clientLogo) {
        console.log('🔄 [CLIENT] Conversion du logo du client...');
        console.log('🔄 [CLIENT] Source:', clientLogo.substring(0, 100) + '...');
        const isWebp = clientLogo.toLowerCase().includes('data:image/webp') || clientLogo.toLowerCase().includes('image/webp');
        const isPng = clientLogo.toLowerCase().includes('data:image/png') || clientLogo.toLowerCase().includes('image/png');
        const isJpeg = clientLogo.toLowerCase().includes('data:image/jpeg') || clientLogo.toLowerCase().includes('data:image/jpg');
        console.log('📋 [CLIENT] Format détecté:', {
          WEBP: isWebp,
          PNG: isPng,
          JPEG: isJpeg,
          AUTRE: !isWebp && !isPng && !isJpeg
        });
        
        try {
          const converted = await convertWebpToPng(clientLogo);
          const wasConverted = converted !== clientLogo;
          const isConvertedPng = converted.toLowerCase().includes('data:image/png') || converted.toLowerCase().includes('image/png');
          
          console.log('✅ [CLIENT] Résultat de la conversion:', {
            converti: wasConverted ? 'OUI (WEBP → PNG)' : 'NON (déjà compatible)',
            estPNG: isConvertedPng,
            longueurOriginale: clientLogo.length,
            longueurConvertie: converted.length,
            preview: converted.substring(0, 100) + '...'
          });
          
          setConvertedClientLogo(converted);
          console.log('✅ [CLIENT] État convertedClientLogo mis à jour');
        } catch (error) {
          console.error('❌ [CLIENT] Erreur lors de la conversion:', error);
          setConvertedClientLogo(clientLogo);
        }
      } else {
        console.log('⚠️ [CLIENT] Pas de logo de client à convertir');
        setConvertedClientLogo(null);
      }
      
      console.log('🔄 ===== FIN DE LA CONVERSION DES LOGOS =====');
    };

    convertLogos();
  }, [logoPreview, structure?.logo, quoteData?.companyInfo?.logo, quoteData?.clientInfo?.logo]);

  // Fonction pour synchroniser les données entre l'édition et le PDF
  const syncDataForPDF = () => {
    if (!structure || !quoteData) return;
    
    // Déterminer le logo de la structure (priorité : logoPreview > structure.logo)
    const structureLogo = logoPreview || structure.logo || '';
    
    // Synchroniser les données de la structure avec le logo
    const updatedStructure = {
      ...structure,
      nom: structure.nom || structure.name || '',
      adresse: structure.adresse || structure.address || '',
      ville: structure.ville || structure.city || '',
      city: structure.ville || structure.city || '',
      codePostal: structure.codePostal || structure.postalCode || '',
      postalCode: structure.codePostal || structure.postalCode || '',
      telephone: structure.telephone || structure.phone || '',
      phone: structure.telephone || structure.phone || '',
      logo: structureLogo // Synchroniser le logo
    };
    
    setStructure(updatedStructure);
    
    // Synchroniser les données client avec les logos
    const updatedQuoteData = {
      ...quoteData,
      companyInfo: {
        ...quoteData.companyInfo,
        // Toujours utiliser le logo de la structure (logoPreview ou structure.logo) pour companyInfo
        logo: structureLogo || ''
      },
      clientInfo: {
        ...quoteData.clientInfo,
        name: quoteData.clientInfo.name || '',
        address: quoteData.clientInfo.address || '',
        city: quoteData.clientInfo.city || '',
        postalCode: quoteData.clientInfo.postalCode || '',
        country: quoteData.clientInfo.country || 'France',
        siret: quoteData.clientInfo.siret || '',
        vatNumber: quoteData.clientInfo.vatNumber || '',
        email: quoteData.clientInfo.email || '',
        phone: quoteData.clientInfo.phone || '',
        // Préserver le logo du client récupéré depuis companies.logo
        // Ne pas utiliser structureLogo comme fallback pour le logo du client
        logo: quoteData.clientInfo.logo || ''
      }
    };
    
    setQuoteData(updatedQuoteData);
  };

  // Vérifier s'il y a un brouillon à reprendre
  useEffect(() => {
    const savedDraft = localStorage.getItem('resumeQuoteDraft');
    if (savedDraft) {
      try {
        const draftData = JSON.parse(savedDraft);
        if (draftData.quoteData) {
          console.log('=== RESTAURATION DU BROUILLON ===');
          console.log('Données complètes du brouillon:', draftData);
          
          // Sauvegarder l'ID du brouillon pour pouvoir le mettre à jour plus tard
          if (draftData.id) {
            setEditingDraftId(draftData.id);
            console.log('ID du brouillon sauvegardé pour édition:', draftData.id);
          }
          
          // Restaurer les données de la proposition
          console.log('Restauration de quoteData:', draftData.quoteData);
          setQuoteData(draftData.quoteData);
          
          // Restaurer les données de la structure si disponibles
          if (draftData.structureData) {
            console.log('Restauration de la structure:', draftData.structureData);
            setStructure(draftData.structureData);
            
            // Restaurer le logo de la structure dans logoPreview si disponible
            if (draftData.structureData.logo) {
              setLogoPreview(draftData.structureData.logo);
            }
          } else {
            console.warn('Aucune donnée de structure trouvée dans le brouillon');
          }
          
          // Restaurer le logo depuis quoteData si disponible (priorité au logo de la structure)
          if (!draftData.structureData?.logo) {
            if (draftData.quoteData?.companyInfo?.logo) {
              setLogoPreview(draftData.quoteData.companyInfo.logo);
            } else if (draftData.quoteData?.clientInfo?.logo) {
              setLogoPreview(draftData.quoteData.clientInfo.logo);
            }
          }
          
          // Restaurer les données de la mission si disponibles
          if (draftData.missionData) {
            console.log('Restauration de la mission:', draftData.missionData);
            setMission(draftData.missionData);
            
            // S'assurer que le documentNumber est correctement défini pour éviter les erreurs de téléchargement
            if (draftData.missionData.numeroMission) {
              // Mettre à jour l'URL pour refléter le bon numéro de mission
              const newUrl = `/quote-builder/${draftData.missionData.numeroMission}`;
              window.history.replaceState(null, '', newUrl);
              console.log('URL mise à jour avec le numéro de mission:', draftData.missionData.numeroMission);
            }
          } else {
            console.warn('Aucune donnée de mission trouvée dans le brouillon');
          }
          
          // Restaurer les options d'affichage
          if (draftData.options) {
            setShowLogo(draftData.options.showLogo ?? true);
            setShowStructureLogo(draftData.options.showStructureLogo ?? true);
            setShowChargeMission(draftData.options.showChargeMission ?? true);
            setShowStructureEmail(draftData.options.showStructureEmail ?? true);
            setShowStructurePhone(draftData.options.showStructurePhone ?? true);
            setShowStructureSiret(draftData.options.showStructureSiret ?? false);
            setShowMissionDate(draftData.options.showMissionDate ?? true);
            setShowMissionValidity(draftData.options.showMissionValidity ?? true);
            setShowDocumentTitle(draftData.options.showDocumentTitle ?? false);
          }
          
          // Restaurer le titre personnalisé
          if (draftData.documentTitle) {
            setDocumentTitle(draftData.documentTitle);
          }
          
          // Synchroniser la date d'émission
          if (draftData.quoteData?.quoteInfo?.issueDate) {
            setDateInputValue(formatDateToFrench(draftData.quoteData.quoteInfo.issueDate));
          }
          
          // Nettoyer le localStorage après avoir chargé le brouillon
          localStorage.removeItem('resumeQuoteDraft');
          
          // Marquer les données comme prêtes après la restauration du brouillon
          setDataReady(true);
          console.log('dataReady mis à true après restauration du brouillon');
          
          // Afficher un message de confirmation
          setSnackbar({
            open: true,
            message: 'Brouillon chargé avec succès ! Vous pouvez continuer votre édition.',
            severity: 'success'
          });
        }
      } catch (error) {
        console.error('Erreur lors du chargement du brouillon:', error);
        localStorage.removeItem('resumeQuoteDraft');
      }
    }
  }, []);

  useEffect(() => {
    const fetchMissionData = async () => {
      if (!documentNumber) return;
      
      // Vérifier s'il y a un brouillon à charger
      const savedDraft = localStorage.getItem('resumeQuoteDraft');
      if (savedDraft) {
        // Si un brouillon est présent, ne pas charger les données de la mission
        // car elles seront chargées par le useEffect de reprise des brouillons
        console.log('Brouillon détecté, arrêt du chargement automatique des données');
        return;
      }
      
      // Vérifier si les données sont déjà chargées (cas d'un brouillon restauré)
      if (mission && structure) {
        console.log('Données déjà présentes, arrêt du chargement automatique');
        return;
      }
      
      try {
        setLoading(true);
        
        let documentData: any = null;
        let collectionName = '';
        let missionData: Mission;
        
        if (isEtude) {
          // Récupérer les données de l'étude par numeroEtude
          const etudesQuery = query(
            collection(db, 'etudes'),
            where('numeroEtude', '==', documentNumber)
          );
          const etudesSnapshot = await getDocs(etudesQuery);
          
          if (etudesSnapshot.empty) {
            console.error('Étude not found with number:', documentNumber);
            setLoading(false);
            return;
          }
          
          const etudeDoc = etudesSnapshot.docs[0];
          documentData = etudeDoc.data();
          collectionName = 'etudes';
          
          // Convertir les données d'étude en format compatible avec Mission
          missionData = {
            id: etudeDoc.id,
            numeroMission: documentData.numeroEtude,
            structureId: documentData.structureId || '',
            companyId: '', // À récupérer depuis l'entreprise
            company: documentData.company || '',
            location: documentData.location || '',
            startDate: documentData.startDate || '',
            endDate: documentData.endDate || '',
            description: documentData.description || '',
            missionTypeId: documentData.missionTypeId || '',
            studentCount: documentData.consultantCount || 0,
            hoursPerStudent: documentData.hours?.toString() || '0',
            chargeId: documentData.chargeId || '',
            chargeName: documentData.chargeName || '',
            title: `Étude ${documentData.numeroEtude} - ${documentData.company}`,
            salary: documentData.jeh?.toString() || '0',
            hours: documentData.hours || 0,
            requiresCV: false,
            requiresMotivation: false,
            isPublished: documentData.isPublic || false,
            isPublic: documentData.isPublic || false,
            priceHT: documentData.prixHT || 0,
            totalHT: documentData.prixHT || 0,
            totalTTC: (documentData.prixHT || 0) * 1.2, // TVA 20%
            tva: 20,
            updatedAt: documentData.createdAt || new Date(),
            etape: documentData.etape || 'Négociation',
            createdBy: documentData.createdBy || ''
          };
          if (missionData.chargeId && missionData.chargeName?.startsWith?.('ENC:')) {
            try {
              const chargeDoc = await getDoc(doc(db, 'users', missionData.chargeId));
              missionData.chargeName = await getDecryptedUserDisplayName(missionData.chargeId, chargeDoc.data() || null);
            } catch { /* garder la valeur en cas d'erreur */ }
          }
          setMission(missionData);
          
          // Définir le titre par défaut du document
          const defaultTitle = `PC-${documentNumber}`;
          setDocumentTitle(defaultTitle);
        } else {
        // Si missionId est fourni, chercher directement par ID
        if (missionId) {
          try {
            const missionDoc = await getDoc(doc(db, 'missions', missionId));
            if (missionDoc.exists()) {
              documentData = missionDoc.data();
              collectionName = 'missions';
              
              missionData = {
                id: missionDoc.id,
                ...documentData
              } as Mission;
              if (missionData.chargeId && missionData.chargeName?.startsWith?.('ENC:')) {
                try {
                  const chargeDoc = await getDoc(doc(db, 'users', missionData.chargeId));
                  missionData.chargeName = await getDecryptedUserDisplayName(missionData.chargeId, chargeDoc.data() || null);
                } catch { /* garder la valeur en cas d'erreur */ }
              }
              setMission(missionData);
              
              const defaultTitle = `PC-${missionData.numeroMission || documentNumber}`;
              setDocumentTitle(defaultTitle);
            } else {
              console.error('Mission not found with ID:', missionId);
              setLoading(false);
              return;
            }
          } catch (error) {
            console.error('Error fetching mission by ID:', error);
            setLoading(false);
            return;
          }
        } else {
          // Récupérer les données de la mission par numeroMission (rétrocompatibilité)
          const userDoc = currentUser ? await getDoc(doc(db, 'users', currentUser.uid)) : null;
          const userStructureIdLocal = userDoc?.exists() ? userDoc.data()?.structureId : null;
          const missionsQueryConstraints = [where('numeroMission', '==', documentNumber)];
          if (userStructureIdLocal) {
            missionsQueryConstraints.push(where('structureId', '==', userStructureIdLocal));
          }
          const missionsQuery = query(collection(db, 'missions'), ...missionsQueryConstraints);
          const missionsSnapshot = await getDocs(missionsQuery);
          
          if (missionsSnapshot.empty) {
              console.error('Mission not found with number:', documentNumber);
            setLoading(false);
            return;
          }
          
          const missionDoc = missionsSnapshot.docs[0];
            documentData = missionDoc.data();
            collectionName = 'missions';
            
            // Créer missionData avec l'ID du document Firestore
            missionData = {
              id: missionDoc.id,
              ...documentData
            } as Mission;
            if (missionData.chargeId && missionData.chargeName?.startsWith?.('ENC:')) {
              try {
                const chargeDoc = await getDoc(doc(db, 'users', missionData.chargeId));
                missionData.chargeName = await getDecryptedUserDisplayName(missionData.chargeId, chargeDoc.data() || null);
              } catch { /* garder la valeur en cas d'erreur */ }
            }
            setMission(missionData);
            
            // Définir le titre par défaut du document
            const defaultTitle = `PC-${documentNumber}`;
            setDocumentTitle(defaultTitle);
          }
        }
        
        console.log('Mission data loaded:', missionData);
        
        // Charger les préférences de template sauvegardées
        if (currentUser && missionData.structureId) {
          try {
            const preferencesRef = doc(db, 'templatePreferences', `${missionData.structureId}_proposition_commerciale`);
            const preferencesDoc = await getDoc(preferencesRef);
            if (preferencesDoc.exists()) {
              const prefs = preferencesDoc.data();
              setSavedTemplatePreferences(prefs);
              // Appliquer les préférences sauvegardées
              if (prefs.templateColor) setTemplateColor(prefs.templateColor);
              if (prefs.billingType !== undefined) setBillingType(prefs.billingType);
              if (prefs.showSiret !== undefined) setShowSiret(prefs.showSiret);
              if (prefs.showVatNumber !== undefined) setShowVatNumber(prefs.showVatNumber);
              if (prefs.showLogo !== undefined) setShowLogo(prefs.showLogo);
              if (prefs.showEmail !== undefined) setShowEmail(prefs.showEmail);
              if (prefs.showPhone !== undefined) setShowPhone(prefs.showPhone);
              if (prefs.showPaymentTerms !== undefined) setShowPaymentTerms(prefs.showPaymentTerms);
              if (prefs.showDocumentTitle !== undefined) setShowDocumentTitle(prefs.showDocumentTitle);
              if (prefs.showFreeField !== undefined) setShowFreeField(prefs.showFreeField);
              if (prefs.freeFieldText !== undefined) setFreeFieldText(prefs.freeFieldText);
              if (prefs.freeFieldHtml !== undefined) {
                setFreeFieldHtml(prefs.freeFieldHtml);
              }
              if (prefs.freeFieldFontSize !== undefined) setFreeFieldFontSize(prefs.freeFieldFontSize);
              if (prefs.freeFieldTextAlign !== undefined) setFreeFieldTextAlign(prefs.freeFieldTextAlign);
              if (prefs.showServiceCharacteristics !== undefined) setShowServiceCharacteristics(prefs.showServiceCharacteristics);
              if (prefs.showStudentCount !== undefined) setShowStudentCount(prefs.showStudentCount);
              if (prefs.showHours !== undefined) setShowHours(prefs.showHours);
              if (prefs.showLocation !== undefined) setShowLocation(prefs.showLocation);
              if (prefs.showMissionDescription !== undefined) setShowMissionDescription(prefs.showMissionDescription);
              if (prefs.showDatesAndSchedule !== undefined) setShowDatesAndSchedule(prefs.showDatesAndSchedule);
              if (prefs.showGlobalDiscount !== undefined) setShowGlobalDiscount(prefs.showGlobalDiscount);
              if (prefs.showStructureLogo !== undefined) setShowStructureLogo(prefs.showStructureLogo);
              if (prefs.showChargeMission !== undefined) setShowChargeMission(prefs.showChargeMission);
              if (prefs.showStructureEmail !== undefined) setShowStructureEmail(prefs.showStructureEmail);
              if (prefs.showStructurePhone !== undefined) setShowStructurePhone(prefs.showStructurePhone);
              if (prefs.showStructureSiret !== undefined) setShowStructureSiret(prefs.showStructureSiret);
              if (prefs.showMissionDate !== undefined) setShowMissionDate(prefs.showMissionDate);
              if (prefs.showMissionValidity !== undefined) setShowMissionValidity(prefs.showMissionValidity);
            }
          } catch (error) {
            console.error('Erreur lors du chargement des préférences:', error);
          }
        }
        
        // Récupérer les données de la structure
        if (missionData.structureId) {
          try {
            const structureDoc = await getDoc(doc(db, 'structures', missionData.structureId));
            if (structureDoc.exists()) {
              const structureData = structureDoc.data();
              console.log('Structure data loaded:', structureData);
              console.log('Structure logo from DB:', structureData.logo);
              
              // Gérer les différentes propriétés possibles pour la ville et le code postal
              const city = structureData.city || structureData.ville || '';
              const postalCode = structureData.postalCode || structureData.codePostal || '';
              
              console.log('Structure city/ville:', city);
              console.log('Structure postalCode/codePostal:', postalCode);
              
              setStructure(structureData);
              
              // Initialiser les états du footer avec les données de la structure
              setFooterSiret(structureData.siret || '');
              setFooterTva(structureData.tvaNumber || '');
              setFooterApe(structureData.apeCode || '');
              
              // Initialiser le logo de la structure dans quoteData.companyInfo.logo
              // Le logo est récupéré depuis la DB structures dans le champ logo
              if (structureData.logo) {
                console.log('Initializing companyInfo.logo with structure logo:', structureData.logo);
                setQuoteData(prev => ({
                  ...prev,
                  companyInfo: {
                    ...prev.companyInfo,
                    logo: structureData.logo
                  }
                }));
              }
              
              // Utiliser le logo de la structure s'il existe et qu'aucun logo n'est déjà défini
              // Le logo sera utilisé directement depuis structure.logo dans le composant PDF
              if (structureData.logo && !logoPreview) {
                // Vérifier que le logo est une URL valide ou une base64
                try {
                  // Si c'est une URL, vérifier qu'elle est valide
                  if (structureData.logo.startsWith('http://') || structureData.logo.startsWith('https://')) {
                    const logoUrl = new URL(structureData.logo);
                    if (logoUrl.protocol === 'http:' || logoUrl.protocol === 'https:') {
                      setLogoPreview(structureData.logo);
                    }
                  } else if (structureData.logo.startsWith('data:image/')) {
                    // Si c'est déjà en base64, l'utiliser directement
                    setLogoPreview(structureData.logo);
                  }
                } catch (error) {
                  console.warn('Logo URL invalide:', structureData.logo);
                  // Le logo sera quand même disponible dans structure.logo pour le PDF
                }
              }
            }
                  } catch (error) {
          console.error('Error loading structure data:', error);
        }
        
        // Marquer les données comme prêtes
        setDataReady(true);
      }
        
        // Pré-remplir les données de l'entreprise
        if (isEtude) {
          // Pour les études, récupérer les données d'entreprise depuis la collection orders puis companies
          try {
            // D'abord, chercher dans la collection orders avec le numeroEtude
            console.log('Searching for order with numeroEtude:', documentNumber);
            const ordersQuery = query(
              collection(db, 'orders'),
              where('numeroEtude', '==', documentNumber)
            );
            const ordersSnapshot = await getDocs(ordersQuery);
            
            console.log('Orders found:', ordersSnapshot.size);
            
            if (!ordersSnapshot.empty) {
              const orderDoc = ordersSnapshot.docs[0];
              const orderData = orderDoc.data();
              console.log('Order data found:', orderData);
              console.log('Order companyId:', orderData.companyId);
              
                              if (orderData.companyId) {
                  // Récupérer les données complètes de l'entreprise depuis la collection companies
                  console.log('Fetching company with ID:', orderData.companyId);
                  const companyDoc = await getDoc(doc(db, 'companies', orderData.companyId));
                  if (companyDoc.exists()) {
                    const companyData = companyDoc.data();
                    console.log('Company data loaded from orders:', companyData);
                    console.log('Company name:', companyData.name);
                    console.log('Company address:', companyData.address);
                    console.log('Company city:', companyData.city);
                    console.log('Company postalCode:', companyData.postalCode);
                    console.log('Company country:', companyData.country);
                    console.log('Company logo:', companyData.logo);
                    console.log('Company email:', companyData.email);
                    console.log('Company phone:', companyData.phone);
                  
                    setQuoteData(prev => {
                      const updatedQuoteData = {
                        ...prev,
                        companyInfo: {
                          name: companyData.name || missionData.company || '',
                          address: companyData.address || '',
                          city: companyData.city || '',
                          postalCode: companyData.postalCode || '',
                          country: companyData.country || 'France',
                          siret: companyData.nSiret || ''
                        },
                        clientInfo: {
                          name: companyData.name || missionData.company || '',
                          address: companyData.address || '',
                          complement: '',
                          postalCode: companyData.postalCode || '',
                          city: companyData.city || '',
                          country: companyData.country || 'France',
                          siret: companyData.nSiret || '',
                          vatNumber: companyData.vatNumber || '',
                          logo: companyData.logo || '',
                          email: companyData.email || '',
                          phone: companyData.phone || ''
                        }
                      };
                      
                      console.log('Updated quote data:', updatedQuoteData);
                      return updatedQuoteData;
                    });
                } else {
                  console.warn('Company not found with ID:', orderData.companyId);
                  // Utiliser les données de base de l'étude
                  setQuoteData(prev => ({
                    ...prev,
                    companyInfo: {
                      name: missionData.company || '',
                      address: '',
                      city: missionData.location || '',
                      postalCode: '',
                      country: 'France',
                      siret: ''
                    },
                    clientInfo: {
                      name: missionData.company || '',
                      address: '',
                      complement: '',
                      postalCode: '',
                      city: missionData.location || '',
                      country: 'France',
                      siret: '',
                      vatNumber: '',
                      logo: '',
                      email: '',
                      phone: ''
                    }
                  }));
                }
              } else {
                console.warn('No companyId found in order');
                // Utiliser les données de base de l'étude
                setQuoteData(prev => ({
                  ...prev,
                  companyInfo: {
                    name: missionData.company || '',
                    address: '',
                    city: missionData.location || '',
                    postalCode: '',
                    country: 'France',
                    siret: ''
                  },
                  clientInfo: {
                    name: missionData.company || '',
                    address: '',
                    complement: '',
                    postalCode: '',
                    city: missionData.location || '',
                    country: 'France',
                    siret: '',
                    vatNumber: '',
                    logo: '',
                    email: '',
                    phone: ''
                  }
                }));
              }
            } else {
              // Pas de commande trouvée pour cette étude - c'est normal pour les nouvelles études
              console.log('No order found for study:', documentNumber, '- Using company data directly');
              // Essayer de récupérer les données de l'entreprise directement par le nom
              try {
                console.log('Trying to find company by name:', missionData.company);
                const companyQueryConstraints = [where('name', '==', missionData.company)];
                if (missionData.structureId) {
                  companyQueryConstraints.push(where('structureId', '==', missionData.structureId));
                }
                const companiesQuery = query(collection(db, 'companies'), ...companyQueryConstraints);
                const companiesSnapshot = await getDocs(companiesQuery);
                
                if (!companiesSnapshot.empty) {
                  const companyDoc = companiesSnapshot.docs[0];
                  const companyData = companyDoc.data();
                  console.log('Company found by name:', companyData);
                  
                  setQuoteData(prev => ({
                    ...prev,
                    companyInfo: {
                      name: companyData.name || missionData.company || '',
                      address: companyData.address || '',
                      city: companyData.city || '',
                      postalCode: companyData.postalCode || '',
                      country: companyData.country || 'France',
                      siret: companyData.nSiret || ''
                    },
                    clientInfo: {
                      name: companyData.name || missionData.company || '',
                      address: companyData.address || '',
                      complement: '',
                      postalCode: companyData.postalCode || '',
                      city: companyData.city || '',
                      country: companyData.country || 'France',
                      siret: companyData.nSiret || '',
                      vatNumber: companyData.vatNumber || '',
                      logo: companyData.logo || '',
                      email: companyData.email || '',
                      phone: companyData.phone || ''
                    }
                  }));
                } else {
                  console.warn('No company found by name:', missionData.company);
                  // Utiliser les données de base de l'étude
                  setQuoteData(prev => ({
                    ...prev,
                    companyInfo: {
                      name: missionData.company || '',
                      address: '',
                      city: missionData.location || '',
                      postalCode: '',
                      country: 'France',
                      siret: ''
                    },
                    clientInfo: {
                      name: missionData.company || '',
                      address: '',
                      complement: '',
                      postalCode: '',
                      city: missionData.location || '',
                      country: 'France',
                      siret: '',
                      vatNumber: '',
                      logo: '',
                      email: '',
                      phone: ''
                    }
                  }));
                }
              } catch (error) {
                console.error('Error searching company by name:', error);
                // Utiliser les données de base de l'étude en cas d'erreur
                setQuoteData(prev => ({
                  ...prev,
                  companyInfo: {
                    name: missionData.company || '',
                    address: '',
                    city: missionData.location || '',
                    postalCode: '',
                    country: 'France',
                    siret: ''
                  },
                  clientInfo: {
                    name: missionData.company || '',
                    address: '',
                    complement: '',
                    postalCode: '',
                    city: missionData.location || '',
                    country: 'France',
                    siret: '',
                    vatNumber: '',
                    logo: '',
                    email: '',
                    phone: ''
                  }
                }));
              }
            }
          } catch (error) {
            console.error('Error loading company data from orders:', error);
            // Utiliser les données de base de l'étude en cas d'erreur
            setQuoteData(prev => ({
              ...prev,
              companyInfo: {
                name: missionData.company || '',
                address: '',
                city: missionData.location || '',
                postalCode: '',
                country: 'France',
                siret: ''
              },
              clientInfo: {
                name: missionData.company || '',
                address: '',
                complement: '',
                postalCode: '',
                city: missionData.location || '',
                country: 'France',
                siret: '',
                vatNumber: '',
                logo: '',
                email: '',
                phone: ''
              }
            }));
          }
        } else if (missionData.companyId) {
          // Pour les missions, récupérer les données d'entreprise depuis la collection companies
          try {
            const companyDoc = await getDoc(doc(db, 'companies', missionData.companyId));
            if (companyDoc.exists()) {
              const companyData = companyDoc.data();
              console.log('Company data loaded:', companyData);
              
              setQuoteData(prev => ({
                ...prev,
                companyInfo: {
                  name: companyData.name || missionData.company || '',
                  address: companyData.address || '',
                  city: companyData.city || '',
                  postalCode: companyData.postalCode || '',
                  country: companyData.country || 'France',
                  siret: companyData.nSiret || ''
                },
                clientInfo: {
                  name: companyData.name || missionData.company || '',
                  address: companyData.address || '',
                  complement: '',
                  postalCode: companyData.postalCode || '',
                  city: companyData.city || '',
                  country: companyData.country || 'France',
                  siret: companyData.nSiret || '',
                  vatNumber: companyData.vatNumber || '',
                  logo: companyData.logo || '',
                  email: companyData.email || '',
                  phone: companyData.phone || ''
                }
              }));
            } else {
              // Si pas de données d'entreprise, utiliser les données de la mission
              setQuoteData(prev => ({
                ...prev,
                companyInfo: {
                  name: missionData.company || '',
                  address: '',
                  city: '',
                  postalCode: '',
                  country: 'France',
                  siret: ''
                },
                clientInfo: {
                  name: missionData.company || '',
                  address: '',
                  complement: '',
                  postalCode: '',
                  city: '',
                  country: 'France',
                  siret: '',
                  vatNumber: '',
                  logo: '',
                  email: '',
                  phone: ''
                }
              }));
            }
          } catch (error) {
            console.error('Error loading company data:', error);
            // Utiliser les données de la mission en cas d'erreur
            setQuoteData(prev => ({
              ...prev,
              companyInfo: {
                name: missionData.company || '',
                address: '',
                city: '',
                postalCode: '',
                country: 'France',
                siret: ''
              },
              clientInfo: {
                name: missionData.company || '',
                address: '',
                complement: '',
                postalCode: '',
                city: '',
                country: 'France'
              }
            }));
          }
        }
        
        // Récupérer les contacts
        if (isEtude) {
          // Pour les études, utiliser les contacts passés via l'URL ou charger depuis la base
          if (contactId && contactEmail) {
            // Créer un contact virtuel avec les informations de l'URL
            const virtualContact: Contact = {
              id: contactId,
              companyId: missionData.companyId || '',
              firstName: contactFirstName || '',
              lastName: contactLastName || '',
              email: contactEmail,
              gender: (contactGender as 'homme' | 'femme') || undefined
            };
            setContacts([virtualContact]);
            console.log('Contact virtuel créé depuis l\'URL:', virtualContact);
          } else {
            // Essayer de charger les contacts depuis la base de données
            try {
              // D'abord, essayer de trouver l'entreprise par nom
              if (missionData.company) {
                const companyQueryConstraints2 = [where('name', '==', missionData.company)];
                if (missionData.structureId) {
                  companyQueryConstraints2.push(where('structureId', '==', missionData.structureId));
                }
                const companiesQuery = query(collection(db, 'companies'), ...companyQueryConstraints2);
                const companiesSnapshot = await getDocs(companiesQuery);
                
                if (!companiesSnapshot.empty) {
                  const companyDoc = companiesSnapshot.docs[0];
                  const companyData = companyDoc.data();
                  console.log('Entreprise trouvée par nom:', companyData);
                  
                  // Maintenant chercher les contacts avec l'ID de l'entreprise
                  const contactsQuery = query(
                    collection(db, 'contacts'),
                    where('companyId', '==', companyDoc.id)
                  );
                  const contactsSnapshot = await getDocs(contactsQuery);
                  const contactsData = contactsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                  })) as Contact[];
                  setContacts(contactsData);
                  console.log('Contacts trouvés pour l\'entreprise:', contactsData);
                } else {
                  console.log('Aucune entreprise trouvée avec le nom:', missionData.company);
                  // Créer un contact par défaut avec les informations de base
                  const defaultContact: Contact = {
                    id: 'default-contact',
                    companyId: '',
                    firstName: 'Contact',
                    lastName: missionData.company || 'Client',
                    email: '',
                    gender: undefined
                  };
                  setContacts([defaultContact]);
                  console.log('Contact par défaut créé:', defaultContact);
                }
              } else {
                console.log('Aucun nom d\'entreprise disponible pour chercher les contacts');
                // Créer un contact par défaut
                const defaultContact: Contact = {
                  id: 'default-contact',
                  companyId: '',
                  firstName: 'Contact',
                  lastName: 'Client',
                  email: '',
                  gender: undefined
                };
                setContacts([defaultContact]);
                console.log('Contact par défaut créé:', defaultContact);
              }
            } catch (error) {
              console.warn('Erreur lors du chargement des contacts:', error);
              setContacts([]);
            }
          }
        } else if (missionData.companyId) {
          // Pour les missions, récupérer les contacts depuis la collection contacts
          const contactsQuery = query(
            collection(db, 'contacts'),
            where('companyId', '==', missionData.companyId)
          );
          const contactsSnapshot = await getDocs(contactsQuery);
          const contactsData = contactsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Contact[];
          setContacts(contactsData);
        }
        
        // Pré-remplir les lignes de devis avec les données de l'étude
        if (isEtude && missionData) {
          try {
            // Récupérer les postes de budget de l'étude
            const budgetItemsQuery = query(
              collection(db, 'budgetItems'),
              where('etudeId', '==', missionData.id)
            );
            const budgetItemsSnapshot = await getDocs(budgetItemsQuery);
            const budgetItems = budgetItemsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            
            console.log('Budget items found:', budgetItems);
            
            const defaultLines: QuoteLine[] = [];
            let lineId = 1;
            
            // Ajouter les lignes basées sur les postes de budget
            budgetItems.forEach((budgetItem, index) => {
              if (budgetItem.budget && budgetItem.budget > 0) {
                defaultLines.push({
                  id: lineId.toString(),
                  designation: budgetItem.title || `Poste de budget ${index + 1}`,
                  quantity: 1,
                  unitPrice: budgetItem.budget,
                  tva: 20,
                  totalHT: budgetItem.budget,
                  totalTTC: budgetItem.budget * 1.2
                });
                lineId++;
              }
            });
            
            // Si aucun poste de budget trouvé, utiliser les données de base de l'étude
            if (defaultLines.length === 0) {
              // Ajouter une ligne pour les honoraires de conseil
              if (missionData.prixHT && missionData.prixHT > 0) {
                defaultLines.push({
                  id: '1',
                  designation: `Étude ${missionData.numeroMission} - ${missionData.company}`,
                  quantity: 1,
                  unitPrice: missionData.prixHT,
                  tva: 20,
                  totalHT: missionData.prixHT,
                  totalTTC: missionData.prixHT * 1.2
                });
              }
              
              // Ajouter une ligne pour les JEH si applicable
              if (missionData.jeh && missionData.jeh > 0 && missionData.consultantCount && missionData.consultantCount > 0) {
                defaultLines.push({
                  id: '2',
                  designation: `Prestation de conseil - ${missionData.consultantCount} consultant(s)`,
                  quantity: missionData.hours || 1,
                  unitPrice: missionData.jeh,
                  tva: 20,
                  totalHT: (missionData.hours || 1) * missionData.jeh,
                  totalTTC: (missionData.hours || 1) * missionData.jeh * 1.2
                });
              }
            }
            
            if (defaultLines.length > 0) {
              const totals = defaultLines.reduce((acc, line) => {
                return {
                  totalHT: acc.totalHT + line.totalHT,
                  totalTVA: acc.totalTVA + (line.totalHT * 0.2),
                  totalTTC: acc.totalTTC + line.totalTTC
                };
              }, { totalHT: 0, totalTVA: 0, totalTTC: 0 });
              
              setQuoteData(prev => ({
                ...prev,
                lines: defaultLines,
                totals
              }));
            }
          } catch (error) {
            console.error('Erreur lors de la récupération des postes de budget:', error);
            // En cas d'erreur, utiliser les données de base de l'étude
            const defaultLines: QuoteLine[] = [];
            
            if (missionData.prixHT && missionData.prixHT > 0) {
              defaultLines.push({
                id: '1',
                designation: `Étude ${missionData.numeroMission} - ${missionData.company}`,
                quantity: 1,
                unitPrice: missionData.prixHT,
                tva: 20,
                totalHT: missionData.prixHT,
                totalTTC: missionData.prixHT * 1.2
              });
            }
            
            if (defaultLines.length > 0) {
              const totals = defaultLines.reduce((acc, line) => {
                return {
                  totalHT: acc.totalHT + line.totalHT,
                  totalTVA: acc.totalTVA + (line.totalHT * 0.2),
                  totalTTC: acc.totalTTC + line.totalTTC
                };
              }, { totalHT: 0, totalTVA: 0, totalTTC: 0 });
              
              setQuoteData(prev => ({
                ...prev,
                lines: defaultLines,
                totals
              }));
            }
          }
        } else if (!isEtude && missionData) {
          // Pour les missions, créer une ligne par défaut avec les informations de la mission
          try {
            let missionTypeTitle = 'Mission';
            
            // Récupérer le type de mission si missionTypeId est disponible
            if (missionData.missionTypeId) {
              try {
                const missionTypeDoc = await getDoc(doc(db, 'missionTypes', missionData.missionTypeId));
                if (missionTypeDoc.exists()) {
                  const missionTypeData = missionTypeDoc.data();
                  missionTypeTitle = missionTypeData.title || 'Mission';
                }
              } catch (error) {
                console.warn('Erreur lors de la récupération du type de mission:', error);
              }
            }
            
            // Calculer le prix unitaire et la quantité
            // priceHT est le prix unitaire (prix par heure), donc on l'utilise directement
            const hours = missionData.hours || 0;
            const prixHT = missionData.prixHT || missionData.priceHT || 0;
            const unitPrice = prixHT; // prixHT est déjà le prix unitaire
            const quantity = hours > 0 ? hours : 1;
            const totalHT = unitPrice * quantity; // Calculer le total HT
            
            // Créer la ligne par défaut
            const defaultLine: QuoteLine = {
              id: '1',
              designation: missionTypeTitle,
              quantity: quantity,
              unitPrice: unitPrice,
              tva: 20,
              totalHT: totalHT,
              totalTTC: totalHT * 1.2
            };
            
            const totals = {
              totalHT: defaultLine.totalHT,
              totalTVA: defaultLine.totalHT * 0.2,
              totalTTC: defaultLine.totalTTC
            };
            
            setQuoteData(prev => ({
              ...prev,
              lines: [defaultLine],
              totals
            }));
          } catch (error) {
            console.error('Erreur lors de la création de la ligne par défaut:', error);
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        setSnackbar({
          open: true,
          message: 'Erreur lors du chargement des données',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMissionData();
  }, [documentNumber, isEtude]); // Utiliser documentNumber et isEtude comme dépendances

  const calculateLineTotal = (line: QuoteLine) => {
    const totalHT = line.quantity * line.unitPrice;
    const totalTVA = totalHT * (line.tva / 100);
    const totalTTC = totalHT + totalTVA;
    
    return { totalHT, totalTVA, totalTTC };
  };

  const calculateTotals = (lines: QuoteLine[]) => {
    const totals = lines.reduce((acc, line) => {
      const lineTotals = calculateLineTotal(line);
      return {
        totalHT: acc.totalHT + lineTotals.totalHT,
        totalTVA: acc.totalTVA + lineTotals.totalTVA,
        totalTTC: acc.totalTTC + lineTotals.totalTTC
      };
    }, { totalHT: 0, totalTVA: 0, totalTTC: 0 });
    
    return totals;
  };

  // Fonctions pour la remise globale
  const handleGlobalDiscountPercentChange = (percent: number) => {
    setGlobalDiscountPercent(percent);
    const totalHT = quoteData.totals.totalHT;
    const amount = (totalHT * percent) / 100;
    setGlobalDiscountAmount(amount);
  };

  const handleGlobalDiscountAmountChange = (amount: number) => {
    setGlobalDiscountAmount(amount);
    const totalHT = quoteData.totals.totalHT;
    const percent = totalHT > 0 ? (amount / totalHT) * 100 : 0;
    setGlobalDiscountPercent(percent);
  };

  const getTotalWithDiscount = () => {
    const totalHT = quoteData.totals.totalHT;
    const totalAfterDiscount = totalHT - globalDiscountAmount;
    const totalTVA = (totalAfterDiscount * 0.2); // TVA 20%
    const totalTTC = totalAfterDiscount + totalTVA;
    
    return {
      totalHT: totalAfterDiscount,
      totalTVA: totalTVA,
      totalTTC: totalTTC
    };
  };

  const updateLine = (lineId: string, field: keyof QuoteLine, value: any) => {
    setQuoteData(prev => {
      const updatedLines = prev.lines.map(line => {
        if (line.id === lineId) {
          const updatedLine = { ...line, [field]: value };
          const totals = calculateLineTotal(updatedLine);
          return { ...updatedLine, ...totals };
        }
        return line;
      });
      
      const totals = calculateTotals(updatedLines);
      
      return {
        ...prev,
        lines: updatedLines,
        totals
      };
    });
  };

  const addLine = () => {
    const newLine: QuoteLine = {
      id: Date.now().toString(),
      designation: '',
      quantity: 1,
      unitPrice: 0,
      tva: 20,
      totalHT: 0,
      totalTTC: 0
    };
    
    setQuoteData(prev => ({
      ...prev,
      lines: [...prev.lines, newLine]
    }));
  };

  const removeLine = (lineId: string) => {
    setQuoteData(prev => {
      const updatedLines = prev.lines.filter(line => line.id !== lineId);
      const totals = calculateTotals(updatedLines);
      
      return {
        ...prev,
        lines: updatedLines,
        totals
      };
    });
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Vérifier le type de fichier
      if (!file.type.startsWith('image/')) {
        setSnackbar({
          open: true,
          message: 'Veuillez sélectionner une image',
          severity: 'error'
        });
        return;
      }

      // Vérifier la taille (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setSnackbar({
          open: true,
          message: 'L\'image doit faire moins de 5MB',
          severity: 'error'
        });
        return;
      }

      setLogoFile(file);
      
      // Créer un aperçu
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      setSnackbar({
        open: true,
        message: 'Logo importé avec succès',
        severity: 'success'
      });
    }
  };

  const handleLogoClick = () => {
    fileInputRef.current?.click();
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Synchroniser les données avant la génération du PDF
      syncDataForPDF();
      
      // React-PDF gère automatiquement la génération
      // Le composant PDFDownloadLink s'occupe du téléchargement
      
      setSnackbar({
        open: true,
        message: 'Devis généré avec succès !',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la génération du PDF',
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setSaving(true);
      
      // React-PDF gère automatiquement la génération
      // Le composant PDFDownloadLink s'occupe du téléchargement
      
      setSnackbar({
        open: true,
        message: 'Devis généré avec succès !',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la génération du PDF',
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  // Fonction pour générer le PDF et retourner un blob
  const generatePDF = async (): Promise<Blob> => {
    if (!mission || !structure || !quoteData) {
      throw new Error('Données manquantes pour générer le PDF');
    }
    
    try {
      // Générer le PDF réel avec react-pdf
      const pdfDoc = (
        <QuotePDF
          mission={mission}
          structure={structure}
          quoteData={quoteData}
          logoPreview={logoPreview}
          convertedStructureLogo={convertedStructureLogo}
          convertedClientLogo={convertedClientLogo}
          footerSiret={footerSiret}
          footerTva={footerTva}
          footerApe={footerApe}
          templateColor={templateColor}
          showDocumentTitle={showDocumentTitle}
          documentTitle={documentTitle}
          showFreeField={showFreeField}
          freeFieldText={freeFieldText}
          freeFieldSegments={freeFieldSegments}
          freeFieldFontSize={freeFieldFontSize}
          freeFieldTextAlign={freeFieldTextAlign}
          showSiret={showSiret}
          showVatNumber={showVatNumber}
          showLogo={showLogo}
          showEmail={showEmail}
          showPhone={showPhone}
          showGlobalDiscount={showGlobalDiscount}
          globalDiscountPercent={globalDiscountPercent}
          globalDiscountAmount={globalDiscountAmount}
          showStructureLogo={showStructureLogo}
          showChargeMission={showChargeMission}
          showStructureEmail={showStructureEmail}
          showStructurePhone={showStructurePhone}
          showStructureSiret={showStructureSiret}
          showMissionDate={showMissionDate}
          showMissionValidity={showMissionValidity}
          showServiceCharacteristics={showServiceCharacteristics}
          showStudentCount={showStudentCount}
          showHours={showHours}
          showLocation={showLocation}
          showMissionDescription={showMissionDescription}
          showDatesAndSchedule={showDatesAndSchedule}
          contactFirstName={contactFirstName}
          contactLastName={contactLastName}
          contacts={contacts}
        />
      );
      
      const asPdf = pdf(pdfDoc);
      const blob = await asPdf.toBlob();
      return blob;
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      throw error;
    }
  };

  // Fonction pour mettre à jour le contenu du champ libre
  const updateFreeFieldContent = () => {
    if (freeFieldEditorRef.current) {
      const html = freeFieldEditorRef.current.innerHTML;
      setFreeFieldHtml(html);
      const text = freeFieldEditorRef.current.innerText || freeFieldEditorRef.current.textContent || '';
      setFreeFieldText(text);
    }
  };

  // Synchroniser le contenu HTML de l'éditeur avec l'état
  useEffect(() => {
    if (freeFieldEditorRef.current && freeFieldHtml !== undefined) {
      // Ne mettre à jour que si le contenu est différent pour éviter les boucles
      // et seulement si l'éditeur n'a pas le focus (pour ne pas interrompre la saisie)
      if (freeFieldEditorRef.current.innerHTML !== freeFieldHtml && document.activeElement !== freeFieldEditorRef.current) {
        freeFieldEditorRef.current.innerHTML = freeFieldHtml || freeFieldText || '';
      }
    }
  }, [freeFieldHtml, freeFieldText]);
  
  // Fonction pour nettoyer les spans vides (zero-width space) après la saisie
  const cleanupEmptySpans = () => {
    if (!freeFieldEditorRef.current) return;
    
    const spans = freeFieldEditorRef.current.querySelectorAll('span');
    spans.forEach(span => {
      // Si le span ne contient que le zero-width space ou est vide (sans texte réel), le supprimer
      const textContent = span.textContent || '';
      const innerHTML = span.innerHTML;
      if ((innerHTML === '&#8203;' || innerHTML === '\u200B' || textContent === '\u200B' || textContent.trim() === '') && 
          !span.hasAttribute('style')) {
        // Ne supprimer que si le span n'a pas de style (pour éviter de supprimer des spans avec du formatage)
        const parent = span.parentNode;
        if (parent) {
          parent.removeChild(span);
          // Normaliser le parent pour fusionner les nœuds de texte adjacents
          parent.normalize();
        }
      } else if (textContent.trim() === '' && span.style.fontSize && span.style.textAlign) {
        // Si le span a des styles mais est vide, le supprimer aussi
        const parent = span.parentNode;
        if (parent) {
          parent.removeChild(span);
          parent.normalize();
        }
      }
    });
  };

  // Fonction pour parser le HTML et extraire les segments de texte avec leurs styles
  const parseHtmlToTextSegments = (html: string): Array<{ text: string; fontSize?: number; textAlign?: string; fontWeight?: string; fontStyle?: string }> => {
    if (!html) return [];
    
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      const segments: Array<{ text: string; fontSize?: number; textAlign?: string; fontWeight?: string; fontStyle?: string }> = [];
      
      const extractText = (node: Node, inheritedFontSize?: number, inheritedAlign?: string, inheritedFontWeight?: string, inheritedFontStyle?: string) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          if (text && text !== '\u200B') { // Ignorer zero-width space
            segments.push({
              text: text,
              fontSize: inheritedFontSize,
              textAlign: inheritedAlign,
              fontWeight: inheritedFontWeight,
              fontStyle: inheritedFontStyle
            });
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          
          // Extraire les styles inline directement depuis l'attribut style
          let fontSize = inheritedFontSize;
          let textAlign = inheritedAlign;
          let fontWeight = inheritedFontWeight;
          let fontStyle = inheritedFontStyle;
          
          if (element.style.fontSize) {
            const fontSizeValue = element.style.fontSize;
            fontSize = parseFloat(fontSizeValue);
          } else if (element.hasAttribute('style')) {
            const styleAttr = element.getAttribute('style') || '';
            const fontSizeMatch = styleAttr.match(/font-size:\s*(\d+(?:\.\d+)?)px/);
            if (fontSizeMatch) {
              fontSize = parseFloat(fontSizeMatch[1]);
            }
          }
          
          if (element.style.textAlign) {
            textAlign = element.style.textAlign;
          } else if (element.hasAttribute('style')) {
            const styleAttr = element.getAttribute('style') || '';
            const textAlignMatch = styleAttr.match(/text-align:\s*(\w+)/);
            if (textAlignMatch) {
              textAlign = textAlignMatch[1];
            }
          }
          
          if (element.style.fontWeight) {
            fontWeight = element.style.fontWeight;
          } else if (element.hasAttribute('style')) {
            const styleAttr = element.getAttribute('style') || '';
            const fontWeightMatch = styleAttr.match(/font-weight:\s*(\w+)/);
            if (fontWeightMatch) {
              fontWeight = fontWeightMatch[1];
            }
          }
          
          if (element.style.fontStyle) {
            fontStyle = element.style.fontStyle;
          } else if (element.hasAttribute('style')) {
            const styleAttr = element.getAttribute('style') || '';
            const fontStyleMatch = styleAttr.match(/font-style:\s*(\w+)/);
            if (fontStyleMatch) {
              fontStyle = fontStyleMatch[1];
            }
          }
          
          // Traiter les enfants
          Array.from(element.childNodes).forEach(child => {
            extractText(child, fontSize, textAlign, fontWeight, fontStyle);
          });
        }
      };
      
      Array.from(tempDiv.childNodes).forEach(node => {
        extractText(node, freeFieldFontSize, freeFieldTextAlign);
      });
      
      return segments;
    } catch (error) {
      console.error('Erreur lors du parsing HTML:', error);
      return [{ text: freeFieldText || '' }];
    }
  };
  
  // Mémoriser les segments parsés pour le PDF
  const freeFieldSegments = useMemo(() => {
    if (freeFieldHtml) {
      return parseHtmlToTextSegments(freeFieldHtml);
    }
    return null;
  }, [freeFieldHtml, freeFieldFontSize, freeFieldTextAlign]);

  // Fonction pour appliquer la taille de police sur la sélection ou au curseur
  const applyFontSizeToSelection = (fontSize: number) => {
    if (!freeFieldEditorRef.current) return;
    
    // S'assurer que l'éditeur a le focus
    freeFieldEditorRef.current.focus();
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // Si pas de sélection, créer un span au début de l'éditeur
      if (freeFieldEditorRef.current) {
        const span = document.createElement('span');
        span.style.fontSize = `${fontSize}px`;
        span.innerHTML = '&#8203;';
        freeFieldEditorRef.current.appendChild(span);
        const range = document.createRange();
        range.setStartAfter(span);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        updateFreeFieldContent();
      }
      return;
    }

    const range = selection.getRangeAt(0);
    
    // Vérifier que la sélection est dans l'éditeur
    if (!freeFieldEditorRef.current.contains(range.commonAncestorContainer)) return;

    try {
      if (!selection.isCollapsed) {
        // Texte sélectionné : appliquer le style à la sélection
        const selectedText = range.toString();
        if (!selectedText) return;
        
        // Créer un span avec la nouvelle taille
        const span = document.createElement('span');
        span.style.fontSize = `${fontSize}px`;
        span.textContent = selectedText;
        
        // Supprimer le contenu sélectionné et le remplacer par le span
        range.deleteContents();
        range.insertNode(span);
        
        // Restaurer la sélection sur le nouveau span
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        selection.addRange(newRange);
      } else {
        // Pas de sélection : créer un span vide au curseur pour le texte à venir
        const span = document.createElement('span');
        span.style.fontSize = `${fontSize}px`;
        span.innerHTML = '&#8203;'; // Zero-width space pour maintenir le span
        
        // Insérer le span au curseur
        range.insertNode(span);
        
        // Placer le curseur après le span
        range.setStartAfter(span);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      
      // Mettre à jour le contenu
      updateFreeFieldContent();
    } catch (error) {
      console.error('Erreur lors de l\'application de la taille de police:', error);
    }
  };

  // Fonction pour appliquer le gras sur la sélection ou au curseur
  const applyBoldToSelection = () => {
    if (!freeFieldEditorRef.current) return;
    
    freeFieldEditorRef.current.focus();
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      if (freeFieldEditorRef.current) {
        const span = document.createElement('span');
        span.style.fontWeight = 'bold';
        span.innerHTML = '&#8203;';
        freeFieldEditorRef.current.appendChild(span);
        const range = document.createRange();
        range.setStartAfter(span);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        updateFreeFieldContent();
      }
      return;
    }

    const range = selection.getRangeAt(0);
    if (!freeFieldEditorRef.current.contains(range.commonAncestorContainer)) return;

    try {
      if (!selection.isCollapsed) {
        const selectedText = range.toString();
        if (!selectedText) return;
        
        const span = document.createElement('span');
        span.style.fontWeight = 'bold';
        span.textContent = selectedText;
        
        range.deleteContents();
        range.insertNode(span);
        
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        selection.addRange(newRange);
      } else {
        const span = document.createElement('span');
        span.style.fontWeight = 'bold';
        span.innerHTML = '&#8203;';
        
        range.insertNode(span);
        range.setStartAfter(span);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      
      updateFreeFieldContent();
    } catch (error) {
      console.error('Erreur lors de l\'application du gras:', error);
    }
  };

  // Fonction pour appliquer l'italique sur la sélection ou au curseur
  const applyItalicToSelection = () => {
    if (!freeFieldEditorRef.current) return;
    
    freeFieldEditorRef.current.focus();
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      if (freeFieldEditorRef.current) {
        const span = document.createElement('span');
        span.style.fontStyle = 'italic';
        span.innerHTML = '&#8203;';
        freeFieldEditorRef.current.appendChild(span);
        const range = document.createRange();
        range.setStartAfter(span);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        updateFreeFieldContent();
      }
      return;
    }

    const range = selection.getRangeAt(0);
    if (!freeFieldEditorRef.current.contains(range.commonAncestorContainer)) return;

    try {
      if (!selection.isCollapsed) {
        const selectedText = range.toString();
        if (!selectedText) return;
        
        const span = document.createElement('span');
        span.style.fontStyle = 'italic';
        span.textContent = selectedText;
        
        range.deleteContents();
        range.insertNode(span);
        
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        selection.addRange(newRange);
      } else {
        const span = document.createElement('span');
        span.style.fontStyle = 'italic';
        span.innerHTML = '&#8203;';
        
        range.insertNode(span);
        range.setStartAfter(span);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      
      updateFreeFieldContent();
    } catch (error) {
      console.error('Erreur lors de l\'application de l\'italique:', error);
    }
  };

  // Fonction pour appliquer l'alignement sur la sélection ou au curseur
  const applyTextAlignToSelection = (align: 'left' | 'center' | 'right' | 'justify') => {
    if (!freeFieldEditorRef.current) return;
    
    // S'assurer que l'éditeur a le focus
    freeFieldEditorRef.current.focus();
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    
    // Vérifier que la sélection est dans l'éditeur
    if (!freeFieldEditorRef.current.contains(range.commonAncestorContainer)) return;

    try {
      if (!selection.isCollapsed) {
        // Texte sélectionné : appliquer l'alignement à la sélection
        const selectedText = range.toString();
        if (!selectedText) return;
        
        // Créer un span avec l'alignement
        const span = document.createElement('span');
        span.style.textAlign = align;
        span.style.display = 'block';
        span.textContent = selectedText;
        
        // Supprimer le contenu sélectionné et le remplacer par le span
        range.deleteContents();
        range.insertNode(span);
        
        // Restaurer la sélection sur le nouveau span
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        selection.addRange(newRange);
      } else {
        // Pas de sélection : créer un span avec alignement au curseur pour le texte à venir
        const span = document.createElement('span');
        span.style.textAlign = align;
        span.style.display = 'block';
        span.innerHTML = '&#8203;'; // Zero-width space pour maintenir le span
        
        // Insérer le span au curseur
        range.insertNode(span);
        
        // Placer le curseur après le span
        range.setStartAfter(span);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      
      // Mettre à jour le contenu
      updateFreeFieldContent();
    } catch (error) {
      console.error('Erreur lors de l\'application de l\'alignement:', error);
    }
  };

  // Fonction pour sauvegarder la proposition comme document
  // Fonction pour sauvegarder les préférences de template
  const saveTemplatePreferences = async () => {
    if (!currentUser || !structure?.id) return;
    
    try {
      const preferences = {
        templateColor,
        billingType,
        showSiret,
        showVatNumber,
        showLogo,
        showEmail,
        showPhone,
        showPaymentTerms,
        showDocumentTitle,
        showFreeField,
        freeFieldText,
        freeFieldHtml,
        freeFieldFontSize,
        freeFieldTextAlign,
        showServiceCharacteristics,
        showStudentCount,
        showHours,
        showLocation,
        showMissionDescription,
        showDatesAndSchedule,
        showGlobalDiscount,
        showStructureLogo,
        showChargeMission,
        showStructureEmail,
        showStructurePhone,
        showStructureSiret,
        showMissionDate,
        showMissionValidity,
        updatedAt: new Date(),
        updatedBy: currentUser.uid
      };
      
      const preferencesRef = doc(db, 'templatePreferences', `${structure.id}_proposition_commerciale`);
      await setDoc(preferencesRef, preferences, { merge: true });
      
      setSavedTemplatePreferences(preferences);
      setSavePreferencesDialogOpen(false);
      
      setSnackbar({
        open: true,
        message: 'Préférences de template enregistrées avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des préférences:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la sauvegarde des préférences',
        severity: 'error'
      });
    }
  };

  const saveQuoteAsDocument = async (pdfBlob: Blob, type: string, isDraft: boolean): Promise<void> => {
    console.log('📥 saveQuoteAsDocument appelé avec:', { type, isDraft, pdfBlobSize: pdfBlob?.size });
    console.log('📋 Mission dans saveQuoteAsDocument:', mission);
    console.log('📋 Storage dans saveQuoteAsDocument:', !!storage);
    
    try {
      // Log des données avant sauvegarde pour déboguer
      if (isDraft) {
        console.log('=== SAUVEGARDE DU BROUILLON ===');
        console.log('Structure à sauvegarder:', structure);
        console.log('Mission à sauvegarder:', mission);
        console.log('QuoteData à sauvegarder:', quoteData);
        console.log('Options à sauvegarder:', {
          showLogo,
          showStructureLogo,
          showChargeMission,
          showStructureEmail,
          showStructurePhone,
          showStructureSiret,
          showMissionDate,
          showMissionValidity,
          showDocumentTitle
        });
        console.log('ID du brouillon en cours d\'édition:', editingDraftId);
      }
      
      // Préparer les données de quoteData avec les logos
      const quoteDataWithLogos = isDraft ? {
        ...quoteData,
        companyInfo: {
          ...quoteData.companyInfo,
          logo: quoteData.companyInfo.logo || (logoPreview ? logoPreview : structure?.logo || '')
        },
        clientInfo: {
          ...quoteData.clientInfo,
          logo: quoteData.clientInfo.logo || (logoPreview ? logoPreview : '')
        }
      } : null;

      // Préparer les données de structure avec le logo
      const structureDataWithLogo = isDraft && structure ? {
        ...structure,
        logo: structure.logo || logoPreview || ''
      } : null;

      // Préparer les données du document (filtrer les valeurs undefined)
      const documentData: any = {
        name: showDocumentTitle && documentTitle ? documentTitle : `Proposition commerciale ${mission?.numeroMission || 'mission'}`,
        type: type,
        url: '', // URL du fichier uploadé
        uploadedAt: new Date(),
        uploadedBy: currentUser?.displayName || currentUser?.uid || 'unknown',
        size: pdfBlob.size,
        isDraft: isDraft,
        numeroMission: mission?.numeroMission || null,
        structureId: structure?.id || null,
        companyId: mission?.companyId || null,
        companyName: mission?.company || null,
        // Sauvegarder toutes les données de la proposition pour permettre la reprise
        quoteData: quoteDataWithLogos,
        structureData: structureDataWithLogo,
        missionData: isDraft ? mission : null, // Données complètes de la mission
        options: isDraft ? {
          showLogo,
          showStructureLogo,
          showChargeMission,
          showStructureEmail,
          showStructurePhone,
          showStructureSiret,
          showMissionDate,
          showMissionValidity,
          showDocumentTitle
        } : null,
        documentTitle: isDraft ? documentTitle : null
      };

      // Ajouter etudeId et missionId seulement s'ils existent (pour éviter undefined)
      if (mission?.id) {
        documentData.etudeId = mission.id; // Pour la compatibilité avec EtudeDetails.tsx
        documentData.missionId = mission.id; // Garder pour la compatibilité
      }

      if (isDraft && editingDraftId) {
        // Mettre à jour le brouillon existant
        console.log('Mise à jour du brouillon existant avec ID:', editingDraftId);
        await updateDoc(doc(db, 'documents', editingDraftId), documentData);
        console.log('Brouillon mis à jour avec succès');
      } else {
        // Créer un nouveau document
        console.log('Création d\'un nouveau document');
        const docRef = await addDoc(collection(db, 'documents'), documentData);
        console.log('Document créé avec ID:', docRef.id);
        
        // Si ce n'est pas un brouillon, aussi sauvegarder dans generatedDocuments et uploader dans Storage
        console.log('🔍 Vérification des conditions pour l\'upload:', {
          isDraft,
          hasMissionId: !!mission?.id,
          missionId: mission?.id,
          hasStorage: !!storage,
          pdfBlobSize: pdfBlob?.size
        });
        
        if (!isDraft && mission?.id && storage) {
          try {
            console.log('📤 Upload du PDF vers Firebase Storage...');
            console.log('📋 Mission ID:', mission.id);
            console.log('📋 Mission Number:', mission.numeroMission);
            console.log('📋 PDF Blob size:', pdfBlob.size);
            
            // Créer le nom du fichier
            const fileName = `PC_${mission.numeroMission}_${Date.now()}.pdf`;
            const storagePath = `missions/${mission.id}/documents/${fileName}`;
            console.log('📁 Chemin Storage:', storagePath);
            const storageRef = ref(storage, storagePath);
            
            // Uploader le fichier
            console.log('⏳ Début de l\'upload...');
            await uploadBytes(storageRef, pdfBlob);
            console.log('✅ Fichier uploadé vers Storage');
            
            // Récupérer l'URL
            const fileUrl = await getDownloadURL(storageRef);
            console.log('✅ URL du document:', fileUrl);
            
            // Préparer les données pour generatedDocuments
            const generatedDocumentData = {
              missionId: mission.id,
              missionNumber: mission.numeroMission,
              missionTitle: mission.title || mission.description || `Mission ${mission.numeroMission}`,
              structureId: mission.structureId || structure?.id || '',
              documentType: 'proposition_commerciale' as const,
              fileName: fileName,
              fileUrl: fileUrl,
              fileSize: pdfBlob.size,
              version: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: currentUser?.uid || '',
              status: 'draft' as const,
              isValid: true,
              tags: ['proposition_commerciale', 'commercial'],
              notes: 'Proposition commerciale générée depuis l\'éditeur'
            };
            
            console.log('📊 Données du document à créer:', generatedDocumentData);
            
            // Créer le document dans generatedDocuments
            const generatedDocRef = await addDoc(collection(db, 'generatedDocuments'), generatedDocumentData);
            console.log('📊 Document créé dans generatedDocuments, ID:', generatedDocRef.id);
            console.log('📋 Document lié à la mission ID:', mission.id);
          } catch (error) {
            console.error('❌ Erreur lors de la sauvegarde dans generatedDocuments:', error);
            console.error('❌ Détails de l\'erreur:', error instanceof Error ? error.message : String(error));
            console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'Pas de stack trace');
            // Ne pas bloquer la sauvegarde principale si cette étape échoue
          }
        } else {
          console.log('⚠️ Conditions non remplies pour l\'upload:', {
            isDraft,
            hasMissionId: !!mission?.id,
            hasStorage: !!storage
          });
        }
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du document:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography>Chargement du devis...</Typography>
      </Box>
    );
  }

  console.log('QuoteBuilder - Rendu avec mission:', mission);

  // Optimiser les données calculées
  const structureData = getStructureData(structure, mission);
  const clientData = getClientData(quoteData);

  return (
    <Box sx={{ 
      width: '100%',
      bgcolor: '#fafafa',
      minHeight: '100vh',
      height: '100vh',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Box sx={{ 
        width: '100%',
        maxWidth: '1200px',
        mx: 'auto',
        p: 4,
        pt: 12,
        pb: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '100%',
        overflowY: 'auto',
        flex: 1
      }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 6,
        width: '100%',
        maxWidth: '1200px',
        position: 'relative',
        flexShrink: 0
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <IconButton
            onClick={() => navigate(-1)}
            sx={{
              color: tokens.colors.brandTeal,
              '&:hover': {
                backgroundColor: 'rgba(0, 122, 255, 0.08)',
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        
        <Typography 
          variant="h4" 
          component="h1" 
          sx={{ 
            fontWeight: '600', 
            color: tokens.colors.textPrimary,
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)'
          }}
        >
                          Nouvelle proposition commerciale
        </Typography>
        
        <Button
          variant="outlined"
          startIcon={<SettingsIcon />}
          onClick={() => setOptionsOpen(!optionsOpen)}
          sx={{
            borderColor: tokens.colors.brandTeal,
            color: tokens.colors.brandTeal,
            '&:hover': {
              borderColor: '#0056CC',
              backgroundColor: 'rgba(0, 122, 255, 0.04)',
            }
          }}
        >
          Options
        </Button>
      </Box>

      {/* Conteneur principal avec PDF et Options */}
      <Box 
        sx={{ 
          display: 'flex',
          gap: 3,
          justifyContent: 'center',
          alignItems: 'flex-start',
          flex: 1,
          width: '100%',
          overflowY: 'auto',
          minHeight: 0,
          '@media print': {
            display: 'none'
          }
        }}
      >
        {/* Conteneur gris qui s'adapte aux dimensions A4 */}
        <Box 
          sx={{ 
            width: '210mm',
            bgcolor: '#fafafa',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            flexShrink: 0,
            paddingTop: '20px',
            paddingBottom: '20px',
            minHeight: '297mm',
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto'
          }}
        >
        {/* Document A4 centré pour PDF */}
        <Box 
          sx={{ 
            width: '210mm',
            bgcolor: 'white',
            boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
            borderRadius: '4px',
            overflow: 'hidden',
            flexShrink: 0,
            position: 'relative',
            minHeight: '297mm',
            height: 'fit-content',
            '@media print': {
              width: '100%',
              height: 'auto',
              boxShadow: 'none',
              borderRadius: 0,
              margin: 0,
              padding: '15mm'
            },
            // Styles pour la génération PDF
            '&[data-pdf-generating="true"]': {
              '& .MuiIconButton-root': {
                display: 'none !important'
              },
              '& .MuiButton-root': {
                display: 'none !important'
              },
              '& .MuiTextField-root': {
                '& .MuiInputBase-input': {
                  border: 'none !important',
                  backgroundColor: 'transparent !important',
                  color: '#000 !important'
                }
              }
            }
          }}
          data-pdf-target="true"
        >
        {/* Contenu centré pour PDF */}
        <Box sx={{ 
          p: '15mm',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          minHeight: '297mm',
          '@media print': { p: '15mm' }
        }}>


          <Grid container spacing={3}>
            {/* Section gauche - Structure */}
            <Grid item xs={12} md={6}>
              <Box sx={{
                p: 3,
                bgcolor: 'white',
                borderRadius: 2,
                boxShadow: 1,
                height: 'fit-content',
                flexShrink: 0,
                '@media print': { 
                  border: '1px solid #000',
                  bgcolor: 'white'
                }
              }}>
                {/* Logo de la structure */}
                {showStructureLogo && (
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                    mb: 1,
                    '@media print': { display: 'none' }
                  }}>
                  {logoPreview ? (
                    <Box
                      component="img"
                      src={logoPreview}
                      alt="Logo"
                      sx={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        cursor: 'pointer',
                        border: '2px solid #e0e0e0',
                        '&:hover': {
                          border: `2px solid ${tokens.colors.brandTeal}`
                        }
                      }}
                      onClick={handleLogoClick}
                    />
                  ) : structure?.logo ? (
                    <Box
                      component="img"
                      src={structure.logo}
                      alt="Logo"
                      sx={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        cursor: 'pointer',
                        border: '2px solid #e0e0e0',
                        '&:hover': {
                          border: `2px solid ${tokens.colors.brandTeal}`
                        }
                      }}
                      onClick={handleLogoClick}
                    />
                  ) : (
                    <Box
                      onClick={handleLogoClick}
                      sx={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        backgroundColor: tokens.colors.brandTeal,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        border: '2px solid #e0e0e0',
                        '&:hover': {
                          border: `2px solid ${tokens.colors.brandTeal}`
                        }
                      }}
                    >
                      <Typography
                        variant="h5"
                        sx={{
                          color: '#FFFFFF',
                          fontWeight: 'bold',
                          fontSize: '1.5rem'
                        }}
                      >
                        JS
                      </Typography>
                    </Box>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    style={{ display: 'none' }}
                  />
                </Box>
                )}

                {/* Détails de la structure */}
                <Box>
                  {/* Version d'édition - visible à l'écran */}
                  <Box sx={{ '@media print': { display: 'none' }, pl: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: '600', mb: 1.5, fontSize: '1.125rem' }}>
                      Structure
                    </Typography>
                  </Box>
                  <TextField
                    fullWidth
                    label="Nom de la structure"
                    value={structure?.nom || mission?.company || ''}
                    onChange={(e) => setStructure(prev => ({ ...prev, nom: e.target.value }))}
                    variant="standard"
                    size="small"
                    sx={{ 
                      '& .MuiInput-underline:before': { borderBottomColor: '#e0e0e0' },
                      '& .MuiInputBase-input': { fontSize: '0.875rem', fontWeight: '600' },
                      mb: 1
                    }}
                  />
                  {(structure?.adresse || structure?.address || mission?.location) && (
                    <TextField
                      fullWidth
                      label="Adresse"
                      value={structure?.adresse || structure?.address || mission?.location || ''}
                      onChange={(e) => setStructure(prev => ({ ...prev, adresse: e.target.value }))}
                      variant="standard"
                      size="small"
                      sx={{ 
                        '& .MuiInput-underline:before': { borderBottomColor: '#e0e0e0' },
                        '& .MuiInputBase-input': { fontSize: '0.875rem' },
                        mb: 0.5
                      }}
                    />
                  )}
                  <Grid container spacing={1} sx={{ mb: 0.5 }}>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        label="Ville"
                        value={structure?.city || structure?.ville || ''}
                        onChange={(e) => setStructure(prev => ({ ...prev, city: e.target.value }))}
                        variant="standard"
                        size="small"
                        sx={{ 
                          '& .MuiInput-underline:before': { borderBottomColor: '#e0e0e0' },
                          '& .MuiInputBase-input': { fontSize: '0.875rem' }
                        }}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        label="Code postal"
                        value={structure?.postalCode || structure?.codePostal || ''}
                        onChange={(e) => setStructure(prev => ({ ...prev, postalCode: e.target.value }))}
                        variant="standard"
                        size="small"
                        sx={{ 
                          '& .MuiInput-underline:before': { borderBottomColor: '#e0e0e0' },
                          '& .MuiInputBase-input': { fontSize: '0.875rem' }
                        }}
                      />
                    </Grid>
                  </Grid>
                  {showStructureSiret && structure?.siret && (
                    <TextField
                      fullWidth
                      label="SIRET"
                      value={structure.siret}
                      onChange={(e) => setStructure(prev => ({ ...prev, siret: e.target.value }))}
                      variant="standard"
                      size="small"
                      sx={{ 
                        '& .MuiInput-underline:before': { borderBottomColor: '#e0e0e0' },
                        '& .MuiInputBase-input': { fontSize: '0.875rem' },
                        mb: 0.5
                      }}
                    />
                  )}
                  {showStructureEmail && structure?.email && structure.email !== 'Non renseigné' && (
                    <TextField
                      fullWidth
                      label="Email"
                      value={structure.email}
                      onChange={(e) => setStructure(prev => ({ ...prev, email: e.target.value }))}
                      variant="standard"
                      size="small"
                      sx={{ 
                        '& .MuiInput-underline:before': { borderBottomColor: '#e0e0e0' },
                        '& .MuiInputBase-input': { fontSize: '0.875rem' },
                        mb: 0.5
                      }}
                    />
                  )}
                  {showStructurePhone && ((structure?.telephone && structure.telephone !== 'Non renseigné') || (structure?.phone && structure.phone !== 'Non renseigné')) ? (
                    <TextField
                      fullWidth
                      label="Téléphone"
                      value={structure?.telephone || structure?.phone || ''}
                      onChange={(e) => setStructure(prev => ({ ...prev, telephone: e.target.value }))}
                      variant="standard"
                      size="small"
                      sx={{ 
                        '& .MuiInput-underline:before': { borderBottomColor: '#e0e0e0' },
                        '& .MuiInputBase-input': { fontSize: '0.875rem' },
                        mb: 0.5
                      }}
                    />
                  ) : null}
                  {showChargeMission && mission?.chargeName && (
                    <TextField
                      fullWidth
                      label="Chargé d'étude"
                      value={mission.chargeName}
                      onChange={(e) => {
                        // Mettre à jour le chargé d'étude dans la mission
                        if (mission) {
                          setMission(prev => prev ? { ...prev, chargeName: e.target.value } : null);
                        }
                      }}
                      variant="standard"
                      size="small"
                      sx={{ 
                        '& .MuiInput-underline:before': { borderBottomColor: '#e0e0e0' },
                        '& .MuiInputBase-input': { fontSize: '0.875rem' },
                        mb: 0
                      }}
                    />
                  )}
                </Box>
              </Box>
            </Grid>

          {/* Section droite - Client avec marge compensatoire */}
          <Grid item xs={12} md={6}>
            <Box sx={{
              p: 3,
              bgcolor: 'white',
              borderRadius: 2,
              boxShadow: 1,
              height: 'fit-content',
              flexShrink: 0,
              mt: showLogo ? 0 : 12, // Marge compensatoire conditionnelle : 0 si logo affiché, 12 sinon
              '@media print': { 
                border: '1px solid #000',
                bgcolor: 'white'
              }
            }}>
              {/* Logo du client */}
              {showLogo && (
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center',
                  alignItems: 'center',
                  width: '100%',
                  mb: 1,
                  '@media print': { display: 'none' }
                }}>
                  {quoteData.clientInfo.logo ? (
                    <Box
                      component="img"
                      src={quoteData.clientInfo.logo}
                      alt="Logo client"
                      sx={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        cursor: 'pointer',
                        border: '2px solid #e0e0e0',
                        '&:hover': {
                          border: `2px solid ${tokens.colors.brandTeal}`
                        }
                      }}
                      onClick={() => {
                        // Ouvrir le logo dans un nouvel onglet ou afficher une modal
                        window.open(quoteData.clientInfo.logo, '_blank');
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        backgroundColor: tokens.colors.bgSubtle,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid #e0e0e0'
                      }}
                    >
                      <Typography
                        variant="h5"
                        sx={{
                          color: '#999',
                          fontSize: '1.5rem'
                        }}
                      >
                        🏢
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
              
              <Typography variant="h6" sx={{ fontWeight: '600', mb: 1.5, fontSize: '1.125rem' }}>
                Client
              </Typography>
              <Box>
                  <TextField
                    fullWidth
                    label="Nom du client"
                    value={quoteData.clientInfo.name}
                    onChange={(e) => setQuoteData(prev => ({
                      ...prev,
                      clientInfo: { ...prev.clientInfo, name: e.target.value }
                    }))}
                    variant="standard"
                    size="small"
                    sx={{ 
                      '& .MuiInput-underline:before': { borderBottomColor: '#e0e0e0' },
                    '& .MuiInputBase-input': { fontSize: '0.875rem', fontWeight: '600' },
                    mb: 1
                    }}
                  />
                {quoteData.clientInfo.address && (
                  <TextField
                    fullWidth
                    label="Adresse"
                    value={quoteData.clientInfo.address}
                    onChange={(e) => setQuoteData(prev => ({
                      ...prev,
                      clientInfo: { ...prev.clientInfo, address: e.target.value }
                    }))}
                    variant="standard"
                    size="small"
                    sx={{ 
                      '& .MuiInput-underline:before': { borderBottomColor: '#e0e0e0' },
                      '& .MuiInputBase-input': { fontSize: '0.875rem' },
                      mb: 0.5
                    }}
                  />
                )}
                <Grid container spacing={1} sx={{ mb: 0.5 }}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                      label="Ville"
                      value={quoteData.clientInfo.city}
                    onChange={(e) => setQuoteData(prev => ({
                      ...prev,
                        clientInfo: { ...prev.clientInfo, city: e.target.value }
                    }))}
                    variant="standard"
                    size="small"
                    sx={{ 
                      '& .MuiInput-underline:before': { borderBottomColor: '#e0e0e0' },
                      '& .MuiInputBase-input': { fontSize: '0.875rem' }
                    }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                      label="Code postal"
                      value={quoteData.clientInfo.postalCode}
                    onChange={(e) => setQuoteData(prev => ({
                      ...prev,
                        clientInfo: { ...prev.clientInfo, postalCode: e.target.value }
                    }))}
                    variant="standard"
                    size="small"
                    sx={{ 
                      '& .MuiInput-underline:before': { borderBottomColor: '#e0e0e0' },
                      '& .MuiInputBase-input': { fontSize: '0.875rem' }
                    }}
                  />
                </Grid>
                </Grid>
                {quoteData.clientInfo.country && (
                  <TextField
                    fullWidth
                    label="Pays"
                    value={quoteData.clientInfo.country}
                    onChange={(e) => setQuoteData(prev => ({
                      ...prev,
                      clientInfo: { ...prev.clientInfo, country: e.target.value }
                    }))}
                    variant="standard"
                    size="small"
                    sx={{ 
                      '& .MuiInput-underline:before': { borderBottomColor: '#e0e0e0' },
                      '& .MuiInputBase-input': { fontSize: '0.875rem' },
                      mb: 0.5
                    }}
                  />
                )}
                
                {/* Champs conditionnels pour le client */}
                {showSiret && (
                  <TextField
                    fullWidth
                    label="SIRET"
                    value={quoteData.clientInfo.siret || ''}
                    onChange={(e) => setQuoteData(prev => ({
                      ...prev,
                      clientInfo: { ...prev.clientInfo, siret: e.target.value }
                    }))}
                    variant="standard"
                    size="small"
                    sx={{ 
                      '& .MuiInput-underline:before': { borderBottomColor: '#e0e0e0' },
                      '& .MuiInputBase-input': { fontSize: '0.875rem' },
                      mb: 0.5
                    }}
                  />
                )}
                
                {showVatNumber && (
                  <TextField
                    fullWidth
                    label="N° de TVA intracommunautaire"
                    value={quoteData.clientInfo.vatNumber || ''}
                    onChange={(e) => setQuoteData(prev => ({
                      ...prev,
                      clientInfo: { ...prev.clientInfo, vatNumber: e.target.value }
                    }))}
                    variant="standard"
                    size="small"
                    sx={{ 
                      '& .MuiInput-underline:before': { borderBottomColor: '#e0e0e0' },
                      '& .MuiInputBase-input': { fontSize: '0.875rem' },
                      mb: 0.5
                    }}
                  />
                )}
                
                {showEmail && (
                  <TextField
                    fullWidth
                    label="Email"
                    value={quoteData.clientInfo.email || ''}
                    onChange={(e) => setQuoteData(prev => ({
                      ...prev,
                      clientInfo: { ...prev.clientInfo, email: e.target.value }
                    }))}
                    variant="standard"
                    size="small"
                    sx={{ 
                      '& .MuiInput-underline:before': { borderBottomColor: '#e0e0e0' },
                      '& .MuiInputBase-input': { fontSize: '0.875rem' },
                      mb: 0.5
                    }}
                  />
                )}
                
                {showPhone && (
                  <TextField
                    fullWidth
                    label="Téléphone"
                    value={quoteData.clientInfo.phone || ''}
                    onChange={(e) => setQuoteData(prev => ({
                      ...prev,
                      clientInfo: { ...prev.clientInfo, phone: e.target.value }
                    }))}
                    variant="standard"
                    size="small"
                    sx={{ 
                      '& .MuiInput-underline:before': { borderBottomColor: '#e0e0e0' },
                      '& .MuiInputBase-input': { fontSize: '0.875rem' },
                      mb: 0.5
                    }}
                  />
                )}
              </Box>
            </Box>
          </Grid>

          {/* Caractéristiques de la prestation */}
          {showServiceCharacteristics && mission && (
            <Grid item xs={12}>
              <Box sx={{ 
                bgcolor: 'white',
                p: 2, 
                borderRadius: 1,
                border: '1px solid #e0e0e0',
                height: 'fit-content',
                flexShrink: 0,
                '@media print': { 
                  border: '1px solid #000',
                  bgcolor: 'white'
                }
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h5" sx={{ fontWeight: '600', color: tokens.colors.textPrimary, fontSize: '1.25rem' }}>
                    Caractéristiques de la prestation
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {showStudentCount && (
                    <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#333', minWidth: '300px' }}>
                        Nombre d'étudiants à recruter, former, suivre :
                      </Typography>
                      <TextField
                        size="small"
                        value={mission.studentCount || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          if (mission) {
                            setMission(prev => prev ? { ...prev, studentCount: val } : null);
                          }
                        }}
                        type="number"
                        sx={{ 
                          width: '150px',
                          '& .MuiInputBase-input': { fontSize: '0.875rem' }
                        }}
                      />
                    </Box>
                  )}
                  {showHours && (
                    <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#333', minWidth: '300px' }}>
                        Nombre d'heures :
                      </Typography>
                      <TextField
                        size="small"
                        value={mission.hours || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          if (mission) {
                            setMission(prev => prev ? { ...prev, hours: val } : null);
                          }
                        }}
                        type="number"
                        sx={{ 
                          width: '150px',
                          '& .MuiInputBase-input': { fontSize: '0.875rem' }
                        }}
                      />
                    </Box>
                  )}
                  {showLocation && (
                    <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#333', minWidth: '300px' }}>
                        Lieu(x) de la mission :
                      </Typography>
                      <TextField
                        size="small"
                        fullWidth
                        value={mission.location || ''}
                        onChange={(e) => {
                          if (mission) {
                            setMission(prev => prev ? { ...prev, location: e.target.value } : null);
                          }
                        }}
                        sx={{ 
                          flex: 1,
                          '& .MuiInputBase-input': { fontSize: '0.875rem' }
                        }}
                      />
                    </Box>
                  )}
                  {showMissionDescription && (
                    <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'flex-start' }}>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#333', minWidth: '300px', pt: 1 }}>
                        Description de la mission à effectuer par les étudiants :
                      </Typography>
                      <TextField
                        size="small"
                        fullWidth
                        multiline
                        rows={3}
                        value={mission.description || ''}
                        onChange={(e) => {
                          if (mission) {
                            setMission(prev => prev ? { ...prev, description: e.target.value } : null);
                          }
                        }}
                        sx={{ 
                          flex: 1,
                          '& .MuiInputBase-input': { fontSize: '0.875rem' }
                        }}
                      />
                    </Box>
                  )}
                  {showDatesAndSchedule && mission.startDate && mission.endDate && (
                    <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'flex-start' }}>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#333', minWidth: '300px', pt: 1 }}>
                        Date(s) et horaires :
                      </Typography>
                      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Typography sx={{ fontSize: '0.875rem', color: '#666' }}>Du</Typography>
                          <TextField
                            size="small"
                            type="date"
                            value={mission.startDate ? (mission.startDate.includes('T') ? mission.startDate.split('T')[0] : mission.startDate) : ''}
                            onChange={(e) => {
                              if (mission) {
                                setMission(prev => prev ? { ...prev, startDate: e.target.value } : null);
                              }
                            }}
                            InputLabelProps={{ shrink: true }}
                            sx={{ 
                              width: '150px',
                              '& .MuiInputBase-input': { fontSize: '0.875rem' }
                            }}
                          />
                          <Typography sx={{ fontSize: '0.875rem', color: '#666' }}>au</Typography>
                          <TextField
                            size="small"
                            type="date"
                            value={mission.endDate ? (mission.endDate.includes('T') ? mission.endDate.split('T')[0] : mission.endDate) : ''}
                            onChange={(e) => {
                              if (mission) {
                                setMission(prev => prev ? { ...prev, endDate: e.target.value } : null);
                              }
                            }}
                            InputLabelProps={{ shrink: true }}
                            sx={{ 
                              width: '150px',
                              '& .MuiInputBase-input': { fontSize: '0.875rem' }
                            }}
                          />
                          <Typography sx={{ fontSize: '0.875rem', color: '#666' }}>compris.</Typography>
                        </Box>
                        {mission.hours && mission.studentCount && (
                          <Typography sx={{ fontSize: '0.875rem', color: '#666' }}>
                            Pour un volume d'heures total de {mission.hours} heures qui est réparti équitablement entre les étudiants recrutés.
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            </Grid>
          )}

          {/* Détails du devis */}
          <Grid item xs={12}>
            <Box sx={{ 
              bgcolor: 'white',
              p: 2, 
              borderRadius: 1,
              border: '1px solid #e0e0e0',
              height: 'fit-content',
              minHeight: '80mm',
              flexShrink: 0,
              '@media print': { 
                border: '1px solid #000',
                bgcolor: 'white'
              }
            }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: '600', color: tokens.colors.textPrimary, fontSize: '1.25rem' }}>Proposition commerciale</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {showMissionDate && (
                    <TextField
                      label="Date de la mission"
                      value={dateInputValue}
                      onChange={(e) => {
                        let frenchDate = e.target.value;
                        
                        // Nettoyer l'input (garder seulement les chiffres et les /)
                        frenchDate = frenchDate.replace(/[^0-9/]/g, '');
                        
                        // Ajouter automatiquement les / après 2 et 5 caractères
                        if (frenchDate.length === 2 && !frenchDate.includes('/')) {
                          frenchDate += '/';
                        } else if (frenchDate.length === 5 && frenchDate.split('/').length === 2) {
                          frenchDate += '/';
                        }
                        
                        // Limiter à 10 caractères (DD/MM/YYYY)
                        if (frenchDate.length <= 10) {
                          setDateInputValue(frenchDate);
                          
                          // Convertir le format français DD/MM/YYYY vers YYYY-MM-DD
                          if (frenchDate.length === 10 && frenchDate.includes('/')) {
                            const [day, month, year] = frenchDate.split('/');
                            if (day && month && year && day.length === 2 && month.length === 2 && year.length === 4) {
                              const isoDate = `${year}-${month}-${day}`;
                              setQuoteData(prev => ({
                                ...prev,
                                quoteInfo: { ...prev.quoteInfo, issueDate: isoDate }
                              }));
                            }
                          }
                        }
                      }}
                      placeholder="JJ/MM/AAAA"
                      size="small"
                      sx={{ 
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 1,
                          '& fieldset': { borderColor: '#e0e0e0' }
                        },
                        '& .MuiInputBase-input': { fontSize: '0.875rem' }
                      }}
                    />
                  )}
                  {showMissionValidity && (
                    <TextField
                      label="Période de validité (jours)"
                      type="number"
                      value={quoteData.quoteInfo.validityPeriod}
                      onChange={(e) => setQuoteData(prev => ({
                        ...prev,
                        quoteInfo: { ...prev.quoteInfo, validityPeriod: parseInt(e.target.value) || 0 }
                      }))}
                      size="small"
                      sx={{ 
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 1,
                          '& fieldset': { borderColor: '#e0e0e0' }
                        },
                        '& .MuiInputBase-input': { fontSize: '0.875rem' }
                      }}
                    />
                  )}
                </Box>
              </Box>

              {/* Lignes du devis */}
              <Box sx={{ mb: 2 }}>
                {/* Header des colonnes */}
                <Box sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: billingType === 'rapide' ? '2fr 1fr 1fr 50px' : '2fr 1fr 1fr 1fr 1fr 50px',
                  gap: 1,
                  p: 1,
                  bgcolor: templateColor,
                  color: 'white',
                  borderRadius: 1,
                  mb: 1,
                  '@media print': { bgcolor: '#000', color: 'white' }
                }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: '600', fontSize: '0.75rem' }}>Désignation</Typography>
                  {billingType === 'complet' && (
                  <Typography variant="subtitle2" sx={{ fontWeight: '600', fontSize: '0.75rem' }}>Quantité</Typography>
                  )}
                  {billingType === 'complet' && (
                  <Typography variant="subtitle2" sx={{ fontWeight: '600', fontSize: '0.75rem' }}>Prix unitaire</Typography>
                  )}
                  <Typography variant="subtitle2" sx={{ fontWeight: '600', fontSize: '0.75rem' }}>TVA</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: '600', fontSize: '0.75rem' }}>Total</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: '600', fontSize: '0.75rem' }}></Typography>
                </Box>

                {/* Lignes */}
                {quoteData.lines.map((line, index) => (
                  <Box key={line.id} sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: billingType === 'rapide' ? '2fr 1fr 1fr 50px' : '2fr 1fr 1fr 1fr 1fr 50px',
                    gap: 1,
                    p: 1,
                    borderBottom: `1px solid ${tokens.colors.borderLight}`,
                    '&:hover': { bgcolor: '#fafafa' },
                    '@media print': { 
                      borderBottom: '1px solid #000',
                      '&:hover': { bgcolor: 'white' }
                    }
                  }}>
                    <TextField
                      value={line.designation}
                      onChange={(e) => updateLine(line.id, 'designation', e.target.value)}
                      placeholder="Description du produit/service"
                      variant="standard"
                      size="small"
                      sx={{ 
                        '& .MuiInput-underline:before': { borderBottomColor: '#e0e0e0' },
                        '& .MuiInputBase-input': { fontSize: '0.75rem' }
                      }}
                    />
                    {billingType === 'complet' && (
                    <TextField
                      type="number"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                      variant="standard"
                      size="small"
                      sx={{ 
                        '& .MuiInput-underline:before': { borderBottomColor: '#e0e0e0' },
                        '& .MuiInputBase-input': { fontSize: '0.75rem' }
                      }}
                    />
                    )}
                    {billingType === 'complet' && (
                    <TextField
                      type="number"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                      variant="standard"
                      size="small"
                      InputProps={{
                        endAdornment: <Typography variant="caption" sx={{ color: '#666', fontSize: '0.75rem' }}>€</Typography>
                      }}
                      sx={{ 
                        '& .MuiInput-underline:before': { borderBottomColor: '#e0e0e0' },
                        '& .MuiInputBase-input': { fontSize: '0.75rem' }
                      }}
                    />
                    )}
                    <FormControl size="small" variant="standard" sx={{ mt: -0.5 }}>
                      <Select
                        value={line.tva}
                        onChange={(e) => updateLine(line.id, 'tva', e.target.value)}
                        sx={{ 
                          '& .MuiSelect-select': { color: '#666', fontSize: '0.75rem' }
                        }}
                      >
                        <MenuItem value={0}>0%</MenuItem>
                        <MenuItem value={5.5}>5.5%</MenuItem>
                        <MenuItem value={10}>10%</MenuItem>
                        <MenuItem value={20}>20%</MenuItem>
                      </Select>
                    </FormControl>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', color: '#666', fontSize: '0.75rem' }}>
                      {billingType === 'rapide' ? line.totalTTC.toFixed(2) : line.totalHT.toFixed(2)} €
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => removeLine(line.id)}
                      disabled={quoteData.lines.length === 1}
                      sx={{ 
                        color: '#ff6b6b',
                        '@media print': { display: 'none' }
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}

                {/* Bouton ajouter ligne */}
                <Box sx={{ mt: 1, '@media print': { display: 'none' } }}>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={addLine}
                    size="small"
                    sx={{ 
                      color: '#10b981', 
                      borderColor: '#10b981',
                      '&:hover': {
                        borderColor: '#059669',
                        backgroundColor: 'rgba(16, 185, 129, 0.04)',
                      }
                    }}
                  >
                    + Ligne simple
                  </Button>
                </Box>
              </Box>

              {/* Totaux */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Box sx={{ minWidth: 150 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ color: '#666', fontSize: '0.875rem' }}>Total HT</Typography>
                    <Typography sx={{ color: '#666', fontSize: '0.875rem' }}>{quoteData.totals.totalHT.toFixed(2)} €</Typography>
                  </Box>
                  
                  {/* Remise globale */}
                  {showGlobalDiscount && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ color: '#666', fontSize: '0.875rem' }}>Remise</Typography>
                        <TextField
                          type="number"
                          size="small"
                          value={globalDiscountPercent}
                          onChange={(e) => handleGlobalDiscountPercentChange(parseFloat(e.target.value) || 0)}
                          sx={{ 
                            width: 60,
                            '& .MuiInputBase-input': { fontSize: '0.75rem', padding: '2px 4px' },
                            '& .MuiOutlinedInput-root': { height: 24 }
                          }}
                          InputProps={{
                            endAdornment: <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>%</Typography>
                          }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TextField
                          type="number"
                          size="small"
                          value={globalDiscountAmount.toFixed(2)}
                          onChange={(e) => handleGlobalDiscountAmountChange(parseFloat(e.target.value) || 0)}
                          sx={{ 
                            width: 80,
                            '& .MuiInputBase-input': { fontSize: '0.75rem', padding: '2px 4px' },
                            '& .MuiOutlinedInput-root': { height: 24 }
                          }}
                          InputProps={{
                            endAdornment: <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>€</Typography>
                          }}
                        />
                      </Box>
                    </Box>
                  )}
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ color: '#666', fontSize: '0.875rem' }}>TVA 20%</Typography>
                    <Typography sx={{ color: '#666', fontSize: '0.875rem' }}>
                      {showGlobalDiscount ? getTotalWithDiscount().totalTVA.toFixed(2) : quoteData.totals.totalTVA.toFixed(2)} €
                    </Typography>
                  </Box>
                  <Divider sx={{ my: 0.5 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: templateColor, fontSize: '1rem' }}>
                      Total TTC
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: templateColor, fontSize: '1rem' }}>
                      {showGlobalDiscount ? getTotalWithDiscount().totalTTC.toFixed(2) : quoteData.totals.totalTTC.toFixed(2)} €
                    </Typography>
                  </Box>
                  

                </Box>
              </Box>
            </Box>
          </Grid>
          
          {/* Champ libre - pleine largeur */}
          {showFreeField && (
            <Grid item xs={12}>
              <Box sx={{ mt: 0.25, mb: 0 }}>
                {/* Barre d'outils pour le champ libre */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1, 
                  mb: 1,
                  p: 1,
                  bgcolor: tokens.colors.bgSubtle,
                  borderRadius: '8px 8px 0 0',
                  border: '1px solid #e0e0e0',
                  borderBottom: 'none'
                }}>
                  {/* Contrôle de taille de police */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TextDecreaseIcon sx={{ fontSize: 18, color: '#8E8E93', cursor: 'pointer' }} 
                      onClick={() => {
                        const newSize = Math.max(4, freeFieldFontSize - 1);
                        setFreeFieldFontSize(newSize);
                        applyFontSizeToSelection(newSize);
                      }} />
                    <TextField
                      type="number"
                      value={freeFieldFontSize}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val >= 4 && val <= 72) {
                          setFreeFieldFontSize(val);
                          // Ne pas appliquer automatiquement lors de la saisie manuelle
                        }
                      }}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (val >= 4 && val <= 72) {
                          setFreeFieldFontSize(val);
                          applyFontSizeToSelection(val);
                        } else if (val < 4) {
                          setFreeFieldFontSize(4);
                          applyFontSizeToSelection(4);
                        } else if (val > 72) {
                          setFreeFieldFontSize(72);
                          applyFontSizeToSelection(72);
                        }
                      }}
                      size="small"
                      sx={{
                        width: '60px',
                        '& .MuiOutlinedInput-root': {
                          height: '32px',
                          '& input': {
                            textAlign: 'center',
                            padding: '4px 8px',
                            fontSize: '0.875rem'
                          }
                        }
                      }}
                    />
                    <TextIncreaseIcon sx={{ fontSize: 18, color: '#8E8E93', cursor: 'pointer' }} 
                      onClick={() => {
                        const newSize = Math.min(24, freeFieldFontSize + 1);
                        setFreeFieldFontSize(newSize);
                        applyFontSizeToSelection(newSize);
                      }} />
                    <Typography variant="caption" sx={{ ml: 0.5, color: '#8E8E93', fontSize: '0.75rem' }}>
                      px
                    </Typography>
                  </Box>
                  
                  <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                  
                  {/* Contrôles de formatage (gras, italique) */}
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={applyBoldToSelection}
                      sx={{
                        bgcolor: 'transparent',
                        color: '#8E8E93',
                        '&:hover': {
                          bgcolor: '#E5E5EA'
                        }
                      }}
                      title="Gras (Ctrl+B)"
                    >
                      <FormatBoldIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={applyItalicToSelection}
                      sx={{
                        bgcolor: 'transparent',
                        color: '#8E8E93',
                        '&:hover': {
                          bgcolor: '#E5E5EA'
                        }
                      }}
                      title="Italique (Ctrl+I)"
                    >
                      <FormatItalicIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  
                  <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                  
                  {/* Contrôles d'alignement */}
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        applyTextAlignToSelection('left');
                      }}
                      sx={{
                        bgcolor: freeFieldTextAlign === 'left' ? tokens.colors.brandTeal : 'transparent',
                        color: freeFieldTextAlign === 'left' ? 'white' : '#8E8E93',
                        '&:hover': {
                          bgcolor: freeFieldTextAlign === 'left' ? '#0056CC' : '#E5E5EA'
                        }
                      }}
                    >
                      <FormatAlignLeftIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        applyTextAlignToSelection('center');
                      }}
                      sx={{
                        bgcolor: freeFieldTextAlign === 'center' ? tokens.colors.brandTeal : 'transparent',
                        color: freeFieldTextAlign === 'center' ? 'white' : '#8E8E93',
                        '&:hover': {
                          bgcolor: freeFieldTextAlign === 'center' ? '#0056CC' : '#E5E5EA'
                        }
                      }}
                    >
                      <FormatAlignCenterIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        applyTextAlignToSelection('right');
                      }}
                      sx={{
                        bgcolor: freeFieldTextAlign === 'right' ? tokens.colors.brandTeal : 'transparent',
                        color: freeFieldTextAlign === 'right' ? 'white' : '#8E8E93',
                        '&:hover': {
                          bgcolor: freeFieldTextAlign === 'right' ? '#0056CC' : '#E5E5EA'
                        }
                      }}
                    >
                      <FormatAlignRightIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        applyTextAlignToSelection('justify');
                      }}
                      sx={{
                        bgcolor: freeFieldTextAlign === 'justify' ? tokens.colors.brandTeal : 'transparent',
                        color: freeFieldTextAlign === 'justify' ? 'white' : '#8E8E93',
                        '&:hover': {
                          bgcolor: freeFieldTextAlign === 'justify' ? '#0056CC' : '#E5E5EA'
                        }
                      }}
                    >
                      <FormatAlignJustifyIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
                
                {/* Zone de texte avec contentEditable */}
                <Box
                  ref={freeFieldEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => {
                    const html = e.currentTarget.innerHTML;
                    setFreeFieldHtml(html);
                    // Extraire le texte brut pour la sauvegarde
                    const text = e.currentTarget.innerText || e.currentTarget.textContent || '';
                    setFreeFieldText(text);
                  }}
                  onBlur={() => {
                    cleanupEmptySpans();
                    updateFreeFieldContent();
                  }}
                  onKeyDown={(e) => {
                    // Si l'utilisateur tape et qu'il y a un span avec zero-width space au curseur, 
                    // remplacer le zero-width space par le caractère tapé
                    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { // Caractère imprimable
                      const selection = window.getSelection();
                      if (selection && selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        if (range.isCollapsed) {
                          const container = range.startContainer;
                          if (container.nodeType === Node.TEXT_NODE) {
                            const parent = container.parentNode;
                            if (parent && parent.nodeName === 'SPAN') {
                              const span = parent as HTMLElement;
                              // Si le span ne contient que le zero-width space, le remplacer par le caractère
                              if (span.innerHTML === '&#8203;' || span.innerHTML === '\u200B' || span.textContent === '\u200B') {
                                e.preventDefault();
                                span.innerHTML = '';
                                span.textContent = e.key;
                                // Placer le curseur après le caractère
                                const newRange = document.createRange();
                                newRange.setStart(span.firstChild || span, 1);
                                newRange.collapse(true);
                                selection.removeAllRanges();
                                selection.addRange(newRange);
                                updateFreeFieldContent();
                              }
                            } else if (container.nodeType === Node.ELEMENT_NODE && (container as HTMLElement).nodeName === 'SPAN') {
                              const span = container as HTMLElement;
                              if (span.innerHTML === '&#8203;' || span.innerHTML === '\u200B' || span.textContent === '\u200B') {
                                e.preventDefault();
                                span.innerHTML = '';
                                span.textContent = e.key;
                                const newRange = document.createRange();
                                newRange.setStart(span.firstChild || span, 1);
                                newRange.collapse(true);
                                selection.removeAllRanges();
                                selection.addRange(newRange);
                                updateFreeFieldContent();
                              }
                            }
                          }
                        }
                      }
                    }
                  }}
                  sx={{
                    minHeight: '200px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    border: '1px solid #e0e0e0',
                    borderRadius: '0 0 8px 8px',
                    padding: '12px',
                    fontSize: `${freeFieldFontSize}px`,
                    lineHeight: 1.5,
                    textAlign: freeFieldTextAlign,
                    fontFamily: 'inherit',
                    outline: 'none',
                    '&:hover': {
                      border: '1px solid #999'
                    },
                    '&:focus': {
                      border: '1px solid #007AFF'
                    },
                    '&:empty:before': {
                      content: '"Saisissez votre texte libre ici..."',
                      color: '#999',
                      fontSize: `${freeFieldFontSize}px`
                    }
                  }}
                />
              </Box>
            </Grid>
          )}
        </Grid>
        
        {/* Footer pour la version d'édition */}
        <Box sx={{ 
          position: 'absolute',
          bottom: 20,
          left: 0,
          right: 0,
          pt: 1, 
          borderTop: '1px solid #e0e0e0',
          textAlign: 'center',
          opacity: 0.7,
          zIndex: 10,
          backgroundColor: 'white',
          '@media print': { display: 'none' }
        }}>
          <Box sx={{ mb: 0.5, display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              label="SIRET"
              value={footerSiret}
              onChange={(e) => setFooterSiret(e.target.value)}
              sx={{ 
                width: 150,
                mr: 0.5,
                '& .MuiInputBase-input': { fontSize: '0.75rem', padding: '4px 0' },
                '& .MuiInputLabel-root': { fontSize: '0.75rem' }
              }}
              variant="standard"
            />
            <Typography variant="body2" sx={{ color: '#666', fontSize: '0.75rem', mx: 0.5 }}>
              —
            </Typography>
            <TextField
              size="small"
              label="N° TVA"
              value={footerTva}
              onChange={(e) => setFooterTva(e.target.value)}
              sx={{ 
                width: 150,
                mr: 0.5,
                '& .MuiInputBase-input': { fontSize: '0.75rem', padding: '4px 0' },
                '& .MuiInputLabel-root': { fontSize: '0.75rem' }
              }}
              variant="standard"
            />
            <Typography variant="body2" sx={{ color: '#666', fontSize: '0.75rem', mx: 0.5 }}>
              —
            </Typography>
            <TextField
              size="small"
              label="Code APE"
              value={footerApe}
              onChange={(e) => setFooterApe(e.target.value)}
              sx={{ 
                width: 100,
                '& .MuiInputBase-input': { fontSize: '0.75rem', padding: '4px 0' },
                '& .MuiInputLabel-root': { fontSize: '0.75rem' }
              }}
              variant="standard"
            />
          </Box>
          <Typography variant="body2" sx={{ 
            color: '#666', 
            fontSize: '0.75rem'
          }}>
            Page 1 / 1
          </Typography>
        </Box>
        </Box>
        </Box>
      </Box>

      {/* Box d'options */}
      {optionsOpen && (
        <Box 
          sx={{ 
            width: '300px',
            height: '340mm',
            bgcolor: '#fafafa',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            flexShrink: 0,
            paddingTop: '20px',
            paddingBottom: '20px'
          }}
        >
          {/* Document A4 centré pour Options */}
          <Box 
            sx={{ 
              width: '280px',
              height: '297mm',
              bgcolor: 'white',
              boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
              borderRadius: '4px',
              overflow: 'hidden',
              flexShrink: 0,
              position: 'relative'
            }}
          >
            {/* Contenu centré pour Options */}
            <Box sx={{ 
              p: '15mm',
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* En-tête du panneau */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 3,
                  pb: 2,
                  borderBottom: '1px solid #e0e0e0'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SettingsIcon sx={{ color: templateColor, fontSize: 20 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
                    Options
                  </Typography>
                </Box>
                <IconButton
                  onClick={() => setOptionsOpen(false)}
                  size="small"
                  sx={{ color: '#666' }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>

              {/* Contenu du panneau */}
              <Box sx={{ flex: 1, overflowY: 'auto' }}>
                {/* Type de facturation */}
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <ReceiptIcon sx={{ color: templateColor, fontSize: 20 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
                      Type de facturation
                    </Typography>
                  </Box>
                  <FormControl component="fieldset" size="small">
                    <RadioGroup value={billingType} onChange={(e) => setBillingType(e.target.value)}>
                      <FormControlLabel 
                        value="rapide" 
                        control={<Radio size="small" />} 
                        label="Rapide" 
                      />
                      <FormControlLabel 
                        value="complet" 
                        control={<Radio size="small" />} 
                        label="Complet" 
                      />
                    </RadioGroup>
                  </FormControl>
                </Box>

                {/* Client */}
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <PersonIcon sx={{ color: templateColor, fontSize: 20 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
                      Client
                    </Typography>
                  </Box>
                  <FormControl component="fieldset" size="small">
                    <FormGroup>
                      <FormControlLabel 
                        control={<Checkbox size="small" checked={showSiret} onChange={(e) => setShowSiret(e.target.checked)} />} 
                        label="SIREN ou SIRET" 
                      />
                      <FormControlLabel 
                        control={<Checkbox size="small" checked={showVatNumber} onChange={(e) => setShowVatNumber(e.target.checked)} />} 
                        label="N° de TVA intracommunautaire" 
                      />
                      <FormControlLabel 
                        control={<Checkbox size="small" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} />} 
                        label="Logo" 
                      />
                      <FormControlLabel 
                        control={<Checkbox size="small" checked={showEmail} onChange={(e) => setShowEmail(e.target.checked)} />} 
                        label="Email" 
                      />
                      <FormControlLabel 
                        control={<Checkbox size="small" checked={showPhone} onChange={(e) => setShowPhone(e.target.checked)} />} 
                        label="Téléphone" 
                      />
                    </FormGroup>
                  </FormControl>
                </Box>

                {/* Structure */}
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <BusinessIcon sx={{ color: templateColor, fontSize: 20 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
                      Structure
                    </Typography>
                  </Box>
                  <FormControl component="fieldset" size="small">
                    <FormGroup>
                      <FormControlLabel 
                        control={<Checkbox size="small" checked={showStructureLogo} onChange={(e) => setShowStructureLogo(e.target.checked)} />} 
                        label="Logo" 
                      />
                      <FormControlLabel 
                        control={<Checkbox size="small" checked={showChargeMission} onChange={(e) => setShowChargeMission(e.target.checked)} />} 
                        label="Chargé de mission" 
                      />
                      <FormControlLabel 
                        control={<Checkbox size="small" checked={showStructureEmail} onChange={(e) => setShowStructureEmail(e.target.checked)} />} 
                        label="Email" 
                      />
                      <FormControlLabel 
                        control={<Checkbox size="small" checked={showStructurePhone} onChange={(e) => setShowStructurePhone(e.target.checked)} />} 
                        label="Téléphone" 
                      />
                      <FormControlLabel 
                        control={<Checkbox size="small" checked={showStructureSiret} onChange={(e) => setShowStructureSiret(e.target.checked)} />} 
                        label="SIRET" 
                      />
                    </FormGroup>
                  </FormControl>
                </Box>

                {/* Mission */}
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <AssignmentIcon sx={{ color: templateColor, fontSize: 20 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
                      Mission
                    </Typography>
                  </Box>
                  <FormControl component="fieldset" size="small">
                    <FormGroup>
                      <FormControlLabel 
                        control={<Checkbox size="small" checked={showMissionDate} onChange={(e) => setShowMissionDate(e.target.checked)} />} 
                        label="Date de la mission" 
                      />
                      <FormControlLabel 
                        control={<Checkbox size="small" checked={showMissionValidity} onChange={(e) => setShowMissionValidity(e.target.checked)} />} 
                        label="Période de validité" 
                      />
                    </FormGroup>
                  </FormControl>
                </Box>

                {/* Info complémentaires */}
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <MenuIcon sx={{ color: templateColor, fontSize: 20 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
                      Info complémentaires
                    </Typography>
                  </Box>
                  <FormControl component="fieldset" size="small">
                    <FormGroup>

                      <FormControlLabel 
                        control={<Checkbox size="small" checked={showPaymentTerms} onChange={(e) => setShowPaymentTerms(e.target.checked)} />} 
                        label="Conditions de paiement" 
                      />
                      <FormControlLabel 
                        control={<Checkbox size="small" checked={showDocumentTitle} onChange={(e) => setShowDocumentTitle(e.target.checked)} />} 
                        label="Intitulé du document" 
                      />
                      {showDocumentTitle && (
                        <TextField
                          fullWidth
                          size="small"
                          value={documentTitle}
                          onChange={(e) => setDocumentTitle(e.target.value)}
                          placeholder="Ex: PC-230101, Proposition Apple..."
                          sx={{ 
                            mt: 1,
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 1,
                              '& fieldset': { borderColor: '#e0e0e0' }
                            },
                            '& .MuiInputBase-input': { fontSize: '0.875rem' }
                          }}
                        />
                      )}
                      <FormControlLabel 
                        control={<Checkbox size="small" checked={showServiceCharacteristics} onChange={(e) => setShowServiceCharacteristics(e.target.checked)} />} 
                        label="Caractéristiques de la prestation" 
                      />
                      {showServiceCharacteristics && (
                        <Box sx={{ ml: 3, mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <FormControlLabel 
                            control={<Checkbox size="small" checked={showStudentCount} onChange={(e) => setShowStudentCount(e.target.checked)} />} 
                            label="Nombre d'étudiants" 
                          />
                          <FormControlLabel 
                            control={<Checkbox size="small" checked={showHours} onChange={(e) => setShowHours(e.target.checked)} />} 
                            label="Nombre d'heures" 
                          />
                          <FormControlLabel 
                            control={<Checkbox size="small" checked={showLocation} onChange={(e) => setShowLocation(e.target.checked)} />} 
                            label="Lieu(x) de la mission" 
                          />
                          <FormControlLabel 
                            control={<Checkbox size="small" checked={showMissionDescription} onChange={(e) => setShowMissionDescription(e.target.checked)} />} 
                            label="Description de la mission" 
                          />
                          <FormControlLabel 
                            control={<Checkbox size="small" checked={showDatesAndSchedule} onChange={(e) => setShowDatesAndSchedule(e.target.checked)} />} 
                            label="Date(s) et horaires" 
                          />
                        </Box>
                      )}
                      <FormControlLabel 
                        control={<Checkbox size="small" checked={showFreeField} onChange={(e) => setShowFreeField(e.target.checked)} />} 
                        label="Champ libre" 
                      />
                      <FormControlLabel 
                        control={<Checkbox size="small" checked={showGlobalDiscount} onChange={(e) => setShowGlobalDiscount(e.target.checked)} />} 
                        label="Remise globale" 
                      />
                    </FormGroup>
                  </FormControl>
                </Box>

                {/* Couleur du template */}
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <PaletteIcon sx={{ color: templateColor, fontSize: 20 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
                      Couleur du template
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Input color natif */}
                    <Box sx={{ position: 'relative', display: 'inline-block' }}>
                      <input
                        type="color"
                        value={templateColor}
                        onChange={(e) => setTemplateColor(e.target.value)}
                        style={{
                          width: '48px',
                          height: '48px',
                          border: '2px solid #e0e0e0',
                          borderRadius: tokens.radius.sm,
                          cursor: 'pointer',
                          padding: 0,
                          backgroundColor: templateColor
                        }}
                      />
                    </Box>
                    
                    {/* Palette de couleurs prédéfinies */}
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {[
                        '#6366f1', // Indigo (par défaut)
                        tokens.colors.brandTeal, // Bleu Apple
                        tokens.colors.success, // Vert Apple
                        tokens.colors.warning, // Orange Apple
                        tokens.colors.error, // Rouge Apple
                        '#AF52DE', // Violet Apple
                        '#5856D6', // Violet foncé
                        '#5AC8FA', // Bleu clair
                        '#FF2D55', // Rose
                        tokens.colors.warning, // Orange
                        '#FFCC00', // Jaune
                        '#32D74B'  // Vert clair
                      ].map((color) => (
                        <Box
                          key={color}
                          onClick={() => setTemplateColor(color)}
                          sx={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            backgroundColor: color,
                            border: templateColor === color ? '2px solid #1d1d1f' : '2px solid #e0e0e0',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': {
                              transform: 'scale(1.1)',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                            }
                          }}
                        />
                      ))}
                    </Box>
                    
                    {/* Bouton pipette */}
                    {typeof window !== 'undefined' && 'EyeDropper' in window && (
                      <IconButton
                        onClick={async () => {
                          try {
                            const eyeDropper = new window.EyeDropper();
                            const result = await eyeDropper.open();
                            if (result.sRGBHex) {
                              setTemplateColor(result.sRGBHex);
                            }
                          } catch (error) {
                            // L'utilisateur a annulé ou une erreur s'est produite
                            console.log('Pipette annulée ou erreur:', error);
                          }
                        }}
                        size="small"
                        sx={{
                          border: '1px solid #e0e0e0',
                          borderRadius: '6px',
                          color: tokens.colors.textPrimary,
                          '&:hover': {
                            backgroundColor: tokens.colors.bgSubtle,
                            borderColor: templateColor
                          }
                        }}
                        title="Pipette (sélectionner une couleur de l'écran) - Chrome, Edge, Opera uniquement"
                      >
                        <ColorizeIcon fontSize="small" />
                      </IconButton>
                    )}
                    
                    {/* Input texte pour la valeur hex */}
                    <TextField
                      size="small"
                      value={templateColor}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(value) || value === '') {
                          setTemplateColor(value || '#6366f1');
                        }
                      }}
                      placeholder="#6366f1"
                      sx={{
                        width: '100px',
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 1,
                          fontSize: '0.75rem',
                          '& fieldset': { borderColor: '#e0e0e0' }
                        }
                      }}
                    />
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      )}
      </Box>
      </Box>

      {/* Bouton flottant style Apple */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          '@media print': { display: 'none' }
        }}
      >
        <Button
          variant="contained"
          disabled={saving}
          onClick={() => setCreatePopupOpen(true)}
          sx={{
            background: '#34D399',
            color: 'white',
            px: 5,
            py: 1.5,
            borderRadius: '50px',
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(52, 211, 153, 0.3)',
            minWidth: 180,
            height: 48,
            '&:hover': {
              background: '#10B981',
              boxShadow: '0 6px 16px rgba(52, 211, 153, 0.4)',
              transform: 'translateY(-1px)',
            },
            '&:active': {
              transform: 'translateY(0px)',
              boxShadow: '0 2px 8px rgba(52, 211, 153, 0.3)',
            },
            '&:disabled': {
              background: '#E5E5EA',
              color: '#8E8E93',
              boxShadow: 'none',
              transform: 'none',
            },
            transition: 'all 0.2s ease',
          }}
          startIcon={<DownloadIcon sx={{ fontSize: 20 }} />}
        >
          Créer la proposition commerciale
        </Button>
      </Box>



      {/* Popup de création de proposition commerciale */}
      <Dialog
        open={createPopupOpen}
        onClose={() => setCreatePopupOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }
        }}
      >
                {/* Contenu de la popup - Style Apple ultra-épuré */}
        <Box sx={{ p: 5 }}>
          {/* Titre principal */}
          <Typography variant="h5" sx={{ 
            textAlign: 'center', 
            mb: 4, 
            fontWeight: '400', 
            color: tokens.colors.textPrimary,
            fontSize: '1.25rem',
            letterSpacing: '-0.01em'
          }}>
            Que souhaitez-vous faire ?
          </Typography>

          {/* Boutons ultra-minimalistes */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Bouton Télécharger - Utilise PDFDownloadLink pour un vrai PDF */}
            {dataReady && quoteData && structure && mission ? (
              <PDFDownloadLink
                document={
                  <QuotePDF
                    mission={mission}
                    structure={structure}
                    quoteData={quoteData}
                    logoPreview={logoPreview}
                    convertedStructureLogo={convertedStructureLogo}
                    convertedClientLogo={convertedClientLogo}
                    footerSiret={footerSiret}
                    footerTva={footerTva}
                    footerApe={footerApe}
                    templateColor={templateColor}
                    showDocumentTitle={showDocumentTitle}
                    documentTitle={documentTitle}
                    showFreeField={showFreeField}
                    freeFieldText={freeFieldText}
                    freeFieldSegments={freeFieldSegments}
                    freeFieldFontSize={freeFieldFontSize}
                    freeFieldTextAlign={freeFieldTextAlign}
                    showSiret={showSiret}
                    showVatNumber={showVatNumber}
                    showLogo={showLogo}
                    showEmail={showEmail}
                    showPhone={showPhone}
                    showGlobalDiscount={showGlobalDiscount}
                    globalDiscountPercent={globalDiscountPercent}
                    globalDiscountAmount={globalDiscountAmount}
                    showStructureLogo={showStructureLogo}
                    showChargeMission={showChargeMission}
                    showStructureEmail={showStructureEmail}
                    showStructurePhone={showStructurePhone}
                    showStructureSiret={showStructureSiret}
                    showMissionDate={showMissionDate}
                    showMissionValidity={showMissionValidity}
                    showServiceCharacteristics={showServiceCharacteristics}
                    showStudentCount={showStudentCount}
                    showHours={showHours}
                    showLocation={showLocation}
                    showMissionDescription={showMissionDescription}
                    showDatesAndSchedule={showDatesAndSchedule}
                    contactFirstName={contactFirstName}
                    contactLastName={contactLastName}
                    contacts={contacts}
                  />
                }
                fileName={showDocumentTitle && documentTitle ? `${documentTitle}.pdf` : `proposition-commerciale-${mission?.numeroMission || 'mission'}.pdf`}
                style={{
                  textDecoration: 'none',
                  width: '100%'
                }}
              >
                {({ loading: pdfLoading, error }) => (
                  <Button
                    variant="text"
                    fullWidth
                    disabled={loading || saving || pdfLoading}
                    onClick={async (e) => {
                      // Empêcher le comportement par défaut de PDFDownloadLink
                      e.preventDefault();
                      e.stopPropagation();
                      
                      try {
                        console.log('🖱️ Bouton télécharger cliqué');
                        console.log('📋 Mission:', mission);
                        console.log('📋 Storage disponible:', !!storage);
                        
                        // Sauvegarder dans Firestore comme document final
                        console.log('🔄 Génération du PDF...');
                        const pdfBlob = await generatePDF();
                        console.log('✅ PDF généré, taille:', pdfBlob.size);
                        
                        // Télécharger le PDF
                        const downloadUrl = URL.createObjectURL(pdfBlob);
                        const link = document.createElement('a');
                        link.href = downloadUrl;
                        link.download = showDocumentTitle && documentTitle ? `${documentTitle}.pdf` : `proposition-commerciale-${mission?.numeroMission || 'mission'}.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(downloadUrl);
                        console.log('✅ PDF téléchargé');
                        
                        console.log('💾 Appel de saveQuoteAsDocument avec isDraft=false');
                        await saveQuoteAsDocument(pdfBlob, 'pdf', false);
                        console.log('✅ saveQuoteAsDocument terminé');
                        
                        setSnackbar({
                          open: true,
                          message: 'Proposition téléchargée et sauvegardée dans les documents',
                          severity: 'success'
                        });
                        setCreatePopupOpen(false);
                        
                        // Vérifier si les préférences ont changé et proposer de les sauvegarder
                        // Seulement si savedTemplatePreferences existe (a été chargé depuis un template)
                        if (savedTemplatePreferences) {
                          const currentPreferences = {
                            templateColor,
                            billingType,
                            showSiret,
                            showVatNumber,
                            showLogo,
                            showEmail,
                            showPhone,
                            showPaymentTerms,
                            showDocumentTitle,
                            showFreeField,
                            freeFieldText,
                            freeFieldHtml,
                            freeFieldFontSize,
                            freeFieldTextAlign,
                            showGlobalDiscount,
                            showStructureLogo,
                            showChargeMission,
                            showStructureEmail,
                            showStructurePhone,
                            showStructureSiret,
                            showMissionDate,
                            showMissionValidity
                          };
                          
                          const hasChanged = JSON.stringify(currentPreferences) !== JSON.stringify(savedTemplatePreferences);
                          
                          if (hasChanged) {
                            setSavePreferencesDialogOpen(true);
                          }
                        }
                      } catch (error) {
                        console.error('Erreur lors de la sauvegarde:', error);
                        setSnackbar({
                          open: true,
                          message: 'Erreur lors de la sauvegarde',
                          severity: 'error'
                        });
                      }
                    }}
                    sx={{
                      color: tokens.colors.brandTeal,
                      py: 2.5,
                      px: 3,
                      textTransform: 'none',
                      fontSize: '1rem',
                      fontWeight: '400',
                      backgroundColor: 'transparent',
                      borderRadius: '10px',
                      minHeight: '48px',
                      justifyContent: 'flex-start',
                      '&:hover': {
                        backgroundColor: '#F2F2F7',
                      },
                      '&:active': {
                        backgroundColor: '#E5E5EA',
                      },
                      transition: 'background-color 0.15s ease',
                    }}
                    startIcon={
                      pdfLoading ? (
                        <CircularProgress size={16} sx={{ color: tokens.colors.brandTeal }} />
                      ) : (
                        <DownloadIcon sx={{ fontSize: 18, color: tokens.colors.brandTeal }} />
                      )
                    }
                  >
                    {pdfLoading ? 'Génération du PDF...' : 'Télécharger la proposition commerciale'}
                  </Button>
                )}
              </PDFDownloadLink>
            ) : (
              <Button
                variant="text"
                fullWidth
                disabled={true}
                sx={{
                  color: '#8E8E93',
                  py: 2.5,
                  px: 3,
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: '400',
                  backgroundColor: 'transparent',
                  borderRadius: '10px',
                  minHeight: '48px',
                  justifyContent: 'flex-start',
                  cursor: 'not-allowed'
                }}
                startIcon={<DownloadIcon sx={{ fontSize: 18, color: '#8E8E93' }} />}
              >
                Données non disponibles
              </Button>
            )}

            {/* Bouton Envoyer */}
            <Button
              variant="text"
              fullWidth
              disabled={true}
              sx={{
                color: '#8E8E93',
                py: 2.5,
                px: 3,
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: '400',
                backgroundColor: 'transparent',
                borderRadius: '10px',
                minHeight: '48px',
                justifyContent: 'flex-start',
                cursor: 'not-allowed',
                '&:hover': {
                  backgroundColor: 'transparent',
                },
                '&:active': {
                  backgroundColor: 'transparent',
                },
                transition: 'background-color 0.15s ease',
              }}
              startIcon={<UploadIcon sx={{ fontSize: 18, color: '#8E8E93' }} />}
            >
              Indisponible pour l'instant
            </Button>

            {/* Bouton Enregistrer */}
            <Button
              variant="text"
              fullWidth
              disabled={saving || !dataReady}
              onClick={async () => {
                console.log('=== TENTATIVE DE SAUVEGARDE EN BROUILLON ===');
                console.log('dataReady:', dataReady);
                console.log('saving:', saving);
                console.log('Structure actuelle:', structure);
                console.log('Mission actuelle:', mission);
                console.log('QuoteData actuel:', quoteData);
                try {
                  setSaving(true);
                  // Générer le PDF
                  const pdfBlob = await generatePDF();
                  
                  // Sauvegarder dans Firestore comme brouillon
                  await saveQuoteAsDocument(pdfBlob, 'pdf', true);
                  
                  setSnackbar({
                    open: true,
                    message: editingDraftId ? 'Brouillon mis à jour avec succès !' : 'Proposition sauvegardée en brouillon',
                    severity: 'success'
                  });
                  setCreatePopupOpen(false);
                } catch (error) {
                  console.error('Erreur lors de la sauvegarde:', error);
                  setSnackbar({
                    open: true,
                    message: 'Erreur lors de la sauvegarde',
                    severity: 'error'
                  });
                } finally {
                  setSaving(false);
                }
              }}
              sx={{
                color: tokens.colors.textPrimary,
                py: 2.5,
                px: 3,
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: '400',
                backgroundColor: 'transparent',
                borderRadius: '10px',
                minHeight: '48px',
                justifyContent: 'flex-start',
                '&:hover': {
                  backgroundColor: '#F2F2F7',
                },
                '&:active': {
                  backgroundColor: '#E5E5EA',
                },
                transition: 'background-color 0.15s ease',
              }}
              startIcon={<SaveIcon sx={{ fontSize: 18, color: '#8E8E93' }} />}
            >
              {!dataReady ? 'Chargement...' : 'Enregistrer en brouillon'}
            </Button>
          </Box>
        </Box>
      </Dialog>

      {/* Popup d'envoi par email */}
      <Dialog
        open={emailPopupOpen}
        onClose={() => setEmailPopupOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: tokens.radius.lg,
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)'
          }
        }}
      >
        {/* En-tête de la popup email */}
        <Box
          sx={{
            background: 'white',
            color: tokens.colors.textPrimary,
            p: 4,
            textAlign: 'center',
            borderBottom: '1px solid #F2F2F7'
          }}
        >
          <Typography variant="h5" sx={{ 
            fontWeight: '600', 
            mb: 2, 
            color: tokens.colors.textPrimary,
            fontSize: '1.5rem'
          }}>
            Envoyer la proposition commerciale
          </Typography>
          <Typography variant="body1" sx={{ 
            color: '#8E8E93', 
            fontWeight: '400',
            fontSize: '1rem'
          }}>
            Remplissez les informations d'envoi
          </Typography>
        </Box>

        {/* Contenu de la popup email */}
        <Box sx={{ p: 4, background: '#FAFAFA' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Destinataire principal */}
            <TextField
              label="À"
              value={emailData.to}
              onChange={(e) => setEmailData({ ...emailData, to: e.target.value })}
              placeholder="email@exemple.com"
              fullWidth
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: tokens.radius.md,
                  backgroundColor: 'white'
                }
              }}
            />

            {/* Copie */}
            <TextField
              label="En copie (optionnel)"
              value={emailData.cc}
              onChange={(e) => setEmailData({ ...emailData, cc: e.target.value })}
              placeholder="email@exemple.com"
              fullWidth
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: tokens.radius.md,
                  backgroundColor: 'white'
                }
              }}
            />

            {/* Sujet */}
            <TextField
              label="Sujet"
              value={emailData.subject}
              onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
              fullWidth
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: tokens.radius.md,
                  backgroundColor: 'white'
                }
              }}
            />

            {/* Message */}
            <TextField
              label="Message"
              value={emailData.message}
              onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
              fullWidth
              multiline
              rows={6}
              variant="outlined"
              placeholder="Votre message personnalisé..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: tokens.radius.md,
                  backgroundColor: 'white'
                }
              }}
            />

            {/* Boutons d'action */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
              <Button
                variant="outlined"
                onClick={() => setEmailPopupOpen(false)}
                sx={{
                  borderColor: '#E5E5EA',
                  color: tokens.colors.textPrimary,
                  py: 2,
                  px: 4,
                  textTransform: 'none',
                  borderRadius: tokens.radius.md,
                  borderWidth: '2px'
                }}
              >
                Annuler
              </Button>
              <Button
                variant="contained"
                disabled={sending || !emailData.to || !emailData.subject}
                onClick={async () => {
                  try {
                    setSending(true);
                    // Générer le PDF
                    const pdfBlob = await generatePDF();
                    
                    // Sauvegarder dans Firestore comme document envoyé
                    await saveQuoteAsDocument(pdfBlob, 'pdf', false);
                    
                    // Ici, vous pouvez ajouter la logique d'envoi d'email
                    // Par exemple, appeler une Cloud Function ou un service d'email
                    
                    setSnackbar({
                      open: true,
                      message: 'Proposition envoyée avec succès !',
                      severity: 'success'
                    });
                    setEmailPopupOpen(false);
                    setEmailData({
                      to: contactEmail || '',
                      cc: '',
                      subject: `Proposition commerciale ${mission?.numeroMission || etudeNumber || 'mission'}`,
                      message: ''
                    });
                  } catch (error) {
                    console.error('Erreur lors de l\'envoi:', error);
                    setSnackbar({
                      open: true,
                      message: 'Erreur lors de l\'envoi',
                      severity: 'error'
                    });
                  } finally {
                    setSending(false);
                  }
                }}
                sx={{
                  background: tokens.colors.brandTeal,
                  color: 'white',
                  py: 2,
                  px: 4,
                  textTransform: 'none',
                  borderRadius: tokens.radius.md,
                  '&:hover': {
                    background: '#0056CC',
                  },
                  '&:disabled': {
                    background: '#E5E5EA',
                    color: '#8E8E93'
                  }
                }}
                startIcon={
                  sending ? (
                    <CircularProgress size={18} sx={{ color: 'white' }} />
                  ) : (
                    <SendIcon sx={{ fontSize: 18, color: 'white' }} />
                  )
                }
              >
                {sending ? 'Envoi...' : 'Envoyer'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Dialog>

      {/* Dialog pour sauvegarder les préférences de template */}
      <Dialog
        open={savePreferencesDialogOpen}
        onClose={() => setSavePreferencesDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: tokens.radius.lg,
            p: 3
          }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: tokens.colors.textPrimary }}>
            Enregistrer les préférences de template ?
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, color: '#8E8E93' }}>
            Vos choix de template (couleur, options affichées, etc.) sont différents de ceux enregistrés. 
            Souhaitez-vous les enregistrer pour les prochaines générations de propositions commerciales ?
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              onClick={() => setSavePreferencesDialogOpen(false)}
              sx={{
                color: '#8E8E93',
                textTransform: 'none',
                '&:hover': {
                  backgroundColor: '#F2F2F7'
                }
              }}
            >
              Plus tard
            </Button>
            <Button
              onClick={saveTemplatePreferences}
              variant="contained"
              sx={{
                background: tokens.colors.brandTeal,
                color: 'white',
                textTransform: 'none',
                '&:hover': {
                  background: '#0056CC'
                }
              }}
            >
              Enregistrer
            </Button>
          </Box>
        </Box>
      </Dialog>

      {createPortal(
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          sx={{ zIndex: 10000 }}
        >
          <Alert 
            onClose={() => setSnackbar({ ...snackbar, open: false })} 
            severity={snackbar.severity}
            sx={{
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              minWidth: '300px'
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>,
        document.body
      )}
    </Box>
  );
};

export default QuoteBuilder; 