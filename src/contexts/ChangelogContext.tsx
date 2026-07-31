import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';

const CURRENT_VERSION = '2.1.0';

// Rôles autorisés à voir le changelog
const ALLOWED_ROLES = ['admin_structure', 'admin', 'membre', 'superadmin'];

interface ChangelogContextType {
  showChangelog: boolean;
  showOnboarding: boolean;
  hasCompletedOnboarding: boolean;
  onboardingStep: number;
  markChangelogAsSeen: () => Promise<void>;
  markOnboardingAsSeen: () => Promise<void>;
  closeOnboardingAndSaveStep: (step: number) => Promise<void>;
  openChangelog: () => void;
  openOnboarding: () => void;
  loading: boolean;
  showInfoButtonHint: boolean;
  infoButtonHintMessage: string;
  hideInfoButtonHint: () => void;
  hasUnseenChangelog: boolean;
}

const ChangelogContext = createContext<ChangelogContextType | undefined>(undefined);

export const ChangelogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showChangelog, setShowChangelog] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showInfoButtonHint, setShowInfoButtonHint] = useState(false);
  const [infoButtonHintMessage, setInfoButtonHintMessage] = useState('Cliquez ici pour revoir les nouveautés');
  const [hasUnseenChangelog, setHasUnseenChangelog] = useState(false);
  const { currentUser, userData } = useAuth();

  useEffect(() => {
    const checkStatus = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      const userRole = userData?.status;
      if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        const data = userDoc.exists() ? userDoc.data() : null;
        const hasSeenOnboarding = data?.hasSeenOnboardingTutorial === true;
        const savedStep = typeof data?.onboardingTutorialStep === 'number' ? data.onboardingTutorialStep : 0;
        const lastSeenVersion = data?.lastSeenChangelogVersion;

        setHasCompletedOnboarding(hasSeenOnboarding);
        setOnboardingStep(Math.min(savedStep, 9));

        // Nouveau compte : afficher le tutoriel d'onboarding à la place du changelog
        if (!hasSeenOnboarding) {
          setShowOnboarding(true);
          setShowChangelog(false);
          setHasUnseenChangelog(false);
        } else if (lastSeenVersion !== CURRENT_VERSION) {
          setShowOnboarding(false);
          setShowChangelog(true);
          setHasUnseenChangelog(true);
        } else {
          setHasUnseenChangelog(false);
        }
      } catch (error) {
        console.error('Erreur lors de la vérification changelog/onboarding:', error);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
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
      setHasUnseenChangelog(false);
      setInfoButtonHintMessage('Cliquez ici pour revoir les nouveautés');
      setTimeout(() => {
        setShowInfoButtonHint(true);
        setTimeout(() => setShowInfoButtonHint(false), 5000);
      }, 500);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du changelog:', error);
      // Fermer quand même la popup même en cas d'erreur
      setShowChangelog(false);
    }
  };

  const markOnboardingAsSeen = async () => {
    if (!currentUser) return;
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        hasSeenOnboardingTutorial: true,
        hasSeenOnboardingTutorialDate: new Date(),
        onboardingTutorialStep: 0
      });
      setHasCompletedOnboarding(true);
      setOnboardingStep(0);
      setShowOnboarding(false);
      setTimeout(() => setShowInfoButtonHint(true), 500);
      setTimeout(() => setShowInfoButtonHint(false), 5000);
    } catch (error) {
      console.error('Erreur lors de la mise à jour onboarding:', error);
      setShowOnboarding(false);
    }
  };

  const closeOnboardingAndSaveStep = async (step: number) => {
    if (!currentUser) return;
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        onboardingTutorialStep: Math.min(step, 9),
        onboardingTutorialStepUpdatedAt: new Date()
      });
      setOnboardingStep(step);
      setShowOnboarding(false);
      setInfoButtonHintMessage('Reprendre ici le tutoriel');
      setTimeout(() => {
        setShowInfoButtonHint(true);
        setTimeout(() => setShowInfoButtonHint(false), 5000);
      }, 500);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de l\'étape du tutoriel:', error);
      setShowOnboarding(false);
    }
  };

  const openChangelog = () => {
    setShowChangelog(true);
    setShowInfoButtonHint(false);
  };

  const openOnboarding = () => {
    setShowOnboarding(true);
    setShowInfoButtonHint(false);
  };

  const hideInfoButtonHint = () => {
    setShowInfoButtonHint(false);
  };

  return (
    <ChangelogContext.Provider
      value={{
        showChangelog,
        showOnboarding,
        hasCompletedOnboarding,
        onboardingStep,
        markChangelogAsSeen,
        markOnboardingAsSeen,
        closeOnboardingAndSaveStep,
        openChangelog,
        openOnboarding,
        loading,
        showInfoButtonHint,
        infoButtonHintMessage,
        hideInfoButtonHint,
        hasUnseenChangelog
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

