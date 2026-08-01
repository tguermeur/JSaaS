import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  TextField,
  Chip,
  Avatar,
  LinearProgress,
  FormControlLabel,
  Checkbox,
  IconButton,
  Link,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  CheckCircle as CheckCircleIcon,
  Business as BusinessIcon,
  Description as DescriptionIcon,
  NoteAdd as NoteAddIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { usePermission } from '../hooks/usePermission';
import AccessDenied from '../components/common/AccessDenied';
import { collection, query, where, orderBy, getDocs, doc, deleteDoc, getDoc, updateDoc, addDoc } from 'firebase/firestore';
import { db, storage, getStorageInstance } from '../firebase/config';
import app, { isStorageAvailable } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useSnackbar } from 'notistack';
import {
  EtudeEtape,
  ETUDE_ETAPE_LABELS,
  ETUDE_ETAPE_ORDER,
  ETUDE_ETAPE_COLORS,
  statusToEtape,
  QualityChecklist,
  Avenant,
} from '../types/etude';
import { getAvenants, updateQualityChecklist } from '../services/etudeService';
import UserReferenceText from '../components/common/UserReferenceText';
import ChargeNameText from '../components/common/ChargeNameText';
import UserAvatarInitials from '../components/common/UserAvatarInitials';
import { getSafeDisplayName } from '../utils/decryptUserUtils';
import { tokens } from '../theme/tokens';
import { AppPageShell, dsTabsSx, KpiCard } from '../components/ds';

interface EtudeData {
  id: string;
  numeroEtude: string;
  company: string;
  companyId?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  consultantCount?: number;
  jeh?: number;
  prixHT?: number;
  status: string;
  etape?: EtudeEtape;
  chargeId: string;
  chargeName: string;
  description?: string;
  structureId?: string;
  isArchived?: boolean;
  qualityChecklist?: QualityChecklist;
  satisfactionScore?: number;
  pricingType?: 'jeh' | 'hourly';
  mandat?: string;
  [key: string]: any;
}

interface EtudeNote {
  id: string;
  content: string;
  etudeId: string;
  createdAt: Date;
  createdBy: string;
  createdByName: string;
  createdByPhotoURL?: string;
  type: 'audit' | 'general';
}

interface GeneratedDocument {
  id: string;
  etudeId?: string;
  missionId?: string;
  structureId: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  createdAt: Date;
  isAudited: boolean;
  auditedAt?: Date;
  auditedBy?: string;
  auditNotes?: string;
  isSigned: boolean;
  signedFileUrl?: string;
}

