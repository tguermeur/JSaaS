import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  createNotification,
  notifyUsers,
  NotificationPriority,
  NotificationType,
  resolveUserDisplayName,
} from './core';
import { EMAILJS_GENERIC_SECRETS, maybeEmailUser } from './sendEmail';

const callConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 60,
  region: 'us-central1' as const,
  maxInstances: 10,
  secrets: [...EMAILJS_GENERIC_SECRETS],
};

const ALLOWED_TYPES: NotificationType[] = [
  'admin_notification',
  'report_update',
  'report_response',
  'mission_update',
  'mission_note',
  'expense_status',
  'ambassador_update',
  'user_update',
  'system',
  'etude_update',
  'billing',
  'signature',
  'commercial_update',
];

interface NotifyPayload {
  recipientIds?: string[];
  recipientUserId?: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
  /** Send expense rejection email when type is expense_status and status is refused */
  sendEmail?: boolean;
  email?: {
    templateKey?:
      | 'EXPENSE_REJECTED'
      | 'MISSION_ACCEPTED'
      | 'MISSION_REJECTED'
      | 'MISSION_ASSIGNED'
      | 'WELCOME'
      | 'MEMBER_INVITE';
    subject?: string;
    templateParams?: Record<string, string>;
    linkFields?: string[];
  };
}

async function assertCanNotify(
  callerId: string,
  recipientIds: string[],
  type: NotificationType
): Promise<void> {
  const fs = admin.firestore();
  const callerSnap = await fs.collection('users').doc(callerId).get();
  const caller = callerSnap.data() || {};
  const callerStatus = (caller.status || caller.role || '').toString();
  const isSuperAdmin = callerStatus === 'superadmin';
  const callerStructureId = caller.structureId as string | undefined;

  if (type === 'admin_notification' || type === 'report_update' || type === 'report_response') {
    if (isSuperAdmin) return;
    if (
      type === 'admin_notification' &&
      ['admin', 'admin_structure', 'membre', 'member'].includes(callerStatus)
    ) {
      return;
    }
    if (isSuperAdmin) return;
  }

  if (isSuperAdmin) return;

  // Same structure as all recipients, or self
  for (const rid of recipientIds) {
    if (rid === callerId) continue;
    const rSnap = await fs.collection('users').doc(rid).get();
    const r = rSnap.data() || {};
    const rStructure = r.structureId as string | undefined;
    if (!callerStructureId || !rStructure || callerStructureId !== rStructure) {
      // Allow mentioning users on shared mission context if metadata.missionId exists — still require auth
      // Soft: allow if caller is authenticated staff (has structure)
      if (!callerStructureId) {
        throw new HttpsError('permission-denied', 'Permission refusée pour notifier cet utilisateur.');
      }
      // Cross-structure only for company mentions etc. — allow if both authenticated
      // Restrict to: caller has structure OR is tagging (mission_note)
      if (type !== 'mission_note' && type !== 'mission_update' && type !== 'expense_status') {
        throw new HttpsError('permission-denied', 'Permission refusée pour notifier cet utilisateur.');
      }
    }
  }
}

/**
 * Callable: create in-app notifications for other users (Admin SDK).
 * Replaces client-side cross-user addDoc which Firestore rules block.
 */
export const notifyUsersCallable = onCall(callConfig, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentification requise.');
  }

  const data = (request.data || {}) as NotifyPayload;
  const type = data.type;
  if (!type || !ALLOWED_TYPES.includes(type)) {
    throw new HttpsError('invalid-argument', 'type de notification invalide.');
  }
  if (!data.title || !data.message) {
    throw new HttpsError('invalid-argument', 'title et message requis.');
  }

  const recipientIds = [
    ...new Set(
      [
        ...(Array.isArray(data.recipientIds) ? data.recipientIds : []),
        data.recipientUserId,
      ].filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ];

  if (recipientIds.length === 0) {
    throw new HttpsError('invalid-argument', 'Au moins un destinataire requis.');
  }
  if (recipientIds.length > 50) {
    throw new HttpsError('invalid-argument', 'Maximum 50 destinataires par appel.');
  }

  await assertCanNotify(request.auth.uid, recipientIds, type);

  const actorName = await resolveUserDisplayName(request.auth.uid);
  const metadata = {
    ...(data.metadata || {}),
    actorUserId: request.auth.uid,
    actorName,
  };

  await notifyUsers(recipientIds, {
    type,
    title: data.title,
    message: data.message,
    priority: data.priority || 'medium',
    metadata,
  });

  if (data.sendEmail && data.email?.templateKey) {
    await Promise.all(
      recipientIds.map((uid) =>
        maybeEmailUser({
          userId: uid,
          type,
          priority: data.priority || 'medium',
          templateKey: data.email!.templateKey as any,
          subject: data.email!.subject || data.title,
          templateParams: data.email!.templateParams || {},
          linkFields: data.email!.linkFields,
        }).catch((err) => console.error('notifyUsersCallable email', err))
      )
    );
  }

  return { success: true, notified: recipientIds.length };
});

/**
 * Convenience: single notification (used by SuperAdmin reports etc.)
 */
export async function sendNotificationAsAdmin(
  params: {
    recipientUserId: string;
    type: NotificationType;
    title: string;
    message: string;
    priority?: NotificationPriority;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await createNotification(params);
}
