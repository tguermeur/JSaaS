import React from 'react';
import { Box, Typography } from '@mui/material';
import { tokens } from '../../theme/tokens';

export const TemplateCatalogCard: React.FC<{
  title: string;
  category?: string;
  author?: string;
  updatedAt?: string;
  selected?: boolean;
  onClick?: () => void;
}> = ({ title, category, author, updatedAt, selected, onClick }) => (
  <Box onClick={onClick} sx={{ border: `1px solid ${selected ? tokens.colors.brandTeal : tokens.colors.divider}`, borderRadius: tokens.radius.lg, bgcolor: tokens.colors.bgPaper, overflow: 'hidden', cursor: 'pointer', transition: tokens.transitions.fast, '&:hover': { borderColor: tokens.colors.brandTeal, boxShadow: tokens.shadows.sm } }}>
    <Box sx={{ p: 1.5 }}>
      {category && <Typography sx={{ fontSize: 10, fontWeight: 600, color: tokens.colors.brandTeal, textTransform: 'uppercase', mb: 0.5 }}>{category}</Typography>}
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.colors.gray900, mb: 0.5 }}>{title}</Typography>
      <Typography sx={{ fontSize: 11, color: tokens.colors.gray400 }}>{author}{updatedAt ? ` · ${updatedAt}` : ''}</Typography>
    </Box>
  </Box>
);

export const TemplateEditorLayout: React.FC<{
  layers: React.ReactNode;
  canvas: React.ReactNode;
  inspector: React.ReactNode;
}> = ({ layers, canvas, inspector }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: '240px 1fr 280px', height: '100%', minHeight: 0, overflow: 'hidden', bgcolor: tokens.colors.surfaceAlt }}>
    <Box sx={{ borderRight: `1px solid ${tokens.colors.divider}`, bgcolor: tokens.colors.bgPaper, overflow: 'auto' }}>{layers}</Box>
    <Box sx={{ overflow: 'auto', p: 2 }}>{canvas}</Box>
    <Box sx={{ borderLeft: `1px solid ${tokens.colors.divider}`, bgcolor: tokens.colors.bgPaper, overflow: 'auto' }}>{inspector}</Box>
  </Box>
);

export const LayerItem: React.FC<{ label: string; active?: boolean; onClick?: () => void }> = ({ label, active, onClick }) => (
  <Box onClick={onClick} sx={{ py: 1, px: 1.5, fontSize: 12, fontWeight: active ? 600 : 400, color: active ? tokens.colors.gray900 : tokens.colors.gray600, bgcolor: active ? tokens.colors.gray100 : 'transparent', cursor: 'pointer', borderLeft: active ? `2px solid ${tokens.colors.brandTeal}` : '2px solid transparent' }}>
    {label}
  </Box>
);
