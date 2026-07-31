import React, { useEffect, useState } from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { tokens } from '../../theme/tokens';

const STORAGE_KEY = 'js_connect_cookie_consent';

export function getCookieConsent(): 'accepted' | 'rejected' | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === 'accepted' || v === 'rejected') return v;
  return null;
}

const CookieConsent: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getCookieConsent()) setVisible(true);
  }, []);

  if (!visible) return null;

  const save = (value: 'accepted' | 'rejected') => {
    localStorage.setItem(STORAGE_KEY, value);
    setVisible(false);
    window.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: value }));
  };

  return (
    <Paper
      elevation={8}
      role="dialog"
      aria-labelledby="cookie-consent-title"
      sx={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        maxWidth: 480,
        mx: 'auto',
        zIndex: 10001,
        p: 2.5,
        borderRadius: tokens.radius.lg,
      }}
    >
      <Typography id="cookie-consent-title" variant="subtitle1" fontWeight={600} gutterBottom>
        Cookies et mesure d'audience
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Nous utilisons des cookies analytiques (Google Analytics) pour améliorer JS Connect.{' '}
        <Link to="/politique-confidentialite">En savoir plus</Link>
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="contained" size="small" onClick={() => save('accepted')}>
          Accepter
        </Button>
        <Button variant="outlined" size="small" onClick={() => save('rejected')}>
          Refuser
        </Button>
      </Box>
    </Paper>
  );
};

export default CookieConsent;
