/**
 * Fonction helper pour les logs de debug qui envoie des données à un serveur de tracking local
 * Ne s'exécute que si :
 * - On est en développement local (NODE_ENV !== 'production')
 * - Le serveur de tracking est disponible
 * 
 * Cette fonction supprime silencieusement toutes les erreurs pour éviter de polluer la console
 */
export function debugLog(
  location: string,
  message: string,
  data: any,
  hypothesisId: string = 'default'
): void {
  // Ne rien faire en production
  if (import.meta.env.PROD) {
    return;
  }

  // Ne rien faire si on est dans un environnement de production
  if (import.meta.env.MODE === 'production') {
    return;
  }

  // Vérifier si on est dans un navigateur (window existe)
  if (typeof window === 'undefined') {
    return;
  }

  // Vérifier si fetch est disponible
  if (typeof fetch === 'undefined') {
    return;
  }

  // Essayer d'envoyer les logs au serveur de tracking local
  // Si le serveur n'est pas disponible, l'erreur sera silencieusement ignorée
  const trackingUrl = 'http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93';
  
  // Utiliser AbortController avec un timeout pour éviter les requêtes bloquantes
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 100); // Timeout de 100ms
  
  fetch(trackingUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location,
      message,
      data,
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId
    }),
    signal: controller.signal
  })
    .catch(() => {
      // Ignorer silencieusement toutes les erreurs de connexion
      // Le serveur de tracking n'est pas toujours disponible
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });
}
