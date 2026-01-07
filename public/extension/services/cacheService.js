/**
 * Service de cache pour éviter les re-traitements
 */

/**
 * Génère une clé de cache à partir d'une URL LinkedIn
 * @param {string} linkedinUrl - URL du profil LinkedIn
 * @returns {string} Clé de cache
 */
export function generateCacheKey(linkedinUrl) {
  // Normaliser l'URL (enlever les paramètres de tracking)
  const normalizedUrl = linkedinUrl.split('?')[0].split('#')[0];
  return `profile_${btoa(normalizedUrl).replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * Récupère les données depuis le cache
 * @param {string} cacheKey - Clé de cache
 * @returns {Promise<Object|null>} Données en cache ou null
 */
export async function getFromCache(cacheKey) {
  return new Promise((resolve) => {
    chrome.storage.local.get([cacheKey], (result) => {
      if (result[cacheKey]) {
        const cached = result[cacheKey];
        // Vérifier si le cache n'est pas expiré (7 jours)
        const cacheAge = Date.now() - cached.timestamp;
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 jours
        
        if (cacheAge < maxAge) {
          resolve(cached.data);
        } else {
          // Cache expiré, le supprimer
          chrome.storage.local.remove([cacheKey]);
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Sauvegarde les données dans le cache
 * @param {string} cacheKey - Clé de cache
 * @param {Object} data - Données à mettre en cache
 * @returns {Promise<void>}
 */
export async function saveToCache(cacheKey, data) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(
      {
        [cacheKey]: {
          data: data,
          timestamp: Date.now()
        }
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      }
    );
  });
}

/**
 * Vérifie si une URL est en cache
 * @param {string} linkedinUrl - URL du profil LinkedIn
 * @returns {Promise<boolean>}
 */
export async function isCached(linkedinUrl) {
  const cacheKey = generateCacheKey(linkedinUrl);
  const cached = await getFromCache(cacheKey);
  return cached !== null;
}

/**
 * Nettoie le cache ancien (plus de 30 jours)
 * @returns {Promise<number>} Nombre d'éléments supprimés
 */
export async function cleanOldCache() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (items) => {
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 jours
      const now = Date.now();
      const keysToRemove = [];

      for (const key in items) {
        if (key.startsWith('profile_')) {
          const cached = items[key];
          if (cached.timestamp && (now - cached.timestamp) > maxAge) {
            keysToRemove.push(key);
          }
        }
      }

      if (keysToRemove.length > 0) {
        chrome.storage.local.remove(keysToRemove, () => {
          resolve(keysToRemove.length);
        });
      } else {
        resolve(0);
      }
    });
  });
}


