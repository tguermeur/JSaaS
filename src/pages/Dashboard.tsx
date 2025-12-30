import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  Container,
  Avatar,
  Divider,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert
} from '@mui/material';
import { 
  Logout as LogoutIcon,
  Person as PersonIcon,
  Dashboard as DashboardIcon,
  AttachMoney as AttachMoneyIcon,
  Assignment as AssignmentIcon,
  Work as WorkIcon,
  Group as GroupIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../firebase/auth';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';

interface Mission {
  id: string;
  numeroMission: string;
  title: string;
  startDate: string;
  endDate: string;
  company: string;
  description: string;
}

interface Statistics {
  totalRevenue: number;
  totalMissions: number;
  activeMissions: number;
  totalStudents: number;
}

interface ConnectedUser {
  id: string;
  firstName: string;
  lastName: string;
  lastConnection: Date;
  isOnline: boolean;
  role: string;
  photoURL?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  description?: string;
  structureId: string;
  createdBy: string;
  isCustomEvent: boolean;
  isRelanceReminder?: boolean;
}

// Ajouter cette fonction utilitaire pour l'animation du compteur
const useCountAnimation = (targetValue: number, duration: number = 2000) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      // Fonction d'easing pour une animation plus naturelle
      const easeOutQuart = (x: number): number => {
        return 1 - Math.pow(1 - x, 4);
      };
      
      const currentCount = Math.floor(easeOutQuart(progress) * targetValue);
      setCount(currentCount);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [targetValue, duration]);

  return count;
};

