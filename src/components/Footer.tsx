import React from 'react';
import { Box, Container, Typography, Link as MuiLink } from '@mui/material';
import { Link } from 'react-router-dom';
import { tokens } from '../theme/tokens';

interface FooterProps {
  /** Dans l'app (sidebar icône) : largeur du panneau principal uniquement */
  variant?: 'fixed' | 'inset';
}

export default function Footer({ variant = 'fixed' }: FooterProps): JSX.Element {
  const isInset = variant === 'inset';

  return (
    <Box
      component="footer"
      sx={{
        py: 0,
        px: 2,
        mt: isInset ? 0 : 'auto',
        backgroundColor: tokens.colors.bgSubtle,
        borderTop: `1px solid ${tokens.colors.gray150}`,
        ...(isInset
          ? {
              position: 'relative',
              width: '100%',
              flexShrink: 0,
              zIndex: 1,
            }
          : {
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 1000,
              width: '100%',
            }),
        height: tokens.layout.footerH,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Container
        maxWidth={isInset ? false : 'lg'}
        disableGutters={isInset}
        sx={{
          ...(isInset ? { px: 0, width: '100%' } : undefined),
          display: 'flex',
          alignItems: 'center',
          height: '100%',
          flex: 1,
          width: '100%',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, width: '100%' }}>
          <Typography
            variant="body2"
            component={Link}
            to="/"
            sx={{ color: tokens.colors.inkMuted, textDecoration: 'none', fontSize: tokens.typography.caption.fontSize }}
          >
            JS Connect
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <MuiLink
              component={Link}
              to="/mentions-legales"
              sx={{
                color: tokens.colors.inkMuted,
                textDecoration: 'none',
                fontSize: tokens.typography.caption.fontSize,
                '&:hover': { color: tokens.colors.ink },
              }}
            >
              Mentions légales
            </MuiLink>
            <MuiLink
              component={Link}
              to="/politique-confidentialite"
              sx={{
                color: tokens.colors.inkMuted,
                textDecoration: 'none',
                fontSize: tokens.typography.caption.fontSize,
                '&:hover': { color: tokens.colors.ink },
              }}
            >
              Politique de confidentialité
            </MuiLink>
          </Box>
          <Typography variant="body2" sx={{ color: tokens.colors.inkMuted, fontSize: tokens.typography.caption.fontSize }}>
            © {new Date().getFullYear()} JS Connect
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
