# Guide de restauration d'un bucket Firebase Storage supprimé

## ⚠️ Important

- Les buckets supprimés peuvent être restaurés pendant **7 jours** après la suppression
- Après 7 jours, la suppression est définitive
- La restauration nécessite la permission `storage.buckets.restore`

## 📋 Prérequis

### Option 1 : Avec gcloud CLI (Recommandé)

1. **Installer Google Cloud CLI**
   ```bash
   # macOS (via Homebrew)
   brew install google-cloud-sdk
   
   # Ou télécharger depuis: https://cloud.google.com/sdk/docs/install
   ```

2. **Configurer et authentifier**
   ```bash
   # Vérifier l'installation
   gcloud --version
   
   # Se connecter
   gcloud auth login
   
   # Définir le projet
   gcloud config set project jsaas-dd2f7
   ```

### Option 2 : Sans gcloud CLI (Token manuel)

1. **Obtenir un token d'authentification**
   - Voir le guide: `scripts/get-google-token.md`
   - Ou définir la variable d'environnement: `export GOOGLE_CLOUD_TOKEN="your-token"`
   - Ou créer un fichier `.google-cloud-token` à la racine du projet

2. **Permissions nécessaires** :
   - `storage.buckets.restore` au niveau du projet
   - `storage.buckets.get` pour voir les buckets supprimés

## 🔍 Étape 1 : Trouver le bucket supprimé

### Option A : Via la console Google Cloud
1. Allez sur [Google Cloud Console](https://console.cloud.google.com/storage/browser)
2. Cliquez sur "Buckets supprimés" ou "Deleted buckets"
3. Trouvez votre bucket dans la liste
4. Notez le **nom du bucket** et la **génération** (si visible)

### Option B : Via gcloud CLI
```bash
# Lister tous les buckets supprimés
gcloud storage buckets list --filter="lifecycleState:DELETE_REQUESTED" --format="table(name,timeCreated,metadata.generation)"
```

## 🚀 Étape 2 : Restaurer le bucket

### Méthode 1 : Script Node.js ES Modules (Recommandé)

```bash
# Avec le nom du bucket uniquement (le script trouvera la génération)
node scripts/restore-bucket.mjs jsaas-dd2f7.firebasestorage.app

# Avec le nom et la génération
node scripts/restore-bucket.mjs jsaas-dd2f7.firebasestorage.app 1234567890

# Avec un token via variable d'environnement
export GOOGLE_CLOUD_TOKEN="your-token"
node scripts/restore-bucket.mjs jsaas-dd2f7.firebasestorage.app
```

**Note**: Le script `.mjs` fonctionne avec ES modules et supporte plusieurs méthodes d'authentification.

### Méthode 2 : Script Bash

```bash
# Rendre le script exécutable (déjà fait)
chmod +x scripts/restore-bucket.sh

# Exécuter avec le nom du bucket
./scripts/restore-bucket.sh jsaas-dd2f7.firebasestorage.app

# Ou avec la génération
./scripts/restore-bucket.sh jsaas-dd2f7.firebasestorage.app 1234567890
```

### Méthode 3 : Commande gcloud directe

```bash
# Obtenir le token d'authentification
ACCESS_TOKEN=$(gcloud auth print-access-token)

# Restaurer le bucket (remplacez GENERATION par la génération réelle)
curl -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://storage.googleapis.com/storage/v1/b/BUCKET_NAME/restore?generation=GENERATION"
```

### Méthode 4 : Via l'API REST directement

Si vous connaissez la génération du bucket :

```bash
# 1. Obtenir le token
gcloud auth print-access-token > /tmp/token.txt

# 2. Restaurer (remplacez les valeurs)
curl -X POST \
  -H "Authorization: Bearer $(cat /tmp/token.txt)" \
  "https://storage.googleapis.com/storage/v1/b/jsaas-dd2f7.firebasestorage.app/restore?generation=1234567890"
```

## 📝 Noms de buckets possibles pour votre projet

D'après votre configuration Firebase (`jsaas-dd2f7`), les buckets possibles sont :

1. `jsaas-dd2f7.firebasestorage.app` (bucket Firebase Storage par défaut)
2. `jsaas-dd2f7.appspot.com` (bucket App Engine par défaut)

## ⚠️ Erreurs courantes

### Erreur 404 : Bucket non trouvé
- Le bucket peut être définitivement supprimé (après 7 jours)
- Vérifiez le nom exact du bucket
- Vérifiez que vous êtes dans le bon projet Google Cloud

### Erreur 403 : Permission refusée
- Vérifiez que vous avez la permission `storage.buckets.restore`
- Vérifiez que vous êtes connecté avec le bon compte
- Vérifiez les rôles IAM dans Google Cloud Console

### Erreur : Génération non trouvée
- Fournissez la génération manuellement
- Vous pouvez la trouver dans la console Google Cloud
- Ou utilisez `gcloud storage buckets list` avec les filtres appropriés

## 🔄 Après la restauration

Une fois le bucket restauré :

1. **Vérifier la restauration** :
   ```bash
   gcloud storage buckets list --filter="name:jsaas-dd2f7"
   ```

2. **Restaurer les objets** (si nécessaire) :
   - Les objets ne sont pas automatiquement restaurés
   - Utilisez `Objects: restore` ou `Objects: bulkRestore` pour restaurer les fichiers

3. **Vérifier dans Firebase Console** :
   - Allez dans Firebase Console → Storage
   - Vérifiez que le bucket apparaît dans la liste

## 📚 Références

- [Documentation Google Cloud Storage - Restore Bucket](https://cloud.google.com/storage/docs/json_api/v1/buckets/restore)
- [Documentation Firebase Storage](https://firebase.google.com/docs/storage)

## 💡 Astuce

Si vous ne connaissez pas le nom exact du bucket, vous pouvez lister tous les buckets supprimés :

```bash
gcloud storage buckets list --filter="lifecycleState:DELETE_REQUESTED" --format="json" | jq '.[] | {name: .name, deleted: .timeDeleted, generation: .metadata.generation}'
```

