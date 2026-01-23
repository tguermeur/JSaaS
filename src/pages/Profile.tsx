import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Tabs,
  Tab,
  Paper,
  Skeleton
} from '@mui/material';
import {
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  Description as DescriptionIcon,
  BugReport as BugReportIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { UserData } from '../types/user';
import { Mission } from '../types/mission';
import { db } from '../firebase/config';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useSnackbar } from 'notistack';
import { useSearchParams } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Sous-composants
import ProfileHeader from '../components/profile/ProfileHeader';
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
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const Profile: React.FC = () => {
  const { currentUser } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(false);
  const [hasReports, setHasReports] = useState(false);

    const fetchUserData = async () => {
    if (!currentUser) return;
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            let userDataRaw = userDoc.data() as UserData;
            
            // Toujours essayer de déchiffrer les données de l'utilisateur pour lui-même
            // Vérifier si des données sont cryptées (commencent par ENC:)
            const hasEncryptedData = Object.values(userDataRaw).some(value => 
              typeof value === 'string' && value.startsWith('ENC:')
            );
            
            if (hasEncryptedData) {
              try {
                const functions = getFunctions();
                // Utiliser decryptOwnUserData qui permet de décrypter ses propres données sans 2FA
                const decryptOwnUserData = httpsCallable(functions, 'decryptOwnUserData');
                
                const result = await decryptOwnUserData({});
                
                if (result.data && (result.data as any).success && (result.data as any).decryptedData) {
                  // Fusionner les données déchiffrées avec les données brutes
                  const decryptedData = (result.data as any).decryptedData;
                  
                  userDataRaw = {
                    ...userDataRaw,
                    ...decryptedData
                  };
                  console.log('[Profile] Données déchiffrées avec succès');
                }
              } catch (decryptError: any) {
                // Si le déchiffrement échoue, essayer avec decryptUserData (avec 2FA)
                console.warn('Impossible de déchiffrer avec decryptOwnUserData, essai avec decryptUserData:', decryptError.message);
                
                try {
                  const functions = getFunctions();
                  const decryptUserData = httpsCallable(functions, 'decryptUserData');
                  
                  const result = await decryptUserData({ 
                    userId: currentUser.uid,
                    deviceId: localStorage.getItem('deviceId') || undefined
                  });
                  
                  if (result.data && (result.data as any).success && (result.data as any).decryptedData) {
                    const decryptedData = (result.data as any).decryptedData;
                    userDataRaw = {
                      ...userDataRaw,
                      ...decryptedData
                    };
                  }
                } catch (fallbackError: any) {
                  console.warn('Impossible de déchiffrer les données utilisateur (données restent cryptées):', fallbackError.message);
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
    if (!currentUser || !userData) return;
    setLoadingMissions(true);
    try {
      if (userData.status === 'entreprise') {
        // Pour les entreprises : récupérer les missions où companyId correspond
        const missionsRef = collection(db, 'missions');
        const q = query(missionsRef, where('companyId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        const fetchedMissions = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Mission[];
        setMissions(fetchedMissions);
      } else if (userData.status === 'etudiant') {
        // Pour les étudiants : récupérer les missions où ils ont postulé via la collection applications
        const applicationsRef = collection(db, 'applications');
        const applicationsQuery = query(
          applicationsRef,
          where('userId', '==', currentUser.uid)
        );
        const applicationsSnapshot = await getDocs(applicationsQuery);
        
        // Créer une map missionId -> applicationStatus
        const applicationStatusMap: Record<string, string> = {};
        applicationsSnapshot.docs.forEach(appDoc => {
          const appData = appDoc.data();
          if (appData.missionId) {
            applicationStatusMap[appData.missionId] = appData.status || 'En attente';
          }
        });
        
        // Récupérer les IDs des missions
        const missionIds = Object.keys(applicationStatusMap);
        
        if (missionIds.length === 0) {
          setMissions([]);
          return;
        }
        
        // Récupérer les missions correspondantes une par une (ou par batches si possible)
        const missionsRef = collection(db, 'missions');
        const missionsList: (Mission & { applicationStatus?: string })[] = [];
        
        // Récupérer chaque mission individuellement
        for (const missionId of missionIds) {
          try {
            const missionDoc = await getDoc(doc(db, 'missions', missionId));
            if (missionDoc.exists()) {
              missionsList.push({
                id: missionDoc.id,
                ...missionDoc.data(),
                applicationStatus: applicationStatusMap[missionId] || 'Postulé'
              } as Mission & { applicationStatus?: string });
            }
          } catch (error) {
            console.error(`Erreur lors de la récupération de la mission ${missionId}:`, error);
          }
        }
        
        setMissions(missionsList as Mission[]);
      } else {
        // Pour admin/member/superadmin : récupérer les missions de leur structure
        if (userData.structureId) {
          const missionsRef = collection(db, 'missions');
          const q = query(missionsRef, where('structureId', '==', userData.structureId));
          const querySnapshot = await getDocs(q);
          const fetchedMissions = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Mission[];
          setMissions(fetchedMissions);
        } else {
          setMissions([]);
        }
      }
    } catch (error) {
      console.error('Erreur fetch missions:', error);
      // Ne pas bloquer l'UI pour les missions
      setMissions([]);
    } finally {
      setLoadingMissions(false);
    }
  };

  const checkReports = async () => {
    if (!currentUser) return;
    try {
        const reportsRef = collection(db, 'reports');
        const q = query(reportsRef, where('userId', '==', currentUser.uid), limit(1));
        const snapshot = await getDocs(q);
        setHasReports(!snapshot.empty);
    } catch (e) {
        console.error("Erreur check reports", e);
    }
  };

  useEffect(() => {
    fetchUserData();
    checkReports();
  }, [currentUser]);

  useEffect(() => {
    if (userData) {
      fetchMissions();
    }
  }, [userData]);

  // Gérer l'ouverture de l'onglet depuis l'URL
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'missions') {
      // L'onglet missions est l'index 1
      setTabValue(1);
      // Nettoyer le paramètre de l'URL
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading || !userData) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Skeleton variant="rectangular" height={200} sx={{ mb: 2, borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
      </Container>
    );
  }

    return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <ProfileHeader userData={userData} onUpdate={fetchUserData} />

      <Box sx={{ width: '100%' }}>
        <Paper elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            aria-label="profile tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab icon={<PersonIcon />} iconPosition="start" label="Mes informations" />
            <Tab icon={<AssignmentIcon />} iconPosition="start" label="Mes missions" />
            <Tab icon={<DescriptionIcon />} iconPosition="start" label="Mes documents" />
            {hasReports && <Tab icon={<BugReportIcon />} iconPosition="start" label="Signalements" />}
            <Tab icon={<SecurityIcon />} iconPosition="start" label="Sécurité" />
          </Tabs>
                </Paper>

        <TabPanel value={tabValue} index={0}>
          <Paper elevation={0} variant="outlined" sx={{ p: 3 }}>
            <ProfileInfoForm userData={userData} onUpdate={fetchUserData} />
                      </Paper>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
           {loadingMissions ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
               <Skeleton variant="rectangular" width="100%" height={200} />
                    </Box>
                  ) : (
             <MissionsList missions={missions} isStudent={userData?.status === 'etudiant'} />
           )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <DocumentsTab userData={userData} onUpdate={fetchUserData} />
        </TabPanel>

        {hasReports && (
          <TabPanel value={tabValue} index={3}>
            <ReportsTab />
          </TabPanel>
        )}

        <TabPanel value={tabValue} index={hasReports ? 4 : 3}>
          <SecurityTab userData={userData} onUpdate={fetchUserData} />
        </TabPanel>
                              </Box>

    </Container>
  );
};

export default Profile;
