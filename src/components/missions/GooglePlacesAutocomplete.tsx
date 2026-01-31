import React, { useEffect, useRef, useState } from 'react';

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (address: string, coordinates?: { lat: number; lng: number }) => void;
  placeholder?: string;
  required?: boolean;
}

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
  if (window.google && window.google.maps && window.google.maps.places) {
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
        if (window.google && window.google.maps && window.google.maps.places) {
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=fr`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      // Attendre un peu pour que Google Maps s'initialise
      setTimeout(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
          window.googleMapsScriptLoaded = true;
          resolve();
        } else {
          // Vérifier si c'est une erreur d'API non activée
          if (window.google && window.google.maps && window.google.maps.Error) {
            reject(new Error('Maps JavaScript API non activée. Activez Maps JavaScript API et Places API dans Google Cloud Console.'));
          } else {
            reject(new Error('Google Maps API chargée mais non disponible'));
          }
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

export const GooglePlacesAutocomplete: React.FC<GooglePlacesAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Rechercher une adresse...",
  required = false
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Récupérer la clé API depuis les variables d'environnement
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    setApiKey(key || null);

    if (!key) {
      console.warn('VITE_GOOGLE_MAPS_API_KEY n\'est pas définie. L\'autocomplétion Google Maps ne fonctionnera pas.');
      return;
    }

    // Charger le script Google Maps
    loadGoogleMapsScript(key)
      .then(() => {
        setIsLoaded(true);
        setError(null);
      })
      .catch((err) => {
        console.error('Erreur lors du chargement de Google Maps:', err);
        // Message d'erreur plus explicite
        let errorMessage = err.message;
        if (err.message.includes('ApiNotActivated') || err.message.includes('not activated')) {
          errorMessage = 'Maps JavaScript API non activée. Activez Maps JavaScript API et Places API dans Google Cloud Console.';
        }
        setError(errorMessage);
        setIsLoaded(false);
      });
  }, []);

  useEffect(() => {
    if (!isLoaded || !inputRef.current || !window.google || !window.google.maps || !window.google.maps.places) {
      return;
    }

    // Nettoyer l'autocomplétion précédente si elle existe
    if (autocompleteRef.current) {
      window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
    }

    try {
      // Initialiser l'autocomplétion
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ['address'],
          componentRestrictions: { country: 'fr' },
          fields: ['formatted_address', 'geometry', 'name']
        }
      );

      // Écouter les changements de sélection
      autocompleteRef.current.addListener('place_changed', () => {
        try {
          const place = autocompleteRef.current.getPlace();
          
          if (place.geometry) {
            const address = place.formatted_address || place.name || '';
            const coordinates = {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            };
            onChange(address, coordinates);
          }
        } catch (err: any) {
          console.error('Erreur lors de la récupération du lieu:', err);
          // Détecter l'erreur ApiNotActivatedMapError
          if (err?.message?.includes('ApiNotActivated') || err?.code === 'ApiNotActivatedMapError') {
            setError('Maps JavaScript API non activée. Activez Maps JavaScript API et Places API dans Google Cloud Console.');
          }
        }
      });

      // Écouter les erreurs globales de Google Maps
      window.google.maps.event.addListenerOnce(window.google.maps, 'error', (error: any) => {
        if (error?.code === 'ApiNotActivatedMapError' || error?.message?.includes('ApiNotActivated')) {
          setError('Maps JavaScript API non activée. Activez Maps JavaScript API et Places API dans Google Cloud Console.');
        }
      });
    } catch (err: any) {
      console.error('Erreur lors de l\'initialisation de l\'autocomplétion:', err);
      if (err?.message?.includes('ApiNotActivated') || err?.code === 'ApiNotActivatedMapError') {
        setError('Maps JavaScript API non activée. Activez Maps JavaScript API et Places API dans Google Cloud Console.');
      } else {
        setError('Erreur lors de l\'initialisation de l\'autocomplétion');
      }
    }

    return () => {
      if (autocompleteRef.current && window.google && window.google.maps) {
        try {
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        } catch (err) {
          // Ignorer les erreurs de nettoyage
        }
      }
    };
  }, [isLoaded, onChange]);

  const appleFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          backgroundColor: '#fafafa',
          fontSize: '15px',
          fontFamily: appleFont,
          outline: 'none',
          transition: 'all 0.2s',
          boxSizing: 'border-box'
        }}
        onFocus={(e) => {
          e.target.style.borderColor = '#2563eb';
          e.target.style.backgroundColor = 'white';
          e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = '#e5e7eb';
          e.target.style.backgroundColor = '#fafafa';
          e.target.style.boxShadow = 'none';
        }}
      />
      {!apiKey && (
        <p style={{
          fontSize: '12px',
          color: '#f59e0b',
          marginTop: '4px',
          fontFamily: appleFont,
          margin: '4px 0 0 0'
        }}>
          ⚠️ Configurez VITE_GOOGLE_MAPS_API_KEY dans votre .env pour activer l'autocomplétion
        </p>
      )}
      {error && apiKey && (
        <p style={{
          fontSize: '12px',
          color: '#ef4444',
          marginTop: '4px',
          fontFamily: appleFont,
          margin: '4px 0 0 0'
        }}>
          ⚠️ {error}. Vérifiez que <strong>Maps JavaScript API</strong> et <strong>Places API</strong> sont activées dans Google Cloud Console.
        </p>
      )}
    </div>
  );
};
