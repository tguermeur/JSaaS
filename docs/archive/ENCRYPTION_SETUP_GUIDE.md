# 🔐 Guide de Configuration du Chiffrement des Données

Ce guide explique comment configurer le chiffrement des données sensibles dans JSaaS.

## 📋 Vue d'ensemble

Le système de chiffrement utilise **AES-256-GCM** pour chiffrer :
- **Données sensibles des utilisateurs** : numéros de sécurité sociale, téléphones, adresses, etc.
- **Données des entreprises** : SIRET, TVA, adresses, téléphones
- **Données des contacts** : téléphones, emails
- **Fichiers uploadés** : CVs, documents de missions, photos de profil

---

## 🔑 Configuration de la Clé de Chiffrement

### 1. Générer une Clé de Chiffrement

La clé doit être une chaîne hexadécimale de **64 caractères** (32 bytes = 256 bits).

**Option A : Via Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option B : Via OpenSSL**
```bash
openssl rand -hex 32
```

**Exemple de sortie :**
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

⚠️ **IMPORTANT** : Sauvegardez cette clé dans un endroit sûr ! Si vous la perdez, toutes les données chiffrées seront **irrécupérables**.

### 2. Ajouter la Clé aux Secrets Firebase

```bash
# Depuis le répertoire du projet
firebase functions:secrets:set ENCRYPTION_KEY
```

Lorsque vous êtes invité, collez la clé générée.

### 3. Vérifier la Clé

```bash
firebase functions:secrets:access ENCRYPTION_KEY
```

---

## 📊 Données Sensibles Chiffrées

### Utilisateurs (`users`)
- `socialSecurityNumber` - Numéro de sécurité sociale
- `siret` - SIRET (pour entreprises dans users)
- `tvaIntra` - TVA Intracommunautaire
- `phone` - Téléphone
- `address` - Adresse
- `postalCode` - Code postal
- `birthPlace` - Lieu de naissance
- `studentId` - Numéro étudiant
- `twoFactorSecret` - Secret 2FA

### Entreprises (`companies`)
- `siret` / `nSiret` - Numéro SIRET
- `tvaIntra` - TVA Intracommunautaire
- `address` / `companyAddress` - Adresse
- `phone` - Téléphone

### Contacts (`contacts`)
- `phone` - Téléphone
- `email` - Email (optionnel selon contexte)

### Structures (`structures`)
- `siret` - Numéro SIRET
- `address` - Adresse
- `phone` - Téléphone

---

## 🔧 Utilisation des Fonctions de Chiffrement

### Chiffrer les Données Utilisateur

**Frontend :**
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const encryptUserData = httpsCallable(functions, 'encryptUserData');

// Avant de sauvegarder
const encrypted = await encryptUserData({
  userId: currentUser.uid,
  userData: {
    phone: '0123456789',
    address: '123 rue Example',
    socialSecurityNumber: '123456789012345',
    // ... autres champs sensibles
  }
});

// Sauvegarder encrypted.encryptedData dans Firestore
```

**Déchiffrer :**
```typescript
const decryptUserData = httpsCallable(functions, 'decryptUserData');

const result = await decryptUserData({ userId: currentUser.uid });
const decryptedData = result.data.decryptedData;
```

### Chiffrer les Fichiers

**1. Uploader un fichier normalement**

**2. Chiffrer après upload :**
```typescript
import { getAuth } from 'firebase/auth';
import axios from 'axios';

const user = getAuth().currentUser;
const token = await user?.getIdToken();

