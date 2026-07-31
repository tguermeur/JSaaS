/**
 * Polyfills requis par @react-pdf/renderer — importer uniquement depuis les pages PDF.
 */
import { Buffer } from 'buffer';

export function installPdfPolyfills(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { global: typeof window }).global = window;
  (window as unknown as { process: { env: Record<string, string> } }).process = { env: {} };
  (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}
