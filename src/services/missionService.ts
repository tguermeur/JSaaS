import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, query, where, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface FirestoreMission {
  number: string;
  company: string;
  status: 'En cours' | 'En attente' | 'Terminée' | 'Annulée';
  assignees: Array<{
    id: string;
    name: string;
    avatar?: string;
  }>;
  date: string;
  studentCount: number;
  description: string;
}

export const getMissions = async () => {
  try {
    const missionsRef = collection(db, 'missions');
    const snapshot = await getDocs(missionsRef);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des missions:', error);
    throw error;
  }
};

export const addMission = async (missionData: Omit<FirestoreMission, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'missions'), {
      ...missionData,
      createdAt: new Date()
    });
    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de l\'ajout de la mission:', error);
    throw error;
  }
};

export const updateMission = async (id: string, data: Partial<FirestoreMission>) => {
  try {
    const missionRef = doc(db, 'missions', id);
    
    const currentMission = await getDoc(missionRef);
    if (!currentMission.exists()) {
      throw new Error('Mission non trouvée');
    }

    const currentData = currentMission.data();
    
    const hasChanges = Object.keys(data).some(key => {
      const currentValue = currentData[key];
      const newValue = data[key];
      return JSON.stringify(currentValue) !== JSON.stringify(newValue);
    });

    const dataToUpdate = {
      ...data,
      ...(hasChanges ? { updatedAt: new Date() } : {})
    };

    await updateDoc(missionRef, dataToUpdate);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la mission:', error);
    throw error;
  }
};

export const deleteMission = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'missions', id));
  } catch (error) {
    console.error('Erreur lors de la suppression de la mission:', error);
    throw error;
  }
};

export const deleteMissions = async (ids: string[]) => {
  try {
    await Promise.all(ids.map(id => deleteDoc(doc(db, 'missions', id))));
  } catch (error) {
    console.error('Erreur lors de la suppression des missions:', error);
    throw error;
  }
}; 