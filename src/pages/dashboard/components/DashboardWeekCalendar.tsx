import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { DashboardPanel, SectionHead, WeekCalendar, type WeekCalendarDay } from '../../../components/ds';
import type { DashboardCalendarEvent } from '../../../hooks/useDashboardData';

const DOW = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

export const DashboardWeekCalendar: React.FC<{ events: DashboardCalendarEvent[] }> = ({ events }) => {
  const days = useMemo((): WeekCalendarDay[] => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    return DOW.map((dow, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const dayEvents = events
        .filter((e) => e.startDate?.startsWith(iso))
        .slice(0, 3)
        .map((e) => ({
          time: e.startDate?.slice(11, 16) || '09:00',
          title: e.title,
          type: (e.isRelanceReminder ? 'deadline' : e.isCustomEvent ? 'internal' : 'client') as WeekCalendarDay['events'][0]['type'],
        }));
      return { dow, day: d.getDate(), today: d.toDateString() === now.toDateString(), events: dayEvents };
    });
  }, [events]);

  return (
    <Box sx={{ p: 2 }}>
      <DashboardPanel>
        <SectionHead title="Semaine en cours" hint="Événements & échéances" />
        <WeekCalendar days={days} />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, px: 2.5, py: 1.5, borderTop: `1px solid #f3f4f6` }}>
          {[
            { label: 'Client', color: '#10b981' },
            { label: 'Échéance', color: '#f59e0b' },
            { label: 'Interne', color: '#6366f1' },
          ].map((l) => (
            <Box key={l.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 11, color: '#6b7280' }}>
              <Box sx={{ width: 8, height: 8, borderRadius: 1, bgcolor: l.color }} />
              {l.label}
            </Box>
          ))}
        </Box>
      </DashboardPanel>
    </Box>
  );
};
