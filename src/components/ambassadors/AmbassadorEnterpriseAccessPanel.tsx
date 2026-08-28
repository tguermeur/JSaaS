import { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Paper,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { subscribeToAmbassadorEnterpriseAccess } from '../../services/ambassadorEnterpriseAccessService';
import { SettingsPanel } from '../ds';
import { tokens } from '../../theme/tokens';

export interface AmbassadorEnterpriseAccessState {
  active?: boolean;
  status?: string;
  currentPeriodEnd?: { toDate?: () => Date } | Date;
}

interface AmbassadorEnterpriseAccessPanelProps {
  structureId: string;
  userId: string;
  ambassadorEnterpriseAccess: AmbassadorEnterpriseAccessState | null;
  variant?: 'settings' | 'embedded';
}

export function AmbassadorEnterpriseAccessPanel({
  structureId,
  userId,
  ambassadorEnterpriseAccess,
  variant = 'settings',
}: AmbassadorEnterpriseAccessPanelProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  const accessActive = ambassadorEnterpriseAccess?.active === true;
  const periodEnd = ambassadorEnterpriseAccess?.currentPeriodEnd;
  const periodEndDate =
    periodEnd instanceof Date ? periodEnd : periodEnd?.toDate?.() ?? null;

  const handleSubscribe = async () => {
    try {
      setLoadingCheckout(true);
      await subscribeToAmbassadorEnterpriseAccess(structureId, userId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de la création de la session de paiement';
      enqueueSnackbar(message, { variant: 'error' });
      setLoadingCheckout(false);
    }
  };

  const content = (
    <Box sx={{ textAlign: variant === 'settings' ? 'center' : 'left' }}>
      <Chip
        label={accessActive ? 'Add-on actif' : 'Add-on inactif'}
        color={accessActive ? 'success' : 'default'}
        size="small"
        sx={{ fontWeight: 500, mb: 2 }}
      />
      {accessActive && periodEndDate && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Prochaine échéance :{' '}
          {periodEndDate.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Typography>
      )}
      {!accessActive && (
        <>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ maxWidth: 520, mx: variant === 'settings' ? 'auto' : 0, mb: 2 }}
          >
            Souscrivez à l&apos;add-on Accès Entreprise — Ambassadeurs pour activer les
            fonctionnalités entreprise dédiées aux ambassadeurs (facturation indépendante de
            l&apos;abonnement JS Connect Pro).
          </Typography>
          <Button
            variant="contained"
            disabled={loadingCheckout || !structureId || !userId}
            onClick={handleSubscribe}
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              bgcolor: tokens.colors.brandTeal,
              '&:hover': { bgcolor: tokens.colors.brandTeal700 },
            }}
          >
            {loadingCheckout ? (
              <CircularProgress size={22} color="inherit" />
            ) : (
              'Souscrire — 149,90 €/mois'
            )}
          </Button>
        </>
      )}
    </Box>
  );

  if (variant === 'embedded') {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: tokens.radius.xl,
          backgroundColor: '#fff',
          border: '1px solid #f3f4f6',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
          Accès Entreprise — Ambassadeurs
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Add-on mensuel pour les structures Job Service (149,90 €/mois)
        </Typography>
        {content}
      </Paper>
    );
  }

  return (
    <SettingsPanel
      title="Accès Entreprise — Ambassadeurs"
      desc="Add-on mensuel pour les structures Job Service (149,90 €/mois)"
    >
      {content}
    </SettingsPanel>
  );
}
