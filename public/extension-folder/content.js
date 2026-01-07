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
 * APPROCHE SIMPLIFIÉE: Chercher directement toutes les images profile-displayphoto
 */
function extractProfilePhotoUrl() {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:18',message:'extractProfilePhotoUrl called',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  
  // APPROCHE SIMPLIFIÉE: Chercher toutes les images avec profile-displayphoto dans le DOM
  // La photo de profil est TOUJOURS dans la section du profil (pas dans le feed)
  
  // Méthode 1: Chercher dans la section top-card (priorité maximale)
  const topCardSelectors = [
    '.pv-top-card-profile-picture img',
    '.pv-top-card__photo img',
    '[class*="pv-top-card"] img',
    '[class*="top-card"] img',
    '[class*="topcard"] img'
  ];
  
  for (const selector of topCardSelectors) {
    try {
      const container = document.querySelector(selector.replace(' img', ''));
      if (container) {
        const img = container.querySelector('img');
        if (img && img.src && img.src.includes('profile-displayphoto-shrink_') && img.src.includes('media.licdn.com')) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:30',message:'Photo found in topCard',data:{selector:selector,src:img.src.substring(0,150),width:img.width,height:img.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
          return img.src;
        }
      }
    } catch (e) {
      // Continue avec le prochain sélecteur
    }
  }
  
  // Méthode 2: Chercher TOUTES les images profile-displayphoto et filtrer par contexte
  const allProfileImages = Array.from(document.querySelectorAll('img')).filter(img => {
    return img.src && 
           img.src.includes('profile-displayphoto-shrink_') && 
           img.src.includes('media.licdn.com') &&
           !img.src.includes('company-logo');
  });
  
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:48',message:'All profile images found',data:{count:allProfileImages.length,images:allProfileImages.map(img => ({src:img.src.substring(0,100),width:img.width,height:img.height,className:img.className?.substring(0,50) || ''}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  
  // Filtrer les images qui sont dans une section de profil (pas dans le feed ou les pubs)
  for (const img of allProfileImages) {
    // Vérifier si l'image est dans une section de profil
    let parent = img.parentElement;
    let depth = 0;
    let isInProfileSection = false;
    
    while (parent && depth < 10) {
      const className = (parent.className || '').toLowerCase();
      const id = (parent.id || '').toLowerCase();
      
      // Si on trouve un conteneur de profil, c'est bon
      if (className.includes('pv-top-card') || 
          className.includes('top-card') || 
          className.includes('profile') ||
          id.includes('profile') ||
          id.includes('top-card')) {
        isInProfileSection = true;
        break;
      }
      
      // Si on trouve un conteneur de pub/feed, c'est pas bon
      if (className.includes('feed') || 
          className.includes('advertisement') ||
          className.includes('sponsored') ||
          className.includes('update-components') ||
          className.includes('feed-shared-update')) {
        break; // Sortir, ce n'est pas dans la section profil
      }
      
      parent = parent.parentElement;
      depth++;
    }
    
    // Si l'image est dans la section profil ET a une taille raisonnable (>= 80px), c'est la bonne
    if (isInProfileSection && (img.width >= 80 || img.height >= 80 || img.naturalWidth >= 80 || img.naturalHeight >= 80)) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:75',message:'Photo found in profile section',data:{src:img.src.substring(0,150),width:img.width,height:img.height,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      return img.src;
    }
  }
  
  // Méthode 3: Si rien trouvé, prendre la première image profile-displayphoto qui n'est pas dans un feed
  for (const img of allProfileImages) {
    let parent = img.parentElement;
    let depth = 0;
    let isInFeed = false;
    
    while (parent && depth < 5) {
      const className = (parent.className || '').toLowerCase();
      if (className.includes('feed') || className.includes('update-components') || className.includes('feed-shared')) {
        isInFeed = true;
        break;
      }
      parent = parent.parentElement;
      depth++;
    }
    
    if (!isInFeed) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:96',message:'Photo found (fallback - not in feed)',data:{src:img.src.substring(0,150)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      return img.src;
    }
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:103',message:'No photo found',data:{totalImages:allProfileImages.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
  // #endregion
  
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
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'content.js:156',message:'createMinimalProfileData - photoUrl extracted',data:{photoUrl:photoUrl ? photoUrl.substring(0,150) : '',hasPhoto:!!photoUrl,photoUrlLength:photoUrl?.length || 0},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'G'})}).catch(()=>{});
  // #endregion
  console.log('Content script - Photo de profil extraite:', photoUrl ? 'Oui' : 'Non', photoUrl);
  
  return {
      linkedinUrl: profileUrl,
    name: fallbackName,
    title: '',
    location: '',
    company: '',
    photoUrl: photoUrl || '', // Photo extraite du DOM - forcer string vide si null/undefined
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
