import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  IconButton,
  CircularProgress,
  Chip,
  InputAdornment,
  Autocomplete,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
  ArrowBack as ArrowBackIcon,
  Description as DescriptionIcon,
  Search as SearchIcon,
  LinkOff as LinkOffIcon,
  Link as LinkIcon,
  VisibilityOff as VisibilityOffIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { VARIABLE_TAGS, type TagMapping } from '../../utils/variableTags';
import {
  decryptUserForDocument,
  decryptContactForDocument,
  decryptStructureForDocument,
  decryptCompanyForDocument,
} from '../../utils/documentDecryptUtils';

// --- Types ---
interface TemplateVariable {
  id: string; name: string; description: string;
  type: 'text' | 'number' | 'date' | 'list' | 'raw';
  variableId?: string; rawText?: string; fieldId?: string;
  position: { x: number; y: number; page: number };
  fontSize: number; fontFamily?: string; lineHeight?: number; dataSource?: string;
  width: number; height: number;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  verticalAlign: 'top' | 'middle' | 'bottom';
  isBold?: boolean;
}
interface Template {
  id: string; name: string; description: string;
  file: { url: string; name: string; type: string } | null;
  pdfUrl: string; fileName: string; variables: TemplateVariable[];
}
interface EntityOption { id: string; label: string; data: any; }
interface ManualDocumentGeneratorProps {
  onClose: () => void;
  /** Pré-sélectionne cette mission une fois une template choisie */
  preselectedMissionId?: string;
  closeLabel?: string;
}

// --- Constants ---
const PDF_BASE_WIDTH = 595;
const PDF_BASE_HEIGHT = 842;
const RENDER_WIDTH = 600;
const SCALE = RENDER_WIDTH / PDF_BASE_WIDTH;
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isEncrypted = (v: any): boolean => typeof v === 'string' && v.startsWith('ENC:');

