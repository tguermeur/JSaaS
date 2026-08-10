import * as admin from 'firebase-admin';
import axios from 'axios';
import { FieldValue } from 'firebase-admin/firestore';
import {
  getLogoUrl,
  getUserEmail,
  getUserNotificationPreferences,
  NotificationPriority,
  NotificationType,
  shouldSendEmail,
  toAbsoluteUrl,
} from './core';

/**
 * Clés métier (contenu). Toutes passent par UN seul template EmailJS générique
 * (limite plan Free = 6 templates).
 */
export type EmailTemplateKey =
  | 'MEMBER_INVITE'
  | 'COMPANY_CONTACT_INVITE'
  | 'WELCOME'
  | 'MISSION_ACCEPTED'
  | 'MISSION_REJECTED'
  | 'MISSION_ASSIGNED'
  | 'EXPENSE_REJECTED'
  | 'AMBASSADOR_RESULT'
  | 'TRIAL_ENDING'
  | 'PAYMENT_FAILED'
  | 'COTISATION_DUE'
  | 'COTISATION_PAID'
  | 'DOCUMENT_TO_SIGN'
  | 'SIGNATURE_COMPLETED'
  | 'ETUDE_ASSIGNED';

/** Secrets EmailJS communs à toutes les functions qui envoient des mails */
export const EMAILJS_GENERIC_SECRETS = [
  'EMAILJS_SERVICE_ID',
  'EMAILJS_USER_ID',
  'EMAILJS_PRIVATE_KEY',
  'EMAILJS_TEMPLATE_ID_GENERIC',
  // Alias : le slot « Invitation à rejoindre » peut servir de template générique
  'EMAILJS_TEMPLATE_ID_MEMBER_INVITE',
  // Slot dédié signatures (document à signer / signature complétée)
  'EMAILJS_TEMPLATE_ID_SIGNATURE',
  'EMAILJS_TEMPLATE_ID_DOCUMENT_TO_SIGN',
  'EMAILJS_TEMPLATE_ID_SIGNATURE_COMPLETED',
] as const;

const SIGNATURE_KEYS: EmailTemplateKey[] = ['DOCUMENT_TO_SIGN', 'SIGNATURE_COMPLETED'];

function trimEnv(name: string): string {
  const v = process.env[name];
  return typeof v === 'string' ? v.trim() : '';
}

/** Template générique (notifs + invite + proposition + prospection). */
function getGenericTemplateId(): string {
  return (
    trimEnv('EMAILJS_TEMPLATE_ID_GENERIC') ||
    trimEnv('EMAILJS_TEMPLATE_ID_MEMBER_INVITE')
  );
}

/** Template EmailJS pour les mails de signature (slot « Signature »). */
function getSignatureTemplateId(): string {
  return (
    trimEnv('EMAILJS_TEMPLATE_ID_SIGNATURE') ||
    trimEnv('EMAILJS_TEMPLATE_ID_DOCUMENT_TO_SIGN') ||
    trimEnv('EMAILJS_TEMPLATE_ID_SIGNATURE_COMPLETED') ||
    getGenericTemplateId()
  );
}

function resolveTemplateId(key: EmailTemplateKey): string {
  // DOCUMENT_TO_SIGN / SIGNATURE_COMPLETED → slot EmailJS « Signature »
  if (SIGNATURE_KEYS.includes(key)) {
    return getSignatureTemplateId();
  }
  return getGenericTemplateId();
}

