import { useMemo } from 'react';

export interface EtudeDetailTabCounts {
  recruitment: number;
  documents: number;
  compliance: number;
}

export function useEtudeDetailTabs(data: {
  recruitmentTasks?: unknown[];
  documents?: unknown[];
  avenants?: unknown[];
}): EtudeDetailTabCounts {
  return useMemo(
    () => ({
      recruitment: data.recruitmentTasks?.length ?? 0,
      documents: data.documents?.length ?? 0,
      compliance: data.avenants?.length ?? 0,
    }),
    [data.recruitmentTasks?.length, data.documents?.length, data.avenants?.length]
  );
}

export const ETUDE_DETAIL_TABS = [
  { id: 'overview', label: "Vue d'ensemble" },
  { id: 'planning', label: 'Planning & Budget' },
  { id: 'recruitment', label: 'Recrutement' },
  { id: 'documents', label: 'Documents' },
  { id: 'compliance', label: 'Conformité' },
] as const;

export type EtudeDetailTabId = (typeof ETUDE_DETAIL_TABS)[number]['id'];
