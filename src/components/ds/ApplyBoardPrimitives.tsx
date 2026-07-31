import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { tokens } from '../../theme/tokens';

export type ApplyCardStatus = 'open' | 'closing' | 'selection';

const STATUS_STYLES: Record<
  ApplyCardStatus,
  { dot: string; bg: string; color: string; label: string }
> = {
  open: { dot: tokens.colors.success, bg: tokens.colors.successLight, color: '#065f46', label: 'Ouverte' },
  closing: { dot: tokens.colors.warning, bg: tokens.colors.warningLight, color: '#92400e', label: 'Bientôt clôturée' },
  selection: { dot: tokens.colors.gray400, bg: tokens.colors.gray100, color: tokens.colors.gray700, label: 'Sélection en cours' },
};

export const ApplyStatusLegend: React.FC = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
    {(Object.keys(STATUS_STYLES) as ApplyCardStatus[]).map((key) => (
      <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: tokens.radius.pill, bgcolor: STATUS_STYLES[key].dot }} />
        <Typography sx={{ fontSize: 12, color: tokens.colors.gray500, whiteSpace: 'nowrap' }}>
          {STATUS_STYLES[key].label}
        </Typography>
      </Box>
    ))}
  </Box>
);

export const ApplyFilterBar: React.FC<{
  options: string[];
  value: string;
  onChange: (value: string) => void;
  starOption?: string;
  inline?: boolean;
}> = ({ options, value, onChange, starOption, inline }) => (
  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, ...(inline ? {} : { mb: 2.5 }) }}>
    {options.map((opt) => {
      const active = value === opt;
      const showStar = starOption === opt;
      return (
        <Box
          key={opt}
          component="button"
          onClick={() => onChange(opt)}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            border: `1px solid ${active ? tokens.colors.brandNavy : tokens.colors.gray200}`,
            bgcolor: active ? tokens.colors.brandNavy : tokens.colors.bgPaper,
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
              borderColor: active ? tokens.colors.brandNavy : tokens.colors.gray300,
            },
          }}
        >
          {showStar && (
            <StarBorderIcon sx={{ fontSize: 15, color: active ? tokens.colors.marketingWhite : tokens.colors.brandTeal }} />
          )}
          {opt}
        </Box>
      );
    })}
  </Box>
);

export interface ApplyListingCardMeta {
  icon: React.ReactNode;
  label: string;
}

export const ApplyListingCard: React.FC<{
  status: ApplyCardStatus;
  statusLabel?: string;
  badgeRight?: string;
  showStarBadge?: boolean;
  initials: string;
  avatarColor?: string;
  title: string;
  subtitle: string;
  description?: string;
  tags?: string[];
  meta?: ApplyListingCardMeta[];
  actionLabel: string;
  actionDisabled?: boolean;
  onAction: () => void;
  onClick?: () => void;
}> = ({
  status,
  statusLabel,
  badgeRight,
  showStarBadge,
  initials,
  avatarColor = tokens.colors.brandTeal,
  title,
  subtitle,
  description,
  tags,
  meta,
  actionLabel,
  actionDisabled,
  onAction,
  onClick,
}) => {
  const st = STATUS_STYLES[status];
  const label = statusLabel || st.label;

  return (
    <Box
      onClick={onClick}
      sx={{
        bgcolor: tokens.colors.bgPaper,
        border: `1px solid ${tokens.colors.borderDefault}`,
        borderRadius: tokens.radius.xl,
        p: 2.25,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        cursor: onClick ? 'pointer' : 'default',
        transition: tokens.transitions.fast,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        '&:hover': onClick
          ? { borderColor: tokens.colors.gray300, boxShadow: tokens.shadows.sm }
          : {},
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.25,
            py: 0.4,
            borderRadius: tokens.radius.pill,
            bgcolor: st.bg,
            color: st.color,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <Box sx={{ width: 6, height: 6, borderRadius: tokens.radius.pill, bgcolor: st.dot }} />
          {label}
        </Box>
        {badgeRight && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35, flexShrink: 0 }}>
            {showStarBadge && (
              <StarBorderIcon sx={{ fontSize: 14, color: tokens.colors.brandTeal }} />
            )}
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.colors.brandTeal }}>
              {badgeRight}
            </Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: tokens.radius.pill,
            bgcolor: avatarColor,
            color: tokens.colors.marketingWhite,
            fontSize: 13,
            fontWeight: 700,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          {initials}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: 15,
              fontWeight: 600,
              color: tokens.colors.gray900,
              lineHeight: 1.35,
              mb: 0.25,
            }}
          >
            {title}
          </Typography>
          <Typography sx={{ fontSize: 13, color: tokens.colors.gray500 }}>{subtitle}</Typography>
        </Box>
      </Box>

      {description && (
        <Typography
          sx={{
            fontSize: 13,
            color: tokens.colors.gray600,
            lineHeight: 1.55,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {description}
        </Typography>
      )}

      {tags && tags.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {tags.map((tag) => (
            <Box
              key={tag}
              component="span"
              sx={{
                fontSize: 11,
                fontWeight: 500,
                px: 1,
                py: 0.35,
                borderRadius: tokens.radius.pill,
                bgcolor: tokens.colors.gray100,
                color: tokens.colors.gray600,
              }}
            >
              {tag}
            </Box>
          ))}
        </Box>
      )}

      {meta && meta.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, pt: 0.25 }}>
          {meta.map((item, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ color: tokens.colors.gray400, display: 'flex', alignItems: 'center', '& svg': { fontSize: 15 } }}>
                {item.icon}
              </Box>
              <Typography sx={{ fontSize: 12, color: tokens.colors.gray500 }}>{item.label}</Typography>
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ pt: 0.5 }}>
        <Button
          variant="contained"
          disabled={actionDisabled}
          onClick={(e) => {
            e.stopPropagation();
            onAction();
          }}
          sx={{
            bgcolor: tokens.colors.brandNavy,
            color: tokens.colors.marketingWhite,
            borderRadius: tokens.radius.md,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: 13,
            px: 2.5,
            py: 0.85,
            boxShadow: 'none',
            '&:hover': { bgcolor: tokens.colors.brandNavy700, boxShadow: 'none' },
            '&.Mui-disabled': { bgcolor: tokens.colors.gray200, color: tokens.colors.gray500 },
          }}
        >
          {actionLabel}
        </Button>
      </Box>
    </Box>
  );
};

export const ApplyListingGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
      gap: 2,
      width: '100%',
      alignContent: 'start',
    }}
  >
    {children}
  </Box>
);

export const ApplyEmptyState: React.FC<{ message: string }> = ({ message }) => (
  <Box
    sx={{
      py: 6,
      px: 3,
      textAlign: 'center',
      bgcolor: tokens.colors.bgPaper,
      border: `1px solid ${tokens.colors.borderDefault}`,
      borderRadius: tokens.radius.xl,
    }}
  >
    <Typography sx={{ fontSize: 14, color: tokens.colors.gray500 }}>{message}</Typography>
  </Box>
);

/** Couleurs d'avatar déterministes à partir d'un identifiant */
export const avatarColorFromSeed = (seed: string): string => {
  const palette = ['#21BDA3', '#6366f1', '#8b5cf6', '#173B6C', '#f59e0b', '#ec4899'];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
};

export const initialsFromTitle = (title: string, fallback = 'EV'): string => {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return fallback;
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};
