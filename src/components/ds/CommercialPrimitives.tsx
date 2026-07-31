import React from 'react';
import { Box, Typography } from '@mui/material';
import { tokens } from '../../theme/tokens';
import { relanceState, type RelanceState } from '../../utils/commercialRelance';

export type RelanceTone = 'late' | 'today' | 'soon' | 'planned' | 'none';

const RELANCE_TONE: Record<RelanceTone, { bg: string; fg: string; dot: string }> = {
  late: { bg: tokens.colors.errorLight, fg: '#b91c1c', dot: tokens.colors.error },
  today: { bg: tokens.colors.brandTeal100, fg: tokens.colors.brandTeal700, dot: tokens.colors.brandTeal },
  soon: { bg: '#fff0db', fg: '#c2620a', dot: tokens.colors.warning },
  planned: { bg: '#eef2ff', fg: '#4338ca', dot: '#6366f1' },
  none: { bg: tokens.colors.gray50, fg: tokens.colors.gray400, dot: tokens.colors.gray300 },
};

interface RelancePillProps {
  label?: string;
  tone?: RelanceTone;
  date?: string;
  state?: RelanceState;
  accent?: string;
  size?: 'sm' | 'md';
}

export const RelancePill: React.FC<RelancePillProps> = ({
  label,
  tone,
  date,
  state,
  accent = tokens.colors.brandTeal,
  size = 'md',
}) => {
  const computed = state ?? (date ? relanceState(date) : null);
  const resolvedTone = tone ?? computed?.tone ?? 'none';
  const resolvedLabel = label ?? computed?.label ?? 'Programmer';
  const t = RELANCE_TONE[resolvedTone];
  const isToday = resolvedTone === 'today';
  const bg = isToday ? `${accent}1f` : t.bg;
  const fg = isToday ? accent : t.fg;
  const dashed = resolvedTone === 'none';
  const pad = size === 'sm' ? '2px 8px' : '4px 10px';
  const fs = size === 'sm' ? 11 : 12;

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        p: pad,
        borderRadius: tokens.radius.pill,
        bgcolor: dashed ? 'transparent' : bg,
        color: fg,
        border: dashed ? `1px dashed ${tokens.colors.gray300}` : '1px solid transparent',
        fontSize: fs,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
      }}
    >
      {resolvedLabel}
    </Box>
  );
};

interface ScoreDotProps {
  score: number;
  max?: number;
  showValue?: boolean;
}

export const ScoreDot: React.FC<ScoreDotProps> = ({ score, max = 100, showValue = true }) => {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  const color = pct >= 70 ? tokens.colors.success : pct >= 40 ? tokens.colors.warning : tokens.colors.error;
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: tokens.radius.pill,
          bgcolor: color,
          boxShadow: `0 0 0 3px ${color}33`,
        }}
      />
      {showValue && (
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.colors.gray900, fontVariantNumeric: 'tabular-nums' }}>
          {score}
        </Typography>
      )}
    </Box>
  );
};

interface EngagementMeterProps {
  value?: number;
  max?: number;
  accent?: string;
  compact?: boolean;
  opens?: number;
  clicks?: number;
  replies?: number;
}

export const EngagementMeter: React.FC<EngagementMeterProps> = ({
  value,
  max = 100,
  accent = tokens.colors.brandTeal,
  compact = false,
  opens = 0,
  clicks = 0,
  replies = 0,
}) => {
  if (compact) {
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 11, color: tokens.colors.gray500 }}>
        <Typography component="span" sx={{ fontSize: 'inherit' }}>👁 {opens}</Typography>
        <Typography component="span" sx={{ fontSize: 'inherit' }}>🔗 {clicks}</Typography>
        <Typography component="span" sx={{ fontSize: 'inherit', color: replies ? accent : 'inherit' }}>💬 {replies}</Typography>
      </Box>
    );
  }
  const pct = Math.min(100, Math.max(0, ((value ?? 0) / max) * 100));
  return (
    <Box sx={{ position: 'relative', height: 4, bgcolor: tokens.colors.gray100, borderRadius: tokens.radius.pill, overflow: 'hidden', minWidth: 72 }}>
      <Box sx={{ position: 'absolute', inset: 0, width: `${pct}%`, bgcolor: accent, borderRadius: tokens.radius.pill, transition: 'width 0.5s ease' }} />
    </Box>
  );
};

