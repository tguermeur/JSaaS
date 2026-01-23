# 🔧 Correction des secrets Stripe manquants

## Problème

Les secrets `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` sont utilisés par les fonctions Stripe mais n'existent pas encore dans Firebase Secret Manager.

## Solution

Les secrets Stripe ont été retirés de la configuration de la fonction principale `api` car :
- Les fonctions Stripe utilisent `functions.https.onRequest` (v1)
- Elles accèdent aux secrets via `process.env` directement
- Elles sont exportées depuis `stripe.ts` qui a sa propre gestion des secrets

## Si vous utilisez Stripe

Si vous utilisez les fonctionnalités Stripe, vous devez créer ces secrets dans Firebase :

### Option 1 : Via le script automatique

```bash
# Le script créera automatiquement les secrets Stripe s'ils sont dans votre .env
node scripts/setup-firebase-secrets.js
```

### Option 2 : Manuellement

```bash
# Depuis votre .env, récupérez les valeurs puis :
echo "votre_stripe_secret_key" | firebase functions:secrets:set STRIPE_SECRET_KEY --data-file -
echo "votre_stripe_webhook_secret" | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --data-file -
```

## Si vous n'utilisez PAS Stripe

Si vous n'utilisez pas Stripe, vous pouvez ignorer cette erreur. Les fonctions Stripe utiliseront `process.env` au moment de l'exécution, et si les secrets ne sont pas définis, elles lanceront une erreur explicite.

## Vérification

Après correction, redéployez :

```bash
firebase deploy --only functions
```
