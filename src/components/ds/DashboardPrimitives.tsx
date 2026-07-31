import React from 'react';
import { Box, Typography } from '@mui/material';
import { tokens } from '../../theme/tokens';

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  area?: boolean;
  color?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  values,
  width = 120,
  height = 32,
  area = true,
  color = tokens.colors.brandTeal,
}) => {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rng = max - min || 1;
  const stepX = width / (values.length - 1);
  const pts = values.map((v, i) => [
    i * stepX,
    height - ((v - min) / rng) * (height - 4) - 2,
  ]);
  const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {area && (
        <path d={`${d} L${width},${height} L0,${height} Z`} fill={color} fillOpacity={0.1} />
      )}
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.slice(-1).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill={color} />
      ))}
    </svg>
  );
};

interface DeltaChipProps {
  value: number | null;
  suffix?: string;
  good?: 'up' | 'down';
}

export const DeltaChip: React.FC<DeltaChipProps> = ({ value, suffix = '', good = 'up' }) => {
  if (value == null) return null;
  const positive = value > 0;
  const isGood = good === 'up' ? positive : !positive;
  const color = isGood ? tokens.colors.success : tokens.colors.error;
  const arrow = positive ? '↑' : value < 0 ? '↓' : '·';

  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, color, fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
      <Box component="span" sx={{ fontSize: 10 }}>{arrow}</Box>
      {Math.abs(value)}{suffix}
    </Box>
  );
};

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number | null;
  deltaSuffix?: string;
  spark?: number[];
  sparkColor?: string;
  density?: 'comfortable' | 'compact';
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  unit,
  delta,
  deltaSuffix = '%',
  spark,
  sparkColor,
  density = 'comfortable',
}) => {
  const padY = density === 'compact' ? 1 : 2;
  const gapY = density === 'compact' ? 0.25 : 0.75;

  return (
    <Box
      sx={{
        py: padY,
        px: 2.25,
        display: 'flex',
        flexDirection: 'column',
        gap: gapY,
        borderRight: `1px solid ${tokens.colors.divider}`,
        minWidth: 0,
      }}
    >
      <Typography sx={{ fontSize: 11, color: tokens.colors.gray500, fontWeight: 500, letterSpacing: '0.02em' }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
        <Typography
          sx={{
            fontSize: density === 'compact' ? 18 : 26,
            fontWeight: 600,
            color: tokens.colors.gray900,
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </Typography>
        {unit && (
          <Typography sx={{ fontSize: 12, color: tokens.colors.gray500, fontWeight: 500 }}>{unit}</Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 0.25 }}>
        <DeltaChip value={delta ?? null} suffix={deltaSuffix} />
        {spark && <Sparkline values={spark} width={84} height={22} color={sparkColor} />}
      </Box>
    </Box>
  );
};

interface PeriodOption {
  id: string;
  label: string;
}

interface PeriodSwitcherProps {
  value: string;
  onChange: (id: string) => void;
  options: PeriodOption[];
}

export const PeriodSwitcher: React.FC<PeriodSwitcherProps> = ({ value, onChange, options }) => (
  <Box
    sx={{
      display: 'flex',
      gap: 0,
      bgcolor: tokens.colors.gray50,
      borderRadius: tokens.radius.pill,
      p: '3px',
      border: `1px solid ${tokens.colors.divider}`,
    }}
  >
    {options.map((p) => (
      <Box
        key={p.id}
        component="button"
        onClick={() => onChange(p.id)}
        sx={{
          py: '5px',
          px: 1.75,
          borderRadius: tokens.radius.pill,
          border: 'none',
          fontFamily: 'inherit',
          bgcolor: value === p.id ? tokens.colors.bgPaper : 'transparent',
          color: value === p.id ? tokens.colors.gray900 : tokens.colors.gray500,
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
          boxShadow: value === p.id ? tokens.shadows.xs : 'none',
          transition: tokens.transitions.fast,
          whiteSpace: 'nowrap',
        }}
      >
        {p.label}
      </Box>
    ))}
  </Box>
);

interface SectionHeadProps {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}

export const SectionHead: React.FC<SectionHeadProps> = ({ title, hint, action }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      py: '14px',
      px: 2.5,
      borderBottom: `1px solid ${tokens.colors.gray100}`,
      gap: 1.5,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, minWidth: 0 }}>
      <Typography sx={{ m: 0, fontSize: 13, fontWeight: 600, color: tokens.colors.gray900, whiteSpace: 'nowrap' }}>
        {title}
      </Typography>
      {hint && (
        <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {hint}
        </Typography>
      )}
    </Box>
    {action}
  </Box>
);

interface FunnelStage {
  label: string;
  value: number;
}

export const PipelineFunnel: React.FC<{ stages: FunnelStage[]; accent?: string }> = ({
  stages,
  accent = tokens.colors.brandTeal,
}) => {
  const max = Math.max(...stages.map((s) => s.value));
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: '4px 0' }}>
      {stages.map((s, i) => {
        const pct = (s.value / max) * 100;
        const conv = i > 0 ? Math.round((s.value / stages[i - 1].value) * 100) : null;
        return (
          <Box
            key={s.label}
            component="li"
            sx={{
              display: 'grid',
              gridTemplateColumns: '128px 1fr 64px 48px',
              alignItems: 'center',
              gap: 1.5,
              py: 1,
              px: 2.5,
              borderTop: i ? `1px solid ${tokens.colors.gray50}` : 'none',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box
                sx={{
                  width: 18,
                  height: 18,
                  borderRadius: tokens.radius.xs,
                  bgcolor: tokens.colors.gray100,
                  color: tokens.colors.gray500,
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {i + 1}
              </Box>
              <Typography sx={{ fontSize: 12, color: tokens.colors.gray700, fontWeight: 500, whiteSpace: 'nowrap' }}>
                {s.label}
              </Typography>
            </Box>
            <Box sx={{ height: 8, bgcolor: tokens.colors.gray100, borderRadius: tokens.radius.pill, overflow: 'hidden' }}>
              <Box
                sx={{
                  width: `${pct}%`,
                  height: '100%',
                  bgcolor: i === stages.length - 1 ? accent : tokens.colors.brandNavy,
                  opacity: i === stages.length - 1 ? 1 : 0.45 + (i / stages.length) * 0.4,
                  borderRadius: tokens.radius.pill,
                  transition: 'width 0.6s ease',
                }}
              />
            </Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.colors.gray900, textAlign: 'right' }}>
              {s.value}
            </Typography>
            {conv != null ? (
              <Typography sx={{ fontSize: 11, color: conv >= 50 ? tokens.colors.success : tokens.colors.gray400, textAlign: 'right', fontWeight: 600 }}>
                {conv}%
              </Typography>
            ) : (
              <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, textAlign: 'right' }}>—</Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

export type WeekEventType = 'client' | 'deadline' | 'internal' | 'livrable' | 'formation';

const EVENT_BG: Record<string, string> = {
  client: '#ecfdf5', deadline: '#fef3c7', internal: '#eef2ff', livrable: '#fce7f3', formation: '#f3f4f6',
};
const EVENT_FG: Record<string, string> = {
  client: '#065f46', deadline: '#92400e', internal: '#3730a3', livrable: '#9d174d', formation: '#374151',
};
const EVENT_BAR: Record<string, string> = {
  client: '#10b981', deadline: '#f59e0b', internal: '#6366f1', livrable: '#ec4899', formation: '#6b7280',
};

export interface WeekCalendarDay {
  dow: string;
  day: number;
  today?: boolean;
  events: { time: string; title: string; type?: WeekEventType }[];
}

export const WeekCalendar: React.FC<{ days: WeekCalendarDay[]; accent?: string }> = ({
  days,
  accent = tokens.colors.brandTeal,
}) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', bgcolor: tokens.colors.divider, p: '1px', borderTop: `1px solid ${tokens.colors.gray100}` }}>
    {days.map((d, i) => (
      <Box key={i} sx={{ bgcolor: d.today ? tokens.colors.surfaceAlt : tokens.colors.bgPaper, p: '10px 10px 14px', minHeight: 138, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          <Typography sx={{ fontSize: 10, color: tokens.colors.gray400, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>{d.dow}</Typography>
          <Box component="span" sx={{ fontSize: 15, fontWeight: d.today ? 700 : 500, color: d.today ? '#fff' : tokens.colors.gray900, bgcolor: d.today ? accent : 'transparent', minWidth: 22, height: 22, borderRadius: tokens.radius.pill, display: 'inline-grid', placeItems: 'center', px: d.today ? 0.75 : 0, fontVariantNumeric: 'tabular-nums' }}>{d.day}</Box>
        </Box>
        {d.events.length === 0 && <Typography sx={{ fontSize: 11, color: tokens.colors.gray300, fontStyle: 'italic', mt: 0.5 }}>—</Typography>}
        {d.events.map((e, j) => (
          <Box key={j} sx={{ p: '5px 7px', borderRadius: '5px', bgcolor: EVENT_BG[e.type || 'formation'], color: EVENT_FG[e.type || 'formation'], fontSize: 10.5, lineHeight: 1.35, borderLeft: `2px solid ${EVENT_BAR[e.type || 'formation']}` }}>
            <Typography sx={{ fontWeight: 600, fontSize: 'inherit' }}>{e.time}</Typography>
            <Typography sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'inherit' }}>{e.title}</Typography>
          </Box>
        ))}
      </Box>
    ))}
  </Box>
);

export const Heatmap: React.FC<{ matrix: number[][]; dayLabels: string[]; slotLabels: string[]; accent?: string }> = ({
  matrix, dayLabels, slotLabels, accent = tokens.colors.brandTeal,
}) => {
  const max = Math.max(...matrix.flat(), 1);
  return (
    <Box sx={{ py: 1.75, px: 2.5 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: `40px repeat(${dayLabels.length}, 1fr)`, gap: 0.5 }}>
        <Box />
        {dayLabels.map((d) => (
          <Typography key={d} sx={{ fontSize: 10, color: tokens.colors.gray400, textAlign: 'center', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>{d}</Typography>
        ))}
        {slotLabels.map((slot, i) => (
          <React.Fragment key={slot}>
            <Typography sx={{ fontSize: 10, color: tokens.colors.gray400, textAlign: 'right', alignSelf: 'center', fontVariantNumeric: 'tabular-nums' }}>{slot}</Typography>
            {matrix[i]?.map((v, j) => {
              const intensity = max ? v / max : 0;
              return (
                <Box key={j} title={`${dayLabels[j]} ${slot} — ${v}`} sx={{ height: 22, borderRadius: tokens.radius.xs, bgcolor: intensity === 0 ? tokens.colors.gray50 : accent, opacity: intensity === 0 ? 1 : 0.12 + intensity * 0.85 }} />
              );
            })}
          </React.Fragment>
        ))}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.75, justifyContent: 'flex-end' }}>
        <Typography sx={{ fontSize: 10, color: tokens.colors.gray400 }}>moins</Typography>
        {[0.12, 0.3, 0.5, 0.75, 1].map((o) => (
          <Box key={o} sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: accent, opacity: o }} />
        ))}
        <Typography sx={{ fontSize: 10, color: tokens.colors.gray400 }}>plus</Typography>
      </Box>
    </Box>
  );
};

export const ProgressBar: React.FC<{ pct: number; color?: string }> = ({ pct, color = tokens.colors.brandTeal }) => (
  <Box sx={{ position: 'relative', height: 4, bgcolor: tokens.colors.gray100, borderRadius: tokens.radius.pill, overflow: 'hidden' }}>
    <Box sx={{ position: 'absolute', inset: 0, width: `${Math.min(100, Math.max(0, pct))}%`, bgcolor: color, borderRadius: tokens.radius.pill, transition: 'width 0.5s ease' }} />
  </Box>
);

export const DashboardPanel: React.FC<{ children: React.ReactNode; sx?: object }> = ({ children, sx }) => (
  <Box sx={{ bgcolor: tokens.colors.bgPaper, border: `1px solid ${tokens.colors.divider}`, borderRadius: tokens.radius.lg, overflow: 'hidden', ...sx }}>{children}</Box>
);
