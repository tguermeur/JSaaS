import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { auth, db } from '../firebase/config';
import { onAuthStateChanged, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { doc, onSnapshot, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ExtendedUser } from '../types/user';
import { createUserDocument, findStructureByEmail } from '../firebase/auth';
import { User } from 'firebase/auth';
import { UserData } from '../types/user';
import { getContactAccessPermissions, ContactAccessPermissions, isContactWithAccess } from '../utils/contactPermissions';

interface AuthContextType {
  currentUser: ExtendedUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<User>;
  isAuthenticated: boolean;
  logoutUser: () => Promise<void>;
  userData: any;
  updateLastActivity: () => Promise<void>;
  contactPermissions: ContactAccessPermissions | null;
  isContactWithAccess: boolean;
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
  contactPermissions: null,
  isContactWithAccess: false,
});

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactPermissions, setContactPermissions] = useState<ContactAccessPermissions | null>(null);
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

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
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
          // Forcer le rafraîchissement du token pour récupérer les Custom Claims
          // lors de la connexion initiale
          user.getIdToken(true).catch(e => console.error("Erreur refresh token initial:", e));

          const userDocRef = doc(db, 'users', user.uid);
          
          // Utiliser onSnapshot pour écouter les changements en temps réel
          unsubscribeSnapshot = onSnapshot(userDocRef, async (userDocSnap) => {
            if (userDocSnap.exists()) {
              let newUserData = userDocSnap.data();
              const isEncrypted = (v: any) => typeof v === 'string' && v.startsWith('ENC:');
              if (isEncrypted(newUserData.displayName) || isEncrypted(newUserData.firstName) || isEncrypted(newUserData.lastName)) {
                try {
                  const decryptOwnUserData = httpsCallable(getFunctions(), 'decryptOwnUserData');
                  const result = await decryptOwnUserData({});
                  const dec = (result.data as any)?.decryptedData;
                  if (dec) {
                    newUserData = {
                      ...newUserData,
                      displayName: (dec.displayName && !isEncrypted(dec.displayName) ? dec.displayName : null) || (dec.firstName || dec.lastName ? `${dec.firstName || ''} ${dec.lastName || ''}`.trim() : null) || newUserData.displayName,
                      firstName: (dec.firstName && !isEncrypted(dec.firstName) ? dec.firstName : newUserData.firstName) ?? newUserData.firstName,
                      lastName: (dec.lastName && !isEncrypted(dec.lastName) ? dec.lastName : newUserData.lastName) ?? newUserData.lastName
                    };
                  }
                } catch (e) {
                  console.warn('Décryptage userData (profil) ignoré:', e);
                }
              }
              
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
            
            // Charger les permissions du contact si c'est un contact avec accès
            if (isContactWithAccess(newUserData) && user.uid) {
              const permissions = await getContactAccessPermissions(user.uid);
              setContactPermissions(permissions);
            } else {
              setContactPermissions(null);
            }
            
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

            // Si structureId ou role a changé, forcer le rafraîchissement du token
            // pour récupérer les nouveaux Custom Claims mis à jour par la Cloud Function
            if (previousData && (
                previousData.structureId !== newImportantFields.structureId || 
                previousData.role !== newImportantFields.role ||
                previousData.status !== newImportantFields.status
            )) {
              console.log("Mise à jour des droits détectée, rafraîchissement du token...");
              user.getIdToken(true).catch(e => console.error("Erreur refresh token:", e));
            }

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
            
            // Charger les permissions du contact si c'est un contact avec accès
            if (isContactWithAccess(newUserData) && user.uid) {
              const permissions = await getContactAccessPermissions(user.uid);
              setContactPermissions(permissions);
            } else {
              setContactPermissions(null);
            }
          } else {
                // Pas de changement significatif - juste lastActivity qui a changé
                // Ne pas mettre à jour l'état pour éviter les re-renders inutiles
                console.log("Changement ignoré (lastActivity uniquement)");
              }
            } else {
              // Document inexistant : essayer de le créer
              console.warn('Document utilisateur inexistant dans Firestore. Tentative de création...');
              // On s'assure que currentUser est mis à jour même si pas de doc Firestore
              setCurrentUser(user as ExtendedUser);
              
              // Essayer de créer le document de manière asynchrone
              createUserDocument(user).catch((createError) => {
                console.error("Erreur lors de la création automatique du document:", createError);
                // Ne pas bloquer l'application si la création échoue
              });
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
          setContactPermissions(null);
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
        console.warn("Document utilisateur non trouvé lors de la mise à jour de l'activité. Tentative de création...");
        // Essayer de créer le document s'il n'existe pas
        if (currentUser) {
          try {
            await createUserDocument(currentUser);
          } catch (createError) {
            console.error("Erreur lors de la création du document pour l'activité:", createError);
          }
        }
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
    updateLastActivity,
    contactPermissions,
    isContactWithAccess: isContactWithAccess(userData)
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