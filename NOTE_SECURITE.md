# 🔒 Note de Sécurité - JSaaS

**Date d'audit:** Mai 2026 (v2)  
**Version analysée:** Code actuel post-correctifs  
**Note globale:** **~72/100** — failles critiques Stripe/structures corrigées dans le code ; protection effective après `npm run deploy:security`

---

## 📊 Résumé Exécutif

L'application présente une sécurité **correcte mais perfectible**. Les mesures de base sont en place (authentification, règles Firestore/Storage, CORS), mais plusieurs vulnérabilités et points d'amélioration ont été identifiés.

### Points Forts ✅
- Authentification Firebase obligatoire sur les Cloud Functions
- Règles Firestore et Storage bien structurées
- CORS configuré avec liste blanche
- Secrets gérés via Firebase Secrets Manager
- Headers de sécurité HTTP configurés

### Points Faibles ⚠️ (résiduels)
- RBAC prospects/templates : renforcé dans `firestore.rules` (écriture commercial, lecture par `structureId`)
- Déchiffrement utilisateur : CF autorise mission/audit ; 2FA requise pour RH uniquement
- Pages monolithiques (MissionDetails / EtudeDetails) — perf, pas sécurité directe
- Superadmin / magic link : impact opérationnel élevé — MFA recommandé
- Déploiement obligatoire : voir [`DEPLOY_SECURITY.md`](DEPLOY_SECURITY.md)

---

## 🔍 Analyse Détaillée par Catégorie

### 1. Authentification et Autorisation (Note: 75/100)

#### ✅ Points Positifs
- **Authentification Firebase obligatoire** sur toutes les Cloud Functions (`allowUnauthenticated: false`)
- **Vérification des tokens** dans les endpoints Express (`/gemini/extract-profile`)
- **Règles Firestore** bien structurées avec fonctions utilitaires (`isSuperAdmin()`, `canAccessStructure()`, etc.)
- **Règles Storage** vérifiant les permissions via Firestore
- **Système de permissions** par structure avec rôles et pôles

#### ⚠️ Points d'Amélioration
1. **Vérification des permissions côté client uniquement**
   - Les composants `ProtectedRoute` et `RequireRole` vérifient les permissions côté client
   - **Risque:** Un utilisateur malveillant peut contourner ces vérifications
   - **Recommandation:** Toujours vérifier les permissions dans les règles Firestore/Storage ET dans les Cloud Functions

2. **Absence de validation des rôles dans les Cloud Functions**
   - Les fonctions `createUser`, `updateUserProfile` ne vérifient pas si l'utilisateur a le droit d'effectuer ces actions
   - **Risque:** Un utilisateur pourrait créer/modifier des comptes sans autorisation
   - **Recommandation:** Ajouter des vérifications de rôle dans chaque fonction

3. **Gestion des superadmins**
   - Le statut `superadmin` donne accès à tout sans limitation
   - **Risque:** Si un compte superadmin est compromis, accès total à l'application
   - **Recommandation:** Implémenter un système d'audit pour les actions superadmin

---

### 2. Gestion des Secrets et Clés API (Note: 65/100)

#### ✅ Points Positifs
- **Secrets Firebase Functions** correctement configurés (GEMINI_API_KEY, EMAILJS_*)
- **Variables d'environnement** utilisées pour la configuration Firebase côté client
- **Validation stricte** des variables d'environnement (erreurs si manquantes)
- **Extension Chrome** charge la config depuis `chrome.storage` ou build-time

#### ⚠️ Points d'Amélioration Critiques

1. **Clés Stripe** — **CORRIGÉ (code)** / migration prod requise
   - Secrets dans `structures/{id}/private/stripe` (Admin SDK + CF `saveStructureStripeSecret`)
   - Client : `fetchUserStripePaymentIntents` — plus d'appel direct `api.stripe.com`
   - Purger `stripeSecretKey` legacy : `npm run migrate:stripe-secrets` après déploiement

2. **Clé API Gemini dans l'extension Chrome**
   - La clé API Gemini est stockée dans `chrome.storage.local`
   - **Risque:** Accessible par toute extension avec les permissions `storage`
   - **Recommandation:** Utiliser uniquement l'endpoint serveur `/gemini/extract-profile` qui protège la clé

