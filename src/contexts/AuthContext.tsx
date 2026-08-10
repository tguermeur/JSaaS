import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { auth, app, db, getAppFunctions, FUNCTIONS_REGION } from '../firebase/config';
import { onAuthStateChanged, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { doc, onSnapshot, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ExtendedUser } from '../types/user';
import { createUserDocument, findStructureByEmail } from '../firebase/auth';
import { User } from 'firebase/auth';
import { UserData } from '../types/user';
import { getContactAccessPermissions, ContactAccessPermissions, isContactWithAccess } from '../utils/contactPermissions';

// Clés pour le stockage de l'impersonation
// localStorage pour le transfert entre onglets, sessionStorage pour persister dans l'onglet actuel
const IMPERSONATION_STORAGE_KEY = 'superadmin_impersonation';
const IMPERSONATION_SESSION_KEY = 'superadmin_impersonation_session';
const DEBUG_AUTH = import.meta.env.VITE_DEBUG_AUTH === 'true';
const OWN_DECRYPT_CACHE_TTL_MS = 5 * 60 * 1000;
const OWN_DECRYPT_COOLDOWN_MS = 30 * 1000;

let ownDecryptInFlight: Promise<any> | null = null;
let ownDecryptCache: { userId: string; expiresAt: number; data: any } | null = null;
let ownDecryptCooldownUntil = 0;

const clearOwnUserDecryptState = () => {
  ownDecryptCache = null;
  ownDecryptInFlight = null;
  ownDecryptCooldownUntil = 0;
};

interface ImpersonationData {
  originalUserId: string;
  originalUserData: any;
  impersonatedUserId: string;
}

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
  // Fonctions d'impersonation (Run as)
  isImpersonating: boolean;
  impersonatedUserData: any;
  originalUserData: any;
  startImpersonation: (userId: string, openInNewTab?: boolean) => Promise<void>;
  stopImpersonation: () => void;
  // ID effectif de l'utilisateur (impersonné si en mode Run as, sinon currentUser)
  effectiveUserId: string | null;
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
  // Impersonation
  isImpersonating: false,
  impersonatedUserData: null,
  originalUserData: null,
  startImpersonation: async () => {},
  stopImpersonation: () => {},
  effectiveUserId: null,
});

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactPermissions, setContactPermissions] = useState<ContactAccessPermissions | null>(null);
  const previousUserDataRef = useRef<any>(null);
  
  // États pour l'impersonation (Run as)
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUserData, setImpersonatedUserData] = useState<any>(null);
  const [originalUserData, setOriginalUserData] = useState<any>(null);
  
  // Ref pour bloquer les mises à jour de userData par onSnapshot quand on est en mode impersonation
  const isImpersonatingRef = useRef(false);

  const logoutUser = useCallback(async () => {
    try {
      clearOwnUserDecryptState();
      await signOut(auth);
    } catch (err) {
      console.error("Erreur de déconnexion:", err);
      throw err;
    }
  }, []);

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
    if (!auth || !db) {
      setLoading(false);
      return;
    }

    let unsubscribeAuth: (() => void) | null = null;
    let unsubscribeSnapshot: (() => void) | null = null;
    let lastLoginUpdated = false;
    let currentAuthUserUid: string | null = null;
    let cancelled = false;

    const extractImportantFields = (data: Record<string, unknown>) => ({
      displayName: data.displayName,
      role: data.role,
      phone: data.phone,
      address: data.address,
      status: data.status,
      cvUrl: data.cvUrl,
      photoURL: data.photoURL,
      isOnline: data.isOnline,
      structureId: data.structureId,
      email: data.email,
    });

    const applyUserDocData = (user: User, data: Record<string, unknown>) => {
      if (isImpersonatingRef.current) return;
      const fields = extractImportantFields(data);
      setUserData(data);
      previousUserDataRef.current = fields;
      setCurrentUser({
        ...(user as ExtendedUser),
        displayName: (data.displayName as string) || user.displayName,
        role: data.role,
        phone: data.phone,
        address: data.address,
        status: data.status,
        cvUrl: data.cvUrl,
        photoURL: data.photoURL,
        isOnline: data.isOnline,
        structureId: data.structureId,
      } as ExtendedUser);
    };

    const hydrateUserDoc = async (user: User) => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists() || cancelled) return;
        applyUserDocData(user, snap.data());
        const data = snap.data();
        if (isContactWithAccess(data) && user.uid) {
          const permissions = await getContactAccessPermissions(user.uid);
          if (!cancelled) setContactPermissions(permissions);
        }
      } catch (err) {
        console.warn('Hydratation profil Firestore:', err);
      }
    };

    const startAuth = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch {
        /* persistance déjà active ou indisponible */
      }

      // En prod, onAuthStateChanged peut émettre null avant restauration IndexedDB → fausse déconnexion
      await auth.authStateReady();
      if (cancelled) return;

      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (DEBUG_AUTH) console.log("Auth state changed:", user?.uid);
      
      if (user?.uid !== currentAuthUserUid) {
        lastLoginUpdated = false;
        currentAuthUserUid = user?.uid || null;
        previousUserDataRef.current = null;
        clearOwnUserDecryptState();
      }

      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
      
      try {
        if (user) {
          setCurrentUser(user as ExtendedUser);
          setLoading(false);

          const userDocRef = doc(db, 'users', user.uid);

          // Hydratation getDoc immédiate (ne pas attendre onSnapshot — lent en prod)
          void hydrateUserDoc(user);

          const loadingTimeout = setTimeout(() => {
            if (!previousUserDataRef.current && !cancelled) {
              void hydrateUserDoc(user);
            }
          }, 8000);

          void (async () => {
            try {
              await user.getIdToken(true);
            } catch (e) {
              console.error("Erreur refresh token initial:", e);
            }
          })();
          
          unsubscribeSnapshot = onSnapshot(userDocRef, async (userDocSnap) => {
            try {
            if (userDocSnap.exists()) {
              let newUserData = userDocSnap.data();
              const isEncrypted = (v: any) => typeof v === 'string' && v.startsWith('ENC:');
              // Ne jamais bloquer la connexion sur le déchiffrement (lent ou en échec en prod)
              if (isEncrypted(newUserData.displayName)) {
                newUserData = { ...newUserData, displayName: user.displayName || null };
              }

              const runOwnUserDecrypt = async (): Promise<typeof newUserData | null> => {
                if (
                  !isEncrypted(newUserData.firstName) &&
                  !isEncrypted(newUserData.lastName) &&
                  !isEncrypted(newUserData.displayName)
                ) {
                  return null;
                }
                try {
                  const now = Date.now();
                  let dec: any = null;
                  if (ownDecryptCache && ownDecryptCache.userId === user.uid && ownDecryptCache.expiresAt > now) {
                    dec = ownDecryptCache.data;
                  } else if (ownDecryptCooldownUntil <= now) {
                    if (!ownDecryptInFlight) {
                      const functionsInstance = app ? getAppFunctions() : getFunctions();
                      const decryptOwnUserData = httpsCallable(functionsInstance, 'decryptOwnUserData');
                      ownDecryptInFlight = decryptOwnUserData({})
                        .then((result) => {
                          const decrypted = (result.data as any)?.decryptedData;
                          if (decrypted) {
                            ownDecryptCache = {
                              userId: user.uid,
                              data: decrypted,
                              expiresAt: Date.now() + OWN_DECRYPT_CACHE_TTL_MS,
                            };
                          }
                          return decrypted;
                        })
                        .catch((error) => {
                          const code = String((error as any)?.code || '');
                          const message = String((error as any)?.message || '');
                          if (code.includes('resource-exhausted') || message.includes('429')) {
                            ownDecryptCooldownUntil = Date.now() + OWN_DECRYPT_COOLDOWN_MS;
                          }
                          throw error;
                        })
                        .finally(() => {
                          ownDecryptInFlight = null;
                        });
                    }
                    dec = await ownDecryptInFlight;
                  }
                  if (!dec) return null;
                  return {
                    ...newUserData,
                    displayName:
                      (dec.displayName && !isEncrypted(dec.displayName) ? dec.displayName : null) ||
                      (dec.firstName || dec.lastName
                        ? `${dec.firstName || ''} ${dec.lastName || ''}`.trim()
                        : null) ||
                      newUserData.displayName,
                    firstName:
                      (dec.firstName && !isEncrypted(dec.firstName) ? dec.firstName : newUserData.firstName) ??
                      newUserData.firstName,
                    lastName:
                      (dec.lastName && !isEncrypted(dec.lastName) ? dec.lastName : newUserData.lastName) ??
                      newUserData.lastName,
                  };
                } catch (e) {
                  console.warn('Décryptage userData (profil) ignoré:', e);
                  return null;
                }
              };

          // Comparer uniquement les champs importants pour l'UI (exclure TOUS les timestamps)
          const previousData = previousUserDataRef.current;
          
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

            if (!isImpersonatingRef.current) {
              setCurrentUser(extendedUser);
              setUserData(newUserData);
              previousUserDataRef.current = newImportantFields;
            } else {
              console.log("onSnapshot ignoré car en mode impersonation (première fois)");
            }

            setLoading(false);

            // Tâches secondaires sans bloquer l'accès à l'app (critique en prod)
            void (async () => {
              const decryptedData = await runOwnUserDecrypt();
              if (decryptedData && !isImpersonatingRef.current) {
                setUserData(decryptedData);
                setCurrentUser((prev) =>
                  prev
                    ? {
                        ...prev,
                        displayName: decryptedData.displayName || prev.displayName,
                      }
                    : prev
                );
                previousUserDataRef.current = extractImportantFields(decryptedData);
              }

              if (!isImpersonatingRef.current && isContactWithAccess(newUserData) && user.uid) {
                const permissions = await getContactAccessPermissions(user.uid);
                setContactPermissions(permissions);
              }

              const poles = newUserData.poles;
              if (
                Array.isArray(poles) &&
                poles.length > 0 &&
                (!Array.isArray(newUserData.poleIds) || newUserData.poleIds.length === 0)
              ) {
                const poleIds = poles.map((p: any) => p && p.poleId).filter(Boolean);
                if (poleIds.length > 0) {
                  try {
                    await updateDoc(userDocRef, { poleIds });
                  } catch (err) {
                    console.warn('Sync poleIds (règles Firestore):', (err as Error).message);
                  }
                }
              }

              if (!newUserData.lastLogin && !lastLoginUpdated) {
                lastLoginUpdated = true;
                try {
                  await updateDoc(userDocRef, {
                    lastLogin: serverTimestamp(),
                    isOnline: true,
                  });
                } catch (err) {
                  console.warn('Mise à jour lastLogin ignorée:', (err as Error).message);
                }
              }
            })();

            return;
          }

          // Comparer uniquement les champs importants (tous les timestamps sont exclus)
          const hasSignificantChange = 
            JSON.stringify(previousData) !== JSON.stringify(newImportantFields);

          // Ne mettre à jour l'état que si les données importantes ont changé
          if (hasSignificantChange) {
            if (DEBUG_AUTH) console.log("Changement significatif détecté dans les données utilisateur", { previous: previousData, new: newImportantFields });

            // Si structureId ou role a changé, forcer le rafraîchissement du token
            // pour récupérer les nouveaux Custom Claims mis à jour par la Cloud Function
            if (previousData && (
                previousData.structureId !== newImportantFields.structureId || 
                previousData.role !== newImportantFields.role ||
                previousData.status !== newImportantFields.status
            )) {
              console.log("Mise à jour des droits détectée, rafraîchissement du token...");
              try {
                await user.getIdToken(true);
              } catch (e) {
                console.error("Erreur refresh token:", e);
              }
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

            // Vérifier juste avant de mettre à jour si on est en mode impersonation
            if (isImpersonatingRef.current) {
              console.log("onSnapshot ignoré car en mode impersonation (changement significatif)");
            } else {
              // Mettre à jour le profil Firebase Auth si nécessaire (jamais avec une valeur chiffrée)
              const safeDisplayName = typeof newUserData.displayName === 'string' && !newUserData.displayName.startsWith('ENC:')
                ? newUserData.displayName
                : null;
              if (safeDisplayName && safeDisplayName !== user.displayName) {
                if (DEBUG_AUTH) console.log(`Mise à jour du displayName: "${user.displayName}" -> "${safeDisplayName}"`);
                updateProfile(user, { displayName: safeDisplayName })
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
            }
          } else {
                // Pas de changement significatif - juste lastActivity qui a changé
                // Ne pas mettre à jour l'état pour éviter les re-renders inutiles
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
            } catch (innerError) {
              console.error("Erreur dans onSnapshot (auth):", innerError);
            } finally {
              clearTimeout(loadingTimeout);
              setLoading(false);
            }
          }, (error: any) => {
            clearTimeout(loadingTimeout);
            const finishWithUserDoc = () => {
              getDoc(userDocRef)
                .then((snap) => {
                  if (snap.exists() && !isImpersonatingRef.current) {
                    const data = snap.data();
                    setUserData(data);
                    setCurrentUser({
                      ...(user as ExtendedUser),
                      displayName: data.displayName || user.displayName,
                      role: data.role,
                      status: data.status,
                      structureId: data.structureId,
                    });
                  } else {
                    setCurrentUser(user as ExtendedUser);
                  }
                })
                .catch(() => {
                  setCurrentUser(user as ExtendedUser);
                })
                .finally(() => setLoading(false));
            };

            if (error?.code === 'permission-denied') {
              console.warn("Permissions insuffisantes pour l'écoute user — tentative getDoc:", error);
              finishWithUserDoc();
            } else {
              console.error("Erreur lors de l'écoute des changements:", error);
              finishWithUserDoc();
            }
          });
        } else {
          previousUserDataRef.current = null;
          clearOwnUserDecryptState();
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
    };

    void startAuth();

    return () => {
      cancelled = true;
      unsubscribeAuth?.();
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
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      if (msg.includes('INTERNAL ASSERTION') || msg.includes('Unexpected state')) {
        if (DEBUG_AUTH) console.warn("Mise à jour activité ignorée (Firestore indisponible)");
      } else {
        console.error("Erreur lors de la mise à jour de l'activité:", error);
      }
    }
  }, [currentUser]);

  // Fonction pour démarrer l'impersonation (Run as)
  // Si openInNewTab est true, on ne modifie pas l'état local (le nouvel onglet le fera)
  const startImpersonation = useCallback(async (userId: string, openInNewTab = false) => {
    if (!currentUser || !userData) {
      console.error("Utilisateur non connecté");
      return;
    }

    // Vérifier que l'utilisateur actuel est superadmin
    if (userData.status !== 'superadmin' && userData.role !== 'superadmin') {
      console.error("Seul un superadmin peut utiliser la fonction Run as");
      return;
    }

    try {
      // Récupérer les données de l'utilisateur à impersonner
      const targetUserDoc = await getDoc(doc(db, 'users', userId));
      
      if (!targetUserDoc.exists()) {
        console.error("Utilisateur cible non trouvé");
        return;
      }

      let targetUserData = targetUserDoc.data();
      
      // Vérifier si des données sont cryptées et les déchiffrer
      const hasEncryptedData = Object.values(targetUserData).some(value => 
        typeof value === 'string' && value.startsWith('ENC:')
      );
      
      if (hasEncryptedData) {
        try {
          const functions = getFunctions();
          const decryptUserDataForStructure = httpsCallable(functions, 'decryptUserDataForStructure');
          const result = await decryptUserDataForStructure({ userId });
          
          if (result.data && (result.data as any).decryptedData) {
            const decryptedData = (result.data as any).decryptedData;
            targetUserData = {
              ...targetUserData,
              ...decryptedData
            };
            console.log('[Impersonation] Données déchiffrées avec succès');
          }
        } catch (decryptError: any) {
          console.warn('[Impersonation] Impossible de déchiffrer les données:', decryptError.message);
          // Continuer avec les données cryptées si le déchiffrement échoue
        }
      }

      // Stocker les données originales du superadmin
      const impersonationData: ImpersonationData = {
        originalUserId: currentUser.uid,
        originalUserData: userData,
        impersonatedUserId: userId
      };
      
      // Sauvegarder dans localStorage (partagé entre onglets)
      localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(impersonationData));
      console.log("[Impersonation] Données sauvegardées dans localStorage:", impersonationData);

      // Si on ouvre dans un nouvel onglet, ne pas modifier l'état local
      // Le nouvel onglet restaurera l'impersonation depuis localStorage
      if (openInNewTab) {
        console.log(`[Impersonation] Préparé pour nouvel onglet: ${userData.email} -> ${targetUserData.email}`);
        return;
      }

      // Mettre à jour les états (uniquement si pas en mode nouvel onglet)
      setOriginalUserData(userData);
      setImpersonatedUserData({
        ...targetUserData,
        id: userId,
        uid: userId
      });
      
      // Mettre à jour la ref AVANT de changer l'état pour bloquer les onSnapshot
      isImpersonatingRef.current = true;
      setIsImpersonating(true);
      
      // Remplacer userData par les données de l'utilisateur impersonné
      setUserData({
        ...targetUserData,
        id: userId,
        uid: userId
      });

      console.log(`Impersonation démarrée: ${userData.email} -> ${targetUserData.email}`);
    } catch (error) {
      console.error("Erreur lors de l'impersonation:", error);
    }
  }, [currentUser, userData]);

  // Fonction pour arrêter l'impersonation
  const stopImpersonation = useCallback(() => {
    if (!isImpersonating || !originalUserData) {
      return;
    }

    // Mettre à jour la ref AVANT de changer l'état pour permettre les onSnapshot
    isImpersonatingRef.current = false;
    
    // Restaurer les données originales
    setUserData(originalUserData);
    setIsImpersonating(false);
    setImpersonatedUserData(null);
    setOriginalUserData(null);

    // Supprimer des storages
    localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
    sessionStorage.removeItem(IMPERSONATION_SESSION_KEY);

    if (DEBUG_AUTH) console.log("Impersonation arrêtée, retour au compte superadmin");
  }, [isImpersonating, originalUserData]);

  // Restaurer l'impersonation au chargement
  // - Si paramètre URL impersonate=true : charger depuis localStorage (nouveau onglet)
  // - Sinon : charger depuis sessionStorage (refresh dans l'onglet impersonné)
  useEffect(() => {
    const restoreImpersonation = async () => {
      if (DEBUG_AUTH) {
        console.log("[Impersonation] Tentative de restauration...", window.location.href);
      }

      // Vérifier si le paramètre URL impersonate=true est présent (nouvel onglet)
      const urlParams = new URLSearchParams(window.location.search);
      const isNewTab = urlParams.get('impersonate') === 'true';

      // Vérifier d'abord sessionStorage (pour les refresh dans l'onglet impersonné)
      const sessionImpersonation = sessionStorage.getItem(IMPERSONATION_SESSION_KEY);

      // Déterminer la source des données
      let savedImpersonation: string | null = null;

      if (isNewTab) {
        // Nouvel onglet : charger depuis localStorage
        savedImpersonation = localStorage.getItem(IMPERSONATION_STORAGE_KEY);
      } else if (sessionImpersonation) {
        // Refresh dans l'onglet impersonné : charger depuis sessionStorage
        savedImpersonation = sessionImpersonation;
      } else {
        return; // Pas d'impersonation à restaurer
      }
      
      if (savedImpersonation && currentUser && userData) {
        try {
          const impersonationData: ImpersonationData = JSON.parse(savedImpersonation);
          
          // Vérifier que c'est le même superadmin
          if (impersonationData.originalUserId === currentUser.uid) {
            // Récupérer les données fraîches de l'utilisateur impersonné
            const targetUserDoc = await getDoc(doc(db, 'users', impersonationData.impersonatedUserId));
            
            if (targetUserDoc.exists()) {
              let targetUserData = targetUserDoc.data();
              
              // Déchiffrer les données si nécessaire
              const hasEncryptedData = Object.values(targetUserData).some(value => 
                typeof value === 'string' && value.startsWith('ENC:')
              );
              
              if (hasEncryptedData) {
                try {
                  const functions = getFunctions();
                  const decryptUserDataForStructure = httpsCallable(functions, 'decryptUserDataForStructure');
                  const result = await decryptUserDataForStructure({ userId: impersonationData.impersonatedUserId });
                  
                  if (result.data && (result.data as any).decryptedData) {
                    const decryptedData = (result.data as any).decryptedData;
                    targetUserData = {
                      ...targetUserData,
                      ...decryptedData
                    };
                    console.log('[Impersonation] Données déchiffrées avec succès lors de la restauration');
                  }
                } catch (decryptError: any) {
                  console.warn('[Impersonation] Impossible de déchiffrer les données:', decryptError.message);
                }
              }
              
              setOriginalUserData(impersonationData.originalUserData);
              setImpersonatedUserData({
                ...targetUserData,
                id: impersonationData.impersonatedUserId,
                uid: impersonationData.impersonatedUserId
              });
              
              // Mettre à jour la ref AVANT de changer l'état pour bloquer les onSnapshot
              isImpersonatingRef.current = true;
              setIsImpersonating(true);
              
              setUserData({
                ...targetUserData,
                id: impersonationData.impersonatedUserId,
                uid: impersonationData.impersonatedUserId
              });
              
              // Sauvegarder dans sessionStorage pour les futurs refresh de cet onglet
              sessionStorage.setItem(IMPERSONATION_SESSION_KEY, savedImpersonation);
              
              if (isNewTab) {
                // Nettoyer le paramètre URL sans recharger la page
                urlParams.delete('impersonate');
                const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
                window.history.replaceState({}, '', newUrl);
                
                // Supprimer du localStorage pour éviter que d'autres onglets le chargent
                localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
              }
              
              console.log("[Impersonation] ✅ Restauration réussie:", {
                impersonatedUserId: impersonationData.impersonatedUserId,
                impersonatedEmail: targetUserData.email
              });
            }
          }
        } catch (error) {
          console.error("[Impersonation] ❌ Erreur lors de la restauration:", error);
          localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
          sessionStorage.removeItem(IMPERSONATION_SESSION_KEY);
        }
      }
    };

    // Ne restaurer que si le chargement initial est terminé et que l'utilisateur est superadmin
    // et que l'impersonation n'est pas déjà active
    if (DEBUG_AUTH) console.log("[Impersonation] Vérification conditions:", { loading, hasCurrentUser: !!currentUser, hasUserData: !!userData, isImpersonating, userStatus: userData?.status });
    
    if (!loading && currentUser && userData && !isImpersonating && (userData.status === 'superadmin' || userData.role === 'superadmin')) {
      if (DEBUG_AUTH) console.log("[Impersonation] Conditions remplies, lancement de restoreImpersonation");
      restoreImpersonation();
    }
  }, [loading, currentUser, userData, isImpersonating]);

  // Fonction de connexion améliorée
  const login = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      try {
        await userCredential.user.getIdToken(true);
      } catch (tokenErr) {
        console.error("Erreur refresh token après login:", tokenErr);
      }
      await updateLastActivity();
      return userCredential.user;
    } catch (err: any) {
      console.error("Erreur de connexion:", err);
      throw new Error(err.message);
    } finally {
      setLoading(false);
    }
  }, [updateLastActivity]);

  // Calculer l'ID effectif de l'utilisateur (impersonné ou réel)
  const effectiveUserId = isImpersonating && impersonatedUserData?.uid 
    ? impersonatedUserData.uid 
    : currentUser?.uid || null;

  const value = useMemo(
    () => ({
      currentUser,
      userData,
      loading,
      error,
      login,
      isAuthenticated: !!currentUser,
      logoutUser,
      updateLastActivity,
      contactPermissions,
      isContactWithAccess: isContactWithAccess(userData),
      // Impersonation (Run as)
      isImpersonating,
      impersonatedUserData,
      originalUserData,
      startImpersonation,
      stopImpersonation,
      effectiveUserId,
    }),
    [
      currentUser,
      userData,
      loading,
      error,
      login,
      logoutUser,
      updateLastActivity,
      contactPermissions,
      isImpersonating,
      impersonatedUserData,
      originalUserData,
      startImpersonation,
      stopImpersonation,
      effectiveUserId,
    ]
  );

  // Ne jamais masquer toute l'app (sinon /login reste sur « Chargement… » en prod
  // tant que Firestore n'a pas répondu). Les routes protégées gèrent leur propre attente.
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