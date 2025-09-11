import React from 'react';
import { Outlet } from 'react-router-dom';
import Layout from './Layout';

const ProtectedLayout: React.FC = () => {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

export default ProtectedLayout; 