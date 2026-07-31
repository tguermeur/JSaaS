import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { tokens } from '../../theme/tokens';
import { fadeIn } from '../../styles/animations';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 3,
        animation: `${fadeIn} 0.6s ease-out`,
      }}
    >
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: tokens.radius.xl,
          background: tokens.colors.primaryAlpha10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 3,
          '& svg': {
            fontSize: 40,
            color: tokens.colors.primary,
          },
        }}
      >
        {icon}
      </Box>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 600,
          color: tokens.colors.textPrimary,
          mb: 1,
          textAlign: 'center',
        }}
      >
        {title}
      </Typography>
      {description && (
        <Typography
          sx={{
            color: tokens.colors.textSecondary,
            fontSize: '14px',
            textAlign: 'center',
            maxWidth: 400,
            mb: action ? 3 : 0,
          }}
        >
          {description}
        </Typography>
      )}
      {action && (
        <Button
          variant="contained"
          startIcon={action.icon}
          onClick={action.onClick}
          sx={{
            borderRadius: tokens.radius.md,
            px: 3,
            py: 1,
            textTransform: 'none',
            boxShadow: tokens.shadows.button,
          }}
        >
          {action.label}
        </Button>
      )}
    </Box>
  );
};

export default EmptyState;
