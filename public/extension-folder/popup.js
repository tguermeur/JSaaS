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

      // Attendre un peu pour s'assurer que le script est bien chargé
      await new Promise(resolve => setTimeout(resolve, 500));

      // Récupération des données du profil LinkedIn
      console.log('Envoi du message au content script...');
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getProfileData' });
      console.log('Réponse reçue:', response);

      if (!response) {
        throw new Error('Aucune réponse reçue du content script');
      }

      if (!response.success) {
        throw new Error(response.error || 'Erreur lors de l\'extraction des données');
      }

      // Récupérer les informations de l'utilisateur
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (!userDoc.exists) {
        throw new Error('Informations utilisateur non trouvées');
      }

      // Vérifier que les données essentielles sont présentes
      if (!response.data.name || !response.data.company) {
        console.error('Données manquantes:', response.data);
        throw new Error('Certaines données du profil n\'ont pas pu être extraites');
      }

      // Envoi des données à Firebase
      await db.collection('prospects').add({
        ...response.data,
        userId: user.uid,
        structureId: userDoc.data().structureId,
        dateCreation: firebase.firestore.FieldValue.serverTimestamp()
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