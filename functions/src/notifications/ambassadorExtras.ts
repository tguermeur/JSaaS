import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { notifyUsers } from './core';

/**
 * J-1 reminder for ambassador events (missions type ambassadeur_event).
 * Uses startDate (YYYY-MM-DD) when present.
 */
export const flushAmbassadorEventReminders = onSchedule(
  {
    schedule: '0 10 * * *',
    timeZone: 'Europe/Paris',
    memory: '256MiB',
    timeoutSeconds: 300,
    region: 'us-central1',
    maxInstances: 1,
  },
  async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    const targetDate = `${yyyy}-${mm}-${dd}`;

    const snap = await admin
      .firestore()
      .collection('missions')
      .where('type', '==', 'ambassadeur_event')
      .where('startDate', '==', targetDate)
      .limit(100)
      .get();

    for (const doc of snap.docs) {
      const mission = doc.data();
      const eventId = doc.id;
      const title = (mission.title || mission.campaignName || 'Événement').toString();
      const redirectUrl = `/app/ambassadeurs/event/${eventId}`;

      const markerRef = admin
        .firestore()
        .collection('ambassadorDigestState')
        .doc(`reminder_j1_${eventId}`);
      const marker = await markerRef.get();
      if (marker.exists) continue;

      // Accepted applicants
      const apps = await admin
        .firestore()
        .collection('applications')
        .where('missionId', '==', eventId)
        .where('status', '==', 'Acceptée')
        .get();

      const applicantIds = apps.docs
        .map((d) => d.data().userId as string)
        .filter(Boolean);

      // Also slot assignees
      const slotIds = new Set<string>();
      if (Array.isArray(mission.slots)) {
        for (const slot of mission.slots) {
          (slot.assignedStudentIds || []).forEach((id: string) => slotIds.add(id));
        }
      }

      const recipients = [...new Set([...applicantIds, ...slotIds])];
      if (recipients.length === 0) {
        // Notify structure charge at least
        if (mission.chargeId) recipients.push(String(mission.chargeId));
      }

      await notifyUsers(recipients, {
        type: 'ambassador_update',
        title: 'Rappel événement demain',
        message: `L'événement « ${title} » a lieu demain.`,
        priority: 'high',
        metadata: { eventId, redirectUrl, source: 'ambassador_j1' },
      });

      await markerRef.set({
        eventId,
        kind: 'j1_reminder',
        sentAt: FieldValue.serverTimestamp(),
      });
    }
  }
);
