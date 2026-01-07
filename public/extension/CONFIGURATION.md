# Configuration de l'extension JS Connect LinkedIn

## Configuration de la clé API Gemini

Pour utiliser l'extraction IA avec Gemini, vous devez configurer votre clé API :

### 1. Obtenir une clé API Gemini

1. Allez sur [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Connectez-vous avec votre compte Google
3. Cliquez sur "Create API Key"
4. Copiez la clé générée

### 2. Configurer la clé dans l'extension

#### Méthode 1 : Via la console Chrome (recommandée)

1. Ouvrez l'extension dans Chrome (`chrome://extensions/`)
2. Cliquez sur "Inspecter les vues: service worker" pour ouvrir la console
3. Dans la console, exécutez :

```javascript
chrome.storage.local.set({ geminiApiKey: 'VOTRE_CLE_API_ICI' }, () => {
  console.log('Clé API configurée avec succès');
});
```

#### Méthode 2 : Via le popup (à implémenter)

Une interface de configuration sera ajoutée dans une prochaine version.

### 3. Vérifier la configuration

Dans la console du service worker, exécutez :

```javascript
chrome.storage.local.get(['geminiApiKey'], (result) => {
  console.log('Clé API configurée:', result.geminiApiKey ? 'Oui' : 'Non');
});
```

## Architecture de l'extension

### Flux d'extraction

1. **Extraction DOM** (rapide, gratuit)
   - Essaie d'extraire les données depuis le DOM
   - Si réussi et complet → retourne les données
   - Si échec ou incomplet → passe à l'IA

2. **Extraction IA** (précise, payante ~0,00033$ par profil)
   - Capture un screenshot de la page
   - Envoie à Gemini Vision API
   - Extrait les données structurées
   - Sauvegarde dans le cache

3. **Cache** (7 jours)
   - Évite les re-traitements
   - Réduit les coûts
   - Améliore les performances

### Coûts estimés

- **Extraction DOM** : Gratuit
- **Extraction IA** : ~0,00033$ par profil (Gemini 2.0 Flash)
- **Avec cache** : Coût réduit de 50-70% si profils revisités

### Volume mensuel estimé

- 100 profils : ~0,03$ / mois
- 1 000 profils : ~0,33$ / mois
- 10 000 profils : ~3,30$ / mois

## Dépannage

### L'extension ne fonctionne pas

1. Vérifiez que vous êtes sur une page de profil LinkedIn (`linkedin.com/in/...`)
2. Vérifiez que la clé API Gemini est configurée
3. Ouvrez la console du service worker pour voir les erreurs

### L'extraction IA échoue

1. Vérifiez votre quota Gemini API
2. Vérifiez que la clé API est valide
3. Vérifiez votre connexion internet

### Les données sont incomplètes

1. L'extraction DOM peut échouer sur certains profils
2. L'extraction IA devrait être plus fiable (95%+)
3. Si les deux échouent, des données minimales sont créées depuis l'URL

## Support

Pour toute question ou problème, contactez le support JS Connect.


