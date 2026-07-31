import { collection, addDoc, getDocs, updateDoc, doc, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface Report {
  type: 'bug' | 'idea';
  content: string;
  userId: string;
  userEmail: string;
  createdAt: string | Date;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  structureId?: string;
}

export type GetReportsOpts = {
  structureId?: string;
  userId?: string;
};

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

/**
 * Liste les rapports.
 * - Sans filtre : liste globale plafonnée (SuperAdmin), limit 200
 * - Avec userId ou structureId : filtre + limit 100
 */
export const getReports = async (opts?: GetReportsOpts) => {
  try {
    const reportsRef = collection(db, 'reports');
    let q;
    if (opts?.userId) {
      q = query(reportsRef, where('userId', '==', opts.userId), limit(100));
    } else if (opts?.structureId) {
      q = query(reportsRef, where('structureId', '==', opts.structureId), limit(100));
    } else {
      q = query(reportsRef, limit(200));
    }
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
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
