import React from 'react';
import { Box, Typography } from '@mui/material';
import { tokens } from '../../theme/tokens';
import { DsToggle } from './SettingsPrimitives';
import UserNameText from '../common/UserNameText';
import UserAvatarInitials from '../common/UserAvatarInitials';

export const DetailPanel: React.FC<{ title?: string; action?: React.ReactNode; children: React.ReactNode }> = ({
  title, action, children,
}) => (
  <Box sx={{ bgcolor: tokens.colors.bgPaper, border: `1px solid ${tokens.colors.divider}`, borderRadius: tokens.radius.lg, overflow: 'hidden', mb: 2 }}>
    {(title || action) && (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.75, px: 2.25, borderBottom: `1px solid ${tokens.colors.gray100}` }}>
        {title && <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.colors.gray900 }}>{title}</Typography>}
        {action}
      </Box>
    )}
    <Box sx={{ p: 2.25 }}>{children}</Box>
  </Box>
);

export const FieldRow: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' }, gap: 1.5, py: 1.25, borderBottom: `1px solid ${tokens.colors.gray100}`, '&:last-child': { borderBottom: 'none' } }}>
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 500, color: tokens.colors.gray700 }}>{label}</Typography>
      {hint && <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, mt: 0.25 }}>{hint}</Typography>}
    </Box>
    <Box>{children}</Box>
  </Box>
);

export const SidebarBlock: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({
  title, children, action,
}) => (
  <Box sx={{ mb: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: tokens.colors.gray500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</Typography>
      {action}
    </Box>
    <Box sx={{ bgcolor: tokens.colors.bgPaper, border: `1px solid ${tokens.colors.divider}`, borderRadius: tokens.radius.lg, p: 1.75 }}>{children}</Box>
  </Box>
);

export const DetailKpiCard: React.FC<{ label: string; value: string | number; hint?: string }> = ({ label, value, hint }) => (
  <Box sx={{ p: 1.75, border: `1px solid ${tokens.colors.divider}`, borderRadius: tokens.radius.lg, bgcolor: tokens.colors.bgPaper }}>
    <Typography sx={{ fontSize: 11, color: tokens.colors.gray500, mb: 0.5 }}>{label}</Typography>
    <Typography sx={{ fontSize: 20, fontWeight: 600, color: tokens.colors.gray900, letterSpacing: '-0.02em' }}>{value}</Typography>
    {hint && <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, mt: 0.25 }}>{hint}</Typography>}
  </Box>
);

export const PersonRow: React.FC<{
  name?: string;
  subtitle?: string;
  initials?: string;
  color?: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
}> = ({ name, subtitle, initials, color = tokens.colors.brandNavy, userId, firstName, lastName }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
    {userId ? (
      <Box sx={{ width: 32, height: 32, borderRadius: tokens.radius.pill, bgcolor: color, color: '#fff', fontSize: 12, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <UserAvatarInitials user={{ id: userId, displayName: name, firstName, lastName }} />
      </Box>
    ) : (
      <Box sx={{ width: 32, height: 32, borderRadius: tokens.radius.pill, bgcolor: color, color: '#fff', fontSize: 12, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        {initials || (name || '').slice(0, 2).toUpperCase()}
      </Box>
    )}
    <Box sx={{ minWidth: 0 }}>
      {userId ? (
        <UserNameText
          user={{ id: userId, displayName: name, firstName, lastName }}
          fallback={name || '—'}
          sx={{ fontSize: 13, fontWeight: 500, color: tokens.colors.gray900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
        />
      ) : (
        <Typography sx={{ fontSize: 13, fontWeight: 500, color: tokens.colors.gray900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</Typography>
      )}
      {subtitle && <Typography sx={{ fontSize: 11, color: tokens.colors.gray400 }}>{subtitle}</Typography>}
    </Box>
  </Box>
);

export const TimelineItem: React.FC<{ actor: React.ReactNode; action: string; details?: string; date: string }> = ({
  actor, action, details, date,
}) => (
  <Box sx={{ display: 'flex', gap: 1.5, py: 1.25, borderBottom: `1px solid ${tokens.colors.gray100}`, '&:last-child': { borderBottom: 'none' } }}>
    <Box sx={{ width: 8, height: 8, borderRadius: tokens.radius.pill, bgcolor: tokens.colors.brandTeal, mt: 0.75, flexShrink: 0 }} />
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: 13, color: tokens.colors.gray900 }}>
        <Box component="span" sx={{ fontWeight: 600 }}>{actor}</Box> {action}
      </Typography>
      {details && <Typography sx={{ fontSize: 12, color: tokens.colors.gray500, mt: 0.25 }}>{details}</Typography>}
      <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, mt: 0.5 }}>{date}</Typography>
    </Box>
  </Box>
);

export const ToggleRow: React.FC<{ label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({
  label, hint, checked, onChange, disabled,
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 1.25 }}>
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 500, color: tokens.colors.gray900 }}>{label}</Typography>
      {hint && <Typography sx={{ fontSize: 11, color: tokens.colors.gray400 }}>{hint}</Typography>}
    </Box>
    <DsToggle checked={checked} onChange={onChange} disabled={disabled} />
  </Box>
);

export const MissionDetailSidebar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ width: 300, flexShrink: 0, borderLeft: `1px solid ${tokens.colors.divider}`, bgcolor: tokens.colors.surfaceAlt, p: 2, overflow: 'auto' }}>
    {children}
  </Box>
);
