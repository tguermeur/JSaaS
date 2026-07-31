/**
 * Google Analytics 4 (GA4) - suivi des visites et des pages vues.
 * Définir VITE_GA_MEASUREMENT_ID dans .env (ex: G-XXXXXXXXXX).
 */

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

import { getCookieConsent } from '../components/common/CookieConsent';

const MEASUREMENT_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim();
let gaInitialized = false;

export function getMeasurementId(): string | undefined {
  return MEASUREMENT_ID || undefined;
}

export function isAnalyticsEnabled(): boolean {
  return Boolean(MEASUREMENT_ID && import.meta.env.PROD && getCookieConsent() === 'accepted');
}

/** Charge le script gtag et initialise GA4 avec l'ID de mesure (après consentement cookies). */
export function initGA(): void {
  if (!MEASUREMENT_ID || !import.meta.env.PROD || gaInitialized) return;
  if (getCookieConsent() !== 'accepted') {
    const onConsent = (e: Event) => {
      if ((e as CustomEvent).detail === 'accepted') initGA();
    };
    window.addEventListener('cookie-consent-changed', onConsent, { once: true });
    return;
  }
  gaInitialized = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.gtag('config', MEASUREMENT_ID, {
    send_page_view: false, // on envoie les page_view nous-mêmes sur changement de route
  });
}

/** Envoie un événement "page_view" (pour SPA, à appeler à chaque changement de route). */
export function trackPageView(path: string, title?: string): void {
  if (!MEASUREMENT_ID || getCookieConsent() !== 'accepted') return;

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title || document.title,
    });
  }
}
