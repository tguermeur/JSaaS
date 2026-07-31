# Guide de Déploiement et de Test - Mise à jour Sécurité

Ce guide détaille les étapes pour déployer les correctifs de sécurité et valider leur bon fonctionnement.

## 1. Déploiement

Exécutez les commandes suivantes dans votre terminal à la racine du projet :

### Déployer les règles de sécurité (Critique)
Ces commandes appliquent les nouvelles restrictions sur la base de données et le stockage.

```bash
# Déployer les règles Firestore
firebase deploy --only firestore:rules

# Déployer les règles Storage
firebase deploy --only storage
```

### Déployer les Cloud Functions
Cette étape déploie la nouvelle fonction `sendContactEmail` pour sécuriser l'envoi d'emails.

```bash
# Déployer les fonctions
firebase deploy --only functions
```

## 2. Tests de Validation (Après déploiement)

### Test A : Vérification des Règles Storage
1. Connectez-vous avec un compte utilisateur standard (non-admin).
2. Essayez d'accéder à un fichier sensible d'une autre structure (via URL directe si vous en aviez une, ou via l'interface).
   👉 **Résultat attendu** : Accès refusé (Erreur permission denied).
3. Essayez d'uploader un fichier dans votre propre dossier mission.
   👉 **Résultat attendu** : Succès.

### Test B : Vérification des Règles Firestore
1. Vérifiez que l'application fonctionne normalement pour vos données.
2. Si vous savez utiliser la console développeur du navigateur, essayez de lire une collection entière (ex: `await firebase.firestore().collection('users').get()`).
   👉 **Résultat attendu** : Échec (Permission denied) car la règle `allow list` globale a été retirée.

### Test C : Formulaire de Contact (Email sécurisé)
1. Allez sur la page d'accueil (Home).
2. Remplissez le formulaire de contact en bas de page.
3. Cliquez sur "Demander une démo".
   👉 **Résultat attendu** : 
   - Le message de succès "Votre demande a été envoyée avec succès !" apparaît.
   - Vous recevez l'email sur `teo.guermeur@gmail.com`.
   - **Important** : Si cela échoue, vérifiez que vous avez bien configuré les variables d'environnement pour la fonction (voir ci-dessous).

### Configuration des Secrets (Si l'envoi d'email échoue)
Si l'envoi d'email échoue, c'est probablement car la fonction n'a pas accès à la clé privée EmailJS. Configurez-la via :

```bash
firebase functions:secrets:set EMAILJS_PRIVATE_KEY
# (Collez votre clé privée quand demandé)
```

Puis redéployez la fonction :
```bash
firebase deploy --only functions:sendContactEmail
```

## 3. Validation de la Migration SignUp
1. Déconnectez-vous.
2. Allez sur la page d'inscription `/register` (ou le lien d'inscription étudiant).
3. Tentez de créer un compte.
   👉 **Résultat attendu** : Création réussie et redirection.
   👉 **Test d'erreur** : Essayez avec des mots de passe différents ou un email invalide pour vérifier que les messages d'erreur s'affichent bien.


