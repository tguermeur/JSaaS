import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  alpha,
  useTheme
} from '@mui/material';
import { Save as SaveIcon, Star as StarIcon } from '@mui/icons-material';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { DocumentType, DOCUMENT_TYPES, TemplateAssignment } from '../../types/templates';
import { tokens } from '../../theme/tokens';
import { settingsPageStyles, SettingsPanel, SegmentedControl } from '../../components/ds';

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
  const [structureType, setStructureType] = useState<'jobservice' | 'junior' | null>(null);
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

        // Récupérer le structureType de la structure
        if (structureId) {
          const structureDocRef = doc(db, 'structures', structureId);
          const structureDocSnap = await getDoc(structureDocRef);
          if (structureDocSnap.exists()) {
            const structureData = structureDocSnap.data();
            setStructureType(structureData.structureType || 'jobservice');
          }
        }

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
    <Box>
      <Box component="header" sx={{ ...settingsPageStyles.header, px: 0, py: 0, bgcolor: 'transparent', borderBottom: 'none', mb: 3 }}>
        <Box>
          <Typography sx={settingsPageStyles.eyebrow}>Paramètres</Typography>
          <Typography component="h1" sx={settingsPageStyles.title}>Assignation des templates</Typography>
          <Typography sx={settingsPageStyles.sub}>
            Associez un modèle PDF à chaque type de document
          </Typography>
        </Box>
      </Box>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <CircularProgress size={40} />
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 3,
            alignItems: 'stretch',
            gridAutoRows: '1fr',
          }}
        >
          {Object.entries(DOCUMENT_TYPES)
            .filter(([type]) => {
              // Filtrer selon le structureType
              if (!structureType) return true; // Afficher tout si structureType non chargé
              
              if (structureType === 'junior') {
                // Pour les JE, afficher uniquement les types spécifiques
                return [
                  'proposition_commerciale',
                  'convention_etude',
                  'recapitulatif_mission',
                  'avenant_convention',
                  'proces_verbal_recette',
                  'facture'
                ].includes(type);
              } else {
                // Pour les JS, afficher les types classiques (exclure les types spécifiques JE)
                return ![
                  'recapitulatif_mission',
                  'convention_etude',
                  'proces_verbal_recette',
                  'rapport_pedagogique',
                  'avenant_convention'
                ].includes(type);
              }
            })
            .map(([type, label]) => (
            <SettingsPanel
                key={type}
                title={label}
                sx={{ height: '100%', minHeight: 0 }}
                action={isSuperAdmin ? (
                  <Tooltip title="Template par défaut">
                    <StarIcon
                      color={defaultTemplates.some((dt) => dt.documentType === type) ? 'primary' : 'disabled'}
                      sx={{
                        opacity: defaultTemplates.some((dt) => dt.documentType === type) ? 1 : 0.5,
                        fontSize: '1.2rem',
                      }}
                    />
                  </Tooltip>
                ) : undefined}
              >
                  {type === 'proposition_commerciale' ? (
                    <Box sx={{ mb: 2 }}>
                      <SegmentedControl
                        value={generationTypes[type as DocumentType] || 'template'}
                        onChange={(v) =>
                          handleGenerationTypeChange(type as DocumentType, v as 'template' | 'editor')
                        }
                        options={[
                          { value: 'template', label: 'Template PDF' },
                          { value: 'editor', label: 'Éditeur' },
                        ]}
                      />
                    </Box>
                  ) : (
                    <Box sx={{ mb: 2, minHeight: 40 }} aria-hidden />
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
                        borderRadius: tokens.radius.md,
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
                      {(() => {
                        const filtered = templates.filter(template => 
                          template.structureId === userStructureId ||
                          (template.isUniversal && template.universalDocumentType === type)
                        );
                        const seenIds = new Set<string>();
                        const deduped = filtered.filter(t => {
                          if (seenIds.has(t.id)) return false;
                          seenIds.add(t.id);
                          return true;
                        });
                        return deduped.map((template) => (
                          <MenuItem 
                            key={`${type}-${template.id}`}
                            value={template.id}
                            sx={{
                              borderRadius: tokens.radius.sm,
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
                        ));
                      })()}
                    </Select>
                  </FormControl>

                  {isSuperAdmin && assignments[type as DocumentType] && (
                    <Box sx={{ 
                      mt: 'auto',
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2,
                      backgroundColor: alpha(theme.palette.background.default, 0.3),
                      p: 1.5,
                      borderRadius: tokens.radius.md
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
                            borderRadius: tokens.radius.md,
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
              </SettingsPanel>
          ))}
        </Box>
      )}

      {!canSave && (
        <Alert 
          severity="info" 
          sx={{ 
            mb: 3,
            borderRadius: tokens.radius.md,
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
            borderRadius: tokens.radius.md,
            textTransform: 'none',
            fontWeight: 500,
            px: 4,
            py: 1.5,
            bgcolor: tokens.colors.brandTeal,
            boxShadow: tokens.shadows.button,
            '&:hover': {
              bgcolor: tokens.colors.brandTeal700,
              boxShadow: canSave ? tokens.shadows.md : 'none',
            },
            '&:disabled': {
              opacity: 0.6
            }
          }}
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder les assignations'}
        </Button>
      </Box>

      {createPortal(
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          sx={{ zIndex: 10000 }}
        >
          <Alert 
            severity={snackbar.severity} 
            onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
            variant="filled"
            sx={{
              width: '100%',
              borderRadius: tokens.radius.md,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              minWidth: '300px',
              '& .MuiAlert-icon': {
                alignItems: 'center'
              }
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>,
        document.body
      )}
    </Box>
  );
};

export default TemplateAssignmentComponent; 