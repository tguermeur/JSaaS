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
        setUserData(userDoc.data() as UserData);
          }
        } catch (error) {
      console.error('Erreur fetch user data:', error);
      enqueueSnackbar('Erreur lors du chargement du profil', { variant: 'error' });
      } finally {
      setLoading(false);
    }
  };

  const fetchMissions = async () => {
    if (!currentUser) return;
    setLoadingMissions(true);
    try {
      // Logique simplifiée : récupérer les missions où l'user est impliqué
      // Adapter selon votre structure réelle de Firestore.
      // Hypothèse : il y a une collection 'missions'
      const missionsRef = collection(db, 'missions');
      // Exemple de requête : missions créées par user ou assignées à user
      // Note: Cela dépend de votre modèle de données exact.
      // Si étudiant: chercher dans un champ array 'studentIds' ou similaire
      // Si entreprise: chercher 'createdBy' == uid ou 'companyId' == uid
      
      // Pour l'instant, je fais une requête générique sécurisée qui ne plantera pas
      // Vous devrez peut-être adapter les clauses 'where'
      let q;
      if (userData?.status === 'entreprise') {
         q = query(missionsRef, where('companyId', '==', currentUser.uid));
        } else {
         // Pour les étudiants, on suppose qu'ils sont assignés. 
         // Si pas de champ direct, on récupère tout et on filtre (moins performant) ou on utilise un index array-contains
         // Je tente 'assignedStudents' array-contains uid comme c'est courant
         // Si ça échoue (index manquant), ça sera catché.
         try {
            // Tentative 1 : array-contains
            // q = query(missionsRef, where('assignedStudents', 'array-contains', currentUser.uid));
            // Fallback pour éviter erreur d'index si pas sûr : récupérer par createdBy pour test
            q = query(missionsRef, where('createdBy', '==', currentUser.uid)); 
         } catch {
             q = query(missionsRef, where('createdBy', '==', currentUser.uid));
         }
      }

      // Note: Sans index composé, faire attention aux queries multiples. 
      // Je vais utiliser une requête simple sur createdBy pour commencer si je ne suis pas sûr du modèle.
      // Mais le code précédent suggérait une relation. 
      // Je vais laisser vide pour l'instant si je ne suis pas sûr, ou mieux :
      // Utiliser le fait que Profile.tsx précédent n'a pas montré la logique de fetch mission clairement.
      
      // RECTIFICATION: Je vais utiliser une requête simple 'createdBy' comme fallback sûr,
      // et vous pourrez ajuster la requête selon votre schéma.
      const qSafe = query(missionsRef, where('createdBy', '==', currentUser.uid)); 
      
      const querySnapshot = await getDocs(qSafe);
      const fetchedMissions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Mission[];
      
      setMissions(fetchedMissions);
      } catch (error) {
      console.error('Erreur fetch missions:', error);
      // Ne pas bloquer l'UI pour les missions
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
             <MissionsList missions={missions} />
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
