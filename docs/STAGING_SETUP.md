# Environnement de staging — js-connect-staging

Projet Firebase dédié : **`js-connect-staging`** (app web « JS Connect Staging »).  
La production reste sur **`jsaas-dd2f7`** et se déploie **manuellement**.

| Alias `.firebaserc` | Projet |
|---------------------|--------|
| `default` / `prod` | `jsaas-dd2f7` |
| `staging` | `js-connect-staging` |

## Bascule d’alias

```bash
firebase use staging   # travail / déploiement staging
firebase use prod      # production uniquement
```

Vérifier l’alias actif : `firebase use`.

## Front — variables Vite

1. Copier `.env.staging.example` → `.env.staging` (ignoré par git).
2. Remplir `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` depuis la console Firebase (app Staging).
3. **Laisser toutes les `VITE_EMAILJS_*` vides** — le staging ne doit envoyer aucun email.

```bash
npm run build:staging          # charge .env.staging via --mode staging
npm run deploy:staging         # use staging + build + deploy
npm run deploy:staging:rules
npm run deploy:staging:functions
```

`vite.config.ts` n’impose ni `envDir` ni `loadEnv` figé : le mode Vite suffit.

## Cloud Functions — 22 variables (staging)

Configurer sur le projet **`js-connect-staging`** (Secret Manager / variables d’env Cloud Functions), **pas** sur la prod.

| Variable | Valeur attendue en staging |
|----------|----------------------------|
| `ENCRYPTION_KEY` | **Nouvelle** clé hex 64 chars, **différente de la prod** |
| `SIGNATURE_TOKEN_PEPPER` | **Nouveau** pepper, **différent de la prod** |
| `GEMINI_API_KEY` | Clé Gemini (staging ou dédiée) |
| `EMAILJS_SERVICE_ID` | **Vide / non défini** (pas d’email) |
| `EMAILJS_TEMPLATE_ID` | **Vide / non défini** |
| `EMAILJS_TEMPLATE_ID_AMBASSADOR` | **Vide / non défini** |
| `EMAILJS_TEMPLATE_ID_PASSWORD_RESET` | **Vide / non défini** |
| `EMAILJS_TEMPLATE_ID_GENERIC` | **Vide / non défini** |
| `EMAILJS_TEMPLATE_ID_MEMBER_INVITE` | **Vide / non défini** |
| `EMAILJS_TEMPLATE_ID_SIGNATURE` | **Vide / non défini** |
| `EMAILJS_TEMPLATE_ID_DOCUMENT_TO_SIGN` | **Vide / non défini** |
| `EMAILJS_TEMPLATE_ID_SIGNATURE_COMPLETED` | **Vide / non défini** |
| `EMAILJS_TEMPLATE_ID_DEMARCHAGE` | **Vide / non défini** |
| `EMAILJS_USER_ID` | **Vide / non défini** |
| `EMAILJS_PRIVATE_KEY` | **Vide / non défini** |
| `FRONTEND_URL` | `https://js-connect-staging.web.app` |
| `CONTACT_INBOX` | Boîte staging ou vide |
| `CONTACT_EMAIL` | Idem / vide |
| `STRIPE_SECRET_KEY` | Clé **test** uniquement (`sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | Secret du **webhook staging** (endpoint distinct) |
| `STRIPE_MODE` | `test` |
| `FUNCTIONS_REGION` | `us-central1` (callables ; Firestore data en europe-west1) |

### Sécurité critique — clés de chiffrement

`ENCRYPTION_KEY` et `SIGNATURE_TOKEN_PEPPER` **doivent être différents de la production**.  
Sinon le staging peut déchiffrer les données de prod, et toute personne y ayant accès détient la clé de production.

Générer une clé :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# ou : npm --prefix functions run generate-key   (si script présent)
```

### Stripe

- Uniquement `sk_test_…` et `STRIPE_MODE=test`.
- Créer un endpoint webhook Stripe **séparé** pointant vers les Functions staging, et y coller le `whsec_…` dans `STRIPE_WEBHOOK_SECRET`.

### Déploiement des secrets

```bash
firebase use staging

# Exemple (une variable à la fois) :
echo -n "VOTRE_CLE_HEX_64" | firebase functions:secrets:set ENCRYPTION_KEY --data-file -
echo -n "VOTRE_PEPPER" | firebase functions:secrets:set SIGNATURE_TOKEN_PEPPER --data-file -
echo -n "sk_test_..." | firebase functions:secrets:set STRIPE_SECRET_KEY --data-file -
echo -n "whsec_..." | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --data-file -

# FRONTEND_URL : variable d’environnement non secrète (pas dans secrets),
# pour éviter le conflit « overlaps non secret » au deploy.
# Console GCP → Cloud Run / Functions → FRONTEND_URL=https://js-connect-staging.web.app

firebase deploy --only functions --project js-connect-staging
```

Ou, une fois un `.env` local dédié staging (hors git) :

```bash
firebase use staging
node scripts/setup-firebase-secrets.js   # lit .env — vérifier le contenu avant !
```

## CI — déploiement auto staging

Workflow [`.github/workflows/deploy-staging.yml`](../.github/workflows/deploy-staging.yml) : sur **push `main`**, build `--mode staging` puis `firebase deploy --project js-connect-staging` via compte de service (`FIREBASE_SERVICE_ACCOUNT_STAGING`).

La **production** n’est **pas** déployée automatiquement. Les scripts `deploy` / `deploy:hosting` / `deploy:security` exigent la saisie interactive de `jsaas-dd2f7`.

## Seed staging depuis la prod (échantillon anonymisé)

```bash
# Dry-run (aucune écriture)
node scripts/seed-staging-from-prod.mjs --dry-run

# Écriture réelle — exige --confirm ; refuse si FIRESTORE_EMULATOR_HOST est défini
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
  node scripts/seed-staging-from-prod.mjs --confirm --limit=50
```

Le script lit `jsaas-dd2f7` et n’écrit que dans `js-connect-staging`. Les URLs Storage prod (`*Url`, documents d’identité, `customDocuments`) sont nullifiées.

Pour l’émulateur local uniquement : `scripts/seed-emulator-from-prod.mjs` (exige `FIRESTORE_EMULATOR_HOST`).

## Règle migrations

**Aucun script de migration ne touche la production avant d’avoir tourné intégralement sur le staging.**

Ordre type : dry-run staging → exécution staging → validation → seulement ensuite prod (avec `firebase use prod` + confirmation).

## Rollback staging

Redeployer le commit / artefact précédent sur `js-connect-staging` (`firebase use staging` puis `firebase deploy` ciblé).
