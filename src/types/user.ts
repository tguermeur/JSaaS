import { User } from 'firebase/auth';

export interface UserData {
  displayName: string;
  email: string;
  firstName: string;
  lastName: string;
  birthDate?: string; // Optionnel pour entreprises et structures
  graduationYear?: string; // Optionnel pour entreprises et structures
  createdAt: Date;
  status: 'etudiant' | 'membre' | 'admin' | 'superadmin' | 'entreprise' | 'admin_structure';
  structureId?: string; // Optionnel pour entreprises
  ecole?: string; // Optionnel pour entreprises
  cvUrl?: string; // URL du CV (optionnel)
  photoURL?: string;
  program?: string; // Optionnel pour entreprises et structures
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
  // Opt-in pour recevoir les documents par voie électronique
  acceptsElectronicDocuments?: boolean;
  acceptsElectronicDocumentsDate?: Date; // Date à laquelle l'étudiant a accepté
  // Champs spécifiques aux entreprises
  companyName?: string;
  position?: string; // Poste occupé
  siret?: string; // Numéro SIRET (optionnel)
  tvaIntra?: string; // Numéro de TVA Intracommunautaire (optionnel)
  missionType?: string;
  missionDescription?: string;
  missionDeadline?: string;
  leadQualified?: boolean;
  leadQualifiedAt?: Date;
  // Champs spécifiques aux structures
  structureName?: string;
  trialStartDate?: Date;
  trialEndDate?: Date;
  hasActiveTrial?: boolean;
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