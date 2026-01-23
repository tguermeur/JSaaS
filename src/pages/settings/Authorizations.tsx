import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  useTheme,
  alpha,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  AvatarGroup,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormGroup,
  FormControlLabel,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  Divider,
  TextField,
  InputAdornment,
  CircularProgress,
  Tabs,
  Tab,
  Snackbar,
  Alert
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Business as BusinessIcon,
  AdminPanelSettings as AdminIcon,
  Security as SecurityIcon,
  Dashboard as DashboardIcon,
  BusinessCenter as BusinessCenterIcon,
  Work as WorkIcon,
  Assessment as AssessmentIcon,
  AttachMoney as AttachMoneyIcon,
  Lock as LockIcon
} from '@mui/icons-material';
import { 
  canAccessPage, 
  updatePagePermissions, 
  type UserStatus,
  type PagePermission 
} from '../../utils/permissions';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';

// Pôles par défaut
const DEFAULT_POLES = [
  { id: 'com', name: 'Communication' },
  { id: 'dev', name: 'Développement commercial' },
  { id: 'tre', name: 'Trésorerie' },
  { id: 'rh', name: 'Ressources humaines' },
  { id: 'aq', name: 'Audit / Qualité' },
  { id: 'pre', name: 'Président' },
  { id: 'sec', name: 'Secrétaire général' },
  { id: 'vice', name: 'Vice-président' }
];

interface StructureMember {
  id: string;
  displayName: string;
  email: string;
  status: 'admin' | 'member' | 'etudiant' | 'superadmin';
  structureId: string;
  photoURL?: string;
  poles?: Array<{
    poleId: string;
    isResponsable: boolean;
  }>;
}

interface PageAccess {
  id: string;
  name: string;
  role: string;
  icon: React.ReactNode;
  color: string;
}

interface Page {
  id: string;
  name: string;
  icon: React.ReactNode;
  access: PageAccess[];
  requiresTwoFactor?: boolean;
}

interface PagePermissionWithReadAccess {
  pageId: string;
  allowedRoles: UserStatus[];
  allowedPoles: string[];
  allowedMembers?: string[];
  readAccess?: {
    allowedRoles: UserStatus[];
    allowedPoles: string[];
    allowedMembers?: string[];
  };
}

