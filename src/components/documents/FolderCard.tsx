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
  Folder as FolderIcon,
  Lock as LockIcon,
  MoreHoriz as MoreHorizIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { Folder } from '../../types/document';

interface FolderCardProps {
  folder: Folder;
  onOpen: (folder: Folder) => void;
  onDelete?: (folder: Folder) => void;
  onRename?: (folder: Folder) => void;
  onProperties?: (folder: Folder) => void;
  canAccess: boolean;
  canDelete?: boolean;
  canRename?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
}

const FolderCard: React.FC<FolderCardProps> = ({
  folder,
  onOpen,
  onDelete,
  onRename,
  onProperties,
  canAccess,
  canDelete = true,
  canRename = true,
  onDragStart,
  onDrop,
  onDragOver,
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

  return (
    <Card
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        width: '100%', // Changed to auto width to fit grid properly but not force expand
        maxWidth: 120, // Constrain width like Mac icons
        mx: 'auto', // Center in grid cell
        backgroundColor: 'transparent',
        boxShadow: 'none',
        position: 'relative',
        borderRadius: '8px',
        transition: 'background-color 0.2s ease',
        opacity: canAccess ? 1 : 0.6,
        '&:hover': canAccess ? {
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
        } : {},
      }}
    >
      <CardActionArea
        onClick={() => canAccess && onOpen(folder)}
        disabled={!canAccess}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          p: 2,
        }}
      >
        {/* Icon Area */}
        <Box
          sx={{
            width: '100%',
            height: 100, // Slightly smaller than doc thumbnail area to keep proportion
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 1,
            position: 'relative',
            filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.15))', // Shadow for depth
          }}
        >
          {/* macOS Style Folder Icon Color */}
          <FolderIcon sx={{ fontSize: 90, color: folder.color || '#007AFF' }} />
          
          {/* Restricted Icon Overlay */}
          {folder.isRestricted && (
            <Tooltip title="Restreint">
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 5,
                  right: '25%',
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
              px: 0.5,
            }}
          >
            {folder.name}
          </Typography>
          
          {/* Optional: Show creator or date subtly */}
          {folder.createdByName && (
            <Typography
              variant="caption"
              sx={{
                color: '#86868b',
                fontSize: '11px',
                mt: 0.2,
                display: 'block',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {folder.createdByName}
            </Typography>
          )}
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
        {onProperties && (
          <MenuItem
            onClick={() => {
              handleMenuClose();
              onProperties(folder);
            }}
          >
            <InfoIcon sx={{ fontSize: 18, color: '#1d1d1f' }} />
            Propriétés
          </MenuItem>
        )}
        {canRename && onRename && (
          <MenuItem
            onClick={() => {
              handleMenuClose();
              onRename(folder);
            }}
          >
            <EditIcon sx={{ fontSize: 18, color: '#1d1d1f' }} />
            Renommer
          </MenuItem>
        )}
        {canDelete && onDelete && (
          <MenuItem
            onClick={() => {
              handleMenuClose();
              onDelete(folder);
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

export default FolderCard;

