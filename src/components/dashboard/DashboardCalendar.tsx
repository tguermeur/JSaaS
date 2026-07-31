import React from 'react';
import { Box } from '@mui/material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import { tokens } from '../../theme/tokens';
import type { DashboardCalendarEvent, DashboardMission } from '../../hooks/useDashboardData';

export interface CalendarEventInput {
  id: string;
  title: string;
  start: string;
  end?: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  extendedProps: Record<string, unknown>;
}

interface DashboardCalendarProps {
  missions: DashboardMission[];
  calendarEvents: DashboardCalendarEvent[];
  getMissionColor: (numero: string) => { bg: string; text: string };
  onEventClick: (info: { event: { extendedProps: Record<string, unknown> } }) => void;
  onDateClick: (info: { dateStr: string }) => void;
  initialView?: 'dayGridMonth' | 'timeGridWeek';
  showTimeGrid?: boolean;
  height?: number | string;
  dayMaxEvents?: number | false;
  sx?: Record<string, unknown>;
}

const calendarSx = {
  '.fc': { fontFamily: 'inherit' },
  '.fc-toolbar-title': { fontSize: '1rem', fontWeight: 600 },
  '.fc-daygrid-day-number': {
    width: 28,
    height: 28,
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    lineHeight: 1,
  },
  '.fc-day-today': {
    backgroundColor: `${tokens.colors.info}08 !important`,
  },
  '.fc-day-today .fc-daygrid-day-number': {
    backgroundColor: tokens.colors.info,
    color: '#fff',
    fontWeight: 600,
  },
};

function buildEvents(
  missions: DashboardMission[],
  calendarEvents: DashboardCalendarEvent[],
  getMissionColor: DashboardCalendarProps['getMissionColor']
): CalendarEventInput[] {
  const missionEvents = missions.map((mission) => {
    const color = getMissionColor(mission.numeroMission);
    let endDate = mission.endDate;
    if (mission.endDate && mission.endDate !== mission.startDate) {
      const end = new Date(mission.endDate);
      end.setDate(end.getDate() + 1);
      endDate = end.toISOString().split('T')[0];
    }
    return {
      id: mission.id,
      title: mission.numeroMission,
      start: mission.startDate,
      end: endDate || undefined,
      backgroundColor: color.bg,
      textColor: color.text,
      borderColor: 'transparent',
      extendedProps: { description: mission.description, isMission: true },
    };
  });

  const customEvents = calendarEvents.map((event) => {
    let endDate = event.endDate;
    if (event.endDate && event.endDate !== event.startDate) {
      const end = new Date(event.endDate);
      end.setDate(end.getDate() + 1);
      endDate = end.toISOString().split('T')[0];
    }
    return {
      id: event.id,
      title: event.title,
      start: event.startDate,
      end: endDate || undefined,
      backgroundColor: event.isRelanceReminder ? '#ff9f0a30' : `${tokens.colors.textSecondary}30`,
      textColor: event.isRelanceReminder ? '#ff9f0a' : tokens.colors.textSecondary,
      borderColor: 'transparent',
      extendedProps: {
        description: event.description,
        isCustomEvent: true,
        isRelanceReminder: event.isRelanceReminder || false,
      },
    };
  });

  return [...missionEvents, ...customEvents];
}

const DashboardCalendar: React.FC<DashboardCalendarProps> = ({
  missions,
  calendarEvents,
  getMissionColor,
  onEventClick,
  onDateClick,
  initialView = 'dayGridMonth',
  showTimeGrid = false,
  height = 'auto',
  dayMaxEvents = false,
  sx = {},
}) => {
  const plugins = showTimeGrid
    ? [dayGridPlugin, timeGridPlugin, interactionPlugin]
    : [dayGridPlugin, interactionPlugin];

  return (
    <Box sx={{ ...calendarSx, ...sx }}>
      <FullCalendar
        plugins={plugins}
        initialView={initialView}
        locale={frLocale}
        events={buildEvents(missions, calendarEvents, getMissionColor)}
        eventClick={onEventClick}
        dateClick={onDateClick}
        headerToolbar={{
          left: 'prev,next',
          center: 'title',
          right: showTimeGrid ? 'dayGridMonth,timeGridWeek' : '',
        }}
        height={height}
        contentHeight={typeof height === 'number' ? height : 'auto'}
        dayMaxEvents={dayMaxEvents}
        fixedWeekCount={false}
      />
    </Box>
  );
};

export default DashboardCalendar;
