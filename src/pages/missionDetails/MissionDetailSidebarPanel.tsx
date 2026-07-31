import React from 'react';
import { Box, Button, Typography, Chip } from '@mui/material';
import {
  SidebarBlock,
  PersonRow,
  ToggleRow,
} from '../../components/ds/MissionDetailsPrimitives';
import { tokens } from '../../theme/tokens';
import UserNameText from '../../components/common/UserNameText';
import UserReferenceText from '../../components/common/UserReferenceText';

export interface MissionSidebarUser {
  id: string;
  displayName: string;
  email?: string;
  role?: 'viewer' | 'editor';
}

interface MissionDetailSidebarPanelProps {
  numeroMission: string;
  mandat?: string;
  missionTypeLabel?: string;
  createdByName?: string;
  createdById?: string;
  updatedAtLabel?: string;
  chargeName?: string;
  chargeId?: string;
  chargeEmail?: string;
  contactName?: string;
  contactEmail?: string;
  users: MissionSidebarUser[];
  isPublished: boolean;
  canWrite: boolean;
  isSaving?: boolean;
  onOpenPermissions: () => void;
  onTogglePublished: () => void;
}

export const MissionDetailSidebarPanel: React.FC<MissionDetailSidebarPanelProps> = ({
  numeroMission,
  mandat,
  missionTypeLabel,
  createdByName,
  createdById,
  updatedAtLabel,
  chargeName,
  chargeId,
  chargeEmail,
  contactName,
  contactEmail,
  users,
  isPublished,
  canWrite,
  isSaving,
  onOpenPermissions,
  onTogglePublished,
}) => (
  <Box>
    <SidebarBlock title="Détails">
      <SidebarMetaRow label="N° mission" value={numeroMission} mono />
      <SidebarMetaRow label="Mandat" value={mandat} />
      <SidebarMetaRow label="Type" value={missionTypeLabel} />
      <SidebarMetaRow
        label="Créée par"
        value={
          createdById || createdByName ? (
            <UserReferenceText
              userId={createdById}
              name={createdByName}
              fallback="Utilisateur"
              component="span"
              sx={{ fontSize: 13, fontWeight: 500, color: tokens.colors.gray900 }}
            />
          ) : undefined
        }
      />
      <SidebarMetaRow label="Mise à jour" value={updatedAtLabel} muted />
    </SidebarBlock>

    <SidebarBlock title="Chargé de mission">
      {chargeId || chargeName ? (
        <Box>
          <UserNameText
            user={chargeId ? { id: chargeId, displayName: chargeName } : { displayName: chargeName }}
            fallback="Chargé de mission"
            sx={{ fontSize: 13, fontWeight: 600, color: tokens.colors.gray900 }}
          />
          {chargeEmail && (
            <Typography sx={{ fontSize: 11, color: tokens.colors.gray500, mt: 0.25 }}>
              {chargeEmail}
            </Typography>
          )}
        </Box>
      ) : (
        <Typography sx={{ fontSize: 12, color: tokens.colors.gray400, fontStyle: 'italic' }}>
          Aucun CDM défini
        </Typography>
      )}
    </SidebarBlock>

    <SidebarBlock title="Contact entreprise">
      {contactName ? (
        <PersonRow name={contactName} subtitle={contactEmail} />
      ) : (
        <Typography sx={{ fontSize: 12, color: tokens.colors.gray400, fontStyle: 'italic' }}>
          Aucun contact défini
        </Typography>
      )}
    </SidebarBlock>

    <SidebarBlock
      title="Accès"
      action={
        canWrite ? (
          <Button size="small" onClick={onOpenPermissions} sx={{ textTransform: 'none', fontSize: 11, minWidth: 0, p: 0 }}>
            Gérer
          </Button>
        ) : undefined
      }
    >
      {users.length === 0 ? (
        <Typography sx={{ fontSize: 12, color: tokens.colors.gray400 }}>Aucun accès personnalisé</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {users.slice(0, 4).map((user) => (
            <Box key={user.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <PersonRow userId={user.id} name={user.displayName} subtitle={user.email} />
              </Box>
              {user.role && (
                <Chip
                  label={user.role === 'editor' ? 'Édit.' : 'Lect.'}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: 9,
                    fontWeight: 700,
                    flexShrink: 0,
                    bgcolor: user.role === 'editor' ? tokens.colors.primaryAlpha15 : tokens.colors.gray100,
                    color: user.role === 'editor' ? tokens.colors.brandNavy : tokens.colors.gray500,
                  }}
                />
              )}
            </Box>
          ))}
          {users.length > 4 && (
            <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, textAlign: 'center' }}>
              +{users.length - 4} autres
            </Typography>
          )}
        </Box>
      )}
    </SidebarBlock>

    <SidebarBlock title="Publication">
      <ToggleRow
        label="Mission publiée"
        hint="Visible sur le portail étudiants"
        checked={isPublished}
        onChange={() => onTogglePublished()}
        disabled={!canWrite || isSaving}
      />
    </SidebarBlock>
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
    <Box
      component="div"
      sx={{
        fontSize: 12,
        color: muted ? tokens.colors.gray400 : tokens.colors.gray700,
        fontFamily: mono ? 'monospace' : 'inherit',
        textAlign: 'right',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        minWidth: 0,
      }}
    >
      {value || '—'}
    </Box>
  </Box>
);
