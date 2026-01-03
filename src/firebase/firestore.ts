import { doc, setDoc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './config';

export interface UserDocument {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  role?: string;
  organization?: string;
  createdAt?: any;
  updatedAt?: any;
  // Champs supplémentaires pour le profil
  firstName?: string;
  lastName?: string;
  position?: string;
  department?: string;
  bio?: string;
  skills?: string[];
  experience?: string;
  education?: string;
  cvUrl?: string;
  profilePictureUrl?: string;
}

export const createUserDocument = async (uid: string, userData: Partial<UserDocument>): Promise<void> => {
  try {
    if (!uid) {
      throw new Error('UID est requis pour créer un document utilisateur');
    }
    
    if (!db) {
      throw new Error('Firestore n\'est pas initialisé');
    }
    
    const userRef = doc(db, 'users', uid);
    
    // Filtrer les valeurs undefined pour éviter les erreurs Firestore
    const cleanedData: Record<string, any> = {
      uid,
      ...userData
    };
    
    // Supprimer les valeurs undefined
    Object.keys(cleanedData).forEach(key => {
      if (cleanedData[key] === undefined) {
        delete cleanedData[key];
      }
    });
    
    await setDoc(userRef, {
      ...cleanedData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Erreur lors de la création du document utilisateur:', error);
    throw error;
  }
};

export const updateUserDocument = async (uid: string, userData: Partial<UserDocument>): Promise<void> => {
  try {
    if (!db) {
      throw new Error('Firestore n\'est pas initialisé');
    }
    
    const userRef = doc(db, 'users', uid);
    
    // Filtrer les valeurs undefined pour éviter les erreurs Firestore
    const cleanedData: Record<string, any> = {};
    Object.keys(userData).forEach(key => {
      const value = userData[key as keyof UserDocument];
      // Ne pas inclure les valeurs undefined, mais garder null et les chaînes vides
      if (value !== undefined) {
        cleanedData[key] = value;
      }
    });
    
    await updateDoc(userRef, {
      ...cleanedData,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du document utilisateur:', error);
    throw error;
  }
};

export const getUserDocument = async (uid: string): Promise<UserDocument | null> => {
  try {
    if (!db) {
      throw new Error('Firestore n\'est pas initialisé');
    }
    
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data() as UserDocument;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Erreur lors de la récupération du document utilisateur:', error);
    throw error;
  }
};

export const getUserByEmail = async (email: string): Promise<UserDocument | null> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as UserDocument;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Erreur lors de la recherche d\'utilisateur par email:', error);
    throw error;
  }
};
