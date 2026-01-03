import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  Snackbar,
  Paper,
  Divider
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import BackButton from '../components/ui/BackButton';
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
    <Box sx={{ p: 3 }}>
      <BackButton />
      
      {/* En-tête */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
          Bibliothèque des balises
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Consultez toutes les balises disponibles pour vos documents
        </Typography>
      </Box>

      {/* Actions rapides */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Actions rapides
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Téléchargez la documentation complète ou consultez les exemples
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={generateTagDocumentation}
              >
                Télécharger la documentation
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Guide d'utilisation */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoIcon color="primary" />
            Guide d'utilisation
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Alert severity="info">
                <Typography variant="subtitle2" gutterBottom>
                  Comment utiliser les balises
                </Typography>
                <Typography variant="body2">
                  Placez les balises directement dans vos documents Word, PDF ou PowerPoint à l'endroit où vous voulez que les données apparaissent.
                </Typography>
              </Alert>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Alert severity="success">
                <Typography variant="subtitle2" gutterBottom>
                  Exemple pratique
                </Typography>
                <Typography variant="body2">
                  "Étude &lt;etude_numero&gt; pour &lt;entreprise_nom&gt;" devient "Étude E2024-001 pour TechCorp SARL"
                </Typography>
              </Alert>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Alert severity="warning">
                <Typography variant="subtitle2" gutterBottom>
                  Syntaxe importante
                </Typography>
                <Typography variant="body2">
                  Respectez exactement la syntaxe avec les crochets &lt; &gt; et l'orthographe des balises.
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Statistiques */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {categories.filter(c => c.id !== 'all').map(category => {
          const count = COMPLETE_TAG_LIBRARY.filter(tag => tag.category === category.label.split('/')[0]).length;
          if (count === 0) return null;
          
          return (
            <Grid item xs={6} sm={4} md={3} key={category.id}>
              <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                <Box sx={{ color: 'primary.main', mb: 1 }}>
                  {category.icon}
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {count}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {category.label}
                </Typography>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      {/* Bibliothèque des balises */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Toutes les balises disponibles
          </Typography>
          <TagLibraryDisplay 
            onTagCopy={handleTagCopy}
            detectedTags={detectedTags}
            showDetectedOnly={false}
          />
        </CardContent>
      </Card>

      {/* Snackbar pour les notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TagLibrary;

