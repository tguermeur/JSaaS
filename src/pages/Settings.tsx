import React from 'react';
import { Box, Typography, Tabs, Tab } from '@mui/material';
import { 
  Description as DescriptionIcon,
  Assignment as AssignmentIcon,
  Business as BusinessIcon,
  TextSnippet as TextSnippetIcon,
  Payment as PaymentIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Storage as StorageIcon,
  Settings as SettingsIcon,
  AccountTree as AccountTreeIcon,
  Psychology as PsychologyIcon
} from '@mui/icons-material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { tokens } from '../theme/tokens';
import { settingsPageStyles } from '../components/ds';

// Animations

interface TabItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  visible: boolean;
}

const Settings: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userData } = useAuth();
  const isSuperAdmin = userData?.status === 'superadmin';
  const isAdmin = userData?.status === 'admin';
  // Définir tous les onglets possibles - Structure en premier
  const allTabs: TabItem[] = [
    {
      label: 'Structure',
      path: '/app/settings/structure',
      icon: <BusinessIcon />,
      visible: true
    },
    {
      label: 'Templates PDF',
      path: '/app/settings/templates',
      icon: <DescriptionIcon />,
      visible: true
    },
    {
      label: 'Assignation',
      path: '/app/settings/template-assignment',
      icon: <AssignmentIcon />,
      visible: true
    },
    {
      label: 'Accès',
      path: '/app/settings/authorizations',
      icon: <SecurityIcon />,
      visible:
        isSuperAdmin ||
        isAdmin ||
        userData?.status === 'admin_structure' ||
        userData?.status === 'membre'
    },
    {
      label: 'Types de mission',
      path: '/app/settings/mission-descriptions',
      icon: <TextSnippetIcon />,
      visible: true
    },
    {
      label: 'IA Commercial',
      path: '/app/settings/scoring',
      icon: <PsychologyIcon />,
      visible: true
    },
    {
      label: 'Stockage',
      path: '/app/settings/storage',
      icon: <StorageIcon />,
      visible: true
    },
    {
      label: 'Abonnement',
      path: '/app/settings/billing',
      icon: <PaymentIcon />,
      visible: isSuperAdmin || isAdmin || userData?.status === 'admin_structure'
    },
    {
      label: 'Notifications',
      path: '/app/settings/notifications',
      icon: <NotificationsIcon />,
      visible: false // Temporairement masqué
    }
  ];

  // Filtrer les onglets visibles
  const visibleTabs = allTabs.filter(tab => tab.visible);

  // Trouver l'index de l'onglet actif
  const getActiveTabIndex = () => {
    const currentPath = location.pathname;
    const index = visibleTabs.findIndex(tab => currentPath === tab.path || currentPath.startsWith(tab.path + '/'));
    return index >= 0 ? index : 0;
  };

  const [activeTab, setActiveTab] = React.useState(getActiveTabIndex());

  // Mettre à jour l'onglet actif quand la route change
  React.useEffect(() => {
    setActiveTab(getActiveTabIndex());
  }, [location.pathname]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    navigate(visibleTabs[newValue].path);
  };

  // Si on est sur la page principale des paramètres, rediriger vers Structure
  const isMainSettings = location.pathname === '/app/settings';
  React.useEffect(() => {
    if (isMainSettings && visibleTabs.length > 0) {
      navigate('/app/settings/structure', { replace: true });
    }
  }, [isMainSettings, navigate]);

  return (
    <Box sx={{ ...settingsPageStyles.root, height: 'auto', minHeight: '100%' }}>
      <Box
        component="header"
        sx={{
          ...settingsPageStyles.header,
          flexDirection: 'column',
          alignItems: 'stretch',
          py: 0,
          px: 0,
          borderBottom: `1px solid ${tokens.colors.divider}`,
        }}
      >
        <Box sx={{ px: 3, pt: 2, pb: 0.5 }}>
          <Typography sx={settingsPageStyles.eyebrow}>Configuration</Typography>
          <Typography component="h1" sx={settingsPageStyles.title}>Paramètres</Typography>
        </Box>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 44,
            px: 1,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '0.875rem',
              minHeight: 44,
              paddingX: 2.5,
              paddingY: 1,
              color: tokens.colors.textSecondary,
              transition: tokens.transitions.fast,
              '&.Mui-selected': {
                color: tokens.colors.brandTeal,
                fontWeight: 600,
              },
              '&:hover': {
                color: tokens.colors.textPrimary,
                backgroundColor: 'transparent',
              },
              '& .MuiTab-iconWrapper': {
                marginRight: 1,
                '& svg': { fontSize: '1rem' },
              },
            },
            '& .MuiTabs-indicator': {
              height: 2,
              backgroundColor: tokens.colors.brandTeal,
              borderRadius: '1px 1px 0 0',
            },
            '& .MuiTabs-scrollButtons': {
              color: tokens.colors.textSecondary,
              '&.Mui-disabled': { opacity: 0.3 },
            },
          }}
        >
          {visibleTabs.map((tab) => (
            <Tab
              key={tab.path}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default Settings;