import React from 'react';
import { Box, Typography } from '@mui/material';
import { tokens } from '../../theme/tokens';
import { PeriodSwitcher } from './DashboardPrimitives';

interface AppPageShellProps {
  eyebrow?: React.ReactNode;
  title: string;
  titleSuffix?: string;
  subtitle?: string;
  status?: { label: string; color?: string };
  actions?: React.ReactNode;
  period?: {
    value: string;
    onChange: (id: string) => void;
    options: { id: string; label: string }[];
  };
  comparePeriod?: { label: string; onClick?: () => void };
  kpiStrip?: React.ReactNode;
  children: React.ReactNode;
  stickyHeader?: boolean;
  fullBleed?: boolean;
  /** Quand "hidden", le contenu remplit la zone disponible sans scroll propre (split-view RH, etc.) */
  contentOverflow?: 'auto' | 'hidden';
  /** Nombre de colonnes de la bande KPI (défaut 5) */
  kpiColumns?: number;
}

export const AppPageShell: React.FC<AppPageShellProps> = ({
  eyebrow,
  title,
  titleSuffix,
  subtitle,
  status,
  actions,
  period,
  comparePeriod,
  kpiStrip,
  children,
  stickyHeader = true,
  fullBleed = true,
  contentOverflow = 'auto',
  kpiColumns = 5,
}) => (
  <Box sx={{ flex: 1, minHeight: 0, height: '100%', width: '100%', alignSelf: 'stretch', display: 'flex', flexDirection: 'column', overflow: 'hidden', ...(fullBleed ? { mx: -3, mt: -3, mb: -3 } : {}) }}>
    <Box
      component="header"
      sx={{
        bgcolor: tokens.colors.bgPaper,
        borderBottom: `1px solid ${tokens.colors.divider}`,
        px: 3,
        pt: kpiStrip ? 2 : 2.5,
        pb: 0,
        position: stickyHeader ? 'sticky' : 'relative',
        top: 0,
        zIndex: 2,
        flexShrink: 0,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: subtitle ? 0.5 : (kpiStrip ? 1 : 1.75), gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0 }}>
          {(eyebrow || status) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.5, flexWrap: 'wrap' }}>
              {eyebrow && (
                typeof eyebrow === 'string' ? (
                  <Typography sx={{ fontSize: 11, color: tokens.colors.gray500, fontWeight: 500, letterSpacing: '0.02em' }}>
                    {eyebrow}
                  </Typography>
                ) : (
                  eyebrow
                )
              )}
              {eyebrow && status && <Box sx={{ width: 1, height: 11, bgcolor: tokens.colors.gray200 }} />}
              {status && (
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.625 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: tokens.radius.pill, bgcolor: status.color || tokens.colors.success, boxShadow: `0 0 0 3px ${status.color || tokens.colors.success}33` }} />
                  <Typography sx={{ fontSize: 11, color: status.color || tokens.colors.success, fontWeight: 600 }}>{status.label}</Typography>
                </Box>
              )}
            </Box>
          )}
          <Typography component="h1" sx={{ m: 0, fontSize: tokens.typography.pageTitle.fontSize, fontWeight: tokens.typography.pageTitle.fontWeight, letterSpacing: tokens.typography.pageTitle.letterSpacing, color: tokens.colors.gray900 }}>
            {title}
            {titleSuffix && (
              <Box component="span" sx={{ color: tokens.colors.gray400, fontWeight: 400, ml: 0.75 }}>· {titleSuffix}</Box>
            )}
          </Typography>
          {subtitle && <Typography sx={{ fontSize: 13, color: tokens.colors.gray500, mt: 0.5 }}>{subtitle}</Typography>}
        </Box>
        {actions && <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, mb: subtitle ? 1 : 0 }}>{actions}</Box>}
      </Box>
      {(period || comparePeriod) && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, pb: kpiStrip ? 1.5 : 1.75, flexWrap: 'wrap' }}>
          {period && <PeriodSwitcher value={period.value} onChange={period.onChange} options={period.options} />}
          {comparePeriod && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 11, color: tokens.colors.gray500 }}>
              <Typography sx={{ fontSize: 11 }}>Comparé à</Typography>
              <Box component="button" onClick={comparePeriod.onClick} sx={{ border: `1px solid ${tokens.colors.gray200}`, bgcolor: tokens.colors.bgPaper, borderRadius: tokens.radius.md, px: 1.25, py: 0.5, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', color: tokens.colors.gray700 }}>
                {comparePeriod.label}
              </Box>
            </Box>
          )}
        </Box>
      )}
      {kpiStrip && (
        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${kpiColumns}, 1fr)`, mx: -3, borderTop: `1px solid ${tokens.colors.divider}`, bgcolor: tokens.colors.bgPaper }}>
          {kpiStrip}
        </Box>
      )}
    </Box>
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: contentOverflow,
        ...(contentOverflow === 'hidden'
          ? { display: 'flex', flexDirection: 'column' }
          : {}),
        bgcolor: tokens.colors.surfaceAlt,
      }}
    >
      {children}
    </Box>
  </Box>
);
