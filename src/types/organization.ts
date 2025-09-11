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

export interface UserPole {
  poleId: string;
  name: string;
  role: 'admin' | 'mission_manager' | 'etudiant' | 'teacher';
} 