import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Tooltip,
  Avatar,
  InputAdornment,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  ArrowBack as ArrowBackIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  WorkHistory as WorkHistoryIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { usePermission } from '../hooks/usePermission';
import AccessDenied from '../components/common/AccessDenied';
import EmptyState from '../components/common/EmptyState';
import { auditService, Mission } from '../services/auditService';
import { AuditDocument } from '../types/audit';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { ETUDE_ETAPE_LABELS, ETUDE_ETAPE_COLORS, statusToEtape, EtudeEtape, ETUDE_ETAPE_ORDER } from '../types/etude';
import { db } from '../firebase/config';
import { tokens } from '../theme/tokens';
import UserNameText from '../components/common/UserNameText';
import UserReferenceText from '../components/common/UserReferenceText';
import ChargeNameText from '../components/common/ChargeNameText';
import UserAvatarInitials from '../components/common/UserAvatarInitials';
import { AppPageShell, SegmentedControl, DsPill, KpiCard } from '../components/ds';

// Fonction pour générer les mandats disponibles (2022-2023 jusqu'à l'année en cours)
const generateMandats = (): string[] => {
  const currentYear = new Date().getFullYear();
  const startYear = 2022;
  const mandats: string[] = [];
  
  for (let year = startYear; year <= currentYear; year++) {
    const nextYear = year + 1;
    mandats.push(`${year}-${nextYear}`);
  }
  
  return mandats;
};

const AVAILABLE_MANDATS = generateMandats();

// Animations

interface StructureMember {
  id: string;
  displayName: string;
  email: string;
  status?: string;
  structureId?: string;
  photoURL?: string;
  mandat?: string;
  poles?: { poleId: string }[];
}

