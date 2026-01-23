import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Paper, 
  Link, 
  CircularProgress,
  Alert,
  IconButton,
  InputAdornment,
  Divider,
  Stepper,
  Step,
  StepLabel,
  FormHelperText,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Checkbox,
  FormControlLabel,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff, 
  ArrowForward, 
  ArrowBack,
  CloudUpload as CloudUploadIcon
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink, useSearchParams } from 'react-router-dom';
import { styled } from '@mui/material';
import { registerUser } from '../firebase/auth';
import { createUserDocument } from '../firebase/firestore';
import { UserData } from '../types/user';
import { findStructureByEmail } from '../firebase/structure';
import { Structure } from '../types/structure';
import { uploadCV, uploadFile } from '../firebase/storage';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getAuth } from 'firebase/auth';
import axios from 'axios';

// Style pour l'input de fichier
const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

type RegistrationType = 'student' | 'company' | 'structure';

const Register: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [searchParams] = useSearchParams();
  const registrationType: RegistrationType = (searchParams.get('type') as RegistrationType) || 'student';
  
  const navigate = useNavigate();
  
  // ========== ÉTATS COMMUNS ==========
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  // ========== ÉTATS FLUX ÉTUDIANT ==========
  const [activeStep, setActiveStep] = useState(0);
  const steps = ['Informations personnelles', 'Informations académiques', 'Sécurité'];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [birthPostalCode, setBirthPostalCode] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [cv, setCv] = useState<File | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [structure, setStructure] = useState<Structure | null>(null);
  const [uploadProgress, setUploadProgress] = useState<boolean>(false);
  const [emailCheckTimer, setEmailCheckTimer] = useState<NodeJS.Timeout | null>(null);
  const [schoolPrograms, setSchoolPrograms] = useState<string[]>([]);
  const [selectedProgram, setSelectedProgram] = useState('');
  const [acceptsElectronicDocuments, setAcceptsElectronicDocuments] = useState<boolean>(false);
  const graduationYears = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
  
  // ========== ÉTATS FLUX ENTREPRISE ==========
  const [companyName, setCompanyName] = useState('');
  const [companyContactFirstName, setCompanyContactFirstName] = useState('');
  const [companyContactLastName, setCompanyContactLastName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyPassword, setCompanyPassword] = useState('');
  const [companyConfirmPassword, setCompanyConfirmPassword] = useState('');
  
  // ========== ÉTATS FLUX STRUCTURE ==========
  const [structureName, setStructureName] = useState('');
  const [structureSchool, setStructureSchool] = useState('');
  const [structureEmail, setStructureEmail] = useState('');
  const [structurePassword, setStructurePassword] = useState('');
  const [structureConfirmPassword, setStructureConfirmPassword] = useState('');
  
  // ========== FONCTIONS COMMUNES ==========
  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  const handleToggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };
  
  // ========== FONCTIONS FLUX ÉTUDIANT ==========
  const validateEmail = async (email: string) => {
    try {
      console.log("Validation de l'email:", email);
      const foundStructure = await findStructureByEmail(email);
      console.log("Structure trouvée:", foundStructure);
      
      if (!foundStructure) {
        setEmailError("Cette adresse email n'est pas associée à une école partenaire. Veuillez utiliser votre email académique.");
        setStructure(null);
        return false;
      }
      
      setEmailError(null);
      setStructure(foundStructure);
      setEmailError(`Email validé - ${foundStructure.ecole}`);
      return true;
    } catch (error) {
      console.error("Erreur lors de la vérification de l'email:", error);
      setEmailError("Erreur lors de la vérification de l'email");
      return false;
    }
  };
  
  const handleEmailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    
    if (emailCheckTimer) {
      clearTimeout(emailCheckTimer);
    }
    
    setEmailError(null);
    
    if (newEmail && newEmail.includes('@')) {
      const timer = setTimeout(async () => {
        try {
          const foundStructure = await findStructureByEmail(newEmail);
          if (foundStructure) {
            setEmailError(`Email validé - ${foundStructure.ecole}`);
            setStructure(foundStructure);
            
            const programsRef = doc(db, 'programs', foundStructure.id);
            const programsDoc = await getDoc(programsRef);
            
            if (programsDoc.exists()) {
              const programsData = programsDoc.data();
              setSchoolPrograms(programsData.programs || []);
            } else {
              setSchoolPrograms([]);
            }
          } else {
            setEmailError("Cette adresse email n'est pas associée à une école partenaire");
            setStructure(null);
            setSchoolPrograms([]);
          }
        } catch (error) {
          console.error("Erreur lors de la vérification de l'email:", error);
          setEmailError("Erreur lors de la vérification de l'email");
          setStructure(null);
          setSchoolPrograms([]);
        }
      }, 1000);

      setEmailCheckTimer(timer);
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        setError('Le fichier doit être au format PDF ou Word (.doc, .docx)');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setError('Le fichier ne doit pas dépasser 5MB');
        return;
      }
      
      setCv(file);
      setError(null);
    }
  };
  
  const handleStudentNext = async () => {
    if (activeStep === 0) {
      const errors: Record<string, string> = {};
      
      if (!firstName || !lastName || !email || !birthDate || !birthPostalCode) {
        setError('Veuillez remplir tous les champs obligatoires');
        return;
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError('Veuillez entrer une adresse email valide');
        return;
      }

      const isValidEmail = await validateEmail(email);
      if (!isValidEmail) {
        return;
      }
      
      // Validation date de naissance (minimum 18 ans)
      const today = new Date();
      const birthDateObj = new Date(birthDate);
      const age = today.getFullYear() - birthDateObj.getFullYear();
      const monthDiff = today.getMonth() - birthDateObj.getMonth();
      const dayDiff = today.getDate() - birthDateObj.getDate();
      const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
      
      if (actualAge < 18) {
        errors.birthDate = 'Vous devez avoir au moins 18 ans pour vous inscrire';
      }
      
      // Validation code postal (5 chiffres)
      if (birthPostalCode && !/^\d{5}$/.test(birthPostalCode)) {
        errors.birthPostalCode = 'Le code postal de naissance doit contenir exactement 5 chiffres';
      }
      
      // Si des erreurs existent, les afficher et empêcher la progression
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        const firstError = Object.values(errors)[0];
        setError(firstError);
        return;
      }
      
      // Effacer les erreurs si tout est valide
      setFieldErrors({});
      setError(null);
    } else if (activeStep === 1) {
      if (!graduationYear) {
        setError('Veuillez remplir tous les champs obligatoires');
        return;
      }
      setError(null);
    } else if (activeStep === 2) {
      if (!password || !confirmPassword) {
        setError('Veuillez remplir tous les champs');
        return;
      }
      
      if (password !== confirmPassword) {
        setError('Les mots de passe ne correspondent pas');
        return;
      }
      
      if (password.length < 8) {
        setError('Le mot de passe doit contenir au moins 8 caractères');
        return;
      }
      
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(password)) {
        setError('Le mot de passe doit contenir au moins une lettre majuscule, une lettre minuscule et un chiffre');
        return;
      }
      
      handleStudentSubmit();
      return;
    }
    
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
    setError(null);
    setFieldErrors({}); // Effacer les erreurs lors de la progression
  };
  
  const handleStudentBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    setError(null);
  };
  
  const handleStudentSubmit = async () => {
    if (!structure) {
      setError("Une erreur est survenue avec la structure de l'école");
      return;
    }

    if (!acceptTerms) {
      setError("Vous devez accepter les conditions d'utilisation et la politique de confidentialité");
      return;
    }

    if (!cv) {
      setError("Vous devez télécharger votre CV pour continuer");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const user = await registerUser(email, password, `${firstName} ${lastName}`.trim());
      
      try {
        // Uploader et chiffrer le CV si fourni
        let cvUrl = '';
        if (cv) {
          // 1. Uploader le fichier dans Storage
          const fileExtension = cv.name.split('.').pop();
          const fileName = `cv_${Date.now()}.${fileExtension}`;
          const filePath = `cvs/${user.uid}/${fileName}`;
          
          const uploadResult = await uploadFile(cv, filePath);
          
          // 2. Chiffrer le fichier via Cloud Function
          // Récupérer le token de manière fiable depuis l'utilisateur fraîchement créé
          try {
            const token = await user.getIdToken(true); // Force refresh du token
            if (token) {
              try {
                await axios.post(
                  `https://us-central1-jsaas-dd2f7.cloudfunctions.net/encryptFile`,
                  { filePath },
                  {
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    }
                  }
                );
              } catch (encryptError) {
                console.warn('Erreur lors du chiffrement du CV (continuons quand même):', encryptError);
                // On continue même si le chiffrement échoue pour ne pas bloquer l'inscription
              }
            }
          } catch (tokenError) {
            console.warn('Impossible de récupérer le token pour chiffrer le CV (continuons quand même):', tokenError);
            // On continue même si on ne peut pas récupérer le token
          }
          
          cvUrl = uploadResult.url;
        }
        
        const userData: UserData = {
          displayName: `${firstName} ${lastName}`.trim(),
          email,
          firstName,
          lastName,
          birthDate,
          graduationYear,
          program: selectedProgram,
          createdAt: new Date(),
          status: 'etudiant' as const,
          structureId: structure.id,
          ecole: structure.ecole,
          cvUrl,
          acceptsElectronicDocuments: acceptsElectronicDocuments,
          acceptsElectronicDocumentsDate: acceptsElectronicDocuments ? new Date() : null,
          birthPostalCode
        } as any; // Utilisation de 'as any' car birthPostalCode n'est pas dans UserData pour l'instant
        
        await createUserDocument(user.uid, userData);
        navigate('/app/profile');
      } catch (error) {
        console.error("Erreur lors de la création du document utilisateur:", error);
        setError("Erreur lors de la création du profil. Veuillez réessayer.");
      }
      
    } catch (error: any) {
      console.error("Erreur d'inscription:", error);
      if (error.code === 'auth/email-already-in-use') {
        setError("Cette adresse email est déjà utilisée");
      } else if (error.code === 'auth/invalid-email') {
        setError("Format d'email invalide");
      } else if (error.code === 'auth/weak-password') {
        setError("Le mot de passe est trop faible");
      } else if (error.code === 'auth/too-many-requests') {
        setError("Trop de tentatives. Veuillez réessayer dans quelques minutes.");
      } else {
        setError(error.message || "Une erreur s'est produite lors de l'inscription");
      }
    } finally {
      setLoading(false);
    }
  };
  
  // ========== FONCTIONS FLUX ENTREPRISE ==========
  const handleCompanySubmit = async () => {
    const errors: Record<string, string> = {};
    
    // Validation des champs
    if (!companyName || !companyContactFirstName || !companyContactLastName || !companyEmail || !companyPhone || !companyPassword || !companyConfirmPassword) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(companyEmail)) {
      setError('Veuillez entrer une adresse email valide');
      return;
    }
    
    // Validation téléphone (10 chiffres)
    const phoneDigits = companyPhone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      errors.companyPhone = 'Le numéro de téléphone doit contenir exactement 10 chiffres';
    }
    
    if (companyPassword !== companyConfirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    
    if (companyPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(companyPassword)) {
      setError('Le mot de passe doit contenir au moins une lettre majuscule, une lettre minuscule et un chiffre');
      return;
    }

    if (!acceptTerms) {
      setError("Vous devez accepter les conditions d'utilisation et la politique de confidentialité");
      return;
    }
    
    // Si des erreurs existent, les afficher et empêcher la soumission
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstError = Object.values(errors)[0];
      setError(firstError);
      return;
    }
    
    // Effacer les erreurs si tout est valide
    setFieldErrors({});

    try {
      setLoading(true);
      setError(null);
      
      const user = await registerUser(companyEmail, companyPassword, `${companyContactFirstName} ${companyContactLastName}`.trim());
      
      try {
        const userData: any = {
          displayName: `${companyContactFirstName} ${companyContactLastName}`.trim(),
          email: companyEmail,
          firstName: companyContactFirstName,
          lastName: companyContactLastName,
          phone: companyPhone,
          companyName: companyName,
          createdAt: new Date(),
          status: 'entreprise' as any
        };
        
        await createUserDocument(user.uid, userData);
        
        setFieldErrors({}); // Effacer les erreurs après succès
        // Rediriger vers le formulaire de mission après l'inscription
        navigate('/app/mission?new=true');
      } catch (error) {
        console.error("Erreur lors de la création du document utilisateur:", error);
        setError("Erreur lors de la création du profil. Veuillez réessayer.");
      }
      
    } catch (error: any) {
      console.error("Erreur d'inscription:", error);
      if (error.code === 'auth/email-already-in-use') {
        setError("Cette adresse email est déjà utilisée");
      } else if (error.code === 'auth/invalid-email') {
        setError("Format d'email invalide");
      } else if (error.code === 'auth/weak-password') {
        setError("Le mot de passe est trop faible");
      } else {
        setError(error.message || "Une erreur s'est produite lors de l'inscription");
      }
    } finally {
      setLoading(false);
    }
  };
  
  // ========== FONCTIONS FLUX STRUCTURE ==========
  const handleStructureSubmit = async () => {
    if (!structureName || !structureSchool || !structureEmail || !structurePassword || !structureConfirmPassword) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(structureEmail)) {
      setError('Veuillez entrer une adresse email valide');
      return;
    }
    
    if (structurePassword !== structureConfirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    
    if (structurePassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(structurePassword)) {
      setError('Le mot de passe doit contenir au moins une lettre majuscule, une lettre minuscule et un chiffre');
      return;
    }
    
    if (!acceptTerms) {
      setError("Vous devez accepter les conditions d'utilisation et la politique de confidentialité");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const user = await registerUser(structureEmail, structurePassword, structureName);
      
      try {
        const userData: any = {
          displayName: structureName,
          email: structureEmail,
          firstName: structureName,
          lastName: '',
          createdAt: new Date(),
          status: 'admin_structure' as any,
          structureName: structureName,
          ecole: structureSchool,
          // Initialiser l'essai gratuit
          trialStartDate: new Date(),
          trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
          hasActiveTrial: true
        };
        
        await createUserDocument(user.uid, userData);
        navigate('/app/profile');
      } catch (error) {
        console.error("Erreur lors de la création du document utilisateur:", error);
        setError("Erreur lors de la création du profil. Veuillez réessayer.");
      }
      
    } catch (error: any) {
      console.error("Erreur d'inscription:", error);
      if (error.code === 'auth/email-already-in-use') {
        setError("Cette adresse email est déjà utilisée");
      } else if (error.code === 'auth/invalid-email') {
        setError("Format d'email invalide");
      } else if (error.code === 'auth/weak-password') {
        setError("Le mot de passe est trop faible");
      } else {
        setError(error.message || "Une erreur s'est produite lors de l'inscription");
      }
    } finally {
      setLoading(false);
    }
  };
  
  // ========== RENDU ==========
  const getTitle = () => {
    switch (registrationType) {
      case 'company':
        return "Créer un compte Entreprise";
      case 'structure':
        return "Créer un compte Junior";
      default:
        return "Créer un compte JS Connect";
    }
  };
  
  const getChangeProfileLink = () => {
    const types = {
      student: 'Étudiant',
      company: 'Entreprise',
      structure: 'Junior'
    };
    
    return (
      <Box sx={{ textAlign: 'center', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Vous n'êtes pas {types[registrationType]} ?{' '}
          <Link 
            component={RouterLink} 
            to="/" 
            sx={{ color: '#0071e3', textDecoration: 'none', fontWeight: 500 }}
          >
            Choisir un autre profil
          </Link>
        </Typography>
      </Box>
    );
  };
  
  const renderStudentForm = () => (
    <>
      <Stepper 
        activeStep={activeStep} 
        alternativeLabel
        sx={{ 
          mb: { xs: 3, sm: 4 },
          '& .MuiStepLabel-label': {
            fontSize: { xs: '0.75rem', sm: '0.875rem' }
          }
        }}
      >
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      
      {activeStep === 0 && (
        <>
          <TextField
            margin="normal"
            required
            fullWidth
            id="firstName"
            label="Prénom"
            name="firstName"
            autoComplete="given-name"
            autoFocus
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={loading}
            variant="outlined"
            sx={{ 
              mb: { xs: 1.5, sm: 2 },
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px'
              }
            }}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            id="lastName"
            label="Nom"
            name="lastName"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={loading}
            variant="outlined"
            sx={{ 
              mb: { xs: 1.5, sm: 2 },
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px'
              }
            }}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Adresse email académique"
            name="email"
            autoComplete="email"
            value={email}
            onChange={handleEmailChange}
            disabled={loading}
            error={!!emailError && !emailError.includes('validé')}
            helperText={emailError || "Utilisez votre adresse email académique"}
            variant="outlined"
            sx={{ 
              mb: { xs: 1.5, sm: 2 },
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px'
              }
            }}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            id="birthDate"
            label="Date de naissance"
            name="birthDate"
            type="date"
            value={birthDate}
            onChange={(e) => {
              setBirthDate(e.target.value);
              // Effacer l'erreur si elle existe
              if (fieldErrors.birthDate) {
                setFieldErrors(prev => {
                  const newErrors = { ...prev };
                  delete newErrors.birthDate;
                  return newErrors;
                });
              }
            }}
            disabled={loading}
            variant="outlined"
            InputLabelProps={{
              shrink: true,
            }}
            error={!!fieldErrors.birthDate}
            helperText={fieldErrors.birthDate || "Vous devez avoir au moins 18 ans"}
            inputProps={{ max: new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0] }}
            sx={{ 
              mb: { xs: 1.5, sm: 2 },
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px'
              }
            }}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            id="birthPostalCode"
            label="Code postal de naissance"
            name="birthPostalCode"
            value={birthPostalCode}
            onChange={(e) => {
              // Ne garder que les chiffres
              const value = e.target.value.replace(/\D/g, '').slice(0, 5);
              setBirthPostalCode(value);
              // Effacer l'erreur si elle existe
              if (fieldErrors.birthPostalCode) {
                setFieldErrors(prev => {
                  const newErrors = { ...prev };
                  delete newErrors.birthPostalCode;
                  return newErrors;
                });
              }
            }}
            disabled={loading}
            variant="outlined"
            inputProps={{ maxLength: 5 }}
            error={!!fieldErrors.birthPostalCode}
            helperText={fieldErrors.birthPostalCode || "5 chiffres requis"}
            sx={{ 
              mb: { xs: 1.5, sm: 2 },
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px'
              }
            }}
          />
        </>
      )}
      
      {activeStep === 1 && (
        <>
          <FormControl 
            fullWidth 
            required
            sx={{ 
              mb: 3,
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px'
              }
            }}
          >
            <InputLabel id="program-label">Programme</InputLabel>
            <Select
              labelId="program-label"
              id="program"
              value={selectedProgram}
              label="Programme"
              onChange={(e) => setSelectedProgram(e.target.value)}
              disabled={loading || schoolPrograms.length === 0}
            >
              {schoolPrograms.length > 0 ? (
                schoolPrograms.map((program) => (
                  <MenuItem key={program} value={program}>
                    {program}
                  </MenuItem>
                ))
              ) : (
                <MenuItem disabled value="">
                  {structure ? "Chargement des programmes..." : "Veuillez d'abord valider votre email"}
                </MenuItem>
              )}
            </Select>
            <FormHelperText>
              {!structure && "Veuillez d'abord renseigner votre email académique"}
            </FormHelperText>
          </FormControl>
          
          <FormControl 
            fullWidth 
            required
            sx={{ 
              mb: 3,
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px'
              }
            }}
          >
            <InputLabel id="graduation-year-label">Année de diplomation</InputLabel>
            <Select
              labelId="graduation-year-label"
              id="graduationYear"
              value={graduationYear}
              label="Année de diplomation"
              onChange={(e) => setGraduationYear(e.target.value)}
              disabled={loading}
            >
              {graduationYears.map((year) => (
                <MenuItem key={year} value={year.toString()}>
                  {year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              CV (obligatoire)
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                component="label"
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                sx={{ 
                  borderRadius: '8px',
                  textTransform: 'none',
                  py: 1.5
                }}
                disabled={uploadProgress}
              >
                {uploadProgress ? 'Téléchargement...' : 'Télécharger votre CV'}
                <VisuallyHiddenInput 
                  type="file" 
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx"
                  required
                />
              </Button>
              {uploadProgress && <CircularProgress size={24} />}
            </Box>
            {cv && (
              <Typography variant="body2" sx={{ mt: 1, color: 'success.main' }}>
                Fichier sélectionné: {cv.name}
              </Typography>
            )}
            <FormHelperText>
              Formats acceptés: PDF, Word (.doc, .docx) - Max 5MB
            </FormHelperText>
          </Box>
        </>
      )}
      
      {activeStep === 2 && (
        <>
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Mot de passe"
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            variant="outlined"
            sx={{ 
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px'
              }
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleTogglePasswordVisibility}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
            helperText="8 caractères minimum, avec au moins une majuscule, une minuscule et un chiffre"
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            name="confirmPassword"
            label="Confirmer le mot de passe"
            type={showConfirmPassword ? 'text' : 'password'}
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            variant="outlined"
            sx={{ 
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px'
              }
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle confirm password visibility"
                    onClick={handleToggleConfirmPasswordVisibility}
                    edge="end"
                  >
                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                color="primary"
                sx={{
                  '&.Mui-checked': {
                    color: '#0071e3',
                  },
                }}
              />
            }
            label={
              <Typography variant="body2">
                En cochant cette case, j'accepte les{' '}
                <Link component={RouterLink} to="/mentions-legales" sx={{ color: '#0071e3', textDecoration: 'none' }}>
                  Conditions d'utilisation
                </Link>{' '}
                et la{' '}
                <Link component={RouterLink} to="/politique-confidentialite" sx={{ color: '#0071e3', textDecoration: 'none' }}>
                  Politique de confidentialité
                </Link>
              </Typography>
            }
            sx={{ mt: 2, mb: 2 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={acceptsElectronicDocuments}
                onChange={(e) => setAcceptsElectronicDocuments(e.target.checked)}
                color="primary"
                sx={{
                  '&.Mui-checked': {
                    color: '#0071e3',
                  },
                }}
              />
            }
            label={
              <Typography variant="body2">
                J'accepte de recevoir mes documents administratifs (bulletins, contrats) par voie électronique sur mon espace personnel.
              </Typography>
            }
            sx={{ mb: 3 }}
          />
        </>
      )}
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: { xs: 3, sm: 4 }, flexDirection: { xs: 'column-reverse', sm: 'row' }, gap: { xs: 2, sm: 0 } }}>
        {activeStep > 0 ? (
          <Button
            onClick={handleStudentBack}
            disabled={loading}
            startIcon={<ArrowBack />}
            fullWidth={isMobile}
            sx={{ 
              textTransform: 'none',
              fontWeight: 500,
              fontSize: { xs: '0.85rem', sm: '0.875rem' }
            }}
          >
            Retour
          </Button>
        ) : (
          <Box />
        )}
        
        <Button
          variant="contained"
          onClick={handleStudentNext}
          disabled={loading}
          endIcon={activeStep < steps.length - 1 ? <ArrowForward /> : undefined}
          fullWidth={isMobile}
          sx={{ 
            borderRadius: '20px',
            px: { xs: 2, sm: 3 },
            py: { xs: 1.25, sm: 1 },
            textTransform: 'none',
            fontWeight: 500,
            fontSize: { xs: '0.85rem', sm: '0.875rem' },
            bgcolor: '#0071e3',
            '&:hover': {
              bgcolor: '#0062c3'
            }
          }}
        >
          {loading ? (
            <CircularProgress size={24} color="inherit" />
          ) : activeStep === steps.length - 1 ? (
            'Créer le compte'
          ) : (
            'Continuer'
          )}
        </Button>
      </Box>
    </>
  );
  
  const renderCompanyForm = () => (
    <>
          <TextField
            margin="normal"
            required
            fullWidth
            id="companyName"
            label="Nom de l'entreprise"
            name="companyName"
            autoFocus
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            disabled={loading}
            variant="outlined"
            sx={{ 
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px'
              }
            }}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            id="companyContactFirstName"
            label="Prénom du contact"
            name="companyContactFirstName"
            value={companyContactFirstName}
            onChange={(e) => setCompanyContactFirstName(e.target.value)}
            disabled={loading}
            variant="outlined"
            sx={{ 
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px'
              }
            }}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            id="companyContactLastName"
            label="Nom du contact"
            name="companyContactLastName"
            value={companyContactLastName}
            onChange={(e) => setCompanyContactLastName(e.target.value)}
            disabled={loading}
            variant="outlined"
            sx={{ 
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px'
              }
            }}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            id="companyEmail"
            label="Email professionnel"
            name="companyEmail"
            type="email"
            value={companyEmail}
            onChange={(e) => setCompanyEmail(e.target.value)}
            disabled={loading}
            variant="outlined"
            sx={{ 
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px'
              }
            }}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            id="companyPhone"
            label="Téléphone"
            name="companyPhone"
            type="tel"
            value={companyPhone}
            onChange={(e) => {
              // Ne garder que les chiffres, espaces, +, - et ()
              const value = e.target.value.replace(/[^\d+\s()-]/g, '');
              setCompanyPhone(value);
              // Effacer l'erreur si elle existe
              if (fieldErrors.companyPhone) {
                setFieldErrors(prev => {
                  const newErrors = { ...prev };
                  delete newErrors.companyPhone;
                  return newErrors;
                });
              }
            }}
            disabled={loading}
            variant="outlined"
            error={!!fieldErrors.companyPhone}
            helperText={fieldErrors.companyPhone || "10 chiffres requis (ex: 06 12 34 56 78)"}
            sx={{ 
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px'
              }
            }}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            name="companyPassword"
            label="Mot de passe"
            type={showPassword ? 'text' : 'password'}
            id="companyPassword"
            value={companyPassword}
            onChange={(e) => setCompanyPassword(e.target.value)}
            disabled={loading}
            variant="outlined"
            sx={{ 
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px'
              }
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleTogglePasswordVisibility}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
            helperText="8 caractères minimum, avec au moins une majuscule, une minuscule et un chiffre"
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            name="companyConfirmPassword"
            label="Confirmer le mot de passe"
            type={showConfirmPassword ? 'text' : 'password'}
            id="companyConfirmPassword"
            value={companyConfirmPassword}
            onChange={(e) => setCompanyConfirmPassword(e.target.value)}
            disabled={loading}
            variant="outlined"
            sx={{ 
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px'
              }
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle confirm password visibility"
                    onClick={handleToggleConfirmPasswordVisibility}
                    edge="end"
                  >
                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          
          <FormControlLabel
            control={
              <Checkbox
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                color="primary"
                sx={{
                  '&.Mui-checked': {
                    color: '#0071e3',
                  },
                }}
              />
            }
            label={
              <Typography variant="body2">
                En cochant cette case, j'accepte les{' '}
                <Link component={RouterLink} to="/mentions-legales" sx={{ color: '#0071e3', textDecoration: 'none' }}>
                  Conditions d'utilisation
                </Link>{' '}
                et la{' '}
                <Link component={RouterLink} to="/politique-confidentialite" sx={{ color: '#0071e3', textDecoration: 'none' }}>
                  Politique de confidentialité
                </Link>
              </Typography>
            }
            sx={{ mt: 2, mb: 2 }}
          />
      
      <Button
        variant="contained"
        fullWidth
        onClick={handleCompanySubmit}
        disabled={loading}
        sx={{ 
          borderRadius: '20px',
          px: 3,
          py: 1.5,
          mt: 3,
          textTransform: 'none',
          fontWeight: 500,
          bgcolor: '#0071e3',
          '&:hover': {
            bgcolor: '#0062c3'
          }
        }}
      >
        {loading ? (
          <CircularProgress size={24} color="inherit" />
        ) : (
          'Créer le compte'
        )}
      </Button>
    </>
  );
  
  const renderStructureForm = () => (
    <>
      <Alert 
        severity="success" 
        sx={{ 
          mb: 3, 
          borderRadius: '8px',
          bgcolor: '#f0f9ff',
          border: '1px solid #0ea5e9'
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          🎉 Votre essai gratuit de 1 mois commence dès l'inscription.
        </Typography>
        <Typography variant="body2">
          Accédez à toutes les fonctionnalités pendant 30 jours, sans engagement.
        </Typography>
      </Alert>
      
      <TextField
        margin="normal"
        required
        fullWidth
        id="structureName"
        label="Nom de la junior"
        name="structureName"
        autoFocus
        value={structureName}
        onChange={(e) => setStructureName(e.target.value)}
        disabled={loading}
        variant="outlined"
        sx={{ 
          mb: 2,
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px'
          }
        }}
      />
      
      <TextField
        margin="normal"
        required
        fullWidth
        id="structureSchool"
        label="École de rattachement"
        name="structureSchool"
        value={structureSchool}
        onChange={(e) => setStructureSchool(e.target.value)}
        disabled={loading}
        variant="outlined"
        sx={{ 
          mb: 2,
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px'
          }
        }}
      />
      
      <TextField
        margin="normal"
        required
        fullWidth
        id="structureEmail"
        label="Email Admin (Login)"
        name="structureEmail"
        type="email"
        value={structureEmail}
        onChange={(e) => setStructureEmail(e.target.value)}
        disabled={loading}
        variant="outlined"
        sx={{ 
          mb: 2,
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px'
          }
        }}
      />
      
      <TextField
        margin="normal"
        required
        fullWidth
        name="structurePassword"
        label="Mot de passe"
        type={showPassword ? 'text' : 'password'}
        id="structurePassword"
        value={structurePassword}
        onChange={(e) => setStructurePassword(e.target.value)}
        disabled={loading}
        variant="outlined"
        sx={{ 
          mb: 2,
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px'
          }
        }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label="toggle password visibility"
                onClick={handleTogglePasswordVisibility}
                edge="end"
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          )
        }}
        helperText="8 caractères minimum, avec au moins une majuscule, une minuscule et un chiffre"
      />
      
      <TextField
        margin="normal"
        required
        fullWidth
        name="structureConfirmPassword"
        label="Confirmer le mot de passe"
        type={showConfirmPassword ? 'text' : 'password'}
        id="structureConfirmPassword"
        value={structureConfirmPassword}
        onChange={(e) => setStructureConfirmPassword(e.target.value)}
        disabled={loading}
        variant="outlined"
        sx={{ 
          mb: 2,
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px'
          }
        }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label="toggle confirm password visibility"
                onClick={handleToggleConfirmPasswordVisibility}
                edge="end"
              >
                {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          )
        }}
      />
      
      <FormControlLabel
        control={
          <Checkbox
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            color="primary"
            sx={{
              '&.Mui-checked': {
                color: '#0071e3',
              },
            }}
          />
        }
        label={
          <Typography variant="body2">
            En cochant cette case, j'accepte les{' '}
            <Link component={RouterLink} to="/mentions-legales" sx={{ color: '#0071e3', textDecoration: 'none' }}>
              Conditions d'utilisation
            </Link>{' '}
            et la{' '}
            <Link component={RouterLink} to="/politique-confidentialite" sx={{ color: '#0071e3', textDecoration: 'none' }}>
              Politique de confidentialité
            </Link>
          </Typography>
        }
        sx={{ mt: 2, mb: 3 }}
      />
      
      <Button
        variant="contained"
        fullWidth
        onClick={handleStructureSubmit}
        disabled={loading}
        sx={{ 
          borderRadius: '20px',
          px: 3,
          py: 1.5,
          textTransform: 'none',
          fontWeight: 500,
          bgcolor: '#0071e3',
          '&:hover': {
            bgcolor: '#0062c3'
          }
        }}
      >
        {loading ? (
          <CircularProgress size={24} color="inherit" />
        ) : (
          'Créer le compte'
        )}
      </Button>
    </>
  );
  
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: { xs: 'calc(100vh - 80px)', sm: '100vh' },
        bgcolor: '#ffffff',
        p: { xs: 1.5, sm: 2 }
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 4 },
          maxWidth: 600,
          width: '100%',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
        }}
      >
        <Typography 
          variant="h4" 
          component="h1" 
          align="center" 
          gutterBottom
          sx={{ 
            fontWeight: 600, 
            fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2rem' },
            mb: { xs: 2, sm: 3 }
          }}
        >
          {getTitle()}
        </Typography>
        
        {getChangeProfileLink()}
        
        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
            {error}
          </Alert>
        )}
        
        <Box>
          {registrationType === 'student' && renderStudentForm()}
          {registrationType === 'company' && renderCompanyForm()}
          {registrationType === 'structure' && renderStructureForm()}
        </Box>
        
        <Divider sx={{ my: { xs: 3, sm: 4 } }} />
        
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
            Vous avez déjà un identifiant JS Connect ?
          </Typography>
          <Link 
            component={RouterLink} 
            to="/login" 
            variant="body2"
            sx={{ 
              color: '#0071e3',
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: { xs: '0.8rem', sm: '0.875rem' },
              '&:hover': {
                textDecoration: 'underline'
              }
            }}
          >
            Se connecter
          </Link>
        </Box>
      </Paper>
      
      <Typography variant="body2" color="text.secondary" sx={{ mt: { xs: 2, sm: 4 }, mb: { xs: 2, sm: 0 }, textAlign: 'center', px: { xs: 2, sm: 0 }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
        En créant un compte, vous acceptez les{' '}
        <Link component={RouterLink} to="/mentions-legales" sx={{ color: '#0071e3', textDecoration: 'none', fontSize: 'inherit' }}>
          Conditions d'utilisation
        </Link>{' '}
        et la{' '}
        <Link component={RouterLink} to="/politique-confidentialite" sx={{ color: '#0071e3', textDecoration: 'none', fontSize: 'inherit' }}>
          Politique de confidentialité
        </Link>{' '}
        de JS Connect.
      </Typography>
    </Box>
  );
};

export default Register;
