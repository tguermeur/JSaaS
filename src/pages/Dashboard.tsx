import React, { useEffect, useState, useMemo, useRef, lazy, Suspense } from 'react';

function isMissingFirestoreIndex(error: unknown): boolean {
  return (
    error != null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'failed-precondition'
  );
}
import { createPortal } from 'react-dom';
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
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Fade
} from '@mui/material';
import { 
  Logout as LogoutIcon,
  Person as PersonIcon,
  Dashboard as DashboardIcon,
  AttachMoney as AttachMoneyIcon,
  Work as WorkIcon,
  Group as GroupIcon,
  Add as AddIcon,
  Description as DescriptionIcon,
  ArrowForward as ArrowForwardIcon,
  Business as BusinessIcon,
  PersonAdd as PersonAddIcon,
  Folder as FolderIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useStructure } from '../hooks/useStructure';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { logoutUser } from '../firebase/auth';
import { collection, query, where, getDocs, getCountFromServer, addDoc, Timestamp, getDoc, doc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Document, Folder } from '../types/document';
import { decryptUsersList, getDecryptedUserDisplayName } from '../utils/decryptUserUtils';
import UserNameText from '../components/common/UserNameText';
import ChargeNameText from '../components/common/ChargeNameText';
import UserAvatarInitials from '../components/common/UserAvatarInitials';
import { usePermission } from '../hooks/usePermission';
import AccessDenied from '../components/common/AccessDenied';
import { getPostAuthRedirectPath } from '../utils/safeAppHome';
import { useDashboardData } from '../hooks/useDashboardData';
import type { DashboardMission, DashboardCalendarEvent } from '../hooks/useDashboardData';
import LoadingState from '../components/common/LoadingState';
import { tokens } from '../theme/tokens';
import { AppPageShell } from '../components/ds';
import { DASHBOARD_PERIOD_OPTIONS, type DashboardPeriodId } from '../hooks/useDashboardPeriod';
import { isPaidInvoiceStatus } from '../utils/dashboardRevenue';
import { DashboardJuniorBody, DashboardHeaderKpis } from './dashboard/components/DashboardJuniorBody';

const DashboardCalendar = lazy(() => import('../components/dashboard/DashboardCalendar'));
import { fadeIn, fadeInUp } from '../styles/animations';

type Mission = DashboardMission;
type Statistics = import('../hooks/useDashboardData').DashboardStatistics;

interface ConnectedUser {
  id: string;
  firstName: string;
  lastName: string;
  lastConnection: Date;
  isOnline: boolean;
  role: string;
  photoURL?: string;
}

type CalendarEvent = DashboardCalendarEvent;

