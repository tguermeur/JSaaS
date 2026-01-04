import React, { useState, useEffect } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  styled,
  Divider,
  Typography,
  Tooltip,
  Avatar,
  Menu,
  MenuItem,
} from '@mui/material';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  Dashboard as DashboardIcon,
  Business as BusinessIcon,
  Work as WorkIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  AdminPanelSettings as AdminIcon,
  Group as GroupIcon,
  WorkHistory as WorkHistoryIcon,
  BusinessCenter as BusinessCenterIcon,
  AttachMoney as AttachMoneyIcon,
  Assessment as AssessmentIcon,
  AccountBalance as AccountBalanceIcon,
  Search as SearchIcon,
  Payment as PaymentIcon,
  People as PeopleIcon,
  Apps as AppsIcon,
  ChatBubbleOutline as ChatBubbleOutlineIcon,
  BarChart as BarChartIcon,
  ShoppingCart as ShoppingCartIcon,
  Description as DescriptionIcon,
  Forum as ForumIcon,
  Code as CodeIcon,
  Extension as ExtensionIcon,
  Logout as LogoutIcon,
  Assignment as AssignmentIcon,
  TextSnippet as TextSnippetIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Add as AddIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ICON_SIDEBAR_WIDTH = '64px';
const DETAIL_SIDEBAR_WIDTH = '240px';
const TOTAL_SIDEBAR_WIDTH = '304px';

// Sidebar gauche avec icônes uniquement (blanc)
const IconSidebar = styled(Box)(({ theme }) => ({
  width: ICON_SIDEBAR_WIDTH,
    backgroundColor: '#ffffff',
  height: 'calc(100vh - 64px)',
  marginTop: '64px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: '12px',
  paddingBottom: '12px',
  position: 'fixed',
  left: 0,
  zIndex: theme.zIndex.drawer - 1,
    borderRight: '1px solid #f0f0f0',
}));

// Sidebar droite avec liens détaillés (blanc)
const DetailSidebar = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'open'
})<{ open?: boolean }>(({ theme, open }) => ({
  width: DETAIL_SIDEBAR_WIDTH,
  backgroundColor: '#ffffff',
  height: 'calc(100vh - 64px)',
    marginTop: '64px',
  marginLeft: ICON_SIDEBAR_WIDTH,
  position: 'fixed',
  left: 0,
  zIndex: theme.zIndex.drawer,
  borderRight: '1px solid #f0f0f0',
  overflowY: 'auto',
  overflowX: 'hidden',
  transform: open ? 'translateX(0)' : 'translateX(-100%)',
  opacity: open ? 1 : 0,
  transition: theme.transitions.create(['transform', 'opacity'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.shorter,
    }),
  pointerEvents: open ? 'auto' : 'none',
}));

// Bouton d'icône dans la sidebar gauche
const IconButton = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'selected'
})<{ selected?: boolean }>(({ selected }) => ({
  width: '40px',
  height: '40px',
  borderRadius: '6px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '4px',
  cursor: 'pointer',
  backgroundColor: selected ? '#f3f4f6' : 'transparent',
  color: selected ? '#111827' : '#6b7280',
  transition: 'all 0.15s ease',
    '&:hover': {
    backgroundColor: selected ? '#f3f4f6' : '#f9fafb',
    color: '#111827',
  },
  '& svg': {
    fontSize: '20px',
  },
}));

// Bouton de lien dans la sidebar droite
const DetailListItemButton = styled(ListItemButton, {
  shouldForwardProp: (prop) => prop !== 'selected'
})<{ selected?: boolean }>(({ theme, selected }) => ({
  minHeight: 40,
  padding: '8px 16px',
  margin: '2px 8px',
  borderRadius: '6px',
  backgroundColor: selected ? '#f3f4f6' : 'transparent',
  '&:hover': {
    backgroundColor: selected ? '#f3f4f6' : '#f9fafb',
  },
    '& .MuiListItemIcon-root': {
    minWidth: '36px',
    color: selected ? '#111827' : '#6b7280',
  },
  '& .MuiListItemText-primary': {
      fontSize: '0.875rem',
    fontWeight: selected ? 500 : 400,
    color: selected ? '#111827' : '#374151',
  },
}));

const SectionTitle = styled(Typography)({
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#6b7280',
  padding: '16px 16px 8px 16px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
});

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface MenuItem {
  text: string;
  icon: React.ReactNode;
  path: string;
  section: string;
  iconSidebarIcon?: React.ReactNode; // Icône pour la sidebar gauche
}

