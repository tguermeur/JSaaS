import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  Description as DescriptionIcon,
  Download as DownloadIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { tokens } from '../../../theme/tokens';
import {
  decryptCompanyForDocument,
  decryptContactForDocument,
  decryptStructureForDocument,
  decryptUserForDocument,
} from '../../../utils/documentDecryptUtils';

interface TemplateVariable {
  id: string;
  name: string;
  description: string;
  type: 'text' | 'number' | 'date' | 'list' | 'raw';
  variableId?: string;
  rawText?: string;
  fieldId?: string;
  position: { x: number; y: number; page: number };
  fontSize: number;
  fontFamily?: string;
  lineHeight?: number;
  width: number;
  height: number;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  verticalAlign: 'top' | 'middle' | 'bottom';
  isBold?: boolean;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  file: { url: string; name: string; type: string } | null;
  pdfUrl: string;
  fileName: string;
  variables: TemplateVariable[];
  isUniversal?: boolean;
}

interface EntityOption {
  id: string;
  label: string;
  data: any;
}

interface GenerateFromTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  structureId: string;
  missionId: string;
}

const PDF_BASE_WIDTH = 595;
const RENDER_WIDTH = 420;
const SCALE = RENDER_WIDTH / PDF_BASE_WIDTH;
const isEncrypted = (v: any): boolean => typeof v === 'string' && v.startsWith('ENC:');

const MISSION_TAG_MAP: Record<string, (d: any) => string> = {
  '<mission_numero>': (d) => d.numeroMission || '',
  '<mission_cdm>': (d) => d.chargeName || '',
  '<mission_cdm_email>': (d) => d.chargeEmail || d.charge_email || '',
  '<mission_cdm_telephone>': (d) => d.chargePhone || d.charge_phone || '',
  '<mission_date_debut>': (d) => (d.startDate ? new Date(d.startDate).toLocaleDateString('fr-FR') : ''),
  '<mission_date_fin>': (d) => (d.endDate ? new Date(d.endDate).toLocaleDateString('fr-FR') : ''),
  '<mission_lieu>': (d) => d.location || '',
  '<mission_entreprise>': (d) => d.company || '',
  '<mission_type>': (d) => d.missionType || '',
  '<mission_date_generation>': () => new Date().toLocaleDateString('fr-FR'),
  '<mission_prix>': (d) => d.priceHT?.toString() || '',
  '<mission_prix_horaire_ht>': (d) => d.priceHT?.toFixed?.(2) || d.priceHT?.toString() || '',
  '<mission_prix_total_heures_ht>': (d) => (d.priceHT && d.hours ? (d.priceHT * d.hours).toFixed(2) : ''),
  '<mission_description>': (d) => d.description || '',
  '<mission_titre>': (d) => d.title || '',
  '<mission_heures>': (d) => d.hours?.toString() || '',
  '<mission_nb_etudiants>': (d) => d.studentCount?.toString() || '',
  '<total_ttc>': (d) => d.totalTTC?.toFixed?.(2) || d.totalTTC?.toString() || '',
  '<tva>': (d) => (d.priceHT && d.hours ? (d.priceHT * d.hours * 0.2).toFixed(2) : ''),
  '<course_application>': (d) => d._missionTypeData?.courseApplication || d.courseApplication || '',
  '<mission_learning>': (d) => d._missionTypeData?.missionLearning || d.missionLearning || '',
  '<student_profile>': (d) => d._missionTypeData?.studentProfile || d.studentProfile || '',
};

const COMPANY_TAG_MAP: Record<string, (d: any) => string> = {
  '<entreprise_nom>': (d) => d.name || '',
  '<entreprise_siren>': (d) => d.siren || '',
  '<entreprise_nsiret>': (d) => d.nSiret || '',
  '<entreprise_adresse>': (d) => d.address || '',
  '<entreprise_ville>': (d) => d.city || '',
  '<entreprise_pays>': (d) => d.country || '',
  '<entreprise_telephone>': (d) => d.phone || '',
  '<entreprise_email>': (d) => d.email || '',
  '<entreprise_site_web>': (d) => d.website || '',
  '<entreprise_description>': (d) => d.description || '',
};

