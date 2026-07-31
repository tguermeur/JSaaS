import { collection, query, where, getDocs, doc, updateDoc, getDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { MissionSlot } from '../types/mission';

const AMBASSADOR_INVITES = 'ambassadorInvites';
const UNKNOWN_ORGANIZATION_LABEL = 'Organisation inconnue';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '../firebase/config';
import { sendAmbassadorInviteEmail } from './emailjsAmbassador';

let lastEmailError: string | null = null;

/**
 * Ajoute le statut ambassadeur à un utilisateur existant
 */
export const addAmbassadorToUser = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isAmbassador: true,
      updatedAt: new Date()
    });
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de l\'ajout du statut ambassadeur:', error);
    throw error;
  }
};

/**
 * Trouve un utilisateur par son email
 */
export const findUserByEmail = async (email: string) => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email.toLowerCase().trim()));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    };
  } catch (error) {
    console.error('Erreur lors de la recherche de l\'utilisateur:', error);
    throw error;
  }
};

/**
 * Invite un utilisateur à devenir ambassadeur
 * Si l'utilisateur existe, ajoute le statut ambassadeur
 * Sinon, enregistre l'invitation puis tente d'envoyer un email (EmailJS).
 * Si l'email échoue (ex. EmailJS non configuré), l'invitation reste enregistrée.
 */
export const inviteAmbassador = async (
  email: string,
  options?: { invitedBy?: string; structureId?: string | null }
) => {
  try {
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      await addAmbassadorToUser(existingUser.id);
      return {
        success: true,
        action: 'updated',
        message: 'Statut ambassadeur ajouté avec succès',
        emailSent: true
      };
    }

    // Utilisateur n'existe pas : enregistrer l'invitation d'abord
    if (options?.invitedBy) {
      await addAmbassadorInviteRecord(
        email,
        options.invitedBy,
        options.structureId ?? null
      );
    }

    // Envoi email via EmailJS côté client (EmailJS refuse les appels serveur, 403)
    let emailSent = false;
    try {
      const res = await sendAmbassadorInviteEmail(email);
      if (res.ok) {
        emailSent = true;
      } else {
        lastEmailError = res.error ?? 'Email non envoyé.';
        console.warn('Envoi email invitation ambassadeur échoué:', lastEmailError);
      }
    } catch (e: any) {
      lastEmailError = e?.message ?? 'Email non envoyé.';
      console.warn('Envoi email invitation ambassadeur échoué:', lastEmailError);
    }

    if (emailSent) {
      lastEmailError = null;
      return {
        success: true,
        action: 'invited',
        message: "Email d'invitation envoyé avec succès",
        emailSent: true
      };
    }

    const emailHint = lastEmailError
      ? ` ${lastEmailError}`
      : ' (EmailJS non configuré ou erreur).';
    lastEmailError = null;
    return {
      success: true,
      action: 'invited',
      message: `Invitation enregistrée. L'email n'a pas été envoyé.${emailHint} Vous pouvez partager le lien d'inscription manuellement.`,
      emailSent: false
    };
  } catch (error: any) {
    console.error("Erreur lors de l'invitation:", error);
    throw new Error(error.message || "Erreur lors de l'invitation de l'ambassadeur");
  }
};

/**
 * Enregistre une invitation ambassadeur (email envoyé, utilisateur sans compte)
 */
export const addAmbassadorInviteRecord = async (
  email: string,
  invitedBy: string,
  structureId?: string | null
) => {
  try {
    await addDoc(collection(db, AMBASSADOR_INVITES), {
      email: email.toLowerCase().trim(),
      invitedBy,
      structureId: structureId || null,
      createdAt: new Date(),
      status: 'pending'
    });
  } catch (error) {
    console.error('Erreur enregistrement invitation ambassadeur:', error);
    throw error;
  }
};

/**
 * Récupère les invitations en attente (emails invités, pas encore de compte).
 * Filtre par structureId si fourni, sinon par invitedBy si fourni.
 */
export const getAmbassadorInvites = async (
  structureId?: string | null,
  invitedBy?: string | null
) => {
  try {
    const ref = collection(db, AMBASSADOR_INVITES);
    let q;
    if (structureId) {
      q = query(ref, where('structureId', '==', structureId));
    } else if (invitedBy) {
      q = query(ref, where('invitedBy', '==', invitedBy));
    } else {
      q = query(ref);
    }
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<{
      id: string;
      email: string;
      invitedBy: string;
      structureId?: string | null;
      createdAt: any;
      status: string;
    }>;
  } catch (error) {
    console.error('Erreur chargement invitations ambassadeur:', error);
    return [];
  }
};

/**
 * Retourne les emails qui existent déjà dans la collection users (par chunks de 10 pour Firestore 'in')
 */
export const getExistingUserEmails = async (emails: string[]): Promise<Set<string>> => {
  const out = new Set<string>();
  const normalized = [...new Set(emails.map((e) => e.toLowerCase().trim()))];
  for (let i = 0; i < normalized.length; i += 10) {
    const chunk = normalized.slice(i, i + 10);
    const q = query(
      collection(db, 'users'),
      where('email', 'in', chunk)
    );
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const e = (d.data()?.email as string)?.toLowerCase?.();
      if (e) out.add(e);
    });
  }
  return out;
};

