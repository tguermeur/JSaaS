import { collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

export interface Prospect {
  id?: string;
  nom: string;
  email: string;
  telephone?: string;
  entreprise?: string;
  poste?: string;
  source?: string;
  statut?: 'nouveau' | 'contacté' | 'qualifié' | 'proposition' | 'négociation' | 'gagné' | 'perdu';
  notes?: string;
  tags?: string[];
  userId: string;
  createdAt?: any;
  updatedAt?: any;
}

export const getProspects = async (userId: string): Promise<Prospect[]> => {
  try {
    const prospectsRef = collection(db, 'prospects');
    const q = query(
      prospectsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const prospects: Prospect[] = [];
    
    querySnapshot.forEach((doc) => {
      prospects.push({
        id: doc.id,
        ...doc.data()
      } as Prospect);
    });
    
    return prospects;
  } catch (error) {
    console.error('Erreur lors de la récupération des prospects:', error);
    throw error;
  }
};

export const createProspect = async (prospectData: Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const prospectsRef = collection(db, 'prospects');
    const docRef = await addDoc(prospectsRef, {
      ...prospectData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de la création du prospect:', error);
    throw error;
  }
};

export const updateProspect = async (id: string, prospectData: Partial<Prospect>): Promise<void> => {
  try {
    const prospectRef = doc(db, 'prospects', id);
    await updateDoc(prospectRef, {
      ...prospectData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du prospect:', error);
    throw error;
  }
};

export const deleteProspect = async (id: string): Promise<void> => {
  try {
    const prospectRef = doc(db, 'prospects', id);
    await deleteDoc(prospectRef);
  } catch (error) {
    console.error('Erreur lors de la suppression du prospect:', error);
    throw error;
  }
};
