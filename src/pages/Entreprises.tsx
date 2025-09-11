import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Avatar,
  Chip,
  Snackbar,
  Alert,
  CircularProgress,
  CardHeader,
  CardActions,
  Tooltip,
  Paper,
  Divider,
  Stack,
  InputBase,
  alpha,
  useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  WorkHistory as WorkHistoryIcon,
  Euro as EuroIcon,
  CloudUpload as CloudUploadIcon,
  PersonAdd as PersonAddIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where, Timestamp, deleteField, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { uploadCompanyLogo } from '../firebase/storage';
import { keyframes } from '@mui/system';
import { styled } from '@mui/material';

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
const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: '16px',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
  backdropFilter: 'blur(10px)',
  backgroundColor: alpha(theme.palette.background.paper, 0.8),
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
    transform: 'translateY(-2px)',
  },
  animation: `${fadeIn} 0.5s ease-out`,
}));

const StyledAvatar = styled(Avatar)(({ theme }) => ({
  width: 80,
  height: 80,
  borderRadius: '16px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    transform: 'scale(1.05)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
  },
  '& img': {
    objectFit: 'contain',
    padding: '8px'
  }
}));

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: '12px',
  textTransform: 'none',
  fontWeight: 600,
  padding: '10px 24px',
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
}));

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

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position?: string;
  phone?: string;
  linkedin?: string;
  gender?: 'homme' | 'femme';
  createdAt: Date;
  createdBy: string;
  isDefault: boolean;
  notes?: ContactNote[];
}

export interface ContactNote {
  id: string;
  content: string;
  createdBy: string;
  authorName?: string;
  createdAt: Date;
}

export interface Company {
  id: string;
  name: string;
  siret?: string;
  description?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
  contacts?: Contact[];
  missionsCount?: number;
  totalRevenue?: number;
  createdAt?: Date;
  updatedAt?: Date;
  structureId: string;
}

interface Mission {
  id: string;
  title: string;
  numeroMission: number;
  companyId: string;
  startDate: Date;
  endDate?: Date;
  status: string;
  totalTTC: number;
  hours: number;
  priceHT: number;
}

