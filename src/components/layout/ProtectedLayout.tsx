import React from 'react';
import { Box } from '@mui/material';
import Layout from './Layout';
import ChangelogDialog from '../ChangelogDialog';
import OnboardingTutorialDialog from '../OnboardingTutorialDialog';
import ImpersonationBanner from '../common/ImpersonationBanner';
import { useChangelog } from '../../contexts/ChangelogContext';
import { useAuth } from '../../contexts/AuthContext';
import { MissionProvider } from '../../contexts/MissionContext';

const ProtectedLayout: React.FC = () => {
  const { showChangelog, showOnboarding, markChangelogAsSeen, markOnboardingAsSeen, closeOnboardingAndSaveStep, loading: changelogLoading } = useChangelog();
  const { isImpersonating } = useAuth();

  const handleOnboardingClose = (completed: boolean, step?: number) => {
    if (completed) markOnboardingAsSeen();
    else if (typeof step === 'number') closeOnboardingAndSaveStep(step);
  };

  return (
    <>
      {/* Bandeau d'impersonation (Run as) */}
      <ImpersonationBanner />
      
      {/* Décaler le contenu si le bandeau est visible */}
      <Box sx={{ pt: isImpersonating ? '48px' : 0 }}>
        <MissionProvider>
          <Layout />
        </MissionProvider>
      </Box>
      
      {/* Tutoriel onboarding pour les nouveaux comptes (à la place du changelog) */}
      {!changelogLoading && (
        <>
          <OnboardingTutorialDialog
            open={showOnboarding}
            onClose={handleOnboardingClose}
          />
          <ChangelogDialog
            open={showChangelog}
            onClose={markChangelogAsSeen}
          />
        </>
      )}
    </>
  );
};

export default ProtectedLayout; 