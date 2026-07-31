import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Typography,
  Button,
  Alert,
  Snackbar,
  Paper,
  Grid,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import BackButton from '../components/ui/BackButton';
import { tokens } from '../theme/tokens';
import { settingsPageStyles, SettingsPanel } from '../components/ds';
import TagLibraryDisplay from '../components/TagLibraryDisplay';
import { COMPLETE_TAG_LIBRARY } from './DocumentGenerator';

const TagLibrary: React.FC = () => {
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });

  const handleTagCopy = (tag: string) => {
    setSnackbar({
      open: true,
      message: `Balise ${tag} copiée dans le presse-papier !`,
      severity: 'success'
    });
  };

  // Générer un fichier de documentation des balises
  const generateTagDocumentation = () => {
    const categories = [...new Set(COMPLETE_TAG_LIBRARY.map(tag => tag.category))];
    
    let documentation = `# Bibliothèque des balises disponibles\n\n`;
    documentation += `Généré le ${new Date().toLocaleDateString('fr-FR')}\n\n`;
    documentation += `## Résumé\n\n`;
    documentation += `- **Total des balises**: ${COMPLETE_TAG_LIBRARY.length}\n`;
    documentation += `- **Catégories**: ${categories.length}\n\n`;

    categories.forEach(category => {
      const tagsInCategory = COMPLETE_TAG_LIBRARY.filter(tag => tag.category === category);
      documentation += `## ${category} (${tagsInCategory.length} balises)\n\n`;
      
      tagsInCategory.forEach(tag => {
        documentation += `### \`${tag.tag}\`\n\n`;
        documentation += `**Description**: ${tag.description}\n\n`;
        documentation += `**Exemple**: ${tag.example}\n\n`;
        documentation += `---\n\n`;
      });
    });

    // Créer et télécharger le fichier
    const blob = new Blob([documentation], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `balises-disponibles-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSnackbar({
      open: true,
      message: 'Documentation téléchargée avec succès !',
      severity: 'success'
    });
  };

  return (
    <Box>
      <BackButton />

      <Box component="header" sx={{ ...settingsPageStyles.header, px: 0, py: 0, bgcolor: 'transparent', borderBottom: 'none', mb: 3 }}>
        <Box>
          <Typography sx={settingsPageStyles.eyebrow}>Paramètres</Typography>
          <Typography component="h1" sx={settingsPageStyles.title}>Bibliothèque des balises</Typography>
          <Typography sx={settingsPageStyles.sub}>
            Consultez toutes les balises disponibles pour vos documents
          </Typography>
        </Box>
      </Box>

      <SettingsPanel
        title="Actions rapides"
        desc="Téléchargez la documentation complète ou consultez les exemples"
        action={
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={generateTagDocumentation}
            sx={{
              borderColor: tokens.colors.brandTeal,
              color: tokens.colors.brandTeal,
              textTransform: 'none',
              '&:hover': { borderColor: tokens.colors.brandTeal700, bgcolor: tokens.colors.primaryAlpha10 },
            }}
          >
            Télécharger la documentation
          </Button>
        }
      >
        <Typography variant="body2" color="text.secondary">
          Exportez la liste complète des balises au format Markdown.
        </Typography>
      </SettingsPanel>

      <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <SettingsPanel title="Guide d'utilisation" icon={<InfoIcon sx={{ fontSize: 16 }} />}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Alert severity="info">
                <Typography variant="subtitle2" gutterBottom>
                  Comment utiliser les balises
                </Typography>
                <Typography variant="body2">
                  Placez les balises directement dans vos documents Word, PDF ou PowerPoint à l&apos;endroit où vous voulez que les données apparaissent.
                </Typography>
              </Alert>
            </Grid>

            <Grid item xs={12} md={4}>
              <Alert severity="success">
                <Typography variant="subtitle2" gutterBottom>
                  Exemple pratique
                </Typography>
                <Typography variant="body2">
                  &quot;Étude &lt;etude_numero&gt; pour &lt;entreprise_nom&gt;&quot; devient &quot;Étude E2024-001 pour TechCorp SARL&quot;
                </Typography>
              </Alert>
            </Grid>

            <Grid item xs={12} md={4}>
              <Alert severity="warning">
                <Typography variant="subtitle2" gutterBottom>
                  Syntaxe importante
                </Typography>
                <Typography variant="body2">
                  Respectez exactement la syntaxe avec les crochets &lt; &gt; et l&apos;orthographe des balises.
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </SettingsPanel>

        <Grid container spacing={2}>
          {[...new Set(COMPLETE_TAG_LIBRARY.map((tag) => tag.category))].map((category) => {
            const count = COMPLETE_TAG_LIBRARY.filter((tag) => tag.category === category).length;
            return (
              <Grid item xs={6} sm={4} md={3} key={category}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${tokens.colors.divider}`,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, color: tokens.colors.brandTeal }}>
                    {count}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {category}
                  </Typography>
                </Paper>
              </Grid>
            );
          })}
        </Grid>

        <SettingsPanel
          title="Toutes les balises disponibles"
          desc={`${COMPLETE_TAG_LIBRARY.length} balises référencées`}
        >
          <TagLibraryDisplay onTagCopy={handleTagCopy} showDetectedOnly={false} />
        </SettingsPanel>
      </Box>

      {/* Snackbar pour les notifications */}
      {createPortal(
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          sx={{ zIndex: 10000 }}
        >
          <Alert
            onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
            severity={snackbar.severity}
            variant="filled"
          >
            {snackbar.message}
          </Alert>
        </Snackbar>,
        document.body
      )}
    </Box>
  );
};

export default TagLibrary;

