/** Consent wording — must match frontend `src/types/signature.ts`. */
export const SIGNATURE_CONSENT_WORDING =
  'Je reconnais avoir lu l’intégralité du document et je signe électroniquement ce document en pleine connaissance de cause.';

export const ACCESS_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
export const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 20;

export type SignatureRequestStatus =
  | 'draft'
  | 'pending'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type SignatureSignerStatus = 'pending' | 'opened' | 'signed' | 'declined';

export type SignatureEventType =
  | 'created'
  | 'email_sent'
  | 'email_failed'
  | 'link_opened'
  | 'document_viewed'
  | 'consent_accepted'
  | 'signed'
  | 'sealed'
  | 'cancelled'
  | 'reminder_sent';
