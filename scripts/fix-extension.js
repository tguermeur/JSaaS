import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extensionDir = path.join(__dirname, '../public/extension');

console.log('🔧 Correction automatique de l\'extension...');

try {
  // 1. Corriger config.js
  console.log('📝 Correction de config.js...');
  const configContent = `// Configuration Firebase pour l'extension
const firebaseConfig = {
  apiKey: "AIzaSyCW55pfTJwuRosEx9Sxs-LELEWv1RiS3iI",
  authDomain: "jsaas-dd2f7.firebaseapp.com",
  projectId: "jsaas-dd2f7",
  storageBucket: "jsaas-dd2f7.appspot.com",
  messagingSenderId: "1028151005055",
  appId: "1:1028151005055:web:66a22fecbffcea812c944a"
};

// URL de l'application
const APP_URL = "http://localhost:3007"; // Ou votre URL de production

// Export pour l'extension (pas de modules ES6)
window.firebaseConfig = firebaseConfig;
window.APP_URL = APP_URL;`;

  fs.writeFileSync(path.join(extensionDir, 'config.js'), configContent);

  // 2. Corriger popup.html
  console.log('📝 Correction de popup.html...');
  let popupHtml = fs.readFileSync(path.join(extensionDir, 'popup.html'), 'utf8');
  
  // S'assurer que config.js est chargé en premier
  if (!popupHtml.includes('<script src="config.js"></script>')) {
    popupHtml = popupHtml.replace(
      '<script src="firebase/firebase-app.js"></script>',
      '<script src="config.js"></script>\n  <script src="firebase/firebase-app.js"></script>'
    );
  }
  
  fs.writeFileSync(path.join(extensionDir, 'popup.html'), popupHtml);

  // 3. Utiliser le fichier popup-fixed.js s'il existe
  console.log('📝 Correction de popup.js...');
  const popupFixedPath = path.join(extensionDir, 'popup-fixed.js');
  const popupPath = path.join(extensionDir, 'popup.js');
  
  if (fs.existsSync(popupFixedPath)) {
    fs.copySync(popupFixedPath, popupPath);
    console.log('✅ Utilisation de popup-fixed.js');
  } else {
    console.log('⚠️ popup-fixed.js non trouvé, popup.js non modifié');
  }

  console.log('✅ Extension corrigée avec succès !');
  console.log('💡 Vous pouvez maintenant régénérer l\'extension avec: npm run build:extension-all');

} catch (error) {
  console.error('❌ Erreur lors de la correction de l\'extension:', error);
  process.exit(1);
}




















