import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { onAuthStateChanged, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { doc, onSnapshot, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ExtendedUser } from '../types/user';
import { createUserDocument, findStructureByEmail } from '../firebase/auth';
import { User } from 'firebase/auth';
import { UserData } from '../types/user';

interface AuthContextType {
  currentUser: ExtendedUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<User>;
  isAuthenticated: boolean;
  logoutUser: () => Promise<void>;
  userData: any;
  updateLastActivity: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  error: null,
  login: async () => { throw new Error("Login function not implemented"); },
  isAuthenticated: false,
  logoutUser: async () => {},
  userData: null,
  updateLastActivity: async () => {},
});

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const logoutUser = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Erreur de déconnexion:", err);
      throw err;
    }
  };

  const createOrUpdateUserDocument = async (user: User) => {
    try {
      // Créer ou mettre à jour le document utilisateur
      await createUserDocument(user);
    } catch (error) {
      console.error("Erreur lors de la création/mise à jour du document utilisateur:", error);
      throw error;
    }
  };

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;
    let lastLoginUpdated = false; // Ajout du flag pour éviter la boucle

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      console.log("Auth state changed:", user);
      
      // Nettoyer le listener précédent s'il existe
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
      
      try {
        if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          
          // Utiliser onSnapshot pour écouter les changements en temps réel
          unsubscribeSnapshot = onSnapshot(userDocRef, async (userDocSnap) => {
            console.log("User data from Firestore:", userDocSnap.data());
            
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              
              // Mettre à jour la dernière activité seulement si c'est un nouveau login
              if (!userData.lastLogin && !lastLoginUpdated) {
                lastLoginUpdated = true;
                await updateDoc(userDocRef, {
                  lastLogin: serverTimestamp(),
                  isOnline: true
                });
              }

              // Créer un objet utilisateur étendu avec toutes les données
              const extendedUser = {
                ...user,
                displayName: userData.displayName || user.displayName,
                role: userData.role,
                phone: userData.phone,
                address: userData.address,
                status: userData.status,
                cvUrl: userData.cvUrl,
                photoURL: userData.photoURL,
                isOnline: userData.isOnline,
                lastLogin: userData.lastLogin,
                createdAt: userData.createdAt,
                updatedAt: userData.updatedAt,
                structureId: userData.structureId
              };

              // Mettre à jour le profil Firebase Auth si nécessaire
              if (userData.displayName && userData.displayName !== user.displayName) {
                await updateProfile(user, { displayName: userData.displayName });
              }

              setCurrentUser(extendedUser);
              setUserData(userData);
            } else {
              // Document inexistant : on ne fait rien ici pour éviter la boucle infinie
              console.warn('Document utilisateur inexistant dans Firestore. Il doit être créé lors de l\'inscription ou du login.');
              setCurrentUser(user);
            }
            setLoading(false);
          }, (error) => {
            console.error("Erreur lors de l'écoute des changements:", error);
            setLoading(false);
          });
        } else {
          setCurrentUser(null);
          setUserData(null);
          setLoading(false);
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des données:", error);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  // Fonction pour mettre à jour la dernière activité
  const updateLastActivity = async () => {
    if (!currentUser) return;
    
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        await updateDoc(userDocRef, {
          lastActivity: serverTimestamp()
        });
      } else {
        console.warn("Document utilisateur non trouvé lors de la mise à jour de l'activité");
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'activité:", error);
    }
  };

  // Fonction de connexion améliorée
  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await updateLastActivity();
      return userCredential.user;
    } catch (err: any) {
      console.error("Erreur de connexion:", err);
      throw new Error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    currentUser,
    userData,
    loading,
    error,
    login,
    isAuthenticated: !!currentUser,
    logoutUser,
    updateLastActivity
  };

  if (loading) {
    return <div>Chargement...</div>;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
} 