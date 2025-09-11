import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile,
  signOut,
  User,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  applyActionCode,
  ActionCodeSettings
} from 'firebase/auth';
import { auth } from './config';
import { getDoc, doc, setDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

// Exporter auth pour qu'il soit disponible dans d'autres fichiers
export { auth };

// Observer l'état d'authentification
export const authStateObserver = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

interface UserData {
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  graduationYear: string;
  uid: string;
  status: 'etudiant' | 'membre' | 'admin' | 'superadmin';
  structureId: string | null;
  ecole: string | null;
  createdAt: Date;
  photoURL: string | null;
}

interface Structure {
  id: string;
  ecole: string;
  emailDomains: string[];
  nom: string;
  createdAt: string;
}

const SUPER_ADMIN_EMAILS = ['teo.guermeur@gmail.com']; // Liste des emails super admin

export const isSuperAdmin = (email: string) => {
  return SUPER_ADMIN_EMAILS.includes(email);
};

export const findStructureByEmail = async (email: string) => {
  try {
    // Si c'est un super admin, on ne vérifie pas la structure
    if (isSuperAdmin(email)) {
      return {
        id: 'superadmin',
        name: 'SuperAdmin',
        ecole: 'SuperAdmin',
        // autres champs nécessaires...
      };
    }

    const domainStartIndex = email.indexOf('@');
    const fullDomain = email.slice(domainStartIndex);
    
    console.log("Recherche de structure pour le domaine:", fullDomain);
    
    // Vérifier si le domaine est js-connect.fr
    if (fullDomain === '@js-connect.fr') {
      console.log("Domaine js-connect.fr détecté, utilisation de la structure par défaut");
      return {
        id: 'js-connect',
        name: 'JS Connect',
        ecole: 'JS Connect',
        emailDomains: ['@js-connect.fr'],
        createdAt: new Date().toISOString()
      };
    }
    
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
    
    // Si aucune structure n'est trouvée, on retourne une structure par défaut
    // pour éviter l'erreur "Structure non trouvée"
    return {
      id: 'default',
      name: 'Structure par défaut',
      ecole: 'École par défaut',
      emailDomains: [fullDomain],
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error("Erreur lors de la recherche de la structure:", error);
    throw error;
  }
};

export const createUserDocument = async (user: User) => {
  if (!user.email) return;

  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // Données de base pour tous les utilisateurs
      const userData = {
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0], // Utiliser l'email comme fallback
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        isOnline: true
      };

      // Ajouter le rôle super admin si l'email correspond
      if (isSuperAdmin(user.email)) {
        Object.assign(userData, {
          role: 'superadmin',
          structureId: null
        });
      } else {
        // Pour les utilisateurs normaux, chercher leur structure
        const structure = await findStructureByEmail(user.email);
        
        Object.assign(userData, {
          role: 'user',
          structureId: structure.id
        });
      }

      await setDoc(userRef, userData);
      
      // Mettre à jour le profil Firebase Auth avec le displayName
      if (userData.displayName !== user.displayName) {
        await updateProfile(user, { displayName: userData.displayName });
      }
    } else {
      // Mettre à jour lastLogin et isOnline
      await setDoc(userRef, {
        lastLogin: serverTimestamp(),
        isOnline: true
      }, { merge: true });
    }
  } catch (error) {
    console.error("Erreur lors de la création/mise à jour du document utilisateur:", error);
    throw error;
  }
};

// Fonction pour s'inscrire avec gestion des erreurs réseau
export const registerUser = async (
  email: string, 
  password: string, 
  displayName: string
): Promise<User> => {
  try {
    if (!navigator.onLine) {
      throw new Error("Vérifiez votre connexion internet et réessayez.");
    }
    
    console.log('Inscription de l\'utilisateur:', email);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log('Utilisateur créé avec succès:', user.uid);
    
    // Mettre à jour le profil avec le nom d'affichage
    await updateProfile(user, { displayName });
    // (Suppression de l'envoi d'email de vérification)
    return user;
  } catch (error: any) {
    console.error("Erreur lors de l'inscription:", error);
    
    if (error.code === 'auth/network-request-failed') {
      throw new Error("Problème de connexion au serveur d'authentification. Vérifiez votre connexion internet et réessayez.");
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error("Trop de tentatives. Veuillez réessayer dans quelques minutes.");
    }
    
    throw error;
  }
};

// Fonction pour vérifier l'email (maintenant utilisée avec le lien de vérification)
export const verifyEmail = async (oobCode: string): Promise<void> => {
  try {
    await applyActionCode(auth, oobCode);
  } catch (error: any) {
    console.error("Erreur lors de la vérification de l'email:", error);
    if (error.code === 'auth/invalid-action-code') {
      throw new Error("Le lien de vérification est invalide ou a expiré. Veuillez demander un nouveau lien.");
    }
    throw error;
  }
};

// Fonction pour renvoyer l'email de vérification
export const resendVerificationEmail = async (email: string, password: string) => {
  throw new Error("La vérification d'email n'est plus nécessaire.");
};

