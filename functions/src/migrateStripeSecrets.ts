import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { assertSuperAdmin } from './authHelpers';
import { getStructureStripeSecretKey } from './structureStripeSecrets';

const config = {
  memory: '256MiB' as const,
  timeoutSeconds: 300,
  cors: true,
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 1,
  allowUnauthenticated: false,
};

/** Migre et purge stripeSecretKey sur toutes les structures (superadmin). */
export const migrateStripeSecretsAdmin = onCall(config, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentification requise.');
  }
  await assertSuperAdmin(request.auth.uid);

  const dryRun = !!(request.data as { dryRun?: boolean })?.dryRun;
  const snap = await admin.firestore().collection('structures').get();
  let migrated = 0;
  let purged = 0;

  for (const doc of snap.docs) {
    const legacy = doc.data()?.stripeSecretKey as string | undefined;
    if (!legacy) continue;

    if (!dryRun) {
      await getStructureStripeSecretKey(doc.id);
      await doc.ref.update({
        stripeSecretKey: admin.firestore.FieldValue.delete(),
        stripeSecretConfigured: true,
      });
    }
    migrated++;
    purged++;
  }

  return { dryRun, total: snap.size, migrated, purged };
});