const Authorizations: React.FC = () => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  
  // Définition des pages après la déclaration de theme
  const PAGES: Page[] = [
    {
      id: 'dashboard',
      name: 'Tableau de bord',
      icon: <DashboardIcon />,
      access: [
        { id: '1', name: 'Tous les membres', role: 'Accès général', icon: <GroupIcon />, color: theme.palette.info.main }
      ]
    },
    {
      id: 'organization',
      name: 'Organisation',
      icon: <BusinessCenterIcon />,
      access: [
        { id: '1', name: 'Admin', role: 'Modification', icon: <AdminIcon />, color: theme.palette.error.main },
        { id: '2', name: 'Tous les membres', role: 'Lecture', icon: <GroupIcon />, color: theme.palette.info.main }
      ]
    },
    {
      id: 'mission',
      name: 'Missions',
      icon: <WorkIcon />,
      access: [
        { id: '1', name: 'Admin', role: 'Modification', icon: <AdminIcon />, color: theme.palette.error.main },
        { id: '2', name: 'Tous les membres', role: 'Lecture', icon: <GroupIcon />, color: theme.palette.info.main }
      ]
    },
    {
      id: 'entreprises',
      name: 'Entreprises',
      icon: <BusinessIcon />,
      access: [
        { id: '1', name: 'Admin', role: 'Modification', icon: <AdminIcon />, color: theme.palette.error.main },
        { id: '2', name: 'Tous les membres', role: 'Lecture', icon: <GroupIcon />, color: theme.palette.info.main }
      ]
    },
    {
      id: 'commercial',
      name: 'Commercial',
      icon: <SearchIcon />,
      access: [
        { id: '1', name: 'Pôle Commercial', role: 'Pôle', icon: <BusinessIcon />, color: theme.palette.success.main }
      ]
    },
    {
      id: 'audit',
      name: 'Audit',
      icon: <AssessmentIcon />,
      access: [
        { id: '1', name: 'Pôle Audit', role: 'Pôle', icon: <BusinessIcon />, color: theme.palette.success.main }
      ]
    },
    {
      id: 'tresorerie',
      name: 'Trésorerie',
      icon: <AttachMoneyIcon />,
      access: [
        { id: '1', name: 'Admin', role: 'Modification', icon: <AdminIcon />, color: theme.palette.error.main },
        { id: '2', name: 'Pôle Commercial', role: 'Lecture', icon: <BusinessIcon />, color: theme.palette.success.main }
      ]
    },
    {
      id: 'rh',
      name: 'Ressources Humaines',
      icon: <GroupIcon />,
      access: [
        { id: '1', name: 'Pôle RH', role: 'Pôle', icon: <BusinessIcon />, color: theme.palette.success.main }
      ]
    },
    {
      id: 'users',
      name: 'Gestion des utilisateurs',
      icon: <PersonIcon />,
      access: [
        { id: '1', name: 'Admin', role: 'Administration', icon: <AdminIcon />, color: theme.palette.error.main }
      ]
    },
    {
      id: 'permissions',
      name: 'Gestion des permissions',
      icon: <SecurityIcon />,
      access: [
        { id: '1', name: 'Admin', role: 'Administration', icon: <AdminIcon />, color: theme.palette.error.main }
      ]
    },
    {
      id: 'encrypted-data',
      name: 'Données cryptées',
      icon: <LockIcon />,
      access: [
        { id: '1', name: 'Admin', role: 'Accès sécurisé', icon: <AdminIcon />, color: theme.palette.warning.main }
      ],
      requiresTwoFactor: true
    }
  ];
  
  // Tous les états
  const [editingPage, setEditingPage] = useState<PagePermissionWithReadAccess | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<StructureMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [accessTab, setAccessTab] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [poles, setPoles] = useState<typeof DEFAULT_POLES>(DEFAULT_POLES);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [pagePermissions, setPagePermissions] = useState<Record<string, {
    write: {
      allowedRoles: UserStatus[];
      allowedPoles: string[];
      allowedMembers: string[];
    };
    read: {
      allowedRoles: UserStatus[];
      allowedPoles: string[];
      allowedMembers: string[];
    };
  }>>({});

  // Tous les useEffect
  useEffect(() => {
    const checkUserStatus = async () => {
      if (!currentUser) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        setIsAdmin(userData?.status === 'admin');
        setIsSuperAdmin(userData?.status === 'superadmin');
        setIsMember(userData?.status === 'member');
      } catch (error) {
        console.error("Erreur lors de la vérification du statut:", error);
      }
    };

    checkUserStatus();
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadPermissions();
    }
  }, [currentUser]);

  const fetchData = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.data();

      if (!userData?.structureId) return;

      // Charger les pôles depuis Firestore
      const structureDoc = await getDoc(doc(db, 'structures', userData.structureId));
      if (structureDoc.exists()) {
        const structureData = structureDoc.data();
        const savedPoles = structureData.poles || DEFAULT_POLES;
        setPoles(savedPoles);
      }

      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('structureId', '==', userData.structureId));
      const snapshot = await getDocs(q);
      
      const membersList = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as StructureMember))
        .filter(user => user.status === 'member' || user.status === 'admin');

      setMembers(membersList);
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
      setSnackbar({
        open: true,
        message: "Erreur lors du chargement des données",
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async () => {
    if (!currentUser) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();

      if (!userData?.structureId) return;

      const permissions: Record<string, any> = {};

      for (const page of PAGES) {
        const writePermissionsRef = doc(db, 'structures', userData.structureId, 'permissions', page.id);
        const readPermissionsRef = doc(db, 'structures', userData.structureId, 'permissions', `${page.id}_read`);

        const [writeDoc, readDoc] = await Promise.all([
          getDoc(writePermissionsRef),
          getDoc(readPermissionsRef)
        ]);

        permissions[page.id] = {
          write: writeDoc.exists() ? writeDoc.data() : {
            allowedRoles: [],
            allowedPoles: [],
            allowedMembers: []
          },
          read: readDoc.exists() ? readDoc.data() : {
            allowedRoles: [],
            allowedPoles: [],
            allowedMembers: []
          }
        };
      }

      setPagePermissions(permissions);
    } catch (error) {
      console.error("Erreur lors du chargement des permissions:", error);
    }
  };

  // Si l'utilisateur n'est pas admin, superadmin ou membre, afficher un message d'accès refusé
  if (!isAdmin && !isSuperAdmin && !isMember) {
    return (
      <Box sx={{ 
        width: '100%', 
        px: { xs: 2, sm: 3, md: 4 },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh'
      }}>
        <Typography variant="h5" color="error" sx={{ mb: 2 }}>
          Accès refusé
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Vous n'avez pas les permissions nécessaires pour accéder à cette page.
        </Typography>
      </Box>
    );
  }

  // Filtrer les membres et pôles en fonction de la recherche
  const filteredMembers = members.filter(member => 
    member.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPoles = poles.filter(pole =>
    pole.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = async (pageId: string) => {
    try {
      if (!currentUser) return;

      // Récupérer les données de l'utilisateur pour obtenir structureId
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.data();

      if (!userData?.structureId) return;

      // Récupérer les permissions de modification
      const writePermissionsRef = doc(db, 'structures', userData.structureId, 'permissions', pageId);
      const writeDoc = await getDoc(writePermissionsRef);
      const writeData = writeDoc.exists() ? writeDoc.data() : {
        allowedRoles: [],
        allowedPoles: [],
        allowedMembers: []
      };

      // Récupérer les permissions de lecture
      const readPermissionsRef = doc(db, 'structures', userData.structureId, 'permissions', `${pageId}_read`);
      const readDoc = await getDoc(readPermissionsRef);
      const readData = readDoc.exists() ? readDoc.data() : {
        allowedRoles: [],
        allowedPoles: [],
        allowedMembers: []
      };

      setEditingPage({
        pageId,
        allowedRoles: writeData.allowedRoles || [],
        allowedPoles: writeData.allowedPoles || [],
        allowedMembers: writeData.allowedMembers || [],
        readAccess: {
          allowedRoles: readData.allowedRoles || [],
          allowedPoles: readData.allowedPoles || [],
          allowedMembers: readData.allowedMembers || []
        }
      });
      setOpenDialog(true);
    } catch (error) {
      console.error("Erreur lors du chargement des permissions:", error);
      setSnackbar({
        open: true,
        message: "Erreur lors du chargement des permissions",
        severity: 'error'
      });
    }
  };

  const handleSave = async () => {
    if (editingPage && currentUser) {
      try {
        setLoading(true);
        console.log("Début de l'enregistrement des permissions");
        console.log("Page en cours d'édition:", editingPage);

        // Récupérer les données de l'utilisateur pour obtenir structureId
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        const userData = userDocSnap.data();

        console.log("Données utilisateur:", userData);

        if (!userData?.structureId) {
          console.error("Structure ID non trouvé");
          setSnackbar({
            open: true,
            message: "Erreur : Structure ID non trouvé",
            severity: 'error'
          });
          return;
        }

        console.log("Structure ID trouvé:", userData.structureId);

        // Créer la référence pour les permissions de la page
        const pagePermissionsRef = doc(db, 'structures', userData.structureId, 'permissions', editingPage.pageId);
        console.log("Référence des permissions:", pagePermissionsRef.path);

        // Déduplication des tableaux avant sauvegarde
        const unique = <T,>(arr: T[] = []) => Array.from(new Set(arr));
        const permissionsData = {
          allowedRoles: unique(editingPage.allowedRoles),
          allowedPoles: unique(editingPage.allowedPoles),
          allowedMembers: unique(editingPage.allowedMembers || []),
          updatedAt: new Date(),
          updatedBy: currentUser.uid
        };

        console.log("Données à enregistrer:", permissionsData);

        // Sauvegarder les permissions de modification
        await setDoc(pagePermissionsRef, permissionsData);
        console.log("Permissions de modification enregistrées");
        
        // Sauvegarder les permissions de lecture
        const readPermissionsRef = doc(db, 'structures', userData.structureId, 'permissions', `${editingPage.pageId}_read`);
        console.log("Référence des permissions de lecture:", readPermissionsRef.path);

        // Pour le tableau de bord, s'assurer que tous les membres ont accès en lecture
        const readPermissionsData = editingPage.pageId === 'dashboard' ? {
          allowedRoles: ['member', 'admin', 'superadmin'] as UserStatus[],
          allowedPoles: [] as string[],
          allowedMembers: [] as string[],
          updatedAt: new Date(),
          updatedBy: currentUser.uid
        } : {
          allowedRoles: unique(editingPage.readAccess?.allowedRoles || []),
          allowedPoles: unique(editingPage.readAccess?.allowedPoles || []),
          allowedMembers: unique(editingPage.readAccess?.allowedMembers || []),
          updatedAt: new Date(),
          updatedBy: currentUser.uid
        };

        console.log("Données de lecture à enregistrer:", readPermissionsData);
        await setDoc(readPermissionsRef, readPermissionsData);
        console.log("Permissions de lecture enregistrées");

        // Mettre à jour l'état local des permissions
        setPagePermissions(prev => ({
          ...prev,
          [editingPage.pageId]: {
            write: {
              allowedRoles: editingPage.allowedRoles,
              allowedPoles: editingPage.allowedPoles,
              allowedMembers: editingPage.allowedMembers || []
            },
            read: {
              allowedRoles: readPermissionsData.allowedRoles,
              allowedPoles: readPermissionsData.allowedPoles,
              allowedMembers: readPermissionsData.allowedMembers
            }
          }
        }));

        // Mettre à jour l'interface utilisateur
        setOpenDialog(false);
        setEditingPage(null);
        setSnackbar({
          open: true,
          message: "Les autorisations ont été mises à jour avec succès",
          severity: 'success'
        });

      } catch (error) {
        console.error("Erreur détaillée lors de la sauvegarde des permissions:", error);
        setSnackbar({
          open: true,
          message: "Erreur lors de la sauvegarde des autorisations",
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    }
  };

  // Fonction pour afficher les accès
  const renderAccess = (permissions: {
    allowedRoles: UserStatus[];
    allowedPoles: string[];
    allowedMembers: string[];
  }) => {
    const access: PageAccess[] = [];

    // Si "Tous les membres" est sélectionné, on n'affiche que cette permission
    if (permissions.allowedRoles.includes('member')) {
      access.push({ 
        id: 'member', 
        name: 'Tous les membres', 
        role: 'Accès général', 
        icon: <GroupIcon />,
        color: theme.palette.info.main
      });
      return (
        <AvatarGroup max={4} sx={{ mr: 2 }}>
          {access.map((user) => (
            <Tooltip key={user.id} title={`${user.name} (${user.role})`}>
              <Avatar 
                sx={{ 
                  bgcolor: user.color,
                  width: 32,
                  height: 32,
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  '& .MuiSvgIcon-root': {
                    fontSize: '1.2rem',
                    color: 'white'
                  },
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  border: '2px solid white'
                }}
              >
                {user.icon}
              </Avatar>
            </Tooltip>
          ))}
        </AvatarGroup>
      );
    }

    // Sinon, on affiche les autres permissions comme avant
    if (permissions.allowedRoles.includes('admin')) {
      access.push({ 
        id: 'admin', 
        name: 'Admin', 
        role: 'Administration', 
        icon: <AdminIcon />,
        color: theme.palette.error.main
      });
    }

    // Ajouter les pôles
    permissions.allowedPoles.forEach(poleId => {
      const pole = poles.find(p => p.id === poleId);
      if (pole) {
        let poleIcon;
        switch (pole.id) {
          case 'com':
            poleIcon = <SearchIcon />;
            break;
          case 'dev':
            poleIcon = <BusinessIcon />;
            break;
          case 'tre':
            poleIcon = <AttachMoneyIcon />;
            break;
          case 'rh':
            poleIcon = <GroupIcon />;
            break;
          case 'aq':
            poleIcon = <AssessmentIcon />;
            break;
          default:
            poleIcon = <BusinessIcon />;
        }

        access.push({ 
          id: pole.id, 
          name: pole.name, 
          role: 'Pôle', 
          icon: poleIcon,
          color: theme.palette.success.main
        });
      }
    });

    // Ajouter les membres individuels
    permissions.allowedMembers.forEach(memberId => {
      const member = members.find(m => m.id === memberId);
      if (member) {
        access.push({ 
          id: member.id, 
          name: member.displayName, 
          role: member.status === 'admin' ? 'Admin' : 'Membre',
          icon: <PersonIcon />,
          color: member.status === 'admin' ? theme.palette.error.main : theme.palette.info.main
        });
      }
    });

    return (
      <AvatarGroup max={4} sx={{ mr: 2 }}>
        {access.map((user) => (
          <Tooltip key={user.id} title={`${user.name} (${user.role})`}>
            <Avatar 
              sx={{ 
                bgcolor: user.color,
                width: 32,
                height: 32,
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '& .MuiSvgIcon-root': {
                  fontSize: '1.2rem',
                  color: 'white'
                },
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                border: '2px solid white'
              }}
            >
              {user.icon}
            </Avatar>
          </Tooltip>
        ))}
      </AvatarGroup>
    );
  };

  // Fonction pour vérifier si la liste des membres doit être désactivée
  const isMembersListDisabled = accessTab === 0 
    ? editingPage?.allowedRoles?.includes('admin' as UserStatus) ?? false
    : editingPage?.readAccess?.allowedRoles?.includes('member' as UserStatus) ?? false;

  // Fonction pour vérifier si la liste des pôles et des membres individuels doit être désactivée
  const isPolesAndMembersDisabled = accessTab === 0
    ? editingPage?.allowedRoles?.includes('member' as UserStatus) ?? false
    : editingPage?.readAccess?.allowedRoles?.includes('member' as UserStatus) ?? false;

  // Fonction pour vérifier si un rôle est sélectionné
  const isRoleSelected = (role: UserStatus) => {
    if (!editingPage) return false;
    return accessTab === 0
      ? editingPage.allowedRoles?.includes(role) ?? false
      : editingPage.readAccess?.allowedRoles?.includes(role) ?? false;
  };

  // Fonction pour vérifier si un pôle est sélectionné
  const isPoleSelected = (poleId: string) => {
    if (!editingPage) return false;
    return accessTab === 0
      ? editingPage.allowedPoles?.includes(poleId) ?? false
      : editingPage.readAccess?.allowedPoles?.includes(poleId) ?? false;
  };

  // Fonction pour vérifier si un membre est sélectionné
  const isMemberSelected = (memberId: string) => {
    if (!editingPage) return false;
    return accessTab === 0
      ? editingPage.allowedMembers?.includes(memberId) ?? false
      : editingPage.readAccess?.allowedMembers?.includes(memberId) ?? false;
  };

  // Fonction pour gérer les changements de rôles
  const handleRoleChange = (role: UserStatus) => {
    if (!editingPage) return;

    if (accessTab === 0) {
      // Modification des permissions de modification
      if (role === 'member') {
        // Si on sélectionne "Tous les membres", on sélectionne aussi admin
        const newRoles = editingPage.allowedRoles.includes(role)
          ? [] // Si on désélectionne, on retire tout
          : ['member' as UserStatus, 'admin' as UserStatus]; // Si on sélectionne, on ajoute member + admin
        const newPoles = editingPage.allowedRoles.includes(role)
          ? [] // Si on désélectionne, on retire tout
          : poles.map(pole => pole.id); // Si on sélectionne, on ajoute tous les pôles
        setEditingPage({ 
          ...editingPage, 
          allowedRoles: newRoles,
          allowedPoles: newPoles
        });
      } else if (role === 'admin') {
        // Si on sélectionne admin, on ne sélectionne que admin (et ne touche pas à member)
        const newRoles = editingPage.allowedRoles.includes(role)
          ? editingPage.allowedRoles.filter(r => r !== role)
          : [...editingPage.allowedRoles, role].filter((v, i, arr) => arr.indexOf(v) === i); // Ajoute admin sans toucher à member
        setEditingPage({ ...editingPage, allowedRoles: newRoles });
      } else {
        // Pour les autres rôles, comportement normal
        const newRoles = editingPage.allowedRoles.includes(role)
          ? editingPage.allowedRoles.filter(r => r !== role)
          : [...editingPage.allowedRoles, role];
        setEditingPage({ ...editingPage, allowedRoles: newRoles });
      }
    } else {
      // Modification des permissions de lecture
      if (!editingPage.readAccess) {
        editingPage.readAccess = { allowedRoles: [], allowedPoles: [] };
      }

      if (role === 'member') {
        // Si on sélectionne "Tous les membres", on sélectionne aussi admin
        const newRoles = editingPage.readAccess.allowedRoles.includes(role)
          ? [] // Si on désélectionne, on retire tout
          : ['member' as UserStatus, 'admin' as UserStatus]; // Si on sélectionne, on ajoute member + admin
        const newPoles = editingPage.readAccess.allowedRoles.includes(role)
          ? [] // Si on désélectionne, on retire tout
          : poles.map(pole => pole.id); // Si on sélectionne, on ajoute tous les pôles
        setEditingPage({
          ...editingPage,
          readAccess: { 
            ...editingPage.readAccess,
            allowedRoles: newRoles,
            allowedPoles: newPoles
          }
        });
      } else if (role === 'admin') {
        // Pour l'admin en lecture, on ne sélectionne que admin
        const newRoles = editingPage.readAccess.allowedRoles.includes(role)
          ? editingPage.readAccess.allowedRoles.filter(r => r !== role)
          : ['admin' as UserStatus];
        setEditingPage({
          ...editingPage,
          readAccess: { ...editingPage.readAccess, allowedRoles: newRoles }
        });
      } else {
        // Pour les autres rôles, comportement normal
        const newRoles = editingPage.readAccess.allowedRoles.includes(role)
          ? editingPage.readAccess.allowedRoles.filter(r => r !== role)
          : [...editingPage.readAccess.allowedRoles, role];
        setEditingPage({
          ...editingPage,
          readAccess: { ...editingPage.readAccess, allowedRoles: newRoles }
        });
      }
    }
  };

  // Fonction pour gérer les changements de pôles
  const handlePoleChange = (poleId: string) => {
    if (!editingPage || isPolesAndMembersDisabled) return;

    if (accessTab === 0) {
      // Modification des permissions de modification
      const newPoles = editingPage.allowedPoles.includes(poleId)
        ? editingPage.allowedPoles.filter(p => p !== poleId)
        : [...editingPage.allowedPoles, poleId];
      setEditingPage({ ...editingPage, allowedPoles: newPoles });
    } else {
      // Modification des permissions de lecture
      if (!editingPage.readAccess) {
        editingPage.readAccess = { allowedRoles: [], allowedPoles: [] };
      }
      const newPoles = editingPage.readAccess.allowedPoles.includes(poleId)
        ? editingPage.readAccess.allowedPoles.filter(p => p !== poleId)
        : [...editingPage.readAccess.allowedPoles, poleId];
      setEditingPage({
        ...editingPage,
        readAccess: { ...editingPage.readAccess, allowedPoles: newPoles }
      });
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setAccessTab(newValue);
  };

  // Fonction pour gérer la sélection d'un membre individuel
  const handleMemberChange = (memberId: string) => {
    if (!editingPage) return;

    if (accessTab === 0) {
      // Modification des permissions de modification
      const newMembers = editingPage.allowedMembers?.includes(memberId)
        ? editingPage.allowedMembers.filter(id => id !== memberId)
        : [...(editingPage.allowedMembers || []), memberId];
      setEditingPage({ ...editingPage, allowedMembers: newMembers });
    } else {
      // Modification des permissions de lecture
      if (!editingPage.readAccess) {
        editingPage.readAccess = { allowedRoles: [], allowedPoles: [], allowedMembers: [] };
      }
      const newMembers = editingPage.readAccess.allowedMembers?.includes(memberId)
        ? editingPage.readAccess.allowedMembers.filter(id => id !== memberId)
        : [...(editingPage.readAccess.allowedMembers || []), memberId];
      setEditingPage({
        ...editingPage,
        readAccess: { ...editingPage.readAccess, allowedMembers: newMembers }
      });
    }
  };

  return (
    <Box sx={{ width: '100%', px: { xs: 2, sm: 3, md: 4 } }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ 
          fontWeight: 600,
          letterSpacing: '-0.5px',
          mb: 1
        }}>
          Gestion des autorisations
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Gérez les accès aux différentes pages de l'application
        </Typography>
      </Box>

      <Paper 
        elevation={0}
        sx={{ 
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: 2,
          overflow: 'hidden',
          width: '100%'
        }}
      >
        <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '25%', fontWeight: 600, py: 2 }}>Page</TableCell>
                  <TableCell sx={{ width: '30%', fontWeight: 600, py: 2 }}>Permissions de modification</TableCell>
                  <TableCell sx={{ width: '30%', fontWeight: 600, py: 2 }}>Permissions de lecture</TableCell>
                  <TableCell sx={{ width: '15%', fontWeight: 600, py: 2 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {PAGES.map((page) => (
                  <TableRow
                    key={page.id}
                    sx={{
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.02)
                      }
                    }}
                  >
                    <TableCell sx={{ py: 2.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="h6" sx={{ fontSize: '1.75rem' }}>
                          {page.icon}
                        </Typography>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 500, fontSize: '1.1rem' }}>
                            {page.name}
                          </Typography>
                          {page.requiresTwoFactor && (
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                color: theme.palette.warning.main,
                                fontStyle: 'italic',
                                display: 'block',
                                mt: 0.5
                              }}
                            >
                              ⚠️ Accès nécessitant une validation 2FA
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 2.5, verticalAlign: 'middle' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                        {renderAccess(pagePermissions[page.id]?.write || { allowedRoles: [], allowedPoles: [], allowedMembers: [] })}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 2.5, verticalAlign: 'middle' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                        {renderAccess(pagePermissions[page.id]?.read || { allowedRoles: [], allowedPoles: [], allowedMembers: [] })}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 2.5 }} align="right">
                      {(isAdmin || isSuperAdmin) && (
                        <IconButton 
                          size="small" 
                          onClick={() => handleEdit(page.id)}
                          sx={{ 
                            color: theme.palette.primary.main,
                            '&:hover': {
                              backgroundColor: alpha(theme.palette.primary.main, 0.1)
                            }
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Paper>

      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: 'none',
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }
        }}
      >
        <DialogTitle sx={{ 
          pb: 1,
          fontWeight: 500,
          fontSize: '1.25rem'
        }}>
          Modifier les accès
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={accessTab} 
              onChange={handleTabChange}
              aria-label="access tabs"
              sx={{
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 500,
                  minWidth: 120
                }
              }}
            >
              <Tab label="Modification" />
              <Tab label="Lecture" />
            </Tabs>
          </Box>

          <Box sx={{ p: 3 }}>
            {/* Barre de recherche */}
            <TextField
              fullWidth
              placeholder="Rechercher une personne ou un pôle..."
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: 2,
                  backgroundColor: alpha(theme.palette.background.paper, 0.6),
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: alpha(theme.palette.divider, 0.1),
                  }
                }
              }}
            />

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
                {/* Tous les admins */}
                <ListItem
                  button
                  onClick={() => handleRoleChange('admin' as UserStatus)}
                  sx={{
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.04)
                    }
                  }}
                >
                  <ListItemIcon>
                    <Avatar 
                      sx={{ 
                        width: 32, 
                        height: 32, 
                        bgcolor: theme.palette.primary.main,
                        fontSize: '0.875rem'
                      }}
                    >
                      A
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText 
                    primary="Tous les admins"
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      fontWeight: 500
                    }}
                  />
                  <Checkbox
                    checked={isRoleSelected('admin' as UserStatus)}
                    edge="end"
                  />
                </ListItem>

                {/* Tous les membres */}
                <ListItem
                  button
                  onClick={() => handleRoleChange('member' as UserStatus)}
                  sx={{
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.04)
                    }
                  }}
                >
                  <ListItemIcon>
                    <Avatar 
                      sx={{ 
                        width: 32, 
                        height: 32, 
                        bgcolor: theme.palette.secondary.main,
                        fontSize: '0.875rem'
                      }}
                    >
                      M
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText 
                    primary="Tous les membres"
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      fontWeight: 500
                    }}
                  />
                  <Checkbox
                    checked={isRoleSelected('member' as UserStatus)}
                    edge="end"
                  />
                </ListItem>

                <Divider sx={{ my: 2 }} />

                {/* Pôles */}
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    px: 2,
                    mb: 1,
                    color: theme.palette.text.secondary,
                    textTransform: 'uppercase',
                    fontSize: '0.75rem',
                    letterSpacing: '0.5px'
                  }}
                >
                  Pôles
                </Typography>

                {filteredPoles.map((pole) => (
                  <ListItem
                    key={pole.id}
                    button
                    onClick={() => handlePoleChange(pole.id)}
                    sx={{
                      borderRadius: 1,
                      mb: 1,
                      '&:hover': {
                        backgroundColor: !isPolesAndMembersDisabled ? alpha(theme.palette.primary.main, 0.04) : 'none'
                      },
                      opacity: isPolesAndMembersDisabled ? 0.5 : 1,
                      pointerEvents: isPolesAndMembersDisabled ? 'none' : 'auto'
                    }}
                  >
                    <ListItemIcon>
                      <Avatar 
                        sx={{ 
                          width: 32, 
                          height: 32, 
                          bgcolor: theme.palette.secondary.main,
                          fontSize: '0.875rem'
                        }}
                      >
                        {pole.name.charAt(0)}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText 
                      primary={pole.name}
                      primaryTypographyProps={{
                        fontSize: '0.875rem',
                        fontWeight: 500
                      }}
                    />
                    <Checkbox
                      checked={isPoleSelected(pole.id)}
                      edge="end"
                      disabled={isPolesAndMembersDisabled}
                    />
                  </ListItem>
                ))}

                <Divider sx={{ my: 2 }} />

                {/* Membres individuels */}
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    px: 2,
                    mb: 1,
                    color: theme.palette.text.secondary,
                    textTransform: 'uppercase',
                    fontSize: '0.75rem',
                    letterSpacing: '0.5px'
                  }}
                >
                  Membres
                </Typography>

                {filteredMembers.map((member) => (
                  <ListItem
                    key={member.id}
                    button
                    onClick={() => handleMemberChange(member.id)}
                    sx={{
                      borderRadius: 1,
                      mb: 1,
                      '&:hover': {
                        backgroundColor: (!isMembersListDisabled && !isPolesAndMembersDisabled) 
                          ? alpha(theme.palette.primary.main, 0.04) 
                          : 'none'
                      },
                      opacity: (isMembersListDisabled || isPolesAndMembersDisabled) ? 0.5 : 1,
                      pointerEvents: (isMembersListDisabled || isPolesAndMembersDisabled) ? 'none' : 'auto'
                    }}
                  >
                    <ListItemIcon>
                      <Avatar 
                        src={member.photoURL}
                        sx={{ 
                          width: 32, 
                          height: 32, 
                          bgcolor: member.status === 'admin' 
                            ? theme.palette.primary.main 
                            : theme.palette.secondary.main
                        }}
                      >
                        {member.displayName.charAt(0)}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText 
                      primary={member.displayName}
                      secondary={member.status === 'admin' ? 'Admin' : 'Membre'}
                      primaryTypographyProps={{
                        fontSize: '0.875rem',
                        fontWeight: 500
                      }}
                      secondaryTypographyProps={{
                        fontSize: '0.75rem'
                      }}
                    />
                    <Checkbox 
                      edge="end" 
                      checked={isMemberSelected(member.id)}
                      disabled={isMembersListDisabled || isPolesAndMembersDisabled}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
          <Button 
            onClick={() => setOpenDialog(false)}
            sx={{ 
              textTransform: 'none',
              color: theme.palette.text.secondary
            }}
          >
            Annuler
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained"
            sx={{ 
              textTransform: 'none',
              borderRadius: 2,
              px: 3
            }}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Authorizations;