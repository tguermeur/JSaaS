import React from 'react';
import { Box, Typography, Button } from '@mui/material';

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
              borderRadius: '16px',
              background: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
            }}
          >
            {React.cloneElement(icon as React.ReactElement, { sx: { color: 'white', fontSize: 28 } })}
          </Box>
          <Box>
            <Typography variant="h4" sx={{ 
              fontWeight: 700, 
              background: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
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

