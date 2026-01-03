import React, { useState } from 'react';
import { Box, styled } from '@mui/material';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { Outlet } from 'react-router-dom';
import Footer from '../Footer';

const ICON_SIDEBAR_WIDTH = '64px'; // Seule la sidebar gauche est toujours visible

const LayoutRoot = styled(Box)({
  display: 'flex',
  minHeight: '100vh',
  height: '100vh',
  backgroundColor: '#f8f8f8',
  overflow: 'hidden',
});

const LayoutContent = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  paddingTop: '64px',
  marginLeft: ICON_SIDEBAR_WIDTH,
  marginRight: theme.spacing(1),
  marginTop: theme.spacing(1),
  marginBottom: theme.spacing(1),
  width: `calc(100vw - ${ICON_SIDEBAR_WIDTH} - ${theme.spacing(2)})`,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  position: 'relative',
  zIndex: 0,
}));

const MainContent = styled(Box)(({ theme }) => ({
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  margin: 0,
  padding: 0,
  width: '100%',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
}));

const ContentWrapper = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'auto',
  minHeight: 0,
}));

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <LayoutRoot>
      <Navbar />
      <Sidebar 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
      />
      <LayoutContent>
        <MainContent>
          <ContentWrapper>
            <Outlet />
          </ContentWrapper>
        </MainContent>
        <Footer />
      </LayoutContent>
    </LayoutRoot>
  );
};

export default Layout; 