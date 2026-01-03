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
  CircularProgress,
  InputAdornment
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Description as DescriptionIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { collection, getDocs, query, where, doc, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
// Storage sera utilisé pour l'upload de documents (à implémenter si nécessaire)
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

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
  const { currentUser, userData } = useAuth();
  const isEntreprise = userData?.status === 'entreprise';
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
  const [creatingCompany, setCreatingCompany] = useState(false);
  
  // États pour les entreprises (champs supplémentaires)
  const [locationType, setLocationType] = useState<'presentiel' | 'distanciel' | 'mixte'>('presentiel');
  const [address, setAddress] = useState('');
  const [duration, setDuration] = useState('');
  const [uploadedDocuments, setUploadedDocuments] = useState<File[]>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);

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

  // Mettre à jour le numéro de mission quand initialData change
  useEffect(() => {
    if (initialData?.number) {
      setFormData(prev => ({
        ...prev,
        number: initialData.number
      }));
    }
  }, [initialData?.number]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Activer l'affichage des erreurs
    setShowErrors(true);
    
    // Vérifier si le numéro de mission est renseigné
    if (!formData.number.trim()) {
      alert("Le numéro de mission est obligatoire");
      return;
    }
    
    // Attendre si une entreprise est en cours de création
    if (creatingCompany) {
      return;
    }
    
    // Si l'entreprise n'est pas sélectionnée ou est marquée comme "new", créer l'entreprise
    let finalCompanyId = formData.companyId;
    let finalCompanyName = formData.companyName;
    
    if (!finalCompanyId || finalCompanyId === 'new') {
      // Vérifier qu'un nom d'entreprise a été fourni
      if (!finalCompanyName || !finalCompanyName.trim()) {
        alert("Veuillez sélectionner ou créer une entreprise");
        return;
      }
      
      // Créer automatiquement l'entreprise
      if (currentUser && finalCompanyName.trim()) {
        try {
          setCreatingCompany(true);
          
          // Récupérer les informations de l'utilisateur
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (!userDoc.exists()) {
            alert("Erreur: Impossible de récupérer les informations utilisateur");
            setCreatingCompany(false);
            return;
          }
          
          const userData = userDoc.data() as { status: string; structureId: string };
          const userStructureId = userData?.structureId;
          
          if (!userStructureId) {
            alert("Erreur: Aucune structure associée à votre compte");
            setCreatingCompany(false);
            return;
          }
          
          // Vérifier si l'entreprise existe déjà
          const companiesRef = collection(db, 'companies');
          const companiesQuery = query(
            companiesRef,
            where('structureId', '==', userStructureId),
            where('name', '==', finalCompanyName.trim())
          );
          const existingCompanies = await getDocs(companiesQuery);
          
          if (!existingCompanies.empty) {
            // L'entreprise existe déjà, utiliser celle-ci
            const existingCompany = existingCompanies.docs[0];
            finalCompanyId = existingCompany.id;
            finalCompanyName = existingCompany.data().name;
          } else {
            // Créer l'entreprise
            const newCompanyData = {
              name: finalCompanyName.trim(),
              structureId: userStructureId,
              createdAt: new Date(),
              createdBy: currentUser.uid
            };
            
            const companyRef = await addDoc(collection(db, 'companies'), newCompanyData);
            finalCompanyId = companyRef.id;
            finalCompanyName = finalCompanyName.trim();
            
            // Mettre à jour la liste des entreprises
            const newCompanyObj: CompanyData = {
              id: companyRef.id,
              name: finalCompanyName,
              structureId: userStructureId
            };
            
            setCompanies(prev => [...prev, newCompanyObj]);
          }
          
          // Mettre à jour le formulaire avec la nouvelle entreprise
          setFormData(prev => ({ 
            ...prev, 
            companyId: finalCompanyId, 
            companyName: finalCompanyName 
          }));
          
        } catch (error) {
          console.error("Erreur lors de la création de l'entreprise:", error);
          alert("Erreur lors de la création de l'entreprise. Veuillez réessayer.");
          setCreatingCompany(false);
          return;
        } finally {
          setCreatingCompany(false);
        }
      } else {
        alert("Veuillez sélectionner ou créer une entreprise");
        return;
      }
    }
    
    // Vérifier que l'entreprise est bien sélectionnée après création
    if (!finalCompanyId || finalCompanyId === 'new') {
      alert("Erreur: Impossible de créer ou sélectionner l'entreprise");
      return;
    }
    
    // S'assurer que les valeurs par défaut sont incluses
    const submissionData = {
      ...formData,
      companyId: finalCompanyId,
      companyName: finalCompanyName,
      priceHT: formData.priceHT || 17.5,
      salary: formData.salary || '10',
      chargeId: currentUser?.uid || '',
      chargeName: currentUser?.displayName || ''
    };
    
    console.log("MissionForm - Données de soumission:", {
      companyId: submissionData.companyId,
      companyName: submissionData.companyName,
      number: submissionData.number
    });
    
    onSubmit(submissionData);
  };

  return (
    <Box 
      sx={{ 
        p: 3,
        backgroundColor: '#ffffff',
      }}
    >
      <Typography 
        variant="h5" 
        sx={{ 
          mb: 3, 
          fontWeight: 600, 
          color: '#1d1d1f',
        }}
      >
        Nouvelle mission
      </Typography>
      
      <Box component="form" onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Numéro de mission - OBLIGATOIRE (uniquement pour les Juniors) */}
          {!isEntreprise && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Numéro de mission *"
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                variant="outlined"
                required
                error={showErrors && !formData.number.trim()}
                helperText={showErrors && !formData.number.trim() ? "Le numéro de mission est obligatoire" : "Format: YYMMNN (ex: 250904)"}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AssignmentIcon sx={{ color: '#86868b' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          )}
          
          {/* Titre de la mission - OBLIGATOIRE pour les entreprises */}
          {isEntreprise && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Titre de la mission *"
                value={formData.number || ''}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                variant="outlined"
                required
                error={showErrors && !formData.number.trim()}
                helperText={showErrors && !formData.number.trim() ? "Le titre de la mission est obligatoire" : ""}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AssignmentIcon sx={{ color: '#86868b' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          )}

          {/* Entreprise - OBLIGATOIRE */}
          <Grid item xs={12}>
            <Autocomplete
              value={
                formData.companyId && formData.companyId !== 'new'
                  ? (companies.find(c => c.id === formData.companyId) as CompanyOption || null)
                  : formData.companyName
                    ? ({ id: 'new', name: formData.companyName, structureId: '' } as CompanyOption)
                    : null
              }
              onChange={async (event, newValue) => {
                if (typeof newValue === 'string') {
                  // Cas d'une saisie libre (freeSolo)
                  setNewCompany(newValue);
                  // Vérifier si l'entreprise existe déjà dans la liste
                  const existingCompany = companies.find(c => c.name.toLowerCase() === newValue.toLowerCase());
                  if (existingCompany) {
                    setFormData({ ...formData, companyId: existingCompany.id, companyName: existingCompany.name });
                  } else {
                    setFormData({ ...formData, companyId: 'new', companyName: newValue });
                  }
                } else if (newValue && (newValue as CompanyOption).inputValue) {
                  // Cas où l'utilisateur sélectionne "Ajouter [nom]"
                  const companyName = (newValue as CompanyOption).inputValue!;
                  setNewCompany(companyName);
                  
                  // Créer automatiquement l'entreprise
                  if (currentUser && companyName.trim()) {
                    try {
                      setCreatingCompany(true);
                      
                      // Récupérer les informations de l'utilisateur
                      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                      if (!userDoc.exists()) {
                        setCreatingCompany(false);
                        return;
                      }
                      
                      const userData = userDoc.data() as { status: string; structureId: string };
                      const userStructureId = userData?.structureId;
                      
                      if (!userStructureId) {
                        setCreatingCompany(false);
                        return;
                      }
                      
                      // Créer l'entreprise
                      const newCompanyData = {
                        name: companyName.trim(),
                        structureId: userStructureId,
                        createdAt: new Date(),
                        createdBy: currentUser.uid
                      };
                      
                      const companyRef = await addDoc(collection(db, 'companies'), newCompanyData);
                      
                      // Mettre à jour la liste des entreprises
                      const newCompanyObj: CompanyData = {
                        id: companyRef.id,
                        name: companyName.trim(),
                        structureId: userStructureId
                      };
                      
                      setCompanies(prev => [...prev, newCompanyObj]);
                      
                      // Mettre à jour le formulaire avec la nouvelle entreprise
                      setFormData({ 
                        ...formData, 
                        companyId: companyRef.id, 
                        companyName: companyName.trim() 
                      });
                      setNewCompany('');
                      
                    } catch (error) {
                      console.error("Erreur lors de la création de l'entreprise:", error);
                      // En cas d'erreur, laisser l'option "new" pour permettre de réessayer
                      setFormData({ ...formData, companyId: 'new', companyName: companyName });
                    } finally {
                      setCreatingCompany(false);
                    }
                  }
                } else if (newValue && !(newValue as CompanyOption).inputValue) {
                  // Cas d'une entreprise existante
                  setFormData({ ...formData, companyId: newValue.id, companyName: newValue.name });
                  setNewCompany('');
                } else {
                  // Cas de désélection
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
              onInputChange={(event, newInputValue) => {
                // Mettre à jour le nom de l'entreprise quand l'utilisateur tape
                if (newInputValue && newInputValue !== formData.companyName) {
                  // Vérifier si l'entreprise existe déjà dans la liste
                  const existingCompany = companies.find(c => c.name.toLowerCase() === newInputValue.toLowerCase());
                  if (existingCompany) {
                    setFormData(prev => ({ 
                      ...prev, 
                      companyId: existingCompany.id, 
                      companyName: existingCompany.name 
                    }));
                  } else {
                    setFormData(prev => ({ 
                      ...prev, 
                      companyId: 'new', 
                      companyName: newInputValue 
                    }));
                  }
                  setNewCompany(newInputValue);
                }
              }}
              selectOnFocus
              clearOnBlur
              handleHomeEndKeys
              options={companies as CompanyOption[]}
              loading={loading}
              disabled={creatingCompany}
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
              renderOption={(props, option) => {
                const isNewCompany = !!(option as CompanyOption).inputValue;
                const companyName = isNewCompany 
                  ? (option as CompanyOption).inputValue || ''
                  : option.name;
                
                return (
                  <li {...props} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px' }}>
                    {isNewCompany ? (
                      <>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '8px',
                            backgroundColor: '#0071e3',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <AddIcon sx={{ color: '#ffffff', fontSize: 20 }} />
                        </Box>
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 600, color: '#1d1d1f' }}>
                            Créer "{companyName}"
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#86868b' }}>
                            Nouvelle entreprise
                          </Typography>
                        </Box>
                      </>
                    ) : (
                      <>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '8px',
                            backgroundColor: '#f5f5f7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <BusinessIcon sx={{ color: '#86868b', fontSize: 20 }} />
                        </Box>
                        <Typography variant="body1" sx={{ color: '#1d1d1f' }}>{option.name}</Typography>
                      </>
                    )}
                  </li>
                );
              }}
              freeSolo
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Entreprise *"
                  variant="outlined"
                  required
                  error={showErrors && !formData.companyId}
                  helperText={
                    creatingCompany 
                      ? "Création de l'entreprise en cours..." 
                      : showErrors && !formData.companyId 
                        ? "Veuillez sélectionner ou créer une entreprise" 
                        : "Tapez pour rechercher ou créez une nouvelle entreprise"
                  }
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <InputAdornment position="start">
                          {creatingCompany ? (
                            <CircularProgress size={20} />
                          ) : (
                            <BusinessIcon sx={{ color: '#86868b' }} />
                          )}
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>

          {/* Chargé d'étude - OPTIONNEL (uniquement pour les Juniors) */}
          {!isEntreprise && (
            <Grid item xs={12}>
              <TextField
              fullWidth
              select
              label="Chargé d'étude"
              value={formData.chargeId}
              onChange={(e) => {
                const selectedUser = availableCharges.find(user => user.id === e.target.value);
                setFormData({ 
                  ...formData, 
                  chargeId: e.target.value,
                  chargeName: selectedUser?.displayName || ''
                });
              }}
              SelectProps={{
                native: false,
                renderValue: (value) => {
                  const selectedUser = availableCharges.find(user => user.id === value);
                  return selectedUser?.displayName || '';
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon sx={{ color: '#86868b' }} />
                  </InputAdornment>
                ),
              }}
            >
              {availableCharges.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {user.photoURL ? (
                      <Box
                        component="img"
                        src={user.photoURL}
                        alt={user.displayName}
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          backgroundColor: '#0071e3',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {user.displayName.charAt(0).toUpperCase()}
                      </Box>
                    )}
                    <Typography>{user.displayName}</Typography>
                  </Box>
                </MenuItem>
              ))}
              </TextField>
            </Grid>
          )}
          
          {/* Champs spécifiques aux entreprises */}
          {isEntreprise && (
            <>
              {/* Lieu */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Lieu *</InputLabel>
                  <Select
                    value={locationType}
                    label="Lieu *"
                    onChange={(e) => setLocationType(e.target.value as 'presentiel' | 'distanciel' | 'mixte')}
                    required
                  >
                    <MenuItem value="presentiel">Présentiel</MenuItem>
                    <MenuItem value="distanciel">Distanciel</MenuItem>
                    <MenuItem value="mixte">Mixte</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              {(locationType === 'presentiel' || locationType === 'mixte') && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Adresse précise"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    variant="outlined"
                    placeholder="Adresse complète si présentiel"
                  />
                </Grid>
              )}
              
              {/* Nombre d'étudiants */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Nombre d'étudiants recherchés *"
                  value={formData.studentCount}
                  onChange={(e) => setFormData({ ...formData, studentCount: parseInt(e.target.value) || 0 })}
                  variant="outlined"
                  required
                  inputProps={{ min: 1 }}
                />
              </Grid>
              
              {/* Dates */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Date de début *"
                  value={formData.date ? new Date(formData.date).toISOString().split('T')[0] : ''}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value ? new Date(e.target.value) : null })}
                  variant="outlined"
                  required
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Date de fin *"
                  value={formData.endDate ? new Date(formData.endDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value ? new Date(e.target.value) : null })}
                  variant="outlined"
                  required
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Durée estimée"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  variant="outlined"
                  placeholder="Ex: 3 mois, 6 semaines..."
                  helperText="Durée estimée de la mission"
                />
              </Grid>
              
              {/* Upload de documents */}
              <Grid item xs={12}>
                <Box sx={{ border: '2px dashed #d1d1d6', borderRadius: '8px', p: 3, textAlign: 'center' }}>
                  <CloudUploadIcon sx={{ fontSize: 48, color: '#86868b', mb: 2 }} />
                  <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
                    Cahier des charges et annexes
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Formats acceptés: PDF, Word (.doc, .docx). Taille max: 10MB par fichier.
                  </Typography>
                  <input
                    accept=".pdf,.doc,.docx"
                    style={{ display: 'none' }}
                    id="mission-documents-upload"
                    multiple
                    type="file"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      const validFiles = files.filter(file => {
                        const isValidType = file.type === 'application/pdf' || 
                                          file.type === 'application/msword' ||
                                          file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                        const isValidSize = file.size <= 10 * 1024 * 1024;
                        return isValidType && isValidSize;
                      });
                      setUploadedDocuments(prev => [...prev, ...validFiles]);
                    }}
                  />
                  <label htmlFor="mission-documents-upload">
                    <Button variant="outlined" component="span" startIcon={<CloudUploadIcon />}>
                      Sélectionner des fichiers
                    </Button>
                  </label>
                  {uploadedDocuments.length > 0 && (
                    <Box sx={{ mt: 2, textAlign: 'left' }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Fichiers sélectionnés:</Typography>
                      {uploadedDocuments.map((file, idx) => (
                        <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="body2">{file.name}</Typography>
                          <Button size="small" onClick={() => {
                            setUploadedDocuments(prev => prev.filter((_, i) => i !== idx));
                          }}>
                            Supprimer
                          </Button>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              </Grid>
            </>
          )}
          
          {/* Description - OBLIGATOIRE pour les entreprises */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={isEntreprise ? 6 : 4}
              label={isEntreprise ? "Description détaillée (Cahier des charges) *" : "Description"}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              variant="outlined"
              required={isEntreprise}
              placeholder={isEntreprise ? "Décrivez en détail votre besoin, les objectifs, les compétences requises, les livrables attendus..." : "Décrivez la mission, les objectifs, les compétences requises..."}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <DescriptionIcon sx={{ color: '#86868b' }} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
        </Grid>
        
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: 2,
          mt: 3
        }}>
          <Button 
            onClick={onCancel}
            disabled={loading || creatingCompany}
          >
            Annuler
          </Button>
          <Button 
            type="submit" 
            variant="contained" 
            disabled={loading || creatingCompany}
            startIcon={loading || creatingCompany ? <CircularProgress size={16} sx={{ color: '#ffffff' }} /> : null}
          >
            {creatingCompany ? 'Création...' : loading ? 'Création...' : 'Créer la mission'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default MissionForm; 