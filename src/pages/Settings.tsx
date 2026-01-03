import React from 'react';
import { 
  Box, 
  Typography, 
  Tabs,
  Tab,
  Container,
  useTheme,
  keyframes
} from '@mui/material';
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
  AccountTree as AccountTreeIcon
} from '@mui/icons-material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
  const theme = useTheme();

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
      visible: isSuperAdmin || isAdmin || userData?.status === 'member'
    },
    {
      label: 'Types de mission',
      path: '/app/settings/mission-descriptions',
      icon: <TextSnippetIcon />,
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
      visible: isSuperAdmin || isAdmin
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
    <Container maxWidth="xl" sx={{ py: 1.5, px: 3 }}>
      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        gap: 0
      }}>
        {/* Barre d'onglets - style Apple */}
        <Box sx={{ 
          borderBottom: '1px solid #e5e5ea',
          mb: 3
        }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 44,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.875rem',
                minHeight: 44,
                paddingX: 2.5,
                paddingY: 1,
                color: '#86868b',
                transition: 'color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                '&.Mui-selected': {
                  color: '#1d1d1f',
                  fontWeight: 600
                },
                '&:hover': {
                  color: '#1d1d1f',
                  backgroundColor: 'transparent'
                },
                '& .MuiTab-iconWrapper': {
                  marginRight: 1,
                  '& svg': {
                    fontSize: '1rem'
                  }
                }
              },
              '& .MuiTabs-indicator': {
                height: 2,
                backgroundColor: '#1d1d1f',
                borderRadius: '1px 1px 0 0'
              },
              '& .MuiTabs-scrollButtons': {
                color: '#86868b',
                '&.Mui-disabled': {
                  opacity: 0.3
                }
              }
            }}
          >
            {visibleTabs.map((tab, index) => (
              <Tab
                key={tab.path}
                label={tab.label}
                icon={tab.icon}
                iconPosition="start"
              />
            ))}
          </Tabs>
        </Box>

        {/* Contenu de la page */}
        <Box sx={{ mt: 2 }}>
          <Outlet />
        </Box>
      </Box>
    </Container>
  );
};

export default Settings;