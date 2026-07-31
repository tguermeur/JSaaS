import { onCall, HttpsError } from 'firebase-functions/v2/https';

/**
 * Phase 2 — OTP SMS (Twilio). Stubs only in v1.
 */
export const sendSignerOtp = onCall(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30 },
  async () => {
    throw new HttpsError(
      'unimplemented',
      'OTP SMS non disponible en v1. Prévoir Twilio en phase 2.'
    );
  }
);

export const verifySignerOtp = onCall(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30 },
  async () => {
    throw new HttpsError(
      'unimplemented',
      'OTP SMS non disponible en v1. Prévoir Twilio en phase 2.'
    );
  }
);
