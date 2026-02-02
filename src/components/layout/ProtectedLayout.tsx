import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import Layout from './Layout';
import ChangelogDialog from '../ChangelogDialog';
import ImpersonationBanner from '../common/ImpersonationBanner';
import { useChangelog } from '../../contexts/ChangelogContext';
import { useAuth } from '../../contexts/AuthContext';

const ProtectedLayout: React.FC = () => {
  const { showChangelog, markChangelogAsSeen, loading: changelogLoading } = useChangelog();
  const { isImpersonating } = useAuth();

  return (
    <>
      {/* Bandeau d'impersonation (Run as) */}
      <ImpersonationBanner />
      
      {/* Décaler le contenu si le bandeau est visible */}
      <Box sx={{ pt: isImpersonating ? '48px' : 0 }}>
        <Layout>
          <Outlet />
        </Layout>
      </Box>
      
      {/* Popup de changelog */}
      {!changelogLoading && (
        <ChangelogDialog
          open={showChangelog}
          onClose={markChangelogAsSeen}
        />
      )}
    </>
  );
};

export default ProtectedLayout; 