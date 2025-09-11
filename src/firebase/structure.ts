import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './config';
import { Structure, CreateStructureData } from '../types/structure';

export async function createStructure(structureData: CreateStructureData): Promise<void> {
  try {
    const structuresRef = collection(db, 'structures');
    const newStructureRef = doc(structuresRef);
    
    await setDoc(newStructureRef, {
      ...structureData,
      id: newStructureRef.id,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erreur lors de la création de la structure:', error);
    throw error;
  }
}


export async function getStructures(): Promise<Structure[]> {
  const structuresRef = collection(db, 'structures');
  const snapshot = await getDocs(structuresRef);
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
    
    const domainStartIndex = email.indexOf('@');
    const fullDomain = email.slice(domainStartIndex);
    
    console.log("Recherche de structure pour le domaine:", fullDomain);
    
    const structuresRef = collection(db, 'structures');
    const snapshot = await getDocs(structuresRef);
    
    for (const doc of snapshot.docs) {
      const structure = { ...doc.data(), id: doc.id } as Structure;
      
      // Vérifier si emailDomains existe
      if (!structure.emailDomains || !Array.isArray(structure.emailDomains)) {
        console.warn("Structure sans emailDomains:", structure);
        continue;
      }
      
      const found = structure.emailDomains.some(domain => {
        const domainWithAt = domain.startsWith('@') ? domain : '@' + domain;
        return fullDomain === domainWithAt;
      });

      if (found) {
        console.log("Structure trouvée:", structure);
        return structure;
      }
    }
    
    console.log("Aucune structure trouvée pour le domaine:", fullDomain);
    return null;
  } catch (error) {
    console.error("Erreur dans findStructureByEmail:", error);
    // Retourner null au lieu de throw pour une meilleure gestion des erreurs
    return null;
  }
}
