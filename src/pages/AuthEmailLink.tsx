import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert, Button } from '@mui/material';
import {
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { tokens } from '../theme/tokens';

const EMAIL_STORAGE_KEY = 'emailForSignIn';

const authButtonSx = {
  borderRadius: tokens.radius.xxl,
  textTransform: 'none' as const,
  fontWeight: 500,
  bgcolor: tokens.colors.marketingBlack,
  color: tokens.colors.marketingWhite,
  boxShadow: 'none',
  px: 3,
  py: 1.25,
  '&:hover': {
    bgcolor: tokens.colors.marketingBlack,
    opacity: 0.9,
  },
};

function getEmailFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('email')?.trim();
  if (fromQuery) return fromQuery;
  return window.localStorage.getItem(EMAIL_STORAGE_KEY)?.trim() || '';
}

function mapAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const messages: Record<string, string> = {
    'auth/invalid-action-code': 'Ce lien a déjà été utilisé ou a expiré. Générez-en un nouveau depuis Super Admin.',
    'auth/invalid-email': 'Adresse email invalide pour ce lien.',
    'auth/expired-action-code': 'Lien expiré (validité ~1 h). Générez-en un nouveau.',
    'auth/invalid-api-key': 'Configuration Firebase incorrecte sur ce domaine.',
    'auth/unauthorized-domain': 'Ce domaine n’est pas autorisé dans Firebase Authentication.',
  };
  if (messages[code]) return messages[code];
  if (err instanceof Error && err.message) return err.message;
  return 'Connexion impossible avec ce lien.';
}

/**
 * Finalise une connexion par lien email (magic link).
 * Route minimale (hors AuthLayout) pour limiter les effets de bord pendant la connexion.
 */
export default function AuthEmailLink(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'done'>('loading');
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const completeSignIn = async () => {
      const href = window.location.href;

      if (!isSignInWithEmailLink(auth, href)) {
        const hasOob = searchParams.has('oobCode') && searchParams.get('mode') === 'signIn';
        setError(
          hasOob
            ? 'Lien de connexion incomplet. Ouvrez le lien depuis Super Admin sans le modifier.'
            : 'Lien invalide ou expiré. Demandez un nouveau lien depuis Super Admin.'
        );
        setStatus('error');
        return;
      }

      const email = getEmailFromUrl();
      if (!email) {
        setError('Email manquant dans l’URL. Regénérez le lien depuis Super Admin.');
        setStatus('error');
        return;
      }

      window.localStorage.setItem(EMAIL_STORAGE_KEY, email);

      try {
        localStorage.removeItem('superadmin_impersonation');
        sessionStorage.removeItem('superadmin_impersonation_session');

        if (auth.currentUser) {
          await signOut(auth);
        }

        await signInWithEmailLink(auth, email, href);
        window.localStorage.removeItem(EMAIL_STORAGE_KEY);
        setStatus('done');
        window.location.replace('/app/dashboard');
      } catch (err: unknown) {
        console.error('[AuthEmailLink]', err);
        setError(mapAuthError(err));
        setStatus('error');
      }
    };

    void completeSignIn();
  }, [searchParams]);

  if (status === 'error') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          px: 2,
          gap: 2,
          maxWidth: 480,
          mx: 'auto',
          bgcolor: tokens.colors.marketingWhite,
        }}
      >
        <Box
          component="img"
          src="/images/logo.png"
          alt="JS Connect"
          sx={{ height: 40, mb: 2 }}
        />
        <Alert severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => navigate('/login')} sx={authButtonSx}>
          Retour à la connexion
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2,
        bgcolor: tokens.colors.marketingWhite,
      }}
    >
      <Box
        component="img"
        src="/images/logo.png"
        alt="JS Connect"
        sx={{ height: 40, mb: 1 }}
      />
      <CircularProgress sx={{ color: tokens.colors.ink }} />
      <Typography variant="body1" sx={{ color: tokens.colors.inkMuted }}>
        Connexion en cours…
      </Typography>
    </Box>
  );
}
