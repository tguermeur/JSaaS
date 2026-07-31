import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Snackbar,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  Stack,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  Business as BusinessIcon,
  CloudUpload as CloudUploadIcon,
  PersonAdd as PersonAddIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where, Timestamp, deleteField, getDoc } from 'firebase/firestore';
import { batchDecryptForStructure } from '../utils/batchDecrypt';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { uploadCompanyLogo } from '../firebase/storage';
import { usePermission } from '../hooks/usePermission';
import { tokens } from '../theme/tokens';
import { StyledButton, StyledTextField, StyledDialog } from '../components/styled';
import AccessDenied from '../components/common/AccessDenied';
import { AppPageShell, CompaniesLayout, CompanySwitcher } from '../components/ds';
import type { CompanyListItem } from '../components/ds';

/** Convertit une valeur Firestore (Timestamp, Date, number) ou undefined en Date. */
function toSafeDate(value: unknown): Date {
  if (value == null) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  const o = value as { toDate?: () => Date };
  if (typeof o?.toDate === 'function') return o.toDate();
  return new Date();
}

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
  nSiret?: string;
  description?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
  logoLarge?: string;
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

const isEncrypted = (v: any): boolean => typeof v === 'string' && v.startsWith('ENC:');

const Entreprises: React.FC = () => {
  const { currentUser } = useAuth();
  const { canRead, canWrite, loading: permissionLoading } = usePermission('entreprises');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [decryptedCompanies, setDecryptedCompanies] = useState<Record<string, Partial<Pick<Company, 'name' | 'city'>>>>({});
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
    nSiret: ''
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
  const [directorySearch, setDirectorySearch] = useState('');

  const formatEur = (n?: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

  const toListItem = (company: Company): CompanyListItem => {
    const display = { ...company, ...decryptedCompanies[company.id] };
    const name = display.name || company.name || '—';
    return {
      id: company.id,
      name: isEncrypted(name) ? 'Entreprise' : name,
      sector: display.city || company.city,
      missionsCount: company.missionsCount,
      revenue: formatEur(company.totalRevenue),
      initials: name.slice(0, 2).toUpperCase(),
    };
  };

  const companyListItems = companies.map(toListItem);
  const totalRevenue = companies.reduce((s, c) => s + (c.totalRevenue || 0), 0);
  const totalMissions = companies.reduce((s, c) => s + (c.missionsCount || 0), 0);

  const updateCompanyStats = async (companyId: string) => {
    try {
      const missionsRef = collection(db, 'missions');
      const userDoc = await getDoc(doc(db, 'users', currentUser!.uid));
      const userStructureIdLocal = userDoc.exists() ? userDoc.data()?.structureId : null;
      const missionsQueryConstraints = [where('companyId', '==', companyId)];
      if (userStructureIdLocal) {
        missionsQueryConstraints.push(where('structureId', '==', userStructureIdLocal));
      }
      const missionsQuery = query(missionsRef, ...missionsQueryConstraints);
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
        
        // Récupérer d'abord les données de l'utilisateur
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) {
          console.error("Document utilisateur non trouvé");
          setLoading(false);
          return;
        }

        const userData = userDoc.data();
        const userStructureId = userData?.structureId;
        
        if (!userStructureId) {
          console.error("StructureId non trouvé pour l'utilisateur");
          setLoading(false);
          return;
        }

        // Récupérer les entreprises de la structure
        const companiesRef = collection(db, 'companies');
        const companiesQuery = query(companiesRef, where('structureId', '==', userStructureId));
        const companiesSnapshot = await getDocs(companiesQuery);
        
        // Récupérer les missions de la structure uniquement (évite permission-denied sur toute la collection)
        const missionsRef = collection(db, 'missions');
        const missionsQuery = query(missionsRef, where('structureId', '==', userStructureId));
        const missionsSnapshot = await getDocs(missionsQuery);
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
            nSiret: data.nSiret,
            contacts: data.contacts || [],
            missionsCount: companyMissions.length,
            totalRevenue,
            createdAt: toSafeDate(data.createdAt),
            structureId: data.structureId
          } as Company;
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
  }, [currentUser?.uid]);

  // Déchiffrer les infos entreprise (nom, ville) — batch 1 callable
  useEffect(() => {
    if (!companies.length || !canRead) return;
    const run = async () => {
      const toDecrypt = companies.filter(
        (company) => isEncrypted(company.name) || isEncrypted(company.city)
      );
      if (!toDecrypt.length) return;
      try {
        const results = await batchDecryptForStructure<Partial<Pick<Company, 'name' | 'city'>>>(
          'company',
          toDecrypt.map((c) => c.id),
          ['name', 'city', 'address', 'phone']
        );
        const next: Record<string, Partial<Pick<Company, 'name' | 'city'>>> = {};
        for (const [id, dec] of Object.entries(results)) {
          if (dec.name != null || dec.city != null) {
            next[id] = { name: dec.name, city: dec.city };
          }
        }
        if (Object.keys(next).length) {
          setDecryptedCompanies((prev) => ({ ...prev, ...next }));
        }
      } catch {
        // ignorer si déchiffrement échoue
      }
    };
    void run();
  }, [companies, canRead]);

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
      nSiret: ''
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
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!userDoc.exists()) {
        throw new Error("Utilisateur non trouvé");
      }

      const userData = userDoc.data();
      const userStructureId = userData?.structureId;
      if (!userStructureId) {
        throw new Error("Structure non trouvée pour l'utilisateur");
      }

      const companiesRef = collection(db, 'companies');
      await addDoc(companiesRef, {
        ...newCompany,
        createdAt: Timestamp.fromDate(new Date()),
        structureId: userStructureId
      });

      setSnackbar({
        open: true,
        message: "Entreprise créée avec succès",
        severity: "success"
      });

      handleCloseDialog();
      // Rafraîchir la liste des entreprises (même logique que fetchCompanies)
      const companiesQuery = query(companiesRef, where('structureId', '==', userStructureId));
      const companiesSnapshot = await getDocs(companiesQuery);
      const missionsRef = collection(db, 'missions');
      const missionsQuery = query(missionsRef, where('structureId', '==', userStructureId));
      const missionsSnapshot = await getDocs(missionsQuery);
      const missionsByCompany = missionsSnapshot.docs.reduce((acc, d) => {
        const data = d.data();
        const companyId = data.companyId;
        if (!acc[companyId]) acc[companyId] = [];
        acc[companyId].push(data);
        return acc;
      }, {} as Record<string, any[]>);
      const companiesData = companiesSnapshot.docs.map(d => {
        const data = d.data();
        const companyMissions = missionsByCompany[d.id] || [];
        const totalRevenue = companyMissions.reduce((t, m) => t + (Number(m.totalTTC) || 0), 0);
        return {
          id: d.id,
          name: data.name,
          description: data.description,
          address: data.address,
          city: data.city,
          country: data.country,
          phone: data.phone,
          email: data.email,
          website: data.website,
          logo: data.logo,
          nSiret: data.nSiret,
          contacts: data.contacts || [],
          missionsCount: companyMissions.length,
          totalRevenue,
          createdAt: toSafeDate(data.createdAt),
          structureId: data.structureId
        } as Company;
      });
      setCompanies(companiesData);
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
        createdAt: toSafeDate(doc.data().createdAt)
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
    if (!currentUser) {
      setSnackbar({
        open: true,
        message: "Seul un administrateur peu supprimer une entreprise.",
        severity: "error"
      });
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;
      const userStatus = userData?.status;
      const userRole = userData?.role;
      const isAdmin =
        userStatus === 'admin' ||
        userRole === 'admin' ||
        userStatus === 'admin_structure' ||
        userRole === 'admin_structure' ||
        userStatus === 'superadmin' ||
        userRole === 'superadmin';

      if (!isAdmin) {
        setSnackbar({
          open: true,
          message: "Seul un administrateur peu supprimer une entreprise.",
          severity: "error"
        });
        return;
      }
    } catch (error) {
      console.error("Erreur lors de la vérification des droits de suppression:", error);
      setSnackbar({
        open: true,
        message: "Erreur lors de la vérification des droits",
        severity: "error"
      });
      return;
    }

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

  // Afficher le chargement si les permissions ou les données sont en cours de chargement
  if (loading || permissionLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Afficher l'accès refusé si l'utilisateur n'a pas les permissions de lecture
  if (!canRead) {
    return (
      <AccessDenied 
        title="Accès refusé"
        message="Vous n'avez pas les permissions nécessaires pour accéder à la page Entreprises. Contactez votre administrateur pour obtenir l'accès."
      />
    );
  }

  return (
    <AppPageShell
      eyebrow="CRM"
      title="Entreprises"
      titleSuffix={String(companies.length)}
      subtitle={
        companies.length > 0
          ? `CA cumulé ${formatEur(totalRevenue)} · ${totalMissions} mission${totalMissions > 1 ? 's' : ''}`
          : undefined
      }
      actions={
        canWrite ? (
          <StyledButton
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenDialog}
            sx={{
              bgcolor: tokens.colors.brandTeal,
              boxShadow: tokens.shadows.button,
              textTransform: 'none',
              borderRadius: tokens.radius.md,
              '&:hover': { bgcolor: tokens.colors.brandTeal700 },
            }}
          >
            Ajouter une entreprise
          </StyledButton>
        ) : undefined
      }
    >
      {companies.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360, p: 4 }}>
          <Paper
            sx={{
              p: 5,
              textAlign: 'center',
              bgcolor: tokens.colors.bgPaper,
              borderRadius: tokens.radius.lg,
              border: `1px solid ${tokens.colors.borderDefault}`,
              maxWidth: 420,
            }}
          >
            <BusinessIcon sx={{ fontSize: 48, color: tokens.colors.textSecondary, mb: 2 }} />
            <Typography variant="h6" sx={{ color: tokens.colors.textPrimary, mb: 1 }}>
              Aucune entreprise dans votre structure
            </Typography>
            <Typography variant="body2" sx={{ color: tokens.colors.textSecondary, mb: 3 }}>
              {canWrite
                ? 'Commencez par ajouter votre première entreprise.'
                : "Aucune entreprise n'a encore été ajoutée à votre structure."}
            </Typography>
            {canWrite && (
              <StyledButton variant="contained" startIcon={<AddIcon />} onClick={handleOpenDialog}>
                Ajouter une entreprise
              </StyledButton>
            )}
          </Paper>
        </Box>
      ) : (
        <CompaniesLayout
          directory={
            <CompanySwitcher
              companies={companyListItems}
              search={directorySearch}
              onSearchChange={setDirectorySearch}
              onSelect={(companyId) => navigate(`/app/entreprises/${companyId}`)}
            />
          }
          detail={
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100%',
                p: 4,
                textAlign: 'center',
              }}
            >
              <BusinessIcon sx={{ fontSize: 40, color: tokens.colors.gray300, mb: 2 }} />
              <Typography sx={{ fontSize: 15, fontWeight: 600, color: tokens.colors.gray900, mb: 0.75 }}>
                Sélectionnez une entreprise
              </Typography>
              <Typography sx={{ fontSize: 13, color: tokens.colors.gray500, maxWidth: 320 }}>
                Choisissez une entreprise dans l&apos;annuaire à gauche pour afficher sa fiche détaillée.
              </Typography>
            </Box>
          }
        />
      )}

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
                  border: `1px solid ${tokens.colors.primaryAlpha20}`,
                  borderRadius: tokens.radius.md,
                  cursor: 'pointer',
                  transition: tokens.transitions.fast,
                  '&:hover': {
                    borderColor: tokens.colors.brandTeal,
                    bgcolor: tokens.colors.primaryAlpha10,
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
                    nSiret
                  </Typography>
                  <StyledTextField
                    value={newCompany.nSiret}
                    onChange={(e) => setNewCompany({ ...newCompany, nSiret: e.target.value })}
                    fullWidth
                    placeholder="Numéro nSiret"
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
                    color: tokens.colors.brandTeal,
                    '&:hover': {
                      bgcolor: tokens.colors.primaryAlpha10,
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
                    borderRadius: tokens.radius.md,
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
                  borderRadius: tokens.radius.md,
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
      {createPortal(
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          sx={{ zIndex: 10000 }}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{ 
              width: '100%',
              borderRadius: tokens.radius.md,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>,
        document.body
      )}
    </AppPageShell>
  );
};

export default Entreprises; 