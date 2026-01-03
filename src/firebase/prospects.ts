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
  userId?: string;
  structureId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export const getProspects = async (structureId: string, userStatus?: string): Promise<Prospect[]> => {
  if (!structureId) {
    console.warn('getProspects appelé sans structureId');
    return [];
  }

  try {
    const prospectsRef = collection(db, 'prospects');
    
    // Requête simplifiée sans orderBy pour éviter le problème d'index
    // On récupère tous les prospects de la structure et on les trie côté client
    const q = query(
      prospectsRef,
      where('structureId', '==', structureId)
    );
    
    const querySnapshot = await getDocs(q);
    const prospects: Prospect[] = [];
    
    querySnapshot.forEach((doc) => {
      prospects.push({
        id: doc.id,
        ...doc.data()
      } as Prospect);
    });
    
    // Tri côté client par date de création (plus récent en premier)
    prospects.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
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
