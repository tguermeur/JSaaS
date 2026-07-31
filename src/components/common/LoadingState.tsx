import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { tokens } from '../../theme/tokens';

interface LoadingStateProps {
  fullHeight?: boolean;
  message?: string;
  size?: number;
}

const LoadingState: React.FC<LoadingStateProps> = ({
  fullHeight = false,
  message,
  size = 40,
}) => {
  return (
    <Box
      role="status"
      aria-live="polite"
      aria-busy="true"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: fullHeight ? '60vh' : 200,
        py: 4,
      }}
    >
      <CircularProgress
        size={size}
        sx={{ color: tokens.colors.primary, mb: message ? 2 : 0 }}
      />
      {message ? (
        <Typography
          sx={{
            color: tokens.colors.textSecondary,
            fontSize: '14px',
          }}
        >
          {message}
        </Typography>
      ) : null}
    </Box>
  );
};

export default LoadingState;
