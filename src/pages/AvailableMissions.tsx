import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  CircularProgress,
  Button,
  Alert,
  Drawer,
  IconButton,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
} from '@mui/material';
import {
  Business as BusinessIcon,
  LocationOn as LocationOnIcon,
  Timer as TimerIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Email as EmailIcon,
  Share as ShareIcon,
  ContentCopy as ContentCopyIcon,
  MoreHoriz as MoreHorizIcon,
  NavigateBefore as NavigateBeforeIcon,
  NavigateNext as NavigateNextIcon,
  Check as CheckIcon,
  CheckCircle as CheckCircleIcon,
  PictureAsPdf as PdfIcon,
  Payment as PaymentIcon,
  Event as EventIcon,
  CalendarToday as CalendarTodayIcon,
  Groups as GroupsIcon,
  Euro as EuroIcon,
} from '@mui/icons-material';
import { collection, query, where, getDocs, getDoc, doc, addDoc, updateDoc } from 'firebase/firestore';
import { loadStripe } from '@stripe/stripe-js';
import { db } from '../firebase/config';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { styled } from '@mui/material';
import { fetchStripePaymentIntents, checkPaymentIntentExists } from '../api/stripe';
import MissionMap from '../components/missions/MissionMap';
import { tokens } from '../theme/tokens';
import {
  AppPageShell,
  LifecycleTracker,
  ApplyStatusLegend,
  ApplyFilterBar,
  ApplyListingCard,
  ApplyListingGrid,
  ApplyEmptyState,
  avatarColorFromSeed,
  initialsFromTitle,
} from '../components/ds';
import type { ApplyCardStatus } from '../components/ds';

// Déclaration globale pour le bouton Stripe
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'stripe-buy-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        'buy-button-id': string;
        'publishable-key': string;
      };
    }
  }
}

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

// Ajout du type ExtendedUserData
interface ExtendedUserData {
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  email?: string;
  graduationYear?: string;
  program?: string;
  campus?: string;
  birthPlace?: string;
  postalCode?: string;
  gender?: string;
  nationality?: string;
  studentId?: string;
  address?: string;
  socialSecurityNumber?: string;
  phone?: string;
  cvUrl?: string;
}

interface StructureData {
  cotisationsEnabled: boolean;
  cotisationAmount: number;
  cotisationDuration: 'end_of_school' | '1_year' | '2_years' | '3_years';
  stripeIntegrationEnabled: boolean;
  stripePublishableKey: string;
  stripeProductId: string;
  stripeBuyButtonId: string; // ID du Buy Button Stripe
  structureId: string;
  structureName?: string; // Nom de la structure
}

interface UserSubscription {
  status: string;
  paidAt?: Date;
  expiresAt?: Date;
}

interface Mission {
  id: string;
  title?: string;
  numeroMission: string;
  location: string;
  publishedAt: FirebaseTimestamp | Date | string;
  announcement?: string;
  description?: string;
  hoursPerStudent?: number;
  hours?: number;
  studentCount: number;
  salary?: number;
  priceHT?: number;
  startDate?: string;
  endDate?: string;
  requiresCV?: boolean;
  locationCoordinates?: {
    lat: number;
    lng: number;
  };
  requiresMotivation?: boolean;
  type?: string;
  convertedMissionId?: string;
  slots?: any[];
}

interface RecruitmentTask {
  id: string;
  title: string;
  description: string;
  remuneration: number;
  duration: number;
  status: string;
  applications: number;
  deadline: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  isPublished?: boolean;
  publishedAt?: Date;
  isPublic?: boolean;
  budgetItemIds?: string[];
  studentsToRecruit?: number;
  recruitedStudents?: number;
  linkedRecruitment?: boolean;
  etudeId: string;
  numeroEtude?: string;
  createdAt: Date;
  createdBy: string;
  requiresCV?: boolean;
  requiresMotivation?: boolean;
}

interface Etude {
  id: string;
  numeroEtude: string;
  company: string;
  companyLogo?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  consultantCount?: number;
  hours?: number | null;
  jeh?: number | null;
  status: string;
  structureId?: string;
  chargeId: string;
  chargeIds?: string[];
  chargeName: string;
  chargePhotoURL?: string | null;
  description?: string | null;
  prixHT?: number;
  missionTypeId?: string | null;
  missionTypeName?: string | null;
  createdAt?: any;
  createdBy?: string;
  isPublic: boolean;
  etape: 'Négociation' | 'Recrutement' | 'Facturation' | 'Audit';
  permissions?: {
    viewers: string[];
    editors: string[];
  };
  isArchived?: boolean;
  pricingType?: 'jeh' | 'hourly';
}

interface ErrorWithMessage {
  message: string;
}

interface ApplicationData {
  missionId: string;
  userId: string;
  userEmail: string | null;
  cvUrl: string | null;
  cvUpdatedAt: string | null;
  motivationLetter: string;
  submittedAt: string;
  status: string;
}

interface FirebaseTimestamp {
  toDate: () => Date;
}

const MISSION_FILTER_OPTIONS = [
  'Compatible profil',
  'Distanciel',
  'Paris & IDF',
  'Court terme',
  'Marketing',
  'Data',
];

function computeMissionMatch(
  profile: ExtendedUserData | null,
  mission: Mission
): number {
  if (!profile) return 50;

  const requiredFields = [
    profile.firstName,
    profile.lastName,
    profile.birthDate,
    profile.email,
    profile.graduationYear,
    profile.program,
    profile.phone,
    profile.address,
    profile.cvUrl,
  ];
  const filled = requiredFields.filter(Boolean).length;
  let score = Math.round((filled / requiredFields.length) * 55);

  if (profile.cvUrl) score += 15;

  const haystack = `${mission.title || ''} ${mission.description || ''} ${mission.announcement || ''}`.toLowerCase();
  const program = (profile.program || '').toLowerCase();
  if (program) {
    program.split(/\s+/).forEach((token) => {
      if (token.length > 3 && haystack.includes(token)) score += 4;
    });
  }

  if (/marketing|sea|contenu|social|digital/i.test(haystack) && /marketing|communication|digital/i.test(program)) {
    score += 8;
  }
  if (/data|sql|analyse|dashboard|bi/i.test(haystack) && /data|informatique|analyse/i.test(program)) {
    score += 8;
  }

  return Math.min(99, Math.max(38, score));
}

function missionPassesFilters(mission: Mission, filters: string[], matchPct: number): boolean {
  if (filters.length === 0) return true;
  return filters.some((filter) => {
    const loc = (mission.location || '').toLowerCase();
    const text = `${mission.title || ''} ${mission.description || ''} ${mission.announcement || ''}`.toLowerCase();
    const hours = mission.hoursPerStudent || Math.floor((mission.hours || 0) / Math.max(mission.studentCount || 1, 1));

    switch (filter) {
      case 'Compatible profil':
        return matchPct >= 70;
      case 'Distanciel':
        return /distanciel|télétravail|remote|visio|à distance/.test(loc);
      case 'Paris & IDF':
        return /paris|île-de-france|idf|93|94|95|92|91|78|77/.test(loc);
      case 'Court terme':
        return hours <= 30;
      case 'Marketing':
        return /marketing|sea|contenu|social|communication/.test(text);
      case 'Data':
        return /data|sql|analyse|dashboard|bi|statistique/.test(text);
      default:
        return true;
    }
  });
}

function getMissionStatusLabel(missionId: string, hasApplied: (id: string) => boolean, isAccepted: (id: string) => boolean): string | undefined {
  if (isAccepted(missionId)) return 'Recruté';
  if (hasApplied(missionId)) return 'Déjà postulé';
  return 'Ouverte';
}

const EVENT_FILTER_OPTIONS = ['Toutes', 'Salons', 'Présentiel', 'Distanciel', 'Ouvert'];
const MISSION_BOARD_FILTER_OPTIONS = ['Toutes', 'Compatible profil', 'Distanciel', 'Présentiel', 'Ouverte'];

function isRemoteLocation(location?: string): boolean {
  if (!location) return false;
  return /distanciel|remote|en ligne|online|à distance/i.test(location);
}

function getApplyCardStatus(
  id: string,
  hasAppliedFn: (id: string) => boolean,
  isAcceptedFn: (id: string) => boolean,
  startDate?: string,
): { status: ApplyCardStatus; label: string } {
  if (isAcceptedFn(id)) return { status: 'selection', label: 'Confirmé' };
  if (hasAppliedFn(id)) return { status: 'selection', label: 'Sélection en cours' };
  if (startDate) {
    const days = (new Date(startDate).getTime() - Date.now()) / 86400000;
    if (days >= 0 && days <= 14) return { status: 'closing', label: 'Bientôt clôturée' };
  }
  return { status: 'open', label: 'Ouverte' };
}

function eventPassesFilter(
  event: Mission,
  filter: string,
  hasAppliedFn: (id: string) => boolean,
): boolean {
  if (filter === 'Toutes') return true;
  if (filter === 'Salons') return /salon|événement|event|ambassadeur/i.test(`${event.title || ''} ${event.description || ''}`);
  if (filter === 'Présentiel') {
    return !!event.location && !isRemoteLocation(event.location) && event.location !== 'À définir';
  }
  if (filter === 'Distanciel') return isRemoteLocation(event.location);
  if (filter === 'Ouvert') return !hasAppliedFn(event.id);
  return true;
}

function missionBoardPassesFilter(
  mission: Mission,
  filter: string,
  matchPct: number,
  hasAppliedFn: (id: string) => boolean,
): boolean {
  if (filter === 'Toutes') return true;
  if (filter === 'Compatible profil') return matchPct >= 70;
  if (filter === 'Distanciel') return isRemoteLocation(mission.location);
  if (filter === 'Présentiel') {
    return !!mission.location && !isRemoteLocation(mission.location) && mission.location !== 'À définir';
  }
  if (filter === 'Ouverte') return !hasAppliedFn(mission.id);
  return true;
}

