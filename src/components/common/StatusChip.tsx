import React from 'react';
import { Chip, ChipProps } from '@mui/material';
import { tokens } from '../../theme/tokens';

// Status color mappings per variant
const STATUS_COLORS: Record<string, Record<string, { bg: string; color: string }>> = {
  etude: {
    prospection: { bg: tokens.colors.infoLight, color: tokens.colors.info },
    proposition_commerciale: { bg: tokens.colors.infoLight, color: tokens.colors.info },
    negociation: { bg: tokens.colors.warningLight, color: tokens.colors.warning },
    convention_signee: { bg: tokens.colors.primaryAlpha10, color: tokens.colors.primary },
    recrutement_consultants: { bg: tokens.colors.primaryAlpha10, color: tokens.colors.primary },
    realisation: { bg: tokens.colors.warningLight, color: tokens.colors.warning },
    livraison: { bg: tokens.colors.successLight, color: tokens.colors.success },
    facturation: { bg: tokens.colors.successLight, color: tokens.colors.success },
    audit_qualite: { bg: tokens.colors.primaryAlpha10, color: tokens.colors.primary },
    cloture: { bg: tokens.colors.successLight, color: tokens.colors.success },
  },
  mission: {
    'En cours': { bg: tokens.colors.warningLight, color: tokens.colors.warning },
    'Terminée': { bg: tokens.colors.successLight, color: tokens.colors.success },
    'En attente': { bg: tokens.colors.infoLight, color: tokens.colors.info },
    'Annulée': { bg: tokens.colors.errorLight, color: tokens.colors.error },
  },
  facture: {
    'Payée': { bg: tokens.colors.successLight, color: tokens.colors.success },
    'En attente': { bg: tokens.colors.warningLight, color: tokens.colors.warning },
    'En retard': { bg: tokens.colors.errorLight, color: tokens.colors.error },
    'Brouillon': { bg: `${tokens.colors.textSecondary}15`, color: tokens.colors.textSecondary },
  },
  default: {
    active: { bg: tokens.colors.successLight, color: tokens.colors.success },
    inactive: { bg: `${tokens.colors.textSecondary}15`, color: tokens.colors.textSecondary },
    pending: { bg: tokens.colors.warningLight, color: tokens.colors.warning },
    error: { bg: tokens.colors.errorLight, color: tokens.colors.error },
  },
};

interface StatusChipProps extends Omit<ChipProps, 'variant'> {
  status: string;
  variant?: 'etude' | 'mission' | 'facture' | 'default';
}

const StatusChip: React.FC<StatusChipProps> = ({
  status,
  variant = 'default',
  ...chipProps
}) => {
  const colorMap = STATUS_COLORS[variant] || STATUS_COLORS.default;
  const statusColor = colorMap[status] || {
    bg: `${tokens.colors.textSecondary}15`,
    color: tokens.colors.textSecondary,
  };

  return (
    <Chip
      label={chipProps.label || status}
      size="small"
      {...chipProps}
      sx={{
        backgroundColor: statusColor.bg,
        color: statusColor.color,
        fontWeight: 600,
        fontSize: '12px',
        borderRadius: tokens.radius.pill,
        ...chipProps.sx,
      }}
    />
  );
};

export default StatusChip;
