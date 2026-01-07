import JSZip from 'jszip';

export const downloadExtension = async () => {
  // D'abord, essayer d'utiliser le fichier ZIP pré-généré s'il existe
  try {
    const zipResponse = await fetch('/extension/extension.zip');
    if (zipResponse.ok) {
      return await zipResponse.blob();
    }
  } catch (error) {
    console.log('Fichier ZIP pré-généré non trouvé, création d\'un nouveau ZIP...');
  }

  // Sinon, créer le ZIP à partir des fichiers individuels
  const zip = new JSZip();
  
  // Liste des fichiers à inclure dans le zip (depuis public/extension/)
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
    // Ajouter chaque fichier au zip depuis les fichiers locaux
    for (const file of files) {
      try {
        const response = await fetch(`/extension/${file}`);
        if (!response.ok) {
          console.warn(`Fichier ${file} non trouvé, ignoré`);
          continue;
        }
        const content = await response.blob();
        zip.file(file, content);
      } catch (error) {
        console.warn(`Erreur lors du chargement de ${file}:`, error);
        // Continuer avec les autres fichiers même si un échoue
      }
    }

    // Ajouter le dossier assets s'il existe (optionnel)
    try {
      const assetsResponse = await fetch('/extension/assets/icon.svg');
      if (assetsResponse.ok) {
        const assetsContent = await assetsResponse.blob();
        zip.folder('assets')?.file('icon.svg', assetsContent);
      }
    } catch (error) {
      // Le dossier assets est optionnel, on ignore l'erreur
      console.log('Dossier assets non trouvé, ignoré');
    }

    // Générer le zip
    return await zip.generateAsync({ type: 'blob' });
  } catch (error) {
    console.error('Erreur lors de la création du zip:', error);
    throw new Error('Erreur lors de la création du zip de l\'extension');
  }
}; 