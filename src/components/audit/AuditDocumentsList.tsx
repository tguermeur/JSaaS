import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
} from '@mui/icons-material';
import { AuditDocument } from '../../types/audit';

interface AuditDocumentsListProps {
  documents: AuditDocument[];
  onEdit?: (document: AuditDocument) => void;
  onApprove?: (document: AuditDocument) => void;
  onReject?: (document: AuditDocument) => void;
}

export const AuditDocumentsList: React.FC<AuditDocumentsListProps> = ({
  documents,
  onEdit,
  onApprove,
  onReject,
}) => {
  const getStatusColor = (status: AuditDocument['status']) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'error';
      default:
        return 'warning';
    }
  };

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Nom</TableCell>
            <TableCell>Statut</TableCell>
            <TableCell>Date de création</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {documents.map((document) => (
            <TableRow key={document.id}>
              <TableCell>{document.name}</TableCell>
              <TableCell>
                <Chip
                  label={document.status}
                  color={getStatusColor(document.status)}
                  size="small"
                />
              </TableCell>
              <TableCell>
                {new Date(document.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Tooltip title="Modifier">
                  <IconButton
                    size="small"
                    onClick={() => onEdit?.(document)}
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Approuver">
                  <IconButton
                    size="small"
                    onClick={() => onApprove?.(document)}
                    disabled={document.status === 'approved'}
                  >
                    <ApproveIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Rejeter">
                  <IconButton
                    size="small"
                    onClick={() => onReject?.(document)}
                    disabled={document.status === 'rejected'}
                  >
                    <RejectIcon />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}; 