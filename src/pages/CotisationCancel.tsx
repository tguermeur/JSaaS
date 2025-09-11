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

const CotisationCancel: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      minHeight="100vh"
      p={3}
      bgcolor="grey.50"
    >
      <Paper
        elevation={3}
        sx={{
          maxWidth: 600,
          width: '100%',
          p: 4,
          borderRadius: 2,
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Cancel sx={{ fontSize: 80, color: 'warning.main', mb: 2 }} />
          <Typography variant="h3" gutterBottom color="warning.main">
            Paiement annulé
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Votre paiement de cotisation a été annulé
          </Typography>
        </Box>

        <Alert severity="info" sx={{ mb: 4 }}>
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
            sx={{ minWidth: 200 }}
          >
            Réessayer le paiement
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate('/dashboard')}
            sx={{ minWidth: 200 }}
          >
            Retour au tableau de bord
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default CotisationCancel;
