/** Helpers CA dashboard / stats structure — statuts & montants hétérogènes. */

const PAID_STATUSES = new Set(['paid', 'payee', 'paye']);

const PENDING_STATUSES = new Set([
  'to_send',
  'sent',
  'a_facturer',
  'facturee',
  'en attente',
  'pending',
  'invoiced',
]);

const OVERDUE_STATUSES = new Set(['en retard', 'overdue', 'past_due']);

function normStatus(status: unknown): string {
  return String(status || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function toPositiveNumber(val: unknown): number {
  const n = typeof val === 'number' ? val : typeof val === 'string' ? Number(val) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function isPaidInvoiceStatus(status: unknown): boolean {
  return PAID_STATUSES.has(normStatus(status));
}

export function isPendingInvoiceStatus(status: unknown): boolean {
  const s = normStatus(status);
  if (isPaidInvoiceStatus(status) || isOverdueInvoiceStatus(status)) return false;
  return PENDING_STATUSES.has(s) || s.includes('attente');
}

export function isOverdueInvoiceStatus(status: unknown): boolean {
  const s = normStatus(status);
  return OVERDUE_STATUSES.has(s) || s.includes('retard');
}

/** Montant TTC depuis un doc mission/étude (champs variables selon le flux). */
export function extractRevenueAmount(data: Record<string, unknown> | null | undefined): number {
  if (!data) return 0;
  const invoiceDoc =
    typeof data.invoiceDocument === 'object' && data.invoiceDocument
      ? (data.invoiceDocument as Record<string, unknown>)
      : undefined;
  const direct =
    toPositiveNumber(data.totalTTC) ||
    toPositiveNumber(data.total_ttc) ||
    toPositiveNumber(data.montantTTC) ||
    toPositiveNumber(data.montantTtc) ||
    toPositiveNumber(data.invoiceAmount) ||
    toPositiveNumber(invoiceDoc?.invoiceAmount);
  if (direct > 0) return direct;

  const priceHT = toPositiveNumber(data.priceHT) || toPositiveNumber(data.salary);
  const hours = toPositiveNumber(data.hours) || toPositiveNumber(data.totalHours);
  const ht =
    toPositiveNumber(data.totalHT) ||
    toPositiveNumber(data.montantHT) ||
    (priceHT > 0 && hours > 0 ? priceHT * hours : 0) ||
    toPositiveNumber(data.budget) ||
    toPositiveNumber(data.prixHT);
  return ht > 0 ? ht * 1.2 : 0;
}

export function toDateSafe(val: unknown): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? undefined : val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const v = val as { toDate?: () => Date };
  if (typeof v.toDate === 'function') {
    const d = v.toDate();
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

/** Date de reconnaissance CA : paiement > fin > début > création. */
export function revenueRecognitionDate(data: {
  paidAt?: unknown;
  invoicePaidAt?: unknown;
  endDate?: unknown;
  startDate?: unknown;
  createdAt?: unknown;
}): Date | undefined {
  return (
    toDateSafe(data.paidAt) ||
    toDateSafe(data.invoicePaidAt) ||
    toDateSafe(data.endDate) ||
    toDateSafe(data.startDate) ||
    toDateSafe(data.createdAt)
  );
}
