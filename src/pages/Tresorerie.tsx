import React, { useState, useEffect, useRef } from 'react';
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
  IconButton,
  Collapse,
  CircularProgress,
  Chip,
  Tooltip,
  styled,
  Tabs,
  Tab,
  Button,
  Alert,
  Menu,
  TextField,
  keyframes
} from '@mui/material';
import {
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  AccessTime as AccessTimeIcon,
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
  ImportExport as ImportExportIcon
} from '@mui/icons-material';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from 'notistack';

// Animations
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

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
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const StyledTooltip = styled(Tooltip)(({ theme }) => ({
  '& .MuiTooltip-tooltip': {
    backgroundColor: '#FFFFFF',
    color: '#1d1d1f',
    maxWidth: 380,
    fontSize: '0.875rem',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
    padding: '24px',
    margin: '8px'
  },
  '& .MuiTooltip-arrow': {
    color: '#FFFFFF',
    '&::before': {
      border: '1px solid rgba(0, 0, 0, 0.05)',
      backgroundColor: '#FFFFFF'
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
      alignItems: 'center', 
      justifyContent: 'space-between',
      py: 1.5,
      backgroundColor: '#FFFFFF',
      '&:not(:last-child)': {
        borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
      },
      '&:hover': {
        '& .copy-button': {
          opacity: 1,
          transform: 'translateX(0)'
        }
      }
    }}>
      <Box sx={{ 
        flex: 1,
        backgroundColor: '#FFFFFF'
      }}>
        <Typography sx={{ 
          fontSize: '0.8125rem',
          color: '#86868b',
          mb: 0.5,
          letterSpacing: '-0.01em',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
        }}>
          {label}
        </Typography>
        <Typography sx={{ 
          fontSize: '0.9375rem',
          color: '#1d1d1f',
          fontWeight: 400,
          letterSpacing: '-0.01em',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
        }}>
          {value || 'Non renseigné'}
        </Typography>
      </Box>
      {value && (
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
              color: copied ? '#34C759' : '#007AFF',
              p: 1,
              backgroundColor: '#FFFFFF',
              '&:hover': {
                backgroundColor: copied ? 'rgba(52, 199, 89, 0.08)' : 'rgba(0, 122, 255, 0.08)'
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
    width: '100%'
  }}>
    <Typography sx={{ 
      fontSize: '1.125rem',
      fontWeight: 600,
      color: '#1d1d1f',
      mb: 3,
      letterSpacing: '-0.02em',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      backgroundColor: '#FFFFFF'
    }}>
      Informations de l'étudiant
    </Typography>
    
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#FFFFFF'
    }}>
      <InfoRow 
        label="Nom complet"
        value={`${userData.firstName} ${userData.lastName}`.trim()}
      />
      
      <InfoRow 
        label="N° Sécurité sociale"
        value={userData.socialSecurityNumber || ''}
      />
      
      <InfoRow 
        label="Lieu de naissance"
        value={userData.birthPlace ? `${userData.birthPlace} ${userData.birthPostalCode ? `(${userData.birthPostalCode})` : ''}` : ''}
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
            <Typography sx={{ 
              cursor: 'pointer',
              '&:hover': {
                color: '#007AFF'
              }
            }}>
              {contract.application.userDisplayName}
            </Typography>
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
                    borderRadius: '8px',
                    fontWeight: 500,
                    backgroundColor: 'rgba(52, 199, 89, 0.1)',
                    color: '#34C759',
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
                    borderRadius: '8px',
                    fontWeight: 500,
                    backgroundColor: 'rgba(255, 204, 0, 0.1)',
                    color: '#FF9500',
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
                  borderRadius: '8px',
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
                bgcolor: '#f8f9fa', 
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 2
              }}>
                <Typography variant="h6" sx={{ color: '#1d1d1f' }}>
                  {currentTab === 0 ? "Total heures :" : "Total à payer :"}
                </Typography>
                <Typography variant="h6" sx={{ color: '#34C759', fontWeight: 600 }}>
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

