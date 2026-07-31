import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, query, where, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Etude, Avenant, ConsultantJehAllocation, QualityChecklist, SatisfactionSurvey } from '../types/etude';

// Fonction récursive pour nettoyer les valeurs undefined (Firestore ne les accepte pas)
const cleanUndefined = (obj: any): any => {
  if (obj === undefined) return '__REMOVE__';
  if (obj === null) return null;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item)).filter(item => item !== '__REMOVE__');
  }
  if (typeof obj === 'object' && obj !== null && obj.constructor === Object) {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = cleanUndefined(value);
      if (cleanedValue !== '__REMOVE__') {
        cleaned[key] = cleanedValue;
      }
    }
    return cleaned;
  }
  return obj;
};

export const getEtudes = async (structureId?: string) => {
  try {
    const etudesRef = collection(db, 'etudes');
    const q = structureId
      ? query(etudesRef, where('structureId', '==', structureId))
      : etudesRef;
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des études:', error);
    throw error;
  }
};

export const getEtude = async (etudeId: string) => {
  try {
    const etudeRef = doc(db, 'etudes', etudeId);
    const etudeDoc = await getDoc(etudeRef);
    if (!etudeDoc.exists()) {
      throw new Error('Étude non trouvée');
    }
    return { id: etudeDoc.id, ...etudeDoc.data() } as Etude;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'étude:', error);
    throw error;
  }
};

export const addEtude = async (etudeData: Omit<Etude, 'id'>) => {
  try {
    const dataToSave = {
      ...etudeData,
      createdAt: new Date()
    };
    const cleanData = cleanUndefined(dataToSave);
    const finalData = Object.fromEntries(
      Object.entries(cleanData).filter(([_, value]) => value !== null && value !== undefined)
    );
    const docRef = await addDoc(collection(db, 'etudes'), finalData);
    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de l\'ajout de l\'étude:', error);
    throw error;
  }
};

export const updateEtude = async (id: string, data: Partial<Etude>) => {
  try {
    const etudeRef = doc(db, 'etudes', id);
    const currentEtude = await getDoc(etudeRef);
    if (!currentEtude.exists()) {
      throw new Error('Étude non trouvée');
    }

    const currentData = currentEtude.data();
    const hasChanges = Object.keys(data).some(key => {
      return JSON.stringify(currentData[key]) !== JSON.stringify(data[key as keyof typeof data]);
    });

    const dataToUpdate = {
      ...data,
      ...(hasChanges ? { updatedAt: new Date() } : {})
    };

    await updateDoc(etudeRef, dataToUpdate);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'étude:', error);
    throw error;
  }
};

export const deleteEtude = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'etudes', id));
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'étude:', error);
    throw error;
  }
};

export const deleteEtudes = async (ids: string[]) => {
  try {
    await Promise.all(ids.map(id => deleteDoc(doc(db, 'etudes', id))));
  } catch (error) {
    console.error('Erreur lors de la suppression des études:', error);
    throw error;
  }
};

// --- Avenants ---

export const addAvenant = async (etudeId: string, avenantData: Omit<Avenant, 'id'>) => {
  try {
    const cleanData = cleanUndefined({
      ...avenantData,
      etudeId,
      createdAt: new Date()
    });
    const docRef = await addDoc(collection(db, 'etudes', etudeId, 'avenants'), cleanData);
    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de l\'ajout de l\'avenant:', error);
    throw error;
  }
};

export const getAvenants = async (etudeId: string) => {
  try {
    const avenantRef = collection(db, 'etudes', etudeId, 'avenants');
    const snapshot = await getDocs(avenantRef);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Avenant[];
  } catch (error) {
    console.error('Erreur lors de la récupération des avenants:', error);
    throw error;
  }
};

export const updateAvenant = async (etudeId: string, avenantId: string, data: Partial<Avenant>) => {
  try {
    const avenantRef = doc(db, 'etudes', etudeId, 'avenants', avenantId);
    await updateDoc(avenantRef, { ...data, updatedAt: new Date() });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'avenant:', error);
    throw error;
  }
};

export const deleteAvenant = async (etudeId: string, avenantId: string) => {
  try {
    await deleteDoc(doc(db, 'etudes', etudeId, 'avenants', avenantId));
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'avenant:', error);
    throw error;
  }
};

// --- Allocation JEH par consultant ---

export const updateConsultantAllocations = async (etudeId: string, allocations: ConsultantJehAllocation[]) => {
  try {
    const etudeRef = doc(db, 'etudes', etudeId);
    await updateDoc(etudeRef, {
      consultantAllocations: cleanUndefined(allocations),
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour des allocations JEH:', error);
    throw error;
  }
};

// --- Checklist qualité ---

export const updateQualityChecklist = async (etudeId: string, checklist: QualityChecklist) => {
  try {
    const etudeRef = doc(db, 'etudes', etudeId);
    await updateDoc(etudeRef, {
      qualityChecklist: checklist,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la checklist qualité:', error);
    throw error;
  }
};

// --- Enquête de satisfaction ---

export const addSatisfactionSurvey = async (etudeId: string, survey: Omit<SatisfactionSurvey, 'id'>) => {
  try {
    const cleanData = cleanUndefined({
      ...survey,
      etudeId,
      submittedAt: new Date()
    });
    const docRef = await addDoc(collection(db, 'etudes', etudeId, 'satisfaction'), cleanData);

    // Mettre à jour le score moyen sur l'étude
    const avgScore = (survey.qualiteLivrable + survey.respectDelais + survey.communication + survey.satisfactionGlobale) / 4;
    await updateDoc(doc(db, 'etudes', etudeId), {
      satisfactionScore: avgScore,
      updatedAt: new Date()
    });

    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de l\'ajout de l\'enquête de satisfaction:', error);
    throw error;
  }
};

export const getSatisfactionSurveys = async (etudeId: string) => {
  try {
    const surveyRef = collection(db, 'etudes', etudeId, 'satisfaction');
    const snapshot = await getDocs(surveyRef);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as SatisfactionSurvey[];
  } catch (error) {
    console.error('Erreur lors de la récupération des enquêtes:', error);
    throw error;
  }
};

// --- Facturation par phase ---

export const updateBudgetItemInvoiceStatus = async (
  etudeId: string,
  budgetItemId: string,
  invoiceStatus: 'a_facturer' | 'facturee' | 'payee',
  invoiceNumber?: string
) => {
  try {
    const budgetItemRef = doc(db, 'etudes', etudeId, 'budgetItems', budgetItemId);
    const updateData: any = {
      invoiceStatus,
      updatedAt: new Date()
    };
    if (invoiceNumber) {
      updateData.invoiceNumber = invoiceNumber;
    }
    if (invoiceStatus === 'facturee') {
      updateData.invoiceDate = new Date().toISOString();
    }
    await updateDoc(budgetItemRef, updateData);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut de facturation:', error);
    throw error;
  }
};
