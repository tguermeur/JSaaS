import { db } from '../firebase/config';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc, Timestamp } from 'firebase/firestore';
import { AuditDocument, AuditAssignment, DocumentComparison } from '../types/audit';

const AUDIT_DOCUMENTS_COLLECTION = 'auditDocuments';
const AUDIT_ASSIGNMENTS_COLLECTION = 'auditAssignments';
const DOCUMENT_COMPARISONS_COLLECTION = 'documentComparisons';

// Interface pour représenter une mission
export interface Mission {
  id: string;
  numeroMission: string; // Format: "010203"
  description: string;
  company: string;
  location: string;
  auditor: string;
  missionManager: string;
  startDate: Date;
  endDate: Date;
  structureId: string;
  isArchived: boolean;
  archivedAt?: Date;
  archivedBy?: string;
  studentCount: number;
  hours: number;
  status: string;
  chargeId: string;
  chargeName: string;
  chargePhotoURL: string;
  prixHT: number;
  createdAt: string;
  isPublic: boolean;
  etape: 'Négociation' | 'Recrutement' | 'Facturation' | 'Audit';
  auditStatus?: 'audited' | 'not_audited';
}

// Interface pour les données de mission dans Firestore
interface FirestoreMissionData {
  numeroMission: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  studentCount: number;
  hours: number;
  status: string;
  structureId: string;
  chargeId: string;
  chargeName: string;
  description: string;
  prixHT: number;
  createdAt: any;
  isPublic: boolean;
  etape: 'Négociation' | 'Recrutement' | 'Facturation' | 'Audit';
  auditStatus?: 'audited' | 'not_audited';
  auditor?: string;
  missionManager?: string;
}

// Interface pour les données utilisateur
interface UserData {
  displayName: string;
  photoURL: string;
}

// Créer une instance unique du service
const auditService = {
  // Récupérer toutes les missions
  async getMissions(): Promise<Mission[]> {
    try {
      const missionsRef = collection(db, 'missions');
      const missionsSnapshot = await getDocs(missionsRef);
      
      return missionsSnapshot.docs.map(doc => {
        const data = doc.data();
        // Assurez-vous que le numéro de mission est au format "010203"
        const numeroMission = data.numeroMission || '';
        
        return {
          id: doc.id,
          numeroMission: numeroMission,
          company: data.company || '',
          location: data.location || '',
          startDate: data.startDate ? new Date(data.startDate) : new Date(),
          endDate: data.endDate ? new Date(data.endDate) : new Date(),
          studentCount: data.studentCount || 0,
          hours: data.hours || 0,
          status: data.status || 'En attente',
          structureId: data.structureId || '',
          chargeId: data.chargeId || '',
          chargeName: data.chargeName || '',
          chargePhotoURL: data.chargePhotoURL || '',
          description: data.description || '',
          prixHT: data.prixHT || 0,
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          isPublic: data.isPublic || false,
          etape: data.etape || 'Négociation',
          auditStatus: data.auditStatus || 'not_audited',
          auditor: data.auditor || '',
          missionManager: data.missionManager || data.chargeName || '',
          isArchived: data.isArchived || false,
          archivedAt: data.archivedAt ? new Date(data.archivedAt) : undefined,
          archivedBy: data.archivedBy || ''
        };
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des missions:', error);
      throw error;
    }
  },

  // Récupérer les documents d'audit pour une mission spécifique
  async getAuditDocuments(missionId?: string): Promise<AuditDocument[]> {
    try {
      const auditRef = collection(db, 'audit_documents');
      let q = query(auditRef);
      
      if (missionId) {
        q = query(auditRef, where('missionId', '==', missionId));
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          missionId: data.missionId || '',
          status: data.status || 'pending',
          createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate().toISOString() || new Date().toISOString(),
          url: data.url || '',
          description: data.description || '',
          assignedTo: data.assignedTo || '',
          comments: data.comments || []
        } as AuditDocument;
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des documents d\'audit:', error);
      throw error;
    }
  },

  // Mettre à jour le statut d'un document d'audit
  async updateAuditStatus(documentId: string, data: Partial<AuditDocument>): Promise<void> {
    try {
      const docRef = doc(db, 'audit_documents', documentId);
      const updateData = {
        ...data,
        updatedAt: Timestamp.now()
      };
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      throw error;
    }
  },

  // Récupérer les assignations d'audit pour un utilisateur
  async getAuditAssignments(userId?: string): Promise<AuditAssignment[]> {
    try {
      const assignmentsRef = collection(db, 'audit_assignments');
      let q = query(assignmentsRef);
      
      if (userId) {
        q = query(assignmentsRef, where('assignedTo', '==', userId));
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          documentId: data.documentId || '',
          assignedTo: data.assignedTo || '',
          assignedBy: data.assignedBy || '',
          status: data.status || 'pending',
          createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate().toISOString() || new Date().toISOString(),
          dueDate: data.dueDate?.toDate().toISOString() || new Date().toISOString(),
          comments: data.comments || []
        } as AuditAssignment;
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des assignations:', error);
      throw error;
    }
  },

  // Créer une nouvelle assignation d'audit
  async createAuditAssignment(assignment: Omit<AuditAssignment, 'id'>): Promise<string> {
    try {
      const assignmentData = {
        ...assignment,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      const docRef = await addDoc(collection(db, 'audit_assignments'), assignmentData);
      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la création de l\'assignation:', error);
      throw error;
    }
  },

  // Récupérer les comparaisons de documents pour une mission
  async getDocumentComparisons(missionId?: string): Promise<DocumentComparison[]> {
    try {
      const comparisonsRef = collection(db, 'document_comparisons');
      let q = query(comparisonsRef);
      
      if (missionId) {
        q = query(comparisonsRef, where('missionId', '==', missionId));
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DocumentComparison));
    } catch (error) {
      console.error('Erreur lors de la récupération des comparaisons:', error);
      throw error;
    }
  },

  // Ajouter cette fonction après getMissions
  async getMissionById(missionId: string): Promise<Mission | null> {
    try {
      const missionRef = doc(db, 'missions', missionId);
      const missionDoc = await getDoc(missionRef);
      
      if (!missionDoc.exists()) {
        return null;
      }
      
      const data = missionDoc.data();
      return {
        id: missionDoc.id,
        numeroMission: data.numeroMission || '',
        company: data.company || '',
        location: data.location || '',
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        endDate: data.endDate ? new Date(data.endDate) : new Date(),
        studentCount: data.studentCount || 0,
        hours: data.hours || 0,
        status: data.status || 'En attente',
        structureId: data.structureId || '',
        chargeId: data.chargeId || '',
        chargeName: data.chargeName || '',
        chargePhotoURL: data.chargePhotoURL || '',
        description: data.description || '',
        prixHT: data.prixHT || 0,
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        isPublic: data.isPublic || false,
        etape: data.etape || 'Négociation',
        auditStatus: data.auditStatus || 'not_audited',
        auditor: data.auditor || '',
        missionManager: data.missionManager || data.chargeName || '',
        isArchived: data.isArchived || false,
        archivedAt: data.archivedAt ? new Date(data.archivedAt) : undefined,
        archivedBy: data.archivedBy || ''
      };
    } catch (error) {
      console.error('Erreur lors de la récupération de la mission:', error);
      throw error;
    }
  }
};

export { auditService }; 