const Tresorerie: React.FC = () => {
  const { currentUser, userData } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [processingContract, setProcessingContract] = useState<string | null>(null);
  const { enqueueSnackbar } = useSnackbar();
  const [contractFilter, setContractFilter] = useState<ContractFilter>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
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
        where('applicationId', '==', contract.application.id)
      );
      
      const existingContractSnapshot = await getDocs(contractQuery);

      if (!existingContractSnapshot.empty) {
        const contractDocRef = doc(db, 'contracts', existingContractSnapshot.docs[0].id);
        await updateDoc(contractDocRef, {
          isPaymentProcessed: !currentStatus,
          paymentProcessedAt: !currentStatus ? new Date() : null,
          paymentProcessedBy: !currentStatus ? userData?.displayName || 'Utilisateur inconnu' : null,
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
              paymentProcessedBy: !currentStatus ? userData?.displayName || 'Utilisateur inconnu' : null
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
          createdByName: userData?.displayName || 'Utilisateur inconnu',
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
              createdByName: userData?.displayName || 'Utilisateur inconnu'
            }
          : c
      ));

      enqueueSnackbar(`Contrat ${!currentStatus ? 'marqué comme généré' : 'marqué comme non généré'}`, { variant: 'success' });
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
      enqueueSnackbar('Erreur lors du changement de statut', { variant: 'error' });
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
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
          createdByName: userData?.displayName || 'Utilisateur inconnu',
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
              createdByName: userData?.displayName || 'Utilisateur inconnu'
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
            color: '#007AFF'
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
            color: filters[column] ? '#007AFF' : '#86868b',
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
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
              borderRadius: '12px'
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
                  borderRadius: '8px'
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
        paymentProcessedBy: userData?.displayName || 'Utilisateur inconnu'
      });
      
      // Mettre à jour l'état local
      setContracts(prev => prev.map(contract => 
        contract.mission.id === missionId 
          ? {
              ...contract,
              isPaymentProcessed: true,
              paymentProcessedAt: new Date(),
              paymentProcessedBy: userData?.displayName || 'Utilisateur inconnu'
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

  useEffect(() => {
    const fetchContracts = async () => {
      if (!currentUser) return;

      try {
        setLoading(true);
        setError(null);
        console.log("Début de la récupération des contrats");
        console.log("UID de l'utilisateur:", currentUser.uid);

        // Récupérer d'abord les données de l'utilisateur
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) {
          console.error("Document utilisateur non trouvé");
          setLoading(false);
          return;
        }

        const userData = userDoc.data();
        console.log("Données utilisateur récupérées:", userData);

        const userStructureId = userData?.structureId;
        console.log("StructureId de l'utilisateur:", userStructureId);

        // 1. Récupérer toutes les missions de la structure
        const missionsRef = collection(db, 'missions');
        const missionsQuery = query(
          missionsRef,
          where('structureId', '==', userStructureId)
        );
        const missionsSnapshot = await getDocs(missionsQuery);
        
        console.log("Nombre total de missions trouvées:", missionsSnapshot.docs.length);
        
        if (missionsSnapshot.empty) {
          setContracts([]);
          return;
        }

        const missions = missionsSnapshot.docs.map(doc => {
          const data = doc.data();
          console.log("Mission trouvée:", {
            id: doc.id,
            structureId: data.structureId,
            userStructureId,
            match: data.structureId === userStructureId
          });
          return {
            id: doc.id,
            ...data
          };
        }) as Mission[];

        const contractsData: Contract[] = [];

        // 2. Pour chaque mission, récupérer les applications et les contrats associés
        for (const mission of missions) {
          const applicationsRef = collection(db, 'applications');
          const applicationsQuery = query(
            applicationsRef,
            where('missionId', '==', mission.id),
            where('status', '==', 'Acceptée')
          );

          const applicationsSnapshot = await getDocs(applicationsQuery);
          
          for (const appDoc of applicationsSnapshot.docs) {
            const applicationData = appDoc.data();
            
            // 3. Vérifier si un contrat existe pour cette application
            const contractsRef = collection(db, 'contracts');
            const contractQuery = query(
              contractsRef,
              where('missionId', '==', mission.id),
              where('applicationId', '==', appDoc.id)
            );
            const contractSnapshot = await getDocs(contractQuery);
            
            // Récupérer le statut du contrat s'il existe
            const statusData = contractSnapshot.empty ? {} : contractSnapshot.docs[0].data().status || {};
            const contractStatus = {
              isContractGenerated: !!statusData.isContractGenerated,
              contractGeneratedAt: statusData.contractGeneratedAt?.toDate?.() || null
            };

            // Récupérer les informations de l'utilisateur
            const userDoc = await getDoc(doc(db, 'users', applicationData.userId));
            const userDataFromDB = userDoc.data();
            
            const extendedUserData: ExtendedUserData = {
              firstName: userDataFromDB?.firstName || '',
              lastName: userDataFromDB?.lastName || '',
              socialSecurityNumber: userDataFromDB?.socialSecurityNumber || '',
              birthPlace: userDataFromDB?.birthPlace || '',
              birthPostalCode: userDataFromDB?.birthPostalCode || '',
              nationality: userDataFromDB?.nationality || '',
              address: userDataFromDB?.address || '',
              email: userDataFromDB?.email || '',
              displayName: userDataFromDB?.displayName || 'Utilisateur inconnu'
            };

            // Récupérer les heures de travail
            const workingHoursRef = collection(db, 'workingHours');
            const workingHoursQuery = query(
              workingHoursRef,
              where('applicationId', '==', appDoc.id)
            );
            const workingHoursSnapshot = await getDocs(workingHoursQuery);

            console.log('[DEBUG] workingHours docs récupérés pour application', appDoc.id, ':', workingHoursSnapshot.docs.length);

            const workingHours = workingHoursSnapshot.docs.flatMap((whDoc, idx) => {
              const data = whDoc.data();
              console.log(`[DEBUG] Données workingHour #${idx} pour application ${appDoc.id}:`, data);
              if (Array.isArray(data.hours)) {
                return data.hours.map((h, hIdx) => {
                  console.log(`[DEBUG] Ligne extraite du tableau hours, index ${hIdx}:`, h);
                  return {
                    startDate: h.date,
                    startTime: h.startTime,
                    endDate: h.date,
                    endTime: h.endTime,
                    breaks: h.breaks || []
                  };
                });
              } else {
                return [];
              }
            });

            const application: Application = {
              id: appDoc.id,
              userId: applicationData.userId,
              missionId: applicationData.missionId,
              status: applicationData.status,
              userDisplayName: extendedUserData.displayName,
              userEmail: extendedUserData.email,
              userData: extendedUserData,
              workingHours: workingHours
            };

            const totalHoursAssigned = workingHours.reduce((total, wh, idx) => {
              if (!wh.startTime || !wh.endTime) {
                console.warn(`[DEBUG] Ligne workingHour ignorée (startTime ou endTime manquant) pour application ${appDoc.id}, index ${idx}:`, wh);
                return total;
              }
              const start = new Date(`1970-01-01T${wh.startTime}`);
              const end = new Date(`1970-01-01T${wh.endTime}`);
              if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                console.warn(`[DEBUG] Ligne workingHour ignorée (date invalide) pour application ${appDoc.id}, index ${idx}:`, wh);
                return total;
              }
              let hours = (end.getTime() - start.getTime()) / 1000 / 3600;

              wh.breaks?.forEach((breakTime, bidx) => {
                if (!breakTime.start || !breakTime.end) {
                  console.warn(`[DEBUG] Pause ignorée (start ou end manquant) pour application ${appDoc.id}, index ${idx}, break ${bidx}:`, breakTime);
                  return;
                }
                const breakStart = new Date(`1970-01-01T${breakTime.start}`);
                const breakEnd = new Date(`1970-01-01T${breakTime.end}`);
                if (isNaN(breakStart.getTime()) || isNaN(breakEnd.getTime())) {
                  console.warn(`[DEBUG] Pause ignorée (date invalide) pour application ${appDoc.id}, index ${idx}, break ${bidx}:`, breakTime);
                  return;
                }
                const breakHours = (breakEnd.getTime() - breakStart.getTime()) / 1000 / 3600;
                hours -= breakHours;
              });

              console.log(`[DEBUG] Heures calculées pour application ${appDoc.id}, index ${idx}:`, hours, 'données:', wh);
              return total + hours;
            }, 0);

            // Récupérer les notes de frais
            const expenseNotesRef = collection(db, 'expenseNotes');
            const expenseNotesQuery = query(
              expenseNotesRef,
              where('missionId', '==', mission.id),
              where('userId', '==', applicationData.userId)
            );
            const expenseNotesSnapshot = await getDocs(expenseNotesQuery);

            const expenseNotes = expenseNotesSnapshot.docs.map(noteDoc => {
              const data = noteDoc.data();
              return {
                id: noteDoc.id,
                ...data,
                date: data.date?.toDate() || new Date()
              };
            }) as ExpenseNote[];

            contractsData.push({
              mission,
              application,
              totalHoursAssigned,
              status: contractStatus,
              createdByName: userData?.displayName || 'Utilisateur inconnu',
              expenseNotes,
              isPaymentProcessed: contractSnapshot.empty ? false : contractSnapshot.docs[0].data().isPaymentProcessed || false,
              paymentProcessedAt: contractSnapshot.empty ? null : contractSnapshot.docs[0].data().paymentProcessedAt || null,
              paymentProcessedBy: contractSnapshot.empty ? null : contractSnapshot.docs[0].data().paymentProcessedBy || null
            });
          }
        }

        contractsData.sort((a, b) => {
          const paymentDateA = calculatePaymentDate(a.mission.endDate);
          const paymentDateB = calculatePaymentDate(b.mission.endDate);
          return paymentDateA.getTime() - paymentDateB.getTime();
        });

        setContracts(contractsData);
      } catch (err) {
        console.error('Erreur lors de la récupération des contrats:', err);
        setError('Erreur lors de la récupération des contrats');
      } finally {
        setLoading(false);
      }
    };

    fetchContracts();
  }, [currentUser]);

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography 
        variant="h4" 
        sx={{ 
          mb: 3, 
          fontWeight: 700,
          fontSize: '2rem',
          background: 'linear-gradient(45deg, #0071e3, #34c759)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: `${fadeIn} 0.5s ease-out`
        }}
      >
        Trésorerie
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ 
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)'
      }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            px: 2,
            backgroundColor: '#f5f5f7'
          }}
        >
          <Tab 
            icon={<DescriptionIcon />} 
            label="Contrats à générer" 
            sx={{ textTransform: 'none' }}
          />
          <Tab 
            icon={<PaymentIcon />} 
            label="Paiements à effectuer" 
            sx={{ textTransform: 'none' }}
          />
          <Tab 
            icon={<ReceiptIcon />} 
            label="Factures à envoyer" 
            sx={{ textTransform: 'none' }}
          />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {contracts.length === 0 ? (
            <Paper 
              sx={{ 
                p: 4, 
                textAlign: 'center',
                bgcolor: 'white',
                borderRadius: '1.2rem',
                border: '1px solid #e5e5e7',
                m: 2
              }}
            >
              <DescriptionIcon sx={{ fontSize: 48, color: '#86868b', mb: 2 }} />
              <Typography variant="h6" sx={{ color: '#1d1d1f', mb: 1 }}>
                Aucun contrat à générer dans votre structure
              </Typography>
              <Typography variant="body1" sx={{ color: '#86868b', mb: 3 }}>
                Les contrats apparaîtront ici lorsqu'ils seront créés.
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              mb: 2,
              pl: 2
            }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip
                  label="Tous les contrats"
                  onClick={() => setContractFilter('all')}
                  color={contractFilter === 'all' ? 'primary' : 'default'}
                  variant={contractFilter === 'all' ? 'filled' : 'outlined'}
                  sx={{
                    borderRadius: '8px',
                    '&.MuiChip-filled': {
                      backgroundColor: '#007AFF',
                    },
                    '&.MuiChip-outlined': {
                      borderColor: '#d2d2d7',
                      color: '#1d1d1f',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)'
                      }
                    }
                  }}
                />
                <Chip
                  label="À générer"
                  onClick={() => setContractFilter('pending')}
                  color={contractFilter === 'pending' ? 'primary' : 'default'}
                  variant={contractFilter === 'pending' ? 'filled' : 'outlined'}
                  sx={{
                    borderRadius: '8px',
                    '&.MuiChip-filled': {
                      backgroundColor: '#007AFF',
                    },
                    '&.MuiChip-outlined': {
                      borderColor: '#d2d2d7',
                      color: '#1d1d1f',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)'
                      }
                    }
                  }}
                />
                <Chip
                  label="Déjà générés"
                  onClick={() => setContractFilter('generated')}
                  color={contractFilter === 'generated' ? 'primary' : 'default'}
                  variant={contractFilter === 'generated' ? 'filled' : 'outlined'}
                  sx={{
                    borderRadius: '8px',
                    '&.MuiChip-filled': {
                      backgroundColor: '#007AFF',
                    },
                    '&.MuiChip-outlined': {
                      borderColor: '#d2d2d7',
                      color: '#1d1d1f',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)'
                      }
                    }
                  }}
                />
              </Box>
              {Object.values(filters).some(filter => filter !== '') && (
                <Button
                  startIcon={<ClearIcon />}
                  onClick={handleResetFilters}
                  size="small"
                  sx={{
                    color: '#FF3B30',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 59, 48, 0.08)'
                    }
                  }}
                >
                  Réinitialiser les filtres
                </Button>
              )}
            </Box>
          )}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>
                    <FilterableColumnHeader column="numeroMission" label="Numéro de mission" />
                  </TableCell>
                  <TableCell>
                    <FilterableColumnHeader column="student" label="Étudiant" />
                  </TableCell>
                  <TableCell>
                    <FilterableColumnHeader column="startDate" label="Date de début" />
                  </TableCell>
                  <TableCell>
                    <FilterableColumnHeader column="endDate" label="Date de fin" />
                  </TableCell>
                  <TableCell>
                    <FilterableColumnHeader column="hours" label="Heures assignées" />
                  </TableCell>
                  <TableCell>
                    <FilterableColumnHeader column="status" label="Statut" />
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {getSortedContracts(getFilteredContracts(contracts))
                  .map((contract) => {
                    const rowId = `${contract.mission.id}-${contract.application.id}`;
                    const isOpen = openRows[rowId] || false;

                    return (
                      <React.Fragment key={rowId}>
                        <TableRow>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => handleToggleRow(rowId)}
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
                              <Typography sx={{ 
                                cursor: 'pointer',
                                '&:hover': {
                                  color: '#007AFF'
                                }
                              }}>
                                {contract.application.userDisplayName}
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
                                <Chip
                                  label={contract.status?.isContractGenerated ? "Généré" : "Non généré"}
                                  color={contract.status?.isContractGenerated ? "success" : "default"}
                                  size="small"
                                  onClick={() => handleToggleContractGeneration(contract.mission.id, !!contract.status?.isContractGenerated)}
                                  sx={{
                                    borderRadius: '8px',
                                    backgroundColor: contract.status?.isContractGenerated ? 'rgba(52, 199, 89, 0.1)' : 'rgba(142, 142, 147, 0.1)',
                                    color: contract.status?.isContractGenerated ? '#34C759' : '#8E8E93',
                                    border: 'none',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    '&:hover': {
                                      backgroundColor: contract.status?.isContractGenerated ? 'rgba(52, 199, 89, 0.2)' : 'rgba(142, 142, 147, 0.2)'
                                    },
                                    '& .MuiChip-label': {
                                      px: 2
                                    }
                                  }}
                                  clickable
                                />
                                {contract.status?.isContractGenerated && contract.status?.contractGeneratedAt && (
                                  <StyledTooltip
                                    title={
                                      <Box sx={{ 
                                        p: 1,
                                        backgroundColor: '#FFFFFF'
                                      }}>
                                        <Typography variant="subtitle2" sx={{ 
                                          fontWeight: 600,
                                          color: '#1d1d1f',
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
                                              color: '#86868b',
                                              backgroundColor: '#FFFFFF'
                                            }}>
                                              Date :
                                            </Typography>
                                            <Typography variant="body2" sx={{ 
                                              color: '#1d1d1f',
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
                                              color: '#86868b',
                                              backgroundColor: '#FFFFFF'
                                            }}>
                                              Heure :
                                            </Typography>
                                            <Typography variant="body2" sx={{ 
                                              color: '#1d1d1f',
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
                                              color: '#86868b',
                                              backgroundColor: '#FFFFFF'
                                            }}>
                                              Généré par :
                                            </Typography>
                                            <Typography variant="body2" sx={{ 
                                              color: '#1d1d1f',
                                              backgroundColor: '#FFFFFF'
                                            }}>
                                              {contract.createdByName || 'Utilisateur inconnu'}
                                            </Typography>
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
                                        color: '#007AFF',
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
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          {contracts.length === 0 ? (
            <Paper 
              sx={{ 
                p: 4, 
                textAlign: 'center',
                bgcolor: 'white',
                borderRadius: '1.2rem',
                border: '1px solid #e5e5e7',
                m: 2
              }}
            >
              <PaymentIcon sx={{ fontSize: 48, color: '#86868b', mb: 2 }} />
              <Typography variant="h6" sx={{ color: '#1d1d1f', mb: 1 }}>
                Aucun paiement à effectuer dans votre structure
              </Typography>
              <Typography variant="body1" sx={{ color: '#86868b', mb: 3 }}>
                Les paiements apparaîtront ici lorsqu'ils seront créés.
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              mb: 2,
              pl: 2
            }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip
                  label="Tous les paiements"
                  onClick={() => setPaymentFilter('all')}
                  color={paymentFilter === 'all' ? 'primary' : 'default'}
                  variant={paymentFilter === 'all' ? 'filled' : 'outlined'}
                  sx={{
                    borderRadius: '8px',
                    '&.MuiChip-filled': {
                      backgroundColor: '#007AFF',
                    },
                    '&.MuiChip-outlined': {
                      borderColor: '#d2d2d7',
                      color: '#1d1d1f',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)'
                      }
                    }
                  }}
                />
                <Chip
                  label="À effectuer"
                  onClick={() => setPaymentFilter('pending')}
                  color={paymentFilter === 'pending' ? 'primary' : 'default'}
                  variant={paymentFilter === 'pending' ? 'filled' : 'outlined'}
                  sx={{
                    borderRadius: '8px',
                    '&.MuiChip-filled': {
                      backgroundColor: '#007AFF',
                    },
                    '&.MuiChip-outlined': {
                      borderColor: '#d2d2d7',
                      color: '#1d1d1f',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)'
                      }
                    }
                  }}
                />
                <Chip
                  label="Effectués"
                  onClick={() => setPaymentFilter('processed')}
                  color={paymentFilter === 'processed' ? 'primary' : 'default'}
                  variant={paymentFilter === 'processed' ? 'filled' : 'outlined'}
                  sx={{
                    borderRadius: '8px',
                    '&.MuiChip-filled': {
                      backgroundColor: '#007AFF',
                    },
                    '&.MuiChip-outlined': {
                      borderColor: '#d2d2d7',
                      color: '#1d1d1f',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)'
                      }
                    }
                  }}
                />
              </Box>
              {Object.values(filters).some(filter => filter !== '') && (
                <Button
                  startIcon={<ClearIcon />}
                  onClick={handleResetFilters}
                  size="small"
                  sx={{
                    color: '#FF3B30',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 59, 48, 0.08)'
                    }
                  }}
                >
                  Réinitialiser les filtres
                </Button>
              )}
            </Box>
          )}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>Numéro de mission</TableCell>
                  <TableCell>Étudiant</TableCell>
                  <TableCell>Date de fin</TableCell>
                  <TableCell>Heures assignées</TableCell>
                  <TableCell>Rémunération horaire</TableCell>
                  <TableCell>Notes de frais</TableCell>
                  <TableCell>Total à payer</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {contracts
                  .filter(contract => {
                    if (paymentFilter === 'all') return true;
                    if (paymentFilter === 'pending') return !contract.isPaymentProcessed;
                    if (paymentFilter === 'processed') return contract.isPaymentProcessed;
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
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          {contracts.length === 0 ? (
            <Paper 
              sx={{ 
                p: 4, 
                textAlign: 'center',
                bgcolor: 'white',
                borderRadius: '1.2rem',
                border: '1px solid #e5e5e7',
                m: 2
              }}
            >
              <ReceiptIcon sx={{ fontSize: 48, color: '#86868b', mb: 2 }} />
              <Typography variant="h6" sx={{ color: '#1d1d1f', mb: 1 }}>
                Aucune facture à envoyer dans votre structure
              </Typography>
              <Typography variant="body1" sx={{ color: '#86868b', mb: 3 }}>
                Les factures apparaîtront ici lorsqu'elles seront créées.
              </Typography>
            </Paper>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Numéro de mission</TableCell>
                    <TableCell>Date de fin de la mission</TableCell>
                    <TableCell>Prix horaire HT</TableCell>
                    <TableCell>Total HT</TableCell>
                    <TableCell>TVA (20%)</TableCell>
                    <TableCell>Notes de frais validées</TableCell>
                    <TableCell>Total TTC</TableCell>
                    <TableCell>Prix final</TableCell>
                    <TableCell>Statut facture</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contracts.map((contract) => {
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
                    const handleInvoiceStatusClick = async () => {
                      let nextStatus: 'to_send' | 'sent' | 'paid';
                      if (invoiceStatus === 'to_send') nextStatus = 'sent';
                      else if (invoiceStatus === 'sent') nextStatus = 'paid';
                      else nextStatus = 'to_send';
                      const missionRef = doc(db, 'missions', contract.mission.id);
                      await updateDoc(missionRef, { invoiceStatus: nextStatus });
                      setContracts(prev => prev.map(c =>
                        c.mission.id === contract.mission.id
                          ? { ...c, mission: { ...c.mission, invoiceStatus: nextStatus } }
                          : c
                      ));
                    };
                    return (
                      <TableRow key={contract.mission.id}>
                        <TableCell>{contract.mission.numeroMission}</TableCell>
                        <TableCell>{formatDate(contract.mission.endDate)}</TableCell>
                        <TableCell>{priceHT.toFixed(2)}€</TableCell>
                        <TableCell>{totalHT.toFixed(2)}€</TableCell>
                        <TableCell>{tvaMontant.toFixed(2)}€</TableCell>
                        <TableCell>{validatedExpenses.toFixed(2)}€</TableCell>
                        <TableCell>{totalTTC.toFixed(2)}€</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#34C759' }}>{finalPrice.toFixed(2)}€</TableCell>
                        <TableCell>
                          <Chip
                            label={statusMap[invoiceStatus].label}
                            color={statusMap[invoiceStatus].color as any}
                            onClick={handleInvoiceStatusClick}
                            sx={{ cursor: 'pointer', fontWeight: 500, borderRadius: '8px' }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default Tresorerie; 