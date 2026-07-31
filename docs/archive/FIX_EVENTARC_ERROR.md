# 🔧 Correction de l'erreur Eventarc

## Problème

L'erreur `Error generating the service identity for eventarc.googleapis.com` survient lors du déploiement des Firebase Functions v2.

Les fonctions v2 utilisent Eventarc pour gérer les événements, mais cette API n'est pas activée par défaut.

## Solution 1 : Script automatique (Recommandé)

Exécutez le script qui active toutes les APIs nécessaires :

```bash
./scripts/fix-eventarc-error.sh
```

Puis attendez 1-2 minutes et redéployez :

```bash
firebase deploy --only functions
```

## Solution 2 : Via la Console Google Cloud

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez le projet `jsaas-dd2f7`
3. Allez dans **APIs & Services > Library**
4. Recherchez et activez ces APIs :
   - **Eventarc API**
   - **Cloud Run API**
   - **Pub/Sub API**
   - **Cloud Functions API**
   - **Cloud Build API**
   - **Artifact Registry API**

## Solution 3 : Via Firebase CLI (si gcloud est configuré)

Si vous avez `gcloud` CLI installé et authentifié :

```bash
gcloud services enable eventarc.googleapis.com --project=jsaas-dd2f7
gcloud services enable run.googleapis.com --project=jsaas-dd2f7
gcloud services enable pubsub.googleapis.com --project=jsaas-dd2f7
gcloud services enable cloudfunctions.googleapis.com --project=jsaas-dd2f7
gcloud services enable cloudbuild.googleapis.com --project=jsaas-dd2f7
gcloud services enable artifactregistry.googleapis.com --project=jsaas-dd2f7
```

## Vérification

Après activation, attendez 1-2 minutes puis vérifiez :

```bash
firebase deploy --only functions
```

## Notes

- Les APIs peuvent prendre 1-2 minutes pour être complètement activées
- Assurez-vous d'être connecté à Firebase : `firebase login`
- Si vous n'avez pas les permissions, contactez l'administrateur du projet Google Cloud
