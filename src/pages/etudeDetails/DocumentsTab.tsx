import React from 'react';
import { Box } from '@mui/material';

interface DocumentsTabProps {
  children: React.ReactNode;
}

export const DocumentsTab: React.FC<DocumentsTabProps> = ({ children }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</Box>
);
