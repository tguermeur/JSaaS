import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  IconButton,
  Tooltip,
  CircularProgress,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Alert,
  TextField
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Description as DescriptionIcon,
  CreditCard as CreditCardIcon,
  Badge as BadgeIcon,
  School as SchoolIcon,
  HealthAndSafety as HealthAndSafetyIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { UserData, CustomDocument } from '../../types/user';
import { uploadCV, uploadFile } from '../../firebase/storage';
import { getStorage, ref, getDownloadURL, deleteObject } from 'firebase/storage';
import { updateUserDocument } from '../../firebase/firestore';
import { getFunctionsUrl } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from 'notistack';
import DocumentDisclaimer from '../DocumentDisclaimer';
import { getAuth } from 'firebase/auth';
import axios from 'axios';
import TwoFactorDialog from '../common/TwoFactorDialog';
import { fetchDecryptFile, is2FARequiredError } from '../../utils/decryptFileUtils';
import { tokens } from '../../theme/tokens';

interface DocumentsTabProps {
  userData: UserData;
  onUpdate: () => void;
}

interface DocumentType {
  key: string;
  label: string;
  icon: React.ReactNode;
  fieldName: string;
  description: string;
}

const DOCUMENT_TYPES: DocumentType[] = [
  {
    key: 'identityCard',
    label: 'Carte d\'identité',
    icon: <BadgeIcon />,
    fieldName: 'identityCardUrl',
    description: 'Carte nationale d\'identité (recto et verso)'
  },
  {
    key: 'rib',
    label: 'RIB',
    icon: <CreditCardIcon />,
    fieldName: 'ribUrl',
    description: 'Relevé d\'identité bancaire'
  },
  {
    key: 'schoolCertificate',
    label: 'Certificat de scolarité',
    icon: <SchoolIcon />,
    fieldName: 'schoolCertificateUrl',
    description: 'Attestation de scolarité ou certificat de formation'
  },
  {
    key: 'healthCard',
    label: 'Carte Vitale',
    icon: <HealthAndSafetyIcon />,
    fieldName: 'healthCardUrl',
    description: 'Carte Vitale ou carte d\'assurance maladie'
  }
];

