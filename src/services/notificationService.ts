import { httpsCallable } from 'firebase/functions';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, getFirebaseFunctions } from '../firebase/config';
import { NotificationType, NotificationPriority } from '../contexts/NotificationContext';

export type NotificationCategory = 'engagement' | 'admin' | 'update';

function enrichMetadata(
  metadata: Record<string, any> | undefined,
  category: NotificationCategory,
  priority: NotificationPriority
): Record<string, any> {
  const priorityLabels: Record<NotificationPriority, string> = {
    low: 'normal',
    medium: 'important',
    high: 'prioritaire',
    urgent: 'urgent',
  };
  return {
    ...metadata,
    category,
    priority_label: metadata?.priority_label ?? priorityLabels[priority],
  };
}

/**
 * Service notifications — cross-user writes passent par la Cloud Function notifyUsersCallable
 * (les rules Firestore bloquent create pour un autre userId).
 */
export class NotificationService {
  static async recordNotificationClick(notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        clickedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du clic:", error);
      throw error;
    }
  }

  private static async callNotify(payload: {
    recipientIds?: string[];
    recipientUserId?: string;
    type: NotificationType;
    title: string;
    message: string;
    priority?: NotificationPriority;
    metadata?: Record<string, any>;
    sendEmail?: boolean;
    email?: Record<string, any>;
  }): Promise<void> {
    const functionsInstance = getFirebaseFunctions();
    if (!functionsInstance) {
      throw new Error("Le service Functions n'est pas disponible");
    }
    const notify = httpsCallable(functionsInstance, 'notifyUsersCallable');
    await notify(payload);
  }

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
      await this.callNotify({
        recipientUserId: userId,
        type,
        title,
        message,
        priority,
        metadata: enrichMetadata(metadata, category, priority),
      });
    } catch (error) {
      console.error("Erreur lors de l'envoi de la notification:", error);
      throw error;
    }
  }

  /**
   * Fan-out via CF: envoie à une liste d'utilisateurs (max 50).
   * Remplace l'ancien sendToStructure (listener structureId non supporté côté client).
   */
  static async sendToUsers(
    userIds: string[],
    type: NotificationType,
    title: string,
    message: string,
    priority: NotificationPriority = 'medium',
    metadata?: Record<string, any>,
    category: NotificationCategory = 'update'
  ): Promise<void> {
    await this.callNotify({
      recipientIds: userIds,
      type,
      title,
      message,
      priority,
      metadata: enrichMetadata(metadata, category, priority),
    });
  }

  /** @deprecated Prefer sendToUsers with resolved member ids. Kept as alias. */
  static async sendToStructure(
    structureId: string,
    type: NotificationType,
    title: string,
    message: string,
    priority: NotificationPriority = 'medium',
    metadata?: Record<string, any>,
    category: NotificationCategory = 'update'
  ): Promise<void> {
    console.warn(
      'sendToStructure: passez par notifyUsersCallable avec recipientIds (fan-out). structureId=',
      structureId
    );
    await this.callNotify({
      recipientIds: [],
      type,
      title,
      message,
      priority,
      metadata: enrichMetadata({ ...metadata, structureId }, category, priority),
    });
  }

  static async sendGlobal(
    type: NotificationType,
    title: string,
    message: string,
    priority: NotificationPriority = 'medium',
    metadata?: Record<string, any>,
    category: NotificationCategory = 'admin'
  ): Promise<void> {
    // Global broadcast is admin_notification via SuperAdmin UI only
    await this.callNotify({
      type: type === 'admin_notification' ? type : 'admin_notification',
      title,
      message,
      priority,
      metadata: enrichMetadata(metadata, category, priority),
      recipientIds: [],
    });
  }

  static async notifyMissionUpdate(
    userId: string,
    missionId: string,
    missionNumber: string,
    action: 'created' | 'updated' | 'assigned'
  ): Promise<void> {
    const titles = {
      created: 'Mission créée',
      updated: 'Mission mise à jour',
      assigned: 'Mission assignée',
    };
    const messages = {
      created: `La mission ${missionNumber} a été créée.`,
      updated: `La mission ${missionNumber} a été mise à jour.`,
      assigned: `Vous avez été assigné à la mission ${missionNumber}.`,
    };
    await this.sendToUser(
      userId,
      'mission_update',
      titles[action],
      messages[action],
      action === 'assigned' ? 'high' : 'medium',
      { missionId, missionNumber, action, redirectUrl: `/app/mission/${missionId}` }
    );
  }

  static async notifyReportResponse(
    userId: string,
    reportId: string,
    reportContent: string
  ): Promise<void> {
    await this.sendToUser(
      userId,
      'report_response',
      'Réponse à votre signalement',
      reportContent.slice(0, 200),
      'medium',
      { reportId }
    );
  }

  static async notifyReportUpdate(
    userId: string,
    reportId: string,
    status: string
  ): Promise<void> {
    await this.sendToUser(
      userId,
      'report_update',
      'Mise à jour de votre signalement',
      `Statut : ${status}`,
      'medium',
      { reportId, status }
    );
  }

  static async notifyUserUpdate(
    userId: string,
    title: string,
    message: string
  ): Promise<void> {
    await this.sendToUser(userId, 'user_update', title, message, 'medium');
  }

  static async notifySystemEvent(
    userId: string,
    event: string,
    message: string,
    priority: NotificationPriority = 'medium'
  ): Promise<void> {
    await this.sendToUser(userId, 'system', event, message, priority, undefined, 'admin');
  }

  static async sendToMultipleUsers(
    userIds: string[],
    type: NotificationType,
    title: string,
    message: string,
    priority: NotificationPriority = 'medium',
    metadata?: Record<string, any>,
    category: NotificationCategory = 'update'
  ): Promise<void> {
    await this.sendToUsers(userIds, type, title, message, priority, metadata, category);
  }
}

export const notifyMissionCreated = (userId: string, missionId: string, missionNumber: string) =>
  NotificationService.notifyMissionUpdate(userId, missionId, missionNumber, 'created');

export const notifyMissionUpdated = (userId: string, missionId: string, missionNumber: string) =>
  NotificationService.notifyMissionUpdate(userId, missionId, missionNumber, 'updated');

export const notifyMissionAssigned = (userId: string, missionId: string, missionNumber: string) =>
  NotificationService.notifyMissionUpdate(userId, missionId, missionNumber, 'assigned');

export const notifyReportResponse = (userId: string, reportId: string, reportContent: string) =>
  NotificationService.notifyReportResponse(userId, reportId, reportContent);

export const notifyReportStatusChange = (
  userId: string,
  reportId: string,
  status: 'pending' | 'in_progress' | 'resolved' | 'closed'
) => NotificationService.notifyReportUpdate(userId, reportId, status);
