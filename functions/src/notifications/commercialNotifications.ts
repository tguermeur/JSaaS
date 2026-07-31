import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { createNotification } from './core';

const triggerConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 120,
  region: 'us-central1' as const,
  maxInstances: 5,
};

function prospectName(data: FirebaseFirestore.DocumentData): string {
  return (
    (data.companyName || data.name || data.raisonSociale || 'Prospect').toString().trim() ||
    'Prospect'
  );
}

/**
 * prospects/{id}: ownerId change → notify new owner
 */
export const onProspectWrite = onDocumentWritten(
  { ...triggerConfig, document: 'prospects/{prospectId}' },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    if (!after) return;

    const prospectId = event.params.prospectId;
    const name = prospectName(after);
    const newOwner = after.ownerId as string | undefined;
    if (!newOwner) return;

    const prevOwner = before?.ownerId as string | undefined;
    if (before && prevOwner === newOwner) return;
    if (!before && !newOwner) return;

    // Only notify on assign / reassign
    if (before && prevOwner === newOwner) return;

    await createNotification({
      recipientUserId: newOwner,
      type: 'commercial_update',
      title: before ? 'Prospect réassigné' : 'Prospect assigné',
      message: `Le prospect « ${name} » vous a été assigné.`,
      priority: 'medium',
      metadata: {
        prospectId,
        redirectUrl: `/app/prospect/${prospectId}`,
        source: 'prospect_assign',
      },
    });
  }
);

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function endOfTodayIso(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString().slice(0, 10);
}

/**
 * Daily: notify owners of prospects with dateRecontact = today
 */
export const flushCommercialRelanceReminders = onSchedule(
  {
    schedule: '0 8 * * *',
    timeZone: 'Europe/Paris',
    memory: '256MiB',
    timeoutSeconds: 300,
    region: 'us-central1',
    maxInstances: 1,
  },
  async () => {
    const today = startOfTodayIso();
    const snap = await admin
      .firestore()
      .collection('prospects')
      .where('dateRecontact', '>=', today)
      .where('dateRecontact', '<=', endOfTodayIso())
      .limit(200)
      .get();

    // Fallback: also try Date objects stored as timestamps — query may miss; scan recent
    const byOwner = new Map<string, { count: number; names: string[] }>();

    for (const doc of snap.docs) {
      const data = doc.data();
      const ownerId = data.ownerId as string | undefined;
      if (!ownerId) continue;
      const name = prospectName(data);
      const entry = byOwner.get(ownerId) || { count: 0, names: [] };
      entry.count += 1;
      if (entry.names.length < 3) entry.names.push(name);
      byOwner.set(ownerId, entry);
    }

    await Promise.all(
      [...byOwner.entries()].map(([ownerId, info]) =>
        createNotification({
          recipientUserId: ownerId,
          type: 'commercial_update',
          title: 'Relances du jour',
          message:
            info.count === 1
              ? `Relance prévue pour « ${info.names[0]} ».`
              : `${info.count} relances prévues aujourd'hui (${info.names.join(', ')}${info.count > 3 ? '…' : ''}).`,
          priority: 'medium',
          metadata: {
            redirectUrl: '/app/commercial',
            source: 'relance_due',
            count: info.count,
          },
        })
      )
    );
  }
);
