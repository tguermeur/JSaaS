import React from 'react';
import { Badge, IconButton, BadgeProps } from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import { useNotifications } from '../../contexts/NotificationContext';

interface NotificationBadgeProps {
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  size?: 'small' | 'medium' | 'large';
  color?: BadgeProps['color'];
  showBadge?: boolean;
  className?: string;
  sx?: any;
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  onClick,
  size = 'medium',
  color = 'error',
  showBadge = true,
  className,
  sx
}) => {
  const { unreadCount } = useNotifications();

  const iconSize = size === 'small' ? 'small' : size === 'large' ? 'large' : 'medium';

  return (
    <IconButton
      onClick={onClick}
      size={size}
      className={className}
      sx={{
        color: '#86868b',
        position: 'relative',
        ...sx
      }}
    >
      <Badge 
        badgeContent={showBadge ? unreadCount : 0}
        color={color}
        sx={{
          '& .MuiBadge-badge': {
            backgroundColor: '#ff1744',
            color: 'white',
            fontWeight: 'bold',
            fontSize: size === 'small' ? '0.7rem' : '0.75rem',
            minWidth: size === 'small' ? 16 : 20,
            height: size === 'small' ? 16 : 20
          }
        }}
      >
        <NotificationsIcon fontSize={iconSize} />
      </Badge>
    </IconButton>
  );
};

export default NotificationBadge; 