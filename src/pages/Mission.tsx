import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  DialogContent,
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
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
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
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { doc, getDoc, collection, addDoc, query, where, getDocs, updateDoc, setDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import MissionForm, { MissionFormData } from '../components/missions/MissionForm';
import { canAccessStructureContent, canModifyStructureContent } from '../utils/permissions';
import { decryptUsersList, getDecryptedUserDisplayName, getSafeDisplayName } from '../utils/decryptUserUtils';
import { usePermission } from '../hooks/usePermission';
import AccessDenied from '../components/common/AccessDenied';
import { tokens } from '../theme/tokens';
import LoadingState from '../components/common/LoadingState';
import { fadeIn } from '../styles/animations';
import MissionsListPage, { type MissionListRow } from './missions/MissionsListPage';

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

interface MissionData {
  id?: string;
  numeroMission: string;
  nomCDM?: string;
  date?: string;
  lieu?: string;
  entreprise?: string;
  prixHT?: number;
  priceHT?: number;
  totalHT?: number;
  totalTTC?: number;
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

/** Total TTC = prix horaire HT × heures × 1,2 (TVA 20 %), hors notes de frais. */
const getMissionTotalTTC = (m: MissionData): number | undefined => {
  if (typeof m.totalTTC === 'number' && m.totalTTC > 0) return m.totalTTC;
  const hourly = m.priceHT ?? m.prixHT;
  const hours = m.hours;
  if (typeof hourly !== 'number' || hourly <= 0 || typeof hours !== 'number' || hours <= 0) {
    return undefined;
  }
  const totalHT = hourly * hours;
  return Math.round(totalHT * 1.2 * 100) / 100;
};

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
  firstName?: string;
  lastName?: string;
  photoURL?: string;
  status?: string;
  structureId?: string;
  email?: string;
}

interface ChargeData {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
}

const Mission: React.FC = () => {
  const { currentUser, userData: authUserData, loading: authLoading } = useAuth();
  const { canRead, canWrite, loading: permissionLoading } = usePermission('mission');
  const [userStructureId, setUserStructureId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  // structureId effectif (state ou auth) pour créer des missions (admin doit toujours avoir structureId)
  const effectiveStructureId = userStructureId ?? authUserData?.structureId ?? null;
  const [showNoStructureAlert, setShowNoStructureAlert] = useState(false);
  const [missions, setMissions] = useState<MissionData[]>([]);
  const [filteredMissions, setFilteredMissions] = useState<MissionData[]>([]);
  const [favoriteMissions, setFavoriteMissions] = useState<string[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });
  const [loading, setLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [missionToEdit, setMissionToEdit] = useState<MissionData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('numeroMission');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [mandatFilter, setMandatFilter] = useState<string>('all');
  const [availableCharges, setAvailableCharges] = useState<ChargeData[]>([]);
  const [generatedMissionNumber, setGeneratedMissionNumber] = useState<string>('');
  const [isGeneratingMissionNumber, setIsGeneratingMissionNumber] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMissions = async () => {
      if (authLoading || !currentUser || !authUserData) return;

      const userStatus = authUserData.status;
      const structureId = authUserData.structureId as string | undefined;

      setUserStructureId(structureId ?? null);

      if (!structureId && userStatus !== 'superadmin') {
        setShowNoStructureAlert(true);
        setLoading(false);
        return;
      }

      if (!structureId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const missionsQuery = query(
          collection(db, 'missions'),
          where('structureId', '==', structureId)
        );

        const [missionsSnapshot, favoritesDoc] = await Promise.all([
          getDocs(missionsQuery),
          getDoc(doc(db, 'userFavorites', currentUser.uid)).catch(() => null),
        ]);

        const missionsData = missionsSnapshot.docs
          .map((missionDoc) => {
            const data = missionDoc.data() as FirestoreMissionData;
            return { id: missionDoc.id, ...data } as MissionData;
          })
          .sort((a, b) =>
            String(b.numeroMission || '').localeCompare(String(a.numeroMission || ''), 'fr', { numeric: true })
          );

        // Résoudre les noms d'entreprise manquants / "Organisation inconnue" via companyId
        const companyIdsToResolve = Array.from(
          new Set(
            missionsData
              .filter(
                (m) =>
                  m.companyId &&
                  (!(m.company || '').trim() || m.company === 'Organisation inconnue')
              )
              .map((m) => m.companyId as string)
          )
        );
        if (companyIdsToResolve.length > 0) {
          const nameById = new Map<string, string>();
          await Promise.all(
            companyIdsToResolve.map(async (companyId) => {
              try {
                const snap = await getDoc(doc(db, 'companies', companyId));
                if (snap.exists()) {
                  const name = (snap.data()?.name as string | undefined)?.trim();
                  if (name) nameById.set(companyId, name);
                }
              } catch {
                // ignore
              }
            })
          );
          if (nameById.size > 0) {
            for (const m of missionsData) {
              if (!m.companyId) continue;
              const resolved = nameById.get(m.companyId);
              if (
                resolved &&
                (!(m.company || '').trim() || m.company === 'Organisation inconnue')
              ) {
                m.company = resolved;
              }
            }
          }
        }

        setMissions(missionsData);

        if (favoritesDoc?.exists()) {
          setFavoriteMissions(favoritesDoc.data().missionIds || []);
        }

        // Déchiffrement en arrière-plan (recherche/filtres + cache partagé avec UserNameText)
        const encryptedCharges = Array.from(
          new Map(
            missionsData
              .filter((m) => m.chargeId && m.chargeName?.startsWith?.('ENC:'))
              .map((m) => [m.chargeId, { id: m.chargeId, displayName: m.chargeName }])
          ).values()
        );
        if (encryptedCharges.length > 0) {
          void decryptUsersList(encryptedCharges).then((decrypted) => {
            const nameById = new Map(decrypted.map((u) => [u.id, u.displayName]));
            setMissions((prev) =>
              prev.map((m) => {
                const name = nameById.get(m.chargeId);
                return name ? { ...m, chargeName: name } : m;
              })
            );
          });
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des missions:', error);
        setSnackbar({
          open: true,
          message: 'Erreur lors de la récupération des missions',
          severity: 'error',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMissions();
  }, [currentUser, authLoading, authUserData]);

  // Chargés de mission : chargés à la demande (création de mission uniquement)
  useEffect(() => {
    if (!createDialogOpen || !effectiveStructureId || availableCharges.length > 0) return;

    let cancelled = false;
    const loadCharges = async () => {
      try {
        const usersSnapshot = await getDocs(
          query(
            collection(db, 'users'),
            where('structureId', '==', effectiveStructureId),
            where('status', 'in', ['membre', 'admin', 'superadmin'])
          )
        );
        if (cancelled) return;

        const chargesListRaw = usersSnapshot.docs.map((userDoc) => {
          const data = userDoc.data() as UserData;
          return {
            id: userDoc.id,
            displayName: data.displayName || 'Utilisateur sans nom',
            firstName: data.firstName,
            lastName: data.lastName,
            photoURL: data.photoURL,
          };
        });

        const decryptedCharges = await decryptUsersList(chargesListRaw);
        if (!cancelled) setAvailableCharges(decryptedCharges);
      } catch (error) {
        console.error('Erreur lors du chargement des chargés de mission:', error);
      }
    };

    void loadCharges();
    return () => {
      cancelled = true;
    };
  }, [createDialogOpen, effectiveStructureId, availableCharges.length]);

  // Générer le numéro de mission si le dialogue est ouvert et que userStructureId est disponible
  useEffect(() => {
    const generateMissionNumber = async () => {
      if (createDialogOpen && effectiveStructureId && !generatedMissionNumber && !isGeneratingMissionNumber) {
        setIsGeneratingMissionNumber(true);
        try {
          const missionNumber = await generateNextMissionNumber(effectiveStructureId);
          setGeneratedMissionNumber(missionNumber);
        } catch (error) {
          console.error('Erreur lors de la génération du numéro de mission:', error);
        } finally {
          setIsGeneratingMissionNumber(false);
        }
      }
    };

    generateMissionNumber();
  }, [createDialogOpen, effectiveStructureId]);

  useEffect(() => {
    let result = [...missions];
    
    if (searchTerm) {
      result = result.filter(mission => 
        mission.numeroMission.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mission.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mission.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mission.chargeName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (statusFilter !== 'all') {
      result = result.filter(mission => mission.status === statusFilter);
    }
    
    if (showFavoritesOnly) {
      result = result.filter(mission => favoriteMissions.includes(mission.id || ''));
    }

    if (archiveFilter !== 'all') {
      result = result.filter(mission => 
        archiveFilter === 'archived' ? mission.isArchived : !mission.isArchived
      );
    }

    if (mandatFilter !== 'all') {
      result = result.filter(mission => mission.mandat === mandatFilter);
    }
    
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          const dateA = a.startDate ? new Date(a.startDate) : new Date(0);
          const dateB = b.startDate ? new Date(b.startDate) : new Date(0);
          comparison = dateA.getTime() - dateB.getTime();
          break;
        case 'numeroMission':
          comparison = String(a.numeroMission || '').localeCompare(String(b.numeroMission || ''), 'fr', {
            numeric: true
          });
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

  const handleEditRow = (mission: MissionData) => {
    setMissionToEdit(mission);
    setEditDialogOpen(true);
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
          updatedData.chargeName = await getDecryptedUserDisplayName(updatedData.chargeId, userData || null);
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
    if (!effectiveStructureId) return false;
    const missionQuery = query(
      collection(db, 'missions'),
      where('structureId', '==', effectiveStructureId),
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

      if (!effectiveStructureId && authUserData?.status !== 'superadmin') {
        setSnackbar({
          open: true,
          message: 'Erreur: Aucune structure associée à votre compte',
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
        structureId: effectiveStructureId ?? undefined,
        chargeId: formData.chargeId || currentUser.uid,
        chargeName: getSafeDisplayName(selectedCharge),
        chargePhotoURL: selectedCharge.photoURL || null,
        description: formData.description,
        prixHT: formData.priceHT,
        createdAt: new Date(),
        createdBy: currentUser.uid,
        isPublic: false,
        etape: 'Négociation',
        isArchived: false,
        mandat: missionMandat
      };

      const docRef = await addDoc(collection(db, 'missions'), newMission);
      const createdMission = { ...newMission, id: docRef.id };

      setMissions(prev => [...prev, createdMission]);

      setCreateDialogOpen(false);
      
      navigate(`/app/mission/${docRef.id}`);

      setSnackbar({
        open: true,
        message: 'Mission créée avec succès',
        severity: 'success'
      });
    } catch (error: any) {
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
    if (effectiveStructureId) {
      setIsGeneratingMissionNumber(true);
      try {
        const missionNumber = await generateNextMissionNumber(effectiveStructureId);
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

  // Afficher le chargement des permissions
  if (permissionLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Afficher l'accès refusé si l'utilisateur n'a pas les permissions de lecture
  if (!canRead) {
    return (
      <AccessDenied 
        pageName="Missions" 
        message="Vous n'avez pas les permissions nécessaires pour accéder à cette page."
      />
    );
  }

  return (
    <>
    {loading ? (
      <LoadingState message="Chargement des missions…" />
    ) : (
      <MissionsListPage
        title="Missions"
        subtitle="Pipeline complet des missions de la structure."
        newLabel="Nouvelle mission"
        searchPlaceholder="Rechercher une mission…"
        rows={filteredMissions.map((m): MissionListRow => ({
          id: m.id || '',
          numero: m.numeroMission,
          title: m.description || m.company || m.numeroMission,
          client: m.company || m.entreprise || '',
          chargeId: m.chargeId,
          chargeName: m.chargeName,
          chargePhotoURL: m.chargePhotoURL,
          status: m.isArchived ? 'Archivée' : (m.etape || m.status || 'En cours'),
          amountHT: getMissionTotalTTC(m),
          dueDate: formatDate(m.endDate),
        }))}
        canWrite={canWrite}
        onNew={handleOpenCreateDialog}
        onRowClick={(row) => {
          const mission = filteredMissions.find((m) => m.id === row.id);
          if (mission) handleCardClick(mission);
        }}
        toolbarExtra={
          <>
            <Button size="small" variant={archiveFilter === 'active' ? 'contained' : 'outlined'} onClick={() => setArchiveFilter('active')} sx={{ textTransform: 'none', borderRadius: tokens.radius.md }}>
              En cours
            </Button>
            <Button size="small" variant={archiveFilter === 'archived' ? 'contained' : 'outlined'} onClick={() => setArchiveFilter('archived')} sx={{ textTransform: 'none', borderRadius: tokens.radius.md }}>
              Archivées
            </Button>
            <Button size="small" variant={archiveFilter === 'all' ? 'contained' : 'outlined'} onClick={() => setArchiveFilter('all')} sx={{ textTransform: 'none', borderRadius: tokens.radius.md }}>
              Toutes
            </Button>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Mandat</InputLabel>
              <Select value={mandatFilter} label="Mandat" onChange={(e) => setMandatFilter(e.target.value)} sx={{ borderRadius: tokens.radius.md }}>
                <MenuItem value="all">Tous</MenuItem>
                {AVAILABLE_MANDATS.map((mandat) => (
                  <MenuItem key={mandat} value={mandat}>{mandat}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        }
      />
    )}

      <Dialog
        open={createDialogOpen}
        onClose={handleCloseCreateDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: tokens.radius.xxl,
            overflow: 'hidden',
            boxShadow: tokens.shadows.pop,
          },
        }}
      >
        <DialogContent sx={{ p: 0, '&:first-of-type': { pt: 0 } }}>
          {isGeneratingMissionNumber ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={32} sx={{ color: tokens.colors.brandNavy }} />
            </Box>
          ) : (
            <MissionForm
              onSubmit={handleCreateMission}
              onCancel={handleCloseCreateDialog}
              availableCharges={availableCharges}
              initialData={generatedMissionNumber ? { number: generatedMissionNumber } : undefined}
            />
          )}
        </DialogContent>
      </Dialog>

      {createPortal(
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          sx={{ zIndex: 10000 }}
        >
          <Alert 
            severity={snackbar.severity} 
            onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>,
        document.body
      )}
    </>
  );
};

export default Mission; 