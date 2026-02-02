import React from 'react';
import { Box, Typography, Button, Avatar } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import PersonIcon from '@mui/icons-material/Person';
import VisibilityIcon from '@mui/icons-material/Visibility';

const ImpersonationBanner: React.FC = () => {
  const { isImpersonating, impersonatedUserData, originalUserData, stopImpersonation } = useAuth();

  if (!isImpersonating || !impersonatedUserData) {
    return null;
  }

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      'etudiant': 'Étudiant',
      'membre': 'Membre',
      'admin': 'Admin',
      'admin_structure': 'Admin Structure',
      'superadmin': 'Super Admin',
      'entreprise': 'Entreprise',
    };
    return labels[status] || status;
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: '#dc2626',
        color: 'white',
        py: 1,
        px: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      }}
    >
      <VisibilityIcon sx={{ fontSize: 20 }} />
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          Mode "Run as" actif - Vous visualisez l'application en tant que :
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, px: 1.5, py: 0.5 }}>
          <Avatar
            src={impersonatedUserData.photoURL || undefined}
            sx={{ width: 24, height: 24, bgcolor: 'rgba(255,255,255,0.3)' }}
          >
            {!impersonatedUserData.photoURL && <PersonIcon sx={{ fontSize: 16 }} />}
          </Avatar>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {impersonatedUserData.displayName || impersonatedUserData.email}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.9, ml: 0.5 }}>
            ({getStatusLabel(impersonatedUserData.status)})
          </Typography>
        </Box>
      </Box>

      <Button
        variant="contained"
        size="small"
        startIcon={<ExitToAppIcon />}
        onClick={stopImpersonation}
        sx={{
          backgroundColor: 'white',
          color: '#dc2626',
          fontWeight: 600,
          '&:hover': {
            backgroundColor: '#f3f4f6',
          },
        }}
      >
        Revenir à mon compte ({originalUserData?.email})
      </Button>
    </Box>
  );
};

export default ImpersonationBanner;
