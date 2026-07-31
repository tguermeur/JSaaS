# Guide de Configuration Stripe - Offre 2 mois gratuits (Premium)

Ce guide vous explique comment configurer l'offre **2 mois gratuits** puis **149,90€/mois** pour le plan Premium, et la création du compte structure après paiement.

## 1. Configuration des Produits dans le Dashboard Stripe

### Prérequis
1. Accédez au [Dashboard Stripe](https://dashboard.stripe.com/)
2. Assurez-vous d'être en mode **Test** pour les tests, puis basculez en mode **Production** pour la mise en ligne

### Création/Modification des Produits

#### Pour chaque produit (Basique, Premium, etc.) :

1. **Allez dans "Produits" > Sélectionnez votre produit**

2. **Vérifiez que les prix sont bien en mode "Abonnement" (recurring)**
   - Les prix doivent être de type `recurring` (mensuel ou annuel)
   - Les prix `one-time` ne supportent pas les périodes d'essai

3. **Important : Les périodes d'essai sont gérées par le code**
   - Ne configurez PAS de période d'essai directement sur le produit/prix dans Stripe
   - Le code configure automatiquement **2 mois gratuits** (`trial_period_days: 60`) lors de la création de la session Checkout

### Configuration Requise

Vos produits doivent avoir :
- ✅ Un prix de type `recurring` (abonnement récurrent)
- ✅ Le statut `active`
- ✅ Aucune période d'essai configurée au niveau du produit (gérée par le code)

## 2. Vérification du Code

### Dans `functions/src/stripe.ts`

Le code configure automatiquement 2 mois gratuits pour les **nouveaux clients** uniquement :

```typescript
// Vérifier si le client a déjà un abonnement actif
const subscriptions = await stripe.subscriptions.list({
  customer: customerId,
  status: 'active',
  limit: 1
});
const hasActiveSubscription = subscriptions.data.length > 0;

const subscriptionData = {
  metadata: { userId, structureId, customerEmail }
};

// Appliquer la période d'essai uniquement pour les nouveaux clients
if (!hasActiveSubscription) {
  subscriptionData.trial_period_days = 60; // ✅ 2 mois gratuits
}

const session = await stripe.checkout.sessions.create({
  customer: customerId,
  payment_method_types: ['card'],
  line_items: [{ price: priceId, quantity: 1 }],
  mode: 'subscription',
  subscription_data: subscriptionData,  // ✅ 2 mois gratuits uniquement pour nouveaux clients
  },
  success_url: SUCCESS_URL,
  cancel_url: CANCEL_URL,
  // ...
});
```

### Fonctions concernées

1. **`createCheckoutSession`**
   - Utilisée pour les structures (inscription Premium avec 2 mois gratuits)
   - Configure `subscription_data.trial_period_days: 60` et métadonnées (userId, structureId, customerEmail) pour le webhook

2. **`createSubscription`**
   - Utilisée pour les utilisateurs individuels
   - Configure `subscription_data.trial_period_days: 60` (2 mois gratuits) uniquement pour les nouveaux clients

## 3. Gestion des Webhooks

### Événements Stripe à surveiller

#### 1. `customer.subscription.created`
Déclenché quand un abonnement est créé (y compris en période d'essai).

**Statut de l'abonnement :** `trialing`

#### 2. `customer.subscription.updated`
Déclenché quand un abonnement passe de `trialing` à `active` (après l'essai).

**Transition importante :**
- **Avant (2 premiers mois) :** `status: 'trialing'`
- **Après (à partir du 3e mois) :** `status: 'active'`

#### 3. `invoice.payment_succeeded`
Déclenché lors du premier paiement réussi (après la période d'essai).

### Code du Webhook Actuel

Le webhook `handleStripeWebhook` dans `functions/src/stripe.ts` gère déjà ces événements :

```typescript
case 'customer.subscription.created':
case 'customer.subscription.updated':
  const subscription = event.data.object as Stripe.Subscription;
  // Le statut peut être 'trialing' ou 'active'
  // Firestore sera mis à jour automatiquement
  break;
```

### Vérification de la Transition "trialing" → "active"

Le webhook met automatiquement à jour Firestore avec le statut de l'abonnement :

```typescript
await admin.firestore().collection('subscriptions').doc(structureId).set({
  status: subscription.status,  // 'trialing' puis 'active'
  // ...
}, { merge: true });
```

**À vérifier :**
1. Les abonnements en essai ont `status: 'trialing'` dans Firestore
2. Après 60 jours (2 mois), Stripe passe automatiquement à `status: 'active'`
3. Le webhook met à jour Firestore avec le nouveau statut

## 4. Tests

### En Mode Test

1. **Créer une session de checkout :**
   ```bash
   # Utiliser la fonction createCheckoutSession avec un priceId de test
   ```

2. **Vérifier dans Stripe Dashboard :**
   - Allez dans "Abonnements"
   - L'abonnement doit afficher "En période d'essai"
   - La date de fin d'essai doit être dans 2 mois (60 jours)

3. **Vérifier dans Firestore :**
   - Collection `subscriptions`
   - Le champ `status` doit être `'trialing'`

4. **Simuler la fin de la période d'essai :**
   - Dans Stripe Dashboard, allez dans l'abonnement
   - Utilisez "Mettre à jour la période d'essai" pour la raccourcir (pour les tests)
   - Ou attendez que Stripe passe automatiquement à `active` après 2 mois

5. **Vérifier la transition :**
   - Le webhook `customer.subscription.updated` doit se déclencher
   - Le statut dans Firestore doit passer à `'active'`

### En Mode Production

⚠️ **Important :** Testez d'abord en mode test avant de déployer en production !

## 5. Messages Utilisateur

### Sur la Page Pricing

Le message "2 mois offerts" puis "149,90€/mois" est affiché sur la page `/pricing`.

### Dans l'Email de Confirmation Stripe

Stripe envoie automatiquement un email de confirmation mentionnant la période d'essai.

## 6. Dépannage

### L'abonnement ne démarre pas en période d'essai

**Vérifications :**
1. Le `priceId` correspond bien à un prix de type `recurring`
2. Le code utilise bien `subscription_data.trial_period_days: 60`
3. Les logs de la fonction Firebase montrent que la session est créée correctement

### La transition trialing → active ne fonctionne pas

**Vérifications :**
1. Le webhook Stripe est bien configuré et fonctionne
2. L'URL du webhook est correcte dans Stripe Dashboard
3. Le secret du webhook (`STRIPE_WEBHOOK_SECRET`) est bien configuré
4. Les logs Firebase Functions montrent que le webhook est appelé

### Dans Stripe Dashboard

**Vérifier :**
- Settings > Webhooks
- Vérifiez que les événements `customer.subscription.created` et `customer.subscription.updated` sont sélectionnés
- Vérifiez les logs du webhook pour voir les appels reçus

## 7. Configuration Firebase Functions

Assurez-vous que les variables d'environnement sont configurées :

```bash
firebase functions:config:set stripe.secret_key="sk_live_..."
firebase functions:config:set app.frontend_url="https://votre-domaine.com"
firebase functions:config:set stripe.webhook_secret="whsec_..."
```

Ou dans `.env` (pour le développement local) :

```env
STRIPE_SECRET_KEY=sk_test_...
FRONTEND_URL=http://localhost:5173
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 8. Résumé

✅ **Code configuré :** `createCheckoutSession` utilise `trial_period_days: 60` (2 mois)  
✅ **Webhooks :** Gèrent la transition `trialing` → `active` et mettent à jour `structures` + `subscriptions`  
✅ **Compte structure :** Créé à l’inscription (avant paiement), lié à l’utilisateur ; après paiement le webhook met à jour l’abonnement  

**Actions requises :**
1. Créer le produit Premium et le prix récurrent 149,90€/mois dans Stripe (voir section ci-dessous)
2. Configurer le webhook et les variables d’environnement
3. Tester en mode test puis déployer en production

---

## Ce que vous devez faire dans Stripe (checklist)

1. **Produit Premium existant**
   - **ID du produit :** `prod_SA4SNLKSemLQHQ`
   - Ce produit est déjà configuré dans Stripe

2. **Créer le prix récurrent (si pas déjà fait)**
   - Sur le produit `prod_SA4SNLKSemLQHQ`, **Ajouter un autre prix** (ou utiliser le prix existant)
   - Type : **Abonnement récurrent**
   - Montant : **149,90 €** (ou 14990 centimes selon l’interface)
   - Facturation : **Mensuelle**
   - Enregistrer → copier l’**ID du prix** (ex. `price_1ABC...`)

3. **Variables d’environnement**
   - Dans ton projet (`.env` ou Firebase Functions config), définir :
     - `VITE_STRIPE_PUBLIC_KEY` : clé publique Stripe (pk_test_... ou pk_live_...)
     - `VITE_STRIPE_PRICE_PREMIUM` ou `VITE_STRIPE_PRICE_PRO` : l’ID du prix copié ci‑dessus
   - **Backend (Cloud Functions)** : en production le `.env` des functions n’est pas déployé. Définir au moins :
     - `STRIPE_SECRET_KEY` : dans la console Google Cloud (Cloud Functions → votre fonction → Modifier → Variables d’environnement) ou via `firebase functions:config:set stripe.secret_key "sk_live_..."`.
     - `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL` selon besoin. Sans `STRIPE_SECRET_KEY`, `createCheckoutSession` renverra une erreur (message visible après redéploiement).

4. **Webhook**
   - Dashboard Stripe → **Développeurs** → **Webhooks** → **Ajouter un endpoint**
   - URL : l’URL de ta Cloud Function `handleStripeWebhook` (ex. `https://.../handleStripeWebhook`)
   - Événements à écouter : `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Récupérer le **Signing secret** (whsec_...) et le mettre dans `STRIPE_WEBHOOK_SECRET`

5. **Après paiement**
   - Le webhook met à jour la collection `subscriptions` et le document de la **structure** dans `structures` (subscriptionStatus, subscriptionId, currentPeriodEnd).
   - Le compte structure et l’utilisateur ont déjà été créés à l’inscription ; le paiement valide l’abonnement (statut `trialing` puis `active`).

---

## Dépannage : pas d’étape carte bancaire (inscription Junior / structure)

**Symptôme :** Lors de l’inscription d’une structure (Junior) en local (`http://localhost:...`), le compte est créé dans Firebase Auth mais l’utilisateur ne voit jamais la page Stripe pour saisir sa carte.

**Cause :** En local, les requêtes Firestore peuvent être bloquées par CORS (`Access-Control-Allow-Origin` + `credentials: 'include'`). Le client Firestore passe alors en mode « offline », les écritures (création structure, document utilisateur) échouent, et le flux ne va jamais jusqu’à `createCheckoutSession` ni la redirection Stripe.

**Ordre du flux :**  
1) Création compte Auth → 2) Création document structure + document utilisateur dans Firestore → 3) Appel Stripe `createCheckoutSession` → 4) Redirection vers la page de saisie de la carte.

