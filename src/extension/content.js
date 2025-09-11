console.log('Content script JSaaS LinkedIn chargé');

// Vérifier si nous sommes sur une page de profil LinkedIn
function isLinkedInProfilePage() {
  return window.location.href.includes('linkedin.com/in/');
}

// Fonction pour extraire les données du profil LinkedIn
function extractProfileData() {
  try {
    if (!isLinkedInProfilePage()) {
      console.log('Pas sur une page de profil LinkedIn');
      return null;
    }

    // Récupérer l'URL du profil
    const profileUrl = window.location.href;
    
    // Récupérer le nom - plusieurs sélecteurs possibles
    const nameElement = document.querySelector('h1.text-heading-xlarge') || 
                       document.querySelector('h1.break-words') ||
                       document.querySelector('h1.t-24');
    const name = nameElement ? nameElement.textContent.trim() : '';
    
    // Récupérer la photo de profil
    const photoElement = document.querySelector('img.presence-entity__image') ||
                        document.querySelector('img.pv-top-card-profile-picture__image') ||
                        document.querySelector('.profile-photo-edit__preview') ||
                        document.querySelector('.pv-top-card__photo') ||
                        document.querySelector('.pv-top-card__photo img') ||
                        document.querySelector('.profile-picture img');

    // Ajouter des logs pour le débogage
    console.log('Element photo trouvé:', photoElement);
    
    let photoUrl = '';
    if (photoElement) {
        photoUrl = photoElement.getAttribute('src') || photoElement.getAttribute('data-delayed-url') || photoElement.getAttribute('data-ghost-url');
        console.log('URL de la photo trouvée:', photoUrl);
    }
    
    // Récupérer le titre - plusieurs sélecteurs possibles
    const titleElement = document.querySelector('.text-body-medium') || 
                        document.querySelector('.text-body-medium.break-words') ||
                        document.querySelector('.pv-text-details__left-panel-item-text');
    const title = titleElement ? titleElement.textContent.trim() : '';
    
    // Récupérer la localisation - plusieurs sélecteurs possibles
    const locationElement = document.querySelector('.text-body-small') || 
                          document.querySelector('.pv-text-details__left-panel-item-text') ||
                          document.querySelector('.pv-top-card-section__location');
    const location = locationElement ? locationElement.textContent.trim() : '';

    // Fonction pour nettoyer le nom de l'entreprise
    function cleanCompanyName(name) {
      if (!name) return '';
      
      // Supprimer ", visuel" et autres suffixes similaires
      name = name.replace(/,\s*visuel\.?$/i, '')
                 .replace(/,\s*logo\.?$/i, '')
                 .replace(/\s*\([^)]*\)\s*$/g, '') // Supprime les parenthèses à la fin
                 .replace(/\s*-\s*[^-]*$/, '')    // Supprime tout ce qui suit un tiret à la fin
                 .trim();
      
      return name;
    }

    // Récupérer l'entreprise depuis les logos en haut du profil
    let company = '';
    
    // Méthode 1: Chercher dans les images des entreprises en haut
    const companyLogos = document.querySelectorAll('img[data-test-id="profile-topcard-current-company-logo"]');
    if (companyLogos.length > 0) {
        const altText = companyLogos[0].getAttribute('alt');
        if (altText) {
            company = cleanCompanyName(altText.replace(' Logo', '').trim());
        }
    }

    // Méthode 2: Chercher dans les liens d'entreprise en haut
    if (!company) {
        const companyLinks = document.querySelectorAll('a[data-field="experience_company_logo"], a[href*="/company/"]');
        if (companyLinks.length > 0) {
            const link = companyLinks[0];
            company = link.getAttribute('aria-label') || link.textContent || '';
            company = cleanCompanyName(company.replace(' Logo', '').trim());
        }
    }

    // Méthode 3: Chercher dans la section d'expérience actuelle
    if (!company) {
        const experienceSection = document.querySelector('section.experience-section');
        if (experienceSection) {
            const currentPosition = experienceSection.querySelector('li:first-child');
            if (currentPosition) {
                const companyNameElement = currentPosition.querySelector('p.pv-entity__secondary-title') || 
                                        currentPosition.querySelector('.pv-entity__company-summary-info h3') ||
                                        currentPosition.querySelector('[data-field="experience_company_logo"]');
                
                if (companyNameElement) {
                    company = cleanCompanyName(companyNameElement.textContent.trim());
                }
            }
        }
    }

    // Méthode 4: Chercher dans les éléments avec le nom de l'entreprise
    if (!company) {
        const possibleCompanyElements = Array.from(document.querySelectorAll('span, div, p'))
            .filter(el => {
                const text = el.textContent.trim();
                // Éviter les dates et autres formats non désirés
                const isDate = /^(jan|fév|mar|avr|mai|juin|juil|aoû|sep|oct|nov|déc|[0-9])/i.test(text);
                const hasYear = /20[0-9]{2}/.test(text);
                const isDuration = /ans|mois|aujourd'hui/i.test(text);
                return text && !isDate && !hasYear && !isDuration && text.length > 1;
            });

        for (const element of possibleCompanyElements) {
            const text = element.textContent.trim();
            if (text.includes('·')) {
                const parts = text.split('·');
                if (parts[0] && !parts[0].includes('20') && !parts[0].toLowerCase().includes('aujourd')) {
                    company = cleanCompanyName(parts[0].trim());
                    break;
                }
            }
        }
    }

    console.log('Entreprise trouvée:', company);

    const data = {
      linkedinUrl: profileUrl,
      name: name,
      title: title,
      location: location,
      company: company,
      photoUrl: photoUrl,
      source: 'linkedin',
      statut: 'nouveau'
    };

    console.log('Données extraites:', data);
    return data;
  } catch (error) {
    console.error('Erreur lors de l\'extraction des données:', error);
    return null;
  }
}

// Écouter les messages du popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message reçu dans le content script:', request);
  
  if (request.action === 'getProfileData') {
    const profileData = extractProfileData();
    
    if (profileData) {
      sendResponse({ success: true, data: profileData });
    } else {
      sendResponse({ 
        success: false, 
        error: 'Impossible d\'extraire les données du profil. Assurez-vous d\'être sur une page de profil LinkedIn.' 
      });
    }
  }
  return true; // Nécessaire pour la communication asynchrone
}); 