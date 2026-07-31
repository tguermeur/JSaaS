import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  getEnterpriseContactUserIds,
  getStructureStaffUserIds,
  resolveActorDisplayName,
  resolveCompanyName,
} from './ambassadorNotificationRecipients';

const triggerConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 120,
  region: 'us-central1' as const,
  maxInstances: 5,
};

type AmbassadorEventKind =
  | 'proposal_request'
  | 'document'
  | 'application'
  | 'application_digest';

type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

const APPLICATION_DIGEST_THRESHOLD = 3;
const APPLICATION_DIGEST_DELAY_MS = 4 * 60 * 60 * 1000;

function sanitizeDocIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
}

function buildNotificationDocId(userId: string, groupKey: string): string {
  return `${sanitizeDocIdPart(userId)}__${sanitizeDocIdPart(groupKey)}`;
}

function buildDigestStateDocId(eventId: string, userId: string): string {
  return `${sanitizeDocIdPart(eventId)}__${sanitizeDocIdPart(userId)}`;
}

function getEventTitle(mission: FirebaseFirestore.DocumentData): string {
  return (
    (mission.title || mission.campaignName || 'Événement ambassadeur').toString().trim() ||
    'Événement ambassadeur'
  );
}

function buildRedirectUrl(eventId: string): string {
  return `/app/ambassadeurs/event/${eventId}`;
}

function buildMessages(params: {
  eventKind: AmbassadorEventKind;
  eventTitle: string;
  count: number;
  actorName?: string;
  companyName?: string;
  documentType?: string;
}): { title: string; message: string } {
  const { eventKind, eventTitle, count, actorName, companyName, documentType } = params;

  switch (eventKind) {
    case 'proposal_request':
      return {
        title: 'Demande de proposition commerciale',
        message: `${companyName || 'Une entreprise'} demande une proposition pour « ${eventTitle} ».`,
      };
    case 'document': {
      const docLabel =
        documentType === 'proposition_commerciale' ? 'proposition commerciale' : 'document';
      if (count <= 1) {
        return {
          title: 'Nouveau document ambassadeur',
          message: `Un nouveau ${docLabel} est disponible sur « ${eventTitle} ».`,
        };
      }
      return {
        title: 'Nouveaux documents ambassadeur',
        message: `${count} nouveaux documents sur « ${eventTitle} ».`,
      };
    }
    case 'application':
      if (count <= 1) {
        return {
          title: 'Nouvelle candidature ambassadeur',
          message: `${actorName || 'Un ambassadeur'} a postulé sur « ${eventTitle} ».`,
        };
      }
      return {
        title: 'Nouvelles candidatures ambassadeur',
        message: `${count} nouvelles candidatures sur « ${eventTitle} ».`,
      };
    case 'application_digest':
      return {
        title: 'Résumé des candidatures',
        message: `${count} candidature${count > 1 ? 's' : ''} reçue${count > 1 ? 's' : ''} sur « ${eventTitle} ».`,
      };
    default:
      return {
        title: 'Mise à jour ambassadeur',
        message: `Activité sur « ${eventTitle} ».`,
      };
  }
}

interface UpsertGroupedNotificationParams {
  recipientUserId: string;
  groupKey: string;
  eventId: string;
  eventKind: AmbassadorEventKind;
  eventTitle: string;
  priority: NotificationPriority;
  actorUserId?: string;
  actorName?: string;
  companyName?: string;
  documentType?: string;
  digestMode?: boolean;
  hidden?: boolean;
  setCount?: number;
}

