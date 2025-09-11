import React from 'react';
import {
  List,
  ListItem,
  ListItemText,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Report as ReportIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useNotifications, PersistentNotification } from '../../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';

interface NotificationListProps {
  notifications: PersistentNotification[];
  onNotificationClick?: (notification: PersistentNotification) => void;
  maxHeight?: number | string;
  showEmptyState?: boolean;
  emptyStateMessage?: string;
}

const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  onNotificationClick,
  maxHeight = 400,
  showEmptyState = true,
  emptyStateMessage = 'Aucune notification'
}) => {
  const { markAsRead } = useNotifications();
  const navigate = useNavigate();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'report_update':
      case 'report_response':
        return <ReportIcon fontSize="small" />;
      case 'mission_update':
        return <BusinessIcon fontSize="small" />;
      case 'user_update':
        return <PersonIcon fontSize="small" />;
      case 'admin_notification':
        return <SettingsIcon fontSize="small" />;
      default:
        return <InfoIcon fontSize="small" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'report_update':
      case 'report_response':
        return 'warning';
      case 'mission_update':
        return 'info';
      case 'user_update':
        return 'success';
      case 'admin_notification':
        return 'primary';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return '#f44336';
      case 'high':
        return '#ff9800';
      case 'medium':
        return '#2196f3';
      case 'low':
        return '#4caf50';
      default:
        return '#757575';
    }
  };

  const handleNotificationClick = async (notification: PersistentNotification) => {
    // Marquer comme lue si ce n'est pas déjà fait
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Appeler le callback personnalisé
    if (onNotificationClick) {
      onNotificationClick(notification);
    }

    // Rediriger en fonction des métadonnées de la notification
    if (notification.metadata) {
      // Si une URL de redirection est spécifiée, l'utiliser
      if (notification.metadata.redirectUrl) {
        navigate(notification.metadata.redirectUrl);
        return;
      }

      // Sinon, utiliser la logique par défaut basée sur le type
      if (notification.metadata.source === 'audit') {
        // Pour les notifications d'audit, rediriger vers la page d'audit
        if (notification.metadata.missionId) {
          navigate(`/app/audit/mission/${notification.metadata.missionId}`);
        } else {
          navigate('/app/audit');
        }
      } else if (notification.metadata.source === 'entreprise') {
        // Pour les notifications d'entreprise, rediriger vers la page de l'entreprise
        if (notification.metadata.companyId) {
          navigate(`/app/entreprises/${notification.metadata.companyId}`);
        } else {
          navigate('/app/entreprises');
        }
      } else {
        // Logique par défaut pour les autres types
        switch (notification.type) {
          case 'report_update':
          case 'report_response':
            navigate('/app/reports');
            break;
          case 'mission_update':
            if (notification.metadata.missionId) {
              navigate(`/app/mission/${notification.metadata.missionNumber || notification.metadata.missionId}`);
            } else {
              navigate('/app/missions');
            }
            break;
          case 'user_update':
            navigate('/app/profile');
            break;
          case 'admin_notification':
            navigate('/app/admin');
            break;
          default:
            // Pas de redirection par défaut
            break;
        }
      }
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'À l\'instant';
    } else if (diffInHours < 24) {
      return `Il y a ${diffInHours}h`;
    } else if (diffInHours < 48) {
      return 'Hier';
    } else {
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
  };

  if (notifications.length === 0 && showEmptyState) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <NotificationsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {emptyStateMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <List sx={{ p: 0, maxHeight, overflow: 'auto' }}>
      {notifications.map((notification, index) => (
        <React.Fragment key={notification.id}>
          <ListItem
            button
            onClick={() => handleNotificationClick(notification)}
            sx={{
              bgcolor: notification.read ? 'transparent' : 'action.hover',
              '&:hover': { bgcolor: 'action.selected' },
              py: 1.5,
              px: 2
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
              {/* Icône de notification */}
              <Box sx={{ mr: 2, mt: 0.5 }}>
                <Chip
                  icon={getNotificationIcon(notification.type)}
                  label=""
                  size="small"
                  sx={{
                    backgroundColor: getNotificationColor(notification.type) + '20',
                    color: getNotificationColor(notification.type) + '80',
                    '& .MuiChip-icon': {
                      color: getNotificationColor(notification.type)
                    }
                  }}
                />
              </Box>

              {/* Contenu de la notification */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: notification.read ? 400 : 600,
                      color: notification.read ? 'text.secondary' : 'text.primary',
                      flex: 1
                    }}
                  >
                    {notification.title}
                  </Typography>
                  
                  {/* Indicateur de priorité */}
                  {notification.priority !== 'medium' && (
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: getPriorityColor(notification.priority),
                        ml: 1
                      }}
                    />
                  )}
                </Box>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mb: 1,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {notification.message}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(notification.createdAt)}
                  </Typography>

                  {/* Métadonnées optionnelles */}
                  {notification.metadata && Object.keys(notification.metadata).length > 0 && (
                    <Tooltip title="Informations supplémentaires">
                      <IconButton size="small" sx={{ p: 0.5 }}>
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            </Box>
          </ListItem>
          
          {index < notifications.length - 1 && <Divider />}
        </React.Fragment>
      ))}
    </List>
  );
};

export default NotificationList; 