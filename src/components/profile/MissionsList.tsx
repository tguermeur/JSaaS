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
  Chip,
  IconButton,
  Button
} from '@mui/material';
import { Visibility as VisibilityIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { Mission } from '../../types/mission';

interface MissionsListProps {
  missions: Mission[];
}

const MissionsList: React.FC<MissionsListProps> = ({ missions }) => {
  const navigate = useNavigate();

  const getStatusColor = (etape: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (etape) {
      case 'brouillon': return 'default';
      case 'publication': return 'info';
      case 'selection': return 'warning';
      case 'contractualisation': return 'primary';
      case 'suivi': return 'success';
      case 'cloture': return 'secondary';
      case 'archive': return 'default';
      default: return 'default';
    }
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
            <TableCell>Entreprise</TableCell>
            <TableCell>Dates</TableCell>
            <TableCell>Statut</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {missions.map((mission) => (
            <TableRow key={mission.id} hover>
              <TableCell>
                <Typography variant="subtitle2" fontWeight="bold">
                  {mission.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {mission.numeroMission}
                </Typography>
              </TableCell>
              <TableCell>{mission.company}</TableCell>
              <TableCell>
                <Typography variant="body2">
                  {new Date(mission.startDate).toLocaleDateString()} - {new Date(mission.endDate).toLocaleDateString()}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip 
                  label={mission.etape} 
                  color={getStatusColor(mission.etape)} 
                  size="small" 
                  variant="outlined"
                />
              </TableCell>
              <TableCell align="right">
                <IconButton 
                  size="small" 
                  color="primary"
                  onClick={() => navigate(`/missions/${mission.id}`)}
                >
                  <VisibilityIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default MissionsList;


