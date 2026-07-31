import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import { PersonAdd as PersonAddIcon } from '@mui/icons-material';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import UserAvatarInitials from '../../../components/common/UserAvatarInitials';
import { decryptUsersListProgressive, getSafeDisplayName } from '../../../utils/decryptUserUtils';
import { tokens } from '../../../theme/tokens';
import { CAND_PILL } from './constants';

export type CandidateApplicationStatus = 'En attente' | 'Acceptée' | 'Refusée';

export interface CandidatePick {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  firstName?: string;
  lastName?: string;
}

const STATUS_OPTIONS: CandidateApplicationStatus[] = ['En attente', 'Acceptée', 'Refusée'];

interface AddCandidatesDialogProps {
  open: boolean;
  structureId?: string;
  existingUserIds: string[];
  onClose: () => void;
  onSubmit: (users: CandidatePick[], status: CandidateApplicationStatus) => Promise<void>;
}

type StudentsCache = { structureId: string; users: CandidatePick[] };

export default function AddCandidatesDialog({
  open,
  structureId,
  existingUserIds,
  onClose,
  onSubmit,
}: AddCandidatesDialogProps) {
  const [options, setOptions] = useState<CandidatePick[]>([]);
  const [selected, setSelected] = useState<CandidatePick[]>([]);
  const [status, setStatus] = useState<CandidateApplicationStatus>('En attente');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const cacheRef = useRef<StudentsCache | null>(null);

  const existingSet = useMemo(() => new Set(existingUserIds), [existingUserIds]);

  const resetForm = useCallback(() => {
    setSelected([]);
    setStatus('En attente');
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    resetForm();
    onClose();
  }, [onClose, resetForm, submitting]);

  useEffect(() => {
    if (!open || !structureId) return;

    let cancelled = false;
    resetForm();

    const loadStudents = async () => {
      setLoading(true);
      setDecrypting(false);

      const applyFilter = (users: CandidatePick[]) =>
        users.filter((u) => !existingSet.has(u.id));

      if (cacheRef.current?.structureId === structureId) {
        setOptions(applyFilter(cacheRef.current.users));
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getDocs(
          query(
            collection(db, 'users'),
            where('structureId', '==', structureId),
            where('status', '==', 'etudiant')
          )
        );

        const users: CandidatePick[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            email: data.email || '',
            displayName: data.displayName || '',
            photoURL: data.photoURL,
            firstName: data.firstName,
            lastName: data.lastName,
          };
        });

        if (cancelled) return;

        cacheRef.current = { structureId, users };
        setOptions(applyFilter(users));
        setLoading(false);

        setDecrypting(true);
        void decryptUsersListProgressive(users, (updated) => {
          if (cancelled) return;
          cacheRef.current = { structureId, users: updated };
          setOptions(applyFilter(updated));
        }).finally(() => {
          if (!cancelled) setDecrypting(false);
        });
      } catch (error) {
        console.error('Erreur chargement étudiants:', error);
        if (!cancelled) setLoading(false);
      }
    };

    void loadStudents();
    return () => {
      cancelled = true;
    };
  }, [open, structureId, existingSet, resetForm]);

  const handleSubmit = async () => {
    if (selected.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(selected, status);
      resetForm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const optionLabel = (option: CandidatePick) => {
    const name = getSafeDisplayName(option);
    return name === option.email ? option.email : `${name} · ${option.email}`;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, pt: 2.5, px: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: `${tokens.colors.brandTeal}18`,
              color: tokens.colors.brandTeal,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PersonAddIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>
              Ajouter des candidats
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400, mt: 0.25 }}>
              Étudiants de la structure non encore inscrits sur cette mission
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, fontSize: 13 }}>
              Étudiants
            </Typography>
            {loading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Skeleton variant="rounded" height={56} />
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                  Chargement de la liste…
                </Typography>
              </Box>
            ) : (
              <>
                <Autocomplete
                  multiple
                  options={options}
                  value={selected}
                  onChange={(_, value) => setSelected(value)}
                  getOptionLabel={optionLabel}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  loading={decrypting}
                  loadingText="Mise à jour des noms…"
                  noOptionsText={
                    options.length === 0
                      ? 'Aucun étudiant disponible (tous sont déjà candidats ou la liste est vide)'
                      : 'Aucun résultat'
                  }
                  filterSelectedOptions
                  ListboxProps={{ style: { maxHeight: 280 } }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Rechercher par nom ou email…"
                      helperText={
                        decrypting
                          ? 'Affichage immédiat — les noms se complètent en arrière-plan'
                          : `${options.length} étudiant${options.length !== 1 ? 's' : ''} disponible${options.length !== 1 ? 's' : ''}`
                      }
                      FormHelperTextProps={{ sx: { mx: 0, mt: 0.75, fontSize: 11 } }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 0.25 }}>
                        <Avatar src={option.photoURL || undefined} sx={{ width: 32, height: 32 }}>
                          <UserAvatarInitials user={option} />
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>
                            {getSafeDisplayName(option)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {option.email}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        {...getTagProps({ index })}
                        key={option.id}
                        label={getSafeDisplayName(option)}
                        size="small"
                        sx={{ maxWidth: 180 }}
                      />
                    ))
                  }
                />
              </>
            )}
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, fontSize: 13 }}>
              Statut initial
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {STATUS_OPTIONS.map((s) => {
                const pill = CAND_PILL[s];
                const active = status === s;
                return (
                  <Chip
                    key={s}
                    label={s}
                    clickable
                    onClick={() => setStatus(s)}
                    variant={active ? 'filled' : 'outlined'}
                    sx={{
                      fontWeight: 500,
                      fontSize: 13,
                      borderColor: active ? 'transparent' : tokens.colors.gray200,
                      bgcolor: active ? pill.background : 'transparent',
                      color: active ? pill.color : tokens.colors.gray600,
                      '&:hover': {
                        bgcolor: active ? pill.background : tokens.colors.gray100,
                      },
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={handleClose} disabled={submitting} sx={{ textTransform: 'none' }}>
          Annuler
        </Button>
        <Button
          variant="contained"
          disabled={selected.length === 0 || loading || submitting}
          onClick={() => void handleSubmit()}
          sx={{
            textTransform: 'none',
            minWidth: 140,
            bgcolor: tokens.colors.brandTeal,
            '&:hover': { bgcolor: tokens.colors.brandTeal, filter: 'brightness(0.92)' },
          }}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {submitting
            ? 'Ajout…'
            : selected.length === 0
              ? 'Ajouter'
              : `Ajouter ${selected.length} candidat${selected.length > 1 ? 's' : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
