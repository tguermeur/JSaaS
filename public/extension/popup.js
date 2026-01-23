// Configuration Firebase - injectée automatiquement au build time
// Les valeurs seront remplacées par le script de build depuis les variables d'environnement
const firebaseConfig = {
  apiKey: "AIzaSyCW55pfTJwuRosEx9Sxs-LELEWv1RiS3iI",
  authDomain: "jsaas-dd2f7.firebaseapp.com",
  projectId: "jsaas-dd2f7",
  storageBucket: "jsaas-dd2f7.firebasestorage.app",
  messagingSenderId: "1028151005055",
  appId: "1:1028151005055:web:66a22fecbffcea812c944a"
};

// Initialisation immédiate de Firebase avec la configuration injectée au build
let app = null;
let auth = null;
let db = null;
let firebaseInitialized = false;

function initializeFirebase() {
  try {
    // Validation que la configuration a été correctement injectée au build
    if (firebaseConfig.apiKey.startsWith('__') || !firebaseConfig.apiKey) {
      const errorMsg = 'Configuration Firebase non injectée. ' +
        'L\'extension a été téléchargée sans la configuration Firebase. ' +
        'Veuillez télécharger à nouveau l\'extension depuis l\'application après que l\'administrateur ait reconstruit l\'extension.';
      throw new Error(errorMsg);
    }
    
    // Initialisation de Firebase
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore(app);
    firebaseInitialized = true;
    
    console.log('Firebase initialisé avec succès');
    setupAuthListeners();
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de Firebase:', error);
    showFirebaseConfigError(error.message);
    firebaseInitialized = false;
    return false;
  }
}

// Fonction pour afficher une erreur de configuration Firebase
function showFirebaseConfigError(message) {
  const errorDiv = document.getElementById('error');
  if (errorDiv) {
    errorDiv.innerHTML = `
      <strong>Erreur de configuration Firebase</strong><br>
      ${message}<br><br>
      <strong>Solution :</strong><br>
      1. Supprimez l'extension actuelle de Chrome<br>
      2. Téléchargez à nouveau l'extension depuis l'application<br>
      3. Si le problème persiste, contactez l'administrateur
    `;
    errorDiv.style.display = 'block';
    errorDiv.style.opacity = '1';
    errorDiv.style.padding = '12px';
    errorDiv.style.borderRadius = '8px';
    errorDiv.style.backgroundColor = '#ffebee';
    errorDiv.style.color = '#c62828';
    errorDiv.style.fontSize = '13px';
    errorDiv.style.lineHeight = '1.6';
  }
  
  // Masquer le formulaire de connexion si Firebase n'est pas configuré
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.style.display = 'none';
  }
  
  console.error('Configuration Firebase requise:', message);
}

// Initialiser Firebase immédiatement au chargement
initializeFirebase();

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
const tokenStatus = document.getElementById('tokenStatus');
const tokenCount = document.getElementById('tokenCount');
const tokenProgressBar = document.getElementById('tokenProgressBar');
const tokenProgressFill = document.getElementById('tokenProgressFill');

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
  if (!firebaseInitialized || !auth) {
    throw new Error('Firebase n\'est pas initialisé');
  }
  
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

// Constantes pour le système de tokens
const TOKENS_PER_MONTH = 100;
const TOKEN_COST_PER_PROSPECT = 1;

/**
 * Consomme un token pour créer un prospect (version extension avec Firebase compat)
 */