// Ajouter cette fonction utilitaire pour l'animation du compteur
const useCountAnimation = (targetValue: number, duration = 2000) => {
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
  // Dashboard : lecture et modification sont équivalents → accès basique à la page
  const { canRead, canWrite, loading: permissionLoading } = usePermission('dashboard');
  const navigate = useNavigate();
  const location = useLocation();
  
  // Rediriger les contacts / comptes entreprise hors du dashboard (plus de page dédiée)
  const hasRedirectedRef = useRef(false);
  
  useEffect(() => {
    if (
      !hasRedirectedRef.current &&
      location.pathname === '/app/dashboard' &&
      userData?.status === 'entreprise'
    ) {
      hasRedirectedRef.current = true;
      const timeoutId = setTimeout(() => {
        navigate(
          getPostAuthRedirectPath({
            status: userData.status,
            companyId: userData.companyId,
            isContactWithAccess,
            canViewEvents: contactPermissions?.canViewEvents,
            canManageAmbassadors: contactPermissions?.canManageAmbassadors,
          }),
          { replace: true }
        );
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [
    location.pathname,
    isContactWithAccess,
    userData?.status,
    userData?.companyId,
    contactPermissions?.canViewEvents,
    contactPermissions?.canManageAmbassadors,
    navigate,
  ]);

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
  const [recentDocuments, setRecentDocuments] = useState<Document[]>([]);
  const [lastCompany, setLastCompany] = useState<{
    id: string;
    name: string;
    logo?: string;
    createdAt: Date;
    createdBy?: string;
    createdByName?: string;
  } | null>(null);
  const [detailDialog, setDetailDialog] = useState<'revenue' | 'totalMissions' | 'activeMissions' | 'users' | null>(null);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [paidMissionsForDialog, setPaidMissionsForDialog] = useState<Mission[]>([]);
  const [usersForDialog, setUsersForDialog] = useState<Array<{ id: string; firstName: string; lastName: string; email: string; role?: string }>>([]);
  const [detailDialogLoading, setDetailDialogLoading] = useState(false);
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriodId>('mois');

  // Stabiliser les valeurs importantes de userData pour éviter les re-renders
  const userStructureId = useMemo(() => userData?.structureId, [userData?.structureId]);
  const userStatus = useMemo(() => userData?.status, [userData?.status]);

  const { structure: structureForOnboarding } = useStructure(userStructureId);
  const canManageOnboarding = ['admin', 'admin_structure', 'superadmin'].includes(userStatus || '');
  const onboardingBannerStorageKey = userStructureId
    ? `onboarding-import-banner-dismissed:${userStructureId}`
    : null;
  const [onboardingBannerDismissed, setOnboardingBannerDismissed] = useState(() => {
    if (!onboardingBannerStorageKey || typeof window === 'undefined') return false;
    return localStorage.getItem(onboardingBannerStorageKey) === '1';
  });
  useEffect(() => {
    if (!onboardingBannerStorageKey || typeof window === 'undefined') return;
    setOnboardingBannerDismissed(localStorage.getItem(onboardingBannerStorageKey) === '1');
  }, [onboardingBannerStorageKey]);
  const showOnboardingImportBanner =
    canManageOnboarding &&
    structureForOnboarding?.onboardingStatus === 'skipped' &&
    !onboardingBannerDismissed;

  const dismissOnboardingBanner = () => {
    if (onboardingBannerStorageKey) {
      localStorage.setItem(onboardingBannerStorageKey, '1');
    }
    setOnboardingBannerDismissed(true);
  };
  
  const isEntreprise = userStatus === 'entreprise';
  const isEtudiant = userStatus === 'etudiant';
  const isJuniorEntreprise = ['admin_structure', 'admin', 'membre', 'superadmin'].includes(userStatus || '');

  const {
    loading: dashboardDataLoading,
    structureType,
    missions,
    setMissions,
    statistics,
    setStatistics,
    calendarEvents,
    setCalendarEvents,
    pinnedDocuments,
    setPinnedDocuments,
    pinnedFolders,
    setPinnedFolders,
    recentUsers,
    ongoingMissions,
    connectedUsers,
    periodMetrics,
  } = useDashboardData(currentUser?.uid, userStructureId, userStatus, isEntreprise, dashboardPeriod);

  useEffect(() => {
    if (ongoingMissions.length > 0) {
      setStatistics((prev) => ({ ...prev, activeMissions: ongoingMissions.length }));
    }
  }, [ongoingMissions.length, setStatistics]);

  const animatedRevenue = useCountAnimation(statistics.totalRevenue);

  // Libellé selon le type de structure (JE = études, JS = missions)
  const missionsLabel = structureType === 'junior' ? 'Études' : 'Missions';
  const missionsLabelLower = structureType === 'junior' ? 'études' : 'missions';

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/');
    } catch (error) {
      console.error("Erreur lors de la déconnexion", error);
    }
  };


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
        } catch (error: unknown) {
          if (!isMissingFirestoreIndex(error)) throw error;
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
        } catch (error: unknown) {
          if (!isMissingFirestoreIndex(error)) throw error;
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
          } catch (error: unknown) {
            if (!isMissingFirestoreIndex(error)) throw error;
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

  // Charger les données du détail quand on ouvre un dialog
  useEffect(() => {
    if (!detailDialog) return;
    let cancelled = false;

    const load = async () => {
      setDetailDialogLoading(true);
      try {
        if (detailDialog === 'revenue') {
          setPaidMissionsForDialog(missions.filter((m) => isPaidInvoiceStatus(m.invoiceStatus)));
        } else if (detailDialog === 'totalMissions' || detailDialog === 'activeMissions') {
          // missions déjà chargées via useDashboardData
        } else if (detailDialog === 'users' && userStructureId) {
          const usersRef = collection(db, 'users');
          const usersQuery = query(usersRef, where('structureId', '==', userStructureId));
          const snapshot = await getDocs(usersQuery);
          const list = snapshot.docs
            .map(d => {
              const data = d.data();
              return { id: d.id, firstName: data.firstName || '', lastName: data.lastName || '', email: data.email || '', role: data.role || data.status };
            })
            .filter(u => u.firstName || u.lastName);
          const decrypted = await decryptUsersList(list.map(u => ({ ...u, displayName: `${u.firstName} ${u.lastName}`.trim() })));
          if (!cancelled) setUsersForDialog(decrypted.map(u => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, role: (u as any).role })));
        }
      } finally {
        if (!cancelled) setDetailDialogLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [detailDialog, missions, userStructureId]);

  const handleEventClick = (info: any) => {
    const eventId = info.event.id;
    const extendedProps = info.event.extendedProps;
    
    // Si c'est un événement de relance, naviguer vers le prospect
    if (extendedProps?.isRelanceReminder) {
      const prospectId = eventId.replace('relance-', '');
      navigate(`/app/prospect/${prospectId}`);
      return;
    }
    
    const mission = missions.find(m => m.id === eventId);
    if (mission) {
      navigate(mission.isEtude ? `/app/etude/${mission.numeroMission}` : `/app/mission/${mission.id}`);
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
      { bg: `${tokens.colors.warning}30`, text: tokens.colors.warning }, // Orange
      { bg: `${tokens.colors.success}30`, text: tokens.colors.success }, // Vert
      { bg: `${tokens.colors.info}30`, text: tokens.colors.info }, // Bleu
      { bg: '#AF52DE30', text: '#AF52DE' }, // Violet foncé
      { bg: '#32ADE630', text: '#32ADE6' }, // Bleu clair
    ];
    
    // Utiliser le numéro de mission pour choisir une couleur de manière cohérente
    const index = numeroMission.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  // Fonction pour générer un camembert SVG
  const generatePieChart = (data: Array<{ label: string; value: number; color: string }>, size = 120) => {
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
            transition: tokens.transitions.default,
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
          transition: tokens.transitions.default,
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

  // Vérification des permissions (hors étudiants / contacts entreprise — redirigés ou exemptés)
  // Les étudiants ont leur propre vue ; les entreprises sont redirigées plus bas
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

  // Plus de dashboard dédié aux entreprises — redirection
  if (isEntreprise) {
    return (
      <Navigate
        to={getPostAuthRedirectPath({
          status: userStatus,
          companyId: userData?.companyId,
          isContactWithAccess,
          canViewEvents: contactPermissions?.canViewEvents,
          canManageAmbassadors: contactPermissions?.canManageAmbassadors,
        })}
        replace
      />
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
              <Card elevation={0} sx={{ borderRadius: tokens.radius.md, boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)' }}>
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
              <Card elevation={0} sx={{ borderRadius: tokens.radius.md, boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)' }}>
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
    <>
    <AppPageShell
      title="Pilotage"
      titleSuffix={periodMetrics.periodLabel}
      status={{ label: 'Système opérationnel', color: tokens.colors.success }}
      actions={
        <Button
          size="small"
          variant="contained"
          sx={{ textTransform: 'none', borderRadius: tokens.radius.md, bgcolor: tokens.colors.brandNavy }}
          onClick={() => navigate(structureType === 'junior' ? '/app/etude' : '/app/mission')}
        >
          Nouvelle {structureType === 'junior' ? 'étude' : 'mission'}
        </Button>
      }
      period={{
        value: dashboardPeriod,
        onChange: (id) => setDashboardPeriod(id as DashboardPeriodId),
        options: [...DASHBOARD_PERIOD_OPTIONS],
      }}
      comparePeriod={{ label: 'période précédente' }}
      kpiStrip={
        <DashboardHeaderKpis metrics={periodMetrics} statistics={statistics} missionsLabel={missionsLabel} />
      }
    >
      {showOnboardingImportBanner && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          onClose={dismissOnboardingBanner}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/app/onboarding')}>
              Importer
            </Button>
          }
        >
          Importez vos données historiques pour démarrer plus vite.
        </Alert>
      )}
      <DashboardJuniorBody
        missions={missions}
        calendarEvents={calendarEvents}
        connectedUsers={connectedUsers}
        missionsLabel={missionsLabel}
        onOpenCalendar={() => setCalendarDialogOpen(true)}
        onMissionClick={(id, isEtude, numero) => {
          navigate(isEtude || structureType === 'junior' ? `/app/etude/${numero || id}` : `/app/mission/${id}`);
        }}
      />

      {/* Dialogue détail des statistiques (CA, Missions, Utilisateurs) */}
      <Dialog
        open={!!detailDialog}
        onClose={() => { setDetailDialog(null); }}
        maxWidth="md"
        fullWidth
        TransitionComponent={Fade}
        TransitionProps={{ timeout: 300 }}
        PaperProps={{
          sx: {
            borderRadius: tokens.radius.xl,
            boxShadow: '0 24px 48px rgba(0,0,0,0.12)',
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.25rem', borderBottom: '1px solid', borderColor: 'divider' }}>
          {detailDialog === 'revenue' && 'Détail du chiffre d\'affaires'}
          {detailDialog === 'totalMissions' && `Liste des ${missionsLabelLower} totales`}
          {detailDialog === 'activeMissions' && `${missionsLabel} en cours`}
          {detailDialog === 'users' && 'Utilisateurs inscrits'}
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {detailDialogLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: 440 }}>
              {detailDialog === 'revenue' && (
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>N° Mission</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Entreprise</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">Montant TTC (€)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paidMissionsForDialog.length === 0 ? (
                      <TableRow><TableCell colSpan={3} align="center" sx={{ py: 3 }}>Aucune {missionsLabelLower} payée</TableCell></TableRow>
                    ) : (
                      paidMissionsForDialog.map((m) => (
                        <TableRow key={m.id} hover onClick={() => navigate(m.isEtude ? `/app/etude/${m.numeroMission}` : `/app/mission/${m.id}`)} sx={{ cursor: 'pointer' }}>
                          <TableCell>#{m.numeroMission}</TableCell>
                          <TableCell>{m.company}</TableCell>
                          <TableCell align="right">{(m.totalTTC ?? 0).toLocaleString('fr-FR')}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
              {detailDialog === 'totalMissions' && (
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>N° Mission</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Entreprise</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Chargé(e) de mission</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Début</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Fin</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {missions.length === 0 ? (
                      <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>Aucune {missionsLabelLower}</TableCell></TableRow>
                    ) : (
                      missions.map((m) => (
                        <TableRow key={m.id} hover onClick={() => navigate(m.isEtude ? `/app/etude/${m.numeroMission}` : `/app/mission/${m.id}`)} sx={{ cursor: 'pointer' }}>
                          <TableCell>#{m.numeroMission}</TableCell>
                          <TableCell>{m.company}</TableCell>
                          <TableCell>
                            <ChargeNameText chargeId={m.chargeId} chargeName={m.chargeName} fallback="—" variant="body2" />
                          </TableCell>
                          <TableCell>{m.startDate ? new Date(m.startDate).toLocaleDateString('fr-FR') : '—'}</TableCell>
                          <TableCell>{m.endDate ? new Date(m.endDate).toLocaleDateString('fr-FR') : '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
              {detailDialog === 'activeMissions' && (
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>N° Mission</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Entreprise</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Chargé(e) de mission</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ongoingMissions.length === 0 ? (
                      <TableRow><TableCell colSpan={3} align="center" sx={{ py: 3 }}>Aucune {missionsLabelLower} en cours</TableCell></TableRow>
                    ) : (
                      ongoingMissions.map((m) => (
                        <TableRow key={m.id} hover onClick={() => navigate(structureType === 'junior' ? `/app/etude/${m.numeroMission}` : `/app/mission/${m.id}`)} sx={{ cursor: 'pointer' }}>
                          <TableCell>#{m.numeroMission}</TableCell>
                          <TableCell>{m.company}</TableCell>
                          <TableCell>
                            <ChargeNameText chargeId={m.chargeId} chargeName={m.chargeName} fallback="—" variant="body2" />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
              {detailDialog === 'users' && (
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Nom</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Rôle</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {usersForDialog.length === 0 ? (
                      <TableRow><TableCell colSpan={3} align="center" sx={{ py: 3 }}>Aucun utilisateur</TableCell></TableRow>
                    ) : (
                      usersForDialog.map((u) => (
                        <TableRow key={u.id} hover onClick={() => navigate(`/app/human-resources?user=${u.id}`)} sx={{ cursor: 'pointer' }}>
                          <TableCell>
                            <UserNameText user={u} skeletonWidth={120} variant="body2" />
                          </TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>{u.role || '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={() => { setDetailDialog(null); }}>Fermer</Button>
        </DialogActions>
      </Dialog>

      {/* Calendrier agrandi */}
      <Dialog
        open={calendarDialogOpen}
        onClose={() => setCalendarDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        TransitionComponent={Fade}
        TransitionProps={{ timeout: 300 }}
        PaperProps={{
          sx: {
            borderRadius: tokens.radius.xl,
            boxShadow: '0 24px 48px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            minHeight: '80vh'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Calendrier
          <Button
            onClick={() => {
              setCalendarDialogOpen(false);
              const today = new Date().toISOString().split('T')[0];
              setEventForm({ title: '', startDate: today, endDate: today, description: '' });
              setOpenEventDialog(true);
            }}
            startIcon={<AddIcon />}
            variant="contained"
            sx={{ borderRadius: tokens.radius.md, textTransform: 'none' }}
          >
            Ajouter un événement
          </Button>
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          <Box sx={{
            '.fc': { fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' },
            '.fc-toolbar-title': { fontSize: '1.1rem', fontWeight: 600, color: tokens.colors.textPrimary, textTransform: 'capitalize' },
            '.fc-button': { textTransform: 'capitalize', borderRadius: tokens.radius.sm, boxShadow: 'none', border: 'none', backgroundColor: tokens.colors.bgSubtle, color: tokens.colors.textPrimary, fontWeight: 500 },
            '.fc-button-active': { backgroundColor: `${tokens.colors.info} !important`, color: '#fff !important' },
            '.fc-col-header-cell-cushion': { color: tokens.colors.textSecondary, fontWeight: 500, textTransform: 'uppercase', fontSize: '0.8rem' },
            '.fc-daygrid-day-number': {
              fontSize: '0.875rem',
              width: 28,
              height: 28,
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              lineHeight: 1,
            },
            '.fc-day-today .fc-daygrid-day-number': { backgroundColor: tokens.colors.info, color: '#fff', fontWeight: 600 },
            '.fc-event': { borderRadius: '6px', padding: '2px 6px', cursor: 'pointer', border: 'none' },
            '.fc-event-title': { fontSize: '0.8rem', fontWeight: 500 },
            '.fc-timegrid-slot': { height: '2.5em' },
            '.fc-timegrid-event': { borderRadius: tokens.radius.sm, border: 'none' },
          }}>
            <Suspense fallback={<LoadingState message="Chargement du calendrier…" />}>
              <DashboardCalendar
                missions={missions}
                calendarEvents={calendarEvents}
                getMissionColor={getMissionColor}
                onEventClick={handleEventClick}
                onDateClick={handleDateClick}
                showTimeGrid
                height={560}
                dayMaxEvents={3}
              />
            </Suspense>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={() => setCalendarDialogOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

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

    </AppPageShell>
      {/* Snackbar pour les notifications - rendu en portal pour éviter children invalides dans Container */}
      {createPortal(
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          sx={{ zIndex: 10000 }}
        >
          <Alert 
            onClose={() => setSnackbar({ ...snackbar, open: false })} 
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>,
        document.body
      )}
    </>
  );
} 