import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '../firebase/config';

/**
 * Invite un contact à rejoindre l'espace entreprise (Cloud Function + EmailJS).
 */
export async function inviteCompanyContactByEmail(
  email: string,
  companyId: string
): Promise<{ ok: boolean; inviteToken?: string; emailOk?: boolean; emailSkipped?: string | null; error?: string }> {
  try {
    const functionsInstance = await getFirebaseFunctions();
    if (!functionsInstance) {
      return { ok: false, error: "Le service Functions n'est pas disponible" };
    }
    const invite = httpsCallable(functionsInstance, 'inviteCompanyContact');
    const res = await invite({ email, companyId });
    const data = res.data as {
      success?: boolean;
      inviteToken?: string;
      emailOk?: boolean;
      emailSkipped?: string | null;
    };
    return {
      ok: !!data.success,
      inviteToken: data.inviteToken,
      emailOk: data.emailOk,
      emailSkipped: data.emailSkipped ?? null,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Impossible d'envoyer l'invitation" };
  }
}

/**
 * Après inscription invite : relie le contact CRM (userId) si trouvé.
 * Non bloquant côté appelant.
 */
export async function linkCompanyContactAfterRegister(
  inviteToken: string
): Promise<{ linked: boolean }> {
  const functionsInstance = await getFirebaseFunctions();
  if (!functionsInstance) {
    return { linked: false };
  }
  const link = httpsCallable(functionsInstance, 'linkCompanyContactAfterRegister');
  const res = await link({ inviteToken });
  const data = res.data as { linked?: boolean };
  return { linked: !!data.linked };
}
