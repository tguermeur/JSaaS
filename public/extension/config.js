// Configuration Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// URL de l'application
const APP_URL = process.env.VITE_APP_URL;

// Clé API Gemini (peut être configurée via chrome.storage)
// Pour la configurer, utilisez: chrome.storage.local.set({geminiApiKey: 'VOTRE_CLE'})
let GEMINI_API_KEY = null;

// Charger la clé depuis le storage au démarrage
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.local.get(['geminiApiKey'], (result) => {
    if (result.geminiApiKey) {
      GEMINI_API_KEY = result.geminiApiKey;
    }
  });
}

// Fonction pour définir la clé API
export function setGeminiApiKey(key) {
  GEMINI_API_KEY = key;
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ geminiApiKey: key });
  }
}

// Fonction pour obtenir la clé API
export function getGeminiApiKey() {
  return GEMINI_API_KEY;
}

export { firebaseConfig, APP_URL, GEMINI_API_KEY }; 