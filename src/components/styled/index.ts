import { styled, alpha } from '@mui/material/styles';
import {
  Button,
  TextField,
  Dialog,
  Paper,
  Chip,
  Tabs,
  TableRow,
  Card,
} from '@mui/material';
import { tokens } from '../../theme/tokens';

export const StyledButton = styled(Button)(() => ({
  borderRadius: tokens.radius.md,
  textTransform: 'none',
  fontWeight: 600,
  padding: '10px 24px',
  transition: tokens.transitions.default,
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: tokens.shadows.lg,
  },
}));

export const StyledPrimaryButton = styled(Button)(() => ({
  borderRadius: tokens.radius.md,
  textTransform: 'none',
  fontWeight: 600,
  padding: '10px 24px',
  background: tokens.colors.brandTeal,
  color: '#fff',
  boxShadow: tokens.shadows.button,
  transition: tokens.transitions.default,
  '&:hover': {
    background: tokens.colors.brandTeal700,
    transform: 'translateY(-2px)',
    boxShadow: tokens.shadows.lg,
  },
}));

export const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: tokens.radius.md,
    transition: tokens.transitions.default,
    '&:hover': {
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.primary.main,
      },
    },
  },
}));

export const StyledDialog = styled(Dialog)(() => ({
  '& .MuiDialog-paper': {
    borderRadius: tokens.radius.xxxl,
    boxShadow: tokens.shadows.xl,
    padding: 0,
  },
}));

export const StyledCard = styled(Card)(() => ({
  borderRadius: tokens.radius.lg,
  border: `1px solid ${tokens.colors.borderLight}`,
  boxShadow: tokens.shadows.sm,
  transition: tokens.transitions.default,
  '&:hover': {
    boxShadow: tokens.shadows.md,
    transform: 'translateY(-2px)',
  },
}));

export const StyledPaper = styled(Paper)(({ theme }) => ({
  borderRadius: tokens.radius.lg,
  border: `1px solid ${tokens.colors.borderLight}`,
  boxShadow: tokens.shadows.sm,
  padding: theme.spacing(3),
}));

export const StyledChip = styled(Chip)(() => ({
  borderRadius: tokens.radius.pill,
  fontWeight: 500,
  transition: tokens.transitions.default,
  '&:hover': {
    transform: 'translateY(-1px)',
  },
}));

export const StyledTabs = styled(Tabs)(({ theme }) => ({
  '& .MuiTab-root': {
    textTransform: 'none',
    fontWeight: 600,
    fontSize: '1rem',
    minHeight: 48,
    borderRadius: tokens.radius.md,
    transition: tokens.transitions.default,
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.08),
    },
    '&.Mui-selected': {
      backgroundColor: alpha(theme.palette.primary.main, 0.12),
    },
  },
  '& .MuiTabs-indicator': {
    borderRadius: 3,
    height: 3,
  },
}));

export const StyledTableRow = styled(TableRow)(({ theme }) => ({
  transition: tokens.transitions.default,
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.04),
  },
  '& td': {
    borderBottom: `1px solid ${tokens.colors.borderLight}`,
  },
}));
