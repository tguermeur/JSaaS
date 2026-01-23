import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';

const CURRENT_VERSION = '2.0.0';

// Rôles autorisés à voir le changelog
const ALLOWED_ROLES = ['admin_structure', 'admin', 'membre', 'superadmin'];

interface ChangelogContextType {
  showChangelog: boolean;
  markChangelogAsSeen: () => Promise<void>;
  openChangelog: () => void;
  loading: boolean;
  showInfoButtonHint: boolean;
  hideInfoButtonHint: () => void;
}

const ChangelogContext = createContext<ChangelogContextType | undefined>(undefined);

export const ChangelogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showChangelog, setShowChangelog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showInfoButtonHint, setShowInfoButtonHint] = useState(false);
  const { currentUser, userData } = useAuth();

  useEffect(() => {
    const checkChangelogStatus = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      // Vérifier le rôle de l'utilisateur
      const userRole = userData?.status;
      if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
        // Utilisateur non autorisé (etudiant ou entreprise)
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const lastSeenVersion = userData.lastSeenChangelogVersion;

          // Si l'utilisateur n'a pas vu cette version, afficher la popup
          if (lastSeenVersion !== CURRENT_VERSION) {
            setShowChangelog(true);
          }
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du changelog:', error);
      } finally {
        setLoading(false);
      }
    };

    checkChangelogStatus();
  }, [currentUser, userData]);

  const markChangelogAsSeen = async () => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        lastSeenChangelogVersion: CURRENT_VERSION,
        lastSeenChangelogDate: new Date()
      });
      setShowChangelog(false);
      
      // Afficher l'animation du bouton "i" après 500ms
      setTimeout(() => {
        setShowInfoButtonHint(true);
        // Masquer automatiquement après 5 secondes
        setTimeout(() => {
          setShowInfoButtonHint(false);
        }, 5000);
      }, 500);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du changelog:', error);
      // Fermer quand même la popup même en cas d'erreur
      setShowChangelog(false);
    }
  };

  const openChangelog = () => {
    setShowChangelog(true);
    setShowInfoButtonHint(false); // Masquer le hint si on rouvre
  };

  const hideInfoButtonHint = () => {
    setShowInfoButtonHint(false);
  };

  return (
    <ChangelogContext.Provider
      value={{
        showChangelog,
        markChangelogAsSeen,
        openChangelog,
        loading,
        showInfoButtonHint,
        hideInfoButtonHint
      }}
    >
      {children}
    </ChangelogContext.Provider>
  );
};

export const useChangelog = () => {
  const context = useContext(ChangelogContext);
  if (context === undefined) {
    throw new Error('useChangelog must be used within a ChangelogProvider');
  }
  return context;
};

