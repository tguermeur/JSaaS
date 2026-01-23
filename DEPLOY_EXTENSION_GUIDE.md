# 📦 Guide de déploiement de l'extension JSConnect

## ✅ Configuration actuelle

L'extension est maintenant correctement configurée avec :
- ✅ Configuration Firebase injectée au build time (pas de placeholders)
- ✅ CORS configuré pour autoriser les extensions Chrome
- ✅ Secrets Firebase Functions correctement configurés
- ✅ ZIP généré automatiquement dans `public/extension/extension.zip`

## 🚀 Processus de build

### Pour les développeurs

1. **Générer l'extension avec configuration Firebase injectée** :
   ```bash
   npm run build:extension
   ```

2. **Générer uniquement le ZIP** (utilise les fichiers déjà générés) :
   ```bash
   npm run build:extension-zip
   ```

3. **Les deux étapes ensemble** (recommandé avant déploiement) :
   ```bash
   npm run build:extension-zip
   ```

### Automatique lors du build du site

Le script `prebuild` s'exécute automatiquement avant `npm run build` et :
1. Exécute `build-extension.js` (injecte la configuration Firebase)
2. Exécute `build-extension-zip.js` (crée le ZIP)

## 📁 Fichiers générés

- **`dist/extension/`** : Dossier avec tous les fichiers (pour chargement non empaqueté)
- **`public/extension/`** : Dossier avec tous les fichiers + `extension.zip`
- **`public/extension/extension.zip`** : Archive téléchargeable sur le site

## 🌐 Téléchargement sur le site

Le ZIP est accessible via :
- **URL** : `/extension/extension.zip`
- **Fonction** : `downloadExtension()` dans `src/api/extension.ts`
- **Page** : Bouton "Extension JSConnect" dans `src/pages/Commercial.tsx`

## ✅ Vérification

Après génération, vérifiez que :
```bash
# Vérifier que le ZIP contient la bonne configuration
unzip -p public/extension/extension.zip popup.js | grep -c "__FIREBASE"
# Doit retourner : 0 (aucun placeholder)

# Vérifier la taille
ls -lh public/extension/extension.zip
# Doit être ~385KB
```

## 🔄 Déploiement

1. **Rebuild l'extension** (si modifications) :
   ```bash
   npm run build:extension-zip
   ```

2. **Build et déploiement du site** :
   ```bash
   npm run build
   npm run deploy:hosting
   ```

Le ZIP dans `public/extension/extension.zip` sera automatiquement déployé et accessible sur le site.

## 📝 Notes importantes

- ⚠️ **Ne JAMAIS copier depuis `src/extension/`** : Ce dossier contient les placeholders
- ✅ **Toujours utiliser `build-extension.js`** : Il injecte la configuration Firebase
- ✅ **Le ZIP est régénéré automatiquement** lors du `prebuild`
- 🔒 **La configuration Firebase est injectée au build time** : Pas de secrets dans le code source