await axios.post(
  'https://us-central1-jsaas-dd2f7.cloudfunctions.net/encryptFile',
  { filePath: 'cvs/userId/document.pdf' },
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
```

**3. Télécharger un fichier chiffré :**
```typescript
const response = await axios.get(
  'https://us-central1-jsaas-dd2f7.cloudfunctions.net/decryptFile',
  {
    params: { filePath: 'cvs/userId/document.pdf' },
    headers: {
      'Authorization': `Bearer ${token}`
    },
    responseType: 'blob'
  }
);

// Le fichier est automatiquement déchiffré
const blob = new Blob([response.data]);
const url = URL.createObjectURL(blob);
```

---

## 🛡️ Fonctions Cloud Disponibles

### Chiffrement de Données

- `encryptUserData` - Chiffre les données utilisateur
- `decryptUserData` - Déchiffre les données utilisateur
- `encryptCompanyData` - Chiffre les données entreprise
- `decryptCompanyData` - Déchiffre les données entreprise
- `encryptContactData` - Chiffre les données contact
- `decryptContactData` - Déchiffre les données contact
- `encryptText` - Chiffre un texte arbitraire
- `decryptText` - Déchiffre un texte arbitraire

### Migration

- `migrateAllEncryption` - Migre toutes les données existantes (chiffre les anciennes données non chiffrées)
- `checkMigrationStatus` - Vérifie le statut de la migration (combien de documents sont chiffrés)

### Chiffrement de Fichiers

- `encryptFile` (HTTP) - Chiffre un fichier dans Storage
- `decryptFile` (HTTP) - Déchiffre et télécharge un fichier
- `isFileEncrypted` - Vérifie si un fichier est chiffré

---

## 🔄 Migration des Données Existantes

Si vous avez déjà des données non chiffrées, vous pouvez utiliser les fonctions de migration intégrées.

### 1. Vérifier le Statut Avant Migration

Avant de lancer la migration, vérifiez combien de documents doivent être chiffrés :

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const checkMigrationStatus = httpsCallable(functions, 'checkMigrationStatus');

// Vérifier le statut pour chaque collection
const usersStatus = await checkMigrationStatus({ collectionName: 'users' });
const companiesStatus = await checkMigrationStatus({ collectionName: 'companies' });
const contactsStatus = await checkMigrationStatus({ collectionName: 'contacts' });

console.log('Statut users:', usersStatus.data);
console.log('Statut companies:', companiesStatus.data);
console.log('Statut contacts:', contactsStatus.data);
```

**Réponse exemple :**
```json
{
  "success": true,
  "collection": "users",
  "stats": {
    "total": 1250,
    "hasSensitiveFields": 890,
    "encrypted": 0,
    "notEncrypted": 890,
    "percentageEncrypted": "0.00",
    "percentageNotEncrypted": "100.00"
  }
}
```

### 2. Lancer la Migration

**⚠️ IMPORTANT :** Seuls les superadmins peuvent lancer la migration.

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const migrateAllEncryption = httpsCallable(functions, 'migrateAllEncryption');

try {
  console.log('🚀 Lancement de la migration...');
  
  // Lancer la migration de toutes les collections par défaut
  const result = await migrateAllEncryption({});
  
  console.log('✅ Migration terminée !');
  console.log('📊 Statistiques:', result.data.stats);
  
  // Afficher le résumé
  const stats = result.data.stats;
  alert(`
Migration terminée !

Total documents traités: ${stats.total}
Documents chiffrés: ${stats.encrypted}
Documents ignorés (déjà chiffrés): ${stats.skipped}
Erreurs: ${stats.errors}

Collections:
${Object.entries(stats.collections).map(([name, coll]) => 
  `- ${name}: ${coll.encrypted} chiffrés, ${coll.skipped} ignorés, ${coll.errors} erreurs`
).join('\n')}
  `);
  
} catch (error: any) {
  console.error('❌ Erreur lors de la migration:', error);
  alert(`Erreur: ${error.message}`);
}
```

**Migration personnalisée :**

Si vous voulez migrer seulement certaines collections :

```typescript
const result = await migrateAllEncryption({
  collections: [
    { name: 'users', fields: ['phone', 'address', 'socialSecurityNumber'] },
    { name: 'companies', fields: ['siret', 'tvaIntra'] },
  ]
});
```

### 3. Vérifier le Statut Après Migration

Après la migration, vérifiez que tout s'est bien passé :

```typescript
const usersStatus = await checkMigrationStatus({ collectionName: 'users' });
console.log('Statut après migration:', usersStatus.data.stats);
// Devrait montrer percentageEncrypted proche de 100%
```

### 4. Comportement de la Migration

- ✅ **Ne chiffre que les données non chiffrées** : Les données déjà chiffrées (avec préfixe `ENC:`) sont ignorées
- ✅ **Pagination automatique** : Traite les collections par lots de 100 documents
- ✅ **Batch processing** : Utilise les batches Firestore (max 500 opérations par batch)
- ✅ **Gestion d'erreurs** : Continue même si un document échoue
- ✅ **Rapport détaillé** : Retourne des statistiques pour chaque collection

### 5. Chiffrer les Fichiers Existants

Pour chiffrer les fichiers existants dans Storage, utilisez la fonction `encryptFile` :

```typescript
// Pour chaque fichier à chiffrer
const token = await currentUser.getIdToken();

await axios.post(
  'https://us-central1-jsaas-dd2f7.cloudfunctions.net/encryptFile',
  { filePath: 'cvs/userId/document.pdf' },
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
```

**Note :** Pour chiffrer tous les fichiers existants, vous devrez créer un script qui liste tous les fichiers et les chiffre un par un.

---

## ⚠️ Points d'Attention

1. **Sauvegarde de la Clé** : La clé doit être sauvegardée en plusieurs endroits sécurisés. Si elle est perdue, les données sont irrécupérables.

2. **Rotation de Clé** : Pour changer la clé de chiffrement, il faut :
   - Déchiffrer toutes les données avec l'ancienne clé
   - Chiffrer avec la nouvelle clé
   - Mettre à jour le secret Firebase

3. **Performance** : Le chiffrement ajoute une petite latence. Pour les gros fichiers, cela peut prendre quelques secondes.

4. **Compatibilité** : Les données chiffrées commencent par `ENC:`. Les fonctions vérifient automatiquement ce préfixe.

5. **Erreurs** : En cas d'erreur de déchiffrement (clé incorrecte, données corrompues), les fonctions retournent une erreur mais ne plantent pas l'application.

---

## 🧪 Tests

Pour tester le chiffrement localement :

```bash
cd functions
npm run build
firebase emulators:start
```

Ensuite, testez les fonctions via l'interface Firebase Emulator ou avec des appels HTTP.

---

## 📚 Références

- [Firebase Secrets Manager](https://firebase.google.com/docs/functions/config-env)
- [AES-GCM Encryption](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)

---

## 🔒 Sécurité

- ✅ AES-256-GCM (chiffrement authentifié)
- ✅ IV unique pour chaque chiffrement
- ✅ Clé stockée dans Firebase Secrets Manager
- ✅ Tag d'authentification pour détecter les modifications
- ✅ Préfixe `ENC:` pour identifier les données chiffrées

**Note** : Ce système assure la confidentialité des données au repos. Pour la transmission, HTTPS est déjà en place via Firebase.
