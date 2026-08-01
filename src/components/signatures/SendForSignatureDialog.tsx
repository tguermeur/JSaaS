import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
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
import type { DocumentType } from '../../types/templates';
import { counterpartyLabelForDocumentType } from '../../types/templates';
import { createSignatureRequest, type SignerInput } from '../../services/signatureService';
import {
  loadSignaturePlacementsForDocumentType,
  placementsToSignatureFields,
} from '../../utils/signaturePlacements';

export type DefaultSigner = {
  firstName?: string;
  lastName?: string;
  /** Nom complet si prénom/nom non séparés */
  name?: string;
  email?: string;
  phone?: string;
  /** Rôle métier pour l’affichage / mapping des zones */
  role?: 'counterparty' | 'structure';
};

type SignerForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role?: 'counterparty' | 'structure';
};

type Props = {
  open: boolean;
  onClose: () => void;
  generatedDocumentId: string;
  documentTitle?: string;
  documentType?: DocumentType;
  structureId?: string;
  /** Préremplissage (ex. étudiant de la LM + structure) */
  defaultSigners?: DefaultSigner[];
  onCreated?: (requestId: string) => void;
};

const emptySigner = (): SignerForm => ({ firstName: '', lastName: '', email: '' });

function toSignerForm(d?: DefaultSigner): SignerForm {
  if (!d) return emptySigner();
  let firstName = (d.firstName || '').trim();
  let lastName = (d.lastName || '').trim();
  if (!firstName && !lastName && d.name?.trim()) {
    const parts = d.name.trim().split(/\s+/);
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ');
  }
  return {
    firstName,
    lastName,
    email: (d.email || '').trim(),
    phone: d.phone?.trim() || undefined,
    role: d.role,
  };
}

function roleLabel(
  role: SignerForm['role'],
  documentType?: DocumentType,
  index?: number
): string | null {
  if (role === 'structure') return 'Structure';
  if (role === 'counterparty' && documentType) {
    return counterpartyLabelForDocumentType(documentType);
  }
  if (index === 0 && documentType) return counterpartyLabelForDocumentType(documentType);
  if (index === 1) return 'Structure';
  return null;
}

const SendForSignatureDialog: React.FC<Props> = ({
  open,
  onClose,
  generatedDocumentId,
  documentTitle,
  documentType,
  structureId,
  defaultSigners,
  onCreated,
}) => {
  const [signers, setSigners] = useState<SignerForm[]>([emptySigner()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placementsInfo, setPlacementsInfo] = useState<{
    count: number;
    loading: boolean;
  }>({ count: 0, loading: false });

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (defaultSigners && defaultSigners.length > 0) {
      setSigners(defaultSigners.map(toSignerForm));
    } else {
      setSigners([emptySigner()]);
    }

    let cancelled = false;
    const loadPlacements = async () => {
      if (
        !structureId ||
        !documentType ||
        !['proposition_commerciale', 'lettre_mission', 'avenant'].includes(documentType)
      ) {
        setPlacementsInfo({ count: 0, loading: false });
        return;
      }
      setPlacementsInfo({ count: 0, loading: true });
      try {
        const placements = await loadSignaturePlacementsForDocumentType(
          structureId,
          documentType
        );
        if (!cancelled) {
          setPlacementsInfo({ count: placements.length, loading: false });
        }
      } catch {
        if (!cancelled) setPlacementsInfo({ count: 0, loading: false });
      }
    };
    void loadPlacements();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- préremplir uniquement à l'ouverture
  }, [open]);

  const updateSigner = (index: number, patch: Partial<SignerForm>) => {
    setSigners((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const handleSubmit = async () => {
    setError(null);
    const cleaned: SignerInput[] = signers
      .map((s, i) => ({
        email: s.email.trim(),
        name: `${s.firstName.trim()} ${s.lastName.trim()}`.trim(),
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
        setError('Chaque signataire doit avoir un prénom, un nom et un email valides.');
        return;
      }
    }

    setLoading(true);
    try {
      let signatureFields: ReturnType<typeof placementsToSignatureFields> | undefined;
      if (
        structureId &&
        documentType &&
        ['proposition_commerciale', 'lettre_mission', 'avenant'].includes(documentType)
      ) {
        const placements = await loadSignaturePlacementsForDocumentType(
          structureId,
          documentType
        );
        if (placements.length > 0) {
          signatureFields = placementsToSignatureFields(placements, documentType);
        }
      }

      const res = await createSignatureRequest({
        generatedDocumentId,
        signers: cleaned,
        consentWording: SIGNATURE_CONSENT_WORDING,
        signatureFields,
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
        {!placementsInfo.loading &&
          documentType &&
          ['proposition_commerciale', 'lettre_mission', 'avenant'].includes(documentType) && (
            <Alert
              severity={placementsInfo.count > 0 ? 'success' : 'info'}
              sx={{ mb: 2 }}
            >
              {placementsInfo.count > 0
                ? `${placementsInfo.count} emplacement${placementsInfo.count > 1 ? 's' : ''} préconfiguré${placementsInfo.count > 1 ? 's' : ''} seront appliqués automatiquement.`
                : 'Aucun emplacement préconfiguré (Signatures → Emplacements). Les signatures seront placées en bas de page.'}
            </Alert>
          )}
        <Typography variant="body2" sx={{ mb: 2, color: tokens.colors.textSecondary }}>
          Chaque signataire recevra un lien unique par email (usage unique). L’OTP SMS arrivera en
          phase 2.
        </Typography>
        {signers.map((s, i) => {
          const label = roleLabel(s.role, documentType, i);
          return (
            <Box key={i} sx={{ mb: 1.5 }}>
              {label && (
                <Chip
                  size="small"
                  label={label}
                  sx={{ mb: 0.75 }}
                  color={s.role === 'structure' || i === 1 ? 'primary' : 'default'}
                  variant="outlined"
                />
              )}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1.2fr auto' },
                  gap: 1,
                  alignItems: 'center',
                }}
              >
                <TextField
                  label="Prénom"
                  size="small"
                  value={s.firstName}
                  onChange={(e) => updateSigner(i, { firstName: e.target.value })}
                  fullWidth
                />
                <TextField
                  label="Nom"
                  size="small"
                  value={s.lastName}
                  onChange={(e) => updateSigner(i, { lastName: e.target.value })}
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
            </Box>
          );
        })}
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
