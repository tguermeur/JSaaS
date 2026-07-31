import React from 'react';
import { Box, Button } from '@mui/material';
import type { DashboardCalendarEvent, DashboardMission, ConnectedUserItem } from '../../../hooks/useDashboardData';
import { DashboardHeaderKpis } from './DashboardHeaderKpis';
import { DashboardWeekCalendar } from './DashboardWeekCalendar';
import { DashboardStudiesHeatmapRow } from './DashboardStudiesHeatmapRow';
import { DashboardActivityFeed } from './DashboardActivityFeed';
import { tokens } from '../../../theme/tokens';

export interface DashboardJuniorBodyProps {
  missions: DashboardMission[];
  calendarEvents: DashboardCalendarEvent[];
  connectedUsers: ConnectedUserItem[];
  missionsLabel: string;
  onOpenCalendar: () => void;
  onMissionClick: (id: string, isEtude?: boolean, numero?: string) => void;
}

export const DashboardJuniorBody: React.FC<DashboardJuniorBodyProps> = ({
  missions,
  calendarEvents,
  connectedUsers,
  missionsLabel,
  onOpenCalendar,
  onMissionClick,
}) => (
  <Box>
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: 2, pt: 2, pb: 1 }}>
      <Button size="small" variant="outlined" sx={{ textTransform: 'none', borderRadius: tokens.radius.md }} onClick={onOpenCalendar}>
        Calendrier mensuel
      </Button>
    </Box>
    <DashboardWeekCalendar events={calendarEvents} />
    <DashboardStudiesHeatmapRow
      missions={missions}
      connectedUsers={connectedUsers}
      missionsLabel={missionsLabel}
      onMissionClick={onMissionClick}
    />
    <DashboardActivityFeed users={connectedUsers} />
  </Box>
);

export { DashboardHeaderKpis };
