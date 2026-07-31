import { collection, doc, setDoc, getDocs, deleteDoc, query, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from './config';
import { Structure, CreateStructureData } from '../types/structure';

export async function createStructure(structureData: CreateStructureData): Promise<string> {
  try {
    const structuresRef = collection(db, 'structures');
    const newStructureRef = doc(structuresRef);
    
    await setDoc(newStructureRef, {
      ...structureData,
      id: newStructureRef.id,
      createdAt: new Date().toISOString()
    });
    return newStructureRef.id;
  } catch (error) {
    console.error('Erreur lors de la création de la structure:', error);
    throw error;
  }
}


const SUPERADMIN_STRUCTURES_LIMIT = 500;

export async function getStructures(): Promise<Structure[]> {
  const structuresRef = collection(db, 'structures');
  const snapshot = await getDocs(query(structuresRef, limit(SUPERADMIN_STRUCTURES_LIMIT)));
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as Omit<Structure, 'id'>)
  }));
}

export async function deleteStructure(id: string): Promise<void> {
  const structureRef = doc(db, 'structures', id);
  await deleteDoc(structureRef);
}

export async function findStructureByEmail(email: string): Promise<Structure | null> {
  try {
    // Vérifier si l'email est valide
    if (!email || !email.includes('@')) {
      console.log("Email invalide:", email);
      return null;
    }
    
    // Normaliser l'email en minuscules pour la comparaison
    const normalizedEmail = email.toLowerCase().trim();
    const domainStartIndex = normalizedEmail.indexOf('@');
    const fullDomain = normalizedEmail.slice(domainStartIndex);
    
    console.log("Recherche de structure pour l'email:", normalizedEmail);
    console.log("Domaine extrait:", fullDomain);
    
    const resolveFn = httpsCallable<{ email: string }, { structure: Structure | null }>(
      getFunctions(),
      'resolveStructureByEmail'
    );
    const { data } = await resolveFn({ email: normalizedEmail });
    if (data.structure) {
      console.log('✓ Structure trouvée:', data.structure);
      return data.structure;
    }

    console.log('✗ Aucune structure trouvée pour le domaine:', fullDomain);
    return null;
  } catch (error) {
    console.error("Erreur dans findStructureByEmail:", error);
    // Retourner null au lieu de throw pour une meilleure gestion des erreurs
    return null;
  }
}
