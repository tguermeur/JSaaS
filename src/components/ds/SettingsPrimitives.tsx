import React from 'react';
import { Box, Typography } from '@mui/material';
import { tokens } from '../../theme/tokens';

interface SettingsPanelProps {
  title?: string;
  icon?: React.ReactNode;
  desc?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  pad?: number;
  dense?: boolean;
  sx?: React.ComponentProps<typeof Box>['sx'];
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  title,
  icon,
  desc,
  action,
  children,
  footer,
  pad = 2.25,
  dense = false,
  sx,
}) => (
  <Box
    component="section"
    sx={{
      bgcolor: tokens.colors.bgPaper,
      border: `1px solid ${tokens.colors.divider}`,
      borderRadius: tokens.radius.lg,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      ...sx,
    }}
  >
    {(title || action) && (
      <Box
        component="header"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: dense ? 1 : 1.75,
          px: dense ? 1.5 : 2.25,
          borderBottom: `1px solid ${tokens.colors.gray100}`,
          gap: dense ? 1 : 1.5,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: dense ? 1 : 1.25, minWidth: 0 }}>
          {icon && (
            <Box
              sx={{
                width: dense ? 24 : 28,
                height: dense ? 24 : 28,
                borderRadius: dense ? '6px' : '7px',
                bgcolor: tokens.colors.gray100,
                color: tokens.colors.gray500,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            {title && (
              <Typography sx={{ m: 0, fontSize: dense ? 13 : 14, fontWeight: 600, color: tokens.colors.gray900 }}>
                {title}
              </Typography>
            )}
            {desc && (
              <Typography sx={{ m: '2px 0 0', fontSize: 12, color: tokens.colors.gray400, lineHeight: 1.45 }}>
                {desc}
              </Typography>
            )}
          </Box>
        </Box>
        {action}
      </Box>
    )}
    <Box sx={{ p: pad, flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</Box>
    {footer && (
      <Box
        component="footer"
        sx={{
          py: 1.5,
          px: 2.25,
          borderTop: `1px solid ${tokens.colors.gray100}`,
          bgcolor: tokens.colors.surfaceAlt,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        {footer}
      </Box>
    )}
  </Box>
);

interface SettingsPanelRowProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
  last?: boolean;
}

export const SettingsPanelRow: React.FC<SettingsPanelRowProps> = ({ label, hint, children, last }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      py: 1.75,
      borderBottom: last ? 'none' : `1px solid ${tokens.colors.gray100}`,
    }}
  >
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography sx={{ fontSize: 13, color: tokens.colors.gray900, fontWeight: 500 }}>{label}</Typography>
      {hint && (
        <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, mt: 0.25, lineHeight: 1.45 }}>{hint}</Typography>
      )}
    </Box>
    <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1.25 }}>{children}</Box>
  </Box>
);

interface DsToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  accent?: string;
  disabled?: boolean;
}

export const DsToggle: React.FC<DsToggleProps> = ({
  checked,
  onChange,
  accent = tokens.colors.brandTeal,
  disabled,
}) => (
  <Box
    component="button"
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    sx={{
      width: 38,
      height: 22,
      borderRadius: tokens.radius.pill,
      border: 'none',
      p: '2px',
      bgcolor: checked ? accent : tokens.colors.gray300,
      opacity: disabled ? 0.45 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background 0.18s ease',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
    }}
  >
    <Box
      sx={{
        width: 18,
        height: 18,
        borderRadius: tokens.radius.pill,
        bgcolor: '#fff',
        boxShadow: tokens.shadows.xs,
        transform: checked ? 'translateX(16px)' : 'translateX(0)',
        transition: 'transform 0.18s ease',
      }}
    />
  </Box>
);

interface SegmentedOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps {
  value: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({ value, onChange, options }) => (
  <Box sx={{ display: 'inline-flex', p: '3px', bgcolor: tokens.colors.gray100, borderRadius: '9px', gap: '2px' }}>
    {options.map((o) => {
      const sel = o.value === value;
      return (
        <Box
          key={o.value}
          component="button"
          onClick={() => onChange(o.value)}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.625,
            py: 0.75,
            px: 1.5,
            borderRadius: '7px',
            border: 'none',
            bgcolor: sel ? tokens.colors.bgPaper : 'transparent',
            color: sel ? tokens.colors.gray900 : tokens.colors.gray500,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
            boxShadow: sel ? tokens.shadows.xs : 'none',
            transition: tokens.transitions.fast,
          }}
        >
          {o.icon}
          {o.label}
        </Box>
      );
    })}
  </Box>
);

interface DsPillProps {
  children: React.ReactNode;
  bg?: string;
  fg?: string;
  icon?: React.ReactNode;
}

export const DsPill: React.FC<DsPillProps> = ({
  children,
  bg = tokens.colors.gray100,
  fg = tokens.colors.gray700,
  icon,
}) => (
  <Box
    component="span"
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.5,
      py: '2px',
      px: 1.125,
      borderRadius: tokens.radius.pill,
      bgcolor: bg,
      color: fg,
      fontSize: 11,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}
  >
    {icon}
    {children}
  </Box>
);

export const settingsPageStyles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    bgcolor: tokens.colors.surfaceAlt,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    py: 2,
    px: 3,
    bgcolor: tokens.colors.bgPaper,
    borderBottom: `1px solid ${tokens.colors.divider}`,
    gap: 2,
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  eyebrow: { fontSize: 11, color: tokens.colors.gray500, fontWeight: 500, mb: 0.625 },
  title: { m: 0, fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em', color: tokens.colors.gray900 },
  sub: { m: '6px 0 0', fontSize: 13, color: tokens.colors.gray500, maxWidth: 560, lineHeight: 1.5 },
};
