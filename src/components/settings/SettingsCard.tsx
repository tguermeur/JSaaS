import React from 'react';
import { Card, CardContent, Box, Typography, useTheme } from '@mui/material';

interface SettingsCardProps {
  icon?: React.ReactNode;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  iconColor?: string;
  gradient?: string;
}

const SettingsCard: React.FC<SettingsCardProps> = ({ 
  icon, 
  title, 
  subtitle, 
  children,
  iconColor = '#667eea',
  gradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
}) => {
  const theme = useTheme();

  return (
    <Card 
      elevation={0} 
      sx={{ 
        borderRadius: '12px',
        background: '#ffffff',
        border: '1px solid #e5e5ea',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        height: '100%',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
          borderColor: '#d1d1d6'
        }
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        {(title || icon) && (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2.5 }}>
            {icon && (
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '6px',
                  background: gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  mt: 0.25
                }}
              >
                {React.cloneElement(icon as React.ReactElement, { sx: { color: 'white', fontSize: 16 } })}
              </Box>
            )}
            <Box sx={{ flex: 1 }}>
              {title && (
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.25, fontSize: '1rem', lineHeight: 1.4 }}>
                  {title}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', lineHeight: 1.4 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Box>
        )}
        {children}
      </CardContent>
    </Card>
  );
};

export default SettingsCard;
