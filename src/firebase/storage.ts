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
import { storage } from "./config";

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
  if (!storage) {
    throw new Error('Firebase Storage non disponible');
  }
  
  try {
    const storageRef = ref(storage, path);
    const uploadTask: UploadTask = uploadBytesResumable(storageRef, file);
    
    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Progression du téléchargement: ${progress}%`);
        },
        (error) => {
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

export const uploadErrorImage = async (file: File, userId: string): Promise<string> => {
  if (!storage) {
    throw new Error('Firebase Storage non disponible');
  }
  
  try {
    // Créer une référence unique pour l'image avec un timestamp
    const imageRef = ref(storage, `error-reports/${userId}/${Date.now()}-${file.name}`);
    
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

export const uploadCompanyLogo = async (file: File, companyId: string): Promise<string> => {
  if (!storage) {
    throw new Error('Firebase Storage non disponible');
  }
  
  try {
    // Créer une référence unique pour le logo avec un timestamp
    const logoRef = ref(storage, `company-logos/${companyId}/${Date.now()}-${file.name}`);
    
    // Uploader le fichier
    await uploadBytes(logoRef, file);
    
    // Récupérer l'URL de téléchargement
    const downloadURL = await getDownloadURL(logoRef);
    
    // Vérifier que l'URL est valide
    if (!downloadURL || (!downloadURL.startsWith('http://') && !downloadURL.startsWith('https://'))) {
      throw new Error("URL de téléchargement invalide");
    }
    
    return downloadURL;
  } catch (error) {
    console.error('Erreur lors du téléchargement du logo de l\'entreprise:', error);
    throw error;
  }
}; 