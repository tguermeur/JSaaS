import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, query, where, getDoc, runTransaction, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Mission, MissionSlot } from '../types/mission';
import { UserData } from '../types/user';

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
  // Champs pour les missions ambassadeurs
  type?: 'standard' | 'ambassadeur_event';
  slots?: MissionSlot[];
  campaignName?: string;
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

// Fonction récursive pour nettoyer les valeurs undefined
const cleanUndefined = (obj: any): any => {
  // Si c'est undefined, ne pas l'inclure (retourner un marqueur spécial)
  if (obj === undefined) {
    return '__REMOVE__';
  }
  
  // Si c'est null, le garder tel quel (null est valide dans Firestore)
  if (obj === null) {
    return null;
  }
  
  // Si c'est un tableau, nettoyer chaque élément
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item)).filter(item => item !== '__REMOVE__');
  }
  
  // Si c'est un objet (mais pas Date, etc.)
  if (typeof obj === 'object' && obj !== null && obj.constructor === Object) {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = cleanUndefined(value);
      // Ne pas ajouter les clés avec le marqueur __REMOVE__
      if (cleanedValue !== '__REMOVE__') {
        cleaned[key] = cleanedValue;
      }
    }
    return cleaned;
  }
  
  // Pour les autres types (Date, string, number, etc.), les retourner tel quel
  return obj;
};

export const addMission = async (missionData: Omit<FirestoreMission, 'id'>) => {
  try {
    // Nettoyer les données : supprimer toutes les valeurs undefined (Firestore ne les accepte pas)
    const dataToSave = {
      ...missionData,
      createdAt: new Date()
    };
    
    // Nettoyer récursivement
    const cleanData = cleanUndefined(dataToSave);
    
    // Nettoyer une dernière fois au niveau racine pour être sûr
    const finalData = Object.fromEntries(
      Object.entries(cleanData).filter(([_, value]) => value !== null && value !== undefined)
    );
    
    const docRef = await addDoc(collection(db, 'missions'), finalData);
    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de l\'ajout de la mission:', error);
    console.error('Données envoyées:', missionData);
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

/**
 * Ajoute un créneau (slot) à une mission de type 'ambassadeur_event'
 */
export const addSlotToMission = async (missionId: string, slotData: Omit<MissionSlot, 'id' | 'assignedStudentIds' | 'contractStatus' | 'billingStatus'>) => {
  try {
    const missionRef = doc(db, 'missions', missionId);
    
    // Génération d'un ID simple pour le slot
    const slotId = crypto.randomUUID();
    
    const newSlot: MissionSlot = {
      id: slotId,
      ...slotData,
      assignedStudentIds: [],
      contractStatus: 'pending',
      billingStatus: 'pending'
    };

    await updateDoc(missionRef, {
      slots: arrayUnion(newSlot)
    });

    return slotId;
  } catch (error) {
    console.error("Erreur lors de l'ajout du slot:", error);
    throw error;
  }
};

/**
 * Inscrit un étudiant ambassadeur à un créneau spécifique
 * Utilise une transaction pour gérer la concurrence sur la capacité
 */
export const registerAmbassadorToSlot = async (missionId: string, slotId: string, userId: string) => {
  try {
    await runTransaction(db, async (transaction) => {
      const missionRef = doc(db, 'missions', missionId);
      const userRef = doc(db, 'users', userId);
      
      const missionDoc = await transaction.get(missionRef);
      const userDoc = await transaction.get(userRef);

      if (!missionDoc.exists()) throw new Error("Mission introuvable");
      if (!userDoc.exists()) throw new Error("Utilisateur introuvable");

      const missionData = missionDoc.data() as Mission;
      const userData = userDoc.data() as UserData;

      // 1. Vérifier si l'utilisateur est ambassadeur
      if (!userData.isAmbassador) {
        throw new Error("L'utilisateur n'est pas un ambassadeur éligible");
      }

      // 2. Trouver le slot
      const slots = missionData.slots || [];
      const slotIndex = slots.findIndex(s => s.id === slotId);

      if (slotIndex === -1) {
        throw new Error("Créneau introuvable");
      }

      const slot = slots[slotIndex];

      // 3. Vérifier la capacité
      if (slot.assignedStudentIds.length >= slot.capacity) {
        throw new Error("Ce créneau est complet");
      }

      // 4. Vérifier si déjà inscrit
      if (slot.assignedStudentIds.includes(userId)) {
        throw new Error("Déjà inscrit à ce créneau");
      }

      // 5. Mettre à jour le slot
      // Note: On ne peut pas modifier un élément de tableau directement avec updateDoc sans réécrire le tableau
      // Dans une transaction, on lit, on modifie, on écrit.
      
      const updatedSlots = [...slots];
      updatedSlots[slotIndex] = {
        ...slot,
        assignedStudentIds: [...slot.assignedStudentIds, userId]
      };

      transaction.update(missionRef, { slots: updatedSlots });
    });
    
    return true;
  } catch (error) {
    console.error("Erreur lors de l'inscription au créneau:", error);
    throw error;
  }
};
 