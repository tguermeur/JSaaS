import React from 'react';
import { Avatar, Box, Typography } from '@mui/material';
import {
  PersonRow,
  SidebarBlock,
  ToggleRow,
} from '../../components/ds/MissionDetailsPrimitives';
import UserReferenceText from '../../components/common/UserReferenceText';
import { tokens } from '../../theme/tokens';

interface EtudeDetailSidebarPanelProps {
  numeroEtude: string;
  mandat?: string;
  missionTypeLabel?: string;
  createdByName?: string;
  createdById?: string;
  updatedAtLabel?: string;
  chargeName?: string;
  chargeId?: string;
  companyName?: string;
  companyLogo?: string | null;
  statusLabel?: string;
  etapeLabel?: string;
  isPublic: boolean;
  canWrite?: boolean;
  isSaving?: boolean;
  onTogglePublic?: (value: boolean) => void;
}

export const EtudeDetailSidebarPanel: React.FC<EtudeDetailSidebarPanelProps> = ({
  numeroEtude,
  mandat,
  missionTypeLabel,
  createdByName,
  createdById,
  updatedAtLabel,
  chargeName,
  chargeId,
  companyName,
  companyLogo,
  statusLabel,
  etapeLabel,
  isPublic,
  canWrite = true,
  isSaving,
  onTogglePublic,
}) => (
  <Box>
    <SidebarBlock title="Détails">
      <SidebarMetaRow label="N° étude" value={numeroEtude} mono />
      <SidebarMetaRow label="Mandat" value={mandat} />
      <SidebarMetaRow label="Type" value={missionTypeLabel} />
      <SidebarMetaRow label="Statut" value={statusLabel} />
      <SidebarMetaRow label="Étape" value={etapeLabel} />
      <SidebarMetaRow
        label="Créée par"
        value={
          createdById || createdByName ? (
            <UserReferenceText
              userId={createdById}
              name={createdByName}
              fallback="Utilisateur"
              sx={{ fontSize: 12, color: tokens.colors.gray700 }}
            />
          ) : undefined
        }
      />
      <SidebarMetaRow label="Mise à jour" value={updatedAtLabel} muted />
    </SidebarBlock>

    <SidebarBlock title="Entreprise">
      {companyName ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Avatar
            src={companyLogo || undefined}
            sx={{
              width: 32,
              height: 32,
              bgcolor: companyLogo ? 'transparent' : tokens.colors.primary,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {companyName.charAt(0).toUpperCase()}
          </Avatar>
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 500,
              color: tokens.colors.gray900,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {companyName}
          </Typography>
        </Box>
      ) : (
        <Typography sx={{ fontSize: 12, color: tokens.colors.gray400, fontStyle: 'italic' }}>
          Aucune entreprise définie
        </Typography>
      )}
    </SidebarBlock>

    <SidebarBlock title="Chargé d'étude">
      {chargeId || chargeName ? (
        <PersonRow userId={chargeId} name={chargeName} />
      ) : (
        <Typography sx={{ fontSize: 12, color: tokens.colors.gray400, fontStyle: 'italic' }}>
          Aucun chargé défini
        </Typography>
      )}
    </SidebarBlock>

    {onTogglePublic && (
      <SidebarBlock title="Visibilité">
        <ToggleRow
          label="Étude publique"
          hint="Visible sur le portail étudiants"
          checked={isPublic}
          onChange={onTogglePublic}
          disabled={!canWrite || isSaving}
        />
      </SidebarBlock>
    )}
  </Box>
);

const SidebarMetaRow: React.FC<{ label: string; value?: React.ReactNode; mono?: boolean; muted?: boolean }> = ({
  label,
  value,
  mono,
  muted,
}) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', py: 0.5, gap: 1.5 }}>
    <Typography sx={{ fontSize: 11, color: tokens.colors.gray500, flexShrink: 0 }}>{label}</Typography>
    <Typography
      component="div"
      sx={{
        fontSize: 12,
        color: muted ? tokens.colors.gray400 : tokens.colors.gray700,
        fontFamily: mono ? 'monospace' : 'inherit',
        textAlign: 'right',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {value || '—'}
    </Typography>
  </Box>
);
