import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Button, Typography, Paper } from '@mui/material';
import { logError } from '../../utils/logger';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError('ErrorBoundary', error, { componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', p: 3 }}>
          <Paper sx={{ p: 4, maxWidth: 480, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              {this.props.fallbackTitle ?? 'Une erreur est survenue'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Rechargez la page ou contactez le support si le problème persiste.
            </Typography>
            <Button variant="contained" onClick={() => window.location.reload()}>
              Recharger
            </Button>
          </Paper>
        </Box>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
