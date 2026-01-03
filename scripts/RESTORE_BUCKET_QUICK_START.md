# 🚀 Guide rapide : Restaurer un bucket Firebase Storage supprimé

## ⚡ Méthode la plus rapide (Sans installation)

### Étape 1 : Obtenir un token OAuth 2.0

1. Allez sur [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Dans la section **"Step 1"**, recherchez et sélectionnez :
   - `https://www.googleapis.com/auth/cloud-platform`
3. Cliquez sur **"Authorize APIs"**
4. Connectez-vous avec votre compte Google (celui qui a accès au projet `jsaas-dd2f7`)
5. Acceptez les permissions
6. Dans **"Step 2"**, cliquez sur **"Exchange authorization code for tokens"**
7. **Copiez le "Access token"** (il expire après 1 heure)

### Étape 2 : Trouver la génération du bucket

**Option A : Via Google Cloud Console** (Recommandé)

1. Allez sur [Google Cloud Console - Storage](https://console.cloud.google.com/storage/browser?project=jsaas-dd2f7)
2. Cliquez sur **"Buckets"** dans le menu latéral
3. Cherchez **"Buckets supprimés"** ou **"Deleted buckets"**
4. Trouvez votre bucket `jsaas-dd2f7.firebasestorage.app`
5. **Notez la génération** (un nombre long, ex: `1234567890123456`)

**Option B : Via curl** (si vous avez le token)

```bash
# Remplacez YOUR_TOKEN par le token obtenu à l'étape 1
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://storage.googleapis.com/storage/v1/b?project=jsaas-dd2f7" | \
  jq '.items[] | select(.lifecycleState=="DELETE_REQUESTED") | {name: .name, generation: .generation}'
```

### Étape 3 : Restaurer le bucket

**Méthode 1 : Via curl** (La plus simple)

```bash
# Remplacez YOUR_TOKEN et GENERATION par les valeurs réelles
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  "https://storage.googleapis.com/storage/v1/b/jsaas-dd2f7.firebasestorage.app/restore?generation=GENERATION"
```

**Méthode 2 : Via le script Node.js**

```bash
# 1. Créer un fichier avec le token
echo "YOUR_TOKEN" > .google-cloud-token

# 2. Exécuter le script (remplacez GENERATION par la génération réelle)
node scripts/restore-bucket.mjs jsaas-dd2f7.firebasestorage.app GENERATION
```

**Méthode 3 : Via variable d'environnement**

```bash
# Définir le token
export GOOGLE_CLOUD_TOKEN="YOUR_TOKEN"

# Exécuter le script
node scripts/restore-bucket.mjs jsaas-dd2f7.firebasestorage.app GENERATION
```

## 📋 Exemple complet

```bash
# 1. Obtenir un token depuis OAuth 2.0 Playground
#    (voir étape 1 ci-dessus)

# 2. Créer un fichier avec le token
echo "ya29.a0AfH6SMC..." > .google-cloud-token

# 3. Exécuter le script avec le nom du bucket et la génération
node scripts/restore-bucket.mjs jsaas-dd2f7.firebasestorage.app 1234567890123456
```

## ⚠️ Important

- ⏰ Les buckets supprimés peuvent être restaurés **pendant 7 jours** après la suppression
- 🗑️ Après 7 jours, la suppression est **définitive**
- 🔐 Le token expire après **1 heure**, vous devrez peut-être en obtenir un nouveau
- 📦 Les objets (fichiers) dans le bucket ne sont **pas automatiquement restaurés**
- 🔒 Ne commitez **jamais** le fichier `.google-cloud-token` dans Git

## 🆘 Problèmes courants

### Erreur 403 : Permission refusée
- Vérifiez que vous utilisez le bon compte Google
- Vérifiez que vous avez la permission `storage.buckets.restore`
- Vérifiez que le token est valide (pas expiré)

### Erreur 404 : Bucket non trouvé
- Vérifiez le nom exact du bucket
- Vérifiez que la génération est correcte
- Vérifiez que le bucket a été supprimé il y a moins de 7 jours

### Token expiré
- Les tokens OAuth expirent après 1 heure
- Obtenez un nouveau token depuis OAuth 2.0 Playground
- Ou installez gcloud CLI pour des tokens automatiques

## 🔄 Après la restauration

Une fois le bucket restauré :

1. **Vérifier dans Firebase Console** :
   - Allez sur [Firebase Console - Storage](https://console.firebase.google.com/project/jsaas-dd2f7/storage)
   - Vérifiez que le bucket apparaît dans la liste

2. **Restaurer les objets** (si nécessaire) :
   - Les objets ne sont pas automatiquement restaurés
   - Utilisez l'API `Objects: restore` ou `Objects: bulkRestore` pour restaurer les fichiers

## 📚 Références

- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
- [Google Cloud Console - Storage](https://console.cloud.google.com/storage/browser?project=jsaas-dd2f7)
- [Documentation API REST - Restore Bucket](https://cloud.google.com/storage/docs/json_api/v1/buckets/restore)