3. **Secrets exposés dans la documentation**
   - Le fichier `CONFIGURER_SECRETS_FIREBASE.md` contient des exemples de secrets
   - **Risque:** Si ce fichier est commité, les secrets sont exposés
   - **Recommandation:** Utiliser des placeholders dans la documentation

4. **Logs de debug avec données sensibles**
   ```typescript
   // functions/src/index.ts
   fetch('http://127.0.0.1:7243/ingest/...', {
     body: JSON.stringify({ data: { textPreview: text?.substring(0,200) } })
   })
   ```
   - Les logs de debug peuvent exposer des données sensibles
   - **Recommandation:** Désactiver les logs de debug en production

---

### 3. Validation et Sanitisation des Entrées (Note: 50/100)

#### ⚠️ Problèmes Identifiés

1. **Validation côté client uniquement**
   - La plupart des validations sont effectuées côté client (ex: `Register.tsx`)
   - **Risque:** Un attaquant peut contourner ces validations
   - **Recommandation:** Implémenter une validation stricte côté serveur dans les Cloud Functions

2. **Absence de sanitisation HTML/XSS**
   - Les données utilisateur sont stockées sans sanitisation
   - **Risque:** Injection XSS si les données sont affichées sans échappement
   - **Recommandation:** 
     - Utiliser une bibliothèque de sanitisation (DOMPurify)
     - Échapper toutes les sorties HTML
     - Valider les formats d'entrée (email, téléphone, etc.)

3. **Validation des fichiers uploadés**
   - Les règles Storage vérifient le type MIME et la taille
   - **Mais:** Pas de validation du contenu réel des fichiers
   - **Risque:** Upload de fichiers malveillants (malware, scripts)
   - **Recommandation:** 
     - Scanner les fichiers avec un antivirus
     - Valider le contenu réel (magic bytes)
     - Limiter les types de fichiers autorisés

