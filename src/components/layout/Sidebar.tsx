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
  Collapse
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
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const CLOSED_WIDTH = '64px';
const OPEN_WIDTH = '280px';

const StyledDrawer = styled(Drawer)(({ theme }) => ({
  width: CLOSED_WIDTH,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  '& .MuiDrawer-paper': {
    width: CLOSED_WIDTH,
    backgroundColor: '#ffffff',
    borderRight: '1px solid #f0f0f0',
    marginTop: '64px',
    height: 'calc(100% - 64px)',
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.shorter,
    }),
    '&:hover': {
      width: OPEN_WIDTH,
      '& .MuiListItemText-root': {
        display: 'block',
        opacity: 1,
      }
    }
  },
}));

const StyledListItemButton = styled(ListItemButton, {
  shouldForwardProp: (prop) => prop !== 'selected'
})<{ selected?: boolean }>(({ theme, selected }) => ({
  minHeight: 48,
  marginBottom: 4,
  marginLeft: 8,
  marginRight: 8,
  borderRadius: '8px',
  justifyContent: 'center',
  padding: '10px 12px',
  
  // État normal
  '& .MuiListItemIcon-root': {
    minWidth: 'auto',
    marginRight: 0,
    color: selected ? '#2E3B7C' : 'rgba(0, 0, 0, 0.54)',
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.shorter,
    }),
  },
  
  // État sélectionné
  ...(selected && {
    backgroundColor: 'rgba(46, 59, 124, 0.08)',
    '&:hover': {
      backgroundColor: 'rgba(46, 59, 124, 0.12)',
    },
    '& .MuiTypography-root': {
      fontWeight: 600,
      color: '#2E3B7C',
    },
  }),
  
  // Ajuster le style quand la sidebar est en hover
  '.MuiDrawer-paper:hover &': {
    justifyContent: 'flex-start',
    '& .MuiListItemIcon-root': {
      marginRight: 10,
    },
  },
  
  // État hover
  '&:hover': {
    backgroundColor: selected ? 'rgba(46, 59, 124, 0.12)' : 'rgba(0, 0, 0, 0.04)',
    '& .MuiListItemIcon-root': {
      color: '#2E3B7C',
    },
    '& .MuiTypography-root': {
      color: '#2E3B7C',
    },
  },
  
  // Style du texte
  '& .MuiListItemText-root': {
    display: 'none',
    opacity: 0,
    margin: 0,
    marginLeft: 10,
    transition: theme.transitions.create(['opacity', 'display'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.shorter,
    }),
    '& .MuiTypography-root': {
      fontSize: '0.875rem',
      fontWeight: selected ? 600 : 400,
    },
  },
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'rgba(0, 0, 0, 0.6)',
  padding: '16px 12px 8px 12px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  display: 'none',
  '.MuiDrawer-paper:hover &': {
    display: 'block',
  }
}));

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, userData } = useAuth();
  const [structureType, setStructureType] = useState<'jobservice' | 'junior'>('jobservice');
  
  const isSuperAdmin = userData?.status === "superadmin";
  const isAdmin = userData?.status === "admin";
  const isMember = userData?.status === "member";

  // Charger le type de structure
  useEffect(() => {
    const loadStructureType = async () => {
      if (userData?.structureId) {
        try {
          const structureDoc = await getDoc(doc(db, 'structures', userData.structureId));
          if (structureDoc.exists()) {
            const data = structureDoc.data();
            setStructureType(data.structureType || 'jobservice');
          }
        } catch (error) {
          console.error('Erreur lors du chargement du type de structure:', error);
        }
      }
    };

    loadStructureType();
  }, [userData?.structureId]);

  // Ajout d'un log pour déboguer
  console.log("Statut utilisateur:", userData?.status);
  console.log("isMember:", isMember);
  console.log("isAdmin:", isAdmin);
  console.log("isSuperAdmin:", isSuperAdmin);
  console.log("Type de structure:", structureType);

  const adminMenuItems = [
    {
      text: 'Tableau de bord',
      icon: <DashboardIcon />,
      path: '/app/dashboard',
    },
    {
      text: 'Organisation',
      icon: <BusinessCenterIcon />,
      path: '/app/organization',
    },
    {
      text: structureType === 'junior' ? 'Études' : 'Missions',
      icon: <WorkIcon />,
      path: structureType === 'junior' ? '/app/etude' : '/app/mission',
    },
    {
      text: 'Entreprises',
      icon: <BusinessIcon />,
      path: '/app/entreprises',
    },
    {
      text: 'Commercial',
      icon: <SearchIcon />,
      path: '/app/commercial',
    },
    {
      text: 'Audit',
      icon: <AssessmentIcon />,
      path: '/app/audit',
    },
    {
      text: 'Trésorerie',
      icon: <AttachMoneyIcon />,
      path: '/app/tresorerie',
    },
    {
      text: 'Ressources Humaines',
      icon: <GroupIcon />,
      path: '/app/human-resources',
    },
    {
      text: 'Paramètres',
      icon: <SettingsIcon />,
      path: '/app/settings',
    },
  ];

  const studentMenuItems = [
    {
      text: 'Profil',
      icon: <PersonIcon />,
      path: '/app/profile',
    },
    {
      text: 'Missions disponibles',
      icon: <WorkIcon />,
      path: '/app/available-missions',
    },

  ];

  const superAdminMenuItems = [
    {
      text: 'SuperAdmin',
      icon: <AdminIcon />,
      path: '/app/superadmin',
    },
  ];

  // Déterminer quels éléments du menu afficher
  const menuItems = (isAdmin || isSuperAdmin || isMember) ? adminMenuItems : studentMenuItems;

  return (
    <StyledDrawer
      variant="permanent"
      anchor="left"
      open={true}
    >
      <List sx={{ width: '100%', p: 1 }}>
        {/* Section Administration */}
        {(isAdmin || isSuperAdmin || isMember) && (
          <>
            <SectionTitle>
              Administration
            </SectionTitle>
            {adminMenuItems.map((item, index) => (
              <ListItem key={item.text || `admin-item-${index}`} disablePadding>
                <Tooltip title={item.text} placement="right" arrow>
                  <StyledListItemButton
                    onClick={() => navigate(item.path)}
                    selected={location.pathname === item.path}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText 
                      primary={item.text}
                      primaryTypographyProps={{
                        noWrap: true,
                      }}
                    />
                  </StyledListItemButton>
                </Tooltip>
              </ListItem>
            ))}
            <Divider sx={{ my: 1, display: 'none', '.MuiDrawer-paper:hover &': { display: 'block' } }} />
          </>
        )}

        {/* Section Étudiant */}
        {(!isAdmin && !isSuperAdmin && !isMember) || isMember || isAdmin || isSuperAdmin ? (
          <>
            <SectionTitle>
              Espace Personnel
            </SectionTitle>
            {studentMenuItems.map((item, index) => (
              <ListItem key={item.text || `student-item-${index}`} disablePadding>
                <Tooltip title={item.text} placement="right" arrow>
                  <StyledListItemButton
                    onClick={() => navigate(item.path)}
                    selected={location.pathname === item.path}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText 
                      primary={item.text}
                      primaryTypographyProps={{
                        noWrap: true,
                      }}
                    />
                  </StyledListItemButton>
                </Tooltip>
              </ListItem>
            ))}
          </>
        ) : null}

        {/* Section SuperAdmin */}
        {isSuperAdmin && (
          <>
            <Divider sx={{ my: 1, display: 'none', '.MuiDrawer-paper:hover &': { display: 'block' } }} />
            <SectionTitle>
              SuperAdmin
            </SectionTitle>
            {superAdminMenuItems.map((item, index) => (
              <ListItem key={item.text || `superadmin-item-${index}`} disablePadding>
                <Tooltip title={item.text} placement="right" arrow>
                  <StyledListItemButton
                    onClick={() => navigate(item.path)}
                    selected={location.pathname === item.path}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText 
                      primary={item.text}
                      primaryTypographyProps={{
                        noWrap: true,
                      }}
                    />
                  </StyledListItemButton>
                </Tooltip>
              </ListItem>
            ))}
          </>
        )}
      </List>
    </StyledDrawer>
  );
};

export default Sidebar; 