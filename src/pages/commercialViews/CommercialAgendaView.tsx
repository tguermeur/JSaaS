import React, { useMemo, useState } from 'react';
import { Box, Button, IconButton, Typography } from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Flag as FlagIcon,
  Phone as PhoneIcon,
  Storefront as SalonIcon,
  Campaign as MegaphoneIcon,
  Email as EmailIcon,
  Check as CheckIcon,
  CalendarMonth as CalendarEmptyIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import {
  CommercialEmptyState,
  CommercialStatusChip,
  CompanyLogo,
  RelancePill,
} from '../../components/ds';
import { tokens } from '../../theme/tokens';
import UserNameText from '../../components/common/UserNameText';
import UserAvatarInitials from '../../components/common/UserAvatarInitials';
import { MONTHS_FULL, WEEKDAYS_FULL, parseDateOnly, toIsoDate } from '../../utils/commercialRelance';
import type { CommercialCalendarEvent, CommercialMember, CommercialProspect, CommercialViewActions } from './types';

const TYPE_CFG = {
  relance: { color: tokens.colors.brandTeal, icon: <FlagIcon sx={{ fontSize: 15 }} />, label: 'Relance' },
  meeting: { color: tokens.colors.brandNavy, icon: <PhoneIcon sx={{ fontSize: 15 }} />, label: 'Rendez-vous' },
  call: { color: tokens.colors.brandNavy, icon: <PhoneIcon sx={{ fontSize: 15 }} />, label: 'Appel' },
  salon: { color: '#7c3aed', icon: <MegaphoneIcon sx={{ fontSize: 15 }} />, label: 'Salon' },
  task: { color: tokens.colors.gray500, icon: <TimeIcon sx={{ fontSize: 15 }} />, label: 'Tâche' },
  deadline: { color: tokens.colors.error, icon: <TimeIcon sx={{ fontSize: 15 }} />, label: 'Échéance' },
  reminder: { color: tokens.colors.warning, icon: <TimeIcon sx={{ fontSize: 15 }} />, label: 'Rappel' },
} as const;

type AgendaEventType = keyof typeof TYPE_CFG;

interface AgendaEvent {
  id: string;
  date: string;
  type: AgendaEventType;
  title: string;
  time?: string;
  ownerId?: string;
  prospect?: CommercialProspect;
}

