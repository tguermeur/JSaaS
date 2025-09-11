import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.join(__dirname, '../src/extension');
const destDir = path.join(__dirname, '../public/extension');

// Supprimer le dossier de destination s'il existe
fs.removeSync(destDir);

// Copier le dossier source vers la destination
fs.copySync(sourceDir, destDir);

console.log('Dossier extension copié avec succès dans public/extension'); 
 