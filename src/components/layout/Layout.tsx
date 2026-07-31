import React, { useState } from 'react';
import { Box, styled } from '@mui/material';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { Outlet } from 'react-router-dom';
import Footer from '../Footer';
import { tokens } from '../../theme/tokens';

const ICON_SIDEBAR_WIDTH = `${tokens.layout.sidebarIconW}px`;

const LayoutRoot = styled(Box)({
  display: 'flex',
  minHeight: '100vh',
  height: '100vh',
  backgroundColor: tokens.colors.appBg,
  overflow: 'hidden',
});

const LayoutContent = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  paddingTop: `${tokens.layout.navbarH}px`,
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

const MainContent = styled(Box)({
  backgroundColor: tokens.colors.bgPaper,
  borderRadius: tokens.radius.lg,
  margin: 0,
  padding: 0,
  width: '100%',
  boxShadow: tokens.shadows.sm,
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
});

const ContentWrapper = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  // Une seule zone de scroll : les pages (AppPageShell, etc.) gèrent leur overflow.
  // Évite le « double slide » Layout + contenu.
  overflow: 'hidden',
  minHeight: 0,
}));

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <LayoutRoot>
      <Navbar />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <LayoutContent>
        <MainContent>
          <ContentWrapper>
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Outlet />
            </Box>
          </ContentWrapper>
        </MainContent>
        <Footer variant="inset" />
      </LayoutContent>
    </LayoutRoot>
  );
};

export default Layout;
