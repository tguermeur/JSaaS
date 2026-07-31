import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
  InputAdornment,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
  CalendarMonth as CalendarIcon,
  Email as EmailIcon,
  Check as CheckIcon,
  Person as PersonIcon,
  Bolt as ZapIcon,
  Snooze as SnoozeIcon,
} from '@mui/icons-material';
import {
  CommercialEmptyState,
  CommercialStatusChip,
  CompanyLogo,
  EngagementMeter,
  RelancePill,
  ScoreGauge,
} from '../../components/ds';
import { tokens } from '../../theme/tokens';
import UserNameText from '../../components/common/UserNameText';
import UserAvatarInitials from '../../components/common/UserAvatarInitials';
import { contactState, relanceSortKey, relanceState } from '../../utils/commercialRelance';
import type { CommercialMember, CommercialProspect, CommercialViewActions } from './types';

export type TableSortKey = 'relance' | 'score' | 'value' | 'name' | 'activity';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tous les statuts' },
  { value: 'non_qualifie', label: 'Non qualifié' },
  { value: 'contacte', label: 'Contacté' },
  { value: 'a_recontacter', label: 'À recontacter' },
  { value: 'negociation', label: 'Négociation' },
  { value: 'abandon', label: 'Abandon' },
  { value: 'deja_client', label: 'Client' },
];

const selectSx = {
  px: 1.25,
  py: 1,
  borderRadius: tokens.radius.sm,
  border: `1px solid ${tokens.colors.gray200}`,
  bgcolor: tokens.colors.bgPaper,
  fontSize: 13,
  fontFamily: 'inherit',
  color: tokens.colors.gray700,
  cursor: 'pointer',
  outline: 'none',
};

export interface CommercialTableViewProps {
  prospects: CommercialProspect[];
  members: CommercialMember[];
  accent?: string;
  canWrite?: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  filterStatus: string;
  onFilterStatusChange: (v: string) => void;
  filterOwnerId: string;
  onFilterOwnerIdChange: (v: string) => void;
  selectedIds: string[];
  onToggleAll: (ids: string[]) => void;
  onToggleOne: (id: string) => void;
  act: CommercialViewActions;
  getName: (p: CommercialProspect) => string;
  getCompany: (p: CommercialProspect) => string;
  formatCurrency?: (n: number) => string;
}

