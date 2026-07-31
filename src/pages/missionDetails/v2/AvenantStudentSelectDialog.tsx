import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Description as TemplateIcon,
  Info as InfoIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { tokens } from '../../../theme/tokens';
import UserReferenceText from '../../../components/common/UserReferenceText';
import UserAvatarInitials from '../../../components/common/UserAvatarInitials';
import { CandidateStatusPill } from '../../../components/ds/missionDetailsV2/MissionDetailsV2Primitives';

export interface AvenantApplicationOption {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName?: string;
  status: string;
}

export interface AvenantTemplateOption {
  id: string;
  name: string;
}

export interface AvenantTemplateTag {
  tag: string;
  label: string;
  category: string;
  value: string;
  isMissing: boolean;
}

export type AvenantDialogStep = 'setup' | 'review';

const AMENDMENT_NEW_HOURS_TAG = 'amendment_new_hours';
const AMENDMENT_NEW_HOURS_ALIASES = new Set([
  AMENDMENT_NEW_HOURS_TAG,
  'amendment_actual_hours',
  'actualHours',
]);

interface AvenantStudentSelectDialogProps {
  open: boolean;
  step: AvenantDialogStep;
  applications: AvenantApplicationOption[];
  templateName?: string | null;
  templateId?: string | null;
  templateOptions?: AvenantTemplateOption[];
  templateLoading?: boolean;
  templateSaving?: boolean;
  templateMissing?: boolean;
  canChangeTemplate?: boolean;
  generating?: boolean;
  checkingMissing?: boolean;
  templateTags?: AvenantTemplateTag[];
  tempData?: Record<string, string>;
  onClose: () => void;
  onContinue: (applicationId: string) => void;
  onGenerate: () => void;
  onBack: () => void;
  onRefreshMissing: () => void;
  onTemplateChange?: (templateId: string) => void;
  onTempDataChange?: (tag: string, value: string) => void;
  onSaveMissingField?: (tag: string, value: string) => void;
}

