# Configuration Firebase - Résolution des erreurs

## Problèmes identifiés

Votre application affiche actuellement ces erreurs :
- `Firebase Storage non disponible`
- `Firebase Functions non disponible`
- `No order found for study`

## Solutions

### 1. Configuration Firebase

Les erreurs de services Firebase indiquent que vos variables d'environnement ne sont pas configurées.

#### Étape 1 : Créer le fichier .env
```bash
# À la racine de votre projet
cp firebase.config.example.js .env
```

#### Étape 2 : Remplir les variables
Ouvrez le fichier `.env` et remplacez les valeurs par vos vraies clés Firebase :

```env
VITE_FIREBASE_API_KEY=AIzaSyC...votre-vraie-clé
VITE_FIREBASE_AUTH_DOMAIN=jsaas-dd2f7.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=jsaas-dd2f7
VITE_FIREBASE_STORAGE_BUCKET=jsaas-dd2f7.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_STRIPE_PUBLIC_KEY=pk_test_...votre-clé-stripe
```

#### Étape 3 : Trouver vos clés Firebase
1. Allez sur [console.firebase.google.com](https://console.firebase.google.com)
2. Sélectionnez votre projet `jsaas-dd2f7`
3. Cliquez sur l'icône ⚙️ (Paramètres) → Paramètres du projet
4. Dans l'onglet "Général", faites défiler jusqu'à "Vos applications"
5. Copiez les valeurs de votre application web

### 2. Redémarrer le serveur

Après avoir créé le fichier `.env`, redémarrez votre serveur de développement :

```bash
npm run dev
# ou
yarn dev
```

### 3. Vérification

Une fois configuré, vous devriez voir dans la console :
```
Firebase Storage initialisé avec succès
Firebase Functions initialisé avec succès
```

## Avertissement "No order found for study"

Cet avertissement est **normal** pour les études qui n'ont pas encore de commande. Il a été converti en log informatif pour réduire le bruit de la console.

## Erreur React PDF

L'erreur "Invalid '' string child outside <Text> component" indique un problème avec la génération de PDF. Cela se produit généralement quand :
- Des chaînes vides sont passées directement dans des composants PDF
- Des valeurs undefined sont utilisées dans le rendu PDF

Cette erreur sera résolue une fois que les services Firebase seront correctement configurés.

## Support

Si les problèmes persistent après cette configuration :
1. Vérifiez que votre projet Firebase a bien les services Storage et Functions activés
2. Vérifiez que vos règles de sécurité permettent l'accès
3. Consultez la console Firebase pour d'autres erreurs




