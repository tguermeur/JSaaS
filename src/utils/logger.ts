type LogContext = Record<string, unknown>;

export function logError(scope: string, error: unknown, context?: LogContext): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${scope}]`, message, context ?? '');
  if (import.meta.env.PROD && typeof window !== 'undefined') {
    // Point d'intégration Sentry : Sentry.captureException(error, { extra: { scope, ...context } });
  }
}

export function logWarn(scope: string, message: string, context?: LogContext): void {
  console.warn(`[${scope}]`, message, context ?? '');
}

export function logInfo(scope: string, message: string, context?: LogContext): void {
  if (import.meta.env.DEV) {
    console.info(`[${scope}]`, message, context ?? '');
  }
}
