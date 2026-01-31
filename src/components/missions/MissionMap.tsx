import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { LocationOn as LocationIcon } from '@mui/icons-material';

interface MissionMapProps {
  address: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

declare global {
  interface Window {
    google: any;
  }
}

const MissionMap: React.FC<MissionMapProps> = ({ address, coordinates }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapCoordinates, setMapCoordinates] = useState<{ lat: number; lng: number } | null>(
    coordinates && coordinates.lat && coordinates.lng ? coordinates : null
  );

  const appleFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  // Charger l'API Google Maps
  const loadGoogleMapsAPI = async (): Promise<void> => {
    if (window.google && window.google.maps) {
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('Clé API Google Maps manquante');
    }

    // Vérifier si le script est déjà en cours de chargement
    if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&language=fr`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    // Attendre que l'API soit chargée
    let attempts = 0;
    while ((!window.google || !window.google.maps) && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 200));
      attempts++;
    }

    if (!window.google || !window.google.maps) {
      throw new Error("L'API Google Maps n'a pas pu être chargée.");
    }
  };

  // Géocoder une adresse
  const geocodeAddress = async (addr: string): Promise<{ lat: number; lng: number }> => {
    const geocoder = new window.google.maps.Geocoder();
    
    return new Promise((resolve, reject) => {
      geocoder.geocode({ address: addr }, (results: any[], status: string) => {
        if (status === 'OK' && results && results[0]) {
          const location = results[0].geometry.location;
          resolve({ lat: location.lat(), lng: location.lng() });
        } else {
          reject(new Error(`Géocodage échoué: ${status}`));
        }
      });
    });
  };

  useEffect(() => {
    // Si pas d'adresse ni coordonnées, rien à faire
    if (!address && !coordinates) {
      setLoading(false);
      setError('Aucune adresse disponible');
      return;
    }

    const initMap = async () => {
      try {
        setLoading(true);
        setError(null);

        // Charger l'API Google Maps
        await loadGoogleMapsAPI();

        let finalCoordinates = mapCoordinates;

        // Si pas de coordonnées, géocoder l'adresse
        if (!finalCoordinates && address) {
          try {
            finalCoordinates = await geocodeAddress(address);
            setMapCoordinates(finalCoordinates);
          } catch (geocodeErr) {
            console.warn('Géocodage échoué:', geocodeErr);
            // Continuer sans coordonnées - afficher un message
            setError('Impossible de localiser cette adresse sur la carte');
            setLoading(false);
            return;
          }
        }

        if (!finalCoordinates) {
          setError('Aucune coordonnée disponible');
          setLoading(false);
          return;
        }

        if (!mapRef.current) {
          setLoading(false);
          return;
        }

        // Créer la carte avec un style Apple-like
        const map = new window.google.maps.Map(mapRef.current, {
          center: finalCoordinates,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
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
          ]
        });

        // Ajouter un marqueur
        new window.google.maps.Marker({
          map,
          position: finalCoordinates,
          animation: window.google.maps.Animation.DROP,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: '#2563eb',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 10
          }
        });

        setLoading(false);
      } catch (err: any) {
        console.error('Map init error:', err);
        setError(err.message || 'Erreur lors du chargement de la carte');
        setLoading(false);
      }
    };

    initMap();
  }, [address, coordinates]);

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%', 
      position: 'relative',
      bgcolor: '#f5f5f7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '16px',
      overflow: 'hidden'
    }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      
      {loading && (
        <Box sx={{ 
          position: 'absolute', 
          top: 0, left: 0, right: 0, bottom: 0, 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          bgcolor: '#f5f5f7',
          zIndex: 2
        }}>
          <CircularProgress size={28} sx={{ color: '#2563eb', mb: 1 }} />
          <Typography sx={{ fontSize: 13, color: '#86868b', fontFamily: appleFont }}>
            Chargement de la carte...
          </Typography>
        </Box>
      )}

      {error && (
        <Box sx={{ 
          position: 'absolute', 
          top: 0, left: 0, right: 0, bottom: 0, 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          bgcolor: '#f5f5f7',
          p: 3,
          textAlign: 'center',
          zIndex: 2
        }}>
          <LocationIcon sx={{ fontSize: 40, color: '#d1d5db', mb: 1 }} />
          <Typography sx={{ fontSize: 14, color: '#6b7280', fontFamily: appleFont, mb: 1 }}>
            {error}
          </Typography>
          {address && (
            <Typography sx={{ fontSize: 12, color: '#9ca3af', fontFamily: appleFont }}>
              {address}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

export default MissionMap;
