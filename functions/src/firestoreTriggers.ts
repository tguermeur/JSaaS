/**
 * Triggers Firestore pour chiffrer automatiquement les données sensibles
 * à la création et à la mise à jour des documents users.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { encryptUserFieldsWithDisplay, SENSITIVE_FIELDS } from './encryption';

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
 * Écrit aussi displayFirstName / displayLastName / displayName en clair.
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

    const isEnc = (v: unknown) =>
      typeof v === 'string' && (v.startsWith('ENC:') || v.startsWith('ENC2:'));
    const hasSensitiveData = SENSITIVE_FIELDS.USER.some(
      (field) =>
        field !== 'displayName' &&
        userData[field] != null &&
        typeof userData[field] === 'string' &&
        (userData[field] as string).trim() !== '' &&
        !isEnc(userData[field])
    );

    const needsDisplayBackfill =
      (isEnc(userData.firstName) || isEnc(userData.lastName) || isEnc(userData.displayName)) &&
      (!userData.displayFirstName ||
        !userData.displayLastName ||
        (typeof userData.displayName === 'string' && isEnc(userData.displayName)));

    // Noms déjà chiffrés sans display* : ne pas re-chiffrer ici (besoin decrypt via backfill CF)
    if (!hasSensitiveData) {
      if (needsDisplayBackfill) {
        console.log(
          `[encryptUserOnWrite] display* manquants pour ${userId} — utiliser backfillDisplayFields`
        );
      }
      return;
    }

    try {
      const encrypted = await encryptUserFieldsWithDisplay(userData);
      await change.after.ref.set(encrypted, { merge: true });
      console.log(`[encryptUserOnWrite] Données sensibles chiffrées pour l'utilisateur ${userId}`);
    } catch (error) {
      console.error(`[encryptUserOnWrite] Erreur pour ${userId}:`, error);
      // Ne pas re-throw pour éviter les réessais indéfinis (ex. secret manquant)
    }
  }
);
