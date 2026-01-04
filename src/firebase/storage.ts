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
import { storage, auth } from "./config";

interface FileUploadResult {
  url: string;
  path: string;
}

interface FileInfo {
  name: string;
  path: string;
  url: string;
}

// Télécharger un fichier
export const uploadFile = async (file: File, path: string): Promise<FileUploadResult> => {
  // #region agent log
  const authUser = auth?.currentUser;
  const authToken = authUser ? await authUser.getIdToken().catch(() => null) : null;
  fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.ts:26',message:'uploadFile entry',data:{path,fileName:file.name,fileSize:file.size,fileType:file.type,authUserExists:!!authUser,authUserId:authUser?.uid,authTokenExists:!!authToken},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  if (!storage) {
    throw new Error('Firebase Storage non disponible');
  }
  
  try {
    const storageRef = ref(storage, path);
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.ts:33',message:'Before uploadBytesResumable',data:{path,storageRefExists:!!storageRef,authUserExists:!!authUser},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
    // #endregion
    
    const uploadTask: UploadTask = uploadBytesResumable(storageRef, file);
    
    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Progression du téléchargement: ${progress}%`);
        },
        (error) => {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.ts:44',message:'Upload error',data:{errorCode:error?.code,errorMessage:error?.message,errorName:error?.name,path,authUserExists:!!authUser,authUserId:authUser?.uid},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
          // #endregion
          reject(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.ts:50',message:'Upload success',data:{path,downloadURL:downloadURL?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
          // #endregion
          resolve({
            url: downloadURL,
            path: path
          });
        }
      );
    });
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.ts:58',message:'Upload catch error',data:{errorCode:error?.code,errorMessage:error?.message,errorName:error?.name,path},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
    // #endregion
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