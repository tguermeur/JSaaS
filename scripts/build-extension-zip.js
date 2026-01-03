import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.join(__dirname, '../src/extension');
const destDir = path.join(__dirname, '../public/extension');

console.log('🔄 Génération de l\'extension ZIP...');

try {
  // 1. Copier les fichiers de l'extension
  console.log('📁 Copie des fichiers de l\'extension...');
  fs.removeSync(destDir);
  fs.copySync(sourceDir, destDir);
  console.log('✅ Fichiers copiés avec succès');

  // 2. Créer le fichier ZIP
  console.log('📦 Création du fichier ZIP...');
  const extensionZipPath = path.join(destDir, 'extension.zip');
  
  // Supprimer l'ancien ZIP s'il existe
  if (fs.existsSync(extensionZipPath)) {
    fs.removeSync(extensionZipPath);
  }

  // Créer le nouveau ZIP
  execSync('zip -r extension.zip * -x "*.DS_Store" "*.git*" "extension.zip"', {
    cwd: destDir,
    stdio: 'inherit'
  });

  console.log('✅ Extension ZIP créée avec succès !');
  console.log(`📁 Emplacement: ${extensionZipPath}`);
  
  // Vérifier la taille du fichier
  const stats = fs.statSync(extensionZipPath);
  const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`📊 Taille du fichier: ${fileSizeInMB} MB`);

} catch (error) {
  console.error('❌ Erreur lors de la génération de l\'extension:', error);
  process.exit(1);
}




















