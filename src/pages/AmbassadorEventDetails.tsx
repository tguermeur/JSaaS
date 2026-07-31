import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  updateDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, storage } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Mission } from '../types/mission';
import { Document } from '../types/document';
import {
  LocationOn as LocationIcon,
  CalendarToday as CalendarIcon,
  People as PeopleIcon,
  Description as DescriptionIcon,
  PictureAsPdf as PdfIcon,
  InsertDriveFile as FileIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  AccessTime as AccessTimeIcon,
  Transform as TransformIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  Add as AddIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  MoreVert as MoreVertIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { TextField, MenuItem, Box, Typography, InputAdornment, Dialog, DialogTitle, DialogContent, DialogActions, Button, Checkbox, FormControlLabel, Tab, Tabs, CircularProgress, IconButton, Menu, ListItemIcon, ListItemText } from '@mui/material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AmbassadorEventForm } from '../components/missions/AmbassadorEventForm';
import { useAuth } from '../contexts/AuthContext';
import { getAmbassadorUsers, resolveAmbassadorEventCompanyName } from '../services/ambassadorService';
import { decryptUsersList, getSafeDisplayName } from '../utils/decryptUserUtils';
import UserNameText from '../components/common/UserNameText';
import { tokens } from '../theme/tokens';
import { PortalTopBar, CaeKpi, dsPageCanvasSx, dsTabsSx } from '../components/ds';
import { Send as SendIcon, ChevronLeft as ChevronLeftIcon, Dashboard as DashboardIcon, Folder as FolderIcon } from '@mui/icons-material';
import { sendStructureProposalRequestEmail } from '../services/emailjsStructureProposal';
import { sendAmbassadorEventAnnouncementEmail } from '../services/emailjsAmbassadorAnnouncement';
import { logEmailSend } from '../services/emailLogService';

const appleFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const toMissionDate = (v: unknown): Date => {
  if (v == null) return new Date();
  if (v instanceof Date) return v;
  if (typeof (v as { toDate?: () => Date }).toDate === 'function') return (v as { toDate: () => Date }).toDate();
  return new Date(v as string | number);
};

const getTotalPlannedHours = (mission: Mission | null): number => {
  if (!mission?.slots?.length) return 0;
  const total = mission.slots.reduce((acc, slot) => {
    const start = toMissionDate(slot.startTime);
    const end = toMissionDate(slot.endTime);
    const durationHours = Math.max(0, (end.getTime() - start.getTime()) / 3_600_000);
    const capacity = slot.capacity || 1;
    return acc + durationHours * capacity;
  }, 0);
  return Math.round(total * 100) / 100;
};

const formatHours = (h: number) => {
  if (!Number.isFinite(h)) return '0';
  const rounded = Math.round(h * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
};

const PROPOSAL_REQUEST_COOLDOWN_MS = 48 * 60 * 60 * 1000;

const toOptionalDate = (v: unknown): Date | null => {
  if (v == null) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof (v as { toDate?: () => Date }).toDate === 'function') {
    const d = (v as { toDate: () => Date }).toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(v as string | number);
  return isNaN(d.getTime()) ? null : d;
};

const getProposalCooldownRemainingMs = (lastAt: Date | null, now = Date.now()): number => {
  if (!lastAt) return 0;
  return Math.max(0, PROPOSAL_REQUEST_COOLDOWN_MS - (now - lastAt.getTime()));
};

const formatProposalCooldownRemaining = (ms: number): string => {
  if (ms <= 0) return '';
  const totalMinutes = Math.ceil(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `${days} j ${remHours} h` : `${days} j`;
  }
  if (hours > 0 && minutes > 0) return `${hours} h ${minutes} min`;
  if (hours > 0) return `${hours} h`;
  return `${minutes} min`;
};

interface EventDocument extends Document {
  documentType?: string;
  visibleToCompany?: boolean;
  internalHidden?: boolean;
}

const extractStoragePathFromUrl = (url: string): string => {
  if (!url || !url.startsWith('http')) return url;
  try {
    const match = url.match(/\/o\/(.+?)(\?|$)/);
    if (match?.[1]) return decodeURIComponent(match[1]);
  } catch {
    // ignore
  }
  return '';
};

const mapGeneratedDocumentToEventDocument = (
  docSnap: { id: string; data: () => Record<string, unknown> }
): EventDocument => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: (data.fileName as string) || 'Sans nom',
    size: (data.fileSize as number) || 0,
    type: (data.fileName as string)?.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
    url: (data.fileUrl as string) || '',
    storagePath: (data.storagePath as string) || extractStoragePathFromUrl((data.fileUrl as string) || ''),
    parentFolderId: null,
    uploadedBy: (data.createdBy as string) || '',
    uploadedByName: data.uploadedByName as string | undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    structureId: (data.structureId as string) || '',
    isRestricted: false,
    missionId: data.missionId as string,
    missionNumber: data.missionNumber as string,
    missionTitle: data.missionTitle as string,
    isPinned: (data.isPinned as boolean) || false,
    documentType: data.documentType as string | undefined,
    internalHidden: data.internalHidden === true,
    visibleToCompany: data.internalHidden === true
      ? false
      : data.documentType === 'autre' || data.visibleToCompany !== false,
  };
};

interface StudentInfo {
  id: string;
  email?: string;
  displayName?: string;
  slotId?: string;
  slotLabel?: string;
  status?: 'En attente' | 'Acceptée' | 'Refusée';
  submittedAt?: Date;
  motivationLetter?: string;
  cvUrl?: string;
  isFromApplication?: boolean;
  applicationId?: string;
  isDossierValidated?: boolean;
  selectedSlotIds?: string[];
  acceptedSlotIds?: string[];
}

const resolveSlotId = (slot: { id?: string }, index: number) => slot.id || `day-${index}`;

const expandSlotId = (rawId: string, slots: Mission['slots'] | undefined): string[] => {
  if (!rawId) return [];
  if (!slots?.length) return [rawId];
  const out = new Set<string>([rawId]);
  slots.forEach((slot, index) => {
    const resolved = resolveSlotId(slot, index);
    if (resolved === rawId || slot.id === rawId) {
      out.add(resolved);
      if (slot.id) out.add(slot.id);
    }
  });
  return Array.from(out);
};

const slotIdsMatch = (a: string, b: string, slots: Mission['slots'] | undefined): boolean =>
  expandSlotId(a, slots).some((id) => expandSlotId(b, slots).includes(id));

const getAssignedSlotIdsForStudent = (
  slots: Mission['slots'] | undefined,
  studentId: string,
): string[] => {
  if (!slots) return [];
  return slots
    .map((slot, index) => ({
      slotId: resolveSlotId(slot, index),
      assigned: slot.assignedStudentIds || [],
    }))
    .filter(({ assigned }) => assigned.includes(studentId))
    .map(({ slotId }) => slotId);
};

const resolveDisplayStatus = (student: StudentInfo): 'En attente' | 'Acceptée' | 'Refusée' => {
  if (student.status === 'Refusée') return 'Refusée';
  if ((student.acceptedSlotIds?.length ?? 0) > 0) return 'Acceptée';
  return 'En attente';
};

const formatSlotLabel = (slot: NonNullable<Mission['slots']>[number]): string => {
  const startDate = slot.startTime instanceof Date
    ? slot.startTime
    : typeof (slot.startTime as { toDate?: () => Date })?.toDate === 'function'
      ? (slot.startTime as { toDate: () => Date }).toDate()
      : new Date(slot.startTime as string | number);
  const endDate = slot.endTime instanceof Date
    ? slot.endTime
    : typeof (slot.endTime as { toDate?: () => Date })?.toDate === 'function'
      ? (slot.endTime as { toDate: () => Date }).toDate()
      : new Date(slot.endTime as string | number);
  return `${format(startDate, 'EEE d MMM', { locale: fr })} · ${startDate.toTimeString().slice(0, 5)}–${endDate.toTimeString().slice(0, 5)}`;
};

