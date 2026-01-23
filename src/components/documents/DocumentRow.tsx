import React from 'react';
import {
  TableRow,
  TableCell,
  IconButton,
  Typography,
  Box,
  Chip,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  InsertDriveFile as FileTextIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
  MoreVert as MoreVertIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Lock as LockIcon,
  Edit as EditIcon,
  PushPin as PushPinIcon,
} from '@mui/icons-material';
import { Document } from '../../types/document';
import { formatFileSize } from '../../utils/fileUtils';

interface DocumentRowProps {
  document: Document;
  onOpen: (document: Document) => void;
  onDownload: (document: Document) => void;
  onDelete: (document: Document) => void;
  onRename?: (document: Document) => void;
  onPin?: (document: Document) => void;
  canDelete?: boolean;
  canRename?: boolean;
}

const DocumentRow: React.FC<DocumentRowProps> = ({
  document,
  onOpen,
  onDownload,
  onDelete,
  onRename,
  onPin,
  canDelete = true,
  canRename = true,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const getFileIcon = () => {
    if (document.type.startsWith('image/')) {
      return <ImageIcon sx={{ fontSize: 24, color: '#007AFF' }} />;
    }
    if (document.type === 'application/pdf') {
      return <PdfIcon sx={{ fontSize: 24, color: '#FF3B30' }} />;
    }
    if (
      document.type.includes('word') ||
      document.type.includes('document')
    ) {
      return <DocIcon sx={{ fontSize: 24, color: '#007AFF' }} />;
    }
    return <FileTextIcon sx={{ fontSize: 24, color: '#86868b' }} />;
  };

  const formatDate = (date: Date | any) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <>
      <TableRow
        hover
        sx={{
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: '#f5f5f7',
          },
        }}
        onClick={() => onOpen(document)}
      >
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getFileIcon()}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {document.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                {document.isRestricted && (
                  <Chip
                    icon={<LockIcon sx={{ fontSize: 12 }} />}
                    label="Restreint"
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                    }}
                  />
                )}
                {document.isPersonalDocument && (
                  <Chip
                    icon={<LockIcon sx={{ fontSize: 12, color: '#ffffff' }} />}
                    label="Personnel (crypté)"
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      backgroundColor: '#007AFF',
                      color: '#ffffff',
                      '& .MuiChip-icon': {
                        color: '#ffffff',
                      },
                    }}
                  />
                )}
                {document.isPinned && (
                  <Chip
                    icon={<PushPinIcon sx={{ fontSize: 12, color: '#ffffff' }} />}
                    label="Épinglé"
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      backgroundColor: '#FF9500',
                      color: '#ffffff',
                      '& .MuiChip-icon': {
                        color: '#ffffff',
                      },
                    }}
                  />
                )}
              </Box>
            </Box>
          </Box>
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary">
            {formatDate(document.createdAt)}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary">
            {document.uploadedByName || 'Inconnu'}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <IconButton
            size="small"
            onClick={handleMenuOpen}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </TableCell>
      </TableRow>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onOpen(document);
          }}
        >
          <VisibilityIcon sx={{ mr: 1, fontSize: 20 }} />
          Aperçu
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onDownload(document);
          }}
        >
          <DownloadIcon sx={{ mr: 1, fontSize: 20 }} />
          Télécharger
        </MenuItem>
        {canRename && onRename && (
          <MenuItem
            onClick={() => {
              handleMenuClose();
              onRename(document);
            }}
          >
            <EditIcon sx={{ mr: 1, fontSize: 20 }} />
            Renommer
          </MenuItem>
        )}
        {onPin && (
          <MenuItem
            onClick={() => {
              handleMenuClose();
              onPin(document);
            }}
          >
            <PushPinIcon sx={{ mr: 1, fontSize: 20, color: document.isPinned ? '#FF9500' : undefined }} />
            {document.isPinned ? 'Désépingler' : 'Épingler'}
          </MenuItem>
        )}
        {canDelete && (
          <MenuItem
            onClick={() => {
              handleMenuClose();
              onDelete(document);
            }}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
            Supprimer
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

export default DocumentRow;

