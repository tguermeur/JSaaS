import React, { useState } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Paper,
  Chip,
  IconButton,
  CircularProgress,
  Stack,
  Badge,
  Button
} from '@mui/material';
import { 
    PhotoCamera, 
    School, 
    Business, 
    AdminPanelSettings,
    Edit as EditIcon,
    LocationOn as LocationIcon
} from '@mui/icons-material';
import { UserData } from '../../types/user';
import { uploadProfilePicture } from '../../firebase/storage';
import { updateUserDocument } from '../../firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from 'notistack';

interface ProfileHeaderProps {
  userData: UserData;
  onUpdate: () => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ userData, onUpdate }) => {
  const { currentUser } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [uploading, setUploading] = useState(false);

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0] || !currentUser) return;
    
    const file = event.target.files[0];
    setUploading(true);

    try {
      const photoURL = await uploadProfilePicture(currentUser.uid, file);
      await updateUserDocument(currentUser.uid, { photoURL });
      onUpdate();
      enqueueSnackbar('Photo de profil mise à jour avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors du changement d\'avatar:', error);
      enqueueSnackbar('Erreur lors du téléchargement de la photo', { variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'etudiant': return <School />;
      case 'entreprise': return <Business />;
      case 'admin':
      case 'superadmin': return <AdminPanelSettings />;
      default: return null;
    }
  };

  const getStatusColor = (status: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (status) {
      case 'etudiant': return 'primary';
      case 'entreprise': return 'secondary';
      case 'admin':
      case 'superadmin': return 'error';
      default: return 'default';
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    if (typeof date.toDate === 'function') {
      return date.toDate().toLocaleDateString();
    }
    if (date instanceof Date) {
      return date.toLocaleDateString();
    }
    return new Date(date).toLocaleDateString();
  };

  // Extraction de la ville depuis l'adresse si possible (très basique)
  // Idéalement on aurait un champ 'city' et 'country' séparés
  const getLocation = () => {
      if (userData.postalCode && userData.address) {
          // Tentative naïve : Code postal + France
          return `${userData.postalCode}, France`; 
      }
      return userData.address || '';
  };

  const getRoleLabel = () => {
      if (userData.status === 'admin' || userData.status === 'superadmin') {
          // Affichage plus discret ou masqué pour les admins selon la demande "supprime admin"
          return ''; 
      }
      if (userData.status === 'entreprise' && userData.position) {
          return userData.position;
      }
      if (userData.status === 'etudiant' && userData.ecole) {
          return `Étudiant à ${userData.ecole}`;
      }
      return userData.status === 'etudiant' ? 'Étudiant' : userData.status;
  };

  return (
    <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', position: 'relative' }}>
      
      {/* Bouton Edit en haut à droite (Principalement décoratif ou pour l'avatar) */}
      <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
          <label htmlFor="header-edit-avatar">
            <input
                accept="image/*"
                id="header-edit-avatar"
                type="file"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
            />
            <Button 
                component="span"
                variant="outlined" 
                startIcon={<PhotoCamera />} 
                size="small" 
                sx={{ borderRadius: 4, textTransform: 'none', color: 'text.secondary', borderColor: 'divider' }}
            >
                Changer photo
            </Button>
          </label>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center">
        <Box position="relative">
            <Avatar
              alt={`${userData.firstName} ${userData.lastName}`}
              src={userData.photoURL}
              sx={{ width: 100, height: 100, border: '4px solid white', boxShadow: '0 0 0 1px #e0e0e0' }}
            />
            {uploading && (
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.7)', borderRadius: '50%' }}>
                    <CircularProgress size={24} />
                </Box>
            )}
        </Box>

        <Box flex={1} textAlign={{ xs: 'center', sm: 'left' }}>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            {userData.firstName} {userData.lastName}
          </Typography>
          
          <Typography variant="body1" color="text.secondary" gutterBottom>
            {getRoleLabel()}
          </Typography>
          
          <Stack direction="row" spacing={1} justifyContent={{ xs: 'center', sm: 'flex-start' }} alignItems="center" sx={{ mt: 1 }}>
            <Chip 
              icon={getStatusIcon(userData.status) || undefined}
              label={userData.status === 'etudiant' ? 'Étudiant' : userData.status === 'entreprise' ? 'Entreprise' : userData.status.toUpperCase()} 
              color={getStatusColor(userData.status)}
              variant="outlined"
              size="small"
            />
            {userData.status === 'etudiant' && (
                <Chip 
                    label={userData.subscriptionStatus === 'active' ? "Cotisant" : "Non cotisant"} 
                    color={userData.subscriptionStatus === 'active' ? "success" : "warning"} 
                    size="small" 
                    variant={userData.subscriptionStatus === 'active' ? "filled" : "outlined"}
                />
            )}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
};

export default ProfileHeader;
