/**
 * Abstraction commune junior (études) / jobservice (missions) — Phase 7.
 * Les pages détail partagent MissionDetailShell (réexporté comme EtudeDetailShell)
 * et se paramètrent via ce config plutôt que des `if (structureType)` dispersés.
 */

export type StructureProductType = 'junior' | 'jobservice';

export type DetailEntityKind = 'etude' | 'mission';

export interface DetailWorkspaceConfig {
  structureType: StructureProductType;
  entityKind: DetailEntityKind;
  /** Segment de route sous /app */
  listPath: string;
  detailPathPrefix: string;
  labels: {
    entitySingular: string;
    entityPlural: string;
    chargeRole: string;
    createCta: string;
  };
  permissionPageId: 'mission' | 'etude';
}

export const JOBSERVICE_WORKSPACE: DetailWorkspaceConfig = {
  structureType: 'jobservice',
  entityKind: 'mission',
  listPath: '/app/mission',
  detailPathPrefix: '/app/mission',
  labels: {
    entitySingular: 'Mission',
    entityPlural: 'Missions',
    chargeRole: "Chargé de mission",
    createCta: 'Nouvelle mission',
  },
  permissionPageId: 'mission',
};

export const JUNIOR_WORKSPACE: DetailWorkspaceConfig = {
  structureType: 'junior',
  entityKind: 'etude',
  listPath: '/app/etude',
  detailPathPrefix: '/app/etude',
  labels: {
    entitySingular: 'Étude',
    entityPlural: 'Études',
    chargeRole: "Chargé d'étude",
    createCta: 'Nouvelle étude',
  },
  permissionPageId: 'etude',
};

export function workspaceForStructureType(
  structureType: StructureProductType | string | null | undefined
): DetailWorkspaceConfig {
  return structureType === 'junior' ? JUNIOR_WORKSPACE : JOBSERVICE_WORKSPACE;
}

/** Shell layout partagé (2 colonnes). */
export { MissionDetailShell as DetailWorkspaceShell } from '../missionDetails/MissionDetailShell';
