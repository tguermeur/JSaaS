import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '../firebase/config';

/**
 * Invite un membre à rejoindre la structure (Cloud Function + EmailJS).
 */
export async function inviteStructureMemberByEmail(
  email: string,
  role?: string
): Promise<{ ok: boolean; emailOk?: boolean; emailSkipped?: string | null; error?: string }> {
  try {
    const functionsInstance = getFirebaseFunctions();
    if (!functionsInstance) {
      return { ok: false, error: "Le service Functions n'est pas disponible" };
    }
    const invite = httpsCallable(functionsInstance, 'inviteStructureMember');
    const res = await invite({ email, role });
    const data = res.data as { success?: boolean; emailOk?: boolean; emailSkipped?: string | null };
    return {
      ok: !!data.success,
      emailOk: data.emailOk,
      emailSkipped: data.emailSkipped ?? null,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Impossible d'envoyer l'invitation" };
  }
}
