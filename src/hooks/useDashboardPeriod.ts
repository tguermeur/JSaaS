export type DashboardPeriodId = 'jour' | 'semaine' | 'mois' | 'trim' | 'annee';

export interface PeriodRange {
  start: Date;
  end: Date;
  label: string;
}

export function getPeriodRange(period: DashboardPeriodId, refDate = new Date()): PeriodRange {
  const end = new Date(refDate);
  end.setHours(23, 59, 59, 999);
  const start = new Date(refDate);
  start.setHours(0, 0, 0, 0);

  switch (period) {
    case 'jour':
      return { start, end, label: "Aujourd'hui" };
    case 'semaine': {
      const day = start.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + diff);
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end, label: 'Cette semaine' };
    }
    case 'mois':
      start.setDate(1);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end, label: 'Ce mois' };
    case 'trim': {
      const q = Math.floor(start.getMonth() / 3);
      start.setMonth(q * 3, 1);
      end.setMonth(q * 3 + 3, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end, label: 'Ce trimestre' };
    }
    case 'annee':
      start.setMonth(0, 1);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      return { start, end, label: '12 mois' };
    default:
      return { start, end, label: 'Ce mois' };
  }
}

export function getPreviousPeriodRange(period: DashboardPeriodId, refDate = new Date()): PeriodRange {
  const current = getPeriodRange(period, refDate);
  const duration = current.end.getTime() - current.start.getTime();
  const prevEnd = new Date(current.start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - duration);
  prevStart.setHours(0, 0, 0, 0);
  return { start: prevStart, end: prevEnd, label: 'période précédente' };
}

export function isDateInRange(date: Date | string | undefined, range: PeriodRange): boolean {
  if (!date) return false;
  const d = typeof date === 'string' ? new Date(date) : date;
  return d >= range.start && d <= range.end;
}

export function computeDelta(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function buildSparklineSeries(values: number[], points = 7): number[] {
  if (values.length <= points) return values.length ? values : [0, 0];
  const step = values.length / points;
  const result: number[] = [];
  for (let i = 0; i < points; i++) {
    const idx = Math.min(values.length - 1, Math.floor(i * step));
    result.push(values[idx]);
  }
  return result;
}

export const DASHBOARD_PERIOD_OPTIONS = [
  { id: 'jour', label: "Aujourd'hui" },
  { id: 'semaine', label: 'Cette semaine' },
  { id: 'mois', label: 'Ce mois' },
  { id: 'trim', label: 'Ce trimestre' },
  { id: 'annee', label: '12 mois' },
] as const;