export const AvenantStudentSelectDialog: React.FC<AvenantStudentSelectDialogProps> = ({
  open,
  step,
  applications,
  templateName,
  templateId,
  templateOptions = [],
  templateLoading,
  templateSaving,
  templateMissing,
  canChangeTemplate = true,
  generating,
  checkingMissing,
  templateTags = [],
  tempData = {},
  onClose,
  onContinue,
  onGenerate,
  onBack,
  onRefreshMissing,
  onTemplateChange,
  onTempDataChange,
  onSaveMissingField,
}) => {
  const [selectedId, setSelectedId] = useState('');

  const acceptedCandidates = useMemo(
    () => applications.filter((app) => app.status === 'Acceptée'),
    [applications]
  );

  const candidates = acceptedCandidates.length > 0 ? acceptedCandidates : applications;
  const onlyAcceptedShown = acceptedCandidates.length > 0;

  const hasTemplateChoices = templateOptions.length > 0;
  const noTemplateSelected = hasTemplateChoices && !templateId;

  const canGenerate = !checkingMissing && !generating;

  useEffect(() => {
    if (!open) {
      setSelectedId('');
      return;
    }
    if (step === 'setup' && candidates.length === 1) {
      setSelectedId(candidates[0].id);
    }
  }, [open, step, candidates]);

  const selectedCandidate = candidates.find((c) => c.id === selectedId);

  const missingCount = useMemo(
    () => templateTags.filter((item) => item.isMissing).length,
    [templateTags]
  );

  const tagsByCategory = useMemo(
    () =>
      templateTags
        .filter((item) => !AMENDMENT_NEW_HOURS_ALIASES.has(item.tag))
        .reduce<Record<string, AvenantTemplateTag[]>>((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
      }, {}),
    [templateTags]
  );

  const newHoursTagItem = useMemo(
    () =>
      templateTags.find((item) => AMENDMENT_NEW_HOURS_ALIASES.has(item.tag)) ??
      ({
        tag: AMENDMENT_NEW_HOURS_TAG,
        label: 'Total des heures finalement travaillées',
        category: 'Avenant',
        value: '',
        isMissing: true,
      } as AvenantTemplateTag),
    [templateTags]
  );

  const getNewHoursDisplay = () =>
    tempData[AMENDMENT_NEW_HOURS_TAG] ??
    tempData.amendment_actual_hours ??
    tempData.actualHours ??
    newHoursTagItem.value ??
    '';

  const canSaveNewHours = () => {
    const display = getNewHoursDisplay().trim();
    if (!display) return false;
    return display !== (newHoursTagItem.value || '').trim();
  };

  const getDisplayValue = (item: AvenantTemplateTag) =>
    tempData[item.tag] !== undefined ? tempData[item.tag] : item.value || '';

  const canSaveField = (item: AvenantTemplateTag) => {
    const display = getDisplayValue(item).trim();
    if (!display) return false;
    return display !== (item.value || '').trim();
  };

  const setupBlocked =
    !selectedId ||
    templateMissing ||
    !templateId ||
    templateLoading ||
    templateSaving ||
    candidates.length === 0;

  return (
    <Dialog
      open={open}
      onClose={generating || checkingMissing ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: tokens.colors.gray900 }}>
          Créer un avenant
        </Typography>
        <Typography sx={{ fontSize: 13, color: tokens.colors.gray500, mt: 0.5, fontWeight: 400 }}>
          {step === 'setup'
            ? 'Étape 1 — Choisissez le template et l\'étudiant concerné.'
            : 'Étape 2 — Vérifiez que toutes les balises du template peuvent être remplies.'}
        </Typography>
        <Stepper activeStep={step === 'setup' ? 0 : 1} sx={{ mt: 2 }}>
          <Step completed={step === 'review'}>
            <StepLabel>Configuration</StepLabel>
          </Step>
          <Step>
            <StepLabel>Vérification & génération</StepLabel>
          </Step>
        </Stepper>
      </DialogTitle>

      <DialogContent sx={{ pt: 1, flex: '1 1 auto', overflowY: 'auto', position: 'relative' }}>
        {generating && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              px: 3,
              bgcolor: 'rgba(255,255,255,0.92)',
              borderRadius: '8px',
            }}
          >
            <CircularProgress size={40} sx={{ color: '#f59e0b' }} />
            <Typography sx={{ fontSize: 16, fontWeight: 600, color: tokens.colors.gray900, textAlign: 'center' }}>
              Génération de l&apos;avenant en cours…
            </Typography>
            <Typography sx={{ fontSize: 13, color: tokens.colors.gray500, textAlign: 'center' }}>
              Préparation du PDF et téléchargement — merci de patienter quelques instants.
            </Typography>
            <LinearProgress sx={{ width: '100%', maxWidth: 280, mt: 1 }} />
          </Box>
        )}
        {step === 'setup' ? (
          <>
            <Box
              sx={{
                p: 1.5,
                mb: 2.5,
                borderRadius: '10px',
                bgcolor: '#fffbeb',
                border: '1px solid #fde68a',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <TemplateIcon sx={{ fontSize: 20, color: '#d97706', mt: 0.5 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#92400e', textTransform: 'uppercase', mb: 1 }}>
                    Template PDF
                  </Typography>

                  {templateLoading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={14} />
                      <Typography sx={{ fontSize: 13, color: tokens.colors.gray600 }}>Chargement des templates…</Typography>
                    </Box>
                  ) : templateMissing || !hasTemplateChoices ? (
                    <Box>
                      <Typography sx={{ fontSize: 13, color: '#b45309', mb: 1 }}>
                        Aucun template « Avenant » disponible pour votre structure.
                      </Typography>
                      <Link
                        component={RouterLink}
                        to="/app/settings/template-assignment"
                        sx={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                      >
                        Assigner un template
                        <OpenInNewIcon sx={{ fontSize: 14 }} />
                      </Link>
                    </Box>
                  ) : canChangeTemplate && onTemplateChange ? (
                    <FormControl fullWidth size="small" disabled={templateSaving || generating}>
                      <InputLabel id="avenant-template-select-label">Choisir un template</InputLabel>
                      <Select
                        labelId="avenant-template-select-label"
                        label="Choisir un template"
                        value={templateId || ''}
                        onChange={(e) => onTemplateChange(e.target.value)}
                        sx={{
                          bgcolor: tokens.colors.bgPaper,
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#fde68a' },
                        }}
                      >
                        {templateOptions.map((opt) => (
                          <MenuItem key={opt.id} value={opt.id}>
                            {opt.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.colors.gray900 }}>
                      {templateName || 'Template avenant'}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>

            {(templateMissing || noTemplateSelected) && !templateLoading && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {templateMissing
                  ? 'La génération nécessite un template assigné pour le type « Avenant ».'
                  : 'Sélectionnez un template PDF avant de continuer.'}
              </Alert>
            )}

            {!onlyAcceptedShown && applications.length > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Aucune candidature acceptée — tous les candidats de la mission sont listés ci-dessous.
              </Alert>
            )}

            {candidates.length === 0 ? (
              <Box
                sx={{
                  py: 4,
                  px: 2,
                  textAlign: 'center',
                  borderRadius: '10px',
                  bgcolor: tokens.colors.gray50,
                  border: `1px dashed ${tokens.colors.gray200}`,
                }}
              >
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.colors.gray700 }}>
                  Aucun candidat disponible
                </Typography>
              </Box>
            ) : (
              <>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.colors.gray600, mb: 1 }}>
                  Étudiant concerné
                </Typography>
                <RadioGroup value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                  {candidates.map((app) => (
                    <Box
                      key={app.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.25,
                        mb: 0.75,
                        borderRadius: '10px',
                        border: `1px solid ${selectedId === app.id ? tokens.colors.brandTeal : tokens.colors.gray200}`,
                        bgcolor: selectedId === app.id ? '#f0fdfa' : tokens.colors.bgPaper,
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedId(app.id)}
                    >
                      <FormControlLabel
                        value={app.id}
                        control={<Radio size="small" sx={{ p: 0.5 }} />}
                        label=""
                        sx={{ m: 0 }}
                      />
                      <Avatar sx={{ width: 36, height: 36, bgcolor: tokens.colors.brandNavy }}>
                        <UserAvatarInitials user={{ id: app.userId, displayName: app.userDisplayName }} />
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <UserReferenceText
                          userId={app.userId}
                          name={app.userDisplayName}
                          fallback={app.userEmail.split('@')[0]}
                          sx={{ fontSize: 14, fontWeight: 600 }}
                        />
                        <Typography sx={{ fontSize: 12, color: tokens.colors.gray500 }} noWrap>
                          {app.userEmail}
                        </Typography>
                      </Box>
                      <CandidateStatusPill status={app.status} />
                    </Box>
                  ))}
                </RadioGroup>
              </>
            )}
          </>
        ) : (
          <>
            {selectedCandidate && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Template : <strong>{templateName || 'Avenant'}</strong>
                {' · '}
                Étudiant :{' '}
                <strong>{selectedCandidate.userDisplayName || selectedCandidate.userEmail}</strong>
              </Alert>
            )}

            {checkingMissing ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 5, gap: 2 }}>
                <CircularProgress size={32} />
                <Typography sx={{ fontSize: 14, color: tokens.colors.gray600 }}>
                  Analyse des balises du template…
                </Typography>
              </Box>
            ) : templateTags.length === 0 ? (
              <Alert severity="info" sx={{ mb: 1 }}>
                Aucune balise détectée dans ce template.
              </Alert>
            ) : (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.colors.gray800 }}>
                    {templateTags.length} balise{templateTags.length > 1 ? 's' : ''}
                    {missingCount > 0 && (
                      <Typography component="span" sx={{ fontSize: 13, fontWeight: 500, color: '#b45309', ml: 0.5 }}>
                        · {missingCount} sans valeur
                      </Typography>
                    )}
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={onRefreshMissing}
                    sx={{ textTransform: 'none' }}
                  >
                    Actualiser
                  </Button>
                </Box>

                <Typography sx={{ fontSize: 12, color: tokens.colors.gray500, mb: 2 }}>
                  Modifiez les valeurs avant génération, ou enregistrez-les en base (icône disquette).
                </Typography>

                <Box
                  sx={{
                    p: 2,
                    mb: 2.5,
                    borderRadius: '10px',
                    bgcolor: '#fffbeb',
                    border: '1px solid #fde68a',
                  }}
                >
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: tokens.colors.gray900, mb: 1.5 }}>
                    Total des heures finalement travaillées
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <TextField
                      size="small"
                      type="number"
                      inputProps={{ min: 0, step: 0.5 }}
                      placeholder="Ex. 130"
                      value={getNewHoursDisplay()}
                      onChange={(e) => onTempDataChange?.(AMENDMENT_NEW_HOURS_TAG, e.target.value)}
                      InputProps={{
                        endAdornment: (
                          <Typography sx={{ fontSize: 13, color: tokens.colors.gray500, pr: 0.5 }}>h</Typography>
                        ),
                      }}
                      sx={{ flex: 1, bgcolor: tokens.colors.bgPaper }}
                    />
                    {canSaveNewHours() && onSaveMissingField && (
                      <IconButton
                        size="small"
                        color="success"
                        title="Enregistrer (sans recharger la liste)"
                        onClick={() =>
                          onSaveMissingField(AMENDMENT_NEW_HOURS_TAG, getNewHoursDisplay())
                        }
                        sx={{ mt: 0.25 }}
                      >
                        <SaveIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                  {newHoursTagItem.isMissing && !getNewHoursDisplay().trim() && (
                    <Typography sx={{ fontSize: 11, color: '#b45309', mt: 1 }}>
                      Saisissez le total ou renseignez les créneaux horaires sur la fiche mission.
                    </Typography>
                  )}
                </Box>

                <Box>
                  {Object.entries(tagsByCategory).map(([category, items]) => (
                    <Box key={category} sx={{ mb: 2 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.colors.brandTeal, mb: 0.75 }}>
                        {category}
                      </Typography>
                      <List dense disablePadding>
                        {items.map((item) => (
                          <ListItem
                            key={item.tag}
                            sx={{
                              py: 1,
                              px: 1.25,
                              mb: 0.75,
                              borderRadius: '8px',
                              bgcolor: item.isMissing ? '#fffbeb' : tokens.colors.gray50,
                              border: item.isMissing ? '1px solid #fde68a' : `1px solid ${tokens.colors.gray200}`,
                              alignItems: 'flex-start',
                              flexDirection: 'column',
                              gap: 1,
                            }}
                          >
                            <Box sx={{ display: 'flex', width: '100%', gap: 1 }}>
                              <ListItemIcon sx={{ minWidth: 28, mt: 0.25 }}>
                                {item.isMissing ? (
                                  <InfoIcon color="warning" fontSize="small" />
                                ) : (
                                  <CheckCircleIcon color="success" fontSize="small" />
                                )}
                              </ListItemIcon>
                              <ListItemText
                                primary={item.label}
                                secondary={`<${item.tag}>`}
                                primaryTypographyProps={{ fontSize: 13, fontWeight: 500 }}
                                secondaryTypographyProps={{ fontSize: 11, fontFamily: 'monospace' }}
                              />
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1, width: '100%', pl: 4.5 }}>
                              <TextField
                                size="small"
                                fullWidth
                                placeholder={item.isMissing ? `Saisir ${item.label.toLowerCase()}` : item.label}
                                value={getDisplayValue(item)}
                                onChange={(e) => onTempDataChange?.(item.tag, e.target.value)}
                              />
                              {canSaveField(item) && onSaveMissingField && (
                                <IconButton
                                  size="small"
                                  color="success"
                                  title="Enregistrer (sans recharger la liste)"
                                  onClick={() => onSaveMissingField(item.tag, getDisplayValue(item))}
                                >
                                  <SaveIcon fontSize="small" />
                                </IconButton>
                              )}
                            </Box>
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, gap: 1 }}>
        {step === 'review' && (
          <Button onClick={onBack} disabled={generating || checkingMissing} sx={{ textTransform: 'none', mr: 'auto' }}>
            Retour
          </Button>
        )}
        <Button onClick={onClose} disabled={generating || checkingMissing} sx={{ textTransform: 'none' }}>
          Annuler
        </Button>
        {step === 'setup' ? (
          <Button
            variant="contained"
            onClick={() => selectedId && onContinue(selectedId)}
            disabled={setupBlocked || checkingMissing || generating}
            sx={{
              textTransform: 'none',
              bgcolor: tokens.colors.brandTeal,
              '&:hover': { bgcolor: tokens.colors.brandTeal, filter: 'brightness(0.92)' },
            }}
          >
            Vérifier les données
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={onGenerate}
            disabled={!canGenerate}
            sx={{
              textTransform: 'none',
              bgcolor: '#f59e0b',
              '&:hover': { bgcolor: '#d97706' },
            }}
          >
            {generating ? 'Génération en cours…' : 'Générer l\'avenant'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
