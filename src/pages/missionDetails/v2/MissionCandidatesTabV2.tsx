import React, { useMemo, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import {
  Schedule as ClockIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { tokens } from '../../../theme/tokens';
import {
  CollapsiblePanel,
  CandidateRowV2,
  FilterChipRow,
  KvCell,
  MissionEmptyState,
} from '../../../components/ds/missionDetailsV2/MissionDetailsV2Primitives';
import UserReferenceText from '../../../components/common/UserReferenceText';
import { useDecryptedUserName } from '../../../hooks/useDecryptedUserName';
import { useDecryptedUserContactFields } from '../../../hooks/useDecryptedUserContactFields';
import { formatPhoneDisplay } from '../../../utils/formatPhone';
import { isEncryptedField } from '../../../utils/decryptUserUtils';

interface Application {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName?: string;
  userPhone?: string;
  userStudentId?: string;
  status: 'En attente' | 'Acceptée' | 'Refusée';
  submittedAt: Date;
  cvUrl?: string | null;
  motivationLetter?: string | null;
  workingHours?: Array<{ date: string; startTime: string; endTime: string }>;
  documentTagOverrides?: Record<string, string>;
}

interface MissionCandidatesTabV2Props {
  applications: Application[];
  canWrite: boolean;
  loading?: boolean;
  onAddCandidate: () => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onWorkingHours: (app: Application) => void;
  onDownloadCv: (url: string) => void;
}

const FILTERS = [
  { id: 'all', label: 'Toutes' },
  { id: 'En attente', label: 'En attente' },
  { id: 'Acceptée', label: 'Acceptées' },
  { id: 'Refusée', label: 'Refusées' },
] as const;

function countHours(wh?: Application['workingHours']): number {
  if (!wh?.length) return 0;
  return wh.reduce((sum, slot) => {
    const [sh, sm] = slot.startTime.split(':').map(Number);
    const [eh, em] = slot.endTime.split(':').map(Number);
    return sum + Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
  }, 0);
}

const CandidateAvatarInitials: React.FC<{ app: Application }> = ({ app }) => {
  const { initials } = useDecryptedUserName(
    { id: app.userId, displayName: app.userDisplayName, email: app.userEmail },
    app.userEmail.slice(0, 2).toUpperCase()
  );
  return <>{initials || app.userEmail.slice(0, 2).toUpperCase()}</>;
};

const CandidateContactFields: React.FC<{ app: Application }> = ({ app }) => {
  const { phone, studentId, loading } = useDecryptedUserContactFields(
    app.userId,
    app.userPhone,
    app.userStudentId
  );

  const phoneDisplay = loading
    ? '…'
    : phone
      ? formatPhoneDisplay(phone)
      : app.userPhone && !isEncryptedField(app.userPhone)
        ? formatPhoneDisplay(app.userPhone)
        : '—';

  const studentIdDisplay =
    loading ? '…' : studentId || (app.userStudentId && !isEncryptedField(app.userStudentId) ? app.userStudentId : '—');

  return (
    <>
      <KvCell label="Téléphone" value={phoneDisplay} />
      <KvCell label="Numéro étudiant" value={studentIdDisplay} />
    </>
  );
};

export const MissionCandidatesTabV2: React.FC<MissionCandidatesTabV2Props> = ({
  applications,
  canWrite,
  loading,
  onAddCandidate,
  onAccept,
  onReject,
  onWorkingHours,
  onDownloadCv,
}) => {
  const [filter, setFilter] = useState<string>('all');

  const filterItems = useMemo(
    () =>
      FILTERS.map((f) => ({
        ...f,
        count: f.id === 'all' ? applications.length : applications.filter((a) => a.status === f.id).length,
      })),
    [applications]
  );

  const filtered = useMemo(
    () => (filter === 'all' ? applications : applications.filter((a) => a.status === filter)),
    [applications, filter]
  );

  return (
    <CollapsiblePanel
      title="Candidatures"
      action={
        canWrite ? (
          <Button
            size="small"
            onClick={onAddCandidate}
            sx={{ textTransform: 'none', fontSize: 12, color: tokens.colors.brandTeal }}
          >
            Ajouter un candidat
          </Button>
        ) : undefined
      }
    >
      <FilterChipRow items={filterItems} value={filter} onChange={setFilter} />

      {loading ? (
        <Typography sx={{ fontSize: 12, color: tokens.colors.gray400, textAlign: 'center', py: 4 }}>
          Chargement…
        </Typography>
      ) : filtered.length === 0 ? (
        <MissionEmptyState text="Aucune candidature dans cette catégorie" />
      ) : (
        filtered.map((app) => {
          const hours = countHours(app.workingHours);
          const amendmentHours =
            app.documentTagOverrides?.amendment_new_hours ??
            app.documentTagOverrides?.amendment_actual_hours ??
            app.documentTagOverrides?.actualHours;
          return (
            <CandidateRowV2
              key={app.id}
              initials={<CandidateAvatarInitials app={app} />}
              name={
                <UserReferenceText
                  userId={app.userId}
                  name={app.userDisplayName}
                  fallback={app.userEmail.split('@')[0]}
                  component="span"
                  sx={{ fontSize: 13, fontWeight: 600 }}
                />
              }
              meta={`Candidaté le ${app.submittedAt.toLocaleDateString('fr-FR')} · ${hours}h saisies`}
              status={app.status}
              hasCv={!!app.cvUrl}
              hasMotivation={!!app.motivationLetter}
              expandedContent={
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2, pt: 1.5 }}>
                  <KvCell label="Email" value={app.userEmail} />
                  <CandidateContactFields app={app} />
                  {app.status === 'Acceptée' && (
                    <Box sx={{ gridColumn: '1 / -1' }}>
                      <Typography sx={{ fontSize: 11, color: tokens.colors.gray500 }}>
                        {amendmentHours
                          ? `Heures avenant : ${amendmentHours} h`
                          : 'Heures pour l\'avenant : à renseigner lors de la génération'}
                      </Typography>
                    </Box>
                  )}
                  {app.motivationLetter && (
                    <Box sx={{ gridColumn: '1 / -1' }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 600, color: tokens.colors.gray400, textTransform: 'uppercase', mb: 0.5 }}>
                        Lettre de motivation
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: 12,
                          color: tokens.colors.gray700,
                          bgcolor: '#fafafa',
                          p: 1.5,
                          borderRadius: '6px',
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.55,
                        }}
                      >
                        {app.motivationLetter}
                      </Typography>
                    </Box>
                  )}
                </Box>
              }
              actions={
                <>
                  {canWrite && (
                    <Button
                      size="small"
                      startIcon={<ClockIcon sx={{ fontSize: 14 }} />}
                      onClick={() => onWorkingHours(app)}
                      sx={{ textTransform: 'none', fontSize: 12, color: tokens.colors.gray600 }}
                    >
                      Heures travaillées
                    </Button>
                  )}
                  {app.cvUrl && (
                    <Button
                      size="small"
                      startIcon={<DownloadIcon sx={{ fontSize: 14 }} />}
                      onClick={() => onDownloadCv(app.cvUrl!)}
                      sx={{ textTransform: 'none', fontSize: 12, color: tokens.colors.gray600 }}
                    >
                      Télécharger CV
                    </Button>
                  )}
                  {canWrite && app.status === 'En attente' && (
                    <>
                      <Button
                        size="small"
                        onClick={() => onReject(app.id)}
                        sx={{ textTransform: 'none', fontSize: 12, color: '#dc2626' }}
                      >
                        Refuser
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => onAccept(app.id)}
                        sx={{
                          textTransform: 'none',
                          fontSize: 12,
                          bgcolor: tokens.colors.brandTeal,
                          '&:hover': { bgcolor: tokens.colors.brandTeal, filter: 'brightness(0.95)' },
                        }}
                      >
                        Accepter
                      </Button>
                    </>
                  )}
                </>
              }
            />
          );
        })
      )}
    </CollapsiblePanel>
  );
};
