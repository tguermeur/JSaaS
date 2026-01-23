import { collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc, deleteDoc, serverTimestamp, writeBatch, getDoc } from 'firebase/firestore';
import { db } from './config';
import { consumeToken, restoreToken } from '../services/tokenService';

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
  if (!prospectData.structureId) {
    throw new Error('Structure ID requis pour créer un prospect');
  }

  // Vérifier et consommer un token
  console.log(`[createProspect] Tentative de consommation d'un token pour structure ${prospectData.structureId}`);
  const tokenResult = await consumeToken(prospectData.structureId);
  console.log(`[createProspect] Résultat consommation token:`, tokenResult);
  
  if (!tokenResult.success) {
    const errorMsg = tokenResult.error || 'Quota mensuel de tokens atteint';
    console.error(`[createProspect] Échec consommation token: ${errorMsg}`);
    throw new Error(errorMsg);
  }
  
  console.log(`[createProspect] Token consommé avec succès. Tokens restants: ${tokenResult.tokensRemaining}`);

  try {
    const prospectsRef = collection(db, 'prospects');
    const docRef = await addDoc(prospectsRef, {
      ...prospectData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return docRef.id;
  } catch (error) {
    // En cas d'erreur, restaurer le token
    await restoreToken(prospectData.structureId);
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
    // Utiliser une transaction batch pour supprimer le prospect et ses événements associés
    const batch = writeBatch(db);
    
    // Supprimer le prospect
    const prospectRef = doc(db, 'prospects', id);
    batch.delete(prospectRef);
    
    // Rechercher et supprimer tous les événements de calendrier associés à ce prospect
    const eventsRef = collection(db, 'calendarEvents');
    const eventsQuery = query(
      eventsRef,
      where('prospectId', '==', id)
    );
    const eventsSnapshot = await getDocs(eventsQuery);
    
    // Ajouter tous les événements associés au batch de suppression
    eventsSnapshot.forEach((eventDoc) => {
      batch.delete(eventDoc.ref);
    });
    
    // Exécuter toutes les suppressions en une seule transaction
    await batch.commit();
    
    console.log(`[deleteProspect] Prospect ${id} et ${eventsSnapshot.size} événement(s) associé(s) supprimé(s)`);
  } catch (error) {
    console.error('Erreur lors de la suppression du prospect:', error);
    throw error;
  }
};
