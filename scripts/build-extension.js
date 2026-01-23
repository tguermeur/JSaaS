import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Fonction pour charger les variables d'environnement depuis .env
function loadEnvFile(envPath) {
  const env = {};
  if (!existsSync(envPath)) {
    return env;
  }
  
  const content = readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Ignorer les lignes vides et les commentaires
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Retirer les guillemets si présents
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  }
  
  return env;
}

// Charger les variables d'environnement depuis .env
const envPath = join(__dirname, '..', '.env');
const envVars = loadEnvFile(envPath);

// Mettre à jour process.env avec les valeurs du fichier .env
Object.assign(process.env, envVars);

if (Object.keys(envVars).length > 0) {
  console.log(`✅ ${Object.keys(envVars).length} variables d'environnement chargées depuis .env`);
} else if (existsSync(envPath)) {
  console.warn('⚠️  Fichier .env trouvé mais vide ou sans variables valides');
} else {
  console.warn('⚠️  Fichier .env non trouvé, utilisation des variables d\'environnement système');
}

const extensionDir = 'dist/extension';
const publicExtensionDir = 'public/extension';
const srcExtensionDir = 'src/extension';

// Charger les variables d'environnement
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || '',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.VITE_FIREBASE_APP_ID || ''
};

// Créer les dossiers de destination s'ils n'existent pas
if (!existsSync(extensionDir)) {
  mkdirSync(extensionDir, { recursive: true });
}
if (!existsSync(publicExtensionDir)) {
  mkdirSync(publicExtensionDir, { recursive: true });
}

// Copier les fichiers nécessaires
const filesToCopy = [
  'manifest.json',
  'popup.html',
  'popup.css',
  'icon16.png',
  'icon32.png',
  'icon48.png',
  'icon128.png',
  'background.js',
  'content.js',
  'firebase-app-compat.js',
  'firebase-auth-compat.js',
  'firebase-firestore-compat.js'
];

// Copier les fichiers vers dist/extension et public/extension
filesToCopy.forEach(file => {
  const source = join(srcExtensionDir, file);
  const destination = join(extensionDir, file);
  const destinationPublic = join(publicExtensionDir, file);
  
  if (existsSync(source)) {
    copyFileSync(source, destination);
    copyFileSync(source, destinationPublic);
    console.log(`Copié: ${file}`);
  } else {
    console.warn(`Fichier non trouvé: ${file}`);
  }
});

// Traiter popup.js pour injecter la configuration Firebase
const popupSource = join(srcExtensionDir, 'popup.js');
const popupDest = join(extensionDir, 'popup.js');
const popupDestPublic = join(publicExtensionDir, 'popup.js');

if (existsSync(popupSource)) {
  let popupContent = readFileSync(popupSource, 'utf8');
  
  // Vérifier si toutes les variables sont définies
  const allDefined = Object.values(firebaseConfig).every(v => v !== '');
  
  if (!allDefined) {
    console.error('❌ ERREUR: Certaines variables Firebase ne sont pas définies dans les variables d\'environnement!');
    console.error('Variables manquantes:', Object.entries(firebaseConfig)
      .filter(([_, v]) => !v)
      .map(([k, _]) => k));
    console.error('');
    console.error('Veuillez définir les variables suivantes dans votre fichier .env:');
    console.error('- VITE_FIREBASE_API_KEY');
    console.error('- VITE_FIREBASE_AUTH_DOMAIN');
    console.error('- VITE_FIREBASE_PROJECT_ID');
    console.error('- VITE_FIREBASE_STORAGE_BUCKET (optionnel)');
    console.error('- VITE_FIREBASE_MESSAGING_SENDER_ID');
    console.error('- VITE_FIREBASE_APP_ID');
    console.error('');
    process.exit(1);
  }
  
  // Remplacer les placeholders par les valeurs réelles
  popupContent = popupContent.replace(/__FIREBASE_API_KEY__/g, firebaseConfig.apiKey);
  popupContent = popupContent.replace(/__FIREBASE_AUTH_DOMAIN__/g, firebaseConfig.authDomain);
  popupContent = popupContent.replace(/__FIREBASE_PROJECT_ID__/g, firebaseConfig.projectId);
  popupContent = popupContent.replace(/__FIREBASE_STORAGE_BUCKET__/g, firebaseConfig.storageBucket || '');
  popupContent = popupContent.replace(/__FIREBASE_MESSAGING_SENDER_ID__/g, firebaseConfig.messagingSenderId);
  popupContent = popupContent.replace(/__FIREBASE_APP_ID__/g, firebaseConfig.appId);
  
  // Écrire dans dist/extension
  writeFileSync(popupDest, popupContent, 'utf8');
  console.log(`✅ popup.js traité et copié vers dist/extension avec configuration Firebase injectée`);
  
  // Écrire aussi dans public/extension (pour le téléchargement)
  writeFileSync(popupDestPublic, popupContent, 'utf8');
  console.log(`✅ popup.js copié vers public/extension avec configuration Firebase injectée`);
  
  console.log(`   - apiKey: ${firebaseConfig.apiKey.substring(0, 10)}...`);
  console.log(`   - authDomain: ${firebaseConfig.authDomain}`);
  console.log(`   - projectId: ${firebaseConfig.projectId}`);
} else {
  console.error(`❌ popup.js non trouvé dans ${srcExtensionDir}`);
  process.exit(1);
} 