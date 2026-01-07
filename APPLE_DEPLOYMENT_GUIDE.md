# 🍎 Guide de Déploiement Apple Developer

## 📋 Prérequis

### 1. Compte Apple Developer
- [ ] Compte Apple Developer actif (99$/an)
- [ ] Accès à [developer.apple.com](https://developer.apple.com)

### 2. Environnement de développement
- [ ] Mac avec macOS récent
- [ ] Xcode installé (dernière version)
- [ ] Node.js et npm installés

## 🚀 Méthode 1 : Capacitor (Recommandé)

### Étape 1 : Initialisation Capacitor
```bash
# Installer les dépendances
npm install

# Initialiser Capacitor
npm run capacitor:init

# Ajouter la plateforme iOS
npm run capacitor:add-ios
```

### Étape 2 : Configuration Capacitor
Créer le fichier `capacitor.config.ts` :
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jsconnect.jsaas',
  appName: 'JS Connect',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  ios: {
    scheme: 'JSConnect'
  }
};

export default config;
```

### Étape 3 : Build et déploiement
```bash
# Build de l'application
npm run capacitor:build

# Synchroniser avec iOS
npm run capacitor:sync

# Ouvrir dans Xcode
npm run capacitor:open-ios
```

## 🏗️ Méthode 2 : React Native

### Étape 1 : Création du projet React Native
```bash
# Créer le projet React Native
npm run ios:setup

# Copier les composants existants
# (Manuel - adapter les composants React vers React Native)
```

### Étape 2 : Configuration iOS
```bash
# Installer les dépendances iOS
cd JSConnectiOS
npx pod-install

# Lancer sur simulateur
npm run ios:run
```

## 🍎 Configuration Apple Developer

### 1. Créer un App ID
1. Aller sur [developer.apple.com](https://developer.apple.com)
2. Certificates, Identifiers & Profiles → Identifiers
3. "+" → App IDs → App
4. Remplir :
   - Description : JS Connect - Plateforme SaaS
   - Bundle ID : `com.jsconnect.jsaas`
   - Capabilities : Push Notifications, Associated Domains

### 2. Créer un certificat de développement
1. Certificates → "+" → iOS App Development
2. Créer un CSR avec Keychain Access
3. Télécharger et installer le certificat

### 3. Créer un profil de provisionnement
1. Profiles → "+" → iOS App Development
2. Sélectionner l'App ID créé
3. Sélectionner le certificat
4. Ajouter les appareils de test
5. Télécharger le profil

### 4. Configuration Xcode
1. Ouvrir le projet dans Xcode
2. Sélectionner le target
3. Signing & Capabilities :
   - Team : Votre équipe Apple Developer
   - Bundle Identifier : `com.jsconnect.jsaas`
   - Provisioning Profile : Sélectionner le profil créé

## 📱 Test et Distribution

### Test sur appareil
1. Connecter un iPhone/iPad
2. Dans Xcode : Product → Run
3. L'app s'installe sur l'appareil

### Distribution TestFlight
1. Dans Xcode : Product → Archive
2. Organizer → Distribute App
3. App Store Connect
4. Créer une nouvelle version
5. Uploader le build
6. Ajouter les testeurs

### Distribution App Store
1. Préparer les métadonnées :
   - Screenshots (6.5", 5.5", 12.9")
   - Description
   - Mots-clés
   - Icône 1024x1024
2. Soumettre pour review
3. Publication automatique après approbation

## 🔧 Configuration spécifique

### Firebase pour iOS
```bash
# Installer Firebase iOS SDK
cd ios
pod install Firebase/Auth Firebase/Firestore Firebase/Storage
```

### Push Notifications
1. Dans Apple Developer : Certificats APNs
2. Dans Xcode : Capabilities → Push Notifications
3. Configuration Firebase Cloud Messaging

### Permissions iOS
Ajouter dans `Info.plist` :
```xml
<key>NSCameraUsageDescription</key>
<string>JS Connect a besoin d'accéder à la caméra pour scanner les QR codes</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>JS Connect a besoin d'accéder à vos photos pour importer des documents</string>
```

## 🚨 Problèmes courants

### Erreur de signature
- Vérifier le certificat et le profil de provisionnement
- Nettoyer le projet : Product → Clean Build Folder

### Erreur de bundle ID
- Vérifier la cohérence entre Xcode et Apple Developer
- Utiliser le même bundle ID partout

### Erreur de permissions
- Vérifier les permissions dans Info.plist
- Tester sur appareil physique

## 📞 Support

- [Documentation Apple Developer](https://developer.apple.com/documentation/)
- [Documentation Capacitor](https://capacitorjs.com/docs)
- [Documentation React Native](https://reactnative.dev/docs/getting-started)