const Audit: React.FC = () => {
  const { currentUser } = useAuth();
  const { canRead, canWrite, loading: permissionLoading } = usePermission('audit');
  const navigate = useNavigate();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [etudes, setEtudes] = useState<any[]>([]);
  const [structureType, setStructureType] = useState<'junior' | 'jobservice' | null>(null);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [documents, setDocuments] = useState<AuditDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [structureMembers, setStructureMembers] = useState<StructureMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [auditorFilter, setAuditorFilter] = useState<string>('all');
  const [mandatFilter, setMandatFilter] = useState<string>('all');
  const [auditStatusFilter, setAuditStatusFilter] = useState<'all' | 'audited' | 'not_audited'>('all');
  const [filteredMissions, setFilteredMissions] = useState<Mission[]>([]);
  
  // État pour le dialogue d'ajout de document
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newDocument, setNewDocument] = useState<Partial<AuditDocument>>({
    name: '',
    missionId: '',
    status: 'pending',
    description: '',
    type: 'audit'  // Valeur par défaut
  });

  // Charger les missions une seule fois par uid (éviter de relancer sur chaque
  // nouvelle référence currentUser : decrypt / onSnapshot / lastLogin).
  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid) return;

    let cancelled = false;

    const fetchMissions = async () => {
      try {
        setLoading(true);

        const userDoc = await getDoc(doc(db, 'users', uid));
        if (cancelled) return;
        if (!userDoc.exists()) {
          setLoading(false);
          return;
        }

        const userData = userDoc.data();
        const userStructureId = userData?.structureId;
        if (!userStructureId) {
          setMissions([]);
          setEtudes([]);
          setLoading(false);
          return;
        }

        const missionsRef = collection(db, 'missions');
        const missionsQuery = query(missionsRef, where('structureId', '==', userStructureId));
        const missionsSnapshot = await getDocs(missionsQuery);
        if (cancelled) return;

        // Mandats : 1 getDoc par chargé unique (pas N+1 par mission)
        const chargeIds = [
          ...new Set(
            missionsSnapshot.docs
              .map((d) => d.data().chargeId as string | undefined)
              .filter((id): id is string => Boolean(id))
          ),
        ];
        const mandatByChargeId = new Map<string, string | undefined>();
        await Promise.all(
          chargeIds.map(async (chargeId) => {
            try {
              const chargeDoc = await getDoc(doc(db, 'users', chargeId));
              if (chargeDoc.exists()) {
                mandatByChargeId.set(chargeId, chargeDoc.data().mandat || undefined);
              }
            } catch {
              /* ignore */
            }
          })
        );
        if (cancelled) return;

        const missionsData = missionsSnapshot.docs.map((missionDoc) => {
          const data = missionDoc.data();
          let auditStatus: 'audited' | 'not_audited';
          if (data.isAuditComplete !== undefined) {
            auditStatus = data.isAuditComplete ? 'audited' : 'not_audited';
          } else if (data.auditStatus) {
            auditStatus = data.auditStatus === 'audited' ? 'audited' : 'not_audited';
          } else {
            auditStatus = 'not_audited';
          }

          return {
            id: missionDoc.id,
            ...data,
            mandat: data.mandat || (data.chargeId ? mandatByChargeId.get(data.chargeId) : undefined),
            auditStatus: auditStatus as 'audited' | 'not_audited',
          } as Mission & { mandat?: string };
        });

        setMissions(missionsData);

        try {
          const structureDoc = await getDoc(doc(db, 'structures', userStructureId));
          if (!cancelled && structureDoc.exists()) {
            setStructureType(structureDoc.data()?.structureType || null);
          }
        } catch {
          /* ignore */
        }

        const etudesRef = collection(db, 'etudes');
        const etudesQuery = query(etudesRef, where('structureId', '==', userStructureId));
        const etudesSnapshot = await getDocs(etudesQuery);
        if (cancelled) return;

        setEtudes(
          etudesSnapshot.docs.map((etudeDoc) => {
            const data = etudeDoc.data();
            const etape = data.etape && ETUDE_ETAPE_ORDER.includes(data.etape)
              ? data.etape
              : statusToEtape(data.status || 'Négociation');
            return {
              id: etudeDoc.id,
              ...data,
              etape,
              auditStatus: data.isAuditComplete ? 'audited' : (data.auditStatus || 'not_audited'),
            };
          })
        );
      } catch (err) {
        if (!cancelled) {
          setError('Erreur lors du chargement');
          console.error(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchMissions();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid]);

  // Charger les documents lorsqu'une mission est sélectionnée (sans bloquer toute la page)
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!selectedMission) return;

      try {
        const docs = await auditService.getAuditDocuments(selectedMission.id);
        setDocuments(docs);
        await checkAndUpdateMissionAuditStatus(selectedMission.id, docs);
      } catch (err) {
        setError('Erreur lors du chargement des documents');
        console.error(err);
      }
    };

    void fetchDocuments();
  }, [selectedMission?.id]);

  // Membres pôle audit (filtre auditeur) — indépendant du spinner principal
  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid) return;

    let cancelled = false;

    const fetchStructureMembers = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (cancelled) return;
        const userData = userDoc.data();
        if (!userData?.structureId) return;

        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('structureId', '==', userData.structureId));
        const snapshot = await getDocs(q);
        if (cancelled) return;

        setStructureMembers(
          snapshot.docs
            .map((memberDoc) => ({
              id: memberDoc.id,
              displayName: memberDoc.data().displayName || '',
              email: memberDoc.data().email || '',
              status: memberDoc.data().status,
              structureId: memberDoc.data().structureId,
              photoURL: memberDoc.data().photoURL || '',
              mandat: memberDoc.data().mandat || '',
              poles: memberDoc.data().poles || [],
            }))
            .filter((member) => member.poles?.some((p: { poleId: string }) => p.poleId === 'aq')) as StructureMember[]
        );
      } catch (error) {
        console.error('Erreur lors du chargement des membres:', error);
      }
    };

    void fetchStructureMembers();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid]);

  // Fonction pour mettre à jour l'auditeur d'une mission
  const handleAuditorChange = async (missionId: string, newAuditorId: string) => {
    try {
      const missionRef = doc(db, 'missions', missionId);
      await updateDoc(missionRef, {
        auditor: newAuditorId
      });

      // Mettre à jour l'état local
      setMissions(prevMissions => 
        prevMissions.map(mission => 
          mission.id === missionId 
            ? { ...mission, auditor: newAuditorId }
            : mission
        )
      );
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'auditeur:', error);
      setError('Erreur lors de la mise à jour de l\'auditeur');
    }
  };

  // Fonction pour vérifier et mettre à jour le statut d'audit de la mission
  const checkAndUpdateMissionAuditStatus = async (missionId: string, documents: AuditDocument[]) => {
    try {
      // Filtrer uniquement les documents de type 'audit'
      const auditDocuments = documents.filter(doc => doc.type === 'audit');
      
      // Si aucun document d'audit, ne rien faire
      if (auditDocuments.length === 0) {
        return;
      }
      
      // Vérifier si tous les documents d'audit sont approuvés
      const allApproved = auditDocuments.every(doc => doc.status === 'approved');
      
      const missionRef = doc(db, 'missions', missionId);
      const missionDoc = await getDoc(missionRef);
      
      if (missionDoc.exists()) {
        const currentAuditStatus = missionDoc.data().auditStatus;
        const newAuditStatus = allApproved ? 'audited' : 'not_audited';
        
        // Mettre à jour seulement si le statut a changé
        if (currentAuditStatus !== newAuditStatus) {
          await updateDoc(missionRef, {
            auditStatus: newAuditStatus,
            isAuditComplete: allApproved // Synchroniser aussi isAuditComplete
          });
          
          // Mettre à jour l'état local des missions
          setMissions(prev => prev.map(mission => 
            mission.id === missionId 
              ? { ...mission, auditStatus: newAuditStatus as 'audited' | 'not_audited' }
              : mission
          ));
        }
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut d\'audit de la mission:', error);
    }
  };

  const handleBackToMissions = () => {
    setSelectedMission(null);
    setDocuments([]);
  };

  const handleOpenAddDialog = () => {
    setOpenAddDialog(true);
  };

  const handleCloseAddDialog = () => {
    setOpenAddDialog(false);
    setNewDocument({
      name: '',
      missionId: selectedMission?.id || '',
      status: 'pending',
      description: '',
      type: 'audit'
    });
  };

  const handleAddDocument = async () => {
    try {
      // Logique pour ajouter un document
      // À implémenter avec le service d'audit
      handleCloseAddDialog();
      // Rafraîchir la liste des documents
      if (selectedMission) {
        const updatedDocs = await auditService.getAuditDocuments(selectedMission.id);
        setDocuments(updatedDocs);
        
        // Vérifier et mettre à jour le statut d'audit de la mission
        await checkAndUpdateMissionAuditStatus(selectedMission.id, updatedDocs);
      }
    } catch (err) {
      setError('Erreur lors de l\'ajout du document');
      console.error(err);
    }
  };

  const handleEditDocument = async (document: AuditDocument) => {
    // Logique pour éditer un document
    console.log('Édition du document:', document);
  };

  const handleApproveDocument = async (document: AuditDocument) => {
    try {
      await auditService.updateAuditStatus(document.id, { status: 'approved' });
      if (selectedMission) {
        const updatedDocs = await auditService.getAuditDocuments(selectedMission.id);
        setDocuments(updatedDocs);
        
        // Vérifier et mettre à jour le statut d'audit de la mission
        await checkAndUpdateMissionAuditStatus(selectedMission.id, updatedDocs);
      }
    } catch (err) {
      setError('Erreur lors de l\'approbation du document');
      console.error(err);
    }
  };

  const handleRejectDocument = async (document: AuditDocument) => {
    try {
      await auditService.updateAuditStatus(document.id, { status: 'rejected' });
      if (selectedMission) {
        const updatedDocs = await auditService.getAuditDocuments(selectedMission.id);
        setDocuments(updatedDocs);
        
        // Vérifier et mettre à jour le statut d'audit de la mission (sera 'not_audited' si un document est rejeté)
        await checkAndUpdateMissionAuditStatus(selectedMission.id, updatedDocs);
      }
    } catch (err) {
      setError('Erreur lors du rejet du document');
      console.error(err);
    }
  };

  // Fonction pour obtenir la couleur du statut
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'error';
      case 'completed':
        return 'info';
      default:
        return 'warning';
    }
  };

  // Fonction pour naviguer vers la page de détails de mission d'audit
  const handleViewMissionDetails = (missionId: string) => {
    navigate(`/app/audit/mission/${missionId}`);
  };

  // Fonction pour naviguer vers la page de détails d'étude d'audit
  const handleViewEtudeDetails = (etudeNumber: string) => {
    navigate(`/app/audit/etude/${etudeNumber}`);
  };

  // Effet pour filtrer les missions
  useEffect(() => {
    let result = [...missions];
    
    // Filtrer par recherche
    if (searchTerm) {
      result = result.filter(mission => 
        mission.numeroMission.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mission.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mission.missionManager?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filtrer par auditeur
    if (auditorFilter !== 'all') {
      result = result.filter(mission => mission.auditor === auditorFilter);
    }
    
    // Filtrer par mandat
    if (mandatFilter !== 'all') {
      result = result.filter(mission => {
        const missionMandat = (mission as any).mandat;
        return missionMandat === mandatFilter;
      });
    }
    
    // Filtrer par statut d'audit
    if (auditStatusFilter !== 'all') {
      result = result.filter(mission => {
        const auditStatus = mission.auditStatus || 'not_audited';
        return auditStatus === auditStatusFilter;
      });
    }
    
    setFilteredMissions(result);
  }, [missions, searchTerm, auditorFilter, mandatFilter, auditStatusFilter]);

  const auditedCount = missions.filter((m) => m.auditStatus === 'audited').length;
  const pendingCount = missions.length - auditedCount;

  const filterFieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: tokens.radius.md,
      bgcolor: tokens.colors.bgPaper,
      fontSize: 13,
      '& fieldset': { borderColor: tokens.colors.gray200 },
      '&:hover fieldset': { borderColor: tokens.colors.gray300 },
      '&.Mui-focused fieldset': { borderColor: tokens.colors.brandTeal },
    },
  };

  const thSx = {
    fontWeight: 600,
    fontSize: '0.6875rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    color: tokens.colors.gray500,
    borderBottom: `1px solid ${tokens.colors.divider}`,
    bgcolor: tokens.colors.surfaceAlt,
    py: 1.25,
    whiteSpace: 'nowrap' as const,
  };

  const panelSx = {
    bgcolor: tokens.colors.bgPaper,
    border: `1px solid ${tokens.colors.divider}`,
    borderRadius: tokens.radius.lg,
    overflow: 'hidden',
  };

  if (loading || permissionLoading) {
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

  if (!canRead) {
    return (
      <AccessDenied
        title="Accès refusé"
        message="Vous n'avez pas les permissions nécessaires pour accéder à l'Audit. Contactez votre administrateur pour obtenir l'accès."
      />
    );
  }

  return (
    <AppPageShell
      eyebrow="Qualité"
      title="Audit"
      titleSuffix={String(missions.length)}
      subtitle="Suivez et assignez les audits de missions"
      kpiColumns={3}
      kpiStrip={
        <>
          <KpiCard label="Total" value={missions.length} density="compact" />
          <KpiCard label="À auditer" value={pendingCount} density="compact" sparkColor={tokens.colors.warning} />
          <KpiCard label="Auditées" value={auditedCount} density="compact" sparkColor={tokens.colors.success} />
        </>
      }
    >
      <Box sx={{ px: 3, py: 2.5, pb: 4, width: '100%' }}>
        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 2,
              borderRadius: tokens.radius.md,
              border: `1px solid ${tokens.colors.error}33`,
            }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {selectedMission ? (
          <Box sx={panelSx}>
            <Box
              sx={{
                px: 2.5,
                py: 1.75,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 2,
                borderBottom: `1px solid ${tokens.colors.divider}`,
                bgcolor: tokens.colors.bgPaper,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                <IconButton
                  onClick={handleBackToMissions}
                  size="small"
                  sx={{
                    mr: 1.5,
                    color: tokens.colors.gray600,
                    '&:hover': { bgcolor: tokens.colors.gray100 },
                  }}
                >
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
                <Typography sx={{ fontSize: 16, fontWeight: 600, color: tokens.colors.gray900 }}>
                  Mission {selectedMission.numeroMission}
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenAddDialog}
                sx={{
                  bgcolor: tokens.colors.brandTeal,
                  color: '#fff',
                  borderRadius: tokens.radius.md,
                  px: 2,
                  py: 0.875,
                  textTransform: 'none',
                  fontWeight: 600,
                  boxShadow: tokens.shadows.button,
                  '&:hover': { bgcolor: tokens.colors.brandTeal700 },
                }}
              >
                Ajouter un document
              </Button>
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={thSx}>Type</TableCell>
                    <TableCell sx={thSx}>Nom</TableCell>
                    <TableCell sx={thSx}>Statut</TableCell>
                    <TableCell sx={thSx}>Date de création</TableCell>
                    <TableCell sx={thSx}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {documents.length > 0 ? (
                    documents.map((document) => (
                      <TableRow
                        key={document.id}
                        sx={{
                          '&:hover': { bgcolor: tokens.colors.gray50 },
                          '& td': {
                            borderBottom: `1px solid ${tokens.colors.divider}`,
                            color: tokens.colors.gray900,
                            fontSize: 13,
                          },
                        }}
                      >
                        <TableCell>
                          <DsPill
                            bg={document.type === 'audit' ? tokens.colors.brandTeal100 : tokens.colors.gray100}
                            fg={document.type === 'audit' ? tokens.colors.brandTeal700 : tokens.colors.gray700}
                          >
                            {document.type === 'audit' ? 'Audit' : 'Mission'}
                          </DsPill>
                        </TableCell>
                        <TableCell>{document.name}</TableCell>
                        <TableCell>
                          <Chip
                            label={
                              document.status === 'approved'
                                ? 'Approuvé'
                                : document.status === 'rejected'
                                  ? 'Rejeté'
                                  : 'En attente'
                            }
                            size="small"
                            color={getStatusColor(document.status) as 'success' | 'error' | 'info' | 'warning'}
                            sx={{ fontWeight: 500, borderRadius: tokens.radius.sm }}
                          />
                        </TableCell>
                        <TableCell>{new Date(document.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="Modifier">
                              <IconButton
                                size="small"
                                onClick={() => handleEditDocument(document)}
                                sx={{ color: tokens.colors.gray600 }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {document.type === 'audit' && (
                              <>
                                <Tooltip title="Approuver">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleApproveDocument(document)}
                                    disabled={document.status === 'approved'}
                                    sx={{ color: tokens.colors.success }}
                                  >
                                    <ApproveIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Rejeter">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleRejectDocument(document)}
                                    disabled={document.status === 'rejected'}
                                    sx={{ color: tokens.colors.error }}
                                  >
                                    <RejectIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4, color: tokens.colors.gray500, borderBottom: 'none' }}>
                        Aucun document pour cette mission
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ) : (
          <>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1.5,
                alignItems: 'center',
                mb: 2.5,
                p: 1.5,
                ...panelSx,
              }}
            >
              <SegmentedControl
                value={auditStatusFilter}
                onChange={(v) => setAuditStatusFilter(v as 'all' | 'audited' | 'not_audited')}
                options={[
                  { value: 'all', label: 'Tous' },
                  { value: 'not_audited', label: 'Non audité' },
                  { value: 'audited', label: 'Audité' },
                ]}
              />

              <TextField
                placeholder="Rechercher une mission…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="small"
                sx={{ flex: '1 1 220px', minWidth: 180, ...filterFieldSx }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: tokens.colors.gray400, fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
              />

              <Autocomplete
                options={[...structureMembers].sort((a, b) => {
                  const mandatA = a.mandat || '';
                  const mandatB = b.mandat || '';
                  if (mandatA !== mandatB) return mandatB.localeCompare(mandatA);
                  return a.displayName.localeCompare(b.displayName);
                })}
                groupBy={(option) => (option.mandat ? `Mandat ${option.mandat}` : 'Autres')}
                getOptionLabel={(option) => option.displayName || option.email}
                value={auditorFilter === 'all' ? null : structureMembers.find((m) => m.id === auditorFilter) || null}
                onChange={(_, newValue) => setAuditorFilter(newValue?.id || 'all')}
                renderInput={(params) => (
                  <TextField {...params} size="small" label="Auditeur" placeholder="Tous" sx={{ minWidth: 200, ...filterFieldSx }} />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar src={option.photoURL} sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                      {option.displayName?.[0]}
                    </Avatar>
                    <UserNameText user={option} variant="body2" component="span" fallback={option.email} />
                  </Box>
                )}
                size="small"
                sx={{ minWidth: 200 }}
              />

              <FormControl size="small" sx={{ minWidth: 150, ...filterFieldSx }}>
                <InputLabel>Mandat</InputLabel>
                <Select value={mandatFilter} label="Mandat" onChange={(e) => setMandatFilter(e.target.value)}>
                  <MenuItem value="all">Tous les mandats</MenuItem>
                  {AVAILABLE_MANDATS.map((mandat) => (
                    <MenuItem key={mandat} value={mandat}>
                      {mandat}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ ...panelSx, mb: structureType === 'junior' && etudes.length > 0 ? 3 : 0 }}>
              <Box
                sx={{
                  px: 2.5,
                  py: 1.75,
                  borderBottom: `1px solid ${tokens.colors.divider}`,
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 1,
                }}
              >
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.colors.gray900 }}>
                  Missions à auditer
                </Typography>
                <Typography sx={{ fontSize: 12, color: tokens.colors.gray500 }}>
                  {filteredMissions.length} résultat{filteredMissions.length > 1 ? 's' : ''}
                </Typography>
              </Box>

              {filteredMissions.length === 0 ? (
                <EmptyState
                  icon={<WorkHistoryIcon />}
                  title="Aucune mission à auditer"
                  description="Les missions à auditer apparaîtront ici lorsqu'elles seront créées, ou ajustez vos filtres."
                />
              ) : (
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table sx={{ minWidth: 720 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={thSx}>Numéro de mission</TableCell>
                        <TableCell sx={thSx}>Statut de l&apos;audit</TableCell>
                        <TableCell sx={thSx}>Auditeur en charge</TableCell>
                        <TableCell sx={thSx}>Chargé de mission</TableCell>
                        <TableCell sx={thSx}>Entreprise</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredMissions.map((mission) => (
                        <TableRow
                          key={mission.id}
                          onClick={() => handleViewMissionDetails(mission.id)}
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { bgcolor: tokens.colors.gray50 },
                            '& td': {
                              borderBottom: `1px solid ${tokens.colors.divider}`,
                              color: tokens.colors.gray900,
                              fontSize: 13,
                            },
                          }}
                        >
                          <TableCell sx={{ fontWeight: 600 }}>{mission.numeroMission}</TableCell>
                          <TableCell>
                            <DsPill
                              bg={
                                mission.auditStatus === 'audited'
                                  ? tokens.colors.successLight
                                  : tokens.colors.warningLight
                              }
                              fg={
                                mission.auditStatus === 'audited'
                                  ? tokens.colors.success
                                  : tokens.colors.warning
                              }
                            >
                              {mission.auditStatus === 'audited' ? 'Audité' : 'Non audité'}
                            </DsPill>
                          </TableCell>
                          <TableCell>
                            <FormControl
                              fullWidth
                              size="small"
                              onClick={(e) => e.stopPropagation()}
                              sx={{
                                minWidth: 180,
                                '& .MuiOutlinedInput-root': {
                                  borderRadius: tokens.radius.md,
                                  bgcolor: tokens.colors.gray50,
                                  fontSize: 13,
                                  '& fieldset': { borderColor: 'transparent' },
                                  '&:hover': { bgcolor: tokens.colors.gray100 },
                                  '&.Mui-focused fieldset': { borderColor: tokens.colors.brandTeal },
                                },
                              }}
                            >
                              <Select
                                value={mission.auditor || ''}
                                onChange={(e) => handleAuditorChange(mission.id, e.target.value)}
                                displayEmpty
                                variant="outlined"
                                disabled={!canWrite}
                                sx={{
                                  '& .MuiSelect-select': {
                                    py: 0.75,
                                    display: 'flex',
                                    alignItems: 'center',
                                  },
                                }}
                              >
                                <MenuItem value="" sx={{ py: 0.5 }}>
                                  <em>Non assigné</em>
                                </MenuItem>
                                {structureMembers.map((member) => (
                                  <MenuItem
                                    key={member.id}
                                    value={member.id}
                                    sx={{ py: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}
                                  >
                                    <Avatar
                                      src={member.photoURL}
                                      sx={{ width: 20, height: 20, fontSize: '0.75rem', mr: 1.5 }}
                                    >
                                      <UserAvatarInitials user={member} fontSize="0.75rem" />
                                    </Avatar>
                                    <UserNameText
                                      user={member}
                                      fallback={member.email}
                                      variant="body2"
                                      sx={{
                                        fontWeight: 400,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        maxWidth: 120,
                                      }}
                                    />
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            <UserReferenceText
                              userId={mission.chargeId}
                              name={mission.missionManager}
                              fallback="Non assigné"
                              variant="body2"
                            />
                          </TableCell>
                          <TableCell>{mission.company}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>

            {structureType === 'junior' && etudes.length > 0 && (
              <Box sx={panelSx}>
                <Box sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${tokens.colors.divider}` }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.colors.gray900 }}>
                    Études
                  </Typography>
                </Box>
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table sx={{ minWidth: 640 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={thSx}>Numéro</TableCell>
                        <TableCell sx={thSx}>Entreprise</TableCell>
                        <TableCell sx={thSx}>Étape</TableCell>
                        <TableCell sx={thSx}>Chargé d&apos;études</TableCell>
                        <TableCell sx={thSx}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {etudes.map((etude: any) => {
                        const etape = etude.etape as EtudeEtape;
                        return (
                          <TableRow
                            key={etude.id}
                            hover
                            sx={{
                              '& td': {
                                borderBottom: `1px solid ${tokens.colors.divider}`,
                                fontSize: 13,
                                color: tokens.colors.gray900,
                              },
                            }}
                          >
                            <TableCell sx={{ fontWeight: 600 }}>{etude.numeroEtude}</TableCell>
                            <TableCell>{etude.company}</TableCell>
                            <TableCell>
                              <DsPill
                                bg={`${ETUDE_ETAPE_COLORS[etape] || tokens.colors.gray400}22`}
                                fg={ETUDE_ETAPE_COLORS[etape] || tokens.colors.gray600}
                              >
                                {ETUDE_ETAPE_LABELS[etape] || etude.status}
                              </DsPill>
                            </TableCell>
                            <TableCell>
                              <ChargeNameText chargeId={etude.chargeId} chargeName={etude.chargeName} variant="body2" />
                            </TableCell>
                            <TableCell>
                              <Tooltip title="Voir l'audit">
                                <IconButton
                                  size="small"
                                  onClick={() => handleViewEtudeDetails(etude.numeroEtude)}
                                  sx={{ color: tokens.colors.brandTeal }}
                                >
                                  <ViewIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </>
        )}
      </Box>

      <Dialog
        open={openAddDialog}
        onClose={handleCloseAddDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: tokens.radius.lg,
            boxShadow: tokens.shadows.lg,
          },
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 600,
            color: tokens.colors.gray900,
            borderBottom: `1px solid ${tokens.colors.divider}`,
            pb: 2,
          }}
        >
          Ajouter un document d&apos;audit
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nom du document"
                value={newDocument.name}
                onChange={(e) => setNewDocument({ ...newDocument, name: e.target.value })}
                sx={filterFieldSx}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth sx={filterFieldSx}>
                <InputLabel>Type de document</InputLabel>
                <Select
                  value={newDocument.type}
                  label="Type de document"
                  onChange={(e) => setNewDocument({ ...newDocument, type: e.target.value as 'audit' | 'mission' })}
                >
                  <MenuItem value="audit">Document d&apos;audit</MenuItem>
                  <MenuItem value="mission">Document de mission</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="ID de la mission"
                value={newDocument.missionId}
                disabled
                helperText="ID de la mission sélectionnée"
                sx={{
                  ...filterFieldSx,
                  '& .MuiOutlinedInput-root': {
                    ...filterFieldSx['& .MuiOutlinedInput-root'],
                    bgcolor: tokens.colors.gray50,
                  },
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth sx={filterFieldSx}>
                <InputLabel>Statut</InputLabel>
                <Select
                  value={newDocument.status}
                  label="Statut"
                  onChange={(e) => setNewDocument({ ...newDocument, status: e.target.value as AuditDocument['status'] })}
                >
                  <MenuItem value="pending">En attente</MenuItem>
                  <MenuItem value="approved">Approuvé</MenuItem>
                  <MenuItem value="rejected">Rejeté</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={4}
                value={newDocument.description}
                onChange={(e) => setNewDocument({ ...newDocument, description: e.target.value })}
                sx={filterFieldSx}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: `1px solid ${tokens.colors.divider}` }}>
          <Button
            onClick={handleCloseAddDialog}
            sx={{ textTransform: 'none', color: tokens.colors.gray700 }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleAddDocument}
            variant="contained"
            sx={{
              bgcolor: tokens.colors.brandTeal,
              color: '#fff',
              borderRadius: tokens.radius.md,
              px: 2.5,
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: tokens.shadows.button,
              '&:hover': { bgcolor: tokens.colors.brandTeal700 },
            }}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>
    </AppPageShell>
  );
};

export default Audit;
