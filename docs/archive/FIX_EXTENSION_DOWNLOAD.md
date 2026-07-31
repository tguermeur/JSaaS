# 🔧 Correction du téléchargement de l'extension

## Problème identifié

Le dossier `~/Téléchargements/jsconnect-extension` contient une ancienne version de l'extension avec les placeholders `__FIREBASE_API_KEY__` au lieu des vraies valeurs.

## Solutions

### Solution 1 : Charger depuis dist/extension/ (Recommandé - Plus rapide)

1. Ouvrez Chrome et allez à `chrome://extensions/`
2. Trouvez l'extension "JSConnect" et **supprimez-la** (bouton "Supprimer")
3. Cliquez sur **"Charger l'extension non empaquetée"**
4. Sélectionnez le dossier : `/Users/teoguermeur/JSaaS/dist/extension/`
5. ✅ L'extension devrait fonctionner correctement

### Solution 2 : Re-télécharger depuis l'interface web

1. **Supprimez l'ancien dossier** :
   ```bash
   rm -rf ~/Téléchargements/jsconnect-extension
   ```
2. Dans Chrome, allez à `chrome://extensions/` et **supprimez l'extension actuelle**
3. Allez sur votre site JSConnect → Page Commercial
4. Cliquez sur le bouton **"Extension JSConnect"**
5. Le nouveau ZIP sera téléchargé (avec la bonne configuration)
6. **Extrayez le ZIP** dans `~/Téléchargements/jsconnect-extension`
7. Dans Chrome, chargez l'extension depuis ce nouveau dossier

## Vérification

Après le chargement, vérifiez que la configuration est correcte :

1. Ouvrez la popup de l'extension
2. Si vous voyez encore l'erreur "Configuration Firebase non injectée", c'est que vous avez chargé l'ancienne version
3. Ouvrez la console de l'extension (clic droit sur l'icône → "Inspecter la popup")
4. Tapez dans la console :
   ```javascript
   firebaseConfig
   ```
5. Vous devriez voir des valeurs réelles, pas `__FIREBASE_API_KEY__`

## Notes

- **Le dossier `dist/extension/` est toujours à jour** car il est régénéré à chaque `node scripts/build-extension.js`
- **Le ZIP dans `public/extension/extension.zip` est maintenant à jour** (régénéré)
- **Ne chargez JAMAIS l'extension depuis `src/extension/`** - ce dossier contient les placeholders
