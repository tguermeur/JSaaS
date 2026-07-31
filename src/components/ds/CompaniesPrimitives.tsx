import React from 'react';
import { Box, Typography, TextField, InputAdornment, Skeleton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { tokens } from '../../theme/tokens';

export interface CompanyListItem {
  id: string;
  name: string;
  sector?: string;
  missionsCount?: number;
  revenue?: string;
  initials?: string;
  color?: string;
}

export const CompanyDirectoryRow: React.FC<{
  company: CompanyListItem;
  selected?: boolean;
  onClick?: () => void;
}> = ({ company, selected, onClick }) => (
  <Box onClick={onClick} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, px: 1.5, borderRadius: tokens.radius.md, cursor: 'pointer', bgcolor: selected ? `${tokens.colors.brandTeal}14` : 'transparent', border: selected ? `1px solid ${tokens.colors.brandTeal}40` : '1px solid transparent', '&:hover': { bgcolor: selected ? `${tokens.colors.brandTeal}14` : tokens.colors.gray50 } }}>
    <Box sx={{ width: 36, height: 36, borderRadius: tokens.radius.md, bgcolor: company.color || tokens.colors.brandNavy, color: '#fff', fontSize: 13, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      {company.initials || company.name.slice(0, 2).toUpperCase()}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.colors.gray900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{company.name}</Typography>
      {company.sector && <Typography sx={{ fontSize: 11, color: tokens.colors.gray400 }}>{company.sector}</Typography>}
    </Box>
    {company.missionsCount != null && (
      <Typography sx={{ fontSize: 11, color: tokens.colors.gray500, flexShrink: 0 }}>{company.missionsCount} miss.</Typography>
    )}
  </Box>
);

export const CompanySwitcher: React.FC<{
  companies: CompanyListItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
}> = ({ companies, selectedId, onSelect, search, onSearchChange }) => {
  const filtered = companies.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <Box sx={{ width: 280, flexShrink: 0, borderRight: `1px solid ${tokens.colors.divider}`, bgcolor: tokens.colors.bgPaper, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 1.5, borderBottom: `1px solid ${tokens.colors.divider}` }}>
        <TextField size="small" fullWidth placeholder="Rechercher une entreprise…" value={search} onChange={(e) => onSearchChange(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: tokens.colors.gray400 }} /></InputAdornment> }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: tokens.radius.md, fontSize: 13 } }} />
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {filtered.map((c) => (
          <CompanyDirectoryRow key={c.id} company={c} selected={c.id === selectedId} onClick={() => onSelect(c.id)} />
        ))}
      </Box>
    </Box>
  );
};

export const ContactCard: React.FC<{ name: string; role?: string; email?: string; phone?: string; primary?: boolean }> = ({
  name, role, email, phone, primary,
}) => (
  <Box sx={{ p: 1.5, border: `1px solid ${primary ? `${tokens.colors.brandTeal}40` : tokens.colors.divider}`, borderRadius: tokens.radius.lg, bgcolor: primary ? `${tokens.colors.brandTeal}08` : tokens.colors.bgPaper, mb: 1 }}>
    {primary && <Typography sx={{ fontSize: 10, fontWeight: 600, color: tokens.colors.brandTeal, textTransform: 'uppercase', mb: 0.5 }}>Contact principal</Typography>}
    <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.colors.gray900 }}>{name}</Typography>
    {role && <Typography sx={{ fontSize: 11, color: tokens.colors.gray500 }}>{role}</Typography>}
    {email && <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, mt: 0.5 }}>{email}</Typography>}
    {phone && <Typography sx={{ fontSize: 11, color: tokens.colors.gray400 }}>{phone}</Typography>}
  </Box>
);

