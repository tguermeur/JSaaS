/**
 * Triggers Firestore pour chiffrer automatiquement les données sensibles
 * à la création et à la mise à jour des documents users.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { encryptSensitiveFields, SENSITIVE_FIELDS } from './encryption';

const triggerConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 60,
  region: 'us-central1' as const,
  cpu: 0.25,
  maxInstances: 3,
  secrets: ['ENCRYPTION_KEY'],
};

/**
 * Chiffre les champs sensibles des documents users à chaque écriture
 * (création ou mise à jour). Évite les boucles en ne traitant que les
 * champs non encore chiffrés (sans préfixe ENC:).
 */
export const encryptUserOnWrite = onDocumentWritten(
  {
    ...triggerConfig,
    document: 'users/{userId}',
  },
  async (event) => {
    const change = event.data;
    const userId = event.params.userId;

    if (!change?.after.exists) {
      return;
    }

    const userData = change.after.data();
    if (!userData) {
      return;
    }

    const hasSensitiveData = SENSITIVE_FIELDS.USER.some(
      (field) =>
        userData[field] != null &&
        typeof userData[field] === 'string' &&
        (userData[field] as string).trim() !== '' &&
        !(userData[field] as string).startsWith('ENC:')
    );

    if (!hasSensitiveData) {
      return;
    }

    try {
      const encrypted = await encryptSensitiveFields(userData, [...SENSITIVE_FIELDS.USER]);
      await change.after.ref.set(encrypted, { merge: true });
      console.log(`[encryptUserOnWrite] Données sensibles chiffrées pour l'utilisateur ${userId}`);
    } catch (error) {
      console.error(`[encryptUserOnWrite] Erreur pour ${userId}:`, error);
      // Ne pas re-throw pour éviter les réessais indéfinis (ex. secret manquant)
    }
  }
);
