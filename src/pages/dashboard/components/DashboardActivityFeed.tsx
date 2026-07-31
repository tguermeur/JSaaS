import React from 'react';
import { Box, Typography } from '@mui/material';
import { DashboardPanel, SectionHead } from '../../../components/ds';
import { tokens } from '../../../theme/tokens';
import UserNameText from '../../../components/common/UserNameText';
import type { ConnectedUserItem } from '../../../hooks/useDashboardData';

export const DashboardActivityFeed: React.FC<{ users: ConnectedUserItem[] }> = ({ users }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, px: 2, pb: 4 }}>
    <DashboardPanel>
      <SectionHead title="Étudiants en mission" />
      <Box sx={{ p: 2 }}>
        {users.slice(0, 5).map((u) => (
          <Box key={u.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.25, borderBottom: `1px solid ${tokens.colors.gray100}` }}>
            <UserNameText
              user={u}
              variant="body2"
              sx={{ fontSize: 13, fontWeight: 500, color: tokens.colors.gray900 }}
            />
            <Box component="span" sx={{ fontSize: 11, fontWeight: 600, px: 1, py: '2px', borderRadius: 999, bgcolor: u.isOnline ? tokens.colors.successLight : tokens.colors.gray100, color: u.isOnline ? '#065f46' : tokens.colors.gray500 }}>
              {u.isOnline ? 'En ligne' : 'Hors ligne'}
            </Box>
          </Box>
        ))}
      </Box>
    </DashboardPanel>
    <DashboardPanel>
      <SectionHead title="Activité récente" />
      <Box sx={{ p: 2 }}>
        {[
          { who: 'Système', what: 'Mise à jour des statistiques', when: 'Il y a 2 h' },
          { who: 'Équipe', what: 'Nouvelle candidature reçue', when: 'Il y a 5 h' },
          { who: 'Commercial', what: 'Relance prospect planifiée', when: 'Hier' },
        ].map((item, i) => (
          <Box key={i} sx={{ py: 1.25, borderBottom: `1px solid ${tokens.colors.gray100}` }}>
            <Typography sx={{ fontSize: 13, color: tokens.colors.gray900 }}>
              <Box component="span" sx={{ fontWeight: 600 }}>{item.who}</Box> — {item.what}
            </Typography>
            <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, mt: 0.25 }}>{item.when}</Typography>
          </Box>
        ))}
      </Box>
    </DashboardPanel>
  </Box>
);
