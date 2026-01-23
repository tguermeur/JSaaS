import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Container,
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
  Breadcrumbs,
  Link,
  Divider,
  Avatar,
  InputAdornment,
  alpha,
  keyframes,
  Autocomplete
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
import { auditService, Mission } from '../services/auditService';
import { AuditDocument, AuditAssignment } from '../types/audit';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

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
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

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
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [documents, setDocuments] = useState<AuditDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
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

  // Charger les missions au chargement de la page
  useEffect(() => {
    const fetchMissions = async () => {
      if (!currentUser) return;

      try {
        setLoading(true);
        console.log("Début de la récupération des missions");
        console.log("UID de l'utilisateur:", currentUser.uid);

        // Récupérer d'abord les données de l'utilisateur
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) {
          console.error("Document utilisateur non trouvé");
          setLoading(false);
          return;
        }

        const userData = userDoc.data();
        console.log("Données utilisateur récupérées:", userData);

        const userStructureId = userData?.structureId;
        console.log("StructureId de l'utilisateur:", userStructureId);

        // Récupérer les missions de la structure
        const missionsRef = collection(db, 'missions');
        const missionsQuery = query(missionsRef, where('structureId', '==', userStructureId));
        const missionsSnapshot = await getDocs(missionsQuery);
        
        console.log("Nombre total de missions trouvées:", missionsSnapshot.docs.length);
        
        const missionsData = await Promise.all(missionsSnapshot.docs.map(async (missionDoc) => {
          const data = missionDoc.data();
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Audit.tsx:151',message:'Processing mission',data:{missionId:missionDoc.id,chargeId:data.chargeId,structureId:data.structureId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          console.log("Mission trouvée:", {
            id: missionDoc.id,
            structureId: data.structureId,
            userStructureId,
            match: data.structureId === userStructureId
          });
          
          // Récupérer le mandat du chargé de mission si la mission a un chargeId
          let missionMandat: string | undefined;
          if (data.chargeId) {
            try {
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Audit.tsx:163',message:'Before getDoc call',data:{chargeId:data.chargeId,docType:typeof doc},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
              // #endregion
              const chargeDoc = await getDoc(doc(db, 'users', data.chargeId));
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Audit.tsx:164',message:'After getDoc call',data:{chargeDocExists:chargeDoc.exists()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
              // #endregion
              if (chargeDoc.exists()) {
                const chargeData = chargeDoc.data();
                missionMandat = chargeData.mandat || undefined;
              }
            } catch (error) {
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Audit.tsx:169',message:'Error getting charge doc',data:{error:error instanceof Error ? error.message : String(error),errorStack:error instanceof Error ? error.stack : undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
              // #endregion
              console.error('Erreur lors de la récupération du mandat du chargé de mission:', error);
            }
          }
          
          // Mapper isAuditComplete vers auditStatus si nécessaire
          // Prioriser isAuditComplete s'il existe, sinon utiliser auditStatus
          let auditStatus: 'audited' | 'not_audited';
          if (data.isAuditComplete !== undefined) {
            // Si isAuditComplete existe, l'utiliser comme source de vérité
            auditStatus = data.isAuditComplete ? 'audited' : 'not_audited';
          } else if (data.auditStatus) {
            // Sinon, utiliser auditStatus s'il existe
            auditStatus = data.auditStatus === 'audited' ? 'audited' : 'not_audited';
          } else {
            // Par défaut
            auditStatus = 'not_audited';
          }
          
          return {
            id: missionDoc.id,
            ...data,
            mandat: data.mandat || missionMandat,
            auditStatus: auditStatus as 'audited' | 'not_audited'
          } as Mission & { mandat?: string };
        }));

        setMissions(missionsData);
      } catch (err) {
        setError('Erreur lors du chargement des missions');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMissions();
  }, [currentUser]);

  // Charger les documents lorsqu'une mission est sélectionnée
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!selectedMission) return;
      
      try {
        setLoading(true);
        const docs = await auditService.getAuditDocuments(selectedMission.id);
        setDocuments(docs);
        
        // Vérifier et mettre à jour le statut d'audit de la mission après le chargement
        await checkAndUpdateMissionAuditStatus(selectedMission.id, docs);
      } catch (err) {
        setError('Erreur lors du chargement des documents');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [selectedMission]);

  // Fonction pour récupérer les membres de la structure (pôle audit uniquement)
  const fetchStructureMembers = async () => {
    if (!currentUser) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();
      
      if (userData?.structureId) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('structureId', '==', userData.structureId));
        const snapshot = await getDocs(q);
        const membersList = snapshot.docs
          .map(doc => ({
            id: doc.id,
            displayName: doc.data().displayName || '',
            email: doc.data().email || '',
            status: doc.data().status,
            structureId: doc.data().structureId,
            photoURL: doc.data().photoURL || '',
            mandat: doc.data().mandat || '',
            poles: doc.data().poles || []
          }))
          .filter(member => 
            member.poles?.some(p => p.poleId === 'aq')
          ) as StructureMember[];
        setStructureMembers(membersList);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des membres:", error);
    }
  };

  // Charger les membres de la structure au chargement de la page
  useEffect(() => {
    fetchStructureMembers();
  }, [currentUser]);

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

  const handleSelectMission = (mission: Mission) => {
    setSelectedMission(mission);
    setNewDocument(prev => ({ ...prev, missionId: mission.id }));
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography 
        variant="h4" 
        sx={{ 
          mb: 3, 
          fontWeight: 700,
          fontSize: '2rem',
          background: 'linear-gradient(45deg, #0071e3, #34c759)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: `${fadeIn} 0.5s ease-out`
        }}
      >
        Audit
      </Typography>

      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3,
            borderRadius: '12px',
            backgroundColor: alpha('#ff3b30', 0.1),
            '& .MuiAlert-icon': {
              color: '#ff3b30'
            }
          }}
        >
          {error}
        </Alert>
      )}

      <Breadcrumbs 
        sx={{ 
          mb: 2,
          '& .MuiBreadcrumbs-separator': {
            color: '#86868b'
          }
        }}
      >
        <Link 
          component="button" 
          variant="body1" 
          onClick={handleBackToMissions}
          sx={{ 
            color: selectedMission ? '#0071e3' : '#1d1d1f',
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline'
            }
          }}
        >
        </Link>
        {selectedMission && (
          <Typography color="text.primary" sx={{ color: '#1d1d1f' }}>
            Mission {selectedMission.numeroMission}
          </Typography>
        )}
      </Breadcrumbs>

      {selectedMission ? (
        <Paper 
          sx={{ 
            width: '100%', 
            mb: 2,
            borderRadius: '16px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            overflow: 'hidden'
          }}
        >
          <Box 
            sx={{ 
              p: 3, 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              backgroundColor: '#f5f5f7'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton 
                onClick={handleBackToMissions} 
                sx={{ 
                  mr: 2,
                  color: '#1d1d1f',
                  '&:hover': {
                    backgroundColor: 'rgba(0,0,0,0.04)'
                  }
                }}
              >
                <ArrowBackIcon />
              </IconButton>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600,
                  color: '#1d1d1f',
                  fontSize: '1.25rem'
                }}
              >
                Mission {selectedMission.numeroMission}
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenAddDialog}
              sx={{
                backgroundColor: '#0071e3',
                color: '#fff',
                borderRadius: '20px',
                px: 3,
                py: 1,
                textTransform: 'none',
                fontWeight: 500,
                '&:hover': {
                  backgroundColor: '#0077ed'
                }
              }}
            >
              Ajouter un document
            </Button>
          </Box>
          <Divider />
          
          <Box sx={{ p: 3 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ 
                      fontWeight: 600,
                      color: '#1d1d1f',
                      borderBottom: '1px solid #e5e5e7'
                    }}>Type</TableCell>
                    <TableCell sx={{ 
                      fontWeight: 600,
                      color: '#1d1d1f',
                      borderBottom: '1px solid #e5e5e7'
                    }}>Nom</TableCell>
                    <TableCell sx={{ 
                      fontWeight: 600,
                      color: '#1d1d1f',
                      borderBottom: '1px solid #e5e5e7'
                    }}>Statut</TableCell>
                    <TableCell sx={{ 
                      fontWeight: 600,
                      color: '#1d1d1f',
                      borderBottom: '1px solid #e5e5e7'
                    }}>Date de création</TableCell>
                    <TableCell sx={{ 
                      fontWeight: 600,
                      color: '#1d1d1f',
                      borderBottom: '1px solid #e5e5e7'
                    }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {documents.length > 0 ? (
                    documents.map((document) => (
                      <TableRow 
                        key={document.id}
                        sx={{
                          '&:hover': {
                            backgroundColor: 'rgba(0,0,0,0.02)'
                          },
                          '& td': {
                            borderBottom: '1px solid #e5e5e7',
                            color: '#1d1d1f'
                          }
                        }}
                      >
                        <TableCell>
                          <Chip
                            label={document.type === 'audit' ? 'Audit' : 'Document Mission'}
                            size="small"
                            sx={{
                              backgroundColor: document.type === 'audit' ? '#0071e3' : '#f5f5f7',
                              color: document.type === 'audit' ? '#fff' : '#1d1d1f',
                              fontWeight: 500,
                              borderRadius: '6px'
                            }}
                          />
                        </TableCell>
                        <TableCell>{document.name}</TableCell>
                        <TableCell>
                          <Chip
                            label={document.status}
                            size="small"
                            sx={{
                              backgroundColor: 
                                document.status === 'approved' ? '#34c759' :
                                document.status === 'rejected' ? '#ff3b30' :
                                '#ff9500',
                              color: '#fff',
                              fontWeight: 500,
                              borderRadius: '6px'
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(document.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title="Modifier">
                              <IconButton
                                size="small"
                                onClick={() => handleEditDocument(document)}
                                sx={{
                                  color: '#1d1d1f',
                                  '&:hover': {
                                    backgroundColor: 'rgba(0,0,0,0.04)'
                                  }
                                }}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            {document.type === 'audit' && (
                              <>
                                <Tooltip title="Approuver">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleApproveDocument(document)}
                                    disabled={document.status === 'approved'}
                                    sx={{
                                      color: '#34c759',
                                      '&:hover': {
                                        backgroundColor: 'rgba(52,199,89,0.1)'
                                      },
                                      '&.Mui-disabled': {
                                        color: 'rgba(52,199,89,0.3)'
                                      }
                                    }}
                                  >
                                    <ApproveIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Rejeter">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleRejectDocument(document)}
                                    disabled={document.status === 'rejected'}
                                    sx={{
                                      color: '#ff3b30',
                                      '&:hover': {
                                        backgroundColor: 'rgba(255,59,48,0.1)'
                                      },
                                      '&.Mui-disabled': {
                                        color: 'rgba(255,59,48,0.3)'
                                      }
                                    }}
                                  >
                                    <RejectIcon />
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
                      <TableCell 
                        colSpan={5} 
                        align="center"
                        sx={{ 
                          py: 4,
                          color: '#86868b',
                          borderBottom: 'none'
                        }}
                      >
                        Aucun document pour cette mission
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Paper>
      ) : (
        <Paper 
          sx={{ 
            width: '100%', 
            mb: 2,
            borderRadius: '16px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            overflow: 'hidden'
          }}
        >
          <Box sx={{ p: 3 }}>
            <Typography 
              variant="h6" 
              sx={{ 
                mb: 3,
                fontWeight: 600,
                color: '#1d1d1f',
                fontSize: '1.25rem'
              }}
            >
              Missions à auditer
            </Typography>
            
            <Paper 
              elevation={0}
              sx={{ 
                p: 2, 
                mb: 2, 
                borderRadius: '12px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #e5e5e7'
              }}
            >
              <Box sx={{ 
                display: 'flex', 
                flexWrap: 'wrap',
                gap: 2,
                alignItems: 'center'
              }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flex: 1 }}>
                  <Typography variant="body2" sx={{ color: '#86868b', mr: 1, fontWeight: 500 }}>
                    Statut :
                  </Typography>
                  <Chip
                    label="Tous les audits"
                    onClick={() => setAuditStatusFilter('all')}
                    color={auditStatusFilter === 'all' ? 'primary' : 'default'}
                    variant={auditStatusFilter === 'all' ? 'filled' : 'outlined'}
                    sx={{
                      borderRadius: '8px',
                      '&.MuiChip-filled': {
                        backgroundColor: '#007AFF',
                      },
                      '&.MuiChip-outlined': {
                        borderColor: '#d2d2d7',
                        color: '#1d1d1f',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 0, 0, 0.04)'
                        }
                      }
                    }}
                  />
                  <Chip
                    label="Non audité"
                    onClick={() => setAuditStatusFilter('not_audited')}
                    color={auditStatusFilter === 'not_audited' ? 'primary' : 'default'}
                    variant={auditStatusFilter === 'not_audited' ? 'filled' : 'outlined'}
                    sx={{
                      borderRadius: '8px',
                      '&.MuiChip-filled': {
                        backgroundColor: '#007AFF',
                      },
                      '&.MuiChip-outlined': {
                        borderColor: '#d2d2d7',
                        color: '#1d1d1f',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 0, 0, 0.04)'
                        }
                      }
                    }}
                  />
                  <Chip
                    label="Audité"
                    onClick={() => setAuditStatusFilter('audited')}
                    color={auditStatusFilter === 'audited' ? 'primary' : 'default'}
                    variant={auditStatusFilter === 'audited' ? 'filled' : 'outlined'}
                    sx={{
                      borderRadius: '8px',
                      '&.MuiChip-filled': {
                        backgroundColor: '#007AFF',
                      },
                      '&.MuiChip-outlined': {
                        borderColor: '#d2d2d7',
                        color: '#1d1d1f',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 0, 0, 0.04)'
                        }
                      }
                    }}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <FormControl 
                    size="small" 
                    sx={{ 
                      minWidth: 150
                    }}
                  >
                    <InputLabel>Mandat</InputLabel>
                    <Select
                      value={mandatFilter}
                      label="Mandat"
                      onChange={(e) => setMandatFilter(e.target.value)}
                      sx={{
                        borderRadius: '8px',
                        backgroundColor: 'white',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#d2d2d7',
                        },
                      }}
                    >
                      <MenuItem value="all">Tous les mandats</MenuItem>
                      {AVAILABLE_MANDATS.map(mandat => (
                        <MenuItem key={mandat} value={mandat}>
                          {mandat}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </Box>
            </Paper>
            
            <Box sx={{ 
              mb: 4, 
              display: 'flex', 
              gap: 2, 
              alignItems: 'center',
              backgroundColor: '#f5f5f7',
              p: 2,
              borderRadius: '12px'
            }}>
              <TextField
                placeholder="Rechercher une mission..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="small"
                sx={{ 
                  flexGrow: 1,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    '& fieldset': {
                      borderColor: 'transparent'
                    },
                    '&:hover fieldset': {
                      borderColor: '#d2d2d7'
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#0071e3'
                    }
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#86868b' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Autocomplete
                options={structureMembers
                  .sort((a, b) => {
                    const mandatA = a.mandat || '';
                    const mandatB = b.mandat || '';
                    if (mandatA !== mandatB) return mandatB.localeCompare(mandatA);
                    return a.displayName.localeCompare(b.displayName);
                  })
                }
                groupBy={(option) => option.mandat ? `Mandat ${option.mandat}` : 'Autres'}
                getOptionLabel={(option) => option.displayName || option.email}
                value={auditorFilter === 'all' ? null : structureMembers.find(m => m.id === auditorFilter) || null}
                onChange={(_, newValue) => {
                  setAuditorFilter(newValue?.id || 'all');
                }}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    size="small" 
                    label="Auditeur"
                    placeholder="Tous les auditeurs"
                    sx={{ 
                      minWidth: 200,
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#ffffff',
                        borderRadius: '8px',
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0071e3'
                        }
                      }
                    }}
                    InputLabelProps={{
                      sx: { color: '#86868b' }
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar 
                      src={option.photoURL} 
                      sx={{ 
                        width: 24, 
                        height: 24,
                        fontSize: '0.75rem'
                      }}
                    >
                      {option.displayName?.[0]}
                    </Avatar>
                    <Typography variant="body2">
                      {option.displayName || option.email}
                    </Typography>
                  </Box>
                )}
                size="small"
                sx={{ minWidth: 200 }}
              />
              <FormControl 
                size="small" 
                sx={{ 
                  minWidth: 150,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    '& fieldset': {
                      borderColor: 'transparent'
                    },
                    '&:hover fieldset': {
                      borderColor: '#d2d2d7'
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#0071e3'
                    }
                  }
                }}
              >
                <InputLabel sx={{ color: '#86868b' }}>Mandat</InputLabel>
                <Select
                  value={mandatFilter}
                  label="Mandat"
                  onChange={(e) => setMandatFilter(e.target.value)}
                >
                  <MenuItem value="all">Tous les mandats</MenuItem>
                  {AVAILABLE_MANDATS.map(mandat => (
                    <MenuItem key={mandat} value={mandat}>
                      {mandat}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            
            {filteredMissions.length === 0 ? (
              <Paper 
                sx={{ 
                  p: 4, 
                  textAlign: 'center',
                  bgcolor: 'white',
                  borderRadius: '16px',
                  border: '1px solid #e5e5e7'
                }}
              >
                <WorkHistoryIcon sx={{ fontSize: 48, color: '#86868b', mb: 2 }} />
                <Typography variant="h6" sx={{ color: '#1d1d1f', mb: 1 }}>
                  Aucune mission à auditer dans votre structure
                </Typography>
                <Typography variant="body1" sx={{ color: '#86868b', mb: 3 }}>
                  Les missions à auditer apparaîtront ici lorsqu'elles seront créées.
                </Typography>
              </Paper>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ 
                        fontWeight: 600,
                        color: '#1d1d1f',
                        borderBottom: '1px solid #e5e5e7'
                      }}>Numéro de mission</TableCell>
                      <TableCell sx={{ 
                        fontWeight: 600,
                        color: '#1d1d1f',
                        borderBottom: '1px solid #e5e5e7'
                      }}>Statut de l'audit</TableCell>
                      <TableCell sx={{ 
                        fontWeight: 600,
                        color: '#1d1d1f',
                        borderBottom: '1px solid #e5e5e7'
                      }}>Auditeur en charge</TableCell>
                      <TableCell sx={{ 
                        fontWeight: 600,
                        color: '#1d1d1f',
                        borderBottom: '1px solid #e5e5e7'
                      }}>Chargé de mission</TableCell>
                      <TableCell sx={{ 
                        fontWeight: 600,
                        color: '#1d1d1f',
                        borderBottom: '1px solid #e5e5e7'
                      }}>Entreprise</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredMissions.map((mission) => (
                      <TableRow 
                        key={mission.id}
                        onClick={() => handleViewMissionDetails(mission.id)}
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': { 
                            backgroundColor: 'rgba(0,0,0,0.02)'
                          },
                          '& td': {
                            borderBottom: '1px solid #e5e5e7',
                            color: '#1d1d1f'
                          }
                        }}
                      >
                        <TableCell>{mission.numeroMission}</TableCell>
                        <TableCell>
                          <Chip
                            label={mission.auditStatus === 'audited' ? 'Audité' : 'Non audité'}
                            size="small"
                            sx={{
                              backgroundColor: mission.auditStatus === 'audited' ? '#34c759' : '#ff9500',
                              color: '#fff',
                              fontWeight: 500,
                              borderRadius: '6px'
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <FormControl 
                            fullWidth 
                            size="small"
                            onClick={(e) => e.stopPropagation()}
                            sx={{ 
                              minWidth: '180px',
                              '& .MuiOutlinedInput-root': {
                                borderRadius: '8px',
                                backgroundColor: 'rgba(0,0,0,0.02)',
                                '&:hover': {
                                  backgroundColor: 'rgba(0,0,0,0.04)',
                                },
                                '&.Mui-focused': {
                                  backgroundColor: 'rgba(0,0,0,0.04)',
                                }
                              }
                            }}
                          >
                            <Select
                              value={mission.auditor || ''}
                              onChange={(e) => handleAuditorChange(mission.id, e.target.value)}
                              displayEmpty
                              variant="outlined"
                              sx={{
                                fontSize: '0.875rem',
                                '& .MuiSelect-select': {
                                  py: 0.75,
                                  display: 'flex',
                                  alignItems: 'center',
                                }
                              }}
                            >
                              <MenuItem value="" sx={{ py: 0.5 }}>
                                <em>Non assigné</em>
                              </MenuItem>
                              {structureMembers.map((member) => (
                                <MenuItem 
                                  key={member.id} 
                                  value={member.id}
                                  sx={{ 
                                    py: 0.5,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1
                                  }}
                                >
                                  <Avatar 
                                    src={member.photoURL} 
                                    sx={{ 
                                      width: 20, 
                                      height: 20,
                                      fontSize: '0.75rem',
                                      mr: 1.5
                                    }}
                                  >
                                    {member.displayName?.[0]}
                                  </Avatar>
                                  <Typography 
                                    variant="body2" 
                                    sx={{ 
                                      fontWeight: 400,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      maxWidth: '120px'
                                    }}
                                  >
                                    {member.displayName || member.email}
                                  </Typography>
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>{mission.missionManager || 'Non assigné'}</TableCell>
                        <TableCell>{mission.company}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Paper>
      )}

      <Dialog 
        open={openAddDialog} 
        onClose={handleCloseAddDialog} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.1)'
          }
        }}
      >
        <DialogTitle sx={{ 
          fontWeight: 600,
          color: '#1d1d1f',
          borderBottom: '1px solid #e5e5e7',
          pb: 2
        }}>
          Ajouter un document d'audit
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nom du document"
                value={newDocument.name}
                onChange={(e) => setNewDocument({ ...newDocument, name: e.target.value })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    '& fieldset': {
                      borderColor: '#d2d2d7'
                    },
                    '&:hover fieldset': {
                      borderColor: '#0071e3'
                    }
                  }
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Type de document</InputLabel>
                <Select
                  value={newDocument.type}
                  label="Type de document"
                  onChange={(e) => setNewDocument({ ...newDocument, type: e.target.value as 'audit' | 'mission' })}
                  sx={{
                    borderRadius: '8px',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#d2d2d7'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#0071e3'
                    }
                  }}
                >
                  <MenuItem value="audit">Document d'audit</MenuItem>
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
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    backgroundColor: '#f5f5f7'
                  }
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Statut</InputLabel>
                <Select
                  value={newDocument.status}
                  label="Statut"
                  onChange={(e) => setNewDocument({ ...newDocument, status: e.target.value as AuditDocument['status'] })}
                  sx={{
                    borderRadius: '8px',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#d2d2d7'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#0071e3'
                    }
                  }}
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    '& fieldset': {
                      borderColor: '#d2d2d7'
                    },
                    '&:hover fieldset': {
                      borderColor: '#0071e3'
                    }
                  }
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: '1px solid #e5e5e7' }}>
          <Button 
            onClick={handleCloseAddDialog}
            sx={{
              color: '#1d1d1f',
              '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.04)'
              }
            }}
          >
            Annuler
          </Button>
          <Button 
            onClick={handleAddDocument} 
            variant="contained"
            sx={{
              backgroundColor: '#0071e3',
              color: '#fff',
              borderRadius: '20px',
              px: 3,
              '&:hover': {
                backgroundColor: '#0077ed'
              }
            }}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Audit; 