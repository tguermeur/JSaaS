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
  // Documents d'identité sécurisés (chiffrés)
  identityCardUrl?: string; // Carte d'identité (complet - recto + verso)
  identityCardRectoUrl?: string; // Carte d'identité - Recto uniquement
  identityCardVersoUrl?: string; // Carte d'identité - Verso uniquement
  ribUrl?: string; // RIB
  schoolCertificateUrl?: string; // Certificat de scolarité
  healthCardUrl?: string; // Carte Vitale
  // Documents personnalisés (max 3)
  customDocuments?: CustomDocument[];
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
  linkedinUrl?: string;
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
  // Authentification à deux facteurs (2FA)
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string; // Secret TOTP (stocké de manière sécurisée)
  twoFactorEnabledAt?: Date; // Date d'activation de la 2FA
  // Appareils sécurisés (trusted devices)
  secureDevices?: SecureDevice[];
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
  // Changelog
  lastSeenChangelogVersion?: string;
  lastSeenChangelogDate?: Date;
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

export interface SecureDevice {
  deviceId: string;
  deviceName: string;
  userAgent: string;
  platform: string;
  lastUsed: Date | any; // Peut être un Timestamp Firestore
  addedAt: Date | any; // Peut être un Timestamp Firestore
}

export interface CustomDocument {
  id: string; // ID unique du document
  name: string; // Nom/label du document (ex: "Permis de conduire", "Diplôme", etc.)
  url: string; // URL du document chiffré dans Storage
  uploadedAt: Date | any; // Date d'upload
}