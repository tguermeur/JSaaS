import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  TextField,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  InputAdornment,
  Divider,
  keyframes
} from '@mui/material';
import {
  Add as AddIcon,
  CloudUpload as CloudUploadIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  WorkHistory as WorkHistoryIcon
} from '@mui/icons-material';
import Papa from 'papaparse';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { doc, getDoc, collection, addDoc, query, where, getDocs, updateDoc, setDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import MissionForm, { MissionFormData } from '../components/missions/MissionForm';
import { canAccessStructureContent, canModifyStructureContent } from '../utils/permissions';

// Animations
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

interface EtudeData {
  id?: string;
  numeroEtude: string;
  nomConsultant?: string;
  date?: string;
  lieu?: string;
  entreprise?: string;
  prixHT?: number;
  status: string;
  structureId?: string;
  type?: string;
  duree?: string;
  description?: string;
  competences?: string[];
  chargeId: string;
  chargeName: string;
  chargePhotoURL?: string | null;
  startDate?: string;
  endDate?: string;
  company?: string;
  location?: string;
  consultantCount?: number;
  hours?: number;
  createdAt?: any;
  createdBy?: string;
  isPublic: boolean;
  etape: 'Négociation' | 'Recrutement' | 'Facturation' | 'Audit';
  permissions?: {
    viewers: string[];
    editors: string[];
  };
  isArchived?: boolean;
}

interface FirestoreEtudeData {
  numeroEtude: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  consultantCount: number;
  hours: number;
  status: string;
  structureId: string;
  chargeId: string;
  chargeName: string;
  description: string;
  prixHT: number;
  createdAt: any;
  isPublic: boolean;
  etape: 'Négociation' | 'Recrutement' | 'Facturation' | 'Audit';
  permissions?: {
    viewers: string[];
    editors: string[];
  };
}

interface UserData {
  displayName?: string;
  photoURL?: string;
  status?: string;
  structureId?: string;
  email?: string;
}

interface ChargeData {
  id: string;
  displayName: string;
  photoURL?: string;
}

const Etude: React.FC = () => {
  const { currentUser } = useAuth();
  const [userStructureId, setUserStructureId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showNoStructureAlert, setShowNoStructureAlert] = useState(false);
  const [etudes, setEtudes] = useState<EtudeData[]>([]);
  const [filteredEtudes, setFilteredEtudes] = useState<EtudeData[]>([]);
  const [favoriteEtudes, setFavoriteEtudes] = useState<string[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importedData, setImportedData] = useState<EtudeData[]>([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editedData, setEditedData] = useState<EtudeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [etudeToEdit, setEtudeToEdit] = useState<EtudeData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [availableCharges, setAvailableCharges] = useState<ChargeData[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserStructureAndEtudes = async () => {
      if (!currentUser) return;

      try {
        setLoading(true);
        console.log("Début de la récupération des études");
        console.log("UID de l'utilisateur:", currentUser.uid);

        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) {
          console.error("Document utilisateur non trouvé");
          setLoading(false);
          return;
        }

        const userData = userDoc.data();
        console.log("Données complètes de l'utilisateur:", userData);

        const userStatus = userData?.status;
        const userStructureId = userData?.structureId;

        console.log("Données utilisateur:", { 
          userStatus, 
          userStructureId,
          email: userData?.email 
        });

        setUserStructureId(userStructureId);

        if (!userStructureId && userStatus !== 'superadmin') {
          console.error("Aucune structure associée à l'utilisateur");
          setShowNoStructureAlert(true);
          setLoading(false);
          return;
        }

        // Récupération des chargés d'étude de la structure
        const usersRef = collection(db, 'users');
        let usersQuery;
        
        usersQuery = query(
          usersRef,
          where('structureId', '==', userStructureId),
          where('status', 'in', ['member', 'admin', 'superadmin'])
        );

        const usersSnapshot = await getDocs(usersQuery);
        const chargesList = usersSnapshot.docs.map(doc => {
          const userData = doc.data() as UserData;
          return {
            id: doc.id,
            displayName: userData.displayName || 'Utilisateur sans nom',
            photoURL: userData.photoURL
          };
        });
        setAvailableCharges(chargesList);

        const etudesRef = collection(db, 'etudes');
        let etudesQuery;

        console.log("Filtrage des études pour la structure:", userStructureId);
        etudesQuery = query(
          etudesRef,
          where('structureId', '==', userStructureId)
        );

        console.log("Exécution de la requête Firestore");
        const snapshot = await getDocs(etudesQuery);
        console.log("Nombre total d'études trouvées:", snapshot.docs.length);
        
        const etudesData = snapshot.docs.map(doc => {
          const data = doc.data() as FirestoreEtudeData;
          console.log("Étude trouvée:", {
            id: doc.id,
            numeroEtude: data.numeroEtude,
            structureId: data.structureId,
            userStructureId,
            match: data.structureId === userStructureId,
            createdAt: data.createdAt
          });
          return {
            id: doc.id,
            ...data
          } as EtudeData;
        });

        // Trier les études par date de création
        etudesData.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });

        console.log("Études triées:", etudesData.map(e => ({
          id: e.id,
          numeroEtude: e.numeroEtude,
          createdAt: e.createdAt
        })));

        setEtudes(etudesData);
        setLoading(false);
      } catch (error) {
        console.error('Erreur lors de la récupération des études:', error);
        setSnackbar({
          open: true,
          message: 'Erreur lors de la récupération des études',
          severity: 'error'
        });
        setLoading(false);
      }
    };

    fetchUserStructureAndEtudes();
  }, [currentUser]);

  useEffect(() => {
    const loadFavorites = async () => {
      if (!currentUser) return;
      
      try {
        const favoritesDoc = await getDoc(doc(db, 'userFavorites', currentUser.uid));
        if (favoritesDoc.exists()) {
          const favoritesData = favoritesDoc.data();
          setFavoriteEtudes(favoritesData.etudeIds || []);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des favoris:', error);
      }
    };

    loadFavorites();
  }, [currentUser]);

  useEffect(() => {
    let result = [...etudes];
    console.log("Début du filtrage des études. Total initial:", result.length);
    
    if (searchTerm) {
      result = result.filter(etude => 
        etude.numeroEtude.toLowerCase().includes(searchTerm.toLowerCase()) ||
        etude.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        etude.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        etude.chargeName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      console.log("Après filtrage par recherche. Total:", result.length);
    }
    
    if (statusFilter !== 'all') {
      result = result.filter(etude => etude.status === statusFilter);
      console.log("Après filtrage par statut. Total:", result.length);
    }
    
    if (showFavoritesOnly) {
      result = result.filter(etude => favoriteEtudes.includes(etude.id || ''));
      console.log("Après filtrage par favoris. Total:", result.length);
    }

    if (archiveFilter !== 'all') {
      result = result.filter(etude => 
        archiveFilter === 'archived' ? etude.isArchived : !etude.isArchived
      );
      console.log("Après filtrage par archivage. Total:", result.length);
    }
    
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          const dateA = a.startDate ? new Date(a.startDate) : new Date(0);
          const dateB = b.startDate ? new Date(b.startDate) : new Date(0);
          comparison = dateA.getTime() - dateB.getTime();
          break;
        case 'company':
          comparison = (a.company || '').localeCompare(b.company || '');
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'consultantCount':
          comparison = (a.consultantCount || 0) - (b.consultantCount || 0);
          break;
        case 'hours':
          comparison = (a.hours || 0) - (b.hours || 0);
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    console.log("Résultat final après tri. Total:", result.length);
    console.log("Première étude:", result[0]);
    
    setFilteredEtudes(result);
  }, [etudes, searchTerm, statusFilter, sortBy, sortOrder, showFavoritesOnly, favoriteEtudes, archiveFilter]);

  const handleToggleFavorite = async (etudeId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!currentUser) return;
    
    try {
      const isFavorite = favoriteEtudes.includes(etudeId);
      let updatedFavorites: string[];
      
      if (isFavorite) {
        updatedFavorites = favoriteEtudes.filter(id => id !== etudeId);
      } else {
        updatedFavorites = [...favoriteEtudes, etudeId];
      }
      
      setFavoriteEtudes(updatedFavorites);
      
      await setDoc(doc(db, 'userFavorites', currentUser.uid), {
        etudeIds: updatedFavorites,
        updatedAt: new Date(),
      });
      
      setSnackbar({
        open: true,
        message: isFavorite ? 'Étude retirée des favoris' : 'Étude ajoutée aux favoris',
        severity: 'success',
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour des favoris:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour des favoris',
        severity: 'error',
      });
    }
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const etudes = results.data.map((row: any) => ({
          numeroEtude: row.numeroEtude || '',
          company: row.company || '',
          location: row.location || '',
          startDate: row.startDate || '',
          endDate: row.endDate || '',
          consultantCount: parseInt(row.consultantCount) || 0,
          hours: parseInt(row.hours) || 0,
          status: row.status || 'En attente',
          structureId: userStructureId || '',
          chargeId: currentUser?.uid || '',
          chargeName: currentUser?.displayName || '',
          isPublic: true,
          etape: 'Négociation' as const
        }));
        setImportedData(etudes);
      },
      error: (error) => {
        console.error('Erreur lors du parsing du fichier:', error);
        setSnackbar({
          open: true,
          message: 'Erreur lors de la lecture du fichier',
          severity: 'error',
        });
      }
    });
  };

  const handleEditRow = (etude: EtudeData) => {
    setEtudeToEdit(etude);
    setEditDialogOpen(true);
  };

  const handleImportEtude = async () => {
    if (!currentUser || !userStructureId) return;

    try {
      for (const etude of importedData) {
        // Récupérer l'ID de l'entreprise si elle existe
        let companyId: string | undefined;
        if (etude.company) {
          try {
            const companiesRef = collection(db, 'companies');
            const companyQuery = query(companiesRef, where('name', '==', etude.company));
            const companySnapshot = await getDocs(companyQuery);
            
            if (!companySnapshot.empty) {
              companyId = companySnapshot.docs[0].id;
            }
          } catch (error) {
            console.warn('Erreur lors de la récupération de l\'ID de l\'entreprise:', error);
          }
        }

        await addDoc(collection(db, 'etudes'), {
          ...etude,
          companyId: companyId,
          createdAt: new Date(),
          createdBy: currentUser.uid,
          permissions: {
            viewers: [],
            editors: [currentUser.uid]
          }
        });
      }

      setImportDialogOpen(false);
      setImportedData([]);
      setSnackbar({
        open: true,
        message: 'Études importées avec succès',
        severity: 'success',
      });
    } catch (error) {
      console.error('Erreur lors de l\'importation:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de l\'importation des études',
        severity: 'error',
      });
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'numeroEtude',
      'company',
      'location',
      'startDate',
      'endDate',
      'consultantCount',
      'hours',
      'status'
    ];

    const csvContent = [
      headers.join(','),
      'ETUDE001,Entreprise A,Paris,2024-03-01,2024-03-31,3,40,En attente'
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_etudes.csv';
    link.click();
  };

  const handleSaveEdit = async () => {
    if (!etudeToEdit || !etudeToEdit.id) return;

    try {
      await updateDoc(doc(db, 'etudes', etudeToEdit.id), {
        ...etudeToEdit,
        updatedAt: new Date(),
      });

      setEditDialogOpen(false);
      setEtudeToEdit(null);
      setSnackbar({
        open: true,
        message: 'Étude mise à jour avec succès',
        severity: 'success',
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour de l\'étude',
        severity: 'error',
      });
    }
  };

  const handleCancelEdit = () => {
    setEditDialogOpen(false);
    setEtudeToEdit(null);
  };

  const handleEditField = (field: keyof EtudeData, value: any) => {
    if (!etudeToEdit) return;
    setEtudeToEdit({
      ...etudeToEdit,
      [field]: value,
    });
  };

  const handleUpdateEtude = async (etudeId: string, updatedData: Partial<EtudeData>) => {
    try {
      const etudeRef = doc(db, 'etudes', etudeId);
      
      if (updatedData.chargeId) {
        const userDoc = await getDoc(doc(db, 'users', updatedData.chargeId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          updatedData.chargeName = userData.displayName || '';
          updatedData.chargePhotoURL = userData.photoURL || null;
        }
      }

      await updateDoc(etudeRef, updatedData);
      
      setEtudes(prevEtudes => 
        prevEtudes.map(etude => 
          etude.id === etudeId 
            ? { ...etude, ...updatedData }
            : etude
        )
      );

      setSnackbar({
        open: true,
        message: 'Étude mise à jour avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'étude:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour de l\'étude',
        severity: 'error'
      });
    }
  };

  const handleEditEtude = (etude: EtudeData) => {
    setEtudeToEdit(etude);
    setEditDialogOpen(true);
  };

  const handleSaveEtudeEdit = async () => {
    if (!etudeToEdit || !etudeToEdit.id) return;
    
    try {
      await handleUpdateEtude(etudeToEdit.id, etudeToEdit);
      setEditDialogOpen(false);
      setEtudeToEdit(null);
      
      setSnackbar({
        open: true,
        message: `L'étude ${etudeToEdit.numeroEtude} a été mise à jour avec succès.`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'étude:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour de l\'étude',
        severity: 'error'
      });
    }
  };

  const checkEtudeNumberExists = async (numeroEtude: string): Promise<boolean> => {
    const etudeQuery = query(
      collection(db, 'etudes'),
      where('numeroEtude', '==', numeroEtude)
    );
    const etudeSnapshot = await getDocs(etudeQuery);
    return !etudeSnapshot.empty;
  };

  const handleCreateEtude = async (formData: MissionFormData) => {
    try {
      if (!currentUser) return;

      console.log("Début de la création de l'étude avec les données:", formData);
      console.log("Structure ID de l'utilisateur:", userStructureId);

      if (!userStructureId) {
        console.error("Pas de structure ID disponible");
        setSnackbar({
          open: true,
          message: 'Erreur: Aucune structure associée',
          severity: 'error'
        });
        return;
      }

      // Vérifier si le chargé d'étude sélectionné appartient à la structure
      const selectedCharge = availableCharges.find(charge => charge.id === formData.chargeId);
      if (!selectedCharge) {
        setSnackbar({
          open: true,
          message: 'Le chargé d\'étude sélectionné n\'appartient pas à votre structure',
          severity: 'error'
        });
        return;
      }

      const existingEtude = await checkEtudeNumberExists(formData.number);
      if (existingEtude) {
        console.log("Le numéro d'étude existe déjà:", formData.number);
        setSnackbar({
          open: true,
          message: 'Ce numéro d\'étude existe déjà',
          severity: 'error'
        });
        return;
      }

      // Récupérer l'ID de l'entreprise si elle existe
      let companyId: string | undefined;
      if (formData.companyName) {
        try {
          const companiesRef = collection(db, 'companies');
          const companyQuery = query(companiesRef, where('name', '==', formData.companyName));
          const companySnapshot = await getDocs(companyQuery);
          
          if (!companySnapshot.empty) {
            companyId = companySnapshot.docs[0].id;
          }
        } catch (error) {
          console.warn('Erreur lors de la récupération de l\'ID de l\'entreprise:', error);
        }
      }

      const newEtude: EtudeData = {
        numeroEtude: formData.number,
        companyId: companyId,
        company: formData.companyName,
        location: formData.location,
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        consultantCount: formData.studentCount,
        hours: formData.hours || 0,
        status: 'En attente',
        structureId: userStructureId,
        chargeId: formData.chargeId || currentUser.uid,
        chargeName: selectedCharge.displayName,
        chargePhotoURL: selectedCharge.photoURL || null,
        description: formData.description,
        prixHT: formData.priceHT,
        createdAt: new Date(),
        createdBy: currentUser.uid,
        isPublic: true,
        etape: 'Négociation',
        isArchived: false
      };

      console.log("Nouvelle étude à créer:", newEtude);

      const docRef = await addDoc(collection(db, 'etudes'), newEtude);
      console.log("Étude créée avec l'ID:", docRef.id);

      const createdEtude = { ...newEtude, id: docRef.id };
      console.log("Étude créée complète:", createdEtude);

      setEtudes(prev => {
        console.log("Anciennes études:", prev);
        const newEtudes = [...prev, createdEtude];
        console.log("Nouvelles études:", newEtudes);
        return newEtudes;
      });

      setCreateDialogOpen(false);
      
      navigate(`/app/etude/${formData.number}`);

      setSnackbar({
        open: true,
        message: 'Étude créée avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la création de l\'étude:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la création de l\'étude',
        severity: 'error'
      });
    }
  };

  const handleCardClick = (etude: EtudeData) => {
    navigate(`/app/etude/${etude.numeroEtude}`);
  };

  return (
    <Box sx={{ p: 3, bgcolor: '#f5f5f7', minHeight: '100vh' }}>
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 4,
          px: 2 
        }}
      >
        <Typography 
          variant="h4" 
          sx={{ 
            fontWeight: 700,
            mb: 4,
            background: theme => `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: `${fadeIn} 0.5s ease-out`
          }}
        >
          Études
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{
            bgcolor: '#0066cc',
            borderRadius: '0.8rem',
            px: 3,
            py: 1,
            '&:hover': {
              bgcolor: '#0077ed'
            }
          }}
        >
          Ajouter une étude
        </Button>
      </Box>

      <Box sx={{ 
        mb: 3, 
        px: 2,
        display: 'flex',
        gap: 1,
        alignItems: 'center'
      }}>
        <Button
          variant={archiveFilter === 'active' ? 'contained' : 'outlined'}
          onClick={() => setArchiveFilter('active')}
          sx={{
            borderRadius: '20px',
            textTransform: 'none',
            px: 3,
            py: 1,
            bgcolor: archiveFilter === 'active' ? '#0066cc' : 'transparent',
            color: archiveFilter === 'active' ? 'white' : '#1d1d1f',
            borderColor: '#d2d2d7',
            '&:hover': {
              bgcolor: archiveFilter === 'active' ? '#0077ed' : 'rgba(0,0,0,0.04)',
              borderColor: '#1d1d1f'
            }
          }}
        >
          Études en cours
        </Button>
        <Button
          variant={archiveFilter === 'archived' ? 'contained' : 'outlined'}
          onClick={() => setArchiveFilter('archived')}
          sx={{
            borderRadius: '20px',
            textTransform: 'none',
            px: 3,
            py: 1,
            bgcolor: archiveFilter === 'archived' ? '#0066cc' : 'transparent',
            color: archiveFilter === 'archived' ? 'white' : '#1d1d1f',
            borderColor: '#d2d2d7',
            '&:hover': {
              bgcolor: archiveFilter === 'archived' ? '#0077ed' : 'rgba(0,0,0,0.04)',
              borderColor: '#1d1d1f'
            }
          }}
        >
          Études archivées
        </Button>
        <Button
          variant={archiveFilter === 'all' ? 'contained' : 'outlined'}
          onClick={() => setArchiveFilter('all')}
          sx={{
            borderRadius: '20px',
            textTransform: 'none',
            px: 3,
            py: 1,
            bgcolor: archiveFilter === 'all' ? '#0066cc' : 'transparent',
            color: archiveFilter === 'all' ? 'white' : '#1d1d1f',
            borderColor: '#d2d2d7',
            '&:hover': {
              bgcolor: archiveFilter === 'all' ? '#0077ed' : 'rgba(0,0,0,0.04)',
              borderColor: '#1d1d1f'
            }
          }}
        >
          Toutes les études
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress sx={{ color: '#0066cc' }} />
        </Box>
      ) : etudes.length === 0 ? (
        <Paper 
          sx={{ 
            p: 4, 
            textAlign: 'center',
            bgcolor: 'white',
            borderRadius: '1.2rem',
            border: '1px solid #e5e5e7',
            mx: 2
          }}
        >
          <WorkHistoryIcon sx={{ fontSize: 48, color: '#86868b', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#1d1d1f', mb: 1 }}>
            Aucune étude dans votre structure
          </Typography>
          <Typography variant="body1" sx={{ color: '#86868b', mb: 3 }}>
            Commencez par ajouter votre première étude en cliquant sur le bouton ci-dessus.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{
              bgcolor: '#0066cc',
              borderRadius: '0.8rem',
              px: 3,
              py: 1,
              '&:hover': {
                bgcolor: '#0077ed'
              }
            }}
          >
            Ajouter une étude
          </Button>
        </Paper>
      ) : (
        <TableContainer 
          component={Paper} 
          sx={{ 
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}
        >
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f7' }}>
                <TableCell sx={{ 
                  fontWeight: 500,
                  color: '#1d1d1f',
                  borderBottom: '1px solid #d2d2d7'
                }}>Favori</TableCell>
                <TableCell sx={{ 
                  fontWeight: 500,
                  color: '#1d1d1f',
                  borderBottom: '1px solid #d2d2d7'
                }}>Numéro</TableCell>
                <TableCell sx={{ 
                  fontWeight: 500,
                  color: '#1d1d1f',
                  borderBottom: '1px solid #d2d2d7'
                }}>CP</TableCell>
                <TableCell sx={{ 
                  fontWeight: 500,
                  color: '#1d1d1f',
                  borderBottom: '1px solid #d2d2d7'
                }}>Entreprise</TableCell>
                <TableCell sx={{ 
                  fontWeight: 500,
                  color: '#1d1d1f',
                  borderBottom: '1px solid #d2d2d7'
                }}>Localisation</TableCell>
                <TableCell sx={{ 
                  fontWeight: 500,
                  color: '#1d1d1f',
                  borderBottom: '1px solid #d2d2d7'
                }}>Date de début</TableCell>
                <TableCell sx={{ 
                  fontWeight: 500,
                  color: '#1d1d1f',
                  borderBottom: '1px solid #d2d2d7'
                }}>Consultants</TableCell>
                <TableCell sx={{ 
                  fontWeight: 500,
                  color: '#1d1d1f',
                  borderBottom: '1px solid #d2d2d7'
                }}>Heures</TableCell>
                <TableCell sx={{ 
                  fontWeight: 500,
                  color: '#1d1d1f',
                  borderBottom: '1px solid #d2d2d7'
                }}>Statut</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEtudes.map((etude) => (
                <TableRow 
                  key={etude.id}
                  onClick={() => handleCardClick(etude)}
                  sx={{ 
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'rgba(0,0,0,0.02)'
                    },
                    '& td': {
                      borderBottom: '1px solid #f5f5f7',
                      color: '#1d1d1f'
                    }
                  }}
                >
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={(e) => handleToggleFavorite(etude.id || '', e)}
                      sx={{ 
                        color: favoriteEtudes.includes(etude.id || '') ? '#0071e3' : '#86868b',
                        '&:hover': {
                          backgroundColor: 'rgba(0,0,0,0.04)'
                        }
                      }}
                    >
                      {favoriteEtudes.includes(etude.id || '') ? <StarIcon /> : <StarBorderIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell>{etude.numeroEtude}</TableCell>
                                      <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title={etude.chargeName || 'Non assigné'}>
                          <Avatar
                            src={etude.chargePhotoURL}
                            sx={{ 
                              width: 40, 
                              height: 40,
                              border: '2px solid #ffffff',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                              backgroundColor: '#0071e3'
                            }}
                          >
                            {etude.chargeName?.charAt(0)}
                          </Avatar>
                        </Tooltip>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {etude.chargeName || 'Non assigné'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{etude.company}</TableCell>
                    <TableCell>{etude.location}</TableCell>
                    <TableCell>{formatDate(etude.startDate)}</TableCell>
                    <TableCell>{etude.consultantCount || 0}</TableCell>
                    <TableCell>{etude.hours || 0}</TableCell>
                    <TableCell>
                      <Chip
                        label={etude.status}
                        sx={{
                          backgroundColor: 
                            etude.status === 'En cours' ? 'rgba(0,113,227,0.1)' :
                            etude.status === 'Terminé' ? 'rgba(52,199,89,0.1)' :
                            'rgba(255,149,0,0.1)',
                          color:
                            etude.status === 'En cours' ? '#0071e3' :
                            etude.status === 'Terminé' ? '#34C759' :
                            '#FF9500',
                          fontWeight: 500,
                          borderRadius: '6px'
                        }}
                      />
                    </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Importer des études</DialogTitle>
        <DialogContent>
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={downloadTemplate}
              >
                Télécharger le modèle CSV
              </Button>
              <Typography variant="body2" color="textSecondary">
                ou
              </Typography>
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".csv"
                style={{ flexGrow: 1 }}
              />
            </Box>
            
            {importedData.length > 0 && (
              <TableContainer component={Paper} sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Numéro</TableCell>
                      <TableCell>Nom CP</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Lieu</TableCell>
                      <TableCell>Entreprise</TableCell>
                      <TableCell>Prix HT</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importedData.map((data, index) => (
                      <TableRow key={index}>
                        {editingRow === index ? (
                          <>
                            <TableCell>
                              <TextField
                                size="small"
                                value={editedData?.numeroEtude || ''}
                                onChange={(e) => handleEditField('numeroEtude', e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                value={editedData?.nomConsultant || ''}
                                onChange={(e) => handleEditField('nomConsultant', e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                type="date"
                                value={editedData?.date || ''}
                                onChange={(e) => handleEditField('date', e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                value={editedData?.lieu || ''}
                                onChange={(e) => handleEditField('lieu', e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                value={editedData?.entreprise || ''}
                                onChange={(e) => handleEditField('entreprise', e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                type="number"
                                value={editedData?.prixHT || 0}
                                onChange={(e) => handleEditField('prixHT', e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Tooltip title="Sauvegarder">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSaveEdit();
                                    }}
                                    color="primary"
                                  >
                                    <SaveIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Annuler">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCancelEdit();
                                    }}
                                    color="error"
                                  >
                                    <CancelIcon />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>{data.numeroEtude}</TableCell>
                            <TableCell>{data.nomConsultant}</TableCell>
                            <TableCell>{data.date}</TableCell>
                            <TableCell>{data.lieu}</TableCell>
                            <TableCell>{data.entreprise}</TableCell>
                            <TableCell>{`${data.prixHT?.toFixed(2) || '0.00'} €`}</TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Tooltip title="Modifier">
                                  <IconButton
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditRow(data);
                                    }}
                                  >
                                    <EditIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Importer">
                                  <IconButton
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleImportEtude();
                                    }}
                                  >
                                    <SaveIcon />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Modifier l'étude</DialogTitle>
        <DialogContent>
          {etudeToEdit && (
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Numéro d'étude"
                value={etudeToEdit.numeroEtude}
                onChange={(e) => setEtudeToEdit({ ...etudeToEdit, numeroEtude: e.target.value })}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Nom du CP"
                value={etudeToEdit.nomConsultant}
                onChange={(e) => setEtudeToEdit({ ...etudeToEdit, nomConsultant: e.target.value })}
                fullWidth
                margin="normal"
                helperText="Entrez le nom complet du CP (prénom et nom)"
              />
              <TextField
                label="Date"
                type="date"
                value={etudeToEdit.date}
                onChange={(e) => setEtudeToEdit({ ...etudeToEdit, date: e.target.value })}
                fullWidth
                margin="normal"
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Lieu"
                value={etudeToEdit.lieu}
                onChange={(e) => setEtudeToEdit({ ...etudeToEdit, lieu: e.target.value })}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Entreprise"
                value={etudeToEdit.entreprise}
                onChange={(e) => setEtudeToEdit({ ...etudeToEdit, entreprise: e.target.value })}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Prix HT"
                type="number"
                value={etudeToEdit.prixHT}
                onChange={(e) => setEtudeToEdit({ ...etudeToEdit, prixHT: parseFloat(e.target.value) || 0 })}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Statut"
                select
                value={etudeToEdit.status}
                onChange={(e) => setEtudeToEdit({ ...etudeToEdit, status: e.target.value })}
                fullWidth
                margin="normal"
                SelectProps={{
                  native: true,
                }}
              >
                <option value="En attente">En attente</option>
                <option value="En cours">En cours</option>
                <option value="Terminé">Terminé</option>
              </TextField>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleSaveEtudeEdit} variant="contained" color="primary">
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Créer une nouvelle étude</DialogTitle>
        <DialogContent>
          <MissionForm 
            onSubmit={handleCreateEtude}
            onCancel={() => setCreateDialogOpen(false)}
            availableCharges={availableCharges}
          />
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          severity={snackbar.severity} 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Etude;
