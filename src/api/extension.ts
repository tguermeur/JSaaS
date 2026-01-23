import JSZip from 'jszip';

export const downloadExtension = async () => {
  // Toujours essayer d'utiliser le fichier ZIP pré-généré en premier (recommandé)
  // Ce ZIP contient la configuration Firebase injectée au build time
  try {
    const zipResponse = await fetch('/extension/extension.zip', {
      cache: 'no-store' // Forcer le rechargement pour éviter les caches obsolètes
    });
    
    if (zipResponse.ok) {
      const blob = await zipResponse.blob();
      
      // Vérifier que le ZIP contient bien la configuration Firebase injectée
      // en extrayant popup.js et vérifiant qu'il n'y a pas de placeholders
      try {
        const zip = await JSZip.loadAsync(blob);
        const popupJs = await zip.file('popup.js')?.async('text');
        
        if (popupJs) {
          // Vérifier qu'il n'y a pas de placeholders Firebase
          if (popupJs.includes('__FIREBASE_')) {
            console.warn('⚠️ Le ZIP contient des placeholders Firebase non remplacés. Utilisation du fallback...');
            throw new Error('ZIP contient des placeholders');
          }
          
          // Vérifier que la configuration Firebase est présente
          if (!popupJs.includes('apiKey:') || popupJs.includes('apiKey: "__FIREBASE_API_KEY__"')) {
            console.warn('⚠️ Configuration Firebase invalide dans le ZIP. Utilisation du fallback...');
            throw new Error('Configuration Firebase invalide');
          }
        }
      } catch (validationError) {
        console.warn('Erreur lors de la validation du ZIP:', validationError);
        // Continuer avec le fallback
      }
      
      return blob;
    }
  } catch (error) {
    console.warn('Fichier ZIP pré-généré non accessible, création d\'un nouveau ZIP...', error);
  }

  // Fallback: créer le ZIP à partir des fichiers individuels
  // ATTENTION: Cette méthode peut ne pas avoir la configuration Firebase injectée
  // si les fichiers servis par le serveur ne sont pas à jour
  console.warn('⚠️ Utilisation du fallback: création dynamique du ZIP. Assurez-vous que les fichiers sont à jour.');
  
  const zip = new JSZip();
  
  // Liste des fichiers à inclure dans le zip (depuis public/extension/)
  const files = [
    'manifest.json',
    'popup.html',
    'popup.js',
    'popup.css',
    'content.js',
    'background.js',
    'firebase-app-compat.js',
    'firebase-auth-compat.js',
    'firebase-firestore-compat.js',
    'icon16.png',
    'icon32.png',
    'icon48.png',
    'icon128.png'
  ];

  try {
    // Ajouter chaque fichier au zip depuis les fichiers locaux
    for (const file of files) {
      try {
        const response = await fetch(`/extension/${file}`, {
          cache: 'no-store' // Forcer le rechargement
        });
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

    // Ajouter les fichiers Firebase supplémentaires si disponibles
    const firebaseFiles = [
      'firebase-app.js',
      'firebase-auth.js',
      'firebase-firestore.js'
    ];
    
    for (const file of firebaseFiles) {
      try {
        const response = await fetch(`/extension/${file}`, { cache: 'no-store' });
        if (response.ok) {
          const content = await response.blob();
          zip.file(file, content);
        }
      } catch (error) {
        // Ignorer silencieusement, ces fichiers sont optionnels
      }
    }

    // Ajouter le dossier assets s'il existe (optionnel)
    try {
      const assetsResponse = await fetch('/extension/assets/icon.svg', { cache: 'no-store' });
      if (assetsResponse.ok) {
        const assetsContent = await assetsResponse.blob();
        zip.folder('assets')?.file('icon.svg', assetsContent);
      }
    } catch (error) {
      // Le dossier assets est optionnel, on ignore l'erreur
      console.log('Dossier assets non trouvé, ignoré');
    }

    // Générer le zip
    const generatedBlob = await zip.generateAsync({ type: 'blob' });
    
    // Vérifier que le ZIP généré contient bien la configuration Firebase
    try {
      const validationZip = await JSZip.loadAsync(generatedBlob);
      const popupJs = await validationZip.file('popup.js')?.async('text');
      
      if (popupJs && popupJs.includes('__FIREBASE_')) {
        throw new Error('Le ZIP généré contient encore des placeholders Firebase. Veuillez reconstruire l\'extension avec npm run build:extension-zip');
      }
    } catch (validationError) {
      console.error('❌ Erreur de validation du ZIP généré:', validationError);
      throw new Error('Le ZIP généré ne contient pas la configuration Firebase correcte. Veuillez reconstruire l\'extension.');
    }
    
    return generatedBlob;
  } catch (error) {
    console.error('Erreur lors de la création du zip:', error);
    throw new Error(error.message || 'Erreur lors de la création du zip de l\'extension');
  }
}; 