export default function Dashboard(): JSX.Element {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({
    totalRevenue: 0,
    totalMissions: 0,
    activeMissions: 0,
    totalStudents: 0
  });
  const [openEventDialog, setOpenEventDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [eventForm, setEventForm] = useState({
    title: '',
    startDate: '',
    endDate: '',
    description: ''
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  // Utiliser l'animation du compteur
  const animatedRevenue = useCountAnimation(statistics.totalRevenue);

  // Déterminer le rôle de l'utilisateur
  const userStatus = userData?.status;
  const isEntreprise = userStatus === 'entreprise';
  const isEtudiant = userStatus === 'etudiant';
  const isJuniorEntreprise = ['admin_structure', 'admin', 'membre', 'superadmin'].includes(userStatus || '');

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/');
    } catch (error) {
      console.error("Erreur lors de la déconnexion", error);
    }
  };

  useEffect(() => {
    const fetchMissions = async () => {
      if (!currentUser) return;

      try {
        console.log('Email de l\'utilisateur connecté:', currentUser.email);
        
        // Récupérer les données de l'utilisateur pour obtenir son structureId
        const userDoc = await getDocs(query(collection(db, 'users'), where('email', '==', currentUser.email)));
        if (userDoc.empty) {
          console.error('Aucun utilisateur trouvé avec cet email');
          return;
        }
        
        const userData = userDoc.docs[0].data();
        const userStructureId = userData.structureId;

        console.log('Structure ID de l\'utilisateur:', userStructureId);
        console.log('Données complètes de l\'utilisateur:', userData);

        // Vérifier d'abord si la collection users existe
        const usersRef = collection(db, 'users');
        const usersQuery = query(usersRef, where('structureId', '==', userStructureId));
        const allUsersSnapshot = await getDocs(usersQuery);
        
        // Debug logs détaillés
        console.log('Requête utilisateurs:', {
          structureId: userStructureId,
          nombreUtilisateurs: allUsersSnapshot.docs.length,
          premierUtilisateur: allUsersSnapshot.docs[0]?.data(),
          tousLesUtilisateurs: allUsersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
        });

        // Pour un superadmin, on utilise directement le nombre total d'utilisateurs de la structure
        const totalUsers = allUsersSnapshot.docs.length;

        // Récupérer toutes les missions de la structure
        const missionsRef = collection(db, 'missions');
        const missionsQuery = query(
          missionsRef, 
          where('invoiceStatus', '==', 'paid'),
          where('structureId', '==', userStructureId)
        );
        const missionsSnapshot = await getDocs(missionsQuery);
        
        // Calculer le CA à partir des missions payées
        const totalRevenue = missionsSnapshot.docs.reduce((sum, doc) => {
          const mission = doc.data();
          return sum + (mission.totalTTC || 0);
        }, 0);

        // Récupérer toutes les missions de la structure pour le comptage total et le calendrier
        const allMissionsQuery = query(
          missionsRef,
          where('structureId', '==', userStructureId)
        );
        const allMissionsSnapshot = await getDocs(allMissionsQuery);

        const activeMissions = allMissionsSnapshot.docs.filter(doc => {
          const mission = doc.data();
          const endDate = new Date(mission.endDate);
          return endDate >= new Date();
        }).length;

        // Transformer les missions pour le calendrier
        const missionsList: Mission[] = allMissionsSnapshot.docs
          .filter(doc => {
            const mission = doc.data();
            // Filtrer les missions qui ont au moins une date de début valide
            return mission.startDate;
          })
          .map(doc => {
            const data = doc.data();
            // Convertir les dates en format ISO string pour FullCalendar
            let startDate = '';
            let endDate = '';
            
            if (data.startDate) {
              // Si c'est un Timestamp Firestore, le convertir
              if (data.startDate.toDate && typeof data.startDate.toDate === 'function') {
                startDate = data.startDate.toDate().toISOString().split('T')[0];
              } else if (typeof data.startDate === 'string') {
                // Si c'est déjà une string, vérifier le format
                startDate = data.startDate.includes('T') 
                  ? data.startDate.split('T')[0] 
                  : data.startDate;
              } else {
                startDate = new Date(data.startDate).toISOString().split('T')[0];
              }
            }
            
            if (data.endDate) {
              // Si c'est un Timestamp Firestore, le convertir
              if (data.endDate.toDate && typeof data.endDate.toDate === 'function') {
                endDate = data.endDate.toDate().toISOString().split('T')[0];
              } else if (typeof data.endDate === 'string') {
                // Si c'est déjà une string, vérifier le format
                endDate = data.endDate.includes('T') 
                  ? data.endDate.split('T')[0] 
                  : data.endDate;
              } else {
                endDate = new Date(data.endDate).toISOString().split('T')[0];
              }
            }

            return {
              id: doc.id,
              numeroMission: data.numeroMission || '',
              title: data.company || 'Mission sans titre',
              startDate: startDate,
              endDate: endDate,
              company: data.company || '',
              description: data.description || ''
            };
          });

        // Stocker les missions pour le calendrier
        setMissions(missionsList);

        setStatistics({
          totalRevenue,
          totalMissions: allMissionsSnapshot.docs.length,
          activeMissions,
          totalStudents: totalUsers
        });
      } catch (error) {
        console.error("Erreur lors du chargement des missions:", error);
      }
    };

    const fetchData = async () => {
      if (!currentUser) return;

      try {
        console.log('Email de l\'utilisateur connecté:', currentUser.email);
        
        // Récupérer les données de l'utilisateur pour obtenir son structureId
        const userDoc = await getDocs(query(collection(db, 'users'), where('email', '==', currentUser.email)));
        if (userDoc.empty) {
          console.error('Aucun utilisateur trouvé avec cet email');
          return;
        }
        
        const userData = userDoc.docs[0].data();
        const userStructureId = userData.structureId;

        console.log('Structure ID de l\'utilisateur:', userStructureId);
        console.log('Données complètes de l\'utilisateur:', userData);

        // Vérifier d'abord si la collection users existe
        const usersRef = collection(db, 'users');
        const usersQuery = query(usersRef, where('structureId', '==', userStructureId));
        const allUsersSnapshot = await getDocs(usersQuery);
        
        // Debug logs détaillés
        console.log('Requête utilisateurs:', {
          structureId: userStructureId,
          nombreUtilisateurs: allUsersSnapshot.docs.length,
          premierUtilisateur: allUsersSnapshot.docs[0]?.data(),
          tousLesUtilisateurs: allUsersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
        });

        // Pour un superadmin, on utilise directement le nombre total d'utilisateurs de la structure
        const totalUsers = allUsersSnapshot.docs.length;

        // Récupérer toutes les missions de la structure
        const missionsRef = collection(db, 'missions');
        const missionsQuery = query(
          missionsRef, 
          where('invoiceStatus', '==', 'paid'),
          where('structureId', '==', userStructureId)
        );
        const missionsSnapshot = await getDocs(missionsQuery);
        
        // Calculer le CA à partir des missions payées
        const totalRevenue = missionsSnapshot.docs.reduce((sum, doc) => {
          const mission = doc.data();
          return sum + (mission.totalTTC || 0);
        }, 0);

        // Récupérer toutes les missions de la structure pour le comptage total et le calendrier
        const allMissionsQuery = query(
          missionsRef,
          where('structureId', '==', userStructureId)
        );
        const allMissionsSnapshot = await getDocs(allMissionsQuery);

        const activeMissions = allMissionsSnapshot.docs.filter(doc => {
          const mission = doc.data();
          const endDate = new Date(mission.endDate);
          return endDate >= new Date();
        }).length;

        // Transformer les missions pour le calendrier
        const missionsList: Mission[] = allMissionsSnapshot.docs
          .filter(doc => {
            const mission = doc.data();
            // Filtrer les missions qui ont au moins une date de début valide
            return mission.startDate;
          })
          .map(doc => {
            const data = doc.data();
            // Convertir les dates en format ISO string pour FullCalendar
            let startDate = '';
            let endDate = '';
            
            if (data.startDate) {
              // Si c'est un Timestamp Firestore, le convertir
              if (data.startDate.toDate && typeof data.startDate.toDate === 'function') {
                startDate = data.startDate.toDate().toISOString().split('T')[0];
              } else if (typeof data.startDate === 'string') {
                // Si c'est déjà une string, vérifier le format
                startDate = data.startDate.includes('T') 
                  ? data.startDate.split('T')[0] 
                  : data.startDate;
              } else {
                startDate = new Date(data.startDate).toISOString().split('T')[0];
              }
            }
            
            if (data.endDate) {
              // Si c'est un Timestamp Firestore, le convertir
              if (data.endDate.toDate && typeof data.endDate.toDate === 'function') {
                endDate = data.endDate.toDate().toISOString().split('T')[0];
              } else if (typeof data.endDate === 'string') {
                // Si c'est déjà une string, vérifier le format
                endDate = data.endDate.includes('T') 
                  ? data.endDate.split('T')[0] 
                  : data.endDate;
              } else {
                endDate = new Date(data.endDate).toISOString().split('T')[0];
              }
            }

            return {
              id: doc.id,
              numeroMission: data.numeroMission || '',
              title: data.company || 'Mission sans titre',
              startDate: startDate,
              endDate: endDate,
              company: data.company || '',
              description: data.description || ''
            };
          });

        // Stocker les missions pour le calendrier
        setMissions(missionsList);

        setStatistics({
          totalRevenue,
          totalMissions: allMissionsSnapshot.docs.length,
          activeMissions,
          totalStudents: totalUsers
        });

        // Récupérer les événements personnalisés
        const eventsRef = collection(db, 'calendarEvents');
        const eventsQuery = query(eventsRef, where('structureId', '==', userStructureId));
        const eventsSnapshot = await getDocs(eventsQuery);

        const eventsList: CalendarEvent[] = eventsSnapshot.docs
          .map(doc => {
            const data = doc.data();
            let startDate = '';
            let endDate = '';

            if (data.startDate) {
              if (data.startDate.toDate && typeof data.startDate.toDate === 'function') {
                startDate = data.startDate.toDate().toISOString().split('T')[0];
              } else if (typeof data.startDate === 'string') {
                startDate = data.startDate.includes('T') 
                  ? data.startDate.split('T')[0] 
                  : data.startDate;
              } else {
                startDate = new Date(data.startDate).toISOString().split('T')[0];
              }
            }

            if (data.endDate) {
              if (data.endDate.toDate && typeof data.endDate.toDate === 'function') {
                endDate = data.endDate.toDate().toISOString().split('T')[0];
              } else if (typeof data.endDate === 'string') {
                endDate = data.endDate.includes('T') 
                  ? data.endDate.split('T')[0] 
                  : data.endDate;
              } else {
                endDate = new Date(data.endDate).toISOString().split('T')[0];
              }
            } else {
              endDate = startDate;
            }

            return {
              id: doc.id,
              title: data.title || '',
              startDate: startDate,
              endDate: endDate,
              description: data.description || '',
              structureId: data.structureId || '',
              createdBy: data.createdBy || '',
              isCustomEvent: true
            };
          });

        // Récupérer les prospects avec dateRecontact pour afficher les relances dans le calendrier
        const prospectsRef = collection(db, 'prospects');
        const prospectsQuery = query(
          prospectsRef,
          where('structureId', '==', userStructureId),
          where('statut', '==', 'a_recontacter')
        );
        const prospectsSnapshot = await getDocs(prospectsQuery);
        
        const relanceEvents: CalendarEvent[] = prospectsSnapshot.docs
          .filter(doc => {
            const data = doc.data();
            return data.dateRecontact;
          })
          .map(doc => {
            const data = doc.data();
            const prospectName = data.nom || data.name || 'Contact';
            return {
              id: `relance-${doc.id}`,
              title: `Relance: ${prospectName}`,
              startDate: data.dateRecontact,
              endDate: data.dateRecontact,
              description: `Relance prévue pour ${prospectName}${data.entreprise || data.company ? ` - ${data.entreprise || data.company}` : ''}`,
              structureId: userStructureId,
              createdBy: data.ownerId || '',
              isCustomEvent: false,
              isRelanceReminder: true
            };
          });

        // Ajouter les événements de relance aux événements du calendrier
        setCalendarEvents([...eventsList, ...relanceEvents]);
      } catch (error) {
        console.error("Erreur lors du chargement des données:", error);
      }
    };

    fetchData();
  }, [currentUser, userData.structureId]);

  useEffect(() => {
    const fetchConnectedUsers = async () => {
      if (!currentUser) return;

      try {
        const userDoc = await getDocs(query(collection(db, 'users'), where('email', '==', currentUser.email)));
        if (userDoc.empty) return;

        const userData = userDoc.docs[0].data();
        const userStructureId = userData.structureId;

        // Récupérer tous les utilisateurs de la structure
        const usersRef = collection(db, 'users');
        const usersQuery = query(usersRef, where('structureId', '==', userStructureId));
        const usersSnapshot = await getDocs(usersQuery);

        const now = new Date();
        const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);

        const users = usersSnapshot.docs.map(doc => {
          const data = doc.data();
          const lastConnection = data.lastLogin ? new Date(data.lastLogin.toDate()) : new Date(0);
          return {
            id: doc.id,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            lastConnection,
            isOnline: lastConnection > threeMinutesAgo,
            role: data.role || 'membre',
            photoURL: data.photoURL || ''
          };
        });

        // Trier par date de dernière connexion (les plus récentes d'abord)
        users.sort((a, b) => b.lastConnection.getTime() - a.lastConnection.getTime());

        // Prendre les 3 premiers
        setConnectedUsers(users.slice(0, 3));
      } catch (error) {
        console.error("Erreur lors du chargement des utilisateurs connectés:", error);
      }
    };

    fetchConnectedUsers();
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchConnectedUsers, 30000);

    return () => clearInterval(interval);
  }, [currentUser]);

  // Fonction pour obtenir les initiales si pas de photo
  const getInitials = () => {
    if (currentUser?.displayName) {
      return currentUser.displayName.charAt(0).toUpperCase();
    }
    return currentUser?.email?.charAt(0).toUpperCase() || 'U';
  };

  // Fonction pour obtenir le nom d'affichage de l'utilisateur
  const getDisplayName = () => {
    if (userData?.firstName && userData?.lastName) {
      return `${userData.firstName} ${userData.lastName}`;
    }
    if (currentUser?.displayName) {
      return currentUser.displayName;
    }
    if (currentUser?.email) {
      return currentUser.email.split('@')[0];
    }
    return 'Utilisateur';
  };

  const handleEventClick = (info: any) => {
    const eventId = info.event.id;
    const extendedProps = info.event.extendedProps;
    
    // Si c'est un événement de relance, naviguer vers le prospect
    if (extendedProps?.isRelanceReminder) {
      const prospectId = eventId.replace('relance-', '');
      navigate(`/prospect/${prospectId}`);
      return;
    }
    
    // Vérifier si c'est une mission ou un événement personnalisé
    const mission = missions.find(m => m.id === eventId);
    if (mission) {
      navigate(`/app/mission/${mission.numeroMission}`);
      return;
    }
    
    // Si c'est un événement personnalisé, on peut ouvrir un dialogue d'édition ou simplement ne rien faire
    // Pour l'instant, on ne fait rien avec les événements personnalisés au clic
  };

  const handleDateClick = (info: any) => {
    const date = info.dateStr;
    setSelectedDate(date);
    setEventForm({
      title: '',
      startDate: date,
      endDate: date,
      description: ''
    });
    setOpenEventDialog(true);
  };

  const handleCloseEventDialog = () => {
    setOpenEventDialog(false);
    setEventForm({
      title: '',
      startDate: '',
      endDate: '',
      description: ''
    });
  };

  const handleSaveEvent = async () => {
    if (!currentUser || !eventForm.title || !eventForm.startDate) {
      setSnackbar({
        open: true,
        message: 'Veuillez remplir au moins le titre et la date de début',
        severity: 'error'
      });
      return;
    }

    try {
      // Récupérer le structureId de l'utilisateur
      const userDoc = await getDocs(query(collection(db, 'users'), where('email', '==', currentUser.email)));
      if (userDoc.empty) {
        setSnackbar({
          open: true,
          message: 'Erreur: utilisateur non trouvé',
          severity: 'error'
        });
        return;
      }

      const userData = userDoc.docs[0].data();
      const userStructureId = userData.structureId;

      // Créer l'événement dans Firestore
      const eventData = {
        title: eventForm.title,
        startDate: eventForm.startDate,
        endDate: eventForm.endDate || eventForm.startDate,
        description: eventForm.description || '',
        structureId: userStructureId,
        createdBy: currentUser.uid,
        createdAt: Timestamp.now(),
        isCustomEvent: true
      };

      const docRef = await addDoc(collection(db, 'calendarEvents'), eventData);

      // Ajouter l'événement à l'état local avec l'ID Firestore
      const newEvent: CalendarEvent = {
        id: docRef.id,
        title: eventForm.title,
        startDate: eventForm.startDate,
        endDate: eventForm.endDate || eventForm.startDate,
        description: eventForm.description,
        structureId: userStructureId,
        createdBy: currentUser.uid,
        isCustomEvent: true
      };

      setCalendarEvents([...calendarEvents, newEvent]);

      setSnackbar({
        open: true,
        message: 'Événement créé avec succès',
        severity: 'success'
      });

      handleCloseEventDialog();
    } catch (error) {
      console.error('Erreur lors de la création de l\'événement:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la création de l\'événement',
        severity: 'error'
      });
    }
  };

  // Ajouter cette fonction pour générer une couleur cohérente basée sur le numéro de mission
  const getMissionColor = (numeroMission: string) => {
    const colors = [
      { bg: '#FF2D5530', text: '#FF2D55' }, // Rouge
      { bg: '#5856D630', text: '#5856D6' }, // Violet
      { bg: '#FF950030', text: '#FF9500' }, // Orange
      { bg: '#34C75930', text: '#34C759' }, // Vert
      { bg: '#007AFF30', text: '#007AFF' }, // Bleu
      { bg: '#AF52DE30', text: '#AF52DE' }, // Violet foncé
      { bg: '#32ADE630', text: '#32ADE6' }, // Bleu clair
    ];
    
    // Utiliser le numéro de mission pour choisir une couleur de manière cohérente
    const index = numeroMission.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  // Dashboard simplifié pour les Entreprises
  if (isEntreprise) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Typography variant="h4" sx={{ mb: 4, fontWeight: 600 }}>
            Tableau de bord Entreprise
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card elevation={0} sx={{ borderRadius: '12px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Mes Missions
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    {statistics.totalMissions} mission(s) au total
                  </Typography>
                  <Button 
                    variant="contained" 
                    startIcon={<AddIcon />}
                    onClick={() => navigate('/app/mission?new=true')}
                    sx={{ mt: 2 }}
                  >
                    Nouvelle Mission
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card elevation={0} sx={{ borderRadius: '12px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Facturation
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Consultez vos factures et devis
                  </Typography>
                  <Button 
                    variant="outlined"
                    onClick={() => navigate('/app/profile?tab=billing')}
                    sx={{ mt: 2 }}
                  >
                    Voir mes factures
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Container>
    );
  }

  // Dashboard simplifié pour les Étudiants
  if (isEtudiant) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Typography variant="h4" sx={{ mb: 4, fontWeight: 600 }}>
            Espace Candidat
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card elevation={0} sx={{ borderRadius: '12px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Missions disponibles
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    Découvrez les missions qui correspondent à votre profil
                  </Typography>
                  <Button 
                    variant="contained" 
                    onClick={() => navigate('/app/available-missions')}
                    sx={{ mt: 2 }}
                  >
                    Voir les missions
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card elevation={0} sx={{ borderRadius: '12px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Mon Profil & Documents
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    Gérez votre profil et vos documents (CV, RIB, Pièce d'identité)
                  </Typography>
                  <Button 
                    variant="outlined"
                    onClick={() => navigate('/app/profile')}
                    sx={{ mt: 2 }}
                  >
                    Accéder à mon profil
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Container>
    );
  }

  // Dashboard complet pour les Junior-Entreprises (comportement par défaut)
  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Statistiques */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card 
              elevation={0}
              sx={{
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                height: '100%'
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: '#007AFF20',
                      color: '#007AFF',
                      mr: 2
                    }}
                  >
                    <AttachMoneyIcon />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 500 }}>
                    Chiffre d'affaires
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                  {animatedRevenue.toLocaleString('fr-FR')} €
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total des revenus TTC (factures payées)
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card 
              elevation={0}
              sx={{
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                height: '100%'
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: '#34C75920',
                      color: '#34C759',
                      mr: 2
                    }}
                  >
                    <AssignmentIcon />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 500 }}>
                    Missions totales
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                  {statistics.totalMissions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Nombre total de missions
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card 
              elevation={0}
              sx={{
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                height: '100%'
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: '#FF950020',
                      color: '#FF9500',
                      mr: 2
                    }}
                  >
                    <WorkIcon />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 500 }}>
                    Missions en cours
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                  {statistics.activeMissions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Missions actives
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card 
              elevation={0}
              sx={{
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                height: '100%'
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: '#5856D620',
                      color: '#5856D6',
                      mr: 2
                    }}
                  >
                    <GroupIcon />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 500 }}>
                    Utilisateurs
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                  {statistics.totalStudents}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Utilisateurs inscrits dans la structure
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card 
              elevation={0}
              sx={{
                borderRadius: '24px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                height: '100%',
                overflow: 'hidden'
              }}
            >
              <CardContent sx={{ p: '24px !important' }}>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  mb: 3 
                }}>
                  <Typography variant="h6" sx={{ 
                    fontWeight: 600,
                    color: '#1d1d1f',
                    fontSize: '1.25rem'
                  }}>
                    Calendrier des missions
                  </Typography>
                  <Button
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setEventForm({
                        title: '',
                        startDate: today,
                        endDate: today,
                        description: ''
                      });
                      setOpenEventDialog(true);
                    }}
                    sx={{
                      minWidth: '40px',
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: '#007AFF',
                      color: '#fff',
                      padding: 0,
                      '&:hover': {
                        backgroundColor: '#0051D5',
                      },
                      '& .MuiSvgIcon-root': {
                        fontSize: '1.5rem'
                      }
                    }}
                  >
                    <AddIcon />
                  </Button>
                </Box>
                <Box sx={{ 
                  '.fc': { 
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                  },
                  // Style de l'en-tête du calendrier
                  '.fc-toolbar': {
                    mb: 2,
                  },
                  '.fc-toolbar-title': { 
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    color: '#1d1d1f',
                    textTransform: 'capitalize'
                  },
                  // Style des boutons de navigation
                  '.fc-button': {
                    textTransform: 'capitalize',
                    borderRadius: '12px',
                    boxShadow: 'none',
                    border: 'none',
                    backgroundColor: '#f5f5f7',
                    color: '#1d1d1f',
                    fontWeight: 500,
                    padding: '8px 16px',
                    '&:hover': {
                      backgroundColor: '#e5e5ea',
                    },
                    '&:focus': {
                      boxShadow: 'none',
                    }
                  },
                  '.fc-button-active': {
                    backgroundColor: '#007AFF !important',
                    color: '#fff !important',
                  },
                  // Style de l'en-tête des jours
                  '.fc-col-header': {
                    'th': {
                      borderWidth: 0,
                      padding: '12px 0',
                    },
                    '.fc-col-header-cell-cushion': {
                      color: '#86868b',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      fontSize: '0.75rem',
                      padding: '4px 0',
                    }
                  },
                  // Style des cellules
                  '.fc-daygrid-day': {
                    borderColor: '#f5f5f7',
                    '&:hover': {
                      backgroundColor: '#f5f5f7',
                    }
                  },
                  '.fc-daygrid-day-frame': {
                    padding: '2px',
                  },
                  '.fc-daygrid-day-number': {
                    fontSize: '0.875rem',
                    color: '#1d1d1f',
                    opacity: 0.8,
                    padding: '8px',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '4px',
                  },
                  // Style des événements
                  '.fc-event': {
                    borderRadius: '10px',
                    padding: '1px 8px',
                    marginBottom: '1px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: 'none',
                    minHeight: '22px',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      filter: 'brightness(0.95)',
                    }
                  },
                  '.fc-event-main': {
                    padding: '1px 4px',
                  },
                  '.fc-event-title': {
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    padding: '1px 0',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  },
                  '.fc-event-time': {
                    fontSize: '0.7rem',
                    fontWeight: 400,
                  },
                  // Style des jours hors mois
                  '.fc-day-other': {
                    backgroundColor: '#fafafa',
                    '.fc-daygrid-day-number': {
                      opacity: 0.5,
                    }
                  },
                  // Style du jour actuel
                  '.fc-day-today': {
                    backgroundColor: '#007AFF08 !important',
                    '.fc-daygrid-day-number': {
                      backgroundColor: '#007AFF',
                      color: '#fff',
                      fontWeight: 600,
                    }
                  },
                  // Style pour le lien "plus"
                  '.fc-more-link': {
                    backgroundColor: '#f5f5f7',
                    borderRadius: '10px',
                    padding: '2px 8px',
                    margin: '2px 4px',
                    color: '#1d1d1f',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    '&:hover': {
                      backgroundColor: '#e5e5ea',
                      textDecoration: 'none',
                    }
                  },
                }}>
                  <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    locale={frLocale}
                    events={[
                      // Missions
                      ...missions.map(mission => {
                        const color = getMissionColor(mission.numeroMission);
                        // FullCalendar utilise des dates exclusives pour la date de fin
                        // Il faut ajouter 1 jour pour que la mission s'affiche jusqu'à la date de fin incluse
                        let endDate = mission.endDate;
                        if (mission.endDate && mission.endDate !== mission.startDate) {
                          const end = new Date(mission.endDate);
                          end.setDate(end.getDate() + 1);
                          endDate = end.toISOString().split('T')[0];
                        }
                        return {
                          id: mission.id,
                          title: mission.numeroMission,
                          start: mission.startDate,
                          end: endDate || undefined,
                          backgroundColor: color.bg,
                          textColor: color.text,
                          borderColor: 'transparent',
                          extendedProps: {
                            description: mission.description,
                            isMission: true
                          }
                        };
                      }),
                      // Événements personnalisés
                      ...calendarEvents.map(event => {
                        let endDate = event.endDate;
                        if (event.endDate && event.endDate !== event.startDate) {
                          const end = new Date(event.endDate);
                          end.setDate(end.getDate() + 1);
                          endDate = end.toISOString().split('T')[0];
                        }
                        return {
                          id: event.id,
                          title: event.title,
                          start: event.startDate,
                          end: endDate || undefined,
                          backgroundColor: event.isRelanceReminder ? '#ff9f0a30' : '#86868b30',
                          textColor: event.isRelanceReminder ? '#ff9f0a' : '#86868b',
                          borderColor: 'transparent',
                          extendedProps: {
                            description: event.description,
                            isCustomEvent: true,
                            isRelanceReminder: event.isRelanceReminder || false
                          }
                        };
                      })
                    ]}
                    eventClick={handleEventClick}
                    dateClick={handleDateClick}
                    headerToolbar={{
                      left: 'prev,next',
                      center: 'title',
                      right: 'today'
                    }}
                    height="650px"
                    dayMaxEvents={4}
                    moreLinkContent={(args) => (
                      <Typography sx={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 500
                      }}>
                        +{args.num} autres
                      </Typography>
                    )}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          {/* Nouvelle carte pour les utilisateurs connectés */}
          <Grid item xs={12} md={4}>
            <Card 
              elevation={0}
              sx={{
                borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}
            >
              <CardContent sx={{ p: '20px !important' }}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    mb: 2, 
                    fontWeight: 600,
                    fontSize: '1.1rem',
                    color: '#1d1d1f'
                  }}
                >
                  Dernières connexions
                </Typography>
                
                {connectedUsers.map((user) => (
                  <Box 
                    key={user.id}
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 2,
                      p: 1.5,
                      borderRadius: '12px',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.03)'
                      }
                    }}
                  >
                    <Box sx={{ position: 'relative', mr: 2 }}>
                      <Avatar 
                        src={user.photoURL}
                        sx={{ 
                          width: 44, 
                          height: 44,
                          border: '2px solid #fff',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                          bgcolor: user.isOnline ? '#34C759' : '#f5f5f7',
                          color: user.isOnline ? '#fff' : '#1d1d1f'
                        }}
                      >
                        {!user.photoURL && `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`}
                      </Avatar>
                      {user.isOnline && (
                        <Box 
                          sx={{ 
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            backgroundColor: '#34C759',
                            border: '2px solid #fff',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                          }} 
                        />
                      )}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography 
                        variant="subtitle2" 
                        sx={{ 
                          fontWeight: 600,
                          color: '#1d1d1f',
                          fontSize: '0.9rem'
                        }}
                      >
                        {user.firstName} {user.lastName}
                      </Typography>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: user.isOnline ? '#34C759' : '#86868b',
                          fontWeight: user.isOnline ? 600 : 400,
                          fontSize: '0.75rem'
                        }}
                      >
                        {user.isOnline ? 'En ligne' : `Dernière connexion: ${user.lastConnection.toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}`}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Dialogue pour créer un événement */}
      <Dialog 
        open={openEventDialog} 
        onClose={handleCloseEventDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Ajouter un événement
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Titre de l'événement"
              fullWidth
              required
              value={eventForm.title}
              onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
            />
            <TextField
              label="Date de début"
              type="date"
              fullWidth
              required
              value={eventForm.startDate}
              onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
              InputLabelProps={{
                shrink: true,
              }}
            />
            <TextField
              label="Date de fin"
              type="date"
              fullWidth
              value={eventForm.endDate}
              onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
              InputLabelProps={{
                shrink: true,
              }}
              helperText="Laissez vide pour un événement d'un jour"
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={eventForm.description}
              onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEventDialog}>
            Annuler
          </Button>
          <Button 
            onClick={handleSaveEvent} 
            variant="contained"
            startIcon={<AddIcon />}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar pour les notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
} 