export const CompaniesLayout: React.FC<{ directory: React.ReactNode; detail: React.ReactNode; rail?: React.ReactNode }> = ({
  directory, detail, rail,
}) => (
  <Box sx={{ display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden' }}>
    {directory}
    <Box sx={{ flex: 1, overflow: 'auto', minWidth: 0 }}>{detail}</Box>
    {rail && <Box sx={{ width: 280, flexShrink: 0, borderLeft: `1px solid ${tokens.colors.divider}`, bgcolor: tokens.colors.surfaceAlt, p: 2, overflow: 'auto' }}>{rail}</Box>}
  </Box>
);

const skeletonWave = { animation: 'wave' as const };

export const CompanyDetailHeaderSkeleton: React.FC = () => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, p: 2.5, pb: 0 }}>
    <Skeleton variant="rounded" width={56} height={56} {...skeletonWave} sx={{ borderRadius: tokens.radius.lg, flexShrink: 0 }} />
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Skeleton variant="text" width="45%" height={14} {...skeletonWave} />
      <Skeleton variant="text" width="30%" height={14} {...skeletonWave} sx={{ mt: 0.75 }} />
    </Box>
  </Box>
);

export const CompanyDetailTabsSkeleton: React.FC = () => (
  <Box sx={{ display: 'flex', gap: 2, px: 2.5, py: 1.5, borderBottom: `1px solid ${tokens.colors.divider}` }}>
    {[120, 88, 96].map((w) => (
      <Skeleton key={w} variant="rounded" width={w} height={28} {...skeletonWave} sx={{ borderRadius: tokens.radius.md }} />
    ))}
  </Box>
);

export const CompanyDetailContentSkeleton: React.FC = () => (
  <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
    <Box sx={{ border: `1px solid ${tokens.colors.divider}`, borderRadius: tokens.radius.lg, p: 2 }}>
      <Skeleton variant="text" width={140} height={18} {...skeletonWave} sx={{ mb: 2 }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <Box key={i}>
            <Skeleton variant="text" width="55%" height={12} {...skeletonWave} />
            <Skeleton variant="text" width="80%" height={16} {...skeletonWave} sx={{ mt: 0.5 }} />
          </Box>
        ))}
      </Box>
    </Box>
    <Box sx={{ border: `1px solid ${tokens.colors.divider}`, borderRadius: tokens.radius.lg, p: 2 }}>
      <Skeleton variant="text" width={100} height={18} {...skeletonWave} sx={{ mb: 2 }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={64} {...skeletonWave} sx={{ borderRadius: tokens.radius.lg }} />
        ))}
      </Box>
    </Box>
  </Box>
);

export const CompanyDetailSkeleton: React.FC = () => (
  <Box sx={{ minHeight: '100%', bgcolor: tokens.colors.bgPaper }}>
    <CompanyDetailHeaderSkeleton />
    <CompanyDetailTabsSkeleton />
    <CompanyDetailContentSkeleton />
  </Box>
);

export const CompanyDetailRailSkeleton: React.FC = () => (
  <Box>
    <Box sx={{ mb: 2.5 }}>
      <Skeleton variant="text" width={80} height={16} {...skeletonWave} sx={{ mb: 1.5 }} />
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={72} {...skeletonWave} sx={{ borderRadius: tokens.radius.lg, mb: 1 }} />
      ))}
    </Box>
    <Box sx={{ mb: 2.5 }}>
      <Skeleton variant="text" width={72} height={16} {...skeletonWave} sx={{ mb: 1.5 }} />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={52} {...skeletonWave} sx={{ borderRadius: tokens.radius.lg, mb: 1 }} />
      ))}
    </Box>
    <Box>
      <Skeleton variant="text" width={48} height={16} {...skeletonWave} sx={{ mb: 1.5 }} />
      <Skeleton variant="rounded" height={88} {...skeletonWave} sx={{ borderRadius: tokens.radius.lg, mb: 1 }} />
      <Skeleton variant="rounded" height={56} {...skeletonWave} sx={{ borderRadius: tokens.radius.lg }} />
    </Box>
  </Box>
);
