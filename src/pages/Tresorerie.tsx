import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Collapse,
  CircularProgress,
  Chip,
  Tooltip,
  styled,
  Button,
  Alert,
  Menu,
  TextField,
  Checkbox,
  Pagination,
  InputAdornment,
} from '@mui/material';
import {
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  ContentCopy as ContentCopyIcon,
  Check as CheckIcon,
  CheckCircle as CheckCircleIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Description as DescriptionIcon,
  Info as InfoIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  ImportExport as ImportExportIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from 'notistack';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { usePermission } from '../hooks/usePermission';
import AccessDenied from '../components/common/AccessDenied';
import EmptyState from '../components/common/EmptyState';
import { getSafeDisplayName, isEncryptedField } from '../utils/decryptUserUtils';
import UserReferenceText from '../components/common/UserReferenceText';
import { tokens } from '../theme/tokens';
import { AppPageShell, SegmentedControl, DsPill, KpiCard, CommercialViewTabs } from '../components/ds';

const FIRESTORE_IN_LIMIT = 30;

function chunkArray<T>(items: T[], size = FIRESTORE_IN_LIMIT): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function plainText(value: unknown): string {
  return typeof value === 'string' && !isEncryptedField(value) ? value : '';
}

// Fonction pour générer les mandats disponibles (2022-2023 jusqu'à l'année en cours)
const generateMandats = (): string[] => {
  const currentYear = new Date().getFullYear();
  const startYear = 2022;
  const mandats: string[] = [];
  
  for (let year = startYear; year <= currentYear; year++) {
    const nextYear = year + 1;
    mandats.push(`${year}-${nextYear}`);
  }
  
  return mandats;
};

const AVAILABLE_MANDATS = generateMandats();

interface Mission {
  id: string;
  numeroMission: string;
  startDate: string;
  endDate: string;
  salary: string;
  structureId?: string;
  totalTTC?: number;
  priceHT?: number;
  totalHT?: number;
  tva?: number;
  invoiceStatus?: 'to_send' | 'sent' | 'paid';
  etape?: 'Négociation' | 'Recrutement' | 'Date de mission' | 'Facturation' | 'Audit' | 'Archivé';
  chargeId?: string;
  mandat?: string; // Format: "2022-2023", "2023-2024", etc.
  company?: string;
}

interface ExtendedUserData {
  firstName?: string;
  lastName?: string;
  socialSecurityNumber?: string;
  birthPlace?: string;
  birthPostalCode?: string;
  nationality?: string;
  address?: string;
  email: string;
  displayName: string;
}

interface Application {
  id: string;
  userId: string;
  missionId: string;
  status: 'En attente' | 'Acceptée' | 'Refusée';
  userDisplayName: string;
  userEmail: string;
  userData?: ExtendedUserData;
  workingHours?: Array<{
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    breaks: Array<{ start: string; end: string; }>;
  }>;
}

interface ExpenseNote {
  id: string;
  date: Date;
  description: string;
  amount: number;
  status: "En attente" | "Refusée" | "Validée";
}

interface InvoiceDocument {
  id: string;
  fileName: string;
  fileUrl: string;
  invoiceSentDate?: Date;
  invoiceDueDate?: Date;
  invoiceAmount?: number;
  createdAt: Date;
  createdByName?: string;
  isInvoice: boolean;
}

type WorkingHourLine = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  breaks: Array<{ start: string; end: string }>;
};

function parseWorkingHourLines(docs: { data: () => Record<string, unknown> }[]): WorkingHourLine[] {
  return docs.flatMap((whDoc) => {
    const data = whDoc.data();
    if (!Array.isArray(data.hours)) return [];
    return (data.hours as Array<{ date?: string; startTime?: string; endTime?: string; breaks?: Array<{ start: string; end: string }> }>).map((h) => ({
      startDate: h.date || '',
      startTime: h.startTime || '',
      endDate: h.date || '',
      endTime: h.endTime || '',
      breaks: h.breaks || [],
    }));
  });
}

