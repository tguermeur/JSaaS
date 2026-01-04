import React, { useState } from 'react';
import {
  Card,
  CardActionArea,
  Typography,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  InsertDriveFile as FileTextIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
  MoreHoriz as MoreHorizIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Lock as LockIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { Document } from '../../types/document';
import { formatFileSize } from '../../utils/fileUtils';

interface DocumentCardProps {
  document: Document;
  onOpen: (document: Document) => void;
  onDownload: (document: Document) => void;
  onDelete: (document: Document) => void;
  onRename?: (document: Document) => void;
  onProperties?: (document: Document) => void;
  canDelete?: boolean;
  canRename?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}

const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  onOpen,
  onDownload,
  onDelete,
  onRename,
  onProperties,
  canDelete = true,
  canRename = true,
  onDragStart,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const getFileIcon = () => {
    if (document.type.startsWith('image/')) {
      return <ImageIcon sx={{ fontSize: 64, color: '#007AFF' }} />;
    }
    if (document.type === 'application/pdf') {
      return <PdfIcon sx={{ fontSize: 64, color: '#FF3B30' }} />;
    }
    if (
      document.type.includes('word') ||
      document.type.includes('document')
    ) {
      return <DocIcon sx={{ fontSize: 64, color: '#007AFF' }} />;
    }
    return <FileTextIcon sx={{ fontSize: 64, color: '#86868b' }} />;
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

  const handleDragStartCard = (e: React.DragEvent) => {
    if (onDragStart) {
      onDragStart(e);
    } else {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/json', JSON.stringify({ type: 'document', id: document.id }));
    }
  };

  return (
    <Card
      draggable={true}
      onDragStart={handleDragStartCard}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        width: 'auto',
        minWidth: 100,
        maxWidth: 140,
        backgroundColor: 'transparent',
        boxShadow: 'none',
        position: 'relative',
        borderRadius: '8px',
        transition: 'background-color 0.2s ease',
        cursor: 'grab',
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
        },
        '&:active': {
          cursor: 'grabbing',
        },
      }}
    >
      <CardActionArea
        onClick={() => onOpen(document)}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          p: 2,
        }}
      >
        {/* Icon / Thumbnail Area */}
        <Box
          sx={{
            width: '100%',
            height: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 1.5,
            position: 'relative',
          }}
        >
          {document.thumbnailUrl ? (
            <Box
              component="img"
              src={document.thumbnailUrl}
              alt={document.name}
              sx={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: '4px',
                filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))',
              }}
            />
          ) : (
            <Box
              sx={{
                filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))',
              }}
            >
              {getFileIcon()}
            </Box>
          )}
          
          {/* Restricted Icon Overlay */}
          {document.isRestricted && (
            <Tooltip title="Restreint">
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: '20%',
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  borderRadius: '50%',
                  p: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              >
                <LockIcon sx={{ fontSize: 14, color: '#666' }} />
              </Box>
            </Tooltip>
          )}
        </Box>

        {/* Text Area */}
        <Box sx={{ width: '100%', textAlign: 'center' }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              color: '#1d1d1f',
              fontSize: '13px',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              wordBreak: 'break-word',
              px: 1,
            }}
          >
            {document.name}
          </Typography>
          
          <Typography
            variant="caption"
            sx={{
              color: '#86868b',
              fontSize: '11px',
              mt: 0.5,
              display: 'block',
            }}
          >
            {formatFileSize(document.size)}
          </Typography>
        </Box>
      </CardActionArea>

      {/* Hover Menu Button */}
      <IconButton
        size="small"
        onClick={handleMenuOpen}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          opacity: isHovered || Boolean(anchorEl) ? 1 : 0,
          transition: 'opacity 0.2s ease',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 1)',
          },
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          width: 24,
          height: 24,
        }}
      >
        <MoreHorizIcon sx={{ fontSize: 18 }} />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            minWidth: 160,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            borderRadius: '12px',
            mt: 1,
            '& .MuiMenuItem-root': {
              fontSize: '13px',
              gap: 1.5,
              py: 1,
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onOpen(document);
          }}
        >
          <VisibilityIcon sx={{ fontSize: 18, color: '#1d1d1f' }} />
          Aperçu
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onDownload(document);
          }}
        >
          <DownloadIcon sx={{ fontSize: 18, color: '#1d1d1f' }} />
          Télécharger
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            if (onProperties) onProperties(document);
          }}
        >
          <InfoIcon sx={{ fontSize: 18, color: '#1d1d1f' }} />
          Propriétés
        </MenuItem>
        {canRename && onRename && (
          <MenuItem
            onClick={() => {
              handleMenuClose();
              onRename(document);
            }}
          >
            <EditIcon sx={{ fontSize: 18, color: '#1d1d1f' }} />
            Renommer
          </MenuItem>
        )}
        {canDelete && (
          <MenuItem
            onClick={() => {
              handleMenuClose();
              onDelete(document);
            }}
            sx={{ color: '#FF3B30' }}
          >
            <DeleteIcon sx={{ fontSize: 18 }} />
            Supprimer
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
};

export default DocumentCard;

