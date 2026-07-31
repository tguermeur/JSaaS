import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Cancel, Payment } from '@mui/icons-material';
import { tokens } from '../theme/tokens';

const CotisationCancel: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      minHeight="100vh"
      p={3}
      sx={{ bgcolor: tokens.colors.surfaceAlt }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 600,
          width: '100%',
          p: 4,
          borderRadius: tokens.radius.xl,
          border: `1px solid ${tokens.colors.borderDefault}`,
          boxShadow: tokens.shadows.card,
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Cancel sx={{ fontSize: 80, color: tokens.colors.warning, mb: 2 }} />
          <Typography variant="h3" gutterBottom sx={{ color: tokens.colors.warning, fontWeight: 600 }}>
            Paiement annulé
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Votre paiement de cotisation a été annulé
          </Typography>
        </Box>

        <Alert severity="info" sx={{ mb: 4, borderRadius: tokens.radius.md }}>
          <Typography variant="body1">
            Aucun montant n'a été débité de votre compte. Vous pouvez réessayer le paiement à tout moment.
          </Typography>
        </Alert>

        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            Si vous avez des questions concernant le paiement, n'hésitez pas à contacter le support.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<Payment />}
            onClick={() => navigate('/cotisation/payment')}
            sx={{
              minWidth: 200,
              bgcolor: tokens.colors.brandTeal,
              borderRadius: tokens.radius.md,
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': { bgcolor: tokens.colors.brandTeal700 },
            }}
          >
            Réessayer le paiement
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate('/app/dashboard')}
            sx={{
              minWidth: 200,
              borderRadius: tokens.radius.md,
              textTransform: 'none',
              borderColor: tokens.colors.borderDefault,
              color: tokens.colors.textPrimary,
            }}
          >
            Retour au tableau de bord
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default CotisationCancel;
