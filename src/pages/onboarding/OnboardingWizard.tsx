import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase/config';
import { updateStructureOnboardingStatus } from '../../firebase/structure';
import { useStructure, invalidateStructureCache } from '../../hooks/useStructure';
import { useSpreadsheetImportPreview } from '../../hooks/useSpreadsheetImportPreview';
import {
  IMPORT_SPREADSHEET_ACCEPT,
  parseImportSpreadsheet,
} from '../../utils/parseImportSpreadsheet';
import {
  getFirebaseErrorMessage,
  isFunctionsResourceExhausted,
} from '../../utils/firebaseErrors';

type TeamMemberDraft = { email: string; role: string };
type CompanyDraft = { name: string };

type BulkImportReport = {
  teamInvited: number;
  companiesCreated: number;
  companiesMatched: number;
  missionsCreated: number;
  etudesCreated: number;
  errors: { row: number; entity: string; message: string }[];
};

const STEPS = ['Équipe', 'Entreprises', 'Missions & études', 'Récapitulatif'] as const;

const TEAM_ROLES = [
  { value: 'membre', label: 'Membre' },
  { value: 'admin', label: 'Admin' },
  { value: 'admin_structure', label: 'Admin structure' },
];

function pickField(row: Record<string, unknown>, keys: string[]): string {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  const entries = Object.entries(row);
  for (const key of keys) {
    const want = normalize(key);
    for (const [header, value] of entries) {
      if (normalize(header) === want || normalize(header).includes(want)) {
        const str = String(value ?? '').trim();
        if (str) return str;
      }
    }
  }
  return '';
}

function mapTeamRows(rows: Record<string, unknown>[]): TeamMemberDraft[] {
  return rows
    .map((row) => ({
      email: pickField(row, ['email', 'mail', 'e-mail', 'courriel']),
      role: pickField(row, ['role', 'rôle', 'statut', 'status']) || 'membre',
    }))
    .filter((r) => r.email.includes('@'));
}

function mapCompanyRows(rows: Record<string, unknown>[]): CompanyDraft[] {
  return rows
    .map((row) => ({
      name: pickField(row, ['name', 'nom', 'entreprise', 'company', 'client']),
    }))
    .filter((r) => r.name.length > 0);
}