**Que faire :**

- **Tester sur la version déployée (HTTPS)** : le CORS ne se produit en général pas sur l’origine de production.
- **Vérifier les domaines autorisés** : Firebase Console → Authentication → Paramètres → Domaines autorisés : ajouter `http://localhost:3006` (ou le port utilisé).
- **En local** : essayer le port par défaut Vite (`npm run dev` sans `--port`, souvent 5173), désactiver les extensions (bloqueurs de pub, Movix, etc.) qui peuvent modifier les en-têtes.
- **Message affiché** : en cas d’échec Firestore (client offline), l’app affiche désormais un message expliquant que l’étape carte intervient juste après et de réessayer avec une connexion stable ou depuis le site déployé.

---

## Dépannage : « Session d'inscription : STRIPE_SECRET_KEY n'est pas configurée »

**Symptôme :** Lors de l’inscription Junior (plan Premium), après avoir cliqué pour aller au paiement, l’erreur affichée est :  
*« Session d'inscription : STRIPE_SECRET_KEY n'est pas configurée. Veuillez la définir dans les variables d'environnement ou la configuration Firebase. »*

**Cause :** En production, le fichier `.env` des Cloud Functions n’est pas déployé. La clé secrète Stripe doit être configurée au niveau du projet Firebase ou de Google Cloud.

