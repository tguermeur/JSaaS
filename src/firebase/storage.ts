import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject,
  listAll,
  UploadTask,
  ListResult,
  uploadBytes
} from "firebase/storage";
import { storage, auth, app } from "./config";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

interface FileUploadResult {
  url: string;
  path: string;
}

interface FileInfo {
  name: string;
  path: string;
  url: string;
}

// Télécharger un fichier avec callback de progression
export const uploadFile = async (
  file: File, 
  path: string,
  onProgress?: (progress: number) => void
): Promise<FileUploadResult> => {
  // #region agent log
  console.log('[DEBUG] storage.ts:25 - uploadFile called', {path,fileSize:file.size,hasStorage:!!storage,hasApp:!!app,hypothesisId:'A'});
  // #endregion
  
  // S'assurer que Storage est initialisé avec la même instance app que Auth
  let storageInstance = storage;
  if (!storageInstance && app) {
    // #region agent log
    console.log('[DEBUG] storage.ts:30 - Storage null, réinitialisation avec app', {hasApp:!!app,appName:app.name,hypothesisId:'A'});
    // #endregion
    storageInstance = getStorage(app);
  }
  
  if (!storageInstance) {
    throw new Error('Firebase Storage non disponible');
  }
  
  try {
    // #region agent log
    const authInstance = getAuth(app || undefined);
    const firebaseUser = authInstance.currentUser;
    
    // Vérifier que l'utilisateur est authentifié avant l'upload
    if (!firebaseUser) {
      throw new Error('Utilisateur non authentifié');
    }
    
    // Forcer le refresh du token AVANT l'upload pour s'assurer qu'il est valide et inclus
    const token = await firebaseUser.getIdToken(true).catch(()=>null);
    
    // Vérifier que Storage et Auth utilisent la même instance app
    const storageAppName = (storageInstance as any)?._delegate?.app?.name;
    const authAppName = (authInstance as any)?._delegate?.app?.name;
    const storageAppInternal = (storageInstance as any)?._delegate?.app;
    const authAppInternal = (authInstance as any)?._delegate?.app;
    
    console.log('[DEBUG] storage.ts:42 - Auth check before upload', {
      hasStorage:!!storageInstance,
      hasUser:!!firebaseUser,
      userId:firebaseUser?.uid,
      hasToken:!!token,
      tokenLength:token?.length || 0,
      storageAppName,
      authAppName,
      sameAppName:storageAppName === authAppName,
      sameAppInstance:storageAppInternal === authAppInternal,
      storageAppType:typeof storageAppInternal,
      authAppType:typeof authAppInternal,
      hypothesisId:'A'
    });
    // #endregion
    
    // S'assurer que Storage utilise la même instance app que Auth
    if (storageAppInternal !== authAppInternal && app) {
      // #region agent log
      console.log('[DEBUG] storage.ts:65 - Storage et Auth n\'utilisent pas la même instance app, réinitialisation Storage', {
        storageAppName,
        authAppName,
        hypothesisId:'A'
      });
      // #endregion
      storageInstance = getStorage(app);
    }
    
    const storageRef = ref(storageInstance, path);
    // #region agent log
    console.log('[DEBUG] storage.ts:73 - Before uploadBytes', {
      path,
      storageRefPath:storageRef.fullPath,
      fullPath:storageRef.fullPath,
      storageBucket:storageRef.bucket,
      storageAppAfter:((storageInstance as any)?._delegate?.app?.name),
      authAppAfter:((authInstance as any)?._delegate?.app?.name),
      hypothesisId:'B'
    });
    // #endregion
    
    // Essayer d'abord avec uploadBytes (synchronisé) au lieu de uploadBytesResumable
    // D'autres parties du code utilisent uploadBytes avec succès
    if (onProgress) {
      // Si onProgress est fourni, utiliser uploadBytesResumable pour le suivi de progression
      const uploadTask: UploadTask = uploadBytesResumable(storageRef, file);
      
      return new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Progression du téléchargement: ${progress}%`);
            if (onProgress) {
              onProgress(progress);
            }
          },
          (error) => {
            // #region agent log
            const errorDetails: any = {
              errorCode:error.code,
              errorMessage:error.message,
              errorName:error.name,
              errorStack:error.stack,
              serverResponse:error.serverResponse,
              hypothesisId:'B'
            };
            // Essayer d'extraire plus d'informations de l'erreur
            if ((error as any).customData) {
              errorDetails.customData = (error as any).customData;
            }
            if ((error as any).code_) {
              errorDetails.code_ = (error as any).code_;
            }
            console.log('[DEBUG] storage.ts:120 - Upload error in state_changed (uploadBytesResumable)', errorDetails);
            // #endregion
            reject(error);
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({
              url: downloadURL,
              path: path
            });
          }
        );
      });
    } else {
      // Si pas de callback de progression, utiliser uploadBytes (plus simple et peut-être plus fiable)
      // #region agent log
      console.log('[DEBUG] storage.ts:145 - Using uploadBytes (no progress callback)', {hypothesisId:'B'});
      // #endregion
      try {
        await uploadBytes(storageRef, file);
        // #region agent log
        console.log('[DEBUG] storage.ts:149 - uploadBytes completed successfully', {hypothesisId:'B'});
        // #endregion
        const downloadURL = await getDownloadURL(storageRef);
        return {
          url: downloadURL,
          path: path
        };
      } catch (error: any) {
        // #region agent log
        const errorDetails: any = {
          errorCode:error.code,
          errorMessage:error.message,
          errorName:error.name,
          errorStack:error.stack,
          serverResponse:error.serverResponse,
          hypothesisId:'B'
        };
        if ((error as any).customData) {
          errorDetails.customData = (error as any).customData;
        }
        if ((error as any).code_) {
          errorDetails.code_ = (error as any).code_;
        }
        console.log('[DEBUG] storage.ts:165 - Upload error (uploadBytes)', errorDetails);
        // #endregion
        throw error;
      }
    }
  } catch (error) {
    throw error;
  }
};

// Récupérer l'URL de téléchargement d'un fichier
export const getFileURL = async (path: string): Promise<string> => {
  if (!storage) {
    throw new Error('Firebase Storage non disponible');
  }
  
  try {
    const storageRef = ref(storage, path);
    return await getDownloadURL(storageRef);
  } catch (error) {
    throw error;
  }
};

// Supprimer un fichier
export const deleteFile = async (path: string): Promise<boolean> => {
  if (!storage) {
    throw new Error('Firebase Storage non disponible');
  }
  
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
    return true;
  } catch (error) {
    throw error;
  }
};

// Lister tous les fichiers dans un dossier
export const listFiles = async (folderPath: string): Promise<FileInfo[]> => {
  if (!storage) {
    throw new Error('Firebase Storage non disponible');
  }
  
  try {
    const folderRef = ref(storage, folderPath);
    const fileList: ListResult = await listAll(folderRef);
    
    const files = await Promise.all(
      fileList.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        return {
          name: itemRef.name,
          path: itemRef.fullPath,
          url: url
        };
      })
    );
    
    return files;
  } catch (error) {
    throw error;
  }
};

export const uploadCV = async (file: File, userId: string): Promise<string> => {
  if (!storage) {
    throw new Error('Firebase Storage non disponible');
  }
  
  try {
    console.log('Téléchargement du CV pour l\'utilisateur:', userId);
    
    // Créer une référence unique pour le CV
    const cvRef = ref(storage, `cvs/${userId}/${file.name}`);
    
    // Uploader le fichier
    await uploadBytes(cvRef, file);
    
    // Récupérer l'URL de téléchargement
    const downloadURL = await getDownloadURL(cvRef);
    
    console.log('CV téléchargé avec succès:', downloadURL);
    return downloadURL;
  } catch (error) {
    console.error('Erreur lors du téléchargement du CV:', error);
    throw error;
  }
};

export const uploadProfilePicture = async (file: File, userId: string): Promise<string> => {
  if (!storage) {
    throw new Error('Firebase Storage non disponible');
  }
  
  try {
    // Créer une référence unique pour l'image
    const imageRef = ref(storage, `profilePictures/${userId}`);
    
    // Uploader le fichier
    await uploadBytes(imageRef, file);
    
    // Récupérer l'URL de téléchargement
    const downloadURL = await getDownloadURL(imageRef);
    
    return downloadURL;
  } catch (error) {
    console.error('Erreur lors du téléchargement de l\'image:', error);
    throw error;
  }
};


// Fonction pour encoder image en base64
const encodeToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const uploadErrorImage = async (file: File, userId: string): Promise<string> => {
  console.log('🔥 uploadErrorImage appelé avec file:', file?.name, 'userId:', userId);
  
  if (!storage) {
    console.error('❌ Firebase Storage non disponible - activation mode temporaire base64');
    
    try {
      if (!file) {
        throw new Error('Aucun fichier fourni');
      }
      
      // Limite pour l'encoding temporaire
      if (file.size > 3 * 1024 * 1024) {
        throw new Error('Fichier trop volumineux pour encodage temporaire (>3MB)');
      }
      
      console.log('📤 ENCODAGE BASE64 TEMPORAIRE activé...');
      const base64String = await encodeToBase64(file);
      console.log('✅ Image encodée en base64 temporaire avec succès');
      return base64String;
    } catch (fallbackError) {
      console.error('❌ Échec même encodage base64 temporaire:', fallbackError);
      throw new Error(`Firebase Storage indisponible et encodage temporaire échoué: ${fallbackError.message}`);
    }
  }
  
  try {
    // Vérifier que le fichier existe
    if (!file) {
      console.error('❌ Aucun fichier fourni');
      throw new Error('Aucun fichier fourni');
    }
    
    console.log('📤 Préparation upload image Firebase Storage:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      userId: userId
    });
    
    // Créer une référence unique pour l'image avec un timestamp
    const fileName = `${Date.now()}-${file.name}`;
    const imagePath = `error-reports/${userId}/${fileName}`;
    console.log('🔗 Chemin de référence créé:', imagePath);
    
    const imageRef = ref(storage, imagePath);
    
    console.log('⏳ Début de l\'upload vers Firebase Storage...');
    // Uploader le fichier
    await uploadBytes(imageRef, file);
    console.log('✅ Upload vers Firebase Storage réussi');
    
    // Récupérer l'URL de téléchargement
    console.log('🔗 Récupération de l\'URL Firebase Storage...');
    const downloadURL = await getDownloadURL(imageRef);
    console.log('✅ URL Firebase Storage obtenue:', downloadURL);
    
    return downloadURL;
  } catch (error) {
    console.error('❌ Erreur lors du téléchargement vers Firebase Storage:', error);
    console.error('Détails de l\'erreur:', error.message);
    throw error;
  }
};

export const uploadCompanyLogo = async (file: File, companyId: string): Promise<string> => {
  console.log('🔥 uploadCompanyLogo appelé avec file:', file?.name, 'companyId:', companyId);

  if (!storage) {
    console.error('❌ Firebase Storage non disponible - activation mode temporaire base64');
    
    try {
      if (!file) {
        throw new Error('Aucun fichier fourni');
      }
      
      // Limite pour l'encoding temporaire
      if (file.size > 3 * 1024 * 1024) {
        throw new Error('Fichier trop volumineux pour encodage temporaire (>3MB)');
      }
      
      console.log('📤 ENCODAGE BASE64 TEMPORAIRE pour logo entreprise...');
      const base64String = await encodeToBase64(file);
      console.log('✅ Logo encodé en base64 temporaire avec succès');
      return base64String;
    } catch (fallbackError) {
      console.error('❌ Échec même encodage base64 temporaire:', fallbackError);
      throw new Error(`Firebase Storage indisponible et encodage temporaire échoué: ${fallbackError.message}`);
    }
  }
  
  try {
    // Vérifier que le fichier existe
    if (!file) {
      console.error('❌ Aucun fichier fourni');
      throw new Error('Aucun fichier fourni');
    }
    
    console.log('📤 Préparation upload logo entreprise Firebase Storage:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      companyId: companyId
    });
    
    // Créer une référence unique pour le logo avec un timestamp
    const logoRef = ref(storage, `company-logos/${companyId}/${Date.now()}-${file.name}`);
    console.log('🔗 Chemin de référence logo créé:', `company-logos/${companyId}/${Date.now()}-${file.name}`);
    
    console.log('⏳ Début de l\'upload logo vers Firebase Storage...');
    // Uploader le fichier
    await uploadBytes(logoRef, file);
    console.log('✅ Upload logo vers Firebase Storage réussi');
    
    // Récupérer l'URL de téléchargement
    console.log('🔗 Récupération de l\'URL Firebase Storage logo...');
    const downloadURL = await getDownloadURL(logoRef);
    console.log('✅ URL Firebase Storage logo obtenue:', downloadURL);
    
    // Vérifier que l'URL est valide
    if (!downloadURL || (!downloadURL.startsWith('http://') && !downloadURL.startsWith('https://'))) {
      throw new Error("URL de téléchargement invalide");
    }
    
    return downloadURL;
  } catch (error) {
    console.error('❌ Erreur lors du téléchargement du logo vers Firebase Storage:', error);
    console.error('Détails de l\'erreur:', error.message);
    throw error;
  }
}; 