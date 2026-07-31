import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { tokens } from '../../theme/tokens';
import { SIGNATURE_CONSENT_WORDING } from '../../types/signature';
import { createSignatureRequest, type SignerInput } from '../../services/signatureService';

type Props = {
  open: boolean;
  onClose: () => void;
  generatedDocumentId: string;
  documentTitle?: string;
  onCreated?: (requestId: string) => void;
};

const emptySigner = (): SignerInput => ({ email: '', name: '' });

const SendForSignatureDialog: React.FC<Props> = ({
  open,
  onClose,
  generatedDocumentId,
  documentTitle,
  onCreated,
}) => {
  const [signers, setSigners] = useState<SignerInput[]>([emptySigner()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSigner = (index: number, patch: Partial<SignerInput>) => {
    setSigners((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const handleSubmit = async () => {
    setError(null);
    const cleaned = signers
      .map((s, i) => ({
        email: s.email.trim(),
        name: s.name.trim(),
        phone: s.phone?.trim() || undefined,
        order: i,
      }))
      .filter((s) => s.email || s.name);

    if (cleaned.length === 0) {
      setError('Ajoutez au moins un signataire.');
      return;
    }
    for (const s of cleaned) {
      if (!s.email.includes('@') || !s.name) {
        setError('Chaque signataire doit avoir un nom et un email valides.');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await createSignatureRequest({
        generatedDocumentId,
        signers: cleaned,
        consentWording: SIGNATURE_CONSENT_WORDING,
      });
      onCreated?.(res.requestId);
      setSigners([emptySigner()]);
      onClose();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : 'Échec de l’envoi en signature.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Envoyer en signature</DialogTitle>
      <DialogContent>
        {documentTitle && (
          <Typography sx={{ mb: 2, color: tokens.colors.textSecondary }}>
            Document : <strong>{documentTitle}</strong>
          </Typography>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <Typography variant="body2" sx={{ mb: 2, color: tokens.colors.textSecondary }}>
          Chaque signataire recevra un lien unique par email (usage unique). L’OTP SMS arrivera en
          phase 2.
        </Typography>
        {signers.map((s, i) => (
          <Box
            key={i}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr auto' },
              gap: 1,
              mb: 1.5,
              alignItems: 'center',
            }}
          >
            <TextField
              label="Nom"
              size="small"
              value={s.name}
              onChange={(e) => updateSigner(i, { name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Email"
              size="small"
              type="email"
              value={s.email}
              onChange={(e) => updateSigner(i, { email: e.target.value })}
              fullWidth
            />
            <IconButton
              aria-label="Supprimer"
              disabled={signers.length === 1}
              onClick={() => setSigners((prev) => prev.filter((_, j) => j !== i))}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Button
          startIcon={<AddIcon />}
          onClick={() => setSigners((prev) => [...prev, emptySigner()])}
          size="small"
          sx={{ mt: 0.5 }}
        >
          Ajouter un signataire
        </Button>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Annuler
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={loading}
          sx={{ bgcolor: tokens.colors.brandTeal, '&:hover': { bgcolor: tokens.colors.brandTeal700 } }}
        >
          {loading ? 'Envoi…' : 'Envoyer les invitations'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SendForSignatureDialog;
