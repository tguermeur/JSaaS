import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  CircularProgress
} from '@mui/material';
import { collection, getDocs, query, where, doc, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';

interface MissionType {
  id: string;
  title: string;
  structureId: string;
  studentProfile?: string;
  courseApplication?: string;
  missionLearning?: string;
}

export interface MissionFormData {
  number: string;
  companyId: string;
  companyName: string;
  location: string;
  missionType: string;
  assignees: string[];
  date: Date | null;
  endDate: Date | null;
  hours: number;
  studentCount: number;
  description: string;
  salary: string;
  priceHT: number;
  chargeId?: string;
  chargeName?: string;
}

interface MissionFormProps {
  onSubmit: (data: MissionFormData) => void;
  onCancel: () => void;
  initialData?: Partial<MissionFormData>;
  availableCharges?: Array<{id: string, displayName: string, photoURL?: string}>;
}

interface CompanyData {
  id: string;
  name: string;
  structureId: string;
}

interface User {
  id: string;
  displayName: string;
}

type CompanyOption = CompanyData & { inputValue?: string };

const MissionForm: React.FC<MissionFormProps> = ({ onSubmit, onCancel, initialData, availableCharges = [] }) => {
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState<MissionFormData>({
    number: initialData?.number || '',
    companyId: initialData?.companyId || '',
    companyName: initialData?.companyName || '',
    location: initialData?.location || '',
    missionType: initialData?.missionType || '',
    assignees: initialData?.assignees || [],
    date: initialData?.date || null,
    endDate: initialData?.endDate || null,
    hours: initialData?.hours || 0,
    studentCount: initialData?.studentCount || 0,
    description: initialData?.description || '',
    priceHT: initialData?.priceHT || 17.5,
    salary: initialData?.salary || '10',
    chargeId: initialData?.chargeId || currentUser?.uid || '',
    chargeName: initialData?.chargeName || currentUser?.displayName || ''
  });
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCompany, setNewCompany] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  const filter = createFilterOptions<CompanyOption>();

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;

      try {
        setLoading(true);
        
        // Récupération des entreprises
        const userStatus = currentUser?.status || 'user';
        const userStructureId = currentUser?.structureId;

        console.log("=== DEBUG MISSIONFORM ===");
        console.log("Current user:", currentUser);
        console.log("User status:", userStatus);
        console.log("User structureId:", userStructureId);
        console.log("Current user structureId:", currentUser?.structureId);

        if (!userStructureId) {
          console.error("StructureId non trouvé pour l'utilisateur");
          return;
        }

        const companiesRef = collection(db, 'companies');
        let companiesQuery;

        // Pour le moment, on force le filtrage par structure pour tous les utilisateurs
        // sauf si on veut explicitement voir toutes les entreprises (cas spécial)
        if (userStatus === 'superadmin' && false) { // Désactivé temporairement
          console.log("Utilisateur superadmin - récupération de toutes les entreprises");
          companiesQuery = query(companiesRef);
        } else {
          console.log("Utilisateur normal - filtrage par structureId:", userStructureId);
          companiesQuery = query(
            companiesRef,
            where('structureId', '==', userStructureId)
          );
        }

        const companiesSnapshot = await getDocs(companiesQuery);
        console.log("Nombre d'entreprises trouvées:", companiesSnapshot.docs.length);
        
        const companiesList = companiesSnapshot.docs.map(doc => {
          const data = doc.data() as CompanyData;
          console.log("Entreprise:", { id: doc.id, name: data.name, structureId: data.structureId });
          return {
            id: doc.id,
            name: data.name,
            structureId: data.structureId
          };
        });

        console.log("Liste finale des entreprises:", companiesList);

        // Vérifier si l'entreprise sélectionnée appartient à la structure de l'utilisateur
        if (formData.companyId && formData.companyId !== 'new') {
          const selectedCompany = companiesList.find(c => c.id === formData.companyId);
          if (!selectedCompany) {
            // Si l'entreprise sélectionnée n'appartient pas à la structure, réinitialiser la sélection
            setFormData(prev => ({
              ...prev,
              companyId: '',
              companyName: ''
            }));
          }
        }

        setCompanies(companiesList);
      } catch (error) {
        console.error("Erreur lors du chargement des données:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Activer l'affichage des erreurs
    setShowErrors(true);
    
    // Vérifier si le numéro de mission est renseigné
    if (!formData.number.trim()) {
      alert("Le numéro de mission est obligatoire");
      return;
    }
    
    // Vérifier si une entreprise est sélectionnée
    if (!formData.companyId) {
      alert("Veuillez sélectionner une entreprise");
      return;
    }
    
    // Si l'utilisateur a sélectionné "Ajouter une nouvelle entreprise" mais n'a pas encore cliqué sur "Ajouter"
    if (formData.companyId === 'new' && newCompany.trim()) {
      try {
        setLoading(true);
        
        // Récupérer les informations de l'utilisateur pour obtenir la structureId
        const userDoc = await getDoc(doc(db, 'users', currentUser?.uid || ''));
        if (!userDoc.exists()) return;
        
        const userData = userDoc.data() as { status: string; structureId: string };
        const userStructureId = userData?.structureId;
        
        // Créer une nouvelle entreprise dans la base de données
        const newCompanyData = {
          name: newCompany.trim(),
          structureId: userStructureId,
          createdAt: new Date(),
          createdBy: currentUser?.uid || ''
        };
        
        const docRef = await addDoc(collection(db, 'companies'), newCompanyData);
        
        // Mettre à jour le formulaire avec la nouvelle entreprise
        formData.companyId = docRef.id;
        formData.companyName = newCompany.trim();
        
      } catch (error) {
        console.error("Erreur lors de l'ajout de l'entreprise:", error);
        alert("Une erreur est survenue lors de l'ajout de l'entreprise");
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }
    
    // S'assurer que les valeurs par défaut sont incluses
    const submissionData = {
      ...formData,
      priceHT: formData.priceHT || 17.5,
      salary: formData.salary || '10',
      chargeId: currentUser?.uid || '',
      chargeName: currentUser?.displayName || ''
    };
    
    onSubmit(submissionData);
  };

  const handleNewCompanySubmit = async () => {
    if (!newCompany.trim() || !currentUser) return;
    
    try {
      setLoading(true);
      
      // Récupérer les informations de l'utilisateur pour obtenir la structureId
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!userDoc.exists()) return;
      
      const userData = userDoc.data() as { status: string; structureId: string };
      const userStructureId = userData?.structureId;
      
      // Créer une nouvelle entreprise dans la base de données
      const newCompanyData = {
        name: newCompany.trim(),
        structureId: userStructureId,
        createdAt: new Date(),
        createdBy: currentUser.uid
      };
      
      const companyRef = await addDoc(collection(db, 'companies'), newCompanyData);
      
      // Mettre à jour l'état local avec la nouvelle entreprise
      const newCompanyObj: CompanyData = {
        id: companyRef.id,
        name: newCompany.trim(),
        structureId: userStructureId
      };
      
      setCompanies([...companies, newCompanyObj]);
      
      // Mettre à jour le formulaire avec la nouvelle entreprise
      setFormData({
        ...formData,
        companyId: companyRef.id,
        companyName: newCompany.trim()
      });
      
      // Réinitialiser le champ de nouvelle entreprise
      setNewCompany('');
      
    } catch (error) {
      console.error("Erreur lors de l'ajout de l'entreprise:", error);
      alert("Une erreur est survenue lors de l'ajout de l'entreprise");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box 
      sx={{ 
        p: 4, 
        borderRadius: 3,
        backgroundColor: '#ffffff',
        boxShadow: '0 2px 20px rgba(0,0,0,0.08)',
        maxWidth: '600px',
        margin: '0 auto'
      }}
    >
      <Typography 
        variant="h5" 
        sx={{ 
          mb: 4, 
          fontWeight: 600, 
          color: '#1d1d1f',
          textAlign: 'center'
        }}
      >
        Nouvelle Étude
      </Typography>
      
      <Box component="form" onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Numéro de mission - OBLIGATOIRE */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Numéro de mission *"
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: e.target.value })}
              variant="outlined"
              required
              error={showErrors && !formData.number.trim()}
              helperText={showErrors && !formData.number.trim() ? "Le numéro de mission est obligatoire" : ""}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: '#f5f5f7',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: '#f0f0f2',
                  },
                  '&.Mui-focused': {
                    backgroundColor: '#ffffff',
                    boxShadow: '0 0 0 2px #0071e3',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#86868b',
                },
              }}
            />
          </Grid>

          {/* Entreprise - OBLIGATOIRE */}
          <Grid item xs={12}>
            <Autocomplete
              value={
                companies.find(c => c.id === formData.companyId) as CompanyOption ||
                (formData.companyId === 'new' && newCompany ? { id: 'new', name: newCompany, structureId: '' } : null)
              }
              onChange={(event, newValue) => {
                if (typeof newValue === 'string') {
                  setNewCompany(newValue);
                  setFormData({ ...formData, companyId: 'new', companyName: newValue });
                } else if (newValue && (newValue as CompanyOption).inputValue) {
                  setNewCompany((newValue as CompanyOption).inputValue!);
                  setFormData({ ...formData, companyId: 'new', companyName: (newValue as CompanyOption).inputValue! });
                } else if (newValue) {
                  setFormData({ ...formData, companyId: newValue.id, companyName: newValue.name });
                  setNewCompany('');
                } else {
                  setFormData({ ...formData, companyId: '', companyName: '' });
                  setNewCompany('');
                }
              }}
              filterOptions={(options, params) => {
                const filtered = filter(options, params);
                if (
                  params.inputValue !== '' &&
                  !options.some(opt => opt.name.toLowerCase() === params.inputValue.toLowerCase())
                ) {
                  filtered.push({
                    inputValue: params.inputValue,
                    id: 'new',
                    name: `Ajouter "${params.inputValue}"`,
                    structureId: ''
                  } as CompanyOption);
                }
                return filtered;
              }}
              selectOnFocus
              clearOnBlur
              handleHomeEndKeys
              options={companies as CompanyOption[]}
              getOptionLabel={(option) => {
                if (typeof option === 'string') {
                  return option;
                }
                const opt = option as CompanyOption;
                if (opt.inputValue) {
                  return opt.inputValue;
                }
                return opt.name;
              }}
              renderOption={(props, option) => <li {...props}>{option.name}</li>}
              freeSolo
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Entreprise *"
                  variant="outlined"
                  required
                  error={showErrors && !formData.companyId}
                  helperText={showErrors && !formData.companyId ? "Veuillez sélectionner une entreprise" : ""}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      backgroundColor: '#f5f5f7',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        backgroundColor: '#f0f0f2',
                      },
                      '&.Mui-focused': {
                        backgroundColor: '#ffffff',
                        boxShadow: '0 0 0 2px #0071e3',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: '#86868b',
                    },
                  }}
                />
              )}
            />
            {formData.companyId === 'new' && newCompany && (
              <Button
                variant="contained"
                onClick={handleNewCompanySubmit}
                sx={{ mt: 1 }}
              >
                Ajouter l'entreprise "{newCompany}"
              </Button>
            )}
          </Grid>

          {/* Chargé d'étude - OPTIONNEL */}
          <Grid item xs={12}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Chargé d'étude</InputLabel>
              <Select
                value={formData.chargeId}
                label="Chargé d'étude"
                onChange={(e) => {
                  const selectedUser = availableCharges.find(user => user.id === e.target.value);
                  setFormData({ 
                    ...formData, 
                    chargeId: e.target.value,
                    chargeName: selectedUser?.displayName || ''
                  });
                }}
                sx={{
                  borderRadius: 2,
                  backgroundColor: '#f5f5f7',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: '#f0f0f2',
                  },
                  '&.Mui-focused': {
                    backgroundColor: '#ffffff',
                    boxShadow: '0 0 0 2px #0071e3',
                  },
                }}
              >
                {availableCharges.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.displayName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          {/* Description - OPTIONNEL */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: '#f5f5f7',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: '#f0f0f2',
                  },
                  '&.Mui-focused': {
                    backgroundColor: '#ffffff',
                    boxShadow: '0 0 0 2px #0071e3',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#86868b',
                },
              }}
            />
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button 
            onClick={onCancel}
            sx={{ 
              color: '#86868b',
              textTransform: 'none',
              fontWeight: 500,
              '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.04)',
              },
            }}
          >
            Annuler
          </Button>
          <Button 
            type="submit" 
            variant="contained" 
            sx={{ 
              backgroundColor: '#0071e3',
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500,
              padding: '8px 24px',
              '&:hover': {
                backgroundColor: '#0077ed',
              },
            }}
          >
            Créer l'étude
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default MissionForm; 