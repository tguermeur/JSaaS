import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { NotificationType, NotificationPriority, PersistentNotification } from '../contexts/NotificationContext';

// Service pour gérer les notifications
export class NotificationService {
  /**
   * Envoyer une notification à un utilisateur spécifique
   */
  static async sendToUser(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    priority: NotificationPriority = 'medium',
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId,
        type,
        title,
        message,
        priority,
        metadata,
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
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await addDoc(collection(db, 'notifications'), {
        structureId,
        type,
        title,
        message,
        priority,
        metadata,
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
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await addDoc(collection(db, 'notifications'), {
        type: 'admin_notification',
        title,
        message,
        priority,
        metadata,
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
    const actions = {
      created: 'créée',
      updated: 'mise à jour',
      deleted: 'supprimée',
      assigned: 'assignée'
    };

    const title = `Mission ${actions[action]}`;
    const message = `La mission ${missionNumber} a été ${actions[action]}.`;

    await this.sendToUser(userId, 'mission_update', title, message, 'medium', {
      missionId,
      action
    });
  }

  /**
   * Notifier une réponse à un rapport
   */
  static async notifyReportResponse(
    userId: string,
    reportId: string,
    reportContent: string
  ): Promise<void> {
    const title = 'Nouvelle réponse à votre rapport';
    const message = `Une réponse a été ajoutée à votre rapport "${reportContent.substring(0, 50)}..."`;

    await this.sendToUser(userId, 'report_response', title, message, 'medium', {
      reportId
    });
  }

  /**
   * Notifier une mise à jour de rapport
   */
  static async notifyReportUpdate(
    userId: string,
    reportId: string,
    status: 'pending' | 'in_progress' | 'resolved' | 'closed'
  ): Promise<void> {
    const statuses = {
      pending: 'en attente',
      in_progress: 'en cours de traitement',
      resolved: 'résolu',
      closed: 'fermé'
    };

    const title = 'Mise à jour de votre rapport';
    const message = `Votre rapport a été marqué comme ${statuses[status]}.`;

    await this.sendToUser(userId, 'report_update', title, message, 'medium', {
      reportId,
      status
    });
  }

  /**
   * Notifier une mise à jour de profil utilisateur
   */
  static async notifyUserUpdate(
    userId: string,
    action: 'profile_updated' | 'role_changed' | 'status_changed'
  ): Promise<void> {
    const actions = {
      profile_updated: 'Profil mis à jour',
      role_changed: 'Rôle modifié',
      status_changed: 'Statut modifié'
    };

    const messages = {
      profile_updated: 'Votre profil a été mis à jour avec succès.',
      role_changed: 'Votre rôle a été modifié.',
      status_changed: 'Votre statut a été modifié.'
    };

    await this.sendToUser(userId, 'user_update', actions[action], messages[action], 'low');
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
    await this.sendToUser(userId, 'system', event, message, priority);
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
    metadata?: Record<string, any>
  ): Promise<void> {
    const promises = userIds.map(userId =>
      this.sendToUser(userId, type, title, message, priority, metadata)
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