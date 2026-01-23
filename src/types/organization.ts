export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'admin' | 'mission_manager' | 'etudiant' | 'teacher';
  createdAt: any;
}

export interface OrganizationInfo {
  name: string;
  logo?: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  description: string;
}

export interface Pole {
  id: string;
  name: string;
}

export interface UserPole {
  poleId: string;
  isResponsable: boolean;
}

export interface PoleVisual {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  backgroundColor?: string;
  borderColor?: string;
}

export interface Organigramme {
  poles: Pole[];
  poleVisuals?: Record<string, PoleVisual>;
  members: Array<{
    id: string;
    displayName: string;
    photoURL?: string;
    poles?: UserPole[];
    mandat?: string;
  }>;
} 