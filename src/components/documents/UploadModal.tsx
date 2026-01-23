import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { uploadFile } from '../../firebase/storage';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { getAuth } from 'firebase/auth';
import { Document } from '../../types/document';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  structureId: string;
  parentFolderId: string | null;
  currentUserId: string;
  onUploadSuccess: () => void;
}

const UploadModal: React.FC<UploadModalProps> = ({
  open,
  onClose,
  structureId,
  parentFolderId,
  currentUserId,
  onUploadSuccess,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    noClick: false,
  });

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Veuillez sélectionner au moins un fichier');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // #region agent log
      console.log('[DEBUG] UploadModal.tsx:60 - handleUpload started', {currentUserId,structureId,fileCount:files.length,hypothesisId:'A'});
      // #endregion
      
      // Récupérer le nom de l'utilisateur pour l'affichage
      const userDoc = await getDoc(doc(db, 'users', currentUserId));
      const userData = userDoc.data();
      const uploadedByName = userData?.displayName || userData?.firstName + ' ' + userData?.lastName || 'Inconnu';

      // #region agent log
      console.log('[DEBUG] UploadModal.tsx:73 - User data retrieved', {userId:currentUserId,structureId:userData?.structureId,status:userData?.status,expectedStructureId:structureId,hypothesisId:'B'});
      // #endregion

      // #region agent log
      const auth = getAuth();
      const firebaseUser = auth.currentUser;
      const token = firebaseUser ? await firebaseUser.getIdToken().catch(()=>null) : null;
      console.log('[DEBUG] UploadModal.tsx:78 - Auth token check', {hasUser:!!firebaseUser,userId:firebaseUser?.uid,hasToken:!!token,tokenLength:token?.length,hypothesisId:'A'});
      // #endregion

      const totalFiles = files.length;
      let uploadedCount = 0;

      for (const file of files) {
        // Générer un ID unique pour le fichier
        const fileId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const storagePath = `structures/${structureId}/documents/${fileId}`;
        
        try {
          // #region agent log
          console.log('[DEBUG] UploadModal.tsx:87 - Before uploadFile call', {storagePath,fileSize:file.size,fileName:file.name,fileId,hypothesisId:'A'});
          // #endregion

          // Uploader le fichier
          const uploadResult = await uploadFile(file, storagePath);

          // Créer le document dans Firestore
          const documentData: Omit<Document, 'id'> = {
            name: file.name,
            size: file.size,
            type: file.type,
            url: uploadResult.url,
            storagePath: uploadResult.path,
            parentFolderId,
            uploadedBy: currentUserId,
            uploadedByName,
            createdAt: serverTimestamp() as any,
            structureId,
            isRestricted: false,
          };

          await addDoc(
            collection(db, 'structures', structureId, 'documents'),
            documentData
          );

          uploadedCount++;
          setUploadProgress((uploadedCount / totalFiles) * 100);
        } catch (fileError: any) {
          // #region agent log
          console.log('[DEBUG] UploadModal.tsx:111 - Upload error caught', {errorCode:fileError.code,errorMessage:fileError.message,errorDetails:fileError,storagePath,fileId,fileName:file.name,hypothesisId:'A'});
          // #endregion
          console.error(`Erreur lors de l'upload de ${file.name}:`, fileError);
          setError(`Erreur lors de l'upload de ${file.name}: ${fileError.message}`);
        }
      }

      if (uploadedCount === totalFiles) {
        setFiles([]);
        onUploadSuccess();
        onClose();
      }
    } catch (error: any) {
      console.error('Erreur lors de l\'upload:', error);
      setError(error.message || 'Une erreur est survenue lors de l\'upload');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFiles([]);
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Téléverser des fichiers</Typography>
          <Button
            onClick={handleClose}
            disabled={uploading}
            sx={{ minWidth: 'auto', p: 1 }}
          >
            <CloseIcon />
          </Button>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Box
            {...getRootProps()}
            sx={{
              border: '2px dashed',
              borderColor: isDragActive ? 'primary.main' : 'grey.300',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: 'action.hover',
              },
            }}
          >
            <input {...getInputProps()} />
            <CloudUploadIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
            <Typography variant="body1" sx={{ mb: 1 }}>
              {isDragActive
                ? 'Déposez les fichiers ici'
                : 'Glissez-déposez des fichiers ici ou cliquez pour sélectionner'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Taille maximale: 100MB par fichier
            </Typography>
          </Box>
        </Box>

        {files.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Fichiers sélectionnés ({files.length})
            </Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {files.map((file, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 1,
                    mb: 0.5,
                    backgroundColor: 'grey.50',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ flex: 1, mr: 1 }}>
                    {file.name}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => handleRemoveFile(index)}
                    disabled={uploading}
                    sx={{ minWidth: 'auto', p: 0.5 }}
                  >
                    <CloseIcon fontSize="small" />
                  </Button>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {uploading && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Téléversement en cours...
            </Typography>
            <LinearProgress variant="determinate" value={uploadProgress} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              {Math.round(uploadProgress)}%
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          Annuler
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={files.length === 0 || uploading}
          startIcon={<CloudUploadIcon />}
        >
          Téléverser
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UploadModal;

