import { useState, type FC } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  IconButton,
  Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useSnackbar } from 'notistack';
import { tokens } from '../../theme/tokens';
import type { FreeQuotaKind } from '../../hooks/useStructureQuota';
import { startPaidCheckout } from '../../services/billingCheckout';

export interface FreeQuotaExceededDialogProps {
  open: boolean;
  kind: FreeQuotaKind;
  onClose: () => void;
}

const MESSAGES: Record<FreeQuotaKind, { title: string; body: string }> = {
  items: {
    title: 'Quota de missions & études atteint',
    body: 'Vous avez utilisé vos 3 missions ou études gratuites. Passez au plan payant pour continuer à créer sans limite.',
  },
  signatures: {
    title: 'Quota de signatures atteint',
    body: 'Vous avez utilisé vos 10 signatures gratuites. Passez au plan payant pour continuer à envoyer des documents à signer.',
  },
};

const FreeQuotaExceededDialog: FC<FreeQuotaExceededDialogProps> = ({
  open,
  kind,
  onClose,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const copy = MESSAGES[kind];

  const handleUpgrade = async () => {
    try {
      setLoading(true);
      await startPaidCheckout();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Impossible de démarrer le paiement';
      enqueueSnackbar(message, { variant: 'error' });
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: tokens.radius.lg,
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pr: 1,
          fontWeight: 700,
        }}
      >
        {copy.title}
        <IconButton
          aria-label="Fermer"
          onClick={onClose}
          disabled={loading}
          size="small"
          sx={{ color: tokens.colors.textSecondary }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          {copy.body}
        </Typography>
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            borderRadius: tokens.radius.md,
            bgcolor: tokens.colors.bgSubtle,
            border: `1px solid ${tokens.colors.borderSoft}`,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Plan Premium — 149,90€/mois
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Accès illimité aux missions, études et signatures. Sans engagement.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} disabled={loading} sx={{ textTransform: 'none' }}>
          Plus tard
        </Button>
        <Button
          variant="contained"
          onClick={handleUpgrade}
          disabled={loading}
          sx={{
            textTransform: 'none',
            borderRadius: tokens.radius.md,
            bgcolor: tokens.colors.brandNavy,
            minWidth: 180,
          }}
        >
          {loading ? <CircularProgress size={22} color="inherit" /> : 'Passer au plan payant'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FreeQuotaExceededDialog;