const AvailableMissions: React.FC = () => {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [ambassadorEvents, setAmbassadorEvents] = useState<Mission[]>([]);
  const [recruitmentTasks, setRecruitmentTasks] = useState<RecruitmentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userData, isContactWithAccess, contactPermissions } = useAuth();

  // Ne pas rediriger les contacts avec accès qui ont canViewEvents - ils peuvent accéder à cette page
  // La redirection est gérée dans Dashboard.tsx pour éviter les boucles
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [selectedRecruitmentTask, setSelectedRecruitmentTask] = useState<RecruitmentTask | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentMissionIndex, setCurrentMissionIndex] = useState<number>(0);

  // Pour les contacts avec accès, on affiche uniquement les événements ambassadeurs
  const isContactWithAccessView = isContactWithAccess && contactPermissions?.canViewEvents;
  
  // Filtrer les missions pour l'affichage (exclure ambassadeurs et converties)
  // Pour les contacts avec accès, on ne montre pas les missions normales
  const filteredMissions = React.useMemo(() => {
    // Si c'est un contact avec accès, ne pas afficher de missions normales
    if (isContactWithAccessView) {
      return [];
    }
    const convertedMissionIds = new Set(ambassadorEvents.map(e => (e as any).convertedMissionId).filter(Boolean));
    return missions.filter(m => 
      m.type !== 'ambassadeur_event' && !convertedMissionIds.has(m.id)
    );
  }, [missions, ambassadorEvents, isContactWithAccessView]);
  
  // Créer un tableau combiné pour la navigation
  // Pour les contacts avec accès, uniquement les événements ambassadeurs
  // Sinon : missions + tâches de recrutement
  const allItems = isContactWithAccessView
    ? [...ambassadorEvents]
    : [...missions, ...recruitmentTasks.map(task => ({
    id: task.id,
    title: task.title,
    numeroMission: task.numeroEtude || `RT-${task.id.slice(-6)}`,
    location: task.location || 'À définir',
    publishedAt: task.publishedAt || new Date(),
    announcement: task.description,
    description: task.description,
    hoursPerStudent: task.duration,
    hours: task.duration,
    studentCount: task.studentsToRecruit || 1,
    salary: task.remuneration,
    priceHT: task.remuneration,
    startDate: task.startDate,
    requiresCV: task.requiresCV || false,
    requiresMotivation: task.requiresMotivation || false
  } as Mission))];
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [userCV, setUserCV] = useState<{ url: string; updatedAt: Date } | null>(null);
  const [userApplications, setUserApplications] = useState<string[]>([]);
  const [applicationStatuses, setApplicationStatuses] = useState<Record<string, string>>({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('success');
  const [applicationSuccess, setApplicationSuccess] = useState(false);
  const [profileData, setProfileData] = useState<ExtendedUserData | null>(null);
  const [incompleteProfileDialogOpen, setIncompleteProfileDialogOpen] = useState(false);
  const [structureData, setStructureData] = useState<StructureData | null>(null);
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccessDialogOpen, setPaymentSuccessDialogOpen] = useState(false);
  const [isPollingPayments, setIsPollingPayments] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [activeEventFilter, setActiveEventFilter] = useState('Toutes');
  const [activeMissionBoardFilter, setActiveMissionBoardFilter] = useState('Toutes');

  const displayMissions = React.useMemo(() => {
    const applied = (id: string) => userApplications.includes(id);
    return filteredMissions
      .map((mission) => ({
        mission,
        matchPct: computeMissionMatch(profileData, mission),
      }))
      .filter(({ mission, matchPct }) => missionPassesFilters(mission, activeFilters, matchPct))
      .filter(({ mission, matchPct }) => missionBoardPassesFilter(mission, activeMissionBoardFilter, matchPct, applied))
      .sort((a, b) => b.matchPct - a.matchPct);
  }, [filteredMissions, profileData, activeFilters, activeMissionBoardFilter, userApplications]);

  useEffect(() => {
    const fetchMissionsAndEtudes = async () => {
      let missionsLoaded = false;
      let recruitmentTasksLoaded = false;
      
      try {
        setLoading(true);
        setError(null);

        // 1. Récupérer les données de l'utilisateur
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        const userStatus = userData?.status;
        const userStructureId = userData?.structureId;

        // Ne pas rediriger les contacts avec accès qui ont canViewEvents
        // Ils peuvent voir les missions ambassadeurs de leur entreprise
        if (userStatus === 'entreprise' && !(isContactWithAccess && contactPermissions?.canViewEvents)) {
          navigate('/app/billing-page', { replace: true });
          return;
        }

        // Pour les contacts avec accès, on n'a pas besoin de structureId
        if (!userStructureId && !(isContactWithAccess && userData?.companyId)) {
          setError("Vous n'êtes pas associé à une structure");
          setLoading(false);
          return;
        }

        // 2. Récupérer les missions
        try {
          const missionsRef = collection(db, 'missions');
          let missionsQuery;

          // Pour les contacts avec accès, charger UNIQUEMENT les missions ambassadeurs de leur entreprise
          // (comme dans Ambassadors.tsx)
          if (isContactWithAccess && userData?.companyId && contactPermissions?.canViewEvents) {
            // Ne charger que les événements ambassadeurs pour les contacts avec accès
            // Les missions normales seront vides pour eux
            setMissions([]);
            missionsLoaded = true;
          } else if (userStatus === 'superadmin' || userStatus === 'admin' || userStatus === 'membre') {
            // Admin, Superadmin et membres voient les missions de leur structure
            missionsQuery = query(
              missionsRef,
              where('structureId', '==', userStructureId)
            );
            const missionsSnapshot = await getDocs(missionsQuery);
            const missionsList = missionsSnapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                publishedAt: data.publishedAt && typeof data.publishedAt.toDate === 'function'
                  ? data.publishedAt.toDate()
                  : data.publishedAt
              };
            });
            setMissions(missionsList);
            missionsLoaded = true;
          } else {
            // Les étudiants ne voient que les missions publiées de leur structure
            missionsQuery = query(
              missionsRef,
              where('structureId', '==', userStructureId),
              where('isPublished', '==', true)
            );
            const missionsSnapshot = await getDocs(missionsQuery);
            const missionsList = missionsSnapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                publishedAt: data.publishedAt && typeof data.publishedAt.toDate === 'function'
                  ? data.publishedAt.toDate()
                  : data.publishedAt
              };
            });
            setMissions(missionsList);
            missionsLoaded = true;
          }
        } catch (missionsError) {
          console.error("Erreur lors du chargement des missions:", missionsError);
          // Ne pas bloquer l'affichage si les missions échouent, on continue avec les tâches de recrutement
          setMissions([]);
        }

        // 3. Récupérer les tâches de recrutement publiées de la structure de l'utilisateur
        // Ne pas charger les tâches de recrutement pour les contacts avec accès
        if (!(isContactWithAccess && contactPermissions?.canViewEvents)) {
          try {
            const recruitmentTasksRef = collection(db, 'recruitmentTasks');
            let recruitmentTasksQuery;

            if (userStatus === 'superadmin' || userStatus === 'admin' || userStatus === 'membre') {
              // Admin, Superadmin et membres voient les tâches de recrutement de leur structure
              recruitmentTasksQuery = query(
                recruitmentTasksRef,
                where('isPublished', '==', true),
                where('isPublic', '==', true)
              );
            } else {
              // Les étudiants ne voient que les tâches de recrutement de leur structure
              recruitmentTasksQuery = query(
                recruitmentTasksRef,
                where('isPublished', '==', true),
                where('isPublic', '==', true)
              );
            }

          const recruitmentTasksSnapshot = await getDocs(recruitmentTasksQuery);
          const recruitmentTasksList = await Promise.all(recruitmentTasksSnapshot.docs.map(async (taskDoc) => {
            const data = taskDoc.data();
            
            // Récupérer le numéro d'étude si etudeId existe
            let numeroEtude = null;
            if (data.etudeId) {
              try {
                const etudeDoc = await getDoc(doc(db, 'etudes', data.etudeId));
                if (etudeDoc.exists()) {
                  const etudeData = etudeDoc.data();
                  numeroEtude = etudeData.numeroEtude;
                }
              } catch (error) {
                console.error('Erreur lors de la récupération de l\'étude:', error);
                // Continuer même si la récupération de l'étude échoue
              }
            }

            return {
              id: taskDoc.id,
              title: data.title || '',
              description: data.description || '',
              remuneration: data.remuneration || 0,
              duration: data.duration || 0,
              status: data.status || '',
              applications: data.applications || 0,
              deadline: data.deadline || '',
              startDate: data.startDate || '',
              endDate: data.endDate || '',
              location: data.location || '',
              isPublished: data.isPublished || false,
              publishedAt: data.publishedAt && typeof data.publishedAt.toDate === 'function'
                ? data.publishedAt.toDate()
                : data.publishedAt || new Date(),
              isPublic: data.isPublic || false,
              budgetItemIds: data.budgetItemIds || [],
              studentsToRecruit: data.studentsToRecruit || 1,
              recruitedStudents: data.recruitedStudents || 0,
              linkedRecruitment: data.linkedRecruitment || false,
              etudeId: data.etudeId || '',
              numeroEtude: numeroEtude,
              createdAt: data.createdAt || new Date(),
              createdBy: data.createdBy || '',
              requiresCV: data.requiresCV || false,
              requiresMotivation: data.requiresMotivation || false
            };
          }));

            setRecruitmentTasks(recruitmentTasksList);
            recruitmentTasksLoaded = true;
          } catch (recruitmentError) {
            console.error("Erreur lors du chargement des tâches de recrutement:", recruitmentError);
            setRecruitmentTasks([]);
          }
        } else {
          // Pour les contacts avec accès, ne pas charger les tâches de recrutement
          setRecruitmentTasks([]);
          recruitmentTasksLoaded = true;
        }

        // 4. Pour les contacts avec accès : récupérer les événements ambassadeur de leur entreprise
        if (isContactWithAccess && contactPermissions?.canViewEvents && userData?.companyId) {
          try {
            let ambassadorQuery;
            ambassadorQuery = query(
              collection(db, 'missions'),
              where('type', '==', 'ambassadeur_event'),
              where('companyId', '==', userData.companyId),
              where('visibleForAmbassadors', '==', true)
            );
            const ambassadorSnapshot = await getDocs(ambassadorQuery);
            const ambassadorList = ambassadorSnapshot.docs.map(docSnap => {
              const d = docSnap.data();
              const slots = d.slots || [];
              const capacity = slots.reduce((acc: number, s: { capacity?: number }) => acc + (s.capacity || 0), 0);
              return {
                id: docSnap.id,
                title: d.title || d.campaignName || d.description,
                numeroMission: `AMB-${docSnap.id.slice(-6)}`,
                location: d.location || 'À définir',
                publishedAt: d.startDate ? (typeof d.startDate === 'string' ? d.startDate : (d.startDate?.toDate?.() || d.startDate)) : new Date(),
                announcement: d.description,
                description: d.description,
                hoursPerStudent: 0,
                hours: 0,
                studentCount: capacity || 1,
                salary: 0,
                priceHT: 0,
                startDate: d.startDate,
                convertedMissionId: d.convertedMissionId,
                slots: d.slots || [],
                requiresCV: false,
                requiresMotivation: false,
                type: 'ambassadeur_event',
                isAmbassadorEvent: true
              } as Mission & { isAmbassadorEvent?: boolean };
            });
            setAmbassadorEvents(ambassadorList);
          } catch (ambassadorError) {
            console.error("Erreur chargement événements ambassadeur:", ambassadorError);
            setAmbassadorEvents([]);
          }
        } else {
          setAmbassadorEvents([]);
        }

        // Ne définir l'erreur que si vraiment rien n'a pu être chargé
        if (!missionsLoaded && !recruitmentTasksLoaded) {
          setError("Erreur lors du chargement des missions et tâches de recrutement disponibles");
        }

      } catch (err) {
        console.error("Erreur générale lors du chargement:", err);
        // Ne définir l'erreur que si vraiment rien n'a pu être chargé
        if (!missionsLoaded && !recruitmentTasksLoaded) {
          setError("Erreur lors du chargement des missions et tâches de recrutement disponibles");
        }
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      fetchMissionsAndEtudes();
    }
    
    // Nettoyage du polling quand le composant se démonte
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [currentUser, isContactWithAccess, contactPermissions?.canViewEvents]);

  useEffect(() => {
    if (currentUser?.uid) {
      const fetchUserCV = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.cvUrl && userData.updatedAt) {
              const updatedAt = userData.updatedAt.toDate();
              const sixMonthsAgo = new Date();
              sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
              
              if (updatedAt > sixMonthsAgo) {
                setUserCV({
                  url: userData.cvUrl,
                  updatedAt: updatedAt
                });
              }
            }
          }
        } catch (error) {
          console.error('Erreur lors de la récupération du CV:', error);
        }
      };

      fetchUserCV();
    }
  }, [currentUser]);

  useEffect(() => {
    const fetchUserApplications = async () => {
      if (!currentUser?.uid) return;
      
      try {
        const applicationsRef = collection(db, 'applications');
        const q = query(
          applicationsRef,
          where('userId', '==', currentUser.uid)
        );
        
        const snapshot = await getDocs(q);
        const appliedMissions = snapshot.docs.map(doc => doc.data().missionId);
        setUserApplications(appliedMissions);
        const statusMap: Record<string, string> = {};
        snapshot.docs.forEach(d => {
          const data = d.data() as any;
          if (data.missionId) {
            statusMap[data.missionId] = data.status || 'En attente';
          }
        });
        setApplicationStatuses(statusMap);
      } catch (error) {
        console.error('Erreur lors du chargement des candidatures:', error);
      }
    };

    fetchUserApplications();
  }, [currentUser]);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!currentUser?.uid) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setProfileData(userDoc.data() as ExtendedUserData);
        }
      } catch (error) {
        console.error('Erreur lors du chargement du profil:', error);
      }
    };

    fetchProfileData();
  }, [currentUser]);

  // Fonction pour charger les données de la structure et de l'abonnement utilisateur
  const fetchStructureAndSubscriptionData = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    try {
      // Récupérer les données de l'utilisateur pour obtenir structureId
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!userDoc.exists()) return;
      
      const userData = userDoc.data();
      const structureId = userData.structureId;
      
      if (!structureId) return;

      // Récupérer les données de la structure
      const structureDoc = await getDoc(doc(db, 'structures', structureId));
      if (structureDoc.exists()) {
        const structureData = structureDoc.data();
        setStructureData({
          cotisationsEnabled: structureData.cotisationsEnabled || false,
          cotisationAmount: structureData.cotisationAmount || 0,
          cotisationDuration: structureData.cotisationDuration || '1_year',
          stripeIntegrationEnabled: structureData.stripeIntegrationEnabled || false,
          stripePublishableKey: structureData.stripePublishableKey || '',
          stripeProductId: structureData.stripeProductId || '',
          stripeBuyButtonId: structureData.stripeBuyButtonId || '',
          structureId: structureId,
          structureName: structureData.name || structureData.ecole || 'Structure'
        });
      }

      // Récupérer l'abonnement de l'utilisateur
      const subscriptionDoc = await getDoc(doc(db, 'subscriptions', currentUser.uid));
      
      const convertToDate = (value: any): Date | undefined => {
        if (!value) return undefined;
        if (value instanceof Date) return value;
        if (typeof value.toDate === 'function') return value.toDate();
        if (typeof value === 'string' || typeof value === 'number') return new Date(value);
        return undefined;
      };
      
      if (subscriptionDoc.exists()) {
        const subscriptionData = subscriptionDoc.data();
        setUserSubscription({
          status: subscriptionData.status || 'inactive',
          paidAt: convertToDate(subscriptionData.paidAt),
          expiresAt: convertToDate(subscriptionData.expiresAt)
        });
      } else {
        // Vérifier aussi dans le document utilisateur
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.hasActiveSubscription && userData.subscriptionExpiresAt) {
            setUserSubscription({
              status: userData.subscriptionStatus || 'active',
              paidAt: convertToDate(userData.subscriptionPaidAt),
              expiresAt: convertToDate(userData.subscriptionExpiresAt)
            });
          } else {
            setUserSubscription({ status: 'inactive' });
          }
        } else {
          setUserSubscription({ status: 'inactive' });
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données de structure/abonnement:', error);
    }
  }, [currentUser]);

  // Charger les données de la structure et de l'abonnement utilisateur
  useEffect(() => {
    fetchStructureAndSubscriptionData();
  }, [fetchStructureAndSubscriptionData]);

  // Effet pour charger le bouton Stripe quand le dialogue de paiement s'ouvre
  useEffect(() => {
    const loadStripeButton = async () => {
      if (!paymentDialogOpen) {
        return;
      }

      console.log('Données de structure disponibles:', {
        stripeIntegrationEnabled: structureData?.stripeIntegrationEnabled,
        hasPublishableKey: !!structureData?.stripePublishableKey,
        hasBuyButtonId: !!structureData?.stripeBuyButtonId,
        buyButtonId: structureData?.stripeBuyButtonId,
        publishableKey: structureData?.stripePublishableKey?.substring(0, 20) + '...'
      });

              // Vérifications préalables
        if (!structureData?.stripeIntegrationEnabled) {
          setSnackbarMessage('Le système de paiement n\'est pas activé pour cette structure');
          setSnackbarSeverity('error');
          setSnackbarOpen(true);
          setPaymentDialogOpen(false);
          return;
        }

        if (!structureData?.stripePublishableKey || !structureData?.stripeBuyButtonId) {
          setSnackbarMessage('Configuration Stripe incomplète. Contactez l\'administrateur.');
          setSnackbarSeverity('error');
          setSnackbarOpen(true);
          setPaymentDialogOpen(false);
          return;
        }

        // Vérifier que les clés Stripe sont valides
        if (!structureData.stripePublishableKey.startsWith('pk_') || 
            !structureData.stripeBuyButtonId.startsWith('buy_')) {
          setSnackbarMessage('Configuration Stripe invalide. Contactez l\'administrateur.');
          setSnackbarSeverity('error');
          setSnackbarOpen(true);
          setPaymentDialogOpen(false);
          return;
        }

      try {
        setPaymentLoading(true);
        
        // Charger Stripe
        const stripe = await loadStripe(structureData.stripePublishableKey);
        if (!stripe) {
          throw new Error('Impossible de charger Stripe');
        }

        // Attendre que le script Stripe soit complètement chargé
        console.log('Attente du chargement du script Stripe...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('Script Stripe chargé');

        // Vider le conteneur
        console.log('Recherche du conteneur stripe-payment-element...');
        let container = document.getElementById('stripe-payment-element');
        
        if (!container) {
          console.log('Conteneur non trouvé, création d\'un nouveau conteneur...');
          container = document.createElement('div');
          container.id = 'stripe-payment-element';
          container.style.width = '100%';
          container.style.minHeight = '200px';
          container.style.display = 'flex';
          container.style.justifyContent = 'center';
          container.style.alignItems = 'center';
          
          // Trouver le bon endroit pour insérer le conteneur
          const dialogContent = document.querySelector('[role="dialog"] .MuiDialogContent-root');
          if (dialogContent) {
            // Supprimer tous les conteneurs existants pour éviter la duplication
            const existingContainers = dialogContent.querySelectorAll('#stripe-payment-element');
            existingContainers.forEach(cont => cont.remove());
            
            dialogContent.appendChild(container);
            console.log('Nouveau conteneur créé et ajouté');
          } else {
            console.error('Impossible de trouver le contenu de la modal');
            return;
          }
        } else {
          // Supprimer tous les boutons existants dans le conteneur
          const existingButtons = container.querySelectorAll('stripe-buy-button');
          existingButtons.forEach(btn => btn.remove());
          console.log('Conteneur existant trouvé et nettoyé');
        }

        // Vérifier que l'élément stripe-buy-button est disponible
        console.log('Vérification de l\'élément stripe-buy-button...');
        if (!customElements.get('stripe-buy-button')) {
          console.error('Élément stripe-buy-button non disponible');
          throw new Error('Le composant Stripe Buy Button n\'est pas disponible');
        }
        console.log('Élément stripe-buy-button disponible');

        // Créer le bouton de paiement avec gestion d'erreur
        console.log('Création du bouton Stripe avec:', {
          buyButtonId: structureData.stripeBuyButtonId,
          publishableKey: structureData.stripePublishableKey?.substring(0, 20) + '...'
        });
        
        // Validation des données Stripe
        if (!structureData.stripeBuyButtonId || !structureData.stripeBuyButtonId.startsWith('buy_')) {
          throw new Error('ID du Buy Button Stripe invalide');
        }
        
        if (!structureData.stripePublishableKey || !structureData.stripePublishableKey.startsWith('pk_')) {
          throw new Error('Clé publique Stripe invalide');
        }
        
        const button = document.createElement('stripe-buy-button');
        
        // Configuration du bouton avec gestion d'erreur
        try {
          button.setAttribute('buy-button-id', structureData.stripeBuyButtonId);
          button.setAttribute('publishable-key', structureData.stripePublishableKey);
          
          // Ajouter des attributs pour améliorer la stabilité
          button.setAttribute('client-reference-id', currentUser?.uid || 'unknown');
          button.setAttribute('customer-email', currentUser?.email || '');
          
          console.log('Bouton Stripe configuré avec succès');
        } catch (error) {
          console.error('Erreur lors de la configuration du bouton:', error);
          throw new Error('Impossible de configurer le bouton de paiement');
        }
        
        // Ajouter des gestionnaires d'erreur
        button.addEventListener('error', (event) => {
          console.error('Erreur du bouton Stripe:', event);
          setSnackbarMessage('Erreur lors du chargement du bouton de paiement. Vérifiez la configuration.');
          setSnackbarSeverity('error');
          setSnackbarOpen(true);
          setPaymentLoading(false);
        });

        // Ajouter le bouton au conteneur
        console.log('Ajout du bouton au conteneur...');
        if (container) {
          // Vérifier qu'il n'y a pas déjà un bouton
          const existingButton = container.querySelector('stripe-buy-button');
          if (existingButton) {
            console.log('Bouton existant trouvé, suppression...');
            existingButton.remove();
          }
          
          container.appendChild(button);
          console.log('Bouton ajouté au conteneur');
          
                  // Écouter les événements directement sur le bouton
        button.addEventListener('stripe-buy-button:success', (event: any) => {
          console.log('🎉 Événement de succès direct du bouton:', event);
          handlePaymentSuccess(event.detail || event);
        });

        button.addEventListener('stripe-buy-button:error', (event: any) => {
          console.error('💥 Erreur directe du bouton:', event);
          setSnackbarMessage('Erreur de paiement. Veuillez réessayer.');
          setSnackbarSeverity('error');
          setSnackbarOpen(true);
        });

        // Écouter les événements de clic sur le bouton
        button.addEventListener('click', () => {
          console.log('🖱️ Clic sur le bouton Stripe détecté');
        });

        // Écouter les événements de chargement
        button.addEventListener('load', () => {
          console.log('📦 Bouton Stripe chargé');
        });
          
          // Vérifier que le bouton est bien dans le DOM
          setTimeout(() => {
            const buttonsInDOM = container.querySelectorAll('stripe-buy-button');
            console.log('Nombre de boutons dans le DOM:', buttonsInDOM.length);
            if (buttonsInDOM.length === 0) {
              console.error('Aucun bouton dans le DOM');
            } else if (buttonsInDOM.length > 1) {
              console.warn('Plusieurs boutons détectés, suppression des doublons...');
              // Garder seulement le premier bouton
              for (let i = 1; i < buttonsInDOM.length; i++) {
                buttonsInDOM[i].remove();
              }
            }
          }, 1000);
        } else {
          console.error('Conteneur non trouvé');
        }

        // Fallback : si le bouton ne se charge pas après 5 secondes
        setTimeout(() => {
          const buttonInDOM = container?.querySelector('stripe-buy-button');
          if (!buttonInDOM || !buttonInDOM.shadowRoot) {
            console.warn('Bouton Stripe non chargé, affichage du fallback');
            setSnackbarMessage('Le bouton de paiement ne se charge pas. Veuillez réessayer.');
            setSnackbarSeverity('warning');
            setSnackbarOpen(true);
            setPaymentLoading(false);
          }
        }, 5000);

        // Écouter les événements de succès et d'erreur
        const handleMessage = (event: MessageEvent) => {
          console.log('🎯 Événement reçu:', event.data);
          
          try {
            // Vérifier que event.data existe et a les propriétés nécessaires
            if (event.data && typeof event.data === 'object') {
              console.log('📦 Type d\'événement:', event.data.type);
              console.log('📦 Données complètes:', event.data);
              
              // Gérer différents types d'événements Stripe
              if (event.data.type === 'stripe-buy-button:success' || 
                  event.data.type === 'checkout.session.completed' ||
                  event.data.type === 'payment_intent.succeeded') {
                console.log('✅ Paiement réussi détecté!');
                handlePaymentSuccess(event.data);
              } else if (event.data.type === 'stripe-buy-button:error' ||
                        event.data.type === 'checkout.session.expired' ||
                        event.data.type === 'payment_intent.payment_failed') {
                console.error('❌ Erreur Stripe détectée:', event.data);
                setSnackbarMessage('Erreur de paiement. Veuillez réessayer.');
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
              } else {
                console.log('ℹ️ Autre événement Stripe:', event.data.type);
              }
            }
          } catch (error) {
            console.error('❌ Erreur lors du traitement de l\'événement Stripe:', error);
            setSnackbarMessage('Erreur lors du traitement du paiement');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
          }
        };

        // Protection globale contre les erreurs Stripe
        const handleGlobalError = (event: ErrorEvent) => {
          console.log('🛡️ Erreur globale détectée:', event.error);
          
          // Vérifier si c'est une erreur Stripe
          if (event.error && event.error.message && 
              (event.error.message.includes('t.message.payload') || 
               event.error.message.includes('buy-button') ||
               event.error.message.includes('stripe') ||
               event.error.message.includes('message.payload'))) {
            console.log('🛡️ Erreur Stripe détectée et ignorée:', event.error.message);
            event.preventDefault(); // Empêcher l'erreur de s'afficher dans la console
            return false;
          }
        };

        // Protection spécifique pour les erreurs Stripe
        const originalConsoleError = console.error;
        console.error = function(...args) {
          const message = args.join(' ');
          if (message.includes('t.message.payload') || 
              message.includes('message.payload') ||
              message.includes('buy-button')) {
            console.log('🛡️ Erreur Stripe interceptée dans console.error:', message);
            return; // Ne pas afficher l'erreur
          }
          originalConsoleError.apply(console, args);
        };

        // Écouter les erreurs globales
        window.addEventListener('error', handleGlobalError);
        window.addEventListener('unhandledrejection', (event) => {
          console.log('🛡️ Promise rejetée:', event.reason);
          if (event.reason && event.reason.message && 
              event.reason.message.includes('t.message.payload')) {
            event.preventDefault();
          }
        });

        window.addEventListener('message', handleMessage);

        // Nettoyer l'écouteur d'événements
        return () => {
          window.removeEventListener('message', handleMessage);
          window.removeEventListener('error', handleGlobalError);
          window.removeEventListener('unhandledrejection', (event) => {
            if (event.reason && event.reason.message && 
                event.reason.message.includes('t.message.payload')) {
              event.preventDefault();
            }
          });
        };

      } catch (error) {
        console.error('Erreur lors du chargement du bouton Stripe:', error);
        setSnackbarMessage('Erreur lors du chargement du système de paiement');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      } finally {
        setPaymentLoading(false);
      }
    };

    loadStripeButton();
  }, [paymentDialogOpen, structureData]);

  const handlePaymentSuccess = async (eventData: any) => {
    console.log('🎯 handlePaymentSuccess appelé avec:', eventData);
    
    try {
      // Vérifier que les données nécessaires sont présentes
      // Stripe peut envoyer sessionId ou checkout_session_id
      const sessionId = eventData?.sessionId || eventData?.checkout_session_id || eventData?.detail?.sessionId;
      
      if (!eventData) {
        console.error('Données de paiement manquantes:', eventData);
        setSnackbarMessage('Données de paiement incomplètes');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        return;
      }

      // Si pas de sessionId, on peut quand même procéder (certains événements Stripe n'en ont pas)
      console.log('Session ID trouvé:', sessionId);

      // Afficher un message de traitement en cours
      setSnackbarMessage('Traitement du paiement en cours...');
      setSnackbarSeverity('info');
      setSnackbarOpen(true);

      // Indiquer le traitement en cours
      setPaymentProcessing(true);

      // Créer la cotisation manuellement
      await createSubscriptionManually(sessionId || 'manual_payment');

      // Fermer la modal de paiement et afficher la modal de succès
      setPaymentDialogOpen(false);
      setPaymentSuccessDialogOpen(true);

      // Détecter automatiquement les nouveaux paiements après 2 secondes (sécurité anti-perte d'événement)
      setTimeout(async () => {
        try {
          console.log('🔄 Détection automatique des nouveaux paiements...');
          await checkStripePayments();
        } catch (error) {
          console.error('Erreur lors de la détection automatique:', error);
        } finally {
          setPaymentProcessing(false);
        }
      }, 2000);
    } catch (error) {
      console.error('Erreur lors du traitement du paiement:', error);
      setSnackbarMessage('Erreur lors du traitement du paiement');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const createSubscriptionManually = async (sessionId: string) => {
    try {
      if (!currentUser?.uid || !structureData?.structureId) {
        console.error('Données utilisateur ou structure manquantes');
        setSnackbarMessage('Erreur de configuration utilisateur');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        return;
      }

      // Vérifier si l'utilisateur a déjà une cotisation active
      const hasActiveSubscription = userSubscription?.status === 'active' && 
        userSubscription?.expiresAt && 
        userSubscription.expiresAt > new Date();

      if (hasActiveSubscription) {
        console.log('Utilisateur a déjà une cotisation active, fermeture de la modal');
        setSnackbarMessage('Vous avez déjà une cotisation active qui expire le ' + 
          userSubscription.expiresAt.toLocaleDateString('fr-FR'));
        setSnackbarSeverity('info');
        setSnackbarOpen(true);
        setPaymentDialogOpen(false);
        return;
      }

      // Calculer la date d'expiration selon la durée configurée
      const calculateExpiryDate = () => {
        const now = new Date();
        switch (structureData.cotisationDuration) {
          case 'end_of_school':
            // Pour "fin de scolarité", on met une date très éloignée (10 ans)
            return new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());
          case '1_year':
            return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
          case '2_years':
            return new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
          case '3_years':
            return new Date(now.getFullYear() + 3, now.getMonth(), now.getDate());
          default:
            return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
        }
      };

      const expiryDate = calculateExpiryDate();
      const paidAt = new Date();

      // Créer l'abonnement dans Firestore
      const subscriptionData = {
        userId: currentUser.uid,
        status: 'active',
        paidAt: paidAt,
        expiresAt: expiryDate,
        stripeSessionId: sessionId || 'manual_payment',
        amount: structureData.cotisationAmount || 0,
        structureId: structureData.structureId,
        cotisationDuration: structureData.cotisationDuration,
        createdAt: new Date()
      };

      // Ajouter l'abonnement à la collection subscriptions
      const subscriptionRef = await addDoc(collection(db, 'subscriptions'), subscriptionData);

      // Mettre à jour le document utilisateur avec les informations de cotisation
      await updateDoc(doc(db, 'users', currentUser.uid), {
        hasActiveSubscription: true,
        subscriptionId: subscriptionRef.id,
        subscriptionStatus: 'active',
        subscriptionPaidAt: paidAt,
        subscriptionExpiresAt: expiryDate,
        lastSubscriptionUpdate: new Date()
      });

      // Mettre à jour l'état local
      setUserSubscription({
        status: 'active',
        paidAt: paidAt,
        expiresAt: expiryDate
      });

      // Message de succès détaillé
      const durationText = formatCotisationDuration(structureData.cotisationDuration);
      console.log('🎉 Cotisation créée avec succès:', {
        id: subscriptionRef.id,
        amount: structureData.cotisationAmount,
        duration: durationText,
        expiresAt: expiryDate.toLocaleDateString('fr-FR')
      });

      // Fermer le dialogue de paiement et ouvrir le dialogue de succès
      setPaymentDialogOpen(false);
      setPaymentSuccessDialogOpen(true);

      // Recharger les données pour mettre à jour l'interface
      setTimeout(() => {
        fetchStructureAndSubscriptionData();
      }, 1000);

    } catch (error) {
      console.error('Erreur lors de la création de l\'abonnement:', error);
      setSnackbarMessage('Erreur lors de l\'enregistrement du paiement');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleOpenMission = (mission: Mission) => {
    const index = allItems.findIndex(m => m.id === mission.id);
    setCurrentMissionIndex(index >= 0 ? index : 0);
    setSelectedMission(mission);
  };

  const handleCloseMission = () => {
    setSelectedMission(null);
  };

  const handleToggleFavorite = () => {
    setIsFavorite(!isFavorite);
  };

  const handleApply = () => {
    if (!profileData) return;
    
    const completion = calculateCompletion(profileData);
    if (completion < 100) {
      setIncompleteProfileDialogOpen(true);
      return;
    }

    // Vérifier si la structure a des cotisations activées
    if (structureData?.cotisationsEnabled) {
      // Vérifier si l'utilisateur a un abonnement actif
      const hasActiveSubscription = userSubscription?.status === 'active' && 
        userSubscription?.expiresAt && 
        userSubscription.expiresAt > new Date();

      if (!hasActiveSubscription) {
        setSubscriptionDialogOpen(true);
        return;
      }
    }

    setApplyDialogOpen(true);
  };

  const handleShare = () => {
    setShareDialogOpen(true);
  };

  const handleCopyLink = () => {
    const currentUrl = window.location.href;
    navigator.clipboard.writeText(currentUrl).then(() => {
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    });
  };

  const handleNavigateMission = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? currentMissionIndex - 1 : currentMissionIndex + 1;
    if (newIndex >= 0 && newIndex < allItems.length) {
      setCurrentMissionIndex(newIndex);
      setSelectedMission(allItems[newIndex]);
    }
  };

  const handleSubmitApplication = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      if (!currentUser || !selectedMission) {
        throw new Error("Informations manquantes");
      }

      // Vérifier si l'utilisateur a déjà postulé
      if (hasApplied(selectedMission.id)) {
        throw new Error("Vous avez déjà postulé à cette mission");
      }

      const applicationData: ApplicationData = {
        missionId: selectedMission.id,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        cvUrl: userCV?.url || null,
        cvUpdatedAt: userCV?.updatedAt ? userCV.updatedAt.toISOString() : null,
        motivationLetter: document.querySelector<HTMLTextAreaElement>('textarea')?.value || '',
        submittedAt: new Date().toISOString(),
        status: 'En attente'
      };

      // Vérifier que toutes les données requises sont présentes
      const requiredFields = ['missionId', 'userId', 'userEmail', 'submittedAt', 'status'] as const;
      const missingFields = requiredFields.filter(field => !applicationData[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Champs manquants: ${missingFields.join(', ')}`);
      }

      await addDoc(collection(db, 'applications'), applicationData);

      // Mettre à jour la liste des candidatures localement
      setUserApplications(prev => [...prev, selectedMission.id]);
      
      // Afficher le succès
      setApplicationSuccess(true);
      
      // Fermer automatiquement après 3 secondes
      setTimeout(() => {
        setApplyDialogOpen(false);
        setApplicationSuccess(false);
      }, 3000);

    } catch (error) {
      console.error('Erreur lors de la soumission de la candidature:', error);
      const errorWithMessage = error as ErrorWithMessage;
      setError(errorWithMessage.message || 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasApplied = (missionId: string) => userApplications.includes(missionId);
  const isAccepted = (missionId: string) => applicationStatuses[missionId] === 'Acceptée';
  const isPending = (missionId: string) => applicationStatuses[missionId] === 'En attente';

  const filteredAmbassadorEvents = React.useMemo(
    () => ambassadorEvents.filter((event) => eventPassesFilter(event, activeEventFilter, hasApplied)),
    [ambassadorEvents, activeEventFilter, userApplications],
  );

  const acceptedCount = React.useMemo(
    () => userApplications.filter((id) => applicationStatuses[id] === 'Acceptée').length,
    [userApplications, applicationStatuses],
  );

  const lifecycleSteps = React.useMemo(() => {
    if (isContactWithAccessView) {
      return [
        { id: 'browse', label: 'Parcourir', done: true, active: false },
        { id: 'events', label: 'Événements', done: ambassadorEvents.length > 0, active: ambassadorEvents.length === 0 },
        { id: 'register', label: "S'inscrire", done: userApplications.length > 0, active: ambassadorEvents.length > 0 && userApplications.length === 0 },
        { id: 'participate', label: 'Participer', done: acceptedCount > 0, active: userApplications.length > 0 && acceptedCount === 0 },
      ];
    }
    const hasAnyApplication = userApplications.length > 0;
    return [
      { id: 'browse', label: 'Parcourir', done: true, active: false },
      { id: 'apply', label: 'Postuler', done: hasAnyApplication, active: !hasAnyApplication },
      { id: 'recruit', label: 'Recrutement', done: acceptedCount > 0, active: hasAnyApplication && acceptedCount === 0 },
      { id: 'mission', label: 'Mission', done: false, active: acceptedCount > 0 },
    ];
  }, [isContactWithAccessView, ambassadorEvents.length, userApplications.length, acceptedCount]);

  const formatEventDate = (date: Mission['startDate']) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleCVUpload = async (file: File) => {
    try {
      console.log('CV à uploader:', {
        type: file.type,
        size: file.size,
        name: file.name
      });
      // ... reste du code ...
    } catch (error) {
      console.error('Erreur upload CV:', error);
    }
  };

  // Fonction pour calculer le pourcentage de complétion du profil
  const calculateCompletion = (data: ExtendedUserData) => {
    const requiredFields = [
      { name: 'firstName', filled: !!data.firstName },
      { name: 'lastName', filled: !!data.lastName },
      { name: 'birthDate', filled: !!data.birthDate },
      { name: 'email', filled: !!data.email },
      { name: 'graduationYear', filled: !!data.graduationYear },
      { name: 'program', filled: !!data.program },
      { name: 'campus', filled: !!data.campus },
      { name: 'birthPlace', filled: !!data.birthPlace },
      { name: 'postalCode', filled: !!data.postalCode },
      { name: 'gender', filled: !!data.gender },
      { name: 'nationality', filled: !!data.nationality },
      { name: 'studentId', filled: !!data.studentId },
      { name: 'address', filled: !!data.address },
      { name: 'socialSecurityNumber', filled: !!data.socialSecurityNumber },
      { name: 'phone', filled: !!data.phone },
      { name: 'cvUrl', filled: !!data.cvUrl }
    ];

    const filledFields = requiredFields.filter(field => field.filled);
    return Math.round((filledFields.length / requiredFields.length) * 100);
  };

  // Ajouter la fonction de navigation vers le profil
  const handleNavigateToProfile = () => {
    navigate('/app/profile');
    setIncompleteProfileDialogOpen(false);
  };

  // Fonction pour ouvrir le dialogue de paiement des cotisations
  const handleOpenPaymentDialog = () => {
    // Vérifier si l'utilisateur a déjà une cotisation active
    const hasActiveSubscription = userSubscription?.status === 'active' && 
      userSubscription?.expiresAt && 
      userSubscription.expiresAt > new Date();

    if (hasActiveSubscription) {
      // Afficher un message indiquant que la cotisation est déjà active
      setSnackbarMessage('Vous avez déjà une cotisation active qui expire le ' + 
        userSubscription.expiresAt.toLocaleDateString('fr-FR'));
      setSnackbarSeverity('info');
      setSnackbarOpen(true);
      setSubscriptionDialogOpen(false);
      return;
    }

    // Rediriger vers le nouveau système de paiement
    navigate('/cotisation/payment');
  };

  const addManualSubscription = async () => {
    const paymentIntentId = prompt('Entrez l\'ID du Payment Intent Stripe (ex: pi_3RuwftFNWuqoM0S61qybSjWv):');
    if (!paymentIntentId) return;

    try {
      await createSubscriptionManually(paymentIntentId);
      setSnackbarMessage('Cotisation ajoutée manuellement avec succès !');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Erreur lors de l\'ajout manuel:', error);
      setSnackbarMessage('Erreur lors de l\'ajout de la cotisation');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const checkStripePayments = async () => {
    try {
      console.log('🔍 Début de la vérification des paiements Stripe...');
      
      if (!structureData?.structureId || !currentUser?.uid || !currentUser?.email) {
        throw new Error('Données manquantes pour la vérification');
      }

      // Récupérer les Payment Intents depuis Stripe
      const data = await fetchStripePaymentIntents(structureData.structureId, currentUser.uid);
      console.log('🎯 Paiements Stripe trouvés:', data);
      
      if (data.success && data.paymentIntents && data.paymentIntents.length > 0) {
        console.log(`📊 ${data.paymentIntents.length} paiements trouvés, vérification par email...`);
        
        let addedCount = 0;
        let existingCount = 0;
        
        for (const paymentIntent of data.paymentIntents) {
          // Vérifier que le paiement correspond à l'email de l'utilisateur
          if (paymentIntent.status === 'succeeded' && 
              paymentIntent.customer_email === currentUser.email) {
            
            console.log(`📧 Paiement trouvé pour l'email: ${paymentIntent.customer_email}`);
            
            // Vérifier si le paiement existe déjà
            const exists = await checkPaymentIntentExists(paymentIntent.id);
            if (!exists) {
              try {
                console.log(`➕ Ajout de la cotisation pour: ${paymentIntent.id}`);
                await createSubscriptionManually(paymentIntent.id);
                addedCount++;
                console.log('✅ Cotisation ajoutée avec succès pour:', paymentIntent.id);
                
                // Arrêter le polling si on a trouvé et ajouté une cotisation
                if (addedCount > 0) {
                  stopPaymentPolling();
                  setSnackbarMessage(`🎉 Cotisation détectée et ajoutée automatiquement !`);
                  setSnackbarSeverity('success');
                  setSnackbarOpen(true);
                  
                  // Recharger les données utilisateur pour mettre à jour l'interface
                  setTimeout(() => {
                    fetchStructureAndSubscriptionData();
                  }, 1000);
                  return;
                }
              } catch (error) {
                console.error('❌ Erreur lors de l\'ajout du paiement:', paymentIntent.id, error);
              }
            } else {
              existingCount++;
              console.log('⚠️ Paiement déjà existant:', paymentIntent.id);
            }
          }
        }
        
        // Si on arrive ici, aucun nouveau paiement n'a été trouvé
        if (isPollingPayments) {
          console.log('⏳ Aucun nouveau paiement trouvé, continuation du polling...');
          // Ne pas afficher de message pour éviter le spam
        } else {
          const message = existingCount > 0 
            ? `Tous les paiements (${existingCount}) sont déjà enregistrés`
            : 'Aucun nouveau paiement à ajouter';
          
          setSnackbarMessage(message);
          setSnackbarSeverity('info');
          setSnackbarOpen(true);
        }
      } else {
        if (isPollingPayments) {
          console.log('⏳ Aucun paiement trouvé, continuation du polling...');
        } else {
          console.log('📭 Aucun paiement trouvé dans Stripe');
          setSnackbarMessage('Aucun paiement trouvé dans Stripe');
          setSnackbarSeverity('info');
          setSnackbarOpen(true);
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de la vérification Stripe:', error);
      if (!isPollingPayments) {
        setSnackbarMessage('Erreur lors de la vérification des paiements Stripe');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    }
  };

  // Fonction pour démarrer le polling automatique
  const startPaymentPolling = () => {
    if (isPollingPayments) return;
    
    console.log('🔄 Démarrage du polling automatique des paiements...');
    setIsPollingPayments(true);
    setSnackbarMessage('Recherche automatique de nouveaux paiements en cours...');
    setSnackbarSeverity('info');
    setSnackbarOpen(true);
    
    // Vérifier immédiatement
    checkStripePayments();
    
    // Puis vérifier toutes les 5 secondes
    const interval = setInterval(() => {
      checkStripePayments();
    }, 5000);
    
    setPollingInterval(interval);
  };

  // Fonction pour arrêter le polling
  const stopPaymentPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    setIsPollingPayments(false);
    console.log('🛑 Arrêt du polling automatique');
  };

  const formatDate = (date: Mission['publishedAt']) => {
    if (!date) return 'Non publiée';
    
    try {
      // Si c'est un objet Date de Firestore (avec toDate)
      if (typeof date === 'object' && 'toDate' in date) {
        const firebaseDate = date as FirebaseTimestamp;
        return firebaseDate.toDate().toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }

      // Si c'est déjà un objet Date
      if (date instanceof Date) {
        return date.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }

      // Si c'est une chaîne de caractères
      if (typeof date === 'string') {
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      }

      return 'Date invalide';
    } catch (error) {
      console.error('Erreur lors du formatage de la date:', error);
      return 'Date invalide';
    }
  };

  // Fonction pour formater la durée de cotisation
  const formatCotisationDuration = (duration: string) => {
    switch (duration) {
      case 'end_of_school':
        return 'jusqu\'à la fin de vos études';
      case '1_year':
        return '1 an';
      case '2_years':
        return '2 ans';
      case '3_years':
        return '3 ans';
      default:
        return '1 an';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2,
              borderRadius: tokens.radius.md,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            }}
          >
            {error}
          </Alert>
        )}

        <AppPageShell
          eyebrow={isContactWithAccessView ? 'Espace entreprise' : 'Espace étudiant'}
          title={isContactWithAccessView ? 'Événements ambassadeurs' : 'Postuler à une mission'}
          subtitle={
            isContactWithAccessView
              ? 'Consultez les salons et événements de votre programme ambassadeur.'
              : 'Parcourez les missions ouvertes et candidatez en quelques clics.'
          }
          actions={!isContactWithAccessView ? <ApplyStatusLegend /> : undefined}
        >
        <Box sx={{ px: 3, py: 2.5, pb: 4, width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {!isContactWithAccessView && (
            <Box
              sx={{
                mb: 2.5,
                bgcolor: tokens.colors.bgPaper,
                border: `1px solid ${tokens.colors.divider}`,
                borderRadius: tokens.radius.lg,
                px: 2.5,
                py: 2,
              }}
            >
              <LifecycleTracker steps={lifecycleSteps} />
            </Box>
          )}

        <Drawer
          anchor="right"
          open={Boolean(selectedMission)}
          onClose={handleCloseMission}
          variant="temporary"
          PaperProps={{
            sx: {
              width: '100%',
              maxWidth: '800px',
              boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.1)',
              marginTop: '64px',
              height: 'calc(100% - 64px)',
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }
          }}
        >
          {selectedMission && (
            <Box sx={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
            }}>
              <Box sx={{ 
                p: 4, 
                flexGrow: 1, 
                overflow: 'auto',
              }}>
                <Box sx={{ 
                  display: 'flex', 
                  gap: 1.5, 
                  mb: 4,
                }}>
                  <Button
                    variant="contained"
                    onClick={handleApply}
                    disabled={hasApplied(selectedMission?.id)}
                    sx={{
                      bgcolor: hasApplied(selectedMission?.id) ? (isAccepted(selectedMission?.id) ? 'success.main' : 'grey.400') : 
                        (structureData?.cotisationsEnabled && 
                         (!userSubscription || userSubscription.status !== 'active' || 
                          (userSubscription.expiresAt && userSubscription.expiresAt <= new Date()))) 
                        ? 'warning.main' : tokens.colors.brandNavy,
                      color: 'white',
                      borderRadius: tokens.radius.md,
                      textTransform: 'none',
                      '&:hover': {
                        bgcolor: hasApplied(selectedMission?.id) ? (isAccepted(selectedMission?.id) ? 'success.dark' : 'grey.500') : 
                          (structureData?.cotisationsEnabled && 
                           (!userSubscription || userSubscription.status !== 'active' || 
                            (userSubscription.expiresAt && userSubscription.expiresAt <= new Date()))) 
                          ? 'warning.dark' : tokens.colors.brandNavy700,
                      },
                      px: 3,
                      py: 1.5,
                      fontSize: '1rem',
                      fontWeight: 500,
                    }}
                  >
                    {hasApplied(selectedMission?.id) ? (isAccepted(selectedMission?.id) ? 'Recruté' : 'Déjà postulé') : 
                     (structureData?.cotisationsEnabled && 
                      (!userSubscription || userSubscription.status !== 'active' || 
                       (userSubscription.expiresAt && userSubscription.expiresAt <= new Date()))) 
                     ? 'Cotisation requise' : 'Postuler'}
                  </Button>
                </Box>

                    <Typography variant="body2" sx={{ color: '#666666', mb: 0 }}>
                      • Publiée le {selectedMission.publishedAt instanceof Date 
                        ? selectedMission.publishedAt.toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : new Date(selectedMission.publishedAt as any).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                    </Typography>

                  <Grid container spacing={4} alignItems="flex-start">
                    <Grid item xs={12} md={8}>
                      <Box>
                        <Typography variant="h5" sx={{ 
                          fontWeight: 600, 
                          mb: 2,
                          fontSize: '1.75rem',
                          letterSpacing: '-0.5px',
                          color: '#1A1A1A',
                        }}>
                          {selectedMission.title || `Mission #${selectedMission.numeroMission}`}
                        </Typography>

                        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
                          <Typography variant="subtitle1" sx={{ color: '#2E3B7C' }}>
                            {selectedMission.location}
                          </Typography>
                        </Stack>

                        <Box sx={{ 
                          width: '100%', 
                          height: '300px', 
                          borderRadius: tokens.radius.lg, 
                          overflow: 'hidden',
                          border: '1px solid rgba(0,0,0,0.1)',
                          mb: 4
                        }}>
                          <MissionMap 
                            address={selectedMission.location} 
                            coordinates={selectedMission.locationCoordinates}
                          />
                        </Box>

                      <Box>
                        <Typography variant="h6" sx={{ 
                          mb: 2,
                          fontSize: '1.25rem',
                          fontWeight: 600,
                          color: '#1A1A1A',
                        }}>
                          Description de la mission
                        </Typography>
                        <Typography variant="body1" sx={{ 
                          whiteSpace: 'pre-line',
                          color: '#4A4A4A',
                          lineHeight: 1.6,
                        }}>
                          {selectedMission.announcement || selectedMission.description}
                        </Typography>

                        {selectedMission.slots && selectedMission.slots.length > 0 && (
                          <Box sx={{ mt: 3 }}>
                            <Typography variant="h6" sx={{ 
                              mb: 2,
                              fontSize: '1.1rem',
                              fontWeight: 600,
                              color: '#1A1A1A',
                            }}>
                              Détail des horaires
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              {selectedMission.slots.sort((a: any, b: any) => {
                                const dateA = a.startTime.toDate ? a.startTime.toDate() : new Date(a.startTime);
                                const dateB = b.startTime.toDate ? b.startTime.toDate() : new Date(b.startTime);
                                return dateA.getTime() - dateB.getTime();
                              }).map((slot: any, index: number) => {
                                const start = slot.startTime.toDate ? slot.startTime.toDate() : new Date(slot.startTime);
                                const end = slot.endTime.toDate ? slot.endTime.toDate() : new Date(slot.endTime);
                                return (
                                  <Box key={index} sx={{ 
                                    p: 1.5, 
                                    borderRadius: tokens.radius.sm, 
                                    bgcolor: 'rgba(46, 59, 124, 0.04)',
                                    border: '1px solid rgba(46, 59, 124, 0.1)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                  }}>
                                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#2E3B7C', textTransform: 'capitalize' }}>
                                      {start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#4A4A4A' }}>
                                      {start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </Typography>
                                  </Box>
                                );
                              })}
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Paper sx={{ 
                      p: 3, 
                      borderRadius: tokens.radius.xl, 
                      bgcolor: 'rgba(248, 249, 250, 0.8)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                    }}>
                      <Stack spacing={3}>
                        <Box>
                          <Typography sx={{ 
                            mb: 1,
                            color: '#666666',
                            fontSize: '0.875rem',
                          }}>
                            Durée
                          </Typography>
                          <Typography variant="subtitle1" sx={{ 
                            fontWeight: 500,
                            color: '#1A1A1A',
                          }}>
                            {(() => {
                              // Si slots disponibles, calculer le total exact et afficher les détails
                              if (selectedMission.slots && selectedMission.slots.length > 0) {
                                const totalMs = selectedMission.slots.reduce((acc: number, slot: any) => {
                                  if (slot.startTime && slot.endTime) {
                                    // Gérer les dates Firestore (Timestamp) ou Date JS
                                    const start = slot.startTime.toDate ? slot.startTime.toDate() : new Date(slot.startTime);
                                    const end = slot.endTime.toDate ? slot.endTime.toDate() : new Date(slot.endTime);
                                    return acc + (end.getTime() - start.getTime());
                                  }
                                  return acc;
                                }, 0);
                                const totalHours = (totalMs / (1000 * 60 * 60)).toFixed(2);
                                
                                return (
                                  <Box>
                                    <div style={{
                                      fontSize: '14px',
                                      fontWeight: 600,
                                      color: 'rgb(30, 64, 175)'
                                    }}>
                                      Total: {totalHours}h
                                    </div>
                                    <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                      {selectedMission.slots.sort((a: any, b: any) => {
                                        const dateA = a.startTime.toDate ? a.startTime.toDate() : new Date(a.startTime);
                                        const dateB = b.startTime.toDate ? b.startTime.toDate() : new Date(b.startTime);
                                        return dateA.getTime() - dateB.getTime();
                                      }).map((slot: any, index: number) => {
                                        const start = slot.startTime.toDate ? slot.startTime.toDate() : new Date(slot.startTime);
                                        const end = slot.endTime.toDate ? slot.endTime.toDate() : new Date(slot.endTime);
                                        return (
                                          <Typography key={index} variant="caption" sx={{ color: '#666666', display: 'block' }}>
                                            • {start.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} : {start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                          </Typography>
                                        );
                                      })}
                                    </Box>
                                  </Box>
                                );
                              }

                              // Si c'est un événement ambassadeur sans slots mais avec dates
                              if (selectedMission.startDate && selectedMission.endDate) {
                                const start = new Date(selectedMission.startDate);
                                const end = new Date(selectedMission.endDate);
                                const diff = Math.abs(end.getTime() - start.getTime());
                                const hours = Math.ceil(diff / (1000 * 60 * 60));
                                if (hours > 0) return `${hours}h`;
                              }
                              
                              // Sinon fallback sur hoursPerStudent ou hours
                              const hours = selectedMission.hoursPerStudent || Math.floor(selectedMission.hours / selectedMission.studentCount);
                              return hours > 0 ? `${hours}h` : 'À définir';
                            })()}
                          </Typography>
                        </Box>
                        <Divider sx={{ borderColor: 'rgba(0, 0, 0, 0.1)' }} />
                        {selectedMission.type !== 'ambassadeur_event' && !selectedMission.numeroMission?.startsWith('AMB-') && (
                        <Box>
                          <Typography sx={{ 
                            mb: 1,
                            color: '#666666',
                            fontSize: '0.875rem',
                          }}>
                            Rémunération
                          </Typography>
                          <Typography variant="subtitle1" sx={{ 
                            fontWeight: 500,
                            color: '#1A1A1A',
                          }}>
                            {(() => {
                              const amount = selectedMission.salary || selectedMission.priceHT || 0;
                              if (amount === 0 || !amount) {
                                return 'Non communiqué';
                              }
                              return selectedMission.numeroMission?.startsWith('RT-') 
                                ? `${amount}€`
                                : `${amount}€/h`;
                            })()}
                          </Typography>
                        </Box>
                        )}
                        {selectedMission.type !== 'ambassadeur_event' && !selectedMission.numeroMission?.startsWith('AMB-') && (
                        <Divider sx={{ borderColor: 'rgba(0, 0, 0, 0.1)' }} />
                        )}
                        <Box>
                          <Typography sx={{ 
                            mb: 1,
                            color: '#666666',
                            fontSize: '0.875rem',
                          }}>
                            Date de début
                          </Typography>
                          <Typography variant="subtitle1" sx={{ 
                            fontWeight: 500,
                            color: '#1A1A1A',
                          }}>
                            {selectedMission.startDate ? 
                              new Date(selectedMission.startDate).toLocaleDateString() : 
                              'À définir'}
                          </Typography>
                        </Box>
                        <Divider sx={{ borderColor: 'rgba(0, 0, 0, 0.1)' }} />
                        <Box>
                          <Typography sx={{ 
                            mb: 1,
                            color: '#666666',
                            fontSize: '0.875rem',
                          }}>
                            Date de publication
                          </Typography>
                          <Typography variant="subtitle1" sx={{ 
                            fontWeight: 500,
                            color: '#1A1A1A',
                          }}>
                            {selectedMission.publishedAt ? 
                              (selectedMission.publishedAt instanceof Date 
                                ? selectedMission.publishedAt.toLocaleDateString()
                                : new Date(selectedMission.publishedAt as any).toLocaleDateString()) : 
                              'Non publiée'}
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>

              <Box sx={{ 
                position: 'absolute',
                top: 16,
                right: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                zIndex: 1,
              }}>
                <Typography variant="body2" sx={{ color: '#666666' }}>
                  {currentMissionIndex + 1}/{allItems.length}
                </Typography>
                <IconButton 
                  disabled={currentMissionIndex === 0}
                  onClick={() => handleNavigateMission('prev')}
                  sx={{
                    bgcolor: 'white',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    borderRadius: tokens.radius.md,
                    color: '#666666',
                    '&:hover': { 
                      bgcolor: 'rgba(0, 0, 0, 0.04)',
                    },
                    '&.Mui-disabled': {
                      color: 'rgba(0, 0, 0, 0.26)',
                    },
                  }}
                >
                  <NavigateBeforeIcon />
                </IconButton>
                <IconButton 
                  disabled={currentMissionIndex === allItems.length - 1}
                  onClick={() => handleNavigateMission('next')}
                  sx={{
                    bgcolor: 'white',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    borderRadius: tokens.radius.md,
                    color: '#666666',
                    '&:hover': { 
                      bgcolor: 'rgba(0, 0, 0, 0.04)',
                    },
                    '&.Mui-disabled': {
                      color: 'rgba(0, 0, 0, 0.26)',
                    },
                  }}
                >
                  <NavigateNextIcon />
                </IconButton>
                <Button
                  onClick={handleCloseMission}
                  variant="outlined"
                  sx={{
                    borderRadius: tokens.radius.md,
                    textTransform: 'none',
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                    color: '#666666',
                    '&:hover': {
                      borderColor: '#2E3B7C',
                      color: '#2E3B7C',
                      bgcolor: 'rgba(46, 59, 124, 0.04)',
                    },
                    px: 2,
                  }}
                >
                  Fermer
                </Button>
              </Box>
            </Box>
          )}
        </Drawer>

        <Dialog 
          open={applyDialogOpen} 
          onClose={() => !isSubmitting && setApplyDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: tokens.radius.xxl,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              width: '400px',
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }
          }}
        >
          <DialogTitle sx={{ 
            textAlign: 'center',
            fontSize: '20px',
            fontWeight: 500,
            pt: 3,
            pb: 2,
            color: '#1A1A1A',
            letterSpacing: '-0.3px',
          }}>
            {applicationSuccess ? 'Candidature envoyée' : 'Postuler à la mission'}
            {!applicationSuccess && (
              <IconButton
                onClick={() => setApplyDialogOpen(false)}
                sx={{ 
                  position: 'absolute', 
                  right: 16, 
                  top: 16,
                  color: 'rgba(0, 0, 0, 0.6)',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  }
                }}
              >
                <CloseIcon sx={{ fontSize: 20 }} />
              </IconButton>
            )}
          </DialogTitle>
          <DialogContent sx={{ px: 3, pb: 3 }}>
            {applicationSuccess ? (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                py: 4,
                gap: 2
              }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    bgcolor: 'success.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2,
                    boxShadow: '0 4px 12px rgba(76, 175, 80, 0.2)',
                  }}
                >
                  <CheckIcon sx={{ color: 'white', fontSize: 32 }} />
                </Box>
                <Typography variant="h6" sx={{ 
                  textAlign: 'center',
                  color: 'success.main',
                  fontWeight: 500,
                  fontSize: '1.25rem',
                }}>
                  Candidature envoyée avec succès
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ 
                  textAlign: 'center',
                  color: '#666666',
                  fontSize: '0.95rem',
                }}>
                  Nous examinerons votre candidature et reviendrons vers vous rapidement
                </Typography>
              </Box>
            ) : (
              <>
                {selectedMission?.requiresCV && (
                  <Box>
                    <Typography variant="subtitle1" sx={{ 
                      mb: 1,
                      fontWeight: 500,
                      color: '#1A1A1A',
                    }}>
                      CV récent
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ 
                      mb: 2,
                      color: '#666666',
                    }}>
                      Votre CV doit avoir moins de 6 mois
                    </Typography>
                    {userCV ? (
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: 2,
                        p: 2,
                        border: '1px solid',
                        borderColor: 'rgba(0, 0, 0, 0.1)',
                        borderRadius: tokens.radius.lg,
                        mb: 2,
                        background: 'rgba(0, 0, 0, 0.02)',
                      }}>
                        <PdfIcon sx={{ color: '#2E3B7C' }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            Mon CV
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#666666' }}>
                            Mis à jour le {userCV.updatedAt.toLocaleDateString()}
                          </Typography>
                        </Box>
                        <Button 
                          size="small"
                          onClick={() => window.open(userCV.url, '_blank')}
                          sx={{
                            color: '#2E3B7C',
                            '&:hover': {
                              backgroundColor: 'rgba(46, 59, 124, 0.04)',
                            },
                          }}
                        >
                          Voir
                        </Button>
                        <Button
                          component="label"
                          size="small"
                          sx={{
                            color: '#2E3B7C',
                            '&:hover': {
                              backgroundColor: 'rgba(46, 59, 124, 0.04)',
                            },
                          }}
                        >
                          Modifier
                          <VisuallyHiddenInput
                            type="file"
                            accept=".pdf"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleCVUpload(e.target.files[0]);
                              }
                            }}
                          />
                        </Button>
                      </Box>
                    ) : (
                      <Button
                        variant="outlined"
                        fullWidth
                        disabled={isSubmitting}
                        sx={{
                          borderRadius: tokens.radius.md,
                          textTransform: 'none',
                          borderColor: 'rgba(46, 59, 124, 0.2)',
                          color: '#2E3B7C',
                          '&:hover': {
                            borderColor: '#2E3B7C',
                            background: 'rgba(46, 59, 124, 0.05)',
                          },
                          py: 1.5,
                        }}
                      >
                        Sélectionner un CV
                      </Button>
                    )}
                  </Box>
                )}

                {selectedMission?.requiresMotivation && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ 
                      mb: 1,
                      fontWeight: 500,
                      color: '#1A1A1A',
                    }}>
                      Lettre de motivation
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      placeholder="Expliquez votre motivation pour cette mission..."
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: tokens.radius.md,
                          '& fieldset': {
                            borderColor: 'rgba(0, 0, 0, 0.1)',
                          },
                          '&:hover fieldset': {
                            borderColor: '#2E3B7C',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#2E3B7C',
                          },
                          '& .MuiOutlinedInput-input': {
                            color: '#1A1A1A',
                          },
                        }
                      }}
                    />
                  </Box>
                )}

                <Button
                  variant="contained"
                  fullWidth
                  disabled={isSubmitting}
                  sx={{
                    bgcolor: '#2E3B7C',
                    color: 'white',
                    borderRadius: tokens.radius.md,
                    textTransform: 'none',
                    '&:hover': {
                      bgcolor: '#232D5F',
                    },
                    py: 1.5,
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: '48px',
                    fontSize: '1rem',
                    fontWeight: 500,
                  }}
                  onClick={handleSubmitApplication}
                >
                  {isSubmitting ? (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: '#2E3B7C',
                        minHeight: '48px',
                      }}
                    >
                      <CircularProgress
                        size={24}
                        sx={{
                          color: 'white',
                          animation: 'spin 1s linear infinite',
                        }}
                      />
                    </Box>
                  ) : (
                    'Envoyer ma candidature'
                  )}
                </Button>
              </>
            )}
          </DialogContent>
        </Dialog>

        {createPortal(
          <Snackbar
            open={snackbarOpen}
            autoHideDuration={6000}
            onClose={() => setSnackbarOpen(false)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            sx={{ zIndex: 10000 }}
          >
            <Alert 
              onClose={() => setSnackbarOpen(false)} 
              severity={snackbarSeverity}
              sx={{ width: '100%' }}
            >
              {snackbarMessage}
            </Alert>
          </Snackbar>,
          document.body
        )}

        {isContactWithAccessView && (
          <>
            <Box
              sx={{
                display: 'flex',
                alignItems: { xs: 'stretch', md: 'center' },
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 2,
                mb: 2.5,
                pb: 2,
                borderBottom: `1px solid ${tokens.colors.divider}`,
              }}
            >
              <ApplyFilterBar
                options={EVENT_FILTER_OPTIONS}
                value={activeEventFilter}
                onChange={setActiveEventFilter}
                inline
              />
              <ApplyStatusLegend />
            </Box>
            {filteredAmbassadorEvents.length > 0 ? (
              <ApplyListingGrid>
                {filteredAmbassadorEvents.map((event) => {
                  const title = event.title || `Événement #${event.numeroMission}`;
                  const { status, label } = getApplyCardStatus(event.id, hasApplied, isAccepted, event.startDate);
                  const tags = ['Salon', 'Ambassadeur'].filter((tag) =>
                    tag === 'Salon' ? /salon/i.test(title) : true,
                  );
                  if (event.studentCount > 0) tags.push(`${event.studentCount} places`);

                  return (
                    <ApplyListingCard
                      key={`ambassador-${event.id}`}
                      status={status}
                      statusLabel={label}
                      badgeRight={event.studentCount > 0 ? `${event.studentCount} places` : undefined}
                      initials={initialsFromTitle(title)}
                      avatarColor={avatarColorFromSeed(event.id)}
                      title={title}
                      subtitle="Salon / Événement"
                      description={
                        event.announcement ||
                        event.description ||
                        'Événement ambassadeur ouvert aux étudiants de la structure.'
                      }
                      tags={tags}
                      meta={[
                        ...(formatEventDate(event.startDate)
                          ? [{ icon: <CalendarTodayIcon />, label: formatEventDate(event.startDate)! }]
                          : []),
                        ...(event.studentCount > 0
                          ? [{ icon: <GroupsIcon />, label: `${event.studentCount} places` }]
                          : []),
                        ...(event.location && event.location !== 'À définir'
                          ? [{ icon: <LocationOnIcon />, label: event.location }]
                          : []),
                      ]}
                      actionLabel="Voir les détails"
                      onAction={() => handleOpenMission(event)}
                      onClick={() => handleOpenMission(event)}
                    />
                  );
                })}
              </ApplyListingGrid>
            ) : ambassadorEvents.length > 0 ? (
              <ApplyEmptyState message="Aucun événement ne correspond aux filtres sélectionnés." />
            ) : (
              <ApplyEmptyState message="Aucun événement ambassadeur pour le moment." />
            )}
          </>
        )}

        {!isContactWithAccessView && (
          <>
            <ApplyFilterBar
              options={MISSION_BOARD_FILTER_OPTIONS}
              value={activeMissionBoardFilter}
              onChange={setActiveMissionBoardFilter}
              starOption="Compatible profil"
            />

            {displayMissions.length > 0 ? (
              <ApplyListingGrid>
                {displayMissions.map(({ mission, matchPct }) => {
                  const title = mission.title || `Mission #${mission.numeroMission}`;
                  const hours =
                    mission.hoursPerStudent ||
                    Math.floor((mission.hours || 0) / Math.max(mission.studentCount || 1, 1));
                  const { status, label } = getApplyCardStatus(
                    mission.id,
                    hasApplied,
                    isAccepted,
                    mission.startDate,
                  );
                  const company = (mission as Mission & { company?: string }).company || 'Mission';
                  const tags = [
                    `${hours}h`,
                    `${mission.studentCount} étudiant${mission.studentCount > 1 ? 's' : ''}`,
                  ];
                  if (isRemoteLocation(mission.location)) tags.push('Distanciel');
                  else if (mission.location) tags.push('Présentiel');

                  return (
                    <ApplyListingCard
                      key={`mission-${mission.id}`}
                      status={status}
                      statusLabel={label}
                      badgeRight={`${matchPct}%`}
                      showStarBadge
                      initials={initialsFromTitle(company, 'MI')}
                      avatarColor={avatarColorFromSeed(company)}
                      title={title}
                      subtitle={company}
                      description={
                        mission.announcement ||
                        mission.description ||
                        'Mission ouverte aux étudiants de la structure.'
                      }
                      tags={tags}
                      meta={[
                        ...(hours > 0 ? [{ icon: <TimerIcon />, label: `${hours}h` }] : []),
                        ...(mission.salary || mission.priceHT
                          ? [{ icon: <EuroIcon />, label: `${mission.salary || mission.priceHT} €` }]
                          : []),
                        ...(mission.location
                          ? [{ icon: <LocationOnIcon />, label: mission.location }]
                          : []),
                      ]}
                      actionLabel={
                        hasApplied(mission.id)
                          ? isAccepted(mission.id)
                            ? 'Recruté'
                            : 'Déjà postulé'
                          : 'Postuler'
                      }
                      actionDisabled={hasApplied(mission.id)}
                      onAction={() => handleOpenMission(mission)}
                      onClick={() => handleOpenMission(mission)}
                    />
                  );
                })}
              </ApplyListingGrid>
            ) : filteredMissions.length > 0 ? (
              <ApplyEmptyState message="Aucune mission ne correspond aux filtres sélectionnés." />
            ) : null}

            {!isContactWithAccessView && recruitmentTasks.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.colors.gray900, mb: 1.5 }}>
                  Recrutements
                </Typography>
                <ApplyListingGrid>
                  {recruitmentTasks.map((task) => {
                    const taskAsMission = {
                      id: task.id,
                      title: task.title,
                      numeroMission: task.numeroEtude || `RT-${task.id.slice(-6)}`,
                      location: task.location || 'À définir',
                      publishedAt: task.publishedAt || new Date(),
                      announcement: task.description,
                      description: task.description,
                      hoursPerStudent: task.duration,
                      hours: task.duration,
                      studentCount: task.studentsToRecruit || 1,
                      salary: task.remuneration,
                      priceHT: task.remuneration,
                      startDate: task.startDate,
                      requiresCV: task.requiresCV || false,
                      requiresMotivation: task.requiresMotivation || false,
                    } as Mission;
                    const { status, label } = getApplyCardStatus(
                      task.id,
                      hasApplied,
                      isAccepted,
                      task.startDate,
                    );

                    return (
                      <ApplyListingCard
                        key={`recruitment-${task.id}`}
                        status={status}
                        statusLabel={label}
                        initials={initialsFromTitle(task.title, 'RC')}
                        avatarColor={avatarColorFromSeed(task.id)}
                        title={task.title}
                        subtitle="Recrutement"
                        description={task.description}
                        tags={[
                          `${task.studentsToRecruit || 1} étudiant${(task.studentsToRecruit || 1) > 1 ? 's' : ''}`,
                          ...(task.duration > 0 ? [`${task.duration}h`] : []),
                        ]}
                        meta={[
                          ...(task.duration > 0 ? [{ icon: <TimerIcon />, label: `${task.duration}h` }] : []),
                          ...(task.remuneration ? [{ icon: <EuroIcon />, label: `${task.remuneration} €` }] : []),
                          ...(task.location ? [{ icon: <LocationOnIcon />, label: task.location }] : []),
                        ]}
                        actionLabel={hasApplied(task.id) ? 'Déjà postulé' : 'Postuler'}
                        actionDisabled={hasApplied(task.id)}
                        onAction={() => handleOpenMission(taskAsMission)}
                        onClick={() => handleOpenMission(taskAsMission)}
                      />
                    );
                  })}
                </ApplyListingGrid>
              </Box>
            )}
          </>
        )}

        {!isContactWithAccessView &&
          missions.length === 0 &&
          recruitmentTasks.length === 0 &&
          !loading && (
            <ApplyEmptyState message="Aucune mission disponible pour le moment." />
          )}

        {/* Dialogue pour profil incomplet */}
        <Dialog
          open={incompleteProfileDialogOpen}
          onClose={() => setIncompleteProfileDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: tokens.radius.lg,
              boxShadow: '0 0 40px rgba(0, 0, 0, 0.1)',
              width: '400px',
            }
          }}
        >
          <DialogTitle sx={{ 
            textAlign: 'center',
            fontSize: '18px',
            fontWeight: 500,
            pt: 3,
            pb: 2,
          }}>
            Profil incomplet
            <IconButton
              onClick={() => setIncompleteProfileDialogOpen(false)}
              sx={{ 
                position: 'absolute', 
                right: 16, 
                top: 16,
                color: 'rgba(0, 0, 0, 0.6)',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                }
              }}
            >
              <CloseIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pb: 3 }}>
            <Typography variant="body1" sx={{ mb: 2, textAlign: 'center' }}>
              Pour postuler aux missions, vous devez d'abord compléter votre profil à 100%.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
              Votre profil est actuellement complété à {profileData ? calculateCompletion(profileData) : 0}%
            </Typography>
            <Button
              fullWidth
              variant="contained"
              onClick={handleNavigateToProfile}
              sx={{
                bgcolor: '#2E3B7C',
                color: 'white',
                borderRadius: tokens.radius.sm,
                textTransform: 'none',
                '&:hover': {
                  bgcolor: '#232D5F',
                },
                py: 1.5,
              }}
            >
              Compléter mon profil
            </Button>
          </DialogContent>
        </Dialog>

        {/* Dialogue pour cotisation manquante */}
        <Dialog
          open={subscriptionDialogOpen}
          onClose={() => setSubscriptionDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: tokens.radius.lg,
              boxShadow: '0 0 40px rgba(0, 0, 0, 0.1)',
              width: '400px',
            }
          }}
        >
          <DialogTitle sx={{ 
            textAlign: 'center',
            fontSize: '18px',
            fontWeight: 500,
            pt: 3,
            pb: 2,
          }}>
            Cotisation requise
            <IconButton
              onClick={() => setSubscriptionDialogOpen(false)}
              sx={{ 
                position: 'absolute', 
                right: 16, 
                top: 16,
                color: 'rgba(0, 0, 0, 0.6)',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                }
              }}
            >
              <CloseIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pb: 3 }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  bgcolor: 'warning.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                  boxShadow: '0 4px 12px rgba(255, 152, 0, 0.2)',
                }}
              >
                <PaymentIcon sx={{ color: 'white', fontSize: 32 }} />
              </Box>
              <Typography variant="h6" sx={{ 
                color: 'warning.main',
                fontWeight: 500,
                fontSize: '1.25rem',
                mb: 1,
              }}>
                Cotisation obligatoire
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ mb: 2, textAlign: 'center' }}>
              Pour postuler aux missions de cette structure, vous devez d'abord payer votre cotisation annuelle.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
              Montant de la cotisation : <strong>{structureData?.cotisationAmount}€</strong>
            </Typography>
            {(() => {
              const hasActiveSubscription = userSubscription?.status === 'active' && 
                userSubscription?.expiresAt && 
                userSubscription.expiresAt > new Date();

              if (hasActiveSubscription) {
                return (
                  <Box sx={{ textAlign: 'center' }}>
                    <Chip
                      label={`Cotisation active jusqu'au ${userSubscription.expiresAt.toLocaleDateString('fr-FR')}`}
                      color="success"
                      sx={{ mb: 2 }}
                    />
                    <Button
                      disabled
                      variant="outlined"
                      fullWidth
                      sx={{
                        borderRadius: tokens.radius.sm,
                        textTransform: 'none',
                        py: 1.5,
                        color: 'text.secondary',
                        borderColor: 'text.secondary',
                        '&:disabled': {
                          color: 'text.secondary',
                          borderColor: 'text.secondary',
                        }
                      }}
                    >
                      Cotisation déjà payée
                    </Button>
                  </Box>
                );
              }

              return (
                <Button
                  onClick={handleOpenPaymentDialog}
                  variant="contained"
                  fullWidth
                  sx={{
                    bgcolor: 'warning.main',
                    color: 'white',
                    borderRadius: tokens.radius.sm,
                    textTransform: 'none',
                    '&:hover': {
                      bgcolor: 'warning.dark',
                    },
                    py: 1.5,
                  }}
                >
                  Payer ma cotisation
                </Button>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Dialogue de paiement Stripe */}
        <Dialog
          open={paymentDialogOpen}
          onClose={() => {
            if (!paymentLoading && !paymentProcessing) {
              setPaymentDialogOpen(false);
              // Arrêter le polling quand on ferme la modal
              stopPaymentPolling();
            }
          }}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: tokens.radius.lg,
              boxShadow: '0 0 40px rgba(0, 0, 0, 0.1)',
              width: '500px',
            }
          }}
        >
          <DialogTitle sx={{ 
            textAlign: 'center',
            fontSize: '20px',
            fontWeight: 500,
            pt: 3,
            pb: 2,
          }}>
            Paiement de la cotisation
            <IconButton
              onClick={() => {
                setPaymentDialogOpen(false);
                stopPaymentPolling();
              }}
              disabled={paymentLoading || paymentProcessing}
              sx={{ 
                position: 'absolute', 
                right: 16, 
                top: 16,
                color: 'rgba(0, 0, 0, 0.6)',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                }
              }}
            >
              <CloseIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pb: 3 }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                  boxShadow: '0 4px 12px rgba(25, 118, 210, 0.2)',
                }}
              >
                <PaymentIcon sx={{ color: 'white', fontSize: 32 }} />
              </Box>
              <Typography variant="h6" sx={{ 
                color: 'primary.main',
                fontWeight: 500,
                fontSize: '1.25rem',
                mb: 1,
              }}>
                Cotisation {structureData?.structureName ? `- ${structureData.structureName}` : ''}
              </Typography>
            </Box>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="body1" sx={{ mb: 2, textAlign: 'center' }}>
                Montant à payer : <strong>{structureData?.cotisationAmount}€</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                Cette cotisation vous permettra de postuler aux missions de <strong>{structureData?.structureName || 'la structure'}</strong> pendant <strong>{formatCotisationDuration(structureData?.cotisationDuration || '1_year')}</strong>.
              </Typography>
            </Box>

            {paymentLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress />
              </Box>
            ) : paymentProcessing ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, gap: 1 }}>
                <CircularProgress size={24} />
                <Typography variant="body2" color="text.secondary">Validation du paiement en cours...</Typography>
              </Box>
            ) : (
              <>
                <Box 
                  id="stripe-payment-element" 
                  sx={{ 
                    mb: 3,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    '& stripe-buy-button': {
                      display: 'flex',
                      justifyContent: 'center',
                      width: '100%'
                    }
                  }}
                >
                  {/* Le bouton Stripe sera injecté ici */}
                </Box>

                {/* Indicateur de polling automatique */}
                {isPollingPayments && (
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: 1, 
                    py: 2,
                    bgcolor: 'info.50',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'info.200'
                  }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="info.main">
                      Recherche automatique de nouveaux paiements...
                    </Typography>
                  </Box>
                )}
              </>
            )}




          </DialogContent>
        </Dialog>

        {/* Dialogue de succès de paiement */}
        <Dialog
          open={paymentSuccessDialogOpen}
          onClose={() => setPaymentSuccessDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: tokens.radius.lg,
              boxShadow: '0 0 40px rgba(0, 0, 0, 0.1)',
              width: '500px',
            }
          }}
        >
          <DialogContent sx={{ px: 4, py: 4, textAlign: 'center' }}>
            <Box sx={{ mb: 3 }}>
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  bgcolor: 'success.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3,
                  boxShadow: '0 4px 20px rgba(76, 175, 80, 0.3)',
                }}
              >
                <CheckCircleIcon sx={{ color: 'white', fontSize: 48 }} />
              </Box>
              <Typography variant="h5" sx={{ 
                color: 'success.main',
                fontWeight: 700,
                mb: 2,
              }}>
                Paiement réussi !
              </Typography>
              <Typography variant="h6" sx={{ 
                color: 'text.primary',
                fontWeight: 600,
                mb: 2,
              }}>
                Cotisation validée
              </Typography>
            </Box>
            
            <Box sx={{ mb: 4 }}>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Votre cotisation de <strong>{structureData?.cotisationAmount}€</strong> a été payée avec succès.
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Vous pouvez maintenant postuler aux missions de <strong>{structureData?.structureName || 'la structure'}</strong>.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Votre cotisation est valide jusqu'au <strong>{userSubscription?.expiresAt?.toLocaleDateString('fr-FR')}</strong>.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="contained"
                onClick={() => setPaymentSuccessDialogOpen(false)}
                sx={{
                  borderRadius: tokens.radius.md,
                  textTransform: 'none',
                  px: 4,
                  py: 1.5,
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                  boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #45a049 0%, #388e3c 100%)',
                    boxShadow: '0 6px 16px rgba(76, 175, 80, 0.4)',
                  },
                }}
              >
                Parfait !
              </Button>
            </Box>
          </DialogContent>
        </Dialog>
        </Box>
        </AppPageShell>
    </>
  );
};

export default AvailableMissions; 