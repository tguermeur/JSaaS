import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export type NotificationType =
  | 'admin_notification'
  | 'report_update'
  | 'report_response'
  | 'mission_update'
  | 'mission_note'
  | 'expense_status'
  | 'ambassador_update'
  | 'user_update'
  | 'system'
  | 'etude_update'
  | 'billing'
  | 'signature'
  | 'commercial_update';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface UserNotificationPreferences {
  email: boolean;
  push?: boolean;
  sound?: boolean;
  desktop?: boolean;
  types: Partial<Record<NotificationType, boolean>>;
}

export interface UpsertNotificationParams {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  groupKey?: string;
  metadata?: Record<string, unknown>;
  /** If true, increment count on unread existing grouped notif */
  group?: boolean;
}

export interface CreateSimpleNotificationParams {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
}

function sanitizeDocIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
}

export function buildNotificationDocId(userId: string, groupKey: string): string {
  return `${sanitizeDocIdPart(userId)}__${sanitizeDocIdPart(groupKey)}`;
}

export function getAppBaseUrl(): string {
  return (process.env.FRONTEND_URL || 'https://js-connect.fr').trim().replace(/\/$/, '');
}

/**
 * Base URL pour les liens e-mail.
 * Si le client envoie une origine localhost (dev), on l’utilise ;
 * sinon toujours FRONTEND_URL (prod) — pas d’URL arbitraire (anti-phishing).
 */
export function resolveAppBaseUrl(clientOrigin?: string | null): string {
  const configured = getAppBaseUrl();
  const raw = String(clientOrigin || '').trim().replace(/\/$/, '');
  if (!raw) return configured;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    const isLocal =
      host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
    if (isLocal && (u.protocol === 'http:' || u.protocol === 'https:')) {
      return `${u.protocol}//${u.host}`;
    }
  } catch {
    /* ignore invalid */
  }
  return configured;
}

export function getLogoUrl(): string {
  // Cache-bust (?v=2) : même URL que les templates EmailJS hardcodés.
  // Toujours le logo prod (accessible depuis les boîtes mail).
  return `https://js-connect.fr/images/logo.png?v=2`;
}