const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, userData, logoutUser } = useAuth();
  const [structureType, setStructureType] = useState<'jobservice' | 'junior'>('jobservice');
  const [selectedSection, setSelectedSection] = useState<string>('crm');
  const [detailSidebarOpen, setDetailSidebarOpen] = useState<boolean>(false);
  const [structureLogo, setStructureLogo] = useState<string | null>(null);
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState<null | HTMLElement>(null);
  const userMenuOpen = Boolean(userMenuAnchorEl);
  
  const isSuperAdmin = userData?.status === "superadmin";
  const isAdmin = userData?.status === "admin";
  const isMember = userData?.status === "membre";
  const isEtudiant = userData?.status === "etudiant";
  const isEntreprise = userData?.status === "entreprise";
  const isAdminStructure = userData?.status === "admin_structure";
  
  // Déterminer si l'utilisateur est une Junior (accès complet)
  const isJuniorEntreprise = isAdminStructure || isAdmin || isMember || isSuperAdmin;

  // Charger le type de structure et le logo
  useEffect(() => {
    const loadStructureData = async () => {
      if (!currentUser) return;
      
      // Ne pas charger les données de structure pour les entreprises
      if (isEntreprise) {
        return;
      }

      try {
        // Récupérer le structureId de l'utilisateur
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const structureId = userDoc.data()?.structureId;

        if (structureId) {
          // Récupérer les données de la structure
          const structureDoc = await getDoc(doc(db, 'structures', structureId));
          if (structureDoc.exists()) {
            const data = structureDoc.data();
            setStructureType(data.structureType || 'jobservice');
            const logo = data?.logo;
            if (logo) {
              setStructureLogo(logo);
            }
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement des données de la structure:', error);
      }
    };

    loadStructureData();
  }, [currentUser, isEntreprise]);

  // Déterminer la section active basée sur le pathname
  useEffect(() => {
    const path = location.pathname;
    
    // Vérifier d'abord les chemins exacts, puis les chemins qui commencent par
    if (path.startsWith('/app/superadmin')) {
      setSelectedSection('superadmin');
    } else if (path.startsWith('/app/settings')) {
      setSelectedSection('settings');
    } else if (path.startsWith('/app/profile') || path.startsWith('/app/available-missions')) {
      setSelectedSection('personal');
    } else if (path.startsWith('/app/commercial') || path.startsWith('/app/audit') || path.startsWith('/prospect/') || path.startsWith('/app/tresorerie') || path.startsWith('/app/human-resources')) {
      setSelectedSection('poles');
    } else if (
      path.startsWith('/app/dashboard') || 
      path.startsWith('/app/organization') || 
      path.startsWith('/app/mission') || 
      path.startsWith('/app/etude') || 
      path.startsWith('/app/entreprises')
    ) {
      setSelectedSection('crm');
    }
    
    // Ouvrir la sidebar droite si on est sur une section qui nécessite la sidebar
    // Ne pas ouvrir pour /app/settings car on utilise maintenant les onglets
    if (path.startsWith('/app/profile') || path.startsWith('/app/available-missions')) {
      setDetailSidebarOpen(true);
    } else if (path.startsWith('/app/settings')) {
      // Fermer la sidebar pour les paramètres
      setDetailSidebarOpen(false);
    }
  }, [location.pathname]);

  // Fermer la sidebar droite quand on clique en dehors
  useEffect(() => {
    if (!detailSidebarOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Vérifier si le clic est en dehors de la sidebar droite
      const detailSidebar = document.querySelector('[data-detail-sidebar]');
      if (detailSidebar && !detailSidebar.contains(target)) {
        // Vérifier aussi que ce n'est pas un clic sur la sidebar gauche
        const iconSidebar = document.querySelector('[data-icon-sidebar]');
        if (!iconSidebar?.contains(target)) {
          setDetailSidebarOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [detailSidebarOpen]);

  const adminMenuItems: MenuItem[] = [
    {
      text: 'Tableau de bord',
      icon: <DashboardIcon />,
      iconSidebarIcon: <AppsIcon />,
      path: '/app/dashboard',
      section: 'crm',
    },
    {
      text: 'Organisation',
      icon: <BusinessCenterIcon />,
      iconSidebarIcon: <AppsIcon />,
      path: '/app/organization',
      section: 'crm',
    },
    {
      text: structureType === 'junior' ? 'Études' : 'Missions',
      icon: <WorkIcon />,
      iconSidebarIcon: <AppsIcon />,
      path: structureType === 'junior' ? '/app/etude' : '/app/mission',
      section: 'crm',
    },
    {
      text: 'Entreprises',
      icon: <BusinessIcon />,
      iconSidebarIcon: <AppsIcon />,
      path: '/app/entreprises',
      section: 'crm',
    },
    {
      text: 'Documents',
      icon: <FolderIcon />,
      iconSidebarIcon: <AppsIcon />,
      path: '/app/documents',
      section: 'crm',
    },
    {
      text: 'Commercial',
      icon: <SearchIcon />,
      iconSidebarIcon: <BarChartIcon />,
      path: '/app/commercial',
      section: 'poles',
    },
    {
      text: 'Audit',
      icon: <AssessmentIcon />,
      iconSidebarIcon: <BarChartIcon />,
      path: '/app/audit',
      section: 'poles',
    },
    {
      text: 'Trésorerie',
      icon: <AttachMoneyIcon />,
      iconSidebarIcon: <BarChartIcon />,
      path: '/app/tresorerie',
      section: 'poles',
    },
    {
      text: 'Ressources Humaines',
      icon: <GroupIcon />,
      iconSidebarIcon: <BarChartIcon />,
      path: '/app/human-resources',
      section: 'poles',
    },
    // Items de paramètres
    {
      text: 'Templates PDF',
      icon: <DescriptionIcon />,
      iconSidebarIcon: <SettingsIcon />,
      path: '/app/settings/templates',
      section: 'settings',
    },
    {
      text: 'Assignation des Templates',
      icon: <AssignmentIcon />,
      iconSidebarIcon: <SettingsIcon />,
      path: '/app/settings/template-assignment',
      section: 'settings',
    },
    {
      text: "Plans d'abonnement",
      icon: <PaymentIcon />,
      iconSidebarIcon: <SettingsIcon />,
      path: '/app/settings/billing',
      section: 'settings',
    },
    {
      text: 'Configuration structure',
      icon: <BusinessIcon />,
      iconSidebarIcon: <SettingsIcon />,
      path: '/app/settings/structure',
      section: 'settings',
    },
    {
      text: 'Gestion des accès',
      icon: <SecurityIcon />,
      iconSidebarIcon: <SettingsIcon />,
      path: '/app/settings/authorizations',
      section: 'settings',
    },
    {
      text: 'Types de mission',
      icon: <TextSnippetIcon />,
      iconSidebarIcon: <SettingsIcon />,
      path: '/app/settings/mission-descriptions',
      section: 'settings',
    },
    {
      text: 'Notifications',
      icon: <NotificationsIcon />,
      iconSidebarIcon: <SettingsIcon />,
      path: '/app/settings/notifications',
      section: 'settings',
    },
  ];

  // Menu pour les Étudiants
  const studentMenuItems: MenuItem[] = [
    {
      text: 'Espace Candidat',
      icon: <WorkIcon />,
      iconSidebarIcon: <WorkIcon />,
      path: '/app/available-missions',
      section: 'personal',
    },
    {
      text: 'Mes Missions',
      icon: <WorkHistoryIcon />,
      iconSidebarIcon: <WorkIcon />,
      path: '/app/profile?tab=missions',
      section: 'personal',
    },
    {
      text: 'Mon Profil & Documents',
      icon: <PersonIcon />,
      iconSidebarIcon: <PersonIcon />,
      path: '/app/profile',
      section: 'personal',
    },
  ];

  // Menu pour les Entreprises
  const companyMenuItems: MenuItem[] = [
    {
      text: 'Tableau de bord',
      icon: <DashboardIcon />,
      iconSidebarIcon: <DashboardIcon />,
      path: '/app/dashboard',
      section: 'crm',
    },
    {
      text: 'Facturation',
      icon: <AttachMoneyIcon />,
      iconSidebarIcon: <DashboardIcon />,
      path: '/app/billing-page',
      section: 'crm',
    },
  ];

  const superAdminMenuItems: MenuItem[] = [
    {
      text: 'SuperAdmin',
      icon: <AdminIcon />,
      iconSidebarIcon: <AdminIcon />,
      path: '/app/superadmin',
      section: 'superadmin',
    },
  ];

  // Organiser les items par section
  const getItemsBySection = (items: MenuItem[]) => {
    const sections: { [key: string]: MenuItem[] } = {};
    items.forEach(item => {
      if (!sections[item.section]) {
        sections[item.section] = [];
      }
      sections[item.section].push(item);
    });
    return sections;
  };

  // Obtenir les icônes uniques pour la sidebar gauche
  const getIconSidebarIcons = () => {
    const icons: { section: string; icon: React.ReactNode; items: MenuItem[] }[] = [];
    
    // Déterminer les items à afficher selon le rôle
    let allItems: MenuItem[] = [];
    if (isJuniorEntreprise) {
      allItems = adminMenuItems;
    } else if (isEntreprise) {
      allItems = companyMenuItems;
    } else if (isEtudiant) {
      allItems = studentMenuItems;
    }
    
    const sections = getItemsBySection(allItems);
    
    Object.keys(sections).forEach(section => {
      const sectionItems = sections[section];
      if (sectionItems.length > 0 && sectionItems[0].iconSidebarIcon) {
        icons.push({
          section,
          icon: sectionItems[0].iconSidebarIcon,
          items: sectionItems,
        });
      }
    });

    // Ajouter SuperAdmin si nécessaire
    if (isSuperAdmin && superAdminMenuItems.length > 0) {
      icons.push({
        section: 'superadmin',
        icon: superAdminMenuItems[0].iconSidebarIcon!,
        items: superAdminMenuItems,
      });
    }

    // Ajouter Espace Personnel comme section séparée pour les admins JE
    if (isJuniorEntreprise && studentMenuItems.length > 0) {
      icons.push({
        section: 'personal',
        icon: <PersonIcon />,
        items: studentMenuItems,
      });
    }

    return icons;
  };

  const iconSidebarIcons = getIconSidebarIcons();
  
  // Déterminer les items de menu selon le rôle
  let allMenuItems: MenuItem[] = [];
  if (isJuniorEntreprise) {
    // Filtrer les items de paramètres selon les permissions
    const filteredAdminMenuItems = adminMenuItems.filter(item => {
      // "Plans d'abonnement" seulement pour admin/superadmin
      if (item.path === '/app/settings/billing' && !isAdmin && !isSuperAdmin && !isAdminStructure) {
        return false;
      }
      // "Gestion des accès" pour admin/superadmin/member
      if (item.path === '/app/settings/authorizations' && !isAdmin && !isSuperAdmin && userData?.status !== 'membre' && !isAdminStructure) {
        return false;
      }
      return true;
    });
    allMenuItems = [...filteredAdminMenuItems, ...studentMenuItems];
  } else if (isEntreprise) {
    allMenuItems = companyMenuItems;
  } else if (isEtudiant) {
    allMenuItems = studentMenuItems;
  }
  
  const menuItemsBySection = getItemsBySection([
    ...allMenuItems,
    ...(isSuperAdmin ? superAdminMenuItems : [])
  ]);

  const getInitials = () => {
    if (!currentUser?.displayName) return '?';
    return currentUser.displayName
      .split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getSectionTitle = (section: string) => {
    const titles: { [key: string]: string } = {
      'crm': 'CRM',
      'poles': 'Pôles',
      'settings': 'Paramètres',
      'personal': 'Espace Personnel',
      'superadmin': 'SuperAdmin',
    };
    return titles[section] || section;
  };

  return (
    <>
      {/* Sidebar gauche avec icônes uniquement */}
      <IconSidebar data-icon-sidebar>
        {/* Logo de la structure en haut */}
        {structureLogo ? (
          <Avatar
            src={structureLogo}
            alt="Logo structure"
            variant="circular"
            sx={{
              width: 48,
              height: 48,
              backgroundColor: 'white',
              mb: 1.5,
              cursor: (isEtudiant || isEntreprise) ? 'default' : 'pointer',
              opacity: (isEtudiant || isEntreprise) ? 0.6 : 1,
              '& img': {
                objectFit: 'contain',
                p: 0.5,
                width: '90%',
                height: '90%'
              }
            }}
            onClick={(isEtudiant || isEntreprise) ? undefined : () => navigate('/app/dashboard')}
          />
        ) : (
          <Avatar
            sx={{
              width: 48,
              height: 48,
              bgcolor: '#10b981',
              color: '#ffffff',
              fontSize: '1.125rem',
              fontWeight: 600,
              mb: 1.5,
              cursor: (isEtudiant || isEntreprise) ? 'default' : 'pointer',
              opacity: (isEtudiant || isEntreprise) ? 0.6 : 1,
            }}
            onClick={(isEtudiant || isEntreprise) ? undefined : () => navigate('/app/dashboard')}
          >
            {getInitials().substring(0, 1)}
          </Avatar>
        )}
        <Divider sx={{ width: '80%', borderColor: '#e5e7eb', mb: 1.5 }} />
        
        {/* Icônes de sections */}
        {iconSidebarIcons.map(({ section, icon }) => (
          <IconButton
            key={section}
            selected={selectedSection === section}
            onClick={() => {
              // Pour les paramètres, naviguer directement sans ouvrir la sidebar
              if (section === 'settings') {
                navigate('/app/settings/structure');
                setDetailSidebarOpen(false);
              } else {
                setSelectedSection(section);
                setDetailSidebarOpen(true);
              }
            }}
          >
            {icon}
          </IconButton>
        ))}
        
        <Box sx={{ flexGrow: 1 }} />
        
        <Divider sx={{ width: '80%', borderColor: '#e5e7eb', mt: 'auto', mb: 1.5 }} />
        {/* Avatar utilisateur en bas */}
        <Avatar
          src={currentUser?.photoURL || undefined}
          sx={{
            width: 32,
            height: 32,
            bgcolor: '#6b7280',
            fontSize: '0.75rem',
            cursor: 'pointer',
            '&:hover': {
              opacity: 0.8,
            },
          }}
          onClick={(event) => setUserMenuAnchorEl(event.currentTarget)}
        >
          {!currentUser?.photoURL && getInitials()}
        </Avatar>
        
        {/* Menu utilisateur */}
        <Menu
          anchorEl={userMenuAnchorEl}
          open={userMenuOpen}
          onClose={() => setUserMenuAnchorEl(null)}
          onClick={() => setUserMenuAnchorEl(null)}
          PaperProps={{
            elevation: 0,
            sx: {
              overflow: 'visible',
              filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
              mt: 1.5,
              ml: 0.5,
              '& .MuiAvatar-root': {
                width: 32,
                height: 32,
                ml: -0.5,
                mr: 1,
              },
              '&:before': {
                content: '""',
                display: 'block',
                position: 'absolute',
                top: 0,
                left: 14,
                width: 10,
                height: 10,
                bgcolor: 'background.paper',
                transform: 'translateY(-50%) rotate(45deg)',
                zIndex: 0,
              },
            },
          }}
          transformOrigin={{ horizontal: 'left', vertical: 'bottom' }}
          anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              {currentUser?.displayName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {currentUser?.email}
            </Typography>
          </Box>
          <Divider />
          {!isEntreprise && (
            <MenuItem onClick={() => { setUserMenuAnchorEl(null); navigate('/app/available-missions'); }}>
              <ListItemIcon>
                <BusinessIcon fontSize="small" />
              </ListItemIcon>
              Missions disponibles
            </MenuItem>
          )}
          <MenuItem onClick={() => { setUserMenuAnchorEl(null); navigate('/app/profile'); }}>
            <ListItemIcon>
              <PersonIcon fontSize="small" />
            </ListItemIcon>
            Profil
          </MenuItem>
          {(isJuniorEntreprise) && (
            <MenuItem onClick={() => { setUserMenuAnchorEl(null); navigate('/app/settings/structure'); }}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              Paramètres
            </MenuItem>
          )}
          <Divider />
          <MenuItem onClick={async () => {
            setUserMenuAnchorEl(null);
            try {
              await logoutUser();
              navigate('/login');
            } catch (error) {
              console.error('Erreur lors de la déconnexion:', error);
            }
          }}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            Se déconnecter
          </MenuItem>
        </Menu>
      </IconSidebar>

      {/* Sidebar droite avec liens détaillés */}
      <DetailSidebar open={detailSidebarOpen} data-detail-sidebar>
        <Box sx={{ pt: 2 }}>
          {/* Titre de la section active */}
          <Typography
            variant="h6"
            sx={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#6b7280',
              px: 2,
              mb: 1,
            }}
          >
            {getSectionTitle(selectedSection)}
          </Typography>

          {/* Liste des items de la section active */}
          {menuItemsBySection[selectedSection]?.map((item) => {
            const isSelected = location.pathname === item.path || 
              (item.path !== '/app/dashboard' && 
               item.path !== '/app/organization' &&
               location.pathname.startsWith(item.path)) ||
              (item.path === '/app/commercial' && location.pathname.startsWith('/prospect/'));
            
            return (
              <ListItem key={item.text} disablePadding>
                <DetailListItemButton
                  onClick={() => {
                    navigate(item.path);
                    setSelectedSection(item.section);
                    // Fermer la sidebar droite après la navigation
                    setTimeout(() => {
                      setDetailSidebarOpen(false);
                    }, 200);
                  }}
                  selected={isSelected}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </DetailListItemButton>
              </ListItem>
            );
          })}
        </Box>
      </DetailSidebar>
          </>
  );
};

export default Sidebar; 