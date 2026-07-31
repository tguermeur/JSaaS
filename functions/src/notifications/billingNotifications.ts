import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import {
  createNotification,
  getStructureAdminUserIds,
  notifyUsers,
} from './core';
import { EMAILJS_GENERIC_SECRETS, maybeEmailUser, sendTemplatedEmail } from './sendEmail';
import { getUserEmail } from './core';

/**
 * Helpers called from stripe webhook handlers.
 */
export async function notifyPaymentFailed(structureId: string): Promise<void> {
  if (!structureId) return;
  const structureSnap = await admin.firestore().doc(`structures/${structureId}`).get();
  const structureName =
    (structureSnap.data()?.name || structureSnap.data()?.nom || 'votre structure').toString();
  const billingLink = '/app/settings/billing';
  const admins = await getStructureAdminUserIds(structureId);

  await notifyUsers(admins, {
    type: 'billing',
    title: 'Échec de paiement',
    message: `Le paiement de l'abonnement de « ${structureName} » a échoué.`,
    priority: 'urgent',
    metadata: { structureId, redirectUrl: billingLink, source: 'payment_failed' },
  });

  await Promise.all(
    admins.map((uid) =>
      maybeEmailUser({
        userId: uid,
        type: 'billing',
        priority: 'urgent',
        templateKey: 'PAYMENT_FAILED',
        subject: `Échec de paiement — ${structureName}`,
        templateParams: { structure_name: structureName, billing_link: billingLink },
        linkFields: ['billing_link'],
        structureId,
        logType: 'payment_failed',
      })
    )
  );
}

export async function notifyCotisationPaid(params: {
  userId: string;
  amount: string;
  structureId?: string;
}): Promise<void> {
  const link = '/app';
  await createNotification({
    recipientUserId: params.userId,
    type: 'billing',
    title: 'Cotisation payée',
    message: `Votre cotisation de ${params.amount} a bien été enregistrée.`,
    priority: 'medium',
    metadata: { redirectUrl: link, source: 'cotisation_paid' },
  });
  await maybeEmailUser({
    userId: params.userId,
    type: 'billing',
    templateKey: 'COTISATION_PAID',
    subject: 'Cotisation payée — JS Connect',
    templateParams: { amount: params.amount, link },
    linkFields: ['link'],
    structureId: params.structureId,
    logType: 'cotisation_paid',
  });
}

export async function notifyCotisationFailed(params: {
  userId: string;
  amount?: string;
  structureId?: string;
}): Promise<void> {
  const link = '/app/cotisation';
  await createNotification({
    recipientUserId: params.userId,
    type: 'billing',
    title: 'Échec de cotisation',
    message: 'Le paiement de votre cotisation a échoué.',
    priority: 'high',
    metadata: { redirectUrl: link, source: 'cotisation_failed' },
  });
  await maybeEmailUser({
    userId: params.userId,
    type: 'billing',
    priority: 'high',
    templateKey: 'COTISATION_DUE',
    subject: 'Cotisation à régler — JS Connect',
    templateParams: { amount: params.amount || '', link },
    linkFields: ['link'],
    structureId: params.structureId,
    logType: 'cotisation_due',
  });
}

/**
 * Daily: trial ending in 7 / 3 / 1 days
 */
const BILLING_EMAIL_SECRETS = [...EMAILJS_GENERIC_SECRETS];

export const flushTrialEndingReminders = onSchedule(
  {
    schedule: '0 9 * * *',
    timeZone: 'Europe/Paris',
    memory: '256MiB',
    timeoutSeconds: 300,
    region: 'us-central1',
    maxInstances: 1,
    secrets: BILLING_EMAIL_SECRETS,
  },
  async () => {
    const db = admin.firestore();
    const now = Date.now();
    const targets = [7, 3, 1];

    // subscriptions collection: look for trial_end
    const snap = await db.collection('subscriptions').limit(500).get();

    for (const doc of snap.docs) {
      const data = doc.data();
      const structureId = (data.structureId || doc.id) as string;
      let trialEndMs: number | null = null;

      if (data.trial_end) {
        trialEndMs =
          typeof data.trial_end === 'number'
            ? data.trial_end * (data.trial_end < 1e12 ? 1000 : 1)
            : data.trial_end?.toMillis?.() ?? null;
      } else if (data.trialEnd) {
        trialEndMs =
          typeof data.trialEnd === 'number'
            ? data.trialEnd * (data.trialEnd < 1e12 ? 1000 : 1)
            : data.trialEnd?.toMillis?.() ?? null;
      } else if (data.status === 'trialing' && data.current_period_end) {
        trialEndMs =
          typeof data.current_period_end === 'number'
            ? data.current_period_end * (data.current_period_end < 1e12 ? 1000 : 1)
            : null;
      }

      if (!trialEndMs) continue;

      const daysLeft = Math.ceil((trialEndMs - now) / (24 * 60 * 60 * 1000));
      if (!targets.includes(daysLeft)) continue;

      // Dedup: marker doc
      const markerId = `${structureId}_trial_${daysLeft}`;
      const markerRef = db.collection('billingNotificationState').doc(markerId);
      const marker = await markerRef.get();
      if (marker.exists) continue;

      const structureSnap = await db.doc(`structures/${structureId}`).get();
      const structureName = (
        structureSnap.data()?.name ||
        structureSnap.data()?.nom ||
        'votre structure'
      ).toString();
      const billingLink = '/app/settings/billing';
      const admins = await getStructureAdminUserIds(structureId);
      if (admins.length === 0) continue;

      await notifyUsers(admins, {
        type: 'billing',
        title: "Fin de période d'essai",
        message: `L'essai de « ${structureName} » se termine dans ${daysLeft} jour(s).`,
        priority: daysLeft <= 1 ? 'urgent' : 'high',
        metadata: { structureId, redirectUrl: billingLink, daysLeft, source: 'trial_ending' },
      });

      await Promise.all(
        admins.map((uid) =>
          maybeEmailUser({
            userId: uid,
            type: 'billing',
            priority: daysLeft <= 1 ? 'urgent' : 'high',
            templateKey: 'TRIAL_ENDING',
            subject: `Fin d'essai dans ${daysLeft} j — ${structureName}`,
            templateParams: {
              structure_name: structureName,
              days_left: daysLeft,
              billing_link: billingLink,
            },
            linkFields: ['billing_link'],
            structureId,
            logType: 'trial_ending',
          })
        )
      );

      await markerRef.set({
        structureId,
        daysLeft,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);

/** Send welcome email (callable helper / auth hook) */
export async function sendWelcomeEmail(userId: string, firstName?: string): Promise<void> {
  const email = await getUserEmail(userId);
  if (!email) return;
  await sendTemplatedEmail({
    templateKey: 'WELCOME',
    toEmail: email,
    subject: 'Bienvenue sur JS Connect',
    templateParams: {
      first_name: firstName || '',
      app_link: '/app',
    },
    linkFields: ['app_link'],
    logType: 'welcome',
  });
}