/**
 * Supprime une invitation ambassadeur (invités en attente).
 * Nécessite les règles Firestore allow delete sur ambassadorInvites.
 */
export const deleteAmbassadorInvite = async (inviteId: string) => {
  try {
    await deleteDoc(doc(db, AMBASSADOR_INVITES, inviteId));
    return { success: true };
  } catch (error) {
    console.error('Erreur suppression invitation ambassadeur:', error);
    throw error;
  }
};

/**
 * Retire le statut ambassadeur d'un utilisateur (via Cloud Function).
 * Réservé aux admins / même structure.
 */
export const removeAmbassadorFromUser = async (userId: string) => {
  try {
    const functionsInstance = await getFirebaseFunctions();
    if (!functionsInstance) {
      throw new Error('Firebase Functions non disponible');
    }
    const fn = httpsCallable<{ userId: string }, { success: boolean }>(
      functionsInstance,
      'removeAmbassadorFromUser'
    );
    const res = await fn({ userId });
    return (res.data as { success: boolean }) || { success: true };
  } catch (error: any) {
    console.error('Erreur retrait statut ambassadeur:', error);
    throw new Error(error.message || 'Impossible de retirer le statut ambassadeur.');
  }
};

/**
 * Compte les journées positionnées (créneaux assignés) par ambassadeur sur les événements de la structure.
 */
export const getAmbassadorPositionedDays = async (
  structureId: string | null | undefined,
  userIds: string[]
): Promise<Map<string, number>> => {
  const counts = new Map<string, number>();
  userIds.forEach((id) => counts.set(id, 0));
  if (!structureId || userIds.length === 0) return counts;

  try {
    const eventsQuery = query(
      collection(db, 'missions'),
      where('type', '==', 'ambassadeur_event'),
      where('structureId', '==', structureId)
    );
    const eventsSnap = await getDocs(eventsQuery);

    for (const eventDoc of eventsSnap.docs) {
      const slots = (eventDoc.data().slots || []) as MissionSlot[];
      for (const slot of slots) {
        for (const userId of slot.assignedStudentIds || []) {
          if (counts.has(userId)) {
            counts.set(userId, (counts.get(userId) || 0) + 1);
          }
        }
      }
    }
  } catch (error) {
    console.error('Erreur comptage journées ambassadeurs:', error);
  }

  return counts;
};

/**
 * Résout le nom d'entreprise affiché pour un salon ambassadeur.
 * Les événements créés par une structure peuvent avoir company="Organisation inconnue"
 * alors qu'un companyId est renseigné via ambassadorSettings.
 */
export async function resolveAmbassadorEventCompanyName(
  mission: { company?: string; companyId?: string; structureId?: string },
  userData?: { companyName?: string; companyId?: string; structureName?: string; structureId?: string }
): Promise<string> {
  const readCompanyName = async (companyId?: string): Promise<string | null> => {
    if (!companyId) return null;
    try {
      const snap = await getDoc(doc(db, 'companies', companyId));
      if (!snap.exists()) return null;
      const name = (snap.data()?.name as string | undefined)?.trim();
      return name || null;
    } catch {
      return null;
    }
  };

  const fromMissionCompanyId = await readCompanyName(mission.companyId);
  if (fromMissionCompanyId) return fromMissionCompanyId;

  const structureId = mission.structureId || userData?.structureId;
  if (structureId) {
    try {
      const settingsSnap = await getDoc(doc(db, 'ambassadorSettings', structureId));
      const settingsCompanyId = settingsSnap.exists()
        ? (settingsSnap.data()?.companyId as string | undefined)
        : undefined;
      const fromSettings = await readCompanyName(settingsCompanyId);
      if (fromSettings) return fromSettings;
    } catch {
      // ignore
    }
  }

  if (userData?.companyName?.trim()) return userData.companyName.trim();

  const fromUserCompanyId = await readCompanyName(userData?.companyId);
  if (fromUserCompanyId) return fromUserCompanyId;

  const missionCompany = (mission.company || '').trim();
  if (missionCompany && missionCompany !== UNKNOWN_ORGANIZATION_LABEL) return missionCompany;

  if (userData?.structureName?.trim()) return userData.structureName.trim();

  if (structureId) {
    try {
      const structureSnap = await getDoc(doc(db, 'structures', structureId));
      if (structureSnap.exists()) {
        const data = structureSnap.data();
        const structureName = ((data.nom || data.name) as string | undefined)?.trim();
        if (structureName) return structureName;
      }
    } catch {
      // ignore
    }
  }

  return missionCompany || 'Entreprise';
}

/**
 * Récupère les utilisateurs avec le tag ambassadeur (optionnellement filtrés par structure)
 */
export const getAmbassadorUsers = async (structureId?: string | null) => {
  try {
    const usersRef = collection(db, 'users');
    const q = structureId
      ? query(
          usersRef,
          where('isAmbassador', '==', true),
          where('structureId', '==', structureId)
        )
      : query(usersRef, where('isAmbassador', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<{
      id: string;
      email?: string;
      displayName?: string;
      structureId?: string;
      isAmbassador?: boolean;
      [k: string]: any;
    }>;
  } catch (error) {
    console.error('Erreur chargement utilisateurs ambassadeurs:', error);
    return [];
  }
};
