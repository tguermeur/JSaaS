// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCW55pfTJwuRosEx9Sxs-LELEWv1RiS3iI",
  authDomain: "jsaas-dd2f7.firebaseapp.com",
  projectId: "jsaas-dd2f7",
  storageBucket: "jsaas-dd2f7.firebasestorage.app",
  messagingSenderId: "1028151005055",
  appId: "1:1028151005055:web:66a22fecbffcea812c944a"
};

// Initialisation de Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore(app);

// Éléments du DOM
const loginForm = document.getElementById('loginForm');
const loggedIn = document.getElementById('loggedIn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('loginButton');
const logoutButton = document.getElementById('logoutButton');
const errorDiv = document.getElementById('error');
const successDiv = document.getElementById('success');
const userEmailSpan = document.getElementById('userEmail');
const saveButton = document.getElementById('saveProspect');
const statusDiv = document.getElementById('status');
const loadingDiv = document.getElementById('loading');
const successAnimation = document.getElementById('successAnimation');
const prospectInfo = document.getElementById('prospectInfo');
const addDate = document.getElementById('addDate');
const addedBy = document.getElementById('addedBy');
const addedByEmail = document.getElementById('addedByEmail');
const initialLoading = document.getElementById('initialLoading');

// Variable pour suivre si un prospect a déjà été ajouté
let prospectAdded = false;

// URL de la Cloud Function qui appelle Gemini côté serveur (clé API secrète)
const GEMINI_EXTRACT_URL = 'https://us-central1-jsaas-dd2f7.cloudfunctions.net/api/gemini/extract-profile';

/**
 * Valide qu'une URL de photo LinkedIn est correcte et non corrompue
 * L'IA peut halluciner des URLs avec des paramètres répétés
 */
function isValidLinkedInPhotoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  // Doit commencer par le CDN LinkedIn
  if (!url.startsWith('https://media.licdn.com/')) return false;
  
  // Vérifier que l'URL n'est pas trop longue (les URLs corrompues ont souvent des paramètres répétés)
  if (url.length > 500) return false;
  
  // Vérifier qu'il n'y a pas de patterns répétés (signe d'hallucination)
  const repeatedPattern = /(\d{4}_){5,}/; // Pattern comme "6478_6478_6478_6478_6478_"
  if (repeatedPattern.test(url)) return false;
  
  // Vérifier que le paramètre 't=' n'est pas anormalement long
  const tParamMatch = url.match(/[?&]t=([^&]*)/);
  if (tParamMatch && tParamMatch[1].length > 100) return false;
  
  return true;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function execInTab(tabId, func, args = []) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func,
    args
  });
  return results?.[0]?.result;
}

async function captureVisibleTabBase64() {
  const dataUrl = await new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      null,
      { format: 'png', quality: 90 },
      (url) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(url);
      }
    );
  });
  return String(dataUrl).split(',')[1];
}

async function captureTopAndExperience(tabId) {
  // Sauvegarder la position actuelle
  const initialScrollY = await execInTab(tabId, () => window.scrollY);

  // Capture en haut de la page
  await execInTab(tabId, () => window.scrollTo(0, 0));
  await sleep(800);
  const top = await captureVisibleTabBase64();

  // Scroll vers la section Expérience (CRUCIAL pour éviter l'école)
  const foundExperience = await execInTab(tabId, () => {
    const spans = Array.from(document.querySelectorAll('span[aria-hidden="true"]'));
    const exp = spans.find(s => (s.textContent || '').trim() === 'Expérience' || (s.textContent || '').trim() === 'Experience');
    if (exp) {
      const container = exp.closest('section') || exp.closest('div');
      (container || exp).scrollIntoView({ block: 'start', behavior: 'instant' });
      return true;
    }
    // fallback: ancre id experience
    const byId = document.querySelector('#experience');
    if (byId) {
      byId.scrollIntoView({ block: 'start', behavior: 'instant' });
      return true;
    }
    return false;
  });

  await sleep(foundExperience ? 1200 : 500);
  const experience = await captureVisibleTabBase64();

  // Restaurer le scroll
  if (typeof initialScrollY === 'number') {
    await execInTab(tabId, (y) => window.scrollTo(0, y), [initialScrollY]);
  }

  return { top, experience, foundExperience };
}

