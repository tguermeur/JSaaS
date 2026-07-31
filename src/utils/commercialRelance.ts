import type { RelanceTone } from '../components/ds/CommercialPrimitives';

export interface RelanceState {
  tone: RelanceTone;
  label: string;
  days: number;
}

export interface ContactState {
  stale: boolean;
  veryStale: boolean;
  days: number;
  label: string;
}

const DAY_MS = 86_400_000;

export const MONTHS_FULL = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export const WEEKDAYS_FULL = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function parseDateOnly(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function relanceState(dateRecontact?: string, now = new Date()): RelanceState {
  if (!dateRecontact) {
    return { tone: 'none', label: 'Programmer', days: 1e9 };
  }
  const target = parseDateOnly(dateRecontact);
  if (!target) {
    return { tone: 'none', label: 'Programmer', days: 1e9 };
  }
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  const days = Math.round((t.getTime() - today.getTime()) / DAY_MS);
  if (days < 0) {
    return { tone: 'late', label: `${Math.abs(days)} j de retard`, days };
  }
  if (days === 0) {
    return { tone: 'today', label: "Aujourd'hui", days: 0 };
  }
  if (days <= 7) {
    return {
      tone: 'soon',
      label: days === 1 ? 'Demain' : `Dans ${days} j`,
      days,
    };
  }
  return {
    tone: 'planned',
    label: target.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    days,
  };
}

export function relanceSortKey(dateRecontact?: string): number {
  return relanceState(dateRecontact).days;
}

export function contactState(
  lastActivityAt?: string,
  statut?: string,
  now = new Date(),
): ContactState {
  if (statut === 'abandon' || statut === 'deja_client') {
    return { stale: false, veryStale: false, days: 0, label: '—' };
  }
  const raw = lastActivityAt || '';
  if (!raw) {
    return { stale: true, veryStale: true, days: 99, label: 'Jamais contacté' };
  }
  const last = new Date(raw);
  const days = Math.floor((now.getTime() - last.getTime()) / DAY_MS);
  const stale = days >= 21;
  const veryStale = days >= 42;
  let label = "Aujourd'hui";
  if (days === 1) label = 'Hier';
  else if (days > 1) label = `Il y a ${days} j`;
  return { stale, veryStale, days, label };
}

export function fmtDateLong(iso?: string): string {
  const d = parseDateOnly(iso || toIsoDate(new Date()));
  if (!d) return '';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}
