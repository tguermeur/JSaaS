import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  FormControl,
  Select,
  MenuItem,
  Typography,
  CircularProgress,
  Avatar,
  IconButton,
  Divider,
} from '@mui/material';
import {
  WorkOutline as WorkOutlineIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  Add as AddIcon,
  Business as BusinessIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import { tokens } from '../../theme/tokens';
import UserNameText from '../common/UserNameText';
import { getSafeDisplayName } from '../../utils/decryptUserUtils';

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
  availableCharges?: Array<{ id: string; displayName: string; photoURL?: string }>;
  /** Titre du dialog (ex. « Nouvelle étude ») */
  title?: string;
  /** Sous-titre sous le titre */
  subtitle?: string;
  /** Label du bouton principal */
  submitLabel?: string;
}

interface CompanyData {
  id: string;
  name: string;
  structureId: string;
}

type CompanyOption = CompanyData & { inputValue?: string };

const INPUT_H = 40;

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    height: INPUT_H,
    minHeight: INPUT_H,
    boxSizing: 'border-box',
    borderRadius: tokens.radius.md,
    bgcolor: tokens.colors.bgPaper,
    fontSize: 14,
    alignItems: 'center',
    justifyContent: 'flex-start',
    '& fieldset': { borderColor: tokens.colors.borderDefault },
    '&:hover fieldset': { borderColor: tokens.colors.gray300 },
    '&.Mui-focused fieldset': { borderColor: tokens.colors.brandNavy, borderWidth: 1.5 },
    '&.MuiAutocomplete-inputRoot': {
      paddingTop: '0 !important',
      paddingBottom: '0 !important',
      paddingLeft: '12px !important',
      paddingRight: '8px !important',
      justifyContent: 'flex-start',
      '& .MuiAutocomplete-input': {
        flex: '1 1 auto',
        width: '100% !important',
        minWidth: 0,
        height: 'auto',
        minHeight: 0,
        padding: '0 !important',
        margin: 0,
        lineHeight: `${INPUT_H}px`,
        textAlign: 'left',
      },
    },
  },
  '& .MuiInputBase-input': {
    py: 0,
    px: 1.5,
    boxSizing: 'border-box',
    textAlign: 'left',
    '&::placeholder': { color: tokens.colors.textTertiary, opacity: 1 },
  },
  '& .MuiFormHelperText-root': { mx: 0.25, mt: 0.5 },
};

const selectSx = {
  height: INPUT_H,
  minHeight: INPUT_H,
  boxSizing: 'border-box',
  borderRadius: tokens.radius.md,
  fontSize: 14,
  bgcolor: tokens.colors.bgPaper,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.colors.borderDefault },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: tokens.colors.gray300 },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: tokens.colors.brandNavy,
    borderWidth: 1.5,
  },
  '& .MuiSelect-select': {
    py: 0,
    height: INPUT_H,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
  },
};

const FieldLabel: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required }) => (
  <Typography
    component="label"
    sx={{
      display: 'block',
      fontSize: 13,
      fontWeight: 600,
      color: tokens.colors.gray700,
      mb: 0.75,
    }}
  >
    {children}
    {required && (
      <Box component="span" sx={{ color: tokens.colors.error, ml: 0.25 }}>
        *
      </Box>
    )}
  </Typography>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    sx={{
      ...tokens.typography.eyebrow,
      color: tokens.colors.textTertiary,
      mb: 1.75,
      mt: 0.5,
    }}
  >
    {children}
  </Typography>
);

