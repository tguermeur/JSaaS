import { useMemo } from 'react';
import type { DashboardMission, DashboardStatistics } from './useDashboardData';
import {
  type DashboardPeriodId,
  getPeriodRange,
  getPreviousPeriodRange,
  isDateInRange,
  computeDelta,
  buildSparklineSeries,
} from './useDashboardPeriod';
import {
  extractRevenueAmount,
  isOverdueInvoiceStatus,
  isPaidInvoiceStatus,
  isPendingInvoiceStatus,
  revenueRecognitionDate,
} from '../utils/dashboardRevenue';

export interface FunnelStage {
  label: string;
  value: number;
}

export interface DashboardPeriodMetrics {
  filteredMissions: DashboardMission[];
  revenueInPeriod: number;
  activeInPeriod: number;
  revenueDelta: number | null;
  missionsDelta: number | null;
  sparkRevenue: number[];
  sparkMissions: number[];
  funnelStages: FunnelStage[];
  treasuryDue30: number;
  treasuryOverdue60: number;
  periodLabel: string;
}

function missionDate(m: DashboardMission): Date | undefined {
  return revenueRecognitionDate(m);
}

function filterMissionsByPeriod(missions: DashboardMission[], period: DashboardPeriodId): DashboardMission[] {
  const range = getPeriodRange(period);
  return missions.filter((m) => {
    const d = missionDate(m);
    // Sans date exploitable : inclure quand même (évite CA à 0 sur factures payées sans dates)
    return d ? isDateInRange(d, range) : isPaidInvoiceStatus(m.invoiceStatus);
  });
}

function sumRevenue(missions: DashboardMission[]): number {
  return missions.reduce((s, m) => s + extractRevenueAmount(m as unknown as Record<string, unknown>), 0);
}

function isPaidMission(m: DashboardMission): boolean {
  return isPaidInvoiceStatus(m.invoiceStatus);
}

export function useDashboardPeriodMetrics(
  missions: DashboardMission[],
  statistics: DashboardStatistics,
  period: DashboardPeriodId,
  prospectCounts?: { prospects: number; qualified: number; proposals: number; signed: number }
): DashboardPeriodMetrics {
  return useMemo(() => {
    const range = getPeriodRange(period);
    const prevRange = getPreviousPeriodRange(period);

    const filteredMissions = filterMissionsByPeriod(missions, period);
    const prevMissions = missions.filter((m) => {
      const d = missionDate(m);
      return d ? isDateInRange(d, prevRange) : false;
    });

    const paidInPeriod = filteredMissions.filter(isPaidMission);
    const paidPrev = prevMissions.filter(isPaidMission);

    let revenueInPeriod = sumRevenue(paidInPeriod);
    const prevRevenue = sumRevenue(paidPrev);

    // Si aucun CA période (données partielles / liste limitée) : fallback stats structure (hors filtre « aujourd'hui »).
    if (revenueInPeriod <= 0 && statistics.totalRevenue > 0 && period !== 'jour') {
      revenueInPeriod = statistics.totalRevenue;
    }

    const activeInPeriod = filteredMissions.filter((m) => m.status === 'En cours' || m.status === 'active').length;
    const prevActive = prevMissions.filter((m) => m.status === 'En cours' || m.status === 'active').length;

    const paidAll = missions.filter(isPaidMission);
    const monthlyBuckets = Array.from({ length: 12 }, () => 0);
    const now = new Date();
    paidAll.forEach((m) => {
      const d = missionDate(m);
      if (!d) return;
      const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (monthsAgo >= 0 && monthsAgo < 12) {
        monthlyBuckets[11 - monthsAgo] += extractRevenueAmount(m as unknown as Record<string, unknown>);
      }
    });

    const monthlyMissions = Array.from({ length: 12 }, () => 0);
    missions.forEach((m) => {
      const d = missionDate(m);
      if (!d) return;
      const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (monthsAgo >= 0 && monthsAgo < 12) monthlyMissions[11 - monthsAgo] += 1;
    });

    const pc = prospectCounts || { prospects: 24, qualified: 18, proposals: 12, signed: statistics.activeMissions || 8 };
    const funnelStages: FunnelStage[] = [
      { label: 'Prospects', value: pc.prospects },
      { label: 'Qualifiés', value: pc.qualified },
      { label: 'Propositions', value: pc.proposals },
      { label: 'Négociation', value: Math.max(1, Math.floor(pc.proposals * 0.6)) },
      { label: 'Études signées', value: pc.signed },
    ];

    const treasuryOverdue60 = sumRevenue(missions.filter((m) => isOverdueInvoiceStatus(m.invoiceStatus)));
    const treasuryDue30 = sumRevenue(missions.filter((m) => isPendingInvoiceStatus(m.invoiceStatus)));

    return {
      filteredMissions,
      revenueInPeriod,
      activeInPeriod: activeInPeriod || statistics.activeMissions,
      revenueDelta: computeDelta(revenueInPeriod, prevRevenue),
      missionsDelta: computeDelta(filteredMissions.length || statistics.totalMissions, prevMissions.length),
      sparkRevenue: buildSparklineSeries(
        monthlyBuckets.some((v) => v > 0) ? monthlyBuckets : [statistics.totalRevenue || 0]
      ),
      sparkMissions: buildSparklineSeries(
        monthlyMissions.some((v) => v > 0) ? monthlyMissions : [statistics.totalMissions || 0]
      ),
      funnelStages,
      treasuryDue30,
      treasuryOverdue60,
      periodLabel: range.label,
    };
  }, [missions, statistics, period, prospectCounts]);
}
