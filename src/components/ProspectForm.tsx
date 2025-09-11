import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Box,
  Alert,
  SelectChangeEvent
} from '@mui/material';
import { createProspect } from '../firebase/prospects';
import { useAuth } from '../contexts/AuthContext';

interface ProspectFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ProspectStatus = 'prospect' | 'actif' | 'inactif';

const ProspectForm: React.FC<ProspectFormProps> = ({ open, onClose, onSuccess }) => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    entreprise: '',
    email: '',
    telephone: '',
    statut: 'prospect' as ProspectStatus,
    adresse: '',
    secteur: '',
    notes: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (e: SelectChangeEvent<ProspectStatus>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value as ProspectStatus
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData?.structureId) {
      setError('Structure ID non trouvé');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createProspect({
        ...formData,
        structureId: userData.structureId,
        derniereInteraction: new Date().toISOString(),
        favori: false
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError('Erreur lors de la création du prospect');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Nouveau Prospect</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                name="nom"
                label="Nom"
                value={formData.nom}
                onChange={handleChange}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="entreprise"
                label="Entreprise"
                value={formData.entreprise}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="email"
                label="Email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="telephone"
                label="Téléphone"
                value={formData.telephone}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Statut</InputLabel>
                <Select
                  name="statut"
                  value={formData.statut}
                  onChange={handleSelectChange}
                  label="Statut"
                >
                  <MenuItem value="prospect">Prospect</MenuItem>
                  <MenuItem value="actif">Actif</MenuItem>
                  <MenuItem value="inactif">Inactif</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                name="adresse"
                label="Adresse"
                value={formData.adresse}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="secteur"
                label="Secteur"
                value={formData.secteur}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                name="notes"
                label="Notes"
                value={formData.notes}
                onChange={handleChange}
                fullWidth
                multiline
                rows={4}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Annuler</Button>
          <Button 
            type="submit" 
            variant="contained" 
            color="primary"
            disabled={loading}
          >
            {loading ? 'Création...' : 'Créer'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ProspectForm; 