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

// Fonction pour générer les mandats disponibles (2022-2023 jusqu'à l'année en cours)
const generateMandats = (): string[] => {
  const currentYear = new Date().getFullYear();
  const startYear = 2022;
  const mandats: string[] = [];
  
  for (let year = startYear; year <= currentYear; year++) {
    const nextYear = year + 1;
    mandats.push(`${year}-${nextYear}`);
  }
  
  return mandats;
};

const AVAILABLE_MANDATS = generateMandats();

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

interface MissionData {
  id?: string;
  numeroMission: string;
  nomCDM?: string;
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
  companyId?: string;
  location?: string;
  studentCount?: number;
  hours?: number;
  createdAt?: any;
  createdBy?: string;
  isPublic: boolean;
  etape: 'Négociation' | 'Recrutement' | 'Date de mission' | 'Facturation' | 'Audit' | 'Archivé';
  permissions?: {
    viewers: string[];
    editors: string[];
  };
  isArchived?: boolean;
  mandat?: string; // Format: "2022-2023", "2023-2024", etc.
}

interface FirestoreMissionData {
  numeroMission: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  studentCount: number;
  hours: number;
  status: string;
  structureId: string;
  chargeId: string;
  chargeName: string;
  description: string;
  prixHT: number;
  createdAt: any;
  isPublic: boolean;
  etape: 'Négociation' | 'Recrutement' | 'Date de mission' | 'Facturation' | 'Audit' | 'Archivé';
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

const Mission: React.FC = () => {
  const { currentUser } = useAuth();
  const [userStructureId, setUserStructureId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showNoStructureAlert, setShowNoStructureAlert] = useState(false);
  const [missions, setMissions] = useState<MissionData[]>([]);
  const [filteredMissions, setFilteredMissions] = useState<MissionData[]>([]);
  const [favoriteMissions, setFavoriteMissions] = useState<string[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importedData, setImportedData] = useState<MissionData[]>([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editedData, setEditedData] = useState<MissionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [missionToEdit, setMissionToEdit] = useState<MissionData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [mandatFilter, setMandatFilter] = useState<string>('all');
  const [availableCharges, setAvailableCharges] = useState<ChargeData[]>([]);
  const [generatedMissionNumber, setGeneratedMissionNumber] = useState<string>('');
  const [isGeneratingMissionNumber, setIsGeneratingMissionNumber] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserStructureAndMissions = async () => {
      if (!currentUser) return;

      try {
        setLoading(true);
        console.log("Début de la récupération des missions");
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

        // Récupération des chargés de mission de la structure
        const usersRef = collection(db, 'users');
        let usersQuery;
        
        // Pour tous les utilisateurs, on récupère uniquement les utilisateurs de leur structure
        // avec les rôles membres, admins et superadmins
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

        const missionsRef = collection(db, 'missions');
        let missionsQuery;

        console.log("Filtrage des missions pour la structure:", userStructureId);
        missionsQuery = query(
          missionsRef,
          where('structureId', '==', userStructureId)
        );

        console.log("Exécution de la requête Firestore");
        const snapshot = await getDocs(missionsQuery);
        console.log("Nombre total de missions trouvées:", snapshot.docs.length);
        
        const missionsData = snapshot.docs.map(doc => {
          const data = doc.data() as FirestoreMissionData;
          console.log("Mission trouvée:", {
            id: doc.id,
            numeroMission: data.numeroMission,
            structureId: data.structureId,
            userStructureId,
            match: data.structureId === userStructureId,
            createdAt: data.createdAt
          });
          return {
            id: doc.id,
            ...data
          } as MissionData;
        });

        // Trier les missions par date de création
        missionsData.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });

        console.log("Missions triées:", missionsData.map(m => ({
          id: m.id,
          numeroMission: m.numeroMission,
          createdAt: m.createdAt
        })));

        setMissions(missionsData);
        setLoading(false);
      } catch (error) {
        console.error('Erreur lors de la récupération des missions:', error);
        setSnackbar({
          open: true,
          message: 'Erreur lors de la récupération des missions',
          severity: 'error'
        });
        setLoading(false);
      }
    };