// Fonction pour se connecter
export const loginUser = async (email: string, password: string) => {
  try {
    console.log("Tentative de connexion avec l'email:", email);
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log("Connexion réussie pour l'utilisateur:", user.uid);

    // Créer/mettre à jour le document utilisateur
    await createUserDocument(user);

    return user;
  } catch (error: any) {
    console.error("Erreur de connexion détaillée:", error);
    
    // Personnaliser les messages d'erreur
    if (error.code === 'auth/invalid-credential') {
      throw new Error("Email ou mot de passe incorrect");
    } else if (error.code === 'auth/user-disabled') {
      throw new Error("Ce compte a été désactivé");
    } else {
      throw new Error(error.message || "Une erreur s'est produite lors de la connexion");
    }
  }
};

// Fonction pour se déconnecter
export const logoutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Erreur lors de la déconnexion:", error);
    throw error;
  }
};

// Fonction pour réinitialiser le mot de passe
export const resetPassword = async (email: string): Promise<void> => {
  const actionCodeSettings = {
    url: window.location.origin + '/login', // URL de redirection après réinitialisation
    handleCodeInApp: true
  };

  try {
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
  } catch (error: any) {
    console.error('Erreur détaillée:', error);
    throw error;
  }
};

export const checkIsAdmin = async (userId: string): Promise<boolean> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      // Vérifier si le rôle est 'superadmin' ou 'admin'
      return userData?.role === 'superadmin' || userData?.role === 'admin';
    }
    return false;
  } catch (error) {
    console.error("Erreur lors de la vérification du rôle admin:", error);
    return false;
  }
};

// Fonction pour mettre à jour les domaines d'email d'une structure
export const updateStructureEmailDomains = async (structureId: string, newDomains: string[]) => {
  try {
    const structureRef = doc(db, 'structures', structureId);
    await setDoc(structureRef, {
      emailDomains: newDomains
    }, { merge: true });
    
    console.log("Domaines d'email mis à jour avec succès pour la structure:", structureId);
    return true;
  } catch (error) {
    console.error("Erreur lors de la mise à jour des domaines d'email:", error);
    throw error;
  }
};

// Fonction pour ajouter le domaine js-connect.fr à toutes les structures
export const addJsConnectDomainToAllStructures = async () => {
  try {
    console.log("Ajout du domaine js-connect.fr à toutes les structures...");
    
    const structuresRef = collection(db, 'structures');
    const snapshot = await getDocs(structuresRef);
    
    let updatedCount = 0;
    
    for (const doc of snapshot.docs) {
      const structure = { ...doc.data(), id: doc.id } as Structure;
      
      // Vérifier si emailDomains existe
      if (!structure.emailDomains || !Array.isArray(structure.emailDomains)) {
        // Si emailDomains n'existe pas, le créer avec le nouveau domaine
        await setDoc(doc.ref, {
          emailDomains: ['@js-connect.fr']
        }, { merge: true });
        updatedCount++;
        continue;
      }
      
      // Vérifier si le domaine existe déjà
      const domainExists = structure.emailDomains.some(domain => {
        const domainWithAt = domain.startsWith('@') ? domain : '@' + domain;
        return domainWithAt === '@js-connect.fr';
      });
      
      if (!domainExists) {
        // Ajouter le nouveau domaine
        const updatedDomains = [...structure.emailDomains, '@js-connect.fr'];
        await setDoc(doc.ref, {
          emailDomains: updatedDomains
        }, { merge: true });
        updatedCount++;
      }
    }
    
    console.log(`Domaine js-connect.fr ajouté à ${updatedCount} structures.`);
    return updatedCount;
  } catch (error) {
    console.error("Erreur lors de l'ajout du domaine js-connect.fr:", error);
    throw error;
  }
};

// Fonction pour vérifier la configuration Firebase
export const checkFirebaseConfig = () => {
  console.log("Vérification de la configuration Firebase:");
  console.log("- Domaine d'authentification:", auth.config.authDomain);
  console.log("- API Key définie:", auth.config.apiKey ? "Oui" : "Non");
  
  // Vérifier si le domaine d'authentification correspond à celui attendu
  const expectedDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  
  if (auth.config.authDomain !== expectedDomain) {
    console.error("ATTENTION: Le domaine d'authentification ne correspond pas à celui attendu!");
    console.error("- Attendu:", expectedDomain);
    console.error("- Actuel:", auth.config.authDomain);
    console.error("Cela peut causer des problèmes d'authentification. Veuillez vérifier les variables d'environnement.");
  } else {
    console.log("Le domaine d'authentification correspond à celui attendu.");
  }
  
  // Vérifier si nous sommes en production ou en développement
  const isProduction = import.meta.env.PROD;
  console.log("- Environnement:", isProduction ? "Production" : "Développement");
  
  // Vérifier l'URL actuelle
  console.log("- URL actuelle:", window.location.hostname);
  
  return {
    authDomain: auth.config.authDomain,
    apiKeyDefined: !!auth.config.apiKey,
    matchesExpected: auth.config.authDomain === expectedDomain,
    isProduction,
    currentHostname: window.location.hostname
  };
}; 