import React from 'react';
import {
  Avatar,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Skeleton,
  Typography,
} from '@mui/material';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { tokens } from '../../theme/tokens';
import { avatarColorFromSeed } from './ApplyBoardPrimitives';

export const CaeKpi: React.FC<{ label: string; value: string | number; hint?: string }> = ({ label, value, hint }) => (
  <Box sx={{ p: 1.5, border: `1px solid ${tokens.colors.divider}`, borderRadius: tokens.radius.lg, bgcolor: tokens.colors.bgPaper, minWidth: 100 }}>
    <Typography sx={{ fontSize: 11, color: tokens.colors.gray500, mb: 0.5 }}>{label}</Typography>
    <Typography sx={{ fontSize: 22, fontWeight: 600, color: tokens.colors.gray900, letterSpacing: '-0.02em' }}>{value}</Typography>
    {hint && <Typography sx={{ fontSize: 10, color: tokens.colors.gray400, mt: 0.25 }}>{hint}</Typography>}
  </Box>
);

export const CaeEventCard: React.FC<{
  title: string;
  date: string;
  location?: string;
  status: string;
  fillPct?: number;
  onView?: () => void;
  actions?: React.ReactNode;
}> = ({ title, date, location, status, fillPct, onView, actions }) => {
  const statusColors: Record<string, { bg: string; fg: string }> = {
    'Ouvert': { bg: tokens.colors.successLight, fg: '#065f46' },
    'Complet': { bg: tokens.colors.warningLight, fg: '#92400e' },
    'Terminé': { bg: tokens.colors.gray100, fg: tokens.colors.gray500 },
  };
  const sc = statusColors[status] || statusColors['Ouvert'];
  return (
    <Box sx={{ p: 2, border: `1px solid ${tokens.colors.divider}`, borderRadius: tokens.radius.lg, bgcolor: tokens.colors.bgPaper, cursor: onView ? 'pointer' : 'default', transition: tokens.transitions.fast, '&:hover': onView ? { boxShadow: tokens.shadows.sm, borderColor: tokens.colors.gray300 } : {} }} onClick={onView}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.colors.gray900, flex: 1, minWidth: 0, lineHeight: 1.35 }}>{title}</Typography>
        <Box component="span" sx={{ fontSize: 11, fontWeight: 600, px: 1, py: '2px', borderRadius: tokens.radius.pill, bgcolor: sc.bg, color: sc.fg, flexShrink: 0, whiteSpace: 'nowrap' }}>{status}</Box>
      </Box>
      <Typography sx={{ fontSize: 12, color: tokens.colors.gray500, mb: 0.5 }}>{date}</Typography>
      {location && <Typography sx={{ fontSize: 12, color: tokens.colors.gray400 }}>{location}</Typography>}
      {actions && (
        <Box
          sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 1.5 }}
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </Box>
      )}
      {fillPct != null && (
        <Box sx={{ mt: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography sx={{ fontSize: 10, color: tokens.colors.gray500 }}>Remplissage</Typography>
            <Typography sx={{ fontSize: 10, fontWeight: 600, color: tokens.colors.gray700 }}>{fillPct}%</Typography>
          </Box>
          <Box sx={{ height: 4, bgcolor: tokens.colors.gray100, borderRadius: tokens.radius.pill, overflow: 'hidden' }}>
            <Box sx={{ width: `${fillPct}%`, height: '100%', bgcolor: tokens.colors.brandTeal, borderRadius: tokens.radius.pill }} />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export const AmbassadorCampusFilterBar: React.FC<{
  options: Array<{ id: string; label: string; count: number }>;
  value: string;
  onChange: (id: string) => void;
}> = ({ options, value, onChange }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5, flexWrap: 'wrap' }}>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <Box
            key={opt.id}
            component="button"
            type="button"
            onClick={() => onChange(opt.id)}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              border: 'none',
              bgcolor: active ? tokens.colors.gray900 : tokens.colors.gray100,
              color: active ? tokens.colors.marketingWhite : tokens.colors.gray700,
              fontSize: 13,
              fontWeight: 500,
              px: 1.75,
              py: 0.75,
              borderRadius: tokens.radius.pill,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: tokens.transitions.fast,
              '&:hover': {
                bgcolor: active ? tokens.colors.gray800 : tokens.colors.gray200,
              },
            }}
          >
            {opt.label}
            <Box
              component="span"
              sx={{
                fontSize: 11,
                fontWeight: 600,
                px: 0.75,
                py: 0.1,
                borderRadius: tokens.radius.pill,
                bgcolor: active ? 'rgba(255,255,255,0.18)' : tokens.colors.gray200,
                color: active ? tokens.colors.marketingWhite : tokens.colors.gray600,
                minWidth: 18,
                textAlign: 'center',
              }}
            >
              {opt.count}
            </Box>
          </Box>
        );
      })}
    </Box>
  </Box>
);

export const AmbassadorCardsGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: {
        xs: '1fr',
        sm: 'repeat(2, 1fr)',
        md: 'repeat(3, 1fr)',
        lg: 'repeat(4, 1fr)',
      },
      gap: 2,
    }}
  >
    {children}
  </Box>
);

