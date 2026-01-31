# Solution pour l'erreur Eventarc lors du déploiement Firebase

## Problème
Erreur lors du déploiement : `Error generating the service identity for eventarc.googleapis.com`

Cette erreur apparaît quand Firebase/Google Cloud n’arrive pas à créer l’identité de service Eventarc (compte de service utilisé par les Cloud Functions v2).

## Solutions

### Solution 1 : Activer l’API Eventarc puis attendre (recommandé)

L’identité de service Eventarc est créée automatiquement lors de la première activation de l’API. Il faut parfois attendre quelques minutes après l’activation.

```bash
# 1. Activer l’API Eventarc (crée l’identité de service)
gcloud services enable eventarc.googleapis.com --project=jsaas-dd2f7

# 2. Activer les APIs requises par Eventarc / Functions v2
gcloud services enable pubsub.googleapis.com --project=jsaas-dd2f7
gcloud services enable run.googleapis.com --project=jsaas-dd2f7
gcloud services enable cloudbuild.googleapis.com --project=jsaas-dd2f7
gcloud services enable artifactregistry.googleapis.com --project=jsaas-dd2f7

# 3. Attendre 5 à 10 minutes que l’identité soit propagée, puis redéployer
firebase deploy
```

Si vous préférez passer par la console : [Google Cloud Console – APIs & Services](https://console.cloud.google.com/apis/library?project=jsaas-dd2f7) → rechercher « Eventarc » → Activer.

### Solution 2 : Réessayer le déploiement
Parfois l’identité existe déjà mais n’était pas encore visible. Réessayer :

```bash
firebase deploy
```

Ou déployer uniquement les functions après avoir activé les APIs :

```bash
firebase deploy --only functions
```

### Solution 3 : Vérifier l’identité de service Eventarc (IAM)

Dans [Google Cloud Console – IAM](https://console.cloud.google.com/iam-admin/iam?project=jsaas-dd2f7) :

1. Activer **« Inclure les accords de rôles fournis par Google »**.
2. Vérifier la présence du compte :  
   `service-PROJECT_NUMBER@gcp-sa-eventarc.iam.gserviceaccount.com`  
   (remplacer `PROJECT_NUMBER` par le numéro du projet, visible dans les paramètres du projet).
3. Si ce compte n’apparaît pas : réactiver l’API Eventarc (Solution 1), attendre 5–10 min, puis rafraîchir la page IAM.

### Solution 4 : Donner le rôle Eventarc Admin à votre compte

L’erreur peut venir du fait que votre compte n’a pas le droit de **créer** l’identité de service Eventarc. Ajoutez le rôle **Eventarc Admin** :

```bash
# Récupérer votre email (compte gcloud actuel)
gcloud config get-value account

# Vous devez être Propriétaire ou avoir les droits pour modifier l’IAM.
# Ajouter le rôle Eventarc Admin à votre compte (remplacez VOTRE_EMAIL@... par le résultat ci‑dessus)
gcloud projects add-iam-policy-binding jsaas-dd2f7 \
  --member="user:VOTRE_EMAIL@exemple.com" \
  --role="roles/eventarc.admin"
```

Ou en une ligne avec l’email détecté automatiquement :

```bash
gcloud projects add-iam-policy-binding jsaas-dd2f7 --member="user:$(gcloud config get-value account)" --role="roles/eventarc.admin"
```

Ensuite, réessayez :

```bash
firebase deploy
```

### Solution 5 : Déclencher la création via la console Eventarc

Parfois l’identité est créée au premier usage d’Eventarc dans la console :

1. Ouvrir : [Eventarc – Google Cloud Console](https://console.cloud.google.com/eventarc?project=jsaas-dd2f7)
2. Accepter l’activation de l’API si demandé.
3. Attendre 2–5 minutes.
4. Relancer : `firebase deploy --only functions`

### Solution 6 : Vérifier les permissions IAM de votre compte

Assurez-vous d'être connecté avec un compte ayant les permissions de **Propriétaire** ou **Éditeur** du projet :

```bash
# Vérifier le compte actuel
gcloud auth list

# Vérifier les permissions du projet
gcloud projects get-iam-policy jsaas-dd2f7
```

### Solution 7 : Déployer sans les Functions (contournement)

Pour déployer tout sauf les Functions (Firestore, Storage, Hosting) pendant que vous corrigez Eventarc :

```bash
# Déployer Firestore, Storage et Hosting (sans Functions)
firebase deploy --only firestore,storage,hosting
```

Quand l’identité Eventarc sera créée (Solutions 4 ou 5), déployer les Functions :

```bash
firebase deploy --only functions
```

### Solution 8 : Vérifier le compte de service par défaut

Si le compte de service par défaut est désactivé, réactivez-le :

```bash
# Lister les comptes de service
gcloud iam service-accounts list --project=jsaas-dd2f7

# Le compte par défaut devrait être : PROJECT_NUMBER-compute@developer.gserviceaccount.com
```

## Vérification post-déploiement

Après un déploiement réussi, vérifiez que les fonctions sont bien déployées :

```bash
firebase functions:list
```

## Note importante

Les fonctions v2 utilisent Eventarc pour les triggers Firestore (comme `syncUserClaims` dans `userSync.ts`). 
C'est pourquoi cette API est nécessaire.
