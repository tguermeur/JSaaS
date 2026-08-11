import React, { useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  alpha,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import { CloudUpload as CloudUploadIcon, Download as DownloadIcon, Warning as WarningIcon, ContentCopy as DuplicateIcon } from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import {
  parseImportSpreadsheet,
  IMPORT_SPREADSHEET_ACCEPT,
} from '../../utils/parseImportSpreadsheet';

export type ImportType = 'mission' | 'etude';

export interface ImportColumn {
  key: string;
  label: string;
  format?: (value: unknown) => string;
}

const DEFAULT_COLUMNS: Record<ImportType, ImportColumn[]> = {
  mission: [
    { key: 'numeroMission', label: 'Numéro' },
    { key: 'company', label: 'Entreprise' },
    { key: 'title', label: 'Titre' },
    { key: 'location', label: 'Lieu' },
    { key: 'startDate', label: 'Début', format: (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v && typeof v === 'string' ? v.slice(0, 10) : '—')) },
    { key: 'endDate', label: 'Fin', format: (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v && typeof v === 'string' ? v.slice(0, 10) : '—')) },
    { key: 'studentCount', label: 'Étudiants' },
    { key: 'hours', label: 'Heures' },
    { key: 'chargeName', label: 'Chargé de mission' },
    { key: 'priceHT', label: 'Prix HT', format: (v) => (v != null && v !== '' ? `${Number(v)} €` : '—') },
    { key: 'totalTTC', label: 'Montant facture TTC', format: (v) => (v != null && v !== '' ? `${Number(v)} €` : '—') },
    { key: 'status', label: 'Statut' },
    { key: 'etape', label: 'Étape' },
  ],
  etude: [
    { key: 'numeroEtude', label: 'Numéro' },
    { key: 'company', label: 'Entreprise' },
    { key: 'location', label: 'Lieu' },
    { key: 'startDate', label: 'Début', format: (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v && typeof v === 'string' ? v.slice(0, 10) : '—')) },
    { key: 'endDate', label: 'Fin', format: (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v && typeof v === 'string' ? v.slice(0, 10) : '—')) },
    { key: 'consultantCount', label: 'Consultants' },
    { key: 'hours', label: 'Heures' },
    { key: 'chargeName', label: 'Chargé d\'études' },
    { key: 'status', label: 'Statut' },
  ],
};

export interface ImportValidationError {
  rowIndex: number;
  field: string;
  message: string;
}

export interface DuplicateHint {
  rowIndex: number;
  suggestedDuplicateOf: number;
}

export interface ImportMissionsEtudesDialogProps {
  open: boolean;
  onClose: () => void;
  type: ImportType;
  importedData: Record<string, unknown>[];
  onFileParsed: (rows: Record<string, unknown>[]) => void;
  onImport: () => void;
  onDownloadTemplate: () => void;
  importing?: boolean;
  processingAI?: boolean;
  validationErrors?: ImportValidationError[];
  duplicateHints?: DuplicateHint[];
  columns?: ImportColumn[];
}

