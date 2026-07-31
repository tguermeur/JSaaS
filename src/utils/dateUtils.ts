/**
 * Convertit un timestamp Firestore en Date.
 * Gère : Timestamp Firestore, objet { seconds, nanoseconds }, Date, number, string.
 */
export function toDateFromFirestore(raw: any): Date {
  if (!raw) return new Date(0);
  if (raw instanceof Date) return isNaN(raw.getTime()) ? new Date(0) : raw;
  if (typeof raw === 'number') return new Date(isNaN(raw) ? 0 : raw);
  if (typeof raw === 'string') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }
  // Firestore Timestamp avec méthode toDate
  if (typeof raw.toDate === 'function') return raw.toDate();
  // Objet sérialisé Firestore { seconds, nanoseconds }
  if (raw && typeof raw.seconds === 'number') {
    const ns = typeof raw.nanoseconds === 'number' ? raw.nanoseconds : 0;
    return new Date(raw.seconds * 1000 + ns / 1000000);
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
};

/** Formate une date Firestore / string / Date en libellé court FR. */
export function formatShortDate(
  raw: unknown,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
): string {
  if (raw == null) return '—';
  const d = toDateFromFirestore(raw);
  if (d.getTime() === 0) return '—';
  return d.toLocaleDateString('fr-FR', options);
} 