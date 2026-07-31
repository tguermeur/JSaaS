# Guide de configuration des secrets Firebase Functions

## Configuration automatique (Recommandé)

Un script est disponible pour configurer tous les secrets d'un coup :

```bash
node scripts/setup-firebase-secrets.js
```

Ce script :
- Lit automatiquement les valeurs depuis votre fichier `.env`
- Configure chaque secret Firebase Functions
- Affiche un résumé des secrets configurés

## Configuration manuelle (une par une)

Si vous préférez configurer chaque secret individuellement :

```bash
# EmailJS
echo "service_wd96h7i" | firebase functions:secrets:set EMAILJS_SERVICE_ID --data-file -
echo "template_bjcdscc" | firebase functions:secrets:set EMAILJS_TEMPLATE_ID --data-file -
echo "Hn6_ev50BvQzoNSS0" | firebase functions:secrets:set EMAILJS_USER_ID --data-file -
echo "votre_private_key" | firebase functions:secrets:set EMAILJS_PRIVATE_KEY --data-file -

# Gemini AI
echo "votre_gemini_key" | firebase functions:secrets:set GEMINI_API_KEY --data-file -

# Frontend URL
echo "http://js-connect.fr" | firebase functions:secrets:set FRONTEND_URL --data-file -

# Stripe (si utilisé)
echo "sk_live_..." | firebase functions:secrets:set STRIPE_SECRET_KEY --data-file -
echo "whsec_..." | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --data-file -
```

**Note:** La méthode `--data-file -` avec `echo` permet de passer la valeur via stdin et évite qu'elle apparaisse dans l'historique du terminal.

## Alternative: Mode interactif

Vous pouvez aussi utiliser le mode interactif (vous serez invité à entrer chaque valeur) :

```bash
firebase functions:secrets:set EMAILJS_SERVICE_ID
firebase functions:secrets:set EMAILJS_TEMPLATE_ID
# etc...
```

## Vérifier les secrets configurés

Pour lister tous les secrets configurés :

```bash
firebase functions:secrets:list
```

## Mettre à jour un secret

Pour mettre à jour un secret existant, utilisez la même commande `set` :

```bash
echo "nouvelle_valeur" | firebase functions:secrets:set NOM_DU_SECRET --data-file -
```

## Utilisation dans le code

Une fois configurés, les secrets sont accessibles dans vos Cloud Functions via `process.env.NOM_DU_SECRET`.

**Important:** Pour que les secrets soient accessibles dans vos fonctions, vous devez les déclarer dans la configuration :

```typescript
const functionConfig = {
  secrets: ['EMAILJS_SERVICE_ID', 'EMAILJS_TEMPLATE_ID', 'EMAILJS_USER_ID', ...]
};
```

Vérifiez que vos fonctions déclarent bien les secrets qu'elles utilisent.
