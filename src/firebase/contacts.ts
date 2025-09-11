import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import { db } from "./config";

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position?: string;
  phone?: string;
  linkedin?: string;
  createdAt: Date;
  createdBy: string;
  isDefault: boolean;
  companyId: string;
  structureId: string;
  notes?: ContactNote[];
}

export interface ContactNote {
  id: string;
  content: string;
  createdAt: Date;
  createdBy: string;
}

// Créer un nouveau contact
export const createContact = async (contact: Omit<Contact, 'id' | 'createdAt'>) => {
  const contactsRef = collection(db, 'contacts');
  const newContactRef = doc(contactsRef);
  
  const contactData = {
    ...contact,
    id: newContactRef.id,
    createdAt: serverTimestamp()
  };

  await setDoc(newContactRef, contactData);
  return { id: newContactRef.id, ...contactData };
};

// Récupérer un contact par son ID
export const getContact = async (contactId: string) => {
  const contactDoc = await getDoc(doc(db, 'contacts', contactId));
  if (!contactDoc.exists()) return null;
  
  const data = contactDoc.data();
  return {
    id: contactDoc.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date()
  } as Contact;
};

// Récupérer tous les contacts d'une entreprise
export const getCompanyContacts = async (companyId: string) => {
  const contactsQuery = query(
    collection(db, 'contacts'),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(contactsQuery);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date()
  })) as Contact[];
};

// Mettre à jour un contact
export const updateContact = async (contactId: string, data: Partial<Contact>) => {
  const contactRef = doc(db, 'contacts', contactId);
  await updateDoc(contactRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
};

// Supprimer un contact
export const deleteContact = async (contactId: string) => {
  await deleteDoc(doc(db, 'contacts', contactId));
};

// Définir un contact comme contact par défaut
export const setDefaultContact = async (contactId: string, companyId: string) => {
  const contactsQuery = query(
    collection(db, 'contacts'),
    where('companyId', '==', companyId)
  );
  
  const snapshot = await getDocs(contactsQuery);
  const batch = writeBatch(db);
  
  snapshot.docs.forEach(doc => {
    const contactRef = doc.ref;
    batch.update(contactRef, {
      isDefault: doc.id === contactId
    });
  });
  
  await batch.commit();
}; 