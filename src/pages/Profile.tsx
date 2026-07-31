import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Skeleton,
  Typography,
  Avatar,
  Button,
  Grid,
  CircularProgress,
} from '@mui/material';
import {
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  Description as DescriptionIcon,
  BugReport as BugReportIcon,
  Security as SecurityIcon,
  Payment as PaymentIcon,
  School as SchoolIcon,
  CreditCard as CreditCardIcon,
  Shield as ShieldIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { UserData } from '../types/user';
import { Mission } from '../types/mission';
import { db } from '../firebase/config';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useSnackbar } from 'notistack';
import { useSearchParams } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { tokens } from '../theme/tokens';
import {
  AppPageShell,
  ProfileCompletionMeter,
  dsTabsSx,
  SSPanel,
  SSKpi,
  SSPill,
  SSTracker,
} from '../components/ds';

import ProfileInfoForm from '../components/profile/ProfileInfoForm';
import MissionsList from '../components/profile/MissionsList';
import DocumentsTab from '../components/profile/DocumentsTab';
import ReportsTab from '../components/profile/ReportsTab';
import SecurityTab from '../components/profile/SecurityTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

function computeProfileCompletion(user: UserData): number {
  const fields = [
    user.firstName,
    user.lastName,
    user.email,
    user.phone,
    user.address,
    user.city,
    user.postalCode,
    user.ecole,
  ];
  const filled = fields.filter((f) => f && String(f).trim().length > 0).length;
  return Math.round((filled / fields.length) * 100);
}

function mapEtapeToTrackerStage(etape?: string): string {
  switch (etape) {
    case 'suivi':
      return 'En cours';
    case 'cloture':
      return 'Livrée';
    case 'archive':
      return 'Payée';
    case 'contractualisation':
    case 'selection':
      return 'Sélectionné';
    default:
      return 'Sélectionné';
  }
}

