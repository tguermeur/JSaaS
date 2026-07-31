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
  Campaign as CampaignIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import { useNotifications, PersistentNotification } from '../../contexts/NotificationContext';
import { NotificationService } from '../../services/notificationService';
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
      case 'mission_note':
      case 'expense_status':
        return <BusinessIcon fontSize="small" />;
      case 'ambassador_update':
        return <CampaignIcon fontSize="small" />;
      case 'etude_update':
      case 'commercial_update':
      case 'billing':
      case 'signature':
        return <InfoIcon fontSize="small" />;
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
      case 'mission_note':
      case 'expense_status':
        return 'info';
      case 'ambassador_update':
        return 'secondary';
      case 'billing':
        return 'error';
      case 'user_update':
      case 'etude_update':
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
    // 1. Enregistrer le clic en base (engagement)
    try {
      await NotificationService.recordNotificationClick(notification.id);
    } catch (err) {
      console.warn('Enregistrement du clic non effectué:', err);
    }

    // 2. Marquer comme lue si ce n'est pas déjà fait
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // 3. Deep link : si redirectUrl est présent, rediriger impérativement vers ce lien
    const redirectUrl = notification.metadata?.redirectUrl;
    if (redirectUrl) {
      navigate(redirectUrl);
      if (onNotificationClick) onNotificationClick(notification);
      return;
    }

    // 4. Callback personnalisé
    if (onNotificationClick) {
      onNotificationClick(notification);
    }

    // 5. Redirection par défaut selon métadonnées / type
    if (notification.metadata) {
      if (notification.metadata.source === 'ambassador' && notification.metadata.eventId) {
        navigate(`/app/ambassadeurs/event/${notification.metadata.eventId}`);
      } else if (notification.metadata.source === 'audit') {
        if (notification.metadata.missionId) {
          navigate(`/app/audit/mission/${notification.metadata.missionId}`);
        } else {
          navigate('/app/audit');
        }
      } else if (notification.metadata.source === 'entreprise') {
        if (notification.metadata.companyId) {
          navigate(`/app/entreprises/${notification.metadata.companyId}`);
        } else {
          navigate('/app/entreprises');
        }
      } else {
        switch (notification.type) {
          case 'report_update':
          case 'report_response':
            navigate('/app/reports');
            break;
          case 'mission_update':
            if (notification.metadata.missionId) {
              navigate(`/app/mission/${notification.metadata.missionId}`);
            } else {
              navigate('/app/mission');
            }
            break;
          case 'user_update':
            navigate('/app/profile');
            break;
          case 'admin_notification':
            navigate('/app/admin');
            break;
          default:
            break;
        }
      }
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) {
      return 'À l\'instant';
    }
    if (diffInMinutes < 60) {
      return `Il y a ${diffInMinutes} min`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    
    if (diffInHours < 24) {
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

  const getDisplayDate = (notification: PersistentNotification) => {
    const lastEventAt = notification.metadata?.lastEventAt;
    if (lastEventAt) {
      const parsed = lastEventAt instanceof Date ? lastEventAt : new Date(lastEventAt);
      if (!Number.isNaN(parsed.getTime())) {
        return formatDate(parsed);
      }
    }
    return formatDate(notification.createdAt);
  };

  const getGroupedCount = (notification: PersistentNotification) => {
    return notification.metadata?.count ?? (notification as PersistentNotification & { count?: number }).count;
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
              backgroundColor: notification.read ? 'transparent' : (theme) => `${theme.palette.primary.main}14`,
              borderLeft: notification.read ? 'none' : '3px solid',
              borderLeftColor: notification.read ? 'transparent' : 'primary.main',
              '&:hover': { bgcolor: 'action.selected' },
              py: 1.5,
              px: 2
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
              {/* Pastille non lue + icône type */}
              <Box sx={{ mr: 2, mt: 0.5, position: 'relative' }}>
                {!notification.read && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      border: '2px solid',
                      borderColor: 'background.paper'
                    }}
                  />
                )}
                <Chip
                  icon={getNotificationIcon(notification.type)}
                  label=""
                  size="small"
                  sx={{
                    backgroundColor: notification.read
                      ? getNotificationColor(notification.type) + '20'
                      : getNotificationColor(notification.type) + '30',
                    color: getNotificationColor(notification.type) + (notification.read ? '80' : ''),
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
                      fontWeight: notification.read ? 400 : 700,
                      color: notification.read ? 'text.secondary' : 'text.primary',
                      flex: 1
                    }}
                  >
                    {notification.title}
                  </Typography>
                  {getGroupedCount(notification) > 1 && (
                    <Chip
                      label={getGroupedCount(notification)}
                      size="small"
                      color="primary"
                      sx={{ height: 20, fontSize: '0.7rem', ml: 0.5 }}
                    />
                  )}
                  {/* Icône lien de redirection */}
                  {notification.metadata?.redirectUrl && (
                    <Tooltip title="Ouvrir">
                      <OpenInNewIcon sx={{ fontSize: 16, color: 'primary.main', ml: 0.5 }} />
                    </Tooltip>
                  )}
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
                    {getDisplayDate(notification)}
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