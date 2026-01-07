import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Stack
} from '@mui/material';
import {
  BugReport as BugReportIcon,
  Lightbulb as LightbulbIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { Report, getReports, addReport } from '../../services/reportService';
import { useAuth } from '../../contexts/AuthContext';

// Extension de l'interface Report pour inclure l'ID qui vient de Firestore
interface ExtendedReport extends Report {
  id?: string;
}

const ReportsTab: React.FC = () => {
  const { currentUser } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [reports, setReports] = useState<ExtendedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [newReportType, setNewReportType] = useState<'bug' | 'idea'>('bug');
  const [newReportContent, setNewReportContent] = useState('');

  const fetchUserReports = async () => {
    if (!currentUser) return;
    try {
      // Idéalement, getReports devrait accepter un userId pour filtrer côté serveur
      // Ici on filtre côté client comme solution temporaire
      const allReports = await getReports() as ExtendedReport[];
      const userReports = allReports.filter(r => r.userId === currentUser.uid);
      // Tri par date décroissante
      userReports.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      setReports(userReports);
    } catch (error) {
      console.error('Erreur fetch reports:', error);
      enqueueSnackbar('Impossible de charger les rapports', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserReports();
  }, [currentUser]);

  const handleSubmit = async () => {
    if (!currentUser || !newReportContent.trim()) return;

    setSubmitting(true);
    try {
      await addReport({
        type: newReportType,
        content: newReportContent,
        userId: currentUser.uid,
        userEmail: currentUser.email || '',
        createdAt: new Date().toISOString()
      });
      
      enqueueSnackbar('Rapport envoyé avec succès', { variant: 'success' });
      setOpenDialog(false);
      setNewReportContent('');
      fetchUserReports(); // Rafraîchir la liste
    } catch (error) {
      console.error('Erreur création rapport:', error);
      enqueueSnackbar('Erreur lors de l\'envoi du rapport', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (status) {
      case 'pending': return 'warning';
      case 'in_progress': return 'info';
      case 'completed': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'in_progress': return 'En cours';
      case 'completed': return 'Résolu';
      case 'rejected': return 'Rejeté';
      default: return status;
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Mes signalements</Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={() => setOpenDialog(true)}
        >
          Nouveau signalement
        </Button>
      </Box>

      {reports.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#f8f9fa' }} variant="outlined">
          <Typography color="text.secondary">
            Aucun signalement pour le moment.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {reports.map((report, index) => (
            <Paper key={report.id || index} sx={{ p: 2 }} variant="outlined">
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ mt: 0.5 }}>
                  {report.type === 'bug' ? (
                    <BugReportIcon color="error" />
                  ) : (
                    <LightbulbIcon color="warning" />
                  )}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {report.type === 'bug' ? 'Bug signalé' : 'Suggestion'}
                    </Typography>
                    <Chip 
                      label={getStatusLabel(report.status)} 
                      color={getStatusColor(report.status)} 
                      size="small" 
                    />
                  </Box>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {report.content}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    {new Date(report.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          ))}
        </Stack>
      )}

      {/* Dialog Nouveau Rapport */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouveau signalement</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={newReportType}
                label="Type"
                onChange={(e) => setNewReportType(e.target.value as 'bug' | 'idea')}
              >
                <MenuItem value="bug">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BugReportIcon fontSize="small" /> Signaler un bug
                  </Box>
                </MenuItem>
                <MenuItem value="idea">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LightbulbIcon fontSize="small" /> Suggérer une idée
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Description"
              multiline
              rows={4}
              value={newReportContent}
              onChange={(e) => setNewReportContent(e.target.value)}
              placeholder={newReportType === 'bug' ? "Décrivez le problème rencontré..." : "Décrivez votre idée..."}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Annuler</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={submitting || !newReportContent.trim()}
          >
            {submitting ? 'Envoi...' : 'Envoyer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReportsTab;