export function toAbsoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return getAppBaseUrl();
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
  const base = getAppBaseUrl();
  return `${base}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

const DEFAULT_PREFS: UserNotificationPreferences = {
  email: true,
  types: {},
};

export async function getUserNotificationPreferences(
  userId: string
): Promise<UserNotificationPreferences> {
  const snap = await admin.firestore().collection('users').doc(userId).get();
  if (!snap.exists) return DEFAULT_PREFS;
  const data = snap.data() || {};
  const prefs = data.notificationPreferences || {};
  return {
    email: prefs.email !== false,
    push: prefs.push,
    sound: prefs.sound,
    desktop: prefs.desktop,
    types: prefs.types || {},
  };
}

export function shouldSendInApp(
  prefs: UserNotificationPreferences,
  type: NotificationType,
  priority: NotificationPriority
): boolean {
  if (priority === 'urgent') return true;
  if (prefs.types[type] === false) return false;
  return true;
}

export function shouldSendEmail(
  prefs: UserNotificationPreferences,
  type: NotificationType,
  priority: NotificationPriority
): boolean {
  if (prefs.email === false) return false;
  if (priority === 'urgent') return true;
  if (prefs.types[type] === false) return false;
  return true;
}

export async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const user = await admin.auth().getUser(userId);
    return user.email && user.email.includes('@') ? user.email : null;
  } catch {
    const snap = await admin.firestore().collection('users').doc(userId).get();
    const email = snap.data()?.email;
    return typeof email === 'string' && email.includes('@') ? email : null;
  }
}

/**
 * Create a one-shot notification (new doc each time), respecting in-app prefs.
 */
export async function createNotification(
  params: CreateSimpleNotificationParams
): Promise<{ created: boolean; skipped?: string }> {
  const priority = params.priority || 'medium';
  const prefs = await getUserNotificationPreferences(params.recipientUserId);
  if (!shouldSendInApp(prefs, params.type, priority)) {
    return { created: false, skipped: 'prefs' };
  }

  await admin.firestore().collection('notifications').add({
    userId: params.recipientUserId,
    type: params.type,
    title: params.title,
    message: params.message,
    priority,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    metadata: {
      category: 'update',
      priority_label: priority === 'urgent' ? 'urgent' : priority === 'high' ? 'prioritaire' : 'important',
      ...(params.metadata || {}),
    },
  });
  return { created: true };
}

/**
 * Upsert a grouped notification (deterministic doc id), like ambassador pattern.
 */
export async function upsertGroupedNotification(
  params: UpsertNotificationParams
): Promise<{ created: boolean; skipped?: string }> {
  const priority = params.priority || 'medium';
  const prefs = await getUserNotificationPreferences(params.recipientUserId);
  if (!shouldSendInApp(prefs, params.type, priority)) {
    return { created: false, skipped: 'prefs' };
  }

  const db = admin.firestore();
  const groupKey = params.groupKey || `${params.type}:${Date.now()}`;
  const docId = buildNotificationDocId(params.recipientUserId, groupKey);
  const docRef = db.collection('notifications').doc(docId);
  const now = Timestamp.now();

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef);
    const base = {
      userId: params.recipientUserId,
      type: params.type,
      title: params.title,
      message: params.message,
      read: false,
      priority,
      groupKey,
      lastEventAt: now,
      createdAt: now,
      metadata: {
        category: 'update',
        priority_label: priority === 'urgent' ? 'urgent' : priority === 'high' ? 'prioritaire' : 'important',
        groupKey,
        ...(params.metadata || {}),
      },
    };

    if (!snap.exists || snap.data()?.read === true || !params.group) {
      transaction.set(docRef, { ...base, count: 1 });
      return;
    }

    const existing = snap.data() || {};
    const nextCount = (existing.count || 1) + 1;
    transaction.update(docRef, {
      title: params.title,
      message: params.message,
      count: nextCount,
      lastEventAt: now,
      'metadata.count': nextCount,
      ...(params.metadata
        ? Object.fromEntries(
            Object.entries(params.metadata).map(([k, v]) => [`metadata.${k}`, v])
          )
        : {}),
    });
  });

  return { created: true };
}

export async function notifyUsers(
  recipientIds: string[],
  params: Omit<CreateSimpleNotificationParams, 'recipientUserId'>
): Promise<void> {
  const unique = [...new Set(recipientIds.filter(Boolean))];
  await Promise.all(
    unique.map((recipientUserId) =>
      createNotification({ ...params, recipientUserId }).catch((err) => {
        console.error('notifyUsers error for', recipientUserId, err);
      })
    )
  );
}

export async function getStructureStaffUserIds(
  structureId: string,
  excludeUserId?: string
): Promise<string[]> {
  if (!structureId) return [];
  const snap = await admin
    .firestore()
    .collection('users')
    .where('structureId', '==', structureId)
    .get();

  const staffStatuses = new Set([
    'admin',
    'admin_structure',
    'membre',
    'member',
    'superadmin',
  ]);

  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() || {}) }))
    .filter((u: any) => {
      if (excludeUserId && u.id === excludeUserId) return false;
      const status = (u.status || u.role || '').toString();
      return staffStatuses.has(status) || !!u.structureId;
    })
    .map((u) => u.id);
}

export async function getStructureAdminUserIds(structureId: string): Promise<string[]> {
  if (!structureId) return [];
  const snap = await admin
    .firestore()
    .collection('users')
    .where('structureId', '==', structureId)
    .get();

  const adminStatuses = new Set(['admin', 'admin_structure', 'superadmin']);
  return snap.docs
    .filter((d) => {
      const status = (d.data()?.status || d.data()?.role || '').toString();
      return adminStatuses.has(status);
    })
    .map((d) => d.id);
}

export async function resolveUserDisplayName(userId: string): Promise<string> {
  try {
    const snap = await admin.firestore().collection('users').doc(userId).get();
    const d = snap.data() || {};
    const first = (d.firstName || d.prenom || '').toString().trim();
    const last = (d.lastName || d.nom || '').toString().trim();
    const full = `${first} ${last}`.trim();
    if (full) return full;
    if (d.displayName) return String(d.displayName);
    if (d.email) return String(d.email);
  } catch {
    /* ignore */
  }
  return 'Un utilisateur';
}
