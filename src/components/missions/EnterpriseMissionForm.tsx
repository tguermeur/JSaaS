import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import { collection, addDoc, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';

interface EnterpriseMissionFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EnterpriseMissionForm: React.FC<EnterpriseMissionFormProps> = ({ open, onClose, onSuccess }) => {
  const { currentUser, userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Champs simplifiés pour l'entreprise
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!title.trim()) {
      setError('Le titre de la mission est obligatoire');
      return;
    }
    if (!description.trim()) {
      setError('La description du besoin est obligatoire');
      return;
    }
    if (!startDate) {
      setError('La date de début est obligatoire');
      return;
    }
    if (!location.trim()) {
      setError('Le lieu est obligatoire');
      return;
    }

    if (!currentUser) {
      setError('Vous devez être connecté pour créer une mission');
      return;
    }

    try {
      setLoading(true);

      // Récupérer les informations complètes de l'utilisateur
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!userDoc.exists()) {
        setError('Erreur: Impossible de récupérer vos informations');
        setLoading(false);
        return;
      }

      const fullUserData = userDoc.data();
      const companyName = fullUserData?.companyName || currentUser.displayName || 'Entreprise';
      
      // Pour les entreprises, on utilise leur uid comme companyId
      // et on doit trouver leur structureId (ou utiliser un structureId par défaut)
      // En général, les entreprises n'ont pas de structureId, on va chercher une structure
      // ou créer la mission sans structureId et laisser la JE l'assigner

      // Générer un numéro de mission temporaire (sera remplacé par la JE)
      const tempNumber = `TEMP-${Date.now()}`;

      // Créer la mission avec statut "En attente de validation"
      const newMission = {
        numeroMission: tempNumber,
        company: companyName,
        companyId: currentUser.uid, // L'ID de l'entreprise est l'uid de l'utilisateur
        location: location.trim(),
        startDate: startDate,
        endDate: endDate || startDate,
        studentCount: 1, // Par défaut
        hours: 0,
        status: 'En attente de validation',
        structureId: '', // Sera rempli par la JE lors de la validation
        chargeId: '', // Sera rempli par la JE
        chargeName: '',
        chargePhotoURL: null,
        description: description.trim(),
        title: title.trim(), // Ajout du titre
        prixHT: 0, // Sera calculé par la JE
        createdAt: new Date(),
        createdBy: currentUser.uid,
        isPublic: false, // Non publique tant que non validée
        etape: 'Négociation',
        isArchived: false,
        createdByEnterprise: true // Flag pour identifier les missions créées par les entreprises
      };

      await addDoc(collection(db, 'missions'), newMission);

      // Réinitialiser le formulaire
      setTitle('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setLocation('');
      
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erreur lors de la création de la mission:', err);
      setError('Erreur lors de la création de la mission. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setTitle('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setLocation('');
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
        }
      }}
    >
      <DialogTitle sx={{ 
        pb: 2,
        borderBottom: '1px solid #e5e5ea',
        fontWeight: 600,
        fontSize: '1.5rem'
      }}>
        Exprimez votre besoin
      </DialogTitle>
      
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Titre de la mission"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            variant="outlined"
            required
            disabled={loading}
            sx={{ mb: 3 }}
            placeholder="Ex: Développement d'une application web"
          />

          <TextField
            fullWidth
            label="Description du besoin"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            variant="outlined"
            required
            multiline
            rows={6}
            disabled={loading}
            sx={{ mb: 3 }}
            placeholder="Décrivez en détail votre besoin, les compétences recherchées, les contraintes techniques, etc."
          />

          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <TextField
              fullWidth
              label="Date de début souhaitée"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              variant="outlined"
              required
              disabled={loading}
              InputLabelProps={{
                shrink: true,
              }}
            />
            <TextField
              fullWidth
              label="Date de fin souhaitée"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              variant="outlined"
              disabled={loading}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Box>

          <TextField
            fullWidth
            label="Lieu"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            variant="outlined"
            required
            disabled={loading}
            placeholder="Ex: Paris, Remote, Lyon..."
            sx={{ mb: 2 }}
          />

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Votre demande sera examinée par notre équipe et vous recevrez une réponse sous 48h.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <Button 
            onClick={handleClose} 
            disabled={loading}
            sx={{ textTransform: 'none' }}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
            sx={{ 
              textTransform: 'none',
              px: 3,
              py: 1,
              borderRadius: '8px',
              fontWeight: 600
            }}
          >
            {loading ? 'Envoi en cours...' : 'Envoyer la demande'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default EnterpriseMissionForm;



