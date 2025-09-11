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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff, 
  ArrowForward, 
  ArrowBack,
  CloudUpload as CloudUploadIcon
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { styled } from '@mui/material';
import { registerUser } from '../firebase/auth';
import { createUserDocument } from '../firebase/firestore';
import { UserData } from '../types/user';
import { findStructureByEmail } from '../firebase/structure';
import { Structure } from '../types/structure';
import { uploadCV } from '../firebase/storage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { sendEmailVerification, applyActionCode, getAuth } from 'firebase/auth';

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

const Register: React.FC = () => {
  // États pour les étapes
  const [activeStep, setActiveStep] = useState(0);
  const steps = ['Informations personnelles', 'Informations académiques', 'Sécurité'];
  
  // États pour les champs du formulaire
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [cv, setCv] = useState<File | null>(null);
  
  // États pour l'UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [structure, setStructure] = useState<Structure | null>(null);
  const [uploadProgress, setUploadProgress] = useState<boolean>(false);
  
  // Ajouter un état pour le timer
  const [emailCheckTimer, setEmailCheckTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Ajouter un nouvel état pour les programmes
  const [schoolPrograms, setSchoolPrograms] = useState<string[]>([]);
  
  // Ajouter un nouvel état pour le programme sélectionné
  const [selectedProgram, setSelectedProgram] = useState('');
  
  const [acceptTerms, setAcceptTerms] = useState<boolean>(false);
  
  // Supprimer les états et UI liés à la vérification d'email
  // 1. Supprimer verificationSent, verificationError, SuccessMessage
  // 2. Après création du compte, afficher un message de succès simple
  const [success, setSuccess] = useState<string | null>(null);
  
  const navigate = useNavigate();
  
  // Années de diplomation disponibles
  const graduationYears = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
  
  // Fonction de validation de l'email
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
      
      // Afficher un message de succès avec l'école détectée
      setEmailError(`Email validé - ${foundStructure.ecole}`);
      return true;
    } catch (error) {
      console.error("Erreur lors de la vérification de l'email:", error);
      setEmailError("Erreur lors de la vérification de l'email");
      return false;
    }
  };
  
  const handleNext = async () => {
    if (activeStep === 0) {
      if (!firstName || !lastName || !email || !birthDate) {
        setError('Veuillez remplir tous les champs obligatoires');
        return;
      }
      
      // Validation de l'email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError('Veuillez entrer une adresse email valide');
        return;
      }

      // Vérifier si l'email appartient à une structure
      const isValidEmail = await validateEmail(email);
      if (!isValidEmail) {
        return;
      }
      
      // Validation de la date de naissance
      const today = new Date();
      const birthDateObj = new Date(birthDate);
      const age = today.getFullYear() - birthDateObj.getFullYear();
      
      if (age < 16) {
        setError('Vous devez avoir au moins 16 ans pour vous inscrire');
        return;
      }
    } else if (activeStep === 1) {
      if (!graduationYear) {
        setError('Veuillez sélectionner votre année de diplomation');
        return;
      }
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
      
      // Vérifier si le mot de passe contient au moins une lettre majuscule, une lettre minuscule et un chiffre
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(password)) {
        setError('Le mot de passe doit contenir au moins une lettre majuscule, une lettre minuscule et un chiffre');
        return;
      }
      
      handleSubmit();
      return;
    }
    
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
    setError(null);
  };
  
  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    setError(null);
  };
  
  const handleSubmit = async () => {
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
      
      // Créer l'utilisateur
      const user = await registerUser(email, password, `${firstName} ${lastName}`.trim());
      
      // Stocker les données utilisateur
      try {
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
          cvUrl: cv ? await uploadCV(cv, user.uid) : ''
        };
        
        await createUserDocument(user.uid, userData);
        
        // Afficher le message de succès
        setError(null);
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
  
  const handleGraduationYearChange = (event: SelectChangeEvent) => {
    setGraduationYear(event.target.value);
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      
      // Vérifier le type de fichier
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        setError('Le fichier doit être au format PDF ou Word (.doc, .docx)');
        return;
      }
      
      // Vérifier la taille du fichier (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setError('Le fichier ne doit pas dépasser 5MB');
        return;
      }
      
      setCv(file);
      setError(null);
    }
  };
  
  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  const handleToggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
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
            
            // Récupérer les programmes de l'école
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
  
  // Ajouter la fonction de gestion du changement de programme
  const handleProgramChange = (event: SelectChangeEvent) => {
    setSelectedProgram(event.target.value);
  };
  
  // Remplacer le Dialog de vérification par un message de succès
  // const SuccessMessage = () => (
  //   <Alert 
  //     severity="success" 
  //     sx={{ 
  //       mb: 3, 
  //       borderRadius: '8px',
  //       '& .MuiAlert-message': {
  //         width: '100%'
  //       }
  //     }}
  //   >
  //     <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
  //       Compte créé avec succès !
  //     </Typography>
  //     <Typography variant="body2">
  //       Un email de vérification a été envoyé à {email}. Veuillez cliquer sur le lien dans l'email pour activer votre compte.
  //     </Typography>
  //     <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
  //       Si vous ne recevez pas l'email dans les prochaines minutes, vérifiez votre dossier spam.
  //     </Typography>
  //   </Alert>
  // );
  
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: '#ffffff',
        p: 2
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 4,
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
            fontSize: { xs: '1.5rem', sm: '2rem' },
            mb: 3
          }}
        >
          Créer un compte JS Connect
        </Typography>
        
        <Stepper 
          activeStep={activeStep} 
          alternativeLabel
          sx={{ mb: 4 }}
        >
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
            {error}
          </Alert>
        )}
        
        <Box>
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
                id="lastName"
                label="Nom"
                name="lastName"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
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
                id="birthDate"
                label="Date de naissance"
                name="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                disabled={loading}
                variant="outlined"
                InputLabelProps={{
                  shrink: true,
                }}
                sx={{ 
                  mb: 2,
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
                  onChange={handleProgramChange}
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
                  onChange={handleGraduationYearChange}
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
                sx={{ mt: 2, mb: 3 }}
              />
            </>
          )}
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            {activeStep > 0 ? (
              <Button
                onClick={handleBack}
                disabled={loading}
                startIcon={<ArrowBack />}
                sx={{ 
                  textTransform: 'none',
                  fontWeight: 500
                }}
              >
                Retour
              </Button>
            ) : (
              <Box /> // Élément vide pour maintenir l'alignement
            )}
            
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={loading}
              endIcon={activeStep < steps.length - 1 ? <ArrowForward /> : undefined}
              sx={{ 
                borderRadius: '20px',
                px: 3,
                py: 1,
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
              ) : activeStep === steps.length - 1 ? (
                'Créer le compte'
              ) : (
                'Continuer'
              )}
            </Button>
          </Box>
        </Box>
        
        <Divider sx={{ my: 4 }} />
        
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
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
              '&:hover': {
                textDecoration: 'underline'
              }
            }}
          >
            Se connecter
          </Link>
        </Box>
      </Paper>
      
      <Typography variant="body2" color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
        En créant un compte, vous acceptez les{' '}
        <Link component={RouterLink} to="/mentions-legales" sx={{ color: '#0071e3', textDecoration: 'none' }}>
          Conditions d'utilisation
        </Link>{' '}
        et la{' '}
        <Link component={RouterLink} to="/politique-confidentialite" sx={{ color: '#0071e3', textDecoration: 'none' }}>
          Politique de confidentialité
        </Link>{' '}
        de JS Connect.
      </Typography>
    </Box>
  );
};

export default Register; 