function str(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface GenericContent {
  header_title: string;
  header_subtitle: string;
  body_html: string;
  cta_label: string;
  cta_link: string;
}

/**
 * Mappe chaque type d'email + params métier vers le template générique.
 */
function buildGenericContent(
  key: EmailTemplateKey,
  p: Record<string, string | number | null | undefined>
): GenericContent {
  const abs = (field: string, fallback = '/app') =>
    toAbsoluteUrl(str(p[field], fallback));

  switch (key) {
    case 'MEMBER_INVITE': {
      const name = escapeHtml(str(p.structure_name, 'votre structure'));
      return {
        header_title: 'Invitation à rejoindre',
        header_subtitle: str(p.structure_name, 'JS Connect'),
        body_html: `Bonjour,<br /><br />Vous êtes invité(e) à rejoindre <strong>${name}</strong> sur JS Connect.<br /><br />Cliquez sur le bouton ci-dessous pour créer votre compte et accepter l'invitation :`,
        cta_label: 'Rejoindre la structure',
        cta_link: abs('invite_link', '/register'),
      };
    }
    case 'COMPANY_CONTACT_INVITE': {
      const name = escapeHtml(str(p.company_name, 'votre entreprise'));
      return {
        header_title: 'Invitation espace entreprise',
        header_subtitle: str(p.company_name, 'JS Connect'),
        body_html: `Bonjour,<br /><br />Vous êtes invité(e) à rejoindre l'espace entreprise de <strong>${name}</strong> sur JS Connect.<br /><br />Cliquez sur le bouton ci-dessous pour créer votre compte contact et accepter l'invitation :`,
        cta_label: "Rejoindre l'espace entreprise",
        cta_link: abs('invite_link', '/register'),
      };
    }
    case 'WELCOME': {
      const first = escapeHtml(str(p.first_name).trim());
      const hello = first ? `Bonjour ${first},` : 'Bonjour,';
      return {
        header_title: 'Bienvenue sur JS Connect',
        header_subtitle: 'Votre compte est prêt',
        body_html: `${hello}<br /><br />Bienvenue sur <strong>JS Connect</strong> ! Votre compte est prêt.<br /><br />Connectez-vous pour accéder à votre espace :`,
        cta_label: 'Accéder à mon espace',
        cta_link: abs('app_link', '/app'),
      };
    }
    case 'MISSION_ACCEPTED': {
      const title = escapeHtml(str(p.mission_title, 'mission'));
      return {
        header_title: 'Candidature acceptée',
        header_subtitle: str(p.mission_title, 'Mission'),
        body_html: `Bonjour,<br /><br />Bonne nouvelle : votre candidature pour <strong>« ${title} »</strong> a été acceptée.<br /><br />Consultez les détails de la mission :`,
        cta_label: 'Voir la mission',
        cta_link: abs('mission_link'),
      };
    }
    case 'MISSION_REJECTED': {
      const title = escapeHtml(str(p.mission_title, 'mission'));
      return {
        header_title: 'Candidature refusée',
        header_subtitle: str(p.mission_title, 'Mission'),
        body_html: `Bonjour,<br /><br />Votre candidature pour <strong>« ${title} »</strong> n'a pas été retenue.<br /><br />Vous pouvez consulter d'autres missions disponibles :`,
        cta_label: 'Voir la mission',
        cta_link: abs('mission_link'),
      };
    }
    case 'MISSION_ASSIGNED': {
      const title = escapeHtml(str(p.mission_title, 'mission'));
      return {
        header_title: 'Mission assignée',
        header_subtitle: str(p.mission_title, 'Mission'),
        body_html: `Bonjour,<br /><br />Vous avez été assigné(e) à la mission <strong>« ${title} »</strong>.<br /><br />Retrouvez tous les détails ici :`,
        cta_label: 'Voir la mission',
        cta_link: abs('mission_link'),
      };
    }
    case 'EXPENSE_REJECTED': {
      const title = escapeHtml(str(p.mission_title, 'mission'));
      const reason = escapeHtml(str(p.reason, 'Non précisé'));
      return {
        header_title: 'Note de frais refusée',
        header_subtitle: str(p.mission_title, 'Mission'),
        body_html: `Bonjour,<br /><br />Votre note de frais liée à <strong>« ${title} »</strong> a été refusée.<br /><br /><strong>Motif :</strong> ${reason}<br /><br />Vous pouvez consulter la mission pour plus d'informations :`,
        cta_label: 'Voir la mission',
        cta_link: abs('mission_link'),
      };
    }
    case 'AMBASSADOR_RESULT': {
      const title = escapeHtml(str(p.event_title, 'événement'));
      const status = str(p.status, '').toLowerCase();
      const accepted =
        status.includes('accept') ||
        status === 'accepted' ||
        status === 'validée' ||
        status === 'validee' ||
        status === 'approuvée' ||
        status === 'approuvee';
      return {
        header_title: accepted ? 'Candidature acceptée' : 'Candidature refusée',
        header_subtitle: str(p.event_title, 'Ambassadeur'),
        body_html: accepted
          ? `Bonjour,<br /><br />Votre candidature ambassadeur pour <strong>« ${title} »</strong> a été acceptée.<br /><br />Consultez l'événement :`
          : `Bonjour,<br /><br />Votre candidature ambassadeur pour <strong>« ${title} »</strong> n'a pas été retenue.<br /><br />Consultez l'événement :`,
        cta_label: "Voir l'événement",
        cta_link: abs('event_link'),
      };
    }
    case 'TRIAL_ENDING': {
      const name = escapeHtml(str(p.structure_name, 'votre structure'));
      const days = str(p.days_left, '?');
      return {
        header_title: "Fin de période d'essai",
        header_subtitle: str(p.structure_name, 'Abonnement'),
        body_html: `Bonjour,<br /><br />L'essai de <strong>« ${name} »</strong> se termine dans <strong>${escapeHtml(days)} jour(s)</strong>.<br /><br />Pour éviter toute interruption, mettez à jour votre abonnement :`,
        cta_label: 'Gérer mon abonnement',
        cta_link: abs('billing_link', '/app/settings/billing'),
      };
    }
    case 'PAYMENT_FAILED': {
      const name = escapeHtml(str(p.structure_name, 'votre structure'));
      return {
        header_title: 'Échec de paiement',
        header_subtitle: str(p.structure_name, 'Abonnement'),
        body_html: `Bonjour,<br /><br />Le paiement de l'abonnement de <strong>« ${name} »</strong> a échoué.<br /><br />Merci de mettre à jour votre moyen de paiement :`,
        cta_label: 'Mettre à jour le paiement',
        cta_link: abs('billing_link', '/app/settings/billing'),
      };
    }
    case 'COTISATION_DUE': {
      const amount = escapeHtml(str(p.amount));
      const amountLine = amount
        ? `<br /><br />Montant : <strong>${amount}</strong>`
        : '';
      return {
        header_title: 'Cotisation à régler',
        header_subtitle: 'JS Connect',
        body_html: `Bonjour,<br /><br />Votre cotisation est en attente de paiement.${amountLine}<br /><br />Réglez-la dès maintenant :`,
        cta_label: 'Payer ma cotisation',
        cta_link: abs('link', '/app/cotisation'),
      };
    }
    case 'COTISATION_PAID': {
      const amount = escapeHtml(str(p.amount));
      const amountLine = amount
        ? `<br /><br />Montant enregistré : <strong>${amount}</strong>`
        : '';
      return {
        header_title: 'Cotisation payée',
        header_subtitle: 'JS Connect',
        body_html: `Bonjour,<br /><br />Votre cotisation a bien été enregistrée.${amountLine}<br /><br />Merci !`,
        cta_label: 'Accéder à mon espace',
        cta_link: abs('link', '/app'),
      };
    }
    case 'DOCUMENT_TO_SIGN': {
      const title = escapeHtml(str(p.document_title, 'document'));
      const structure = escapeHtml(str(p.structure_name, 'JS Connect'));
      return {
        header_title: 'Signature électronique',
        header_subtitle: str(p.structure_name, title),
        body_html: [
          'Bonjour,',
          '',
          `<strong>${structure}</strong> vous demande de signer le document « ${title} ».`,
          '',
          'Ouvrez le lien sécurisé ci-dessous pour consulter le PDF et signer. Ce lien est personnel : ne le transférez pas.',
          '',
          'Si vous n’êtes pas le destinataire attendu, ignorez cet e-mail.',
        ].join('<br />'),
        cta_label: 'Ouvrir et signer',
        cta_link: abs('sign_link'),
      };
    }
    case 'SIGNATURE_COMPLETED': {
      const title = escapeHtml(str(p.document_title, 'document'));
      const structure = escapeHtml(str(p.structure_name, 'JS Connect'));
      return {
        header_title: 'Signature enregistrée',
        header_subtitle: str(p.structure_name, title),
        body_html: [
          'Bonjour,',
          '',
          `Le document « ${title} » a bien été signé pour <strong>${structure}</strong>.`,
          '',
          'Vous pouvez consulter le document final depuis votre espace JS Connect.',
        ].join('<br />'),
        cta_label: 'Voir le document',
        cta_link: abs('sign_link', '/app/signatures'),
      };
    }
    case 'ETUDE_ASSIGNED': {
      const title = escapeHtml(str(p.etude_title, 'étude'));
      return {
        header_title: 'Étude assignée',
        header_subtitle: str(p.etude_title, 'Étude'),
        body_html: `Bonjour,<br /><br />Vous avez été assigné(e) à l'étude <strong>« ${title} »</strong>.<br /><br />Consultez les détails :`,
        cta_label: "Voir l'étude",
        cta_link: abs('etude_link'),
      };
    }
    default: {
      return {
        header_title: 'Notification JS Connect',
        header_subtitle: 'JS Connect',
        body_html: 'Bonjour,<br /><br />Vous avez une nouvelle notification sur JS Connect.',
        cta_label: 'Ouvrir JS Connect',
        cta_link: toAbsoluteUrl('/app'),
      };
    }
  }
}

export interface SendTemplatedEmailParams {
  templateKey: EmailTemplateKey;
  toEmail: string;
  subject: string;
  templateParams: Record<string, string | number | null | undefined>;
  logType?: string;
  structureId?: string;
  sentByUserId?: string;
  /** Absolute or relative link fields to resolve (compat ; géré aussi dans buildGenericContent) */
  linkFields?: string[];
}

export interface SendEmailResult {
  ok: boolean;
  skipped?: string;
  error?: string;
}

async function logEmail(entry: Record<string, unknown>): Promise<void> {
  try {
    await admin.firestore().collection('emailsLog').add({
      ...entry,
      createdAt: FieldValue.serverTimestamp(),
      sentAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn('emailsLog write failed:', err);
  }
}

/**
 * Send via EmailJS REST API — un seul template générique.
 * Skip si template_id non configuré.
 */
export async function sendTemplatedEmail(
  params: SendTemplatedEmailParams
): Promise<SendEmailResult> {
  const templateId = resolveTemplateId(params.templateKey);
  const serviceId = trimEnv('EMAILJS_SERVICE_ID');
  const userId = trimEnv('EMAILJS_USER_ID');
  const privateKey = trimEnv('EMAILJS_PRIVATE_KEY');

  if (!templateId) {
    console.log(
      `sendTemplatedEmail skip: template non configuré (${params.templateKey})`
    );
    await logEmail({
      type: params.logType || params.templateKey.toLowerCase(),
      status: 'skipped',
      errorSummary: 'EMAILJS_TEMPLATE_ID_GENERIC / SIGNATURE non configuré',
      structureId: params.structureId || null,
      sentByUserId: params.sentByUserId || null,
      toEmail: params.toEmail,
    });
    return { ok: false, skipped: 'template_not_configured' };
  }

  if (!serviceId || !userId || !privateKey) {
    console.warn('sendTemplatedEmail: EmailJS credentials incomplete');
    return { ok: false, skipped: 'credentials_missing' };
  }

  // Résoudre les liens relatifs avant le mapping contenu
  const rawParams: Record<string, string | number | null | undefined> = {
    ...params.templateParams,
  };
  for (const field of params.linkFields || []) {
    if (rawParams[field] != null) {
      rawParams[field] = toAbsoluteUrl(String(rawParams[field]));
    }
  }

  // Nom structure (Firestore utilise surtout `nom`) — avant buildGenericContent + From Name EmailJS.
  let structureName = String(rawParams.structure_name || '').trim();
  if (!structureName && params.structureId) {
    try {
      const snap = await admin.firestore().doc(`structures/${params.structureId}`).get();
      const d = snap.data() || {};
      structureName = String(d.nom || d.name || '').trim();
    } catch (err) {
      console.warn('sendTemplatedEmail: lecture structure name failed', err);
    }
  }
  if (!structureName) structureName = 'JS Connect';
  const fromName = String(rawParams.from_name || structureName).trim() || 'JS Connect';
  rawParams.structure_name = structureName;
  rawParams.from_name = fromName;

  const content = buildGenericContent(params.templateKey, rawParams);

  // Subject : préfixer avec la structure si pas déjà présent (affichage expéditeur côté boîte mail).
  let subject = params.subject;
  if (
    SIGNATURE_KEYS.includes(params.templateKey) &&
    structureName &&
    structureName !== 'JS Connect' &&
    !subject.toLowerCase().includes(structureName.toLowerCase())
  ) {
    subject = `${structureName} — ${subject}`;
  }

  const resolvedParams: Record<string, string> = {
    to_email: params.toEmail,
    subject,
    logo_url: getLogoUrl(),
    header_title: content.header_title,
    header_subtitle: content.header_subtitle || structureName,
    body_html: content.body_html,
    cta_label: content.cta_label,
    cta_link: content.cta_link,
    structure_name: structureName,
    from_name: fromName,
  };

  try {
    await axios.post(
      'https://api.emailjs.com/api/v1.0/email/send',
      {
        service_id: serviceId,
        template_id: templateId,
        user_id: userId,
        accessToken: privateKey,
        template_params: resolvedParams,
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    await logEmail({
      type: params.logType || params.templateKey.toLowerCase(),
      status: 'success',
      structureId: params.structureId || null,
      sentByUserId: params.sentByUserId || null,
      toEmail: params.toEmail,
      recipientsCount: 1,
      templateKey: params.templateKey,
    });
    return { ok: true };
  } catch (err: any) {
    const msg = err?.response?.data || err?.message || 'EmailJS error';
    console.error('sendTemplatedEmail error:', msg);
    await logEmail({
      type: params.logType || params.templateKey.toLowerCase(),
      status: 'failure',
      errorSummary: typeof msg === 'string' ? msg : JSON.stringify(msg).slice(0, 500),
      structureId: params.structureId || null,
      sentByUserId: params.sentByUserId || null,
      toEmail: params.toEmail,
    });
    return { ok: false, error: String(msg) };
  }
}

/**
 * Notify in-app already done separately; optionally email user if prefs allow.
 */
export async function maybeEmailUser(params: {
  userId: string;
  type: NotificationType;
  priority?: NotificationPriority;
  templateKey: EmailTemplateKey;
  subject: string;
  templateParams: Record<string, string | number | null | undefined>;
  linkFields?: string[];
  structureId?: string;
  logType?: string;
}): Promise<SendEmailResult> {
  const priority = params.priority || 'medium';
  const prefs = await getUserNotificationPreferences(params.userId);
  if (!shouldSendEmail(prefs, params.type, priority)) {
    return { ok: false, skipped: 'prefs' };
  }
  const email = await getUserEmail(params.userId);
  if (!email) return { ok: false, skipped: 'no_email' };

  return sendTemplatedEmail({
    templateKey: params.templateKey,
    toEmail: email,
    subject: params.subject,
    templateParams: params.templateParams,
    linkFields: params.linkFields,
    structureId: params.structureId,
    logType: params.logType,
  });
}
