/**
 * Envoi des emails d'invitation ambassadeur via EmailJS côté client.
 * EmailJS n'accepte que les appels depuis le navigateur (403 "non-browser" en serveur).
 * On utilise uniquement la Public Key (user ID), pas la Private Key.
 */

import emailjs from '@emailjs/browser';

const PUBLIC_KEY = (import.meta.env.VITE_EMAILJS_USER_ID ?? '').trim();
const SERVICE_ID = (import.meta.env.VITE_EMAILJS_SERVICE_ID ?? '').trim();
const TEMPLATE_ID =
  (import.meta.env.VITE_EMAILJS_TEMPLATE_ID_AMBASSADOR ?? import.meta.env.VITE_EMAILJS_TEMPLATE_ID ?? '').trim();
const BASE_URL = (
  (import.meta.env.VITE_APP_URL as string | undefined)?.trim() ||
  (typeof window !== 'undefined' ? window.location.origin : '') ||
  'https://js-connect.fr'
).trim();

export function isEmailJsAmbassadorConfigured(): boolean {
  return !!(PUBLIC_KEY && SERVICE_ID && TEMPLATE_ID);
}

/**
 * Envoie l'email d'invitation ambassadeur via EmailJS (client).
 * À utiliser uniquement dans le navigateur.
 */
export async function sendAmbassadorInviteEmail(toEmail: string): Promise<{ ok: boolean; error?: string }> {
  if (!PUBLIC_KEY || !SERVICE_ID || !TEMPLATE_ID) {
    return {
      ok: false,
      error: 'EmailJS non configuré. Définissez VITE_EMAILJS_USER_ID, VITE_EMAILJS_SERVICE_ID et VITE_EMAILJS_TEMPLATE_ID_AMBASSADOR.',
    };
  }

  const email = (toEmail || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Adresse email destinataire invalide.' };
  }

  const registrationLink = `${BASE_URL.replace(/\/$/, '')}/register?ambassador=true&email=${encodeURIComponent(email)}`;

  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email: email,
        email,
        registration_link: registrationLink,
        subject: 'Invitation à devenir Ambassadeur',
      },
      { publicKey: PUBLIC_KEY }
    );
    return { ok: true };
  } catch (err: unknown) {
    // Le SDK EmailJS lance EmailJSResponseStatus { status, text }, pas Error
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else if (err && typeof err === 'object' && 'status' in err && 'text' in err) {
      const s = err as { status: number; text: string };
      const txt = (s.text || '').trim();
      message = txt ? `EmailJS (${s.status}): ${txt}` : `EmailJS erreur HTTP ${s.status}`;
    } else {
      message = typeof err === 'string' ? err : 'Email non envoyé.';
    }
    return { ok: false, error: message };
  }
}
