import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { createNotification, notifyUsers } from './core';
import { EMAILJS_GENERIC_SECRETS, maybeEmailUser } from './sendEmail';

const triggerConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 120,
  region: 'us-central1' as const,
  maxInstances: 5,
  secrets: [...EMAILJS_GENERIC_SECRETS],
};

function etudeTitle(data: FirebaseFirestore.DocumentData): string {
  return (data.title || data.name || data.numero || 'Étude').toString().trim() || 'Étude';
}

function etudeRedirect(etudeId: string): string {
  return `/app/etude/${etudeId}`;
}

function collectChargeIds(data: FirebaseFirestore.DocumentData): string[] {
  const ids = new Set<string>();
  if (data.chargeId) ids.add(String(data.chargeId));
  if (Array.isArray(data.chargeIds)) {
    data.chargeIds.forEach((id: string) => ids.add(String(id)));
  }
  if (data.permissions?.editors) {
    (data.permissions.editors as string[]).forEach((id) => ids.add(String(id)));
  }
  return [...ids].filter(Boolean);
}

function diffNewIds(before: string[], after: string[]): string[] {
  const prev = new Set(before);
  return after.filter((id) => !prev.has(id));
}

/**
 * études/{id}: création, nouvel assigné (charge), changement d'étape/statut
 */
export const onEtudeWrite = onDocumentWritten(
  { ...triggerConfig, document: 'etudes/{etudeId}' },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    if (!after) return;

    const etudeId = event.params.etudeId;
    const title = etudeTitle(after);
    const redirectUrl = etudeRedirect(etudeId);
    const structureId = after.structureId as string | undefined;

    // Created
    if (!before) {
      const charges = collectChargeIds(after).filter((id) => id !== after.createdBy);
      if (charges.length > 0) {
        await notifyUsers(charges, {
          type: 'etude_update',
          title: 'Nouvelle étude',
          message: `L'étude « ${title} » a été créée.`,
          priority: 'medium',
          metadata: { etudeId, redirectUrl, source: 'etude_create' },
        });
      }
      return;
    }

    // New charges assigned
    const beforeCharges = collectChargeIds(before);
    const afterCharges = collectChargeIds(after);
    const newlyAssigned = diffNewIds(beforeCharges, afterCharges);

    await Promise.all(
      newlyAssigned.map(async (userId) => {
        await createNotification({
          recipientUserId: userId,
          type: 'etude_update',
          title: 'Étude assignée',
          message: `Vous avez été assigné(e) à l'étude « ${title} ».`,
          priority: 'high',
          metadata: { etudeId, redirectUrl, source: 'etude_assign' },
        });
        await maybeEmailUser({
          userId,
          type: 'etude_update',
          priority: 'high',
          templateKey: 'ETUDE_ASSIGNED',
          subject: `Étude assignée — ${title}`,
          templateParams: { etude_title: title, etude_link: redirectUrl },
          linkFields: ['etude_link'],
          structureId,
          logType: 'etude_assigned',
        });
      })
    );

    // Status / étape change → notify charges
    const statusChanged =
      (before.status || '') !== (after.status || '') ||
      (before.etape || '') !== (after.etape || '');
    if (statusChanged && afterCharges.length > 0) {
      const label = (after.etape || after.status || 'mise à jour').toString();
      await notifyUsers(afterCharges, {
        type: 'etude_update',
        title: 'Étude mise à jour',
        message: `« ${title} » : ${label}.`,
        priority: 'low',
        metadata: { etudeId, redirectUrl, source: 'etude_status' },
      });
    }
  }
);
