import { User } from 'firebase/auth';

export interface UserData {
  displayName: string;
  email: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  graduationYear: string;
  createdAt: Date;
  status: 'etudiant' | 'membre' | 'admin' | 'superadmin';
  structureId: string;
  ecole: string;
  cvUrl?: string; // URL du CV (optionnel)
  photoURL?: string;
  program: string;
  birthPlace?: string;
  postalCode?: string;
  gender?: 'M' | 'F' | 'Autre';
  nationality?: string;
  studentId?: string;
  address?: string;
  socialSecurityNumber?: string;
  phone?: string;
  profileCompletion?: number;
  updatedAt?: Date;
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'trialing' | null;
  currentPeriodEnd?: Date;
  // Champs pour la gestion des cotisations
  hasActiveSubscription?: boolean;
  subscriptionId?: string;
  subscriptionPaidAt?: Date;
  subscriptionExpiresAt?: Date;
  lastSubscriptionUpdate?: Date;
}

export interface ExtendedUser extends User {
  status?: 'user' | 'admin' | 'superadmin';
  role?: string;
  phone?: string;
  address?: string;
  city?: string;
  formation?: string;
  speciality?: string;
  studyLevel?: string;
  ecole?: string;
  firstName?: string;
  lastName?: string;
  structureId?: string;
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'trialing' | null;
  currentPeriodEnd?: Date;
  // Champs pour la gestion des cotisations
  hasActiveSubscription?: boolean;
  subscriptionId?: string;
  subscriptionPaidAt?: Date;
  subscriptionExpiresAt?: Date;
  lastSubscriptionUpdate?: Date;
} 