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

  const formatDate = (date: any) => {
    if (!date) return '';
    if (typeof date.toDate === 'function') {
      return date.toDate().toLocaleDateString();
    }
    if (date instanceof Date) {
      return date.toLocaleDateString();
    }
    return new Date(date).toLocaleDateString();
  };

  useEffect(() => {
    if (userData) {
      setFormData({ ...userData });
    }
  }, [userData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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

  const handleSave = async (sectionKey: string) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // On sauvegarde tout formData, ou on pourrait filtrer par section si on voulait être très précis
      await updateUserDocument(currentUser.uid, {
        ...formData,
        updatedAt: new Date()
      });
      onUpdate();
      setEditingSection(null);
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
  };

  const isStudent = userData.status === 'etudiant' || userData.status === 'membre' || userData.status === 'admin' || userData.status === 'superadmin';
  const isCompany = userData.status === 'entreprise';

  // --- Préparation des données d'affichage ---
  
  const personalInfoData = [
    { label: 'Prénom', value: userData.firstName },
    { label: 'Nom', value: userData.lastName },
    { label: 'Email', value: userData.email },
    { label: 'Téléphone', value: userData.phone },
    { label: 'Date de naissance', value: formatDate(userData.birthDate) },
    { label: 'Genre', value: userData.gender === 'M' ? 'Homme' : userData.gender === 'F' ? 'Femme' : userData.gender },
    { label: 'Lieu de naissance', value: userData.birthPlace },
    { label: 'Nationalité', value: userData.nationality },
    { label: 'LinkedIn', value: userData.linkedinUrl ? <a href={userData.linkedinUrl} target="_blank" rel="noreferrer" style={{color: '#1976d2', textDecoration: 'none'}}>Voir le profil</a> : '' },
  ];

  const addressData = [
    { label: 'Adresse', value: userData.address },
    { label: 'Code Postal', value: userData.postalCode },
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
          <TextField fullWidth label="Téléphone" name="phone" value={formData.phone || ''} onChange={handleChange} sx={textFieldStyles} />
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
          <TextField fullWidth label="Code Postal" name="postalCode" value={formData.postalCode || ''} onChange={handleChange} sx={textFieldStyles} />
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
            <TextField fullWidth label="Numéro Sécurité Sociale" name="socialSecurityNumber" value={formData.socialSecurityNumber || ''} onChange={handleChange} sx={textFieldStyles} />
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
             
            {userData.acceptsElectronicDocumentsDate && (
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1, ml: 7 }}>
                Accepté le : {formatDate(userData.acceptsElectronicDocumentsDate)}
              </Typography>
            )}
        </Box>
      </Paper>

    </Box>
  );
};

export default ProfileInfoForm;