const Entreprises: React.FC = () => {
  const { currentUser } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [newCompany, setNewCompany] = useState<Partial<Company>>({
    name: '',
    description: '',
    address: '',
    city: '',
    postalCode: '',
    country: '',
    phone: '',
    email: '',
    website: '',
    logo: '',
    siret: ''
  });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContact, setNewContact] = useState<Partial<Contact>>({
    firstName: '',
    lastName: '',
    email: '',
    position: ''
  });
  const [showContactForm, setShowContactForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const theme = useTheme();

  const updateCompanyStats = async (companyId: string) => {
    try {
      // Récupérer toutes les missions de l'entreprise
      const missionsRef = collection(db, 'missions');
      const missionsQuery = query(missionsRef, where('companyId', '==', companyId));
      const missionsSnapshot = await getDocs(missionsQuery);
      
      // Récupérer les missions
      const missions = missionsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || '',
          numeroMission: data.numeroMission || 0,
          companyId: data.companyId || '',
          startDate: data.startDate ? new Date(data.startDate) : new Date(),
          endDate: data.endDate ? new Date(data.endDate) : null,
          status: data.status || 'en_cours',
          totalTTC: Number(data.totalTTC) || 0,
          hours: Number(data.hours) || 0,
          priceHT: Number(data.priceHT) || 0
        } as Mission;
      });

      // Calculer les statistiques
      const missionsCount = missions.length;
      const totalRevenue = missions.reduce((total, mission) => total + mission.totalTTC, 0);

      // Mettre à jour l'entreprise dans Firestore
      const companyRef = doc(db, 'companies', companyId);
      await updateDoc(companyRef, {
        missionsCount,
        totalRevenue,
        updatedAt: new Date()
      });
      
      // Mettre à jour l'état local
      setCompanies(prevCompanies => 
        prevCompanies.map(company => 
          company.id === companyId 
            ? { ...company, missionsCount, totalRevenue }
            : company
        )
      );
    } catch (error) {
      console.error('Erreur lors de la mise à jour des statistiques:', error);
    }
  };

  useEffect(() => {
    const fetchCompanies = async () => {
      if (!currentUser) return;

      try {
        setLoading(true);
        console.log("Début de la récupération des entreprises");
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

        // Mettre à jour le champ siren en siret dans la base de données
        const companiesRef = collection(db, 'companies');
        const companiesQuery = query(companiesRef, where('structureId', '==', userStructureId));
        const companiesSnapshot = await getDocs(companiesQuery);
        
        console.log("Nombre total d'entreprises trouvées:", companiesSnapshot.docs.length);
        
        // Récupérer toutes les missions pour toutes les entreprises
        const missionsRef = collection(db, 'missions');
        const missionsSnapshot = await getDocs(missionsRef);
        const missionsByCompany = missionsSnapshot.docs.reduce((acc, doc) => {
          const data = doc.data();
          const companyId = data.companyId;
          if (!acc[companyId]) {
            acc[companyId] = [];
          }
          acc[companyId].push(doc.data());
          return acc;
        }, {} as Record<string, any[]>);
        
        const companiesData = companiesSnapshot.docs.map(doc => {
          const data = doc.data();
          const companyMissions = missionsByCompany[doc.id] || [];
          const totalRevenue = companyMissions.reduce((total, mission) => total + (Number(mission.totalTTC) || 0), 0);
          
          console.log("Entreprise trouvée:", {
            id: doc.id,
            name: data.name,
            structureId: data.structureId,
            userStructureId,
            match: data.structureId === userStructureId
          });
          return {
            id: doc.id,
            name: data.name,
            description: data.description,
            address: data.address,
            city: data.city,
            country: data.country,
            phone: data.phone,
            email: data.email,
            website: data.website,
            logo: data.logo,
            siret: data.siret,
            contacts: data.contacts || [],
            missionsCount: companyMissions.length,
            totalRevenue,
            createdAt: data.createdAt?.toDate() || new Date(),
            structureId: data.structureId
          } as Company;
        });

        console.log("Résultats finaux:", {
          totalEntreprises: companiesSnapshot.docs.length,
          entreprisesFiltrées: companiesData.length,
          userStructureId
        });

        setCompanies(companiesData);
      } catch (error) {
        console.error('Erreur lors du chargement des entreprises:', error);
        setSnackbar({
          open: true,
          message: 'Erreur lors du chargement des entreprises',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, [currentUser]);

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setNewCompany({
      name: '',
      description: '',
      address: '',
      city: '',
      country: '',
      phone: '',
      email: '',
      website: '',
      logo: '',
      siret: ''
    });
    setContacts([]);
    setShowContactForm(false);
  };

  const handleOpenEditDialog = (company: Company) => {
    setSelectedCompany(company);
    setOpenEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setOpenEditDialog(false);
    setSelectedCompany(null);
  };

  const handleCreateCompany = async () => {
    if (!currentUser) {
      setSnackbar({
        open: true,
        message: "Veuillez vous connecter pour créer une entreprise",
        severity: "error"
      });
      return;
    }

    try {
      const userDoc = await getDocs(collection(db, 'users'));
      if (userDoc.empty) {
        throw new Error("Utilisateur non trouvé");
      }

      const userData = userDoc.docs[0].data();
      const userStructureId = userData.structureId;

      // Générer un ID unique pour l'entreprise
      const companyId = crypto.randomUUID();

      const companiesRef = collection(db, 'companies');
      await addDoc(companiesRef, {
        ...newCompany,
        id: companyId, // Ajouter l'ID à l'objet
        createdAt: Timestamp.fromDate(new Date()),
        structureId: userStructureId
      });

      setSnackbar({
        open: true,
        message: "Entreprise créée avec succès",
        severity: "success"
      });

      handleCloseDialog();
      // Rafraîchir la liste des entreprises
      const snapshot = await getDocs(query(companiesRef, where('structureId', '==', userStructureId)));
      const companiesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Company[];
      setCompanies(companiesList);
    } catch (error) {
      console.error("Erreur lors de la création de l'entreprise:", error);
      setSnackbar({
        open: true,
        message: "Erreur lors de la création de l'entreprise",
        severity: "error"
      });
    }
  };

  const handleUpdateCompany = async () => {
    if (!selectedCompany) return;

    try {
      const companyRef = doc(db, 'companies', selectedCompany.id);
      await updateDoc(companyRef, {
        ...selectedCompany,
        updatedAt: Timestamp.fromDate(new Date())
      });

      setSnackbar({
        open: true,
        message: "Entreprise mise à jour avec succès",
        severity: "success"
      });

      handleCloseEditDialog();
      // Rafraîchir la liste des entreprises
      const companiesRef = collection(db, 'companies');
      const snapshot = await getDocs(query(companiesRef, where('structureId', '==', selectedCompany.structureId)));
      const companiesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Company[];
      setCompanies(companiesList);
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'entreprise:", error);
      setSnackbar({
        open: true,
        message: "Erreur lors de la mise à jour de l'entreprise",
        severity: "error"
      });
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette entreprise ?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'companies', companyId));
      setCompanies(companies.filter(company => company.id !== companyId));
      setSnackbar({
        open: true,
        message: "Entreprise supprimée avec succès",
        severity: "success"
      });
    } catch (error) {
      console.error("Erreur lors de la suppression de l'entreprise:", error);
      setSnackbar({
        open: true,
        message: "Erreur lors de la suppression de l'entreprise",
        severity: "error"
      });
    }
  };

  const handleAddContact = () => {
    if (!newContact.firstName || !newContact.lastName || !newContact.email || !currentUser) return;

    const contact: Contact = {
      id: crypto.randomUUID(),
      firstName: newContact.firstName,
      lastName: newContact.lastName,
      email: newContact.email,
      position: newContact.position || '',
      phone: newContact.phone,
      linkedin: newContact.linkedin,
      createdAt: new Date(),
      createdBy: currentUser.uid,
      isDefault: false
    };

    setNewCompany(prev => ({
      ...prev,
      contacts: [...(prev.contacts || []), contact]
    }));
    setNewContact({
      firstName: '',
      lastName: '',
      email: '',
      position: '',
      phone: '',
      linkedin: ''
    });
  };

  const handleRemoveContact = (contactId: string) => {
    setContacts(contacts.filter(contact => contact.id !== contactId));
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        // Afficher un indicateur de chargement
        setSnackbar({
          open: true,
          message: "Téléchargement du logo en cours...",
          severity: "info"
        });
        
        // Générer un ID temporaire pour l'entreprise si elle n'existe pas encore
        const tempCompanyId = newCompany.id || crypto.randomUUID();
        
        // Télécharger le logo vers Firebase Storage
        const logoUrl = await uploadCompanyLogo(file, tempCompanyId);
        
        // Vérifier que l'URL est valide (commence par http:// ou https://)
        if (!logoUrl.startsWith('http://') && !logoUrl.startsWith('https://')) {
          throw new Error("URL du logo invalide");
        }
        
        // Mettre à jour l'état avec l'URL du logo
        setNewCompany({
          ...newCompany,
          logo: logoUrl
        });
        
        setSnackbar({
          open: true,
          message: "Logo téléchargé avec succès",
          severity: "success"
        });
      } catch (error) {
        console.error("Erreur lors du téléchargement du logo:", error);
        setSnackbar({
          open: true,
          message: "Erreur lors du téléchargement du logo",
          severity: "error"
        });
      }
    }
  };

  const handleCardClick = (companyId: string) => {
    navigate(`/app/entreprises/${companyId}`);
  };

  const handleContactChange = (field: keyof Omit<Contact, 'id' | 'createdAt' | 'createdBy'>, value: string) => {
    setNewContact(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      p: 3,
      background: theme => `linear-gradient(180deg, ${alpha(theme.palette.background.default, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
      minHeight: '100vh'
    }}>
      <Typography 
        variant="h4" 
        gutterBottom 
        sx={{ 
          fontWeight: 700,
          mb: 4,
          background: theme => `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: `${fadeIn} 0.5s ease-out`
        }}
      >
        Entreprises
      </Typography>

      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 4,
          px: 2,
          animation: `${fadeIn} 0.5s ease-out 0.2s both`
        }}
      >
        <StyledButton
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
          sx={{
            bgcolor: theme => theme.palette.primary.main,
            '&:hover': {
              bgcolor: theme => theme.palette.primary.dark
            }
          }}
        >
          Ajouter une entreprise
        </StyledButton>
      </Box>

      <Grid container spacing={3} sx={{ px: 2 }}>
        {companies.length === 0 ? (
          <Grid item xs={12}>
            <Paper 
              sx={{ 
                p: 4, 
                textAlign: 'center',
                bgcolor: 'white',
                borderRadius: '1.2rem',
                border: '1px solid #e5e5e7',
                animation: `${fadeIn} 0.5s ease-out`
              }}
            >
              <BusinessIcon sx={{ fontSize: 48, color: '#86868b', mb: 2 }} />
              <Typography variant="h6" sx={{ color: '#1d1d1f', mb: 1 }}>
                Aucune entreprise dans votre structure
              </Typography>
              <Typography variant="body1" sx={{ color: '#86868b', mb: 3 }}>
                Commencez par ajouter votre première entreprise en cliquant sur le bouton ci-dessus.
              </Typography>
              <StyledButton
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenDialog}
              >
                Ajouter une entreprise
              </StyledButton>
            </Paper>
          </Grid>
        ) : (
          companies.map((company) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={company.id}>
              <StyledCard 
                onClick={() => handleCardClick(company.id)}
                sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  maxHeight: '280px'
                }}
              >
                <CardContent sx={{ p: 2, flexGrow: 1 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    gap: 1
                  }}>
                    {company.logo ? (
                      <StyledAvatar
                        src={company.logo}
                        alt={company.name}
                        sx={{ mb: 1 }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: 80,
                          height: 80,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: theme => alpha(theme.palette.primary.main, 0.1),
                          borderRadius: '16px',
                          mb: 1
                        }}
                      >
                        <BusinessIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                      </Box>
                    )}
                    
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 600,
                        textAlign: 'center',
                        color: theme => theme.palette.text.primary,
                        fontSize: '1rem',
                        lineHeight: 1.2,
                        mb: 0.5
                      }}
                    >
                      {company.name}
                    </Typography>
                    
                    {company.city && (
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: theme => alpha(theme.palette.text.secondary, 0.8),
                          textAlign: 'center',
                          fontSize: '0.875rem'
                        }}
                      >
                        {company.city}
                      </Typography>
                    )}
                  </Box>
                </CardContent>

                <Divider />

                <Box sx={{ 
                  p: 1.5,
                  display: 'flex',
                  justifyContent: 'space-between',
                  bgcolor: theme => alpha(theme.palette.background.default, 0.5)
                }}>
                  <Box sx={{ textAlign: 'center', flex: 1 }}>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        color: theme => theme.palette.text.primary,
                        fontWeight: 600,
                        fontSize: '1rem'
                      }}
                    >
                      {company.missionsCount || 0}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: theme => alpha(theme.palette.text.secondary, 0.8),
                        display: 'block',
                        fontSize: '0.75rem'
                      }}
                    >
                      {company.missionsCount > 1 ? 'Missions' : 'Mission'}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ textAlign: 'center', flex: 1 }}>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        color: theme => theme.palette.text.primary,
                        fontWeight: 600,
                        fontSize: '1rem'
                      }}
                    >
                      {new Intl.NumberFormat('fr-FR', { 
                        style: 'currency', 
                        currency: 'EUR',
                        maximumFractionDigits: 0
                      }).format(company.totalRevenue || 0)}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: theme => alpha(theme.palette.text.secondary, 0.8),
                        display: 'block',
                        fontSize: '0.75rem'
                      }}
                    >
                      CA Total
                    </Typography>
                  </Box>
                </Box>
              </StyledCard>
            </Grid>
          ))
        )}
      </Grid>

      {/* Dialog pour ajouter une entreprise */}
      <StyledDialog 
        open={openDialog} 
        onClose={handleCloseDialog} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle sx={{ 
          textAlign: 'center', 
          fontSize: '1.5rem', 
          fontWeight: 500,
          pt: 4
        }}>
          Nouvelle entreprise
        </DialogTitle>
        <DialogContent sx={{ px: 4 }}>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                Nom de l'entreprise *
              </Typography>
              <StyledTextField
                value={newCompany.name}
                onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                fullWidth
                placeholder="Entrez le nom de l'entreprise"
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                Logo
              </Typography>
              <Box
                component="label"
                sx={{
                  width: '100%',
                  height: '100px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: theme => `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    borderColor: theme => theme.palette.primary.main,
                    bgcolor: theme => alpha(theme.palette.primary.main, 0.05),
                  }
                }}
              >
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CloudUploadIcon />
                  <Typography>
                    {newCompany.logo ? 'Changer le logo' : 'Importer un logo'}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                Adresse
              </Typography>
              <StyledTextField
                value={newCompany.address}
                onChange={(e) => setNewCompany({ ...newCompany, address: e.target.value })}
                fullWidth
                placeholder="Adresse de l'entreprise"
              />
            </Box>

            <Grid container>
              <Grid item xs={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                    Code postal
                  </Typography>
                  <StyledTextField
                    value={newCompany.postalCode}
                    onChange={(e) => setNewCompany({ ...newCompany, postalCode: e.target.value })}
                    fullWidth
                    placeholder="Code postal"
                  />
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column', ml: 2 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                    Ville
                  </Typography>
                  <StyledTextField
                    value={newCompany.city}
                    onChange={(e) => setNewCompany({ ...newCompany, city: e.target.value })}
                    fullWidth
                    placeholder="Ville"
                  />
                </Box>
              </Grid>
            </Grid>

            <Grid container>
              <Grid item xs={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                    SIRET
                  </Typography>
                  <StyledTextField
                    value={newCompany.siret}
                    onChange={(e) => setNewCompany({ ...newCompany, siret: e.target.value })}
                    fullWidth
                    placeholder="Numéro SIRET"
                  />
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column', ml: 2 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                    Pays
                  </Typography>
                  <StyledTextField
                    value={newCompany.country}
                    onChange={(e) => setNewCompany({ ...newCompany, country: e.target.value })}
                    fullWidth
                    placeholder="Pays"
                  />
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Contacts
                </Typography>
                <StyledButton
                  startIcon={<PersonAddIcon />}
                  onClick={() => setShowContactForm(true)}
                  sx={{
                    color: 'primary.main',
                    '&:hover': {
                      bgcolor: theme => alpha(theme.palette.primary.main, 0.05),
                    }
                  }}
                >
                  Ajouter un contact
                </StyledButton>
              </Box>

              {contacts.map((contact) => (
                <Paper
                  key={contact.id}
                  sx={{
                    p: 2,
                    mb: 1,
                    borderRadius: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    bgcolor: theme => alpha(theme.palette.background.default, 0.5),
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      bgcolor: theme => alpha(theme.palette.background.default, 0.8),
                    }
                  }}
                >
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {contact.firstName} {contact.lastName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {contact.position} • {contact.email}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveContact(contact.id);
                    }}
                    sx={{ 
                      color: 'text.secondary',
                      '&:hover': {
                        color: 'error.main',
                        bgcolor: theme => alpha(theme.palette.error.main, 0.1),
                      }
                    }}
                  >
                    <CloseIcon />
                  </IconButton>
                </Paper>
              ))}

              {showContactForm && (
                <Paper sx={{ 
                  p: 2, 
                  mt: 2, 
                  borderRadius: '12px',
                  bgcolor: theme => alpha(theme.palette.background.default, 0.5)
                }}>
                                      <Stack spacing={2}>
                      <Grid container>
                        <Grid item xs={6}>
                          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <StyledTextField
                              placeholder="Prénom"
                              value={newContact.firstName}
                              onChange={(e) => handleContactChange('firstName', e.target.value)}
                              fullWidth
                            />
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', ml: 2 }}>
                            <StyledTextField
                              placeholder="Nom"
                              value={newContact.lastName}
                              onChange={(e) => handleContactChange('lastName', e.target.value)}
                              fullWidth
                            />
                          </Box>
                        </Grid>
                      </Grid>
                    <StyledTextField
                      placeholder="Email"
                      value={newContact.email}
                      onChange={(e) => handleContactChange('email', e.target.value)}
                      fullWidth
                    />
                    <StyledTextField
                      placeholder="Poste"
                      value={newContact.position}
                      onChange={(e) => handleContactChange('position', e.target.value)}
                      fullWidth
                    />
                    <StyledTextField
                      placeholder="Téléphone"
                      value={newContact.phone}
                      onChange={(e) => handleContactChange('phone', e.target.value)}
                      fullWidth
                    />
                    <StyledTextField
                      placeholder="LinkedIn"
                      value={newContact.linkedin}
                      onChange={(e) => handleContactChange('linkedin', e.target.value)}
                      fullWidth
                    />
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                      <StyledButton
                        onClick={() => setShowContactForm(false)}
                        sx={{ color: 'text.secondary' }}
                      >
                        Annuler
                      </StyledButton>
                      <StyledButton
                        onClick={handleAddContact}
                        variant="contained"
                      >
                        Ajouter
                      </StyledButton>
                    </Box>
                  </Stack>
                </Paper>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 4, justifyContent: 'flex-end' }}>
          <StyledButton
            onClick={handleCloseDialog}
            sx={{
              color: 'text.secondary',
              '&:hover': {
                bgcolor: theme => alpha(theme.palette.text.secondary, 0.05),
              }
            }}
          >
            Annuler
          </StyledButton>
          <StyledButton
            onClick={handleCreateCompany}
            variant="contained"
            disabled={!newCompany.name}
          >
            Créer
          </StyledButton>
        </DialogActions>
      </StyledDialog>

      {/* Snackbar pour les notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ 
            width: '100%',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Entreprises; 