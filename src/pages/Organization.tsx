import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  CircularProgress,
  Snackbar,
  Alert,
  FormControlLabel,
  Checkbox,
  Paper,
  Tooltip,
  Tabs,
  Tab,
  FormHelperText,
  DialogContentText,
  Menu,
  alpha,
  useTheme
} from '@mui/material';
import { keyframes } from '@mui/system';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Person as PersonIcon,
  School as SchoolIcon,
  SupervisorAccount as AdminIcon,
  Assignment as MissionIcon,
  Add as AddIcon,
  Badge as BadgeIcon,
  Settings as SettingsIcon,
  Group as GroupIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Info as InfoIcon,
  AccountTree as AccountTreeIcon,
  PersonAdd as PersonAddIcon,
  RemoveCircleOutline as RemoveCircleOutlineIcon,
  CloudUpload as CloudUploadIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { doc, updateDoc, getDoc, getDocs, query, where, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { styled } from '@mui/material';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';

// Animations
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const scaleIn = keyframes`
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
`;

// Styles personnalisés
const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: '16px',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
  backdropFilter: 'blur(10px)',
  backgroundColor: alpha(theme.palette.background.paper, 0.8),
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
    transform: 'translateY(-2px)',
  },
  animation: `${fadeIn} 0.5s ease-out`,
}));

const StyledAvatar = styled(Avatar)(({ theme }) => ({
  width: 120,
  height: 120,
  borderRadius: '24px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    transform: 'scale(1.05)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
  },
}));

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: '12px',
  textTransform: 'none',
  fontWeight: 600,
  padding: '10px 24px',
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    transition: 'all 0.3s ease-in-out',
    '&:hover': {
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.primary.main,
      },
    },
  },
}));

const StyledChip = styled(Chip)(({ theme }) => ({
  borderRadius: '8px',
  fontWeight: 500,
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-1px)',
  },
}));

const StyledTabs = styled(Tabs)(({ theme }) => ({
  '& .MuiTab-root': {
    textTransform: 'none',
    fontWeight: 600,
    fontSize: '1rem',
    minHeight: 48,
    borderRadius: '12px',
    transition: 'all 0.3s ease-in-out',
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.08),
    },
    '&.Mui-selected': {
      backgroundColor: alpha(theme.palette.primary.main, 0.12),
    },
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.04),
    transform: 'translateX(4px)',
  },
}));

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: '24px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
    animation: `${scaleIn} 0.3s ease-out`,
  },
}));

// Types
interface Pole {
  id: string;
  name: 'Pôle communication' | 'Démarchage' | 'Audit Qualité' | 'Ressources humaines' | 'Trésorerie';
}

interface UserPole {
  poleId: string;
  isResponsable: boolean;
}

interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'admin' | 'mission_manager' | 'etudiant' | 'teacher' | 'superadmin';
  poles?: UserPole[];
  createdAt: any;
  bureauRole?: BureauRole;
  status?: 'admin' | 'member';
  structureId?: string;
}

interface OrganizationInfo {
  name: string;
  logo: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  description: string;
  siret: string;
  tvaNumber: string;
  apeCode: string;
}

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
}

interface StripeCustomer {
  id: string;
  email: string;
  name: string;
  subscriptionStatus: string;
  subscriptionTitle: string;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  environment: 'production' | 'test';
}

interface SubscriptionStatus {
  isActive: boolean;
  details: string;
  expiryDate: number | null;
  cancelAtPeriodEnd: boolean;
  renewalDate?: number | null;
}

// Définition des pôles
const POLES = [
  { id: 'com', name: 'Communication' },
  { id: 'dev', name: 'Développement commercial' },
  { id: 'tre', name: 'Trésorerie' },
  { id: 'rh', name: 'Ressources humaines' },
  { id: 'aq', name: 'Audit / Qualité' },
  { id: 'pre', name: 'Président' },
  { id: 'sec', name: 'Secrétaire général' },
  { id: 'vice', name: 'Vice-président' }
];

// Ajoutez les rôles de bureau
const BUREAU_ROLES = [
  { id: 'president', name: 'Président' },
  { id: 'vice-president', name: 'Vice-Président' },
  { id: 'tresorier', name: 'Trésorier' },
  { id: 'secretaire', name: 'Secrétaire Général' }
] as const;

type BureauRole = typeof BUREAU_ROLES[number]['id'];

// Styles pour les cartes de l'organigramme
const StyledMemberCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  borderRadius: theme.spacing(2),
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  }
}));