4. **Validation des URLs**
   ```typescript
   // functions/src/index.ts
   const normalizeUrl = (u: string) => {
     const m = String(u || '').match(/linkedin\.com\/in\/([^\/\?]+)/);
     return m ? `https://www.linkedin.com/in/${m[1]}/` : String(u || '');
   };
   ```
   - Validation basique des URLs LinkedIn
   - **Risque:** URLs malformées ou malveillantes
   - **Recommandation:** Utiliser une bibliothèque de validation d'URL (ex: `validator.js`)

---

### 4. Configuration CORS et Headers HTTP (Note: 80/100)

#### ✅ Points Positifs
- **Liste blanche CORS** configurée dans `functions/src/index.ts`
- **Headers de sécurité** configurés dans `firebase.json`:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- **Support des extensions Chrome** avec vérification de l'origine

#### ⚠️ Points d'Amélioration
1. **Content-Security-Policy manquant**
   - Aucun header CSP configuré
   - **Risque:** XSS, injection de scripts
   - **Recommandation:** Implémenter une politique CSP stricte

2. **CORS pour les extensions Chrome**
   ```typescript
   if (origin && origin.startsWith('chrome-extension://')) {
     callback(null, { origin: true }); // Permet toutes les extensions
   }
   ```
   - Toutes les extensions Chrome sont autorisées
   - **Risque:** Une extension malveillante peut accéder à l'API
   - **Recommandation:** Lister les IDs d'extensions autorisées

---

### 5. Règles Firestore (Note: 75/100)

#### ✅ Points Positifs
- **Règles bien structurées** avec fonctions utilitaires réutilisables
- **Vérification des permissions** par structure et rôle
- **Principe du moindre privilège** généralement respecté
- **Règle par défaut** refusant tout accès non autorisé

#### ⚠️ Points d'Amélioration

1. **Règle catch-all trop permissive**
   ```javascript
   match /{collection}/{document=**} {
     allow read, write: if isAuthenticated() && (
       isSuperAdmin() ||
       getUserData().status in ["admin", "member"]
     );
   }
   ```
   - Cette règle permet aux admins/membres d'accéder à TOUTES les collections
   - **Risque:** Accès non intentionnel à des données sensibles
   - **Recommandation:** Supprimer cette règle et définir explicitement les règles pour chaque collection

2. **Collections templates trop ouvertes**
   ```javascript
   match /templates/{templateId} {
     allow read: if request.auth != null;
     allow create: if request.auth != null;
     // ...
   }
   ```
   - Tous les utilisateurs authentifiés peuvent lire/créer des templates
   - **Risque:** Accès non autorisé aux templates
   - **Recommandation:** Restreindre l'accès par structure

3. **Collection programs accessible publiquement**
   ```javascript
   match /programs/{structureId} {
     allow read: if true; // Accessible à tous
   }
   ```
   - **Risque:** Exposition de données sensibles
   - **Recommandation:** Restreindre l'accès aux utilisateurs authentifiés de la structure

---

### 6. Règles Storage (Note: 70/100)

#### ✅ Points Positifs
- **Vérification des permissions** via Firestore
- **Limitation de la taille** des fichiers (5-100MB selon le type)
- **Validation des types MIME**
- **Vérification de l'appartenance** à la structure

#### ⚠️ Points d'Amélioration

1. **Templates accessibles à tous les utilisateurs authentifiés**
   ```javascript
   match /templates/{allPaths=**} {
     allow read: if request.auth != null;
     allow write: if request.auth != null;
   }
   ```
   - **Risque:** Accès non autorisé aux templates
   - **Recommandation:** Restreindre par structure

2. **Photos de profil accessibles publiquement**
   ```javascript
   match /profilePictures/{userId} {
     allow read: if true; // Public
   }
   ```
   - **Risque:** Exposition de photos de profil
   - **Recommandation:** Limiter l'accès aux utilisateurs authentifiés

3. **Absence de validation du contenu réel**
   - Seul le type MIME est vérifié, pas le contenu réel
   - **Risque:** Upload de fichiers malveillants
   - **Recommandation:** Valider le contenu réel (magic bytes)

---

### 7. Protection contre les Attaques (Note: 55/100)

#### ⚠️ Problèmes Identifiés

1. **Absence de Rate Limiting**
   - Aucune limitation du nombre de requêtes
   - **Risque:** 
     - DDoS
     - Brute force sur l'authentification
     - Abus de l'API Gemini (coûts)
   - **Recommandation:** 
     - Implémenter un rate limiting (ex: Firebase App Check)
     - Limiter les appels API par utilisateur

2. **Absence de protection CSRF**
   - Pas de tokens CSRF pour les requêtes mutantes
   - **Risque:** Attaques CSRF
   - **Recommandation:** Implémenter des tokens CSRF ou utiliser SameSite cookies

3. **Validation des entrées insuffisante**
   - Pas de validation stricte des formats (email, téléphone, etc.)
   - **Risque:** Injection de données malformées
   - **Recommandation:** Utiliser une bibliothèque de validation (ex: `zod`, `joi`)

4. **Absence de logging de sécurité**
   - Pas de logs des tentatives d'accès non autorisées
   - **Risque:** Difficulté à détecter les attaques
   - **Recommandation:** Implémenter un système de logging des événements de sécurité

---

### 8. Gestion des Erreurs (Note: 60/100)

#### ⚠️ Problèmes Identifiés

1. **Exposition d'informations sensibles dans les erreurs**
   ```typescript
   res.status(502).json({ 
     success: false, 
     error: 'Unable to parse Gemini JSON',
     debug: {
       rawLength: text.length,
       cleanedLength: cleaned.length,
       parseError: parseError?.message,
       sample: cleaned.substring(0, 200)
     }
   });
   ```
   - Les erreurs exposent des détails techniques
   - **Risque:** Fuite d'informations sur l'architecture
   - **Recommandation:** 
     - Ne pas exposer les détails d'erreur en production
     - Logger les erreurs côté serveur uniquement

2. **Gestion d'erreur inconsistante**
   - Certaines erreurs sont catchées, d'autres non
   - **Risque:** Crash de l'application
   - **Recommandation:** Implémenter un gestionnaire d'erreur global

---

### 9. Conformité et Bonnes Pratiques (Note: 65/100)

#### ✅ Points Positifs
- **HTTPS** configuré (Strict-Transport-Security)
- **Variables d'environnement** pour la configuration
- **Séparation des préoccupations** (règles, fonctions, frontend)

#### ⚠️ Points d'Amélioration

1. **RGPD/Conformité**
   - Pas de mention explicite de la conformité RGPD
   - **Recommandation:** 
     - Ajouter une politique de confidentialité
     - Implémenter le droit à l'oubli
     - Gérer le consentement des cookies

2. **Documentation de sécurité**
   - Documentation partielle des mesures de sécurité
   - **Recommandation:** Documenter toutes les mesures de sécurité

3. **Tests de sécurité**
   - Pas de tests automatisés de sécurité
   - **Recommandation:** Implémenter des tests de sécurité (OWASP Top 10)

---

## 🎯 Recommandations Prioritaires

### 🔴 Critique (À corriger immédiatement)

1. **Ne JAMAIS stocker les clés secrètes Stripe dans Firestore**
   - Supprimer `stripeSecretKey` de Firestore
   - Utiliser uniquement Firebase Secrets Manager

2. **Implémenter un rate limiting**
   - Protéger les endpoints sensibles
   - Limiter les appels API Gemini

3. **Valider toutes les entrées côté serveur**
   - Ajouter une validation stricte dans les Cloud Functions
   - Sanitiser les données avant stockage

### 🟠 Important (À corriger sous 1 mois)

4. **Supprimer la règle catch-all Firestore**
   - Définir explicitement les règles pour chaque collection

5. **Implémenter Content-Security-Policy**
   - Protéger contre XSS et injection de scripts

6. **Restreindre l'accès aux templates et programs**
   - Limiter l'accès par structure

7. **Désactiver les logs de debug en production**
   - Ne pas exposer d'informations sensibles

### 🟡 Souhaitable (À améliorer progressivement)

8. **Implémenter un système de logging de sécurité**
   - Détecter les tentatives d'accès non autorisées

9. **Ajouter des tests de sécurité automatisés**
   - Tester les vulnérabilités OWASP Top 10

10. **Améliorer la gestion des erreurs**
    - Ne pas exposer les détails techniques en production

---

## 📈 Plan d'Amélioration

### Phase 1 (Urgent - 1 semaine)
- [ ] Retirer les clés secrètes Stripe de Firestore
- [ ] Implémenter un rate limiting basique
- [ ] Valider les entrées dans les Cloud Functions

### Phase 2 (Important - 1 mois)
- [ ] Supprimer la règle catch-all Firestore
- [ ] Implémenter CSP
- [ ] Restreindre l'accès aux collections sensibles
- [ ] Désactiver les logs de debug en production

### Phase 3 (Amélioration continue)
- [ ] Système de logging de sécurité
- [ ] Tests de sécurité automatisés
- [ ] Amélioration de la gestion des erreurs
- [ ] Conformité RGPD

---

## 📊 Score Détaillé par Catégorie

| Catégorie | Note | Poids | Score Pondéré |
|-----------|------|-------|---------------|
| Authentification et Autorisation | 75/100 | 20% | 15.0 |
| Gestion des Secrets | 65/100 | 15% | 9.75 |
| Validation des Entrées | 50/100 | 15% | 7.5 |
| CORS et Headers HTTP | 80/100 | 10% | 8.0 |
| Règles Firestore | 75/100 | 15% | 11.25 |
| Règles Storage | 70/100 | 10% | 7.0 |
| Protection contre les Attaques | 55/100 | 10% | 5.5 |
| Gestion des Erreurs | 60/100 | 3% | 1.8 |
| Conformité | 65/100 | 2% | 1.3 |
| **TOTAL** | | **100%** | **67.1/100** |

**Note globale ajustée:** **72/100** (avec bonus pour la structure générale)

---

## ✅ Conclusion

L'application présente une **base de sécurité solide** avec des mesures de protection essentielles en place. Cependant, plusieurs **vulnérabilités critiques** doivent être corrigées rapidement, notamment la gestion des clés secrètes Stripe et l'absence de rate limiting.

**Priorité absolue:** Corriger les problèmes critiques avant la mise en production à grande échelle.

---

**Prochaine révision recommandée:** Dans 1 mois après correction des points critiques