export default function OnboardingWizard(): JSX.Element {
  const navigate = useNavigate();
  const { currentUser, userData } = useAuth();
  const structureId = userData?.structureId || null;
  const { structure, loading: structureLoading } = useStructure(structureId);
  const structureType = (structure?.structureType || 'junior') as 'junior' | 'jobservice';

  const [activeStep, setActiveStep] = useState(0);
  const [teamMembers, setTeamMembers] = useState<TeamMemberDraft[]>([]);
  const [companies, setCompanies] = useState<CompanyDraft[]>([]);
  const [missionsPayload, setMissionsPayload] = useState<Record<string, unknown>[]>([]);
  const [matchUsers, setMatchUsers] = useState<any[]>([]);
  const [matchCompanies, setMatchCompanies] = useState<any[]>([]);
  const [matchContacts, setMatchContacts] = useState<any[]>([]);
  const [matchMissionTypes, setMatchMissionTypes] = useState<any[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [report, setReport] = useState<BulkImportReport | null>(null);
  const [quotaMessage, setQuotaMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handlePreviewError = useCallback((message: string) => {
    setFileError(message);
  }, []);

  const matchContext = useMemo(
    () => ({
      users: matchUsers,
      companies: matchCompanies,
      contacts: matchContacts,
      missionTypes: matchMissionTypes,
    }),
    [matchUsers, matchCompanies, matchContacts, matchMissionTypes]
  );

  const {
    importedData,
    processingAI,
    validationErrors,
    duplicateHints,
    processRawRows,
    resetPreview,
    importType,
  } = useSpreadsheetImportPreview({
    structureId,
    structureType,
    matchContext,
    currentUserId: currentUser?.uid,
    fallbackChargeUser: userData,
    onError: handlePreviewError,
  });

  useEffect(() => {
    if (!structureId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [usersSnap, companiesSnap, contactsSnap, typesSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('structureId', '==', structureId))),
          getDocs(query(collection(db, 'companies'), where('structureId', '==', structureId))),
          getDocs(query(collection(db, 'contacts'), where('structureId', '==', structureId))),
          getDocs(query(collection(db, 'mission_types'), where('structureId', '==', structureId))),
        ]);
        if (cancelled) return;
        setMatchUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setMatchCompanies(companiesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setMatchContacts(contactsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setMatchMissionTypes(typesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.warn('Onboarding match context load failed:', err);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [structureId]);

  useEffect(() => {
    if (activeStep === 2 && importedData.length > 0) {
      setMissionsPayload(importedData);
    }
  }, [activeStep, importedData]);

  const hasAnyImportData =
    teamMembers.some((m) => m.email.includes('@')) ||
    companies.length > 0 ||
    missionsPayload.length > 0;

  const completeOnboarding = async (status: 'completed' | 'skipped') => {
    if (!structureId) return;
    await updateStructureOnboardingStatus(structureId, status);
    invalidateStructureCache(structureId);
  };

  const finishLater = async () => {
    if (!structureId || finishing) return;
    setFinishing(true);
    try {
      await completeOnboarding('skipped');
      navigate('/app', { replace: true });
    } catch (err) {
      console.error(err);
      setSubmitError('Impossible de mettre à jour le statut d’onboarding.');
      setFinishing(false);
    }
  };

  const skipStep = () => {
    if (activeStep === 2) {
      resetPreview();
      setMissionsPayload([]);
    }
    if (activeStep >= STEPS.length - 1) return;
    setActiveStep(activeStep + 1);
    setFileError(null);
  };

  const goNextFromTeam = () => setActiveStep(1);
  const goNextFromCompanies = () => setActiveStep(2);
  const goNextFromMissions = () => {
    setMissionsPayload(importedData);
    setActiveStep(3);
  };

  const onTeamFile = async (file: File) => {
    setFileError(null);
    try {
      const rows = await parseImportSpreadsheet(file);
      const mapped = mapTeamRows(rows);
      if (!mapped.length) {
        setFileError('Aucune ligne email valide trouvée dans le fichier.');
        return;
      }
      setTeamMembers((prev) => [...prev, ...mapped]);
    } catch {
      setFileError('Impossible de lire le fichier.');
    }
  };

  const onCompaniesFile = async (file: File) => {
    setFileError(null);
    try {
      const rows = await parseImportSpreadsheet(file);
      const mapped = mapCompanyRows(rows);
      if (!mapped.length) {
        setFileError('Aucune entreprise trouvée (colonne name/nom/entreprise).');
        return;
      }
      setCompanies((prev) => {
        const seen = new Set(prev.map((c) => c.name.toLowerCase()));
        const next = [...prev];
        for (const c of mapped) {
          if (!seen.has(c.name.toLowerCase())) {
            seen.add(c.name.toLowerCase());
            next.push(c);
          }
        }
        return next;
      });
    } catch {
      setFileError('Impossible de lire le fichier.');
    }
  };

  const onMissionsFile = async (file: File) => {
    setFileError(null);
    try {
      const rows = await parseImportSpreadsheet(file);
      await processRawRows(rows);
    } catch {
      setFileError('Impossible de lire le fichier.');
    }
  };

  const runFinalImport = async () => {
    if (!structureId || submitting) return;

    // Skip all without data → skipped
    if (!hasAnyImportData) {
      setFinishing(true);
      try {
        await completeOnboarding('skipped');
        navigate('/app', { replace: true });
      } catch (err) {
        console.error(err);
        setSubmitError('Impossible de finaliser l’onboarding.');
        setFinishing(false);
      }
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setQuotaMessage(null);
    setReport(null);

    try {
      const functions = getFunctions();
      const runImport = httpsCallable<
        {
          structureId: string;
          teamMembers?: TeamMemberDraft[];
          companies?: CompanyDraft[];
          missions?: Record<string, unknown>[];
          etudes?: Record<string, unknown>[];
        },
        BulkImportReport
      >(functions, 'runOnboardingBulkImport');

      const payload: {
        structureId: string;
        teamMembers?: TeamMemberDraft[];
        companies?: CompanyDraft[];
        missions?: Record<string, unknown>[];
        etudes?: Record<string, unknown>[];
      } = { structureId };

      const validTeam = teamMembers.filter((m) => m.email.includes('@'));
      if (validTeam.length) payload.teamMembers = validTeam;
      if (companies.length) payload.companies = companies;
      if (missionsPayload.length) {
        if (structureType === 'junior') payload.etudes = missionsPayload;
        else payload.missions = missionsPayload;
      }

      const { data } = await runImport(payload);
      setReport(data);
      await completeOnboarding('completed');
    } catch (err: unknown) {
      if (isFunctionsResourceExhausted(err)) {
        const msg =
          getFirebaseErrorMessage(err) ||
          'Quota d’imports d’onboarding atteint. Vous pourrez réessayer plus tard depuis le tableau de bord.';
        setQuotaMessage(msg);
        try {
          await completeOnboarding('completed');
        } catch (statusErr) {
          console.error(statusErr);
        }
      } else {
        setSubmitError(
          getFirebaseErrorMessage(err) || 'Erreur lors de l’import. Réessayez ou terminez sans import.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const goToApp = () => navigate('/app', { replace: true });

  const teamDropzone = useDropzone({
    accept: IMPORT_SPREADSHEET_ACCEPT,
    multiple: false,
    onDrop: (files) => {
      if (files[0]) void onTeamFile(files[0]);
    },
  });
  const companiesDropzone = useDropzone({
    accept: IMPORT_SPREADSHEET_ACCEPT,
    multiple: false,
    onDrop: (files) => {
      if (files[0]) void onCompaniesFile(files[0]);
    },
  });
  const missionsDropzone = useDropzone({
    accept: IMPORT_SPREADSHEET_ACCEPT,
    multiple: false,
    onDrop: (files) => {
      if (files[0]) void onMissionsFile(files[0]);
    },
  });

  if (structureLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!structureId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Aucune structure associée à votre compte.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 2, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Bienvenue — importez vos données
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Parcours optionnel pour inviter l’équipe et importer entreprises, missions ou études.
          </Typography>
        </Box>
        <Button variant="text" onClick={() => void finishLater()} disabled={finishing || submitting}>
          Terminer plus tard
        </Button>
      </Stack>

      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {fileError && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setFileError(null)}>
          {fileError}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        {activeStep === 0 && (
          <Stack spacing={2}>
            <Typography variant="subtitle1" fontWeight={600}>
              Invitez les membres de votre équipe
            </Typography>
            {teamMembers.map((member, index) => (
              <Stack key={index} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
                <TextField
                  label="Email"
                  size="small"
                  fullWidth
                  value={member.email}
                  onChange={(e) => {
                    const next = [...teamMembers];
                    next[index] = { ...next[index], email: e.target.value };
                    setTeamMembers(next);
                  }}
                />
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Rôle</InputLabel>
                  <Select
                    label="Rôle"
                    value={member.role}
                    onChange={(e) => {
                      const next = [...teamMembers];
                      next[index] = { ...next[index], role: e.target.value };
                      setTeamMembers(next);
                    }}
                  >
                    {TEAM_ROLES.map((r) => (
                      <MenuItem key={r.value} value={r.value}>
                        {r.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <IconButton
                  aria-label="Supprimer"
                  onClick={() => setTeamMembers((prev) => prev.filter((_, i) => i !== index))}
                >
                  <DeleteIcon />
                </IconButton>
              </Stack>
            ))}
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                startIcon={<AddIcon />}
                onClick={() => setTeamMembers((prev) => [...prev, { email: '', role: 'membre' }])}
              >
                Ajouter une ligne
              </Button>
              <Button
                startIcon={<CloudUploadIcon />}
                variant="outlined"
                {...teamDropzone.getRootProps()}
              >
                <input {...teamDropzone.getInputProps()} />
                Importer un fichier
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button onClick={() => void skipStep()}>Passer cette étape</Button>
              <Button variant="contained" onClick={goNextFromTeam}>
                Continuer
              </Button>
            </Stack>
          </Stack>
        )}

        {activeStep === 1 && (
          <Stack spacing={2}>
            <Typography variant="subtitle1" fontWeight={600}>
              Entreprises clientes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Importez un fichier CSV/Excel avec une colonne name, nom ou entreprise.
            </Typography>
            <Button
              startIcon={<CloudUploadIcon />}
              variant="outlined"
              {...companiesDropzone.getRootProps()}
              sx={{ alignSelf: 'flex-start' }}
            >
              <input {...companiesDropzone.getInputProps()} />
              Choisir un fichier
            </Button>
            {companies.length > 0 && (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Entreprise</TableCell>
                      <TableCell width={56} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {companies.map((c, i) => (
                      <TableRow key={`${c.name}-${i}`}>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => setCompanies((prev) => prev.filter((_, idx) => idx !== i))}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button onClick={() => setActiveStep(0)}>Retour</Button>
              <Button onClick={() => void skipStep()}>Passer cette étape</Button>
              <Button variant="contained" onClick={goNextFromCompanies}>
                Continuer
              </Button>
            </Stack>
          </Stack>
        )}

        {activeStep === 2 && (
          <Stack spacing={2}>
            <Typography variant="subtitle1" fontWeight={600}>
              {structureType === 'junior' ? 'Études' : 'Missions'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Importez un fichier : mapping et validation avant confirmation (aperçu ci-dessous).
            </Typography>
            <Button
              startIcon={<CloudUploadIcon />}
              variant="outlined"
              disabled={processingAI}
              {...missionsDropzone.getRootProps()}
              sx={{ alignSelf: 'flex-start' }}
            >
              <input {...missionsDropzone.getInputProps()} />
              {processingAI ? 'Analyse en cours…' : 'Choisir un fichier'}
            </Button>
            {processingAI && <CircularProgress size={28} />}
            {validationErrors.length > 0 && (
              <Alert severity="warning">
                {validationErrors.length} erreur(s) de validation détectée(s) (aperçu ligne par ligne
                ci-dessous).
              </Alert>
            )}
            {duplicateHints.length > 0 && (
              <Alert severity="info">{duplicateHints.length} doublon(s) potentiel(s) détecté(s).</Alert>
            )}
            {importedData.length > 0 && (
              <TableContainer sx={{ maxHeight: 320 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Entreprise</TableCell>
                      <TableCell>{importType === 'etude' ? 'N° étude' : 'Titre'}</TableCell>
                      <TableCell>Erreurs</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importedData.slice(0, 50).map((row, i) => {
                      const rowErrors = validationErrors
                        .filter((e) => e.rowIndex === i)
                        .map((e) => e.message)
                        .join('; ');
                      return (
                        <TableRow key={i}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell>{String(row.company || '—')}</TableCell>
                          <TableCell>
                            {String(
                              importType === 'etude'
                                ? row.numeroEtude || '—'
                                : row.title || row.numeroMission || '—'
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="error">
                              {rowErrors || '—'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button onClick={() => setActiveStep(1)}>Retour</Button>
              <Button
                onClick={() => {
                  resetPreview();
                  setMissionsPayload([]);
                  setActiveStep(3);
                }}
              >
                Passer cette étape
              </Button>
              <Button variant="contained" onClick={goNextFromMissions} disabled={processingAI}>
                Continuer
              </Button>
            </Stack>
          </Stack>
        )}

        {activeStep === 3 && (
          <Stack spacing={2}>
            <Typography variant="subtitle1" fontWeight={600}>
              Récapitulatif
            </Typography>
            <Typography variant="body2">
              Membres à inviter : <strong>{teamMembers.filter((m) => m.email.includes('@')).length}</strong>
            </Typography>
            <Typography variant="body2">
              Entreprises : <strong>{companies.length}</strong>
            </Typography>
            <Typography variant="body2">
              {structureType === 'junior' ? 'Études' : 'Missions'} :{' '}
              <strong>{missionsPayload.length}</strong>
            </Typography>

            {quotaMessage && <Alert severity="warning">{quotaMessage}</Alert>}
            {submitError && <Alert severity="error">{submitError}</Alert>}

            {report && (
              <Alert severity="success">
                Import terminé — invitations : {report.teamInvited}, entreprises créées :{' '}
                {report.companiesCreated}, matchées : {report.companiesMatched},{' '}
                {structureType === 'junior' ? 'études' : 'missions'} :{' '}
                {structureType === 'junior' ? report.etudesCreated : report.missionsCreated}.
                {report.errors.length > 0 && (
                  <>
                    <br />
                    {report.errors.length} erreur(s) ligne :
                    <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                      {report.errors.slice(0, 20).map((e, i) => (
                        <li key={i}>
                          [{e.entity} #{e.row}] {e.message}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Alert>
            )}

            <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
              {!report && !quotaMessage && (
                <>
                  <Button onClick={() => setActiveStep(2)} disabled={submitting}>
                    Retour
                  </Button>
                  <Button onClick={() => void finishLater()} disabled={submitting || finishing}>
                    Terminer plus tard
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => void runFinalImport()}
                    disabled={submitting}
                    startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
                  >
                    {hasAnyImportData ? 'Lancer l’import' : 'Terminer sans import'}
                  </Button>
                </>
              )}
              {(report || quotaMessage) && (
                <Button variant="contained" onClick={goToApp}>
                  Accéder à l’application
                </Button>
              )}
              {submitError && !report && (
                <Button
                  variant="outlined"
                  disabled={finishing}
                  onClick={async () => {
                    setFinishing(true);
                    try {
                      await completeOnboarding('completed');
                      navigate('/app', { replace: true });
                    } catch {
                      setFinishing(false);
                    }
                  }}
                >
                  Terminer sans import
                </Button>
              )}
            </Stack>
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
