# Guide de Résolution : Erreur "Service storage is not available"

Ce guide explique comment résoudre l'erreur **"Service storage is not available"** qui empêche l'initialisation de Firebase Storage dans une application Vite + React + Firebase.

## 🔍 Symptômes

L'application affiche l'erreur suivante dans la console :
```
Error: Service storage is not available
```

Malgré que :
- ✅ Le bucket Storage est bien configuré dans Firebase Console
- ✅ Les variables d'environnement sont correctement définies
- ✅ Le module `firebase/storage` est importé
- ✅ La fonction `getStorage` est disponible

## 🎯 Causes Principales

### 1. Conflit de versions de `@firebase/app`
Le problème le plus courant est la présence de **plusieurs versions** de `@firebase/app` dans le projet, ce qui empêche l'enregistrement correct des services Firebase.

### 2. Problème de bundling Vite
Vite peut ne pas pré-bundler correctement le module `firebase/storage`, empêchant l'exécution du code d'enregistrement automatique du service.

### 3. Service non enregistré dans l'app Firebase
Dans Firebase v9+, les services doivent s'enregistrer automatiquement dans `app.container.providers`, mais cela peut échouer si le code d'enregistrement n'est pas exécuté.

## ✅ Solutions Appliquées

### Solution 1 : Résolution des conflits de versions

Ajoutez dans votre `package.json` :

```json
{
  "overrides": {
    "@firebase/app": "^0.14.1"
  },
  "resolutions": {
    "@firebase/app": "^0.14.1"
  }
}
```

Puis réinstallez les dépendances :
```bash
npm install
```

**Vérification :**
```bash
npm ls @firebase/app
```
Toutes les versions doivent être unifiées (toutes utiliser la même version).

### Solution 2 : Configuration Vite optimisée

Dans `vite.config.ts`, ajoutez les modules Firebase dans `optimizeDeps.include` :

```typescript
export default defineConfig({
  // ... autres configurations
  optimizeDeps: {
    include: [
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/storage',
      'firebase/functions',
      '@firebase/storage',
      '@firebase/app'
    ],
    esbuildOptions: {
      preserveSymlinks: false
    }
  }
});
```

### Solution 3 : Import side-effect du module Storage

Dans `src/firebase/config.ts`, importez le module Storage de manière à forcer l'enregistrement :

```typescript
// IMPORT CRITIQUE: Importer le module Storage de manière à forcer l'enregistrement du service
import "firebase/storage";
import { getStorage, ref } from "firebase/storage";
```

L'import side-effect (`import "firebase/storage"`) garantit que le code d'enregistrement du service s'exécute.

### Solution 4 : Vérification des services enregistrés

Dans Firebase v9+, les services sont stockés dans `app.container.providers` (une Map), pas dans `_services`.

Pour vérifier si le service Storage est enregistré :

```typescript
const appInternal = app as any;
if (appInternal.container && appInternal.container.providers) {
  const providers = appInternal.container.providers;
  const providerNames = Array.from(providers.keys());
  console.log('Services enregistrés:', providerNames);
  
  const hasStorage = providerNames.some(name => 
    name.includes('storage') || 
    name === 'storage' ||
    name === 'storage-compat'
  );
  
  if (hasStorage) {
    console.log('✅ Service Storage enregistré');
  } else {
    console.log('❌ Service Storage NON enregistré');
  }
}
```

## 📋 Checklist de Résolution

Suivez ces étapes dans l'ordre :

### Étape 1 : Vérifier les versions Firebase
```bash
npm ls @firebase/app
npm ls firebase
```

Si plusieurs versions sont présentes, ajoutez les `overrides` et `resolutions` dans `package.json`.

### Étape 2 : Nettoyer et réinstaller
```bash
rm -rf node_modules/.vite
npm install
```

### Étape 3 : Vérifier la configuration Vite
Assurez-vous que `vite.config.ts` inclut tous les modules Firebase dans `optimizeDeps.include`.

### Étape 4 : Vérifier les imports
Dans `src/firebase/config.ts`, assurez-vous d'avoir :
```typescript
import "firebase/storage";  // Import side-effect
import { getStorage, ref } from "firebase/storage";
```

### Étape 5 : Redémarrer le serveur
```bash
npm run dev
```

### Étape 6 : Vérifier dans la console
Ouvrez la console du navigateur et vérifiez :
- ✅ Les services enregistrés dans `container.providers`
- ✅ Le service Storage présent dans la liste
- ✅ Aucune erreur "Service storage is not available"

## 🔧 Diagnostic Avancé

Si le problème persiste, activez les logs de diagnostic dans `src/firebase/config.ts` :

```typescript
// Vérifier les services enregistrés
const appInternal = app as any;
if (appInternal.container && appInternal.container.providers) {
  const providers = appInternal.container.providers;
  const providerNames = Array.from(providers.keys());
  console.log('📍 Services enregistrés:', providerNames);
  
  providerNames.forEach(name => {
    const provider = providers.get(name);
    console.log(`  • ${name}:`, {
      isComponentSet: provider?.isComponentSet?.() || false
    });
  });
}
```

## 📝 Variables d'Environnement Requises

Assurez-vous que votre fichier `.env` contient :

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

**Important :** Toutes les variables doivent être préfixées par `VITE_` pour être accessibles dans le code client.

## 🎯 Résultat Attendu

Après avoir appliqué toutes les solutions, vous devriez voir dans la console :

```
✅ Firebase app initialisé avec succès
📍 Services enregistrés: ['auth', 'firestore', 'storage', ...]
📍 Service Storage présent: ✅ OUI
✅ Firebase Storage initialisé (bucket par défaut - détection automatique)
```

## 🚨 Si le Problème Persiste

1. **Vérifiez que le bucket Storage est activé dans Firebase Console**
   - Allez dans Firebase Console → Storage
   - Vérifiez que le bucket apparaît dans la liste

2. **Vérifiez que les APIs Storage sont activées dans Google Cloud Console**
   - Allez dans Google Cloud Console → APIs & Services
   - Vérifiez que "Cloud Storage API" est activée

3. **Vérifiez les règles de sécurité Storage**
   - Assurez-vous que les règles permettent l'accès pour le développement

4. **Nettoyez complètement le cache**
   ```bash
   rm -rf node_modules/.vite
   rm -rf node_modules
   npm install
   ```

## 📚 Références

- [Firebase Storage Documentation](https://firebase.google.com/docs/storage)
- [Vite Dependency Pre-bundling](https://vitejs.dev/guide/dep-pre-bundling.html)
- [Firebase v9 Modular SDK](https://firebase.google.com/docs/web/modular-upgrade)

## ✨ Résumé

Le problème "Service storage is not available" est généralement causé par :
1. **Conflits de versions** de `@firebase/app` → Résolu avec `overrides` et `resolutions`
2. **Bundling Vite incorrect** → Résolu avec `optimizeDeps.include`
3. **Service non enregistré** → Résolu avec l'import side-effect `import "firebase/storage"`

En suivant ce guide, le problème devrait être résolu. Si ce n'est pas le cas, vérifiez les logs de diagnostic pour identifier la cause exacte.