async function consumeTokenForExtension(structureId) {
  console.log(`[Extension consumeToken] DÉBUT - Structure ID: ${structureId}`);
  
  if (!structureId) {
    console.error('[Extension consumeToken] Structure ID manquant');
    return { success: false, tokensRemaining: 0, error: 'Structure ID requis' };
  }

  try {
    const tokensRef = db.collection('structureTokens').doc(structureId);
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    // Utiliser une transaction pour garantir la cohérence
    try {
      return await db.runTransaction(async (transaction) => {
      console.log('[Extension consumeToken] Transaction démarrée');
      const tokensDoc = await transaction.get(tokensRef);
      console.log('[Extension consumeToken] Document récupéré, existe:', tokensDoc.exists);
      
      if (!tokensDoc.exists) {
        // Créer le document avec les tokens initiaux
        const newTokens = {
          structureId,
          tokensRemaining: TOKENS_PER_MONTH - TOKEN_COST_PER_PROSPECT,
          tokensTotal: TOKENS_PER_MONTH,
          lastResetDate: currentMonth,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        transaction.set(tokensRef, newTokens);
        console.log(`[Extension consumeToken] Document créé avec ${newTokens.tokensRemaining} tokens`);
        return { success: true, tokensRemaining: newTokens.tokensRemaining };
      }

      const data = tokensDoc.data();
      console.log('[Extension consumeToken] Données actuelles:', data);
      
      // Vérifier si on doit réinitialiser (nouveau mois)
      let tokensRemaining = data.tokensRemaining || TOKENS_PER_MONTH;
      let lastResetDate = data.lastResetDate || currentMonth;
      
      if (data.lastResetDate !== currentMonth) {
        // Nouveau mois, réinitialiser
        console.log(`[Extension consumeToken] Nouveau mois détecté, réinitialisation`);
        tokensRemaining = TOKENS_PER_MONTH;
        lastResetDate = currentMonth;
      }

      // Vérifier si assez de tokens
      if (tokensRemaining < TOKEN_COST_PER_PROSPECT) {
        console.log(`[Extension consumeToken] Pas assez de tokens: ${tokensRemaining} < ${TOKEN_COST_PER_PROSPECT}`);
        return { 
          success: false, 
          tokensRemaining, 
          error: `Quota mensuel atteint. Vous avez utilisé ${(data.tokensTotal || TOKENS_PER_MONTH) - tokensRemaining}/${data.tokensTotal || TOKENS_PER_MONTH} tokens ce mois-ci.` 
        };
      }

      // Consommer le token
      const newTokensRemaining = tokensRemaining - TOKEN_COST_PER_PROSPECT;
      console.log(`[Extension consumeToken] Consommation: ${tokensRemaining} -> ${newTokensRemaining}`);
      transaction.update(tokensRef, {
        tokensRemaining: newTokensRemaining,
        tokensTotal: lastResetDate !== data.lastResetDate ? TOKENS_PER_MONTH : (data.tokensTotal || TOKENS_PER_MONTH),
        lastResetDate,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      console.log(`[Extension consumeToken] Token consommé: ${tokensRemaining} -> ${newTokensRemaining} pour structure ${structureId}`);
      return { success: true, tokensRemaining: newTokensRemaining };
      });
    } catch (transactionError) {
      // Fallback si la transaction échoue (peut-être à cause des règles de sécurité)
      console.warn('[Extension consumeToken] Transaction échouée, utilisation du fallback:', transactionError);
      
      // Fallback: utiliser get + update
      const tokensDoc = await tokensRef.get();
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      if (!tokensDoc.exists) {
        const newTokens = {
          structureId,
          tokensRemaining: TOKENS_PER_MONTH - TOKEN_COST_PER_PROSPECT,
          tokensTotal: TOKENS_PER_MONTH,
          lastResetDate: currentMonth,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await tokensRef.set(newTokens);
        return { success: true, tokensRemaining: newTokens.tokensRemaining };
      }

      const data = tokensDoc.data();
      let tokensRemaining = data.tokensRemaining || TOKENS_PER_MONTH;
      let lastResetDate = data.lastResetDate || currentMonth;
      
      if (data.lastResetDate !== currentMonth) {
        tokensRemaining = TOKENS_PER_MONTH;
        lastResetDate = currentMonth;
      }

      if (tokensRemaining < TOKEN_COST_PER_PROSPECT) {
        return { 
          success: false, 
          tokensRemaining, 
          error: `Quota mensuel atteint. Vous avez utilisé ${(data.tokensTotal || TOKENS_PER_MONTH) - tokensRemaining}/${data.tokensTotal || TOKENS_PER_MONTH} tokens ce mois-ci.` 
        };
      }

      const newTokensRemaining = tokensRemaining - TOKEN_COST_PER_PROSPECT;
      await tokensRef.update({
        tokensRemaining: newTokensRemaining,
        tokensTotal: lastResetDate !== data.lastResetDate ? TOKENS_PER_MONTH : (data.tokensTotal || TOKENS_PER_MONTH),
        lastResetDate,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, tokensRemaining: newTokensRemaining };
    }
  } catch (error) {
    console.error('[Extension consumeToken] Erreur lors de la consommation du token:', error);
    console.error('[Extension consumeToken] Détails de l\'erreur:', {
      message: error?.message,
      code: error?.code,
      structureId
    });
    
    return { 
      success: false, 
      tokensRemaining: 0, 
      error: error?.message || 'Erreur lors de la vérification des tokens' 
    };
  }
}

/**
 * Récupère les tokens de la structure
 */
async function getStructureTokensForExtension(structureId) {
  if (!structureId) return null;

  try {
    const tokensRef = db.collection('structureTokens').doc(structureId);
    const tokensDoc = await tokensRef.get();
    
    if (tokensDoc.exists) {
      const data = tokensDoc.data();
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // Vérifier si on doit réinitialiser (nouveau mois)
      let tokensRemaining = data.tokensRemaining || TOKENS_PER_MONTH;
      let tokensTotal = data.tokensTotal || TOKENS_PER_MONTH;
      
      if (data.lastResetDate !== currentMonth) {
        // Nouveau mois, réinitialiser
        tokensRemaining = TOKENS_PER_MONTH;
        tokensTotal = TOKENS_PER_MONTH;
      }
      
      return {
        tokensRemaining,
        tokensTotal,
        lastResetDate: data.lastResetDate || currentMonth
      };
    } else {
      // Document n'existe pas, créer avec les tokens initiaux
      const currentMonth = new Date().toISOString().slice(0, 7);
      const newTokens = {
        structureId,
        tokensRemaining: TOKENS_PER_MONTH,
        tokensTotal: TOKENS_PER_MONTH,
        lastResetDate: currentMonth,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await tokensRef.set(newTokens);
      return {
        tokensRemaining: TOKENS_PER_MONTH,
        tokensTotal: TOKENS_PER_MONTH,
        lastResetDate: currentMonth
      };
    }
  } catch (error) {
    console.error('[Extension getStructureTokens] Erreur:', error);
    return null;
  }
}

/**
 * Met à jour l'affichage des tokens dans l'extension
 */
function updateTokenDisplay(tokens) {
  if (!tokens || !tokenStatus || !tokenCount || !tokenProgressFill) return;
  
  const { tokensRemaining, tokensTotal } = tokens;
  const percentage = (tokensRemaining / tokensTotal) * 100;
  
  // Afficher le statut
  tokenStatus.style.display = 'block';
  tokenCount.textContent = `${tokensRemaining} / ${tokensTotal}`;
  
  // Mettre à jour la barre de progression
  tokenProgressFill.style.width = `${percentage}%`;
  
  // Changer la couleur selon le nombre de tokens restants
  if (tokensRemaining === 0) {
    tokenProgressFill.style.background = '#ff3b30'; // Rouge
    tokenStatus.style.backgroundColor = '#ffebee';
    tokenStatus.style.border = '1px solid #ff3b30';
    tokenStatus.style.color = '#c62828';
  } else if (tokensRemaining <= 10) {
    tokenProgressFill.style.background = '#ff9f0a'; // Orange
    tokenStatus.style.backgroundColor = '#fff4e5';
    tokenStatus.style.border = '1px solid #ff9f0a';
    tokenStatus.style.color = '#b8860b';
  } else {
    tokenProgressFill.style.background = '#34c759'; // Vert
    tokenStatus.style.backgroundColor = '#eafbf1';
    tokenStatus.style.border = '1px solid #34c759';
    tokenStatus.style.color = '#2e7d32';
  }
  
  // Désactiver le bouton si pas de tokens
  if (tokensRemaining === 0) {
    saveButton.disabled = true;
    saveButton.style.background = '#e5e5ea';
    saveButton.style.color = '#86868b';
    saveButton.textContent = 'Quota mensuel atteint';
  }
}

/**
 * Restaure un token (en cas d'erreur lors de la création du prospect)
 */
async function restoreTokenForExtension(structureId) {
  if (!structureId) return;

  try {
    const tokensRef = db.collection('structureTokens').doc(structureId);
    const tokensDoc = await tokensRef.get();
    
    if (tokensDoc.exists) {
      const data = tokensDoc.data();
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // Vérifier si on doit réinitialiser
      let tokensRemaining = data.tokensRemaining || TOKENS_PER_MONTH;
      if (data.lastResetDate !== currentMonth) {
        tokensRemaining = TOKENS_PER_MONTH;
      }

      await tokensRef.update({
        tokensRemaining: Math.min(tokensRemaining + TOKEN_COST_PER_PROSPECT, TOKENS_PER_MONTH),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('[Extension restoreToken] Token restauré');
    }
  } catch (error) {
    console.error('[Extension restoreToken] Erreur lors de la restauration du token:', error);
  }
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
  if (!firebaseInitialized || !auth || !db) return;
  
  const user = auth.currentUser;
  if (!user) return;

  try {
    // Récupérer les tokens de la structure
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      const structureId = userDoc.data().structureId;
      if (structureId) {
        const tokens = await getStructureTokensForExtension(structureId);
        if (tokens) {
          updateTokenDisplay(tokens);
          
          // Si pas de tokens, désactiver le bouton et arrêter ici
          if (tokens.tokensRemaining === 0) {
            saveButton.disabled = true;
            saveButton.style.background = '#e5e5ea';
            saveButton.style.color = '#86868b';
            saveButton.textContent = 'Quota mensuel atteint';
            prospectInfo.style.display = 'none';
            return;
          }
        }
      }
    }
    
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

// Fonction pour configurer les listeners d'authentification (appelée après l'initialisation de Firebase)
function setupAuthListeners() {
  if (!auth) {
    console.error('Firebase Auth n\'est pas initialisé');
    return;
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
} // Fin de setupAuthListeners

// Gestionnaire de connexion
loginButton.addEventListener('click', async () => {
  if (!firebaseInitialized || !auth) {
    showStatus('Firebase n\'est pas initialisé. Veuillez recharger l\'extension.', 'error', 3000);
    return;
  }
  
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
  if (!firebaseInitialized || !auth || !db) {
    showStatus('Firebase n\'est pas initialisé. Veuillez recharger l\'extension.', 'error', 3000);
    return;
  }
  
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
      } catch (error) {
        console.error('Erreur lors de l\'envoi du message au content script:', error);
        
        // Réessayer une fois après un court délai
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          response = await chrome.tabs.sendMessage(tab.id, { action: 'getProfileData' });
          console.log('Réponse reçue (2e tentative):', response);
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

      const structureId = userDoc.data().structureId;
      if (!structureId) {
        throw new Error('Structure ID non trouvé pour l\'utilisateur');
      }

      // Consommer un token avant d'ajouter le prospect
      console.log('[Extension] Consommation d\'un token pour structure:', structureId);
      const tokenResult = await consumeTokenForExtension(structureId);
      
      if (!tokenResult.success) {
        const errorMsg = tokenResult.error || 'Quota mensuel de tokens atteint';
        console.error('[Extension] Échec consommation token:', errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log('[Extension] Token consommé avec succès. Tokens restants:', tokenResult.tokensRemaining);

      // Envoi des données à Firebase avec assignation automatique à l'utilisateur qui ajoute
      try {
        await db.collection('prospects').add({
          ...profileData,
          userId: user.uid,
          ownerId: user.uid, // Assigner automatiquement le prospect à l'utilisateur qui l'ajoute
          structureId: structureId,
          dateCreation: firebase.firestore.FieldValue.serverTimestamp(),
          dateAjout: new Date().toISOString()
        });
      } catch (addError) {
        // En cas d'erreur, restaurer le token
        console.error('[Extension] Erreur lors de l\'ajout du prospect, restauration du token...');
        await restoreTokenForExtension(structureId);
        throw addError;
      }

      showSuccessAnimation();
      prospectAdded = true;
      saveButton.textContent = 'Prospect ajouté';
      saveButton.style.background = 'var(--success-color)';
      
      // Rafraîchir l'affichage des tokens après l'ajout
      const userDocAfter = await db.collection('users').doc(user.uid).get();
      if (userDocAfter.exists) {
        const structureIdAfter = userDocAfter.data().structureId;
        if (structureIdAfter) {
          const tokensAfter = await getStructureTokensForExtension(structureIdAfter);
          if (tokensAfter) {
            updateTokenDisplay(tokensAfter);
          }
        }
      }
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
  // Attendre que Firebase soit initialisé avant de vérifier le prospect
  const checkWhenReady = () => {
    if (firebaseInitialized && auth && auth.currentUser) {
      checkCurrentProspect();
    } else if (!firebaseInitialized) {
      // Réessayer après un court délai si Firebase n'est pas encore initialisé
      setTimeout(checkWhenReady, 100);
    }
  };
  checkWhenReady();
});

console.log("Extension popup chargée !"); 