export async function upsertGroupedNotification(
  params: UpsertGroupedNotificationParams
): Promise<void> {
  const db = admin.firestore();
  const docId = buildNotificationDocId(params.recipientUserId, params.groupKey);
  const docRef = db.collection('notifications').doc(docId);
  const now = Timestamp.now();

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef);
    const actorIds = params.actorUserId ? [params.actorUserId] : [];

    if (!snap.exists) {
      const initialCount = params.setCount ?? 1;
      const { title, message } = buildMessages({
        eventKind: params.eventKind,
        eventTitle: params.eventTitle,
        count: initialCount,
        actorName: params.actorName,
        companyName: params.companyName,
        documentType: params.documentType,
      });

      transaction.set(docRef, {
        userId: params.recipientUserId,
        type: 'ambassador_update',
        title,
        message,
        read: false,
        priority: params.priority,
        groupKey: params.groupKey,
        count: initialCount,
        lastEventAt: now,
        createdAt: now,
        digestMode: params.digestMode === true,
        hidden: params.hidden === true,
        metadata: {
          source: 'ambassador',
          eventId: params.eventId,
          redirectUrl: buildRedirectUrl(params.eventId),
          groupKey: params.groupKey,
          eventKind: params.eventKind,
          count: initialCount,
          actorIds,
          documentType: params.documentType || null,
          category: 'engagement',
          priority_label: params.priority === 'high' ? 'prioritaire' : 'important',
          lastEventAt: now,
          hidden: params.hidden === true,
        },
      });
      return;
    }

    const existing = snap.data() || {};
    if (existing.read === true) {
      const initialCount = params.setCount ?? 1;
      const { title, message } = buildMessages({
        eventKind: params.eventKind,
        eventTitle: params.eventTitle,
        count: initialCount,
        actorName: params.actorName,
        companyName: params.companyName,
        documentType: params.documentType,
      });

      transaction.set(docRef, {
        userId: params.recipientUserId,
        type: 'ambassador_update',
        title,
        message,
        read: false,
        priority: params.priority,
        groupKey: params.groupKey,
        count: initialCount,
        lastEventAt: now,
        createdAt: now,
        digestMode: params.digestMode === true,
        hidden: params.hidden === true,
        metadata: {
          source: 'ambassador',
          eventId: params.eventId,
          redirectUrl: buildRedirectUrl(params.eventId),
          groupKey: params.groupKey,
          eventKind: params.eventKind,
          count: initialCount,
          actorIds,
          documentType: params.documentType || null,
          category: 'engagement',
          priority_label: params.priority === 'high' ? 'prioritaire' : 'important',
          lastEventAt: now,
          hidden: params.hidden === true,
        },
      });
      return;
    }

    const nextCount = params.setCount ?? (existing.count || 1) + 1;
    const mergedActorIds = Array.from(
      new Set([...(existing.metadata?.actorIds || []), ...actorIds])
    ).slice(0, 10);

    const { title, message } = buildMessages({
      eventKind: params.eventKind,
      eventTitle: params.eventTitle,
      count: nextCount,
      actorName: params.actorName,
      companyName: params.companyName,
      documentType: params.documentType,
    });

    transaction.update(docRef, {
      title,
      message,
      count: nextCount,
      lastEventAt: now,
      hidden: params.hidden === true,
      'metadata.count': nextCount,
      'metadata.actorIds': mergedActorIds,
      'metadata.lastEventAt': now,
      'metadata.hidden': params.hidden === true,
    });
  });
}

async function notifyRecipients(
  recipientIds: string[],
  params: Omit<UpsertGroupedNotificationParams, 'recipientUserId'>
): Promise<void> {
  const uniqueIds = [...new Set(recipientIds)];
  await Promise.all(
    uniqueIds.map((recipientUserId) =>
      upsertGroupedNotification({ ...params, recipientUserId })
    )
  );
}

async function loadAmbassadorMission(
  missionId: string
): Promise<FirebaseFirestore.DocumentData | null> {
  const missionDoc = await admin.firestore().doc(`missions/${missionId}`).get();
  if (!missionDoc.exists) return null;

  const mission = missionDoc.data() || {};
  if (mission.type !== 'ambassadeur_event') return null;

  return { id: missionDoc.id, ...mission };
}

function slotsArrayChanged(before?: unknown, after?: unknown): boolean {
  const beforeIds = Array.isArray(before) ? [...before].sort().join(',') : '';
  const afterIds = Array.isArray(after) ? [...after].sort().join(',') : '';
  return beforeIds !== afterIds;
}

