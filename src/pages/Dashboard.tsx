import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  Alert,
  Tabs,
  Tab,
  Chip,
  CircularProgress
} from '@mui/material';
import { 
  Logout as LogoutIcon,
  Person as PersonIcon,
  Dashboard as DashboardIcon,
  AttachMoney as AttachMoneyIcon,
  Assignment as AssignmentIcon,
  Work as WorkIcon,
  Group as GroupIcon,
  Add as AddIcon,
  Description as DescriptionIcon,
  ArrowForward as ArrowForwardIcon,
  Business as BusinessIcon,
  PersonAdd as PersonAddIcon,
  Folder as FolderIcon
} from '@mui/icons-material';
import EnterpriseMissionForm from '../components/missions/EnterpriseMissionForm';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { logoutUser } from '../firebase/auth';
import { collection, query, where, getDocs, addDoc, Timestamp, getDoc, doc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Document, Folder } from '../types/document';
import { decryptUsersList, getDecryptedUserDisplayName } from '../utils/decryptUserUtils';
import { usePermission } from '../hooks/usePermission';
import AccessDenied from '../components/common/AccessDenied';
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
  status?: string;
  createdAt?: any;
  companyId?: string;
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
  const { currentUser, userData, isContactWithAccess, contactPermissions } = useAuth();
  const { canRead, canWrite, loading: permissionLoading } = usePermission('dashboard');
  const navigate = useNavigate();
  const location = useLocation();
  
  // Rediriger les contacts avec accès vers available-missions (une seule fois)
  // Utiliser useRef pour éviter les redirections multiples
  const hasRedirectedRef = useRef(false);
  
  useEffect(() => {
    // Ne rediriger qu'une seule fois et seulement si on est vraiment sur le dashboard
    if (!hasRedirectedRef.current && 
        location.pathname === '/app/dashboard' && 
        isContactWithAccess && 
        userData?.status === 'entreprise' && 
        contactPermissions?.canViewEvents) {
      hasRedirectedRef.current = true;
      // Utiliser un timeout pour éviter les redirections multiples
      const timeoutId = setTimeout(() => {
        navigate('/app/available-missions', { replace: true });
      }, 200);
      
      return () => clearTimeout(timeoutId);
    }
  }, [location.pathname, isContactWithAccess, userData?.status, contactPermissions?.canViewEvents, navigate]);
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
  const [enterpriseMissionDialogOpen, setEnterpriseMissionDialogOpen] = useState(false);
  const [enterpriseMissionTab, setEnterpriseMissionTab] = useState(0);
  const [recentDocuments, setRecentDocuments] = useState<Document[]>([]);
  const [pinnedDocuments, setPinnedDocuments] = useState<Document[]>([]);
  const [pinnedFolders, setPinnedFolders] = useState<Folder[]>([]);
  const [recentUsers, setRecentUsers] = useState<Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    createdAt: Date;
    photoURL?: string;
  }>>([]);
  const [ongoingMissions, setOngoingMissions] = useState<Array<{
    id: string;
    numeroMission: string;
    chargeName: string;
    company: string;
  }>>([]);
  const [lastCompany, setLastCompany] = useState<{
    id: string;
    name: string;
    logo?: string;
    createdAt: Date;
    createdBy?: string;
    createdByName?: string;
  } | null>(null);

  // Utiliser l'animation du compteur
  const animatedRevenue = useCountAnimation(statistics.totalRevenue);

  // Stabiliser les valeurs importantes de userData pour éviter les re-renders
  // Utiliser useMemo pour ne recréer ces valeurs que si elles changent vraiment
  const userStructureId = useMemo(() => userData?.structureId, [userData?.structureId]);
  const userStatus = useMemo(() => userData?.status, [userData?.status]);
  
  // Déterminer le rôle de l'utilisateur
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
      if (!currentUser) {
        console.log('❌ Pas d\'utilisateur connecté, arrêt du chargement des missions');
        return;
      }

      try {
        // Récupérer les données de l'utilisateur directement par son UID (plus fiable)
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnapshot = await getDoc(userDocRef);
        
        if (!userDocSnapshot.exists()) {
          console.error('❌ Aucun utilisateur trouvé avec cet UID');
          return;
        }
        
        const userData = userDocSnapshot.data();
        if (!userData) {
          console.error('❌ Données utilisateur vides');
          return;
        }
        
        const userStructureId = userData.structureId;
        const userStatus = userData.status;

        // Pour les entreprises, utiliser une logique différente
        if (userStatus === 'entreprise') {
          try {
            const missionsRef = collection(db, 'missions');
            const missionsQuery = query(
              missionsRef,
              where('companyId', '==', currentUser.uid)
            );
            const missionsSnapshot = await getDocs(missionsQuery);
            
            if (missionsSnapshot.docs.length === 0) {
              console.warn('⚠️ Aucune mission trouvée avec ce companyId:', currentUser.uid);
            }
            
            const missionsList: Mission[] = missionsSnapshot.docs
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
              }

              return {
                id: doc.id,
                numeroMission: data.numeroMission || '',
                title: data.title || data.company || '',
                startDate: startDate,
                endDate: endDate,
                company: data.company || '',
                description: data.description || '',
                status: data.status || 'En attente de validation',
                createdAt: data.createdAt,
                companyId: data.companyId || ''
              };
            })
            .filter(mission => {
              // Garder toutes les missions, même sans date de début
              return true;
            });
            setMissions(missionsList);
            setStatistics({
              totalRevenue: 0,
              totalMissions: missionsList.length,
              activeMissions: missionsList.filter(m => {
                const end = new Date(m.endDate);
                return end >= new Date();
              }).length,
              totalStudents: 0
            });
            return;
          } catch (error: any) {
            console.error('❌ Erreur lors du chargement des missions entreprise:', error);
            if (error?.code === 'permission-denied') {
              console.error('❌ Permissions insuffisantes pour lire les missions');
              console.error('Détails de l\'erreur:', {
                code: error.code,
                message: error.message,
                uid: currentUser.uid
              });
            }
            setMissions([]);
            setStatistics({
              totalRevenue: 0,
              totalMissions: 0,
              activeMissions: 0,
              totalStudents: 0
            });
            return;
          }
        }

        // Pour les non-entreprises, continuer avec le code normal
        console.log('⚠️ Code non-entreprise exécuté');
        console.log('⚠️ userStatus:', userStatus, 'type:', typeof userStatus);
        console.log('⚠️ userStatus === "entreprise":', userStatus === 'entreprise');
        console.log('⚠️ userStructureId:', userStructureId);
        if (!userStructureId) {
          console.error('❌ Aucun structureId trouvé pour cet utilisateur');
          console.error('❌ Données utilisateur complètes:', userData);
          return;
        }

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

        // Compter toutes les missions non archivées (pas seulement celles avec date de fin future)
        const activeMissions = allMissionsSnapshot.docs.filter(doc => {
          const mission = doc.data();
          // Exclure uniquement les missions archivées
          return mission.isArchived !== true;
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

    // Appeler fetchMissions au chargement
    fetchMissions();
  }, [currentUser?.uid]); // Utiliser uniquement uid pour éviter les re-renders inutiles

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      
      // Vérifier le statut AVANT toute requête
      if (isEntreprise) {
        return;
      }

      try {
        // Utiliser directement userData du contexte au lieu de faire une requête
        if (!userData) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.tsx:480',message:'No userData in context',data:{currentUserId:currentUser?.uid},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          return;
        }
        
        const userStatus = userData.status;
        
        // Double vérification pour les entreprises
        if (userStatus === 'entreprise') {
          return;
        }
        
        const userStructureId = userData.structureId;
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.tsx:497',message:'Using userData from context',data:{currentUserId:currentUser?.uid,userStatus,userStructureId,hasStructureId:!!userStructureId},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        // Vérifier que structureId existe avant de continuer
        if (!userStructureId) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.tsx:500',message:'No structureId found',data:{currentUserId:currentUser?.uid,userStatus},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          console.error('Aucun structureId trouvé pour cet utilisateur');
          return;
        }

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

        // Compter toutes les missions non archivées (pas seulement celles avec date de fin future)
        const activeMissions = allMissionsSnapshot.docs.filter(doc => {
          const mission = doc.data();
          // Exclure uniquement les missions archivées
          return mission.isArchived !== true;
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
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.tsx:524',message:'Error in fetchData',data:{errorCode:error?.code,errorMessage:error?.message,currentUserId:currentUser?.uid},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        console.error("Erreur lors du chargement des données:", error);
      }
    };

    // Ne pas appeler fetchData pour les entreprises
    if (!userStructureId || isEntreprise) {
      return;
    }
    
    fetchData();
  }, [currentUser?.uid, userData, userStructureId, isEntreprise]); // Utiliser les valeurs stabilisées

  // Charger les documents récents
  useEffect(() => {
    const fetchRecentDocuments = async () => {
      if (!currentUser || !userStructureId) return;
      if (isEntreprise) return;

      try {
        const structureId = userStructureId;
        const docsRef = collection(db, 'structures', structureId, 'documents');
        
        // Essayer avec orderBy et filtre parentFolderId, sinon récupérer tous et trier manuellement
        let docsSnapshot;
        try {
          // Essayer d'abord avec le filtre parentFolderId === null
          try {
            const docsQuery = query(
              docsRef,
              where('parentFolderId', '==', null),
              orderBy('createdAt', 'desc'),
              limit(10)
            );
            docsSnapshot = await getDocs(docsQuery);
          } catch (parentFolderError: any) {
            // Si l'index parentFolderId n'existe pas, essayer sans ce filtre
            console.log('Index parentFolderId non disponible, récupération sans filtre');
            const docsQuery = query(
              docsRef,
              orderBy('createdAt', 'desc'),
              limit(20)
            );
            docsSnapshot = await getDocs(docsQuery);
          }
        } catch (orderByError: any) {
          // Si l'index createdAt n'existe pas, récupérer tous les documents et trier
          console.log('Index createdAt non disponible, récupération de tous les documents');
          docsSnapshot = await getDocs(docsRef);
        }

        const docsList: Document[] = [];
        for (const docSnap of docsSnapshot.docs) {
          const data = docSnap.data();
          
          // Exclure les documents liés aux missions
          if (data.missionId) continue;
          
          // Pour le dossier racine, vérifier que parentFolderId est bien null/undefined
          if (data.parentFolderId !== null && data.parentFolderId !== undefined) {
            continue;
          }
          
          // Récupérer le nom de l'utilisateur
          let uploadedByName = '';
          try {
            if (data.uploadedBy) {
              const userDoc = await getDoc(doc(db, 'users', data.uploadedBy));
              const userDocData = userDoc.data();
              uploadedByName = await getDecryptedUserDisplayName(data.uploadedBy, userDocData || null);
            }
          } catch (e) {
            console.error('Erreur lors de la récupération du nom utilisateur:', e);
          }

          // Vérifier l'accès aux documents restreints
          const canAccess = !data.isRestricted || 
            userStatus === 'superadmin' || 
            userStatus === 'admin' ||
            (data.allowedRoles && data.allowedRoles.includes(userStatus));

          if (canAccess && data.name) {
            docsList.push({
              id: docSnap.id,
              ...data,
              uploadedByName,
              createdAt: data.createdAt,
            } as Document);
          }
        }

        // Trier par date si on n'a pas utilisé orderBy
        docsList.sort((a, b) => {
          const aDate = a.createdAt && (a.createdAt as any).toDate 
            ? (a.createdAt as any).toDate() 
            : new Date(a.createdAt as Date || 0);
          const bDate = b.createdAt && (b.createdAt as any).toDate 
            ? (b.createdAt as any).toDate() 
            : new Date(b.createdAt as Date || 0);
          return bDate.getTime() - aDate.getTime();
        });

        console.log('Documents récents trouvés:', docsList.length);
        console.log('Documents:', docsList.map(d => ({ id: d.id, name: d.name, createdAt: d.createdAt })));
        
        // Trier à nouveau par date pour être sûr
        const sortedDocs = docsList.sort((a, b) => {
          const aDate = a.createdAt && (a.createdAt as any).toDate 
            ? (a.createdAt as any).toDate() 
            : new Date(a.createdAt as Date || 0);
          const bDate = b.createdAt && (b.createdAt as any).toDate 
            ? (b.createdAt as any).toDate() 
            : new Date(b.createdAt as Date || 0);
          return bDate.getTime() - aDate.getTime();
        });
        
        setRecentDocuments(sortedDocs.slice(0, 5));
      } catch (error) {
        console.error('Erreur lors du chargement des documents récents:', error);
      }
    };

    fetchRecentDocuments();
  }, [currentUser?.uid, userStructureId, userStatus, isEntreprise]);

  // Charger les dossiers épinglés
  useEffect(() => {
    const fetchPinnedFolders = async () => {
      if (!currentUser || !userStructureId) return;
      if (isEntreprise) return;

      try {
        const structureId = userStructureId;
        const foldersRef = collection(db, 'structures', structureId, 'folders');
        
        // Récupérer les dossiers épinglés
        let foldersSnapshot;
        try {
          const foldersQuery = query(
            foldersRef,
            where('isPinned', '==', true),
            where('parentFolderId', '==', null)
          );
          foldersSnapshot = await getDocs(foldersQuery);
        } catch (error: any) {
          // Si l'index n'existe pas, récupérer tous les dossiers et filtrer
          console.log('Index isPinned non disponible, récupération de tous les dossiers');
          const allFoldersQuery = query(
            foldersRef,
            where('parentFolderId', '==', null)
          );
          foldersSnapshot = await getDocs(allFoldersQuery);
        }

        const foldersList: Folder[] = [];
        for (const folderSnap of foldersSnapshot.docs) {
          const data = folderSnap.data();
          
          // Filtrer les dossiers épinglés (si l'index n'existe pas)
          if (!data.isPinned) continue;
          
          // Vérifier l'accès aux dossiers restreints
          const canAccess = !data.isRestricted || 
            userStatus === 'superadmin' || 
            userStatus === 'admin' ||
            (data.allowedRoles && data.allowedRoles.includes(userStatus));

          if (canAccess && data.name) {
            foldersList.push({
              id: folderSnap.id,
              ...data,
              createdAt: data.createdAt,
            } as Folder);
          }
        }

        setPinnedFolders(foldersList);
      } catch (error) {
        console.error('Erreur lors du chargement des dossiers épinglés:', error);
      }
    };

    fetchPinnedFolders();
  }, [currentUser?.uid, userStructureId, userStatus, isEntreprise]);

  // Charger les documents épinglés
  useEffect(() => {
    const fetchPinnedDocuments = async () => {
      if (!currentUser || !userStructureId) return;
      if (isEntreprise) return;

      try {
        const structureId = userStructureId;
        const docsList: Document[] = [];
        
        // 1. Charger les documents épinglés depuis structures/{structureId}/documents
        const docsRef = collection(db, 'structures', structureId, 'documents');
        let docsSnapshot;
        try {
          const docsQuery = query(
            docsRef,
            where('isPinned', '==', true),
            where('parentFolderId', '==', null),
            orderBy('createdAt', 'desc'),
            limit(10)
          );
          docsSnapshot = await getDocs(docsQuery);
        } catch (error: any) {
          // Si l'index n'existe pas, récupérer tous les documents et filtrer
          console.log('Index isPinned non disponible, récupération de tous les documents');
          const allDocsQuery = query(
            docsRef,
            where('parentFolderId', '==', null)
          );
          docsSnapshot = await getDocs(allDocsQuery);
        }

        for (const docSnap of docsSnapshot.docs) {
          const data = docSnap.data();
          
          // Filtrer les documents épinglés (si l'index n'existe pas)
          if (!data.isPinned) continue;
          
          // Exclure les documents liés aux missions (on les charge depuis generatedDocuments)
          if (data.missionId) continue;
          
          // Récupérer le nom de l'utilisateur
          let uploadedByName = '';
          try {
            if (data.uploadedBy) {
              const userDoc = await getDoc(doc(db, 'users', data.uploadedBy));
              const userDocData = userDoc.data();
              uploadedByName = await getDecryptedUserDisplayName(data.uploadedBy, userDocData || null);
            }
          } catch (e) {
            console.error('Erreur lors de la récupération du nom utilisateur:', e);
          }

          // Vérifier l'accès aux documents restreints
          const canAccess = !data.isRestricted || 
            userStatus === 'superadmin' || 
            userStatus === 'admin' ||
            (data.allowedRoles && data.allowedRoles.includes(userStatus));

          if (canAccess && data.name) {
            docsList.push({
              id: docSnap.id,
              ...data,
              uploadedByName,
              createdAt: data.createdAt,
            } as Document);
          }
        }

        // 2. Charger les documents épinglés depuis generatedDocuments
        try {
          const generatedDocsRef = collection(db, 'generatedDocuments');
          let generatedDocsSnapshot;
          try {
            const generatedDocsQuery = query(
              generatedDocsRef,
              where('isPinned', '==', true),
              where('structureId', '==', structureId),
              orderBy('createdAt', 'desc'),
              limit(10)
            );
            generatedDocsSnapshot = await getDocs(generatedDocsQuery);
          } catch (error: any) {
            // Si l'index n'existe pas, récupérer tous les documents et filtrer
            console.log('Index isPinned non disponible pour generatedDocuments, récupération de tous les documents');
            const allGeneratedDocsQuery = query(
              generatedDocsRef,
              where('structureId', '==', structureId)
            );
            generatedDocsSnapshot = await getDocs(allGeneratedDocsQuery);
          }

          for (const docSnap of generatedDocsSnapshot.docs) {
            const data = docSnap.data();
            
            // Filtrer les documents épinglés (si l'index n'existe pas)
            if (!data.isPinned) continue;
            
            // Récupérer le nom de l'utilisateur
            let uploadedByName = '';
            try {
              if (data.createdBy) {
                const userDoc = await getDoc(doc(db, 'users', data.createdBy));
                const userDocData = userDoc.data();
                uploadedByName = await getDecryptedUserDisplayName(data.createdBy, userDocData || null);
              }
            } catch (e) {
              console.error('Erreur lors de la récupération du nom utilisateur:', e);
            }

            // Ajouter le document généré à la liste
            docsList.push({
              id: docSnap.id,
              name: data.fileName || 'Document sans nom',
              size: data.fileSize || 0,
              type: data.fileName?.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
              url: data.fileUrl || '',
              storagePath: data.fileUrl || '',
              parentFolderId: null,
              uploadedBy: data.createdBy || '',
              uploadedByName,
              createdAt: data.createdAt || new Date(),
              updatedAt: data.updatedAt,
              structureId: data.structureId || structureId,
              isRestricted: false,
              missionId: data.missionId,
              missionNumber: data.missionNumber,
              missionTitle: data.missionTitle,
              isPinned: true,
            } as Document);
          }
        } catch (error) {
          console.error('Erreur lors du chargement des documents générés épinglés:', error);
        }

        // Trier par date
        docsList.sort((a, b) => {
          const aDate = a.createdAt && (a.createdAt as any).toDate 
            ? (a.createdAt as any).toDate() 
            : new Date(a.createdAt as Date || 0);
          const bDate = b.createdAt && (b.createdAt as any).toDate 
            ? (b.createdAt as any).toDate() 
            : new Date(b.createdAt as Date || 0);
          return bDate.getTime() - aDate.getTime();
        });

        setPinnedDocuments(docsList);
      } catch (error) {
        console.error('Erreur lors du chargement des documents épinglés:', error);
      }
    };

    fetchPinnedDocuments();
  }, [currentUser?.uid, userStructureId, userStatus, isEntreprise]);

  // Charger les derniers utilisateurs inscrits
  useEffect(() => {
    const parseUserCreatedAt = (raw: any): Date => {
      if (!raw) return new Date(0);
      if (typeof raw?.toDate === 'function') return raw.toDate();
      if (raw instanceof Date) return isNaN(raw.getTime()) ? new Date(0) : raw;
      if (typeof raw === 'number') return new Date(isNaN(raw) ? 0 : raw);
      if (typeof raw === 'string') {
        const d = new Date(raw);
        return isNaN(d.getTime()) ? new Date(0) : d;
      }
      if (raw && typeof raw.seconds === 'number') return new Date(raw.seconds * 1000);
      const d = new Date(raw);
      return isNaN(d.getTime()) ? new Date(0) : d;
    };

    const fetchRecentUsers = async () => {
      if (!currentUser || !userStructureId) return;
      if (isEntreprise) return;

      try {
        const usersRef = collection(db, 'users');
        const usersQuery = query(
          usersRef,
          where('structureId', '==', userStructureId),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        const usersSnapshot = await getDocs(usersQuery);

        const usersList = usersSnapshot.docs
          .map(docSnap => {
            const data = docSnap.data();
            const createdAt = parseUserCreatedAt(data.createdAt);
            return {
              id: docSnap.id,
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              email: data.email || '',
              createdAt,
              photoURL: data.photoURL || '',
              _status: data.status
            };
          })
          .filter(user => user.firstName && user.lastName && user._status !== 'entreprise') // Exclure les contacts entreprise
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 10)
          .map(({ _status, ...user }) => user); // Retirer _status du résultat final

        const decrypted = await decryptUsersList(usersList);
        setRecentUsers(decrypted);
      } catch (error: any) {
        // Si l'index n'existe pas, récupérer tous les utilisateurs et trier
        if (error.code === 'failed-precondition') {
          try {
            const usersRef = collection(db, 'users');
            const usersQuery = query(
              usersRef,
              where('structureId', '==', userStructureId)
            );
            const usersSnapshot = await getDocs(usersQuery);

            const usersList = usersSnapshot.docs
              .map(docSnap => {
                const data = docSnap.data();
                const createdAt = parseUserCreatedAt(data.createdAt);
                return {
                  id: docSnap.id,
                  firstName: data.firstName || '',
                  lastName: data.lastName || '',
                  email: data.email || '',
                  createdAt,
                  photoURL: data.photoURL || '',
                  _status: data.status
                };
              })
              .filter(user => user.firstName && user.lastName && user._status !== 'entreprise')
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
              .slice(0, 10)
              .map(({ _status, ...user }) => user);

            const decrypted = await decryptUsersList(usersList);
            setRecentUsers(decrypted);
          } catch (fallbackError) {
            console.error('Erreur lors du chargement des utilisateurs récents:', fallbackError);
          }
        } else {
          console.error('Erreur lors du chargement des utilisateurs récents:', error);
        }
      }
    };

    fetchRecentUsers();
  }, [currentUser?.uid, userStructureId, isEntreprise]);

  // Charger les missions en cours (non auditées)
  useEffect(() => {
    const fetchOngoingMissions = async () => {
      if (!currentUser || !userStructureId) return;
      if (isEntreprise) return;

      try {
        const missionsRef = collection(db, 'missions');
        const missionsQuery = query(
          missionsRef,
          where('structureId', '==', userStructureId)
        );
        const missionsSnapshot = await getDocs(missionsQuery);

        const ongoingList = missionsSnapshot.docs
          .map(docSnap => {
            const data = docSnap.data();
            // Exclure les missions archivées
            if (data.isArchived === true) {
              return null;
            }
            // Inclure toutes les missions non archivées (pas seulement les non auditées)
            return {
              id: docSnap.id,
              numeroMission: data.numeroMission || '',
              chargeName: data.chargeName || 'Non assigné',
              company: data.company || ''
            };
          })
          .filter((mission): mission is { id: string; numeroMission: string; chargeName: string; company: string } => mission !== null);

        setOngoingMissions(ongoingList);
        
        // Mettre à jour les statistiques avec le nombre réel de missions en cours (non archivées)
        setStatistics(prev => ({
          ...prev,
          activeMissions: ongoingList.length
        }));
      } catch (error) {
        console.error('Erreur lors du chargement des missions en cours:', error);
      }
    };

    fetchOngoingMissions();
  }, [currentUser?.uid, userStructureId, isEntreprise]);

  // Charger la dernière entreprise
  useEffect(() => {
    const fetchLastCompany = async () => {
      if (!currentUser || !userStructureId) return;
      if (isEntreprise) return;

      try {
        const companiesRef = collection(db, 'companies');
        const companiesQuery = query(
          companiesRef,
          where('structureId', '==', userStructureId),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
        const companiesSnapshot = await getDocs(companiesQuery);

        if (!companiesSnapshot.empty) {
          const companyDoc = companiesSnapshot.docs[0];
          const data = companyDoc.data();
          
          // Récupérer le nom du créateur (décrypté)
          let createdByName = '';
          if (data.createdBy) {
            try {
              const creatorDoc = await getDoc(doc(db, 'users', data.createdBy));
              const creatorData = creatorDoc.data();
              createdByName = await getDecryptedUserDisplayName(data.createdBy, creatorData || null);
            } catch (e) {
              console.error('Erreur lors de la récupération du créateur:', e);
            }
          }
          
          setLastCompany({
            id: companyDoc.id,
            name: data.name || '',
            logo: data.logo || '',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0),
            createdBy: data.createdBy || '',
            createdByName
          });
        }
      } catch (error: any) {
        // Si l'index n'existe pas, récupérer toutes les entreprises et trier
        if (error.code === 'failed-precondition') {
          try {
            const companiesRef = collection(db, 'companies');
            const companiesQuery = query(
              companiesRef,
              where('structureId', '==', userStructureId)
            );
            const companiesSnapshot = await getDocs(companiesQuery);

            if (!companiesSnapshot.empty) {
              const companiesList = companiesSnapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                  id: docSnap.id,
                  name: data.name || '',
                  createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0),
                  createdBy: data.createdBy
                };
              }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

              if (companiesList.length > 0) {
                const company = companiesList[0];
                // Récupérer le nom du créateur (décrypté)
                let createdByName = '';
                if (company.createdBy) {
                  try {
                    const creatorDoc = await getDoc(doc(db, 'users', company.createdBy));
                    const creatorData = creatorDoc.data();
                    createdByName = await getDecryptedUserDisplayName(company.createdBy, creatorData || null);
                  } catch (e) {
                    console.error('Erreur lors de la récupération du créateur:', e);
                  }
                }
                setLastCompany({
                  ...company,
                  createdByName
                });
              }
            }
          } catch (fallbackError) {
            console.error('Erreur lors du chargement de la dernière entreprise:', fallbackError);
          }
        } else {
          console.error('Erreur lors du chargement de la dernière entreprise:', error);
        }
      }
    };

    fetchLastCompany();
  }, [currentUser?.uid, userStructureId, isEntreprise]);

  useEffect(() => {
    const fetchConnectedUsers = async () => {
      if (!currentUser) return;
      
      // Vérifier le statut AVANT toute requête
      if (isEntreprise) {
        return;
      }

      try {
        // Utiliser directement userData du contexte au lieu de faire une requête
        if (!userData) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.tsx:780',message:'No userData in context - fetchConnectedUsers',data:{currentUserId:currentUser?.uid},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          return;
        }
        
        const userStatus = userData.status;
        
        // Double vérification pour les entreprises
        if (userStatus === 'entreprise') {
          return;
        }
        
        const userStructureId = userData.structureId;
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.tsx:792',message:'Using userData from context - fetchConnectedUsers',data:{currentUserId:currentUser?.uid,userStatus,userStructureId,hasStructureId:!!userStructureId},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        // Vérifier que structureId existe avant de continuer
        if (!userStructureId) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.tsx:795',message:'No structureId found - fetchConnectedUsers',data:{currentUserId:currentUser?.uid,userStatus},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          return;
        }

        // Récupérer tous les utilisateurs de la structure
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.tsx:793',message:'Before users query - fetchConnectedUsers',data:{currentUserId:currentUser?.uid,userStructureId,userStatus},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        const usersRef = collection(db, 'users');
        const usersQuery = query(usersRef, where('structureId', '==', userStructureId));
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.tsx:796',message:'Executing users query - fetchConnectedUsers',data:{queryType:'getDocs',structureId:userStructureId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        const usersSnapshot = await getDocs(usersQuery);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.tsx:798',message:'After users query - fetchConnectedUsers',data:{success:true,docCount:usersSnapshot.docs.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion

        const now = new Date();
        const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);

        const users = usersSnapshot.docs.map(doc => {
          const data = doc.data();
          // Utiliser lastActivity si disponible, sinon fallback sur lastLogin
          const lastActivityTimestamp = data.lastActivity || data.lastLogin;
          const lastActivity = lastActivityTimestamp 
            ? (lastActivityTimestamp.toDate ? new Date(lastActivityTimestamp.toDate()) : new Date(lastActivityTimestamp))
            : new Date(0);
          
          return {
            id: doc.id,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            lastConnection: lastActivity, // Utilise lastActivity maintenant
            isOnline: lastActivity > threeMinutesAgo,
            role: data.role || 'membre',
            photoURL: data.photoURL || ''
          };
        });

        // Trier par date de dernière activité (les plus récentes d'abord)
        users.sort((a, b) => b.lastConnection.getTime() - a.lastConnection.getTime());

        // Décrypter les noms des utilisateurs
        const decrypted = await decryptUsersList(users.slice(0, 5));
        setConnectedUsers(decrypted);
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.tsx:614',message:'Error in fetchConnectedUsers',data:{errorCode:error?.code,errorMessage:error?.message,currentUserId:currentUser?.uid},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        console.error("Erreur lors du chargement des utilisateurs connectés:", error);
      }
    };

    // Ne pas appeler fetchConnectedUsers pour les entreprises
    if (!userStructureId || isEntreprise) {
      return;
    }
    
    fetchConnectedUsers();
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchConnectedUsers, 30000);

    return () => clearInterval(interval);
  }, [currentUser?.uid, userData, userStructureId, isEntreprise]); // Utiliser les valeurs stabilisées

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
      navigate(`/app/mission/${mission.id}`);
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

  // Fonction pour générer un camembert SVG
  const generatePieChart = (data: Array<{ label: string; value: number; color: string }>, size: number = 120) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return null;

    let currentAngle = -90; // Commencer en haut
    const radius = size / 2 - 10;
    const center = size / 2;
    const paths: JSX.Element[] = [];

    data.forEach((item, index) => {
      const percentage = item.value / total;
      const angle = percentage * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;

      const startX = center + radius * Math.cos((startAngle * Math.PI) / 180);
      const startY = center + radius * Math.sin((startAngle * Math.PI) / 180);
      const endX = center + radius * Math.cos((endAngle * Math.PI) / 180);
      const endY = center + radius * Math.sin((endAngle * Math.PI) / 180);

      const largeArcFlag = angle > 180 ? 1 : 0;

      const pathData = [
        `M ${center} ${center}`,
        `L ${startX} ${startY}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
        'Z'
      ].join(' ');

      paths.push(
        <path
          key={index}
          d={pathData}
          fill={item.color}
          stroke="#fff"
          strokeWidth="2"
          style={{
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            transformOrigin: `${center}px ${center}px`
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.filter = 'brightness(1.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.filter = 'brightness(1)';
          }}
        />
      );

      currentAngle += angle;
    });

    return (
      <Box
        sx={{
          display: 'inline-block',
          transition: 'transform 0.3s ease',
          '&:hover': {
            transform: 'scale(1.05)'
          }
        }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {paths}
        </svg>
      </Box>
    );
  };

  // Vérification des permissions (pour les utilisateurs non-entreprise et non-étudiant)
  // Les entreprises et étudiants ont leur propre dashboard et ne sont pas soumis aux permissions
  if (!isEntreprise && !isEtudiant && !isContactWithAccess) {
    // Afficher le chargement des permissions
    if (permissionLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      );
    }

    // Afficher l'accès refusé si l'utilisateur n'a pas les permissions de lecture
    if (!canRead) {
      return (
        <AccessDenied 
          pageName="Tableau de bord" 
          message="Vous n'avez pas les permissions nécessaires pour accéder à cette page."
        />
      );
    }
  }

  // Dashboard simplifié pour les Entreprises
  if (isEntreprise) {
    // Filtrer toutes les missions de l'entreprise
    // Logs réduits pour éviter la répétition
    
    const allEnterpriseMissions = missions.filter(mission => {
      if (!currentUser) return false;
      const matches = mission.companyId === currentUser.uid;
      if (!matches) {
        console.log('Mission filtrée (companyId ne correspond pas):', {
          missionId: mission.id,
          missionCompanyId: mission.companyId,
          currentUserId: currentUser.uid
        });
      }
      return matches;
    });

    // Logs réduits pour éviter la répétition

    // Trier par date de création (plus récentes en premier)
    const sortedMissions = [...allEnterpriseMissions].sort((a, b) => {
      let dateA: Date;
      let dateB: Date;
      
      if (a.createdAt) {
        if (a.createdAt.toDate && typeof a.createdAt.toDate === 'function') {
          dateA = a.createdAt.toDate();
        } else if (a.createdAt instanceof Date) {
          dateA = a.createdAt;
        } else if (typeof a.createdAt === 'string' || typeof a.createdAt === 'number') {
          dateA = new Date(a.createdAt);
        } else {
          // Timestamp Firestore avec seconds/nanoseconds
          const ts = a.createdAt as any;
          if (ts.seconds) {
            dateA = new Date(ts.seconds * 1000);
          } else {
            dateA = new Date(0);
          }
        }
      } else {
        dateA = new Date(0);
      }
      
      if (b.createdAt) {
        if (b.createdAt.toDate && typeof b.createdAt.toDate === 'function') {
          dateB = b.createdAt.toDate();
        } else if (b.createdAt instanceof Date) {
          dateB = b.createdAt;
        } else if (typeof b.createdAt === 'string' || typeof b.createdAt === 'number') {
          dateB = new Date(b.createdAt);
        } else {
          // Timestamp Firestore avec seconds/nanoseconds
          const ts = b.createdAt as any;
          if (ts.seconds) {
            dateB = new Date(ts.seconds * 1000);
          } else {
            dateB = new Date(0);
          }
        }
      } else {
        dateB = new Date(0);
      }
      
      return dateB.getTime() - dateA.getTime();
    });

    // Filtrer selon l'onglet sélectionné
    const filteredMissions = enterpriseMissionTab === 0 
      ? sortedMissions // Toutes
      : enterpriseMissionTab === 1 
      ? sortedMissions.filter(m => m.status === 'En attente de validation' || m.status === 'Draft') // En attente
      : enterpriseMissionTab === 2
      ? sortedMissions.filter(m => {
          const endDate = new Date(m.endDate);
          const now = new Date();
          return endDate >= now && m.status !== 'En attente de validation' && m.status !== 'Draft' && m.status !== 'Terminée';
        }) // En cours
      : sortedMissions.filter(m => {
          const endDate = new Date(m.endDate);
          const now = new Date();
          return endDate < now || m.status === 'Terminée';
        }); // Terminées

    // Fonction pour obtenir la couleur du statut
    const getStatusColor = (status: string) => {
      if (!status) return 'default';
      if (status.includes('attente') || status === 'Draft') return 'warning';
      if (status.includes('cours') || status.includes('Négociation') || status.includes('Recrutement')) return 'info';
      if (status === 'Terminée') return 'success';
      return 'default';
    };

    // Fonction pour formater le statut
    const formatStatus = (status: string) => {
      if (!status) return 'En attente';
      if (status === 'En attente de validation') return 'En attente';
      return status;
    };

    const handleEnterpriseMissionSuccess = () => {
      setSnackbar({
        open: true,
        message: 'Votre demande a été envoyée avec succès. Notre équipe vous contactera sous 48h.',
        severity: 'success'
      });
      // Rafraîchir les missions en rechargeant simplement depuis Firestore
      // On réutilise la même logique que dans le useEffect initial
      if (!currentUser) return;
      
      const refreshMissions = async () => {
        try {
          const missionsRef = collection(db, 'missions');
          const missionsQuery = query(
            missionsRef,
            where('companyId', '==', currentUser.uid)
          );
          const missionsSnapshot = await getDocs(missionsQuery);
          
          console.log('Rafraîchissement - Missions trouvées:', missionsSnapshot.docs.length);
          
          const missionsList: Mission[] = missionsSnapshot.docs
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
              }
              
              return {
                id: doc.id,
                numeroMission: data.numeroMission || '',
                title: data.title || data.company || '',
                startDate: startDate,
                endDate: endDate || startDate,
                company: data.company || '',
                description: data.description || '',
                status: data.status || 'En attente de validation',
                createdAt: data.createdAt,
                companyId: data.companyId || ''
              };
            });
            
          console.log('✅ Rafraîchissement - Missions chargées:', missionsList.length);
          setMissions(missionsList);
          setStatistics({
            totalRevenue: 0,
            totalMissions: missionsList.length,
            activeMissions: missionsList.filter(m => {
              const end = new Date(m.endDate);
              return end >= new Date();
            }).length,
            totalStudents: 0
          });
        } catch (error: any) {
          console.error('❌ Erreur lors du rafraîchissement des missions:', error);
          if (error?.code === 'permission-denied') {
            console.error('❌ Permissions insuffisantes lors du rafraîchissement');
            console.error('Détails de l\'erreur:', {
              code: error.code,
              message: error.message,
              uid: currentUser.uid
            });
            setSnackbar({
              open: true,
              message: 'Erreur de permissions lors du rafraîchissement.',
              severity: 'error'
            });
          }
        }
      };
      
      refreshMissions();
    };

    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Typography variant="h4" sx={{ mb: 4, fontWeight: 600 }}>
            Tableau de bord
          </Typography>
          
          {/* Bouton CTA principal */}
          <Box sx={{ mb: 4 }}>
            <Button 
              variant="contained" 
              size="large"
              startIcon={<AddIcon />}
              onClick={() => setEnterpriseMissionDialogOpen(true)}
              sx={{ 
                py: 2,
                px: 4,
                fontSize: '1.1rem',
                fontWeight: 600,
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                '&:hover': {
                  boxShadow: '0 6px 16px rgba(0, 0, 0, 0.2)',
                }
              }}
            >
              Déposer une nouvelle mission
            </Button>
          </Box>

          {/* Modal de création de mission entreprise */}
          <EnterpriseMissionForm
            open={enterpriseMissionDialogOpen}
            onClose={() => setEnterpriseMissionDialogOpen(false)}
            onSuccess={handleEnterpriseMissionSuccess}
          />

          {/* Liste des demandes de mission */}
          <Card elevation={0} sx={{ borderRadius: '12px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Mes demandes de mission
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {allEnterpriseMissions.length} demande{allEnterpriseMissions.length > 1 ? 's' : ''} au total
                </Typography>
              </Box>

              {/* Onglets de filtrage */}
              <Tabs 
                value={enterpriseMissionTab} 
                onChange={(e, newValue) => setEnterpriseMissionTab(newValue)}
                sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
              >
                <Tab label="Toutes" />
                <Tab label="En attente" />
                <Tab label="En cours" />
                <Tab label="Terminées" />
              </Tabs>
              
              {filteredMissions.length === 0 ? (
                <Typography variant="body1" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                  {enterpriseMissionTab === 0 
                    ? 'Aucune demande envoyée pour le moment'
                    : enterpriseMissionTab === 1
                    ? 'Aucune demande en attente'
                    : enterpriseMissionTab === 2
                    ? 'Aucune mission en cours'
                    : 'Aucune mission terminée'}
                </Typography>
              ) : (
                <Box>
                  {filteredMissions.map((mission) => {
                    const createdDate = mission.createdAt?.toDate 
                      ? mission.createdAt.toDate() 
                      : (mission.createdAt ? new Date(mission.createdAt) : null);
                    
                    return (
                      <Box 
                        key={mission.id}
                        sx={{ 
                          p: 2, 
                          mb: 2, 
                          border: '1px solid #e5e5ea', 
                          borderRadius: '8px',
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: '#f5f5f7',
                            borderColor: '#d1d1d6'
                          }
                        }}
                        onClick={() => {
                          if (mission.id) {
                            navigate(`/app/mission/${mission.id}`);
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                              {mission.title || mission.company || 'Sans titre'}
                            </Typography>
                            {mission.numeroMission && mission.numeroMission !== '' && (
                              <Typography variant="caption" color="text.secondary">
                                Mission #{mission.numeroMission}
                              </Typography>
                            )}
                          </Box>
                          <Chip 
                            label={formatStatus(mission.status || 'En attente')} 
                            color={getStatusColor(mission.status || '') as any}
                            size="small"
                            sx={{ ml: 2 }}
                          />
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1.5 }}>
                          {mission.startDate && (
                            <Typography variant="body2" color="text.secondary">
                              <strong>Période:</strong> {new Date(mission.startDate).toLocaleDateString('fr-FR')} 
                              {mission.endDate && ` - ${new Date(mission.endDate).toLocaleDateString('fr-FR')}`}
                            </Typography>
                          )}
                          {createdDate && (
                            <Typography variant="body2" color="text.secondary">
                              <strong>Envoyée le:</strong> {createdDate.toLocaleDateString('fr-FR', { 
                                day: 'numeric', 
                                month: 'long', 
                                year: 'numeric' 
                              })}
                            </Typography>
                          )}
                        </Box>
                        {mission.description && (
                          <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            sx={{ mt: 1, 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical'
                            }}
                          >
                            {mission.description}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
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
            {/* Le reste du dashboard étudiant reste inchangé */}
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

  // Dashboard complet pour les Juniors (comportement par défaut)
  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 2 }}>
        {/* Statistiques - Design Apple épuré */}
        <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card 
              elevation={0}
              sx={{
                borderRadius: '20px',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
                height: '100%',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                border: '1px solid rgba(0, 0, 0, 0.04)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                  border: '1px solid rgba(0, 122, 255, 0.2)'
                }
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '10px',
                      bgcolor: '#007AFF15',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 1.5
                    }}
                  >
                    <AttachMoneyIcon sx={{ color: '#007AFF', fontSize: 18 }} />
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#86868b', fontSize: '0.75rem' }}>
                    Chiffre d'affaires
                  </Typography>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.25, color: '#1d1d1f', fontSize: '1.5rem' }}>
                  {animatedRevenue.toLocaleString('fr-FR')} €
                </Typography>
                <Typography variant="caption" sx={{ color: '#86868b', fontSize: '0.7rem' }}>
                  Revenus TTC
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card 
              elevation={0}
              sx={{
                borderRadius: '20px',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
                height: '100%',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                border: '1px solid rgba(0, 0, 0, 0.04)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                  border: '1px solid rgba(0, 122, 255, 0.2)'
                }
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '10px',
                      bgcolor: '#34C75915',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 1.5
                    }}
                  >
                    <AssignmentIcon sx={{ color: '#34C759', fontSize: 18 }} />
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#86868b', fontSize: '0.75rem' }}>
                    Missions totales
                  </Typography>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.25, color: '#1d1d1f', fontSize: '1.5rem' }}>
                  {statistics.totalMissions}
                </Typography>
                <Typography variant="caption" sx={{ color: '#86868b', fontSize: '0.7rem' }}>
                  Total missions
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card 
              elevation={0}
              sx={{
                borderRadius: '20px',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
                height: '100%',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                border: '1px solid rgba(0, 0, 0, 0.04)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                  border: '1px solid rgba(0, 122, 255, 0.2)'
                }
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '10px',
                      bgcolor: '#FF950015',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 1.5
                    }}
                  >
                    <WorkIcon sx={{ color: '#FF9500', fontSize: 18 }} />
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#86868b', fontSize: '0.75rem' }}>
                    Missions en cours
                  </Typography>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.25, color: '#1d1d1f', fontSize: '1.5rem' }}>
                  {statistics.activeMissions}
                </Typography>
                <Typography variant="caption" sx={{ color: '#86868b', fontSize: '0.7rem' }}>
                  Actives
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card 
              elevation={0}
              sx={{
                borderRadius: '20px',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
                height: '100%',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                border: '1px solid rgba(0, 0, 0, 0.04)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                  border: '1px solid rgba(0, 122, 255, 0.2)'
                }
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '10px',
                      bgcolor: '#5856D615',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 1.5
                    }}
                  >
                    <GroupIcon sx={{ color: '#5856D6', fontSize: 18 }} />
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#86868b', fontSize: '0.75rem' }}>
                    Utilisateurs
                  </Typography>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.25, color: '#1d1d1f', fontSize: '1.5rem' }}>
                  {statistics.totalStudents}
                </Typography>
                <Typography variant="caption" sx={{ color: '#86868b', fontSize: '0.7rem' }}>
                  Inscrits
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={1.5}>
          {/* Calendrier réduit */}
          <Grid item xs={12} md={5}>
            <Card 
              elevation={0}
              sx={{
                borderRadius: '20px',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
                height: '575px',
                maxHeight: '575px',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                border: '1px solid rgba(0, 0, 0, 0.04)',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                  border: '1px solid rgba(0, 122, 255, 0.2)'
                }
              }}
            >
              <CardContent sx={{ p: '16px !important', pb: '5px !important' }}>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  mb: 1.5 
                }}>
                  <Typography variant="h6" sx={{ 
                    fontWeight: 600,
                    color: '#1d1d1f',
                    fontSize: '1rem'
                  }}>
                    Calendrier
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
                      minWidth: '32px',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#007AFF',
                      color: '#fff',
                      padding: 0,
                      '&:hover': {
                        backgroundColor: '#0051D5',
                      },
                      '& .MuiSvgIcon-root': {
                        fontSize: '1.2rem'
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
                    mb: 1,
                  },
                  '.fc-toolbar-title': { 
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    color: '#1d1d1f',
                    textTransform: 'capitalize'
                  },
                  // Style des boutons de navigation
                  '.fc-button': {
                    textTransform: 'capitalize',
                    borderRadius: '8px',
                    boxShadow: 'none',
                    border: 'none',
                    backgroundColor: '#f5f5f7',
                    color: '#1d1d1f',
                    fontWeight: 500,
                    padding: '4px 12px',
                    fontSize: '0.75rem',
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
                      padding: '6px 0',
                    },
                    '.fc-col-header-cell-cushion': {
                      color: '#86868b',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      fontSize: '0.65rem',
                      padding: '2px 0',
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
                    fontSize: '0.75rem',
                    color: '#1d1d1f',
                    opacity: 0.8,
                    padding: '4px',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '2px',
                  },
                  // Style des événements
                  '.fc-event': {
                    borderRadius: '6px',
                    padding: '1px 4px',
                    marginBottom: '1px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: 'none',
                    minHeight: '16px',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      filter: 'brightness(0.95)',
                    }
                  },
                  '.fc-event-main': {
                    padding: '1px 4px',
                  },
                  '.fc-event-title': {
                    fontSize: '0.65rem',
                    fontWeight: 500,
                    padding: '0',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  },
                  '.fc-event-time': {
                    fontSize: '0.6rem',
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
                      right: ''
                    }}
                    height="auto"
                    contentHeight="auto"
                    dayMaxEvents={false}
                    fixedWeekCount={false}
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
          
          {/* Colonne droite avec plusieurs boxes */}
          <Grid item xs={12} md={7}>
            <Grid container spacing={1.5}>
              {/* Ligne 1: Missions en cours à gauche, Derniers inscrits et Dernières activités à droite */}
              <Grid container item xs={12} spacing={1.5} sx={{ alignSelf: 'flex-start' }}>
                {/* Missions en cours (avec camembert) */}
                <Grid item xs={12} md={5}>
                  <Card 
                    elevation={0}
                    sx={{
                      borderRadius: '16px',
                      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                      border: '1px solid rgba(0, 0, 0, 0.04)',
                      height: '100%',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                        border: '1px solid rgba(0, 122, 255, 0.2)'
                      }
                    }}
                  >
                    <CardContent sx={{ p: '16px !important' }}>
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          mb: 1.5, 
                          fontWeight: 600,
                          fontSize: '0.95rem',
                          color: '#1d1d1f'
                        }}
                      >
                        Missions en cours
                      </Typography>
                      
                      {ongoingMissions.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2, fontSize: '0.75rem' }}>
                          Aucune mission
                        </Typography>
                      ) : (
                        <Box>
                          {/* Camembert centré */}
                          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                            {generatePieChart(
                              ongoingMissions.map((mission, index) => ({
                                label: mission.numeroMission,
                                value: 1,
                                color: ['#007AFF', '#34C759', '#FF9500', '#5856D6', '#FF2D55', '#32ADE6', '#AF52DE', '#32ADE6'][index % 8]
                              })),
                              120
                            )}
                          </Box>
                          {/* Liste en dessous */}
                          <Box>
                            {ongoingMissions.slice(0, 8).map((mission, index) => (
                              <Box 
                                key={mission.id}
                                sx={{ 
                                  display: 'flex', 
                                  alignItems: 'flex-start', 
                                  mb: 1.25,
                                  p: 1.25,
                                  borderRadius: '10px',
                                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                                  transition: 'all 0.2s ease',
                                  cursor: 'pointer',
                                  '&:hover': {
                                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                                    transform: 'translateX(2px)'
                                  }
                                }}
                                onClick={() => navigate(`/app/mission/${mission.id}`)}
                              >
                                <Box
                                  sx={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    bgcolor: ['#007AFF', '#34C759', '#FF9500', '#5856D6', '#FF2D55', '#32ADE6', '#AF52DE', '#32ADE6'][index % 8],
                                    mr: 1.5,
                                    flexShrink: 0,
                                    mt: 0.5
                                  }}
                                />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography 
                                    variant="body2" 
                                    sx={{ 
                                      fontWeight: 700,
                                      color: '#1d1d1f',
                                      fontSize: '0.875rem',
                                      mb: 0.25,
                                      lineHeight: 1.2
                                    }}
                                  >
                                    #{mission.numeroMission}
                                  </Typography>
                                  <Typography 
                                    variant="caption" 
                                    sx={{ 
                                      color: '#86868b',
                                      fontSize: '0.7rem',
                                      display: 'block',
                                      mb: 0.25
                                    }}
                                  >
                                    {mission.chargeName}
                                  </Typography>
                                  {mission.company && (
                                    <Typography 
                                      variant="caption" 
                                      sx={{ 
                                        color: '#86868b',
                                        fontSize: '0.65rem',
                                        display: 'block',
                                        fontStyle: 'italic'
                                      }}
                                    >
                                      {mission.company}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            ))}
                            {ongoingMissions.length > 8 && (
                              <Typography variant="caption" sx={{ color: '#86868b', fontSize: '0.65rem', mt: 0.5, display: 'block', textAlign: 'center' }}>
                                +{ongoingMissions.length - 8} autres missions
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* Derniers inscrits */}
                <Grid item xs={12} md={3.5}>
                  <Card 
                    elevation={0}
                    sx={{
                      borderRadius: '16px',
                      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                      border: '1px solid rgba(0, 0, 0, 0.04)',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                        border: '1px solid rgba(0, 122, 255, 0.2)'
                      }
                    }}
                  >
                    <CardContent sx={{ p: '16px !important', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, flexShrink: 0 }}>
                        <PersonAddIcon sx={{ color: '#007AFF', fontSize: 16, mr: 0.75 }} />
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            color: '#1d1d1f'
                          }}
                        >
                          Derniers inscrits
                        </Typography>
                      </Box>
                      
                      {recentUsers.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1.5, fontSize: '0.75rem' }}>
                          Aucun utilisateur
                        </Typography>
                      ) : (
                        <Box
                          sx={{
                            flex: 1,
                            overflowY: 'auto',
                            pr: 0.5,
                            '&::-webkit-scrollbar': {
                              width: '4px',
                            },
                            '&::-webkit-scrollbar-track': {
                              background: 'transparent',
                            },
                            '&::-webkit-scrollbar-thumb': {
                              background: 'rgba(0, 0, 0, 0.2)',
                              borderRadius: '2px',
                            },
                            '&::-webkit-scrollbar-thumb:hover': {
                              background: 'rgba(0, 0, 0, 0.3)',
                            },
                          }}
                        >
                          {recentUsers.slice(0, 5).map((user) => (
                            <Box 
                              key={user.id}
                              sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                mb: 1,
                                p: 1,
                                borderRadius: '8px',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  backgroundColor: 'rgba(0, 0, 0, 0.03)'
                                }
                              }}
                            >
                              <Avatar 
                                src={user.photoURL}
                                sx={{ 
                                  width: 28, 
                                  height: 28,
                                  mr: 1,
                                  bgcolor: '#007AFF',
                                  fontSize: '0.7rem'
                                }}
                              >
                                {!user.photoURL && `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`}
                              </Avatar>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    fontWeight: 600,
                                    color: '#1d1d1f',
                                    fontSize: '0.75rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {user.firstName} {user.lastName}
                                </Typography>
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    color: '#86868b',
                                    fontSize: '0.65rem'
                                  }}
                                >
                                  {user.createdAt.getTime() > 0
                                    ? user.createdAt.toLocaleDateString('fr-FR', {
                                        day: 'numeric',
                                        month: 'short'
                                      })
                                    : '—'}
                                </Typography>
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* Dernières activités */}
                <Grid item xs={12} md={3.5}>
                  <Card 
                    elevation={0}
                    sx={{
                      borderRadius: '16px',
                      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                      border: '1px solid rgba(0, 0, 0, 0.04)',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                        border: '1px solid rgba(0, 122, 255, 0.2)'
                      }
                    }}
                  >
                    <CardContent sx={{ p: '16px !important', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          mb: 1.5, 
                          fontWeight: 600,
                          fontSize: '0.95rem',
                          color: '#1d1d1f',
                          flexShrink: 0
                        }}
                      >
                        Dernières activités
                      </Typography>
                      
                      {connectedUsers.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1.5, fontSize: '0.75rem' }}>
                          Aucune activité
                        </Typography>
                      ) : (
                        <Box
                          sx={{
                            flex: 1,
                            overflowY: 'auto',
                            pr: 0.5,
                            '&::-webkit-scrollbar': {
                              width: '4px',
                            },
                            '&::-webkit-scrollbar-track': {
                              background: 'transparent',
                            },
                            '&::-webkit-scrollbar-thumb': {
                              background: 'rgba(0, 0, 0, 0.2)',
                              borderRadius: '2px',
                            },
                            '&::-webkit-scrollbar-thumb:hover': {
                              background: 'rgba(0, 0, 0, 0.3)',
                            },
                          }}
                        >
                          {connectedUsers.slice(0, 5).map((user) => (
                            <Box 
                              key={user.id}
                              sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                mb: 1,
                                p: 1,
                                borderRadius: '8px',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  backgroundColor: 'rgba(0, 0, 0, 0.03)'
                                }
                              }}
                            >
                              <Box sx={{ position: 'relative', mr: 1 }}>
                                <Avatar 
                                  src={user.photoURL}
                                  sx={{ 
                                    width: 28, 
                                    height: 28,
                                    border: '2px solid #fff',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                    bgcolor: user.isOnline ? '#34C759' : '#f5f5f7',
                                    color: user.isOnline ? '#fff' : '#1d1d1f',
                                    fontSize: '0.7rem'
                                  }}
                                >
                                  {!user.photoURL && `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`}
                                </Avatar>
                                {user.isOnline && (
                                  <Box 
                                    sx={{ 
                                      position: 'absolute',
                                      bottom: -2,
                                      right: -2,
                                      width: 8,
                                      height: 8,
                                      borderRadius: '50%',
                                      backgroundColor: '#34C759',
                                      border: '2px solid #fff',
                                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                                    }} 
                                  />
                                )}
                              </Box>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    fontWeight: 600,
                                    color: '#1d1d1f',
                                    fontSize: '0.75rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {user.firstName} {user.lastName}
                                </Typography>
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    color: user.isOnline ? '#34C759' : '#86868b',
                                    fontWeight: user.isOnline ? 600 : 400,
                                    fontSize: '0.65rem'
                                  }}
                                >
                                  {user.isOnline ? 'En ligne' : user.lastConnection.toLocaleString('fr-FR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </Typography>
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Ligne 2: Dernière entreprise et Documents récents */}
              {/* Dernière entreprise */}
              {lastCompany && (
                <Grid item xs={12} md={5} sx={{ alignSelf: 'flex-start' }}>
                  <Card 
                    elevation={0}
                    sx={{
                      borderRadius: '16px',
                      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                      border: '1px solid rgba(0, 0, 0, 0.04)',
                      cursor: 'pointer',
                      height: '160px',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                        border: '1px solid rgba(0, 122, 255, 0.2)'
                      }
                    }}
                    onClick={() => navigate(`/app/entreprises`)}
                  >
                    <CardContent sx={{ p: '12px !important', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', height: '100%' }}>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: 600,
                          color: '#86868b',
                          fontSize: '0.75rem',
                          mb: 1,
                          width: '100%'
                        }}
                      >
                        Dernière entreprise créée
                      </Typography>
                      <Box sx={{ mb: 1 }}>
                        {lastCompany.logo ? (
                          <Box
                            component="img"
                            src={lastCompany.logo}
                            alt={lastCompany.name}
                            sx={{
                              width: 48,
                              height: 48,
                              objectFit: 'contain',
                              borderRadius: '6px',
                              backgroundColor: '#f5f5f7',
                              p: 0.75
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: 48,
                              height: 48,
                              borderRadius: '6px',
                              backgroundColor: '#007AFF15',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <BusinessIcon sx={{ color: '#007AFF', fontSize: 24 }} />
                          </Box>
                        )}
                      </Box>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: 700,
                          color: '#1d1d1f',
                          fontSize: '0.85rem',
                          mb: 0.5,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          width: '100%'
                        }}
                      >
                        {lastCompany.name}
                      </Typography>
                      {lastCompany.createdByName && (
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: '#86868b',
                            fontSize: '0.65rem',
                            mb: 0.25
                          }}
                        >
                          Par {lastCompany.createdByName}
                        </Typography>
                      )}
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: '#86868b',
                          fontSize: '0.6rem'
                        }}
                      >
                        {lastCompany.createdAt.toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Documents récents */}
              <Grid item xs={12} md={7} sx={{ alignSelf: 'flex-start' }}>
                <Card 
                  elevation={0}
                  sx={{
                    borderRadius: '16px',
                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                    border: '1px solid rgba(0, 0, 0, 0.04)',
                    height: '160px',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                      border: '1px solid rgba(0, 122, 255, 0.2)'
                    }
                  }}
                >
                  <CardContent sx={{ p: '16px !important', height: '100%' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          fontWeight: 600,
                          fontSize: '0.95rem',
                          color: '#1d1d1f'
                        }}
                      >
                        Documents récents
                      </Typography>
                      <Button
                        size="small"
                        endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                        onClick={() => navigate('/app/documents')}
                        sx={{ 
                          textTransform: 'none',
                          color: '#007AFF',
                          fontSize: '0.65rem',
                          minWidth: 'auto',
                          p: 0.25,
                          '& .MuiSvgIcon-root': {
                            fontSize: '14px'
                          }
                        }}
                      >
                        Tout
                      </Button>
                    </Box>
                    
                    {pinnedFolders.length === 0 && pinnedDocuments.length === 0 && recentDocuments.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1.5, fontSize: '0.75rem' }}>
                        Aucun document
                      </Typography>
                    ) : (
                      <>
                        {/* Dossiers épinglés */}
                        {pinnedFolders.map((folder) => (
                          <Box 
                            key={`folder-${folder.id}`}
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              mb: 1,
                              p: 1,
                              borderRadius: '8px',
                              transition: 'all 0.2s ease',
                              cursor: 'pointer',
                              backgroundColor: 'rgba(0, 122, 255, 0.05)',
                              border: '1px solid rgba(0, 122, 255, 0.2)',
                              '&:hover': {
                                backgroundColor: 'rgba(0, 122, 255, 0.1)',
                                transform: 'translateX(2px)'
                              }
                            }}
                            onClick={() => navigate('/app/documents', { state: { folderId: folder.id } })}
                          >
                            <Box sx={{ mr: 1 }}>
                              <FolderIcon sx={{ color: folder.color || '#007AFF', fontSize: 16 }} />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  fontWeight: 600,
                                  color: '#1d1d1f',
                                  fontSize: '0.75rem',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {folder.name}
                              </Typography>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: '#86868b',
                                  fontSize: '0.65rem'
                                }}
                              >
                                Dossier épinglé
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                        {/* Documents épinglés */}
                        {pinnedDocuments.map((doc) => (
                          <Box 
                            key={`pinned-${doc.id}`}
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              mb: 1,
                              p: 1,
                              borderRadius: '8px',
                              transition: 'all 0.2s ease',
                              cursor: 'pointer',
                              backgroundColor: 'rgba(255, 149, 0, 0.05)',
                              border: '1px solid rgba(255, 149, 0, 0.2)',
                              '&:hover': {
                                backgroundColor: 'rgba(255, 149, 0, 0.1)',
                                transform: 'translateX(2px)'
                              }
                            }}
                            onClick={() => navigate('/app/documents')}
                          >
                            <Box sx={{ mr: 1 }}>
                              <DescriptionIcon sx={{ color: '#FF9500', fontSize: 16 }} />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  fontWeight: 600,
                                  color: '#1d1d1f',
                                  fontSize: '0.75rem',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {doc.name}
                              </Typography>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: '#86868b',
                                  fontSize: '0.65rem'
                                }}
                              >
                                Document épinglé
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                        {/* Documents récents */}
                        {recentDocuments.filter(doc => !doc.isPinned).map((doc) => (
                          <Box 
                            key={doc.id}
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              mb: 1,
                              p: 1,
                              borderRadius: '8px',
                              transition: 'all 0.2s ease',
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: 'rgba(0, 0, 0, 0.03)'
                              }
                            }}
                            onClick={() => navigate('/app/documents')}
                          >
                            <Box sx={{ mr: 1 }}>
                              <DescriptionIcon sx={{ color: '#007AFF', fontSize: 16 }} />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  fontWeight: 500,
                                  color: '#1d1d1f',
                                  fontSize: '0.75rem',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {doc.name}
                              </Typography>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: '#86868b',
                                  fontSize: '0.65rem'
                                }}
                              >
                                {doc.createdAt && (doc.createdAt as any).toDate
                                  ? (doc.createdAt as any).toDate().toLocaleDateString('fr-FR', {
                                      day: 'numeric',
                                      month: 'short'
                                    })
                                  : new Date(doc.createdAt as Date).toLocaleDateString('fr-FR', {
                                      day: 'numeric',
                                      month: 'short'
                                    })}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
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