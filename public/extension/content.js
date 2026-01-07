console.log('Content script JS Connect LinkedIn chargé');

/**
 * Normalise une URL LinkedIn
 */
function normalizeLinkedInUrl(url) {
  const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
  if (match) {
    return `https://www.linkedin.com/in/${match[1]}/`;
  }
  return url;
}

/**
 * Extrait l'URL de la photo de profil LinkedIn depuis le DOM
 */
function extractProfilePhotoUrl() {
  // Méthode 1: Photo de profil principale (grande)
  const mainPhoto = document.querySelector('img.pv-top-card-profile-picture__image--show');
  if (mainPhoto?.src && mainPhoto.src.includes('media.licdn.com')) {
    return mainPhoto.src;
  }
  
  // Méthode 2: Photo dans le header du profil
  const headerPhoto = document.querySelector('.pv-top-card__photo img');
  if (headerPhoto?.src && headerPhoto.src.includes('media.licdn.com')) {
    return headerPhoto.src;
  }
  
  // Méthode 3: Photo avec attribut data-ghost-url
  const ghostPhoto = document.querySelector('img[data-ghost-url*="media.licdn.com"]');
  if (ghostPhoto?.src && ghostPhoto.src.includes('media.licdn.com')) {
    return ghostPhoto.src;
  }
  
  // Méthode 4: Chercher dans les images avec classe profile
  const profileImages = document.querySelectorAll('img[class*="profile"]');
  for (const img of profileImages) {
    if (img.src && img.src.includes('media.licdn.com') && !img.src.includes('company-logo')) {
      // Vérifier que c'est une photo de personne (pas un logo)
      const isLargeEnough = img.width >= 100 || img.height >= 100 || img.src.includes('/profile-displayphoto-shrink_');
      if (isLargeEnough) {
        return img.src;
      }
    }
  }
  
  // Méthode 5: Chercher toutes les images LinkedIn avec profile-displayphoto
  const allImages = document.querySelectorAll('img[src*="media.licdn.com"]');
  for (const img of allImages) {
    if (img.src.includes('/profile-displayphoto-shrink_') || img.src.includes('/profile-displaybackgroundimage-shrink_')) {
      // C'est probablement une photo de profil
      if (img.src.includes('/profile-displayphoto-shrink_')) {
        return img.src;
      }
    }
  }
  
  // Méthode 6: Dernière tentative - première grande image LinkedIn
  for (const img of allImages) {
    if (!img.src.includes('company-logo') && !img.src.includes('background') && (img.width >= 80 || img.height >= 80)) {
      return img.src;
    }
  }
  
  return '';
}

/**
 * Crée des données minimales depuis l'URL (fallback si l'IA échoue)
 */
function createMinimalProfileData(url) {
  const profileUrl = normalizeLinkedInUrl(url);
  const urlMatch = profileUrl.match(/\/in\/([^\/\?]+)/);
  let fallbackName = 'Profil LinkedIn';
  
  if (urlMatch && urlMatch[1]) {
    const urlName = urlMatch[1]
      .replace(/[^a-zA-ZÀ-ÿ\s-]/g, ' ')
      .replace(/-/g, ' ')
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    if (urlName && urlName.length > 1) {
      fallbackName = urlName;
    }
  }
  
  // Extraire la photo de profil depuis le DOM
  const photoUrl = extractProfilePhotoUrl();
  console.log('Content script - Photo de profil extraite:', photoUrl ? 'Oui' : 'Non');
  
  return {
      linkedinUrl: profileUrl,
    name: fallbackName,
    title: '',
    location: '',
    company: '',
    photoUrl: photoUrl, // Photo extraite du DOM
      source: 'linkedin',
    statut: 'nouveau',
    extractionMethod: 'fallback'
  };
}

// ============================================
// LISTENER DE MESSAGES
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getProfileData') {
    (async () => {
      try {
        // Attendre un peu pour s'assurer que le DOM est chargé
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const currentUrl = window.location.href;
        console.log('Content script - URL actuelle:', currentUrl);
        
        // Vérification permissive : si on est sur LinkedIn, on peut toujours essayer l'IA
        const isLinkedIn = currentUrl.includes('linkedin.com');
        const hasProfilePath = currentUrl.includes('/in/');
        
        // Si on n'est pas sur LinkedIn du tout, alors erreur
        if (!isLinkedIn) {
          sendResponse({ 
            success: false, 
            error: 'Impossible d\'extraire les données du profil. Assurez-vous d\'être sur une page de profil LinkedIn.' 
          });
          return;
        }
        
        // Si on est sur LinkedIn mais pas sur /in/, on peut quand même essayer l'IA
        // L'IA analysera le screenshot et déterminera si c'est un profil
        let profileUrl = currentUrl;
        if (hasProfilePath) {
          profileUrl = normalizeLinkedInUrl(currentUrl);
        } else {
          // URL de tracking ou autre, on garde l'URL actuelle
          // L'IA pourra extraire l'URL depuis le screenshot
          console.log('Content script - URL ne contient pas /in/, mais on est sur LinkedIn, on essaie quand même avec l\'IA');
        }
        
        // Vérifier le cache seulement si on a une URL de profil valide
        if (hasProfilePath) {
          const cacheKey = `profile_${btoa(profileUrl).replace(/[^a-zA-Z0-9]/g, '_')}`;
          
          try {
            const cached = await new Promise((resolve) => {
              chrome.storage.local.get([cacheKey], (result) => {
                if (result[cacheKey]) {
                  const cached = result[cacheKey];
                  const cacheAge = Date.now() - cached.timestamp;
                  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 jours
                  
                  if (cacheAge < maxAge) {
                    resolve(cached.data);
                  } else {
                    chrome.storage.local.remove([cacheKey]);
                    resolve(null);
                  }
                } else {
                  resolve(null);
                }
              });
            });
            
            if (cached) {
              console.log('Content script - Données trouvées dans le cache');
              sendResponse({ success: true, data: cached, fromCache: true });
              return;
            }
  } catch (error) {
            console.warn('Content script - Erreur lors de la vérification du cache:', error);
          }
        }
        
        // Pas de cache ou URL non standard, créer des données minimales et utiliser l'IA
        const minimalData = createMinimalProfileData(profileUrl);
        console.log('Content script - Pas de cache, utilisation de l\'IA');
        sendResponse({ 
          success: true, 
          data: minimalData, 
          needsAI: true,
          fromCache: false
        });
      } catch (error) {
        console.error('Content script - Erreur:', error);
        // Même en cas d'erreur, si on est sur LinkedIn, on essaie l'IA
        const currentUrl = window.location.href;
        if (currentUrl.includes('linkedin.com')) {
          const minimalData = createMinimalProfileData(currentUrl);
          sendResponse({ 
            success: true, 
            data: minimalData, 
            needsAI: true,
            fromCache: false
          });
    } else {
      sendResponse({ 
        success: false, 
        error: 'Impossible d\'extraire les données du profil. Assurez-vous d\'être sur une page de profil LinkedIn.' 
      });
    }
  }
    })();
    
  return true; // Nécessaire pour la communication asynchrone
  }
  
  return true;
}); 