const ImportMissionsEtudesDialog: React.FC<ImportMissionsEtudesDialogProps> = ({
  open,
  onClose,
  type,
  importedData,
  onFileParsed,
  onImport,
  onDownloadTemplate,
  importing = false,
  processingAI = false,
  validationErrors = [],
  duplicateHints = [],
  columns: columnsProp,
}) => {
  const columns = columnsProp ?? DEFAULT_COLUMNS[type];
  const title = type === 'mission' ? 'Importer des missions' : 'Importer des études';
  const errorsByRow = React.useMemo(() => {
    const m: Record<number, ImportValidationError[]> = {};
    validationErrors.forEach((e) => {
      if (!m[e.rowIndex]) m[e.rowIndex] = [];
      m[e.rowIndex].push(e);
    });
    return m;
  }, [validationErrors]);
  const duplicateOf = React.useMemo(() => {
    const m: Record<number, number> = {};
    duplicateHints.forEach((h) => { m[h.rowIndex] = h.suggestedDuplicateOf; });
    return m;
  }, [duplicateHints]);

  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      void parseImportSpreadsheet(file)
        .then((rows) => {
          onFileParsed(rows);
        })
        .catch(() => {
          onFileParsed([]);
        });
    },
    [onFileParsed]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: { ...IMPORT_SPREADSHEET_ACCEPT },
    maxFiles: 1,
    disabled: !open || processingAI,
  });

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 600,
          fontSize: '1.125rem',
          pb: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {title}
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
          {processingAI && (
          <Box sx={{ px: 3, py: 1 }}>
            <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>
              Traitement des données par l&apos;IA (mapping et validation)…
            </Typography>
            <LinearProgress sx={{ mt: 0.5, borderRadius: 1 }} />
          </Box>
          )}
          {/* Zone de dépôt — style épuré type project-dashboard */}
          <Box
            {...getRootProps()}
            sx={{
              border: '1px dashed',
              borderColor: isDragActive ? 'primary.main' : 'divider',
              borderRadius: 2,
              bgcolor: isDragActive ? (theme) => alpha(theme.palette.primary.main, 0.04) : 'grey.50',
              py: 4,
              px: 2,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.2s, background-color 0.2s',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
              },
            }}
          >
            <input {...getInputProps()} />
            <CloudUploadIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              {isDragActive ? 'Déposez le fichier ici' : 'Glissez un fichier CSV ou Excel ici'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              ou cliquez pour parcourir
            </Typography>
          </Box>

          {/* Lien télécharger modèle — discret */}
          <Typography
            component="button"
            type="button"
            variant="body2"
            onClick={onDownloadTemplate}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              mt: 2,
              p: 0,
              border: 0,
              background: 'none',
              cursor: 'pointer',
              color: 'primary.main',
              fontWeight: 500,
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            <DownloadIcon sx={{ fontSize: 18 }} />
            Télécharger le modèle CSV
          </Typography>
        </Box>

        {/* Aperçu — table minimaliste */}
        {importedData.length > 0 && (
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ px: 3, py: 1.5, bgcolor: 'grey.50', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                Aperçu (données déjà traitées et rattachées) — {importedData.length} ligne{importedData.length > 1 ? 's' : ''}
              </Typography>
              {(validationErrors.length > 0 || duplicateHints.length > 0) ? (
                <Typography variant="caption" color="warning.main" sx={{ fontWeight: 500 }}>
                  {validationErrors.length > 0 ? `${validationErrors.length} alerte(s) de validation` : null}
                  {validationErrors.length > 0 && duplicateHints.length > 0 ? ' · ' : null}
                  {duplicateHints.length > 0 ? `${duplicateHints.length} possible(s) doublon(s)` : null}
                </Typography>
              ) : null}
            </Box>
            <TableContainer sx={{ maxHeight: 360 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {(validationErrors.length > 0 || duplicateHints.length > 0) && (
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', py: 1, bgcolor: 'grey.50', width: 48 }} />
                    )}
                    {columns.map((col) => (
                      <TableCell key={col.key} sx={{ fontWeight: 600, fontSize: '0.75rem', py: 1, bgcolor: 'grey.50' }}>
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {importedData.slice(0, 15).map((row, index) => (
                    <TableRow key={index} hover sx={{ '&:last-child td': { border: 0 } }}>
                      {(validationErrors.length > 0 || duplicateHints.length > 0) && (
                        <TableCell sx={{ py: 0.5, verticalAlign: 'middle' }}>
                          {errorsByRow[index]?.length > 0 ? (
                            <Tooltip title={errorsByRow[index].map((e) => e.message).join(' · ')}>
                              <WarningIcon fontSize="small" color="warning" sx={{ cursor: 'help' }} />
                            </Tooltip>
                          ) : duplicateOf[index] !== undefined ? (
                            <Tooltip title={`Possible doublon de la ligne ${duplicateOf[index] + 1}`}>
                              <DuplicateIcon fontSize="small" color="action" sx={{ cursor: 'help' }} />
                            </Tooltip>
                          ) : null}
                        </TableCell>
                      )}
                      {columns.map((col) => (
                        <TableCell key={col.key} sx={{ fontSize: '0.8125rem', py: 1 }}>
                          {col.format ? col.format(row[col.key]) : String(row[col.key] ?? '—')}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {importedData.length > 15 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 3, pb: 1 }}>
                + {importedData.length - 15} autre(s) ligne(s)
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          px: 3,
          py: 2,
          gap: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'grey.50',
        }}
      >
        <Button onClick={handleClose} variant="text" color="inherit" sx={{ fontWeight: 500 }}>
          Fermer
        </Button>
        <Button
          variant="contained"
          onClick={onImport}
          disabled={importedData.length === 0 || importing}
          sx={{ fontWeight: 600, borderRadius: 2, px: 2.5 }}
        >
          {importing ? 'Import en cours…' : `Importer (${importedData.length})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportMissionsEtudesDialog;
