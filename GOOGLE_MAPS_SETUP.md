# Configuration Google Maps pour les Ambassadeurs

## ⚠️ IMPORTANT : APIs à activer

Pour que l'autocomplétion d'adresse fonctionne, vous devez activer **DEUX APIs** dans Google Cloud Console :

1. **Maps JavaScript API** (OBLIGATOIRE)
2. **Places API** (OBLIGATOIRE)

### Pourquoi les deux ?

L'autocomplétion Places nécessite la bibliothèque JavaScript de Google Maps pour fonctionner. Même si vous restreignez votre clé API à Places API uniquement, vous devez quand même activer Maps JavaScript API.

## Configuration requise

### 1. Activer les APIs dans Google Cloud Console

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez votre projet
3. Allez dans **APIs & Services** > **Library**
4. Recherchez et activez **Maps JavaScript API**
5. Recherchez et activez **Places API**
6. Attendez quelques minutes pour que les APIs soient activées

### 2. Configurer la clé API

1. Allez dans **APIs & Services** > **Credentials**
2. Cliquez sur votre clé API (ou créez-en une nouvelle)
3. Dans **API restrictions**, sélectionnez **Restrict key**
4. Sélectionnez **Maps JavaScript API** et **Places API**
5. Dans **Application restrictions**, vous pouvez restreindre par :
   - **HTTP referrers** pour le web :
     - `http://localhost:3006/*` (développement)
     - `https://votre-domaine.com/*` (production)
6. Cliquez sur **Enregistrer**

### 3. Configurer la clé dans votre projet

Ajoutez la clé API dans votre fichier `.env` :

```bash
VITE_GOOGLE_MAPS_API_KEY=votre_cle_api_ici
```

### 4. Redémarrer le serveur

Après avoir ajouté la clé dans `.env`, redémarrez votre serveur de développement :

```bash
npm run dev
```

## Fonctionnalités

Une fois configuré, le champ "Lieu" dans le formulaire de création d'événement :
- ✅ Propose des suggestions d'adresses en temps réel
- ✅ Récupère automatiquement les coordonnées GPS (latitude/longitude)
- ✅ Limite les suggestions aux adresses françaises
- ✅ Affiche un indicateur visuel lorsque les coordonnées sont récupérées

## Note

Si la clé API n'est pas configurée ou si les APIs ne sont pas activées, le champ fonctionnera toujours comme un champ texte normal, mais sans l'autocomplétion Google Maps.

## Erreurs courantes

### `ApiNotActivatedMapError`
**Solution** : Activez **Maps JavaScript API** en plus de Places API dans Google Cloud Console.

### `RefererNotAllowedMapError`
**Solution** : Ajoutez votre domaine dans les restrictions HTTP referrers de votre clé API.
