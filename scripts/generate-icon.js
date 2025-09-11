import sharp from 'sharp';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const sizes = [16, 32, 48, 128];
const extensionDir = 'src/extension';

// Créer le dossier s'il n'existe pas
if (!existsSync(extensionDir)) {
  mkdirSync(extensionDir, { recursive: true });
}

// SVG template pour l'icône
const svgTemplate = `
<svg width="{size}" height="{size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#0071e3"/>
  <text x="50%" y="40%" font-family="Arial" font-weight="bold" font-size="{fontSize}" fill="white" text-anchor="middle">JS</text>
  <text x="50%" y="70%" font-family="Arial" font-weight="bold" font-size="{fontSize}" fill="white" text-anchor="middle">aaS</text>
</svg>
`;

async function generateIcon(size) {
  const fontSize = size * 0.4;
  const svg = svgTemplate
    .replace(/{size}/g, size)
    .replace(/{fontSize}/g, fontSize);

  const buffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  writeFileSync(join(extensionDir, `icon${size}.png`), buffer);
  console.log(`Icône ${size}x${size} générée`);
}

// Générer toutes les tailles d'icônes
Promise.all(sizes.map(generateIcon))
  .then(() => console.log('Toutes les icônes ont été générées avec succès'))
  .catch(error => console.error('Erreur lors de la génération des icônes:', error)); 