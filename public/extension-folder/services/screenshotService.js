/**
 * Service de capture de screenshot pour l'extraction IA
 */

/**
 * Capture la page visible actuelle
 * @returns {Promise<string>} Data URL de l'image en base64
 */
export async function captureVisiblePage() {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      null,
      {
        format: 'png',
        quality: 90 // Qualité élevée pour meilleure extraction
      },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(dataUrl);
        }
      }
    );
  });
}

/**
 * Capture une page spécifique par son tabId
 * @param {number} tabId - ID de l'onglet
 * @returns {Promise<string>} Data URL de l'image en base64
 */
export async function captureTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      tabId,
      {
        format: 'png',
        quality: 90
      },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.lastError));
        } else {
          resolve(dataUrl);
        }
      }
    );
  });
}

/**
 * Convertit une data URL en base64 pur (sans le préfixe)
 * @param {string} dataUrl - Data URL de l'image
 * @returns {string} Base64 pur
 */
export function dataUrlToBase64(dataUrl) {
  return dataUrl.split(',')[1];
}

/**
 * Compresse une image pour réduire les coûts d'API
 * @param {string} dataUrl - Data URL de l'image
 * @param {number} maxWidth - Largeur maximale (défaut: 1920)
 * @param {number} quality - Qualité JPEG (0-1, défaut: 0.85)
 * @returns {Promise<string>} Data URL compressée
 */
export function compressImage(dataUrl, maxWidth = 1920, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Redimensionner si nécessaire
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Convertir en JPEG pour réduire la taille
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

