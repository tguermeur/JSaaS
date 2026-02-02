import React from 'react';
import { Box, Typography, Button, Paper, alpha, useTheme } from '@mui/material';
import { Lock as LockIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface AccessDeniedProps {
  title?: string;
  message?: string;
  showBackButton?: boolean;
  backPath?: string;
}

/**
 * Composant d'affichage quand l'accès à une page est refusé
 */
const AccessDenied: React.FC<AccessDeniedProps> = ({
  title = "Accès refusé",
  message = "Vous n'avez pas les permissions nécessaires pour accéder à cette page. Contactez votre administrateur si vous pensez qu'il s'agit d'une erreur.",
  showBackButton = true,
  backPath = '/app/dashboard',
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        p: 3,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: 3,
          textAlign: 'center',
          maxWidth: 450,
          backgroundColor: alpha(theme.palette.background.paper, 0.8),
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            backgroundColor: alpha(theme.palette.error.main, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 3,
          }}
        >
          <LockIcon
            sx={{
              fontSize: 40,
              color: theme.palette.error.main,
            }}
          />
        </Box>

        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            color: theme.palette.text.primary,
            mb: 2,
          }}
        >
          {title}
        </Typography>

        <Typography
          variant="body1"
          sx={{
            color: theme.palette.text.secondary,
            mb: 3,
            lineHeight: 1.6,
          }}
        >
          {message}
        </Typography>

        {showBackButton && (
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(backPath)}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500,
              px: 3,
            }}
          >
            Retour au tableau de bord
          </Button>
        )}
      </Paper>
    </Box>
  );
};

export default AccessDenied;
