import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Créer le répertoire de destination s'il n'existe pas
const destDir = path.resolve(__dirname, '../src/extension');
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// URLs des fichiers Firebase
const firebaseFiles = [
  {
    url: 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
    filename: 'firebase-app.js'
  },
  {
    url: 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js',
    filename: 'firebase-auth.js'
  }
];

// Fonction pour télécharger un fichier
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Télécharger tous les fichiers
async function downloadAll() {
  for (const file of firebaseFiles) {
    const destPath = path.join(destDir, file.filename);
    try {
      console.log(`Téléchargement de ${file.url}...`);
      await downloadFile(file.url, destPath);
      console.log(`Fichier sauvegardé: ${destPath}`);
    } catch (error) {
      console.error(`Erreur lors du téléchargement de ${file.url}:`, error);
    }
  }
}

downloadAll(); 