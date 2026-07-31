import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
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
  Checkbox,
  FormControlLabel,
  Snackbar,
} from '@mui/material';
import {
  LocationOn as LocationOnIcon,
  Timer as TimerIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  CheckCircle as CheckCircleIcon,
  Event as EventIcon,
  People as PeopleIcon,
  NavigateBefore as NavigateBeforeIcon,
  NavigateNext as NavigateNextIcon,
} from '@mui/icons-material';
import { collection, query, where, getDocs, getDoc, doc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { registerAmbassadorToSlot } from '../services/missionService';
import MissionMap from '../components/missions/MissionMap';
import { tokens } from '../theme/tokens';
import { dsPageCanvasSx, PortalTopBar } from '../components/ds';
import {
  AmbassadorEventView,
  mapFirestoreToAmbassadorEvent,
  parseSlotTime,
  getSlotAvailableSpots,
  isSlotAvailableForUser,
  getUserRegisteredSlotIds,
  sortSlotsByDate,
} from '../utils/ambassadorEventUtils';
import { MissionSlot } from '../types/mission';

const AUDENCIA_LOGO_URL = '/images/audencia-logo.png';

interface ExtendedUserData {
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  email?: string;
  graduationYear?: string;
  program?: string;
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

interface ApplicationData {
  missionId: string;
  userId: string;
  userEmail: string | null;
  cvUrl: string | null;
  cvUpdatedAt: string | null;
  motivationLetter: string;
  submittedAt: string;
  status: string;
  selectedSlotIds?: string[];
}

function calculateCompletion(data: ExtendedUserData): number {
  const requiredFields = [
    !!data.firstName,
    !!data.lastName,
    !!data.birthDate,
    !!data.email,
    !!data.graduationYear,
    !!data.program,
    !!data.birthPlace,
    !!data.postalCode,
    !!data.gender,
    !!data.nationality,
    !!data.studentId,
    !!data.address,
    !!data.socialSecurityNumber,
    !!data.phone,
    !!data.cvUrl,
  ];
  const filled = requiredFields.filter(Boolean).length;
  return Math.round((filled / requiredFields.length) * 100);
}

function formatSlotLabel(slot: MissionSlot): string {
  const start = parseSlotTime(slot.startTime);
  const end = parseSlotTime(slot.endTime);
  const date = start.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const time = `${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  return `${date} · ${time}`;
}

const AmbassadorMissions: React.FC = () => {
  const { currentUser, userData, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState<AmbassadorEventView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AmbassadorEventView | null>(null);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applicationSuccess, setApplicationSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<ExtendedUserData | null>(null);
  const [incompleteProfileDialogOpen, setIncompleteProfileDialogOpen] = useState(false);
  const [userCV, setUserCV] = useState<{ url: string; updatedAt: Date } | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const fetchEvents = useCallback(async () => {
    if (!currentUser || !userData?.structureId) return;

    try {
      setLoading(true);
      setError(null);

      const eventsQuery = query(
        collection(db, 'missions'),
        where('type', '==', 'ambassadeur_event'),
        where('visibleForAmbassadors', '==', true),
        where('structureId', '==', userData.structureId)
      );

      const snapshot = await getDocs(eventsQuery);
      const list = snapshot.docs.map((docSnap) =>
        mapFirestoreToAmbassadorEvent(docSnap.id, docSnap.data() as Record<string, unknown>)
      );
      setEvents(list);
    } catch (err) {
      console.error('Erreur chargement événements ambassadeur:', err);
      setError('Impossible de charger les événements ambassadeurs.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, userData?.structureId]);

  useEffect(() => {
    if (!currentUser || !userData?.isAmbassador) return;

    const loadProfile = async () => {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const data = userDoc.data() as ExtendedUserData | undefined;
      if (data) setProfileData(data);
      if (data?.cvUrl) {
        setUserCV({ url: data.cvUrl, updatedAt: new Date() });
      }
    };

    loadProfile();
    fetchEvents();
  }, [currentUser, userData?.isAmbassador, fetchEvents]);

  const registeredSlotIds = useMemo(() => {
    if (!selectedEvent || !currentUser) return [];
    return getUserRegisteredSlotIds(selectedEvent.slots, currentUser.uid);
  }, [selectedEvent, currentUser]);

  const hasAnyRegistration = useCallback(
    (event: AmbassadorEventView) => {
      if (!currentUser) return false;
      return getUserRegisteredSlotIds(event.slots, currentUser.uid).length > 0;
    },
    [currentUser]
  );

  const handleOpenEvent = (event: AmbassadorEventView) => {
    const index = events.findIndex((e) => e.id === event.id);
    setCurrentEventIndex(index >= 0 ? index : 0);
    setSelectedEvent(event);
  };

  const handleCloseEvent = () => setSelectedEvent(null);

  const handleNavigateEvent = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? currentEventIndex - 1 : currentEventIndex + 1;
    if (newIndex >= 0 && newIndex < events.length) {
      setCurrentEventIndex(newIndex);
      setSelectedEvent(events[newIndex]);
    }
  };

  const handleApply = () => {
    if (!profileData || !selectedEvent || !currentUser) return;

    if (calculateCompletion(profileData) < 100) {
      setIncompleteProfileDialogOpen(true);
      return;
    }

    const alreadyRegistered = getUserRegisteredSlotIds(selectedEvent.slots, currentUser.uid);
    setSelectedSlotIds([...alreadyRegistered]);
    setSubmitError(null);
    setApplicationSuccess(false);
    setApplyDialogOpen(true);
  };

  const toggleSlotSelection = (slotId: string) => {
    if (registeredSlotIds.includes(slotId)) return;
    setSelectedSlotIds((prev) =>
      prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId]
    );
  };

  const handleSubmitApplication = async () => {
    if (!currentUser || !selectedEvent) return;

    const newSlotIds = selectedSlotIds.filter((id) => !registeredSlotIds.includes(id));
    if (newSlotIds.length === 0) {
      setSubmitError('Sélectionnez au moins un créneau disponible.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      for (const slotId of newSlotIds) {
        await registerAmbassadorToSlot(selectedEvent.id, slotId, currentUser.uid);
      }

      const allSelectedSlotIds = [...registeredSlotIds, ...newSlotIds];

      const existingAppsQuery = query(
        collection(db, 'applications'),
        where('missionId', '==', selectedEvent.id),
        where('userId', '==', currentUser.uid)
      );
      const existingApps = await getDocs(existingAppsQuery);

      if (existingApps.empty) {
        const applicationData: ApplicationData = {
          missionId: selectedEvent.id,
          userId: currentUser.uid,
          userEmail: currentUser.email,
          cvUrl: userCV?.url || null,
          cvUpdatedAt: userCV?.updatedAt ? userCV.updatedAt.toISOString() : null,
          motivationLetter: '',
          submittedAt: new Date().toISOString(),
          status: 'En attente',
          selectedSlotIds: allSelectedSlotIds,
        };
        await addDoc(collection(db, 'applications'), applicationData);
      } else {
        const existingDoc = existingApps.docs[0];
        await updateDoc(doc(db, 'applications', existingDoc.id), {
          selectedSlotIds: allSelectedSlotIds,
          updatedAt: new Date().toISOString(),
        });
      }

      setApplicationSuccess(true);
      await fetchEvents();

      const refreshed = await getDoc(doc(db, 'missions', selectedEvent.id));
      if (refreshed.exists()) {
        setSelectedEvent(mapFirestoreToAmbassadorEvent(refreshed.id, refreshed.data() as Record<string, unknown>));
      }

      setTimeout(() => {
        setApplyDialogOpen(false);
        setApplicationSuccess(false);
        setSelectedSlotIds([]);
      }, 2500);
    } catch (err) {
      console.error('Erreur inscription ambassadeur:', err);
      setSubmitError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress sx={{ color: tokens.colors.brandTeal }} />
      </Box>
    );
  }

  if (!userData?.isAmbassador) {
    return <Navigate to="/app/available-missions" replace />;
  }

  return (
    <Box sx={dsPageCanvasSx}>
      <PortalTopBar
        title="Missions ambassadeurs"
        subtitle="Consultez et inscrivez-vous aux événements du programme ambassadeur."
        eyebrow="Programme ambassadeur"
      />

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', bgcolor: tokens.colors.surfaceAlt }}>
        <Box sx={{ px: 3, py: 3, maxWidth: 1400, mx: 'auto', width: '100%', pb: 4 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: tokens.colors.brandTeal }} />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : events.length === 0 ? (
          <Paper sx={{ p: 4, borderRadius: tokens.radius.xl, textAlign: 'center' }}>
            <EventIcon sx={{ fontSize: 48, color: tokens.colors.gray300, mb: 2 }} />
            <Typography sx={{ fontWeight: 600, color: tokens.colors.gray900, mb: 1 }}>
              Aucun événement disponible
            </Typography>
            <Typography sx={{ color: tokens.colors.gray500, fontSize: 14 }}>
              Revenez plus tard pour découvrir les prochains salons et événements.
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {events.map((event) => (
              <Grid item xs={12} md={6} lg={4} key={event.id}>
                <Paper
                  sx={{
                    p: 3,
                    borderRadius: tokens.radius.xl,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease-in-out',
                    background: 'linear-gradient(135deg, rgba(37, 185, 172, 0.04) 0%, rgba(31, 74, 127, 0.04) 100%)',
                    border: '1px solid rgba(37, 185, 172, 0.25)',
                    height: '100%',
                    minHeight: 240,
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 30px rgba(37, 185, 172, 0.15)',
                    },
                  }}
                  onClick={() => handleOpenEvent(event)}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e3a5f', flex: 1, minWidth: 0, lineHeight: 1.35 }}>
                      {event.title || `Événement #${event.numeroMission}`}
                    </Typography>
                    <Chip
                      label={hasAnyRegistration(event) ? 'Inscrit' : 'Salon / Événement'}
                      size="small"
                      color={hasAnyRegistration(event) ? 'success' : 'default'}
                      sx={{ fontWeight: 600, fontSize: '0.7rem', flexShrink: 0 }}
                    />
                  </Box>
                  {event.studentCount > 0 && (
                    <Chip label={`${event.studentCount} places`} size="small" sx={{ alignSelf: 'flex-start', mb: 2 }} />
                  )}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2, flex: 1, minWidth: 0 }}>
                    {event.location && event.location !== 'À définir' && (
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
                        <LocationOnIcon sx={{ color: '#1F4A7F', fontSize: '1.2rem', mt: 0.25, flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ color: '#4A4A4A', wordBreak: 'break-word' }}>{event.location}</Typography>
                      </Box>
                    )}
                    {event.startDate && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TimerIcon sx={{ color: '#1F4A7F', fontSize: '1.2rem' }} />
                        <Typography variant="body2" sx={{ color: '#4A4A4A' }}>
                          {new Date(event.startDate).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Button endIcon={<ChevronRightIcon />} fullWidth variant="outlined" sx={{ mt: 'auto', textTransform: 'none' }}>
                    Voir les détails
                  </Button>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
        </Box>
      </Box>

      <Drawer
        anchor="right"
        open={!!selectedEvent}
        onClose={handleCloseEvent}
        PaperProps={{
          sx: {
            width: { xs: '100%', md: '720px' },
            maxWidth: '100vw',
            marginTop: '64px',
            height: 'calc(100% - 64px)',
          },
        }}
      >
        {selectedEvent && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 3, borderBottom: `1px solid ${tokens.colors.divider}`, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'nowrap' }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, color: '#1A1A1A', mb: 1, wordBreak: 'break-word' }}>
                  {selectedEvent.title || `Événement #${selectedEvent.numeroMission}`}
                </Typography>
                <Typography sx={{ color: '#2E3B7C', wordBreak: 'break-word' }}>{selectedEvent.location}</Typography>
              </Box>
              <Box
                component="img"
                src={AUDENCIA_LOGO_URL}
                alt="Audencia"
                sx={{ height: 36, maxWidth: 132, objectFit: 'contain', flexShrink: 0 }}
              />
              <IconButton onClick={handleCloseEvent} sx={{ flexShrink: 0 }}><CloseIcon /></IconButton>
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Box sx={{ height: 260, borderRadius: tokens.radius.lg, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)', mb: 3 }}>
                    <MissionMap address={selectedEvent.location} coordinates={selectedEvent.locationCoordinates} />
                  </Box>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Description</Typography>
                  <Typography sx={{ whiteSpace: 'pre-line', color: '#4A4A4A', lineHeight: 1.6, mb: 3 }}>
                    {selectedEvent.announcement || selectedEvent.description}
                  </Typography>

                  {selectedEvent.slots.length > 0 && (
                    <Box>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Créneaux</Typography>
                      <Stack spacing={1}>
                        {sortSlotsByDate(selectedEvent.slots).map((slot) => {
                          const isRegistered = currentUser ? slot.assignedStudentIds?.includes(currentUser.uid) : false;
                          const spots = getSlotAvailableSpots(slot);
                          return (
                            <Box
                              key={slot.id}
                              sx={{
                                p: 1.5,
                                borderRadius: tokens.radius.sm,
                                bgcolor: isRegistered ? 'rgba(37, 185, 172, 0.08)' : 'rgba(46, 59, 124, 0.04)',
                                border: `1px solid ${isRegistered ? 'rgba(37, 185, 172, 0.3)' : 'rgba(46, 59, 124, 0.1)'}`,
                                display: 'flex',
                                flexDirection: { xs: 'column', sm: 'row' },
                                justifyContent: 'space-between',
                                alignItems: { xs: 'flex-start', sm: 'center' },
                                gap: 1.5,
                              }}
                            >
                              <Typography variant="body2" sx={{ fontWeight: 500, color: '#2E3B7C', wordBreak: 'break-word', flex: 1, minWidth: 0 }}>
                                {formatSlotLabel(slot)}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {isRegistered ? (
                                  <Chip icon={<CheckCircleIcon />} label="Inscrit" size="small" color="success" />
                                ) : spots === 0 ? (
                                  <Chip label="Complet" size="small" color="default" />
                                ) : (
                                  <Chip icon={<PeopleIcon />} label={`${spots} place${spots > 1 ? 's' : ''}`} size="small" />
                                )}
                              </Box>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  )}
                </Grid>
              </Grid>
            </Box>

            <Box sx={{ p: 3, borderTop: `1px solid ${tokens.colors.divider}`, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <IconButton onClick={() => handleNavigateEvent('prev')} disabled={currentEventIndex === 0}>
                <NavigateBeforeIcon />
              </IconButton>
              <IconButton onClick={() => handleNavigateEvent('next')} disabled={currentEventIndex >= events.length - 1}>
                <NavigateNextIcon />
              </IconButton>
              <Button onClick={handleCloseEvent} variant="outlined" sx={{ ml: 'auto', textTransform: 'none' }}>
                Fermer
              </Button>
              <Button
                variant="contained"
                onClick={handleApply}
                sx={{
                  textTransform: 'none',
                  bgcolor: tokens.colors.brandTeal,
                  '&:hover': { bgcolor: tokens.colors.brandTeal700 },
                }}
              >
                {hasAnyRegistration(selectedEvent) ? 'Gérer mes créneaux' : 'Postuler'}
              </Button>
            </Box>
          </Box>
        )}
      </Drawer>

      <Dialog open={applyDialogOpen} onClose={() => !isSubmitting && setApplyDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ textAlign: 'center', pt: 3 }}>
          {applicationSuccess ? 'Inscription confirmée' : 'Choisir vos créneaux'}
          {!applicationSuccess && (
            <IconButton onClick={() => setApplyDialogOpen(false)} sx={{ position: 'absolute', right: 16, top: 16 }}>
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 2 }}>
          {applicationSuccess ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckIcon sx={{ fontSize: 48, color: tokens.colors.brandTeal, mb: 2 }} />
              <Typography>Votre inscription a bien été enregistrée.</Typography>
            </Box>
          ) : (
            <>
              <Typography sx={{ mb: 2, color: tokens.colors.gray600, fontSize: 14 }}>
                Sélectionnez un ou plusieurs jours auxquels vous souhaitez participer.
              </Typography>
              <Stack spacing={1}>
                {selectedEvent && sortSlotsByDate(selectedEvent.slots).map((slot) => {
                  const isRegistered = registeredSlotIds.includes(slot.id);
                  const available = currentUser ? isSlotAvailableForUser(slot, currentUser.uid) : false;
                  const disabled = isRegistered || !available;
                  const checked = selectedSlotIds.includes(slot.id);

                  return (
                    <Paper
                      key={slot.id}
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        opacity: disabled && !isRegistered ? 0.6 : 1,
                        borderColor: checked ? tokens.colors.brandTeal : tokens.colors.divider,
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleSlotSelection(slot.id)}
                          />
                        }
                        label={
                          <Box>
                            <Typography sx={{ fontWeight: 500, fontSize: 14 }}>{formatSlotLabel(slot)}</Typography>
                            <Typography sx={{ fontSize: 12, color: tokens.colors.gray500 }}>
                              {isRegistered
                                ? 'Déjà inscrit'
                                : available
                                  ? `${getSlotAvailableSpots(slot)} place${getSlotAvailableSpots(slot) > 1 ? 's' : ''} restante${getSlotAvailableSpots(slot) > 1 ? 's' : ''}`
                                  : 'Complet'}
                              {slot.details ? ` · ${slot.details}` : ''}
                            </Typography>
                          </Box>
                        }
                        sx={{ m: 0, width: '100%' }}
                      />
                    </Paper>
                  );
                })}
              </Stack>
              {submitError && (
                <Alert severity="error" sx={{ mt: 2 }}>{submitError}</Alert>
              )}
            </>
          )}
        </DialogContent>
        {!applicationSuccess && (
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setApplyDialogOpen(false)} disabled={isSubmitting}>Annuler</Button>
            <Button
              variant="contained"
              onClick={handleSubmitApplication}
              disabled={isSubmitting}
              sx={{ bgcolor: tokens.colors.brandTeal, '&:hover': { bgcolor: tokens.colors.brandTeal700 } }}
            >
              {isSubmitting ? 'Inscription...' : 'Confirmer mon inscription'}
            </Button>
          </DialogActions>
        )}
      </Dialog>

      <Dialog open={incompleteProfileDialogOpen} onClose={() => setIncompleteProfileDialogOpen(false)}>
        <DialogTitle>Profil incomplet</DialogTitle>
        <DialogContent>
          <Typography>Veuillez compléter votre profil à 100 % avant de postuler à un événement ambassadeur.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIncompleteProfileDialogOpen(false)}>Fermer</Button>
          <Button variant="contained" onClick={() => { navigate('/app/profile'); setIncompleteProfileDialogOpen(false); }}>
            Compléter mon profil
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={() => setSnackbarOpen(false)} message={snackbarMessage} />
    </Box>
  );
};

export default AmbassadorMissions;