    fetchUserStructureAndMissions();
  }, [currentUser]);

  useEffect(() => {
    const loadFavorites = async () => {
      if (!currentUser) return;
      
      try {
        const favoritesDoc = await getDoc(doc(db, 'userFavorites', currentUser.uid));
        if (favoritesDoc.exists()) {
          const favoritesData = favoritesDoc.data();
          setFavoriteMissions(favoritesData.missionIds || []);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des favoris:', error);
      }
    };

    loadFavorites();
  }, [currentUser]);

  // Générer le numéro de mission si le dialogue est ouvert et que userStructureId est disponible
  useEffect(() => {
    const generateMissionNumber = async () => {
      if (createDialogOpen && userStructureId && !generatedMissionNumber && !isGeneratingMissionNumber) {
        setIsGeneratingMissionNumber(true);
        try {
          const missionNumber = await generateNextMissionNumber(userStructureId);
          setGeneratedMissionNumber(missionNumber);
        } catch (error) {
          console.error('Erreur lors de la génération du numéro de mission:', error);
        } finally {
          setIsGeneratingMissionNumber(false);
        }
      }
    };

    generateMissionNumber();
  }, [createDialogOpen, userStructureId]);

  useEffect(() => {
    let result = [...missions];
    console.log("Début du filtrage des missions. Total initial:", result.length);
    
    if (searchTerm) {
      result = result.filter(mission => 
        mission.numeroMission.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mission.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mission.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mission.chargeName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      console.log("Après filtrage par recherche. Total:", result.length);
    }
    
    if (statusFilter !== 'all') {
      result = result.filter(mission => mission.status === statusFilter);
      console.log("Après filtrage par statut. Total:", result.length);
    }
    
    if (showFavoritesOnly) {
      result = result.filter(mission => favoriteMissions.includes(mission.id || ''));
      console.log("Après filtrage par favoris. Total:", result.length);
    }

    if (archiveFilter !== 'all') {
      result = result.filter(mission => 
        archiveFilter === 'archived' ? mission.isArchived : !mission.isArchived
      );
      console.log("Après filtrage par archivage. Total:", result.length);
    }

    if (mandatFilter !== 'all') {
      result = result.filter(mission => mission.mandat === mandatFilter);
      console.log("Après filtrage par mandat. Total:", result.length);
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
        case 'studentCount':
          comparison = (a.studentCount || 0) - (b.studentCount || 0);
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
    console.log("Première mission:", result[0]);
    
    setFilteredMissions(result);
  }, [missions, searchTerm, statusFilter, sortBy, sortOrder, showFavoritesOnly, favoriteMissions, archiveFilter, mandatFilter]);

  const handleToggleFavorite = async (missionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!currentUser) return;
    
    try {
      const isFavorite = favoriteMissions.includes(missionId);
      let updatedFavorites: string[];
      
      if (isFavorite) {
        updatedFavorites = favoriteMissions.filter(id => id !== missionId);
      } else {
        updatedFavorites = [...favoriteMissions, missionId];
      }
      
      setFavoriteMissions(updatedFavorites);
      
      await setDoc(doc(db, 'userFavorites', currentUser.uid), {
        missionIds: updatedFavorites,
        updatedAt: new Date(),
      });
      
      setSnackbar({
        open: true,
        message: isFavorite ? 'Mission retirée des favoris' : 'Mission ajoutée aux favoris',
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
        const missions = results.data.map((row: any) => ({
          numeroMission: row.numeroMission || '',
          company: row.company || '',
          location: row.location || '',
          startDate: row.startDate || '',
          endDate: row.endDate || '',
          studentCount: parseInt(row.studentCount) || 0,
          hours: parseInt(row.hours) || 0,
          status: row.status || 'En attente',
          structureId: userStructureId || '',
          chargeId: currentUser?.uid || '',
          chargeName: currentUser?.displayName || '',
          isPublic: true,
          etape: 'Négociation' as const
        }));
        setImportedData(missions);
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

  const handleEditRow = (mission: MissionData) => {
    setMissionToEdit(mission);
    setEditDialogOpen(true);
  };

  const handleImportMission = async () => {
    if (!currentUser || !userStructureId) return;

    try {
      for (const mission of importedData) {
        await addDoc(collection(db, 'missions'), {
          ...mission,
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
        message: 'Missions importées avec succès',
        severity: 'success',
      });
    } catch (error) {
      console.error('Erreur lors de l\'importation:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de l\'importation des missions',
        severity: 'error',
      });
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'numeroMission',
      'company',
      'location',
      'startDate',
      'endDate',
      'studentCount',
      'hours',
      'status'
    ];

    const csvContent = [
      headers.join(','),
      'MISSION001,Entreprise A,Paris,2024-03-01,2024-03-31,20,40,En attente'
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_missions.csv';
    link.click();
  };

  const handleSaveEdit = async () => {
    if (!missionToEdit || !missionToEdit.id) return;

    try {
      await updateDoc(doc(db, 'missions', missionToEdit.id), {
        ...missionToEdit,
        updatedAt: new Date(),
      });

      setEditDialogOpen(false);
      setMissionToEdit(null);
      setSnackbar({
        open: true,
        message: 'Mission mise à jour avec succès',
        severity: 'success',
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour de la mission',
        severity: 'error',
      });
    }
  };

  const handleCancelEdit = () => {
    setEditDialogOpen(false);
    setMissionToEdit(null);
  };

  const handleEditField = (field: keyof MissionData, value: any) => {
    if (!missionToEdit) return;
    setMissionToEdit({
      ...missionToEdit,
      [field]: value,
    });
  };

  const handleUpdateMission = async (missionId: string, updatedData: Partial<MissionData>) => {
    try {
      const missionRef = doc(db, 'missions', missionId);
      
      if (updatedData.chargeId) {
        const userDoc = await getDoc(doc(db, 'users', updatedData.chargeId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          updatedData.chargeName = userData.displayName || '';
          updatedData.chargePhotoURL = userData.photoURL || null;
          // Récupérer le mandat du chargé de mission
          updatedData.mandat = userData.mandat || undefined;
        }
      }

      await updateDoc(missionRef, updatedData);
      
      setMissions(prevMissions => 
        prevMissions.map(mission => 
          mission.id === missionId 
            ? { ...mission, ...updatedData }
            : mission
        )
      );

      setSnackbar({
        open: true,
        message: 'Mission mise à jour avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la mission:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour de la mission',
        severity: 'error'
      });
    }
  };

  const handleEditMission = (mission: MissionData) => {
    setMissionToEdit(mission);
    setEditDialogOpen(true);
  };

  const handleSaveMissionEdit = async () => {
    if (!missionToEdit || !missionToEdit.id) return;
    
    try {
      await handleUpdateMission(missionToEdit.id, missionToEdit);
      setEditDialogOpen(false);
      setMissionToEdit(null);
      
      setSnackbar({
        open: true,
        message: `La mission ${missionToEdit.numeroMission} a été mise à jour avec succès.`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la mission:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour de la mission',
        severity: 'error'
      });
    }
  };

  const checkMissionNumberExists = async (numeroMission: string): Promise<boolean> => {
    const missionQuery = query(
      collection(db, 'missions'),
      where('numeroMission', '==', numeroMission)
    );
    const missionSnapshot = await getDocs(missionQuery);
    return !missionSnapshot.empty;
  };

  const generateNextMissionNumber = async (structureId: string): Promise<string> => {
    try {
      // Obtenir la date actuelle
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1; // getMonth() retourne 0-11, donc on ajoute 1
      
      // Format: YY (2 derniers chiffres de l'année)
      const yearStr = year.toString().slice(-2);
      // Format: MM (mois avec 2 chiffres)
      const monthStr = month.toString().padStart(2, '0');
      
      // Récupérer toutes les missions de la structure
      const missionsRef = collection(db, 'missions');
      const missionsQuery = query(
        missionsRef,
        where('structureId', '==', structureId)
      );
      const missionsSnapshot = await getDocs(missionsQuery);
      
      // Filtrer les missions du mois en cours qui suivent le format YYMMNN
      const currentMonthPrefix = `${yearStr}${monthStr}`;
      const currentMonthMissions = missionsSnapshot.docs
        .map(doc => doc.data().numeroMission as string)
        .filter(numero => {
          // Vérifier si le numéro commence par le préfixe du mois en cours
          return numero && numero.length === 6 && numero.startsWith(currentMonthPrefix);
        });
      
      // Extraire les numéros séquentiels (les 2 derniers chiffres)
      const missionNumbers = currentMonthMissions
        .map(numero => {
          const sequenceNumber = parseInt(numero.slice(-2), 10);
          return isNaN(sequenceNumber) ? 0 : sequenceNumber;
        })
        .filter(num => num > 0)
        .sort((a, b) => b - a); // Trier par ordre décroissant
      
      // Le prochain numéro séquentiel est le maximum + 1, ou 1 si aucune mission
      const nextSequenceNumber = missionNumbers.length > 0 
        ? missionNumbers[0] + 1 
        : 1;
      
      // Formater le numéro séquentiel avec 2 chiffres
      const sequenceStr = nextSequenceNumber.toString().padStart(2, '0');
      
      // Générer le numéro final: YYMMNN
      const nextMissionNumber = `${yearStr}${monthStr}${sequenceStr}`;
      
      console.log(`Numéro de mission généré: ${nextMissionNumber} (${currentMonthMissions.length} missions ce mois)`);
      
      return nextMissionNumber;
    } catch (error) {
      console.error('Erreur lors de la génération du numéro de mission:', error);
      // En cas d'erreur, retourner un numéro par défaut basé sur la date
      const now = new Date();
      const yearStr = now.getFullYear().toString().slice(-2);
      const monthStr = (now.getMonth() + 1).toString().padStart(2, '0');
      return `${yearStr}${monthStr}01`;
    }
  };

  const handleCreateMission = async (formData: MissionFormData) => {
    try {
      if (!currentUser) return;

      console.log("Début de la création de la mission avec les données:", formData);
      console.log("Structure ID de l'utilisateur:", userStructureId);
      console.log("CompanyId reçu:", formData.companyId);
      console.log("CompanyName reçu:", formData.companyName);

      if (!userStructureId) {
        console.error("Pas de structure ID disponible");
        setSnackbar({
          open: true,
          message: 'Erreur: Aucune structure associée',
          severity: 'error'
        });
        return;
      }

      // Vérifier si le chargé de mission sélectionné appartient à la structure
      const selectedCharge = availableCharges.find(charge => charge.id === formData.chargeId);
      if (!selectedCharge) {
        setSnackbar({
          open: true,
          message: 'Le chargé de mission sélectionné n\'appartient pas à votre structure',
          severity: 'error'
        });
        return;
      }

      // Récupérer le mandat du chargé de mission
      let missionMandat: string | undefined;
      if (formData.chargeId) {
        try {
          const chargeDoc = await getDoc(doc(db, 'users', formData.chargeId));
          if (chargeDoc.exists()) {
            const chargeData = chargeDoc.data();
            missionMandat = chargeData.mandat || undefined;
          }
        } catch (error) {
          console.error('Erreur lors de la récupération du mandat du chargé de mission:', error);
        }
      }

      const existingMission = await checkMissionNumberExists(formData.number);
      if (existingMission) {
        console.log("Le numéro de mission existe déjà:", formData.number);
        setSnackbar({
          open: true,
          message: 'Ce numéro de mission existe déjà',
          severity: 'error'
        });
        return;
      }

      const newMission: MissionData = {
        numeroMission: formData.number,
        company: formData.companyName,
        companyId: formData.companyId,
        location: formData.location,
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        studentCount: formData.studentCount,
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
        isArchived: false,
        mandat: missionMandat
      };

      console.log("Nouvelle mission à créer:", newMission);

      const docRef = await addDoc(collection(db, 'missions'), newMission);
      console.log("Mission créée avec l'ID:", docRef.id);

      const createdMission = { ...newMission, id: docRef.id };
      console.log("Mission créée complète:", createdMission);

      setMissions(prev => {
        console.log("Anciennes missions:", prev);
        const newMissions = [...prev, createdMission];
        console.log("Nouvelles missions:", newMissions);
        return newMissions;
      });

      setCreateDialogOpen(false);
      
      navigate(`/app/mission/${docRef.id}`);

      setSnackbar({
        open: true,
        message: 'Mission créée avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la création de la mission:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la création de la mission',
        severity: 'error'
      });
    }
  };

  const handleCardClick = (mission: MissionData) => {
    navigate(`/app/mission/${mission.id}`);
  };

  const handleOpenCreateDialog = async () => {
    setCreateDialogOpen(true);
    if (userStructureId) {
      setIsGeneratingMissionNumber(true);
      try {
        const missionNumber = await generateNextMissionNumber(userStructureId);
        setGeneratedMissionNumber(missionNumber);
      } catch (error) {
        console.error('Erreur lors de la génération du numéro de mission:', error);
        setGeneratedMissionNumber('');
      } finally {
        setIsGeneratingMissionNumber(false);
      }
    }
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setGeneratedMissionNumber('');
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
          Missions
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreateDialog}
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
          Ajouter une mission
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
          Missions en cours
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
          Missions archivées
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
          Toutes les missions
        </Button>
        <FormControl 
          size="small" 
          sx={{ 
            minWidth: 150,
            ml: 2
          }}
        >
          <InputLabel>Mandat</InputLabel>
          <Select
            value={mandatFilter}
            label="Mandat"
            onChange={(e) => setMandatFilter(e.target.value)}
            sx={{
              borderRadius: '20px',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#d2d2d7',
              },
            }}
          >
            <MenuItem value="all">Tous les mandats</MenuItem>
            {AVAILABLE_MANDATS.map(mandat => (
              <MenuItem key={mandat} value={mandat}>
                {mandat}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress sx={{ color: '#0066cc' }} />
        </Box>
      ) : missions.length === 0 ? (
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
            Aucune mission dans votre structure
          </Typography>
          <Typography variant="body1" sx={{ color: '#86868b', mb: 3 }}>
            Commencez par ajouter votre première mission en cliquant sur le bouton ci-dessus.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateDialog}
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
            Ajouter une mission
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
                }}>CDM</TableCell>
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
                }}>Étudiants</TableCell>
                <TableCell sx={{ 
                  fontWeight: 500,
                  color: '#1d1d1f',
                  borderBottom: '1px solid #d2d2d7'
                }}>Heures</TableCell>
                <TableCell sx={{ 
                  fontWeight: 500,
                  color: '#1d1d1f',
                  borderBottom: '1px solid #d2d2d7'
                }}>Étape</TableCell>
                <TableCell sx={{ 
                  fontWeight: 500,
                  color: '#1d1d1f',
                  borderBottom: '1px solid #d2d2d7'
                }}>Mandat</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMissions.map((mission) => (
                <TableRow 
                  key={mission.id}
                  onClick={() => handleCardClick(mission)}
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
                      onClick={(e) => handleToggleFavorite(mission.id || '', e)}
                      sx={{ 
                        color: favoriteMissions.includes(mission.id || '') ? '#0071e3' : '#86868b',
                        '&:hover': {
                          backgroundColor: 'rgba(0,0,0,0.04)'
                        }
                      }}
                    >
                      {favoriteMissions.includes(mission.id || '') ? <StarIcon /> : <StarBorderIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell>{mission.numeroMission}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Tooltip title={mission.chargeName || 'Non assigné'}>
                        <Avatar
                          src={mission.chargePhotoURL}
                          sx={{ 
                            width: 40, 
                            height: 40,
                            border: '2px solid #ffffff',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            backgroundColor: '#0071e3'
                          }}
                        >
                          {mission.chargeName?.charAt(0)}
                        </Avatar>
                      </Tooltip>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {mission.chargeName || 'Non assigné'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{mission.company}</TableCell>
                  <TableCell>{mission.location}</TableCell>
                  <TableCell>{formatDate(mission.startDate)}</TableCell>
                  <TableCell>{mission.studentCount || 0}</TableCell>
                  <TableCell>{mission.hours || 0}</TableCell>
                  <TableCell>
                    <Chip
                      label={mission.isArchived ? 'Archivé' : (mission.etape || 'Négociation')}
                      sx={{
                        backgroundColor: 
                          mission.isArchived ? 'rgba(142,142,147,0.1)' :
                          mission.etape === 'Négociation' ? 'rgba(255,149,0,0.1)' :
                          mission.etape === 'Recrutement' ? 'rgba(0,113,227,0.1)' :
                          mission.etape === 'Date de mission' ? 'rgba(88,86,214,0.1)' :
                          mission.etape === 'Facturation' ? 'rgba(255,204,0,0.1)' :
                          mission.etape === 'Audit' ? 'rgba(52,199,89,0.1)' :
                          'rgba(142,142,147,0.1)',
                        color:
                          mission.isArchived ? '#8E8E93' :
                          mission.etape === 'Négociation' ? '#FF9500' :
                          mission.etape === 'Recrutement' ? '#0071e3' :
                          mission.etape === 'Date de mission' ? '#5856D6' :
                          mission.etape === 'Facturation' ? '#FFCC00' :
                          mission.etape === 'Audit' ? '#34C759' :
                          '#8E8E93',
                        fontWeight: 500,
                        borderRadius: '6px'
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {mission.mandat ? (
                      <Chip
                        label={mission.mandat}
                        size="small"
                        sx={{
                          backgroundColor: 'rgba(0, 102, 204, 0.1)',
                          color: '#0066cc',
                          fontWeight: 500,
                          borderRadius: '6px'
                        }}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Non défini
                      </Typography>
                    )}
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
        <DialogTitle>Importer des missions</DialogTitle>
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
                      <TableCell>Nom CDM</TableCell>
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
                                value={editedData?.numeroMission || ''}
                                onChange={(e) => handleEditField('numeroMission', e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                value={editedData?.nomCDM || ''}
                                onChange={(e) => handleEditField('nomCDM', e.target.value)}
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
                            <TableCell>{data.numeroMission}</TableCell>
                            <TableCell>{data.nomCDM}</TableCell>
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
                                      handleImportMission();
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
        <DialogTitle>Modifier la mission</DialogTitle>
        <DialogContent>
          {missionToEdit && (
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Numéro de mission"
                value={missionToEdit.numeroMission}
                onChange={(e) => setMissionToEdit({ ...missionToEdit, numeroMission: e.target.value })}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Nom du CDM"
                value={missionToEdit.nomCDM}
                onChange={(e) => setMissionToEdit({ ...missionToEdit, nomCDM: e.target.value })}
                fullWidth
                margin="normal"
                helperText="Entrez le nom complet du CDM (prénom et nom)"
              />
              <TextField
                label="Date"
                type="date"
                value={missionToEdit.date}
                onChange={(e) => setMissionToEdit({ ...missionToEdit, date: e.target.value })}
                fullWidth
                margin="normal"
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Lieu"
                value={missionToEdit.lieu}
                onChange={(e) => setMissionToEdit({ ...missionToEdit, lieu: e.target.value })}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Entreprise"
                value={missionToEdit.entreprise}
                onChange={(e) => setMissionToEdit({ ...missionToEdit, entreprise: e.target.value })}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Prix HT"
                type="number"
                value={missionToEdit.prixHT}
                onChange={(e) => setMissionToEdit({ ...missionToEdit, prixHT: parseFloat(e.target.value) || 0 })}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Statut"
                select
                value={missionToEdit.status}
                onChange={(e) => setMissionToEdit({ ...missionToEdit, status: e.target.value })}
                fullWidth
                margin="normal"
                SelectProps={{
                  native: true,
                }}
              >
                <option value="En attente">En attente</option>
                <option value="En cours">En cours</option>
                <option value="Terminée">Terminée</option>
              </TextField>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleSaveMissionEdit} variant="contained" color="primary">
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={createDialogOpen}
        onClose={handleCloseCreateDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Créer une nouvelle mission</DialogTitle>
        <DialogContent>
          <MissionForm 
            onSubmit={handleCreateMission}
            onCancel={handleCloseCreateDialog}
            availableCharges={availableCharges}
            initialData={{
              number: generatedMissionNumber
            }}
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

export default Mission; 