import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Utiliser public/extension comme source (qui contient déjà la configuration injectée)
// Si public/extension n'existe pas ou est vide, utiliser dist/extension
const distDir = path.join(__dirname, '../dist/extension');
const publicDir = path.join(__dirname, '../public/extension');
const destDir = publicDir;

console.log('🔄 Génération de l\'extension ZIP...');

try {
  // Vérifier que les fichiers existent (build-extension.js doit avoir été exécuté)
  if (!fs.existsSync(publicDir) || fs.readdirSync(publicDir).length === 0) {
    if (fs.existsSync(distDir) && fs.readdirSync(distDir).length > 0) {
      console.log('📁 Copie depuis dist/extension vers public/extension...');
      fs.ensureDirSync(publicDir);
      fs.copySync(distDir, publicDir);
      console.log('✅ Fichiers copiés depuis dist/extension');
    } else {
      console.error('❌ ERREUR: Aucun fichier d\'extension trouvé!');
      console.error('   Veuillez exécuter: npm run build:extension');
      process.exit(1);
    }
  } else {
    console.log('✅ Utilisation des fichiers existants dans public/extension (avec configuration Firebase injectée)');
  }

  // 2. Créer le fichier ZIP
  console.log('📦 Création du fichier ZIP...');
  const extensionZipPath = path.join(destDir, 'extension.zip');
  
  // Supprimer l'ancien ZIP s'il existe
  if (fs.existsSync(extensionZipPath)) {
    fs.removeSync(extensionZipPath);
  }

  // Créer le nouveau ZIP (exclure le ZIP existant, les fichiers système, etc.)
  execSync('zip -r extension.zip * -x "*.DS_Store" "*.git*" "extension.zip" "*.md"', {
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




















