# 🔄 Guide de rechargement de l'extension JSConnect

## Problème
Si vous voyez l'erreur "Configuration Firebase non injectée", c'est que Chrome utilise une ancienne version de l'extension.

## Solution : Recharger l'extension correctement

### Option 1 : Recharger depuis dist/extension/ (Recommandé)

1. **Arrêtez complètement Chrome** (fermez toutes les fenêtres)
2. **Reconstruisez l'extension** :
   ```bash
   node scripts/build-extension.js
   ```
3. **Ouvrez Chrome** et allez à `chrome://extensions/`
4. **Activez le "Mode développeur"** (en haut à droite)
5. Si l'extension "JSConnect" existe déjà :
   - Cliquez sur le **bouton de rechargement** (🔄) à côté de l'extension
   - OU **Désactivez** puis **Réactivez** l'extension
6. Si l'extension n'existe pas encore :
   - Cliquez sur **"Charger l'extension non empaquetée"**
   - Sélectionnez le dossier : `/Users/teoguermeur/JSaaS/dist/extension/`

### Option 2 : Recharger depuis public/extension/

Si vous téléchargez l'extension depuis l'interface web :

1. **Reconstruisez l'extension** :
   ```bash
   node scripts/build-extension.js
   ```
2. **Supprimez l'ancienne extension** dans Chrome (`chrome://extensions/`)
3. **Téléchargez à nouveau** l'extension depuis la page Commercial
4. **Extrayez le ZIP** dans un nouveau dossier
5. **Chargez l'extension** depuis ce dossier dans Chrome

### Option 3 : Vérifier le chemin chargé

1. Dans `chrome://extensions/`, trouvez l'extension "JSConnect"
2. Notez le **chemin** affiché sous le nom de l'extension
3. Si le chemin est `src/extension/`, c'est **INCORRECT** ❌
   - L'extension ne doit **JAMAIS** être chargée depuis `src/extension/`
   - Chargez-la depuis `dist/extension/` ou `public/extension/`

## Vérification

Après le rechargement, vérifiez que la configuration est bien injectée :

1. Ouvrez la console de l'extension (clic droit sur l'icône → "Inspecter la popup")
2. Dans la console, tapez :
   ```javascript
   firebaseConfig
   ```
3. Vous devriez voir des valeurs réelles (pas de `__FIREBASE_API_KEY__`)

## Si le problème persiste

1. **Vérifiez que le build s'est bien passé** :
   ```bash
   node scripts/build-extension.js
   ```
   Vous devriez voir :
   ```
   ✅ popup.js traité et copié vers dist/extension avec configuration Firebase injectée
   ✅ popup.js copié vers public/extension avec configuration Firebase injectée
   ```

2. **Vérifiez le fichier** :
   ```bash
   head -10 dist/extension/popup.js
   ```
   Vous devriez voir `apiKey: "AIzaSy..."` (pas `"__FIREBASE_API_KEY__"`)

3. **Videz le cache de Chrome** :
   - Allez à `chrome://extensions/`
   - Cliquez sur "Détails" pour l'extension
   - Cliquez sur "Vider le cache" si disponible

4. **Rechargez complètement** :
   - Désinstallez complètement l'extension
   - Redémarrez Chrome
   - Rechargez depuis `dist/extension/`
