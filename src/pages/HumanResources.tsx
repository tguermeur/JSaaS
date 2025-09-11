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
  status: 'Étudiant' | 'Membre' | 'Admin' | 'Superadmin';
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
        
        // Vérifier si l'utilisateur est admin ou superadmin
        const isUserAdmin = userData.status === 'Admin';
        const isUserSuperAdmin = userData.status === 'Superadmin';
        
        console.log("Est admin:", isUserAdmin); // Debug
        console.log("Est superadmin:", isUserSuperAdmin); // Debug
        
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
    const matchesStatus = statusFilters.length === 0 || statusFilters.includes(user.status);
    
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
      
      // Remplacer les variables sur chaque page
      for (const variable of templateData.variables) {
        if (variable.position.page > pages.length) continue;
        
        const page = pages[variable.position.page - 1];
        const { width, height } = page.getSize();
        
        // Convertir les coordonnées relatives en coordonnées absolues
        const x = variable.position.x * (width / 595); // 595 est la largeur standard d'une page A4
        const y = height - (variable.position.y * (height / 842)); // 842 est la hauteur standard d'une page A4
        
        // Obtenir la valeur de la variable
        let value = '';
        if (variable.type === 'raw') {
          value = variable.rawText || '';
        } else if (variable.fieldId) {
          value = selectedUser[variable.fieldId as keyof typeof selectedUser]?.toString() || '';
        }
        
        // Ajouter le texte au PDF
        page.drawText(value, {
          x,
          y,
          size: variable.fontSize,
          font: await pdfDoc.embedFont(PDFLib.StandardFonts[variable.fontFamily as keyof typeof PDFLib.StandardFonts] || PDFLib.StandardFonts.Helvetica),
        });
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
      p: 0
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
          mb: 8
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
                      switch(value) {
                        case 'Étudiant': return 'Étudiants';
                        case 'Membre': return 'Membres';
                        case 'Admin': return 'Admins';
                        case 'Superadmin': return 'Superadmins';
                        default: return value;
                      }
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
                    <ListItemText primary="Admins" />
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
                    <ListItemText primary="Superadmins" />
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
            pb: 8
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
                      <Typography variant="body1">{user.firstName} {user.lastName}</Typography>
                      <Chip 
                        label={user.status} 
                        size="small"
                        color={user.status === 'Étudiant' ? 'primary' : 'default'}
                      />
                    </Box>
                  }
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        {user.email}
                      </Typography>
                      {user.phone && (
                        <Typography variant="body2" color="text.secondary">
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
          mb: 8
        }}>
          {selectedUser ? (
            <>
              <Box sx={{ p: 3, borderBottom: '1px solid #f0f0f0' }}>
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
                          label={selectedUser.status} 
                          size="small"
                          sx={{ 
                            backgroundColor: selectedUser.status === 'Superadmin' ? '#e65100' : 
                                          selectedUser.status === 'Admin' ? '#1976d2' :
                                          selectedUser.status === 'Membre' ? '#2e7d32' : '#0288d1',
                            color: 'white'
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
                  <IconButton>
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

              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
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

              <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
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
        <MenuItem onClick={() => setAnchorEl(null)}>Modifier</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Désactiver le compte</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)} sx={{ color: 'error.main' }}>
          Supprimer
        </MenuItem>
      </Menu>

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