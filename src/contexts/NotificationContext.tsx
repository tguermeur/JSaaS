import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, getDocs, writeBatch, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { useSnackbar } from 'notistack';

// Types de notifications
export type NotificationType = 
  | 'admin_notification' 
  | 'report_update' 
  | 'report_response'
  | 'mission_update'
  | 'user_update'
  | 'system';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

// Interface pour les notifications persistantes
export interface PersistentNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  priority: NotificationPriority;
  userId?: string;
  structureId?: string;
  reportId?: string;
  recipientType?: 'all' | 'structure' | 'user';
  readBy?: Array<{
    userId: string;
    userName: string;
    readAt: Date;
  }>;
  recipientCount?: number;
  metadata?: Record<string, any>;
}

// Interface pour les notifications temporaires
export interface TemporaryNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Interface pour les préférences de notification
export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sound: boolean;
  desktop: boolean;
  types: {
    [key in NotificationType]: boolean;
  };
}

// État du contexte
interface NotificationContextState {
  // Notifications persistantes
  persistentNotifications: PersistentNotification[];
  unreadCount: number;
  isLoading: boolean;
  
  // Notifications temporaires
  temporaryNotifications: TemporaryNotification[];
  
  // Préférences
  preferences: NotificationPreferences;
  
  // Actions
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  sendNotification: (notification: Omit<PersistentNotification, 'id' | 'createdAt' | 'read'>) => Promise<void>;
  showTemporaryNotification: (notification: Omit<TemporaryNotification, 'id'>) => void;
  updatePreferences: (preferences: Partial<NotificationPreferences>) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

// Contexte
const NotificationContext = createContext<NotificationContextState | undefined>(undefined);

// Provider
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  
  // États
  const [persistentNotifications, setPersistentNotifications] = useState<PersistentNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [temporaryNotifications, setTemporaryNotifications] = useState<TemporaryNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email: true,
    push: true,
    sound: true,
    desktop: true,
    types: {
      admin_notification: true,
      report_update: true,
      report_response: true,
      mission_update: true,
      user_update: true,
      system: true
    }
  });

  // Charger les préférences utilisateur depuis Firestore
  useEffect(() => {
    const loadUserPreferences = async () => {
      if (!currentUser?.uid) return;

      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', currentUser.uid)));
        
        if (!userDoc.empty) {
          const userData = userDoc.docs[0].data();
          if (userData.notificationPreferences) {
            setPreferences(prev => ({
              ...prev,
              ...userData.notificationPreferences
            }));
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement des préférences:', error);
      }
    };

    loadUserPreferences();
  }, [currentUser?.uid]);

  // Écouter les notifications en temps réel
  useEffect(() => {
    if (!currentUser?.uid) {
      setPersistentNotifications([]);
      setUnreadCount(0);
      return;
    }

    setIsLoading(true);

    // Requête pour les notifications de l'utilisateur
    const userNotificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    // Requête pour les notifications globales (admin_notification)
    const globalNotificationsQuery = query(
      collection(db, 'notifications'),
      where('type', '==', 'admin_notification'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    // Écouter les notifications utilisateur
    const unsubscribeUser = onSnapshot(userNotificationsQuery, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        priority: doc.data().priority || 'medium'
      })) as PersistentNotification[];

      // Filtrer les notifications selon les préférences utilisateur
      const filteredNotifications = notifications.filter(notification => {
        // Les notifications critiques (urgent) sont toujours affichées
        if (notification.priority === 'urgent') return true;
        
        // Vérifier si le type de notification est activé dans les préférences
        return preferences.types[notification.type] !== false;
      });

      setPersistentNotifications(prev => {
        // Fusionner avec les notifications globales existantes
        const globalNotifications = prev.filter(n => n.type === 'admin_notification');
        return [...filteredNotifications, ...globalNotifications];
      });

      const unread = filteredNotifications.filter(n => !n.read).length;
      setUnreadCount(unread);
      setIsLoading(false);
    });

    // Écouter les notifications globales
    const unsubscribeGlobal = onSnapshot(globalNotificationsQuery, (snapshot) => {
      const globalNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        priority: doc.data().priority || 'medium'
      })) as PersistentNotification[];

      // Filtrer les notifications globales selon les préférences
      const filteredGlobalNotifications = globalNotifications.filter(notification => {
        if (notification.priority === 'urgent') return true;
        return preferences.types[notification.type] !== false;
      });

      setPersistentNotifications(prev => {
        const userNotifications = prev.filter(n => n.type !== 'admin_notification');
        return [...userNotifications, ...filteredGlobalNotifications];
      });
    });

    return () => {
      unsubscribeUser();
      unsubscribeGlobal();
    };
  }, [currentUser?.uid, preferences.types]);

  // Marquer une notification comme lue
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        read: true,
        readAt: serverTimestamp()
      });

      // Mettre à jour l'état local
      setPersistentNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, read: true }
            : n
        )
      );

      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erreur lors du marquage comme lu:', error);
      enqueueSnackbar('Erreur lors du marquage de la notification', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  // Marquer toutes les notifications comme lues
  const markAllAsRead = useCallback(async () => {
    try {
      const unreadNotifications = persistentNotifications.filter(n => !n.read);
      if (unreadNotifications.length === 0) return;

      const batch = writeBatch(db);
      unreadNotifications.forEach(notification => {
        const notificationRef = doc(db, 'notifications', notification.id);
        batch.update(notificationRef, {
          read: true,
          readAt: serverTimestamp()
        });
      });

      await batch.commit();

      // Mettre à jour l'état local
      setPersistentNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Erreur lors du marquage de toutes les notifications:', error);
      enqueueSnackbar('Erreur lors du marquage des notifications', { variant: 'error' });
    }
  }, [persistentNotifications, enqueueSnackbar]);

  // Supprimer une notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      // Note: Firestore ne permet pas la suppression côté client pour des raisons de sécurité
      // Cette fonction pourrait être implémentée via une Cloud Function
      console.log('Suppression de notification non implémentée côté client');
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      enqueueSnackbar('Erreur lors de la suppression de la notification', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  // Envoyer une notification
  const sendNotification = useCallback(async (notification: Omit<PersistentNotification, 'id' | 'createdAt' | 'read'>) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        ...notification,
        createdAt: serverTimestamp(),
        read: false
      });
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la notification:', error);
      enqueueSnackbar('Erreur lors de l\'envoi de la notification', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  // Afficher une notification temporaire
  const showTemporaryNotification = useCallback((notification: Omit<TemporaryNotification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const tempNotification: TemporaryNotification = {
      id,
      ...notification
    };

    // Utiliser notistack pour l'affichage
    enqueueSnackbar(notification.message, {
      variant: notification.type,
      autoHideDuration: notification.duration || 6000,
      action: notification.action ? (key) => (
        <button onClick={() => notification.action!.onClick()}>
          {notification.action!.label}
        </button>
      ) : undefined
    });

    // Ajouter à l'état local pour le suivi
    setTemporaryNotifications(prev => [...prev, tempNotification]);
  }, [enqueueSnackbar]);

  // Mettre à jour les préférences
  const updatePreferences = useCallback(async (newPreferences: Partial<NotificationPreferences>) => {
    try {
      const updatedPreferences = { ...preferences, ...newPreferences };
      setPreferences(updatedPreferences);

      // Sauvegarder dans Firestore si l'utilisateur est connecté
      if (currentUser?.uid) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          notificationPreferences: updatedPreferences,
          lastPreferencesUpdate: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour des préférences:', error);
      enqueueSnackbar('Erreur lors de la mise à jour des préférences', { variant: 'error' });
      throw error; // Propager l'erreur pour la gestion dans le composant
    }
  }, [preferences, currentUser?.uid, enqueueSnackbar]);

  // Rafraîchir les notifications
  const refreshNotifications = useCallback(async () => {
    if (!currentUser?.uid) return;

    setIsLoading(true);
    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const snapshot = await getDocs(notificationsQuery);
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        priority: doc.data().priority || 'medium'
      })) as PersistentNotification[];

      setPersistentNotifications(notifications);
      setUnreadCount(notifications.filter(n => !n.read).length);
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
      enqueueSnackbar('Erreur lors du rafraîchissement des notifications', { variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.uid, enqueueSnackbar]);

  const value: NotificationContextState = {
    persistentNotifications,
    unreadCount,
    isLoading,
    temporaryNotifications,
    preferences,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    sendNotification,
    showTemporaryNotification,
    updatePreferences,
    refreshNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Hook personnalisé
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications doit être utilisé dans un NotificationProvider');
  }
  return context;
}; 