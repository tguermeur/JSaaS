import React, { useState } from 'react';
import { Box, Button, Chip, IconButton, Typography } from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Download as DownloadIcon,
  Visibility as PreviewIcon,
} from '@mui/icons-material';
import { tokens } from '../../../theme/tokens';
import {
  CollapsiblePanel,
  DocRowV2,
  DocumentDropzone,
  MissionEmptyState,
  TemplateActionCard,
} from '../../../components/ds/missionDetailsV2/MissionDetailsV2Primitives';
import { TEMPLATE_ACTIONS, DOC_CATEGORY_CHIPS } from './constants';
import type { DocCategory } from './types';
import type { DocumentType } from '../../../types/templates';
import UserReferenceText from '../../../components/common/UserReferenceText';

interface GeneratedDocument {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  documentType: DocumentType;
  createdAt: Date;
  createdByName?: string;
  createdBy?: string;
  version: number;
  tags?: Array<{ name: string } | string>;
  isUploaded?: boolean;
  category?: DocCategory;
  isInvoice?: boolean;
  isSigned?: boolean;
  locked?: boolean;
  signatureRequestId?: string;
  signatureStatus?: string;
}

interface MissionDocumentsTabV2Props {
  documents: GeneratedDocument[];
  canWrite: boolean;
  generatingDocType?: DocumentType | null;
  onGenerate: (type: DocumentType) => void;
  onGenerateFromTemplate?: () => void;
  onUpload: (files: FileList, category: DocCategory) => void;
  onOpenDocument: (doc: GeneratedDocument) => void;
  onDocumentMenu: (e: React.MouseEvent<HTMLElement>, doc: GeneratedDocument) => void;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function isContrat(doc: GeneratedDocument): boolean {
  return (
    doc.category === 'contrats' ||
    doc.documentType === 'lettre_mission' ||
    doc.documentType === 'convention_etudiant' ||
    doc.documentType === 'convention_entreprise'
  );
}

function isFacturation(doc: GeneratedDocument): boolean {
  return doc.category === 'facturation' || !!doc.isInvoice;
}

function isAutres(doc: GeneratedDocument): boolean {
  return doc.category === 'autres' || (doc.isUploaded && !isContrat(doc) && !isFacturation(doc));
}

const DOC_COLORS: Record<string, { bg: string; fg: string }> = {
  proposition_commerciale: { bg: '#dbeafe', fg: '#173B6C' },
  lettre_mission: { bg: '#dbeafe', fg: '#3b82f6' },
  convention_entreprise: { bg: '#d1fae5', fg: '#21BDA3' },
  convention_etudiant: { bg: '#d1fae5', fg: '#21BDA3' },
  facture: { bg: '#fce7f3', fg: '#ec4899' },
  avenant: { bg: '#fef3c7', fg: '#f59e0b' },
  default: { bg: tokens.colors.gray100, fg: tokens.colors.gray600 },
};

export const MissionDocumentsTabV2: React.FC<MissionDocumentsTabV2Props> = ({
  documents,
  canWrite,
  generatingDocType,
  onGenerate,
  onGenerateFromTemplate,
  onUpload,
  onOpenDocument,
  onDocumentMenu,
}) => {
  const [uploadCategory, setUploadCategory] = useState<DocCategory>('contrats');

  const generated = documents.filter((d) => !d.isUploaded);
  const contrats = documents.filter(isContrat);
  const facturation = documents.filter(isFacturation);
  const autres = documents.filter(isAutres);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
      <CollapsiblePanel title="Générer un document">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
          {TEMPLATE_ACTIONS.map((action) => (
            <TemplateActionCard
              key={action.id}
              label={action.label}
              hint={action.hint}
              color={action.color}
              onClick={() => !generatingDocType && onGenerate(action.id)}
            />
          ))}
          {onGenerateFromTemplate && (
            <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
              <TemplateActionCard
                label="Générer depuis une template"
                hint="Templates PDF de la structure"
                color="#6366f1"
                onClick={() => !generatingDocType && onGenerateFromTemplate()}
              />
            </Box>
          )}
        </Box>
      </CollapsiblePanel>

      {canWrite && (
        <CollapsiblePanel title="Importer un document">
          <Typography sx={{ fontSize: 12, color: tokens.colors.gray500, mb: 1.5 }}>
            PDF, Word, images — 20 Mo max
          </Typography>
          <DocumentDropzone
            onFiles={(files) => onUpload(files, uploadCategory)}
          />
          <Box sx={{ mt: 2 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 500, color: tokens.colors.gray600, mb: 1 }}>
              Classer dans
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {DOC_CATEGORY_CHIPS.map((chip) => {
                const active = uploadCategory === chip.id;
                return (
                  <Button
                    key={chip.id}
                    size="small"
                    onClick={() => setUploadCategory(chip.id)}
                    sx={{
                      textTransform: 'none',
                      fontSize: 12,
                      borderRadius: 999,
                      px: 1.5,
                      border: `1px solid ${active ? tokens.colors.gray900 : tokens.colors.gray200}`,
                      bgcolor: active ? tokens.colors.gray900 : tokens.colors.bgPaper,
                      color: active ? '#fff' : tokens.colors.gray700,
                    }}
                  >
                    {chip.label}
                  </Button>
                );
              })}
            </Box>
          </Box>
        </CollapsiblePanel>
      )}

      <DocList
        title="Documents générés"
        docs={generated}
        canWrite={canWrite}
        onOpen={onOpenDocument}
        onMenu={onDocumentMenu}
        emptyAction={canWrite ? () => {} : undefined}
      />
      <DocList title="Contrats" docs={contrats} canWrite={canWrite} onOpen={onOpenDocument} onMenu={onDocumentMenu} />
      <DocList title="Facturation" docs={facturation} canWrite={canWrite} onOpen={onOpenDocument} onMenu={onDocumentMenu} />
      <DocList title="Autres" docs={autres} canWrite={canWrite} onOpen={onOpenDocument} onMenu={onDocumentMenu} />
    </Box>
  );
};

