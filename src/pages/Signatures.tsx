import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  Gesture as GestureIcon,
  MoreVert as MoreVertIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  Description as DescriptionIcon,
  Verified as VerifiedIcon,
  Close as CloseIcon,
  Send as SendIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import { tokens } from '../theme/tokens';
import { useAuth } from '../contexts/AuthContext';
import type { SignatureEvent, SignatureRequest } from '../types/signature';
import {
  cancelSignatureRequest,
  deleteSignatureRequest,
  getSealedDocumentUrl,
  getSignatureAudit,
  listSignatureRequests,
  resendSignatureInvite,
} from '../services/signatureService';
import NewSignatureRequestDialog from '../components/signatures/NewSignatureRequestDialog';

const STATUS_LABEL: Record<
  string,
  { label: string; color: 'default' | 'warning' | 'success' | 'error' | 'info' }
> = {
  pending: { label: 'En cours', color: 'warning' },
  completed: { label: 'Signé', color: 'success' },
  cancelled: { label: 'Annulé', color: 'default' },
  expired: { label: 'Expiré', color: 'error' },
  draft: { label: 'Brouillon', color: 'info' },
};

const SIGNER_STATUS: Record<string, string> = {
  pending: 'En attente',
  opened: 'Lien ouvert',
  signed: 'Signé',
  declined: 'Refusé',
};

const EVENT_LABEL: Record<string, string> = {
  created: 'Demande créée',
  email_sent: 'E-mail envoyé',
  email_failed: 'Échec d’envoi e-mail',
  link_opened: 'Lien ouvert',
  document_viewed: 'Document consulté',
  consent_accepted: 'Consentement accepté',
  signed: 'Signature enregistrée',
  sealed: 'Document scellé',
  cancelled: 'Demande annulée',
  reminder_sent: 'Relance envoyée',
};

