export type MissionEtape = 
  | 'brouillon'
  | 'publication'
  | 'selection'
  | 'contractualisation'
  | 'suivi'
  | 'cloture'
  | 'archive';

export interface MissionPermissions {
  viewers: string[];
  editors: string[];
}

export interface Mission {
  id: string;
  numeroMission: string;
  structureId: string;
  companyId: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
  missionTypeId?: string;
  studentCount: number;
  hoursPerStudent: string;
  chargeId: string;
  chargeName: string;
  title: string;
  salary: string;
  hours: number;
  requiresCV: boolean;
  requiresMotivation: boolean;
  isPublished: boolean;
  isPublic: boolean;
  priceHT: number;
  totalHT?: number;
  totalTTC?: number;
  tva?: number;
  updatedAt: Date;
  etape: MissionEtape;
  ecole?: string;
  createdBy?: string;
  permissions?: MissionPermissions;
  contactId?: string;
  isArchived?: boolean;
  mandat?: string;
  [key: string]: any;
}


