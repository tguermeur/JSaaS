import sharp from 'sharp';
import { writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { join } from 'path';

const sizes = [16, 32, 48, 128];
const extensionDir = 'src/extension';
const publicExtensionDir = 'public/extension';
const publicExtensionFolderDir = 'public/extension-folder';
const distExtensionDir = 'dist/extension';
const distExtensionFolderDir = 'dist/extension-folder';
const logoPath = 'dist/images/logo.png';

// Créer les dossiers s'ils n'existent pas
const dirs = [extensionDir, publicExtensionDir, publicExtensionFolderDir, distExtensionDir, distExtensionFolderDir];
dirs.forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

async function generateIcon(size) {
  try {
    // Vérifier si le logo existe
    if (!existsSync(logoPath)) {
      throw new Error(`Logo non trouvé: ${logoPath}`);
    }

    // Redimensionner le logo à la taille souhaitée
    const buffer = await sharp(logoPath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toBuffer();

    // Sauvegarder dans tous les dossiers d'extension
    const targetDirs = [extensionDir, publicExtensionDir, publicExtensionFolderDir, distExtensionDir, distExtensionFolderDir];
    targetDirs.forEach(dir => {
      writeFileSync(join(dir, `icon${size}.png`), buffer);
    });
    
    console.log(`Icône ${size}x${size} générée depuis ${logoPath} et copiée dans tous les dossiers`);
  } catch (error) {
    console.error(`Erreur lors de la génération de l'icône ${size}x${size}:`, error);
    throw error;
  }
}

// Générer toutes les tailles d'icônes
Promise.all(sizes.map(generateIcon))
  .then(() => console.log('Toutes les icônes ont été générées avec succès depuis le logo'))
  .catch(error => console.error('Erreur lors de la génération des icônes:', error)); 