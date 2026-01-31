export type MissionEtape = 
  | 'brouillon'
  | 'publication'
  | 'selection'
  | 'contractualisation'
  | 'suivi'
  | 'cloture'
  | 'archive';

export type MissionType = 'standard' | 'ambassadeur_event';

export interface MissionSlotBreak {
  start: string; // Format HH:mm
  end: string; // Format HH:mm
}

export interface MissionSlot {
  id: string; // UUID
  startTime: Date;
  endTime: Date;
  capacity: number; // Combien d'étudiants max sur ce créneau
  assignedStudentIds: string[]; // IDs des étudiants inscrits
  details?: string; // ex: "Stand Accueil" ou "Stand Technique"
  breaks?: MissionSlotBreak[]; // Pauses pour ce créneau
  // Suivi administratif par créneau
  contractStatus: 'pending' | 'generated' | 'signed';
  billingStatus: 'pending' | 'invoiced' | 'paid';
}

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
  locationCoordinates?: {
    lat: number;
    lng: number;
  };
  startDate: string;
  endDate: string;
  description: string;
  missionTypeId?: string;
  type?: MissionType; // par défaut 'standard'
  slots?: MissionSlot[]; // uniquement si type = 'ambassadeur_event'
  campaignName?: string; // pour regrouper plusieurs dates/lieux
  visibleForAmbassadors?: boolean; // affiché dans AvailableMissions pour users isAmbassador
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


