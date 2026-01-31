import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Mission, MissionSlot } from '../../types/mission';
import { LocationOn as LocationIcon, CalendarToday as CalendarIcon, People as PeopleIcon, Edit as EditIcon, Map as MapIcon, List as ListIcon, Delete as DeleteIcon, Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon, CalendarMonth as CalendarMonthIcon, Schedule as ScheduleIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AmbassadorEventsMap } from './AmbassadorEventsMap';
import { AmbassadorEventForm } from './AmbassadorEventForm';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const appleFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const AmbassadorEventsList: React.FC = () => {
  const [events, setEvents] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'calendar'>('list');
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [togglingVisibilityId, setTogglingVisibilityId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Mission | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [applicationsByEvent, setApplicationsByEvent] = useState<Map<string, number>>(new Map());
  const navigate = useNavigate();
  const { userData, isContactWithAccess } = useAuth();

  // Charger les candidatures acceptées pour chaque événement
  useEffect(() => {
    // Définir la query pour les événements (utilisée dans loadApplications et onSnapshot)
    let eventsQuery;
    if (isContactWithAccess && userData?.companyId) {
      eventsQuery = query(
        collection(db, 'missions'),
        where('type', '==', 'ambassadeur_event'),
        where('companyId', '==', userData.companyId)
      );
    } else {
      eventsQuery = query(
        collection(db, 'missions'),
        where('type', '==', 'ambassadeur_event')
      );
    }
    
    const loadApplications = async () => {
      try {
        const eventsSnapshot = await getDocs(eventsQuery);
        
        // Récupérer les IDs des événements pour filtrer les applications
        const eventIds = eventsSnapshot.docs.map(doc => doc.id);
        
        // Pour les contacts avec accès, filtrer les applications par les missions de leur entreprise
        let applicationsSnapshot;
        if (isContactWithAccess && userData?.companyId && eventIds.length > 0) {
          // Récupérer les applications liées aux événements de leur entreprise
          // Note: Firestore ne supporte pas 'in' avec plus de 10 éléments, donc on doit faire plusieurs requêtes si nécessaire
          const applicationsQueries: any[] = [];
          for (let i = 0; i < eventIds.length; i += 10) {
            const batch = eventIds.slice(i, i + 10);
            applicationsQueries.push(
              query(collection(db, 'applications'), where('missionId', 'in', batch))
            );
          }
          
          // Exécuter toutes les requêtes en parallèle
          const applicationsSnapshots = await Promise.all(
            applicationsQueries.map(q => getDocs(q))
          );
          // Combiner tous les résultats
          const allApplications: any[] = [];
          applicationsSnapshots.forEach(snapshot => {
            snapshot.docs.forEach(doc => {
              allApplications.push({ id: doc.id, data: doc.data() });
            });
          });
          
          // Créer un snapshot factice pour la compatibilité
          applicationsSnapshot = {
            docs: allApplications.map((app, idx) => ({
              id: app.id || `temp-${idx}`,
              data: () => app.data
            }))
          } as any;
        } else if (isContactWithAccess && userData?.companyId && eventIds.length === 0) {
          // Pas d'événements, donc pas d'applications
          applicationsSnapshot = { docs: [] } as any;
        } else {
          // Pour les admins, récupérer toutes les applications
          const applicationsQuery = query(collection(db, 'applications'));
          applicationsSnapshot = await getDocs(applicationsQuery);
        }
        
        // Créer une map des convertedMissionId par eventId
        const convertedMissionsMap = new Map<string, string>();
        const eventTitlesMap = new Map<string, string>();
        
        eventsSnapshot.docs.forEach(eventDoc => {
          const eventData = eventDoc.data();
          const eventId = eventDoc.id;
          const convertedMissionId = (eventData as any).convertedMissionId;
          const title = eventData.title || eventData.campaignName;
          
          if (convertedMissionId) {
            convertedMissionsMap.set(eventId, convertedMissionId);
          }
          if (title) {
            eventTitlesMap.set(eventId, title);
          }
        });
        
        // Récupérer toutes les missions converties avec leurs titres
        // Pour les contacts avec accès, filtrer par companyId
        let allMissionsSnapshot;
        if (isContactWithAccess && userData?.companyId) {
          try {
            const allMissionsQuery = query(
              collection(db, 'missions'),
              where('companyId', '==', userData.companyId)
            );
            allMissionsSnapshot = await getDocs(allMissionsQuery);
          } catch (error: any) {
            // Si la requête échoue (permissions), essayer sans filtre et filtrer côté client
            console.warn('Erreur lors de la requête filtrée, récupération de toutes les missions:', error);
            const allMissionsQuery = query(collection(db, 'missions'));
            const allMissions = await getDocs(allMissionsQuery);
            // Filtrer côté client
            allMissionsSnapshot = {
              docs: allMissions.docs.filter(doc => doc.data().companyId === userData.companyId)
            } as any;
          }
        } else {
          const allMissionsQuery = query(collection(db, 'missions'));
          allMissionsSnapshot = await getDocs(allMissionsQuery);
        }
        const missionsByTitle = new Map<string, string[]>();
        
        allMissionsSnapshot.docs.forEach(missionDoc => {
          const missionData = missionDoc.data();
          if (missionData.type !== 'ambassadeur_event' && missionData.title) {
            const title = missionData.title;
            if (!missionsByTitle.has(title)) {
              missionsByTitle.set(title, []);
            }
            missionsByTitle.get(title)!.push(missionDoc.id);
          }
        });
        
        const acceptedByEvent = new Map<string, number>();
        
        // Compter les candidatures acceptées
        applicationsSnapshot.docs.forEach(doc => {
          const appData = doc.data();
          if (appData.status === 'Acceptée' && appData.missionId) {
            const missionId = appData.missionId;
            
            // Vérifier si cette candidature est liée directement à un événement
            const directEventId = eventsSnapshot.docs.find(e => e.id === missionId)?.id;
            if (directEventId) {
              const current = acceptedByEvent.get(directEventId) || 0;
              acceptedByEvent.set(directEventId, current + 1);
            } else {
              // Vérifier si cette candidature est liée à une mission convertie
              // Chercher l'événement correspondant via convertedMissionId
              for (const [eventId, convertedId] of convertedMissionsMap.entries()) {
                if (convertedId === missionId) {
                  const current = acceptedByEvent.get(eventId) || 0;
                  acceptedByEvent.set(eventId, current + 1);
                  break;
                }
              }
              
              // Si pas trouvé via convertedMissionId, chercher par titre
              const missionDoc = allMissionsSnapshot.docs.find(m => m.id === missionId);
              if (missionDoc) {
                const missionTitle = missionDoc.data().title;
                if (missionTitle) {
                  for (const [eventId, eventTitle] of eventTitlesMap.entries()) {
                    if (eventTitle === missionTitle && !convertedMissionsMap.has(eventId)) {
                      const current = acceptedByEvent.get(eventId) || 0;
                      acceptedByEvent.set(eventId, current + 1);
                      break;
                    }
                  }
                }
              }
            }
          }
        });
        
        setApplicationsByEvent(acceptedByEvent);
      } catch (error) {
        console.error('Erreur lors du chargement des candidatures:', error);
      }
    };

    // Charger les applications une première fois
    loadApplications();
    
    // Pour les contacts avec accès, on ne peut pas utiliser onSnapshot sur toutes les applications
    // car on ne peut pas filtrer efficacement. On va écouter les événements et recharger les applications
    if (isContactWithAccess && userData?.companyId) {
      // Pour les contacts avec accès, recharger les applications quand les événements changent
      const unsubscribeEvents = onSnapshot(eventsQuery, async () => {
        // Recharger les applications quand les événements changent
        await loadApplications();
      });
      return () => unsubscribeEvents();
    }
    
    // Pour les admins, utiliser onSnapshot sur toutes les applications
    const applicationsQuery = query(collection(db, 'applications'));
    const unsubscribeApplications = onSnapshot(
      applicationsQuery,
      async (snapshot) => {
        try {
          // Récupérer les événements à chaque mise à jour (utiliser la même query)
          const eventsSnapshot = await getDocs(eventsQuery);
          
          const convertedMissionsMap = new Map<string, string>();
          const eventTitlesMap = new Map<string, string>();
          
          eventsSnapshot.docs.forEach(eventDoc => {
            const eventData = eventDoc.data();
            const eventId = eventDoc.id;
            const convertedMissionId = (eventData as any).convertedMissionId;
            const title = eventData.title || eventData.campaignName;
            
            if (convertedMissionId) {
              convertedMissionsMap.set(eventId, convertedMissionId);
            }
            if (title) {
              eventTitlesMap.set(eventId, title);
            }
          });
          
          // Pour les contacts avec accès, filtrer par companyId
          let allMissionsSnapshot;
          if (isContactWithAccess && userData?.companyId) {
            try {
              const allMissionsQuery = query(
                collection(db, 'missions'),
                where('companyId', '==', userData.companyId)
              );
              allMissionsSnapshot = await getDocs(allMissionsQuery);
            } catch (error: any) {
              // Si la requête échoue (permissions), essayer sans filtre et filtrer côté client
              console.warn('Erreur lors de la requête filtrée, récupération de toutes les missions:', error);
              const allMissionsQuery = query(collection(db, 'missions'));
              const allMissions = await getDocs(allMissionsQuery);
              // Filtrer côté client
              allMissionsSnapshot = {
                docs: allMissions.docs.filter(doc => doc.data().companyId === userData.companyId)
              } as any;
            }
          } else {
            const allMissionsQuery = query(collection(db, 'missions'));
            allMissionsSnapshot = await getDocs(allMissionsQuery);
          }
          
          const acceptedByEvent = new Map<string, number>();
          
          snapshot.docs.forEach(doc => {
            const appData = doc.data();
            if (appData.status === 'Acceptée' && appData.missionId) {
              const missionId = appData.missionId;
              
              const directEventId = eventsSnapshot.docs.find(e => e.id === missionId)?.id;
              if (directEventId) {
                const current = acceptedByEvent.get(directEventId) || 0;
                acceptedByEvent.set(directEventId, current + 1);
              } else {
                for (const [eventId, convertedId] of convertedMissionsMap.entries()) {
                  if (convertedId === missionId) {
                    const current = acceptedByEvent.get(eventId) || 0;
                    acceptedByEvent.set(eventId, current + 1);
                    break;
                  }
                }
                
                const missionDoc = allMissionsSnapshot.docs.find(m => m.id === missionId);
                if (missionDoc) {
                  const missionTitle = missionDoc.data().title;
                  if (missionTitle) {
                    for (const [eventId, eventTitle] of eventTitlesMap.entries()) {
                      if (eventTitle === missionTitle && !convertedMissionsMap.has(eventId)) {
                        const current = acceptedByEvent.get(eventId) || 0;
                        acceptedByEvent.set(eventId, current + 1);
                        break;
                      }
                    }
                  }
                }
              }
            }
          });
          
          setApplicationsByEvent(acceptedByEvent);
        } catch (error) {
          console.error('Erreur lors de l\'écoute des candidatures:', error);
        }
      },
      (error) => {
        console.error('Erreur lors de l\'écoute des candidatures:', error);
      }
    );

    return () => unsubscribeApplications();
  }, [isContactWithAccess, userData?.companyId]);

  useEffect(() => {
    // Utiliser onSnapshot pour avoir des mises à jour en temps réel
    // Pour les contacts avec accès, filtrer par companyId
    let eventsQuery;
    console.log('🔍 Configuration de la requête événements:', {
      isContactWithAccess,
      companyId: userData?.companyId,
      userStatus: userData?.status
    });
    
    if (isContactWithAccess && userData?.companyId) {
      eventsQuery = query(
        collection(db, 'missions'),
        where('type', '==', 'ambassadeur_event'),
        where('companyId', '==', userData.companyId)
      );
      console.log('✅ Requête filtrée par companyId:', userData.companyId);
    } else {
      eventsQuery = query(
        collection(db, 'missions'),
        where('type', '==', 'ambassadeur_event')
      );
      console.log('✅ Requête sans filtre companyId (admin)');
    }
    
    const unsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        try {
          let eventsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Mission[];
          
          // Pour les contacts avec accès, filtrer côté client si nécessaire
          if (isContactWithAccess && userData?.companyId) {
            const beforeFilter = eventsData.length;
            eventsData = eventsData.filter(event => event.companyId === userData.companyId);
            console.log('🔍 Filtrage côté client:', {
              avant: beforeFilter,
              apres: eventsData.length,
              companyId: userData.companyId
            });
          }
          
          console.log('📅 Événements chargés:', {
            count: eventsData.length,
            isContactWithAccess: !!isContactWithAccess,
            companyId: userData?.companyId,
            events: eventsData.map(e => ({ id: e.id, title: e.title || e.campaignName, companyId: e.companyId }))
          });
          
          setEvents(eventsData);
          setError(null);
        } catch (err) {
          console.error("Error processing events:", err);
          setError("Impossible de charger les événements.");
        } finally {
          setLoading(false);
        }
      },
      (err: any) => {
        console.error("Error fetching events:", err);
        // Si la requête échoue pour un contact avec accès, essayer sans filtre et filtrer côté client
        if (isContactWithAccess && userData?.companyId && err?.code === 'permission-denied') {
          console.warn('⚠️ Requête filtrée échouée, tentative sans filtre...');
          const fallbackQuery = query(
            collection(db, 'missions'),
            where('type', '==', 'ambassadeur_event')
          );
          const fallbackUnsubscribe = onSnapshot(
            fallbackQuery,
            (snapshot) => {
              const allEvents = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as Mission[];
              const filteredEvents = allEvents.filter(event => event.companyId === userData.companyId);
              console.log('✅ Événements chargés avec fallback:', {
                total: allEvents.length,
                filtres: filteredEvents.length,
                companyId: userData.companyId
              });
              setEvents(filteredEvents);
              setError(null);
              setLoading(false);
            },
            (fallbackErr) => {
              console.error("Error fetching events (fallback):", fallbackErr);
              setError("Impossible de charger les événements.");
              setLoading(false);
            }
          );
          return () => fallbackUnsubscribe();
        } else {
          setError("Impossible de charger les événements.");
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [isContactWithAccess, userData?.companyId]);

  const getTotalSlots = (event: Mission) => {
    return event.slots?.length || 0;
  };

  const getTotalCapacity = (event: Mission) => {
    // Utiliser studentCount comme capacité totale (comme dans AmbassadorEventDetails)
    return event.studentCount || 0;
  };

  const getTotalRegistered = (event: Mission) => {
    // Utiliser les candidatures acceptées au lieu des slots (comme dans AmbassadorEventDetails)
    return applicationsByEvent.get(event.id) || 0;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '96px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            display: 'inline-block',
            width: '48px',
            height: '48px',
            border: '4px solid #f3f4f6',
            borderTopColor: '#2563eb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px'
          }}></div>
          <p style={{ color: '#6b7280', fontSize: '16px', fontFamily: appleFont, margin: 0 }}>
            Chargement des événements...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block',
          padding: '16px',
          backgroundColor: '#fef2f2',
          borderRadius: '16px',
          border: '1px solid #fecaca'
        }}>
          <p style={{ color: '#dc2626', margin: 0, fontFamily: appleFont }}>{error}</p>
        </div>
      </div>
    );
  }

  // Calcul des statistiques globales
  const getGlobalStats = () => {
    const totalEvents = events.length;
    const totalSlots = events.reduce((acc, event) => acc + getTotalSlots(event), 0);
    const totalCapacity = events.reduce((acc, event) => acc + getTotalCapacity(event), 0);
    const totalRegistered = events.reduce((acc, event) => acc + getTotalRegistered(event), 0);
    const avgFillRate = totalCapacity > 0 ? Math.round((totalRegistered / totalCapacity) * 100) : 0;

    return {
      totalEvents,
      totalSlots,
      totalCapacity,
      totalRegistered,
      avgFillRate
    };
  };

  // Même règle que l'accès à la page Ambassadeurs : si on peut y accéder, on peut éditer/supprimer.
  // Les événements ambassadeurs n'ont souvent pas companyId/structureId (créés via le formulaire dédié).
  const canEditOrDeleteEvent = (_event: Mission) => {
    const status = userData?.status || '';
    const isStructureAdmin = ['admin', 'admin_structure', 'membre', 'superadmin'].includes(status);
    const isCompany = status === 'entreprise';
    return isStructureAdmin || isCompany;
  };

  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    if (!canEditOrDeleteEvent(event)) {
      alert("Vous n'avez pas les permissions pour supprimer cet événement.");
      return;
    }

    const totalRegistered = getTotalRegistered(event);
    if (totalRegistered > 0) {
      alert(`Impossible de supprimer cet événement car ${totalRegistered} étudiant(s) y sont déjà inscrit(s). Vous devez d'abord annuler toutes les inscriptions.`);
      return;
    }

    const confirmDelete = window.confirm(
      `Êtes-vous sûr de vouloir supprimer l'événement "${eventTitle}" ?\n\nCette action est irréversible.`
    );

    if (!confirmDelete) return;

    setDeletingEventId(eventId);

    try {
      await deleteDoc(doc(db, 'missions', eventId));

      // Mettre à jour la liste localement
      setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId));

      console.log(`Événement "${eventTitle}" supprimé avec succès`);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert("Erreur lors de la suppression de l'événement. Veuillez réessayer.");
    } finally {
      setDeletingEventId(null);
    }
  };

  const handleEditEvent = (event: Mission) => {
    if (!canEditOrDeleteEvent(event)) {
      alert("Vous n'avez pas les permissions pour modifier cet événement.");
      return;
    }
    setEditingEvent(event);
    setEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setEditingEvent(null);
    // Les événements sont mis à jour automatiquement via onSnapshot
  };

  const handleEditClose = () => {
    setEditModalOpen(false);
    setEditingEvent(null);
  };

  const handleToggleVisibility = async (event: Mission) => {
    if (!canEditOrDeleteEvent(event)) return;
    setTogglingVisibilityId(event.id);
    try {
      const next = !(event as any).visibleForAmbassadors;
      await updateDoc(doc(db, 'missions', event.id), { visibleForAmbassadors: next });
      setEvents(prev =>
        prev.map(e => (e.id === event.id ? { ...e, visibleForAmbassadors: next } : e))
      );
    } catch (err) {
      console.error('Erreur visibilité ambassadeur:', err);
    } finally {
      setTogglingVisibilityId(null);
    }
  };

  const globalStats = getGlobalStats();

  return (
    <div>
      {/* Toggle entre vue carte et liste */}
      {events.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          border: '1px solid #f3f4f6',
          marginBottom: '32px'
        }}>
          {/* Boutons de toggle */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '24px'
          }}>
            <div style={{
              display: 'flex',
              backgroundColor: '#f3f4f6',
              borderRadius: '16px',
              padding: '4px',
              gap: '4px'
            }}>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  backgroundColor: viewMode === 'list' ? 'white' : 'transparent',
                  color: viewMode === 'list' ? '#111827' : '#6b7280',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: appleFont,
                  cursor: 'pointer',
                  boxShadow: viewMode === 'list' ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                <ListIcon sx={{ fontSize: 18 }} />
                Liste
              </button>
              <button
                onClick={() => setViewMode('map')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  backgroundColor: viewMode === 'map' ? 'white' : 'transparent',
                  color: viewMode === 'map' ? '#111827' : '#6b7280',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: appleFont,
                  cursor: 'pointer',
                  boxShadow: viewMode === 'map' ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                <MapIcon sx={{ fontSize: 18 }} />
                Carte
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  backgroundColor: viewMode === 'calendar' ? 'white' : 'transparent',
                  color: viewMode === 'calendar' ? '#111827' : '#6b7280',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: appleFont,
                  cursor: 'pointer',
                  boxShadow: viewMode === 'calendar' ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                <CalendarMonthIcon sx={{ fontSize: 18 }} />
                Calendrier
              </button>
            </div>
          </div>

          {/* Contenu selon le mode */}
          {viewMode === 'list' ? (
            /* Statistiques pour la vue liste */
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '32px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '48px',
                  fontWeight: 700,
                  color: '#2563eb',
                  marginBottom: '8px',
                  fontFamily: appleFont
                }}>
                  {globalStats.totalEvents}
                </div>
                <div style={{
                  fontSize: '16px',
                  color: '#6b7280',
                  fontFamily: appleFont,
                  fontWeight: 500
                }}>
                  Événements actifs
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '48px',
                  fontWeight: 700,
                  color: '#f59e0b',
                  marginBottom: '8px',
                  fontFamily: appleFont
                }}>
                  {globalStats.totalCapacity}
                </div>
                <div style={{
                  fontSize: '16px',
                  color: '#6b7280',
                  fontFamily: appleFont,
                  fontWeight: 500
                }}>
                  Places disponibles
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '48px',
                  fontWeight: 700,
                  color: '#dc2626',
                  marginBottom: '8px',
                  fontFamily: appleFont
                }}>
                  {globalStats.totalRegistered}
                </div>
                <div style={{
                  fontSize: '16px',
                  color: '#6b7280',
                  fontFamily: appleFont,
                  fontWeight: 500
                }}>
                  Inscriptions
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '48px',
                  fontWeight: 700,
                  color: globalStats.avgFillRate >= 80 ? '#10b981' : globalStats.avgFillRate >= 50 ? '#f59e0b' : '#2563eb',
                  marginBottom: '8px',
                  fontFamily: appleFont
                }}>
                  {globalStats.avgFillRate}%
                </div>
                <div style={{
                  fontSize: '16px',
                  color: '#6b7280',
                  fontFamily: appleFont,
                  fontWeight: 500
                }}>
                  Taux de remplissage moyen
                </div>
              </div>
            </div>
          ) : viewMode === 'map' ? (
            /* Vue carte */
            <AmbassadorEventsMap />
          ) : (
            /* Vue calendaire */
            <div style={{ marginTop: '16px' }}>
              <div style={{
                backgroundColor: 'white',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 2px 16px rgba(0, 0, 0, 0.08)',
                border: '1px solid #f3f4f6'
              }}>
                <FullCalendar
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  locale={frLocale}
                  headerToolbar={{
                    left: 'today',
                    center: 'prev title next',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                  }}
                  height="auto"
                  contentHeight="auto"
                  dayMaxEvents={true}
                  moreLinkClick="popover"
                  eventDisplay="block"
                  eventTimeFormat={{
                    hour: '2-digit',
                    minute: '2-digit',
                    meridiem: false
                  }}
                  firstDay={1}
                  weekNumbers={false}
                  dayHeaderFormat={{ weekday: 'short' }}
                  buttonText={{
                    today: 'Aujourd\'hui',
                    month: 'Mois',
                    week: 'Semaine',
                    day: 'Jour',
                    prev: '‹',
                    next: '›'
                  }}
                  eventClassNames="fc-event-apple"
                  dayCellClassNames="fc-day-apple"
                  dayHeaderClassNames="fc-day-header-apple"
                  themeSystem="standard"
                events={events.flatMap(event => {
                  // Si l'événement a des slots, créer un seul événement continu du premier au dernier jour
                  if (event.slots && event.slots.length > 0) {
                    // Fonction pour convertir une date
                    const toDate = (v: unknown): Date | null => {
                      if (v == null) return null;
                      if (v instanceof Date) return v;
                      if (typeof (v as { toDate?: () => Date }).toDate === 'function') {
                        return (v as { toDate: () => Date }).toDate();
                      }
                      try {
                        return new Date(v as string | number);
                      } catch {
                        return null;
                      }
                    };

                    // Récupérer toutes les dates de début et fin des slots
                    const allDates: Date[] = [];
                    let hasValidDates = false;

                    for (const slot of event.slots) {
                      const startTime = toDate(slot.startTime);
                      const endTime = toDate(slot.endTime);
                      
                      if (startTime && !isNaN(startTime.getTime())) {
                        allDates.push(startTime);
                        hasValidDates = true;
                      }
                      if (endTime && !isNaN(endTime.getTime())) {
                        allDates.push(endTime);
                        hasValidDates = true;
                      }
                    }

                    if (!hasValidDates) {
                      return null;
                    }

                    // Trouver la date min et max
                    const sortedDates = allDates.sort((a, b) => a.getTime() - b.getTime());
                    const firstDate = sortedDates[0];
                    const lastDate = sortedDates[sortedDates.length - 1];
                    
                    // Pour un événement multi-jours, utiliser la date de début et la date de fin
                    // Extraire uniquement les dates (sans heures) pour créer un événement continu
                    const startDate = new Date(firstDate);
                    startDate.setHours(0, 0, 0, 0);
                    
                    // Pour la date de fin, ajouter 1 jour pour que FullCalendar affiche l'événement jusqu'à la fin du dernier jour
                    const endDate = new Date(lastDate);
                    endDate.setHours(0, 0, 0, 0);
                    endDate.setDate(endDate.getDate() + 1); // Ajouter 1 jour pour que l'événement couvre le dernier jour inclus
                    
                    // Calculer les statistiques globales
                    const totalRegistered = getTotalRegistered(event);
                    const totalCapacity = getTotalCapacity(event);
                    const fillRate = totalCapacity > 0 ? Math.round((totalRegistered / totalCapacity) * 100) : 0;
                    
                    // Couleurs style Apple selon le taux de remplissage
                    const getEventColor = (rate: number) => {
                      if (rate >= 80) {
                        return {
                          backgroundColor: '#34C759',
                          borderColor: '#30D158',
                          textColor: '#ffffff'
                        };
                      } else if (rate >= 50) {
                        return {
                          backgroundColor: '#FF9500',
                          borderColor: '#FF9F0A',
                          textColor: '#ffffff'
                        };
                      } else {
                        return {
                          backgroundColor: '#007AFF',
                          borderColor: '#0051D5',
                          textColor: '#ffffff'
                        };
                      }
                    };
                    
                    const colors = getEventColor(fillRate);
                    
                    // Créer un seul événement continu (allDay pour qu'il s'affiche comme une barre continue)
                    return {
                      id: event.id,
                      title: event.title || event.description || 'Salon',
                      start: startDate.toISOString().split('T')[0], // Format YYYY-MM-DD pour allDay
                      end: endDate.toISOString().split('T')[0], // Format YYYY-MM-DD pour allDay
                      allDay: true, // Événement sur plusieurs jours (barre continue)
                      backgroundColor: colors.backgroundColor,
                      borderColor: colors.borderColor,
                      textColor: colors.textColor,
                      classNames: ['fc-event-apple'],
                      extendedProps: {
                        eventId: event.id,
                        location: event.location,
                        registered: totalRegistered,
                        capacity: totalCapacity,
                        fillRate,
                        slotCount: event.slots.length
                      }
                    };
                  } else {
                    // Si pas de slots, utiliser startDate et endDate
                    try {
                      const startDate = event.startDate ? new Date(event.startDate) : new Date();
                      const endDate = event.endDate ? new Date(event.endDate) : new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
                      
                      // Vérifier que les dates sont valides
                      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                        return null;
                      }
                      
                      const totalRegistered = getTotalRegistered(event);
                      const totalCapacity = getTotalCapacity(event);
                      const fillRate = totalCapacity > 0 ? Math.round((totalRegistered / totalCapacity) * 100) : 0;
                      
                      // Couleurs style Apple selon le taux de remplissage
                      const getEventColor = (rate: number) => {
                        if (rate >= 80) {
                          return {
                            backgroundColor: '#34C759',
                            borderColor: '#30D158',
                            textColor: '#ffffff'
                          };
                        } else if (rate >= 50) {
                          return {
                            backgroundColor: '#FF9500',
                            borderColor: '#FF9F0A',
                            textColor: '#ffffff'
                          };
                        } else {
                          return {
                            backgroundColor: '#007AFF',
                            borderColor: '#0051D5',
                            textColor: '#ffffff'
                          };
                        }
                      };
                      
                      const colors = getEventColor(fillRate);
                      
                      return {
                        id: event.id,
                        title: event.title || event.description,
                        start: startDate.toISOString().split('T')[0],
                        end: endDate.toISOString().split('T')[0],
                        backgroundColor: colors.backgroundColor,
                        borderColor: colors.borderColor,
                        textColor: colors.textColor,
                        classNames: ['fc-event-apple'],
                        extendedProps: {
                          eventId: event.id,
                          location: event.location,
                          registered: totalRegistered,
                          capacity: totalCapacity,
                          fillRate
                        }
                      };
                    } catch (error) {
                      console.error('Erreur lors de la conversion des dates de l\'événement:', error);
                      return null;
                    }
                  }
                }).filter(Boolean)} // Filtrer les null
                eventClick={(info) => {
                  const eventId = info.event.extendedProps.eventId;
                  if (eventId) {
                    // Scroller immédiatement avant la navigation
                    window.scrollTo(0, 0);
                    if (document.body) document.body.scrollTop = 0;
                    if (document.documentElement) document.documentElement.scrollTop = 0;
                    navigate(`/app/ambassadeurs/event/${eventId}`);
                  }
                }}
              />
              </div>
            </div>
          )}
        </div>
      )}

      {events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '96px 0' }}>
          <div style={{
            display: 'inline-block',
            padding: '32px',
            backgroundColor: '#f9fafb',
            borderRadius: '24px',
            border: '1px solid #f3f4f6'
          }}>
            <p style={{ color: '#6b7280', fontSize: '18px', fontFamily: appleFont, margin: 0 }}>
              Aucun événement créé pour le moment.
            </p>
            <p style={{ color: '#9ca3af', fontSize: '14px', fontFamily: appleFont, marginTop: '8px', margin: '8px 0 0 0' }}>
              Créez votre premier événement ambassadeur pour commencer.
            </p>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        <div style={{ display: 'grid', gap: '24px' }}>
          {/* Liste des événements - seulement en mode liste */}
          {events.map((event) => {
            const totalSlots = getTotalSlots(event);
            const totalCapacity = getTotalCapacity(event);
            const totalRegistered = getTotalRegistered(event);
            const fillRate = totalCapacity > 0 ? Math.round((totalRegistered / totalCapacity) * 100) : 0;

            return (
              <div
                key={event.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '20px',
                  padding: '24px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  border: '1px solid #f3f4f6',
                  transition: 'all 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                onClick={() => {
                  // Scroller immédiatement avant la navigation
                  window.scrollTo(0, 0);
                  if (document.body) document.body.scrollTop = 0;
                  if (document.documentElement) document.documentElement.scrollTop = 0;
                  navigate(`/app/ambassadeurs/event/${event.id}`);
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 12px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: '#dbeafe',
                        color: '#1e40af',
                        fontFamily: appleFont
                      }}>
                        {event.campaignName || 'Événement'}
                      </span>
                      {event.company && event.company !== 'Organisation inconnue' && (
                        <span style={{ fontSize: '14px', color: '#6b7280', fontFamily: appleFont }}>
                          {event.company}
                        </span>
                      )}
                    </div>
                    <h3 style={{
                      fontSize: '20px',
                      fontWeight: 600,
                      color: '#111827',
                      marginBottom: '8px',
                      fontFamily: appleFont,
                      margin: 0
                    }}>
                      {event.title || event.description}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '14px', color: '#6b7280', fontFamily: appleFont, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <LocationIcon sx={{ fontSize: 18 }} />
                        <span>{event.location}</span>
                      </div>
                      {event.startDate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ScheduleIcon sx={{ fontSize: 18 }} />
                          <span>
                            {format(new Date(event.startDate), 'd MMM yyyy', { locale: fr })}
                            {event.endDate && event.endDate !== event.startDate && (
                              <> - {format(new Date(event.endDate), 'd MMM yyyy', { locale: fr })}</>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleVisibility(event);
                      }}
                      disabled={togglingVisibilityId === event.id}
                      style={{
                        padding: '8px',
                        backgroundColor: (event as any).visibleForAmbassadors ? '#dbeafe' : '#f3f4f6',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: togglingVisibilityId === event.id ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        opacity: togglingVisibilityId === event.id ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (togglingVisibilityId !== event.id) {
                          e.currentTarget.style.backgroundColor = (event as any).visibleForAmbassadors ? '#bfdbfe' : '#e5e7eb';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (togglingVisibilityId !== event.id) {
                          e.currentTarget.style.backgroundColor = (event as any).visibleForAmbassadors ? '#dbeafe' : '#f3f4f6';
                        }
                      }}
                      title={(event as any).visibleForAmbassadors ? 'Masquer pour les Ambassadeurs (AvailableMissions)' : 'Afficher pour les Ambassadeurs (AvailableMissions)'}
                    >
                      {(event as any).visibleForAmbassadors ? (
                        <VisibilityIcon sx={{ fontSize: 20, color: '#2563eb' }} />
                      ) : (
                        <VisibilityOffIcon sx={{ fontSize: 20, color: '#6b7280' }} />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditEvent(event);
                      }}
                      style={{
                        padding: '8px',
                        backgroundColor: '#f3f4f6',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#e5e7eb';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                      }}
                      title="Modifier l'événement"
                    >
                      <EditIcon sx={{ fontSize: 20, color: '#4b5563' }} />
                    </button>
                    {canEditOrDeleteEvent(event) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEvent(event.id, event.title || event.description);
                        }}
                        disabled={deletingEventId === event.id}
                        style={{
                          padding: '8px',
                          backgroundColor: deletingEventId === event.id ? '#fee2e2' : '#fef2f2',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: deletingEventId === event.id ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          opacity: deletingEventId === event.id ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (deletingEventId !== event.id) {
                            e.currentTarget.style.backgroundColor = '#fecaca';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (deletingEventId !== event.id) {
                            e.currentTarget.style.backgroundColor = '#fef2f2';
                          }
                        }}
                        title="Supprimer l'événement"
                      >
                        <DeleteIcon sx={{
                          fontSize: 20,
                          color: deletingEventId === event.id ? '#dc2626' : '#ef4444'
                        }} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Statistiques */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid #f3f4f6'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <CalendarIcon sx={{ fontSize: 18, color: '#6b7280' }} />
                      <span style={{ fontSize: '14px', color: '#6b7280', fontFamily: appleFont }}>
                        Créneaux
                      </span>
                    </div>
                    <p style={{ fontSize: '20px', fontWeight: 600, color: '#111827', margin: 0, fontFamily: appleFont }}>
                      {totalSlots}
                    </p>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <PeopleIcon sx={{ fontSize: 18, color: '#6b7280' }} />
                      <span style={{ fontSize: '14px', color: '#6b7280', fontFamily: appleFont }}>
                        Capacité totale
                      </span>
                    </div>
                    <p style={{ fontSize: '20px', fontWeight: 600, color: '#111827', margin: 0, fontFamily: appleFont }}>
                      {totalCapacity}
                    </p>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <PeopleIcon sx={{ fontSize: 18, color: '#2563eb' }} />
                      <span style={{ fontSize: '14px', color: '#6b7280', fontFamily: appleFont }}>
                        Inscrits
                      </span>
                    </div>
                    <p style={{ fontSize: '20px', fontWeight: 600, color: '#2563eb', margin: 0, fontFamily: appleFont }}>
                      {totalRegistered}
                    </p>
                  </div>
                  <div>
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', color: '#6b7280', fontFamily: appleFont }}>
                        Taux de remplissage
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        flex: 1,
                        height: '8px',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '999px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${fillRate}%`,
                          backgroundColor: fillRate >= 80 ? '#10b981' : fillRate >= 50 ? '#f59e0b' : '#2563eb',
                          transition: 'width 0.3s ease',
                          borderRadius: '999px'
                        }} />
                      </div>
                      <span style={{ fontSize: '16px', fontWeight: 600, color: '#111827', fontFamily: appleFont, minWidth: '45px' }}>
                        {fillRate}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Afficher la liste seulement si mode liste ET qu'il y a des événements */}
      {viewMode === 'list' && events.length === 0 && (
        <div style={{ textAlign: 'center', padding: '96px 0' }}>
          <div style={{
            display: 'inline-block',
            padding: '32px',
            backgroundColor: '#f9fafb',
            borderRadius: '24px',
            border: '1px solid #f3f4f6'
          }}>
            <p style={{ color: '#6b7280', fontSize: '18px', fontFamily: appleFont, margin: 0 }}>
              Aucun événement créé pour le moment.
            </p>
            <p style={{ color: '#9ca3af', fontSize: '14px', fontFamily: appleFont, marginTop: '8px', margin: '8px 0 0 0' }}>
              Créez votre premier événement ambassadeur pour commencer.
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        /* Styles Apple pour le calendrier */
        .fc {
          font-family: ${appleFont} !important;
          font-size: 14px !important;
        }
        
        .fc-header-toolbar {
          margin-bottom: 24px !important;
          padding-bottom: 16px !important;
          border-bottom: 1px solid #f3f4f6 !important;
        }
        
        /* Forcer les boutons prev/next et le titre à être sur une ligne horizontale */
        .fc-header-toolbar .fc-toolbar-chunk {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
        }
        
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
        }
        
        .fc-prev-button, .fc-next-button {
          display: inline-flex !important;
          vertical-align: middle !important;
        }
        
        .fc-toolbar-title {
          font-size: 24px !important;
          font-weight: 600 !important;
          color: #111827 !important;
          font-family: ${appleFont} !important;
          margin: 0 8px !important;
          display: inline-block !important;
        }
        
        .fc-button {
          background-color: transparent !important;
          border: none !important;
          color: #6b7280 !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          padding: 8px 16px !important;
          border-radius: 10px !important;
          font-family: ${appleFont} !important;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
          box-shadow: none !important;
        }
        
        .fc-button:hover {
          background-color: #f3f4f6 !important;
          color: #111827 !important;
        }
        
        .fc-button:active {
          transform: scale(0.95) !important;
        }
        
        .fc-button-active {
          background-color: #007AFF !important;
          color: white !important;
        }
        
        .fc-button-active:hover {
          background-color: #0051D5 !important;
        }
        
        .fc-button-group {
          gap: 4px !important;
        }
        
        .fc-daygrid-day {
          background-color: white !important;
          transition: background-color 0.2s ease !important;
        }
        
        .fc-day-apple:hover {
          background-color: #f9fafb !important;
        }
        
        .fc-daygrid-day-top {
          padding: 8px !important;
        }
        
        .fc-daygrid-day-number {
          font-size: 15px !important;
          font-weight: 500 !important;
          color: #111827 !important;
          padding: 8px !important;
          font-family: ${appleFont} !important;
        }
        
        .fc-day-today {
          background-color: #f0f9ff !important;
        }
        
        .fc-day-today .fc-daygrid-day-number {
          background-color: #007AFF !important;
          color: white !important;
          border-radius: 8px !important;
          font-weight: 600 !important;
        }
        
        .fc-col-header-cell {
          padding: 12px 8px !important;
          background-color: #f9fafb !important;
          border: none !important;
        }
        
        .fc-col-header-cell-cushion {
          font-size: 13px !important;
          font-weight: 600 !important;
          color: #6b7280 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          font-family: ${appleFont} !important;
        }
        
        .fc-day-header-apple {
          font-weight: 600 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
        }
        
        .fc-daygrid-event {
          border-radius: 8px !important;
          padding: 4px 8px !important;
          margin: 2px 0 !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          border: none !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
          font-family: ${appleFont} !important;
          transition: all 0.2s ease !important;
        }
        
        .fc-event-apple {
          border-radius: 8px !important;
          transition: all 0.2s ease !important;
        }
        
        .fc-event-apple:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15) !important;
        }
        
        .fc-event-title {
          font-weight: 500 !important;
          padding: 0 !important;
        }
        
        .fc-daygrid-day-frame {
          padding: 4px !important;
        }
        
        .fc-scrollgrid {
          border: none !important;
        }
        
        .fc-scrollgrid-section-header > td {
          border: none !important;
        }
        
        .fc-scrollgrid-section > td {
          border: none !important;
          border-right: 1px solid #f3f4f6 !important;
        }
        
        .fc-scrollgrid-section > td:last-child {
          border-right: none !important;
        }
        
        .fc-daygrid-body > tr > td {
          border: none !important;
          border-right: 1px solid #f3f4f6 !important;
          border-bottom: 1px solid #f3f4f6 !important;
        }
        
        .fc-daygrid-body > tr > td:last-child {
          border-right: none !important;
        }
        
        .fc-daygrid-body > tr:last-child > td {
          border-bottom: none !important;
        }
        
        .fc-more-link {
          font-size: 12px !important;
          font-weight: 500 !important;
          color: #007AFF !important;
          font-family: ${appleFont} !important;
          text-decoration: none !important;
        }
        
        .fc-more-link:hover {
          text-decoration: underline !important;
        }
        
        .fc-popover {
          border-radius: 16px !important;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12) !important;
          border: 1px solid #e5e7eb !important;
          font-family: ${appleFont} !important;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        
        .fc-popover-header {
          background-color: #f9fafb !important;
          border-bottom: 1px solid #e5e7eb !important;
          padding: 12px 16px !important;
          border-radius: 16px 16px 0 0 !important;
        }
        
        .fc-popover-title {
          font-size: 14px !important;
          font-weight: 600 !important;
          color: #111827 !important;
          font-family: ${appleFont} !important;
        }
        
        .fc-popover-body {
          padding: 8px !important;
        }
      `}</style>

      {/* Modal d'édition d'événement */}
      {editModalOpen && editingEvent && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            maxWidth: '700px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative'
          }}>
            <div style={{
              position: 'sticky',
              top: 0,
              backgroundColor: 'white',
              padding: '20px 24px 0 24px',
              borderBottom: '1px solid #e5e7eb',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  color: '#111827',
                  fontFamily: appleFont,
                  margin: 0
                }}>
                  Modifier l'événement
                </h2>
                <button
                  onClick={handleEditClose}
                  style={{
                    padding: '8px',
                    backgroundColor: '#f3f4f6',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Fermer"
                >
                  ✕
                </button>
              </div>
            </div>
            <div style={{ padding: '0 24px 24px 24px' }}>
              <AmbassadorEventForm
                initialEvent={editingEvent}
                onSuccess={handleEditSuccess}
                onCancel={handleEditClose}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
