import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  Snackbar,
  CircularProgress,
  Grid,
  Tooltip,
  alpha,
  useTheme
} from '@mui/material';
import { Save as SaveIcon, Star as StarIcon } from '@mui/icons-material';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { DocumentType, DOCUMENT_TYPES, TemplateAssignment } from '../../types/templates';

interface Template {
  id: string;
  name: string;
  description: string;
  pdfUrl: string;
  fileName: string;
  variables: any[];
  file: File | null;
  structureId: string;
  isUniversal?: boolean;
  universalDocumentType?: DocumentType | null;
}

interface DefaultTemplate {
  documentType: DocumentType;
  templateId: string;
}

const TemplateAssignmentComponent: React.FC = () => {
  const { currentUser, userData } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [assignments, setAssignments] = useState<{ [key in DocumentType]?: string }>({});
  const [generationTypes, setGenerationTypes] = useState<{ [key in DocumentType]?: 'template' | 'editor' }>({});
  const [defaultTemplates, setDefaultTemplates] = useState<DefaultTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [userStructureId, setUserStructureId] = useState<string | null>(null);
  const isSuperAdmin = userData?.status === 'superadmin';
  const isAdmin = userData?.status === 'admin';
  const canSave = isSuperAdmin || isAdmin;
  console.log('Statut superadmin:', isSuperAdmin, 'userData:', userData);
  const theme = useTheme();

  useEffect(() => {
    const fetchData = async () => {
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

        // Récupérer les templates de la structure
        const structureTemplatesQuery = query(
          collection(db, 'templates'),
          where('structureId', '==', structureId)
        );
        const structureTemplatesSnapshot = await getDocs(structureTemplatesQuery);
        const structureTemplatesData = structureTemplatesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            description: data.description,
            pdfUrl: data.pdfUrl,
            fileName: data.fileName || '',
            variables: data.variables || [],
            file: null,
            structureId: data.structureId || '',
            isUniversal: data.isUniversal || false,
            universalDocumentType: data.universalDocumentType || null
          } as Template;
        });

        // Récupérer les templates universels
        const universalTemplatesQuery = query(
          collection(db, 'templates'),
          where('isUniversal', '==', true)
        );
        const universalTemplatesSnapshot = await getDocs(universalTemplatesQuery);
        const universalTemplatesData = universalTemplatesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            description: data.description,
            pdfUrl: data.pdfUrl,
            fileName: data.fileName || '',
            variables: data.variables || [],
            file: null,
            structureId: data.structureId || '',
            isUniversal: true,
            universalDocumentType: data.universalDocumentType
          } as Template;
        });

        // Combiner les templates de la structure et les templates universels
        const allTemplates = [...structureTemplatesData, ...universalTemplatesData];
        setTemplates(allTemplates);

        // Récupérer les assignations existantes pour cette structure
        const assignmentsSnapshot = await getDocs(query(
          collection(db, 'templateAssignments'),
          where('structureId', '==', structureId)
        ));
        
        const currentAssignments: { [key in DocumentType]?: string } = {};
        const currentGenerationTypes: { [key in DocumentType]?: 'template' | 'editor' } = {};
        assignmentsSnapshot.docs.forEach(doc => {
          const data = doc.data() as TemplateAssignment;
          if (allTemplates.some(template => template.id === data.templateId)) {
            currentAssignments[data.documentType] = data.templateId;
            currentGenerationTypes[data.documentType] = data.generationType || 'template';
          }
        });

        // Pour chaque type de document, si aucun template n'est assigné, chercher un template universel
        Object.entries(DOCUMENT_TYPES).forEach(([type, _]) => {
          if (!currentAssignments[type as DocumentType]) {
            const universalTemplate = universalTemplatesData.find(
              template => template.isUniversal && template.universalDocumentType === type
            );
            if (universalTemplate) {
              currentAssignments[type as DocumentType] = universalTemplate.id;
            }
          }
        });

        setAssignments(currentAssignments);
        setGenerationTypes(currentGenerationTypes);

        // Récupérer les templates par défaut existants
        const defaultTemplatesSnapshot = await getDocs(collection(db, 'defaultTemplateAssignments'));
        const defaultTemplatesData = defaultTemplatesSnapshot.docs.map(doc => ({
          documentType: doc.id as DocumentType,
          templateId: doc.data().templateId
        }));
        setDefaultTemplates(defaultTemplatesData);

      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        setSnackbar({
          open: true,
          message: 'Erreur lors du chargement des données',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  const handleAssignmentChange = (documentType: DocumentType, templateId: string) => {
    if (templateId && !templates.some(template => template.id === templateId)) {
      setSnackbar({
        open: true,
        message: 'Template invalide sélectionné',
        severity: 'error'
      });
      return;
    }

    setAssignments(prev => ({
      ...prev,
      [documentType]: templateId
    }));
  };

  const handleGenerationTypeChange = (documentType: DocumentType, generationType: 'template' | 'editor') => {
    setGenerationTypes(prev => ({
      ...prev,
      [documentType]: generationType
    }));
  };

  const handleDefaultTemplateChange = async (documentType: DocumentType, templateId: string) => {
    console.log('handleDefaultTemplateChange appelé avec:', { documentType, templateId, isSuperAdmin });
    if (!isSuperAdmin) return;

    try {
      const defaultTemplateRef = doc(db, 'defaultTemplateAssignments', documentType);
      
      if (templateId) {
        // Vérifier si le template est une LM universelle
        const templateDoc = await getDoc(doc(db, 'templates', templateId));
        const isUniversalLM = templateDoc.exists() && templateDoc.data().description === 'LM universelle';

        await setDoc(defaultTemplateRef, {
          documentType,
          templateId,
          isUniversalLM,
          updatedAt: new Date()
        });
      } else {
        await deleteDoc(defaultTemplateRef);
      }

      setDefaultTemplates(prev => {
        const filtered = prev.filter(dt => dt.documentType !== documentType);
        if (templateId) {
          return [...filtered, { documentType, templateId }];
        }
        return filtered;
      });

      setSnackbar({
        open: true,
        message: 'Template par défaut mis à jour avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du template par défaut:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour du template par défaut',
        severity: 'error'
      });
    }
  };

  const handleSave = async () => {
    if (!userStructureId) return;

    // Vérifier les permissions
    if (!canSave) {
      setSnackbar({
        open: true,
        message: 'Vous n\'avez pas les permissions nécessaires pour sauvegarder les assignations',
        severity: 'error'
      });
      return;
    }

    setSaving(true);
    try {
      const assignmentsSnapshot = await getDocs(query(
        collection(db, 'templateAssignments'),
        where('structureId', '==', userStructureId)
      ));
      
      const existingAssignments = new Map<string, string>();
      assignmentsSnapshot.docs.forEach(doc => {
        const data = doc.data() as TemplateAssignment;
        existingAssignments.set(data.documentType, doc.id);
      });

      let savedCount = 0;
      let deletedCount = 0;

      for (const [documentType, templateId] of Object.entries(assignments)) {
        if (!templateId) {
          if (existingAssignments.has(documentType)) {
            const assignmentId = existingAssignments.get(documentType);
            await deleteDoc(doc(db, 'templateAssignments', assignmentId!));
            deletedCount++;
          }
          continue;
        }

        const templateDoc = await getDoc(doc(db, 'templates', templateId));
        const templateData = templateDoc.data();
        const isUniversal = templateData?.isUniversal || false;
        const universalDocumentType = templateData?.universalDocumentType || null;

        const wasExisting = existingAssignments.has(documentType);
        if (wasExisting) {
          const assignmentId = existingAssignments.get(documentType);
          await deleteDoc(doc(db, 'templateAssignments', assignmentId!));
        }

        await setDoc(doc(db, 'templateAssignments', `${userStructureId}_${documentType}`), {
          structureId: userStructureId,
          documentType,
          templateId,
          isUniversal,
          universalDocumentType,
          generationType: generationTypes[documentType as DocumentType] || 'template',
          updatedAt: new Date()
        });
        
        savedCount++;
      }

      // Message de confirmation détaillé
      const messageParts = [];
      if (savedCount > 0) {
        messageParts.push(`${savedCount} assignation${savedCount > 1 ? 's' : ''} sauvegardée${savedCount > 1 ? 's' : ''}`);
      }
      if (deletedCount > 0) {
        messageParts.push(`${deletedCount} assignation${deletedCount > 1 ? 's' : ''} supprimée${deletedCount > 1 ? 's' : ''}`);
      }
      
      const message = messageParts.length > 0 
        ? `✅ ${messageParts.join(' et ')} avec succès !`
        : '✅ Assignations sauvegardées avec succès !';

      setSnackbar({
        open: true,
        message,
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setSnackbar({
        open: true,
        message: '❌ Erreur lors de la sauvegarde des assignations',
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUniversalStatusChange = async (templateId: string, isUniversal: boolean, documentType: DocumentType | null) => {
    if (!isSuperAdmin) return;

    try {
      await updateDoc(doc(db, 'templates', templateId), {
        isUniversal,
        universalDocumentType: isUniversal ? documentType : null,
        updatedAt: new Date()
      });

      // Mettre à jour le state local
      setTemplates(prev => prev.map(template => 
        template.id === templateId 
          ? { ...template, isUniversal, universalDocumentType: isUniversal ? documentType : null }
          : template
      ));

      setSnackbar({
        open: true,
        message: 'Statut universel mis à jour avec succès',
        severity: 'success'
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut universel:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour du statut universel',
        severity: 'error'
      });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography 
          variant="h4" 
          gutterBottom 
          sx={{ 
            fontWeight: 600,
            color: theme.palette.text.primary,
            mb: 4,
            letterSpacing: '-0.5px'
          }}
        >
          Assignation des Templates
        </Typography>
      </Box>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <CircularProgress size={40} />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {Object.entries(DOCUMENT_TYPES).map(([type, label]) => (
            <Grid item xs={12} md={6} key={type}>
              <Card 
                elevation={0}
                sx={{ 
                  borderRadius: '16px',
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  height: '100%',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                  }
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    mb: 2,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    pb: 1.5
                  }}>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        flexGrow: 1,
                        fontWeight: 500,
                        color: theme.palette.text.primary,
                        fontSize: '1rem'
                      }}
                    >
                      {label}
                    </Typography>
                    {isSuperAdmin && (
                      <Tooltip title="Template par défaut">
                        <StarIcon 
                          color={defaultTemplates.some(dt => dt.documentType === type) ? "primary" : "disabled"}
                          sx={{ 
                            mr: 1,
                            opacity: defaultTemplates.some(dt => dt.documentType === type) ? 1 : 0.5,
                            fontSize: '1.2rem'
                          }}
                        />
                      </Tooltip>
                    )}
                  </Box>
                  
                  {type === 'proposition_commerciale' && (
                    <Box sx={{ mb: 2 }}>
                      <FormControl fullWidth>
                        <InputLabel 
                          sx={{ 
                            color: theme.palette.text.secondary,
                            '&.Mui-focused': {
                              color: theme.palette.primary.main
                            }
                          }}
                        >
                          Type de génération
                        </InputLabel>
                        <Select
                          value={generationTypes[type as DocumentType] || 'template'}
                          onChange={(e) => handleGenerationTypeChange(type as DocumentType, e.target.value as 'template' | 'editor')}
                          label="Type de génération"
                          sx={{
                            borderRadius: '12px',
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: alpha(theme.palette.divider, 0.2)
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                              borderColor: alpha(theme.palette.primary.main, 0.5)
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: theme.palette.primary.main,
                              borderWidth: '1px'
                            }
                          }}
                        >
                          <MenuItem value="template">Template PDF</MenuItem>
                          <MenuItem value="editor">Éditeur</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  )}

                  <FormControl fullWidth>
                    <InputLabel 
                      sx={{ 
                        color: theme.palette.text.secondary,
                        '&.Mui-focused': {
                          color: theme.palette.primary.main
                        }
                      }}
                    >
                      Template
                    </InputLabel>
                    <Select
                      value={assignments[type as DocumentType] || ''}
                      onChange={(e) => handleAssignmentChange(type as DocumentType, e.target.value)}
                      label="Template"
                      disabled={type === 'proposition_commerciale' && generationTypes[type as DocumentType] === 'editor'}
                      sx={{
                        borderRadius: '12px',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: alpha(theme.palette.divider, 0.2)
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: alpha(theme.palette.primary.main, 0.5)
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: theme.palette.primary.main,
                          borderWidth: '1px'
                        }
                      }}
                    >
                      <MenuItem value="">
                        <em>Aucun</em>
                      </MenuItem>
                      {templates
                        .filter(template => 
                          template.structureId === userStructureId ||
                          (template.isUniversal && template.universalDocumentType === type)
                        )
                        .map((template) => (
                          <MenuItem 
                            key={template.id} 
                            value={template.id}
                            sx={{
                              borderRadius: '8px',
                              margin: '4px',
                              '&:hover': {
                                backgroundColor: alpha(theme.palette.primary.main, 0.08)
                              },
                              '&.Mui-selected': {
                                backgroundColor: alpha(theme.palette.primary.main, 0.12),
                                '&:hover': {
                                  backgroundColor: alpha(theme.palette.primary.main, 0.16)
                                }
                              }
                            }}
                          >
                            {template.name}
                            {template.isUniversal && (
                              <Typography 
                                component="span" 
                                sx={{ 
                                  ml: 1,
                                  color: theme.palette.primary.main,
                                  fontSize: '0.875rem',
                                  fontWeight: 500
                                }}
                              >
                                (Universel pour {DOCUMENT_TYPES[template.universalDocumentType as DocumentType]})
                              </Typography>
                            )}
                          </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {isSuperAdmin && assignments[type as DocumentType] && (
                    <Box sx={{ 
                      mt: 2, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2,
                      backgroundColor: alpha(theme.palette.background.default, 0.3),
                      p: 1.5,
                      borderRadius: '12px'
                    }}>
                      <FormControl>
                        <InputLabel 
                          sx={{ 
                            color: theme.palette.text.secondary,
                            '&.Mui-focused': {
                              color: theme.palette.primary.main
                            }
                          }}
                        >
                          Statut Universel
                        </InputLabel>
                        <Select
                          value={templates.find(t => t.id === assignments[type as DocumentType])?.isUniversal ? 'true' : 'false'}
                          onChange={(e) => handleUniversalStatusChange(
                            assignments[type as DocumentType]!,
                            e.target.value === 'true',
                            e.target.value === 'true' ? type as DocumentType : null
                          )}
                          label="Statut Universel"
                          sx={{
                            minWidth: '200px',
                            borderRadius: '12px',
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: alpha(theme.palette.divider, 0.2)
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                              borderColor: alpha(theme.palette.primary.main, 0.5)
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: theme.palette.primary.main,
                              borderWidth: '1px'
                            }
                          }}
                        >
                          <MenuItem value="false">Non universel</MenuItem>
                          <MenuItem value="true">Universel pour {label}</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {!canSave && (
        <Alert 
          severity="info" 
          sx={{ 
            mb: 3,
            borderRadius: '12px',
            '& .MuiAlert-icon': {
              alignItems: 'center'
            }
          }}
        >
          Seuls les administrateurs et super-administrateurs peuvent sauvegarder les assignations de templates.
        </Alert>
      )}

      <Box sx={{ 
        mt: 4, 
        display: 'flex', 
        justifyContent: 'flex-end',
        position: 'sticky',
        bottom: 24,
        backgroundColor: 'transparent',
        zIndex: 1
      }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={saving || !canSave}
          startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
          sx={{
            borderRadius: '12px',
            textTransform: 'none',
            fontWeight: 500,
            px: 4,
            py: 1.5,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            '&:hover': {
              boxShadow: canSave ? '0 6px 16px rgba(0,0,0,0.15)' : 'none'
            },
            '&:disabled': {
              opacity: 0.6
            }
          }}
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder les assignations'}
        </Button>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{
          zIndex: 9999,
          '& .MuiSnackbar-root': {
            zIndex: 9999
          }
        }}
      >
        <Alert 
          severity={snackbar.severity} 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          variant="filled"
          sx={{
            width: '100%',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            minWidth: '300px',
            zIndex: 9999,
            '& .MuiAlert-icon': {
              alignItems: 'center'
            }
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TemplateAssignmentComponent; 