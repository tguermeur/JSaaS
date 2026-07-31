import React, { useMemo, useState } from 'react';
import { Box, Button, IconButton, Typography } from '@mui/material';
import {
  WarningAmber as AlertIcon,
  LocalFireDepartment as FlameIcon,
  Schedule as ClockIcon,
  CheckCircle as CheckIcon,
  TrackChanges as TargetIcon,
  Bolt as ZapIcon,
  Snooze as SnoozeIcon,
  CalendarMonth as CalendarIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import {
  CommercialEmptyState,
  CommercialProgressBar,
  CommercialStatusChip,
  CompanyLogo,
  RelancePill,
} from '../../components/ds';
import { tokens } from '../../theme/tokens';
import UserAvatarInitials from '../../components/common/UserAvatarInitials';
import { contactState, fmtDateLong, greeting, relanceState, toIsoDate } from '../../utils/commercialRelance';
import type { CommercialMember, CommercialProspect, CommercialViewActions } from './types';

interface GroupProps {
  title: string;
  icon: React.ReactNode;
  tone: { bg: string; fg: string };
  items: CommercialProspect[];
  accent: string;
  act: CommercialViewActions;
  getName: (p: CommercialProspect) => string;
  getCompany: (p: CommercialProspect) => string;
  members: CommercialMember[];
  defaultOpen?: boolean;
}

const Group: React.FC<GroupProps> = ({
  title,
  icon,
  tone,
  items,
  accent,
  act,
  getName,
  getCompany,
  members,
  defaultOpen = true,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const getMember = (id?: string) => members.find(m => m.id === id);
  if (items.length === 0) return null;

  return (
    <Box sx={{ bgcolor: tokens.colors.bgPaper, border: `1px solid ${tokens.colors.gray200}`, borderRadius: tokens.radius.lg, overflow: 'hidden', mb: 1.75 }}>
      <Box
        component="button"
        type="button"
        onClick={() => setOpen(o => !o)}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          p: '13px 16px',
          bgcolor: 'transparent',
          border: 'none',
          borderBottom: open ? `1px solid ${tokens.colors.gray100}` : 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <Box sx={{ width: 26, height: 26, borderRadius: tokens.radius.sm, bgcolor: tone.bg, color: tone.fg, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          {icon}
        </Box>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: tokens.colors.gray900, whiteSpace: 'nowrap' }}>{title}</Typography>
        <Box component="span" sx={{ fontSize: 12, fontWeight: 700, color: tone.fg, bgcolor: tone.bg, borderRadius: tokens.radius.pill, px: 1, py: '1px' }}>
          {items.length}
        </Box>
        <Box component="span" sx={{ ml: 'auto', color: tokens.colors.gray400, transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>▾</Box>
      </Box>
      {open && (
        <Box>
          {items.map(p => (
            <Box
              key={p.id}
              onClick={() => act.onOpen(p.id)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.75,
                px: 2,
                py: 1.5,
                cursor: 'pointer',
                borderBottom: `1px solid ${tokens.colors.gray50}`,
                '&:hover': { bgcolor: tokens.colors.gray50 },
              }}
            >
              <CompanyLogo name={getCompany(p)} size={40} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.colors.gray900 }}>{getName(p)}</Typography>
                  <CommercialStatusChip statut={p.statut} size="sm" />
                </Box>
                <Typography sx={{ fontSize: 12.5, color: tokens.colors.gray500, mt: 0.375, display: 'flex', alignItems: 'center', gap: 0.875, flexWrap: 'wrap' }}>
                  <Box component="span" sx={{ fontWeight: 500, color: tokens.colors.gray700 }}>{getCompany(p)}</Box>
                  {p.title && (
                    <>
                      <Box component="span" sx={{ color: tokens.colors.gray300 }}>·</Box>
                      <Box component="span">{p.title}</Box>
                    </>
                  )}
                  {p.notes && (
                    <>
                      <Box component="span" sx={{ color: tokens.colors.gray300 }}>·</Box>
                      <Box component="span" sx={{ fontStyle: 'italic', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notes}</Box>
                    </>
                  )}
                </Typography>
              </Box>
              <RelancePill date={p.dateRecontact} accent={accent} />
              <Box
                title={getMember(p.ownerId)?.displayName || 'Non assigné'}
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: tokens.radius.pill,
                  bgcolor: accent,
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <UserAvatarInitials user={getMember(p.ownerId)} fontSize="0.7rem" />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                {act.onCompose && (
                  <IconButton size="small" title="Envoyer un email" onClick={() => act.onCompose!(p)}>
                    <EmailIcon fontSize="small" />
                  </IconButton>
                )}
                {act.onLog && (
                  <IconButton size="small" title="Journaliser un appel" onClick={() => act.onLog!(p, 'call')}>
                    <PhoneIcon fontSize="small" />
                  </IconButton>
                )}
                <IconButton size="small" title="Reporter (+3 j)" onClick={() => act.onSnooze(p, 3)}>
                  <SnoozeIcon fontSize="small" />
                </IconButton>
                <Button size="small" variant="contained" onClick={() => act.onMarkDone(p)} sx={{ ml: 0.25, textTransform: 'none', bgcolor: accent, '&:hover': { bgcolor: tokens.colors.brandTeal700 } }}>
                  Fait
                </Button>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export interface CommercialTodayViewProps {
  prospects: CommercialProspect[];
  members: CommercialMember[];
  currentUserId?: string;
  currentUserName?: string;
  accent?: string;
  doneToday: number;
  objective?: number;
  act: CommercialViewActions;
  getName: (p: CommercialProspect) => string;
  getCompany: (p: CommercialProspect) => string;
}

export const CommercialTodayView: React.FC<CommercialTodayViewProps> = ({
  prospects,
  members,
  currentUserId,
  currentUserName = 'vous',
  accent = tokens.colors.brandTeal,
  doneToday,
  objective,
  act,
  getName,
  getCompany,
}) => {
  const [scope, setScope] = useState<'all' | 'me'>('all');

  const { late, today, week, stale, dueCount, target } = useMemo(() => {
    const scoped = prospects.filter(p => scope === 'all' || p.ownerId === currentUserId);
    const open = scoped.filter(p => p.statut !== 'abandon');
    const withRelance = open
      .filter(p => p.dateRecontact)
      .map(p => ({ p, st: relanceState(p.dateRecontact) }));
    const lateList = withRelance.filter(x => x.st.tone === 'late').sort((a, b) => a.st.days - b.st.days).map(x => x.p);
    const todayList = withRelance.filter(x => x.st.tone === 'today').map(x => x.p);
    const weekList = withRelance.filter(x => x.st.tone === 'soon').sort((a, b) => a.st.days - b.st.days).map(x => x.p);
    const staleList = scoped
      .map(p => ({ p, c: contactState(p.derniereInteraction || p.lastActivityAt, p.statut) }))
      .filter(x => x.c.stale)
      .sort((a, b) => b.c.days - a.c.days)
      .map(x => x.p);
    const due = lateList.length + todayList.length;
      const tgt = objective ?? ((due + doneToday) || 1);
    return { late: lateList, today: todayList, week: weekList, stale: staleList, dueCount: due, target: tgt };
  }, [prospects, scope, currentUserId, objective, doneToday]);

  const firstName = currentUserName.split(' ')[0];

  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 3, pt: 2.25, pb: 2, borderBottom: `1px solid ${tokens.colors.gray100}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontSize: 12, color: accent, fontWeight: 600, textTransform: 'capitalize' }}>
            {fmtDateLong(toIsoDate(new Date()))}
          </Typography>
          <Typography component="h2" sx={{ mt: 0.5, fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em', color: tokens.colors.gray900 }}>
            {greeting()}, {firstName} 👋
          </Typography>
          <Typography sx={{ mt: 0.75, fontSize: 13, color: tokens.colors.gray500 }}>
            {dueCount > 0 ? (
              <>
                <Box component="b" sx={{ color: tokens.colors.gray900 }}>{dueCount}</Box> relance{dueCount > 1 ? 's' : ''} à traiter aujourd&apos;hui
                {late.length > 0 && (
                  <>
                    {' '}· <Box component="b" sx={{ color: '#b91c1c' }}>{late.length} en retard</Box>
                  </>
                )}
              </>
            ) : (
              'Aucune relance en attente. Tout est à jour.'
            )}
          </Typography>
        </Box>
        <Box sx={{ display: 'inline-flex', bgcolor: tokens.colors.gray100, borderRadius: tokens.radius.sm, p: 0.375 }}>
          {([
            ['all', "Toute l'équipe"],
            ['me', 'Mes relances'],
          ] as const).map(([id, lab]) => (
            <Box
              key={id}
              component="button"
              type="button"
              onClick={() => setScope(id)}
              sx={{
                px: 1.5,
                py: 0.75,
                borderRadius: tokens.radius.xs,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12.5,
                fontWeight: scope === id ? 600 : 500,
                bgcolor: scope === id ? tokens.colors.bgPaper : 'transparent',
                color: scope === id ? tokens.colors.gray900 : tokens.colors.gray500,
                boxShadow: scope === id ? tokens.shadows.sm : 'none',
              }}
            >
              {lab}
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 3 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1fr) 312px' }, gap: 2.5, alignItems: 'start' }}>
          <Box>
            <Group title="En retard" icon={<AlertIcon sx={{ fontSize: 15 }} />} tone={{ bg: tokens.colors.errorLight, fg: '#b91c1c' }} items={late} accent={accent} act={act} getName={getName} getCompany={getCompany} members={members} />
            <Group title="À faire aujourd'hui" icon={<FlameIcon sx={{ fontSize: 15 }} />} tone={{ bg: tokens.colors.brandTeal100, fg: tokens.colors.brandTeal700 }} items={today} accent={accent} act={act} getName={getName} getCompany={getCompany} members={members} />
            <Group title="Cette semaine" icon={<ClockIcon sx={{ fontSize: 15 }} />} tone={{ bg: '#fff0db', fg: '#c2620a' }} items={week} accent={accent} act={act} getName={getName} getCompany={getCompany} members={members} defaultOpen={late.length + today.length < 5} />
            {late.length + today.length + week.length === 0 && (
              <CommercialEmptyState icon={<CheckIcon />} title="Inbox zéro 🎉" subtitle="Aucune relance programmée pour cette période." />
            )}
          </Box>

          <Box component="aside" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ bgcolor: tokens.colors.bgPaper, border: `1px solid ${tokens.colors.gray200}`, borderRadius: tokens.radius.lg, p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.colors.gray900, display: 'inline-flex', alignItems: 'center', gap: 0.875 }}>
                  <TargetIcon sx={{ fontSize: 15, color: accent }} />
                  Objectif du jour
                </Typography>
                <Typography sx={{ fontSize: 12, color: tokens.colors.gray400 }}>{doneToday}/{target}</Typography>
              </Box>
              <CommercialProgressBar value={doneToday} max={target} color={accent} />
              <Typography sx={{ fontSize: 12, color: tokens.colors.gray500, mt: 1.25 }}>
                {doneToday >= target && target > 0 ? (
                  <Box component="span" sx={{ color: tokens.colors.brandTeal700, fontWeight: 600 }}>Objectif atteint, bravo !</Box>
                ) : (
                  <>
                    Encore <Box component="b" sx={{ color: tokens.colors.gray900 }}>{Math.max(0, target - doneToday)}</Box> relance{Math.max(0, target - doneToday) > 1 ? 's' : ''} pour atteindre l&apos;objectif.
                  </>
                )}
              </Typography>
            </Box>

            <Box sx={{ bgcolor: tokens.colors.bgPaper, border: `1px solid ${tokens.colors.gray200}`, borderRadius: tokens.radius.lg, p: 2 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.75 }}>
                {[
                  { k: 'En retard', v: late.length, c: '#b91c1c', i: <AlertIcon sx={{ fontSize: 12, color: '#b91c1c' }} /> },
                  { k: "Aujourd'hui", v: today.length, c: tokens.colors.brandTeal700, i: <FlameIcon sx={{ fontSize: 12, color: tokens.colors.brandTeal700 }} /> },
                  { k: 'Cette semaine', v: week.length, c: '#c2620a', i: <ClockIcon sx={{ fontSize: 12, color: '#c2620a' }} /> },
                  { k: 'À recontacter', v: prospects.filter(p => p.statut === 'a_recontacter').length, c: accent, i: <ZapIcon sx={{ fontSize: 12, color: accent }} /> },
                ].map(s => (
                  <Box key={s.k}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 11, color: tokens.colors.gray400, fontWeight: 500 }}>
                      {s.i}
                      {s.k}
                    </Box>
                    <Typography sx={{ fontSize: 22, fontWeight: 700, color: tokens.colors.gray900, mt: 0.25, fontVariantNumeric: 'tabular-nums' }}>{s.v}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box sx={{ bgcolor: tokens.colors.bgPaper, border: `1px solid ${tokens.colors.gray200}`, borderRadius: tokens.radius.lg, overflow: 'hidden' }}>
              <Box sx={{ px: 2, py: 1.625, borderBottom: stale.length ? `1px solid ${tokens.colors.gray100}` : 'none', display: 'flex', alignItems: 'center', gap: 1 }}>
                <SnoozeIcon sx={{ fontSize: 15, color: tokens.colors.warning }} />
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.colors.gray900 }}>Sans nouvelles</Typography>
                <Typography sx={{ ml: 'auto', fontSize: 11, color: tokens.colors.gray400 }}>+21 j sans contact</Typography>
              </Box>
              {stale.length === 0 ? (
                <Typography sx={{ p: 2, fontSize: 12, color: tokens.colors.gray400, textAlign: 'center' }}>Aucun prospect oublié.</Typography>
              ) : (
                stale.slice(0, 5).map(p => {
                  const c = contactState(p.derniereInteraction || p.lastActivityAt, p.statut);
                  return (
                    <Box
                      key={p.id}
                      onClick={() => act.onOpen(p.id)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        px: 2,
                        py: 1.25,
                        cursor: 'pointer',
                        borderBottom: `1px solid ${tokens.colors.gray50}`,
                        '&:hover': { bgcolor: tokens.colors.gray50 },
                      }}
                    >
                      <CompanyLogo name={getCompany(p)} size={30} />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.colors.gray900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {getCompany(p)}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: c.veryStale ? '#b91c1c' : '#c2620a', fontWeight: 500 }}>
                          {c.days} j sans contact
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        title="Programmer une relance"
                        onClick={e => {
                          e.stopPropagation();
                          act.onScheduleRelance(p);
                        }}
                        sx={{ border: `1px solid ${tokens.colors.gray200}`, borderRadius: tokens.radius.xs, color: accent }}
                      >
                        <CalendarIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  );
                })
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
