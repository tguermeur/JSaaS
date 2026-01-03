# Guide de développement de l'extension JSaaS

## 🚀 Scripts disponibles

### Génération de l'extension
```bash
# Générer le fichier ZIP de l'extension
npm run build:extension-zip

# Surveillance automatique des changements
npm run watch:extension

# Build complet de l'extension (avec Vite)
npm run build:extension
```

## 📁 Structure des fichiers

```
src/extension/           # Code source de l'extension
├── manifest.json        # Configuration de l'extension
├── popup.html          # Interface utilisateur
├── popup.js            # Logique de l'interface
├── popup.css           # Styles de l'interface
├── background.js       # Script en arrière-plan
├── content.js          # Script injecté dans les pages
├── config.js           # Configuration Firebase
├── firebase/           # SDK Firebase
└── assets/             # Ressources (icônes, etc.)

public/extension/        # Fichiers compilés
├── extension.zip       # Archive prête à installer
└── README.md          # Guide d'installation
```

## 🔧 Développement

### 1. Modification des fichiers
- Modifiez les fichiers dans `src/extension/`
- Utilisez `npm run watch:extension` pour la reconstruction automatique
- Ou utilisez `npm run build:extension-zip` pour une reconstruction manuelle

### 2. Test de l'extension
1. Générez l'extension : `npm run build:extension-zip`
2. Ouvrez Chrome et allez à `chrome://extensions/`
3. Activez le mode développeur
4. Cliquez sur "Charger l'extension non empaquetée"
5. Sélectionnez le dossier `public/extension`

### 3. Débogage
- Utilisez les outils de développement de Chrome
- Console pour les erreurs JavaScript
- Onglet "Extensions" pour voir les logs de l'extension

## 📦 Déploiement

### Pour les utilisateurs finaux
1. Générez l'extension : `npm run build:extension-zip`
2. Le fichier `public/extension/extension.zip` est prêt
3. Les utilisateurs peuvent le télécharger via l'interface JSaaS

### Mise à jour
- Modifiez le code dans `src/extension/`
- Régénérez l'extension
- Les utilisateurs devront recharger l'extension dans Chrome

## 🐛 Dépannage

### L'extension ne se charge pas
- Vérifiez que `manifest.json` est valide
- Assurez-vous que tous les fichiers requis sont présents

### Erreurs de permissions
- Vérifiez les permissions dans `manifest.json`
- Assurez-vous que les domaines sont correctement configurés

### Problèmes de Firebase
- Vérifiez la configuration dans `config.js`
- Assurez-vous que les clés API sont correctes




