async function callGeminiExtractionServer(linkedinUrl, imagesBase64) {
  const user = auth.currentUser;
  if (!user) throw new Error('Utilisateur non connecté');

  const idToken = await user.getIdToken(true);

  const resp = await fetch(GEMINI_EXTRACT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      linkedinUrl,
      images: imagesBase64
    })
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Erreur serveur Gemini (${resp.status}): ${text || resp.statusText}`);
  }

  const json = await resp.json();
  if (!json?.success) throw new Error(json?.error || 'Extraction IA serveur échouée');
  return json.data;
}

// Fonction pour formater la date
function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

// Fonction pour vérifier si le prospect existe déjà
async function checkProspectExists(linkedinUrl, userId) {
  try {
    const querySnapshot = await db.collection('prospects')
      .where('linkedinUrl', '==', linkedinUrl)
      .get();
    
    if (!querySnapshot.empty) {
      const prospectDoc = querySnapshot.docs[0];
      const prospectData = prospectDoc.data();
      
      // Récupérer les informations de l'utilisateur qui a ajouté le prospect
      try {
        const userDoc = await db.collection('users').doc(prospectData.userId).get();
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          const firstName = userData.firstName || userData.prenom || userData.firstname || '';
          const lastName = userData.lastName || userData.nom || userData.lastname || '';
          const displayName = userData.displayName || userData.name || `${firstName} ${lastName}`.trim();
          
          return {
            exists: true,
            data: {
              date: formatDate(prospectData.dateCreation),
              addedBy: displayName || 'Utilisateur inconnu'
            }
          };
        }
      } catch (userError) {
        console.error('Erreur lors de la récupération des infos utilisateur:', userError);
      }

      // Fallback avec les données de base du prospect
      return {
        exists: true,
        data: {
          date: formatDate(prospectData.dateCreation),
          addedBy: 'Utilisateur inconnu'
        }
      };
    }
    
    return { exists: false };
  } catch (error) {
    console.error('Erreur lors de la vérification du prospect:', error);
    return { exists: false };
  }
}

// Fonction pour vérifier le prospect actuel
async function checkCurrentProspect() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url.includes('linkedin.com/in/')) {
      saveButton.textContent = 'Allez sur un profil LinkedIn';
      saveButton.disabled = true;
      prospectInfo.style.display = 'none';
      return;
    }

    const result = await checkProspectExists(tab.url, user.uid);
    if (result.exists) {
      prospectAdded = true;
      saveButton.textContent = 'Prospect déjà ajouté';
      saveButton.style.background = 'var(--success-color)';
      saveButton.disabled = true;
      
      // Afficher les informations d'ajout
      addDate.textContent = result.data.date;
      addedBy.textContent = result.data.addedBy;
      prospectInfo.style.display = 'block';
    } else {
      prospectAdded = false;
      saveButton.textContent = 'Ajouter le prospect';
      saveButton.style.background = 'var(--primary-color)';
      saveButton.disabled = false;
      prospectInfo.style.display = 'none';
    }
  } catch (error) {
    console.error('Erreur lors de la vérification:', error);
  }
}

// Fonction pour afficher les messages de statut avec animation
function showStatus(message, type, duration = null) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.opacity = '0';
  statusDiv.style.display = 'block';
  setTimeout(() => {
    statusDiv.style.opacity = '1';
  }, 10);

  if (duration) {
    setTimeout(() => {
      statusDiv.style.opacity = '0';
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 300);
    }, duration);
  }
}

// Fonction pour afficher l'animation de succès
function showSuccessAnimation() {
  successAnimation.style.display = 'flex';
  setTimeout(() => {
    successAnimation.classList.add('visible');
    setTimeout(() => {
      successAnimation.classList.remove('visible');
      setTimeout(() => {
        successAnimation.style.display = 'none';
      }, 300);
    }, 1500);
  }, 10);
}

// Fonction pour gérer la transition entre les états
function showElement(element, show = true) {
  if (show) {
    element.style.display = 'block';
    // Attendre le prochain frame pour ajouter la classe visible
    requestAnimationFrame(() => {
      element.classList.add('visible');
    });
  } else {
    element.classList.remove('visible');
    element.addEventListener('transitionend', function handler() {
      element.style.display = 'none';
      element.removeEventListener('transitionend', handler);
    });
  }
}

// Fonction pour cacher le chargement initial
function hideInitialLoading() {
  initialLoading.classList.add('hidden');
  initialLoading.addEventListener('transitionend', function handler() {
    initialLoading.style.display = 'none';
    initialLoading.removeEventListener('transitionend', handler);
  });
}

// Gestion de l'état d'authentification
auth.onAuthStateChanged(async (user) => {
  if (user) {
    try {
      // Récupérer les informations de l'utilisateur depuis Firestore
      const userDoc = await db.collection('users').doc(user.uid).get();
      console.log('Données utilisateur:', userDoc.data());
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        // Vérifier les différentes possibilités de structure des données
        const firstName = userData.firstName || userData.prenom || userData.firstname || '';
        const lastName = userData.lastName || userData.nom || userData.lastname || '';
        const displayName = userData.displayName || userData.name || `${firstName} ${lastName}`.trim();
        
        console.log('Nom affiché:', displayName);
        
        hideInitialLoading();
        showElement(loginForm, false);
        showElement(loggedIn, true);
        userEmailSpan.textContent = displayName || user.email;
        saveButton.style.display = 'block';
        
        // Vérifier le prospect actuel après la connexion
        await checkCurrentProspect();
      } else {
        console.error('Document utilisateur non trouvé');
        hideInitialLoading();
        showElement(loginForm, true);
        auth.signOut();
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des données utilisateur:', error);
      hideInitialLoading();
      showElement(loginForm, true);
      showStatus('Erreur lors de la récupération des données utilisateur', 'error');
    }
  } else {
    hideInitialLoading();
    showElement(loginForm, true);
    showElement(loggedIn, false);
    saveButton.style.display = 'none';
  }
});

// Gestionnaire de connexion
loginButton.addEventListener('click', async () => {
  const email = emailInput.value;
  const password = passwordInput.value;

  try {
    errorDiv.style.opacity = '0';
    successDiv.style.opacity = '0';
    loginButton.disabled = true;
    loginButton.textContent = 'Connexion...';
    
    await auth.signInWithEmailAndPassword(email, password);
    showSuccessAnimation();
  } catch (error) {
    console.error('Erreur de connexion:', error);
    showStatus('Erreur de connexion. Veuillez vérifier vos identifiants.', 'error', 3000);
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'Se connecter';
  }
});

// Gestionnaire de déconnexion
logoutButton.addEventListener('click', async () => {
  try {
    await auth.signOut();
  } catch (error) {
    console.error('Erreur de déconnexion:', error);
  }
});

// Gestion du clic sur le bouton d'ajout de prospect
saveButton.addEventListener('click', async () => {
  const user = auth.currentUser;
  
  if (!user) {
    showStatus('Veuillez vous connecter d\'abord', 'error', 3000);
    return;
  }

  try {
    loadingDiv.style.display = 'block';
    statusDiv.style.opacity = '0';
    saveButton.disabled = true;
    saveButton.textContent = 'Ajout en cours...';

    // Vérifier si nous sommes sur LinkedIn
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url.includes('linkedin.com/in/')) {
      throw new Error('Veuillez être sur un profil LinkedIn pour ajouter un prospect');
    }

    // Vérifier à nouveau si le prospect existe
    const result = await checkProspectExists(tab.url, user.uid);
    if (result.exists) {
      throw new Error('Ce prospect a déjà été ajouté');
    }

    // Injecter le content script si nécessaire
    try {
      console.log('Tentative d\'injection du content script...');
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      console.log('Content script injecté avec succès');

      // Attendre un peu pour s'assurer que le script est bien chargé et que le listener est prêt
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Récupération des données du profil LinkedIn
      console.log('Envoi du message au content script...');
      
      // Vérifier que la page est bien chargée en vérifiant la présence d'éléments clés
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            return document.querySelector('h1') !== null;
          }
        });
      } catch (e) {
        console.warn('Impossible de vérifier le chargement de la page:', e);
      }
      
      let response;
      try {
        response = await chrome.tabs.sendMessage(tab.id, { action: 'getProfileData' });
        console.log('Réponse reçue:', response);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'popup.js:390',message:'Response received from content script',data:{response:response,hasResponse:!!response,success:response?.success,error:response?.error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
        // #endregion
      } catch (error) {
        console.error('Erreur lors de l\'envoi du message au content script:', error);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'popup.js:397',message:'Error sending message to content script',data:{error:error.message,errorStack:error.stack,tabId:tab.id,tabUrl:tab.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'P'})}).catch(()=>{});
        // #endregion
        
        // Réessayer une fois après un court délai
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          response = await chrome.tabs.sendMessage(tab.id, { action: 'getProfileData' });
          console.log('Réponse reçue (2e tentative):', response);
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'popup.js:405',message:'Response received from content script (retry)',data:{response:response,hasResponse:!!response,success:response?.success},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
          // #endregion
        } catch (retryError) {
          console.error('Erreur lors de la 2e tentative:', retryError);
          throw new Error('Impossible de communiquer avec le content script. Veuillez recharger la page LinkedIn et réessayer.');
        }
      }

      if (!response) {
        throw new Error('Aucune réponse reçue du content script');
      }

      if (!response.success) {
        throw new Error(response.error || 'Erreur lors de l\'extraction des données');
      }

      let profileData = response.data;
      
      // Sauvegarder la photo extraite du DOM (plus fiable que l'IA pour les URLs)
      const domPhotoUrl = response.data?.photoUrl || '';

      // TOUJOURS utiliser l'IA (extraction DOM supprimée)
      if (response.fromCache) {
        // Données depuis le cache, utiliser directement
        console.log('Données récupérées depuis le cache');
      } else if (response.needsAI || !response.fromCache) {
        // Pas de cache, utiliser l'IA CÔTÉ SERVEUR (clé API secrète)
        console.log('Extraction IA serveur en cours...');
        showStatus('Extraction IA en cours...', 'info', 20000);

        // Capturer 2 screenshots: haut + section Expérience (sinon l'IA confond avec Formation)
        const { top, experience, foundExperience } = await captureTopAndExperience(tab.id);
        if (!foundExperience) {
          console.warn('Section Expérience non détectée, on continue quand même');
        }

        const extracted = await callGeminiExtractionServer(tab.url, [top, experience]);
        profileData = extracted;
        
        // TOUJOURS utiliser la photo extraite du DOM (l'IA ne peut pas extraire les URLs d'images correctement)
        // L'IA hallucine souvent des URLs corrompues avec des paramètres répétés
        if (domPhotoUrl && isValidLinkedInPhotoUrl(domPhotoUrl)) {
          profileData.photoUrl = domPhotoUrl;
          console.log('Photo de profil récupérée depuis le DOM:', domPhotoUrl);
        } else {
          // Si pas de photo DOM valide, vider le champ (éviter les URLs corrompues de l'IA)
          profileData.photoUrl = '';
          console.log('Pas de photo de profil valide trouvée');
        }

        // Sauvegarder dans le cache
        if (profileData?.linkedinUrl) {
          const cacheKey = `profile_${btoa(profileData.linkedinUrl).replace(/[^a-zA-Z0-9]/g, '_')}`;
          chrome.storage.local.set({
            [cacheKey]: {
              data: profileData,
              timestamp: Date.now()
            }
          });
        }
      }

      // Récupérer les informations de l'utilisateur
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (!userDoc.exists) {
        throw new Error('Informations utilisateur non trouvées');
      }

      // Vérifier que les données essentielles sont présentes (au moins l'URL et le nom)
      if (!profileData.linkedinUrl || !profileData.name) {
        console.error('Données manquantes:', profileData);
        throw new Error('Impossible d\'extraire les données essentielles du profil (nom ou URL manquants)');
      }

      // Envoi des données à Firebase avec assignation automatique à l'utilisateur qui ajoute
      await db.collection('prospects').add({
        ...profileData,
        userId: user.uid,
        ownerId: user.uid, // Assigner automatiquement le prospect à l'utilisateur qui l'ajoute
        structureId: userDoc.data().structureId,
        dateCreation: firebase.firestore.FieldValue.serverTimestamp(),
        dateAjout: new Date().toISOString()
      });

      showSuccessAnimation();
      prospectAdded = true;
      saveButton.textContent = 'Prospect ajouté';
      saveButton.style.background = 'var(--success-color)';
    } catch (error) {
      console.error('Erreur lors de l\'injection ou de l\'exécution du content script:', error);
      if (error.message.includes('Cannot access contents of url "chrome-extension://')) {
        throw new Error('Veuillez recharger la page LinkedIn et réessayer');
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Erreur détaillée:', error);
    showStatus('Erreur: ' + error.message, 'error', 3000);
    if (!error.message.includes('déjà été ajouté')) {
      saveButton.disabled = false;
      saveButton.textContent = 'Ajouter le prospect';
    }
  } finally {
    loadingDiv.style.display = 'none';
  }
});

// Réinitialiser et vérifier l'état quand on change de page LinkedIn
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    checkCurrentProspect();
  }
});

// Vérifier le prospect actuel à l'ouverture de la popup
document.addEventListener('DOMContentLoaded', () => {
  if (auth.currentUser) {
    checkCurrentProspect();
  }
});

console.log("Extension popup chargée !"); 