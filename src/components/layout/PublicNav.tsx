import React, { useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  IconButton,
  Toolbar,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Menu, Close } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { tokens } from '../../theme/tokens';
import { useAuth } from '../../contexts/AuthContext';

export type PublicProfile = 'junior' | 'company' | 'student';

interface PublicNavProps {
  selectedProfile?: PublicProfile;
  onContactClick?: () => void;
  showPricing?: boolean;
}

const profileToFeatures: Record<PublicProfile, string> = {
  junior: '/features?profile=junior',
  company: '/features?profile=company',
  student: '/features?profile=student',
};

const PublicNav: React.FC<PublicNavProps> = ({
  selectedProfile = 'junior',
  onContactClick,
  showPricing = selectedProfile === 'junior',
}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const go = (path: string) => {
    setMobileOpen(false);
    navigate(path);
  };

  const navLinks = [
    { label: 'Accueil', path: '/' },
    { label: 'Fonctionnalités', path: profileToFeatures[selectedProfile] },
    ...(showPricing ? [{ label: 'Tarifs', path: '/pricing' }] : []),
    { label: 'Contact', path: null as string | null },
  ];

  const linkSx = {
    color: tokens.colors.ink,
    fontWeight: 400,
    fontSize: tokens.typography.body.fontSize,
    textTransform: 'none' as const,
    px: 1.5,
    '&:hover': { color: tokens.colors.ink, fontWeight: 600, opacity: 0.8 },
  };

  const ctaOutlinedSx = {
    color: tokens.colors.ink,
    borderColor: tokens.colors.ink,
    fontWeight: 400,
    fontSize: '0.85rem',
    textTransform: 'none' as const,
    borderRadius: tokens.radius.xxl,
    px: { xs: 2, sm: 3 },
    '&:hover': {
      borderColor: tokens.colors.ink,
      bgcolor: tokens.colors.ink,
      color: tokens.colors.marketingWhite,
    },
  };

  const handleContact = () => {
    setMobileOpen(false);
    if (onContactClick) onContactClick();
    else go('/#contact');
  };

  const mobileDrawer = (
    <Drawer
      anchor="right"
      open={mobileOpen}
      onClose={() => setMobileOpen(false)}
      PaperProps={{ sx: { width: 280, pt: 2 } }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 2, pb: 1 }}>
        <IconButton onClick={() => setMobileOpen(false)} aria-label="Fermer le menu">
          <Close />
        </IconButton>
      </Box>
      <List>
        {navLinks.map((link) => (
          <ListItem key={link.label} disablePadding>
            <ListItemButton
              onClick={() => (link.path ? go(link.path) : handleContact())}
            >
              <ListItemText primary={link.label} />
            </ListItemButton>
          </ListItem>
        ))}
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => go(isAuthenticated ? '/app/dashboard' : '/login')}
          >
            <ListItemText primary={isAuthenticated ? "Accéder à l'espace" : 'Connexion'} />
          </ListItemButton>
        </ListItem>
        {!isAuthenticated && (
          <ListItem disablePadding>
            <ListItemButton onClick={() => go('/register')}>
              <ListItemText primary="Inscription" />
            </ListItemButton>
          </ListItem>
        )}
      </List>
    </Drawer>
  );

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${tokens.colors.borderSoft}`,
          '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.95)' },
        }}
      >
        <Toolbar sx={{ minHeight: '56px !important', py: 1, px: { xs: 2, sm: 4 } }}>
          <Box
            component="img"
            src="/images/logo.png"
            alt="JS Connect"
            onClick={() => go('/')}
            sx={{ height: 36, cursor: 'pointer', mr: 2 }}
          />
          {!isMobile && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 4 }}>
              {navLinks.map((link) => (
                <Button
                  key={link.label}
                  onClick={() => (link.path ? go(link.path) : handleContact())}
                  sx={linkSx}
                >
                  {link.label}
                </Button>
              ))}
            </Box>
          )}
          <Box sx={{ flexGrow: 1 }} />
          {isMobile ? (
            <IconButton
              onClick={() => setMobileOpen(true)}
              sx={{ color: tokens.colors.textPrimary }}
              aria-label="Ouvrir le menu de navigation"
              aria-expanded={mobileOpen}
            >
              <Menu />
            </IconButton>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {isAuthenticated ? (
                <Button variant="outlined" onClick={() => go('/app/dashboard')} sx={ctaOutlinedSx}>
                  Accéder à l'espace
                </Button>
              ) : (
                <>
                  <Button variant="outlined" onClick={() => go('/login')} sx={ctaOutlinedSx}>
                    Connexion
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => go('/register')}
                    sx={{
                      bgcolor: tokens.colors.marketingBlack,
                      color: tokens.colors.marketingWhite,
                      textTransform: 'none',
                      borderRadius: tokens.radius.xxl,
                      px: 3,
                      boxShadow: 'none',
                      '&:hover': { opacity: 0.9, boxShadow: tokens.shadows.lg },
                    }}
                  >
                    Inscription
                  </Button>
                </>
              )}
            </Box>
          )}
        </Toolbar>
      </AppBar>
      <Toolbar sx={{ minHeight: '56px !important' }} />
      {mobileDrawer}
    </>
  );
};

export default PublicNav;
