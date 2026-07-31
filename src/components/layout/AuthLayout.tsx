import React from 'react';
import { Box } from '@mui/material';
import { Outlet, useNavigate } from 'react-router-dom';
import Footer from '../Footer';
import { tokens } from '../../theme/tokens';

export default function AuthLayout(): JSX.Element {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        bgcolor: tokens.colors.marketingWhite,
      }}
    >
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pb: { xs: 8, sm: 10 },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          px: { xs: 1, sm: 2 },
          pt: { xs: 4, sm: 6 },
        }}
      >
        <Box
          component="img"
          src="/images/logo.png"
          alt="JS Connect"
          onClick={() => navigate('/')}
          sx={{
            height: { xs: 36, sm: 44 },
            mb: { xs: 3, sm: 4 },
            cursor: 'pointer',
          }}
        />
        <Outlet />
      </Box>
      <Footer />
    </Box>
  );
}
