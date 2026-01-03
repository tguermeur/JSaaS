import { watch } from 'chokidar';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extensionSourceDir = path.join(__dirname, '../src/extension');

console.log('👀 Surveillance des fichiers de l\'extension...');
console.log(`📁 Dossier surveillé: ${extensionSourceDir}`);

// Fonction pour reconstruire l'extension
const rebuildExtension = () => {
  try {
    console.log('🔄 Reconstruction de l\'extension...');
    execSync('npm run build:extension-zip', { stdio: 'inherit' });
    console.log('✅ Extension reconstruite avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors de la reconstruction:', error);
  }
};

// Surveiller les changements dans le dossier de l'extension
const watcher = watch(extensionSourceDir, {
  ignored: /(^|[\/\\])\../, // ignorer les fichiers cachés
  persistent: true
});

watcher
  .on('change', (path) => {
    console.log(`📝 Fichier modifié: ${path}`);
    rebuildExtension();
  })
  .on('add', (path) => {
    console.log(`➕ Fichier ajouté: ${path}`);
    rebuildExtension();
  })
  .on('unlink', (path) => {
    console.log(`🗑️ Fichier supprimé: ${path}`);
    rebuildExtension();
  })
  .on('error', error => {
    console.error('❌ Erreur de surveillance:', error);
  });

console.log('✅ Surveillance active. Appuyez sur Ctrl+C pour arrêter.');

// Gestion de l'arrêt propre
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt de la surveillance...');
  watcher.close();
  process.exit(0);
});




















