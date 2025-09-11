import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Configuration Firebase avec valeurs par défaut pour le projet jsaas-dd2f7
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCW55pfTJwuRosEx9Sxs-LELEWv1RiS3iI',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'jsaas-dd2f7.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'jsaas-dd2f7',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'jsaas-dd2f7.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1028151005055',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1028151005055:web:66a22fecbffcea812c944a'
};

// Initialiser Firebase avec gestion d'erreur
let app: any = null;
try {
  app = initializeApp(firebaseConfig);
  console.log('Firebase app initialisé avec succès');
} catch (error) {
  console.error('Erreur lors de l\'initialisation de Firebase app:', error);
  // Ne pas throw l'erreur, continuer avec app = null
  app = null;
}

// Initialiser les services avec gestion d'erreur
export const auth = app ? getAuth(app) : null;

// Configuration Firestore avec persistance et gestion des onglets
export const db = app ? initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  }),
  experimentalForceLongPolling: true // Utiliser le long polling pour une meilleure stabilité
}) : null;

// Configuration pour la production - pas d'émulateurs
console.log('Configuration Firebase pour la production - utilisation des services cloud');

// Initialiser Storage avec gestion d'erreur
let storage;
try {
  storage = app ? getStorage(app) : null;
  if (storage) {
    console.log('Firebase Storage initialisé avec succès');
  }
} catch (error) {
  console.warn('Firebase Storage non disponible:', error);
  storage = null;
}
export { storage };

// Initialiser Firebase Functions de manière paresseuse
let functionsInstance: any = null;

export const getFirebaseFunctions = async () => {
  if (!functionsInstance) {
    try {
      if (!app) {
        console.error('Firebase app non initialisée');
        return null;
      }
      
      // Attendre que l'app soit complètement initialisée
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Initialisation des fonctions avec gestion d'erreur améliorée
      try {
        functionsInstance = getFunctions(app, 'us-central1');
        console.log('Firebase Functions initialisé avec succès (mode production)');
      } catch (functionsError) {
        console.error('Erreur lors de l\'initialisation de Firebase Functions:', functionsError);
        // Essayer sans spécifier la région
        try {
          functionsInstance = getFunctions(app);
          console.log('Firebase Functions initialisé avec succès (région par défaut)');
        } catch (fallbackError) {
          console.error('Erreur lors de l\'initialisation de Firebase Functions (fallback):', fallbackError);
          return null;
        }
      }
      
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de Firebase Functions:', error);
      return null;
    }
  }
  return functionsInstance;
};

// Vérification des variables d'environnement
if (!import.meta.env.VITE_FIREBASE_API_KEY) {
  console.warn('Variable VITE_FIREBASE_API_KEY manquante - utilisation de la valeur par défaut');
}

// Vérification de la clé publique Stripe
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  console.warn('Clé publique Stripe manquante. Créez un fichier .env avec votre clé Stripe.');
}

export default app; 