# Guide de diagnostic pour l'erreur d'upload de documents

## Erreur rencontrée
```
FirebaseError: Firebase Storage: User does not have permission to access 'missions/{missionId}/documents/{fileName}'. (storage/unauthorized)
```

## Causes possibles

### 1. **L'utilisateur n'appartient pas à la même structure que la mission**
Les règles de sécurité Firebase Storage vérifient que :
- `userData.structureId == missionData.structureId`

### 2. **Le fichier contient des caractères spéciaux**
Le nom du fichier `F-251112[7302].pdf` contient des crochets `[]` qui peuvent causer des problèmes.
→ **✅ Corrigé** : Les caractères spéciaux sont maintenant nettoyés automatiquement.

### 3. **Données utilisateur manquantes dans Firestore**
L'utilisateur doit avoir dans son document Firestore :
- `structureId` : ID de la structure
- `status` : 'admin', 'member', 'superadmin', etc.

## Solution implémentée

### 1. Nettoyage du nom de fichier
```typescript
const cleanFileName = file.name
  .replace(/[[\]]/g, '_')  // Remplacer les crochets
  .replace(/[<>:"/\\|?*]/g, '_');  // Autres caractères problématiques
```

### 2. Vérification des permissions avant upload
Le code vérifie maintenant :
- Que l'utilisateur est authentifié
- Que l'utilisateur a un `structureId`
- Que la mission a un `structureId`
- Que les deux correspondent (sauf pour les superadmin)

### 3. Messages d'erreur détaillés
Les erreurs affichent maintenant des messages clairs sur ce qui ne va pas.

## Logs de debugging

Ouvrez la console du navigateur et cherchez :
```
🔍 Debugging upload: {
  userId: "...",
  userStatus: "...",
  userStructureId: "...",
  missionId: "...",
  missionStructureId: "...",
  storagePath: "...",
  fileName: "..."
}
```

## Comment vérifier les données utilisateur dans Firestore

1. Aller dans Firebase Console → Firestore Database
2. Chercher le document `users/{userId}`
3. Vérifier que les champs suivants existent :
   - `structureId` : doit correspondre au `structureId` de la mission
   - `status` : 'admin', 'member', 'superadmin', etc.
   - `email` : email de l'utilisateur

## Comment vérifier les données de la mission

1. Aller dans Firebase Console → Firestore Database
2. Chercher le document `missions/{missionId}`
3. Vérifier que les champs suivants existent :
   - `structureId` : ID de la structure
   - `createdBy` : UID du créateur (optionnel)
   - `permissions.viewers` : tableau d'UIDs (optionnel)
   - `permissions.editors` : tableau d'UIDs (optionnel)

## Si le problème persiste

### Option 1 : Vérifier les règles Storage
Les règles Storage se trouvent dans `storage.rules`. Pour tester les permissions :
1. Firebase Console → Storage → Rules
2. Utiliser le simulateur de règles avec :
   - Opération : `create`
   - Chemin : `missions/{missionId}/documents/test.pdf`
   - Authentification : votre UID

### Option 2 : Redéployer les règles Storage
```bash
firebase deploy --only storage:rules
```

### Option 3 : Ajouter l'utilisateur aux permissions de la mission
Dans le code ou manuellement dans Firestore, ajouter l'UID dans :
```
missions/{missionId}/permissions/editors: [userId]
```

## Structure attendue dans Firestore

### Document utilisateur (`users/{userId}`)
```json
{
  "email": "user@example.com",
  "displayName": "John Doe",
  "status": "admin",
  "structureId": "abc123",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Document mission (`missions/{missionId}`)
```json
{
  "numeroMission": "M-2025-001",
  "title": "Ma mission",
  "structureId": "abc123",
  "createdBy": "userId123",
  "permissions": {
    "viewers": ["userId1", "userId2"],
    "editors": ["userId3", "userId4"]
  },
  "createdAt": "...",
  "updatedAt": "..."
}
```

## Tests à effectuer

1. **Test avec un fichier simple** : Essayez d'uploader un fichier nommé `test.pdf` (sans caractères spéciaux)
2. **Vérifier dans la console** : Les logs de debugging doivent afficher les bonnes valeurs
3. **Tester avec un autre utilisateur** : Vérifier que le problème est lié à l'utilisateur ou à la mission

