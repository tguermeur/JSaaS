import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { createNotification, notifyUsers } from './core';
import { EMAILJS_GENERIC_SECRETS, maybeEmailUser } from './sendEmail';

const EMAILJS_SECRETS = [...EMAILJS_GENERIC_SECRETS];

const triggerConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 120,
  region: 'us-central1' as const,
  maxInstances: 5,
  secrets: EMAILJS_SECRETS,
};

function missionTitle(mission: FirebaseFirestore.DocumentData): string {
  return (
    (mission.title || mission.numeroMission || 'Mission').toString().trim() || 'Mission'
  );
}

function missionRedirect(missionId: string): string {
  return `/app/mission/${missionId}`;
}

async function getMissionStaffRecipientIds(
  mission: FirebaseFirestore.DocumentData,
  excludeUserId?: string
): Promise<string[]> {
  const ids = new Set<string>();
  if (mission.chargeId) ids.add(String(mission.chargeId));
  if (Array.isArray(mission.chargeIds)) {
    mission.chargeIds.forEach((id: string) => ids.add(String(id)));
  }
  if (mission.createdBy) ids.add(String(mission.createdBy));
  if (mission.permissions?.editors) {
    (mission.permissions.editors as string[]).forEach((id) => ids.add(String(id)));
  }
  if (excludeUserId) ids.delete(excludeUserId);
  return [...ids].filter(Boolean);
}

/**
 * applications/{id} create → notify mission staff
 * status Acceptée/Refusée → notify + email candidate
 */
export const onApplicationWrite = onDocumentWritten(
  { ...triggerConfig, document: 'applications/{applicationId}' },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    if (!after) return;

    const missionId = after.missionId as string | undefined;
    if (!missionId) return;

    const missionSnap = await admin.firestore().doc(`missions/${missionId}`).get();
    if (!missionSnap.exists) return;
    const mission = { id: missionSnap.id, ...(missionSnap.data() || {}) } as FirebaseFirestore.DocumentData & {
      id: string;
    };
    const title = missionTitle(mission);
    const redirectUrl = missionRedirect(missionId);
    const structureId = (mission.structureId as string) || undefined;

    // New application
    if (!before) {
      // Skip ambassador events — handled by ambassadorNotifications
      if (mission.type === 'ambassadeur_event') return;

      const staffIds = await getMissionStaffRecipientIds(mission, after.userId);
      if (staffIds.length === 0) return;

      await notifyUsers(staffIds, {
        type: 'mission_update',
        title: 'Nouvelle candidature',
        message: `Nouvelle candidature sur « ${title} ».`,
        priority: 'medium',
        metadata: {
          missionId,
          applicationId: event.params.applicationId,
          redirectUrl,
          source: 'application_create',
        },
      });
      return;
    }

    // Status change
    const prevStatus = (before.status || '').toString();
    const nextStatus = (after.status || '').toString();
    if (prevStatus === nextStatus) return;

    const candidateId = after.userId as string | undefined;
    if (!candidateId) return;

    const isAmbassador = mission.type === 'ambassadeur_event';
    const notifType = isAmbassador ? 'ambassador_update' : 'mission_update';
    const eventRedirect = isAmbassador
      ? `/app/ambassadeurs/event/${missionId}`
      : redirectUrl;

    if (nextStatus === 'Acceptée' || nextStatus === 'Refusée') {
      const accepted = nextStatus === 'Acceptée';
      await createNotification({
        recipientUserId: candidateId,
        type: notifType as any,
        title: accepted ? 'Candidature acceptée' : 'Candidature refusée',
        message: accepted
          ? `Votre candidature pour « ${title} » a été acceptée.`
          : `Votre candidature pour « ${title} » a été refusée.`,
        priority: accepted ? 'high' : 'medium',
        metadata: {
          missionId,
          redirectUrl: eventRedirect,
          applicationId: event.params.applicationId,
        },
      });

      if (isAmbassador) {
        await maybeEmailUser({
          userId: candidateId,
          type: 'ambassador_update',
          priority: accepted ? 'high' : 'medium',
          templateKey: 'AMBASSADOR_RESULT',
          subject: `${accepted ? 'Candidature acceptée' : 'Candidature refusée'} — ${title}`,
          templateParams: {
            event_title: title,
            status: nextStatus,
            event_link: eventRedirect,
          },
          linkFields: ['event_link'],
          structureId,
          logType: 'ambassador_application_result',
        });
      } else {
        await maybeEmailUser({
          userId: candidateId,
          type: 'mission_update',
          priority: accepted ? 'high' : 'medium',
          templateKey: accepted ? 'MISSION_ACCEPTED' : 'MISSION_REJECTED',
          subject: `${accepted ? 'Candidature acceptée' : 'Candidature refusée'} — ${title}`,
          templateParams: { mission_title: title, mission_link: redirectUrl },
          linkFields: ['mission_link'],
          structureId,
          logType: accepted ? 'mission_accepted' : 'mission_rejected',
        });
      }
    }
  }
);

/**
 * expenseNotes/{id} status Validée/Refusée → notify student (+ email on refuse)
 */
