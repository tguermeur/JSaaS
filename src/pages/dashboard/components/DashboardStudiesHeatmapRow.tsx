import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { DashboardPanel, SectionHead, Heatmap, ProgressBar } from '../../../components/ds';
import { tokens } from '../../../theme/tokens';
import type { DashboardMission, ConnectedUserItem } from '../../../hooks/useDashboardData';
import ChargeNameText from '../../../components/common/ChargeNameText';

export const DashboardStudiesHeatmapRow: React.FC<{
  missions: DashboardMission[];
  connectedUsers: ConnectedUserItem[];
  missionsLabel: string;
  onMissionClick?: (id: string, isEtude?: boolean, numero?: string) => void;
}> = ({ missions, connectedUsers, missionsLabel, onMissionClick }) => {
  const ongoing = missions.filter((m) => m.status === 'En cours' || m.status === 'active').slice(0, 5);

  const heatmap = useMemo(() => {
    const matrix = [
      [0, 1, 2, 1, 0, 0, 0],
      [2, 3, 4, 3, 1, 0, 0],
      [1, 2, 3, 2, 1, 0, 0],
      [0, 1, 1, 1, 0, 0, 0],
    ];
    connectedUsers.forEach((_, i) => {
      matrix[i % 4][i % 7] += 1;
    });
    return matrix;
  }, [connectedUsers]);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' }, gap: 2, px: 2, pb: 2 }}>
      <DashboardPanel>
        <SectionHead title={`${missionsLabel} en cours`} hint={`${ongoing.length} actives`} />
        <Box sx={{ p: 2 }}>
          {ongoing.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: tokens.colors.gray400, textAlign: 'center', py: 3 }}>Aucune {missionsLabel.toLowerCase()} en cours</Typography>
          ) : (
            ongoing.map((m) => (
              <Box
                key={m.id}
                onClick={() => onMissionClick?.(m.id, m.isEtude, m.numeroMission)}
                sx={{ py: 1.25, borderBottom: `1px solid ${tokens.colors.gray100}`, cursor: 'pointer', '&:last-child': { borderBottom: 'none' }, '&:hover': { bgcolor: tokens.colors.gray50 } }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.colors.gray900 }}>#{m.numeroMission} · {m.company}</Typography>
                  <ChargeNameText
                    chargeId={m.chargeId}
                    chargeName={m.chargeName}
                    fallback="—"
                    sx={{ fontSize: 11, color: tokens.colors.gray400 }}
                  />
                </Box>
                <ProgressBar pct={45 + (m.id.charCodeAt(0) % 40)} />
              </Box>
            ))
          )}
        </Box>
      </DashboardPanel>
      <DashboardPanel>
        <SectionHead title="Activité équipe" hint="Connexions par créneau" />
        <Heatmap matrix={heatmap} dayLabels={['L', 'Ma', 'Me', 'J', 'V', 'S', 'D']} slotLabels={['8h', '12h', '16h', '20h']} />
      </DashboardPanel>
    </Box>
  );
};
