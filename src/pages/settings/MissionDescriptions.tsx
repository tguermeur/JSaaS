import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Stack,
  alpha,
  useTheme
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import BackButton from '../../components/ui/BackButton';
import { styled } from '@mui/material';
import { keyframes } from '@mui/system';

// Animations
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const scaleIn = keyframes`
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
`;

// Styles personnalisés
const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    transition: 'all 0.3s ease-in-out',
    '&:hover': {
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.primary.main,
      },
    },
  },
}));

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: '24px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
    animation: `${scaleIn} 0.3s ease-out`,
  },
}));

interface MissionDescription {
  id: string;
  title: string;
  missionDescription: string;
  studentProfile: string;
  courseApplication: string;
  missionLearning: string;
  structureId: string;
}

const MissionDescriptions: React.FC = () => {
  const { userData } = useAuth();
  const [descriptions, setDescriptions] = useState<MissionDescription[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentDescription, setCurrentDescription] = useState<MissionDescription>({
    id: '',
    title: '',
    missionDescription: '',
    studentProfile: '',
    courseApplication: '',
    missionLearning: '',
    structureId: ''
  });

  useEffect(() => {
    const fetchDescriptions = async () => {
      try {
        if (!userData?.structureId) return;
        
        const q = query(
          collection(db, 'missionTypes'),
          where('structureId', '==', userData.structureId)
        );
        
        const querySnapshot = await getDocs(q);
        const descriptionsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as MissionDescription[];
        setDescriptions(descriptionsData);
      } catch (error) {
        console.error("Erreur lors du chargement des types de mission:", error);
      }
    };

    fetchDescriptions();
  }, [userData?.structureId]);

  const handleOpenDialog = (description?: MissionDescription) => {
    if (description) {
      setCurrentDescription(description);
    } else {
      setCurrentDescription({
        id: '',
        title: '',
        missionDescription: '',
        studentProfile: '',
        courseApplication: '',
        missionLearning: '',
        structureId: userData?.structureId || ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentDescription({
      id: '',
      title: '',
      missionDescription: '',
      studentProfile: '',
      courseApplication: '',
      missionLearning: '',
      structureId: userData?.structureId || ''
    });
  };

  const handleSaveDescription = async () => {
    try {
      if (!userData?.structureId) {
        console.error("Aucune structure associée à l'utilisateur");
        return;
      }

      const descriptionData = {
        title: currentDescription.title,
        missionDescription: currentDescription.missionDescription,
        studentProfile: currentDescription.studentProfile,
        courseApplication: currentDescription.courseApplication,
        missionLearning: currentDescription.missionLearning,
        structureId: userData.structureId
      };

      if (currentDescription.id) {
        // Mise à jour d'une description existante
        const docRef = doc(db, 'missionTypes', currentDescription.id);
        await updateDoc(docRef, descriptionData);
        setDescriptions(prev => 
          prev.map(d => d.id === currentDescription.id ? { ...d, ...descriptionData } : d)
        );
      } else {
        // Création d'une nouvelle description
        const docRef = await addDoc(collection(db, 'missionTypes'), descriptionData);
        const newDescription = { id: docRef.id, ...descriptionData };
        setDescriptions(prev => [...prev, newDescription]);
      }
      handleCloseDialog();
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du type de mission:", error);
    }
  };

  const handleDeleteDescription = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'missionTypes', id));
      setDescriptions(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error("Erreur lors de la suppression du type de mission:", error);
    }
  };

  return (
    <Box>
      <BackButton />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography 
          variant="h5" 
          sx={{ 
            fontWeight: 700,
            background: theme => `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: `${fadeIn} 0.5s ease-out`
          }}
        >
          Types de mission
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{
            borderRadius: '12px',
            textTransform: 'none',
            fontWeight: 600,
            padding: '10px 24px',
            transition: 'all 0.3s ease-in-out',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            },
          }}
        >
          Nouveau type de mission
        </Button>
      </Box>

      <Paper sx={{ 
        p: 3, 
        borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
        backdropFilter: 'blur(10px)',
        backgroundColor: theme => alpha(theme.palette.background.paper, 0.8),
        animation: `${fadeIn} 0.5s ease-out`
      }}>
        <List>
          {descriptions.map((description, index) => (
            <React.Fragment key={description.id}>
              <ListItem sx={{ 
                borderRadius: '12px',
                mb: 1,
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  bgcolor: theme => alpha(theme.palette.primary.main, 0.05),
                  transform: 'translateX(4px)',
                }
              }}>
                <ListItemText
                  primary={
                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      {description.title}
                    </Typography>
                  }
                  secondary={
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                        {description.missionDescription ? `${description.missionDescription.substring(0, 120)}...` : 'Aucune description'}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton 
                    edge="end" 
                    onClick={() => handleOpenDialog(description)}
                    sx={{
                      color: 'primary.main',
                      '&:hover': {
                        bgcolor: theme => alpha(theme.palette.primary.main, 0.1),
                      }
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton 
                    edge="end" 
                    onClick={() => handleDeleteDescription(description.id)}
                    sx={{
                      color: 'error.main',
                      '&:hover': {
                        bgcolor: theme => alpha(theme.palette.error.main, 0.1),
                      }
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
              {index < descriptions.length - 1 && (
                <Divider sx={{ 
                  my: 1,
                  opacity: 0.3
                }} />
              )}
            </React.Fragment>
          ))}
          {descriptions.length === 0 && (
            <ListItem sx={{ 
              textAlign: 'center',
              py: 4
            }}>
              <ListItemText
                primary={
                  <Typography variant="h6" sx={{ color: 'text.secondary', mb: 1 }}>
                    Aucun type de mission configuré
                  </Typography>
                }
                secondary={
                  <Typography variant="body2" color="text.secondary">
                    Cliquez sur 'Nouveau type de mission' pour en créer un
                  </Typography>
                }
              />
            </ListItem>
          )}
        </List>
      </Paper>

      <StyledDialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{ 
          textAlign: 'center', 
          fontSize: '1.5rem', 
          fontWeight: 500,
          pt: 4
        }}>
          {currentDescription.id && descriptions.find(d => d.id === currentDescription.id)
            ? "Modifier le type de mission"
            : "Nouveau type de mission"}
        </DialogTitle>
        <DialogContent sx={{ px: 4, maxHeight: '70vh', overflow: 'auto' }}>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                Titre du type de mission *
              </Typography>
              <StyledTextField
                value={currentDescription.title}
                onChange={(e) => setCurrentDescription({ ...currentDescription, title: e.target.value })}
                fullWidth
                placeholder="Entrez le titre du type de mission"
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                Description du type de mission
              </Typography>
              <StyledTextField
                multiline
                rows={3}
                value={currentDescription.missionDescription}
                onChange={(e) => setCurrentDescription({ ...currentDescription, missionDescription: e.target.value })}
                fullWidth
                placeholder="Décrivez le type de mission"
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                Profil d'étudiant attendu
              </Typography>
              <StyledTextField
                multiline
                rows={3}
                value={currentDescription.studentProfile}
                onChange={(e) => setCurrentDescription({ ...currentDescription, studentProfile: e.target.value })}
                fullWidth
                placeholder="Décrivez le profil d'étudiant attendu"
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                Mise en pratique du cours
              </Typography>
              <StyledTextField
                multiline
                rows={3}
                value={currentDescription.courseApplication}
                onChange={(e) => setCurrentDescription({ ...currentDescription, courseApplication: e.target.value })}
                fullWidth
                placeholder="Décrivez la mise en pratique du cours"
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                Apprentissage du type de mission
              </Typography>
              <StyledTextField
                multiline
                rows={3}
                value={currentDescription.missionLearning}
                onChange={(e) => setCurrentDescription({ ...currentDescription, missionLearning: e.target.value })}
                fullWidth
                placeholder="Décrivez l'apprentissage du type de mission"
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 4, justifyContent: 'flex-end' }}>
          <Button
            onClick={handleCloseDialog}
            sx={{
              color: 'text.secondary',
              '&:hover': {
                bgcolor: theme => alpha(theme.palette.text.secondary, 0.05),
              }
            }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveDescription}
            disabled={!currentDescription.title.trim()}
            sx={{
              bgcolor: theme => theme.palette.primary.main,
              '&:hover': {
                bgcolor: theme => theme.palette.primary.dark
              }
            }}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </StyledDialog>
    </Box>
  );
};

export default MissionDescriptions; 