# Guide de configuration de l'extension Chrome

## Vue d'ensemble

L'extension Chrome JS Connect a été modifiée pour ne plus contenir de clés API en dur. La configuration Firebase est **automatiquement injectée au moment du build** depuis les variables d'environnement. **Aucune action n'est requise de la part de l'utilisateur final.**

## Configuration automatique au build

### Pour les développeurs

**Prérequis:** Variables d'environnement définies dans `.env`

**Étapes:**
1. Créer ou modifier le fichier `.env` à la racine du projet:
   ```env
   VITE_FIREBASE_API_KEY=votre_api_key
   VITE_FIREBASE_AUTH_DOMAIN=jsaas-dd2f7.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=jsaas-dd2f7
   VITE_FIREBASE_STORAGE_BUCKET=jsaas-dd2f7.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=1028151005055
   VITE_FIREBASE_APP_ID=votre_app_id
   ```

2. Reconstruire l'extension:
   ```bash
   node scripts/build-extension.js
   ```

3. La configuration sera **automatiquement injectée** dans `popup.js` au moment du build en remplaçant les placeholders `__FIREBASE_*__` par les valeurs réelles.

**Important:** Si une variable d'environnement manque, le script de build échouera avec un message d'erreur clair indiquant quelles variables sont manquantes.

### Pour les utilisateurs finaux

**Aucune action requise !** L'extension est pré-configurée avec les bonnes valeurs au moment du build. L'utilisateur n'a qu'à :
1. Charger l'extension dans Chrome
2. L'utiliser normalement

## Vérification

Pour vérifier que la configuration a été correctement injectée:

1. Ouvrir la popup de l'extension (clic sur l'icône)
2. Ouvrir la console (clic droit → Inspecter → Console)
3. Vérifier le message "Firebase initialisé avec succès"
4. S'il y a une erreur, elle indiquera clairement le problème

## Dépannage

### Erreur à la compilation: "Certaines variables Firebase ne sont pas définies"

**Cause:** Une ou plusieurs variables d'environnement manquent dans le fichier `.env`.

**Solution:**
1. Vérifier que le fichier `.env` existe à la racine du projet
2. Vérifier que toutes les variables `VITE_FIREBASE_*` sont définies
3. Reconstruire l'extension

### Erreur: "Configuration Firebase non injectée. Veuillez reconstruire l'extension"

**Cause:** L'extension n'a pas été construite avec le script de build, ou les placeholders n'ont pas été remplacés.

**Solution:**
1. Reconstruire l'extension avec `node scripts/build-extension.js`
2. Vérifier que les variables d'environnement sont définies

### Erreur: "Firebase n'est pas initialisé"

**Cause:** Firebase n'a pas pu s'initialiser avec la configuration fournie.

**Solution:**
1. Vérifier que toutes les valeurs de configuration dans `.env` sont correctes
2. Vérifier que les permissions de l'extension sont correctes
3. Recharger l'extension

## Sécurité

✅ **Avantages de cette approche:**
- Les clés ne sont jamais en dur dans le code source
- L'utilisateur final n'a pas besoin de configurer quoi que ce soit
- La configuration est injectée uniquement au build time
- Le fichier source (`src/extension/popup.js`) contient uniquement des placeholders

⚠️ **Important:** 
- Ne jamais commiter le fichier `.env` dans le repository
- Utiliser des secrets/variables d'environnement dans les CI/CD
- Le fichier `dist/extension/popup.js` contiendra les clés (c'est normal, c'est le fichier de distribution)

## Notes pour les développeurs

- Le script de build (`scripts/build-extension.js`) remplace automatiquement les placeholders `__FIREBASE_*__` par les valeurs d'environnement
- Si une variable manque, le build échouera avec un message d'erreur clair
- Le fichier source utilise des placeholders pour éviter les clés en dur dans le code source