const keyOf = (y: number, m: number, day: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const navBtnSx = {
  width: 30,
  height: 30,
  borderRadius: tokens.radius.sm,
  border: `1px solid ${tokens.colors.gray200}`,
  bgcolor: tokens.colors.bgPaper,
  color: tokens.colors.gray500,
};

export interface CommercialAgendaViewProps {
  prospects: CommercialProspect[];
  events: CommercialCalendarEvent[];
  members: CommercialMember[];
  accent?: string;
  canWrite?: boolean;
  act: CommercialViewActions;
  getName: (p: CommercialProspect) => string;
  getCompany: (p: CommercialProspect) => string;
}

export const CommercialAgendaView: React.FC<CommercialAgendaViewProps> = ({
  prospects,
  events,
  members,
  accent = tokens.colors.brandTeal,
  canWrite,
  act,
  getName,
  getCompany,
}) => {
  const base = new Date();
  const [ym, setYm] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const [selected, setSelected] = useState(toIsoDate(base));

  const getMember = (id?: string) => members.find(m => m.id === id);

  const byDay = useMemo(() => {
    const map: Record<string, AgendaEvent[]> = {};
    const push = (d: string, ev: AgendaEvent) => {
      (map[d] = map[d] || []).push(ev);
    };
    prospects.forEach(p => {
      if (p.dateRecontact && p.statut !== 'abandon') {
        push(p.dateRecontact, {
          id: `r-${p.id}`,
          date: p.dateRecontact,
          type: 'relance',
          title: `Relancer ${getCompany(p)}`,
          ownerId: p.ownerId,
          prospect: p,
        });
      }
    });
    events.forEach(e => {
      const date = e.start.slice(0, 10);
      const type: AgendaEventType =
        e.type === 'salon' ? 'salon' :
        e.type === 'call' ? 'call' :
        e.type === 'meeting' ? 'meeting' :
        e.type === 'deadline' ? 'deadline' :
        e.type === 'reminder' ? 'reminder' : 'task';
      push(date, {
        id: e.id,
        date,
        type,
        title: e.title,
        time: new Date(e.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        ownerId: e.ownerId,
      });
    });
    return map;
  }, [prospects, events, getCompany]);

  const todayKey = toIsoDate(base);
  const first = new Date(ym.y, ym.m, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const move = (delta: number) =>
    setYm(s => {
      let m = s.m + delta;
      let y = s.y;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { y, m };
    });

  const selList = (byDay[selected] || []).slice().sort((a, b) => (a.type === 'relance' ? -1 : 1));
  const selDate = parseDateOnly(selected);

  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 3, py: 2, borderBottom: `1px solid ${tokens.colors.gray100}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontSize: 11, color: tokens.colors.gray500, fontWeight: 600 }}>PÔLE COMMERCIAL</Typography>
          <Typography component="h2" sx={{ mt: 0.375, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: tokens.colors.gray900 }}>Agenda</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
            {(['relance', 'meeting', 'salon'] as const).map(k => (
              <Box key={k} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 12, color: tokens.colors.gray500 }}>
                <Box sx={{ width: 9, height: 9, borderRadius: '3px', bgcolor: TYPE_CFG[k].color }} />
                {TYPE_CFG[k].label}
              </Box>
            ))}
          </Box>
          {canWrite && (
            <Button variant="contained" onClick={act.onAdd} sx={{ textTransform: 'none', bgcolor: accent, '&:hover': { bgcolor: tokens.colors.brandTeal700 } }}>
              Ajouter
            </Button>
          )}
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1fr) 326px' } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, p: '16px 20px', overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.75 }}>
            <Typography sx={{ fontSize: 17, fontWeight: 700, color: tokens.colors.gray900, textTransform: 'capitalize' }}>
              {MONTHS_FULL[ym.m]} {ym.y}
            </Typography>
            <IconButton size="small" onClick={() => move(-1)} sx={navBtnSx}><ChevronLeft fontSize="small" /></IconButton>
            <IconButton size="small" onClick={() => move(1)} sx={navBtnSx}><ChevronRight fontSize="small" /></IconButton>
            <Button
              size="small"
              variant="outlined"
              onClick={() => { setYm({ y: base.getFullYear(), m: base.getMonth() }); setSelected(todayKey); }}
              sx={{ ml: 0.75, textTransform: 'none', fontWeight: 600, borderColor: tokens.colors.gray200, color: tokens.colors.gray700 }}
            >
              Aujourd&apos;hui
            </Button>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', mb: 0.75 }}>
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
              <Typography key={d} sx={{ fontSize: 11, fontWeight: 600, color: tokens.colors.gray400, textAlign: 'center', py: 0.25 }}>{d}</Typography>
            ))}
          </Box>

          <Box sx={{ flex: 1, minHeight: 280, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr', gap: 0.75 }}>
            {cells.map((d, i) => {
              if (d == null) return <Box key={`e-${i}`} />;
              const k = keyOf(ym.y, ym.m, d);
              const evs = byDay[k] || [];
              const isToday = k === todayKey;
              const isSel = k === selected;
              const wknd = i % 7 >= 5;
              return (
                <Box
                  key={k}
                  component="button"
                  type="button"
                  onClick={() => setSelected(k)}
                  sx={{
                    border: isSel ? `1.5px solid ${accent}` : `1px solid ${tokens.colors.gray100}`,
                    borderRadius: tokens.radius.md,
                    bgcolor: isSel ? `${accent}08` : wknd ? tokens.colors.gray50 : tokens.colors.bgPaper,
                    p: '6px 7px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.375,
                    minHeight: 0,
                    overflow: 'hidden',
                    transition: 'all 0.12s',
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                      borderRadius: tokens.radius.pill,
                      fontSize: 12,
                      fontWeight: isToday ? 700 : 500,
                      bgcolor: isToday ? accent : 'transparent',
                      color: isToday ? '#fff' : tokens.colors.gray700,
                      flexShrink: 0,
                    }}
                  >
                    {d}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, overflow: 'hidden' }}>
                    {evs.slice(0, 3).map(ev => {
                      const c = TYPE_CFG[ev.type];
                      return (
                        <Box
                          key={ev.id}
                          component="span"
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            fontSize: 10.5,
                            color: tokens.colors.gray700,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            bgcolor: `${c.color}14`,
                            borderRadius: '4px',
                            px: 0.5,
                            py: '1px',
                          }}
                        >
                          <Box component="span" sx={{ width: 5, height: 5, borderRadius: tokens.radius.pill, bgcolor: c.color, flexShrink: 0 }} />
                          {ev.type === 'relance' && ev.prospect ? getCompany(ev.prospect) : ev.title}
                        </Box>
                      );
                    })}
                    {evs.length > 3 && (
                      <Typography sx={{ fontSize: 10, color: tokens.colors.gray400, pl: 0.5 }}>+{evs.length - 3}</Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box
          component="aside"
          sx={{
            borderLeft: { md: `1px solid ${tokens.colors.gray100}` },
            borderTop: { xs: `1px solid ${tokens.colors.gray100}`, md: 'none' },
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            bgcolor: '#fcfcfd',
          }}
        >
          <Box sx={{ px: 2.25, pt: 2, pb: 1.5, borderBottom: `1px solid ${tokens.colors.gray100}` }}>
            <Typography sx={{ fontSize: 12, color: accent, fontWeight: 600, textTransform: 'capitalize' }}>
              {selDate ? WEEKDAYS_FULL[selDate.getDay()] : ''}
            </Typography>
            <Typography sx={{ fontSize: 19, fontWeight: 700, color: tokens.colors.gray900 }}>
              {selDate ? `${selDate.getDate()} ${MONTHS_FULL[selDate.getMonth()]}` : ''}
            </Typography>
            <Typography sx={{ fontSize: 12, color: tokens.colors.gray400, mt: 0.25 }}>
              {selList.length} élément{selList.length > 1 ? 's' : ''}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 1.75 }}>
            {selList.length === 0 ? (
              <CommercialEmptyState icon={<CalendarEmptyIcon />} title="Rien de prévu" subtitle="Aucune relance ni rendez-vous ce jour." />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {selList.map(ev => {
                  const c = TYPE_CFG[ev.type];
                  if (ev.type === 'relance' && ev.prospect) {
                    const p = ev.prospect;
                    return (
                      <Box
                        key={ev.id}
                        onClick={() => act.onOpen(p.id)}
                        sx={{
                          bgcolor: tokens.colors.bgPaper,
                          border: `1px solid ${tokens.colors.gray200}`,
                          borderRadius: tokens.radius.md,
                          p: 1.5,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: tokens.colors.gray50 },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.125 }}>
                          <CompanyLogo name={getCompany(p)} size={32} />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.colors.gray900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {getCompany(p)}
                            </Typography>
                            <Typography sx={{ fontSize: 11.5, color: tokens.colors.gray500 }}>{getName(p)}</Typography>
                          </Box>
                          <Box
                            title={getMember(p.ownerId)?.displayName || '—'}
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: tokens.radius.pill,
                              bgcolor: tokens.colors.brandTeal,
                              color: '#fff',
                              fontSize: 9,
                              fontWeight: 700,
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <UserAvatarInitials user={getMember(p.ownerId)} fontSize="0.7rem" />
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                          <RelancePill date={p.dateRecontact} accent={accent} size="sm" />
                          <Box sx={{ display: 'flex', gap: 0.75 }} onClick={e => e.stopPropagation()}>
                            {act.onCompose && (
                              <IconButton size="small" onClick={() => act.onCompose!(p)} sx={{ border: `1px solid ${tokens.colors.gray200}`, borderRadius: tokens.radius.xs }}>
                                <EmailIcon fontSize="small" />
                              </IconButton>
                            )}
                            <IconButton size="small" onClick={() => act.onMarkDone(p)} sx={{ border: `1px solid ${tokens.colors.gray200}`, borderRadius: tokens.radius.xs, color: accent }}>
                              <CheckIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                      </Box>
                    );
                  }
                  return (
                    <Box
                      key={ev.id}
                      sx={{
                        bgcolor: tokens.colors.bgPaper,
                        border: `1px solid ${tokens.colors.gray200}`,
                        borderRadius: tokens.radius.md,
                        p: 1.5,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.375,
                      }}
                    >
                      <Box sx={{ width: 32, height: 32, borderRadius: tokens.radius.sm, bgcolor: `${c.color}14`, color: c.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        {ev.type === 'salon' ? <SalonIcon sx={{ fontSize: 15 }} /> : c.icon}
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.colors.gray900 }}>{ev.title}</Typography>
                        <Typography sx={{ fontSize: 11.5, color: tokens.colors.gray400, mt: 0.25, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <TimeIcon sx={{ fontSize: 12 }} />
                          {ev.time || 'Journée'}
                          <Box component="span" sx={{ color: tokens.colors.gray300 }}>·</Box>
                          <UserNameText
                            user={getMember(ev.ownerId)}
                            mode="displayName"
                            fallback="—"
                            component="span"
                            sx={{ fontSize: 11.5, color: tokens.colors.gray400 }}
                          />
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
