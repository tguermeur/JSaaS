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

export const createUserDocument = async (userData: UserDocument): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userData.uid);
    await setDoc(userRef, {
      ...userData,
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
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...userData,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du document utilisateur:', error);
    throw error;
  }
};

export const getUserDocument = async (uid: string): Promise<UserDocument | null> => {
  try {
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
