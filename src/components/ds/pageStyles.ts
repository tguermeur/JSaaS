import type { SxProps, Theme } from '@mui/material';
import { tokens } from '../../theme/tokens';

/** MUI Tabs styling — JS Connect DS (Settings / detail pages) */
export const dsTabsSx: SxProps<Theme> = {
  minHeight: 44,
  '& .MuiTab-root': {
    textTransform: 'none',
    fontWeight: 500,
    fontSize: '0.875rem',
    minHeight: 44,
    px: 2.5,
    py: 1,
    color: tokens.colors.textSecondary,
    transition: tokens.transitions.fast,
    '&.Mui-selected': {
      color: tokens.colors.brandTeal,
      fontWeight: 600,
    },
    '&:hover': {
      color: tokens.colors.textPrimary,
      backgroundColor: 'transparent',
    },
    '& .MuiTab-iconWrapper': {
      mr: 1,
      '& svg': { fontSize: '1rem' },
    },
  },
  '& .MuiTabs-indicator': {
    height: 2,
    backgroundColor: tokens.colors.brandTeal,
    borderRadius: '1px 1px 0 0',
  },
  '& .MuiTabs-scrollButtons': {
    color: tokens.colors.textSecondary,
    '&.Mui-disabled': { opacity: 0.3 },
  },
};

export const dsDetailHeaderSx: SxProps<Theme> = {
  bgcolor: tokens.colors.bgPaper,
  borderBottom: `1px solid ${tokens.colors.divider}`,
  position: 'sticky',
  top: 0,
  zIndex: 10,
  flexShrink: 0,
};

export const dsPageCanvasSx: SxProps<Theme> = {
  flex: 1,
  minHeight: 0,
  bgcolor: tokens.colors.surfaceAlt,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};
