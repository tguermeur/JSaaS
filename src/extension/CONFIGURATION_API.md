# Configuration de la clé API Gemini

## 📍 OÙ METTRE VOTRE CLÉ API

### Méthode 1 : Via l'interface de l'extension (RECOMMANDÉE)

1. **Ouvrez l'extension** en cliquant sur l'icône dans Chrome
2. **Connectez-vous** avec vos identifiants JS Connect
3. **Dans le champ "Clé API Gemini"**, entrez votre clé
4. **Cliquez sur "Sauvegarder"**
5. ✅ C'est fait ! La clé est maintenant configurée

### Méthode 2 : Via la console Chrome (alternative)

Si vous préférez utiliser la console :

1. Allez sur `chrome://extensions/`
2. Trouvez l'extension "JS Connect LinkedIn Extension"
3. Cliquez sur **"Inspecter les vues: service worker"**
4. Dans la console qui s'ouvre, tapez :

```javascript
chrome.storage.local.set({ geminiApiKey: 'VOTRE_CLE_API_ICI' }, () => {
  console.log('✓ Clé API configurée');
});
```

5. Remplacez `VOTRE_CLE_API_ICI` par votre vraie clé API
6. Appuyez sur Entrée

## 🔑 OBTENIR UNE CLÉ API GEMINI

1. Allez sur [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Connectez-vous avec votre compte Google
3. Cliquez sur **"Create API Key"**
4. Copiez la clé générée
5. Collez-la dans l'extension (voir ci-dessus)

## ✅ VÉRIFIER QUE LA CLÉ EST CONFIGURÉE

Dans l'interface de l'extension, vous verrez :
- **✓ Clé API configurée** (vert) = Tout est bon
- **⚠ Clé API non configurée** (orange) = Vous devez la configurer

## 💰 COÛT

- **~0,00033$ par profil** (0,033 centimes)
- **100 profils** = ~0,03$ / mois
- **1 000 profils** = ~0,33$ / mois
- **10 000 profils** = ~3,30$ / mois

Le cache réduit les coûts de 50-70% si vous revisitez des profils.

## 🆘 DÉPANNAGE

### "Clé API Gemini non configurée"
→ Configurez la clé via l'interface de l'extension (voir Méthode 1)

### "Erreur API Gemini: 403"
→ Votre clé API n'est pas valide ou a expiré. Générez-en une nouvelle.

### "Erreur API Gemini: 429"
→ Vous avez dépassé votre quota. Attendez un peu ou vérifiez votre quota sur Google AI Studio.


