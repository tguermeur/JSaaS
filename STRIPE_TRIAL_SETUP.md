# Guide de Configuration Stripe - Essai Gratuit de 30 Jours

Ce guide vous explique comment configurer l'essai gratuit de 30 jours pour vos abonnements Stripe.

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

3. **Important : Les périodes d'essai doivent être configurées au niveau de la session de checkout**
   - Ne configurez PAS de période d'essai directement sur le produit/prix dans Stripe
   - Le code configure automatiquement l'essai gratuit de 30 jours lors de la création de la session

### Configuration Requise

Vos produits doivent avoir :
- ✅ Un prix de type `recurring` (abonnement récurrent)
- ✅ Le statut `active`
- ✅ Aucune période d'essai configurée au niveau du produit (gérée par le code)

## 2. Vérification du Code

### Dans `functions/src/stripe.ts`

Le code a été modifié pour inclure automatiquement une période d'essai de 30 jours :

```typescript
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  payment_method_types: ['card'],
  line_items: [
    {
      price: priceId,
      quantity: 1,
    },
  ],
  mode: 'subscription',
  subscription_data: {
    trial_period_days: 30,  // ✅ Essai gratuit de 30 jours
  },
  success_url: SUCCESS_URL,
  cancel_url: CANCEL_URL,
  // ...
});
```

### Fonctions concernées

1. **`createCheckoutSession`** (ligne ~175)
   - Utilisée pour les structures (Junior)
   - Configure `subscription_data.trial_period_days: 30`

2. **`createSubscription`** (ligne ~279)
   - Utilisée pour les utilisateurs individuels
   - Configure également `subscription_data.trial_period_days: 30`

## 3. Gestion des Webhooks

### Événements Stripe à surveiller

#### 1. `customer.subscription.created`
Déclenché quand un abonnement est créé (y compris en période d'essai).

**Statut de l'abonnement :** `trialing`

#### 2. `customer.subscription.updated`
Déclenché quand un abonnement passe de `trialing` à `active` (après l'essai).

**Transition importante :**
- **Avant (jours 1-30) :** `status: 'trialing'`
- **Après (jour 31) :** `status: 'active'`

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
2. Après 30 jours, Stripe passe automatiquement à `status: 'active'`
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
   - La date de fin d'essai doit être dans 30 jours

3. **Vérifier dans Firestore :**
   - Collection `subscriptions`
   - Le champ `status` doit être `'trialing'`

4. **Simuler la fin de la période d'essai :**
   - Dans Stripe Dashboard, allez dans l'abonnement
   - Utilisez "Mettre à jour la période d'essai" pour la raccourcir (pour les tests)
   - Ou attendez que Stripe passe automatiquement à `active` après 30 jours

5. **Vérifier la transition :**
   - Le webhook `customer.subscription.updated` doit se déclencher
   - Le statut dans Firestore doit passer à `'active'`

### En Mode Production

⚠️ **Important :** Testez d'abord en mode test avant de déployer en production !

## 5. Messages Utilisateur

### Sur la Page Pricing

Le message "30 jours offerts, sans engagement" est déjà affiché sur la page `/pricing`.

### Dans l'Email de Confirmation Stripe

Stripe envoie automatiquement un email de confirmation mentionnant la période d'essai.

## 6. Dépannage

### L'abonnement ne démarre pas en période d'essai

**Vérifications :**
1. Le `priceId` correspond bien à un prix de type `recurring`
2. Le code utilise bien `subscription_data.trial_period_days: 30`
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

✅ **Code configuré :** Les fonctions Stripe incluent `trial_period_days: 30`  
✅ **Webhooks :** Gèrent automatiquement la transition `trialing` → `active`  
✅ **Firestore :** Mise à jour automatique du statut de l'abonnement  
✅ **Interface :** Message "30 jours offerts" affiché sur la page Pricing  

**Actions requises :**
1. Vérifier que vos produits Stripe sont bien configurés (prix récurrents)
2. Tester en mode test
3. Vérifier que les webhooks fonctionnent correctement
4. Déployer en production

