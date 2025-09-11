import JSZip from 'jszip';
import { storage } from '../firebase/config';
import { ref, getDownloadURL } from 'firebase/storage';

export const downloadExtension = async () => {
  const zip = new JSZip();
  
  // Liste des fichiers à inclure dans le zip
  const files = [
    'manifest.json',
    'popup.html',
    'popup.js',
    'popup.css',
    'content.js',
    'background.js',
    'config.js',
    'firebase-app.js',
    'firebase-auth.js',
    'firebase-firestore.js',
    'icon16.png',
    'icon32.png',
    'icon48.png',
    'icon128.png'
  ];

  try {
    // Ajouter chaque fichier au zip
    for (const file of files) {
      const fileRef = ref(storage, `extension/${file}`);
      const url = await getDownloadURL(fileRef);
      const response = await fetch(url);
      const content = await response.blob();
      zip.file(file, content);
    }

    // Ajouter le dossier assets s'il existe
    try {
      const assetsRef = ref(storage, 'extension/assets');
      const assetsUrl = await getDownloadURL(assetsRef);
      const assetsResponse = await fetch(assetsUrl);
      const assetsContent = await assetsResponse.blob();
      zip.folder('assets')?.file('content', assetsContent);
    } catch (error) {
      console.log('Dossier assets non trouvé, ignoré');
    }

    // Générer le zip
    return await zip.generateAsync({ type: 'blob' });
  } catch (error) {
    throw new Error('Erreur lors de la création du zip de l\'extension');
  }
}; 