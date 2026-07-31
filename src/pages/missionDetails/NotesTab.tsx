import React from 'react';
import { Box } from '@mui/material';

interface NotesTabProps {
  children: React.ReactNode;
}

export const NotesTab: React.FC<NotesTabProps> = ({ children }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</Box>
);
