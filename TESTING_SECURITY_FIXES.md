# Tests de vérification des corrections de sécurité

## Date: $(date)

## Domaine de production ajouté
✅ **js-connect.fr** ajouté à la liste CORS autorisée dans `functions/src/index.ts`

## Modifications de l'extension

### Changements appliqués:
1. **popup.js** modifié pour charger la configuration Firebase depuis `chrome.storage` au lieu de valeurs en dur
2. Script de build (`scripts/build-extension.js`) modifié pour injecter la configuration Firebase au moment du build
3. Système de fallback: configuration peut être chargée depuis:
   - `chrome.storage.local` (priorité 1)
   - Variables injectées au build time (priorité 2)
   - Message d'erreur si aucune config trouvée

## Tests à effectuer

### Test 1: Configuration Firebase de l'extension

**Prérequis:**
- Variables d'environnement définies dans `.env` ou dans les secrets Firebase Functions

**Étapes:**
1. Reconstruire l'extension:
   ```bash
   npm run build:extension
   # ou
   node scripts/build-extension.js
   ```

2. Charger l'extension dans Chrome:
   - Ouvrir `chrome://extensions/`
   - Activer le mode développeur
   - Cliquer sur "Charger l'extension non empaquetée"
   - Sélectionner le dossier `dist/extension`

3. Vérifier que l'extension charge sans erreur:
   - Ouvrir la console de l'extension (clic droit sur l'icône → Inspecter la popup)
   - Vérifier qu'il n'y a pas d'erreur "Configuration Firebase non trouvée"
   - Vérifier que Firebase est initialisé (message dans la console: "Firebase initialisé avec succès")

**Résultat attendu:** ✅ Extension fonctionne sans clés en dur

---

### Test 2: Authentification utilisateur

**Étapes:**
1. Cliquer sur l'icône de l'extension
2. Entrer email et mot de passe valides
3. Cliquer sur "Se connecter"

**Résultat attendu:** 
- ✅ Connexion réussie
- ✅ Nom de l'utilisateur affiché
- ✅ Bouton "Ajouter le prospect" visible

---

### Test 3: Ajout d'un prospect LinkedIn

**Prérequis:**
- Être connecté dans l'extension
- Avoir un onglet ouvert sur un profil LinkedIn (`linkedin.com/in/...`)

**Étapes:**
1. Ouvrir un profil LinkedIn
2. Cliquer sur l'icône de l'extension
3. Cliquer sur "Ajouter le prospect"
4. Attendre la fin de l'extraction IA

**Résultat attendu:**
- ✅ Extraction IA réussie
- ✅ Prospect ajouté à Firebase
- ✅ Message de succès affiché
- ✅ Bouton passe à "Prospect ajouté" (vert)

---

### Test 4: Vérification des règles Storage pour les documents de missions

**Prérequis:**
- Être connecté dans l'application web
- Avoir accès à une mission (en tant qu'admin/member de la structure ou entreprise)

**Étapes:**
1. Se connecter à http://js-connect.fr/ (ou localhost en dev)
2. Aller sur une mission existante
3. Tester l'upload d'un document:
   - Cliquer sur "Ajouter un document"
   - Sélectionner un fichier PDF (< 10MB)
   - Uploader

**Résultat attendu:**
- ✅ Upload réussi si l'utilisateur a les permissions (admin/member de la structure, ou entreprise propriétaire)
- ✅ Upload refusé si l'utilisateur n'a pas les permissions (doit afficher une erreur de permission)

**Test de sécurité:**
- Essayer d'accéder à un document d'une autre structure (devrait être refusé)
- Essayer d'uploader un document en tant qu'utilisateur sans permission (devrait être refusé)

---

### Test 5: Vérification des règles Storage pour les documents d'entreprises

**Étapes:**
1. Se connecter en tant qu'entreprise
2. Essayer d'uploader un document dans `/companies/{companyId}/documents/`
3. Se connecter en tant qu'admin/member d'une structure
4. Essayer d'accéder aux documents d'une entreprise de la même structure

**Résultat attendu:**
- ✅ Entreprise peut uploader ses propres documents
- ✅ Admin/member peut lire les documents des entreprises de sa structure
- ✅ Accès refusé pour les entreprises d'autres structures

---

### Test 6: Vérification CORS

**Étapes:**
1. Ouvrir la console développeur dans l'application web (F12)
2. Faire une requête vers l'API Cloud Functions depuis l'application:
   ```javascript
   fetch('https://us-central1-jsaas-dd2f7.cloudfunctions.net/api/', {
     method: 'GET',
     headers: {
       'Authorization': 'Bearer YOUR_TOKEN'
     }
   })
   ```
3. Vérifier les headers de réponse

**Résultat attendu:**
- ✅ Requêtes depuis `http://js-connect.fr` ou `https://js-connect.fr` autorisées
- ✅ Requêtes depuis localhost autorisées
- ✅ Requêtes depuis un domaine non autorisé rejetées (erreur CORS)

---

### Test 7: Authentification forcée sur Cloud Functions

**Étapes:**
1. Essayer d'appeler une Cloud Function sans token d'authentification:
   ```bash
   curl https://us-central1-jsaas-dd2f7.cloudfunctions.net/api/gemini/extract-profile \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"linkedinUrl": "test", "images": []}'
   ```

**Résultat attendu:**
- ✅ Erreur 401 (Unauthorized) ou 403 (Forbidden)
- ✅ Message indiquant que l'authentification est requise

---

## Checklist de vérification finale

- [ ] Extension fonctionne sans clés Firebase en dur
- [ ] Configuration Firebase peut être chargée depuis chrome.storage ou build time
- [ ] Authentification utilisateur fonctionne dans l'extension
- [ ] Ajout de prospects LinkedIn fonctionne
- [ ] Upload de documents de missions respecte les nouvelles règles de sécurité
- [ ] Upload de documents d'entreprises respecte les nouvelles règles de sécurité
- [ ] CORS fonctionne correctement pour js-connect.fr
- [ ] CORS rejette les domaines non autorisés
- [ ] Cloud Functions rejettent les requêtes non authentifiées
- [ ] Toutes les fonctionnalités existantes fonctionnent comme avant

## Notes importantes

1. **Configuration de l'extension:** Si les variables d'environnement ne sont pas définies au build time, la configuration Firebase devra être injectée manuellement dans `chrome.storage.local`:
   ```javascript
   chrome.storage.local.set({
     firebaseConfig: {
       apiKey: "VOTRE_API_KEY",
       authDomain: "jsaas-dd2f7.firebaseapp.com",
       projectId: "jsaas-dd2f7",
       storageBucket: "jsaas-dd2f7.firebasestorage.app",
       messagingSenderId: "1028151005055",
       appId: "VOTRE_APP_ID"
     }
   });
   ```

2. **Déploiement:** Avant de déployer, s'assurer que:
   - Les variables d'environnement sont définies dans Firebase Functions
   - Le domaine js-connect.fr est bien configuré dans Firebase Hosting
   - Les règles Firestore et Storage sont déployées

3. **Rollback:** En cas de problème, les règles de sécurité peuvent être restaurées depuis les fichiers de backup ou git.
