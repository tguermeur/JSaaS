import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { tokens } from '../../theme/tokens';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  caption?: string;
  color?: string;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  caption,
  color = tokens.colors.primary,
  onClick,
}) => {
  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 3,
        borderRadius: tokens.radius.lg,
        border: `1px solid ${tokens.colors.borderLight}`,
        boxShadow: tokens.shadows.sm,
        transition: tokens.transitions.default,
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick
          ? {
              boxShadow: tokens.shadows.md,
              transform: 'translateY(-2px)',
            }
          : {},
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography
            sx={{
              fontSize: '13px',
              fontWeight: 500,
              color: tokens.colors.textSecondary,
              mb: 1,
            }}
          >
            {label}
          </Typography>
          <Typography
            sx={{
              fontSize: '28px',
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            {value}
          </Typography>
          {caption && (
            <Typography
              sx={{
                fontSize: '12px',
                color: tokens.colors.textSecondary,
                mt: 0.5,
              }}
            >
              {caption}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: tokens.radius.md,
            backgroundColor: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            '& svg': {
              fontSize: 22,
              color: color,
            },
          }}
        >
          {icon}
        </Box>
      </Box>
    </Paper>
  );
};

export default StatCard;