function formatDate(value: unknown): string {
  if (!value) return '—';
  try {
    let d: Date;
    if (typeof value === 'object' && value !== null && '_seconds' in value) {
      d = new Date((value as { _seconds: number })._seconds * 1000);
    } else if (typeof value === 'object' && value !== null && 'seconds' in value) {
      d = new Date((value as { seconds: number }).seconds * 1000);
    } else {
      d = new Date(value as string | number | Date);
    }
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function openPdfPayload(payload: { url: string | null; pdfBase64?: string | null | undefined }) {
  if (payload.url) {
    window.open(payload.url, '_blank', 'noopener,noreferrer');
    return;
  }
  if (payload.pdfBase64) {
    const bin = atob(payload.pdfBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return;
  }
  throw new Error('PDF indisponible.');
}

const Signatures: React.FC = () => {
  const { userData } = useAuth();
  const isSuperAdmin =
    userData?.status === 'superadmin' || userData?.role === 'superadmin';
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; req: SignatureRequest } | null>(
    null
  );
  const [detail, setDetail] = useState<{
    request: SignatureRequest;
    events: SignatureEvent[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [downloadReq, setDownloadReq] = useState<SignatureRequest | null>(null);
  const [downloadBusy, setDownloadBusy] = useState<'document' | 'full' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SignatureRequest | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listSignatureRequests();
      setRequests(res.requests || []);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : 'Impossible de charger les signatures.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (req: SignatureRequest) => {
    setDetailLoading(true);
    setMenuAnchor(null);
    try {
      const res = await getSignatureAudit(req.id);
      setDetail(res);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : 'Impossible de charger le détail.';
      setError(msg);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCancel = async (req: SignatureRequest) => {
    setMenuAnchor(null);
    try {
      await cancelSignatureRequest(req.id);
      await load();
      if (detail?.request.id === req.id) setDetail(null);
    } catch (e: unknown) {
      setError(
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : 'Annulation impossible.'
      );
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSignatureRequest(deleteTarget.id);
      setDeleteTarget(null);
      if (detail?.request.id === deleteTarget.id) setDetail(null);
      await load();
    } catch (e: unknown) {
      setError(
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : 'Suppression impossible.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleResend = async (req: SignatureRequest, signerId: string) => {
    try {
      await resendSignatureInvite(req.id, signerId);
      await openDetail(req);
    } catch (e: unknown) {
      setError(
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : 'Renvoi impossible.'
      );
    }
  };

  const handleDownload = async (variant: 'document' | 'full') => {
    if (!downloadReq) return;
    setDownloadBusy(variant);
    try {
      const res = await getSealedDocumentUrl(downloadReq.id);
      const payload = variant === 'document' ? res.document || { url: res.url, pdfBase64: res.pdfBase64 } : res.full || { url: res.url, pdfBase64: res.pdfBase64 };
      openPdfPayload(payload);
      setDownloadReq(null);
    } catch (e: unknown) {
      setError(
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : 'Téléchargement impossible.'
      );
    } finally {
      setDownloadBusy(null);
    }
  };

  return (
    <Box sx={{ height: '100%' }}>
      <PageHeader
        title="Signatures"
        subtitle="Suivez les demandes de signature électronique"
        action={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setNewOpen(true)}
              sx={{
                bgcolor: tokens.colors.brandTeal,
                '&:hover': { bgcolor: tokens.colors.brandTeal700 },
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Nouveau document
            </Button>
            <IconButton onClick={() => void load()} aria-label="Actualiser">
              <RefreshIcon />
            </IconButton>
          </Box>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          bgcolor: tokens.colors.bgPaper,
          border: `1px solid ${tokens.colors.divider}`,
          borderRadius: tokens.radius.lg,
          minHeight: 400,
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={<GestureIcon />}
            title="Aucune demande de signature"
            description="Ajoutez un PDF à faire signer, éventuellement lié à une mission."
            action={{
              label: 'Nouveau document',
              onClick: () => setNewOpen(true),
              icon: <AddIcon />,
            }}
          />
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Document</TableCell>
                <TableCell>Mission</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Signataires</TableCell>
                <TableCell>Créée le</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((req) => {
                const st = STATUS_LABEL[req.status] || STATUS_LABEL.pending;
                const signedCount = (req.signers || []).filter((s) => s.status === 'signed').length;
                return (
                  <TableRow
                    key={req.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => void openDetail(req)}
                  >
                    <TableCell>
                      <Typography fontWeight={600}>{req.document?.title || 'Document'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Empreinte {req.document?.sha256Before?.slice(0, 10)}…
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {req.source?.missionNumber || req.source?.missionTitle ? (
                        <Typography variant="body2">
                          {req.source.missionNumber
                            ? `${req.source.missionNumber}${req.source.missionTitle ? ` — ${req.source.missionTitle}` : ''}`
                            : req.source.missionTitle}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={st.label} color={st.color} />
                    </TableCell>
                    <TableCell>
                      {signedCount}/{req.signers?.length || 0}
                    </TableCell>
                    <TableCell>{formatDate(req.createdAt)}</TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <IconButton
                        size="small"
                        onClick={(e) => setMenuAnchor({ el: e.currentTarget, req })}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Box>

      <Menu
        anchorEl={menuAnchor?.el}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => menuAnchor && void openDetail(menuAnchor.req)}>
          Voir le détail
        </MenuItem>
        {menuAnchor?.req.status === 'completed' && (
          <MenuItem
            onClick={() => {
              if (menuAnchor) {
                setDownloadReq(menuAnchor.req);
                setMenuAnchor(null);
              }
            }}
          >
            <DownloadIcon fontSize="small" sx={{ mr: 1 }} />
            Télécharger
          </MenuItem>
        )}
        {menuAnchor?.req.status === 'pending' && (
          <MenuItem
            onClick={() => menuAnchor && void handleCancel(menuAnchor.req)}
            sx={{ color: tokens.colors.error }}
          >
            Annuler
          </MenuItem>
        )}
        {isSuperAdmin && (
          <MenuItem
            onClick={() => {
              if (menuAnchor) {
                setDeleteTarget(menuAnchor.req);
                setMenuAnchor(null);
              }
            }}
            sx={{ color: tokens.colors.error }}
          >
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Supprimer
          </MenuItem>
        )}
      </Menu>

      {/* Choix téléchargement */}
      <Dialog
        open={Boolean(downloadReq)}
        onClose={() => !downloadBusy && setDownloadReq(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: tokens.radius.lg } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pr: 6 }}>
          Télécharger le document
          <IconButton
            onClick={() => setDownloadReq(null)}
            disabled={Boolean(downloadBusy)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Choisissez ce que vous souhaitez récupérer pour « {downloadReq?.document?.title} ».
          </Typography>
          <Stack spacing={1.5}>
            <Button
              variant="outlined"
              disabled={Boolean(downloadBusy)}
              onClick={() => void handleDownload('document')}
              startIcon={
                downloadBusy === 'document' ? (
                  <CircularProgress size={18} />
                ) : (
                  <DescriptionIcon />
                )
              }
              sx={{
                justifyContent: 'flex-start',
                textAlign: 'left',
                textTransform: 'none',
                py: 1.75,
                px: 2,
                borderRadius: tokens.radius.md,
                borderColor: tokens.colors.divider,
              }}
            >
              <Box>
                <Typography fontWeight={700}>Document signé uniquement</Typography>
                <Typography variant="caption" color="text.secondary">
                  Le PDF avec les signatures apposées, sans page certificat
                </Typography>
              </Box>
            </Button>
            <Button
              variant="contained"
              disabled={Boolean(downloadBusy)}
              onClick={() => void handleDownload('full')}
              startIcon={
                downloadBusy === 'full' ? <CircularProgress size={18} color="inherit" /> : <VerifiedIcon />
              }
              sx={{
                justifyContent: 'flex-start',
                textAlign: 'left',
                textTransform: 'none',
                py: 1.75,
                px: 2,
                borderRadius: tokens.radius.md,
                bgcolor: tokens.colors.brandTeal,
                '&:hover': { bgcolor: tokens.colors.brandTeal700 },
              }}
            >
              <Box>
                <Typography fontWeight={700}>Document + certificat SES</Typography>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  PDF complet avec la page de certificat de signature
                </Typography>
              </Box>
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDownloadReq(null)} disabled={Boolean(downloadBusy)} sx={{ textTransform: 'none' }}>
            Fermer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Détail */}
      <Dialog
        open={Boolean(detail) || detailLoading}
        onClose={() => setDetail(null)}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { borderRadius: tokens.radius.lg, overflow: 'hidden' } }}
      >
        <Box
          sx={{
            background: `linear-gradient(120deg, ${tokens.colors.brandNavy} 0%, ${tokens.colors.brandTeal} 100%)`,
            color: '#fff',
            px: 3,
            py: 2.5,
            position: 'relative',
          }}
        >
          <IconButton
            onClick={() => setDetail(null)}
            sx={{ position: 'absolute', right: 8, top: 8, color: 'rgba(255,255,255,0.85)' }}
          >
            <CloseIcon />
          </IconButton>
          <Typography variant="overline" sx={{ opacity: 0.85, letterSpacing: 1 }}>
            Demande de signature
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, pr: 4 }}>
            {detail?.request.document?.title || (detailLoading ? 'Chargement…' : 'Détail')}
          </Typography>
          {detail && (
            <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip
                size="small"
                label={STATUS_LABEL[detail.request.status]?.label || detail.request.status}
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600 }}
              />
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Créée le {formatDate(detail.request.createdAt)}
              </Typography>
            </Box>
          )}
        </Box>

        <DialogContent sx={{ px: { xs: 2, md: 3 }, py: 3 }}>
          {detailLoading && !detail ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : detail ? (
            <Stack spacing={3}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {detail.request.status === 'completed' && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => setDownloadReq(detail.request)}
                    sx={{
                      bgcolor: tokens.colors.brandTeal,
                      '&:hover': { bgcolor: tokens.colors.brandTeal700 },
                      textTransform: 'none',
                      fontWeight: 600,
                    }}
                  >
                    Télécharger
                  </Button>
                )}
                {isSuperAdmin && (
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => setDeleteTarget(detail.request)}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    Supprimer
                  </Button>
                )}
                {detail.request.source?.missionTitle || detail.request.source?.missionNumber ? (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`Mission : ${
                      detail.request.source.missionNumber
                        ? `${detail.request.source.missionNumber}${detail.request.source.missionTitle ? ` — ${detail.request.source.missionTitle}` : ''}`
                        : detail.request.source.missionTitle
                    }`}
                  />
                ) : null}
              </Box>

              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, color: tokens.colors.brandNavy, mb: 1.5 }}
                >
                  Signataires
                </Typography>
                <Stack spacing={1}>
                  {detail.request.signers.map((s) => (
                    <Box
                      key={s.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 1.5,
                        borderRadius: tokens.radius.md,
                        border: `1px solid ${tokens.colors.divider}`,
                        bgcolor: tokens.colors.gray50 || '#f8fafc',
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontWeight={600} noWrap>
                          {s.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {s.email}
                        </Typography>
                        {s.signedAt && (
                          <Typography variant="caption" color="text.secondary">
                            Signé le {formatDate(s.signedAt)}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        size="small"
                        label={SIGNER_STATUS[s.status] || s.status}
                        color={s.status === 'signed' ? 'success' : s.status === 'opened' ? 'info' : 'default'}
                      />
                      {detail.request.status === 'pending' && s.status !== 'signed' && (
                        <Button
                          size="small"
                          startIcon={<SendIcon />}
                          onClick={() => void handleResend(detail.request, s.id)}
                          sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                        >
                          Renvoyer
                        </Button>
                      )}
                    </Box>
                  ))}
                </Stack>
              </Box>

              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, color: tokens.colors.brandNavy, mb: 1 }}
                >
                  Consentement
                </Typography>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: tokens.radius.md,
                    bgcolor: `${tokens.colors.brandTeal}12`,
                    borderLeft: `3px solid ${tokens.colors.brandTeal}`,
                  }}
                >
                  <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                    {detail.request.consentWording}
                  </Typography>
                </Box>
              </Box>

              {(detail.request.document?.sha256Before || detail.request.sealed?.sha256After) && (
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, color: tokens.colors.brandNavy, mb: 1 }}
                  >
                    Intégrité du document
                  </Typography>
                  <Stack spacing={0.75}>
                    {detail.request.document?.sha256Before && (
                      <Typography
                        variant="caption"
                        sx={{ fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}
                      >
                        Avant signature : {detail.request.document.sha256Before}
                      </Typography>
                    )}
                    {detail.request.sealed?.sha256After && (
                      <Typography
                        variant="caption"
                        sx={{ fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}
                      >
                        Après scellement : {detail.request.sealed.sha256After}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              )}

              <Divider />

              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, color: tokens.colors.brandNavy, mb: 1.5 }}
                >
                  Journal d’activité
                </Typography>
                <Stack spacing={0}>
                  {detail.events.map((ev, idx) => {
                    const metaErr =
                      ev.meta && typeof ev.meta === 'object' && 'error' in ev.meta
                        ? String((ev.meta as { error?: unknown }).error || '')
                        : '';
                    const metaEmail =
                      ev.meta && typeof ev.meta === 'object' && 'email' in ev.meta
                        ? String((ev.meta as { email?: unknown }).email || '')
                        : '';
                    const isFail = ev.type === 'email_failed';
                    return (
                      <Box
                        key={ev.id}
                        sx={{
                          display: 'flex',
                          gap: 1.5,
                          py: 1.25,
                          borderBottom:
                            idx < detail.events.length - 1
                              ? `1px solid ${tokens.colors.divider}`
                              : 'none',
                        }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            mt: 0.75,
                            flexShrink: 0,
                            bgcolor: isFail ? tokens.colors.error : tokens.colors.brandTeal,
                          }}
                        />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography fontWeight={600} sx={{ color: isFail ? 'error.main' : 'inherit' }}>
                            {EVENT_LABEL[ev.type] || ev.type}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {formatDate(ev.at)}
                            {metaEmail ? ` · Destinataire : ${metaEmail}` : ''}
                          </Typography>
                          {metaErr && (
                            <Typography variant="caption" color="error" display="block">
                              {metaErr}
                            </Typography>
                          )}
                          {ev.ip && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              IP : {ev.ip}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression (superadmin) */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: tokens.radius.lg } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Supprimer ce document ?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            La demande « {deleteTarget?.document?.title || 'Document'} » sera définitivement
            supprimée, ainsi que les fichiers associés (PDF scellé, journal). Cette action est
            irréversible.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
            sx={{ textTransform: 'none' }}
          >
            Annuler
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleting}
            onClick={() => void handleDeleteConfirm()}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
            sx={{ textTransform: 'none' }}
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      <NewSignatureRequestDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(_requestId, emailResults) => {
          void load();
          const failed = (emailResults || []).filter((r) => !r.ok);
          if (failed.length > 0) {
            const detailMsg = failed
              .map((r) => `${r.email}: ${r.error || 'échec'}`)
              .join(' | ');
            setError(
              `Demande créée, mais l’e-mail n’a pas pu être envoyé. Activez « Allow EmailJS API for non-browser applications » sur https://dashboard.emailjs.com/admin/account/security — ${detailMsg}`
            );
          }
        }}
      />
    </Box>
  );
};

export default Signatures;
