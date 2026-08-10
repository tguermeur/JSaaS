import React from 'react';
import {
  Box,
  Button,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  FileDownload as FileDownloadIcon,
  Add as AddIcon,
  MoreHoriz as MoreHorizIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { AppPageShell } from '../../components/ds';
import StatusChip from '../../components/common/StatusChip';
import UserAvatarInitials from '../../components/common/UserAvatarInitials';
import UserNameText from '../../components/common/UserNameText';
import { tokens } from '../../theme/tokens';

export interface MissionListRow {
  id: string;
  numero: string;
  title: string;
  client: string;
  chargeId?: string;
  chargeName?: string;
  chargePhotoURL?: string | null;
  status: string;
  amountHT?: number;
  dueDate?: string;
  isEtude?: boolean;
}

export interface MissionsListPageProps {
  title: string;
  subtitle: string;
  newLabel: string;
  searchPlaceholder: string;
  rows: MissionListRow[];
  canWrite?: boolean;
  toolbarExtra?: React.ReactNode;
  onNew?: () => void;
  /** Tooltip optionnel sur le bouton de création (ex. quota atteint) */
  newTooltip?: string;
  onExport?: () => void;
  onRowClick?: (row: MissionListRow) => void;
  rowMenuItems?: (row: MissionListRow) => Array<{ label: string; onClick: () => void }>;
}

const filterLabels = ['Statut', 'Pôle', 'Membre', 'Période'];

export const MissionsListPage: React.FC<MissionsListPageProps> = ({
  title,
  subtitle,
  newLabel,
  searchPlaceholder,
  rows,
  canWrite,
  toolbarExtra,
  onNew,
  newTooltip,
  onExport,
  onRowClick,
  rowMenuItems,
}) => {
  const [search, setSearch] = React.useState('');
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [menuRow, setMenuRow] = React.useState<MissionListRow | null>(null);

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      r.numero.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.client.toLowerCase().includes(q) ||
      (r.chargeName || '').toLowerCase().includes(q)
    );
  });

  const openMenu = (e: React.MouseEvent<HTMLElement>, row: MissionListRow) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuRow(row);
  };

  return (
    <AppPageShell
      title={title}
      subtitle={subtitle}
      actions={
        <>
          <Button size="small" variant="outlined" startIcon={<FileDownloadIcon />} onClick={onExport} sx={{ textTransform: 'none', borderRadius: tokens.radius.md }}>
            Exporter
          </Button>
          {canWrite && onNew && (
            <Tooltip title={newTooltip || ''}>
              <span>
                <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={onNew} sx={{ textTransform: 'none', borderRadius: tokens.radius.md, bgcolor: tokens.colors.brandNavy }}>
                  {newLabel}
                </Button>
              </span>
            </Tooltip>
          )}
        </>
      }
    >
      <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.75, minHeight: '100%' }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1, maxWidth: 360, '& .MuiOutlinedInput-root': { borderRadius: tokens.radius.md, bgcolor: tokens.colors.bgPaper } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: tokens.colors.gray400 }} />
                </InputAdornment>
              ),
            }}
          />
          {filterLabels.map((f) => (
            <Button key={f} size="small" variant="outlined" endIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />} sx={{ textTransform: 'none', borderRadius: tokens.radius.md, fontSize: 12, color: tokens.colors.gray700 }}>
              {f}
            </Button>
          ))}
          {toolbarExtra}
        </Box>

        <TableContainer sx={{ bgcolor: tokens.colors.bgPaper, borderRadius: tokens.radius.lg, border: `1px solid ${tokens.colors.gray100}`, flex: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: tokens.colors.gray50 }}>
                {['N°', title === 'Études' ? 'Étude' : 'Mission', 'Client', 'Responsable', 'Statut', 'Montant TTC', 'Échéance', ''].map((h, i) => (
                  <TableCell key={h || 'menu'} align={h === 'Montant TTC' ? 'right' : 'left'} sx={{ fontWeight: 600, fontSize: 12, color: tokens.colors.gray700, borderBottom: `1px solid ${tokens.colors.gray200}`, width: i === 7 ? 40 : undefined }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((row) => (
                <TableRow
                  key={row.id}
                  hover
                  onClick={() => onRowClick?.(row)}
                  sx={{ cursor: onRowClick ? 'pointer' : 'default', '& td': { borderBottom: `1px solid ${tokens.colors.gray100}`, fontSize: 13 } }}
                >
                  <TableCell sx={{ fontFamily: 'monospace', color: tokens.colors.gray500, fontSize: 12 }}>{row.numero}</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: tokens.colors.gray900 }}>{row.title}</TableCell>
                  <TableCell sx={{ color: tokens.colors.gray700 }}>{row.client}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem', bgcolor: tokens.colors.brandNavy }}>
                        <UserAvatarInitials user={{ id: row.chargeId, displayName: row.chargeName }} fontSize="0.7rem" />
                      </Avatar>
                      <UserNameText user={{ id: row.chargeId, displayName: row.chargeName }} variant="body2" sx={{ fontSize: 13 }} />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <StatusChip status={row.status} size="small" />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 500 }}>{row.amountHT != null ? `${row.amountHT.toLocaleString('fr-FR')} €` : '—'}</TableCell>
                  <TableCell sx={{ color: tokens.colors.gray400 }}>{row.dueDate || '—'}</TableCell>
                  <TableCell>
                    {rowMenuItems && (
                      <IconButton size="small" onClick={(e) => openMenu(e, row)}>
                        <MoreHorizIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        {menuRow && rowMenuItems?.(menuRow).map((item) => (
          <MenuItem key={item.label} onClick={() => { setMenuAnchor(null); item.onClick(); }}>
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </AppPageShell>
  );
};

export default MissionsListPage;
