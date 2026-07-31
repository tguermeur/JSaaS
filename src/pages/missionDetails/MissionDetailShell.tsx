import React from 'react';
import { Box } from '@mui/material';
import { MissionDetailSidebar } from '../../components/ds/MissionDetailsPrimitives';

interface MissionDetailShellProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}

/** Corps 2 colonnes : contenu d’onglet + sidebar fixe 300px (DS v2). */
export const MissionDetailShell: React.FC<MissionDetailShellProps> = ({ children, sidebar }) => (
  <Box
    sx={{
      flex: 1,
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', lg: '1fr 300px' },
      minHeight: 0,
      overflow: 'hidden',
    }}
  >
    <Box sx={{ overflow: 'auto', p: { xs: 2, md: 3 }, minWidth: 0 }}>{children}</Box>
    <MissionDetailSidebar>{sidebar}</MissionDetailSidebar>
  </Box>
);