function mapMissionPayStatus(mission: Mission): string {
  if (mission.etape === 'archive') return 'Payé';
  if (mission.etape === 'cloture') return 'À facturer';
  if (mission.etape === 'suivi') return 'En attente';
  return 'À facturer';
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

function parseMissionAmount(mission: Mission): number {
  const raw = mission.priceHT ?? mission.totalHT ?? mission.salary;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const parsed = parseFloat(raw.replace(/[^\d.,]/g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

const Profile: React.FC = () => {
  const { currentUser, effectiveUserId, isImpersonating } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams, setSearchParams] = useSearchParams();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(false);
  const [hasReports, setHasReports] = useState(false);
  const [revealIban, setRevealIban] = useState(false);

  const isStudent = userData?.status === 'etudiant';

  const profilePct = useMemo(
    () => (userData ? computeProfileCompletion(userData) : 0),
    [userData]
  );

  const studentStats = useMemo(() => {
    const accepted = missions.filter(
      (m) => (m as Mission & { applicationStatus?: string }).applicationStatus === 'Acceptée'
    );
    const hours = accepted.reduce((sum, m) => sum + (m.hours || 0), 0);
    const earned = accepted
      .filter((m) => m.etape === 'archive' || m.etape === 'cloture')
      .reduce((sum, m) => sum + parseMissionAmount(m), 0);
    return { missions: accepted.length, hours, earned };
  }, [missions]);

  const paymentMissions = useMemo(
    () =>
      missions.filter(
        (m) =>
          (m as Mission & { applicationStatus?: string }).applicationStatus === 'Acceptée' &&
          ['suivi', 'cloture', 'archive'].includes(m.etape || '')
      ),
    [missions]
  );

  const paymentSummary = useMemo(() => {
    const total = paymentMissions.reduce((s, m) => s + parseMissionAmount(m), 0);
    const paid = paymentMissions
      .filter((m) => m.etape === 'archive')
      .reduce((s, m) => s + parseMissionAmount(m), 0);
    return { total, paid, due: total - paid };
  }, [paymentMissions]);

  const tabPayments = isStudent ? 3 : -1;
  const tabReports = isStudent ? (hasReports ? 4 : -1) : hasReports ? 3 : -1;
  const tabSecurity = isStudent ? (hasReports ? 5 : 4) : hasReports ? 4 : 3;

  const fetchUserData = async () => {
    if (!currentUser || !effectiveUserId) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', effectiveUserId));
      if (userDoc.exists()) {
        let userDataRaw = userDoc.data() as UserData;

        const hasEncryptedData = Object.values(userDataRaw).some(
          (value) => typeof value === 'string' && value.startsWith('ENC:')
        );

        if (hasEncryptedData) {
          try {
            const functions = getFunctions();

            if (isImpersonating) {
              const decryptUserDataForStructure = httpsCallable(
                functions,
                'decryptUserDataForStructure'
              );
              const result = await decryptUserDataForStructure({ userId: effectiveUserId });

              if (result.data && (result.data as { decryptedData?: Record<string, unknown> }).decryptedData) {
                userDataRaw = {
                  ...userDataRaw,
                  ...(result.data as { decryptedData: Record<string, unknown> }).decryptedData,
                } as UserData;
              }
            } else {
              const decryptOwnUserData = httpsCallable(functions, 'decryptOwnUserData');
              const result = await decryptOwnUserData({});

              if (
                result.data &&
                (result.data as { success?: boolean }).success &&
                (result.data as { decryptedData?: Record<string, unknown> }).decryptedData
              ) {
                userDataRaw = {
                  ...userDataRaw,
                  ...(result.data as { decryptedData: Record<string, unknown> }).decryptedData,
                } as UserData;
              }
            }
          } catch (decryptError: unknown) {
            const msg = decryptError instanceof Error ? decryptError.message : String(decryptError);
            console.warn('Impossible de déchiffrer avec decryptOwnUserData, essai avec decryptUserData:', msg);

            try {
              const functions = getFunctions();
              const decryptUserData = httpsCallable(functions, 'decryptUserData');
              const result = await decryptUserData({
                userId: effectiveUserId,
                deviceId: localStorage.getItem('deviceId') || undefined,
              });

              if (
                result.data &&
                (result.data as { success?: boolean }).success &&
                (result.data as { decryptedData?: Record<string, unknown> }).decryptedData
              ) {
                userDataRaw = {
                  ...userDataRaw,
                  ...(result.data as { decryptedData: Record<string, unknown> }).decryptedData,
                } as UserData;
              }
            } catch (fallbackError: unknown) {
              const fbMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
              console.warn('Impossible de déchiffrer les données utilisateur (données restent cryptées):', fbMsg);
            }
          }
        }

        setUserData(userDataRaw);
      }
    } catch (error) {
      console.error('Erreur fetch user data:', error);
      enqueueSnackbar('Erreur lors du chargement du profil', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchMissions = async () => {
    if (!currentUser || !userData || !effectiveUserId) return;
    setLoadingMissions(true);
    try {
      if (userData.status === 'entreprise') {
        const missionsRef = collection(db, 'missions');
        const q = query(missionsRef, where('companyId', '==', effectiveUserId));
        const querySnapshot = await getDocs(q);
        const fetchedMissions = querySnapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Mission[];
        setMissions(fetchedMissions);
      } else if (userData.status === 'etudiant') {
        const applicationsRef = collection(db, 'applications');
        const applicationsQuery = query(applicationsRef, where('userId', '==', effectiveUserId));
        const applicationsSnapshot = await getDocs(applicationsQuery);

        const applicationStatusMap: Record<string, string> = {};
        applicationsSnapshot.docs.forEach((appDoc) => {
          const appData = appDoc.data();
          if (appData.missionId) {
            applicationStatusMap[appData.missionId] = appData.status || 'En attente';
          }
        });

        const missionIds = Object.keys(applicationStatusMap);

        if (missionIds.length === 0) {
          setMissions([]);
          return;
        }

        const missionsList: (Mission & { applicationStatus?: string })[] = [];

        for (const missionId of missionIds) {
          try {
            const missionDoc = await getDoc(doc(db, 'missions', missionId));
            if (missionDoc.exists()) {
              missionsList.push({
                id: missionDoc.id,
                ...missionDoc.data(),
                applicationStatus: applicationStatusMap[missionId] || 'Postulé',
              } as Mission & { applicationStatus?: string });
            }
          } catch (error) {
            console.error(`Erreur lors de la récupération de la mission ${missionId}:`, error);
          }
        }

        setMissions(missionsList as Mission[]);
      } else {
        if (userData.structureId) {
          const missionsRef = collection(db, 'missions');
          const q = query(missionsRef, where('structureId', '==', userData.structureId));
          const querySnapshot = await getDocs(q);
          const fetchedMissions = querySnapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as Mission[];
          setMissions(fetchedMissions);
        } else {
          setMissions([]);
        }
      }
    } catch (error) {
      console.error('Erreur fetch missions:', error);
      setMissions([]);
    } finally {
      setLoadingMissions(false);
    }
  };

  const checkReports = async () => {
    if (!currentUser || !effectiveUserId) return;
    try {
      const reportsRef = collection(db, 'reports');
      const q = query(reportsRef, where('userId', '==', effectiveUserId), limit(1));
      const snapshot = await getDocs(q);
      setHasReports(!snapshot.empty);
    } catch (e) {
      console.error('Erreur check reports', e);
    }
  };

  useEffect(() => {
    fetchUserData();
    checkReports();
  }, [currentUser, effectiveUserId]);

  useEffect(() => {
    if (userData) {
      fetchMissions();
    }
  }, [userData]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'missions') {
      setTabValue(1);
      setSearchParams({}, { replace: true });
    }
    if (tabParam === 'paiements' && isStudent) {
      setTabValue(3);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, isStudent]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading || !userData) {
    return (
      <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
        <Skeleton variant="rectangular" height={200} sx={{ mb: 2, borderRadius: tokens.radius.lg }} />
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: tokens.radius.lg }} />
      </Box>
    );
  }

  const displayName = [userData.firstName, userData.lastName].filter(Boolean).join(' ') || 'Mon profil';
  const initials = [userData.firstName?.[0], userData.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?';
  const ribRegistered = Boolean(userData.ribUrl);

  const renderStudentHero = () => (
    <Box
      sx={{
        bgcolor: tokens.colors.bgPaper,
        border: `1px solid ${tokens.colors.divider}`,
        borderRadius: tokens.radius.lg,
        p: { xs: 2, md: 2.75 },
        mb: 3,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 3,
        flexWrap: 'wrap',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
        <Avatar
          src={userData.photoURL}
          alt={displayName}
          sx={{
            width: 64,
            height: 64,
            bgcolor: tokens.colors.brandNavy,
            fontWeight: 700,
            fontSize: 20,
          }}
        >
          {initials}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 600, color: tokens.colors.gray900 }}>
              {displayName}
            </Typography>
            {userData.subscriptionStatus === 'active' && (
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  fontSize: 11,
                  fontWeight: 600,
                  px: 1.125,
                  py: '3px',
                  borderRadius: tokens.radius.pill,
                  bgcolor: tokens.colors.successLight,
                  color: '#065f46',
                }}
              >
                Consultant actif
              </Box>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <SchoolIcon sx={{ fontSize: 14, color: tokens.colors.gray400 }} />
            <Typography sx={{ fontSize: 12, color: tokens.colors.gray500 }}>
              {userData.ecole || 'Étudiant'}
              {userData.program ? ` · ${userData.program}` : ''}
              {userData.campus ? ` · ${userData.campus}` : ''}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
        {[
          { label: 'Missions', value: studentStats.missions },
          { label: 'Heures', value: studentStats.hours },
          { label: 'Perçus', value: formatEur(studentStats.earned) },
        ].map((st) => (
          <Box key={st.label} sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: 18, fontWeight: 600, color: tokens.colors.gray900 }}>
              {st.value}
            </Typography>
            <Typography sx={{ fontSize: 11, color: tokens.colors.gray400 }}>{st.label}</Typography>
          </Box>
        ))}
        <Box sx={{ width: 1, height: 36, bgcolor: tokens.colors.gray100, display: { xs: 'none', sm: 'block' } }} />
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: 18, fontWeight: 600, color: tokens.colors.gray900 }}>
            {profilePct}%
          </Typography>
          <Typography sx={{ fontSize: 11, color: tokens.colors.gray400 }}>Profil</Typography>
        </Box>
      </Box>
    </Box>
  );

  const renderPaymentsTab = () => (
    <Box>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={4}>
          <SSKpi label="Total facturé" value={formatEur(paymentSummary.total)} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <SSKpi label="Encaissé" value={formatEur(paymentSummary.paid)} accent />
        </Grid>
        <Grid item xs={12} sm={4}>
          <SSKpi label="Reste à percevoir" value={formatEur(paymentSummary.due)} />
        </Grid>
      </Grid>

      <SSPanel
        title="Suivi des paiements"
        icon={<PaymentIcon sx={{ fontSize: 14, color: tokens.colors.gray400 }} />}
      >
        {paymentMissions.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: tokens.colors.gray500, textAlign: 'center', py: 3 }}>
            Aucune mission terminée ou en cours de paiement pour le moment.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {paymentMissions.map((mission) => {
              const payStatus = mapMissionPayStatus(mission);
              const stage = mapEtapeToTrackerStage(mission.etape);
              const amount = parseMissionAmount(mission);
              return (
                <Box
                  key={mission.id}
                  sx={{
                    p: 2,
                    border: `1px solid ${tokens.colors.divider}`,
                    borderRadius: tokens.radius.lg,
                    bgcolor: tokens.colors.bgPaper,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 2,
                      mb: 2,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ mb: 0.75 }}>
                        <SSPill label={payStatus} variant={payStatus as 'Payé' | 'Programmé' | 'En attente' | 'À facturer'} />
                      </Box>
                      <Typography sx={{ fontSize: 15, fontWeight: 600, color: tokens.colors.gray900 }}>
                        {mission.title}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: tokens.colors.gray500, mt: 0.25 }}>
                        {mission.company || mission.numeroMission}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 20, fontWeight: 700, color: tokens.colors.gray900 }}>
                      {formatEur(amount)}
                    </Typography>
                  </Box>
                  <SSTracker stage={stage} />
                </Box>
              );
            })}
          </Box>
        )}

        <Box
          sx={{
            display: 'flex',
            gap: 1,
            mt: 2,
            p: 1.5,
            bgcolor: tokens.colors.gray50,
            borderRadius: tokens.radius.md,
            fontSize: 12,
            color: tokens.colors.gray600,
            lineHeight: 1.55,
          }}
        >
          <Typography sx={{ fontSize: 12, color: tokens.colors.gray600, lineHeight: 1.55 }}>
            Les rémunérations sont versées après validation de la mission. Vérifiez que votre{' '}
            <strong>RIB</strong> est à jour dans l&apos;onglet Documents.
          </Typography>
        </Box>
      </SSPanel>
    </Box>
  );

  return (
    <AppPageShell
      eyebrow="Espace étudiant"
      title={displayName}
      titleSuffix={isStudent ? 'Profil' : undefined}
    >
      <Box sx={{ px: 3, py: 3, maxWidth: 1200, mx: 'auto', width: '100%' }}>
        {isStudent ? (
          renderStudentHero()
        ) : (
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              mb: 3,
              borderRadius: tokens.radius.lg,
              border: `1px solid ${tokens.colors.borderDefault}`,
              bgcolor: tokens.colors.bgPaper,
            }}
          >
            <ProfileCompletionMeter pct={profilePct} />
          </Paper>
        )}

        <Box sx={{ width: '100%' }}>
          <Paper
            elevation={0}
            sx={{
              borderBottom: `1px solid ${tokens.colors.divider}`,
              bgcolor: tokens.colors.bgPaper,
              borderRadius: `${tokens.radius.lg} ${tokens.radius.lg} 0 0`,
            }}
          >
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              aria-label="profile tabs"
              variant="scrollable"
              scrollButtons="auto"
              sx={dsTabsSx}
            >
              <Tab icon={<PersonIcon />} iconPosition="start" label="Mes informations" />
              <Tab icon={<AssignmentIcon />} iconPosition="start" label="Mes missions" />
              <Tab icon={<DescriptionIcon />} iconPosition="start" label="Mes documents" />
              {isStudent && (
                <Tab icon={<PaymentIcon />} iconPosition="start" label="Paiements" />
              )}
              {hasReports && <Tab icon={<BugReportIcon />} iconPosition="start" label="Signalements" />}
              <Tab icon={<SecurityIcon />} iconPosition="start" label="Sécurité" />
            </Tabs>
          </Paper>

          <TabPanel value={tabValue} index={0}>
            {isStudent ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' },
                  gap: 2,
                  alignItems: 'start',
                }}
              >
                <SSPanel
                  title="Informations personnelles"
                  icon={<PersonIcon sx={{ fontSize: 14, color: tokens.colors.gray400 }} />}
                  action={
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        fontSize: 10,
                        fontWeight: 700,
                        px: 1,
                        py: '2px',
                        borderRadius: tokens.radius.pill,
                        bgcolor: tokens.colors.gray100,
                        color: tokens.colors.gray600,
                      }}
                    >
                      <ShieldIcon sx={{ fontSize: 10 }} />
                      Confidentiel
                    </Box>
                  }
                >
                  <ProfileInfoForm userData={userData} onUpdate={fetchUserData} />
                </SSPanel>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <SSPanel
                    title="Coordonnées bancaires"
                    icon={<CreditCardIcon sx={{ fontSize: 14, color: tokens.colors.gray400 }} />}
                    action={
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          fontSize: 10,
                          fontWeight: 700,
                          px: 1,
                          py: '2px',
                          borderRadius: tokens.radius.pill,
                          bgcolor: tokens.colors.gray100,
                          color: tokens.colors.gray600,
                        }}
                      >
                        <ShieldIcon sx={{ fontSize: 10 }} />
                        Chiffré
                      </Box>
                    }
                  >
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: tokens.colors.gray500, mb: 0.75 }}>
                      RIB
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Box
                        sx={{
                          flex: 1,
                          fontSize: 12,
                          fontFamily: 'monospace',
                          color: tokens.colors.gray900,
                          py: 0.75,
                        }}
                      >
                        {ribRegistered
                          ? revealIban
                            ? 'RIB enregistré — consultez le document dans Mes documents'
                            : 'RIB •••••••••••••••• enregistré'
                          : 'Aucun RIB enregistré'}
                      </Box>
                      {ribRegistered && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setRevealIban((r) => !r)}
                          sx={{ textTransform: 'none', fontSize: 12, flexShrink: 0 }}
                        >
                          {revealIban ? 'Masquer' : 'Afficher'}
                        </Button>
                      )}
                    </Box>
                    <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, lineHeight: 1.5 }}>
                      Utilisé pour le versement de vos rémunérations. Téléversez votre RIB dans l&apos;onglet
                      Documents.
                    </Typography>
                  </SSPanel>

                  <SSPanel title="Complétude du profil" defaultOpen={false}>
                    <ProfileCompletionMeter pct={profilePct} />
                  </SSPanel>
                </Box>
              </Box>
            ) : (
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  border: `1px solid ${tokens.colors.borderDefault}`,
                  borderTop: 'none',
                  borderRadius: `0 0 ${tokens.radius.lg} ${tokens.radius.lg}`,
                  bgcolor: tokens.colors.bgPaper,
                }}
              >
                <ProfileInfoForm userData={userData} onUpdate={fetchUserData} />
              </Paper>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {loadingMissions ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : isStudent ? (
              <SSPanel
                title="Mes missions"
                icon={<AssignmentIcon sx={{ fontSize: 14, color: tokens.colors.gray400 }} />}
              >
                <MissionsList missions={missions} isStudent />
              </SSPanel>
            ) : (
              <MissionsList missions={missions} isStudent={false} />
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            {isStudent ? (
              <SSPanel
                title="Mes documents"
                icon={<DescriptionIcon sx={{ fontSize: 14, color: tokens.colors.gray400 }} />}
              >
                <DocumentsTab userData={userData} onUpdate={fetchUserData} />
              </SSPanel>
            ) : (
              <DocumentsTab userData={userData} onUpdate={fetchUserData} />
            )}
          </TabPanel>

          {isStudent && tabPayments >= 0 && (
            <TabPanel value={tabValue} index={tabPayments}>
              {renderPaymentsTab()}
            </TabPanel>
          )}

          {hasReports && tabReports >= 0 && (
            <TabPanel value={tabValue} index={tabReports}>
              <ReportsTab />
            </TabPanel>
          )}

          <TabPanel value={tabValue} index={tabSecurity}>
            <SecurityTab userData={userData} onUpdate={fetchUserData} />
          </TabPanel>
        </Box>
      </Box>
    </AppPageShell>
  );
};

export default Profile;
