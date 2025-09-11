import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Send as SendIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, where, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { PDFDownloadLink } from '@react-pdf/renderer';

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
    padding: 40,
    paddingHorizontal: 60, // Augmentation des marges horizontales
    fontSize: 10,
    lineHeight: 1.2,
    color: '#333'
  },
  
  // En-tête avec les deux sections côte à côte
  header: {
    flexDirection: 'row', // Les sections gauche et droite côte à côte
    marginBottom: 20
  },
  
  // Container pour les sections structure et client
  headerContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    width: '100%'
  },
  
  // Sections principales
  leftSection: {
    width: '50%',
    padding: 24, // p: 3 = 24px
    backgroundColor: 'white',
    borderRadius: 8, // borderRadius: 2 = 8px
    marginRight: 12, // spacing: 3 = 12px
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)', // boxShadow: 1
    minHeight: 200, // Hauteur minimale au lieu de fit-content
    alignItems: 'flex-start' // Aligner le contenu en haut à gauche
  },
  
  rightSection: {
    width: '50%',
    padding: 24, // p: 3 = 24px
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
    marginBottom: 6, // Réduit de 8 à 6
    marginTop: 0, // Pas de marge supérieure pour l'alignement
    color: '#000000' // Noir pur au lieu de #333
  },
  
  infoText: {
    fontSize: 10, // Réduit de 14 à 10 pour une meilleure densité
    marginBottom: 2, // Réduit de 3 à 2 pour un interligne plus serré
    color: '#000000', // Noir pur au lieu de #666
    lineHeight: 1.2 // Réduit de 1.3 à 1.2 pour un interligne plus serré
  },
  
  // Logo
  logoContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8 // mb: 1 = 8px
  },
  
  logoImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 12
  },
  
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  
  logoText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold'
  },
  
  logoSubtitle: {
    fontSize: 6,
    color: '#666',
    textAlign: 'center'
  },
  
  // Espaceur invisible pour maintenir l'alignement quand pas de logo
  logoSpacer: {
    width: 60,
    height: 80, // 8px (logoContainer marginBottom) + 60px (logo) + 12px (logo marginBottom)
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    margin: '0 auto'
  },
  
  // Informations structure
  structureName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#000000'
  },
  
  structureInfo: {
    fontSize: 9,
    marginBottom: 1,
    color: '#000000'
  },
  
  // Section droite - Informations client
  clientTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000000'
  },
  
  clientInfo: {
    fontSize: 9,
    marginBottom: 1,
    color: '#000000'
  },
  
  // Section devis (pleine largeur en dessous)
  quoteSection: {
    width: '100%',
    padding: 15,
    borderRadius: 4
  },
  
  quoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15
  },
  
  quoteTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1d1d1f'
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
    backgroundColor: '#6366f1',
    padding: 8,
    borderRadius: 4,
    marginBottom: 5
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
    padding: 8,
    borderBottom: '1px solid #f0f0f0'
  },
  
  tableCell: {
    flex: 1,
    fontSize: 8,
    textAlign: 'center'
  },
  
  // Totaux
  totals: {
    marginTop: 20,
    alignItems: 'flex-end'
  },
  
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
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
    color: '#6366f1'
  },
  
  // Bas de page
  footer: {
    position: 'absolute',
    bottom: 50, // Augmenté pour laisser de la place à la numérotation
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
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    fontSize: 8,
    color: '#666',
    opacity: 0.7
  },
  
  // Champ libre
  freeFieldContainer: {
    marginTop: 15,
    padding: 10,
    border: '1px solid #e0e0e0',
    borderRadius: 4,
    backgroundColor: '#ffffff'
  },
  
  freeFieldText: {
    fontSize: 10,
    color: '#333',
    lineHeight: 1.5
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

// Fonction pour gérer les logos
const getLogoSource = (logoPreview: string | null, structureLogo: string | null) => {
  // Priorité : logo uploadé > logo structure > placeholder
  if (logoPreview) {
    return logoPreview; // Déjà en base64
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
const QuotePDF = ({ mission, structure, quoteData, logoPreview, footerSiret, footerTva, footerApe, showDocumentTitle, documentTitle, showFreeField, freeFieldText, showSiret, showVatNumber, showLogo, showEmail, showPhone, showGlobalDiscount, globalDiscountPercent, globalDiscountAmount, showStructureLogo, showChargeMission, showStructureEmail, showStructurePhone, showStructureSiret, showMissionDate, showMissionValidity }: {
  mission: Mission | null;
  structure: any;
  quoteData: QuoteData;
  logoPreview: string | null;
  footerSiret: string;
  footerTva: string;
  footerApe: string;
  showDocumentTitle?: boolean;
  documentTitle?: string;
  showFreeField?: boolean;
  freeFieldText?: string;
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
}) => {
  const structureData = getStructureData(structure, mission);
  const clientData = getClientData(quoteData);
  const logoSource = getLogoSource(logoPreview, structure?.logo);
  
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
                {logoSource ? (
                  <Image 
                    src={logoSource} 
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
            {showLogo && quoteData.clientInfo.logo ? (
              <View style={styles.logoContainer}>
                <Image 
                  src={quoteData.clientInfo.logo} 
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
          
          {/* Tableau */}
          <View style={styles.table}>
            <View style={styles.tableHeader}>
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
              <Text style={styles.totalTTC}>Total TTC:</Text>
              <Text style={styles.totalTTC}>{quoteData.totals.totalTTC.toFixed(2)} €</Text>
            </View>
            
            {/* Champ libre */}
            {showFreeField && freeFieldText && (
              <View style={styles.freeFieldContainer}>
                <Text style={styles.freeFieldText}>{freeFieldText}</Text>
              </View>
            )}
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
  const { missionNumber, etudeNumber } = useParams<{ missionNumber?: string; etudeNumber?: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // Déterminer le type de document et le numéro
  const documentNumber = missionNumber || etudeNumber;
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
  const [showGlobalDiscount, setShowGlobalDiscount] = useState<boolean>(false);
  
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

  // Fonction pour synchroniser les données entre l'édition et le PDF
  const syncDataForPDF = () => {
    if (!structure || !quoteData) return;
    
    // Synchroniser les données de la structure
    const updatedStructure = {
      ...structure,
      nom: structure.nom || structure.name || '',
      adresse: structure.adresse || structure.address || '',
      ville: structure.ville || structure.city || '',
      city: structure.ville || structure.city || '',
      codePostal: structure.codePostal || structure.postalCode || '',
      postalCode: structure.codePostal || structure.postalCode || '',
      telephone: structure.telephone || structure.phone || '',
      phone: structure.telephone || structure.phone || ''
    };
    
    setStructure(updatedStructure);
    
    // Synchroniser les données client
    const updatedQuoteData = {
      ...quoteData,
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
        phone: quoteData.clientInfo.phone || ''
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
          } else {
            console.warn('Aucune donnée de structure trouvée dans le brouillon');
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
          
          setMission(missionData);
          
          // Définir le titre par défaut du document
          const defaultTitle = `PC-${documentNumber}`;
          setDocumentTitle(defaultTitle);
        } else {
        // Récupérer les données de la mission par numeroMission
        const missionsQuery = query(
          collection(db, 'missions'),
            where('numeroMission', '==', documentNumber)
        );
        const missionsSnapshot = await getDocs(missionsQuery);
        
        if (missionsSnapshot.empty) {
            console.error('Mission not found with number:', documentNumber);
          setLoading(false);
          return;
        }
        
        const missionDoc = missionsSnapshot.docs[0];
          documentData = missionDoc.data();
          collectionName = 'missions';
          
          missionData = documentData as Mission;
                  setMission(missionData);
          
          // Définir le titre par défaut du document
          const defaultTitle = `PC-${documentNumber}`;
          setDocumentTitle(defaultTitle);
        }
        
        console.log('Mission data loaded:', missionData);
        
        // Récupérer les données de la structure
        if (missionData.structureId) {
          try {
            const structureDoc = await getDoc(doc(db, 'structures', missionData.structureId));
            if (structureDoc.exists()) {
              const structureData = structureDoc.data();
              console.log('Structure data loaded:', structureData);
              
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
              
              // Utiliser le logo de la structure s'il existe et qu'aucun logo n'est déjà défini
              if (structureData.logo && !logoPreview) {
                // Vérifier que le logo est une URL valide
                try {
                  const logoUrl = new URL(structureData.logo);
                  if (logoUrl.protocol === 'http:' || logoUrl.protocol === 'https:') {
                    setLogoPreview(structureData.logo);
                  }
                } catch (error) {
                  console.warn('Logo URL invalide:', structureData.logo);
                  // Ne pas définir le logo si l'URL est invalide
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
                          siret: companyData.siret || ''
                        },
                        clientInfo: {
                          name: companyData.name || missionData.company || '',
                          address: companyData.address || '',
                          complement: '',
                          postalCode: companyData.postalCode || '',
                          city: companyData.city || '',
                          country: companyData.country || 'France',
                          siret: companyData.siret || '',
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
                const companiesQuery = query(
                  collection(db, 'companies'),
                  where('name', '==', missionData.company)
                );
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
                      siret: companyData.siret || ''
                    },
                    clientInfo: {
                      name: companyData.name || missionData.company || '',
                      address: companyData.address || '',
                      complement: '',
                      postalCode: companyData.postalCode || '',
                      city: companyData.city || '',
                      country: companyData.country || 'France',
                      siret: companyData.siret || '',
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
                  siret: companyData.siret || ''
                },
                clientInfo: {
                  name: companyData.name || missionData.company || '',
                  address: companyData.address || '',
                  complement: '',
                  postalCode: companyData.postalCode || '',
                  city: companyData.city || '',
                  country: companyData.country || 'France',
                  siret: companyData.siret || '',
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
                const companiesQuery = query(
                  collection(db, 'companies'),
                  where('name', '==', missionData.company)
                );
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
    return new Promise((resolve, reject) => {
      try {
        // Créer un blob temporaire avec les informations de la proposition
        // Note: Ceci est un placeholder. Pour un vrai PDF, il faudrait utiliser
        // une Cloud Function ou un service de génération PDF côté serveur
        
        const pdfContent = `Proposition commerciale ${mission?.numeroMission || 'mission'}
        
        Structure: ${structure?.nom || structure?.name || ''}
        Client: ${mission?.company || ''}
        Montant HT: ${quoteData?.totals?.totalHT || 0} €
        Montant TTC: ${quoteData?.totals?.totalTTC || 0} €
        
        Options activées:
        - Logo structure: ${showStructureLogo ? 'Oui' : 'Non'}
        - Logo client: ${showLogo ? 'Oui' : 'Non'}
        - Email structure: ${showStructureEmail ? 'Oui' : 'Non'}
        - Téléphone structure: ${showStructurePhone ? 'Oui' : 'Non'}
        - SIRET structure: ${showStructureSiret ? 'Oui' : 'Non'}
        - Date mission: ${showMissionDate ? 'Oui' : 'Non'}
        - Validité mission: ${showMissionValidity ? 'Oui' : 'Non'}
        
        Date de génération: ${new Date().toLocaleString('fr-FR')}
        
        IMPORTANT: Ce fichier est un aperçu texte. Pour le vrai PDF avec mise en page,
        utilisez le bouton "Télécharger la proposition commerciale" dans la popup principale.`;
        
        // Créer un blob avec le bon type MIME pour un PDF
        const blob = new Blob([pdfContent], { type: 'application/pdf' });
        resolve(blob);
      } catch (error) {
        reject(error);
      }
    });
  };

  // Fonction pour sauvegarder la proposition comme document
  const saveQuoteAsDocument = async (pdfBlob: Blob, type: string, isDraft: boolean): Promise<void> => {
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
      
      // Préparer les données du document
      const documentData = {
        name: showDocumentTitle && documentTitle ? documentTitle : `Proposition commerciale ${mission?.numeroMission || 'mission'}`,
        type: type,
        url: '', // URL du fichier uploadé
        uploadedAt: new Date(),
        uploadedBy: currentUser?.displayName || currentUser?.uid || 'unknown',
        size: pdfBlob.size,
        isDraft: isDraft,
        // Utiliser etudeId pour la compatibilité avec EtudeDetails.tsx
        etudeId: mission?.id,
        missionId: mission?.id, // Garder pour la compatibilité
        numeroMission: mission?.numeroMission,
        structureId: structure?.id,
        companyId: mission?.companyId,
        companyName: mission?.company,
        // Sauvegarder toutes les données de la proposition pour permettre la reprise
        quoteData: isDraft ? quoteData : null,
        structureData: isDraft ? structure : null, // Données complètes de la structure
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
      bottom: 0
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
        justifyContent: 'flex-start',
        height: '100%',
        overflowY: 'auto'
      }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 6,
        width: '100%',
        maxWidth: '1200px',
        position: 'relative'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <IconButton
            onClick={() => navigate(-1)}
            sx={{
              color: '#007AFF',
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
            color: '#1d1d1f',
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
            borderColor: '#007AFF',
            color: '#007AFF',
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
          '@media print': {
            display: 'none'
          }
        }}
      >
        {/* Conteneur gris qui s'adapte aux dimensions A4 */}
        <Box 
          sx={{ 
            width: '210mm',
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
        {/* Document A4 centré pour PDF */}
        <Box 
          sx={{ 
            width: '210mm',
            height: '297mm',
            bgcolor: 'white',
            boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
            borderRadius: '4px',
            overflow: 'hidden',
            flexShrink: 0,
            position: 'relative',
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
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
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
                          border: '2px solid #007AFF'
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
                          border: '2px solid #007AFF'
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
                        backgroundColor: '#007AFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        border: '2px solid #e0e0e0',
                        '&:hover': {
                          border: '2px solid #007AFF'
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
                          border: '2px solid #007AFF'
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
                        backgroundColor: '#f5f5f7',
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
                <Typography variant="h5" sx={{ fontWeight: '600', color: '#1d1d1f', fontSize: '1.25rem' }}>Proposition commerciale</Typography>
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
                  bgcolor: '#6366f1',
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
                    borderBottom: '1px solid #f0f0f0',
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
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#6366f1', fontSize: '1rem' }}>
                      Total TTC
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#6366f1', fontSize: '1rem' }}>
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
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  placeholder="Saisissez votre texte libre ici..."
                  value={freeFieldText}
                  onChange={(e) => setFreeFieldText(e.target.value)}
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      border: '2px dashed #ccc',
                      borderRadius: 2,
                      padding: '8px 12px',
                      '&:hover': {
                        border: '2px dashed #999'
                      },
                      '&.Mui-focused': {
                        border: '2px dashed #007AFF'
                      }
                    },
                    '& .MuiInputBase-input': {
                      fontSize: '0.875rem',
                      lineHeight: 1.5
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
                  <SettingsIcon sx={{ color: '#6366f1', fontSize: 20 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
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
                    <ReceiptIcon sx={{ color: '#6366f1', fontSize: 20 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
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
                    <PersonIcon sx={{ color: '#6366f1', fontSize: 20 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
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
                    <BusinessIcon sx={{ color: '#6366f1', fontSize: 20 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
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
                    <AssignmentIcon sx={{ color: '#6366f1', fontSize: 20 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
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
                    <MenuIcon sx={{ color: '#6366f1', fontSize: 20 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
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
            color: '#1d1d1f',
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
                    footerSiret={footerSiret}
                    footerTva={footerTva}
                    footerApe={footerApe}
                    showDocumentTitle={showDocumentTitle}
                    documentTitle={documentTitle}
                    showFreeField={showFreeField}
                    freeFieldText={freeFieldText}
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
                    onClick={async () => {
                      try {
                        // Sauvegarder dans Firestore comme document final
                        const pdfBlob = await generatePDF(); // Placeholder pour la sauvegarde
                        await saveQuoteAsDocument(pdfBlob, 'pdf', false);
                        
                        setSnackbar({
                          open: true,
                          message: 'Proposition téléchargée et sauvegardée dans les documents',
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
                      }
                    }}
                    sx={{
                      color: '#007AFF',
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
                        <CircularProgress size={16} sx={{ color: '#007AFF' }} />
                      ) : (
                        <DownloadIcon sx={{ fontSize: 18, color: '#007AFF' }} />
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
              disabled={saving}
              onClick={() => {
                setCreatePopupOpen(false);
                setEmailPopupOpen(true);
              }}
              sx={{
                color: '#1d1d1f',
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
              startIcon={<UploadIcon sx={{ fontSize: 18, color: '#8E8E93' }} />}
            >
              Envoyer la proposition commerciale
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
                color: '#1d1d1f',
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
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)'
          }
        }}
      >
        {/* En-tête de la popup email */}
        <Box
          sx={{
            background: 'white',
            color: '#1d1d1f',
            p: 4,
            textAlign: 'center',
            borderBottom: '1px solid #F2F2F7'
          }}
        >
          <Typography variant="h5" sx={{ 
            fontWeight: '600', 
            mb: 2, 
            color: '#1d1d1f',
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
                  borderRadius: '12px',
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
                  borderRadius: '12px',
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
                  borderRadius: '12px',
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
                  borderRadius: '12px',
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
                  color: '#1d1d1f',
                  py: 2,
                  px: 4,
                  textTransform: 'none',
                  borderRadius: '12px',
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
                  background: '#007AFF',
                  color: 'white',
                  py: 2,
                  px: 4,
                  textTransform: 'none',
                  borderRadius: '12px',
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

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        sx={{
          zIndex: 9999,
          '& .MuiSnackbar-root': {
            zIndex: 9999
          }
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{
            zIndex: 9999,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            minWidth: '300px'
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default QuoteBuilder; 