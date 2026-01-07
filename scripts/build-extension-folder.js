import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.join(__dirname, '../src/extension');
const destDir = path.join(__dirname, '../public/extension-folder');

console.log('🔄 Génération du dossier d\'extension prêt à installer...');

try {
  // 1. Copier les fichiers de l'extension
  console.log('📁 Copie des fichiers de l\'extension...');
  fs.removeSync(destDir);
  fs.copySync(sourceDir, destDir);
  console.log('✅ Fichiers copiés avec succès');

  // 2. Créer un fichier README dans le dossier
  const readmeContent = `# Extension JS Connect - Prêt à installer

## Installation dans Chrome

1. Ouvrez Chrome et allez à chrome://extensions/
2. Activez le "Mode développeur" en haut à droite
3. Cliquez sur "Charger l'extension non empaquetée"
4. Sélectionnez ce dossier (extension-folder)
5. L'extension sera installée !

## Utilisation

- L'icône de l'extension apparaîtra dans votre barre d'outils
- Cliquez dessus pour vous connecter à JS Connect
- L'extension fonctionnera automatiquement sur LinkedIn

## Support

Pour toute question, contactez le support JS Connect.
`;

  fs.writeFileSync(path.join(destDir, 'README.txt'), readmeContent);

  console.log('✅ Dossier d\'extension créé avec succès !');
  console.log(`📁 Emplacement: ${destDir}`);
  console.log('💡 Les utilisateurs peuvent maintenant sélectionner ce dossier directement dans Chrome');

} catch (error) {
  console.error('❌ Erreur lors de la génération du dossier:', error);
  process.exit(1);
}




















