import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Link as MuiLink,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Description as DocIcon,
} from '@mui/icons-material';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, storage } from '../../firebase/config';
import { uploadFile } from '../../firebase/storage';
import { useAuth } from '../../contexts/AuthContext';
import { useAmbassadorBranding } from '../../hooks/useAmbassadorBranding';
import { tokens } from '../../theme/tokens';
import { SettingsPanel } from '../../components/ds';
import {
  listMySignatureRequestsAsCompanyContact,
  type CompanyContactSignatureItem,
} from '../../services/companyContactSignatures';

type CompanyDocMeta = {
  id: string;
  title: string;
  storagePath: string;
  contentType?: string;
  byteSize?: number;
  uploadedByRole?: string;
  createdAt?: Date | null;
};

type MissionRow = {
  id: string;
  title: string;
  numeroMission?: string;
  status?: string;
  type?: string;
};

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: 'En attente',
    opened: 'Ouvert',
    signed: 'Signé',
    declined: 'Refusé',
    completed: 'Complété',
    cancelled: 'Annulé',
    expired: 'Expiré',
    draft: 'Brouillon',
  };
  return map[status] || status;
};

const statusColor = (
  status: string
): 'default' | 'success' | 'warning' | 'error' | 'info' => {
  if (status === 'completed' || status === 'signed') return 'success';
  if (status === 'pending' || status === 'opened') return 'warning';
  if (status === 'cancelled' || status === 'declined' || status === 'expired') return 'error';
  return 'default';
};

