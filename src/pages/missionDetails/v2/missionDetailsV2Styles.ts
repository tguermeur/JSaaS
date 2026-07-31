import type { SxProps, Theme } from '@mui/material';
import { tokens } from '../../../theme/tokens';

/** Champs inline « ghost » — handoff .md-field */
export const mdFieldSx: SxProps<Theme> = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '7px',
    fontSize: 13,
    '& fieldset': { borderColor: 'transparent' },
    backgroundColor: 'transparent',
    '&:hover fieldset': { borderColor: tokens.colors.gray200 },
    '&:hover': { backgroundColor: '#fafafa' },
    '&.Mui-focused fieldset': {
      borderColor: tokens.colors.brandTeal,
      borderWidth: 1,
    },
    '&.Mui-focused': {
      backgroundColor: tokens.colors.bgPaper,
      boxShadow: `0 0 0 3px ${tokens.colors.brandTeal}1f`,
    },
  },
};

export const mdV2RootSx: SxProps<Theme> = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  bgcolor: '#fafafa',
  overflow: 'hidden',
  position: 'relative',
  pb: '60px',
};

export const mdV2HeaderSx: SxProps<Theme> = {
  bgcolor: tokens.colors.bgPaper,
  borderBottom: `1px solid ${tokens.colors.gray100}`,
  px: 3,
  pt: 1.5,
  pb: 0,
  flexShrink: 0,
  position: 'sticky',
  top: 0,
  zIndex: 5,
};

export const mdV2TabContentSx: SxProps<Theme> = {
  flex: 1,
  overflow: 'auto',
  p: 3,
  minWidth: 0,
};

export const mdV2KpiGridSx: SxProps<Theme> = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' },
  gap: 1.5,
  mb: 1.75,
};
