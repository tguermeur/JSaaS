/**
 * Helpers matching / normalisation pour le bulk-import onboarding.
 * findBestMatch = port fidèle de StructureSettings.tsx (même seuil 0.55).
 */

export function normalizeCompanyName(name: string): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?'"«»]+$/g, '')
    .trim();
}

function stripDiacritics(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Similarité Levenshtein (copie StructureSettings). */
export function levenshteinSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0 || lenB === 0) return 0;
  let prevRow = Array(lenB + 1)
    .fill(0)
    .map((_, i) => i);
  for (let i = 1; i <= lenA; i++) {
    const currRow = [i];
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(prevRow[j] + 1, currRow[j - 1] + 1, prevRow[j - 1] + cost);
    }
    prevRow = currRow;
  }
  const distance = prevRow[lenB];
  return 1 - distance / Math.max(lenA, lenB);
}

type MatchCandidate = Record<string, unknown> & {
  id?: string;
  firstName?: string;
  lastName?: string;
};

/**
 * Matching typo-tolerant (copie fidèle StructureSettings.findBestMatch).
 */
export function findBestMatch<T extends MatchCandidate>(
  input: string,
  candidates: T[],
  keys: string[],
  threshold = 0.55
): T | null {
  if (!input || !input.trim()) return null;
  const normalizedInput = stripDiacritics(input);

  let bestMatch: T | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    for (const key of keys) {
      const value = candidate[key];
      if (typeof value === 'string') {
        const normalizedValue = stripDiacritics(value);

        if (normalizedValue === normalizedInput) return candidate;

        if (
          normalizedValue.includes(normalizedInput) ||
          normalizedInput.includes(normalizedValue)
        ) {
          const score =
            Math.min(normalizedInput.length, normalizedValue.length) /
            Math.max(normalizedInput.length, normalizedValue.length);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = candidate;
          }
        }

        const sim = levenshteinSimilarity(normalizedInput, normalizedValue);
        if (sim > bestScore && sim >= threshold) {
          bestScore = sim;
          bestMatch = candidate;
        }
      }
    }

    if (candidate.firstName && candidate.lastName) {
      const fullName = stripDiacritics(`${candidate.firstName} ${candidate.lastName}`);
      const reverseName = stripDiacritics(`${candidate.lastName} ${candidate.firstName}`);

      if (fullName === normalizedInput || reverseName === normalizedInput) return candidate;
      if (fullName.includes(normalizedInput) || normalizedInput.includes(fullName)) {
        if (0.9 > bestScore) {
          bestScore = 0.9;
          bestMatch = candidate;
        }
      }
      const simFull = levenshteinSimilarity(normalizedInput, fullName);
      const simRev = levenshteinSimilarity(normalizedInput, reverseName);
      if (Math.max(simFull, simRev) > bestScore && Math.max(simFull, simRev) >= threshold) {
        bestScore = Math.max(simFull, simRev);
        bestMatch = candidate;
      }
    }
  }

  return bestScore >= threshold ? bestMatch : null;
}

export function getSafeDisplayName(user: {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}): string {
  if (user.displayName && String(user.displayName).trim()) return String(user.displayName).trim();
  const full = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  if (full) return full;
  return (user.email || '').trim() || 'Membre';
}

export const FIRESTORE_BATCH_LIMIT = 500;