export const CommercialTableView: React.FC<CommercialTableViewProps> = ({
  prospects,
  members,
  accent = tokens.colors.brandTeal,
  canWrite,
  search,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  filterOwnerId,
  onFilterOwnerIdChange,
  selectedIds,
  onToggleAll,
  onToggleOne,
  act,
  getName,
  getCompany,
  formatCurrency = n => `${Math.round(n).toLocaleString('fr-FR')} €`,
}) => {
  const [sort, setSort] = useState<TableSortKey>('relance');
  const getMember = (id?: string) => members.find(m => m.id === id);
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    let list = prospects.filter(p => {
      const matchSearch =
        !s ||
        getName(p).toLowerCase().includes(s) ||
        getCompany(p).toLowerCase().includes(s) ||
        (p.email || '').toLowerCase().includes(s) ||
        (p.title || '').toLowerCase().includes(s) ||
        (p.secteur || '').toLowerCase().includes(s);
      if (!matchSearch) return false;
      if (filterStatus && p.statut !== filterStatus) return false;
      if (filterOwnerId && (p.ownerId || '') !== filterOwnerId) return false;
      return true;
    });
    const cmp: Record<TableSortKey, (a: CommercialProspect, b: CommercialProspect) => number> = {
      relance: (a, b) => relanceSortKey(a.dateRecontact) - relanceSortKey(b.dateRecontact),
      score: (a, b) => (b.aiScore || 0) - (a.aiScore || 0),
      value: (a, b) => (b.valeurPotentielle || 0) - (a.valeurPotentielle || 0),
      name: (a, b) => getCompany(a).localeCompare(getCompany(b), 'fr'),
      activity: (a, b) =>
        new Date(b.derniereInteraction || b.dateAjout || 0).getTime() -
        new Date(a.derniereInteraction || a.dateAjout || 0).getTime(),
    };
    list = [...list].sort(cmp[sort]);
    if (dir === 'desc') list.reverse();
    return list;
  }, [prospects, search, filterStatus, filterOwnerId, sort, dir, getName, getCompany]);

  const kpi = useMemo(() => ({
    count: prospects.length,
    pipe: prospects
      .filter(p => !['abandon', 'deja_client'].includes(p.statut))
      .reduce((sum, p) => sum + (p.valeurPotentielle || 0), 0),
    due: prospects.filter(p => {
      const t = relanceState(p.dateRecontact).tone;
      return t === 'late' || t === 'today';
    }).length,
  }), [prospects]);

  const allSel = filtered.length > 0 && selectedIds.length === filtered.length;

  const toggleSort = (key: TableSortKey) => {
    if (sort === key) setDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(key);
      setDir(key === 'relance' || key === 'name' ? 'asc' : 'desc');
    }
  };

  const openMenu = (e: React.MouseEvent<HTMLElement>, id: string) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuId(id);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuId(null);
  };

  const chipBtn = (id: TableSortKey, label: string) => {
    const on = sort === id;
    return (
      <Box
        key={id}
        component="button"
        type="button"
        onClick={() => toggleSort(id)}
        sx={{
          px: 1.25,
          py: 0.625,
          borderRadius: tokens.radius.xs,
          border: `1px solid ${on ? `${accent}55` : tokens.colors.gray200}`,
          bgcolor: on ? `${accent}12` : tokens.colors.bgPaper,
          fontSize: 12,
          fontWeight: 600,
          color: on ? accent : tokens.colors.gray500,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {label}
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 3, py: 2, borderBottom: `1px solid ${tokens.colors.gray100}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontSize: 11, color: tokens.colors.gray500, fontWeight: 600 }}>PÔLE COMMERCIAL</Typography>
          <Typography component="h2" sx={{ mt: 0.375, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: tokens.colors.gray900 }}>
            Prospects <Box component="span" sx={{ color: tokens.colors.gray400, fontWeight: 400 }}>· {kpi.count}</Box>
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.25, flexWrap: 'wrap' }}>
          <Box>
            <Typography sx={{ fontSize: 11, color: tokens.colors.gray500 }}>Pipeline pondéré</Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: tokens.colors.gray900, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(kpi.pipe)}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, color: tokens.colors.gray500 }}>À relancer</Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: kpi.due ? '#b91c1c' : tokens.colors.gray900, fontVariantNumeric: 'tabular-nums' }}>{kpi.due}</Typography>
          </Box>
          {canWrite && (
            <Button variant="contained" onClick={act.onAdd} sx={{ textTransform: 'none', bgcolor: accent, '&:hover': { bgcolor: tokens.colors.brandTeal700 } }}>
              Ajouter un prospect
            </Button>
          )}
        </Box>
      </Box>

      <Box sx={{ px: 3, py: 1.5, borderBottom: `1px solid ${tokens.colors.gray100}`, display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Rechercher un prospect, une entreprise…"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: tokens.colors.gray400 }} /></InputAdornment>,
            sx: { borderRadius: tokens.radius.sm, bgcolor: tokens.colors.gray50, fontSize: 13 },
          }}
          sx={{ flex: 1, minWidth: 200, maxWidth: 320 }}
        />
        <Box component="select" value={filterStatus} onChange={e => onFilterStatusChange(e.target.value)} sx={selectSx}>
          {STATUS_OPTIONS.map(o => <option key={o.value || 'all'} value={o.value}>{o.label}</option>)}
        </Box>
        <Box component="select" value={filterOwnerId} onChange={e => onFilterOwnerIdChange(e.target.value)} sx={selectSx}>
          <option value="">Toute l&apos;équipe</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.displayName}</option>
          ))}
        </Box>
        <Box sx={{ ml: { sm: 'auto' }, display: 'flex', alignItems: 'center', gap: 0.875 }}>
          <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, fontWeight: 600 }}>Trier</Typography>
          {chipBtn('relance', 'Relance')}
          {chipBtn('score', 'Priorité')}
          {chipBtn('value', 'Valeur')}
          {chipBtn('activity', 'Activité')}
        </Box>
      </Box>

      {selectedIds.length > 0 && (
        <Box sx={{ px: 3, py: 1.125, bgcolor: `${accent}0a`, borderBottom: `1px solid ${tokens.colors.gray100}`, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.colors.gray900 }}>
            {selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''}
          </Typography>
          <Button size="small" variant="outlined" startIcon={<PersonIcon />} sx={{ textTransform: 'none' }}>Assigner</Button>
          <Button size="small" variant="text" onClick={() => onToggleAll([])} sx={{ ml: 'auto', textTransform: 'none' }}>
            Désélectionner
          </Button>
        </Box>
      )}

      <TableContainer sx={{ flex: 1, minHeight: 0 }}>
        {filtered.length === 0 ? (
          <Box sx={{ p: 4 }}>
            <CommercialEmptyState icon={<SearchIcon />} title="Aucun prospect ne correspond" subtitle="Ajustez votre recherche ou vos filtres." />
          </Box>
        ) : (
          <Table stickyHeader size="medium" sx={{ minWidth: 980 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: tokens.colors.gray50 }}>
                <TableCell padding="checkbox" sx={{ pl: 3, bgcolor: tokens.colors.gray50 }}>
                  <Checkbox
                    checked={allSel}
                    indeterminate={selectedIds.length > 0 && !allSel}
                    onChange={() => onToggleAll(allSel ? [] : filtered.map(p => p.id))}
                    sx={{ '&.Mui-checked': { color: accent } }}
                  />
                </TableCell>
                <TableCell sx={{ bgcolor: tokens.colors.gray50, fontSize: 11, fontWeight: 600, color: tokens.colors.gray500, textTransform: 'uppercase' }}>
                  <TableSortLabel active={sort === 'name'} direction={sort === 'name' ? dir : 'asc'} onClick={() => toggleSort('name')}>
                    Prospect
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ bgcolor: tokens.colors.gray50, fontSize: 11, fontWeight: 600, color: tokens.colors.gray500, textTransform: 'uppercase' }}>Statut</TableCell>
                <TableCell sx={{ bgcolor: tokens.colors.gray50, fontSize: 11, fontWeight: 600, color: tokens.colors.gray500, textTransform: 'uppercase' }}>
                  <TableSortLabel active={sort === 'score'} direction={sort === 'score' ? dir : 'asc'} onClick={() => toggleSort('score')}>
                    Priorité IA
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ bgcolor: tokens.colors.gray50, fontSize: 11, fontWeight: 600, color: tokens.colors.gray500, textTransform: 'uppercase' }}>Engagement</TableCell>
                <TableCell sx={{ bgcolor: tokens.colors.gray50, fontSize: 11, fontWeight: 600, color: tokens.colors.gray500, textTransform: 'uppercase' }}>Propriétaire</TableCell>
                <TableCell sx={{ bgcolor: tokens.colors.gray50, fontSize: 11, fontWeight: 600, color: tokens.colors.gray500, textTransform: 'uppercase' }}>
                  <TableSortLabel active={sort === 'activity'} direction={sort === 'activity' ? dir : 'asc'} onClick={() => toggleSort('activity')}>
                    Dernière activité
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ bgcolor: tokens.colors.gray50, fontSize: 11, fontWeight: 600, color: tokens.colors.gray500, textTransform: 'uppercase', width: 170 }}>
                  <TableSortLabel active={sort === 'relance'} direction={sort === 'relance' ? dir : 'asc'} onClick={() => toggleSort('relance')}>
                    Prochaine relance
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ bgcolor: tokens.colors.gray50, width: 48 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(p => {
                const selected = selectedIds.includes(p.id);
                const c = contactState(p.derniereInteraction || p.lastActivityAt, p.statut);
                const score = typeof p.aiScore === 'number' ? p.aiScore : 0;
                return (
                  <TableRow
                    key={p.id}
                    hover
                    selected={selected}
                    onClick={() => act.onOpen(p.id)}
                    sx={{ cursor: 'pointer', bgcolor: selected ? `${accent}08` : undefined }}
                  >
                    <TableCell padding="checkbox" sx={{ pl: 3 }} onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selected} onChange={() => onToggleOne(p.id)} sx={{ '&.Mui-checked': { color: accent } }} />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.375 }}>
                        <CompanyLogo name={getCompany(p)} size={36} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: tokens.colors.gray900, whiteSpace: 'nowrap' }}>{getName(p)}</Typography>
                          <Typography sx={{ fontSize: 12, color: tokens.colors.gray500, whiteSpace: 'nowrap' }}>
                            {getCompany(p)}{p.title ? ` · ${p.title}` : ''}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell><CommercialStatusChip statut={p.statut} size="sm" /></TableCell>
                    <TableCell>
                      {typeof p.aiScore === 'number' ? <ScoreGauge score={score} size={34} /> : <Typography variant="caption" color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell>
                      <EngagementMeter compact value={score} opens={Math.min(score, 5)} clicks={Math.floor(score / 25)} replies={score >= 60 ? 1 : 0} />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875 }}>
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: tokens.radius.pill,
                            bgcolor: accent,
                            color: '#fff',
                            fontSize: 9,
                            fontWeight: 700,
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <UserAvatarInitials user={getMember(p.ownerId)} fontSize="0.7rem" />
                        </Box>
                        <UserNameText
                          user={getMember(p.ownerId)}
                          mode="displayName"
                          fallback="—"
                          sx={{ fontSize: 12.5, color: tokens.colors.gray700, whiteSpace: 'nowrap' }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography
                        sx={{
                          fontSize: 12.5,
                          color: c.stale ? (c.veryStale ? '#b91c1c' : '#c2620a') : tokens.colors.gray500,
                          fontWeight: c.stale ? 600 : 400,
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.625,
                        }}
                      >
                        {c.stale && <SnoozeIcon sx={{ fontSize: 12 }} />}
                        {c.label}
                      </Typography>
                    </TableCell>
                    <TableCell
                      onClick={e => {
                        e.stopPropagation();
                        act.onScheduleRelance(p, e.currentTarget as HTMLElement);
                      }}
                    >
                      <RelancePill date={p.dateRecontact} accent={accent} />
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <IconButton size="small" onClick={e => openMenu(e, p.id)}><MoreVertIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem onClick={() => { if (menuId) act.onOpen(menuId); closeMenu(); }}>
          <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Ouvrir la fiche</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          const p = prospects.find(x => x.id === menuId);
          if (p) act.onScheduleRelance(p);
          closeMenu();
        }}>
          <ListItemIcon><CalendarIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Programmer une relance</ListItemText>
        </MenuItem>
        {act.onCompose && (
          <MenuItem onClick={() => {
            const p = prospects.find(x => x.id === menuId);
            if (p) act.onCompose!(p);
            closeMenu();
          }}>
            <ListItemIcon><EmailIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Envoyer un email</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={() => {
          const p = prospects.find(x => x.id === menuId);
          if (p) act.onMarkDone(p);
          closeMenu();
        }}>
          <ListItemIcon><CheckIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Marquer relance faite</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};
