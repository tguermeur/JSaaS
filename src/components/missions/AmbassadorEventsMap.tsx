import React, { useEffect, useRef, useState } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Mission } from '../../types/mission';
import { LocationOn as LocationIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

declare global {
  interface Window {
    google: any;
    googleMapsScriptLoaded: boolean;
    googleMapsScriptLoading: boolean;
  }
}

// Singleton pour éviter les chargements multiples
let scriptLoadPromise: Promise<void> | null = null;

const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  // Si déjà chargé
  if (window.google && window.google.maps) {
    return Promise.resolve();
  }

  // Si déjà en cours de chargement
  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  // Si le script est déjà dans le DOM
  const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
  if (existingScript) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Timeout après 10 secondes
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.google || !window.google.maps) {
          reject(new Error('Timeout lors du chargement de Google Maps'));
        }
      }, 10000);
    });
    return scriptLoadPromise;
  }

  // Créer et charger le script
  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&language=fr`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      // Attendre un peu pour que Google Maps s'initialise
      setTimeout(() => {
        if (window.google && window.google.maps) {
          window.googleMapsScriptLoaded = true;
          resolve();
        } else {
          reject(new Error('Google Maps API chargée mais non disponible'));
        }
      }, 100);
    };
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error('Erreur lors du chargement de Google Maps API. Vérifiez votre clé API.'));
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
};

export const AmbassadorEventsMap: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowsRef = useRef<any[]>([]);

  const [events, setEvents] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [geocodingInProgress, setGeocodingInProgress] = useState(false);

  const { userData, isContactWithAccess } = useAuth();

  const appleFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  useEffect(() => {
    fetchEvents();
  }, [isContactWithAccess, userData?.companyId, userData?.structureId]);

  useEffect(() => {
    // Récupérer la clé API depuis les variables d'environnement
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    setApiKey(key || null);

    if (!key) {
      console.warn('VITE_GOOGLE_MAPS_API_KEY n\'est pas définie. La carte ne fonctionnera pas.');
      setError('Clé API Google Maps manquante');
      setLoading(false);
      return;
    }

    // Charger le script Google Maps
    loadGoogleMapsScript(key)
      .then(() => {
        setMapLoaded(true);
        setError(null);
      })
      .catch((err) => {
        console.error('Erreur lors du chargement de Google Maps:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (mapLoaded && events.length > 0 && mapRef.current && !mapInstanceRef.current) {
      initializeMap();
    }
  }, [mapLoaded, events]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      
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

      const snapshot = await getDocs(eventsQuery);
      let eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Mission[];
      
      // Pour les contacts avec accès, filtrer aussi côté client au cas où
      if (isContactWithAccess && userData?.companyId) {
        eventsData = eventsData.filter(event => event.companyId === userData.companyId);
      }

      // Géocoder les événements qui n'ont pas de coordonnées
      const eventsToGeocode = eventsData.filter(event => !event.locationCoordinates && event.location);
      if (eventsToGeocode.length > 0 && window.google && window.google.maps) {
        console.log(`${eventsToGeocode.length} événements à géocoder...`);
        setGeocodingInProgress(true);
        const geocoder = new window.google.maps.Geocoder();

        for (const event of eventsToGeocode) {
          try {
            const result = await new Promise<any[]>((resolve, reject) => {
              geocoder.geocode({ address: event.location }, (results, status) => {
                if (status === window.google.maps.GeocoderStatus.OK && results && results[0]) {
                  resolve(results);
                } else {
                  reject(new Error(`Géocodage échoué: ${status}`));
                }
              });
            });

            if (result[0] && result[0].geometry && result[0].geometry.location) {
              const coordinates = {
                lat: result[0].geometry.location.lat(),
                lng: result[0].geometry.location.lng()
              };

              // Mettre à jour l'événement dans Firestore
              await updateDoc(doc(db, 'missions', event.id), {
                locationCoordinates: coordinates
              });

              // Mettre à jour localement
              event.locationCoordinates = coordinates;
              console.log(`Coordonnées ajoutées pour "${event.title}":`, coordinates);
            }
          } catch (geocodeError) {
            console.warn(`Impossible de géocoder "${event.title}":`, geocodeError);
          }
        }
        setGeocodingInProgress(false);
      }

      setEvents(eventsData);
    } catch (err) {
      console.error("Error fetching events:", err);
      setError("Impossible de charger les événements.");
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = () => {
    if (!window.google || !window.google.maps || !mapRef.current) return;

    try {
      // Coordonnées centrales de la France
      const center = { lat: 46.2276, lng: 2.2137 };

      const mapOptions = {
        center,
        zoom: 6,
        styles: [
          {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#e9e9e9' }, { lightness: 17 }]
          },
          {
            featureType: 'landscape',
            elementType: 'geometry',
            stylers: [{ color: '#f5f5f5' }, { lightness: 20 }]
          },
          {
            featureType: 'road.highway',
            elementType: 'geometry.fill',
            stylers: [{ color: '#ffffff' }, { lightness: 17 }]
          },
          {
            featureType: 'road.highway',
            elementType: 'geometry.stroke',
            stylers: [{ color: '#ffffff' }, { lightness: 29 }, { weight: 0.2 }]
          },
          {
            featureType: 'road.arterial',
            elementType: 'geometry',
            stylers: [{ color: '#ffffff' }, { lightness: 18 }]
          },
          {
            featureType: 'road.local',
            elementType: 'geometry',
            stylers: [{ color: '#ffffff' }, { lightness: 16 }]
          },
          {
            featureType: 'poi',
            elementType: 'geometry',
            stylers: [{ color: '#f5f5f5' }, { lightness: 21 }]
          },
          {
            featureType: 'poi.park',
            elementType: 'geometry',
            stylers: [{ color: '#dedede' }, { lightness: 21 }]
          },
          {
            elementType: 'labels.text.stroke',
            stylers: [{ visibility: 'on' }, { color: '#ffffff' }, { lightness: 16 }]
          },
          {
            elementType: 'labels.text.fill',
            stylers: [{ saturation: 36 }, { color: '#333333' }, { lightness: 40 }]
          },
          {
            elementType: 'labels.icon',
            stylers: [{ visibility: 'off' }]
          },
          {
            featureType: 'transit',
            elementType: 'geometry',
            stylers: [{ color: '#f2f2f2' }, { lightness: 19 }]
          },
          {
            featureType: 'administrative',
            elementType: 'geometry.fill',
            stylers: [{ color: '#fefefe' }, { lightness: 20 }]
          },
          {
            featureType: 'administrative',
            elementType: 'geometry.stroke',
            stylers: [{ color: '#fefefe' }, { lightness: 17 }, { weight: 1.2 }]
          }
        ],
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        gestureHandling: 'cooperative'
      };

      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, mapOptions);

      // Nettoyer les marqueurs précédents
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];

      // Nettoyer les info windows précédents
      infoWindowsRef.current.forEach(infoWindow => infoWindow.close());
      infoWindowsRef.current = [];

      // Ajouter les marqueurs pour chaque événement
      events.forEach((event, index) => {
        if (event.locationCoordinates && event.locationCoordinates.lat && event.locationCoordinates.lng) {
          addMarker(event, index);
        }
      });

      // Ajuster automatiquement les bounds pour tous les marqueurs
      if (markersRef.current.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        markersRef.current.forEach(marker => {
          bounds.extend(marker.getPosition());
        });
        mapInstanceRef.current.fitBounds(bounds);

        // Zoom max à 12 pour éviter un zoom trop rapproché
        const listener = window.google.maps.event.addListener(mapInstanceRef.current, 'idle', () => {
          if (mapInstanceRef.current.getZoom() > 12) {
            mapInstanceRef.current.setZoom(12);
          }
          window.google.maps.event.removeListener(listener);
        });
      }

    } catch (err) {
      console.error('Erreur lors de l\'initialisation de la carte:', err);
      setError('Erreur lors de l\'initialisation de la carte');
    }
  };

  const addMarker = (event: Mission, index: number) => {
    if (!mapInstanceRef.current || !event.locationCoordinates) return;

    const totalSlots = event.slots?.length || 0;
    const totalCapacity = event.slots?.reduce((acc, slot) => acc + slot.capacity, 0) || 0;
    const totalRegistered = event.slots?.reduce((acc, slot) => acc + (slot.assignedStudentIds?.length ?? 0), 0) || 0;
    const fillRate = totalCapacity > 0 ? Math.round((totalRegistered / totalCapacity) * 100) : 0;

    // Couleur du marqueur selon le taux de remplissage
    const markerColor = fillRate >= 80 ? '#10b981' : fillRate >= 50 ? '#f59e0b' : '#2563eb';

    // Créer l'icône personnalisée du marqueur
    const markerIcon = {
      path: window.google.maps.SymbolPath.CIRCLE,
      fillColor: markerColor,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      scale: 12
    };

    const marker = new window.google.maps.Marker({
      position: event.locationCoordinates,
      map: mapInstanceRef.current,
      icon: markerIcon,
      title: event.title || event.description,
      animation: window.google.maps.Animation.DROP
    });

    // Formater la date de l'événement
    const formatEventDate = (startDate: any, endDate: any) => {
      if (!startDate) return '';
      const start = new Date(startDate);
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
      let dateStr = start.toLocaleDateString('fr-FR', options);
      if (endDate && endDate !== startDate) {
        const end = new Date(endDate);
        const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
        if (sameMonth) {
          dateStr = `${start.getDate()} - ${end.toLocaleDateString('fr-FR', options)}`;
        } else {
          dateStr = `${dateStr} - ${end.toLocaleDateString('fr-FR', options)}`;
        }
      }
      return dateStr;
    };
    const eventDateStr = formatEventDate(event.startDate, event.endDate);

    // InfoWindow avec les détails de l'événement - Style Apple minimaliste
    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="font-family: ${appleFont}; width: 260px; margin: 0; padding: 0;">
          <div style="padding: 12px 12px 8px 12px;">
            <h4 style="margin: 0 0 4px 0; padding: 0; color: #1d1d1f; font-size: 15px; font-weight: 600; line-height: 1.2;">
              ${event.title || event.description}
            </h4>
            <p style="margin: 0 0 4px 0; padding: 0; color: #86868b; font-size: 12px; line-height: 1.3;">
              ${event.location}
            </p>
            ${eventDateStr ? `<p style="margin: 0; padding: 0; color: #2563eb; font-size: 11px; font-weight: 500;">${eventDateStr}</p>` : ''}
          </div>
          <div style="padding: 8px 12px 12px 12px; background: #f5f5f7; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div>
                <span style="font-size: 16px; font-weight: 600; color: #1d1d1f;">${totalSlots}</span>
                <span style="font-size: 10px; color: #86868b; margin-left: 3px;">créneaux</span>
              </div>
              <div>
                <span style="font-size: 16px; font-weight: 600; color: #2563eb;">${totalRegistered}</span>
                <span style="font-size: 10px; color: #86868b;">/${totalCapacity}</span>
              </div>
            </div>
            <div style="padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; background: ${fillRate >= 80 ? '#d1fae5' : fillRate >= 50 ? '#fef3c7' : '#e0e7ff'}; color: ${fillRate >= 80 ? '#065f46' : fillRate >= 50 ? '#92400e' : '#3730a3'};">${fillRate}%</div>
          </div>
        </div>
      `,
      maxWidth: 280
    });

    // Ouvrir l'info window au clic sur le marqueur
    marker.addListener('click', () => {
      // Fermer les autres info windows
      infoWindowsRef.current.forEach(iw => iw.close());
      // Ouvrir celle-ci
      infoWindow.open(mapInstanceRef.current, marker);
    });

    markersRef.current.push(marker);
    infoWindowsRef.current.push(infoWindow);
  };

  if (loading) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '20px',
        padding: '32px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        border: '1px solid #f3f4f6',
        textAlign: 'center'
      }}>
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
          Chargement de la carte...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '20px',
        padding: '32px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        border: '1px solid #f3f4f6',
        textAlign: 'center'
      }}>
        <LocationIcon sx={{ fontSize: 48, color: '#f59e0b', marginBottom: '16px' }} />
        <h3 style={{
          color: '#111827',
          fontSize: '18px',
          fontWeight: 600,
          fontFamily: appleFont,
          margin: '0 0 8px 0'
        }}>
          Carte non disponible
        </h3>
        <p style={{
          color: '#6b7280',
          fontSize: '14px',
          fontFamily: appleFont,
          margin: 0,
          maxWidth: '400px',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          {error}
        </p>
        {!apiKey && (
          <p style={{
            color: '#f59e0b',
            fontSize: '12px',
            fontFamily: appleFont,
            margin: '8px 0 0 0'
          }}>
            ⚠️ Configurez VITE_GOOGLE_MAPS_API_KEY dans votre .env
          </p>
        )}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '20px',
        padding: '32px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        border: '1px solid #f3f4f6',
        textAlign: 'center'
      }}>
        <LocationIcon sx={{ fontSize: 48, color: '#e5e7eb', marginBottom: '16px' }} />
        <h3 style={{
          color: '#111827',
          fontSize: '18px',
          fontWeight: 600,
          fontFamily: appleFont,
          margin: '0 0 8px 0'
        }}>
          Aucun événement à afficher
        </h3>
        <p style={{
          color: '#6b7280',
          fontSize: '14px',
          fontFamily: appleFont,
          margin: 0
        }}>
          Créez votre premier événement ambassadeur pour le voir sur la carte.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      border: '1px solid #f3f4f6'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <LocationIcon sx={{ fontSize: 24, color: '#2563eb' }} />
        <h3 style={{
          fontSize: '20px',
          fontWeight: 600,
          color: '#111827',
          fontFamily: appleFont,
          margin: 0
        }}>
          Carte des événements
        </h3>
      </div>

      {/* Légende des couleurs */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '24px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#2563eb'
          }}></div>
          <span style={{
            fontSize: '14px',
            color: '#6b7280',
            fontFamily: appleFont
          }}>
            0-49% rempli
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#f59e0b'
          }}></div>
          <span style={{
            fontSize: '14px',
            color: '#6b7280',
            fontFamily: appleFont
          }}>
            50-79% rempli
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#10b981'
          }}></div>
          <span style={{
            fontSize: '14px',
            color: '#6b7280',
            fontFamily: appleFont
          }}>
            80%+ rempli
          </span>
        </div>
      </div>

      {/* Carte Google Maps */}
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '500px',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #e5e7eb'
        }}
      />

      <div style={{
        marginTop: '16px',
        textAlign: 'center'
      }}>
        <p style={{
          fontSize: '14px',
          color: '#6b7280',
          fontFamily: appleFont,
          margin: 0
        }}>
          {events.length} événement{events.length > 1 ? 's' : ''} affiché{events.length > 1 ? 's' : ''}
          {geocodingInProgress && (
            <span style={{ display: 'block', marginTop: '8px', fontSize: '12px', color: '#f59e0b' }}>
              🔄 Géocodage des adresses en cours...
            </span>
          )}
        </p>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};