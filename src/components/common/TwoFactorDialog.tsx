import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';
import { Security as SecurityIcon } from '@mui/icons-material';

interface TwoFactorDialogProps {
  open: boolean;
  onClose: () => void;
  onVerify: (code: string) => Promise<void>;
  title?: string;
  message?: string;
}

const TwoFactorDialog: React.FC<TwoFactorDialogProps> = ({
  open,
  onClose,
  onVerify,
  title = 'Validation 2FA requise',
  message = 'Veuillez entrer le code à 6 chiffres de votre application d\'authentification pour accéder aux données cryptées.'
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCodeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
    setError(null);
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('Le code doit contenir 6 chiffres');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onVerify(code);
      setCode('');
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Code invalide. Veuillez réessayer.');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setCode('');
      setError(null);
      onClose();
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && code.length === 6 && !loading) {
      handleVerify();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      sx={{
        zIndex: 9999,
        '& .MuiDialog-container': {
          zIndex: 9999
        }
      }}
      PaperProps={{
        sx: {
          borderRadius: 2,
          zIndex: 9999
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SecurityIcon color="primary" />
          <Typography variant="h6">{title}</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {message}
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            autoFocus
            fullWidth
            label="Code 2FA"
            value={code}
            onChange={handleCodeChange}
            onKeyPress={handleKeyPress}
            placeholder="000000"
            inputProps={{
              maxLength: 6,
              style: {
                textAlign: 'center',
                fontSize: '1.5rem',
                letterSpacing: '0.5rem',
                fontFamily: 'monospace'
              }
            }}
            disabled={loading}
            error={!!error}
            helperText={code.length > 0 ? `${code.length}/6` : 'Entrez le code à 6 chiffres'}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button 
          onClick={handleClose} 
          disabled={loading}
          sx={{ textTransform: 'none' }}
        >
          Annuler
        </Button>
        <Button
          onClick={handleVerify}
          variant="contained"
          disabled={code.length !== 6 || loading}
          sx={{ textTransform: 'none' }}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading ? 'Vérification...' : 'Valider'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TwoFactorDialog;