const PROSPECT_STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'error' | 'info' | 'neutral' }> = {
  non_qualifie: { label: 'Non qualifié', tone: 'neutral' },
  contacte: { label: 'Contacté', tone: 'info' },
  a_recontacter: { label: 'À recontacter', tone: 'warning' },
  negociation: { label: 'Négociation', tone: 'info' },
  abandon: { label: 'Abandon', tone: 'error' },
  deja_client: { label: 'Client', tone: 'success' },
};

export const CommercialStatusChip: React.FC<{
  label?: string;
  statut?: string;
  tone?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'sm' | 'md';
}> = ({ label, statut, tone, size = 'md' }) => {
  const mapped = statut ? PROSPECT_STATUS[statut] : undefined;
  const resolvedLabel = label ?? mapped?.label ?? statut ?? '';
  const resolvedTone = tone ?? mapped?.tone ?? 'neutral';
  const tones = {
    success: { bg: tokens.colors.successLight, fg: '#065f46' },
    warning: { bg: tokens.colors.warningLight, fg: '#92400e' },
    error: { bg: tokens.colors.errorLight, fg: '#991b1b' },
    info: { bg: '#dbeafe', fg: '#1e40af' },
    neutral: { bg: tokens.colors.gray100, fg: tokens.colors.gray700 },
  };
  const c = tones[resolvedTone];
  const fs = size === 'sm' ? 11 : 12;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: fs,
        fontWeight: 600,
        px: 1,
        py: '2px',
        borderRadius: tokens.radius.pill,
        bgcolor: c.bg,
        color: c.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {resolvedLabel}
    </Box>
  );
};

export const SequenceBadge: React.FC<{ step: number; total: number; label?: string }> = ({ step, total, label }) => (
  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 11, fontWeight: 600, color: tokens.colors.gray600 }}>
    <Box sx={{ width: 18, height: 18, borderRadius: tokens.radius.xs, bgcolor: tokens.colors.brandTeal, color: '#fff', fontSize: 10, display: 'grid', placeItems: 'center' }}>{step}</Box>
    <Typography sx={{ fontSize: 'inherit' }}>/ {total}</Typography>
    {label && <Typography sx={{ fontSize: 'inherit', color: tokens.colors.gray400, ml: 0.5 }}>{label}</Typography>}
  </Box>
);

export const CompanyLogo: React.FC<{ name: string; size?: number; color?: string }> = ({ name, size = 32, color = tokens.colors.brandNavy }) => (
  <Box sx={{ width: size, height: size, borderRadius: tokens.radius.md, bgcolor: color, color: '#fff', fontSize: size * 0.35, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
    {(name || '?').slice(0, 2).toUpperCase()}
  </Box>
);

export const ScoreGauge: React.FC<{ score: number; max?: number; size?: number }> = ({ score, max = 100, size = 36 }) => {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  const color = pct >= 70 ? tokens.colors.success : pct >= 40 ? tokens.colors.warning : tokens.colors.error;
  return (
    <Box sx={{ position: 'relative', width: size, height: size, borderRadius: tokens.radius.pill, border: `3px solid ${tokens.colors.gray100}`, display: 'grid', placeItems: 'center' }}>
      <Box sx={{ position: 'absolute', inset: -3, borderRadius: tokens.radius.pill, border: `3px solid ${color}`, clipPath: `polygon(0 0, ${pct}% 0, ${pct}% 100%, 0 100%)` }} />
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: tokens.colors.gray900, position: 'relative' }}>{score}</Typography>
    </Box>
  );
};