const EntrepriseDashboard: React.FC = () => {
  const { currentUser, userData, isContactWithAccess } = useAuth();
  const companyId = userData?.companyId || '';
  const { logoUrl, logoLargeUrl, loading: brandingLoading } = useAmbassadorBranding(
    undefined,
    companyId || undefined
  );
  const logo = logoLargeUrl || logoUrl;

  const [companyName, setCompanyName] = useState<string>('');
  const [docs, setDocs] = useState<CompanyDocMeta[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [signatures, setSignatures] = useState<CompanyContactSignatureItem[]>([]);
  const [sigsLoading, setSigsLoading] = useState(true);
  const [sigsError, setSigsError] = useState<string | null>(null);

  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [missionsLoading, setMissionsLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setCompanyName('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'companies', companyId));
        if (!cancelled && snap.exists()) {
          setCompanyName(String(snap.data()?.name || snap.data()?.nom || 'Entreprise'));
        }
      } catch (err) {
        console.warn('Company name load failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setDocs([]);
      setDocsLoading(false);
      return;
    }
    setDocsLoading(true);
    const q = query(
      collection(db, 'companies', companyId, 'documents'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setDocs(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              title: String(data.title || 'Document'),
              storagePath: String(data.storagePath || ''),
              contentType: data.contentType,
              byteSize: data.byteSize,
              uploadedByRole: data.uploadedByRole,
              createdAt: data.createdAt?.toDate?.() || null,
            };
          })
        );
        setDocsLoading(false);
      },
      (err) => {
        console.error('Documents load failed:', err);
        // Fallback sans orderBy si index manquant
        getDocs(collection(db, 'companies', companyId, 'documents'))
          .then((snap) => {
            setDocs(
              snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  title: String(data.title || 'Document'),
                  storagePath: String(data.storagePath || ''),
                  contentType: data.contentType,
                  byteSize: data.byteSize,
                  uploadedByRole: data.uploadedByRole,
                  createdAt: data.createdAt?.toDate?.() || null,
                };
              })
            );
          })
          .catch(() => setDocs([]))
          .finally(() => setDocsLoading(false));
      }
    );
    return () => unsub();
  }, [companyId]);

  useEffect(() => {
    if (!isContactWithAccess || !companyId) {
      setSignatures([]);
      setSigsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setSigsLoading(true);
        setSigsError(null);
        const list = await listMySignatureRequestsAsCompanyContact();
        if (!cancelled) setSignatures(list);
      } catch (err: any) {
        console.error('Signatures load failed:', err);
        if (!cancelled) {
          setSigsError(err?.message || 'Impossible de charger les documents à signer.');
          setSignatures([]);
        }
      } finally {
        if (!cancelled) setSigsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isContactWithAccess, companyId]);

  useEffect(() => {
    if (!companyId) {
      setMissions([]);
      setMissionsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setMissionsLoading(true);
        const snap = await getDocs(
          query(collection(db, 'missions'), where('companyId', '==', companyId))
        );
        if (cancelled) return;
        const rows = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: String(data.title || data.titre || 'Mission'),
            numeroMission: data.numeroMission,
            status: data.status || data.statut,
            type: data.type,
          } as MissionRow;
        });
        rows.sort((a, b) => (a.numeroMission || a.title).localeCompare(b.numeroMission || b.title));
        setMissions(rows);
      } catch (err) {
        console.error('Missions load failed:', err);
        if (!cancelled) setMissions([]);
      } finally {
        if (!cancelled) setMissionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const handleDownloadDoc = useCallback(async (docMeta: CompanyDocMeta) => {
    if (!docMeta.storagePath) return;
    try {
      const url = await getDownloadURL(ref(storage, docMeta.storagePath));
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Download failed:', err);
      setUploadError('Téléchargement impossible.');
    }
  }, []);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!companyId || !currentUser) return;
      if (file.size >= 100 * 1024 * 1024) {
        setUploadError('Fichier trop volumineux (max. 100 Mo).');
        return;
      }
      setUploading(true);
      setUploadError(null);
      try {
        const safeName = file.name.replace(/[^\w.\-]+/g, '_');
        const fileId = `${Date.now()}-${safeName}`;
        const storagePath = `companies/${companyId}/documents/${fileId}`;
        await uploadFile(file, storagePath);
        await addDoc(collection(db, 'companies', companyId, 'documents'), {
          title: file.name,
          storagePath,
          contentType: file.type || 'application/octet-stream',
          byteSize: file.size,
          uploadedBy: currentUser.uid,
          uploadedByRole: 'entreprise',
          createdAt: serverTimestamp(),
        });
      } catch (err: any) {
        console.error('Upload failed:', err);
        setUploadError(err?.message || "Échec de l'upload.");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [companyId, currentUser]
  );

  if (!companyId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          Aucune entreprise rattachée à votre compte. Cet espace est réservé aux contacts
          invités.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        {brandingLoading ? (
          <CircularProgress size={40} />
        ) : (
          <Avatar
            src={logo || undefined}
            alt={companyName || 'Entreprise'}
            variant="rounded"
            sx={{
              width: 64,
              height: 64,
              bgcolor: tokens.colors.brandTeal100,
              color: tokens.colors.brandNavy,
              '& img': { objectFit: 'contain', p: 0.5 },
            }}
          >
            {(companyName || 'E').charAt(0).toUpperCase()}
          </Avatar>
        )}
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: tokens.colors.brandNavy }}>
            {companyName || 'Mon espace entreprise'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Documents, signatures et missions liés à votre entreprise
          </Typography>
        </Box>
      </Stack>

      <Stack spacing={3}>
        <SettingsPanel title="Mes documents">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
            spacing={1}
            sx={{ mb: 2 }}
          >
            <Typography variant="body2" color="text.secondary">
              Déposez et téléchargez les documents de l&apos;espace entreprise.
            </Typography>
            <Button
              variant="contained"
              startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <UploadIcon />}
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              sx={{ bgcolor: tokens.colors.brandTeal, '&:hover': { bgcolor: tokens.colors.brandTeal700 } }}
            >
              Déposer un fichier
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
              }}
            />
          </Stack>
          {uploadError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUploadError(null)}>
              {uploadError}
            </Alert>
          )}
          {docsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : docs.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucun document pour le moment.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Titre</TableCell>
                  <TableCell>Déposé par</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <DocIcon fontSize="small" color="action" />
                        <span>{d.title}</span>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {d.uploadedByRole === 'entreprise' ? 'Entreprise' : 'Structure'}
                    </TableCell>
                    <TableCell>
                      {d.createdAt ? d.createdAt.toLocaleDateString('fr-FR') : '—'}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        aria-label="Télécharger"
                        onClick={() => void handleDownloadDoc(d)}
                        disabled={!d.storagePath}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SettingsPanel>

        <SettingsPanel title="Documents à signer">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Vue en lecture seule des demandes qui vous concernent. La signature se fait via le
            lien reçu par email.
          </Typography>
          {sigsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : sigsError ? (
            <Alert severity="warning">{sigsError}</Alert>
          ) : signatures.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucune demande de signature pour votre adresse.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Document</TableCell>
                  <TableCell>Statut demande</TableCell>
                  <TableCell>Votre signature</TableCell>
                  <TableCell align="right">Scellé</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {signatures.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.documentTitle}</TableCell>
                    <TableCell>
                      <Chip size="small" label={statusLabel(s.status)} color={statusColor(s.status)} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={statusLabel(s.mySignerStatus)}
                        color={statusColor(s.mySignerStatus)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {s.status === 'completed' && s.sealedUrl ? (
                        <MuiLink href={s.sealedUrl} target="_blank" rel="noopener noreferrer">
                          Télécharger
                        </MuiLink>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SettingsPanel>

        <SettingsPanel title="Mes missions">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Missions liées à votre entreprise (lecture seule).
          </Typography>
          {missionsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : missions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucune mission rattachée.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>N°</TableCell>
                  <TableCell>Titre</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Statut</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {missions.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.numeroMission || '—'}</TableCell>
                    <TableCell>{m.title}</TableCell>
                    <TableCell>{m.type || '—'}</TableCell>
                    <TableCell>{m.status || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SettingsPanel>
      </Stack>
    </Box>
  );
};

export default EntrepriseDashboard;
