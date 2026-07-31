import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { tokens } from '../../theme/tokens';
import { DsToggle } from './SettingsPrimitives';

const PAY_COLORS: Record<string, { bg: string; fg: string }> = {
  'Payé': { bg: tokens.colors.successLight, fg: '#065f46' },
  'Programmé': { bg: '#dbeafe', fg: '#1e40af' },
  'En attente': { bg: tokens.colors.warningLight, fg: '#92400e' },
  'À facturer': { bg: tokens.colors.gray100, fg: tokens.colors.gray700 },
};

export const SSPanel: React.FC<{
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  dense?: boolean;
}> = ({ title, icon, action, children, defaultOpen = true, dense }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box sx={{ bgcolor: tokens.colors.bgPaper, border: `1px solid ${tokens.colors.divider}`, borderRadius: tokens.radius.lg, overflow: 'hidden', mb: 2 }}>
      <Box onClick={() => setOpen((o) => !o)} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, px: 2, borderBottom: open ? `1px solid ${tokens.colors.gray100}` : 'none', cursor: 'pointer' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ExpandMoreIcon sx={{ fontSize: 14, color: tokens.colors.gray400, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
          {icon}
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.colors.gray900 }}>{title}</Typography>
        </Box>
        <Box onClick={(e) => e.stopPropagation()}>{action}</Box>
      </Box>
      {open && <Box sx={{ p: dense ? '14px 16px' : 2.5 }}>{children}</Box>}
    </Box>
  );
};

export const SSKpi: React.FC<{ label: string; value: string | number; hint?: string; icon?: React.ReactNode; accent?: boolean }> = ({
  label, value, hint, icon, accent,
}) => (
  <Box sx={{ p: 2, border: `1px solid ${accent ? tokens.colors.brandTeal : tokens.colors.divider}`, borderRadius: tokens.radius.lg, bgcolor: accent ? `${tokens.colors.brandTeal}08` : tokens.colors.bgPaper }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
      <Typography sx={{ fontSize: 11, color: tokens.colors.gray500, fontWeight: 500 }}>{label}</Typography>
      {icon}
    </Box>
    <Typography sx={{ fontSize: 22, fontWeight: 600, color: tokens.colors.gray900, letterSpacing: '-0.01em' }}>{value}</Typography>
    {hint && <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, mt: 0.5 }}>{hint}</Typography>}
  </Box>
);

export const SSPill: React.FC<{ label: string; variant?: keyof typeof PAY_COLORS }> = ({ label, variant }) => {
  const c = (variant && PAY_COLORS[variant]) || PAY_COLORS[label] || { bg: tokens.colors.gray100, fg: tokens.colors.gray700 };
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 11, px: 1.125, py: '3px', borderRadius: tokens.radius.pill, fontWeight: 600, bgcolor: c.bg, color: c.fg, whiteSpace: 'nowrap' }}>
      {label}
    </Box>
  );
};

export const SSCard: React.FC<{
  title: string;
  client: string;
  matchPct?: number;
  status?: string;
  tags?: string[];
  onClick?: () => void;
  action?: React.ReactNode;
}> = ({ title, client, matchPct, status, tags, onClick, action }) => (
  <Box onClick={onClick} sx={{ p: 2, border: `1px solid ${tokens.colors.divider}`, borderRadius: tokens.radius.lg, bgcolor: tokens.colors.bgPaper, cursor: onClick ? 'pointer' : 'default', transition: tokens.transitions.fast, '&:hover': onClick ? { borderColor: tokens.colors.gray300, boxShadow: tokens.shadows.sm } : {} }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.colors.gray900, mb: 0.25 }}>{title}</Typography>
        <Typography sx={{ fontSize: 12, color: tokens.colors.gray500 }}>{client}</Typography>
      </Box>
      {matchPct != null && (
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.colors.brandTeal, flexShrink: 0 }}>{matchPct}% match</Typography>
      )}
    </Box>
    {status && <Box sx={{ mb: 1 }}><SSPill label={status} /></Box>}
    {tags && tags.length > 0 && (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
        {tags.map((t) => (
          <Typography key={t} sx={{ fontSize: 10, px: 0.75, py: '2px', bgcolor: tokens.colors.gray100, borderRadius: tokens.radius.xs, color: tokens.colors.gray600 }}>{t}</Typography>
        ))}
      </Box>
    )}
    {action}
  </Box>
);

export const FilterChipGroup: React.FC<{
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  /** Disposition compacte (label + chips sur une ligne) */
  dense?: boolean;
}> = ({ label, options, value, onChange, dense }) => (
  <Box
    sx={{
      mb: dense ? 0.75 : 1.5,
      display: dense ? 'flex' : 'block',
      alignItems: dense ? 'center' : undefined,
      gap: dense ? 1 : undefined,
      flexWrap: dense ? 'wrap' : undefined,
      '&:last-of-type': { mb: 0 },
    }}
  >
    <Typography
      sx={{
        fontSize: dense ? 10 : 11,
        fontWeight: 600,
        color: tokens.colors.gray500,
        mb: dense ? 0 : 0.75,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        flexShrink: 0,
        minWidth: dense ? 52 : undefined,
      }}
    >
      {label}
    </Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: dense ? 0.5 : 0.75, flex: dense ? 1 : undefined, minWidth: 0 }}>
      {options.map((opt) => {
        const sel = value.includes(opt);
        return (
          <Box
            key={opt}
            component="button"
            onClick={() => onChange(sel ? value.filter((v) => v !== opt) : [...value, opt])}
            sx={{
              border: `1px solid ${sel ? tokens.colors.brandTeal : tokens.colors.gray200}`,
              bgcolor: sel ? `${tokens.colors.brandTeal}14` : tokens.colors.bgPaper,
              color: sel ? tokens.colors.brandTeal700 : tokens.colors.gray600,
              fontSize: dense ? 11 : 12,
              fontWeight: 500,
              px: dense ? 1 : 1.25,
              py: dense ? '2px' : 0.5,
              borderRadius: tokens.radius.pill,
              cursor: 'pointer',
              fontFamily: 'inherit',
              lineHeight: 1.35,
            }}
          >
            {opt}
          </Box>
        );
      })}
    </Box>
  </Box>
);

export const SSToggle = DsToggle;
