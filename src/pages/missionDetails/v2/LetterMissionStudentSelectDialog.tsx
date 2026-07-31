import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import { tokens } from '../../../theme/tokens';
import UserReferenceText from '../../../components/common/UserReferenceText';
import UserAvatarInitials from '../../../components/common/UserAvatarInitials';
import { CandidateStatusPill } from '../../../components/ds/missionDetailsV2/MissionDetailsV2Primitives';

export interface LmApplicationOption {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName?: string;
  status: string;
}

interface LetterMissionStudentSelectDialogProps {
  open: boolean;
  applications: LmApplicationOption[];
  generating?: boolean;
  onClose: () => void;
  onGenerate: (applicationId: string) => void;
}

export const LetterMissionStudentSelectDialog: React.FC<LetterMissionStudentSelectDialogProps> = ({
  open,
  applications,
  generating,
  onClose,
  onGenerate,
}) => {
  const [selectedId, setSelectedId] = useState('');

  const acceptedCandidates = useMemo(
    () => applications.filter((app) => app.status === 'Acceptée'),
    [applications]
  );

  const candidates = acceptedCandidates.length > 0 ? acceptedCandidates : applications;
  const onlyAcceptedShown = acceptedCandidates.length > 0;

  useEffect(() => {
    if (!open) {
      setSelectedId('');
      return;
    }
    if (candidates.length === 1) {
      setSelectedId(candidates[0].id);
    }
  }, [open, candidates]);

  const canGenerate = !!selectedId && !generating && candidates.length > 0;

  return (
    <Dialog
      open={open}
      onClose={generating ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: tokens.colors.gray900 }}>
          Générer une lettre de mission
        </Typography>
        <Typography sx={{ fontSize: 13, color: tokens.colors.gray500, mt: 0.5, fontWeight: 400 }}>
          Choisissez l&apos;étudiant pour lequel générer la lettre de mission (LM).
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 1, flex: '1 1 auto', overflowY: 'auto', position: 'relative' }}>
        {generating && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              px: 3,
              bgcolor: 'rgba(255,255,255,0.92)',
              borderRadius: '8px',
            }}
          >
            <CircularProgress size={40} sx={{ color: '#173B6C' }} />
            <Typography sx={{ fontSize: 16, fontWeight: 600, color: tokens.colors.gray900, textAlign: 'center' }}>
              Génération de la lettre de mission…
            </Typography>
            <Typography sx={{ fontSize: 13, color: tokens.colors.gray500, textAlign: 'center' }}>
              Préparation du PDF — merci de patienter quelques instants.
            </Typography>
            <LinearProgress sx={{ width: '100%', maxWidth: 280, mt: 1 }} />
          </Box>
        )}

        {!onlyAcceptedShown && applications.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Aucune candidature acceptée — tous les candidats de la mission sont listés ci-dessous.
          </Alert>
        )}

        {candidates.length === 0 ? (
          <Box
            sx={{
              py: 4,
              px: 2,
              textAlign: 'center',
              borderRadius: '10px',
              bgcolor: tokens.colors.gray50,
              border: `1px dashed ${tokens.colors.gray200}`,
            }}
          >
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.colors.gray700 }}>
              Aucun candidat disponible
            </Typography>
            <Typography sx={{ fontSize: 13, color: tokens.colors.gray500, mt: 0.5 }}>
              Acceptez au moins une candidature pour générer une LM.
            </Typography>
          </Box>
        ) : (
          <>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.colors.gray600, mb: 1 }}>
              Étudiant concerné
            </Typography>
            <RadioGroup value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {candidates.map((app) => (
                <Box
                  key={app.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.25,
                    mb: 0.75,
                    borderRadius: '10px',
                    border: `1px solid ${selectedId === app.id ? tokens.colors.brandTeal : tokens.colors.gray200}`,
                    bgcolor: selectedId === app.id ? '#f0fdfa' : tokens.colors.bgPaper,
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedId(app.id)}
                >
                  <FormControlLabel
                    value={app.id}
                    control={<Radio size="small" sx={{ p: 0.5 }} />}
                    label=""
                    sx={{ m: 0 }}
                  />
                  <Avatar sx={{ width: 36, height: 36, bgcolor: tokens.colors.brandNavy }}>
                    <UserAvatarInitials user={{ id: app.userId, displayName: app.userDisplayName }} />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <UserReferenceText
                      userId={app.userId}
                      name={app.userDisplayName}
                      fallback={app.userEmail.split('@')[0]}
                      sx={{ fontSize: 14, fontWeight: 600 }}
                    />
                    <Typography sx={{ fontSize: 12, color: tokens.colors.gray500 }} noWrap>
                      {app.userEmail}
                    </Typography>
                  </Box>
                  <CandidateStatusPill status={app.status} />
                </Box>
              ))}
            </RadioGroup>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} disabled={!!generating} sx={{ textTransform: 'none' }}>
          Annuler
        </Button>
        <Button
          variant="contained"
          disabled={!canGenerate}
          onClick={() => selectedId && onGenerate(selectedId)}
          sx={{
            textTransform: 'none',
            bgcolor: '#173B6C',
            '&:hover': { bgcolor: '#122f56' },
          }}
        >
          {generating ? 'Génération…' : 'Générer la LM'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
