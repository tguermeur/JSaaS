import { useMemo } from 'react';

export interface MissionDetailTabCounts {
  candidates: number;
  documents: number;
  notes: number;
}

export function useMissionDetailTabs(data: {
  applications?: unknown[];
  documents?: unknown[];
  notes?: unknown[];
  history?: unknown[];
}): MissionDetailTabCounts {
  return useMemo(
    () => ({
      candidates: data.applications?.length ?? 0,
      documents: data.documents?.length ?? 0,
      notes: data.notes?.length ?? 0,
    }),
    [data.applications?.length, data.documents?.length, data.notes?.length]
  );
}

export const MISSION_DETAIL_TABS = [
  { id: 'overview', label: "Vue d'ensemble" },
  { id: 'candidates', label: 'Candidats' },
  { id: 'documents', label: 'Documents' },
  { id: 'notes', label: 'Notes' },
  { id: 'activity', label: 'Activité' },
] as const;

export type MissionDetailTabId = (typeof MISSION_DETAIL_TABS)[number]['id'];
