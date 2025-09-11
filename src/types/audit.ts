import { DocumentType } from './templates';

export interface AuditDocument {
  id: string;
  name: string;
  missionId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: string;
  url?: string;
  description?: string;
  assignedTo?: string;
  comments?: string[];
  type: 'audit' | 'mission';
}

export interface AuditAssignment {
  id: string;
  documentId: string;
  assignedTo: string;
  assignedBy: string;
  status: 'pending' | 'completed';
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  comments?: string[];
  missionId: string;
  auditorId: string;
  completedAt?: Date;
}

export interface DocumentComparison {
  id: string;
  missionId: string;
  document1Id: string;
  document2Id: string;
  createdAt: Date;
  createdBy: string;
  createdByName: string;
  notes?: string;
} 