export const MemberAvatar: React.FC<{ name: string; size?: number; color?: string }> = ({ name, size = 28, color }) => {
  const bg = color ?? tokens.colors.brandTeal;
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
  return (
    <Box
      title={name}
      sx={{
        width: size,
        height: size,
        borderRadius: tokens.radius.pill,
        bgcolor: bg,
        color: '#fff',
        fontSize: Math.max(9, Math.round(size * 0.36)),
        fontWeight: 700,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      {initials || '?'}
    </Box>
  );
};

export const CommercialProgressBar: React.FC<{ value: number; max?: number; color?: string; height?: number }> = ({
  value,
  max = 100,
  color = tokens.colors.brandTeal,
  height = 8,
}) => (
  <Box sx={{ height, bgcolor: tokens.colors.gray100, borderRadius: tokens.radius.pill, overflow: 'hidden', width: '100%' }}>
    <Box sx={{ width: `${Math.min(100, (value / max) * 100)}%`, height: '100%', bgcolor: color, borderRadius: tokens.radius.pill, transition: 'width 0.4s ease' }} />
  </Box>
);

export const CommercialEmptyState: React.FC<{ icon?: React.ReactNode; title: string; subtitle?: string }> = ({
  icon,
  title,
  subtitle,
}) => (
  <Box sx={{ p: 6, textAlign: 'center', border: `1px dashed ${tokens.colors.gray200}`, borderRadius: tokens.radius.lg }}>
    {icon && (
      <Box sx={{ width: 48, height: 48, borderRadius: tokens.radius.md, bgcolor: tokens.colors.gray100, color: tokens.colors.gray400, display: 'grid', placeItems: 'center', mx: 'auto', mb: 1.5 }}>
        {icon}
      </Box>
    )}
    <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.colors.gray700 }}>{title}</Typography>
    {subtitle && <Typography sx={{ fontSize: 13, color: tokens.colors.gray400, mt: 0.5 }}>{subtitle}</Typography>}
  </Box>
);

export interface CommercialViewTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

export const CommercialViewTabs: React.FC<{
  tabs: CommercialViewTab[];
  active: string;
  onChange: (id: string) => void;
  accent?: string;
  /** Répartit les onglets sur toute la largeur */
  fullWidth?: boolean;
}> = ({ tabs, active, onChange, accent = tokens.colors.brandTeal, fullWidth = false }) => (
  <Box
    role="tablist"
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 0.25,
      bgcolor: tokens.colors.gray100,
      borderRadius: tokens.radius.md,
      p: 0.375,
      width: fullWidth ? '100%' : 'inline-flex',
      maxWidth: '100%',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      '&::-webkit-scrollbar': { display: 'none' },
    }}
  >
    {tabs.map((t) => {
      const on = t.id === active;
      return (
        <Box
          key={t.id}
          component="button"
          type="button"
          role="tab"
          aria-selected={on}
          onClick={() => onChange(t.id)}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.875,
            px: 1.625,
            py: 0.875,
            borderRadius: tokens.radius.sm,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: on ? 600 : 500,
            bgcolor: on ? tokens.colors.bgPaper : 'transparent',
            color: on ? tokens.colors.gray900 : tokens.colors.gray500,
            boxShadow: on ? tokens.shadows.sm : 'none',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
            flex: fullWidth ? 1 : undefined,
            minWidth: fullWidth ? 0 : undefined,
            '&:hover': {
              color: on ? tokens.colors.gray900 : tokens.colors.gray700,
              bgcolor: on ? tokens.colors.bgPaper : `${tokens.colors.gray200}88`,
            },
            '& svg': { fontSize: 16, flexShrink: 0, opacity: on ? 1 : 0.72 },
          }}
        >
          {t.icon}
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t.label}
          </Box>
          {t.count != null && (
            <Box
              component="span"
              sx={{
                fontSize: 11,
                fontWeight: 700,
                color: on ? accent : tokens.colors.gray500,
                bgcolor: on ? `${accent}14` : tokens.colors.gray200,
                borderRadius: tokens.radius.pill,
                px: 0.75,
                py: '1px',
                minWidth: 18,
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
              }}
            >
              {t.count}
            </Box>
          )}
        </Box>
      );
    })}
  </Box>
);
