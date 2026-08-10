/** Helpers d’erreurs Firebase client (Firestore / Callable). */

export function getFirebaseErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const e = error as { code?: string; name?: string };
  return typeof e.code === 'string' ? e.code : '';
}

export function isFirestorePermissionDenied(error: unknown): boolean {
  const code = getFirebaseErrorCode(error);
  return code === 'permission-denied' || code === 'firestore/permission-denied';
}

export function isFunctionsResourceExhausted(error: unknown): boolean {
  const code = getFirebaseErrorCode(error);
  return code === 'resource-exhausted' || code === 'functions/resource-exhausted';
}

export function getFirebaseErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const e = error as { message?: string };
  return typeof e.message === 'string' ? e.message : '';
}
