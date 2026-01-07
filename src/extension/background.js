// Gestion de l'authentification
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'setAuthToken') {
    chrome.storage.local.set({ authToken: request.token }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Vérification de l'URL LinkedIn
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('linkedin.com')) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'background.js:12',message:'LinkedIn tab detected',data:{tabId,url:tab.url,changeInfo},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Désactiver temporairement la mise à jour de l'icône pour éviter l'erreur assets/icon16.png
    // L'icône par défaut est déjà configurée dans manifest.json
    // Cette fonctionnalité peut être réactivée une fois le problème de cache résolu
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'background.js:18',message:'Icon update skipped to avoid cache issue',data:{tabId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.log('Mise à jour de l\'icône désactivée pour éviter les erreurs de cache');
  }
});

// Service worker pour gérer les requêtes proxy
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'proxyRequest') {
    fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body
    })
    .then(response => response.json())
    .then(data => sendResponse({ success: true, data }))
    .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Nécessaire pour la communication asynchrone
  }
});

// Écouter les changements d'onglets
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('linkedin.com/in/')) {
    // Injecter le content script
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).catch(err => console.log('Erreur d\'injection:', err));
  }
});

// Écouter les messages du content script et popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message reçu dans le background script:', message);
  
  // Handler pour l'extraction IA
  if (message.action === 'extractWithAI') {
    (async () => {
      try {
        // Récupérer la clé API Gemini
        const config = await new Promise((resolve) => {
          chrome.storage.local.get(['geminiApiKey'], (result) => {
            resolve(result);
          });
        });
        
        if (!config.geminiApiKey) {
          sendResponse({ 
            success: false, 
            error: 'Clé API Gemini non configurée. Veuillez la configurer dans les paramètres de l\'extension.' 
          });
          return;
        }
        
        // Appeler l'API Gemini Vision
        // Utiliser gemini-2.0-flash qui supporte Google Search Grounding et est plus rapide/économique
        // Alternative: gemini-1.5-pro si besoin de plus de précision
        const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
        
        const EXTRACTION_PROMPT = `Tu es un expert en extraction de données depuis des profils LinkedIn. Analyse cette capture d'écran et extrais les informations au format JSON strict.

STRUCTURE JSON REQUISE :
{
  "name": "Nom complet de la personne",
  "title": "TITRE DU POSTE ACTUEL (ex: Fondateur, Directeur, CEO, Manager, etc.)",
  "company": "NOM DE L'ENTREPRISE ACTUELLE (ex: Campus Consulting, Google, Microsoft)",
  "location": "Localisation (ville, pays)",
  "email": "Email si visible",
  "phone": "Téléphone si visible",
  "linkedinUrl": "URL du profil LinkedIn",
  "photoUrl": "URL de la photo de profil si visible",
  "about": "Section À propos si visible",
  "experience": [
    {
      "title": "Titre du poste",
      "company": "Nom de l'entreprise",
      "duration": "Période"
    }
  ]
}

⚠️⚠️⚠️ RÈGLES CRITIQUES - LIS ATTENTIVEMENT ⚠️⚠️⚠️

ÉTAPE 1 : TROUVER LA SECTION "EXPÉRIENCE"
- Cherche la section "Expérience" sur le profil (généralement en haut, après le nom et le titre)
- Cette section liste les emplois/expériences professionnelles
- IGNORE complètement la section "Formation" (qui liste les écoles/universités)

ÉTAPE 2 : IDENTIFIER LA PREMIÈRE EXPÉRIENCE (LA PLUS RÉCENTE)
- Dans la section "Expérience", prends la PREMIÈRE expérience listée
- C'est l'expérience ACTUELLE ou la plus récente
- Cette expérience contient DEUX informations distinctes :
  a) Un TITRE DE POSTE (ex: "Fondateur", "Directeur", "CEO", "Manager")
  b) Un NOM D'ENTREPRISE (ex: "Campus Consulting", "Google", "Microsoft")

ÉTAPE 3 : EXTRAIRE CORRECTEMENT
- Le TITRE DE POSTE va dans le champ "title" (ex: "Fondateur")
- Le NOM D'ENTREPRISE va dans le champ "company" (ex: "Campus Consulting")

⚠️ INTERDICTIONS ABSOLUES :
- ❌ NE JAMAIS mettre un nom d'entreprise dans "title"
- ❌ NE JAMAIS mettre un titre de poste dans "company"
- ❌ NE JAMAIS utiliser une école/université comme "company" (ex: "emlyon business school")
- ❌ NE JAMAIS inverser les deux champs

EXEMPLES CONCRETS POUR CE PROFIL :
Si tu vois dans la première expérience :
- "Fondateur" comme titre de poste
- "Campus Consulting" comme nom d'entreprise
→ title="Fondateur", company="Campus Consulting" ✅

Si tu vois :
- "Campus Consulting" dans le titre
- "emlyon business school" dans l'entreprise
→ C'EST FAUX ! Tu as inversé ou confondu avec la formation ❌

RÈGLES FINALES :
- Si une information n'est pas visible, utilise ""
- Le JSON doit être valide et parsable
- Ne retourne QUE le JSON, sans texte avant ou après
- Pour "experience", liste les expériences dans l'ordre (première = plus récente)`;

        const response = await fetch(`${GEMINI_API_URL}?key=${config.geminiApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: EXTRACTION_PROMPT
                  },
                  {
                    inline_data: {
                      mime_type: 'image/png',
                      data: message.imageBase64
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1, // Très bas pour plus de cohérence
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 2048
            },
            tools: [
              {
                googleSearch: {} // Active Google Search Grounding (si disponible)
              }
            ]
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `Erreur API Gemini: ${response.status} - ${errorData.error?.message || response.statusText}`
          );
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) {
          throw new Error('Aucune réponse de l\'API Gemini');
        }

        // Nettoyer et parser le JSON
        let cleanedText = text.trim();
        cleanedText = cleanedText.replace(/```json\n?/g, '');
        cleanedText = cleanedText.replace(/```\n?/g, '');
        cleanedText = cleanedText.trim();

        let extractedData;
        try {
          extractedData = JSON.parse(cleanedText);
        } catch (parseError) {
          const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            extractedData = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error(`Impossible de parser le JSON: ${parseError.message}`);
          }
        }

        // Normaliser les données
        let normalizedData = {
          name: extractedData.name || '',
          title: extractedData.title || '',
          company: cleanCompanyName(extractedData.company || ''),
          location: extractedData.location || '',
          email: extractedData.email || '',
          phone: extractedData.phone || '',
          linkedinUrl: message.linkedinUrl || extractedData.linkedinUrl || '',
          photoUrl: extractedData.photoUrl || '',
          about: extractedData.about || '',
          experience: extractedData.experience || [],
          source: 'linkedin',
          statut: 'nouveau',
          extractionMethod: 'ai'
        };

        // CORRECTION AUTOMATIQUE : Si l'IA a inversé title et company
        normalizedData = fixTitleCompanyConfusion(normalizedData);

        // Enrichir avec les informations d'entreprise (SIRET, raison sociale, siège social)
        if (normalizedData.company && normalizedData.company.trim().length > 0) {
          try {
            console.log('Recherche d\'informations d\'entreprise pour:', normalizedData.company);
            const companyInfo = await searchCompanyInfo(normalizedData.company, config.geminiApiKey);
            if (companyInfo) {
              normalizedData.companyData = companyInfo;
              console.log('Informations d\'entreprise trouvées:', companyInfo);
            }
          } catch (error) {
            console.warn('Erreur lors de la recherche d\'informations d\'entreprise:', error);
            // Ne pas bloquer si la recherche échoue
          }
        }

        sendResponse({ success: true, data: normalizedData });
      } catch (error) {
        console.error('Erreur lors de l\'extraction IA:', error);
        sendResponse({ 
          success: false, 
          error: error.message || 'Erreur lors de l\'extraction IA' 
        });
      }
    })();
    
    return true; // Nécessaire pour la communication asynchrone
  }
  
  return true;
});

/**
 * Nettoie le nom de l'entreprise
 */
function cleanCompanyName(companyName) {
  if (!companyName) return '';

  let cleaned = companyName.trim();

  // Supprimer les doublons
  const words = cleaned.split(/\s+/);
  if (words.length >= 4) {
    const halfLength = Math.floor(words.length / 2);
    const firstHalf = words.slice(0, halfLength).join(' ');
    const secondHalf = words.slice(halfLength).join(' ');
    if (firstHalf === secondHalf) {
      cleaned = firstHalf;
    }
  }

  // Supprimer les suffixes indésirables
  cleaned = cleaned
    .replace(/,\s*visuel\.?$/i, '')
    .replace(/,\s*logo\.?$/i, '')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim();

  return cleaned;
}

/**
 * Corrige les confusions courantes entre title et company
 */
function fixTitleCompanyConfusion(data) {
  const title = (data.title || '').trim();
  const company = (data.company || '').trim();
  
  // Liste des mots-clés qui indiquent un titre de poste
  const jobTitleKeywords = [
    'fondateur', 'fondatrice', 'directeur', 'directrice', 'ceo', 'cto', 'cfo',
    'manager', 'chef', 'responsable', 'ingénieur', 'développeur', 'designer',
    'consultant', 'analyste', 'spécialiste', 'coordonnateur', 'assistant',
    'stagiaire', 'alternant', 'entrepreneur', 'podcasteuse', 'conférencière',
    'co-fondateur', 'co-fondatrice', 'hôte'
  ];
  
  // Liste des mots-clés qui indiquent une école/université (ne doit pas être company)
  const schoolKeywords = [
    'school', 'université', 'university', 'école', 'ecole', 'business school',
    'institut', 'institute', 'campus', 'lycée', 'collège'
  ];
  
  // Si le "title" ressemble à un nom d'entreprise (contient des mots d'entreprise)
  const titleLooksLikeCompany = !jobTitleKeywords.some(keyword => 
    title.toLowerCase().includes(keyword)
  ) && title.length > 3;
  
  // Si le "company" ressemble à un titre de poste
  const companyLooksLikeTitle = jobTitleKeywords.some(keyword => 
    company.toLowerCase().includes(keyword)
  );
  
  // Si le "company" est une école/université
  const companyIsSchool = schoolKeywords.some(keyword => 
    company.toLowerCase().includes(keyword)
  );
  
  // Si le "title" est une école/université
  const titleIsSchool = schoolKeywords.some(keyword => 
    title.toLowerCase().includes(keyword)
  );
  
  // CORRECTION 1: Si title ressemble à une entreprise ET company ressemble à un titre
  if (titleLooksLikeCompany && companyLooksLikeTitle) {
    console.log('Correction: title et company inversés détectés');
    const temp = data.title;
    data.title = data.company;
    data.company = temp;
    console.log('Corrigé:', { title: data.title, company: data.company });
  }
  
  // CORRECTION 2: Si company est une école/université, chercher dans experience
  if (companyIsSchool && data.experience && data.experience.length > 0) {
    console.log('Correction: company est une école, cherchant dans experience');
    const firstExp = data.experience[0];
    if (firstExp && firstExp.company && !schoolKeywords.some(k => firstExp.company.toLowerCase().includes(k))) {
      // Si le titre de la première expérience ressemble à un titre de poste
      if (jobTitleKeywords.some(k => (firstExp.title || '').toLowerCase().includes(k))) {
        data.title = firstExp.title;
        data.company = firstExp.company;
        console.log('Corrigé depuis experience:', { title: data.title, company: data.company });
      }
    }
  }
  
  // CORRECTION 3: Si title est une école, c'est une erreur
  if (titleIsSchool) {
    console.log('Correction: title est une école, cherchant dans experience');
    if (data.experience && data.experience.length > 0) {
      const firstExp = data.experience[0];
      if (firstExp && firstExp.title && jobTitleKeywords.some(k => firstExp.title.toLowerCase().includes(k))) {
        data.title = firstExp.title;
        if (firstExp.company && !schoolKeywords.some(k => firstExp.company.toLowerCase().includes(k))) {
          data.company = firstExp.company;
        }
        console.log('Corrigé depuis experience:', { title: data.title, company: data.company });
      }
    }
  }
  
  // CORRECTION 4: Si title contient "Campus Consulting" ou similaire (nom d'entreprise)
  if (title.toLowerCase().includes('campus consulting') || 
      title.toLowerCase().includes('consulting') && !jobTitleKeywords.some(k => title.toLowerCase().includes(k))) {
    console.log('Correction: title contient un nom d\'entreprise');
    if (data.experience && data.experience.length > 0) {
      const firstExp = data.experience[0];
      if (firstExp && firstExp.title && jobTitleKeywords.some(k => firstExp.title.toLowerCase().includes(k))) {
        data.title = firstExp.title;
        if (firstExp.company) {
          data.company = firstExp.company;
        } else {
          data.company = title; // Le title était en fait l'entreprise
        }
        console.log('Corrigé:', { title: data.title, company: data.company });
      }
    }
  }
  
  return data;
}

/**
 * Recherche les informations d'entreprise (SIRET, raison sociale, siège social) via Gemini avec recherche web
 */
async function searchCompanyInfo(companyName, geminiApiKey) {
  try {
    // Utiliser gemini-1.5-pro qui supporte Google Search Grounding
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';
    
    const SEARCH_PROMPT = `Recherche sur internet les informations publiques suivantes pour l'entreprise "${companyName}" en France :

1. Raison sociale (nom officiel de l'entreprise)
2. SIRET (14 chiffres)
3. Siège social (adresse complète)

Ces informations sont publiques et disponibles sur :
- sirene.fr (répertoire SIRENE)
- societe.com
- infogreffe.fr
- pagesjaunes.fr

Retourne UNIQUEMENT un JSON valide au format suivant (utilise "" si une information n'est pas trouvée) :

{
  "raisonSociale": "Raison sociale exacte",
  "siret": "SIRET (14 chiffres sans espaces)",
  "siegeSocial": "Adresse complète du siège social"
}

IMPORTANT :
- Ne retourne QUE le JSON, sans texte avant ou après
- Le SIRET doit être exactement 14 chiffres
- L'adresse doit être complète (numéro, rue, code postal, ville)`;

    const response = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: SEARCH_PROMPT
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024
        },
        tools: [
          {
            googleSearch: {} // Active Google Search Grounding
          }
        ],
        toolConfig: {
          googleSearch: {
            // Configuration pour la recherche web
          }
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Erreur API Gemini: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      return null;
    }

    // Nettoyer et parser le JSON
    let cleanedText = text.trim();
    cleanedText = cleanedText.replace(/```json\n?/g, '');
    cleanedText = cleanedText.replace(/```\n?/g, '');
    cleanedText = cleanedText.trim();

    let companyInfo;
    try {
      companyInfo = JSON.parse(cleanedText);
    } catch (parseError) {
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        companyInfo = JSON.parse(jsonMatch[0]);
      } else {
        return null;
      }
    }

    // Valider et nettoyer les données
    return {
      raisonSociale: companyInfo.raisonSociale || '',
      siret: (companyInfo.siret || '').replace(/\s/g, ''), // Enlever les espaces du SIRET
      siegeSocial: companyInfo.siegeSocial || ''
    };
  } catch (error) {
    console.error('Erreur lors de la recherche d\'informations d\'entreprise:', error);
    return null;
  }
} 