const DocList: React.FC<{
  title: string;
  docs: GeneratedDocument[];
  canWrite: boolean;
  onOpen: (doc: GeneratedDocument) => void;
  onMenu: (e: React.MouseEvent<HTMLElement>, doc: GeneratedDocument) => void;
  emptyAction?: () => void;
}> = ({ title, docs, canWrite, onOpen, onMenu, emptyAction }) => (
  <CollapsiblePanel title={`${title} (${docs.length})`} defaultOpen={docs.length > 0}>
    {docs.length === 0 ? (
      <MissionEmptyState text={`Aucun document dans ${title.toLowerCase()}`} actionLabel="Importer" onAction={emptyAction} />
    ) : (
      <Box>
        {docs.map((doc) => {
          const colors = DOC_COLORS[doc.documentType] || DOC_COLORS.default;
          const isSigned =
            !!doc.isSigned ||
            !!doc.locked ||
            doc.signatureStatus === 'completed';
          const isPendingSignature =
            !isSigned &&
            (doc.signatureStatus === 'pending' ||
              doc.signatureStatus === 'sent' ||
              (!!doc.signatureRequestId && doc.signatureStatus !== 'cancelled'));

          return (
            <DocRowV2
              key={doc.id}
              iconBg={colors.bg}
              iconColor={colors.fg}
              name={doc.fileName}
              meta={
                <>
                  {`v${doc.version} · ${doc.createdAt.toLocaleDateString('fr-FR')} · par `}
                  <UserReferenceText
                    userId={doc.createdBy}
                    name={
                      doc.createdByName &&
                      doc.createdByName !== 'Utilisateur' &&
                      doc.createdByName !== 'Inconnu'
                        ? doc.createdByName
                        : undefined
                    }
                    fallback="Utilisateur"
                    component="span"
                    sx={{ fontSize: 'inherit', color: 'inherit' }}
                  />
                </>
              }
              tags={
                <>
                  {isSigned && (
                    <Chip
                      label="Signé"
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: 10,
                        fontWeight: 600,
                        flexShrink: 0,
                        bgcolor: tokens.colors.successLight,
                        color: tokens.colors.success,
                      }}
                    />
                  )}
                  {isPendingSignature && (
                    <Chip
                      label="En signature"
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: 10,
                        fontWeight: 600,
                        flexShrink: 0,
                        bgcolor: tokens.colors.warningLight,
                        color: '#b45309',
                      }}
                    />
                  )}
                  {doc.isUploaded && (
                    <Chip
                      label="Importé"
                      size="small"
                      sx={{ height: 20, fontSize: 10, fontWeight: 600, flexShrink: 0 }}
                    />
                  )}
                </>
              }
              size={fmtSize(doc.fileSize)}
              onClick={() => onOpen(doc)}
              actions={
                <Box sx={{ display: 'flex', gap: 0.25 }}>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); onOpen(doc); }}>
                    <PreviewIcon sx={{ fontSize: 16, color: tokens.colors.gray400 }} />
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); window.open(doc.fileUrl, '_blank'); }}>
                    <DownloadIcon sx={{ fontSize: 16, color: tokens.colors.gray400 }} />
                  </IconButton>
                  {canWrite && (
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); onMenu(e, doc); }}>
                      <MoreVertIcon sx={{ fontSize: 16, color: tokens.colors.gray400 }} />
                    </IconButton>
                  )}
                </Box>
              }
            />
          );
        })}
      </Box>
    )}
  </CollapsiblePanel>
);
