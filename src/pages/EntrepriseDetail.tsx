import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Avatar,
  Button,
  Grid,
  Paper,
  Divider,
  Tab,
  Tabs,
  IconButton,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  LinearProgress,
  Link,
  InputBase,
  Menu,
  MenuItem
} from '@mui/material';
import {
  Business as BusinessIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Language as LanguageIcon,
  LocationOn as LocationIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  Note as NoteIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  LinkedIn as LinkedInIcon,
  CloudUpload as CloudUploadIcon,
  History as HistoryIcon,
  MoreVert as MoreVertIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  NoteAdd as NoteAddIcon
} from '@mui/icons-material';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { usePermission } from '../hooks/usePermission';
import AccessDenied from '../components/common/AccessDenied';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Company, Contact, ContactNote } from './Entreprises';
import { uploadCompanyLogo } from '../firebase/storage';
import { DocumentType, TemplateAssignment } from '../types/templates';
import { ref, getDownloadURL, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase/config';
import { PDFDocument } from 'pdf-lib';
import { formatDate } from '../utils/dateUtils';
import TaggingInput from '../components/ui/TaggingInput';
import { NotificationService } from '../services/notificationService';
import { tokens } from '../theme/tokens';
import {
  AppPageShell,
  CompaniesLayout,
  CompanySwitcher,
  ContactCard,
  CompanyDetailSkeleton,
  CompanyDetailContentSkeleton,
  CompanyDetailRailSkeleton,
  dsTabsSx,
  DetailPanel,
  DetailKpiCard,
  SidebarBlock,
} from '../components/ds';
import type { CompanyListItem } from '../components/ds';
import { getDecryptedUserDisplayName, getSafeDisplayName } from '../utils/decryptUserUtils';
import { batchDecryptForStructure } from '../utils/batchDecrypt';
import { decryptStructureForDocument } from '../utils/documentDecryptUtils';
import UserReferenceText from '../components/common/UserReferenceText';

type DetailTab = 'overview' | 'missions' | 'history';

const formatEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

const isEncryptedValue = (v: unknown): boolean => typeof v === 'string' && v.startsWith('ENC:');

interface UserData {
  firstName: string;
  lastName: string;
}

interface TemplateVariable {
  name: string;
  type: 'raw' | 'variable';
  variableId?: string;
  rawText?: string;
  position: {
    page: number;
    x: number;
    y: number;
  };
  width: number;
  height: number;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
}

interface Mission {
  id: string;
  title: string;
  status: string;
  totalTTC: number;
  companyId: string;
  numeroMission: number;
  startDate: Date;
  endDate?: Date;
  hours: number;
  priceHT: number;
  contactId?: string;
  contact?: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    position?: string;
  };
}

interface Note {
  id: string;
  content: string;
  createdBy: string;
  authorName?: string;
  createdAt: Date;
}

interface HistoryItem {
  id: string;
  type: 'creation' | 'modification' | 'mission' | 'contact' | 'note';
  description: string;
  createdBy: string;
  authorName?: string;
}

interface TaggedUser {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

interface FirestoreData {
  name?: string;
  nSiret?: string;
  description?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
  contacts?: Contact[];
  missionsCount?: number;
  totalRevenue?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  structureId?: string;
}

const LinkedIn: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-linkedin" viewBox="0 0 16 16">
    <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.28C3.3 3.34 4.42 4.46 5.54 5.58c1.12 1.12 2.24 2.24 3.36 3.36 1.12-1.12 2.24-2.24 3.36-3.36 4.48-1.12-1.12-2.24-2.24-3.36-3.36z"/>
  </svg>
);

const mapMissionDoc = (
  docId: string,
  data: Record<string, unknown>,
  contactMap: Map<string, Contact>,
): Mission => {
  const contactId = data.contactId as string | undefined;
  const contact = contactId ? contactMap.get(contactId) : undefined;
  return {
    id: docId,
    title: (data.title as string) || '',
    numeroMission: Number(data.numeroMission) || 0,
    status: (data.status as string) || 'en_cours',
    totalTTC: Number(data.totalTTC) || 0,
    companyId: (data.companyId as string) || '',
    startDate: data.startDate ? new Date(data.startDate as string | number | Date) : new Date(),
    endDate: data.endDate ? new Date(data.endDate as string | number | Date) : undefined,
    hours: Number(data.hours) || 0,
    priceHT: Number(data.priceHT) || 0,
    contactId,
    contact: contact
      ? {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          position: contact.position,
        }
      : undefined,
  };
};

const parseNSiret = (nSiret: unknown): string | undefined => {
  if (!nSiret) return undefined;
  if (typeof nSiret === 'string') return nSiret;
  const nSiretNum = Number(nSiret);
  if (!isNaN(nSiretNum) && isFinite(nSiretNum)) {
    return nSiretNum.toLocaleString('fr-FR', { useGrouping: false, maximumFractionDigits: 0 });
  }
  return String(nSiret);
};

const resolveAuthorNameMap = async (userIds: string[]): Promise<Map<string, string>> => {
  const unique = [...new Set(userIds.filter(Boolean))];
  const entries = await Promise.all(
    unique.map(async (uid) => {
      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        const name = userDoc.exists()
          ? await getDecryptedUserDisplayName(uid, userDoc.data() as UserData)
          : 'Utilisateur inconnu';
        return [uid, name] as const;
      } catch {
        return [uid, 'Utilisateur inconnu'] as const;
      }
    }),
  );
  return new Map(entries);
};

const isEncrypted = (v: any): boolean => typeof v === 'string' && v.startsWith('ENC:');

