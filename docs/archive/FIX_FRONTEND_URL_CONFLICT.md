# 🔧 Correction du conflit FRONTEND_URL

## Problème

L'erreur `Secret environment variable overlaps non secret environment variable: FRONTEND_URL` signifie que `FRONTEND_URL` est défini à la fois comme :
- Un **secret** Firebase (dans Secret Manager)
- Une **variable d'environnement normale** (dans la configuration Cloud Run)

Firebase Functions v2 ne permet pas cette duplication.

## Solution appliquée

✅ **Code modifié** : `FRONTEND_URL` a été retiré de la liste des secrets dans `functions/src/index.ts`

`FRONTEND_URL` n'est pas une information sensible (c'est juste une URL publique), donc elle ne doit **pas** être un secret.

## Actions nécessaires

### 1. Supprimer le secret FRONTEND_URL (si il existe)

Si vous avez créé `FRONTEND_URL` comme secret, supprimez-le :

```bash
firebase functions:secrets:delete FRONTEND_URL
```

### 2. Définir FRONTEND_URL comme variable d'environnement normale

Option A : Via la Console Firebase (recommandé pour la production)

1. Allez sur [Firebase Console → Functions → Configuration](https://console.firebase.google.com/project/jsaas-dd2f7/functions/config)
2. Ajoutez une variable d'environnement :
   - **Nom** : `FRONTEND_URL`
   - **Valeur** : `http://js-connect.fr` (ou `https://js-connect.fr`)

Option B : Via la console Google Cloud

1. Allez sur [Cloud Run → Services](https://console.cloud.google.com/run?project=jsaas-dd2f7)
2. Sélectionnez chaque service (api, createUser, updateUserProfile, etc.)
3. Cliquez sur "Modifier et déployer une nouvelle révision"
4. Dans l'onglet "Variables et secrets", ajoutez :
   - **Nom** : `FRONTEND_URL`
   - **Valeur** : `http://js-connect.fr`

### 3. Redéployer

Après avoir supprimé le secret et défini la variable d'environnement :

```bash
firebase deploy --only functions
```

## Note

Pour le développement local, `FRONTEND_URL` peut être défini dans le fichier `.env` à la racine du projet (chargé automatiquement par `dotenv`).
