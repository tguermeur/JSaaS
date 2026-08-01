import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircleOutline as CheckIcon,
  Draw as DrawIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { tokens } from '../../theme/tokens';
import type { SignatureField } from '../../types/signature';
import {
  DOCUMENT_TYPES,
  SIGNATURE_TEMPLATE_DOCUMENT_TYPES,
  counterpartyLabelForDocumentType,
  type DocumentType,
  type TemplateSignaturePlacement,
} from '../../types/templates';
import {
  draftSignersForDocumentType,
  placementsToSignatureFields,
  signatureFieldsToPlacements,
} from '../../utils/signaturePlacements';
import SignatureFieldPlacer from './SignatureFieldPlacer';

export { loadSignaturePlacementsForDocumentType } from '../../utils/signaturePlacements';

type AssignedTemplateRow = {
  documentType: DocumentType;
  templateId: string;
  templateName: string;
  pdfUrl: string;
  assignmentId: string | null;
  placements: TemplateSignaturePlacement[];
};

type Props = {
  open: boolean;
  onClose: () => void;
};

async function resolveAssignedTemplates(structureId: string): Promise<AssignedTemplateRow[]> {
  const rows: AssignedTemplateRow[] = [];

  for (const documentType of SIGNATURE_TEMPLATE_DOCUMENT_TYPES) {
    let templateId: string | null = null;
    let assignmentId: string | null = null;
    let placements: TemplateSignaturePlacement[] = [];
    let templateName = DOCUMENT_TYPES[documentType];
    let pdfUrl = '';

    const assignmentsSnap = await getDocs(
      query(
        collection(db, 'templateAssignments'),
        where('structureId', '==', structureId),
        where('documentType', '==', documentType)
      )
    );

    if (!assignmentsSnap.empty) {
      const assignmentDoc = assignmentsSnap.docs[0];
      const data = assignmentDoc.data();
      assignmentId = assignmentDoc.id;
      templateId = String(data.templateId || '');
      placements = Array.isArray(data.signaturePlacements)
        ? (data.signaturePlacements as TemplateSignaturePlacement[])
        : [];
    }

    if (!templateId) {
      const universalSnap = await getDocs(
        query(
          collection(db, 'templates'),
          where('isUniversal', '==', true),
          where('universalDocumentType', '==', documentType)
        )
      );
      if (!universalSnap.empty) {
        templateId = universalSnap.docs[0].id;
      }
    }

    if (templateId) {
      const templateSnap = await getDoc(doc(db, 'templates', templateId));
      if (templateSnap.exists()) {
        const t = templateSnap.data();
        templateName = String(t.name || templateName);
        pdfUrl = String(t.pdfUrl || '');
        // Repli legacy : placements stockés sur le template
        if (placements.length === 0 && Array.isArray(t.signaturePlacements)) {
          placements = t.signaturePlacements as TemplateSignaturePlacement[];
        }
      }
    }

    rows.push({
      documentType,
      templateId: templateId || '',
      templateName,
      pdfUrl,
      assignmentId,
      placements,
    });
  }

  return rows;
}

