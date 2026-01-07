import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useActivityTracker = () => {
  const { currentUser, updateLastActivity } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const updateLastActivityRef = useRef(updateLastActivity);
  const currentUserIdRef = useRef(currentUser?.uid);

  // Mettre à jour les refs quand les valeurs changent
  useEffect(() => {
    updateLastActivityRef.current = updateLastActivity;
    currentUserIdRef.current = currentUser?.uid;
  }, [updateLastActivity, currentUser?.uid]);

  useEffect(() => {
    if (!currentUser) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Mettre à jour immédiatement au montage
    updateLastActivityRef.current();
    lastUpdateRef.current = Date.now();

    // Mettre à jour toutes les 30 secondes
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      // Ne mettre à jour que si au moins 30 secondes se sont écoulées
      if (now - lastUpdateRef.current >= 30000) {
        updateLastActivityRef.current();
        lastUpdateRef.current = now;
      }
    }, 30000);

    // Mettre à jour lors d'interactions utilisateur
    const handleUserActivity = () => {
      const now = Date.now();
      // Throttle : ne mettre à jour que toutes les 30 secondes maximum
      if (now - lastUpdateRef.current >= 30000) {
        updateLastActivityRef.current();
        lastUpdateRef.current = now;
      }
    };

    // Écouter les événements utilisateur
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [currentUser?.uid]); // Dépendre uniquement de l'UID, pas de l'objet complet
};

