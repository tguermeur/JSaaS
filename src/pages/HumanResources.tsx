import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Button,
  Tabs,
  Tab,
  Divider,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Work as WorkIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { DocumentType, Template } from '../types/templates';
import * as PDFLib from 'pdf-lib';
import { useSearchParams } from 'react-router-dom';

interface HistoryEntry {
  id: string;
  date: string;
  action: string;
  details: string;
  type: 'mission' | 'profile' | 'document' | 'system';
  userId: string;
}

interface UserDetails {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  birthPlace: string;
  birthPostalCode: string;
  gender: string;
  nationality: string;
  email: string;
  studentId: string;
  studyYear: string;
  address: string;
  socialSecurityNumber: string;
  phone: string;
  status?: 'Étudiant' | 'Membre' | 'Admin' | 'Superadmin';
  photoURL?: string;
  dossierValidated?: boolean;
  dossierValidationDate?: string;
  dossierValidatedBy?: string;
  lastLogin?: Timestamp;
  isOnline?: boolean;
  documents: {
    name: string;
    date: string;
    size: string;
  }[];
  missions?: {
    id: string;
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    status: 'En cours' | 'Terminée' | 'Annulée';
    location: string;
    remuneration: string;
  }[];
  history?: HistoryEntry[];
}

const HumanResources = () => {
  const { currentUser, updateLastActivity } = useAuth();
  const [users, setUsers] = useState<UserDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [currentTab, setCurrentTab] = useState(0);
  const [conventionTemplate, setConventionTemplate] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [userHistory, setUserHistory] = useState<HistoryEntry[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isHRMember, setIsHRMember] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [completionFilter, setCompletionFilter] = useState<string>('all');
  const [validationFilter, setValidationFilter] = useState<string>('all');

  // Modifions les états pour permettre la sélection multiple
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [completionFilters, setCompletionFilters] = useState<string[]>([]);
  const [validationFilters, setValidationFilters] = useState<string[]>([]);

  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editedUser, setEditedUser] = useState<UserDetails | null>(null);
  const [currentUserStatus, setCurrentUserStatus] = useState<string>('');

  const [searchParams] = useSearchParams();

  // Fonction pour gérer la sélection multiple des filtres
  const handleFilterChange = (filterType: string, value: string) => {
    switch (filterType) {
      case 'status':
        if (value === 'all') {
          setStatusFilters([]);
        } else {
          setStatusFilters(prev => 
            prev.includes(value) 
              ? prev.filter(item => item !== value) 
              : [...prev, value]
          );
        }
        break;
      case 'completion':
        if (value === 'all') {
          setCompletionFilters([]);
        } else {
          setCompletionFilters(prev => 
            prev.includes(value) 
              ? prev.filter(item => item !== value) 
              : [...prev, value]
          );
        }
        break;
      case 'validation':
        if (value === 'all') {
          setValidationFilters([]);
        } else {
          setValidationFilters(prev => 
            prev.includes(value) 
              ? prev.filter(item => item !== value) 
              : [...prev, value]
          );
        }
        break;
    }
  };

  // Fonction pour formater les statuts en français avec majuscules
  const getStatusLabel = (status: string | undefined | null): string => {
    if (!status || status.trim() === '') return 'NON DÉFINI';
    
    const statusMap: { [key: string]: string } = {
      'Étudiant': 'ÉTUDIANT',
      'Membre': 'MEMBRE',
      'Admin': 'ADMINISTRATEUR',
      'Superadmin': 'SUPER ADMINISTRATEUR',
      'Student': 'ÉTUDIANT',
      'Member': 'MEMBRE',
      'member': 'MEMBRE',
      'Administrator': 'ADMINISTRATEUR',
      'SuperAdmin': 'SUPER ADMINISTRATEUR'
    };
    const normalizedStatus = status.trim();
    const label = statusMap[normalizedStatus] || statusMap[normalizedStatus.toLowerCase()] || normalizedStatus.toUpperCase();
    return label;
  };

  // Fonction pour obtenir la couleur du statut
  const getStatusColor = (status: string | undefined | null): 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'default' => {
    if (!status) return 'default';
    
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus.includes('étudiant') || normalizedStatus.includes('student')) {
      return 'primary';
    } else if (normalizedStatus.includes('membre') || normalizedStatus.includes('member')) {
      return 'success';
    } else if (normalizedStatus.includes('admin') || normalizedStatus.includes('administrator')) {
      return 'info';
    } else if (normalizedStatus.includes('super')) {
      return 'error';
    }
    return 'default';
  };

  // Définir la fonction isProfileComplete au début du composant
  const isProfileComplete = (user: UserDetails | null) => {
    if (!user) return false;
    
    const requiredFields = [
      user.firstName,
      user.lastName,
      user.birthDate,
      user.birthPlace,
      user.birthPostalCode,
      user.gender,
      user.nationality,
      user.email,
      user.studentId,
      user.studyYear,
      user.address,
      user.socialSecurityNumber,
      user.phone
    ];

    return requiredFields.every(field => field && field.trim() !== '');
  };

  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser) return;

      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!userDocSnap.exists()) {
          console.error("Utilisateur non trouvé");
          return;
        }

        const structureId = userDocSnap.data()?.structureId;

        if (structureId) {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('structureId', '==', structureId));
          const querySnapshot = await getDocs(q);
          
          const usersData = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              lastLogin: data.lastLogin || null,
              isOnline: data.isOnline || false
            };
          }) as UserDetails[];
          
          setUsers(usersData);

          await fetchConventionTemplate(structureId);
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des données:", error);
      }
    };

    fetchUsers();
  }, [currentUser]);

  useEffect(() => {
    const checkUserRole = async () => {
      if (!currentUser) return;

      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!userDocSnap.exists()) {
          console.error("Utilisateur non trouvé");
          return;
        }

        const userData = userDocSnap.data();
        console.log("Données utilisateur:", userData); // Debug
        
        // Stocker le statut actuel de l'utilisateur
        const userStatus = userData.status || '';
        setCurrentUserStatus(userStatus);
        console.log("Statut utilisateur stocké:", userStatus);
        
        // Vérifier si l'utilisateur est admin ou superadmin
        const isUserAdmin = userData.status === 'Admin';
        const isUserSuperAdmin = userData.status === 'Superadmin';
        
        console.log("Données utilisateur pour permissions:", {
          status: userData.status,
          isUserAdmin,
          isUserSuperAdmin,
          poles: userData.poles
        }); // Debug
        
        setIsAdmin(isUserAdmin);
        setIsSuperAdmin(isUserSuperAdmin);
        
        // Vérifier si l'utilisateur est membre du pôle RH
        const isHR = userData.poles?.some((pole: any) => 
          pole.poleId === 'rh' || pole.name === 'Ressources humaines'
        );
        console.log("Est membre RH:", isHR); // Debug
        setIsHRMember(isHR);
      } catch (error) {
        console.error("Erreur lors de la vérification du rôle:", error);
      }
    };

    checkUserRole();
  }, [currentUser]);

  // Ajoutons une fonction pour vérifier si l'utilisateur peut valider les dossiers
  const canValidateDossier = () => {
    return isAdmin || isHRMember || isSuperAdmin;
  };

  // Ajoutons un log pour déboguer
  useEffect(() => {
    console.log("Peut valider les dossiers:", canValidateDossier());
    console.log("isAdmin:", isAdmin);
    console.log("isHRMember:", isHRMember);
    console.log("isSuperAdmin:", isSuperAdmin);
  }, [isAdmin, isHRMember, isSuperAdmin]);

  // Modifions la fonction de filtrage pour prendre en compte les sélections multiples
  const filteredUsers = users.filter(user => {
    // Vérifier si user est défini
    if (!user) return false;
    
    // Filtre par recherche
    const matchesSearch = 
      (user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (user.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (user.email?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
    
    // Filtre par statut (sélection multiple)
    const matchesStatus = statusFilters.length === 0 || (user.status && statusFilters.includes(user.status));
    
    // Filtre par complétion (sélection multiple)
    const isComplete = isProfileComplete(user);
    const matchesCompletion = 
      completionFilters.length === 0 || 
      (completionFilters.includes('complete') && isComplete) || 
      (completionFilters.includes('incomplete') && !isComplete);
    
    // Filtre par validation (sélection multiple)
    const matchesValidation = 
      validationFilters.length === 0 || 
      (validationFilters.includes('validated') && user.dossierValidated) || 
      (validationFilters.includes('notValidated') && !user.dossierValidated);
    
    return matchesSearch && matchesStatus && matchesCompletion && matchesValidation;
  });

  const handleUserClick = (user: UserDetails) => {
    setSelectedUser(user);
    fetchUserHistory(user.id);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const fetchConventionTemplate = async (structureId: string) => {
    try {
      const assignmentsSnapshot = await getDocs(query(
        collection(db, 'templateAssignments'),
        where('structureId', '==', structureId),
        where('documentType', '==', 'convention_etudiant')
      ));

      if (!assignmentsSnapshot.empty) {
        const templateId = assignmentsSnapshot.docs[0].data().templateId;
        setConventionTemplate(templateId);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du template:', error);
    }
  };

  // Fonction pour convertir variableId en balise
  const getTagFromVariableId = (variableId: string): string => {
    const tagMap: { [key: string]: string } = {
      // User/Étudiant
      lastName: '<user_nom>',
      firstName: '<user_prenom>',
      email: '<user_email>',
      ecole: '<user_ecole>',
      displayName: '<user_nom_complet>',
      phone: '<user_telephone>',
      socialSecurityNumber: '<user_numero_securite_sociale>',
      studentId: '<user_numero_etudiant>',
      address: '<user_adresse>',
      city: '<user_ville>',
      postalCode: '<user_code_postal>',
      country: '<user_pays>',
      formation: '<user_formation>',
      program: '<user_programme>',
      graduationYear: '<user_annee_diplome>',
      nationality: '<user_nationalite>',
      gender: '<user_genre>',
      birthPlace: '<user_lieu_naissance>',
      birthDate: '<user_date_naissance>',
      
      // Mission
      numeroMission: '<mission_numero>',
      chargeName: '<mission_cdm>',
      missionDateDebut: '<mission_date_debut>',
      missionDateHeureDebut: '<mission_date_heure_debut>',
      missionDateFin: '<mission_date_fin>',
      missionDateHeureFin: '<mission_date_heure_fin>',
      location: '<mission_lieu>',
      company: '<mission_entreprise>',
      priceHT: '<mission_prix>',
      missionDescription: '<mission_description>',
      title: '<mission_titre>',
      hours: '<mission_heures>',
      studentCount: '<mission_nb_etudiants>',
      generationDate: '<mission_date_generation>',
      generationDatePlusOneYear: '<mission_date_generation_plus_1_an>',
      
      // Company/Entreprise (ne pas confondre avec les champs utilisateur)
      companyName: '<entreprise_nom>',
      siren: '<entreprise_siren>',
      nSiret: '<entreprise_nsiret>',
      companyAddress: '<entreprise_adresse>',
      companyCity: '<entreprise_ville>',
      companyPostalCode: '<entreprise_code_postal>',
      companyCountry: '<entreprise_pays>',
      companyPhone: '<entreprise_telephone>',
      companyEmail: '<entreprise_email>',
      website: '<entreprise_site_web>',
      
      // Structure
      structure_name: '<structure_nom>',
      structure_siret: '<structure_siret>',
      structure_address: '<structure_adresse>',
      structure_city: '<structure_ville>',
      structure_postalCode: '<structure_code_postal>',
      structure_country: '<structure_pays>',
      structure_phone: '<structure_telephone>',
      structure_email: '<structure_email>',
      structure_website: '<structure_site_web>',
      structure_president_fullName: '<structure_president_nom_complet>',
    };

    return tagMap[variableId] || `<${variableId}>`;
  };

  // Fonction pour remplacer les balises par leurs valeurs
  const replaceTags = async (text: string, structureData?: any): Promise<string> => {
    if (!text || !selectedUser) return text;

    try {
      // Récupérer les données de la structure si nécessaire
      let structureInfo = structureData;
      const structureId = currentUser?.structureId;
      if (!structureInfo && structureId) {
        try {
          const structureDoc = await getDoc(doc(db, 'structures', structureId));
          if (structureDoc.exists()) {
            structureInfo = structureDoc.data();
          }
        } catch (error) {
          console.error('Erreur lors de la récupération de la structure:', error);
        }
      }

      // Récupérer le président du mandat le plus récent
      let presidentFullName = '[Président non disponible]';
      if (structureId) {
        try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('structureId', '==', structureId));
          const usersSnapshot = await getDocs(q);
          
          const members = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            mandat: doc.data().mandat || null,
            bureauRole: doc.data().bureauRole || null,
            poles: doc.data().poles || [],
            firstName: doc.data().firstName || '',
            lastName: doc.data().lastName || '',
            displayName: doc.data().displayName || ''
          }));

          // Filtrer les présidents (via bureauRole ou pôle 'pre')
          const presidents = members.filter(member => {
            const hasPresidentRole = member.bureauRole === 'president' || 
              member.poles?.some((p: any) => p.poleId === 'pre');
            return hasPresidentRole && member.mandat;
          });

          if (presidents.length > 0) {
            // Trier les mandats pour trouver le plus récent
            const sortedPresidents = presidents.sort((a, b) => {
              if (!a.mandat || !b.mandat) return 0;
              // Comparer les années de début des mandats (format: "2024-2025")
              const aYear = parseInt(a.mandat.split('-')[0]);
              const bYear = parseInt(b.mandat.split('-')[0]);
              return bYear - aYear; // Plus récent en premier
            });

            const mostRecentPresident = sortedPresidents[0];
            // Construire le nom complet : prénom + nom ou displayName
            if (mostRecentPresident.firstName && mostRecentPresident.lastName) {
              presidentFullName = `${mostRecentPresident.firstName} ${mostRecentPresident.lastName}`.trim();
            } else if (mostRecentPresident.displayName) {
              presidentFullName = mostRecentPresident.displayName;
            }
          }
        } catch (error) {
          console.error('Erreur lors de la récupération du président:', error);
        }
      }

      const replacements: { [key: string]: string } = {
        // Balises utilisateur/étudiant
        '<user_nom>': selectedUser.lastName || '[Nom non disponible]',
        '<user_prenom>': selectedUser.firstName || '[Prénom non disponible]',
        '<user_email>': selectedUser.email || '[Email non disponible]',
        '<user_ecole>': selectedUser.ecole || '[École non disponible]',
        '<user_nom_complet>': `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || '[Nom complet non disponible]',
        '<user_telephone>': selectedUser.phone || '[Téléphone non disponible]',
        '<user_numero_securite_sociale>': selectedUser.socialSecurityNumber || '[Numéro de sécurité sociale non disponible]',
        '<user_numero_etudiant>': selectedUser.studentId || '[Numéro étudiant non disponible]',
        '<user_adresse>': selectedUser.address || '[Adresse non disponible]',
        '<user_ville>': selectedUser.city || '[Ville non disponible]',
        '<user_code_postal>': selectedUser.postalCode || '[Code postal non disponible]',
        '<user_pays>': selectedUser.country || '[Pays non disponible]',
        '<user_formation>': selectedUser.formation || '[Formation non disponible]',
        '<user_programme>': selectedUser.program || '[Programme non disponible]',
        '<user_annee_diplome>': selectedUser.graduationYear || '[Année de diplômation non disponible]',
        '<user_nationalite>': selectedUser.nationality || '[Nationalité non disponible]',
        '<user_genre>': selectedUser.gender || '[Genre non disponible]',
        '<user_lieu_naissance>': selectedUser.birthPlace || '[Lieu de naissance non disponible]',
        '<user_date_naissance>': selectedUser.birthDate || '[Date de naissance non disponible]',
        
        // Balises système
        '<generationDate>': new Date().toLocaleDateString('fr-FR'),
        '<mission_date_generation>': new Date().toLocaleDateString('fr-FR'),
        '<mission_date_generation_plus_1_an>': (() => {
          const today = new Date();
          const oneYearLater = new Date(today);
          oneYearLater.setDate(today.getDate() + 365);
          return oneYearLater.toLocaleDateString('fr-FR');
        })(),
        
        // Balises de la structure
        '<structure_nom>': structureInfo?.nom || '[Nom de la structure non disponible]',
        '<structure_siret>': structureInfo?.siret || '[SIRET de la structure non disponible]',
        '<structure_adresse>': structureInfo?.address || '[Adresse de la structure non disponible]',
        '<structure_ville>': structureInfo?.city || '[Ville de la structure non disponible]',
        '<structure_code_postal>': structureInfo?.postalCode || '[Code postal de la structure non disponible]',
        '<structure_pays>': structureInfo?.country || '[Pays de la structure non disponible]',
        '<structure_telephone>': structureInfo?.phone || '[Téléphone de la structure non disponible]',
        '<structure_email>': structureInfo?.email || '[Email de la structure non disponible]',
        '<structure_site_web>': structureInfo?.website || '[Site web de la structure non disponible]',
        '<structure_president_nom_complet>': presidentFullName,
      };

      let result = text;
      Object.entries(replacements).forEach(([tag, value]) => {
        const regex = new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        result = result.replace(regex, value);
      });

      // Vérifier s'il reste des balises non remplacées
      const remainingTags = result.match(/<[^>]+>/g);
      if (remainingTags) {
        remainingTags.forEach(tag => {
          const tagName = tag.replace(/[<>]/g, '');
          result = result.replace(tag, `[Information "${tagName}" non disponible]`);
          console.warn(`[replaceTags] Balise inconnue non remplacée : ${tag}`);
        });
      }

      return result;
    } catch (error) {
      console.error('Erreur lors du remplacement des balises:', error);
      return text;
    }
  };

  const generateConvention = async () => {
    if (!conventionTemplate || !selectedUser) return;
    
    try {
      // Récupérer le template depuis Firestore
      const templateRef = doc(db, 'templates', conventionTemplate);
      const templateDoc = await getDoc(templateRef);
      
      if (!templateDoc.exists()) {
        throw new Error('Template non trouvé');
      }

      const templateData = templateDoc.data() as Template;
      const pdfUrl = templateData.pdfUrl;

      if (!pdfUrl) {
        throw new Error('URL du PDF non trouvée dans le template');
      }

      // Télécharger le fichier
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error('Erreur lors du téléchargement du PDF');
      }
      
      const pdfBlob = await response.blob();
      
      // Créer un nouveau PDF avec les variables remplacées
      const pdfDoc = await PDFLib.PDFDocument.load(await pdfBlob.arrayBuffer());
      const pages = pdfDoc.getPages();
      
      // Remplacer les variables sur chaque page (même méthode que MissionDetails.tsx et EntrepriseDetail.tsx)
      const helveticaFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
      const helveticaFontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      
      for (const variable of templateData.variables) {
        if (variable.position.page > pages.length) continue;
        
        const page = pages[variable.position.page - 1];
        const pageHeight = page.getHeight();
        
        try {
          // Obtenir la valeur de la variable
          let valueToReplace = '';
          if (variable.type === 'raw') {
            valueToReplace = variable.rawText || '';
          } else if (variable.variableId) {
            // Utiliser variableId pour obtenir la balise
            valueToReplace = getTagFromVariableId(variable.variableId);
          } else if (variable.fieldId) {
            // Fallback sur fieldId pour compatibilité
            const tag = getTagFromVariableId(variable.fieldId);
            valueToReplace = tag || `<${variable.fieldId}>`;
          }
          
          // Utiliser replaceTags pour remplacer les balises par leurs valeurs
          const value = await replaceTags(valueToReplace);
          
          if (value && value.trim()) {
            // Appliquer les styles et la position (identique à MissionDetails.tsx)
            const fontSize = variable.fontSize || 12;
            const font = variable.isBold ? helveticaFontBold : helveticaFont;
            const { x, y } = variable.position;
            const { width, height } = variable;
            const textAlign = variable.textAlign || 'left';
            const verticalAlign = variable.verticalAlign || 'top';
            
            // Calculer la position Y en fonction de l'alignement vertical (identique à MissionDetails.tsx)
            let yPos = pageHeight - y;
            const textHeight = font.heightAtSize(fontSize);
            if (verticalAlign === 'middle') {
              yPos = pageHeight - y - (height / 2) + (fontSize * -0.25);
            } else if (verticalAlign === 'bottom') {
              yPos = pageHeight - (y + height) + fontSize * 0.8;
            }
            
            // Fonction pour nettoyer le texte
            const cleanTextForPDF = (text: string): string => {
              if (!text) return '';
              return text
                .replace(/\u202F/g, ' ')
                .replace(/\u00A0/g, ' ')
                .replace(/\u2019/g, "'")
                .replace(/\u2018/g, "'")
                .replace(/\u201C/g, '"')
                .replace(/\u201D/g, '"')
                .replace(/\u2013/g, '-')
                .replace(/\u2014/g, '-')
                .replace(/\u2026/g, '...')
                .replace(/[^\x00-\x7F]/g, (char) => {
                  const charCode = char.charCodeAt(0);
                  if (charCode >= 0x00A0 && charCode <= 0x00FF) {
                    return char;
                  }
                  return ' ';
                });
            };
            
            // Découper le texte en lignes selon la largeur max
            const splitTextToLines = (text: string, font: any, fontSize: number, maxWidth: number): string[] => {
              const words = text.split(' ');
              const lines: string[] = [];
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
              if (currentLine) lines.push(currentLine);
              return lines;
            };
            
            const cleanedValue = cleanTextForPDF(value);
            const lines = splitTextToLines(cleanedValue.trim(), font, fontSize, width);
            let lineY = yPos;
            const lineHeight = fontSize * 1.2;
            
            // Dessiner chaque ligne
            for (let i = 0; i < lines.length; i++) {
              const line = cleanTextForPDF(lines[i]);
              let xLine = x;
              const lineWidth = font.widthOfTextAtSize(line, fontSize);
              
              // Calculer la position X en fonction de l'alignement horizontal
              if (textAlign === 'center') {
                xLine = x + (width - lineWidth) / 2;
              } else if (textAlign === 'right') {
                xLine = x + width - lineWidth;
              }
              
              try {
                page.drawText(line, {
                  x: xLine,
                  y: lineY,
                  size: fontSize,
                  font,
                  maxWidth: width,
                  lineHeight: lineHeight
                });
              } catch (drawError) {
                // Si l'erreur persiste, essayer avec un texte encore plus nettoyé
                const fallbackLine = line.replace(/[^\x20-\x7E]/g, ' ');
                page.drawText(fallbackLine, {
                  x: xLine,
                  y: lineY,
                  size: fontSize,
                  font,
                  maxWidth: width,
                  lineHeight: lineHeight
                });
              }
              lineY -= lineHeight;
            }
          }
        } catch (err) {
          console.error(`Erreur lors du traitement de la variable ${variable.name || variable.variableId}:`, err);
        }
      }
      
      // Générer le PDF final
      const modifiedPdfBytes = await pdfDoc.save();
      const modifiedBlob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      
      // Créer un lien de téléchargement
      const downloadUrl = window.URL.createObjectURL(modifiedBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Convention_${selectedUser.firstName}_${selectedUser.lastName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setSnackbar({
        open: true,
        message: 'Convention générée avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la génération de la convention:', error);
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Erreur lors de la génération de la convention',
        severity: 'error'
      });
    }
  };

  const fetchUserHistory = async (userId: string) => {
    try {
      const historyRef = collection(db, 'history');
      const q = query(historyRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      const historyData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HistoryEntry[];
      
      // Trier l'historique par date décroissante
      const sortedHistory = historyData.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      setUserHistory(sortedHistory);
    } catch (error) {
      console.error("Erreur lors de la récupération de l'historique:", error);
    }
  };

  const validateUserDossier = async () => {
    if (!selectedUser || !currentUser) return;

    try {
      const userRef = doc(db, 'users', selectedUser.id);
      
      // Mettre à jour le statut de validation du dossier
      await updateDoc(userRef, {
        dossierValidated: true,
        dossierValidationDate: new Date().toISOString(),
        dossierValidatedBy: currentUser.uid
      });

      // Mettre à jour la dernière activité
      await updateLastActivity();

      // Ajouter une entrée dans l'historique
      const historyRef = collection(db, 'history');
      await addDoc(historyRef, {
        userId: selectedUser.id,
        date: new Date().toISOString(),
        action: 'Validation du dossier',
        details: `Dossier validé par ${currentUser.displayName || currentUser.email}`,
        type: 'profile'
      });

      // Mettre à jour l'état local
      setSelectedUser({
        ...selectedUser,
        dossierValidated: true,
        dossierValidationDate: new Date().toISOString(),
        dossierValidatedBy: currentUser.uid
      });

      setSnackbar({
        open: true,
        message: 'Dossier validé avec succès',
        severity: 'success'
      });

      // Rafraîchir l'historique
      fetchUserHistory(selectedUser.id);
    } catch (error) {
      console.error('Erreur lors de la validation du dossier:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la validation du dossier',
        severity: 'error'
      });
    }
  };

  const unvalidateUserDossier = async () => {
    if (!selectedUser || !currentUser) return;

    try {
      const userRef = doc(db, 'users', selectedUser.id);
      
      // Mettre à jour le statut de validation du dossier
      await updateDoc(userRef, {
        dossierValidated: false,
        dossierValidationDate: null,
        dossierValidatedBy: null
      });

      // Mettre à jour la dernière activité
      await updateLastActivity();

      // Ajouter une entrée dans l'historique
      const historyRef = collection(db, 'history');
      await addDoc(historyRef, {
        userId: selectedUser.id,
        date: new Date().toISOString(),
        action: 'Dévalidation du dossier',
        details: `Dossier dévalidé par ${currentUser.displayName || currentUser.email}`,
        type: 'profile'
      });

      // Mettre à jour l'état local
      setSelectedUser({
        ...selectedUser,
        dossierValidated: false,
        dossierValidationDate: null,
        dossierValidatedBy: null
      });

      setSnackbar({
        open: true,
        message: 'Dossier dévalidé avec succès',
        severity: 'success'
      });

      // Rafraîchir l'historique
      fetchUserHistory(selectedUser.id);
    } catch (error) {
      console.error('Erreur lors de la dévalidation du dossier:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la dévalidation du dossier',
        severity: 'error'
      });
    }
  };

  const handleEditUser = () => {
    if (selectedUser && canEditUser()) {
      console.log("Accès autorisé à la modification");
      setEditedUser({ ...selectedUser });
      setEditModalOpen(true);
      setAnchorEl(null);
    } else {
      console.log("Accès refusé à la modification");
      setSnackbar({
        open: true,
        message: 'Vous n\'avez pas les permissions pour modifier ce profil',
        severity: 'error'
      });
    }
  };

  // Fonction pour vérifier si l'utilisateur peut modifier les profils
  const canEditUser = () => {
    // Utiliser directement le statut actuel de l'utilisateur
    const canEdit = currentUserStatus === 'Admin' || 
                   currentUserStatus === 'Superadmin' || 
                   currentUserStatus === 'superadmin' || // Variante minuscule
                   isHRMember || // Vérifier aussi les membres RH
                   (currentUser && currentUser.email?.includes('admin')); // Fallback pour les admins
    
    console.log("Permissions d'édition:", { 
      currentUserStatus,
      isAdmin, 
      isHRMember, 
      isSuperAdmin, 
      canEdit,
      currentUserEmail: currentUser?.email
    });
    return canEdit;
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setEditedUser(null);
  };

  const handleSaveUser = async () => {
    if (!editedUser || !currentUser) return;

    try {
      const userRef = doc(db, 'users', editedUser.id);
      
      // Préparer les données à sauvegarder en filtrant les valeurs undefined et null
      const updateData: Record<string, any> = {};
      
      // Fonction helper pour nettoyer les valeurs
      const cleanValue = (value: any) => {
        if (value === undefined || value === null) return null;
        if (typeof value === 'string' && value.trim() === '') return '';
        return value;
      };
      
      // Ajouter tous les champs avec des valeurs nettoyées
      updateData.firstName = cleanValue(editedUser.firstName);
      updateData.lastName = cleanValue(editedUser.lastName);
      updateData.birthDate = cleanValue(editedUser.birthDate);
      updateData.birthPlace = cleanValue(editedUser.birthPlace);
      updateData.birthPostalCode = cleanValue(editedUser.birthPostalCode);
      updateData.gender = cleanValue(editedUser.gender);
      updateData.nationality = cleanValue(editedUser.nationality);
      updateData.email = cleanValue(editedUser.email);
      updateData.studentId = cleanValue(editedUser.studentId);
      updateData.studyYear = cleanValue(editedUser.studyYear);
      updateData.address = cleanValue(editedUser.address);
      updateData.socialSecurityNumber = cleanValue(editedUser.socialSecurityNumber);
      updateData.phone = cleanValue(editedUser.phone);

      await updateDoc(userRef, updateData);

      // Mettre à jour la dernière activité
      await updateLastActivity();

      // Ajouter une entrée dans l'historique
      const historyRef = collection(db, 'history');
      await addDoc(historyRef, {
        userId: editedUser.id,
        date: new Date().toISOString(),
        action: 'Modification du profil',
        details: `Profil modifié par ${currentUser.displayName || currentUser.email}`,
        type: 'profile'
      });

      // Mettre à jour l'état local
      setSelectedUser(editedUser);
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === editedUser.id ? editedUser : user
        )
      );

      setSnackbar({
        open: true,
        message: 'Profil modifié avec succès',
        severity: 'success'
      });

      handleCloseEditModal();
      fetchUserHistory(editedUser.id);
    } catch (error) {
      console.error('Erreur lors de la modification du profil:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la modification du profil',
        severity: 'error'
      });
    }
  };

  const handleInputChange = (field: keyof UserDetails, value: string) => {
    if (editedUser) {
      setEditedUser({
        ...editedUser,
        [field]: value.trim() === '' ? '' : value
      });
    }
  };

  // Ajout d'un effet pour suivre les utilisateurs en ligne
  useEffect(() => {
    if (!currentUser) return;

    const fetchOnlineUsers = async () => {
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!userDocSnap.exists()) {
          console.error("Utilisateur non trouvé");
          return;
        }

        const structureId = userDocSnap.data()?.structureId;

        if (structureId) {
          // Écouter les changements de statut en ligne des utilisateurs
          const onlineUsersRef = collection(db, 'onlineUsers');
          const q = query(onlineUsersRef, where('structureId', '==', structureId));
          
          const unsubscribe = onSnapshot(q, (snapshot) => {
            const onlineUserIds = snapshot.docs.map(doc => doc.data().userId);
            setOnlineUsers(onlineUserIds);
            
            // Mettre à jour le statut en ligne des utilisateurs dans l'état local
            setUsers(prevUsers => 
              prevUsers.map(user => ({
                ...user,
                isOnline: onlineUserIds.includes(user.id)
              }))
            );
          });

          return () => unsubscribe();
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des utilisateurs en ligne:", error);
      }
    };

    fetchOnlineUsers();
  }, [currentUser]);

  // Ajout d'un intervalle pour mettre à jour périodiquement la dernière activité
  useEffect(() => {
    if (!currentUser) return;

    // Mettre à jour la dernière activité toutes les 3 minutes
    const activityInterval = setInterval(() => {
      updateLastActivity();
    }, 3 * 60 * 1000); // 3 minutes en millisecondes

    return () => clearInterval(activityInterval);
  }, [currentUser, updateLastActivity]);

  // Effet pour sélectionner l'utilisateur depuis l'URL
  useEffect(() => {
    const userId = searchParams.get('userId');
    if (userId && users.length > 0) {
      const userToSelect = users.find(user => user.id === userId);
      if (userToSelect) {
        handleUserClick(userToSelect);
      }
    }
  }, [searchParams, users]);

  return (
    <Box sx={{ 
      maxWidth: '100%',
      margin: '0',
      height: '100%',
      p: 0,
      pb: 2
    }}>
      <Box sx={{ 
        display: 'flex', 
        gap: 3,
        height: '100%'
      }}>
        {/* Liste des membres - légèrement plus large */}
        <Paper sx={{ 
          width: '400px',
          borderRadius: '12px',
          overflow: 'hidden',
          height: '100%',
          flexShrink: 0,
          mb: 2
        }}>
          <Box sx={{ p: 2, borderBottom: '1px solid #f0f0f0' }}>
            <TextField
              fullWidth
              placeholder="Rechercher un membre..."
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  fontSize: '0.875rem'
                }
              }}
            />
            
            {/* Filtres sur une même ligne avec sélection multiple */}
            <Box sx={{ 
              display: 'flex', 
              gap: 1, 
              mt: 2,
              flexWrap: 'nowrap',
              overflowX: 'auto',
              pb: 1
            }}>
              {/* Filtre par statut */}
              <FormControl size="small" sx={{ minWidth: 100, flexShrink: 0 }}>
                <Select
                  multiple
                  value={statusFilters}
                  onChange={(e) => {
                    const value = e.target.value as string[];
                    if (value.includes('all')) {
                      setStatusFilters([]);
                    } else {
                      setStatusFilters(value);
                    }
                  }}
                  displayEmpty
                  renderValue={(selected) => {
                    if (selected.length === 0) return 'Statut';
                    if (selected.length === 1) {
                      const value = selected[0];
                      const label = getStatusLabel(value);
                      // Mettre au pluriel pour l'affichage
                      if (label === 'Étudiant') return 'Étudiants';
                      if (label === 'Membre') return 'Membres';
                      if (label === 'Administrateur') return 'Administrateurs';
                      if (label === 'Super administrateur') return 'Super administrateurs';
                      return label;
                    }
                    return `${selected.length} statuts`;
                  }}
                  sx={{ 
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    height: '32px',
                    backgroundColor: 'background.paper',
                    '& .MuiSelect-select': {
                      py: 0.5
                    }
                  }}
                >
                  <MenuItem value="all">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={statusFilters.length === 0}
                        indeterminate={statusFilters.length > 0 && statusFilters.length < 4}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Tous les statuts" />
                  </MenuItem>
                  <MenuItem value="Étudiant">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={statusFilters.includes('Étudiant')}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Étudiants" />
                  </MenuItem>
                  <MenuItem value="Membre">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={statusFilters.includes('Membre')}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Membres" />
                  </MenuItem>
                  <MenuItem value="Admin">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={statusFilters.includes('Admin')}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Administrateurs" />
                  </MenuItem>
                  <MenuItem value="Superadmin">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={statusFilters.includes('Superadmin')}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Super administrateurs" />
                  </MenuItem>
                </Select>
              </FormControl>
              
              {/* Filtre par complétion */}
              <FormControl size="small" sx={{ minWidth: 100, flexShrink: 0 }}>
                <Select
                  multiple
                  value={completionFilters}
                  onChange={(e) => {
                    const value = e.target.value as string[];
                    if (value.includes('all')) {
                      setCompletionFilters([]);
                    } else {
                      setCompletionFilters(value);
                    }
                  }}
                  displayEmpty
                  renderValue={(selected) => {
                    if (selected.length === 0) return 'Profil';
                    if (selected.length === 1) {
                      const value = selected[0];
                      switch(value) {
                        case 'complete': return 'Complétés';
                        case 'incomplete': return 'Incomplets';
                        default: return value;
                      }
                    }
                    return `${selected.length} profils`;
                  }}
                  sx={{ 
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    height: '32px',
                    backgroundColor: 'background.paper',
                    '& .MuiSelect-select': {
                      py: 0.5
                    }
                  }}
                >
                  <MenuItem value="all">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={completionFilters.length === 0}
                        indeterminate={completionFilters.length > 0 && completionFilters.length < 2}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Tous les profils" />
                  </MenuItem>
                  <MenuItem value="complete">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={completionFilters.includes('complete')}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Complétés" />
                  </MenuItem>
                  <MenuItem value="incomplete">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={completionFilters.includes('incomplete')}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Incomplets" />
                  </MenuItem>
                </Select>
              </FormControl>
              
              {/* Filtre par validation */}
              <FormControl size="small" sx={{ minWidth: 100, flexShrink: 0 }}>
                <Select
                  multiple
                  value={validationFilters}
                  onChange={(e) => {
                    const value = e.target.value as string[];
                    if (value.includes('all')) {
                      setValidationFilters([]);
                    } else {
                      setValidationFilters(value);
                    }
                  }}
                  displayEmpty
                  renderValue={(selected) => {
                    if (selected.length === 0) return 'Dossier';
                    if (selected.length === 1) {
                      const value = selected[0];
                      switch(value) {
                        case 'validated': return 'Validés';
                        case 'notValidated': return 'Non validés';
                        default: return value;
                      }
                    }
                    return `${selected.length} dossiers`;
                  }}
                  sx={{ 
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    height: '32px',
                    backgroundColor: 'background.paper',
                    '& .MuiSelect-select': {
                      py: 0.5
                    }
                  }}
                >
                  <MenuItem value="all">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={validationFilters.length === 0}
                        indeterminate={validationFilters.length > 0 && validationFilters.length < 2}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Tous les dossiers" />
                  </MenuItem>
                  <MenuItem value="validated">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={validationFilters.includes('validated')}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Validés" />
                  </MenuItem>
                  <MenuItem value="notValidated">
                    <ListItemIcon>
                      <Checkbox 
                        edge="start"
                        checked={validationFilters.includes('notValidated')}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText primary="Non validés" />
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>

          <List sx={{ 
            p: 0,
            height: 'calc(100% - 72px)',
            overflowY: 'auto',
            pb: 2
          }}>
            {filteredUsers.map((user) => (
              <ListItem
                key={user.id}
                sx={{
                  borderBottom: '1px solid #f0f0f0',
                  '&:hover': {
                    backgroundColor: '#f5f5f7'
                  },
                  cursor: 'pointer'
                }}
                onClick={() => handleUserClick(user)}
              >
                <ListItemAvatar>
                  <Avatar 
                    src={user.photoURL}
                    sx={{ 
                      width: 40, 
                      height: 40,
                      bgcolor: user.photoURL ? 'transparent' : 'primary.main'
                    }}
                  >
                    {!user.photoURL && `${user.firstName?.charAt(0)}${user.lastName?.charAt(0)}`}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1" component="span">{user.firstName} {user.lastName}</Typography>
                      <Chip 
                        label={getStatusLabel(user.status)} 
                        size="small"
                        color={getStatusColor(user.status)}
                        sx={{ 
                          fontSize: '0.7rem',
                          height: '20px',
                          fontWeight: 500
                        }}
                      />
                    </Box>
                  }
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Typography variant="body2" color="text.secondary" component="span">
                        {user.email}
                      </Typography>
                      {user.phone && (
                        <Typography variant="body2" color="text.secondary" component="span">
                          {user.phone}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* Détails du membre - prend tout l'espace restant */}
        <Paper sx={{ 
          flex: 1,
          borderRadius: '12px',
          overflow: 'hidden',
          height: '100%',
          minWidth: 0,
          mb: 2,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {selectedUser ? (
            <>
              <Box sx={{ p: 3, borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar 
                      src={selectedUser.photoURL}
                      sx={{ 
                        width: 56, 
                        height: 56,
                        bgcolor: selectedUser.photoURL ? 'transparent' : 'primary.main'
                      }}
                    >
                      {!selectedUser.photoURL && `${selectedUser.firstName?.charAt(0)}${selectedUser.lastName?.charAt(0)}`}
                    </Avatar>
                    <Box>
                      <Typography variant="h6">{`${selectedUser.firstName} ${selectedUser.lastName}`}</Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Chip 
                          label={getStatusLabel(selectedUser.status)} 
                          size="small"
                          color={getStatusColor(selectedUser.status)}
                          sx={{ 
                            fontWeight: 500,
                            fontSize: '0.75rem'
                          }}
                        />
                        <Chip 
                          label={isProfileComplete(selectedUser) ? 'Profil complété' : 'Profil non complété'} 
                          size="small"
                          color={isProfileComplete(selectedUser) ? 'success' : 'warning'}
                        />
                        {selectedUser.dossierValidated && (
                          <Chip 
                            label="Dossier validé" 
                            size="small"
                            color="success"
                          />
                        )}
                      </Box>
                      {selectedUser.lastLogin && (
                        <Typography variant="body2" color="text.secondary">
                          Dernière connexion : {selectedUser.lastLogin instanceof Timestamp 
                            ? selectedUser.lastLogin.toDate().toLocaleString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : "Date inconnue"
                          }
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <IconButton
                    onClick={(event) => setAnchorEl(event.currentTarget)}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button 
                    variant="contained"
                    onClick={generateConvention}
                    disabled={!conventionTemplate}
                  >
                    Générer la convention étudiante
                  </Button>
                  {selectedUser.dossierValidated ? (
                    <Button 
                      variant="outlined" 
                      color="error"
                      onClick={unvalidateUserDossier}
                    >
                      Dévalider le dossier
                    </Button>
                  ) : (
                    <Button 
                      variant="contained" 
                      color="success"
                      onClick={validateUserDossier}
                    >
                      Valider le dossier
                    </Button>
                  )}
                </Box>
              </Box>

              <Box sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
                <Tabs 
                  value={currentTab} 
                  onChange={handleTabChange}
                  variant="fullWidth"
                >
                  <Tab label="Dossier" />
                  <Tab label="Missions" />
                  <Tab label="Historique" />
                </Tabs>
              </Box>

              <Box sx={{ p: 3, pb: 2, flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {currentTab === 0 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 2 }}>Informations personnelles</Typography>
                    <Box sx={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(2, 1fr)', 
                      gap: 3 
                    }}>
                      {/* Colonne 1 - Informations d'identité */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Prénom</Typography>
                          <Typography variant="body1">{selectedUser?.firstName}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Nom</Typography>
                          <Typography variant="body1">{selectedUser?.lastName}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Date de naissance</Typography>
                          <Typography variant="body1">{selectedUser?.birthDate}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Lieu de naissance</Typography>
                          <Typography variant="body1">{selectedUser?.birthPlace}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Code postal de naissance</Typography>
                          <Typography variant="body1">{selectedUser?.birthPostalCode}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Sexe</Typography>
                          <Typography variant="body1">{selectedUser?.gender}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Nationalité</Typography>
                          <Typography variant="body1">{selectedUser?.nationality}</Typography>
                        </Box>
                      </Box>

                      {/* Colonne 2 - Informations de contact et administratives */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Email</Typography>
                          <Typography variant="body1">{selectedUser?.email}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Numéro de téléphone</Typography>
                          <Typography variant="body1">{selectedUser?.phone}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Adresse</Typography>
                          <Typography variant="body1">{selectedUser?.address}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Numéro étudiant</Typography>
                          <Typography variant="body1">{selectedUser?.studentId}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Année d'étude</Typography>
                          <Typography variant="body1">{selectedUser?.studyYear}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Numéro de sécurité sociale</Typography>
                          <Typography variant="body1">{selectedUser?.socialSecurityNumber}</Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                )}

                {currentTab === 1 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 2 }}>Missions effectuées</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {selectedUser?.missions && selectedUser.missions.length > 0 ? (
                        selectedUser.missions.map((mission) => (
                          <Box key={mission.id} sx={{ 
                            p: 2, 
                            border: '1px solid #eee',
                            borderRadius: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1
                          }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="subtitle1" fontWeight="medium">{mission.title}</Typography>
                              <Chip 
                                label={mission.status} 
                                size="small"
                                color={
                                  mission.status === 'En cours' ? 'info' : 
                                  mission.status === 'Terminée' ? 'success' : 'error'
                                }
                              />
                            </Box>
                            <Typography variant="body2" color="text.secondary">{mission.description}</Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                {mission.startDate} - {mission.endDate}
                              </Typography>
                              <Typography variant="body2" fontWeight="medium">
                                {mission.remuneration}
                              </Typography>
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                              Lieu: {mission.location}
                            </Typography>
                          </Box>
                        ))
                      ) : (
                        <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                          <Typography>Aucune mission effectuée</Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                )}

                {currentTab === 2 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 2 }}>Historique des actions</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {userHistory.length > 0 ? (
                        userHistory.map((entry) => (
                          <Box key={entry.id} sx={{ 
                            p: 2, 
                            border: '1px solid #eee',
                            borderRadius: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.5
                          }}>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(entry.date).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </Typography>
                            <Typography variant="body1">
                              {entry.action}
                            </Typography>
                            {entry.type === 'profile' && entry.action.includes('Validation') ? (
                              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip 
                                  label="Dossier validé" 
                                  size="small"
                                  color="success"
                                  sx={{ fontSize: '0.75rem' }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                  par {entry.details.split(' par ')[1] || 'un administrateur'}
                                </Typography>
                              </Box>
                            ) : entry.type === 'profile' && entry.action.includes('Modification') ? (
                              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip 
                                  label="Profil modifié" 
                                  size="small"
                                  color="info"
                                  sx={{ fontSize: '0.75rem' }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                  {entry.details}
                                </Typography>
                              </Box>
                            ) : entry.type === 'profile' && entry.action.includes('Complétion') ? (
                              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip 
                                  label="Profil complété" 
                                  size="small"
                                  color="success"
                                  sx={{ fontSize: '0.75rem' }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                  {entry.details}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                {entry.details}
                              </Typography>
                            )}
                          </Box>
                        ))
                      ) : (
                        <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                          <Typography>Aucun historique disponible</Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                )}
              </Box>
            </>
          ) : (
            <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
              <Typography>Sélectionnez un membre pour voir ses détails</Typography>
            </Box>
          )}
        </Paper>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem 
          onClick={handleEditUser}
          disabled={!canEditUser()}
          title={!canEditUser() ? "Seuls les admins, membres RH et superadmins peuvent modifier les profils" : ""}
        >
          Modifier
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Désactiver le compte</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)} sx={{ color: 'error.main' }}>
          Supprimer
        </MenuItem>
      </Menu>

      {/* Modal d'édition des informations utilisateur */}
      <Dialog
        open={editModalOpen}
        onClose={handleCloseEditModal}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Modifier les informations de {editedUser?.firstName} {editedUser?.lastName}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={3}>
              {/* Informations personnelles */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                  Informations personnelles
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Prénom"
                  value={editedUser?.firstName || ''}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nom"
                  value={editedUser?.lastName || ''}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Date de naissance"
                  type="date"
                  value={editedUser?.birthDate || ''}
                  onChange={(e) => handleInputChange('birthDate', e.target.value)}
                  variant="outlined"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Lieu de naissance"
                  value={editedUser?.birthPlace || ''}
                  onChange={(e) => handleInputChange('birthPlace', e.target.value)}
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Code postal de naissance"
                  value={editedUser?.birthPostalCode || ''}
                  onChange={(e) => handleInputChange('birthPostalCode', e.target.value)}
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Sexe</InputLabel>
                  <Select
                    value={editedUser?.gender || ''}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    label="Sexe"
                  >
                    <MenuItem value="Homme">Homme</MenuItem>
                    <MenuItem value="Femme">Femme</MenuItem>
                    <MenuItem value="Autre">Autre</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nationalité"
                  value={editedUser?.nationality || ''}
                  onChange={(e) => handleInputChange('nationality', e.target.value)}
                  variant="outlined"
                />
              </Grid>

              {/* Informations de contact */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', mt: 3 }}>
                  Informations de contact
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={editedUser?.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Numéro de téléphone"
                  value={editedUser?.phone || ''}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Adresse"
                  value={editedUser?.address || ''}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  variant="outlined"
                  multiline
                  rows={2}
                />
              </Grid>

              {/* Informations académiques */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', mt: 3 }}>
                  Informations académiques
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Numéro étudiant"
                  value={editedUser?.studentId || ''}
                  onChange={(e) => handleInputChange('studentId', e.target.value)}
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Année d'étude"
                  value={editedUser?.studyYear || ''}
                  onChange={(e) => handleInputChange('studyYear', e.target.value)}
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Numéro de sécurité sociale"
                  value={editedUser?.socialSecurityNumber || ''}
                  onChange={(e) => handleInputChange('socialSecurityNumber', e.target.value)}
                  variant="outlined"
                />
              </Grid>

            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseEditModal} color="inherit">
            Annuler
          </Button>
          <Button 
            onClick={handleSaveUser} 
            variant="contained" 
            color="primary"
            disabled={!editedUser}
          >
            Sauvegarder
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
    </Box>
  );
};

export default HumanResources; 