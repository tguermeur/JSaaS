/**
 * Envoi d'une annonce “nouveau salon ambassadeur” via EmailJS côté client.
 * EmailJS refuse les appels serveur (403 "non-browser"), on envoie depuis le navigateur avec la Public Key.
 */

import emailjs from '@emailjs/browser';

const PUBLIC_KEY = (import.meta.env.VITE_EMAILJS_USER_ID ?? '').trim();
const SERVICE_ID = (import.meta.env.VITE_EMAILJS_SERVICE_ID ?? '').trim();
const TEMPLATE_ID = (import.meta.env.VITE_EMAILJS_TEMPLATE_ID_AMBASSADOR_EVENT_ANNOUNCEMENT ?? '').trim();
const BASE_URL = (
  (import.meta.env.VITE_APP_URL as string | undefined)?.trim() ||
  (typeof window !== 'undefined' ? window.location.origin : '') ||
  'https://js-connect.fr'
).replace(/\/$/, '');

export interface AmbassadorEventAnnouncementParams {
  to_email: string;
  subject: string;
  event_title: string;
  event_location: string;
  event_start: string;
  event_end: string;
  cta_url: string;
  custom_message: string;
  company_name: string;
  structure_name: string;
  logo_url?: string;
}

export function isEmailJsAmbassadorAnnouncementConfigured(): boolean {
  return !!(PUBLIC_KEY && SERVICE_ID && TEMPLATE_ID);
}

export async function sendAmbassadorEventAnnouncementEmail(
  params: AmbassadorEventAnnouncementParams
): Promise<{ ok: boolean; error?: string }> {
  if (!PUBLIC_KEY || !SERVICE_ID || !TEMPLATE_ID) {
    return {
      ok: false,
      error:
        'EmailJS non configuré. Définissez VITE_EMAILJS_USER_ID, VITE_EMAILJS_SERVICE_ID et VITE_EMAILJS_TEMPLATE_ID_AMBASSADOR_EVENT_ANNOUNCEMENT.',
    };
  }

  const toEmail = (params.to_email || '').trim().toLowerCase();
  if (!toEmail || !toEmail.includes('@')) {
    return { ok: false, error: 'Adresse email destinataire invalide.' };
  }

  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        ...params,
        to_email: toEmail,
        logo_url: (params.logo_url || `${BASE_URL}/images/logo.png`).trim(),
      },
      { publicKey: PUBLIC_KEY }
    );
    return { ok: true };
  } catch (err: unknown) {
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

