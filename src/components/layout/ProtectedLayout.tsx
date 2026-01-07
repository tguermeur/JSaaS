import React from 'react';
import { Outlet } from 'react-router-dom';
import Layout from './Layout';
import ChangelogDialog from '../ChangelogDialog';
import { useChangelog } from '../../contexts/ChangelogContext';

const ProtectedLayout: React.FC = () => {
  const { showChangelog, markChangelogAsSeen, loading: changelogLoading } = useChangelog();

  return (
    <>
      <Layout>
        <Outlet />
      </Layout>
      
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