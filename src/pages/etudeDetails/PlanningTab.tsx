import React from 'react';
import { Box } from '@mui/material';

interface PlanningTabProps {
  children: React.ReactNode;
}

export const PlanningTab: React.FC<PlanningTabProps> = ({ children }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</Box>
);
