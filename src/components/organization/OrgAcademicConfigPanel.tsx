import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  LinearProgress,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  School as SchoolIcon,
  Place as PlaceIcon,
} from '@mui/icons-material';
import { SettingsPanel } from '../ds';
import { tokens } from '../../theme/tokens';
import {
  addCampus,
  addProgram,
  ensureDefaultPrograms,
  getStructureAcademicConfig,
  removeCampus,
  removeProgram,
} from '../../services/structureAcademicService';

interface OrgAcademicConfigPanelProps {
  structureId: string | null;
  schoolName?: string;
  canWrite: boolean;
  compact?: boolean;
  onNotify?: (message: string, severity: 'success' | 'error') => void;
}

type SavingField = 'programs' | 'campuses' | null;

const ListEditor: React.FC<{
  title: string;
  desc?: string;
  icon: React.ReactNode;
  items: string[];
  inputLabel: string;
  inputPlaceholder: string;
  emptyHint: string;
  countLabel: (n: number) => string;
  newValue: string;
  onNewValueChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  saving: boolean;
  canWrite: boolean;
  compact?: boolean;
}> = ({
  title,
  desc,
  icon,
  items,
  inputLabel,
  inputPlaceholder,
  emptyHint,
  countLabel,
  newValue,
  onNewValueChange,
  onAdd,
  onRemove,
  saving,
  canWrite,
  compact,
}) => (
  <SettingsPanel
    title={compact ? `${title} · ${countLabel(items.length)}` : title}
    desc={compact ? undefined : desc}
    icon={icon}
    pad={compact ? 1 : 2.25}
    dense={compact}
    sx={compact ? { flex: 1, display: 'flex', flexDirection: 'column', width: '100%' } : undefined}
  >
    {!compact && (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography sx={{ fontSize: 12, color: tokens.colors.gray500 }}>
          {countLabel(items.length)}
        </Typography>
      </Box>
    )}

    {canWrite && (
      <Box sx={{ display: 'flex', alignItems: compact ? 'flex-end' : 'center', gap: 0.75, mb: compact ? 0.75 : 2.5 }}>
        <TextField
          label={inputLabel}
          value={newValue}
          onChange={(e) => onNewValueChange(e.target.value)}
          placeholder={inputPlaceholder}
          fullWidth
          size="small"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !saving && newValue.trim()) {
              e.preventDefault();
              onAdd();
            }
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: tokens.radius.sm,
              ...(compact ? { height: 40 } : {}),
            },
            '& .MuiInputLabel-root': { fontSize: compact ? 12 : undefined },
          }}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={onAdd}
          disabled={saving || !newValue.trim()}
          sx={{
            minWidth: compact ? 40 : 100,
            width: compact ? 40 : undefined,
            height: compact ? 40 : undefined,
            minHeight: compact ? 40 : undefined,
            px: compact ? 0 : 2,
            textTransform: 'none',
            borderRadius: tokens.radius.sm,
            flexShrink: 0,
          }}
        >
          {saving ? <LinearProgress sx={{ width: 16, height: 16 }} /> : compact ? <AddIcon fontSize="small" /> : 'Ajouter'}
        </Button>
      </Box>
    )}

    {items.length === 0 ? (
      <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, py: compact ? 0.25 : 2, textAlign: 'center' }}>
        {emptyHint}
      </Typography>
    ) : (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: compact ? 0.5 : 0.75 }}>
        {items.map((item, index) => (
          <Chip
            key={`${item}-${index}`}
            label={item}
            size="small"
            onDelete={canWrite ? () => onRemove(index) : undefined}
            deleteIcon={
              canWrite ? (
                <Tooltip title="Supprimer">
                  <CloseIcon sx={{ fontSize: 14 }} />
                </Tooltip>
              ) : undefined
            }
            sx={{
              fontSize: 12,
              height: compact ? 26 : 28,
              bgcolor: tokens.colors.gray100,
              '& .MuiChip-label': { px: 1 },
            }}
          />
        ))}
      </Box>
    )}
  </SettingsPanel>
);