const CONTACT_TAG_MAP: Record<string, (d: any) => string> = {
  '<contact_fullName>': (d) => `${d.firstName || ''} ${d.lastName || ''}`.trim(),
  '<contact_nom_complet>': (d) => `${d.firstName || ''} ${d.lastName || ''}`.trim(),
  '<contact_firstName>': (d) => d.firstName || '',
  '<contact_lastName>': (d) => d.lastName || '',
  '<contact_email>': (d) => d.email || '',
  '<contact_phone>': (d) => d.phone || '',
  '<contact_position>': (d) => d.position || '',
};

const USER_TAG_MAP: Record<string, (d: any) => string> = {
  '<user_nom>': (d) => d.lastName || '',
  '<user_prenom>': (d) => d.firstName || '',
  '<user_email>': (d) => d.email || '',
  '<user_telephone>': (d) => d.phone || '',
  '<user_adresse>': (d) => d.address || '',
  '<user_code_postal>': (d) => d.postalCode || '',
  '<user_ville>': (d) => d.city || '',
  '<user_formation>': (d) => d.formation || '',
  '<user_programme>': (d) => d.program || '',
  '<user_annee_diplome>': (d) => d.graduationYear?.toString() || '',
  '<user_numero_etudiant>': (d) => d.studentId || '',
};

const STRUCTURE_TAG_MAP: Record<string, (d: any) => string> = {
  '<structure_nom>': (d) => d.name || d.nom || '',
  '<structure_siret>': (d) => d.nSiret || d.siret || '',
  '<structure_adresse>': (d) => d.address || '',
  '<structure_ville>': (d) => d.city || '',
  '<structure_code_postal>': (d) => d.postalCode || '',
  '<structure_pays>': (d) => d.country || '',
  '<structure_telephone>': (d) => d.phone || '',
  '<structure_email>': (d) => d.email || '',
  '<structure_site_web>': (d) => d.website || '',
};

function normalizeTemplate(id: string, data: Record<string, any>): Template {
  return {
    id,
    name: data.name || 'Sans nom',
    description: data.description || '',
    pdfUrl: data.pdfUrl || data.file?.url || '',
    fileName: data.fileName || data.file?.name || 'template.pdf',
    variables: data.variables || [],
    isUniversal: !!data.isUniversal,
    file:
      data.file ||
      (data.pdfUrl
        ? { url: data.pdfUrl, name: data.fileName || 'template.pdf', type: 'application/pdf' }
        : null),
  };
}

