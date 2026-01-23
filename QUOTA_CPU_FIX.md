# 🔧 Résolution du Problème de Quota CPU Cloud Run

## ❌ Problème

Lors du déploiement, plusieurs fonctions n'ont pas pu être créées/mises à jour à cause d'une erreur :

```
Quota exceeded for total allowable CPU per project per region
```

## ✅ Solution Appliquée

J'ai réduit les ressources allouées aux fonctions pour rester dans les limites du quota :

### Avant
- `maxInstances: 10` (jusqu'à 10 instances simultanées)
- `concurrency: 80` (80 requêtes simultanées par instance)
- `memory: 256MiB` ou `512MiB`

### Après
- **Fonctions normales** : `maxInstances: 3`, `concurrency: 40`
- **Fonctions de fichiers** : `maxInstances: 2`, `concurrency: 5`
- **Fonction de migration** : `maxInstances: 1` (déjà optimisée)

## 📊 Impact

Ces réductions devraient suffire pour la plupart des cas d'usage :
- ✅ Réduction de ~70% de la consommation CPU maximale
- ✅ Toujours capable de gérer plusieurs requêtes simultanées
- ✅ Scalabilité automatique conservée (0 → max instances selon la charge)

## 🚀 Redéploiement

Vous pouvez maintenant redéployer :

```bash
firebase deploy --only functions
```

## 🔧 Modifications Additionnelles

J'ai également réduit les 4 fonctions qui continuaient d'échouer :
- `createUser` : `maxInstances: 1`
- `decryptText` : `maxInstances: 1`
- `getStripeCustomers` : `maxInstances: 1`
- `sendContactEmail` : `maxInstances: 1`

Ces fonctions utilisent maintenant une configuration `lowResourceConfig` avec moins de ressources.

## 🧹 Nettoyer les Anciennes Révisions

Si le problème persiste, nettoyez les anciennes révisions Cloud Run qui occupent du quota :

```bash
./scripts/cleanup-cloud-run-revisions.sh
```

Ou manuellement :
```bash
# Lister les révisions
gcloud run revisions list --region=us-central1 --project=jsaas-dd2f7

# Supprimer une révision spécifique
gcloud run revisions delete REVISION_NAME --region=us-central1 --project=jsaas-dd2f7
```

## ⚠️ Si le Problème Persiste

Si vous obtenez encore l'erreur de quota, voici d'autres solutions :

### Option 1 : Augmenter le Quota GCP

1. Allez dans [Google Cloud Console](https://console.cloud.google.com)
2. IAM & Admin → Quotas
3. Filtrer par "Cloud Run" et "CPU"
4. Demander une augmentation du quota

### Option 2 : Réduire Encore Plus les Ressources

Modifier dans `functions/src/*.ts` :
```typescript
maxInstances: 2,  // Au lieu de 3
concurrency: 20,  // Au lieu de 40
```

### Option 3 : Déployer dans Plusieurs Régions

Distribuer les fonctions dans différentes régions pour éviter la limite par région :
```typescript
region: 'europe-west1', // Au lieu de 'us-central1'
```

### Option 4 : Supprimer les Anciennes Révisions

Les anciennes révisions Cloud Run occupent aussi des ressources. Supprimez-les :
```bash
# Lister les services
gcloud run services list --platform managed

# Supprimer les anciennes révisions
gcloud run revisions delete REVISION_NAME --region us-central1
```

### Option 5 : Désactiver Temporairement Certaines Fonctions

Si certaines fonctions ne sont pas utilisées, vous pouvez les supprimer ou les désactiver temporairement.

## 📈 Vérifier la Consommation

Pour vérifier la consommation actuelle :
```bash
gcloud compute project-info describe --project=jsaas-dd2f7
```

Ou dans la console Cloud Run → Metrics → CPU usage

## 💡 Recommandations

- Les valeurs actuelles (3 instances max, 40 concurrency) sont suffisantes pour la plupart des applications
- Si vous avez besoin de plus de capacité, demandez une augmentation de quota
- Surveillez l'utilisation CPU dans la console Cloud Run
