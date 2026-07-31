import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Mission } from '../../types/mission';
import {
  Edit as EditIcon,
  Map as MapIcon,
  List as ListIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CalendarMonth as CalendarMonthIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Place as PlaceIcon,
} from '@mui/icons-material';
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
import { toDateFromFirestore } from '../../utils/dateUtils';
import { Box, Typography, TextField, MenuItem, InputAdornment, IconButton } from '@mui/material';
import { CaeEventCard, CaeKpi } from '../ds';
import { tokens } from '../../theme/tokens';

const appleFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const extractCity = (location?: string): string => {
  if (!location) return '';
  const parts = location.split(',').map((p) => p.trim());
  return parts[parts.length - 1] || location;
};

const getEventStatus = (event: Mission, fillRate: number): string => {
  const now = new Date();
  const endDate = event.endDate ? toDateFromFirestore(event.endDate) : null;
  if (endDate && !isNaN(endDate.getTime()) && endDate < now) return 'Terminé';
  if (fillRate >= 100) return 'Complet';
  return 'Ouvert';
};

const formatEventDateRange = (event: Mission): string => {
  if (!event.startDate) return '—';
  try {
    const startDate = toDateFromFirestore(event.startDate);
    if (isNaN(startDate.getTime())) return '—';
    const start = format(startDate, 'd MMM yyyy', { locale: fr });
    if (event.endDate && event.endDate !== event.startDate) {
      const endDate = toDateFromFirestore(event.endDate);
      if (!isNaN(endDate.getTime())) {
        return `${start} – ${format(endDate, 'd MMM yyyy', { locale: fr })}`;
      }
    }
    return start;
  } catch {
    return '—';
  }
};

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
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();
  const { userData, isContactWithAccess } = useAuth();

  // Charger les candidatures acceptées pour chaque événement
  useEffect(() => {
    // Définir la query pour les événements (utilisée dans loadApplications et onSnapshot)
    // Admins/membres : filtrer par structureId pour respecter les règles Firestore
    let eventsQuery;
    if (isContactWithAccess && userData?.companyId) {
      eventsQuery = query(
        collection(db, 'missions'),
        where('type', '==', 'ambassadeur_event'),
        where('companyId', '==', userData.companyId)
      );
    } else if (userData?.structureId) {
      eventsQuery = query(
        collection(db, 'missions'),
        where('type', '==', 'ambassadeur_event'),
        where('structureId', '==', userData.structureId)
      );
    } else {
      eventsQuery = query(
        collection(db, 'missions'),
        where('type', '==', 'ambassadeur_event')
      );
    }
    
    const loadApplications = async () => {
      try {
        // Ne pas requêter sans structureId pour admin/membre (évite permission-denied)
        if (!isContactWithAccess && userData?.status !== 'superadmin' && !userData?.structureId) {
          setApplicationsByEvent(new Map());
          return;
        }
        const eventsSnapshot = await getDocs(eventsQuery);
        
        const eventIds = eventsSnapshot.docs.map(doc => doc.id);
        
        // Toujours filtrer les applications par missionId (évite permission-denied sur toute la collection)
        let applicationsSnapshot;
        if (eventIds.length > 0) {
          const applicationsQueries: any[] = [];
          for (let i = 0; i < eventIds.length; i += 10) {
            const batch = eventIds.slice(i, i + 10);
            applicationsQueries.push(
              query(collection(db, 'applications'), where('missionId', 'in', batch))
            );
          }
          const applicationsSnapshots = await Promise.all(
            applicationsQueries.map(q => getDocs(q))
          );
          const allApplications: any[] = [];
          applicationsSnapshots.forEach(snapshot => {
            snapshot.docs.forEach(doc => {
              allApplications.push({ id: doc.id, data: doc.data() });
            });
          });
          applicationsSnapshot = {
            docs: allApplications.map((app, idx) => ({
              id: app.id || `temp-${idx}`,
              data: () => app.data
            }))
          } as any;
        } else {
          applicationsSnapshot = { docs: [] } as any;
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
        
        // Récupérer les missions de la structure (évite permission-denied sur toute la collection)
        let allMissionsSnapshot;
        if (isContactWithAccess && userData?.companyId) {
          const allMissionsQuery = query(
            collection(db, 'missions'),
            where('companyId', '==', userData.companyId)
          );
          allMissionsSnapshot = await getDocs(allMissionsQuery);
        } else if (userData?.structureId) {
          const allMissionsQuery = query(
            collection(db, 'missions'),
            where('structureId', '==', userData.structureId)
          );
          allMissionsSnapshot = await getDocs(allMissionsQuery);
        } else if (userData?.status === 'superadmin') {
          const allMissionsQuery = query(collection(db, 'missions'));
          allMissionsSnapshot = await getDocs(allMissionsQuery);
        } else {
          // Admin/membre sans structureId encore chargé : ne pas requêter toute la collection
          allMissionsSnapshot = { docs: [] } as any;
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
    
    // Écouter les événements et recharger les applications à chaque mise à jour
    // (évite onSnapshot sur toute la collection applications, refusé par les règles Firestore)
    const unsubscribeEvents = onSnapshot(eventsQuery, async () => {
      await loadApplications();
    });

    return () => unsubscribeEvents();
  }, [isContactWithAccess, userData?.companyId, userData?.structureId]);

  useEffect(() => {
    // Utiliser onSnapshot pour avoir des mises à jour en temps réel
    // Filtrer par structureId pour les admins (règles Firestore)
    let eventsQuery;
    if (isContactWithAccess && userData?.companyId) {
      eventsQuery = query(
        collection(db, 'missions'),
        where('type', '==', 'ambassadeur_event'),
        where('companyId', '==', userData.companyId)
      );
    } else if (userData?.structureId) {
      eventsQuery = query(
        collection(db, 'missions'),
        where('type', '==', 'ambassadeur_event'),
        where('structureId', '==', userData.structureId)
      );
    } else {
      eventsQuery = query(
        collection(db, 'missions'),
        where('type', '==', 'ambassadeur_event')
      );
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
            eventsData = eventsData.filter(event => event.companyId === userData.companyId);
          }
          
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
  }, [isContactWithAccess, userData?.companyId, userData?.structureId]);

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

  const cities = useMemo(
    () => ['all', ...Array.from(new Set(events.map((e) => extractCity(e.location)).filter(Boolean)))],
    [events],
  );

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const totalCapacity = getTotalCapacity(event);
      const totalRegistered = getTotalRegistered(event);
      const fillRate = totalCapacity > 0 ? Math.round((totalRegistered / totalCapacity) * 100) : 0;
      const status = getEventStatus(event, fillRate);
      const city = extractCity(event.location);
      const haystack = `${event.title || ''} ${event.description || ''} ${event.campaignName || ''} ${event.location || ''}`.toLowerCase();
      const matchesSearch = searchQuery.trim() === '' || haystack.includes(searchQuery.toLowerCase());
      const matchesCity = cityFilter === 'all' || city === cityFilter;
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      return matchesSearch && matchesCity && matchesStatus;
    });
  }, [events, searchQuery, cityFilter, statusFilter, applicationsByEvent]);

  const globalStats = useMemo(() => {
    const totalEvents = events.length;
    const totalSlots = events.reduce((acc, event) => acc + getTotalSlots(event), 0);
    const totalCapacity = events.reduce((acc, event) => acc + getTotalCapacity(event), 0);
    const totalRegistered = events.reduce((acc, event) => acc + getTotalRegistered(event), 0);
    const avgFillRate = totalCapacity > 0 ? Math.round((totalRegistered / totalCapacity) * 100) : 0;
    return { totalEvents, totalSlots, totalCapacity, totalRegistered, avgFillRate };
  }, [events, applicationsByEvent]);

  const statusOptions = ['all', 'Ouvert', 'Complet', 'Terminé'];

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

  const navigateToEvent = (eventId: string) => {
    window.scrollTo(0, 0);
    if (document.body) document.body.scrollTop = 0;
    if (document.documentElement) document.documentElement.scrollTop = 0;
    navigate(`/app/ambassadeurs/event/${eventId}`);
  };

  const filterSelectSx = {
    minWidth: 160,
    '& .MuiOutlinedInput-root': {
      borderRadius: tokens.radius.lg,
      fontSize: 13,
      height: 40,
      bgcolor: tokens.colors.bgPaper,
    },
  };

  return (
    <div>
      {/* Toggle entre vue carte et liste */}
      {events.length > 0 && (
        <Box sx={{
          bgcolor: tokens.colors.bgPaper,
          border: `1px solid ${tokens.colors.divider}`,
          borderRadius: tokens.radius.xl,
          p: 3,
          mb: 3,
          boxShadow: tokens.shadows.sm,
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Box sx={{ display: 'inline-flex', bgcolor: tokens.colors.gray100, borderRadius: tokens.radius.lg, p: 0.5, gap: 0.5 }}>
              {([
                ['list', 'Liste', <ListIcon key="l" sx={{ fontSize: 16 }} />],
                ['map', 'Carte', <MapIcon key="m" sx={{ fontSize: 16 }} />],
                ['calendar', 'Calendrier', <CalendarMonthIcon key="c" sx={{ fontSize: 16 }} />],
              ] as const).map(([id, label, icon]) => (
                <Box
                  key={id}
                  component="button"
                  onClick={() => setViewMode(id)}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2.5,
                    py: 1,
                    border: 'none',
                    borderRadius: tokens.radius.md,
                    bgcolor: viewMode === id ? tokens.colors.bgPaper : 'transparent',
                    color: viewMode === id ? tokens.colors.gray900 : tokens.colors.gray500,
                    fontWeight: viewMode === id ? 600 : 500,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    boxShadow: viewMode === id ? tokens.shadows.sm : 'none',
                    transition: tokens.transitions.fast,
                  }}
                >
                  {icon}{label}
                </Box>
              ))}
            </Box>
          </Box>

          {viewMode === 'list' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 1 }}>
              <CaeKpi label="Événements actifs" value={globalStats.totalEvents} />
              <CaeKpi label="Places disponibles" value={globalStats.totalCapacity} hint="capacité totale" />
              <CaeKpi label="Inscriptions" value={globalStats.totalRegistered} />
              <CaeKpi label="Taux moyen" value={`${globalStats.avgFillRate}%`} hint="remplissage" />
            </Box>
          )}

          {viewMode !== 'calendar' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', mt: viewMode === 'list' ? 2.5 : 0, mb: 2 }}>
              <TextField
                size="small"
                placeholder="Rechercher un salon, une ville…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18, color: tokens.colors.gray400 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ flex: '1 1 260px', maxWidth: 360, '& .MuiOutlinedInput-root': { borderRadius: tokens.radius.lg, height: 40, fontSize: 13 } }}
              />
              <TextField
                select
                size="small"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                sx={filterSelectSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PlaceIcon sx={{ fontSize: 16, color: tokens.colors.gray400 }} />
                    </InputAdornment>
                  ),
                }}
              >
                {cities.map((c) => (
                  <MenuItem key={c} value={c}>{c === 'all' ? 'Toutes les villes' : c}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                sx={filterSelectSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <FilterIcon sx={{ fontSize: 16, color: tokens.colors.gray400 }} />
                    </InputAdornment>
                  ),
                }}
              >
                {statusOptions.map((s) => (
                  <MenuItem key={s} value={s}>{s === 'all' ? 'Tous les statuts' : s}</MenuItem>
                ))}
              </TextField>
              <Typography sx={{ flex: 1, textAlign: 'right', fontSize: 12.5, color: tokens.colors.gray400, fontWeight: 500 }}>
                {filteredEvents.length} salon{filteredEvents.length > 1 ? 's' : ''}
              </Typography>
            </Box>
          )}

          {viewMode === 'map' ? (
            <AmbassadorEventsMap />
          ) : viewMode === 'calendar' ? (
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
                      const startDate = event.startDate ? toDateFromFirestore(event.startDate) : new Date();
                      const endDate = event.endDate
                        ? toDateFromFirestore(event.endDate)
                        : new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
                      
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
          ) : null}
        </Box>
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
        filteredEvents.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: tokens.colors.gray700, mb: 0.5 }}>
              Aucun salon ne correspond
            </Typography>
            <Typography sx={{ fontSize: 13, color: tokens.colors.gray400 }}>
              Ajustez vos filtres pour voir plus de résultats.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
            {filteredEvents.map((event) => {
              const totalCapacity = getTotalCapacity(event);
              const totalRegistered = getTotalRegistered(event);
              const fillRate = totalCapacity > 0 ? Math.round((totalRegistered / totalCapacity) * 100) : 0;
              const status = getEventStatus(event, fillRate);

              return (
                <CaeEventCard
                  key={event.id}
                  title={event.title || event.description || 'Sans titre'}
                  date={formatEventDateRange(event)}
                  location={event.location}
                  status={status}
                  fillPct={fillRate}
                  onView={() => navigateToEvent(event.id)}
                  actions={
                    canEditOrDeleteEvent(event) ? (
                      <>
                        <IconButton
                          size="small"
                          onClick={() => handleToggleVisibility(event)}
                          disabled={togglingVisibilityId === event.id}
                          sx={{ bgcolor: tokens.colors.gray100, width: 30, height: 30 }}
                          title={(event as { visibleForAmbassadors?: boolean }).visibleForAmbassadors ? 'Masquer pour les ambassadeurs' : 'Afficher pour les ambassadeurs'}
                        >
                          {(event as { visibleForAmbassadors?: boolean }).visibleForAmbassadors
                            ? <VisibilityIcon sx={{ fontSize: 16, color: tokens.colors.brandTeal }} />
                            : <VisibilityOffIcon sx={{ fontSize: 16, color: tokens.colors.gray500 }} />}
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleEditEvent(event)}
                          sx={{ bgcolor: tokens.colors.gray100, width: 30, height: 30 }}
                          title="Modifier"
                        >
                          <EditIcon sx={{ fontSize: 16, color: tokens.colors.gray600 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteEvent(event.id, event.title || event.description || '')}
                          disabled={deletingEventId === event.id}
                          sx={{ bgcolor: tokens.colors.errorLight, width: 30, height: 30 }}
                          title="Supprimer"
                        >
                          <DeleteIcon sx={{ fontSize: 16, color: tokens.colors.error }} />
                        </IconButton>
                      </>
                    ) : undefined
                  }
                />
              );
            })}
          </Box>
        )
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
