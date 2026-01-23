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
    
    // Normaliser l'email en minuscules pour la comparaison
    const normalizedEmail = email.toLowerCase().trim();
    const domainStartIndex = normalizedEmail.indexOf('@');
    const fullDomain = normalizedEmail.slice(domainStartIndex);
    
    console.log("Recherche de structure pour l'email:", normalizedEmail);
    console.log("Domaine extrait:", fullDomain);
    
    const structuresRef = collection(db, 'structures');
    const snapshot = await getDocs(structuresRef);
    
    console.log(`Nombre de structures trouvées dans Firestore: ${snapshot.docs.length}`);
    
    for (const doc of snapshot.docs) {
      const structure = { ...doc.data(), id: doc.id } as Structure;
      
      // Vérifier si emailDomains existe
      if (!structure.emailDomains || !Array.isArray(structure.emailDomains)) {
        console.warn(`Structure "${structure.ecole || structure.name || structure.id}" sans emailDomains:`, structure);
        continue;
      }
      
      console.log(`Vérification de la structure "${structure.ecole || structure.name || structure.id}" avec domaines:`, structure.emailDomains);
      
      const found = structure.emailDomains.some(domain => {
        // Normaliser le domaine stocké
        const normalizedDomain = domain.toLowerCase().trim();
        const domainWithAt = normalizedDomain.startsWith('@') ? normalizedDomain : '@' + normalizedDomain;
        
        console.log(`  Comparaison: "${fullDomain}" === "${domainWithAt}" ?`, fullDomain === domainWithAt);
        return fullDomain === domainWithAt;
      });

      if (found) {
        console.log("✓ Structure trouvée:", structure);
        return structure;
      }
    }
    
    console.log("✗ Aucune structure trouvée pour le domaine:", fullDomain);
    console.log("Vérifiez que le domaine est bien configuré dans Firestore avec le format '@domaine.com' ou 'domaine.com'");
    return null;
  } catch (error) {
    console.error("Erreur dans findStructureByEmail:", error);
    // Retourner null au lieu de throw pour une meilleure gestion des erreurs
    return null;
  }
}
