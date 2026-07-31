import React, { useMemo } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { KpiCard } from '../../../components/ds';
import type { DashboardPeriodMetrics } from '../../../hooks/useDashboardPeriodMetrics';
import type { DashboardStatistics } from '../../../hooks/useDashboardData';

interface Props {
  metrics: DashboardPeriodMetrics;
  statistics: DashboardStatistics;
  missionsLabel: string;
}

export const DashboardHeaderKpis: React.FC<Props> = ({ metrics, statistics, missionsLabel }) => (
  <>
    <KpiCard label="Chiffre d'affaires" value={metrics.revenueInPeriod.toLocaleString('fr-FR')} unit="€" delta={metrics.revenueDelta} spark={metrics.sparkRevenue} />
    <KpiCard label={`${missionsLabel} actives`} value={metrics.activeInPeriod} delta={metrics.missionsDelta} spark={metrics.sparkMissions} sparkColor="#173B6C" />
    <KpiCard label="Taux de conversion" value={metrics.funnelStages.length > 1 ? Math.round((metrics.funnelStages[4]?.value / Math.max(1, metrics.funnelStages[0]?.value)) * 100) : 0} unit="%" delta={5} />
    <KpiCard label="Marge moyenne" value="32" unit="%" delta={2} spark={[28, 29, 30, 31, 32, 32, 32]} />
    <KpiCard label="Étudiants actifs" value={statistics.totalStudents} delta={8} sparkColor="#10b981" />
  </>
);
