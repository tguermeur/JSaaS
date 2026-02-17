import React, { useEffect, useState, useCallback } from 'react';
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
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Mission } from '../types/mission';
import { Document } from '../types/document';
import {
  ArrowBack as ArrowBackIcon,
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
  CheckCircleOutline as CheckCircleOutlineIcon,
  CancelOutlined as CancelOutlinedIcon,
  Transform as TransformIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { TextField, MenuItem, Box, Typography, InputAdornment, Dialog, DialogTitle, DialogContent, DialogActions, Button, Checkbox, FormControlLabel } from '@mui/material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AmbassadorEventForm } from '../components/missions/AmbassadorEventForm';
import { useAuth } from '../contexts/AuthContext';
import { getAmbassadorUsers } from '../services/ambassadorService';
import { registerAmbassadorToSlot } from '../services/missionService';
import { decryptUsersList } from '../utils/decryptUserUtils';

const appleFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

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
  isFromApplication?: boolean; // Pour distinguer les candidatures des inscriptions directes
  applicationId?: string; // ID de la candidature pour pouvoir la mettre à jour
  isDossierValidated?: boolean; // Statut de validation du dossier
}

export const AmbassadorEventDetails: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { userData, isContactWithAccess, contactPermissions } = useAuth();
  const [mission, setMission] = useState<Mission | null>(null);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
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
            });
          }
        }
      }
      studentList.sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''));
      setStudents(studentList);

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
      const docs = docsSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.fileName || 'Sans nom',
          size: data.fileSize || 0,
          type: data.fileName?.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
          url: data.fileUrl || '',
          storagePath: data.fileUrl || '',
          parentFolderId: null,
          uploadedBy: data.createdBy || '',
          uploadedByName: data.uploadedByName,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          structureId: data.structureId || '',
          isRestricted: false,
          missionId: data.missionId,
          missionNumber: data.missionNumber,
          missionTitle: data.missionTitle,
          isPinned: data.isPinned || false,
        } as Document;
      });
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

  const totalCapacity = mission ? getTotalCapacity(mission) : 0;
  const totalRegistered = mission ? getTotalRegistered(mission) : 0;
  const totalPending = students.filter(s => s.status === 'En attente').length;
  const acceptedRate = totalCapacity > 0 ? (totalRegistered / totalCapacity) * 100 : 0;
  const pendingRate = totalCapacity > 0 ? (totalPending / totalCapacity) * 100 : 0;
  const fillRate = Math.round(acceptedRate);

  // Vérifier si l'utilisateur peut modifier l'événement
  const isStructureAdmin = ['admin', 'admin_structure', 'membre', 'superadmin'].includes(userData?.status || '');
  const canEditAsContact = isContactWithAccess && (
    contactPermissions?.canViewEvents || 
    contactPermissions?.canManageAmbassadors
  ) && mission?.companyId === userData?.companyId;
  const canEdit = !!userData?.companyName || isStructureAdmin || canEditAsContact;
  
  // Vérifier spécifiquement si l'utilisateur peut ajouter des ambassadeurs
  // Pour les contacts avec accès, il faut avoir canManageAmbassadors
  const canAddAmbassadors = isStructureAdmin || 
    (isContactWithAccess && contactPermissions?.canManageAmbassadors && mission?.companyId === userData?.companyId);

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
              await updateDoc(doc(db, 'applications', existingApp.id), {
                status: 'Acceptée',
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
      const chargeName = chargeData.displayName || [chargeData.firstName, chargeData.lastName].filter(Boolean).join(' ') || chargeData.email || 'Inconnu';
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

      // Récupérer l'entreprise sauvegardée depuis ambassadorSettings
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

      // Créer la mission standard
      const missionData = {
        numeroMission: missionNumber.trim(),
        company: selectedCompanyName || mission.company || userData?.companyName || 'Organisation inconnue',
        companyId: selectedCompanyId || mission.companyId || '',
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

  const handleUpdateApplicationStatus = async (applicationId: string, newStatus: 'Acceptée' | 'Refusée') => {
    if (!applicationId) return;
    
    try {
      const applicationRef = doc(db, 'applications', applicationId);
      await updateDoc(applicationRef, {
        status: newStatus,
        updatedAt: new Date()
      });

      // Mettre à jour l'état local
      setStudents(prev => prev.map(student => 
        student.applicationId === applicationId 
          ? { ...student, status: newStatus }
          : student
      ));
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut:", error);
      alert("Erreur lors de la mise à jour du statut");
    }
  };


  if (loading) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: '100vh',
          backgroundColor: '#fafafa',
          padding: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-block',
              width: 48,
              height: 48,
              border: '4px solid #f3f4f6',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: 16,
            }}
          />
          <p style={{ color: '#6b7280', fontSize: 16, fontFamily: appleFont, margin: 0 }}>
            Chargement…
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !mission) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: '100vh',
          backgroundColor: '#fafafa',
          padding: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <p style={{ color: '#dc2626', fontFamily: appleFont, marginBottom: 24 }}>
            {error || 'Événement introuvable.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/app/ambassadeurs')}
            style={{
              padding: '12px 24px',
              borderRadius: 12,
              border: 'none',
              backgroundColor: '#2563eb',
              color: 'white',
              fontWeight: 600,
              fontSize: 15,
              fontFamily: appleFont,
              cursor: 'pointer',
            }}
          >
            Retour aux Ambassadeurs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#fafafa',
        padding: '40px 24px 80px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => navigate('/app/ambassadeurs')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 24,
            padding: '10px 16px',
            borderRadius: 12,
            border: 'none',
            backgroundColor: '#f3f4f6',
            color: '#374151',
            fontSize: 15,
            fontWeight: 500,
            fontFamily: appleFont,
            cursor: 'pointer',
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 20 }} /> Retour aux Ambassadeurs
        </button>

        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: 20,
            padding: 32,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            border: '1px solid #f3f4f6',
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 12px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  backgroundColor: '#dbeafe',
                  color: '#1e40af',
                  fontFamily: appleFont,
                }}
              >
                {mission.campaignName || 'Salon'}
              </span>
            </div>
            {canEdit && (
              <div style={{ display: 'flex', gap: 12 }}>
                {/* Bouton "Voir la mission" / "Convertir en mission" - seulement pour les admins, pas pour les contacts avec accès */}
                {!canEditAsContact && (
                  <button
                    type="button"
                    onClick={() => convertedMissionId ? navigate(`/app/mission/${convertedMissionId}`) : setConvertDialogOpen(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 20px',
                      borderRadius: 12,
                      border: '1px solid #10b981',
                      backgroundColor: '#ecfdf5',
                      color: '#059669',
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: appleFont,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#d1fae5';
                      e.currentTarget.style.borderColor = '#047857';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ecfdf5';
                      e.currentTarget.style.borderColor = '#10b981';
                    }}
                  >
                    <TransformIcon sx={{ fontSize: 18 }} />
                    {convertedMissionId ? 'Voir la mission' : 'Convertir en mission'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 20px',
                    borderRadius: 12,
                    border: '1px solid #2563eb',
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: appleFont,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#dbeafe';
                    e.currentTarget.style.borderColor = '#1d4ed8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#eff6ff';
                    e.currentTarget.style.borderColor = '#2563eb';
                  }}
                >
                  <EditIcon sx={{ fontSize: 18 }} />
                  Modifier
                </button>
              </div>
            )}
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: '#111827',
              margin: '0 0 16px 0',
              fontFamily: appleFont,
            }}
          >
            {mission.title || mission.description || 'Sans titre'}
          </h1>
          {mission.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#6b7280', fontSize: 15, fontFamily: appleFont }}>
              <LocationIcon sx={{ fontSize: 20 }} /> {mission.location}
            </div>
          )}
          {mission.startDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', fontSize: 15, fontFamily: appleFont }}>
              <CalendarIcon sx={{ fontSize: 20 }} />
              {format(new Date(mission.startDate), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })} –{' '}
              {mission.endDate ? format(new Date(mission.endDate), 'HH:mm', { locale: fr }) : '—'}
            </div>
          )}

          {/* Horaires jour par jour */}
          {mission.slots && mission.slots.length > 0 && (
            <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #f3f4f6' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 16, fontFamily: appleFont }}>
                Horaires détaillés
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {mission.slots.map((slot, index) => {
                  const toDate = (v: unknown): Date => {
                    if (v == null) return new Date();
                    if (typeof (v as { toDate?: () => Date }).toDate === 'function') return (v as { toDate: () => Date }).toDate();
                    return new Date(v as string | number);
                  };
                  
                  const startDate = slot.startTime instanceof Date ? slot.startTime : toDate(slot.startTime);
                  const endDate = slot.endTime instanceof Date ? slot.endTime : toDate(slot.endTime);
                  const breaks = (slot as any).breaks || [];
                  const dayHours = calculateWorkingHours(
                    startDate.toTimeString().slice(0, 5),
                    endDate.toTimeString().slice(0, 5),
                    breaks
                  );
                  
                  return (
                    <div
                      key={slot.id || index}
                      style={{
                        padding: '16px',
                        backgroundColor: '#fafafa',
                        borderRadius: '12px',
                        border: '1px solid #e5e7eb'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', fontFamily: appleFont }}>
                            Jour {index + 1} - {format(startDate, 'EEEE d MMMM yyyy', { locale: fr })}
                          </div>
                          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4, fontFamily: appleFont }}>
                            {startDate.toTimeString().slice(0, 5)} - {endDate.toTimeString().slice(0, 5)}
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#2563eb', fontFamily: appleFont }}>
                          {dayHours.toFixed(2)}h
                        </div>
                      </div>
                      {breaks.length > 0 && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
                          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, fontFamily: appleFont }}>
                            Pauses:
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {breaks.map((breakItem: any, breakIndex: number) => (
                              <span
                                key={breakIndex}
                                style={{
                                  fontSize: 12,
                                  padding: '4px 8px',
                                  backgroundColor: 'white',
                                  borderRadius: '6px',
                                  border: '1px solid #d1d5db',
                                  color: '#374151',
                                  fontFamily: appleFont
                                }}
                              >
                                {breakItem.start} - {breakItem.end}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 16, padding: '12px 16px', backgroundColor: '#eff6ff', borderRadius: '12px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1e40af', fontFamily: appleFont }}>
                  Total: {mission.slots.reduce((total, slot) => {
                    const toDate = (v: unknown): Date => {
                      if (v == null) return new Date();
                      if (typeof (v as { toDate?: () => Date }).toDate === 'function') return (v as { toDate: () => Date }).toDate();
                      return new Date(v as string | number);
                    };
                    const startDate = slot.startTime instanceof Date ? slot.startTime : toDate(slot.startTime);
                    const endDate = slot.endTime instanceof Date ? slot.endTime : toDate(slot.endTime);
                    const breaks = (slot as any).breaks || [];
                    return total + calculateWorkingHours(
                      startDate.toTimeString().slice(0, 5),
                      endDate.toTimeString().slice(0, 5),
                      breaks
                    );
                  }, 0).toFixed(2)}h
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 24,
              marginTop: 24,
              paddingTop: 24,
              borderTop: '1px solid #f3f4f6',
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, fontFamily: appleFont }}>Capacité</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: '#111827', fontFamily: appleFont }}>{totalCapacity}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, fontFamily: appleFont }}>Acceptés</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: '#2563eb', fontFamily: appleFont }}>{totalRegistered}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, fontFamily: appleFont }}>Taux de remplissage</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    flex: 1,
                    height: 8,
                    backgroundColor: '#f3f4f6',
                    borderRadius: 999,
                    overflow: 'hidden',
                    display: 'flex',
                  }}
                >
                  {/* Partie Validée (Verte) */}
                  <div
                    style={{
                      height: '100%',
                      width: `${acceptedRate}%`,
                      backgroundColor: '#10b981',
                      borderTopLeftRadius: 999,
                      borderBottomLeftRadius: 999,
                      borderTopRightRadius: pendingRate <= 0 ? 999 : 0,
                      borderBottomRightRadius: pendingRate <= 0 ? 999 : 0,
                      transition: 'width 0.3s ease-in-out',
                    }}
                  />
                  {/* Partie En attente (Orange) */}
                  <div
                    style={{
                      height: '100%',
                      width: `${pendingRate}%`,
                      backgroundColor: '#f59e0b',
                      borderTopRightRadius: 999,
                      borderBottomRightRadius: 999,
                      borderTopLeftRadius: acceptedRate <= 0 ? 999 : 0,
                      borderBottomLeftRadius: acceptedRate <= 0 ? 999 : 0,
                      transition: 'width 0.3s ease-in-out',
                    }}
                  />
                </div>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#111827', fontFamily: appleFont }}>{fillRate}%</span>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: 20,
            padding: 32,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            border: '1px solid #f3f4f6',
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: '#111827',
              margin: '0 0 20px 0',
              fontFamily: appleFont,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <PeopleIcon sx={{ fontSize: 24, color: '#2563eb' }} />
            Candidatures et inscriptions ({students.length})
          </h2>
          {canAddAmbassadors && (
            <button
              onClick={() => {
                setAddAmbassadorDialogOpen(true);
                loadAvailableAmbassadors();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 12,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: appleFont,
                marginBottom: 16,
              }}
            >
              <AddIcon sx={{ fontSize: 18 }} />
              Ajouter un ambassadeur
            </button>
          )}
          {students.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: 15, fontFamily: appleFont, margin: 0 }}>
              Aucune candidature pour le moment.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {students.map((s) => {
                const getStatusColor = (status?: string) => {
                  switch (status) {
                    case 'Acceptée':
                      return '#10b981';
                    case 'Refusée':
                      return '#ef4444';
                    case 'En attente':
                      return '#f59e0b';
                    default:
                      return '#6b7280';
                  }
                };

                return (
                <li
                  key={s.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    padding: '16px',
                    borderBottom: '1px solid #f3f4f6',
                    gap: 12,
                    backgroundColor: s.status === 'Acceptée' ? '#f0fdf4' : s.status === 'Refusée' ? '#fef2f2' : '#fffbeb',
                    borderRadius: '8px',
                    marginBottom: '8px'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 600, color: '#111827', fontSize: 15, fontFamily: appleFont }}>
                        {s.displayName || 'Sans nom'}
                      </div>
                      {s.status && (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: 12,
                            backgroundColor: getStatusColor(s.status) + '20',
                            color: getStatusColor(s.status),
                            fontFamily: appleFont,
                          }}
                        >
                          {s.status}
                        </span>
                      )}
                      {/* Statut du dossier */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {s.cvUrl && (
                          <span
                            style={{
                              fontSize: 11,
                              padding: '3px 8px',
                              borderRadius: 8,
                              backgroundColor: s.isDossierValidated ? '#d1fae5' : '#fef3c7',
                              color: s.isDossierValidated ? '#065f46' : '#92400e',
                              fontFamily: appleFont,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            {s.isDossierValidated ? (
                              <>
                                <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />
                                Dossier validé
                              </>
                            ) : (
                              <>
                                <CancelOutlinedIcon sx={{ fontSize: 14 }} />
                                Dossier en attente
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    {s.email && (
                      <div style={{ fontSize: 13, color: '#6b7280', fontFamily: appleFont, marginBottom: 6 }}>
                        {s.email}
                      </div>
                    )}
                    {s.submittedAt && (
                      <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: appleFont, marginTop: 4 }}>
                        Candidature envoyée le {format(s.submittedAt, 'dd MMM yyyy à HH:mm', { locale: fr })}
                      </div>
                    )}
                    {/* Informations sur le dossier */}
                    <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {s.cvUrl && (
                        <a
                          href={s.cvUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 12,
                            color: '#2563eb',
                            textDecoration: 'none',
                            fontFamily: appleFont,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <PdfIcon sx={{ fontSize: 14 }} />
                          Voir le CV
                        </a>
                      )}
                      {s.motivationLetter && s.motivationLetter !== 'Ajouté manuellement' && (
                        <span style={{ fontSize: 12, color: '#6b7280', fontFamily: appleFont }}>
                          Lettre de motivation: {s.motivationLetter.length > 50 ? s.motivationLetter.substring(0, 50) + '...' : s.motivationLetter}
                        </span>
                      )}
                      {s.motivationLetter === 'Ajouté manuellement' && (
                        <span style={{ 
                          fontSize: 11, 
                          color: '#059669', 
                          fontFamily: appleFont,
                          backgroundColor: '#d1fae5',
                          padding: '2px 8px',
                          borderRadius: 6
                        }}>
                          Ajouté manuellement
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Boutons d'action */}
                  {canEdit && s.applicationId && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => handleUpdateApplicationStatus(s.applicationId!, 'Acceptée')}
                          disabled={s.status === 'Acceptée'}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: s.status === 'Acceptée' ? '#d1fae5' : '#10b981',
                            color: s.status === 'Acceptée' ? '#065f46' : 'white',
                            fontSize: 13,
                            fontWeight: 600,
                            fontFamily: appleFont,
                            cursor: s.status === 'Acceptée' ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            transition: 'all 0.2s',
                            opacity: s.status === 'Acceptée' ? 0.7 : 1
                          }}
                          onMouseEnter={(e) => {
                            if (s.status !== 'Acceptée') {
                              e.currentTarget.style.backgroundColor = '#059669';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (s.status !== 'Acceptée') {
                              e.currentTarget.style.backgroundColor = '#10b981';
                            }
                          }}
                        >
                          <CheckCircleIcon sx={{ fontSize: 16 }} />
                          Accepter
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateApplicationStatus(s.applicationId!, 'Refusée')}
                          disabled={s.status === 'Refusée'}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: s.status === 'Refusée' ? '#fee2e2' : '#ef4444',
                            color: s.status === 'Refusée' ? '#991b1b' : 'white',
                            fontSize: 13,
                            fontWeight: 600,
                            fontFamily: appleFont,
                            cursor: s.status === 'Refusée' ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            transition: 'all 0.2s',
                            opacity: s.status === 'Refusée' ? 0.7 : 1
                          }}
                          onMouseEnter={(e) => {
                            if (s.status !== 'Refusée') {
                              e.currentTarget.style.backgroundColor = '#dc2626';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (s.status !== 'Refusée') {
                              e.currentTarget.style.backgroundColor = '#ef4444';
                            }
                          }}
                        >
                          <CancelIcon sx={{ fontSize: 16 }} />
                          Refuser
                        </button>
                      </div>
                    </div>
                  )}
                </li>
                );
              })}
            </ul>
          )}
        </div>

        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: 20,
            padding: 32,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            border: '1px solid #f3f4f6',
          }}
        >
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: '#111827',
              margin: '0 0 20px 0',
              fontFamily: appleFont,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <DescriptionIcon sx={{ fontSize: 24, color: '#2563eb' }} />
            Documents de la mission ({documents.length})
          </h2>
          {documents.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: 15, fontFamily: appleFont, margin: 0 }}>
              Aucun document pour le moment.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {documents.map((d) => (
                <li
                  key={d.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 0',
                    borderBottom: '1px solid #f3f4f6',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    {d.type === 'application/pdf' ? (
                      <PdfIcon sx={{ fontSize: 28, color: '#dc2626' }} />
                    ) : (
                      <FileIcon sx={{ fontSize: 28, color: '#6b7280' }} />
                    )}
                    <span
                      style={{
                        fontSize: 15,
                        color: '#111827',
                        fontFamily: appleFont,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {d.name}
                    </span>
                  </div>
                  {d.url && (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 10,
                        backgroundColor: '#eff6ff',
                        color: '#2563eb',
                        fontSize: 14,
                        fontWeight: 500,
                        fontFamily: appleFont,
                        textDecoration: 'none',
                      }}
                    >
                      <DownloadIcon sx={{ fontSize: 18 }} /> Télécharger
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Dialog de modification */}
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
              borderRadius: '24px',
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
              borderRadius: '24px',
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
                      <AssignmentIcon sx={{ color: '#86868b' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
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
                    return selectedUser?.displayName || '';
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon sx={{ color: '#86868b' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
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
                            backgroundColor: '#0071e3',
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
                      <Typography sx={{ fontFamily: appleFont }}>{charge.displayName}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </div>

            <div style={{
              padding: '16px',
              backgroundColor: '#f0f9ff',
              borderRadius: '12px',
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
                  borderRadius: '12px',
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
                  borderRadius: '12px',
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
            borderRadius: '20px',
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
                        <Typography sx={{ fontFamily: appleFont, fontSize: 14, fontWeight: 500 }}>
                          {ambassador.displayName || 'Sans nom'}
                        </Typography>
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
    </div>
  );
};
