import React from 'react';
import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import Footer from '../Footer';

export default function AuthLayout(): JSX.Element {
  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      minHeight: '100vh'
    }}>
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          pb: 10,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <Outlet />
      </Box>
      <Footer />
    </Box>
  );
} 