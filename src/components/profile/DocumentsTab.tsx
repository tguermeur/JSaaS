import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Alert
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';
import { UserData } from '../../types/user';
import { uploadCV } from '../../firebase/storage';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { updateUserDocument } from '../../firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from 'notistack';
import DocumentDisclaimer from '../DocumentDisclaimer'; // Assumant que ce composant existe au niveau parent

interface DocumentsTabProps {
  userData: UserData;
  onUpdate: () => void;
}

const DocumentsTab: React.FC<DocumentsTabProps> = ({ userData, onUpdate }) => {
  const { currentUser } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [uploading, setUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0] || !currentUser) return;
    
    const file = event.target.files[0];
    
    // Validation simple
    if (file.size > 5 * 1024 * 1024) {
      enqueueSnackbar('Le fichier est trop volumineux (max 5Mo)', { variant: 'error' });
      return;
    }
    
    if (file.type !== 'application/pdf') {
      enqueueSnackbar('Seuls les fichiers PDF sont acceptés', { variant: 'error' });
      return;
    }

    setUploading(true);
    try {
      const cvUrl = await uploadCV(currentUser.uid, file);
      await updateUserDocument(currentUser.uid, { cvUrl });
      onUpdate();
      enqueueSnackbar('CV téléversé avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur upload CV:', error);
      enqueueSnackbar('Erreur lors du téléversement du CV', { variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleViewCV = async () => {
    if (!userData.cvUrl) return;

    try {
        // Extraire le chemin du fichier depuis l'URL Firebase Storage
        // Format: https://firebasestorage.googleapis.com/v0/b/[bucket]/o/[path]?alt=media&token=...
        let path = '';
        try {
            const urlObj = new URL(userData.cvUrl);
            const pathStartIndex = urlObj.pathname.indexOf('/o/') + 3;
            if (pathStartIndex > 2) {
                const encodedPath = urlObj.pathname.substring(pathStartIndex);
                path = decodeURIComponent(encodedPath);
            }
        } catch (e) {
            console.error("Erreur parsing URL CV", e);
        }

        if (path) {
            const storage = getStorage(); 
            const cvRef = ref(storage, path);
            const url = await getDownloadURL(cvRef);
            window.open(url, '_blank');
        } else {
            // Fallback
            window.open(userData.cvUrl, '_blank');
        }
    } catch (error: any) {
        console.error("Erreur lors de l'ouverture du CV:", error);
        
        if (error.code === 'storage/object-not-found') {
            enqueueSnackbar("Le fichier n'existe plus. Suppression de la référence...", { variant: 'warning' });
            try {
                if (currentUser) {
                    await updateUserDocument(currentUser.uid, { cvUrl: null });
                    onUpdate();
                }
            } catch (e) {
                console.error("Erreur nettoyage profil:", e);
            }
        } else {
            // Si erreur autre (ex: 403 malgré tout), on tente l'URL d'origine en dernier recours
            window.open(userData.cvUrl, '_blank');
        }
    }
  };

  const handleDeleteCV = async () => {
    if (!currentUser) return;
    
    try {
      // Note: La suppression réelle du fichier dans Storage devrait être gérée ici ou via une Cloud Function
      // Ici on supprime juste la référence
      await updateUserDocument(currentUser.uid, { cvUrl: null }); // ou deleteField()
      onUpdate();
      enqueueSnackbar('CV supprimé', { variant: 'success' });
    } catch (error) {
      console.error('Erreur suppression CV:', error);
      enqueueSnackbar('Erreur lors de la suppression', { variant: 'error' });
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  return (
    <Box>
      <DocumentDisclaimer />
      
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', height: '100%' }}>
            <DescriptionIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Mon CV
            </Typography>
            
            {userData.cvUrl ? (
              <Box sx={{ mt: 2 }}>
                <Alert severity="success" sx={{ mb: 2 }}>
                  CV enregistré
                </Alert>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<VisibilityIcon />}
                    onClick={handleViewCV}
                  >
                    Voir
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    Supprimer
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ mt: 2 }}>
                 <Typography variant="body2" color="text.secondary" paragraph>
                  Aucun CV téléversé. Veuillez ajouter votre CV au format PDF.
                </Typography>
                <Button
                  component="label"
                  variant="contained"
                  startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
                  disabled={uploading}
                >
                  Téléverser mon CV
                  <input
                    type="file"
                    hidden
                    accept="application/pdf"
                    onChange={handleFileChange}
                  />
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>
        
        {/* Espace pour d'autres documents futurs */}
        <Grid item xs={12} md={6}>
           <Paper variant="outlined" sx={{ p: 3, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f8f9fa' }}>
             <Typography color="text.secondary">
               D'autres documents pourront être ajoutés ici (Carte d'identité, RIB, etc.)
             </Typography>
           </Paper>
        </Grid>
      </Grid>

      {/* Dialogue de confirmation suppression */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Supprimer le CV ?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Êtes-vous sûr de vouloir supprimer votre CV ? Cette action est irréversible.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleDeleteCV} color="error" variant="contained" autoFocus>
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DocumentsTab;