export const onExpenseNoteWrite = onDocumentWritten(
  { ...triggerConfig, document: 'expenseNotes/{expenseId}' },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    if (!before || !after) return;

    const prevStatus = (before.status || '').toString();
    const nextStatus = (after.status || '').toString();
    if (prevStatus === nextStatus) return;
    if (nextStatus !== 'Validée' && nextStatus !== 'Refusée') return;

    const userId = after.userId as string | undefined;
    if (!userId) return;

    const missionId = (after.missionId as string) || '';
    const amount = after.amount != null ? String(after.amount) : '';
    const redirectUrl = missionId ? missionRedirect(missionId) : '/app';
    let missionTitleStr = 'mission';
    let structureId: string | undefined;
    if (missionId) {
      const m = await admin.firestore().doc(`missions/${missionId}`).get();
      if (m.exists) {
        missionTitleStr = missionTitle(m.data() || {});
        structureId = m.data()?.structureId;
      }
    }

    await createNotification({
      recipientUserId: userId,
      type: 'expense_status',
      title: `Note de frais ${nextStatus.toLowerCase()}`,
      message: `Votre note de frais${amount ? ` de ${amount}€` : ''} a été ${nextStatus.toLowerCase()}.`,
      priority: nextStatus === 'Refusée' ? 'high' : 'medium',
      metadata: {
        missionId,
        expenseId: event.params.expenseId,
        redirectUrl,
      },
    });

    if (nextStatus === 'Refusée') {
      await maybeEmailUser({
        userId,
        type: 'expense_status',
        priority: 'high',
        templateKey: 'EXPENSE_REJECTED',
        subject: `Note de frais refusée — ${missionTitleStr}`,
        templateParams: {
          mission_title: missionTitleStr,
          reason: (after.refusalReason || after.reason || 'Non précisé').toString(),
          mission_link: redirectUrl,
        },
        linkFields: ['mission_link'],
        structureId,
        logType: 'expense_rejected',
      });
    }
  }
);

function slotsAssignedDiff(
  beforeSlots: unknown,
  afterSlots: unknown
): string[] {
  const beforeMap = new Map<string, Set<string>>();
  const afterMap = new Map<string, Set<string>>();

  const collect = (slots: unknown, map: Map<string, Set<string>>) => {
    if (!Array.isArray(slots)) return;
    for (const slot of slots) {
      const ids = Array.isArray(slot?.assignedStudentIds) ? slot.assignedStudentIds : [];
      for (const id of ids) {
        if (!map.has(id)) map.set(id, new Set());
        map.get(id)!.add(String(slot?.id || ''));
      }
    }
  };
  collect(beforeSlots, beforeMap);
  collect(afterSlots, afterMap);

  const newlyAssigned: string[] = [];
  for (const [studentId] of afterMap) {
    if (!beforeMap.has(studentId)) newlyAssigned.push(studentId);
  }
  return newlyAssigned;
}

/**
 * Mission slots: newly assigned students → notif + email
 * Also chargeId change on standard missions
 */
export const onMissionAssignmentWrite = onDocumentWritten(
  { ...triggerConfig, document: 'missions/{missionId}' },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    if (!after) return;

    const missionId = event.params.missionId;
    const title = missionTitle(after);
    const redirectUrl = missionRedirect(missionId);
    const structureId = after.structureId as string | undefined;

    // Slot assignments (ambassador / slotted missions)
    if (before) {
      const newlyAssigned = slotsAssignedDiff(before.slots, after.slots);
      await Promise.all(
        newlyAssigned.map(async (studentId) => {
          await createNotification({
            recipientUserId: studentId,
            type: 'mission_update',
            title: 'Mission assignée',
            message: `Vous avez été assigné(e) à « ${title} ».`,
            priority: 'high',
            metadata: { missionId, redirectUrl, source: 'slot_assign' },
          });
          await maybeEmailUser({
            userId: studentId,
            type: 'mission_update',
            priority: 'high',
            templateKey: 'MISSION_ASSIGNED',
            subject: `Mission assignée — ${title}`,
            templateParams: { mission_title: title, mission_link: redirectUrl },
            linkFields: ['mission_link'],
            structureId,
            logType: 'mission_assigned',
          });
        })
      );
    }

    // Standard mission: chargeId changed to a new person
    if (before && after.chargeId && before.chargeId !== after.chargeId) {
      const chargeId = String(after.chargeId);
      await createNotification({
        recipientUserId: chargeId,
        type: 'mission_update',
        title: 'Mission assignée',
        message: `Vous êtes maintenant chargé(e) de « ${title} ».`,
        priority: 'high',
        metadata: { missionId, redirectUrl, source: 'charge_assign' },
      });
      await maybeEmailUser({
        userId: chargeId,
        type: 'mission_update',
        priority: 'high',
        templateKey: 'MISSION_ASSIGNED',
        subject: `Mission assignée — ${title}`,
        templateParams: { mission_title: title, mission_link: redirectUrl },
        linkFields: ['mission_link'],
        structureId,
        logType: 'mission_assigned',
      });
    }
  }
);
