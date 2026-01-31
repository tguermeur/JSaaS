import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Mission, MissionSlot } from '../../types/mission';
import { registerAmbassadorToSlot } from '../../services/missionService';
import { useAuth } from '../../contexts/AuthContext';
import { LocationOn as LocationIcon, CheckCircle as CheckCircleIcon, People as PeopleIcon } from '@mui/icons-material';

export const AmbassadorMarketplace: React.FC = () => {
  const { currentUser, userData } = useAuth();
  const [events, setEvents] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const eventsQuery = query(
        collection(db, 'missions'),
        where('type', '==', 'ambassadeur_event'),
        where('visibleForAmbassadors', '==', true),
      );
      
      const snapshot = await getDocs(eventsQuery);
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Mission[];
      
      setEvents(eventsData);
    } catch (err) {
      console.error("Error fetching events:", err);
      setError("Impossible de charger les événements.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (missionId: string, slotId: string) => {
    if (!currentUser) return;
    
    if (!userData?.isAmbassador) {
      alert("Vous devez être identifié comme Ambassadeur pour vous inscrire.");
      return;
    }

    setRegistering(slotId);
    try {
      await registerAmbassadorToSlot(missionId, slotId, currentUser.uid);
      alert("Inscription réussie !");
      fetchEvents();
    } catch (err: any) {
      console.error("Registration error:", err);
      alert(err.message || "Erreur lors de l'inscription.");
    } finally {
      setRegistering(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600 mb-4"></div>
          <p className="text-gray-500 text-lg">Chargement des événements...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block p-4 bg-red-50 rounded-2xl border border-red-100">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {!userData?.isAmbassador && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <p className="text-amber-800 text-sm">
            <strong>Note:</strong> Vous n'avez pas encore le statut Ambassadeur. Contactez votre administrateur pour y accéder.
          </p>
        </div>
      )}

      {events.length === 0 ? (
        <div className="text-center py-24">
          <div className="inline-block p-8 bg-gray-50 rounded-3xl border border-gray-100">
            <p className="text-gray-500 text-lg">Aucun événement disponible pour le moment.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <div 
              key={event.id} 
              className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-lg transition-all duration-300"
              style={{
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-100 bg-gradient-to-br from-gray-50 to-white">
                <div className="flex justify-between items-start mb-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                    {event.campaignName || 'Événement'}
                  </span>
                  <span className="text-xs text-gray-500 font-medium">{event.company}</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3 leading-tight" style={{ letterSpacing: '-0.01em' }}>
                  {event.title || event.description}
                </h3>
                <div className="flex items-center text-sm text-gray-500">
                  <LocationIcon sx={{ fontSize: 18, marginRight: 0.5, color: '#6b7280' }} />
                  <span>{event.location}</span>
                </div>
              </div>

              {/* Slots */}
              <div className="flex-1 p-6 bg-gray-50 overflow-y-auto max-h-96">
                <h4 className="text-xs font-semibold text-gray-700 mb-4 uppercase tracking-wider">
                  Créneaux disponibles
                </h4>
                <div className="space-y-3">
                  {event.slots?.sort((a, b) => {
                    const aStart = a.startTime instanceof Date ? a.startTime : (a.startTime as any).toDate();
                    const bStart = b.startTime instanceof Date ? b.startTime : (b.startTime as any).toDate();
                    return aStart.getTime() - bStart.getTime();
                  }).map((slot) => {
                    const isFull = slot.assignedStudentIds.length >= slot.capacity;
                    const isRegistered = slot.assignedStudentIds.includes(currentUser?.uid || '');
                    const availableSpots = slot.capacity - slot.assignedStudentIds.length;
                    
                    const start = slot.startTime instanceof Date ? slot.startTime : (slot.startTime as any).toDate();
                    const end = slot.endTime instanceof Date ? slot.endTime : (slot.endTime as any).toDate();

                    return (
                      <div 
                        key={slot.id} 
                        className={`p-4 rounded-xl border transition-all ${
                          isRegistered 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 text-sm mb-1">
                              {start.toLocaleDateString('fr-FR', { 
                                weekday: 'short', 
                                day: 'numeric', 
                                month: 'short' 
                              })}
                            </div>
                            <div className="text-xs text-gray-500">
                              {start.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})} - {end.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                            </div>
                          </div>
                          {slot.details && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600">
                              {slot.details}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <PeopleIcon sx={{ fontSize: 16 }} />
                            {isFull ? (
                              <span className="text-red-600 font-semibold">Complet</span>
                            ) : (
                              <span>{availableSpots} place{availableSpots > 1 ? 's' : ''}</span>
                            )}
                          </div>
                          
                          {isRegistered ? (
                            <span className="flex items-center gap-1.5 text-green-600 text-sm font-semibold">
                              <CheckCircleIcon sx={{ fontSize: 18 }} />
                              Inscrit
                            </span>
                          ) : (
                            <button
                              onClick={() => handleRegister(event.id, slot.id)}
                              disabled={isFull || !userData?.isAmbassador || registering === slot.id}
                              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                                isFull || !userData?.isAmbassador
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20'
                              }`}
                            >
                              {registering === slot.id ? '...' : 'Participer'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {(!event.slots || event.slots.length === 0) && (
                    <p className="text-sm text-gray-500 italic text-center py-4">Aucun créneau défini.</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