**À faire (dans l’ordre) :**

1. **Configurer la clé Stripe pour les Functions (méthode Firebase)**  
   À la racine du projet, avec la clé **secrète** Stripe (sk_test_... ou sk_live_...) :

   ```bash
   firebase functions:config:set stripe.secret_key="sk_live_VOTRE_CLE_ICI"
   ```

   Puis redéployer les functions :

   ```bash
   firebase deploy --only functions
   ```

2. **Si l’erreur persiste (Functions v2 / Gen 2)**  
   Définir la variable d’environnement côté Google Cloud :

   - Ouvrir [Google Cloud Console](https://console.cloud.google.com/) → projet **jsaas-dd2f7** (ou le vôtre).
   - **Cloud Functions** (ou **Run** si vous utilisez les fonctions Gen 2) → sélectionner la fonction concernée (ex. `createCheckoutSessionForSignup`) → **Modifier**.
   - Onglet **Variables et secrets** (ou **Variables d’environnement**) → **Ajouter une variable** :
     - Nom : `STRIPE_SECRET_KEY`
     - Valeur : `sk_live_...` (ou `sk_test_...`).
   - Enregistrer et redéployer si nécessaire.

3. **Vérifier**  
   Réessayer l’inscription Junior (plan Premium) ; la redirection vers Stripe doit s’effectuer sans ce message.

---

## Dépannage : « Configuration Stripe manquante »

**Symptôme :** À l’inscription Junior (plan Premium), le message « Configuration Stripe manquante » s’affiche après la création du compte.

**Cause :** La variable d’environnement contenant l’**ID du prix Stripe** (abonnement Premium) n’est pas définie au moment du **build** de l’app. Avec Vite, les variables `VITE_*` sont injectées au build, pas au runtime.

**À faire :**

1. **Créer le prix dans Stripe** (si pas déjà fait) : Produit Premium → Ajouter un prix récurrent 149,90 €/mois → copier l’ID (ex. `price_1ABC...`).
2. **Définir la variable au build / hébergement :**
   - **En local** : dans un fichier `.env` à la racine du projet :
     - `VITE_STRIPE_PRICE_PREMIUM=price_xxx` (ou `VITE_STRIPE_PRICE_PRO=price_xxx`)
   - **En production** (Firebase Hosting, Vercel, Netlify, etc.) : ajouter la même variable dans les variables d’environnement du **build** (pas seulement des Functions), puis **reconstruire et redéployer** le front.
3. Vérifier aussi que `VITE_STRIPE_PUBLIC_KEY` (clé publique Stripe) est définie au build.