const MissionForm: React.FC<MissionFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
  availableCharges = [],
  title = 'Nouvelle mission',
  subtitle = 'Renseignez les informations pour ouvrir une nouvelle mission.',
  submitLabel = 'Créer la mission',
}) => {
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
    chargeName: initialData?.chargeName || getSafeDisplayName(userData),
  });
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [locationType, setLocationType] = useState<'presentiel' | 'distanciel' | 'mixte'>('presentiel');
  const [address, setAddress] = useState('');
  const [duration, setDuration] = useState('');
  const [uploadedDocuments, setUploadedDocuments] = useState<File[]>([]);

  const filter = createFilterOptions<CompanyOption>();
  const structureId = userData?.structureId as string | undefined;

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser || !structureId) return;

      try {
        setLoading(true);
        const companiesSnapshot = await getDocs(
          query(collection(db, 'companies'), where('structureId', '==', structureId))
        );

        const companiesList = companiesSnapshot.docs.map((d) => {
          const data = d.data() as CompanyData;
          return { id: d.id, name: data.name, structureId: data.structureId };
        });

        if (formData.companyId && formData.companyId !== 'new') {
          const selectedCompany = companiesList.find((c) => c.id === formData.companyId);
          if (!selectedCompany) {
            setFormData((prev) => ({ ...prev, companyId: '', companyName: '' }));
          }
        }

        setCompanies(companiesList);
      } catch (error) {
        console.error("Erreur lors du chargement des données:", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, structureId]);

  useEffect(() => {
    if (initialData?.number) {
      setFormData((prev) => ({ ...prev, number: initialData.number! }));
    }
  }, [initialData?.number]);

  const ensureCompany = async (): Promise<{ id: string; name: string } | null> => {
    let finalCompanyId = formData.companyId;
    let finalCompanyName = formData.companyName;

    if (finalCompanyId && finalCompanyId !== 'new') {
      return { id: finalCompanyId, name: finalCompanyName };
    }

    if (!finalCompanyName?.trim() || !currentUser || !structureId) return null;

    setCreatingCompany(true);
    try {
      const companiesQuery = query(
        collection(db, 'companies'),
        where('structureId', '==', structureId),
        where('name', '==', finalCompanyName.trim())
      );
      const existingCompanies = await getDocs(companiesQuery);

      if (!existingCompanies.empty) {
        const existingCompany = existingCompanies.docs[0];
        finalCompanyId = existingCompany.id;
        finalCompanyName = existingCompany.data().name;
      } else {
        const companyRef = await addDoc(collection(db, 'companies'), {
          name: finalCompanyName.trim(),
          structureId,
          createdAt: new Date(),
          createdBy: currentUser.uid,
        });
        finalCompanyId = companyRef.id;
        finalCompanyName = finalCompanyName.trim();
        setCompanies((prev) => [
          ...prev,
          { id: companyRef.id, name: finalCompanyName, structureId },
        ]);
      }

      setFormData((prev) => ({
        ...prev,
        companyId: finalCompanyId,
        companyName: finalCompanyName,
      }));
      return { id: finalCompanyId, name: finalCompanyName };
    } catch (error) {
      console.error("Erreur lors de la création de l'entreprise:", error);
      return null;
    } finally {
      setCreatingCompany(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(true);

    if (!formData.number.trim()) return;
    if (creatingCompany) return;

    const company = await ensureCompany();
    if (!company) return;

    const selectedCharge = availableCharges.find((c) => c.id === formData.chargeId);

    onSubmit({
      ...formData,
      companyId: company.id,
      companyName: company.name,
      priceHT: formData.priceHT || 17.5,
      salary: formData.salary || '10',
      chargeId: formData.chargeId || currentUser?.uid || '',
      chargeName: selectedCharge
        ? getSafeDisplayName(selectedCharge)
        : formData.chargeName || getSafeDisplayName(userData),
      location: isEntreprise
        ? locationType === 'distanciel'
          ? 'Distanciel'
          : address || locationType
        : formData.location,
    });
  };

  const companyValue: CompanyOption | null =
    formData.companyId && formData.companyId !== 'new'
      ? (companies.find((c) => c.id === formData.companyId) as CompanyOption) || null
      : formData.companyName
        ? ({ id: 'new', name: formData.companyName, structureId: '' } as CompanyOption)
        : null;

  const selectedCharge = availableCharges.find((u) => u.id === formData.chargeId);
  const busy = loading || creatingCompany;

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        bgcolor: tokens.colors.bgPaper,
        maxHeight: 'min(86vh, 820px)',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.75,
          px: { xs: 2.5, sm: 3.5 },
          pt: 3,
          pb: 2.5,
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: tokens.radius.lg,
            bgcolor: 'rgba(23, 59, 108, 0.08)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <WorkOutlineIcon sx={{ color: tokens.colors.brandNavy, fontSize: 22 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, pt: 0.25 }}>
          <Typography
            sx={{
              fontSize: 20,
              fontWeight: 700,
              color: tokens.colors.ink,
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
            }}
          >
            {title}
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: 13.5, color: tokens.colors.inkMuted, lineHeight: 1.45 }}>
            {subtitle}
          </Typography>
        </Box>
        <IconButton
          onClick={onCancel}
          size="small"
          aria-label="Fermer"
          sx={{
            color: tokens.colors.textTertiary,
            mt: -0.25,
            '&:hover': { bgcolor: tokens.colors.gray100, color: tokens.colors.textPrimary },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Body */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: { xs: 2.5, sm: 3.5 },
          pb: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 2.75,
        }}
      >
        <Box>
          <SectionLabel>Informations générales</SectionLabel>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <FieldLabel required>{isEntreprise ? 'Titre de la mission' : 'Numéro de mission'}</FieldLabel>
              <TextField
                fullWidth
                size="small"
                placeholder={isEntreprise ? 'Étude de marché — nouveau segment' : 'YYMMNN'}
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                error={showErrors && !formData.number.trim()}
                helperText={
                  showErrors && !formData.number.trim()
                    ? 'Champ obligatoire'
                    : !isEntreprise
                      ? 'Format YYMMNN (ex. 250904)'
                      : undefined
                }
                sx={fieldSx}
              />
            </Box>

            {!isEntreprise ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
                }}
              >
                <Box>
                  <FieldLabel required>Client / Entreprise</FieldLabel>
                  <Autocomplete
                    value={companyValue}
                    onChange={(_event, newValue) => {
                      if (typeof newValue === 'string') {
                        const name = newValue.trim();
                        if (!name) {
                          setFormData((prev) => ({ ...prev, companyId: '', companyName: '' }));
                          return;
                        }
                        const existing = companies.find((c) => c.name.toLowerCase() === name.toLowerCase());
                        setFormData((prev) =>
                          existing
                            ? { ...prev, companyId: existing.id, companyName: existing.name }
                            : { ...prev, companyId: 'new', companyName: name }
                        );
                      } else if (newValue?.inputValue) {
                        // Option « Créer une entreprise » du menu
                        setFormData((prev) => ({
                          ...prev,
                          companyId: 'new',
                          companyName: newValue.inputValue!.trim(),
                        }));
                      } else if (newValue) {
                        setFormData((prev) => ({
                          ...prev,
                          companyId: newValue.id,
                          companyName: newValue.name,
                        }));
                      } else {
                        setFormData((prev) => ({ ...prev, companyId: '', companyName: '' }));
                      }
                    }}
                    filterOptions={(options, params) => {
                      const filtered = filter(options, params);
                      const input = params.inputValue.trim();
                      if (
                        input !== '' &&
                        !options.some((opt) => opt.name.toLowerCase() === input.toLowerCase())
                      ) {
                        filtered.push({
                          inputValue: input,
                          id: `new:${input}`,
                          name: input,
                          structureId: '',
                        });
                      }
                      return filtered;
                    }}
                    selectOnFocus
                    clearOnBlur={false}
                    handleHomeEndKeys
                    blurOnSelect
                    options={companies as CompanyOption[]}
                    loading={loading}
                    disabled={creatingCompany}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    getOptionLabel={(option) => {
                      if (typeof option === 'string') return option;
                      // Afficher le nom saisi, pas le libellé « Créer… »
                      return option.inputValue ? option.inputValue : option.name;
                    }}
                    renderOption={(props, option) => {
                      const { key, ...optionProps } = props as typeof props & { key?: React.Key };
                      const isNew = !!option.inputValue;
                      const name = isNew ? option.inputValue || '' : option.name;
                      return (
                        <li key={key ?? option.id} {...optionProps}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 0.25, width: '100%' }}>
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: tokens.radius.sm,
                                bgcolor: isNew ? tokens.colors.brandNavy : tokens.colors.bgSubtle,
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {isNew ? (
                                <AddIcon sx={{ color: '#fff', fontSize: 18 }} />
                              ) : (
                                <BusinessIcon sx={{ color: tokens.colors.textSecondary, fontSize: 18 }} />
                              )}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontSize: 14, fontWeight: isNew ? 600 : 500 }}>
                                {isNew ? `Créer « ${name} »` : name}
                              </Typography>
                              {isNew && (
                                <Typography sx={{ fontSize: 12, color: tokens.colors.textSecondary }}>
                                  Nouvelle entreprise
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </li>
                      );
                    }}
                    freeSolo
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        placeholder="Decathlon"
                        error={showErrors && !formData.companyId && !formData.companyName.trim()}
                        helperText={
                          showErrors && !formData.companyId && !formData.companyName.trim()
                            ? 'Sélectionnez ou créez une entreprise'
                            : formData.companyId === 'new' && formData.companyName
                              ? `Sera créée à l'enregistrement : ${formData.companyName}`
                              : undefined
                        }
                        sx={fieldSx}
                      />
                    )}
                  />
                </Box>

                <Box>
                  <FieldLabel>Chargé de mission</FieldLabel>
                  <FormControl fullWidth size="small">
                    <Select
                      displayEmpty
                      value={formData.chargeId || ''}
                      onChange={(e) => {
                        const selected = availableCharges.find((u) => u.id === e.target.value);
                        setFormData({
                          ...formData,
                          chargeId: e.target.value,
                          chargeName: getSafeDisplayName(selected),
                        });
                      }}
                      renderValue={() => {
                        if (!selectedCharge) {
                          return (
                            <Typography sx={{ color: tokens.colors.textTertiary, fontSize: 14, lineHeight: 1 }}>
                              Sélectionner…
                            </Typography>
                          );
                        }
                        return (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                            <Avatar
                              src={selectedCharge.photoURL || undefined}
                              sx={{
                                width: 22,
                                height: 22,
                                fontSize: 10,
                                bgcolor: tokens.colors.brandNavy,
                              }}
                            >
                              {selectedCharge.displayName?.charAt(0)?.toUpperCase()}
                            </Avatar>
                            <Typography
                              sx={{
                                fontSize: 14,
                                fontWeight: 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {getSafeDisplayName(selectedCharge)}
                            </Typography>
                          </Box>
                        );
                      }}
                      sx={selectSx}
                    >
                      {availableCharges.length === 0 && (
                        <MenuItem disabled value="">
                          Aucun membre disponible
                        </MenuItem>
                      )}
                      {availableCharges.map((user) => (
                        <MenuItem key={user.id} value={user.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                            <Avatar
                              src={user.photoURL || undefined}
                              sx={{
                                width: 28,
                                height: 28,
                                fontSize: 12,
                                bgcolor: tokens.colors.brandNavy,
                              }}
                            >
                              {user.displayName?.charAt(0)?.toUpperCase()}
                            </Avatar>
                            <UserNameText user={user} component="span" sx={{ fontSize: 14 }} />
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </Box>
            ) : (
              <Box>
                <FieldLabel required>Client / Entreprise</FieldLabel>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Nom de l'entreprise"
                  value={formData.companyName}
                  onChange={(e) =>
                    setFormData({ ...formData, companyId: 'new', companyName: e.target.value })
                  }
                  error={showErrors && !formData.companyName.trim()}
                  sx={fieldSx}
                />
              </Box>
            )}

            {isEntreprise && (
              <Box>
                <FieldLabel required>Description</FieldLabel>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  maxRows={6}
                  placeholder="Contexte, objectifs, livrables attendus…"
                  value={formData.description}
                  onChange={(e) => {
                    const next = e.target.value.slice(0, 400);
                    setFormData({ ...formData, description: next });
                  }}
                  error={showErrors && !formData.description.trim()}
                  sx={{
                    ...fieldSx,
                    '& .MuiOutlinedInput-root': {
                      height: 'auto',
                      alignItems: 'flex-start',
                    },
                    '& .MuiInputBase-input': {
                      height: 'auto',
                      py: 1.25,
                    },
                  }}
                />
                <Typography
                  sx={{
                    mt: 0.75,
                    textAlign: 'right',
                    fontSize: 12,
                    color: tokens.colors.textTertiary,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formData.description.length}/400
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {isEntreprise && (
          <Box>
            <SectionLabel>Planning & recrutement</SectionLabel>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
              }}
            >
              <Box>
                <FieldLabel required>Lieu</FieldLabel>
                <FormControl fullWidth size="small">
                  <Select
                    value={locationType}
                    onChange={(e) => setLocationType(e.target.value as typeof locationType)}
                    sx={{
                      borderRadius: tokens.radius.md,
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.colors.borderDefault },
                    }}
                  >
                    <MenuItem value="presentiel">Présentiel</MenuItem>
                    <MenuItem value="distanciel">Distanciel</MenuItem>
                    <MenuItem value="mixte">Mixte</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              {(locationType === 'presentiel' || locationType === 'mixte') && (
                <Box>
                  <FieldLabel>Adresse</FieldLabel>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Adresse complète"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    sx={fieldSx}
                  />
                </Box>
              )}
              <Box>
                <FieldLabel required>Étudiants recherchés</FieldLabel>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  inputProps={{ min: 1 }}
                  value={formData.studentCount || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, studentCount: parseInt(e.target.value, 10) || 0 })
                  }
                  sx={fieldSx}
                />
              </Box>
              <Box>
                <FieldLabel>Durée estimée</FieldLabel>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="6 semaines"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  sx={fieldSx}
                />
              </Box>
              <Box>
                <FieldLabel required>Date de début</FieldLabel>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  value={formData.date ? new Date(formData.date).toISOString().split('T')[0] : ''}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value ? new Date(e.target.value) : null })
                  }
                  sx={fieldSx}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
              <Box>
                <FieldLabel required>Date de fin</FieldLabel>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  value={formData.endDate ? new Date(formData.endDate).toISOString().split('T')[0] : ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      endDate: e.target.value ? new Date(e.target.value) : null,
                    })
                  }
                  sx={fieldSx}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
              <Box sx={{ gridColumn: '1 / -1' }}>
                <FieldLabel>Cahier des charges</FieldLabel>
                <Box
                  sx={{
                    border: `1.5px dashed ${tokens.colors.gray300}`,
                    borderRadius: tokens.radius.lg,
                    p: 2.5,
                    textAlign: 'center',
                    bgcolor: tokens.colors.gray50,
                  }}
                >
                  <CloudUploadIcon sx={{ fontSize: 28, color: tokens.colors.textTertiary, mb: 1 }} />
                  <Typography sx={{ fontSize: 13, color: tokens.colors.textSecondary, mb: 1.5 }}>
                    PDF ou Word · max 10 Mo
                  </Typography>
                  <input
                    accept=".pdf,.doc,.docx"
                    style={{ display: 'none' }}
                    id="mission-documents-upload"
                    multiple
                    type="file"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []).filter((file) => {
                        const okType =
                          file.type === 'application/pdf' ||
                          file.type === 'application/msword' ||
                          file.type ===
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                        return okType && file.size <= 10 * 1024 * 1024;
                      });
                      setUploadedDocuments((prev) => [...prev, ...files]);
                    }}
                  />
                  <label htmlFor="mission-documents-upload">
                    <Button variant="outlined" size="small" component="span" startIcon={<CloudUploadIcon />}>
                      Sélectionner
                    </Button>
                  </label>
                  {uploadedDocuments.length > 0 && (
                    <Box sx={{ mt: 1.5, textAlign: 'left' }}>
                      {uploadedDocuments.map((file, idx) => (
                        <Box
                          key={`${file.name}-${idx}`}
                          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <Typography sx={{ fontSize: 13 }}>{file.name}</Typography>
                          <Button
                            size="small"
                            onClick={() => setUploadedDocuments((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            Retirer
                          </Button>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Divider sx={{ borderColor: tokens.colors.divider, mt: 2 }} />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: { xs: 2.5, sm: 3.5 },
          py: 2,
        }}
      >
        <Button
          onClick={onCancel}
          disabled={busy}
          sx={{
            textTransform: 'none',
            color: tokens.colors.textSecondary,
            fontWeight: 500,
            fontSize: 14,
            px: 1,
            '&:hover': { bgcolor: 'transparent', color: tokens.colors.textPrimary },
          }}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={busy}
          startIcon={
            busy ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <CheckIcon sx={{ fontSize: 18 }} />
          }
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            fontSize: 14,
            px: 2.25,
            py: 1,
            borderRadius: tokens.radius.md,
            bgcolor: tokens.colors.brandNavy,
            boxShadow: 'none',
            '&:hover': { bgcolor: tokens.colors.brandNavy700, boxShadow: tokens.shadows.sm },
            '&.Mui-disabled': { bgcolor: tokens.colors.gray300, color: '#fff' },
          }}
        >
          {creatingCompany ? 'Création…' : submitLabel}
        </Button>
      </Box>
    </Box>
  );
};

export default MissionForm;