function TabPanel(props: { children?: React.ReactNode; value: number; index: number }) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const AuditEtudeDetails: React.FC = () => {
  const { etudeNumber } = useParams<{ etudeNumber: string }>();
  const navigate = useNavigate();
  const { canRead, canWrite, loading: permissionLoading } = usePermission('audit');
  const [etude, setEtude] = useState<EtudeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser, userData } = useAuth();
  const [selectedTab, setSelectedTab] = useState(0);
  const [avenants, setAvenants] = useState<Avenant[]>([]);
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [notes, setNotes] = useState<EtudeNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const { enqueueSnackbar } = useSnackbar();

  const userStructureId = userData?.structureId;

  // Charger l'étude (deps stables : uid, pas l'objet currentUser qui change au decrypt)
  useEffect(() => {
    const uid = currentUser?.uid;
    if (!etudeNumber || !uid) return;

    let cancelled = false;

    const fetchEtude = async () => {
      try {
        setLoading(true);
        const etudesRef = collection(db, 'etudes');
        const q = userStructureId
          ? query(etudesRef, where('structureId', '==', userStructureId), where('numeroEtude', '==', etudeNumber))
          : query(etudesRef, where('numeroEtude', '==', etudeNumber));

        const snapshot = await getDocs(q);
        if (cancelled) return;
        if (snapshot.empty) {
          setError('Étude non trouvée');
          return;
        }

        const etudeDoc = snapshot.docs[0];
        const etudeData = { id: etudeDoc.id, ...etudeDoc.data() } as EtudeData;
        setEtude(etudeData);

        try {
          const avs = await getAvenants(etudeDoc.id);
          if (!cancelled) setAvenants(avs);
        } catch {
          if (!cancelled) setAvenants([]);
        }

        try {
          const docsRef = collection(db, 'generatedDocuments');
          const docsQuery = userStructureId
            ? query(docsRef, where('structureId', '==', userStructureId), where('etudeId', '==', etudeDoc.id))
            : query(docsRef, where('etudeId', '==', etudeDoc.id));
          const docsSnapshot = await getDocs(docsQuery);
          if (!cancelled) {
            setDocuments(docsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as GeneratedDocument)));
          }
        } catch {
          if (!cancelled) setDocuments([]);
        }

        try {
          const notesRef = collection(db, 'etudeNotes');
          const notesQuery = query(notesRef, where('etudeId', '==', etudeDoc.id));
          const notesSnapshot = await getDocs(notesQuery);
          if (!cancelled) {
            setNotes(notesSnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as EtudeNote)));
          }
        } catch {
          if (!cancelled) setNotes([]);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Erreur chargement étude audit:', err);
          setError('Erreur lors du chargement');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchEtude();
    return () => {
      cancelled = true;
    };
  }, [etudeNumber, currentUser?.uid, userStructureId]);

  // Marquer un document comme audité
  const handleAuditDocument = async (docId: string) => {
    try {
      await updateDoc(doc(db, 'generatedDocuments', docId), {
        isAudited: true,
        auditedAt: new Date(),
        auditedBy: currentUser?.uid,
      });
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, isAudited: true } : d));
      enqueueSnackbar('Document marqué comme audité', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Erreur lors de l\'audit', { variant: 'error' });
    }
  };

  // Ajouter une note d'audit
  const handleAddNote = async () => {
    if (!newNote.trim() || !etude?.id) return;
    try {
      const noteData = {
        content: newNote,
        etudeId: etude.id,
        etudeNumber: etude.numeroEtude,
        createdAt: new Date(),
        createdBy: currentUser?.uid || '',
        createdByName: getSafeDisplayName(userData),
        createdByPhotoURL: userData?.photoURL || '',
        type: 'audit' as const,
      };
      const docRef = await addDoc(collection(db, 'etudeNotes'), noteData);
      setNotes(prev => [...prev, { id: docRef.id, ...noteData }]);
      setNewNote('');
      enqueueSnackbar('Note ajoutée', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Erreur lors de l\'ajout de la note', { variant: 'error' });
    }
  };

  if (permissionLoading || loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flex: 1,
          minHeight: 0,
          bgcolor: tokens.colors.surfaceAlt,
        }}
      >
        <CircularProgress sx={{ color: tokens.colors.brandTeal }} />
      </Box>
    );
  }

  if (!canRead) return <AccessDenied />;
  if (error) {
    return (
      <AppPageShell eyebrow="Audit" title="Détail étude">
        <Box sx={{ px: 3, py: 3 }}>
          <Alert severity="error" sx={{ borderRadius: tokens.radius.md }}>{error}</Alert>
        </Box>
      </AppPageShell>
    );
  }
  if (!etude) return null;

  const currentEtape: EtudeEtape = etude.etape && ETUDE_ETAPE_ORDER.includes(etude.etape)
    ? etude.etape
    : statusToEtape(etude.status as any);
  const currentEtapeIndex = ETUDE_ETAPE_ORDER.indexOf(currentEtape);

  const qualityChecklist: QualityChecklist = etude.qualityChecklist || {
    conventionSignee: false,
    assuranceVerifiee: false,
    pvRecetteObtenu: false,
    satisfactionEnvoyee: false,
    bvEmis: false,
    facturePayee: false,
    rapportPedagogiqueRedige: false,
  };
  const qualityItems = Object.entries(qualityChecklist);
  const qualityDone = qualityItems.filter(([, v]) => v).length;
  const qualityPercent = Math.round((qualityDone / qualityItems.length) * 100);

  const auditedDocs = documents.filter(d => d.isAudited).length;
  const totalDocs = documents.length;

  return (
    <AppPageShell
      eyebrow={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => navigate('/app/audit')}
            sx={{ color: tokens.colors.gray400, p: 0.25, mr: 0.25 }}
            aria-label="Retour à l'audit"
          >
            <ChevronLeftIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <Typography sx={{ fontSize: 11, color: tokens.colors.gray400 }}>Qualité</Typography>
          <Typography sx={{ fontSize: 11, color: tokens.colors.gray300 }}>/</Typography>
          <Box
            component="button"
            type="button"
            onClick={() => navigate('/app/audit')}
            sx={{
              fontSize: 11,
              color: tokens.colors.gray500,
              border: 'none',
              bgcolor: 'transparent',
              p: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              '&:hover': { color: tokens.colors.gray700 },
            }}
          >
            Audit
          </Box>
          <Typography sx={{ fontSize: 11, color: tokens.colors.gray300 }}>/</Typography>
          <Typography
            sx={{ fontSize: 11, color: tokens.colors.gray900, fontFamily: 'monospace', fontWeight: 500 }}
          >
            {etude.numeroEtude}
          </Typography>
        </Box>
      }
      title={`Étude ${etude.numeroEtude}`}
      subtitle={[etude.company, etude.location].filter(Boolean).join(' · ') || undefined}
      status={{ label: ETUDE_ETAPE_LABELS[currentEtape], color: ETUDE_ETAPE_COLORS[currentEtape] }}
      kpiColumns={3}
      kpiStrip={
        <>
          <KpiCard label="Qualité" value={`${qualityPercent}%`} density="compact" sparkColor={qualityPercent === 100 ? tokens.colors.success : tokens.colors.brandTeal} />
          <KpiCard label="Documents audités" value={`${auditedDocs}/${totalDocs}`} density="compact" />
          <KpiCard label="Avenants" value={avenants.length} density="compact" />
        </>
      }
    >
      <Box sx={{ px: 3, py: 2.5, pb: 4, width: '100%' }}>
      <Paper
        elevation={0}
        sx={{
          borderRadius: tokens.radius.lg,
          overflow: 'hidden',
          border: `1px solid ${tokens.colors.divider}`,
          bgcolor: tokens.colors.bgPaper,
        }}
      >
        <Tabs
          value={selectedTab}
          onChange={(_, v) => setSelectedTab(v)}
          sx={dsTabsSx}
        >
          <Tab label="Informations" icon={<BusinessIcon />} iconPosition="start" />
          <Tab label="Documents" icon={<DescriptionIcon />} iconPosition="start" />
          <Tab label="Checklist qualité" icon={<CheckCircleIcon />} iconPosition="start" />
          <Tab label="Notes d'audit" icon={<NoteAddIcon />} iconPosition="start" />
        </Tabs>

        {/* Tab Informations */}
        <TabPanel value={selectedTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Détails de l'étude</Typography>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Numéro</TableCell>
                    <TableCell>{etude.numeroEtude}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Entreprise</TableCell>
                    <TableCell>{etude.company}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Lieu</TableCell>
                    <TableCell>{etude.location || '-'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Chargé d'études</TableCell>
                    <TableCell>
                      <ChargeNameText chargeId={etude.chargeId} chargeName={etude.chargeName} component="span" variant="body2" />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Dates</TableCell>
                    <TableCell>
                      {etude.startDate ? new Date(etude.startDate).toLocaleDateString('fr-FR') : '-'} → {etude.endDate ? new Date(etude.endDate).toLocaleDateString('fr-FR') : '-'}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Consultants</TableCell>
                    <TableCell>{etude.consultantCount || '-'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>JEH</TableCell>
                    <TableCell>{etude.jeh || '-'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Prix HT</TableCell>
                    <TableCell>{etude.prixHT ? `${etude.prixHT.toLocaleString('fr-FR')}€` : '-'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Mandat</TableCell>
                    <TableCell>{etude.mandat || '-'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Progression</Typography>
              {ETUDE_ETAPE_ORDER.map((etape, index) => {
                const isCurrent = etape === currentEtape;
                const isDone = index < currentEtapeIndex;
                return (
                  <Box
                    key={etape}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      py: 0.75, px: 1.5, borderRadius: 1, mb: 0.5,
                      bgcolor: isCurrent ? 'rgba(102, 126, 234, 0.08)' : 'transparent',
                      borderLeft: `3px solid ${isDone ? '#4CAF50' : isCurrent ? ETUDE_ETAPE_COLORS[etape] : '#e0e0e0'}`,
                    }}
                  >
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: isDone ? '#4CAF50' : isCurrent ? ETUDE_ETAPE_COLORS[etape] : '#e0e0e0' }} />
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: isCurrent ? 700 : 400,
                        color: isDone ? '#4CAF50' : isCurrent ? tokens.colors.textPrimary : tokens.colors.textSecondary,
                        textDecoration: isDone ? 'line-through' : 'none',
                      }}
                    >
                      {ETUDE_ETAPE_LABELS[etape]}
                    </Typography>
                  </Box>
                );
              })}

              {/* Avenants */}
              {avenants.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Avenants</Typography>
                  {avenants.map(av => (
                    <Paper key={av.id} sx={{ p: 2, mb: 1, borderRadius: 1, bgcolor: tokens.colors.bgDefault }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>Avenant n°{av.numero}</Typography>
                        <Chip
                          size="small"
                          label={av.status === 'signe' ? 'Signé' : av.status === 'brouillon' ? 'Brouillon' : av.status}
                          color={av.status === 'signe' ? 'success' : 'default'}
                        />
                      </Box>
                      <Typography variant="caption" sx={{ color: tokens.colors.textSecondary }}>{av.raison || 'Pas de raison'}</Typography>
                    </Paper>
                  ))}
                </Box>
              )}
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab Documents */}
        <TabPanel value={selectedTab} index={1}>
          {documents.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Document</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Signé</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Audité</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {documents.map(d => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Link href={d.fileUrl} target="_blank" underline="hover">
                          {d.fileName}
                        </Link>
                      </TableCell>
                      <TableCell>{d.documentType}</TableCell>
                      <TableCell>
                        {d.createdAt instanceof Date
                          ? d.createdAt.toLocaleDateString('fr-FR')
                          : d.createdAt && typeof d.createdAt === 'object' && 'toDate' in d.createdAt
                            ? (d.createdAt as any).toDate().toLocaleDateString('fr-FR')
                            : '-'}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={d.isSigned ? 'Oui' : 'Non'} color={d.isSigned ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={d.isAudited ? 'Audité' : 'En attente'} color={d.isAudited ? 'success' : 'warning'} />
                      </TableCell>
                      <TableCell>
                        {canWrite && !d.isAudited && (
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleAuditDocument(d.id)}
                            sx={{ bgcolor: tokens.colors.primary, '&:hover': { bgcolor: tokens.colors.primaryDark } }}
                          >
                            Valider
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <DescriptionIcon sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
              <Typography sx={{ color: tokens.colors.textSecondary }}>Aucun document généré</Typography>
            </Box>
          )}
        </TabPanel>

        {/* Tab Checklist qualité */}
        <TabPanel value={selectedTab} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Checklist qualité — {qualityPercent}%</Typography>
              <LinearProgress
                variant="determinate"
                value={qualityPercent}
                sx={{
                  height: 8, borderRadius: 4, mb: 3,
                  '& .MuiLinearProgress-bar': { bgcolor: qualityPercent === 100 ? tokens.colors.success : tokens.colors.brandTeal },
                }}
              />
              {[
                { key: 'conventionSignee', label: 'Convention d\'étude signée' },
                { key: 'assuranceVerifiee', label: 'Assurance RC Pro vérifiée' },
                { key: 'pvRecetteObtenu', label: 'PV de recette obtenu' },
                { key: 'satisfactionEnvoyee', label: 'Enquête satisfaction envoyée' },
                { key: 'bvEmis', label: 'Bulletins de versement émis' },
                { key: 'facturePayee', label: 'Facture payée' },
                { key: 'rapportPedagogiqueRedige', label: 'Rapport pédagogique rédigé' },
              ].map(item => (
                <FormControlLabel
                  key={item.key}
                  control={
                    <Checkbox
                      checked={qualityChecklist[item.key] || false}
                      onChange={async (e) => {
                        if (!canWrite || !etude?.id) return;
                        const updated = { ...qualityChecklist, [item.key]: e.target.checked };
                        try {
                          await updateQualityChecklist(etude.id, updated);
                          setEtude({ ...etude, qualityChecklist: updated });
                          enqueueSnackbar('Checklist mise à jour', { variant: 'success' });
                        } catch {
                          enqueueSnackbar('Erreur', { variant: 'error' });
                        }
                      }}
                      disabled={!canWrite}
                      sx={{ '&.Mui-checked': { color: tokens.colors.primary } }}
                    />
                  }
                  label={item.label}
                  sx={{
                    display: 'flex', mb: 1, p: 1, borderRadius: 1,
                    bgcolor: qualityChecklist[item.key] ? 'rgba(102, 126, 234, 0.05)' : 'transparent',
                    '& .MuiFormControlLabel-label': {
                      textDecoration: qualityChecklist[item.key] ? 'line-through' : 'none',
                      color: qualityChecklist[item.key] ? tokens.colors.textSecondary : tokens.colors.textPrimary,
                    },
                  }}
                />
              ))}
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Satisfaction client</Typography>
              {etude.satisfactionScore ? (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <Typography variant="h2" sx={{ fontWeight: 800, color: tokens.colors.primary }}>
                    {etude.satisfactionScore.toFixed(1)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>/ 5</Typography>
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <Typography sx={{ color: tokens.colors.textSecondary }}>Pas encore d'enquête de satisfaction</Typography>
                </Box>
              )}
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab Notes d'audit */}
        <TabPanel value={selectedTab} index={3}>
          {canWrite && (
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="Ajouter une note d'audit..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                sx={{ mb: 1 }}
              />
              <Button
                variant="contained"
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                sx={{ bgcolor: tokens.colors.primary, '&:hover': { bgcolor: tokens.colors.primaryDark } }}
              >
                Ajouter
              </Button>
            </Box>
          )}

          {notes.length > 0 ? (
            notes
              .sort((a, b) => {
                const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
                const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
                return dateB.getTime() - dateA.getTime();
              })
              .map(note => (
                <Paper key={note.id} sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: tokens.colors.bgDefault }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: 14 }}>
                      <UserAvatarInitials user={{ id: note.createdBy, displayName: note.createdByName }} fontSize="0.875rem" />
                    </Avatar>
                    <UserReferenceText userId={note.createdBy} name={note.createdByName} variant="body2" sx={{ fontWeight: 600 }} />
                    <Typography variant="caption" sx={{ color: tokens.colors.textSecondary }}>
                      {note.createdAt instanceof Date
                        ? note.createdAt.toLocaleDateString('fr-FR')
                        : note.createdAt && typeof note.createdAt === 'object' && 'toDate' in note.createdAt
                          ? (note.createdAt as any).toDate().toLocaleDateString('fr-FR')
                          : '-'}
                    </Typography>
                  </Box>
                  <Typography variant="body2">{note.content}</Typography>
                </Paper>
              ))
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <NoteAddIcon sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
              <Typography sx={{ color: tokens.colors.textSecondary }}>Aucune note d'audit</Typography>
            </Box>
          )}
        </TabPanel>
      </Paper>
      </Box>
    </AppPageShell>
  );
};

export default AuditEtudeDetails;
