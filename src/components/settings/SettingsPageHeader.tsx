import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { tokens } from '../../theme/tokens';

interface SettingsPageHeaderProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
}

const SettingsPageHeader: React.FC<SettingsPageHeaderProps> = ({ 
  title, 
  subtitle, 
  icon, 
  action 
}) => {
  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: tokens.radius.lg,
              background: tokens.gradients.brand,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 8px 32px ${tokens.colors.primaryAlpha20}`
            }}
          >
            {React.cloneElement(icon as React.ReactElement, { sx: { color: 'white', fontSize: 28 } })}
          </Box>
          <Box>
            <Typography variant="h4" sx={{ 
              fontWeight: 700, 
              color: tokens.colors.textPrimary,
              mb: 0.5
            }}>
              {title}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.1rem' }}>
              {subtitle}
            </Typography>
          </Box>
        </Box>
        
        {action && (
          <Box>
            {action}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default SettingsPageHeader;

