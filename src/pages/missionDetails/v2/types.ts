import type { MissionDetailTabId } from '../../../hooks/useMissionDetailTabs';

export interface MissionDetailHeaderV2Props {
  numeroMission: string;
  title: string;
  etape: string;
  isPublished: boolean;
  isArchived?: boolean;
  activeTab: MissionDetailTabId;
  tabCounts: { candidates: number; documents: number; notes: number };
  canWrite: boolean;
  accent?: string;
  onBack: () => void;
  onTabChange: (tab: MissionDetailTabId) => void;
  onTitleSave: (title: string) => void;
  onEtapeChange: (etape: string) => void;
  onShare: () => void;
  onGoDocuments: () => void;
  onNewDocument: () => void;
  onOverflowToggle: (anchor: HTMLElement | null) => void;
  overflowOpen: boolean;
  overflowAnchor: HTMLElement | null;
}

export type DocCategory = 'contrats' | 'facturation' | 'autres';