async function incrementApplicationDigest(
  eventId: string,
  eventTitle: string,
  companyId: string,
  actorUserId: string
): Promise<void> {
  const db = admin.firestore();
  const recipientIds = await getEnterpriseContactUserIds(companyId, actorUserId);
  if (recipientIds.length === 0) return;

  const groupKey = `ambassador:${eventId}:applications_digest`;

  await Promise.all(
    recipientIds.map(async (recipientUserId) => {
      const stateRef = db
        .collection('ambassadorDigestState')
        .doc(buildDigestStateDocId(eventId, recipientUserId));
      const now = Timestamp.now();

      const shouldNotify = await db.runTransaction(async (transaction) => {
        const stateSnap = await transaction.get(stateRef);
        const notifRef = db
          .collection('notifications')
          .doc(buildNotificationDocId(recipientUserId, groupKey));
        const notifSnap = await transaction.get(notifRef);

        const existing = stateSnap.data() || {};
        const digestWasRead = notifSnap.exists && notifSnap.data()?.read === true;

        if (existing.notified === true && digestWasRead) {
          transaction.set(
            stateRef,
            {
              eventId,
              userId: recipientUserId,
              companyId,
              count: 1,
              firstAt: now,
              lastAt: now,
              notified: false,
            },
            { merge: true }
          );
          return { notify: false, count: 1 };
        }

        if (existing.notified === true) {
          return { notify: false, count: existing.count || 0 };
        }

        const nextCount = (existing.count || 0) + 1;
        const firstAt = existing.firstAt || now;

        transaction.set(
          stateRef,
          {
            eventId,
            userId: recipientUserId,
            companyId,
            count: nextCount,
            firstAt,
            lastAt: now,
            notified: false,
          },
          { merge: true }
        );

        return { notify: nextCount >= APPLICATION_DIGEST_THRESHOLD, count: nextCount };
      });

      if (!shouldNotify.notify) return;

      await upsertGroupedNotification({
        recipientUserId,
        groupKey,
        eventId,
        eventKind: 'application_digest',
        eventTitle,
        priority: 'low',
        digestMode: true,
        setCount: shouldNotify.count,
      });

      await stateRef.set({ notified: true, notifiedAt: Timestamp.now() }, { merge: true });
    })
  );
}

export const onAmbassadorApplicationWrite = onDocumentWritten(
  { ...triggerConfig, document: 'applications/{applicationId}' },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;

    const application = after.data() || {};
    if (application.isFromManualAdd === true) return;

    const before = event.data?.before?.exists ? event.data.before.data() || {} : null;
    const isCreate = !event.data?.before?.exists;
    const slotsChanged =
      before != null && slotsArrayChanged(before.selectedSlotIds, application.selectedSlotIds);

    if (!isCreate && !slotsChanged) return;

    const mission = await loadAmbassadorMission(application.missionId);
    if (!mission) return;

    const eventId = mission.id as string;
    const structureId = (mission.structureId || '').toString();
    const companyId = (mission.companyId || '').toString();
    const eventTitle = getEventTitle(mission);
    const actorUserId = (application.userId || '').toString();
    const actorName = await resolveActorDisplayName(actorUserId);

    const structureRecipients = await getStructureStaffUserIds(structureId, actorUserId);
    await notifyRecipients(structureRecipients, {
      groupKey: `ambassador:${eventId}:applications`,
      eventId,
      eventKind: 'application',
      eventTitle,
      priority: 'medium',
      actorUserId,
      actorName,
    });

    if (companyId) {
      await incrementApplicationDigest(eventId, eventTitle, companyId, actorUserId);
    }
  }
);

