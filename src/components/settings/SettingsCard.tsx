import React from 'react';
import { Card, CardContent, Box, Typography, useTheme } from '@mui/material';
import { tokens } from '../../theme/tokens';

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
  iconColor = tokens.colors.primary,
  gradient = tokens.gradients.brand
}) => {
  const theme = useTheme();

  return (
    <Card 
      elevation={0} 
      sx={{ 
        borderRadius: tokens.radius.md,
        background: '#ffffff',
        border: `1px solid ${tokens.colors.borderDefault}`,
        boxShadow: tokens.shadows.sm,
        transition: tokens.transitions.default,
        height: '100%',
        '&:hover': {
          boxShadow: tokens.shadows.md,
          borderColor: tokens.colors.gray300
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
