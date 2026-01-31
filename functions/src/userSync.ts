import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

// Configuration pour les triggers Firestore (v2)
// On utilise peu de ressources car l'opération est légère
const triggerConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 60,
  region: 'us-central1',
  maxInstances: 10,
};

/**
 * Synchronise les données Firestore de l'utilisateur (structureId, role, status)
 * vers les Custom Claims de Firebase Authentication.
 * 
 * Cela permet de sécuriser les règles Storage et Firestore sans avoir à lire
 * la base de données (ce qui est plus rapide, moins coûteux et plus fiable).
 */
export const syncUserClaims = onDocumentWritten({
  ...triggerConfig,
  document: 'users/{userId}',
}, async (event) => {
  const userId = event.params.userId;
  const change = event.data;

  // Si le document a été supprimé, on ne fait rien (l'utilisateur Auth sera probablement supprimé manuellement)
  if (!change || !change.after.exists) {
    return;
  }

  const userData = change.after.data();
  const beforeData = change.before.exists ? change.before.data() : {};

  // Vérifier si les champs pertinents ont changé pour éviter des appels Auth inutiles
  const fieldsToCheck = ['structureId', 'role', 'status', 'isAdmin', 'isSuperAdmin'];
  const hasChanged = !change.before.exists || fieldsToCheck.some(field => 
    JSON.stringify(userData?.[field]) !== JSON.stringify(beforeData?.[field])
  );

  if (!hasChanged) {
    return;
  }

  try {
    // Préparer les claims
    // On s'assure que les valeurs sont des primitives (string, boolean, number) ou null
    const claims: Record<string, any> = {
      structureId: userData?.structureId || null,
      role: userData?.role || null,
      status: userData?.status || null,
      // On peut ajouter d'autres flags utiles
      updatedAt: Date.now()
    };

    // Gestion explicite du superadmin si présent dans les données
    if (userData?.status === 'superadmin' || userData?.role === 'superadmin') {
      claims.superadmin = true;
    }

    console.log(`Synchronisation des claims pour l'utilisateur ${userId}:`, claims);

    // Mettre à jour les Custom Claims
    await admin.auth().setCustomUserClaims(userId, claims);
    
    // Note: Les claims ne seront effectifs que lors du prochain rafraîchissement du token
    // Le client doit appeler user.getIdToken(true) pour forcer le rafraîchissement
    
  } catch (error) {
    console.error(`Erreur lors de la synchronisation des claims pour ${userId}:`, error);
    // On ne re-throw pas l'erreur pour éviter que la fonction ne réessaie indéfiniment
    // en cas d'erreur non transitoire (ex: utilisateur Auth introuvable)
  }
});