export const onAmbassadorDocumentWrite = onDocumentWritten(
  { ...triggerConfig, document: 'generatedDocuments/{documentId}' },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;

    const docData = after.data() || {};
    const before = event.data?.before?.exists ? event.data.before.data() || {} : null;
    const isCreate = !event.data?.before?.exists;
    const visibilityOpened =
      before != null && before.visibleToCompany !== true && docData.visibleToCompany === true;

    if (!isCreate && !visibilityOpened) return;
    if (docData.visibleToCompany !== true) return;

    const tags: string[] = Array.isArray(docData.tags) ? docData.tags : [];
    const isAmbassadorDoc =
      tags.includes('ambassadeur_event') || tags.includes('proposition_commerciale');
    if (!isAmbassadorDoc) return;

    const missionId = (docData.missionId || '').toString();
    if (!missionId) return;

    const mission = await loadAmbassadorMission(missionId);
    if (!mission) return;

    const eventId = mission.id as string;
    const companyId = (mission.companyId || '').toString();
    if (!companyId) return;

    const actorUserId = (docData.createdBy || '').toString();
    const eventTitle = getEventTitle(mission);
    const documentType = (docData.documentType || '').toString();

    const enterpriseRecipients = await getEnterpriseContactUserIds(companyId, actorUserId);
    await notifyRecipients(enterpriseRecipients, {
      groupKey: `ambassador:${eventId}:documents`,
      eventId,
      eventKind: 'document',
      eventTitle,
      priority: 'medium',
      actorUserId,
      documentType,
    });
  }
);

export const onAmbassadorProposalRequest = onDocumentWritten(
  { ...triggerConfig, document: 'missions/{missionId}' },
  async (event) => {
    const after = event.data?.after;
    const before = event.data?.before;
    if (!after?.exists || !before?.exists) return;

    const afterData = after.data() || {};
    const beforeData = before.data() || {};

    if (afterData.type !== 'ambassadeur_event') return;

    const beforeTs = beforeData.lastCommercialProposalRequestedAt;
    const afterTs = afterData.lastCommercialProposalRequestedAt;
    if (!afterTs || beforeTs?.toMillis?.() === afterTs?.toMillis?.()) return;

    const eventId = after.id;
    const structureId = (afterData.structureId || '').toString();
    const companyId = (afterData.companyId || '').toString();
    const actorUserId = (afterData.lastCommercialProposalRequestedBy || '').toString();
    const eventTitle = getEventTitle(afterData);
    const companyName = await resolveCompanyName(companyId);

    const structureRecipients = await getStructureStaffUserIds(structureId, actorUserId);
    await notifyRecipients(structureRecipients, {
      groupKey: `ambassador:${eventId}:proposal_request`,
      eventId,
      eventKind: 'proposal_request',
      eventTitle,
      priority: 'high',
      actorUserId,
      companyName,
    });
  }
);

export const flushAmbassadorApplicationDigests = onSchedule(
  {
    schedule: 'every 60 minutes',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 300,
  },
  async () => {
    const db = admin.firestore();
    const cutoff = Timestamp.fromMillis(Date.now() - APPLICATION_DIGEST_DELAY_MS);

    const pendingSnap = await db
      .collection('ambassadorDigestState')
      .where('notified', '==', false)
      .where('count', '>', 0)
      .where('lastAt', '<=', cutoff)
      .limit(200)
      .get();

    if (pendingSnap.empty) return;

    await Promise.all(
      pendingSnap.docs.map(async (stateDoc) => {
        const state = stateDoc.data();
        const eventId = (state.eventId || '').toString();
        const recipientUserId = (state.userId || '').toString();
        const count = state.count || 0;
        if (!eventId || !recipientUserId || count <= 0) return;

        const missionDoc = await db.doc(`missions/${eventId}`).get();
        if (!missionDoc.exists) return;

        const mission = missionDoc.data() || {};
        if (mission.type !== 'ambassadeur_event') return;

        const eventTitle = getEventTitle(mission);
        const groupKey = `ambassador:${eventId}:applications_digest`;

        await upsertGroupedNotification({
          recipientUserId,
          groupKey,
          eventId,
          eventKind: 'application_digest',
          eventTitle,
          priority: 'low',
          digestMode: true,
          setCount: count,
        });

        await stateDoc.ref.set(
          { notified: true, notifiedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      })
    );
  }
);
