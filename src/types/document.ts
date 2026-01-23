import { Timestamp } from 'firebase/firestore';

export interface Document {
  id: string;
  name: string;
  size: number; // en bytes
  type: string; // MIME type
  url: string;
  storagePath: string;
  parentFolderId: string | null; // null pour la racine
  uploadedBy: string; // userId
  uploadedByName?: string; // nom de l'utilisateur pour affichage
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  structureId: string;
  isRestricted: boolean;
  allowedRoles?: string[]; // ['admin', 'member', etc.]
  thumbnailUrl?: string; // pour les images
  missionId?: string; // ID de la mission associée
  missionNumber?: string; // Numéro de la mission associée
  missionTitle?: string; // Titre de la mission associée
  color?: string; // Couleur personnalisée du dossier ou tag du document
  isPersonalDocument?: boolean; // Indique si c'est un document personnel (depuis le profil utilisateur)
  isPinned?: boolean; // Indique si le document est épinglé
}

export interface Folder {
  id: string;
  name: string;
  parentFolderId: string | null; // null pour la racine
  createdBy: string; // userId
  createdByName?: string; // nom de l'utilisateur pour affichage
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  structureId: string;
  isRestricted: boolean;
  allowedRoles?: string[]; // ['admin', 'member', etc.]
  color?: string; // Couleur personnalisée du dossier
  isPersonalFolder?: boolean; // Indique si c'est un dossier personnel (pour les documents du profil utilisateur)
  isPinned?: boolean; // Indique si le dossier est épinglé
}

export type ViewMode = 'grid' | 'list';

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