function sumWorkingHours(workingHours: WorkingHourLine[]): number {
  return workingHours.reduce((total, wh) => {
    if (!wh.startTime || !wh.endTime) return total;
    const start = new Date(`1970-01-01T${wh.startTime}`);
    const end = new Date(`1970-01-01T${wh.endTime}`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return total;
    let hours = (end.getTime() - start.getTime()) / 1000 / 3600;
    wh.breaks?.forEach((breakTime) => {
      if (!breakTime.start || !breakTime.end) return;
      const breakStart = new Date(`1970-01-01T${breakTime.start}`);
      const breakEnd = new Date(`1970-01-01T${breakTime.end}`);
      if (Number.isNaN(breakStart.getTime()) || Number.isNaN(breakEnd.getTime())) return;
      hours -= (breakEnd.getTime() - breakStart.getTime()) / 1000 / 3600;
    });
    return total + hours;
  }, 0);
}

function toInvoiceDocument(id: string, data: Record<string, any>): InvoiceDocument {
  return {
    id,
    fileName: data.fileName,
    fileUrl: data.fileUrl,
    invoiceSentDate: data.invoiceSentDate?.toDate?.(),
    invoiceDueDate: data.invoiceDueDate?.toDate?.(),
    invoiceAmount: data.invoiceAmount,
    createdAt: data.createdAt?.toDate?.() || new Date(),
    createdByName: data.createdByName,
    isInvoice: data.isInvoice ?? true,
  };
}

interface Contract {
  mission: Mission;
  application: {
    id: string;
    userId?: string;
    userData?: {
      firstName?: string;
      lastName?: string;
      email: string;
      displayName: string;
    };
    userEmail: string;
    userDisplayName: string;
    workingHours?: Array<{
      startDate: string;
      startTime: string;
      endDate: string;
      endTime: string;
      breaks?: Array<{
        start: string;
        end: string;
      }>;
    }>;
  };
  expenseNotes?: ExpenseNote[];
  totalHoursAssigned: number;
  status?: {
    isContractGenerated: boolean;
    contractGeneratedAt?: Date;
  };
  isPaymentProcessed: boolean;
  paymentProcessedAt?: Date;
  paymentProcessedBy?: string;
  createdByName?: string;
  cdmMandat?: string; // Mandat du chargé de mission
  invoiceDocument?: InvoiceDocument; // Document de facture uploadé
}

interface ContractStatus {
  isContractGenerated: boolean;
  contractGeneratedAt?: Date;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`treasury-tabpanel-${index}`}
      aria-labelledby={`treasury-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 0, pb: 0 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const StyledTooltip = styled(Tooltip)(({ theme }) => ({
  '& .MuiTooltip-tooltip': {
    backgroundColor: '#FFFFFF',
    color: tokens.colors.textPrimary,
    maxWidth: 650,
    fontSize: '0.875rem',
    border: 'none',
    borderRadius: tokens.radius.xl,
    boxShadow: '0 12px 48px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08)',
    padding: 0,
    margin: '8px',
    overflow: 'visible',
    '& *': {
      border: 'none !important',
      outline: 'none !important'
    }
  },
  '& .MuiTooltip-arrow': {
    color: '#FFFFFF',
    '&::before': {
      border: 'none !important',
      backgroundColor: '#FFFFFF',
      boxShadow: 'none'
    }
  }
}));

const InfoRow: React.FC<{
  label: string;
  value: string;
  copyValue?: string;
}> = ({ label, value, copyValue }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const textToCopy = copyValue || value;
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
    }
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'flex-start', 
      justifyContent: 'space-between',
      py: 1,
      px: 2,
      backgroundColor: '#FFFFFF',
      transition: 'background-color 0.2s ease',
      '&:hover': {
        backgroundColor: tokens.colors.bgDefault,
        '& .copy-button': {
          opacity: 1,
          transform: 'translateX(0)'
        }
      }
    }}>
      <Box sx={{ 
        flex: 1,
        backgroundColor: 'transparent',
        minWidth: 0,
        overflow: 'visible'
      }}>
        <Typography sx={{ 
          fontSize: '0.7rem',
          color: tokens.colors.textSecondary,
          mb: 0.25,
          letterSpacing: '0.02em',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontWeight: 600,
          textTransform: 'uppercase'
        }}>
          {label}
        </Typography>
        <Typography sx={{ 
          fontSize: '0.875rem',
          color: tokens.colors.textPrimary,
          fontWeight: 500,
          letterSpacing: '-0.01em',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          lineHeight: 1.3,
          wordBreak: 'break-word'
        }}>
          {value || <Box component="span" sx={{ color: tokens.colors.textSecondary, fontStyle: 'italic' }}>Non renseigné</Box>}
        </Typography>
      </Box>
      {value && value !== 'Non renseigné' && (
        <Tooltip 
          title={copied ? "Copié !" : "Copier"} 
          placement="top"
          arrow
        >
          <IconButton 
            size="small" 
            onClick={handleCopy}
            className="copy-button"
            sx={{ 
              opacity: 0,
              transform: 'translateX(10px)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              color: copied ? tokens.colors.success : tokens.colors.info,
              p: 1,
              ml: 1,
              backgroundColor: 'transparent',
              borderRadius: tokens.radius.sm,
              '&:hover': {
                backgroundColor: copied ? 'rgba(52, 199, 89, 0.1)' : 'rgba(0, 122, 255, 0.1)',
                transform: 'scale(1.1)'
              }
            }}
          >
            {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

const UserInfoTooltip: React.FC<{ userData: ExtendedUserData }> = ({ userData }) => (
  <Box sx={{ 
    backgroundColor: '#FFFFFF',
    width: '100%',
    overflow: 'hidden',
    '& *': {
      border: 'none !important',
      outline: 'none !important'
    }
  }}>
    {/* Header simplifié */}
    <Box sx={{
      padding: '10px 16px 8px 16px',
      border: 'none'
    }}>
      <Typography sx={{ 
        fontSize: '0.875rem',
        fontWeight: 600,
        color: tokens.colors.textPrimary,
        letterSpacing: '-0.01em',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
      }}>
        Informations de l'étudiant
      </Typography>
    </Box>
    
    {/* Contenu */}
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#FFFFFF',
      border: 'none'
    }}>
      <InfoRow 
        label="Nom complet"
        value={getSafeDisplayName(userData) || userData.displayName || ''}
      />
      
      <InfoRow 
        label="N° Sécurité sociale"
        value={userData.socialSecurityNumber || ''}
      />
      
      <InfoRow 
        label="Lieu de naissance"
        value={userData.birthPlace ? `${userData.birthPlace}${userData.birthPostalCode ? ` (${userData.birthPostalCode})` : ''}` : ''}
        copyValue={`${userData.birthPlace || ''} ${userData.birthPostalCode || ''}`}
      />
      
      <InfoRow 
        label="Nationalité"
        value={userData.nationality || ''}
      />
      
      <InfoRow 
        label="Adresse"
        value={userData.address || ''}
      />
      
      <InfoRow 
        label="Email"
        value={userData.email || ''}
      />
    </Box>
  </Box>
);

const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const calculatePaymentDate = (endDateString: string): Date => {
  const endDate = new Date(endDateString);
  const paymentDate = new Date(endDate);
  paymentDate.setDate(paymentDate.getDate() + 30);
  return paymentDate;
};

const calculateWorkingHours = (startDate: string, startTime: string, endDate: string, endTime: string, breaks: Array<{ start: string; end: string; }> = []) => {
  const start = new Date(`${startDate}T${startTime}`);
  const end = new Date(`${endDate}T${endTime}`);
  
  let totalMinutes = (end.getTime() - start.getTime()) / 1000 / 60;
  
  breaks.forEach(breakTime => {
    const breakStart = new Date(`1970-01-01T${breakTime.start}`);
    const breakEnd = new Date(`1970-01-01T${breakTime.end}`);
    const breakMinutes = (breakEnd.getTime() - breakStart.getTime()) / 1000 / 60;
    totalMinutes -= breakMinutes;
  });
  
  return totalMinutes / 60;
};

const calculateValidatedExpenseTotal = (expenseNotes: ExpenseNote[] = []) => {
  return expenseNotes
    .filter(note => note.status === 'Validée')
    .reduce((total, note) => total + note.amount, 0);
};

interface Row {
  contract: Contract;
  onContractValidate?: (contractId: string) => void;
  showValidateButton?: boolean;
  currentTab: number;
  onProcessPayment?: (missionId: string) => void;
  handleToggleContractGeneration: (contractId: string, currentStatus: boolean) => void;
  onTogglePaymentStatus: (contractId: string, currentStatus: boolean) => void;
}

const Row: React.FC<Row> = ({ 
  contract, 
  onContractValidate, 
  showValidateButton, 
  currentTab, 
  onProcessPayment,
  handleToggleContractGeneration,
  onTogglePaymentStatus 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const totalExpenses = calculateValidatedExpenseTotal(contract.expenseNotes);
  const hourlyRate = parseFloat(contract.mission.salary || '0');
  const totalPay = (contract.totalHoursAssigned * hourlyRate) + totalExpenses;

  return (
    <React.Fragment>
      <TableRow>
        <TableCell>
          <IconButton
            size="small"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell>{contract.mission.numeroMission}</TableCell>
        <TableCell>
          <StyledTooltip
            title={<UserInfoTooltip userData={contract.application.userData || {
              firstName: '',
              lastName: '',
              email: contract.application.userEmail,
              displayName: contract.application.userDisplayName
            }} />}
            placement="right"
            arrow
          >
            <UserReferenceText
              userId={contract.application.userId}
              name={contract.application.userDisplayName}
              fallback={contract.application.userEmail?.split('@')[0] || 'Étudiant'}
              sx={{
                cursor: 'pointer',
                '&:hover': { color: tokens.colors.info },
              }}
            />
          </StyledTooltip>
        </TableCell>
        {currentTab === 0 && (
          <TableCell>{formatDate(contract.mission.startDate)}</TableCell>
        )}
        <TableCell>{formatDate(contract.mission.endDate)}</TableCell>
        <TableCell>{contract.totalHoursAssigned.toFixed(2)}h</TableCell>
        {currentTab === 1 && (
          <>
            <TableCell>{hourlyRate.toFixed(2)}€/h</TableCell>
            <TableCell>{totalExpenses.toFixed(2)}€</TableCell>
            <TableCell>{totalPay.toFixed(2)}€</TableCell>
            {contract.isPaymentProcessed ? (
              <TableCell>
                <Chip
                  label="Payé"
                  color="success"
                  size="small"
                  onClick={() => onTogglePaymentStatus(contract.mission.id, true)}
                  sx={{
                    borderRadius: tokens.radius.sm,
                    fontWeight: 500,
                    backgroundColor: 'rgba(52, 199, 89, 0.1)',
                    color: tokens.colors.success,
                    border: 'none',
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'rgba(52, 199, 89, 0.2)'
                    },
                    '& .MuiChip-label': { px: 2 }
                  }}
                  clickable
                />
              </TableCell>
            ) : (
              <TableCell>
                <Chip
                  label="À payer"
                  color="warning"
                  size="small"
                  onClick={() => onTogglePaymentStatus(contract.mission.id, false)}
                  sx={{
                    borderRadius: tokens.radius.sm,
                    fontWeight: 500,
                    backgroundColor: 'rgba(255, 204, 0, 0.1)',
                    color: tokens.colors.warning,
                    border: 'none',
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 204, 0, 0.2)'
                    },
                    '& .MuiChip-label': { px: 2 }
                  }}
                  clickable
                />
              </TableCell>
            )}
            {showValidateButton && (
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<CheckCircleIcon />}
                onClick={() => onContractValidate?.(contract.mission.id)}
                sx={{
                  borderRadius: tokens.radius.sm,
                  textTransform: 'none',
                  boxShadow: 'none'
                }}
              >
                Valider le contrat
              </Button>
            )}
          </>
        )}
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2 }}>
              <Typography variant="h6" gutterBottom component="div">
                {currentTab === 0 ? "Détail des heures" : "Détail des heures et paiements"}
              </Typography>
              {currentTab === 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Début</TableCell>
                      <TableCell>Fin</TableCell>
                      <TableCell>Pauses</TableCell>
                      <TableCell>Total heures</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {contract.application.workingHours?.map((wh, index) => {
                      const periodHours = calculateWorkingHours(wh.startDate, wh.startTime, wh.endDate, wh.endTime, wh.breaks);
                      return (
                        <TableRow key={index}>
                          <TableCell>{new Date(wh.startDate).toLocaleDateString('fr-FR')}</TableCell>
                          <TableCell>{wh.startTime}</TableCell>
                          <TableCell>{new Date(wh.endDate).toLocaleDateString('fr-FR')}</TableCell>
                          <TableCell>{wh.endTime}</TableCell>
                          <TableCell>
                            {wh.breaks && wh.breaks.length > 0 ? (
                              wh.breaks.map((breakTime, idx) => (
                                <Box key={idx} sx={{ mb: idx !== wh.breaks.length - 1 ? 1 : 0 }}>
                                  {breakTime.start} - {breakTime.end}
                                </Box>
                              ))
                            ) : (
                              "Aucune pause"
                            )}
                          </TableCell>
                          <TableCell>{periodHours.toFixed(2)}h</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow>
                      <TableCell colSpan={4} sx={{ fontWeight: 600 }}>
                        Total heures
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {contract.totalHoursAssigned.toFixed(2)}h
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Heures travaillées</TableCell>
                        <TableCell>Montant</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {contract.application.workingHours?.map((wh, index) => {
                        const dailyHours = calculateWorkingHours(wh.startDate, wh.startTime, wh.endDate, wh.endTime, wh.breaks);
                        const dailyAmount = dailyHours * parseFloat(contract.mission.salary || '0');
                        return (
                          <TableRow key={index}>
                            <TableCell>{new Date(wh.startDate).toLocaleDateString('fr-FR')}</TableCell>
                            <TableCell>{dailyHours.toFixed(2)}h</TableCell>
                            <TableCell>{dailyAmount.toFixed(2)}€</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow>
                        <TableCell colSpan={2} sx={{ fontWeight: 600 }}>
                          Sous-total heures
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {(contract.totalHoursAssigned * parseFloat(contract.mission.salary || '0')).toFixed(2)}€
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  {contract.expenseNotes && contract.expenseNotes.length > 0 && (
                    <>
                      <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                        Notes de frais validées
                      </Typography>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Date</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Montant</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {contract.expenseNotes?.map((note) => (
                            <TableRow key={note.id}>
                              <TableCell>
                                {note.date.toLocaleDateString('fr-FR')}
                              </TableCell>
                              <TableCell>{note.description}</TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {note.amount.toFixed(2)}€
                                  <Chip
                                    label={note.status}
                                    size="small"
                                    color={note.status === 'Validée' ? 'success' : note.status === 'En attente' ? 'warning' : 'error'}
                                    sx={{
                                      height: '20px',
                                      '& .MuiChip-label': {
                                        px: 1,
                                        fontSize: '0.75rem'
                                      }
                                    }}
                                  />
                                </Box>
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell colSpan={2} sx={{ fontWeight: 600 }}>
                              Total notes de frais validées
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                              {calculateValidatedExpenseTotal(contract.expenseNotes).toFixed(2)}€
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </>
                  )}
                </>
              )}

              <Box sx={{ 
                mt: 2, 
                p: 2, 
                bgcolor: tokens.colors.bgDefault, 
                borderRadius: tokens.radius.sm,
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 2
              }}>
                <Typography variant="h6" sx={{ color: tokens.colors.textPrimary }}>
                  {currentTab === 0 ? "Total heures :" : "Total à payer :"}
                </Typography>
                <Typography variant="h6" sx={{ color: tokens.colors.success, fontWeight: 600 }}>
                  {currentTab === 0 
                    ? `${contract.totalHoursAssigned.toFixed(2)}h`
                    : `${((contract.totalHoursAssigned * (parseFloat(contract.mission.salary || '0'))) + 
                        (calculateValidatedExpenseTotal(contract.expenseNotes) || 0)).toFixed(2)}€`
                  }
                </Typography>
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
};

// Ajouter un type pour les filtres
type ContractFilter = 'all' | 'pending' | 'generated';
type PaymentFilter = 'all' | 'pending' | 'processed';
type InvoiceTrackingFilter = 'all' | 'unpaid' | 'paid' | 'overdue' | 'upcoming';

// Ajouter l'interface pour les filtres
interface TableFilters {
  numeroMission: string;
  student: string;
  startDate: string;
  endDate: string;
  hours: string;
  status: string;
}

// Ajouter les types pour le tri
type SortDirection = 'asc' | 'desc' | null;
type SortConfig = {
  column: keyof TableFilters | null;
  direction: SortDirection;
};

// Types pour le suivi des factures
type InvoiceTrackingSortColumn = 'numeroMission' | 'company' | 'amount' | 'sentDate' | 'dueDate' | 'daysRemaining' | 'status';
type InvoiceTrackingSortConfig = {
  column: InvoiceTrackingSortColumn | null;
  direction: SortDirection;
};

const Tresorerie: React.FC = () => {
  const { currentUser, userData } = useAuth();
  const { canRead, canWrite, loading: permissionLoading } = usePermission('tresorerie');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [processingContract, setProcessingContract] = useState<string | null>(null);
  const { enqueueSnackbar } = useSnackbar();
  const [contractFilter, setContractFilter] = useState<ContractFilter>('pending');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('pending');
  const [invoiceTrackingFilter, setInvoiceTrackingFilter] = useState<InvoiceTrackingFilter>('all');
  const [mandatFilter, setMandatFilter] = useState<string>('all');
  const [contractsSearch, setContractsSearch] = useState('');
  const [contractsPage, setContractsPage] = useState(1);
  const CONTRACTS_PAGE_SIZE = 25;
  const [filters, setFilters] = useState<TableFilters>({
    numeroMission: '',
    student: '',
    startDate: '',
    endDate: '',
    hours: '',
    status: ''
  });
  const [anchorEl, setAnchorEl] = useState<{ [key: string]: HTMLElement | null }>({});
  const [sort, setSort] = useState<SortConfig>({ column: null, direction: null });
  const [openRows, setOpenRows] = useState<{ [key: string]: boolean }>({});
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [invoiceTrackingSort, setInvoiceTrackingSort] = useState<InvoiceTrackingSortConfig>({ column: null, direction: null });

  useEffect(() => {
    setContractsPage(1);
  }, [contractFilter, mandatFilter, contractsSearch, filters, sort.column, sort.direction]);

  const handleTogglePaymentStatus = async (contractId: string, currentStatus: boolean) => {
    if (!currentUser) return;

    try {
      const contract = contracts.find(c => c.mission.id === contractId);
      if (!contract) {
        throw new Error("Contrat non trouvé");
      }

      const contractsRef = collection(db, 'contracts');
      const contractQuery = query(
        contractsRef,
        where('missionId', '==', contractId),
        where('applicationId', '==', contract.application.id),
        where('structureId', '==', userData?.structureId)
      );
      
      const existingContractSnapshot = await getDocs(contractQuery);

      if (!existingContractSnapshot.empty) {
        const contractDocRef = doc(db, 'contracts', existingContractSnapshot.docs[0].id);
        await updateDoc(contractDocRef, {
          isPaymentProcessed: !currentStatus,
          paymentProcessedAt: !currentStatus ? new Date() : null,
          paymentProcessedBy: !currentStatus ? getSafeDisplayName(userData, 'Utilisateur inconnu') : null,
          updatedAt: new Date()
        });
      }

      // Mettre à jour l'état local
      setContracts(prev => prev.map(c => 
        c.mission.id === contractId 
          ? { 
              ...c, 
              isPaymentProcessed: !currentStatus,
              paymentProcessedAt: !currentStatus ? new Date() : null,
              paymentProcessedBy: !currentStatus ? getSafeDisplayName(userData, 'Utilisateur inconnu') : null
            }
          : c
      ));

      enqueueSnackbar(`Paiement ${!currentStatus ? 'marqué comme effectué' : 'marqué comme non effectué'}`, { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors du changement de statut de paiement:', error);
      enqueueSnackbar('Erreur lors du changement de statut de paiement', { variant: 'error' });
    }
  };

  const handleToggleContractGeneration = async (contractId: string, currentStatus: boolean) => {
    if (!currentUser) return;

    try {
      const contract = contracts.find(c => c.mission.id === contractId);
      if (!contract) {
        throw new Error("Contrat non trouvé");
      }

      const contractsRef = collection(db, 'contracts');
      const contractQuery = query(
        contractsRef,
        where('missionId', '==', contractId),
        where('applicationId', '==', contract.application.id)
      );
      
      const existingContractSnapshot = await getDocs(contractQuery);

      let contractDocRef;
      if (existingContractSnapshot.empty) {
        // Créer un nouveau document de contrat s'il n'existe pas
        const contractData = {
          missionId: contract.mission.id,
          applicationId: contract.application.id,
          userId: contract.application.userId,
          missionNumber: contract.mission.numeroMission,
          studentName: contract.application.userDisplayName,
          studentEmail: contract.application.userEmail,
          startDate: contract.mission.startDate,
          endDate: contract.mission.endDate,
          totalHours: contract.totalHoursAssigned,
          status: {
            isContractGenerated: !currentStatus,
            contractGeneratedAt: !currentStatus ? new Date() : null,
            isInvoiceSent: false
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: currentUser.uid,
          structureId: contract.mission.structureId,
          createdByName: getSafeDisplayName(userData, 'Utilisateur inconnu'),
          isPaymentProcessed: false,
          paymentProcessedAt: null,
          paymentProcessedBy: null
        };

        contractDocRef = await addDoc(contractsRef, contractData);
      } else {
        contractDocRef = doc(db, 'contracts', existingContractSnapshot.docs[0].id);
        await updateDoc(contractDocRef, {
          'status.isContractGenerated': !currentStatus,
          'status.contractGeneratedAt': !currentStatus ? new Date() : null,
          updatedAt: new Date()
        });
      }

      // Mettre à jour l'état local
      setContracts(prev => prev.map(c => 
        c.mission.id === contractId 
          ? { 
              ...c, 
              status: { 
                isContractGenerated: !currentStatus,
                contractGeneratedAt: !currentStatus ? new Date() : null
              },
              createdByName: getSafeDisplayName(userData, 'Utilisateur inconnu')
            }
          : c
      ));

      enqueueSnackbar(`Contrat ${!currentStatus ? 'marqué comme généré' : 'marqué comme non généré'}`, { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
      enqueueSnackbar('Erreur lors du changement de statut', { variant: 'error' });
    }
  };

  const handleContractValidate = async (contractId: string) => {
    if (!currentUser) return;

    try {
      setProcessingContract(contractId);
      
      const contract = contracts.find(c => c.mission.id === contractId);
      if (!contract) {
        throw new Error("Contrat non trouvé");
      }

      const contractsRef = collection(db, 'contracts');
      const contractQuery = query(
        contractsRef,
        where('missionId', '==', contractId),
        where('applicationId', '==', contract.application.id)
      );
      
      const existingContractSnapshot = await getDocs(contractQuery);

      let contractDocRef;
      if (existingContractSnapshot.empty) {
        // Créer un nouveau document de contrat avec uniquement les statuts pertinents
        const contractData = {
          missionId: contract.mission.id,
          applicationId: contract.application.id,
          userId: contract.application.userId,
          missionNumber: contract.mission.numeroMission,
          studentName: contract.application.userDisplayName,
          studentEmail: contract.application.userEmail,
          startDate: contract.mission.startDate,
          endDate: contract.mission.endDate,
          totalHours: contract.totalHoursAssigned,
          status: {
            isContractGenerated: true,
            contractGeneratedAt: new Date(),
            isInvoiceSent: false
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: currentUser.uid,
          structureId: contract.mission.structureId,
          createdByName: getSafeDisplayName(userData, 'Utilisateur inconnu'),
          isPaymentProcessed: false,
          paymentProcessedAt: null,
          paymentProcessedBy: null
        };

        contractDocRef = await addDoc(contractsRef, contractData);
      } else {
        contractDocRef = doc(db, 'contracts', existingContractSnapshot.docs[0].id);
        await updateDoc(contractDocRef, {
          'status.isContractGenerated': true,
          'status.contractGeneratedAt': new Date(),
          updatedAt: new Date()
        });
      }

      // Mettre à jour l'état local
      setContracts(prev => prev.map(c => 
        c.mission.id === contractId 
          ? { 
              ...c, 
              status: { 
                isContractGenerated: true,
                contractGeneratedAt: new Date()
              },
              createdByName: getSafeDisplayName(userData, 'Utilisateur inconnu')
            }
          : c
      ));

      setError(null);
      enqueueSnackbar('Contrat validé avec succès', { variant: 'success' });

    } catch (error) {
      console.error('Erreur lors de la validation du contrat:', error);
      setError('Erreur lors de la validation du contrat');
      enqueueSnackbar('Erreur lors de la validation du contrat', { variant: 'error' });
    } finally {
      setProcessingContract(null);
    }
  };

  // Fonction pour filtrer les contrats
  const getFilteredContracts = (contracts: Contract[]) => {
    return contracts.filter(contract => {
      const isGenerated = !!contract.status?.isContractGenerated;
      if (contractFilter === 'all') return true;
      if (contractFilter === 'pending') return !isGenerated;
      if (contractFilter === 'generated') return isGenerated;
      return true;
    });
  };

  // Fonction pour gérer le tri
  const handleSort = (column: keyof TableFilters) => {
    setSort(prev => {
      if (prev.column === column) {
        // Cycle through: asc -> desc -> null
        if (prev.direction === 'asc') return { column, direction: 'desc' };
        if (prev.direction === 'desc') return { column: null, direction: null };
        return { column, direction: 'asc' };
      }
      return { column, direction: 'asc' };
    });
  };

  // Fonction pour trier les contrats
  const getSortedContracts = (contracts: Contract[]) => {
    if (!sort.column || !sort.direction) return contracts;

    return [...contracts].sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (sort.column) {
        case 'numeroMission':
          valueA = a.mission.numeroMission;
          valueB = b.mission.numeroMission;
          break;
        case 'student':
          valueA = a.application.userDisplayName;
          valueB = b.application.userDisplayName;
          break;
        case 'startDate':
          valueA = new Date(a.mission.startDate).getTime();
          valueB = new Date(b.mission.startDate).getTime();
          break;
        case 'endDate':
          valueA = new Date(a.mission.endDate).getTime();
          valueB = new Date(b.mission.endDate).getTime();
          break;
        case 'hours':
          valueA = a.totalHoursAssigned;
          valueB = b.totalHoursAssigned;
          break;
        case 'status':
          valueA = a.status?.isContractGenerated ? 1 : 0;
          valueB = b.status?.isContractGenerated ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (sort.direction === 'asc') {
        return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
      } else {
        return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
      }
    });
  };

  // Fonction pour ouvrir le menu de filtre
  const handleFilterClick = (event: React.MouseEvent<HTMLButtonElement>, column: string) => {
    setAnchorEl(prev => ({ ...prev, [column]: event.currentTarget }));
  };

  // Fonction pour fermer le menu de filtre
  const handleFilterClose = (column: string) => {
    setAnchorEl(prev => ({ ...prev, [column]: null }));
  };

  // Fonction pour mettre à jour un filtre
  const handleFilterChange = (column: string, value: string) => {
    setFilters(prev => ({ ...prev, [column]: value }));
    handleFilterClose(column);
  };

  // Fonction pour réinitialiser tous les filtres
  const handleResetFilters = () => {
    setFilters({
      numeroMission: '',
      student: '',
      startDate: '',
      endDate: '',
      hours: '',
      status: ''
    });
  };

  // Modifier le composant FilterableColumnHeader
  const FilterableColumnHeader: React.FC<{
    column: keyof TableFilters;
    label: string;
  }> = ({ column, label }) => {
    const buttonRef = useRef<HTMLButtonElement>(null);

    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        justifyContent: 'space-between',
        cursor: 'pointer',
        userSelect: 'none',
        '&:hover': {
          '& .sort-icon': {
            opacity: sort.column === column ? 1 : 0.5
          }
        }
      }}>
        <Box
          onClick={() => handleSort(column)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          {label}
          <Box sx={{ 
            display: 'flex',
            alignItems: 'center',
            opacity: sort.column === column ? 1 : 0,
            transition: 'opacity 0.2s',
            color: tokens.colors.info
          }} className="sort-icon">
            {sort.column === column && (
              sort.direction === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : 
              sort.direction === 'desc' ? <ArrowDownwardIcon fontSize="small" /> :
              <ImportExportIcon fontSize="small" />
            )}
            {sort.column !== column && <ImportExportIcon fontSize="small" />}
          </Box>
        </Box>
        <IconButton
          ref={buttonRef}
          size="small"
          onClick={(e) => handleFilterClick(e, column)}
          sx={{
            color: filters[column] ? tokens.colors.info : tokens.colors.textSecondary,
            padding: '4px',
            '&:hover': {
              backgroundColor: 'rgba(0, 122, 255, 0.08)'
            }
          }}
        >
          <FilterListIcon fontSize="small" />
        </IconButton>
        <Menu
          anchorEl={anchorEl[column]}
          open={Boolean(anchorEl[column])}
          onClose={() => handleFilterClose(column)}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          PaperProps={{
            sx: {
              mt: 0.5,
              boxShadow: tokens.shadows.md,
              borderRadius: tokens.radius.md
            }
          }}
        >
          <Box sx={{ p: 2, width: 250 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Filtrer par {label.toLowerCase()}
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={filters[column]}
              onChange={(e) => handleFilterChange(column, e.target.value)}
              placeholder="Rechercher..."
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: tokens.radius.sm
                }
              }}
            />
          </Box>
        </Menu>
      </Box>
    );
  };

  // Ajouter la fonction de traitement du paiement
  const handleProcessPayment = async (missionId: string) => {
    try {
      const missionRef = doc(db, 'missions', missionId);
      await updateDoc(missionRef, {
        isPaymentProcessed: true,
        paymentProcessedAt: new Date(),
        paymentProcessedBy: getSafeDisplayName(userData, 'Utilisateur inconnu')
      });
      
      // Mettre à jour l'état local
      setContracts(prev => prev.map(contract => 
        contract.mission.id === missionId 
          ? {
              ...contract,
              isPaymentProcessed: true,
              paymentProcessedAt: new Date(),
              paymentProcessedBy: getSafeDisplayName(userData, 'Utilisateur inconnu')
            }
          : contract
      ));

      enqueueSnackbar('Paiement marqué comme effectué', { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors du traitement du paiement:', error);
      enqueueSnackbar('Erreur lors du traitement du paiement', { variant: 'error' });
    }
  };

  const handleToggleRow = (rowId: string) => {
    setOpenRows(prev => ({
      ...prev,
      [rowId]: !prev[rowId]
    }));
  };

  // Gestion des checkboxes pour le suivi des factures
  const handleSelectAllInvoices = (invoices: Contract[]) => {
    if (selectedInvoices.size === invoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(invoices.map(c => c.mission.id)));
    }
  };

  const handleSelectInvoice = (missionId: string) => {
    const newSelected = new Set(selectedInvoices);
    if (newSelected.has(missionId)) {
      newSelected.delete(missionId);
    } else {
      newSelected.add(missionId);
    }
    setSelectedInvoices(newSelected);
  };

  // Gestion du tri pour le suivi des factures
  const handleInvoiceTrackingSort = (column: InvoiceTrackingSortColumn) => {
    setInvoiceTrackingSort(prev => {
      if (prev.column === column) {
        if (prev.direction === 'asc') return { column, direction: 'desc' };
        if (prev.direction === 'desc') return { column: null, direction: null };
        return { column, direction: 'asc' };
      }
      return { column, direction: 'asc' };
    });
  };

  // Fonction pour trier les factures
  const getSortedInvoices = (invoices: Contract[]) => {
    if (!invoiceTrackingSort.column || !invoiceTrackingSort.direction) return invoices;

    return [...invoices].sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (invoiceTrackingSort.column) {
        case 'numeroMission':
          valueA = a.mission.numeroMission;
          valueB = b.mission.numeroMission;
          break;
        case 'company':
          valueA = (a.mission as any).company || '';
          valueB = (b.mission as any).company || '';
          break;
        case 'amount':
          valueA = a.invoiceDocument?.invoiceAmount || 0;
          valueB = b.invoiceDocument?.invoiceAmount || 0;
          break;
        case 'sentDate':
          valueA = a.invoiceDocument?.invoiceSentDate?.getTime() || 0;
          valueB = b.invoiceDocument?.invoiceSentDate?.getTime() || 0;
          break;
        case 'dueDate':
          valueA = a.invoiceDocument?.invoiceDueDate?.getTime() || 0;
          valueB = b.invoiceDocument?.invoiceDueDate?.getTime() || 0;
          break;
        case 'daysRemaining':
          const getDaysRemaining = (contract: Contract) => {
            if (!contract.invoiceDocument?.invoiceDueDate || contract.mission.invoiceStatus === 'paid') return 999999;
            const dueDate = new Date(contract.invoiceDocument.invoiceDueDate);
            const today = new Date();
            return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          };
          valueA = getDaysRemaining(a);
          valueB = getDaysRemaining(b);
          break;
        case 'status':
          const getStatusPriority = (status: string) => {
            if (status === 'paid') return 3;
            if (status === 'sent') return 2;
            return 1;
          };
          valueA = getStatusPriority(a.mission.invoiceStatus || 'to_send');
          valueB = getStatusPriority(b.mission.invoiceStatus || 'to_send');
          break;
        default:
          return 0;
      }

      if (invoiceTrackingSort.direction === 'asc') {
        return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
      } else {
        return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
      }
    });
  };

  useEffect(() => {
    const uid = currentUser?.uid;
    const structureIdFromAuth = userData?.structureId as string | undefined;
    if (!uid) return;

    let cancelled = false;

    const fetchContracts = async () => {
      try {
        setLoading(true);
        setError(null);

        let userStructureId = structureIdFromAuth;
        let viewerUserData: Record<string, unknown> | null = userData as Record<string, unknown> | null;

        if (!userStructureId) {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (!userDoc.exists()) {
            if (!cancelled) setLoading(false);
            return;
          }
          viewerUserData = userDoc.data();
          userStructureId = viewerUserData?.structureId as string | undefined;
        }

        if (!userStructureId) {
          if (!cancelled) {
            setContracts([]);
            setLoading(false);
          }
          return;
        }

        const missionsSnapshot = await getDocs(
          query(collection(db, 'missions'), where('structureId', '==', userStructureId))
        );
        if (cancelled) return;

        if (missionsSnapshot.empty) {
          setContracts([]);
          return;
        }

        const missions = missionsSnapshot.docs.map((missionDoc) => ({
          id: missionDoc.id,
          ...missionDoc.data(),
        })) as Mission[];
        const missionIds = missions.map((m) => m.id);
        const missionById = new Map(missions.map((m) => [m.id, m]));

        // Parallel: mandats CDM uniques + contrats structure + factures structure
        const chargeIds = [
          ...new Set(missions.map((m) => m.chargeId).filter((id): id is string => Boolean(id))),
        ];

        const [mandatByChargeId, contractsByKey, invoiceByMissionId] = await Promise.all([
          (async () => {
            const map = new Map<string, string | undefined>();
            await Promise.all(
              chargeIds.map(async (chargeId) => {
                try {
                  const chargeDoc = await getDoc(doc(db, 'users', chargeId));
                  if (chargeDoc.exists()) {
                    map.set(chargeId, chargeDoc.data().mandat || undefined);
                  }
                } catch {
                  /* ignore */
                }
              })
            );
            return map;
          })(),
          (async () => {
            const map = new Map<string, { status: ContractStatus; isPaymentProcessed: boolean; paymentProcessedAt: Date | null; paymentProcessedBy: string | null }>();
            const snap = await getDocs(
              query(collection(db, 'contracts'), where('structureId', '==', userStructureId))
            );
            snap.docs.forEach((cDoc) => {
              const data = cDoc.data();
              const key = `${data.missionId}:${data.applicationId}`;
              const statusData = data.status || {};
              map.set(key, {
                status: {
                  isContractGenerated: !!statusData.isContractGenerated,
                  contractGeneratedAt: statusData.contractGeneratedAt?.toDate?.() || undefined,
                },
                isPaymentProcessed: !!data.isPaymentProcessed,
                paymentProcessedAt: data.paymentProcessedAt?.toDate?.() || data.paymentProcessedAt || null,
                paymentProcessedBy: data.paymentProcessedBy || null,
              });
            });
            return map;
          })(),
          (async () => {
            const map = new Map<string, InvoiceDocument>();
            const snap = await getDocs(
              query(
                collection(db, 'generatedDocuments'),
                where('structureId', '==', userStructureId),
                where('category', '==', 'facturation')
              )
            );
            snap.docs.forEach((d) => {
              const data = d.data();
              if (data.missionId && !map.has(data.missionId)) {
                map.set(data.missionId, toInvoiceDocument(d.id, data));
              }
            });
            return map;
          })(),
        ]);

        if (cancelled) return;

        missions.forEach((mission) => {
          const cdmMandat = mission.chargeId ? mandatByChargeId.get(mission.chargeId) : undefined;
          if (!mission.mandat && cdmMandat) mission.mandat = cdmMandat;
        });

        // Applications acceptées — batch missionId IN (30)
        const acceptedApps: Array<{ id: string; data: Record<string, any>; missionId: string }> = [];
        await Promise.all(
          chunkArray(missionIds).map(async (chunk) => {
            const snap = await getDocs(
              query(collection(db, 'applications'), where('missionId', 'in', chunk))
            );
            snap.docs.forEach((appDoc) => {
              const data = appDoc.data();
              if (data.status === 'Acceptée') {
                acceptedApps.push({ id: appDoc.id, data, missionId: data.missionId });
              }
            });
          })
        );
        if (cancelled) return;

        const applicationIds = acceptedApps.map((a) => a.id);
        const userIds = [
          ...new Set(acceptedApps.map((a) => a.data.userId as string).filter(Boolean)),
        ];

        // Parallel: heures, notes de frais, profils étudiants (sans decrypt callable)
        const [hoursByAppId, expensesByKey, userById] = await Promise.all([
          (async () => {
            const map = new Map<string, WorkingHourLine[]>();
            await Promise.all(
              chunkArray(applicationIds).map(async (chunk) => {
                const snap = await getDocs(
                  query(collection(db, 'workingHours'), where('applicationId', 'in', chunk))
                );
                const byApp = new Map<string, typeof snap.docs>();
                snap.docs.forEach((whDoc) => {
                  const appId = whDoc.data().applicationId as string;
                  if (!byApp.has(appId)) byApp.set(appId, []);
                  byApp.get(appId)!.push(whDoc);
                });
                byApp.forEach((docs, appId) => {
                  map.set(appId, parseWorkingHourLines(docs));
                });
              })
            );
            return map;
          })(),
          (async () => {
            const map = new Map<string, ExpenseNote[]>();
            await Promise.all(
              chunkArray(missionIds).map(async (chunk) => {
                const snap = await getDocs(
                  query(collection(db, 'expenseNotes'), where('missionId', 'in', chunk))
                );
                snap.docs.forEach((noteDoc) => {
                  const data = noteDoc.data();
                  const key = `${data.missionId}:${data.userId}`;
                  const note: ExpenseNote = {
                    id: noteDoc.id,
                    description: data.description || '',
                    amount: data.amount || 0,
                    status: data.status || 'En attente',
                    date: data.date?.toDate?.() || new Date(),
                  };
                  if (!map.has(key)) map.set(key, []);
                  map.get(key)!.push(note);
                });
              })
            );
            return map;
          })(),
          (async () => {
            const map = new Map<string, Record<string, any>>();
            await Promise.all(
              userIds.map(async (userId) => {
                try {
                  const uDoc = await getDoc(doc(db, 'users', userId));
                  if (uDoc.exists()) map.set(userId, uDoc.data());
                } catch {
                  /* ignore */
                }
              })
            );
            return map;
          })(),
        ]);

        if (cancelled) return;

        const contractsData: Contract[] = [];
        const missionsWithAcceptedApp = new Set<string>();

        for (const app of acceptedApps) {
          const mission = missionById.get(app.missionId);
          if (!mission) continue;
          missionsWithAcceptedApp.add(mission.id);

          const userId = app.data.userId as string;
          const userFromDb = userById.get(userId);
          const displayName =
            plainText(userFromDb?.displayName) ||
            [plainText(userFromDb?.firstName), plainText(userFromDb?.lastName)].filter(Boolean).join(' ') ||
            plainText(app.data.userDisplayName) ||
            'Utilisateur inconnu';
          const email = plainText(userFromDb?.email) || plainText(app.data.userEmail) || '';

          const extendedUserData: ExtendedUserData = {
            firstName: plainText(userFromDb?.firstName),
            lastName: plainText(userFromDb?.lastName),
            socialSecurityNumber: plainText(userFromDb?.socialSecurityNumber),
            birthPlace: plainText(userFromDb?.birthPlace),
            birthPostalCode: plainText(userFromDb?.birthPostalCode),
            nationality: plainText(userFromDb?.nationality),
            address: plainText(userFromDb?.address),
            email,
            displayName,
          };

          const workingHours = hoursByAppId.get(app.id) || [];
          const totalHoursAssigned = sumWorkingHours(workingHours);
          const expenseNotes = expensesByKey.get(`${mission.id}:${userId}`) || [];
          const contractMeta = contractsByKey.get(`${mission.id}:${app.id}`);
          const cdmMandat = mission.chargeId ? mandatByChargeId.get(mission.chargeId) : undefined;

          contractsData.push({
            mission,
            application: {
              id: app.id,
              userId,
              userDisplayName: displayName,
              userEmail: email,
              userData: extendedUserData,
              workingHours,
            },
            totalHoursAssigned,
            status: contractMeta?.status || { isContractGenerated: false },
            createdByName: getSafeDisplayName(viewerUserData, 'Utilisateur inconnu'),
            expenseNotes,
            isPaymentProcessed: contractMeta?.isPaymentProcessed || false,
            paymentProcessedAt: contractMeta?.paymentProcessedAt || undefined,
            paymentProcessedBy: contractMeta?.paymentProcessedBy || undefined,
            cdmMandat: cdmMandat || mission.mandat,
            invoiceDocument: invoiceByMissionId.get(mission.id),
          });
        }

        // Missions sans étudiant mais avec facture (suivi facturation)
        for (const mission of missions) {
          if (missionsWithAcceptedApp.has(mission.id)) continue;
          const invoiceDocument = invoiceByMissionId.get(mission.id);
          if (!invoiceDocument) continue;
          const cdmMandat = mission.chargeId ? mandatByChargeId.get(mission.chargeId) : undefined;
          contractsData.push({
            mission,
            application: {
              id: 'no-application',
              userEmail: 'N/A',
              userDisplayName: "Pas d'étudiant assigné",
              workingHours: [],
            },
            totalHoursAssigned: 0,
            status: { isContractGenerated: false },
            createdByName: getSafeDisplayName(viewerUserData, 'Utilisateur inconnu'),
            expenseNotes: [],
            isPaymentProcessed: false,
            paymentProcessedAt: undefined,
            paymentProcessedBy: undefined,
            cdmMandat: cdmMandat || mission.mandat,
            invoiceDocument,
          });
        }

        contractsData.sort((a, b) => {
          const paymentDateA = calculatePaymentDate(a.mission.endDate);
          const paymentDateB = calculatePaymentDate(b.mission.endDate);
          return paymentDateA.getTime() - paymentDateB.getTime();
        });

        if (!cancelled) setContracts(contractsData);
      } catch (err) {
        console.error('Erreur lors de la récupération des contrats:', err);
        if (!cancelled) setError('Erreur lors de la récupération des contrats');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchContracts();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid, userData?.structureId]);

  const isUnknownStudentName = (name?: string) => {
    const n = (name || '').trim().toLowerCase();
    return !n || n === 'utilisateur inconnu' || n === 'inconnu' || n === 'n/a';
  };

  const studentContracts = contracts.filter(
    (c) =>
      c.application.id !== 'no-application' &&
      !isUnknownStudentName(c.application.userDisplayName)
  );

  const contractsPending = studentContracts.filter((c) => !c.status?.isContractGenerated).length;
  const paymentsPending = studentContracts.filter((c) => !c.isPaymentProcessed).length;
  const invoicesPending = contracts.filter(
    (c) => (c.mission.invoiceStatus || 'to_send') === 'to_send'
  ).length;
  const invoicesTracked = contracts.filter((c) => c.invoiceDocument?.fileName).length;

  const filterFieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: tokens.radius.md,
      bgcolor: tokens.colors.bgPaper,
      fontSize: 13,
      '& fieldset': { borderColor: tokens.colors.gray200 },
      '&:hover fieldset': { borderColor: tokens.colors.gray300 },
      '&.Mui-focused fieldset': { borderColor: tokens.colors.brandTeal },
    },
  };

  const thSx = {
    fontWeight: 600,
    fontSize: '0.6875rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    color: tokens.colors.gray500,
    borderBottom: `1px solid ${tokens.colors.divider}`,
    bgcolor: tokens.colors.surfaceAlt,
    py: 1.25,
    whiteSpace: 'nowrap' as const,
  };

  const panelSx = {
    bgcolor: tokens.colors.bgPaper,
    border: `1px solid ${tokens.colors.divider}`,
    borderRadius: tokens.radius.lg,
    overflow: 'hidden',
  };

  const filterBarSx = {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 1.5,
    alignItems: 'center',
    mb: 2.5,
    p: 1.5,
    ...panelSx,
  };

  const contractsTabFiltered = getSortedContracts(
    getFilteredContracts(
      studentContracts.filter((contract) => {
        if (mandatFilter !== 'all') {
          const contractMandat = contract.cdmMandat || contract.mission.mandat;
          if (contractMandat !== mandatFilter) return false;
        }
        if (contractsSearch.trim()) {
          const q = contractsSearch.trim().toLowerCase();
          const hay = [
            contract.mission.numeroMission,
            contract.application.userDisplayName,
            contract.application.userEmail,
            (contract.mission as { company?: string }).company,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (filters.numeroMission && !contract.mission.numeroMission.toLowerCase().includes(filters.numeroMission.toLowerCase())) {
          return false;
        }
        if (filters.student && !contract.application.userDisplayName.toLowerCase().includes(filters.student.toLowerCase())) {
          return false;
        }
        if (filters.status === 'generated' && !contract.status?.isContractGenerated) return false;
        if (filters.status === 'pending' && contract.status?.isContractGenerated) return false;
        return true;
      })
    )
  );
  const contractsTabPageCount = Math.max(1, Math.ceil(contractsTabFiltered.length / CONTRACTS_PAGE_SIZE));
  const contractsTabPageRows = contractsTabFiltered.slice(
    (contractsPage - 1) * CONTRACTS_PAGE_SIZE,
    contractsPage * CONTRACTS_PAGE_SIZE
  );

  if (loading || permissionLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flex: 1,
          minHeight: 0,
          bgcolor: tokens.colors.surfaceAlt,
        }}
      >
        <CircularProgress sx={{ color: tokens.colors.brandTeal }} />
      </Box>
    );
  }

  if (!canRead) {
    return (
      <AccessDenied
        title="Accès refusé"
        message="Vous n'avez pas les permissions nécessaires pour accéder à la Trésorerie. Contactez votre administrateur pour obtenir l'accès."
      />
    );
  }

  const treasuryTabIds = ['contracts', 'payments', 'invoices', 'tracking'] as const;
  const activeTreasuryTab = treasuryTabIds[tabValue] ?? 'contracts';

  const treasuryTabs = [
    {
      id: 'contracts',
      label: 'Contrats',
      icon: <DescriptionIcon />,
      count: contractsPending,
    },
    {
      id: 'payments',
      label: 'Paiements',
      icon: <PaymentIcon />,
      count: paymentsPending,
    },
    {
      id: 'invoices',
      label: 'Factures',
      icon: <ReceiptIcon />,
      count: invoicesPending,
    },
    {
      id: 'tracking',
      label: 'Suivi',
      icon: <CheckCircleIcon />,
      count: invoicesTracked,
    },
  ];

  const goToTreasuryTab = (id: string) => {
    const idx = treasuryTabIds.indexOf(id as (typeof treasuryTabIds)[number]);
    if (idx >= 0) setTabValue(idx);
  };

  const kpiClickSx = (active: boolean) => ({
    cursor: 'pointer',
    transition: tokens.transitions.fast,
    bgcolor: active ? `${tokens.colors.brandTeal}0A` : 'transparent',
    outline: active ? `2px solid ${tokens.colors.brandTeal}33` : '2px solid transparent',
    outlineOffset: -2,
    '&:hover': { bgcolor: active ? `${tokens.colors.brandTeal}12` : tokens.colors.gray50 },
  });

  return (
    <AppPageShell
      eyebrow="Finance"
      title="Trésorerie"
      titleSuffix={String(studentContracts.length)}
      subtitle="Contrats, paiements et suivi des factures"
      kpiColumns={4}
      kpiStrip={
        <>
          <Box onClick={() => setTabValue(0)} sx={kpiClickSx(tabValue === 0)}>
            <KpiCard label="Contrats à générer" value={contractsPending} density="compact" sparkColor={tokens.colors.warning} />
          </Box>
          <Box onClick={() => setTabValue(1)} sx={kpiClickSx(tabValue === 1)}>
            <KpiCard label="Paiements à faire" value={paymentsPending} density="compact" sparkColor={tokens.colors.warning} />
          </Box>
          <Box onClick={() => setTabValue(2)} sx={kpiClickSx(tabValue === 2)}>
            <KpiCard label="Factures à envoyer" value={invoicesPending} density="compact" sparkColor={tokens.colors.info} />
          </Box>
          <Box onClick={() => setTabValue(3)} sx={kpiClickSx(tabValue === 3)}>
            <KpiCard label="Factures suivies" value={invoicesTracked} density="compact" sparkColor={tokens.colors.success} />
          </Box>
        </>
      }
    >
      <Box sx={{ px: 3, py: 2.5, pb: 4, width: '100%' }}>
        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 2,
              borderRadius: tokens.radius.md,
              border: `1px solid ${tokens.colors.error}33`,
            }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 2.5 }}>
          <CommercialViewTabs
            fullWidth
            active={activeTreasuryTab}
            onChange={goToTreasuryTab}
            tabs={treasuryTabs}
          />
        </Box>

        <Box>
        <TabPanel value={tabValue} index={0}>
          {studentContracts.length === 0 ? (
            <EmptyState
              icon={<DescriptionIcon />}
              title="Aucun contrat à générer"
              description="Les contrats apparaîtront ici lorsqu'un étudiant sera accepté sur une mission."
            />
          ) : (
            <>
              <Box sx={{ ...filterBarSx }}>
                <SegmentedControl
                  value={contractFilter}
                  onChange={(v) => setContractFilter(v as ContractFilter)}
                  options={[
                    { value: 'pending', label: 'À générer' },
                    { value: 'generated', label: 'Générés' },
                    { value: 'all', label: 'Tous' },
                  ]}
                />
                <TextField
                  size="small"
                  placeholder="Rechercher mission, étudiant…"
                  value={contractsSearch}
                  onChange={(e) => setContractsSearch(e.target.value)}
                  sx={{ flex: '1 1 220px', minWidth: 180, ...filterFieldSx }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: tokens.colors.gray400, fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <FormControl size="small" sx={{ minWidth: 150, ...filterFieldSx }}>
                  <InputLabel>Mandat</InputLabel>
                  <Select
                    value={mandatFilter}
                    label="Mandat"
                    onChange={(e) => setMandatFilter(e.target.value)}
                  >
                    <MenuItem value="all">Tous les mandats</MenuItem>
                    {AVAILABLE_MANDATS.map((mandat) => (
                      <MenuItem key={mandat} value={mandat}>
                        {mandat}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {(contractsSearch || Object.values(filters).some((f) => f !== '') || mandatFilter !== 'all' || contractFilter !== 'pending') && (
                  <Button
                    startIcon={<ClearIcon />}
                    onClick={() => {
                      setContractsSearch('');
                      setMandatFilter('all');
                      setContractFilter('pending');
                      handleResetFilters();
                    }}
                    size="small"
                    variant="text"
                    sx={{ color: tokens.colors.gray600, textTransform: 'none', fontWeight: 600 }}
                  >
                    Réinitialiser
                  </Button>
                )}
              </Box>

              <Box sx={panelSx}>
                <Box
                  sx={{
                    px: 2.5,
                    py: 1.5,
                    borderBottom: `1px solid ${tokens.colors.divider}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                  }}
                >
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.colors.gray900 }}>
                    Contrats
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: tokens.colors.gray500 }}>
                    {contractsTabFiltered.length} résultat{contractsTabFiltered.length > 1 ? 's' : ''}
                    {contractsTabFiltered.length > CONTRACTS_PAGE_SIZE
                      ? ` · page ${contractsPage}/${contractsTabPageCount}`
                      : ''}
                  </Typography>
                </Box>

                {contractsTabFiltered.length === 0 ? (
                  <EmptyState
                    icon={<DescriptionIcon />}
                    title="Aucun résultat"
                    description="Aucun contrat ne correspond à ces filtres. Essayez « Tous » ou élargissez la recherche."
                  />
                ) : (
                  <>
                    <TableContainer sx={{ maxHeight: 'min(62vh, 640px)', overflow: 'auto' }}>
                      <Table stickyHeader size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ ...thSx, width: 48, position: 'sticky', top: 0, zIndex: 3 }} />
                            <TableCell sx={{ ...thSx, position: 'sticky', top: 0, zIndex: 3 }}>
                              <FilterableColumnHeader column="numeroMission" label="Mission" />
                            </TableCell>
                            <TableCell sx={{ ...thSx, position: 'sticky', top: 0, zIndex: 3 }}>
                              <FilterableColumnHeader column="student" label="Étudiant" />
                            </TableCell>
                            <TableCell sx={{ ...thSx, position: 'sticky', top: 0, zIndex: 3 }}>
                              <FilterableColumnHeader column="startDate" label="Début" />
                            </TableCell>
                            <TableCell sx={{ ...thSx, position: 'sticky', top: 0, zIndex: 3 }}>
                              <FilterableColumnHeader column="endDate" label="Fin" />
                            </TableCell>
                            <TableCell sx={{ ...thSx, position: 'sticky', top: 0, zIndex: 3 }} align="right">
                              <FilterableColumnHeader column="hours" label="Heures" />
                            </TableCell>
                            <TableCell sx={{ ...thSx, position: 'sticky', top: 0, zIndex: 3 }}>
                              <FilterableColumnHeader column="status" label="Statut" />
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                {contractsTabPageRows.map((contract) => {
                    const rowId = `${contract.mission.id}-${contract.application.id}`;
                    const isOpen = openRows[rowId] || false;

                    return (
                      <React.Fragment key={rowId}>
                        <TableRow
                          hover
                          selected={isOpen}
                          sx={{
                            '& > td': {
                              py: 1.1,
                              fontSize: 13,
                              borderBottom: `1px solid ${tokens.colors.divider}`,
                              verticalAlign: 'middle',
                            },
                            '&:hover': { bgcolor: tokens.colors.gray50 },
                            '&.Mui-selected': { bgcolor: `${tokens.colors.brandTeal}0F` },
                            '&.Mui-selected:hover': { bgcolor: `${tokens.colors.brandTeal}18` },
                          }}
                        >
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => handleToggleRow(rowId)}
                              sx={{ color: tokens.colors.gray500 }}
                            >
                              {isOpen ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                            </IconButton>
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.colors.gray900, fontVariantNumeric: 'tabular-nums' }}>
                              {contract.mission.numeroMission}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <StyledTooltip
                              title={<UserInfoTooltip userData={contract.application.userData || {
                                firstName: '',
                                lastName: '',
                                email: contract.application.userEmail,
                                displayName: contract.application.userDisplayName
                              }} />}
                              placement="right"
                              arrow
                            >
                              <Typography sx={{ 
                                cursor: 'pointer',
                                '&:hover': {
                                  color: tokens.colors.info
                                }
                              }}>
                                <UserReferenceText
                                  userId={contract.application.userId}
                                  name={contract.application.userDisplayName}
                                  firstName={contract.application.userData?.firstName}
                                  lastName={contract.application.userData?.lastName}
                                  component="span"
                                  fallback="Inconnu"
                                />
                              </Typography>
                            </StyledTooltip>
                          </TableCell>
                          {tabValue === 0 && (
                            <TableCell>{formatDate(contract.mission.startDate)}</TableCell>
                          )}
                          <TableCell>{formatDate(contract.mission.endDate)}</TableCell>
                          <TableCell>{contract.totalHoursAssigned.toFixed(2)}h</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box
                                  onClick={() => handleToggleContractGeneration(contract.mission.id, !!contract.status?.isContractGenerated)}
                                  sx={{ cursor: 'pointer', display: 'inline-flex' }}
                                >
                                  <DsPill
                                    bg={contract.status?.isContractGenerated ? `${tokens.colors.success}22` : tokens.colors.gray100}
                                    fg={contract.status?.isContractGenerated ? tokens.colors.success : tokens.colors.gray600}
                                  >
                                    {contract.status?.isContractGenerated ? 'Généré' : 'Non généré'}
                                  </DsPill>
                                </Box>
                                {contract.status?.isContractGenerated && contract.status?.contractGeneratedAt && (
                                  <StyledTooltip
                                    title={
                                      <Box sx={{ 
                                        p: 1,
                                        backgroundColor: '#FFFFFF'
                                      }}>
                                        <Typography variant="subtitle2" sx={{ 
                                          fontWeight: 600,
                                          color: tokens.colors.textPrimary,
                                          mb: 1,
                                          backgroundColor: '#FFFFFF'
                                        }}>
                                          Informations de génération
                                        </Typography>
                                        <Box sx={{ 
                                          display: 'flex', 
                                          flexDirection: 'column', 
                                          gap: 1,
                                          backgroundColor: '#FFFFFF'
                                        }}>
                                          <Box sx={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: 1,
                                            backgroundColor: '#FFFFFF'
                                          }}>
                                            <Typography variant="body2" sx={{ 
                                              color: tokens.colors.textSecondary,
                                              backgroundColor: '#FFFFFF'
                                            }}>
                                              Date :
                                            </Typography>
                                            <Typography variant="body2" sx={{ 
                                              color: tokens.colors.textPrimary,
                                              backgroundColor: '#FFFFFF'
                                            }}>
                                              {contract.status.contractGeneratedAt.toLocaleDateString('fr-FR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric'
                                              })}
                                            </Typography>
                                          </Box>
                                          <Box sx={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: 1,
                                            backgroundColor: '#FFFFFF'
                                          }}>
                                            <Typography variant="body2" sx={{ 
                                              color: tokens.colors.textSecondary,
                                              backgroundColor: '#FFFFFF'
                                            }}>
                                              Heure :
                                            </Typography>
                                            <Typography variant="body2" sx={{ 
                                              color: tokens.colors.textPrimary,
                                              backgroundColor: '#FFFFFF'
                                            }}>
                                              {contract.status.contractGeneratedAt.toLocaleTimeString('fr-FR', {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                              })}
                                            </Typography>
                                          </Box>
                                          <Box sx={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: 1,
                                            backgroundColor: '#FFFFFF'
                                          }}>
                                            <Typography variant="body2" sx={{ 
                                              color: tokens.colors.textSecondary,
                                              backgroundColor: '#FFFFFF'
                                            }}>
                                              Généré par :
                                            </Typography>
                                            <UserReferenceText
                                              name={contract.createdByName}
                                              fallback="Utilisateur inconnu"
                                              component="span"
                                              variant="body2"
                                              sx={{ color: tokens.colors.textPrimary, backgroundColor: '#FFFFFF' }}
                                            />
                                          </Box>
                                        </Box>
                                      </Box>
                                    }
                                    placement="right"
                                    arrow
                                  >
                                    <IconButton
                                      size="small"
                                      sx={{
                                        color: tokens.colors.info,
                                        padding: '4px',
                                        '&:hover': {
                                          backgroundColor: 'rgba(0, 122, 255, 0.08)'
                                        }
                                      }}
                                    >
                                      <InfoIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </StyledTooltip>
                                )}
                              </Box>
                            </Box>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
                            <Collapse in={isOpen} timeout="auto" unmountOnExit>
                              <Box sx={{ margin: 2 }}>
                                <Typography variant="h6" gutterBottom component="div">
                                  {tabValue === 0 ? "Détail des heures" : "Détail des heures et paiements"}
                                </Typography>
                                {tabValue === 0 ? (
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>Date</TableCell>
                                        <TableCell>Début</TableCell>
                                        <TableCell>Fin</TableCell>
                                        <TableCell>Pauses</TableCell>
                                        <TableCell>Total heures</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {contract.application.workingHours?.map((wh, index) => {
                                        const periodHours = calculateWorkingHours(wh.startDate, wh.startTime, wh.endDate, wh.endTime, wh.breaks);
                                        return (
                                          <TableRow key={index}>
                                            <TableCell>{new Date(wh.startDate).toLocaleDateString('fr-FR')}</TableCell>
                                            <TableCell>{wh.startTime}</TableCell>
                                            <TableCell>{new Date(wh.endDate).toLocaleDateString('fr-FR')}</TableCell>
                                            <TableCell>{wh.endTime}</TableCell>
                                            <TableCell>
                                              {wh.breaks && wh.breaks.length > 0 ? (
                                                wh.breaks.map((breakTime, idx) => (
                                                  <Box key={idx} sx={{ mb: idx !== wh.breaks.length - 1 ? 1 : 0 }}>
                                                    {breakTime.start} - {breakTime.end}
                                                  </Box>
                                                ))
                                              ) : (
                                                "Aucune pause"
                                              )}
                                            </TableCell>
                                            <TableCell>{periodHours.toFixed(2)}h</TableCell>
                                          </TableRow>
                                        );
                                      })}
                                      <TableRow>
                                        <TableCell colSpan={4} sx={{ fontWeight: 600 }}>
                                          Total heures
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>
                                          {contract.totalHoursAssigned.toFixed(2)}h
                                        </TableCell>
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <>
                                    <Table size="small">
                                      <TableHead>
                                        <TableRow>
                                          <TableCell>Date</TableCell>
                                          <TableCell>Heures travaillées</TableCell>
                                          <TableCell>Montant</TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {contract.application.workingHours?.map((wh, index) => {
                                          const dailyHours = calculateWorkingHours(wh.startDate, wh.startTime, wh.endDate, wh.endTime, wh.breaks);
                                          const dailyAmount = dailyHours * parseFloat(contract.mission.salary || '0');
                                          return (
                                            <TableRow key={index}>
                                              <TableCell>{new Date(wh.startDate).toLocaleDateString('fr-FR')}</TableCell>
                                              <TableCell>{dailyHours.toFixed(2)}h</TableCell>
                                              <TableCell>{dailyAmount.toFixed(2)}€</TableCell>
                                            </TableRow>
                                          );
                                        })}
                                        <TableRow>
                                          <TableCell colSpan={2} sx={{ fontWeight: 600 }}>
                                            Sous-total heures
                                          </TableCell>
                                          <TableCell sx={{ fontWeight: 600 }}>
                                            {(contract.totalHoursAssigned * parseFloat(contract.mission.salary || '0')).toFixed(2)}€
                                          </TableCell>
                                        </TableRow>
                                      </TableBody>
                                    </Table>

                                    {contract.expenseNotes && contract.expenseNotes.length > 0 && (
                                      <>
                                        <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                                          Notes de frais validées
                                        </Typography>
                                        <Table size="small">
                                          <TableHead>
                                            <TableRow>
                                              <TableCell>Date</TableCell>
                                              <TableCell>Description</TableCell>
                                              <TableCell>Montant</TableCell>
                                            </TableRow>
                                          </TableHead>
                                          <TableBody>
                                            {contract.expenseNotes?.map((note) => (
                                              <TableRow key={note.id}>
                                                <TableCell>
                                                  {note.date.toLocaleDateString('fr-FR')}
                                                </TableCell>
                                                <TableCell>{note.description}</TableCell>
                                                <TableCell>
                                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    {note.amount.toFixed(2)}€
                                                    <Chip
                                                      label={note.status}
                                                      size="small"
                                                      color={note.status === 'Validée' ? 'success' : note.status === 'En attente' ? 'warning' : 'error'}
                                                      sx={{
                                                        height: '20px',
                                                        '& .MuiChip-label': {
                                                          px: 1,
                                                          fontSize: '0.75rem'
                                                        }
                                                      }}
                                                    />
                                                  </Box>
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                            <TableRow>
                                              <TableCell colSpan={2} sx={{ fontWeight: 600 }}>
                                                Total notes de frais validées
                                              </TableCell>
                                              <TableCell sx={{ fontWeight: 600 }}>
                                                {calculateValidatedExpenseTotal(contract.expenseNotes).toFixed(2)}€
                                              </TableCell>
                                            </TableRow>
                                          </TableBody>
                                        </Table>
                                      </>
                                    )}
                                  </>
                                )}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}

                        </TableBody>
                      </Table>
                    </TableContainer>
                    {contractsTabPageCount > 1 && (
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'center',
                          py: 1.5,
                          borderTop: `1px solid ${tokens.colors.divider}`,
                          bgcolor: tokens.colors.surfaceAlt,
                        }}
                      >
                        <Pagination
                          count={contractsTabPageCount}
                          page={contractsPage}
                          onChange={(_, p) => {
                            setContractsPage(p);
                            setOpenRows({});
                          }}
                          color="primary"
                          shape="rounded"
                          size="small"
                          sx={{
                            '& .MuiPaginationItem-root': {
                              borderRadius: tokens.radius.sm,
                              fontWeight: 600,
                            },
                            '& .Mui-selected': {
                              bgcolor: `${tokens.colors.brandTeal} !important`,
                              color: '#fff',
                            },
                          }}
                        />
                      </Box>
                    )}
                  </>
                )}
              </Box>
            </>
          )}
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          {studentContracts.length === 0 ? (
            <EmptyState
              icon={<PaymentIcon />}
              title="Aucun paiement à effectuer"
              description="Les paiements apparaîtront ici lorsqu'ils seront créés, ou ajustez vos filtres."
            />
          ) : (
            <Box sx={{ ...filterBarSx }}>
              <SegmentedControl
                value={paymentFilter}
                onChange={(v) => setPaymentFilter(v as PaymentFilter)}
                options={[
                  { value: 'all', label: 'Tous' },
                  { value: 'pending', label: 'À effectuer' },
                  { value: 'processed', label: 'Effectués' },
                ]}
              />
                  <FormControl size="small" sx={{ minWidth: 150, ...filterFieldSx }}>
                    <InputLabel>Mandat</InputLabel>
                    <Select
                      value={mandatFilter}
                      label="Mandat"
                      onChange={(e) => setMandatFilter(e.target.value)}
                    >
                      <MenuItem value="all">Tous les mandats</MenuItem>
                      {AVAILABLE_MANDATS.map((mandat) => (
                        <MenuItem key={mandat} value={mandat}>
                          {mandat}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {Object.values(filters).some((filter) => filter !== '') && (
                    <Button
                      startIcon={<ClearIcon />}
                      onClick={handleResetFilters}
                      size="small"
                      variant="outlined"
                      sx={{
                        color: tokens.colors.error,
                        borderColor: tokens.colors.error,
                        borderRadius: tokens.radius.md,
                        textTransform: 'none',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 59, 48, 0.08)',
                          borderColor: tokens.colors.error,
                        },
                      }}
                    >
                      Réinitialiser
                    </Button>
                  )}
            </Box>
          )}
          <Box sx={panelSx}>
            <Box sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${tokens.colors.divider}` }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.colors.gray900 }}>
                Paiements à effectuer
              </Typography>
            </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={thSx} />
                  <TableCell sx={thSx}>Numéro de mission</TableCell>
                  <TableCell sx={thSx}>Étudiant</TableCell>
                  <TableCell sx={thSx}>Date de fin</TableCell>
                  <TableCell sx={thSx}>Heures assignées</TableCell>
                  <TableCell sx={thSx}>Rémunération horaire</TableCell>
                  <TableCell sx={thSx}>Notes de frais</TableCell>
                  <TableCell sx={thSx}>Total à payer</TableCell>
                  <TableCell sx={thSx}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {studentContracts
                  .filter(contract => {
                    // Filtre par statut de paiement
                    if (paymentFilter === 'pending' && contract.isPaymentProcessed) return false;
                    if (paymentFilter === 'processed' && !contract.isPaymentProcessed) return false;
                    
                    // Filtre par mandat
                    if (mandatFilter !== 'all') {
                      const contractMandat = contract.cdmMandat || contract.mission.mandat;
                      if (contractMandat !== mandatFilter) return false;
                    }
                    
                    return true;
                  })
                  .map((contract) => (
                    <Row 
                      key={`${contract.mission.id}-${contract.application.id}`} 
                      contract={contract}
                      currentTab={tabValue}
                      onProcessPayment={handleProcessPayment}
                      handleToggleContractGeneration={handleToggleContractGeneration}
                      onTogglePaymentStatus={handleTogglePaymentStatus}
                    />
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          </Box>
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          {contracts.length === 0 ? (
            <EmptyState
              icon={<ReceiptIcon />}
              title="Aucune facture à envoyer"
              description="Les factures apparaîtront ici lorsqu'elles seront créées, ou ajustez vos filtres."
            />
          ) : (
            <>
              <Box sx={{ ...filterBarSx, justifyContent: 'flex-end' }}>
                  <FormControl size="small" sx={{ minWidth: 150, ...filterFieldSx }}>
                    <InputLabel>Mandat</InputLabel>
                    <Select
                      value={mandatFilter}
                      label="Mandat"
                      onChange={(e) => setMandatFilter(e.target.value)}
                    >
                      <MenuItem value="all">Tous les mandats</MenuItem>
                      {AVAILABLE_MANDATS.map((mandat) => (
                        <MenuItem key={mandat} value={mandat}>
                          {mandat}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
            </Box>
              <Box sx={panelSx}>
                <Box sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${tokens.colors.divider}` }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.colors.gray900 }}>
                    Factures à envoyer
                  </Typography>
                </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={thSx}>Numéro de mission</TableCell>
                      <TableCell sx={thSx}>Date de fin</TableCell>
                      <TableCell sx={thSx}>Prix HT</TableCell>
                      <TableCell sx={thSx}>Total HT</TableCell>
                      <TableCell sx={thSx}>TVA (20%)</TableCell>
                      <TableCell sx={thSx}>Notes de frais</TableCell>
                      <TableCell sx={thSx}>Prix final TTC</TableCell>
                      <TableCell sx={thSx}>Facture</TableCell>
                      <TableCell sx={thSx}>Date d'envoi</TableCell>
                      <TableCell sx={thSx}>Date d'échéance</TableCell>
                      <TableCell sx={thSx}>Statut</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {contracts
                      .filter(contract => {
                        // Filtre par mandat
                        if (mandatFilter !== 'all') {
                          const contractMandat = contract.cdmMandat || contract.mission.mandat;
                          if (contractMandat !== mandatFilter) return false;
                        }
                        return true;
                      })
                      .map((contract) => {
                    const priceHT = contract.mission.priceHT ?? parseFloat(contract.mission.salary || '0');
                    const totalHT = contract.mission.totalHT ?? (priceHT * contract.totalHoursAssigned);
                    const tvaMontant = totalHT * 0.2;
                    const validatedExpenses = calculateValidatedExpenseTotal(contract.expenseNotes);
                    const totalTTC = contract.mission.totalTTC ?? (totalHT * 1.2);
                    const finalPrice = totalTTC + validatedExpenses;
                    const invoiceStatus = contract.mission.invoiceStatus || 'to_send';
                    const statusMap = {
                      to_send: { label: 'À envoyer', color: 'warning' },
                      sent: { label: 'Envoyé', color: 'info' },
                      paid: { label: 'Payé', color: 'success' }
                    };
                    
                    // Vérifier si la facture est en retard
                    const isOverdue = contract.invoiceDocument?.invoiceDueDate && 
                                     new Date(contract.invoiceDocument.invoiceDueDate) < new Date() &&
                                     invoiceStatus !== 'paid';
                    
                    const handleInvoiceStatusClick = async () => {
                      let nextStatus: 'to_send' | 'sent' | 'paid';
                      if (invoiceStatus === 'to_send') nextStatus = 'sent';
                      else if (invoiceStatus === 'sent') nextStatus = 'paid';
                      else nextStatus = 'to_send';
                      
                      const missionRef = doc(db, 'missions', contract.mission.id);
                      const updateData: any = { invoiceStatus: nextStatus };
                      
                      // Mettre à jour l'étape de la mission selon le statut de la facture
                      if (nextStatus === 'sent') {
                        updateData.etape = 'Facturation';
                      } else if (nextStatus === 'paid') {
                        updateData.etape = 'Audit';
                      }
                      
                      await updateDoc(missionRef, updateData);
                      setContracts(prev => prev.map(c =>
                        c.mission.id === contract.mission.id
                          ? { 
                              ...c, 
                              mission: { 
                                ...c.mission, 
                                invoiceStatus: nextStatus,
                                ...(nextStatus === 'sent' && { etape: 'Facturation' as const }),
                                ...(nextStatus === 'paid' && { etape: 'Audit' as const })
                              } 
                            }
                          : c
                      ));
                      
                      if (nextStatus === 'sent') {
                        enqueueSnackbar('Facture envoyée - Mission passée à l\'étape Facturation', { variant: 'success' });
                      } else if (nextStatus === 'paid') {
                        enqueueSnackbar('Facture payée - Mission passée à l\'étape Audit', { variant: 'success' });
                      }
                    };
                    
                    return (
                      <TableRow 
                        key={contract.mission.id}
                        sx={{
                          backgroundColor: isOverdue ? 'rgba(255, 59, 48, 0.03)' : 'inherit',
                          '&:hover': {
                            backgroundColor: isOverdue ? 'rgba(255, 59, 48, 0.06)' : undefined
                          }
                        }}
                      >
                        <TableCell>{contract.mission.numeroMission}</TableCell>
                        <TableCell>{formatDate(contract.mission.endDate)}</TableCell>
                        <TableCell>{priceHT.toFixed(2)}€</TableCell>
                        <TableCell>{totalHT.toFixed(2)}€</TableCell>
                        <TableCell>{tvaMontant.toFixed(2)}€</TableCell>
                        <TableCell>{validatedExpenses.toFixed(2)}€</TableCell>
                        <TableCell>
                          {(() => {
                            const amount = contract.invoiceDocument?.invoiceAmount ?? finalPrice;
                            if (!amount || amount <= 0) {
                              return (
                                <Typography sx={{ fontSize: 13, color: tokens.colors.gray400 }}>
                                  —
                                </Typography>
                              );
                            }
                            const confirmed = !!contract.invoiceDocument?.invoiceAmount;
                            return (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Typography sx={{ fontWeight: 600, color: tokens.colors.success, fontSize: '0.95rem' }}>
                                  {amount.toFixed(2)}€
                                </Typography>
                                {confirmed ? (
                                  <Chip
                                    label="Confirmé"
                                    size="small"
                                    sx={{
                                      height: 18,
                                      fontSize: '0.65rem',
                                      backgroundColor: tokens.colors.success,
                                      color: 'white',
                                      fontWeight: 600,
                                      width: 'fit-content',
                                    }}
                                  />
                                ) : (
                                  <Typography sx={{ fontSize: '0.7rem', color: tokens.colors.textSecondary, fontStyle: 'italic' }}>
                                    Calculé
                                  </Typography>
                                )}
                              </Box>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {contract.invoiceDocument ? (
                            <Tooltip title="Voir la facture">
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => window.open(contract.invoiceDocument!.fileUrl, '_blank')}
                                sx={{
                                  textTransform: 'none',
                                  borderRadius: tokens.radius.sm,
                                  fontSize: '0.75rem',
                                  borderColor: tokens.colors.success,
                                  color: tokens.colors.success,
                                  '&:hover': {
                                    borderColor: tokens.colors.success,
                                    backgroundColor: 'rgba(52, 199, 89, 0.08)'
                                  }
                                }}
                              >
                                {contract.invoiceDocument.fileName.length > 20 
                                  ? contract.invoiceDocument.fileName.substring(0, 20) + '...' 
                                  : contract.invoiceDocument.fileName}
                              </Button>
                            </Tooltip>
                          ) : (
                            <Typography variant="body2" sx={{ color: tokens.colors.textSecondary, fontStyle: 'italic' }}>
                              Aucune facture
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {contract.invoiceDocument?.invoiceSentDate ? (
                            <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                              {new Date(contract.invoiceDocument.invoiceSentDate).toLocaleDateString('fr-FR')}
                            </Typography>
                          ) : (
                            <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {contract.invoiceDocument?.invoiceDueDate ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  fontSize: '0.875rem',
                                  color: isOverdue ? tokens.colors.error : tokens.colors.textPrimary,
                                  fontWeight: isOverdue ? 600 : 400
                                }}
                              >
                                {new Date(contract.invoiceDocument.invoiceDueDate).toLocaleDateString('fr-FR')}
                              </Typography>
                              {isOverdue && (
                                <Chip
                                  label="En retard"
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.65rem',
                                    backgroundColor: tokens.colors.error,
                                    color: 'white',
                                    fontWeight: 600
                                  }}
                                />
                              )}
                            </Box>
                          ) : (
                            <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={statusMap[invoiceStatus].label}
                            color={statusMap[invoiceStatus].color as any}
                            onClick={handleInvoiceStatusClick}
                            sx={{ 
                              cursor: 'pointer', 
                              fontWeight: 500, 
                              borderRadius: tokens.radius.sm,
                              '&:hover': {
                                opacity: 0.8
                              }
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
              </Box>
          </>
        )}
      </TabPanel>
      <TabPanel value={tabValue} index={3}>
        <Box sx={{ ...filterBarSx }}>
              <SegmentedControl
                value={invoiceTrackingFilter}
                onChange={(v) => setInvoiceTrackingFilter(v as InvoiceTrackingFilter)}
                options={[
                  { value: 'all', label: 'Toutes' },
                  { value: 'unpaid', label: 'À payer' },
                  { value: 'paid', label: 'Payées' },
                  { value: 'overdue', label: 'En retard' },
                  { value: 'upcoming', label: 'Échéance proche' },
                ]}
              />
                  <FormControl size="small" sx={{ minWidth: 150, ...filterFieldSx }}>
                    <InputLabel>Mandat</InputLabel>
                    <Select
                      value={mandatFilter}
                      label="Mandat"
                      onChange={(e) => setMandatFilter(e.target.value)}
                    >
                      <MenuItem value="all">Tous les mandats</MenuItem>
                      {AVAILABLE_MANDATS.map((mandat) => (
                        <MenuItem key={mandat} value={mandat}>
                          {mandat}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
            </Box>

        {/* Statistiques des factures avec barre de progression */}
        <Box sx={{ ...panelSx, p: 2.5, mb: 2.5 }}>
          {(() => {
            const allInvoices = contracts.filter(c => c.invoiceDocument && c.invoiceDocument.fileName);
            const totalInvoices = allInvoices.length;
            const paidInvoices = allInvoices.filter(c => c.mission.invoiceStatus === 'paid');
            const overdueInvoices = allInvoices.filter(c => {
              const isOverdue = c.invoiceDocument?.invoiceDueDate && 
                               new Date(c.invoiceDocument.invoiceDueDate) < new Date() &&
                               c.mission.invoiceStatus !== 'paid';
              return isOverdue;
            });
            const unpaidInvoices = allInvoices.filter(c => c.mission.invoiceStatus !== 'paid' && !overdueInvoices.find(inv => inv.mission.id === c.mission.id));

            // Calculer les totaux
            const totalAmount = allInvoices.reduce((sum, c) => sum + (c.invoiceDocument?.invoiceAmount || 0), 0);
            const paidAmount = paidInvoices.reduce((sum, c) => sum + (c.invoiceDocument?.invoiceAmount || 0), 0);
            const overdueAmount = overdueInvoices.reduce((sum, c) => sum + (c.invoiceDocument?.invoiceAmount || 0), 0);
            const unpaidAmount = unpaidInvoices.reduce((sum, c) => sum + (c.invoiceDocument?.invoiceAmount || 0), 0);

            // Calculer les pourcentages pour la barre
            const paidPercentage = totalInvoices > 0 ? (paidInvoices.length / totalInvoices) * 100 : 0;
            const unpaidPercentage = totalInvoices > 0 ? (unpaidInvoices.length / totalInvoices) * 100 : 0;
            const overduePercentage = totalInvoices > 0 ? (overdueInvoices.length / totalInvoices) * 100 : 0;

            return (
              <>
                {/* En-tête avec totaux */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: tokens.colors.textPrimary, mb: 1 }}>
                    {totalAmount.toFixed(2)}€
                  </Typography>
                  <Typography variant="body2" sx={{ color: tokens.colors.textSecondary }}>
                    pour {totalInvoices} {totalInvoices > 1 ? 'factures' : 'facture'}
                  </Typography>
                </Box>

                {/* Barre de progression */}
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    height: 8, 
                    borderRadius: '4px',
                    overflow: 'hidden',
                    backgroundColor: tokens.colors.bgSubtle
                  }}>
                    {paidPercentage > 0 && (
                      <Box sx={{ 
                        width: `${paidPercentage}%`, 
                        backgroundColor: tokens.colors.success,
                        transition: 'width 0.3s ease'
                      }} />
                    )}
                    {unpaidPercentage > 0 && (
                      <Box sx={{ 
                        width: `${unpaidPercentage}%`, 
                        backgroundColor: tokens.colors.warning,
                        transition: 'width 0.3s ease'
                      }} />
                    )}
                    {overduePercentage > 0 && (
                      <Box sx={{ 
                        width: `${overduePercentage}%`, 
                        backgroundColor: tokens.colors.error,
                        transition: 'width 0.3s ease'
                      }} />
                    )}
                  </Box>
                </Box>

                {/* Légende */}
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '3px', backgroundColor: tokens.colors.success }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
                        {paidInvoices.length} Payée{paidInvoices.length > 1 ? 's' : ''}
                      </Typography>
                      <Typography variant="caption" sx={{ color: tokens.colors.textSecondary }}>
                        {paidAmount.toFixed(2)}€
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '3px', backgroundColor: tokens.colors.warning }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
                        {unpaidInvoices.length} À payer
                      </Typography>
                      <Typography variant="caption" sx={{ color: tokens.colors.textSecondary }}>
                        {unpaidAmount.toFixed(2)}€
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '3px', backgroundColor: tokens.colors.error }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.colors.textPrimary }}>
                        {overdueInvoices.length} En retard
                      </Typography>
                      <Typography variant="caption" sx={{ color: tokens.colors.textSecondary }}>
                        {overdueAmount.toFixed(2)}€
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </>
            );
          })()}
        </Box>

        {selectedInvoices.size > 0 && (
          <Box
            sx={{
              ...panelSx,
              p: 1.5,
              mb: 2.5,
              bgcolor: `${tokens.colors.brandTeal}14`,
              borderColor: `${tokens.colors.brandTeal}44`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Typography variant="body2" sx={{ color: tokens.colors.info, fontWeight: 600 }}>
              {selectedInvoices.size} facture{selectedInvoices.size > 1 ? 's' : ''} sélectionnée{selectedInvoices.size > 1 ? 's' : ''}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={() => setSelectedInvoices(new Set())}
                sx={{
                  color: tokens.colors.info,
                  borderColor: tokens.colors.info,
                  borderRadius: tokens.radius.sm,
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 122, 255, 0.08)',
                    borderColor: tokens.colors.info
                  }
                }}
              >
                Désélectionner tout
              </Button>
            </Box>
          </Box>
        )}

        <Box sx={panelSx}>
          <Box sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${tokens.colors.divider}` }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.colors.gray900 }}>
              Suivi des factures
            </Typography>
          </Box>
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table
            sx={{
              '& .MuiTableCell-root': {
                borderBottom: `1px solid ${tokens.colors.divider}`,
                px: 1,
                py: 1,
                fontSize: '0.8125rem',
              },
              '& .MuiTableCell-head': {
                ...thSx,
                fontSize: '0.6875rem',
              },
              width: '100%',
              tableLayout: 'fixed',
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ width: '3%', minWidth: 40 }}>
                  <Checkbox
                    size="small"
                    indeterminate={selectedInvoices.size > 0 && selectedInvoices.size < contracts.filter(c => c.invoiceDocument && c.invoiceDocument.fileName).length}
                    checked={contracts.filter(c => c.invoiceDocument && c.invoiceDocument.fileName).length > 0 && selectedInvoices.size === contracts.filter(c => c.invoiceDocument && c.invoiceDocument.fileName).length}
                    onChange={() => handleSelectAllInvoices(contracts.filter(c => c.invoiceDocument && c.invoiceDocument.fileName))}
                    sx={{
                      color: tokens.colors.info,
                      '&.Mui-checked': {
                        color: tokens.colors.info,
                      },
                      '&.MuiCheckbox-indeterminate': {
                        color: tokens.colors.info,
                      }
                    }}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: tokens.colors.textPrimary, fontSize: '0.7rem', whiteSpace: 'nowrap', width: '8%' }}>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 0.5, 
                      cursor: 'pointer',
                      userSelect: 'none',
                      '&:hover .sort-icon': {
                        opacity: invoiceTrackingSort.column === 'numeroMission' ? 1 : 0.5
                      }
                    }}
                    onClick={() => handleInvoiceTrackingSort('numeroMission')}
                  >
                    Ref.
                    <Box sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      opacity: invoiceTrackingSort.column === 'numeroMission' ? 1 : 0,
                      transition: 'opacity 0.2s',
                      color: tokens.colors.info
                    }} className="sort-icon">
                      {invoiceTrackingSort.column === 'numeroMission' && (
                        invoiceTrackingSort.direction === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : 
                        invoiceTrackingSort.direction === 'desc' ? <ArrowDownwardIcon fontSize="small" /> :
                        <ImportExportIcon fontSize="small" />
                      )}
                      {invoiceTrackingSort.column !== 'numeroMission' && <ImportExportIcon fontSize="small" />}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell sx={{ 
                  fontWeight: 600, 
                  color: tokens.colors.textPrimary, 
                  fontSize: '0.7rem', 
                  whiteSpace: 'nowrap', 
                  width: '12%',
                  display: { xs: 'none', md: 'table-cell' }
                }}>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 0.5, 
                      cursor: 'pointer',
                      userSelect: 'none',
                      '&:hover .sort-icon': {
                        opacity: invoiceTrackingSort.column === 'company' ? 1 : 0.5
                      }
                    }}
                    onClick={() => handleInvoiceTrackingSort('company')}
                  >
                    Entreprise
                    <Box sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      opacity: invoiceTrackingSort.column === 'company' ? 1 : 0,
                      transition: 'opacity 0.2s',
                      color: tokens.colors.info
                    }} className="sort-icon">
                      {invoiceTrackingSort.column === 'company' && (
                        invoiceTrackingSort.direction === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : 
                        invoiceTrackingSort.direction === 'desc' ? <ArrowDownwardIcon fontSize="small" /> :
                        <ImportExportIcon fontSize="small" />
                      )}
                      {invoiceTrackingSort.column !== 'company' && <ImportExportIcon fontSize="small" />}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: tokens.colors.textPrimary, fontSize: '0.7rem', whiteSpace: 'nowrap', width: '6%' }}>
                  Doc.
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: tokens.colors.textPrimary, fontSize: '0.7rem', whiteSpace: 'nowrap', width: '9%' }}>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 0.5, 
                      cursor: 'pointer',
                      userSelect: 'none',
                      '&:hover .sort-icon': {
                        opacity: invoiceTrackingSort.column === 'amount' ? 1 : 0.5
                      }
                    }}
                    onClick={() => handleInvoiceTrackingSort('amount')}
                  >
                    Montant
                    <Box sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      opacity: invoiceTrackingSort.column === 'amount' ? 1 : 0,
                      transition: 'opacity 0.2s',
                      color: tokens.colors.info
                    }} className="sort-icon">
                      {invoiceTrackingSort.column === 'amount' && (
                        invoiceTrackingSort.direction === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : 
                        invoiceTrackingSort.direction === 'desc' ? <ArrowDownwardIcon fontSize="small" /> :
                        <ImportExportIcon fontSize="small" />
                      )}
                      {invoiceTrackingSort.column !== 'amount' && <ImportExportIcon fontSize="small" />}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: tokens.colors.textPrimary, fontSize: '0.7rem', whiteSpace: 'nowrap', width: '9%' }}>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 0.5, 
                      cursor: 'pointer',
                      userSelect: 'none',
                      '&:hover .sort-icon': {
                        opacity: invoiceTrackingSort.column === 'sentDate' ? 1 : 0.5
                      }
                    }}
                    onClick={() => handleInvoiceTrackingSort('sentDate')}
                  >
                    Envoi
                    <Box sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      opacity: invoiceTrackingSort.column === 'sentDate' ? 1 : 0,
                      transition: 'opacity 0.2s',
                      color: tokens.colors.info
                    }} className="sort-icon">
                      {invoiceTrackingSort.column === 'sentDate' && (
                        invoiceTrackingSort.direction === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : 
                        invoiceTrackingSort.direction === 'desc' ? <ArrowDownwardIcon fontSize="small" /> :
                        <ImportExportIcon fontSize="small" />
                      )}
                      {invoiceTrackingSort.column !== 'sentDate' && <ImportExportIcon fontSize="small" />}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: tokens.colors.textPrimary, fontSize: '0.7rem', whiteSpace: 'nowrap', width: '9%' }}>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 0.5, 
                      cursor: 'pointer',
                      userSelect: 'none',
                      '&:hover .sort-icon': {
                        opacity: invoiceTrackingSort.column === 'dueDate' ? 1 : 0.5
                      }
                    }}
                    onClick={() => handleInvoiceTrackingSort('dueDate')}
                  >
                    Échéance
                    <Box sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      opacity: invoiceTrackingSort.column === 'dueDate' ? 1 : 0,
                      transition: 'opacity 0.2s',
                      color: tokens.colors.info
                    }} className="sort-icon">
                      {invoiceTrackingSort.column === 'dueDate' && (
                        invoiceTrackingSort.direction === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : 
                        invoiceTrackingSort.direction === 'desc' ? <ArrowDownwardIcon fontSize="small" /> :
                        <ImportExportIcon fontSize="small" />
                      )}
                      {invoiceTrackingSort.column !== 'dueDate' && <ImportExportIcon fontSize="small" />}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell sx={{ 
                  fontWeight: 600, 
                  color: tokens.colors.textPrimary, 
                  fontSize: '0.7rem', 
                  whiteSpace: 'nowrap', 
                  width: '6%',
                  display: { xs: 'none', lg: 'table-cell' }
                }}>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 0.5, 
                      cursor: 'pointer',
                      userSelect: 'none',
                      '&:hover .sort-icon': {
                        opacity: invoiceTrackingSort.column === 'daysRemaining' ? 1 : 0.5
                      }
                    }}
                    onClick={() => handleInvoiceTrackingSort('daysRemaining')}
                  >
                    Délai
                    <Box sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      opacity: invoiceTrackingSort.column === 'daysRemaining' ? 1 : 0,
                      transition: 'opacity 0.2s',
                      color: tokens.colors.info
                    }} className="sort-icon">
                      {invoiceTrackingSort.column === 'daysRemaining' && (
                        invoiceTrackingSort.direction === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : 
                        invoiceTrackingSort.direction === 'desc' ? <ArrowDownwardIcon fontSize="small" /> :
                        <ImportExportIcon fontSize="small" />
                      )}
                      {invoiceTrackingSort.column !== 'daysRemaining' && <ImportExportIcon fontSize="small" />}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: tokens.colors.textPrimary, fontSize: '0.7rem', whiteSpace: 'nowrap', width: '9%' }}>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 0.5, 
                      cursor: 'pointer',
                      userSelect: 'none',
                      '&:hover .sort-icon': {
                        opacity: invoiceTrackingSort.column === 'status' ? 1 : 0.5
                      }
                    }}
                    onClick={() => handleInvoiceTrackingSort('status')}
                  >
                    Statut
                    <Box sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      opacity: invoiceTrackingSort.column === 'status' ? 1 : 0,
                      transition: 'opacity 0.2s',
                      color: tokens.colors.info
                    }} className="sort-icon">
                      {invoiceTrackingSort.column === 'status' && (
                        invoiceTrackingSort.direction === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : 
                        invoiceTrackingSort.direction === 'desc' ? <ArrowDownwardIcon fontSize="small" /> :
                        <ImportExportIcon fontSize="small" />
                      )}
                      {invoiceTrackingSort.column !== 'status' && <ImportExportIcon fontSize="small" />}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: tokens.colors.textPrimary, fontSize: '0.7rem', whiteSpace: 'nowrap', width: '9%' }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {getSortedInvoices(contracts
                .filter(contract => {
                  // Filtrer uniquement les missions avec factures uploadées
                  if (!contract.invoiceDocument || !contract.invoiceDocument.fileName) return false;

                  // Filtre par mandat
                  if (mandatFilter !== 'all') {
                    const contractMandat = contract.cdmMandat || contract.mission.mandat;
                    if (contractMandat !== mandatFilter) return false;
                  }

                  // Filtre par statut de suivi
                  const isPaid = contract.mission.invoiceStatus === 'paid';
                  const isOverdue = contract.invoiceDocument?.invoiceDueDate && 
                                   new Date(contract.invoiceDocument.invoiceDueDate) < new Date() &&
                                   !isPaid;
                  const isUpcoming = (() => {
                    if (!contract.invoiceDocument?.invoiceDueDate || isPaid) return false;
                    const dueDate = new Date(contract.invoiceDocument.invoiceDueDate);
                    const today = new Date();
                    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    return daysUntilDue >= 0 && daysUntilDue <= 7;
                  })();

                  if (invoiceTrackingFilter === 'paid') return isPaid;
                  if (invoiceTrackingFilter === 'unpaid') return !isPaid;
                  if (invoiceTrackingFilter === 'overdue') return isOverdue;
                  if (invoiceTrackingFilter === 'upcoming') return isUpcoming;
                  
                  return true;
                }))
                .map((contract) => {
                  const isPaid = contract.mission.invoiceStatus === 'paid';
                  const isOverdue = contract.invoiceDocument?.invoiceDueDate && 
                                   new Date(contract.invoiceDocument.invoiceDueDate) < new Date() &&
                                   !isPaid;
                  
                  const daysRemaining = (() => {
                    if (!contract.invoiceDocument?.invoiceDueDate || isPaid) return null;
                    const dueDate = new Date(contract.invoiceDocument.invoiceDueDate);
                    const today = new Date();
                    return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  })();

                  const handleTogglePayment = async () => {
                    const newStatus = isPaid ? 'sent' : 'paid';
                    const missionRef = doc(db, 'missions', contract.mission.id);
                    await updateDoc(missionRef, {
                      invoiceStatus: newStatus,
                      ...(newStatus === 'paid' && { etape: 'Audit' })
                    });
                    
                    setContracts(prev => prev.map(c =>
                      c.mission.id === contract.mission.id
                        ? { 
                            ...c, 
                            mission: { 
                              ...c.mission, 
                              invoiceStatus: newStatus,
                              ...(newStatus === 'paid' && { etape: 'Audit' as const })
                            } 
                          }
                        : c
                    ));
                    
                    enqueueSnackbar(
                      isPaid ? 'Facture marquée comme non payée' : 'Facture marquée comme payée',
                      { variant: 'success' }
                    );
                  };

                  return (
                    <TableRow 
                      key={contract.mission.id}
                      selected={selectedInvoices.has(contract.mission.id)}
                      sx={{
                        '&:hover': {
                          backgroundColor: tokens.colors.bgDefault
                        }
                      }}
                    >
                      {/* Checkbox */}
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedInvoices.has(contract.mission.id)}
                          onChange={() => handleSelectInvoice(contract.mission.id)}
                          sx={{
                            color: tokens.colors.info,
                            '&.Mui-checked': {
                              color: tokens.colors.info,
                            }
                          }}
                        />
                      </TableCell>

                      {/* Référence - Cliquable */}
                      <TableCell>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 600, 
                            fontSize: '0.7rem',
                            color: tokens.colors.info,
                            cursor: 'pointer',
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                            '&:hover': {
                              textDecoration: 'underline'
                            }
                          }}
                          onClick={() => {
                            // Navigate to mission or show details
                            window.location.href = `/missions/${contract.mission.id}`;
                          }}
                        >
                          {contract.mission.numeroMission}
                        </Typography>
                      </TableCell>

                      {/* Entreprise */}
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.7rem', color: tokens.colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {contract.mission.company || '-'}
                        </Typography>
                      </TableCell>

                      {/* Facture */}
                      <TableCell>
                        <Button
                          size="small"
                          startIcon={<ReceiptIcon sx={{ fontSize: 10 }} />}
                          onClick={() => window.open(contract.invoiceDocument!.fileUrl, '_blank')}
                          sx={{
                            textTransform: 'none',
                            fontSize: '0.625rem',
                            color: tokens.colors.info,
                            fontWeight: 500,
                            p: 0,
                            minWidth: 'auto',
                            '&:hover': {
                              backgroundColor: 'rgba(0, 122, 255, 0.08)'
                            }
                          }}
                        >
                          PDF
                        </Button>
                      </TableCell>

                      {/* Montant */}
                      <TableCell>
                        <Typography sx={{ fontWeight: 700, color: tokens.colors.textPrimary, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                          {contract.invoiceDocument?.invoiceAmount 
                            ? `${contract.invoiceDocument.invoiceAmount.toFixed(2)}€` 
                            : '-'}
                        </Typography>
                      </TableCell>

                      {/* Date d'envoi */}
                      <TableCell>
                        {contract.invoiceDocument?.invoiceSentDate ? (
                          <Typography variant="body2" sx={{ color: tokens.colors.textPrimary, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                            {new Date(contract.invoiceDocument.invoiceSentDate).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit'
                            })}
                          </Typography>
                        ) : (
                          <Typography variant="body2" sx={{ color: tokens.colors.textSecondary, fontSize: '0.7rem' }}>-</Typography>
                        )}
                      </TableCell>

                      {/* Échéance */}
                      <TableCell>
                        {contract.invoiceDocument?.invoiceDueDate ? (
                          <Typography 
                            variant="body2"
                            sx={{ 
                              color: isOverdue ? tokens.colors.error : tokens.colors.textPrimary,
                              fontWeight: isOverdue ? 600 : 400,
                              fontSize: '0.7rem',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {new Date(contract.invoiceDocument.invoiceDueDate).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit'
                            })}
                          </Typography>
                        ) : (
                          <Typography variant="body2" sx={{ color: tokens.colors.textSecondary, fontSize: '0.7rem' }}>-</Typography>
                        )}
                      </TableCell>

                      {/* Délai restant */}
                      <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                        {daysRemaining !== null ? (
                          <Typography 
                            variant="body2"
                            sx={{ 
                              color: daysRemaining < 0 ? tokens.colors.error : 
                                     daysRemaining <= 7 ? tokens.colors.warning : 
                                     tokens.colors.textPrimary,
                              fontWeight: 600,
                              fontSize: '0.7rem',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {daysRemaining < 0 
                              ? `${Math.abs(daysRemaining)}j` 
                              : daysRemaining === 0 
                              ? "Auj." 
                              : `${daysRemaining}j`}
                          </Typography>
                        ) : (
                          <Typography variant="body2" sx={{ color: tokens.colors.textSecondary, fontSize: '0.7rem' }}>-</Typography>
                        )}
                      </TableCell>

                      {/* Statut de paiement */}
                      <TableCell>
                        <Chip
                          label={isPaid ? 'Payée' : isOverdue ? 'Retard' : 'À payer'}
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: '0.563rem',
                            backgroundColor: isPaid ? 'rgba(52, 199, 89, 0.1)' : 
                                           isOverdue ? 'rgba(255, 59, 48, 0.1)' :
                                           'rgba(255, 149, 0, 0.1)',
                            color: isPaid ? tokens.colors.success : isOverdue ? tokens.colors.error : tokens.colors.warning,
                            border: `1px solid ${isPaid ? tokens.colors.success : isOverdue ? tokens.colors.error : tokens.colors.warning}`,
                            fontWeight: 600,
                            borderRadius: '3px',
                            '& .MuiChip-label': {
                              px: 0.5,
                              py: 0
                            }
                          }}
                        />
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <Button
                          size="small"
                          variant={isPaid ? 'outlined' : 'contained'}
                          onClick={handleTogglePayment}
                          sx={{
                            textTransform: 'none',
                            borderRadius: '3px',
                            fontSize: '0.563rem',
                            fontWeight: 600,
                            px: 0.75,
                            py: 0.125,
                            minWidth: 'auto',
                            ...(isPaid ? {
                              borderColor: tokens.colors.gray300,
                              color: tokens.colors.textPrimary,
                              '&:hover': {
                                borderColor: tokens.colors.error,
                                color: tokens.colors.error,
                                backgroundColor: 'rgba(255, 59, 48, 0.05)'
                              }
                            } : {
                              backgroundColor: tokens.colors.success,
                              color: 'white',
                              boxShadow: 'none',
                              '&:hover': {
                                backgroundColor: '#2fb350',
                                boxShadow: 'none'
                              }
                            })
                          }}
                        >
                          {isPaid ? 'Annuler' : 'Payée'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </TableContainer>
        </Box>

        {contracts.filter(c => c.invoiceDocument && c.invoiceDocument.fileName).length === 0 && (
          <EmptyState
            icon={<CheckCircleIcon />}
            title="Aucune facture à suivre"
            description="Les factures uploadées apparaîtront ici avec leur suivi."
          />
        )}
      </TabPanel>
        </Box>
      </Box>
    </AppPageShell>
  );
};

export default Tresorerie; 