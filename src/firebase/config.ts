import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// IMPORT CRITIQUE: Importer le module Storage de manière à forcer l'enregistrement du service
// En important le module complet, on s'assure que le code d'enregistrement du service s'exécute
import "firebase/storage";
import { getStorage, ref } from "firebase/storage";

const DEBUG_FIREBASE = import.meta.env.VITE_DEBUG_FIREBASE === 'true';

if (DEBUG_FIREBASE) {
  console.log('[Firebase Config] 📦 Imports et .env:', Object.keys(import.meta.env).filter(k => k.startsWith('VITE_FIREBASE')));
}

// Configuration Firebase - TOUTES les valeurs DOIVENT être définies dans les variables d'environnement
// Pas de valeurs par défaut pour des raisons de sécurité
if (!import.meta.env.VITE_FIREBASE_API_KEY) {
  throw new Error('VITE_FIREBASE_API_KEY est requis. Définissez-la dans votre fichier .env');
}
if (!import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) {
  throw new Error('VITE_FIREBASE_AUTH_DOMAIN est requis. Définissez-la dans votre fichier .env');
}
if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) {
  throw new Error('VITE_FIREBASE_PROJECT_ID est requis. Définissez-la dans votre fichier .env');
}
if (!import.meta.env.VITE_FIREBASE_APP_ID) {
  throw new Error('VITE_FIREBASE_APP_ID est requis. Définissez-la dans votre fichier .env');
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  // Si VITE_FIREBASE_STORAGE_BUCKET n'est pas défini, Firebase SDK utilisera le bucket par défaut
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

if (DEBUG_FIREBASE) {
  console.log('[Firebase Config] 📋 Configuration:', { projectId: firebaseConfig.projectId, storageBucket: firebaseConfig.storageBucket });
}

// Initialiser Firebase avec gestion d'erreur
export let app: any = null;
try {
  app = initializeApp(firebaseConfig);
  if (DEBUG_FIREBASE) console.log('Firebase app initialisé');
  try {
    const appInternal = app as any;
    if (appInternal.container?.providers && !DEBUG_FIREBASE) {
      const hasStorage = Array.from(appInternal.container.providers.keys()).some((name: string) =>
        name.includes('storage') || name === 'storage' || name === 'storage-compat');
      if (!hasStorage) console.warn('[Firebase Config] Service Storage non enregistré');
    } else if (DEBUG_FIREBASE) {
      const providerNames = appInternal.container?.providers ? Array.from(appInternal.container.providers.keys()) : [];
      console.log('[Firebase Config] Services:', providerNames);
    }
  } catch (e) {
    if (DEBUG_FIREBASE) console.warn('[Firebase Config] Vérif. services:', e);
  }
} catch (error) {
  console.error('Erreur lors de l\'initialisation de Firebase app:', error);
  // Ne pas throw l'erreur, continuer avec app = null
  app = null;
}

// Initialiser les services avec gestion d'erreur
export const auth = app ? getAuth(app) : null;

// Configuration Firestore : en dev/localhost, cache mémoire + long polling pour limiter
// les erreurs "access control checks" et "Unexpected state" quand la connexion est bloquée.
const isLocalhost = typeof window !== 'undefined' && /localhost|127\.0\.0\.1|^0\.0\.0\.0$/.test(window.location?.hostname ?? '');
const isDev = import.meta.env.DEV === true;
const useDevFirestore = isLocalhost || isDev;
export const db = app ? initializeFirestore(app, {
  localCache: useDevFirestore
    ? memoryLocalCache()
    : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ...(useDevFirestore ? { experimentalForceLongPolling: true } : {})
}) : null;

if (DEBUG_FIREBASE) console.log('Configuration Firebase - services cloud');

// Fonction helper pour tester si storage est vraiment utilisable
const testStorageInstance = (storageInstance: any): boolean => {
  if (!storageInstance || typeof storageInstance !== 'object') {
    return false;
  }
  
  try {
    // Essayer de créer une référence de test pour vérifier que storage est vraiment initialisé
    const testRef = ref(storageInstance, 'test');
    // Si on arrive ici sans erreur, storage est valide
    return testRef !== null && typeof testRef === 'object';
  } catch (error) {
    console.warn('Test de référence Storage échoué:', error);
    return false;
  }
};

// Initialiser Storage de manière asynchrone avec délai
// Le SDK Firebase peut avoir besoin d'un délai pour détecter Storage après l'activation
let storage: any = null;
let storageInitializationPromise: Promise<any> | null = null;

const initializeStorageAsync = async (): Promise<any> => {
  if (storage) {
    return storage; // Déjà initialisé
  }

  if (!app) {
    console.error('❌ App Firebase non disponible - Storage non initialisé');
    return null;
  }

  if (DEBUG_FIREBASE) {
    console.group('🔍 DIAGNOSTIC FIREBASE STORAGE');
    console.log('Init Storage (asynchrone)');
    console.groupEnd();
  }
  await new Promise(resolve => setTimeout(resolve, 500));
  try {
    storage = getStorage(app);
    if (DEBUG_FIREBASE) console.log('✅ Firebase Storage initialisé');
    return storage;
  } catch (error: any) {
    if (DEBUG_FIREBASE) console.error('❌ Storage init:', error?.message || error);
    
    // Méthode 1a: getStorage() avec le bucket spécifique depuis .env (si défini)
    try {
      if (firebaseConfig.storageBucket) {
        // Utiliser le format gs:// explicitement
        const gsBucket = firebaseConfig.storageBucket.startsWith('gs://') 
          ? firebaseConfig.storageBucket 
          : `gs://${firebaseConfig.storageBucket}`;
        storage = getStorage(app, gsBucket);
        return storage;
      }
    } catch (error1a: any) {
      try {
        storage = getStorage(app);
        return storage;
      } catch (fallbackError: any) {
        try {
          if (firebaseConfig.storageBucket) {
            const bucketName = firebaseConfig.storageBucket.replace(/^gs:\/\//, '');
            storage = getStorage(app, bucketName);
            return storage;
          }
        } catch (_second: any) {
          try {
            const gsBucket = firebaseConfig.storageBucket?.startsWith('gs://') 
              ? firebaseConfig.storageBucket 
              : `gs://${firebaseConfig.storageBucket}`;
            storage = getStorage(app, gsBucket);
            return storage;
          } catch (_third: any) {
            try {
              const bucketWithoutSuffix = firebaseConfig.storageBucket?.replace(/\.firebasestorage\.app$/, '');
              if (bucketWithoutSuffix) {
                storage = getStorage(app, bucketWithoutSuffix);
                return storage;
              }
            } catch (_fourth: any) {
              try {
                const fullBucketName = `${firebaseConfig.storageBucket}.firebasestorage.app`;
                storage = getStorage(app, fullBucketName);
                return storage;
              } catch (_fifth: any) {
                try {
                  storage = getStorage(app, `${firebaseConfig.projectId}.appspot.com`);
                  return storage;
                } catch (_sixth: any) {
                  console.error('❌ Firebase Storage: init échouée (bucket/APIs à vérifier dans la console Firebase)');
                  storage = null;
                }
              }
            }
          }
        }
      }
    }
  }
  return storage;
};

// Initialiser Storage de manière synchrone au chargement (pour compatibilité)
// Mais aussi lancer l'initialisation asynchrone en arrière-plan
if (app) {
  // Lancer l'initialisation asynchrone immédiatement
  storageInitializationPromise = initializeStorageAsync();
  storageInitializationPromise.then((result) => {
    if (result) storage = result;
  }).catch((error) => {
    if (DEBUG_FIREBASE) console.error('❌ Init Storage asynchrone:', error);
  });
} else {
  storage = null;
}

// Export direct (peut être null initialement, sera mis à jour par l'initialisation asynchrone)
export { storage };

// Export de la fonction d'initialisation pour utilisation manuelle si nécessaire
export const getStorageInstance = async (): Promise<any> => {
  if (storage) {
    return storage;
  }
  
  if (storageInitializationPromise) {
    return await storageInitializationPromise;
  }
  
  return await initializeStorageAsync();
};

// Fonction utilitaire pour vérifier si storage est disponible et utilisable
export const isStorageAvailable = (): boolean => {
  if (!storage || !app) {
    return false;
  }
  
  try {
    const testRef = ref(storage, '__test__');
    return testRef !== null && typeof testRef === 'object';
  } catch (error) {
    console.error('Storage non utilisable:', error);
    return false;
  }
};

/** Région Cloud Functions (env) — défaut prod actuelle jusqu'à bascule EU (Phase 6). */
export const FUNCTIONS_REGION =
  (import.meta.env.VITE_FUNCTIONS_REGION as string | undefined)?.trim() || 'us-central1';

/**
 * Base URL HTTP des Cloud Functions.
 * Préférer VITE_FUNCTIONS_BASE_URL ; sinon dériver du projectId + région.
 */
export function getFunctionsBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const projectId = firebaseConfig.projectId as string;
  return `https://${FUNCTIONS_REGION}-${projectId}.cloudfunctions.net`;
}

export function getFunctionsUrl(functionName: string): string {
  return `${getFunctionsBaseUrl()}/${functionName.replace(/^\//, '')}`;
}

/** Instance Functions synchrone (région configurable). */
export function getAppFunctions() {
  if (!app) throw new Error('Firebase app non initialisée');
  return getFunctions(app, FUNCTIONS_REGION);
}

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
        functionsInstance = getFunctions(app, FUNCTIONS_REGION);
        if (DEBUG_FIREBASE) console.log(`Firebase Functions initialisé (${FUNCTIONS_REGION})`);
      } catch (functionsError) {
        console.error('Erreur lors de l\'initialisation de Firebase Functions:', functionsError);
        try {
          functionsInstance = getFunctions(app);
          if (DEBUG_FIREBASE) console.log('Firebase Functions initialisé (région par défaut)');
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

// Vérification des variables d'environnement (déjà fait au début du fichier)
// Les erreurs seront levées si les variables critiques manquent

// Vérification de la clé publique Stripe
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  console.warn('Clé publique Stripe manquante. Créez un fichier .env avec votre clé Stripe.');
}

export default app;
