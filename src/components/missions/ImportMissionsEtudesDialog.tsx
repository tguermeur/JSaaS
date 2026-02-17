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
} from '@mui/material';
import { CloudUpload as CloudUploadIcon, Download as DownloadIcon } from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';

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
    { key: 'startDate', label: 'Début' },
    { key: 'endDate', label: 'Fin' },
    { key: 'studentCount', label: 'Étudiants' },
    { key: 'hours', label: 'Heures' },
    { key: 'chargeName', label: 'Chargé de mission' },
    { key: 'priceHT', label: 'Prix HT', format: (v) => (v != null && v !== '' ? `${Number(v)} €` : '—') },
    { key: 'salary', label: 'Rémunération' },
    { key: 'mandat', label: 'Mandat' },
    { key: 'status', label: 'Statut' },
    { key: 'etape', label: 'Étape' },
  ],
  etude: [
    { key: 'numeroEtude', label: 'Numéro' },
    { key: 'company', label: 'Entreprise' },
    { key: 'location', label: 'Lieu' },
    { key: 'startDate', label: 'Début' },
    { key: 'endDate', label: 'Fin' },
    { key: 'consultantCount', label: 'Consultants' },
    { key: 'hours', label: 'Heures' },
    { key: 'status', label: 'Statut' },
  ],
};

export interface ImportMissionsEtudesDialogProps {
  open: boolean;
  onClose: () => void;
  type: ImportType;
  importedData: Record<string, unknown>[];
  onFileParsed: (rows: Record<string, unknown>[]) => void;
  onImport: () => void;
  onDownloadTemplate: () => void;
  importing?: boolean;
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
  columns: columnsProp,
}) => {
  const columns = columnsProp ?? DEFAULT_COLUMNS[type];
  const title = type === 'mission' ? 'Importer des missions' : 'Importer des études';

  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = (results.data as Record<string, unknown>[]).filter(
            (row) => Object.keys(row).some((k) => row[k] != null && String(row[k]).trim() !== '')
          );
          onFileParsed(rows);
        },
        error: () => {
          onFileParsed([]);
        },
      });
    },
    [onFileParsed]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    disabled: !open,
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
            <Box sx={{ px: 3, py: 1.5, bgcolor: 'grey.50' }}>
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                Aperçu — {importedData.length} ligne{importedData.length > 1 ? 's' : ''}
              </Typography>
            </Box>
            <TableContainer sx={{ maxHeight: 280 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {columns.map((col) => (
                      <TableCell key={col.key} sx={{ fontWeight: 600, fontSize: '0.75rem', py: 1, bgcolor: 'grey.50' }}>
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {importedData.slice(0, 10).map((row, index) => (
                    <TableRow key={index} hover sx={{ '&:last-child td': { border: 0 } }}>
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
            {importedData.length > 10 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 3, pb: 1 }}>
                + {importedData.length - 10} autre(s) ligne(s)
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
