/**
 * Prospection (démarchage) via le template EmailJS générique.
 * Plus de slot dédié « Mail démarchage » (limite plan 6 templates).
 */

import emailjs from '@emailjs/browser';
import { getFeaturesUrl, type FeaturesProfileType } from '../utils/featuresLinks';

const PUBLIC_KEY = (import.meta.env.VITE_EMAILJS_USER_ID ?? '').trim();
const SERVICE_ID = (import.meta.env.VITE_EMAILJS_SERVICE_ID ?? '').trim();
const TEMPLATE_ID = (
  import.meta.env.VITE_EMAILJS_TEMPLATE_ID_GENERIC ??
  import.meta.env.VITE_EMAILJS_TEMPLATE_ID_MEMBER_INVITE ??
  import.meta.env.VITE_EMAILJS_TEMPLATE_DEM1 ??
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

export interface DemarchageEmailParams {
  to_email: string;
  firstName: string;
  lastName: string;
  position?: string;
  prospectName: string;
  /** Profil cible pour le lien "Fonctionnalités" : junior | company | student. Par défaut : junior. */
  profile?: FeaturesProfileType;
}

export function isEmailJsDemarchageConfigured(): boolean {
  return !!(PUBLIC_KEY && SERVICE_ID && TEMPLATE_ID);
}

const DEFAULT_SUBJECT = 'Votre JE jongle encore avec 5 outils qui datent de 2006 ?';

/**
 * Envoie l'email de prospection via EmailJS (client) — template générique.
 */
export async function sendDemarchageEmailClient(
  params: DemarchageEmailParams
): Promise<{ ok: boolean; error?: string }> {
  if (!PUBLIC_KEY || !SERVICE_ID || !TEMPLATE_ID) {
    return {
      ok: false,
      error:
        'EmailJS non configuré. Définissez VITE_EMAILJS_USER_ID, VITE_EMAILJS_SERVICE_ID et VITE_EMAILJS_TEMPLATE_ID_GENERIC.',
    };
  }

  const email = (params.to_email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Adresse email destinataire invalide.' };
  }

  const first = escapeHtml(params.firstName || '');
  const hello = first ? `Bonjour ${first},` : 'Bonjour,';
  const demoUrl = getFeaturesUrl(params.profile ?? 'junior', BASE_URL);
  const trialUrl = `${BASE_URL}/register?type=structure`;

  const body_html = [
    hello,
    '<br /><br />',
    'Votre Junior-Entreprise jongle encore avec trop d’outils ?',
    '<br /><br />',
    '<strong>JS Connect</strong> centralise missions, commercial, signatures et trésorerie dans une seule plateforme.',
    '<br /><br />',
    'Découvrez les fonctionnalités ou démarrez un essai :',
  ].join('');

  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email: email,
        subject: DEFAULT_SUBJECT,
        header_title: 'JS Connect',
        header_subtitle: 'La plateforme des Junior-Entreprises',
        body_html,
        cta_label: 'Découvrir les fonctionnalités',
        cta_link: demoUrl,
        // Lien essai aussi accessible via le texte du body si besoin côté template générique (CTA principal = démo)
        lien_essai: trialUrl,
        logo_url: `${BASE_URL}/images/logo.png?v=2`,
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
      message = txt ? `EmailJS (${s.status}): ${txt}` : `EmailJS erreur ${s.status}`;
    } else {
      message = typeof err === 'string' ? err : 'Email non envoyé.';
    }
    return { ok: false, error: message };
  }
}
