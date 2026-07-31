import React from 'react';
import { Box } from '@mui/material';

interface OverviewTabProps {
  children: React.ReactNode;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ children }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</Box>
);
