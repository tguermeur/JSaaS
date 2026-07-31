# Comment obtenir un token d'authentification Google Cloud

## Option 1 : Installer gcloud CLI (Recommandé)

### Installation sur macOS
```bash
# Via Homebrew
brew install google-cloud-sdk

# Ou télécharger depuis:
# https://cloud.google.com/sdk/docs/install
```

### Authentification
```bash
# Se connecter
gcloud auth login

# Configurer le projet
gcloud config set project jsaas-dd2f7

# Vérifier l'authentification
gcloud auth list

# Obtenir un token (pour tester)
gcloud auth print-access-token
```

## Option 2 : Token via variable d'environnement

### Obtenir un token depuis Google Cloud Console

1. **Via OAuth 2.0 Playground** (Méthode rapide)
   - Allez sur: https://developers.google.com/oauthplayground/
   - Dans "Step 1", sélectionnez "Cloud Storage API v1"
   - Cochez: `https://www.googleapis.com/auth/cloud-platform`
   - Cliquez sur "Authorize APIs"
   - Connectez-vous avec votre compte Google
   - Dans "Step 2", cliquez sur "Exchange authorization code for tokens"
   - Copiez le "Access token"
   - Définissez la variable d'environnement:
     ```bash
     export GOOGLE_CLOUD_TOKEN="votre-token-ici"
     ```

2. **Via Google Cloud Console - Compte de service**
   - Allez sur: https://console.cloud.google.com/apis/credentials
   - Cliquez sur "Créer des identifiants" → "Clé de compte de service"
   - Sélectionnez ou créez un compte de service
   - Téléchargez la clé JSON
   - Utilisez la clé JSON pour obtenir un token (voir Option 3)

## Option 3 : Utiliser un fichier de clé de compte de service

1. **Créer une clé de compte de service**
   - Allez sur: https://console.cloud.google.com/iam-admin/serviceaccounts
   - Créez un compte de service ou utilisez un existant
   - Accordez le rôle "Storage Admin" ou "Storage Object Admin"
   - Créez une clé JSON et téléchargez-la

2. **Installer google-auth-library** (si nécessaire)
   ```bash
   npm install google-auth-library
   ```

3. **Créer un script pour obtenir le token**
   ```javascript
   import { GoogleAuth } from 'google-auth-library';
   
   const auth = new GoogleAuth({
     keyFile: 'path/to/service-account-key.json',
     scopes: ['https://www.googleapis.com/auth/cloud-platform']
   });
   
   const client = await auth.getClient();
   const token = await client.getAccessToken();
   console.log(token);
   ```

## Option 4 : Utiliser Firebase CLI

Si vous avez Firebase CLI installé :

```bash
# Installer Firebase CLI
npm install -g firebase-tools

# Se connecter
firebase login

# Obtenir un token
firebase login:ci --no-localhost
```

## Option 5 : Token temporaire via curl (Méthode rapide)

⚠️ **Cette méthode nécessite un client OAuth configuré**

1. Créez un projet OAuth dans Google Cloud Console
2. Configurez les redirect URIs
3. Utilisez l'URL d'autorisation pour obtenir un code
4. Échangez le code contre un token

## Vérification du token

Pour vérifier que votre token fonctionne :

```bash
# Avec gcloud
gcloud auth print-access-token | head -c 20

# Ou tester avec curl
curl -H "Authorization: Bearer $GOOGLE_CLOUD_TOKEN" \
  "https://storage.googleapis.com/storage/v1/b?project=jsaas-dd2f7" | head -20
```

## Utilisation avec le script

Une fois que vous avez un token, vous pouvez :

1. **Via variable d'environnement** (recommandé pour les sessions temporaires):
   ```bash
   export GOOGLE_CLOUD_TOKEN="votre-token"
   node scripts/restore-bucket.mjs jsaas-dd2f7.firebasestorage.app
   ```

2. **Via fichier** (pour les tokens persistants):
   ```bash
   echo "votre-token" > .google-cloud-token
   node scripts/restore-bucket.mjs jsaas-dd2f7.firebasestorage.app
   ```

3. **Via gcloud** (si installé):
   ```bash
   # Le script détectera automatiquement gcloud
   node scripts/restore-bucket.mjs jsaas-dd2f7.firebasestorage.app
   ```

## 🔒 Sécurité

⚠️ **Important**: Ne commitez jamais votre token dans Git!

- Ajoutez `.google-cloud-token` à `.gitignore`
- N'incluez jamais de tokens dans votre code
- Utilisez des variables d'environnement pour les tokens
- Les tokens expirent après un certain temps (généralement 1 heure)

## 📚 Références

- [Google Cloud Authentication](https://cloud.google.com/docs/authentication)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
- [Service Accounts](https://cloud.google.com/iam/docs/service-accounts)






