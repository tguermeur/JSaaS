import React from 'react';
import { Box, Container, Typography, Link as MuiLink } from '@mui/material';
import { Link } from 'react-router-dom';

export default function Footer(): JSX.Element {
  return (
    <Box
      component="footer"
      sx={{
        py: 1,
        px: 2,
        mt: 'auto',
        backgroundColor: '#f5f5f7',
        borderTop: '1px solid #e5e5e5',
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        width: '100%'
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Typography
            variant="body2"
            component={Link}
            to="/"
            sx={{
              color: '#86868b',
              textDecoration: 'none',
              fontSize: '0.75rem'
            }}
          >
            JS Connect
          </Typography>

          <Box
            sx={{
              display: 'flex',
              gap: 2
            }}
          >
            <MuiLink
              component={Link}
              to="/mentions-legales"
              sx={{
                color: '#86868b',
                textDecoration: 'none',
                fontSize: '0.75rem',
                '&:hover': {
                  color: '#1d1d1f'
                }
              }}
            >
              Mentions légales
            </MuiLink>
            <MuiLink
              component={Link}
              to="/politique-confidentialite"
              sx={{
                color: '#86868b',
                textDecoration: 'none',
                fontSize: '0.75rem',
                '&:hover': {
                  color: '#1d1d1f'
                }
              }}
            >
              Politique de confidentialité
            </MuiLink>
          </Box>

          <Typography
            variant="body2"
            sx={{
              color: '#86868b',
              fontSize: '0.75rem'
            }}
          >
            © {new Date().getFullYear()} JS Connect
          </Typography>
        </Box>
      </Container>
    </Box>
  );
} 