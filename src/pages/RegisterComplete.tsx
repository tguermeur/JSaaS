import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/config';
import { tokens } from '../theme/tokens';

const authPaperSx = {
  p: { xs: 2.5, sm: 4 },
  width: '100%',
  maxWidth: 440,
  borderRadius: tokens.radius.md,
  boxShadow: tokens.shadows.lg,
  bgcolor: tokens.colors.marketingWhite,
};

const authButtonSx = {
  borderRadius: tokens.radius.xxl,
  py: 1.5,
  textTransform: 'none' as const,
  fontWeight: 500,
  bgcolor: tokens.colors.marketingBlack,
  color: tokens.colors.marketingWhite,
  boxShadow: 'none',
  '&:hover': {
    bgcolor: tokens.colors.marketingBlack,
    opacity: 0.9,
  },
};

export default function RegisterComplete(): JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [completionData, setCompletionData] = useState<{ email: string; structureId: string; structureName: string } | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError('Session de paiement introuvable.');
      setLoading(false);
      return;
    }
    const fetchData = async (attempt = 0) => {
      const maxRetries = 3;
      const delayMs = (attempt + 1) * 2000;
      try {
        const functions = getFunctions();
        const getSignupCompletionData = httpsCallable<{ sessionId: string }, { email: string; structureId: string; structureName: string }>(
          functions,
          'getSignupCompletionData'
        );
        const { data } = await getSignupCompletionData({ sessionId });
        setCompletionData({ email: data.email, structureId: data.structureId, structureName: data.structureName });
        setLoading(false);
      } catch (err: unknown) {
        const message = (err as { message?: string })?.message ?? '';
        const isNotReady = (err as { code?: string })?.code === 'not-found' || message.includes('pas encore disponibles');
        if (isNotReady && attempt < maxRetries - 1) {
          setTimeout(() => fetchData(attempt + 1), delayMs);
          return;
        }
        setError(message || 'Impossible de récupérer les données. Réessayez dans quelques secondes.');
        setLoading(false);
      }
    };
    fetchData();
  }, [sessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !completionData) return;
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      setError('Le mot de passe doit contenir au moins une lettre majuscule, une lettre minuscule et un chiffre.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const functions = getFunctions();
      const completeSignupAfterPayment = httpsCallable<{ sessionId: string; password: string }, { uid: string; email: string }>(
        functions,
        'completeSignupAfterPayment'
      );
      await completeSignupAfterPayment({ sessionId, password });
      await signInWithEmailAndPassword(auth, completionData.email, password);
      navigate('/app', { replace: true });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      const message = (err as { message?: string })?.message ?? 'Erreur lors de la finalisation du compte.';
      if (code === 'already-exists') {
        setError('Cette adresse email est déjà utilisée. Connectez-vous ou réinitialisez le mot de passe.');
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress sx={{ color: tokens.colors.ink }} />
      </Box>
    );
  }

  if (error && !completionData) {
    return (
      <Paper elevation={0} sx={{ ...authPaperSx, mx: 'auto' }}>
        <Typography variant="h6" gutterBottom sx={{ color: tokens.colors.ink, fontWeight: 600 }}>
          Finalisation de l'inscription
        </Typography>
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
        <Button
          fullWidth
          variant="outlined"
          href="/register?type=structure&plan=premium"
          sx={{
            mt: 2,
            borderRadius: tokens.radius.xxl,
            textTransform: 'none',
            color: tokens.colors.ink,
            borderColor: tokens.colors.ink,
          }}
        >
          Retour à l'inscription
        </Button>
      </Paper>
    );
  }

  if (!completionData) return null;

  return (
    <Paper elevation={0} sx={{ ...authPaperSx, mx: 'auto' }}>
      <Typography variant="h6" gutterBottom sx={{ color: tokens.colors.ink, fontWeight: 600 }}>
        Choisissez votre mot de passe
      </Typography>
      <Typography variant="body2" sx={{ mb: 2, color: tokens.colors.inkMuted }}>
        Paiement réussi. Créez votre mot de passe pour accéder à votre compte {completionData.structureName}.
      </Typography>
      <form onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label="Mot de passe"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          margin="normal"
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: tokens.radius.sm } }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" aria-label="toggle password">
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <TextField
          fullWidth
          label="Confirmer le mot de passe"
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
          margin="normal"
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: tokens.radius.sm } }}
        />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, ...authButtonSx }} disabled={submitting}>
          {submitting ? <CircularProgress size={24} color="inherit" /> : 'Créer mon compte'}
        </Button>
      </form>
    </Paper>
  );
}
