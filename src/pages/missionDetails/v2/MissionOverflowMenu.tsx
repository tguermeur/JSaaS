import React from 'react';
import { Box, MenuItem, Divider, ListItemIcon, ListItemText } from '@mui/material';
import {
  HistoryEdu as SignatureIcon,
  BusinessCenter as BriefcaseIcon,
  Folder as FolderIcon,
  DeleteOutline as TrashIcon,
} from '@mui/icons-material';
import { tokens } from '../../../theme/tokens';

interface MissionOverflowMenuProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  isArchived?: boolean;
  onClose: () => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

export const MissionOverflowMenu: React.FC<MissionOverflowMenuProps> = ({
  open,
  anchorEl,
  isArchived,
  onClose,
  onDuplicate,
  onArchive,
  onDelete,
}) => (
  <>
    {open && (
      <Box
        onClick={onClose}
        sx={{ position: 'fixed', inset: 0, zIndex: 50 }}
      />
    )}
    <Box
      sx={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        right: 0,
        minWidth: 220,
        bgcolor: tokens.colors.bgPaper,
        borderRadius: tokens.radius.md,
        border: `1px solid ${tokens.colors.gray100}`,
        boxShadow: '0 12px 32px rgba(0,0,0,0.10)',
        zIndex: 60,
        py: 0.5,
        display: open && anchorEl ? 'block' : 'none',
      }}
    >
      <OverflowItem icon={<SignatureIcon fontSize="small" />} label="Envoyer en signature" disabled />
      <OverflowItem icon={<BriefcaseIcon fontSize="small" />} label="Dupliquer la mission" onClick={() => { onDuplicate?.(); onClose(); }} />
      <OverflowItem
        icon={<FolderIcon fontSize="small" />}
        label={isArchived ? 'Désarchiver' : 'Archiver'}
        onClick={() => { onArchive?.(); onClose(); }}
      />
      <Divider sx={{ my: 0.5 }} />
      <OverflowItem
        icon={<TrashIcon fontSize="small" sx={{ color: '#dc2626' }} />}
        label="Supprimer la mission"
        danger
        onClick={() => { onDelete?.(); onClose(); }}
      />
    </Box>
  </>
);

const OverflowItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}> = ({ icon, label, danger, disabled, onClick }) => (
  <MenuItem
    disabled={disabled}
    onClick={disabled ? undefined : onClick}
    sx={{
      fontSize: 13,
      py: 1,
      color: danger ? '#dc2626' : tokens.colors.gray700,
      '&.Mui-disabled': {
        opacity: 1,
        color: tokens.colors.gray400,
        '& .MuiListItemIcon-root': { color: tokens.colors.gray400 },
      },
      '&:hover': disabled
        ? undefined
        : { bgcolor: danger ? '#fef2f2' : tokens.colors.gray50 },
    }}
  >
    <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>{icon}</ListItemIcon>
    <ListItemText primaryTypographyProps={{ fontSize: 13 }}>{label}</ListItemText>
  </MenuItem>
);
