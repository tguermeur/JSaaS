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
import { useFreeQuotaUpgrade } from '../contexts/FreeQuotaUpgradeContext';
import { confirmFreeQuotaExceeded, useStructureQuota } from '../hooks/useStructureQuota';
import { isFirestorePermissionDenied } from '../utils/firebaseErrors';
import { db } from '../firebase/config';
import { doc, getDoc, collection, addDoc, query, where, getDocs, updateDoc, setDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import MissionForm, { MissionFormData } from '../components/missions/MissionForm';
import { canAccessStructureContent, canModifyStructureContent } from '../utils/permissions';
import { usePermission } from '../hooks/usePermission';
import AccessDenied from '../components/common/AccessDenied';
import { decryptUsersList, getDecryptedUserDisplayName, getSafeDisplayName } from '../utils/decryptUserUtils';
import { tokens } from '../theme/tokens';
import { fadeIn } from '../styles/animations';
import LoadingState from '../components/common/LoadingState';
import MissionsListPage, { type MissionListRow } from './missions/MissionsListPage';


interface EtudeData {
  id?: string;
  numeroEtude: string;
  nomConsultant?: string;
  date?: string;
  lieu?: string;
  entreprise?: string;
  prixHT?: number;
  priceHT?: number;
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

/** Total TTC = prix horaire HT × heures × 1,2 (TVA 20 %). */
const getEtudeTotalTTC = (e: EtudeData): number | undefined => {
  if (typeof e.totalTTC === 'number' && e.totalTTC > 0) return e.totalTTC;
  const hourly = e.priceHT ?? e.prixHT;
  const hours = e.hours;
  if (typeof hourly !== 'number' || hourly <= 0 || typeof hours !== 'number' || hours <= 0) {
    return undefined;
  }
  return Math.round(hourly * hours * 1.2 * 100) / 100;
};

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
  const { currentUser, userData } = useAuth();
  const { canRead, canWrite, loading: permissionLoading } = usePermission('audit');
  const { openFreeQuotaDialog } = useFreeQuotaUpgrade();
  const structureQuota = useStructureQuota(userData?.structureId);
  const [userStructureId, setUserStructureId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showNoStructureAlert, setShowNoStructureAlert] = useState(false);
  const [etudes, setEtudes] = useState<EtudeData[]>([]);
  const [filteredEtudes, setFilteredEtudes] = useState<EtudeData[]>([]);
  const [favoriteEtudes, setFavoriteEtudes] = useState<string[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });
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
        const usersQuery = query(
          usersRef,
          where('structureId', '==', userStructureId),
          where('status', 'in', ['membre', 'admin', 'superadmin'])
        );

        const usersSnapshot = await getDocs(usersQuery);
        const chargesListRaw = usersSnapshot.docs.map(doc => {
          const userData = doc.data() as UserData;
          return {
            id: doc.id,
            displayName: userData.displayName || 'Utilisateur sans nom',
            firstName: userData.firstName,
            lastName: userData.lastName,
            photoURL: userData.photoURL
          };
        });
        const chargesListDecrypted = await decryptUsersList(chargesListRaw);
        const chargesList = chargesListDecrypted.map(u => ({
          id: u.id,
          displayName: u.displayName || 'Utilisateur sans nom',
          photoURL: (chargesListRaw.find(r => r.id === u.id) as any)?.photoURL
        }));
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
        
        let etudesData = snapshot.docs.map(doc => {
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

        // Décrypter les noms des CDM (batch dédupliqué)
        const encryptedCharges = Array.from(
          new Map(
            etudesData
              .filter((e) => e.chargeId && e.chargeName?.startsWith?.('ENC:'))
              .map((e) => [e.chargeId, { id: e.chargeId, displayName: e.chargeName }])
          ).values()
        );
        if (encryptedCharges.length > 0) {
          const decrypted = await decryptUsersList(encryptedCharges);
          const nameById = new Map(decrypted.map((u) => [u.id, u.displayName]));
          etudesData = etudesData.map((e) => {
            const name = e.chargeId ? nameById.get(e.chargeId) : undefined;
            return name ? { ...e, chargeName: name } : e;
          });
        }

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

  const handleEditRow = (etude: EtudeData) => {
    setEtudeToEdit(etude);
    setEditDialogOpen(true);
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
          updatedData.chargeName = await getDecryptedUserDisplayName(updatedData.chargeId, userData || null);
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
        chargeName: getSafeDisplayName(selectedCharge),
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
      if (isFirestorePermissionDenied(error)) {
        const quotaHit = await confirmFreeQuotaExceeded(userStructureId, 'items');
        if (quotaHit) {
          openFreeQuotaDialog('items');
          return;
        }
      }
      setSnackbar({
        open: true,
        message: 'Erreur lors de la création de l\'étude',
        severity: 'error'
      });
    }
  };

  const handleOpenCreateDialog = () => {
    if (structureQuota.plan === 'free' && structureQuota.isItemQuotaExceeded) {
      openFreeQuotaDialog('items');
      return;
    }
    setCreateDialogOpen(true);
  };

  const handleCardClick = (etude: EtudeData) => {
    navigate(`/app/etude/${etude.numeroEtude}`);
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
        pageName="Études" 
        message="Vous n'avez pas les permissions nécessaires pour accéder à cette page."
      />
    );
  }

  return (
    <>
    {loading ? (
      <LoadingState message="Chargement des études…" />
    ) : (
      <MissionsListPage
        title="Études"
        subtitle="Pipeline complet des études de la structure."
        newLabel={
          structureQuota.plan === 'free' && structureQuota.isItemQuotaExceeded
            ? 'Passer au plan payant'
            : 'Nouvelle étude'
        }
        searchPlaceholder="Rechercher une étude…"
        rows={filteredEtudes.map((e): MissionListRow => ({
          id: e.id || '',
          numero: e.numeroEtude,
          title: e.description || e.company || e.numeroEtude,
          client: e.company || e.entreprise || '',
          chargeId: e.chargeId,
          chargeName: e.chargeName,
          chargePhotoURL: e.chargePhotoURL,
          status: e.isArchived ? 'Archivée' : (e.status || 'En cours'),
          amountHT: getEtudeTotalTTC(e),
          dueDate: formatDate(e.endDate),
          isEtude: true,
        }))}
        canWrite={canWrite}
        newTooltip={
          structureQuota.plan === 'free' && structureQuota.isItemQuotaExceeded
            ? 'Quota gratuit atteint (3 missions ou études). Passez au plan payant.'
            : undefined
        }
        onNew={handleOpenCreateDialog}
        onRowClick={(row) => {
          const etude = filteredEtudes.find((e) => e.id === row.id);
          if (etude) handleCardClick(etude);
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
          </>
        }
      />
    )}

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
          <MissionForm
            title="Nouvelle étude"
            subtitle="Renseignez les informations pour ouvrir une nouvelle étude."
            submitLabel="Créer l'étude"
            onSubmit={handleCreateEtude}
            onCancel={() => setCreateDialogOpen(false)}
            availableCharges={availableCharges}
          />
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

export default Etude;
