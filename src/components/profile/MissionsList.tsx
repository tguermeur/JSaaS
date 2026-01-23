import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip
} from '@mui/material';
import { Mission } from '../../types/mission';

interface MissionsListProps {
  missions: (Mission & { applicationStatus?: string })[];
  isStudent?: boolean;
}

const MissionsList: React.FC<MissionsListProps> = ({ missions, isStudent = false }) => {
  const getStatusColor = (status: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    if (isStudent) {
      // Pour les étudiants, statuts de candidature
      switch (status?.toLowerCase()) {
        case 'accepté':
        case 'acceptee':
        case 'acceptée':
          return 'success';
        case 'refusé':
        case 'refusee':
        case 'refusée':
          return 'error';
        case 'en attente':
          return 'warning';
        case 'postulé':
          return 'info';
        default:
          return 'default';
      }
    } else {
      // Pour les autres (admin, entreprise), statuts de mission
      switch (status) {
        case 'brouillon': return 'default';
        case 'publication': return 'info';
        case 'selection': return 'warning';
        case 'contractualisation': return 'primary';
        case 'suivi': return 'success';
        case 'cloture': return 'secondary';
        case 'archive': return 'default';
        default: return 'default';
      }
    }
  };

  const getStatusLabel = (mission: Mission & { applicationStatus?: string }) => {
    if (isStudent && mission.applicationStatus) {
      return mission.applicationStatus === 'En attente' ? 'Postulé' : mission.applicationStatus;
    }
    return mission.etape || 'N/A';
  };

  if (missions.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          Aucune mission trouvée.
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper} elevation={0} variant="outlined">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Mission</TableCell>
            {!isStudent && <TableCell>Entreprise</TableCell>}
            {!isStudent && <TableCell>Dates</TableCell>}
            <TableCell>Statut</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {missions.map((mission) => (
            <TableRow key={mission.id}>
              <TableCell>
                <Typography variant="subtitle2" fontWeight="bold">
                  {mission.title}
                </Typography>
                {mission.numeroMission && (
                  <Typography variant="caption" color="text.secondary">
                    {mission.numeroMission}
                  </Typography>
                )}
              </TableCell>
              {!isStudent && (
                <>
                  <TableCell>{mission.company || 'N/A'}</TableCell>
                  <TableCell>
                    {mission.startDate && mission.endDate ? (
                      <Typography variant="body2">
                        {new Date(mission.startDate).toLocaleDateString()} - {new Date(mission.endDate).toLocaleDateString()}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        N/A
                      </Typography>
                    )}
                  </TableCell>
                </>
              )}
              <TableCell>
                <Chip 
                  label={getStatusLabel(mission)} 
                  color={getStatusColor(getStatusLabel(mission))} 
                  size="small" 
                  variant="outlined"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default MissionsList;