export const AmbassadorProfileCard: React.FC<{
  initials: string;
  avatarColor: string;
  photoUrl?: string;
  name: string;
  nameLoading?: boolean;
  program: string;
  studyYear: string;
  campus: string;
  phone: string;
  phoneLoading?: boolean;
  positionedDays: number;
  onRemove?: () => void;
  removing?: boolean;
}> = ({
  initials,
  avatarColor,
  photoUrl,
  name,
  nameLoading,
  program,
  studyYear,
  campus,
  phone,
  phoneLoading,
  positionedDays,
  onRemove,
  removing,
}) => {
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);

  const metaRows = [
    { icon: <SchoolOutlinedIcon />, label: studyYear },
    { icon: <PlaceOutlinedIcon />, label: campus },
    { icon: <PhoneOutlinedIcon />, label: phoneLoading ? '…' : phone || 'Non renseigné' },
  ];

  return (
    <Box
      sx={{
        bgcolor: tokens.colors.bgPaper,
        border: `1px solid ${tokens.colors.borderDefault}`,
        borderRadius: tokens.radius.xl,
        p: 2.25,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.75,
        transition: tokens.transitions.fast,
        '&:hover': { borderColor: tokens.colors.gray300, boxShadow: tokens.shadows.sm },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', minWidth: 0 }}>
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <Avatar
              src={photoUrl || undefined}
              sx={{
                width: 52,
                height: 52,
                bgcolor: avatarColor,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {initials}
            </Avatar>
            <CheckCircleIcon
              sx={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                fontSize: 18,
                color: tokens.colors.success,
                bgcolor: tokens.colors.bgPaper,
                borderRadius: tokens.radius.full,
              }}
            />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            {nameLoading ? (
              <Skeleton width={140} height={22} sx={{ mb: 0.5 }} />
            ) : (
              <Typography sx={{ fontSize: 15, fontWeight: 600, color: tokens.colors.gray900, lineHeight: 1.35 }}>
                {name}
              </Typography>
            )}
            <Typography
              sx={{
                fontSize: 12,
                color: tokens.colors.gray500,
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {program}
            </Typography>
          </Box>
        </Box>
        {onRemove && (
          <>
            <IconButton
              size="small"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              disabled={removing}
              sx={{ color: tokens.colors.gray400, mt: -0.5, mr: -0.5 }}
            >
              <MoreHorizIcon fontSize="small" />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <MenuItem
                onClick={() => {
                  setMenuAnchor(null);
                  onRemove();
                }}
                sx={{ fontSize: 13, color: tokens.colors.error }}
              >
                Retirer le statut ambassadeur
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.85 }}>
        {metaRows.map((row, index) => (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Box sx={{ color: tokens.colors.gray400, display: 'flex', flexShrink: 0, '& svg': { fontSize: 16 } }}>
              {row.icon}
            </Box>
            <Typography
              sx={{
                fontSize: 13,
                color: tokens.colors.gray600,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.label}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pt: 0.5,
          borderTop: `1px solid ${tokens.colors.gray100}`,
        }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.colors.brandNavy }}>
          {positionedDays > 0
            ? `${positionedDays} journée${positionedDays > 1 ? 's' : ''} positionnée${positionedDays > 1 ? 's' : ''}`
            : 'Aucune journée positionnée'}
        </Typography>
        <Box
          component="span"
          sx={{
            fontSize: 11,
            fontWeight: 600,
            px: 1.125,
            py: '3px',
            borderRadius: tokens.radius.pill,
            bgcolor: tokens.colors.successLight,
            color: '#065f46',
          }}
        >
          Actif
        </Box>
      </Box>
    </Box>
  );
};

export const ambassadorAvatarColor = (seed: string): string => avatarColorFromSeed(seed);

export const PortalTopBar: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  logoUrl?: string | null;
  eyebrow?: string;
  compact?: boolean;
}> = ({ title, subtitle, actions, logoUrl, eyebrow, compact = false }) => (
  <Box sx={{
    px: 3,
    pt: compact ? 1.25 : eyebrow ? 2 : 1.5,
    pb: compact ? 1.25 : eyebrow ? 2 : 1.5,
    bgcolor: tokens.colors.bgPaper,
    borderBottom: `1px solid ${tokens.colors.divider}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: { xs: 'flex-start', md: 'center' },
    gap: 2,
    flexWrap: 'wrap',
    flexShrink: 0,
  }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flex: '1 1 280px' }}>
      {logoUrl && (
        <Box
          component="img"
          src={logoUrl}
          alt=""
          sx={{ height: 40, maxWidth: 120, objectFit: 'contain', flexShrink: 0 }}
        />
      )}
      <Box sx={{ minWidth: 0 }}>
        {eyebrow ? (
          <Typography sx={{ fontSize: 11, color: tokens.colors.gray500, mb: 0.25 }}>{eyebrow}</Typography>
        ) : null}
        <Typography sx={{ fontSize: compact ? 18 : 20, fontWeight: 600, color: tokens.colors.gray900, letterSpacing: '-0.02em', wordBreak: 'break-word', lineHeight: 1.25 }}>{title}</Typography>
        {subtitle && (
          <Typography sx={{ fontSize: compact ? 12 : 13, color: tokens.colors.gray500, mt: compact ? 0.125 : 0.25, wordBreak: 'break-word', lineHeight: 1.4 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
    {actions && (
      <Box sx={{ display: 'flex', flexShrink: 0, alignItems: 'center' }}>
        {actions}
      </Box>
    )}
  </Box>
);