export const AmbassadorEventDetails: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { userData, isContactWithAccess, contactPermissions, currentUser } = useAuth();
  const [mission, setMission] = useState<Mission | null>(null);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [documents, setDocuments] = useState<EventDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [missionNumber, setMissionNumber] = useState('');
  const [selectedChargeId, setSelectedChargeId] = useState('');
  const [availableCharges, setAvailableCharges] = useState<Array<{ id: string; displayName: string; firstName?: string; lastName?: string; photoURL?: string }>>([]);
  const [convertedMissionId, setConvertedMissionId] = useState<string | null>(null);
  const [addAmbassadorDialogOpen, setAddAmbassadorDialogOpen] = useState(false);
  const [availableAmbassadors, setAvailableAmbassadors] = useState<Array<{ id: string; email?: string; displayName?: string }>>([]);
  const [selectedAmbassadors, setSelectedAmbassadors] = useState<Set<string>>(new Set());
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [addingAmbassadors, setAddingAmbassadors] = useState(false);
  const [detailTab, setDetailTab] = useState<'overview' | 'documents'>('overview');
  const [proposalSending, setProposalSending] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [proposalNow, setProposalNow] = useState(() => Date.now());

  const [announceDialogOpen, setAnnounceDialogOpen] = useState(false);
  const [announceLoading, setAnnounceLoading] = useState(false);
  const [announceError, setAnnounceError] = useState<string | null>(null);
  const [announceSuccess, setAnnounceSuccess] = useState<string | null>(null);
  const [announceCampus, setAnnounceCampus] = useState<string>('__ALL__');
  const [announceStart, setAnnounceStart] = useState<string>(''); // datetime-local string
  const [announceEnd, setAnnounceEnd] = useState<string>(''); // datetime-local string
  const [announceUseCustom, setAnnounceUseCustom] = useState<boolean>(false);
  const [announceMessage, setAnnounceMessage] = useState<string>('');
  const [announceRecipientsTotal, setAnnounceRecipientsTotal] = useState<number>(0);
  const [announceRecipientsSent, setAnnounceRecipientsSent] = useState<number>(0);
  const [announceSending, setAnnounceSending] = useState<boolean>(false);
  const [announceCampusOptions, setAnnounceCampusOptions] = useState<string[]>([]);
  const [announceAmbassadors, setAnnounceAmbassadors] = useState<Array<{ id: string; email?: string; campus?: string }>>([]);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [uploadingProposal, setUploadingProposal] = useState(false);
  const [documentActionId, setDocumentActionId] = useState<string | null>(null);
  const [proposalMenuAnchor, setProposalMenuAnchor] = useState<HTMLElement | null>(null);
  const [proposalMenuDocId, setProposalMenuDocId] = useState<string | null>(null);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  const [documentPreviewTitle, setDocumentPreviewTitle] = useState('');
  const [openDocumentPreview, setOpenDocumentPreview] = useState(false);
  const [pendingSlotRemoval, setPendingSlotRemoval] = useState<{ slotId: string; studentId: string } | null>(null);
  const [removingFromSlot, setRemovingFromSlot] = useState(false);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [acceptDialogStudent, setAcceptDialogStudent] = useState<StudentInfo | null>(null);
  const [acceptDialogSelectedSlots, setAcceptDialogSelectedSlots] = useState<Set<string>>(new Set());
  const [acceptingApplication, setAcceptingApplication] = useState(false);
  const documentUploadInputRef = useRef<HTMLInputElement>(null);
  const proposalUploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setProposalNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Scroll to top avec animation slide-up au chargement de la page
  useEffect(() => {
    // Fonction pour trouver le conteneur scrollable (ContentWrapper du Layout)
    const findScrollableContainer = (): HTMLElement | null => {
      // Chercher le conteneur avec overflow auto/scroll
      const containers = document.querySelectorAll('[style*="overflow"]');
      for (const container of containers) {
        const style = window.getComputedStyle(container as HTMLElement);
        if (style.overflow === 'auto' || style.overflowY === 'auto' || style.overflow === 'scroll' || style.overflowY === 'scroll') {
          return container as HTMLElement;
        }
      }
      // Fallback sur window
      return null;
    };

    // Fonction pour scroller vers le haut avec animation
    const scrollToTop = (element: HTMLElement | Window) => {
      const isWindow = element === window;
      const startPosition = isWindow 
        ? (window.pageYOffset || document.documentElement.scrollTop || 0)
        : (element as HTMLElement).scrollTop || 0;
      
      // Si on est déjà en haut, ne rien faire
      if (startPosition === 0) return;
      
      const startTime = performance.now();
      const duration = 500; // 500ms pour l'animation

      const easeInOutCubic = (t: number): number => {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };

      const animateScroll = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeInOutCubic(progress);
        
        const currentPosition = startPosition * (1 - eased);
        
        if (isWindow) {
          window.scrollTo(0, currentPosition);
          if (document.body) document.body.scrollTop = currentPosition;
          if (document.documentElement) document.documentElement.scrollTop = currentPosition;
        } else {
          (element as HTMLElement).scrollTop = currentPosition;
        }
        
        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        } else {
          // S'assurer qu'on est bien à 0 à la fin
          if (isWindow) {
            window.scrollTo(0, 0);
            if (document.body) document.body.scrollTop = 0;
            if (document.documentElement) document.documentElement.scrollTop = 0;
          } else {
            (element as HTMLElement).scrollTop = 0;
          }
        }
      };

      requestAnimationFrame(animateScroll);
    };

    // Scroller immédiatement
    const scrollableContainer = findScrollableContainer();
    if (scrollableContainer) {
      scrollableContainer.scrollTop = 0;
    } else {
      window.scrollTo(0, 0);
      if (document.body) document.body.scrollTop = 0;
      if (document.documentElement) document.documentElement.scrollTop = 0;
    }
    
    // Attendre que le DOM soit prêt puis animer
    const timer1 = setTimeout(() => {
      const container = findScrollableContainer();
      if (container) {
        scrollToTop(container);
      } else {
        scrollToTop(window);
      }
    }, 100);
    
    // Double vérification après le chargement
    const timer2 = setTimeout(() => {
      const container = findScrollableContainer();
      const currentScroll = container 
        ? container.scrollTop 
        : (window.pageYOffset || document.documentElement.scrollTop || 0);
      
      if (currentScroll > 0) {
        if (container) {
          scrollToTop(container);
        } else {
          scrollToTop(window);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [eventId]);

  // Calculer les heures travaillées pour un jour (en heures)
  const calculateWorkingHours = (startTime: string, endTime: string, breaks: Array<{ start: string; end: string }> = []): number => {
    const start = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);
    
    let totalMinutes = (end.getTime() - start.getTime()) / 1000 / 60;
    
    // Soustraire les pauses
    breaks.forEach(breakTime => {
      const breakStart = new Date(`1970-01-01T${breakTime.start}`);
      const breakEnd = new Date(`1970-01-01T${breakTime.end}`);
      const breakMinutes = (breakEnd.getTime() - breakStart.getTime()) / 1000 / 60;
      totalMinutes -= breakMinutes;
    });
    
    return totalMinutes / 60; // Convertir en heures
  };

  const getTotalCapacity = (m: Mission) => m.studentCount || 0;
  const getTotalRegistered = (m: Mission) => 
    students.filter(s => s.status === 'Acceptée').length;

  const fetchData = useCallback(async () => {
    if (!eventId) {
      setError('Identifiant d’événement manquant.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const missionSnap = await getDoc(doc(db, 'missions', eventId));
      if (!missionSnap.exists()) {
        setError('Événement introuvable.');
        setMission(null);
        setLoading(false);
        return;
      }
      const missionData = { id: missionSnap.id, ...missionSnap.data() } as Mission;
      if (missionData.type !== 'ambassadeur_event') {
        setError('Cet événement n’est pas un salon ambassadeur.');
        setMission(null);
        setLoading(false);
        return;
      }
      setMission(missionData);

      // Vérifier si le salon a déjà été converti en mission
      // D'abord vérifier si convertedMissionId existe dans les données du salon
      const convertedId = (missionData as any).convertedMissionId;
      if (convertedId) {
        try {
          // Vérifier que la mission convertie existe toujours
          const convertedMissionDoc = await getDoc(doc(db, 'missions', convertedId));
          if (convertedMissionDoc.exists()) {
            setConvertedMissionId(convertedId);
          }
        } catch (error) {
          console.warn('Impossible de récupérer la mission convertie:', error);
        }
      } else {
        // Si pas de convertedMissionId, chercher une mission avec le même titre
        // Pour les contacts avec accès, filtrer par companyId
        const searchTitle = missionData.campaignName || missionData.title;
        if (searchTitle) {
          try {
            let convertedMissionsQuery: ReturnType<typeof query> | null = null;
            if (isContactWithAccess && userData?.companyId) {
              convertedMissionsQuery = query(
                collection(db, 'missions'),
                where('title', '==', searchTitle),
                where('companyId', '==', userData.companyId)
              );
            } else if (userData?.structureId) {
              convertedMissionsQuery = query(
                collection(db, 'missions'),
                where('title', '==', searchTitle),
                where('structureId', '==', userData.structureId)
              );
            } else if (userData?.status === 'superadmin') {
              convertedMissionsQuery = query(
                collection(db, 'missions'),
                where('title', '==', searchTitle)
              );
            }
            const convertedMissionsSnapshot = convertedMissionsQuery
              ? await getDocs(convertedMissionsQuery)
              : { docs: [] } as { docs: { id: string; data: () => any }[] };
            
            // Trouver une mission qui n'est pas un événement ambassadeur
            for (const convertedMissionDoc of convertedMissionsSnapshot.docs) {
              const convertedMissionData = convertedMissionDoc.data();
              if (convertedMissionDoc.id !== eventId && convertedMissionData.type !== 'ambassadeur_event') {
                setConvertedMissionId(convertedMissionDoc.id);
                // Sauvegarder le convertedMissionId dans le salon pour les prochaines fois (seulement pour les admins)
                if (userData?.status !== 'entreprise') {
                  try {
                    await updateDoc(doc(db, 'missions', eventId), {
                      convertedMissionId: convertedMissionDoc.id
                    });
                  } catch (error) {
                    console.warn('Impossible de sauvegarder le convertedMissionId:', error);
                  }
                }
                break;
              }
            }
          } catch (error) {
            console.warn('Impossible de rechercher les missions converties:', error);
          }
        }
      }

      const toDate = (v: unknown): Date => {
        if (v == null) return new Date();
        if (typeof (v as { toDate?: () => Date }).toDate === 'function') return (v as { toDate: () => Date }).toDate();
        return new Date(v as string | number);
      };

      // Récupérer les candidatures depuis la collection 'applications'
      const applicationsRef = collection(db, 'applications');
      const applicationsQuery = query(
        applicationsRef,
        where('missionId', '==', eventId)
      );
      const applicationsSnapshot = await getDocs(applicationsQuery);
      
      // Si aucune candidature n'est trouvée pour l'événement original, chercher dans les missions converties
      // On cherche les missions qui ont été converties depuis cet événement (même titre/campaignName)
      let allApplications = [...applicationsSnapshot.docs];
      
      if (applicationsSnapshot.docs.length === 0 && (missionData.campaignName || missionData.title)) {
        // Chercher les missions converties avec le même titre/campaignName
        // Pour les contacts avec accès, filtrer par companyId
        const searchTitle = missionData.campaignName || missionData.title;
        try {
          let convertedMissionsQueryForCandidatures: ReturnType<typeof query> | null = null;
          if (isContactWithAccess && userData?.companyId) {
            convertedMissionsQueryForCandidatures = query(
              collection(db, 'missions'),
              where('title', '==', searchTitle),
              where('companyId', '==', userData.companyId)
            );
          } else if (userData?.structureId) {
            convertedMissionsQueryForCandidatures = query(
              collection(db, 'missions'),
              where('title', '==', searchTitle),
              where('structureId', '==', userData.structureId)
            );
          } else if (userData?.status === 'superadmin') {
            convertedMissionsQueryForCandidatures = query(
              collection(db, 'missions'),
              where('title', '==', searchTitle)
            );
          }
          const convertedMissionsSnapshot = convertedMissionsQueryForCandidatures
            ? await getDocs(convertedMissionsQueryForCandidatures)
            : { docs: [] } as { docs: { id: string; data: () => any }[] };
        
        // Pour chaque mission convertie, récupérer les candidatures
        for (const convertedMissionDoc of convertedMissionsSnapshot.docs) {
          const convertedMissionId = convertedMissionDoc.id;
          const convertedMissionData = convertedMissionDoc.data();
          // Vérifier que ce n'est pas l'événement original lui-même
          if (convertedMissionId === eventId || convertedMissionData.type === 'ambassadeur_event') {
            continue;
          }
          
          const convertedApplicationsQuery = query(
            applicationsRef,
            where('missionId', '==', convertedMissionId)
          );
          const convertedApplicationsSnapshot = await getDocs(convertedApplicationsQuery);
          allApplications = [...allApplications, ...convertedApplicationsSnapshot.docs];
        }
          } catch (error) {
            console.warn('Impossible de rechercher les missions converties pour les candidatures:', error);
          }
      }
      
      const applicationsMap = new Map<string, any>();
      const userIds = new Set<string>();
      
      allApplications.forEach(docSnap => {
        const appData = docSnap.data();
        // Si plusieurs candidatures pour le même utilisateur, garder la plus récente
        const existing = applicationsMap.get(appData.userId);
        const appSubmittedAt = appData.submittedAt ? toDate(appData.submittedAt) : new Date();
        if (!existing || (existing.submittedAt && appSubmittedAt > existing.submittedAt)) {
          applicationsMap.set(appData.userId, {
            id: docSnap.id,
            status: appData.status || 'En attente',
            submittedAt: appSubmittedAt,
            motivationLetter: appData.motivationLetter,
            cvUrl: appData.cvUrl,
            isDossierValidated: appData.isDossierValidated || false,
            selectedSlotIds: Array.isArray(appData.selectedSlotIds) ? appData.selectedSlotIds : [],
            acceptedSlotIds: Array.isArray(appData.acceptedSlotIds) ? appData.acceptedSlotIds : [],
          });
        }
        userIds.add(appData.userId);
      });

      // Récupérer aussi le statut de validation du dossier depuis l'utilisateur (pour synchronisation)
      const usersValidationMap = new Map<string, boolean>();
      for (const uid of userIds) {
        try {
          const userSnap = await getDoc(doc(db, 'users', uid));
          const userData = userSnap.data();
          if (userData?.dossierValidated !== undefined) {
            usersValidationMap.set(uid, userData.dossierValidated);
          }
        } catch (error) {
          console.warn(`Impossible de récupérer les données de validation pour l'utilisateur ${uid}:`, error);
        }
      }

      // Construire la liste complète des étudiants à partir des candidatures
      const studentList: StudentInfo[] = [];
      for (const uid of userIds) {
        try {
          const userSnap = await getDoc(doc(db, 'users', uid));
          const d = userSnap.data();
          const application = applicationsMap.get(uid);
          
          // Prioriser la validation depuis l'utilisateur (HumanResources) si elle existe, sinon utiliser celle de l'application
          const userDossierValidated = usersValidationMap.get(uid);
          const dossierValidated = userDossierValidated !== undefined 
            ? userDossierValidated 
            : (application?.isDossierValidated || false);
          
          studentList.push({
            id: uid,
            email: d?.email,
            displayName: d?.displayName || [d?.firstName, d?.lastName].filter(Boolean).join(' ') || 'Inconnu',
            status: application?.status || 'En attente',
            submittedAt: application?.submittedAt,
            motivationLetter: application?.motivationLetter,
            cvUrl: application?.cvUrl,
            isFromApplication: true,
            applicationId: application?.id,
            isDossierValidated: dossierValidated,
            selectedSlotIds: application?.selectedSlotIds || [],
            acceptedSlotIds: application?.acceptedSlotIds || [],
          });
        } catch (error) {
          // Si on ne peut pas lire les données utilisateur, utiliser les données de l'application uniquement
          console.warn(`Impossible de récupérer les données utilisateur pour ${uid}, utilisation des données de l'application uniquement:`, error);
          const application = applicationsMap.get(uid);
          if (application) {
            studentList.push({
              id: uid,
              email: 'Email non disponible',
              displayName: 'Utilisateur inconnu',
              status: application?.status || 'En attente',
              submittedAt: application?.submittedAt,
              motivationLetter: application?.motivationLetter,
              cvUrl: application?.cvUrl,
              isFromApplication: true,
              applicationId: application?.id,
              isDossierValidated: application?.isDossierValidated || false,
              selectedSlotIds: application?.selectedSlotIds || [],
              acceptedSlotIds: application?.acceptedSlotIds || [],
            });
          }
        }
      }
      const decryptedStudents = await decryptUsersList(studentList);
      decryptedStudents.sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''));
      setStudents(decryptedStudents);

      const docsRef = collection(db, 'generatedDocuments');
      const structureIdForDocs = (missionData as any).structureId || userData?.structureId;
      let docsSnap;
      if (structureIdForDocs) {
        try {
          const q = query(
            docsRef,
            where('structureId', '==', structureIdForDocs),
            where('missionId', '==', eventId),
            orderBy('createdAt', 'desc')
          );
          docsSnap = await getDocs(q);
        } catch {
          const q = query(
            docsRef,
            where('structureId', '==', structureIdForDocs),
            where('missionId', '==', eventId)
          );
          docsSnap = await getDocs(q);
        }
      } else {
        // Sans structureId (ex. superadmin) : requête sans filtre structure
        if (userData?.status === 'superadmin') {
          try {
            const q = query(
              docsRef,
              where('missionId', '==', eventId),
              orderBy('createdAt', 'desc')
            );
            docsSnap = await getDocs(q);
          } catch {
            const q = query(docsRef, where('missionId', '==', eventId));
            docsSnap = await getDocs(q);
          }
        } else {
          docsSnap = { docs: [] } as { docs: { id: string; data: () => any }[] };
        }
      }
      const docs = docsSnap.docs.map((d) => mapGeneratedDocumentToEventDocument(d));
      setDocuments(docs);
    } catch (e) {
      console.error('Erreur chargement détail événement ambassadeur:', e);
      setError('Impossible de charger l’événement.');
      setMission(null);
      setStudents([]);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData, isContactWithAccess, userData?.companyId]);

  useEffect(() => {
    if (!eventId || loading) return;

    const structureIdForDocs = (mission as { structureId?: string } | null)?.structureId || userData?.structureId;
    if (!structureIdForDocs && userData?.status !== 'superadmin') return;

    const docsRef = collection(db, 'generatedDocuments');
    const docsQuery = structureIdForDocs
      ? query(
          docsRef,
          where('structureId', '==', structureIdForDocs),
          where('missionId', '==', eventId)
        )
      : query(docsRef, where('missionId', '==', eventId));

    const unsubscribe = onSnapshot(
      docsQuery,
      (docsSnap) => {
        setDocuments(docsSnap.docs.map((d) => mapGeneratedDocumentToEventDocument(d)));
      },
      (err) => {
        console.error('Erreur écoute documents événement ambassadeur:', err);
      }
    );

    return unsubscribe;
  }, [eventId, loading, mission, userData?.structureId, userData?.status]);

  const totalCapacity = mission ? getTotalCapacity(mission) : 0;
  const totalRegistered = mission ? getTotalRegistered(mission) : 0;
  const totalPending = students.filter(s => s.status === 'En attente').length;
  const acceptedRate = totalCapacity > 0 ? (totalRegistered / totalCapacity) * 100 : 0;
  const pendingRate = totalCapacity > 0 ? (totalPending / totalCapacity) * 100 : 0;
  const fillRate = Math.round(acceptedRate);
  const totalPlannedHours = getTotalPlannedHours(mission);

  const formatEventDates = (m: Mission): string => {
    try {
      const start = m.startDate ? toMissionDate(m.startDate) : null;
      const end = m.endDate ? toMissionDate(m.endDate) : null;
      if (start && end) {
        return `${format(start, "EEEE d MMMM yyyy", { locale: fr })} – ${format(end, 'd MMM yyyy', { locale: fr })}`;
      }
      if (start) return format(start, "EEEE d MMMM yyyy", { locale: fr });
      return '';
    } catch {
      return '';
    }
  };

  const handleSendProposalRequest = async () => {
    if (!mission) return;
    setProposalError(null);

    const lastProposalAt = toOptionalDate((mission as any).lastCommercialProposalRequestedAt);
    const cooldownRemaining = getProposalCooldownRemainingMs(lastProposalAt);
    if (cooldownRemaining > 0) {
      setProposalError(
        `Une demande a déjà été envoyée récemment. Prochaine demande possible dans ${formatProposalCooldownRemaining(cooldownRemaining)}.`
      );
      return;
    }

    setProposalSending(true);
    try {
      const structureId = (mission as any).structureId as string | undefined;
      if (!structureId) throw new Error('Structure introuvable sur cet événement.');

      const structureSnap = await getDoc(doc(db, 'structures', structureId));
      const structureEmail = (structureSnap.exists() ? (structureSnap.data() as any)?.email : '') as string;
      const toEmail = (structureEmail || '').trim();
      if (!toEmail || !toEmail.includes('@')) {
        throw new Error("Email structure non renseigné (Paramètres > Structure).");
      }

      const companyName = await resolveAmbassadorEventCompanyName(mission, userData ?? undefined);
      const eventTitle = (mission.title || (mission as any).campaignName || 'Salon ambassadeur').toString();
      const eventLocation = (mission.location || '').toString();
      const eventDates = formatEventDates(mission);
      const requestedByName = (userData?.displayName || userData?.email || 'Utilisateur').toString();

      const baseUrl =
        ((import.meta.env.VITE_APP_URL as string | undefined)?.trim() ||
          (typeof window !== 'undefined' ? window.location.origin : '') ||
          'https://js-connect.fr').replace(/\/$/, '');
      const eventLink = `${baseUrl}/app/ambassadeur-event/${mission.id}`;

      const res = await sendStructureProposalRequestEmail({
        to_email: toEmail,
        subject: `Demande de proposition commerciale – ${eventTitle}`,
        company_name: companyName,
        event_title: eventTitle,
        event_location: eventLocation,
        event_dates: eventDates,
        event_link: eventLink,
        requested_by_name: requestedByName,
      });

      if (!res.ok) throw new Error(res.error || 'Email non envoyé.');

      const requestedAt = new Date();
      await updateDoc(doc(db, 'missions', mission.id), {
        lastCommercialProposalRequestedAt: requestedAt,
        lastCommercialProposalRequestedBy: userData?.id || null,
        updatedAt: requestedAt,
      });
      setMission((prev) =>
        prev
          ? ({
              ...prev,
              lastCommercialProposalRequestedAt: requestedAt,
              lastCommercialProposalRequestedBy: userData?.id || null,
            } as Mission)
          : prev
      );
      setProposalNow(Date.now());

      // best-effort log
      void logEmailSend({
        type: 'proposal_request',
        eventId: mission.id,
        structureId,
        recipientsCount: 1,
        sentAt: new Date(),
        sentByUserId: userData?.id,
        status: 'success',
        errorSummary: null,
      });
    } catch (e: any) {
      setProposalError(e?.message || 'Impossible d’envoyer la demande.');
      const structureId = (mission as any).structureId as string | undefined;
      void logEmailSend({
        type: 'proposal_request',
        eventId: mission.id,
        structureId,
        recipientsCount: 1,
        sentAt: new Date(),
        sentByUserId: userData?.id,
        status: 'failure',
        errorSummary: e?.message || 'Erreur',
      });
    } finally {
      setProposalSending(false);
    }
  };

  const getBaseUrl = (): string =>
    ((import.meta.env.VITE_APP_URL as string | undefined)?.trim() ||
      (typeof window !== 'undefined' ? window.location.origin : '') ||
      'https://js-connect.fr').replace(/\/$/, '');

  const toLocalInputValue = (d: Date): string => {
    // yyyy-MM-ddTHH:mm pour <input type="datetime-local" />
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openAnnouncementDialog = async () => {
    if (!mission) return;
    setAnnounceDialogOpen(true);
    setAnnounceError(null);
    setAnnounceSuccess(null);
    setAnnounceRecipientsSent(0);
    setAnnounceRecipientsTotal(0);
    setAnnounceSending(false);

    // Initialiser dates par défaut depuis mission
    try {
      if (!announceStart) {
        const start = mission.startDate ? toMissionDate(mission.startDate) : null;
        if (start && !isNaN(start.getTime())) setAnnounceStart(toLocalInputValue(start));
      }
      if (!announceEnd) {
        const end = mission.endDate ? toMissionDate(mission.endDate) : null;
        if (end && !isNaN(end.getTime())) setAnnounceEnd(toLocalInputValue(end));
      }
    } catch {
      // ignore
    }

    setAnnounceLoading(true);
    try {
      const structureId = (mission as any).structureId as string | undefined;
      if (!structureId) throw new Error('Structure introuvable sur cet événement.');

      const ambassadors = await getAmbassadorUsers(structureId);
      const minimal = (ambassadors || []).map((a: any) => ({
        id: a.id,
        email: a.email,
        campus: a.campus,
      }));
      setAnnounceAmbassadors(minimal);

      const campuses = Array.from(
        new Set(
          minimal
            .map((a) => (a.campus || '').toString().trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b));
      setAnnounceCampusOptions(campuses);
      setAnnounceCampus('__ALL__');
    } catch (e: any) {
      setAnnounceError(e?.message || 'Impossible de charger la liste des ambassadeurs.');
    } finally {
      setAnnounceLoading(false);
    }
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const handleSendAnnouncement = async () => {
    if (!mission) return;
    setAnnounceError(null);
    setAnnounceSuccess(null);
    setAnnounceSending(true);
    setAnnounceRecipientsSent(0);

    try {
      const startLabel = announceStart ? format(new Date(announceStart), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr }) : '';
      const endLabel = announceEnd ? format(new Date(announceEnd), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr }) : '';

      const target = announceAmbassadors
        .filter((a) => {
          const email = (a.email || '').trim();
          if (!email || !email.includes('@')) return false;
          if (announceCampus === '__ALL__') return true;
          return ((a.campus || '').toString().trim() || '') === announceCampus;
        })
        .map((a) => ({ ...a, email: (a.email || '').trim().toLowerCase() }));

      if (target.length === 0) {
        throw new Error("Aucun ambassadeur destinataire (vérifiez le filtre campus et les emails).");
      }

      setAnnounceRecipientsTotal(target.length);

      const companyName = await resolveAmbassadorEventCompanyName(mission, userData ?? undefined);
      const structureName = ((userData as any)?.structureName || (mission as any).structureName || '').toString();
      const eventTitle = (mission.title || (mission as any).campaignName || 'Salon ambassadeur').toString();
      const eventLocation = (mission.location || '').toString();
      const ctaUrl = `${getBaseUrl()}/app/ambassadeur-event/${mission.id}`;

      const customMessage = announceUseCustom ? (announceMessage || '').trim() : '';
      const subject = `Nouveau salon ambassadeur – ${eventTitle}`;

      let sent = 0;
      for (const r of target) {
        const res = await sendAmbassadorEventAnnouncementEmail({
          to_email: r.email!,
          subject,
          event_title: eventTitle,
          event_location: eventLocation,
          event_start: startLabel,
          event_end: endLabel,
          cta_url: ctaUrl,
          custom_message: customMessage,
          company_name: companyName,
          structure_name: structureName,
        });

        if (!res.ok) {
          throw new Error(res.error || 'Email non envoyé.');
        }

        sent += 1;
        setAnnounceRecipientsSent(sent);
        // Throttle léger pour éviter de spammer EmailJS trop vite
        await sleep(220);
      }

      setAnnounceSuccess(`Emails envoyés : ${sent}/${target.length}`);
      const structureId = (mission as any).structureId as string | undefined;
      void logEmailSend({
        type: 'ambassador_announcement',
        eventId: mission.id,
        structureId,
        campusFilter: announceCampus === '__ALL__' ? null : announceCampus,
        recipientsCount: target.length,
        sentAt: new Date(),
        sentByUserId: userData?.id,
        status: 'success',
        errorSummary: null,
      });
    } catch (e: any) {
      setAnnounceError(e?.message || 'Erreur lors de l’envoi des emails.');
      const structureId = (mission as any).structureId as string | undefined;
      void logEmailSend({
        type: 'ambassador_announcement',
        eventId: mission.id,
        structureId,
        campusFilter: announceCampus === '__ALL__' ? null : announceCampus,
        recipientsCount: announceRecipientsTotal || 0,
        sentAt: new Date(),
        sentByUserId: userData?.id,
        status: 'failure',
        errorSummary: e?.message || 'Erreur',
      });
    } finally {
      setAnnounceSending(false);
    }
  };

  // Vérifier si l'utilisateur peut modifier l'événement
  const isStructureAdmin = ['admin', 'admin_structure', 'membre', 'superadmin'].includes(userData?.status || '');
  const canEditAsContact = isContactWithAccess && (
    contactPermissions?.canViewEvents || 
    contactPermissions?.canManageAmbassadors
  ) && mission?.companyId === userData?.companyId;
  const canEdit = !!userData?.companyName || isStructureAdmin || canEditAsContact;

  // Vue structure (administration) vs vue entreprise (demande de proposition, lecture seule)
  const isStructureView = isStructureAdmin;
  
  // Droits d'action (accepter/refuser, assigner créneaux, retirer) — réservés à la structure
  const canManageAmbassadors = isStructureAdmin;

  // Invitation d'ambassadeurs — structure ou contact entreprise avec canManageAmbassadors
  const canAddAmbassadors =
    isStructureAdmin ||
    (isContactWithAccess &&
      contactPermissions?.canManageAmbassadors &&
      mission?.companyId === userData?.companyId);

  const handleEditSuccess = () => {
    setIsEditing(false);
    fetchData(); // Recharger les données
  };

  // Charger les ambassadeurs disponibles (prénoms/noms déchiffrés)
  const loadAvailableAmbassadors = async () => {
    try {
      const structureId = userData?.structureId;
      const ambassadors = await getAmbassadorUsers(structureId);
      const ambassadorsDecrypted = await decryptUsersList(
        ambassadors as Array<{ id: string; displayName?: string; firstName?: string; lastName?: string }>
      );
      // Filtrer les ambassadeurs déjà inscrits
      const registeredIds = new Set(students.map(s => s.id));
      const available = ambassadorsDecrypted.filter(a => !registeredIds.has(a.id));
      setAvailableAmbassadors(available);
    } catch (error) {
      console.error('Erreur lors du chargement des ambassadeurs:', error);
      setAvailableAmbassadors([]);
    }
  };

  // Ajouter manuellement des ambassadeurs à un slot
  const handleAddAmbassadors = async () => {
    if (!mission || selectedAmbassadors.size === 0 || !selectedSlotId) {
      alert('Veuillez sélectionner au moins un ambassadeur et un créneau');
      return;
    }

    try {
      setAddingAmbassadors(true);
      const slot = mission.slots?.find(s => s.id === selectedSlotId);
      if (!slot) {
        alert('Créneau introuvable');
        return;
      }

      // Vérifier la capacité disponible
      const availableCapacity = slot.capacity - (slot.assignedStudentIds?.length || 0);
      if (selectedAmbassadors.size > availableCapacity) {
        alert(`Ce créneau ne peut accepter que ${availableCapacity} ambassadeur(s) supplémentaire(s)`);
        return;
      }

      // Mettre à jour les slots avec les nouveaux ambassadeurs
      const updatedSlots = mission.slots?.map(s => {
        if (s.id === selectedSlotId) {
          const currentIds = s.assignedStudentIds || [];
          const newIds = Array.from(selectedAmbassadors);
          return {
            ...s,
            assignedStudentIds: [...currentIds, ...newIds]
          };
        }
        return s;
      });

      // Mettre à jour la mission dans Firestore
      const missionRef = doc(db, 'missions', mission.id);
      try {
        await updateDoc(missionRef, {
          slots: updatedSlots,
          updatedAt: new Date()
        });
      } catch (updateError) {
        console.error('[handleAddAmbassadors] Erreur lors de la mise à jour de la mission:', updateError);
        throw new Error('Impossible de mettre à jour la mission: ' + (updateError as Error).message);
      }

      // Créer des candidatures pour chaque ambassadeur ajouté
      for (const ambassadorId of selectedAmbassadors) {
        const ambassador = availableAmbassadors.find(a => a.id === ambassadorId);
        if (ambassador) {
          // Vérifier si une candidature existe déjà
          const existingAppQuery = query(
            collection(db, 'applications'),
            where('missionId', '==', mission.id),
            where('userId', '==', ambassadorId)
          );
          const existingAppSnapshot = await getDocs(existingAppQuery);
          
          if (existingAppSnapshot.empty) {
            // Créer une nouvelle candidature
            try {
              await addDoc(collection(db, 'applications'), {
                missionId: mission.id,
                userId: ambassadorId,
                userEmail: ambassador.email || null,
                cvUrl: null,
                cvUpdatedAt: null,
                motivationLetter: 'Ajouté manuellement',
                submittedAt: new Date().toISOString(),
                status: 'Acceptée',
                selectedSlotIds: [selectedSlotId],
                acceptedSlotIds: [selectedSlotId],
                isFromManualAdd: true
              });
            } catch (createError) {
              console.error(`[handleAddAmbassadors] Erreur lors de la création de la candidature pour ${ambassadorId}:`, createError);
              throw new Error('Impossible de créer la candidature: ' + (createError as Error).message);
            }
          } else {
            // Mettre à jour la candidature existante
            const existingApp = existingAppSnapshot.docs[0];
            try {
              const existingData = existingApp.data();
              const prevAccepted = Array.isArray(existingData.acceptedSlotIds) ? existingData.acceptedSlotIds : [];
              const prevSelected = Array.isArray(existingData.selectedSlotIds) ? existingData.selectedSlotIds : [];
              await updateDoc(doc(db, 'applications', existingApp.id), {
                status: 'Acceptée',
                acceptedSlotIds: Array.from(new Set([...prevAccepted, selectedSlotId])),
                selectedSlotIds: Array.from(new Set([...prevSelected, selectedSlotId])),
                isFromManualAdd: true
              });
            } catch (updateError) {
              console.error(`[handleAddAmbassadors] Erreur lors de la mise à jour de la candidature pour ${ambassadorId}:`, updateError);
              throw new Error('Impossible de mettre à jour la candidature: ' + (updateError as Error).message);
            }
          }
        }
      }

      // Recharger les données
      await fetchData();
      setAddAmbassadorDialogOpen(false);
      setSelectedAmbassadors(new Set());
      setSelectedSlotId('');
    } catch (error) {
      console.error('Erreur lors de l\'ajout des ambassadeurs:', error);
      alert('Erreur lors de l\'ajout des ambassadeurs');
    } finally {
      setAddingAmbassadors(false);
    }
  };

  // Générer le prochain numéro de mission
  const generateNextMissionNumber = async (structureId: string): Promise<string> => {
    try {
      // Obtenir la date actuelle
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1; // getMonth() retourne 0-11, donc on ajoute 1
      
      // Format: YY (2 derniers chiffres de l'année)
      const yearStr = year.toString().slice(-2);
      // Format: MM (mois avec 2 chiffres)
      const monthStr = month.toString().padStart(2, '0');
      
      // Récupérer toutes les missions de la structure
      const missionsRef = collection(db, 'missions');
      const missionsQuery = query(
        missionsRef,
        where('structureId', '==', structureId)
      );
      const missionsSnapshot = await getDocs(missionsQuery);
      
      // Filtrer les missions du mois en cours qui suivent le format YYMMNN
      const currentMonthPrefix = `${yearStr}${monthStr}`;
      const currentMonthMissions = missionsSnapshot.docs
        .map(doc => doc.data().numeroMission as string)
        .filter(numero => {
          // Vérifier si le numéro commence par le préfixe du mois en cours
          return numero && numero.length === 6 && numero.startsWith(currentMonthPrefix);
        });
      
      // Extraire les numéros séquentiels (les 2 derniers chiffres)
      const missionNumbers = currentMonthMissions
        .map(numero => {
          const sequenceNumber = parseInt(numero.slice(-2), 10);
          return isNaN(sequenceNumber) ? 0 : sequenceNumber;
        })
        .filter(num => num > 0)
        .sort((a, b) => b - a); // Trier par ordre décroissant
      
      // Le prochain numéro séquentiel est le maximum + 1, ou 1 si aucune mission
      const nextSequenceNumber = missionNumbers.length > 0 
        ? missionNumbers[0] + 1 
        : 1;
      
      // Formater le numéro séquentiel avec 2 chiffres
      const sequenceStr = nextSequenceNumber.toString().padStart(2, '0');
      
      // Générer le numéro final: YYMMNN
      const nextMissionNumber = `${yearStr}${monthStr}${sequenceStr}`;
      return nextMissionNumber;
    } catch (error) {
      console.error('Erreur lors de la génération du numéro de mission:', error);
      // En cas d'erreur, retourner un numéro par défaut basé sur la date
      const now = new Date();
      const yearStr = now.getFullYear().toString().slice(-2);
      const monthStr = (now.getMonth() + 1).toString().padStart(2, '0');
      return `${yearStr}${monthStr}01`;
    }
  };

  // Charger les utilisateurs disponibles pour le chargé de mission et générer le numéro de mission
  useEffect(() => {
    const loadChargesAndGenerateNumber = async () => {
      try {
        // TOUJOURS définir l'utilisateur actuel par défaut en premier
        if (userData?.id) {
          setSelectedChargeId(userData.id);
        }

        // Filtrer par structure si disponible, sinon récupérer tous les admins
        let usersQuery;
        if (userData?.structureId) {
          usersQuery = query(
            collection(db, 'users'),
            where('structureId', '==', userData.structureId),
            where('status', 'in', ['admin', 'admin_structure', 'membre', 'superadmin'])
          );
        } else {
          usersQuery = query(
            collection(db, 'users'),
            where('status', 'in', ['admin', 'admin_structure', 'membre', 'superadmin'])
          );
        }
        
        const usersSnapshot = await getDocs(usersQuery);
        
        const chargesRaw = usersSnapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            displayName: data.displayName || [data.firstName, data.lastName].filter(Boolean).join(' ') || data.email || 'Inconnu',
            firstName: data.firstName,
            lastName: data.lastName,
            photoURL: data.photoURL
          };
        });
        
        // Créer l'entrée pour l'utilisateur actuel
        const currentUserCharge = {
          id: userData?.id || '',
          displayName: userData?.displayName || [userData?.firstName, userData?.lastName].filter(Boolean).join(' ') || userData?.email || 'Moi',
          firstName: userData?.firstName,
          lastName: userData?.lastName,
          photoURL: userData?.photoURL
        };

        // Vérifier si l'utilisateur actuel est déjà dans la liste
        const currentUserInList = chargesRaw.find(c => c.id === userData?.id);
        
        // Construire la liste finale : utilisateur actuel en premier, puis les autres
        let finalChargesList: Array<{ id: string; displayName: string; firstName?: string; lastName?: string; photoURL?: string }>;
        if (userData?.id && !currentUserInList) {
          finalChargesList = [currentUserCharge, ...chargesRaw];
        } else if (userData?.id && currentUserInList) {
          const otherCharges = chargesRaw.filter(c => c.id !== userData.id);
          finalChargesList = [currentUserCharge, ...otherCharges];
        } else {
          finalChargesList = chargesRaw;
        }
        
        // Décrypter les prénoms/noms des chargés de mission
        const finalChargesDecrypted = await decryptUsersList(finalChargesList);
        setAvailableCharges(finalChargesDecrypted);
        
        // S'assurer que l'utilisateur actuel est toujours sélectionné
        if (userData?.id) {
          setSelectedChargeId(userData.id);
        } else if (finalChargesList.length > 0) {
          setSelectedChargeId(finalChargesList[0].id);
        }

        // Générer le numéro de mission suggéré
        if (userData?.structureId) {
          const suggestedNumber = await generateNextMissionNumber(userData.structureId);
          setMissionNumber(suggestedNumber);
        } else {
          // Si pas de structureId, générer un numéro basé sur la date actuelle
          const now = new Date();
          const yearStr = now.getFullYear().toString().slice(-2);
          const monthStr = (now.getMonth() + 1).toString().padStart(2, '0');
          setMissionNumber(`${yearStr}${monthStr}01`);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des chargés de mission:', error);
        // En cas d'erreur, s'assurer que l'utilisateur actuel est quand même sélectionné
        if (userData?.id) {
          setSelectedChargeId(userData.id);
          const fallback = [{
            id: userData.id,
            displayName: userData.displayName || [userData.firstName, userData.lastName].filter(Boolean).join(' ') || userData.email || 'Moi',
            firstName: userData.firstName,
            lastName: userData.lastName,
            photoURL: userData.photoURL
          }];
          const decrypted = await decryptUsersList(fallback);
          setAvailableCharges(decrypted);
        }
      }
    };

    if (convertDialogOpen && userData) {
      loadChargesAndGenerateNumber();
    }
  }, [convertDialogOpen, userData]);

  // Calculer le total d'heures pour la mission
  const calculateTotalHours = (): number => {
    if (!mission?.slots || mission.slots.length === 0) return 0;
    
    return mission.slots.reduce((total, slot) => {
      const toDate = (v: unknown): Date => {
        if (v == null) return new Date();
        if (typeof (v as { toDate?: () => Date }).toDate === 'function') return (v as { toDate: () => Date }).toDate();
        return new Date(v as string | number);
      };
      
      const startDate = slot.startTime instanceof Date ? slot.startTime : toDate(slot.startTime);
      const endDate = slot.endTime instanceof Date ? slot.endTime : toDate(slot.endTime);
      const breaks = (slot as any).breaks || [];
      
      const startTime = startDate.toTimeString().slice(0, 5);
      const endTime = endDate.toTimeString().slice(0, 5);
      
      return total + calculateWorkingHours(startTime, endTime, breaks);
    }, 0);
  };

  // Vérifier si un numéro de mission existe déjà
  const checkMissionNumberExists = async (numeroMission: string): Promise<boolean> => {
    const missionsQuery = query(
      collection(db, 'missions'),
      where('numeroMission', '==', numeroMission)
    );
    const snapshot = await getDocs(missionsQuery);
    return !snapshot.empty;
  };

  const handleConvertToMission = async () => {
    if (!mission || !missionNumber.trim() || !selectedChargeId) {
      alert('Veuillez remplir le numéro de mission et sélectionner un chargé de mission.');
      return;
    }

    // Vérifier si le numéro de mission existe déjà
    const exists = await checkMissionNumberExists(missionNumber.trim());
    if (exists) {
      alert('Ce numéro de mission existe déjà. Veuillez en choisir un autre.');
      return;
    }

    setIsConverting(true);
    try {
      // Récupérer les informations du chargé de mission
      const chargeDoc = await getDoc(doc(db, 'users', selectedChargeId));
      if (!chargeDoc.exists()) {
        alert('Chargé de mission introuvable.');
        setIsConverting(false);
        return;
      }

      const chargeData = chargeDoc.data();
      const chargeName = getSafeDisplayName(chargeData);
      const chargePhotoURL = chargeData.photoURL || null;
      const chargeMandat = chargeData.mandat || undefined;

      // Récupérer les candidatures (Acceptées et En attente)
      const applicationsQuery = query(
        collection(db, 'applications'),
        where('missionId', '==', mission.id),
        where('status', 'in', ['Acceptée', 'En attente'])
      );
      const applicationsSnapshot = await getDocs(applicationsQuery);
      
      const acceptedApps = applicationsSnapshot.docs.filter(doc => doc.data().status === 'Acceptée');
      const acceptedStudentIds = acceptedApps.map(doc => doc.data().userId);

      // Récupérer les noms des étudiants acceptés
      const studentNames = new Map<string, string>();
      for (const userId of acceptedStudentIds) {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const displayName = userData.displayName || [userData.firstName, userData.lastName].filter(Boolean).join(' ') || userData.email || 'Inconnu';
            studentNames.set(userId, displayName);
          }
        } catch (error) {
          console.warn(`Impossible de récupérer le nom de l'utilisateur ${userId}:`, error);
        }
      }

      // Calculer les dates min et max depuis les slots
      const allDates: Date[] = [];
      if (mission.slots && mission.slots.length > 0) {
        mission.slots.forEach(slot => {
          const toDate = (v: unknown): Date => {
            if (v == null) return new Date();
            if (typeof (v as { toDate?: () => Date }).toDate === 'function') return (v as { toDate: () => Date }).toDate();
            return new Date(v as string | number);
          };
          
          const startDate = slot.startTime instanceof Date ? slot.startTime : toDate(slot.startTime);
          const endDate = slot.endTime instanceof Date ? slot.endTime : toDate(slot.endTime);
          
          if (startDate && !isNaN(startDate.getTime())) allDates.push(startDate);
          if (endDate && !isNaN(endDate.getTime())) allDates.push(endDate);
        });
      }

      const sortedDates = allDates.sort((a, b) => a.getTime() - b.getTime());
      const startDate = sortedDates[0] || new Date(mission.startDate);
      const endDate = sortedDates[sortedDates.length - 1] || new Date(mission.endDate);

      // Calculer le total d'heures
      const totalHours = calculateTotalHours();

      // Calculer hoursPerStudent (heures totales / nombre d'étudiants)
      const hoursPerStudent = acceptedStudentIds.length > 0 
        ? (totalHours / acceptedStudentIds.length).toFixed(2)
        : totalHours.toFixed(2);

      // Récupérer l'entreprise sauvegardée depuis ambassadorSettings / mission
      let selectedCompanyId = '';
      let selectedCompanyName = '';
      let defaultContactId = '';
      
      if (userData?.structureId) {
        try {
          const settingsRef = doc(db, 'ambassadorSettings', userData.structureId);
          const settingsDoc = await getDoc(settingsRef);
          if (settingsDoc.exists()) {
            const settings = settingsDoc.data();
            selectedCompanyId = settings.companyId || '';
            
            if (selectedCompanyId) {
              // Récupérer les informations de l'entreprise
              const companyDoc = await getDoc(doc(db, 'companies', selectedCompanyId));
              if (companyDoc.exists()) {
                const companyData = companyDoc.data();
                selectedCompanyName = companyData.name || '';
                
                // Récupérer le contact par défaut
                const contactsQuery = query(
                  collection(db, 'contacts'),
                  where('companyId', '==', selectedCompanyId),
                  where('isDefault', '==', true)
                );
                const contactsSnapshot = await getDocs(contactsQuery);
                if (!contactsSnapshot.empty) {
                  defaultContactId = contactsSnapshot.docs[0].id;
                } else {
                  // Si aucun contact par défaut, prendre le premier contact
                  const allContactsQuery = query(
                    collection(db, 'contacts'),
                    where('companyId', '==', selectedCompanyId)
                  );
                  const allContactsSnapshot = await getDocs(allContactsQuery);
                  if (!allContactsSnapshot.empty) {
                    defaultContactId = allContactsSnapshot.docs[0].id;
                  }
                }
              }
            }
          }
        } catch (error) {
          console.warn('Erreur lors de la récupération de l\'entreprise sauvegardée:', error);
        }
      }

      const resolvedCompanyId = selectedCompanyId || mission.companyId || '';
      const resolvedCompanyName = await resolveAmbassadorEventCompanyName(
        {
          company: selectedCompanyName || mission.company,
          companyId: resolvedCompanyId,
          structureId: mission.structureId || userData?.structureId,
        },
        userData ?? undefined
      );

      // Créer la mission standard
      const missionData = {
        numeroMission: missionNumber.trim(),
        company: resolvedCompanyName,
        companyId: resolvedCompanyId,
        contactId: defaultContactId ? defaultContactId : null,
        location: mission.location || '',
        locationCoordinates: (mission.locationCoordinates && typeof mission.locationCoordinates.lat === 'number' && typeof mission.locationCoordinates.lng === 'number') 
          ? { lat: mission.locationCoordinates.lat, lng: mission.locationCoordinates.lng } 
          : null,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        studentCount: mission.studentCount || acceptedStudentIds.length,
        hours: Math.round(totalHours),
        hoursPerStudent: hoursPerStudent,
        status: 'En attente',
        structureId: mission.structureId || userData?.structureId || '',
        chargeId: selectedChargeId,
        chargeName: chargeName,
        chargePhotoURL: chargePhotoURL || null,
        description: mission.description || `Mission convertie depuis le salon: ${mission.title || mission.campaignName}`,
        title: mission.title || mission.campaignName || 'Mission',
        salary: '0', // Sera défini plus tard
        priceHT: 0, // Sera calculé plus tard
        requiresCV: true, // Par défaut, les missions requièrent un CV
        requiresMotivation: true, // Par défaut, les missions requièrent une lettre de motivation
        isPublished: false, // Non publiée par défaut
        isPublic: true,
        etape: 'Recrutement' as const, // Les candidatures sont déjà acceptées, on passe directement au recrutement
        isArchived: false,
        mandat: chargeMandat || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userData?.id || '',
        assignees: acceptedStudentIds.map(userId => ({
          id: userId,
          name: studentNames.get(userId) || 'Inconnu',
          avatar: null
        })),
        // Conserver les horaires détaillés dans les slots (sans les étudiants assignés)
        slots: mission.slots?.map(slot => ({
          ...slot,
          assignedStudentIds: [] // Réinitialiser pour la nouvelle mission
        }))
      };

      // Créer la mission directement avec addDoc pour avoir tous les champs
      const missionDocRef = await addDoc(collection(db, 'missions'), missionData);
      const newMissionId = missionDocRef.id;

      // Marquer le salon comme converti en ajoutant le convertedMissionId
      const eventRef = doc(db, 'missions', mission.id);
      await updateDoc(eventRef, {
        convertedMissionId: newMissionId,
        updatedAt: new Date()
      });

      // Créer de nouvelles candidatures pour la nouvelle mission (copies des candidatures acceptées et en attente)
      // Ne pas modifier les candidatures originales pour qu'elles restent liées à l'événement ambassadeur
      for (const appDoc of applicationsSnapshot.docs) {
        const appData = appDoc.data();
        if (appData.status === 'Acceptée' || appData.status === 'En attente') {
          // Créer une nouvelle candidature pour la nouvelle mission
          await addDoc(collection(db, 'applications'), {
            missionId: newMissionId,
            userId: appData.userId,
            userEmail: appData.userEmail || null,
            userDisplayName: appData.userDisplayName || null,
            userPhotoURL: appData.userPhotoURL || null,
            cvUrl: appData.cvUrl || null,
            cvUpdatedAt: appData.cvUpdatedAt || null,
            motivationLetter: appData.motivationLetter || null,
            status: appData.status, // Conserver le statut (Acceptée ou En attente)
            submittedAt: appData.submittedAt || new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            isDossierValidated: appData.isDossierValidated || false,
          });
        }
      }

      // Fermer le dialog et naviguer vers la nouvelle mission
      setConvertDialogOpen(false);
      navigate(`/app/mission/${newMissionId}`);
    } catch (error) {
      console.error('Erreur lors de la conversion en mission:', error);
      alert('Erreur lors de la conversion en mission. Veuillez réessayer.');
    } finally {
      setIsConverting(false);
    }
  };

  const getAllMissionSlots = () => {
    if (!mission?.slots?.length) {
      return [] as Array<{ slotId: string; slot: NonNullable<Mission['slots']>[number]; label: string }>;
    }
    return mission.slots.map((slot, index) => ({
      slotId: resolveSlotId(slot, index),
      slot,
      label: formatSlotLabel(slot),
    }));
  };

  const getApplicableSlotsForStudent = (student: StudentInfo) => {
    const allSlots = getAllMissionSlots();
    if (!allSlots.length) return allSlots;

    const candidateRawIds = [
      ...(student.selectedSlotIds || []),
      ...(student.acceptedSlotIds || []),
      ...getAssignedSlotIdsForStudent(mission?.slots, student.id),
    ];

    const matched = allSlots.filter(({ slotId }) =>
      candidateRawIds.some((rawId) => slotIdsMatch(rawId, slotId, mission?.slots)),
    );

    return matched.length > 0 ? matched : allSlots;
  };

  const getCurrentAcceptedSlotIds = (student: StudentInfo) => {
    const fromApplication = student.acceptedSlotIds || [];
    const fromAssignment = getAssignedSlotIdsForStudent(mission?.slots, student.id);
    const combined = [...fromApplication, ...fromAssignment];
    const unique: string[] = [];
    combined.forEach((rawId) => {
      const match = getAllMissionSlots().find(({ slotId }) => slotIdsMatch(rawId, slotId, mission?.slots));
      if (match && !unique.includes(match.slotId)) unique.push(match.slotId);
    });
    return unique;
  };

  const acceptStudentOnSlots = async (student: StudentInfo, slotIdsToAccept: string[]) => {
    if (!mission || !student.applicationId) {
      alert('Impossible d\'accepter cette candidature.');
      return;
    }
    if (slotIdsToAccept.length === 0) {
      alert('Sélectionnez au moins un créneau.');
      return;
    }

    setAcceptingApplication(true);
    try {
      const allMissionSlotIds = getAllMissionSlots().map(({ slotId }) => slotId);
      const slotsToAccept = slotIdsToAccept.filter((slotId) => allMissionSlotIds.includes(slotId));
      if (slotsToAccept.length === 0) {
        alert('Créneaux sélectionnés invalides.');
        return;
      }

      const studentSlotScope = new Set<string>([
        ...(student.selectedSlotIds || []),
        ...(student.acceptedSlotIds || []),
        ...getAssignedSlotIdsForStudent(mission.slots, student.id),
        ...slotsToAccept,
      ]);

      const updatedSlots = mission.slots?.map((slot, slotIndex) => {
        const slotId = resolveSlotId(slot, slotIndex);
        const currentIds = slot.assignedStudentIds || [];
        const shouldBeAssigned = slotsToAccept.includes(slotId);

        if (shouldBeAssigned) {
          return currentIds.includes(student.id)
            ? slot
            : { ...slot, assignedStudentIds: [...currentIds, student.id] };
        }

        if (studentSlotScope.has(slotId) && currentIds.includes(student.id)) {
          return { ...slot, assignedStudentIds: currentIds.filter((id) => id !== student.id) };
        }

        return slot;
      });

      await updateDoc(doc(db, 'missions', mission.id), {
        slots: updatedSlots,
        updatedAt: new Date(),
      });

      await updateDoc(doc(db, 'applications', student.applicationId), {
        status: 'Acceptée',
        acceptedSlotIds: slotsToAccept,
        selectedSlotIds: Array.from(new Set([...(student.selectedSlotIds || []), ...slotsToAccept])),
        updatedAt: new Date(),
      });

      setAcceptDialogOpen(false);
      setAcceptDialogStudent(null);
      setAcceptDialogSelectedSlots(new Set());
      await fetchData();
    } catch (error) {
      console.error('Erreur lors de l\'acceptation:', error);
      alert('Erreur lors de l\'acceptation de la candidature.');
    } finally {
      setAcceptingApplication(false);
    }
  };

  const openAcceptFlow = (student: StudentInfo) => {
    const allSlots = getAllMissionSlots();
    if (allSlots.length === 0) {
      alert('Aucun créneau défini sur cet événement.');
      return;
    }

    if (allSlots.length === 1) {
      void acceptStudentOnSlots(student, [allSlots[0].slotId]);
      return;
    }

    const currentAccepted = getCurrentAcceptedSlotIds(student);
    const defaultSelected =
      currentAccepted.length > 0
        ? currentAccepted
        : (student.selectedSlotIds?.length ? student.selectedSlotIds : allSlots.map(({ slotId }) => slotId));

    setAcceptDialogStudent(student);
    setAcceptDialogSelectedSlots(new Set(defaultSelected));
    setAcceptDialogOpen(true);
  };

  const handleRefuseApplication = async (student: StudentInfo) => {
    if (!mission || !student.applicationId) return;

    try {
      const updatedSlots = mission.slots?.map((slot) => ({
        ...slot,
        assignedStudentIds: (slot.assignedStudentIds || []).filter((id) => id !== student.id),
      }));

      await updateDoc(doc(db, 'missions', mission.id), {
        slots: updatedSlots,
        updatedAt: new Date(),
      });

      await updateDoc(doc(db, 'applications', student.applicationId), {
        status: 'Refusée',
        acceptedSlotIds: [],
        updatedAt: new Date(),
      });

      await fetchData();
    } catch (error) {
      console.error('Erreur lors du refus:', error);
      alert('Erreur lors du refus de la candidature.');
    }
  };

  const handleRemoveStudentFromSlot = async (slotId: string, studentId: string) => {
    if (!mission || !canManageAmbassadors) return;

    setRemovingFromSlot(true);
    try {
      const updatedSlots = mission.slots?.map((s, slotIndex) => {
        const currentSlotId = resolveSlotId(s, slotIndex);
        if (currentSlotId !== slotId) return s;
        return {
          ...s,
          assignedStudentIds: (s.assignedStudentIds || []).filter((id) => id !== studentId),
        };
      });

      await updateDoc(doc(db, 'missions', mission.id), {
        slots: updatedSlots,
        updatedAt: new Date(),
      });

      const student = students.find((s) => s.id === studentId);
      if (student?.applicationId) {
        const nextAccepted = (student.acceptedSlotIds || []).filter(
          (id) => !slotIdsMatch(id, slotId, mission.slots),
        );

        await updateDoc(doc(db, 'applications', student.applicationId), {
          acceptedSlotIds: nextAccepted,
          status: nextAccepted.length > 0 ? 'Acceptée' : 'En attente',
          updatedAt: new Date(),
        });
      }

      setPendingSlotRemoval(null);
      await fetchData();
    } catch (error) {
      console.error('Erreur lors du retrait du créneau:', error);
      alert('Erreur lors du retrait de l\'ambassadeur du créneau.');
    } finally {
      setRemovingFromSlot(false);
    }
  };

  const handleSlotStudentClick = (slotId: string, studentId: string) => {
    if (!canManageAmbassadors || removingFromSlot) return;

    if (pendingSlotRemoval?.slotId === slotId && pendingSlotRemoval?.studentId === studentId) {
      void handleRemoveStudentFromSlot(slotId, studentId);
      return;
    }

    setPendingSlotRemoval({ slotId, studentId });
  };

  const uploadEventFile = async (
    file: File,
    documentType: 'proposition_commerciale' | 'autre',
    category: 'facturation' | 'autres'
  ) => {
    if (!mission || !currentUser) {
      throw new Error('Session ou événement introuvable.');
    }

    const timestamp = Date.now();
    const cleanFileName = file.name
      .replace(/[[\]]/g, '_')
      .replace(/[<>:"/\\|?*]/g, '_');
    const fileName = `${timestamp}_${cleanFileName}`;
    const storagePath = `missions/${mission.id}/documents/${fileName}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file);
    const fileUrl = await getDownloadURL(storageRef);

    const structureId = (mission as any).structureId || userData?.structureId || '';
    await addDoc(collection(db, 'generatedDocuments'), {
      missionId: mission.id,
      missionNumber: mission.numeroMission || '',
      missionTitle: mission.title || (mission as any).campaignName || '',
      structureId,
      documentType,
      fileName: file.name,
      fileUrl,
      storagePath,
      fileSize: file.size,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: currentUser.uid,
      createdByName: getSafeDisplayName(userData),
      status: 'final',
      isValid: true,
      tags: documentType === 'proposition_commerciale' ? ['proposition_commerciale', 'ambassadeur_event'] : ['ambassadeur_event'],
      category,
      isUploaded: true,
      visibleToCompany: true,
      internalHidden: false,
    });
  };

  const handleUploadDocument = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !isStructureView) return;

    setUploadingDocument(true);
    try {
      await uploadEventFile(file, 'autre', 'autres');
      await fetchData();
    } catch (error) {
      console.error('Erreur lors de l\'upload du document:', error);
      alert('Erreur lors de l\'upload du document.');
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleUploadCommercialProposal = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !isStructureView) return;

    setUploadingProposal(true);
    try {
      await uploadEventFile(file, 'proposition_commerciale', 'facturation');
      await fetchData();
    } catch (error) {
      console.error('Erreur lors du dépôt de la proposition commerciale:', error);
      alert('Erreur lors du dépôt de la proposition commerciale.');
    } finally {
      setUploadingProposal(false);
    }
  };

  const handleToggleDocumentVisibility = async (documentId: string, nextVisible: boolean) => {
    if (!isStructureView) return;

    setDocumentActionId(documentId);
    try {
      await updateDoc(doc(db, 'generatedDocuments', documentId), {
        visibleToCompany: nextVisible,
        internalHidden: !nextVisible,
        updatedAt: new Date(),
      });
      setDocuments((prev) =>
        prev.map((d) => (d.id === documentId ? { ...d, visibleToCompany: nextVisible, internalHidden: !nextVisible } : d))
      );
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la visibilité:', error);
      alert('Erreur lors de la mise à jour de la visibilité.');
    } finally {
      setDocumentActionId(null);
    }
  };

  const openProposalMenu = (event: React.MouseEvent<HTMLElement>, docId: string) => {
    event.stopPropagation();
    setProposalMenuAnchor(event.currentTarget);
    setProposalMenuDocId(docId);
  };

  const closeProposalMenu = () => {
    setProposalMenuAnchor(null);
    setProposalMenuDocId(null);
  };

  const handleOpenDocumentPreview = (url: string, name: string, mimeType?: string) => {
    const isPdf = mimeType === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      setDocumentPreviewUrl(url);
      setDocumentPreviewTitle(name);
      setOpenDocumentPreview(true);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const closeDocumentPreview = () => {
    setOpenDocumentPreview(false);
    setDocumentPreviewUrl(null);
    setDocumentPreviewTitle('');
  };

  const handleDeleteDocument = async (document: EventDocument) => {
    if (!isStructureView) return;
    if (!window.confirm(`Supprimer « ${document.name} » ?`)) return;

    setDocumentActionId(document.id);
    try {
      await deleteDoc(doc(db, 'generatedDocuments', document.id));

      const pathToDelete = document.storagePath || extractStoragePathFromUrl(document.url);
      if (pathToDelete) {
        try {
          await deleteObject(ref(storage, pathToDelete));
        } catch (storageError: unknown) {
          const code = (storageError as { code?: string })?.code;
          if (code !== 'storage/object-not-found') {
            console.warn('Suppression Storage échouée:', storageError);
          }
        }
      }

      setDocuments((prev) => prev.filter((d) => d.id !== document.id));
    } catch (error) {
      console.error('Erreur lors de la suppression du document:', error);
      alert('Erreur lors de la suppression du document.');
    } finally {
      setDocumentActionId(null);
    }
  };


  if (loading) {
    return (
      <Box sx={{ ...dsPageCanvasSx, alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <CircularProgress sx={{ color: tokens.colors.brandTeal }} />
      </Box>
    );
  }

  if (error || !mission) {
    return (
      <Box sx={{ ...dsPageCanvasSx, alignItems: 'center', justifyContent: 'center', minHeight: '60vh', p: 4 }}>
        <Box sx={{ textAlign: 'center', maxWidth: 400 }}>
          <Typography sx={{ color: tokens.colors.error, mb: 3 }}>{error || 'Événement introuvable.'}</Typography>
          <Button variant="contained" onClick={() => navigate('/app/ambassadeurs')} sx={{ bgcolor: tokens.colors.brandTeal, textTransform: 'none' }}>
            Retour aux Ambassadeurs
          </Button>
        </Box>
      </Box>
    );
  }

  const lastProposalRequestAt = toOptionalDate((mission as any).lastCommercialProposalRequestedAt);
  const proposalCooldownRemainingMs = getProposalCooldownRemainingMs(lastProposalRequestAt, proposalNow);
  const isProposalOnCooldown = proposalCooldownRemainingMs > 0;
  const commercialProposals = documents.filter((d) => d.documentType === 'proposition_commerciale');
  const companyCommercialProposals = commercialProposals.filter((d) => d.visibleToCompany);
  const proposalMenuDoc = proposalMenuDocId ? documents.find((d) => d.id === proposalMenuDocId) : undefined;
  const displayedDocuments = isStructureView
    ? documents
    : documents.filter((d) => d.visibleToCompany);
  const slotCount = mission.slots?.length || 0;
  const uniqueAmbassadors = new Set(
    mission.slots?.flatMap((s) => s.assignedStudentIds || []) || students.filter((s) => s.status === 'Acceptée').map((s) => s.id),
  ).size;

  const panelSx = {
    bgcolor: tokens.colors.bgPaper,
    border: `1px solid ${tokens.colors.divider}`,
    borderRadius: tokens.radius.xl,
    overflow: 'hidden',
    boxShadow: tokens.shadows.sm,
  };

  return (
    <Box sx={dsPageCanvasSx}>
      <PortalTopBar
        title={mission.title || mission.description || 'Sans titre'}
        subtitle={mission.campaignName || mission.location}
        actions={
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {canEdit && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<SendIcon />}
                onClick={openAnnouncementDialog}
                sx={{ textTransform: 'none', borderRadius: tokens.radius.lg, borderColor: tokens.colors.brandTeal, color: tokens.colors.brandTeal }}
              >
                Email ambassadeurs
              </Button>
            )}
            {canEdit && !canEditAsContact && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<TransformIcon />}
                onClick={() => convertedMissionId ? navigate(`/app/mission/${convertedMissionId}`) : setConvertDialogOpen(true)}
                sx={{ textTransform: 'none', borderRadius: tokens.radius.lg, borderColor: tokens.colors.success, color: tokens.colors.success }}
              >
                {convertedMissionId ? 'Voir la mission' : 'Convertir en mission'}
              </Button>
            )}
            {canEdit && (
              <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={() => setIsEditing(true)} sx={{ textTransform: 'none', borderRadius: tokens.radius.lg }}>
                Modifier
              </Button>
            )}
          </Box>
        }
      />

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', bgcolor: tokens.colors.surfaceAlt }}>
        <Box sx={{ px: 3, py: 3, maxWidth: 1100, mx: 'auto', width: '100%' }}>
          <Button
            startIcon={<ChevronLeftIcon />}
            onClick={() => navigate('/app/ambassadeurs')}
            sx={{ textTransform: 'none', color: tokens.colors.gray500, mb: 2, px: 0, '&:hover': { bgcolor: 'transparent', color: tokens.colors.gray700 } }}
          >
            Retour aux événements
          </Button>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5, alignItems: 'center' }}>
            {mission.campaignName && (
              <Box component="span" sx={{ fontSize: 12, fontWeight: 700, px: 1.5, py: 0.5, borderRadius: tokens.radius.pill, bgcolor: tokens.colors.infoLight, color: tokens.colors.brandNavy }}>
                {mission.campaignName}
              </Box>
            )}
            {mission.location && (
              <Typography sx={{ fontSize: 13, color: tokens.colors.gray500, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LocationIcon sx={{ fontSize: 16 }} />{mission.location}
              </Typography>
            )}
            {mission.startDate && (
              <Typography sx={{ fontSize: 13, color: tokens.colors.gray500, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CalendarIcon sx={{ fontSize: 16 }} />
                {format(toMissionDate(mission.startDate), "EEEE d MMMM yyyy", { locale: fr })}
                {mission.endDate && ` – ${format(toMissionDate(mission.endDate), 'd MMM yyyy', { locale: fr })}`}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5, mb: 3 }}>
            <CaeKpi label="Taux de remplissage" value={`${fillRate}%`} hint={`${totalRegistered} / ${totalCapacity}`} />
            <CaeKpi label="Ambassadeurs inscrits" value={uniqueAmbassadors} hint="profils distincts" />
            <CaeKpi label="Journées" value={slotCount} hint="créneaux planifiés" />
            <CaeKpi label="Heures totales" value={`${formatHours(totalPlannedHours)} h`} hint="durée × capacité" />
          </Box>

          <Box sx={{ borderBottom: `1px solid ${tokens.colors.divider}`, mb: 3 }}>
            <Tabs value={detailTab} onChange={(_, v) => setDetailTab(v)} sx={dsTabsSx}>
              <Tab icon={<DashboardIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Vue d'ensemble" value="overview" />
              <Tab icon={<FolderIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={`Documents (${displayedDocuments.length})`} value="documents" />
            </Tabs>
          </Box>

          {detailTab === 'overview' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 320px' }, gap: 2, alignItems: 'start' }}>
              <Box>
                <Box sx={panelSx}>
                  <Box sx={{ px: 2.25, py: 2, borderBottom: `1px solid ${tokens.colors.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: tokens.colors.gray900 }}>Récapitulatif par journée</Typography>
                  </Box>
                  <Box sx={{ p: 2.25, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {(mission.slots || []).length === 0 ? (
                      <Typography sx={{ fontSize: 13, color: tokens.colors.gray500 }}>Aucun créneau défini.</Typography>
                    ) : (
                      mission.slots!.map((slot, index) => {
                        const startDate = toMissionDate(slot.startTime);
                        const endDate = toMissionDate(slot.endTime);
                        const slotId = slot.id || `day-${index}`;
                        const assignedIds = slot.assignedStudentIds || [];
                        const people = assignedIds
                          .map((id) => students.find((s) => s.id === id))
                          .filter(Boolean) as StudentInfo[];
                        const capacity = slot.capacity || 1;
                        const pct = Math.min(100, Math.round((people.length / capacity) * 100));
                        const full = people.length >= capacity;
                        return (
                          <Box
                            key={slot.id || index}
                            sx={{
                              display: 'flex',
                              gap: 2,
                              p: 1.75,
                              borderRadius: tokens.radius.lg,
                              border: `1px solid ${tokens.colors.divider}`,
                              bgcolor: tokens.colors.gray50,
                              flexDirection: { xs: 'column', sm: 'row' },
                              alignItems: { xs: 'stretch', sm: 'flex-start' },
                            }}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                flexDirection: { xs: 'row', sm: 'column' },
                                alignItems: 'center',
                                justifyContent: { xs: 'flex-start', sm: 'center' },
                                width: { xs: 'auto', sm: 44 },
                                flexShrink: 0,
                                gap: { xs: 1.25, sm: 0 },
                              }}
                            >
                              <Typography sx={{ fontSize: 10, color: tokens.colors.gray400, fontWeight: 700, textTransform: 'uppercase' }}>
                                {format(startDate, 'EEE', { locale: fr })}
                              </Typography>
                              <Typography sx={{ fontSize: 22, fontWeight: 800, color: tokens.colors.gray900, lineHeight: 1 }}>
                                {format(startDate, 'd')}
                              </Typography>
                              <Typography sx={{ fontSize: 10, color: tokens.colors.gray500 }}>{format(startDate, 'MMM', { locale: fr })}</Typography>
                            </Box>
                            <Box
                              aria-hidden
                              sx={{
                                flexShrink: 0,
                                borderTop: { xs: `1px solid ${tokens.colors.divider}`, sm: 'none' },
                                borderLeft: { xs: 'none', sm: `1px solid ${tokens.colors.divider}` },
                                alignSelf: 'stretch',
                                my: { xs: 0.5, sm: 0 },
                              }}
                            />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                                <Box sx={{ fontSize: 10.5, px: 1, py: 0.25, borderRadius: tokens.radius.pill, bgcolor: tokens.colors.infoLight, color: tokens.colors.brandNavy, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                  <AccessTimeIcon sx={{ fontSize: 12 }} />
                                  {startDate.toTimeString().slice(0, 5)} – {endDate.toTimeString().slice(0, 5)}
                                </Box>
                                <Typography sx={{ fontSize: 11, fontWeight: 600, color: full ? '#065f46' : '#92400e' }}>
                                  {people.length} / {capacity} poste{capacity > 1 ? 's' : ''}
                                </Typography>
                                {people.length > capacity && (
                                  <Box sx={{ fontSize: 10.5, px: 1, py: 0.25, borderRadius: tokens.radius.pill, bgcolor: tokens.colors.warningLight, color: '#92400e', fontWeight: 700 }}>
                                    Surnombre +{people.length - capacity}
                                  </Box>
                                )}
                              </Box>
                              {people.length === 0 ? (
                                <Typography sx={{ fontSize: 12, color: '#92400e', bgcolor: tokens.colors.warningLight, border: '1px dashed #fde68a', borderRadius: tokens.radius.md, px: 1.5, py: 1 }}>
                                  Aucun ambassadeur positionné — places à pourvoir
                                </Typography>
                              ) : (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                  {people.map((p) => {
                                    const isPendingRemoval =
                                      pendingSlotRemoval?.slotId === slotId && pendingSlotRemoval?.studentId === p.id;
                                    const isClickable = canManageAmbassadors;
                                    const isAcceptedOnSlot = (p.acceptedSlotIds || []).some((id) =>
                                      slotIdsMatch(id, slotId, mission.slots),
                                    );
                                    return (
                                      <Box
                                        key={p.id}
                                        role={isClickable ? 'button' : undefined}
                                        tabIndex={isClickable ? 0 : undefined}
                                        onClick={isClickable ? () => handleSlotStudentClick(slotId, p.id) : undefined}
                                        onKeyDown={
                                          isClickable
                                            ? (e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                  e.preventDefault();
                                                  handleSlotStudentClick(slotId, p.id);
                                                }
                                              }
                                            : undefined
                                        }
                                        title={
                                          isClickable
                                            ? isPendingRemoval
                                              ? 'Cliquer à nouveau pour retirer du créneau'
                                              : 'Cliquer pour retirer du créneau'
                                            : undefined
                                        }
                                        sx={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 1,
                                          px: 1.5,
                                          py: 0.75,
                                          borderRadius: tokens.radius.pill,
                                          border: isPendingRemoval
                                            ? `1px solid ${tokens.colors.error}`
                                            : isAcceptedOnSlot
                                              ? `1px solid ${tokens.colors.gray200}`
                                              : `1px dashed ${tokens.colors.gray300}`,
                                          bgcolor: isPendingRemoval
                                            ? tokens.colors.errorLight
                                            : isAcceptedOnSlot
                                              ? tokens.colors.bgPaper
                                              : tokens.colors.gray50,
                                          minWidth: 0,
                                          cursor: isClickable ? 'pointer' : 'default',
                                          transition: 'background-color 0.15s ease, border-color 0.15s ease',
                                          opacity: removingFromSlot && isPendingRemoval ? 0.7 : 1,
                                          '&:hover': isClickable && !isPendingRemoval
                                            ? { bgcolor: tokens.colors.gray100, borderColor: tokens.colors.gray400 }
                                            : undefined,
                                        }}
                                      >
                                        <Box
                                          sx={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: tokens.radius.pill,
                                            bgcolor: isPendingRemoval ? tokens.colors.error : tokens.colors.brandTeal,
                                            color: '#fff',
                                            fontSize: 11,
                                            fontWeight: 700,
                                            display: 'grid',
                                            placeItems: 'center',
                                            flexShrink: 0,
                                          }}
                                        >
                                          {isPendingRemoval ? (
                                            <CancelIcon sx={{ fontSize: 14 }} />
                                          ) : (
                                            (p.displayName || '?').charAt(0).toUpperCase()
                                          )}
                                        </Box>
                                        <UserNameText
                                          user={p}
                                          component="span"
                                          sx={{
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: isPendingRemoval ? tokens.colors.error : tokens.colors.gray900,
                                            maxWidth: 200,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                          }}
                                        />
                                      </Box>
                                    );
                                  })}
                                  {Array.from({ length: Math.max(0, capacity - people.length) }).map((_, i) => (
                                    <Box key={`empty-${i}`} sx={{ fontSize: 11.5, color: tokens.colors.gray400, px: 1.5, py: 0.75, borderRadius: tokens.radius.pill, border: `1px dashed ${tokens.colors.gray300}` }}>
                                      Place libre
                                    </Box>
                                  ))}
                                </Box>
                              )}
                              <Box sx={{ mt: 1, height: 4, bgcolor: tokens.colors.gray100, borderRadius: tokens.radius.pill, overflow: 'hidden' }}>
                                <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: full ? tokens.colors.success : tokens.colors.brandTeal, borderRadius: tokens.radius.pill }} />
                              </Box>
                            </Box>
                          </Box>
                        );
                      })
                    )}
                  </Box>
                </Box>

                <Box sx={{ ...panelSx, mt: 2 }}>
                  <Box sx={{ px: 2.25, py: 2, borderBottom: `1px solid ${tokens.colors.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: tokens.colors.gray900, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PeopleIcon sx={{ fontSize: 18, color: tokens.colors.gray400 }} />
                      Candidatures ({students.length})
                    </Typography>
                    {canAddAmbassadors && (
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => { setAddAmbassadorDialogOpen(true); loadAvailableAmbassadors(); }}
                        sx={{ textTransform: 'none', bgcolor: tokens.colors.brandTeal, '&:hover': { bgcolor: tokens.colors.brandTeal700 } }}
                        variant="contained"
                      >
                        Ajouter
                      </Button>
                    )}
                  </Box>
                  <Box sx={{ p: 2.25 }}>
                    {students.length === 0 ? (
                      <Typography sx={{ fontSize: 13, color: tokens.colors.gray500 }}>Aucune candidature pour le moment.</Typography>
                    ) : (
                      students.map((s) => {
                        const displayStatus = resolveDisplayStatus(s);
                        const statusColor = displayStatus === 'Acceptée' ? tokens.colors.success : displayStatus === 'Refusée' ? tokens.colors.error : tokens.colors.warning;
                        const applicableSlots = getApplicableSlotsForStudent(s);
                        const acceptedSlots = applicableSlots.filter(({ slotId }) =>
                          (s.acceptedSlotIds || []).some((id) => slotIdsMatch(id, slotId, mission.slots)),
                        );
                        return (
                          <Box key={s.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, p: 1.5, mb: 1, borderRadius: tokens.radius.md, bgcolor: displayStatus === 'Acceptée' ? tokens.colors.successLight : displayStatus === 'Refusée' ? tokens.colors.errorLight : tokens.colors.warningLight, flexWrap: 'wrap' }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                                <UserNameText user={s} sx={{ fontSize: 14, fontWeight: 600 }} fallback="Sans nom" />
                                <Box component="span" sx={{ fontSize: 11, fontWeight: 600, px: 1, py: 0.25, borderRadius: tokens.radius.pill, bgcolor: `${statusColor}22`, color: statusColor }}>
                                  {displayStatus}
                                </Box>
                              </Box>
                              {s.email && <Typography sx={{ fontSize: 12, color: tokens.colors.gray500 }}>{s.email}</Typography>}
                              {applicableSlots.length > 0 && (
                                <Typography sx={{ fontSize: 11.5, color: tokens.colors.gray600, mt: 0.5, lineHeight: 1.45 }}>
                                  {displayStatus === 'Acceptée'
                                    ? `Accepté sur ${acceptedSlots.length} créneau${acceptedSlots.length > 1 ? 'x' : ''} : ${acceptedSlots.map(({ label }) => label).join(' · ')}`
                                    : `Créneaux demandés : ${applicableSlots.map(({ label }) => label).join(' · ')}`}
                                </Typography>
                              )}
                              {s.cvUrl && (
                                <Box component="a" href={s.cvUrl} target="_blank" rel="noopener noreferrer" sx={{ fontSize: 12, color: tokens.colors.brandTeal, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                  <PdfIcon sx={{ fontSize: 14 }} /> Voir le CV
                                </Box>
                              )}
                            </Box>
                            {canManageAmbassadors && s.applicationId && (
                              <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
                                {displayStatus !== 'Refusée' && (
                                  <Button
                                    size="small"
                                    startIcon={<CancelIcon sx={{ fontSize: 16 }} />}
                                    onClick={() => void handleRefuseApplication(s)}
                                    sx={{ textTransform: 'none', fontSize: 12, color: tokens.colors.error, borderColor: tokens.colors.error }}
                                    variant="outlined"
                                  >
                                    Refuser
                                  </Button>
                                )}
                                {displayStatus !== 'Acceptée' && (
                                  <Button
                                    size="small"
                                    variant="contained"
                                    startIcon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                                    onClick={() => openAcceptFlow(s)}
                                    disabled={acceptingApplication}
                                    sx={{ textTransform: 'none', fontSize: 12, bgcolor: tokens.colors.brandTeal, '&:hover': { bgcolor: tokens.colors.brandTeal700 } }}
                                  >
                                    {displayStatus === 'Refusée' ? 'Réaccepter' : 'Accepter'}
                                  </Button>
                                )}
                                {displayStatus === 'Acceptée' && getAllMissionSlots().length > 1 && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => openAcceptFlow(s)}
                                    disabled={acceptingApplication}
                                    sx={{ textTransform: 'none', fontSize: 12, borderColor: tokens.colors.brandTeal, color: tokens.colors.brandTeal }}
                                  >
                                    Modifier créneaux
                                  </Button>
                                )}
                              </Box>
                            )}
                          </Box>
                        );
                      })
                    )}
                  </Box>
                </Box>
              </Box>

              <Box sx={{ ...panelSx, position: { lg: 'sticky' }, top: 8 }}>
                <Box sx={{ px: 2.25, py: 1.75, background: `linear-gradient(120deg, ${tokens.colors.brandNavy}, ${tokens.colors.brandTeal})` }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DescriptionIcon sx={{ fontSize: 18 }} /> Proposition commerciale
                  </Typography>
                </Box>
                <Box sx={{ p: 2.25 }}>
                  {isStructureView ? (
                    <>
                      <Typography sx={{ fontSize: 12, color: tokens.colors.gray500, lineHeight: 1.55, mb: 2 }}>
                        Déposez ici la proposition commerciale à destination de l'entreprise.
                      </Typography>
                      {lastProposalRequestAt && (
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, p: 1.5, mb: 2, borderRadius: tokens.radius.lg, bgcolor: tokens.colors.infoLight, border: `1px solid ${tokens.colors.brandNavy}33` }}>
                          <AccessTimeIcon sx={{ fontSize: 20, color: tokens.colors.brandNavy, mt: 0.25 }} />
                          <Typography sx={{ fontSize: 12.5, color: tokens.colors.brandNavy, fontWeight: 600, lineHeight: 1.5 }}>
                            Demande reçue le {format(lastProposalRequestAt, "d MMMM yyyy 'à' HH:mm", { locale: fr })} — déposez la proposition ci-dessous.
                          </Typography>
                        </Box>
                      )}
                      {commercialProposals.length > 0 && (
                        <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {commercialProposals.map((d) => {
                            const isActionLoading = documentActionId === d.id;
                            return (
                              <Box
                                key={d.id}
                                onClick={() => d.url && handleOpenDocumentPreview(d.url, d.name, d.type)}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 1,
                                  p: 1.25,
                                  borderRadius: tokens.radius.md,
                                  bgcolor: tokens.colors.gray50,
                                  border: `1px solid ${tokens.colors.divider}`,
                                  cursor: d.url ? 'pointer' : 'default',
                                  transition: 'background-color 0.15s ease',
                                  '&:hover': d.url ? { bgcolor: tokens.colors.gray100 } : undefined,
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                                  <PdfIcon sx={{ fontSize: 18, color: tokens.colors.error, flexShrink: 0 }} />
                                  <Typography sx={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</Typography>
                                </Box>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openProposalMenu(e, d.id);
                                  }}
                                  disabled={isActionLoading}
                                  sx={{ flexShrink: 0, color: tokens.colors.gray500 }}
                                >
                                  {isActionLoading ? <CircularProgress size={16} /> : <MoreVertIcon fontSize="small" />}
                                </IconButton>
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                      <Menu
                        anchorEl={proposalMenuAnchor}
                        open={Boolean(proposalMenuAnchor)}
                        onClose={closeProposalMenu}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                      >
                        {proposalMenuDoc?.url && (
                          <MenuItem
                            component="a"
                            href={proposalMenuDoc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={closeProposalMenu}
                          >
                            <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
                            <ListItemText>Télécharger</ListItemText>
                          </MenuItem>
                        )}
                        <MenuItem
                          onClick={() => {
                            if (proposalMenuDoc) handleDeleteDocument(proposalMenuDoc);
                            closeProposalMenu();
                          }}
                          sx={{ color: tokens.colors.error }}
                        >
                          <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: tokens.colors.error }} /></ListItemIcon>
                          <ListItemText>Supprimer</ListItemText>
                        </MenuItem>
                      </Menu>
                      <input
                        ref={proposalUploadInputRef}
                        type="file"
                        hidden
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleUploadCommercialProposal}
                      />
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={uploadingProposal ? <CircularProgress size={18} color="inherit" /> : <CloudUploadIcon />}
                        onClick={() => proposalUploadInputRef.current?.click()}
                        disabled={uploadingProposal}
                        sx={{ textTransform: 'none', bgcolor: tokens.colors.brandTeal, borderRadius: tokens.radius.lg, py: 1.25, '&:hover': { bgcolor: tokens.colors.brandTeal700 } }}
                      >
                        {uploadingProposal ? 'Dépôt en cours…' : commercialProposals.length > 0 ? 'Déposer une nouvelle proposition' : 'Déposer la proposition commerciale'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Typography sx={{ fontSize: 12, color: tokens.colors.gray500, lineHeight: 1.55, mb: 2 }}>
                        {companyCommercialProposals.length > 0
                          ? 'Votre proposition commerciale est disponible ci-dessous.'
                          : 'Demandez une proposition commerciale détaillée : l\'équipe JS Connect vous l\'adresse sous 48 h.'}
                      </Typography>
                      {companyCommercialProposals.length > 0 && (
                        <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {companyCommercialProposals.map((d) => (
                            <Box
                              key={d.id}
                              onClick={() => d.url && handleOpenDocumentPreview(d.url, d.name, d.type)}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 1,
                                p: 1.25,
                                borderRadius: tokens.radius.md,
                                bgcolor: tokens.colors.gray50,
                                border: `1px solid ${tokens.colors.divider}`,
                                cursor: d.url ? 'pointer' : 'default',
                                transition: 'background-color 0.15s ease',
                                '&:hover': d.url ? { bgcolor: tokens.colors.gray100 } : undefined,
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                                <PdfIcon sx={{ fontSize: 18, color: tokens.colors.error, flexShrink: 0 }} />
                                <Typography sx={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</Typography>
                              </Box>
                              {d.url && (
                                <Button
                                  component="a"
                                  href={d.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  size="small"
                                  startIcon={<DownloadIcon />}
                                  onClick={(e) => e.stopPropagation()}
                                  sx={{ textTransform: 'none', flexShrink: 0 }}
                                >
                                  Télécharger
                                </Button>
                              )}
                            </Box>
                          ))}
                        </Box>
                      )}
                      {proposalError && (
                        <Box sx={{ mb: 1.5, p: 1.25, borderRadius: tokens.radius.lg, bgcolor: tokens.colors.errorLight, border: `1px solid ${tokens.colors.error}` }}>
                          <Typography sx={{ fontSize: 12.5, color: tokens.colors.error, fontWeight: 600 }}>
                            {proposalError}
                          </Typography>
                        </Box>
                      )}
                      {!isProposalOnCooldown ? (
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<SendIcon />}
                          onClick={handleSendProposalRequest}
                          disabled={proposalSending}
                          sx={{ textTransform: 'none', bgcolor: tokens.colors.brandTeal, borderRadius: tokens.radius.lg, py: 1.25, '&:hover': { bgcolor: tokens.colors.brandTeal700 } }}
                        >
                          {proposalSending ? 'Envoi en cours…' : companyCommercialProposals.length > 0 ? 'Demander une nouvelle proposition' : 'Demander une proposition commerciale'}
                        </Button>
                      ) : companyCommercialProposals.length === 0 ? (
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, p: 1.5, borderRadius: tokens.radius.lg, bgcolor: tokens.colors.successLight, border: `1px solid ${tokens.colors.success}` }}>
                          <CheckCircleIcon sx={{ fontSize: 20, color: tokens.colors.success, flexShrink: 0, mt: 0.25 }} />
                          <Typography sx={{ fontSize: 12.5, color: '#065f46', fontWeight: 600, lineHeight: 1.5 }}>
                            Demande envoyée — réponse sous 48 h ouvrées.
                          </Typography>
                        </Box>
                      ) : null}
                    </>
                  )}
                </Box>
              </Box>
            </Box>
          )}

          {detailTab === 'documents' && (
            <Box sx={panelSx}>
              <Box sx={{ px: 2.25, py: 2, borderBottom: `1px solid ${tokens.colors.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: tokens.colors.gray900, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DescriptionIcon sx={{ fontSize: 18, color: tokens.colors.gray400 }} />
                  Documents de la mission ({displayedDocuments.length})
                </Typography>
                {isStructureView && (
                  <>
                    <input
                      ref={documentUploadInputRef}
                      type="file"
                      hidden
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,application/pdf"
                      onChange={handleUploadDocument}
                    />
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={uploadingDocument ? <CircularProgress size={16} color="inherit" /> : <CloudUploadIcon />}
                      onClick={() => documentUploadInputRef.current?.click()}
                      disabled={uploadingDocument}
                      sx={{ textTransform: 'none', bgcolor: tokens.colors.brandTeal, '&:hover': { bgcolor: tokens.colors.brandTeal700 } }}
                    >
                      {uploadingDocument ? 'Upload…' : 'Ajouter un document'}
                    </Button>
                  </>
                )}
              </Box>
              <Box sx={{ p: 2.25 }}>
                {displayedDocuments.length === 0 ? (
                  <Typography sx={{ fontSize: 13, color: tokens.colors.gray500 }}>
                    {isStructureView ? 'Aucun document pour le moment. Utilisez le bouton ci-dessus pour en déposer.' : 'Aucun document disponible pour le moment.'}
                  </Typography>
                ) : (
                  displayedDocuments.map((d) => {
                    const isActionLoading = documentActionId === d.id;
                    return (
                      <Box key={d.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 1.5, borderBottom: `1px solid ${tokens.colors.divider}`, flexWrap: 'wrap' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
                          {d.type === 'application/pdf' ? <PdfIcon sx={{ color: tokens.colors.error, flexShrink: 0 }} /> : <FileIcon sx={{ color: tokens.colors.gray500, flexShrink: 0 }} />}
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</Typography>
                            {isStructureView && (
                              <Typography sx={{ fontSize: 11.5, color: d.visibleToCompany ? tokens.colors.success : tokens.colors.gray500, fontWeight: 600, mt: 0.25 }}>
                                {d.visibleToCompany ? 'Visible par l\'entreprise' : 'Interne structure'}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, flexWrap: 'wrap' }}>
                          {isStructureView && (
                            <>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={isActionLoading ? <CircularProgress size={14} /> : d.visibleToCompany ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
                                onClick={() => handleToggleDocumentVisibility(d.id, !d.visibleToCompany)}
                                disabled={isActionLoading}
                                sx={{
                                  textTransform: 'none',
                                  fontSize: 12,
                                  borderColor: d.visibleToCompany ? tokens.colors.gray300 : tokens.colors.brandTeal,
                                  color: d.visibleToCompany ? tokens.colors.gray600 : tokens.colors.brandTeal,
                                }}
                              >
                                {d.visibleToCompany ? 'Masquer' : 'Rendre visible'}
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
                                onClick={() => handleDeleteDocument(d)}
                                disabled={isActionLoading}
                                sx={{ textTransform: 'none', fontSize: 12 }}
                              >
                                Supprimer
                              </Button>
                            </>
                          )}
                          {d.url && (
                            <Button component="a" href={d.url} target="_blank" rel="noopener noreferrer" size="small" startIcon={<DownloadIcon />} sx={{ textTransform: 'none', flexShrink: 0 }}>
                              Télécharger
                            </Button>
                          )}
                        </Box>
                      </Box>
                    );
                  })
                )}
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      <Dialog
        open={openDocumentPreview}
        onClose={closeDocumentPreview}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { height: '90vh', maxHeight: '90vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 1.5, px: 2 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {documentPreviewTitle}
          </Typography>
          <IconButton size="small" onClick={closeDocumentPreview} aria-label="Fermer l'aperçu">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: 'calc(100% - 57px)' }}>
          {documentPreviewUrl && (
            <Box
              component="iframe"
              src={documentPreviewUrl}
              title={documentPreviewTitle || 'Aperçu du document'}
              sx={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de modification — conservé */}
      {isEditing && mission && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '80px 16px 16px',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={() => setIsEditing(false)}
        >
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              borderRadius: tokens.radius.xxl,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              maxWidth: '720px',
              width: '100%',
              padding: '32px',
              backdropFilter: 'blur(20px)',
              maxHeight: 'calc(100vh - 96px)',
              overflow: 'auto',
              fontFamily: appleFont,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <AmbassadorEventForm
              initialEvent={mission}
              onSuccess={handleEditSuccess}
              onCancel={() => setIsEditing(false)}
            />
          </div>
        </div>
      )}

      {/* Dialog de conversion en mission */}
      {convertDialogOpen && mission && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={() => setConvertDialogOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: tokens.radius.xxl,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              maxWidth: '500px',
              width: '100%',
              padding: '32px',
              fontFamily: appleFont,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              fontSize: '24px',
              fontWeight: 600,
              color: '#111827',
              marginBottom: '24px',
              fontFamily: appleFont
            }}>
              Convertir en mission
            </h2>

            <div style={{ marginBottom: '20px' }}>
              <TextField
                fullWidth
                required
                label="Numéro de mission"
                value={missionNumber}
                onChange={(e) => setMissionNumber(e.target.value)}
                placeholder="Ex: 250904"
                variant="outlined"
                helperText="Format: YYMMNN (ex: 250904)"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AssignmentIcon sx={{ color: tokens.colors.textSecondary }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: tokens.radius.md,
                    fontFamily: appleFont,
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#2563eb',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#2563eb',
                      borderWidth: '2px',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    fontFamily: appleFont,
                    '&.Mui-focused': {
                      color: '#2563eb',
                    },
                  },
                  '& .MuiFormHelperText-root': {
                    fontFamily: appleFont,
                  },
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <TextField
                fullWidth
                select
                required
                label="Chargé de mission"
                value={selectedChargeId}
                onChange={(e) => setSelectedChargeId(e.target.value)}
                variant="outlined"
                SelectProps={{
                  native: false,
                  renderValue: (value) => {
                    const selectedUser = availableCharges.find(user => user.id === value);
                    return getSafeDisplayName(selectedUser);
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon sx={{ color: tokens.colors.textSecondary }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: tokens.radius.md,
                    fontFamily: appleFont,
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#2563eb',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#2563eb',
                      borderWidth: '2px',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    fontFamily: appleFont,
                    '&.Mui-focused': {
                      color: '#2563eb',
                    },
                  },
                }}
              >
                {availableCharges.length === 0 && (
                  <MenuItem value="" disabled>
                    <Typography sx={{ fontFamily: appleFont }}>Chargement...</Typography>
                  </MenuItem>
                )}
                {availableCharges.map((charge) => (
                  <MenuItem key={charge.id} value={charge.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {charge.photoURL ? (
                        <Box
                          component="img"
                          src={charge.photoURL}
                          alt={charge.displayName}
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            backgroundColor: tokens.colors.brandTeal,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {charge.displayName.charAt(0).toUpperCase()}
                        </Box>
                      )}
                      <UserNameText user={charge} sx={{ fontFamily: appleFont }} />
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </div>

            <div style={{
              padding: '16px',
              backgroundColor: '#f0f9ff',
              borderRadius: tokens.radius.md,
              marginBottom: '24px'
            }}>
              <p style={{
                fontSize: '13px',
                color: '#1e40af',
                margin: 0,
                fontFamily: appleFont,
                lineHeight: '1.6'
              }}>
                <strong>Informations qui seront transférées :</strong><br />
                • {students.filter(s => ['Acceptée', 'En attente'].includes(s.status || '')).length} candidature(s) (Acceptées et En attente)<br />
                • Horaires et pauses (tous les jours)<br />
                • Lieu et coordonnées<br />
                • Capacité totale: {mission.studentCount || 0} étudiant(s)<br />
                • Entreprise et contact par défaut (depuis l'onglet Informations)
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setConvertDialogOpen(false)}
                disabled={isConverting}
                style={{
                  padding: '12px 24px',
                  borderRadius: tokens.radius.md,
                  border: '1px solid #d1d5db',
                  backgroundColor: 'transparent',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: 500,
                  fontFamily: appleFont,
                  cursor: isConverting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConvertToMission}
                disabled={isConverting || !missionNumber.trim() || !selectedChargeId}
                style={{
                  padding: '12px 24px',
                  borderRadius: tokens.radius.md,
                  border: 'none',
                  backgroundColor: isConverting || !missionNumber.trim() || !selectedChargeId ? '#9ca3af' : '#10b981',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: appleFont,
                  cursor: isConverting || !missionNumber.trim() || !selectedChargeId ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!isConverting && missionNumber.trim() && selectedChargeId) {
                    e.currentTarget.style.backgroundColor = '#059669';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isConverting && missionNumber.trim() && selectedChargeId) {
                    e.currentTarget.style.backgroundColor = '#10b981';
                  }
                }}
              >
                {isConverting ? 'Conversion...' : 'Convertir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialogue pour ajouter des ambassadeurs manuellement */}
      <Dialog
        open={addAmbassadorDialogOpen}
        onClose={() => {
          setAddAmbassadorDialogOpen(false);
          setSelectedAmbassadors(new Set());
          setSelectedSlotId('');
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: tokens.radius.xl,
            fontFamily: appleFont,
          }
        }}
      >
        <DialogTitle sx={{ fontFamily: appleFont, fontSize: 20, fontWeight: 600 }}>
          Ajouter des ambassadeurs
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography sx={{ fontFamily: appleFont, fontSize: 14, fontWeight: 600, mb: 1 }}>
              Sélectionner un créneau
            </Typography>
            <TextField
              select
              fullWidth
              value={selectedSlotId}
              onChange={(e) => setSelectedSlotId(e.target.value)}
              label="Sélectionner un créneau"
              sx={{ fontFamily: appleFont }}
            >
              {!selectedSlotId && (
                <MenuItem value="" disabled>
                  <Typography sx={{ fontFamily: appleFont, color: '#9ca3af' }}>
                    Choisir un créneau
                  </Typography>
                </MenuItem>
              )}
              {mission?.slots?.map((slot) => {
                const startDate = slot.startTime instanceof Date ? slot.startTime : (slot.startTime as any)?.toDate?.() || new Date(slot.startTime);
                const endDate = slot.endTime instanceof Date ? slot.endTime : (slot.endTime as any)?.toDate?.() || new Date(slot.endTime);
                const assigned = slot.assignedStudentIds?.length || 0;
                const capacity = slot.capacity || 0;
                const available = capacity - assigned;
                return (
                  <MenuItem key={slot.id} value={slot.id} sx={{ fontFamily: appleFont }}>
                    {format(startDate, 'EEEE d MMMM yyyy', { locale: fr })} - {format(startDate, 'HH:mm')} à {format(endDate, 'HH:mm')} ({assigned}/{capacity} - {available} disponible{available > 1 ? 's' : ''})
                  </MenuItem>
                );
              }) || []}
            </TextField>
          </Box>

          <Box>
            <Typography sx={{ fontFamily: appleFont, fontSize: 14, fontWeight: 600, mb: 2 }}>
              Sélectionner les ambassadeurs ({selectedAmbassadors.size} sélectionné{selectedAmbassadors.size > 1 ? 's' : ''})
            </Typography>
            {availableAmbassadors.length === 0 ? (
              <Typography sx={{ fontFamily: appleFont, color: '#6b7280', fontSize: 14 }}>
                Aucun ambassadeur disponible (tous sont déjà inscrits)
              </Typography>
            ) : (
              <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
                {availableAmbassadors.map((ambassador) => (
                  <FormControlLabel
                    key={ambassador.id}
                    control={
                      <Checkbox
                        checked={selectedAmbassadors.has(ambassador.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedAmbassadors);
                          if (e.target.checked) {
                            newSet.add(ambassador.id);
                          } else {
                            newSet.delete(ambassador.id);
                          }
                          setSelectedAmbassadors(newSet);
                        }}
                      />
                    }
                    label={
                      <Box>
                        <UserNameText user={ambassador} sx={{ fontFamily: appleFont, fontSize: 14, fontWeight: 500 }} fallback="Sans nom" />
                        <Typography sx={{ fontFamily: appleFont, fontSize: 12, color: '#6b7280' }}>
                          {ambassador.email || '—'}
                        </Typography>
                      </Box>
                    }
                    sx={{ fontFamily: appleFont, display: 'flex', mb: 1 }}
                  />
                ))}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => {
              setAddAmbassadorDialogOpen(false);
              setSelectedAmbassadors(new Set());
              setSelectedSlotId('');
            }}
            sx={{ fontFamily: appleFont }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleAddAmbassadors}
            disabled={selectedAmbassadors.size === 0 || !selectedSlotId || addingAmbassadors}
            variant="contained"
            sx={{ fontFamily: appleFont, backgroundColor: '#2563eb' }}
          >
            {addingAmbassadors ? 'Ajout...' : `Ajouter ${selectedAmbassadors.size} ambassadeur${selectedAmbassadors.size > 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={acceptDialogOpen}
        onClose={() => {
          if (acceptingApplication) return;
          setAcceptDialogOpen(false);
          setAcceptDialogStudent(null);
          setAcceptDialogSelectedSlots(new Set());
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: tokens.radius.xl, fontFamily: appleFont } }}
      >
        <DialogTitle sx={{ fontFamily: appleFont, fontSize: 20, fontWeight: 700 }}>
          Choisir les créneaux à accepter
        </DialogTitle>
        <DialogContent>
          {acceptDialogStudent && (
            <Typography sx={{ fontFamily: appleFont, fontSize: 13, color: tokens.colors.gray600, mb: 2 }}>
              Sélectionnez les créneaux sur lesquels{' '}
              <UserNameText user={acceptDialogStudent} component="span" sx={{ fontWeight: 600 }} fallback="cet ambassadeur" />{' '}
              sera accepté.
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {acceptDialogStudent && getAllMissionSlots().map(({ slotId, label }) => (
              <FormControlLabel
                key={slotId}
                control={
                  <Checkbox
                    checked={acceptDialogSelectedSlots.has(slotId)}
                    onChange={(e) => {
                      const next = new Set(acceptDialogSelectedSlots);
                      if (e.target.checked) next.add(slotId);
                      else next.delete(slotId);
                      setAcceptDialogSelectedSlots(next);
                    }}
                    disabled={acceptingApplication}
                  />
                }
                label={<Typography sx={{ fontFamily: appleFont, fontSize: 13 }}>{label}</Typography>}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => {
              setAcceptDialogOpen(false);
              setAcceptDialogStudent(null);
              setAcceptDialogSelectedSlots(new Set());
            }}
            disabled={acceptingApplication}
            sx={{ fontFamily: appleFont, textTransform: 'none' }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!acceptDialogStudent) return;
              void acceptStudentOnSlots(acceptDialogStudent, Array.from(acceptDialogSelectedSlots));
            }}
            disabled={acceptingApplication || acceptDialogSelectedSlots.size === 0}
            sx={{ fontFamily: appleFont, textTransform: 'none', bgcolor: tokens.colors.brandTeal, '&:hover': { bgcolor: tokens.colors.brandTeal700 } }}
          >
            {acceptingApplication ? 'Validation…' : `Accepter (${acceptDialogSelectedSlots.size})`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialogue pour envoyer un mail aux ambassadeurs (annonce salon) */}
      <Dialog
        open={announceDialogOpen}
        onClose={() => {
          if (announceSending) return;
          setAnnounceDialogOpen(false);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: tokens.radius.xl,
            fontFamily: appleFont,
          }
        }}
      >
        <DialogTitle
          dividers
          sx={{ fontFamily: appleFont, fontSize: 20, fontWeight: 700, pb: 2 }}
        >
          Envoyer un email aux ambassadeurs
        </DialogTitle>
        <DialogContent
          sx={{
            px: 3,
            pb: 2,
            pt: '40px !important',
          }}
        >
          {announceError && (
            <Box sx={{ mb: 2, p: 1.25, borderRadius: tokens.radius.lg, bgcolor: tokens.colors.errorLight, border: `1px solid ${tokens.colors.error}` }}>
              <Typography sx={{ fontFamily: appleFont, fontSize: 13, fontWeight: 600, color: tokens.colors.error }}>
                {announceError}
              </Typography>
            </Box>
          )}
          {announceSuccess && (
            <Box sx={{ mb: 2, p: 1.25, borderRadius: tokens.radius.lg, bgcolor: tokens.colors.successLight, border: `1px solid ${tokens.colors.success}` }}>
              <Typography sx={{ fontFamily: appleFont, fontSize: 13, fontWeight: 600, color: '#065f46' }}>
                {announceSuccess}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              select
              fullWidth
              label="Campus"
              value={announceCampus}
              onChange={(e) => setAnnounceCampus(e.target.value)}
              disabled={announceLoading || announceSending}
              InputLabelProps={{ shrink: true }}
            >
              <MenuItem value="__ALL__">Tous les campus</MenuItem>
              {announceCampusOptions.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              type="datetime-local"
              label="Début (affiché dans l’email)"
              value={announceStart}
              onChange={(e) => setAnnounceStart(e.target.value)}
              disabled={announceLoading || announceSending}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              fullWidth
              type="datetime-local"
              label="Fin (affiché dans l’email)"
              value={announceEnd}
              onChange={(e) => setAnnounceEnd(e.target.value)}
              disabled={announceLoading || announceSending}
              InputLabelProps={{ shrink: true }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={announceUseCustom}
                  onChange={(e) => setAnnounceUseCustom(e.target.checked)}
                  disabled={announceLoading || announceSending}
                />
              }
              label={<Typography sx={{ fontFamily: appleFont, fontSize: 13, fontWeight: 600 }}>Ajouter un message personnalisé</Typography>}
            />

            {announceUseCustom && (
              <TextField
                fullWidth
                multiline
                minRows={4}
                label="Message"
                value={announceMessage}
                onChange={(e) => setAnnounceMessage(e.target.value)}
                disabled={announceLoading || announceSending}
                placeholder="Ex: Bonjour, nous serons présents à ce salon et serions ravis de vous y retrouver…"
              />
            )}

            {announceSending && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CircularProgress size={18} sx={{ color: tokens.colors.brandTeal }} />
                <Typography sx={{ fontFamily: appleFont, fontSize: 13, color: tokens.colors.gray700 }}>
                  Envoi en cours… {announceRecipientsSent}/{announceRecipientsTotal}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setAnnounceDialogOpen(false)}
            disabled={announceSending}
            sx={{ fontFamily: appleFont }}
          >
            Fermer
          </Button>
          <Button
            variant="contained"
            onClick={handleSendAnnouncement}
            disabled={announceLoading || announceSending}
            sx={{ fontFamily: appleFont, textTransform: 'none', bgcolor: tokens.colors.brandTeal, '&:hover': { bgcolor: tokens.colors.brandTeal700 } }}
          >
            Envoyer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
