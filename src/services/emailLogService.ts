import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase/config';

export type EmailLogType =
  | 'proposal_request'
  | 'ambassador_announcement'
  | 'member_invite'
  | 'welcome'
  | 'mission_accepted'
  | 'mission_rejected'
  | 'mission_assigned'
  | 'expense_rejected'
  | 'ambassador_application_result'
  | 'trial_ending'
  | 'payment_failed'
  | 'cotisation_due'
  | 'cotisation_paid'
  | 'etude_assigned';

export interface EmailLogEntry {
  type: EmailLogType;
  eventId?: string;
  structureId?: string;
  campusFilter?: string | null;
  recipientsCount?: number;
  sentAt: Date;
  sentByUserId?: string;
  status: 'success' | 'partial' | 'failure';
  errorSummary?: string | null;
}

/**
 * Log minimal des envois d'emails pour préparer un vrai système de notifications.
 * À utiliser côté client (écriture Firestore). Requiert des règles permettant l'ajout.
 */
export async function logEmailSend(entry: EmailLogEntry): Promise<{ ok: boolean; error?: string }> {
  try {
    await addDoc(collection(db, 'emailsLog'), {
      ...entry,
      sentAt: entry.sentAt ?? new Date(),
      campusFilter: entry.campusFilter ?? null,
      errorSummary: entry.errorSummary ?? null,
      createdAt: new Date(),
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Impossible d’écrire le log email.' };
  }
}

