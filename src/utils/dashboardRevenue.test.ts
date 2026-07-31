import { describe, it, expect } from 'vitest';
import {
  extractRevenueAmount,
  isPaidInvoiceStatus,
  isPendingInvoiceStatus,
  revenueRecognitionDate,
} from '../utils/dashboardRevenue';

describe('dashboardRevenue', () => {
  it('reconnaît paid / payee / Payée', () => {
    expect(isPaidInvoiceStatus('paid')).toBe(true);
    expect(isPaidInvoiceStatus('payee')).toBe(true);
    expect(isPaidInvoiceStatus('Payée')).toBe(true);
    expect(isPaidInvoiceStatus('sent')).toBe(false);
  });

  it('extrait totalTTC ou fallback HT×1.2', () => {
    expect(extractRevenueAmount({ totalTTC: 1200 })).toBe(1200);
    expect(extractRevenueAmount({ totalHT: 1000 })).toBe(1200);
    expect(extractRevenueAmount({ priceHT: 50, hours: 10 })).toBe(600);
    expect(extractRevenueAmount({ invoiceDocument: { invoiceAmount: 450 } })).toBe(450);
  });

  it('marque sent / a_facturer comme pending', () => {
    expect(isPendingInvoiceStatus('sent')).toBe(true);
    expect(isPendingInvoiceStatus('a_facturer')).toBe(true);
    expect(isPendingInvoiceStatus('paid')).toBe(false);
  });

  it('priorise paidAt pour la date CA', () => {
    const d = revenueRecognitionDate({
      paidAt: '2026-06-15',
      endDate: '2026-01-01',
      startDate: '2025-12-01',
    });
    expect(d?.toISOString().startsWith('2026-06-15')).toBe(true);
  });
});