const Organization = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [organization, setOrganization] = useState<OrganizationInfo>({
    name: 'Structure non détectée',
    logo: '',
    address: 'Non renseigné',
    city: 'Non renseigné',
    postalCode: 'Non renseigné',
    phone: 'Non renseigné',
    email: 'Non renseigné',
    website: 'Non renseigné',
    description: 'Non renseigné',
    siret: '',
    tvaNumber: '',
    apeCode: ''
  });
  const [loading, setLoading] = useState(true);
  const [editingOrg, setEditingOrg] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [openRoleDialog, setOpenRoleDialog] = useState(false);
  const [newRole, setNewRole] = useState<User['role']>('etudiant');
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [members, setMembers] = useState<User[]>([]);
  const [openPoleDialog, setOpenPoleDialog] = useState(false);
  const [selectedUserForPole, setSelectedUserForPole] = useState<User | null>(null);
  const [selectedPoles, setSelectedPoles] = useState<string[]>([]);
  const [isResponsable, setIsResponsable] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState(0);
  const [openAddMemberDialog, setOpenAddMemberDialog] = useState(false);
  const [newMemberData, setNewMemberData] = useState<{
    bureauRole?: BureauRole;
  }>({});
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  // Nouveaux états pour la gestion des pôles
  const [poles, setPoles] = useState<typeof POLES>(POLES);
  const [openManagePolesDialog, setOpenManagePolesDialog] = useState(false);
  const [newPoleName, setNewPoleName] = useState('');
  const [editingPoleId, setEditingPoleId] = useState<string | null>(null);
  const [editingPoleName, setEditingPoleName] = useState('');
  const [stripeCustomers, setStripeCustomers] = useState<StripeCustomer[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    isActive: false,
    details: 'no_subscription',
    expiryDate: null,
    cancelAtPeriodEnd: false,
    renewalDate: null
  });
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const [loadingSubscription, setLoadingSubscription] = useState(true);

  // Ajouter une fonction pour retirer complètement un membre de la structure
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<User | null>(null);

  const [editingUserPoles, setEditingUserPoles] = useState<User | null>(null);

  const navigate = useNavigate();

  const handleOpenRemoveDialog = (member: User) => {
    setMemberToRemove(member);
    setConfirmRemoveOpen(true);
  };

  const handleCloseRemoveDialog = () => {
    setConfirmRemoveOpen(false);
    setMemberToRemove(null);
  };

  const handleRemoveMemberFromStructure = async () => {
    if (!memberToRemove) return;

    try {
      // Mise à jour de l'utilisateur pour changer son statut (admin ou member) à etudiant
      // sans supprimer son appartenance à la structure
      await updateDoc(doc(db, 'users', memberToRemove.id), {
        status: 'etudiant', // Passer de membre/admin à etudiant au lieu de supprimer
        poles: [], // On supprime quand même les pôles
        bureauRole: null // Et le rôle au bureau
      });

      setSnackbar({
        open: true,
        message: `${memberToRemove.displayName} n'est plus membre de la structure`,
        severity: 'success'
      });

      // Fermer la boîte de dialogue
      handleCloseRemoveDialog();

      // Recharger les données des membres
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        
        if (userData?.structureId) {
          const usersSnapshot = await getDocs(
            query(
              collection(db, 'users'),
              where('structureId', '==', userData.structureId)
            )
          );

          const membersData = usersSnapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt?.toDate()
            } as User))
            .filter(user => user.status === 'member' || user.status === 'admin');

          setMembers(membersData);
        }
      }

      // Rafraîchir aussi la liste des utilisateurs disponibles
      await fetchAvailableUsers();
    } catch (error) {
      console.error('Erreur lors de la modification du statut:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la modification du statut du membre',
        severity: 'error'
      });
    }
  };

  // Fonction pour réinitialiser le formulaire
  const resetAddMemberForm = () => {
    setSelectedUserId('');
    setSelectedPoles([]);
    setIsResponsable({});
    setNewMemberData({});
  };

  // Fonction pour fermer le dialogue
  const handleCloseDialog = () => {
    setOpenAddMemberDialog(false);
    resetAddMemberForm();
  };

  useEffect(() => {
    const fetchOrganizationData = async () => {
      try {
        if (!currentUser) {
          console.log('Pas d\'utilisateur connecté');
          setLoading(false);
          return;
        }

        console.log('Utilisateur connecté:', currentUser.uid);

        // Récupérer les données de l'utilisateur
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) {
          throw new Error("Utilisateur non trouvé");
        }

        const userData = userDoc.data();
        console.log('Données utilisateur:', userData);

        if (!userData.structureId) {
          throw new Error("Aucune structure associée à votre compte");
        }

        console.log('StructureId trouvé:', userData.structureId);

        // Vérifier si la structure existe directement
        const structureRef = doc(db, 'structures', userData.structureId);
        console.log('Référence structure:', structureRef.path);
        
        // Récupérer les données de la structure
        const structureDoc = await getDoc(structureRef);
        console.log('Document structure:', {
          exists: structureDoc.exists(),
          id: structureDoc.id,
          path: structureDoc.ref.path,
          data: structureDoc.data()
        });
        
        if (!structureDoc.exists()) {
          // Vérifier si la structure existe dans la collection
          const structuresSnapshot = await getDocs(collection(db, 'structures'));
          console.log('Toutes les structures:', structuresSnapshot.docs.map(doc => ({
            id: doc.id,
            data: doc.data()
          })));
          throw new Error("Structure non trouvée");
        }

        const structureData = structureDoc.data();
        console.log('Données structure:', structureData);

        setOrganization({
          name: structureData.nom || 'Structure non détectée',
          logo: structureData.logo || '',
          address: structureData.address || structureData.adresse || 'Non renseigné',
          city: structureData.city || structureData.ville || 'Non renseigné',
          postalCode: structureData.postalCode || structureData.codePostal || 'Non renseigné',
          phone: structureData.phone || structureData.telephone || 'Non renseigné',
          email: structureData.email || 'Non renseigné',
          website: structureData.website || structureData.siteWeb || 'Non renseigné',
          description: structureData.description || 'Non renseigné',
          siret: structureData.siret || '',
          tvaNumber: structureData.tvaNumber || '',
          apeCode: structureData.apeCode || ''
        });

        setIsAdmin(userData.role === 'admin' || userData.status === 'admin' || userData.role === 'superadmin' || userData.status === 'superadmin');
        setIsSuperAdmin(userData.role === 'superadmin' || userData.status === 'superadmin');

        // Récupérer tous les membres de la structure
        const usersSnapshot = await getDocs(
          query(
            collection(db, 'users'),
            where('structureId', '==', userData.structureId)
          )
        );

        const membersData = usersSnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate()
          } as User))
          .filter(user => user.status === 'member' || user.status === 'admin');

        setMembers(membersData);
      } catch (error) {
        console.error('Erreur lors du chargement:', error);
        setSnackbar({
          open: true,
          message: error instanceof Error ? error.message : 'Erreur lors du chargement des données',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizationData();
  }, [currentUser]);

  const fetchAvailableUsers = async () => {
    try {
      if (!currentUser) {
        console.log('Pas d\'utilisateur connecté');
        return;
      }

      console.log('Début de fetchAvailableUsers');

      // 1. Récupérer les données de l'utilisateur courant
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!userDoc.exists()) {
        console.error('Document utilisateur non trouvé');
        return;
      }
      
      const userData = userDoc.data();
      console.log('Données utilisateur courant:', userData);

      if (!userData.structureId) {
        console.error('Aucune structure associée à cet utilisateur');
        return;
      }

      // 2. Récupérer la structure
      const structureDoc = await getDoc(doc(db, 'structures', userData.structureId));
      if (!structureDoc.exists()) {
        console.error('Document structure non trouvé');
        return;
      }
      
      const structureData = structureDoc.data();
      console.log('Données structure:', structureData);

      if (!structureData?.ecole) {
        console.error('École non trouvée dans la structure');
        return;
      }

      console.log('École recherchée:', structureData.ecole);

      // 3. Récupérer tous les utilisateurs de la même école QUI N'ONT PAS DE STRUCTURE 
      // OU qui ont la même structure mais ne sont pas membres
      const usersQuery = query(
        collection(db, 'users'),
        where('ecole', '==', structureData.ecole)
      );

      console.log('Requête Firestore créée');

      const usersSnapshot = await getDocs(usersQuery);
      console.log('Requête exécutée avec succès');
      console.log('Nombre d\'utilisateurs trouvés:', usersSnapshot.size);

      const rawUsers = usersSnapshot.docs.map(doc => {
        const userData = doc.data();
        return {
          id: doc.id,
          email: userData.email || '',
          displayName: userData.displayName || '',
          role: userData.role || 'etudiant',
          createdAt: userData.createdAt || new Date(),
          photoURL: userData.photoURL || '',
          poles: userData.poles || [],
          bureauRole: userData.bureauRole || undefined,
          structureId: userData.structureId || '',
          status: userData.status || ''
        };
      });
      
      console.log('Utilisateurs bruts avant filtrage:', rawUsers);

      const users = rawUsers.filter(user => {
        // Exclure l'utilisateur courant
        const notCurrentUser = user.id !== currentUser.uid;
        // Inclure seulement les utilisateurs sans structure ou avec structure mais pas membre
        const hasNoStructure = !user.structureId;
        const hasSameStructureButNotMember = (
          user.structureId === userData.structureId && 
          (user.status === 'etudiant' || (!['member', 'admin'].includes(user.status || '')))
        );
        
        const shouldInclude = notCurrentUser && (hasNoStructure || hasSameStructureButNotMember);
        
        console.log(`Utilisateur ${user.displayName} (${user.id}):`);
        console.log(` - Est utilisateur courant: ${!notCurrentUser}`);
        console.log(` - N'a pas de structure: ${hasNoStructure}`);
        console.log(` - Même structure mais pas membre: ${hasSameStructureButNotMember}`);
        console.log(` - Inclus: ${shouldInclude}`);
        
        return shouldInclude;
      });

      console.log('Utilisateurs filtrés:', users);
      console.log('Nombre d\'utilisateurs après filtrage:', users.length);

      setAvailableUsers(users);
      console.log('État availableUsers mis à jour');

    } catch (error) {
      console.error('Erreur détaillée dans fetchAvailableUsers:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors du chargement des utilisateurs',
        severity: 'error'
      });
    }
  };

  // Dans le useEffect, ajoutons un appel explicite
  useEffect(() => {
    console.log('UseEffect déclenché - Chargement des utilisateurs');
    fetchAvailableUsers();
  }, [currentUser]);

  // Ajouter un useEffect pour surveiller les changements dans availableUsers
  useEffect(() => {
    console.log('Mise à jour de availableUsers:', availableUsers);
  }, [availableUsers]);

  // Gérer le changement de rôle
  const handleChangeRole = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setOpenRoleDialog(true);
  };

  // Confirmer le changement de rôle
  const handleConfirmRoleChange = async () => {
    if (!selectedUser) return;
    
    try {
      // Mettre à jour uniquement le statut dans Firebase
      await updateDoc(doc(db, 'users', selectedUser.id), {
        status: selectedUser.status
      });
      
      // Mettre à jour l'état local
      setMembers(members.map(member => 
        member.id === selectedUser.id 
          ? { ...member, status: selectedUser.status } 
          : member
      ));
      
      setSnackbar({
        open: true,
        message: `Statut de ${selectedUser.displayName} mis à jour avec succès`,
        severity: 'success'
      });
      
      setOpenRoleDialog(false);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour du statut',
        severity: 'error'
      });
    }
  };

  // Gérer la modification des informations de l'organisation
  const handleOrgChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setOrganization(prev => ({
      ...prev,
      [name]: value || '' // Assurez-vous qu'une valeur vide est une chaîne vide
    }));
  };

  // Fonction pour sauvegarder les modifications de la structure
  const handleSaveOrg = async () => {
    try {
      console.log('Début de handleSaveOrg');
      if (!currentUser) {
        console.error('Pas d\'utilisateur connecté');
        throw new Error("Utilisateur non connecté");
      }

      console.log('Utilisateur connecté:', currentUser.uid);
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!userDoc.exists()) {
        console.error('Document utilisateur non trouvé');
        throw new Error("Document utilisateur non trouvé");
      }

      const userData = userDoc.data();
      console.log('Données utilisateur:', userData);
      const structureId = userData?.structureId;
      if (!structureId) {
        console.error('Structure ID non trouvé');
        throw new Error("Structure non trouvée");
      }

      console.log('Structure ID trouvé:', structureId);
      console.log('Données à mettre à jour:', {
        nom: organization.name,
        address: organization.address,
        city: organization.city,
        postalCode: organization.postalCode,
        phone: organization.phone,
        email: organization.email,
        website: organization.website,
        description: organization.description,
        updatedAt: new Date()
      });

      // Mise à jour de la structure
      const structureRef = doc(db, 'structures', structureId);
      console.log('Référence structure:', structureRef.path);
      
      await updateDoc(structureRef, {
        nom: organization.name,
        address: organization.address,
        adresse: organization.address,
        city: organization.city,
        ville: organization.city,
        postalCode: organization.postalCode,
        codePostal: organization.postalCode,
        phone: organization.phone,
        telephone: organization.phone,
        email: organization.email,
        website: organization.website,
        siteWeb: organization.website,
        description: organization.description,
        siret: organization.siret,
        tvaNumber: organization.tvaNumber,
        apeCode: organization.apeCode,
        updatedAt: new Date()
      });

      console.log('Mise à jour réussie');

      // Recharger les données de la structure
      const updatedStructureDoc = await getDoc(structureRef);
      if (updatedStructureDoc.exists()) {
        const structureData = updatedStructureDoc.data();
        setOrganization({
          name: structureData.nom || 'Structure non détectée',
          logo: structureData.logo || '',
          address: structureData.address || structureData.adresse || 'Non renseigné',
          city: structureData.city || structureData.ville || 'Non renseigné',
          postalCode: structureData.postalCode || structureData.codePostal || 'Non renseigné',
          phone: structureData.phone || structureData.telephone || 'Non renseigné',
          email: structureData.email || 'Non renseigné',
          website: structureData.website || structureData.siteWeb || 'Non renseigné',
          description: structureData.description || 'Non renseigné',
          siret: structureData.siret || '',
          tvaNumber: structureData.tvaNumber || '',
          apeCode: structureData.apeCode || ''
        });
      }

      setEditingOrg(false);
      setSnackbar({
        open: true,
        message: 'Informations mises à jour avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur détaillée lors de la mise à jour:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour : ' + (error as Error).message,
        severity: 'error'
      });
    }
  };

  // Fermer la snackbar
  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  // Afficher le chip de rôle avec la bonne couleur
  const getRoleChip = (role: User['role'], status?: User['status']) => {
    // On ne veut afficher que les statuts "admin" ou "member"
    if (status === 'admin') {
      return <Chip icon={<AdminIcon />} label="Administrateur" color="error" />;
    }
    if (status === 'member') {
      return <Chip icon={<PersonIcon />} label="Membre" color="default" />;
    }
    // Sinon, on n'affiche rien
    return null;
  };

  // Fonction pour gérer l'attribution des pôles
  const handleUpdateUserPoles = async () => {
    if (!selectedUserForPole) return;

    try {
      const userPoles = Object.entries(selectedPoles)
        .filter(([_, isSelected]) => isSelected)
        .map(([poleId]) => ({
          poleId,
          isResponsable: isResponsable[poleId] || false
        }));

      await updateDoc(doc(db, 'users', selectedUserForPole.id), {
        poles: userPoles
      });

      // Mise à jour de l'état local
      setMembers(members.map(member =>
        member.id === selectedUserForPole.id
          ? { ...member, poles: userPoles }
          : member
      ));

      setSnackbar({
        open: true,
        message: 'Pôles mis à jour avec succès',
        severity: 'success'
      });

      setOpenPoleDialog(false);
    } catch (error) {
      console.error('Erreur lors de la mise à jour des pôles:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour des pôles',
        severity: 'error'
      });
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleAddMember = async () => {
    try {
      if (!selectedUserId) return;

      // Récupérer l'ID de la structure de l'utilisateur courant
      const userDoc = await getDoc(doc(db, 'users', currentUser?.uid || ''));
      const userData = userDoc.data();
      const structureId = userData?.structureId;

      if (!structureId) {
        throw new Error("Aucune structure associée à votre compte");
      }

      const selectedPolesList = Object.entries(selectedPoles)
        .filter(([_, isSelected]) => isSelected)
        .map(([poleId]) => ({
          poleId,
          isResponsable: isResponsable[poleId] || false
        }));

      // Mettre à jour l'utilisateur avec les pôles sélectionnés et l'ajouter à la structure
      await updateDoc(doc(db, 'users', selectedUserId), {
        poles: selectedPolesList,
        structureId: structureId,
        status: 'member',
        bureauRole: newMemberData.bureauRole || null
      });

      setSnackbar({
        open: true,
        message: 'Membre ajouté avec succès',
        severity: 'success'
      });

      // Rafraîchir la liste des membres
      await fetchAvailableUsers();
      setOpenAddMemberDialog(false);
      
      // Réinitialiser les sélections
      setSelectedUserId('');
      setSelectedPoles([]);
      setIsResponsable({});

      // Recharger les données des membres existants
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        
        if (userData?.structureId) {
          const usersSnapshot = await getDocs(
            query(
              collection(db, 'users'),
              where('structureId', '==', userData.structureId)
            )
          );

          const membersData = usersSnapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt?.toDate()
            } as User))
            .filter(user => user.status === 'member' || user.status === 'admin');

          setMembers(membersData);
        }
      }

    } catch (error) {
      console.error('Erreur lors de l\'ajout du membre:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de l\'ajout du membre',
        severity: 'error'
      });
    }
  };

  // Modifiez le bouton d'ajout de membre pour utiliser setOpenAddMemberDialog
  const AddMemberButton = () => (
    <Button
      variant="contained"
      startIcon={<PersonAddIcon />}
      onClick={() => {
        console.log("Bouton Ajouter un membre cliqué");
        // Récupérer les utilisateurs disponibles avant d'ouvrir la popup
        fetchAvailableUsers().then(() => {
          setOpenAddMemberDialog(true);
          console.log("État openAddMemberDialog:", openAddMemberDialog);
        });
      }}
      sx={{ mb: 2 }}
    >
      Ajouter un membre
    </Button>
  );

  // Bouton pour gérer les pôles
  const ManagePolesButton = () => (
    <Button
      variant="outlined"
      startIcon={<BadgeIcon />}
      onClick={handleManagePoles}
      sx={{ mb: 2, ml: 2 }}
    >
      Gérer les pôles
    </Button>
  );

  // Dans le dialogue, utilisez handleCloseDialog au lieu de setOpenAddMemberDialog(false)
  const AddMemberDialog = () => {
    console.log("Rendu de AddMemberDialog, état d'ouverture:", openAddMemberDialog);
    console.log("Utilisateurs disponibles:", availableUsers);
    
    return (
      <StyledDialog
        open={openAddMemberDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonAddIcon color="primary" />
            <Typography variant="h6">
              Ajouter un membre
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Sélectionner un membre</InputLabel>
              <Select
                value={selectedUserId}
                label="Sélectionner un membre"
                onChange={(e) => setSelectedUserId(e.target.value as string)}
                sx={{
                  borderRadius: '12px',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme => alpha(theme.palette.primary.main, 0.2),
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme => theme.palette.primary.main,
                  },
                }}
              >
                {availableUsers.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <StyledAvatar 
                        src={user.photoURL} 
                        sx={{ width: 24, height: 24 }}
                      >
                        {user.displayName?.[0]}
                      </StyledAvatar>
                      <Typography>{user.displayName || user.email}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedUserId && (
              <>
                <FormControl fullWidth>
                  <InputLabel>Rôle au bureau</InputLabel>
                  <Select
                    value={newMemberData.bureauRole || ''}
                    label="Rôle au bureau"
                    onChange={(e) => setNewMemberData(prev => ({
                      ...prev,
                      bureauRole: e.target.value as BureauRole
                    }))}
                    sx={{
                      borderRadius: '12px',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: theme => alpha(theme.palette.primary.main, 0.2),
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: theme => theme.palette.primary.main,
                      },
                    }}
                  >
                    <MenuItem value="">Aucun rôle au bureau</MenuItem>
                    {BUREAU_ROLES.map(role => (
                      <MenuItem key={role.id} value={role.id}>
                        {role.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Typography 
                  variant="subtitle1" 
                  sx={{ 
                    fontWeight: 600,
                    color: theme => theme.palette.text.primary
                  }}
                >
                  Sélection des pôles
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {POLES.map((pole) => (
                    <Paper 
                      key={pole.id} 
                      variant="outlined" 
                      sx={{ 
                        p: 1.5,
                        borderRadius: '12px',
                        borderColor: theme => alpha(theme.palette.divider, 0.1),
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          backgroundColor: theme => alpha(theme.palette.action.hover, 0.5),
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={selectedPoles[pole.id] || false}
                              onChange={(e) => setSelectedPoles(prev => ({
                                ...prev,
                                [pole.id]: e.target.checked
                              }))}
                              sx={{
                                '& .MuiSvgIcon-root': {
                                  fontSize: 20,
                                },
                              }}
                            />
                          }
                          label={
                            <Typography variant="body2">
                              {pole.name}
                            </Typography>
                          }
                        />
                        {selectedPoles[pole.id] && (
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={isResponsable[pole.id] || false}
                                onChange={(e) => setIsResponsable(prev => ({
                                  ...prev,
                                  [pole.id]: e.target.checked
                                }))}
                                sx={{
                                  '& .MuiSvgIcon-root': {
                                    fontSize: 20,
                                  },
                                }}
                              />
                            }
                            label={
                              <Typography 
                                variant="body2" 
                                color="primary"
                                sx={{ fontWeight: 500 }}
                              >
                                Responsable
                              </Typography>
                            }
                          />
                        )}
                      </Box>
                    </Paper>
                  ))}
                </Box>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <StyledButton 
            onClick={handleCloseDialog}
            variant="outlined"
            size="small"
          >
            Annuler
          </StyledButton>
          <StyledButton 
            onClick={handleAddMember}
            variant="contained"
            size="small"
            startIcon={<SaveIcon />}
            disabled={!selectedUserId}
          >
            Ajouter
          </StyledButton>
        </DialogActions>
      </StyledDialog>
    );
  };

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleUploadLogo = async () => {
    if (!logoFile || !currentUser) {
      setSnackbar({
        open: true,
        message: 'Veuillez vous connecter et sélectionner un fichier',
        severity: 'error'
      });
      return;
    }

    try {
      setLoading(true);

      // Vérifications de base
      if (logoFile.size > 5 * 1024 * 1024) {
        throw new Error('Le fichier doit faire moins de 5MB');
      }

      if (!logoFile.type.startsWith('image/')) {
        throw new Error('Le fichier doit être une image');
      }

      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();
      const structureId = userData?.structureId;

      if (!structureId) {
        throw new Error("Aucune structure associée à votre compte");
      }

      // Création de la référence avec un nom de fichier plus simple
      const logoRef = ref(storage, `structures/${structureId}/logo`);
      
      // Upload du fichier
      await uploadBytes(logoRef, logoFile);
      console.log("Upload réussi");

      // Récupération de l'URL
      const logoUrl = await getDownloadURL(logoRef);
      console.log("URL récupérée:", logoUrl);

      // Mise à jour de la structure
      await updateDoc(doc(db, 'structures', structureId), {
        logo: logoUrl,
        updatedAt: new Date()
      });

      setOrganization(prev => ({
        ...prev,
        logo: logoUrl
      }));

      setLogoFile(null);
      setLogoPreview('');

      setSnackbar({
        open: true,
        message: 'Logo mis à jour avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur détaillée:', error);
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Erreur lors du téléchargement du logo',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour gérer les pôles (ajouter, modifier, supprimer)
  const handleManagePoles = () => {
    setOpenManagePolesDialog(true);
  };

  // Fonction pour ajouter un nouveau pôle
  const handleAddPole = () => {
    if (!newPoleName.trim()) {
      setSnackbar({
        open: true,
        message: 'Le nom du pôle ne peut pas être vide',
        severity: 'error'
      });
      return;
    }

    // Vérifier si le nom du pôle existe déjà
    if (poles.some(pole => pole.name.toLowerCase() === newPoleName.toLowerCase())) {
      setSnackbar({
        open: true,
        message: 'Ce pôle existe déjà',
        severity: 'error'
      });
      return;
    }

    // Générer un ID unique pour le nouveau pôle
    const newId = newPoleName.substring(0, 3).toLowerCase();
    
    // Ajouter le nouveau pôle
    const newPole = { id: newId, name: newPoleName };
    setPoles([...poles, newPole]);
    
    // Réinitialiser le champ
    setNewPoleName('');
    
    setSnackbar({
      open: true,
      message: 'Pôle ajouté avec succès',
      severity: 'success'
    });
  };

  // Fonction pour commencer l'édition d'un pôle
  const handleStartEditPole = (poleId: string, poleName: string) => {
    setEditingPoleId(poleId);
    setEditingPoleName(poleName);
  };

  // Fonction pour sauvegarder les modifications d'un pôle
  const handleSaveEditPole = () => {
    if (!editingPoleId || !editingPoleName.trim()) {
      setSnackbar({
        open: true,
        message: 'Le nom du pôle ne peut pas être vide',
        severity: 'error'
      });
      return;
    }

    // Vérifier si le nom du pôle existe déjà (sauf pour le pôle en cours d'édition)
    if (poles.some(pole => 
      pole.id !== editingPoleId && 
      pole.name.toLowerCase() === editingPoleName.toLowerCase()
    )) {
      setSnackbar({
        open: true,
        message: 'Ce pôle existe déjà',
        severity: 'error'
      });
      return;
    }

    // Mettre à jour le pôle
    setPoles(poles.map(pole => 
      pole.id === editingPoleId 
        ? { ...pole, name: editingPoleName } 
        : pole
    ));
    
    // Réinitialiser les champs d'édition
    setEditingPoleId(null);
    setEditingPoleName('');
    
    setSnackbar({
      open: true,
      message: 'Pôle modifié avec succès',
      severity: 'success'
    });
  };

  // Fonction pour annuler l'édition d'un pôle
  const handleCancelEditPole = () => {
    setEditingPoleId(null);
    setEditingPoleName('');
  };

  // Fonction pour supprimer un pôle
  const handleDeletePole = (poleId: string) => {
    // Vérifier si le pôle est utilisé par des membres
    const isPoleUsed = members.some(member => 
      member.poles?.some(pole => pole.poleId === poleId)
    );
    
    if (isPoleUsed) {
      setSnackbar({
        open: true,
        message: 'Ce pôle est utilisé par des membres et ne peut pas être supprimé',
        severity: 'error'
      });
      return;
    }
    
    // Supprimer le pôle
    setPoles(poles.filter(pole => pole.id !== poleId));
    
    setSnackbar({
      open: true,
      message: 'Pôle supprimé avec succès',
      severity: 'success'
    });
  };

  useEffect(() => {
    const fetchStripeCustomers = async () => {
      try {
        setLoadingSubscription(true);
        const functions = getFunctions();
        const getStripeCustomers = httpsCallable(functions, 'getStripeCustomers');
        const result = await getStripeCustomers();
        setStripeCustomers(result.data as StripeCustomer[]);
      } catch (err) {
        console.error('Erreur lors de la récupération des clients Stripe:', err);
      } finally {
        setLoadingSubscription(false);
      }
    };

    fetchStripeCustomers();
  }, []);

  useEffect(() => {
    if (organization.email && stripeCustomers.length > 0) {
      const customer = stripeCustomers.find(c => 
        c.email.toLowerCase() === organization.email.toLowerCase()
      );

      if (customer) {
        setSubscriptionStatus({
          isActive: customer.subscriptionStatus === 'active' || customer.subscriptionStatus === 'trialing',
          details: customer.subscriptionStatus,
          expiryDate: customer.currentPeriodEnd,
          cancelAtPeriodEnd: customer.cancelAtPeriodEnd,
          renewalDate: customer.currentPeriodEnd
        });
      } else {
        setSubscriptionStatus({
          isActive: false,
          details: 'no_subscription',
          expiryDate: null,
          cancelAtPeriodEnd: false,
          renewalDate: null
        });
      }
    }
  }, [organization.email, stripeCustomers]);

  // Fonction pour annuler l'abonnement
  const handleCancelSubscription = async () => {
    try {
      setCancelling(true);
      const functions = getFunctions();
      const cancelSubscription = httpsCallable(functions, 'cancelStripeSubscription');
      
      // Utiliser l'email de la structure
      const result = await cancelSubscription({ email: organization.email });
      console.log('Résultat de l\'annulation:', result.data);
      
      // Mettre à jour le statut local
      setSubscriptionStatus(prev => ({
        ...prev,
        cancelAtPeriodEnd: true
      }));
      
      setSnackbar({
        open: true,
        message: 'Votre abonnement sera annulé à la fin de la période en cours',
        severity: 'success'
      });
      setCancelDialogOpen(false);
    } catch (error: any) {
      console.error('Erreur lors de l\'annulation:', error);
      setSnackbar({ 
        open: true,
        message: error.message || 'Erreur lors de l\'annulation de l\'abonnement',
        severity: 'error'
      });
    } finally {
      setCancelling(false);
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleCancelClick = () => {
    handleClose();
    setCancelDialogOpen(true);
  };

  const getPoleColor = (poleName: string) => {
    switch (poleName) {
      case 'Communication':
        return '#2196f3'; // Bleu
      case 'Développement commercial':
        return '#4caf50'; // Vert
      case 'Trésorerie':
        return '#f44336'; // Rouge
      case 'Ressources humaines':
        return '#9c27b0'; // Violet
      case 'Audit / Qualité':
        return '#ff9800'; // Orange
      case 'Président':
        return '#ffb300'; // Jaune foncé
      case 'Secrétaire général':
        return '#607d8b'; // Bleu-gris
      case 'Vice-président':
        return '#8d6e63'; // Marron
      default:
        return '#757575'; // Gris par défaut
    }
  };

  const handleStartEditPoles = (user: User) => {
    setEditingUserPoles(user);
    setSelectedPoles(user.poles?.map(pole => pole.poleId) || []);
  };

  const handleSaveUserPoles = async () => {
    if (!editingUserPoles) return;

    try {
      const userRef = doc(db, 'users', editingUserPoles.id);
      const updatedPoles = selectedPoles.map(poleId => ({
        poleId,
        isResponsable: editingUserPoles.poles?.find(p => p.poleId === poleId)?.isResponsable || false
      }));

      await updateDoc(userRef, {
        poles: updatedPoles
      });

      setSnackbar({
        open: true,
        message: 'Pôles mis à jour avec succès',
        severity: 'success'
      });

      // Mettre à jour la liste des membres
      setMembers(members.map(member => 
        member.id === editingUserPoles.id 
          ? { ...member, poles: updatedPoles }
          : member
      ));

      // Fermer le dialogue
      setEditingUserPoles(null);
      setSelectedPoles([]);
    } catch (error) {
      console.error('Erreur lors de la mise à jour des pôles:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour des pôles',
        severity: 'error'
      });
    }
  };

  const handleCancelEditPoles = () => {
    setEditingUserPoles(null);
    setSelectedPoles([]);
  };

  return (
    <Box sx={{ 
      p: 3,
      background: theme => `linear-gradient(180deg, ${alpha(theme.palette.background.default, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
      minHeight: '100vh'
    }}>
      <Typography 
        variant="h4" 
        gutterBottom 
        sx={{ 
          fontWeight: 700,
          mb: 4,
          background: theme => `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: `${fadeIn} 0.5s ease-out`
        }}
      >
        Organisation
      </Typography>

      <Box sx={{ 
        borderBottom: 1, 
        borderColor: 'divider', 
        mb: 4,
        animation: `${fadeIn} 0.5s ease-out 0.2s both`
      }}>
        <StyledTabs 
          value={activeTab} 
          onChange={handleTabChange}
          aria-label="organization tabs"
        >
          <Tab 
            icon={<InfoIcon />} 
            iconPosition="start" 
            label="Informations" 
          />
          <Tab 
            icon={<AccountTreeIcon />} 
            iconPosition="start" 
            label="Organigramme" 
          />
          <Tab 
            icon={<GroupIcon />} 
            iconPosition="start" 
            label="Membres" 
          />
        </StyledTabs>
      </Box>

      {loading ? (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: '60vh'
        }}>
          <CircularProgress 
            sx={{ 
              color: theme => theme.palette.primary.main,
              animation: `${scaleIn} 0.5s ease-out`
            }} 
          />
        </Box>
      ) : (
        <>
          {activeTab === 0 ? (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <StyledCard>
                  <CardHeader
                    title={
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Informations de l'organisation
                      </Typography>
                    }
                    action={
                      isAdmin && (
                        <IconButton 
                          onClick={() => {
                            if (editingOrg) {
                              handleSaveOrg();
                            } else {
                              setEditingOrg(true);
                            }
                          }}
                          sx={{
                            transition: 'all 0.3s ease-in-out',
                            '&:hover': {
                              transform: 'rotate(15deg)',
                              backgroundColor: theme => alpha(theme.palette.primary.main, 0.1),
                            },
                          }}
                        >
                          {editingOrg ? <SaveIcon /> : <EditIcon />}
                        </IconButton>
                      )
                    }
                  />
                  <Divider />
                  <CardContent>
                    {editingOrg ? (
                      <Grid container spacing={3} sx={{ pb: 4 }}>
                        <Grid item xs={12}>
                          <Box sx={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            gap: 2, 
                            mb: 3 
                          }}>
                            {(logoPreview || organization.logo) && (
                              <StyledAvatar
                                src={logoPreview || organization.logo}
                                sx={{ mb: 2 }}
                              />
                            )}
                            <Box sx={{ width: '100%' }}>
                              <input
                                id="logo-upload"
                                type="file"
                                accept="image/*"
                                onChange={handleLogoChange}
                                style={{ display: 'none' }}
                              />
                              <StyledButton
                                variant="outlined"
                                startIcon={<CloudUploadIcon />}
                                disabled={loading}
                                sx={{ width: '100%' }}
                                onClick={() => {
                                  const input = document.getElementById('logo-upload');
                                  if (input) {
                                    input.click();
                                  }
                                }}
                              >
                                Changer le logo
                              </StyledButton>
                            </Box>
                            {logoFile && (
                              <StyledButton
                                variant="contained"
                                onClick={handleUploadLogo}
                                disabled={loading}
                                size="small"
                              >
                                {loading ? (
                                  <CircularProgress size={24} color="inherit" />
                                ) : (
                                  'Télécharger le logo'
                                )}
                              </StyledButton>
                            )}
                          </Box>
                        </Grid>
                        <Grid item xs={12}>
                          <StyledTextField
                            fullWidth
                            label="Nom de l'organisation"
                            name="name"
                            value={organization.name}
                            onChange={handleOrgChange}
                            sx={{ mb: 2 }}
                            variant="outlined"
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <StyledTextField
                            fullWidth
                            label="Adresse"
                            name="address"
                            value={organization.address || ''}
                            onChange={handleOrgChange}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <StyledTextField
                            fullWidth
                            label="Ville"
                            name="city"
                            value={organization.city || ''}
                            onChange={handleOrgChange}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <StyledTextField
                            fullWidth
                            label="Code postal"
                            name="postalCode"
                            value={organization.postalCode || ''}
                            onChange={handleOrgChange}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <StyledTextField
                            fullWidth
                            label="Téléphone"
                            name="phone"
                            value={organization.phone || ''}
                            onChange={handleOrgChange}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <StyledTextField
                            fullWidth
                            label="Email"
                            name="email"
                            value={organization.email || ''}
                            onChange={handleOrgChange}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <StyledTextField
                            fullWidth
                            label="Site web"
                            name="website"
                            value={organization.website || ''}
                            onChange={handleOrgChange}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <StyledTextField
                            fullWidth
                            label="Description"
                            name="description"
                            value={organization.description || ''}
                            onChange={handleOrgChange}
                            multiline
                            rows={4}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <StyledTextField
                            fullWidth
                            label="SIRET"
                            name="siret"
                            value={organization.siret}
                            onChange={handleOrgChange}
                            disabled={!editingOrg}
                            placeholder="Entrez le numéro SIRET"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <StyledTextField
                            fullWidth
                            label="N° de TVA intracommunautaire"
                            name="tvaNumber"
                            value={organization.tvaNumber}
                            onChange={handleOrgChange}
                            disabled={!editingOrg}
                            placeholder="Entrez le numéro de TVA"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <StyledTextField
                            fullWidth
                            label="Code APE"
                            name="apeCode"
                            value={organization.apeCode}
                            onChange={handleOrgChange}
                            disabled={!editingOrg}
                            placeholder="Entrez le code APE"
                          />
                        </Grid>
                      </Grid>
                    ) : (
                      <Box sx={{ 
                        '& .MuiTypography-root': { mb: 1 },
                        '& .MuiTypography-body2': { 
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1
                        }
                      }}>
                        {organization.logo && (
                          <Box sx={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            mb: 3,
                            animation: `${fadeIn} 0.5s ease-out`
                          }}>
                            <StyledAvatar
                              src={organization.logo}
                            />
                          </Box>
                        )}
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            fontWeight: 600,
                            animation: `${fadeIn} 0.5s ease-out 0.1s both`
                          }}
                        >
                          {organization.name}
                        </Typography>
                        <Typography 
                          variant="body1" 
                          paragraph
                          sx={{ 
                            animation: `${fadeIn} 0.5s ease-out 0.2s both`
                          }}
                        >
                          {organization.description}
                        </Typography>
                        <Typography variant="body2"><strong>Adresse:</strong> {organization.address}</Typography>
                        <Typography variant="body2"><strong>Ville:</strong> {organization.city || 'Non renseigné'}</Typography>
                        <Typography variant="body2"><strong>Code postal:</strong> {organization.postalCode || 'Non renseigné'}</Typography>
                        <Typography variant="body2"><strong>Téléphone:</strong> {organization.phone}</Typography>
                        <Typography variant="body2"><strong>Email:</strong> {organization.email}</Typography>
                        <Typography variant="body2"><strong>Site web:</strong> {organization.website}</Typography>
                        <Typography variant="body2"><strong>SIRET:</strong> {organization.siret || 'Non renseigné'}</Typography>
                        <Typography variant="body2"><strong>N° de TVA intracommunautaire:</strong> {organization.tvaNumber || 'Non renseigné'}</Typography>
                        <Typography variant="body2"><strong>Code APE:</strong> {organization.apeCode || 'Non renseigné'}</Typography>
                      </Box>
                    )}
                  </CardContent>
                </StyledCard>
              </Grid>
              <Grid item xs={12} md={6}>
                <StyledCard>
                  <CardHeader
                    title="Statut de l'abonnement"
                    avatar={
                      subscriptionStatus.isActive ? 
                        <CheckCircleIcon color="success" /> : 
                        <CancelIcon color="error" />
                    }
                  />
                  <Divider />
                  <CardContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1">
                          Statut:
                        </Typography>
                        {loadingSubscription ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={20} />
                            <Typography variant="body2" color="text.secondary">
                              Chargement...
                            </Typography>
                          </Box>
                        ) : (
                          <StyledChip
                            label={
                              subscriptionStatus.details === 'active' ? 'Actif' :
                              subscriptionStatus.details === 'trialing' ? 'Période d\'essai' :
                              subscriptionStatus.details === 'canceled' ? 'Annulé' :
                              subscriptionStatus.details === 'incomplete' ? 'Incomplet' :
                              'Aucun abonnement'
                            }
                            color={
                              subscriptionStatus.details === 'active' || subscriptionStatus.details === 'trialing' ? 'success' :
                              subscriptionStatus.details === 'canceled' ? 'error' :
                              subscriptionStatus.details === 'incomplete' ? 'warning' :
                              'error'
                            }
                          />
                        )}
                        {subscriptionStatus.isActive && !subscriptionStatus.cancelAtPeriodEnd && isAdmin && !loadingSubscription && (
                          <>
                            <IconButton 
                              size="small" 
                              onClick={handleClick}
                              sx={{ ml: 'auto' }}
                            >
                              <MoreVertIcon />
                            </IconButton>
                            <Menu
                              anchorEl={anchorEl}
                              open={open}
                              onClose={handleClose}
                              anchorOrigin={{
                                vertical: 'bottom',
                                horizontal: 'right',
                              }}
                              transformOrigin={{
                                vertical: 'top',
                                horizontal: 'right',
                              }}
                            >
                              <MenuItem onClick={handleCancelClick}>
                                <CancelIcon fontSize="small" sx={{ mr: 1 }} />
                                Annuler l'abonnement
                              </MenuItem>
                            </Menu>
                          </>
                        )}
                      </Box>

                      {loadingSubscription ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CircularProgress size={16} />
                          <Typography variant="body2" color="text.secondary">
                            Chargement des détails...
                          </Typography>
                        </Box>
                      ) : (
                        <>
                          {subscriptionStatus.isActive && (
                            <>
                              <Typography variant="body2" color="text.secondary">
                                Plan : {stripeCustomers.find(c => c.email.toLowerCase() === organization.email.toLowerCase())?.subscriptionTitle || 'Non disponible'}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Prochain renouvellement automatique : {subscriptionStatus.renewalDate ? new Date(subscriptionStatus.renewalDate).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric'
                                }) : 'Non disponible'}
                              </Typography>
                            </>
                          )}

                          {subscriptionStatus.cancelAtPeriodEnd && (
                            <Typography variant="body2" color="warning.main">
                              Votre abonnement sera annulé à la fin de la période en cours.
                            </Typography>
                          )}

                          {!subscriptionStatus.isActive && subscriptionStatus.details !== 'trialing' && (
                            <>
                              <Typography variant="body2" color="error">
                                {subscriptionStatus.details === 'canceled' ? 
                                  'Votre abonnement a été annulé. Veuillez le renouveler pour continuer à utiliser tous les services.' :
                                  'Veuillez mettre à jour votre abonnement pour continuer à utiliser tous les services.'}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Important : Utilisez l'adresse email de votre structure ({organization.email}) lors de l'abonnement.
                              </Typography>
                              <Button
                                variant="contained"
                                color="primary"
                                href="https://buy.stripe.com/cNi6oH5PN2NK6xfgj5gfu00"
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ mt: 2 }}
                              >
                                S'abonner maintenant
                              </Button>
                            </>
                          )}

                          {subscriptionStatus.details === 'trialing' && (
                            <Typography variant="body2" color="primary">
                              Vous êtes actuellement en période d'essai.
                            </Typography>
                          )}
                        </>
                      )}
                    </Box>
                  </CardContent>
                </StyledCard>
              </Grid>
            </Grid>
          ) : activeTab === 1 ? (
            <Box>
              <Card sx={{ mb: 3 }}>
                <CardHeader
                  title="Gestion des membres"
                  action={
                    (isAdmin || isSuperAdmin) && (
                      <AddMemberButton />
                    )
                  }
                />
                <Divider />
                <CardContent>
                  <Box sx={{ 
                    bgcolor: '#f5f5f5',
                    borderRadius: 2,
                    p: 3,
                    minHeight: '60vh',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundImage: 'radial-gradient(#e0e0e0 1px, transparent 1px)',
                    backgroundSize: '20px 20px'
                  }}>
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      gap: 6,
                      maxWidth: '1200px',
                      width: '100%'
                    }}>
                      {/* Première ligne : Rôles de bureau */}
                      <Paper 
                        elevation={2}
                        sx={{
                          p: 3,
                          borderRadius: 2,
                          bgcolor: 'background.paper',
                          width: 'fit-content',
                          mx: 'auto'
                        }}
                      >
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            textAlign: 'center', 
                            mb: 2,
                            fontWeight: 'bold',
                            color: 'primary.main'
                          }}
                        >
                          BUREAU
                        </Typography>
                        <Grid container spacing={4} justifyContent="center">
                          {/* Président */}
                          <Grid item>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                              <Paper
                                sx={{
                                  bgcolor: 'primary.main',
                                  color: 'primary.contrastText',
                                  p: 1.5,
                                  px: 3,
                                  borderRadius: 2,
                                  textAlign: 'center',
                                  position: 'relative',
                                  '&::after': {
                                    content: '""',
                                    position: 'absolute',
                                    bottom: -20,
                                    left: '50%',
                                    width: 2,
                                    height: 20,
                                    bgcolor: 'divider'
                                  }
                                }}
                              >
                                <Typography variant="subtitle1">Président</Typography>
                              </Paper>

                              <Box sx={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: 1,
                                minHeight: 'auto'
                              }}>
                                {members
                                  .filter(member => member.bureauRole === 'president')
                                  .map((member) => (
                                    <Box
                                      key={member.id}
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        p: 1,
                                        '&:hover': {
                                          bgcolor: 'action.hover',
                                          borderRadius: 1,
                                        },
                                      }}
                                    >
                                      <Avatar src={member.photoURL} sx={{ width: 32, height: 32 }}>
                                        {member.displayName?.[0]}
                                      </Avatar>
                                      <Box sx={{ flexGrow: 1 }}>
                                        <Typography variant="body2">
                                          {member.displayName}
                                        </Typography>
                                      </Box>
                                    </Box>
                                  ))}
                              </Box>
                            </Box>
                          </Grid>

                          {/* Vice-président */}
                          <Grid item>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                              <Paper
                                sx={{
                                  bgcolor: 'primary.main',
                                  color: 'primary.contrastText',
                                  p: 1.5,
                                  px: 3,
                                  borderRadius: 2,
                                  textAlign: 'center',
                                  position: 'relative',
                                  '&::after': {
                                    content: '""',
                                    position: 'absolute',
                                    bottom: -20,
                                    left: '50%',
                                    width: 2,
                                    height: 20,
                                    bgcolor: 'divider'
                                  }
                                }}
                              >
                                <Typography variant="subtitle1">Vice-président</Typography>
                              </Paper>

                              <Box sx={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: 1,
                                minHeight: 'auto'
                              }}>
                                {members
                                  .filter(member => member.bureauRole === 'vice-president')
                                  .map((member) => (
                                    <Box
                                      key={member.id}
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        p: 1,
                                        '&:hover': {
                                          bgcolor: 'action.hover',
                                          borderRadius: 1,
                                        },
                                      }}
                                    >
                                      <Avatar src={member.photoURL} sx={{ width: 32, height: 32 }}>
                                        {member.displayName?.[0]}
                                      </Avatar>
                                      <Box sx={{ flexGrow: 1 }}>
                                        <Typography variant="body2">
                                          {member.displayName}
                                        </Typography>
                                      </Box>
                                    </Box>
                                  ))}
                              </Box>
                            </Box>
                          </Grid>

                          {/* Secrétaire général */}
                          <Grid item>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                              <Paper
                                sx={{
                                  bgcolor: 'primary.main',
                                  color: 'primary.contrastText',
                                  p: 1.5,
                                  px: 3,
                                  borderRadius: 2,
                                  textAlign: 'center',
                                  position: 'relative',
                                  '&::after': {
                                    content: '""',
                                    position: 'absolute',
                                    bottom: -20,
                                    left: '50%',
                                    width: 2,
                                    height: 20,
                                    bgcolor: 'divider'
                                  }
                                }}
                              >
                                <Typography variant="subtitle1">Secrétaire général</Typography>
                              </Paper>

                              <Box sx={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: 1,
                                minHeight: 'auto'
                              }}>
                                {members
                                  .filter(member => member.bureauRole === 'secretaire')
                                  .map((member) => (
                                    <Box
                                      key={member.id}
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        p: 1,
                                        '&:hover': {
                                          bgcolor: 'action.hover',
                                          borderRadius: 1,
                                        },
                                      }}
                                    >
                                      <Avatar src={member.photoURL} sx={{ width: 32, height: 32 }}>
                                        {member.displayName?.[0]}
                                      </Avatar>
                                      <Box sx={{ flexGrow: 1 }}>
                                        <Typography variant="body2">
                                          {member.displayName}
                                        </Typography>
                                      </Box>
                                    </Box>
                                  ))}
                              </Box>
                            </Box>
                          </Grid>
                        </Grid>
                      </Paper>

                      {/* Deuxième ligne : Autres pôles */}
                      <Grid container spacing={4} justifyContent="center">
                        {POLES.filter(pole => 
                          !['pre', 'vice', 'sec'].includes(pole.id)
                        ).map((pole) => (
                          <Grid item key={pole.id}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                              <Paper
                                sx={{
                                  bgcolor: 'primary.main',
                                  color: 'primary.contrastText',
                                  p: 1.5,
                                  px: 3,
                                  borderRadius: 2,
                                  textAlign: 'center',
                                  position: 'relative',
                                  '&::after': {
                                    content: '""',
                                    position: 'absolute',
                                    bottom: -20,
                                    left: '50%',
                                    width: 2,
                                    height: 20,
                                    bgcolor: 'divider'
                                  }
                                }}
                              >
                                <Typography variant="subtitle1">{pole.name}</Typography>
                              </Paper>

                              <Box sx={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: 1,
                                minHeight: 'auto'
                              }}>
                                {members
                                  .filter(member => 
                                    member.poles?.some(p => p.poleId === pole.id) && 
                                    !(member.bureauRole === 'president' || 
                                      member.bureauRole === 'vice-president' || 
                                      member.bureauRole === 'secretaire')
                                  )
                                  .sort((a, b) => {
                                    const aIsResponsable = a.poles?.find(p => p.poleId === pole.id)?.isResponsable;
                                    const bIsResponsable = b.poles?.find(p => p.poleId === pole.id)?.isResponsable;
                                    return bIsResponsable ? 1 : aIsResponsable ? -1 : 0;
                                  })
                                  .map((member, index) => {
                                    const isResponsable = member.poles?.find(p => p.poleId === pole.id)?.isResponsable;
                                    return (
                                      <Box
                                        key={member.id}
                                        sx={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 2,
                                          p: 1,
                                          '&:hover': {
                                            bgcolor: 'action.hover',
                                            borderRadius: 1,
                                          },
                                          ...(isResponsable && {
                                            borderBottom: '1px solid',
                                            borderColor: 'divider',
                                            mb: 1,
                                            pb: 1
                                          })
                                        }}
                                      >
                                        <Avatar src={member.photoURL} sx={{ width: 32, height: 32 }}>
                                          {member.displayName?.[0]}
                                        </Avatar>
                                        <Box sx={{ flexGrow: 1 }}>
                                          <Typography 
                                            variant="body2" 
                                            sx={{ 
                                              fontWeight: isResponsable ? 'bold' : 'normal',
                                              color: isResponsable ? 'primary.main' : 'inherit'
                                            }}
                                          >
                                            {member.displayName}
                                          </Typography>
                                          {isResponsable && (
                                            <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold' }}>
                                              Responsable
                                            </Typography>
                                          )}
                                        </Box>
                                      </Box>
                                    );
                                  })}
                              </Box>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              {/* Dialogue d'ajout de membre */}
              <AddMemberDialog />
            </Box>
          ) : (
            <Box>
              <StyledCard sx={{ mb: 3 }}>
                <CardHeader
                  title={
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Gestion des membres
                    </Typography>
                  }
                  action={
                    (isAdmin || isSuperAdmin) && (
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <StyledButton
                          variant="contained"
                          startIcon={<PersonAddIcon />}
                          onClick={() => {
                            console.log("Bouton Ajouter un membre cliqué");
                            fetchAvailableUsers().then(() => {
                              setOpenAddMemberDialog(true);
                            });
                          }}
                        >
                          Ajouter un membre
                        </StyledButton>
                        <StyledButton
                          variant="outlined"
                          startIcon={<BadgeIcon />}
                          onClick={handleManagePoles}
                        >
                          Gérer les pôles
                        </StyledButton>
                      </Box>
                    )
                  }
                />
                <Divider />
                <CardContent>
                  <TableContainer 
                    component={Paper} 
                    sx={{ 
                      borderRadius: '16px',
                      boxShadow: 'none',
                      border: theme => `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      overflow: 'hidden'
                    }}
                  >
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Membre</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Rôle</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Pôles</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {members.map((member) => (
                          <StyledTableRow key={member.id}>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Avatar src={member.photoURL} sx={{ width: 32, height: 32 }}>
                                  {member.displayName?.[0]}
                                </Avatar>
                                <Box>
                                  <Typography variant="body2">{member.displayName}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {member.email}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>
                              {getRoleChip(member.role, member.status)}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {member.poles?.map((pole) => {
                                  const poleInfo = POLES.find(p => p.id === pole.poleId);
                                  return (
                                    <StyledChip 
                                      key={pole.poleId} 
                                      label={poleInfo?.name} 
                                      size="small"
                                      sx={{
                                        backgroundColor: alpha(getPoleColor(poleInfo?.name || ''), 0.15),
                                        color: getPoleColor(poleInfo?.name || ''),
                                        fontWeight: pole.isResponsable ? 700 : 400,
                                        border: pole.isResponsable ? `2px solid ${getPoleColor(poleInfo?.name || '')}` : 'none',
                                        '&:hover': {
                                          backgroundColor: alpha(getPoleColor(poleInfo?.name || ''), 0.25),
                                        },
                                        '& .MuiChip-label': {
                                          fontWeight: pole.isResponsable ? 700 : 400,
                                          fontSize: '0.875rem',
                                          px: 1.5,
                                        },
                                        height: '28px',
                                        borderRadius: '8px',
                                        transition: 'all 0.2s ease-in-out'
                                      }}
                                    />
                                  );
                                })}
                              </Box>
                            </TableCell>
                            <TableCell>
                              {isAdmin && (
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleStartEditPoles(member)}
                                    color="primary"
                                  >
                                    <EditIcon />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleOpenRemoveDialog(member)}
                                    color="error"
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </Box>
                              )}
                            </TableCell>
                          </StyledTableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </StyledCard>
              
              {/* Dialogue d'ajout de membre */}
              <StyledDialog
                open={openAddMemberDialog}
                onClose={handleCloseDialog}
                maxWidth="sm"
                fullWidth
              >
                <DialogTitle>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonAddIcon color="primary" />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Ajouter un membre
                    </Typography>
                  </Box>
                </DialogTitle>
                <DialogContent dividers>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
                    <FormControl fullWidth>
                      <InputLabel>Sélectionner un membre</InputLabel>
                      <Select
                        value={selectedUserId}
                        label="Sélectionner un membre"
                        onChange={(e) => setSelectedUserId(e.target.value as string)}
                        sx={{
                          borderRadius: '12px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: theme => alpha(theme.palette.primary.main, 0.2),
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: theme => theme.palette.primary.main,
                          },
                        }}
                      >
                        {availableUsers.map((user) => (
                          <MenuItem key={user.id} value={user.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <StyledAvatar 
                                src={user.photoURL} 
                                sx={{ width: 24, height: 24 }}
                              >
                                {user.displayName?.[0]}
                              </StyledAvatar>
                              <Typography>{user.displayName || user.email}</Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {selectedUserId && (
                      <>
                        <FormControl fullWidth>
                          <InputLabel>Rôle au bureau</InputLabel>
                          <Select
                            value={newMemberData.bureauRole || ''}
                            label="Rôle au bureau"
                            onChange={(e) => setNewMemberData(prev => ({
                              ...prev,
                              bureauRole: e.target.value as BureauRole
                            }))}
                            sx={{
                              borderRadius: '12px',
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: theme => alpha(theme.palette.primary.main, 0.2),
                              },
                              '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: theme => theme.palette.primary.main,
                              },
                            }}
                          >
                            <MenuItem value="">Aucun rôle au bureau</MenuItem>
                            {BUREAU_ROLES.map(role => (
                              <MenuItem key={role.id} value={role.id}>
                                {role.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>

                        <Typography 
                          variant="subtitle1" 
                          sx={{ 
                            fontWeight: 600,
                            color: theme => theme.palette.text.primary
                          }}
                        >
                          Sélection des pôles
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {POLES.map((pole) => (
                            <Paper 
                              key={pole.id} 
                              variant="outlined" 
                              sx={{ 
                                p: 1.5,
                                borderRadius: '12px',
                                borderColor: theme => alpha(theme.palette.divider, 0.1),
                                transition: 'all 0.2s ease-in-out',
                                '&:hover': {
                                  backgroundColor: theme => alpha(theme.palette.action.hover, 0.5),
                                }
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      checked={selectedPoles[pole.id] || false}
                                      onChange={(e) => setSelectedPoles(prev => ({
                                        ...prev,
                                        [pole.id]: e.target.checked
                                      }))}
                                      sx={{
                                        '& .MuiSvgIcon-root': {
                                          fontSize: 20,
                                        },
                                      }}
                                    />
                                  }
                                  label={
                                    <Typography variant="body2">
                                      {pole.name}
                                    </Typography>
                                  }
                                />
                                {selectedPoles[pole.id] && (
                                  <FormControlLabel
                                    control={
                                      <Checkbox
                                        checked={isResponsable[pole.id] || false}
                                        onChange={(e) => setIsResponsable(prev => ({
                                          ...prev,
                                          [pole.id]: e.target.checked
                                        }))}
                                        sx={{
                                          '& .MuiSvgIcon-root': {
                                            fontSize: 20,
                                          },
                                        }}
                                      />
                                    }
                                    label={
                                      <Typography 
                                        variant="body2" 
                                        color="primary"
                                        sx={{ fontWeight: 500 }}
                                      >
                                        Responsable
                                      </Typography>
                                    }
                                  />
                                )}
                              </Box>
                            </Paper>
                          ))}
                        </Box>
                      </>
                    )}
                  </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                  <StyledButton 
                    onClick={handleCloseDialog}
                    variant="outlined"
                    size="small"
                  >
                    Annuler
                  </StyledButton>
                  <StyledButton 
                    onClick={handleAddMember}
                    variant="contained"
                    size="small"
                    startIcon={<SaveIcon />}
                    disabled={!selectedUserId}
                  >
                    Ajouter
                  </StyledButton>
                </DialogActions>
              </StyledDialog>
            </Box>
          )}
        </>
      )}
      
      {/* Dialog pour changer le statut */}
      <Dialog open={openRoleDialog} onClose={() => setOpenRoleDialog(false)}>
        <DialogTitle>
          Modifier le statut de {selectedUser?.displayName}
        </DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="status-select-label">Statut</InputLabel>
            <Select
              labelId="status-select-label"
              value={selectedUser?.status || 'member'}
              label="Statut"
              onChange={(e: SelectChangeEvent) => {
                if (selectedUser) {
                  setSelectedUser({
                    ...selectedUser,
                    status: e.target.value as 'admin' | 'member'
                  });
                }
              }}
            >
              <MenuItem value="admin">Administrateur</MenuItem>
              <MenuItem value="member">Membre</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRoleDialog(false)}>Annuler</Button>
          <Button 
            onClick={handleConfirmRoleChange} 
            variant="contained" 
            color="primary"
          >
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar pour les notifications */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Dialog pour la gestion des pôles */}
      <Dialog open={openPoleDialog} onClose={() => setOpenPoleDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BadgeIcon color="primary" />
            <Typography variant="h6">
              Gestion des pôles
            </Typography>
          </Box>
          <Typography variant="subtitle2" color="text.secondary">
            {selectedUserForPole?.displayName}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={1}>
            {poles.map((pole) => (
              <Grid item xs={12} key={pole.id}>
                <Paper
                  variant="outlined"
                  sx={{ 
                    p: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={selectedPoles[pole.id] || false}
                        onChange={(e) => setSelectedPoles(prev => ({
                          ...prev,
                          [pole.id]: e.target.checked
                        }))}
                      />
                    }
                    label={
                      <Typography variant="body2">
                        {pole.name}
                      </Typography>
                    }
                  />
                  {selectedPoles[pole.id] && (
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={isResponsable[pole.id] || false}
                          onChange={(e) => setIsResponsable(prev => ({
                            ...prev,
                            [pole.id]: e.target.checked
                          }))}
                        />
                      }
                      label={
                        <Typography variant="body2" color="primary">
                          Responsable
                        </Typography>
                      }
                    />
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button 
            onClick={() => setOpenPoleDialog(false)}
            variant="outlined"
            size="small"
          >
            Annuler
          </Button>
          <Button 
            onClick={handleUpdateUserPoles}
            variant="contained"
            size="small"
            startIcon={<SaveIcon />}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog pour gérer les pôles (ajouter, modifier, supprimer) */}
      <Dialog open={openManagePolesDialog} onClose={() => setOpenManagePolesDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BadgeIcon color="primary" />
            <Typography variant="h6">
              Gestion des pôles
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            {/* Formulaire d'ajout de pôle */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                label="Nouveau pôle"
                variant="outlined"
                size="small"
                fullWidth
                value={newPoleName}
                onChange={(e) => setNewPoleName(e.target.value)}
              />
              <Button
                variant="contained"
                onClick={handleAddPole}
                disabled={!newPoleName.trim()}
                sx={{ mt: 0.5 }}
              >
                Ajouter
              </Button>
            </Box>

            <Divider />

            {/* Liste des pôles existants */}
            <Typography variant="subtitle1">Pôles existants</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {poles.map((pole) => (
                <Paper key={pole.id} variant="outlined" sx={{ p: 1.5 }}>
                  {editingPoleId === pole.id ? (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <TextField
                        label="Nom du pôle"
                        variant="outlined"
                        size="small"
                        fullWidth
                        value={editingPoleName}
                        onChange={(e) => setEditingPoleName(e.target.value)}
                      />
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSaveEditPole}
                        size="small"
                      >
                        Enregistrer
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={handleCancelEditPole}
                        size="small"
                      >
                        Annuler
                      </Button>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography>{pole.name}</Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleStartEditPole(pole.id, pole.name)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeletePole(pole.id)}
                        >
                          <RemoveCircleOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  )}
                </Paper>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenManagePolesDialog(false)}>
            Fermer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Boîte de dialogue pour confirmer le retrait d'un membre */}
      <Dialog
        open={confirmRemoveOpen}
        onClose={handleCloseRemoveDialog}
        aria-labelledby="confirm-remove-dialog-title"
      >
        <DialogTitle id="confirm-remove-dialog-title">
          Modification du statut du membre
        </DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir retirer <strong>{memberToRemove?.displayName}</strong> des membres de la structure ?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Cette action supprimera ses rôles et ses pôles, mais conservera son appartenance à la structure en tant qu'etudiant.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRemoveDialog}>Annuler</Button>
          <Button 
            onClick={handleRemoveMemberFromStructure} 
            color="warning"
            variant="contained"
          >
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmation d'annulation */}
      <Dialog
        open={cancelDialogOpen}
        onClose={() => !cancelling && setCancelDialogOpen(false)}
      >
        <DialogTitle>Confirmer l'annulation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Êtes-vous sûr de vouloir annuler votre abonnement ? 
            L'abonnement restera actif jusqu'à la fin de la période en cours, puis sera automatiquement annulé.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setCancelDialogOpen(false)} 
            disabled={cancelling}
          >
            Annuler
          </Button>
          <Button 
            onClick={handleCancelSubscription} 
            color="error" 
            variant="contained"
            disabled={cancelling}
          >
            {cancelling ? 'Annulation en cours...' : 'Confirmer l\'annulation'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog pour éditer les pôles d'un membre */}
      <Dialog 
        open={editingUserPoles !== null} 
        onClose={handleCancelEditPoles}
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BadgeIcon color="primary" />
            <Typography variant="h6">
              Modifier les pôles
            </Typography>
          </Box>
          <Typography variant="subtitle2" color="text.secondary">
            {editingUserPoles?.displayName}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {POLES.map((pole) => (
              <Paper 
                key={pole.id} 
                variant="outlined" 
                sx={{ 
                  p: 1.5,
                  borderRadius: '12px',
                  borderColor: theme => alpha(theme.palette.divider, 0.1),
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: theme => alpha(theme.palette.action.hover, 0.5),
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedPoles.includes(pole.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPoles([...selectedPoles, pole.id]);
                          } else {
                            setSelectedPoles(selectedPoles.filter(id => id !== pole.id));
                          }
                        }}
                        sx={{
                          '& .MuiSvgIcon-root': {
                            fontSize: 20,
                          },
                        }}
                      />
                    }
                    label={
                      <Typography variant="body2">
                        {pole.name}
                      </Typography>
                    }
                  />
                  {selectedPoles.includes(pole.id) && (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={editingUserPoles?.poles?.find(p => p.poleId === pole.id)?.isResponsable || false}
                          onChange={(e) => {
                            const updatedPoles = editingUserPoles?.poles?.map(p => 
                              p.poleId === pole.id 
                                ? { ...p, isResponsable: e.target.checked }
                                : p
                            ) || [];
                            setEditingUserPoles(prev => prev ? { ...prev, poles: updatedPoles } : null);
                          }}
                          sx={{
                            '& .MuiSvgIcon-root': {
                              fontSize: 20,
                            },
                          }}
                        />
                      }
                      label={
                        <Typography 
                          variant="body2" 
                          color="primary"
                          sx={{ fontWeight: 500 }}
                        >
                          Responsable
                        </Typography>
                      }
                    />
                  )}
                </Box>
              </Paper>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button 
            onClick={handleCancelEditPoles}
            variant="outlined"
            size="small"
          >
            Annuler
          </Button>
          <Button 
            onClick={handleSaveUserPoles}
            variant="contained"
            size="small"
            startIcon={<SaveIcon />}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Organization;  