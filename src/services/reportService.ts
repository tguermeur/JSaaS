import { collection, addDoc, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface Report {
  type: 'bug' | 'idea';
  content: string;
  userId: string;
  userEmail: string;
  createdAt: string | Date;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
}

export const addReport = async (reportData: Omit<Report, 'status'>) => {
  try {
    const finalReport = {
      ...reportData,
      createdAt: new Date().toISOString(),
      status: 'pending' as const
    };
    await addDoc(collection(db, 'reports'), finalReport);
  } catch (error) {
    console.error('Erreur lors de l\'ajout du rapport:', error);
    throw error;
  }
};

export const getReports = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'reports'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des rapports:', error);
    throw error;
  }
};

export const updateReportStatus = async (reportId: string, status: Report['status']) => {
  try {
    await updateDoc(doc(db, 'reports', reportId), { status });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut:', error);
    throw error;
  }
}; 