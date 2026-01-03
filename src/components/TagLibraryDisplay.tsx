import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Chip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Assignment as AssignmentIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  School as SchoolIcon,
  Receipt as ReceiptIcon,
  Work as WorkIcon,
  Edit as EditIcon,
  Info as InfoIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import { COMPLETE_TAG_LIBRARY } from '../pages/DocumentGenerator';

interface TagLibraryDisplayProps {
  onTagCopy?: (tag: string) => void;
  detectedTags?: string[];
  showDetectedOnly?: boolean;
}

const TagLibraryDisplay: React.FC<TagLibraryDisplayProps> = ({
  onTagCopy,
  detectedTags = [],
  showDetectedOnly = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Catégories disponibles
  const categories = [
    { id: 'all', label: 'Toutes les catégories', icon: <FilterIcon /> },
    { id: 'Étude', label: 'Étude/Mission', icon: <AssignmentIcon /> },
    { id: 'Étudiant', label: 'Étudiant', icon: <SchoolIcon /> },
    { id: 'Entreprise', label: 'Entreprise', icon: <BusinessIcon /> },
    { id: 'Contact', label: 'Contact', icon: <PersonIcon /> },
    { id: 'Structure', label: 'Structure', icon: <WorkIcon /> },
    { id: 'Frais', label: 'Notes de frais', icon: <ReceiptIcon /> },
    { id: 'Heures', label: 'Heures de travail', icon: <WorkIcon /> },
    { id: 'Avenant', label: 'Avenants', icon: <EditIcon /> },
    { id: 'Facturation', label: 'Facturation', icon: <ReceiptIcon /> },
    { id: 'Système', label: 'Système', icon: <InfoIcon /> }
  ];

  // Filtrage des balises
  const getFilteredTags = () => {
    let filtered = COMPLETE_TAG_LIBRARY;

    if (showDetectedOnly) {
      filtered = filtered.filter(tag => detectedTags.includes(tag.tag));
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(tag => tag.category === selectedCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter(tag => 
        tag.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tag.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tag.example.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  // Grouper les balises par catégorie
  const getTagsByCategory = () => {
    const filtered = getFilteredTags();
    const grouped: { [key: string]: typeof filtered } = {};

    filtered.forEach(tag => {
      if (!grouped[tag.category]) {
        grouped[tag.category] = [];
      }
      grouped[tag.category].push(tag);
    });

    return grouped;
  };

  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    if (onTagCopy) {
      onTagCopy(tag);
    }
  };

  const filteredTags = getFilteredTags();
  const tagsByCategory = getTagsByCategory();

  return (
    <Box>
      {/* Filtres */}
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              size="small"
              placeholder="Rechercher une balise par nom, description ou exemple..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Catégorie</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                label="Catégorie"
              >
                {categories.map(category => (
                  <MenuItem key={category.id} value={category.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {category.icon}
                      {category.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>

      {/* Résumé */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>{filteredTags.length}</strong> balises disponibles
          {detectedTags.length > 0 && (
            <span> • <strong>{detectedTags.length}</strong> détectées dans votre document</span>
          )}
        </Typography>
      </Alert>

      {/* Affichage par catégorie */}
      <Box>
        {Object.entries(tagsByCategory).map(([categoryName, tags]) => {
          const categoryInfo = categories.find(c => c.label.includes(categoryName)) || 
                             categories.find(c => c.id === categoryName);
          
          return (
            <Accordion key={categoryName} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {categoryInfo?.icon}
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {categoryName}
                  </Typography>
                  <Chip 
                    label={`${tags.length} balise${tags.length > 1 ? 's' : ''}`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {tags.map((tag, index) => (
                    <Grid item xs={12} md={6} key={index}>
                      <Paper 
                        sx={{ 
                          p: 2, 
                          borderRadius: 2,
                          border: detectedTags.includes(tag.tag) ? '2px solid #4caf50' : '1px solid #e0e0e0',
                          bgcolor: detectedTags.includes(tag.tag) ? 'rgba(76, 175, 80, 0.05)' : 'white'
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography 
                            variant="body1" 
                            component="code" 
                            sx={{ 
                              fontFamily: 'monospace',
                              bgcolor: 'grey.100',
                              px: 1,
                              py: 0.5,
                              borderRadius: 1,
                              fontSize: '0.875rem',
                              fontWeight: 600
                            }}
                          >
                            {tag.tag}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {detectedTags.includes(tag.tag) && (
                              <CheckIcon sx={{ color: 'success.main', fontSize: 16 }} />
                            )}
                            <IconButton 
                              size="small" 
                              onClick={() => handleCopyTag(tag.tag)}
                              sx={{ p: 0.5 }}
                            >
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                        
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          {tag.description}
                        </Typography>
                        
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          Exemple: {tag.example}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>

      {filteredTags.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <InfoIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Aucune balise trouvée
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Essayez de modifier vos critères de recherche ou de sélectionner une autre catégorie.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default TagLibraryDisplay;

