import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import { tokens } from '../../../theme/tokens';
import { MD_FIELD_LABEL } from './constants';

interface MissionSaveBarProps {
  dirtyCount: number;
  dirtyFields: string[];
  accent?: string;
  onSave: () => void;
  onDiscard: () => void;
}

/** Barre d'enregistrement persistante en bas de page (toujours visible). */
export const MissionSaveBar: React.FC<MissionSaveBarProps> = ({
  dirtyCount,
  dirtyFields,
  accent = tokens.colors.brandTeal,
  onSave,
  onDiscard,
}) => {
  const isDirty = dirtyCount > 0;
  const preview = dirtyFields.slice(0, 3).map((f) => MD_FIELD_LABEL[f] || f);
  const extra = dirtyFields.length - 3;

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        bgcolor: tokens.colors.bgPaper,
        borderTop: `1px solid ${tokens.colors.gray200}`,
        boxShadow: '0 -4px 16px rgba(0,0,0,0.04)',
        px: 3,
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: 999,
            bgcolor: isDirty ? '#f59e0b' : tokens.colors.gray300,
            flexShrink: 0,
          }}
        />
        <Typography sx={{ fontSize: 13, fontWeight: 500, color: tokens.colors.gray900 }}>
          {isDirty
            ? `${dirtyCount} modification${dirtyCount > 1 ? 's' : ''} non enregistrée${dirtyCount > 1 ? 's' : ''}`
            : 'Aucune modification en attente'}
        </Typography>
        {isDirty && preview.length > 0 && (
          <Typography
            sx={{
              fontSize: 12,
              color: tokens.colors.gray400,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            · {preview.join(', ')}{extra > 0 ? ` +${extra}` : ''}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
        <Button
          size="small"
          variant="outlined"
          onClick={onDiscard}
          disabled={!isDirty}
          sx={{
            textTransform: 'none',
            borderRadius: '6px',
            borderColor: tokens.colors.gray200,
            color: tokens.colors.gray700,
          }}
        >
          Annuler
        </Button>
        <Button
          size="small"
          variant="contained"
          startIcon={<CheckIcon sx={{ fontSize: 16 }} />}
          onClick={onSave}
          disabled={!isDirty}
          sx={{
            textTransform: 'none',
            borderRadius: '6px',
            bgcolor: accent,
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            '&:hover': { bgcolor: accent, filter: 'brightness(0.95)' },
            '&.Mui-disabled': {
              bgcolor: tokens.colors.gray100,
              color: tokens.colors.gray400,
            },
          }}
        >
          Enregistrer les modifications
        </Button>
      </Box>
    </Box>
  );
};
