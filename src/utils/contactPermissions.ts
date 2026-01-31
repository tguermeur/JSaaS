import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface ContactAccessPermissions {
  accessLevel: 'read' | 'write' | 'admin';
  canViewEvents: boolean;
  canManageAmbassadors: boolean;
}

/**
 * Récupère les permissions d'accès d'un contact depuis Firestore
 * @param userId - L'ID de l'utilisateur (contact avec accès)
 * @returns Les permissions du contact ou null si non trouvé
 */
export const getContactAccessPermissions = async (
  userId: string
): Promise<ContactAccessPermissions | null> => {
  try {
    // Chercher le contact qui a ce userId
    const contactsQuery = query(
      collection(db, 'contacts'),
      where('userId', '==', userId)
    );
    const contactsSnapshot = await getDocs(contactsQuery);
    
    if (!contactsSnapshot.empty) {
      // Prendre le premier contact trouvé
      const contactDoc = contactsSnapshot.docs[0];
      const contactId = contactDoc.id;
      
      // Récupérer les permissions depuis contactAccess avec l'ID du contact
      const contactAccessRef = doc(db, 'contactAccess', contactId);
      const contactAccessDoc = await getDoc(contactAccessRef);
      
      if (contactAccessDoc.exists()) {
        const data = contactAccessDoc.data();
        return {
          accessLevel: data.accessLevel || 'read',
          canViewEvents: data.canViewEvents || false,
          canManageAmbassadors: data.canManageAmbassadors || false,
        };
      }
    }
    
    return null;
  } catch (error: any) {
    // Gérer spécifiquement les erreurs de permissions
    if (error?.code === 'permission-denied') {
      console.warn('Permissions insuffisantes pour récupérer les permissions du contact:', error);
      return null;
    }
    console.error('Erreur lors de la récupération des permissions du contact:', error);
    return null;
  }
};

/**
 * Vérifie si un utilisateur est un contact avec accès
 * @param userData - Les données utilisateur
 * @returns true si l'utilisateur est un contact avec accès
 */
export const isContactWithAccess = (userData: any): boolean => {
  return userData?.status === 'entreprise' && userData?.companyId;
};
