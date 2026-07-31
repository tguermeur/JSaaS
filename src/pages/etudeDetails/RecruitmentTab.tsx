import React from 'react';
import { Box } from '@mui/material';

interface RecruitmentTabProps {
  children: React.ReactNode;
}

export const RecruitmentTab: React.FC<RecruitmentTabProps> = ({ children }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</Box>
);
