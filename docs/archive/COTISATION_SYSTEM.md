# Système de Cotisations - Guide d'utilisation

## Vue d'ensemble

Le nouveau système de cotisations permet aux utilisateurs de payer leur cotisation via un iframe Stripe intégré, et aux administrateurs de gérer et visualiser toutes les cotisations de leur structure.

## Fonctionnalités

### Pour les utilisateurs
- **Paiement sécurisé** : Interface de paiement Stripe intégrée
- **Confirmation automatique** : Page de succès après paiement
- **Gestion des erreurs** : Page d'annulation en cas d'échec
- **Historique** : Consultation de ses cotisations

### Pour les administrateurs
- **Vue d'ensemble** : Liste de tous les cotisants de la structure
- **Filtrage** : Par statut (actif, expiré, remboursé)
- **Recherche** : Par nom, email ou session Stripe
- **Export** : Export CSV des cotisations
- **Détails** : Informations complètes sur chaque cotisation

## Configuration

### 1. Configuration des clés Stripe dans la structure

Chaque structure doit configurer ses propres clés Stripe dans les paramètres :

```typescript
interface Structure {
  // ... autres champs
  stripeIntegrationEnabled: boolean;
  stripePublishableKey: string;
  stripeSecretKey: string;
  stripeProductId: string;
  stripeBuyButtonId: string;
}
```

### 2. Configuration des cotisations

```typescript
interface Structure {
  // ... autres champs
  cotisationsEnabled: boolean;
  cotisationAmount: number;
  cotisationDuration: 'end_of_school' | '1_year' | '2_years' | '3_years';
}
```

## Flux de paiement

### 1. Initiation du paiement
- L'utilisateur clique sur "Payer sa cotisation"
- Redirection vers `/cotisation/payment`
- Création d'une session Stripe avec les clés de la structure

### 2. Paiement
- Affichage de l'iframe Stripe
- Paiement sécurisé via Stripe
- Redirection automatique selon le résultat

### 3. Confirmation
- **Succès** : Redirection vers `/cotisation/success`
- **Échec** : Redirection vers `/cotisation/cancel`

### 4. Traitement automatique
- Webhook Stripe pour traiter les paiements
- Création automatique de la cotisation dans Firestore
- Mise à jour du statut utilisateur

## Structure des données

### Collection `subscriptions`
```typescript
interface Subscription {
  id: string;
  userId: string;
  status: 'active' | 'expired' | 'cancelled';
  paidAt: Date;
  expiresAt: Date;
  stripeSessionId: string;
  amount: number;
  structureId: string;
  cotisationDuration: string;
  createdAt: Date;
  refunded?: boolean;
  refundedAt?: Date;
}
```

### Mise à jour utilisateur
```typescript
interface User {
  // ... autres champs
  hasActiveSubscription: boolean;
  subscriptionId: string;
  subscriptionStatus: string;
  subscriptionPaidAt: Date;
  subscriptionExpiresAt: Date;
  lastSubscriptionUpdate: Date;
}
```

## Fonctions Cloud

### `createCotisationSession`
Crée une session de paiement Stripe pour une cotisation.

**Paramètres :**
- `userId`: ID de l'utilisateur
- `structureId`: ID de la structure
- `amount`: Montant de la cotisation
- `duration`: Durée de la cotisation

**Retour :**
- `sessionId`: ID de la session Stripe
- `sessionUrl`: URL de paiement

### `getStructureCotisations`
Récupère toutes les cotisations d'une structure (admin uniquement).

**Paramètres :**
- `structureId`: ID de la structure

**Retour :**
- `cotisations`: Liste des cotisations avec données utilisateur

### `handleCotisationWebhook`
Webhook pour traiter les événements Stripe.

**Événements gérés :**
- `checkout.session.completed`: Création automatique de la cotisation
- `payment_intent.succeeded`: Log de succès
- `payment_intent.payment_failed`: Log d'échec

## Pages

### `/cotisation/payment`
Page de paiement avec iframe Stripe.

### `/cotisation/success`
Page de confirmation de paiement réussi.

### `/cotisation/cancel`
Page d'annulation de paiement.

### `/app/structure-cotisations`
Page admin pour gérer les cotisations de la structure.

## Sécurité

### Authentification
- Toutes les fonctions Cloud vérifient l'authentification
- Les admins ne peuvent voir que les cotisations de leur structure

### Validation
- Vérification des clés Stripe de la structure
- Validation des montants et durées
- Contrôle des permissions utilisateur

### Webhooks
- Signature Stripe vérifiée
- Gestion des erreurs robuste
- Logs détaillés pour le debugging

## Déploiement

### 1. Variables d'environnement
```bash
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=https://votre-domaine.com
```

### 2. Configuration Stripe
- Créer un webhook dans le dashboard Stripe
- Pointer vers `https://votre-fonction.cloudfunctions.net/handleCotisationWebhook`
- Événements : `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`

### 3. Déploiement des fonctions
```bash
firebase deploy --only functions
```

## Utilisation

### Pour les utilisateurs
1. Aller sur la page des missions disponibles
2. Cliquer sur "Payer sa cotisation"
3. Remplir les informations de paiement
4. Confirmer le paiement
5. Recevoir la confirmation

### Pour les administrateurs
1. Aller dans "Gestion cotisations" dans la sidebar
2. Voir la liste de tous les cotisants
3. Filtrer par statut si nécessaire
4. Rechercher un utilisateur spécifique
5. Exporter les données en CSV

## Maintenance

### Monitoring
- Surveiller les logs des fonctions Cloud
- Vérifier les webhooks Stripe
- Contrôler les erreurs de paiement

### Sauvegarde
- Les données sont automatiquement sauvegardées dans Firestore
- Export régulier des cotisations recommandé

### Mise à jour
- Vérifier la compatibilité avec les nouvelles versions de Stripe
- Tester les webhooks après déploiement
- Valider les nouvelles fonctionnalités