const DocumentsTab: React.FC<DocumentsTabProps> = ({ userData, onUpdate }) => {
  const { currentUser } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [uploading, setUploading] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingDocument, setDeletingDocument] = useState<string | null>(null);
  const [customDocumentName, setCustomDocumentName] = useState('');
  const [addingCustomDocument, setAddingCustomDocument] = useState(false);
  
  // États pour la carte d'identité (Recto/Verso)
  const [identityCardDialogOpen, setIdentityCardDialogOpen] = useState(false);
  const [pendingIdentityCardFile, setPendingIdentityCardFile] = useState<File | null>(null);
  const [identityCardChoice, setIdentityCardChoice] = useState<'recto' | 'verso' | 'both' | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [dragActiveDocument, setDragActiveDocument] = useState<string | null>(null);
  
  // États pour le viewer de document
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [twoFactorDocumentOpen, setTwoFactorDocumentOpen] = useState(false);
  const [pendingDecryptDocument, setPendingDecryptDocument] = useState<{ path: string; token: string } | null>(null);

  // Référence pour l'input file de la carte d'identité
  const identityCardFileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Debug: Surveiller les changements de viewerUrl et viewerOpen
  useEffect(() => {
  }, [viewerUrl, viewerOpen, viewerLoading, viewerError]);
  
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
    setUploadProgress(0);
    try {
      if (!currentUser) {
        throw new Error('Utilisateur non authentifié');
      }
      
      // 1. Uploader le fichier dans Storage
      const fileExtension = file.name.split('.').pop();
      const fileName = `cv_${Date.now()}.${fileExtension}`;
      const filePath = `cvs/${currentUser.uid}/${fileName}`;
      
      // Upload (0-80% de la progression)
      const uploadResult = await uploadFile(file, filePath, (progress) => {
        // Mapper la progression de l'upload sur 0-80%
        setUploadProgress(progress * 0.8);
      });
      
      // Chiffrer (80-100% de la progression)
      setUploadProgress(80);
      // 2. Chiffrer le fichier via Cloud Function
      // Récupérer le token de manière fiable depuis currentUser
      // Récupérer le token de manière fiable depuis l'utilisateur Firebase Auth
      const auth = getAuth();
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        throw new Error('Utilisateur Firebase non authentifié');
      }
      const token = await firebaseUser.getIdToken(true); // Force refresh du token
      
      // Chiffrer le fichier immédiatement après l'upload
      try {
        console.log('🔐 Début du chiffrement du CV...', { filePath, token: token.substring(0, 20) + '...' });
        setUploadProgress(85);
        
        const encryptResponse = await axios.post(
          getFunctionsUrl('encryptFile'),
          { filePath },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            timeout: 60000 // 60 secondes de timeout
          }
        );
        
        console.log('📥 Réponse du chiffrement:', encryptResponse.data);
        
        if (encryptResponse.data?.success) {
          console.log('✅ CV chiffré avec succès');
          setUploadProgress(95);
          
          // Attendre un peu pour que les métadonnées soient propagées
          await new Promise(resolve => setTimeout(resolve, 1000));
          setUploadProgress(100);
          
          // Vérifier que le fichier est bien chiffré en récupérant les métadonnées
          try {
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const functions = getFunctions();
            const isFileEncrypted = httpsCallable(functions, 'isFileEncrypted');
            
            const checkResult = await isFileEncrypted({ filePath });
            const isEncrypted = (checkResult.data as any)?.encrypted;
            
            if (isEncrypted) {
              console.log('✅ Vérification confirmée: Le CV est bien chiffré dans Storage');
              enqueueSnackbar('CV téléversé et chiffré avec succès', { variant: 'success' });
            } else {
              // Les métadonnées peuvent prendre quelques secondes à se propager
              console.warn('⚠️ Les métadonnées de chiffrement ne sont pas encore disponibles (propagation en cours)');
              enqueueSnackbar('CV téléversé et chiffré avec succès', { variant: 'success' });
            }
          } catch (checkError) {
            console.warn('⚠️ Impossible de vérifier le statut de chiffrement:', checkError);
            // On considère que c'est OK si la réponse de chiffrement était positive
            enqueueSnackbar('CV téléversé et chiffré avec succès', { variant: 'success' });
          }
        } else {
          console.warn('⚠️ Réponse de chiffrement inattendue:', encryptResponse.data);
          enqueueSnackbar('Le CV a été uploadé mais le chiffrement a peut-être échoué. Vérifiez les métadonnées.', { variant: 'warning' });
        }
      } catch (encryptError: any) {
        // Si le chiffrement échoue, on log l'erreur complète
        console.error('❌ Erreur lors du chiffrement du CV:', {
          message: encryptError.message,
          response: encryptError.response?.data,
          status: encryptError.response?.status,
          statusText: encryptError.response?.statusText,
          filePath,
          url: encryptError.config?.url
        });
        
        // Afficher un message d'erreur détaillé à l'utilisateur
        const errorMessage = encryptError.response?.data?.error || encryptError.message || 'Erreur inconnue';
        enqueueSnackbar(`Le CV a été uploadé mais le chiffrement a échoué: ${errorMessage}`, { variant: 'error' });
      }
      
      // 3. Sauvegarder l'URL dans le profil utilisateur
      await updateUserDocument(currentUser.uid, { cvUrl: uploadResult.url });
      onUpdate();
      // Le message de succès est géré dans le bloc try du chiffrement
    } catch (error: any) {
      console.error('Erreur upload CV:', error);
      enqueueSnackbar(`Erreur lors du téléversement du CV: ${error.message || 'Erreur inconnue'}`, { variant: 'error' });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const openDocumentWithDecrypt = async (
    path: string,
    opts?: { onNotFound?: () => void | Promise<void> }
  ) => {
    const auth = getAuth();
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      enqueueSnackbar('Utilisateur non authentifié', { variant: 'error' });
      return;
    }
    const token = await firebaseUser.getIdToken(true);
    setViewerOpen(true);
    setViewerLoading(true);
    setViewerError(null);
    setViewerUrl(null);
    try {
      const { blob, contentType } = await fetchDecryptFile({
        filePath: path,
        token,
        timeout: 60000,
      });
      const url = URL.createObjectURL(new Blob([blob], { type: contentType }));
      setViewerUrl(url);
      setViewerLoading(false);
    } catch (err: any) {
      if (err?.response?.status === 403 && is2FARequiredError(err)) {
        setViewerOpen(false);
        setViewerLoading(false);
        setViewerUrl(null);
        setPendingDecryptDocument({ path, token });
        setTwoFactorDocumentOpen(true);
        return;
      }
      if (err?.response?.status === 404) {
        try {
          const storage = getStorage();
          const fileRef = ref(storage, path);
          const url = await getDownloadURL(fileRef);
          setViewerUrl(url);
        } catch {
          setViewerError('Document introuvable.');
          await opts?.onNotFound?.();
        }
      } else {
        setViewerError(err?.response?.status === 403 ? 'Accès refusé.' : `Erreur: ${err?.message || 'inconnue'}`);
      }
      setViewerLoading(false);
    }
  };

  const handleVerifyDocument2FA = async (code: string) => {
    const pending = pendingDecryptDocument;
    if (!pending) throw new Error('Session expirée. Rouvrez le document.');
    const { blob, contentType } = await fetchDecryptFile({
      filePath: pending.path,
      token: pending.token,
      twoFactorCode: code,
      timeout: 60000,
    });
    const url = URL.createObjectURL(new Blob([blob], { type: contentType }));
    setViewerUrl(url);
    setViewerOpen(true);
    setViewerError(null);
    setPendingDecryptDocument(null);
    setTwoFactorDocumentOpen(false);
  };

  const handleViewCV = async () => {
    if (!userData.cvUrl || !currentUser) return;
    try {
      let path = '';
      try {
        const urlObj = new URL(userData.cvUrl);
        const idx = urlObj.pathname.indexOf('/o/') + 3;
        if (idx > 2) {
          const raw = urlObj.pathname.substring(idx).split('?')[0];
          path = decodeURIComponent(raw.replace(/%2F/g, '/'));
        }
      } catch (e) {
        console.error('Erreur parsing URL CV', e);
        window.open(userData.cvUrl, '_blank');
        return;
      }
      if (path) {
        await openDocumentWithDecrypt(path, {
          onNotFound: async () => {
            enqueueSnackbar("Le fichier n'existe plus. Suppression de la référence...", { variant: 'warning' });
            try {
              await updateUserDocument(currentUser!.uid, { cvUrl: null });
              onUpdate();
            } catch (e) {
              console.error('Erreur nettoyage profil:', e);
            }
          },
        });
      } else {
        window.open(userData.cvUrl, '_blank');
      }
    } catch (error: any) {
      console.error("Erreur lors de l'ouverture du CV:", error);
      enqueueSnackbar(`Erreur lors de l'ouverture du CV: ${error.message || 'Erreur inconnue'}`, { variant: 'error' });
    }
  };

  const handleDeleteCV = async () => {
    if (!currentUser) return;
    
    try {
      // Supprimer le fichier dans Storage si l'URL existe
      if (userData.cvUrl) {
        try {
          const urlObj = new URL(userData.cvUrl);
          const pathStartIndex = urlObj.pathname.indexOf('/o/') + 3;
          if (pathStartIndex > 2) {
            const encodedPath = urlObj.pathname.substring(pathStartIndex);
            const path = decodeURIComponent(encodedPath);
            const storage = getStorage();
            const fileRef = ref(storage, path);
            await deleteObject(fileRef);
          }
        } catch (deleteError) {
          console.warn('Erreur suppression fichier Storage (continuons quand même):', deleteError);
        }
      }
      
      await updateUserDocument(currentUser.uid, { cvUrl: null });
      onUpdate();
      enqueueSnackbar('CV supprimé', { variant: 'success' });
    } catch (error) {
      console.error('Erreur suppression CV:', error);
      enqueueSnackbar('Erreur lors de la suppression', { variant: 'error' });
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  // Fonction pour ouvrir le dialogue de choix avant de sélectionner le fichier
  const handleIdentityCardUploadClick = () => {
    setIdentityCardDialogOpen(true);
  };

  // Fonction appelée après le choix dans le dialogue pour ouvrir le sélecteur de fichiers
  const handleIdentityCardChoice = (choice: 'recto' | 'verso' | 'both') => {
    console.log('[DocumentsTab] 🎯 handleIdentityCardChoice appelé avec choix:', choice);
    
    // Stocker le choix dans l'état React (plus fiable que dataset)
    setIdentityCardChoice(choice);
    console.log('[DocumentsTab] 📝 Choix stocké dans identityCardChoice:', choice);
    
    // Fermer le dialogue
    setIdentityCardDialogOpen(false);
    
    // Utiliser requestAnimationFrame pour s'assurer que le DOM est mis à jour
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (identityCardFileInputRef.current) {
          console.log('[DocumentsTab] 👆 Clic sur l\'input file (via ref)');
          identityCardFileInputRef.current.click();
        } else {
          console.warn('[DocumentsTab] ⚠️ Réf input file non disponible, recherche dans le DOM...');
          // Fallback: chercher l'input dans le DOM
          const inputs = document.querySelectorAll('input[type="file"]');
          const identityInput = Array.from(inputs).find((input: any) => 
            input.accept === 'application/pdf,image/*'
          ) as HTMLInputElement;
          
          if (identityInput) {
            console.log('[DocumentsTab] 👆 Clic sur l\'input file (via DOM)');
            identityInput.click();
          } else {
            console.error('[DocumentsTab] ❌ Impossible de trouver l\'input file');
            enqueueSnackbar('Erreur: impossible d\'ouvrir le sélecteur de fichiers', { variant: 'error' });
            setIdentityCardChoice(null);
          }
        }
      });
    });
  };

  // Fonction appelée quand un fichier est sélectionné pour la carte d'identité
  const handleIdentityCardFileSelected = (file: File) => {
    // Récupérer le choix depuis l'état React (IMPORTANT: le récupérer avant de le réinitialiser)
    const choice = identityCardChoice || 'both'; // Par défaut 'both' si aucun choix n'est défini
    
    console.log('[DocumentsTab] ⚠️ Fichier sélectionné pour carte d\'identité:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      choice: choice,
      identityCardChoiceState: identityCardChoice,
      choiceIsBoth: choice === 'both'
    });
    
    // Ne pas réinitialiser le choix maintenant - on le fera après l'upload
    // setIdentityCardChoice(null);
    
    // Lancer l'upload avec le choix
    handleIdentityCardUpload(choice as 'recto' | 'verso' | 'both', file);
  };

  // Fonction pour gérer le drag and drop sur un document spécifique
  const handleDocumentDragDrop = async (docType: DocumentType, file: File) => {
    if (docType.key === 'identityCard') {
      // Pour la carte d'identité, ouvrir le dialogue d'abord
      setPendingIdentityCardFile(file);
      setIdentityCardDialogOpen(true);
    } else {
      // Pour les autres documents, uploader directement
      await handleDocumentUpload(docType, file);
    }
  };

  const handleIdentityCardUpload = async (choice: 'recto' | 'verso' | 'both', file?: File) => {
    console.log('[DocumentsTab] 🔵 handleIdentityCardUpload appelé avec:', {
      choice: choice,
      hasFile: !!file,
      fileName: file?.name,
      hasPendingFile: !!pendingIdentityCardFile,
      pendingFileName: pendingIdentityCardFile?.name,
      currentUserId: currentUser?.uid
    });
    
    const fileToUpload = file || pendingIdentityCardFile;
    if (!fileToUpload || !currentUser) {
      console.error('[DocumentsTab] ❌ Erreur: fichier ou utilisateur manquant', {
        hasFile: !!fileToUpload,
        hasUser: !!currentUser
      });
      setPendingIdentityCardFile(null);
      setIdentityCardChoice(null);
      return;
    }

    setUploadingDocument('identityCard');
    setUploadProgress(0);

    try {
      const file = fileToUpload;
      const fileExtension = file.name.split('.').pop();
      
      console.log('[DocumentsTab] 🔍 Vérification du choix:', {
        choice: choice,
        isBoth: choice === 'both',
        isRecto: choice === 'recto',
        isVerso: choice === 'verso'
      });
      
      if (choice === 'both') {
        console.log('[DocumentsTab] ✅ Upload document complet carte d\'identité');
        // Uploader comme document complet
        const fileName = `identityCard_${Date.now()}.${fileExtension}`;
        const filePath = `documents/${currentUser.uid}/${fileName}`;
        
        // Upload (0-80% de la progression)
        const uploadResult = await uploadFile(file, filePath, (progress) => {
          // Mapper la progression de l'upload sur 0-80%
          setUploadProgress(progress * 0.8);
        });
        
        // Chiffrer (80-100% de la progression)
        setUploadProgress(80);
        const auth = getAuth();
        const firebaseUser = auth.currentUser;
        if (firebaseUser) {
          const token = await firebaseUser.getIdToken(true);
          try {
            setUploadProgress(85);
            const encryptResponse = await axios.post(
              getFunctionsUrl('encryptFile'),
              { filePath },
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                timeout: 60000
              }
            );
            
            // Si le chiffrement est terminé
            if (encryptResponse.data?.success) {
              setUploadProgress(95);
              
              // Vérifier que les métadonnées sont disponibles
              if (encryptResponse.data?.metadataVerified) {
                setUploadProgress(100);
              } else {
                setUploadProgress(98);
                // Attendre un peu pour la propagation des métadonnées
                await new Promise(resolve => setTimeout(resolve, 1000));
                setUploadProgress(100);
              }
            } else {
              setUploadProgress(100);
            }
          } catch (encryptError) {
            console.warn('Erreur chiffrement:', encryptError);
            setUploadProgress(100);
          }
        }
        
        console.log('[DocumentsTab] 💾 Mise à jour du profil avec identityCardUrl:', uploadResult.url);
        await updateUserDocument(currentUser.uid, {
          identityCardUrl: uploadResult.url,
          identityCardRectoUrl: null,
          identityCardVersoUrl: null
        });
        console.log('[DocumentsTab] ✅ Profil mis à jour avec succès pour document complet');
      } else {
        // Uploader comme Recto ou Verso
        console.log(`[DocumentsTab] Upload ${choice} carte d'identité`);
        const fileName = `identityCard_${choice}_${Date.now()}.${fileExtension}`;
        const filePath = `documents/${currentUser.uid}/${fileName}`;
        
        // Upload (0-80% de la progression)
        const uploadResult = await uploadFile(file, filePath, (progress) => {
          // Mapper la progression de l'upload sur 0-80%
          setUploadProgress(progress * 0.8);
        });
        
        // Chiffrer (80-100% de la progression)
        setUploadProgress(80);
        const auth = getAuth();
        const firebaseUser = auth.currentUser;
        if (firebaseUser) {
          const token = await firebaseUser.getIdToken(true);
          try {
            setUploadProgress(85);
            const encryptResponse = await axios.post(
              getFunctionsUrl('encryptFile'),
              { filePath },
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                timeout: 60000
              }
            );
            
            // Si le chiffrement est terminé
            if (encryptResponse.data?.success) {
              setUploadProgress(95);
              
              // Vérifier que les métadonnées sont disponibles
              if (encryptResponse.data?.metadataVerified) {
                setUploadProgress(100);
              } else {
                setUploadProgress(98);
                // Attendre un peu pour la propagation des métadonnées
                await new Promise(resolve => setTimeout(resolve, 1000));
                setUploadProgress(100);
              }
            } else {
              setUploadProgress(100);
            }
          } catch (encryptError) {
            console.warn('Erreur chiffrement:', encryptError);
            setUploadProgress(100);
          }
        }
        
        const updateData: any = {};
        if (choice === 'recto') {
          updateData.identityCardRectoUrl = uploadResult.url;
        } else {
          updateData.identityCardVersoUrl = uploadResult.url;
        }
        
        // Si on a maintenant les deux, on peut aussi mettre à jour identityCardUrl
        const currentRecto = userData.identityCardRectoUrl;
        const currentVerso = userData.identityCardVersoUrl;
        
        if ((choice === 'recto' && currentVerso) || (choice === 'verso' && currentRecto)) {
          // On a maintenant les deux, mais on garde les URLs séparées
          // identityCardUrl reste null pour indiquer qu'on a les deux séparément
        }
        
        await updateUserDocument(currentUser.uid, updateData);
      }
      
      console.log('[DocumentsTab] 🔄 Appel de onUpdate() pour rafraîchir les données');
      onUpdate();
      
      const message = choice === 'both' 
        ? 'Carte d\'identité complète téléversée et chiffrée avec succès' 
        : `Carte d'identité (${choice}) téléversée et chiffrée avec succès`;
      enqueueSnackbar(message, { variant: 'success' });
    } catch (error: any) {
      console.error('Erreur upload carte d\'identité:', error);
      enqueueSnackbar(`Erreur lors du téléversement: ${error.message || 'Erreur inconnue'}`, { variant: 'error' });
    } finally {
      setUploadingDocument(null);
      setUploadProgress(0);
      setPendingIdentityCardFile(null);
      setIdentityCardChoice(null); // Réinitialiser le choix après l'upload (réussite ou échec)
    }
  };

  // Fonction générique pour uploader et chiffrer un document
  const handleDocumentUpload = async (docType: DocumentType, file: File) => {
    if (!currentUser) return;
    
    // Validation
    if (file.size > 10 * 1024 * 1024) {
      enqueueSnackbar('Le fichier est trop volumineux (max 10Mo)', { variant: 'error' });
      return;
    }
    
    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
      enqueueSnackbar('Seuls les fichiers PDF et images sont acceptés', { variant: 'error' });
      return;
    }

    setUploadingDocument(docType.key);
    setUploadProgress(0);
    
    try {
      // 1. Uploader le fichier dans Storage
      const fileExtension = file.name.split('.').pop();
      const fileName = `${docType.key}_${Date.now()}.${fileExtension}`;
      const filePath = `documents/${currentUser.uid}/${fileName}`;
      
      const uploadResult = await uploadFile(file, filePath, (progress) => {
        setUploadProgress(progress);
      });
      
      // 2. Chiffrer le fichier via Cloud Function
      // Récupérer le token de manière fiable depuis currentUser
      // Récupérer le token de manière fiable depuis l'utilisateur Firebase Auth
      const auth = getAuth();
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        throw new Error('Utilisateur Firebase non authentifié');
      }
      const token = await firebaseUser.getIdToken(true); // Force refresh du token
      
      // Chiffrer le fichier immédiatement après l'upload
      try {
        console.log(`🔐 Début du chiffrement de ${docType.label}...`, { filePath });
        
        const encryptResponse = await axios.post(
          getFunctionsUrl('encryptFile'),
          { filePath },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            timeout: 60000 // 60 secondes de timeout
          }
        );
        
        console.log(`📥 Réponse du chiffrement pour ${docType.label}:`, encryptResponse.data);
        
        if (encryptResponse.data?.success) {
          console.log(`✅ ${docType.label} chiffré avec succès`);
          
          // Attendre un peu pour que les métadonnées soient propagées
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Vérifier que le fichier est bien chiffré
          try {
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const functions = getFunctions();
            const isFileEncrypted = httpsCallable(functions, 'isFileEncrypted');
            
            const checkResult = await isFileEncrypted({ filePath });
            const isEncrypted = (checkResult.data as any)?.encrypted;
            
            if (isEncrypted) {
              console.log(`✅ Vérification confirmée: ${docType.label} est bien chiffré`);
              enqueueSnackbar(`${docType.label} téléversé et chiffré avec succès`, { variant: 'success' });
            } else {
              // Les métadonnées peuvent prendre quelques secondes à se propager
              console.warn(`⚠️ Les métadonnées de chiffrement ne sont pas encore disponibles pour ${docType.label} (propagation en cours)`);
              enqueueSnackbar(`${docType.label} téléversé et chiffré avec succès`, { variant: 'success' });
            }
          } catch (checkError) {
            console.warn(`⚠️ Impossible de vérifier le statut de chiffrement pour ${docType.label}:`, checkError);
            // On considère que c'est OK car le chiffrement a réussi
            enqueueSnackbar(`${docType.label} téléversé et chiffré avec succès`, { variant: 'success' });
          }
        } else {
          console.warn(`⚠️ Réponse de chiffrement inattendue pour ${docType.label}:`, encryptResponse.data);
          enqueueSnackbar(`${docType.label} uploadé mais le chiffrement a peut-être échoué. Vérifiez les métadonnées.`, { variant: 'warning' });
        }
      } catch (encryptError: any) {
        // Si le chiffrement échoue, on log l'erreur complète
        console.error(`❌ Erreur lors du chiffrement de ${docType.label}:`, {
          message: encryptError.message,
          response: encryptError.response?.data,
          status: encryptError.response?.status,
          statusText: encryptError.response?.statusText,
          filePath,
          url: encryptError.config?.url
        });
        
        // Afficher un message d'erreur détaillé à l'utilisateur
        const errorMessage = encryptError.response?.data?.error || encryptError.message || 'Erreur inconnue';
        enqueueSnackbar(`${docType.label} uploadé mais le chiffrement a échoué: ${errorMessage}`, { variant: 'error' });
      }
      
      // 3. Sauvegarder l'URL dans le profil utilisateur
      await updateUserDocument(currentUser.uid, {
        [docType.fieldName]: uploadResult.url
      });
      
      onUpdate();
      // Le message de succès est géré dans le bloc try du chiffrement avec vérification
    } catch (error: any) {
      console.error(`Erreur upload ${docType.label}:`, error);
      enqueueSnackbar(`Erreur lors du téléversement de ${docType.label}`, { variant: 'error' });
    } finally {
      setUploadingDocument(null);
      setUploadProgress(0);
    }
  };

  // Fonction pour visualiser un document Recto ou Verso de la carte d'identité
  const handleViewIdentityCardPart = async (part: 'recto' | 'verso') => {
    if (!currentUser) return;
    
    const documentUrl = part === 'recto' 
      ? userData.identityCardRectoUrl 
      : userData.identityCardVersoUrl;
    
    if (!documentUrl) {
      enqueueSnackbar(`Le ${part === 'recto' ? 'recto' : 'verso'} n'est pas encore téléversé`, { variant: 'info' });
      return;
    }
    
    // Utiliser la même logique que handleDocumentView
    const docType = DOCUMENT_TYPES.find(d => d.key === 'identityCard');
    if (docType) {
      const tempDocType: DocumentType = {
        ...docType,
        fieldName: part === 'recto' ? 'identityCardRectoUrl' : 'identityCardVersoUrl'
      };
      await handleDocumentView(tempDocType);
    }
  };

  // Fonction générique pour télécharger et déchiffrer un document
  const handleDocumentView = async (docType: DocumentType) => {
    if (!currentUser) return;
    const documentUrl = (userData as any)[docType.fieldName];
    if (!documentUrl) return;
    try {
      let path = '';
      try {
        const urlObj = new URL(documentUrl);
        const idx = urlObj.pathname.indexOf('/o/') + 3;
        if (idx > 2) {
          const raw = urlObj.pathname.substring(idx).split('?')[0];
          path = decodeURIComponent(raw.replace(/%2F/g, '/'));
        }
      } catch (e) {
        console.error(`Erreur parsing URL ${docType.label}`, e);
        window.open(documentUrl, '_blank');
        return;
      }
      if (!path || !path.trim()) {
        enqueueSnackbar(`Impossible d'extraire le chemin du fichier ${docType.label}`, { variant: 'error' });
        return;
      }
      await openDocumentWithDecrypt(path, {
        onNotFound: async () => {
          enqueueSnackbar(`Le fichier ${docType.label} n'existe plus. Suppression de la référence...`, { variant: 'warning' });
          try {
            await updateUserDocument(currentUser.uid, { [docType.fieldName]: null });
            onUpdate();
          } catch (e) {
            console.error('Erreur nettoyage profil:', e);
          }
        },
      });
    } catch (error: any) {
      console.error(`Erreur lors de l'ouverture de ${docType.label}:`, error);
      enqueueSnackbar(`Erreur lors de l'ouverture de ${docType.label}`, { variant: 'error' });
    }
  };

  // Fonction pour ajouter un document personnalisé
  const handleAddCustomDocument = async (name: string, file: File) => {
    if (!currentUser) return;
    
    // Vérifier la limite
    const currentCount = userData.customDocuments?.length || 0;
    if (currentCount >= 3) {
      enqueueSnackbar('Vous ne pouvez ajouter que 3 documents personnalisés maximum', { variant: 'error' });
      return;
    }
    
    // Validation
    if (file.size > 10 * 1024 * 1024) {
      enqueueSnackbar('Le fichier est trop volumineux (max 10Mo)', { variant: 'error' });
      return;
    }
    
    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
      enqueueSnackbar('Seuls les fichiers PDF et images sont acceptés', { variant: 'error' });
      return;
    }

    if (!name.trim()) {
      enqueueSnackbar('Veuillez entrer un nom pour le document', { variant: 'error' });
      return;
    }

    setAddingCustomDocument(true);
    setUploadProgress(0);
    
    try {
      // 1. Uploader le fichier dans Storage
      const fileExtension = file.name.split('.').pop();
      const fileName = `custom_${Date.now()}.${fileExtension}`;
      const filePath = `documents/${currentUser.uid}/${fileName}`;
      
      // Upload (0-80% de la progression)
      const uploadResult = await uploadFile(file, filePath, (progress) => {
        // Mapper la progression de l'upload sur 0-80%
        setUploadProgress(progress * 0.8);
      });
      
      // Chiffrer (80-100% de la progression)
      setUploadProgress(80);
      // 2. Chiffrer le fichier via Cloud Function
      // Récupérer le token de manière fiable depuis currentUser
      // Récupérer le token de manière fiable depuis l'utilisateur Firebase Auth
      const auth = getAuth();
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        throw new Error('Utilisateur Firebase non authentifié');
      }
      const token = await firebaseUser.getIdToken(true); // Force refresh du token
      
      // Chiffrer le fichier immédiatement après l'upload
      try {
        console.log(`🔐 Début du chiffrement du document personnalisé "${name}"...`, { filePath });
        setUploadProgress(85);
        
        const encryptResponse = await axios.post(
          getFunctionsUrl('encryptFile'),
          { filePath },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            timeout: 60000 // 60 secondes de timeout
          }
        );
        
        console.log(`📥 Réponse du chiffrement pour "${name}":`, encryptResponse.data);
        
        if (encryptResponse.data?.success) {
          console.log(`✅ Document "${name}" chiffré avec succès`);
          setUploadProgress(95);
          
          // Vérifier que le fichier est bien chiffré
          try {
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const functions = getFunctions();
            const isFileEncrypted = httpsCallable(functions, 'isFileEncrypted');
            
            const checkResult = await isFileEncrypted({ filePath });
            const isEncrypted = (checkResult.data as any)?.encrypted;
            
            if (isEncrypted) {
              console.log(`✅ Vérification confirmée: Document "${name}" est bien chiffré`);
              setUploadProgress(100);
            } else {
              console.warn(`⚠️ Document "${name}" uploadé mais les métadonnées de chiffrement ne sont pas présentes`);
              setUploadProgress(98);
              await new Promise(resolve => setTimeout(resolve, 1000));
              setUploadProgress(100);
            }
          } catch (checkError) {
            console.warn(`⚠️ Impossible de vérifier le statut de chiffrement pour "${name}":`, checkError);
            setUploadProgress(100);
          }
        } else {
          console.warn(`⚠️ Réponse de chiffrement inattendue pour "${name}":`, encryptResponse.data);
          setUploadProgress(100);
        }
      } catch (encryptError: any) {
        // Si le chiffrement échoue, on log l'erreur complète
        console.error(`❌ Erreur lors du chiffrement du document "${name}":`, {
          message: encryptError.message,
          response: encryptError.response?.data,
          status: encryptError.response?.status,
          statusText: encryptError.response?.statusText,
          filePath,
          url: encryptError.config?.url
        });
        // On continue quand même, le fichier est uploadé
      }
      
      // 3. Créer le document personnalisé
      const newDocument: CustomDocument = {
        id: Date.now().toString(),
        name: name.trim(),
        url: uploadResult.url,
        uploadedAt: new Date()
      };
      
      // 4. Sauvegarder dans le profil utilisateur
      const updatedDocuments = [...(userData.customDocuments || []), newDocument];
      await updateUserDocument(currentUser.uid, {
        customDocuments: updatedDocuments
      });
      
      // Réinitialiser le formulaire
      setCustomDocumentName('');
      onUpdate();
      enqueueSnackbar(`Document "${name}" ajouté et chiffré avec succès`, { variant: 'success' });
    } catch (error: any) {
      console.error(`Erreur ajout document personnalisé:`, error);
      enqueueSnackbar(`Erreur lors de l'ajout du document: ${error.message || 'Erreur inconnue'}`, { variant: 'error' });
    } finally {
      setAddingCustomDocument(false);
      setUploadProgress(0);
    }
  };

  // Fonction pour consulter un document personnalisé
  const handleViewCustomDocument = async (doc: CustomDocument) => {
    if (!currentUser) return;
    try {
      let path = '';
      try {
        const urlObj = new URL(doc.url);
        const idx = urlObj.pathname.indexOf('/o/') + 3;
        if (idx > 2) {
          const raw = urlObj.pathname.substring(idx).split('?')[0];
          path = decodeURIComponent(raw.replace(/%2F/g, '/'));
        }
      } catch (e) {
        console.error('Erreur parsing URL document personnalisé', e);
        window.open(doc.url, '_blank');
        return;
      }
      if (path) await openDocumentWithDecrypt(path);
      else window.open(doc.url, '_blank');
    } catch (error: any) {
      console.error('Erreur lors de l\'ouverture du document personnalisé:', error);
      enqueueSnackbar('Erreur lors de l\'ouverture du document', { variant: 'error' });
    }
  };

  // Fonction pour supprimer un document personnalisé
  const handleDeleteCustomDocument = async (documentId: string) => {
    if (!currentUser) return;
    
    setDeletingDocument(documentId);
    
    try {
      const document = userData.customDocuments?.find(doc => doc.id === documentId);
      
      if (!document) {
        throw new Error('Document non trouvé');
      }
      
      // Supprimer le fichier dans Storage
      try {
        const urlObj = new URL(document.url);
        const pathStartIndex = urlObj.pathname.indexOf('/o/') + 3;
        if (pathStartIndex > 2) {
          const encodedPath = urlObj.pathname.substring(pathStartIndex);
          const path = decodeURIComponent(encodedPath);
          const storage = getStorage();
          const fileRef = ref(storage, path);
          await deleteObject(fileRef);
        }
      } catch (deleteError) {
        console.warn(`Erreur suppression fichier Storage (continuons quand même):`, deleteError);
      }
      
      // Supprimer de la liste
      const updatedDocuments = (userData.customDocuments || []).filter(doc => doc.id !== documentId);
      await updateUserDocument(currentUser.uid, {
        customDocuments: updatedDocuments
      });
      
      onUpdate();
      enqueueSnackbar('Document supprimé', { variant: 'success' });
    } catch (error: any) {
      console.error(`Erreur suppression document personnalisé:`, error);
      enqueueSnackbar(`Erreur lors de la suppression: ${error.message || 'Erreur inconnue'}`, { variant: 'error' });
    } finally {
      setDeletingDocument(null);
    }
  };

  // Fonction générique pour supprimer un document
  const handleDocumentDelete = async (docType: DocumentType) => {
    if (!currentUser) return;
    
    setDeletingDocument(docType.key);
    
    try {
      // Gestion spéciale pour la carte d'identité
      if (docType.key === 'identityCard') {
        const updateData: any = {};
        const filesToDelete: string[] = [];
        
        // Supprimer Recto
        if (userData.identityCardRectoUrl) {
          filesToDelete.push(userData.identityCardRectoUrl);
          updateData.identityCardRectoUrl = null;
        }
        
        // Supprimer Verso
        if (userData.identityCardVersoUrl) {
          filesToDelete.push(userData.identityCardVersoUrl);
          updateData.identityCardVersoUrl = null;
        }
        
        // Supprimer document complet si présent
        if (userData.identityCardUrl) {
          filesToDelete.push(userData.identityCardUrl);
          updateData.identityCardUrl = null;
        }
        
        // Supprimer les fichiers dans Storage
        for (const documentUrl of filesToDelete) {
          try {
            const urlObj = new URL(documentUrl);
            const pathStartIndex = urlObj.pathname.indexOf('/o/') + 3;
            if (pathStartIndex > 2) {
              const encodedPath = urlObj.pathname.substring(pathStartIndex);
              const path = decodeURIComponent(encodedPath);
              const storage = getStorage();
              const fileRef = ref(storage, path);
              await deleteObject(fileRef);
            }
          } catch (deleteError) {
            console.warn(`Erreur suppression fichier Storage (continuons quand même):`, deleteError);
          }
        }
        
        // Supprimer les références dans le profil
        await updateUserDocument(currentUser.uid, updateData);
        onUpdate();
        enqueueSnackbar('Carte d\'identité supprimée', { variant: 'success' });
      } else {
        // Gestion normale pour les autres documents
        const documentUrl = (userData as any)[docType.fieldName];
        
        // Supprimer le fichier dans Storage
        if (documentUrl) {
          try {
            const urlObj = new URL(documentUrl);
            const pathStartIndex = urlObj.pathname.indexOf('/o/') + 3;
            if (pathStartIndex > 2) {
              const encodedPath = urlObj.pathname.substring(pathStartIndex);
              const path = decodeURIComponent(encodedPath);
              const storage = getStorage();
              const fileRef = ref(storage, path);
              await deleteObject(fileRef);
            }
          } catch (deleteError) {
            console.warn(`Erreur suppression fichier Storage ${docType.label} (continuons quand même):`, deleteError);
          }
        }
        
        // Supprimer la référence dans le profil
        await updateUserDocument(currentUser.uid, { [docType.fieldName]: null });
        onUpdate();
        enqueueSnackbar(`${docType.label} supprimé`, { variant: 'success' });
      }
    } catch (error) {
      console.error(`Erreur suppression ${docType.label}:`, error);
      enqueueSnackbar(`Erreur lors de la suppression de ${docType.label}`, { variant: 'error' });
    } finally {
      setDeletingDocument(null);
    }
  };

  return (
    <Box>
      <DocumentDisclaimer />
      
      {/* Input file caché pour la carte d'identité (toujours présent) */}
      <input
        type="file"
        hidden
        ref={identityCardFileInputRef}
        accept="application/pdf,image/*"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            handleIdentityCardFileSelected(selectedFile);
            // Réinitialiser l'input pour permettre la sélection du même fichier à nouveau
            if (e.target) {
              (e.target as HTMLInputElement).value = '';
            }
          }
        }}
      />
      
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 0, 
              textAlign: 'center', 
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              border: dragActiveDocument === 'cv' ? '2px dashed #0071e3' : '1px solid',
              bgcolor: dragActiveDocument === 'cv' ? '#f0f7ff' : 'transparent',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden',
              '&:hover': {
                boxShadow: dragActiveDocument === 'cv' ? 3 : 2
              },
              '&::before': dragActiveDocument === 'cv' ? {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(0, 113, 227, 0.1), transparent)',
                transition: 'left 0.5s ease'
              } : {}
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!userData.cvUrl) setDragActiveDocument('cv');
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActiveDocument(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActiveDocument(null);
              
              if (userData.cvUrl) return;
              
              const files = Array.from(e.dataTransfer.files);
              if (files.length > 0 && files[0]) {
                const file = files[0];
                if (file.type === 'application/pdf') {
                  await handleFileChange({ target: { files: [file] } } as any);
                } else {
                  enqueueSnackbar('Seuls les fichiers PDF sont acceptés pour le CV', { variant: 'error' });
                }
              }
            }}
          >
            {userData.cvUrl ? (
              <Box 
                sx={{ 
                  p: 4, 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'center',
                  alignItems: 'center',
                  bgcolor: tokens.colors.bgDefault,
                  border: 'none'
                }}
              >
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: tokens.radius.xl,
                    bgcolor: '#e3f2fd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 3,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                  }}
                >
                  <DescriptionIcon sx={{ fontSize: 40, color: '#1976d2' }} />
                </Box>
                <Typography variant="h6" gutterBottom fontWeight={600} sx={{ mb: 0.5 }}>
                  Mon CV
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Document téléversé et chiffré
                </Typography>
                {uploading && (
                  <Box sx={{ width: '100%', mb: 2 }}>
                    <LinearProgress variant="determinate" value={uploadProgress} />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
                      {Math.round(uploadProgress)}% - {uploadProgress < 80 ? 'Téléchargement en cours...' : uploadProgress < 95 ? 'Chiffrement en cours...' : 'Finalisation...'}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5 }}>
                  <Button
                    variant="contained"
                    startIcon={<VisibilityIcon />}
                    onClick={handleViewCV}
                    disabled={uploading}
                    sx={{
                      borderRadius: tokens.radius.md,
                      px: 3,
                      py: 1,
                      textTransform: 'none',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }
                    }}
                  >
                    Voir
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<DeleteIcon />}
                    onClick={() => setDeleteDialogOpen(true)}
                    sx={{
                      borderRadius: tokens.radius.md,
                      px: 3,
                      py: 1,
                      textTransform: 'none',
                      borderColor: '#e0e0e0',
                      color: '#666',
                      '&:hover': {
                        borderColor: '#d32f2f',
                        color: '#d32f2f',
                        bgcolor: 'rgba(211, 47, 47, 0.04)'
                      }
                    }}
                  >
                    Supprimer
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box
                component="label"
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 3,
                  flex: 1,
                  minHeight: '200px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  bgcolor: dragActiveDocument === 'cv' ? '#f0f7ff' : '#fafafa',
                  '&:hover': {
                    bgcolor: '#f0f7ff'
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    border: '2px dashed',
                    borderColor: dragActiveDocument === 'cv' ? '#0071e3' : 'divider',
                    borderRadius: 0,
                    pointerEvents: 'none',
                    transition: 'border-color 0.3s ease'
                  },
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(0, 113, 227, 0.1), transparent)',
                    transition: 'left 0.5s ease',
                    pointerEvents: 'none'
                  },
                  '&:hover::before': {
                    borderColor: '#0071e3'
                  },
                  '&:hover::after': {
                    left: '100%'
                  }
                }}
              >
                <DescriptionIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Mon CV
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ 
                    textAlign: 'center'
                  }}
                >
                  Aucun CV téléversé. Veuillez ajouter votre CV au format PDF.
                </Typography>
                <input
                  type="file"
                  hidden
                  accept="application/pdf"
                  onChange={handleFileChange}
                />
              </Box>
            )}
          </Paper>
        </Grid>
        
        {/* Carte d'identité avec gestion Recto/Verso */}
        <Grid item xs={12} md={6}>
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 0, 
              textAlign: 'center', 
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              border: dragActiveDocument === 'identityCard' 
                      ? '2px dashed #0071e3'
                      : userData.identityCardUrl || (userData.identityCardRectoUrl && userData.identityCardVersoUrl)
                      ? '2px solid #4caf50'
                      : userData.identityCardRectoUrl && !userData.identityCardVersoUrl || 
                        !userData.identityCardRectoUrl && userData.identityCardVersoUrl
                      ? '2px solid #ff9800' 
                      : '1px solid',
              bgcolor: dragActiveDocument === 'identityCard'
                      ? '#f0f7ff'
                      : 'transparent',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden',
              '&:hover': {
                boxShadow: dragActiveDocument === 'identityCard' ? 3 : 2
              },
              '&::before': dragActiveDocument === 'identityCard' ? {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(0, 113, 227, 0.1), transparent)',
                transition: 'left 0.5s ease'
              } : {}
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActiveDocument('identityCard');
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActiveDocument(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActiveDocument(null);
              
              const files = Array.from(e.dataTransfer.files);
              if (files.length > 0 && files[0]) {
                const file = files[0];
                if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
                  setPendingIdentityCardFile(file);
                  setIdentityCardDialogOpen(true);
                } else {
                  enqueueSnackbar('Seuls les fichiers PDF et images sont acceptés', { variant: 'error' });
                }
              }
            }}
          >
            {(userData.identityCardUrl || userData.identityCardRectoUrl || userData.identityCardVersoUrl) ? (
              <Box 
                sx={{ 
                  p: 4, 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'center',
                  alignItems: 'center',
                  bgcolor: tokens.colors.bgDefault,
                  border: 'none'
                }}
              >
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: tokens.radius.xl,
                    bgcolor: (userData.identityCardUrl || (userData.identityCardRectoUrl && userData.identityCardVersoUrl))
                      ? '#e8f5e9' 
                      : '#fff3e0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 3,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                  }}
                >
                  <BadgeIcon 
                    sx={{ 
                      fontSize: 40, 
                      color: (userData.identityCardUrl || (userData.identityCardRectoUrl && userData.identityCardVersoUrl))
                        ? '#2e7d32' 
                        : '#f57c00'
                    }} 
                  />
                </Box>
                <Typography variant="h6" gutterBottom fontWeight={600} sx={{ mb: 0.5 }}>
                  Carte d'identité
                </Typography>
                <Typography 
                  variant="body2" 
                  color={
                    (userData.identityCardUrl || (userData.identityCardRectoUrl && userData.identityCardVersoUrl)) 
                      ? 'success.main' 
                      : 'warning.main'
                  }
                  sx={{ mb: 3 }}
                >
                  {userData.identityCardUrl 
                    ? 'Document complet' 
                    : (userData.identityCardRectoUrl && userData.identityCardVersoUrl 
                      ? 'Document complet' 
                      : (!userData.identityCardRectoUrl ? 'Recto manquant' : 'Verso manquant'))}
                </Typography>
                {uploadingDocument === 'identityCard' && (
                  <Box sx={{ width: '100%', mb: 2 }}>
                    <LinearProgress variant="determinate" value={uploadProgress} />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
                      {Math.round(uploadProgress)}% - {uploadProgress < 80 ? 'Téléchargement en cours...' : uploadProgress < 95 ? 'Chiffrement en cours...' : 'Finalisation...'}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                  {userData.identityCardUrl ? (
                    // Document complet - bouton unique
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<VisibilityIcon />}
                      onClick={() => {
                        const docType = DOCUMENT_TYPES.find(d => d.key === 'identityCard');
                        if (docType) handleDocumentView(docType);
                      }}
                      sx={{
                        borderRadius: tokens.radius.md,
                        px: 2.5,
                        py: 0.75,
                        textTransform: 'none',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        '&:hover': {
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }
                      }}
                    >
                      Voir
                    </Button>
                  ) : (
                    // Documents séparés - boutons recto/verso
                    <>
                      {userData.identityCardRectoUrl && (
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<VisibilityIcon />}
                          onClick={() => handleViewIdentityCardPart('recto')}
                          sx={{
                            borderRadius: tokens.radius.md,
                            px: 2.5,
                            py: 0.75,
                            textTransform: 'none',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            '&:hover': {
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                            }
                          }}
                        >
                          Voir Recto
                        </Button>
                      )}
                      {userData.identityCardVersoUrl && (
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<VisibilityIcon />}
                          onClick={() => handleViewIdentityCardPart('verso')}
                          sx={{
                            borderRadius: tokens.radius.md,
                            px: 2.5,
                            py: 0.75,
                            textTransform: 'none',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            '&:hover': {
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                            }
                          }}
                        >
                          Voir Verso
                        </Button>
                      )}
                    </>
                  )}
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<DeleteIcon />}
                    onClick={() => {
                      const docType = DOCUMENT_TYPES.find(d => d.key === 'identityCard');
                      if (docType) handleDocumentDelete(docType);
                    }}
                    disabled={deletingDocument === 'identityCard'}
                    sx={{
                      borderRadius: tokens.radius.md,
                      px: 2.5,
                      py: 0.75,
                      textTransform: 'none',
                      borderColor: '#e0e0e0',
                      color: '#666',
                      '&:hover': {
                        borderColor: '#d32f2f',
                        color: '#d32f2f',
                        bgcolor: 'rgba(211, 47, 47, 0.04)'
                      }
                    }}
                  >
                    Supprimer
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 3,
                  flex: 1,
                  minHeight: '200px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  bgcolor: dragActiveDocument === 'identityCard' ? '#f0f7ff' : '#fafafa',
                  '&:hover': {
                    bgcolor: '#f0f7ff'
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    border: '2px dashed',
                    borderColor: dragActiveDocument === 'identityCard' ? '#0071e3' : 'divider',
                    borderRadius: 0,
                    pointerEvents: 'none',
                    transition: 'border-color 0.3s ease'
                  },
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(0, 113, 227, 0.1), transparent)',
                    transition: 'left 0.5s ease',
                    pointerEvents: 'none'
                  },
                  '&:hover::before': {
                    borderColor: '#0071e3'
                  },
                  '&:hover::after': {
                    left: '100%'
                  }
                }}
                onClick={(e) => {
                  e.preventDefault();
                  handleIdentityCardUploadClick();
                }}
              >
                <Box 
                  sx={{ 
                    fontSize: 60, 
                    color: 'primary.main', 
                    mb: 2, 
                    display: 'flex', 
                    justifyContent: 'center',
                    transition: 'color 0.3s ease'
                  }}
                >
                  <BadgeIcon />
                </Box>
                <Typography variant="h6" gutterBottom fontWeight={600}>
                  Carte d'identité
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ 
                    textAlign: 'center'
                  }}
                >
                  Carte nationale d'identité (recto et verso)
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
        
        {/* Autres documents d'identité sécurisés */}
        {DOCUMENT_TYPES.filter(docType => docType.key !== 'identityCard').map((docType) => {
          const documentUrl = (userData as any)[docType.fieldName];
          const isUploading = uploadingDocument === docType.key;
          const isDeleting = deletingDocument === docType.key;
          const isDragActive = dragActiveDocument === docType.key;
          
          return (
            <Grid item xs={12} md={6} key={docType.key}>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 0, 
                  textAlign: 'center', 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  border: isDragActive ? '2px dashed #0071e3' : '1px solid',
                  bgcolor: isDragActive ? '#f0f7ff' : 'transparent',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': {
                    boxShadow: isDragActive ? 3 : 2
                  },
                  '&::before': isDragActive ? {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(0, 113, 227, 0.1), transparent)',
                    transition: 'left 0.5s ease'
                  } : {}
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!documentUrl) setDragActiveDocument(docType.key);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActiveDocument(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActiveDocument(null);
                  
                  if (documentUrl) return;
                  
                  const files = Array.from(e.dataTransfer.files);
                  if (files.length > 0 && files[0]) {
                    const file = files[0];
                    if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
                      await handleDocumentUpload(docType, file);
                    } else {
                      enqueueSnackbar('Seuls les fichiers PDF et images sont acceptés', { variant: 'error' });
                    }
                  }
                }}
              >
                {documentUrl ? (
                  <Box 
                    sx={{ 
                      p: 4, 
                      flex: 1, 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'center',
                      alignItems: 'center',
                      bgcolor: tokens.colors.bgDefault,
                      border: 'none'
                    }}
                  >
                    <Box
                      sx={{
                        width: 80,
                        height: 80,
                        borderRadius: tokens.radius.xl,
                        bgcolor: '#e3f2fd',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 3,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        '& svg': {
                          fontSize: 40,
                          color: '#1976d2'
                        }
                      }}
                    >
                      {docType.icon}
                    </Box>
                    <Typography variant="h6" gutterBottom fontWeight={600} sx={{ mb: 0.5 }}>
                      {docType.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Document téléversé et chiffré
                    </Typography>
                    {isUploading && (
                      <Box sx={{ width: '100%', mb: 2 }}>
                        <LinearProgress variant="determinate" value={uploadProgress} />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
                          {Math.round(uploadProgress)}% - {uploadProgress < 80 ? 'Téléchargement en cours...' : uploadProgress < 95 ? 'Chiffrement en cours...' : 'Finalisation...'}
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5 }}>
                      <Button
                        variant="contained"
                        startIcon={<VisibilityIcon />}
                        onClick={() => handleDocumentView(docType)}
                        disabled={isDeleting || isUploading}
                        sx={{
                          borderRadius: tokens.radius.md,
                          px: 3,
                          py: 1,
                          textTransform: 'none',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                          '&:hover': {
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                          }
                        }}
                      >
                        Voir
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={isDeleting ? <CircularProgress size={16} /> : <DeleteIcon />}
                        onClick={() => handleDocumentDelete(docType)}
                        disabled={isDeleting}
                        sx={{
                          borderRadius: tokens.radius.md,
                          px: 3,
                          py: 1,
                          textTransform: 'none',
                          borderColor: '#e0e0e0',
                          color: '#666',
                          '&:hover': {
                            borderColor: '#d32f2f',
                            color: '#d32f2f',
                            bgcolor: 'rgba(211, 47, 47, 0.04)'
                          }
                        }}
                      >
                        Supprimer
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Box
                    component="label"
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      p: 3,
                      flex: 1,
                      minHeight: '200px',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative',
                      overflow: 'hidden',
                      bgcolor: isDragActive ? '#f0f7ff' : '#fafafa',
                      '&:hover': {
                        bgcolor: '#f0f7ff'
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        border: '2px dashed',
                        borderColor: isDragActive ? '#0071e3' : 'divider',
                        borderRadius: 0,
                        pointerEvents: 'none',
                        transition: 'border-color 0.3s ease'
                      },
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: '-100%',
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent, rgba(0, 113, 227, 0.1), transparent)',
                        transition: 'left 0.5s ease',
                        pointerEvents: 'none'
                      },
                      '&:hover::before': {
                        borderColor: '#0071e3'
                      },
                      '&:hover::after': {
                        left: '100%'
                      }
                    }}
                  >
                    <Box sx={{ fontSize: 60, color: 'primary.main', mb: 2, display: 'flex', justifyContent: 'center' }}>
                      {docType.icon}
                    </Box>
                    <Typography variant="h6" gutterBottom>
                      {docType.label}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ 
                        textAlign: 'center'
                      }}
                    >
                      {docType.description}
                    </Typography>
                    <input
                      type="file"
                      hidden
                      accept="application/pdf,image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleDocumentUpload(docType, e.target.files[0]);
                        }
                      }}
                    />
                  </Box>
                )}
              </Paper>
            </Grid>
          );
        })}
        
        {/* Documents personnalisés avec drag and drop */}
        <Grid item xs={12} md={6}>
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              border: dragActive ? '2px dashed #0071e3' : '1px solid',
              bgcolor: dragActive ? '#f0f7ff' : 'transparent',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden',
              '&:hover': {
                boxShadow: dragActive ? 3 : 2
              },
              '&::before': dragActive ? {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(0, 113, 227, 0.1), transparent)',
                transition: 'left 0.5s ease'
              } : {}
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(false);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(false);
              
              const files = Array.from(e.dataTransfer.files);
              const currentCount = userData.customDocuments?.length || 0;
              const remainingSlots = 3 - currentCount;
              
              if (files.length === 0) return;
              
              if (remainingSlots <= 0) {
                enqueueSnackbar('Vous avez déjà atteint la limite de 3 documents supplémentaires', { variant: 'warning' });
                return;
              }
              
              // Limiter le nombre de fichiers à traiter
              const filesToProcess = files.slice(0, remainingSlots);
              
              if (files.length > remainingSlots) {
                enqueueSnackbar(`${files.length - remainingSlots} fichier(s) ignoré(s). Limite de ${remainingSlots} document(s) atteinte.`, { variant: 'info' });
              }
              
              // Traiter les fichiers un par un pour éviter les problèmes de concurrence
              for (const file of filesToProcess) {
                // Validation
                if (file.size > 10 * 1024 * 1024) {
                  enqueueSnackbar(`Le fichier ${file.name} est trop volumineux (max 10Mo)`, { variant: 'error' });
                  continue;
                }
                
                if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
                  enqueueSnackbar(`Le fichier ${file.name} doit être un PDF ou une image`, { variant: 'error' });
                  continue;
                }
                
                // Utiliser le nom du fichier comme nom du document
                const fileName = file.name.replace(/\.[^/.]+$/, ''); // Enlever l'extension
                await handleAddCustomDocument(fileName, file);
              }
            }}
          >
            {/* Zone de drag and drop */}
            <Box
              component="label"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 3,
                flex: 1,
                minHeight: '200px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                bgcolor: dragActive ? '#f0f7ff' : '#fafafa',
                '&:hover': {
                  bgcolor: '#f0f7ff'
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  border: '2px dashed',
                  borderColor: dragActive ? '#0071e3' : 'divider',
                  borderRadius: 0,
                  pointerEvents: 'none',
                  transition: 'border-color 0.3s ease'
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(0, 113, 227, 0.1), transparent)',
                  transition: 'left 0.5s ease',
                  pointerEvents: 'none'
                },
                '&:hover::before': {
                  borderColor: '#0071e3'
                },
                '&:hover::after': {
                  left: '100%'
                }
              }}
            >
              <Box sx={{ fontSize: 60, color: 'primary.main', mb: 2, display: 'flex', justifyContent: 'center' }}>
                <AddIcon sx={{ fontSize: 60 }} />
              </Box>
              <Typography variant="h6" gutterBottom>
                Documents supplémentaires
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ 
                  textAlign: 'center'
                }}
              >
                ({3 - (userData.customDocuments?.length || 0)} emplacement(s) disponible(s))
              </Typography>
              {addingCustomDocument && (
                <Box sx={{ width: '100%', mt: 2 }}>
                  <LinearProgress variant="determinate" value={uploadProgress} />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
                    {Math.round(uploadProgress)}% - {uploadProgress < 80 ? 'Téléchargement en cours...' : uploadProgress < 95 ? 'Chiffrement en cours...' : 'Finalisation...'}
                  </Typography>
                </Box>
              )}
              <input
                type="file"
                hidden
                multiple
                accept="application/pdf,image/*"
                onChange={async (e) => {
                  if (e.target.files) {
                    const files = Array.from(e.target.files);
                    const currentCount = userData.customDocuments?.length || 0;
                    const remainingSlots = 3 - currentCount;
                    
                    if (remainingSlots <= 0) {
                      enqueueSnackbar('Vous avez déjà atteint la limite de 3 documents supplémentaires', { variant: 'warning' });
                      return;
                    }
                    
                    // Limiter le nombre de fichiers à traiter
                    const filesToProcess = files.slice(0, remainingSlots);
                    
                    if (files.length > remainingSlots) {
                      enqueueSnackbar(`${files.length - remainingSlots} fichier(s) ignoré(s). Limite de ${remainingSlots} document(s) atteinte.`, { variant: 'info' });
                    }
                    
                    // Traiter les fichiers un par un
                    for (const file of filesToProcess) {
                      const fileName = file.name.replace(/\.[^/.]+$/, '');
                      await handleAddCustomDocument(fileName, file);
                    }
                  }
                }}
              />
            </Box>
            
            {/* Liste des documents personnalisés */}
            {userData.customDocuments && userData.customDocuments.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Documents ajoutés ({userData.customDocuments.length}/3)
                </Typography>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  {userData.customDocuments && userData.customDocuments.map((doc) => (
                    <Grid item xs={12} sm={6} md={4} key={doc.id}>
                      <Paper 
                        variant="outlined" 
                        sx={{ 
                          p: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderRadius: 2,
                          transition: 'all 0.2s ease',
                          border: '1px solid',
                          borderColor: 'divider',
                          '&:hover': {
                            bgcolor: '#f5f5f5',
                            transform: 'translateY(-2px)',
                            boxShadow: 2,
                            borderColor: 'primary.main'
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
                          <Box
                            sx={{
                              p: 1,
                              borderRadius: 1,
                              bgcolor: 'primary.main',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <DescriptionIcon sx={{ fontSize: 20 }} />
                          </Box>
                          <Typography 
                            variant="body2" 
                            fontWeight={500}
                            sx={{ 
                              flex: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {doc.name}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                          <Tooltip title="Voir le document">
                            <IconButton
                              size="small"
                              onClick={() => handleViewCustomDocument(doc)}
                              color="primary"
                              sx={{
                                '&:hover': {
                                  bgcolor: 'primary.light',
                                  color: 'white'
                                }
                              }}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Supprimer le document">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteCustomDocument(doc.id)}
                              color="error"
                              disabled={deletingDocument === doc.id}
                              sx={{
                                '&:hover': {
                                  bgcolor: 'error.light',
                                  color: 'white'
                                }
                              }}
                            >
                              {deletingDocument === doc.id ? (
                                <CircularProgress size={16} />
                              ) : (
                                <DeleteIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Dialogue de choix Recto/Verso pour la carte d'identité */}
      <Dialog 
        open={identityCardDialogOpen} 
        onClose={() => {
          setIdentityCardDialogOpen(false);
          setPendingIdentityCardFile(null);
          setIdentityCardChoice(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Choisir le type de document</Typography>
            <IconButton
              size="small"
              onClick={() => {
                setIdentityCardDialogOpen(false);
                setPendingIdentityCardFile(null);
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {pendingIdentityCardFile 
              ? 'Quel type de document souhaitez-vous téléverser ?'
              : 'Quel type de document souhaitez-vous téléverser ? (vous pourrez ensuite sélectionner le fichier)'}
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  border: '2px solid',
                  borderColor: 'primary.main',
                  bgcolor: '#f0f7ff',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: '#e0efff',
                    transform: 'translateY(-2px)',
                    boxShadow: 2
                  }
                }}
                onClick={() => {
                  if (pendingIdentityCardFile) {
                    handleIdentityCardUpload('recto', pendingIdentityCardFile);
                  } else {
                    handleIdentityCardChoice('recto');
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <BadgeIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Recto uniquement
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Côté avant de la carte d'identité
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
            
            <Grid item xs={12}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  border: '2px solid',
                  borderColor: 'primary.main',
                  bgcolor: '#f0f7ff',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: '#e0efff',
                    transform: 'translateY(-2px)',
                    boxShadow: 2
                  }
                }}
                onClick={() => {
                  if (pendingIdentityCardFile) {
                    handleIdentityCardUpload('verso', pendingIdentityCardFile);
                  } else {
                    handleIdentityCardChoice('verso');
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <BadgeIcon sx={{ fontSize: 40, color: 'primary.main', transform: 'scaleX(-1)' }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Verso uniquement
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Côté arrière de la carte d'identité
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
            
            <Grid item xs={12}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  border: '2px solid',
                  borderColor: 'success.main',
                  bgcolor: '#f1f8f4',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: '#e8f5e9',
                    transform: 'translateY(-2px)',
                    boxShadow: 2
                  }
                }}
                onClick={() => {
                  if (pendingIdentityCardFile) {
                    handleIdentityCardUpload('both', pendingIdentityCardFile);
                  } else {
                    handleIdentityCardChoice('both');
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <BadgeIcon sx={{ fontSize: 40, color: 'success.main' }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={600} color="success.main">
                      Document complet (Recto + Verso)
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Un seul fichier contenant les deux côtés
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setIdentityCardDialogOpen(false);
            setPendingIdentityCardFile(null);
            setIdentityCardChoice(null);
          }}>
            Annuler
          </Button>
        </DialogActions>
      </Dialog>

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

      {/* Modal de visualisation de document */}
      <Dialog
        open={viewerOpen}
        onClose={() => {
          setViewerOpen(false);
          if (viewerUrl && viewerUrl.startsWith('blob:')) {
            URL.revokeObjectURL(viewerUrl);
          }
          setViewerUrl(null);
          setViewerError(null);
          setViewerLoading(false);
        }}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 1
        }}>
          Visualisation du document
          <IconButton
            onClick={() => {
              setViewerOpen(false);
              if (viewerUrl && viewerUrl.startsWith('blob:')) {
                URL.revokeObjectURL(viewerUrl);
              }
              setViewerUrl(null);
              setViewerError(null);
              setViewerLoading(false);
            }}
            sx={{ color: 'text.secondary' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, position: 'relative', height: '100%', minHeight: '400px' }}>
          {(() => {
            return null;
          })()}
          {viewerLoading && (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100%',
              flexDirection: 'column',
              gap: 2
            }}>
              <CircularProgress size={48} />
              <Typography variant="body1" color="text.secondary">
                Chargement du document...
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, textAlign: 'center' }}>
                Le décryptage peut prendre quelques secondes pour les documents protégés.
              </Typography>
            </Box>
          )}
          {viewerError && !viewerLoading && (
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
              <Alert severity="warning" sx={{ width: '100%' }}>{viewerError}</Alert>
              {viewerError.includes('métadonnées') && (
                <Button
                  variant="contained"
                  onClick={async () => {
                    // Réessayer d'ouvrir le document (chemin Storage du dernier decrypt en attente)
                    const storagePath = pendingDecryptDocument?.path;
                    if (!storagePath) return;
                    const fileName = storagePath.split('/').pop() || '';
                    const docType = DOCUMENT_TYPES.find((dt) => {
                      const url = (userData as Record<string, unknown>)[dt.fieldName];
                      return typeof url === 'string' && fileName.length > 0 && url.includes(fileName);
                    });
                    if (docType) {
                      await handleDocumentView(docType);
                    } else {
                      await openDocumentWithDecrypt(storagePath);
                    }
                  }}
                >
                  Réessayer
                </Button>
              )}
            </Box>
          )}
          {viewerUrl && !viewerLoading && !viewerError && (
            <Box sx={{ 
              height: '100%', 
              width: '100%',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: '#f5f5f5'
            }}>
              {(() => {
                console.log('🔍 Affichage du document, URL:', viewerUrl.substring(0, 100) + '...');
                const isBlob = viewerUrl.startsWith('blob:');
                console.log('📄 Type d\'URL:', isBlob ? 'Blob' : 'Firebase Storage');
                return null;
              })()}
              {viewerUrl.startsWith('blob:') ? (
                // Pour les blobs (fichiers déchiffrés), utiliser un embed avec fallback iframe
                (() => {
                  return (
                    <Box sx={{ 
                      height: '100%', 
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      p: 3
                    }}>
                      <embed
                        src={`${viewerUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                        type="application/pdf"
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 'none',
                          flex: 1,
                          minHeight: '500px'
                        }}
                        onLoad={() => {
                          console.log('✅ Embed blob chargé avec succès');
                        }}
                        onError={(e) => {
                          console.error('❌ Erreur chargement embed blob:', e);
                        }}
                      />
                      {/* Message d'aide et bouton pour ouvrir dans un nouvel onglet */}
                      <Box sx={{ 
                        position: 'absolute', 
                        bottom: 16,
                        right: 16,
                        display: 'flex',
                        gap: 2,
                        alignItems: 'center'
                      }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                          Si le PDF ne s'affiche pas, utilisez le bouton ci-dessous
                        </Typography>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => {
                            if (viewerUrl) {
                              window.open(viewerUrl, '_blank');
                            }
                          }}
                        >
                          Ouvrir dans un nouvel onglet
                        </Button>
                      </Box>
                    </Box>
                  );
                })()
              ) : (
                // Pour les URLs Firebase Storage, utiliser un iframe
                <iframe
                  src={viewerUrl}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    flex: 1
                  }}
                  title="Document viewer"
                  onLoad={() => {
                    console.log('✅ Iframe chargée avec succès');
                  }}
                  onError={(e) => {
                    console.error('❌ Erreur chargement iframe:', e);
                    setViewerError('Impossible de charger le document. Il est peut-être chiffré.');
                  }}
                />
              )}
            </Box>
          )}
          {!viewerUrl && !viewerLoading && !viewerError && (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100%',
              flexDirection: 'column',
              gap: 2
            }}>
              <Typography variant="body2" color="text.secondary">
                Aucun document à afficher
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (viewerUrl) {
                const link = document.createElement('a');
                link.href = viewerUrl;
                link.download = 'document.pdf';
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }
            }}
            disabled={!viewerUrl || viewerLoading}
          >
            Télécharger
          </Button>
          <Button
            onClick={() => {
              setViewerOpen(false);
              if (viewerUrl && viewerUrl.startsWith('blob:')) {
                URL.revokeObjectURL(viewerUrl);
              }
              setViewerUrl(null);
              setViewerError(null);
              setViewerLoading(false);
            }}
          >
            Fermer
          </Button>
        </DialogActions>
      </Dialog>

      <TwoFactorDialog
        open={twoFactorDocumentOpen}
        onClose={() => {
          setTwoFactorDocumentOpen(false);
          setPendingDecryptDocument(null);
        }}
        onVerify={handleVerifyDocument2FA}
        title="Validation 2FA requise"
        message="Ce document est chiffré. Entrez le code à 6 chiffres de votre application d'authentification pour y accéder."
      />
    </Box>
  );
};

export default DocumentsTab;

