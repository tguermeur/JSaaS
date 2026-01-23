# Guide: Configurer les secrets Firebase Functions

## Étape 1: S'authentifier à Firebase

**Avant de configurer les secrets, vous devez être connecté :**

```bash
firebase login
```

Si vous êtes déjà connecté mais avez une erreur, reconnectez-vous :

```bash
firebase login --reauth
```

## Option 1: Configuration automatique (RECOMMANDÉ)

Un script configure automatiquement tous les secrets depuis votre `.env` :

```bash
# 1. S'assurer d'être connecté
firebase login --reauth

# 2. Exécuter le script
node scripts/setup-firebase-secrets.js
```

Le script va configurer automatiquement tous les secrets qui sont dans votre `.env`.

## Option 2: Configuration manuelle (une commande par secret)

Si vous préférez faire une commande à la fois, voici toutes les commandes :

```bash
# 1. EmailJS
echo "service_wd96h7i" | firebase functions:secrets:set EMAILJS_SERVICE_ID --data-file -
echo "template_bjcdscc" | firebase functions:secrets:set EMAILJS_TEMPLATE_ID --data-file -
echo "Hn6_ev50BvQzoNSS0" | firebase functions:secrets:set EMAILJS_USER_ID --data-file -
echo "20QKad4-0CztTbMAg3fEm" | firebase functions:secrets:set EMAILJS_PRIVATE_KEY --data-file -

# 2. Gemini AI
echo "AIzaSyAif_pUauZ44QFtI7y3AhrDJUEwMwCAMAY" | firebase functions:secrets:set GEMINI_API_KEY --data-file -

# 3. Frontend URL
echo "http://js-connect.fr" | firebase functions:secrets:set FRONTEND_URL --data-file -

# 4. Stripe (si vous utilisez Stripe côté serveur)
# echo "sk_live_..." | firebase functions:secrets:set STRIPE_SECRET_KEY --data-file -
# echo "whsec_..." | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --data-file -
```

**Note:** La méthode `--data-file -` avec `echo` passe la valeur via stdin pour éviter qu'elle apparaisse dans l'historique du terminal.

## Option 3: Script bash en une ligne

Vous pouvez aussi créer un script bash qui fait tout d'un coup :

```bash
#!/bin/bash
firebase login --reauth || exit 1

cat > /tmp/secrets.txt <<EOF
EMAILJS_SERVICE_ID=service_wd96h7i
EMAILJS_TEMPLATE_ID=template_bjcdscc
EMAILJS_USER_ID=Hn6_ev50BvQzoNSS0
EMAILJS_PRIVATE_KEY=20QKad4-0CztTbMAg3fEm
GEMINI_API_KEY=AIzaSyAif_pUauZ44QFtI7y3AhrDJUEwMwCAMAY
FRONTEND_URL=http://js-connect.fr
EOF

while IFS='=' read -r key value; do
  [[ -z "$key" || "$key" =~ ^#.*$ ]] && continue
  echo "$value" | firebase functions:secrets:set "$key" --data-file -
done < /tmp/secrets.txt

rm /tmp/secrets.txt
```

## Vérifier que les secrets sont configurés

Pour vérifier qu'un secret est bien configuré :

```bash
# Tester l'accès à un secret (attention: cela affiche la valeur !)
firebase functions:secrets:access EMAILJS_USER_ID
```

## Secrets déclarés dans le code

J'ai mis à jour `functions/src/index.ts` pour déclarer tous les secrets nécessaires :

```typescript
secrets: [
  'GEMINI_API_KEY',
  'EMAILJS_SERVICE_ID',
  'EMAILJS_TEMPLATE_ID',
  'EMAILJS_USER_ID',
  'EMAILJS_PRIVATE_KEY',
  'FRONTEND_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET'
]
```

Cela permet à vos Cloud Functions d'accéder à ces secrets via `process.env.NOM_DU_SECRET`.

## Résumé des secrets à configurer

| Secret | Valeur dans .env | Obligatoire |
|--------|------------------|-------------|
| `EMAILJS_SERVICE_ID` | `service_wd96h7i` | ✅ Oui |
| `EMAILJS_TEMPLATE_ID` | `template_bjcdscc` | ✅ Oui |
| `EMAILJS_USER_ID` | `Hn6_ev50BvQzoNSS0` | ✅ Oui |
| `EMAILJS_PRIVATE_KEY` | `20QKad4-0CztTbMAg3fEm` | ✅ Oui |
| `GEMINI_API_KEY` | `AIzaSyAif_pUauZ44QFtI7y3AhrDJUEwMwCAMAY` | ✅ Oui |
| `FRONTEND_URL` | `http://js-connect.fr` | ✅ Oui |
| `STRIPE_SECRET_KEY` | (non défini) | ❌ Optionnel |
| `STRIPE_WEBHOOK_SECRET` | (non défini) | ❌ Optionnel |

## Après configuration

Une fois les secrets configurés, redéployez vos fonctions pour qu'elles aient accès aux secrets :

```bash
firebase deploy --only functions
```
