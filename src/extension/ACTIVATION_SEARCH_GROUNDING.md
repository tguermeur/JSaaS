# Comment activer Google Search Grounding pour Gemini

## 🔍 Qu'est-ce que Google Search Grounding ?

Google Search Grounding permet à Gemini de rechercher des informations sur internet en temps réel. C'est nécessaire pour trouver les informations d'entreprise (SIRET, raison sociale, siège social).

## ✅ Activation automatique

L'extension utilise maintenant **Gemini 1.5 Pro** qui supporte nativement Google Search Grounding. La fonctionnalité est activée automatiquement via le paramètre `tools: [{ googleSearch: {} }]` dans la requête API.

## 🔑 Vérifier que votre clé API a accès

### Méthode 1 : Vérification dans Google AI Studio

1. Allez sur [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Connectez-vous avec votre compte Google
3. Vérifiez que votre clé API est active
4. **Important** : Google Search Grounding est disponible pour toutes les clés API Gemini, mais peut nécessiter :
   - Un compte Google Cloud actif
   - L'API activée dans votre projet Google Cloud

### Méthode 2 : Activer dans Google Cloud Console

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez votre projet (ou créez-en un)
3. Allez dans **APIs & Services** > **Library**
4. Recherchez "Generative Language API"
5. Cliquez sur **Enable** si ce n'est pas déjà fait
6. Vérifiez que l'API est activée

### Méthode 3 : Tester la recherche web

Si la recherche web ne fonctionne pas, vous verrez une erreur dans la console. Dans ce cas :

1. Vérifiez que vous utilisez bien **gemini-1.5-pro** (déjà configuré dans l'extension)
2. Vérifiez que votre clé API est valide
3. Vérifiez votre quota API dans Google Cloud Console

## 💡 Alternative : API de recherche dédiée

Si Google Search Grounding ne fonctionne pas, on peut utiliser une API de recherche dédiée :

### Option 1 : Brave Search API
- Coût : 5$ / 1000 requêtes
- Documentation : https://brave.com/search/api/

### Option 2 : Google Custom Search API
- Coût : 5$ / 1000 requêtes
- Nécessite de créer un moteur de recherche personnalisé

### Option 3 : Scraping direct (gratuit mais complexe)
- Scraper directement sirene.fr ou societe.com
- Plus complexe à maintenir

## 🧪 Tester la recherche web

Pour tester si la recherche web fonctionne :

1. Ouvrez la console du service worker de l'extension
2. Testez l'ajout d'un prospect avec une entreprise connue
3. Vérifiez dans les logs si `companyData` est rempli
4. Si `companyData` est vide, la recherche web ne fonctionne pas

## 📝 Note importante

Google Search Grounding peut avoir des limitations :
- Quota de recherche par jour
- Coût supplémentaire (généralement inclus dans le quota standard)
- Disponibilité selon la région

Si vous rencontrez des problèmes, contactez le support Google Cloud ou utilisez une alternative API de recherche.


