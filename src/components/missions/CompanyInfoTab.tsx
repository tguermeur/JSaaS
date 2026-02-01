import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Avatar,
  Paper,
  Divider,
  Chip,
  CircularProgress,
  Grid,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Snackbar,
  Alert,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Language as LanguageIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  LinkedIn as LinkedInIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, where, doc, getDoc, updateDoc, addDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { Company, Contact } from '../../pages/Entreprises';

const appleFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

interface AmbassadorSettings {
  companyId: string;
  structureId: string;
}

interface ContactWithAccess extends Contact {
  userId?: string;
  accessLevel?: 'read' | 'write' | 'admin';
  canViewEvents?: boolean;
  canManageAmbassadors?: boolean;
}

export const CompanyInfoTab: React.FC = () => {
  const { userData, currentUser, isContactWithAccess } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [savedCompanyId, setSavedCompanyId] = useState<string>('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<ContactWithAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedCompany, setEditedCompany] = useState<Partial<Company>>({});
  const [addContactDialogOpen, setAddContactDialogOpen] = useState(false);
  const [editContactDialogOpen, setEditContactDialogOpen] = useState(false);
  const [deleteContactDialogOpen, setDeleteContactDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactWithAccess | null>(null);
  const [newContact, setNewContact] = useState<Partial<ContactWithAccess>>({});
  const [editContact, setEditContact] = useState<Partial<ContactWithAccess>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [structureId, setStructureId] = useState<string>('');
  const [createAccessDialogOpen, setCreateAccessDialogOpen] = useState(false);
  const [accessPassword, setAccessPassword] = useState('');
  const [creatingAccess, setCreatingAccess] = useState(false);
  const [contactForAccess, setContactForAccess] = useState<ContactWithAccess | null>(null);
  const [isTrialVersion, setIsTrialVersion] = useState(false);

  // Vérifier si l'utilisateur est superadmin
  const isSuperAdmin = userData?.status === 'superadmin';

  // Charger les entreprises de la structure et l'entreprise sauvegardée
  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Récupérer les données de l'utilisateur pour obtenir la structureId
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) {
          console.error("Document utilisateur non trouvé");
          setLoading(false);
          return;
        }

        const userDataDoc = userDoc.data();
        const userStructureId = userDataDoc?.structureId;
        setStructureId(userStructureId || '');
        
        if (!userStructureId) {
          console.error("StructureId non trouvé pour l'utilisateur");
          setLoading(false);
          return;
        }

        // Pour les superadmins, récupérer l'entreprise sauvegardée et la liste des entreprises
        if (isSuperAdmin) {
          // Récupérer l'entreprise sauvegardée
          const settingsRef = doc(db, 'ambassadorSettings', userStructureId);
          const settingsDoc = await getDoc(settingsRef);
          if (settingsDoc.exists()) {
            const settings = settingsDoc.data() as AmbassadorSettings;
            setSavedCompanyId(settings.companyId || '');
            setSelectedCompanyId(settings.companyId || '');
          }

          // Récupérer les entreprises de la structure
          const companiesRef = collection(db, 'companies');
          const companiesQuery = query(companiesRef, where('structureId', '==', userStructureId));
          const companiesSnapshot = await getDocs(companiesQuery);
        
          const companiesData = companiesSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || '',
              nSiret: data.nSiret || '',
              description: data.description || '',
              address: data.address || '',
              city: data.city || '',
              postalCode: data.postalCode || '',
              country: data.country || '',
              phone: data.phone || '',
              email: data.email || '',
              website: data.website || '',
              logo: data.logo || '',
              missionsCount: data.missionsCount || 0,
              totalRevenue: data.totalRevenue || 0,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate(),
              structureId: data.structureId || userStructureId
            } as Company;
          });
          
          setCompanies(companiesData);
        } else {
          // Pour les non-superadmins (admins, membres, contacts avec accès), charger l'entreprise automatiquement
          // Si c'est un contact avec accès, utiliser son companyId
          if (userData?.status === 'entreprise' && userData?.companyId) {
            setSelectedCompanyId(userData.companyId);
            setSavedCompanyId(userData.companyId);
          } else if (userStructureId) {
            // Pour les admins/membres, essayer de récupérer l'entreprise sauvegardée
            const settingsRef = doc(db, 'ambassadorSettings', userStructureId);
            const settingsDoc = await getDoc(settingsRef);
            if (settingsDoc.exists()) {
              const settings = settingsDoc.data() as AmbassadorSettings;
              if (settings.companyId) {
                setSelectedCompanyId(settings.companyId);
                setSavedCompanyId(settings.companyId);
              }
            }
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, isSuperAdmin]);

  // Vérifier le statut d'abonnement pour détecter les versions d'essai
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!structureId) {
        setIsTrialVersion(false);
        return;
      }

      try {
        // Vérifier dans la collection subscriptions
        const subscriptionRef = doc(db, 'subscriptions', structureId);
        const subscriptionDoc = await getDoc(subscriptionRef);
        
        if (subscriptionDoc.exists()) {
          const subscriptionData = subscriptionDoc.data();
          const status = subscriptionData.status;
          // Si le statut est 'trialing', c'est une version d'essai
          setIsTrialVersion(status === 'trialing');
        } else {
          // Vérifier aussi dans le document utilisateur
          if (currentUser) {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              setIsTrialVersion(userData.subscriptionStatus === 'trialing');
            } else {
              setIsTrialVersion(false);
            }
          } else {
            setIsTrialVersion(false);
          }
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du statut d\'abonnement:', error);
        setIsTrialVersion(false);
      }
    };

    checkSubscriptionStatus();
  }, [structureId, currentUser]);

  // Sauvegarder le choix de l'entreprise
  const handleSaveCompanySelection = async () => {
    if (!selectedCompanyId || !structureId || !currentUser) return;

    try {
      const settingsRef = doc(db, 'ambassadorSettings', structureId);
      await setDoc(settingsRef, {
        companyId: selectedCompanyId,
        structureId: structureId,
        updatedAt: new Date(),
        updatedBy: currentUser.uid,
      });

      setSavedCompanyId(selectedCompanyId);
      setSnackbar({
        open: true,
        message: 'Entreprise sauvegardée avec succès',
        severity: 'success',
      });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la sauvegarde',
        severity: 'error',
      });
    }
  };

  // Charger les détails de l'entreprise sélectionnée
  useEffect(() => {
    const fetchCompanyDetails = async () => {
      if (!selectedCompanyId) {
        console.log('⚠️ Aucun selectedCompanyId, réinitialisation des contacts');
        setSelectedCompany(null);
        setContacts([]);
        return;
      }

      try {
        console.log('🔄 Chargement des détails de l\'entreprise:', selectedCompanyId);
        setLoadingCompany(true);
        
        // Récupérer l'entreprise
        const companyDoc = await getDoc(doc(db, 'companies', selectedCompanyId));
        if (companyDoc.exists()) {
          const data = companyDoc.data();
          
          // Convertir le nSiret en string
          let nSiretValue: string | undefined = undefined;
          if (data.nSiret) {
            if (typeof data.nSiret === 'string') {
              nSiretValue = data.nSiret;
            } else {
              const nSiretNum = Number(data.nSiret);
              if (!isNaN(nSiretNum) && isFinite(nSiretNum)) {
                nSiretValue = nSiretNum.toLocaleString('fr-FR', { useGrouping: false, maximumFractionDigits: 0 });
              } else {
                nSiretValue = String(data.nSiret);
              }
            }
          }

          let company: Company = {
            id: companyDoc.id,
            name: data.name || '',
            nSiret: nSiretValue,
            description: data.description || '',
            address: data.address || '',
            city: data.city || '',
            postalCode: data.postalCode || '',
            country: data.country || '',
            phone: data.phone || '',
            email: data.email || '',
            website: data.website || '',
            logo: data.logo || '',
            missionsCount: data.missionsCount || 0,
            totalRevenue: data.totalRevenue || 0,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate(),
            structureId: data.structureId || ''
          };

          // Pour les contacts avec accès, décrypter les données de leur entreprise
          if (isContactWithAccess) {
            const isEncrypted = (v: any) => typeof v === 'string' && v.startsWith('ENC:');
            const hasEncryptedData = [data.nSiret, data.siret, data.address, data.phone].some(isEncrypted);
            if (hasEncryptedData) {
              try {
                const functions = getFunctions();
                const decryptOwnCompanyData = httpsCallable(functions, 'decryptOwnCompanyData');
                const result = await decryptOwnCompanyData({ companyId: selectedCompanyId });
                if (result.data && (result.data as any).success && (result.data as any).decryptedData) {
                  const dec = (result.data as any).decryptedData;
                  let decNsiret: string | undefined;
                  if (dec.nSiret != null && !isEncrypted(dec.nSiret)) {
                    decNsiret = typeof dec.nSiret === 'string' ? dec.nSiret : String(dec.nSiret);
                  } else if (dec.siret != null && !isEncrypted(dec.siret)) {
                    decNsiret = typeof dec.siret === 'string' ? dec.siret : String(dec.siret);
                  }
                  company = {
                    ...company,
                    nSiret: decNsiret ?? company.nSiret,
                    address: (dec.address && !isEncrypted(dec.address) ? dec.address : company.address) ?? company.address,
                    phone: (dec.phone && !isEncrypted(dec.phone) ? dec.phone : company.phone) ?? company.phone,
                  };
                }
              } catch (decryptErr) {
                console.warn('Décryptage entreprise (contact) ignoré:', decryptErr);
              }
            }
          }
          
          setSelectedCompany(company);

          // Récupérer les contacts avec leurs accès
          // S'assurer que companyId est bien une string pour la requête
          const companyIdString = String(selectedCompanyId);
          console.log('🔍 Chargement des contacts pour companyId:', {
            original: selectedCompanyId,
            type: typeof selectedCompanyId,
            stringified: companyIdString
          });
          const contactsQuery = query(
            collection(db, 'contacts'),
            where('companyId', '==', companyIdString)
          );
          const contactsSnapshot = await getDocs(contactsQuery);
          console.log('📋 Contacts trouvés:', contactsSnapshot.docs.length);
          
          const contactsData = await Promise.all(contactsSnapshot.docs.map(async (contactDoc) => {
            const contactData = contactDoc.data();
            console.log('📝 Contact:', contactDoc.id, contactData);
            // Récupérer les permissions depuis une sous-collection ou un champ
            const accessDoc = await getDoc(doc(db, 'contactAccess', contactDoc.id));
            const accessData = accessDoc.exists() ? accessDoc.data() : {};
            
            return {
              id: contactDoc.id,
              ...contactData,
              accessLevel: accessData.accessLevel || 'read',
              canViewEvents: accessData.canViewEvents || false,
              canManageAmbassadors: accessData.canManageAmbassadors || false,
            } as ContactWithAccess;
          }));
          
          // Trier les contacts pour mettre le contact par défaut en premier
          contactsData.sort((a, b) => {
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return 0;
          });
          
          console.log('✅ Contacts chargés et triés:', contactsData.length);
          setContacts(contactsData);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des détails de l\'entreprise:', error);
      } finally {
        setLoadingCompany(false);
      }
    };

    fetchCompanyDetails();
  }, [selectedCompanyId, isContactWithAccess]);

  // Gestion de l'édition de l'entreprise
  const handleEditClick = () => {
    setEditedCompany(selectedCompany || {});
    setEditMode(true);
  };

  const handleEditClose = () => {
    setEditMode(false);
    setEditedCompany({});
  };

  const handleEditSave = async () => {
    if (!selectedCompanyId || !editedCompany) return;

    try {
      const companyRef = doc(db, 'companies', selectedCompanyId);
      
      // Filtrer les champs undefined
      const updateData = Object.entries(editedCompany).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);

      updateData.updatedAt = new Date();

      await updateDoc(companyRef, updateData);
      
      setSelectedCompany(prev => prev ? { ...prev, ...updateData } : null);
      setEditMode(false);
      setSnackbar({
        open: true,
        message: 'Entreprise mise à jour avec succès',
        severity: 'success',
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour de l\'entreprise',
        severity: 'error',
      });
    }
  };

  // Gestion des contacts
  const handleAddContact = async () => {
    if (!selectedCompanyId || !currentUser || !newContact.firstName || !newContact.lastName || !newContact.email) return;

    // Vérifier si c'est un contact avec accès (version d'essai)
    if (isContactWithAccess && userData?.status === 'entreprise') {
      setSnackbar({
        open: true,
        message: 'Version d\'essai : L\'ajout de contacts n\'est pas disponible pour les contacts avec accès.',
        severity: 'info',
      });
      return;
    }

    // Vérifier si c'est une version d'essai et si on essaie d'ajouter un contact avec accès
    if (isTrialVersion && (newContact.canViewEvents || newContact.canManageAmbassadors)) {
      setSnackbar({
        open: true,
        message: 'Version d\'essai : L\'ajout de contacts avec accès n\'est pas disponible. Veuillez passer à un abonnement actif.',
        severity: 'warning',
      });
      return;
    }

    try {
      // Si le nouveau contact est défini comme par défaut, retirer le statut par défaut des autres contacts
      const isDefault = newContact.isDefault || contacts.length === 0;
      if (isDefault) {
        for (const existingContact of contacts) {
          if (existingContact.isDefault) {
            await updateDoc(doc(db, 'contacts', existingContact.id), {
              isDefault: false
            });
          }
        }
      }

      // S'assurer que companyId est bien une string
      const companyIdString = String(selectedCompanyId);
      console.log('🔍 Vérification companyId:', {
        original: selectedCompanyId,
        type: typeof selectedCompanyId,
        stringified: companyIdString
      });

      const contactData = {
        firstName: newContact.firstName,
        lastName: newContact.lastName,
        email: newContact.email,
        position: newContact.position || '',
        phone: newContact.phone || '',
        linkedin: newContact.linkedin || '',
        gender: newContact.gender || null,
        createdAt: new Date(),
        createdBy: currentUser.uid,
        isDefault: isDefault,
        companyId: companyIdString,
        structureId: structureId,
      };

      console.log('➕ Création du contact avec companyId:', companyIdString, contactData);
      const contactRef = await addDoc(collection(db, 'contacts'), contactData);
      console.log('✅ Contact créé avec ID:', contactRef.id);
      
      // Sauvegarder les accès
      const accessData = {
        accessLevel: newContact.accessLevel || 'read',
        canViewEvents: newContact.canViewEvents || false,
        canManageAmbassadors: newContact.canManageAmbassadors || false,
      };
      console.log('🔐 Sauvegarde des accès pour contact:', contactRef.id, accessData);
      await setDoc(doc(db, 'contactAccess', contactRef.id), accessData);
      console.log('✅ Accès sauvegardés');

      const contact: ContactWithAccess = {
        id: contactRef.id,
        ...contactData,
        ...accessData,
      };

      // Mettre à jour la liste des contacts localement
      const updatedContacts = contacts.map(c => ({ ...c, isDefault: false }));
      setContacts([...updatedContacts, contact]);
      setAddContactDialogOpen(false);
      setNewContact({});
      setSnackbar({
        open: true,
        message: 'Contact ajouté avec succès',
        severity: 'success',
      });
    } catch (error) {
      console.error('Erreur lors de l\'ajout du contact:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de l\'ajout du contact',
        severity: 'error',
      });
    }
  };

  const handleEditContactClick = (contact: ContactWithAccess) => {
    setEditContact(contact);
    setEditContactDialogOpen(true);
  };

  const handleEditContactSave = async () => {
    if (!editContact.id) return;

    try {
      // Si le contact est défini comme par défaut, retirer le statut par défaut des autres contacts
      if (editContact.isDefault) {
        for (const existingContact of contacts) {
          if (existingContact.id !== editContact.id && existingContact.isDefault) {
            await updateDoc(doc(db, 'contacts', existingContact.id), {
              isDefault: false
            });
          }
        }
      }

      // Mettre à jour le contact
      const contactRef = doc(db, 'contacts', editContact.id);
      await updateDoc(contactRef, {
        firstName: editContact.firstName,
        lastName: editContact.lastName,
        email: editContact.email,
        position: editContact.position || '',
        phone: editContact.phone || '',
        linkedin: editContact.linkedin || '',
        gender: editContact.gender || null,
        isDefault: editContact.isDefault || false,
      });

      // Mettre à jour les accès
      const accessRef = doc(db, 'contactAccess', editContact.id);
      await setDoc(accessRef, {
        accessLevel: editContact.accessLevel || 'read',
        canViewEvents: editContact.canViewEvents || false,
        canManageAmbassadors: editContact.canManageAmbassadors || false,
      }, { merge: true });

      setContacts(prev =>
        prev.map(contact =>
          contact.id === editContact.id
            ? { ...contact, ...editContact }
            : contact
        )
      );
      setEditContactDialogOpen(false);
      setEditContact({});
      setSnackbar({
        open: true,
        message: 'Contact mis à jour avec succès',
        severity: 'success',
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du contact:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la mise à jour du contact',
        severity: 'error',
      });
    }
  };

  const handleDeleteContactClick = (contact: ContactWithAccess) => {
    setSelectedContact(contact);
    setDeleteContactDialogOpen(true);
  };

  const handleDeleteContactConfirm = async () => {
    if (!selectedContact) return;

    try {
      await deleteDoc(doc(db, 'contacts', selectedContact.id));
      await deleteDoc(doc(db, 'contactAccess', selectedContact.id));

      setContacts(prev => prev.filter(contact => contact.id !== selectedContact.id));
      setDeleteContactDialogOpen(false);
      setSelectedContact(null);
      setSnackbar({
        open: true,
        message: 'Contact supprimé avec succès',
        severity: 'success',
      });
    } catch (error) {
      console.error('Erreur lors de la suppression du contact:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la suppression du contact',
        severity: 'error',
      });
    }
  };

  const handleCreateAccessClick = (contact: ContactWithAccess) => {
    // Vérifier si c'est une version d'essai et si le contact a des permissions
    if (isTrialVersion && (contact.canViewEvents || contact.canManageAmbassadors)) {
      setSnackbar({
        open: true,
        message: 'Version d\'essai : La création d\'accès pour les contacts avec permissions n\'est pas disponible. Veuillez passer à un abonnement actif.',
        severity: 'warning',
      });
      return;
    }
    
    setContactForAccess(contact);
    setCreateAccessDialogOpen(true);
    setAccessPassword('');
  };

  const handleCreateAccessConfirm = async () => {
    if (!contactForAccess || !accessPassword || !selectedCompanyId) return;

    // Vérifier si c'est une version d'essai et si le contact a des permissions
    if (isTrialVersion && (contactForAccess.canViewEvents || contactForAccess.canManageAmbassadors)) {
      setSnackbar({
        open: true,
        message: 'Version d\'essai : La création d\'accès pour les contacts avec permissions n\'est pas disponible. Veuillez passer à un abonnement actif.',
        severity: 'warning',
      });
      return;
    }

    try {
      setCreatingAccess(true);
      const functions = getFunctions();
      const createContactUser = httpsCallable(functions, 'createContactUser');
      
      const { data } = await createContactUser({
        email: contactForAccess.email,
        password: accessPassword,
        displayName: [contactForAccess.firstName, contactForAccess.lastName].filter(Boolean).join(' '),
        firstName: contactForAccess.firstName,
        lastName: contactForAccess.lastName,
        structureId,
        companyId: selectedCompanyId,
        contactId: contactForAccess.id,
        accessLevel: contactForAccess.accessLevel || 'read',
        canViewEvents: contactForAccess.canViewEvents || false,
        canManageAmbassadors: contactForAccess.canManageAmbassadors || false
      });

      // Mettre à jour localement le contact pour indiquer qu'il a un accès
      // On suppose que la fonction cloud a mis à jour le document
      setContacts(prev => prev.map(c => 
        c.id === contactForAccess.id 
          ? { ...c, userId: (data as any).uid } 
          : c
      ));

      setCreateAccessDialogOpen(false);
      setContactForAccess(null);
      setAccessPassword('');
      setSnackbar({
        open: true,
        message: 'Accès créé avec succès',
        severity: 'success',
      });
    } catch (error: any) {
      console.error('Erreur lors de la création de l\'accès:', error);
      setSnackbar({
        open: true,
        message: error.message || 'Erreur lors de la création de l\'accès',
        severity: 'error',
      });
    } finally {
      setCreatingAccess(false);
    }
  };


  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ fontFamily: appleFont }}>
      {/* Sélecteur d'entreprise avec bouton de sauvegarde - Réservé aux superadmins */}
      {isSuperAdmin && (
        <Box sx={{ mb: 4, display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <FormControl fullWidth sx={{ maxWidth: '500px' }}>
            <InputLabel id="company-select-label" sx={{ fontFamily: appleFont }}>
              Sélectionner une entreprise
            </InputLabel>
            <Select
              labelId="company-select-label"
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              label="Sélectionner une entreprise"
              sx={{
                fontFamily: appleFont,
                borderRadius: '12px',
              }}
            >
              {companies.map((company) => (
                <MenuItem key={company.id} value={company.id} sx={{ fontFamily: appleFont }}>
                  {company.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            onClick={handleSaveCompanySelection}
            disabled={!selectedCompanyId || selectedCompanyId === savedCompanyId}
            startIcon={<SaveIcon />}
            sx={{
              fontFamily: appleFont,
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {selectedCompanyId === savedCompanyId ? 'Sauvegardé' : 'Sauvegarder'}
          </Button>
        </Box>
      )}

      {/* Détails de l'entreprise */}
      {loadingCompany ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      ) : selectedCompany ? (
        <Box>
          {/* En-tête avec logo et nom */}
          <Paper
            elevation={0}
            sx={{
              p: 4,
              mb: 3,
              borderRadius: '20px',
              backgroundColor: '#fff',
              border: '1px solid #f3f4f6',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {selectedCompany.logo ? (
                  <Avatar
                    src={selectedCompany.logo}
                    alt={selectedCompany.name}
                    sx={{
                      width: 100,
                      height: 100,
                      borderRadius: '16px',
                      objectFit: 'contain',
                    }}
                    variant="rounded"
                  >
                    <BusinessIcon sx={{ fontSize: 50 }} />
                  </Avatar>
                ) : (
                  <Avatar
                    sx={{
                      width: 100,
                      height: 100,
                      borderRadius: '16px',
                      backgroundColor: '#2563eb',
                    }}
                    variant="rounded"
                  >
                    <BusinessIcon sx={{ fontSize: 50, color: 'white' }} />
                  </Avatar>
                )}
                <Box>
                  <Typography
                    variant="h4"
                    sx={{
                      fontFamily: appleFont,
                      fontWeight: 600,
                      color: '#111827',
                      mb: 1,
                    }}
                  >
                    {selectedCompany.name}
                  </Typography>
                  {selectedCompany.nSiret && (
                    <Chip
                      label={`SIRET: ${selectedCompany.nSiret}`}
                      size="small"
                      sx={{
                        fontFamily: appleFont,
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                      }}
                    />
                  )}
                </Box>
              </Box>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={handleEditClick}
                sx={{
                  fontFamily: appleFont,
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 600,
                }}
              >
                Modifier
              </Button>
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Informations générales */}
            <Grid container spacing={3}>
              {selectedCompany.description && (
                <Grid item xs={12}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontFamily: appleFont,
                      fontWeight: 600,
                      color: '#6b7280',
                      mb: 1,
                      textTransform: 'uppercase',
                      fontSize: '12px',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Description
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontFamily: appleFont,
                      color: '#111827',
                      lineHeight: 1.6,
                    }}
                  >
                    {selectedCompany.description}
                  </Typography>
                </Grid>
              )}

              {/* Adresse */}
              {(selectedCompany.address || selectedCompany.city || selectedCompany.postalCode) && (
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <LocationIcon sx={{ color: '#6b7280', mt: 0.5 }} />
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontFamily: appleFont,
                          fontWeight: 600,
                          color: '#6b7280',
                          mb: 0.5,
                          textTransform: 'uppercase',
                          fontSize: '12px',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Adresse
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          fontFamily: appleFont,
                          color: '#111827',
                        }}
                      >
                        {[
                          selectedCompany.address,
                          selectedCompany.postalCode,
                          selectedCompany.city,
                          selectedCompany.country,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              )}

              {/* Téléphone */}
              {selectedCompany.phone && (
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <PhoneIcon sx={{ color: '#6b7280', mt: 0.5 }} />
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontFamily: appleFont,
                          fontWeight: 600,
                          color: '#6b7280',
                          mb: 0.5,
                          textTransform: 'uppercase',
                          fontSize: '12px',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Téléphone
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          fontFamily: appleFont,
                          color: '#111827',
                        }}
                      >
                        {selectedCompany.phone}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              )}

              {/* Email */}
              {selectedCompany.email && (
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <EmailIcon sx={{ color: '#6b7280', mt: 0.5 }} />
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontFamily: appleFont,
                          fontWeight: 600,
                          color: '#6b7280',
                          mb: 0.5,
                          textTransform: 'uppercase',
                          fontSize: '12px',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Email
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          fontFamily: appleFont,
                          color: '#111827',
                        }}
                      >
                        {selectedCompany.email}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              )}

              {/* Site web */}
              {selectedCompany.website && (
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <LanguageIcon sx={{ color: '#6b7280', mt: 0.5 }} />
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontFamily: appleFont,
                          fontWeight: 600,
                          color: '#6b7280',
                          mb: 0.5,
                          textTransform: 'uppercase',
                          fontSize: '12px',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Site web
                      </Typography>
                      <Typography
                        variant="body1"
                        component="a"
                        href={selectedCompany.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          fontFamily: appleFont,
                          color: '#2563eb',
                          textDecoration: 'none',
                          '&:hover': {
                            textDecoration: 'underline',
                          },
                        }}
                      >
                        {selectedCompany.website}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              )}

              {/* Statistiques */}
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Chip
                    label={`${selectedCompany.missionsCount || 0} mission(s)`}
                    sx={{
                      fontFamily: appleFont,
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      fontWeight: 600,
                    }}
                  />
                  <Chip
                    label={`${(selectedCompany.totalRevenue || 0).toLocaleString('fr-FR')} €`}
                    sx={{
                      fontFamily: appleFont,
                      backgroundColor: '#ecfdf5',
                      color: '#059669',
                      fontWeight: 600,
                    }}
                  />
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Contacts */}
          <Paper
            elevation={0}
            sx={{
              p: 4,
              borderRadius: '20px',
              backgroundColor: '#fff',
              border: '1px solid #f3f4f6',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: appleFont,
                  fontWeight: 600,
                  color: '#111827',
                }}
              >
                Contacts
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAddContactDialogOpen(true)}
                sx={{
                  fontFamily: appleFont,
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 600,
                }}
              >
                Ajouter un contact
              </Button>
            </Box>

            {contacts.length === 0 ? (
              <Typography
                variant="body2"
                sx={{
                  fontFamily: appleFont,
                  color: '#6b7280',
                  fontStyle: 'italic',
                }}
              >
                Aucun contact enregistré pour cette entreprise.
              </Typography>
            ) : (
              <List>
                {contacts.map((contact) => (
                  <React.Fragment key={contact.id}>
                    <ListItem
                      sx={{
                        px: 0,
                        py: 2,
                        '&:hover': {
                          backgroundColor: '#f9fafb',
                          borderRadius: '12px',
                        },
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            backgroundColor: '#2563eb',
                            width: 48,
                            height: 48,
                          }}
                        >
                          {contact.firstName?.[0]?.toUpperCase() || contact.lastName?.[0]?.toUpperCase() || '?'}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography
                              component="span"
                              variant="subtitle1"
                              sx={{
                                fontFamily: appleFont,
                                fontWeight: 600,
                                color: '#111827',
                              }}
                            >
                              {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Sans nom'}
                            </Typography>
                            {contact.isDefault && (
                              <Chip
                                label="Par défaut"
                                size="small"
                                sx={{
                                  fontFamily: appleFont,
                                  backgroundColor: '#fef3c7',
                                  color: '#92400e',
                                  height: '20px',
                                  fontSize: '11px',
                                }}
                              />
                            )}
                            {contact.accessLevel && (
                              <Chip
                                icon={<LockIcon sx={{ fontSize: 12 }} />}
                                label={contact.accessLevel === 'admin' ? 'Admin' : contact.accessLevel === 'write' ? 'Écriture' : 'Lecture'}
                                size="small"
                                sx={{
                                  fontFamily: appleFont,
                                  backgroundColor: contact.accessLevel === 'admin' ? '#fee2e2' : contact.accessLevel === 'write' ? '#dbeafe' : '#f3f4f6',
                                  color: contact.accessLevel === 'admin' ? '#991b1b' : contact.accessLevel === 'write' ? '#1e40af' : '#374151',
                                  height: '20px',
                                  fontSize: '11px',
                                }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box component="span" sx={{ mt: 1, display: 'block' }}>
                            {contact.position && (
                              <Typography
                                component="span"
                                variant="body2"
                                sx={{
                                  fontFamily: appleFont,
                                  color: '#6b7280',
                                  mb: 0.5,
                                  display: 'block',
                                }}
                              >
                                {contact.position}
                              </Typography>
                            )}
                            <Box component="span" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                              {contact.email && (
                                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <EmailIcon sx={{ fontSize: 14, color: '#6b7280' }} />
                                  <Typography
                                    variant="body2"
                                    component="a"
                                    href={`mailto:${contact.email}`}
                                    sx={{
                                      fontFamily: appleFont,
                                      color: '#2563eb',
                                      textDecoration: 'none',
                                      '&:hover': {
                                        textDecoration: 'underline',
                                      },
                                    }}
                                  >
                                    {contact.email}
                                  </Typography>
                                </Box>
                              )}
                              {contact.phone && (
                                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <PhoneIcon sx={{ fontSize: 14, color: '#6b7280' }} />
                                  <Typography
                                    variant="body2"
                                    component="a"
                                    href={`tel:${contact.phone}`}
                                    sx={{
                                      fontFamily: appleFont,
                                      color: '#2563eb',
                                      textDecoration: 'none',
                                      '&:hover': {
                                        textDecoration: 'underline',
                                      },
                                    }}
                                  >
                                    {contact.phone}
                                  </Typography>
                                </Box>
                              )}
                              {contact.linkedin && (
                                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <LinkedInIcon sx={{ fontSize: 14, color: '#6b7280' }} />
                                  <Typography
                                    variant="body2"
                                    component="a"
                                    href={contact.linkedin}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    sx={{
                                      fontFamily: appleFont,
                                      color: '#2563eb',
                                      textDecoration: 'none',
                                      '&:hover': {
                                        textDecoration: 'underline',
                                      },
                                    }}
                                  >
                                    LinkedIn
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </Box>
                        }
                      />
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {!contact.userId && (
                          <IconButton
                            size="small"
                            onClick={() => handleCreateAccessClick(contact)}
                            sx={{ color: '#f59e0b' }}
                            title={isTrialVersion && (contact.canViewEvents || contact.canManageAmbassadors) 
                              ? "Version d'essai : Création d'accès non disponible pour les contacts avec permissions"
                              : "Créer un accès utilisateur"}
                            disabled={isTrialVersion && (contact.canViewEvents || contact.canManageAmbassadors)}
                          >
                            <LockIcon fontSize="small" />
                          </IconButton>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => handleEditContactClick(contact)}
                          sx={{ color: '#2563eb' }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteContactClick(contact)}
                          sx={{ color: '#ef4444' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Box>
      ) : (
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: '20px',
            backgroundColor: '#fff',
            border: '1px solid #f3f4f6',
            textAlign: 'center',
          }}
        >
          <Typography
            variant="body1"
            sx={{
              fontFamily: appleFont,
              color: '#6b7280',
            }}
          >
            Sélectionnez une entreprise pour afficher ses informations.
          </Typography>
        </Paper>
      )}

      {/* Dialog d'édition de l'entreprise */}
      <Dialog open={editMode} onClose={handleEditClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontFamily: appleFont }}>Modifier l'entreprise</Typography>
            <IconButton onClick={handleEditClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Nom"
                fullWidth
                value={editedCompany.name || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, name: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="nSiret"
                fullWidth
                value={editedCompany.nSiret || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, nSiret: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={3}
                value={editedCompany.description || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, description: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Adresse"
                fullWidth
                value={editedCompany.address || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, address: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Code postal"
                fullWidth
                value={editedCompany.postalCode || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, postalCode: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Ville"
                fullWidth
                value={editedCompany.city || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, city: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Pays"
                fullWidth
                value={editedCompany.country || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, country: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Téléphone"
                fullWidth
                value={editedCompany.phone || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, phone: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email"
                fullWidth
                value={editedCompany.email || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, email: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Site web"
                fullWidth
                value={editedCompany.website || ''}
                onChange={(e) => setEditedCompany(prev => ({ ...prev, website: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditClose} sx={{ fontFamily: appleFont }}>Annuler</Button>
          <Button
            onClick={handleEditSave}
            variant="contained"
            startIcon={<SaveIcon />}
            sx={{ fontFamily: appleFont }}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog d'ajout de contact */}
      <Dialog
        open={addContactDialogOpen}
        onClose={() => setAddContactDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontFamily: appleFont }}>Ajouter un contact</Typography>
            <IconButton onClick={() => setAddContactDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Prénom *"
                fullWidth
                value={newContact.firstName || ''}
                onChange={(e) => setNewContact(prev => ({ ...prev, firstName: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Nom *"
                fullWidth
                value={newContact.lastName || ''}
                onChange={(e) => setNewContact(prev => ({ ...prev, lastName: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Email *"
                fullWidth
                type="email"
                value={newContact.email || ''}
                onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Poste"
                fullWidth
                value={newContact.position || ''}
                onChange={(e) => setNewContact(prev => ({ ...prev, position: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Téléphone"
                fullWidth
                value={newContact.phone || ''}
                onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="LinkedIn"
                fullWidth
                value={newContact.linkedin || ''}
                onChange={(e) => setNewContact(prev => ({ ...prev, linkedin: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ fontFamily: appleFont, mb: 2, fontWeight: 600 }}>
                Accès et permissions
              </Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel sx={{ fontFamily: appleFont }}>Niveau d'accès</InputLabel>
                <Select
                  value={newContact.accessLevel || 'read'}
                  onChange={(e) => setNewContact(prev => ({ ...prev, accessLevel: e.target.value as 'read' | 'write' | 'admin' }))}
                  label="Niveau d'accès"
                  sx={{ fontFamily: appleFont }}
                >
                  <MenuItem value="read" sx={{ fontFamily: appleFont }}>Lecture seule</MenuItem>
                  <MenuItem value="write" sx={{ fontFamily: appleFont }}>Écriture</MenuItem>
                  <MenuItem value="admin" sx={{ fontFamily: appleFont }}>Administrateur</MenuItem>
                </Select>
              </FormControl>
              {isTrialVersion && (
                <Alert severity="warning" sx={{ mb: 2, fontFamily: appleFont }}>
                  Version d'essai : L'ajout de contacts avec accès n'est pas disponible. Veuillez passer à un abonnement actif.
                </Alert>
              )}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newContact.canViewEvents || false}
                    onChange={(e) => setNewContact(prev => ({ ...prev, canViewEvents: e.target.checked }))}
                    disabled={isTrialVersion}
                  />
                }
                label="Peut voir les événements"
                sx={{ fontFamily: appleFont }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newContact.canManageAmbassadors || false}
                    onChange={(e) => setNewContact(prev => ({ ...prev, canManageAmbassadors: e.target.checked }))}
                    disabled={isTrialVersion}
                  />
                }
                label="Peut gérer les ambassadeurs"
                sx={{ fontFamily: appleFont }}
              />
              <Divider sx={{ my: 2 }} />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newContact.isDefault || contacts.length === 0}
                    onChange={(e) => setNewContact(prev => ({ ...prev, isDefault: e.target.checked }))}
                    disabled={contacts.length === 0}
                  />
                }
                label="Contact par défaut"
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddContactDialogOpen(false)} sx={{ fontFamily: appleFont }}>Annuler</Button>
          <Button
            onClick={handleAddContact}
            variant="contained"
            startIcon={<AddIcon />}
            disabled={!newContact.firstName || !newContact.lastName || !newContact.email}
            sx={{ fontFamily: appleFont }}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog d'édition de contact */}
      <Dialog
        open={editContactDialogOpen}
        onClose={() => setEditContactDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontFamily: appleFont }}>Modifier le contact</Typography>
            <IconButton onClick={() => setEditContactDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Prénom *"
                fullWidth
                value={editContact.firstName || ''}
                onChange={(e) => setEditContact(prev => ({ ...prev, firstName: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Nom *"
                fullWidth
                value={editContact.lastName || ''}
                onChange={(e) => setEditContact(prev => ({ ...prev, lastName: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Email *"
                fullWidth
                type="email"
                value={editContact.email || ''}
                onChange={(e) => setEditContact(prev => ({ ...prev, email: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Poste"
                fullWidth
                value={editContact.position || ''}
                onChange={(e) => setEditContact(prev => ({ ...prev, position: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Téléphone"
                fullWidth
                value={editContact.phone || ''}
                onChange={(e) => setEditContact(prev => ({ ...prev, phone: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="LinkedIn"
                fullWidth
                value={editContact.linkedin || ''}
                onChange={(e) => setEditContact(prev => ({ ...prev, linkedin: e.target.value }))}
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ fontFamily: appleFont, mb: 2, fontWeight: 600 }}>
                Accès et permissions
              </Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel sx={{ fontFamily: appleFont }}>Niveau d'accès</InputLabel>
                <Select
                  value={editContact.accessLevel || 'read'}
                  onChange={(e) => setEditContact(prev => ({ ...prev, accessLevel: e.target.value as 'read' | 'write' | 'admin' }))}
                  label="Niveau d'accès"
                  sx={{ fontFamily: appleFont }}
                >
                  <MenuItem value="read" sx={{ fontFamily: appleFont }}>Lecture seule</MenuItem>
                  <MenuItem value="write" sx={{ fontFamily: appleFont }}>Écriture</MenuItem>
                  <MenuItem value="admin" sx={{ fontFamily: appleFont }}>Administrateur</MenuItem>
                </Select>
              </FormControl>
              {isTrialVersion && (
                <Alert severity="warning" sx={{ mb: 2, fontFamily: appleFont }}>
                  Version d'essai : La modification des accès n'est pas disponible. Veuillez passer à un abonnement actif.
                </Alert>
              )}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={editContact.canViewEvents || false}
                    onChange={(e) => setEditContact(prev => ({ ...prev, canViewEvents: e.target.checked }))}
                    disabled={isTrialVersion}
                  />
                }
                label="Peut voir les événements"
                sx={{ fontFamily: appleFont }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={editContact.canManageAmbassadors || false}
                    onChange={(e) => setEditContact(prev => ({ ...prev, canManageAmbassadors: e.target.checked }))}
                    disabled={isTrialVersion}
                  />
                }
                label="Peut gérer les ambassadeurs"
                sx={{ fontFamily: appleFont }}
              />
              <Divider sx={{ my: 2 }} />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={editContact.isDefault || false}
                    onChange={async (e) => {
                      const newIsDefault = e.target.checked;
                      // Si on définit ce contact comme par défaut, retirer le statut des autres
                      if (newIsDefault) {
                        for (const contact of contacts) {
                          if (contact.id !== editContact.id && contact.isDefault) {
                            await updateDoc(doc(db, 'contacts', contact.id), {
                              isDefault: false
                            });
                          }
                        }
                      }
                      setEditContact(prev => ({ ...prev, isDefault: newIsDefault }));
                    }}
                  />
                }
                label="Contact par défaut"
                sx={{ fontFamily: appleFont }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditContactDialogOpen(false)} sx={{ fontFamily: appleFont }}>Annuler</Button>
          <Button
            onClick={handleEditContactSave}
            variant="contained"
            startIcon={<SaveIcon />}
            sx={{ fontFamily: appleFont }}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteContactDialogOpen} onClose={() => setDeleteContactDialogOpen(false)}>
        <DialogTitle sx={{ fontFamily: appleFont }}>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontFamily: appleFont }}>
            Êtes-vous sûr de vouloir supprimer ce contact ? Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteContactDialogOpen(false)} sx={{ fontFamily: appleFont }}>Annuler</Button>
          <Button
            onClick={handleDeleteContactConfirm}
            color="error"
            variant="contained"
            sx={{ fontFamily: appleFont }}
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de création d'accès */}
      <Dialog open={createAccessDialogOpen} onClose={() => setCreateAccessDialogOpen(false)}>
        <DialogTitle sx={{ fontFamily: appleFont }}>Créer un accès utilisateur</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontFamily: appleFont, mb: 2 }}>
            Créez un compte utilisateur pour <strong>{contactForAccess?.firstName} {contactForAccess?.lastName}</strong>.
            Cet utilisateur aura accès à la plateforme selon les permissions définies.
          </Typography>
          <TextField
            label="Mot de passe *"
            fullWidth
            type="password"
            value={accessPassword}
            onChange={(e) => setAccessPassword(e.target.value)}
            sx={{ fontFamily: appleFont, mt: 2 }}
            helperText="Au moins 6 caractères"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateAccessDialogOpen(false)} sx={{ fontFamily: appleFont }}>Annuler</Button>
          <Button
            onClick={handleCreateAccessConfirm}
            variant="contained"
            disabled={accessPassword.length < 6 || creatingAccess}
            sx={{ fontFamily: appleFont }}
          >
            {creatingAccess ? 'Création...' : 'Créer l\'accès'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar pour les notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ fontFamily: appleFont }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
