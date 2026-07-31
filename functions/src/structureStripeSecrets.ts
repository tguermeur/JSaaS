import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { assertCanManageStructure } from './authHelpers';

const functionConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 120,
  cors: true,
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 2,
  // concurrency > 1 exige 1 CPU entier (Cloud Functions v2) — ces callables sont peu sollicitées
  concurrency: 1,
  allowUnauthenticated: false,
};

const signupConfig = {
  ...functionConfig,
  allowUnauthenticated: true,
};

function privateStripeRef(structureId: string) {
  return admin.firestore().collection('structures').doc(structureId).collection('private').doc('stripe');
}

/** Lit la clé secrète Stripe (sous-collection privée, avec migration depuis l’ancien champ structure). */
export async function getStructureStripeSecretKey(structureId: string): Promise<string | null> {
  const privateSnap = await privateStripeRef(structureId).get();
  if (privateSnap.exists && privateSnap.data()?.secretKey) {
    return privateSnap.data()!.secretKey as string;
  }

  const structureSnap = await admin.firestore().collection('structures').doc(structureId).get();
  const legacy = structureSnap.data()?.stripeSecretKey as string | undefined;
  if (!legacy) return null;

  await privateStripeRef(structureId).set(
    {
      secretKey: legacy,
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await structureSnap.ref.update({
    stripeSecretKey: admin.firestore.FieldValue.delete(),
    stripeSecretConfigured: true,
  });
  return legacy;
}

function getEmailDomain(email: string): string {
  const trimmed = (email || '').trim().toLowerCase();
  if (!trimmed.includes('@')) return '@' + trimmed;
  return '@' + trimmed.split('@')[1];
}

/** Enregistre la clé secrète Stripe côté serveur uniquement (admin structure). */
export const saveStructureStripeSecret = onCall(functionConfig, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentification requise.');
  }
  const { structureId, secretKey } = request.data as { structureId?: string; secretKey?: string };
  if (!structureId || !secretKey || typeof secretKey !== 'string') {
    throw new HttpsError('invalid-argument', 'structureId et secretKey requis.');
  }
  const trimmed = secretKey.trim();
  if (!trimmed.startsWith('sk_test_') && !trimmed.startsWith('sk_live_')) {
    throw new HttpsError('invalid-argument', 'Clé secrète Stripe invalide.');
  }

  await assertCanManageStructure(request.auth.uid, structureId);

  await privateStripeRef(structureId).set(
    {
      secretKey: trimmed,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid,
    },
    { merge: true }
  );

  await admin.firestore().collection('structures').doc(structureId).update({
    stripeSecretKey: admin.firestore.FieldValue.delete(),
    stripeSecretConfigured: true,
  });

  return { success: true };
});

/** Paiements Stripe de l’utilisateur connecté uniquement (proxy API, pas de clé côté client). */
export const fetchUserStripePaymentIntents = onCall(functionConfig, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentification requise.');
  }

  const { structureId } = request.data as { structureId?: string };
  const userId = request.auth.uid;

  if (!structureId) {
    throw new HttpsError('invalid-argument', 'structureId requis.');
  }

  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'Utilisateur introuvable.');
  }
  const userData = userDoc.data()!;
  if (userData.structureId !== structureId) {
    throw new HttpsError('permission-denied', 'Structure non autorisée.');
  }

  const secretKey = await getStructureStripeSecretKey(structureId);
  if (!secretKey) {
    throw new HttpsError('failed-precondition', 'Clé secrète Stripe non configurée pour cette structure.');
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });
  const userEmail = (userData.email as string) || '';

  const paymentIntents = await stripe.paymentIntents.list({ limit: 100 });
  const refunds = await stripe.refunds.list({ limit: 100 });

  const userPayments = paymentIntents.data.filter(
    (p) =>
      (p.status === 'succeeded' || p.status === 'canceled') &&
      (p.receipt_email === userEmail || p.metadata?.userId === userId)
  );

  const enrichedPayments = userPayments.map((payment) => {
    const paymentRefunds = refunds.data.filter((r) => r.payment_intent === payment.id);
    const latestRefund = paymentRefunds[0];
    return {
      id: payment.id,
      object: payment.object,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      created: payment.created,
      receipt_email: payment.receipt_email,
      amount_received: payment.amount_received,
      livemode: payment.livemode,
      hasRefunds: paymentRefunds.length > 0,
      refunded: paymentRefunds.length > 0,
      refundedAt: latestRefund ? new Date(latestRefund.created * 1000) : null,
      refundAmount: latestRefund ? latestRefund.amount / 100 : 0,
      refundStatus: latestRefund?.status ?? null,
      refundCount: paymentRefunds.length,
    };
  });

  return {
    success: true,
    paymentIntents: enrichedPayments,
    has_more: paymentIntents.has_more,
    total_count: enrichedPayments.length,
  };
});

/** Résout une structure par domaine email (inscription / auth, champs publics uniquement). */
export const resolveStructureByEmail = onCall(signupConfig, async (request) => {
  const { email } = request.data as { email?: string };
  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new HttpsError('invalid-argument', 'Email requis.');
  }

  const domain = getEmailDomain(email);
  if (domain === '@js-connect.fr') {
    return {
      structure: {
        id: 'js-connect',
        name: 'JS Connect',
        nom: 'JS Connect',
        ecole: 'JS Connect',
        emailDomains: ['@js-connect.fr'],
        createdAt: new Date().toISOString(),
      },
    };
  }

  const snap = await admin
    .firestore()
    .collection('structures')
    .where('emailDomains', 'array-contains', domain)
    .limit(1)
    .get();

  if (snap.empty) {
    return { structure: null };
  }

  const doc = snap.docs[0];
  const data = doc.data();
  return {
    structure: {
      id: doc.id,
      name: data.name || data.nom,
      nom: data.nom,
      ecole: data.ecole,
      emailDomains: data.emailDomains || data.domaines || [],
      createdAt: data.createdAt,
      structureType: data.structureType,
      logo: data.logo,
    },
  };
});
