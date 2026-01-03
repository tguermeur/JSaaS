# Guide simple pour restaurer un bucket Firebase Storage supprimé

## 🎯 Méthode la plus simple : Via Google Cloud Console (Sans installation)

### Étape 1 : Accéder à la console Google Cloud

1. Allez sur [Google Cloud Console - Storage](https://console.cloud.google.com/storage/browser?project=jsaas-dd2f7)
2. Connectez-vous avec votre compte Google

### Étape 2 : Trouver le bucket supprimé

1. Dans la barre latérale, cliquez sur "Buckets"
2. Si disponible, cliquez sur "Buckets supprimés" ou "Deleted buckets"
3. Trouvez votre bucket dans la liste
4. **Notez le nom exact du bucket** (ex: `jsaas-dd2f7.firebasestorage.app`)
5. **Notez la génération** si visible (un nombre long)

### Étape 3 : Restaurer via l'API REST (via le navigateur)

#### Option A : Utiliser curl dans le terminal (si vous avez un token)

1. **Obtenir un token OAuth 2.0** :
   - Allez sur: https://developers.google.com/oauthplayground/
   - Dans "Step 1", sélectionnez "Cloud Storage API v1"
   - Cochez: `https://www.googleapis.com/auth/cloud-platform`
   - Cliquez sur "Authorize APIs"
   - Connectez-vous avec votre compte Google
   - Dans "Step 2", cliquez sur "Exchange authorization code for tokens"
   - Copiez le "Access token"

2. **Restaurer le bucket** :
   ```bash
   # Remplacez YOUR_TOKEN et GENERATION par les valeurs réelles
   curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     "https://storage.googleapis.com/storage/v1/b/jsaas-dd2f7.firebasestorage.app/restore?generation=GENERATION"
   ```

#### Option B : Utiliser le script avec un token manuel

1. **Obtenir un token** (voir ci-dessus)

2. **Créer un fichier avec le token** :
   ```bash
   echo "YOUR_TOKEN" > .google-cloud-token
   ```

3. **Exécuter le script** :
   ```bash
   node scripts/restore-bucket.mjs jsaas-dd2f7.firebasestorage.app GENERATION
   ```

#### Option C : Installer gcloud CLI (Recommandé pour usage régulier)

1. **Installer gcloud** :
   ```bash
   # macOS
   brew install google-cloud-sdk
   
   # Ou télécharger depuis:
   # https://cloud.google.com/sdk/docs/install
   ```

2. **Authentifier** :
   ```bash
   gcloud auth login
   gcloud config set project jsaas-dd2f7
   ```

3. **Restaurer le bucket** :
   ```bash
   node scripts/restore-bucket.mjs jsaas-dd2f7.firebasestorage.app
   ```

## 🔍 Trouver la génération du bucket

Si vous ne connaissez pas la génération, vous pouvez :

1. **Via Google Cloud Console** :
   - Allez sur: https://console.cloud.google.com/storage/browser?project=jsaas-dd2f7
   - Cliquez sur "Buckets supprimés"
   - Trouvez votre bucket et notez la génération

2. **Via gcloud CLI** (si installé) :
   ```bash
   gcloud storage buckets list --filter="lifecycleState:DELETE_REQUESTED" --format="json" | jq '.[] | select(.name=="jsaas-dd2f7.firebasestorage.app") | .metadata.generation'
   ```

3. **Via l'API REST** (avec un token) :
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://storage.googleapis.com/storage/v1/b?project=jsaas-dd2f7" | jq '.items[] | select(.lifecycleState=="DELETE_REQUESTED") | {name: .name, generation: .generation}'
   ```

## ⚠️ Limitations

- Les buckets supprimés ne peuvent être restaurés que **pendant 7 jours** après la suppression
- Après 7 jours, la suppression est **définitive**
- Vous devez avoir la permission `storage.buckets.restore`
- Les objets (fichiers) dans le bucket ne sont **pas automatiquement restaurés**

## 📚 Références

- [Documentation Google Cloud Storage - Restore Bucket](https://cloud.google.com/storage/docs/json_api/v1/buckets/restore)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
- [Google Cloud Console](https://console.cloud.google.com/storage/browser?project=jsaas-dd2f7)






