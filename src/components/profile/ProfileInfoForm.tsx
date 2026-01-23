import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Switch,
  FormControlLabel,
  Paper,
  IconButton,
  Divider,
  Stack,
  SelectChangeEvent
} from '@mui/material';
import { Save as SaveIcon, Edit as EditIcon, Close as CloseIcon } from '@mui/icons-material';
import { UserData } from '../../types/user';
import { updateUserDocument } from '../../firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from 'notistack';
import { getFunctions, httpsCallable } from 'firebase/functions';

// --- Types & Styles ---

interface ProfileInfoFormProps {
  userData: UserData;
  onUpdate: () => void;
}

const textFieldStyles = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#f8f9fa',
    '& fieldset': { borderColor: 'transparent' },
    '&:hover fieldset': { borderColor: 'rgba(0, 0, 0, 0.1)' },
    '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: '1px' },
  },
};

// --- Composant Helper: SectionCard ---
// Gère l'affichage Lecture vs Édition pour une section donnée
interface SectionCardProps {
  title: string;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  loading: boolean;
  children: React.ReactNode; // Le formulaire (mode édition)
  displayData: Array<{ label: string; value: React.ReactNode }>; // Les données à afficher (mode lecture)
}

const SectionCard: React.FC<SectionCardProps> = ({
  title,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  loading,
  children,
  displayData
}) => {
  return (
    <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" fontWeight="bold">
          {title}
        </Typography>
        {!isEditing ? (
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={onEdit}
            size="small"
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            Modifier
          </Button>
        ) : (
          <Box>
             <IconButton onClick={onCancel} size="small" sx={{ mr: 1 }}>
               <CloseIcon />
             </IconButton>
          </Box>
        )}
      </Box>

      {isEditing ? (
        <Box component="form" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
          <Grid container spacing={3}>
            {children}
            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <Button onClick={onCancel} sx={{ mr: 2 }}>Annuler</Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={loading}
              >
                Enregistrer
              </Button>
            </Grid>
          </Grid>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {displayData.map((item, index) => (
            <Grid item xs={12} md={6} key={index}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {item.label}
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {item.value || '-'}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      )}
    </Paper>
  );
};

const ProfileInfoForm: React.FC<ProfileInfoFormProps> = ({ userData, onUpdate }) => {
  const { currentUser } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  
  // État local pour le formulaire (copie de userData)
  const [formData, setFormData] = useState<Partial<UserData>>({});
  const [loading, setLoading] = useState(false);
  
  // Gestion de l'édition section par section
  const [editingSection, setEditingSection] = useState<string | null>(null);
  
  // État pour les erreurs de validation par champ
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const formatDate = (date: any) => {
    if (!date) return '';
    
    // Si c'est déjà une string au format ISO (YYYY-MM-DD) ou autre format de date string
    if (typeof date === 'string') {
      // Vérifier si c'est un format de date valide (YYYY-MM-DD)
      const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        // Formater la date ISO en format français
        const dateObj = new Date(date);
        if (!isNaN(dateObj.getTime())) {
          return dateObj.toLocaleDateString('fr-FR');
        }
      }
      // Si ce n'est pas un format reconnu, essayer de parser quand même
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toLocaleDateString('fr-FR');
      }
      // Si le parsing échoue, retourner la string telle quelle
      return date;
    }
    
    // Si c'est un Timestamp Firestore
    if (typeof date.toDate === 'function') {
      return date.toDate().toLocaleDateString('fr-FR');
    }
    
    // Si c'est une Date
    if (date instanceof Date) {
      return date.toLocaleDateString('fr-FR');
    }
    
    // Dernier recours : essayer de parser
    try {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toLocaleDateString('fr-FR');
      }
    } catch (e) {
      console.warn('Erreur lors du formatage de la date:', date, e);
    }
    
    return '';
  };

  useEffect(() => {
    if (userData) {
      setFormData({ ...userData });
    }
  }, [userData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Validation en temps réel pour certains champs
    let processedValue = value;
    
    if (name === 'postalCode') {
      // Code postal : seulement 5 chiffres
      processedValue = value.replace(/\D/g, '').slice(0, 5);
    } else if (name === 'phone') {
      // Téléphone : seulement chiffres, espaces, +, - et ()
      processedValue = value.replace(/[^\d+\s()-]/g, '');
    } else if (name === 'socialSecurityNumber') {
      // Numéro de sécurité sociale : seulement 13 chiffres
      processedValue = value.replace(/\D/g, '').slice(0, 13);
    }
    
    setFormData(prev => ({ ...prev, [name]: processedValue }));
    
    // Effacer l'erreur du champ quand l'utilisateur modifie la valeur
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSelectChange = (e: SelectChangeEvent) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, checked } = e.target;
      setFormData(prev => ({ 
        ...prev, 
        [name]: checked,
        acceptsElectronicDocumentsDate: checked ? new Date() : undefined
      }));
  };

  const validateFormData = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    // Validation date de naissance (minimum 18 ans)
    if (formData.birthDate) {
      const today = new Date();
      const birthDateObj = new Date(formData.birthDate);
      const age = today.getFullYear() - birthDateObj.getFullYear();
      const monthDiff = today.getMonth() - birthDateObj.getMonth();
      const dayDiff = today.getDate() - birthDateObj.getDate();
      const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
      
      if (actualAge < 18) {
        errors.birthDate = 'Vous devez avoir au moins 18 ans';
      }
    }
    
    // Validation code postal (5 chiffres) - seulement si rempli
    if (formData.postalCode && formData.postalCode.trim() !== '') {
      if (!/^\d{5}$/.test(formData.postalCode)) {
        errors.postalCode = 'Le code postal doit contenir exactement 5 chiffres';
      }
    }
    
    // Validation téléphone (10 chiffres) - seulement si rempli
    if (formData.phone && formData.phone.trim() !== '') {
      const phoneDigits = formData.phone.replace(/\D/g, '');
      if (phoneDigits.length !== 10) {
        errors.phone = 'Le numéro de téléphone doit contenir exactement 10 chiffres';
      }
    }
    
    // Validation numéro de sécurité sociale (13 chiffres) - seulement si rempli
    if (formData.socialSecurityNumber && formData.socialSecurityNumber.trim() !== '') {
      const ssnDigits = formData.socialSecurityNumber.replace(/\D/g, '');
      if (ssnDigits.length !== 13) {
        errors.socialSecurityNumber = 'Le numéro de sécurité sociale doit contenir exactement 13 chiffres';
      }
    }
    
    return errors;
  };

  const handleSave = async (sectionKey: string) => {
    if (!currentUser) return;
    
    // Valider les données avant de sauvegarder
    const errors = validateFormData();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstError = Object.values(errors)[0];
      enqueueSnackbar(firstError, { variant: 'error' });
      return;
    }
    
    // Effacer les erreurs si la validation passe
    setFieldErrors({});
    
    setLoading(true);
    try {
      // Chiffrer les données sensibles avant de sauvegarder
      let dataToSave = { ...formData };
      
      try {
        const functions = getFunctions();
        const encryptUserData = httpsCallable(functions, 'encryptUserData');
        
        const result = await encryptUserData({
          userId: currentUser.uid,
          userData: dataToSave
        });
        
        if (result.data.success && result.data.encryptedData) {
          // Utiliser les données chiffrées
          dataToSave = {
            ...dataToSave,
            ...result.data.encryptedData
          };
        }
      } catch (encryptError: any) {
        // Si le chiffrement échoue, continuer quand même avec les données non chiffrées
        // (pour la compatibilité rétroactive avec les anciennes données)
        console.warn('Impossible de chiffrer les données (peut être normal si non chiffrées):', encryptError.message);
        // Ne pas bloquer la sauvegarde si le chiffrement échoue
      }
      
      // Sauvegarder les données (chiffrées si possible)
      await updateUserDocument(currentUser.uid, {
        ...dataToSave,
        updatedAt: new Date()
      });
      
      onUpdate();
      setEditingSection(null);
      setFieldErrors({}); // Effacer les erreurs après sauvegarde réussie
      enqueueSnackbar('Modifications enregistrées', { variant: 'success' });
    } catch (error) {
      console.error('Erreur save:', error);
      enqueueSnackbar('Erreur lors de la sauvegarde', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset formData to userData
    if (userData) setFormData({ ...userData });
    setEditingSection(null);
    setFieldErrors({}); // Effacer les erreurs lors de l'annulation
  };

  const isStudent = userData.status === 'etudiant' || userData.status === 'membre' || userData.status === 'admin' || userData.status === 'superadmin';
  const isCompany = userData.status === 'entreprise';

  // Fonction pour formater une valeur - si elle est cryptée, indiquer qu'elle n'a pas pu être décryptée
  const formatDisplayValue = (value: any): any => {
    if (!value || typeof value !== 'string') return value || '-';
    // Si la valeur commence par ENC:, elle n'a pas été décryptée
    // On affiche un message informatif
    if (value.startsWith('ENC:')) {
      return '[Donnée cryptée - Déchiffrement en cours...]';
    }
    return value || '-';
  };

  // --- Préparation des données d'affichage ---
  
  // Fonction pour formater la date de naissance (gérer aussi les valeurs cryptées)
  const formatBirthDate = (birthDate: any): string => {
    if (!birthDate) return '-';
    // Si c'est une valeur cryptée, elle devrait déjà être décryptée dans Profile.tsx
    // Mais si elle ne l'est pas, on le détecte
    if (typeof birthDate === 'string' && birthDate.startsWith('ENC:')) {
      return '[Date cryptée]';
    }
    return formatDate(birthDate);
  };

  const personalInfoData = [
    { label: 'Prénom', value: userData.firstName || '-' },
    { label: 'Nom', value: userData.lastName || '-' },
    { label: 'Email', value: userData.email || '-' },
    { label: 'Téléphone', value: formatDisplayValue(userData.phone) },
    { label: 'Date de naissance', value: formatBirthDate(userData.birthDate) },
    { label: 'Genre', value: userData.gender === 'M' ? 'Homme' : userData.gender === 'F' ? 'Femme' : userData.gender || '-' },
    { label: 'Lieu de naissance', value: formatDisplayValue(userData.birthPlace) },
    { label: 'Nationalité', value: userData.nationality || '-' },
    { label: 'LinkedIn', value: userData.linkedinUrl ? <a href={userData.linkedinUrl} target="_blank" rel="noreferrer" style={{color: '#1976d2', textDecoration: 'none'}}>Voir le profil</a> : '-' },
  ];

  const addressData = [
    { label: 'Adresse', value: formatDisplayValue(userData.address) },
    { label: 'Code Postal', value: formatDisplayValue(userData.postalCode) },
    // On pourrait déduire la ville du code postal si on avait une API, ou ajouter un champ Ville
  ];

  const studentData = [
    { label: 'École / Université', value: userData.ecole },
    { label: 'Programme / Formation', value: userData.program },
    { label: 'Année de promotion', value: userData.graduationYear },
    { label: 'Numéro Étudiant', value: userData.studentId },
    { label: 'Numéro de Sécurité Sociale', value: userData.socialSecurityNumber },
  ];

  const companyData = [
    { label: 'Entreprise', value: userData.companyName },
    { label: 'Poste', value: userData.position },
    { label: 'SIRET', value: userData.siret },
    { label: 'TVA Intracommunautaire', value: userData.tvaIntra },
  ];

  return (
    <Box>
      {/* 1. SECTION: INFORMATIONS PERSONNELLES */}
      <SectionCard
        title="Informations Personnelles"
        isEditing={editingSection === 'personal'}
        onEdit={() => setEditingSection('personal')}
        onCancel={handleCancel}
        onSave={() => handleSave('personal')}
        loading={loading}
        displayData={personalInfoData}
      >
        <Grid item xs={12} md={6}>
          <TextField fullWidth label="Prénom" name="firstName" value={formData.firstName || ''} onChange={handleChange} sx={textFieldStyles} />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField fullWidth label="Nom" name="lastName" value={formData.lastName || ''} onChange={handleChange} sx={textFieldStyles} />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField 
            fullWidth 
            label="Téléphone" 
            name="phone" 
            value={formData.phone || ''} 
            onChange={handleChange} 
            error={!!fieldErrors.phone}
            helperText={fieldErrors.phone || "10 chiffres requis (ex: 06 12 34 56 78)"}
            sx={textFieldStyles} 
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField 
            fullWidth 
            label="Date de naissance" 
            name="birthDate" 
            type="date"
            InputLabelProps={{ shrink: true }}
            value={formData.birthDate || ''} 
            onChange={handleChange} 
            error={!!fieldErrors.birthDate}
            helperText={fieldErrors.birthDate || "Vous devez avoir au moins 18 ans"}
            inputProps={{ max: new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0] }}
            sx={textFieldStyles} 
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth sx={textFieldStyles}>
            <InputLabel>Genre</InputLabel>
            <Select name="gender" value={formData.gender || ''} label="Genre" onChange={handleSelectChange}>
              <MenuItem value="M">Homme</MenuItem>
              <MenuItem value="F">Femme</MenuItem>
              <MenuItem value="Autre">Autre</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
           <TextField fullWidth label="Lieu de naissance" name="birthPlace" value={formData.birthPlace || ''} onChange={handleChange} sx={textFieldStyles} />
        </Grid>
        <Grid item xs={12} md={6}>
           <TextField fullWidth label="Nationalité" name="nationality" value={formData.nationality || ''} onChange={handleChange} sx={textFieldStyles} />
        </Grid>
         <Grid item xs={12} md={6}>
           <TextField fullWidth label="LinkedIn URL" name="linkedinUrl" value={formData.linkedinUrl || ''} onChange={handleChange} sx={textFieldStyles} />
        </Grid>
      </SectionCard>

      {/* 2. SECTION: ADRESSE */}
      <SectionCard
        title="Adresse"
        isEditing={editingSection === 'address'}
        onEdit={() => setEditingSection('address')}
        onCancel={handleCancel}
        onSave={() => handleSave('address')}
        loading={loading}
        displayData={addressData}
      >
        <Grid item xs={12}>
          <TextField fullWidth label="Adresse complète" name="address" value={formData.address || ''} onChange={handleChange} multiline rows={2} sx={textFieldStyles} />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField 
            fullWidth 
            label="Code Postal" 
            name="postalCode" 
            value={formData.postalCode || ''} 
            onChange={handleChange} 
            inputProps={{ maxLength: 5 }}
            error={!!fieldErrors.postalCode}
            helperText={fieldErrors.postalCode || "5 chiffres requis"}
            sx={textFieldStyles} 
          />
        </Grid>
      </SectionCard>

      {/* 3. SECTION: SPÉCIFIQUE (ÉTUDIANT ou ENTREPRISE) */}
      {isStudent && (
        <SectionCard
          title="Informations Académiques"
          isEditing={editingSection === 'student'}
          onEdit={() => setEditingSection('student')}
          onCancel={handleCancel}
          onSave={() => handleSave('student')}
          loading={loading}
          displayData={studentData}
        >
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="École / Université" name="ecole" value={formData.ecole || ''} onChange={handleChange} sx={textFieldStyles} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Programme / Formation" name="program" value={formData.program || ''} onChange={handleChange} sx={textFieldStyles} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Année de promotion" name="graduationYear" value={formData.graduationYear || ''} onChange={handleChange} sx={textFieldStyles} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Numéro Étudiant" name="studentId" value={formData.studentId || ''} onChange={handleChange} sx={textFieldStyles} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField 
              fullWidth 
              label="Numéro Sécurité Sociale" 
              name="socialSecurityNumber" 
              value={formData.socialSecurityNumber || ''} 
              onChange={handleChange} 
              inputProps={{ maxLength: 13 }}
              error={!!fieldErrors.socialSecurityNumber}
              helperText={fieldErrors.socialSecurityNumber || "13 chiffres requis"}
              sx={textFieldStyles} 
            />
          </Grid>
        </SectionCard>
      )}

      {isCompany && (
        <SectionCard
          title="Informations Entreprise"
          isEditing={editingSection === 'company'}
          onEdit={() => setEditingSection('company')}
          onCancel={handleCancel}
          onSave={() => handleSave('company')}
          loading={loading}
          displayData={companyData}
        >
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Nom de l'entreprise" name="companyName" value={formData.companyName || ''} onChange={handleChange} sx={textFieldStyles} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Poste occupé" name="position" value={formData.position || ''} onChange={handleChange} sx={textFieldStyles} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="SIRET" name="siret" value={formData.siret || ''} onChange={handleChange} sx={textFieldStyles} />
          </Grid>
           <Grid item xs={12} md={6}>
            <TextField fullWidth label="TVA Intracommunautaire" name="tvaIntra" value={formData.tvaIntra || ''} onChange={handleChange} sx={textFieldStyles} />
          </Grid>
        </SectionCard>
      )}
      
      {/* 4. SECTION: PRÉFÉRENCES (Sans mode édition complexe, juste un switch) */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
           Préférences de communication
        </Typography>
        <Box sx={{ mt: 2, bgcolor: '#f8f9fa', p: 2, borderRadius: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={!!formData.acceptsElectronicDocuments}
                  onChange={(e) => {
                      handleSwitchChange(e);
                      // Auto-save pour ce switch spécifique ou on ajoute un bouton ? 
                      // Pour l'UX, on va le faire en "live" ou demander confirmation.
                      // Ici on le stocke dans formData, mais on va ajouter un petit bouton de sauvegarde locale pour cette section si besoin, 
                      // ou simplement l'inclure dans une logique globale.
                      // Pour simplifier, je vais ajouter un bouton "Enregistrer les préférences" qui apparaît si modifié.
                  }}
                  name="acceptsElectronicDocuments"
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="subtitle2">Documents dématérialisés</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Recevoir mes documents (reçus, conventions) par voie électronique.
                  </Typography>
                </Box>
              }
            />
             {userData.acceptsElectronicDocuments !== formData.acceptsElectronicDocuments && (
                 <Button size="small" onClick={() => handleSave('prefs')} sx={{ ml: 2 }}>Enregistrer</Button>
             )}
             
            {(userData.acceptsElectronicDocumentsDate || formData.acceptsElectronicDocumentsDate) && (
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1, ml: 7 }}>
                Accepté le : {formatDate(userData.acceptsElectronicDocumentsDate || formData.acceptsElectronicDocumentsDate)}
              </Typography>
            )}
        </Box>
      </Paper>

    </Box>
  );
};

export default ProfileInfoForm;
