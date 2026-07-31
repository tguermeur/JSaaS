import React from 'react';
import { Box, Typography } from '@mui/material';
import { tokens } from '../../theme/tokens';
import type { MissionDetailTabId } from '../../hooks/useMissionDetailTabs';

interface MissionDetailTabPanelsProps {
  activeTab: MissionDetailTabId;
  panels: Partial<Record<MissionDetailTabId, React.ReactNode>>;
}

const TAB_LABELS: Record<MissionDetailTabId, string> = {
  overview: "Vue d'ensemble",
  candidates: 'Candidats',
  documents: 'Documents',
  notes: 'Notes',
  activity: 'Activité',
};

/** Affiche uniquement le panneau de l’onglet actif (pattern DS v2). */
export const MissionDetailTabPanels: React.FC<MissionDetailTabPanelsProps> = ({ activeTab, panels }) => {
  const content = panels[activeTab];
  if (!content) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 14, color: tokens.colors.gray500 }}>
          Contenu indisponible pour l’onglet « {TAB_LABELS[activeTab]} ».
        </Typography>
      </Box>
    );
  }

  return (
    <Box role="tabpanel" aria-labelledby={`mission-tab-${activeTab}`} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {content}
    </Box>
  );
};
