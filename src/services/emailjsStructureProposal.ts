/**
 * Demande de proposition commerciale via le template EmailJS générique
 * (même slot que les notifs transactionnelles — limite plan 6 templates).
 */

import emailjs from '@emailjs/browser';

const PUBLIC_KEY = (import.meta.env.VITE_EMAILJS_USER_ID ?? '').trim();
const SERVICE_ID = (import.meta.env.VITE_EMAILJS_SERVICE_ID ?? '').trim();
/** Priorité : générique → member invite (alias) → ancien STRUCTURE_PROPOSAL */
const TEMPLATE_ID = (
  import.meta.env.VITE_EMAILJS_TEMPLATE_ID_GENERIC ??
  import.meta.env.VITE_EMAILJS_TEMPLATE_ID_MEMBER_INVITE ??
  import.meta.env.VITE_EMAILJS_TEMPLATE_ID_STRUCTURE_PROPOSAL ??
  ''
).trim();
const BASE_URL = (
  (import.meta.env.VITE_APP_URL as string | undefined)?.trim() ||
  (typeof window !== 'undefined' ? window.location.origin : '') ||
  'https://js-connect.fr'
).replace(/\/$/, '');

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface StructureProposalEmailParams {
  to_email: string;
  subject: string;
  company_name: string;
  event_title: string;
  event_location: string;
  event_dates: string;
  event_link: string;
  requested_by_name: string;
  logo_url?: string;
}

export function isEmailJsStructureProposalConfigured(): boolean {
  return !!(PUBLIC_KEY && SERVICE_ID && TEMPLATE_ID);
}

export async function sendStructureProposalRequestEmail(
  params: StructureProposalEmailParams
): Promise<{ ok: boolean; error?: string }> {
  if (!PUBLIC_KEY || !SERVICE_ID || !TEMPLATE_ID) {
    return {
      ok: false,
      error:
        'EmailJS non configuré. Définissez VITE_EMAILJS_USER_ID, VITE_EMAILJS_SERVICE_ID et VITE_EMAILJS_TEMPLATE_ID_GENERIC.',
    };
  }

  const toEmail = (params.to_email || '').trim().toLowerCase();
  if (!toEmail || !toEmail.includes('@')) {
    return { ok: false, error: 'Adresse email destinataire invalide.' };
  }

  const company = escapeHtml(params.company_name || 'Une entreprise');
  const title = escapeHtml(params.event_title || 'Salon');
  const location = escapeHtml(params.event_location || '—');
  const dates = escapeHtml(params.event_dates || '—');
  const by = escapeHtml(params.requested_by_name || 'Un contact');
  const eventLink = (params.event_link || BASE_URL).trim();

  const body_html = [
    'Bonjour,',
    '<br /><br />',
    `<strong>${company}</strong> vient de demander une proposition commerciale pour un salon ambassadeur.`,
    '<br /><br />',
    `<strong>Titre :</strong> ${title}<br />`,
    `<strong>Lieu :</strong> ${location}<br />`,
    `<strong>Dates :</strong> ${dates}<br />`,
    `<strong>Demandé par :</strong> ${by}`,
    '<br /><br />',
    'Consultez l’événement pour préparer la proposition :',
  ].join('');

  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email: toEmail,
        subject: params.subject || `Proposition commerciale — ${params.event_title || 'salon'}`,
        header_title: 'Demande de proposition commerciale',
        header_subtitle: params.company_name || 'Ambassadeurs',
        body_html,
        cta_label: 'Voir l’événement',
        cta_link: eventLink,
        logo_url: (params.logo_url || `${BASE_URL}/images/logo.png?v=2`).trim(),
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