export const OrgAcademicConfigPanel: React.FC<OrgAcademicConfigPanelProps> = ({
  structureId,
  schoolName,
  canWrite,
  compact = false,
  onNotify,
}) => {
  const [programs, setPrograms] = useState<string[]>([]);
  const [campuses, setCampuses] = useState<string[]>([]);
  const [newProgram, setNewProgram] = useState('');
  const [newCampus, setNewCampus] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<SavingField>(null);

  const notify = useCallback(
    (message: string, severity: 'success' | 'error') => {
      onNotify?.(message, severity);
    },
    [onNotify]
  );

  const load = useCallback(async () => {
    if (!structureId) {
      setPrograms([]);
      setCampuses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const config = canWrite
        ? await ensureDefaultPrograms(structureId, schoolName)
        : await getStructureAcademicConfig(structureId);
      setPrograms(config.programs);
      setCampuses(config.campuses);
    } catch (error) {
      console.error('Erreur chargement config académique:', error);
      notify('Impossible de charger les formations et campus', 'error');
    } finally {
      setLoading(false);
    }
  }, [structureId, schoolName, canWrite, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAddProgram = async () => {
    if (!structureId || !newProgram.trim()) return;
    try {
      setSavingField('programs');
      const updated = await addProgram(structureId, newProgram, schoolName);
      setPrograms(updated);
      setNewProgram('');
      notify('Formation ajoutée', 'success');
    } catch (error) {
      console.error(error);
      notify('Erreur lors de l\'ajout de la formation', 'error');
    } finally {
      setSavingField(null);
    }
  };

  const handleRemoveProgram = async (index: number) => {
    if (!structureId) return;
    try {
      setSavingField('programs');
      const updated = await removeProgram(structureId, index);
      setPrograms(updated);
      notify('Formation supprimée', 'success');
    } catch (error) {
      console.error(error);
      notify('Erreur lors de la suppression', 'error');
    } finally {
      setSavingField(null);
    }
  };

  const handleAddCampus = async () => {
    if (!structureId || !newCampus.trim()) return;
    try {
      setSavingField('campuses');
      const updated = await addCampus(structureId, newCampus, schoolName);
      setCampuses(updated);
      setNewCampus('');
      notify('Campus ajouté', 'success');
    } catch (error) {
      console.error(error);
      notify('Erreur lors de l\'ajout du campus', 'error');
    } finally {
      setSavingField(null);
    }
  };

  const handleRemoveCampus = async (index: number) => {
    if (!structureId) return;
    try {
      setSavingField('campuses');
      const updated = await removeCampus(structureId, index);
      setCampuses(updated);
      notify('Campus supprimé', 'success');
    } catch (error) {
      console.error(error);
      notify('Erreur lors de la suppression', 'error');
    } finally {
      setSavingField(null);
    }
  };

  if (!structureId) return null;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: compact ? 1.5 : 4 }}>
        <LinearProgress sx={{ width: '100%', maxWidth: compact ? 200 : 320 }} />
      </Box>
    );
  }

  const spacing = compact ? 1.5 : 3;

  return (
    <Grid
      container
      spacing={spacing}
      sx={{
        mt: 0,
        ...(compact ? { flex: 1, alignContent: 'flex-start' } : {}),
      }}
    >
      <Grid item xs={12} md={compact ? 12 : 6} sx={compact ? { display: 'flex' } : undefined}>
        <ListEditor
          title="Formations"
          desc="Programmes proposés aux étudiants à l'inscription"
          icon={<SchoolIcon sx={{ fontSize: compact ? 14 : 16 }} />}
          items={programs}
          inputLabel="Formation"
          inputPlaceholder="Ex. PGE"
          emptyHint="Aucune formation"
          countLabel={(n) => `${n} formation${n > 1 ? 's' : ''}`}
          newValue={newProgram}
          onNewValueChange={setNewProgram}
          onAdd={handleAddProgram}
          onRemove={handleRemoveProgram}
          saving={savingField === 'programs'}
          canWrite={canWrite}
          compact={compact}
        />
      </Grid>
      <Grid item xs={12} md={compact ? 12 : 6} sx={compact ? { display: 'flex' } : undefined}>
        <ListEditor
          title="Campus"
          desc="Sites où les étudiants peuvent s'inscrire"
          icon={<PlaceIcon sx={{ fontSize: compact ? 14 : 16 }} />}
          items={campuses}
          inputLabel="Campus"
          inputPlaceholder="Ex. Nantes"
          emptyHint="Aucun campus"
          countLabel={(n) => `${n} campus`}
          newValue={newCampus}
          onNewValueChange={setNewCampus}
          onAdd={handleAddCampus}
          onRemove={handleRemoveCampus}
          saving={savingField === 'campuses'}
          canWrite={canWrite}
          compact={compact}
        />
      </Grid>
    </Grid>
  );
};

export default OrgAcademicConfigPanel;
