import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// IMPORT CRITIQUE: Importer le module Storage de manière à forcer l'enregistrement du service
// En important le module complet, on s'assure que le code d'enregistrement du service s'exécute
import "firebase/storage";
import { getStorage, ref } from "firebase/storage";

// Diagnostic des imports au chargement du module
console.log('[Firebase Config] 📦 Vérification des imports:');
console.log('  - initializeApp:', typeof initializeApp === 'function' ? '✅' : '❌');
console.log('  - getAuth:', typeof getAuth === 'function' ? '✅' : '❌');
console.log('  - initializeFirestore:', typeof initializeFirestore === 'function' ? '✅' : '❌');
console.log('  - getStorage:', typeof getStorage === 'function' ? '✅' : '❌');
console.log('  - ref:', typeof ref === 'function' ? '✅' : '❌');
console.log('  - getFunctions:', typeof getFunctions === 'function' ? '✅' : '❌');
console.log('  - Module firebase/storage importé (side-effect): ✅');

// Diagnostic des variables d'environnement
console.group('[Firebase Config] 🔍 DIAGNOSTIC .ENV');
console.log('📍 VITE_FIREBASE_API_KEY:', import.meta.env.VITE_FIREBASE_API_KEY ? '✅ Défini' : '❌ Non défini (utilise valeur par défaut)');
console.log('📍 VITE_FIREBASE_AUTH_DOMAIN:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '❌ Non défini');
console.log('📍 VITE_FIREBASE_PROJECT_ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID || '❌ Non défini');
console.log('📍 VITE_FIREBASE_STORAGE_BUCKET:', import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '❌ Non défini');
console.log('📍 VITE_FIREBASE_MESSAGING_SENDER_ID:', import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '❌ Non défini');
console.log('📍 VITE_FIREBASE_APP_ID:', import.meta.env.VITE_FIREBASE_APP_ID ? '✅ Défini' : '❌ Non défini');
console.log('📍 Toutes les variables .env:', Object.keys(import.meta.env).filter(k => k.startsWith('VITE_FIREBASE')));
console.groupEnd();

// Configuration Firebase avec valeurs par défaut pour le projet jsaas-dd2f7
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCW55pfTJwuRosEx9Sxs-LELEWv1RiS3iI',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'jsaas-dd2f7.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'jsaas-dd2f7',
  // Si VITE_FIREBASE_STORAGE_BUCKET n'est pas défini, Firebase SDK utilisera le bucket par défaut
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1028151005055',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1028151005055:web:66a22fecbffcea812c944a'
};

console.log('[Firebase Config] 📋 Configuration finale:', {
  apiKey: firebaseConfig.apiKey ? '✅ Défini' : '❌',
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket || '❌ Non défini (utilisera bucket par défaut)',
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId ? '✅ Défini' : '❌'
});

// Initialiser Firebase avec gestion d'erreur
let app: any = null;
try {
  app = initializeApp(firebaseConfig);
  console.log('Firebase app initialisé avec succès');
  console.log('[Firebase Config] ✅ Module firebase/storage déjà importé (side-effect)');
  
  // Vérifier immédiatement les services enregistrés (Firebase v9+ utilise container.providers)
  try {
    const appInternal = app as any;
    if (appInternal.container && appInternal.container.providers) {
      const providers = appInternal.container.providers;
      const providerNames = Array.from(providers.keys());
      console.log('[Firebase Config] 📍 Services enregistrés après init:', providerNames);
      const hasStorage = providerNames.some(name => 
        name.includes('storage') || 
        name.includes('Storage') || 
        name === 'storage' ||
        name === 'storage-compat'
      );
      console.log('[Firebase Config] 📍 Service Storage présent:', hasStorage ? '✅ OUI' : '❌ NON');
      
      if (!hasStorage) {
        console.warn('[Firebase Config] ⚠️ Le service Storage n\'est pas enregistré - le module doit s\'enregistrer automatiquement');
      }
    } else {
      console.warn('[Firebase Config] ⚠️ container.providers non disponible');
    }
  } catch (e) {
    console.warn('[Firebase Config] ⚠️ Erreur lors de la vérification des services:', e);
  }
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

  console.group('🔍 DIAGNOSTIC FIREBASE STORAGE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 INITIALISATION FIREBASE STORAGE - DÉBUT (ASYNCHRONE)');
  console.log('═══════════════════════════════════════════════════════════');
  
  // Diagnostic 1: Vérifier les imports
  console.group('📦 DIAGNOSTIC 1: Vérification des imports');
  console.log('✅ getStorage importé:', typeof getStorage === 'function' ? 'OUI' : 'NON');
  console.log('✅ ref importé:', typeof ref === 'function' ? 'OUI' : 'NON');
  console.log('📍 Module firebase/storage disponible:', typeof getStorage !== 'undefined');
  
  // Vérifier la structure de getStorage
  if (typeof getStorage === 'function') {
    console.log('📍 getStorage est une fonction');
    console.log('📍 Nom de la fonction:', getStorage.name);
    console.log('📍 Longueur des paramètres:', getStorage.length);
    // Essayer d'inspecter la fonction
    try {
      const storageModule = (getStorage as any);
      console.log('📍 Propriétés de getStorage:', Object.keys(storageModule).slice(0, 10));
    } catch (e) {
      // Ignorer
    }
  } else {
    console.error('❌ getStorage n\'est PAS une fonction! Type:', typeof getStorage);
    console.error('❌ Valeur de getStorage:', getStorage);
  }
  console.groupEnd();
  
  // Diagnostic 2: Vérifier l'app Firebase
  console.group('📱 DIAGNOSTIC 2: État de l\'app Firebase');
  console.log('📍 App disponible:', !!app);
  console.log('📍 Type de app:', typeof app);
  console.log('📍 Nom de l\'app:', app?.name || 'N/A');
  console.log('📍 Options de l\'app:', app?.options || 'N/A');
  console.log('📍 Project ID:', app?.options?.projectId || firebaseConfig.projectId);
  console.log('📍 Storage Bucket config:', app?.options?.storageBucket || firebaseConfig.storageBucket || 'undefined');
  
  // Vérifier les services enregistrés dans l'app (Firebase v9+ utilise container.providers)
  try {
    const appInternal = app as any;
    console.log('📍 Services enregistrés dans l\'app:');
    
    // Firebase v9+ utilise app.container.providers (Map)
    if (appInternal.container && appInternal.container.providers) {
      const providers = appInternal.container.providers;
      const providerNames = Array.from(providers.keys());
      console.log('  - Services dans container.providers:', providerNames);
      console.log('  - Nombre de services:', providerNames.length);
      
      if (providerNames.length > 0) {
        providerNames.forEach(name => {
          const provider = providers.get(name);
          console.log(`    • ${name}:`, {
            isComponentSet: provider?.isComponentSet?.() || false,
            type: typeof provider
          });
        });
      }
      
      // Vérifier spécifiquement le service Storage
      const storageProvider = providerNames.find(name => 
        name.includes('storage') || 
        name.includes('Storage') || 
        name === 'storage' ||
        name === 'storage-compat'
      );
      
      if (storageProvider) {
        console.log('  - ✅ Service Storage trouvé:', storageProvider);
      } else {
        console.log('  - ❌ Service Storage NON trouvé dans container.providers');
        console.log('  - 💡 Le service Storage doit s\'enregistrer automatiquement lors de l\'import');
      }
    } else {
      console.log('  - ❌ container.providers non disponible');
      console.log('  - container existe:', !!appInternal.container);
      if (appInternal.container) {
        console.log('  - Propriétés du container:', Object.keys(appInternal.container));
      }
    }
    
    // Vérifier aussi _services pour compatibilité (anciennes versions)
    if (appInternal._services) {
      console.log('  - _services (ancien format):', Object.keys(appInternal._services));
    }
    
    // Vérifier d'autres propriétés internes
    console.log('  - Propriétés de l\'app:', Object.keys(appInternal).filter(k => k.startsWith('_') || k === 'container'));
  } catch (e) {
    console.log('  - ❌ Erreur lors de l\'accès aux services internes:', e);
  }
  console.groupEnd();
  
  // Diagnostic 3: Configuration
  console.group('⚙️ DIAGNOSTIC 3: Configuration');
  console.log('📍 Bucket configuré dans .env:', firebaseConfig.storageBucket || 'undefined');
  console.log('📍 Project ID:', firebaseConfig.projectId);
  console.log('📍 API Key définie:', !!firebaseConfig.apiKey);
  console.log('📍 App ID:', firebaseConfig.appId);
  console.groupEnd();
  
  // Attendre un peu pour que Firebase SDK détecte Storage
  console.log('⏳ Attente de 500ms pour la détection Storage par Firebase SDK...');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Méthode 1: getStorage() sans paramètres (PRIORITÉ - utilise le bucket par défaut)
  console.group('🔧 TENTATIVE 1: getStorage() sans paramètres');
  try {
    console.log('📍 App passée à getStorage:', !!app);
    console.log('📍 Type de app:', typeof app);
    console.log('📍 storageBucket configuré:', firebaseConfig.storageBucket || 'undefined (utilisera le bucket par défaut)');
    
    // Vérifier juste avant l'appel
    console.log('📍 Vérification pré-appel:');
    console.log('  - getStorage est une fonction:', typeof getStorage === 'function');
    console.log('  - app est un objet:', typeof app === 'object');
    console.log('  - app n\'est pas null:', app !== null);
    
    // Appel de getStorage avec logging détaillé
    console.log('📍 Appel de getStorage(app)...');
    const startTime = performance.now();
    storage = getStorage(app);
    const endTime = performance.now();
    console.log(`✅ getStorage() exécuté en ${(endTime - startTime).toFixed(2)}ms`);
    console.log('✅ Storage instance créée:', !!storage);
    console.log('✅ Type de storage:', typeof storage);
    console.log('✅ Firebase Storage initialisé (bucket par défaut - détection automatique)');
    console.log('📍 Firebase SDK a détecté le bucket par défaut du projet');
    console.groupEnd();
    return storage;
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.error('❌ Méthode 1 (bucket par défaut) échouée:', errorMsg);
    console.error('❌ Erreur complète:', error);
    console.error('❌ Code d\'erreur:', error?.code);
    console.error('❌ Nom de l\'erreur:', error?.name);
    console.error('❌ Stack:', error?.stack);
    
    // Diagnostic approfondi de l'erreur
    console.group('🔬 DIAGNOSTIC ERREUR DÉTAILLÉ');
    if (error?.code) {
      console.log('📍 Code d\'erreur:', error.code);
    }
    if (error?.message) {
      console.log('📍 Message:', error.message);
      if (error.message.includes('not available')) {
        console.log('⚠️ Le service Storage n\'est pas disponible dans le SDK');
        console.log('💡 Cela peut indiquer:');
        console.log('   1. Le module firebase/storage n\'est pas correctement bundlé');
        console.log('   2. Le service Storage n\'est pas enregistré dans l\'app Firebase');
        console.log('   3. Un problème de timing - le service n\'est pas encore prêt');
      }
    }
    console.groupEnd();
    console.groupEnd();
    
    // Méthode 1a: getStorage() avec le bucket spécifique depuis .env (si défini)
    try {
      if (firebaseConfig.storageBucket) {
        // Utiliser le format gs:// explicitement
        const gsBucket = firebaseConfig.storageBucket.startsWith('gs://') 
          ? firebaseConfig.storageBucket 
          : `gs://${firebaseConfig.storageBucket}`;
        console.log('🔍 Tentative Méthode 1a avec bucket spécifique (format gs://):', gsBucket);
        storage = getStorage(app, gsBucket);
        console.log('✅ Firebase Storage initialisé (bucket spécifique gs://:', gsBucket + ')');
        return storage;
      }
    } catch (error1a: any) {
      const errorMsg1a = error1a?.message || String(error1a);
      console.error('❌ Méthode 1a (sans gs://) échouée:', errorMsg1a);
      
      // Méthode 1b: getStorage() sans paramètres (détection automatique - fallback)
      try {
        console.log('🔍 Tentative Méthode 1b (détection automatique)');
        storage = getStorage(app);
        console.log('✅ Firebase Storage initialisé (méthode par défaut - détection automatique)');
        console.log('📍 Bucket détecté automatiquement par Firebase (peut être EUROPE-WEST3)');
      } catch (fallbackError: any) {
        const fallbackErrorMsg = fallbackError?.message || String(fallbackError);
        console.error('❌ Méthode 1b (détection automatique) échouée:', fallbackErrorMsg);
        console.error('❌ Erreur complète:', fallbackError);
        
        // Méthode 2: getStorage() avec bucket explicite (sans gs://)
        try {
          if (firebaseConfig.storageBucket) {
            // Enlever le préfixe gs:// si présent
            const bucketName = firebaseConfig.storageBucket.replace(/^gs:\/\//, '');
            storage = getStorage(app, bucketName);
            console.log('✅ Firebase Storage initialisé (avec bucket explicite:', bucketName + ')');
          }
        } catch (secondError: any) {
          console.warn('⚠️ Méthode 2 échouée:', secondError?.message);
          
          // Méthode 3: getStorage() avec format gs://
          try {
            const gsBucket = firebaseConfig.storageBucket.startsWith('gs://') 
              ? firebaseConfig.storageBucket 
              : `gs://${firebaseConfig.storageBucket}`;
            storage = getStorage(app, gsBucket);
            console.log('✅ Firebase Storage initialisé (format gs://:', gsBucket + ')');
          } catch (thirdError: any) {
            console.warn('⚠️ Méthode 3 échouée:', thirdError?.message);
            
            // Méthode 4: Essayer avec le bucket sans le suffixe .firebasestorage.app
            try {
              const bucketWithoutSuffix = firebaseConfig.storageBucket.replace(/\.firebasestorage\.app$/, '');
              storage = getStorage(app, bucketWithoutSuffix);
              console.log('✅ Firebase Storage initialisé (sans suffixe:', bucketWithoutSuffix + ')');
            } catch (fourthError: any) {
              console.warn('⚠️ Méthode 4 échouée:', fourthError?.message);
              
              // Méthode 5: Essayer avec le format complet firebasestorage.app
              try {
                const fullBucketName = `${firebaseConfig.storageBucket}.firebasestorage.app`;
                storage = getStorage(app, fullBucketName);
                console.log('✅ Firebase Storage initialisé (format complet:', fullBucketName + ')');
              } catch (fifthError: any) {
                console.warn('⚠️ Méthode 5 échouée:', fifthError?.message);
                
                // Méthode 6: Essayer avec le project ID comme bucket
                try {
                  const projectBucket = `${firebaseConfig.projectId}.appspot.com`;
                  storage = getStorage(app, projectBucket);
                  console.log('✅ Firebase Storage initialisé (bucket par défaut:', projectBucket + ')');
                } catch (sixthError: any) {
                  console.error('❌ Toutes les méthodes d\'initialisation Storage ont échoué');
                  console.error('💡 Cela peut être dû à:');
                  console.error('   1. Le bucket n\'est pas correctement lié à Firebase dans Firebase Console');
                  console.error('   2. Les APIs Storage ne sont pas activées dans Google Cloud Console');
                  console.error('   3. Le nom du bucket dans .env ne correspond pas au bucket créé');
                  console.error('   4. Le bucket doit être lié à Firebase dans Firebase Console → Storage');
                  console.error('');
                  console.error('📋 Vérifications à faire:');
                  console.error('   1. Allez dans Firebase Console → Storage');
                  console.error('   2. Vérifiez que le bucket "jsaas-dd2f7.firebasestorage.app" apparaît dans la liste');
                  console.error('   3. Si le bucket n\'apparaît pas, il faut le lier à Firebase');
                  console.error('   4. Le nom exact du bucket devrait être visible dans Firebase Console');
                  console.error('💡 Storage sera null, mais peut être initialisé plus tard si nécessaire');
                  storage = null;
                }
              }
            }
          }
        }
      }
    }
  }
  
  // Diagnostic final
  console.group('📊 DIAGNOSTIC FINAL');
  console.log('═══════════════════════════════════════════════════════════');
  if (storage) {
    console.log('✅ FIREBASE STORAGE INITIALISÉ AVEC SUCCÈS');
    console.log('✅ Firebase Storage prêt à l\'emploi');
    console.log('📍 Storage instance:', storage);
    console.log('📍 Type:', typeof storage);
    
    // Tester si on peut créer une référence
    try {
      const testRef = ref(storage, '__test__');
      console.log('✅ Test de référence réussi:', !!testRef);
    } catch (testError) {
      console.warn('⚠️ Test de référence échoué:', testError);
    }
  } else {
    console.error('❌ FIREBASE STORAGE NON INITIALISÉ - TOUTES LES MÉTHODES ONT ÉCHOUÉ');
    console.warn('⚠️ Firebase Storage non initialisé - certaines fonctionnalités seront désactivées');
    
    // Diagnostic approfondi du problème
    console.group('🔬 ANALYSE DU PROBLÈME');
    console.log('💡 L\'erreur "Service storage is not available" signifie que Firebase SDK ne peut pas détecter Storage');
    console.log('');
    console.log('🔍 Causes possibles:');
    console.log('   1. ❌ Le module firebase/storage n\'est pas correctement bundlé par Vite');
    console.log('   2. ❌ Le service Storage n\'est pas enregistré dans l\'app Firebase');
    console.log('   3. ❌ Un problème de timing - le service n\'est pas encore prêt');
    console.log('   4. ❌ Le bucket Storage n\'est pas activé dans Firebase Console');
    console.log('   5. ❌ Les APIs Storage ne sont pas activées dans Google Cloud Console');
    console.log('');
    console.log('🔧 Solutions à essayer:');
    console.log('   1. Vérifier que firebase/storage est dans vite.config.ts optimizeDeps.include');
    console.log('   2. Nettoyer le cache Vite: rm -rf node_modules/.vite');
    console.log('   3. Redémarrer le serveur de développement');
    console.log('   4. Vérifier dans Firebase Console que Storage est activé');
    console.log('   5. Vérifier dans Google Cloud Console que l\'API Storage est activée');
    console.groupEnd();
  }
  console.log('═══════════════════════════════════════════════════════════');
  console.groupEnd();
  console.groupEnd(); // Fermer le groupe principal
  
  return storage;
};

// Initialiser Storage de manière synchrone au chargement (pour compatibilité)
// Mais aussi lancer l'initialisation asynchrone en arrière-plan
if (app) {
  // Lancer l'initialisation asynchrone immédiatement
  storageInitializationPromise = initializeStorageAsync();
  storageInitializationPromise.then((result) => {
    if (result) {
      storage = result;
      console.log('✅ Storage initialisé de manière asynchrone');
    }
  }).catch((error) => {
    console.error('❌ Erreur lors de l\'initialisation asynchrone:', error);
  });
} else {
  console.error('❌ App Firebase non disponible - Storage non initialisé');
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