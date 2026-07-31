import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { DetailPanel, TimelineItem } from '../../components/ds/MissionDetailsPrimitives';
import UserReferenceText from '../../components/common/UserReferenceText';
import { tokens } from '../../theme/tokens';

export interface MissionActivityEntry {
  id: string;
  date?: string;
  action?: string;
  details?: string;
  description?: string;
  type?: string;
  userId?: string;
  actorName?: string;
}

interface ActivityTabProps {
  entries: MissionActivityEntry[];
  loading?: boolean;
}

function formatActivityDate(date?: string): string {
  if (!date) return '—';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ActivityTab: React.FC<ActivityTabProps> = ({ entries, loading }) => (
  <DetailPanel title="Historique de la mission">
    {loading ? (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    ) : entries.length === 0 ? (
      <Typography sx={{ fontSize: 13, color: tokens.colors.gray500, textAlign: 'center', py: 4 }}>
        Aucune activité enregistrée pour cette mission.
      </Typography>
    ) : (
      <Box>
        {entries.map((entry) => (
          <TimelineItem
            key={entry.id}
            actor={
              <UserReferenceText
                userId={entry.userId}
                name={entry.actorName}
                fallback="Utilisateur"
                component="span"
                sx={{ fontWeight: 600, fontSize: 'inherit', color: 'inherit' }}
              />
            }
            action={entry.action || entry.description || 'a effectué une action'}
            details={entry.details}
            date={formatActivityDate(entry.date)}
          />
        ))}
      </Box>
    )}
  </DetailPanel>
);
