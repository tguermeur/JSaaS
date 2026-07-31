import React from 'react';
import { Typography } from '@mui/material';
import { DetailPanel } from '../../components/ds/MissionDetailsPrimitives';
import { tokens } from '../../theme/tokens';
import type { MissionDetailTabId } from '../../hooks/useMissionDetailTabs';

export interface MissionDetailSection {
  title: string;
  tab: MissionDetailTabId;
  content: React.ReactNode;
}

export function renderDetailPanels(sections: MissionDetailSection[], tab: MissionDetailTabId): React.ReactNode {
  const filtered = sections.filter((s) => s.tab === tab);
  if (filtered.length === 0) {
    return (
      <Typography sx={{ fontSize: 13, color: tokens.colors.gray500, textAlign: 'center', py: 4 }}>
        Aucun contenu pour cet onglet.
      </Typography>
    );
  }
  return filtered.map((section) => (
    <DetailPanel key={section.title} title={section.title}>
      {section.content}
    </DetailPanel>
  ));
}
