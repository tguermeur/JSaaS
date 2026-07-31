import React from 'react';
import { Box } from '@mui/material';

interface CandidatesTabProps {
  children: React.ReactNode;
}

export const CandidatesTab: React.FC<CandidatesTabProps> = ({ children }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</Box>
);
