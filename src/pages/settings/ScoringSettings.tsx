import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Slider,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  useTheme,
  alpha,
  keyframes,
} from '@mui/material';
import {
  Add as AddIcon,
  Psychology as PsychologyIcon,
  TrendingUp as TrendingUpIcon,
  Business as BusinessIcon,
  AutoAwesome as AutoAwesomeIcon,
  Refresh as RefreshIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import SettingsCard from '../../components/settings/SettingsCard';
import { settingsPageStyles } from '../../components/ds';
import {
  getScoringSettings,
  saveScoringSettings,
  computeProspectScores,
  analyzePastClients,
} from '../../services/scoringService';
import type { ScoringSettings as ScoringSettingsType, ScoringWeights } from '../../types/scoring';
import { DEFAULT_SCORING_WEIGHTS } from '../../types/scoring';
import { useSnackbar } from 'notistack';
import { tokens } from '../../theme/tokens';
import { fadeIn } from '../../styles/animations';

const ScoringSettings: React.FC = () => {
  const theme = useTheme();
  const { userData } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const structureId = userData?.structureId ?? '';

  const [settings, setSettings] = useState<ScoringSettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [missionTypeTitles, setMissionTypeTitles] = useState<string[]>([]);
  const [newSpecialization, setNewSpecialization] = useState('');
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_SCORING_WEIGHTS);
  const [analyzing, setAnalyzing] = useState(false);
  const [recomputing, setRecomputing] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!structureId) return;
    setLoading(true);
    try {
      const s = await getScoringSettings(structureId);
      setSettings(s);
      if (s?.weights) setWeights(s.weights);
    } catch (e) {
      console.error(e);
      enqueueSnackbar('Erreur lors du chargement des paramètres', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [structureId, enqueueSnackbar]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!structureId || !db) return;
    const q = query(
      collection(db, 'missionTypes'),
      where('structureId', '==', structureId)
    );
    getDocs(q).then((snap) => {
      const titles = snap.docs.map((d) => String(d.data().title ?? '').trim()).filter(Boolean) as string[];
      setMissionTypeTitles(titles);
    });
  }, [structureId]);

  const rawSpecializations = settings?.specializations ?? [];
  const specializations = [...new Set(rawSpecializations.map((s) => String(s).trim()).filter(Boolean))];

  const createDefaultSettings = (overrides: Partial<ScoringSettingsType>): ScoringSettingsType => ({
    structureId,
    specializations: [],
    weights,
    contactMessageTemplate: '',
    ...overrides,
  });

  const persistSpecializations = useCallback(async (next: string[]) => {
    if (!structureId) return;
    const normalized = [...new Set(next.map((s) => String(s).trim()).filter(Boolean))];
    try {
      await saveScoringSettings(structureId, {
        specializations: normalized,
        weights,
        contactMessageTemplate: settings?.contactMessageTemplate ?? '',
      });
      enqueueSnackbar('Spécialisations enregistrées', { variant: 'success' });
    } catch (e) {
      console.error(e);
      enqueueSnackbar('Erreur lors de l\'enregistrement des spécialisations', { variant: 'error' });
      await loadSettings();
    }
  }, [structureId, weights, settings?.contactMessageTemplate, loadSettings, enqueueSnackbar]);

  const handleAddSpecialization = () => {
    const trimmed = newSpecialization.trim();
    if (!trimmed || specializations.some((s) => s.trim() === trimmed)) return;
    const next = [...specializations, trimmed];
    setSettings((prev) => prev ? { ...prev, specializations: next } : createDefaultSettings({ specializations: next }));
    setNewSpecialization('');
    persistSpecializations(next);
  };

  const handleRemoveSpecialization = (label: string) => {
    const next = rawSpecializations.filter((s) => String(s).trim() !== String(label).trim());
    setSettings((prev) => prev ? { ...prev, specializations: next } : createDefaultSettings({ specializations: next }));
    persistSpecializations(next);
  };

  const handleSave = async () => {
    if (!structureId) return;
    setSaving(true);
    const toSave = [...new Set((settings?.specializations ?? []).map((s) => String(s).trim()).filter(Boolean))];
    try {
      await saveScoringSettings(structureId, {
        specializations: toSave,
        weights,
        contactMessageTemplate: settings?.contactMessageTemplate ?? '',
      });
      await loadSettings();
      enqueueSnackbar('Paramètres enregistrés', { variant: 'success' });
    } catch (e) {
      console.error(e);
      enqueueSnackbar('Erreur lors de l\'enregistrement', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAnalyzePastClients = async () => {
    if (!structureId) return;
    setAnalyzing(true);
    try {
      await analyzePastClients(structureId);
      await loadSettings();
      enqueueSnackbar('Analyse des clients passés terminée', { variant: 'success' });
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || '';
      const isRateLimit =
        e?.code === 'functions/resource-exhausted' ||
        /resource exhausted|limite.*atteinte|429/i.test(msg);
      const is404OrNetwork = e?.code === 'unavailable' || msg.includes('404') || msg.includes('internal');
      enqueueSnackbar(
        isRateLimit
          ? 'Limite d\'utilisation de l\'API IA atteinte. Réessayez dans quelques minutes.'
          : is404OrNetwork
            ? 'Fonctions Cloud indisponibles. Déployez avec : firebase deploy --only functions'
            : (msg || 'Erreur lors de l\'analyse'),
        { variant: 'error', autoHideDuration: isRateLimit ? 10000 : 8000 }
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRecomputeScores = async () => {
    if (!structureId) return;
    setRecomputing(true);
    try {
      const { updated } = await computeProspectScores(structureId);
      enqueueSnackbar(`${updated} prospect(s) mis à jour`, { variant: 'success' });
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || '';
      const is404OrNetwork = e?.code === 'unavailable' || msg.includes('404') || msg.includes('internal');
      enqueueSnackbar(
        is404OrNetwork
          ? 'Fonctions Cloud indisponibles. Déployez-les avec : firebase deploy --only functions'
          : (msg || 'Erreur lors du recalcul'),
        { variant: 'error', autoHideDuration: 8000 }
      );
    } finally {
      setRecomputing(false);
    }
  };

  const totalWeight =
    weights.completeness + weights.recency + weights.status + weights.lastActivity +
    (weights.fitSpecialization ?? 0) + (weights.fitPastClients ?? 0);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 280 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ animation: `${fadeIn} 0.4s ease-out` }}>
      <Box component="header" sx={{ ...settingsPageStyles.header, px: 0, py: 0, bgcolor: 'transparent', borderBottom: 'none', mb: 3 }}>
        <Box>
          <Typography sx={settingsPageStyles.eyebrow}>Paramètres</Typography>
          <Typography component="h1" sx={settingsPageStyles.title}>IA Commercial</Typography>
          <Typography sx={settingsPageStyles.sub}>
            Notation des prospects, analyse des clients passés et template de message de contact pour l&apos;IA.
          </Typography>
        </Box>
      </Box>

      <Stack spacing={3}>
        <SettingsCard
          icon={<PsychologyIcon />}
          title="Spécialisations"
          subtitle="Missions dans lesquelles votre structure se spécialise (pour le scoring)"
          gradient={tokens.gradients.brand}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {missionTypeTitles
              .filter((t) => !specializations.some((s) => s === String(t).trim()))
              .map((title) => (
                <Chip
                  key={title}
                  label={title}
                  onClick={() => {
                    const next = [...specializations, String(title).trim()];
                    setSettings((prev) => prev ? { ...prev, specializations: next } : createDefaultSettings({ specializations: next }));
                    persistSpecializations(next);
                  }}
                  sx={{ borderRadius: '10px', fontWeight: 500 }}
                  variant="outlined"
                />
              ))}
            {specializations.map((label) => (
              <Chip
                key={label}
                label={label}
                onDelete={(e) => {
                  e.stopPropagation();
                  handleRemoveSpecialization(label);
                }}
                color="primary"
                sx={{ borderRadius: '10px', fontWeight: 500 }}
              />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Ajouter une spécialisation..."
              value={newSpecialization}
              onChange={(e) => setNewSpecialization(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSpecialization()}
              sx={{
                flex: 1,
                '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: alpha(theme.palette.primary.main, 0.04) },
              }}
            />
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddSpecialization}
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
            >
              Ajouter
            </Button>
          </Box>
        </SettingsCard>

        <SettingsCard
          icon={<TrendingUpIcon />}
          title="Poids des critères"
          subtitle="Répartition du score (complétude, fraîcheur, statut, dernière activité)"
          gradient={tokens.gradients.brand}
        >
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            {[
              { key: 'completeness' as const, label: 'Complétude de la fiche', value: weights.completeness },
              { key: 'recency' as const, label: 'Fraîcheur (date de création)', value: weights.recency },
              { key: 'status' as const, label: 'Statut dans le pipeline', value: weights.status },
              { key: 'lastActivity' as const, label: 'Dernière activité', value: weights.lastActivity },
            ].map(({ key, label, value }) => (
              <Box key={key}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" fontWeight={500}>{label}</Typography>
                  <Typography variant="body2" color="text.secondary">{value} %</Typography>
                </Box>
                <Slider
                  value={value}
                  onChange={(_, v) => setWeights((prev) => ({ ...prev, [key]: v as number }))}
                  min={0}
                  max={100}
                  valueLabelDisplay="auto"
                  sx={{ color: tokens.colors.brandTeal }}
                />
              </Box>
            ))}
            <Alert severity={totalWeight !== 100 ? 'info' : 'success'} sx={{ borderRadius: tokens.radius.md }}>
              Total : {totalWeight} % {totalWeight !== 100 && '(recommandé : 100 %)'}
            </Alert>
          </Stack>
        </SettingsCard>

        <SettingsCard
          icon={<AutoAwesomeIcon />}
          title="Analyse des clients passés"
          subtitle="L'IA analyse les entreprises avec lesquelles vous avez travaillé pour adapter la notation"
          gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={analyzing ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
              onClick={handleAnalyzePastClients}
              disabled={analyzing}
              sx={{
                borderRadius: tokens.radius.md,
                textTransform: 'none',
                fontWeight: 600,
                alignSelf: 'flex-start',
                px: 2.5,
              }}
            >
              {analyzing ? 'Analyse en cours...' : 'Analyser mes clients passés'}
            </Button>
            {settings?.analyzedClientProfile && (
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: tokens.radius.md,
                  bgcolor: alpha(theme.palette.success.main, 0.06),
                  borderColor: alpha(theme.palette.success.main, 0.3),
                }}
              >
                <Box sx={{ mb: 1 }}>
                  <Typography component="span" variant="subtitle2" fontWeight={600} color="text.secondary">
                    Profil analysé
                  </Typography>
                  {settings.analyzedAt && (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      ({settings.analyzedAt instanceof Date
                        ? settings.analyzedAt.toLocaleDateString('fr-FR')
                        : (settings.analyzedAt as any)?.toDate?.()?.toLocaleDateString('fr-FR') ?? ''})
                    </Typography>
                  )}
                </Box>
                {settings.analyzedClientProfile.summary && (
                  <Typography variant="body2" sx={{ mb: 1.5 }}>{settings.analyzedClientProfile.summary}</Typography>
                )}
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {settings.analyzedClientProfile.sectors?.length > 0 && (
                    <Chip size="small" label={`Secteurs: ${settings.analyzedClientProfile.sectors.join(', ')}`} sx={{ borderRadius: tokens.radius.sm }} />
                  )}
                  {settings.analyzedClientProfile.companySizes?.length > 0 && (
                    <Chip size="small" label={`Tailles: ${settings.analyzedClientProfile.companySizes.join(', ')}`} sx={{ borderRadius: tokens.radius.sm }} />
                  )}
                  {settings.analyzedClientProfile.missionTypes?.length > 0 && (
                    <Chip size="small" label={`Types: ${settings.analyzedClientProfile.missionTypes.join(', ')}`} sx={{ borderRadius: tokens.radius.sm }} />
                  )}
                </Stack>
              </Paper>
            )}
          </Box>
        </SettingsCard>

        <SettingsCard
          icon={<EmailIcon />}
          title="Template de message de contact"
          subtitle="Modèle utilisé par l'IA pour rédiger des messages personnalisés (email/LinkedIn). Variables : {{nom}}, {{entreprise}}, {{secteur}}, {{structure_nom}}. Signature remplacée auto : [Votre Nom], [Votre Poste], [Votre Poste - Nom structure]."
          gradient={tokens.gradients.brand}
        >
          <TextField
            fullWidth
            multiline
            minRows={4}
            maxRows={12}
            placeholder="Exemple : Bonjour {{nom}}, nous avons remarqué que {{entreprise}} ({{secteur}}) pourrait bénéficier de..."
            value={settings?.contactMessageTemplate ?? ''}
            onChange={(e) => setSettings((prev) => prev ? { ...prev, contactMessageTemplate: e.target.value } : createDefaultSettings({ contactMessageTemplate: e.target.value }))}
            sx={{
              '& .MuiOutlinedInput-root': { borderRadius: tokens.radius.md, bgcolor: alpha(theme.palette.primary.main, 0.02) },
            }}
          />
        </SettingsCard>

        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            borderRadius: tokens.radius.lg,
            border: '1px solid #e5e5ea',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>Recalculer les scores</Typography>
            <Typography variant="body2" color="text.secondary">
              Met à jour le score IA de tous vos prospects selon les critères actuels.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={recomputing ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
            onClick={handleRecomputeScores}
            disabled={recomputing}
            sx={{ borderRadius: tokens.radius.md, textTransform: 'none', fontWeight: 600 }}
          >
            {recomputing ? 'Recalcul...' : 'Recalculer les scores'}
          </Button>
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : null}
            sx={{ borderRadius: tokens.radius.md, textTransform: 'none', fontWeight: 600, px: 3 }}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
};

export default ScoringSettings;
