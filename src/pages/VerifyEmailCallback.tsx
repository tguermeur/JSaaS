import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Typography
} from '@mui/material';
import { tokens } from '../theme/tokens';

const VerifyEmailCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');
    
    if (mode === 'verifyEmail' && oobCode) {
      navigate(`/verify-email?oobCode=${oobCode}`);
    } else {
      navigate('/login');
    }
  }, [searchParams, navigate]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        gap: 2,
        py: 4,
      }}
    >
      <CircularProgress sx={{ color: tokens.colors.ink }} />
      <Typography variant="body1" sx={{ color: tokens.colors.inkMuted }}>
        Redirection en cours...
      </Typography>
    </Box>
  );
};

export default VerifyEmailCallback;
