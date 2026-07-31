/** Wording de consentement affiché et stocké tel quel au moment de la signature. */
export const SIGNATURE_CONSENT_WORDING =
  'Je reconnais avoir lu l’intégralité du document et je signe électroniquement ce document en pleine connaissance de cause.';

export type SignatureRequestStatus =
  | 'draft'
  | 'pending'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type SignatureSignerStatus =
  | 'pending'
  | 'opened'
  | 'signed'
  | 'declined';

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

export interface SignatureRequestSource {
  type: 'generatedDocument';
  id: string;
  missionId?: string | null;
  missionNumber?: string | null;
  missionTitle?: string | null;
}

export interface SignatureDocumentMeta {
  title: string;
  storagePath: string;
  contentType: string;
  sha256Before: string;
  byteSize: number;
}

export interface SignatureSealedMeta {
  storagePath: string;
  documentOnlyStoragePath?: string;
  sha256After: string;
  sha256DocumentOnly?: string;
  sealedAt?: Date | null;
}

export interface SignatureSignerInput {
  email: string;
  name: string;
  phone?: string;
  userId?: string;
  order?: number;
}

/** Vue client (sans hashes de tokens). */
export interface SignatureSignerPublic {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  userId?: string | null;
  order: number;
  status: SignatureSignerStatus;
  signedAt?: Date | null;
  consentAcceptedAt?: Date | null;
  consentWordingSnapshot?: string | null;
}

export interface SignatureField {
  id: string;
  /** Index du signataire (0-based) au moment de la création ; mappé en signerId côté serveur. */
  signerOrder: number;
  signerId?: string | null;
  pageIndex: number;
  /** Coordonnées en % de la page (origine haut-gauche). */
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  label?: string;
}

export interface SignatureRequest {
  id: string;
  structureId: string;
  createdBy: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  status: SignatureRequestStatus;
  source: SignatureRequestSource;
  document: SignatureDocumentMeta;
  sealed?: SignatureSealedMeta | null;
  consentWording: string;
  signers: SignatureSignerPublic[];
  signatureFields?: SignatureField[];
  smsReady: boolean;
  expiresAt?: Date | null;
}

export interface SignatureEvent {
  id: string;
  type: SignatureEventType;
  at?: Date | null;
  actor?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown>;
}