/** Convertit une valeur (Firestore Timestamp, Date, number, string) en Date sans casser l'UI. */
const toSafeDate = (value: unknown): Date | undefined => {
  if (value == null) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }
  const maybeToDate = (value as any)?.toDate;
  if (typeof maybeToDate === 'function') {
    try {
      const d = maybeToDate.call(value);
      return d instanceof Date ? d : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const EntrepriseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, userData } = useAuth();
  const { canRead, canWrite, loading: permissionLoading } = usePermission('entreprises');
  const [company, setCompany] = useState<Company | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [decryptedCompany, setDecryptedCompany] = useState<Partial<Company> | null>(null);
  const [decryptedContacts, setDecryptedContacts] = useState<Record<string, { firstName?: string; lastName?: string; email?: string }>>({});
  const [missions, setMissions] = useState<Mission[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [directorySearch, setDirectorySearch] = useState('');
  const [allCompanies, setAllCompanies] = useState<CompanyListItem[]>([]);
  const [newNote, setNewNote] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editedCompany, setEditedCompany] = useState<Partial<Company>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addContactDialogOpen, setAddContactDialogOpen] = useState(false);
  const [newContact, setNewContact] = useState<Partial<Contact>>({});
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userStructureId, setUserStructureId] = useState<string | null>(null);
  const [conventionTemplate, setConventionTemplate] = useState<string | null>(null);
  const [generatingConvention, setGeneratingConvention] = useState(false);
  const [editContactDialogOpen, setEditContactDialogOpen] = useState(false);
  const [deleteContactDialogOpen, setDeleteContactDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [editContact, setEditContact] = useState<Partial<Contact>>({});
  const [contactMenuAnchor, setContactMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedContactForMenu, setSelectedContactForMenu] = useState<Contact | null>(null);
  const [availableUsers, setAvailableUsers] = useState<TaggedUser[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<TaggedUser[]>([]);
  const [detailLoading, setDetailLoading] = useState(true);
  const [secondaryLoading, setSecondaryLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const fetchCompanyData = async () => {
      setLoadError(null);
      setDetailLoading(true);
      setSecondaryLoading(true);
      setCompany(null);
      setDecryptedCompany(null);
      setDecryptedContacts({});
      setMissions([]);
      setNotes([]);
      setHistory([]);

      try {
        const companyDoc = await getDoc(doc(db, 'companies', id));
        if (cancelled) return;

        if (!companyDoc.exists()) {
          setLoadError('Entreprise introuvable.');
          setDetailLoading(false);
          setSecondaryLoading(false);
          return;
        }

        const data = companyDoc.data() as FirestoreData;
        const companyData = {
          id: companyDoc.id,
          name: data.name || '',
          nSiret: parseNSiret(data.nSiret),
          description: data.description,
          address: data.address,
          city: data.city,
          postalCode: data.postalCode,
          country: data.country,
          phone: data.phone,
          email: data.email,
          website: data.website,
          logo: data.logo,
          contacts: [],
          missionsCount: data.missionsCount || 0,
          totalRevenue: data.totalRevenue || 0,
          createdAt: toSafeDate(data.createdAt) || new Date(),
          updatedAt: toSafeDate(data.updatedAt),
          structureId: data.structureId || '',
        } as Company;

        setCompany(companyData);
        setDetailLoading(false);

        const contactsQueryConstraints = [where('companyId', '==', id)];
        if (data.structureId) {
          contactsQueryConstraints.push(where('structureId', '==', data.structureId));
        }
        const missionsQueryConstraints = [where('companyId', '==', id)];
        if (data.structureId) {
          missionsQueryConstraints.push(where('structureId', '==', data.structureId));
        }

        const [contactsResult, missionsResult, notesResult, historyResult] = await Promise.allSettled([
          getDocs(query(collection(db, 'contacts'), ...contactsQueryConstraints)),
          getDocs(query(collection(db, 'missions'), ...missionsQueryConstraints)),
          getDocs(query(collection(db, 'notes'), where('companyId', '==', id))),
          getDocs(query(collection(db, 'history'), where('companyId', '==', id))),
        ]);

        if (cancelled) return;

        let contacts: Contact[] = [];
        if (contactsResult.status === 'fulfilled') {
          contacts = contactsResult.value.docs.map((contactDoc) => ({
            id: contactDoc.id,
            ...contactDoc.data(),
          })) as Contact[];
          setCompany((prev) => (prev ? { ...prev, contacts } : prev));
        } else {
          console.error('[EntrepriseDetail] Erreur chargement contacts:', contactsResult.reason);
        }

        const contactMap = new Map(contacts.map((contact) => [contact.id, contact]));

        if (missionsResult.status === 'fulfilled') {
          setMissions(
            missionsResult.value.docs.map((missionDoc) =>
              mapMissionDoc(missionDoc.id, missionDoc.data() as Record<string, unknown>, contactMap),
            ),
          );
        } else {
          console.error('[EntrepriseDetail] Erreur chargement missions:', missionsResult.reason);
        }

        const authorIds: string[] = [];
        if (notesResult.status === 'fulfilled') {
          notesResult.value.docs.forEach((noteDoc) => {
            const createdBy = noteDoc.data().createdBy as string | undefined;
            if (createdBy) authorIds.push(createdBy);
          });
        }
        if (historyResult.status === 'fulfilled') {
          historyResult.value.docs.forEach((historyDoc) => {
            const createdBy = historyDoc.data().createdBy as string | undefined;
            if (createdBy) authorIds.push(createdBy);
          });
        }

        const authorNameMap = await resolveAuthorNameMap(authorIds);
        if (cancelled) return;

        if (notesResult.status === 'fulfilled') {
          setNotes(
            notesResult.value.docs.map((noteDoc) => {
              const noteData = noteDoc.data();
              const createdBy = (noteData.createdBy as string) || '';
              return {
                id: noteDoc.id,
                content: (noteData.content as string) || '',
                createdBy,
                authorName: createdBy ? authorNameMap.get(createdBy) || 'Utilisateur inconnu' : 'Utilisateur inconnu',
                createdAt: toSafeDate(noteData.createdAt) || new Date(),
              };
            }),
          );
        } else {
          console.error('[EntrepriseDetail] Erreur chargement notes:', notesResult.reason);
        }

        if (historyResult.status === 'fulfilled') {
          setHistory(
            historyResult.value.docs.map((historyDoc) => {
              const historyData = historyDoc.data();
              const createdBy = (historyData.createdBy as string) || '';
              return {
                id: historyDoc.id,
                type: (historyData.type as HistoryItem['type']) || 'modification',
                description: (historyData.description as string) || '',
                createdBy,
                authorName: createdBy ? authorNameMap.get(createdBy) || 'Utilisateur inconnu' : 'Utilisateur inconnu',
              };
            }),
          );
        } else {
          console.error('[EntrepriseDetail] Erreur chargement historique:', historyResult.reason);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Erreur lors du chargement des données:', error);
          setLoadError("Impossible de charger le détail de l'entreprise.");
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
          setSecondaryLoading(false);
        }
      }
    };

    fetchCompanyData();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Déchiffrer entreprise + contacts (batch)
  useEffect(() => {
    if (!company || !canRead) return;
    const run = async () => {
      try {
        const companyEncrypted =
          isEncrypted(company.name) || isEncrypted(company.email) || isEncrypted(company.phone) ||
          isEncrypted(company.address) || isEncrypted(company.nSiret) ||
          isEncrypted((company as any).companyAddress) || isEncrypted((company as any).siret) || isEncrypted((company as any).tvaIntra);
        if (companyEncrypted) {
          const results = await batchDecryptForStructure('company', [company.id]);
          const dec = results[company.id];
          if (dec) setDecryptedCompany(dec);
        }
        const contacts = company.contacts || [];
        const encryptedContacts = contacts.filter(
          (c) =>
            c.id &&
            (isEncrypted(c.firstName) || isEncrypted(c.lastName) || isEncrypted(c.email) || isEncrypted(c.phone))
        );
        if (encryptedContacts.length > 0) {
          const results = await batchDecryptForStructure<{
            firstName?: string;
            lastName?: string;
            email?: string;
            phone?: string;
          }>(
            'contact',
            encryptedContacts.map((c) => c.id),
            ['firstName', 'lastName', 'email', 'phone']
          );
          const next: Record<string, { firstName?: string; lastName?: string; email?: string; phone?: string }> = {};
          for (const [id, dec] of Object.entries(results)) {
            next[id] = {
              firstName: dec.firstName,
              lastName: dec.lastName,
              email: dec.email,
              phone: dec.phone,
            };
          }
          if (Object.keys(next).length) setDecryptedContacts((prev) => ({ ...prev, ...next }));
        }
      } catch (e) {
        console.warn('Déchiffrement entreprise/contacts ignoré:', e);
      }
    };
    void run();
  }, [company?.id, canRead, company?.name, company?.email, company?.phone, company?.address, company?.nSiret, company?.contacts]);

  // Récupérer la structure de l'utilisateur et le template de convention
  useEffect(() => {
    const fetchUserStructureAndTemplate = async () => {
      if (!currentUser) return;

      try {
        // Récupérer la structure de l'utilisateur
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!userDocSnap.exists()) {
          throw new Error("Utilisateur non trouvé");
        }

        const structureId = userDocSnap.data().structureId;
        setUserStructureId(structureId);

        // Récupérer le template de convention assigné pour cette structure
        const assignmentsQuery = query(
          collection(db, 'templateAssignments'),
          where('structureId', '==', structureId),
          where('documentType', '==', 'convention_entreprise')
        );
        
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        
        if (!assignmentsSnapshot.empty) {
          const assignment = assignmentsSnapshot.docs[0].data() as TemplateAssignment;
          setConventionTemplate(assignment.templateId);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération du template de convention:', error);
      }
    };

    fetchUserStructureAndTemplate();
  }, [currentUser]);

  useEffect(() => {
    const fetchAllCompanies = async () => {
      if (!userStructureId) return;
      try {
        const companiesSnapshot = await getDocs(
          query(collection(db, 'companies'), where('structureId', '==', userStructureId))
        );
        setAllCompanies(
          companiesSnapshot.docs.map((d) => {
            const data = d.data();
            const name = data.name || '—';
            return {
              id: d.id,
              name: isEncryptedValue(name) ? 'Entreprise' : name,
              sector: data.city,
              missionsCount: data.missionsCount,
              revenue: formatEur(Number(data.totalRevenue) || 0),
              initials: String(name).slice(0, 2).toUpperCase(),
            };
          })
        );
      } catch (error) {
        console.error('Erreur chargement annuaire entreprises:', error);
      }
    };
    fetchAllCompanies();
  }, [userStructureId]);

  useEffect(() => {
    if (!canRead) return;
    fetchAvailableUsers();
  }, [canRead]);

  // Fonction pour récupérer les utilisateurs disponibles pour le tagging
  const fetchAvailableUsers = async () => {
    try {
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          displayName: data.displayName || 'Utilisateur inconnu',
          email: data.email || '',
          photoURL: data.photoURL || '',
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          role: data.role || ''
        } as TaggedUser;
      });
      setAvailableUsers(users);
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
    }
  };

  // Fonction utilitaire pour échapper les caractères spéciaux dans les expressions régulières
  const escapeRegExp = (string: string): string => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // Fonction locale pour convertir variableId en balise (compatible avec TemplatesPDF)
  const getTagFromVariableId = (variableId: string): string => {
    const tagMap: { [key: string]: string } = {
      // Mission
      numeroMission: '<mission_numero>',
      chargeName: '<mission_cdm>',
      missionDateDebut: '<mission_date_debut>',
      missionDateHeureDebut: '<mission_date_heure_debut>',
      missionDateFin: '<mission_date_fin>',
      missionDateHeureFin: '<mission_date_heure_fin>',
      location: '<mission_lieu>',
      company: '<mission_entreprise>',
      priceHT: '<mission_prix>',
      missionDescription: '<mission_description>',
      title: '<mission_titre>',
      hours: '<mission_heures>',
      studentCount: '<mission_nb_etudiants>',
      generationDate: '<generationDate>',
      generationDatePlusOneYear: '<mission_date_generation_plus_1_an>',
      
      // User
      lastName: '<user_nom>',
      firstName: '<user_prenom>',
      email: '<user_email>',
      ecole: '<user_ecole>',
      displayName: '<user_nom_complet>',
      phone: '<user_telephone>',
      socialSecurityNumber: '<user_numero_securite_sociale>',
      studentId: '<user_numero_etudiant>',
      
      // Company/Entreprise
      name: '<entreprise_nom>',
      companyName: '<entreprise_nom>',
      siren: '<entreprise_siren>',
      nSiret: '<entreprise_nsiret>',
      address: '<entreprise_adresse>',
      companyAddress: '<entreprise_adresse>',
      city: '<entreprise_ville>',
      companyCity: '<entreprise_ville>',
      postalCode: '<entreprise_code_postal>',
      companyPostalCode: '<entreprise_code_postal>',
      country: '<entreprise_pays>',
      companyPhone: '<entreprise_telephone>',
      companyEmail: '<entreprise_email>',
      website: '<entreprise_site_web>',
      companyDescription: '<entreprise_description>',
      
      // Contacts
      contact_fullName: '<contact_nom_complet>',
      contact_firstName: '<contact_prenom>',
      contact_lastName: '<contact_nom>',
      contact_email: '<contact_email>',
      contact_phone: '<contact_telephone>',
      contact_position: '<contact_poste>',
      contact_linkedin: '<contact_linkedin>',
      
      // Structure
      structure_name: '<structure_nom>',
      structure_siret: '<structure_siret>',
      structure_address: '<structure_adresse>',
      structure_city: '<structure_ville>',
      structure_postalCode: '<structure_code_postal>',
      structure_country: '<structure_pays>',
      structure_phone: '<structure_telephone>',
      structure_email: '<structure_email>',
      structure_website: '<structure_site_web>',
      structure_description: '<structure_description>',
      structure_tvaNumber: '<structure_tvaNumber>',
      structure_apeCode: '<structure_apeCode>',
      structure_president_fullName: '<structure_president_nom_complet>',
      structure_ecole: '<structure_ecole>',
      
      // Autres
      charge_email: '<charge_email>',
      charge_phone: '<charge_phone>',
      totalHT: '<totalHT>',
      totalTTC: '<totalTTC>',
      tva: '<tva>',
      courseApplication: '<courseApplication>',
      missionLearning: '<missionLearning>',
      studentProfile: '<studentProfile>',
    };

    return tagMap[variableId] || `<${variableId}>`;
  };

  // Fonction pour remplacer les balises par leurs valeurs (adaptée pour les données d'entreprise)
  // companyOverride et contactsOverride permettent d'injecter les données déchiffrées (ex: génération convention)
  const replaceTags = async (
    text: string,
    structureData?: any,
    tempDataOverride?: { [key: string]: string },
    companyOverride?: Partial<Company>,
    contactsOverride?: Array<Partial<Contact> & { id: string }>
  ): Promise<string> => {
    if (!text || !company) return text;

    const co = companyOverride ? { ...company, ...companyOverride } : company;
    const contactList: Array<Partial<Contact> & { id: string }> = contactsOverride ?? (company.contacts || []).map(c => ({ ...c, id: c.id }));
    const defaultContact = contactList.find(c => c.isDefault) || contactList[0];

    try {
      // Récupérer les données de la structure si nécessaire
      let structureInfo = structureData;
      if (!structureInfo && userStructureId) {
        try {
          const structureDoc = await getDoc(doc(db, 'structures', userStructureId));
          if (structureDoc.exists()) {
            structureInfo = { id: userStructureId, ...structureDoc.data() };
          }
        } catch (error) {
          console.error('Erreur lors de la récupération de la structure:', error);
        }
      }
      if (structureInfo && userStructureId) {
        structureInfo = await decryptStructureForDocument(userStructureId, structureInfo);
      }

      // Récupérer le président du mandat le plus récent
      let presidentFullName = '[Président non disponible]';
      if (userStructureId) {
        try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('structureId', '==', userStructureId));
          const usersSnapshot = await getDocs(q);
          
          const members = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            mandat: doc.data().mandat || null,
            bureauRole: doc.data().bureauRole || null,
            poles: doc.data().poles || [],
            firstName: doc.data().firstName || '',
            lastName: doc.data().lastName || '',
            displayName: doc.data().displayName || ''
          }));

          // Filtrer les présidents (via bureauRole ou pôle 'pre') et trier par mandat le plus récent
          const presidents = members.filter(member => {
            const hasPresidentRole = member.bureauRole === 'president' ||
              member.poles?.some((p: any) => p.poleId === 'pre');
            return hasPresidentRole && member.mandat;
          }).sort((a, b) => {
            if (!a.mandat || !b.mandat) return 0;
            const aYear = parseInt(String(a.mandat).split('-')[0]);
            const bYear = parseInt(String(b.mandat).split('-')[0]);
            return bYear - aYear;
          });

          if (presidents.length > 0) {
            const mostRecentPresident = presidents[0];
            let presidentFirstName = mostRecentPresident.firstName || '';
            let presidentLastName = mostRecentPresident.lastName || '';
            let presidentDisplayName = mostRecentPresident.displayName || '';

            // Déchiffrer le nom du président si nécessaire (pour la convention)
            if (isEncrypted(mostRecentPresident.firstName) || isEncrypted(mostRecentPresident.lastName) || isEncrypted(mostRecentPresident.displayName)) {
              try {
                const functions = getFunctions();
                const decryptUser = httpsCallable(functions, 'decryptUserDataForStructure');
                const res = await decryptUser({ userId: mostRecentPresident.id });
                const dec = (res.data as { decryptedData?: { firstName?: string; lastName?: string; displayName?: string } })?.decryptedData;
                if (dec) {
                  presidentFirstName = dec.firstName ?? presidentFirstName;
                  presidentLastName = dec.lastName ?? presidentLastName;
                  presidentDisplayName = dec.displayName ?? presidentDisplayName;
                }
              } catch (e) {
                console.warn('Déchiffrement président ignoré:', e);
              }
            }

            // Construire le nom complet : prénom + nom ou displayName
            if (presidentFirstName && presidentLastName) {
              presidentFullName = `${presidentFirstName} ${presidentLastName}`.trim();
            } else if (presidentDisplayName) {
              presidentFullName = presidentDisplayName;
            }
          }
        } catch (error) {
          console.error('Erreur lors de la récupération du président:', error);
        }
      }

      // Extraire le SIREN du nSiret (9 premiers chiffres) — utiliser co (données éventuellement déchiffrées)
      let nSiretString = '';
      const rawNSiret = co.nSiret;
      if (rawNSiret && typeof rawNSiret === 'string' && !rawNSiret.startsWith('ENC:')) {
        nSiretString = rawNSiret;
      } else if (rawNSiret && typeof rawNSiret !== 'string') {
        const nSiretNum = Number(rawNSiret);
        if (!isNaN(nSiretNum) && isFinite(nSiretNum)) {
          nSiretString = nSiretNum.toLocaleString('fr-FR', { useGrouping: false, maximumFractionDigits: 0 });
        } else {
          nSiretString = String(rawNSiret);
        }
      }
      if (nSiretString && nSiretString.length < 14 && /^\d+$/.test(nSiretString)) {
        console.warn(`[replaceTags] ⚠️ nSiret potentiellement tronqué! Longueur: ${nSiretString.length}, Valeur: "${nSiretString}"`);
      }
      const siren = nSiretString ? nSiretString.substring(0, 9) : '';

      // Dictionnaire de remplacements (co = entreprise éventuellement déchiffrée, defaultContact = contact éventuellement déchiffré)
      const replacements: { [key: string]: string } = {
        '<entreprise_nom>': co.name || '[Nom entreprise non disponible]',
        '<entreprise_siren>': siren || '[SIREN non disponible]',
        '<entreprise_nsiret>': nSiretString || '[nSiret non disponible]',
        '<entreprise_adresse>': co.address || '[Adresse entreprise non disponible]',
        '<entreprise_ville>': co.city || '[Ville entreprise non disponible]',
        '<entreprise_code_postal>': co.postalCode || '[Code postal non disponible]',
        '<entreprise_pays>': co.country || '[Pays entreprise non disponible]',
        '<entreprise_telephone>': co.phone || '[Téléphone entreprise non disponible]',
        '<entreprise_email>': co.email || '[Email entreprise non disponible]',
        '<entreprise_site_web>': co.website || '[Site web entreprise non disponible]',
        '<entreprise_description>': co.description || '[Description entreprise non disponible]',
        '<company_nom>': co.name || '[Nom entreprise non disponible]',
        '<company_siren>': siren || '[SIREN non disponible]',
        '<company_nsiret>': nSiretString || '[nSiret non disponible]',
        '<company_adresse>': co.address || '[Adresse entreprise non disponible]',
        '<company_ville>': co.city || '[Ville entreprise non disponible]',
        '<company_telephone>': co.phone || '[Téléphone entreprise non disponible]',
        '<company_email>': co.email || '[Email entreprise non disponible]',
        '<companyName>': co.name || '[Nom entreprise non disponible]',
        '<siren>': siren || '[SIREN non disponible]',
        '<nsiret>': nSiretString || '[nSiret non disponible]',
        '<companyAddress>': co.address || '[Adresse entreprise non disponible]',
        '<companyCity>': co.city || '[Ville entreprise non disponible]',
        '<companyPostalCode>': co.postalCode || '[Code postal non disponible]',
        '<country>': co.country || '[Pays entreprise non disponible]',
        '<companyPhone>': co.phone || '[Téléphone entreprise non disponible]',
        '<companyEmail>': co.email || '[Email entreprise non disponible]',
        '<website>': co.website || '[Site web entreprise non disponible]',
        '<companyDescription>': co.description || '[Description entreprise non disponible]',
        '<mission_entreprise>': co.name || '[Nom entreprise non disponible]',
        '<mission_date_generation>': new Date().toLocaleDateString('fr-FR'),
        '<mission_date_generation_plus_1_an>': (() => {
          const today = new Date();
          const oneYearLater = new Date(today);
          oneYearLater.setDate(today.getDate() + 365);
          return oneYearLater.toLocaleDateString('fr-FR');
        })(),
        
        // Balises système supplémentaires
        '<totalHT>': '[Total HT non disponible]',
        '<totalTTC>': '[Total TTC non disponible]',
        '<tva>': '[TVA non disponible]',
        '<courseApplication>': '[Application du cours non disponible]',
        '<missionLearning>': '[Apprentissage non disponible]',
        '<studentProfile>': '[Profil étudiant non disponible]',
        
        // Balises de contact alternatives (compatibilité avec TemplatesPDF)
        '<contact_fullName>': defaultContact ? `${defaultContact.firstName || ''} ${defaultContact.lastName || ''}`.trim() : '[Nom complet du contact non disponible]',
        '<contact_firstName>': defaultContact?.firstName || '[Prénom du contact non disponible]',
        '<contact_lastName>': defaultContact?.lastName || '[Nom du contact non disponible]',
        '<contact_phone>': defaultContact?.phone || '[Téléphone du contact non disponible]',
        '<contact_position>': defaultContact?.position || '[Poste du contact non disponible]',
        '<contact_linkedin>': defaultContact?.linkedin || '[LinkedIn du contact non disponible]',

        // Balises du contact principal (contact_linkedin déjà défini ci-dessus)
        '<contact_nom>': defaultContact?.lastName || '[Nom du contact non disponible]',
        '<contact_prenom>': defaultContact?.firstName || '[Prénom du contact non disponible]',
        '<contact_email>': defaultContact?.email || '[Email du contact non disponible]',
        '<contact_telephone>': defaultContact?.phone || '[Téléphone du contact non disponible]',
        '<contact_poste>': defaultContact?.position || '[Poste du contact non disponible]',
        '<contact_nom_complet>': defaultContact ? `${defaultContact.firstName || ''} ${defaultContact.lastName || ''}`.trim() : '[Nom complet du contact non disponible]',

        // Balises de la structure
        '<structure_nom>': structureInfo?.nom || '[Nom de la structure non disponible]',
        '<structure_ecole>': structureInfo?.ecole || '[École de la structure non disponible]',
        '<structure_adresse>': structureInfo?.address || '[Adresse de la structure non disponible]',
        '<structure_ville>': structureInfo?.city || '[Ville de la structure non disponible]',
        '<structure_code_postal>': structureInfo?.postalCode || '[Code postal de la structure non disponible]',
        '<structure_pays>': structureInfo?.country || '[Pays de la structure non disponible]',
        '<structure_telephone>': structureInfo?.phone || '[Téléphone de la structure non disponible]',
        '<structure_email>': structureInfo?.email || '[Email de la structure non disponible]',
        '<structure_site_web>': structureInfo?.website || '[Site web de la structure non disponible]',
        '<structure_siret>': structureInfo?.siret || '[SIRET de la structure non disponible]',
        '<structure_tvaNumber>': structureInfo?.tvaNumber || '[Numéro de TVA de la structure non disponible]',
        '<structure_apeCode>': structureInfo?.apeCode || '[Code APE de la structure non disponible]',
        '<structure_president_nom_complet>': presidentFullName,

        // Balises système (mission_date_* déjà définis ci-dessus)
        '<generationDate>': new Date().toLocaleDateString('fr-FR'),
        '<currentDate>': new Date().toLocaleDateString('fr-FR'),
        '<currentYear>': new Date().getFullYear().toString(),
        '<currentMonth>': new Date().toLocaleDateString('fr-FR', { month: 'long' }),
      };
      
      console.log(`[replaceTags] Nombre de remplacements disponibles: ${Object.keys(replacements).length}`);
      console.log(`[replaceTags] Balises disponibles:`, Object.keys(replacements));

      let result = text;
      console.log(`[replaceTags] Texte initial: ${text}`);

      // Appliquer les remplacements
      Object.entries(replacements).forEach(([tag, value]) => {
        const regex = new RegExp(escapeRegExp(tag), 'g');
        const before = result;
        
        // Utiliser les données temporaires si disponibles
        const tempValue = tempDataOverride?.[tag.replace(/[<>]/g, '')];
        const finalValue = tempValue || value;
        
        result = result.replace(regex, finalValue);
        
        // Log si un remplacement a eu lieu
        if (result !== before) {
          console.log(`[replaceTags] Remplacé ${tag} par: ${finalValue}`);
        }
      });
      
      console.log(`[replaceTags] Texte final: ${result}`);

      // Vérifier s'il reste des balises non remplacées
      const remainingTags = result.match(/<[^>]+>/g);
      if (remainingTags) {
        remainingTags.forEach(tag => {
          const tagName = tag.replace(/[<>]/g, '');
          result = result.replace(tag, `[Information "${tagName}" non disponible]`);
          console.warn(`[replaceTags] Balise inconnue non remplacée : ${tag}`);
        });
      }

      return result;
    } catch (error) {
      console.error('Erreur lors du remplacement des variables:', error);
      return text;
    }
  };

  const handleSaveNote = async () => {
    if (!newNote.trim() || !company || !currentUser) return;

    try {
      const noteRef = collection(db, 'notes');
      const docRef = await addDoc(noteRef, {
        content: newNote,
        companyId: company.id,
        structureId: company.structureId || '',
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid
      });

      // Envoyer des notifications aux utilisateurs taggés
      if (taggedUsers.length > 0) {
        const notificationPromises = taggedUsers.map(user => 
          NotificationService.sendToUser(
            user.id,
            'mission_update',
            'Nouvelle note sur l\'entreprise',
            `${currentUser.displayName || currentUser.email} vous a mentionné dans une note sur l'entreprise ${company.name}`,
            'medium',
            {
              companyId: company.id,
              companyName: company.name,
              noteId: docRef.id,
              mentionedBy: currentUser.uid,
              source: 'entreprise',
              redirectUrl: `/app/entreprises/${company.id}`
            }
          )
        );

        try {
          await Promise.all(notificationPromises);
          setSnackbar({
            open: true,
            message: `${taggedUsers.length} notification(s) envoyée(s)`,
            severity: 'success'
          });
        } catch (notificationError) {
          console.error('Erreur lors de l\'envoi des notifications:', notificationError);
          // Ne pas faire échouer l'ajout de la note si les notifications échouent
        }
      }

      setNewNote('');
      setTaggedUsers([]);
      
      // Recharger les notes avec les informations de l'auteur
      const notesQuery = query(
        collection(db, 'notes'),
        where('companyId', '==', company.id)
      );
      const notesSnapshot = await getDocs(notesQuery);
      const notesData = await Promise.all(notesSnapshot.docs.map(async docSnapshot => {
        const data = docSnapshot.data();
        const userDoc = await getDoc(doc(db, 'users', data.createdBy));
        const userData = userDoc.data() as UserData | null;
        const authorName = data.createdBy
          ? await getDecryptedUserDisplayName(data.createdBy, userData)
          : 'Utilisateur inconnu';
        return {
          id: docSnapshot.id,
          content: data.content || '',
          createdBy: data.createdBy || '',
          authorName,
          createdAt: toSafeDate(data.createdAt) || new Date()
        };
      })) as Note[];
      setNotes(notesData);
      
      // Ajouter une entrée dans l'historique
      await addHistoryEntry('note', 'Ajout d\'une nouvelle note');
      
      setSnackbar({
        open: true,
        message: 'Note ajoutée avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la note:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de l\'ajout de la note',
        severity: 'error'
      });
    }
  };

  const handleEditClick = () => {
    // Initialiser avec les données déchiffrées pour afficher SIRET, adresse, téléphone en clair
    const dec = decryptedCompany || {};
    const toEdit = company ? {
      ...company,
      ...dec,
      address: (dec.address ?? (dec as any).companyAddress ?? company.address) as string | undefined,
      phone: (dec.phone ?? company.phone) as string | undefined,
      nSiret: (dec.nSiret ?? (dec as any).siret ?? company.nSiret) as string | undefined,
    } : {};
    setEditedCompany(toEdit);
    setEditMode(true);
  };

  const handleEditClose = () => {
    setEditMode(false);
    setEditedCompany({});
  };

  const handleEditSave = async () => {
    if (!id || !editedCompany) return;

    try {
      const companyRef = doc(db, 'companies', id);
      
      // Filtrer les champs undefined
      const updateData = Object.entries(editedCompany).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);

      await updateDoc(companyRef, updateData);
      
      setCompany(prev => prev ? { ...prev, ...updateData } : null);
      setEditMode(false);
      setSnackbar({
        open: true,
        message: 'Entreprise mise à jour avec succès',
        severity: 'success'
      });
      
      // Ajouter une entrée dans l'historique
      await addHistoryEntry('modification', 'Modification des informations de l\'entreprise');
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour de l\'entreprise',
        severity: 'error'
      });
    }
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!id) return;

    try {
      const companyStructureId = company?.structureId;

      const notesQueryConstraints = [where('companyId', '==', id)];
      const notesQuery = query(collection(db, 'notes'), ...notesQueryConstraints);
      const notesSnapshot = await getDocs(notesQuery);

      const contactsQueryConstraints = [where('companyId', '==', id)];
      if (companyStructureId) {
        contactsQueryConstraints.push(where('structureId', '==', companyStructureId));
      }
      const contactsQuery = query(collection(db, 'contacts'), ...contactsQueryConstraints);
      const contactsSnapshot = await getDocs(contactsQuery);

      await deleteDoc(doc(db, 'companies', id));

      const deletePromises = [
        ...notesSnapshot.docs.map(d => deleteDoc(d.ref)),
        ...contactsSnapshot.docs.map(d => deleteDoc(d.ref)),
      ];
      await Promise.all(deletePromises);

      setSnackbar({
        open: true,
        message: 'Entreprise supprimée avec succès',
        severity: 'success'
      });
      
      navigate('/app/entreprises');
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la suppression de l\'entreprise',
        severity: 'error'
      });
    }
  };

  const handleAddContact = async () => {
    if (!company || !currentUser || !newContact.firstName || !newContact.lastName || !newContact.email) return;

    try {
      // Créer le contact dans la collection contacts
      const contactData = {
        firstName: newContact.firstName,
        lastName: newContact.lastName,
        email: newContact.email,
        position: newContact.position || '',
        phone: newContact.phone || '',
        linkedin: newContact.linkedin || '',
        gender: newContact.gender || undefined,
        createdAt: new Date(),
        createdBy: currentUser.uid,
        isDefault: !company.contacts || company.contacts.length === 0,
        companyId: company.id,
        structureId: company.structureId
      };

      const contactRef = await addDoc(collection(db, 'contacts'), contactData);
      const contact = { id: contactRef.id, ...contactData };

      // Mettre à jour l'état local
      setCompany(prev => prev ? { 
        ...prev, 
        contacts: [...(prev.contacts || []), contact] 
      } : null);

      setAddContactDialogOpen(false);
      setNewContact({});
      setSnackbar({
        open: true,
        message: 'Contact ajouté avec succès',
        severity: 'success'
      });
      
      // Ajouter une entrée dans l'historique
      await addHistoryEntry('contact', `Ajout du contact ${contact.firstName} ${contact.lastName}`);
    } catch (error) {
      console.error('Erreur lors de l\'ajout du contact:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de l\'ajout du contact',
        severity: 'error'
      });
    }
  };

  const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file || !company) return;

    try {
      // Afficher un indicateur de chargement
      setSnackbar({
        open: true,
        message: "Téléchargement du logo en cours...",
        severity: "success"
      });
      
      // Télécharger le logo vers Firebase Storage
      const logoUrl = await uploadCompanyLogo(file, company.id);
      
      // Mettre à jour l'entreprise avec le nouveau logo
      const companyRef = doc(db, 'companies', company.id);
      await updateDoc(companyRef, {
        logo: logoUrl
      });
      
      // Mettre à jour l'état local
      setCompany(prev => prev ? { ...prev, logo: logoUrl } : null);
      
      setSnackbar({
        open: true,
        message: "Logo mis à jour avec succès",
        severity: "success"
      });
    } catch (error) {
      console.error("Erreur lors du téléchargement du logo:", error);
      
      setSnackbar({
        open: true,
        message: "Erreur lors du téléchargement du logo",
        severity: "error"
      });
    }
  };

  // Fonction pour générer la convention entreprise (utilise données déchiffrées)
  const handleGenerateConvention = async () => {
    if (!company || !conventionTemplate) {
      setSnackbar({
        open: true,
        message: 'Aucun template de convention n\'est assigné',
        severity: 'error'
      });
      return;
    }

    const decConv = decryptedCompany || {};
    const displayCompanyForConv = {
      ...company,
      ...decConv,
      address: decConv.address ?? (decConv as any).companyAddress ?? company.address,
      phone: decConv.phone ?? company.phone,
      nSiret: decConv.nSiret ?? (decConv as any).siret ?? company.nSiret,
    };
    const displayContactsForConv = (company.contacts || []).map(c => ({ ...c, ...decryptedContacts[c.id] }));

    setGeneratingConvention(true);
    try {
      // Récupérer le template
      const templateDoc = await getDoc(doc(db, 'templates', conventionTemplate));
      
      if (!templateDoc.exists()) {
        throw new Error("Template non trouvé");
      }

      const templateData = templateDoc.data();
      const templatePdfUrl = templateData.pdfUrl;
      const templateVariables = (templateData.variables || []) as TemplateVariable[];

      // 1. Charger et modifier le PDF
      const storageRef = ref(storage, templatePdfUrl);
      const pdfUrl = await getDownloadURL(storageRef);
      
      const response = await fetch(pdfUrl);
      const pdfBlob = await response.blob();
      const pdfBytes = await pdfBlob.arrayBuffer();

      const pdfDoc = await PDFDocument.load(pdfBytes);
      const helveticaFont = await pdfDoc.embedFont('Helvetica');
      const helveticaFontBold = await pdfDoc.embedFont('Helvetica-Bold');
      const pages = pdfDoc.getPages();

      // Tableau pour stocker les variables non reconnues
      const unrecognizedVariables: string[] = [];

      // 2. Traiter chaque variable du template
      for (const variable of templateVariables) {
        const page = pages[variable.position.page - 1] || pages[0];
        const pageHeight = page.getHeight();

        try {
          // Obtenir la valeur de la variable
          let valueToReplace;
          if (variable.type === 'raw') {
            valueToReplace = variable.rawText || '';
          } else if (variable.variableId) {
            valueToReplace = getTagFromVariableId(variable.variableId);
            console.log(`[Convention] Variable ${variable.variableId} -> Balise: ${valueToReplace}`);
          } else {
            valueToReplace = '';
          }

          // Utiliser replaceTags avec les données déchiffrées (entreprise + contacts)
          const value = await replaceTags(valueToReplace, undefined, undefined, displayCompanyForConv, displayContactsForConv);
          console.log(`[Convention] Variable: ${variable.variableId}, Balise: ${valueToReplace} -> Valeur: "${value}"`);
          console.log(`[Convention] Longueur de la valeur: ${value?.length || 0} caractères`);
          
          // Vérifier spécifiquement pour les nSiret
          if (variable.variableId === 'nSiret' || variable.variableId === 'nsiret' || valueToReplace.includes('nsiret')) {
            console.log(`[Convention] ⚠️ nSiret DÉTECTÉ - Variable ID: ${variable.variableId}, Balise: ${valueToReplace}`);
            console.log(`[Convention] ⚠️ nSiret - Valeur complète: "${value}", Longueur: ${value?.length || 0}`);
            console.log(`[Convention] ⚠️ nSiret - nSiret (déchiffré): "${displayCompanyForConv.nSiret}", Type: ${typeof displayCompanyForConv.nSiret}`);
            if (value && value.length < 14) {
              console.error(`[Convention] ❌ ERREUR: nSiret tronqué! Longueur attendue: 14, Longueur actuelle: ${value.length}`);
            }
          }

          if (value === undefined || value === null) {
            unrecognizedVariables.push(variable.name || variable.variableId || 'Variable sans nom');
            continue;
          }

          if (value && value.trim()) {
            // Appliquer les styles et la position
            const fontSize = variable.fontSize || 12;
            const font = variable.isBold ? helveticaFontBold : helveticaFont;
            const { x, y } = variable.position;
            const { width, height } = variable;
            const textAlign = variable.textAlign || 'left';
            const verticalAlign = variable.verticalAlign || 'top';

            // Fonction pour nettoyer le texte des caractères non-encodables en WinAnsi
            const cleanTextForPDF = (text: string, isNumericIdentifier: boolean = false): string => {
              if (!text) return '';
              
              // Pour les identifiants numériques (SIRET, SIREN, etc.), ne pas modifier le texte
              // sauf pour les espaces insécables qui pourraient causer des problèmes
              if (isNumericIdentifier && /^[\d\s\-]+$/.test(text)) {
                // Seulement remplacer les espaces insécables par des espaces normaux
                return text
                  .replace(/\u202F/g, ' ') // Espace insécable fine (0x202f) -> espace normal
                  .replace(/\u00A0/g, ' '); // Espace insécable (nbsp) -> espace normal
              }
              
              // Remplacer les caractères Unicode problématiques par leurs équivalents ASCII
              return text
                .replace(/\u202F/g, ' ') // Espace insécable fine (0x202f) -> espace normal
                .replace(/\u00A0/g, ' ') // Espace insécable (nbsp) -> espace normal
                .replace(/\u2019/g, "'") // Apostrophe courbe -> apostrophe droite
                .replace(/\u2018/g, "'") // Guillemet simple ouvrant -> apostrophe
                .replace(/\u201C/g, '"') // Guillemet double ouvrant -> guillemet droit
                .replace(/\u201D/g, '"') // Guillemet double fermant -> guillemet droit
                .replace(/\u2013/g, '-') // Tiret cadratin -> tiret
                .replace(/\u2014/g, '-') // Tiret cadratin long -> tiret
                .replace(/\u2026/g, '...') // Points de suspension -> trois points
                .replace(/[^\x00-\x7F]/g, (char) => {
                  // Pour les autres caractères non-ASCII, essayer de les convertir
                  // ou les remplacer par un caractère de remplacement
                  const charCode = char.charCodeAt(0);
                  if (charCode >= 0x00A0 && charCode <= 0x00FF) {
                    // Caractères Latin-1, les garder tels quels
                    return char;
                  }
                  // Pour les autres, remplacer par un espace
                  return ' ';
                });
            };

            // Découper le texte en lignes selon la largeur max
            const splitTextToLines = (text: string, font: any, fontSize: number, maxWidth: number, isShortIdentifier: boolean = false): string[] => {
              // Pour les identifiants courts, ne jamais découper - retourner le texte tel quel
              if (isShortIdentifier) {
                console.log(`[splitTextToLines] Identifiant court détecté, retour du texte complet: "${text}" (longueur: ${text.length})`);
                // Vérifier que le texte n'a pas été tronqué
                if (text.length < 14 && /^\d+$/.test(text)) {
                  console.warn(`[splitTextToLines] ⚠️ ATTENTION: Identifiant court détecté mais longueur suspecte: ${text.length} caractères`);
                }
                return [text];
              }
              
              // Si le texte est court, vérifier s'il rentre en une seule ligne
              const fullTextWidth = font.widthOfTextAtSize(text, fontSize);
              if (fullTextWidth <= maxWidth * 1.1) {
                // Si le texte rentre (avec une marge de 10%), le retourner tel quel
                return [text];
              }
              
              // Sinon, découper par mots
              const words = text.split(' ');
              const lines: string[] = [];
              let currentLine = '';
              for (let i = 0; i < words.length; i++) {
                const testLine = currentLine ? currentLine + ' ' + words[i] : words[i];
                const testWidth = font.widthOfTextAtSize(testLine, fontSize);
                if (testWidth > maxWidth && currentLine) {
                  lines.push(currentLine);
                  currentLine = words[i];
                } else {
                  currentLine = testLine;
                }
              }
              if (currentLine) lines.push(currentLine);
              return lines;
            };

            // Détecter si c'est un identifiant court (nSiret, SIREN, etc.) - moins de 25 caractères
            // Vérifier aussi si c'est une variable nSiret spécifiquement
            const isSiretVariable = variable.variableId === 'nSiret' || 
                                     variable.variableId === 'nsiret' ||
                                     variable.variableId === 'entreprise_nsiret' ||
                                     variable.variableId === 'company_nsiret' ||
                                     valueToReplace.includes('nsiret');
            const isNumericIdentifier = /^[\d\s\-]+$/.test(value.trim());
            const isShortIdentifier = (value.trim().length < 25 && isNumericIdentifier) || isSiretVariable;
            
            // Nettoyer le texte en préservant les identifiants numériques
            const cleanedValue = cleanTextForPDF(value, isNumericIdentifier);
            const trimmedValue = cleanedValue.trim();
            
            // Calculer la largeur réelle du texte complet
            const fullTextWidth = font.widthOfTextAtSize(trimmedValue, fontSize);
            
            console.log(`[Convention] Texte avant traitement: "${trimmedValue}", Longueur: ${trimmedValue.length}, Est identifiant court: ${isShortIdentifier}, Est variable SIRET: ${isSiretVariable}, Largeur réelle: ${fullTextWidth}, Largeur zone: ${width}`);
            
            // Pour les identifiants courts et les SIRET, utiliser une largeur très grande pour éviter toute troncature
            // Pour les autres textes, utiliser la largeur de la zone
            const effectiveWidth = isShortIdentifier 
              ? Math.max(fullTextWidth * 2, width * 3) // Utiliser au minimum 2x la largeur réelle ou 3x la largeur de zone
              : (fullTextWidth > width && fullTextWidth < width * 1.5 
                  ? fullTextWidth * 1.1 
                  : width);
            
            const lines = splitTextToLines(trimmedValue, font, fontSize, effectiveWidth, isShortIdentifier);
            
            console.log(`[Convention] Après splitTextToLines - Lignes: ${lines.length}`, lines);
            
            // Calculer la position Y en fonction de l'alignement vertical (identique à MissionDetails.tsx)
            let yPos = pageHeight - y;
            const textHeight = font.heightAtSize(fontSize); // Hauteur réelle du texte
            if (verticalAlign === 'middle') {
              yPos = pageHeight - y - (height / 2) + (fontSize * -0.25);
            } else if (verticalAlign === 'bottom') {
              yPos = pageHeight - (y + height) + fontSize * 0.8;
            }

            const lineHeight = fontSize * 1.2;
            let lineY = yPos;

            // Dessiner chaque ligne
            for (let i = 0; i < lines.length; i++) {
              const line = cleanTextForPDF(lines[i], isNumericIdentifier);
              const lineWidth = font.widthOfTextAtSize(line, fontSize);
              
              console.log(`[Convention] Ligne ${i + 1}/${lines.length}: "${line}", Largeur: ${lineWidth}, Largeur zone: ${width}`);
              
              // Pour les identifiants courts, utiliser la largeur réelle du texte au lieu de la largeur de la zone
              // Pour les autres, utiliser la largeur de la zone
              const referenceWidth = isShortIdentifier ? lineWidth : width;
              
              let xLine = x;
              
              // Calculer la position X en fonction de l'alignement horizontal
              if (textAlign === 'center') {
                xLine = x + (referenceWidth - lineWidth) / 2;
              } else if (textAlign === 'right') {
                xLine = x + referenceWidth - lineWidth;
              } else {
                // left: utiliser x tel quel
                xLine = x;
              }

              try {
                // Pour les identifiants courts, ne JAMAIS utiliser maxWidth - laisser pdf-lib dessiner sans limitation
                const drawOptions: any = {
                  x: xLine,
                  y: lineY,
                  size: fontSize,
                  font,
                  lineHeight: lineHeight
                };
                
                // Ne JAMAIS utiliser maxWidth pour les identifiants courts
                // Pour les autres textes, utiliser effectiveWidth
                if (!isShortIdentifier) {
                  drawOptions.maxWidth = effectiveWidth;
                } else {
                  // Pour les identifiants courts, s'assurer qu'on n'utilise PAS maxWidth
                  // et utiliser une largeur très grande si nécessaire
                  // Ne pas définir maxWidth du tout pour permettre au texte de s'étendre
                }
                
                console.log(`[Convention] Dessin ligne ${i + 1}: "${line}", Longueur: ${line.length}, x: ${xLine}, y: ${lineY}, maxWidth: ${drawOptions.maxWidth || 'NON DÉFINI (identifiant court)'}, referenceWidth: ${referenceWidth}, lineWidth: ${lineWidth}`);
                
                // Vérifier que le texte complet est bien dessiné
                if (isShortIdentifier && line.length !== trimmedValue.length && lines.length === 1) {
                  console.warn(`[Convention] ⚠️ ATTENTION: Le texte pourrait être tronqué. Longueur ligne: ${line.length}, Longueur original: ${trimmedValue.length}`);
                }
                
                page.drawText(line, drawOptions);
              } catch (drawError) {
                console.error(`[Convention] Erreur lors du dessin de la ligne ${i + 1}:`, drawError, line);
                // Si l'erreur persiste, essayer avec un texte encore plus nettoyé
                const fallbackLine = line.replace(/[^\x20-\x7E]/g, ' ');
                const fallbackWidth = font.widthOfTextAtSize(fallbackLine, fontSize);
                
                const fallbackDrawOptions: any = {
                  x: xLine,
                  y: lineY,
                  size: fontSize,
                  font,
                  lineHeight: lineHeight
                };
                
                // Pour les identifiants courts, ne JAMAIS utiliser maxWidth même dans le fallback
                if (!isShortIdentifier) {
                  fallbackDrawOptions.maxWidth = width;
                }
                // Pour les identifiants courts, on ne met PAS maxWidth du tout
                
                page.drawText(fallbackLine, fallbackDrawOptions);
              }
              lineY -= lineHeight;
            }
          }
        } catch (err) {
          console.error(`Erreur lors du traitement de la variable ${variable.name}:`, err);
          unrecognizedVariables.push(variable.name || variable.variableId || 'Variable sans nom');
        }
      }

      // Si des variables n'ont pas été reconnues, afficher un message d'erreur
      if (unrecognizedVariables.length > 0) {
        setSnackbar({
          open: true,
          message: `Variables non reconnues : ${unrecognizedVariables.join(', ')}`,
          severity: 'error'
        });
        setGeneratingConvention(false);
        return;
      }

      // 3. Sauvegarder le PDF modifié
      const modifiedPdfBytes = await pdfDoc.save();
      
      // Créer le nom du fichier (nom d'entreprise déchiffré)
      const companyNameForFile = (displayCompanyForConv.name || company.name || 'Entreprise').replace(/\s+/g, '_');
      const fileName = `Convention_${companyNameForFile}.pdf`;

      // Uploader le fichier modifié
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      const storagePath = `companies/${company.id}/documents/${fileName}`;
      const documentStorageRef = ref(storage, storagePath);
      await uploadBytes(documentStorageRef, blob);
      const documentUrl = await getDownloadURL(documentStorageRef);

      // Créer le document dans Firestore
      const documentData = {
        companyId: company.id,
        documentType: 'convention_entreprise',
        fileName,
        fileUrl: documentUrl,
        fileSize: blob.size,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: currentUser?.uid || '',
        status: 'draft',
        isValid: true,
        tags: ['convention_entreprise']
      };

      await addDoc(collection(db, 'generatedDocuments'), documentData);

      // Télécharger le document
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Ajouter une entrée dans l'historique
      await addHistoryEntry('modification', 'Génération de la convention entreprise');
      
      setSnackbar({
        open: true,
        message: 'Convention générée avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la génération de la convention:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la génération de la convention',
        severity: 'error'
      });
    } finally {
      setGeneratingConvention(false);
    }
  };

  // Fonction pour ajouter une entrée dans l'historique
  const addHistoryEntry = async (type: HistoryItem['type'], description: string) => {
    if (!company || !currentUser) return;
    
    try {
      const historyRef = collection(db, 'history');
      const docRef = await addDoc(historyRef, {
        companyId: company.id,
        type,
        description,
        createdBy: currentUser.uid
      });

      // Mettre à jour l'état local avec la nouvelle entrée
      const newEntry: HistoryItem = {
        id: docRef.id,
        type,
        description,
        createdBy: currentUser.uid,
        authorName: getSafeDisplayName(userData, 'Utilisateur inconnu')
      };
      setHistory(prev => [newEntry, ...prev]);
    } catch (error) {
      console.error('Erreur lors de l\'ajout dans l\'historique:', error);
    }
  };

  const updateCompanyStats = async () => {
    if (!company) return;

    try {
      const missionsRef = collection(db, 'missions');
      const missionsQueryConstraints = [where('companyId', '==', company.id)];
      if (company.structureId) {
        missionsQueryConstraints.push(where('structureId', '==', company.structureId));
      } else if (userStructureId) {
        missionsQueryConstraints.push(where('structureId', '==', userStructureId));
      }
      const missionsQuery = query(missionsRef, ...missionsQueryConstraints);
      const missionsSnapshot = await getDocs(missionsQuery);
      
      // Récupérer les missions
      const missions = missionsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || '',
          numeroMission: data.numeroMission || 0,
          companyId: data.companyId || '',
          startDate: data.startDate ? new Date(data.startDate) : new Date(),
          endDate: data.endDate ? new Date(data.endDate) : null,
          status: data.status || 'en_cours',
          totalTTC: Number(data.totalTTC) || 0
        } as Mission;
      });

      // Calculer les statistiques
      const missionsCount = missions.length;
      const totalRevenue = missions
        .filter(mission => mission.status === 'paid')
        .reduce((total, mission) => total + (mission.totalTTC || 0), 0);

      // Mettre à jour l'entreprise dans Firestore
      const companyRef = doc(db, 'companies', company.id);
      await updateDoc(companyRef, {
        missionsCount,
        totalRevenue,
        updatedAt: new Date()
      });

      // Mettre à jour l'état local
      setCompany(prev => prev ? { ...prev, missionsCount, totalRevenue } : null);
      setMissions(missions);
    } catch (error) {
      console.error('Erreur lors de la mise à jour des statistiques:', error);
    }
  };

  const handleContactMenuOpen = (event: React.MouseEvent<HTMLElement>, contact: Contact) => {
    setContactMenuAnchor(event.currentTarget);
    setSelectedContactForMenu(contact);
  };

  const handleContactMenuClose = () => {
    setContactMenuAnchor(null);
    setSelectedContactForMenu(null);
  };

  const handleEditContactClick = () => {
    if (selectedContactForMenu) {
      setEditContact(selectedContactForMenu);
      setEditContactDialogOpen(true);
    }
    handleContactMenuClose();
  };

  const handleDeleteContactClick = () => {
    if (selectedContactForMenu) {
      setSelectedContact(selectedContactForMenu);
      setDeleteContactDialogOpen(true);
    }
    handleContactMenuClose();
  };

  const handleSetDefaultContact = async () => {
    if (!company || !selectedContactForMenu) return;

    try {
      const updatedContacts = company.contacts?.map(contact => ({
        ...contact,
        isDefault: contact.id === selectedContactForMenu.id
      })) || [];

      const companyRef = doc(db, 'companies', company.id);
      await updateDoc(companyRef, {
        contacts: updatedContacts
      });

      setCompany(prev => prev ? { ...prev, contacts: updatedContacts } : null);
      setSnackbar({
        open: true,
        message: 'Contact principal mis à jour',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du contact principal:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour du contact principal',
        severity: 'error'
      });
    }
    handleContactMenuClose();
  };

  const handleEditContactSave = async () => {
    if (!company || !editContact.id) return;

    try {
      // Mettre à jour le contact dans la collection contacts
      const contactRef = doc(db, 'contacts', editContact.id);
      await updateDoc(contactRef, {
        firstName: editContact.firstName,
        lastName: editContact.lastName,
        email: editContact.email,
        position: editContact.position || '',
        phone: editContact.phone || '',
        linkedin: editContact.linkedin || '',
        gender: editContact.gender || undefined
      });

      // Mettre à jour l'état local
      setCompany(prev => prev ? {
        ...prev,
        contacts: prev.contacts?.map(contact => 
          contact.id === editContact.id ? { ...contact, ...editContact } : contact
        ) || []
      } : null);

      setEditContactDialogOpen(false);
      setEditContact({});
      setSnackbar({
        open: true,
        message: 'Contact mis à jour avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du contact:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour du contact',
        severity: 'error'
      });
    }
  };

  const handleDeleteContactConfirm = async () => {
    if (!company || !selectedContact) return;

    try {
      // Supprimer le contact de la collection contacts
      await deleteDoc(doc(db, 'contacts', selectedContact.id));

      // Mettre à jour l'état local
      setCompany(prev => prev ? {
        ...prev,
        contacts: prev.contacts?.filter(contact => contact.id !== selectedContact.id) || []
      } : null);

      setDeleteContactDialogOpen(false);
      setSelectedContact(null);
      setSnackbar({
        open: true,
        message: 'Contact supprimé avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la suppression du contact:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la suppression du contact',
        severity: 'error'
      });
    }
  };

  // Fonction pour supprimer une note
  const handleDeleteNote = async (noteId: string) => {
    if (!company || !currentUser) return;

    try {
      // Supprimer la note de Firestore
      await deleteDoc(doc(db, 'notes', noteId));

      // Mettre à jour l'état local
      setNotes(prev => prev.filter(note => note.id !== noteId));

      // Ajouter une entrée dans l'historique
      await addHistoryEntry('note', 'Suppression d\'une note');

      setSnackbar({
        open: true,
        message: 'Note supprimée avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la suppression de la note:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la suppression de la note',
        severity: 'error'
      });
    }
  };

  const handleAddContactNote = async () => {
    // Suppression de la fonction
  };

  if (permissionLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: tokens.colors.bgSubtle }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          bgcolor: tokens.colors.bgSubtle,
          px: 2,
          textAlign: 'center'
        }}
      >
        <Typography variant="h6" color="error.main" sx={{ mb: 1, fontWeight: 700 }}>
          Erreur de chargement
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {loadError}
        </Typography>
        <Button variant="contained" onClick={() => navigate('/app/entreprises')}>
          Retour aux entreprises
        </Button>
      </Box>
    );
  }

  if (!canRead) {
    return (
      <AccessDenied
        pageName="Détail entreprise"
        message="Vous n'avez pas les permissions nécessaires pour accéder à cette entreprise."
      />
    );
  }

  const selectedListItem = allCompanies.find((c) => c.id === id);
  const isDetailReady = !!company && !detailLoading;
  const showSecondarySkeleton = isDetailReady && secondaryLoading;

  const dec = decryptedCompany || {};
  const displayCompany = company
    ? {
        ...company,
        ...dec,
        address: (dec.address ?? (dec as any).companyAddress ?? company.address) as string | undefined,
        phone: (dec.phone ?? company.phone) as string | undefined,
        nSiret: (dec.nSiret ?? (dec as any).siret ?? company.nSiret) as string | undefined,
      }
    : null;
  const displayContacts = (company?.contacts || []).map((c) => ({ ...c, ...decryptedContacts[c.id] }));
  const activeMissionsCount = missions.filter((m) => m.status === 'en_cours').length;
  const totalCa = missions.reduce((total, mission) => total + (mission.totalTTC || 0), 0);
  const avgBasket = missions.length ? totalCa / missions.length : 0;
  const detailTabs: { id: DetailTab; label: string; count?: number }[] = [
    { id: 'overview', label: "Vue d'ensemble" },
    { id: 'missions', label: 'Missions', count: missions.length },
    { id: 'history', label: 'Historique', count: history.length },
  ];
  const shellTitle = displayCompany?.name || selectedListItem?.name || 'Entreprise';

  return (
    <>
      {generatingConvention && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            bgcolor: 'white',
            boxShadow: 1,
          }}
        >
          <LinearProgress color="primary" sx={{ height: 6 }} />
          <Box sx={{ py: 1, textAlign: 'center' }}>
            <Typography variant="body2" color="primary.main" fontWeight={600}>
              Génération de la convention en cours...
            </Typography>
          </Box>
        </Box>
      )}

      <AppPageShell
        eyebrow="CRM"
        title={shellTitle}
        status={
          isDetailReady
            ? {
                label: activeMissionsCount > 0 ? 'Client actif' : 'Sans mission active',
                color: activeMissionsCount > 0 ? tokens.colors.success : tokens.colors.gray500,
              }
            : undefined
        }
        actions={
          isDetailReady && canWrite ? (
            <>
              <Button
                size="small"
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={handleEditClick}
                sx={{ textTransform: 'none', borderRadius: tokens.radius.md }}
              >
                Modifier
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDeleteClick}
                sx={{ textTransform: 'none', borderRadius: tokens.radius.md }}
              >
                Supprimer
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={generatingConvention ? <CircularProgress size={16} color="inherit" /> : <AssignmentIcon />}
                onClick={handleGenerateConvention}
                disabled={generatingConvention || !conventionTemplate}
                sx={{ textTransform: 'none', borderRadius: tokens.radius.md, bgcolor: tokens.colors.brandNavy }}
              >
                {generatingConvention ? 'Génération...' : 'Générer la convention'}
              </Button>
            </>
          ) : undefined
        }
      >
        <CompaniesLayout
          directory={
            <CompanySwitcher
              companies={allCompanies}
              selectedId={id}
              search={directorySearch}
              onSearchChange={setDirectorySearch}
              onSelect={(companyId) => navigate(`/app/entreprises/${companyId}`)}
            />
          }
          detail={
            detailLoading || !displayCompany ? (
              <CompanyDetailSkeleton />
            ) : (
            <Box sx={{ minHeight: '100%', bgcolor: tokens.colors.bgPaper }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, p: 2.5, pb: 0 }}>
                <Box sx={{ position: 'relative', flexShrink: 0 }}>
                  {displayCompany.logo ? (
                    <img
                      src={displayCompany.logo}
                      alt={displayCompany.name}
                      style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 12, border: `1px solid ${tokens.colors.divider}`, background: '#fff', padding: 4 }}
                    />
                  ) : (
                    <Avatar sx={{ width: 56, height: 56, borderRadius: tokens.radius.lg, bgcolor: tokens.colors.brandNavy }}>
                      <BusinessIcon />
                    </Avatar>
                  )}
                  {canWrite && (
                    <Button
                      component="label"
                      size="small"
                      sx={{ position: 'absolute', bottom: -6, right: -6, minWidth: 0, p: 0.5, borderRadius: '50%', bgcolor: '#fff', border: `1px solid ${tokens.colors.divider}` }}
                    >
                      <CloudUploadIcon sx={{ fontSize: 14 }} />
                      <input type="file" hidden accept="image/*" ref={fileInputRef} onChange={handleLogoChange} />
                    </Button>
                  )}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 11, color: tokens.colors.gray500, mb: 0.5 }}>
                    {displayCompany.city || 'Ville non renseignée'}
                    {company?.createdAt ? ` · Ajoutée ${formatDate(company.createdAt)}` : ''}
                  </Typography>
                  {(displayCompany.nSiret && !String(displayCompany.nSiret).startsWith('ENC:')) && (
                    <Typography sx={{ fontSize: 12, color: tokens.colors.gray500 }}>SIRET {displayCompany.nSiret}</Typography>
                  )}
                </Box>
              </Box>

              <Tabs
                value={detailTabs.findIndex((t) => t.id === activeTab)}
                onChange={(_, index) => setActiveTab(detailTabs[index].id)}
                sx={{ ...dsTabsSx, px: 2.5, borderBottom: `1px solid ${tokens.colors.divider}` }}
              >
                {detailTabs.map((tab) => (
                  <Tab
                    key={tab.id}
                    label={
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                        {tab.label}
                        {tab.count != null && (
                          <Box component="span" sx={{ fontSize: 10, px: 0.75, py: 0.125, borderRadius: tokens.radius.pill, bgcolor: tokens.colors.gray100, color: tokens.colors.gray600, fontWeight: 600 }}>
                            {tab.count}
                          </Box>
                        )}
                      </Box>
                    }
                  />
                ))}
              </Tabs>

              <Box sx={{ p: 2.5 }}>
                {showSecondarySkeleton ? (
                  <CompanyDetailContentSkeleton />
                ) : (
                  <>
                {activeTab === 'overview' && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <DetailPanel title="Informations">
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
                        {[
                          { label: 'Raison sociale', value: displayCompany.name },
                          { label: 'SIRET', value: displayCompany.nSiret },
                          { label: 'Adresse', value: displayCompany.address },
                          { label: 'Code postal', value: displayCompany.postalCode },
                          { label: 'Ville', value: displayCompany.city },
                          { label: 'Pays', value: displayCompany.country },
                          { label: 'Site web', value: displayCompany.website },
                          { label: 'Email', value: displayCompany.email },
                          { label: 'Téléphone', value: displayCompany.phone },
                        ].map((field) => (
                          <Box key={field.label}>
                            <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, mb: 0.5 }}>{field.label}</Typography>
                            {field.value && !String(field.value).startsWith('ENC:') ? (
                              <Typography sx={{ fontSize: 13, fontWeight: 500, color: tokens.colors.gray900 }}>{field.value}</Typography>
                            ) : (
                              <Typography sx={{ fontSize: 12, color: tokens.colors.gray300, fontStyle: 'italic' }}>Non renseigné</Typography>
                            )}
                          </Box>
                        ))}
                      </Box>
                      {displayCompany.description && (
                        <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${tokens.colors.gray100}` }}>
                          <Typography sx={{ fontSize: 11, color: tokens.colors.gray400, mb: 0.5 }}>Description</Typography>
                          <Typography sx={{ fontSize: 13, color: tokens.colors.gray700, lineHeight: 1.6 }}>{displayCompany.description}</Typography>
                        </Box>
                      )}
                    </DetailPanel>
                    <DetailPanel title="Indicateurs">
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
                        <DetailKpiCard label="CA total" value={formatEur(totalCa)} />
                        <DetailKpiCard label="Missions" value={missions.length} />
                        <DetailKpiCard label="En cours" value={activeMissionsCount} />
                        <DetailKpiCard label="Panier moyen" value={formatEur(avgBasket)} />
                      </Box>
                    </DetailPanel>
                  </Box>
                )}

                {activeTab === 'missions' && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {missions.length === 0 ? (
                      <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${tokens.colors.divider}`, borderRadius: tokens.radius.lg }}>
                        <AssignmentIcon sx={{ color: tokens.colors.gray300, fontSize: 32, mb: 1 }} />
                        <Typography sx={{ fontSize: 13, color: tokens.colors.gray500 }}>Aucune mission avec cette entreprise.</Typography>
                      </Box>
                    ) : (
                      missions.map((mission) => (
                        <Box
                          key={mission.id}
                          onClick={() => navigate(`/app/mission/${mission.id}`)}
                          sx={{ p: 2, border: `1px solid ${tokens.colors.divider}`, borderRadius: tokens.radius.lg, bgcolor: tokens.colors.bgPaper, cursor: 'pointer', '&:hover': { borderColor: tokens.colors.brandTeal } }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Typography sx={{ fontFamily: 'monospace', fontSize: 11, color: tokens.colors.gray400 }}>M-{mission.numeroMission}</Typography>
                            <Chip
                              label={mission.status}
                              size="small"
                              sx={{
                                bgcolor: mission.status === 'en_cours' ? tokens.colors.brandTeal100 : tokens.colors.gray100,
                                color: mission.status === 'en_cours' ? tokens.colors.brandTeal700 : tokens.colors.gray600,
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            />
                            <Typography sx={{ ml: 'auto', fontSize: 15, fontWeight: 700, color: tokens.colors.gray900 }}>{formatEur(mission.totalTTC)}</Typography>
                          </Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.colors.gray900, mb: 0.5 }}>
                            {mission.title || `Mission #${mission.numeroMission}`}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap', pt: 1.25, borderTop: `1px solid ${tokens.colors.gray100}` }}>
                            {mission.contact?.firstName && mission.contact?.lastName ? (
                              <Typography sx={{ fontSize: 12, color: tokens.colors.gray600 }}>
                                Chargé de mission · {mission.contact.firstName} {mission.contact.lastName}
                              </Typography>
                            ) : (
                              <Typography sx={{ fontSize: 12, color: tokens.colors.gray400 }}>Chargé de mission non assigné</Typography>
                            )}
                            <Typography sx={{ fontSize: 12, color: tokens.colors.gray500 }}>
                              {formatDate(mission.startDate)}{mission.endDate ? ` → ${formatDate(mission.endDate)}` : ''}
                            </Typography>
                          </Box>
                        </Box>
                      ))
                    )}
                  </Box>
                )}

                {activeTab === 'history' && (
                  <DetailPanel title="Historique des modifications">
                    {history.length === 0 ? (
                      <Typography sx={{ textAlign: 'center', color: tokens.colors.gray500, py: 3 }}>Aucun historique disponible</Typography>
                    ) : (
                      <List sx={{ p: 0 }}>
                        {history.map((item, index) => (
                          <React.Fragment key={item.id}>
                            <ListItem sx={{ px: 0, py: 1.5 }}>
                              <ListItemAvatar>
                                <Avatar sx={{ bgcolor: tokens.colors.gray100, color: tokens.colors.gray700, width: 32, height: 32 }}>
                                  {item.type === 'creation' && <BusinessIcon sx={{ fontSize: 16 }} />}
                                  {item.type === 'modification' && <EditIcon sx={{ fontSize: 16 }} />}
                                  {item.type === 'mission' && <AssignmentIcon sx={{ fontSize: 16 }} />}
                                  {item.type === 'contact' && <PersonIcon sx={{ fontSize: 16 }} />}
                                  {item.type === 'note' && <NoteIcon sx={{ fontSize: 16 }} />}
                                </Avatar>
                              </ListItemAvatar>
                              <ListItemText
                                primary={<Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.colors.gray900 }}>{item.description}</Typography>}
                                secondary={<UserReferenceText userId={item.createdBy} name={item.authorName} component="span" sx={{ fontSize: 11, color: tokens.colors.gray500, mt: 0.25 }} />}
                              />
                            </ListItem>
                            {index < history.length - 1 && <Divider />}
                          </React.Fragment>
                        ))}
                      </List>
                    )}
                  </DetailPanel>
                )}
                  </>
                )}
              </Box>
            </Box>
            )
          }
          rail={
            detailLoading || !displayCompany || showSecondarySkeleton ? (
              <CompanyDetailRailSkeleton />
            ) : (
            <Box>
              <SidebarBlock
                title="Contacts"
                action={
                  canWrite ? (
                    <IconButton size="small" onClick={() => setAddContactDialogOpen(true)} sx={{ border: `1px solid ${tokens.colors.divider}`, borderRadius: tokens.radius.md }}>
                      <AddIcon fontSize="small" />
                    </IconButton>
                  ) : undefined
                }
              >
                {displayContacts.length === 0 ? (
                  <Typography sx={{ fontSize: 12, color: tokens.colors.gray500, textAlign: 'center', py: 1 }}>Aucun contact</Typography>
                ) : (
                  [...displayContacts]
                    .sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0))
                    .map((contact) => (
                      <Box key={contact.id} sx={{ position: 'relative', mb: 1 }}>
                        <ContactCard
                          name={`${contact.firstName} ${contact.lastName}`}
                          role={contact.position}
                          email={contact.email}
                          phone={contact.phone}
                          primary={contact.isDefault}
                        />
                        {canWrite && (
                          <IconButton
                            size="small"
                            onClick={(e) => handleContactMenuOpen(e, contact)}
                            sx={{ position: 'absolute', top: 8, right: 8 }}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    ))
                )}
              </SidebarBlock>

              <SidebarBlock title="Synthèse">
                <Box sx={{ display: 'grid', gap: 1 }}>
                  <DetailKpiCard label="Missions totales" value={missions.length} />
                  <DetailKpiCard label="Missions en cours" value={activeMissionsCount} />
                  <DetailKpiCard label="CA total" value={formatEur(totalCa)} />
                </Box>
              </SidebarBlock>

              <SidebarBlock title="Notes">
                {canWrite && (
                  <Box sx={{ mb: 1.5 }}>
                    <TaggingInput
                      value={newNote}
                      onChange={setNewNote}
                      placeholder="Écrire une note interne…"
                      multiline
                      rows={3}
                      availableUsers={availableUsers}
                      onTaggedUsersChange={setTaggedUsers}
                    />
                    <Button
                      fullWidth
                      size="small"
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={handleSaveNote}
                      disabled={!newNote.trim()}
                      sx={{ mt: 1, textTransform: 'none', borderRadius: tokens.radius.md, bgcolor: tokens.colors.brandTeal }}
                    >
                      Ajouter
                    </Button>
                  </Box>
                )}
                {notes.length === 0 ? (
                  <Typography sx={{ fontSize: 12, color: tokens.colors.gray500, textAlign: 'center', py: 1 }}>Aucune note</Typography>
                ) : (
                  notes.map((note) => (
                    <Box key={note.id} sx={{ p: 1.25, mb: 1, border: `1px solid ${tokens.colors.divider}`, borderRadius: tokens.radius.md, bgcolor: tokens.colors.bgPaper }}>
                      <Typography sx={{ fontSize: 12, color: tokens.colors.gray700, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{note.content}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 10, color: tokens.colors.gray400 }}>
                          <UserReferenceText userId={note.createdBy} name={note.authorName} component="span" sx={{ fontSize: 10, color: tokens.colors.gray400 }} />
                          <span>· {formatDate(note.createdAt)}</span>
                        </Box>
                        {canWrite && (
                          <IconButton size="small" onClick={() => handleDeleteNote(note.id)}>
                            <DeleteIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        )}
                      </Box>
                    </Box>
                  ))
                )}
              </SidebarBlock>
            </Box>
            )
          }
        />
      </AppPageShell>

      {/* Dialog d'édition */}
      <Dialog 
        open={editMode} 
        onClose={handleEditClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Modifier l'entreprise</Typography>
            <IconButton onClick={handleEditClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Nom"
                fullWidth
                value={editedCompany.name || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="nSiret"
                fullWidth
                value={editedCompany.nSiret || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, nSiret: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={3}
                value={editedCompany.description || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Adresse"
                fullWidth
                value={editedCompany.address || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, address: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Code postal"
                fullWidth
                value={editedCompany.postalCode || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, postalCode: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Ville"
                fullWidth
                value={editedCompany.city || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, city: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Pays"
                fullWidth
                value={editedCompany.country || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, country: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Téléphone"
                fullWidth
                value={editedCompany.phone || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, phone: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email"
                fullWidth
                value={editedCompany.email || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, email: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Site web"
                fullWidth
                value={editedCompany.website || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, website: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditClose}>Annuler</Button>
          <Button 
            onClick={handleEditSave}
            variant="contained"
            startIcon={<SaveIcon />}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer cette entreprise ? Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
          <Button 
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog d'ajout de contact */}
      <Dialog 
        open={addContactDialogOpen} 
        onClose={() => setAddContactDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '1.2rem',
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle sx={{ 
          p: 3, 
          borderBottom: `1px solid ${tokens.colors.borderDefault}`,
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
            Ajouter un contact
          </Typography>
          <IconButton 
            onClick={() => setAddContactDialogOpen(false)} 
            size="small"
            sx={{ 
              color: tokens.colors.textSecondary,
              '&:hover': {
                bgcolor: 'transparent',
                color: tokens.colors.textPrimary
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 4 }}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 3
          }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: tokens.colors.textSecondary, 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Prénom *
                  </Typography>
                  <TextField
                    fullWidth
                    value={newContact.firstName || ''}
                    onChange={(e) => setNewContact(prev => ({ ...prev, firstName: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez le prénom"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: tokens.colors.bgSubtle,
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: tokens.colors.textSecondary, 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Nom *
                  </Typography>
                  <TextField
                    fullWidth
                    value={newContact.lastName || ''}
                    onChange={(e) => setNewContact(prev => ({ ...prev, lastName: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez le nom"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: tokens.colors.bgSubtle,
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: tokens.colors.textSecondary, 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Email *
                  </Typography>
                  <TextField
                    fullWidth
                    type="email"
                    value={newContact.email || ''}
                    onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez l'email"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: tokens.colors.bgSubtle,
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: tokens.colors.textSecondary, 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Téléphone
                  </Typography>
                  <TextField
                    fullWidth
                    type="tel"
                    value={newContact.phone || ''}
                    onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez le numéro de téléphone"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: tokens.colors.bgSubtle,
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: tokens.colors.textSecondary, 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Poste
                  </Typography>
                  <TextField
                    fullWidth
                    value={newContact.position || ''}
                    onChange={(e) => setNewContact(prev => ({ ...prev, position: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez le poste"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: tokens.colors.bgSubtle,
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: tokens.colors.textSecondary, 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    LinkedIn
                  </Typography>
                  <TextField
                    fullWidth
                    type="url"
                    value={newContact.linkedin || ''}
                    onChange={(e) => setNewContact(prev => ({ ...prev, linkedin: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez l'URL du profil LinkedIn"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: tokens.colors.bgSubtle,
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: tokens.colors.textSecondary, 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Sexe
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1.5,
                        cursor: 'pointer',
                        p: 1,
                        borderRadius: '0.6rem',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: tokens.colors.bgSubtle
                        }
                      }}
                      onClick={() => setNewContact(prev => ({ ...prev, gender: 'homme' }))}
                    >
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          border: '2px solid',
                          borderColor: newContact.gender === 'homme' ? '#0066cc' : '#d2d2d7',
                          bgcolor: newContact.gender === 'homme' ? '#0066cc' : 'transparent',
                          position: 'relative',
                          transition: 'all 0.2s ease',
                          '&::after': newContact.gender === 'homme' ? {
                            content: '""',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: 'white'
                          } : {}
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: '0.875rem',
                          color: newContact.gender === 'homme' ? tokens.colors.textPrimary : tokens.colors.textSecondary,
                          fontWeight: newContact.gender === 'homme' ? 500 : 400,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Homme
                      </Typography>
                    </Box>
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1.5,
                        cursor: 'pointer',
                        p: 1,
                        borderRadius: '0.6rem',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: tokens.colors.bgSubtle
                        }
                      }}
                      onClick={() => setNewContact(prev => ({ ...prev, gender: 'femme' }))}
                    >
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          border: '2px solid',
                          borderColor: newContact.gender === 'femme' ? '#0066cc' : '#d2d2d7',
                          bgcolor: newContact.gender === 'femme' ? '#0066cc' : 'transparent',
                          position: 'relative',
                          transition: 'all 0.2s ease',
                          '&::after': newContact.gender === 'femme' ? {
                            content: '""',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: 'white'
                          } : {}
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: '0.875rem',
                          color: newContact.gender === 'femme' ? tokens.colors.textPrimary : tokens.colors.textSecondary,
                          fontWeight: newContact.gender === 'femme' ? 500 : 400,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Femme
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ 
          p: 3, 
          borderTop: `1px solid ${tokens.colors.borderDefault}`,
          justifyContent: 'flex-end',
          gap: 1
        }}>
          <Button 
            onClick={() => setAddContactDialogOpen(false)}
            sx={{ 
              color: tokens.colors.textSecondary,
              '&:hover': {
                bgcolor: 'transparent',
                color: tokens.colors.textPrimary
              }
            }}
          >
            Annuler
          </Button>
          <Button 
            onClick={handleAddContact}
            variant="contained"
            disabled={!newContact.firstName || !newContact.lastName || !newContact.email}
            sx={{
              bgcolor: '#0066cc',
              borderRadius: '0.8rem',
              px: 3,
              py: 1,
              '&:hover': {
                bgcolor: '#0077ed'
              },
              '&.Mui-disabled': {
                bgcolor: tokens.colors.textSecondary
              }
            }}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog d'édition de contact */}
      <Dialog
        open={editContactDialogOpen}
        onClose={() => setEditContactDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '1.2rem',
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle sx={{ 
          p: 3, 
          borderBottom: `1px solid ${tokens.colors.borderDefault}`,
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
            Modifier le contact
          </Typography>
          <IconButton 
            onClick={() => setEditContactDialogOpen(false)} 
            size="small"
            sx={{ 
              color: tokens.colors.textSecondary,
              '&:hover': {
                bgcolor: 'transparent',
                color: tokens.colors.textPrimary
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 4 }}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 3
          }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: tokens.colors.textSecondary, 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Prénom *
                  </Typography>
                  <TextField
                    fullWidth
                    value={editContact.firstName || ''}
                    onChange={(e) => setEditContact(prev => ({ ...prev, firstName: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez le prénom"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: tokens.colors.bgSubtle,
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: tokens.colors.textSecondary, 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Nom *
                  </Typography>
                  <TextField
                    fullWidth
                    value={editContact.lastName || ''}
                    onChange={(e) => setEditContact(prev => ({ ...prev, lastName: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez le nom"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: tokens.colors.bgSubtle,
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: tokens.colors.textSecondary, 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Email *
                  </Typography>
                  <TextField
                    fullWidth
                    type="email"
                    value={editContact.email || ''}
                    onChange={(e) => setEditContact(prev => ({ ...prev, email: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez l'email"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: tokens.colors.bgSubtle,
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: tokens.colors.textSecondary, 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Téléphone
                  </Typography>
                  <TextField
                    fullWidth
                    type="tel"
                    value={editContact.phone || ''}
                    onChange={(e) => setEditContact(prev => ({ ...prev, phone: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez le numéro de téléphone"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: tokens.colors.bgSubtle,
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: tokens.colors.textSecondary, 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Poste
                  </Typography>
                  <TextField
                    fullWidth
                    value={editContact.position || ''}
                    onChange={(e) => setEditContact(prev => ({ ...prev, position: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez le poste"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: tokens.colors.bgSubtle,
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: tokens.colors.textSecondary, 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    LinkedIn
                  </Typography>
                  <TextField
                    fullWidth
                    type="url"
                    value={editContact.linkedin || ''}
                    onChange={(e) => setEditContact(prev => ({ ...prev, linkedin: e.target.value }))}
                    variant="outlined"
                    placeholder="Entrez l'URL du profil LinkedIn"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.8rem',
                        bgcolor: tokens.colors.bgSubtle,
                        '& fieldset': {
                          borderColor: 'transparent'
                        },
                        '&:hover fieldset': {
                          borderColor: '#d2d2d7'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0066cc'
                        }
                      }
                    }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: tokens.colors.textSecondary, 
                      mb: 1, 
                      display: 'block',
                      fontWeight: 500
                    }}
                  >
                    Sexe
                  </Typography>
                                    <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1.5,
                        cursor: 'pointer',
                        p: 1,
                        borderRadius: '0.6rem',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: tokens.colors.bgSubtle
                        }
                      }}
                      onClick={() => setEditContact(prev => ({ ...prev, gender: 'homme' }))}
                    >
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          border: '2px solid',
                          borderColor: editContact.gender === 'homme' ? '#0066cc' : '#d2d2d7',
                          bgcolor: editContact.gender === 'homme' ? '#0066cc' : 'transparent',
                          position: 'relative',
                          transition: 'all 0.2s ease',
                          '&::after': editContact.gender === 'homme' ? {
                            content: '""',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: 'white'
                          } : {}
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: '0.875rem',
                          color: editContact.gender === 'homme' ? tokens.colors.textPrimary : tokens.colors.textSecondary,
                          fontWeight: editContact.gender === 'homme' ? 500 : 400,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Homme
                      </Typography>
                    </Box>
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1.5,
                        cursor: 'pointer',
                        p: 1,
                        borderRadius: '0.6rem',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: tokens.colors.bgSubtle
                        }
                      }}
                      onClick={() => setEditContact(prev => ({ ...prev, gender: 'femme' }))}
                    >
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          border: '2px solid',
                          borderColor: editContact.gender === 'femme' ? '#0066cc' : '#d2d2d7',
                          bgcolor: editContact.gender === 'femme' ? '#0066cc' : 'transparent',
                          position: 'relative',
                          transition: 'all 0.2s ease',
                          '&::after': editContact.gender === 'femme' ? {
                            content: '""',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: 'white'
                          } : {}
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: '0.875rem',
                          color: editContact.gender === 'femme' ? tokens.colors.textPrimary : tokens.colors.textSecondary,
                          fontWeight: editContact.gender === 'femme' ? 500 : 400,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Femme
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ 
          p: 3, 
          borderTop: `1px solid ${tokens.colors.borderDefault}`,
          justifyContent: 'flex-end',
          gap: 1
        }}>
          <Button 
            onClick={() => setEditContactDialogOpen(false)}
            sx={{ 
              color: tokens.colors.textSecondary,
              '&:hover': {
                bgcolor: 'transparent',
                color: tokens.colors.textPrimary
              }
            }}
          >
            Annuler
          </Button>
          <Button 
            onClick={handleEditContactSave}
            variant="contained"
            disabled={!editContact.firstName || !editContact.lastName || !editContact.email}
            sx={{
              bgcolor: '#0066cc',
              borderRadius: '0.8rem',
              px: 3,
              py: 1,
              '&:hover': {
                bgcolor: '#0077ed'
              },
              '&.Mui-disabled': {
                bgcolor: tokens.colors.textSecondary
              }
            }}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmation de suppression de contact */}
      <Dialog
        open={deleteContactDialogOpen}
        onClose={() => setDeleteContactDialogOpen(false)}
      >
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer ce contact ? Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteContactDialogOpen(false)}>Annuler</Button>
          <Button 
            onClick={handleDeleteContactConfirm}
            color="error"
            variant="contained"
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar pour les notifications */}
      {createPortal(
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          sx={{ zIndex: 10000 }}
        >
          <Alert 
            onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>,
        document.body
      )}

      {/* Menu d'actions du contact */}
      <Menu
        anchorEl={contactMenuAnchor}
        open={Boolean(contactMenuAnchor)}
        onClose={handleContactMenuClose}
        PaperProps={{
          sx: {
            borderRadius: '1.2rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            minWidth: 200
          }
        }}
      >
        <MenuItem onClick={handleEditContactClick}>
          <EditIcon sx={{ mr: 1, fontSize: 20 }} />
          Modifier
        </MenuItem>
        <MenuItem onClick={handleSetDefaultContact}>
          {selectedContactForMenu?.isDefault ? (
            <>
              <StarIcon sx={{ mr: 1, fontSize: 20, color: '#0066cc' }} />
              Retirer comme contact principal
            </>
          ) : (
            <>
              <StarBorderIcon sx={{ mr: 1, fontSize: 20 }} />
              Définir comme contact principal
            </>
          )}
        </MenuItem>
        <MenuItem 
          onClick={handleDeleteContactClick}
          sx={{ color: '#ff3b30' }}
        >
          <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
          Supprimer
        </MenuItem>
      </Menu>
    </>
  );
};

export default EntrepriseDetail;