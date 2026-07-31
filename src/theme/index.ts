import { createTheme } from '@mui/material/styles';
import { tokens } from './tokens';

const theme = createTheme({
  zIndex: {
    modal: 10000,
    snackbar: 10001,
    tooltip: 10002,
    drawer: 110,
  },

  palette: {
    primary: {
      main: tokens.colors.brandTeal,
      dark: tokens.colors.brandTeal700,
      light: tokens.colors.brandTeal300,
      contrastText: '#ffffff',
    },
    secondary: {
      main: tokens.colors.brandNavy,
      dark: tokens.colors.brandNavy700,
      light: tokens.colors.brandNavy300,
    },
    success: { main: tokens.colors.success },
    error: { main: tokens.colors.error },
    warning: { main: tokens.colors.warning },
    info: { main: tokens.colors.info },
    background: {
      default: tokens.colors.appBg,
      paper: tokens.colors.bgPaper,
    },
    text: {
      primary: tokens.colors.textPrimary,
      secondary: tokens.colors.textSecondary,
    },
    divider: tokens.colors.divider,
  },

  typography: {
    fontFamily: tokens.typography.fontFamily,
    h4: {
      fontWeight: 700,
      fontSize: '1.75rem',
      letterSpacing: '-0.02em',
      color: tokens.colors.textPrimary,
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
      letterSpacing: '-0.01em',
      color: tokens.colors.textPrimary,
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
      color: tokens.colors.textPrimary,
    },
    body1: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
    },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: tokens.colors.appBg,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none' as const,
          borderRadius: parseInt(tokens.radius.md),
          fontWeight: 500,
          transition: tokens.transitions.default,
        },
        containedPrimary: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: tokens.shadows.button,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: parseInt(tokens.radius.lg),
          boxShadow: tokens.shadows.md,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: parseInt(tokens.radius.lg),
          boxShadow: tokens.shadows.md,
          transition: tokens.transitions.default,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none' as const,
          fontWeight: 500,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.colors.gray50,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          color: tokens.colors.gray700,
          fontSize: '0.875rem',
        },
        root: {
          borderColor: tokens.colors.gray200,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: parseInt(tokens.radius.md),
            transition: tokens.transitions.default,
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: tokens.colors.brandTeal,
            },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: parseInt(tokens.radius.xxxl),
          boxShadow: tokens.shadows.xl,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: tokens.colors.bgPaper,
        },
      },
    },
    MuiSnackbar: {
      defaultProps: {
        anchorOrigin: { vertical: 'bottom' as const, horizontal: 'left' as const },
      },
      styleOverrides: {
        root: {
          zIndex: 10000,
          position: 'fixed !important' as any,
        },
        anchorOriginBottomLeft: {
          left: 72,
          bottom: 56,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: tokens.radius.pill,
          fontWeight: 500,
          fontSize: '0.75rem',
        },
      },
    },
  },
});

export default theme;
