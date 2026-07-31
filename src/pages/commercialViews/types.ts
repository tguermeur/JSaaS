export interface CommercialProspect {
  id: string;
  statut: string;
  nom?: string;
  name?: string;
  entreprise?: string;
  company?: string;
  email?: string;
  telephone?: string;
  derniereInteraction?: string;
  dateCreation?: string;
  dateAjout?: string;
  valeurPotentielle?: number;
  ownerId?: string;
  notes?: string;
  title?: string;
  secteur?: string;
  dateRecontact?: string;
  aiScore?: number;
  lastActivityAt?: string;
}

export interface CommercialMember {
  id: string;
  displayName: string;
}

export interface CommercialCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  type: 'meeting' | 'call' | 'task' | 'deadline' | 'salon' | 'reminder';
  ownerId: string;
  prospectId?: string;
  isRelanceReminder?: boolean;
}

export type CommercialViewId = 'today' | 'agenda' | 'table';

export interface CommercialViewActions {
  onOpen: (prospectId: string) => void;
  onAdd: () => void;
  onScheduleRelance: (prospect: CommercialProspect, anchor?: HTMLElement | null) => void;
  onMarkDone: (prospect: CommercialProspect) => void;
  onSnooze: (prospect: CommercialProspect, days: number) => void;
  onCompose?: (prospect: CommercialProspect) => void;
  onLog?: (prospect: CommercialProspect, kind: 'call' | 'email') => void;
}
