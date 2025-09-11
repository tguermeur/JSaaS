import React from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  alpha,
  useTheme,
  keyframes,
  Container,
  Paper,
  Divider
} from '@mui/material';
import { 
  Description as DescriptionIcon,
  Assignment as AssignmentIcon,
  Business as BusinessIcon,
  TextSnippet as TextSnippetIcon,
  Payment as PaymentIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
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

const Settings: React.FC = () => {
  const location = useLocation();
  const isMainSettings = location.pathname === '/app/settings';
  const { userData } = useAuth();
  const isSuperAdmin = userData?.status === 'superadmin';
  const isAdmin = userData?.status === 'admin';
  const theme = useTheme();

  const renderSection = (title: string, items: Array<{
    icon: React.ReactNode;
    title: string;
    description: string;
    path: string;
  }>) => (
    <Box sx={{ mb: 4 }}>
      <Typography 
        variant="subtitle1" 
        sx={{ 
          mb: 2,
          fontWeight: 600,
          color: theme.palette.text.primary,
          fontSize: '1rem',
          letterSpacing: '0.5px'
        }}
      >
        {title}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((item, index) => (
          <Paper
            key={index}
            component={RouterLink}
            to={item.path}
            elevation={0}
            sx={{
              p: 2.5,
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              backgroundColor: alpha(theme.palette.background.paper, 0.6),
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              transition: 'all 0.2s ease-in-out',
              height: '80px',
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
                transform: 'translateX(8px)',
                borderColor: alpha(theme.palette.primary.main, 0.2),
              }
            }}
          >
            <Box sx={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: '12px',
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
              mr: 2,
              flexShrink: 0
            }}>
              {React.cloneElement(item.icon as React.ReactElement, {
                sx: { fontSize: 20 }
              })}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  fontWeight: 500,
                  color: theme.palette.text.primary,
                  fontSize: '1rem',
                  mb: 0.5,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {item.title}
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: theme.palette.text.secondary,
                  fontSize: '0.875rem',
                  lineHeight: 1.4,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {item.description}
              </Typography>
            </Box>
            <ArrowForwardIcon sx={{ 
              color: theme.palette.text.secondary,
              fontSize: 20,
              ml: 2,
              flexShrink: 0
            }} />
          </Paper>
        ))}
      </Box>
    </Box>
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        gap: 4
      }}>
        <Typography 
          variant="h4" 
          sx={{ 
            mb: 3,
            fontWeight: 700,
            fontSize: '2.5rem',
            background: 'linear-gradient(45deg, #0071e3, #34c759)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: `${fadeIn} 0.5s ease-out`
          }}
        >
          Paramètres
        </Typography>
        
        {isMainSettings ? (
          <Grid container spacing={6}>
            <Grid item xs={12} md={6}>
              <Box sx={{ 
                pr: { md: 3 },
                borderRight: { md: `1px solid ${alpha(theme.palette.divider, 0.1)}` }
              }}>
                {renderSection('Documents', [
                  {
                    icon: <DescriptionIcon />,
                    title: 'Templates PDF',
                    description: 'Gérer les modèles de documents',
                    path: '/app/settings/templates'
                  },
                  {
                    icon: <AssignmentIcon />,
                    title: 'Assignation des Templates',
                    description: 'Associer les templates aux types de documents',
                    path: '/app/settings/template-assignment'
                  }
                ])}

                {(isSuperAdmin || isAdmin) && (
                  renderSection('Facturation', [
                    {
                      icon: <PaymentIcon />,
                      title: "Plans d'abonnement",
                      description: 'Gérer votre abonnement',
                      path: '/app/settings/billing'
                    }
                  ])
                )}
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ pl: { md: 3 } }}>
                {renderSection('Structure & Autorisations', [
                  {
                    icon: <BusinessIcon />,
                    title: 'Configuration structure',
                    description: 'Paramètres généraux et programmes',
                    path: '/app/settings/structure'
                  },
                  ...(isSuperAdmin || isAdmin || userData?.status === 'member' ? [{
                    icon: <SecurityIcon />,
                    title: 'Gestion des accès',
                    description: 'Gérer les autorisations par utilisateur et par pôle',
                    path: '/app/settings/authorizations'
                  }] : [])
                ])}

                {renderSection('Types de mission', [
                  {
                    icon: <TextSnippetIcon />,
                    title: 'Types de mission',
                    description: 'Gérer les différents types de mission',
                    path: '/app/settings/mission-descriptions'
                  }
                ])}

                {renderSection('Préférences', [
                  {
                    icon: <NotificationsIcon />,
                    title: 'Notifications',
                    description: 'Configurer vos préférences de notifications',
                    path: '/app/settings/notifications'
                  }
                ])}
              </Box>
            </Grid>
          </Grid>
        ) : (
          <Box sx={{ 
            backgroundColor: alpha(theme.palette.background.paper, 0.6),
            backdropFilter: 'blur(10px)',
            borderRadius: '24px',
            p: 4,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
          }}>
            <Outlet />
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default Settings; 