export const GenerateFromTemplateDialog: React.FC<GenerateFromTemplateDialogProps> = ({
  open,
  onClose,
  structureId,
  missionId,
}) => {
  const [step, setStep] = useState<'select' | 'edit'>('select');
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [tagValues, setTagValues] = useState<Record<string, string>>({});
  const [hiddenTags, setHiddenTags] = useState<Set<string>>(new Set());
  const [numPages, setNumPages] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [users, setUsers] = useState<EntityOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<EntityOption | null>(null);
  const [structureData, setStructureData] = useState<any>(null);
  const [missionData, setMissionData] = useState<any>(null);

  const pdfOptions = useMemo(
    () => ({
      cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/',
    }),
    []
  );

  const reset = useCallback(() => {
    setStep('select');
    setSelectedTemplate(null);
    setTagValues({});
    setHiddenTags(new Set());
    setNumPages(0);
    setSearch('');
    setSelectedUser(null);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  useEffect(() => {
    if (!open || !structureId) return;

    const load = async () => {
      setLoading(true);
      try {
        const [structureSnap, universalSnap, missionDoc, structureDoc, usersSnap] = await Promise.all([
          getDocs(query(collection(db, 'templates'), where('structureId', '==', structureId))),
          getDocs(query(collection(db, 'templates'), where('isUniversal', '==', true))),
          getDoc(doc(db, 'missions', missionId)),
          getDoc(doc(db, 'structures', structureId)),
          getDocs(
            query(
              collection(db, 'users'),
              where('structureId', '==', structureId),
              where('status', 'in', ['etudiant', 'membre', 'admin', 'admin_structure'])
            )
          ),
        ]);

        const byId = new Map<string, Template>();
        structureSnap.docs.forEach((d) => byId.set(d.id, normalizeTemplate(d.id, d.data())));
        universalSnap.docs.forEach((d) => {
          if (!byId.has(d.id)) byId.set(d.id, normalizeTemplate(d.id, d.data()));
        });
        setTemplates(
          Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
        );

        if (structureDoc.exists()) {
          const raw = { id: structureDoc.id, ...structureDoc.data() };
          setStructureData(await decryptStructureForDocument(structureId, raw));
        }

        if (missionDoc.exists()) {
          const data: any = { id: missionDoc.id, ...missionDoc.data() };
          if (data.missionTypeId) {
            try {
              const mt = await getDoc(doc(db, 'missionTypes', data.missionTypeId));
              if (mt.exists()) {
                data._missionTypeData = mt.data();
                if (!data.missionType && mt.data().title) data.missionType = mt.data().title;
              }
            } catch {
              /* ignore */
            }
          }
          setMissionData(data);
        }

        const rawUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const decryptedUsers = await Promise.all(
          rawUsers.map(async (u: any) => {
            const dec = await decryptUserForDocument(u.id, u);
            const name = `${dec.firstName || ''} ${dec.lastName || ''}`.trim() || dec.email || 'Inconnu';
            return { id: u.id, label: name, data: dec };
          })
        );
        setUsers(decryptedUsers.sort((a, b) => a.label.localeCompare(b.label, 'fr')));
      } catch (error) {
        console.error('Erreur chargement templates:', error);
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [open, structureId, missionId]);

  const extractTags = useCallback((template: Template) => {
    const seen = new Set<string>();
    const result: Array<{ tag: string; label: string }> = [];
    for (const variable of template.variables || []) {
      const sources = [variable.rawText, variable.name, variable.description, variable.variableId]
        .filter(Boolean)
        .join(' ');
      const matches = sources.match(/<[^>]+>/g) || [];
      for (const tag of matches) {
        if (!seen.has(tag)) {
          seen.add(tag);
          result.push({ tag, label: variable.name || tag });
        }
      }
      if (variable.variableId && !variable.variableId.includes('<')) {
        const tag = `<${variable.variableId}>`;
        if (!seen.has(tag)) {
          seen.add(tag);
          result.push({ tag, label: variable.name || variable.variableId });
        }
      }
    }
    return result;
  }, []);

  const applyMap = (tagMap: Record<string, (d: any) => string>, data: any) => {
    setTagValues((prev) => {
      const updated = { ...prev };
      for (const [tag, resolver] of Object.entries(tagMap)) {
        if (!(tag in updated)) continue;
        const v = resolver(data);
        if (v && typeof v === 'string' && !isEncrypted(v)) updated[tag] = v;
      }
      return updated;
    });
  };

  const fillFromMission = async (tags: Array<{ tag: string }>, mission: any) => {
    applyMap(MISSION_TAG_MAP, mission);

    if (mission.chargeId) {
      try {
        const existing = users.find((u) => u.id === mission.chargeId);
        const dec =
          existing?.data ||
          (await decryptUserForDocument(
            mission.chargeId,
            (await getDoc(doc(db, 'users', mission.chargeId))).data() || {}
          ));
        setTagValues((prev) => ({
          ...prev,
          ...(prev['<mission_cdm>'] !== undefined
            ? {
                '<mission_cdm>':
                  `${dec.firstName || ''} ${dec.lastName || ''}`.trim() || prev['<mission_cdm>'],
              }
            : {}),
          ...(prev['<mission_cdm_email>'] !== undefined
            ? { '<mission_cdm_email>': dec.email || '' }
            : {}),
          ...(prev['<mission_cdm_telephone>'] !== undefined
            ? { '<mission_cdm_telephone>': dec.phone || '' }
            : {}),
        }));
      } catch {
        /* ignore */
      }
    }

    if (mission.companyId) {
      try {
        const cd = await getDoc(doc(db, 'companies', mission.companyId));
        if (cd.exists()) {
          const raw = { id: cd.id, ...cd.data() };
          const dec = (await decryptCompanyForDocument(cd.id, raw)) ?? raw;
          applyMap(COMPANY_TAG_MAP, dec);

          const contactsSnap = await getDocs(
            query(collection(db, 'contacts'), where('companyId', '==', mission.companyId))
          );
          const def = contactsSnap.docs.find((d) => d.data().isDefault) || contactsSnap.docs[0];
          if (def) {
            const contactRaw = { id: def.id, ...def.data() };
            const contactDec =
              (await decryptContactForDocument(def.id, contactRaw)) ?? contactRaw;
            applyMap(CONTACT_TAG_MAP, contactDec);
          }
        }
      } catch {
        /* ignore */
      }
    }

    if (structureData) {
      for (const t of tags.filter((t) => t.tag.startsWith('<structure_'))) {
        const resolver = STRUCTURE_TAG_MAP[t.tag];
        if (resolver) {
          const v = resolver(structureData);
          if (v) setTagValues((prev) => ({ ...prev, [t.tag]: v }));
        }
      }
    }
  };

  const handleSelectTemplate = async (template: Template) => {
    setSelectedTemplate(template);
    setStep('edit');
    const tags = extractTags(template);
    const initial: Record<string, string> = {};
    tags.forEach((t) => {
      initial[t.tag] = '';
    });
    if (tags.some((t) => t.tag === '<mission_date_generation>')) {
      initial['<mission_date_generation>'] = new Date().toLocaleDateString('fr-FR');
    }
    setTagValues(initial);
    setHiddenTags(new Set());
    setNumPages(0);
    setSelectedUser(null);

    if (missionData) {
      setTimeout(() => {
        void fillFromMission(tags, missionData);
      }, 0);
    }
  };

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
    );
  }, [templates, search]);

  const templateTags = useMemo(
    () => (selectedTemplate ? extractTags(selectedTemplate) : []),
    [selectedTemplate, extractTags]
  );

  const filledCount = templateTags.filter((t) => (tagValues[t.tag] || '').trim()).length;
  const pdfUrl = selectedTemplate?.file?.url || selectedTemplate?.pdfUrl || '';

  const getTextForVariable = useCallback(
    (variable: TemplateVariable): string => {
      if (variable.type === 'raw' && variable.rawText) {
        return variable.rawText.replace(/<[^>]+>/g, (tag) => {
          if (hiddenTags.has(tag)) return '';
          return tagValues[tag] || '';
        });
      }
      const tag =
        variable.variableId?.includes('<')
          ? variable.variableId
          : variable.variableId
            ? `<${variable.variableId}>`
            : null;
      if (tag && hiddenTags.has(tag)) return '';
      if (tag && tagValues[tag] !== undefined) return tagValues[tag];
      return '';
    },
    [tagValues, hiddenTags]
  );

  const handleDownload = async () => {
    if (!selectedTemplate || !pdfUrl) return;
    try {
      setDownloading(true);
      const res = await fetch(pdfUrl);
      const bytes = await res.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pages = pdfDoc.getPages();

      for (const variable of selectedTemplate.variables || []) {
        const text = getTextForVariable(variable);
        if (!text.trim()) continue;
        const pageIndex = Math.max(0, (variable.position?.page || 1) - 1);
        const page = pages[pageIndex];
        if (!page) continue;
        const { height: pageHeight } = page.getSize();
        const fontSize = variable.fontSize || 10;
        const usedFont = variable.isBold ? boldFont : font;
        const x = variable.position.x;
        const y = pageHeight - variable.position.y - fontSize;
        const lines = text.split('\n');
        const lineHeight = (variable.lineHeight || 1.2) * fontSize;
        lines.forEach((line, i) => {
          page.drawText(line, {
            x,
            y: y - i * lineHeight,
            size: fontSize,
            font: usedFont,
            maxWidth: variable.width || undefined,
          });
        });
      }

      const out = await pdfDoc.save();
      const blob = new Blob([out as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTemplate.name || 'document'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur génération PDF:', error);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={step === 'edit' ? 'lg' : 'sm'}
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          maxHeight: '90vh',
          height: step === 'edit' ? '85vh' : 'auto',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          pb: 1.5,
          borderBottom: `1px solid ${tokens.colors.gray100}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          {step === 'edit' && (
            <IconButton
              size="small"
              onClick={() => {
                setStep('select');
                setSelectedTemplate(null);
                setTagValues({});
                setNumPages(0);
              }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 17, fontWeight: 700, color: tokens.colors.gray900 }} noWrap>
              {step === 'select'
                ? 'Générer depuis une template'
                : selectedTemplate?.name || 'Édition'}
            </Typography>
            {step === 'select' && (
              <Typography sx={{ fontSize: 13, color: tokens.colors.gray500, fontWeight: 400 }}>
                Templates de votre structure ({templates.length})
              </Typography>
            )}
          </Box>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {step === 'select' ? (
          <Box sx={{ p: 2, overflow: 'auto', flex: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Rechercher une template…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: tokens.colors.gray400 }} />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 1.5 }}
            />
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress size={32} />
              </Box>
            ) : filteredTemplates.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <DescriptionIcon sx={{ fontSize: 48, color: tokens.colors.gray300, mb: 1 }} />
                <Typography sx={{ fontSize: 14, color: tokens.colors.gray500 }}>
                  {templates.length === 0
                    ? 'Aucune template disponible pour cette structure.'
                    : 'Aucun résultat pour cette recherche.'}
                </Typography>
              </Box>
            ) : (
              <List dense disablePadding>
                {filteredTemplates.map((template) => (
                  <ListItemButton
                    key={template.id}
                    onClick={() => void handleSelectTemplate(template)}
                    sx={{
                      borderRadius: '10px',
                      mb: 0.5,
                      border: `1px solid ${tokens.colors.gray100}`,
                      '&:hover': { borderColor: tokens.colors.brandTeal, bgcolor: '#f0fdfa' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '8px',
                          bgcolor: '#6366f11f',
                          color: '#6366f1',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <DescriptionIcon sx={{ fontSize: 18 }} />
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 600 }} noWrap>
                            {template.name}
                          </Typography>
                          {template.isUniversal && (
                            <Chip label="Universel" size="small" sx={{ height: 18, fontSize: 10 }} />
                          )}
                        </Box>
                      }
                      secondary={
                        template.description ||
                        `${template.variables?.length || 0} variable(s)`
                      }
                      secondaryTypographyProps={{
                        sx: {
                          fontSize: 12,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        },
                      }}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <Box
              sx={{
                flex: 1,
                overflow: 'auto',
                bgcolor: '#e8e8e8',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                py: 2,
                px: 1.5,
              }}
            >
              {pdfUrl && (
                <Document
                  file={pdfUrl}
                  onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                  loading={
                    <Box sx={{ py: 6 }}>
                      <CircularProgress size={28} />
                    </Box>
                  }
                  options={pdfOptions}
                >
                  {Array.from({ length: numPages }, (_, index) => (
                    <Box
                      key={`page_${index + 1}`}
                      sx={{
                        mb: 1.5,
                        position: 'relative',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                        borderRadius: 1,
                        overflow: 'hidden',
                      }}
                    >
                      <Page
                        pageNumber={index + 1}
                        width={RENDER_WIDTH}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                      {selectedTemplate?.variables
                        ?.filter((v) => (v.position?.page || 1) === index + 1)
                        .map((variable) => {
                          const text = getTextForVariable(variable);
                          if (!text.trim()) return null;
                          return (
                            <Box
                              key={variable.id}
                              sx={{
                                position: 'absolute',
                                left: `${variable.position.x * SCALE}px`,
                                top: `${variable.position.y * SCALE}px`,
                                width: `${variable.width * SCALE}px`,
                                height: `${variable.height * SCALE}px`,
                                fontSize: `${variable.fontSize * SCALE}px`,
                                fontFamily: variable.fontFamily || 'Arial, sans-serif',
                                fontWeight: variable.isBold ? 700 : 400,
                                textAlign: variable.textAlign || 'left',
                                lineHeight: variable.lineHeight || 1.2,
                                display: 'flex',
                                alignItems:
                                  variable.verticalAlign === 'top'
                                    ? 'flex-start'
                                    : variable.verticalAlign === 'bottom'
                                      ? 'flex-end'
                                      : 'center',
                                color: '#000',
                                pointerEvents: 'none',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                overflow: 'hidden',
                              }}
                            >
                              {text}
                            </Box>
                          );
                        })}
                    </Box>
                  ))}
                </Document>
              )}
            </Box>

            <Box
              sx={{
                width: 320,
                flexShrink: 0,
                borderLeft: `1px solid ${tokens.colors.gray100}`,
                overflow: 'auto',
                p: 2,
                bgcolor: tokens.colors.bgPaper,
              }}
            >
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.colors.gray600, mb: 1 }}>
                Balises ({filledCount}/{templateTags.length})
              </Typography>

              {templateTags.some((t) => t.tag.startsWith('<user_')) && (
                <Autocomplete
                  size="small"
                  options={users}
                  value={selectedUser}
                  onChange={async (_, value) => {
                    setSelectedUser(value);
                    if (!value) return;
                    const dec = await decryptUserForDocument(value.id, value.data);
                    applyMap(USER_TAG_MAP, dec ?? value.data);
                  }}
                  getOptionLabel={(o) => o.label}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  renderInput={(p) => (
                    <TextField {...p} label="Lier un étudiant" placeholder="Rechercher…" />
                  )}
                  sx={{ mb: 2 }}
                />
              )}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {templateTags.map((item) => (
                  <Box key={item.tag}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 600, color: tokens.colors.gray600 }}>
                        {item.tag}
                      </Typography>
                      <Tooltip title={hiddenTags.has(item.tag) ? 'Afficher' : 'Masquer'}>
                        <IconButton
                          size="small"
                          onClick={() =>
                            setHiddenTags((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.tag)) next.delete(item.tag);
                              else next.add(item.tag);
                              return next;
                            })
                          }
                        >
                          <VisibilityIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <TextField
                      fullWidth
                      size="small"
                      value={tagValues[item.tag] || ''}
                      onChange={(e) =>
                        setTagValues((prev) => ({ ...prev, [item.tag]: e.target.value }))
                      }
                      disabled={hiddenTags.has(item.tag)}
                      multiline={item.tag.includes('description')}
                      minRows={item.tag.includes('description') ? 2 : 1}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        )}
      </DialogContent>

      {step === 'edit' && (
        <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${tokens.colors.gray100}` }}>
          <Typography sx={{ mr: 'auto', fontSize: 12, color: tokens.colors.gray500 }}>
            Mission pré-remplie · {filledCount} balise(s) remplie(s)
          </Typography>
          <Button onClick={handleClose} sx={{ textTransform: 'none' }}>
            Fermer
          </Button>
          <Button
            variant="contained"
            startIcon={
              downloading ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />
            }
            disabled={downloading || filledCount === 0}
            onClick={() => void handleDownload()}
            sx={{ textTransform: 'none', bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } }}
          >
            Télécharger le PDF
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};