// --- Tag → data field mappings ---
const MISSION_TAG_MAP: Record<string, (d: any) => string> = {
  '<mission_numero>': d => d.numeroMission || '',
  '<mission_cdm>': d => d.chargeName || '',
  '<mission_cdm_email>': d => d.chargeEmail || d.charge_email || '',
  '<mission_cdm_telephone>': d => d.chargePhone || d.charge_phone || '',
  '<mission_date_debut>': d => d.startDate ? new Date(d.startDate).toLocaleDateString('fr-FR') : '',
  '<mission_date_heure_debut>': d => { if (!d.startDate) return ''; const dt = new Date(d.startDate); return `${dt.toLocaleDateString('fr-FR')} à ${dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`; },
  '<mission_date_fin>': d => d.endDate ? new Date(d.endDate).toLocaleDateString('fr-FR') : '',
  '<mission_date_heure_fin>': d => { if (!d.endDate) return ''; const dt = new Date(d.endDate); return `${dt.toLocaleDateString('fr-FR')} à ${dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`; },
  '<mission_lieu>': d => d.location || '',
  '<mission_entreprise>': d => d.company || '',
  '<mission_type>': d => d.missionType || '',
  '<mission_date_generation>': () => new Date().toLocaleDateString('fr-FR'),
  '<mission_date_generation_plus_1_an>': () => { const dt = new Date(); dt.setDate(dt.getDate() + 365); return dt.toLocaleDateString('fr-FR'); },
  '<mission_prix>': d => d.priceHT?.toString() || '',
  '<mission_prix_horaire_ht>': d => d.priceHT?.toFixed?.(2) || d.priceHT?.toString() || '',
  '<mission_prix_total_heures_ht>': d => (d.priceHT && d.hours) ? (d.priceHT * d.hours).toFixed(2) : '',
  '<mission_description>': d => d.description || '',
  '<mission_titre>': d => d.title || '',
  '<mission_heures>': d => d.hours?.toString() || '',
  '<mission_nb_etudiants>': d => d.studentCount?.toString() || '',
  '<total_ttc>': d => d.totalTTC?.toFixed?.(2) || d.totalTTC?.toString() || '',
  '<tva>': d => {
    if (d.priceHT && d.hours) { return (d.priceHT * d.hours * 0.2).toFixed(2); }
    return '';
  },
  '<course_application>': d => d._missionTypeData?.courseApplication || d.courseApplication || '',
  '<mission_learning>': d => d._missionTypeData?.missionLearning || d.missionLearning || '',
  '<student_profile>': d => d._missionTypeData?.studentProfile || d.studentProfile || '',
};
const COMPANY_TAG_MAP: Record<string, (d: any) => string> = {
  '<entreprise_nom>': d => d.name || '',
  '<entreprise_siren>': d => d.siren || '',
  '<entreprise_nsiret>': d => d.nSiret || '',
  '<entreprise_adresse>': d => d.address || '',
  '<entreprise_ville>': d => d.city || '',
  '<entreprise_pays>': d => d.country || '',
  '<entreprise_telephone>': d => d.phone || '',
  '<entreprise_email>': d => d.email || '',
  '<entreprise_site_web>': d => d.website || '',
  '<entreprise_description>': d => d.description || '',
};
const CONTACT_TAG_MAP: Record<string, (d: any) => string> = {
  '<contact_fullName>': d => `${d.firstName || ''} ${d.lastName || ''}`.trim(),
  '<contact_nom_complet>': d => `${d.firstName || ''} ${d.lastName || ''}`.trim(),
  '<contact_firstName>': d => d.firstName || '',
  '<contact_lastName>': d => d.lastName || '',
  '<contact_email>': d => d.email || '',
  '<contact_phone>': d => d.phone || '',
  '<contact_position>': d => d.position || '',
  '<contact_linkedin>': d => d.linkedin || '',
};
const USER_TAG_MAP: Record<string, (d: any) => string> = {
  '<user_nom>': d => d.lastName || '',
  '<user_prenom>': d => d.firstName || '',
  '<user_email>': d => d.email || '',
  '<user_ecole>': d => d.ecole || '',
  '<user_telephone>': d => d.phone || '',
  '<user_adresse>': d => d.address || '',
  '<user_code_postal>': d => d.postalCode || '',
  '<user_ville>': d => d.city || '',
  '<user_code_postal_naissance>': d => d.birthPostalCode || '',
  '<user_formation>': d => d.formation || '',
  '<user_programme>': d => d.program || '',
  '<user_annee_diplome>': d => d.graduationYear?.toString() || '',
  '<user_nationalite>': d => d.nationality || '',
  '<user_genre>': d => d.gender || '',
  '<user_lieu_naissance>': d => d.birthPlace || '',
  '<user_date_naissance>': d => {
    if (!d.birthDate) return '';
    if (typeof d.birthDate === 'string') {
      const m = d.birthDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : d.birthDate;
    }
    return new Date(d.birthDate).toLocaleDateString('fr-FR');
  },
  '<user_numero_etudiant>': d => d.studentId || '',
  '<user_numero_securite_sociale>': d => d.socialSecurityNumber || '',
};
const STRUCTURE_TAG_MAP: Record<string, (d: any) => string> = {
  '<structure_nom>': d => d.name || d.nom || '',
  '<structure_siret>': d => d.nSiret || d.siret || '',
  '<structure_adresse>': d => d.address || '',
  '<structure_ville>': d => d.city || '',
  '<structure_code_postal>': d => d.postalCode || '',
  '<structure_pays>': d => d.country || '',
  '<structure_telephone>': d => d.phone || '',
  '<structure_email>': d => d.email || '',
  '<structure_site_web>': d => d.website || '',
  '<structure_president_nom_complet>': d => {
    if (d.presidents && Array.isArray(d.presidents) && d.presidents.length > 0) {
      const p = d.presidents[d.presidents.length - 1];
      if (p.firstName && p.lastName) return `${p.firstName} ${p.lastName}`;
    }
    return '';
  },
};
const MISSION_TYPE_TAG_MAP: Record<string, (d: any) => string> = {
  '<mission_type>': d => d.title || '',
  '<course_application>': d => d.courseApplication || '',
  '<mission_learning>': d => d.missionLearning || '',
  '<student_profile>': d => d.studentProfile || '',
};

