import { createTheme } from '@mui/material';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#f50057',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#ffffff',
        },
      },
    },
    // Snackbars : en bas à gauche, au-dessus du footer et à droite de la sidebar
    MuiSnackbar: {
      defaultProps: {
        anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
      },
      styleOverrides: {
        root: {
          zIndex: 10000, // z-index très élevé pour être au-dessus de tout (sidebar, footer, modals, etc.)
          position: 'fixed !important' as any,
        },
        anchorOriginBottomLeft: {
          left: 72,
          bottom: 56,
        },
      },
    },
  },
});

export default theme; 