import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Snackbar,
  Alert
} from '@mui/material';
import { 
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '../firebase/config';
import { tokens } from '../theme/tokens';
import PublicNav from '../components/layout/PublicNav';
import Footer from '../components/Footer';
import PageMeta from '../components/common/PageMeta';

const Contact: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });
  const [sending, setSending] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const functionsInstance = getFirebaseFunctions();
      if (!functionsInstance) {
        throw new Error("Le service Functions n'est pas disponible");
      }
      const sendContactEmail = httpsCallable(functionsInstance, 'sendContactEmail');
      await sendContactEmail({
        company: formData.name || formData.subject || 'Contact',
        email: formData.email,
        message: formData.subject
          ? `[${formData.subject}]\n\n${formData.message}`
          : formData.message,
      });
      setSnackbar({
        open: true,
        message: 'Votre message a été envoyé avec succès !',
        severity: 'success'
      });
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
    } catch (error) {
      console.error('Contact form error:', error);
      setSnackbar({
        open: true,
        message: 'Une erreur est survenue. Veuillez réessayer.',
        severity: 'error'
      });
    } finally {
      setSending(false);
    }
  };

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: tokens.radius.md,
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: tokens.colors.ink
      }
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      bgcolor: tokens.colors.marketingWhite,
      pb: { xs: 8, md: 12 }
    }}>
      <PageMeta title="Contact" description="Contactez l'équipe JS Connect pour votre Junior-Entreprise." />
      <PublicNav selectedProfile="junior" showPricing />
      <Container maxWidth="lg" sx={{ pt: { xs: 4, md: 6 } }}>
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: '2.5rem', md: '3.5rem' },
            fontWeight: 600,
            textAlign: 'center',
            mb: { xs: 4, md: 8 },
            color: tokens.colors.ink,
            letterSpacing: '-0.02em'
          }}
        >
          Contactez-nous
        </Typography>

        <Grid container spacing={6}>
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, md: 6 },
                borderRadius: tokens.radius.xl,
                border: `1px solid ${tokens.colors.borderSoft}`,
                height: '100%'
              }}
            >
              <Typography
                variant="h2"
                sx={{
                  fontSize: { xs: '1.8rem', md: '2.2rem' },
                  fontWeight: 600,
                  mb: 4,
                  color: tokens.colors.ink
                }}
              >
                Parlons de votre projet
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontSize: '1.1rem',
                  lineHeight: 1.6,
                  color: tokens.colors.inkMuted,
                  mb: 4
                }}
              >
                Découvrez comment JS Connect peut transformer votre Junior. Notre équipe est là pour vous accompagner dans votre projet.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <EmailIcon sx={{ color: tokens.colors.ink, fontSize: 24 }} />
                  <Typography sx={{ color: tokens.colors.ink }}>
                    contact@jsconnect.fr
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <PhoneIcon sx={{ color: tokens.colors.ink, fontSize: 24 }} />
                  <Typography sx={{ color: tokens.colors.ink }}>
                    +33 1 23 45 67 89
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <LocationIcon sx={{ color: tokens.colors.ink, fontSize: 24 }} />
                  <Typography sx={{ color: tokens.colors.ink }}>
                    Paris, France
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, md: 6 },
                borderRadius: tokens.radius.xl,
                border: `1px solid ${tokens.colors.borderSoft}`
              }}
            >
              <form onSubmit={handleSubmit}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <TextField
                    required
                    fullWidth
                    label="Nom"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    variant="outlined"
                    sx={fieldSx}
                  />
                  <TextField
                    required
                    fullWidth
                    label="Email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    variant="outlined"
                    sx={fieldSx}
                  />
                  <TextField
                    required
                    fullWidth
                    label="Sujet"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    variant="outlined"
                    sx={fieldSx}
                  />
                  <TextField
                    required
                    fullWidth
                    label="Message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    multiline
                    rows={4}
                    variant="outlined"
                    sx={fieldSx}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={sending}
                    sx={{
                      bgcolor: tokens.colors.marketingBlack,
                      color: tokens.colors.marketingWhite,
                      py: 1.5,
                      borderRadius: tokens.radius.xxl,
                      fontSize: '1.1rem',
                      fontWeight: 500,
                      textTransform: 'none',
                      boxShadow: 'none',
                      '&:hover': {
                        bgcolor: tokens.colors.marketingBlack,
                        opacity: 0.9
                      }
                    }}
                  >
                    {sending ? 'Envoi…' : 'Envoyer le message'}
                  </Button>
                </Box>
              </form>
            </Paper>
          </Grid>
        </Grid>
      </Container>
      <Footer />

      {createPortal(
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          sx={{ zIndex: 10000 }}
        >
          <Alert
            onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
            severity={snackbar.severity}
            sx={{
              width: '100%',
              borderRadius: tokens.radius.md,
              boxShadow: tokens.shadows.alert
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>,
        document.body
      )}
    </Box>
  );
};

export default Contact;
