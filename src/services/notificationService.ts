import { addDoc, collection, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { NotificationType, NotificationPriority, PersistentNotification } from '../contexts/NotificationContext';

export type NotificationCategory = 'engagement' | 'admin' | 'update';

// Helper pour enrichir les métadonnées avec category et priority_label
function enrichMetadata(
  metadata: Record<string, any> | undefined,
  category: NotificationCategory,
  priority: NotificationPriority
): Record<string, any> {
  const priorityLabels: Record<NotificationPriority, string> = {
    low: 'normal',
    medium: 'important',
    high: 'prioritaire',
    urgent: 'urgent'
  };
  return {
    ...metadata,
    category,
    priority_label: metadata?.priority_label ?? priorityLabels[priority]
  };
}

// Service pour gérer les notifications
export class NotificationService {
  /**
   * Enregistrer la date de clic sur une notification (engagement)
   */
  static async recordNotificationClick(notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        clickedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du clic:', error);
      throw error;
    }
  }

  /**
   * Envoyer une notification à un utilisateur spécifique
   */
  static async sendToUser(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    priority: NotificationPriority = 'medium',
    metadata?: Record<string, any>,
    category: NotificationCategory = 'update'
  ): Promise<void> {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId,
        type,
        title,
        message,
        priority,
        metadata: enrichMetadata(metadata, category, priority),
        createdAt: serverTimestamp(),
        read: false
      });
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la notification:', error);
      throw error;
    }
  }

  /**
   * Envoyer une notification à tous les utilisateurs d'une structure
   */
  static async sendToStructure(
    structureId: string,
    type: NotificationType,
    title: string,
    message: string,
    priority: NotificationPriority = 'medium',
    metadata?: Record<string, any>,
    category: NotificationCategory = 'update'
  ): Promise<void> {
    try {
      await addDoc(collection(db, 'notifications'), {
        structureId,
        type,
        title,
        message,
        priority,
        metadata: enrichMetadata(metadata, category, priority),
        createdAt: serverTimestamp(),
        read: false
      });
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la notification:', error);
      throw error;
    }
  }

  /**
   * Envoyer une notification globale (admin)
   */
  static async sendGlobal(
    type: NotificationType,
    title: string,
    message: string,
    priority: NotificationPriority = 'medium',
    metadata?: Record<string, any>,
    category: NotificationCategory = 'admin'
  ): Promise<void> {
    try {
      await addDoc(collection(db, 'notifications'), {
        type: 'admin_notification',
        title,
        message,
        priority,
        metadata: enrichMetadata(metadata, category, priority),
        createdAt: serverTimestamp(),
        read: false,
        recipientType: 'all'
      });
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la notification globale:', error);
      throw error;
    }
  }

  /**
   * Notifier une mise à jour de mission
   */
  static async notifyMissionUpdate(
    userId: string,
    missionId: string,
    missionNumber: string,
    action: 'created' | 'updated' | 'deleted' | 'assigned'
  ): Promise<void> {
    const redirectUrl = `/app/mission/${missionId}`;

    const titles: Record<typeof action, string> = {
      created: 'Nouvelle opportunité',
      updated: 'Mission mise à jour',
      deleted: 'Mission annulée',
      assigned: 'Mission assignée'
    };
    const messages: Record<typeof action, string> = {
      created: `La mission ${missionNumber} vous attend ! Découvrez-la maintenant.`,
      updated: `La mission ${missionNumber} a évolué. Consultez les détails.`,
      deleted: `La mission ${missionNumber} n'est plus disponible.`,
      assigned: `Vous avez été assigné à la mission ${missionNumber}. Allez voir !`
    };

    const title = titles[action];
    const message = messages[action];

    await this.sendToUser(
      userId,
      'mission_update',
      title,
      message,
      'medium',
      { missionId, action, redirectUrl },
      'engagement'
    );
  }

  /**
   * Notifier une réponse à un rapport
   */
  static async notifyReportResponse(
    userId: string,
    reportId: string,
    reportContent: string
  ): Promise<void> {
    const title = 'Réponse reçue';
    const message = `On a répondu à votre rapport. Ouvrez-le pour voir la réponse.`;
    const redirectUrl = '/app/reports';

    await this.sendToUser(
      userId,
      'report_response',
      title,
      message,
      'medium',
      { reportId, redirectUrl },
      'update'
    );
  }

  /**
   * Notifier une mise à jour de rapport
   */
  static async notifyReportUpdate(
    userId: string,
    reportId: string,
    status: 'pending' | 'in_progress' | 'resolved' | 'closed'
  ): Promise<void> {
    const titles: Record<typeof status, string> = {
      pending: 'Rapport en attente',
      in_progress: 'Rapport en cours',
      resolved: 'Rapport résolu',
      closed: 'Rapport clôturé'
    };
    const messages: Record<typeof status, string> = {
      pending: 'Votre rapport est en file. On s\'en occupe.',
      in_progress: 'Votre rapport est en cours de traitement.',
      resolved: 'Bonne nouvelle : votre rapport a été résolu.',
      closed: 'Ce rapport a été clôturé. Consultez l\'historique.'
    };
    const redirectUrl = '/app/reports';

    await this.sendToUser(
      userId,
      'report_update',
      titles[status],
      messages[status],
      'medium',
      { reportId, status, redirectUrl },
      'update'
    );
  }

  /**
   * Notifier une mise à jour de profil utilisateur
   */
  static async notifyUserUpdate(
    userId: string,
    action: 'profile_updated' | 'role_changed' | 'status_changed'
  ): Promise<void> {
    const titles = {
      profile_updated: 'Profil à jour',
      role_changed: 'Nouveau rôle',
      status_changed: 'Statut modifié'
    };
    const messages = {
      profile_updated: 'Vos infos ont bien été enregistrées. Tout est à jour !',
      role_changed: 'Votre rôle a changé. Découvrez vos nouvelles permissions.',
      status_changed: 'Votre statut a été mis à jour.'
    };
    const redirectUrl = '/app/profile';

    await this.sendToUser(
      userId,
      'user_update',
      titles[action],
      messages[action],
      'low',
      { redirectUrl },
      'update'
    );
  }

  /**
   * Notifier un événement système
   */
  static async notifySystemEvent(
    userId: string,
    event: string,
    message: string,
    priority: NotificationPriority = 'low'
  ): Promise<void> {
    await this.sendToUser(userId, 'system', event, message, priority, undefined, 'admin');
  }

  /**
   * Notifier plusieurs utilisateurs en une seule fois
   */
  static async sendToMultipleUsers(
    userIds: string[],
    type: NotificationType,
    title: string,
    message: string,
    priority: NotificationPriority = 'medium',
    metadata?: Record<string, any>,
    category: NotificationCategory = 'update'
  ): Promise<void> {
    const promises = userIds.map(userId =>
      this.sendToUser(userId, type, title, message, priority, metadata, category)
    );

    await Promise.all(promises);
  }
}

// Fonctions utilitaires pour les notifications courantes
export const notifyMissionCreated = (userId: string, missionId: string, missionNumber: string) =>
  NotificationService.notifyMissionUpdate(userId, missionId, missionNumber, 'created');

export const notifyMissionUpdated = (userId: string, missionId: string, missionNumber: string) =>
  NotificationService.notifyMissionUpdate(userId, missionId, missionNumber, 'updated');

export const notifyMissionAssigned = (userId: string, missionId: string, missionNumber: string) =>
  NotificationService.notifyMissionUpdate(userId, missionId, missionNumber, 'assigned');

export const notifyReportResponse = (userId: string, reportId: string, reportContent: string) =>
  NotificationService.notifyReportResponse(userId, reportId, reportContent);

export const notifyReportStatusChange = (userId: string, reportId: string, status: 'pending' | 'in_progress' | 'resolved' | 'closed') =>
  NotificationService.notifyReportUpdate(userId, reportId, status); 