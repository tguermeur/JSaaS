import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const extensionDir = 'dist/extension';
const srcExtensionDir = 'src/extension';

// Créer le dossier de destination s'il n'existe pas
if (!existsSync(extensionDir)) {
  mkdirSync(extensionDir, { recursive: true });
}

// Copier les fichiers nécessaires
const filesToCopy = [
  'manifest.json',
  'popup.css',
  'icon16.png',
  'icon32.png',
  'icon48.png',
  'icon128.png'
];

filesToCopy.forEach(file => {
  const source = join(srcExtensionDir, file);
  const destination = join(extensionDir, file);
  
  if (existsSync(source)) {
    copyFileSync(source, destination);
    console.log(`Copié: ${file}`);
  } else {
    console.warn(`Fichier non trouvé: ${file}`);
  }
}); 