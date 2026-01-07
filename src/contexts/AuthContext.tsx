import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
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
  const previousUserDataRef = useRef<any>(null);

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
    let currentAuthUserUid: string | null = null;

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      console.log("Auth state changed:", user?.uid);
      
      // Réinitialiser le flag si l'utilisateur change
      if (user?.uid !== currentAuthUserUid) {
        lastLoginUpdated = false;
        currentAuthUserUid = user?.uid || null;
      }
      
      // Nettoyer le listener précédent s'il existe
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
      
      try {
        if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          
          // Utiliser onSnapshot pour écouter les changements en temps réel
          unsubscribeSnapshot = onSnapshot(userDocRef, async (userDocSnap) => {
            if (userDocSnap.exists()) {
              const newUserData = userDocSnap.data();
              
              // Mettre à jour la dernière activité seulement si c'est un nouveau login
              if (!newUserData.lastLogin && !lastLoginUpdated) {
                lastLoginUpdated = true;
                await updateDoc(userDocRef, {
                  lastLogin: serverTimestamp(),
                  isOnline: true
                });
              }

          // Comparer uniquement les champs importants pour l'UI (exclure TOUS les timestamps)
          const previousData = previousUserDataRef.current;
          
          // Extraire uniquement les champs qui affectent l'UI
          const extractImportantFields = (data: any) => ({
            displayName: data.displayName,
            role: data.role,
            phone: data.phone,
            address: data.address,
            status: data.status,
            cvUrl: data.cvUrl,
            photoURL: data.photoURL,
            isOnline: data.isOnline,
            structureId: data.structureId,
            email: data.email
          });
          
          const newImportantFields = extractImportantFields(newUserData);
          
          // Si c'est la première fois, toujours mettre à jour
          if (!previousData) {
            const extendedUser = {
              ...user,
              displayName: newUserData.displayName || user.displayName,
              role: newUserData.role,
              phone: newUserData.phone,
              address: newUserData.address,
              status: newUserData.status,
              cvUrl: newUserData.cvUrl,
              photoURL: newUserData.photoURL,
              isOnline: newUserData.isOnline,
              lastLogin: newUserData.lastLogin,
              createdAt: newUserData.createdAt,
              updatedAt: newUserData.updatedAt,
              structureId: newUserData.structureId
            };

            setCurrentUser(extendedUser);
            setUserData(newUserData);
            // Stocker uniquement les champs importants pour la comparaison
            previousUserDataRef.current = newImportantFields;
            setLoading(false);
            return;
          }

          // Comparer uniquement les champs importants (tous les timestamps sont exclus)
          const hasSignificantChange = 
            JSON.stringify(previousData) !== JSON.stringify(newImportantFields);

          // Ne mettre à jour l'état que si les données importantes ont changé
          if (hasSignificantChange) {
            console.log("Changement significatif détecté dans les données utilisateur", {
              previous: previousData,
              new: newImportantFields
            });
            // Créer un objet utilisateur étendu avec toutes les données
            const extendedUser = {
              ...user,
              displayName: newUserData.displayName || user.displayName,
              role: newUserData.role,
              phone: newUserData.phone,
              address: newUserData.address,
              status: newUserData.status,
              cvUrl: newUserData.cvUrl,
              photoURL: newUserData.photoURL,
              isOnline: newUserData.isOnline,
              lastLogin: newUserData.lastLogin,
              createdAt: newUserData.createdAt,
              updatedAt: newUserData.updatedAt,
              structureId: newUserData.structureId
            };

            // Mettre à jour le profil Firebase Auth si nécessaire
            // On ajoute une vérification stricte pour éviter les boucles infinies
            if (newUserData.displayName && 
                newUserData.displayName !== user.displayName) {
              console.log(`Mise à jour du displayName: "${user.displayName}" -> "${newUserData.displayName}"`);
              // Ne pas attendre cette promesse pour éviter de bloquer ou de créer des boucles synchrones
              updateProfile(user, { displayName: newUserData.displayName })
                .catch(err => console.error("Erreur updateProfile:", err));
            }

            setCurrentUser(extendedUser);
            setUserData(newUserData);
            // Stocker uniquement les champs importants pour la prochaine comparaison
            previousUserDataRef.current = newImportantFields;
          } else {
                // Pas de changement significatif - juste lastActivity qui a changé
                // Ne pas mettre à jour l'état pour éviter les re-renders inutiles
                console.log("Changement ignoré (lastActivity uniquement)");
              }
            } else {
              // Document inexistant : on ne fait rien ici pour éviter la boucle infinie
              console.warn('Document utilisateur inexistant dans Firestore. Il doit être créé lors de l\'inscription ou du login.');
              // On s'assure que currentUser est mis à jour même si pas de doc Firestore
              setCurrentUser(user as ExtendedUser);
            }
            setLoading(false);
          }, (error: any) => {
            // Gérer les erreurs de permissions de manière silencieuse lors de la création de compte
            if (error?.code === 'permission-denied') {
              console.warn("Permissions insuffisantes pour lire le document utilisateur. Le document sera créé lors de l'inscription.");
              // Ne pas bloquer l'application si c'est juste une erreur de permissions
              // Le document sera créé lors de l'inscription
              setCurrentUser(user);
              setLoading(false);
            } else {
              console.error("Erreur lors de l'écoute des changements:", error);
              setLoading(false);
            }
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
  const updateLastActivity = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        await updateDoc(userDocRef, {
          lastActivity: serverTimestamp()
        });
        // Le onSnapshot détectera ce changement mais l'ignorera car seul lastActivity a changé
      } else {
        console.warn("Document utilisateur non trouvé lors de la mise à jour de l'activité");
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'activité:", error);
    }
  }, [currentUser]);

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