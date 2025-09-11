import React from 'react';
import { 
  Box, 
  Button, 
  useTheme 
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon 
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  to?: string;
  label?: string;
  sx?: any;
}

const BackButton: React.FC<BackButtonProps> = ({ 
  to = '/app/settings', 
  label = 'Retour aux paramètres',
  sx = {}
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Box sx={{ mb: 3, ...sx }}>
      <Button
        variant="outlined"
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(to)}
        sx={{
          borderRadius: '8px',
          textTransform: 'none',
          fontWeight: 500,
          borderColor: 'rgba(0, 0, 0, 0.12)',
          color: '#1d1d1f',
          '&:hover': {
            borderColor: 'rgba(0, 0, 0, 0.24)',
            backgroundColor: 'rgba(0, 0, 0, 0.04)'
          }
        }}
      >
        {label}
      </Button>
    </Box>
  );
};

export default BackButton; 