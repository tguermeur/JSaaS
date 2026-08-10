import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
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
import { Add as AddIcon, Delete as DeleteIcon, UploadFile as UploadFileIcon } from '@mui/icons-material';
import { addDoc, collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { useFreeQuotaUpgrade } from '../../contexts/FreeQuotaUpgradeContext';
import {
  confirmFreeQuotaExceeded,
  SIGNATURE_QUOTA_EXHAUSTED_MSG,
  useStructureQuota,
} from '../../hooks/useStructureQuota';
import {
  getFirebaseErrorMessage,
  isFunctionsResourceExhausted,
} from '../../utils/firebaseErrors';
import { tokens } from '../../theme/tokens';
import { SIGNATURE_CONSENT_WORDING, type SignatureField } from '../../types/signature';
import { createSignatureRequest, type SignerInput } from '../../services/signatureService';
import { getSafeDisplayName } from '../../utils/decryptUserUtils';
import SignatureFieldPlacer from './SignatureFieldPlacer';

type MissionOption = {
  id: string;
  numeroMission: string;
  title: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (
    requestId: string,
    emailResults?: Array<{ email: string; ok: boolean; error: string | null }>
  ) => void;
};

const emptySigner = (): SignerInput => ({ email: '', name: '' });

const NewSignatureRequestDialog: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const { currentUser, userData } = useAuth();
  const { openFreeQuotaDialog } = useFreeQuotaUpgrade();
  const structureQuota = useStructureQuota(userData?.structureId);
  const [step, setStep] = useState<'form' | 'place'>('form');
  const [file, setFile] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [mission, setMission] = useState<MissionOption | null>(null);
  const [missions, setMissions] = useState<MissionOption[]>([]);
  const [missionsLoading, setMissionsLoading] = useState(false);
  const [signers, setSigners] = useState<SignerInput[]>([emptySigner()]);
  const [fields, setFields] = useState<SignatureField[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const structureId = userData?.structureId || '';

  const loadMissions = useCallback(async () => {
    if (!structureId || !db) return;
    setMissionsLoading(true);
    try {
      const q = query(
        collection(db, 'missions'),
        where('structureId', '==', structureId),
        orderBy('numeroMission', 'desc'),
        limit(200)
      );
      let snap;
      try {
        snap = await getDocs(q);
      } catch {
        snap = await getDocs(
          query(collection(db, 'missions'), where('structureId', '==', structureId), limit(200))
        );
      }
      const list = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          numeroMission: String(data.numeroMission || ''),
          title: String(data.title || data.nom || 'Mission'),
        };
      });
      list.sort((a, b) =>
        String(b.numeroMission).localeCompare(String(a.numeroMission), 'fr', { numeric: true })
      );
      setMissions(list);
    } catch {
      setMissions([]);
    } finally {
      setMissionsLoading(false);
    }
  }, [structureId]);

  useEffect(() => {
    if (open) {
      void loadMissions();
      setError(null);
    }
  }, [open, loadMissions]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  const reset = () => {
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(null);
    setFile(null);
    setMission(null);
    setSigners([emptySigner()]);
    setFields([]);
    setStep('form');
    setError(null);
  };

  const updateSigner = (index: number, patch: Partial<SignerInput>) => {
    setSigners((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (!f) {
      setFile(null);
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
      return;
    }
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Seuls les fichiers PDF sont acceptés.');
      setFile(null);
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      setError('Fichier trop volumineux (max 25 Mo).');
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(URL.createObjectURL(f));
    setFields([]);
  };

  const cleanedSigners = () =>
    signers
      .map((s, i) => ({
        email: s.email.trim(),
        name: s.name.trim(),
        phone: s.phone?.trim() || undefined,
        order: i,
      }))
      .filter((s) => s.email || s.name);

  const goToPlace = () => {
    setError(null);
    if (!file || !pdfPreviewUrl) {
      setError('Sélectionnez un document PDF.');
      return;
    }
    const cleaned = cleanedSigners();
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
    setStep('place');
  };

  const handleSubmit = async () => {
    setError(null);
    if (!structureId) {
      setError('Aucune structure associée à votre compte.');
      return;
    }
    if (structureQuota.plan === 'free' && structureQuota.isSignatureQuotaExceeded) {
      openFreeQuotaDialog('signatures');
      return;
    }
    if (!file) {
      setError('Sélectionnez un document PDF à signer.');
      return;
    }
    if (!currentUser?.uid || !storage || !db) {
      setError('Session ou Storage indisponible.');
      return;
    }
    if (fields.length === 0) {
      setError('Placez au moins une case de signature sur le document.');
      return;
    }

    const cleaned = cleanedSigners();
    setLoading(true);
    try {
      const timestamp = Date.now();
      const cleanFileName = file.name
        .replace(/[[\]]/g, '_')
        .replace(/[<>:"/\\|?*]/g, '_');
      const fileName = `${timestamp}_${cleanFileName}`;
      const storagePath = mission
        ? `missions/${mission.id}/documents/${fileName}`
        : `structures/${structureId}/signatures/uploads/${fileName}`;

      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(storageRef);

      const docRef = await addDoc(collection(db, 'generatedDocuments'), {
        missionId: mission?.id || null,
        missionNumber: mission?.numeroMission || '',
        missionTitle: mission?.title || '',
        structureId,
        documentType: 'convention_entreprise',
        fileName: file.name,
        fileUrl,
        storagePath,
        fileSize: file.size,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: currentUser.uid,
        createdByName: getSafeDisplayName(userData),
        status: 'final',
        isValid: true,
        tags: [],
        isUploaded: true,
        category: 'contrats',
        forSignature: true,
      });

      const res = await createSignatureRequest({
        generatedDocumentId: docRef.id,
        signers: cleaned,
        consentWording: SIGNATURE_CONSENT_WORDING,
        signatureFields: fields.map((f) => ({
          id: f.id,
          signerOrder: f.signerOrder,
          pageIndex: f.pageIndex,
          xPct: f.xPct,
          yPct: f.yPct,
          widthPct: f.widthPct,
          heightPct: f.heightPct,
          label: f.label,
        })),
      });

      onCreated?.(res.requestId, res.emailResults);
      reset();
      onClose();
    } catch (e: unknown) {
      if (isFunctionsResourceExhausted(e)) {
        const msg = getFirebaseErrorMessage(e);
        const looksLikeSignatureQuota =
          msg.includes('Quota de signatures') || msg.includes(SIGNATURE_QUOTA_EXHAUSTED_MSG);
        if (looksLikeSignatureQuota) {
          const quotaHit = await confirmFreeQuotaExceeded(structureId, 'signatures');
          if (quotaHit) {
            openFreeQuotaDialog('signatures');
            return;
          }
        }
      }
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : 'Échec de la création de la demande.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : () => { reset(); onClose(); }}
      fullWidth
      maxWidth={step === 'place' ? 'lg' : 'sm'}
      PaperProps={{
        sx:
          step === 'place'
            ? { height: { md: '90vh' }, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }
            : undefined,
      }}
    >
      <DialogTitle sx={{ fontWeight: 700, flexShrink: 0 }}>
        {step === 'form' ? 'Nouveau document à signer' : 'Placer les cases de signature'}
      </DialogTitle>
      <DialogContent
        sx={
          step === 'place'
            ? {
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }
            : undefined
        }
      >
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {step === 'form' && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Document PDF
            </Typography>
            <Box
              sx={{
                border: `1px dashed ${tokens.colors.gray300}`,
                borderRadius: tokens.radius.md,
                p: 2,
                mb: 2.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                bgcolor: tokens.colors.gray50,
              }}
            >
              <UploadFileIcon sx={{ color: tokens.colors.gray500 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>
                  {file ? file.name : 'Aucun fichier sélectionné'}
                </Typography>
                {file && (
                  <Typography variant="caption" color="text.secondary">
                    {(file.size / 1024).toFixed(0)} Ko
                  </Typography>
                )}
              </Box>
              <Button component="label" size="small" variant="outlined">
                Parcourir
                <input type="file" hidden accept="application/pdf,.pdf" onChange={handleFileChange} />
              </Button>
            </Box>

            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Mission (optionnel)
            </Typography>
            <Autocomplete
              options={missions}
              loading={missionsLoading}
              value={mission}
              onChange={(_, v) => setMission(v)}
              getOptionLabel={(o) =>
                o.numeroMission ? `${o.numeroMission} — ${o.title}` : o.title
              }
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  placeholder="Lier à une mission…"
                  helperText="Facultatif — le document pourra aussi rester hors mission."
                />
              )}
              sx={{ mb: 2.5 }}
            />

            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Signataires
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
            >
              Ajouter un signataire
            </Button>
          </>
        )}

        {step === 'place' && pdfPreviewUrl && (
          <SignatureFieldPlacer
            pdfUrl={pdfPreviewUrl}
            signers={cleanedSigners()}
            fields={fields}
            onChange={setFields}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {step === 'form' ? (
          <>
            <Button
              onClick={() => {
                reset();
                onClose();
              }}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button
              variant="contained"
              onClick={goToPlace}
              disabled={!file}
              sx={{
                bgcolor: tokens.colors.brandTeal,
                '&:hover': { bgcolor: tokens.colors.brandTeal700 },
              }}
            >
              Placer les signatures
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setStep('form')} disabled={loading}>
              Retour
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleSubmit()}
              disabled={loading || fields.length === 0}
              sx={{
                bgcolor: tokens.colors.brandTeal,
                '&:hover': { bgcolor: tokens.colors.brandTeal700 },
              }}
            >
              {loading ? 'Envoi…' : 'Envoyer en signature'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default NewSignatureRequestDialog;