const ConfigureTemplateSignaturePlacements: React.FC<Props> = ({ open, onClose }) => {
  const { userData } = useAuth();
  const structureId = userData?.structureId || '';

  const [rows, setRows] = useState<AssignedTemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AssignedTemplateRow | null>(null);
  const [fields, setFields] = useState<SignatureField[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!structureId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await resolveAssignedTemplates(structureId);
      setRows(data);
    } catch (e: unknown) {
      setError(
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : 'Impossible de charger les templates.'
      );
    } finally {
      setLoading(false);
    }
  }, [structureId]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaveMsg(null);
    setEditing(null);
    void load();
  }, [open, load]);

  const draftSigners = useMemo(
    () => (editing ? draftSignersForDocumentType(editing.documentType) : []),
    [editing]
  );

  const openEditor = (row: AssignedTemplateRow) => {
    if (!row.pdfUrl || !row.templateId) {
      setError(
        `Aucun template assigné pour « ${DOCUMENT_TYPES[row.documentType]} ». Configurez-le dans Paramètres → Templates.`
      );
      return;
    }
    setSaveMsg(null);
    setEditing(row);
    setFields(placementsToSignatureFields(row.placements, row.documentType));
  };

  const handleSave = async () => {
    if (!editing || !structureId) return;
    setSaving(true);
    setError(null);
    try {
      const placements = signatureFieldsToPlacements(fields);
      const now = new Date();
      const assignmentId = editing.assignmentId || `${structureId}_${editing.documentType}`;

      if (editing.assignmentId) {
        await updateDoc(doc(db, 'templateAssignments', editing.assignmentId), {
          signaturePlacements: placements,
          updatedAt: now,
        });
      } else {
        await setDoc(doc(db, 'templateAssignments', assignmentId), {
          structureId,
          documentType: editing.documentType,
          templateId: editing.templateId,
          generationType: 'template',
          signaturePlacements: placements,
          createdAt: now,
          updatedAt: now,
        });
      }

      setSaveMsg('Emplacements enregistrés.');
      setEditing(null);
      await load();
    } catch (e: unknown) {
      setError(
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : 'Échec de la sauvegarde.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCloseList = () => {
    if (saving || editing) return;
    onClose();
  };

  return (
    <>
      <Dialog open={open && !editing} onClose={handleCloseList} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <DrawIcon sx={{ color: tokens.colors.brandTeal }} />
          Emplacements préconfigurés
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: tokens.colors.textSecondary }}>
            Placez une fois les cases Client/Étudiant et Structure sur les templates LM, PC et
            Avenant — elles seront réutilisées à l’envoi depuis MissionDetails.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {saveMsg && (
            <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setSaveMsg(null)}>
              {saveMsg}
            </Alert>
          )}

          {!structureId ? (
            <Alert severity="warning">Aucune structure associée à votre compte.</Alert>
          ) : loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Stack spacing={1}>
              {rows.map((row) => {
                const hasPlacements = row.placements.length > 0;
                const counterparty = counterpartyLabelForDocumentType(row.documentType);
                const hasCounterparty = row.placements.some((p) => p.role === 'counterparty');
                const hasStructure = row.placements.some((p) => p.role === 'structure');
                return (
                  <Box
                    key={row.documentType}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      flexWrap: 'wrap',
                      py: 1,
                      px: 1.5,
                      borderRadius: tokens.radius.md,
                      border: `1px solid ${tokens.colors.divider}`,
                      bgcolor: tokens.colors.bgDefault,
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 160 }}>
                      <Typography sx={{ fontWeight: 600 }}>
                        {DOCUMENT_TYPES[row.documentType]}
                      </Typography>
                      <Typography variant="caption" sx={{ color: tokens.colors.textSecondary }}>
                        {row.templateId ? row.templateName : 'Aucun template assigné'}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      {hasPlacements ? (
                        <>
                          <Chip
                            size="small"
                            icon={<CheckIcon />}
                            label={`${row.placements.length} zone${row.placements.length > 1 ? 's' : ''}`}
                            color="success"
                            variant="outlined"
                          />
                          {!hasCounterparty && (
                            <Chip size="small" label={`Manque ${counterparty}`} color="warning" />
                          )}
                          {!hasStructure && (
                            <Chip size="small" label="Manque Structure" color="warning" />
                          )}
                        </>
                      ) : (
                        <Chip size="small" label="Non configuré" variant="outlined" />
                      )}
                    </Stack>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<SettingsIcon />}
                      disabled={!row.templateId || !row.pdfUrl}
                      onClick={() => openEditor(row)}
                      sx={{ textTransform: 'none' }}
                    >
                      {hasPlacements ? 'Modifier' : 'Configurer'}
                    </Button>
                  </Box>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Fermer</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        onClose={saving ? undefined : () => setEditing(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Emplacements — {editing ? DOCUMENT_TYPES[editing.documentType] : ''}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: tokens.colors.textSecondary }}>
            Placez au moins une case pour «{' '}
            {editing ? counterpartyLabelForDocumentType(editing.documentType) : 'Client'} » et une
            pour « Structure ». Ces positions seront appliquées automatiquement à l’envoi en
            signature.
          </Typography>
          {editing?.pdfUrl && (
            <SignatureFieldPlacer
              pdfUrl={editing.pdfUrl}
              signers={draftSigners}
              fields={fields}
              onChange={setFields}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditing(null)} disabled={saving}>
            Retour
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSave()}
            disabled={saving || fields.length === 0}
            sx={{
              bgcolor: tokens.colors.brandTeal,
              '&:hover': { bgcolor: tokens.colors.brandTeal700 },
            }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ConfigureTemplateSignaturePlacements;