// --- Component ---
const ManualDocumentGenerator: React.FC<ManualDocumentGeneratorProps> = ({
  onClose,
  preselectedMissionId,
  closeLabel = 'Retour aux documents',
}) => {
  const { currentUser } = useAuth();
  const [step, setStep] = useState<'select' | 'edit'>('select');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [tagValues, setTagValues] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [hiddenTags, setHiddenTags] = useState<Set<string>>(new Set());

  const [missions, setMissions] = useState<EntityOption[]>([]);
  const [companies, setCompanies] = useState<EntityOption[]>([]);
  const [contacts, setContacts] = useState<EntityOption[]>([]);
  const [users, setUsers] = useState<EntityOption[]>([]);
  const [selectedMission, setSelectedMission] = useState<EntityOption | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<EntityOption | null>(null);
  const [selectedContact, setSelectedContact] = useState<EntityOption | null>(null);
  const [selectedUser, setSelectedUser] = useState<EntityOption | null>(null);
  const [structureData, setStructureData] = useState<any>(null);
  const [missionTypes, setMissionTypes] = useState<EntityOption[]>([]);
  const [selectedMissionType, setSelectedMissionType] = useState<EntityOption | null>(null);

  const pdfOptions = useMemo(() => ({
    cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/'
  }), []);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const uData = userDoc.data();
      if (!uData?.structureId) return;

      const [templatesSnap, missionsSnap, companiesSnap, usersSnap, structureDoc, missionTypesSnap] = await Promise.all([
        getDocs(query(collection(db, 'templates'), where('structureId', '==', uData.structureId))),
        getDocs(query(collection(db, 'missions'), where('structureId', '==', uData.structureId))),
        getDocs(query(collection(db, 'companies'), where('structureId', '==', uData.structureId))),
        getDocs(query(collection(db, 'users'), where('structureId', '==', uData.structureId), where('status', 'in', ['etudiant', 'membre', 'admin', 'admin_structure']))),
        getDoc(doc(db, 'structures', uData.structureId)),
        getDocs(query(collection(db, 'missionTypes'), where('structureId', '==', uData.structureId))),
      ]);

      if (structureDoc.exists()) {
        const rawStructure = { id: structureDoc.id, ...structureDoc.data() };
        const decryptedStructure = await decryptStructureForDocument(uData.structureId, rawStructure);
        setStructureData(decryptedStructure);
      }

      setTemplates(templatesSnap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, file: data.file || (data.pdfUrl ? { url: data.pdfUrl, name: data.fileName || 'template.pdf', type: 'application/pdf' } : null) } as Template;
      }));
      const sortByLabel = (a: EntityOption, b: EntityOption) => a.label.localeCompare(b.label, 'fr');

      setMissions(missionsSnap.docs.map(d => {
        const data = d.data();
        return { id: d.id, label: `${data.numeroMission || ''} - ${data.title || 'Sans titre'}`.trim(), data: { id: d.id, ...data } };
      }).sort(sortByLabel));
      setCompanies(companiesSnap.docs.map(d => {
        const data = d.data();
        return { id: d.id, label: data.name || 'Sans nom', data: { id: d.id, ...data } };
      }).sort(sortByLabel));

      const rawUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const statusLabels: Record<string, string> = { etudiant: 'Étudiant', membre: 'Membre', admin: 'Admin', admin_structure: 'Admin' };
      const decryptedUsers = await Promise.all(rawUsers.map(async (u: any) => {
        const dec = await decryptUserForDocument(u.id, u);
        const name = `${dec.firstName || ''} ${dec.lastName || ''}`.trim() || dec.email || 'Inconnu';
        const role = statusLabels[dec.status] || dec.status || '';
        return { id: u.id, label: role ? `${name} (${role})` : name, data: dec };
      }));
      setUsers(decryptedUsers.sort(sortByLabel));

      setMissionTypes(missionTypesSnap.docs.map(d => {
        const data = d.data();
        return { id: d.id, label: data.title || 'Sans titre', data: { id: d.id, ...data } };
      }).sort(sortByLabel));
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContactsForCompany = async (companyId: string) => {
    try {
      const snap = await getDocs(query(collection(db, 'contacts'), where('companyId', '==', companyId)));
      const list = await Promise.all(snap.docs.map(async d => {
        const raw = { id: d.id, ...d.data() };
        const dec = (await decryptContactForDocument(d.id, raw)) ?? raw;
        return { id: d.id, label: `${dec.firstName || ''} ${dec.lastName || ''}`.trim() || dec.email, data: dec };
      }));
      setContacts(list.sort((a, b) => a.label.localeCompare(b.label, 'fr')));
      const def = snap.docs.find(d => d.data().isDefault);
      if (def) {
        const opt = list.find(c => c.id === def.id);
        if (opt) { setSelectedContact(opt); applyEntityTags(CONTACT_TAG_MAP, opt.data); }
      }
    } catch (error) {
      console.error('Erreur chargement contacts:', error);
    }
  };

  const fetchCdmData = async (chargeId: string) => {
    try {
      // Try to find CDM in already-loaded users list first
      const existingUser = users.find(u => u.id === chargeId);
      if (existingUser) {
        const dec = existingUser.data;
        setTagValues(prev => ({
          ...prev,
          '<mission_cdm>': `${dec.firstName || ''} ${dec.lastName || ''}`.trim() || prev['<mission_cdm>'] || '',
          '<mission_cdm_email>': dec.email || '',
          '<mission_cdm_telephone>': dec.phone || '',
        }));
        return;
      }
      const cdmDoc = await getDoc(doc(db, 'users', chargeId));
      if (cdmDoc.exists()) {
        const raw = { id: chargeId, ...cdmDoc.data() };
        const dec = await decryptUserForDocument(chargeId, raw);
        setTagValues(prev => ({
          ...prev,
          '<mission_cdm>': `${dec.firstName || ''} ${dec.lastName || ''}`.trim() || prev['<mission_cdm>'] || '',
          '<mission_cdm_email>': dec.email || '',
          '<mission_cdm_telephone>': dec.phone || '',
        }));
      }
    } catch (error) {
      console.warn('Erreur chargement CDM:', error);
    }
  };

  const applyEntityTags = useCallback((tagMap: Record<string, (d: any) => string>, data: any) => {
    setTagValues(prev => {
      const updated = { ...prev };
      for (const [tag, resolver] of Object.entries(tagMap)) {
        if (!(tag in updated)) continue;
        const v = resolver(data);
        if (v && typeof v === 'string' && !isEncrypted(v)) {
          updated[tag] = v;
        }
      }
      return updated;
    });
  }, []);

  const clearEntityTags = useCallback((tagMap: Record<string, (d: any) => string>) => {
    setTagValues(prev => {
      const updated = { ...prev };
      for (const tag of Object.keys(tagMap)) { if (tag in updated) updated[tag] = ''; }
      return updated;
    });
  }, []);

  const handleMissionSelect = async (_: any, value: EntityOption | null) => {
    setSelectedMission(value);
    if (!value) { clearEntityTags(MISSION_TAG_MAP); return; }

    // Load missionType data if mission has a missionTypeId
    const missionDataWithType = { ...value.data };
    if (value.data.missionTypeId) {
      try {
        const mtDoc = await getDoc(doc(db, 'missionTypes', value.data.missionTypeId));
        if (mtDoc.exists()) {
          missionDataWithType._missionTypeData = mtDoc.data();
          // Also fill <mission_type> with the missionType title if not already set
          if (!missionDataWithType.missionType && mtDoc.data().title) {
            missionDataWithType.missionType = mtDoc.data().title;
          }
        }
      } catch { /* ignore */ }
    }

    applyEntityTags(MISSION_TAG_MAP, missionDataWithType);

    if (value.data.missionTypeId) {
      const mt = missionTypes.find(m => m.id === value.data.missionTypeId);
      if (mt) {
        setSelectedMissionType(mt);
        applyEntityTags(MISSION_TYPE_TAG_MAP, mt.data);
      }
    }

    if (value.data.chargeId) fetchCdmData(value.data.chargeId);
    if (value.data.companyId) {
      const co = companies.find(c => c.id === value.data.companyId);
      if (co) { setSelectedCompany(co); applyEntityTags(COMPANY_TAG_MAP, co.data); }
      else {
        try {
          const cd = await getDoc(doc(db, 'companies', value.data.companyId));
          if (cd.exists()) { const o = { id: cd.id, label: cd.data().name || '', data: { id: cd.id, ...cd.data() } }; setSelectedCompany(o); applyEntityTags(COMPANY_TAG_MAP, o.data); }
        } catch { /* ignore */ }
      }
      fetchContactsForCompany(value.data.companyId);
    }
  };

  const handleMissionTypeSelect = (_: any, value: EntityOption | null) => {
    setSelectedMissionType(value);
    if (!value) { clearEntityTags(MISSION_TYPE_TAG_MAP); return; }
    applyEntityTags(MISSION_TYPE_TAG_MAP, value.data);
  };

  const handleCompanySelect = async (_: any, value: EntityOption | null) => {
    setSelectedCompany(value);
    if (!value) { clearEntityTags(COMPANY_TAG_MAP); setContacts([]); setSelectedContact(null); clearEntityTags(CONTACT_TAG_MAP); return; }
    const dec = await decryptCompanyForDocument(value.id, value.data);
    applyEntityTags(COMPANY_TAG_MAP, dec ?? value.data);
    fetchContactsForCompany(value.id);
  };

  const handleContactSelect = async (_: any, value: EntityOption | null) => {
    setSelectedContact(value);
    if (!value) { clearEntityTags(CONTACT_TAG_MAP); return; }

    const dec = await decryptContactForDocument(value.id, value.data);
    applyEntityTags(CONTACT_TAG_MAP, dec ?? value.data);
  };

  const handleUserSelect = async (_: any, value: EntityOption | null) => {
    setSelectedUser(value);
    if (!value) { clearEntityTags(USER_TAG_MAP); return; }

    const dec = await decryptUserForDocument(value.id, value.data);
    applyEntityTags(USER_TAG_MAP, dec ?? value.data);
  };

  const toggleTagVisibility = (tag: string) => {
    setHiddenTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  };

  // Build a map from variableId → tag for fast reverse lookup (used by getTextForVariable)
  const variableIdToTagMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of VARIABLE_TAGS) {
      if (!map.has(t.variableId)) map.set(t.variableId, t.tag);
    }
    return map;
  }, []);

  // --- Extract tags from template variables only ---
  const extractTagsFromTemplate = useCallback((template: Template): TagMapping[] => {
    if (!template.variables?.length) return [];
    const result: TagMapping[] = [];
    const seen = new Set<string>();

    for (const variable of template.variables) {
      if (variable.type === 'raw' && variable.rawText) {
        const matches = variable.rawText.match(/<[^>]+>/g);
        if (matches) for (const match of matches) {
          if (seen.has(match)) continue;
          seen.add(match);
          const known = VARIABLE_TAGS.find(t => t.tag === match);
          if (known) { result.push(known); }
          else {
            result.push({ tag: match, variableId: match.replace(/[<>]/g, ''), description: match.replace(/[<>]/g, '').replace(/_/g, ' '), example: '' });
          }
        }
      }

      // Also handle variableId-based variables (type text, number, date, list, etc.)
      if (variable.variableId && variable.type !== 'raw') {
        const allMatches = VARIABLE_TAGS.filter(t => t.variableId === variable.variableId);
        if (allMatches.length > 0) {
          for (const known of allMatches) {
            if (!seen.has(known.tag)) { seen.add(known.tag); result.push(known); }
          }
        } else {
          const tag = `<${variable.variableId}>`;
          if (!seen.has(tag)) {
            seen.add(tag);
            result.push({ tag, variableId: variable.variableId, description: variable.name || variable.description || variable.variableId, example: '' });
          }
        }
      }

      // Fallback: no variableId and not raw → create entry from variable name/id
      if (!variable.variableId && variable.type !== 'raw') {
        const fallbackId = variable.id || variable.name?.toLowerCase().replace(/[^a-z0-9]/g, '_') || '';
        if (fallbackId) {
          const tag = `<${fallbackId}>`;
          if (!seen.has(tag)) {
            seen.add(tag);
            result.push({ tag, variableId: fallbackId, description: variable.name || variable.description || fallbackId, example: '' });
          }
        }
      }
    }
    return result;
  }, []);

  const templateTags = useMemo(() => selectedTemplate ? extractTagsFromTemplate(selectedTemplate) : [], [selectedTemplate, extractTagsFromTemplate]);

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setStep('edit');
    const tags = extractTagsFromTemplate(template);
    const initialValues: Record<string, string> = {};
    tags.forEach(t => { initialValues[t.tag] = ''; });
    setTagValues(initialValues);
    setSelectedMission(null); setSelectedCompany(null); setSelectedContact(null); setSelectedUser(null);
    setContacts([]); setHiddenTags(new Set());

    // Auto-fill generation dates
    const autoFilled: Record<string, string> = {};
    if (tags.some(t => t.tag === '<mission_date_generation>')) {
      autoFilled['<mission_date_generation>'] = new Date().toLocaleDateString('fr-FR');
    }
    if (tags.some(t => t.tag === '<mission_date_generation_plus_1_an>')) {
      const d = new Date(); d.setDate(d.getDate() + 365);
      autoFilled['<mission_date_generation_plus_1_an>'] = d.toLocaleDateString('fr-FR');
    }

    // Auto-fill structure tags
    if (structureData) {
      for (const t of tags.filter(t => t.tag.startsWith('<structure_'))) {
        const resolver = STRUCTURE_TAG_MAP[t.tag];
        if (resolver) { const v = resolver(structureData); if (v) autoFilled[t.tag] = v; }
      }
    }

    if (Object.keys(autoFilled).length > 0) {
      setTimeout(() => setTagValues(prev => ({ ...prev, ...autoFilled })), 0);
    }

    // Pré-lier la mission courante (depuis MissionDetails)
    if (preselectedMissionId) {
      const mission = missions.find((m) => m.id === preselectedMissionId);
      if (mission) {
        setTimeout(() => {
          void handleMissionSelect(null, mission);
        }, 0);
      }
    }
  };

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => { setNumPages(n); }, []);
  const pdfUrl = useMemo(() => selectedTemplate?.file?.url || selectedTemplate?.pdfUrl || '', [selectedTemplate]);

  const getTextForVariable = useCallback((variable: TemplateVariable): string => {
    if (variable.type === 'raw' && variable.rawText) {
      let text = variable.rawText;
      const tagsInText = text.match(/<[^>]+>/g) || [];

      // Rule: if the raw text contains tags but NONE are filled, hide the entire block
      if (tagsInText.length > 0) {
        const hasFilledTag = tagsInText.some(t => {
          const val = tagValues[t];
          return val && val.trim() !== '' && !hiddenTags.has(t);
        });
        if (!hasFilledTag) return '';
      }

      for (const [tag, value] of Object.entries(tagValues)) {
        if (value && !hiddenTags.has(tag)) text = text.replace(new RegExp(escapeRegExp(tag), 'g'), value);
      }
      const remaining = text.match(/<[^>]+>/g);
      if (remaining) remaining.forEach(tag => { text = text.replace(new RegExp(escapeRegExp(tag), 'g'), ''); });
      return text;
    }

    // Non-raw variable: resolve tag from variableId
    if (variable.variableId) {
      const mappedTag = variableIdToTagMap.get(variable.variableId);
      if (mappedTag) {
        if (hiddenTags.has(mappedTag)) return '';
        return tagValues[mappedTag] || '';
      }
      const syntheticTag = `<${variable.variableId}>`;
      if (hiddenTags.has(syntheticTag)) return '';
      return tagValues[syntheticTag] || '';
    }

    // Fallback for variables with no variableId
    const fallbackId = variable.id || variable.name?.toLowerCase().replace(/[^a-z0-9]/g, '_') || '';
    if (fallbackId) {
      const tag = `<${fallbackId}>`;
      if (hiddenTags.has(tag)) return '';
      return tagValues[tag] || '';
    }
    return '';
  }, [tagValues, hiddenTags, variableIdToTagMap]);

  // --- PDF generation ---
  const generateFilledPdf = async (): Promise<Uint8Array | null> => {
    if (!selectedTemplate || !pdfUrl) return null;
    try {
      const response = await fetch(pdfUrl);
      const pdfDoc = await PDFDocument.load(await response.arrayBuffer());
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pages = pdfDoc.getPages();
      for (const variable of selectedTemplate.variables) {
        const text = getTextForVariable(variable);
        if (!text.trim()) continue;
        const pageIndex = (variable.position?.page || 1) - 1;
        if (pageIndex < 0 || pageIndex >= pages.length) continue;
        const page = pages[pageIndex];
        const font = variable.isBold ? helveticaBold : helveticaFont;
        const fontSize = variable.fontSize || 12;
        const lhMult = variable.lineHeight || 1.2;
        const lh = fontSize * lhMult;
        const x = variable.position.x, y = variable.position.y;
        const bw = variable.width, bh = variable.height;
        const lines = splitTextToLines(text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' '), font, fontSize, bw);
        const tth = lines.length * lh;
        const vo = 4;
        let sY: number;
        if (variable.verticalAlign === 'top') sY = PDF_BASE_HEIGHT - y - fontSize * 0.8 - vo;
        else if (variable.verticalAlign === 'bottom') sY = PDF_BASE_HEIGHT - y - bh + fontSize * 0.8 + (tth - lh) - vo;
        else { const vc = PDF_BASE_HEIGHT - y - bh / 2; sY = vc + tth / 2 - lh + fontSize * 0.8 - vo; }
        const minY = PDF_BASE_HEIGHT - y - bh + fontSize * 0.5;
        const maxY = PDF_BASE_HEIGHT - y - fontSize * 0.2;
        if (sY > maxY) sY = maxY;
        if (sY - (tth - lh) < minY) sY = minY + (tth - lh);
        let lineY = sY;
        for (const line of lines) {
          const cl = line.replace(/[^\x20-\x7E\u00C0-\u024F\u2019\u2018\u201C\u201D\u2013\u2014]/g, ' ');
          if (cl.trim() && lineY >= minY && lineY <= maxY) {
            const lw = font.widthOfTextAtSize(cl, fontSize);
            let xL = x;
            if (variable.textAlign === 'center') xL = x + (bw - lw) / 2;
            else if (variable.textAlign === 'right') xL = x + bw - lw;
            xL = Math.max(x, Math.min(xL, x + bw - 1));
            try { page.drawText(cl, { x: xL, y: lineY, size: fontSize, font, maxWidth: bw }); }
            catch { try { page.drawText(cl.replace(/[^\x20-\x7E]/g, ' '), { x: xL, y: lineY, size: fontSize, font, maxWidth: bw }); } catch { /* skip */ } }
          }
          lineY -= lh;
          if (lineY < minY) break;
        }
      }
      return await pdfDoc.save();
    } catch (error) { console.error('Erreur génération PDF:', error); return null; }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const bytes = await generateFilledPdf();
      if (!bytes) return;
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${selectedTemplate?.name || 'document'}_generé.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) { console.error('Erreur téléchargement:', error); }
    finally { setDownloading(false); }
  };

  const filledCount = Object.entries(tagValues).filter(([k, v]) => v.trim() !== '' && !hiddenTags.has(k)).length;
  const visibleTagCount = templateTags.filter(t => !hiddenTags.has(t.tag)).length;

  const groupedTags = useMemo(() => {
    const groups: Record<string, TagMapping[]> = {};
    for (const tag of templateTags) {
      let cat = 'Autres';
      const missionTypeTags = ['<mission_type>', '<course_application>', '<mission_learning>', '<student_profile>'];
      if (missionTypeTags.includes(tag.tag)) cat = 'Type de mission';
      else if (tag.tag.startsWith('<mission_') || tag.tag.startsWith('<depense') || tag.tag === '<total_ttc>' || tag.tag === '<tva>') cat = 'Mission';
      else if (tag.tag.startsWith('<user_')) cat = 'Utilisateur';
      else if (tag.tag.startsWith('<entreprise_')) cat = 'Entreprise';
      else if (tag.tag.startsWith('<structure_')) cat = 'Structure';
      else if (tag.tag.startsWith('<contact_')) cat = 'Contact';
      else if (tag.tag.startsWith('<note_frais_')) cat = 'Notes de frais';
      else if (tag.tag.startsWith('<workingHours') || tag.tag === '<heures_detaillees>') cat = 'Heures';
      else if (tag.tag.startsWith('<amendment_')) cat = 'Avenants';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(tag);
    }
    return groups;
  }, [templateTags]);

  const renderEntitySelector = (category: string) => {
    const sx = { mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#f0f7ff' } };
    if (category === 'Mission' && missions.length > 0) return (
      <Autocomplete size="small" options={missions} value={selectedMission} onChange={handleMissionSelect} getOptionLabel={o => o.label} isOptionEqualToValue={(o, v) => o.id === v.id}
        renderInput={p => <TextField {...p} label="Lier à une mission" placeholder="Rechercher..." sx={sx} />} noOptionsText="Aucune mission" sx={{ mb: 2 }} />
    );
    if (category === 'Entreprise' && companies.length > 0) return (
      <Autocomplete size="small" options={companies} value={selectedCompany} onChange={handleCompanySelect} getOptionLabel={o => o.label} isOptionEqualToValue={(o, v) => o.id === v.id}
        renderInput={p => <TextField {...p} label="Lier à une entreprise" placeholder="Rechercher..." sx={sx} />} noOptionsText="Aucune entreprise" sx={{ mb: 2 }} />
    );
    if (category === 'Contact') {
      if (contacts.length > 0) return (
        <Autocomplete size="small" options={contacts} value={selectedContact} onChange={handleContactSelect} getOptionLabel={o => o.label} isOptionEqualToValue={(o, v) => o.id === v.id}
          renderInput={p => <TextField {...p} label="Lier à un contact" placeholder="Rechercher..." sx={sx} />} noOptionsText="Aucun contact" sx={{ mb: 2 }} />
      );
      if (!selectedCompany) return <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 2, fontStyle: 'italic' }}>Sélectionnez une entreprise pour voir ses contacts</Typography>;
    }
    if (category === 'Utilisateur' && users.length > 0) return (
      <Autocomplete size="small" options={users} value={selectedUser} onChange={handleUserSelect} getOptionLabel={o => o.label} isOptionEqualToValue={(o, v) => o.id === v.id}
        renderInput={p => <TextField {...p} label="Lier à un utilisateur" placeholder="Rechercher..." sx={sx} />} noOptionsText="Aucun utilisateur" sx={{ mb: 2 }} />
    );
    if (category === 'Type de mission' && missionTypes.length > 0) return (
      <Autocomplete size="small" options={missionTypes} value={selectedMissionType} onChange={handleMissionTypeSelect} getOptionLabel={o => o.label} isOptionEqualToValue={(o, v) => o.id === v.id}
        renderInput={p => <TextField {...p} label="Lier à un type de mission" placeholder="Rechercher..." sx={sx} />} noOptionsText="Aucun type de mission" sx={{ mb: 2 }} />
    );
    return null;
  };

  // --- TEMPLATE SELECTION ---
  if (step === 'select') {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>Générer un document</Typography>
            <Typography variant="body2" color="text.secondary">Choisissez une template pour commencer</Typography>
          </Box>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={onClose} sx={{ borderRadius: 2, textTransform: 'none' }}>{closeLabel}</Button>
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : templates.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <DescriptionIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">Aucune template disponible.</Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {templates.map(template => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={template.id}>
                <Card variant="outlined" sx={{ borderRadius: 3, transition: 'all 0.2s ease', '&:hover': { borderColor: 'primary.main', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transform: 'translateY(-2px)' } }}>
                  <CardActionArea onClick={() => handleSelectTemplate(template)} sx={{ p: 2 }}>
                    <CardContent sx={{ p: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                        <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <DescriptionIcon sx={{ color: '#fff', fontSize: 24 }} />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle1" fontWeight={600} noWrap>{template.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{template.variables?.filter(v => v.type !== 'raw' || v.rawText?.match(/<[^>]+>/g)).length || 0} balise(s)</Typography>
                        </Box>
                      </Box>
                      {template.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{template.description}</Typography>
                      )}
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    );
  }

  // --- EDITOR ---
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#fff', flexShrink: 0, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton onClick={() => { setStep('select'); setSelectedTemplate(null); setTagValues({}); setNumPages(0); }}><ArrowBackIcon /></IconButton>
          <Typography variant="h6" fontWeight={600}>{selectedTemplate?.name || 'Édition'}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {hiddenTags.size > 0 && (
            <Chip label={`${hiddenTags.size} masquée(s)`} size="small" variant="outlined" color="warning"
              onDelete={() => setHiddenTags(new Set())} deleteIcon={<Tooltip title="Tout afficher"><VisibilityIcon sx={{ fontSize: '16px !important' }} /></Tooltip>} />
          )}
          <Button variant="contained" startIcon={downloading ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />} onClick={handleDownload} disabled={downloading || filledCount === 0} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3 }}>
            Télécharger le PDF
          </Button>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* PDF Preview */}
        <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#e8e8e8', display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, px: 2 }}>
          {pdfUrl && (
            <Document file={pdfUrl} onLoadSuccess={onDocumentLoadSuccess} loading={<Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>} options={pdfOptions}>
              {Array.from({ length: numPages }, (_, index) => (
                <Box key={`page_${index + 1}`} sx={{ mb: 2, position: 'relative', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', borderRadius: 1, overflow: 'hidden' }}>
                  <Page pageNumber={index + 1} width={RENDER_WIDTH} renderTextLayer={false} renderAnnotationLayer={false} />
                  {selectedTemplate?.variables?.filter(v => (v.position?.page || 1) === index + 1).map(variable => {
                    const text = getTextForVariable(variable);
                    if (!text.trim()) return null;
                    return (
                      <Box key={variable.id} sx={{
                        position: 'absolute',
                        left: `${variable.position.x * SCALE}px`, top: `${variable.position.y * SCALE}px`,
                        width: `${variable.width * SCALE}px`, height: `${variable.height * SCALE}px`,
                        fontSize: `${variable.fontSize * SCALE}px`, fontFamily: variable.fontFamily || 'Arial, sans-serif',
                        fontWeight: variable.isBold ? 700 : 400, textAlign: variable.textAlign || 'left',
                        lineHeight: variable.lineHeight || 1.2, display: 'flex',
                        alignItems: variable.verticalAlign === 'top' ? 'flex-start' : variable.verticalAlign === 'bottom' ? 'flex-end' : 'center',
                        color: '#000', pointerEvents: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'hidden',
                      }}>{text}</Box>
                    );
                  })}
                </Box>
              ))}
            </Document>
          )}
        </Box>

        {/* Sidebar */}
        <Box sx={{ width: 400, flexShrink: 0, borderLeft: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', bgcolor: '#fff' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={600}>Balises du document</Typography>
              <Chip label={`${filledCount}/${visibleTagCount}`} size="small" color={filledCount === visibleTagCount && visibleTagCount > 0 ? 'success' : 'default'} />
            </Box>
            <TextField
              size="small" fullWidth placeholder="Rechercher une balise..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 20, color: 'text.disabled' }} /></InputAdornment> }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#f8f9fa' } }}
            />
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {templateTags.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}><Typography variant="body2" color="text.secondary">Aucune balise modifiable.</Typography></Box>
            ) : (
              Object.entries(groupedTags).map(([category, tags]) => {
                const filtered = tags.filter(t =>
                  !searchQuery || t.tag.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase())
                );
                if (filtered.length === 0) return null;

                const linkedEntity = category === 'Mission' ? selectedMission : category === 'Entreprise' ? selectedCompany : category === 'Contact' ? selectedContact : category === 'Utilisateur' ? selectedUser : category === 'Type de mission' ? selectedMissionType : null;
                const isStructure = category === 'Structure';

                return (
                  <Box key={category} sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {category}
                      </Typography>
                      {linkedEntity && (
                        <Chip icon={<LinkIcon sx={{ fontSize: '14px !important' }} />} label={linkedEntity.label} size="small" variant="outlined" color="primary"
                          sx={{ maxWidth: 200, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                          onDelete={() => {
                            if (category === 'Mission') handleMissionSelect(null, null);
                            else if (category === 'Entreprise') handleCompanySelect(null, null);
                            else if (category === 'Contact') handleContactSelect(null, null);
                            else if (category === 'Utilisateur') handleUserSelect(null, null);
                            else if (category === 'Type de mission') handleMissionTypeSelect(null, null);
                          }}
                          deleteIcon={<Tooltip title="Délier"><LinkOffIcon sx={{ fontSize: '16px !important' }} /></Tooltip>}
                        />
                      )}
                      {isStructure && structureData && (
                        <Chip icon={<LinkIcon sx={{ fontSize: '14px !important' }} />} label={structureData.name || structureData.nom || 'Structure'} size="small" variant="outlined" color="success"
                          sx={{ maxWidth: 200, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }} />
                      )}
                    </Box>

                    {!isStructure && renderEntitySelector(category)}

                    {filtered.map(tag => {
                      const isHidden = hiddenTags.has(tag.tag);
                      return (
                        <Box key={tag.tag} sx={{ mb: 2, opacity: isHidden ? 0.45 : 1, transition: 'opacity 0.2s' }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                            <TextField
                              size="small" fullWidth
                              label={tag.description}
                              placeholder={tag.example || tag.tag}
                              value={tagValues[tag.tag] || ''}
                              onChange={(e) => setTagValues(prev => ({ ...prev, [tag.tag]: e.target.value }))}
                              disabled={isHidden}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.12)' } } }}
                              helperText={<span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#999' }}>{tag.tag}</span>}
                            />
                            <Tooltip title={isHidden ? 'Afficher cette balise' : 'Masquer cette balise'}>
                              <IconButton size="small" onClick={() => toggleTagVisibility(tag.tag)} sx={{ mt: 0.5, flexShrink: 0 }}>
                                {isHidden ? <VisibilityOffIcon sx={{ fontSize: 18, color: 'text.disabled' }} /> : <VisibilityIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

function splitTextToLines(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  if (!text) return [];
  const paragraphs = text.split('\n');
  const allLines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) { allLines.push(''); continue; }
    const words = paragraph.split(' ');
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      try {
        if (font.widthOfTextAtSize(testLine, fontSize) > maxWidth && currentLine) { allLines.push(currentLine); currentLine = word; }
        else currentLine = testLine;
      } catch { currentLine = testLine; }
    }
    if (currentLine) allLines.push(currentLine);
  }
  return allLines;
}

export default ManualDocumentGenerator;
