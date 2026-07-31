import React from 'react';
import { Box } from '@mui/material';

interface ComplianceTabProps {
  children: React.ReactNode;
}

export const ComplianceTab: React.FC<ComplianceTabProps> = ({ children }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</Box>
);
