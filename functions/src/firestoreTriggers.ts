/**
 * Triggers Firestore pour chiffrer automatiquement les données sensibles
 * Ces triggers interceptent les écritures et chiffrent les champs sensibles avant stockage
 * 
 * NOTE: Les triggers Firestore v2 sont plus complexes à configurer.
 * Pour l'instant, le chiffrement est géré via les Cloud Functions onCall
 * qui doivent être appelées avant/après les écritures Firestore.
 * 
 * Les triggers automatiques peuvent être ajoutés plus tard si nécessaire.
 */

// Désactivé temporairement - utiliser les fonctions onCall pour le chiffrement
// Les triggers automatiques peuvent causer des boucles infinies si mal configurés

/*
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { encryptSensitiveFields, SENSITIVE_FIELDS } from './encryption';

export const encryptUserOnWrite = onDocumentWritten('users/{userId}', async (event) => {
  const change = event.data;
  const context = event.params;

  try {
    // Ne pas traiter les suppressions
    if (!change?.after.exists) {
      return;
    }

    const userData = change.after.data();
    if (!userData) {
      return;
    }

    // Vérifier si des champs sensibles ont besoin d'être chiffrés
    const hasSensitiveData = SENSITIVE_FIELDS.USER.some(
      field => userData[field] && typeof userData[field] === 'string' && !userData[field].startsWith('ENC:')
    );

    if (!hasSensitiveData) {
      return;
    }

    // Chiffrer les champs sensibles
    const encrypted = await encryptSensitiveFields(userData, SENSITIVE_FIELDS.USER);

    // Mettre à jour le document avec les données chiffrées
    await change.after.ref.set(encrypted, { merge: true });

    console.log(`Données sensibles chiffrées pour l'utilisateur ${context.userId}`);
  } catch (error) {
    console.error('Erreur lors du chiffrement automatique des données utilisateur:', error);
  }
});
*/
